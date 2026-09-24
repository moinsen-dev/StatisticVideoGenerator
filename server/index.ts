import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { parseDataset, ResearchRequestSchema, type ServerStatus } from '../shared/dataset.ts';
import { composeMusic, HttpError } from './elevenlabs.ts';
import { claudeStatus, runResearch } from './research.ts';
import { codexStatus, runCodexResearch } from './research-codex.ts';
import { galleryApi } from './gallery.ts';
import { sqliteSql } from './gallery-sqlite.ts';
import { consoleMailer } from './mail.ts';
import { reviewWithClaude, reviewWithCodex } from './review-cli.ts';

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

const app = new Hono();

app.get('/api/status', async (c) => {
  const [claude, codex] = await Promise.all([claudeStatus(), codexStatus()]);
  return c.json({ claude, codex, elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY) } satisfies ServerStatus);
});

// Which signed-in CLI researches: Claude Code (default) or Codex.
const CliResearchRequest = ResearchRequestSchema.extend({ cli: z.enum(['claude', 'codex']).default('claude') });

app.post('/api/research', async (c) => {
  const parsed = CliResearchRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Ungültige Anfrage.' }, 400);
  const { cli, ...request } = parsed.data;
  const research = cli === 'codex' ? runCodexResearch : runResearch;
  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    const ping = setInterval(() => void stream.writeSSE({ event: 'ping', data: '{}' }), 10_000);
    try {
      const result = await research(request, {
        signal: ac.signal,
        onProgress: (p) => void stream.writeSSE({ event: 'progress', data: JSON.stringify(p) }),
      });
      await stream.writeSSE({ event: 'result', data: JSON.stringify(result) });
    } catch (err) {
      await stream.writeSSE({ event: 'failure', data: JSON.stringify({ message: (err as Error).message }) });
    } finally {
      clearInterval(ping);
    }
  });
});

// Gallery review with a local CLI (providers claude-code and codex): the submitter's own AI, like a
// key or a local model in the browser (src/lib/review.ts).
const ReviewRequest = z.object({ cli: z.enum(['claude', 'codex']), topic: z.string().trim().min(3).max(600), dataset: z.unknown() });

app.post('/api/review', async (c) => {
  const parsed = ReviewRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Ungültige Anfrage.' }, 400);
  try {
    const input = { dataset: parseDataset(parsed.data.dataset), topic: parsed.data.topic };
    return c.json(await (parsed.data.cli === 'codex' ? reviewWithCodex : reviewWithClaude)(input));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 502);
  }
});

// Public gallery, locally in a SQLite file. The server only listens on 127.0.0.1, so without an
// ADMIN_TOKEN in .env the oversight page accepts the token "local". Mails only go to the console,
// whatever keys the environment holds; the hosted gallery (functions/) sends them through Resend.
const gallery = {
  sql: sqliteSql('.data/gallery.sqlite'),
  mail: consoleMailer,
  adminToken: process.env.ADMIN_TOKEN ?? 'local',
  salt: process.env.RATE_SALT ?? 'local',
};
app.route('/', galleryApi(() => gallery));

const MusicRequest = z.object({
  prompt: z.string().trim().min(3).max(2000),
  durationMs: z.number().int().min(3_000).max(600_000),
});

app.post('/api/music', async (c) => {
  const parsed = MusicRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Ungültige Anfrage.' }, 400);
  try {
    const upstream = await composeMusic(parsed.data.prompt, parsed.data.durationMs);
    return new Response(upstream.body, {
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg' },
    });
  } catch (err) {
    return c.json({ message: (err as Error).message }, err instanceof HttpError ? err.status : 500);
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

const port = Number(process.env.API_PORT ?? 8790);
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) =>
  console.log(`StatRace API → http://127.0.0.1:${info.port}`),
);
