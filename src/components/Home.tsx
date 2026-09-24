import { useEffect, useRef, useState } from 'react';
import { parseDataset, type ResearchRequest, type ServerStatus } from '../../shared/dataset.ts';
import { getStatus } from '../lib/api.ts';
import { exampleProject, listExamples, type Example } from '../lib/examples.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { moinsenUrl, privacyUrl, REPO_URL, termsUrl } from '../lib/links.ts';
import { newProject, type Project } from '../lib/project.ts';
import { getLocalConfig } from '../lib/local-model.ts';
import { availableProviders, defaultProvider, isReady, modelLabel, PROVIDERS, saveProvider, type ProviderId } from '../lib/providers.ts';
import { deleteProject, listProjects, type ProjectMeta } from '../lib/store.ts';
import { Brand } from './Brand.tsx';
import { GalleryList } from './GalleryList.tsx';
import { LangSwitch } from './LangSwitch.tsx';
import { LocalModelSetup } from './LocalModelSetup.tsx';
import { ProviderKeyField, providerTitle } from './Settings.tsx';

const TOPICS = {
  de: [
    'Smartphone-Nutzer nach Ländern, 2000 bis heute',
    'Die wertvollsten Unternehmen der Welt nach Börsenwert, 1995–2025',
    'Bevölkerungsreichste Städte der Welt, 1950 bis heute',
    'Meistabonnierte YouTube-Kanäle, 2010–2025',
    'CO₂-Ausstoß nach Ländern, 1990 bis heute',
    'Beliebteste Programmiersprachen, 2005–2025',
  ],
  en: [
    'Smartphone users by country, 2000 to today',
    'The world’s most valuable companies by market cap, 1995–2025',
    'Most populous cities in the world, 1950 to today',
    'Most subscribed YouTube channels, 2010–2025',
    'CO₂ emissions by country, 1990 to today',
    'Most popular programming languages, 2005–2025',
  ],
};

