import { useEffect, useRef, useState } from 'react';
import { parseDataset, type ResearchRequest, type ServerStatus } from '../../shared/dataset.ts';
import { getStatus } from '../lib/api.ts';
import { useLang, useT } from '../lib/i18n.ts';
import { getKey, isRemembered, setKey } from '../lib/keys.ts';
import { newProject, type Project } from '../lib/project.ts';
import { deleteProject, listProjects, type ProjectMeta } from '../lib/store.ts';
import { LangSwitch } from './LangSwitch.tsx';

export type ResearchVia = 'cli' | 'api';

export const REPO_URL = 'https://github.com/moinsen-dev/StatisticVideoGenerator';

type Example = { file: string; title: string; subtitle: string; language: 'de' | 'en'; bars: number; icons: string[] };

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
  onStart: (req: ResearchRequest, via: ResearchVia) => void;
  onOpen: (id: string) => void;
  onImport: (project: Project) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'de' | 'en'>(lang);
  const [bars, setBars] = useState(10);
  const [depth, setDepth] = useState<'fast' | 'thorough'>('fast');
  const [status, setStatus] = useState<ServerStatus | null | undefined>(undefined);
  const [via, setVia] = useState<ResearchVia>('api');
  const [apiKey, setApiKey] = useState(() => getKey('anthropic'));
  const [remember, setRemember] = useState(() => isRemembered('anthropic') || !getKey('anthropic'));
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getStatus().then((s) => {
      setStatus(s);
      if (s?.claude.available && s.claude.loggedIn) setVia('cli');
    });
    void listProjects().then(setProjects);
    fetch('/examples/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setExamples, () => setExamples([]));
  }, []);

  const cliReady = Boolean(status?.claude.available && status.claude.loggedIn);
  const keyReady = apiKey.trim().startsWith('sk-');
  const canStart = topic.trim().length >= 3 && (via === 'cli' ? cliReady : keyReady);

  const openExample = async (ex: Example) => {
    const res = await fetch(`/examples/${ex.file}`);
    const dataset = parseDataset(await res.json());
    props.onImport(newProject(ex.title, dataset, null, ex.bars));
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
      <header className="brand">
        <span className="brand-mark" aria-hidden>
          <i style={{ height: '55%' }} />
          <i style={{ height: '100%' }} />
          <i style={{ height: '75%' }} />
        </span>
        <span className="brand-name">StatRace</span>
        <span className="brand-tag">{t('tagline')}</span>
        <span className="spacer" />
        <LangSwitch />
      </header>

      <main className="home-main">
        <h1>{t('heroTitle')}</h1>
        <p className="lead">{t('heroLead')}</p>

        <form
          className="topic-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canStart) return;
            if (via === 'api') setKey('anthropic', apiKey, remember);
            props.onStart({ topic: topic.trim(), language, bars, depth }, via);
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
              {cliReady && (
                <div className="seg" role="radiogroup" aria-label={t('via')}>
                  <button type="button" className={via === 'cli' ? 'on' : ''} onClick={() => setVia('cli')}>
                    {t('viaCli')}
                  </button>
                  <button type="button" className={via === 'api' ? 'on' : ''} onClick={() => setVia('api')}>
                    {t('viaApi')}
                  </button>
                </div>
              )}
              {via === 'api' && (
                <div className="key-field">
                  <label className="field">
                    <span className="label">
                      {t('keyLabel')}
                      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                        {t('keyCreate')} ↗
                      </a>
                    </span>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-…"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    {t('keyRemember')}
                  </label>
                  <p className="hint">{t('keyHint')}</p>
                </div>
              )}
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
                <option value="fast">{t('depthFast')}</option>
                <option value="thorough">{t('depthThorough')}</option>
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
                  <button type="button" className="example" onClick={() => void openExample(ex)}>
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
              {projects.map((p) => (
                <li key={p.id}>
                  <button type="button" className="project" onClick={() => props.onOpen(p.id)}>
                    <strong>{p.title}</strong>
                    <span>{p.topic}</span>
                    <time>
                      {new Date(p.updatedAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('delete')}
                    aria-label={`${p.title}: ${t('delete')}`}
                    onClick={async () => {
                      if (!confirm(t('deleteConfirm', { title: p.title }))) return;
                      await deleteProject(p.id);
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
      </footer>
    </div>
  );
}
