class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public playGunshot(options: { suppressed: boolean; heavy?: boolean; enemy?: boolean }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    const volume = options.enemy ? 0.16 : options.suppressed ? 0.24 : options.heavy ? 0.42 : 0.34;
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    // Ballistic crack / transient
    const noiseDur = options.suppressed ? 0.08 : options.heavy ? 0.22 : 0.14;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, noiseDur);

    const filter = ctx.createBiquadFilter();
    filter.type = options.suppressed ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(
      options.suppressed ? 1600 : options.heavy ? 2400 : 3200,
      now
    );
    filter.frequency.exponentialRampToValueAtTime(
      options.suppressed ? 450 : 280,
      now + noiseDur
    );

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + noiseDur);

    // Chamber punch oscillator
    const osc = ctx.createOscillator();
    osc.type = options.suppressed ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(options.heavy ? 130 : options.suppressed ? 190 : 165, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.075);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(options.suppressed ? 0.35 : 0.75, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playHitmarker(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1480 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2100 : 520, now + 0.055);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(headshot ? 0.25 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.28, 0.62].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 1 ? 520 : 340, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.04);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.65);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.62);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.65);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.15);
    });
  }
}

export const soundEngine = new TacticalSoundEngine();
