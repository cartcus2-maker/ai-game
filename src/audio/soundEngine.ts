// Original Web Audio API Synthesizer for FIZZ-X Runner 3D

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.65;
  private musicInterval: number | null = null;
  private currentMusicMode: 'none' | 'normal' | 'chase' = 'none';
  private stepIndex: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    this.isMuted = muted;
    if (muted) {
      this.stopMusic();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sawtooth',
    gainVal: number = 0.2,
    delay: number = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const finalGain = gainVal * this.masterVolume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(finalGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(duration: number, filterFreq: number = 1200, gainVal: number = 0.15, delay: number = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  public playFootstep(isChase: boolean = false) {
    this.playNoise(0.045, isChase ? 950 : 750, 0.08);
    this.playTone(110, 55, 0.04, 'triangle', 0.07);
  }

  public playJump() {
    this.playTone(220, 640, 0.22, 'square', 0.18);
    this.playTone(330, 880, 0.18, 'sine', 0.14, 0.03);
  }

  public playLand() {
    this.playTone(140, 48, 0.1, 'triangle', 0.2);
    this.playNoise(0.07, 500, 0.12);
  }

  public playSlide() {
    this.playNoise(0.28, 1600, 0.2);
    this.playTone(320, 110, 0.24, 'sawtooth', 0.12);
  }

  public playDash() {
    this.playNoise(0.32, 2600, 0.25);
    this.playTone(180, 920, 0.28, 'sawtooth', 0.22);
    this.playTone(440, 1320, 0.25, 'square', 0.15, 0.04);
  }

  public playCanPickup() {
    // Crisp soda pop + fizzy high sparkle chime
    this.playTone(587.33, 880, 0.09, 'square', 0.2);
    this.playTone(880, 1174.66, 0.14, 'triangle', 0.22, 0.06);
    this.playNoise(0.11, 4200, 0.12, 0.03);
  }

  public playCheckpoint() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.18, 'square', 0.2, idx * 0.07);
    });
  }

  public playMinorHit() {
    this.playTone(180, 70, 0.22, 'sawtooth', 0.26);
    this.playNoise(0.18, 800, 0.22);
  }

  public playCrashDeath() {
    this.playNoise(0.55, 650, 0.35);
    this.playTone(240, 42, 0.5, 'sawtooth', 0.32);
    this.playTone(160, 35, 0.55, 'square', 0.25, 0.1);
  }

  public playChaseWarning() {
    // Urgent arcade klaxon + giant metallic rumble
    for (let i = 0; i < 3; i++) {
      this.playTone(440, 880, 0.22, 'sawtooth', 0.28, i * 0.26);
      this.playTone(220, 440, 0.22, 'square', 0.24, i * 0.26);
    }
    this.playNoise(0.6, 320, 0.3);
  }

  public playStageClear() {
    const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
    const times = [0, 0.11, 0.22, 0.33, 0.44, 0.58];
    melody.forEach((freq, i) => {
      this.playTone(freq, freq, i === 5 ? 0.45 : 0.12, 'square', 0.24, times[i]);
    });
  }

  public playTimerWarning() {
    this.playTone(880, 880, 0.08, 'square', 0.18);
  }

  public playCarHorn() {
    this.playTone(370, 370, 0.18, 'sawtooth', 0.12);
    this.playTone(440, 440, 0.22, 'sawtooth', 0.12, 0.02);
  }

  public startMusic(mode: 'normal' | 'chase') {
    if (this.isMuted) return;
    if (this.currentMusicMode === mode && this.musicInterval !== null) return;

    this.stopMusic();
    this.ensureContext();
    this.currentMusicMode = mode;
    this.stepIndex = 0;

    // Normal: 140ms per 16th note; Chase: 98ms per 16th note (faster, urgent!)
    const stepMs = mode === 'chase' ? 102 : 140;

    const normalBass = [
      110, 110, 0, 110, 130.81, 0, 146.83, 164.81,
      110, 110, 0, 110, 196.00, 0, 164.81, 146.83
    ];
    const normalLead = [
      440, 0, 523.25, 0, 659.25, 587.33, 523.25, 0,
      440, 0, 659.25, 0, 783.99, 659.25, 587.33, 523.25
    ];

    const chaseBass = [
      116.54, 116.54, 233.08, 116.54, 138.59, 138.59, 277.18, 138.59,
      155.56, 155.56, 311.13, 155.56, 174.61, 155.56, 138.59, 130.81
    ];
    const chaseLead = [
      466.16, 0, 554.37, 466.16, 622.25, 0, 554.37, 0,
      466.16, 554.37, 622.25, 698.46, 783.99, 698.46, 622.25, 554.37
    ];

    this.musicInterval = window.setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const step = this.stepIndex % 16;

      if (this.currentMusicMode === 'normal') {
        const b = normalBass[step];
        if (b > 0) {
          this.playTone(b, b * 0.98, 0.11, 'sawtooth', 0.09);
        }
        const l = normalLead[step];
        if (l > 0) {
          this.playTone(l, l, 0.1, 'square', 0.065);
        }
        // Kick on 0, 4, 8, 12; Snare on 4, 12
        if (step % 4 === 0) {
          this.playTone(120, 38, 0.09, 'sine', 0.14);
        }
        if (step % 8 === 4) {
          this.playNoise(0.08, 1400, 0.08);
        } else if (step % 2 === 1) {
          this.playNoise(0.03, 5000, 0.03);
        }
      } else if (this.currentMusicMode === 'chase') {
        const b = chaseBass[step];
        if (b > 0) {
          this.playTone(b, b * 0.96, 0.085, 'sawtooth', 0.13);
        }
        const l = chaseLead[step];
        if (l > 0) {
          this.playTone(l, l * 1.01, 0.08, 'square', 0.09);
        }
        // Heavy driving percussion + giant can rolling rumble
        if (step % 2 === 0) {
          this.playTone(145, 42, 0.08, 'triangle', 0.18);
        }
        if (step % 4 === 2) {
          this.playNoise(0.075, 1800, 0.12);
        }
        if (step % 4 === 0) {
          // Low metallic roll rumble
          this.playNoise(0.09, 260, 0.09);
        }
      }

      this.stepIndex++;
    }, stepMs);
  }

  public stopMusic() {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentMusicMode = 'none';
  }
}

export const soundEngine = new SoundEngine();
