// SINGULARIS — Core Game Loop, Emergent Combat Physics, Wave Director & UI Controller
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  SG.VERSION = 'v2.4.0';

  const WORLD_SIZE = 24000;
  const DUNGEON_SIZE = 2200;
  const ENDLESS_SIZE = 2600;

  const ANOMALY_TIERS = {
    1: { color: '#00f0ff', startWave: 1, wavesTotal: 3, hasBoss: false, names: ['ПЕРЕДОВОЙ СБОЙ', 'ОСКОЛОК РОЯ', 'ВНЕШНИЙ ПРОРЫВ'] },
    2: { color: '#c06cff', startWave: 3, wavesTotal: 4, hasBoss: false, names: ['ПУЛЬСАРНЫЙ РАЗЛОМ', 'ЩЕЛЬ ЭНТРОПИИ', 'ИСКАЖЕНИЕ'] },
    3: { color: '#ffb838', startWave: 5, wavesTotal: 4, hasBoss: true, names: ['ГНЕЗДО ЛЕВИАФАНА', 'КРОНОС-ВИХРЬ', 'ЯДРО ТРЕВОГИ'] },
    4: { color: '#ff3b6b', startWave: 8, wavesTotal: 4, hasBoss: true, names: ['АЛЫЙ КОЛЛАПС', 'ГОРИЗОНТ СОБЫТИЙ', 'БАГРОВАЯ ПЕТЛЯ'] },
    5: { color: '#ff6be6', startWave: 12, wavesTotal: 5, hasBoss: true, names: ['ТРОН АРХОНТА', 'КОРОНА СИНГУЛЯРНОСТИ', 'КРАЙ ПУСТОТЫ'] }
  };

  const DIALOG_IDS = [
    'title-dialog',
    'pause-dialog',
    'settings-dialog',
    'upgrade-dialog',
    'codex-dialog',
    'modules-dialog',
    'worldmap-dialog',
    'build-dialog',
    'gameover-dialog'
  ];

  const BUILD_MIN_R = 115;
  const BUILD_MAX_R = 1200;
  const BUILDING_DEFS = [
    {
      id: 'xp_extractor',
      name: 'Экстрактор Опыта',
      shortName: 'XP-ЭКСТР',
      color: '#22ffa6',
      maxCount: 3,
      maxLevel: 3,
      costs: [35, 70, 120],
      rates: [6, 12, 20],
      desc: 'Автономно генерирует опыт для вашего ядра даже во время исследования сектора.',
      rateLabel: (lvl) => `+${[6, 12, 20][lvl - 1] || 6} XP/с`
    },
    {
      id: 'matter_synth',
      name: 'Синтезатор Материи',
      shortName: 'СИНТЕЗ',
      color: '#ffd166',
      maxCount: 2,
      maxLevel: 3,
      costs: [40, 80, 135],
      rates: [0.6, 1.2, 2.0],
      desc: 'Стабильно синтезирует квантовую материю для постройки и улучшения базы.',
      rateLabel: (lvl) => `+${[0.6, 1.2, 2.0][lvl - 1] || 0.6} ⚡/с`
    },
    {
      id: 'repair_pylon',
      name: 'Квантовый Док',
      shortName: 'ДОК-ПИЛОН',
      color: '#00f0ff',
      maxCount: 2,
      maxLevel: 3,
      costs: [45, 85, 145],
      rates: [8, 16, 24],
      desc: 'Усиливает ремонт базы и повышает макс. корпус и щит на 8% за уровень (действует везде).',
      rateLabel: (lvl) => `+${[8, 16, 24][lvl - 1] || 8}% HP/Щит`
    },
    {
      id: 'xp_beacon',
      name: 'Орбитальный Маяк',
      shortName: 'МАЯК',
      color: '#c06cff',
      maxCount: 2,
      maxLevel: 3,
      costs: [50, 95, 160],
      rates: [12, 24, 36],
      desc: 'Увеличивает весь получаемый опыт (+12%/ур.) и ускоряет появление новых разломов.',
      rateLabel: (lvl) => `+${[12, 24, 36][lvl - 1] || 12}% XP`
    }
  ];

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

      this.viewport = { width: window.innerWidth, height: window.innerHeight };
      this.bounds = { width: WORLD_SIZE, height: WORLD_SIZE };
      this.camera = {
        x: Math.max(0, (WORLD_SIZE - this.viewport.width) * 0.5),
        y: Math.max(0, (WORLD_SIZE - this.viewport.height) * 0.5)
      };
      this.dpr = 1;

      if (SG.Sprites && typeof SG.Sprites.init === 'function') {
        SG.Sprites.init();
      }

      this.grid = new SG.SpacetimeGrid(this.viewport.width, this.viewport.height, 46);
      this.particles = new SG.ParticleSystem(650);

      this.state = 'title'; // 'title' | 'playing' | 'upgrade' | 'paused' | 'gameover'
      this.stars = [];
      this.landmarks = [];

      this.keys = {};
      this.mouseScreen = {
        x: this.viewport.width * 0.6,
        y: this.viewport.height * 0.5
      };
      this.mouse = {
        x: this.bounds.width * 0.5 + 120,
        y: this.bounds.height * 0.5,
        leftDown: false
      };
      this.repulsorMode = false; // [R] toggles Right-Click between Black Hole (Pull) & White Hole (Push)

      const meta = SG.Save ? SG.Save.loadMeta() : null;
      this.bestScore = meta ? meta.bestScore : Number(localStorage.getItem('singularis_best_score') || 0);
      this.bestWave = meta ? meta.bestWave : Number(localStorage.getItem('singularis_best_wave') || 1);
      this.bestEndlessWave = meta ? (meta.bestEndlessWave || 0) : 0;
      this.bestEndlessScore = meta ? (meta.bestEndlessScore || 0) : 0;
      this.totalKills = meta ? meta.totalKills : Number(localStorage.getItem('singularis_total_kills') || 0);
      this.totalAnomaliesCleared = meta ? (meta.totalAnomaliesCleared || 0) : 0;
      this.gameMode = 'openworld';
      this.settings = this.loadSettings();
      this.buildings = [];
      this.resources = { matter: isEndless ? 0 : 60 };
      this.buildPlacement = null;
      this._baseXpAcc = 0;
      this._baseMatterAcc = 0;
      this._basePulseTimer = 0;
      this._baseHpBonus = 0;
      this._baseShieldBonus = 0;
      this._autoSaveTimer = 0;
      this._lastSavedAt = 0;

      this._subModalOrigin = null;
      this._resetConfirmTimer = null;
      this._upgradeAnimTimer = null;
      this._upgradeCloseTimer = null;
      this._upgradeSelecting = false;
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
      this.waveBannerTitle = '';
      this.waveBannerColor = null;

      // Overworld / Base / Anomaly Dungeon State
      this.zone = 'overworld'; // 'overworld' | 'anomaly'
      this.base = { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.5, radius: 64, repairRadius: 210 };
      this.anomalies = [];
      this.activeAnomaly = null;
      this.anomalyCleared = false;
      this.dungeonWaveIndex = 0;
      this.dungeonWavesTotal = 0;
      this.exitPortal = null;
      this._preDungeonSnapshot = null;
      this.overworldPos = { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.5 + 150 };
      this.inBaseZone = false;
      this.waypoint = null;
      this._minimapRect = null;
      this._worldMapHover = null;
      this._lastTouchTime = 0;
      this._upgradeGuardUntil = 0;
      const hasCoarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
        (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(any-pointer: coarse)').matches);
      const touchCapable = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      this._detectedTouch = hasCoarse || (touchCapable && window.innerWidth <= 1366);
      this.isTouchDevice = this._detectedTouch;
      this.touchInput = {
        moveX: 0,
        moveY: 0,
        joyId: null,
        joyOriginX: 0,
        joyOriginY: 0,
        joyMaxR: 46,
        aimId: null,
        aimActive: false,
        aimDirX: 1,
        aimDirY: 0,
        aimHasDir: false,
        aimOriginX: 0,
        aimOriginY: 0,
        aimMaxR: 46,
        firing: false,
        bulletTime: false,
        btId: null,
        btPressTime: 0,
        btWasOn: false,
        wellDragId: null,
        wellDragSource: null,
        wellStartX: 0,
        wellStartY: 0,
        wellPreviewActive: false,
        wellPreviewX: 0,
        wellPreviewY: 0,
        wellCancel: false
      };

      const touchBtnEls = (id) => {
        const el = document.getElementById(id);
        return {
          el,
          cd: el ? el.querySelector('.tbtn-cd') : null,
          label: el ? el.querySelector('.tbtn-label') : null,
          timer: el ? el.querySelector('.tbtn-timer') : null
        };
      };

      this.touchEls = {
        root: document.getElementById('touch-controls'),
        joyZone: document.getElementById('touch-joy-zone'),
        joyBase: document.getElementById('touch-joy-base'),
        joyKnob: document.getElementById('touch-joy-knob'),
        aimZone: document.getElementById('touch-aim-zone'),
        aimBase: document.getElementById('touch-aim-base'),
        aimKnob: document.getElementById('touch-aim-knob'),
        dash: touchBtnEls('touch-dash'),
        well: touchBtnEls('touch-well'),
        detonate: touchBtnEls('touch-detonate'),
        rewind: touchBtnEls('touch-rewind'),
        bt: touchBtnEls('touch-bt'),
        polarity: touchBtnEls('touch-polarity')
      };

      this.hudEls = {
        hud: document.getElementById('hud'),
        fpsBadge: document.getElementById('fps-badge'),
        versionBadge: document.getElementById('version-badge'),
        titleVersion: document.getElementById('title-version'),
        barHp: document.getElementById('bar-hp'),
        valHp: document.getElementById('val-hp'),
        barShield: document.getElementById('bar-shield'),
        valShield: document.getElementById('val-shield'),
        barChrono: document.getElementById('bar-chrono'),
        barXp: document.getElementById('bar-xp'),
        score: document.getElementById('hud-score'),
        combo: document.getElementById('hud-combo'),
        wave: document.getElementById('hud-wave'),
        matter: document.getElementById('hud-matter'),
        level: document.getElementById('hud-level'),
        dash: document.getElementById('hud-dash'),
        rewind: document.getElementById('hud-rewind'),
        detonate: document.getElementById('hud-detonate'),
        wellCd: document.getElementById('hud-well-cd'),
        buildStrip: document.getElementById('hud-build-strip'),
        returnBtn: document.getElementById('btn-hud-return'),
        mapBtn: document.getElementById('btn-hud-map'),
        buildBtn: document.getElementById('btn-hud-build'),
        polBtn: document.getElementById('btn-hud-polarity'),
        muteBtn: document.getElementById('btn-hud-mute'),
        menuBtn: document.getElementById('btn-hud-menu'),
        fullscreenBtn: document.getElementById('btn-hud-fullscreen')
      };

      this.applySettings();
      if (SG.I18n) {
        SG.I18n.setLang(this.settings.lang);
        SG.I18n.applyDOM();
      }
      this.updateLangUI();
      this.bindEvents();
      if (this.hudEls.versionBadge) this.hudEls.versionBadge.textContent = `SINGULARIS ${SG.VERSION}`;
      if (this.hudEls.titleVersion) this.hudEls.titleVersion.textContent = this.t('title.version', { ver: SG.VERSION });
      this.resetRun(false);

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    getPreset() {
      return QUALITY_PRESETS[this.settings.quality] || QUALITY_PRESETS.medium;
    }

    loadSettings() {
      const defaults = {
        lang: 'ru',
        difficulty: 'normal',
        quality: 'medium',
        gpuAccel: true,
        useTextures: true,
        showFps: true,
        musicVol: 60,
        sfxVol: 85,
        screenShake: true,
        trajectoryPreview: true,
        touchMode: 'auto',
        touchScale: 100,
        touchOpacity: 80,
        touchFloating: true,
        touchAutofire: false,
        touchCanvasWell: true
      };
      try {
        const raw = localStorage.getItem('singularis_settings');
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const merged = { ...defaults, ...parsed };
        if (!['ru', 'uk', 'en', 'es'].includes(merged.lang)) merged.lang = 'ru';
        if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = 'normal';
        if (!QUALITY_PRESETS[merged.quality]) merged.quality = 'medium';
        if (!['auto', 'on', 'off'].includes(merged.touchMode)) merged.touchMode = 'auto';
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

    syncTouchMode() {
      const mode = this.settings.touchMode || 'auto';
      if (mode === 'on') this.isTouchDevice = true;
      else if (mode === 'off') this.isTouchDevice = false;
      else this.isTouchDevice = !!this._detectedTouch;
      if (document.body && document.body.classList) {
        document.body.classList.toggle('is-touch', this.isTouchDevice);
      }
    }

    vibrate(ms) {
      if (this.isTouchDevice && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(ms); } catch (_) {}
      }
    }

    applySettings() {
      if (SG.I18n && this.settings && this.settings.lang) {
        SG.I18n.setLang(this.settings.lang);
      }
      this.syncTouchMode();
      this.audio.setMusicVolume((this.settings.musicVol || 0) / 100);
      this.audio.setSfxVolume((this.settings.sfxVol || 0) / 100);
      const touchEl = (this.touchEls && this.touchEls.root) || document.getElementById('touch-controls');
      if (touchEl) {
        const scale = Math.max(75, Math.min(150, Number(this.settings.touchScale) || 100)) / 100;
        const opacity = Math.max(30, Math.min(100, Number(this.settings.touchOpacity) || 80)) / 100;
        touchEl.style.setProperty('--touch-scale', String(scale));
        touchEl.style.setProperty('--touch-opacity', String(opacity));
      }
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
      const sysEl = document.getElementById('title-sys-status');
      if (sysEl) {
        const backend = (this.gpu && this.gpu.isActive()) ? this.gpu.backend : '2D CANVAS';
        sysEl.textContent = `● ${backend} • ${preset.label}`;
      }
    }

    clearInputs() {
      this.mouse.leftDown = false;
      this.keys = {};
      if (this.touchInput) {
        this.touchInput.moveX = 0;
        this.touchInput.moveY = 0;
        this.touchInput.joyId = null;
        this.touchInput.aimId = null;
        this.touchInput.aimActive = false;
        this.touchInput.firing = false;
        this.touchInput.bulletTime = false;
        this.touchInput.btId = null;
        this.touchInput.wellDragId = null;
        this.touchInput.wellDragSource = null;
        this.touchInput.wellPreviewActive = false;
        this.touchInput.wellCancel = false;
      }
      if (this.touchEls) {
        if (this.touchEls.joyKnob) this.touchEls.joyKnob.style.transform = 'translate(0px, 0px)';
        if (this.touchEls.aimKnob) this.touchEls.aimKnob.style.transform = 'translate(0px, 0px)';
        if (this.touchEls.joyBase) {
          this.touchEls.joyBase.classList.remove('active');
          this.touchEls.joyBase.style.left = '';
          this.touchEls.joyBase.style.top = '';
          this.touchEls.joyBase.style.bottom = '';
        }
        if (this.touchEls.aimBase) this.touchEls.aimBase.classList.remove('active');
      }
      document.querySelectorAll('.touch-btn.pressed').forEach(btn => btn.classList.remove('pressed'));
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
      const te = this.touchEls || {};
      const joyZone = te.joyZone;
      const joyBase = te.joyBase;
      const joyKnob = te.joyKnob;
      const aimZone = te.aimZone;
      const aimBase = te.aimBase;
      const aimKnob = te.aimKnob;

      const acceptsTouchPointer = (e) => e.pointerType !== 'mouse' || this.settings.touchMode === 'on';
      const tryLandscapeLock = () => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      };

      // 1. Left Movement Joystick (floating or fixed)
      if (joyZone && joyBase && joyKnob) {
        const updateJoy = (clientX, clientY) => {
          const maxR = this.touchInput.joyMaxR || 46;
          const dx = clientX - this.touchInput.joyOriginX;
          const dy = clientY - this.touchInput.joyOriginY;
          const d = Math.hypot(dx, dy);
          const clamped = Math.min(maxR, d);
          const norm = maxR > 0 ? clamped / maxR : 0;
          if (norm < 0.06 || d === 0) {
            this.touchInput.moveX = 0;
            this.touchInput.moveY = 0;
            joyKnob.style.transform = 'translate(0px, 0px)';
            return;
          }
          const ux = dx / d;
          const uy = dy / d;
          this.touchInput.moveX = ux * norm;
          this.touchInput.moveY = uy * norm;
          joyKnob.style.transform = `translate(${Math.round(ux * clamped)}px, ${Math.round(uy * clamped)}px)`;
        };

        joyZone.addEventListener('pointerdown', (e) => {
          if (!acceptsTouchPointer(e) || this.touchInput.joyId !== null) return;
          e.preventDefault();
          e.stopPropagation();
          this._lastTouchTime = performance.now();
          this.audio.init();
          try { joyZone.setPointerCapture(e.pointerId); } catch (_) {}
          this.touchInput.joyId = e.pointerId;

          const baseRect = joyBase.getBoundingClientRect();
          const maxR = Math.max(28, baseRect.width * 0.42);
          this.touchInput.joyMaxR = maxR;

          if (this.settings.touchFloating) {
            const zoneRect = joyZone.getBoundingClientRect();
            const halfW = baseRect.width * 0.5;
            const halfH = baseRect.height * 0.5;
            const minX = zoneRect.left + halfW;
            const maxX = Math.max(minX, zoneRect.right - halfW);
            const minY = zoneRect.top + halfH;
            const maxY = Math.max(minY, zoneRect.bottom - halfH);
            const cx = Math.max(minX, Math.min(maxX, e.clientX));
            const cy = Math.max(minY, Math.min(maxY, e.clientY));
            joyBase.style.left = `${Math.round(cx - zoneRect.left - halfW)}px`;
            joyBase.style.top = `${Math.round(cy - zoneRect.top - halfH)}px`;
            joyBase.style.bottom = 'auto';
            this.touchInput.joyOriginX = cx;
            this.touchInput.joyOriginY = cy;
          } else {
            this.touchInput.joyOriginX = baseRect.left + baseRect.width * 0.5;
            this.touchInput.joyOriginY = baseRect.top + baseRect.height * 0.5;
          }

          joyBase.classList.add('active');
          updateJoy(e.clientX, e.clientY);
        });

        joyZone.addEventListener('pointermove', (e) => {
          if (e.pointerId !== this.touchInput.joyId) return;
          e.preventDefault();
          updateJoy(e.clientX, e.clientY);
        });

        const endJoy = (e) => {
          if (e.pointerId !== this.touchInput.joyId) return;
          this.touchInput.joyId = null;
          this.touchInput.moveX = 0;
          this.touchInput.moveY = 0;
          joyKnob.style.transform = 'translate(0px, 0px)';
          joyBase.classList.remove('active');
          joyBase.style.left = '';
          joyBase.style.top = '';
          joyBase.style.bottom = '';
        };
        joyZone.addEventListener('pointerup', endJoy);
        joyZone.addEventListener('pointercancel', endJoy);
      }

      // 2. Right Twin-Stick Aim + Fire
      if (aimZone && aimBase && aimKnob) {
        const updateAim = (clientX, clientY) => {
          const maxR = this.touchInput.aimMaxR || 46;
          const dx = clientX - this.touchInput.aimOriginX;
          const dy = clientY - this.touchInput.aimOriginY;
          const d = Math.hypot(dx, dy);
          const clamped = Math.min(maxR, d);
          if (d > 0) {
            const ux = dx / d;
            const uy = dy / d;
            aimKnob.style.transform = `translate(${Math.round(ux * clamped)}px, ${Math.round(uy * clamped)}px)`;
            if (d > 6) {
              this.touchInput.aimDirX = ux;
              this.touchInput.aimDirY = uy;
              this.touchInput.aimHasDir = true;
            }
          }
        };

        aimZone.addEventListener('pointerdown', (e) => {
          if (!acceptsTouchPointer(e) || this.touchInput.aimId !== null) return;
          e.preventDefault();
          e.stopPropagation();
          this._lastTouchTime = performance.now();
          this.audio.init();
          try { aimZone.setPointerCapture(e.pointerId); } catch (_) {}

          const baseRect = aimBase.getBoundingClientRect();
          this.touchInput.aimId = e.pointerId;
          this.touchInput.aimOriginX = baseRect.left + baseRect.width * 0.5;
          this.touchInput.aimOriginY = baseRect.top + baseRect.height * 0.5;
          this.touchInput.aimMaxR = Math.max(28, baseRect.width * 0.42);
          this.touchInput.aimActive = true;
          this.touchInput.firing = true;
          aimBase.classList.add('active');
          updateAim(e.clientX, e.clientY);
        });

        aimZone.addEventListener('pointermove', (e) => {
          if (e.pointerId !== this.touchInput.aimId) return;
          e.preventDefault();
          updateAim(e.clientX, e.clientY);
        });

        const endAim = (e) => {
          if (e.pointerId !== this.touchInput.aimId) return;
          this.touchInput.aimId = null;
          this.touchInput.aimActive = false;
          this.touchInput.firing = false;
          aimKnob.style.transform = 'translate(0px, 0px)';
          aimBase.classList.remove('active');
        };
        aimZone.addEventListener('pointerup', endAim);
        aimZone.addEventListener('pointercancel', endAim);
      }

      // 3. Gravity Well Skillshot Button (tap = ahead of ship, drag = aim placement)
      const wellBtn = te.well && te.well.el;
      if (wellBtn) {
        const updateWellBtnDrag = (clientX, clientY) => {
          const dx = clientX - this.touchInput.wellStartX;
          const dy = clientY - this.touchInput.wellStartY;
          const d = Math.hypot(dx, dy);
          if (!this.touchInput.wellPreviewActive && d > 14) {
            this.touchInput.wellPreviewActive = true;
          }
          if (this.touchInput.wellPreviewActive) {
            this.touchInput.wellCancel = d < 12;
            const range = Math.min(380, d * 3.6);
            const ux = d > 0 ? dx / d : Math.cos(this.player.aimAngle);
            const uy = d > 0 ? dy / d : Math.sin(this.player.aimAngle);
            this.touchInput.wellPreviewX = Math.max(28, Math.min(this.bounds.width - 28, this.player.x + ux * range));
            this.touchInput.wellPreviewY = Math.max(28, Math.min(this.bounds.height - 28, this.player.y + uy * range));
          }
        };

        wellBtn.addEventListener('pointerdown', (e) => {
          if (!acceptsTouchPointer(e) || this.touchInput.wellDragId !== null) return;
          e.preventDefault();
          e.stopPropagation();
          this._lastTouchTime = performance.now();
          this.audio.init();
          try { wellBtn.setPointerCapture(e.pointerId); } catch (_) {}
          this.touchInput.wellDragId = e.pointerId;
          this.touchInput.wellDragSource = 'btn';
          this.touchInput.wellStartX = e.clientX;
          this.touchInput.wellStartY = e.clientY;
          this.touchInput.wellPreviewActive = false;
          this.touchInput.wellCancel = false;
          wellBtn.classList.add('pressed');
        });

        wellBtn.addEventListener('pointermove', (e) => {
          if (e.pointerId !== this.touchInput.wellDragId || this.touchInput.wellDragSource !== 'btn') return;
          e.preventDefault();
          updateWellBtnDrag(e.clientX, e.clientY);
        });

        const endWellBtn = (e) => {
          if (e.pointerId !== this.touchInput.wellDragId || this.touchInput.wellDragSource !== 'btn') return;
          wellBtn.classList.remove('pressed');
          if (e.type === 'pointerup' && this.state === 'playing') {
            if (this.touchInput.wellPreviewActive) {
              if (!this.touchInput.wellCancel) {
                if (this.spawnGravityWell(this.touchInput.wellPreviewX, this.touchInput.wellPreviewY, this.repulsorMode)) {
                  this.vibrate(15);
                }
              }
            } else {
              const wx = Math.max(28, Math.min(this.bounds.width - 28, this.player.x + Math.cos(this.player.aimAngle) * 195));
              const wy = Math.max(28, Math.min(this.bounds.height - 28, this.player.y + Math.sin(this.player.aimAngle) * 195));
              if (this.spawnGravityWell(wx, wy, this.repulsorMode)) {
                this.vibrate(15);
              }
            }
          }
          this.touchInput.wellDragId = null;
          this.touchInput.wellDragSource = null;
          this.touchInput.wellPreviewActive = false;
          this.touchInput.wellCancel = false;
        };
        wellBtn.addEventListener('pointerup', endWellBtn);
        wellBtn.addEventListener('pointercancel', endWellBtn);
      }

      // 4. Smart Toggle / Hold Chrono Bullet-Time
      const btBtn = te.bt && te.bt.el;
      if (btBtn) {
        btBtn.addEventListener('pointerdown', (e) => {
          if (!acceptsTouchPointer(e)) return;
          e.preventDefault();
          e.stopPropagation();
          this._lastTouchTime = performance.now();
          this.audio.init();
          try { btBtn.setPointerCapture(e.pointerId); } catch (_) {}
          this.touchInput.btId = e.pointerId;
          this.touchInput.btWasOn = this.touchInput.bulletTime;
          this.touchInput.btPressTime = performance.now();
          this.touchInput.bulletTime = true;
          btBtn.classList.add('pressed');
          this.updateHUD();
        });

        const endBt = (e) => {
          if (e.pointerId !== this.touchInput.btId) return;
          this.touchInput.btId = null;
          btBtn.classList.remove('pressed');
          if (e.type === 'pointercancel') {
            this.touchInput.bulletTime = false;
          } else if (this.touchInput.btWasOn || (performance.now() - this.touchInput.btPressTime >= 350)) {
            this.touchInput.bulletTime = false;
          }
          this.updateHUD();
        };
        btBtn.addEventListener('pointerup', endBt);
        btBtn.addEventListener('pointercancel', endBt);
      }

      // 5. Instant Tap Abilities (Dash, Detonate, Rewind, Polarity)
      const bindTap = (btnRef, fn) => {
        const el = btnRef && btnRef.el;
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
          if (!acceptsTouchPointer(e)) return;
          e.preventDefault();
          e.stopPropagation();
          this._lastTouchTime = performance.now();
          this.audio.init();
          el.classList.add('pressed');
          if (this.state === 'playing') fn();
        });
        const rel = () => el.classList.remove('pressed');
        el.addEventListener('pointerup', rel);
        el.addEventListener('pointercancel', rel);
      };

      bindTap(te.dash, () => {
        if (this.player.triggerDash(this.touchInput.moveX, this.touchInput.moveY, this.bounds, this.particles, this.audio, this.grid, this)) {
          this.vibrate(12);
        }
      });
      bindTap(te.detonate, () => {
        if (this.detonateAllWells()) {
          this.vibrate(25);
        }
      });
      bindTap(te.rewind, () => {
        if (this.player.triggerRewind(this.particles, this.audio, this.grid, this)) {
          this.vibrate(18);
        }
      });
      bindTap(te.polarity, () => {
        this.repulsorMode = !this.repulsorMode;
        this.particles.addText(
          this.player.x,
          this.player.y - 26,
          this.repulsorMode ? 'БЕЛАЯ ДЫРА' : 'ЧЕРНАЯ ДЫРА',
          this.repulsorMode ? '#ffb838' : '#c06cff',
          1.02
        );
        this.vibrate(10);
        this.updateHUD();
      });

      // 6. Open Arena Tap/Drag to place Gravity Well directly
      if (this.canvas) {
        const updateCanvasWell = (clientX, clientY) => {
          const rect = this.canvas.getBoundingClientRect();
          const wx = (clientX - rect.left) + this.camera.x;
          const wy = (clientY - rect.top) + this.camera.y;
          this.touchInput.wellPreviewX = Math.max(28, Math.min(this.bounds.width - 28, wx));
          this.touchInput.wellPreviewY = Math.max(28, Math.min(this.bounds.height - 28, wy));
        };

        this.canvas.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse') return;
          if (this.state !== 'playing' || !this.settings.touchCanvasWell || this.touchInput.wellDragId !== null) return;
          e.preventDefault();
          this._lastTouchTime = performance.now();
          this.audio.init();
          tryLandscapeLock();
          try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
          this.touchInput.wellDragId = e.pointerId;
          this.touchInput.wellDragSource = 'canvas';
          this.touchInput.wellPreviewActive = true;
          this.touchInput.wellCancel = false;
          updateCanvasWell(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('pointermove', (e) => {
          if (e.pointerId !== this.touchInput.wellDragId || this.touchInput.wellDragSource !== 'canvas') return;
          e.preventDefault();
          updateCanvasWell(e.clientX, e.clientY);
        });

        const endCanvasWell = (e) => {
          if (e.pointerId !== this.touchInput.wellDragId || this.touchInput.wellDragSource !== 'canvas') return;
          if (e.type === 'pointerup' && this.state === 'playing') {
            if (this.spawnGravityWell(this.touchInput.wellPreviewX, this.touchInput.wellPreviewY, this.repulsorMode)) {
              this.vibrate(15);
            }
          }
          this.touchInput.wellDragId = null;
          this.touchInput.wellDragSource = null;
          this.touchInput.wellPreviewActive = false;
          this.touchInput.wellCancel = false;
        };
        this.canvas.addEventListener('pointerup', endCanvasWell);
        this.canvas.addEventListener('pointercancel', endCanvasWell);
      }

      // 7. Fullscreen Toggle & Portrait Dismiss
      const fsBtn = (this.hudEls && this.hudEls.fullscreenBtn) || document.getElementById('btn-hud-fullscreen');
      if (fsBtn) {
        if (!document.documentElement.requestFullscreen) {
          fsBtn.hidden = true;
        } else {
          fsBtn.addEventListener('click', () => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else {
              document.documentElement.requestFullscreen().then(tryLandscapeLock).catch(() => {});
            }
          });
          document.addEventListener('fullscreenchange', () => {
            const active = !!document.fullscreenElement;
            fsBtn.textContent = active ? '✕' : '⛶';
            fsBtn.classList.toggle('active', active);
          });
        }
      }

      const dismissRotBtn = document.getElementById('btn-dismiss-rotate');
      if (dismissRotBtn) {
        dismissRotBtn.addEventListener('click', () => {
          document.body.classList.add('allow-portrait');
        });
      }
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

    resetRun(startImmediately = true, mode = 'openworld') {
      this.cancelUpgradeAnim();
      this.gameMode = mode === 'endless' ? 'endless' : 'openworld';
      const isEndless = this.gameMode === 'endless';
      this.zone = isEndless ? 'endless' : 'overworld';
      const arenaSize = isEndless ? ENDLESS_SIZE : WORLD_SIZE;
      this.bounds = { width: arenaSize, height: arenaSize };
      this.activeAnomaly = null;
      this.anomalyCleared = false;
      this.dungeonWaveIndex = 0;
      this.dungeonWavesTotal = 0;
      this.exitPortal = null;
      this._preDungeonSnapshot = null;
      this.inBaseZone = false;
      this.waypoint = null;
      this._worldMapHover = null;

      this.buildings = [];
      this.resources = { matter: isEndless ? 0 : 60 };
      this.buildPlacement = null;
      this._baseXpAcc = 0;
      this._baseMatterAcc = 0;
      this._basePulseTimer = 0;
      this._baseHpBonus = 0;
      this._baseShieldBonus = 0;
      this._autoSaveTimer = 0;
      if (isEndless) {
        this.anomalies = [];
        this.base = { x: ENDLESS_SIZE * 0.5, y: ENDLESS_SIZE * 0.5, radius: 64, repairRadius: 210 };
        this.player = new SG.Player(ENDLESS_SIZE * 0.5, ENDLESS_SIZE * 0.5);
      } else {
        this.initOverworldEntities();
        this.player = new SG.Player(this.base.x, this.base.y + 145);
      }
      this.overworldPos = { x: this.player.x, y: this.player.y };
      this.initLandmarks();
      this.snapCameraToPlayer();
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
      this.waveBannerTitle = '';
      this.waveSubtitle = '';
      this.waveBannerColor = null;

      this.level = 1;
      this.xp = 0;
      this.xpNext = 115;
      this.upgradeStacks = {};
      this.evolvedUpgrades = new Set();
      this.currentChoices = [];
      this.rerolls = 2;
      this._buildDirty = true;

      this.stats = {
        kills: 0,
        slingshots: 0,
        hijacks: 0,
        annihilations: 0,
        anomaliesCleared: 0
      };

      this.screenShake = 0;
      this.hitstopTimer = 0;
      this.damageFlash = 0;
      this.crosshairBloom = 0;
      this.timeScale = 1.0;

      if (startImmediately) {
        this.state = 'playing';
        this.closeAllDialogs();
        if (this.gameMode === 'endless') {
          this.startWave(1);
        } else {
          this.waveBannerTitle = this.t('game.bannerOverworld');
          this.waveSubtitle = this.t('game.bannerOverworldSub');
          this.waveBannerColor = '#00f0ff';
          this.waveBannerTimer = 3.2;
          this.saveProgress('new_run');
        }
      }
      this.updateHUD();
    }

    cancelUpgradeAnim() {
      clearTimeout(this._upgradeAnimTimer);
      clearTimeout(this._upgradeCloseTimer);
      this._upgradeAnimTimer = null;
      this._upgradeCloseTimer = null;
      this._upgradeSelecting = false;
      const dlg = document.getElementById('upgrade-dialog');
      if (dlg) dlg.classList.remove('is-closing');
    }

    shouldAnimateUpgradeUI() {
      const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return this.settings.quality !== 'low' && !reduced;
    }

    hasAnyModalOpen() {
      return DIALOG_IDS.some(id => {
        const d = document.getElementById(id);
        return !!(d && d.open);
      });
    }

    closeDialogSilently(dlg) {
      if (!dlg || !dlg.open) return;
      if (dlg.dataset) {
        dlg.dataset.silentClose = String((Number(dlg.dataset.silentClose) || 0) + 1);
      }
      dlg.close();
    }

    closeAllDialogs(exceptId = null) {
      this.cancelUpgradeAnim();
      DIALOG_IDS.forEach(id => {
        if (id === exceptId) return;
        this.closeDialogSilently(document.getElementById(id));
      });
    }

    t(key, vars) {
      return SG.I18n ? SG.I18n.t(key, vars) : key;
    }

    locale() {
      return SG.I18n ? SG.I18n.locale() : 'ru-RU';
    }

    updateLangUI() {
      const lang = (this.settings && this.settings.lang) || 'ru';
      document.querySelectorAll('.lang-btn').forEach(btn => {
        const active = btn.dataset && btn.dataset.lang === lang;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const langSel = document.getElementById('set-lang');
      if (langSel) langSel.value = lang;
    }

    setLanguage(lang) {
      const next = ['ru', 'uk', 'en', 'es'].includes(lang) ? lang : 'ru';
      this.settings.lang = next;
      this.saveSettings();
      if (SG.I18n) {
        SG.I18n.setLang(next);
        SG.I18n.applyDOM();
      }
      this.updateLangUI();
      if (this.hudEls && this.hudEls.titleVersion) {
        this.hudEls.titleVersion.textContent = this.t('title.version', { ver: SG.VERSION });
      }
      const modTitleBtn = document.getElementById('btn-open-modules-title');
      if (modTitleBtn && SG.UPGRADES) {
        modTitleBtn.textContent = this.t('title.catalog', { n: SG.UPGRADES.length });
      }
      this.updateTitleBest();
      this.syncSettingsUI();
      this.updateHUD();
      const pauseDlg = document.getElementById('pause-dialog');
      if (pauseDlg && pauseDlg.open) this.renderPauseSummary();
      const modDlg = document.getElementById('modules-dialog');
      if (modDlg && modDlg.open) this.renderModulesCatalog();
      const wmDlg = document.getElementById('worldmap-dialog');
      if (wmDlg && wmDlg.open) this.renderWorldMap();
      const upgDlg = document.getElementById('upgrade-dialog');
      if (upgDlg && upgDlg.open) this.renderUpgradeChoices();
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
          ? this.t('set.gpuAvail', { backend: this.gpu.backend })
          : this.t('set.gpuFallback');
      }
    }

    syncSettingsUI() {
      this.updateLangUI();
      const qSel = document.getElementById('set-quality');
      const gpuCb = document.getElementById('set-gpu');
      const texCb = document.getElementById('set-textures');
      const fpsCb = document.getElementById('set-fps');
      const mSlider = document.getElementById('set-music-vol');
      const sSlider = document.getElementById('set-sfx-vol');
      const mVal = document.getElementById('val-music-vol');
      const sVal = document.getElementById('val-sfx-vol');
      const shakeCb = document.getElementById('set-shake');
      const trajCb = document.getElementById('set-trajectory');
      const touchModeSel = document.getElementById('set-touch-mode');
      const touchFloatCb = document.getElementById('set-touch-floating');
      const touchAutoCb = document.getElementById('set-touch-autofire');
      const touchCanvasWellCb = document.getElementById('set-touch-canvas-well');
      const touchScaleSlider = document.getElementById('set-touch-scale');
      const touchScaleVal = document.getElementById('val-touch-scale');
      const touchOpacitySlider = document.getElementById('set-touch-opacity');
      const touchOpacityVal = document.getElementById('val-touch-opacity');

      if (qSel) qSel.value = this.settings.quality;
      if (gpuCb) {
        gpuCb.checked = !!this.settings.gpuAccel;
        gpuCb.disabled = !(this.gpu && this.gpu.supported);
      }
      if (texCb) texCb.checked = !!this.settings.useTextures;
      if (fpsCb) fpsCb.checked = !!this.settings.showFps;
      if (mSlider) mSlider.value = String(this.settings.musicVol);
      if (mVal) mVal.textContent = `${this.settings.musicVol}%`;
      if (sSlider) sSlider.value = String(this.settings.sfxVol);
      if (sVal) sVal.textContent = `${this.settings.sfxVol}%`;
      if (shakeCb) shakeCb.checked = !!this.settings.screenShake;
      if (trajCb) trajCb.checked = !!this.settings.trajectoryPreview;
      if (touchModeSel) touchModeSel.value = this.settings.touchMode || 'auto';
      if (touchFloatCb) touchFloatCb.checked = !!this.settings.touchFloating;
      if (touchAutoCb) touchAutoCb.checked = !!this.settings.touchAutofire;
      if (touchCanvasWellCb) touchCanvasWellCb.checked = !!this.settings.touchCanvasWell;
      if (touchScaleSlider) touchScaleSlider.value = String(this.settings.touchScale || 100);
      if (touchScaleVal) touchScaleVal.textContent = `${this.settings.touchScale || 100}%`;
      if (touchOpacitySlider) touchOpacitySlider.value = String(this.settings.touchOpacity || 80);
      if (touchOpacityVal) touchOpacityVal.textContent = `${this.settings.touchOpacity || 80}%`;
      this.updateQualityUI();
    }

    screenToWorld(sx, sy) {
      return {
        x: sx + this.camera.x,
        y: sy + this.camera.y
      };
    }

    initLandmarks() {
      this.landmarks = [];
      const isGiganticWorld = this.bounds.width >= 16000;
      const isHugeWorld = this.bounds.width >= 6000;
      const cols = isGiganticWorld ? 12 : (isHugeWorld ? 10 : 4);
      const rows = cols;
      const pad = isGiganticWorld ? 900 : (isHugeWorld ? 500 : 420);
      const stepX = (this.bounds.width - pad * 2) / (cols - 1);
      const stepY = (this.bounds.height - pad * 2) / (rows - 1);
      const colNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.landmarks.push({
            x: pad + c * stepX,
            y: pad + r * stepY,
            radius: 74 + ((r + c) % 3) * 18,
            kind: (r * cols + c) % 3,
            label: `SEC-${colNames[c]}${r + 1}`
          });
        }
      }
    }

    snapCameraToPlayer() {
      if (!this.player) return;
      const maxCX = Math.max(0, this.bounds.width - this.viewport.width);
      const maxCY = Math.max(0, this.bounds.height - this.viewport.height);
      this.camera.x = Math.max(0, Math.min(maxCX, this.player.x - this.viewport.width * 0.5));
      this.camera.y = Math.max(0, Math.min(maxCY, this.player.y - this.viewport.height * 0.5));
      if (this.grid) {
        this.grid.setViewOrigin(this.camera.x, this.camera.y);
      }
    }

    _rollAnomalyRespawnDelay(tier = 1) {
      const base = 30 + (tier || 1) * 5 + Math.random() * 15;
      const mult = this.getBaseBonuses ? this.getBaseBonuses().respawnSpeedMult : 1;
      return Math.max(8, base * mult);
    }

    _makeAnomaly(tier, x, y) {
      const cfg = ANOMALY_TIERS[tier] || ANOMALY_TIERS[1];
      const names = (SG.I18n && SG.I18n.anomalyNames(tier)) || cfg.names;
      const name = names[Math.floor(Math.random() * names.length)];
      return {
        id: 'anom_' + Math.random().toString(36).slice(2, 9),
        tier,
        name,
        color: cfg.color,
        startWave: cfg.startWave,
        wavesTotal: cfg.wavesTotal,
        hasBoss: cfg.hasBoss,
        x,
        y,
        radius: 54 + tier * 3,
        cleared: false,
        respawnTimer: 0,
        enterProgress: 0
      };
    }

    _findRandomAnomalyPos(opts = {}) {
      const pad = 900;
      const span = WORLD_SIZE - pad * 2;
      const minBaseDist = opts.minBaseDist || 2600;
      const maxBaseDist = opts.maxBaseDist || Infinity;
      const minSpacing = opts.minSpacing || 2000;
      const existing = opts.existingPoints || [];
      const avoid = opts.avoidPoints || [];

      let bestX = Math.max(pad, Math.min(WORLD_SIZE - pad, this.base.x + 3200));
      let bestY = Math.max(pad, Math.min(WORLD_SIZE - pad, this.base.y));
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 72; attempt++) {
        let cx, cy;
        if (Number.isFinite(maxBaseDist)) {
          const ang = Math.random() * Math.PI * 2;
          const r = minBaseDist + Math.random() * Math.max(100, maxBaseDist - minBaseDist);
          cx = Math.max(pad, Math.min(WORLD_SIZE - pad, this.base.x + Math.cos(ang) * r));
          cy = Math.max(pad, Math.min(WORLD_SIZE - pad, this.base.y + Math.sin(ang) * r));
        } else {
          cx = pad + Math.random() * span;
          cy = pad + Math.random() * span;
        }
        const distBase = Math.hypot(cx - this.base.x, cy - this.base.y);
        if (distBase < minBaseDist || distBase > maxBaseDist) continue;

        let ok = true;
        let minD = Infinity;
        for (let j = 0; j < existing.length; j++) {
          const d = Math.hypot(cx - existing[j].x, cy - existing[j].y);
          if (d < minD) minD = d;
          if (d < minSpacing) ok = false;
        }
        for (let j = 0; j < avoid.length; j++) {
          const av = avoid[j];
          const d = Math.hypot(cx - av.x, cy - av.y);
          if (d < (av.dist || 1200)) ok = false;
          minD = Math.min(minD, d);
        }
        if (ok) return { x: cx, y: cy };

        const score = minD === Infinity ? distBase : minD;
        if (score > bestScore) {
          bestScore = score;
          bestX = cx;
          bestY = cy;
        }
      }
      return { x: bestX, y: bestY };
    }

    initOverworldEntities() {
      this.base = { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.5, radius: 64, repairRadius: 210 };
      this.anomalies = [];

      // Always place 1 accessible starter Tier-1 anomaly at a random angle near Base
      const starterPos = this._findRandomAnomalyPos({
        minBaseDist: 2800,
        maxBaseDist: 5800,
        existingPoints: this.anomalies
      });
      this.anomalies.push(this._makeAnomaly(1, starterPos.x, starterPos.y));

      // Shuffle remaining 14 anomaly tiers so every new game scatters tiers randomly across the world
      const tiers = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5];
      for (let i = tiers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = tiers[i];
        tiers[i] = tiers[j];
        tiers[j] = tmp;
      }
      for (let i = 0; i < tiers.length; i++) {
        const pos = this._findRandomAnomalyPos({ existingPoints: this.anomalies });
        this.anomalies.push(this._makeAnomaly(tiers[i], pos.x, pos.y));
      }
    }

    spawnNewAnomaly(tier = 1, avoidPoints = []) {
      const active = (this.anomalies || []).filter(a => !a.cleared);
      const pos = this._findRandomAnomalyPos({
        existingPoints: active,
        avoidPoints
      });
      const anomaly = this._makeAnomaly(tier, pos.x, pos.y);
      this.anomalies.push(anomaly);
      return anomaly;
    }

    enterAnomaly(anomaly) {
      if (!anomaly || anomaly.cleared || !this.player) return;
      const dx = this.base.x - anomaly.x;
      const dy = this.base.y - anomaly.y;
      const d = Math.hypot(dx, dy) || 1;
      this.overworldPos = {
        x: Math.max(80, Math.min(WORLD_SIZE - 80, anomaly.x + (dx / d) * 145)),
        y: Math.max(80, Math.min(WORLD_SIZE - 80, anomaly.y + (dy / d) * 145))
      };

      this._preDungeonSnapshot = {
        level: this.level,
        xp: this.xp,
        xpNext: this.xpNext,
        score: this.score,
        rerolls: this.rerolls,
        wave: this.wave,
        maxCombo: this.maxCombo,
        upgradeStacks: { ...this.upgradeStacks },
        evolvedUpgrades: Array.from(this.evolvedUpgrades || []),
        hp: this.player.hp,
        shield: this.player.shield,
        chrono: this.player.chrono
      };

      anomaly.enterProgress = 0;
      this.waypoint = null;
      this.zone = 'anomaly';
      this.activeAnomaly = anomaly;
      this.anomalyCleared = false;
      this.exitPortal = null;
      this.inBaseZone = false;
      this.bounds = { width: DUNGEON_SIZE, height: DUNGEON_SIZE };

      this.wells = [];
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.particles.clear();
      this.player.history = [];
      this.player.clones = [];
      this.player.afterimages = [];
      this.player.x = DUNGEON_SIZE * 0.5;
      this.player.y = DUNGEON_SIZE * 0.5;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.invulnTimer = Math.max(this.player.invulnTimer, 1.2);

      this.initLandmarks();
      this.snapCameraToPlayer();

      this.dungeonWaveIndex = 1;
      this.dungeonWavesTotal = anomaly.wavesTotal;
      this.startWave(anomaly.startWave);
      this.waveBannerTitle = this.t('game.bannerAnomaly', { name: anomaly.name });
      this.waveSubtitle = this.t('game.bannerAnomalySub', { tier: anomaly.tier, total: anomaly.wavesTotal });
      this.waveBannerColor = anomaly.color;
      this.waveBannerTimer = 3.0;
      this.particles.addShockwave(this.player.x, this.player.y, 170, anomaly.color, 0.45, 3);
      this.audio.playLevelUp();
      this.saveProgress('enter_anomaly');
      this.updateHUD();
    }

    completeAnomaly() {
      if (this.zone !== 'anomaly' || this.anomalyCleared) return;
      this.anomalyCleared = true;
      const anom = this.activeAnomaly;
      const tier = anom ? anom.tier : 1;
      if (anom) {
        anom.cleared = true;
        anom.respawnTimer = this._rollAnomalyRespawnDelay(tier);
      }
      this.stats.anomaliesCleared = (this.stats.anomaliesCleared || 0) + 1;

      // Vacuum remaining dungeon XP & reward player
      for (let i = 0; i < this.pickups.length; i++) {
        this.pickups[i].autoCollect = true;
      }
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.35));
      this.player.shield = this.player.maxShield;
      this.player.chrono = this.player.maxChrono;

      const scoreBonus = 1500 * tier;
      this.score += scoreBonus;
      const xpBonus = Math.round(this.xpNext * 0.75 + 80 * tier);
      const matterBonus = 25 + tier * 20;
      if (!this.resources) this.resources = { matter: 0 };
      this.resources.matter = (this.resources.matter || 0) + matterBonus;

      // Spawn Extraction Portal near player (inside dungeon bounds)
      const pAng = Math.random() * Math.PI * 2;
      const px = Math.max(120, Math.min(this.bounds.width - 120, this.player.x + Math.cos(pAng) * 150));
      const py = Math.max(120, Math.min(this.bounds.height - 120, this.player.y + Math.sin(pAng) * 150));
      this.exitPortal = {
        x: px,
        y: py,
        radius: 58,
        progress: 0,
        graceTimer: 0.65
      };

      this.waveBannerTitle = this.t('game.bannerAnomalyCleared');
      this.waveSubtitle = this.t('game.bannerAnomalyClearedSub');
      this.waveBannerColor = '#22ffa6';
      this.waveBannerTimer = 3.6;

      this.particles.addShockwave(px, py, 140, '#22ffa6', 0.5, 3);
      this.particles.addText(this.player.x, this.player.y - 36, `+${scoreBonus} • +${xpBonus} XP`, '#22ffa6', 1.28, 1.8);
      this.audio.playLevelUp();
      this.gainXP(xpBonus);
      this.totalAnomaliesCleared = (this.totalAnomaliesCleared || 0) + 1;
      this.saveProgress('complete_anomaly');
      this.updateHUD();
    }

    exitAnomalyToOverworld(toBase = false) {
      this.zone = 'overworld';
      this.bounds = { width: WORLD_SIZE, height: WORLD_SIZE };
      this.activeAnomaly = null;
      this.anomalyCleared = false;
      this.dungeonWaveIndex = 0;
      this.dungeonWavesTotal = 0;
      this.exitPortal = null;
      this._preDungeonSnapshot = null;

      this.wells = [];
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.waveQueue = [];
      this.particles.clear();

      if (this.player) {
        this.player.history = [];
        this.player.clones = [];
        this.player.afterimages = [];
        if (toBase) {
          this.player.x = this.base.x;
          this.player.y = this.base.y + 140;
        } else {
          this.player.x = this.overworldPos.x;
          this.player.y = this.overworldPos.y;
        }
        this.player.vx = 0;
        this.player.vy = 0;
      }

      this.initLandmarks();
      this.snapCameraToPlayer();

      // Keep total anomaly count at 15 while letting cleared rifts respawn individually on timers
      while (this.anomalies.length < 15) {
        const t = 1 + Math.floor(Math.random() * 5);
        this.spawnNewAnomaly(t);
      }

      this.waveBannerTitle = this.t('game.bannerReturnWorld');
      this.waveSubtitle = this.t('game.bannerReturnWorldSub');
      this.waveBannerColor = '#00f0ff';
      this.waveBannerTimer = 2.8;
      if (this.player) {
        this.particles.addShockwave(this.player.x, this.player.y, 130, '#00f0ff', 0.4, 2.5);
      }
      this.saveProgress('exit_anomaly');
      this.updateHUD();
    }

    ejectFromAnomalyOnDeath() {
      this.cancelUpgradeAnim();
      this.clearInputs();
      this.closeAllDialogs();

      const snap = this._preDungeonSnapshot;
      if (this.activeAnomaly) {
        this.activeAnomaly.enterProgress = 0;
      }

      this.zone = 'overworld';
      this.bounds = { width: WORLD_SIZE, height: WORLD_SIZE };
      this.activeAnomaly = null;
      this.anomalyCleared = false;
      this.dungeonWaveIndex = 0;
      this.dungeonWavesTotal = 0;
      this.exitPortal = null;
      this._preDungeonSnapshot = null;

      this.wells = [];
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.waveQueue = [];
      this.particles.clear();

      const spawnX = Math.max(80, Math.min(WORLD_SIZE - 80, (this.overworldPos && this.overworldPos.x) || this.base.x));
      const spawnY = Math.max(80, Math.min(WORLD_SIZE - 80, (this.overworldPos && this.overworldPos.y) || (this.base.y + 145)));

      if (snap) {
        this.level = snap.level;
        this.xp = snap.xp;
        this.xpNext = snap.xpNext || this.computeNextXp(this.level);
        this.score = snap.score;
        this.rerolls = snap.rerolls;
        this.wave = snap.wave;
        this.maxCombo = snap.maxCombo;
        this.combo = 1.0;
        this.comboTimer = 0;
        this.comboTier = 0;
        this.currentChoices = [];

        this.player = new SG.Player(spawnX, spawnY);
        this.upgradeStacks = {};
        this.evolvedUpgrades = new Set();
        const evoWanted = new Set(snap.evolvedUpgrades || []);
        for (const [id, rawCount] of Object.entries(snap.upgradeStacks || {})) {
          const upg = SG.UPGRADES.find(u => u.id === id);
          if (!upg) continue;
          const stacks = Math.max(1, Math.min(upg.maxStacks, rawCount));
          this.upgradeStacks[id] = stacks;
          for (let s = 0; s < stacks; s++) {
            upg.apply(this.player.mods, this.player, this);
          }
          if (upg.evolution && (evoWanted.has(id) || stacks >= upg.maxStacks)) {
            this.evolvedUpgrades.add(id);
            upg.evolution.apply(this.player.mods, this.player, this);
          }
        }
        this.player.rebuildDrones();
        this.player.hp = Math.max(
          Math.round(this.player.maxHp * 0.5),
          Math.min(this.player.maxHp, Math.round(snap.hp || this.player.maxHp))
        );
        this.player.shield = this.player.maxShield;
        this.player.chrono = this.player.maxChrono;
        this.player.invulnTimer = 2.0;
      } else if (this.player) {
        this.player.history = [];
        this.player.clones = [];
        this.player.afterimages = [];
        this.player.x = spawnX;
        this.player.y = spawnY;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.hp = Math.max(1, Math.round(this.player.maxHp * 0.5));
        this.player.shield = this.player.maxShield;
        this.player.chrono = this.player.maxChrono;
        this.player.invulnTimer = 2.0;
      }

      this._buildDirty = true;
      this.state = 'playing';
      this.timeScale = 1.0;
      this.hitstopTimer = 0;
      this.screenShake = 10;
      this.damageFlash = 0.85;
      this.damageFlashColor = 'crimson';
      this.crosshairBloom = 0;

      this.initLandmarks();
      this.snapCameraToPlayer();

      this.waveBannerTitle = this.t('game.bannerEjected');
      this.waveSubtitle = this.t('game.bannerEjectedSub', { lvl: this.level });
      this.waveBannerColor = '#ff3b6b';
      this.waveBannerTimer = 3.6;
      if (this.player) {
        this.particles.addShockwave(this.player.x, this.player.y, 180, '#ff3b6b', 0.5, 3.2);
        this.particles.burst(this.player.x, this.player.y, 28, '#ff3b6b', 70, 240, 0.55, true);
      }
      this.audio.playRewind();
      this.saveProgress('anomaly_eject');
      this.updateHUD();
    }

    updateAnomalyRespawns(dt) {
      if (this.gameMode !== 'openworld' || !Array.isArray(this.anomalies) || this.anomalies.length === 0) return;
      let respawned = false;
      for (let i = 0; i < this.anomalies.length; i++) {
        const a = this.anomalies[i];
        if (!a || !a.cleared) continue;
        if (!(a.respawnTimer > 0)) {
          a.respawnTimer = this._rollAnomalyRespawnDelay(a.tier);
        }
        a.respawnTimer -= dt;
        if (a.respawnTimer <= 0) {
          const avoidPoints = [{ x: a.x, y: a.y, dist: 1600 }];
          if (this.zone === 'overworld' && this.player) {
            avoidPoints.push({ x: this.player.x, y: this.player.y, dist: 1000 });
          }
          const others = this.anomalies.filter((other, idx) => idx !== i && other && !other.cleared);
          const pos = this._findRandomAnomalyPos({ existingPoints: others, avoidPoints });
          const fresh = this._makeAnomaly(a.tier, pos.x, pos.y);
          this.anomalies[i] = fresh;
          respawned = true;
          if (this.zone === 'overworld' && this.player) {
            this.particles.addShockwave(fresh.x, fresh.y, 150, fresh.color, 0.5, 3);
            this.particles.addText(
              this.player.x,
              this.player.y - 42,
              this.t('game.anomalyRespawned', { tier: fresh.tier, name: fresh.name }),
              fresh.color,
              1.05,
              2.2
            );
          }
        }
      }
      if (respawned && this.zone === 'overworld') {
        this.saveProgress('anomaly_respawn');
      }
    }

    returnToBase() {
      if (this.state !== 'playing' || !this.player) return;
      if (this.zone === 'endless') return;
      if (this.zone === 'anomaly') {
        if (this.anomalyCleared) {
          this.exitAnomalyToOverworld(true);
        } else {
          this.particles.addText(this.player.x, this.player.y - 30, this.t('game.clearAnomalyFirst'), '#ff6b8b', 1.05, 1.3);
        }
        return;
      }
      this.player.history = [];
      this.player.x = this.base.x;
      this.player.y = this.base.y + 140;
      this.player.vx = 0;
      this.player.vy = 0;
      this.snapCameraToPlayer();
      this.particles.addShockwave(this.player.x, this.player.y, 120, '#22ffa6', 0.4, 2.5);
      this.particles.addText(this.player.x, this.player.y - 28, this.t('game.returnedBase'), '#22ffa6', 1.15, 1.3);
      this.audio.playRewind();
      this.saveProgress('return_base');
      this.updateHUD();
    }

    buildSaveSnapshot() {
      if (!this.player) return null;
      const inOverworld = this.zone === 'overworld';
      const saveX = inOverworld
        ? this.player.x
        : (this.overworldPos ? this.overworldPos.x : this.base.x);
      const saveY = inOverworld
        ? this.player.y
        : (this.overworldPos ? this.overworldPos.y : (this.base.y + 145));

      return {
        magic: SG.Save ? SG.Save.MAGIC : 'SINGULARIS_SAVE',
        schemaVersion: SG.Save ? SG.Save.SCHEMA_VERSION : 1,
        gameVersion: SG.VERSION,
        savedAt: Date.now(),
        difficulty: this.settings.difficulty || 'normal',
        run: {
          score: Math.floor(this.score || 0),
          level: Math.max(1, Math.floor(this.level || 1)),
          xp: Math.max(0, this.xp || 0),
          xpNext: Math.max(50, this.xpNext || 115),
          rerolls: Math.max(0, Math.floor(this.rerolls || 0)),
          wave: Math.max(1, Math.floor(this.wave || 1)),
          maxCombo: Math.max(1.0, this.maxCombo || 1.0)
        },
        player: {
          overworldX: Math.round(saveX * 10) / 10,
          overworldY: Math.round(saveY * 10) / 10,
          hpRatio: Math.max(0.1, Math.min(1, this.player.hp / Math.max(1, this.player.maxHp))),
          shieldRatio: Math.max(0, Math.min(1, this.player.shield / Math.max(1, this.player.maxShield))),
          chronoRatio: Math.max(0, Math.min(1, this.player.chrono / Math.max(1, this.player.maxChrono)))
        },
        build: {
          upgradeStacks: { ...this.upgradeStacks },
          evolvedUpgrades: Array.from(this.evolvedUpgrades || [])
        },
        stats: {
          kills: Math.floor((this.stats && this.stats.kills) || 0),
          slingshots: Math.floor((this.stats && this.stats.slingshots) || 0),
          hijacks: Math.floor((this.stats && this.stats.hijacks) || 0),
          annihilations: Math.floor((this.stats && this.stats.annihilations) || 0),
          anomaliesCleared: Math.floor((this.stats && this.stats.anomaliesCleared) || 0)
        },
        world: {
          worldSize: WORLD_SIZE,
          base: { x: this.base.x, y: this.base.y },
          anomalies: (this.anomalies || []).map(a => ({
            id: a.id,
            tier: a.tier,
            name: a.name,
            x: Math.round(a.x * 10) / 10,
            y: Math.round(a.y * 10) / 10,
            cleared: !!a.cleared,
            respawnTimer: a.cleared ? Math.max(0, Math.round((a.respawnTimer || 0) * 10) / 10) : 0
          })),
          buildings: Array.isArray(this.buildings) ? this.buildings : [],
          resources: (this.resources && typeof this.resources === 'object') ? this.resources : {}
        }
      };
    }

    saveProgress(reason = 'auto') {
      if (!SG.Save || !this.player) return false;
      if (this.state === 'title' || this.state === 'gameover') return false;
      if (this.gameMode === 'endless') {
        if (this.score > this.bestEndlessScore) this.bestEndlessScore = this.score;
        if (this.wave > this.bestEndlessWave) this.bestEndlessWave = this.wave;
        SG.Save.saveMeta({
          bestScore: this.bestScore,
          bestWave: this.bestWave,
          bestEndlessScore: this.bestEndlessScore,
          bestEndlessWave: this.bestEndlessWave,
          totalKills: this.totalKills,
          totalAnomaliesCleared: this.totalAnomaliesCleared || 0
        });
        return true;
      }
      const snap = this.buildSaveSnapshot();
      const ok = SG.Save.write(snap);
      if (ok) {
        this._lastSavedAt = Date.now();
        this._autoSaveTimer = 0;
        if (this.score > this.bestScore) this.bestScore = this.score;
        if (this.wave > this.bestWave) this.bestWave = this.wave;
        SG.Save.saveMeta({
          bestScore: this.bestScore,
          bestWave: this.bestWave,
          bestEndlessScore: this.bestEndlessScore || 0,
          bestEndlessWave: this.bestEndlessWave || 0,
          totalKills: this.totalKills,
          totalAnomaliesCleared: this.totalAnomaliesCleared || 0
        });
      }
      return ok;
    }

    clearRunSave() {
      if (SG.Save) SG.Save.clearRun();
    }

    loadSavedRun(importedData = null) {
      if (!SG.Save) return false;
      const saved = importedData ? SG.Save.migrate(importedData, WORLD_SIZE) : SG.Save.read(WORLD_SIZE);
      if (!saved) return false;

      this.cancelUpgradeAnim();
      this.clearInputs();
      this._subModalOrigin = null;
      this.gameMode = 'openworld';

      this.settings.difficulty = DIFFICULTIES[saved.difficulty] ? saved.difficulty : 'normal';
      this.saveSettings();
      this.updateDifficultyUI();

      this.zone = 'overworld';
      this.bounds = { width: WORLD_SIZE, height: WORLD_SIZE };
      this.activeAnomaly = null;
      this.anomalyCleared = false;
      this.dungeonWaveIndex = 0;
      this.dungeonWavesTotal = 0;
      this.exitPortal = null;
      this._preDungeonSnapshot = null;
      this.inBaseZone = false;
      this.waypoint = null;
      this._worldMapHover = null;

      this.base = {
        x: saved.world.base.x,
        y: saved.world.base.y,
        radius: 64,
        repairRadius: 210
      };
      this.buildings = Array.isArray(saved.world.buildings) ? saved.world.buildings : [];
      const savedMatter = (saved.world.resources && typeof saved.world.resources.matter === 'number')
        ? saved.world.resources.matter
        : 60;
      this.resources = { matter: Math.max(0, savedMatter) };
      this.buildPlacement = null;
      this._baseXpAcc = 0;
      this._baseMatterAcc = 0;
      this._basePulseTimer = 0;
      this._baseHpBonus = 0;
      this._baseShieldBonus = 0;

      if (saved.world.anomalies && saved.world.anomalies.length > 0) {
        this.anomalies = saved.world.anomalies.map(a => {
          const cfg = ANOMALY_TIERS[a.tier] || ANOMALY_TIERS[1];
          const fallbackName = cfg.names[0];
          return {
            id: a.id,
            tier: a.tier,
            name: a.name || fallbackName,
            color: cfg.color,
            startWave: cfg.startWave,
            wavesTotal: cfg.wavesTotal,
            hasBoss: cfg.hasBoss,
            x: a.x,
            y: a.y,
            radius: 54 + a.tier * 3,
            cleared: !!a.cleared,
            respawnTimer: a.cleared ? (a.respawnTimer > 0 ? a.respawnTimer : this._rollAnomalyRespawnDelay(a.tier)) : 0,
            enterProgress: 0
          };
        });
        while (this.anomalies.length < 15) {
          const t = 1 + Math.floor(Math.random() * 5);
          this.spawnNewAnomaly(t);
        }
      } else {
        this.initOverworldEntities();
      }

      this.player = new SG.Player(saved.player.overworldX, saved.player.overworldY);
      this.overworldPos = { x: this.player.x, y: this.player.y };

      this.wells = [];
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.waveQueue = [];
      this.particles.clear();

      this.score = saved.run.score;
      this.level = saved.run.level;
      this.xp = saved.run.xp;
      this.xpNext = saved.run.xpNext || this.computeNextXp(this.level);
      this.rerolls = saved.run.rerolls;
      this.wave = saved.run.wave;
      this.maxCombo = saved.run.maxCombo;
      this.combo = 1.0;
      this.comboTimer = 0;
      this.comboTier = 0;
      this.stats = { ...saved.stats };
      this.currentChoices = [];

      // Re-apply upgrades & evolutions against current patch's catalog
      this.upgradeStacks = {};
      this.evolvedUpgrades = new Set();
      let retiredCount = 0;
      const evoWanted = new Set(saved.build.evolvedUpgrades || []);

      for (const [id, rawCount] of Object.entries(saved.build.upgradeStacks || {})) {
        const upg = SG.UPGRADES.find(u => u.id === id);
        if (!upg) {
          retiredCount += rawCount;
          continue;
        }
        const stacks = Math.max(1, Math.min(upg.maxStacks, rawCount));
        this.upgradeStacks[id] = stacks;
        for (let s = 0; s < stacks; s++) {
          upg.apply(this.player.mods, this.player, this);
        }
        if (upg.evolution && (evoWanted.has(id) || stacks >= upg.maxStacks)) {
          this.evolvedUpgrades.add(id);
          upg.evolution.apply(this.player.mods, this.player, this);
        }
      }

      if (retiredCount > 0) {
        this.rerolls += retiredCount;
        this.xp += retiredCount * 120;
      }

      this.player.rebuildDrones();
      this.syncBaseBonuses();
      this.player.hp = Math.max(1, Math.min(this.player.maxHp, Math.round(this.player.maxHp * saved.player.hpRatio)));
      this.player.shield = Math.max(0, Math.min(this.player.maxShield, this.player.maxShield * saved.player.shieldRatio));
      this.player.chrono = Math.max(0, Math.min(this.player.maxChrono, this.player.maxChrono * saved.player.chronoRatio));

      this._buildDirty = true;
      this.screenShake = 0;
      this.hitstopTimer = 0;
      this.damageFlash = 0;
      this.crosshairBloom = 0;
      this.timeScale = 1.0;

      this.initLandmarks();
      this.snapCameraToPlayer();
      this.state = 'playing';
      this.closeAllDialogs();

      const migratedPatch = saved.gameVersion && saved.gameVersion !== SG.VERSION;
      this.waveBannerTitle = migratedPatch ? this.t('game.saveMigratedTitle') : this.t('game.saveLoadedTitle');
      this.waveSubtitle = migratedPatch
        ? this.t('game.saveMigratedSub', { from: saved.gameVersion, to: SG.VERSION })
        : this.t('game.saveLoadedSub', { lvl: this.level, cleared: this.stats.anomaliesCleared });
      this.waveBannerColor = migratedPatch ? '#22ffa6' : '#00f0ff';
      this.waveBannerTimer = 3.2;

      this.particles.addShockwave(this.player.x, this.player.y, 160, this.waveBannerColor, 0.45, 3);
      if (retiredCount > 0) {
        this.particles.addText(this.player.x, this.player.y - 34, this.t('game.compensation', { n: retiredCount }), '#ffd166', 1.15, 2.0);
      }

      this.saveProgress('loaded');
      this.updateHUD();
      this.checkLevelUp();
      return true;
    }

    updateTitleSaveUI() {
      const contBtn = document.getElementById('btn-continue-play');
      const startBtn = document.getElementById('btn-start-play');
      const metaEl = document.getElementById('title-save-meta');
      const saved = SG.Save ? SG.Save.peek(WORLD_SIZE) : null;

      if (saved) {
        const modsCnt = Object.keys(saved.build.upgradeStacks || {}).length;
        if (contBtn) {
          contBtn.hidden = false;
          contBtn.textContent = this.t('title.continueBtn', { lvl: saved.run.level, cleared: saved.stats.anomaliesCleared });
        }
        if (metaEl) {
          metaEl.hidden = false;
          metaEl.textContent = this.t('title.saveMeta', {
            ver: saved.gameVersion,
            mods: modsCnt,
            score: saved.run.score.toLocaleString(this.locale())
          });
        }
        if (startBtn) {
          startBtn.classList.remove('btn-primary');
          startBtn.classList.add('btn-secondary');
          startBtn.textContent = this.t('title.newGame');
        }
      } else {
        if (contBtn) contBtn.hidden = true;
        if (metaEl) metaEl.hidden = true;
        if (startBtn) {
          startBtn.classList.remove('btn-secondary');
          startBtn.classList.add('btn-primary');
          startBtn.textContent = this.t('title.openWorld');
        }
      }
      const endlessBtn = document.getElementById('btn-start-endless');
      if (endlessBtn) {
        endlessBtn.textContent = this.bestEndlessWave > 0
          ? this.t('title.endlessBest', { wave: this.bestEndlessWave.toLocaleString(this.locale()) })
          : this.t('title.endless');
      }
    }

    handleResize() {
      const preset = this.getPreset();
      this.viewport.width = window.innerWidth;
      this.viewport.height = window.innerHeight;
      this.dpr = Math.min(preset.maxDpr, window.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.floor(this.viewport.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(this.viewport.height * this.dpr));
      this.canvas.style.width = `${this.viewport.width}px`;
      this.canvas.style.height = `${this.viewport.height}px`;
      if (this.gpu) {
        this.gpu.resize(this.viewport.width, this.viewport.height, this.dpr);
      }
      this.grid.resize(this.viewport.width, this.viewport.height);
      if (this.player) {
        const pad = this.player.radius + 8;
        this.player.x = Math.max(pad, Math.min(this.bounds.width - pad, this.player.x));
        this.player.y = Math.max(pad, Math.min(this.bounds.height - pad, this.player.y));
        const maxCX = Math.max(0, this.bounds.width - this.viewport.width);
        const maxCY = Math.max(0, this.bounds.height - this.viewport.height);
        this.camera.x = Math.max(0, Math.min(maxCX, this.camera.x));
        this.camera.y = Math.max(0, Math.min(maxCY, this.camera.y));
        this.grid.setViewOrigin(this.camera.x, this.camera.y);
      }

      // Cache 2D fallback gradients on resize so render() allocates zero gradients per frame
      const w = this.viewport.width;
      const h = this.viewport.height;
      const rad = Math.max(w, h) * 0.78;
      this.bgGradNormal = this.ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, rad);
      this.bgGradNormal.addColorStop(0, '#070d1d');
      this.bgGradNormal.addColorStop(1, '#03060f');

      this.bgGradSlow = this.ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, rad);
      this.bgGradSlow.addColorStop(0, '#0c0822');
      this.bgGradSlow.addColorStop(1, '#04030d');

      const wmDlg = document.getElementById('worldmap-dialog');
      if (wmDlg && wmDlg.open) {
        this.renderWorldMap();
      }
    }

    bindEvents() {
      window.addEventListener('resize', () => this.handleResize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 120));
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.handleResize());
      }

      window.addEventListener('touchstart', () => {
        this._lastTouchTime = performance.now();
        if (!this._detectedTouch) {
          this._detectedTouch = true;
          this.syncTouchMode();
          this.updateHUD();
        }
      }, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          return;
        }
        if (this.settings.touchMode === 'auto' && this.isTouchDevice) {
          this.isTouchDevice = false;
          if (document.body && document.body.classList) document.body.classList.remove('is-touch');
          this.updateHUD();
        }
        this.keys[e.code] = true;

        // Upgrade card hotkeys 1, 2, 3, 4 and R for reroll
        if (this.state === 'upgrade') {
          if (e.repeat || this._upgradeSelecting) return;
          if (e.code === 'Digit1' && this.currentChoices[0]) this.selectUpgrade(this.currentChoices[0]);
          if (e.code === 'Digit2' && this.currentChoices[1]) this.selectUpgrade(this.currentChoices[1]);
          if (e.code === 'Digit3' && this.currentChoices[2]) this.selectUpgrade(this.currentChoices[2]);
          if (e.code === 'Digit4' && this.currentChoices[3]) this.selectUpgrade(this.currentChoices[3]);
          if (e.code === 'KeyR') this.rerollUpgrades();
          return;
        }

        if (e.code === 'Escape' && this.state === 'playing') {
          e.preventDefault();
          if (this.buildPlacement) {
            this.cancelBuildPlacement();
          } else {
            this.openPauseMenu();
          }
          return;
        }

        if (e.code === 'KeyG') {
          const bDlg = document.getElementById('build-dialog');
          if (this.zone === 'overworld' && (this.state === 'playing' || (bDlg && bDlg.open))) {
            e.preventDefault();
            if (this.buildPlacement) {
              this.cancelBuildPlacement();
            } else {
              this.toggleBuildModal();
            }
          }
          return;
        }

        if (e.code === 'Tab') {
          const wmDlg = document.getElementById('worldmap-dialog');
          if (this.zone === 'overworld' && (this.state === 'playing' || (wmDlg && wmDlg.open))) {
            e.preventDefault();
            this.toggleWorldMap();
          }
          return;
        }

        if (e.code === 'KeyM') {
          this.toggleMute();
        } else if (e.code === 'KeyR' && this.state === 'playing') {
          this.repulsorMode = !this.repulsorMode;
          this.particles.addText(
            this.player.x,
            this.player.y - 26,
            this.repulsorMode ? this.t('game.modeWhite') : this.t('game.modeBlack'),
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
        } else if (e.code === 'KeyT' && this.state === 'playing') {
          this.returnToBase();
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
        if (performance.now() - this._lastTouchTime < 700) return;
        this.mouseScreen.x = e.clientX;
        this.mouseScreen.y = e.clientY;
        const wp = this.screenToWorld(e.clientX, e.clientY);
        this.mouse.x = wp.x;
        this.mouse.y = wp.y;
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (performance.now() - this._lastTouchTime < 700) return;
        this.audio.init();
        this.mouseScreen.x = e.clientX;
        this.mouseScreen.y = e.clientY;
        const wp = this.screenToWorld(e.clientX, e.clientY);
        this.mouse.x = wp.x;
        this.mouse.y = wp.y;
        if (this.state !== 'playing') return;

        if (this.buildPlacement && this.zone === 'overworld') {
          if (e.button === 0) {
            this.tryPlaceBuilding(wp.x, wp.y);
          } else if (e.button === 2) {
            e.preventDefault();
            this.cancelBuildPlacement();
          }
          return;
        }

        if (e.button === 0 && this.zone === 'overworld' && this._minimapRect) {
          const rect = this.canvas.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          const mr = this._minimapRect;
          if (cx >= mr.x && cx <= mr.x + mr.size && cy >= mr.y && cy <= mr.y + mr.size) {
            this.openWorldMap();
            return;
          }
        }

        if (e.button === 0) {
          this.mouse.leftDown = true;
        } else if (e.button === 2 || e.button === 1) {
          e.preventDefault();
          const useRepulsor = e.button === 1 || e.shiftKey || this.repulsorMode;
          this.spawnGravityWell(wp.x, wp.y, useRepulsor);
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (performance.now() - this._lastTouchTime < 700) return;
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

      const handleSubDialogClose = (e) => {
        const dlg = e && e.currentTarget;
        if (dlg && dlg.dataset && (Number(dlg.dataset.silentClose) || 0) > 0) {
          dlg.dataset.silentClose = String(Number(dlg.dataset.silentClose) - 1);
          return;
        }
        if (dlg && dlg.open) return;

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
        } else if (origin === 'playing' && !this.hasAnyModalOpen()) {
          this.state = 'playing';
          this.updateHUD();
        }
      };

      const codexDlg = document.getElementById('codex-dialog');
      if (codexDlg) codexDlg.addEventListener('close', handleSubDialogClose);

      const modulesDlg = document.getElementById('modules-dialog');
      if (modulesDlg) modulesDlg.addEventListener('close', handleSubDialogClose);

      const settingsDlg = document.getElementById('settings-dialog');
      if (settingsDlg) settingsDlg.addEventListener('close', handleSubDialogClose);

      const worldmapDlg = document.getElementById('worldmap-dialog');
      if (worldmapDlg) worldmapDlg.addEventListener('close', handleSubDialogClose);

      const buildDlg = document.getElementById('build-dialog');
      if (buildDlg) buildDlg.addEventListener('close', handleSubDialogClose);

      const pauseDlg = document.getElementById('pause-dialog');
      if (pauseDlg) {
        pauseDlg.addEventListener('close', () => {
          if (pauseDlg.dataset && (Number(pauseDlg.dataset.silentClose) || 0) > 0) {
            pauseDlg.dataset.silentClose = String(Number(pauseDlg.dataset.silentClose) - 1);
            return;
          }
          if (pauseDlg.open) return;
          if (this.state === 'paused' && !this.hasAnyModalOpen()) {
            this.state = 'playing';
            this.updateHUD();
          }
        });
      }

      // Language, Difficulty & Quality selector buttons
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.setLanguage(btn.dataset.lang);
        });
      });

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
      const continueBtn = document.getElementById('btn-continue-play');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          this.audio.init();
          this.loadSavedRun();
        });
      }

      document.getElementById('btn-start-play').addEventListener('click', () => {
        this.audio.init();
        this.resetRun(true, 'openworld');
      });

      const startEndlessBtn = document.getElementById('btn-start-endless');
      if (startEndlessBtn) {
        startEndlessBtn.addEventListener('click', () => {
          this.audio.init();
          this.resetRun(true, 'endless');
        });
      }

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

      const returnBtn = document.getElementById('btn-hud-return');
      if (returnBtn) {
        returnBtn.addEventListener('click', () => {
          this.returnToBase();
        });
      }

      const mapBtn = document.getElementById('btn-hud-map');
      if (mapBtn) {
        mapBtn.addEventListener('click', () => {
          this.toggleWorldMap();
        });
      }

      const closeMapBtn = document.getElementById('btn-close-worldmap');
      if (closeMapBtn) {
        closeMapBtn.addEventListener('click', () => {
          const dlg = document.getElementById('worldmap-dialog');
          if (dlg && dlg.open) dlg.close();
        });
      }

      const clearWpBtn = document.getElementById('btn-worldmap-clear-wp');
      if (clearWpBtn) {
        clearWpBtn.addEventListener('click', () => {
          this.waypoint = null;
          this.renderWorldMap();
        });
      }

      const mapBaseBtn = document.getElementById('btn-worldmap-base');
      if (mapBaseBtn) {
        mapBaseBtn.addEventListener('click', () => {
          const dlg = document.getElementById('worldmap-dialog');
          this.closeDialogSilently(dlg);
          this._subModalOrigin = null;
          this.state = 'playing';
          this.returnToBase();
        });
      }

      const wmCanvas = document.getElementById('worldmap-canvas');
      if (wmCanvas) {
        wmCanvas.addEventListener('mousemove', (e) => {
          const wp = this._worldMapEventToWorld(e);
          if (!wp) return;
          let hover = null;
          let bestDist = 700;
          for (let i = 0; i < this.anomalies.length; i++) {
            const a = this.anomalies[i];
            const d = Math.hypot(wp.x - a.x, wp.y - a.y);
            if (d < bestDist) {
              bestDist = d;
              hover = { kind: 'anomaly', anomaly: a, wx: wp.x, wy: wp.y };
            }
          }
          if (!hover && Math.hypot(wp.x - this.base.x, wp.y - this.base.y) < 900) {
            hover = { kind: 'base', wx: wp.x, wy: wp.y };
          }
          if (!hover) {
            hover = { kind: 'sector', wx: wp.x, wy: wp.y };
          }
          this._worldMapHover = hover;
          this.renderWorldMap();
        });

        wmCanvas.addEventListener('mouseleave', () => {
          this._worldMapHover = null;
          this.renderWorldMap();
        });

        wmCanvas.addEventListener('click', (e) => {
          const wp = this._worldMapEventToWorld(e);
          if (!wp) return;
          this._setWorldMapWaypoint(wp.x, wp.y);
          this.renderWorldMap();
        });
      }

      const buildHudBtn = document.getElementById('btn-hud-build');
      if (buildHudBtn) {
        buildHudBtn.addEventListener('click', () => {
          if (this.zone === 'overworld') this.toggleBuildModal();
        });
      }
      const closeBuildBtn = document.getElementById('btn-close-build');
      if (closeBuildBtn) {
        closeBuildBtn.addEventListener('click', () => {
          const dlg = document.getElementById('build-dialog');
          if (dlg && dlg.open) dlg.close();
        });
      }
      const cancelPlaceBtn = document.getElementById('btn-cancel-placement');
      if (cancelPlaceBtn) {
        cancelPlaceBtn.addEventListener('click', () => {
          this.cancelBuildPlacement();
        });
      }

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
        this.resetRun(true, this.gameMode);
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
      const langSel = document.getElementById('set-lang');
      if (langSel) {
        langSel.addEventListener('change', () => {
          this.setLanguage(langSel.value);
        });
      }

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

      const texCb = document.getElementById('set-textures');
      if (texCb) {
        texCb.addEventListener('change', () => {
          this.settings.useTextures = texCb.checked;
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

      const touchModeSel = document.getElementById('set-touch-mode');
      if (touchModeSel) {
        touchModeSel.addEventListener('change', () => {
          this.settings.touchMode = touchModeSel.value;
          this.applySettings();
          this.saveSettings();
          this.updateHUD();
        });
      }

      const touchFloatCb = document.getElementById('set-touch-floating');
      if (touchFloatCb) {
        touchFloatCb.addEventListener('change', () => {
          this.settings.touchFloating = touchFloatCb.checked;
          this.saveSettings();
        });
      }

      const touchAutoCb = document.getElementById('set-touch-autofire');
      if (touchAutoCb) {
        touchAutoCb.addEventListener('change', () => {
          this.settings.touchAutofire = touchAutoCb.checked;
          this.saveSettings();
        });
      }

      const touchCanvasWellCb = document.getElementById('set-touch-canvas-well');
      if (touchCanvasWellCb) {
        touchCanvasWellCb.addEventListener('change', () => {
          this.settings.touchCanvasWell = touchCanvasWellCb.checked;
          this.saveSettings();
        });
      }

      const touchScaleSlider = document.getElementById('set-touch-scale');
      if (touchScaleSlider) {
        touchScaleSlider.addEventListener('input', () => {
          this.settings.touchScale = Number(touchScaleSlider.value);
          this.applySettings();
          this.saveSettings();
          this.syncSettingsUI();
        });
      }

      const touchOpacitySlider = document.getElementById('set-touch-opacity');
      if (touchOpacitySlider) {
        touchOpacitySlider.addEventListener('input', () => {
          this.settings.touchOpacity = Number(touchOpacitySlider.value);
          this.applySettings();
          this.saveSettings();
          this.syncSettingsUI();
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
            resetRecBtn.textContent = this.t('set.resetConfirm');
            clearTimeout(this._resetConfirmTimer);
            this._resetConfirmTimer = setTimeout(() => {
              resetRecBtn.dataset.armed = '0';
              resetRecBtn.textContent = this.t('set.resetRecords');
            }, 3000);
            return;
          }
          clearTimeout(this._resetConfirmTimer);
          resetRecBtn.dataset.armed = '0';
          resetRecBtn.textContent = this.t('set.resetDone');
          this.bestScore = 0;
          this.bestWave = 1;
          this.totalKills = 0;
          this.totalAnomaliesCleared = 0;
          localStorage.removeItem('singularis_best_score');
          localStorage.removeItem('singularis_best_wave');
          localStorage.removeItem('singularis_total_kills');
          if (SG.Save) localStorage.removeItem(SG.Save.META_KEY);
          this.updateTitleBest();
          setTimeout(() => {
            resetRecBtn.textContent = 'Сбросить рекорды';
          }, 1600);
        });
      }

      const exportSaveBtn = document.getElementById('btn-export-save');
      const importSaveBtn = document.getElementById('btn-import-save');
      const saveIoStatus = document.getElementById('save-io-status');
      if (exportSaveBtn && SG.Save) {
        exportSaveBtn.addEventListener('click', () => {
          const snap = (this.player && this.state !== 'title' && this.state !== 'gameover')
            ? this.buildSaveSnapshot()
            : SG.Save.peek(WORLD_SIZE);
          if (!snap) {
            if (saveIoStatus) saveIoStatus.textContent = this.t('set.saveNoActive');
            return;
          }
          const code = SG.Save.exportCode(snap);
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(code).catch(() => {});
          }
          if (typeof window.prompt === 'function') {
            window.prompt(this.t('set.savePromptExport'), code);
          }
          if (saveIoStatus) saveIoStatus.textContent = this.t('set.saveExported', { ver: snap.gameVersion });
        });
      }
      if (importSaveBtn && SG.Save) {
        importSaveBtn.addEventListener('click', () => {
          const raw = typeof window.prompt === 'function' ? window.prompt(this.t('set.savePromptImport')) : '';
          if (!raw) return;
          const imported = SG.Save.importCode(raw, WORLD_SIZE);
          if (!imported) {
            if (saveIoStatus) saveIoStatus.textContent = this.t('set.saveImportErr');
            return;
          }
          SG.Save.write(imported);
          this.updateTitleSaveUI();
          if (saveIoStatus) saveIoStatus.textContent = this.t('set.saveImported', { from: imported.gameVersion, to: SG.VERSION });
          this.loadSavedRun(imported);
        });
      }

      // Auto-save when closing tab or hiding app
      window.addEventListener('beforeunload', () => {
        this.saveProgress('beforeunload');
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.saveProgress('visibilitychange');
        }
      });

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
        modTitleBtn.textContent = this.t('title.catalog', { n: SG.UPGRADES.length });
      }

      const rerollBtn = document.getElementById('btn-upgrade-reroll');
      if (rerollBtn) {
        rerollBtn.addEventListener('click', () => this.rerollUpgrades());
      }

      document.getElementById('btn-restart').addEventListener('click', () => {
        this.audio.init();
        this.resetRun(true, this.gameMode);
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
      const loc = this.locale();
      const scoreEl = document.getElementById('title-stat-score');
      if (scoreEl) scoreEl.textContent = (this.bestScore || 0).toLocaleString(loc);
      const waveEl = document.getElementById('title-stat-wave');
      if (waveEl) waveEl.textContent = Math.max(this.bestWave || 1, this.bestEndlessWave || 0).toLocaleString(loc);
      const killsEl = document.getElementById('title-stat-kills');
      if (killsEl) killsEl.textContent = (this.totalKills || 0).toLocaleString(loc);

      const sysEl = document.getElementById('title-sys-status');
      if (sysEl) {
        const backend = (this.gpu && this.gpu.isActive()) ? this.gpu.backend : '2D CANVAS';
        sysEl.textContent = `● ${backend} • ${this.getPreset().label}`;
      }

      const el = document.getElementById('title-best-record');
      if (el) {
        const endlessSuffix = this.bestEndlessWave > 0
          ? this.t('title.endlessRecSuffix', { wave: this.bestEndlessWave.toLocaleString(loc) })
          : '';
        el.textContent = this.bestScore > 0
          ? `${this.t('title.record', { score: this.bestScore.toLocaleString(loc), wave: this.bestWave, kills: this.totalKills })}${endlessSuffix}`
          : `${this.t('title.firstRun')}${endlessSuffix}`;
      }
      this.updateTitleSaveUI();
    }

    openMainMenu() {
      this.saveProgress('mainmenu');
      this.cancelUpgradeAnim();
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
      const diffKey = this.settings.difficulty === 'easy'
        ? 'title.diffEasyName'
        : (this.settings.difficulty === 'hard' ? 'title.diffHardName' : 'title.diffNormalName');
      const diffLabel = this.t(diffKey);
      const summary = document.getElementById('pause-summary');
      if (summary) {
        const p = this.player;
        const m = p.mods;
        const armorPct = Math.round(Math.min(0.75, m.armor) * 100);
        const gravPct = Math.round(m.wellGravMult * 100);
        const loc = this.locale();
        summary.textContent = this.gameMode === 'endless'
          ? this.t('pause.summaryEndless', { wave: this.wave.toLocaleString(loc), lvl: this.level, diff: diffLabel, hp: Math.ceil(p.hp), maxHp: p.maxHp, arm: armorPct, grav: gravPct })
          : this.t('pause.summaryOpen', { wave: this.wave, lvl: this.level, diff: diffLabel, hp: Math.ceil(p.hp), maxHp: p.maxHp, arm: armorPct, grav: gravPct });
      }
      const pillsEl = document.getElementById('pause-upgrades');
      if (pillsEl) {
        pillsEl.innerHTML = '';
        const entries = Object.entries(this.upgradeStacks);
        if (entries.length === 0) {
          const span = document.createElement('span');
          span.className = 'upgrade-pill';
          span.textContent = this.t('pause.noModules');
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
      this.saveProgress('pause');
      this.clearInputs();
      this.state = 'paused';
      this.updateHUD();
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
        this.updateHUD();
      }
    }

    openSettings(origin = 'title') {
      this.clearInputs();
      this._subModalOrigin = origin;
      this.closeAllDialogs('settings-dialog');
      if (origin === 'playing' || origin === 'pause') {
        this.state = 'paused';
        this.updateHUD();
      }
      this.syncSettingsUI();
      const dlg = document.getElementById('settings-dialog');
      if (dlg && !dlg.open) dlg.showModal();
    }

    toggleMute() {
      this.audio.toggleMute();
      this.updateHUD();
    }

    openSubModal(dialogId, origin = 'playing') {
      this.clearInputs();
      this._subModalOrigin = origin;
      this.closeAllDialogs(dialogId);
      if (origin === 'playing' || origin === 'pause' || this.state === 'playing') {
        this.state = 'paused';
        this.updateHUD();
      }
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
      } else if (this.state === 'paused') {
        const pauseDlg = document.getElementById('pause-dialog');
        const origin = (pauseDlg && pauseDlg.open) ? 'pause' : (this._subModalOrigin || 'pause');
        this.openCodex(origin);
      }
    }

    openWorldMap() {
      if (this.zone !== 'overworld') return;
      if (this.state !== 'playing' && this.state !== 'paused') return;
      const pauseDlg = document.getElementById('pause-dialog');
      const origin = (this.state === 'paused' && ((pauseDlg && pauseDlg.open) || this._subModalOrigin === 'pause'))
        ? 'pause'
        : 'playing';
      this.openSubModal('worldmap-dialog', origin);
      this.renderWorldMap();
    }

    toggleWorldMap() {
      const dlg = document.getElementById('worldmap-dialog');
      if (!dlg) return;
      if (dlg.open) {
        dlg.close();
      } else if (this.zone === 'overworld' && (this.state === 'playing' || this.state === 'paused')) {
        this.openWorldMap();
      }
    }

    getBaseBonuses() {
      const list = Array.isArray(this.buildings) ? this.buildings : [];
      let xpPerSec = 0;
      let matterPerSec = 0;
      let hpShieldPct = 0;
      let xpMultPct = 0;
      let respawnReduce = 0;
      let baseRegenMult = 1;

      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const lvl = Math.max(1, Math.min(3, b.level || 1));
        const def = BUILDING_DEFS.find(d => d.id === b.type);
        if (!def) continue;
        const val = def.rates[lvl - 1] || def.rates[0];
        if (b.type === 'xp_extractor') xpPerSec += val;
        else if (b.type === 'matter_synth') matterPerSec += val;
        else if (b.type === 'repair_pylon') {
          hpShieldPct += val / 100;
          baseRegenMult += 0.35 * lvl;
        } else if (b.type === 'xp_beacon') {
          xpMultPct += val / 100;
          respawnReduce += 0.08 * lvl;
        }
      }

      return {
        xpPerSec,
        matterPerSec,
        hpShieldMult: 1 + hpShieldPct,
        xpMultBonus: xpMultPct,
        respawnSpeedMult: Math.max(0.35, 1 - respawnReduce),
        baseRegenMult
      };
    }

    syncBaseBonuses() {
      if (!this.player) return;
      const bonuses = this.getBaseBonuses();
      const prevMult = this._appliedBaseHpMult || 1;
      const nextMult = bonuses.hpShieldMult || 1;
      if (Math.abs(prevMult - nextMult) > 0.0001) {
        const hpRatio = this.player.hp / Math.max(1, this.player.maxHp);
        const shRatio = this.player.shield / Math.max(1, this.player.maxShield);
        this.player.maxHp = Math.max(40, Math.round((this.player.maxHp / prevMult) * nextMult));
        this.player.maxShield = Math.max(0, Math.round((this.player.maxShield / prevMult) * nextMult));
        this.player.hp = Math.min(this.player.maxHp, Math.max(1, Math.round(this.player.maxHp * hpRatio)));
        this.player.shield = Math.min(this.player.maxShield, Math.round(this.player.maxShield * shRatio));
        this._appliedBaseHpMult = nextMult;
      }
    }

    isValidBuildingPos(wx, wy) {
      if (!this.base) return false;
      const dist = Math.hypot(wx - this.base.x, wy - this.base.y);
      if (dist < BUILD_MIN_R || dist > BUILD_MAX_R) return false;
      const list = Array.isArray(this.buildings) ? this.buildings : [];
      for (let i = 0; i < list.length; i++) {
        if (Math.hypot(wx - list[i].x, wy - list[i].y) < 88) return false;
      }
      return true;
    }

    openBuildModal(origin = 'playing') {
      if (this.zone !== 'overworld') return;
      if (this.state !== 'playing' && this.state !== 'paused') return;
      this.cancelBuildPlacement();
      const pauseDlg = document.getElementById('pause-dialog');
      const resolvedOrigin = (this.state === 'paused' && ((pauseDlg && pauseDlg.open) || this._subModalOrigin === 'pause'))
        ? 'pause'
        : origin;
      this.openSubModal('build-dialog', resolvedOrigin);
      this.renderBuildModal();
    }

    toggleBuildModal() {
      const dlg = document.getElementById('build-dialog');
      if (!dlg) return;
      if (dlg.open) {
        dlg.close();
      } else if (this.zone === 'overworld' && (this.state === 'playing' || this.state === 'paused')) {
        this.openBuildModal();
      }
    }

    startBuildPlacement(typeId) {
      const def = BUILDING_DEFS.find(d => d.id === typeId);
      if (!def) return;
      const owned = (this.buildings || []).filter(b => b.type === typeId).length;
      if (owned >= def.maxCount) return;
      const cost = def.costs[0];
      const matter = (this.resources && this.resources.matter) || 0;
      if (matter < cost) return;

      this.closeDialogSilently(document.getElementById('build-dialog'));
      this._subModalOrigin = null;
      this.state = 'playing';
      this.buildPlacement = { typeId, def, cost };
      this.updateHUD();
      const banner = document.getElementById('build-placement-banner');
      const txt = document.getElementById('build-placement-text');
      if (txt) txt.textContent = `Строительство: ${def.name} (${cost} ⚡) • ЛКМ рядом с базой • ПКМ / Esc — отмена`;
      if (banner) banner.hidden = false;
    }

    cancelBuildPlacement() {
      this.buildPlacement = null;
      const banner = document.getElementById('build-placement-banner');
      if (banner) banner.hidden = true;
    }

    tryPlaceBuilding(wx, wy) {
      if (!this.buildPlacement || this.zone !== 'overworld') return false;
      const { typeId, def, cost } = this.buildPlacement;
      const matter = (this.resources && this.resources.matter) || 0;
      if (matter < cost) {
        this.cancelBuildPlacement();
        return false;
      }
      if (!this.isValidBuildingPos(wx, wy)) {
        this.particles.addText(wx, wy - 20, 'Слишком близко или далеко от базы!', '#ff4d6d', 0.95, 1.1);
        return false;
      }

      if (!this.resources) this.resources = { matter: 0 };
      this.resources.matter = Math.max(0, matter - cost);
      if (!Array.isArray(this.buildings)) this.buildings = [];
      this.buildings.push({
        id: 'bld_' + Math.random().toString(36).slice(2, 9),
        type: typeId,
        x: Math.round(wx),
        y: Math.round(wy),
        level: 1
      });

      this.syncBaseBonuses();
      this.particles.addShockwave(wx, wy, 120, def.color, 0.45, 3);
      this.particles.addText(wx, wy - 28, `+ ${def.name}`, def.color, 1.15, 1.5);
      this.audio.playLevelUp();
      this.cancelBuildPlacement();
      this.saveProgress('build_place');
      this.updateHUD();
      return true;
    }

    upgradeBuilding(id) {
      const b = (this.buildings || []).find(item => item.id === id);
      if (!b) return;
      const def = BUILDING_DEFS.find(d => d.id === b.type);
      if (!def || b.level >= def.maxLevel) return;
      const cost = def.costs[b.level];
      const matter = (this.resources && this.resources.matter) || 0;
      if (matter < cost) return;

      this.resources.matter = matter - cost;
      b.level += 1;
      this.syncBaseBonuses();
      this.particles.addShockwave(b.x, b.y, 110, '#ffd166', 0.4, 2.5);
      this.audio.playLevelUp();
      this.saveProgress('build_upgrade');
      this.updateHUD();
      this.renderBuildModal();
    }

    dismantleBuilding(id) {
      const idx = (this.buildings || []).findIndex(item => item.id === id);
      if (idx === -1) return;
      const b = this.buildings[idx];
      const def = BUILDING_DEFS.find(d => d.id === b.type);
      let spent = 0;
      if (def) {
        for (let l = 0; l < b.level; l++) spent += def.costs[l] || 0;
      }
      const refund = Math.round(spent * 0.5);
      if (!this.resources) this.resources = { matter: 0 };
      this.resources.matter = (this.resources.matter || 0) + refund;
      this.buildings.splice(idx, 1);
      this.syncBaseBonuses();
      this.saveProgress('build_dismantle');
      this.updateHUD();
      this.renderBuildModal();
    }

    renderBuildModal() {
      const matterEl = document.getElementById('build-matter-val');
      const summaryEl = document.getElementById('build-summary-strip');
      const gridEl = document.getElementById('build-catalog-grid');
      const ownedSec = document.getElementById('build-owned-section');
      const ownedList = document.getElementById('build-owned-list');
      if (!gridEl) return;

      const matter = Math.floor((this.resources && this.resources.matter) || 0);
      if (matterEl) matterEl.textContent = `⚡ ${matter} Материи`;

      const bonuses = this.getBaseBonuses();
      if (summaryEl) {
        summaryEl.innerHTML = '';
        const chips = [
          `Фарм XP: +${bonuses.xpPerSec.toFixed(0)} XP/с`,
          `Синтез: +${bonuses.matterPerSec.toFixed(1)} ⚡/с`,
          `Бонус HP/Щита: +${Math.round((bonuses.hpShieldMult - 1) * 100)}%`,
          `Бонус XP: +${Math.round(bonuses.xpMultBonus * 100)}%`
        ];
        chips.forEach(text => {
          const span = document.createElement('span');
          span.className = 'build-stat-chip';
          span.textContent = text;
          summaryEl.appendChild(span);
        });
      }

      gridEl.innerHTML = '';
      BUILDING_DEFS.forEach(def => {
        const count = (this.buildings || []).filter(b => b.type === def.id).length;
        const cost = def.costs[0];
        const canAfford = matter >= cost;
        const atLimit = count >= def.maxCount;

        const card = document.createElement('div');
        card.className = 'build-card';
        card.style.borderColor = `${def.color}55`;

        card.innerHTML = `
          <div class="build-card-top">
            <span class="build-card-title" style="color:${def.color}">${def.name}</span>
            <span class="build-card-count">${count} / ${def.maxCount}</span>
          </div>
          <div class="build-card-desc">${def.desc}</div>
          <div class="build-card-foot">
            <span class="build-card-rate">${def.rateLabel(1)}</span>
            <button type="button" class="btn-primary build-place-btn" style="padding:6px 12px;font-size:12px" ${(!canAfford || atLimit) ? 'disabled' : ''}>
              ${atLimit ? 'Лимит' : `Построить (${cost} ⚡)`}
            </button>
          </div>
        `;
        const btn = card.querySelector('.build-place-btn');
        if (btn && !atLimit && canAfford) {
          btn.addEventListener('click', () => this.startBuildPlacement(def.id));
        }
        gridEl.appendChild(card);
      });

      const list = this.buildings || [];
      if (ownedSec && ownedList) {
        ownedSec.hidden = list.length === 0;
        ownedList.innerHTML = '';
        list.forEach(b => {
          const def = BUILDING_DEFS.find(d => d.id === b.type);
          if (!def) return;
          const isMax = b.level >= def.maxLevel;
          const upgCost = isMax ? 0 : def.costs[b.level];
          const canUpg = !isMax && matter >= upgCost;

          const row = document.createElement('div');
          row.className = 'build-owned-row';
          row.innerHTML = `
            <div class="build-owned-info">
              <strong style="color:${def.color}">${def.name}</strong>
              <span class="build-card-count">УР. ${b.level}/${def.maxLevel}</span>
              <span class="build-card-rate">${def.rateLabel(b.level)}</span>
            </div>
            <div class="build-owned-actions">
              <button type="button" class="hud-btn build-upg-btn" ${(!canUpg || isMax) ? 'disabled' : ''}>
                ${isMax ? 'МАКС' : `Улучшить (${upgCost} ⚡)`}
              </button>
              <button type="button" class="hud-btn build-del-btn" style="border-color:rgba(255,77,109,0.45);color:#ff8fa3">Разобрать</button>
            </div>
          `;
          const upgBtn = row.querySelector('.build-upg-btn');
          if (upgBtn && canUpg) {
            upgBtn.addEventListener('click', () => this.upgradeBuilding(b.id));
          }
          const delBtn = row.querySelector('.build-del-btn');
          if (delBtn) {
            delBtn.addEventListener('click', () => this.dismantleBuilding(b.id));
          }
          ownedList.appendChild(row);
        });
      }
    }

    _worldMapEventToWorld(e) {
      const canvas = document.getElementById('worldmap-canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || parseFloat(canvas.style.width) || canvas.width || 640;
      const h = rect.height || parseFloat(canvas.style.height) || canvas.height || 640;
      const clientX = typeof e.clientX === 'number' ? e.clientX : rect.left + w * 0.5;
      const clientY = typeof e.clientY === 'number' ? e.clientY : rect.top + h * 0.5;
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, w)));
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, h)));
      return {
        x: nx * WORLD_SIZE,
        y: ny * WORLD_SIZE
      };
    }

    _setWorldMapWaypoint(wx, wy) {
      let bestAnom = null;
      let bestDist = 700;
      for (let i = 0; i < this.anomalies.length; i++) {
        const a = this.anomalies[i];
        if (a.cleared) continue;
        const d = Math.hypot(wx - a.x, wy - a.y);
        if (d < bestDist) {
          bestDist = d;
          bestAnom = a;
        }
      }
      if (bestAnom) {
        this.waypoint = {
          x: bestAnom.x,
          y: bestAnom.y,
          label: `[T${bestAnom.tier}] ${bestAnom.name}`,
          color: bestAnom.color
        };
        return;
      }
      if (Math.hypot(wx - this.base.x, wy - this.base.y) < 900) {
        this.waypoint = {
          x: this.base.x,
          y: this.base.y,
          label: this.t('wm.baseWpLabel'),
          color: '#00f0ff'
        };
        return;
      }
      const colNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const colIdx = Math.min(11, Math.max(0, Math.floor((wx / WORLD_SIZE) * 12)));
      const rowIdx = Math.min(12, Math.max(1, Math.floor((wy / WORLD_SIZE) * 12) + 1));
      this.waypoint = {
        x: Math.max(120, Math.min(WORLD_SIZE - 120, wx)),
        y: Math.max(120, Math.min(WORLD_SIZE - 120, wy)),
        label: this.t('wm.wpPrefix', { sec: `${colNames[colIdx]}${rowIdx}` }),
        color: '#ffd166'
      };
    }

    renderWorldMap() {
      const canvas = document.getElementById('worldmap-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const stage = canvas.parentElement;
      const stageRect = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
      const rawSide = Math.min(stageRect.width || 0, stageRect.height || 0);
      const cssSize = rawSide > 80 ? Math.floor(rawSide - 16) : 640;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      canvas.width = Math.max(1, Math.floor(cssSize * dpr));
      canvas.height = Math.max(1, Math.floor(cssSize * dpr));
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      const s = cssSize;
      const scale = s / WORLD_SIZE;

      // Deep tactical background
      ctx.fillStyle = '#040812';
      ctx.fillRect(0, 0, s, s);

      // 12x12 sector grid + A..L / 1..12 edge labels
      const divs = 12;
      const colNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.11)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < divs; i++) {
        const pos = (s * i) / divs;
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, s);
        ctx.moveTo(0, pos);
        ctx.lineTo(s, pos);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(130, 175, 215, 0.45)';
      ctx.font = '700 10px "JetBrains Mono", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let c = 0; c < divs; c++) {
        ctx.fillText(colNames[c], ((c + 0.5) * s) / divs, 4);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < divs; r++) {
        ctx.fillText(String(r + 1), 4, ((r + 0.5) * s) / divs);
      }

      // Outer border
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.75, 0.75, s - 1.5, s - 1.5);

      // Base Build Territory circle (radius 2600) + glowing Base Core
      const bx = this.base.x * scale;
      const by = this.base.y * scale;
      const baseZoneR = 2600 * scale;

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.38)';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(bx, by, baseZoneR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#22ffa6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (this.buildings && this.buildings.length > 0) {
        for (let i = 0; i < this.buildings.length; i++) {
          const b = this.buildings[i];
          const def = BUILDING_DEFS.find(d => d.id === b.type);
          ctx.fillStyle = def ? def.color : '#22ffa6';
          ctx.fillRect(b.x * scale - 2.5, b.y * scale - 2.5, 5, 5);
        }
      }

      ctx.fillStyle = '#7df9ff';
      ctx.font = '800 11px "JetBrains Mono", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.t('wm.baseLabel'), bx, by + 11);

      // Anomalies
      const hoveredAnom = (this._worldMapHover && this._worldMapHover.kind === 'anomaly')
        ? this._worldMapHover.anomaly
        : null;
      for (let i = 0; i < this.anomalies.length; i++) {
        const a = this.anomalies[i];
        const ax = a.x * scale;
        const ay = a.y * scale;
        const isHover = hoveredAnom === a;

        if (a.cleared) {
          ctx.fillStyle = 'rgba(34, 255, 166, 0.45)';
          ctx.beginPath();
          ctx.arc(ax, ay, isHover ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        ctx.strokeStyle = a.color;
        ctx.fillStyle = a.color;
        ctx.lineWidth = isHover ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.arc(ax, ay, isHover ? 12 : 8.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ax, ay, isHover ? 5.5 : 4.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px "JetBrains Mono", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`T${a.tier}`, ax, ay - 10);

        if (a.hasBoss) {
          ctx.fillStyle = '#ffb838';
          ctx.font = '700 8.5px "JetBrains Mono", system-ui, sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(this.t('wm.boss'), ax, ay + 11);
        }
      }

      // Active GPS Waypoint + trajectory line from player
      if (this.waypoint) {
        const wx = this.waypoint.x * scale;
        const wy = this.waypoint.y * scale;
        const wpCol = this.waypoint.color || '#ffd166';

        if (this.player) {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = wpCol;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(this.player.x * scale, this.player.y * scale);
          ctx.lineTo(wx, wy);
          ctx.stroke();
          ctx.restore();
        }

        ctx.strokeStyle = wpCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(wx, wy, 10, 0, Math.PI * 2);
        ctx.moveTo(wx - 14, wy); ctx.lineTo(wx - 6, wy);
        ctx.moveTo(wx + 6, wy); ctx.lineTo(wx + 14, wy);
        ctx.moveTo(wx, wy - 14); ctx.lineTo(wx, wy - 6);
        ctx.moveTo(wx, wy + 6); ctx.lineTo(wx, wy + 14);
        ctx.stroke();

        if (this.player) {
          const distM = Math.round(Math.hypot(this.waypoint.x - this.player.x, this.waypoint.y - this.player.y) / 10);
          ctx.fillStyle = wpCol;
          ctx.font = '800 10.5px "JetBrains Mono", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${distM}м`, wx, wy - 14);
        }
      }

      // Player viewport rect & ship chevron
      if (this.player) {
        const vx = this.camera.x * scale;
        const vy = this.camera.y * scale;
        const vw = Math.max(10, this.viewport.width * scale);
        const vh = Math.max(8, this.viewport.height * scale);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.52)';
        ctx.lineWidth = 1.1;
        ctx.strokeRect(vx, vy, vw, vh);

        const px = this.player.x * scale;
        const py = this.player.y * scale;
        const ang = typeof this.player.aimAngle === 'number' ? this.player.aimAngle : -Math.PI * 0.5;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, 5.2);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, -5.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // Update inspector info bar
      const infoEl = document.getElementById('worldmap-info');
      if (infoEl) {
        if (hoveredAnom) {
          const status = hoveredAnom.cleared
            ? (hoveredAnom.respawnTimer > 0
              ? this.t('wm.statusClearedTimer', { s: Math.ceil(hoveredAnom.respawnTimer) })
              : this.t('wm.statusCleared'))
            : (hoveredAnom.hasBoss ? this.t('wm.statusActiveBoss') : this.t('wm.statusActive'));
          const distM = this.player ? Math.round(Math.hypot(hoveredAnom.x - this.player.x, hoveredAnom.y - this.player.y) / 10) : 0;
          infoEl.textContent = this.t('wm.infoAnom', { tier: hoveredAnom.tier, name: hoveredAnom.name, status, waves: hoveredAnom.wavesTotal, dist: distM });
        } else if (this._worldMapHover && this._worldMapHover.kind === 'base') {
          const distM = this.player ? Math.round(Math.hypot(this.base.x - this.player.x, this.base.y - this.player.y) / 10) : 0;
          infoEl.textContent = this.t('wm.infoBase', { dist: distM });
        } else if (this.waypoint && this.player) {
          const distM = Math.round(Math.hypot(this.waypoint.x - this.player.x, this.waypoint.y - this.player.y) / 10);
          infoEl.textContent = this.t('wm.infoWp', { label: this.waypoint.label, dist: distM });
        } else if (this._worldMapHover && this._worldMapHover.kind === 'sector') {
          const colIdx = Math.min(11, Math.max(0, Math.floor((this._worldMapHover.wx / WORLD_SIZE) * 12)));
          const rowIdx = Math.min(12, Math.max(1, Math.floor((this._worldMapHover.wy / WORLD_SIZE) * 12) + 1));
          infoEl.textContent = this.t('wm.infoSector', {
            sec: `${colNames[colIdx]}${rowIdx}`,
            x: Math.round(this._worldMapHover.wx / 10),
            y: Math.round(this._worldMapHover.wy / 10)
          });
        } else {
          infoEl.textContent = this.t('wm.hint');
        }
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
        common: this.t('mod.rarityCommon'),
        rare: this.t('mod.rarityRare'),
        epic: this.t('mod.rarityEpic'),
        legendary: this.t('mod.rarityLegend')
      };

      const q = (this.catalogQuery || '').trim().toLowerCase();
      const filtered = SG.UPGRADES.filter(u => {
        if (this.catalogFilter !== 'all' && this.getModuleCategory(u) !== this.catalogFilter) return false;
        if (!q) return true;
        const dispTag = SG.I18n ? SG.I18n.translateTag(u.tag) : u.tag;
        return u.title.toLowerCase().includes(q)
          || u.desc.toLowerCase().includes(q)
          || u.tag.toLowerCase().includes(q)
          || dispTag.toLowerCase().includes(q)
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
        sub.textContent = this.t('mod.subDynamic', {
          shown: filtered.length,
          total: SG.UPGRADES.length,
          owned: ownedCount,
          evolved: evolvedCount
        });
      }

      grid.innerHTML = '';
      filtered.forEach(upg => {
        const curStack = this.upgradeStacks[upg.id] || 0;
        const isEvolved = !!(this.evolvedUpgrades && this.evolvedUpgrades.has(upg.id));
        const reqMet = !SG.meetsUpgradeRequirements || SG.meetsUpgradeRequirements(upg, this.upgradeStacks);
        const card = document.createElement('article');
        card.className = `catalog-card rarity-${upg.rarity}${this.getTagClass(upg)}${curStack > 0 ? ' owned' : ''}${isEvolved ? ' evolved' : ''}${!reqMet ? ' locked-req' : ''}`;
        const stackText = isEvolved
          ? this.t('mod.stackEvo')
          : (curStack > 0 ? this.t('mod.stackOwned', { cur: curStack, max: upg.maxStacks }) : this.t('mod.stackMax', { max: upg.maxStacks }));
        const displayTitle = (isEvolved && upg.evolution) ? upg.evolution.title : upg.title;
        const evoHtml = upg.evolution
          ? (isEvolved
            ? `<div class="upg-evo-box">${this.t('mod.evoActive', { perk: upg.evolution.perk })}</div>`
            : `<div class="upg-evo-hint">${this.t('mod.evoNext', { title: upg.evolution.title, perk: upg.evolution.perk })}</div>`)
          : '';
        const reqHtml = (upg.requiresLabel && !reqMet)
          ? `<div class="upg-req-hint">${this.t('mod.req', { label: upg.requiresLabel })}</div>`
          : '';
        const dispTag = SG.I18n ? SG.I18n.translateTag(upg.tag) : upg.tag;
        card.innerHTML = `
          <div class="upg-top">
            <span class="upg-tag">${dispTag}</span>
            <span class="cat-rarity">${isEvolved ? this.t('mod.rarityEvo') : (rarityLabels[upg.rarity] || this.t('mod.rarityMod'))}</span>
          </div>
          <div class="upg-icon">${upg.icon}</div>
          <h3 class="upg-title">${displayTitle}</h3>
          <p class="upg-desc">${upg.desc}</p>
          ${reqHtml}
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
      } else if (this.state === 'paused') {
        const pauseDlg = document.getElementById('pause-dialog');
        const origin = (pauseDlg && pauseDlg.open) ? 'pause' : (this._subModalOrigin || 'pause');
        this.openModulesCatalog(origin);
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
          this.damageEnemy(e, hitDmg, '#ff85f2', manualDetonate ? this.t('game.supernova') : null);
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

    computeWaveScaling(waveNum) {
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const w = Math.max(1, waveNum || 1);
      let waveScale;
      if (w <= 20) {
        const linearPart = 1 + (w - 1) * 0.28;
        const expPart = w <= 3 ? 1.0 : Math.pow(1.135, w - 3);
        waveScale = linearPart * expPart;
      } else {
        const baseAt20 = (1 + 19 * 0.28) * Math.pow(1.135, 17);
        const extra = w - 20;
        waveScale = baseAt20 * (1 + extra * 0.16 + Math.pow(extra, 1.35) * 0.03);
      }
      const evoCount = this.evolvedUpgrades ? this.evolvedUpgrades.size : 0;
      const levelFactor = 1 + Math.max(0, (this.level || 1) - 4) * 0.065 + evoCount * 0.16;
      const hpScale = Math.min(1e12, waveScale * levelFactor * diffCfg.enemyScale);
      const bossScale = Math.min(1e12, hpScale * Math.min(1.15, 0.72 + Math.min(w, 1000) * 0.015));
      return { hpScale, bossScale };
    }

    getEnemyDamageScale() {
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const w = Math.max(1, this.wave || 1);
      const waveDmg = w <= 20
        ? (1 + (w - 1) * 0.10 + Math.pow(Math.max(0, w - 8), 1.25) * 0.04)
        : (1 + 19 * 0.10 + Math.pow(12, 1.25) * 0.04 + Math.pow(w - 20, 0.85) * 0.22);
      return Math.min(1e6, (diffCfg.dmgScale || 1.0) * waveDmg);
    }

    spawnBullet(opts) {
      const dmg = opts.fromPlayer ? opts.damage : Math.max(1, Math.round((opts.damage || 10) * this.getEnemyDamageScale()));
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
        isLance: !!opts.isLance,
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
      const isEndless = this.zone === 'endless';
      const loc = this.locale();
      if (isEndless) {
        this.waveBannerTitle = this.t('game.bannerWaveEndless', { wave: waveNum.toLocaleString(loc) });
        this.waveBannerColor = (waveNum % 5 === 0) ? '#ff3b6b' : '#ffb838';
      } else {
        this.waveBannerTitle = this.zone === 'anomaly'
          ? this.t('game.bannerWaveDungeon', { cur: this.dungeonWaveIndex, total: this.dungeonWavesTotal })
          : this.t('game.bannerWave', { wave: waveNum });
        this.waveBannerColor = this.activeAnomaly ? this.activeAnomaly.color : null;
      }
      this.waveBannerTimer = 2.8;
      this.waveQueue = [];

      // Vacuum leftover XP crystals swiftly into the player between waves
      if (waveNum > 1) {
        for (let i = 0; i < this.pickups.length; i++) {
          if (this.pickups[i].kind === 'xp') this.pickups[i].autoCollect = true;
        }
      }

      const { hpScale, bossScale } = this.computeWaveScaling(waveNum);
      const eliteChance = isEndless
        ? Math.min(0.65, Math.max(0, (waveNum - 3) * 0.045))
        : Math.min(0.45, Math.max(0, (waveNum - 3) * 0.045));
      const isBossWave = waveNum % 5 === 0;

      if (isBossWave) {
        const bossCount = isEndless
          ? (waveNum >= 100 ? 4 : (waveNum >= 50 ? 3 : (waveNum >= 20 ? 2 : 1)))
          : 1;
        const primaryBoss = (waveNum % 10 === 0) ? 'boss_archon' : 'boss_leviathan';
        const bossLocName = SG.I18n ? SG.I18n.enemyName(primaryBoss, SG.ENEMY_TYPES[primaryBoss].name) : SG.ENEMY_TYPES[primaryBoss].name;
        this.waveSubtitle = bossCount > 1
          ? this.t('game.bannerBossMulti', { count: bossCount })
          : this.t('game.bannerBossSingle', { name: bossLocName });
        for (let b = 0; b < bossCount; b++) {
          const bossType = ((waveNum + b) % 2 === 0) ? 'boss_archon' : 'boss_leviathan';
          this.waveQueue.push({ type: bossType, scale: bossScale, wave: waveNum, isElite: false });
        }
        const escortCount = isEndless
          ? Math.min(60, 6 + Math.floor(waveNum * 0.8))
          : Math.min(40, 5 + Math.floor(waveNum * 0.7));
        for (let i = 0; i < escortCount; i++) {
          let eType = i % 2 === 0 ? 'swarmer' : 'sniper';
          if (i % 5 === 1 && waveNum >= 5) eType = 'phalanx';
          else if (i % 5 === 3 && waveNum >= 10) eType = 'weaver';
          else if (i % 4 === 2 && waveNum >= 5) eType = 'pulsar';
          const isElite = waveNum >= 10 && Math.random() < eliteChance * 0.65;
          this.waveQueue.push({ type: eType, scale: hpScale, wave: waveNum, isElite });
        }
        this.audio.playBossAlarm();
        this.particles.addText(
          this.player.x,
          this.player.y - 120,
          bossCount > 1
            ? this.t('game.bossToastMulti', { wave: waveNum.toLocaleString(loc), count: bossCount })
            : this.t('game.bossToastSingle', { wave: waveNum.toLocaleString(loc), name: bossLocName }),
          '#ff3b6b',
          1.45,
          2.4
        );
      } else {
        const subKeys = ['game.sub1', 'game.sub2', 'game.sub3', 'game.sub4', 'game.sub5'];
        this.waveSubtitle = isEndless && waveNum >= 20
          ? this.t('game.subEndlessOverdrive')
          : this.t(subKeys[(waveNum - 1) % subKeys.length]);
        const budget = isEndless
          ? Math.min(130, 8 + waveNum * 3 + Math.floor(Math.max(0, waveNum - 6) * 1.5))
          : Math.min(110, 6 + waveNum * 3 + Math.floor(Math.max(0, waveNum - 6) * 1.5));
        const minElites = waveNum >= 6 ? Math.min(6, Math.floor((waveNum - 4) / 2)) : 0;
        let elitesAssigned = 0;
        const elitePool = ['phalanx', 'pulsar', 'weaver', 'sniper', 'swarmer'];
        for (let i = 0; i < budget; i++) {
          let type = 'swarmer';
          const r = Math.random();
          if (waveNum >= 4 && r < 0.16) type = 'weaver';
          else if (waveNum >= 3 && r < 0.34) type = 'pulsar';
          else if (waveNum >= 2 && r < 0.52) type = 'phalanx';
          else if (waveNum >= 1 && r < 0.72 && i % 3 === 0) type = 'sniper';

          let isElite = false;
          const remaining = budget - i;
          if (elitesAssigned < minElites && (remaining <= (minElites - elitesAssigned) || (i % Math.max(2, Math.floor(budget / minElites)) === 1))) {
            isElite = true;
            if (type === 'swarmer' && waveNum >= 4) {
              type = elitePool[elitesAssigned % elitePool.length];
            }
          } else if (Math.random() < eliteChance) {
            isElite = true;
          }
          if (isElite) elitesAssigned++;

          this.waveQueue.push({ type, scale: hpScale, wave: waveNum, isElite });
        }
      }
      this.waveSpawnTimer = 0.25;
      this.updateHUD();
    }

    spawnFromWaveQueue() {
      if (this.waveQueue.length === 0) return;
      const item = this.waveQueue.shift();

      // Open-World Vampire-Survivors style offscreen ring spawn around the player
      const halfDiag = Math.hypot(this.viewport.width, this.viewport.height) * 0.5;
      const baseRing = Math.max(360, halfDiag + 55);
      let x = this.player.x + baseRing;
      let y = this.player.y;
      const pad = 42;
      for (let attempt = 0; attempt < 10; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = baseRing + Math.random() * 140;
        const cx = Math.max(pad, Math.min(this.bounds.width - pad, this.player.x + Math.cos(ang) * dist));
        const cy = Math.max(pad, Math.min(this.bounds.height - pad, this.player.y + Math.sin(ang) * dist));
        x = cx;
        y = cy;
        if (Math.hypot(x - this.player.x, y - this.player.y) > Math.max(280, Math.min(this.viewport.width, this.viewport.height) * 0.45)) {
          break;
        }
      }

      const enemy = SG.createEnemy(item.type, x, y, item.scale, {
        wave: item.wave || this.wave,
        isElite: !!item.isElite
      });
      enemy.uid = Math.random().toString(36).slice(2);
      this.enemies.push(enemy);
      if (enemy.isElite) {
        this.particles.addShockwave(x, y, 64, '#ffd166', 0.4, 2.4);
      } else {
        this.particles.addShockwave(x, y, enemy.isBoss ? 110 : 42, enemy.color, 0.35, 2);
      }
    }

    spawnBossEscort(boss, phase) {
      if (this.enemies.length >= 22) return;
      const { hpScale } = this.computeWaveScaling(this.wave);
      const count = phase >= 3 ? 3 : 2;
      const pool = phase >= 3 ? ['weaver', 'phalanx', 'sniper'] : ['sniper', 'phalanx'];
      for (let i = 0; i < count; i++) {
        if (this.enemies.length >= 22) break;
        const ang = (i * Math.PI * 2) / count + Math.random() * 0.5;
        const sx = Math.max(40, Math.min(this.bounds.width - 40, boss.x + Math.cos(ang) * 110));
        const sy = Math.max(40, Math.min(this.bounds.height - 40, boss.y + Math.sin(ang) * 110));
        const escort = SG.createEnemy(pool[i % pool.length], sx, sy, hpScale, {
          wave: this.wave,
          isElite: this.wave >= 10 && i === 0
        });
        escort.uid = Math.random().toString(36).slice(2);
        this.enemies.push(escort);
        this.particles.addShockwave(sx, sy, escort.isElite ? 64 : 48, escort.isElite ? '#ffd166' : escort.color, 0.3, 2);
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

      if (this.player.mods.executeThreshold > 0 && !e.isBoss && e.hp > 0) {
        const effExec = e.isElite ? this.player.mods.executeThreshold * 0.5 : this.player.mods.executeThreshold;
        if ((e.hp / e.maxHp) <= effExec) {
          e.hp = 0;
          this.particles.addText(e.x, e.y - e.radius - 16, this.t('game.execute'), '#ff3b6b', 1.05);
        }
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
        const tierKeys = ['', 'game.combo2', 'game.comboSupernova', 'game.combo6', 'game.combo8'];
        this.particles.addText(this.player.x, this.player.y - 36, this.t(tierKeys[newTier]), '#ffd166', 1.24, 1.4);
        if (typeof this.audio.playComboMilestone === 'function') {
          this.audio.playComboMilestone(newTier);
        }
      }

      if (e.isBoss) {
        this.addHitstop(0.085);
      }
      const gainedScore = Math.round(e.score * this.combo * diffCfg.scoreMult * (1 + (this.player.mods.scoreMultBonus || 0)));
      this.score += gainedScore;
      if (this.gameMode === 'openworld') {
        if (!this.resources) this.resources = { matter: 0 };
        const matterDrop = e.isBoss ? 18 : (e.isElite ? 3 : 1);
        this.resources.matter = (this.resources.matter || 0) + matterDrop;
      }

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
        const entR = this.player.mods.entropyRadius * SG.getEffectiveAuraMult(this.player.mods.auraRadiusMult);
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
        const rMult = SG.getEffectiveAuraMult(p.mods.auraRadiusMult);
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
      const crystalCount = e.isBoss ? 16 : Math.min(6, Math.max(1, Math.round(e.xp / 24)));
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
      return Math.round(95 + level * 52 + Math.pow(level, 1.62) * 16);
    }

    checkLevelUp() {
      if (this.xp >= this.xpNext && this.state === 'playing') {
        if (SG.rollUpgradeChoices(this.upgradeStacks, 1, this.evolvedUpgrades).length === 0) {
          let loops = 0;
          while (this.xp >= this.xpNext && loops < 10) {
            this.xp -= this.xpNext;
            this.level++;
            this.xpNext = this.computeNextXp(this.level);
            this.player.mods.damageMult *= 1.06;
            this.player.maxHp = Math.round(this.player.maxHp * 1.04);
            this.player.maxShield = Math.round(this.player.maxShield * 1.04);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.2);
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxShield * 0.2);
            this.player.mods.scoreMultBonus += 0.05;
            loops++;
          }
          this.particles.addText(this.player.x, this.player.y - 30, this.t('game.overdriveToast'), '#ffd166', 1.18, 1.4);
          this.updateHUD();
          return;
        }
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = this.computeNextXp(this.level);
        this.openUpgradeModal();
      }
    }

    gainXP(amount) {
      const diffCfg = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.normal;
      const baseXpMult = 1 + (this.getBaseBonuses ? this.getBaseBonuses().xpMultBonus : 0);
      this.xp += amount * diffCfg.xpMult * (this.player.mods.xpMult || 1.0) * baseXpMult;
      this.checkLevelUp();
    }

    openUpgradeModal() {
      this.cancelUpgradeAnim();
      this.currentChoices = SG.rollUpgradeChoices(this.upgradeStacks, 4, this.evolvedUpgrades);
      if (this.currentChoices.length === 0) return;

      this.clearInputs();
      this._upgradeGuardUntil = this.isTouchDevice ? performance.now() + 380 : 0;
      this.state = 'upgrade';
      this.updateHUD();
      this.audio.playLevelUp();

      this.renderUpgradeChoices();

      const dlg = document.getElementById('upgrade-dialog');
      if (!dlg.open) dlg.showModal();
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
        statsBar.textContent = this.t('upg.statsBar', {
          dmg: dmgPct,
          rate: ratePct,
          crit: critPct,
          arm: armPct,
          shield: Math.ceil(p.maxShield),
          wells: m.maxWells,
          evos: evoCnt
        });
      }

      const container = document.getElementById('upgrade-cards');
      container.innerHTML = '';

      this.currentChoices = this.currentChoices.filter(
        u => SG.isUpgradeEligible(u, this.upgradeStacks, this.evolvedUpgrades)
      );

      const anim = this.shouldAnimateUpgradeUI();

      this.currentChoices.forEach((upg, idx) => {
        const curStack = this.upgradeStacks[upg.id] || 0;
        const willEvolve = !!(upg.evolution && (curStack + 1) === upg.maxStacks);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `upgrade-card rarity-${upg.rarity}${this.getTagClass(upg)}${willEvolve ? ' is-evolution' : ''}${anim ? ' anim-enter' : ''}`;
        btn.style.setProperty('--card-idx', String(idx));
        const evoHtml = upg.evolution
          ? (willEvolve
            ? `<div class="upg-evo-box">${this.t('upg.evoBox', { title: upg.evolution.title, perk: upg.evolution.perk })}</div>`
            : `<div class="upg-evo-hint">${this.t('upg.evoHint', { title: upg.evolution.title })}</div>`)
          : '';
        const levelText = curStack === 0
          ? this.t('upg.lvlNew', { max: upg.maxStacks })
          : (willEvolve
            ? this.t('upg.lvlEvo', { cur: curStack, next: curStack + 1, max: upg.maxStacks })
            : this.t('upg.lvlUp', { cur: curStack, next: curStack + 1, max: upg.maxStacks }));
        const dispTag = SG.I18n ? SG.I18n.translateTag(upg.tag) : upg.tag;
        btn.innerHTML = `
          <div class="upg-top">
            <span class="upg-tag">${willEvolve ? this.t('upg.evoTag', { title: upg.evolution.title }) : dispTag}</span>
            <span class="upg-key">[${idx + 1}]</span>
          </div>
          <div class="upg-icon">${upg.icon}</div>
          <h3 class="upg-title">${upg.title}</h3>
          <p class="upg-desc">${upg.desc}</p>
          ${evoHtml}
          <div class="upg-stacks">${levelText}</div>
        `;
        btn.addEventListener('click', () => {
          if (this._upgradeSelecting || performance.now() < this._upgradeGuardUntil) return;
          this.selectUpgrade(upg);
        });
        container.appendChild(btn);
      });

      const rerollBtn = document.getElementById('btn-upgrade-reroll');
      if (rerollBtn) {
        const eligibleCount = SG.countEligibleUpgrades(this.upgradeStacks, this.evolvedUpgrades);
        rerollBtn.textContent = this.t('upg.reroll', { n: this.rerolls });
        rerollBtn.disabled = this.rerolls <= 0 || eligibleCount <= this.currentChoices.length;
      }
    }

    rerollUpgrades() {
      if (this.state !== 'upgrade' || this._upgradeSelecting || this.rerolls <= 0) return;
      if (SG.countEligibleUpgrades(this.upgradeStacks, this.evolvedUpgrades) <= this.currentChoices.length) return;
      this.rerolls--;
      const prevIds = new Set(this.currentChoices.map(u => u.id));
      let next = SG.rollUpgradeChoices(this.upgradeStacks, 4, this.evolvedUpgrades);
      // Avoid identical set when other eligible upgrades exist
      if (next.length > 0 && next.every(u => prevIds.has(u.id))) {
        const alt = SG.rollUpgradeChoices(this.upgradeStacks, 4, this.evolvedUpgrades);
        if (alt.length > 0) next = alt;
      }
      this.audio.playDeflect();
      if (this.shouldAnimateUpgradeUI()) {
        this._upgradeSelecting = true;
        const cards = document.querySelectorAll('#upgrade-cards .upgrade-card');
        cards.forEach(c => {
          c.disabled = true;
          c.classList.remove('anim-enter');
          c.classList.add('is-rerolling');
        });
        const rerollBtn = document.getElementById('btn-upgrade-reroll');
        if (rerollBtn) rerollBtn.disabled = true;
        clearTimeout(this._upgradeAnimTimer);
        this._upgradeAnimTimer = setTimeout(() => {
          this._upgradeAnimTimer = null;
          this._upgradeSelecting = false;
          if (this.state !== 'upgrade') return;
          this.currentChoices = next;
          this.renderUpgradeChoices();
        }, 130);
      } else {
        this.currentChoices = next;
        this.renderUpgradeChoices();
      }
    }

    selectUpgrade(upg) {
      if (this.state !== 'upgrade' || this._upgradeSelecting || !upg) return;
      const chosenIdx = this.currentChoices.indexOf(upg);
      if (chosenIdx === -1) return;
      const prevStack = this.upgradeStacks[upg.id] || 0;
      if (!SG.isUpgradeEligible(upg, this.upgradeStacks, this.evolvedUpgrades)) return;

      this._upgradeSelecting = true;

      const cards = document.querySelectorAll('#upgrade-cards .upgrade-card');
      cards.forEach(c => { c.disabled = true; });
      const rerollBtn = document.getElementById('btn-upgrade-reroll');
      if (rerollBtn) rerollBtn.disabled = true;

      const willEvolve = !!(upg.evolution && (prevStack + 1) === upg.maxStacks);

      const commitSelection = () => {
        this._upgradeSelecting = false;
        this._upgradeAnimTimer = null;
        this._upgradeCloseTimer = null;
        this.currentChoices = [];

        this.upgradeStacks[upg.id] = Math.min(upg.maxStacks, prevStack + 1);
        upg.apply(this.player.mods, this.player, this);

        let evolvedNow = false;
        if (this.upgradeStacks[upg.id] === upg.maxStacks && upg.evolution && !this.evolvedUpgrades.has(upg.id)) {
          this.evolvedUpgrades.add(upg.id);
          upg.evolution.apply(this.player.mods, this.player, this);
          evolvedNow = true;
        }

        const dlg = document.getElementById('upgrade-dialog');
        if (dlg) {
          dlg.classList.remove('is-closing');
          if (dlg.open) dlg.close();
        }

        this._buildDirty = true;
        this.state = 'playing';

        const rarityColor = (upg.rarity === 'legendary') ? '#ffb838' : (upg.rarity === 'epic' ? '#c06cff' : '#00f0ff');
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
          this.particles.addShockwave(this.player.x, this.player.y, 175, rarityColor, 0.45, 3.0);
          this.particles.burst(this.player.x, this.player.y, 18, rarityColor, 70, 220, 0.45, true);
          this.particles.addText(this.player.x, this.player.y - 28, `${upg.title.toUpperCase()}`, rarityColor === '#00f0ff' ? '#7df9ff' : rarityColor, 1.18);
        }
        this.updateHUD();
        this.saveProgress('upgrade');
        this.checkLevelUp();
      };

      if (this.shouldAnimateUpgradeUI() && cards.length > 0 && cards[chosenIdx]) {
        cards.forEach((c, idx) => {
          c.classList.remove('anim-enter');
          if (idx === chosenIdx) {
            c.classList.add('is-chosen');
            if (willEvolve) c.classList.add('is-chosen-evo');
          } else {
            c.classList.add('is-dismissed');
          }
        });
        this.audio.playDeflect();
        const animMs = willEvolve ? 430 : 320;
        const dlg = document.getElementById('upgrade-dialog');
        this._upgradeCloseTimer = setTimeout(() => {
          this._upgradeCloseTimer = null;
          if (dlg && dlg.open) dlg.classList.add('is-closing');
        }, Math.max(0, animMs - 140));
        this._upgradeAnimTimer = setTimeout(commitSelection, animMs);
      } else {
        commitSelection();
      }
    }

    triggerGameOver() {
      this.clearInputs();
      const isEndless = this.gameMode === 'endless';
      if (!isEndless) {
        this.clearRunSave();
      }
      this.state = 'gameover';
      this.updateHUD();

      let isNewRecord = false;
      if (isEndless) {
        const prevScore = this.bestEndlessScore || 0;
        const prevWave = this.bestEndlessWave || 0;
        isNewRecord = (this.score > prevScore && this.score > 0) || (this.wave > prevWave);
        if (this.score > this.bestEndlessScore) this.bestEndlessScore = this.score;
        if (this.wave > this.bestEndlessWave) this.bestEndlessWave = this.wave;
      } else {
        isNewRecord = this.score > this.bestScore && this.score > 0;
        if (this.score > this.bestScore) this.bestScore = this.score;
        if (this.wave > this.bestWave) this.bestWave = this.wave;
      }

      if (SG.Save) {
        SG.Save.saveMeta({
          bestScore: this.bestScore,
          bestWave: this.bestWave,
          bestEndlessScore: this.bestEndlessScore || 0,
          bestEndlessWave: this.bestEndlessWave || 0,
          totalKills: this.totalKills,
          totalAnomaliesCleared: this.totalAnomaliesCleared || 0
        });
      } else {
        localStorage.setItem('singularis_best_score', String(this.bestScore));
        localStorage.setItem('singularis_best_wave', String(this.bestWave));
      }

      const recBadge = document.getElementById('go-record-badge');
      if (recBadge) recBadge.hidden = !isNewRecord;

      const goHeading = document.getElementById('go-heading');
      if (goHeading) {
        goHeading.textContent = isEndless ? this.t('go.headingEndless') : this.t('go.heading');
      }

      const loc = this.locale();
      document.getElementById('go-score').textContent = this.score.toLocaleString(loc);
      document.getElementById('go-best').textContent = (isEndless ? this.bestEndlessScore : this.bestScore).toLocaleString(loc);
      document.getElementById('go-wave').textContent = isEndless
        ? `∞ ${this.t('hud.waveDefault', { wave: this.wave.toLocaleString(loc) })}`
        : `${this.stats.anomaliesCleared || 0} / В.${this.wave}`;
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
          sp.textContent = this.t('go.baseBuild');
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
      if (this.state === 'playing') {
        this._autoSaveTimer = (this._autoSaveTimer || 0) + dt;
        if (this._autoSaveTimer >= 12) {
          this.saveProgress('periodic');
        }
      }

      // Ambient background warp when paused / in menu / modal open
      if (this.state !== 'playing' || this.hasAnyModalOpen()) {
        const nowSec = performance.now() * 0.001;
        if (this.state === 'title' && this.base) {
          const focusX = this.viewport.width >= 960 ? 0.64 : 0.5;
          const focusY = this.viewport.width >= 960 ? 0.47 : 0.42;
          this.camera.x = Math.max(0, Math.min(this.bounds.width - this.viewport.width, this.base.x - this.viewport.width * focusX));
          this.camera.y = Math.max(0, Math.min(this.bounds.height - this.viewport.height, this.base.y - this.viewport.height * focusY));
          this.grid.setViewOrigin(this.camera.x, this.camera.y);

          const orbAng = nowSec * 0.48;
          if (this.player) {
            const orbitR = 148;
            this.player.x = this.base.x + Math.cos(orbAng) * orbitR;
            this.player.y = this.base.y + Math.sin(orbAng) * orbitR;
            this.player.aimAngle = orbAng + Math.PI * 0.5;
            this.player.vx = Math.cos(this.player.aimAngle) * 140;
            this.player.vy = Math.sin(this.player.aimAngle) * 140;
            if (Math.random() < 0.35) {
              this.particles.spawn(
                this.player.x - Math.cos(this.player.aimAngle) * 14,
                this.player.y - Math.sin(this.player.aimAngle) * 14,
                -Math.cos(this.player.aimAngle) * 90,
                -Math.sin(this.player.aimAngle) * 90,
                { size: 2.0, life: 0.28, color: '#00f0ff', streak: false, gravScale: 0.15 }
              );
            }
          }

          if (this.wells.length === 0 && typeof SG.GravityWell === 'function') {
            const demoWell = new SG.GravityWell(this.base.x - 255, this.base.y, false, {});
            demoWell._titleAmbient = true;
            this.wells.push(demoWell);
          }
          if (this.wells[0] && this.wells[0]._titleAmbient) {
            const w = this.wells[0];
            const wAng = orbAng + Math.PI;
            w.x = this.base.x + Math.cos(wAng) * 255;
            w.y = this.base.y + Math.sin(wAng) * 255;
            w.life = w.maxLife * 0.75;
            w.update(dt, this.grid, this.particles);
          }
        }
        const t = nowSec * 1.5;
        this.grid.applyRadialForce(
          this.camera.x + this.viewport.width * 0.5 + Math.cos(t) * 180,
          this.camera.y + this.viewport.height * 0.5 + Math.sin(t * 1.3) * 110,
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

      if (!this.isTouchDevice) {
        this.mouse.x = this.mouseScreen.x + this.camera.x;
        this.mouse.y = this.mouseScreen.y + this.camera.y;
      }

      // Gather Player Input
      if (this.touchInput.bulletTime && this.player.chrono <= 1) {
        this.touchInput.bulletTime = false;
      }
      const kbMoveX = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
      const kbMoveY = (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) - (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0);
      const moveX = Math.abs(this.touchInput.moveX) > 0.05 ? this.touchInput.moveX : kbMoveX;
      const moveY = Math.abs(this.touchInput.moveY) > 0.05 ? this.touchInput.moveY : kbMoveY;
      let aimX = this.mouse.x;
      let aimY = this.mouse.y;
      let firing = this.mouse.leftDown || this.keys['KeyF'] || this.touchInput.firing;
      if (this.isTouchDevice) {
        let ang = this.player.aimAngle;
        if (this.touchInput.aimHasDir) {
          ang = Math.atan2(this.touchInput.aimDirY, this.touchInput.aimDirX);
        } else if (Math.hypot(moveX, moveY) > 0.08) {
          ang = Math.atan2(moveY, moveX);
        }
        aimX = this.player.x + Math.cos(ang) * 235;
        aimY = this.player.y + Math.sin(ang) * 235;
        this.mouse.x = aimX;
        this.mouse.y = aimY;
        if (this.settings.touchAutofire && this.enemies.length > 0) {
          firing = true;
        }
      }
      const input = {
        moveX,
        moveY,
        aimX,
        aimY,
        firing,
        bulletTime: !!this.keys['Space'] || this.touchInput.bulletTime,
        speedMult: this.zone === 'overworld' ? 2.15 : 1.0
      };

      // Player updates in personal proper-time (stays fast during Bullet-Time!)
      this.player.update(dt, input, this.bounds, this.particles);

      // Smooth Open-World Camera follow & SpacetimeGrid scroll anchor
      const maxCX = Math.max(0, this.bounds.width - this.viewport.width);
      const maxCY = Math.max(0, this.bounds.height - this.viewport.height);
      const targetCX = Math.max(0, Math.min(maxCX, this.player.x - this.viewport.width * 0.5));
      const targetCY = Math.max(0, Math.min(maxCY, this.player.y - this.viewport.height * 0.5));
      const camLerp = Math.min(1, dt * 10);
      this.camera.x += (targetCX - this.camera.x) * camLerp;
      this.camera.y += (targetCY - this.camera.y) * camLerp;
      this.grid.setViewOrigin(this.camera.x, this.camera.y);

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

      if (this.waveBannerTimer > 0) this.waveBannerTimer -= dt;
      this.updateAnomalyRespawns(dt);

      // Autonomous Base Structures: passive XP & Matter farming in Open World
      if (this.gameMode === 'openworld' && this.buildings && this.buildings.length > 0) {
        const bonuses = this.getBaseBonuses();
        if (bonuses.matterPerSec > 0) {
          if (!this.resources) this.resources = { matter: 0 };
          this._baseMatterAcc = (this._baseMatterAcc || 0) + bonuses.matterPerSec * dt;
          if (this._baseMatterAcc >= 1) {
            const whole = Math.floor(this._baseMatterAcc);
            this._baseMatterAcc -= whole;
            this.resources.matter = (this.resources.matter || 0) + whole;
          }
        }
        if (bonuses.xpPerSec > 0) {
          this._baseXpAcc = (this._baseXpAcc || 0) + bonuses.xpPerSec * dt;
          if (this._baseXpAcc >= 1) {
            const wholeXp = Math.floor(this._baseXpAcc);
            this._baseXpAcc -= wholeXp;
            this.gainXP(wholeXp);
          }
        }
        this._basePulseTimer = (this._basePulseTimer || 0) + dt;
        if (this._basePulseTimer >= 2.6) {
          this._basePulseTimer = 0;
          if (this.zone === 'overworld' && this.player) {
            for (let i = 0; i < this.buildings.length; i++) {
              const b = this.buildings[i];
              if (Math.hypot(b.x - this.player.x, b.y - this.player.y) > 950) continue;
              const def = BUILDING_DEFS.find(d => d.id === b.type);
              if (!def) continue;
              if (b.type === 'xp_extractor') {
                const tickXp = Math.round(def.rates[(b.level || 1) - 1] * 2.6);
                this.particles.addText(b.x, b.y - 44, `+${tickXp} XP`, '#22ffa6', 0.9, 1.1);
              } else if (b.type === 'matter_synth') {
                const tickM = (def.rates[(b.level || 1) - 1] * 2.6).toFixed(1);
                this.particles.addText(b.x, b.y - 44, `+${tickM} ⚡`, '#ffd166', 0.9, 1.1);
              }
            }
          }
        }
      }

      if (this.zone === 'overworld') {
        // Peaceful Overworld: Base repair dock & Anomaly Dungeon entry portals
        const distBase = Math.hypot(this.player.x - this.base.x, this.player.y - this.base.y);
        const wasInBase = this.inBaseZone;
        this.inBaseZone = distBase <= this.base.repairRadius;
        if (this.inBaseZone) {
          const regMult = this.getBaseBonuses ? this.getBaseBonuses().baseRegenMult : 1;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 38 * regMult * dt);
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 65 * regMult * dt);
          this.player.chrono = Math.min(this.player.maxChrono, this.player.chrono + 55 * regMult * dt);
          this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt * 1.5);
          this.player.rewindCooldown = Math.max(0, this.player.rewindCooldown - dt * 2.0);
          this.player.detonateCooldown = Math.max(0, this.player.detonateCooldown - dt * 2.0);
        }
        if (this.inBaseZone !== wasInBase) {
          this.updateHUD();
        }

        if (this.waypoint && Math.hypot(this.player.x - this.waypoint.x, this.player.y - this.waypoint.y) < 140) {
          this.waypoint = null;
          this.particles.addText(this.player.x, this.player.y - 32, this.t('game.wpReached'), '#ffd166', 1.1, 1.5);
        }

        for (let i = 0; i < this.anomalies.length; i++) {
          const a = this.anomalies[i];
          if (a.cleared) continue;
          const distA = Math.hypot(this.player.x - a.x, this.player.y - a.y);
          if (distA < 700) {
            this.grid.applyRadialForce(a.x, a.y, -110 * dt, a.radius * 2.3, 180);
          }
          if (distA <= a.radius + 14) {
            a.enterProgress = Math.min(1, a.enterProgress + dt / 1.1);
            if (a.enterProgress >= 1) {
              this.enterAnomaly(a);
              return;
            }
          } else {
            a.enterProgress = Math.max(0, a.enterProgress - dt * 1.8);
          }
        }
      } else if (this.zone === 'endless') {
        // Endless Mode Non-Stop Arena Brawl (infinite waves)
        if (this.waveQueue.length > 0) {
          this.waveSpawnTimer -= worldDt;
          const maxActive = Math.min(72, 22 + Math.floor(this.wave * 2.5));
          if (this.waveSpawnTimer <= 0 && this.enemies.length < maxActive) {
            const batch = this.wave >= 25 ? 5 : (this.wave >= 12 ? 4 : (this.wave >= 5 ? 3 : 2));
            for (let bi = 0; bi < batch && this.waveQueue.length > 0 && this.enemies.length < maxActive; bi++) {
              this.spawnFromWaveQueue();
            }
            this.waveSpawnTimer = Math.max(0.14, 0.48 - Math.min(0.34, this.wave * 0.014));
          }
        } else if (this.enemies.length === 0) {
          if (this.wave % 5 === 0) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.20);
            this.player.shield = this.player.maxShield;
            this.rerolls++;
            this.particles.addText(this.player.x, this.player.y - 34, this.t('game.bossClearedToast'), '#ffd166', 1.18, 1.8);
          } else {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.08);
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxShield * 0.25);
          }
          this.startWave(this.wave + 1);
          if (this.wave > this.bestEndlessWave) {
            this.saveProgress('endless_wave');
          }
        }
      } else {
        // Anomaly Dungeon Combat Loop
        if (!this.anomalyCleared) {
          if (this.waveQueue.length > 0) {
            this.waveSpawnTimer -= worldDt;
            const maxActive = Math.min(48, 18 + this.wave * 2);
            if (this.waveSpawnTimer <= 0 && this.enemies.length < maxActive) {
              const batch = this.wave >= 16 ? 3 : (this.wave >= 8 ? 2 : 1);
              for (let bi = 0; bi < batch && this.waveQueue.length > 0 && this.enemies.length < maxActive; bi++) {
                this.spawnFromWaveQueue();
              }
              this.waveSpawnTimer = Math.max(0.24, 0.68 - this.wave * 0.022);
            }
          } else if (this.enemies.length === 0) {
            if (this.dungeonWaveIndex >= this.dungeonWavesTotal) {
              this.completeAnomaly();
            } else {
              this.dungeonWaveIndex++;
              this.startWave(this.wave + 1);
            }
          }
        } else if (this.exitPortal) {
          const ep = this.exitPortal;
          ep.graceTimer = Math.max(0, ep.graceTimer - dt);
          this.grid.applyRadialForce(ep.x, ep.y, -90 * dt, ep.radius * 2.0, 140);
          const distEp = Math.hypot(this.player.x - ep.x, this.player.y - ep.y);
          if (ep.graceTimer <= 0 && distEp <= ep.radius + 14) {
            ep.progress = Math.min(1, ep.progress + dt / 0.95);
            if (ep.progress >= 1) {
              this.exitAnomalyToOverworld(false);
              return;
            }
          } else {
            ep.progress = Math.max(0, ep.progress - dt * 1.8);
          }
        }
      }

      // Update Player Combat Auras (Solar Corona, Cryo-Stasis, Entropy Siphon, Storm Coil, Grav-Repulse)
      this.updatePlayerAuras(dt, worldDt);

      // Update Enemies + Open-World Straggler Re-Warp
      const maxEnemyDist = Math.max(1450, Math.hypot(this.viewport.width, this.viewport.height) * 0.95);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.dead) continue;
        SG.updateEnemy(e, worldDt, this);
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
        const distP = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        const warpThresh = e.isBoss ? maxEnemyDist + 250 : maxEnemyDist;
        if (distP > warpThresh) {
          const ringR = Math.max(this.viewport.width, this.viewport.height) * 0.56 + 90;
          const moveAng = Math.hypot(this.player.vx, this.player.vy) > 40
            ? Math.atan2(this.player.vy, this.player.vx) + (Math.random() - 0.5) * 1.4
            : Math.random() * Math.PI * 2;
          e.x = Math.max(48, Math.min(this.bounds.width - 48, this.player.x + Math.cos(moveAng) * ringR));
          e.y = Math.max(48, Math.min(this.bounds.height - 48, this.player.y + Math.sin(moveAng) * ringR));
          e.vx *= 0.25;
          e.vy *= 0.25;
          if (e.isBoss) {
            this.particles.addShockwave(e.x, e.y, 90, e.color, 0.35, 2.4);
          }
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
          const baseContact = Math.round(18 * this.getEnemyDamageScale() * (e1.isBoss ? 1.45 : (e1.isElite ? 1.35 : 1.0)));
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
          const maxBulletDist = Math.max(this.viewport.width, this.viewport.height) * 1.2 + 220;
          if (b.life <= 0 || Math.hypot(b.x - this.player.x, b.y - this.player.y) > maxBulletDist) {
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
            const rMult = SG.getEffectiveAuraMult(this.player.mods.auraRadiusMult);

            if (this.player.mods.antimatterLevel > 0 && this.player.antimatterTimer <= 0 && !b.isLance && b.damage <= Math.round(22 * this.getEnemyDamageScale()) && rd < this.player.mods.antimatterRadius * rMult) {
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
        if (this.zone === 'anomaly' && this.gameMode === 'openworld') {
          this.ejectFromAnomalyOnDeath();
          return;
        }
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
      const rMult = SG.getEffectiveAuraMult(m.auraRadiusMult);
      const fortressBoost = (m.fortressLevel > 0 && p.hp / p.maxHp >= 0.7) ? (1 + 0.45 * m.fortressLevel) : 1.0;
      const rawAuraPower = (m.auraDpsMult || 1.0) * fortressBoost;
      const auraPower = SG.getEffectiveAuraPower(rawAuraPower);
      const auraMultFor = (e) => Math.max(0.25, 1 - (e.auraResist || 0));

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
              this.damageEnemy(re, Math.round(meltDmg * auraMultFor(re)), '#a3e635', 'РАСПАД!');
            }
          }
          if (e.dead) continue;
        }
        if (e.radStacks > 0) {
          e.hp -= e.radStacks * 14 * auraPower * auraMultFor(e) * worldDt;
          if (e.hp <= 0) {
            this.killEnemy(e);
            continue;
          }
        }

        if (m.coronaRadius > 0 && d <= coronaR + e.radius) {
          const thermalMult = (e.cryoTimer > 0 && m.thermalShock > 0) ? (1 + 1.2 * m.thermalShock) : 1.0;
          const burnDmg = m.coronaDps * auraPower * thermalMult * auraMultFor(e) * worldDt;
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
          const drain = m.entropyDps * auraPower * auraMultFor(e) * worldDt;
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
        const cNovaDmg = 60 * auraPower;
        this.particles.addShockwave(p.x, p.y, cNovaR, '#ff8538', 0.42, 3.0);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= cNovaR + e.radius) {
            const eResist = auraMultFor(e);
            e.burnTimer = Math.max(e.burnTimer || 0, 3.5);
            e.burnDps = Math.max(e.burnDps || 0, Math.round(24 * auraPower * eResist));
            this.damageEnemy(e, Math.round(cNovaDmg * eResist), '#ff8538');
          }
        }
      }

      p.inSanctuary = !anyNearSanctuary;
      const beamLimit = m.evoBeamPrism > 0 ? 3 : 1;
      beamCandidates.sort((a, b) => a.dist - b.dist);
      p.beamTargets = beamCandidates.slice(0, beamLimit).map(c => c.enemy);
      p.beamTarget = p.beamTargets[0] || null;
      if (m.beamLevel > 0 && p.beamTargets.length > 0) {
        const beamBase = 48 * m.beamLevel * Math.sqrt(Math.max(1, m.damageMult)) * auraPower * worldDt;
        for (let bi = 0; bi < p.beamTargets.length; bi++) {
          const bt = p.beamTargets[bi];
          if (!bt || bt.dead) continue;
          bt.hp -= beamBase * auraMultFor(bt);
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
          const zapBase = 32 * m.stormLevel * Math.sqrt(Math.max(1, m.damageMult)) * auraPower;
          for (let k = 0; k < maxHits; k++) {
            const target = inRange[k];
            const zapDmg = Math.round(zapBase * auraMultFor(target));
            const echoMult = (m.resonanceEcho > 0 && Math.random() < 0.4) ? (1 + m.resonanceEcho) : 1;
            this.particles.addLightning(p.x, p.y, target.x, target.y, '#7df9ff', 0.22);
            if (m.evoStormChain > 0 && !target.dead) {
              target.stunTimer = Math.max(target.stunTimer, 0.4);
            }
            this.damageEnemy(target, Math.round(zapDmg * echoMult), '#7df9ff');
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
            const push = (e.isBoss ? 140 : (e.isElite ? 260 : 420)) + m.repulseAura * 95;
            e.vx += (dx / d) * push;
            e.vy += (dy / d) * push;
            this.damageEnemy(e, Math.round(14 * m.repulseAura * auraPower * auraMultFor(e)), '#d98aff');
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
        const novaBase = 52 * m.novaLevel * auraPower;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (e.dead) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= novaR + e.radius) {
            const push = e.isBoss ? 120 : (e.isElite ? 220 : 340);
            e.vx += (dx / d) * push;
            e.vy += (dy / d) * push;
            this.damageEnemy(e, Math.round(novaBase * auraMultFor(e)), '#ff9e2c');
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
        const fBase = 38 * m.solarFlareLevel * auraPower;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= flareR + e.radius) {
            const eResist = auraMultFor(e);
            e.burnTimer = Math.max(e.burnTimer || 0, 3.0);
            e.burnDps = Math.max(e.burnDps || 0, Math.round(18 * m.solarFlareLevel * auraPower * eResist));
            this.damageEnemy(e, Math.round(fBase * eResist), '#ff8538');
          }
        }
      }

      // 4d. Crimson Leech Nova: bursts every 30 HP healed
      if (m.leechNova > 0 && p.healBuffer >= 30) {
        while (p.healBuffer >= 30) {
          p.healBuffer -= 30;
          const leechBase = 55 * m.leechNova * Math.sqrt(Math.max(1, m.damageMult)) * auraPower;
          this.particles.addShockwave(p.x, p.y, 180, '#ff3b6b', 0.36, 2.8);
          for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= 180 + e.radius) {
              this.damageEnemy(e, Math.round(leechBase * auraMultFor(e)), '#ff3b6b');
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
      if (els.versionBadge) {
        els.versionBadge.hidden = (this.state === 'title');
        els.versionBadge.classList.toggle('in-game', this.state === 'playing');
      }
      const touchEl = (this.touchEls && this.touchEls.root) || document.getElementById('touch-controls');
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

      const loc = this.locale();
      if (els.score) els.score.textContent = this.score.toLocaleString(loc);
      if (els.matter) {
        els.matter.hidden = (this.gameMode !== 'openworld');
        if (this.gameMode === 'openworld') {
          const m = Math.floor((this.resources && this.resources.matter) || 0);
          els.matter.textContent = `⚡ ${m}`;
        }
      }
      if (els.combo) els.combo.textContent = `×${this.combo.toFixed(1)}`;
      if (els.wave) {
        if (this.zone === 'overworld') {
          els.wave.textContent = this.inBaseZone
            ? this.t('hud.waveBase')
            : this.t('hud.waveWorld', { n: this.stats ? (this.stats.anomaliesCleared || 0) : 0 });
        } else if (this.zone === 'endless') {
          els.wave.textContent = this.t('hud.waveEndless', {
            wave: this.wave.toLocaleString(loc),
            enemies: this.enemies.length + this.waveQueue.length
          });
        } else if (this.anomalyCleared) {
          els.wave.textContent = this.t('hud.waveAnomalyCleared');
        } else {
          const tier = this.activeAnomaly ? this.activeAnomaly.tier : 1;
          els.wave.textContent = this.t('hud.waveAnomaly', { tier, cur: this.dungeonWaveIndex, total: this.dungeonWavesTotal });
        }
      }
      if (els.level) els.level.textContent = this.t('hud.level', { n: this.level });

      if (els.dash) {
        els.dash.textContent = p.dashCooldown > 0
          ? this.t('hud.dashCd', { s: p.dashCooldown.toFixed(1) })
          : this.t('hud.dashReady');
        els.dash.classList.toggle('ready', p.dashCooldown <= 0);
      }

      if (els.rewind) {
        els.rewind.textContent = p.rewindCooldown > 0
          ? this.t('hud.rewindCd', { s: p.rewindCooldown.toFixed(1) })
          : this.t('hud.rewindReady');
        els.rewind.classList.toggle('ready', p.rewindCooldown <= 0);
      }

      if (els.detonate) {
        els.detonate.textContent = p.detonateCooldown > 0
          ? this.t('hud.detonateCd', { s: p.detonateCooldown.toFixed(1) })
          : this.t('hud.detonateReady');
        els.detonate.classList.toggle('ready', p.detonateCooldown <= 0);
      }

      if (els.wellCd) {
        els.wellCd.textContent = p.wellCooldown > 0
          ? this.t('hud.wellCd', { s: p.wellCooldown.toFixed(1) })
          : this.t('hud.wellReady');
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

      if (els.menuBtn) {
        els.menuBtn.innerHTML = this.isTouchDevice ? this.t('hud.menuTouch') : this.t('hud.menu');
      }

      if (els.returnBtn) {
        const showReturn = (this.zone === 'overworld' && !this.inBaseZone) || (this.zone === 'anomaly' && this.anomalyCleared);
        els.returnBtn.hidden = !showReturn;
        if (showReturn) {
          els.returnBtn.innerHTML = this.zone === 'anomaly'
            ? (this.isTouchDevice ? this.t('hud.exitAnomalyTouch') : this.t('hud.exitAnomaly'))
            : (this.isTouchDevice ? this.t('hud.returnTouch') : this.t('hud.return'));
        }
      }

      if (els.mapBtn) {
        els.mapBtn.hidden = (this.zone !== 'overworld');
        if (this.zone === 'overworld') {
          els.mapBtn.innerHTML = this.isTouchDevice ? this.t('hud.mapTouch') : this.t('hud.map');
        }
      }

      if (els.buildBtn) {
        els.buildBtn.hidden = (this.zone !== 'overworld');
      }

      if (els.muteBtn) {
        if (this.isTouchDevice) {
          els.muteBtn.textContent = this.audio.muted ? '🔇' : '🔊';
        } else {
          els.muteBtn.textContent = this.audio.muted ? this.t('hud.muteOff') : this.t('hud.muteOn');
        }
      }

      if (els.polBtn) {
        els.polBtn.innerHTML = this.repulsorMode ? this.t('hud.whiteHole') : this.t('hud.blackHole');
        els.polBtn.classList.toggle('repulsor', this.repulsorMode);
      }

      // Live touch button cooldowns, timers, polarity & chrono state
      const te = this.touchEls;
      if (this.isTouchDevice && te) {
        const updateCdBtn = (ref, cd, maxCd) => {
          if (!ref || !ref.el) return;
          const onCd = cd > 0.05;
          ref.el.classList.toggle('on-cd', onCd);
          const pct = onCd ? Math.max(0, Math.min(1, cd / Math.max(0.1, maxCd))) : 0;
          if (ref.cd) ref.cd.style.setProperty('--cd-pct', pct.toFixed(2));
          if (ref.timer) ref.timer.textContent = onCd ? `${cd.toFixed(1)}` : '';
        };

        const dashMax = 2.8 / Math.max(0.7, p.mods.moveSpeedMult);
        const wellMax = 1.6 * p.mods.wellCdMult;
        const detMax = 5.5 * p.mods.detonateCdMult;
        const rewMax = 9.0 * p.mods.rewindCdMult;

        updateCdBtn(te.dash, p.dashCooldown, dashMax);
        updateCdBtn(te.well, p.wellCooldown, wellMax);
        updateCdBtn(te.detonate, p.detonateCooldown, detMax);
        updateCdBtn(te.rewind, p.rewindCooldown, rewMax);

        if (te.well && te.well.el) {
          te.well.el.classList.toggle('repulsor', this.repulsorMode);
          if (te.well.label) te.well.label.textContent = this.repulsorMode ? this.t('touch.wellWhite') : this.t('touch.wellBlack');
        }
        if (te.polarity && te.polarity.el) {
          te.polarity.el.classList.toggle('repulsor', this.repulsorMode);
          if (te.polarity.label) te.polarity.label.textContent = this.repulsorMode ? this.t('touch.polWhite') : this.t('touch.polBlack');
        }
        if (te.detonate && te.detonate.el) {
          const hasWells = this.wells.length > 0;
          te.detonate.el.classList.toggle('ready-glow', hasWells && p.detonateCooldown <= 0.05);
          te.detonate.el.classList.toggle('disabled-dim', !hasWells);
        }
        if (te.bt && te.bt.el) {
          te.bt.el.classList.toggle('active-toggle', !!p.bulletTimeActive);
          const depleted = Math.max(0, Math.min(1, 1 - p.chrono / Math.max(1, p.maxChrono)));
          if (te.bt.cd) te.bt.cd.style.setProperty('--cd-pct', depleted.toFixed(2));
        }
      }
    }

    render() {
      const ctx = this.ctx;
      const w = this.viewport.width;
      const h = this.viewport.height;
      const camX = this.camera.x;
      const camY = this.camera.y;
      const useSprites = !!(this.settings.useTextures && SG.Sprites && SG.Sprites.ready);
      const preset = this.getPreset();
      let useGpu = !!(this.gpu && this.gpu.isActive());
      const nowSec = performance.now() * 0.001;

      let shakeX = 0;
      let shakeY = 0;
      if (this.screenShake > 0.2) {
        shakeX = (Math.random() - 0.5) * this.screenShake * 1.6;
        shakeY = (Math.random() - 0.5) * this.screenShake * 1.6;
      }

      if (useGpu) {
        try {
          this.gpu.renderFrame({
            width: w,
            height: h,
            dpr: this.dpr,
            timeSec: nowSec,
            timeScale: this.timeScale,
            shakeX,
            shakeY,
            camX,
            camY,
            skipEntityPolys: useSprites,
            useTextures: useSprites,
            stars: this.stars,
            grid: this.grid,
            particles: this.particles,
            wells: this.wells,
            bullets: this.bullets,
            enemies: this.enemies,
            pickups: this.pickups,
            player: this.player,
            state: this.state,
            quality: this.settings.quality,
            preset,
            isTouchDevice: this.isTouchDevice
          });
        } catch (err) {
          console.error('[SINGULARIS] GPU render error, falling back to 2D:', err);
          this.gpu.setEnabled(false);
          useGpu = false;
        }
      }

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      if (useGpu) {
        ctx.clearRect(0, 0, w, h);
      } else {
        // 2D Fallback Background (screen-aligned before world camera transform)
        if (useSprites) {
          ctx.fillStyle = this.timeScale < 0.65 ? '#070614' : '#080c15';
        } else if (this.settings.quality === 'low') {
          ctx.fillStyle = this.timeScale < 0.65 ? '#070515' : '#040814';
        } else {
          ctx.fillStyle = (this.timeScale < 0.65 ? this.bgGradSlow : this.bgGradNormal) || '#040814';
        }
        ctx.fillRect(0, 0, w, h);
      }

      // Enter World Space (camera-scrolled + screen shake)
      ctx.translate(shakeX - camX, shakeY - camY);

      if (useGpu) {
        if (useSprites && SG.Sprites) {
          SG.Sprites.drawLandmarks(ctx, camX, camY, w, h, this.landmarks, this.timeScale < 0.65);
        }
      } else {
        if (useSprites && SG.Sprites) {
          SG.Sprites.drawFloor(ctx, camX, camY, w, h, this.bounds, this.landmarks, this.timeScale < 0.65);
        } else {
          const starTime = nowSec * 2;
          ctx.fillStyle = '#d8ecff';
          for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            const sx = (((s.nx * w - camX * 0.22) % w) + w) % w + camX;
            const sy = (((s.ny * h - camY * 0.22) % h) + h) % h + camY;
            ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(starTime + s.twinkle));
            ctx.fillRect(sx, sy, s.size, s.size);
          }
          ctx.globalAlpha = 1;
        }

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

      // Open-World Arena Hazard Perimeter Barrier
      if (SG.Sprites) {
        SG.Sprites.drawPerimeter(ctx, this.bounds, camX, camY, w, h, nowSec);
      }

      // Overworld Base, Anomaly Rifts & Navigation Compasses (or Dungeon Exit Portal)
      if (this.zone === 'overworld' && SG.Sprites) {
        SG.Sprites.drawBase(ctx, this.base, nowSec, this.inBaseZone, useSprites);
        if (this.buildings && this.buildings.length > 0 && SG.Sprites.drawBuilding) {
          for (let i = 0; i < this.buildings.length; i++) {
            const b = this.buildings[i];
            if (b.x + 140 < camX || b.x - 140 > camX + w || b.y + 140 < camY || b.y - 140 > camY + h) continue;
            const def = BUILDING_DEFS.find(d => d.id === b.type);
            if (def) SG.Sprites.drawBuilding(ctx, b, def, this.base, nowSec);
          }
        }
        if (this.buildPlacement && SG.Sprites.drawBuildingGhost) {
          const gx = this.mouse.x;
          const gy = this.mouse.y;
          const valid = this.isValidBuildingPos(gx, gy);
          SG.Sprites.drawBuildingGhost(ctx, this.buildPlacement.def, gx, gy, valid, this.base, BUILD_MIN_R, BUILD_MAX_R, nowSec);
        }
        for (let i = 0; i < this.anomalies.length; i++) {
          const a = this.anomalies[i];
          if (a.x + 220 < camX || a.x - 220 > camX + w || a.y + 220 < camY || a.y - 220 > camY + h) continue;
          const isNear = !!(this.player && Math.hypot(this.player.x - a.x, this.player.y - a.y) < 340);
          SG.Sprites.drawAnomaly(ctx, a, nowSec, isNear);
        }

        // Active GPS Waypoint pulsing beacon in world space
        if (this.waypoint) {
          const wx = this.waypoint.x;
          const wy = this.waypoint.y;
          const wpCol = this.waypoint.color || '#ffd166';
          if (wx + 120 >= camX && wx - 120 <= camX + w && wy + 120 >= camY && wy - 120 <= camY + h) {
            const pulse = 22 + Math.sin(nowSec * 5) * 6;
            ctx.save();
            ctx.strokeStyle = wpCol;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wx, wy, pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(wx, wy, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = wpCol;
            ctx.font = '800 10.5px "JetBrains Mono", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.waypoint.label || this.t('wm.legWp'), wx, wy - pulse - 8);
            ctx.restore();
          }
        }

        if (this.state === 'playing' && this.player) {
          const px = this.player.x;
          const py = this.player.y;
          const drawCompass = (tx, ty, col, radiusRing, sizeArrow, showDist = false) => {
            const dx = tx - px;
            const dy = ty - py;
            const d = Math.hypot(dx, dy);
            if (d <= 280) return;
            const ang = Math.atan2(dy, dx);
            const cx = px + Math.cos(ang) * radiusRing;
            const cy = py + Math.sin(ang) * radiusRing;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(sizeArrow, 0);
            ctx.lineTo(-sizeArrow, sizeArrow * 0.72);
            ctx.lineTo(-sizeArrow * 0.45, 0);
            ctx.lineTo(-sizeArrow, -sizeArrow * 0.72);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            if (showDist) {
              ctx.save();
              ctx.fillStyle = col;
              ctx.font = '800 10px "JetBrains Mono", system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${Math.round(d / 10)}м`, px + Math.cos(ang) * (radiusRing + 18), py + Math.sin(ang) * (radiusRing + 18));
              ctx.restore();
            }
          };

          if (Math.hypot(this.base.x - px, this.base.y - py) > 340) {
            drawCompass(this.base.x, this.base.y, '#00f0ff', 68, 7.2);
          }
          if (this.waypoint) {
            drawCompass(this.waypoint.x, this.waypoint.y, this.waypoint.color || '#ffd166', 82, 8.2, true);
          }
          const nearestAnoms = this.anomalies
            .filter(a => !a.cleared)
            .map(a => ({ a, d: Math.hypot(a.x - px, a.y - py) }))
            .filter(item => item.d > 280)
            .sort((u, v) => u.d - v.d)
            .slice(0, 3);
          for (const item of nearestAnoms) {
            drawCompass(item.a.x, item.a.y, item.a.color, 58, 5.5);
          }
        }
      } else if (this.zone === 'anomaly' && this.exitPortal && SG.Sprites) {
        SG.Sprites.drawExitPortal(ctx, this.exitPortal, nowSec);
        if (this.state === 'playing' && this.player) {
          const dx = this.exitPortal.x - this.player.x;
          const dy = this.exitPortal.y - this.player.y;
          if (Math.hypot(dx, dy) > 220) {
            const ang = Math.atan2(dy, dx);
            const cx = this.player.x + Math.cos(ang) * 62;
            const cy = this.player.y + Math.sin(ang) * 62;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);
            ctx.fillStyle = '#22ffa6';
            ctx.beginPath();
            ctx.moveTo(7, 0);
            ctx.lineTo(-7, 5);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-7, -5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
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

      // Pickups (Mindustry Sprites or batched 2D fallback)
      if (useSprites && SG.Sprites && this.pickups.length > 0) {
        for (let i = 0; i < this.pickups.length; i++) {
          const pk = this.pickups[i];
          if (pk.x < camX - 40 || pk.x > camX + w + 40 || pk.y < camY - 40 || pk.y > camY + h + 40) continue;
          const isXp = pk.kind === 'xp';
          SG.Sprites.drawUnit(
            ctx,
            isXp ? 'pickup_xp' : 'pickup_heal',
            pk.x,
            pk.y,
            nowSec * (isXp ? 1.5 : 0.9) + (pk.x + pk.y) * 0.01,
            isXp ? 20 : 26,
            0,
            1
          );
        }
      } else if (!useGpu && this.pickups.length > 0) {
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

      if (!useGpu) {
        // Bullets & Relativistic Trails (zero shadowBlur!)
        if (this.bullets.length > 0) {
          ctx.save();
          if (preset.bulletGlow) {
            ctx.globalCompositeOperation = 'lighter';
          }
          for (let i = 0; i < this.bullets.length; i++) {
            const b = this.bullets[i];
            if (b.x < camX - 80 || b.x > camX + w + 80 || b.y < camY - 80 || b.y > camY + h + 80) continue;
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
      }

      // Enemies (2D fallback or Mindustry sprite overlay)
      if (!useGpu || useSprites) {
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.isBoss && (e.x < camX - 140 || e.x > camX + w + 140 || e.y < camY - 140 || e.y > camY + h + 140)) {
            continue;
          }
          SG.renderEnemy(ctx, e, useSprites);
        }

        // Player Render
        if (this.state === 'playing' || this.state === 'upgrade' || this.state === 'paused' || this.state === 'title') {
          this.player.render(ctx, { useSprites, skipAuras: useGpu });
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

      // Gravity Well Skillshot Preview (Touch Drag)
      if (this.state === 'playing' && this.touchInput && this.touchInput.wellPreviewActive && this.player) {
        const wx = this.touchInput.wellPreviewX;
        const wy = this.touchInput.wellPreviewY;
        const rMult = (this.player.mods && this.player.mods.wellRadiusMult) || 1.0;
        const col = this.touchInput.wellCancel ? '#ff3b6b' : (this.repulsorMode ? '#ffb838' : '#c06cff');
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y);
        ctx.lineTo(wx, wy);
        ctx.stroke();

        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(wx, wy, 265 * rMult, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(wx, wy, 74 * rMult, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(wx, wy, 18 * rMult, 0, Math.PI * 2);
        ctx.stroke();

        if (this.touchInput.wellCancel) {
          ctx.fillStyle = '#ff6b8b';
          ctx.font = '800 11px "JetBrains Mono", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ОТМЕНА', wx, wy - 28 * rMult);
        }
        ctx.restore();
      }

      // Screen-Space HUD Overlay, Vignettes, Boss Bar & Minimap (unshaken screen space)
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Boss Health Bar (top-center on touch so thumbs don't cover it; bottom-center on desktop)
      const boss = this.enemies.find(e => e.isBoss && !e.dead);
      if (boss) {
        const bw = Math.min(480, w * (this.isTouchDevice ? 0.56 : 0.62));
        const bx = (w - bw) * 0.5;
        const by = this.isTouchDevice ? 78 : h - 42;
        ctx.fillStyle = 'rgba(6, 10, 24, 0.84)';
        ctx.strokeStyle = 'rgba(255, 59, 107, 0.72)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, by, bw, 12);
        ctx.strokeRect(bx, by, bw, 12);
        ctx.fillStyle = boss.color || '#ff3b6b';
        ctx.fillRect(bx + 2, by + 2, (bw - 4) * Math.max(0, boss.hp / boss.maxHp), 8);

        ctx.fillStyle = '#ffd6e2';
        ctx.font = '700 12px "JetBrains Mono", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`БОСС: ${boss.name} [ФАЗА ${boss.bossPhase || 1}/3] — ${Math.ceil(boss.hp)} / ${boss.maxHp}`, w * 0.5, by - 7);
      }

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
        const alpha = Math.min(1, t * 2.2, (3.6 - t) * 3.2 + 0.2);
        const isBossW = ((this.zone === 'anomaly' && !this.anomalyCleared) || this.zone === 'endless') && (this.wave % 5 === 0);
        const accentCol = this.waveBannerColor || (isBossW ? '#ff3b6b' : '#00f0ff');
        const titleTxt = this.waveBannerTitle || this.t('hud.waveDefault', { wave: this.wave });
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        const cy = 98;
        const bw = isBossW || titleTxt.length > 18 ? 460 : 340;
        ctx.fillStyle = isBossW ? 'rgba(38, 8, 20, 0.86)' : 'rgba(8, 15, 34, 0.84)';
        ctx.strokeStyle = accentCol;
        ctx.lineWidth = 1.4;
        ctx.fillRect(w * 0.5 - bw * 0.5, cy - 24, bw, 46);
        ctx.strokeRect(w * 0.5 - bw * 0.5, cy - 24, bw, 46);

        ctx.textAlign = 'center';
        ctx.font = '800 16px "JetBrains Mono", system-ui, sans-serif';
        ctx.fillStyle = isBossW ? '#ffb838' : '#ffffff';
        ctx.fillText(titleTxt, w * 0.5, cy - 3);

        ctx.font = '700 10.5px "JetBrains Mono", system-ui, sans-serif';
        ctx.fillStyle = this.waveBannerColor || (isBossW ? '#ff6b8b' : '#7df9ff');
        ctx.fillText(this.waveSubtitle || this.t('game.sectorActive'), w * 0.5, cy + 14);
        ctx.restore();
      }

      // Tactical Open-World Minimap Radar
      if (this.state === 'playing' || this.state === 'upgrade' || this.state === 'paused') {
        this.renderMinimap(ctx, w, h);
      }

      // Custom tactical crosshair (with recoil bloom, well pips & dual cooldown arcs)
      if (this.state === 'playing') {
        const mx = this.mouse.x - camX;
        const my = this.mouse.y - camY;
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

    renderMinimap(ctx, vpW, vpH) {
      if (!this.player || vpW < 360 || vpH < 260) return;
      const isOverworld = this.zone === 'overworld';
      const size = isOverworld
        ? (this.isTouchDevice || vpW < 760 ? 108 : 148)
        : (this.isTouchDevice || vpW < 760 ? 94 : 124);
      const mx = vpW - size - 14;
      const my = this.isTouchDevice ? 112 : 76;
      this._minimapRect = isOverworld ? { x: mx, y: my, size } : null;
      const scaleX = size / this.bounds.width;
      const scaleY = size / this.bounds.height;
      const gridDivs = isOverworld ? 12 : 4;

      ctx.save();
      ctx.fillStyle = 'rgba(7, 11, 19, 0.78)';
      ctx.strokeStyle = 'rgba(255, 184, 56, 0.36)';
      ctx.lineWidth = 1.2;
      ctx.fillRect(mx, my, size, size);
      ctx.strokeRect(mx, my, size, size);

      // Sector sub-grid
      ctx.strokeStyle = 'rgba(130, 155, 190, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let q = 1; q < gridDivs; q++) {
        const gx = mx + (size * q) / gridDivs;
        const gy = my + (size * q) / gridDivs;
        ctx.moveTo(gx, my);
        ctx.lineTo(gx, my + size);
        ctx.moveTo(mx, gy);
        ctx.lineTo(mx + size, gy);
      }
      ctx.stroke();

      // Industrial landmarks (shown in dungeons; omitted in giant overworld to keep Base & Anomalies crystal clear)
      if (!isOverworld && this.landmarks) {
        ctx.fillStyle = 'rgba(120, 145, 180, 0.35)';
        for (let i = 0; i < this.landmarks.length; i++) {
          const lm = this.landmarks[i];
          ctx.fillRect(mx + lm.x * scaleX - 1.5, my + lm.y * scaleY - 1.5, 3, 3);
        }
      }

      // Overworld Base & Anomalies (or Dungeon Exit Portal)
      if (this.zone === 'overworld') {
        const bx = mx + this.base.x * scaleX;
        const by = my + this.base.y * scaleY;
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(bx - 3.5, by - 3.5, 7, 7);
        ctx.strokeStyle = '#22ffa6';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 5.5, by - 5.5, 11, 11);

        if (this.buildings && this.buildings.length > 0) {
          for (let i = 0; i < this.buildings.length; i++) {
            const b = this.buildings[i];
            const def = BUILDING_DEFS.find(d => d.id === b.type);
            ctx.fillStyle = def ? def.color : '#22ffa6';
            ctx.fillRect(mx + b.x * scaleX - 1.8, my + b.y * scaleY - 1.8, 3.6, 3.6);
          }
        }

        for (let i = 0; i < this.anomalies.length; i++) {
          const a = this.anomalies[i];
          const ax = mx + a.x * scaleX;
          const ay = my + a.y * scaleY;
          if (a.cleared) {
            ctx.fillStyle = 'rgba(34, 255, 166, 0.35)';
            ctx.fillRect(ax - 1.5, ay - 1.5, 3, 3);
          } else {
            ctx.fillStyle = a.color;
            ctx.beginPath();
            ctx.arc(ax, ay, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        if (this.waypoint) {
          const wx = mx + this.waypoint.x * scaleX;
          const wy = my + this.waypoint.y * scaleY;
          ctx.fillStyle = this.waypoint.color || '#ffd166';
          ctx.beginPath();
          ctx.arc(wx, wy, 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (this.exitPortal) {
        const ex = mx + this.exitPortal.x * scaleX;
        const ey = my + this.exitPortal.y * scaleY;
        ctx.fillStyle = '#22ffa6';
        ctx.beginPath();
        ctx.arc(ex, ey, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Gravity wells
      for (let i = 0; i < this.wells.length; i++) {
        const w = this.wells[i];
        ctx.fillStyle = w.isRepulsor ? '#ffb838' : '#c06cff';
        ctx.fillRect(mx + w.x * scaleX - 1.5, my + w.y * scaleY - 1.5, 3, 3);
      }

      // Heal orbs (valuable across large world)
      ctx.fillStyle = '#22ffa6';
      for (let i = 0; i < this.pickups.length; i++) {
        const pk = this.pickups[i];
        if (pk.kind !== 'xp') {
          ctx.fillRect(mx + pk.x * scaleX - 1.2, my + pk.y * scaleY - 1.2, 2.5, 2.5);
        }
      }

      // Enemies (elites/bosses emphasized)
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        const ex = mx + e.x * scaleX;
        const ey = my + e.y * scaleY;
        if (e.isBoss) {
          ctx.fillStyle = '#ffb838';
          ctx.fillRect(ex - 3, ey - 3, 6, 6);
          ctx.strokeStyle = '#ff3b6b';
          ctx.strokeRect(ex - 4, ey - 4, 8, 8);
        } else if (e.isElite) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(ex - 1.8, ey - 1.8, 3.6, 3.6);
        } else {
          ctx.fillStyle = 'rgba(255, 79, 109, 0.85)';
          ctx.fillRect(ex - 1, ey - 1, 2, 2);
        }
      }

      // Current viewport frame
      const vx = mx + this.camera.x * scaleX;
      const vy = my + this.camera.y * scaleY;
      const vw = Math.min(size, Math.max(8, vpW * scaleX));
      const vh = Math.min(size, Math.max(6, vpH * scaleY));
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, vw, vh);

      // Player indicator
      const px = mx + this.player.x * scaleX;
      const py = my + this.player.y * scaleY;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Radar coordinate label
      const col = Math.min(gridDivs, Math.max(1, Math.floor((this.player.x / this.bounds.width) * gridDivs) + 1));
      const row = Math.min(gridDivs, Math.max(1, Math.floor((this.player.y / this.bounds.height) * gridDivs) + 1));
      ctx.fillStyle = this.zone === 'endless'
        ? ((this.wave % 5 === 0) ? '#ff3b6b' : '#ffb838')
        : (this.zone === 'anomaly' && this.activeAnomaly ? this.activeAnomaly.color : 'rgba(180, 200, 224, 0.78)');
      ctx.font = '700 9px "JetBrains Mono", system-ui, sans-serif';
      ctx.textAlign = 'right';
      const zoneTag = this.zone === 'endless'
        ? `∞ ${this.t('hud.waveDefault', { wave: this.wave.toLocaleString(this.locale()) })}`
        : (this.zone === 'anomaly'
          ? this.t('game.minimapAnomaly', { tier: this.activeAnomaly ? this.activeAnomaly.tier : 1 })
          : this.t('game.minimapWorld', { col, row }));
      ctx.fillText(zoneTag, mx + size - 3, my + size + 11);

      ctx.restore();
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      try {
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
      } catch (err) {
        const errNow = performance.now();
        if (!this._lastLoopErrAt || errNow - this._lastLoopErrAt >= 2000) {
          this._lastLoopErrAt = errNow;
          console.error('[SINGULARIS] Game loop error:', err);
        }
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
  });
})(window.SG);
