// SINGULARIS — Cross-Patch Persistent Save, Schema Migration & Portable Export/Import
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  const STORAGE_KEY = 'singularis_crosspatch_save';
  const BACKUP_KEY = 'singularis_crosspatch_save_bak';
  const META_KEY = 'singularis_profile_meta';
  const SCHEMA_VERSION = 1;
  const MAGIC = 'SINGULARIS_SAVE';

  // Rename map across patches: oldUpgradeId -> newUpgradeId
  const UPGRADE_ALIASES = {};

  function safeParseJson(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      return JSON.parse(str);
    } catch (_) {
      return null;
    }
  }

  function toFinite(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function getStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function utf8ToBase64(str) {
    if (typeof btoa !== 'function') return null;
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(str);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToUtf8(b64) {
    if (typeof atob !== 'function') return null;
    const bin = atob(b64);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(bin));
  }

  const Save = {
    STORAGE_KEY,
    BACKUP_KEY,
    META_KEY,
    SCHEMA_VERSION,
    MAGIC,
    UPGRADE_ALIASES,

    loadMeta() {
      const ls = getStorage();
      const legacyScore = ls ? toFinite(ls.getItem('singularis_best_score'), 0) : 0;
      const legacyWave = ls ? toFinite(ls.getItem('singularis_best_wave'), 1) : 1;
      const legacyKills = ls ? toFinite(ls.getItem('singularis_total_kills'), 0) : 0;
      const parsed = ls ? safeParseJson(ls.getItem(META_KEY)) : null;

      return {
        bestScore: Math.max(legacyScore, toFinite(parsed && parsed.bestScore, 0)),
        bestWave: Math.max(1, legacyWave, toFinite(parsed && parsed.bestWave, 1)),
        totalKills: Math.max(legacyKills, toFinite(parsed && parsed.totalKills, 0)),
        totalAnomaliesCleared: Math.max(0, toFinite(parsed && parsed.totalAnomaliesCleared, 0)),
        firstVersion: (parsed && typeof parsed.firstVersion === 'string') ? parsed.firstVersion : (SG.VERSION || 'v2.1.0'),
        lastVersion: SG.VERSION || (parsed && parsed.lastVersion) || 'v2.1.0'
      };
    },

    saveMeta(meta) {
      const ls = getStorage();
      if (!ls || !meta) return false;
      const cur = this.loadMeta();
      const next = {
        bestScore: Math.max(cur.bestScore, Math.floor(toFinite(meta.bestScore, 0))),
        bestWave: Math.max(1, cur.bestWave, Math.floor(toFinite(meta.bestWave, 1))),
        totalKills: Math.max(cur.totalKills, Math.floor(toFinite(meta.totalKills, 0))),
        totalAnomaliesCleared: Math.max(cur.totalAnomaliesCleared, Math.floor(toFinite(meta.totalAnomaliesCleared, 0))),
        firstVersion: cur.firstVersion || SG.VERSION || 'v2.1.0',
        lastVersion: SG.VERSION || cur.lastVersion || 'v2.1.0',
        updatedAt: Date.now()
      };
      try {
        ls.setItem(META_KEY, JSON.stringify(next));
        ls.setItem('singularis_best_score', String(next.bestScore));
        ls.setItem('singularis_best_wave', String(next.bestWave));
        ls.setItem('singularis_total_kills', String(next.totalKills));
        return true;
      } catch (_) {
        return false;
      }
    },

    migrate(raw, targetWorldSize = 24000) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      if (raw.magic && raw.magic !== MAGIC) return null;

      const worldIn = (raw.world && typeof raw.world === 'object') ? raw.world : {};
      const savedWorldSize = Math.max(600, toFinite(worldIn.worldSize || raw.worldSize, targetWorldSize));
      const scale = targetWorldSize / savedWorldSize;
      const minCoord = 80;
      const maxCoord = Math.max(minCoord, targetWorldSize - 80);

      const playerIn = (raw.player && typeof raw.player === 'object') ? raw.player : {};
      const runIn = (raw.run && typeof raw.run === 'object') ? raw.run : {};
      const buildIn = (raw.build && typeof raw.build === 'object') ? raw.build : {};
      const statsIn = (raw.stats && typeof raw.stats === 'object') ? raw.stats : {};

      // Rescale base position safely inside target bounds
      const baseIn = (worldIn.base && typeof worldIn.base === 'object') ? worldIn.base : {};
      const baseX = clamp(toFinite(baseIn.x, savedWorldSize * 0.5) * scale, minCoord, maxCoord);
      const baseY = clamp(toFinite(baseIn.y, savedWorldSize * 0.5) * scale, minCoord, maxCoord);

      const rawPx = toFinite(playerIn.overworldX != null ? playerIn.overworldX : playerIn.x, baseX);
      const rawPy = toFinite(playerIn.overworldY != null ? playerIn.overworldY : playerIn.y, baseY + 145);
      const overworldX = clamp(rawPx * scale, minCoord, maxCoord);
      const overworldY = clamp(rawPy * scale, minCoord, maxCoord);

      // Sanitize & remap upgrade stacks and evolutions
      const rawStacks = (buildIn.upgradeStacks && typeof buildIn.upgradeStacks === 'object')
        ? buildIn.upgradeStacks
        : ((raw.upgradeStacks && typeof raw.upgradeStacks === 'object') ? raw.upgradeStacks : {});
      const upgradeStacks = {};
      for (const [origId, count] of Object.entries(rawStacks)) {
        const mappedId = UPGRADE_ALIASES[origId] || origId;
        const n = Math.floor(toFinite(count, 0));
        if (mappedId && n > 0) {
          upgradeStacks[mappedId] = (upgradeStacks[mappedId] || 0) + n;
        }
      }

      const rawEvos = Array.isArray(buildIn.evolvedUpgrades)
        ? buildIn.evolvedUpgrades
        : (Array.isArray(raw.evolvedUpgrades) ? raw.evolvedUpgrades : []);
      const evoSet = new Set();
      for (const id of rawEvos) {
        if (typeof id === 'string' && id) {
          evoSet.add(UPGRADE_ALIASES[id] || id);
        }
      }

      // Rescale anomalies preserving tier, id, cleared state & coordinates
      const rawAnoms = Array.isArray(worldIn.anomalies) ? worldIn.anomalies : [];
      const anomalies = [];
      for (let i = 0; i < rawAnoms.length; i++) {
        const a = rawAnoms[i];
        if (!a || typeof a !== 'object') continue;
        const tier = clamp(Math.floor(toFinite(a.tier, 1)), 1, 5);
        anomalies.push({
          id: (typeof a.id === 'string' && a.id) ? a.id : `anom_m_${i}`,
          tier,
          name: (typeof a.name === 'string' && a.name) ? a.name : '',
          x: clamp(toFinite(a.x, baseX + 1600) * scale, minCoord, maxCoord),
          y: clamp(toFinite(a.y, baseY) * scale, minCoord, maxCoord),
          cleared: !!a.cleared
        });
      }

      // Forward-compatible base buildings & resources
      const rawBuildings = Array.isArray(worldIn.buildings) ? worldIn.buildings : [];
      const buildings = [];
      for (let i = 0; i < rawBuildings.length; i++) {
        const b = rawBuildings[i];
        if (!b || typeof b !== 'object') continue;
        buildings.push({
          ...b,
          x: clamp(toFinite(b.x, baseX) * scale, minCoord, maxCoord),
          y: clamp(toFinite(b.y, baseY) * scale, minCoord, maxCoord)
        });
      }
      const resources = (worldIn.resources && typeof worldIn.resources === 'object' && !Array.isArray(worldIn.resources))
        ? { ...worldIn.resources }
        : {};

      const difficulty = (typeof raw.difficulty === 'string' && ['easy', 'normal', 'hard'].includes(raw.difficulty))
        ? raw.difficulty
        : 'normal';

      return {
        magic: MAGIC,
        schemaVersion: SCHEMA_VERSION,
        sourceSchemaVersion: Math.max(1, Math.floor(toFinite(raw.schemaVersion, 1))),
        gameVersion: (typeof raw.gameVersion === 'string' && raw.gameVersion) ? raw.gameVersion : 'v1.0.0',
        savedAt: Math.max(0, Math.floor(toFinite(raw.savedAt, Date.now()))),
        difficulty,
        run: {
          score: Math.max(0, Math.floor(toFinite(runIn.score, 0))),
          level: Math.max(1, Math.floor(toFinite(runIn.level, 1))),
          xp: Math.max(0, toFinite(runIn.xp, 0)),
          xpNext: Math.max(50, toFinite(runIn.xpNext, 115)),
          rerolls: Math.max(0, Math.floor(toFinite(runIn.rerolls, 2))),
          wave: Math.max(1, Math.floor(toFinite(runIn.wave, 1))),
          maxCombo: Math.max(1.0, toFinite(runIn.maxCombo, 1.0))
        },
        player: {
          overworldX,
          overworldY,
          hpRatio: clamp(toFinite(playerIn.hpRatio, 1), 0.1, 1),
          shieldRatio: clamp(toFinite(playerIn.shieldRatio, 1), 0, 1),
          chronoRatio: clamp(toFinite(playerIn.chronoRatio, 1), 0, 1)
        },
        build: {
          upgradeStacks,
          evolvedUpgrades: Array.from(evoSet)
        },
        stats: {
          kills: Math.max(0, Math.floor(toFinite(statsIn.kills, 0))),
          slingshots: Math.max(0, Math.floor(toFinite(statsIn.slingshots, 0))),
          hijacks: Math.max(0, Math.floor(toFinite(statsIn.hijacks, 0))),
          annihilations: Math.max(0, Math.floor(toFinite(statsIn.annihilations, 0))),
          anomaliesCleared: Math.max(0, Math.floor(toFinite(statsIn.anomaliesCleared, 0)))
        },
        world: {
          worldSize: targetWorldSize,
          base: { x: baseX, y: baseY },
          anomalies,
          buildings,
          resources
        }
      };
    },

    write(snapshot) {
      const ls = getStorage();
      if (!ls || !snapshot) return false;
      try {
        const json = JSON.stringify(snapshot);
        const prev = ls.getItem(STORAGE_KEY);
        if (prev && prev !== json) {
          ls.setItem(BACKUP_KEY, prev);
        }
        ls.setItem(STORAGE_KEY, json);
        return true;
      } catch (_) {
        return false;
      }
    },

    read(targetWorldSize = 24000) {
      const ls = getStorage();
      if (!ls) return null;
      const primary = safeParseJson(ls.getItem(STORAGE_KEY));
      const migratedPrimary = this.migrate(primary, targetWorldSize);
      if (migratedPrimary) return migratedPrimary;

      const backup = safeParseJson(ls.getItem(BACKUP_KEY));
      return this.migrate(backup, targetWorldSize);
    },

    peek(targetWorldSize = 24000) {
      return this.read(targetWorldSize);
    },

    clearRun() {
      const ls = getStorage();
      if (!ls) return;
      try {
        ls.removeItem(STORAGE_KEY);
        ls.removeItem(BACKUP_KEY);
      } catch (_) {}
    },

    exportCode(snapshot) {
      if (!snapshot) return '';
      try {
        const json = JSON.stringify(snapshot);
        const b64 = utf8ToBase64(json);
        return b64 ? `SG2:${b64}` : json;
      } catch (_) {
        return '';
      }
    },

    importCode(codeStr, targetWorldSize = 24000) {
      if (!codeStr || typeof codeStr !== 'string') return null;
      const trimmed = codeStr.trim();
      if (!trimmed) return null;
      let parsed = null;
      if (trimmed.startsWith('SG2:')) {
        try {
          const decoded = base64ToUtf8(trimmed.slice(4));
          parsed = safeParseJson(decoded);
        } catch (_) {
          parsed = null;
        }
      } else {
        parsed = safeParseJson(trimmed);
      }
      return this.migrate(parsed, targetWorldSize);
    }
  };

  SG.Save = Save;
})(window.SG);
