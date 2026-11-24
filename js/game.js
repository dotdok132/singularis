// SINGULARIS — Core Game Loop, Emergent Combat Physics, Wave Director & UI Controller
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  const DIFFICULTIES = {
    easy: { label: 'Кадет', enemyScale: 0.72, dmgScale: 0.75, xpMult: 1.25, scoreMult: 0.8 },
    normal: { label: 'Архитектор', enemyScale: 1.15, dmgScale: 1.0, xpMult: 1.0, scoreMult: 1.0 },
    hard: { label: 'Сингулярность', enemyScale: 1.60, dmgScale: 1.35, xpMult: 0.9, scoreMult: 1.5 }
  };

  const QUALITY_PRESETS = {
    low: {
      label: 'Слабый ПК',
      maxDpr: 1.0,
      gridSpacing: 66,
      maxParticles: 220,
      particleScale: 0.4,
      stars: 45,
      bulletTrails: false,
      bulletGlow: false,
      nebula: 0.0,
      hudInterval: 0.1,
      minorDamageText: false
    },
    medium: {
      label: 'Баланс',
      maxDpr: 1.35,
      gridSpacing: 46,
      maxParticles: 650,
      particleScale: 0.72,
      stars: 85,
      bulletTrails: true,
      bulletGlow: true,
      nebula: 0.5,
      hudInterval: 0.065,
      minorDamageText: true
    },
    high: {
      label: 'Мощный ПК',
      maxDpr: 2.0,
      gridSpacing: 36,
      maxParticles: 1500,
      particleScale: 1.0,
      stars: 130,
      bulletTrails: true,
      bulletGlow: true,
      nebula: 1.0,
      hudInterval: 0.05,
      minorDamageText: true
    }
  };

  class Game {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.gpu = new SG.GpuRenderer(document.getElementById('gpu-canvas'));
      this.audio = new SG.SoundEngine();
      this.autopilot = new SG.TacticalAutopilot();

      this.bounds = { width: window.innerWidth, height: window.innerHeight };
      this.dpr = 1;

      this.grid = new SG.SpacetimeGrid(this.bounds.width, this.bounds.height, 46);
      this.particles = new SG.ParticleSystem(650);

      this.state = 'title'; // 'title' | 'playing' | 'upgrade' | 'paused' | 'gameover'
      this.stars = [];

      this.keys = {};
      this.mouse = {
        x: this.bounds.width * 0.6,
        y: this.bounds.height * 0.5,
        leftDown: false
      };
      this.repulsorMode = false; // [R] toggles Right-Click between Black Hole (Pull) & White Hole (Push)

      this.bestScore = Number(localStorage.getItem('singularis_best_score') || 0);
      this.bestWave = Number(localStorage.getItem('singularis_best_wave') || 1);
      this.totalKills = Number(localStorage.getItem('singularis_total_kills') || 0);
      this.settings = this.loadSettings();

      this._subModalOrigin = null;
      this._suppressResumeOnClose = false;
      this._resetConfirmTimer = null;
      this.catalogFilter = 'all';
      this.catalogQuery = '';
      this.hudTimer = 0;
      this.fpsAvg = 60;
      this.fpsTimer = 0;
      this.bgGradNormal = null;
      this.bgGradSlow = null;
      this.hitstopTimer = 0;
      this.damageFlash = 0;
      this.damageFlashColor = 'crimson';
      this.crosshairBloom = 0;
      this.comboTier = 0;
      this.maxCombo = 1.0;
      this._buildDirty = true;
      this.waveSubtitle = '';
      this._lastTouchTime = 0;
      const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      this.isTouchDevice = coarse || (typeof window !== 'undefined' && ('ontouchstart' in window) && window.innerWidth <= 900);
      this.touchInput = {
        moveX: 0,
        moveY: 0,
        firing: false,
        bulletTime: false,
        joyId: null,
        joyOriginX: 0,
        joyOriginY: 0
      };

      this.hudEls = {
        hud: document.getElementById('hud'),
        fpsBadge: document.getElementById('fps-badge'),
        barHp: document.getElementById('bar-hp'),
        valHp: document.getElementById('val-hp'),
        barShield: document.getElementById('bar-shield'),
        valShield: document.getElementById('val-shield'),
        barChrono: document.getElementById('bar-chrono'),
        barXp: document.getElementById('bar-xp'),
        score: document.getElementById('hud-score'),
        combo: document.getElementById('hud-combo'),
        wave: document.getElementById('hud-wave'),
        level: document.getElementById('hud-level'),
        dash: document.getElementById('hud-dash'),
        rewind: document.getElementById('hud-rewind'),
        detonate: document.getElementById('hud-detonate'),
        wellCd: document.getElementById('hud-well-cd'),
        buildStrip: document.getElementById('hud-build-strip'),
        aiBtn: document.getElementById('btn-hud-ai'),
        polBtn: document.getElementById('btn-hud-polarity'),
        aiBanner: document.getElementById('ai-telemetry-banner')
      };

      this.applySettings();
      this.bindEvents();
      this.resetRun(false);

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    getPreset() {
      return QUALITY_PRESETS[this.settings.quality] || QUALITY_PRESETS.medium;
    }

    loadSettings() {
      const defaults = {
        difficulty: 'normal',
        quality: 'medium',
        gpuAccel: true,
        showFps: true,
        musicVol: 60,
        sfxVol: 85,
        screenShake: true,
        trajectoryPreview: true,
        aiTelemetry: true
      };
      try {
        const raw = localStorage.getItem('singularis_settings');
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const merged = { ...defaults, ...parsed };
        if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = 'normal';
        if (!QUALITY_PRESETS[merged.quality]) merged.quality = 'medium';
        return merged;
      } catch (_) {
        return defaults;
      }
    }

    saveSettings() {
      try {
        localStorage.setItem('singularis_settings', JSON.stringify(this.settings));
      } catch (_) {
        // Ignore storage quota errors
      }
    }

    applySettings() {
      this.audio.setMusicVolume((this.settings.musicVol || 0) / 100);
      this.audio.setSfxVolume((this.settings.sfxVol || 0) / 100);
      this.autopilot.showTelemetry = !!this.settings.aiTelemetry;
      this.applyQualitySettings();
    }

    applyQualitySettings() {
      const preset = this.getPreset();
      if (document.body && document.body.classList) {
        document.body.classList.toggle('perf-low', this.settings.quality === 'low');
      }
      if (this.gpu) {
        this.gpu.setEnabled(!!this.settings.gpuAccel);
      }
      this.grid.setSpacing(preset.gridSpacing);
      this.particles.setMaxParticles(preset.maxParticles);
      this.particles.spawnScale = preset.particleScale;
      if (this.stars.length !== preset.stars) {
        this.initStars(preset.stars);
      }
      this.handleResize();
      this.updateQualityUI();
      if (this.hudEls && this.hudEls.fpsBadge) {
        this.hudEls.fpsBadge.hidden = !this.settings.showFps || this.state === 'title';
      }
    }

    clearInputs() {
      this.mouse.leftDown = false;
      this.keys = {};
      if (this.touchInput) {
        this.touchInput.moveX = 0;
        this.touchInput.moveY = 0;
        this.touchInput.firing = false;
        this.touchInput.bulletTime = false;
        this.touchInput.joyId = null;
      }
      const knob = document.getElementById('touch-joy-knob');
      if (knob) knob.style.transform = 'translate(0px, 0px)';
    }

    findNearestEnemy(x, y) {
      let best = null;
      let minD = Infinity;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < minD) { minD = d; best = e; }
      }
      return best;
    }

    bindTouchControls() {
      const joyZone = document.getElementById('touch-joy-zone');
      const joyKnob = document.getElementById('touch-joy-knob');
      const maxR = 42;

      if (joyZone && joyKnob) {
        const updateJoy = (clientX, clientY) => {
          const dx = clientX - this.touchInput.joyOriginX;
          const dy = clientY - this.touchInput.joyOriginY;
          const d = Math.hypot(dx, dy) || 1;
          const clamped = Math.min(maxR, d);
          const nx = (dx / d) * (clamped / maxR);
          const ny = (dy / d) * (clamped / maxR);
          this.touchInput.moveX = nx;
          this.touchInput.moveY = ny;
          joyKnob.style.transform = `translate(${Math.round(nx * maxR)}px, ${Math.round(ny * maxR)}px)`;
        };

        joyZone.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.audio.init();
          if (this.touchInput.joyId !== null) return;
          const t = e.changedTouches[0];
          if (!t) return;
          this.touchInput.joyId = t.identifier;
          const rect = joyZone.getBoundingClientRect();
          this.touchInput.joyOriginX = rect.left + rect.width * 0.5;
          this.touchInput.joyOriginY = rect.top + rect.height * 0.5;
          updateJoy(t.clientX, t.clientY);
        }, { passive: false });

        joyZone.addEventListener('touchmove', (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this.touchInput.joyId) {
              updateJoy(t.clientX, t.clientY);
              break;
            }
          }
        }, { passive: false });

        const endJoy = (e) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touchInput.joyId) {
              this.touchInput.joyId = null;
              this.touchInput.moveX = 0;
              this.touchInput.moveY = 0;
              joyKnob.style.transform = 'translate(0px, 0px)';
              break;
            }
          }
        };
        joyZone.addEventListener('touchend', endJoy);
        joyZone.addEventListener('touchcancel', endJoy);
      }

      const bindHold = (id, prop) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.audio.init();
          this.touchInput[prop] = true;
          el.classList.add('pressed');
        }, { passive: false });
        const rel = (e) => {
          e.preventDefault();
          this.touchInput[prop] = false;
          el.classList.remove('pressed');
        };
        el.addEventListener('touchend', rel, { passive: false });
        el.addEventListener('touchcancel', rel, { passive: false });
      };
      bindHold('touch-fire', 'firing');
      bindHold('touch-bt', 'bulletTime');

      const bindTap = (id, fn) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.audio.init();
          if (this.state === 'playing') fn();
        }, { passive: false });
      };

      bindTap('touch-dash', () => {
        this.player.triggerDash(this.touchInput.moveX, this.touchInput.moveY, this.bounds, this.particles, this.audio, this.grid, this);
      });
      bindTap('touch-well', () => {
        const target = this.findNearestEnemy(this.player.x, this.player.y);
        const wx = target ? target.x : (this.player.x + Math.cos(this.player.aimAngle) * 180);
        const wy = target ? target.y : (this.player.y + Math.sin(this.player.aimAngle) * 180);
        this.spawnGravityWell(wx, wy, this.repulsorMode);
      });
      bindTap('touch-detonate', () => this.detonateAllWells());
      bindTap('touch-rewind', () => this.player.triggerRewind(this.particles, this.audio, this.grid, this));
      bindTap('touch-polarity', () => {
        this.repulsorMode = !this.repulsorMode;
        this.updateHUD();
      });
    }

    initStars(count = 85) {
      this.stars = [];
      for (let i = 0; i < count; i++) {
        this.stars.push({
          nx: Math.random(),
          ny: Math.random(),
          size: 0.6 + Math.random() * 1.6,
          alpha: 0.18 + Math.random() * 0.55,
          twinkle: Math.random() * Math.PI * 2
        });
      }
    }

    resetRun(startImmediately = true) {
      this.player = new SG.Player(this.bounds.width * 0.5, this.bounds.height * 0.5);
      this.wells = [];
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.particles.clear();

      this.score = 0;
      this.combo = 1.0;
      this.comboTimer = 0;
      this.comboTier = 0;
      this.maxCombo = 1.0;
      this.wave = 1;
      this.waveQueue = [];
      this.waveSpawnTimer = 0;
      this.waveBannerTimer = 0;
      this.waveSubtitle = '';

      this.level = 1;
      this.xp = 0;
      this.xpNext = 55;
      this.upgradeStacks = {};
      this.evolvedUpgrades = new Set();
      this.currentChoices = [];
      this.rerolls = 2;
      this._buildDirty = true;

      this.stats = {
        kills: 0,
        slingshots: 0,
        hijacks: 0,
        annihilations: 0
      };

      this.screenShake = 0;
      this.hitstopTimer = 0;
      this.damageFlash = 0;
      this.crosshairBloom = 0;
      this.timeScale = 1.0;

      if (startImmediately) {
        this.state = 'playing';
        this.startWave(1);
        this.closeAllDialogs();
      }
      this.updateHUD();
    }

    closeAllDialogs() {
      this._suppressResumeOnClose = true;
      try {
        ['title-dialog', 'pause-dialog', 'settings-dialog', 'upgrade-dialog', 'codex-dialog', 'modules-dialog', 'gameover-dialog'].forEach(id => {
          const dlg = document.getElementById(id);
          if (dlg && dlg.open) dlg.close();
        });
      } finally {
        this._suppressResumeOnClose = false;
      }
    }

    updateDifficultyUI() {
      document.querySelectorAll('.diff-btn').forEach(btn => {
        const active = btn.dataset.diff === this.settings.difficulty;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    updateQualityUI() {
      document.querySelectorAll('.qual-btn').forEach(btn => {
        const active = btn.dataset.quality === this.settings.quality;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const sel = document.getElementById('set-quality');
      if (sel) sel.value = this.settings.quality;
      const lbl = document.getElementById('gpu-backend-label');
      if (lbl) {
        lbl.textContent = this.gpu && this.gpu.supported
          ? `${this.gpu.backend} доступен`
          : 'WebGL недоступен — 2D-резерв';
      }
    }

    syncSettingsUI() {
      const qSel = document.getElementById('set-quality');
      const gpuCb = document.getElementById('set-gpu');
      const fpsCb = document.getElementById('set-fps');
      const mSlider = document.getElementById('set-music-vol');
      const sSlider = document.getElementById('set-sfx-vol');
      const mVal = document.getElementById('val-music-vol');
      const sVal = document.getElementById('val-sfx-vol');
      const shakeCb = document.getElementById('set-shake');
      const trajCb = document.getElementById('set-trajectory');
      const telCb = document.getElementById('set-telemetry');

      if (qSel) qSel.value = this.settings.quality;
      if (gpuCb) {
        gpuCb.checked = !!this.settings.gpuAccel;
        gpuCb.disabled = !(this.gpu && this.gpu.supported);
      }
      if (fpsCb) fpsCb.checked = !!this.settings.showFps;
      if (mSlider) mSlider.value = String(this.settings.musicVol);
      if (mVal) mVal.textContent = `${this.settings.musicVol}%`;
      if (sSlider) sSlider.value = String(this.settings.sfxVol);
      if (sVal) sVal.textContent = `${this.settings.sfxVol}%`;
      if (shakeCb) shakeCb.checked = !!this.settings.screenShake;
      if (trajCb) trajCb.checked = !!this.settings.trajectoryPreview;
      if (telCb) telCb.checked = !!this.settings.aiTelemetry;
      this.updateQualityUI();
    }

    handleResize() {
      const preset = this.getPreset();
      this.bounds.width = window.innerWidth;
      this.bounds.height = window.innerHeight;
      this.dpr = Math.min(preset.maxDpr, window.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.floor(this.bounds.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(this.bounds.height * this.dpr));
      this.canvas.style.width = `${this.bounds.width}px`;
      this.canvas.style.height = `${this.bounds.height}px`;
      if (this.gpu) {
        this.gpu.resize(this.bounds.width, this.bounds.height, this.dpr);
      }
      this.grid.resize(this.bounds.width, this.bounds.height);

      // Cache 2D fallback gradients on resize so render() allocates zero gradients per frame
      const w = this.bounds.width;
      const h = this.bounds.height;
      const rad = Math.max(w, h) * 0.78;
      this.bgGradNormal = this.ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, rad);
      this.bgGradNormal.addColorStop(0, '#070d1d');
      this.bgGradNormal.addColorStop(1, '#03060f');

      this.bgGradSlow = this.ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, rad);
      this.bgGradSlow.addColorStop(0, '#0c0822');
      this.bgGradSlow.addColorStop(1, '#04030d');
    }

    bindEvents() {
      window.addEventListener('resize', () => this.handleResize());

      window.addEventListener('touchstart', () => {
        this._lastTouchTime = performance.now();
        if (!this.isTouchDevice) {
          this.isTouchDevice = true;
          this.updateHUD();
        }
      }, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          return;
        }
        if (this.isTouchDevice) {
          this.isTouchDevice = false;
          this.updateHUD();
        }
        this.keys[e.code] = true;

        // Upgrade card hotkeys 1, 2, 3, 4 and R for reroll
        if (this.state === 'upgrade') {
          if (e.code === 'Digit1' && this.currentChoices[0]) this.selectUpgrade(this.currentChoices[0]);
          if (e.code === 'Digit2' && this.currentChoices[1]) this.selectUpgrade(this.currentChoices[1]);
          if (e.code === 'Digit3' && this.currentChoices[2]) this.selectUpgrade(this.currentChoices[2]);
          if (e.code === 'Digit4' && this.currentChoices[3]) this.selectUpgrade(this.currentChoices[3]);
          if (e.code === 'KeyR') this.rerollUpgrades();
          return;
        }

        if (e.code === 'Escape' && this.state === 'playing') {
          e.preventDefault();
          this.openPauseMenu();
          return;
        }

        if (e.code === 'KeyP') {
          this.toggleAutopilot();
        } else if (e.code === 'KeyV') {
          this.settings.aiTelemetry = !this.settings.aiTelemetry;
          this.autopilot.showTelemetry = this.settings.aiTelemetry;
          this.saveSettings();
          this.updateHUD();
        } else if (e.code === 'KeyM') {
          this.toggleMute();
        } else if (e.code === 'KeyR') {
          this.repulsorMode = !this.repulsorMode;
          this.particles.addText(
            this.player.x,
            this.player.y - 26,
            this.repulsorMode ? 'РЕЖИМ: БЕЛАЯ ДЫРА (ОТТАЛКИВАНИЕ)' : 'РЕЖИМ: ЧЕРНАЯ ДЫРА (ПРИТЯЖЕНИЕ)',
            this.repulsorMode ? '#ffb838' : '#c06cff',
            1.02
          );
          this.updateHUD();
        } else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') && this.state === 'playing' && !e.repeat) {
          const moveX = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
          const moveY = (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) - (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0);
          this.player.triggerDash(moveX, moveY, this.bounds, this.particles, this.audio, this.grid, this);
        } else if (e.code === 'KeyQ' && this.state === 'playing') {
          this.player.triggerRewind(this.particles, this.audio, this.grid, this);
        } else if (e.code === 'KeyE' && this.state === 'playing') {
          this.detonateAllWells();
        } else if (e.code === 'KeyB') {
          this.toggleModulesCatalog();
        } else if (e.code === 'KeyH' || e.key === '?') {
          this.toggleCodex();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      this.canvas.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });

      this.canvas.addEventListener('mousedown', (e) => {
        this.audio.init();
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        if (this.state !== 'playing') return;

        if (e.button === 0) {
          this.mouse.leftDown = true;
        } else if (e.button === 2 || e.button === 1) {
          e.preventDefault();
          const useRepulsor = e.button === 1 || e.shiftKey || this.repulsorMode;
          this.spawnGravityWell(e.clientX, e.clientY, useRepulsor);
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.leftDown = false;
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.bindTouchControls();

      // Prevent native Esc from skipping mandatory upgrade choice, title screen, or gameover
      ['title-dialog', 'upgrade-dialog', 'gameover-dialog'].forEach(id => {
        const dlg = document.getElementById(id);
        if (dlg) {
          dlg.addEventListener('cancel', (e) => e.preventDefault());
        }
      });

      const handleSubDialogClose = () => {
        if (this._suppressResumeOnClose) return;
        const origin = this._subModalOrigin;
        this._subModalOrigin = null;
        if (origin === 'title') {
          this.state = 'title';
          this.updateTitleBest();
          this.updateDifficultyUI();
          const td = document.getElementById('title-dialog');
          if (td && !td.open) td.showModal();
        } else if (origin === 'pause') {
          this.openPauseMenu();
        } else if (origin === 'playing') {
          this.state = 'playing';
        }
      };

      const codexDlg = document.getElementById('codex-dialog');
      if (codexDlg) codexDlg.addEventListener('close', handleSubDialogClose);

      const modulesDlg = document.getElementById('modules-dialog');
      if (modulesDlg) modulesDlg.addEventListener('close', handleSubDialogClose);

      const settingsDlg = document.getElementById('settings-dialog');
      if (settingsDlg) settingsDlg.addEventListener('close', handleSubDialogClose);

      const pauseDlg = document.getElementById('pause-dialog');
      if (pauseDlg) {
        pauseDlg.addEventListener('close', () => {
          if (!this._suppressResumeOnClose && this.state === 'paused') {
            this.state = 'playing';
          }
        });
      }

      // Difficulty & Quality selector buttons
      document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const diff = btn.dataset.diff;
          if (DIFFICULTIES[diff]) {
            this.settings.difficulty = diff;
            this.saveSettings();
            this.updateDifficultyUI();
          }
        });
      });

      document.querySelectorAll('.qual-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.dataset.quality;
          if (QUALITY_PRESETS[q]) {
            this.settings.quality = q;
            this.applyQualitySettings();
            this.saveSettings();
          }
        });
      });

      // Main Menu Buttons
      document.getElementById('btn-start-play').addEventListener('click', () => {
        this.audio.init();
        this.autopilot.enabled = false;
        this.resetRun(true);
      });

      document.getElementById('btn-start-ai').addEventListener('click', () => {
        this.audio.init();
        this.autopilot.enabled = true;
        this.autopilot.showTelemetry = !!this.settings.aiTelemetry;
        this.resetRun(true);
      });

      document.getElementById('btn-open-settings-title').addEventListener('click', () => {
        this.openSettings('title');
      });

      document.getElementById('btn-open-codex-title').addEventListener('click', () => {
        this.openCodex('title');
      });

      document.getElementById('btn-open-modules-title').addEventListener('click', () => {
        this.openModulesCatalog('title');
      });

      // HUD Buttons
      document.getElementById('btn-hud-menu').addEventListener('click', () => {
        if (this.state === 'playing') this.openPauseMenu();
      });

      document.getElementById('btn-hud-ai').addEventListener('click', () => {
        this.audio.init();
        this.toggleAutopilot();
      });

      document.getElementById('btn-hud-polarity').addEventListener('click', () => {
        this.repulsorMode = !this.repulsorMode;
        this.updateHUD();
      });

      document.getElementById('btn-hud-mute').addEventListener('click', () => {
        this.audio.init();
        this.toggleMute();
      });

      document.getElementById('btn-hud-modules').addEventListener('click', () => {
        this.toggleModulesCatalog();
      });

      document.getElementById('btn-hud-codex').addEventListener('click', () => {
        this.toggleCodex();
      });

      // Pause Menu Buttons
      document.getElementById('btn-pause-resume').addEventListener('click', () => {
        this.resumeFromPause();
      });

      document.getElementById('btn-pause-restart').addEventListener('click', () => {
        this.audio.init();
        this.resetRun(true);
      });

      document.getElementById('btn-pause-settings').addEventListener('click', () => {
        this.openSettings('pause');
      });

      document.getElementById('btn-pause-modules').addEventListener('click', () => {
        this.openModulesCatalog('pause');
      });

      document.getElementById('btn-pause-codex').addEventListener('click', () => {
        this.openCodex('pause');
      });

      document.getElementById('btn-pause-mainmenu').addEventListener('click', () => {
        this.openMainMenu();
      });

      // Settings Controls
      const qSel = document.getElementById('set-quality');
      if (qSel) {
        qSel.addEventListener('change', () => {
          if (QUALITY_PRESETS[qSel.value]) {
            this.settings.quality = qSel.value;
            this.applyQualitySettings();
            this.saveSettings();
          }
        });
      }

      const gpuCb = document.getElementById('set-gpu');
      if (gpuCb) {
        gpuCb.addEventListener('change', () => {
          this.settings.gpuAccel = gpuCb.checked;
          this.applyQualitySettings();
          this.saveSettings();
        });
      }

      const fpsCb = document.getElementById('set-fps');
      if (fpsCb) {
        fpsCb.addEventListener('change', () => {
          this.settings.showFps = fpsCb.checked;
          this.applyQualitySettings();
          this.saveSettings();
        });
      }

      const mSlider = document.getElementById('set-music-vol');
      if (mSlider) {
        mSlider.addEventListener('input', () => {
          this.audio.init();
          this.settings.musicVol = Number(mSlider.value);
          this.applySettings();
          this.saveSettings();
          this.syncSettingsUI();
        });
      }

      const sSlider = document.getElementById('set-sfx-vol');
      if (sSlider) {
        sSlider.addEventListener('input', () => {
          this.audio.init();
          this.settings.sfxVol = Number(sSlider.value);
          this.applySettings();
          this.saveSettings();
          this.syncSettingsUI();
        });
      }

      const shakeCb = document.getElementById('set-shake');
      if (shakeCb) {
        shakeCb.addEventListener('change', () => {
          this.settings.screenShake = shakeCb.checked;
          this.saveSettings();
        });
      }

      const trajCb = document.getElementById('set-trajectory');
      if (trajCb) {
        trajCb.addEventListener('change', () => {
          this.settings.trajectoryPreview = trajCb.checked;
          this.saveSettings();
        });
      }

      const telCb = document.getElementById('set-telemetry');
      if (telCb) {
        telCb.addEventListener('change', () => {
          this.settings.aiTelemetry = telCb.checked;
          this.applySettings();
          this.saveSettings();
        });
      }

      document.getElementById('btn-close-settings').addEventListener('click', () => {
        const dlg = document.getElementById('settings-dialog');
        if (dlg && dlg.open) dlg.close();
      });

      const resetRecBtn = document.getElementById('btn-reset-records');
      if (resetRecBtn) {
        resetRecBtn.addEventListener('click', () => {
          if (resetRecBtn.dataset.armed !== '1') {
            resetRecBtn.dataset.armed = '1';
            resetRecBtn.textContent = 'Точно сбросить?';
            clearTimeout(this._resetConfirmTimer);
            this._resetConfirmTimer = setTimeout(() => {
              resetRecBtn.dataset.armed = '0';
              resetRecBtn.textContent = 'Сбросить рекорды';
            }, 3000);
            return;
          }
          clearTimeout(this._resetConfirmTimer);
          resetRecBtn.dataset.armed = '0';
          resetRecBtn.textContent = 'Рекорды сброшены';
          this.bestScore = 0;
          this.bestWave = 1;
          this.totalKills = 0;
          localStorage.removeItem('singularis_best_score');
          localStorage.removeItem('singularis_best_wave');
          localStorage.removeItem('singularis_total_kills');
          this.updateTitleBest();
          setTimeout(() => {
            resetRecBtn.textContent = 'Сбросить рекорды';
          }, 1600);
        });
      }

      document.getElementById('btn-close-codex').addEventListener('click', () => {
        const dlg = document.getElementById('codex-dialog');
        if (dlg && dlg.open) dlg.close();
      });

      document.getElementById('btn-close-modules').addEventListener('click', () => {
        const dlg = document.getElementById('modules-dialog');
        if (dlg && dlg.open) dlg.close();
      });

      document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.catalogFilter = btn.dataset.cat || 'all';
          this.renderModulesCatalog();
        });
      });

      const modSearch = document.getElementById('modules-search');
      if (modSearch) {
        modSearch.addEventListener('input', () => {
          this.catalogQuery = modSearch.value || '';
          this.renderModulesCatalog();
        });
      }

      const modTitleBtn = document.getElementById('btn-open-modules-title');
      if (modTitleBtn) {
        modTitleBtn.textContent = `КАТАЛОГ МОДУЛЕЙ (${SG.UPGRADES.length})`;
      }

      const rerollBtn = document.getElementById('btn-upgrade-reroll');
      if (rerollBtn) {
        rerollBtn.addEventListener('click', () => this.rerollUpgrades());
      }

      document.getElementById('btn-restart').addEventListener('click', () => {
        this.audio.init();
        this.resetRun(true);
      });

      document.getElementById('btn-restart-ai').addEventListener('click', () => {
        this.audio.init();
        this.autopilot.enabled = true;
        this.resetRun(true);
      });

      document.getElementById('btn-go-mainmenu').addEventListener('click', () => {
        this.openMainMenu();
      });

      // Open Main Menu initially
      this.updateDifficultyUI();
      this.syncSettingsUI();
      setTimeout(() => {
        const titleDlg = document.getElementById('title-dialog');
        if (titleDlg && !titleDlg.open) {
          this.updateTitleBest();
          titleDlg.showModal();
        }
      }, 40);
    }

    updateTitleBest() {
      const el = document.getElementById('title-best-record');
      if (el) {
        el.textContent = this.bestScore > 0
          ? `Рекорд: ${this.bestScore.toLocaleString('ru-RU')} очк. • Волна ${this.bestWave} • Всего уничтожено: ${this.totalKills}`
          : 'Первый запуск квантового ядра';
      }
    }

    openMainMenu() {
      this.clearInputs();
      this._subModalOrigin = null;
      this.state = 'title';
      this.closeAllDialogs();
      this.resetRun(false);
      this.updateTitleBest();
      this.updateDifficultyUI();
      const titleDlg = document.getElementById('title-dialog');
      if (titleDlg && !titleDlg.open) titleDlg.showModal();
    }

    renderPauseSummary() {
      const diff = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const summary = document.getElementById('pause-summary');
      if (summary) {
        const p = this.player;
        const m = p.mods;
        const armorPct = Math.round(Math.min(0.75, m.armor) * 100);
        const gravPct = Math.round(m.wellGravMult * 100);
        summary.textContent = `Волна ${this.wave} • Ур. ${this.level} • ${diff.label} • HP ${Math.ceil(p.hp)}/${p.maxHp} • Броня ${armorPct}% • Грав ${gravPct}%`;
      }
      const pillsEl = document.getElementById('pause-upgrades');
      if (pillsEl) {
        pillsEl.innerHTML = '';
        const entries = Object.entries(this.upgradeStacks);
        if (entries.length === 0) {
          const span = document.createElement('span');
          span.className = 'upgrade-pill';
          span.textContent = 'Модули ядра еще не выбраны';
          pillsEl.appendChild(span);
        } else {
          entries.forEach(([id, lvl]) => {
            const def = SG.UPGRADES.find(u => u.id === id);
            if (!def) return;
            const evolved = this.evolvedUpgrades && this.evolvedUpgrades.has(id);
            const span = document.createElement('span');
            span.className = `upgrade-pill${evolved ? ' evolved' : ''}`;
            span.textContent = evolved && def.evolution
              ? `[${def.icon}] ${def.evolution.title} [MAX]`
              : `[${def.icon}] ${def.title} ×${lvl}`;
            pillsEl.appendChild(span);
          });
        }
      }
    }

    openPauseMenu() {
      if (this.state !== 'playing' && this.state !== 'paused') return;
      this.clearInputs();
      this.state = 'paused';
      this.renderPauseSummary();
      const dlg = document.getElementById('pause-dialog');
      if (dlg && !dlg.open) dlg.showModal();
    }

    resumeFromPause() {
      const dlg = document.getElementById('pause-dialog');
      if (dlg && dlg.open) {
        dlg.close();
      } else {
        this.state = 'playing';
      }
    }

    openSettings(origin = 'title') {
      this.clearInputs();
      this._subModalOrigin = origin;
      if (origin === 'title' || origin === 'pause') {
        this._suppressResumeOnClose = true;
        try {
          const parentId = origin === 'title' ? 'title-dialog' : 'pause-dialog';
          const parentDlg = document.getElementById(parentId);
          if (parentDlg && parentDlg.open) parentDlg.close();
        } finally {
          this._suppressResumeOnClose = false;
        }
      }
      if (origin === 'playing') this.state = 'paused';
      this.syncSettingsUI();
      const dlg = document.getElementById('settings-dialog');
      if (dlg && !dlg.open) dlg.showModal();
    }

    toggleAutopilot() {
      this.autopilot.enabled = !this.autopilot.enabled;
      this.particles.addText(
        this.player.x,
        this.player.y - 30,
        this.autopilot.enabled ? 'ИИ-АВТОПИЛОТ АКТИВИРОВАН' : 'РУЧНОЕ УПРАВЛЕНИЕ',
        this.autopilot.enabled ? '#22ffa6' : '#00f0ff',
        1.15
      );
      this.updateHUD();
    }

    toggleMute() {
      const muted = this.audio.toggleMute();
      const btn = document.getElementById('btn-hud-mute');
      if (btn) btn.textContent = muted ? 'Звук: ВЫКЛ' : 'Звук: ВКЛ';
    }

    openSubModal(dialogId, origin = 'playing') {
      this.clearInputs();
      this._subModalOrigin = origin;
      if (origin === 'title' || origin === 'pause') {
        this._suppressResumeOnClose = true;
        try {
          const parentId = origin === 'title' ? 'title-dialog' : 'pause-dialog';
          const parentDlg = document.getElementById(parentId);
          if (parentDlg && parentDlg.open) parentDlg.close();
        } finally {
          this._suppressResumeOnClose = false;
        }
      }
      if (this.state === 'playing') this.state = 'paused';
      const dlg = document.getElementById(dialogId);
      if (dlg && !dlg.open) dlg.showModal();
    }

    openCodex(origin = 'playing') {
      this.openSubModal('codex-dialog', origin);
    }

    toggleCodex() {
      const dlg = document.getElementById('codex-dialog');
      if (!dlg) return;
      if (dlg.open) {
        dlg.close();
      } else if (this.state === 'playing') {
        this.openCodex('playing');
      }
    }

    getModuleCategory(upg) {
      if (upg.tag === 'АУРА') return 'aura';
      if (['ТАНК', 'ЗАЩИТА', 'ВАМПИРИЗМ'].includes(upg.tag)) return 'tank';
      if (['ОРБИТА', 'СИНГУЛЯРНОСТЬ', 'ОРБИТАЛЬНАЯ ФИЗИКА', 'ДЕТОНАЦИЯ [E]'].includes(upg.tag)) return 'orbit';
      if (['ОРУДИЕ', 'КОНТРАТАКА'].includes(upg.tag)) return 'weapon';
      return 'chrono';
    }

    getTagClass(upg) {
      if (upg.tag === 'АУРА') return ' tag-aura';
      if (upg.tag === 'ТАНК') return ' tag-tank';
      if (upg.tag === 'ОРБИТА') return ' tag-orbit';
      return '';
    }

    renderModulesCatalog() {
      const grid = document.getElementById('modules-catalog-grid');
      const sub = document.getElementById('modules-count-sub');
      if (!grid) return;

      document.querySelectorAll('.cat-btn').forEach(btn => {
        const active = (btn.dataset.cat || 'all') === this.catalogFilter;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const rarityLabels = {
        common: 'ОБЫЧНЫЙ',
        rare: 'РЕДКИЙ',
        epic: 'ЭПИЧЕСКИЙ',
        legendary: 'ЛЕГЕНДАРНЫЙ'
      };

      const q = (this.catalogQuery || '').trim().toLowerCase();
      const filtered = SG.UPGRADES.filter(u => {
        if (this.catalogFilter !== 'all' && this.getModuleCategory(u) !== this.catalogFilter) return false;
        if (!q) return true;
        return u.title.toLowerCase().includes(q)
          || u.desc.toLowerCase().includes(q)
          || u.tag.toLowerCase().includes(q)
          || u.icon.toLowerCase().includes(q)
          || u.id.toLowerCase().includes(q)
          || (u.evolution && (
            u.evolution.title.toLowerCase().includes(q)
            || u.evolution.perk.toLowerCase().includes(q)
          ));
      });
      const ownedCount = Object.keys(this.upgradeStacks).length;
      const evolvedCount = this.evolvedUpgrades ? this.evolvedUpgrades.size : 0;
      if (sub) {
        sub.textContent = `Показано модулей: ${filtered.length} из ${SG.UPGRADES.length} • Активно: ${ownedCount} • Эволюций: ${evolvedCount}`;
      }

      grid.innerHTML = '';
      filtered.forEach(upg => {
        const curStack = this.upgradeStacks[upg.id] || 0;
        const isEvolved = !!(this.evolvedUpgrades && this.evolvedUpgrades.has(upg.id));
        const card = document.createElement('article');
        card.className = `catalog-card rarity-${upg.rarity}${this.getTagClass(upg)}${curStack > 0 ? ' owned' : ''}${isEvolved ? ' evolved' : ''}`;
        const stackText = isEvolved
          ? 'ЭВОЛЮЦИЯ АКТИВНА [MAX]'
          : (curStack > 0 ? `АКТИВЕН: ${curStack} / ${upg.maxStacks}` : `МАКС. УРОВЕНЬ: ${upg.maxStacks}`);
        const displayTitle = (isEvolved && upg.evolution) ? upg.evolution.title : upg.title;
        const evoHtml = upg.evolution
          ? (isEvolved
            ? `<div class="upg-evo-box"><strong>ЭВОЛЮЦИЯ:</strong> ${upg.evolution.perk}</div>`
            : `<div class="upg-evo-hint">Макс. ур.: ${upg.evolution.title} — ${upg.evolution.perk}</div>`)
          : '';
        card.innerHTML = `
          <div class="upg-top">
            <span class="upg-tag">${upg.tag}</span>
            <span class="cat-rarity">${isEvolved ? 'ЭВОЛЮЦИЯ' : (rarityLabels[upg.rarity] || 'МОДУЛЬ')}</span>
          </div>
          <div class="upg-icon">${upg.icon}</div>
          <h3 class="upg-title">${displayTitle}</h3>
          <p class="upg-desc">${upg.desc}</p>
          ${evoHtml}
          <div class="upg-stacks">${stackText}</div>
        `;
        grid.appendChild(card);
      });
    }

    openModulesCatalog(origin = 'playing') {
      this.renderModulesCatalog();
      this.openSubModal('modules-dialog', origin);
    }

    toggleModulesCatalog() {
      const dlg = document.getElementById('modules-dialog');
      if (!dlg) return;
      if (dlg.open) {
        dlg.close();
      } else if (this.state === 'playing') {
        this.openModulesCatalog('playing');
      }
    }

    addScreenShake(amount) {
      if (!this.settings.screenShake) return;
      this.screenShake = Math.min(20, Math.max(this.screenShake, amount));
    }

    addHitstop(duration) {
      if (!this.settings.screenShake) return;
      this.hitstopTimer = Math.min(0.09, Math.max(this.hitstopTimer, duration));
    }

    spawnGravityWell(x, y, isRepulsor = false) {
      if (this.player.wellCooldown > 0) return false;
      this.player.wellCooldown = 1.6 * this.player.mods.wellCdMult;

      const maxW = this.player.mods.maxWells;
      if (this.wells.length >= maxW) {
        // Dissipate oldest well cleanly without free AoE explosion damage, but release trapped orbital bullets!
        const oldest = this.wells.shift();
        this.releaseOrbitalBullets(oldest);
        this.particles.addShockwave(oldest.x, oldest.y, oldest.slingshotRadius, '#9d5cff', 0.28, 1.8);
        this.particles.burst(oldest.x, oldest.y, 10, '#c06cff', 40, 140, 0.35, false);
      }
      const w = new SG.GravityWell(x, y, isRepulsor, this.player.mods);
      this.wells.push(w);
      this.audio.playWellSpawn(isRepulsor);
      this.particles.addShockwave(x, y, w.slingshotRadius * 1.15, isRepulsor ? '#ffb838' : '#c06cff', 0.38, 2.5);
      this.grid.applyRadialForce(x, y, isRepulsor ? 1200 : -1200, w.influenceRadius, isRepulsor ? 38 : 278);
      return true;
    }

    triggerThornsBlast() {
      const p = this.player;
      const m = p.mods;
      if (m.thornsLevel <= 0) return;
      const blastR = m.evoThornsRing > 0 ? 225 : 185;
      const dmg = Math.round(95 * m.thornsLevel + p.maxHp * 0.35);
      this.particles.addShockwave(p.x, p.y, blastR, '#22ffa6', 0.36, 3.2);
      this.particles.burst(p.x, p.y, 20, '#22ffa6', 80, 260, 0.45, true);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d <= blastR + e.radius) {
          e.vx += (dx / d) * 380;
          e.vy += (dy / d) * 380;
          this.damageEnemy(e, dmg, '#22ffa6', 'ШИПЫ!');
        }
      }
      if (m.evoThornsRing > 0) {
        const shardSpd = 660 * m.projSpeedMult;
        const shardDmg = Math.max(18, Math.round(dmg * 0.45));
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI * 2) / 12;
          this.spawnBullet({
            x: p.x + Math.cos(a) * 16,
            y: p.y + Math.sin(a) * 16,
            vx: Math.cos(a) * shardSpd,
            vy: Math.sin(a) * shardSpd,
            damage: shardDmg,
            radius: 4.5,
            color: '#22ffa6',
            fromPlayer: true,
            pierce: 2,
            life: 1.4
          });
        }
      }
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (!b.fromPlayer && !b.hijacked && Math.hypot(b.x - p.x, b.y - p.y) < (m.evoThornsRing > 0 ? 200 : 150)) {
          if (m.evoThornsRing > 0) {
            b.hijacked = true;
            b.vx = -b.vx * 1.65;
            b.vy = -b.vy * 1.65;
            b.color = '#22ffa6';
            b.radius = Math.max(b.radius, 5.0);
          } else {
            this.bullets.splice(i, 1);
          }
        }
      }
    }

    releaseOrbitalBullets(well) {
      if (!well) return 0;
      const aliveEnemies = this.enemies.filter(e => !e.dead);
      let count = 0;
      let targetIdx = 0;
      const isEvoOrbit = this.player.mods.evoOrbitSingularity > 0;

      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        if (b.orbitWell !== well) continue;
        count++;
        b.orbitWell = null;
        b.orbitReleased = true;
        b.fromPlayer = true;
        b.hijacked = false;
        b.slingshotBoosted = true;
        b.hitIds.clear();
        b.life = 2.6;
        b.color = '#ff77ff';
        b.radius = Math.max(b.radius, 5.5);
        const releaseMult = 1 + (this.player.mods.orbitReleaseMult || 0);
        b.damage = Math.max(12, Math.round(b.damage * (b.orbitCharge || 1.25) * releaseMult));
        b.pierce += 1 + (this.player.mods.orbitCollider > 0 ? 2 : 0) + (this.player.mods.orbitReleaseMult > 0 ? 3 : 0);
        if (isEvoOrbit) b.homing = Math.max(b.homing, 2);

        let launchAng = b.orbitAngle + (b.orbitDir || 1) * (Math.PI * 0.35);
        if (aliveEnemies.length > 0) {
          const t = aliveEnemies[targetIdx % aliveEnemies.length];
          targetIdx++;
          launchAng = SG.solveInterceptAngle(b.x, b.y, t.x, t.y, t.vx, t.vy, 900);
        }
        b.vx = Math.cos(launchAng) * 900;
        b.vy = Math.sin(launchAng) * 900;

        if (isEvoOrbit && count % 2 === 0) {
          const twinAng = launchAng + 0.14;
          this.spawnBullet({
            x: b.x,
            y: b.y,
            vx: Math.cos(twinAng) * 920,
            vy: Math.sin(twinAng) * 920,
            damage: b.damage,
            radius: b.radius,
            color: '#ffd166',
            fromPlayer: true,
            pierce: b.pierce,
            homing: 2,
            life: 2.6,
            isSplitClone: true
          });
        }
      }

      if (count > 0) {
        if (this.player.mods.orbitReleaseHeal > 0) {
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + count * this.player.mods.orbitReleaseHeal);
        }
        this.particles.addShockwave(well.x, well.y, well.slingshotRadius * 1.9, '#ff77ff', 0.42, 3.2);
        this.particles.addText(well.x, well.y - 24, `ЗАЛП ОРБИТЫ ×${count}!`, '#ff99ff', 1.22);
        this.audio.playSlingshot();
      }
      return count;
    }

    detonateAllWells() {
      if (this.wells.length === 0 || this.player.detonateCooldown > 0) return false;
      this.player.detonateCooldown = 5.5 * this.player.mods.detonateCdMult;
      const toDetonate = this.wells.slice();
      this.wells.length = 0;
      for (let i = 0; i < toDetonate.length; i++) {
        this.collapseWell(toDetonate[i], true);
      }
      return true;
    }

    collapseWell(w, manualDetonate = false) {
      this.releaseOrbitalBullets(w);
      if (manualDetonate && this.player.mods.cascadeWell > 0 && Math.random() < 0.55) {
        const mini = new SG.GravityWell(w.x, w.y, false, this.player.mods);
        mini.life = 2.5;
        mini.coreRadius *= 0.85;
        this.wells.push(mini);
      }
      const isChainEvo = manualDetonate && this.player.mods.evoSupernovaChain > 0;
      const blastRadius = w.slingshotRadius * (manualDetonate ? 2.35 : 1.75) * (isChainEvo ? 1.45 : 1.0);
      const dmg = this.player.mods.supernovaDamage * (manualDetonate ? 1.25 : 0.75) * (isChainEvo ? 1.4 : 1.0);

      this.grid.applyRadialForce(w.x, w.y, 1850, blastRadius * 1.35, 320);
      this.particles.addShockwave(w.x, w.y, blastRadius, '#ff6be6', 0.46, 3.8);
      this.particles.burst(w.x, w.y, manualDetonate ? 34 : 18, '#d98aff', 80, 340, 0.55, true);
      this.audio.playExplosion(manualDetonate ? 1.25 : 0.75);
      if (manualDetonate) this.addScreenShake(7);

      let killsInBlast = 0;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = e.x - w.x;
        const dy = e.y - w.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < blastRadius + e.radius) {
          const falloff = 1 - d / (blastRadius + e.radius + 20);
          const hitDmg = Math.round(dmg * (0.45 + 0.55 * falloff));
          e.vx += (dx / d) * 460 * falloff;
          e.vy += (dy / d) * 460 * falloff;
          e.stunTimer = Math.max(e.stunTimer, manualDetonate ? 0.95 : 0.45);
          this.damageEnemy(e, hitDmg, '#ff85f2', manualDetonate ? 'СВЕРХНОВАЯ!' : null);
          if (e.dead) killsInBlast++;
        }
      }
      if (manualDetonate && killsInBlast >= 3) {
        this.addHitstop(0.04);
      }
      if (isChainEvo && killsInBlast >= 3) {
        this.player.detonateCooldown *= 0.5;
      }
    }

    spawnBullet(opts) {
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const dmg = opts.fromPlayer ? opts.damage : Math.max(1, Math.round((opts.damage || 10) * (diffCfg.dmgScale || 1.0)));
      this.bullets.push({
        x: opts.x,
        y: opts.y,
        vx: opts.vx,
        vy: opts.vy,
        initAng: Math.atan2(opts.vy, opts.vx),
        damage: dmg,
        radius: opts.radius || 4,
        color: opts.color || '#00f0ff',
        fromPlayer: !!opts.fromPlayer,
        isCrit: !!opts.isCrit,
        hijacked: false,
        curved: false,
        slingshotBoosted: false,
        pierce: opts.pierce || 0,
        bounces: opts.bounces || 0,
        hitIds: new Set(),
        life: (opts.life || 3.8) * (opts.fromPlayer ? (this.player.mods.bulletLifeMult || 1.0) : 1.0),
        trail: [],
        homing: opts.homing || 0,
        ignite: opts.ignite || 0,
        frost: opts.frost || 0,
        splash: opts.splash || 0,
        isAfterburnMine: !!opts.isAfterburnMine,
        isSplitClone: !!opts.isSplitClone,
        orbitWell: null,
        orbitAngle: 0,
        orbitR: 0,
        orbitDir: 1,
        orbitAngSpeed: 0,
        orbitBand: 0,
        orbitCharge: 1.0,
        orbitClearTimer: 0,
        orbitSparkTimer: 0,
        orbitReleased: false
      });
    }

    firePlayerWeapons(aimX, aimY) {
      const p = this.player;
      const vitality = (p.hp + p.shield) / Math.max(1, p.maxHp + p.maxShield);
      const berserkFire = p.mods.berserkLevel > 0 ? 1 + (1 - vitality) * 0.65 * p.mods.berserkLevel : 1.0;
      const fireRateBoost = (p.bulletTimeActive ? (1 + p.mods.bulletTimeFireBoost) : 1.0) * p.mods.fireRateMult * berserkFire;
      p.fireCooldown = 0.145 / fireRateBoost;

      const baseAng = Math.atan2(aimY - p.y, aimX - p.x);
      const count = p.mods.multishot;
      const spread = Math.max(0.05, 0.11 * Math.pow(0.9, p.mods.sideGuns || 0) + (p.mods.spreadBonus || 0));
      const speed = 680 * p.mods.projSpeedMult;
      const isCrit = p.mods.critChance > 0 && Math.random() < p.mods.critChance;
      p.shotCounter = (p.shotCounter || 0) + 1;
      const isEcho = p.mods.burstEcho > 0 && (p.shotCounter % 4 === 0);
      const darkMatterBonus = 1 + this.wells.length * (p.mods.darkMatterMult || 0);
      const echoMult = isEcho ? (1 + 0.85 * p.mods.burstEcho) : 1.0;
      const dmg = Math.round(24 * p.mods.damageMult * darkMatterBonus * echoMult * (isCrit ? 2 : 1));
      const baseRadius = (isCrit ? 5.2 : (p.mods.damageMult > 1.3 ? 4.8 : 4.0)) + (p.mods.bulletSizeBonus || 0) + (isEcho ? 1.4 : 0);

      const fireShot = (ang, shotDmg = dmg, shotColor = null) => {
        this.spawnBullet({
          x: p.x + Math.cos(ang) * 18,
          y: p.y + Math.sin(ang) * 18,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          damage: shotDmg,
          radius: baseRadius,
          color: shotColor || (isCrit ? '#ffd166' : (isEcho ? '#ff85f2' : '#00f0ff')),
          fromPlayer: true,
          isCrit,
          bounces: p.mods.bounces,
          pierce: p.mods.basePierce || 0,
          homing: p.mods.homingStrength || 0,
          ignite: p.mods.igniteLevel || 0,
          frost: p.mods.frostRounds || 0,
          splash: p.mods.splashLevel || 0
        });
      };

      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        fireShot(baseAng + offset);
      }
      if (isEcho) {
        fireShot(baseAng, dmg, '#ff85f2');
      }
      for (let r = 0; r < (p.mods.rearGuns || 0); r++) {
        const offset = (r - ((p.mods.rearGuns - 1) / 2)) * 0.14;
        fireShot(baseAng + Math.PI + offset, Math.round(dmg * 0.85));
      }
      for (let s = 0; s < (p.mods.sideGuns || 0); s++) {
        const spreadOff = s * 0.12;
        fireShot(baseAng + Math.PI * 0.5 + spreadOff, Math.round(dmg * 0.85));
        fireShot(baseAng - Math.PI * 0.5 - spreadOff, Math.round(dmg * 0.85));
      }

      // Starburst Fan (evoSplitStar): every 3rd volley fires 12 radial star bolts
      p.starVolleyCounter = (p.starVolleyCounter || 0) + 1;
      if (p.mods.evoSplitStar > 0 && p.starVolleyCounter % 3 === 0) {
        const starDmg = Math.max(10, Math.round(dmg * 0.65));
        for (let k = 0; k < 12; k++) {
          const a = baseAng + (k * Math.PI * 2) / 12;
          fireShot(a, starDmg, '#7df9ff');
        }
      }

      // Subtle ship recoil & dynamic crosshair bloom
      p.vx -= Math.cos(baseAng) * 24;
      p.vy -= Math.sin(baseAng) * 24;
      this.crosshairBloom = Math.min(14, this.crosshairBloom + 5.5);
      this.audio.playShoot(isEcho);
      if (isCrit && typeof this.audio.playCrit === 'function') {
        this.audio.playCrit();
      }
    }

    startWave(waveNum) {
      this.wave = waveNum;
      this.waveBannerTimer = 2.8;
      this.waveQueue = [];

      // Vacuum leftover XP crystals swiftly into the player between waves
      if (waveNum > 1) {
        for (let i = 0; i < this.pickups.length; i++) {
          if (this.pickups[i].kind === 'xp') this.pickups[i].autoCollect = true;
        }
      }

      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const scale = (1 + (waveNum - 1) * 0.22) * diffCfg.enemyScale;
      const isBossWave = waveNum % 5 === 0;

      if (isBossWave) {
        const bossType = (waveNum % 10 === 0) ? 'boss_archon' : 'boss_leviathan';
        this.waveSubtitle = `ТРЕВОГА // ${SG.ENEMY_TYPES[bossType].name}`;
        const bossScale = scale * (1 + Math.max(0, waveNum - 5) * 0.14) * (1 + Math.max(0, this.level - 5) * 0.08);
        this.waveQueue.push({ type: bossType, scale: bossScale });
        const escortCount = 5 + Math.floor(waveNum * 0.7);
        for (let i = 0; i < escortCount; i++) {
          let eType = i % 2 === 0 ? 'swarmer' : 'sniper';
          if (i % 5 === 1 && waveNum >= 5) eType = 'phalanx';
          else if (i % 5 === 3 && waveNum >= 10) eType = 'weaver';
          else if (i % 4 === 2 && waveNum >= 5) eType = 'pulsar';
          this.waveQueue.push({ type: eType, scale });
        }
        this.audio.playBossAlarm();
        this.particles.addText(
          this.bounds.width * 0.5,
          this.bounds.height * 0.28,
          `БОСС ВОЛНЫ ${waveNum}: ${SG.ENEMY_TYPES[bossType].name}!`,
          '#ff3b6b',
          1.45,
          2.4
        );
      } else {
        const subtitles = [
          'КВАНТОВАЯ РАЗВЕДКА',
          'НАСТУПЛЕНИЕ РОЯ',
          'ГРАВИТАЦИОННЫЙ ШТОРМ',
          'ПРОРЫВ ПЕРИМЕТРА',
          'КРИТИЧЕСКАЯ ПЛОТНОСТЬ'
        ];
        this.waveSubtitle = subtitles[(waveNum - 1) % subtitles.length];
        const budget = 6 + waveNum * 3;
        for (let i = 0; i < budget; i++) {
          let type = 'swarmer';
          const r = Math.random();
          if (waveNum >= 4 && r < 0.16) type = 'weaver';
          else if (waveNum >= 3 && r < 0.34) type = 'pulsar';
          else if (waveNum >= 2 && r < 0.52) type = 'phalanx';
          else if (waveNum >= 1 && r < 0.72 && i % 3 === 0) type = 'sniper';
          this.waveQueue.push({ type, scale });
        }
      }
      this.waveSpawnTimer = 0.25;
      this.updateHUD();
    }

    spawnFromWaveQueue() {
      if (this.waveQueue.length === 0) return;
      const item = this.waveQueue.shift();

      // Spawn along arena perimeter away from player
      let x = 40, y = 40;
      for (let attempt = 0; attempt < 8; attempt++) {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { x = Math.random() * this.bounds.width; y = 28; }
        else if (edge === 1) { x = this.bounds.width - 28; y = Math.random() * this.bounds.height; }
        else if (edge === 2) { x = Math.random() * this.bounds.width; y = this.bounds.height - 28; }
        else { x = 28; y = Math.random() * this.bounds.height; }
        if (Math.hypot(x - this.player.x, y - this.player.y) > 240) break;
      }

      const enemy = SG.createEnemy(item.type, x, y, item.scale);
      enemy.uid = Math.random().toString(36).slice(2);
      this.enemies.push(enemy);
      this.particles.addShockwave(x, y, enemy.isBoss ? 110 : 42, enemy.color, 0.35, 2);
    }

    spawnBossEscort(boss, phase) {
      if (this.enemies.length >= 18) return;
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const scale = (1 + Math.max(0, this.wave - 1) * 0.17) * diffCfg.enemyScale;
      const count = phase >= 3 ? 3 : 2;
      const pool = phase >= 3 ? ['weaver', 'phalanx', 'sniper'] : ['sniper', 'phalanx'];
      for (let i = 0; i < count; i++) {
        if (this.enemies.length >= 18) break;
        const ang = (i * Math.PI * 2) / count + Math.random() * 0.5;
        const sx = Math.max(40, Math.min(this.bounds.width - 40, boss.x + Math.cos(ang) * 110));
        const sy = Math.max(40, Math.min(this.bounds.height - 40, boss.y + Math.sin(ang) * 110));
        const escort = SG.createEnemy(pool[i % pool.length], sx, sy, scale);
        escort.uid = Math.random().toString(36).slice(2);
        this.enemies.push(escort);
        this.particles.addShockwave(sx, sy, 48, escort.color, 0.3, 2);
      }
    }

    damageEnemy(e, dmg, textColor = '#ffffff', label = null) {
      if (e.dead) return;
      if (e.cryoTimer > 0 && this.player.mods.cryoVuln > 0) {
        dmg = Math.round(dmg * (1 + this.player.mods.cryoVuln));
      }
      if (this.player.mods.bossDamageBonus > 0 && (e.isBoss || e.type === 'phalanx')) {
        dmg = Math.round(dmg * (1 + this.player.mods.bossDamageBonus));
      }
      e.hp -= dmg;
      e.hitFlash = 1.0;

      if (label) {
        this.particles.addText(e.x, e.y - e.radius - 8, `${label} -${dmg}`, textColor, 1.08);
      } else if (dmg >= 32 && this.getPreset().minorDamageText) {
        this.particles.addText(e.x + (Math.random() - 0.5) * 14, e.y - e.radius - 4, `-${dmg}`, textColor, 0.92, 0.65);
      }

      if (this.player.mods.executeThreshold > 0 && !e.isBoss && e.hp > 0 && (e.hp / e.maxHp) <= this.player.mods.executeThreshold) {
        e.hp = 0;
        this.particles.addText(e.x, e.y - e.radius - 16, 'КАЗНЬ!', '#ff3b6b', 1.05);
      }

      if (e.hp <= 0) {
        this.killEnemy(e);
      }
    }

    killEnemy(e) {
      if (e.dead) return;
      e.dead = true;
      this.stats.kills++;
      this.totalKills++;
      localStorage.setItem('singularis_total_kills', String(this.totalKills));

      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      this.combo = Math.min(8.0, this.combo + (e.isBoss ? 1.5 : 0.2));
      this.maxCombo = Math.max(this.maxCombo || 1.0, this.combo);
      this.comboTimer = 4.2;

      const newTier = this.combo >= 8.0 ? 4 : (this.combo >= 6.0 ? 3 : (this.combo >= 4.0 ? 2 : (this.combo >= 2.0 ? 1 : 0)));
      if (newTier > this.comboTier) {
        this.comboTier = newTier;
        const tierLabels = [
          '',
          '×2.0 ДВОЙНОЙ РЕЗОНАНС!',
          '×4.0 СВЕРХНОВАЯ СЕРИЯ!',
          '×6.0 АРХИТЕКТОР ХАОСА!',
          '×8.0 АБСОЛЮТНАЯ СИНГУЛЯРНОСТЬ!'
        ];
        this.particles.addText(this.player.x, this.player.y - 36, tierLabels[newTier], '#ffd166', 1.24, 1.4);
        if (typeof this.audio.playComboMilestone === 'function') {
          this.audio.playComboMilestone(newTier);
        }
      }

      if (e.isBoss) {
        this.addHitstop(0.085);
      }
      const gainedScore = Math.round(e.score * this.combo * diffCfg.scoreMult * (1 + (this.player.mods.scoreMultBonus || 0)));
      this.score += gainedScore;

      // Vampirism heal, Shield Reaper & Chrono Cascade on kill if unlocked
      if (this.player.mods.vampOnKill > 0) {
        const gained = Math.min(this.player.maxHp - this.player.hp, this.player.mods.vampOnKill);
        this.player.hp += gained;
        this.player.healBuffer += gained;
      }
      if (this.player.mods.shieldOnKill > 0) {
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.mods.shieldOnKill);
      }
      if (this.player.mods.chronoOnKill > 0) {
        const ck = this.player.mods.chronoOnKill;
        this.player.chrono = Math.min(this.player.maxChrono, this.player.chrono + 8 * ck);
        this.player.rewindCooldown = Math.max(0, this.player.rewindCooldown - 0.25 * ck);
        this.player.detonateCooldown = Math.max(0, this.player.detonateCooldown - 0.25 * ck);
      }

      // Chain Detonation corpse explosion (guarded against infinite recursion)
      if (this.player.mods.corpseBlastPct > 0 && !e._exploded) {
        e._exploded = true;
        const blastR = 135;
        const blastDmg = Math.max(15, Math.round(e.maxHp * this.player.mods.corpseBlastPct));
        this.particles.addShockwave(e.x, e.y, blastR, '#ff6b4a', 0.36, 2.8);
        for (let ci = this.enemies.length - 1; ci >= 0; ci--) {
          const ce = this.enemies[ci];
          if (ce && !ce.dead && !ce._exploded && Math.hypot(ce.x - e.x, ce.y - e.y) <= blastR + ce.radius) {
            this.damageEnemy(ce, blastDmg, '#ff9e2c');
          }
        }
        if (this.player.mods.evoCorpseChain > 0) {
          const shardSpd = 520 * this.player.mods.projSpeedMult;
          const shardDmg = Math.max(14, Math.round(22 * this.player.mods.damageMult));
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI * 2) / 4 + 0.4;
            this.spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * shardSpd,
              vy: Math.sin(a) * shardSpd,
              damage: shardDmg,
              radius: 4.0,
              color: '#ff9e2c',
              fromPlayer: true,
              homing: 1,
              life: 1.5
            });
          }
        }
      }

      // Absolute Zero (evoCryoShatter): cryo-affected enemies burst into 6 piercing ice shards
      if (this.player.mods.evoCryoShatter > 0 && e.cryoTimer > 0) {
        const iceSpd = 560 * this.player.mods.projSpeedMult;
        const iceDmg = Math.round(28 * this.player.mods.damageMult);
        this.particles.addShockwave(e.x, e.y, 90, '#7dd3fc', 0.28, 2.2);
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI * 2) / 6;
          this.spawnBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * iceSpd,
            vy: Math.sin(a) * iceSpd,
            damage: iceDmg,
            radius: 4.2,
            color: '#7dd3fc',
            fromPlayer: true,
            pierce: 2,
            frost: 1,
            life: 1.4
          });
        }
      }

      // Crimson Stream (evoEntropyTether): bonus heal & shockwave when enemy dies in Entropy aura
      if (this.player.mods.evoEntropyTether > 0 && this.player.mods.entropyRadius > 0) {
        const entR = this.player.mods.entropyRadius * (this.player.mods.auraRadiusMult || 1.0);
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= entR + e.radius) {
          const gained = Math.min(this.player.maxHp - this.player.hp, 6);
          this.player.hp += gained;
          this.player.healBuffer += gained;
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 10);
          this.particles.addShockwave(e.x, e.y, 110, '#ff3b6b', 0.28, 2.2);
        }
      }

      // Singularity Shards burst if enemy died in gravity well or near player aura
      if (this.player.mods.shardBurst > 0) {
        const p = this.player;
        const rMult = p.mods.auraRadiusMult || 1.0;
        const maxAuraR = Math.max(p.mods.coronaRadius, p.mods.stormRadius, p.mods.cryoRadius, p.mods.entropyRadius, p.mods.repulseRadius, p.mods.radRadius, p.mods.novaRadius) * rMult;
        const nearAura = maxAuraR > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= maxAuraR + e.radius + 20;
        if (e.inGravityWell || nearAura) {
          const shardCount = 2 + this.player.mods.shardBurst;
          const shardSpeed = 480 * p.mods.projSpeedMult;
          const shardDmg = Math.round(18 * p.mods.damageMult);
          for (let s = 0; s < shardCount; s++) {
            const a = (s * Math.PI * 2) / shardCount + Math.random() * 0.25;
            this.spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * shardSpeed,
              vy: Math.sin(a) * shardSpeed,
              damage: shardDmg,
              radius: 3.6,
              color: '#38bdf8',
              fromPlayer: true,
              bounces: Math.min(1, p.mods.bounces),
              life: 1.6
            });
          }
        }
      }

      if (e.isBoss) {
        this.rerolls += 2;
      }

      this.particles.burst(e.x, e.y, e.isBoss ? 75 : 22, e.color, 70, e.isBoss ? 440 : 270, e.isBoss ? 1.0 : 0.55, true);
      this.particles.addShockwave(e.x, e.y, e.isBoss ? 240 : 68, e.color, e.isBoss ? 0.65 : 0.32, e.isBoss ? 4.5 : 2.2);
      this.grid.applyRadialForce(e.x, e.y, e.isBoss ? 2200 : 640, e.isBoss ? 290 : 135, 345);
      this.audio.playExplosion(e.isBoss ? 1.8 : 0.85);
      if (e.isBoss) this.addScreenShake(15);

      // Spawn XP Crystals & Repair Orbs
      const crystalCount = e.isBoss ? 16 : Math.max(1, Math.round(e.xp / 14));
      const xpPer = e.xp / crystalCount;
      for (let i = 0; i < crystalCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 110;
        this.pickups.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          kind: 'xp',
          val: xpPer,
          life: 24
        });
      }

      if (e.isBoss) {
        for (let h = 0; h < 2; h++) {
          this.pickups.push({
            x: e.x + (h === 0 ? -18 : 18),
            y: e.y,
            vx: 0,
            vy: 0,
            kind: 'heal',
            val: 28,
            life: 24
          });
        }
      } else if (Math.random() < 0.09) {
        this.pickups.push({
          x: e.x,
          y: e.y,
          vx: 0,
          vy: 0,
          kind: 'heal',
          val: 22,
          life: 16
        });
      }
    }

    triggerChainLightning(sourceEnemy, baseDamage) {
      const baseTargets = this.player.mods.chainTargets;
      if (baseTargets <= 0) return;
      const extraEcho = (this.player.mods.resonanceEcho > 0 && Math.random() < 0.4) ? this.player.mods.resonanceEcho : 0;
      const maxTargets = baseTargets + extraEcho;
      let prevX = sourceEnemy.x;
      let prevY = sourceEnemy.y;
      const visited = new Set([sourceEnemy]);

      for (let c = 0; c < maxTargets; c++) {
        let nearest = null;
        let minDist = 190;
        for (let i = 0; i < this.enemies.length; i++) {
          const cand = this.enemies[i];
          if (cand.dead || visited.has(cand)) continue;
          const d = Math.hypot(cand.x - prevX, cand.y - prevY);
          if (d < minDist) {
            minDist = d;
            nearest = cand;
          }
        }
        if (!nearest) break;
        visited.add(nearest);
        this.particles.addLightning(prevX, prevY, nearest.x, nearest.y, '#7df9ff', 0.22);
        const arcDmg = Math.max(8, Math.round(baseDamage * this.player.mods.chainDamage));
        this.damageEnemy(nearest, arcDmg, '#7df9ff');
        prevX = nearest.x;
        prevY = nearest.y;
      }
    }

    computeNextXp(level) {
      return Math.round(55 + level * 26 + Math.pow(level, 1.38) * 7);
    }

    checkLevelUp() {
      if (this.xp >= this.xpNext && this.state === 'playing') {
        if (SG.rollUpgradeChoices(this.upgradeStacks, 1).length === 0) return;
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = this.computeNextXp(this.level);
        this.openUpgradeModal();
      }
    }

    gainXP(amount) {
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      this.xp += amount * diffCfg.xpMult * (this.player.mods.xpMult || 1.0);
      this.checkLevelUp();
    }

    openUpgradeModal() {
      this.currentChoices = SG.rollUpgradeChoices(this.upgradeStacks, 4);
      if (this.currentChoices.length === 0) return;

      this.state = 'upgrade';
      this.mouse.leftDown = false;
      this.audio.playLevelUp();

      this.renderUpgradeChoices();

      const dlg = document.getElementById('upgrade-dialog');
      if (!dlg.open) dlg.showModal();

      // If AI Autopilot is active, let the user glimpse the choice for 0.85s then auto-pick best synergy!
      if (this.autopilot.enabled) {
        setTimeout(() => {
          if (this.state === 'upgrade') {
            const pick = this.autopilot.pickBestUpgrade(this.currentChoices, this.upgradeStacks);
            if (pick) this.selectUpgrade(pick);
          }
        }, 850);
      }
    }

    renderUpgradeChoices() {
      const statsBar = document.getElementById('upgrade-stats-bar');
      if (statsBar && this.player) {
        const p = this.player;
        const m = p.mods;
        const dmgPct = Math.round(m.damageMult * 100);
        const ratePct = Math.round(m.fireRateMult * 100);
        const critPct = Math.round(m.critChance * 100);
        const armPct = Math.round(Math.min(0.82, m.armor) * 100);
        const evoCnt = this.evolvedUpgrades ? this.evolvedUpgrades.size : 0;
        statsBar.textContent = `Урон: ${dmgPct}% • Темп: ${ratePct}% • Крит: ${critPct}% • Броня: ${armPct}% • Щит: ${Math.ceil(p.maxShield)} • Дыры: ${m.maxWells} • Эволюций: ${evoCnt}`;
      }

      const container = document.getElementById('upgrade-cards');
      container.innerHTML = '';

      this.currentChoices.forEach((upg, idx) => {
        const curStack = this.upgradeStacks[upg.id] || 0;
        const willEvolve = !!(upg.evolution && (curStack + 1) === upg.maxStacks);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `upgrade-card rarity-${upg.rarity}${this.getTagClass(upg)}${willEvolve ? ' is-evolution' : ''}`;
        const evoHtml = upg.evolution
          ? (willEvolve
            ? `<div class="upg-evo-box"><strong>АПЕКС-ЭВОЛЮЦИЯ: ${upg.evolution.title}</strong> — ${upg.evolution.perk}</div>`
            : `<div class="upg-evo-hint">Макс. ур.: ${upg.evolution.title}</div>`)
          : '';
        btn.innerHTML = `
          <div class="upg-top">
            <span class="upg-tag">${willEvolve ? `ЭВОЛЮЦИЯ -> ${upg.evolution.title}` : upg.tag}</span>
            <span class="upg-key">[${idx + 1}]</span>
          </div>
          <div class="upg-icon">${upg.icon}</div>
          <h3 class="upg-title">${upg.title}</h3>
          <p class="upg-desc">${upg.desc}</p>
          ${evoHtml}
          <div class="upg-stacks">${willEvolve ? `ЭВОЛЮЦИЯ: ${curStack + 1} / ${upg.maxStacks} [MAX]` : `Уровень: ${curStack + 1} / ${upg.maxStacks}`}</div>
        `;
        btn.addEventListener('click', () => this.selectUpgrade(upg));
        container.appendChild(btn);
      });

      const rerollBtn = document.getElementById('btn-upgrade-reroll');
      if (rerollBtn) {
        rerollBtn.textContent = `Перебросить (${this.rerolls}) [R]`;
        rerollBtn.disabled = this.rerolls <= 0;
      }
    }

    rerollUpgrades() {
      if (this.state !== 'upgrade' || this.rerolls <= 0) return;
      this.rerolls--;
      const prevIds = new Set(this.currentChoices.map(u => u.id));
      let next = SG.rollUpgradeChoices(this.upgradeStacks, 4);
      // Avoid identical set when other eligible upgrades exist
      if (next.length > 0 && next.every(u => prevIds.has(u.id))) {
        const alt = SG.rollUpgradeChoices(this.upgradeStacks, 4);
        if (alt.length > 0) next = alt;
      }
      this.currentChoices = next;
      this.audio.playDeflect();
      this.renderUpgradeChoices();
    }

    selectUpgrade(upg) {
      if (this.state !== 'upgrade') return;
      this.upgradeStacks[upg.id] = (this.upgradeStacks[upg.id] || 0) + 1;
      upg.apply(this.player.mods, this.player, this);

      let evolvedNow = false;
      if (this.upgradeStacks[upg.id] === upg.maxStacks && upg.evolution && !this.evolvedUpgrades.has(upg.id)) {
        this.evolvedUpgrades.add(upg.id);
        upg.evolution.apply(this.player.mods, this.player, this);
        evolvedNow = true;
      }

      const dlg = document.getElementById('upgrade-dialog');
      if (dlg && dlg.open) dlg.close();

      this._buildDirty = true;
      this.state = 'playing';
      if (evolvedNow) {
        this.particles.addShockwave(this.player.x, this.player.y, 240, '#ffd166', 0.55, 3.8);
        this.particles.addShockwave(this.player.x, this.player.y, 165, '#00f0ff', 0.45, 3.0);
        this.particles.burst(this.player.x, this.player.y, 45, '#ffd166', 90, 340, 0.65, true);
        this.particles.addText(this.player.x, this.player.y - 34, `ЭВОЛЮЦИЯ: ${upg.evolution.title.toUpperCase()}!`, '#ffd166', 1.32, 1.8);
        this.addScreenShake(8);
        this.addHitstop(0.045);
        if (typeof this.audio.playEvolution === 'function') this.audio.playEvolution();
        else this.audio.playLevelUp();
      } else {
        this.particles.addShockwave(this.player.x, this.player.y, 165, '#00f0ff', 0.45, 3);
        this.particles.addText(this.player.x, this.player.y - 28, `${upg.title.toUpperCase()}`, '#7df9ff', 1.18);
      }
      this.updateHUD();
      this.checkLevelUp();
    }

    triggerGameOver() {
      this.state = 'gameover';
      this.mouse.leftDown = false;

      const isNewRecord = this.score > this.bestScore && this.score > 0;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        localStorage.setItem('singularis_best_score', String(this.bestScore));
      }
      if (this.wave > this.bestWave) {
        this.bestWave = this.wave;
        localStorage.setItem('singularis_best_wave', String(this.bestWave));
      }

      const recBadge = document.getElementById('go-record-badge');
      if (recBadge) recBadge.hidden = !isNewRecord;

      document.getElementById('go-score').textContent = this.score.toLocaleString('ru-RU');
      document.getElementById('go-best').textContent = this.bestScore.toLocaleString('ru-RU');
      document.getElementById('go-wave').textContent = String(this.wave);
      document.getElementById('go-kills').textContent = String(this.stats.kills);
      document.getElementById('go-slingshots').textContent = String(this.stats.slingshots);
      document.getElementById('go-hijacks').textContent = String(this.stats.hijacks);
      const goCombo = document.getElementById('go-max-combo');
      if (goCombo) goCombo.textContent = `×${(this.maxCombo || 1).toFixed(1)}`;
      const goEvos = document.getElementById('go-evolutions');
      if (goEvos) goEvos.textContent = String(this.evolvedUpgrades ? this.evolvedUpgrades.size : 0);

      const buildList = document.getElementById('go-build-list');
      if (buildList) {
        buildList.innerHTML = '';
        const entries = Object.entries(this.upgradeStacks);
        if (entries.length === 0) {
          const sp = document.createElement('span');
          sp.className = 'upgrade-pill';
          sp.textContent = 'Базовая конфигурация ядра';
          buildList.appendChild(sp);
        } else {
          entries.sort((a, b) => {
            const ea = this.evolvedUpgrades.has(a[0]) ? 1 : 0;
            const eb = this.evolvedUpgrades.has(b[0]) ? 1 : 0;
            return eb - ea || b[1] - a[1];
          });
          entries.forEach(([id, lvl]) => {
            const def = SG.UPGRADES.find(u => u.id === id);
            if (!def) return;
            const evolved = this.evolvedUpgrades.has(id);
            const sp = document.createElement('span');
            sp.className = `upgrade-pill${evolved ? ' evolved' : ''}`;
            sp.textContent = evolved && def.evolution
              ? `[${def.icon}] ${def.evolution.title} [MAX]`
              : `[${def.icon}] ${def.title} ×${lvl}`;
            buildList.appendChild(sp);
          });
        }
      }

      const dlg = document.getElementById('gameover-dialog');
      if (dlg && !dlg.open) dlg.showModal();
    }

    update(rawDt) {
      const dt = Math.min(0.05, rawDt);
      this.damageFlash = Math.max(0, this.damageFlash - dt * 3.8);
      this.crosshairBloom = Math.max(0, this.crosshairBloom - dt * 36);

      // Ambient background warp on title screen
      if (this.state !== 'playing') {
        const t = performance.now() * 0.0015;
        this.grid.applyRadialForce(
          this.bounds.width * 0.5 + Math.cos(t) * 180,
          this.bounds.height * 0.5 + Math.sin(t * 1.3) * 110,
          -240 * dt * 60 * 0.03,
          240,
          215
        );
        this.grid.update(dt);
        this.particles.update(dt, this.wells);
        return;
      }

      // Micro-hitstop impact freeze (visual particles keep shimmering!)
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        this.particles.update(dt * 0.25, this.wells);
        return;
      }

      // Gather Player or Tactical-AI Input
      let input;
      if (this.autopilot.enabled) {
        input = this.autopilot.computeInput(dt, this);
        if (input.triggerRewind) {
          this.player.triggerRewind(this.particles, this.audio, this.grid, this);
        }
        if (input.triggerDash) {
          this.player.triggerDash(input.moveX, input.moveY, this.bounds, this.particles, this.audio, this.grid, this);
        }
        if (input.spawnWell) {
          this.spawnGravityWell(input.spawnWell.x, input.spawnWell.y, input.spawnWell.isRepulsor);
        }
        if (input.detonateWells) {
          this.detonateAllWells();
        }
      } else {
        const kbMoveX = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
        const kbMoveY = (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) - (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0);
        const moveX = Math.abs(this.touchInput.moveX) > 0.05 ? this.touchInput.moveX : kbMoveX;
        const moveY = Math.abs(this.touchInput.moveY) > 0.05 ? this.touchInput.moveY : kbMoveY;
        let aimX = this.mouse.x;
        let aimY = this.mouse.y;
        if (this.isTouchDevice && (this.touchInput.firing || Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05)) {
          const target = this.findNearestEnemy(this.player.x, this.player.y);
          if (target) {
            aimX = target.x;
            aimY = target.y;
          } else if (Math.hypot(moveX, moveY) > 0.05) {
            aimX = this.player.x + moveX * 220;
            aimY = this.player.y + moveY * 220;
          }
        }
        input = {
          moveX,
          moveY,
          aimX,
          aimY,
          firing: this.mouse.leftDown || this.keys['KeyF'] || this.touchInput.firing,
          bulletTime: !!this.keys['Space'] || this.touchInput.bulletTime
        };
      }

      // Player updates in personal proper-time (stays fast during Bullet-Time!)
      this.player.update(dt, input, this.bounds, this.particles);

      // Chrono-Shift: Bullet-Time entry stun shockwave
      if (this.player.justEnteredBulletTime && this.player.mods.btNovaLevel > 0) {
        const lvl = this.player.mods.btNovaLevel;
        this.particles.addShockwave(this.player.x, this.player.y, 240, '#b95cff', 0.42, 3.2);
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const en = this.enemies[ei];
          if (!en.dead && Math.hypot(en.x - this.player.x, en.y - this.player.y) <= 240 + en.radius) {
            en.stunTimer = Math.max(en.stunTimer, 1.1 + lvl * 0.35);
            this.damageEnemy(en, Math.round(45 * lvl * this.player.mods.damageMult), '#d98aff');
          }
        }
      }

      // Auto Gravity Well Beacon: periodically drops a Black Hole in densest enemy cluster (+ companion White Hole with evoAutoWellTwin)
      if (this.player.mods.autoWellLevel > 0 && this.player.autoWellTimer <= 0 && this.enemies.length > 0) {
        this.player.autoWellTimer = 7.0 / (1 + (this.player.mods.autoWellLevel - 1) * 0.35);
        let bestE = this.enemies[0];
        let bestScore = -1;
        for (let i = 0; i < this.enemies.length; i++) {
          const c = this.enemies[i];
          if (c.dead) continue;
          let near = 0;
          for (let j = 0; j < this.enemies.length; j++) {
            const o = this.enemies[j];
            if (!o.dead && Math.hypot(o.x - c.x, o.y - c.y) < 160) near++;
          }
          if (near > bestScore) { bestScore = near; bestE = c; }
        }
        if (bestE) {
          const w = new SG.GravityWell(bestE.x, bestE.y, false, this.player.mods);
          if (this.wells.length >= this.player.mods.maxWells + 1) {
            const oldest = this.wells.shift();
            this.releaseOrbitalBullets(oldest);
          }
          this.wells.push(w);
          this.particles.addShockwave(w.x, w.y, w.slingshotRadius, '#c06cff', 0.35, 2.2);
          if (this.player.mods.evoAutoWellTwin > 0) {
            const ang = Math.random() * Math.PI * 2;
            const wx = Math.max(60, Math.min(this.bounds.width - 60, bestE.x + Math.cos(ang) * 120));
            const wy = Math.max(60, Math.min(this.bounds.height - 60, bestE.y + Math.sin(ang) * 120));
            const wh = new SG.GravityWell(wx, wy, true, this.player.mods);
            this.wells.push(wh);
            this.particles.addShockwave(wx, wy, wh.slingshotRadius, '#ffb838', 0.35, 2.2);
          }
        }
      }

      // Chrono-Overclock (evoChronoOverclock): fire homing Chrono-Lances while Bullet-Time active
      if (this.player.bulletTimeActive && this.player.mods.evoChronoOverclock > 0 && this.player.chronoLanceTimer <= 0 && this.enemies.length > 0) {
        this.player.chronoLanceTimer = 0.45;
        const target = this.enemies[0];
        const a = SG.solveInterceptAngle(this.player.x, this.player.y, target.x, target.y, target.vx, target.vy, 760);
        this.spawnBullet({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          damage: Math.round(42 * this.player.mods.damageMult),
          radius: 5.0,
          color: '#d98aff',
          fromPlayer: true,
          homing: 2,
          pierce: 1,
          life: 2.2
        });
      }

      // Quantum Superposition: auto-spawns Paradox Clones periodically
      if (this.player.mods.autoCloneLevel > 0 && this.player.autoCloneTimer <= 0) {
        this.player.autoCloneTimer = 9.0 / this.player.mods.autoCloneLevel;
        this.player.clones.push({
          x: this.player.x + (Math.random() - 0.5) * 40,
          y: this.player.y + (Math.random() - 0.5) * 40,
          life: 6.0,
          fireTimer: 0.1
        });
      }

      // Jet Afterburn Mines at high speed
      if (this.player.mods.afterburnLevel > 0 && this.player.afterburnTimer <= 0 && Math.hypot(this.player.vx, this.player.vy) > 155) {
        this.player.afterburnTimer = Math.max(0.18, 0.44 - this.player.mods.afterburnLevel * 0.08);
        this.spawnBullet({
          x: this.player.x,
          y: this.player.y,
          vx: 0,
          vy: 0,
          damage: Math.round(28 * this.player.mods.afterburnLevel * this.player.mods.damageMult),
          radius: 6.5,
          color: '#ff9e2c',
          fromPlayer: true,
          life: 3.2,
          isAfterburnMine: true,
          splash: 1
        });
      }

      // White Hole Biosynthesis: heals player inside White Hole field
      if (this.player.mods.whiteMedic > 0) {
        for (let wi = 0; wi < this.wells.length; wi++) {
          const w = this.wells[wi];
          if (w.polarity < 0 && Math.hypot(this.player.x - w.x, this.player.y - w.y) <= w.influenceRadius) {
            const gained = Math.min(this.player.maxHp - this.player.hp, 7 * this.player.mods.whiteMedic * dt);
            this.player.hp += gained;
            this.player.healBuffer += gained;
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 8 * this.player.mods.whiteMedic * dt);
            break;
          }
        }
      }

      if (input.firing && this.player.fireCooldown <= 0) {
        this.firePlayerWeapons(input.aimX, input.aimY);
      }

      // World relativistic time-scale (0.28x for enemies & enemy bullets during Bullet-Time!)
      const targetScale = this.player.bulletTimeActive ? 0.28 : 1.0;
      this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 12);
      const worldDt = dt * this.timeScale;

      const combatIntensity = Math.min(1, (this.enemies.length / 10) * 0.7 + (this.combo - 1) * 0.12);
      const bossAlive = this.enemies.some(en => en.isBoss && !en.dead);
      this.audio.setChronoState(this.timeScale, combatIntensity, bossAlive);

      // Update Paradox Clones (apex clones fire 3-shot bursts!)
      for (let i = this.player.clones.length - 1; i >= 0; i--) {
        const c = this.player.clones[i];
        c.life -= dt;
        if (c.life <= 0) {
          this.player.clones.splice(i, 1);
          continue;
        }
        c.fireTimer -= dt;
        if (c.fireTimer <= 0 && this.enemies.length > 0) {
          c.fireTimer = c.isApexClone ? 0.28 : 0.24;
          const target = this.enemies[0];
          const baseA = SG.solveInterceptAngle(c.x, c.y, target.x, target.y, target.vx, target.vy, 620);
          const shots = c.isApexClone ? [-0.14, 0, 0.14] : [0];
          for (const off of shots) {
            const a = baseA + off;
            this.spawnBullet({
              x: c.x,
              y: c.y,
              vx: Math.cos(a) * 620,
              vy: Math.sin(a) * 620,
              damage: Math.round((c.isApexClone ? 20 : 16) * this.player.mods.damageMult),
              radius: c.isApexClone ? 4.2 : 3.6,
              color: c.isApexClone ? '#ffd166' : '#00ffa6',
              fromPlayer: true
            });
          }
        }
      }

      // Update Gravity Wells & Binary Star Plasma Bridges!
      for (let i = this.wells.length - 1; i >= 0; i--) {
        const w = this.wells[i];
        w.update(dt, this.grid, this.particles);
        if (w.life <= 0) {
          this.wells.splice(i, 1);
          this.collapseWell(w, false);
        }
      }

      if (this.player.mods.binaryBridge > 0 && this.wells.length >= 2) {
        const isLattice = this.player.mods.evoBinaryLattice > 0;
        const maxRange = isLattice ? 820 : 560;
        const bridgeDps = isLattice ? 300 : 115;
        for (let i = 0; i < this.wells.length; i++) {
          for (let j = i + 1; j < this.wells.length; j++) {
            const w1 = this.wells[i];
            const w2 = this.wells[j];
            const dist = Math.hypot(w2.x - w1.x, w2.y - w1.y);
            if (dist < maxRange) {
              // Slice enemies crossing the binary gravity bridge!
              for (let ei = 0; ei < this.enemies.length; ei++) {
                const e = this.enemies[ei];
                if (e.dead) continue;
                const dLine = this.pointToSegmentDist(e.x, e.y, w1.x, w1.y, w2.x, w2.y);
                if (dLine < e.radius + 10) {
                  e.hp -= bridgeDps * dt;
                  if (Math.random() < 0.35) {
                    this.particles.burst(e.x, e.y, 2, '#00f0ff', 40, 130, 0.2);
                  }
                  if (isLattice && Math.random() < dt * 2.5) {
                    this.triggerChainLightning(e, 45 * this.player.mods.damageMult);
                  }
                  if (e.hp <= 0) this.killEnemy(e);
                }
              }
            }
          }
        }
      }

      // Wave Spawner
      if (this.waveBannerTimer > 0) this.waveBannerTimer -= dt;
      if (this.waveQueue.length > 0) {
        this.waveSpawnTimer -= worldDt;
        if (this.waveSpawnTimer <= 0) {
          this.spawnFromWaveQueue();
          this.waveSpawnTimer = Math.max(0.22, 0.68 - this.wave * 0.025);
        }
      } else if (this.enemies.length === 0) {
        this.startWave(this.wave + 1);
      }

      // Update Player Combat Auras (Solar Corona, Cryo-Stasis, Entropy Siphon, Storm Coil, Grav-Repulse)
      this.updatePlayerAuras(dt, worldDt);

      // Update Enemies + Matter Annihilation Collisions!
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.dead) continue;
        SG.updateEnemy(e, worldDt, this);
        if (e.hp <= 0) {
          this.killEnemy(e);
        }
      }

      // Enemy-Enemy Matter Annihilation inside Gravity Wells + Player Hull Contact
      for (let i = 0; i < this.enemies.length; i++) {
        const e1 = this.enemies[i];
        if (e1.dead) continue;

        // Lagrange Drone collisions
        for (let di = 0; di < this.player.drones.length; di++) {
          const dr = this.player.drones[di];
          if (dr.hitCooldown <= 0 && Math.hypot(e1.x - dr.x, e1.y - dr.y) < e1.radius + 10) {
            dr.hitCooldown = 0.28;
            this.damageEnemy(e1, 24, '#00f0ff');
            this.particles.burst(dr.x, dr.y, 6, '#00f0ff', 50, 160, 0.25);
          }
        }

        // Player contact check (including Leviathan segments & Archon binary cores)
        let hitPlayer = Math.hypot(e1.x - this.player.x, e1.y - this.player.y) < e1.radius + this.player.radius - 2;
        if (!hitPlayer && e1.segments) {
          for (const seg of e1.segments) {
            if (Math.hypot(seg.x - this.player.x, seg.y - this.player.y) < seg.radius + this.player.radius - 3) {
              hitPlayer = true;
              break;
            }
          }
        }
        if (hitPlayer) {
          const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
          const baseContact = Math.round(18 * (diffCfg.dmgScale || 1.0));
          const ramLvl = this.player.mods.ramLevel;
          if (ramLvl > 0) {
            const contactRed = Math.min(0.65, 0.3 + ramLvl * 0.15);
            this.player.takeDamage(Math.max(1, Math.round(baseContact * (1 - contactRed))), this.particles, this.audio, this);
            const ramDmg = Math.round(65 * ramLvl + this.player.maxHp * 0.45);
            const ePushAng = Math.atan2(e1.y - this.player.y, e1.x - this.player.x);
            e1.vx += Math.cos(ePushAng) * 520;
            e1.vy += Math.sin(ePushAng) * 520;
            this.damageEnemy(e1, ramDmg, '#22ffa6', 'ТАРАН!');
            if (this.player.mods.evoRamJuggernaut > 0) {
              this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.5);
              this.player.shield = Math.min(this.player.maxShield, this.player.shield + 8);
              this.particles.addShockwave(this.player.x, this.player.y, 160, '#22ffa6', 0.32, 2.8);
              for (let ri = this.enemies.length - 1; ri >= 0; ri--) {
                const re = this.enemies[ri];
                if (re !== e1 && !re.dead && Math.hypot(re.x - this.player.x, re.y - this.player.y) <= 160 + re.radius) {
                  this.damageEnemy(re, Math.round(ramDmg * 0.65), '#22ffa6');
                }
              }
            }
          } else {
            this.player.takeDamage(baseContact, this.particles, this.audio, this);
          }
          const pushAng = Math.atan2(this.player.y - e1.y, this.player.x - e1.x);
          this.player.vx += Math.cos(pushAng) * 340;
          this.player.vy += Math.sin(pushAng) * 340;
        }

        // Enemy-Enemy collision inside gravitational wells!
        for (let j = i + 1; j < this.enemies.length; j++) {
          const e2 = this.enemies[j];
          if (e2.dead) continue;
          const dx = e2.x - e1.x;
          const dy = e2.y - e1.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = e1.radius + e2.radius;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) * 0.5;
            e1.x -= nx * overlap;
            e1.y -= ny * overlap;
            e2.x += nx * overlap;
            e2.y += ny * overlap;

            const relSpeed = Math.hypot(e2.vx - e1.vx, e2.vy - e1.vy);
            if ((e1.inGravityWell || e2.inGravityWell) && relSpeed > 80 && e1.wellCollideCd <= 0 && e2.wellCollideCd <= 0) {
              e1.wellCollideCd = 0.38;
              e2.wellCollideCd = 0.38;
              const colDmg = Math.round(38 * this.player.mods.collisionMult);
              this.stats.annihilations++;
              this.particles.burst((e1.x + e2.x) * 0.5, (e1.y + e2.y) * 0.5, 16, '#ff6be6', 80, 240, 0.45);
              this.damageEnemy(e1, colDmg, '#ff85f2', 'АННИГИЛЯЦИЯ!');
              this.damageEnemy(e2, colDmg, '#ff85f2');
            }
          }
        }
      }

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (this.enemies[i].dead) this.enemies.splice(i, 1);
      }

      // Count live orbiting bullets per well
      for (let w = 0; w < this.wells.length; w++) {
        this.wells[w].orbitCount = 0;
      }
      for (let i = 0; i < this.bullets.length; i++) {
        const ow = this.bullets[i].orbitWell;
        if (ow && this.wells.includes(ow)) ow.orbitCount++;
      }

      // Update Projectiles with Relativistic Gravitational Lensing & Orbital Trapping!
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        let bDt = (b.fromPlayer || b.orbitWell) ? dt : worldDt;

        // Time Dilation Aura around player slows incoming enemy bullets!
        if (!b.fromPlayer && !b.orbitWell && this.player.mods.dilationAura > 0) {
          if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < 145) {
            bDt *= Math.max(0.25, 1 - this.player.mods.dilationAura);
          }
        }

        if (!b.orbitWell) {
          b.life -= bDt;
          if (b.life <= 0) {
            this.bullets.splice(i, 1);
            continue;
          }
        }

        // Save short motion trail (longer trail for curved/boosted/orbiting shots!)
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > (b.slingshotBoosted || b.hijacked || b.curved || b.orbitWell ? 10 : 5)) b.trail.shift();

        if (b.orbitWell) {
          const well = b.orbitWell;
          if (!this.wells.includes(well)) {
            b.orbitWell = null;
          } else {
            const targetR = well.coreRadius * 1.48 + b.orbitBand;
            b.orbitR += (targetR - b.orbitR) * Math.min(1, bDt * 9);
            b.orbitAngle += b.orbitDir * b.orbitAngSpeed * bDt;
            b.x = well.x + Math.cos(b.orbitAngle) * b.orbitR;
            b.y = well.y + Math.sin(b.orbitAngle) * b.orbitR;
            const tangAng = b.orbitAngle + b.orbitDir * Math.PI * 0.5;
            const tangSp = b.orbitAngSpeed * b.orbitR;
            b.vx = Math.cos(tangAng) * tangSp;
            b.vy = Math.sin(tangAng) * tangSp;
            b.life = Math.max(b.life, 2.2);

            // Orbital Collider amplification & periodic multi-hit inside ring
            const colLvl = this.player.mods.orbitCollider;
            const evoOrbit = this.player.mods.evoOrbitSingularity > 0;
            const maxCharge = evoOrbit ? 5.0 : (colLvl > 0 ? (2.5 + colLvl * 0.5) : 2.0);
            const chargeRate = (colLvl > 0 ? (0.55 * colLvl) : 0.22) * (evoOrbit ? 1.5 : 1.0);
            b.orbitCharge = Math.min(maxCharge, (b.orbitCharge || 1.0) + chargeRate * bDt);
            if (colLvl > 0) {
              b.orbitClearTimer = (b.orbitClearTimer || 0) + bDt;
              if (b.orbitClearTimer >= 0.32) {
                b.orbitClearTimer = 0;
                b.hitIds.clear();
              }
            }

            // Synchro-Spark: orbiting bullets shoot mini plasma sparks at nearby enemies
            if (this.player.mods.orbitSparks > 0 && this.enemies.length > 0) {
              b.orbitSparkTimer = (b.orbitSparkTimer || 0) + bDt;
              if (b.orbitSparkTimer >= Math.max(0.45, 1.0 - this.player.mods.orbitSparks * 0.18)) {
                b.orbitSparkTimer = 0;
                let nearE = null;
                let minD = 320;
                for (let ei = 0; ei < this.enemies.length; ei++) {
                  const en = this.enemies[ei];
                  if (en.dead) continue;
                  const d = Math.hypot(en.x - b.x, en.y - b.y);
                  if (d < minD) { minD = d; nearE = en; }
                }
                if (nearE) {
                  const sa = Math.atan2(nearE.y - b.y, nearE.x - b.x);
                  this.spawnBullet({
                    x: b.x,
                    y: b.y,
                    vx: Math.cos(sa) * 620,
                    vy: Math.sin(sa) * 620,
                    damage: Math.max(8, Math.round(b.damage * 0.45)),
                    radius: 3.0,
                    color: '#ff99ff',
                    fromPlayer: true,
                    life: 0.75
                  });
                }
              }
            }
          }
        } else {
          // Curve through Gravity Wells (strong relativistic gravitational lensing!)
          let swallowed = false;
          for (let w = 0; w < this.wells.length; w++) {
            const well = this.wells[w];
            const dx = well.x - b.x;
            const dy = well.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < well.influenceRadius * well.influenceRadius) {
              const dist = Math.sqrt(d2) || 1;

              // Orbital Trap: capture passing player & enemy bullets into stable high-speed orbit!
              const trapLvl = this.player.mods.orbitTrap;
              const maxOrbitCap = 14 * trapLvl + (this.player.mods.orbitCapBonus || 0);
              if (trapLvl > 0 && well.polarity > 0 && !b.orbitReleased && !b.isAfterburnMine && dist < well.slingshotRadius * 1.18 && well.orbitCount < maxOrbitCap) {
                well.orbitCount++;
                b.orbitWell = well;
                b.orbitAngle = Math.atan2(b.y - well.y, b.x - well.x);
                b.orbitR = Math.max(well.coreRadius * 1.25, dist);
                const rx = b.x - well.x;
                const ry = b.y - well.y;
                const cross = rx * b.vy - ry * b.vx;
                b.orbitDir = cross >= 0 ? 1 : -1;
                const capSpeedBoost = this.player.mods.orbitCapBonus > 0 ? (1 + 0.25 * Math.ceil(this.player.mods.orbitCapBonus / 12)) : 1;
                b.orbitAngSpeed = (6.2 + Math.random() * 2.4) * capSpeedBoost;
                b.orbitBand = (well.orbitCount % 4) * 9 * well.radiusMult;
                b.orbitCharge = b.orbitCharge || 1.15;
                b.fromPlayer = true;
                b.hijacked = false;
                b.pierce = Math.max(b.pierce, 999);
                b.color = '#e879f9';
                b.radius = Math.max(b.radius, 5.2);
                this.particles.addShockwave(b.x, b.y, 28, '#e879f9', 0.2, 1.5);
                break;
              }

              // Black Hole Event Horizon swallows enemy bullets at the core (when not trapped)
              if (!b.fromPlayer && well.polarity > 0 && dist < well.coreRadius * 0.92) {
                this.particles.burst(b.x, b.y, 6, '#c06cff', 40, 140, 0.25, false);
                const be = this.player.mods.bulletEater || 0;
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1 + be * 3);
                if (be > 0) {
                  const gained = Math.min(this.player.maxHp - this.player.hp, be * 2);
                  this.player.hp += gained;
                  this.player.healBuffer += gained;
                }
                this.bullets.splice(i, 1);
                swallowed = true;
                break;
              }

              if (d2 > 100 && !b.isAfterburnMine) {
                const gravMult = well.gravMult || 1.0;
                const strength = b.fromPlayer ? 11.5 : 16.5;
                const minD2 = b.fromPlayer ? 2200 : 1800;
                const accel = (well.polarity * well.mass * strength * gravMult) / Math.max(minD2, d2);
                b.vx += (dx / dist) * accel * bDt;
                b.vy += (dy / dist) * accel * bDt;

                // White Hole Pulsar: reflect & accelerate enemy bullets as homing counters
                if (!b.fromPlayer && well.polarity < 0 && this.player.mods.whiteNova > 0 && !b.hijacked && dist < well.slingshotRadius * 1.15) {
                  b.hijacked = true;
                  b.homing = Math.max(b.homing, this.player.mods.whiteNova);
                  b.color = '#ffb838';
                  b.radius = 5.4;
                  const sp = Math.min(920, Math.hypot(b.vx, b.vy) * 1.85);
                  if (this.enemies.length > 0) {
                    const targetE = this.enemies[0];
                    const a = SG.solveInterceptAngle(b.x, b.y, targetE.x, targetE.y, targetE.vx, targetE.vy, sp);
                    b.vx = Math.cos(a) * sp;
                    b.vy = Math.sin(a) * sp;
                  }
                }

                const curSp = Math.hypot(b.vx, b.vy);
                const maxSp = b.fromPlayer ? 1350 : 780;
                if (curSp > maxSp) {
                  b.vx = (b.vx / curSp) * maxSp;
                  b.vy = (b.vy / curSp) * maxSp;
                }

                // Player Orbital Slingshot Rail-Boost!
                if (b.fromPlayer && !b.slingshotBoosted && dist < well.slingshotRadius) {
                  b.slingshotBoosted = true;
                  this.stats.slingshots++;
                  const sp = Math.hypot(b.vx, b.vy) || 1;
                  const newSp = Math.min(1350, sp * 1.38);
                  b.vx = (b.vx / sp) * newSp;
                  b.vy = (b.vy / sp) * newSp;
                  b.damage = Math.round(b.damage * this.player.mods.slingshotMult);
                  if (this.player.mods.slingshotCrit > 0 && !b.isCrit) {
                    b.isCrit = true;
                    b.damage *= 2;
                  }
                  b.pierce += this.player.mods.slingshotPierce;
                  b.color = '#e879f9';
                  b.radius = 5.6;
                  this.particles.addShockwave(b.x, b.y, 44, '#e879f9', 0.25, 2);
                  this.audio.playSlingshot();
                }

                // Track visible curvature & Hijack curved enemy bullets so they smash into enemies!
                if (!b.fromPlayer) {
                  const curAng = Math.atan2(b.vy, b.vx);
                  let diff = Math.abs(curAng - b.initAng);
                  if (diff > Math.PI) diff = Math.PI * 2 - diff;
                  if (diff > 0.16) b.curved = true;
                  if (!b.hijacked && (diff > 0.28 || dist < well.slingshotRadius * 1.15)) {
                    b.hijacked = true;
                    b.color = '#ffd166';
                    b.radius = 5.2;
                  }
                }
              }
            }
          }
          if (swallowed) continue;

          // Grav-Repulse Mantle, Pocket Black Hole & Antimatter Barrier deflect/destroy enemy bullets near ship!
          if (!b.fromPlayer) {
            const rdx = b.x - this.player.x;
            const rdy = b.y - this.player.y;
            const rd = Math.hypot(rdx, rdy) || 1;
            const rMult = this.player.mods.auraRadiusMult || 1.0;

            if (this.player.mods.antimatterLevel > 0 && this.player.antimatterTimer <= 0 && b.damage <= 20 && rd < this.player.mods.antimatterRadius * rMult) {
              this.player.antimatterTimer = 1.2 / this.player.mods.antimatterLevel;
              this.particles.burst(b.x, b.y, 8, '#f472b6', 50, 150, 0.28);
              this.bullets.splice(i, 1);
              continue;
            }

            if (this.player.mods.pocketHoleLevel > 0 && rd < 180 * rMult) {
              const swirlPush = (480 + 220 * this.player.mods.pocketHoleLevel) * (1 - rd / (180 * rMult));
              b.vx += (-rdy / rd) * swirlPush * bDt;
              b.vy += (rdx / rd) * swirlPush * bDt;
              b.curved = true;
            }

            if (this.player.mods.repulseAura > 0) {
              const auraR = this.player.mods.repulseRadius * rMult;
              if (rd < auraR) {
                const push = (520 + 260 * this.player.mods.repulseAura) * (1 - rd / auraR);
                b.vx += (rdx / rd) * push * bDt;
                b.vy += (rdy / rd) * push * bDt;
                b.curved = true;
              }
            }
          }

          // Vector Homing gentle steering for player projectiles & hijacked evo bullets
          const homingEff = (b.hijacked && this.player.mods.evoHijackHoming > 0) ? Math.max(b.homing, 2) : b.homing;
          if ((b.fromPlayer || b.hijacked) && homingEff > 0 && !b.isAfterburnMine && this.enemies.length > 0) {
            let bestE = null;
            let bestD = 360;
            for (let ei = 0; ei < this.enemies.length; ei++) {
              const en = this.enemies[ei];
              if (en.dead || b.hitIds.has(en.uid)) continue;
              const ed = Math.hypot(en.x - b.x, en.y - b.y);
              if (ed < bestD) { bestD = ed; bestE = en; }
            }
            if (bestE) {
              const sp = Math.hypot(b.vx, b.vy) || 1;
              const curA = Math.atan2(b.vy, b.vx);
              const tarA = Math.atan2(bestE.y - b.y, bestE.x - b.x);
              let da = tarA - curA;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              const turn = Math.min(3.5 * homingEff * bDt, Math.abs(da)) * Math.sign(da);
              const newA = curA + turn;
              b.vx = Math.cos(newA) * sp;
              b.vy = Math.sin(newA) * sp;
            }
          }

          b.x += b.vx * bDt;
          b.y += b.vy * bDt;
        }

        // Arena wall ricochet or despawn (skip for orbiting bullets)
        let bounced = false;
        if (!b.orbitWell) {
          if (b.x < 8 || b.x > this.bounds.width - 8) {
            if (b.bounces > 0) {
              b.vx = -b.vx;
              b.x = Math.max(8, Math.min(this.bounds.width - 8, b.x));
              b.bounces--;
              bounced = true;
            } else {
              this.bullets.splice(i, 1);
              continue;
            }
          }
          if (b.y < 8 || b.y > this.bounds.height - 8) {
            if (b.bounces > 0) {
              b.vy = -b.vy;
              b.y = Math.max(8, Math.min(this.bounds.height - 8, b.y));
              b.bounces--;
              bounced = true;
            } else {
              this.bullets.splice(i, 1);
              continue;
            }
          }
        }

        if (bounced) {
          this.audio.playDeflect();
          this.particles.burst(b.x, b.y, 5, b.color, 40, 120, 0.2);
          // Smart Prism assist + Fractal Ricochet split
          if (b.fromPlayer) {
            const sp = Math.hypot(b.vx, b.vy);
            let splitBaseA = Math.atan2(b.vy, b.vx);
            if (this.enemies.length > 0) {
              let bestE = this.enemies[0];
              let bestD = Infinity;
              for (const en of this.enemies) {
                const d = Math.hypot(en.x - b.x, en.y - b.y);
                if (d < bestD) { bestD = d; bestE = en; }
              }
              const curA = splitBaseA;
              const tarA = Math.atan2(bestE.y - b.y, bestE.x - b.x);
              let da = tarA - curA;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              splitBaseA = curA + Math.max(-0.45, Math.min(0.45, da));
              b.vx = Math.cos(splitBaseA) * sp;
              b.vy = Math.sin(splitBaseA) * sp;
            }
            // Fractal Ricochet (evoRicochetSplit): split into a homing twin once per bullet bounce chain
            if (!b.isSplitClone && this.player.mods.evoRicochetSplit > 0) {
              const splitA = splitBaseA + (Math.random() < 0.5 ? 0.22 : -0.22);
              this.spawnBullet({
                x: b.x,
                y: b.y,
                vx: Math.cos(splitA) * sp,
                vy: Math.sin(splitA) * sp,
                damage: Math.max(10, Math.round(b.damage * 0.75)),
                radius: b.radius,
                color: '#7df9ff',
                fromPlayer: true,
                bounces: 0,
                homing: Math.max(1, b.homing),
                isSplitClone: true,
                life: 2.0
              });
            }
          }
        }

        // Intercept enemy bullets with Lagrange Drones
        if (!b.fromPlayer) {
          let intercepted = false;
          for (const dr of this.player.drones) {
            if (Math.hypot(b.x - dr.x, b.y - dr.y) < b.radius + 9) {
              this.particles.burst(b.x, b.y, 7, '#00f0ff', 50, 150, 0.25);
              this.audio.playDeflect();
              this.bullets.splice(i, 1);
              intercepted = true;
              break;
            }
          }
          if (intercepted) continue;
        }

        // Hit Enemies (from player OR hijacked enemy bullets!)
        let removed = false;
        if (b.fromPlayer || b.hijacked) {
          for (let ei = 0; ei < this.enemies.length; ei++) {
            const e = this.enemies[ei];
            if (e.dead || b.hitIds.has(e.uid)) continue;

            // Check main body + boss sub-parts
            let hit = Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius;
            if (!hit && e.segments) {
              for (const seg of e.segments) {
                if (Math.hypot(b.x - seg.x, b.y - seg.y) < b.radius + seg.radius) {
                  hit = true;
                  break;
                }
              }
            }
            if (!hit && e.type === 'boss_archon') {
              for (const sgn of [-1, 1]) {
                const cx = e.x + Math.cos(e.orbitAngle) * e.twinDist * sgn;
                const cy = e.y + Math.sin(e.orbitAngle) * e.twinDist * sgn;
                if (Math.hypot(b.x - cx, b.y - cy) < b.radius + 24) hit = true;
              }
            }

            if (hit) {
              // Check Phalanx Frontal Energy Shield reflection!
              if (e.type === 'phalanx' && !b.slingshotBoosted) {
                const hitAng = Math.atan2(b.y - e.y, b.x - e.x);
                let diff = hitAng - e.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < 1.12) {
                  // Reflect off frontal shield!
                  const nx = Math.cos(hitAng);
                  const ny = Math.sin(hitAng);
                  const dot = b.vx * nx + b.vy * ny;
                  b.vx -= 2 * dot * nx;
                  b.vy -= 2 * dot * ny;
                  b.x = e.x + nx * (e.radius + b.radius + 5);
                  b.y = e.y + ny * (e.radius + b.radius + 5);
                  this.audio.playDeflect();
                  this.particles.burst(b.x, b.y, 8, '#7df9ff', 60, 180, 0.25);
                  this.particles.addText(b.x, b.y - 12, 'ЩИТ!', '#7df9ff', 0.85, 0.55);
                  break;
                }
              }

              b.hitIds.add(e.uid);
              let finalDmg = b.damage;
              let label = null;
              let col = '#ffffff';

              if (b.hijacked) {
                finalDmg = Math.round(b.damage * this.player.mods.hijackMult * 1.8);
                label = 'КОНТР-ИМПУЛЬС!';
                col = '#ffd166';
                this.stats.hijacks++;
                const hijackHeal = this.player.mods.hijackShieldHeal + (this.player.mods.evoHijackHoming > 0 ? 5 : 0);
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + hijackHeal);
                if (this.player.mods.evoHijackHoming > 0) {
                  for (let sk = 0; sk < 2; sk++) {
                    const sa = Math.random() * Math.PI * 2;
                    this.spawnBullet({
                      x: b.x,
                      y: b.y,
                      vx: Math.cos(sa) * 560,
                      vy: Math.sin(sa) * 560,
                      damage: Math.max(12, Math.round(finalDmg * 0.45)),
                      radius: 3.6,
                      color: '#ffd166',
                      fromPlayer: true,
                      homing: 2,
                      isSplitClone: true,
                      life: 1.2
                    });
                  }
                }
              } else if (b.slingshotBoosted) {
                label = 'ОРБИТАЛЬНЫЙ!';
                col = '#e879f9';
              } else if (b.isCrit) {
                label = 'КРИТ!';
                col = '#ffd166';
              }

              this.damageEnemy(e, finalDmg, col, label);

              // Quantum Railgun Slingshot (evoSlingshotRail): 100px plasma splash on slingshot hit
              if (b.slingshotBoosted && this.player.mods.evoSlingshotRail > 0) {
                const railDmg = Math.max(12, Math.round(finalDmg * 0.6));
                this.particles.addShockwave(b.x, b.y, 100, '#e879f9', 0.25, 2.2);
                for (let ri = this.enemies.length - 1; ri >= 0; ri--) {
                  const re = this.enemies[ri];
                  if (re !== e && !re.dead && Math.hypot(re.x - b.x, re.y - b.y) <= 100 + re.radius) {
                    this.damageEnemy(re, railDmg, '#e879f9');
                  }
                }
              }

              // Ignite burn, Frost slow & Plasma Splash on hit
              if (b.ignite > 0 && !e.dead) {
                e.burnTimer = Math.max(e.burnTimer || 0, 3.0);
                e.burnDps = Math.max(e.burnDps || 0, Math.round(16 * b.ignite * this.player.mods.damageMult));
              }
              if (b.frost > 0 && !e.dead) {
                e.cryoTimer = Math.max(e.cryoTimer || 0, 2.0);
                e.cryoSlow = Math.max(e.cryoSlow || 0, 0.35);
              }
              if (b.splash > 0) {
                const spR = 50 + (b.splash - 1) * 18;
                const spDmg = Math.max(8, Math.round(finalDmg * 0.45));
                this.particles.addShockwave(b.x, b.y, spR, b.color, 0.22, 1.8);
                for (let si = this.enemies.length - 1; si >= 0; si--) {
                  const se = this.enemies[si];
                  if (se !== e && !se.dead && Math.hypot(se.x - b.x, se.y - b.y) <= spR + se.radius) {
                    this.damageEnemy(se, spDmg, b.color);
                  }
                }
              }

              // Critical Resonance AoE blast + shield repair (+ 125px & guaranteed lightning on evoCritExecute)
              if (b.isCrit && (this.player.mods.critNova > 0 || this.player.mods.evoCritExecute > 0)) {
                const critR = this.player.mods.evoCritExecute > 0 ? 125 : 68;
                const novaDmg = Math.round(finalDmg * 0.45);
                this.particles.addShockwave(b.x, b.y, critR, '#ffd166', 0.25, 2.2);
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + 2 * Math.max(1, this.player.mods.critNova));
                for (let ci = 0; ci < this.enemies.length; ci++) {
                  const ce = this.enemies[ci];
                  if (ce !== e && !ce.dead && Math.hypot(ce.x - b.x, ce.y - b.y) <= critR + ce.radius) {
                    this.damageEnemy(ce, novaDmg, '#ffd166');
                  }
                }
              }

              this.particles.burst(b.x, b.y, b.slingshotBoosted ? 12 : 6, b.color, 50, 190, 0.3);
              if (this.player.mods.projSpeedMult > 1.1 || b.slingshotBoosted) {
                this.grid.applyRadialForce(b.x, b.y, 240, 85, 195);
              }

              if (b.slingshotBoosted || b.hijacked || this.player.mods.chainTargets > 0 || (b.isCrit && this.player.mods.evoCritExecute > 0)) {
                this.triggerChainLightning(e, finalDmg);
              }

              if (b.pierce > 0) {
                b.pierce--;
              } else {
                this.bullets.splice(i, 1);
                removed = true;
                break;
              }
            }
          }
        }

        if (removed) continue;

        // Enemy bullet hitting Player
        if (!b.fromPlayer && !b.hijacked) {
          if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < b.radius + this.player.radius - 2) {
            this.player.takeDamage(b.damage, this.particles, this.audio, this);
            this.bullets.splice(i, 1);
          }
        }
      }

      // Update XP Crystals & Heal Pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.life -= dt;
        if (pk.life <= 0) {
          this.pickups.splice(i, 1);
          continue;
        }

        // Vacuum Collector: Black Holes pull & teleport XP crystals straight to player
        let collectedByWell = false;
        if (this.player.mods.wellXpVacuum > 0 && pk.kind === 'xp') {
          for (let wi = 0; wi < this.wells.length; wi++) {
            const w = this.wells[wi];
            if (w.polarity <= 0) continue;
            const wdx = w.x - pk.x;
            const wdy = w.y - pk.y;
            const wd = Math.hypot(wdx, wdy) || 1;
            if (wd < w.influenceRadius) {
              const pull = (w.influenceRadius + 20 - wd) * 18;
              pk.vx += (wdx / wd) * pull * dt;
              pk.vy += (wdy / wd) * pull * dt;
            }
            if (wd < w.coreRadius + 14) {
              this.gainXP(pk.val);
              if (typeof this.audio.playPickup === 'function') this.audio.playPickup(this.combo);
              if (this.player.mods.xpHeal > 0) {
                const gained = Math.min(this.player.maxHp - this.player.hp, this.player.mods.xpHeal);
                this.player.hp += gained;
                this.player.healBuffer += gained;
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.mods.xpHeal * 1.35);
              }
              this.pickups.splice(i, 1);
              collectedByWell = true;
              break;
            }
          }
        }
        if (collectedByWell) continue;

        const dx = this.player.x - pk.x;
        const dy = this.player.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        const magnetR = 260 + this.player.mods.pickupRadiusBonus;
        if (pk.autoCollect) {
          pk.vx += (dx / d) * 1800 * dt;
          pk.vy += (dy / d) * 1800 * dt;
        } else if (d < magnetR) {
          const pull = (magnetR + 10 - d) * 16;
          pk.vx += (dx / d) * pull * dt;
          pk.vy += (dy / d) * pull * dt;
        }
        pk.vx *= Math.exp(-3.5 * dt);
        pk.vy *= Math.exp(-3.5 * dt);
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;

        if (d < this.player.radius + (pk.autoCollect ? 18 : 14)) {
          if (typeof this.audio.playPickup === 'function') this.audio.playPickup(this.combo);
          if (pk.kind === 'xp') {
            this.gainXP(pk.val);
            if (this.player.mods.xpHeal > 0) {
              const gained = Math.min(this.player.maxHp - this.player.hp, this.player.mods.xpHeal);
              this.player.hp += gained;
              this.player.healBuffer += gained;
              this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.mods.xpHeal * 1.35);
            }
          } else {
            const gained = Math.min(this.player.maxHp - this.player.hp, pk.val);
            this.player.hp += gained;
            this.player.healBuffer += gained;
            this.particles.addText(this.player.x, this.player.y - 22, `+${pk.val} КОРПУС`, '#22ffa6', 1.0);
          }
          this.pickups.splice(i, 1);
        }
      }

      // Combo decay & Screen shake decay
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
      } else {
        this.combo = Math.max(1.0, this.combo - dt * 0.6);
        if (this.combo < 1.8) this.comboTier = 0;
      }

      this.screenShake = Math.max(0, this.screenShake - dt * 38);
      this.grid.update(dt);
      this.particles.update(dt, this.wells);

      if (this.player.hp <= 0) {
        this.triggerGameOver();
      }

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = this.getPreset().hudInterval;
        this.updateHUD();
      }
    }

    updatePlayerAuras(dt, worldDt) {
      const p = this.player;
      const m = p.mods;
      const rMult = m.auraRadiusMult || 1.0;
      const fortressBoost = (m.fortressLevel > 0 && p.hp / p.maxHp >= 0.7) ? (1 + 0.45 * m.fortressLevel) : 1.0;
      const auraPower = (m.auraDpsMult || 1.0) * fortressBoost;

      const cryoR = m.cryoRadius * rMult;
      const coronaR = m.coronaRadius * rMult;
      const entropyR = m.entropyRadius * rMult;
      const stormR = m.stormRadius * rMult;
      const repulseR = m.repulseRadius * rMult;
      const radR = m.radRadius * rMult;
      const novaR = m.novaRadius * rMult;
      const pullR = m.vortexPullRadius * rMult;
      const beamR = m.beamRadius * rMult;
      const empR = m.empRadius * rMult;
      const sanctR = 190 * rMult;

      const beamCandidates = [];
      let anyNearSanctuary = false;

      // 1. Continuous aura effects (Corona, Cryo, Entropy, Radiation, Vortex Pull, Sanctuary check, Quantum Beam targets)
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);

        if (m.sanctuaryLevel > 0 && d <= sanctR + e.radius) {
          anyNearSanctuary = true;
        }
        if (m.beamLevel > 0 && d <= beamR + e.radius) {
          beamCandidates.push({ enemy: e, dist: d });
        }
        if (m.vortexPullRadius > 0 && d <= pullR + e.radius && d > 42) {
          const pull = 150 + 55 * m.vortexPullLevel;
          e.vx += ((p.x - e.x) / d) * pull * worldDt;
          e.vy += ((p.y - e.y) / d) * pull * worldDt;
        }

        if (m.cryoRadius > 0 && d <= cryoR + e.radius) {
          e.cryoTimer = 0.22;
          e.cryoSlow = m.cryoSlow;
        }

        if (m.radRadius > 0 && d <= radR + e.radius) {
          e.radStacks = Math.min(25, (e.radStacks || 0) + m.radLevel * dt * 1.8);
        } else if (e.radStacks > 0) {
          e.radStacks = Math.max(0, e.radStacks - dt * 0.6);
        }
        if (m.evoRadiationMeltdown > 0 && e.radStacks >= 12) {
          e.radStacks = 0;
          const meltDmg = Math.round(220 * auraPower);
          this.particles.addShockwave(e.x, e.y, 150, '#a3e635', 0.36, 2.8);
          for (let ri = this.enemies.length - 1; ri >= 0; ri--) {
            const re = this.enemies[ri];
            if (!re.dead && Math.hypot(re.x - e.x, re.y - e.y) <= 150 + re.radius) {
              re.radStacks = Math.min(25, (re.radStacks || 0) + 4);
              this.damageEnemy(re, meltDmg, '#a3e635', 'РАСПАД!');
            }
          }
          if (e.dead) continue;
        }
        if (e.radStacks > 0) {
          e.hp -= e.radStacks * 14 * auraPower * worldDt;
          if (e.hp <= 0) {
            this.killEnemy(e);
            continue;
          }
        }

        if (m.coronaRadius > 0 && d <= coronaR + e.radius) {
          const thermalMult = (e.cryoTimer > 0 && m.thermalShock > 0) ? (1 + 1.2 * m.thermalShock) : 1.0;
          const burnDmg = m.coronaDps * auraPower * thermalMult * worldDt;
          e.hp -= burnDmg;
          if (Math.random() < 0.25) {
            this.particles.spawn(e.x, e.y, (Math.random() - 0.5) * 60, -40 - Math.random() * 50, {
              size: 2.2, life: 0.28, color: '#ff8538', streak: false, gravScale: 0
            });
          }
          if (e.hp <= 0) {
            this.killEnemy(e);
            continue;
          }
        }

        if (m.entropyRadius > 0 && d <= entropyR + e.radius) {
          const entMult = m.evoEntropyTether > 0 ? 2.0 : 1.0;
          const drain = m.entropyDps * auraPower * worldDt;
          e.hp -= drain;
          p.shield = Math.min(p.maxShield, p.shield + drain * 0.18 * entMult);
          const gained = Math.min(p.maxHp - p.hp, drain * 0.06 * entMult);
          p.hp += gained;
          p.healBuffer += gained;
          if (Math.random() < 0.28) {
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            this.particles.spawn(e.x, e.y, Math.cos(ang) * 180, Math.sin(ang) * 180, {
              size: 2.0, life: 0.25, color: '#ff3b6b', streak: true, gravScale: 0
            });
          }
          if (e.hp <= 0) {
            this.killEnemy(e);
          }
        }
      }

      // Corona Hypernova periodic scorching ring (evoCoronaSupernova)
      if (m.evoCoronaSupernova > 0 && m.coronaRadius > 0 && p.coronaNovaTimer <= 0 && this.enemies.length > 0) {
        p.coronaNovaTimer = 3.0;
        const cNovaR = coronaR * 1.3;
        const cNovaDmg = Math.round(60 * auraPower);
        this.particles.addShockwave(p.x, p.y, cNovaR, '#ff8538', 0.42, 3.0);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= cNovaR + e.radius) {
            e.burnTimer = Math.max(e.burnTimer || 0, 3.5);
            e.burnDps = Math.max(e.burnDps || 0, Math.round(24 * auraPower));
            this.damageEnemy(e, cNovaDmg, '#ff8538');
          }
        }
      }

      p.inSanctuary = !anyNearSanctuary;
      const beamLimit = m.evoBeamPrism > 0 ? 3 : 1;
      beamCandidates.sort((a, b) => a.dist - b.dist);
      p.beamTargets = beamCandidates.slice(0, beamLimit).map(c => c.enemy);
      p.beamTarget = p.beamTargets[0] || null;
      if (m.beamLevel > 0 && p.beamTargets.length > 0) {
        const beamDmg = 48 * m.beamLevel * m.damageMult * auraPower * worldDt;
        for (let bi = 0; bi < p.beamTargets.length; bi++) {
          const bt = p.beamTargets[bi];
          if (!bt || bt.dead) continue;
          bt.hp -= beamDmg;
          bt.cryoTimer = Math.max(bt.cryoTimer || 0, 0.14);
          bt.cryoSlow = Math.max(bt.cryoSlow || 0, 0.25);
          if (Math.random() < 0.35) {
            this.particles.burst(bt.x, bt.y, 2, m.evoBeamPrism > 0 ? '#ffd166' : '#7df9ff', 40, 120, 0.2);
          }
          if (bt.hp <= 0) {
            this.killEnemy(bt);
          }
        }
        p.beamTargets = p.beamTargets.filter(bt => !bt.dead);
        p.beamTarget = p.beamTargets[0] || null;
      }

      // 2. Storm Coil periodic multi-target lightning zap (+ Resonance Echo + evoStormChain stun/chain)
      if (m.stormLevel > 0 && p.stormTimer <= 0 && this.enemies.length > 0) {
        const inRange = [];
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= stormR + e.radius) {
            inRange.push(e);
          }
        }
        if (inRange.length > 0) {
          p.stormTimer = Math.max(0.38, 0.9 - m.stormLevel * 0.12);
          const maxHits = Math.min(inRange.length, 1 + m.stormLevel);
          const zapDmg = Math.round(32 * m.stormLevel * m.damageMult * auraPower);
          for (let k = 0; k < maxHits; k++) {
            const target = inRange[k];
            const echoMult = (m.resonanceEcho > 0 && Math.random() < 0.4) ? (1 + m.resonanceEcho) : 1;
            this.particles.addLightning(p.x, p.y, target.x, target.y, '#7df9ff', 0.22);
            if (m.evoStormChain > 0 && !target.dead) {
              target.stunTimer = Math.max(target.stunTimer, 0.4);
            }
            this.damageEnemy(target, zapDmg * echoMult, '#7df9ff');
            if (m.evoStormChain > 0) {
              const prevChains = m.chainTargets;
              m.chainTargets = Math.max(prevChains, 3);
              this.triggerChainLightning(target, zapDmg * 0.8);
              m.chainTargets = prevChains;
            }
          }
          this.audio.playDeflect();
        }
      }

      // 3. Grav-Repulse Mantle periodic knockback shockwave (+ Mirror Horizon bullet reflect)
      if (m.repulseAura > 0 && p.repulseTimer <= 0 && (this.enemies.length > 0 || (m.evoRepulseReflect > 0 && this.bullets.length > 0))) {
        let hitAny = false;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (e.dead) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= repulseR + e.radius) {
            hitAny = true;
            const push = (e.isBoss ? 140 : 420) + m.repulseAura * 95;
            e.vx += (dx / d) * push;
            e.vy += (dy / d) * push;
            this.damageEnemy(e, Math.round(14 * m.repulseAura * auraPower), '#d98aff');
          }
        }
        if (m.evoRepulseReflect > 0) {
          for (let bi = 0; bi < this.bullets.length; bi++) {
            const b = this.bullets[bi];
            if (!b.fromPlayer && !b.hijacked && Math.hypot(b.x - p.x, b.y - p.y) <= repulseR) {
              hitAny = true;
              b.hijacked = true;
              b.vx = -b.vx * 1.8;
              b.vy = -b.vy * 1.8;
              b.color = '#ffd166';
              b.homing = Math.max(b.homing, 1);
            }
          }
        }
        if (hitAny) {
          p.repulseTimer = Math.max(1.3, 2.5 - m.repulseAura * 0.3);
          this.particles.addShockwave(p.x, p.y, repulseR, '#c06cff', 0.32, 2.4);
          this.grid.applyRadialForce(p.x, p.y, 750, repulseR * 1.1, 275);
        }
      }

      // 4. Pulsing Nova periodic expanding wave
      if (m.novaLevel > 0 && p.novaTimer <= 0 && this.enemies.length > 0) {
        p.novaTimer = Math.max(1.4, 3.2 - m.novaLevel * 0.45);
        this.particles.addShockwave(p.x, p.y, novaR, '#ff9e2c', 0.44, 3.2);
        this.grid.applyRadialForce(p.x, p.y, 1100, novaR * 1.15, 34);
        const novaDmg = Math.round(52 * m.novaLevel * auraPower);
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (e.dead) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= novaR + e.radius) {
            e.vx += (dx / d) * 340;
            e.vy += (dy / d) * 340;
            this.damageEnemy(e, novaDmg, '#ff9e2c');
          }
        }
      }

      // 4b. EMP Field periodic stun + projectile clear
      if (m.empLevel > 0 && p.empTimer <= 0 && this.enemies.length > 0) {
        p.empTimer = Math.max(2.2, 3.5 - (m.empLevel - 1) * 0.45);
        this.particles.addShockwave(p.x, p.y, empR, '#38bdf8', 0.35, 2.6);
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= empR + e.radius) {
            e.stunTimer = Math.max(e.stunTimer, 0.7 + (m.empLevel - 1) * 0.2);
          }
        }
        for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
          const b = this.bullets[bi];
          if (!b.fromPlayer && !b.hijacked && Math.hypot(b.x - p.x, b.y - p.y) <= empR) {
            this.bullets.splice(bi, 1);
          }
        }
      }

      // 4c. Solar Flare periodic igniting fire ring
      if (m.solarFlareLevel > 0 && p.flareTimer <= 0 && this.enemies.length > 0) {
        p.flareTimer = Math.max(2.8, 4.5 - (m.solarFlareLevel - 1) * 0.5);
        const flareR = 220 * rMult;
        this.particles.addShockwave(p.x, p.y, flareR, '#ff6b35', 0.45, 3.0);
        const fDmg = Math.round(38 * m.solarFlareLevel * auraPower);
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= flareR + e.radius) {
            e.burnTimer = Math.max(e.burnTimer || 0, 3.0);
            e.burnDps = Math.max(e.burnDps || 0, Math.round(18 * m.solarFlareLevel * auraPower));
            this.damageEnemy(e, fDmg, '#ff8538');
          }
        }
      }

      // 4d. Crimson Leech Nova: bursts every 30 HP healed
      if (m.leechNova > 0 && p.healBuffer >= 30) {
        while (p.healBuffer >= 30) {
          p.healBuffer -= 30;
          const leechDmg = Math.round(55 * m.leechNova * m.damageMult);
          this.particles.addShockwave(p.x, p.y, 180, '#ff3b6b', 0.36, 2.8);
          for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= 180 + e.radius) {
              this.damageEnemy(e, leechDmg, '#ff3b6b');
            }
          }
        }
      }

      // 5. Lagrange Drone Turrets auto-fire (+ Drone Laser pierce & Overdrive homing shots)
      if (m.droneTurrets > 0 && p.drones.length > 0 && p.droneFireTimer <= 0 && this.enemies.length > 0) {
        p.droneFireTimer = Math.max(0.28, 0.72 - m.droneTurrets * 0.14);
        const laserMult = 1 + (m.droneLaser || 0) * 0.35;
        for (let di = 0; di < p.drones.length; di++) {
          const dr = p.drones[di];
          let nearest = null;
          let minD = 460;
          for (let ei = 0; ei < this.enemies.length; ei++) {
            const en = this.enemies[ei];
            if (en.dead) continue;
            const d = Math.hypot(en.x - dr.x, en.y - dr.y);
            if (d < minD) { minD = d; nearest = en; }
          }
          if (nearest) {
            const a = SG.solveInterceptAngle(dr.x, dr.y, nearest.x, nearest.y, nearest.vx, nearest.vy, 640);
            this.spawnBullet({
              x: dr.x,
              y: dr.y,
              vx: Math.cos(a) * 640,
              vy: Math.sin(a) * 640,
              damage: Math.round((14 + m.droneTurrets * 6) * m.damageMult * laserMult),
              radius: m.droneLaser > 0 ? 4.2 : 3.4,
              color: m.evoDronesOverdrive > 0 ? '#ffd166' : (m.droneLaser > 0 ? '#7df9ff' : '#00f0ff'),
              pierce: m.droneLaser || 0,
              homing: m.evoDronesOverdrive > 0 ? 1 : 0,
              fromPlayer: true,
              life: 1.5
            });
          }
        }
      }
    }

    pointToSegmentDist(px, py, x1, y1, x2, y2) {
      const vx = x2 - x1;
      const vy = y2 - y1;
      const wx = px - x1;
      const wy = py - y1;
      const c1 = wx * vx + wy * vy;
      if (c1 <= 0) return Math.hypot(px - x1, py - y1);
      const c2 = vx * vx + vy * vy;
      if (c2 <= c1) return Math.hypot(px - x2, py - y2);
      const b = c1 / c2;
      return Math.hypot(px - (x1 + b * vx), py - (y1 + b * vy));
    }

    updateHUD() {
      const els = this.hudEls;
      if (els.hud) els.hud.hidden = (this.state === 'title');
      if (els.fpsBadge) els.fpsBadge.hidden = !this.settings.showFps || this.state === 'title';
      const touchEl = document.getElementById('touch-controls');
      if (touchEl) touchEl.hidden = !(this.isTouchDevice && this.state === 'playing');
      const pillsEl = document.querySelector('.ability-pills');
      if (pillsEl) pillsEl.hidden = this.isTouchDevice;

      const p = this.player;
      if (!p) return;

      if (els.barHp) els.barHp.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
      if (els.valHp) els.valHp.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;

      if (els.barShield) els.barShield.style.width = `${Math.max(0, (p.shield / p.maxShield) * 100)}%`;
      if (els.valShield) els.valShield.textContent = `${Math.ceil(p.shield)}`;

      if (els.barChrono) els.barChrono.style.width = `${Math.max(0, (p.chrono / p.maxChrono) * 100)}%`;
      if (els.barXp) els.barXp.style.width = `${Math.min(100, (this.xp / this.xpNext) * 100)}%`;

      if (els.score) els.score.textContent = this.score.toLocaleString('ru-RU');
      if (els.combo) els.combo.textContent = `×${this.combo.toFixed(1)}`;
      if (els.wave) els.wave.textContent = `ВОЛНА ${this.wave}`;
      if (els.level) els.level.textContent = `УР. ${this.level}`;

      if (els.dash) {
        els.dash.textContent = p.dashCooldown > 0
          ? `[Shift] Рывок: ${p.dashCooldown.toFixed(1)}с`
          : '[Shift] Рывок: ГОТОВ';
        els.dash.classList.toggle('ready', p.dashCooldown <= 0);
      }

      if (els.rewind) {
        els.rewind.textContent = p.rewindCooldown > 0
          ? `[Q] Откат: ${p.rewindCooldown.toFixed(1)}с`
          : '[Q] Откат: ГОТОВ';
        els.rewind.classList.toggle('ready', p.rewindCooldown <= 0);
      }

      if (els.detonate) {
        els.detonate.textContent = p.detonateCooldown > 0
          ? `[E] Взрыв: ${p.detonateCooldown.toFixed(1)}с`
          : '[E] Взрыв: ГОТОВ';
        els.detonate.classList.toggle('ready', p.detonateCooldown <= 0);
      }

      if (els.wellCd) {
        els.wellCd.textContent = p.wellCooldown > 0
          ? `[ПКМ] Дыра: ${p.wellCooldown.toFixed(1)}с`
          : '[ПКМ] Дыра: ГОТОВА';
        els.wellCd.classList.toggle('ready', p.wellCooldown <= 0);
      }

      if (this._buildDirty && els.buildStrip) {
        this._buildDirty = false;
        els.buildStrip.innerHTML = '';
        const entries = Object.entries(this.upgradeStacks);
        entries.sort((a, b) => {
          const ea = this.evolvedUpgrades.has(a[0]) ? 1 : 0;
          const eb = this.evolvedUpgrades.has(b[0]) ? 1 : 0;
          return eb - ea || b[1] - a[1];
        });
        const maxVisible = 14;
        entries.slice(0, maxVisible).forEach(([id, lvl]) => {
          const def = SG.UPGRADES.find(u => u.id === id);
          if (!def) return;
          const evolved = this.evolvedUpgrades.has(id);
          const chip = document.createElement('span');
          chip.className = `hud-mod-chip${evolved ? ' evolved' : ''}`;
          chip.textContent = evolved ? `${def.icon} MAX` : `${def.icon}×${lvl}`;
          chip.title = evolved && def.evolution
            ? `${def.evolution.title}: ${def.evolution.perk}`
            : `${def.title} (${lvl}/${def.maxStacks}): ${def.desc}`;
          els.buildStrip.appendChild(chip);
        });
        if (entries.length > maxVisible) {
          const more = document.createElement('span');
          more.className = 'hud-mod-chip';
          more.textContent = `+${entries.length - maxVisible}`;
          els.buildStrip.appendChild(more);
        }
      }

      if (els.aiBtn) {
        els.aiBtn.classList.toggle('active', this.autopilot.enabled);
        els.aiBtn.textContent = this.autopilot.enabled ? 'ИИ: ВКЛ [P]' : 'ИИ-Пилот [P]';
      }

      if (els.polBtn) {
        els.polBtn.textContent = this.repulsorMode ? 'Белая дыра [R]' : 'Черная дыра [R]';
        els.polBtn.classList.toggle('repulsor', this.repulsorMode);
      }

      if (els.aiBanner) {
        els.aiBanner.hidden = !this.autopilot.enabled;
        if (this.autopilot.enabled) {
          els.aiBanner.textContent = `ИИ-ТЕЛЕМЕТРИЯ: ${this.autopilot.decisionLabel}`;
        }
      }
    }

    render() {
      const ctx = this.ctx;
      const w = this.bounds.width;
      const h = this.bounds.height;
      const preset = this.getPreset();
      const useGpu = !!(this.gpu && this.gpu.isActive());
      const nowSec = performance.now() * 0.001;

      let shakeX = 0;
      let shakeY = 0;
      if (this.screenShake > 0.2) {
        shakeX = (Math.random() - 0.5) * this.screenShake * 1.6;
        shakeY = (Math.random() - 0.5) * this.screenShake * 1.6;
      }

      if (useGpu) {
        this.gpu.renderFrame({
          width: w,
          height: h,
          dpr: this.dpr,
          timeSec: nowSec,
          timeScale: this.timeScale,
          shakeX,
          shakeY,
          stars: this.stars,
          grid: this.grid,
          particles: this.particles,
          wells: this.wells,
          bullets: this.bullets,
          enemies: this.enemies,
          pickups: this.pickups,
          player: this.player,
          autopilot: this.autopilot,
          state: this.state,
          quality: this.settings.quality,
          preset
        });
      }

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      if (useGpu) {
        // Transparent 2D overlay: ONLY trajectory preview, floating texts, boss label, and crosshair!
        ctx.clearRect(0, 0, w, h);
        if (shakeX !== 0 || shakeY !== 0) ctx.translate(shakeX, shakeY);
      } else {
        // 2D Fallback Background, Stars & Spacetime Grid
        if (this.settings.quality === 'low') {
          ctx.fillStyle = this.timeScale < 0.65 ? '#070515' : '#040814';
        } else {
          ctx.fillStyle = (this.timeScale < 0.65 ? this.bgGradSlow : this.bgGradNormal) || '#040814';
        }
        ctx.fillRect(0, 0, w, h);

        if (shakeX !== 0 || shakeY !== 0) ctx.translate(shakeX, shakeY);

        const starTime = nowSec * 2;
        ctx.fillStyle = '#d8ecff';
        for (let i = 0; i < this.stars.length; i++) {
          const s = this.stars[i];
          ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(starTime + s.twinkle));
          ctx.fillRect(s.nx * w, s.ny * h, s.size, s.size);
        }
        ctx.globalAlpha = 1;

        this.grid.render(ctx, this.timeScale, this.settings.quality);

        // Binary Star Plasma Bridges
        if (this.player && this.player.mods.binaryBridge > 0 && this.wells.length >= 2) {
          ctx.save();
          if (this.settings.quality !== 'low') ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < this.wells.length; i++) {
            for (let j = i + 1; j < this.wells.length; j++) {
              const w1 = this.wells[i];
              const w2 = this.wells[j];
              if (Math.hypot(w2.x - w1.x, w2.y - w1.y) < 560) {
                ctx.strokeStyle = 'rgba(185, 92, 255, 0.55)';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(w1.x, w1.y);
                ctx.lineTo(w2.x, w2.y);
                ctx.stroke();

                ctx.strokeStyle = '#7df9ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w1.x, w1.y);
                ctx.lineTo(w2.x, w2.y);
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }

        // Gravity Wells
        for (let i = 0; i < this.wells.length; i++) {
          this.wells[i].render(ctx);
        }
      }

      // Real-time Relativistic Curved Aim Trajectory Preview (batched into 2 paths!)
      if (this.state === 'playing' && this.wells.length > 0 && this.settings.trajectoryPreview) {
        const p = this.player;
        const speed = 680 * p.mods.projSpeedMult;
        const pts = SG.computeCurvedTrajectory(
          p.x + Math.cos(p.aimAngle) * 18,
          p.y + Math.sin(p.aimAngle) * 18,
          Math.cos(p.aimAngle) * speed,
          Math.sin(p.aimAngle) * speed,
          this.wells,
          this.bounds,
          36,
          0.017,
          p.mods.bounces
        );
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.24)';
        ctx.beginPath();
        for (let k = 1; k < pts.length; k++) {
          if (!pts[k].boosted) {
            ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
            ctx.lineTo(pts[k].x, pts[k].y);
          }
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(232, 121, 249, 0.62)';
        ctx.beginPath();
        for (let k = 1; k < pts.length; k++) {
          if (pts[k].boosted) {
            ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
            ctx.lineTo(pts[k].x, pts[k].y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      if (!useGpu) {
        // Batched Pickups (XP Crystals in 1 draw call + Repair Orbs)
        if (this.pickups.length > 0) {
          ctx.fillStyle = '#00ffa6';
          ctx.beginPath();
          let hasHeal = false;
          for (let i = 0; i < this.pickups.length; i++) {
            const pk = this.pickups[i];
            if (pk.kind === 'xp') {
              ctx.moveTo(pk.x, pk.y - 5);
              ctx.lineTo(pk.x + 4.5, pk.y);
              ctx.lineTo(pk.x, pk.y + 5);
              ctx.lineTo(pk.x - 4.5, pk.y);
              ctx.closePath();
            } else {
              hasHeal = true;
            }
          }
          ctx.fill();

          if (hasHeal) {
            ctx.fillStyle = '#22ffa6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < this.pickups.length; i++) {
              const pk = this.pickups[i];
              if (pk.kind !== 'xp') {
                ctx.beginPath();
                ctx.arc(pk.x, pk.y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
          }
        }

        // Bullets & Relativistic Trails (zero shadowBlur!)
        if (this.bullets.length > 0) {
          ctx.save();
          if (preset.bulletGlow) {
            ctx.globalCompositeOperation = 'lighter';
          }
          for (let i = 0; i < this.bullets.length; i++) {
            const b = this.bullets[i];
            if (preset.bulletTrails && b.trail.length > 1) {
              ctx.strokeStyle = b.color;
              ctx.globalAlpha = 0.45;
              ctx.lineWidth = b.radius * 1.15;
              ctx.beginPath();
              ctx.moveTo(b.trail[0].x, b.trail[0].y);
              for (let t = 1; t < b.trail.length; t++) {
                ctx.lineTo(b.trail[t].x, b.trail[t].y);
              }
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
            if (preset.bulletGlow) {
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = b.color;
              ctx.beginPath();
              ctx.arc(b.x, b.y, b.radius * 2.15, 0, Math.PI * 2);
              ctx.fill();

              ctx.globalAlpha = 1;
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = b.color;
              ctx.fillRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
            }
          }
          ctx.restore();
        }

        // Enemies
        for (let i = 0; i < this.enemies.length; i++) {
          SG.renderEnemy(ctx, this.enemies[i]);
        }

        // Player & AI Telemetry Overlay
        if (this.state === 'playing' || this.state === 'upgrade' || this.state === 'paused') {
          this.autopilot.renderTelemetry(ctx, this.player);
          this.player.render(ctx);
        }
      }

      // Particles/Shockwaves/Lightnings (onlyTexts when GPU active)
      this.particles.render(ctx, {
        onlyTexts: useGpu,
        skipParticles: useGpu,
        fastMode: this.settings.quality === 'low'
      });

      // Sniper Lock-On Warning Brackets & Perimeter Threat Radar Chevrons
      if (this.state === 'playing' && this.player) {
        const px = this.player.x;
        const py = this.player.y;
        let sniperDanger = 0;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (e.dead) continue;
          if (e.type === 'sniper' && e.chargeTimer > 0 && e.chargeTimer < 0.55) {
            sniperDanger = Math.max(sniperDanger, 1 - e.chargeTimer / 0.55);
          }
          const dx = e.x - px;
          const dy = e.y - py;
          const dist = Math.hypot(dx, dy);
          if (e.isBoss || dist > 460) {
            const ang = Math.atan2(dy, dx);
            const r = e.isBoss ? 54 : 44;
            const cx = px + Math.cos(ang) * r;
            const cy = py + Math.sin(ang) * r;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);
            ctx.fillStyle = e.isBoss ? '#ffb838' : 'rgba(255, 95, 125, 0.72)';
            ctx.beginPath();
            const sz = e.isBoss ? 6.5 : 4.2;
            ctx.moveTo(sz, 0);
            ctx.lineTo(-sz, sz * 0.72);
            ctx.lineTo(-sz * 0.45, 0);
            ctx.lineTo(-sz, -sz * 0.72);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
        if (sniperDanger > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 158, 44, ${(0.35 + 0.5 * sniperDanger).toFixed(2)})`;
          ctx.lineWidth = 2;
          const br = 28 - sniperDanger * 6;
          ctx.beginPath();
          ctx.moveTo(px - br, py - br + 7); ctx.lineTo(px - br, py - br); ctx.lineTo(px - br + 7, py - br);
          ctx.moveTo(px + br - 7, py - br); ctx.lineTo(px + br, py - br); ctx.lineTo(px + br, py - br + 7);
          ctx.moveTo(px + br, py + br - 7); ctx.lineTo(px + br, py + br); ctx.lineTo(px + br - 7, py + br);
          ctx.moveTo(px - br + 7, py + br); ctx.lineTo(px - br, py + br); ctx.lineTo(px - br, py + br - 7);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Boss Health Bar at bottom-center (bar drawn by GPU when useGpu, label drawn here)
      const boss = this.enemies.find(e => e.isBoss && !e.dead);
      if (boss) {
        const bw = Math.min(480, w * 0.62);
        const bx = (w - bw) * 0.5;
        const by = h - 42;
        if (!useGpu) {
          ctx.fillStyle = 'rgba(6, 10, 24, 0.82)';
          ctx.strokeStyle = 'rgba(255, 59, 107, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.fillRect(bx, by, bw, 12);
          ctx.strokeRect(bx, by, bw, 12);
          ctx.fillStyle = boss.color;
          ctx.fillRect(bx + 2, by + 2, (bw - 4) * Math.max(0, boss.hp / boss.maxHp), 8);
        }

        ctx.fillStyle = '#ffd6e2';
        ctx.font = '700 12px "JetBrains Mono", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`БОСС: ${boss.name} [ФАЗА ${boss.bossPhase || 1}/3] — ${Math.ceil(boss.hp)} / ${boss.maxHp}`, w * 0.5, by - 7);
      }

      // Screen-Space Vignettes & Cinematic Wave Banner (unshaken HUD space)
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      if (this.settings.quality !== 'low' && this.state === 'playing' && this.player) {
        const hpRatio = this.player.hp / Math.max(1, this.player.maxHp);
        const lowHpAlpha = hpRatio < 0.30 ? (0.08 + 0.08 * Math.sin(nowSec * 7.2)) * (1 - hpRatio / 0.30) : 0;
        const hitAlpha = this.damageFlash * 0.19;
        const btAlpha = this.timeScale < 0.85 ? (0.85 - this.timeScale) * 0.24 : 0;

        if (hitAlpha > 0.01 || lowHpAlpha > 0.01) {
          const a = Math.min(0.26, hitAlpha + lowHpAlpha);
          const isCyan = this.damageFlash > 0.05 && this.damageFlashColor === 'cyan' && lowHpAlpha <= 0.01;
          const col = isCyan ? `rgba(56, 189, 248, ${a.toFixed(3)})` : `rgba(255, 42, 95, ${a.toFixed(3)})`;
          const edge = Math.min(w, h) * 0.14;
          ctx.fillStyle = col;
          ctx.fillRect(0, 0, w, edge * 0.35);
          ctx.fillRect(0, h - edge * 0.35, w, edge * 0.35);
          ctx.fillRect(0, 0, edge * 0.35, h);
          ctx.fillRect(w - edge * 0.35, 0, edge * 0.35, h);
        }
        if (btAlpha > 0.01) {
          ctx.strokeStyle = `rgba(185, 92, 255, ${btAlpha.toFixed(3)})`;
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, w - 10, h - 10);
        }
      }

      if (this.state === 'playing' && this.waveBannerTimer > 0) {
        const t = this.waveBannerTimer;
        const alpha = Math.min(1, t * 2.2, (2.8 - t) * 3.2 + 0.15);
        const isBossW = this.wave % 5 === 0;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        const cy = 98;
        const bw = isBossW ? 440 : 320;
        ctx.fillStyle = isBossW ? 'rgba(38, 8, 20, 0.86)' : 'rgba(8, 15, 34, 0.82)';
        ctx.strokeStyle = isBossW ? '#ff3b6b' : '#00f0ff';
        ctx.lineWidth = 1.4;
        ctx.fillRect(w * 0.5 - bw * 0.5, cy - 24, bw, 46);
        ctx.strokeRect(w * 0.5 - bw * 0.5, cy - 24, bw, 46);

        ctx.textAlign = 'center';
        ctx.font = '800 16px "JetBrains Mono", system-ui, sans-serif';
        ctx.fillStyle = isBossW ? '#ffb838' : '#ffffff';
        ctx.fillText(`ВОЛНА ${this.wave}`, w * 0.5, cy - 3);

        ctx.font = '700 10.5px "JetBrains Mono", system-ui, sans-serif';
        ctx.fillStyle = isBossW ? '#ff6b8b' : '#7df9ff';
        ctx.fillText(this.waveSubtitle || 'СЕКТОР АКТИВЕН', w * 0.5, cy + 14);
        ctx.restore();
      }

      // Custom tactical crosshair in manual play (with recoil bloom, well pips & dual cooldown arcs)
      if (this.state === 'playing' && !this.autopilot.enabled) {
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const bloom = this.crosshairBloom || 0;
        const r = 10 + bloom * 0.45;
        ctx.strokeStyle = this.repulsorMode ? '#ffb838' : '#00f0ff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.moveTo(mx - r - 6, my); ctx.lineTo(mx - r + 3, my);
        ctx.moveTo(mx + r - 3, my); ctx.lineTo(mx + r + 6, my);
        ctx.moveTo(mx, my - r - 6); ctx.lineTo(mx, my - r + 3);
        ctx.moveTo(mx, my + r - 3); ctx.lineTo(mx, my + r + 6);
        ctx.stroke();

        // Singularity placement outer recharge ring around crosshair
        if (this.player.wellCooldown > 0) {
          const maxCd = 1.6 * this.player.mods.wellCdMult;
          const progress = Math.max(0, Math.min(1, 1 - this.player.wellCooldown / maxCd));
          ctx.strokeStyle = 'rgba(192, 108, 255, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(mx, my, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();
        }

        // Phase Dash inner emerald recharge arc
        if (this.player.dashCooldown > 0) {
          const maxDashCd = 2.8 / Math.max(0.7, this.player.mods.moveSpeedMult);
          const dProg = Math.max(0, Math.min(1, 1 - this.player.dashCooldown / maxDashCd));
          ctx.strokeStyle = 'rgba(34, 255, 166, 0.85)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(mx, my, Math.max(4, r - 4), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dProg);
          ctx.stroke();
        }

        // Active Gravity Wells pips under crosshair
        const maxPips = Math.min(6, this.player.mods.maxWells);
        const activeW = this.wells.length;
        const pipSpan = (maxPips - 1) * 6;
        for (let pi = 0; pi < maxPips; pi++) {
          const px = mx - pipSpan * 0.5 + pi * 6;
          const py = my + r + 11;
          ctx.fillStyle = pi < activeW ? '#e879f9' : 'rgba(255, 255, 255, 0.25)';
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }

      ctx.restore();
    }

    loop(now) {
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0 && dt < 0.25) {
        const instFps = 1 / dt;
        this.fpsAvg = this.fpsAvg * 0.9 + instFps * 0.1;
      }
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.25) {
        this.fpsTimer = 0;
        const badge = this.hudEls && this.hudEls.fpsBadge;
        if (badge && this.settings.showFps && this.state !== 'title') {
          const backend = (this.gpu && this.gpu.isActive()) ? this.gpu.backend : '2D';
          badge.textContent = `${Math.round(this.fpsAvg)} FPS • ${backend} • ${this.getPreset().label}`;
        }
      }
      this.update(dt);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
  });
})(window.SG);
