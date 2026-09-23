// ElevenLabs Music request, shared by the local server (key from .env) and the browser (visitor's key).
// Instrumental track with the exact video length; the API accepts 3 s to 5 min.

export const ELEVENLABS_MUSIC_URL = 'https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192';

export function musicRequestBody(prompt: string, durationMs: number, model = 'music_v2_5'): string {
  return JSON.stringify({
    prompt,
    music_length_ms: Math.round(Math.min(300_000, Math.max(3_000, durationMs))),
    model_id: model,
    force_instrumental: true,
  });
}
