import type { ResearchProgress, ResearchRequest, ResearchResult, ServerStatus } from '../../shared/dataset.ts';
import { research as researchWithCli } from './api.ts';
import type { Lang } from './i18n.ts';
import { getKey, type KeyName } from './keys.ts';
import { getLocalConfig } from './local-model.ts';

// Who researches a topic. Three kinds:
// - claude-code, codex: the unmodified `claude` / `codex` CLI behind the local dev server, on the
//   user's own subscription (Claude, ChatGPT); for local use only.
// - local: a model on the visitor's machine (Ollama, LM Studio …), no key; it researches open data.
// - anthropic, openai: hosted APIs, called straight from the browser with the visitor's own key.
// Google Gemini is left out on purpose: the terms for Grounding with Google Search forbid modifying
// or redistributing grounded results, and a published video is exactly that.

export type ProviderId = 'claude-code' | 'codex' | 'local' | 'anthropic' | 'openai';
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
  codex: {
    id: 'codex',
    name: 'GPT',
    vendor: 'Codex',
    models: { fast: 'GPT-6 Sol', thorough: 'GPT-6 Astra' },
    cost: null,
    key: null,
  },
  // name and models come from the local configuration, see providerName/modelLabel
  local: {
    id: 'local',
    name: '',
    vendor: 'Ollama · LM Studio',
    models: { fast: '', thorough: '' },
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

const cliReady = (cli: ServerStatus['claude'] | undefined) => Boolean(cli?.available && cli.loggedIn);

/** What can research here: signed-in CLIs of the local server, a local model, and the key-based APIs. */
export function availableProviders(status: ServerStatus | null | undefined): ProviderId[] {
  return [
    ...(cliReady(status?.claude) ? (['claude-code'] as const) : []),
    ...(cliReady(status?.codex) ? (['codex'] as const) : []),
    'local',
    ...BYOK_PROVIDERS,
  ];
}

/** The AI's name in progress texts; for a local model, its model id. */
export const providerName = (id: ProviderId) => (id === 'local' ? getLocalConfig().model || 'Local model' : PROVIDERS[id].name);

export const modelLabel = (id: ProviderId, depth: Depth) => (id === 'local' ? getLocalConfig().model : PROVIDERS[id].models[depth]);

const STORE = 'statrace:provider';

export function saveProvider(id: ProviderId): void {
  try {
    localStorage.setItem(STORE, id);
  } catch {
    // storage unavailable: the choice lasts for this page view
  }
}

/** The saved choice if it can run here; otherwise a signed-in local CLI, else Claude by key. */
export function defaultProvider(status: ServerStatus | null | undefined): ProviderId {
  const available = availableProviders(status);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORE);
  } catch {
    // storage unavailable
  }
  const pick = available.find((id) => id === saved);
  if (pick) return pick;
  return available[0] === 'claude-code' || available[0] === 'codex' ? available[0] : 'anthropic';
}

export function hasKey(id: ProviderId): boolean {
  const key = PROVIDERS[id].key;
  return !key || getKey(key.name).startsWith(key.prefix);
}

/** Everything the provider needs is in place: a signed-in CLI, a chosen local model or a key. */
export function isReady(id: ProviderId, status: ServerStatus | null | undefined): boolean {
  if (id === 'claude-code') return cliReady(status?.claude);
  if (id === 'codex') return cliReady(status?.codex);
  if (id === 'local') return Boolean(getLocalConfig().model);
  return hasKey(id);
}

export async function runResearch(
  id: ProviderId,
  req: ResearchRequest,
  onProgress: (p: ResearchProgress) => void,
  signal: AbortSignal,
): Promise<ResearchResult> {
  if (id === 'claude-code') return researchWithCli(req, 'claude', onProgress, signal);
  if (id === 'codex') return researchWithCli(req, 'codex', onProgress, signal);
  // Loaded on demand: each adapter pulls in its provider's SDK.
  if (id === 'local') {
    const { researchWithLocalModel } = await import('./research-local.ts');
    return researchWithLocalModel(req, getLocalConfig(), onProgress, signal);
  }
  const key = getKey(PROVIDERS[id].key!.name);
  if (id === 'anthropic') {
    const { researchWithAnthropic } = await import('./research-anthropic.ts');
    return researchWithAnthropic(req, key, onProgress, signal);
  }
  const { researchWithOpenAI } = await import('./research-openai.ts');
  return researchWithOpenAI(req, key, onProgress, signal);
}
