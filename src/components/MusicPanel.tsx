import { useEffect, useRef, useState } from 'react';
import { KEYS, MUSIC_STYLES, type Dataset, type MusicSpec } from '../../shared/dataset.ts';
import type { MusicSource } from '../audio/soundtrack.ts';
import { generateMusic, getStatus } from '../lib/api.ts';
import type { Project, VideoSettings } from '../lib/project.ts';
import { saveAudio } from '../lib/store.ts';
import type { AudioState } from './Studio.tsx';

const STYLE_LABEL: Record<string, string> = {
  synthwave: 'Synthwave',
  cinematic: 'Cinematic',
  house: 'House',
  lofi: 'Lo-Fi',
  chiptune: 'Chiptune',
};

const SOURCES: { id: MusicSource; title: string; desc: string }[] = [
  {
    id: 'composition',
    title: 'KI-Komposition',
    desc: 'Claude hat Stil, Tempo, Tonart, Akkorde und eine Melodie komponiert. Der Browser spielt sie als Synthesizer, passend zu Intro, Breakdown und Finale. Kostenlos.',
  },
  {
    id: 'ai',
    title: 'AI-Musikgenerator',
    desc: 'ElevenLabs Music erzeugt aus Claudes Prompt einen voll produzierten Instrumental-Track in exakt der Videolänge. Braucht einen bezahlten ElevenLabs-Plan.',
  },
  { id: 'upload', title: 'Eigene Datei', desc: 'MP3, WAV oder M4A, zum Beispiel aus Suno oder deiner Bibliothek. Längere Tracks werden am Ende ausgeblendet.' },
  { id: 'none', title: 'Keine Musik', desc: 'Nur Soundeffekte oder ganz ohne Ton.' },
];

export function MusicPanel(props: {
  project: Project;
  duration: number;
  audio: AudioState;
  update: (fn: (p: Project) => Project) => void;
  setSettings: (patch: Partial<VideoSettings>) => void;
  setDataset: (fn: (d: Dataset) => Dataset) => void;
  onAudioChanged: () => void;
}) {
  const { project, setSettings } = props;
  const { settings } = project;
  const music = project.dataset.music;
  const [elevenlabs, setElevenlabs] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getStatus().then((s) => setElevenlabs(s.elevenlabs), () => setElevenlabs(false));
    return () => abort.current?.abort();
  }, []);

  const setMusic = (patch: Partial<MusicSpec>) => props.setDataset((d) => ({ ...d, music: { ...d.music, ...patch } }));

  const generate = async () => {
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    try {
      const blob = await generateMusic(music.prompt, props.duration * 1000, ac.signal);
      await saveAudio(project.id, 'ai', blob);
      const label = `ElevenLabs · ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`;
      props.update((p) => ({ ...p, audio: { ...p.audio, ai: label }, settings: { ...p.settings, musicSource: 'ai' } }));
      props.onAudioChanged();
    } catch (e) {
      if (!ac.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    await saveAudio(project.id, 'upload', file);
    props.update((p) => ({ ...p, audio: { ...p.audio, upload: file.name }, settings: { ...p.settings, musicSource: 'upload' } }));
    props.onAudioChanged();
  };

  return (
    <div className="stack">
      <div className="choices" role="radiogroup" aria-label="Musikquelle">
        {SOURCES.map((s) => (
          <label key={s.id} className={`choice ${settings.musicSource === s.id ? 'on' : ''}`}>
            <input
              type="radio"
              name="music-source"
              checked={settings.musicSource === s.id}
              onChange={() => setSettings({ musicSource: s.id })}
            />
            <span>
              <strong>{s.title}</strong>
              <small>{s.desc}</small>
            </span>
          </label>
        ))}
      </div>

      {settings.musicSource === 'composition' && (
        <>
          <div className="grid2">
            <label className="field">
              <span className="label">Stil</span>
              <select value={music.style} onChange={(e) => setMusic({ style: e.target.value as MusicSpec['style'] })}>
                {MUSIC_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {STYLE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Tempo (BPM)</span>
              <input
                type="number"
                min={70}
                max={150}
                value={music.bpm}
                onChange={(e) => {
                  const bpm = Number(e.target.value);
                  if (bpm >= 70 && bpm <= 150) setMusic({ bpm });
                }}
              />
            </label>
            <label className="field">
              <span className="label">Tonart</span>
              <select value={music.key} onChange={(e) => setMusic({ key: e.target.value as MusicSpec['key'] })}>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Tongeschlecht</span>
              <select value={music.scale} onChange={(e) => setMusic({ scale: e.target.value as MusicSpec['scale'] })}>
                <option value="major">Dur</option>
                <option value="minor">Moll</option>
              </select>
            </label>
          </div>
          <p className="hint">
            Akkordstufen {music.progression.join(' · ')} · Melodie {music.motif.map((d) => (d ? d : '–')).join(' ')}
          </p>
        </>
      )}

      {settings.musicSource === 'ai' && (
        <>
          <label className="field">
            <span className="label">Prompt für den Musikgenerator</span>
            <textarea rows={5} value={music.prompt} onChange={(e) => setMusic({ prompt: e.target.value })} />
          </label>
          <div className="row-actions">
            <button type="button" className="primary" disabled={busy || !elevenlabs} onClick={generate}>
              {busy ? 'Track wird komponiert …' : `Track generieren (${Math.round(props.duration)} s)`}
            </button>
            {busy && (
              <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
                Abbrechen
              </button>
            )}
          </div>
          {elevenlabs === false && (
            <p className="hint">Kein ELEVENLABS_API_KEY auf dem Server. In `.env` eintragen und `npm run dev` neu starten.</p>
          )}
          {project.audio.ai ? <p className="hint">Aktueller Track: {project.audio.ai}</p> : <p className="hint">Noch kein Track erzeugt.</p>}
        </>
      )}

      {settings.musicSource === 'upload' && (
        <label className="field">
          <span className="label">Audiodatei</span>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {project.audio.upload && <span className="hint">Aktuell: {project.audio.upload}</span>}
        </label>
      )}

      <label className="field">
        <span className="label">
          Musik <b>{Math.round(settings.musicVolume * 100)} %</b>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.musicVolume}
          onChange={(e) => setSettings({ musicVolume: Number(e.target.value) })}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.sfx} onChange={(e) => setSettings({ sfx: e.target.checked })} />
        Soundeffekte: Start-Impact, Whoosh pro Karte, Fanfare bei neuem Platz 1
      </label>
      {settings.sfx && (
        <label className="field">
          <span className="label">
            Effekte <b>{Math.round(settings.sfxVolume * 100)} %</b>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => setSettings({ sfxVolume: Number(e.target.value) })}
          />
        </label>
      )}
      {props.audio.status === 'error' && <p className="error">{props.audio.message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
