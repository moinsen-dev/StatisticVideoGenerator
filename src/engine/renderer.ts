import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import { makePalettes, rgba, type Palette } from './color.ts';
import { eventDateLabel, hostnames, localeOf, makeTickFormatter, makeValueFormatter } from './format.ts';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, mulberry32, smoothstep } from './math.ts';
import type { RaceModel } from './model.ts';

// Canvas renderer. `draw(ctx, τ)` paints one complete frame and keeps no state between
// frames, so the live preview and the frame-by-frame export produce identical pictures.

export type Format = 'landscape' | 'portrait';
export const FRAME: Record<Format, { W: number; H: number }> = {
  landscape: { W: 1920, H: 1080 },
  portrait: { W: 1080, H: 1920 },
};

const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
// Canvas has no font-variant-numeric; a second face of Inter with "tnum" switched on gives
// tabular digits, so counting numbers don't wobble.
const NUM = '"Inter Tabular", "Inter Variable", Inter, system-ui, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${SANS}`;
const numFont = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${NUM}`;

let fontsReady: Promise<unknown> | null = null;
function loadFonts(): Promise<unknown> {
  fontsReady ??= (async () => {
    const tabular = new FontFace('Inter Tabular', `url(${interLatin})`, { weight: '100 900', featureSettings: '"tnum" 1' });
    document.fonts.add(await tabular.load());
    await Promise.all([document.fonts.load(font(800, 40)), document.fonts.load(font(400, 40))]);
  })();
  return fontsReady;
}

const INK = '#f4f6ff';
const MUTED = 'rgba(214,222,255,0.7)';
const ACCENT = '#a3b6ff';
const GOLD = '#ffd166';

const STRINGS = {
  de: { timeline: 'CHRONIK', lead: 'NEU AUF PLATZ 1', final: 'ENDSTAND', sources: 'Quellen' },
  en: { timeline: 'TIMELINE', lead: 'NEW NUMBER 1', final: 'FINAL STANDINGS', sources: 'Sources' },
};

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  W: number;
  H: number;
  header: { x: number; y: number; maxW: number; titleSize: number; subSize: number; lines: number };
  total: { x: number; y: number; align: CanvasTextAlign; size: number };
  chart: Box & { rankW: number; labelSpace: number };
  year: { x: number; y: number; size: number };
  facts: Box & { pad: number; iconR: number; titleSize: number; textSize: number; gap: number };
  timeline: { x: number; y: number; w: number };
  footer: { x: number; y: number; size: number; maxW: number };
};

function makeLayout(format: Format): Layout {
  if (format === 'landscape') {
    return {
      W: 1920,
      H: 1080,
      header: { x: 72, y: 58, maxW: 1150, titleSize: 50, subSize: 25, lines: 1 },
      total: { x: 1848, y: 60, align: 'right', size: 44 },
      chart: { x: 72, y: 196, w: 1180, h: 770, rankW: 54, labelSpace: 250 },
      year: { x: 1244, y: 952, size: 168 },
      facts: { x: 1310, y: 196, w: 538, h: 770, pad: 20, iconR: 28, titleSize: 24, textSize: 19, gap: 14 },
      timeline: { x: 72, y: 1020, w: 1776 },
      footer: { x: 72, y: 1062, size: 16, maxW: 1776 },
    };
  }
  return {
    W: 1080,
    H: 1920,
    header: { x: 60, y: 110, maxW: 960, titleSize: 58, subSize: 28, lines: 2 },
    total: { x: 60, y: 0, align: 'left', size: 42 },
    chart: { x: 60, y: 440, w: 960, h: 860, rankW: 50, labelSpace: 230 },
    year: { x: 1020, y: 404, size: 124 },
    facts: { x: 60, y: 1370, w: 960, h: 390, pad: 22, iconR: 30, titleSize: 28, textSize: 22, gap: 16 },
    timeline: { x: 60, y: 1814, w: 960 },
    footer: { x: 60, y: 1866, size: 20, maxW: 960 },
  };
}

type HeaderLine = { text: string; font: string; color: string; y: number; w: number; sub: boolean; spacing: string };
type Header = { lines: HeaderLine[]; x: number; y: number; w: number; h: number; centerScale: number };
type EventCard = {
  kind: 'event';
  time: number;
  h: number;
  icon: HTMLCanvasElement;
  date: string;
  title: string[];
  text: string[];
};
type FinalCard = {
  kind: 'final';
  time: number;
  h: number;
  heading: string;
  rows: { medal: HTMLCanvasElement; name: string; value: string; color: string }[];
};
type CardLayout = EventCard | FinalCard;

function emojiCanvas(emoji: string, size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  x.font = `${Math.round(size * 0.8)}px ${EMOJI}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(emoji, size / 2, size / 2 + size * 0.05);
  return c;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const test = cur ? `${cur} ${words[i]}` : words[i];
    if (!cur || ctx.measureText(test).width <= maxW) {
      cur = test;
      continue;
    }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines) {
      cur = '';
      break;
    }
  }
  if (cur) lines.push(cur);
  if (!lines.length) return [''];
  const cut = i < words.length;
  let last = lines[lines.length - 1];
  if (cut || ctx.measureText(last).width > maxW) {
    if (cut) last = `${last}…`;
    while (ctx.measureText(last).width > maxW && last.length > 2) last = `${last.slice(0, -2)}…`;
    lines[lines.length - 1] = last;
  }
  return lines;
}

