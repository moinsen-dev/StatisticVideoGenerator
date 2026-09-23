import type { ResearchProgress } from '../../shared/dataset.ts';
import { getLang, translate, type MessageKey } from './i18n.ts';

// Helpers shared by the browser research adapters (Anthropic, OpenAI, local models).

export const clip = (s: string, n = 180) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export type Emit = (
  kind: ResearchProgress['kind'],
  text: string,
  code?: ResearchProgress['code'],
  vars?: ResearchProgress['vars'],
) => void;

/** Progress events carry the time since the research started. */
export function progressEmitter(onProgress: (p: ResearchProgress) => void): { emit: Emit; started: number } {
  const started = Date.now();
  const emit: Emit = (kind, text, code, vars) =>
    onProgress({ kind, text, at: Date.now() - started, ...(code ? { code, vars } : {}) });
  return { emit, started };
}

/** Counts streamed dataset characters and reports them at most every 1.2 s. */
export function writingMeter(emit: Emit): (chars: number) => void {
  let written = 0;
  let last = 0;
  return (chars) => {
    written += chars;
    const now = Date.now();
    if (now - last < 1200) return;
    last = now;
    emit('live', `Writing the dataset … ${written} characters`, 'writing', { n: written.toLocaleString() });
  };
}

/** Error messages in the visitor's UI language. */
export const message = (key: MessageKey, vars?: Record<string, string | number>) =>
  new Error(translate(getLang(), key, vars));

type ErrorClass = abstract new (...args: never[]) => Error;
type SdkErrors = Record<
  | 'AuthenticationError'
  | 'PermissionDeniedError'
  | 'RateLimitError'
  | 'BadRequestError'
  | 'NotFoundError'
  | 'APIUserAbortError'
  | 'APIConnectionError',
  ErrorClass
>;

/** Both SDKs share the same error classes; turn them into messages a visitor can act on. */
export function explainApiError(err: unknown, sdk: SdkErrors, vendor: string, model: string): unknown {
  if (err instanceof sdk.AuthenticationError) return message('errAuth');
  if (err instanceof sdk.NotFoundError) return message('errModel', { model });
  if (err instanceof sdk.PermissionDeniedError) return message('errPermission', { message: err.message });
  if (err instanceof sdk.RateLimitError) return message('errRateLimit', { message: err.message });
  if (err instanceof sdk.BadRequestError) return message('errBadRequest', { message: err.message });
  if (err instanceof sdk.APIUserAbortError) return message('errAborted');
  if (err instanceof sdk.APIConnectionError) return message('errConnection', { vendor, message: err.message });
  return err;
}
