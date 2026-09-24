import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsonSchema, strictJsonSchema } from '../shared/dataset.ts';
import { REVIEW_SYSTEM, reviewPrompt, VerdictSchema, type ReviewInput, type Verdict } from '../shared/review.ts';
import { streamLines } from './cli.ts';

// Gallery review through the signed-in claude or codex CLI of the local server: the reviewing AI for
// the providers claude-code and codex, on the user's own subscription and for their own use only.
// Same prompt and verdict schema as the reviews in the browser (src/lib/review.ts); no tools.

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
const CODEX_BIN = process.env.CODEX_BIN ?? 'codex';
const TIMEOUT_MS = 180_000;

export type CliReview = { verdict: Verdict; model: string };

export async function reviewWithClaude(input: ReviewInput): Promise<CliReview> {
  const cwd = await mkdtemp(join(tmpdir(), 'statrace-review-'));
  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(jsonSchema(VerdictSchema)),
    '--model', 'sonnet',
    '--system-prompt', REVIEW_SYSTEM,
    '--tools', '',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--no-session-persistence',
  ];
  let output = '';
  try {
    await streamLines(CLAUDE_BIN, args, {
      cwd,
      stdin: reviewPrompt(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      onLine: (line) => (output += line),
    });
    const result = JSON.parse(output) as { structured_output?: unknown; is_error?: boolean; result?: string };
    if (result.is_error) throw new Error(result.result ?? 'claude CLI review failed');
    return { verdict: VerdictSchema.parse(result.structured_output), model: 'Claude Code · Sonnet' };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

export async function reviewWithCodex(input: ReviewInput): Promise<CliReview> {
  const dir = await mkdtemp(join(tmpdir(), 'statrace-review-'));
  const cwd = join(dir, 'work');
  const schemaFile = join(dir, 'schema.json');
  const outFile = join(dir, 'verdict.json');
  await mkdir(cwd);
  await writeFile(schemaFile, JSON.stringify(strictJsonSchema(VerdictSchema)));
  const args = [
    'exec', '-',
    '--json',
    '-o', outFile,
    '--output-schema', schemaFile,
    '-m', 'gpt-6-sol',
    '-c', 'model_reasoning_effort="low"',
    '--ignore-user-config',
    '--ignore-rules',
    '-C', cwd,
    '-s', 'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
  ];
  try {
    await streamLines(CODEX_BIN, args, {
      cwd,
      stdin: `${REVIEW_SYSTEM}\n\n${reviewPrompt(input)}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      onLine: () => undefined,
    });
    const text = await readFile(outFile, 'utf8').catch(() => '');
    if (!text.trim()) throw new Error('codex CLI review returned no verdict');
    return { verdict: VerdictSchema.parse(JSON.parse(text)), model: 'Codex · GPT-6 Sol' };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
