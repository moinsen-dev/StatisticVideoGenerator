// A model server on the visitor's own machine: Ollama, LM Studio or anything else that speaks the
// OpenAI API. No key: the browser talks to it directly. Ollama allows http://localhost pages by
// default; for the hosted site it needs OLLAMA_ORIGINS, LM Studio its CORS switch.

export type LocalConfig = { url: string; model: string };

export const DEFAULT_LOCAL_URL = 'http://localhost:11434';
const STORE = 'statrace:local';

export function getLocalConfig(): LocalConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<LocalConfig> | null;
    return { url: saved?.url || DEFAULT_LOCAL_URL, model: saved?.model ?? '' };
  } catch {
    return { url: DEFAULT_LOCAL_URL, model: '' };
  }
}

export function setLocalConfig(config: LocalConfig): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(config));
  } catch {
    // storage unavailable: the setting lasts for this page view
  }
}

/** Base URL of the OpenAI-compatible API: "http://localhost:11434" → "http://localhost:11434/v1". */
export const apiBase = (url: string) => `${url.trim().replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;

/** Installed models; throws when the server is down or does not allow this page (CORS). */
export async function listLocalModels(url: string): Promise<string[]> {
  const res = await fetch(`${apiBase(url)}/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).sort();
}

/** The biggest model by the parameter count in its name ("qwen3.8:27b-mlx" → 27): small models research poorly. */
export function preferredModel(models: string[]): string {
  const size = (name: string) => Number(/(\d+(?:\.\d+)?)b\b/i.exec(name)?.[1] ?? 0);
  return [...models].sort((a, b) => size(b) - size(a))[0] ?? '';
}

/** After a failed listing: true when the server answers at all, i.e. it only blocks this origin. */
export async function isServerUp(url: string): Promise<boolean> {
  try {
    await fetch(`${apiBase(url)}/models`, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}
