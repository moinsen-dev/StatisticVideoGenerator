import type OpenAISDK from 'openai';
import {
  parseDataset,
  strictDatasetJsonSchema,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
} from '../../shared/dataset.ts';
import { systemPrompt, userPrompt } from '../../shared/prompt.ts';
import { apiBase, type LocalConfig } from './local-model.ts';
import { OPEN_DATA_TOOLS, runOpenDataTool, type DataTable, type Source, type ToolResult } from './open-data.ts';
import { clip, explainApiError, message, progressEmitter, writingMeter } from './research-common.ts';

// Research with a local model (Ollama, LM Studio or any OpenAI-compatible server), no key.
// Local models have no web search, so they research open data through tools that run in this
// browser (open-data.ts). A second call then writes the dataset under the strict JSON schema.

type Chat = OpenAISDK.Chat.ChatCompletionMessageParam;
type Reply = { content: string; calls: { id: string; name: string; args: string }[]; finish: string | null };

const ROUNDS = { fast: 3, thorough: 6 } as const;
// Everything the tools return stays in the prompt; a laptop processes it at ~100 tokens/s and Ollama
// loads models with a 32k context. Past this many characters the research stops.
const BUDGET = 24_000;
// Thinking models deliberate for minutes per step on a laptop (measured: Qwen 3.8 27B thought 2.5 min
// just to pick its next tool). "Fast" switches thinking off; "thorough" leaves the model's default.
const REASONING = { fast: { reasoning_effort: 'none' as const }, thorough: {} } as const;
const KNOWLEDGE_NOTE = {
  de: 'Nicht recherchiert: Die Werte stammen aus dem Trainingswissen des Modells und sind ungeprüft.',
  en: 'Not researched: the values come from the model’s training knowledge and are unverified.',
};

/** Streams one chat completion; reports thinking and written characters while it runs. */
async function complete(
  client: OpenAISDK,
  body: Omit<OpenAISDK.Chat.ChatCompletionCreateParamsStreaming, 'stream'>,
  signal: AbortSignal,
  on: { thinking: () => void; writing?: (chars: number) => void },
): Promise<Reply> {
  const stream = await client.chat.completions.create({ ...body, stream: true }, { signal });
  const reply: Reply = { content: '', calls: [], finish: null };
  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;
    // Ollama streams thinking as `reasoning`, other servers as `reasoning_content`.
    const delta = choice.delta as typeof choice.delta & { reasoning?: string; reasoning_content?: string };
    if (delta.reasoning || delta.reasoning_content) on.thinking();
    if (delta.content) {
      reply.content += delta.content;
      on.writing?.(delta.content.length);
    }
    for (const call of delta.tool_calls ?? []) {
      const slot = (reply.calls[call.index] ??= { id: '', name: '', args: '' });
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.name += call.function.name;
      if (call.function?.arguments) slot.args += call.function.arguments;
    }
    if (choice.finish_reason) reply.finish = choice.finish_reason;
  }
  reply.calls = reply.calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  return reply;
}

type SchemaNode = { type?: string; properties: Record<string, unknown>; required: string[]; anyOf?: SchemaNode[]; items: SchemaNode };

/** The dataset schema plus a `data` reference per series and for the total: table + entity from owid_chart. */
function referencingSchema(): Record<string, unknown> {
  const schema = strictDatasetJsonSchema() as unknown as SchemaNode;
  const ref = {
    description: 'owid_chart table and entity: the app fills the yearly values; null when you write the values yourself',
    anyOf: [
      {
        type: 'object',
        properties: { table: { type: 'string' }, entity: { type: 'string' } },
        required: ['table', 'entity'],
        additionalProperties: false,
      },
      { type: 'null' },
    ],
  };
  const withRef = (node: SchemaNode | undefined) => {
    if (!node) return;
    node.properties.data = ref;
    node.required.push('data');
  };
  withRef((schema.properties.series as SchemaNode).items);
  withRef((schema.properties.total as SchemaNode).anyOf?.find((branch) => branch.type === 'object'));
  return schema as unknown as Record<string, unknown>;
}

type RawSeries = { values?: unknown; data?: { table?: string; entity?: string } | null };
const loose = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Every series that references a fetched table gets that table's exact values for the timeline. */
function fillFromTables(raw: { timeline?: unknown; series?: RawSeries[]; total?: RawSeries | null }, tables: Map<string, DataTable>) {
  const timeline = Array.isArray(raw.timeline) ? raw.timeline.map(Number) : [];
  const fill = (target: RawSeries | null | undefined) => {
    const table = tables.get(target?.data?.table ?? '');
    const entity = target?.data?.entity ?? '';
    if (!target || !table || !entity) return;
    const row = table.rows.get(entity) ?? [...table.rows].find(([name]) => loose(name) === loose(entity))?.[1];
    if (row) target.values = timeline.map((year) => row.get(year) ?? null);
  };
  raw.series?.forEach(fill);
  fill(raw.total);
}

