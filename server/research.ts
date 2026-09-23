import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  datasetJsonSchema,
  parseDataset,
  type CliStatus,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
} from '../shared/dataset.ts';
import { systemPrompt, userPrompt } from '../shared/prompt.ts';
import { clip, progressEmitter, run, streamLines } from './cli.ts';

// Research runs through the locally installed, signed-in Claude Code CLI (the user's own
// subscription): `claude -p` with only WebSearch/WebFetch enabled, structured output via
// --json-schema, progress read from the stream-json event log.

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';

type Block = { type: string; name?: string; input?: Record<string, unknown>; text?: string };
type StreamEvent = {
  type: string;
  subtype?: string;
  event?: {
    type: string;
    content_block?: Block;
    delta?: { type: string; partial_json?: string; thinking?: string; text?: string };
  };
  model?: string;
  message?: { content?: Block[] };
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
};

let statusCache: { at: number; value: CliStatus } | null = null;

export async function claudeStatus(): Promise<CliStatus> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const [auth, version] = await Promise.all([run(CLAUDE_BIN, ['auth', 'status']), run(CLAUDE_BIN, ['--version'])]);
  let value: CliStatus;
  try {
    const info = JSON.parse(auth.stdout) as { loggedIn?: boolean; subscriptionType?: string };
    value = {
      available: true,
      loggedIn: Boolean(info.loggedIn),
      subscription: info.subscriptionType ?? null,
      version: version.stdout.trim().split(' ')[0] || null,
      error: null,
    };
  } catch {
    value = { available: false, loggedIn: false, subscription: null, version: null, error: auth.error ?? 'claude CLI nicht gefunden' };
  }
  statusCache = { at: Date.now(), value };
  return value;
}

export async function runResearch(
  req: ResearchRequest,
  opts: { signal: AbortSignal; onProgress: (p: ResearchProgress) => void },
): Promise<ResearchResult> {
  const model =
    req.depth === 'thorough' ? (process.env.RESEARCH_MODEL_THOROUGH ?? 'opus') : (process.env.RESEARCH_MODEL_FAST ?? 'sonnet');
  const { emit, started } = progressEmitter(opts.onProgress);

  // Empty working directory: no project files, no CLAUDE.md, nothing to read but the web.
  const cwd = await mkdtemp(join(tmpdir(), 'statrace-research-'));
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--json-schema', JSON.stringify(datasetJsonSchema()),
    '--model', model,
    '--system-prompt', systemPrompt(req),
    '--tools', 'WebSearch', 'WebFetch',
    '--allowedTools', 'WebSearch', 'WebFetch',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--no-session-persistence',
  ];

  emit('status', `Claude (${model}) startet die Recherche …`, 'start', { model });

  let searches = 0;
  let fetches = 0;
  let resolvedModel = model;
  let final: StreamEvent | null = null;
  // Live counters from partial messages: the dataset is written for minutes, show that it moves.
  let block = '';
  let written = 0;
  let lastLive = 0;
  const live = () => {
    const now = Date.now();
    if (now - lastLive < 1200) return;
    lastLive = now;
    const n = (v: number) => v.toLocaleString('de-DE');
    if (block === 'StructuredOutput') emit('live', `Schreibt den Datensatz … ${n(written)} Zeichen`, 'writing', { n: n(written) });
    else emit('live', 'Denkt nach …', 'thinking');
  };

  const onLine = (line: string) => {
    let ev: StreamEvent;
    try {
      ev = JSON.parse(line) as StreamEvent;
    } catch {
      return;
    }
    if (ev.type === 'system' && ev.subtype === 'init' && ev.model) resolvedModel = ev.model;
    else if (ev.type === 'result') final = ev;
    else if (ev.type === 'stream_event' && ev.event) {
      const e = ev.event;
      if (e.type === 'content_block_start') block = e.content_block?.name ?? e.content_block?.type ?? '';
      else if (e.type === 'content_block_delta' && e.delta) {
        if (e.delta.partial_json && block === 'StructuredOutput') written += e.delta.partial_json.length;
        else if (!e.delta.thinking) return;
        live();
      }
    } else if (ev.type === 'assistant') {
      for (const block of ev.message?.content ?? []) {
        if (block.type === 'tool_use' && block.name === 'WebSearch') {
          searches++;
          emit('search', clip(String(block.input?.query ?? '')));
        } else if (block.type === 'tool_use' && block.name === 'WebFetch') {
          fetches++;
          emit('fetch', clip(String(block.input?.url ?? '')));
        } else if (block.type === 'tool_use' && block.name === 'StructuredOutput') {
          emit('status', 'Datensatz wird zusammengesetzt …', 'assembling');
        } else if (block.type === 'text' && block.text?.trim()) {
          emit('note', clip(block.text));
        }
      }
    }
  };

  try {
    const { code, stderr } = await streamLines(CLAUDE_BIN, args, { cwd, stdin: userPrompt(req), signal: opts.signal, onLine });
    const result = final as StreamEvent | null;
    if (!result) throw new Error(`claude CLI beendet (Code ${code}) ohne Ergebnis. ${stderr.trim()}`.trim());
    if (result.is_error || result.subtype !== 'success') {
      throw new Error(`Claude meldet einen Fehler: ${clip(result.result ?? result.subtype ?? 'unbekannt', 400)}`);
    }
    const dataset = parseDataset(result.structured_output ?? JSON.parse(result.result ?? 'null'));
    emit('status', 'Fertig', 'done', {
      series: dataset.series.length,
      points: dataset.timeline.length,
      events: dataset.events.length,
    });
    return {
      dataset,
      meta: { model: resolvedModel, durationMs: Date.now() - started, searches, fetches, costUsd: result.total_cost_usd ?? null },
    };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
