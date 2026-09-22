import { useEffect, useRef, useState } from 'react';
import type { RaceModel } from '../engine/model.ts';
import { FRAME } from '../engine/renderer.ts';
import { fileSlug, type Project, type VideoSettings } from '../lib/project.ts';
import type { AudioState } from './Studio.tsx';

type Result = { url: string; size: number; seconds: number; name: string };

export function ExportPanel(props: {
  project: Project;
  model: RaceModel;
  audio: AudioState;
  setSettings: (patch: Partial<VideoSettings>) => void;
  onBeforeExport: () => void;
}) {
  const { settings, dataset } = props.project;
  const [progress, setProgress] = useState<{ done: number; total: number; started: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const { W, H } = FRAME[settings.format];

  const run = async () => {
    props.onBeforeExport();
    setError(null);
    setResult(null);
    const ac = new AbortController();
    abort.current = ac;
    const started = performance.now();
    setProgress({ done: 0, total: 1, started });
    try {
      // Mediabunny is only needed here; loading it on demand keeps the start page light.
      const { exportMp4 } = await import('../export/exportMp4.ts');
      const blob = await exportMp4({
        model: props.model,
        format: settings.format,
        audio: props.audio.buffer,
        fps: settings.fps,
        signal: ac.signal,
        onProgress: (done, total) => setProgress({ done, total, started }),
      });
      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size,
        seconds: (performance.now() - started) / 1000,
        name: `${fileSlug(dataset.title)}-${settings.format === 'landscape' ? '16x9' : '9x16'}.mp4`,
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const eta =
    progress && progress.done > 30
      ? Math.round(((performance.now() - progress.started) / progress.done) * (progress.total - progress.done) / 1000)
      : null;

  return (
    <div className="stack">
      <div className="field">
        <span className="label">Bildrate</span>
        <div className="seg">
          {([30, 60] as const).map((fps) => (
            <button
              type="button"
              key={fps}
              className={settings.fps === fps ? 'on' : ''}
              onClick={() => props.setSettings({ fps })}
              disabled={!!progress}
            >
              {fps} fps
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        MP4 · H.264 · {W}×{H} · {Math.round(props.model.duration)} s ·{' '}
        {props.audio.buffer ? 'mit Ton (AAC)' : 'ohne Ton'}. Gerendert wird Bild für Bild im Browser, unabhängig von der
        Abspielgeschwindigkeit.
      </p>

      {!progress && (
        <button type="button" className="primary" onClick={run} disabled={props.audio.status === 'working'}>
          {props.audio.status === 'working' ? 'Warte auf Soundtrack …' : 'MP4 exportieren'}
        </button>
      )}
      {progress && (
        <div className="export-progress">
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="hint">
            {pct} % · Bild {progress.done} von {progress.total}
            {eta !== null && ` · noch ca. ${eta} s`}
          </p>
          <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
            Abbrechen
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="export-result">
          <video src={result.url} controls playsInline className={settings.format} />
          <a className="primary as-button" href={result.url} download={result.name}>
            ⤓ {result.name}
          </a>
          <p className="hint">
            {(result.size / 1e6).toFixed(1)} MB · gerendert in {Math.round(result.seconds)} s
          </p>
        </div>
      )}
    </div>
  );
}
