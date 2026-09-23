import { useEffect, useRef, useState } from 'react';
import { KEYS, MUSIC_STYLES, type Dataset, type MusicSpec } from '../../shared/dataset.ts';
import type { MusicSource } from '../audio/soundtrack.ts';
import { generateMusic, generateMusicWithKey, getStatus } from '../lib/api.ts';
import { useLang, useT, type MessageKey } from '../lib/i18n.ts';
import { getKey, isRemembered, setKey } from '../lib/keys.ts';
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

const SOURCES: { id: MusicSource; title: MessageKey; desc: MessageKey }[] = [
  { id: 'composition', title: 'srcComposition', desc: 'srcCompositionDesc' },
  { id: 'ai', title: 'srcAi', desc: 'srcAiDesc' },
  { id: 'upload', title: 'srcUpload', desc: 'srcUploadDesc' },
  { id: 'none', title: 'srcNone', desc: 'srcNoneDesc' },
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
  const t = useT();
  const lang = useLang();
  const { project, setSettings } = props;
  const { settings } = project;
  const music = project.dataset.music;
  // true: the local server holds an ElevenLabs key; false: the visitor brings their own.
  const [serverKey, setServerKey] = useState<boolean | null>(null);
  const [elevenKey, setElevenKey] = useState(() => getKey('elevenlabs'));
  const [remember, setRemember] = useState(() => isRemembered('elevenlabs') || !getKey('elevenlabs'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void getStatus().then((s) => setServerKey(Boolean(s?.elevenlabs)));
    return () => abort.current?.abort();
  }, []);

  const setMusic = (patch: Partial<MusicSpec>) => props.setDataset((d) => ({ ...d, music: { ...d.music, ...patch } }));
  const canGenerate = serverKey === true || elevenKey.trim().length > 10;

  const generate = async () => {
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    try {
      const durationMs = props.duration * 1000;
      let blob: Blob;
      if (serverKey) {
        blob = await generateMusic(music.prompt, durationMs, ac.signal);
      } else {
        setKey('elevenlabs', elevenKey, remember);
        blob = await generateMusicWithKey(elevenKey.trim(), music.prompt, durationMs, ac.signal);
      }
      await saveAudio(project.id, 'ai', blob);
      const stamp = new Date().toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
      props.update((p) => ({
        ...p,
        audio: { ...p.audio, ai: `ElevenLabs · ${stamp}` },
        settings: { ...p.settings, musicSource: 'ai' },
      }));
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
      <div className="choices" role="radiogroup" aria-label={t('musicSource')}>
        {SOURCES.map((s) => (
          <label key={s.id} className={`choice ${settings.musicSource === s.id ? 'on' : ''}`}>
            <input
              type="radio"
              name="music-source"
              checked={settings.musicSource === s.id}
              onChange={() => setSettings({ musicSource: s.id })}
            />
            <span>
              <strong>{t(s.title)}</strong>
              <small>{t(s.desc)}</small>
            </span>
          </label>
        ))}
      </div>

      {settings.musicSource === 'composition' && (
        <>
          <div className="grid2">
            <label className="field">
              <span className="label">{t('style')}</span>
              <select value={music.style} onChange={(e) => setMusic({ style: e.target.value as MusicSpec['style'] })}>
                {MUSIC_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {STYLE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{t('tempo')}</span>
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
              <span className="label">{t('key')}</span>
              <select value={music.key} onChange={(e) => setMusic({ key: e.target.value as MusicSpec['key'] })}>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{t('scale')}</span>
              <select value={music.scale} onChange={(e) => setMusic({ scale: e.target.value as MusicSpec['scale'] })}>
                <option value="major">{t('major')}</option>
                <option value="minor">{t('minor')}</option>
              </select>
            </label>
          </div>
          <p className="hint">
            {t('chordsHint', {
              chords: music.progression.join(' · '),
              motif: music.motif.map((d) => (d ? d : '–')).join(' '),
            })}
          </p>
        </>
      )}

      {settings.musicSource === 'ai' && (
        <>
          <label className="field">
            <span className="label">{t('musicPrompt')}</span>
            <textarea rows={5} value={music.prompt} onChange={(e) => setMusic({ prompt: e.target.value })} />
          </label>
          {serverKey === false && (
            <div className="key-field">
              <label className="field">
                <span className="label">
                  {t('elevenKey')}
                  <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">
                    {t('keyCreate')} ↗
                  </a>
                </span>
                <input
                  type="password"
                  value={elevenKey}
                  onChange={(e) => setElevenKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('keyRemember')}
              </label>
              <p className="hint">{t('elevenKeyHint')}</p>
            </div>
          )}
          <div className="row-actions">
            <button type="button" className="primary" disabled={busy || !canGenerate} onClick={generate}>
              {busy ? t('generating') : t('generate', { seconds: Math.round(props.duration) })}
            </button>
            {busy && (
              <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
                {t('cancel')}
              </button>
            )}
          </div>
          <p className="hint">{project.audio.ai ? t('currentTrack', { name: project.audio.ai }) : t('noTrack')}</p>
        </>
      )}

      {settings.musicSource === 'upload' && (
        <label className="field">
          <span className="label">{t('audioFile')}</span>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {project.audio.upload && <span className="hint">{t('current', { name: project.audio.upload })}</span>}
        </label>
      )}

      <label className="field">
        <span className="label">
          {t('musicVolume')} <b>{Math.round(settings.musicVolume * 100)} %</b>
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
        {t('sfx')}
      </label>
      {settings.sfx && (
        <label className="field">
          <span className="label">
            {t('sfxVolume')} <b>{Math.round(settings.sfxVolume * 100)} %</b>
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
