import { makeNoise, makeReverb, SAMPLE_RATE, type AudioPlan } from './composer.ts';

// Sound effects that follow the picture, independent of the music source:
// an impact when the race starts, a whoosh + chime per fun-fact card, a stinger per new leader.

export async function renderSfx(plan: AudioPlan): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.duration * SAMPLE_RATE), SAMPLE_RATE);
  const noise = makeNoise(ctx);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = makeReverb(ctx, 2);
  const verbGain = ctx.createGain();
  verbGain.gain.value = 0.35;
  verb.connect(verbGain).connect(out);
  const end = plan.duration - 0.05;

  const tone = (type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    g.connect(verb);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const noiseBurst = (t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, pan0 = 0, pan1 = 0) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(pan0, t);
    p.pan.linearRampToValueAtTime(pan1, t + dur);
    src.connect(f).connect(g).connect(p);
    p.connect(out);
    p.connect(verb);
    src.start(t, (t * 0.37) % 1.5, dur + 0.05);
  };

  // race start
  if (plan.intro < end) {
    tone('sine', 72, 34, plan.intro, 1.4, 0.75);
    noiseBurst(plan.intro, 0.9, 'lowpass', 1400, 200, 0.3);
  }
  // cards slide in from the right
  for (const t of plan.cards) {
    if (t > end) continue;
    noiseBurst(Math.max(0, t - 0.05), 0.5, 'bandpass', 700, 3800, 0.28, 0.7, -0.1);
    tone('sine', 1568, 1568, t + 0.12, 0.5, 0.045);
    tone('sine', 2349, 2349, t + 0.14, 0.45, 0.03);
  }
  // new leader
  for (const t of plan.leads) {
    if (t > end) continue;
    tone('sine', 95, 45, t, 0.8, 0.5);
    noiseBurst(t, 1.3, 'highpass', 5000, 9000, 0.1);
    for (const f of [880, 1109, 1319]) tone('triangle', f, f, t + 0.02, 1.2, 0.035);
  }
  return ctx.startRendering();
}
