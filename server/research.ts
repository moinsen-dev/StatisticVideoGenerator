import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  datasetJsonSchema,
  parseDataset,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
  type ServerStatus,
} from '../shared/dataset.ts';
import { systemPrompt, userPrompt } from './prompt.ts';

// Research runs through the locally installed, signed-in Claude Code CLI (the user's own
// subscription): `claude -p` with only WebSearch/WebFetch enabled, structured output via
// --json-schema, progress read from the stream-json event log.

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
const TIMEOUT_MS = 12 * 60_000;

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

function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; error: string | null }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15_000 }, (err, stdout) =>
      resolve({ ok: !err, stdout: String(stdout ?? ''), error: err ? err.message : null }),
    );
  });
}

let statusCache: { at: number; value: ServerStatus['claude'] } | null = null;

export async function claudeStatus(): Promise<ServerStatus['claude']> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const [auth, version] = await Promise.all([run(CLAUDE_BIN, ['auth', 'status']), run(CLAUDE_BIN, ['--version'])]);
  let value: ServerStatus['claude'];
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

const clip = (s: string, n = 180) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export async function runResearch(
  req: ResearchRequest,
  opts: { signal: AbortSignal; onProgress: (p: ResearchProgress) => void },
): Promise<ResearchResult> {
  const model =
    req.depth === 'thorough' ? (process.env.RESEARCH_MODEL_THOROUGH ?? 'opus') : (process.env.RESEARCH_MODEL_FAST ?? 'sonnet');
  const started = Date.now();
  const emit = (kind: ResearchProgress['kind'], text: string) => opts.onProgress({ kind, text, at: Date.now() - started });

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

  emit('status', `Claude (${model}) startet die Recherche …`);
  const child = spawn(CLAUDE_BIN, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const kill = () => child.kill('SIGTERM');
  opts.signal.addEventListener('abort', kill, { once: true });
  const timer = setTimeout(kill, TIMEOUT_MS);

  let stderr = '';
  let spawnError: Error | null = null;
  child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));
  const exited = new Promise<number | null>((resolve) => {
    child.on('error', (err) => {
      spawnError = err;
      resolve(null);
    });
    child.on('close', resolve);
  });
  child.stdin.end(userPrompt(req));

  let searches = 0;
  let fetches = 0;
  let resolvedModel = model;
  let final: StreamEvent | null = null;
  // Live counters from partial messages: the dataset is written for minutes, show that it moves.
  let block = '';
  let written = 0;
  let thought = 0;
  let lastLive = 0;
  const live = () => {
    const now = Date.now();
    if (now - lastLive < 1200) return;
    lastLive = now;
    const n = (v: number) => v.toLocaleString('de-DE');
    emit('live', block === 'StructuredOutput' ? `Schreibt den Datensatz … ${n(written)} Zeichen` : `Denkt nach … ${n(thought)} Zeichen`);
  };

  try {
    for await (const line of createInterface({ input: child.stdout })) {
      if (!line.trim()) continue;
      let ev: StreamEvent;
      try {
        ev = JSON.parse(line) as StreamEvent;
      } catch {
        continue;
      }
      if (ev.type === 'system' && ev.subtype === 'init' && ev.model) resolvedModel = ev.model;
      else if (ev.type === 'result') final = ev;
      else if (ev.type === 'stream_event' && ev.event) {
        const e = ev.event;
        if (e.type === 'content_block_start') block = e.content_block?.name ?? e.content_block?.type ?? '';
        else if (e.type === 'content_block_delta' && e.delta) {
          if (e.delta.partial_json && block === 'StructuredOutput') written += e.delta.partial_json.length;
          else if (e.delta.thinking) thought += e.delta.thinking.length;
          else continue;
          live();
        }
      }
      else if (ev.type === 'assistant') {
        for (const block of ev.message?.content ?? []) {
          if (block.type === 'tool_use' && block.name === 'WebSearch') {
            searches++;
            emit('search', clip(String(block.input?.query ?? '')));
          } else if (block.type === 'tool_use' && block.name === 'WebFetch') {
            fetches++;
            emit('fetch', clip(String(block.input?.url ?? '')));
          } else if (block.type === 'tool_use' && block.name === 'StructuredOutput') {
            emit('status', 'Datensatz wird zusammengesetzt …');
          } else if (block.type === 'text' && block.text?.trim()) {
            emit('note', clip(block.text));
          }
        }
      }
    }
    const code = await exited;
    if (opts.signal.aborted) throw new Error('Recherche abgebrochen.');
    if (spawnError) throw new Error(`claude CLI nicht startbar: ${(spawnError as Error).message}`);
    if (!final) throw new Error(`claude CLI beendet (Code ${code}) ohne Ergebnis. ${stderr.trim()}`.trim());
    if (final.is_error || final.subtype !== 'success') {
      throw new Error(`Claude meldet einen Fehler: ${clip(final.result ?? final.subtype ?? 'unbekannt', 400)}`);
    }
    const dataset = parseDataset(final.structured_output ?? JSON.parse(final.result ?? 'null'));
    emit(
      'status',
      `Fertig: ${dataset.series.length} Reihen · ${dataset.timeline.length} Zeitpunkte · ${dataset.events.length} Ereignisse`,
    );
    return {
      dataset,
      meta: { model: resolvedModel, durationMs: Date.now() - started, searches, fetches, costUsd: final.total_cost_usd ?? null },
    };
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener('abort', kill);
    if (child.exitCode === null) child.kill('SIGTERM');
    await rm(cwd, { recursive: true, force: true });
  }
}
