// Visitors' own API keys (BYOK). They stay in this browser and are sent only to the provider's
// API. Stored in localStorage when "remember" is on, otherwise kept for this tab only.

export type KeyName = 'anthropic' | 'elevenlabs';

const storageKey = (name: KeyName) => `statrace:key:${name}`;
const memory = new Map<KeyName, string>();

export function getKey(name: KeyName): string {
  if (memory.has(name)) return memory.get(name)!;
  try {
    return localStorage.getItem(storageKey(name)) ?? '';
  } catch {
    return '';
  }
}

export function setKey(name: KeyName, value: string, remember: boolean): void {
  const key = value.trim();
  memory.set(name, key);
  try {
    if (remember && key) localStorage.setItem(storageKey(name), key);
    else localStorage.removeItem(storageKey(name));
  } catch {
    // storage unavailable (private mode): the key lives for this tab only
  }
}

export function isRemembered(name: KeyName): boolean {
  try {
    return Boolean(localStorage.getItem(storageKey(name)));
  } catch {
    return false;
  }
}
