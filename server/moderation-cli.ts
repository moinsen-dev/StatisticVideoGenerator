import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { streamLines } from './cli.ts';
import { REVIEW_SYSTEM, reviewPrompt, VerdictSchema, type Moderator } from './moderation.ts';

// Local server without an API key: the signed-in claude CLI reviews gallery entries, for the owner's own
// testing only (subscription use). Same prompt and verdict schema as the hosted review.

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';

function verdictJsonSchema(): string {
  const schema = z.toJSONSchema(VerdictSchema) as Record<string, unknown>;
  delete schema.$schema;
  return JSON.stringify(schema);
}

export function claudeCliModerator(): Moderator {
  return async (input) => {
    const cwd = await mkdtemp(join(tmpdir(), 'statrace-review-'));
    const args = [
      '-p',
      '--output-format', 'json',
      '--json-schema', verdictJsonSchema(),
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
        signal: AbortSignal.timeout(120_000),
        onLine: (line) => (output += line),
      });
      const result = JSON.parse(output) as { structured_output?: unknown; is_error?: boolean; result?: string };
      if (result.is_error) throw new Error(result.result ?? 'claude CLI review failed');
      return VerdictSchema.parse(result.structured_output);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  };
}
