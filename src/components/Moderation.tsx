import { useState } from 'react';
import type { Dataset } from '../../shared/dataset.ts';
import { decide, moderationQueue, type Decision, type Report, type Reviewed } from '../lib/gallery.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { Brand } from './Brand.tsx';
import { LangSwitch } from './LangSwitch.tsx';

const TOKEN = 'statrace:admin';

/** Oversight page (/app#moderate), needs the admin token. Entries appear once the submitter's own AI
 *  has approved them; reported entries are hidden and wait here for the operator's decision, which the
 *  server mails to notifiers who left an email. The latest entries can be spot-checked and removed. */
export function Moderation(props: { onOpen: (title: string, dataset: Dataset, bars: number) => void; onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN) ?? '';
    } catch {
      return '';
    }
  });
  const [queue, setQueue] = useState<{ recent: Reviewed[]; reports: Report[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setQueue(await moderationQueue(token));
      sessionStorage.setItem(TOKEN, token);
    } catch (e) {
      setQueue(null);
      setError((e as Error).message);
    }
  };

  // A removal needs a reason (the submitter sees it); so does keeping a reported entry (the notifier gets it).
  const act = async (id: string, status: 'approved' | 'removed', current: Decision['status']) => {
    const ask = status === 'removed' || current === 'reported';
    const reason = ask ? prompt(t('modReasonPrompt'), status === 'approved' ? t('modKeepReason') : '') : '';
    if (reason === null) return;
    try {
      await decide(token, id, status, reason || undefined);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const when = (ms: number) =>
    new Date(ms).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const label = (status: Decision['status']) =>
    ({ approved: t('modApproved'), removed: t('modRemoved'), reported: t('modReported') })[status];
  const actions = (id: string, status: Decision['status']) => (
    <>
      {status !== 'approved' && (
        <button type="button" className="primary small" onClick={() => void act(id, 'approved', status)}>
          {t('modApprove')}
        </button>
      )}
      {status !== 'removed' && (
        <button type="button" className="ghost small" onClick={() => void act(id, 'removed', status)}>
          {t('modRemove')}
        </button>
      )}
    </>
  );

  return (
    <div className="home">
      <header className="app-bar">
        <Brand tag={t('moderation')} />
        <span className="spacer" />
        <LangSwitch />
      </header>
      <main className="settings-main">
        <button type="button" className="ghost" onClick={props.onBack}>
          ← {t('back')}
        </button>
        <h1>{t('moderation')}</h1>
        <p className="hint">{t('modLead')}</p>
        <div className="inline-field moderation-token">
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t('modToken')} autoComplete="off" />
          <button type="button" className="primary small" disabled={!token} onClick={() => void load()}>
            {t('modLoad')}
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {queue && (
          <>
            <section className="settings-section">
              <h2>{t('modReports', { n: queue.reports.filter((r) => !r.handled).length })}</h2>
              {queue.reports.length === 0 && <p className="muted">{t('modEmpty')}</p>}
              {queue.reports.map((report) => (
                <div key={report.id} className="provider">
                  <div>
                    <strong>{report.title}</strong>
                    <p className="hint">
                      {when(report.created_at)} · {report.handled ? t('modDone') : t('modOpen')} · {label(report.status)}
                      {report.has_contact ? ` · ${t('modHasContact')}` : ''}
                    </p>
                    <p>{report.reason}</p>
                    {report.decision && <p className="hint">{report.decision}</p>}
                  </div>
                  <div className="row-actions">
                    <a className="ghost small as-button" href={`/app#g=${report.submission_id}`} target="_blank" rel="noreferrer">
                      {t('modView')}
                    </a>
                    {actions(report.submission_id, report.status)}
                  </div>
                </div>
              ))}
            </section>

            <section className="settings-section">
              <h2>{t('modRecent', { n: queue.recent.length })}</h2>
              {queue.recent.length === 0 && <p className="muted">{t('modEmpty')}</p>}
              {queue.recent.map((item) => (
                <div key={item.id} className="provider">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="hint">
                      {label(item.status)} · {item.language.toUpperCase()} · {item.model ?? '—'} ·{' '}
                      {t('modReviewedBy', { ai: item.review_model })} · {when(item.created_at)}
                    </p>
                    <p className="hint">{item.topic}</p>
                    {item.reason && <p>{item.reason}</p>}
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost small" onClick={() => props.onOpen(item.title, item.dataset, item.bars)}>
                      {t('modView')}
                    </button>
                    {actions(item.id, item.status)}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
