// SINGULARIS — Tactical Utility-AI Autopilot & Live Telemetry Visualizer
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  class TacticalAutopilot {
    constructor() {
      this.enabled = false;
      this.showTelemetry = true;
      this.wellTimer = 0;
      this.sampledDirs = [];
      this.chosenDir = { x: 0, y: 0 };
      this.targetPoint = null;
      this.decisionLabel = 'ОЖИДАНИЕ';
    }

    computeInput(dt, game) {
      const { player, enemies, bullets, wells, pickups, bounds } = game;
      this.wellTimer = Math.max(0, this.wellTimer - dt);

      const out = {
        moveX: 0,
        moveY: 0,
        aimX: player.x + 100,
        aimY: player.y,
        firing: false,
        bulletTime: false,
        triggerDash: false,
        spawnWell: null,
        detonateWells: false,
        triggerRewind: false
      };

      // 1. Check Emergency Temporal Rewind [Q] if hull critical & 3s-ago history had way more HP!
      if (player.rewindCooldown <= 0 && player.history.length > 40) {
        const past = player.history[0];
        if ((player.hp < 42 && past.hp > player.hp + 22) || (player.hp < 25 && past.shield > 20)) {
          out.triggerRewind = true;
          this.decisionLabel = 'КВАНТОВЫЙ ОТКАТ (СПАСЕНИЕ КОРПУСА)';
          return out;
        }
      }

      // 2. Evaluate 16 candidate movement directions using Closest-Point-of-Approach (CPA) lookahead
      const numDirs = 16;
      const speed = 310 * player.mods.moveSpeedMult;
      this.sampledDirs = [];
      let bestScore = -1e9;
      let bestVec = { x: 0, y: 0 };
      let imminentDanger = 0;

      // Check current threat at stationary position
      for (let b = 0; b < bullets.length; b++) {
        const bul = bullets[b];
        if (bul.fromPlayer) continue;
        const dx = player.x - bul.x;
        const dy = player.y - bul.y;
        const d = Math.hypot(dx, dy);
        if (d < 165) {
          const dot = (dx * bul.vx + dy * bul.vy) / (d * (Math.hypot(bul.vx, bul.vy) || 1));
          if (dot > 0.35) imminentDanger += (165 - d) / 165;
        }
      }

      for (let i = 0; i <= numDirs; i++) {
        const vx = i === numDirs ? 0 : Math.cos((i * Math.PI * 2) / numDirs);
        const vy = i === numDirs ? 0 : Math.sin((i * Math.PI * 2) / numDirs);
        const testVx = vx * speed;
        const testVy = vy * speed;

        let score = 0;
        const futureX = player.x + testVx * 0.35;
        const futureY = player.y + testVy * 0.35;

        // Avoid arena corners/edges
        const edgeMargin = 95;
        if (futureX < edgeMargin) score -= (edgeMargin - futureX) * 2.2;
        if (futureX > bounds.width - edgeMargin) score -= (futureX - (bounds.width - edgeMargin)) * 2.2;
        if (futureY < edgeMargin) score -= (edgeMargin - futureY) * 2.2;
        if (futureY > bounds.height - edgeMargin) score -= (futureY - (bounds.height - edgeMargin)) * 2.2;

        // Projectile CPA threat over next 0.65s
        for (let b = 0; b < bullets.length; b++) {
          const bul = bullets[b];
          if (bul.fromPlayer) continue;
          const rvx = bul.vx - testVx;
          const rvy = bul.vy - testVy;
          const rx = player.x - bul.x;
          const ry = player.y - bul.y;
          const rv2 = rvx * rvx + rvy * rvy || 1;
          const tCpa = Math.max(0, Math.min(0.65, (rx * rvx + ry * rvy) / rv2));
          const cpaX = bul.x + bul.vx * tCpa - (player.x + testVx * tCpa);
          const cpaY = bul.y + bul.vy * tCpa - (player.y + testVy * tCpa);
          const cpaDist = Math.hypot(cpaX, cpaY);
          const safeR = player.radius + bul.radius + 28;
          if (cpaDist < safeR) {
            score -= (safeR - cpaDist) * 26 / (0.12 + tCpa);
          }
        }

        // Sniper telegraph line avoidance!
        for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
          const e = enemies[eIdx];
          const edx = futureX - e.x;
          const edy = futureY - e.y;
          const edist = Math.hypot(edx, edy) || 1;

          // Optimal combat ring around enemies (~275px)
          const ideal = e.isBoss ? 330 : 255;
          if (edist < 135) {
            score -= (135 - edist) * 14;
          } else {
            score -= Math.abs(edist - ideal) * 0.24;
          }

          if (e.type === 'sniper' && e.chargeTimer > 0) {
            const lx = Math.cos(e.angle);
            const ly = Math.sin(e.angle);
            const proj = edx * lx + edy * ly;
            if (proj > 0) {
              const perp = Math.abs(edx * ly - edy * lx);
              if (perp < 48) score -= (48 - perp) * 24;
            }
          }
        }

        // Collect XP crystals & repair orbs when safe
        for (let p = 0; p < pickups.length; p++) {
          const pk = pickups[p];
          const pd = Math.hypot(futureX - pk.x, futureY - pk.y);
          const weight = pk.kind === 'heal' && player.hp < 80 ? 95 : 28;
          score += weight / (1 + pd * 0.015);
        }

        if (i < numDirs) {
          this.sampledDirs.push({ vx, vy, score });
        }
        if (score > bestScore) {
          bestScore = score;
          bestVec = { x: vx, y: vy };
        }
      }

      out.moveX = bestVec.x;
      out.moveY = bestVec.y;
      this.chosenDir = bestVec;

      // Activate Phase Dash or Bullet-Time if dense incoming fire!
      if (imminentDanger > 1.15 && player.dashCooldown <= 0) {
        out.triggerDash = true;
        this.decisionLabel = 'ФАЗОВЫЙ РЫВОК (УКЛОНЕНИЕ)';
      } else if (imminentDanger > 1.05 && player.chrono > 22) {
        out.bulletTime = true;
      }

      // 3. Target Selection & Orbital Slingshot Trick-Shot Calculation!
      if (enemies.length > 0) {
        let bestTarget = null;
        let bestTargetPriority = -1e9;

        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          let prio = -d * 0.55;
          if (e.type === 'sniper' && e.chargeTimer > 0) prio += 260;
          if (e.inGravityWell) prio += 180;
          if (e.hp < 40) prio += 85;
          if (e.isBoss) prio += 140;
          if (prio > bestTargetPriority) {
            bestTargetPriority = prio;
            bestTarget = e;
          }
        }

        if (bestTarget) {
          const projSpeed = 680 * player.mods.projSpeedMult;
          let aimAng = SG.solveInterceptAngle(
            player.x, player.y,
            bestTarget.x, bestTarget.y,
            bestTarget.vx, bestTarget.vy,
            projSpeed
          );

          // Smart trick: If an active Black Hole sits roughly between us and enemies, check if aiming near its slingshot ring hits an enemy with 2.5x Rail-Boost!
          if (wells.length > 0) {
            const w = wells[0];
            const dw = Math.hypot(w.x - player.x, w.y - player.y);
            if (w.polarity > 0 && dw > 90 && dw < 460) {
              const angToWell = Math.atan2(w.y - player.y, w.x - player.x);
              const offsetAng = Math.asin(Math.min(0.95, (w.slingshotRadius * 0.72) / dw));
              for (const side of [-1, 1]) {
                const testAng = angToWell + side * offsetAng;
                const pts = SG.computeCurvedTrajectory(
                  player.x, player.y,
                  Math.cos(testAng) * projSpeed,
                  Math.sin(testAng) * projSpeed,
                  wells, bounds, 34, 0.018, player.mods.bounces
                );
                let hitsEnemy = false;
                for (let k = 4; k < pts.length; k++) {
                  if (!pts[k].boosted) continue;
                  for (let ei = 0; ei < enemies.length; ei++) {
                    const en = enemies[ei];
                    if (Math.hypot(pts[k].x - en.x, pts[k].y - en.y) < en.radius + 22) {
                      hitsEnemy = true;
                      break;
                    }
                  }
                  if (hitsEnemy) break;
                }
                if (hitsEnemy) {
                  aimAng = testAng;
                  this.decisionLabel = 'ОРБИТАЛЬНЫЙ СНАЙПЕРСКИЙ РИКОШЕТ';
                  break;
                }
              }
            }
          }

          out.aimX = player.x + Math.cos(aimAng) * 280;
          out.aimY = player.y + Math.sin(aimAng) * 280;
          out.firing = true;
          this.targetPoint = { x: bestTarget.x, y: bestTarget.y, r: bestTarget.radius };
          if (!out.bulletTime && this.decisionLabel.indexOf('РИКОШЕТ') === -1) {
            this.decisionLabel = `ЗАХВАТ ЦЕЛИ: ${bestTarget.name.toUpperCase()}`;
          } else if (out.bulletTime) {
            this.decisionLabel = 'ХРОНО-УКЛОНЕНИЕ В BULLET-TIME';
          }

          // 4. Tactical Singularity Placement!
          if (this.wellTimer <= 0 && player.wellCooldown <= 0 && wells.length < player.mods.maxWells) {
            // Find cluster centroid or flank behind Phalanx shield!
            let spawnX = bestTarget.x;
            let spawnY = bestTarget.y;
            let shouldSpawn = false;

            if (bestTarget.type === 'phalanx') {
              // Place singularity behind Phalanx's shield to curve bullets into its rear!
              spawnX = bestTarget.x - Math.cos(bestTarget.angle) * 75;
              spawnY = bestTarget.y - Math.sin(bestTarget.angle) * 75;
              shouldSpawn = true;
              this.decisionLabel = 'ОБХОД ЩИТА ЭГИДЫ ГРАВИ-ЛИНЗОЙ';
            } else if (enemies.length >= 3) {
              // Find densest enemy cluster
              let maxNeighbors = 0;
              for (let i = 0; i < enemies.length; i++) {
                let cnt = 0;
                let cx = 0, cy = 0;
                for (let j = 0; j < enemies.length; j++) {
                  if (Math.hypot(enemies[i].x - enemies[j].x, enemies[i].y - enemies[j].y) < 190) {
                    cnt++;
                    cx += enemies[j].x;
                    cy += enemies[j].y;
                  }
                }
                if (cnt > maxNeighbors) {
                  maxNeighbors = cnt;
                  spawnX = cx / cnt;
                  spawnY = cy / cnt;
                }
              }
              if (maxNeighbors >= 2) shouldSpawn = true;
            } else if (bestTarget.isBoss) {
              spawnX = (player.x + bestTarget.x) * 0.52;
              spawnY = (player.y + bestTarget.y) * 0.52;
              shouldSpawn = true;
            }

            if (shouldSpawn) {
              spawnX = Math.max(80, Math.min(bounds.width - 80, spawnX));
              spawnY = Math.max(80, Math.min(bounds.height - 80, spawnY));
              out.spawnWell = { x: spawnX, y: spawnY, isRepulsor: false };
              this.wellTimer = 2.3;
            }
          }

          // Detonate expiring well with Supernova [E] when enemies are inside!
          if (player.detonateCooldown <= 0) {
            for (let w = 0; w < wells.length; w++) {
              if (wells[w].life < 0.75) {
                let trapped = 0;
                for (let ei = 0; ei < enemies.length; ei++) {
                  if (Math.hypot(enemies[ei].x - wells[w].x, enemies[ei].y - wells[w].y) < 150) trapped++;
                }
                if (trapped >= 2) {
                  out.detonateWells = true;
                  this.decisionLabel = 'ДЕТОНАЦИЯ КОЛЛАПСА СВЕРХНОВОЙ';
                }
              }
            }
          }
        }
      } else {
        this.targetPoint = null;
        this.decisionLabel = 'СКАНИРОВАНИЕ КВАНТОВОГО ПОЛЯ';
      }

      return out;
    }

    // Automatically picks synergistic upgrades during full AI Demo Mode!
    pickBestUpgrade(choices, stacks) {
      const priority = {
        chr_singularity_god: 108,
        orbit_trap: 104,
        tank_phoenix: 103,
        orbit_auto_well: 101,
        binary_stars: 100,
        aura_beam: 98,
        hyper_gravity: 97,
        orbit_collider: 96,
        slingshot_mastery: 95,
        gravity_mastery: 94,
        chr_drone_swarm: 93,
        split_prism: 92,
        aura_entropy: 91,
        aura_storm: 90,
        aura_mastery: 89,
        aura_overcharge: 89,
        aura_antimatter: 89,
        kinetic_hijack: 88,
        orbit_dark_matter: 88,
        aura_repulse: 87,
        aura_gravity_well: 87,
        aura_radiation: 86,
        wpn_corpse_blast: 86,
        tesla_chain: 85,
        wpn_execute: 85,
        aura_corona: 84,
        orbit_mega_cap: 84,
        aura_cryo: 83,
        tank_aegis: 83,
        tank_juggernaut: 83,
        paradox_clone: 82,
        wpn_boss_killer: 82,
        aura_nova: 81,
        drone_turrets: 81,
        chr_drone_laser: 81,
        lagrange_drones: 80,
        aura_vortex_pull: 80,
        tank_white_medic: 80,
        singularity_shards: 79,
        tank_hull: 79,
        tank_bulkhead: 79,
        hawking_burn: 78,
        wpn_homing: 78,
        tank_regen: 77,
        tank_phase_dodge: 77,
        overclock_core: 76,
        wpn_burst_echo: 76,
        ricochet_prism: 75,
        wpn_pierce_lance: 75,
        tank_thorns: 74,
        tidal_vortex: 74,
        orbit_zero_drag: 74,
        supernova_collapse: 72,
        tank_fortress: 72,
        chr_clone_army: 72,
        well_haste: 71,
        wpn_splash: 71,
        crit_nova: 70,
        scatter_cannon: 70,
        chr_bt_nova: 70,
        chrono_kill: 69,
        berserk_core: 69,
        tank_ram: 68,
        aura_magnet: 68,
        chr_scholar: 67
      };
      let best = choices[0];
      let bestVal = -1;
      for (const c of choices) {
        const cur = stacks[c.id] || 0;
        const evoBonus = (c.evolution && cur + 1 === c.maxStacks) ? 32 : 0;
        const val = (priority[c.id] || 60) + evoBonus - cur * 8;
        if (val > bestVal) {
          bestVal = val;
          best = c;
        }
      }
      return best;
    }

    renderTelemetry(ctx, player) {
      if (!this.enabled || !this.showTelemetry) return;
      ctx.save();

      // Visualize utility vector rosette around ship
      let minS = Infinity, maxS = -Infinity;
      for (const d of this.sampledDirs) {
        if (d.score < minS) minS = d.score;
        if (d.score > maxS) maxS = d.score;
      }
      const span = Math.max(1, maxS - minS);

      for (const d of this.sampledDirs) {
        const norm = (d.score - minS) / span;
        const len = 24 + norm * 38;
        ctx.strokeStyle = norm > 0.75
          ? 'rgba(34, 255, 166, 0.55)'
          : (norm < 0.3 ? 'rgba(255, 59, 107, 0.42)' : 'rgba(125, 249, 255, 0.22)');
        ctx.lineWidth = norm > 0.85 ? 2.2 : 1.1;
        ctx.beginPath();
        ctx.moveTo(player.x + d.vx * 20, player.y + d.vy * 20);
        ctx.lineTo(player.x + d.vx * len, player.y + d.vy * len);
        ctx.stroke();
      }

      // Target reticle lock-on
      if (this.targetPoint) {
        const tp = this.targetPoint;
        ctx.strokeStyle = 'rgba(34, 255, 166, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, tp.r + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  SG.TacticalAutopilot = TacticalAutopilot;
})(window.SG);
