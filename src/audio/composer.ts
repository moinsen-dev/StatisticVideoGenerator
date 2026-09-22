import type { MusicSpec, MusicStyle } from '../../shared/dataset.ts';
import { hashString, mulberry32 } from '../engine/math.ts';

// Renders Claude's soundtrack spec (style, tempo, key, chords, hook) into audio with plain
// Web Audio synthesis, offline and deterministic. The song follows the video's dramaturgy:
// intro pad and riser, the race starts on a bar line, a breakdown past the middle, a final
// section with the hook, and a closing chord when the race ends.

export const SAMPLE_RATE = 48_000;

export type AudioPlan = {
  duration: number;
  intro: number;
  race: number;
  /** video times when a fun-fact card enters */
  cards: number[];
  /** video times of leader changes */
  leads: number[];
};

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

type Pattern = number[];
/** 16 steps: "." silent, "1"-"9" velocity */
const P = (s: string): Pattern => [...s].map((c) => (c === '.' ? 0 : Number(c) / 9));

type Style = {
  pad: OscillatorType;
  padCut: number;
  padGain: number;
  padAttack: number;
  bass: OscillatorType;
  bassCut: number;
  bassPattern: Pattern;
  pluck: OscillatorType;
  pluckRate: 8 | 16;
  pluckGain: number;
  pluckDecay: number;
  lead: OscillatorType;
  leadGain: number;
  kick: Pattern;
  snare: Pattern;
  clap: Pattern;
  hat: Pattern;
  openHat: Pattern;
  kickDecay: number;
  snareVerb: number;
  swing: number;
  reverb: number;
  delay: number;
  sidechain: number;
  masterCut: number;
};

const STYLES: Record<MusicStyle, Style> = {
  synthwave: {
    pad: 'sawtooth', padCut: 2000, padGain: 0.045, padAttack: 0.35,
    bass: 'sawtooth', bassCut: 700, bassPattern: P('9.7.9.7.9.7.9.7.'),
    pluck: 'square', pluckRate: 16, pluckGain: 0.045, pluckDecay: 0.18,
    lead: 'sawtooth', leadGain: 0.065,
    kick: P('9.......9.6.....'), snare: P('....9.......9...'), clap: P('................'),
    hat: P('5.3.5.3.5.3.5.3.'), openHat: P('................'),
    kickDecay: 0.38, snareVerb: 0.55, swing: 0, reverb: 0.34, delay: 0.3, sidechain: 0.45, masterCut: 16000,
  },
  cinematic: {
    pad: 'sawtooth', padCut: 1300, padGain: 0.05, padAttack: 0.9,
    bass: 'sine', bassCut: 400, bassPattern: P('9.......7.......'),
    pluck: 'triangle', pluckRate: 8, pluckGain: 0.07, pluckDecay: 0.35,
    lead: 'triangle', leadGain: 0.09,
    kick: P('9.......7.......'), snare: P('............9...'), clap: P('................'),
    hat: P('................'), openHat: P('................'),
    kickDecay: 0.9, snareVerb: 0.8, swing: 0, reverb: 0.5, delay: 0.18, sidechain: 0, masterCut: 14000,
  },
  house: {
    pad: 'sawtooth', padCut: 2600, padGain: 0.032, padAttack: 0.05,
    bass: 'square', bassCut: 900, bassPattern: P('..9...9...9...9.'),
    pluck: 'sawtooth', pluckRate: 8, pluckGain: 0.045, pluckDecay: 0.14,
    lead: 'square', leadGain: 0.05,
    kick: P('9...9...9...9...'), snare: P('................'), clap: P('....9.......9...'),
    hat: P('3232323232323232'), openHat: P('..6...6...6...6.'),
    kickDecay: 0.32, snareVerb: 0.3, swing: 0.05, reverb: 0.22, delay: 0.2, sidechain: 0.7, masterCut: 17000,
  },
  lofi: {
    pad: 'triangle', padCut: 1100, padGain: 0.07, padAttack: 0.15,
    bass: 'sine', bassCut: 500, bassPattern: P('9......5..8.....'),
    pluck: 'sine', pluckRate: 8, pluckGain: 0.08, pluckDecay: 0.6,
    lead: 'triangle', leadGain: 0.08,
    kick: P('9......6..9.....'), snare: P('....7.......7...'), clap: P('................'),
    hat: P('4.3.4.3.4.3.4.3.'), openHat: P('................'),
    kickDecay: 0.3, snareVerb: 0.25, swing: 0.18, reverb: 0.28, delay: 0.15, sidechain: 0.25, masterCut: 5200,
  },
  chiptune: {
    pad: 'square', padCut: 3500, padGain: 0.022, padAttack: 0.01,
    bass: 'triangle', bassCut: 2000, bassPattern: P('9.9.9.9.9.9.9.9.'),
    pluck: 'square', pluckRate: 16, pluckGain: 0.04, pluckDecay: 0.09,
    lead: 'square', leadGain: 0.055,
    kick: P('9.......9.......'), snare: P('....9.......9...'), clap: P('................'),
    hat: P('4343434343434343'), openHat: P('................'),
    kickDecay: 0.2, snareVerb: 0.1, swing: 0, reverb: 0.1, delay: 0.12, sidechain: 0, masterCut: 18000,
  },
};

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
  const rnd = mulberry32(7);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  }
  return buf;
}

