import { useEffect, useState } from 'react';
import { entryUrl, listGallery, reportGalleryItem, type GalleryEntry } from '../lib/gallery.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { CONTACT_MAIL, termsUrl } from '../lib/links.ts';

/** Approved gallery entries as cards, each with a report form (notice and action). Renders nothing
 *  where the gallery API is missing. */
export function GalleryList({ heading, className = '' }: { heading: 'h2' | 'h3'; className?: string }) {
  const t = useT();
  const lang = useLang();
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [reporting, setReporting] = useState<GalleryEntry | null>(null);

  const load = () => void listGallery().then(setEntries);
  useEffect(load, []);

  if (entries === null) return null;
  const Heading = heading;
  return (
    <section id="gallery" className={`examples gallery ${className}`}>
      <Heading>{t('galleryTitle')}</Heading>
      <p className="hint">
        {t('galleryLead')}{' '}
        <a href={termsUrl(lang)} target="_blank" rel="noreferrer">
          {t('publishRules')}
        </a>
      </p>
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
      {reporting && (
        <ReportDialog
          entry={reporting}
          onClose={() => {
            setReporting(null);
            load(); // a removed or hidden entry leaves the list
          }}
        />
      )}
    </section>
  );
}

/** Notice form after DSA Art. 16(2): reasons, the exact location, optional name and email (only used to
 *  send confirmation and decision), and a statement of good faith. The entry is hidden at once until
 *  moinsen decides. */
export function ReportDialog({ entry, onClose }: { entry: { id: string; title: string }; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailOk = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const complete = reason.trim().length >= 10 && goodFaith && emailOk;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await reportGalleryItem(entry.id, { reason: reason.trim(), name: name.trim(), email: email.trim(), goodFaith: true });
      setSent(true);
    } catch (e) {
      const message = (e as Error).message;
      setError(message === 'limit' ? t('reportLimit') : message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('reportTitle')} onClick={(e) => e.stopPropagation()}>
        <h3>{t('reportTitle')}</h3>
        {sent ? (
          <>
            <p className="good">{t('reportPending')}</p>
            <p className="hint">
              {email.trim() && `${t('reportMailed')} `}
              {t('reportQuestions')} <a href={`mailto:${CONTACT_MAIL}`}>{CONTACT_MAIL}</a>
            </p>
          </>
        ) : (
          <>
            <p className="hint">
              {t('reportLead')}{' '}
              <a href={termsUrl(lang)} target="_blank" rel="noreferrer">
                {t('publishRules')}
              </a>
            </p>
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
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="field">
                <span className="label">{t('reportEmail')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
              {t('reportGoodFaith')}
            </label>
            {error && <p className="error">{error}</p>}
          </>
        )}
        <div className="row-actions">
          {!sent && (
            <button type="button" className="primary" disabled={!complete || sending} onClick={() => void send()}>
              {t('reportSend')}
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            {sent ? t('close') : t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
