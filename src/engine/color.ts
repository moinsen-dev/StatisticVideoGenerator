import { clamp } from './math.ts';

export type RGB = [number, number, number];
export type Palette = { base: string; light: string; dark: string; rgb: RGB; lightRgb: RGB };

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
export const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r},${g},${b},${a})`;

function palette(h: number, s: number, l: number): Palette {
  const rgb = hslToRgb(h, s, l);
  const lightRgb = hslToRgb(h, s, clamp(l + 0.14, 0, 0.9));
  return { base: css(rgb), light: css(lightRgb), dark: css(hslToRgb(h, s, clamp(l - 0.17, 0.12, 1))), rgb, lightRgb };
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

/**
 * Brand and flag colours tuned for a dark stage: saturation and lightness pulled into a
 * range that reads well, and near-identical hues among the leaders pushed apart.
 * `order` lists series indices by importance (peak value), most important first.
 */
export function makePalettes(hexes: string[], order: number[]): Palette[] {
  const out: Palette[] = new Array(hexes.length);
  const taken: { h: number; s: number }[] = [];
  for (const i of order) {
    const [h0, s0, l0] = rgbToHsl(hexToRgb(hexes[i]));
    const grey = s0 < 0.12;
    const s = grey ? 0.08 : clamp(s0, 0.55, 0.9);
    const l = grey ? clamp(l0, 0.55, 0.7) : clamp(l0, 0.48, 0.62);
    let h = h0;
    if (!grey) {
      for (let tries = 0; tries < 6 && taken.some((t) => t.s > 0.2 && hueDistance(t.h, h) < 0.035); tries++) {
        h = (h + 0.075) % 1;
      }
      if (taken.length < 12) taken.push({ h, s });
    }
    out[i] = palette(h, s, l);
  }
  return out;
}
