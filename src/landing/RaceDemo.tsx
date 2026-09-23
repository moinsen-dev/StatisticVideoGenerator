import { useEffect, useRef, useState } from 'react';
import { buildModel, defaultDuration, type RaceModel } from '../engine/model.ts';
import { FRAME, Renderer, type Format } from '../engine/renderer.ts';
import { loadExample, type Example } from '../lib/examples.ts';
import { useT } from '../lib/i18n.ts';

// The hero plays an example through the real engine, drawn live like the studio preview.
// Portrait on phones, paused for reduced motion, and no drawing while scrolled out of view.

const START = 1.2; // the first frame is intentionally empty; open on the title card

type Scene = { renderer: Renderer; model: RaceModel };

export function RaceDemo({ example }: { example: Example }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format] = useState<Format>(() => (matchMedia('(max-width: 640px)').matches ? 'portrait' : 'landscape'));
  const [scene, setScene] = useState<Scene | null>(null);
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const position = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadExample(example).then(async (dataset) => {
      const model = buildModel(dataset, defaultDuration(dataset), example.bars);
      const renderer = await Renderer.create(model, format);
      if (!alive) return;
      position.current = null;
      setScene({ renderer, model });
    });
    return () => {
      alive = false;
    };
  }, [example, format]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!scene || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const loop = scene.model.duration - START;
    if (!playing) {
      scene.renderer.draw(ctx, position.current ?? START + loop * 0.5);
      return;
    }
    let raf = 0;
    let visible = true;
    let last = -Infinity;
    const begin = performance.now() - ((position.current ?? START) - START) * 1000;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 32) return; // about 30 fps is plenty for a preview
      last = now;
      position.current = START + (((now - begin) / 1000) % loop);
      scene.renderer.draw(ctx, position.current);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [scene, playing]);

  const { W, H } = FRAME[format];
  const toggle = () => setPlaying((p) => !p);
  return (
    <>
      <div className={`l-screen ${format}`}>
        <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={`${example.title}: ${example.subtitle}`} onClick={toggle} />
      </div>
      <div className="l-demo-meta">
        <button type="button" className="l-toggle" onClick={toggle} aria-label={playing ? t('pause') : t('play')}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="l-live">{t('lDemoBadge')}</span>
        <span className="hint">{t('lDemoCaption')}</span>
      </div>
    </>
  );
}
