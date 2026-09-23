import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ResearchRequestSchema, type ServerStatus } from '../shared/dataset.ts';
import { composeMusic, HttpError } from './elevenlabs.ts';
import { claudeStatus, runResearch } from './research.ts';
import { codexStatus, runCodexResearch } from './research-codex.ts';

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