export function makeReverb(ctx: BaseAudioContext, seconds = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rnd = mulberry32(11);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += 0.35 * (rnd() * 2 - 1 - lp);
      d[i] = lp * Math.exp((-i / len) * 6);
    }
  }
  return buf;
}

// Performance note: every filter sits on a shared bus with a static cutoff. Automating a
// BiquadFilter per note makes Chrome recompute coefficients per sample, which made a
// one-minute song take 16 s to render.
class Composer {
  private readonly ctx: OfflineAudioContext;
  private readonly s: Style;
  private readonly noise: AudioBuffer;
  private readonly rnd: () => number;
  private readonly bus: GainNode;
  private readonly duck: GainNode;
  private readonly drums: GainNode;
  private readonly verb: GainNode;
  private readonly echo: GainNode;
  private readonly padIn: BiquadFilterNode;
  private readonly bassIn: BiquadFilterNode;
  private readonly arpL: StereoPannerNode;
  private readonly arpR: StereoPannerNode;
  private readonly leadIn: BiquadFilterNode;
  private readonly snareIn: BiquadFilterNode;
  private readonly clapIn: BiquadFilterNode;
  private readonly hatIn: BiquadFilterNode;
  private readonly crashIn: BiquadFilterNode;

  constructor(ctx: OfflineAudioContext, style: Style, seed: number, beat: number, duration: number) {
    this.ctx = ctx;
    this.s = style;
    this.noise = makeNoise(ctx);
    this.rnd = mulberry32(seed);
    const gain = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(1, 0.4);
    master.gain.setValueAtTime(1, Math.max(0.5, duration - 2.4));
    master.gain.linearRampToValueAtTime(0, duration);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.bus = gain(0.7);
    this.bus.connect(filter('lowpass', style.masterCut)).connect(comp).connect(master).connect(ctx.destination);

    this.duck = gain(1);
    this.duck.connect(this.bus);
    this.drums = gain(1);
    this.drums.connect(this.bus);

    this.verb = gain(1);
    const conv = ctx.createConvolver();
    conv.buffer = makeReverb(ctx);
    this.verb.connect(conv).connect(gain(style.reverb)).connect(this.bus);

    this.echo = gain(1);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = beat * 0.75;
    const damp = filter('lowpass', 3200);
    this.echo.connect(delay).connect(damp).connect(gain(0.32)).connect(delay);
    damp.connect(gain(style.delay)).connect(this.bus);

    // pad: static lowpass, widened with a short Haas delay on the right channel
    this.padIn = filter('lowpass', style.padCut, 0.6);
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const haas = ctx.createDelay(0.05);
    haas.delayTime.value = 0.014;
    this.padIn.connect(split);
    split.connect(merge, 0, 0);
    split.connect(haas, 1).connect(merge, 0, 1);
    merge.connect(this.duck);
    merge.connect(gain(0.8)).connect(this.verb);

    this.bassIn = filter('lowpass', style.bassCut);
    this.bassIn.connect(this.duck);

    const arp = filter('lowpass', 2600);
    arp.connect(this.duck);
    const arpSend = gain(0.55);
    arp.connect(arpSend);
    arpSend.connect(this.echo);
    arpSend.connect(this.verb);
    this.arpL = ctx.createStereoPanner();
    this.arpL.pan.value = -0.28;
    this.arpR = ctx.createStereoPanner();
    this.arpR.pan.value = 0.28;
    this.arpL.connect(arp);
    this.arpR.connect(arp);

    this.leadIn = filter('lowpass', 2800);
    this.leadIn.connect(this.bus);
    const leadSend = gain(0.5);
    this.leadIn.connect(leadSend);
    leadSend.connect(this.echo);
    leadSend.connect(this.verb);

    this.snareIn = filter('bandpass', 1900, 0.8);
    this.snareIn.connect(this.drums);
    this.snareIn.connect(gain(style.snareVerb)).connect(this.verb);
    this.clapIn = filter('bandpass', 1150, 1.1);
    this.clapIn.connect(this.drums);
    this.clapIn.connect(gain(0.4)).connect(this.verb);
    this.hatIn = filter('highpass', 7400);
    const hatPan = ctx.createStereoPanner();
    hatPan.pan.value = 0.25;
    this.hatIn.connect(hatPan).connect(this.drums);
    this.crashIn = filter('highpass', 4200);
    this.crashIn.connect(this.drums);
    this.crashIn.connect(gain(0.8)).connect(this.verb);
  }

