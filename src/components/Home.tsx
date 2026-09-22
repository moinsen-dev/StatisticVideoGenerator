import { useEffect, useRef, useState } from 'react';
import { parseDataset, type ResearchRequest, type ServerStatus } from '../../shared/dataset.ts';
import { getStatus } from '../lib/api.ts';
import { newProject, type Project } from '../lib/project.ts';
import { deleteProject, listProjects, type ProjectMeta } from '../lib/store.ts';

const EXAMPLES = [
  'Smartphone-Nutzer nach Ländern, 2000 bis heute',
  'Die wertvollsten Unternehmen der Welt nach Börsenwert, 1995–2025',
  'Bevölkerungsreichste Städte der Welt, 1950 bis heute',
  'Meistabonnierte YouTube-Kanäle, 2010–2025',
  'CO₂-Ausstoß nach Ländern, 1990 bis heute',
  'Beliebteste Programmiersprachen, 2005–2025',
];

export function Home(props: {
  onStart: (req: ResearchRequest) => void;
  onOpen: (id: string) => void;
  onImport: (project: Project) => void;
}) {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'de' | 'en'>('de');
  const [bars, setBars] = useState(10);
  const [depth, setDepth] = useState<'fast' | 'thorough'>('fast');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStatus().then(setStatus, (e: Error) => setStatusError(e.message));
    void listProjects().then(setProjects);
  }, []);

  const ready = status?.claude.available && status.claude.loggedIn;
  const canStart = topic.trim().length >= 3 && ready;

  const importFile = async (file: File) => {
    setImportError(null);
    try {
      const json = JSON.parse(await file.text());
      const dataset = parseDataset(json.dataset ?? json);
      props.onImport(newProject(file.name.replace(/\.json$/i, ''), dataset, null, 10));
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
        <span className="brand-tag">KI-Statistikvideos</span>
      </header>

      <main className="home-main">
        <h1>Welche Statistik soll zum Video werden?</h1>
        <p className="lead">
          Claude recherchiert Zahlen, Ereignisse und Quellen. Daraus entsteht ein animiertes Balkenrennen mit
          Fun-Facts und Soundtrack, fertig als MP4.
        </p>

        <form
          className="topic-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (canStart) props.onStart({ topic: topic.trim(), language, bars, depth });
          }}
        >
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canStart) e.currentTarget.form?.requestSubmit();
            }}
            placeholder="z. B. Smartphone-Nutzer nach Ländern, 2000 bis heute"
            rows={3}
            autoFocus
            aria-label="Thema"
          />
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button type="button" key={ex} className="chip" onClick={() => setTopic(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <div className="topic-options">
            <label>
              Sprache
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'de' | 'en')}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              Balken
              <select value={bars} onChange={(e) => setBars(Number(e.target.value))}>
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recherche
              <select value={depth} onChange={(e) => setDepth(e.target.value as 'fast' | 'thorough')}>
                <option value="fast">Schnell · Sonnet</option>
                <option value="thorough">Gründlich · Opus</option>
              </select>
            </label>
            <button className="primary" disabled={!canStart}>
              Recherchieren &amp; Video bauen
            </button>
          </div>
        </form>

        <p className="server-status">
          {statusError && <span className="bad">Server nicht erreichbar: {statusError}</span>}
          {status && (
            <>
              <span className={ready ? 'good' : 'bad'}>
                {ready
                  ? `Recherche über dein Claude-Abo (${status.claude.subscription ?? 'angemeldet'}, CLI ${status.claude.version})`
                  : status.claude.available
                    ? 'Claude CLI nicht angemeldet – im Terminal `claude` starten und einloggen'
                    : 'Claude CLI nicht gefunden – Claude Code installieren'}
              </span>
              <span className={status.elevenlabs ? 'good' : 'muted'}>
                {status.elevenlabs ? 'ElevenLabs Music bereit' : 'ElevenLabs optional (ELEVENLABS_API_KEY)'}
              </span>
            </>
          )}
        </p>

        <section className="projects">
          <div className="projects-head">
            <h2>Deine Videos</h2>
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
              JSON importieren
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
            <p className="muted">Noch keine Projekte. Das erste entsteht aus deinem Thema oben.</p>
          ) : (
            <ul>
              {projects.map((p) => (
                <li key={p.id}>
                  <button type="button" className="project" onClick={() => props.onOpen(p.id)}>
                    <strong>{p.title}</strong>
                    <span>{p.topic}</span>
                    <time>{new Date(p.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Löschen"
                    aria-label={`${p.title} löschen`}
                    onClick={async () => {
                      if (!confirm(`„${p.title}“ löschen?`)) return;
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
    </div>
  );
}
