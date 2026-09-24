import type { Lang } from './i18n.ts';

export const REPO_URL = 'https://github.com/moinsen-dev/StatisticVideoGenerator';

/** moinsen.dev pages always carry the language prefix. */
export const moinsenUrl = (lang: Lang, page = '') => `https://moinsen.dev/${lang}${page ? `/${page}` : ''}`;

/** The StatRace section of the moinsen.dev privacy policy. */
export const privacyUrl = (lang: Lang) => `${moinsenUrl(lang, 'privacy')}#statrace`;

/** Gallery terms: a static page, German first, English under #en. */
export const termsUrl = (lang: Lang) => `/gallery-terms.html${lang === 'en' ? '#en' : ''}`;

/** Contact point for the gallery (DSA Art. 11/12) and for disagreeing with a decision. */
export const CONTACT_MAIL = 'business@moinsen.dev';
