import type { Dataset, ResearchMeta } from '../../shared/dataset.ts';
import type { MusicSource } from '../audio/soundtrack.ts';
import { defaultDuration } from '../engine/model.ts';
import type { Format } from '../engine/renderer.ts';

export type VideoSettings = {
  format: Format;
  duration: number;
  bars: number;
  fps: 30 | 60;
  sfx: boolean;
  musicSource: MusicSource;
  musicVolume: number;
  sfxVolume: number;
};

export type Project = {
  id: string;
  topic: string;
  createdAt: number;
  updatedAt: number;
  dataset: Dataset;
  settings: VideoSettings;
  research: ResearchMeta | null;
  /** display names of stored audio files, keyed by source */
  audio: { ai: string | null; upload: string | null };
};

export function newProject(topic: string, dataset: Dataset, research: ResearchMeta | null, bars: number): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    topic,
    createdAt: now,
    updatedAt: now,
    dataset,
    research,
    audio: { ai: null, upload: null },
    settings: {
      format: 'landscape',
      duration: defaultDuration(dataset),
      bars: Math.min(bars, dataset.series.length),
      fps: 30,
      sfx: true,
      musicSource: 'composition',
      musicVolume: 0.85,
      sfxVolume: 0.7,
    },
  };
}

const TRANSLIT: Record<string, string> = { ß: 'ss', ä: 'ae', ö: 'oe', ü: 'ue' };
export const fileSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ßäöü]/g, (c) => TRANSLIT[c])
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'statrace';
