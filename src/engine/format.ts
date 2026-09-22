import type { Dataset } from '../../shared/dataset.ts';

export const localeOf = (ds: Dataset) => (ds.language === 'de' ? 'de-DE' : 'en-US');

export function makeValueFormatter(ds: Dataset): (v: number) => string {
  const loc = localeOf(ds);
  const compact = new Intl.NumberFormat(loc, {
    notation: 'compact',
    compactDisplay: 'short',
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3,
  });
  // In compact datasets small values are interpolated estimates too: no false precision ("169.754").
  const plain = ds.compact
    ? new Intl.NumberFormat(loc, { maximumSignificantDigits: 3 })
    : new Intl.NumberFormat(loc, { minimumFractionDigits: ds.decimals, maximumFractionDigits: ds.decimals });
  return (v) => `${ds.valuePrefix}${ds.compact && Math.abs(v) >= 1e6 ? compact.format(v) : plain.format(v)}${ds.valueSuffix}`;
}

export function makeTickFormatter(ds: Dataset): (v: number) => string {
  const loc = localeOf(ds);
  const compact = new Intl.NumberFormat(loc, { notation: 'compact', compactDisplay: 'short', maximumSignificantDigits: 3 });
  const plain = new Intl.NumberFormat(loc, { maximumFractionDigits: ds.decimals });
  return (v) => `${ds.valuePrefix}${ds.compact && Math.abs(v) >= 1e6 ? compact.format(v) : plain.format(v)}${ds.valueSuffix}`;
}

export function eventDateLabel(t: number, locale: string): string {
  const year = Math.floor(t + 1e-6);
  const frac = t - year;
  if (frac < 0.04) return String(year);
  const month = Math.min(11, Math.floor(frac * 12));
  const name = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month, 15)));
  return `${name} ${year}`;
}

export function hostnames(urls: string[]): string[] {
  const seen = new Set<string>();
  for (const u of urls) {
    try {
      seen.add(new URL(u).hostname.replace(/^www\./, ''));
    } catch {
      // not a URL — skip
    }
  }
  return [...seen];
}
