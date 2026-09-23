import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ResearchProgress } from '../shared/dataset.ts';

// Helpers for running the coding CLIs (claude, codex) as research subprocesses.

const TIMEOUT_MS = 12 * 60_000;

export function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; error: string | null }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15_000 }, (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), error: err ? err.message : null }),
    );
  });
}

export const clip = (s: string, n = 180) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export type Emit = (
  kind: ResearchProgress['kind'],
  text: string,
  code?: ResearchProgress['code'],
  vars?: ResearchProgress['vars'],
) => void;

export function progressEmitter(onProgress: (p: ResearchProgress) => void): { emit: Emit; started: number } {
  const started = Date.now();
  const emit: Emit = (kind, text, code, vars) =>
    onProgress({ kind, text, at: Date.now() - started, ...(code ? { code, vars } : {}) });
  return { emit, started };
}

/** Runs a CLI with the prompt on stdin and hands every stdout line to onLine; kills it on abort or timeout. */
export async function streamLines(
  bin: string,
  args: string[],
  opts: { cwd: string; stdin: string; signal: AbortSignal; onLine: (line: string) => void },
): Promise<{ code: number | null; stderr: string }> {
  const child = spawn(bin, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
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
  child.stdin.end(opts.stdin);

  try {
    for await (const line of createInterface({ input: child.stdout })) {
      if (line.trim()) opts.onLine(line);
    }
    const code = await exited;
    if (opts.signal.aborted) throw new Error('Recherche abgebrochen.');
    if (spawnError) throw new Error(`${bin} CLI nicht startbar: ${(spawnError as Error).message}`);
    return { code, stderr };
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener('abort', kill);
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}
