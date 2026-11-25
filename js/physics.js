// SINGULARIS — Relativistic Spacetime Grid, Particle Pool & Trajectory Physics
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  class SpacetimeGrid {
    constructor(width, height, spacing = 38) {
      this.spacing = spacing;
      this.enabled = true;
      this.worldX = -spacing;
      this.worldY = -spacing;
      this.resize(width, height);
    }

    setSpacing(spacing) {
      if (this.spacing === spacing) return;
      this.spacing = spacing;
      this.resize(this.width, this.height);
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      const s = this.spacing;
      this.cols = Math.ceil(width / s) + 3;
      this.rows = Math.ceil(height / s) + 3;
      const curCamX = this.worldX + s;
      const curCamY = this.worldY + s;
      this.worldX = Math.floor(curCamX / s) * s - s;
      this.worldY = Math.floor(curCamY / s) * s - s;
      this.offsetX = this.worldX;
      this.offsetY = this.worldY;

      const count = this.cols * this.rows;
      this.rx = new Float32Array(count);
      this.ry = new Float32Array(count);
      this.px = new Float32Array(count);
      this.py = new Float32Array(count);
      this.vx = new Float32Array(count);
      this.vy = new Float32Array(count);
      this.strain = new Float32Array(count);
      this.hueShift = new Float32Array(count);

      this._spx = new Float32Array(count);
      this._spy = new Float32Array(count);
      this._svx = new Float32Array(count);
      this._svy = new Float32Array(count);
      this._sstrain = new Float32Array(count);
      this._shue = new Float32Array(count);

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const i = r * this.cols + c;
          const x = this.offsetX + c * s;
          const y = this.offsetY + r * s;
          this.rx[i] = x;
          this.ry[i] = y;
          this.px[i] = x;
          this.py[i] = y;
        }
      }
    }

    setViewOrigin(camX, camY) {
      const s = this.spacing;
      const newWX = Math.floor(camX / s) * s - s;
      const newWY = Math.floor(camY / s) * s - s;
      if (newWX === this.worldX && newWY === this.worldY) return;

      const dc = Math.round((newWX - this.worldX) / s);
      const dr = Math.round((newWY - this.worldY) / s);
      const cols = this.cols;
      const rows = this.rows;

      this.worldX = newWX;
      this.worldY = newWY;
      this.offsetX = newWX;
      this.offsetY = newWY;

      if (Math.abs(dc) >= cols - 2 || Math.abs(dr) >= rows - 2) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const x = newWX + c * s;
            const y = newWY + r * s;
            this.rx[i] = x;
            this.ry[i] = y;
            this.px[i] = x;
            this.py[i] = y;
            this.vx[i] = 0;
            this.vy[i] = 0;
            this.strain[i] = 0;
            this.hueShift[i] = 0;
          }
        }
        return;
      }

      this._spx.set(this.px);
      this._spy.set(this.py);
      this._svx.set(this.vx);
      this._svy.set(this.vy);
      this._sstrain.set(this.strain);
      this._shue.set(this.hueShift);

      for (let r = 0; r < rows; r++) {
        const srcR = r + dr;
        const rowOff = r * cols;
        for (let c = 0; c < cols; c++) {
          const i = rowOff + c;
          const restX = newWX + c * s;
          const restY = newWY + r * s;
          this.rx[i] = restX;
          this.ry[i] = restY;

          const srcC = c + dc;
          if (srcR >= 1 && srcR < rows - 1 && srcC >= 1 && srcC < cols - 1 && r >= 1 && r < rows - 1 && c >= 1 && c < cols - 1) {
            const si = srcR * cols + srcC;
            this.px[i] = this._spx[si];
            this.py[i] = this._spy[si];
            this.vx[i] = this._svx[si];
            this.vy[i] = this._svy[si];
            this.strain[i] = this._sstrain[si];
            this.hueShift[i] = this._shue[si];
          } else {
            this.px[i] = restX;
            this.py[i] = restY;
            this.vx[i] = 0;
            this.vy[i] = 0;
            this.strain[i] = 0;
            this.hueShift[i] = 0;
          }
        }
      }
    }

    // Apply attractive (force < 0) or repulsive (force > 0) radial impulse/field
    applyRadialForce(cx, cy, strength, radius, hue = 195) {
      const r2Max = radius * radius;
      const cols = this.cols;
      const rows = this.rows;
      const cMin = Math.max(1, Math.floor((cx - radius - this.offsetX) / this.spacing));
      const cMax = Math.min(cols - 2, Math.ceil((cx + radius - this.offsetX) / this.spacing));
      const rMin = Math.max(1, Math.floor((cy - radius - this.offsetY) / this.spacing));
      const rMax = Math.min(rows - 2, Math.ceil((cy + radius - this.offsetY) / this.spacing));

      for (let r = rMin; r <= rMax; r++) {
        const rowOff = r * cols;
        for (let c = cMin; c <= cMax; c++) {
          const i = rowOff + c;
          const dx = this.px[i] - cx;
          const dy = this.py[i] - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2Max && d2 > 4) {
            const dist = Math.sqrt(d2);
            const falloff = 1 - dist / radius;
            const f = (strength * falloff * falloff) / dist;
            this.vx[i] += dx * f;
            this.vy[i] += dy * f;
            const sVal = Math.min(1.6, Math.abs(strength) * 0.00045 * falloff);
            if (sVal > this.strain[i]) {
              this.strain[i] = sVal;
              this.hueShift[i] = hue;
            }
          }
        }
      }
    }

    update(dt) {
      const cols = this.cols;
      const rows = this.rows;
      const anchorStiff = 28.0;
      const neighborStiff = 9.5;
      const damp = Math.pow(0.035, dt);

      // Neighbor coupling + anchor restoration
      for (let r = 1; r < rows - 1; r++) {
        const rowOff = r * cols;
        for (let c = 1; c < cols - 1; c++) {
          const i = rowOff + c;
          // Anchor spring
          let ax = (this.rx[i] - this.px[i]) * anchorStiff;
          let ay = (this.ry[i] - this.py[i]) * anchorStiff;

          // 4-neighbor Laplacian smoothing for wave propagation
          const avgX = 0.25 * (this.px[i - 1] + this.px[i + 1] + this.px[i - cols] + this.px[i + cols]);
          const avgY = 0.25 * (this.py[i - 1] + this.py[i + 1] + this.py[i - cols] + this.py[i + cols]);
          const restAvgX = this.rx[i];
          const restAvgY = this.ry[i];

          ax += ((avgX - this.px[i]) - (restAvgX - this.rx[i])) * neighborStiff;
          ay += ((avgY - this.py[i]) - (restAvgY - this.ry[i])) * neighborStiff;

          this.vx[i] = (this.vx[i] + ax * dt) * damp;
          this.vy[i] = (this.vy[i] + ay * dt) * damp;
        }
      }

      const maxDisp = this.spacing * 1.45;
      const maxDisp2 = maxDisp * maxDisp;

      for (let r = 1; r < rows - 1; r++) {
        const rowOff = r * cols;
        for (let c = 1; c < cols - 1; c++) {
          const i = rowOff + c;
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;

          const dx = this.px[i] - this.rx[i];
          const dy = this.py[i] - this.ry[i];
          const d2 = dx * dx + dy * dy;
          if (d2 > maxDisp2) {
            const scale = maxDisp / Math.sqrt(d2);
            this.px[i] = this.rx[i] + dx * scale;
            this.py[i] = this.ry[i] + dy * scale;
          }
          const dispNorm = Math.min(1.2, Math.sqrt(d2) / (this.spacing * 0.75));
          this.strain[i] = Math.max(dispNorm * 0.85, this.strain[i] * Math.pow(0.12, dt));
        }
      }
    }

    render(ctx, timeScale = 1, quality = 'high') {
      const cols = this.cols;
      const rows = this.rows;

      // Pass 1: Quiet base grid in a single batched path (super fast)
      ctx.lineWidth = 1;
      ctx.strokeStyle = timeScale < 0.7
        ? 'rgba(95, 130, 255, 0.16)'
        : 'rgba(42, 78, 138, 0.16)';
      ctx.beginPath();
      for (let r = 1; r < rows - 1; r++) {
        const rowOff = r * cols;
        ctx.moveTo(this.px[rowOff + 1], this.py[rowOff + 1]);
        for (let c = 2; c < cols - 1; c++) {
          const i = rowOff + c;
          ctx.lineTo(this.px[i], this.py[i]);
        }
      }
      for (let c = 1; c < cols - 1; c++) {
        ctx.moveTo(this.px[cols + c], this.py[cols + c]);
        for (let r = 2; r < rows - 1; r++) {
          const i = r * cols + c;
          ctx.lineTo(this.px[i], this.py[i]);
        }
      }
      ctx.stroke();

      if (quality === 'low') return;

      // Pass 2: Strained/warped segments batched into 4 hue buckets (at most 4 draw calls!)
      const buckets = [[], [], [], []]; // cyan, violet, gold, crimson
      for (let r = 1; r < rows - 2; r++) {
        const rowOff = r * cols;
        for (let c = 1; c < cols - 2; c++) {
          const i = rowOff + c;
          const s = this.strain[i];
          if (s > 0.14) {
            const hue = this.hueShift[i] || 195;
            let bIdx = 0;
            if (hue >= 315 || hue < 20) bIdx = 3;
            else if (hue < 90) bIdx = 2;
            else if (hue >= 245) bIdx = 1;
            buckets[bIdx].push(i);
          }
        }
      }

      const styles = [
        'rgba(0, 240, 255, 0.45)',
        'rgba(185, 92, 255, 0.48)',
        'rgba(255, 184, 56, 0.46)',
        'rgba(255, 59, 107, 0.48)'
      ];
      ctx.lineWidth = 1.45;
      for (let b = 0; b < 4; b++) {
        const list = buckets[b];
        if (list.length === 0) continue;
        ctx.strokeStyle = styles[b];
        ctx.beginPath();
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          ctx.moveTo(this.px[i], this.py[i]);
          ctx.lineTo(this.px[i + 1], this.py[i + 1]);
          ctx.moveTo(this.px[i], this.py[i]);
          ctx.lineTo(this.px[i + cols], this.py[i + cols]);
        }
        ctx.stroke();
      }
    }
  }

  class ParticleSystem {
    constructor(maxParticles = 1200) {
      this.max = maxParticles;
      this.spawnScale = 1.0;
      this.cursor = 0;
      this.particles = [];
      this.shockwaves = [];
      this.texts = [];
      this.lightnings = [];
    }

    setMaxParticles(max) {
      this.max = Math.max(40, max);
      if (this.particles.length > this.max) {
        this.particles.length = this.max;
      }
      this.cursor = this.cursor % this.max;
    }

    clear() {
      this.particles.length = 0;
      this.shockwaves.length = 0;
      this.texts.length = 0;
      this.lightnings.length = 0;
      this.cursor = 0;
    }

    spawn(x, y, vx, vy, opts = {}) {
      const pObj = {
        x,
        y,
        vx,
        vy,
        size: opts.size || 2.5,
        life: opts.life || 0.6,
        maxLife: opts.life || 0.6,
        color: opts.color || '#00f0ff',
        drag: opts.drag !== undefined ? opts.drag : 2.2,
        streak: !!opts.streak,
        gravScale: opts.gravScale !== undefined ? opts.gravScale : 0.45
      };
      if (this.particles.length >= this.max) {
        this.particles[this.cursor] = pObj;
        this.cursor = (this.cursor + 1) % this.max;
      } else {
        this.particles.push(pObj);
      }
    }

    burst(x, y, count, color, speedMin = 60, speedMax = 280, life = 0.65, streak = true) {
      const scaled = Math.max(1, Math.round(count * this.spawnScale));
      for (let i = 0; i < scaled; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speedMin + Math.random() * (speedMax - speedMin);
        this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
          size: 1.6 + Math.random() * 2.8,
          life: life * (0.55 + Math.random() * 0.7),
          color,
          streak,
          drag: 1.8 + Math.random() * 1.8
        });
      }
    }

    addShockwave(x, y, maxRadius, color = '#00f0ff', duration = 0.48, lineWidth = 3) {
      this.shockwaves.push({
        x, y, radius: 6, maxRadius, color, life: duration, maxLife: duration, lineWidth
      });
    }

    addText(x, y, text, color = '#ffffff', scale = 1.0, life = 1.05) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({
        x,
        y,
        vy: -48 - scale * 14,
        text,
        color,
        scale,
        life,
        maxLife: life
      });
    }

    addLightning(x1, y1, x2, y2, color = '#7df9ff', duration = 0.18) {
      const segs = 7;
      const pts = [{ x: x1, y: y1 }];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const jitter = (Math.random() - 0.5) * Math.min(34, len * 0.24);
        pts.push({
          x: x1 + dx * t + nx * jitter,
          y: y1 + dy * t + ny * jitter
        });
      }
      pts.push({ x: x2, y: y2 });
      this.lightnings.push({ pts, color, life: duration, maxLife: duration });
    }

    update(dt, wells) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles[i] = this.particles[this.particles.length - 1];
          this.particles.pop();
          continue;
        }
        if (wells && p.gravScale > 0) {
          for (let w = 0; w < wells.length; w++) {
            const well = wells[w];
            const dx = well.x - p.x;
            const dy = well.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < well.influenceRadius * well.influenceRadius && d2 > 64) {
              const dist = Math.sqrt(d2);
              const pull = (well.polarity * well.mass * 0.55 * p.gravScale) / Math.max(900, d2);
              p.vx += (dx / dist) * pull * dt;
              p.vy += (dy / dist) * pull * dt;
            }
          }
        }
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life -= dt;
        if (sw.life <= 0) {
          this.shockwaves.splice(i, 1);
          continue;
        }
        const progress = 1 - sw.life / sw.maxLife;
        const eased = 1 - Math.pow(1 - progress, 3);
        sw.radius = 6 + (sw.maxRadius - 6) * eased;
      }

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        if (t.life <= 0) {
          this.texts.splice(i, 1);
          continue;
        }
        t.y += t.vy * dt;
        t.vy *= Math.exp(-2.4 * dt);
      }

      for (let i = this.lightnings.length - 1; i >= 0; i--) {
        this.lightnings[i].life -= dt;
        if (this.lightnings[i].life <= 0) this.lightnings.splice(i, 1);
      }
    }

    render(ctx, opts = {}) {
      const skipParticles = !!opts.skipParticles;
      const onlyTexts = !!opts.onlyTexts;
      const fastMode = !!opts.fastMode;

      if (!onlyTexts) {
        ctx.save();
        if (!fastMode) {
          ctx.globalCompositeOperation = 'lighter';
        }

        // Particles (skipped on 2D overlay when GPU WebGL already rendered them!)
        if (!skipParticles) {
          for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            if (p.streak) {
              ctx.strokeStyle = p.color;
              ctx.lineWidth = p.size;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - p.vx * 0.028, p.y - p.vy * 0.028);
              ctx.stroke();
            } else if (fastMode) {
              const s = p.size * (0.4 + 0.6 * alpha);
              ctx.fillStyle = p.color;
              ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Shockwaves
        for (let i = 0; i < this.shockwaves.length; i++) {
          const sw = this.shockwaves[i];
          const alpha = Math.max(0, sw.life / sw.maxLife);
          ctx.globalAlpha = alpha * 0.85;
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = sw.lineWidth * alpha + 0.8;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Lightning arcs
        for (let i = 0; i < this.lightnings.length; i++) {
          const l = this.lightnings[i];
          const alpha = Math.max(0, l.life / l.maxLife);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 2.6 * alpha + 0.8;
          ctx.beginPath();
          ctx.moveTo(l.pts[0].x, l.pts[0].y);
          for (let k = 1; k < l.pts.length; k++) {
            ctx.lineTo(l.pts[k].x, l.pts[k].y);
          }
          ctx.stroke();
        }

        ctx.restore();
      }

      // Combat floating texts
      if (this.texts.length > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        const startIdx = fastMode ? Math.max(0, this.texts.length - 14) : 0;
        for (let i = startIdx; i < this.texts.length; i++) {
          const t = this.texts[i];
          const alpha = Math.min(1, (t.life / t.maxLife) * 1.45);
          ctx.globalAlpha = alpha;
          const px = Math.round(13 * t.scale);
          ctx.font = `700 ${px}px "JetBrains Mono", "Fira Code", system-ui, sans-serif`;
          if (!fastMode) {
            ctx.fillStyle = '#050814';
            ctx.fillText(t.text, t.x + 1, t.y + 1);
          }
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
      }
    }
  }

  // Forward-integrates projectile acceleration through active gravity wells for preview & AI!
  function computeCurvedTrajectory(startX, startY, vx, vy, wells, bounds, steps = 38, stepDt = 0.018, bounces = 0) {
    const pts = [{ x: startX, y: startY, boosted: false }];
    let x = startX;
    let y = startY;
    let cvx = vx;
    let cvy = vy;
    let boosted = false;
    let remBounces = bounces;

    for (let s = 0; s < steps; s++) {
      for (let w = 0; w < wells.length; w++) {
        const well = wells[w];
        const dx = well.x - x;
        const dy = well.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < well.influenceRadius * well.influenceRadius && d2 > 144) {
          const dist = Math.sqrt(d2);
          const gravMult = well.gravMult || 1.0;
          const accel = (well.polarity * well.mass * 11.5 * gravMult) / Math.max(2200, d2);
          cvx += (dx / dist) * accel * stepDt;
          cvy += (dy / dist) * accel * stepDt;
          if (dist < well.slingshotRadius) {
            boosted = true;
            // Tangential orbital whip boost
            const speed = Math.hypot(cvx, cvy) || 1;
            cvx += (cvx / speed) * 210 * stepDt;
            cvy += (cvy / speed) * 210 * stepDt;
          }
          const curSp = Math.hypot(cvx, cvy);
          if (curSp > 1350) {
            cvx = (cvx / curSp) * 1350;
            cvy = (cvy / curSp) * 1350;
          }
        }
      }
      x += cvx * stepDt;
      y += cvy * stepDt;

      if (x < 10 || x > bounds.width - 10) {
        if (remBounces > 0) {
          cvx = -cvx;
          x = Math.max(10, Math.min(bounds.width - 10, x));
          remBounces--;
        } else {
          pts.push({ x, y, boosted });
          break;
        }
      }
      if (y < 10 || y > bounds.height - 10) {
        if (remBounces > 0) {
          cvy = -cvy;
          y = Math.max(10, Math.min(bounds.height - 10, y));
          remBounces--;
        } else {
          pts.push({ x, y, boosted });
          break;
        }
      }
      pts.push({ x, y, boosted });
    }
    return pts;
  }

  // Exact quadratic lead-target solver: finds direction to hit moving target (tx,ty)+(tvx,tvy)*t with projectile speed S
  function solveInterceptAngle(sx, sy, tx, ty, tvx, tvy, projSpeed) {
    const rx = tx - sx;
    const ry = ty - sy;
    const a = tvx * tvx + tvy * tvy - projSpeed * projSpeed;
    const b = 2 * (rx * tvx + ry * tvy);
    const c = rx * rx + ry * ry;

    let t = -1;
    if (Math.abs(a) < 1e-5) {
      if (Math.abs(b) > 1e-5) t = -c / b;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        if (t1 > 0.01 && t2 > 0.01) t = Math.min(t1, t2);
        else if (t1 > 0.01) t = t1;
        else if (t2 > 0.01) t = t2;
      }
    }
    if (t > 0 && t < 3.5) {
      return Math.atan2(ry + tvy * t, rx + tvx * t);
    }
    return Math.atan2(ry, rx);
  }

  SG.SpacetimeGrid = SpacetimeGrid;
  SG.ParticleSystem = ParticleSystem;
  SG.computeCurvedTrajectory = computeCurvedTrajectory;
  SG.solveInterceptAngle = solveInterceptAngle;
})(window.SG);
