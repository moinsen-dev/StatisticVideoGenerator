import { useEffect, useRef, useState } from 'react';
import type { ResearchProgress, ResearchRequest, ResearchResult } from '../../shared/dataset.ts';
import { research } from '../lib/api.ts';

const ICON: Record<ResearchProgress['kind'], string> = { search: '🔎', fetch: '📄', note: '💬', status: '⚙️', live: '✍️' };

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ResearchView(props: { request: ResearchRequest; onDone: (r: ResearchResult) => void; onBack: () => void }) {
  const [feed, setFeed] = useState<ResearchProgress[]>([]);
  const [live, setLive] = useState<string | null>(null);
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
    research(
      props.request,
      (p) => (p.kind === 'live' ? setLive(p.text) : setFeed((f) => [...f, p])),
      ac.signal,
    )
      .then((r) => onDone.current(r))
      .catch((e: Error) => {
        if (!ac.signal.aborted) setError(e.message);
      })
      .finally(() => clearInterval(tick));
    return () => {
      ac.abort();
      clearInterval(tick);
    };
  }, [props.request, attempt]);

  const searches = feed.filter((f) => f.kind === 'search').length;
  const fetches = feed.filter((f) => f.kind === 'fetch').length;

  return (
    <div className="research">
      <div className="research-card">
        <p className="eyebrow">{error ? 'Recherche fehlgeschlagen' : 'Claude recherchiert'}</p>
        <h1>{props.request.topic}</h1>
        {!error && (
          <div className="research-meter" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
        )}
        <p className="research-stats">
          {mmss(elapsed)} · {searches} Suchen · {fetches} Seiten gelesen
          {!error && <> · meist 2–5 Minuten</>}
        </p>
        {live && !error && <p className="research-live">✍️ {live}</p>}
        <ol className="feed">
          {feed.map((f, i) => (
            <li key={i} className={`feed-${f.kind}`}>
              <span className="feed-icon" aria-hidden>
                {ICON[f.kind]}
              </span>
              <span className="feed-text">{f.text}</span>
              <time>{mmss(f.at)}</time>
            </li>
          ))}
        </ol>
        {error && <p className="error">{error}</p>}
        <div className="research-actions">
          <button type="button" className="ghost" onClick={props.onBack}>
            {error ? 'Zurück' : 'Abbrechen'}
          </button>
          {error && (
            <button type="button" className="primary" onClick={() => setAttempt((a) => a + 1)}>
              Nochmal versuchen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
