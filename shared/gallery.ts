import type { Dataset } from './dataset.ts';

// Rules the public gallery enforces before any AI review: licence and sources that may not be republished.

/** Published datasets are licensed like their most restrictive typical source (Wikipedia: CC BY-SA). */
export const GALLERY_LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de' };

/** Sources whose numbers may not be republished (paywalls such as Statista). */
const PAYWALLED = /(^|\.)(statista\.(com|de)|bloomberg\.com|wsj\.com|ft\.com|economist\.com)$/i;

export const paywalledSources = (ds: Dataset) =>
  ds.sources.filter((s) => {
    try {
      return PAYWALLED.test(new URL(s.url).hostname);
    } catch {
      return false;
    }
  });
