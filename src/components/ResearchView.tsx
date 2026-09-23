import { useEffect, useRef, useState } from 'react';
import type { ResearchProgress, ResearchRequest, ResearchResult } from '../../shared/dataset.ts';
import { useT, type MessageKey, type Translate } from '../lib/i18n.ts';
import { PROVIDERS, runResearch, type ProviderId } from '../lib/providers.ts';

const ICON: Record<ResearchProgress['kind'], string> = { search: '🔎', fetch: '📄', note: '💬', status: '⚙️', live: '✍️' };
const CODE_KEY: Record<NonNullable<ResearchProgress['code']>, MessageKey> = {
  start: 'pStart',
  assembling: 'pAssembling',
  checking: 'pChecking',
  writing: 'pWriting',
  thinking: 'pThinking',
  done: 'pDone',
};

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const label = (p: ResearchProgress, t: Translate) => (p.code ? t(CODE_KEY[p.code], p.vars) : p.text);

export function ResearchView(props: {
  request: ResearchRequest;
  provider: ProviderId;
  onDone: (r: ResearchResult) => void;
  onBack: () => void;
}) {
  const t = useT();
  const [feed, setFeed] = useState<ResearchProgress[]>([]);
  const [live, setLive] = useState<ResearchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const onDone = useRef(props.onDone);
  onDone.current = props.onDone;

  useEffect(() => {
    const ac = new AbortController();
    const started = Date.now();
    setFeed([]);
    setLive(null);
    setError(null);
    const tick = setInterval(() => setElapsed(Date.now() - started), 500);
    const onProgress = (p: ResearchProgress) => (p.kind === 'live' ? setLive(p) : setFeed((f) => [...f, p]));
    runResearch(props.provider, props.request, onProgress, ac.signal)
      .then((r) => onDone.current(r))
      .catch((e: Error) => {
        if (!ac.signal.aborted) setError(e.message);
      })
      .finally(() => clearInterval(tick));
    return () => {
      ac.abort();
      clearInterval(tick);
    };
  }, [props.request, props.provider, attempt]);

  const searches = feed.filter((f) => f.kind === 'search').length;
  const fetches = feed.filter((f) => f.kind === 'fetch').length;

  return (
    <div className="research">
      <div className="research-card">
        <p className="eyebrow">{error ? t('researchFailed') : t('researching', { name: PROVIDERS[props.provider].name })}</p>
        <h1>{props.request.topic}</h1>
        {!error && (
          <div className="research-meter" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
        )}
        <p className="research-stats">
          {t('researchStats', { time: mmss(elapsed), searches, fetches })}
          {!error && t('researchUsual')}
        </p>
        {live && !error && <p className="research-live">✍️ {label(live, t)}</p>}
        <ol className="feed">
          {feed.map((f, i) => (
            <li key={i} className={`feed-${f.kind}`}>
              <span className="feed-icon" aria-hidden>
                {ICON[f.kind]}
              </span>
              <span className="feed-text">{label(f, t)}</span>
              <time>{mmss(f.at)}</time>
            </li>
          ))}
        </ol>
        {error && <p className="error">{error}</p>}
        <div className="research-actions">
          <button type="button" className="ghost" onClick={props.onBack}>
            {error ? t('back') : t('cancel')}
          </button>
          {error && (
            <button type="button" className="primary" onClick={() => setAttempt((a) => a + 1)}>
              {t('retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
