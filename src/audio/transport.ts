// Playback clock. While playing, the audio hardware is the master clock (via
// getOutputTimestamp, i.e. what is audible right now) and the picture follows it.

export class Transport {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAt = 0;
  private offset = 0;
  playing = false;
  duration = 0;
  onChange: (() => void) | null = null;

  private audioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private audibleTime(): number {
    const ctx = this.ctx!;
    const ts = ctx.getOutputTimestamp();
    if (!ts.contextTime || !ts.performanceTime) return ctx.currentTime;
    return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  }

  time(): number {
    if (!this.playing) return this.offset;
    const t = this.offset + Math.max(0, this.audibleTime() - this.startedAt);
    if (t >= this.duration) {
      this.stopSource();
      this.playing = false;
      this.offset = this.duration;
      this.onChange?.();
      return this.duration;
    }
    return t;
  }

  async play(): Promise<void> {
    const ctx = this.audioContext();
    await ctx.resume();
    if (this.offset >= this.duration - 0.05) this.offset = 0;
    this.startSource();
    this.playing = true;
    this.onChange?.();
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.time();
    this.stopSource();
    this.playing = false;
    this.onChange?.();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  seek(t: number): void {
    const target = Math.min(this.duration, Math.max(0, t));
    if (this.playing) {
      this.stopSource();
      this.offset = target;
      this.startSource();
    } else {
      this.offset = target;
    }
  }

  setBuffer(buffer: AudioBuffer | null): void {
    const t = this.time();
    this.stopSource();
    this.buffer = buffer;
    this.offset = t;
    if (this.playing) this.startSource();
  }

  setDuration(d: number): void {
    this.duration = d;
    if (this.offset > d) this.offset = d;
  }

  dispose(): void {
    this.stopSource();
    void this.ctx?.close();
    this.ctx = null;
  }

  private startSource() {
    const ctx = this.audioContext();
    this.startedAt = ctx.currentTime;
    if (!this.buffer) return;
    const s = ctx.createBufferSource();
    s.buffer = this.buffer;
    s.connect(this.out!);
    s.start(ctx.currentTime, Math.min(this.offset, this.buffer.duration));
    this.src = s;
  }

  private stopSource() {
    if (!this.src) return;
    try {
      this.src.stop();
    } catch {
      // already stopped
    }
    this.src.disconnect();
    this.src = null;
  }
}
