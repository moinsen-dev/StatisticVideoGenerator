import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset } from '../../shared/dataset.ts';
import { audioPlan, buildSoundtrack } from '../audio/soundtrack.ts';
import { Transport } from '../audio/transport.ts';
import { buildModel } from '../engine/model.ts';
import { FRAME, Renderer } from '../engine/renderer.ts';
import { useT } from '../lib/i18n.ts';
import { fileSlug, type Project, type VideoSettings } from '../lib/project.ts';
import { loadAudio, saveProject } from '../lib/store.ts';
import { DataPanel } from './DataPanel.tsx';
import { LangSwitch } from './LangSwitch.tsx';
import { ExportPanel } from './ExportPanel.tsx';
import { MusicPanel } from './MusicPanel.tsx';

type Tab = 'video' | 'data' | 'music' | 'export';
const TABS = [
  ['video', 'tabVideo'],
  ['data', 'tabData'],
  ['music', 'tabMusic'],
  ['export', 'tabExport'],
] as const;

export type AudioState = { buffer: AudioBuffer | null; status: 'working' | 'ready' | 'error'; message: string | null };

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function Studio({ initial, onClose }: { initial: Project; onClose: () => void }) {
  const t = useT();
  const [project, setProject] = useState(initial);
  const [tab, setTab] = useState<Tab>('video');
  const update = useCallback(
    (fn: (p: Project) => Project) => setProject((p) => ({ ...fn(p), updatedAt: Date.now() })),
    [],
  );
  const setDataset = useCallback(
    (fn: (d: Dataset) => Dataset) => update((p) => ({ ...p, dataset: fn(p.dataset) })),
    [update],
  );
  const setSettings = useCallback(
    (patch: Partial<VideoSettings>) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    [update],
  );

  useEffect(() => {
    const h = setTimeout(() => void saveProject(project), 400);
    return () => clearTimeout(h);
  }, [project]);

  const { dataset, settings } = project;
  const model = useMemo(
    () => buildModel(dataset, settings.duration, settings.bars),
    [dataset, settings.duration, settings.bars],
  );

  const [renderer, setRenderer] = useState<Renderer | null>(null);
  useEffect(() => {
    let alive = true;
    void Renderer.create(model, settings.format).then((r) => {
      if (alive) setRenderer(r);
    });
    return () => {
      alive = false;
    };
  }, [model, settings.format]);

  // --- playback
  // Opens on the title card instead of the (intentionally empty) first frame.
  const transport = useMemo(() => {
    const t = new Transport();
    t.setDuration(Number.POSITIVE_INFINITY);
    t.seek(1.2);
    return t;
  }, []);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    transport.onChange = () => setPlaying(transport.playing);
    return () => transport.dispose();
  }, [transport]);
  useEffect(() => {
    transport.setDuration(model.duration);
    // Dev-only handle for driving the preview from the browser console / automated checks.
    if (import.meta.env.DEV) Object.assign(window, { __statrace: { transport, model } });
  }, [transport, model]);

  // --- soundtrack (debounced: sliders and edits must not render audio on every step)
  const planKey = useMemo(() => JSON.stringify(audioPlan(model)), [model]);
  const [audioVersion, setAudioVersion] = useState(0);
  const [audio, setAudio] = useState<AudioState>({ buffer: null, status: 'working', message: null });
  useEffect(() => {
    let alive = true;
    setAudio((a) => ({ ...a, status: 'working', message: null }));
    const timer = setTimeout(async () => {
      try {
        const kind = settings.musicSource === 'ai' || settings.musicSource === 'upload' ? settings.musicSource : null;
        const blob = kind ? await loadAudio(project.id, kind) : undefined;
        const buffer = await buildSoundtrack({
          plan: JSON.parse(planKey),
          source: settings.musicSource,
          spec: dataset.music,
          file: blob && kind ? { blob, key: `${project.id}:${kind}:${audioVersion}:${blob.size}` } : null,
          sfx: settings.sfx,
          musicVolume: settings.musicVolume,
          sfxVolume: settings.sfxVolume,
        });
        if (!alive) return;
        transport.setBuffer(buffer);
        setAudio({ buffer, status: 'ready', message: kind && !blob ? 'noFile' : null });
      } catch (e) {
        if (alive) setAudio({ buffer: null, status: 'error', message: (e as Error).message });
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    planKey,
    settings.musicSource,
    settings.sfx,
    settings.musicVolume,
    settings.sfxVolume,
    dataset.music,
    audioVersion,
    project.id,
    transport,
  ]);

  // --- draw loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const scrubbing = useRef(false);
  useEffect(() => {
    if (!renderer || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { alpha: false })!;
    let raf = 0;
    const frame = () => {
      const t = transport.time();
      renderer.draw(ctx, t);
      if (scrubRef.current && !scrubbing.current) scrubRef.current.value = String(t);
      if (timeRef.current) timeRef.current.textContent = `${clock(t)} / ${clock(model.duration)}`;
      if (yearRef.current) yearRef.current.textContent = String(Math.floor(model.dataTime(t)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [renderer, transport, model]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, button, [contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        transport.toggle();
      } else if (e.code === 'ArrowLeft') transport.seek(transport.time() - 3);
      else if (e.code === 'ArrowRight') transport.seek(transport.time() + 3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [transport]);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ topic: project.topic, dataset }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileSlug(dataset.title)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const { W, H } = FRAME[settings.format];
  const audioText =
    audio.status === 'working'
      ? t('audioWorking')
      : audio.status === 'error'
        ? t('audioError', { message: audio.message ?? '' })
        : audio.message === 'noFile'
          ? t('audioNoFile')
          : audio.buffer
            ? t('audioReady')
            : t('audioNone');

  return (
    <div className="studio">
      <header className="studio-bar">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            transport.pause();
            onClose();
          }}
        >
          {t('newTopic')}
        </button>
        <div className="studio-title">
          <strong>{dataset.title}</strong>
          <span>{project.topic}</span>
        </div>
        <LangSwitch />
        <button type="button" className="ghost" onClick={downloadJson}>
          {t('saveJson')}
        </button>
      </header>

      <div className="studio-body">
        <section className="stage">
          <div className="stage-frame">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className={`stage-canvas ${settings.format}`}
              onClick={() => transport.toggle()}
            />
          </div>
          <div className="transport">
            <button
              type="button"
              className="play"
              onClick={() => transport.toggle()}
              aria-label={playing ? t('pause') : t('play')}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="scrub">
              <input
                ref={scrubRef}
                type="range"
                min={0}
                max={model.duration}
                step={0.01}
                defaultValue={0}
                aria-label={t('timeline')}
                onPointerDown={() => (scrubbing.current = true)}
                onPointerUp={() => (scrubbing.current = false)}
                onInput={(e) => transport.seek(Number(e.currentTarget.value))}
              />
              <div className="scrub-marks" aria-hidden>
                {model.cards.map((c, i) => (
                  <i key={i} style={{ left: `${(c.time / model.duration) * 100}%` }} />
                ))}
              </div>
            </div>
            <span ref={timeRef} className="time">
              0:00 / {clock(model.duration)}
            </span>
            <span ref={yearRef} className="year-chip">
              {Math.floor(model.t0)}
            </span>
          </div>
          <p className={`audio-status ${audio.status}`}>{audioText}</p>
        </section>

        <aside className="panel">
          <nav className="tabs" role="tablist">
            {TABS.map(([id, labelKey]) => (
              <button
                type="button"
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {t(labelKey)}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            {tab === 'video' && (
              <VideoPanel project={project} setSettings={setSettings} maxBars={dataset.series.length} />
            )}
            {tab === 'data' && <DataPanel dataset={dataset} setDataset={setDataset} />}
            {tab === 'music' && (
              <MusicPanel
                project={project}
                duration={model.duration}
                audio={audio}
                update={update}
                setSettings={setSettings}
                setDataset={setDataset}
                onAudioChanged={() => setAudioVersion((v) => v + 1)}
              />
            )}
            {tab === 'export' && (
              <ExportPanel
                project={project}
                model={model}
                audio={audio}
                setSettings={setSettings}
                onBeforeExport={() => transport.pause()}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function VideoPanel(props: {
  project: Project;
  setSettings: (patch: Partial<VideoSettings>) => void;
  maxBars: number;
}) {
  const t = useT();
  const { settings, research } = props.project;
  return (
    <div className="stack">
      <div className="field">
        <span className="label">{t('format')}</span>
        <div className="seg">
          <button
            type="button"
            className={settings.format === 'landscape' ? 'on' : ''}
            onClick={() => props.setSettings({ format: 'landscape' })}
          >
            {t('formatLandscape')}
          </button>
          <button
            type="button"
            className={settings.format === 'portrait' ? 'on' : ''}
            onClick={() => props.setSettings({ format: 'portrait' })}
          >
            {t('formatPortrait')}
          </button>
        </div>
      </div>
      <label className="field">
        <span className="label">
          {t('length')} <b>{settings.duration} s</b>
        </span>
        <input
          type="range"
          min={20}
          max={180}
          step={1}
          value={settings.duration}
          onChange={(e) => props.setSettings({ duration: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        <span className="label">
          {t('visibleBars')} <b>{settings.bars}</b>
        </span>
        <input
          type="range"
          min={3}
          max={Math.min(15, props.maxBars)}
          step={1}
          value={settings.bars}
          onChange={(e) => props.setSettings({ bars: Number(e.target.value) })}
        />
      </label>
      <p className="hint">{t('videoHint')}</p>
      {research && (
        <p className="hint">
          {t('researchMeta', {
            model: research.model,
            searches: research.searches,
            fetches: research.fetches,
            seconds: Math.round(research.durationMs / 1000),
          })}
          {research.costUsd !== null && t('researchCost', { cost: research.costUsd.toFixed(2) })}
        </p>
      )}
    </div>
  );
}
