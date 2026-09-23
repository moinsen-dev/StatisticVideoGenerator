import { ELEVENLABS_MUSIC_URL, musicRequestBody } from '../shared/elevenlabs.ts';

// Optional AI music generator on the local server: ElevenLabs Music with the key from .env.

export class HttpError extends Error {
  readonly status: 400 | 502;
  constructor(message: string, status: 400 | 502) {
    super(message);
    this.status = status;
  }
}

export async function composeMusic(prompt: string, durationMs: number): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new HttpError('Kein ELEVENLABS_API_KEY in .env gesetzt.', 400);
  const res = await fetch(ELEVENLABS_MUSIC_URL, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: musicRequestBody(prompt, durationMs, process.env.ELEVENLABS_MUSIC_MODEL),
  });
  if (!res.ok) throw new HttpError(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`, 502);
  return res;
}
