import { z } from 'zod';

// One schema for three jobs: the structured-output contract handed to Claude,
// the validation of what comes back, and the validation of hand-edited JSON.

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const MUSIC_STYLES = ['synthwave', 'cinematic', 'house', 'lofi', 'chiptune'] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];

const SeriesSchema = z.object({
  id: z.string().describe('short unique slug, e.g. "china"'),
  name: z.string().describe('display name in the output language, max 18 characters'),
  color: z.string().describe('vivid hex color like "#e63946" matching the entity (flag or brand color)'),
  icon: z.string().describe('exactly one emoji; the flag emoji for countries'),
  values: z
    .array(z.number().nullable())
    .describe(
      'one value per timeline entry, same order and length as `timeline`; raw absolute numbers; null only before the entity existed or before data exists',
    ),
});

const EventSchema = z.object({
  t: z.number().describe('decimal year when it happened, inside the timeline range (2007.45 = mid-June 2007)'),
  icon: z.string().describe('exactly one emoji'),
  title: z.string().describe('punchy headline, max 42 characters'),
  text: z.string().describe('one surprising, concrete sentence with a number or detail, max 120 characters'),
});

const MusicSchema = z.object({
  prompt: z
    .string()
    .describe('English prompt for an AI music generator: instrumental only, genre, mood, instruments, tempo, build-up. No artist names.'),
  style: z.enum(MUSIC_STYLES),
  bpm: z.number().describe('70-150'),
  key: z.enum(KEYS),
  scale: z.enum(['major', 'minor']),
  progression: z.array(z.number()).describe('exactly 4 chord roots as scale degrees 1-7, one chord per bar, e.g. [1,6,3,7]'),
  motif: z
    .array(z.number())
    .describe('exactly 16 eighth-note melody steps (two bars) as scale degrees 1-10, 0 = rest; a catchy, repetitive hook'),
});

const TotalSchema = z
  .object({
    label: z.string().describe('e.g. "Weltweit" / "Worldwide"'),
    icon: z.string().describe('exactly one emoji, e.g. 🌍'),
    values: z.array(z.number().nullable()).describe('one value per timeline entry'),
  })
  .nullable()
  .describe('overall total (e.g. the whole world) when the topic has a meaningful total beyond the listed entities; otherwise null');

export const DatasetSchema = z.object({
  title: z.string().describe('catchy video title, max 48 characters'),
  subtitle: z.string().describe('what exactly is measured and the time range, max 70 characters'),
  language: z.enum(['de', 'en']),
  unitLabel: z.string().describe('what is measured, short, e.g. "Smartphone-Nutzer"'),
  valuePrefix: z.string().describe('e.g. "$" or ""'),
  valueSuffix: z.string().describe('e.g. " t", "%" or ""'),
  decimals: z.number().describe('0-2, decimals for values below one million'),
  compact: z.boolean().describe('true when values reach millions or more, shown as "1,2 Mio." / "1.2M"'),
  timeline: z.array(z.number()).describe('ascending integer years, one per year, e.g. [2000, 2001, ..., 2025]'),
  series: z.array(SeriesSchema),
  total: TotalSchema,
  events: z.array(EventSchema),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  notes: z.string().describe('definitions and caveats: which values are estimated or interpolated'),
  music: MusicSchema,
});

export type Dataset = z.infer<typeof DatasetSchema>;
export type Series = Dataset['series'][number];
export type StoryEvent = Dataset['events'][number];
export type MusicSpec = Dataset['music'];

export function datasetJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(DatasetSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

type Schema = Record<string, unknown>;

/** Strict schemas want anyOf instead of type arrays, and closed objects everywhere. */
function toStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrict);
  if (!node || typeof node !== 'object') return node;
  const src = node as Schema;
  const out: Schema = {};
  for (const [k, v] of Object.entries(src)) out[k] = toStrict(v);
  if (Array.isArray(src.type)) {
    const { type, description, ...rest } = out;
    return {
      ...(description ? { description } : {}),
      anyOf: (type as string[]).map((t) => (t === 'null' ? { type: 'null' } : { ...rest, type: t })),
    };
  }
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as Schema);
  }
  return out;
}

