import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from 'mediabunny';
import type { RaceModel } from '../engine/model.ts';
import { FRAME, Renderer, type Format } from '../engine/renderer.ts';

// Frame-by-frame render into WebCodecs (H.264 + AAC) muxed by Mediabunny. Deterministic and
// independent of playback speed: every frame is drawn at its exact timestamp.

export async function exportMp4(opts: {
  model: RaceModel;
  format: Format;
  audio: AudioBuffer | null;
  fps: number;
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
}): Promise<Blob> {
  const { W, H } = FRAME[opts.format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const renderer = await Renderer.create(opts.model, opts.format);

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H });
  if (!videoCodec) throw new Error('Dieser Browser kann kein Video kodieren (WebCodecs fehlt).');
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: opts.fps });

  let audioSource: AudioBufferSource | null = null;
  if (opts.audio) {
    const codec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: opts.audio.numberOfChannels,
      sampleRate: opts.audio.sampleRate,
    });
    if (codec) {
      audioSource = new AudioBufferSource({ codec, bitrate: 192_000 });
      output.addAudioTrack(audioSource);
    }
  }

  const frames = Math.round(opts.model.duration * opts.fps);
  await output.start();
  try {
    if (audioSource && opts.audio) {
      await audioSource.add(opts.audio);
      audioSource.close();
    }
    for (let f = 0; f < frames; f++) {
      if (opts.signal.aborted) throw new DOMException('Export abgebrochen.', 'AbortError');
      renderer.draw(ctx, f / opts.fps);
      await video.add(f / opts.fps, 1 / opts.fps);
      if (f % 15 === 0) {
        opts.onProgress(f, frames);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    video.close();
    await output.finalize();
  } catch (err) {
    await output.cancel();
    throw err;
  }
  opts.onProgress(frames, frames);
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
