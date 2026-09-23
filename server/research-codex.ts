import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseDataset,
  strictDatasetJsonSchema,
  type CliStatus,
  type ResearchProgress,
  type ResearchRequest,
  type ResearchResult,
} from '../shared/dataset.ts';
import { systemPrompt, userPrompt } from '../shared/prompt.ts';
import { clip, progressEmitter, run, streamLines } from './cli.ts';

// Research through the locally installed, signed-in Codex CLI (the user's own ChatGPT plan):
// `codex --search exec` with live web search, structured output via --output-schema, progress
// read from the JSONL event log. --ignore-user-config/--ignore-rules keep the user's MCP servers,
// profiles and AGENTS.md out; the sandbox is read-only in an empty directory.

const CODEX_BIN = process.env.CODEX_BIN ?? 'codex';
const MODELS = { fast: 'gpt-6-sol', thorough: 'gpt-6-astra' } as const;

type CodexEvent = {
  type: string;
  message?: string;
  error?: { message?: string };
  item?: {
    type: string;
    text?: string;
    query?: string;
    action?: { type: string; query?: string; queries?: string[]; url?: string | null };
  };
};

let statusCache: { at: number; value: CliStatus } | null = null;

export async function codexStatus(): Promise<CliStatus> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const [login, version] = await Promise.all([run(CODEX_BIN, ['login', 'status']), run(CODEX_BIN, ['--version'])]);
  const out = `${login.stdout}\n${login.stderr}`;
  const value: CliStatus = version.ok
    ? {
        available: true,
        loggedIn: login.ok && /logged in/i.test(out),
        subscription: /chatgpt/i.test(out) ? 'ChatGPT' : /api key/i.test(out) ? 'API key' : null,
        version: version.stdout.trim().split(' ').pop() || null,
        error: null,
      }
    : { available: false, loggedIn: false, subscription: null, version: null, error: version.error ?? 'codex CLI nicht gefunden' };
  statusCache = { at: Date.now(), value };
  return value;
}

export async function runCodexResearch(
  req: ResearchRequest,
  opts: { signal: AbortSignal; onProgress: (p: ResearchProgress) => void },
): Promise<ResearchResult> {
  const model = MODELS[req.depth];
  const { emit, started } = progressEmitter(opts.onProgress);
  const dir = await mkdtemp(join(tmpdir(), 'statrace-codex-'));
  const cwd = join(dir, 'work');
  const schemaFile = join(dir, 'schema.json');
  const outFile = join(dir, 'dataset.json');
  await mkdir(cwd);
  await writeFile(schemaFile, JSON.stringify(strictDatasetJsonSchema()));

  const args = [
    '--search',
    'exec', '-',
    '--json',
    '-o', outFile,
    '--output-schema', schemaFile,
    '-m', model,
    '-c', 'model_reasoning_effort="medium"',
    '--ignore-user-config',
    '--ignore-rules',
    '-C', cwd,
    '-s', 'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
  ];

  emit('status', `Codex (${model}) startet die Recherche …`, 'start', { model });
  let searches = 0;
  let fetches = 0;
  let failure: string | null = null;

  const onLine = (line: string) => {
    let ev: CodexEvent;
    try {
      ev = JSON.parse(line) as CodexEvent;
    } catch {
      return;
    }
    if (ev.type === 'turn.failed') failure = ev.error?.message ?? 'turn failed';
    else if (ev.type === 'error') failure = ev.message ?? 'error';
    else if (ev.type === 'item.completed' && ev.item?.type === 'web_search') {
      const action = ev.item.action;
      if (action?.type === 'search') {
        searches++;
        emit('search', clip(ev.item.query || action.queries?.join(' · ') || action.query || ''));
      } else if (action?.type === 'open_page' && action.url) {
        fetches++;
        emit('fetch', clip(action.url));
      }
    } else if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
      // Commentary while it works; the final message is the dataset itself.
      const text = ev.item.text?.trim() ?? '';
      if (text.startsWith('{')) emit('status', 'Datensatz wird geprüft …', 'checking');
      else if (text) emit('note', clip(text));
    }
  };

  try {
    const { code, stderr } = await streamLines(CODEX_BIN, args, {
      cwd,
      stdin: `${systemPrompt(req)}\n\n${userPrompt(req)}`,
      signal: opts.signal,
      onLine,
    });
    const text = await readFile(outFile, 'utf8').catch(() => '');
    if (!text.trim()) {
      throw new Error(`codex CLI beendet (Code ${code}) ohne Ergebnis. ${failure ?? stderr.trim()}`.trim());
    }
    const dataset = parseDataset(JSON.parse(text));
    emit('status', 'Fertig', 'done', {
      series: dataset.series.length,
      points: dataset.timeline.length,
      events: dataset.events.length,
    });
    return { dataset, meta: { model, durationMs: Date.now() - started, searches, fetches, costUsd: null } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
