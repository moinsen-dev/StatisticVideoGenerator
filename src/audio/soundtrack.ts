import type { MusicSpec } from '../../shared/dataset.ts';
import type { RaceModel } from '../engine/model.ts';
import { renderComposition, SAMPLE_RATE, type AudioPlan } from './composer.ts';
import { renderSfx } from './sfx.ts';

export type MusicSource = 'composition' | 'ai' | 'upload' | 'none';

export function audioPlan(model: RaceModel): AudioPlan {
  return {
    duration: model.duration,
    intro: model.intro,
    race: model.race,
    cards: model.cards.map((c) => Math.round(c.time * 1000) / 1000),
    leads: model.leaderChanges.map((l) => Math.round(l.time * 1000) / 1000),
  };
}

const cache = new Map<string, Promise<AudioBuffer>>();
function cached(key: string, make: () => Promise<AudioBuffer>): Promise<AudioBuffer> {
  let hit = cache.get(key);
  if (!hit) {
    hit = make();
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
    if (cache.size > 12) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

export function decodeAudio(blob: Blob, key: string): Promise<AudioBuffer> {
  return cached(`decode:${key}`, async () =>
    new OfflineAudioContext(2, 1, SAMPLE_RATE).decodeAudioData(await blob.arrayBuffer()),
  );
}

/** One buffer for the whole video: music + effects, with the exact video length. */
export async function buildSoundtrack(opts: {
  plan: AudioPlan;
  source: MusicSource;
  spec: MusicSpec;
  file: { blob: Blob; key: string } | null;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
}): Promise<AudioBuffer | null> {
  const { plan } = opts;
  const planKey = JSON.stringify(plan);
  let music: AudioBuffer | null = null;
  if (opts.source === 'composition') {
    music = await cached(`comp:${JSON.stringify(opts.spec)}:${planKey}`, () => renderComposition(opts.spec, plan));
  } else if ((opts.source === 'ai' || opts.source === 'upload') && opts.file) {
    music = await decodeAudio(opts.file.blob, opts.file.key);
  }
  const sfx = opts.sfx ? await cached(`sfx:${planKey}`, () => renderSfx(plan)) : null;
  if (!music && !sfx) return null;

  const ctx = new OfflineAudioContext(2, Math.ceil(plan.duration * SAMPLE_RATE), SAMPLE_RATE);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  limiter.connect(ctx.destination);
  const add = (buffer: AudioBuffer, volume: number, fadeOut: boolean) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, 0);
    if (fadeOut) {
      g.gain.setValueAtTime(volume, Math.max(0, plan.duration - 2.5));
      g.gain.linearRampToValueAtTime(0, plan.duration);
    }
    src.connect(g).connect(limiter);
    src.start(0);
  };
  if (music) add(music, opts.musicVolume, music.duration > plan.duration + 0.05);
  if (sfx) add(sfx, opts.sfxVolume, false);
  return ctx.startRendering();
}
