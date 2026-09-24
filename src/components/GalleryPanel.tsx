import { useEffect, useState } from 'react';
import type { ServerStatus } from '../../shared/dataset.ts';
import { getStatus } from '../lib/api.ts';
import { GALLERY_LICENSE, galleryStatus, paywalledSources, submitToGallery, withdrawFromGallery, type GalleryStatus } from '../lib/gallery.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { CONTACT_MAIL, termsUrl } from '../lib/links.ts';
import type { Project } from '../lib/project.ts';
import { reviewEntry, reviewerLabel, reviewProvider } from '../lib/review.ts';

/** Studio tab: the submitter's own AI reviews the project against the gallery rules; if it passes, the
 *  project goes into the public gallery at once. Shows its state and lets the submitter withdraw it. */
export function GalleryPanel(props: { project: Project; update: (fn: (p: Project) => Project) => void }) {
  const t = useT();
  const lang = useLang();
  const sub = props.project.gallery ?? null;
  const [status, setStatus] = useState<GalleryStatus | undefined>(undefined);
  const [server, setServer] = useState<ServerStatus | null | undefined>(undefined);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getStatus().then(setServer);
  }, []);

  useEffect(() => {
    setStatus(undefined);
    if (sub) void galleryStatus(sub).then(setStatus, (e: Error) => setError(e.message));
  }, [sub]);

  const reviewer = server === undefined ? null : reviewProvider(server);

  const submit = async () => {
    if (!reviewer) return;
    setBusy(true);
    setError(null);
    setRejected(null);
    try {
      const review = await reviewEntry(reviewer, { dataset: props.project.dataset, topic: props.project.topic });
      if (!review.verdict.allowed) {
        setRejected(review.verdict.reason);
        return;
      }
      // A new version replaces the old entry: withdraw first, then submit the current state.
      if (sub) await withdrawFromGallery(sub).catch(() => undefined);
      const next = await submitToGallery(props.project, review.model);
      props.update((p) => ({ ...p, gallery: next }));
      setAccepted(false);
    } catch (e) {
      const message = (e as Error).message;
      setError(message === 'limit' ? t('publishLimit') : message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!sub) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawFromGallery(sub).catch(() => undefined);
      props.update((p) => ({ ...p, gallery: null }));
    } finally {
      setBusy(false);
    }
  };

  const paywalled = paywalledSources(props.project.dataset);

  return (
    <div className="stack">
      <p className="hint">{t('publishLead')}</p>
      <details className="rules">
        <summary>{t('publishRules')}</summary>
        <ul>
          {t('publishRulesText')
            .split('\n')
            .map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          <li>
            {t('publishLicense')}{' '}
            <a href={GALLERY_LICENSE.url} target="_blank" rel="noreferrer">
              {GALLERY_LICENSE.name}
            </a>
          </li>
        </ul>
        <a href={termsUrl(lang)} target="_blank" rel="noreferrer">
          {t('publishTerms')} ↗
        </a>
      </details>
      {paywalled.length > 0 && (
        <p className="error">{t('publishPaywall', { sources: [...new Set(paywalled.map((s) => new URL(s.url).hostname))].join(', ') })}</p>
      )}

      {sub && status !== undefined && (
        <p className={`publish-state ${status?.status ?? 'gone'}`}>
          {status === null
            ? t('publishGone')
            : status.status === 'approved'
              ? t('publishApproved')
              : status.status === 'reported'
                ? t('publishReported')
                : t('publishRemoved', { reason: status.reason || t('noReason') })}{' '}
          {status?.status === 'approved' && (
            <a href={`/app#g=${sub.id}`} target="_blank" rel="noreferrer">
              {t('publishOpen')} ↗
            </a>
          )}
          {status?.status === 'removed' && (
            <>
              <br />
              {t('publishContact')} <a href={`mailto:${CONTACT_MAIL}`}>{CONTACT_MAIL}</a>
            </>
          )}
        </p>
      )}

      {server !== undefined && (
        <p className="hint">
          {reviewer ? t('publishReviewer', { ai: reviewerLabel(reviewer) }) : t('publishNeedsAi')}{' '}
          <a href="#settings">{t('settings')}</a>
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        {t('publishAccept')}
      </label>
      <div className="row-actions">
        <button
          type="button"
          className="primary"
          disabled={!accepted || busy || !reviewer || paywalled.length > 0}
          onClick={() => void submit()}
        >
          {busy ? t('publishChecking') : sub && status !== null ? t('publishResubmit') : t('publishSubmit')}
        </button>
        {sub && status !== null && (
          <button type="button" className="ghost" disabled={busy} onClick={() => void withdraw()}>
            {t('publishWithdraw')}
          </button>
        )}
      </div>
      {rejected && <p className="error">{t('publishRejected', { reason: rejected })}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
