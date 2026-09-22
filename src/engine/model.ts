import type { Dataset, StoryEvent } from '../../shared/dataset.ts';
import { clamp, lerp, monotoneSpline } from './math.ts';

// The race as a pure function of video time τ (seconds). Everything that depends on history
// (smoothed rank positions, overtakes, leader changes, card timing) is precomputed once, so a
// frame can be drawn for any τ in any order — scrubbing, preview and export see the same thing.

export const INTRO = 3;
export const OUTRO = 5;
const SPS = 60; // precomputed samples per second of race time
const SPRING = 10; // critically damped spring for rank changes (settles in ~0.5 s)
const HYSTERESIS = 0.004; // a bar must lead by 0.4 % before it takes the slot

export type Overtake = { time: number; series: number; rank: number };
export type LeaderChange = { time: number; series: number };
export type Card = { time: number; event: StoryEvent };

export type RaceModel = {
  dataset: Dataset;
  bars: number;
  intro: number;
  race: number;
  outro: number;
  duration: number;
  t0: number;
  t1: number;
  /** series indices ordered by peak value, biggest first */
  importance: number[];
  overtakes: Overtake[];
  leaderChanges: LeaderChange[];
  cards: Card[];
  dataTime(tau: number): number;
  videoTime(t: number): number;
  valueAt(i: number, tau: number): number;
  posAt(i: number, tau: number): number;
  maxAt(tau: number): number;
  totalAt(tau: number): number;
  hasTotal: boolean;
};

export function defaultDuration(ds: Dataset): number {
  const years = ds.timeline[ds.timeline.length - 1] - ds.timeline[0];
  return Math.round(clamp(years * 2.3 + INTRO + OUTRO, 30, 150));
}

/** Leading gaps become 0 (entity appears), trailing gaps hold the last value, inner gaps interpolate. */
function fillGaps(values: (number | null)[]): number[] {
  const out = values.map((v) => (v === null ? Number.NaN : v));
  const first = out.findIndex((v) => !Number.isNaN(v));
  if (first < 0) return out.map(() => 0);
  let last = out.length - 1;
  while (Number.isNaN(out[last])) last--;
  for (let i = 0; i < first; i++) out[i] = 0;
  for (let i = last + 1; i < out.length; i++) out[i] = out[last];
  let prev = first;
  for (let i = first + 1; i <= last; i++) {
    if (Number.isNaN(out[i])) continue;
    for (let j = prev + 1; j < i; j++) out[j] = lerp(out[prev], out[i], (j - prev) / (i - prev));
    prev = i;
  }
  return out;
}