function latestBefore(times: number[], tau: number): number {
  let best = -1;
  for (const t of times) if (t <= tau) best = t;
  return best;
}

export class Renderer {
  readonly W: number;
  readonly H: number;
  private readonly m: RaceModel;
  private readonly L: Layout;
  private readonly str: (typeof STRINGS)['de'];
  private readonly fmt: (v: number) => string;
  private readonly tickFmt: (v: number) => string;
  private readonly pal: Palette[];
  private readonly icons: (HTMLCanvasElement | null)[];
  private readonly totalIcon: HTMLCanvasElement | null;
  private readonly crown: HTMLCanvasElement;
  private readonly medals: HTMLCanvasElement[];
  private readonly header: Header;
  private readonly totalY: number;
  private readonly cards: CardLayout[];
  private readonly sourceLine: string;
  private readonly overtakeTimes: number[][];
  private readonly leadTimes: number[][];

  static async create(model: RaceModel, format: Format): Promise<Renderer> {
    await loadFonts();
    return new Renderer(model, format);
  }

  private constructor(model: RaceModel, format: Format) {
    const m = model;
    const ds = m.dataset;
    this.m = m;
    this.L = makeLayout(format);
    this.W = this.L.W;
    this.H = this.L.H;
    this.str = STRINGS[ds.language];
    this.fmt = makeValueFormatter(ds);
    this.tickFmt = makeTickFormatter(ds);
    this.pal = makePalettes(
      ds.series.map((s) => s.color),
      m.importance,
    );
    this.icons = ds.series.map((s) => (s.icon ? emojiCanvas(s.icon) : null));
    this.totalIcon = ds.total?.icon ? emojiCanvas(ds.total.icon) : null;
    this.crown = emojiCanvas('👑');
    this.medals = ['🥇', '🥈', '🥉'].map((e) => emojiCanvas(e));
    this.overtakeTimes = ds.series.map(() => []);
    for (const o of m.overtakes) this.overtakeTimes[o.series].push(o.time);
    this.leadTimes = ds.series.map(() => []);
    for (const l of m.leaderChanges) this.leadTimes[l.series].push(l.time);

    const measure = document.createElement('canvas').getContext('2d')!;
    this.header = this.layoutHeader(measure);
    this.totalY = format === 'portrait' ? this.header.y + this.header.h + 14 : this.L.total.y;
    this.cards = this.layoutCards(measure);

    const hosts = hostnames(ds.sources.map((s) => s.url));
    measure.font = font(500, this.L.footer.size);
    let line = hosts.length ? `${this.str.sources}: ${hosts.join(' · ')}` : '';
    while (line && measure.measureText(line).width > this.L.footer.maxW && hosts.length > 1) {
      hosts.pop();
      line = `${this.str.sources}: ${hosts.join(' · ')} …`;
    }
    this.sourceLine = line;
  }

  // ------------------------------------------------------------------ layout

