import { strictJsonSchema, type ServerStatus } from '../../shared/dataset.ts';
import { REVIEW_SYSTEM, reviewPrompt, VerdictSchema, type ReviewInput, type Verdict } from '../../shared/review.ts';
import { getLang, translate } from './i18n.ts';
import { getKey } from './keys.ts';
import { apiBase, getLocalConfig } from './local-model.ts';
import { availableProviders, defaultProvider, isReady, modelLabel, PROVIDERS, type ProviderId } from './providers.ts';
import { explainApiError, message } from './research-common.ts';

// Before an entry goes into the public gallery, the submitter's own AI reviews it against the gallery
// rules: the key, local model or CLI they research with. moinsen runs no AI of its own.

export type Review = { verdict: Verdict; model: string };

/** The saved research AI if it is ready, otherwise the first one that is; null when none is set up. */
export function reviewProvider(status: ServerStatus | null): ProviderId | null {
  const saved = defaultProvider(status);
  if (isReady(saved, status)) return saved;
  return availableProviders(status).find((id) => isReady(id, status)) ?? null;
}

/** "Anthropic · Claude Sonnet 5", or the local model's name. */
export const reviewerLabel = (id: ProviderId) =>
  id === 'local' ? modelLabel(id, 'fast') : `${PROVIDERS[id].vendor} · ${PROVIDERS[id].models.fast}`;

export async function reviewEntry(id: ProviderId, input: ReviewInput): Promise<Review> {
  if (id === 'claude-code' || id === 'codex') return reviewWithCli(id === 'codex' ? 'codex' : 'claude', input);
  if (id === 'local') return reviewWithLocalModel(input);
  if (id === 'anthropic') return reviewWithAnthropic(getKey('anthropic'), input);
  return reviewWithOpenAI(getKey('openai'), input);
}

/** A model that refuses to review an entry has found it objectionable. */
const refused = (): Verdict => ({ allowed: false, reason: translate(getLang(), 'publishReviewRefused') });

async function reviewWithCli(cli: 'claude' | 'codex', input: ReviewInput): Promise<Review> {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cli, topic: input.topic, dataset: input.dataset }),
  });
  const body = (await res.json().catch(() => null)) as (Review & { message?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body;
}

const ANTHROPIC_MODEL = 'claude-sonnet-5';

async function reviewWithAnthropic(apiKey: string, input: ReviewInput): Promise<Review> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
  ]);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.messages.parse({
      model: ANTHROPIC_MODEL,
      // Sonnet 5 thinks adaptively by default; low effort keeps a review at a cent or two.
      max_tokens: 4096,
      system: REVIEW_SYSTEM,
      messages: [{ role: 'user', content: reviewPrompt(input) }],
      output_config: { effort: 'low', format: zodOutputFormat(VerdictSchema) },
    });
    const verdict = response.stop_reason === 'refusal' || !response.parsed_output ? refused() : response.parsed_output;
    return { verdict, model: response.model };
  } catch (err) {
    throw explainApiError(err, Anthropic, 'Anthropic', ANTHROPIC_MODEL);
  }
}

const OPENAI_MODEL = 'gpt-6-sol';

async function reviewWithOpenAI(apiKey: string, input: ReviewInput): Promise<Review> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  try {
    // A rejected POST comes without CORS headers; this lookup names a wrong key or model first.
    await client.models.retrieve(OPENAI_MODEL);
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: REVIEW_SYSTEM,
      input: reviewPrompt(input),
      text: { format: { type: 'json_schema', name: 'verdict', schema: strictJsonSchema(VerdictSchema), strict: true } },
      reasoning: { effort: 'low' },
      max_output_tokens: 4000,
      store: false,
    });
    const content = response.output.flatMap((item) => (item.type === 'message' ? item.content : []));
    const verdict = content.some((part) => part.type === 'refusal') ? refused() : VerdictSchema.parse(JSON.parse(response.output_text));
    return { verdict, model: response.model };
  } catch (err) {
    if (err instanceof OpenAI.APIConnectionError) throw message('errNoAnswer', { vendor: 'OpenAI' });
    throw explainApiError(err, OpenAI, 'OpenAI', OPENAI_MODEL);
  }
}

async function reviewWithLocalModel(input: ReviewInput): Promise<Review> {
  const { url, model } = getLocalConfig();
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL: apiBase(url), apiKey: 'local', dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 10 * 60_000 });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: REVIEW_SYSTEM },
        { role: 'user', content: reviewPrompt(input) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'verdict', schema: strictJsonSchema(VerdictSchema), strict: true } },
      reasoning_effort: 'none',
    });
    const choice = completion.choices[0]?.message;
    const verdict = choice?.refusal ? refused() : VerdictSchema.parse(JSON.parse(choice?.content ?? ''));
    return { verdict, model };
  } catch (err) {
    throw explainApiError(err, OpenAI, url, model);
  }
}
