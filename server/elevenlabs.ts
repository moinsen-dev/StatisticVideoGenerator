// Optional AI music generator: ElevenLabs Music (paid plan). Instrumental track with the exact video length.

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
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      music_length_ms: Math.round(Math.min(300_000, Math.max(3_000, durationMs))),
      model_id: process.env.ELEVENLABS_MUSIC_MODEL ?? 'music_v2_5',
      force_instrumental: true,
    }),
  });
  if (!res.ok) throw new HttpError(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`, 502);
  return res;
}