const parseArgs = (json: string): Record<string, unknown> => {
  try {
    const value = JSON.parse(json || '{}') as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export async function researchWithLocalModel(
  req: ResearchRequest,
  config: LocalConfig,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  const { default: OpenAI } = await import('openai');
  // Local generation is slow: allow long requests, and never retry a half-written answer.
  const client = new OpenAI({ baseURL: apiBase(config.url), apiKey: 'local', dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 30 * 60_000 });
  const model = config.model;
  const { emit, started } = progressEmitter(onProgress);
  let lastThought = 0;
  const thinking = () => {
    if (Date.now() - lastThought < 1200) return;
    lastThought = Date.now();
    emit('live', 'Thinking …', 'thinking');
  };
  const messages: Chat[] = [
    { role: 'system', content: systemPrompt(req, 'schema', 'open-data') },
    { role: 'user', content: userPrompt(req) },
  ];
  const sources: Source[] = [];
  const tables = new Map<string, DataTable>();
  const seen = new Set<string>();
  let searches = 0;
  let fetches = 0;
  let used = 0;
  let tools = true;

  emit('status', `${model} starts researching …`, 'start', { model });
  try {
    // 1. Research: the model calls the open-data tools until it has what it needs.
    for (let round = 0; round < ROUNDS[req.depth] && used < BUDGET; round++) {
      let reply: Reply;
      try {
        reply = await complete(client, { model, messages, tools: OPEN_DATA_TOOLS, ...REASONING[req.depth] }, signal, { thinking });
      } catch (err) {
        // Models without tool support: skip the research, the model writes from its own knowledge.
        if (round === 0 && err instanceof OpenAI.BadRequestError && /tool/i.test(err.message)) {
          tools = false;
          emit('note', message('localNoTools').message);
          break;
        }
        throw err;
      }
      messages.push({
        role: 'assistant',
        content: reply.content,
        ...(reply.calls.length
          ? { tool_calls: reply.calls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.args } })) }
          : {}),
      });
      if (!reply.calls.length) break;
      for (const call of reply.calls) {
        const args = parseArgs(call.args);
        const key = `${call.name}:${JSON.stringify(args)}`;
        // Calls from the last round would only fill the prompt: nothing reads them before the dataset.
        const last = round === ROUNDS[req.depth] - 1;
        if (seen.has(key) || used >= BUDGET || last) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: seen.has(key) ? 'Already read above.' : 'Research budget used up: write the dataset now.' });
          continue;
        }
        seen.add(key);
        if (call.name === 'search') {
          searches++;
          emit('search', clip(String(args.query ?? '')));
        } else {
          fetches++;
          emit('fetch', clip(call.name === 'owid_chart' ? `Our World in Data · ${String(args.slug ?? '')}` : `Wikipedia · ${String(args.title ?? '')}`));
        }
        const result = await runOpenDataTool(call.name, args, signal).catch((err: Error): ToolResult => {
          if (signal.aborted) throw err;
          return { text: `Error: ${err.message}` };
        });
        const source = result.source;
        if (source && !sources.some((s) => s.url === source.url)) sources.push(source);
        if (result.table) tables.set(result.table.id, result.table);
        used += result.text.length;
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.text });
      }
    }

    // 2. Dataset: one call under the strict JSON schema. The tool list stays in the request although no
    // tool may be called: it is part of the rendered prompt, and an unchanged prompt start lets the
    // server reuse its cache instead of reprocessing everything (measured: 29.7k tokens, 5 minutes).
    emit('status', 'Assembling the dataset …', 'assembling');
    messages.push({
      role: 'user',
      content: tools
        ? 'The research is done. Now return the complete dataset as JSON matching the schema. For every series and the total taken from an owid_chart table, set "data" to that table and the entity name as it appears there, and leave "values" empty: the app fills in the exact yearly numbers. Keep the raw unit of the table (e.g. tonnes, not millions) in unitLabel, valueSuffix and subtitle. Write "values" yourself only for numbers from Wikipedia tables, with "data": null.'
        : 'Return the complete dataset as JSON matching the schema.',
    });
    const final = await complete(
      client,
      {
        model,
        messages,
        ...(tools ? { tools: OPEN_DATA_TOOLS } : {}),
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'dataset', schema: tools ? referencingSchema() : strictDatasetJsonSchema(), strict: true },
        },
        ...REASONING[req.depth],
      },
      signal,
      { thinking, writing: writingMeter(emit) },
    );
    if (final.finish === 'length') throw message('errTruncated');
    if (!final.content.trim()) throw message('errNoDataset', { name: model });

    emit('status', 'Checking the dataset …', 'checking');
    const raw = JSON.parse(final.content) as Parameters<typeof fillFromTables>[0];
    fillFromTables(raw, tables);
    const dataset = parseDataset(raw);
    // The pages the tools actually read come first: they are verified sources.
    dataset.sources = [...sources, ...dataset.sources.filter((s) => !sources.some((v) => v.url === s.url))];
    // No page read (no tool support, or the model skipped the research): say where the values come from.
    if (!sources.length) dataset.notes = `${KNOWLEDGE_NOTE[req.language]} ${dataset.notes}`.trim();
    emit('status', 'Done', 'done', {
      series: dataset.series.length,
      points: dataset.timeline.length,
      events: dataset.events.length,
    });
    return { dataset, meta: { model, durationMs: Date.now() - started, searches, fetches, costUsd: null } };
  } catch (err) {
    if (err instanceof OpenAI.APIConnectionError && !signal.aborted) throw message('errLocalConnection', { url: config.url });
    if (err instanceof OpenAI.NotFoundError) throw message('errLocalModel', { model });
    throw explainApiError(err, OpenAI, 'local', model);
  }
}
