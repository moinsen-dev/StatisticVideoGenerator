import type { Lang } from './i18n.ts';

export const REPO_URL = 'https://github.com/moinsen-dev/StatisticVideoGenerator';

/** moinsen.dev pages always carry the language prefix. */
export const moinsenUrl = (lang: Lang, page = '') => `https://moinsen.dev/${lang}${page ? `/${page}` : ''}`;