/** The dataset schema in the strict form that strict tools and strict JSON-schema outputs require. */
export function strictDatasetJsonSchema(): Record<string, unknown> {
  return toStrict(datasetJsonSchema()) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Normalisation: models return almost-right data; the renderer needs exactly-right data.

const FALLBACK_COLORS = [
  '#4f8cff', '#ff5d73', '#ffb020', '#2ed3a0', '#a37bff', '#ff7ad9', '#39c5ff', '#f4e04d',
  '#ff8a3d', '#7bd389', '#c792ea', '#5eead4', '#fb7185', '#fbbf24', '#60a5fa', '#a3e635',
];
const DEFAULT_PROGRESSION = [1, 6, 4, 5];
const DEFAULT_MOTIF = [5, 0, 5, 6, 5, 3, 2, 0, 3, 0, 3, 5, 3, 2, 1, 0];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const firstGrapheme = (s: string) => segmenter.segment(s.trim())[Symbol.iterator]().next().value?.segment ?? '';
const validHex = (c: string) => (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(c.trim()) ? c.trim() : null);
const slug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function fitArray(values: number[], length: number, lo: number, hi: number, fallback: number[]): number[] {
  const ints = values.filter(Number.isFinite).map((v) => clamp(Math.round(v), lo, hi));
  return Array.from({ length }, (_, i) => ints[i] ?? fallback[i % fallback.length]);
}

export function normalizeDataset(input: Dataset): Dataset {
  const ds = structuredClone(input);

  const order = ds.timeline
    .map((t, i) => ({ t, i }))
    .filter((o) => Number.isFinite(o.t))
    .sort((a, b) => a.t - b.t)
    .filter((o, k, all) => k === 0 || o.t !== all[k - 1].t);
  if (order.length < 2) throw new Error('Der Datensatz braucht mindestens zwei Zeitpunkte.');
  const pick = (arr: (number | null)[]) =>
    order.map(({ i }) => {
      const v = arr[i];
      return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : null;
    });
  ds.timeline = order.map((o) => o.t);

  const seen = new Set<string>();
  ds.series = ds.series
    .map((s, k) => {
      let id = slug(s.id || s.name) || `s${k}`;
      while (seen.has(id)) id += '-x';
      seen.add(id);
      return {
        id,
        name: s.name.trim().slice(0, 32) || id,
        color: validHex(s.color) ?? FALLBACK_COLORS[k % FALLBACK_COLORS.length],
        icon: firstGrapheme(s.icon),
        values: pick(s.values),
      };
    })
    .filter((s) => s.values.some((v) => v !== null && v > 0));
  if (!ds.series.length) throw new Error('Keine Datenreihe enthält Werte.');

  if (ds.total) {
    const values = pick(ds.total.values);
    ds.total = values.some((v) => v !== null && v > 0)
      ? { label: ds.total.label.trim(), icon: firstGrapheme(ds.total.icon), values }
      : null;
  }

  const t0 = ds.timeline[0];
  const t1 = ds.timeline[ds.timeline.length - 1];
  ds.events = ds.events
    .filter((e) => Number.isFinite(e.t) && e.title.trim())
    .map((e) => ({ t: clamp(e.t, t0, t1), icon: firstGrapheme(e.icon) || '•', title: e.title.trim(), text: e.text.trim() }))
    .sort((a, b) => a.t - b.t);

  // Models occasionally return "\n" or stray whitespace as a unit; keep one leading space at most.
  const unit = (u: string) => u.replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/\s+$/, '');
  ds.valuePrefix = unit(ds.valuePrefix).trimStart();
  ds.valueSuffix = unit(ds.valueSuffix);
  ds.decimals = clamp(Math.round(ds.decimals), 0, 3);
  ds.music = {
    ...ds.music,
    prompt: ds.music.prompt.trim(),
    bpm: clamp(Math.round(ds.music.bpm), 70, 150),
    progression: fitArray(ds.music.progression, 4, 1, 7, DEFAULT_PROGRESSION),
    motif: fitArray(ds.music.motif, 16, 0, 10, DEFAULT_MOTIF),
  };
  return ds;
}

export function parseDataset(json: unknown): Dataset {
  const result = DatasetSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Ungültiger Datensatz: ${issue.path.join('.') || '(root)'} – ${issue.message}`);
  }
  return normalizeDataset(result.data);
}

// ---------------------------------------------------------------------------
// Research API contract (server ⇄ browser)

export const ResearchRequestSchema = z.object({
  topic: z.string().trim().min(3).max(600),
  language: z.enum(['de', 'en']),
  bars: z.number().int().min(5).max(15),
  depth: z.enum(['fast', 'thorough']),
});
export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

/** `live` replaces the previous live line (e.g. a growing character count) instead of adding one. */
export type ResearchProgress = {
  kind: 'status' | 'search' | 'fetch' | 'note' | 'live';
  text: string;
  at: number;
  /** language-neutral status; the UI translates it and falls back to `text` */
  code?: 'start' | 'assembling' | 'checking' | 'writing' | 'thinking' | 'done';
  vars?: Record<string, string | number>;
};

export type ResearchMeta = {
  model: string;
  durationMs: number;
  searches: number;
  fetches: number;
  costUsd: number | null;
};
export type ResearchResult = { dataset: Dataset; meta: ResearchMeta };

export type CliStatus = {
  available: boolean;
  loggedIn: boolean;
  subscription: string | null;
  version: string | null;
  error: string | null;
};

/** Signed-in coding CLIs the local server can research with, on the user's own subscription. */
export type ServerStatus = { claude: CliStatus; codex: CliStatus; elevenlabs: boolean };
