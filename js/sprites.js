// SINGULARIS — Mindustry-Style Procedural Industrial Texture & Sprite Atlas
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  const tr = (k, v, fb) => (SG.I18n ? SG.I18n.t(k, v) : fb);

  const Sprites = {
    ready: false,
    units: {},
    flash: {},
    floorTile: null,
    _patternCache: new WeakMap(),

    init() {
      if (this.ready || typeof document === 'undefined') return;
      try {
        this.units.player = this._buildPlayer('#00f0ff', '#7df9ff');
        this.units.player_bt = this._buildPlayer('#d98aff', '#f5d0fe');
        this.units.drone = this._buildDrone();
        this.units.swarmer = this._buildSwarmer();
        this.units.sniper = this._buildSniper();
        this.units.phalanx = this._buildPhalanx();
        this.units.pulsar = this._buildPulsar();
        this.units.weaver = this._buildWeaver();
        this.units.boss_leviathan_head = this._buildLeviathanHead();
        this.units.boss_leviathan_seg = this._buildLeviathanSeg();
        this.units.boss_archon_gold = this._buildArchonCore('#ffb838', '#fff0b8');
        this.units.boss_archon_violet = this._buildArchonCore('#c06cff', '#f3d1ff');
        this.units.pickup_xp = this._buildXpCrystal();
        this.units.pickup_heal = this._buildHealPod();
        this.units.base_core = this._buildBaseCore();

        const flashKeys = [
          'swarmer', 'sniper', 'phalanx', 'pulsar', 'weaver',
          'boss_leviathan_head', 'boss_leviathan_seg',
          'boss_archon_gold', 'boss_archon_violet'
        ];
        for (const k of flashKeys) {
          this.flash[k] = this._makeFlashVariant(this.units[k]);
        }

        this.floorTile = this._buildFloorTile();
        this.ready = true;
      } catch (_) {
        this.ready = false;
      }
    },

    _makeCanvas(w, h, drawFn) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      drawFn(ctx, w, h);
      return c;
    },

    _makeFlashVariant(src) {
      return this._makeCanvas(src.width, src.height, (ctx, w, h) => {
        ctx.drawImage(src, 0, 0);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      });
    },

    _drawRivets(ctx, pts, col = '#7f98bd', r = 1.4) {
      ctx.fillStyle = col;
      for (let i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    _buildPlayer(coreCol, highlightCol) {
      return this._makeCanvas(96, 96, (ctx) => {
        ctx.translate(48, 48);

        // Twin rear thruster housings
        ctx.fillStyle = '#1b2436';
        ctx.strokeStyle = '#0c101b';
        ctx.lineWidth = 2.6;
        for (const sgn of [-1, 1]) {
          ctx.fillRect(-30, sgn * 11 - 5, 14, 10);
          ctx.strokeRect(-30, sgn * 11 - 5, 14, 10);
          ctx.fillStyle = coreCol;
          ctx.fillRect(-32, sgn * 11 - 3, 4, 6);
          ctx.fillStyle = '#1b2436';
        }

        // Twin forward rail-barrels
        ctx.fillStyle = '#475b7a';
        ctx.strokeStyle = '#0c101b';
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.rect(10, sgn * 10 - 3, 24, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = highlightCol;
          ctx.fillRect(28, sgn * 10 - 1.5, 5, 3);
          ctx.fillStyle = '#475b7a';
        }

        // Main swept delta hull
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(6, 14);
        ctx.lineTo(-16, 28);
        ctx.lineTo(-28, 22);
        ctx.lineTo(-19, 8);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-19, -8);
        ctx.lineTo(-28, -22);
        ctx.lineTo(-16, -28);
        ctx.lineTo(6, -14);
        ctx.closePath();
        ctx.fillStyle = '#2b3850';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0c101b';
        ctx.stroke();

        // Inner armored dorsal plating
        ctx.beginPath();
        ctx.moveTo(27, 0);
        ctx.lineTo(4, 10);
        ctx.lineTo(-14, 18);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-14, -18);
        ctx.lineTo(4, -10);
        ctx.closePath();
        ctx.fillStyle = '#435778';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#6c87b0';
        ctx.stroke();

        // Recessed wing vents
        ctx.fillStyle = '#151d2e';
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(-4, sgn * 12);
          ctx.lineTo(-18, sgn * 20);
          ctx.lineTo(-21, sgn * 16);
          ctx.lineTo(-8, sgn * 9);
          ctx.closePath();
          ctx.fill();
        }

        // Glowing Quantum Core & cockpit visor
        const grad = ctx.createRadialGradient(2, 0, 1, 2, 0, 11);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.42, highlightCol);
        grad.addColorStop(1, coreCol);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(2, 6);
        ctx.lineTo(-6, 0);
        ctx.lineTo(2, -6);
        ctx.closePath();
        ctx.fill();

        this._drawRivets(ctx, [[-11, -13], [-11, 13], [4, -7], [4, 7]], '#8fa9cf', 1.3);
      });
    },

    _buildDrone() {
      return this._makeCanvas(44, 44, (ctx) => {
        ctx.translate(22, 22);
        ctx.fillStyle = '#4e6587';
        ctx.strokeStyle = '#0c101b';
        ctx.lineWidth = 2;
        ctx.fillRect(4, -2.5, 13, 5);
        ctx.strokeRect(4, -2.5, 13, 5);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = Math.cos(a) * 11;
          const y = Math.sin(a) * 11;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#33425c';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    _buildSwarmer() {
      return this._makeCanvas(72, 72, (ctx) => {
        ctx.translate(36, 36);
        // Flare-inspired interceptor hull
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(4, 10);
        ctx.lineTo(-14, 23);
        ctx.lineTo(-22, 16);
        ctx.lineTo(-12, 5);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-12, -5);
        ctx.lineTo(-22, -16);
        ctx.lineTo(-14, -23);
        ctx.lineTo(4, -10);
        ctx.closePath();
        ctx.fillStyle = '#323a4f';
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#0e121c';
        ctx.stroke();

        // Crimson armored wing plates
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(-2, 8);
        ctx.lineTo(-12, 14);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-12, -14);
        ctx.lineTo(-2, -8);
        ctx.closePath();
        ctx.fillStyle = '#68263b';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#a83c5b';
        ctx.stroke();

        // Glowing core slit
        ctx.fillStyle = '#ff3b6b';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(0, 4.5);
        ctx.lineTo(-5, 0);
        ctx.lineTo(0, -4.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd1dc';
        ctx.fillRect(1, -1.5, 6, 3);
      });
    },

    _buildSniper() {
      return this._makeCanvas(88, 88, (ctx) => {
        ctx.translate(44, 44);
        // Long accelerator railgun barrel
        ctx.fillStyle = '#2b3347';
        ctx.strokeStyle = '#0c101b';
        ctx.lineWidth = 2.6;
        ctx.fillRect(0, -5, 36, 10);
        ctx.strokeRect(0, -5, 36, 10);

        // Side armor wings
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-6, 22);
        ctx.lineTo(-24, 18);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-24, -18);
        ctx.lineTo(-6, -22);
        ctx.closePath();
        ctx.fillStyle = '#38435c';
        ctx.fill();
        ctx.stroke();

        // Dorsal cap
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, 12);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-8, -12);
        ctx.closePath();
        ctx.fillStyle = '#5a4836';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#99744d';
        ctx.stroke();

        // Capacitor coils along barrel
        ctx.fillStyle = '#ff9e2c';
        for (let bx = 8; bx <= 26; bx += 7) {
          ctx.fillRect(bx, -3, 3.5, 6);
        }
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath();
        ctx.arc(-4, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        this._drawRivets(ctx, [[-16, -11], [-16, 11], [-6, -15], [-6, 15]], '#9fb0cc', 1.3);
      });
    },

    _buildPhalanx() {
      return this._makeCanvas(96, 96, (ctx) => {
        ctx.translate(48, 48);
        // Twin heavy shoulder cannons
        ctx.fillStyle = '#475c7a';
        ctx.strokeStyle = '#0c101b';
        ctx.lineWidth = 2.6;
        for (const sgn of [-1, 1]) {
          ctx.fillRect(8, sgn * 17 - 4, 20, 8);
          ctx.strokeRect(8, sgn * 17 - 4, 20, 8);
        }

        // Heavy hexagonal armored body
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = Math.cos(a) * 28;
          const y = Math.sin(a) * 28;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#28384f';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner beveled steel turret plate
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = Math.cos(a) * 18;
          const y = Math.sin(a) * 18;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#3c5678';
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#6da7d9';
        ctx.stroke();

        // Shield emitter core
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f7ff';
        ctx.beginPath();
        ctx.arc(2, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();
        this._drawRivets(ctx, [[-12, -18], [-12, 18], [10, -18], [10, 18]], '#8ab8e6', 1.5);
      });
    },

    _buildPulsar() {
      return this._makeCanvas(88, 88, (ctx) => {
        ctx.translate(44, 44);
        // 4 armored pylons (Quasar-inspired)
        ctx.fillStyle = '#2d2945';
        ctx.strokeStyle = '#0c101b';
        ctx.lineWidth = 2.6;
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(10, -8);
          ctx.lineTo(29, -4);
          ctx.lineTo(29, 4);
          ctx.lineTo(10, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#c06cff';
          ctx.fillRect(21, -2.5, 5, 5);
          ctx.fillStyle = '#2d2945';
          ctx.restore();
        }

        // Central octagonal core frame
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + Math.PI / 8;
          const x = Math.cos(a) * 18;
          const y = Math.sin(a) * 18;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#403663';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d98aff';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    _buildWeaver() {
      return this._makeCanvas(80, 80, (ctx) => {
        ctx.translate(40, 40);
        // Diamond stealth hull
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(0, 22);
        ctx.lineTo(-24, 0);
        ctx.lineTo(0, -22);
        ctx.closePath();
        ctx.fillStyle = '#1f3638';
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#0c101b';
        ctx.stroke();

        // Inner angular armor fins
        ctx.beginPath();
        ctx.moveTo(17, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-14, 0);
        ctx.lineTo(0, -12);
        ctx.closePath();
        ctx.fillStyle = '#2c5454';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#4fb39b';
        ctx.stroke();

        ctx.fillStyle = '#22ffa6';
        ctx.beginPath();
        ctx.arc(2, 0, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e6fff5';
        ctx.fillRect(0, -1.8, 5, 3.6);
      });
    },

    _buildLeviathanHead() {
      return this._makeCanvas(160, 160, (ctx) => {
        ctx.translate(80, 80);
        // Serrated crimson mandibles
        ctx.fillStyle = '#572234';
        ctx.strokeStyle = '#0b0e17';
        ctx.lineWidth = 3.2;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(22, sgn * 16);
          ctx.lineTo(66, sgn * 32);
          ctx.lineTo(44, sgn * 10);
          ctx.lineTo(24, sgn * 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Main armored carapace
        ctx.beginPath();
        ctx.moveTo(54, 0);
        ctx.lineTo(14, 38);
        ctx.lineTo(-34, 42);
        ctx.lineTo(-48, 18);
        ctx.lineTo(-40, 0);
        ctx.lineTo(-48, -18);
        ctx.lineTo(-34, -42);
        ctx.lineTo(14, -38);
        ctx.closePath();
        ctx.fillStyle = '#291f30';
        ctx.fill();
        ctx.stroke();

        // Layered dorsal titanium plates
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.lineTo(8, 25);
        ctx.lineTo(-28, 22);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-28, -22);
        ctx.lineTo(8, -25);
        ctx.closePath();
        ctx.fillStyle = '#4a263b';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff3b6b';
        ctx.stroke();

        // Twin optic cores & central reactor
        ctx.fillStyle = '#ff2a5f';
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(20, sgn * 13, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd1dc';
        ctx.beginPath();
        ctx.arc(2, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        this._drawRivets(ctx, [[-18, -28], [-18, 28], [-4, -30], [-4, 30], [-28, -12], [-28, 12]], '#c97b93', 2.0);
      });
    },

    _buildLeviathanSeg() {
      return this._makeCanvas(120, 120, (ctx) => {
        ctx.translate(60, 60);
        // Lateral spine fins
        ctx.fillStyle = '#381d2c';
        ctx.strokeStyle = '#0b0e17';
        ctx.lineWidth = 2.8;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(12, sgn * 24);
          ctx.lineTo(-18, sgn * 48);
          ctx.lineTo(-24, sgn * 28);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Armored hexagonal body ring
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const x = Math.cos(a) * 34;
          const y = Math.sin(a) * 34;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#251a2b';
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 21, 0, Math.PI * 2);
        ctx.fillStyle = '#472136';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff2a5f';
        ctx.stroke();

        ctx.fillStyle = '#ff6b8b';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    _buildArchonCore(mainCol, brightCol) {
      return this._makeCanvas(128, 128, (ctx) => {
        ctx.translate(64, 64);
        // 8 radiating armored turbine fins
        ctx.fillStyle = '#2f2b42';
        ctx.strokeStyle = '#0c0f1a';
        ctx.lineWidth = 2.6;
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 4);
          ctx.beginPath();
          ctx.moveTo(18, -7);
          ctx.lineTo(48, -4);
          ctx.lineTo(48, 4);
          ctx.lineTo(18, 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = mainCol;
          ctx.fillRect(36, -2, 8, 4);
          ctx.fillStyle = '#2f2b42';
          ctx.restore();
        }

        // Heavy octagonal core housing
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + Math.PI / 8;
          const x = Math.cos(a) * 30;
          const y = Math.sin(a) * 30;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#211d33';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fillStyle = mainCol;
        ctx.fill();
        ctx.fillStyle = brightCol;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    _buildXpCrystal() {
      return this._makeCanvas(36, 36, (ctx) => {
        ctx.translate(18, 18);
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fillStyle = '#00d98b';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#08241d';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fillStyle = '#a7ffdf';
        ctx.fill();
      });
    },

    _buildHealPod() {
      return this._makeCanvas(44, 44, (ctx) => {
        ctx.translate(22, 22);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#233b42';
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#0c141c';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#18b87a';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -2.2, 12, 4.4);
        ctx.fillRect(-2.2, -6, 4.4, 12);
      });
    },

    _buildFloorTile() {
      return this._makeCanvas(256, 256, (ctx) => {
        ctx.fillStyle = '#060a14';
        ctx.fillRect(0, 0, 256, 256);

        const cell = 64;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const x = c * cell;
            const y = r * cell;
            const alt = ((r + c) & 1) === 0;
            ctx.fillStyle = alt ? '#09101f' : '#0b1324';
            ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);

            // Bevel top-left highlight & bottom-right shadow
            ctx.strokeStyle = 'rgba(110, 150, 210, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 2.5, y + cell - 3);
            ctx.lineTo(x + 2.5, y + 2.5);
            ctx.lineTo(x + cell - 3, y + 2.5);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.moveTo(x + cell - 2.5, y + 3);
            ctx.lineTo(x + cell - 2.5, y + cell - 2.5);
            ctx.lineTo(x + 3, y + cell - 2.5);
            ctx.stroke();

            // Corner bolts
            ctx.fillStyle = 'rgba(120, 160, 220, 0.14)';
            ctx.fillRect(x + 6, y + 6, 2, 2);
            ctx.fillRect(x + cell - 8, y + 6, 2, 2);
            ctx.fillRect(x + 6, y + cell - 8, 2, 2);
            ctx.fillRect(x + cell - 8, y + cell - 8, 2, 2);

            // Vent grates on specific industrial tiles
            if ((r === 1 && c === 2) || (r === 3 && c === 0)) {
              ctx.fillStyle = 'rgba(3, 6, 12, 0.72)';
              for (let vy = 16; vy <= 44; vy += 7) {
                ctx.fillRect(x + 14, y + vy, 36, 3.5);
              }
            }

            // Subtle glowing conduit lines
            if ((r === 0 && c === 1) || (r === 2 && c === 3)) {
              ctx.strokeStyle = 'rgba(0, 240, 255, 0.09)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x + 10, y + 32);
              ctx.lineTo(x + 54, y + 32);
              ctx.stroke();
            }
          }
        }

        // Major 256px sector boundary seam
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0.5, 0.5, 255, 255);
      });
    },

    getFloorPattern(ctx) {
      if (!this.floorTile) return null;
      let pat = this._patternCache.get(ctx);
      if (!pat) {
        pat = ctx.createPattern(this.floorTile, 'repeat');
        if (pat) this._patternCache.set(ctx, pat);
      }
      return pat;
    },

    drawUnit(ctx, key, x, y, angle, drawSize, hitFlash = 0, alpha = 1) {
      const img = this.units[key];
      if (!img) return;
      const half = drawSize * 0.5;
      ctx.save();
      ctx.translate(x, y);
      if (angle !== 0) ctx.rotate(angle);
      if (alpha < 0.999) ctx.globalAlpha = alpha;
      ctx.drawImage(img, -half, -half, drawSize, drawSize);
      if (hitFlash > 0.02 && this.flash[key]) {
        ctx.globalAlpha = Math.min(0.85, hitFlash * 0.78) * alpha;
        ctx.drawImage(this.flash[key], -half, -half, drawSize, drawSize);
      }
      ctx.restore();
    },

    drawLandmarks(ctx, camX, camY, vpW, vpH, landmarks, isSlow) {
      if (!landmarks || landmarks.length === 0) return;
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const r = lm.radius;
        if (lm.x + r < camX - 40 || lm.x - r > camX + vpW + 40 || lm.y + r < camY - 40 || lm.y - r > camY + vpH + 40) {
          continue;
        }
        ctx.save();
        ctx.translate(lm.x, lm.y);
        const col = isSlow ? 'rgba(185, 92, 255, 0.22)' : 'rgba(0, 240, 255, 0.16)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        if (lm.kind === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        } else if (lm.kind === 1) {
          ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
          ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
          ctx.stroke();
        } else {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            const px = Math.cos(a) * r * 0.85;
            const py = Math.sin(a) * r * 0.85;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = isSlow ? 'rgba(217, 138, 255, 0.26)' : 'rgba(125, 249, 255, 0.22)';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lm.label, 0, r + 14);
        ctx.restore();
      }
    },

    drawFloor(ctx, camX, camY, vpW, vpH, bounds, landmarks, isSlow) {
      const pat = this.getFloorPattern(ctx);
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(camX - 2, camY - 2, vpW + 4, vpH + 4);
      } else {
        ctx.fillStyle = isSlow ? '#0a071a' : '#050914';
        ctx.fillRect(camX - 2, camY - 2, vpW + 4, vpH + 4);
      }
      if (isSlow) {
        ctx.fillStyle = 'rgba(110, 50, 210, 0.14)';
        ctx.fillRect(camX - 2, camY - 2, vpW + 4, vpH + 4);
      }
      this.drawLandmarks(ctx, camX, camY, vpW, vpH, landmarks, isSlow);
    },

    drawPerimeter(ctx, bounds, camX, camY, vpW, vpH, nowSec) {
      const margin = 40;
      const nearLeft = camX < margin;
      const nearTop = camY < margin;
      const nearRight = camX + vpW > bounds.width - margin;
      const nearBottom = camY + vpH > bounds.height - margin;
      if (!nearLeft && !nearTop && !nearRight && !nearBottom) return;

      ctx.save();
      const pulse = 0.55 + 0.25 * Math.sin(nowSec * 3.5);
      ctx.strokeStyle = `rgba(255, 59, 107, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, bounds.width - 4, bounds.height - 4);

      ctx.strokeStyle = 'rgba(255, 184, 56, 0.72)';
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 14]);
      ctx.strokeRect(10, 10, bounds.width - 20, bounds.height - 20);
      ctx.restore();
    },

    _hexRgba(hex, alpha) {
      const h = (hex || '#00f0ff').replace('#', '');
      const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16) || 0x00f0ff;
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    _buildBaseCore() {
      return this._makeCanvas(192, 192, (ctx, w, h) => {
        ctx.translate(w * 0.5, h * 0.5);

        // Outer armored docking foundation (octagon)
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + Math.PI / 8;
          const r = 84;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const baseGrad = ctx.createRadialGradient(0, 0, 12, 0, 0, 86);
        baseGrad.addColorStop(0, '#2a394e');
        baseGrad.addColorStop(0.65, '#1a2434');
        baseGrad.addColorStop(1, '#0e1522');
        ctx.fillStyle = baseGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#090e17';
        ctx.stroke();

        // Diagonal yellow/black Mindustry hazard docking pylons (4 corners)
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.rotate(q * Math.PI * 0.5 + Math.PI * 0.25);
          ctx.fillStyle = '#182130';
          ctx.fillRect(46, -15, 24, 30);
          ctx.strokeStyle = '#0a0f18';
          ctx.lineWidth = 2;
          ctx.strokeRect(46, -15, 24, 30);

          ctx.fillStyle = '#ffb838';
          ctx.fillRect(58, -11, 7, 6);
          ctx.fillRect(58, 5, 7, 6);
          ctx.fillStyle = '#24f5a8';
          ctx.fillRect(50, -3, 4, 6);
          ctx.restore();
        }

        // Recessed power trusses (cardinal conduits)
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.rotate(q * Math.PI * 0.5);
          ctx.fillStyle = '#0d1420';
          ctx.fillRect(26, -10, 48, 20);
          ctx.fillStyle = '#334863';
          ctx.fillRect(30, -7, 40, 14);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.72)';
          ctx.fillRect(32, -2, 34, 4);
          ctx.restore();
        }

        // Inner titanium hexagonal ring
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const px = Math.cos(a) * 44;
          const py = Math.sin(a) * 44;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#223146';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#4e6b8f';
        ctx.stroke();

        // Glowing cyan reactor core halo + inner crystal
        const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.35, '#7df9ff');
        coreGrad.addColorStop(0.75, '#00c8ff');
        coreGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fillStyle = '#d8fcff';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();
      });

      // 8. Base Buildings (Mindustry-grade armored textures)
      this.units.bld_xp_extractor = makeSprite(160, (ctx) => {
        // Octagonal armored base plate
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(a) * 66;
          const py = Math.sin(a) * 66;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 68);
        g.addColorStop(0, '#223847');
        g.addColorStop(0.65, '#14222f');
        g.addColorStop(1, '#0a111a');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#070b12';
        ctx.stroke();

        // 4 cardinal extraction manifolds with emerald coolant channels
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.rotate(q * Math.PI * 0.5);
          ctx.fillStyle = '#0e1722';
          ctx.fillRect(20, -13, 38, 26);
          ctx.strokeStyle = '#334d63';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(20, -13, 38, 26);
          ctx.fillStyle = '#22ffa6';
          ctx.fillRect(24, -4, 28, 8);
          // Hazard tip
          ctx.fillStyle = '#ffb838';
          ctx.fillRect(52, -10, 5, 6);
          ctx.fillRect(52, 4, 5, 6);
          ctx.restore();
        }

        // Diagonal armor brackets + bolts
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.rotate(q * Math.PI * 0.5 + Math.PI * 0.25);
          ctx.fillStyle = '#1f3042';
          ctx.fillRect(36, -11, 20, 22);
          ctx.strokeStyle = '#090e16';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(36, -11, 20, 22);
          ctx.fillStyle = '#7df9ff';
          ctx.fillRect(42, -2, 4, 4);
          ctx.restore();
        }

        // Inner chamber ring
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#101b27';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#22ffa6';
        ctx.stroke();

        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.4, '#7dffcb');
        cg.addColorStop(1, 'rgba(34, 255, 166, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
      });

      this.units.bld_matter_synth = makeSprite(160, (ctx) => {
        // Heavy hexagonal forge chassis
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const px = Math.cos(a) * 66;
          const py = Math.sin(a) * 66;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 66);
        g.addColorStop(0, '#382c3e');
        g.addColorStop(0.65, '#221c29');
        g.addColorStop(1, '#100d15');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#08060c';
        ctx.stroke();

        // 6 radiator fins + amber plasma conduits
        for (let k = 0; k < 6; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI) / 3 + Math.PI / 6);
          ctx.fillStyle = '#181420';
          ctx.fillRect(24, -9, 32, 18);
          ctx.strokeStyle = '#4f415c';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(24, -9, 32, 18);
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(27, -3, 24, 6);
          ctx.restore();
        }

        // Inner containment hexagon
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + Math.PI / 6;
          const px = Math.cos(a) * 29;
          const py = Math.sin(a) * 29;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#1a1421';
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#ffd166';
        ctx.stroke();

        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
        cg.addColorStop(0, '#fff7d6');
        cg.addColorStop(0.45, '#ffd166');
        cg.addColorStop(1, 'rgba(255, 209, 102, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
      });

      this.units.bld_repair_pylon = makeSprite(160, (ctx) => {
        // Armored circular foundation
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 64);
        g.addColorStop(0, '#233b56');
        g.addColorStop(0.7, '#152538');
        g.addColorStop(1, '#0b131f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 64, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#070c14';
        ctx.stroke();

        // 4 heavy shield emitter bastions
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.rotate(q * Math.PI * 0.5);
          ctx.fillStyle = '#1d3048';
          ctx.fillRect(18, -16, 44, 32);
          ctx.strokeStyle = '#4c75a1';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(18, -16, 44, 32);
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(24, -4, 32, 8);
          ctx.fillStyle = '#22ffa6';
          ctx.fillRect(50, -12, 6, 4);
          ctx.fillRect(50, 8, 6, 4);
          ctx.restore();
        }

        // Central diamond emitter core
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(28, 0);
        ctx.lineTo(0, 28);
        ctx.lineTo(-28, 0);
        ctx.closePath();
        ctx.fillStyle = '#14263b';
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();

        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.45, '#7df9ff');
        cg.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
      });

      this.units.bld_xp_beacon = makeSprite(160, (ctx) => {
        // Dark titanium base ring
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 62);
        g.addColorStop(0, '#2d234a');
        g.addColorStop(0.7, '#1a1430');
        g.addColorStop(1, '#0d0a1a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#070510';
        ctx.stroke();

        // 3 tri-wing phase dish pylons
        for (let k = 0; k < 3; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI * 2) / 3 - Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(16, -15);
          ctx.lineTo(64, -8);
          ctx.lineTo(64, 8);
          ctx.lineTo(16, 15);
          ctx.closePath();
          ctx.fillStyle = '#241b40';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#6e4fb8';
          ctx.stroke();

          ctx.fillStyle = '#c06cff';
          ctx.fillRect(22, -3, 36, 6);
          ctx.fillStyle = '#7df9ff';
          ctx.fillRect(54, -6, 5, 12);
          ctx.restore();
        }

        // Central singularity lens
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.fillStyle = '#120d24';
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#c06cff';
        ctx.stroke();

        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 19);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.45, '#d79eff');
        cg.addColorStop(1, 'rgba(192, 108, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    drawBase(ctx, base, nowSec, playerInRange, useSprites) {
      if (!base) return;
      ctx.save();

      // Repair zone aura
      const auraGrad = ctx.createRadialGradient(base.x, base.y, 32, base.x, base.y, base.repairRadius);
      auraGrad.addColorStop(0, playerInRange ? 'rgba(34, 255, 166, 0.14)' : 'rgba(0, 240, 255, 0.08)');
      auraGrad.addColorStop(0.7, playerInRange ? 'rgba(34, 255, 166, 0.06)' : 'rgba(0, 240, 255, 0.03)');
      auraGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(base.x, base.y, base.repairRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating dashed perimeter ring
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(nowSec * 0.25);
      ctx.strokeStyle = playerInRange ? 'rgba(34, 255, 166, 0.65)' : 'rgba(0, 240, 255, 0.34)';
      ctx.lineWidth = playerInRange ? 2 : 1.4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, base.repairRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Core structure sprite or octagonal vector fallback
      if (useSprites && this.units.base_core) {
        const half = 74;
        ctx.drawImage(this.units.base_core, base.x - half, base.y - half, 148, 148);
      } else {
        ctx.save();
        ctx.translate(base.x, base.y);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(a) * 62;
          const py = Math.sin(a) * 62;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#152033';
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#7df9ff';
        ctx.fill();
        ctx.restore();
      }

      // Rotating radar sweep ring over core
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(-nowSec * 0.9);
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 48, Math.PI, Math.PI * 1.55);
      ctx.stroke();
      ctx.restore();

      // Labels
      ctx.textAlign = 'center';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText(tr('sprite.baseTitle', null, 'БАЗА // КОМАНДНОЕ ЯДРО'), base.x, base.y - 88);
      if (playerInRange) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#22ffa6';
        ctx.fillText(tr('sprite.baseRepair', null, 'ДОК-РЕМОНТ АКТИВЕН'), base.x, base.y + 98);
      }

      ctx.restore();
    },

    drawBuilding(ctx, b, def, base, nowSec) {
      if (!b || !def) return;
      ctx.save();
      const col = def.color || '#22ffa6';
      const lvl = Math.max(1, b.level || 1);
      const pulse = 0.5 + 0.5 * Math.sin(nowSec * 3.1 + (b.x + b.y) * 0.01);

      // Energy tether to Command Core
      if (base) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.16 + pulse * 0.12;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Moving packet along tether toward base
        const t = (nowSec * 0.45 + (b.x * 0.0013)) % 1;
        const px = b.x + (base.x - b.x) * t;
        const py = b.y + (base.y - b.y) * t;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.translate(b.x, b.y);

      // Soft aura ring
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.1 + pulse * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, 44 + lvl * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Pre-rendered Mindustry-style textured chassis sprite
      const sprite = this.units && this.units[`bld_${b.type}`];
      const drawSz = 82 + (lvl - 1) * 4;
      if (sprite) {
        ctx.drawImage(sprite, -drawSz * 0.5, -drawSz * 0.5, drawSz, drawSz);
      }

      // Animated rotating energy ring & core pulse on top of texture
      ctx.save();
      ctx.rotate(nowSec * (0.75 + lvl * 0.2));
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 38, Math.PI, Math.PI * 1.55);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5 + pulse * 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 4 + pulse * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Level pips below structure
      for (let i = 0; i < lvl; i++) {
        const ox = (i - (lvl - 1) * 0.5) * 9;
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(ox - 2.5, 42, 5, 3.5);
      }

      // Label & live rate
      ctx.textAlign = 'center';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#e2f8ff';
      ctx.fillText(`${def.shortName} [УР.${lvl}]`, 0, -47);

      if (def.rateLabel) {
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = col;
        ctx.fillText(def.rateLabel(lvl), 0, 57);
      }

      ctx.restore();
    },

    drawBuildingGhost(ctx, def, x, y, valid, base, minR, maxR, nowSec) {
      if (!def || !base) return;
      ctx.save();

      // Allowed build zone rings around base
      ctx.strokeStyle = 'rgba(34, 255, 166, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(base.x, base.y, maxR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 107, 107, 0.32)';
      ctx.beginPath();
      ctx.arc(base.x, base.y, minR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost preview at cursor
      const col = valid ? '#22ffa6' : '#ff4d6d';
      const pulse = 0.7 + 0.3 * Math.sin(nowSec * 6);
      ctx.translate(x, y);
      ctx.globalAlpha = 0.65 * pulse;
      const sprite = this.units && this.units[`bld_${def.id}`];
      if (sprite) {
        ctx.drawImage(sprite, -41, -41, 82, 82);
      }
      ctx.fillStyle = valid ? 'rgba(34, 255, 166, 0.14)' : 'rgba(255, 77, 109, 0.22)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.textAlign = 'center';
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = col;
      ctx.fillText(valid ? `ЛКМ: ${def.name}` : 'НЕЛЬЗЯ ПОСТРОИТЬ ЗДЕСЬ', 0, -49);
      ctx.restore();
    },

    drawAnomaly(ctx, anomaly, nowSec, isNear) {
      if (!anomaly) return;
      ctx.save();
      const { x, y, radius, color, tier, name, cleared, enterProgress, wavesTotal, hasBoss } = anomaly;

      if (cleared) {
        ctx.strokeStyle = 'rgba(34, 255, 166, 0.34)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(34, 255, 166, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(34, 255, 166, 0.72)';
        const clearedLabel = anomaly.respawnTimer > 0
          ? tr('sprite.anomClearedTimer', { s: Math.ceil(anomaly.respawnTimer) }, `СТАБИЛИЗИРОВАНА • ${Math.ceil(anomaly.respawnTimer)}с`)
          : tr('sprite.anomCleared', null, 'СТАБИЛИЗИРОВАНА');
        ctx.fillText(clearedLabel, x, y + radius * 0.72 + 16);
        ctx.restore();
        return;
      }

      // Colored radial halo
      const haloGrad = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 1.9);
      haloGrad.addColorStop(0, this._hexRgba(color, 0.28));
      haloGrad.addColorStop(0.55, this._hexRgba(color, 0.12));
      haloGrad.addColorStop(1, this._hexRgba(color, 0));
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Two counter-rotating fracture rings
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(nowSec * 0.7);
      ctx.strokeStyle = this._hexRgba(color, 0.75);
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-nowSec * 1.15);
      ctx.strokeStyle = this._hexRgba(color, 0.55);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      // 6 rotating energy rift arcs
      ctx.setLineDash([]);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.58, a, a + 0.38);
        ctx.stroke();
      }
      ctx.restore();

      // Dark void center with pulsing rim
      const pulse = 0.88 + 0.12 * Math.sin(nowSec * 4.5 + x * 0.01);
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.36 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#04020a';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Circular entry charge progress arc
      if (enterProgress > 0.01) {
        const prog = Math.min(1, enterProgress);
        ctx.beginPath();
        ctx.arc(x, y, radius + 9, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * prog);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tr('sprite.anomEnter', { pct: Math.round(prog * 100) }, `ВХОД ${Math.round(prog * 100)}%`), x, y + 4);
      }

      // Labels
      ctx.textAlign = 'center';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(`[T${tier}] ${name}`, x, y - radius - 14);
      if (isNear) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#e2f6ff';
        const bossTxt = hasBoss ? tr('sprite.anomBossTag', null, ' • БОСС') : '';
        ctx.fillText(tr('sprite.anomInfo', { waves: wavesTotal, boss: bossTxt }, `${wavesTotal} ВОЛН${bossTxt} • ЗАЛЕТИТЕ В РАЗЛОМ`), x, y + radius + 24);
      }

      ctx.restore();
    },

    drawExitPortal(ctx, portal, nowSec) {
      if (!portal) return;
      ctx.save();
      const { x, y, radius, progress } = portal;

      const grad = ctx.createRadialGradient(x, y, 8, x, y, radius * 1.75);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      grad.addColorStop(0.35, 'rgba(34, 255, 166, 0.38)');
      grad.addColorStop(1, 'rgba(34, 255, 166, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(nowSec * 1.2);
      ctx.strokeStyle = '#22ffa6';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([14, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-nowSec * 1.8);
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, radius * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#a7ffdf';
      ctx.fill();

      if (progress > 0.01) {
        const prog = Math.min(1, progress);
        ctx.beginPath();
        ctx.arc(x, y, radius + 9, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * prog);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22ffa6';
      ctx.fillText(tr('sprite.exitTitle', null, 'ПОРТАЛ ВЫХОДА [T]'), x, y - radius - 14);
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#d8ecff';
      ctx.fillText(tr('sprite.exitSub', null, 'ВОЗВРАТ В МИР'), x, y + radius + 20);

      ctx.restore();
    }
  };

  SG.Sprites = Sprites;
})(window.SG);
