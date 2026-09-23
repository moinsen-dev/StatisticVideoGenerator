import type OpenAISDK from 'openai';
import {
  datasetJsonSchema,
  parseDataset,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
} from '../../shared/dataset.ts';
import { systemPrompt, userPrompt } from '../../shared/prompt.ts';
import { clip, explainApiError, message, progressEmitter, toStrict, writingMeter } from './research-common.ts';

// Research with the visitor's own OpenAI API key, straight from the browser (BYOK).
// Responses API with the hosted web_search tool; the dataset arrives as structured output
// (strict JSON schema), the same contract the local CLI path fulfils via --json-schema.
// store: false keeps the research out of the visitor's OpenAI response history.

const MODELS = { fast: 'gpt-6-sol', thorough: 'gpt-6-astra' } as const;
// USD per million tokens (input, cached input, output); web search is billed per call,
// the search results it reads count as input tokens.
const PRICES = { 'gpt-6-sol': [2, 0.2, 10], 'gpt-6-astra': [10, 1, 50] } as const;
const SEARCH_USD = 0.01;

export async function researchWithOpenAI(
  req: ResearchRequest,
  apiKey: string,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const model = MODELS[req.depth];
  const [inPrice, cachedPrice, outPrice] = PRICES[model];
  const { emit, started } = progressEmitter(onProgress);
  const wrote = writingMeter(emit);
  let searches = 0;
  let fetches = 0;

  emit('status', `${model} starts researching …`, 'start', { model });
  try {
    // OpenAI answers a rejected POST (wrong key, no credit) without CORS headers, so the browser
    // sees only a network error. This lookup carries them: it reports a wrong key or a model the
    // key cannot use in plain words before the research starts.
    await client.models.retrieve(model, { signal });
    const stream = await client.responses.create(
      {
        model,
        instructions: systemPrompt(req),
        input: userPrompt(req),
        tools: [{ type: 'web_search' }],
        text: {
          format: {
            type: 'json_schema',
            name: 'dataset',
            schema: toStrict(datasetJsonSchema()) as Record<string, unknown>,
            strict: true,
          },
        },
        reasoning: { effort: 'medium' },
        max_output_tokens: 32000,
        store: false,
        stream: true,
      },
      { signal },
    );

    let final: OpenAISDK.Responses.Response | null = null;
    for await (const event of stream) {
      if (event.type === 'response.output_item.added' && event.item.type === 'reasoning') {
        emit('live', 'Thinking …', 'thinking');
      } else if (event.type === 'response.output_item.done' && event.item.type === 'web_search_call') {
        const action = event.item.action;
        if (action.type === 'search') {
          searches++;
          emit('search', clip(action.query ?? action.queries?.join(' · ') ?? ''));
        } else if (action.type === 'open_page') {
          fetches++;
          emit('fetch', clip(action.url ?? ''));
        } else {
          emit('note', clip(`„${action.pattern}“ · ${action.url}`));
        }
      } else if (event.type === 'response.output_text.delta') {
        wrote(event.delta.length);
      } else if (event.type === 'response.completed' || event.type === 'response.incomplete') {
        final = event.response;
      } else if (event.type === 'response.failed') {
        throw new Error(event.response.error?.message ?? 'OpenAI: response failed');
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }

    if (!final) throw message('errNoDataset', { name: 'GPT' });
    if (final.status === 'incomplete') {
      throw final.incomplete_details?.reason === 'max_output_tokens'
        ? message('errTruncated')
        : message('errRefusal', { name: 'GPT' });
    }
    const content = final.output.flatMap((item) => (item.type === 'message' ? item.content : []));
    if (content.some((part) => part.type === 'refusal')) throw message('errRefusal', { name: 'GPT' });
    const text = content.map((part) => (part.type === 'output_text' ? part.text : '')).join('');
    if (!text.trim()) throw message('errNoDataset', { name: 'GPT' });

    emit('status', 'Checking the dataset …', 'checking');
    const dataset = parseDataset(JSON.parse(text));
    const u = final.usage;
    const cached = u?.input_tokens_details.cached_tokens ?? 0;
    const costUsd = u
      ? ((u.input_tokens - cached) * inPrice + cached * cachedPrice + u.output_tokens * outPrice) / 1e6 +
        searches * SEARCH_USD
      : null;
    emit('status', 'Done', 'done', {
      series: dataset.series.length,
      points: dataset.timeline.length,
      events: dataset.events.length,
    });
    return {
      dataset,
      meta: { model: final.model, durationMs: Date.now() - started, searches, fetches, costUsd },
    };
  } catch (err) {
    if (err instanceof OpenAI.APIConnectionError) {
      throw message('errNoAnswer', { vendor: 'OpenAI' });
    }
    throw explainApiError(err, OpenAI, 'OpenAI', model);
  }
}