  private layoutHeader(ctx: CanvasRenderingContext2D): Header {
    const H = this.L.header;
    const ds = this.m.dataset;
    let size = H.titleSize;
    ctx.letterSpacing = '-1px';
    ctx.font = font(800, size);
    while (H.lines === 1 && ctx.measureText(ds.title).width > H.maxW && size > 36) {
      size -= 2;
      ctx.font = font(800, size);
    }
    const lines: HeaderLine[] = [];
    let y = H.y;
    for (const text of wrapText(ctx, ds.title, H.maxW, H.lines)) {
      lines.push({ text, font: font(800, size), color: INK, y, w: ctx.measureText(text).width, sub: false, spacing: '-1px' });
      y += size * 1.12;
    }
    y += 6;
    ctx.letterSpacing = '0px';
    ctx.font = font(500, H.subSize);
    for (const text of wrapText(ctx, ds.subtitle, H.maxW, H.lines)) {
      lines.push({ text, font: font(500, H.subSize), color: MUTED, y, w: ctx.measureText(text).width, sub: true, spacing: '0px' });
      y += H.subSize * 1.3;
    }
    const w = Math.max(...lines.map((l) => l.w));
    return { lines, x: H.x, y: H.y, w, h: y - H.y, centerScale: Math.min(1.7, (this.W - 160) / w) };
  }

