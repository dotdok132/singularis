// SINGULARIS — Procedural Web Audio Synthesizer & Adaptive Cyber-Soundtrack
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.initialized = false;
      this.musicTimer = null;
      this.step = 0;
      this.intensity = 0.25; // 0..1 combat intensity
      this.timeScale = 1.0;  // 0.25..1.0 bullet-time coupling
      this.noiseBuffer = null;
      this.playingMusic = false;
      this.musicLevel = 0.6;
      this.sfxLevel = 0.85;
      this.bossActive = false;
      this.lastPickupTime = 0;
    }

    init() {
      if (this.initialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.initialized = true;

      // Master dynamics compressor to prevent clipping during huge combos
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0.0001 : 0.52;

      // Global low-pass filter coupled to Bullet-Time!
      this.chronoFilter = this.ctx.createBiquadFilter();
      this.chronoFilter.type = 'lowpass';
      this.chronoFilter.frequency.value = 18500;
      this.chronoFilter.Q.value = 1.1;

      // Lush stereo feedback delay for space ambience
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.23;
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.28;
      this.delayWet = this.ctx.createGain();
      this.delayWet.gain.value = 0.22;

      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.delayWet);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxLevel;
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicLevel * 0.7;

      this.sfxBus.connect(this.chronoFilter);
      this.musicBus.connect(this.chronoFilter);
      this.musicBus.connect(this.delay);
      this.sfxBus.connect(this.delay);
      this.delayWet.connect(this.chronoFilter);

      this.chronoFilter.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 1.5s white noise buffer for crisp explosions & percussion
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr * 1.5, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.startMusic();
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.initialized && this.masterGain) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.52, now, 0.04);
      }
      return this.muted;
    }

    setMusicVolume(norm) {
      const v = Math.max(0, Math.min(1, Number(norm) || 0));
      this.musicLevel = v;
      if (this.initialized && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(v * 0.7, this.ctx.currentTime, 0.03);
      }
    }

    setSfxVolume(norm) {
      const v = Math.max(0, Math.min(1, Number(norm) || 0));
      this.sfxLevel = v;
      if (this.initialized && this.sfxBus) {
        this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
      }
    }

    setChronoState(timeScale, combatIntensity, bossActive = false) {
      this.timeScale = timeScale;
      this.intensity = Math.max(0, Math.min(1, combatIntensity));
      this.bossActive = !!bossActive;
      if (!this.initialized || !this.chronoFilter) return;
      const now = this.ctx.currentTime;
      // Sweep lowpass down into warm underwater sub-realm during Bullet-Time
      const targetFreq = timeScale < 0.65 ? 950 + timeScale * 1800 : 18500;
      this.chronoFilter.frequency.setTargetAtTime(targetFreq, now, 0.06);
    }

    midiToFreq(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    startMusic() {
      if (this.playingMusic || !this.initialized) return;
      this.playingMusic = true;

      // D Phrygian / Harmonic dark sci-fi progression (shifts during Boss Waves!)
      const normalRoots = [38, 38, 41, 43, 38, 38, 46, 45]; // D2, D2, F2, G2, D2, D2, Bb2, A2
      const bossRoots = [38, 38, 44, 43, 38, 41, 46, 45];   // D2, D2, Ab2, G2, D2, F2, Bb2, A2
      const arpIntervals = [0, 3, 7, 12, 7, 10, 14, 15];

      const tick = () => {
        if (!this.playingMusic) return;
        if (this.ctx && this.ctx.state === 'running' && !this.muted) {
          this.playMusicStep(this.step, this.bossActive ? bossRoots : normalRoots, arpIntervals);
          this.step = (this.step + 1) % 64;
        }
        // Tempo accelerates slightly during Boss fights and stretches subtly during bullet-time
        const baseStepMs = this.bossActive ? 106 : 118;
        const stretchedMs = this.timeScale < 0.7 ? baseStepMs * 1.45 : baseStepMs;
        this.musicTimer = setTimeout(tick, stretchedMs);
      };
      tick();
    }

    playMusicStep(step, bassRoots, arpIntervals) {
      const now = this.ctx.currentTime;
      const bar = Math.floor(step / 8) % bassRoots.length;
      const sub = step % 8;
      const root = bassRoots[bar];

      // Driving pulsing synthwave/cyber sub-bass on 8ths + offbeat
      if (sub % 2 === 0 || (this.intensity > 0.45 && sub === 7)) {
        const osc = this.ctx.createOscillator();
        const filt = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        const note = sub === 6 ? root + 12 : root;
        osc.frequency.setValueAtTime(this.midiToFreq(note), now);

        filt.type = 'lowpass';
        const cutoff = 190 + this.intensity * 480;
        filt.frequency.setValueAtTime(cutoff * 1.8, now);
        filt.frequency.exponentialRampToValueAtTime(cutoff * 0.55, now + 0.16);
        filt.Q.value = 4.2;

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.24, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        osc.connect(filt);
        filt.connect(g);
        g.connect(this.musicBus);
        osc.start(now);
        osc.stop(now + 0.2);
      }

      // Crystalline quantum arpeggiator
      if (step % 2 === 0 || (this.intensity > 0.55 && step % 3 === 0)) {
        const arpMidi = root + 24 + arpIntervals[(step + bar * 3) % arpIntervals.length];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.midiToFreq(arpMidi), now);

        const vol = 0.06 + this.intensity * 0.075;
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

        osc.connect(g);
        g.connect(this.musicBus);
        osc.start(now);
        osc.stop(now + 0.19);
      }

      // Kick drum on 0, 4
      if (sub === 0 || (sub === 4 && this.intensity > 0.2)) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(135, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.12);
        g.gain.setValueAtTime(0.38, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(g);
        g.connect(this.musicBus);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      // Crisp hi-hat & snare when intensity > 0.3
      if (this.intensity > 0.3 && sub === 4 && step % 16 === 12) {
        this.triggerNoise(0.11, 1400, 'bandpass', 0.16, this.musicBus);
      } else if (this.intensity > 0.25 && sub % 2 === 1) {
        this.triggerNoise(0.035, 7500, 'highpass', 0.055, this.musicBus);
      }
    }

    triggerNoise(duration, freq, filterType = 'bandpass', gainVal = 0.2, dest = null) {
      if (!this.initialized || this.muted || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.setValueAtTime(freq, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gainVal, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(filt);
      filt.connect(g);
      g.connect(dest || this.sfxBus);
      src.start(now);
      src.stop(now + duration + 0.01);
    }

    playShoot(isRail = false) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = isRail ? 'sawtooth' : 'triangle';
      const startF = isRail ? 980 : 720 + Math.random() * 90;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + (isRail ? 0.14 : 0.085));
      g.gain.setValueAtTime(isRail ? 0.22 : 0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isRail ? 0.15 : 0.09));
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    playSlingshot() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(1680, now + 0.16);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    playWellSpawn(isRepulsor = false) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      if (isRepulsor) {
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.28);
      } else {
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(46, now + 0.34);
      }
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.38);
    }

    playExplosion(scale = 1.0) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const dur = Math.min(0.65, 0.18 + scale * 0.18);
      this.triggerNoise(dur, Math.max(180, 900 - scale * 220), 'lowpass', Math.min(0.42, 0.18 * scale));

      const sub = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110 * Math.min(1.4, scale), now);
      sub.frequency.exponentialRampToValueAtTime(28, now + dur);
      g.gain.setValueAtTime(Math.min(0.4, 0.22 * scale), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      sub.connect(g);
      g.connect(this.sfxBus);
      sub.start(now);
      sub.stop(now + dur + 0.02);
    }

    playDeflect() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1250, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.06);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playRewind() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const notes = [310, 465, 620, 930];
      notes.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        const t0 = now + idx * 0.055;
        osc.frequency.setValueAtTime(f * 0.6, t0);
        osc.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + 0.18);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.14, t0 + 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.23);
      });
    }

    playLevelUp() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const chord = [62, 65, 69, 74, 77]; // D minor 9th shimmer
      chord.forEach((midi, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.055;
        osc.frequency.setValueAtTime(this.midiToFreq(midi), t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.16, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.56);
      });
    }

    playBossAlarm() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        const t0 = now + i * 0.28;
        osc.frequency.setValueAtTime(185, t0);
        osc.frequency.linearRampToValueAtTime(92, t0 + 0.24);
        g.gain.setValueAtTime(0.24, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.27);
      }
    }

    playPickup(combo = 1.0) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastPickupTime < 0.045) return;
      this.lastPickupTime = now;

      const scale = [74, 77, 79, 81, 86, 89]; // D minor pentatonic crystal shimmer
      const idx = Math.min(scale.length - 1, Math.floor((combo - 1) * 0.85 + Math.random() * 2));
      const freq = this.midiToFreq(scale[idx]);

      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.08);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.055, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playDash() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      this.triggerNoise(0.13, 2200, 'bandpass', 0.16);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(105, now + 0.14);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    playEvolution() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const chord = [62, 66, 69, 74, 76, 81, 86]; // Majestic D Major9 / Lydian awakening
      chord.forEach((midi, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        const t0 = now + idx * 0.048;
        osc.frequency.setValueAtTime(this.midiToFreq(midi), t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.16, t0 + 0.035);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.72);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.74);
      });
    }

    playPlayerHit(shieldBroken = false) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(shieldBroken ? 190 : 125, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.2);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.23);
      if (shieldBroken) {
        this.triggerNoise(0.22, 3200, 'bandpass', 0.22);
      }
    }

    playCrit() {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(2220, now + 0.065);
      g.gain.setValueAtTime(0.075, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playComboMilestone(tier = 1) {
      if (!this.initialized || this.muted) return;
      const now = this.ctx.currentTime;
      const base = 62 + Math.min(4, tier) * 3;
      [0, 4, 7, 12].forEach((semi, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.04;
        osc.frequency.setValueAtTime(this.midiToFreq(base + semi), t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.11, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      });
    }
  }

  SG.SoundEngine = SoundEngine;
})(window.SG);
