import { useEffect, useState } from 'react';
import { entryUrl, listGallery, reportGalleryItem, type GalleryEntry } from '../lib/gallery.ts';
import { useT } from '../lib/i18n.ts';

/** Approved gallery entries as cards, each with a report form (notice and action). Renders nothing
 *  where the gallery API is missing. */
export function GalleryList({ heading, className = '' }: { heading: 'h2' | 'h3'; className?: string }) {
  const t = useT();
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [reporting, setReporting] = useState<GalleryEntry | null>(null);

  useEffect(() => {
    void listGallery().then(setEntries);
  }, []);

  if (entries === null) return null;
  const Heading = heading;
  return (
    <section id="gallery" className={`examples gallery ${className}`}>
      <Heading>{t('galleryTitle')}</Heading>
      <p className="hint">{t('galleryLead')}</p>
      {entries.length === 0 ? (
        <p className="muted">{t('galleryEmpty')}</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <a className="example" href={`/app#g=${entry.id}`}>
                <span className="example-icons" aria-hidden>
                  {entry.icons.join(' ')}
                </span>
                <strong>{entry.title}</strong>
                <span>{entry.subtitle}</span>
                <span className="ai-label">{t('galleryLabel')}</span>
                <em>{entry.language.toUpperCase()}</em>
              </a>
              <button type="button" className="link report-link" onClick={() => setReporting(entry)}>
                {t('galleryReport')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {reporting && <ReportDialog entry={reporting} onClose={() => setReporting(null)} />}
    </section>
  );
}

/** Notice form after DSA Art. 16(2): reasons, the exact location, name and email (not needed for
 *  child sexual abuse material), and a statement of good faith. */
export function ReportDialog({ entry, onClose }: { entry: { id: string; title: string }; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [childAbuse, setChildAbuse] = useState(false);
  const [goodFaith, setGoodFaith] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const complete =
    reason.trim().length >= 10 && goodFaith && (childAbuse || (name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())));

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await reportGalleryItem(entry.id, { reason: reason.trim(), name: name.trim(), email: email.trim(), childAbuse, goodFaith: true });
      setState('sent');
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('reportTitle')} onClick={(e) => e.stopPropagation()}>
        <h3>{t('reportTitle')}</h3>
        <p className="hint">{t('reportLead')}</p>
        {state === 'sent' ? (
          <p className="good">{t('reportThanks')}</p>
        ) : (
          <>
            <p className="hint">
              {t('reportLocation')}: <strong>{entry.title}</strong> · {entryUrl(entry.id)}
            </p>
            <label className="field">
              <span className="label">{t('reportReason')}</span>
              <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="grid2">
              <label className="field">
                <span className="label">{t('reportName')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={childAbuse} />
              </label>
              <label className="field">
                <span className="label">{t('reportEmail')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={childAbuse} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={childAbuse} onChange={(e) => setChildAbuse(e.target.checked)} />
              {t('reportChildAbuse')}
            </label>
            <label className="check">
              <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
              {t('reportGoodFaith')}
            </label>
            {error && <p className="error">{error}</p>}
          </>
        )}
        <div className="row-actions">
          {state !== 'sent' && (
            <button type="button" className="primary" disabled={!complete || state === 'sending'} onClick={() => void send()}>
              {t('reportSend')}
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            {state === 'sent' ? t('close') : t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