  private vary(v: number) {
    return v * (0.88 + 0.24 * this.rnd());
  }

  private osc(type: OscillatorType, freq: number, t: number, end: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.start(t, this.rnd() * 1.5, dur);
    return n;
  }

  /** gain node with an attack-hold-release envelope */
  private env(t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  pad(t: number, dur: number, midis: number[], level: number) {
    const s = this.s;
    const attack = Math.min(s.padAttack, dur * 0.5);
    const g = this.env(t, s.padGain * level, attack, Math.max(0, dur - attack), 1.1);
    for (const midi of midis) {
      for (const detune of [-9, 8]) {
        const o = this.osc(s.pad, mtof(midi), t, t + dur + 1.2);
        o.detune.value = detune;
        o.connect(g);
      }
    }
    g.connect(this.padIn);
  }

  bass(t: number, dur: number, midi: number, vel: number) {
    const s = this.s;
    const g = this.env(t, 0.26 * this.vary(vel), 0.006, Math.max(0.02, dur * 0.8), 0.09);
    this.osc(s.bass, mtof(midi), t, t + dur + 0.2).connect(g);
    if (s.bass !== 'sine') {
      const sub = this.ctx.createGain();
      sub.gain.value = 0.6;
      this.osc('sine', mtof(midi - 12), t, t + dur + 0.2).connect(sub).connect(g);
    }
    g.connect(this.bassIn);
  }

  pluck(t: number, midi: number, vel: number, left: boolean) {
    const s = this.s;
    const g = this.env(t, s.pluckGain * this.vary(vel), 0.003, 0, s.pluckDecay);
    this.osc(s.pluck, mtof(midi), t, t + s.pluckDecay + 0.05).connect(g);
    g.connect(left ? this.arpL : this.arpR);
  }

  lead(t: number, dur: number, midi: number, vel: number) {
    const s = this.s;
    const g = this.env(t, s.leadGain * this.vary(vel), 0.02, Math.max(0.02, dur - 0.05), 0.14);
    const o = this.osc(s.lead, mtof(midi), t, t + dur + 0.2);
    if (dur > 0.3) {
      const lfo = this.osc('sine', 5.3, t, t + dur + 0.2);
      const depth = this.ctx.createGain();
      depth.gain.value = 8;
      lfo.connect(depth).connect(o.detune);
    }
    o.connect(g).connect(this.leadIn);
  }

  private duckAt(t: number) {
    if (!this.s.sidechain) return;
    const g = this.duck.gain;
    g.setValueAtTime(1 - this.s.sidechain, t);
    g.setTargetAtTime(1, t + 0.02, 0.09);
  }

  kick(t: number, vel: number) {
    const g = this.env(t, 0.95 * this.vary(vel), 0.002, 0, this.s.kickDecay);
    const o = this.osc('sine', 155, t, t + this.s.kickDecay + 0.05);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    o.connect(g).connect(this.drums);
    this.duckAt(t);
  }

  snare(t: number, vel: number) {
    const v = this.vary(vel);
    this.noiseSrc(t, 0.25).connect(this.env(t, 0.5 * v, 0.002, 0, 0.18)).connect(this.snareIn);
    const o = this.osc('triangle', 195, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    o.connect(this.env(t, 0.28 * v, 0.002, 0, 0.09)).connect(this.drums);
  }

  clap(t: number, vel: number) {
    const g = this.ctx.createGain();
    const peak = 0.45 * this.vary(vel);
    g.gain.setValueAtTime(0, t);
    for (const dt of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(peak, t + dt);
      g.gain.exponentialRampToValueAtTime(0.05, t + dt + 0.009);
    }
    g.gain.setValueAtTime(peak, t + 0.031);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    this.noiseSrc(t, 0.22).connect(g).connect(this.clapIn);
  }

  hat(t: number, vel: number, open: boolean) {
    const g = this.env(t, (open ? 0.12 : 0.15) * this.vary(vel), 0.001, 0, open ? 0.28 : 0.045);
    this.noiseSrc(t, open ? 0.32 : 0.06).connect(g).connect(this.hatIn);
  }

  crash(t: number, vel = 1) {
    this.noiseSrc(t, 2).connect(this.env(t, 0.2 * vel, 0.003, 0, 1.9)).connect(this.crashIn);
  }

  riser(t: number, dur: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + dur * 0.95);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    this.noiseSrc(t, dur + 0.05).connect(f).connect(g);
    g.connect(this.bus);
    g.connect(this.verb);
  }
}

export async function renderComposition(spec: MusicSpec, plan: AudioPlan): Promise<AudioBuffer> {
  const style = STYLES[spec.style];
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.duration * SAMPLE_RATE), SAMPLE_RATE);
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const step = bar / 16;
  const c = new Composer(ctx, style, hashString(JSON.stringify(spec)), beat, plan.duration);

  const scale = SCALES[spec.scale];
  const key = NOTE[spec.key];
  const semi = (deg: number) => {
    const d = deg - 1;
    return scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  };
  const into = (midi: number, lo: number) => {
    let m = midi;
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  };

  // Bar grid aligned so that a bar line falls exactly on the start of the race.
  const raceStart = plan.intro;
  const introBars = Math.ceil(raceStart / bar);
  const origin = raceStart - introBars * bar;
  const totalBars = Math.ceil((plan.duration - origin) / bar);
  const breakBar = introBars + Math.round((plan.race * 0.55) / bar);
  const raceBars = Math.max(1, Math.floor(plan.race / bar));
  const outroBar = introBars + raceBars;
  const swingAt = (k: number) => (k % 2 === 1 ? style.swing * step : 0);

  const scheduleBar = (b: number) => {
    const t = origin + b * bar;
    const rel = b - introBars; // bar index relative to race start
    const section =
      b < introBars ? 'intro' : b >= outroBar ? 'outro' : rel < raceBars * 0.22 ? 'A' : b < breakBar ? 'B' : b < breakBar + 2 ? 'break' : 'C';
    const degree = section === 'outro' ? 1 : spec.progression[((rel % 4) + 4) % 4];
    const root = key + semi(degree);
    const chord = [degree, degree + 2, degree + 4].map((d) => into(key + semi(d) + 48, 52));
    const at = (k: number) => t + k * step + swingAt(k);
    const ok = (time: number) => time >= 0 && time < plan.duration - 0.05;

    if (section === 'outro') {
      if (b === outroBar) {
        c.crash(Math.max(0, t));
        c.pad(Math.max(0, t), Math.max(0.5, plan.duration - t), [...chord, chord[0] + 12], 1.1);
        c.bass(Math.max(0, t), Math.max(0.5, plan.duration - t - 0.5), into(root + 36, 36), 0.9);
      }
      return;
    }

    // pad on every bar
    if (t + bar > 0) {
      const start = Math.max(0, t);
      c.pad(start, t + bar - start, section === 'C' ? [...chord, chord[0] + 12] : chord, section === 'intro' ? 0.8 : 1);
    }

    if (section === 'intro') {
      if (b === introBars - 1) c.riser(Math.max(0, t), raceStart - Math.max(0, t));
      return;
    }

    if ((section === 'B' || section === 'C') && rel % 8 === 0) c.crash(t, 0.8);
    if (b === introBars) c.crash(t, 1);
    if (section === 'C' && b === breakBar + 2) c.crash(t, 1);

    // bass
    for (let k = 0; k < 16; k++) {
      const v = style.bassPattern[k];
      if (!v || !ok(at(k))) continue;
      if (section === 'break') continue;
      if (section === 'A' && k % 8 !== 0) continue;
      const next = style.bassPattern.findIndex((x, j) => j > k && x > 0);
      const len = ((next < 0 ? 16 : next) - k) * step;
      c.bass(at(k), len * 0.85, into(root + 36, 36), v);
    }

    // arpeggio over the chord
    const tones = [...chord, chord[0] + 12, chord[1] + 12].map((m) => m + 12);
    const arp = [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 3, 2, 1, 2, 3];
    const every = style.pluckRate === 16 ? 1 : 2;
    for (let k = 0; k < 16; k += every) {
      if (!ok(at(k))) continue;
      const vel = section === 'A' ? 0.6 : section === 'break' ? 0.7 : 1;
      c.pluck(at(k), tones[arp[k]], vel, k % 4 < 2);
    }

    // hook
    if (section === 'break' || section === 'C') {
      const half = ((rel % 2) + 2) % 2;
      for (let k = 0; k < 8; k++) {
        const deg = spec.motif[half * 8 + k];
        const time = t + k * 2 * step + swingAt(k * 2);
        if (!deg || !ok(time)) continue;
        c.lead(time, 2 * step * 0.92, key + 72 + semi(deg), section === 'break' ? 0.7 : 1);
      }
    }

    // drums
    if (section === 'break') {
      if (b === breakBar + 1) c.riser(t, bar);
      return;
    }
    const fill = (section === 'B' || section === 'C') && rel % 8 === 7;
    for (let k = 0; k < 16; k++) {
      const time = at(k);
      if (!ok(time)) continue;
      if (style.kick[k] && section !== 'A') c.kick(time, style.kick[k]);
      if (section === 'A' && k === 0) c.kick(time, 0.8);
      if (fill && k >= 12) c.snare(time, 0.5 + (k - 12) * 0.15);
      else if (style.snare[k] && section !== 'A') c.snare(time, style.snare[k]);
      if (style.clap[k] && section !== 'A') c.clap(time, style.clap[k]);
      if (style.hat[k]) c.hat(time, style.hat[k] * (section === 'A' ? 0.7 : 1), false);
      if (style.openHat[k] && section === 'C') c.hat(time, style.openHat[k], true);
    }
  };

  // Notes are created window by window while the context renders: Chrome processes every
  // connected node in every render quantum, started or not, so scheduling the whole song up
  // front made render time grow with the square of its length.
  const WINDOW = 3;
  let nextBar = 0;
  const scheduleUntil = (horizon: number) => {
    while (nextBar < totalBars && origin + nextBar * bar < horizon) scheduleBar(nextBar++);
  };
  scheduleUntil(WINDOW);
  for (let at = WINDOW; at < plan.duration - 0.05; at += WINDOW) {
    const horizon = at + WINDOW;
    void ctx.suspend(at).then(() => {
      scheduleUntil(horizon);
      return ctx.resume();
    });
  }
  return ctx.startRendering();
}