  private layoutCards(ctx: CanvasRenderingContext2D): CardLayout[] {
    const F = this.L.facts;
    const m = this.m;
    const locale = localeOf(m.dataset);
    const textW = F.w - F.pad * 2 - F.iconR * 2 - 16;
    const cards: CardLayout[] = m.cards.map(({ time, event }) => {
      ctx.font = font(700, F.titleSize);
      const title = wrapText(ctx, event.title, textW, 2);
      ctx.font = font(400, F.textSize);
      const text = event.text ? wrapText(ctx, event.text, textW, 3) : [];
      const h = Math.max(
        F.pad * 2 + F.iconR * 2,
        F.pad * 2 + 24 + title.length * F.titleSize * 1.2 + (text.length ? 6 + text.length * F.textSize * 1.38 - 4 : 0),
      );
      return { kind: 'event', time, h, icon: emojiCanvas(event.icon), date: eventDateLabel(event.t, locale), title, text };
    });

    const end = m.duration;
    const finalRank = m.dataset.series
      .map((_, i) => ({ i, v: m.valueAt(i, end) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    cards.push({
      kind: 'final',
      time: m.intro + m.race + 0.45,
      h: F.pad * 2 + 30 + finalRank.length * 50,
      heading: `${this.str.final} ${Math.floor(m.t1)}`,
      rows: finalRank.map((r, k) => ({
        medal: this.medals[k],
        name: m.dataset.series[r.i].name,
        value: this.fmt(r.v),
        color: this.pal[r.i].light,
      })),
    });
    return cards;
  }

  // ------------------------------------------------------------------ frame

  draw(ctx: CanvasRenderingContext2D, tau: number): void {
    const m = this.m;
    const reveal = smoothstep(1.8, 2.7, tau);
    const grow = easeOutCubic(clamp((tau - 2.0) / 0.9, 0, 1));
    const outro = tau - (m.intro + m.race);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
    this.drawBackground(ctx, tau);
    if (reveal > 0) {
      ctx.globalAlpha = reveal;
      this.drawYear(ctx, tau);
      this.drawGrid(ctx, tau, grow);
      this.drawBars(ctx, tau, grow, outro);
      this.drawSparks(ctx, tau, grow);
      this.drawFacts(ctx, tau);
      this.drawTimeline(ctx, tau);
      this.drawTotal(ctx, tau);
      this.drawFooter(ctx);
      ctx.globalAlpha = 1;
    }
    this.drawHeader(ctx, tau);
    const fade = smoothstep(m.duration - 0.6, m.duration, tau);
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, tau: number) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1230');
    bg.addColorStop(1, '#04060e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft light in the colours of the current leaders; it follows the race.
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.max(W, H) * 0.55;
    for (let i = 0; i < this.pal.length; i++) {
      const p = this.m.posAt(i, tau);
      if (p > 3) continue;
      const a = 0.12 * clamp(3 - p, 0, 1) * (p < 1 ? 1.25 : 1);
      const cx = W * (0.5 + 0.42 * Math.sin(tau * 0.06 + i * 2.3));
      const cy = H * (0.45 + 0.36 * Math.cos(tau * 0.045 + i * 1.7));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(this.pal[i].rgb, a));
      g.addColorStop(1, rgba(this.pal[i].rgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';

    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  private drawHeader(ctx: CanvasRenderingContext2D, tau: number) {
    const h = this.header;
    const k = easeInOutCubic(clamp((tau - 1.45) / 0.85, 0, 1));
    const appear = easeOutCubic(clamp(tau / 0.7, 0, 1));
    const s = lerp(h.centerScale * lerp(0.94, 1, appear), 1, k);
    const bcx = h.x + h.w / 2;
    const bcy = h.y + h.h / 2;
    ctx.save();
    ctx.translate(lerp(this.W / 2, bcx, k), lerp(this.H / 2, bcy, k));
    ctx.scale(s, s);
    ctx.translate(-bcx, -bcy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const line of h.lines) {
      ctx.globalAlpha = line.sub ? smoothstep(0.35, 1.0, tau) : appear;
      ctx.font = line.font;
      ctx.letterSpacing = line.spacing;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, h.x + ((h.w - line.w) / 2) * (1 - k), line.y);
    }
    ctx.restore();
  }

  private drawTotal(ctx: CanvasRenderingContext2D, tau: number) {
    const ds = this.m.dataset;
    if (!this.m.hasTotal || !ds.total) return;
    const T = this.L.total;
    const y = this.totalY;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = font(700, 16);
    ctx.letterSpacing = '2px';
    const label = ds.total.label.toUpperCase();
    const iconS = this.totalIcon ? 24 : 0;
    const gap = this.totalIcon ? 8 : 0;
    const startX = T.align === 'right' ? T.x - ctx.measureText(label).width - iconS - gap : T.x;
    if (this.totalIcon) ctx.drawImage(this.totalIcon, startX, y - 4, iconS, iconS);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(214,222,255,0.6)';
    ctx.fillText(label, startX + iconS + gap, y);
    ctx.textAlign = T.align;
    ctx.letterSpacing = '-0.5px';
    ctx.font = numFont(800, T.size);
    ctx.fillStyle = INK;
    ctx.fillText(this.fmt(this.m.totalAt(tau)), T.x, y + 26);
    ctx.restore();
  }

  private drawYear(ctx: CanvasRenderingContext2D, tau: number) {
    const m = this.m;
    const Y = this.L.year;
    const t = m.dataTime(tau);
    const year = Math.floor(t + 1e-6);
    const racing = tau > m.intro && tau < m.intro + m.race;
    const since = ((t - year) * m.race) / Math.max(1e-6, m.t1 - m.t0);
    const pulse = racing ? Math.exp(-since * 5) : 0;
    ctx.save();
    ctx.translate(Y.x, Y.y);
    ctx.scale(1 + 0.04 * pulse, 1 + 0.04 * pulse);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = numFont(900, Y.size);
    ctx.letterSpacing = `${-Y.size * 0.035}px`;
    const g = ctx.createLinearGradient(0, -Y.size * 0.75, 0, 0);
    g.addColorStop(0, `rgba(255,255,255,${0.62 + 0.25 * pulse})`);
    g.addColorStop(1, `rgba(255,255,255,${0.2 + 0.1 * pulse})`);
    ctx.fillStyle = g;
    ctx.fillText(String(year), 0, 0);
    ctx.restore();
  }

  private chartGeometry(grow: number) {
    const C = this.L.chart;
    const N = this.m.bars;
    const rowH = C.h / N;
    const barH = Math.round(rowH * 0.8);
    return {
      C,
      N,
      rowH,
      barH,
      radius: Math.min(12, barH * 0.22),
      x0: C.x + C.rankW,
      barMax: (C.w - C.rankW - C.labelSpace) * grow,
      badgeR: barH / 2 + 3,
    };
  }

  private drawGrid(ctx: CanvasRenderingContext2D, tau: number, grow: number) {
    const maxV = this.m.maxAt(tau);
    if (maxV <= 0 || grow <= 0) return;
    const { C, x0, barMax } = this.chartGeometry(1);
    // Nice steps 1-2-5: ticks of the finer step fade out while the coarser ones fade in.
    const target = maxV / 4.5;
    const base = 10 ** Math.floor(Math.log10(target));
    const seq = [1, 2, 5, 10];
    let k = 0;
    while (k < 2 && seq[k + 1] * base <= target) k++;
    const fine = seq[k] * base;
    const coarse = seq[k + 1] * base;
    const p = (target - fine) / (coarse - fine);
    const fadeFine = 1 - smoothstep(0.35, 0.95, p);
    const fadeCoarse = smoothstep(0.35, 0.95, p);
    const A = ctx.globalAlpha;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = numFont(500, 16);
    const drawTick = (v: number, alpha: number) => {
      const x = x0 + (v / maxV) * barMax;
      const edge = clamp((x0 + barMax + 30 - x) / 60, 0, 1);
      const a = alpha * edge * grow;
      if (a <= 0.01) return;
      ctx.globalAlpha = A * a;
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x - 0.75, C.y - 6, 1.5, C.h + 6);
      ctx.fillStyle = 'rgba(214,222,255,0.5)';
      ctx.fillText(this.tickFmt(v), x, C.y - 14);
    };
    const eps = fine * 1e-6;
    for (let v = fine; v <= maxV * 1.02; v += fine) {
      const isCoarse = Math.abs(v / coarse - Math.round(v / coarse)) < 1e-6;
      drawTick(v, isCoarse ? 1 : fadeFine);
    }
    for (let v = coarse; v <= maxV * 1.02; v += coarse) {
      const isFine = Math.abs(v / fine - Math.round(v / fine)) < eps + 1e-6;
      if (!isFine) drawTick(v, fadeCoarse);
    }
    ctx.globalAlpha = A * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x0 - 1, C.y - 6, 2, C.h + 6);
    ctx.restore();
  }

  private drawBars(ctx: CanvasRenderingContext2D, tau: number, grow: number, outro: number) {
    const m = this.m;
    const { C, N, rowH, barH, radius, x0, barMax, badgeR } = this.chartGeometry(grow);
    const A = ctx.globalAlpha;
    const maxV = m.maxAt(tau) || 1;
    const labelSize = Math.round(barH * 0.37);

    // slot numbers, medals at the end
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, 20);
    for (let k = 0; k < N; k++) {
      const cy = C.y + k * rowH + rowH / 2;
      const medal = k < 3 && outro > 0 ? easeOutBack(clamp((outro - 0.15 - k * 0.18) / 0.45, 0, 1)) : 0;
      ctx.globalAlpha = A * (1 - clamp(medal * 2, 0, 1));
      ctx.fillStyle = 'rgba(214,222,255,0.45)';
      ctx.fillText(String(k + 1), C.x + C.rankW - 16, cy + 1);
      if (medal > 0) {
        ctx.globalAlpha = A;
        const s = 44 * medal;
        ctx.drawImage(this.medals[k], C.x + C.rankW - 10 - 22 - s / 2, cy - s / 2, s, s);
      }
    }
    ctx.restore();

    const items: { i: number; p: number; v: number }[] = [];
    for (let i = 0; i < m.dataset.series.length; i++) {
      const p = m.posAt(i, tau);
      if (p > N + 0.2) continue;
      const v = m.valueAt(i, tau);
      if (v <= 0) continue;
      items.push({ i, p, v });
    }
    items.sort((a, b) => b.p - a.p);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, C.y - 60, this.W, C.h + 64);
    ctx.clip();
    for (const { i, p, v } of items) {
      const pal = this.pal[i];
      const alpha = clamp(N - p, 0, 1);
      if (alpha <= 0.01) continue;
      const y = C.y + p * rowH + (rowH - barH) / 2;
      const cy = y + barH / 2;
      const w = Math.max(10, (v / maxV) * barMax);
      const lead = clamp(1 - p, 0, 1) * smoothstep(m.intro - 0.3, m.intro + 0.3, tau);
      const leadAge = tau - latestBefore(this.leadTimes[i], tau);
      const flash = leadAge >= 0 && leadAge < 1.2 ? Math.exp(-leadAge * 3.5) : 0;

      ctx.save();
      ctx.globalAlpha = A * alpha;
      ctx.beginPath();
      ctx.roundRect(x0, y, w, barH, radius);
      if (lead > 0.02) {
        ctx.shadowColor = rgba(pal.rgb, 0.7 * lead);
        ctx.shadowBlur = 34 * lead;
      }
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, pal.dark);
      g.addColorStop(1, pal.base);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const gloss = ctx.createLinearGradient(0, y, 0, y + barH);
      gloss.addColorStop(0, 'rgba(255,255,255,0.30)');
      gloss.addColorStop(0.48, 'rgba(255,255,255,0.05)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = gloss;
      ctx.fill();
      // a quick glint across the bar every few seconds
      const phase = ((tau + i * 1.37) % 7) / 7;
      if (phase < 0.1 && w > 80) {
        ctx.save();
        ctx.clip();
        ctx.translate(x0 - 40 + (w + 80) * easeInOutCubic(phase / 0.1), y);
        ctx.transform(1, 0, -0.45, 1, 0, 0);
        const sg = ctx.createLinearGradient(-22, 0, 22, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.42)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(-22, 0, 44 + barH, barH);
        ctx.restore();
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * flash})`;
        ctx.fill();
      }

      // name inside the bar (or outside when the bar is too short)
      ctx.textBaseline = 'middle';
      ctx.font = font(700, labelSize);
      const name = m.dataset.series[i].name;
      const nameW = ctx.measureText(name).width;
      const inside = w - badgeR - 28 >= nameW;
      if (inside) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.fillText(name, x0 + w - badgeR - 14, cy + 1);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

      // "new number 1" pill inside the leader's bar
      const pillAge = leadAge;
      if (pillAge >= 0 && pillAge < 3 && tau > m.intro + 0.5) {
        const pop = easeOutBack(clamp(pillAge / 0.35, 0, 1)) * (1 - smoothstep(2.5, 3, pillAge));
        if (pop > 0.01) {
          ctx.save();
          ctx.font = font(800, 15);
          ctx.letterSpacing = '1.5px';
          const label = `👑 ${this.str.lead}`;
          const pw = ctx.measureText(label).width + 26;
          const ph = 30;
          const px = x0 + 16;
          ctx.translate(px + pw / 2, cy);
          ctx.scale(pop, pop);
          ctx.beginPath();
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
          ctx.fillStyle = GOLD;
          ctx.fill();
          ctx.fillStyle = '#2a1d00';
          ctx.textAlign = 'center';
          ctx.fillText(label, 0, 1);
          ctx.restore();
        }
      }

      // badge with icon at the tip
      const bx = Math.max(x0 + badgeR, x0 + w);
      ctx.beginPath();
      ctx.arc(bx, cy, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = pal.dark;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.stroke();
      const icon = this.icons[i];
      if (icon) {
        const s = badgeR * 1.5;
        ctx.drawImage(icon, bx - s / 2, cy - s / 2, s, s);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = font(800, badgeR * 0.9);
        ctx.fillText(name.slice(0, 1).toUpperCase(), bx, cy + 1);
      }
      if (lead > 0.05) {
        ctx.save();
        ctx.globalAlpha = A * alpha * lead;
        ctx.translate(bx + badgeR * 0.55, cy - badgeR * 0.8);
        ctx.rotate(0.45);
        const s = badgeR * 0.95;
        ctx.drawImage(this.crown, -s / 2, -s / 2, s, s);
        ctx.restore();
      }

      // value, overtake arrow, outside name
      let tx = bx + badgeR + 12;
      ctx.textAlign = 'left';
      ctx.font = font(700, labelSize);
      ctx.fillStyle = INK;
      ctx.font = numFont(700, labelSize);
      const valueText = this.fmt(v);
      ctx.fillText(valueText, tx, cy + 1);
      tx += ctx.measureText(valueText).width + 12;
      const upAge = tau - latestBefore(this.overtakeTimes[i], tau);
      if (upAge >= 0 && upAge < 1.4) {
        ctx.fillStyle = `rgba(74,222,128,${1 - upAge / 1.4})`;
        ctx.font = font(900, labelSize * 0.75);
        ctx.fillText('▲', tx, cy);
        tx += labelSize + 4;
      }
      if (!inside) {
        ctx.font = font(600, labelSize);
        ctx.fillStyle = MUTED;
        ctx.fillText(name, tx, cy + 1);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawSparks(ctx: CanvasRenderingContext2D, tau: number, grow: number) {
    const m = this.m;
    const { C, N, rowH, x0, barMax, badgeR } = this.chartGeometry(grow);
    const maxV = m.maxAt(tau) || 1;
    const A = ctx.globalAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    m.overtakes.forEach((o, k) => {
      const age = tau - o.time;
      if (age < 0 || age > 1.1) return;
      const p = m.posAt(o.series, tau);
      if (p > N - 0.5) return;
      const cy = C.y + p * rowH + rowH / 2;
      const tipX = Math.max(x0 + badgeR, x0 + Math.max(10, (m.valueAt(o.series, tau) / maxV) * barMax));
      const originX = tipX + badgeR * 0.9;
      const pal = this.pal[o.series];
      if (age < 0.45) {
        const q = age / 0.45;
        ctx.globalAlpha = A * (1 - q) * 0.9;
        ctx.strokeStyle = pal.light;
        ctx.lineWidth = 4 * (1 - q) + 1;
        ctx.beginPath();
        ctx.arc(tipX, cy, badgeR + 4 + easeOutCubic(q) * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
      const rnd = mulberry32(k * 7919 + 17);
      for (let j = 0; j < 22; j++) {
        const ang = (rnd() - 0.5) * Math.PI * 1.8;
        const speed = 240 + rnd() * 460;
        const life = 0.55 + rnd() * 0.5;
        const size = 2.2 + rnd() * 3.2;
        const lr = 1 - age / life;
        if (lr <= 0) continue;
        const drag = 2.6;
        const travel = (1 - Math.exp(-age * drag)) / drag;
        const vx = Math.cos(ang) * speed + 90;
        const vy = Math.sin(ang) * speed;
        const px = originX + vx * travel;
        const py = cy + vy * travel + 260 * age * age;
        const tail = 0.035 * Math.exp(-age * drag);
        ctx.globalAlpha = A * lr;
        ctx.strokeStyle = j % 3 === 0 ? '#ffffff' : pal.light;
        ctx.lineWidth = size * (0.5 + 0.5 * lr);
        ctx.beginPath();
        ctx.moveTo(px - vx * tail, py - (vy + 520 * age) * tail);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  private drawFacts(ctx: CanvasRenderingContext2D, tau: number) {
    const F = this.L.facts;
    const A = ctx.globalAlpha;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(800, 15);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = ACCENT;
    ctx.fillText(this.str.timeline, F.x, F.y);
    const lw = ctx.measureText(this.str.timeline).width;
    ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(163,182,255,0.22)';
    ctx.fillRect(F.x + lw + 14, F.y + 8, F.w - lw - 14, 1.5);

    const top = F.y + 38;
    const bottom = F.y + F.h;
    ctx.beginPath();
    ctx.rect(F.x - 30, top - 12, F.w + 60, bottom - top + 12);
    ctx.clip();

    const placed: { c: CardLayout; y: number; enter: number }[] = [];
    let offset = 0;
    for (let k = this.cards.length - 1; k >= 0; k--) {
      const c = this.cards[k];
      if (c.time > tau) continue;
      const enter = easeOutCubic(clamp((tau - c.time) / 0.6, 0, 1));
      placed.push({ c, y: top + offset, enter });
      offset += (c.h + F.gap) * enter;
      if (top + offset > bottom + 40) break;
    }
    for (let k = placed.length - 1; k >= 0; k--) {
      const { c, y, enter } = placed[k];
      const overflow = y + c.h - bottom;
      const alpha = enter * (overflow > 0 ? clamp(1 - overflow / (c.h * 0.55), 0, 1) ** 1.5 : 1);
      if (alpha <= 0.01) continue;
      const x = F.x + (1 - enter) * 70;
      const glow = k === 0 ? 1 - smoothstep(1.4, 3.2, tau - c.time) : 0;
      ctx.globalAlpha = A * alpha;
      if (c.kind === 'event') this.drawEventCard(ctx, c, x, y, glow);
      else this.drawFinalCard(ctx, c, x, y);
    }
    ctx.restore();
  }

  private drawEventCard(ctx: CanvasRenderingContext2D, c: EventCard, x: number, y: number, glow: number) {
    const F = this.L.facts;
    ctx.beginPath();
    ctx.roundRect(x, y, F.w, c.h, 18);
    ctx.fillStyle = `rgba(255,255,255,${0.055 + 0.03 * glow})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = glow > 0.01 ? `rgba(163,182,255,${0.14 + 0.66 * glow})` : 'rgba(255,255,255,0.1)';
    ctx.stroke();

    const icx = x + F.pad + F.iconR;
    const icy = y + F.pad + F.iconR;
    ctx.beginPath();
    ctx.arc(icx, icy, F.iconR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    const s = F.iconR * 1.4;
    ctx.drawImage(c.icon, icx - s / 2, icy - s / 2, s, s);

    const tx = x + F.pad + F.iconR * 2 + 16;
    let ty = y + F.pad - 1;
    ctx.font = font(800, 15);
    ctx.letterSpacing = '1.5px';
    ctx.fillStyle = ACCENT;
    ctx.fillText(c.date.toUpperCase(), tx, ty);
    ctx.letterSpacing = '0px';
    ty += 24;
    ctx.font = font(700, F.titleSize);
    ctx.fillStyle = INK;
    for (const line of c.title) {
      ctx.fillText(line, tx, ty);
      ty += F.titleSize * 1.2;
    }
    ty += 6;
    ctx.font = font(400, F.textSize);
    ctx.fillStyle = 'rgba(222,228,255,0.74)';
    for (const line of c.text) {
      ctx.fillText(line, tx, ty);
      ty += F.textSize * 1.38;
    }
  }

  private drawFinalCard(ctx: CanvasRenderingContext2D, c: FinalCard, x: number, y: number) {
    const F = this.L.facts;
    ctx.beginPath();
    ctx.roundRect(x, y, F.w, c.h, 18);
    ctx.fillStyle = 'rgba(255,209,102,0.08)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,209,102,0.7)';
    ctx.stroke();
    ctx.font = font(800, 16);
    ctx.letterSpacing = '2.5px';
    ctx.fillStyle = GOLD;
    ctx.fillText(`🏁 ${c.heading}`, x + F.pad, y + F.pad);
    ctx.letterSpacing = '0px';
    let ry = y + F.pad + 34;
    for (const row of c.rows) {
      ctx.drawImage(row.medal, x + F.pad - 4, ry - 4, 42, 42);
      ctx.textBaseline = 'middle';
      ctx.font = font(700, 25);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText(row.name, x + F.pad + 48, ry + 17);
      ctx.textAlign = 'right';
      ctx.font = numFont(800, 24);
      ctx.fillStyle = row.color;
      ctx.fillText(row.value, x + F.w - F.pad, ry + 17);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ry += 50;
    }
  }

  private drawTimeline(ctx: CanvasRenderingContext2D, tau: number) {
    const m = this.m;
    const T = this.L.timeline;
    const A = ctx.globalAlpha;
    const p = clamp((tau - m.intro) / m.race, 0, 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(T.x, T.y);
    ctx.lineTo(T.x + T.w, T.y);
    ctx.stroke();
    if (p > 0) {
      const g = ctx.createLinearGradient(T.x, 0, T.x + T.w, 0);
      g.addColorStop(0, '#6d8bff');
      g.addColorStop(1, '#c9a7ff');
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(T.x, T.y);
      ctx.lineTo(T.x + p * T.w, T.y);
      ctx.stroke();
    }
    for (const c of this.cards) {
      if (c.kind !== 'event') continue;
      const cx = T.x + clamp((c.time - m.intro) / m.race, 0, 1) * T.w;
      const age = tau - c.time;
      ctx.globalAlpha = A;
      ctx.fillStyle = age >= 0 ? ACCENT : 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(cx, T.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (age >= 0 && age < 0.9) {
        ctx.globalAlpha = A * (1 - age / 0.9);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, T.y, 5 + age * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 4;
      }
    }
    ctx.globalAlpha = A;
    const hx = T.x + p * T.w;
    ctx.shadowColor = 'rgba(201,167,255,0.9)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx, T.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = font(600, 15);
    ctx.fillStyle = 'rgba(214,222,255,0.5)';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(String(Math.floor(m.t0)), T.x, T.y - 12);
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(m.t1)), T.x + T.w, T.y - 12);
    ctx.restore();
  }

  private drawFooter(ctx: CanvasRenderingContext2D) {
    if (!this.sourceLine) return;
    const Fo = this.L.footer;
    ctx.save();
    ctx.font = font(500, Fo.size);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(214,222,255,0.42)';
    ctx.fillText(this.sourceLine, Fo.x, Fo.y);
    ctx.restore();
  }
}