export function Home(props: {
  onStart: (req: ResearchRequest, provider: ProviderId) => void;
  onOpen: (id: string) => void;
  onImport: (project: Project) => void;
  onSettings: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'de' | 'en'>(lang);
  const [bars, setBars] = useState(10);
  const [depth, setDepth] = useState<'fast' | 'thorough'>('fast');
  const [status, setStatus] = useState<ServerStatus | null | undefined>(undefined);
  const [provider, setProvider] = useState<ProviderId>(() => defaultProvider(null));
  // Key field or local setup stays open while someone edits it, even once it looks complete.
  const [setupOpen, setSetupOpen] = useState(false);
  const [, setVersion] = useState(0);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getStatus().then((s) => {
      const id = defaultProvider(s);
      setStatus(s);
      setProvider(id);
      setSetupOpen(!isReady(id, s));
    });
    void listProjects().then(setProjects);
    void listExamples().then(setExamples);
  }, []);

  const cliReady = Boolean(status?.claude.available && status.claude.loggedIn);
  const codexReady = Boolean(status?.codex.available && status.codex.loggedIn);
  const ids = availableProviders(status);
  const p = PROVIDERS[provider];
  const canStart = topic.trim().length >= 3 && isReady(provider, status);

  const choose = (id: ProviderId) => {
    setProvider(id);
    saveProvider(id);
    setSetupOpen(!isReady(id, status));
  };

  const importFile = async (file: File) => {
    setImportError(null);
    try {
      const json = JSON.parse(await file.text());
      const dataset = parseDataset(json.dataset ?? json);
      props.onImport(newProject(json.topic ?? file.name.replace(/\.json$/i, ''), dataset, null, 10));
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <div className="home">
      <header className="app-bar">
        <Brand tag={t('tagline')} />
        <span className="spacer" />
        <button type="button" className="ghost small" onClick={props.onSettings} aria-label={t('settings')}>
          ⚙<span className="wide-only"> {t('settings')}</span>
        </button>
        <LangSwitch />
      </header>

      <main className="home-main">
        <h1>{t('heroTitle')}</h1>
        <p className="lead">{t('heroLead')}</p>

        <form
          className="topic-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (canStart) props.onStart({ topic: topic.trim(), language, bars, depth }, provider);
          }}
        >
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canStart) e.currentTarget.form?.requestSubmit();
            }}
            placeholder={t('topicPlaceholder')}
            rows={3}
            autoFocus
            aria-label={t('topicLabel')}
          />
          <div className="chips">
            {TOPICS[lang].map((ex) => (
              <button type="button" key={ex} className="chip" onClick={() => setTopic(ex)}>
                {ex}
              </button>
            ))}
          </div>

          {status !== undefined && (
            <div className="via">
              <label className="field">
                <span className="label">{t('via')}</span>
                <select value={provider} onChange={(e) => choose(e.target.value as ProviderId)}>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {providerTitle(id, t)}
                    </option>
                  ))}
                </select>
              </label>
              {(p.key || provider === 'local') &&
                (setupOpen ? (
                  provider === 'local' ? (
                    <LocalModelSetup onChange={() => setVersion((v) => v + 1)} />
                  ) : (
                    <ProviderKeyField id={provider} onChange={() => setVersion((v) => v + 1)} />
                  )
                ) : (
                  <p className="hint key-ok">
                    ✓ {provider === 'local' ? getLocalConfig().model : t('keySaved')} ·{' '}
                    <button type="button" className="link" onClick={() => setSetupOpen(true)}>
                      {t('keyChange')}
                    </button>
                  </p>
                ))}
            </div>
          )}

          <div className="topic-options">
            <label>
              {t('videoLanguage')}
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'de' | 'en')}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t('bars')}
              <select value={bars} onChange={(e) => setBars(Number(e.target.value))}>
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('depth')}
              <select value={depth} onChange={(e) => setDepth(e.target.value as 'fast' | 'thorough')}>
                <option value="fast">{t('depthFast', { model: modelLabel(provider, 'fast') })}</option>
                <option value="thorough">{t('depthThorough', { model: modelLabel(provider, 'thorough') })}</option>
              </select>
            </label>
            <button className="primary" disabled={!canStart}>
              {t('start')}
            </button>
          </div>
        </form>

        {status && (
          <p className="server-status">
            <span className={cliReady ? 'good' : 'bad'}>
              {cliReady
                ? t('cliReady', { subscription: status.claude.subscription ?? '', version: status.claude.version ?? '' })
                : t('cliMissing')}
            </span>
            {codexReady && (
              <span className="good">
                {t('codexReady', { subscription: status.codex.subscription ?? '', version: status.codex.version ?? '' })}
              </span>
            )}
            {status.elevenlabs && <span className="good">{t('elevenReady')}</span>}
          </p>
        )}

        {examples.length > 0 && (
          <section className="examples">
            <h2>{t('examples')}</h2>
            <p className="hint">{t('examplesHint')}</p>
            <ul>
              {examples.map((ex) => (
                <li key={ex.file}>
                  <button type="button" className="example" onClick={() => void exampleProject(ex).then(props.onImport)}>
                    <span className="example-icons" aria-hidden>
                      {ex.icons.join(' ')}
                    </span>
                    <strong>{ex.title}</strong>
                    <span>{ex.subtitle}</span>
                    <em>{ex.language.toUpperCase()}</em>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GalleryList heading="h2" />

        <section className="projects">
          <div className="projects-head">
            <h2>{t('yourVideos')}</h2>
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
              {t('importJson')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {importError && <p className="error">{importError}</p>}
          {projects.length === 0 ? (
            <p className="muted">{t('noProjects')}</p>
          ) : (
            <ul>
              {projects.map((pr) => (
                <li key={pr.id}>
                  <button type="button" className="project" onClick={() => props.onOpen(pr.id)}>
                    <strong>{pr.title}</strong>
                    <span>{pr.topic}</span>
                    <time>
                      {new Date(pr.updatedAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('delete')}
                    aria-label={`${pr.title}: ${t('delete')}`}
                    onClick={async () => {
                      if (!confirm(t('deleteConfirm', { title: pr.title }))) return;
                      await deleteProject(pr.id);
                      setProjects(await listProjects());
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="home-footer">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {t('footer')}
        </a>
        <span>·</span>
        <a href="https://moinsen.dev" target="_blank" rel="noreferrer">
          moinsen.dev
        </a>
        <span>·</span>
        <a href={moinsenUrl(lang, 'impressum')} target="_blank" rel="noreferrer">
          {t('lImprint')}
        </a>
        <span>·</span>
        <a href={privacyUrl(lang)} target="_blank" rel="noreferrer">
          {t('privacy')}
        </a>
        <span>·</span>
        <a href={termsUrl(lang)} target="_blank" rel="noreferrer">
          {t('publishRules')}
        </a>
      </footer>
    </div>
  );
}
