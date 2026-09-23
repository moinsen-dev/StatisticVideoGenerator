import type AnthropicSDK from '@anthropic-ai/sdk';
import {
  datasetJsonSchema,
  parseDataset,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
} from '../../shared/dataset.ts';
import { systemPrompt, userPrompt } from '../../shared/prompt.ts';

// Research with the visitor's own Anthropic API key, straight from the browser (BYOK).
// The key goes to api.anthropic.com only; this app has no server in this mode.
// Claude researches with the server-side web tools and delivers the dataset by calling a
// strict client tool, the same contract the local CLI path fulfils via --json-schema.

const MODELS = { fast: 'claude-sonnet-5', thorough: 'claude-opus-5' } as const;
// USD per million tokens (input, output); web search is billed per request.
const PRICES = { 'claude-sonnet-5': [2, 10], 'claude-opus-5': [5, 25] } as const;
const SEARCH_USD = 0.01;
const MAX_TURNS = 8;

type Schema = Record<string, unknown>;

/** Strict tool schemas want anyOf instead of type arrays, and closed objects everywhere. */
function toStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrict);
  if (!node || typeof node !== 'object') return node;
  const src = node as Schema;
  const out: Schema = {};
  for (const [k, v] of Object.entries(src)) out[k] = toStrict(v);
  if (Array.isArray(src.type)) {
    const { type, description, ...rest } = out;
    return {
      ...(description ? { description } : {}),
      anyOf: (type as string[]).map((t) => (t === 'null' ? { type: 'null' } : { ...rest, type: t })),
    };
  }
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as Schema);
  }
  return out;
}

const clip = (s: string, n = 180) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export async function researchWithApiKey(
  req: ResearchRequest,
  apiKey: string,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  // Loaded on demand: the SDK is only needed when someone researches with their own key.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const model = MODELS[req.depth];
  const [inPrice, outPrice] = PRICES[model];
  const started = Date.now();
  const emit = (
    kind: ResearchProgress['kind'],
    text: string,
    code?: ResearchProgress['code'],
    vars?: ResearchProgress['vars'],
  ) => onProgress({ kind, text, at: Date.now() - started, ...(code ? { code, vars } : {}) });

  const tools = [
    { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 10 },
    { type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 6 },
    {
      name: 'submit_dataset',
      description: 'Deliver the finished dataset. Call exactly once, at the very end, with the complete dataset.',
      input_schema: toStrict(datasetJsonSchema()) as AnthropicSDK.Tool.InputSchema,
      strict: true,
      eager_input_streaming: true,
    },
  ];
  const messages: AnthropicSDK.Beta.BetaMessageParam[] = [{ role: 'user', content: userPrompt(req) }];
  let searches = 0;
  let fetches = 0;
  let costUsd = 0;
  let resolvedModel: string = model;

  emit('status', `Claude (${model}) startet die Recherche …`, 'start', { model });
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let writing = false;
      let written = 0;
      let lastLive = 0;
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 64000,
          system: systemPrompt(req, 'tool'),
          tools,
          messages,
          ...(model === 'claude-opus-5'
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
        },
        { signal },
      );
      stream.on('streamEvent', (event) => {
        if (event.type !== 'content_block_start') return;
        const block = event.content_block;
        writing = block.type === 'tool_use' && block.name === 'submit_dataset';
        if (block.type === 'thinking') emit('live', 'Denkt nach …', 'thinking');
      });
      stream.on('inputJson', (delta) => {
        if (!writing) return;
        written += delta.length;
        const now = Date.now();
        if (now - lastLive < 1200) return;
        lastLive = now;
        emit('live', `Schreibt den Datensatz … ${written} Zeichen`, 'writing', { n: written.toLocaleString() });
      });
      stream.on('contentBlock', (block) => {
        if (block.type === 'server_tool_use') {
          const input = (block.input ?? {}) as { query?: string; url?: string };
          if (block.name === 'web_search') {
            searches++;
            emit('search', clip(String(input.query ?? '')));
          } else if (block.name === 'web_fetch') {
            fetches++;
            emit('fetch', clip(String(input.url ?? '')));
          }
        } else if (block.type === 'web_search_tool_result' && !Array.isArray(block.content)) {
          emit('note', `Websuche meldet: ${block.content.error_code}`);
        } else if (block.type === 'text' && block.text.trim()) {
          emit('note', clip(block.text));
        } else if (block.type === 'tool_use' && block.name === 'submit_dataset') {
          emit('status', 'Datensatz wird geprüft …', 'checking');
        }
      });

      const message = await stream.finalMessage();
      resolvedModel = message.model;
      const u = message.usage;
      costUsd +=
        ((u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1) * inPrice +
          u.output_tokens * outPrice) /
          1e6 +
        (u.server_tool_use?.web_search_requests ?? 0) * SEARCH_USD;

      if (message.stop_reason === 'refusal') throw new Error('Claude hat diese Anfrage abgelehnt. Formuliere das Thema anders.');
      const submitted = message.content.find((b) => b.type === 'tool_use' && b.name === 'submit_dataset');
      if (submitted && submitted.type === 'tool_use') {
        if (message.stop_reason === 'max_tokens') throw new Error('Der Datensatz wurde abgeschnitten (max_tokens).');
        const dataset = parseDataset(submitted.input);
        emit('status', 'Fertig', 'done', {
          series: dataset.series.length,
          points: dataset.timeline.length,
          events: dataset.events.length,
        });
        return {
          dataset,
          meta: { model: resolvedModel, durationMs: Date.now() - started, searches, fetches, costUsd },
        };
      }
      if (message.stop_reason === 'max_tokens') throw new Error('Die Antwort wurde abgeschnitten (max_tokens).');
      messages.push({ role: 'assistant', content: message.content });
      // pause_turn: the server-side tool loop paused; sending the turn back resumes it.
      if (message.stop_reason !== 'pause_turn') {
        messages.push({ role: 'user', content: 'Call submit_dataset now with the complete dataset.' });
      }
    }
    throw new Error('Claude hat keinen Datensatz geliefert.');
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Der API-Key wurde abgelehnt (401). Bitte prüfen.');
    if (err instanceof Anthropic.PermissionDeniedError) {
      throw new Error(`Keine Berechtigung (403): ${err.message}. Ist die Websuche in der Claude Console freigeschaltet?`);
    }
    if (err instanceof Anthropic.RateLimitError) throw new Error('Rate-Limit erreicht (429). In einer Minute nochmal versuchen.');
    if (err instanceof Anthropic.BadRequestError) throw new Error(`Anfrage abgelehnt (400): ${err.message}`);
    if (err instanceof Anthropic.APIUserAbortError) throw new Error('Recherche abgebrochen.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error(`Keine Verbindung zur Anthropic-API: ${err.message}`);
    throw err;
  }
}
