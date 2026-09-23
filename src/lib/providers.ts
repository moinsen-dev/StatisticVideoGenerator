import type { ResearchProgress, ResearchRequest, ResearchResult } from '../../shared/dataset.ts';
import { research as researchWithCli } from './api.ts';
import type { Lang } from './i18n.ts';
import { getKey, type KeyName } from './keys.ts';

// Who researches a topic. Two kinds:
// - claude-code: the unmodified `claude` CLI behind the local dev server, on the user's own
//   subscription; for local use only.
// - anthropic, openai: hosted APIs, called straight from the browser with the visitor's own key.
// Google Gemini is left out on purpose: the terms for Grounding with Google Search forbid modifying
// or redistributing grounded results, and a published video is exactly that.

export type ProviderId = 'claude-code' | 'anthropic' | 'openai';
type Depth = ResearchRequest['depth'];

export type Provider = {
  id: ProviderId;
  /** the AI's name in progress texts: "Claude is researching" */
  name: string;
  vendor: string;
  models: Record<Depth, string>;
  /** typical cost of one research run in USD; null when it runs on a subscription */
  cost: Record<Depth, [number, number]> | null;
  key: { name: KeyName; prefix: string; placeholder: string; host: string; createUrl: string } | null;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude',
    vendor: 'Claude Code',
    models: { fast: 'Sonnet', thorough: 'Opus' },
    cost: null,
    key: null,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    vendor: 'Anthropic',
    models: { fast: 'Claude Sonnet 5', thorough: 'Claude Opus 5' },
    cost: { fast: [0.3, 0.6], thorough: [0.8, 1.5] },
    key: {
      name: 'anthropic',
      prefix: 'sk-ant-',
      placeholder: 'sk-ant-…',
      host: 'api.anthropic.com',
      createUrl: 'https://console.anthropic.com/settings/keys',
    },
  },
  openai: {
    id: 'openai',
    name: 'GPT',
    vendor: 'OpenAI',
    models: { fast: 'GPT-6 Sol', thorough: 'GPT-6 Astra' },
    cost: { fast: [0.3, 0.6], thorough: [1.5, 3] },
    key: {
      name: 'openai',
      prefix: 'sk-',
      placeholder: 'sk-proj-…',
      host: 'api.openai.com',
      createUrl: 'https://platform.openai.com/api-keys',
    },
  },
};

/** "0,30–0,60 $" or "$0.30–$0.60" */
export const usdRange = ([lo, hi]: [number, number], lang: Lang) =>
  new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'USD' }).formatRange(lo, hi);

/** Providers that work everywhere, including the hosted site. */
export const BYOK_PROVIDERS: ProviderId[] = ['anthropic', 'openai'];

const STORE = 'statrace:provider';

export function saveProvider(id: ProviderId): void {
  try {
    localStorage.setItem(STORE, id);
  } catch {
    // storage unavailable: the choice lasts for this page view
  }
}

/** The saved choice if it can run here; otherwise the local CLI when it is signed in, else Claude by key. */
export function defaultProvider(cliReady: boolean): ProviderId {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORE);
  } catch {
    // storage unavailable
  }
  if (saved === 'anthropic' || saved === 'openai' || (saved === 'claude-code' && cliReady)) return saved;
  return cliReady ? 'claude-code' : 'anthropic';
}

export function hasKey(id: ProviderId): boolean {
  const key = PROVIDERS[id].key;
  return !key || getKey(key.name).startsWith(key.prefix);
}

export async function runResearch(
  id: ProviderId,
  req: ResearchRequest,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  if (id === 'claude-code') return researchWithCli(req, onProgress, signal);
  const key = getKey(PROVIDERS[id].key!.name);
  // Loaded on demand: each adapter pulls in its provider's SDK.
  if (id === 'anthropic') {
    const { researchWithAnthropic } = await import('./research-anthropic.ts');
    return researchWithAnthropic(req, key, onProgress, signal);
  }
  const { researchWithOpenAI } = await import('./research-openai.ts');
  return researchWithOpenAI(req, key, onProgress, signal);
}
