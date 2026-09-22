import type { ResearchProgress, ResearchRequest, ResearchResult, ServerStatus } from '../../shared/dataset.ts';

export async function getStatus(): Promise<ServerStatus> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error(`Server antwortet nicht (${res.status})`);
  return res.json();
}

/** POST + server-sent events: progress while Claude researches, then the dataset. */
export async function research(
  req: ResearchRequest,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Server-Fehler ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trimStart();
      }
      if (event === 'progress') onProgress(JSON.parse(data));
      else if (event === 'result') return JSON.parse(data);
      else if (event === 'failure') throw new Error(JSON.parse(data).message);
    }
  }
  throw new Error('Die Verbindung wurde ohne Ergebnis beendet.');
}

export async function generateMusic(prompt: string, durationMs: number, signal: AbortSignal): Promise<Blob> {
  const res = await fetch('/api/music', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, durationMs: Math.round(durationMs) }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Musik-Generator: Fehler ${res.status}`);
  }
  return res.blob();
}
