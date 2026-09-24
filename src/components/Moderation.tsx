import { useState } from 'react';
import type { Dataset } from '../../shared/dataset.ts';
import { decide, entryUrl, moderationQueue, paywalledSources, type Pending, type Report } from '../lib/gallery.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { Brand } from './Brand.tsx';
import { LangSwitch } from './LangSwitch.tsx';

const TOKEN = 'statrace:admin';

// DSA Art. 16(4)/(5): a notifier who left an email gets a confirmation of receipt and then the
// decision with the options for redress. The mails go out from the moderator's own mail program.
const mailto = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const receiptMail = (r: Report) =>
  mailto(
    r.contact ?? '',
    'StatRace: Ihre Meldung ist eingegangen / Your report was received',
    `Guten Tag ${r.name ?? ''},\n\nIhre Meldung zum Galerie-Eintrag „${r.title}“ (${entryUrl(r.submission_id)}) ist bei uns eingegangen. Wir prüfen sie und teilen Ihnen unsere Entscheidung mit.\n\n---\n\nHello ${r.name ?? ''},\n\nyour report about the gallery entry “${r.title}” (${entryUrl(r.submission_id)}) has been received. We are reviewing it and will let you know our decision.\n\nmoinsen · StatRace`,
  );

const decisionMail = (r: Report, removed: boolean, reason: string) =>
  mailto(
    r.contact ?? '',
    'StatRace: Entscheidung zu Ihrer Meldung / Decision on your report',
    `Guten Tag ${r.name ?? ''},\n\nwir haben Ihre Meldung zum Galerie-Eintrag „${r.title}“ geprüft. ${removed ? 'Der Eintrag wurde entfernt.' : 'Der Eintrag bleibt online.'}${reason ? ` Begründung: ${reason}` : ''}\n\nSind Sie mit der Entscheidung nicht einverstanden, antworten Sie einfach auf diese E-Mail; der Rechtsweg bleibt Ihnen unbenommen.\n\n---\n\nHello ${r.name ?? ''},\n\nwe have reviewed your report about the gallery entry “${r.title}”. ${removed ? 'The entry has been removed.' : 'The entry stays online.'}${reason ? ` Reason: ${reason}` : ''}\n\nIf you disagree with this decision, simply reply to this email; you may also seek judicial redress.\n\nmoinsen · StatRace`,
  );

/** Review page (/app#moderate): approve or reject submissions, handle reports. Needs the admin token. */
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
  const [queue, setQueue] = useState<{ pending: Pending[]; reports: Report[] } | null>(null);
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

  const act = async (id: string, status: 'approved' | 'rejected' | 'removed', askReason: boolean, report?: Report) => {
    const reason = askReason || report?.contact ? prompt(t('modReasonPrompt')) : undefined;
    if ((askReason || report?.contact) && reason === null) return;
    try {
      // Tell the notifier first: deciding deletes their name and email.
      if (report?.contact) location.href = decisionMail(report, status === 'removed', reason ?? '');
      await decide(token, id, status, reason ?? undefined);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const when = (ms: number) =>
    new Date(ms).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

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
              <h2>{t('modPending', { n: queue.pending.length })}</h2>
              {queue.pending.length === 0 && <p className="muted">{t('modEmpty')}</p>}
              {queue.pending.map((item) => (
                <div key={item.id} className="provider">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="hint">
                      {item.subtitle} · {item.language.toUpperCase()} · {item.model ?? '—'} · {when(item.created_at)}
                    </p>
                    <p className="hint">{item.topic}</p>
                    <p className="hint">{item.dataset.sources.map((s) => new URL(s.url).hostname).join(' · ')}</p>
                    {paywalledSources(item.dataset).length > 0 && <p className="error">{t('modPaywall')}</p>}
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost small" onClick={() => props.onOpen(item.title, item.dataset, item.bars)}>
                      {t('modView')}
                    </button>
                    <button type="button" className="primary small" onClick={() => void act(item.id, 'approved', false)}>
                      {t('modApprove')}
                    </button>
                    <button type="button" className="ghost small" onClick={() => void act(item.id, 'rejected', true)}>
                      {t('modReject')}
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className="settings-section">
              <h2>{t('modReports', { n: queue.reports.length })}</h2>
              {queue.reports.length === 0 && <p className="muted">{t('modEmpty')}</p>}
              {queue.reports.map((report) => (
                <div key={report.id} className="provider">
                  <div>
                    <strong>{report.title}</strong>
                    <p className="hint">
                      {when(report.created_at)} · {report.name ?? '—'} · {report.contact ?? '—'} · {report.status}
                    </p>
                    <p>{report.reason}</p>
                  </div>
                  <div className="row-actions">
                    <a className="ghost small as-button" href={`/app#g=${report.submission_id}`} target="_blank" rel="noreferrer">
                      {t('modView')}
                    </a>
                    {report.contact && (
                      <a className="ghost small as-button" href={receiptMail(report)}>
                        {t('modReceipt')}
                      </a>
                    )}
                    <button type="button" className="ghost small" onClick={() => void act(report.submission_id, 'removed', true, report)}>
                      {t('modRemove')}
                    </button>
                    <button type="button" className="ghost small" onClick={() => void act(report.submission_id, 'approved', false, report)}>
                      {t('modKeep')}
                    </button>
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
