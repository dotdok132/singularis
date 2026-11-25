// SINGULARIS — Entities: Player, Gravity Wells, Projectiles, 6 Enemy AI Archetypes & Bosses
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  class GravityWell {
    constructor(x, y, isRepulsor = false, mods = {}) {
      this.x = x;
      this.y = y;
      this.polarity = isRepulsor ? -1 : 1; // +1 = Black Hole pull, -1 = White Hole push
      this.radiusMult = mods.wellRadiusMult || 1.0;
      this.gravMult = mods.wellGravMult || 1.0;
      this.coreRadius = 18 * this.radiusMult;
      this.slingshotRadius = 74 * this.radiusMult;
      this.influenceRadius = 265 * this.radiusMult;
      this.mass = 340000 * this.radiusMult;
      this.life = 7.2 + (mods.wellLifeBonus || 0);
      this.maxLife = this.life;
      this.phase = Math.random() * Math.PI * 2;
      this.hawkingTick = 0;
      this.orbitCount = 0;
    }

    update(dt, grid, particles) {
      this.life -= dt;
      this.phase += dt * 4.8 * this.polarity;

      // Deform relativistic spacetime mesh continuously!
      const hue = this.polarity > 0 ? 278 : 38;
      grid.applyRadialForce(
        this.x,
        this.y,
        -this.polarity * 640 * dt * 60 * 0.032,
        this.influenceRadius * 0.92,
        hue
      );

      // Spawn swirling accretion disk particles
      if (Math.random() < 0.68) {
        const ang = Math.random() * Math.PI * 2;
        const dist = this.slingshotRadius * (0.65 + Math.random() * 0.95);
        const px = this.x + Math.cos(ang) * dist;
        const py = this.y + Math.sin(ang) * dist;
        const tang = ang + (this.polarity > 0 ? Math.PI * 0.55 : 0);
        const spd = this.polarity > 0 ? 155 : 195;
        particles.spawn(px, py, Math.cos(tang) * spd, Math.sin(tang) * spd, {
          size: 2.1,
          life: 0.48,
          color: this.polarity > 0 ? '#c06cff' : '#ffbe44',
          streak: true,
          gravScale: 0.9
        });
      }
    }

    render(ctx) {
      const alpha = Math.min(1, this.life / 0.8) * Math.min(1, (this.maxLife - this.life + 0.12) * 5);
      ctx.save();
      ctx.translate(this.x, this.y);

      const isPull = this.polarity > 0;
      const primary = isPull ? '#b95cff' : '#ffb838';
      const accent = isPull ? '#00f0ff' : '#fff0b8';

      // Outer influence boundary & orbital slingshot ring
      ctx.globalAlpha = alpha * 0.22;
      ctx.strokeStyle = primary;
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.slingshotRadius, this.phase * 0.25, this.phase * 0.25 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Accretion glow radial gradient
      const grad = ctx.createRadialGradient(0, 0, this.coreRadius * 0.5, 0, 0, this.slingshotRadius * 1.18);
      if (isPull) {
        grad.addColorStop(0, 'rgba(5, 2, 14, 0.98)');
        grad.addColorStop(0.26, 'rgba(185, 92, 255, 0.72)');
        grad.addColorStop(0.55, 'rgba(0, 240, 255, 0.22)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 250, 225, 0.96)');
        grad.addColorStop(0.32, 'rgba(255, 180, 50, 0.58)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.slingshotRadius * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // Swirling photon-sphere arcs
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.1;
      for (let k = 0; k < 3; k++) {
        const a0 = this.phase + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.coreRadius * 1.22, a0, a0 + 1.15);
        ctx.stroke();
      }

      // Event horizon core
      ctx.fillStyle = isPull ? '#04020a' : '#fff9e6';
      ctx.beginPath();
      ctx.arc(0, 0, this.coreRadius * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Remaining duration ring
      const lifeRatio = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.coreRadius * 1.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio);
      ctx.stroke();

      ctx.restore();
    }
  }

  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = 15;
      this.aimAngle = 0;
      this.hp = 100;
      this.maxHp = 100;
      this.shield = 60;
      this.maxShield = 60;
      this.shieldRegenDelay = 0;

      this.chrono = 100;
      this.maxChrono = 100;
      this.bulletTimeActive = false;

      this.fireCooldown = 0;
      this.rewindCooldown = 0;
      this.wellCooldown = 0;
      this.detonateCooldown = 0;
      this.dashCooldown = 0;
      this.invulnTimer = 0;

      this.mods = SG.createDefaultMods();
      this.history = []; // Ring buffer for 3.0s Temporal Rewind
      this.historyAcc = 0;
      this.afterimages = [];
      this.drones = [];
      this.clones = [];
      this.auraPhase = 0;
      this.stormTimer = 0;
      this.repulseTimer = 0;
      this.aegisCooldown = 0;
      this.novaTimer = 0;
      this.droneFireTimer = 0;
      this.empTimer = 0;
      this.flareTimer = 0;
      this.autoWellTimer = 4.0;
      this.autoCloneTimer = 5.0;
      this.adaptiveTimer = 0;
      this.antimatterTimer = 0;
      this.afterburnTimer = 0;
      this.wasBulletTime = false;
      this.justEnteredBulletTime = false;
      this.beamTarget = null;
      this.beamTargets = [];
      this.inSanctuary = false;
      this.shotCounter = 0;
      this.healBuffer = 0;
      this.coronaNovaTimer = 0;
      this.chronoLanceTimer = 0;
      this.starVolleyCounter = 0;
    }

    rebuildDrones() {
      this.drones = [];
      const count = this.mods.drones;
      const dualRing = this.mods.evoDronesOverdrive > 0 && count >= 4;
      for (let i = 0; i < count; i++) {
        this.drones.push({
          angle: (i * Math.PI * 2) / count,
          dist: dualRing ? (i % 2 === 0 ? 44 : 66) : 48,
          hitCooldown: 0
        });
      }
    }

    recordState(dt) {
      this.historyAcc += dt;
      if (this.historyAcc >= 0.033) {
        this.historyAcc = 0;
        this.history.push({
          x: this.x,
          y: this.y,
          vx: this.vx,
          vy: this.vy,
          hp: this.hp,
          shield: this.shield,
          angle: this.aimAngle
        });
        if (this.history.length > 95) {
          this.history.shift();
        }
      }
    }

    triggerRewind(particles, audio, grid, game) {
      if (this.rewindCooldown > 0 || this.history.length < 12) return false;
      const startX = this.x;
      const startY = this.y;
      const snap = this.history[0];

      // Spawn Paradox Clones at departure point (3 in a triangle if evoRewindArmy unlocked!)
      if (this.mods.evoRewindArmy > 0) {
        for (let ci = 0; ci < 3; ci++) {
          const ca = (ci * Math.PI * 2) / 3;
          this.clones.push({
            x: startX + Math.cos(ca) * 34,
            y: startY + Math.sin(ca) * 34,
            life: 8.5,
            fireTimer: 0.08 + ci * 0.04,
            isApexClone: true
          });
        }
      } else if (this.mods.paradoxClone > 0) {
        this.clones.push({
          x: startX,
          y: startY,
          life: 6.0,
          fireTimer: 0.1
        });
      }

      // Draw temporal trail along history
      for (let i = 0; i < this.history.length; i += 3) {
        const h = this.history[i];
        this.afterimages.push({
          x: h.x,
          y: h.y,
          angle: h.angle,
          alpha: 0.65,
          color: '#00f0ff'
        });
      }

      this.x = snap.x;
      this.y = snap.y;
      this.vx = snap.vx * 0.4;
      this.vy = snap.vy * 0.4;
      this.hp = Math.max(this.hp, snap.hp);
      this.shield = Math.max(this.shield, snap.shield);
      this.invulnTimer = 0.85;
      this.rewindCooldown = 9.0 * this.mods.rewindCdMult;
      this.history.length = 0;

      // Temporal Paradox Blast at both departure and arrival points
      if (this.mods.rewindBlastLevel > 0 && game) {
        const blastR = 175 + this.mods.rewindBlastLevel * 35;
        const blastDmg = Math.round(90 * this.mods.rewindBlastLevel * this.mods.damageMult);
        const pts = [{ x: startX, y: startY }, { x: this.x, y: this.y }];
        for (const pt of pts) {
          particles.addShockwave(pt.x, pt.y, blastR, '#7df9ff', 0.45, 3.6);
          particles.burst(pt.x, pt.y, 20, '#00f0ff', 70, 260, 0.5, true);
          for (let ei = game.enemies.length - 1; ei >= 0; ei--) {
            const en = game.enemies[ei];
            if (!en.dead && Math.hypot(en.x - pt.x, en.y - pt.y) <= blastR + en.radius) {
              game.damageEnemy(en, blastDmg, '#7df9ff', 'ПАРАДОКС!');
            }
          }
        }
      }

      particles.addShockwave(this.x, this.y, 175, '#00f0ff', 0.45, 3.5);
      particles.burst(this.x, this.y, 32, '#00f0ff', 90, 320, 0.6, true);
      particles.addText(this.x, this.y - 26, 'ПЕРЕМОТКА ВРЕМЕНИ!', '#7df9ff', 1.18, 1.2);
      grid.applyRadialForce(this.x, this.y, 950, 210, 188);
      audio.playRewind();
      return true;
    }

    triggerDash(moveX, moveY, bounds, particles, audio, grid, game) {
      if (this.dashCooldown > 0) return false;
      this.dashCooldown = 2.8 / Math.max(0.7, this.mods.moveSpeedMult);

      let dx = moveX;
      let dy = moveY;
      const mLen = Math.hypot(dx, dy);
      if (mLen > 0.1) {
        dx /= mLen;
        dy /= mLen;
      } else {
        dx = Math.cos(this.aimAngle);
        dy = Math.sin(this.aimAngle);
      }

      const startX = this.x;
      const startY = this.y;
      const stepDist = 92;
      const pad = this.radius + 8;
      const targetX = Math.max(pad, Math.min(bounds.width - pad, startX + dx * stepDist));
      const targetY = Math.max(pad, Math.min(bounds.height - pad, startY + dy * stepDist));
      const dashAng = Math.atan2(dy, dx);

      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        this.afterimages.push({
          x: startX + (targetX - startX) * t,
          y: startY + (targetY - startY) * t,
          angle: dashAng,
          alpha: 0.58 - i * 0.08,
          color: i % 2 === 0 ? '#00f0ff' : '#22ffa6'
        });
      }

      this.x = targetX;
      this.y = targetY;
      this.vx = dx * 760;
      this.vy = dy * 760;
      this.invulnTimer = Math.max(this.invulnTimer, 0.30);

      particles.addShockwave(this.x, this.y, 85, '#22ffa6', 0.25, 2.2);
      particles.burst(this.x, this.y, 16, '#7df9ff', 60, 220, 0.32, true);
      grid.applyRadialForce(this.x, this.y, 680, 140, 190);
      if (audio && typeof audio.playDash === 'function') audio.playDash();

      if (this.mods.ramLevel > 0 && game) {
        const ramDmg = Math.round(55 * this.mods.ramLevel + this.maxHp * 0.35);
        for (let i = game.enemies.length - 1; i >= 0; i--) {
          const e = game.enemies[i];
          if (!e.dead && Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.radius + 26) {
            e.vx += dx * 480;
            e.vy += dy * 480;
            game.damageEnemy(e, ramDmg, '#22ffa6', 'ФАЗОВЫЙ ТАРАН!');
          }
        }
      }
      return true;
    }

    takeDamage(amount, particles, audio, game) {
      if (this.invulnTimer > 0) return;

      // Quantum Phase Dodge check
      if (this.mods.dodgeChance > 0 && Math.random() < this.mods.dodgeChance) {
        this.invulnTimer = 0.25;
        particles.burst(this.x, this.y, 10, '#7df9ff', 50, 180, 0.3);
        particles.addText(this.x, this.y - 22, 'УКЛОНЕНИЕ!', '#7df9ff', 0.95);
        return;
      }

      // Armor + Fortress + Adaptive Plate + Bullet-Time Armor reduction (capped at 82%)
      const fortRed = (this.mods.fortressLevel > 0 && this.hp / this.maxHp < 0.5)
        ? 0.25 * this.mods.fortressLevel
        : 0;
      const adpRed = (this.adaptiveTimer > 0 && this.mods.adaptiveArmor > 0)
        ? 0.3 * this.mods.adaptiveArmor
        : 0;
      const btRed = (this.bulletTimeActive && this.mods.btArmorLevel > 0)
        ? 0.3 * this.mods.btArmorLevel
        : 0;
      const totalRed = Math.min(0.68, this.mods.armor + fortRed + adpRed + btRed);
      const reducedAmount = Math.max(1, Math.round(amount * (1 - totalRed)));

      if (this.mods.adaptiveArmor > 0) {
        this.adaptiveTimer = 2.5;
      }

      this.shieldRegenDelay = 3.2 / this.mods.shieldRegenMult;
      const prevShield = this.shield;
      let rem = reducedAmount;
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, rem);
        this.shield -= absorbed;
        rem -= absorbed;
        particles.burst(this.x, this.y, 12, '#38bdf8', 70, 210, 0.35);
      }
      if (rem > 0) {
        this.hp = Math.max(0, this.hp - rem);
        particles.burst(this.x, this.y, 22, '#ff3b6b', 90, 280, 0.55);
        particles.addShockwave(this.x, this.y, 95, '#ff3b6b', 0.32, 3);
      }
      if (game) {
        game.damageFlash = rem > 0 ? 1.0 : 0.55;
        game.damageFlashColor = rem > 0 ? 'crimson' : 'cyan';
      }
      if (audio && typeof audio.playPlayerHit === 'function') {
        audio.playPlayerHit(prevShield > 0 && this.shield <= 0);
      }

      // Phoenix Protocol fatal-hit resurrection (+ Eternal Phoenix evolution resets cooldowns & spawns wells)
      if (this.hp <= 0 && this.mods.phoenixCharges > 0) {
        this.mods.phoenixCharges -= 1;
        this.hp = Math.max(1, Math.round(this.maxHp * 0.6));
        this.shield = this.maxShield;
        this.invulnTimer = 2.6;
        if (this.mods.evoPhoenixEternal > 0) {
          this.rewindCooldown = 0;
          this.detonateCooldown = 0;
          this.wellCooldown = 0;
        }
        particles.addShockwave(this.x, this.y, 320, '#ffb838', 0.65, 4.5);
        particles.burst(this.x, this.y, 48, '#ffb838', 110, 380, 0.7, true);
        particles.addText(this.x, this.y - 34, this.mods.evoPhoenixEternal > 0 ? 'БЕССМЕРТНЫЙ ФЕНИКС!' : 'ФЕНИКС: ВОЗРОЖДЕНИЕ!', '#ffb838', 1.32);
        if (game) {
          if (this.mods.evoPhoenixEternal > 0 && typeof SG.GravityWell === 'function') {
            for (const sgn of [-1, 1]) {
              const wx = Math.max(60, Math.min(game.bounds.width - 60, this.x + sgn * 115));
              const wy = Math.max(60, Math.min(game.bounds.height - 60, this.y));
              game.wells.push(new SG.GravityWell(wx, wy, false, this.mods));
            }
          }
          for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            if (!e.dead && Math.hypot(e.x - this.x, e.y - this.y) <= 320 + e.radius) {
              game.damageEnemy(e, Math.round(180 + this.maxHp * 0.8), '#ffb838', 'ФЕНИКС!');
            }
          }
        }
        audio.playExplosion(1.3);
        if (game) game.addScreenShake(12);
        return;
      }

      // Quantum Bastion: cryo-freeze blast on shield break (+ Immortal Aegis bullet clear & 360px freeze)
      if (this.mods.aegisBlast > 0 && prevShield > 0 && this.shield <= 0 && this.aegisCooldown <= 0 && game) {
        const isImmortal = this.mods.evoAegisImmortal > 0;
        const bastionR = isImmortal ? 360 : 260;
        const freezeDur = isImmortal ? 3.5 : 2.2;
        this.aegisCooldown = Math.max(5, 10 - (this.mods.aegisBlast - 1) * 2.5);
        this.invulnTimer = isImmortal ? 2.0 : 1.2;
        particles.addShockwave(this.x, this.y, bastionR, '#7dd3fc', 0.5, 4);
        particles.addText(this.x, this.y - 28, isImmortal ? 'НЕПРОБИВАЕМАЯ ЭГИДА!' : 'КВАНТОВЫЙ БАСТИОН!', '#7dd3fc', 1.2);
        for (let i = 0; i < game.enemies.length; i++) {
          const e = game.enemies[i];
          if (e.dead) continue;
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < bastionR + e.radius) {
            e.stunTimer = Math.max(e.stunTimer, freezeDur);
            e.cryoTimer = Math.max(e.cryoTimer || 0, freezeDur + 0.4);
            e.cryoSlow = Math.max(e.cryoSlow || 0, 0.55);
            e.vx += (dx / d) * 320;
            e.vy += (dy / d) * 320;
          }
        }
        if (isImmortal) {
          for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
            const b = game.bullets[bi];
            if (!b.fromPlayer && Math.hypot(b.x - this.x, b.y - this.y) <= bastionR) {
              game.bullets.splice(bi, 1);
            }
          }
        }
      } else {
        this.invulnTimer = 0.32;
      }

      if (this.mods.thornsLevel > 0 && game && typeof game.triggerThornsBlast === 'function') {
        game.triggerThornsBlast();
      }

      audio.playExplosion(0.8);
      if (game) game.addScreenShake(9);
    }

    update(dt, input, bounds, particles) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.rewindCooldown = Math.max(0, this.rewindCooldown - dt);
      this.wellCooldown = Math.max(0, this.wellCooldown - dt);
      this.detonateCooldown = Math.max(0, this.detonateCooldown - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      this.auraPhase += dt;
      this.stormTimer = Math.max(0, this.stormTimer - dt);
      this.repulseTimer = Math.max(0, this.repulseTimer - dt);
      this.aegisCooldown = Math.max(0, this.aegisCooldown - dt);
      this.novaTimer = Math.max(0, this.novaTimer - dt);
      this.droneFireTimer = Math.max(0, this.droneFireTimer - dt);
      this.empTimer = Math.max(0, this.empTimer - dt);
      this.flareTimer = Math.max(0, this.flareTimer - dt);
      this.autoWellTimer = Math.max(0, this.autoWellTimer - dt);
      this.autoCloneTimer = Math.max(0, this.autoCloneTimer - dt);
      this.adaptiveTimer = Math.max(0, this.adaptiveTimer - dt);
      this.antimatterTimer = Math.max(0, this.antimatterTimer - dt);
      this.afterburnTimer = Math.max(0, this.afterburnTimer - dt);
      this.coronaNovaTimer = Math.max(0, this.coronaNovaTimer - dt);
      this.chronoLanceTimer = Math.max(0, this.chronoLanceTimer - dt);

      // Passive Nano-Regeneration
      if (this.mods.hpRegen > 0 && this.hp < this.maxHp) {
        const gained = Math.min(this.maxHp - this.hp, this.mods.hpRegen * dt);
        this.hp += gained;
        this.healBuffer += gained;
      }

      // Shield recharge (+ Sanctuary Aura + Bullet-Time Armor bonuses)
      const sanctuaryRegen = (this.mods.sanctuaryLevel > 0 && this.inSanctuary) ? 6 * this.mods.sanctuaryLevel : 0;
      const btRegen = (this.bulletTimeActive && this.mods.btArmorLevel > 0) ? 14 * this.mods.btArmorLevel : 0;
      if (sanctuaryRegen + btRegen > 0 && this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + (sanctuaryRegen + btRegen) * dt);
      }
      if (this.shieldRegenDelay > 0) {
        this.shieldRegenDelay -= dt;
      } else if (this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + 9.5 * this.mods.shieldRegenMult * dt);
      }

      // Bullet-time Chrono-Energy management
      if (input.bulletTime && this.chrono > 2) {
        this.bulletTimeActive = true;
        const btDrain = this.mods.evoChronoOverclock > 0 ? 16.5 : 30;
        this.chrono = Math.max(0, this.chrono - btDrain * dt);
        if (this.chrono <= 0.5) this.bulletTimeActive = false;
      } else {
        this.bulletTimeActive = false;
        this.chrono = Math.min(this.maxChrono, this.chrono + 15.5 * this.mods.chronoRegenMult * dt);
      }
      this.justEnteredBulletTime = !this.wasBulletTime && this.bulletTimeActive;
      this.wasBulletTime = this.bulletTimeActive;

      // Movement physics (agile inertial thrusters + optional Berserk / Static Barrier boosts)
      let mx = input.moveX;
      let my = input.moveY;
      const mLen = Math.hypot(mx, my);
      if (mLen > 1) {
        mx /= mLen;
        my /= mLen;
      }

      const vitality = (this.hp + this.shield) / Math.max(1, this.maxHp + this.maxShield);
      const berserkMove = this.mods.berserkLevel > 0 ? 1 + (1 - vitality) * 0.35 * this.mods.berserkLevel : 1;
      const staticBoost = (this.mods.staticBarrier > 0 && this.shield >= this.maxShield * 0.95)
        ? 1 + 0.08 * this.mods.staticBarrier
        : 1;
      const baseAccel = 1950 * this.mods.moveSpeedMult * berserkMove * staticBoost * (input.speedMult || 1);
      this.vx += mx * baseAccel * dt;
      this.vy += my * baseAccel * dt;

      const drag = Math.exp(-5.6 * dt);
      this.vx *= drag;
      this.vy *= drag;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Arena bounds soft bounce
      const pad = this.radius + 8;
      if (this.x < pad) { this.x = pad; this.vx = Math.abs(this.vx) * 0.4; }
      if (this.x > bounds.width - pad) { this.x = bounds.width - pad; this.vx = -Math.abs(this.vx) * 0.4; }
      if (this.y < pad) { this.y = pad; this.vy = Math.abs(this.vy) * 0.4; }
      if (this.y > bounds.height - pad) { this.y = bounds.height - pad; this.vy = -Math.abs(this.vy) * 0.4; }

      this.aimAngle = Math.atan2(input.aimY - this.y, input.aimX - this.x);

      // Thruster exhaust particles
      if (mLen > 0.15 && Math.random() < 0.75) {
        const backAng = Math.atan2(-my, -mx) + (Math.random() - 0.5) * 0.45;
        particles.spawn(
          this.x + Math.cos(backAng) * 12,
          this.y + Math.sin(backAng) * 12,
          Math.cos(backAng) * 130,
          Math.sin(backAng) * 130,
          { size: 2.2, life: 0.25, color: this.bulletTimeActive ? '#b95cff' : '#00f0ff', streak: false, gravScale: 0.2 }
        );
      }

      // Bullet-time afterimage trail
      if (this.bulletTimeActive && Math.random() < 0.45) {
        this.afterimages.push({
          x: this.x,
          y: this.y,
          angle: this.aimAngle,
          alpha: 0.45,
          color: '#9d5cff'
        });
      }

      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].alpha -= dt * 1.8;
        if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
      }

      // Update Lagrange drones
      const droneSpeed = (3.4 * (1 + (this.mods.droneSpeedBonus || 0)) + this.mods.droneTurrets * 1.2) * (this.mods.evoDronesOverdrive > 0 ? 1.6 : 1.0);
      for (let i = 0; i < this.drones.length; i++) {
        const d = this.drones[i];
        d.angle += dt * droneSpeed;
        d.x = this.x + Math.cos(d.angle) * d.dist;
        d.y = this.y + Math.sin(d.angle) * d.dist;
        d.hitCooldown = Math.max(0, d.hitCooldown - dt);
      }

      this.recordState(dt);
    }

    render(ctx, opts = {}) {
      const useSprites = !!(opts.useSprites && SG.Sprites && SG.Sprites.ready);
      const skipAuras = !!opts.skipAuras;

      // Temporal rewind tether anchor indicator (3s ago ghost)
      if (this.history.length > 15 && this.rewindCooldown <= 0) {
        const ghost = this.history[0];
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Afterimages
      for (let i = 0; i < this.afterimages.length; i++) {
        const a = this.afterimages[i];
        if (useSprites) {
          SG.Sprites.drawUnit(ctx, this.bulletTimeActive ? 'player_bt' : 'player', a.x, a.y, a.angle, 44, 0, a.alpha * 0.55);
        } else {
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.angle);
          ctx.globalAlpha = a.alpha;
          ctx.strokeStyle = a.color;
          ctx.lineWidth = 1.8;
          this.traceShipPath(ctx);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Paradox clones
      for (let i = 0; i < this.clones.length; i++) {
        const c = this.clones[i];
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.globalAlpha = Math.min(0.8, c.life * 0.4);
        ctx.strokeStyle = '#00ffa6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 166, 0.25)';
        ctx.fill();
        ctx.restore();
      }

      // Time dilation aura ring
      if (!skipAuras && this.mods.dilationAura > 0) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 145, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Acquired Combat Auras
      if (!skipAuras) {
        this.renderAuras(ctx);
      }

      // Lagrange orbital drones
      for (let i = 0; i < this.drones.length; i++) {
        const d = this.drones[i];
        if (useSprites) {
          SG.Sprites.drawUnit(ctx, 'drone', d.x, d.y, d.angle * 2, 22);
        } else {
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.rotate(d.angle * 2);
          ctx.fillStyle = '#00f0ff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, 5);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-5, -5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Main Player Quantum Ship
      ctx.save();

      // Shield bubble
      if (this.shield > 1) {
        const sRatio = this.shield / this.maxShield;
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.22 + 0.38 * sRatio).toFixed(2)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      const shipAlpha = (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 24) % 2 === 0) ? 0.45 : 1.0;

      if (useSprites) {
        // Subtle thruster flare behind Mindustry ship sprite
        const spd = Math.hypot(this.vx, this.vy);
        if (spd > 25) {
          const glowCol = this.bulletTimeActive ? 'rgba(217, 138, 255, 0.45)' : 'rgba(0, 240, 255, 0.42)';
          ctx.fillStyle = glowCol;
          ctx.beginPath();
          ctx.arc(this.x - Math.cos(this.aimAngle) * 16, this.y - Math.sin(this.aimAngle) * 16, 6 + Math.min(5, spd * 0.015), 0, Math.PI * 2);
          ctx.fill();
        }
        SG.Sprites.drawUnit(ctx, this.bulletTimeActive ? 'player_bt' : 'player', this.x, this.y, this.aimAngle, 46, 0, shipAlpha);
        ctx.restore();
        return;
      }

      ctx.translate(this.x, this.y);
      ctx.rotate(this.aimAngle);
      ctx.globalAlpha = shipAlpha;

      ctx.fillStyle = '#0b1528';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.4;
      this.traceShipPath(ctx);
      ctx.fill();
      ctx.stroke();

      // Glowing Quantum Core
      ctx.fillStyle = this.bulletTimeActive ? '#d98aff' : '#7df9ff';
      ctx.beginPath();
      ctx.arc(1, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    renderAuras(ctx) {
      const m = this.mods;
      const t = this.auraPhase;
      const rMult = getEffectiveAuraMult(m.auraRadiusMult);

      // Solar Corona burn aura
      if (m.coronaRadius > 0) {
        const r = m.coronaRadius * rMult;
        ctx.save();
        const grad = ctx.createRadialGradient(this.x, this.y, 12, this.x, this.y, r);
        grad.addColorStop(0, 'rgba(255, 110, 40, 0.01)');
        grad.addColorStop(0.72, 'rgba(255, 95, 35, 0.11)');
        grad.addColorStop(1, 'rgba(255, 60, 20, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 130, 56, 0.42)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, t * 0.9, t * 0.9 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Cryo-Stasis slow aura
      if (m.cryoRadius > 0) {
        const r = m.cryoRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.36)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, -t * 0.55, -t * 0.55 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Storm Coil lightning aura
      if (m.stormRadius > 0) {
        const r = m.stormRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#7df9ff';
        for (let k = 0; k < 6; k++) {
          const a = t * 1.4 + (k * Math.PI * 2) / 6;
          ctx.beginPath();
          ctx.arc(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Grav-Repulse Mantle deflector aura
      if (m.repulseRadius > 0) {
        const r = m.repulseRadius * rMult;
        ctx.save();
        const pulse = 0.24 + 0.14 * Math.sin(t * 4);
        ctx.strokeStyle = `rgba(192, 108, 255, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Entropy Siphon lifesteal aura
      if (m.entropyRadius > 0) {
        const r = m.entropyRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 59, 107, 0.32)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([14, 6]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, -t * 1.1, -t * 1.1 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Radiation Decay aura
      if (m.radRadius > 0) {
        const r = m.radRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.34)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, t * 0.7, t * 0.7 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Vortex Pull aura
      if (m.vortexPullRadius > 0) {
        const r = m.vortexPullRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, -t * 0.45, -t * 0.45 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Antimatter barrier aura
      if (m.antimatterRadius > 0) {
        const r = m.antimatterRadius * rMult;
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.36)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Quantum Beam continuous plasma rays (up to 3 targets with evoBeamPrism)
      const beams = (this.beamTargets && this.beamTargets.length > 0)
        ? this.beamTargets
        : (this.beamTarget ? [this.beamTarget] : []);
      if (m.beamLevel > 0 && beams.length > 0) {
        ctx.save();
        ctx.strokeStyle = m.evoBeamPrism > 0 ? '#ffd166' : '#7df9ff';
        ctx.lineWidth = 2.5 + m.beamLevel * 0.8;
        ctx.globalAlpha = 0.78;
        for (let bi = 0; bi < beams.length; bi++) {
          const bt = beams[bi];
          if (!bt || bt.dead) continue;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(bt.x, bt.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    traceShipPath(ctx) {
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, 12);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, -12);
      ctx.closePath();
    }
  }

  // Enemy Factory & Behavior System
  const ENEMY_TYPES = {
    swarmer: {
      name: 'Роевик',
      hp: 44,
      speed: 205,
      radius: 12,
      color: '#ff3b6b',
      score: 35,
      xp: 18
    },
    sniper: {
      name: 'Баллистик',
      hp: 76,
      speed: 105,
      radius: 15,
      color: '#ff9e2c',
      score: 75,
      xp: 32
    },
    phalanx: {
      name: 'Эгида',
      hp: 175,
      speed: 82,
      radius: 20,
      color: '#38bdf8',
      score: 110,
      xp: 46
    },
    pulsar: {
      name: 'Пульсар',
      hp: 120,
      speed: 95,
      radius: 17,
      color: '#c06cff',
      score: 95,
      xp: 40
    },
    weaver: {
      name: 'Ткач Разломов',
      hp: 105,
      speed: 130,
      radius: 15,
      color: '#22ffa6',
      score: 90,
      xp: 38
    },
    boss_leviathan: {
      name: 'КРОНОС-ЛЕВИАФАН',
      hp: 5600,
      speed: 162,
      radius: 30,
      color: '#ff2a5f',
      score: 2500,
      xp: 560,
      isBoss: true
    },
    boss_archon: {
      name: 'АРХОНТ ПУСТОТЫ',
      hp: 7600,
      speed: 128,
      radius: 34,
      color: '#ffb838',
      score: 3600,
      xp: 780,
      isBoss: true
    }
  };

  function getEffectiveAuraMult(rawMult) {
    const r = Math.max(1.0, rawMult || 1.0);
    if (r <= 1.45) return r;
    // Smooth diminishing returns above 1.45x (asymptotes toward ~2.15x instead of full-screen 3.5x+)
    return 1.45 + 0.70 * (1 - Math.exp(-(r - 1.45) * 0.9));
  }

  function getEffectiveAuraPower(rawPower) {
    const p = Math.max(0.1, rawPower || 1.0);
    if (p <= 3.0) return p;
    // Gentle diminishing returns above 3.0x stacked aura power
    return 3.0 + Math.pow(p - 3.0, 0.72) * 1.4;
  }

  function createEnemy(typeKey, x, y, waveScale = 1.0, opts = {}) {
    const def = ENEMY_TYPES[typeKey];
    const waveNum = Math.max(1, opts.wave || 1);
    const isElite = !def.isBoss && !!opts.isElite;
    const hpMult = waveScale * (isElite ? 2.8 : 1.0);
    const fireRateMult = (1 + Math.min(1.1, (waveNum - 1) * 0.045)) * (isElite ? 1.22 : 1.0);
    const bulletSpeedMult = 1 + Math.min(0.45, (waveNum - 1) * 0.02);
    const dmgMult = isElite ? 1.3 : 1.0;
    let auraResist = 0;
    if (def.isBoss) {
      auraResist = Math.min(0.65, 0.45 + Math.max(0, waveNum - 5) * 0.015);
    } else if (isElite) {
      auraResist = Math.min(0.68, 0.45 + Math.max(0, waveNum - 4) * 0.015);
    } else {
      auraResist = Math.min(0.45, Math.max(0, (waveNum - 4) * 0.032));
    }

    const e = {
      type: typeKey,
      name: def.name,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: Math.round(def.hp * hpMult),
      maxHp: Math.round(def.hp * hpMult),
      speed: def.speed * (1 + Math.min(0.75, (waveNum - 1) * 0.032)) * (isElite ? 1.18 : 1.0),
      radius: isElite ? Math.round(def.radius * 1.22) : def.radius,
      color: def.color,
      score: Math.round(def.score * (1 + Math.max(0, waveNum - 1) * 0.18) * (isElite ? 2.5 : 1.0)),
      xp: Math.round(def.xp * (1 + Math.max(0, waveNum - 1) * (def.isBoss ? 0.22 : 0.08)) * (isElite ? 1.45 : 1.0)),
      isBoss: !!def.isBoss,
      isElite,
      waveNum,
      fireRateMult,
      bulletSpeedMult,
      dmgMult,
      auraResist,
      bossPhase: 1,
      specialTimer: 3.4,
      dashTimer: 0,
      dashTelegraph: 0,
      dashAngle: 0,
      stunImmuneTimer: 0,
      stateTimer: 1.0 + Math.random() * 1.2,
      chargeTimer: 0,
      stunTimer: 0,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
      wellCollideCd: 0
    };

    // Multi-segment Inverse Kinematics body for Kronos-Leviathan Boss!
    if (typeKey === 'boss_leviathan') {
      e.segments = [];
      for (let s = 0; s < 11; s++) {
        e.segments.push({
          x: x - (s + 1) * 26,
          y,
          angle: 0,
          radius: Math.max(13, 27 - s * 1.2)
        });
      }
    } else if (typeKey === 'boss_archon') {
      e.orbitAngle = 0;
      e.twinDist = 92;
    }

    return e;
  }

  function updateEnemy(e, dt, game) {
    const { player, enemies, wells, bounds, particles, grid, audio } = game;
    e.phase += dt * 3.2;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
    e.wellCollideCd = Math.max(0, e.wellCollideCd - dt);

    if (e.stunImmuneTimer > 0) {
      e.stunImmuneTimer = Math.max(0, e.stunImmuneTimer - dt);
    }
    if ((e.isBoss || e.isElite) && e.stunTimer > 0) {
      if (e.stunImmuneTimer > 0) {
        e.stunTimer = 0;
      } else {
        e.stunTimer = Math.min(e.stunTimer, e.isBoss ? 0.55 : 0.85);
      }
    }

    if (e.stunTimer > 0) {
      e.stunTimer -= e.isBoss ? dt * 2.5 : (e.isElite ? dt * 1.7 : dt);
      if ((e.isBoss || e.isElite) && e.stunTimer <= 0) {
        e.stunTimer = 0;
        e.stunImmuneTimer = e.isBoss ? 4.0 : 1.8;
      }
      e.vx *= Math.exp(-4 * dt);
      e.vy *= Math.exp(-4 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      return;
    }

    // Boss 3-Phase Progression & Enrage Shockwaves
    if (e.isBoss) {
      const hpRatio = e.hp / Math.max(1, e.maxHp);
      const targetPhase = hpRatio <= 0.3 ? 3 : (hpRatio <= 0.65 ? 2 : 1);
      if (targetPhase > (e.bossPhase || 1)) {
        e.bossPhase = targetPhase;
        particles.addShockwave(e.x, e.y, 280, e.color, 0.58, 4.2);
        particles.burst(e.x, e.y, 44, e.color, 100, 360, 0.65, true);
        grid.applyRadialForce(e.x, e.y, 1800, 260, 345);
        particles.addText(
          e.x,
          e.y - e.radius - 26,
          targetPhase === 2 ? 'ФАЗА 2: ПЕРЕГРУЗКА!' : 'ФАЗА 3: КРИТИЧЕСКИЙ КОЛЛАПС!',
          '#ff9e2c',
          1.35,
          2.0
        );
        audio.playBossAlarm();
        if (typeof game.addScreenShake === 'function') game.addScreenShake(10);
        if (typeof game.addHitstop === 'function') game.addHitstop(0.05);
        if (typeof game.spawnBossEscort === 'function') game.spawnBossEscort(e, targetPhase);
      }
    }

    // Apply Gravity Wells to enemies!
    let inWell = false;
    for (let w = 0; w < wells.length; w++) {
      const well = wells[w];
      const dx = well.x - e.x;
      const dy = well.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < well.influenceRadius * well.influenceRadius && d2 > 36) {
        const dist = Math.sqrt(d2);
        const bossResist = e.isBoss ? 0.24 : 1.0;
        const gravScale = well.gravMult || 1.0;
        const pull = (well.polarity * well.mass * 0.92 * bossResist * gravScale) / Math.max(1200, d2);
        e.vx += (dx / dist) * pull * dt;
        e.vy += (dy / dist) * pull * dt;
        if (well.polarity > 0 && player.mods.tidalVortex > 0) {
          const swirl = Math.abs(pull) * 0.55 * player.mods.tidalVortex;
          e.vx += (-dy / dist) * swirl * dt;
          e.vy += (dx / dist) * swirl * dt;
        }
        if (dist < well.slingshotRadius * 1.1 && well.polarity > 0) {
          inWell = true;
          // Hawking Radiation burn + Event Horizon Crush (heavily resisted by bosses)!
          e.hp -= player.mods.hawkingDps * dt;
          if (player.mods.eventCrushPct > 0) {
            const crushResist = e.isBoss ? 0.22 : (e.isElite ? 0.55 : 1.0);
            e.hp -= e.maxHp * player.mods.eventCrushPct * crushResist * dt;
          }
        }
      }
    }
    e.inGravityWell = inWell;

    const dxP = player.x - e.x;
    const dyP = player.y - e.y;
    const distP = Math.hypot(dxP, dyP) || 1;
    const dirX = dxP / distP;
    const dirY = dyP / distP;
    const fr = e.fireRateMult || 1.0;
    const bs = e.bulletSpeedMult || 1.0;
    const dm = e.dmgMult || 1.0;
    const wn = e.waveNum || 1;

    // Archetype AI behaviors
    if (e.type === 'swarmer') {
      // Boids separation + orbital flank + dive
      let sepX = 0, sepY = 0;
      for (let j = 0; j < enemies.length; j++) {
        const o = enemies[j];
        if (o === e) continue;
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const sd2 = sx * sx + sy * sy;
        if (sd2 > 1 && sd2 < 1600) {
          const sd = Math.sqrt(sd2);
          sepX += (sx / sd) * (40 - sd) * 5;
          sepY += (sy / sd) * (40 - sd) * 5;
        }
      }
      const swirl = Math.sin(e.phase * 0.8) * 0.35;
      const tx = dirX * Math.cos(swirl) - dirY * Math.sin(swirl);
      const ty = dirX * Math.sin(swirl) + dirY * Math.cos(swirl);
      e.vx += (tx * e.speed * 3.4 + sepX) * dt;
      e.vy += (ty * e.speed * 3.4 + sepY) * dt;
      e.angle = Math.atan2(e.vy, e.vx);

    } else if (e.type === 'sniper') {
      // Maintain 340px standoff distance, compute quadratic lead sight, fire high-speed lance!
      const desired = 340;
      const push = distP < desired ? -1 : (distP > desired + 90 ? 1 : 0);
      const strafeX = -dirY * Math.sin(e.phase * 0.4);
      const strafeY = dirX * Math.sin(e.phase * 0.4);

      if (e.chargeTimer > 0) {
        e.chargeTimer -= dt;
        e.vx *= Math.exp(-6 * dt);
        e.vy *= Math.exp(-6 * dt);
        // Track lead angle until last 0.18s so player can dodge or bend!
        if (e.chargeTimer > 0.18) {
          e.angle = SG.solveInterceptAngle(e.x, e.y, player.x, player.y, player.vx, player.vy, 560 * bs);
        }
        if (e.chargeTimer <= 0) {
          game.spawnBullet({
            x: e.x + Math.cos(e.angle) * 20,
            y: e.y + Math.sin(e.angle) * 20,
            vx: Math.cos(e.angle) * 560 * bs,
            vy: Math.sin(e.angle) * 560 * bs,
            damage: Math.round(18 * dm),
            radius: 4.5,
            color: '#ff9e2c',
            fromPlayer: false,
            isLance: true
          });
          audio.playShoot(true);
          e.stateTimer = Math.max(1.05, (2.4 + Math.random() * 0.8) / fr);
        }
      } else {
        e.vx += (dirX * push + strafeX * 0.8) * e.speed * 2.8 * dt;
        e.vy += (dirY * push + strafeY * 0.8) * e.speed * 2.8 * dt;
        e.angle = Math.atan2(dyP, dxP);
        e.stateTimer -= dt;
        if (e.stateTimer <= 0 && distP < 680) {
          e.chargeTimer = Math.max(0.55, 0.95 / Math.sqrt(fr)); // Telegraph laser sight
        }
      }

    } else if (e.type === 'phalanx') {
      // Rotates frontal energy shield slowly toward player; advances inexorably & fires plasma bolts
      const targetAng = Math.atan2(dyP, dxP);
      let diff = targetAng - e.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 1.95 * dt; // Limited turn rate lets smart players curve bullets behind its shield!
      e.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));

      e.vx += Math.cos(e.angle) * e.speed * 2.5 * dt;
      e.vy += Math.sin(e.angle) * e.speed * 2.5 * dt;

      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.stateTimer = Math.max(0.95, 2.2 / fr);
        const bolts = (wn >= 8 || e.isElite) ? [-1, 0, 1] : [-1, 1];
        for (let bi = 0; bi < bolts.length; bi++) {
          const k = bolts[bi];
          const a = e.angle + k * (bolts.length === 3 ? 0.16 : 0.18);
          game.spawnBullet({
            x: e.x + Math.cos(a) * 22,
            y: e.y + Math.sin(a) * 22,
            vx: Math.cos(a) * 310 * bs,
            vy: Math.sin(a) * 310 * bs,
            damage: Math.round(12 * dm),
            radius: 4.2,
            color: '#38bdf8',
            fromPlayer: false
          });
        }
      }

    } else if (e.type === 'pulsar') {
      // Orbits mid-range & releases radial pulse rings + spacetime shockwaves
      const tangX = -dirY;
      const tangY = dirX;
      const pullIn = distP > 260 ? 0.65 : -0.35;
      e.vx += (dirX * pullIn + tangX * 0.85) * e.speed * 2.6 * dt;
      e.vy += (dirY * pullIn + tangY * 0.85) * e.speed * 2.6 * dt;
      e.angle += dt * 2.4;

      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.stateTimer = Math.max(1.25, 2.9 / fr);
        grid.applyRadialForce(e.x, e.y, 680, 180, 285);
        particles.addShockwave(e.x, e.y, 130, '#c06cff', 0.4, 2.2);
        const count = 6 + Math.min(6, Math.floor((wn - 1) / 4)) + (e.isElite ? 2 : 0);
        for (let k = 0; k < count; k++) {
          const a = e.angle + (k * Math.PI * 2) / count;
          game.spawnBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 245 * bs,
            vy: Math.sin(a) * 245 * bs,
            damage: Math.round(11 * dm),
            radius: 4.5,
            color: '#d580ff',
            fromPlayer: false
          });
        }
      }

    } else if (e.type === 'weaver') {
      // Teleports periodically & fires 3-round aimed bursts (5-round on late waves / Elites)
      e.vx += dirX * e.speed * 2.2 * dt;
      e.vy += dirY * e.speed * 2.2 * dt;
      e.angle = Math.atan2(dyP, dxP);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.stateTimer = Math.max(1.15, 2.6 / fr);
        // Blink jump perpendicular to player!
        particles.burst(e.x, e.y, 14, '#22ffa6', 50, 170, 0.35);
        const blinkAng = Math.atan2(dyP, dxP) + (Math.random() < 0.5 ? 1.2 : -1.2);
        e.x = Math.max(50, Math.min(bounds.width - 50, player.x - Math.cos(blinkAng) * 240));
        e.y = Math.max(50, Math.min(bounds.height - 50, player.y - Math.sin(blinkAng) * 240));
        particles.burst(e.x, e.y, 14, '#22ffa6', 50, 170, 0.35);

        const fireAng = SG.solveInterceptAngle(e.x, e.y, player.x, player.y, player.vx, player.vy, 360 * bs);
        const half = (wn >= 10 || e.isElite) ? 2 : 1;
        for (let k = -half; k <= half; k++) {
          const a = fireAng + k * 0.14;
          game.spawnBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 360 * bs,
            vy: Math.sin(a) * 360 * bs,
            damage: Math.round(11 * dm),
            radius: 4,
            color: '#22ffa6',
            fromPlayer: false
          });
        }
      }

    } else if (e.type === 'boss_leviathan') {
      // Articulated Cosmic Serpent Boss: 3-phase sweeping charge, Predator Lunge & multi-ring barrages
      const phase = e.bossPhase || 1;
      if (phase >= 2) {
        if (e.dashTelegraph > 0) {
          e.dashTelegraph -= dt;
          e.vx *= Math.exp(-8 * dt);
          e.vy *= Math.exp(-8 * dt);
          e.dashAngle = SG.solveInterceptAngle(e.x, e.y, player.x, player.y, player.vx, player.vy, 620 + phase * 60);
          e.angle = e.dashAngle;
          if (e.dashTelegraph <= 0) {
            e.dashTimer = 0.68;
            particles.addShockwave(e.x, e.y, 150, '#ff2a5f', 0.35, 3.0);
          }
        } else if (e.dashTimer > 0) {
          const prevDash = e.dashTimer;
          e.dashTimer -= dt;
          const lungeSpd = 620 + phase * 60;
          e.vx = Math.cos(e.dashAngle) * lungeSpd;
          e.vy = Math.sin(e.dashAngle) * lungeSpd;
          e.angle = e.dashAngle;
          if (Math.floor(prevDash / 0.17) !== Math.floor(e.dashTimer / 0.17)) {
            for (const side of [-1, 1]) {
              const sa = e.dashAngle + side * (Math.PI * 0.55);
              game.spawnBullet({
                x: e.x,
                y: e.y,
                vx: Math.cos(sa) * 280,
                vy: Math.sin(sa) * 280,
                damage: 14 + phase * 2,
                radius: 4.8,
                color: '#ff9e2c',
                fromPlayer: false
              });
            }
          }
        } else {
          e.specialTimer -= dt;
          if (e.specialTimer <= 0) {
            e.specialTimer = phase === 3 ? 4.1 : 5.4;
            e.dashTelegraph = 0.72;
            particles.addShockwave(e.x, e.y, 120, '#ff3b6b', 0.55, 2.8);
            particles.addText(e.x, e.y - 36, 'РЫВОК!', '#ff3b6b', 1.15);
          }
        }
      }

      if (e.dashTelegraph <= 0 && e.dashTimer <= 0) {
        const sweep = Math.sin(e.phase * (0.55 + phase * 0.1)) * 0.72;
        const tx = dirX * Math.cos(sweep) - dirY * Math.sin(sweep);
        const ty = dirX * Math.sin(sweep) + dirY * Math.cos(sweep);
        e.vx += tx * e.speed * (2.8 + phase * 0.25) * dt;
        e.vy += ty * e.speed * (2.8 + phase * 0.25) * dt;
        e.angle = Math.atan2(e.vy, e.vx);
      }

      grid.applyRadialForce(e.x, e.y, 260 * dt * 60 * 0.04, 150, 345);

      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        const bossFr = 1 + Math.min(0.35, Math.max(0, wn - 5) * 0.018);
        const bossBs = 1 + Math.min(0.28, Math.max(0, wn - 5) * 0.014);
        e.stateTimer = (phase === 1 ? 1.25 : (phase === 2 ? 1.02 : 0.82)) / bossFr;
        const arms = phase === 1 ? 10 : (phase === 2 ? 12 : 14);
        const bSpd = (305 + phase * 22) * bossBs;
        const bDmg = 16 + phase * 2;
        for (let k = 0; k < arms; k++) {
          const a = e.phase * 0.75 + (k * Math.PI * 2) / arms;
          game.spawnBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * bSpd,
            vy: Math.sin(a) * bSpd,
            damage: bDmg,
            radius: 5.5,
            color: '#ff2a5f',
            fromPlayer: false
          });
        }
        if (phase >= 2) {
          for (let k = 0; k < arms; k++) {
            const a = -e.phase * 0.6 + ((k + 0.5) * Math.PI * 2) / arms;
            game.spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * bSpd * 0.78,
              vy: Math.sin(a) * bSpd * 0.78,
              damage: bDmg - 1,
              radius: 4.8,
              color: '#ff9e2c',
              fromPlayer: false
            });
          }
        }
        // Tail segment multi-shot fan sniper
        const tail = e.segments[e.segments.length - 1];
        const ta = SG.solveInterceptAngle(tail.x, tail.y, player.x, player.y, player.vx, player.vy, 450);
        const fanHalf = phase === 3 ? 2 : 1;
        for (let f = -fanHalf; f <= fanHalf; f++) {
          const fa = ta + f * 0.13;
          game.spawnBullet({
            x: tail.x,
            y: tail.y,
            vx: Math.cos(fa) * 450,
            vy: Math.sin(fa) * 450,
            damage: 16 + phase * 2,
            radius: 5,
            color: '#ff9e2c',
            fromPlayer: false
          });
        }
        if (phase === 3 && e.segments.length > 5) {
          const mid = e.segments[4];
          for (const side of [-1, 1]) {
            const ma = mid.angle + side * Math.PI * 0.5;
            game.spawnBullet({
              x: mid.x,
              y: mid.y,
              vx: Math.cos(ma) * 340,
              vy: Math.sin(ma) * 340,
              damage: 16,
              radius: 4.5,
              color: '#ff2a5f',
              fromPlayer: false
            });
          }
        }
      }

    } else if (e.type === 'boss_archon') {
      // Binary Star Boss: 3-phase faster twin cores, Void Starburst & Phase Warp
      const phase = e.bossPhase || 1;
      const spinRate = phase === 1 ? 2.0 : (phase === 2 ? 2.5 : 3.1);
      e.orbitAngle += dt * spinRate;
      e.twinDist = phase >= 2 ? (86 + Math.sin(e.phase * 0.9) * 36) : 92;
      e.vx += dirX * e.speed * (2.1 + phase * 0.25) * dt;
      e.vy += dirY * e.speed * (2.1 + phase * 0.25) * dt;
      grid.applyRadialForce(e.x, e.y, -(380 + phase * 90) * dt * 60 * 0.04, 210, 42);

      if (phase >= 2) {
        e.specialTimer -= dt;
        if (e.specialTimer <= 0) {
          e.specialTimer = phase === 3 ? 4.6 : 5.0;
          if (phase === 3) {
            particles.addShockwave(e.x, e.y, 150, '#b95cff', 0.4, 2.8);
            const warpAng = Math.random() * Math.PI * 2;
            const minX = Math.min(bounds.width * 0.5, 90);
            const minY = Math.min(bounds.height * 0.5, 90);
            e.x = Math.max(minX, Math.min(bounds.width - minX, player.x + Math.cos(warpAng) * 300));
            e.y = Math.max(minY, Math.min(bounds.height - minY, player.y + Math.sin(warpAng) * 300));
            particles.addShockwave(e.x, e.y, 200, '#b95cff', 0.48, 3.4);
            particles.addText(e.x, e.y - 38, 'ФАЗОВЫЙ СКАЧОК!', '#d98aff', 1.2);
          } else {
            particles.addShockwave(e.x, e.y, 190, '#ffb838', 0.42, 3.0);
          }
          const burstCount = phase === 3 ? 14 : 16;
          for (let b = 0; b < burstCount; b++) {
            const ba = e.orbitAngle + (b * Math.PI * 2) / burstCount;
            game.spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(ba) * 340,
              vy: Math.sin(ba) * 340,
              damage: 17 + phase,
              radius: 5.2,
              color: b % 2 === 0 ? '#ffb838' : '#b95cff',
              fromPlayer: false
            });
          }
        }
      }

      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        const bossFr = 1 + Math.min(0.35, Math.max(0, wn - 5) * 0.018);
        const bossBs = 1 + Math.min(0.28, Math.max(0, wn - 5) * 0.014);
        e.stateTimer = (phase === 1 ? 0.95 : (phase === 2 ? 0.78 : 0.64)) / bossFr;
        const lances = phase === 1 ? 4 : (phase === 2 ? 5 : 6);
        const lSpd = (330 + phase * 25) * bossBs;
        const lDmg = 15 + phase * 2;
        for (let core = -1; core <= 1; core += 2) {
          const cx = e.x + Math.cos(e.orbitAngle) * e.twinDist * core;
          const cy = e.y + Math.sin(e.orbitAngle) * e.twinDist * core;
          for (let k = 0; k < lances; k++) {
            const a = e.orbitAngle * 1.5 + (k * Math.PI * 2) / lances;
            game.spawnBullet({
              x: cx,
              y: cy,
              vx: Math.cos(a) * lSpd,
              vy: Math.sin(a) * lSpd,
              damage: lDmg,
              radius: 5,
              color: core > 0 ? '#ffb838' : '#b95cff',
              fromPlayer: false
            });
          }
          const aimA = SG.solveInterceptAngle(cx, cy, player.x, player.y, player.vx, player.vy, lSpd + 90);
          game.spawnBullet({
            x: cx,
            y: cy,
            vx: Math.cos(aimA) * (lSpd + 90),
            vy: Math.sin(aimA) * (lSpd + 90),
            damage: lDmg + 1,
            radius: 5.4,
            color: '#ffffff',
            fromPlayer: false
          });
        }
      }
    }

    // Burning DoT + Thermal Shock amplification
    if (e.burnTimer > 0) {
      e.burnTimer = Math.max(0, e.burnTimer - dt);
      const thermalMult = (e.cryoTimer > 0 && player.mods.thermalShock > 0)
        ? (1 + 1.2 * player.mods.thermalShock)
        : 1.0;
      e.hp -= (e.burnDps || 24) * thermalMult * dt;
    }

    // Damping & integration (slowed if Cryo-Stasis aura active; bosses & elites resist slow)
    if (e.cryoTimer > 0) {
      e.cryoTimer = Math.max(0, e.cryoTimer - dt);
    }
    const slowResist = e.isBoss ? 0.45 : (e.isElite ? 0.55 : 1.0);
    const slowAmt = e.cryoTimer > 0 && e.cryoSlow ? e.cryoSlow * slowResist : 0;
    const cryoMult = 1 - slowAmt;
    const damp = Math.exp(-2.8 * dt);
    e.vx *= damp;
    e.vy *= damp;
    e.x += e.vx * dt * cryoMult;
    e.y += e.vy * dt * cryoMult;

    // Keep inside arena
    const pad = e.radius + 6;
    if (e.x < pad) { e.x = pad; e.vx = Math.abs(e.vx); }
    if (e.x > bounds.width - pad) { e.x = bounds.width - pad; e.vx = -Math.abs(e.vx); }
    if (e.y < pad) { e.y = pad; e.vy = Math.abs(e.vy); }
    if (e.y > bounds.height - pad) { e.y = bounds.height - pad; e.vy = -Math.abs(e.vy); }

    // Solve Inverse Kinematics chain for Boss Leviathan segments!
    if (e.segments) {
      let prevX = e.x;
      let prevY = e.y;
      const segSpacing = 24;
      for (let s = 0; s < e.segments.length; s++) {
        const seg = e.segments[s];
        const dx = prevX - seg.x;
        const dy = prevY - seg.y;
        const ang = Math.atan2(dy, dx);
        seg.angle = ang;
        seg.x = prevX - Math.cos(ang) * segSpacing;
        seg.y = prevY - Math.sin(ang) * segSpacing;
        prevX = seg.x;
        prevY = seg.y;
      }
    }
  }

  const SPRITE_SIZES = {
    swarmer: 34,
    sniper: 42,
    phalanx: 46,
    pulsar: 42,
    weaver: 38
  };

  function renderEnemy(ctx, e, useSprites = false) {
    const spritesReady = !!(useSprites && SG.Sprites && SG.Sprites.ready);
    ctx.save();

    // Sniper predictive laser telegraph!
    if (e.type === 'sniper' && e.chargeTimer > 0) {
      const flash = e.chargeTimer < 0.22 ? 0.92 : 0.42;
      ctx.strokeStyle = e.chargeTimer < 0.22 ? '#ffffff' : `rgba(255, 158, 44, ${flash})`;
      ctx.lineWidth = e.chargeTimer < 0.22 ? 2.4 : 1.3;
      ctx.setLineDash(e.chargeTimer < 0.22 ? [] : [6, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 900, e.y + Math.sin(e.angle) * 900);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Leviathan Boss Segments
    if (e.segments) {
      for (let s = e.segments.length - 1; s >= 0; s--) {
        const seg = e.segments[s];
        if (spritesReady) {
          SG.Sprites.drawUnit(ctx, 'boss_leviathan_seg', seg.x, seg.y, seg.angle, seg.radius * 2.35, e.hitFlash);
        } else {
          ctx.save();
          ctx.translate(seg.x, seg.y);
          ctx.rotate(seg.angle);
          ctx.fillStyle = '#1c0b1e';
          ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : '#ff2a5f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, seg.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Spine fins
          ctx.beginPath();
          ctx.moveTo(4, -seg.radius);
          ctx.lineTo(-8, -seg.radius - 7);
          ctx.moveTo(4, seg.radius);
          ctx.lineTo(-8, seg.radius + 7);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Archon Twin Binary Boss
    if (e.type === 'boss_archon') {
      const c1x = e.x + Math.cos(e.orbitAngle) * e.twinDist;
      const c1y = e.y + Math.sin(e.orbitAngle) * e.twinDist;
      const c2x = e.x - Math.cos(e.orbitAngle) * e.twinDist;
      const c2y = e.y - Math.sin(e.orbitAngle) * e.twinDist;

      // Plasma tether between binary cores
      ctx.strokeStyle = '#ffdf7e';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(c1x, c1y);
      ctx.lineTo(c2x, c2y);
      ctx.stroke();

      if (spritesReady) {
        SG.Sprites.drawUnit(ctx, 'boss_archon_gold', c1x, c1y, e.orbitAngle * 2, 58, e.hitFlash);
        SG.Sprites.drawUnit(ctx, 'boss_archon_violet', c2x, c2y, -e.orbitAngle * 2, 58, e.hitFlash);
      } else {
        [{ x: c1x, y: c1y, col: '#ffb838' }, { x: c2x, y: c2y, col: '#c06cff' }].forEach(c => {
          ctx.fillStyle = '#140c24';
          ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : c.col;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
      ctx.restore();
      return;
    }

    ctx.translate(e.x, e.y);

    if (e.isElite) {
      ctx.save();
      const pulse = 0.62 + 0.28 * Math.sin(e.phase * 1.6);
      ctx.strokeStyle = `rgba(255, 209, 102, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 165, 56, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 9, e.phase * 0.5, e.phase * 0.5 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (spritesReady) {
      if (e.stunTimer > 0 || e.cryoTimer > 0) {
        ctx.save();
        ctx.strokeStyle = e.stunTimer > 0 ? 'rgba(125, 249, 255, 0.72)' : 'rgba(125, 211, 252, 0.65)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (e.type === 'boss_leviathan') {
        SG.Sprites.drawUnit(ctx, 'boss_leviathan_head', 0, 0, e.angle, 78, e.hitFlash);
      } else {
        const baseSz = SPRITE_SIZES[e.type] || 38;
        const drawSz = baseSz * (e.isElite ? 1.2 : 1.0);
        SG.Sprites.drawUnit(ctx, e.type, 0, 0, e.angle, drawSz, e.hitFlash);
        if (e.type === 'phalanx') {
          ctx.save();
          ctx.rotate(e.angle);
          if (e.isElite) ctx.scale(1.18, 1.18);
          ctx.strokeStyle = '#7df9ff';
          ctx.lineWidth = 4.0;
          ctx.beginPath();
          ctx.arc(0, 0, 24, -1.12, 1.12);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      ctx.save();
      ctx.rotate(e.angle);
      if (e.isElite) {
        ctx.scale(1.18, 1.18);
      }

      const strokeCol = e.hitFlash > 0 ? '#ffffff' : (e.stunTimer > 0 ? '#7df9ff' : (e.cryoTimer > 0 ? '#7dd3fc' : e.color));
      ctx.fillStyle = '#0d1224';
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2.2;

      if (e.type === 'swarmer') {
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, 9);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.type === 'sniper') {
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(-11, 11);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-11, -11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.type === 'phalanx') {
        // Hexagon hull
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * 16;
          const py = Math.sin(a) * 16;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Directional Frontal Energy Barrier (130 deg arc!)
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.arc(0, 0, 24, -1.12, 1.12);
        ctx.stroke();
      } else if (e.type === 'pulsar') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? 18 : 9;
          const a = (i * Math.PI) / 4;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.type === 'weaver') {
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-15, 0);
        ctx.lineTo(0, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.type === 'boss_leviathan') {
        ctx.beginPath();
        ctx.moveTo(34, 0);
        ctx.lineTo(-14, 24);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-14, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Mandibles
        ctx.beginPath();
        ctx.moveTo(18, -12);
        ctx.lineTo(38, -18);
        ctx.moveTo(18, 12);
        ctx.lineTo(38, 18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Mini HP bar for bruised tough enemies & Elites
    if (!e.isBoss && (e.hp < e.maxHp || e.isElite)) {
      const bw = e.isElite ? 34 : 26;
      const barH = e.isElite ? 4.5 : 3.5;
      const barY = -e.radius - (e.isElite ? 14 : 10);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(-bw / 2, barY, bw, barH);
      if (e.isElite) {
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-bw / 2, barY, bw, barH);
      }
      ctx.fillStyle = e.isElite ? '#ffd166' : e.color;
      ctx.fillRect(-bw / 2, barY, bw * Math.max(0, e.hp / e.maxHp), barH);
    }

    ctx.restore();
  }

  SG.GravityWell = GravityWell;
  SG.Player = Player;
  SG.ENEMY_TYPES = ENEMY_TYPES;
  SG.getEffectiveAuraMult = getEffectiveAuraMult;
  SG.getEffectiveAuraPower = getEffectiveAuraPower;
  SG.createEnemy = createEnemy;
  SG.updateEnemy = updateEnemy;
  SG.renderEnemy = renderEnemy;
})(window.SG);