export function buildModel(ds: Dataset, duration: number, barsWanted: number): RaceModel {
  const n = ds.series.length;
  const bars = Math.max(1, Math.min(barsWanted, n));
  const t0 = ds.timeline[0];
  const t1 = ds.timeline[ds.timeline.length - 1];
  const race = Math.max(10, duration - INTRO - OUTRO);
  const total = INTRO + race + OUTRO;
  const splines = ds.series.map((s) => monotoneSpline(ds.timeline, fillGaps(s.values)));
  const totalSpline = ds.total ? monotoneSpline(ds.timeline, fillGaps(ds.total.values)) : null;

  const dataTime = (tau: number) => t0 + clamp((tau - INTRO) / race, 0, 1) * (t1 - t0);
  const videoTime = (t: number) => INTRO + ((t - t0) / (t1 - t0)) * race;

  // --- sample values and ranks
  const S = Math.ceil(race * SPS) + 1;
  const values = splines.map(() => new Float64Array(S));
  const ranks = splines.map(() => new Uint16Array(S));
  const top = new Uint16Array(S);
  const maxv = new Float64Array(S);
  const order = [...Array(n).keys()];
  const prevRank = new Uint16Array(n).map((_, i) => i);
  for (let s = 0; s < S; s++) {
    const t = t0 + (s / (S - 1)) * (t1 - t0);
    for (let i = 0; i < n; i++) values[i][s] = Math.max(0, splines[i](t));
    order.sort((a, b) => values[b][s] - values[a][s] || prevRank[a] - prevRank[b]);
    // Hysteresis: near-ties keep their previous order, otherwise two almost equal bars
    // swap back and forth and end up drawn on top of each other.
    for (let k = 0; k < n - 1; k++) {
      const a = order[k];
      const b = order[k + 1];
      const close = values[a][s] - values[b][s] <= HYSTERESIS * values[a][s];
      if (close && prevRank[b] < prevRank[a]) {
        order[k] = b;
        order[k + 1] = a;
      }
    }
    for (let r = 0; r < n; r++) ranks[order[r]][s] = r;
    for (let r = 0; r < n; r++) prevRank[order[r]] = r;
    top[s] = order[0];
    maxv[s] = values[order[0]][s];
  }

  // --- smoothed positions: bars glide to their new slot instead of jumping
  const offscreen = bars + 0.6;
  const pos = values.map((vals, i) => {
    const p = new Float32Array(S);
    const target = (s: number) => (vals[s] > 0 ? Math.min(ranks[i][s], offscreen) : offscreen);
    let x = target(0);
    let v = 0;
    const dt = 1 / SPS / 4;
    for (let s = 0; s < S; s++) {
      const goal = target(s);
      for (let k = 0; k < 4; k++) {
        v += (SPRING * SPRING * (goal - x) - 2 * SPRING * v) * dt;
        x += v * dt;
      }
      p[s] = x;
    }
    return p;
  });

  // --- overtakes (for sparks) — ignore early noise and near-zero shuffles
  const overtakes: Overtake[] = [];
  const lastFor = new Float64Array(n).fill(-1e9);
  let lastAny = -1e9;
  for (let s = 1; s < S; s++) {
    const time = INTRO + s / SPS;
    if (s / SPS < 0.6) continue;
    for (let i = 0; i < n; i++) {
      const r = ranks[i][s];
      if (r >= ranks[i][s - 1] || r >= bars) continue;
      if (values[i][s] < 0.03 * maxv[s]) continue;
      if (time - lastFor[i] < 0.9 || (time - lastAny < 0.22 && r > 0)) continue;
      overtakes.push({ time, series: i, rank: r });
      lastFor[i] = time;
      lastAny = time;
    }
  }

  // --- leader changes (must hold the lead for 0.6 s to count)
  const leaderChanges: LeaderChange[] = [];
  let leader = top[0];
  let candidate = -1;
  let since = 0;
  for (let s = 0; s < S; s++) {
    if (top[s] === leader) {
      candidate = -1;
      continue;
    }
    if (top[s] !== candidate) {
      candidate = top[s];
      since = s;
    } else if ((s - since) / SPS >= 0.6) {
      leaderChanges.push({ time: INTRO + since / SPS, series: candidate });
      leader = candidate;
      candidate = -1;
    }
  }

  // --- fun-fact cards: at their moment on the timeline, but at least 1.6 s apart
  const GAP = 1.6;
  const first = INTRO + 0.4;
  const lastSlot = INTRO + race - 0.4;
  const events = ds.events.filter((e) => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const times = events.map((e) => clamp(videoTime(e.t), first, lastSlot));
  for (let k = 1; k < times.length; k++) times[k] = Math.max(times[k], times[k - 1] + GAP);
  if (times.length && times[times.length - 1] > lastSlot) {
    times[times.length - 1] = lastSlot;
    for (let k = times.length - 2; k >= 0; k--) times[k] = Math.min(times[k], times[k + 1] - GAP);
    for (let k = 0; k < times.length; k++) times[k] = Math.max(times[k], k ? times[k - 1] + 0.8 : first);
  }
  const cards = events.map((event, k) => ({ time: times[k], event }));

  const peak = values.map((v) => v.reduce((a, b) => Math.max(a, b), 0));
  const importance = [...Array(n).keys()].sort((a, b) => peak[b] - peak[a]);

  const sampleAt = (tau: number) => clamp((tau - INTRO) * SPS, 0, S - 1);

  return {
    dataset: ds,
    bars,
    intro: INTRO,
    race,
    outro: OUTRO,
    duration: total,
    t0,
    t1,
    importance,
    overtakes,
    leaderChanges,
    cards,
    dataTime,
    videoTime,
    valueAt: (i, tau) => Math.max(0, splines[i](dataTime(tau))),
    posAt: (i, tau) => {
      const f = sampleAt(tau);
      const a = Math.floor(f);
      const b = Math.min(S - 1, a + 1);
      return lerp(pos[i][a], pos[i][b], f - a);
    },
    maxAt: (tau) => {
      const t = dataTime(tau);
      let m = 0;
      for (const sp of splines) m = Math.max(m, sp(t));
      return m;
    },
    totalAt: (tau) => (totalSpline ? Math.max(0, totalSpline(dataTime(tau))) : 0),
    hasTotal: totalSpline !== null,
  };
}
