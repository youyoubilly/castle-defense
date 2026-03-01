/**
 * Enemies: spawn from left/right only, move toward castle, draw, castle reach.
 */

import { getCastleRadius } from './canvas.js';
import { spawnBloodParticles } from './blood.js';

const ENEMY_RADIUS = 10;
const ENEMY_ATTACK_INTERVAL = 32;
const BASE_SPAWN_INTERVAL_MS = 820;
const MIN_SPAWN_INTERVAL_MS = 420;
const CORPSE_DURATION_MS = 15000;
const FALL_DURATION = 28;

const ENEMY_TYPES = {
  normal: { hp: 60, defense: 10, attack: 10, speed: 1.0, radius: 10, gold: 8, name: '步兵', magicDefense: 4 },
  shield: { hp: 55, defense: 18, attack: 8, speed: 0.9, radius: 10, gold: 10, name: '盾卫', magicDefense: 8 },
  heavy: { hp: 120, defense: 15, attack: 16, speed: 0.6, radius: 14, gold: 15, name: '重甲兵', magicDefense: 6 },
  siege: { hp: 100, defense: 12, attack: 18, speed: 0.55, radius: 12, gold: 22, name: '攻城兵', magicDefense: 5 },
  archer: { hp: 58, defense: 7, attack: 18, speed: 0.82, radius: 10, gold: 15, name: '敌弓箭手', magicDefense: 5 },
  boss_summoner: { hp: 320, defense: 20, attack: 22, speed: 0.6, radius: 12, gold: 65, name: '召唤师', magicDefense: 22 },
  war_wolf: { hp: 38, defense: 3, attack: 14, speed: 1.85, radius: 9, gold: 16, name: '战狼', magicDefense: 2 },
  commander: { hp: 240, defense: 18, attack: 22, speed: 0.55, radius: 12, gold: 75, name: '指挥官', magicDefense: 18 },
  mage: { hp: 52, defense: 5, attack: 18, speed: 0.75, radius: 10, gold: 14, name: '魔法师', magicDefense: 14 },
  dragon: { hp: 95, defense: 8, attack: 20, speed: 0.72, radius: 14, gold: 28, name: '飞龙骑士', magicDefense: 6, fireDamage: 28 },
  dragon_warrior: { hp: 140, defense: 12, attack: 26, speed: 0.65, radius: 16, gold: 42, name: '飞龙战士', magicDefense: 10, fireDamage: 36 },
};
const FLIGHT_ALTITUDE = 52;
const DRAGON_AXE_RANGE = 220;
const DRAGON_FIRE_CLOSE_RANGE = 68;
const DRAGON_FIRE_RANGE = 58;
const DRAGON_AXE_INTERVAL = 48;
const DRAGON_FIRE_INTERVAL = 42;
const DRAGON_AXE_SPEED = 6;
const DRAGON_AXE_HIT_R = 20;
const DRAGON_AXE_MAX_AGE = 90;
const BOSS_SUMMON_INTERVAL_MS = 6000;
const BOSS_WAVE_INTERVAL = 5;
const BOSS_COUNT_PER_BOSS_WAVE = 2;

const ENEMY_ARCHER_STOP_RANGE = 200;
const ENEMY_ARCHER_SHOOT_RANGE = 220;
const ENEMY_ARCHER_INTERVAL = 40;
const ENEMY_MAGE_INTERVAL = 38;
const ENEMY_ARROW_SPEED = 5;
const ENEMY_ARROW_HIT_R = 18;
const ENEMY_ARROW_MAX_AGE = 120;

/** 城堡等级对应的防御力（冲城时减少对己方士兵的伤害） */
function getCastleDefenseForBreach(level) {
  const L = Math.max(1, Math.min(5, level || 1));
  return [0, 0, 2, 4, 6, 8][L];
}

export function getEnemyTypeName(typeId) {
  return ENEMY_TYPES[typeId]?.name ?? '敌兵';
}

/** Enemy runway y (same for all, horizontal band). Use state.groundY when available. */
export function getGroundY(height) {
  return height * 0.75;
}

function pickEnemyType() {
  const r = Math.random();
  if (r < 0.45) return 'normal';
  if (r < 0.72) return 'shield';
  if (r < 0.88) return 'heavy';
  if (r < 0.94) return 'siege';
  if (r < 0.98) return 'mage';
  return 'archer';
}

/** By wave: wave 1 easier; 含魔法师（概率适中）；wave 6+ 召唤师与战狼常驻。 */
export function pickEnemyTypeByWave(wave) {
  const w = Math.max(1, wave || 1);
  const r = Math.random();
  if (w <= 1) {
    if (r < 0.52) return 'normal';
    if (r < 0.72) return 'shield';
    if (r < 0.88) return 'heavy';
    if (r < 0.95) return 'siege';
    if (r < 0.98) return 'mage';
    return 'archer';
  }
  if (w <= 2) {
    if (r < 0.42) return 'normal';
    if (r < 0.68) return 'shield';
    if (r < 0.84) return 'heavy';
    if (r < 0.92) return 'siege';
    if (r < 0.96) return 'mage';
    return 'archer';
  }
  if (w <= 3) {
    if (r < 0.30) return 'normal';
    if (r < 0.54) return 'shield';
    if (r < 0.74) return 'heavy';
    if (r < 0.86) return 'siege';
    if (r < 0.92) return 'mage';
    if (r < 0.97) return 'archer';
    return 'dragon';
  }
  if (w <= 5) {
    if (r < 0.26) return 'normal';
    if (r < 0.50) return 'shield';
    if (r < 0.68) return 'heavy';
    if (r < 0.80) return 'siege';
    if (r < 0.86) return 'mage';
    if (r < 0.92) return 'archer';
    if (r < 0.97) return 'dragon';
    return 'dragon_warrior';
  }
  // 第 6 波起：召唤师、战狼常驻，飞龙与飞龙战士
  if (r < 0.18) return 'normal';
  if (r < 0.40) return 'shield';
  if (r < 0.56) return 'heavy';
  if (r < 0.68) return 'siege';
  if (r < 0.74) return 'war_wolf';
  if (r < 0.80) return 'boss_summoner';
  if (r < 0.86) return 'mage';
  if (r < 0.92) return 'archer';
  if (r < 0.97) return 'dragon';
  return 'dragon_warrior';
}

/** Total enemies to spawn in this wave. */
export function getWaveTotal(wave) {
  const w = Math.max(1, wave || 1);
  return 6 + w * 4;
}

/** Spawn interval ms for this wave (decreases with wave = harder). */
export function getSpawnIntervalMs(wave) {
  const w = Math.max(1, wave || 1);
  return Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - w * 45);
}

/** Target (tx, ty) = castle center. type: 'normal' | 'shield' | ... | 'dragon' | 'dragon_warrior'. */
export function createEnemy(x, y, tx, ty, type) {
  const kind = type || pickEnemyType();
  const t = ENEMY_TYPES[kind];
  const isFlying = kind === 'dragon' || kind === 'dragon_warrior';
  const dx = tx - x;
  const dy = isFlying ? 0 : ty - y;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * t.speed;
  const vy = isFlying ? 0 : (dy / len) * t.speed;
  const e = {
    x,
    y,
    vx,
    vy,
    radius: t.radius,
    hp: t.hp,
    maxHp: t.hp,
    defense: t.defense,
    attack: t.attack,
    magicDefense: t.magicDefense ?? 0,
    goldReward: t.gold,
    type: kind,
    name: t.name ?? getEnemyTypeName(kind),
    alive: true,
    lastAttackFrame: 0,
    lastShotFrame: 0,
  };
  if (isFlying) {
    e.flightY = y;
    e.lastAxeFrame = 0;
    e.lastFireFrame = 0;
    e.fireDamage = t.fireDamage ?? Math.floor((t.attack ?? 20) * 1.4);
  }
  return e;
}

/**
 * Spawn one enemy from left or right; type by state.wave if wave-based.
 * 飞龙从第 3 波起出现，生成在飞行高度（地面之上）。
 */
export function spawnEnemy(state, width, height) {
  const groundY = getGroundY(height);
  const margin = 30;
  const side = Math.random() < 0.5 ? 0 : 1;
  let x;
  if (side === 0) {
    x = -margin;
  } else {
    x = width + margin;
  }
  let y = groundY + (Math.random() - 0.5) * 40;
  const type = state.wave != null ? pickEnemyTypeByWave(state.wave) : pickEnemyType();
  if (type === 'dragon' || type === 'dragon_warrior') {
    y = groundY - FLIGHT_ALTITUDE;
  }
  const enemy = createEnemy(x, y, state.castleCx, state.castleCy, type);
  state.enemies.push(enemy);
}

/** Spawn position for boss (same as normal: left or right edge). */
function getBossSpawnPosition(width, height) {
  const groundY = getGroundY(height);
  const margin = 30;
  const side = Math.random() < 0.5 ? 0 : 1;
  const x = side === 0 ? -margin : width + margin;
  const y = groundY + (Math.random() - 0.5) * 40;
  return { x, y };
}

/**
 * Spawn one boss slot: either 1 召唤师 or 3 战狼 (animal boss: many, fast, low HP).
 */
export function spawnBoss(state, width, height) {
  const { x, y } = getBossSpawnPosition(width, height);
  const cx = state.castleCx;
  const cy = state.castleCy;
  const isSummoner = Math.random() < 0.5;
  if (isSummoner) {
    const e = createEnemy(x, y, cx, cy, 'boss_summoner');
    e.lastSummonTime = 0;
    state.enemies.push(e);
  } else {
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * 18;
      const e = createEnemy(x + offsetX, y + (Math.random() - 0.5) * 12, cx, cy, 'war_wolf');
      state.enemies.push(e);
    }
  }
}

/** 仅召唤师可召唤小弟；指挥官不能召唤。 */
export function applyBossSummon(state) {
  const now = Date.now();
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  for (const e of state.enemies) {
    if (!e.alive || e.type !== 'boss_summoner') continue;
    if (e.frozenUntil && e.frozenUntil > now) continue;
    const last = e.lastSummonTime ?? 0;
    if (now - last < BOSS_SUMMON_INTERVAL_MS) continue;
    e.lastSummonTime = now;
    const dx = (e.vx >= 0 ? 1 : -1) * 28;
    const minion = createEnemy(e.x + dx, e.y, cx, cy, 'normal');
    state.enemies.push(minion);
  }
}

/** 每 5 波在固定序号处刷出小 Boss（混在人群中） */
function isBossSpawnIndex(state) {
  const wave = state.wave ?? 1;
  const total = state.waveEnemiesToSpawn ?? 999;
  const spawned = state.waveEnemiesSpawned ?? 0;
  const bossesToSpawn = state.waveBossesToSpawn ?? 0;
  const bossesSpawned = state.waveBossesSpawned ?? 0;
  if (wave % BOSS_WAVE_INTERVAL !== 0 || bossesSpawned >= bossesToSpawn) return false;
  const slot1 = Math.floor(total / 4);
  const slot2 = Math.floor((total * 2) / 4);
  return spawned === slot1 || spawned === slot2;
}

/** 每波最后一次刷兵时出指挥官（波末压轴） */
function isCommanderSpawnIndex(state) {
  const total = state.waveEnemiesToSpawn ?? 999;
  const spawned = state.waveEnemiesSpawned ?? 0;
  return spawned === total - 1;
}

/** 生成一名指挥官（戴帽、高血），用于波末压轴。 */
function spawnCommander(state, width, height) {
  const { x, y } = getBossSpawnPosition(width, height);
  state.enemies.push(createEnemy(x, y, state.castleCx, state.castleCy, 'commander'));
}

/** Wave-based: spawn one enemy; 每波最后一只是指挥官；每 5 波中间 2 只为 Boss。 */
export function trySpawnWaveEnemy(state, width, height) {
  if (state.waveState !== 'fighting') return;
  if ((state.waveEnemiesSpawned ?? 0) >= (state.waveEnemiesToSpawn ?? 999)) return;
  const now = performance.now();
  const interval = getSpawnIntervalMs(state.wave);
  if (now - (state.lastSpawnTime ?? 0) < interval) return;
  state.lastSpawnTime = now;
  if (isCommanderSpawnIndex(state)) {
    spawnCommander(state, width, height);
  } else if (isBossSpawnIndex(state)) {
    spawnBoss(state, width, height);
    state.waveBossesSpawned = (state.waveBossesSpawned ?? 0) + 1;
  } else {
    spawnEnemy(state, width, height);
  }
  state.waveEnemiesSpawned = (state.waveEnemiesSpawned ?? 0) + 1;
}

/** No longer uses setInterval; wave spawning is driven by game loop. */
export function startSpawning(state, width, height) {
  state.lastSpawnTime = performance.now();
}

export function updateEnemies(state, width, height) {
  const castleR = getCastleRadius();
  const dt = 1;

  const now = Date.now();
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.frozenUntil && e.frozenUntil > now) continue;

    e.animPhase = (e.animPhase || 0) + dt * 0.45;
    const isFlying = e.type === 'dragon' || e.type === 'dragon_warrior';
    if (isFlying) {
      e.x += e.vx * dt;
      e.y = e.flightY ?? e.y;
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    let distToCastle = Math.hypot(e.x - state.castleCx, e.y - state.castleCy);
    const isRanged = e.type === 'archer' || e.type === 'mage';
    if (isRanged && distToCastle < ENEMY_ARCHER_STOP_RANGE && distToCastle > 0) {
      const cx = state.castleCx;
      const cy = state.castleCy;
      e.x = cx + (e.x - cx) / distToCastle * ENEMY_ARCHER_STOP_RANGE;
      e.y = cy + (e.y - cy) / distToCastle * ENEMY_ARCHER_STOP_RANGE;
      e.vx = 0;
      e.vy = 0;
      distToCastle = ENEMY_ARCHER_STOP_RANGE;
    }
    const castleHealth = state.castleHealth ?? 10;
    if (castleHealth > 0 && distToCastle < castleR + e.radius) {
      e.alive = false;
      e.deadAt = Date.now();
      e.deathPhase = 'falling';
      e.fallProgress = 0;
      state.castleHealth = castleHealth - 1;
      const fieldSoldiers = (state.soldiers || []).filter((s) => s.status === 'field');
      if (fieldSoldiers.length > 0) {
        const def = getCastleDefenseForBreach(state.castleLevel ?? 1);
        const breachDmg = Math.max(5, 30 - def * 3);
        const hit = fieldSoldiers[Math.floor(Math.random() * fieldSoldiers.length)];
        hit.hp = Math.max(0, (hit.hp || hit.maxHp) - breachDmg);
        spawnBloodParticles(state, hit.x, hit.y, 3);
      }
    }
  }

  // Dead: advance fall animation, then keep as corpse until CORPSE_DURATION_MS
  for (const e of state.enemies) {
    if (e.alive) continue;
    if (e.deathPhase === 'falling') {
      e.fallProgress = (e.fallProgress || 0) + 1 / FALL_DURATION;
      if (e.fallProgress >= 1) e.deathPhase = 'lying';
    }
  }

  state.enemies = state.enemies.filter(
    (e) => e.alive || (e.deadAt != null && Date.now() - e.deadAt <= CORPSE_DURATION_MS)
  );
}

/**
 * Enemy archers shoot at nearest soldier in range, or at castle. Spawns into state.enemyArrows.
 */
export function applyEnemyArcherShoot(state) {
  const frame = state.frameCount || 0;
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  const fieldSoldiers = (state.soldiers || []).filter((s) => s.status === 'field');

  for (const e of state.enemies) {
    if (!e.alive) continue;
    const isArcher = e.type === 'archer';
    const isMage = e.type === 'mage';
    if (!isArcher && !isMage) continue;
    if (e.frozenUntil && e.frozenUntil > Date.now()) continue;
    const distToCastle = Math.hypot(e.x - cx, e.y - cy);
    if (distToCastle > ENEMY_ARCHER_SHOOT_RANGE) continue;
    const interval = isMage ? ENEMY_MAGE_INTERVAL : ENEMY_ARCHER_INTERVAL;
    if ((frame - (e.lastShotFrame || 0)) < interval) continue;

    let targetSoldier = null;
    let targetCastle = false;
    let tx = cx;
    let ty = cy;
    let nearestDist = 201;
    for (const s of fieldSoldiers) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < 200 && d < nearestDist) {
        nearestDist = d;
        targetSoldier = s;
        tx = s.x;
        ty = s.y;
      }
    }
    if (!targetSoldier) targetCastle = true;

    const dx = tx - e.x;
    const dy = ty - e.y;
    const len = Math.hypot(dx, dy) || 1;
    if (!state.enemyArrows) state.enemyArrows = [];
    state.enemyArrows.push({
      x: e.x,
      y: e.y,
      vx: (dx / len) * ENEMY_ARROW_SPEED,
      vy: (dy / len) * ENEMY_ARROW_SPEED,
      damage: e.attack ?? 12,
      targetSoldier,
      targetCastle,
      age: 0,
    });
    e.lastShotFrame = frame;
  }
}

/**
 * 飞龙：近距离喷火（对范围内卫兵），未接近时投掷飞斧（远程）。
 * 喷火：与最近卫兵距离 ≤ DRAGON_FIRE_CLOSE_RANGE 时，对 DRAGON_FIRE_RANGE 内所有卫兵造成 fireDamage。
 * 飞斧：否则在 DRAGON_AXE_RANGE 内时向最近卫兵或城堡投斧，弹道存入 state.dragonAxes。
 */
export function applyDragonActions(state) {
  const frame = state.frameCount || 0;
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  const fieldSoldiers = (state.soldiers || []).filter((s) => s.status === 'field');

  for (const e of state.enemies) {
    if (!e.alive || (e.type !== 'dragon' && e.type !== 'dragon_warrior')) continue;
    if (e.frozenUntil && e.frozenUntil > Date.now()) continue;

    let nearestSoldier = null;
    let nearestDist = 9999;
    for (const s of fieldSoldiers) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestSoldier = s;
      }
    }
    const distToCastle = Math.hypot(e.x - cx, e.y - cy);

    if (nearestDist <= DRAGON_FIRE_CLOSE_RANGE) {
      if ((frame - (e.lastFireFrame || 0)) >= DRAGON_FIRE_INTERVAL) {
        e.lastFireFrame = frame;
        const dmg = e.fireDamage ?? 28;
        for (const s of fieldSoldiers) {
          if (Math.hypot(e.x - s.x, e.y - s.y) <= DRAGON_FIRE_RANGE) {
            const raw = Math.max(1, dmg - (s.defense ?? 0));
            s.hp = Math.max(0, (s.hp ?? s.maxHp) - raw);
            s.hitFlashUntil = Date.now() + 350;
            spawnBloodParticles(state, s.x, s.y, 4);
          }
        }
      }
    } else {
      const inAxeRange = nearestDist <= DRAGON_AXE_RANGE || distToCastle <= DRAGON_AXE_RANGE;
      if (inAxeRange && (frame - (e.lastAxeFrame || 0)) >= DRAGON_AXE_INTERVAL) {
        e.lastAxeFrame = frame;
        let tx = cx;
        let ty = cy;
        let targetSoldier = null;
        let targetCastle = !nearestSoldier || distToCastle < nearestDist;
        if (!targetCastle && nearestSoldier) {
          targetSoldier = nearestSoldier;
          tx = nearestSoldier.x;
          ty = nearestSoldier.y;
        }
        const dx = tx - e.x;
        const dy = ty - e.y;
        const len = Math.hypot(dx, dy) || 1;
        if (!state.dragonAxes) state.dragonAxes = [];
        state.dragonAxes.push({
          x: e.x,
          y: e.y,
          vx: (dx / len) * DRAGON_AXE_SPEED,
          vy: (dy / len) * DRAGON_AXE_SPEED,
          damage: e.attack ?? 20,
          targetSoldier,
          targetCastle,
          age: 0,
        });
      }
    }
  }
}

/**
 * Update dragon axe projectiles; apply damage to soldier or castle on hit.
 */
export function updateDragonAxes(state) {
  if (!state.dragonAxes || state.dragonAxes.length === 0) return;
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  const castleR = getCastleRadius();

  state.dragonAxes = state.dragonAxes.filter((ax) => {
    ax.x += ax.vx;
    ax.y += ax.vy;
    ax.age++;
    if (ax.age > DRAGON_AXE_MAX_AGE) return false;

    if (ax.targetSoldier) {
      const d = Math.hypot(ax.x - ax.targetSoldier.x, ax.y - ax.targetSoldier.y);
      if (d < DRAGON_AXE_HIT_R) {
        const s = ax.targetSoldier;
        const raw = Math.max(1, (ax.damage ?? 20) - (s.defense ?? 0));
        s.hp = Math.max(0, (s.hp ?? s.maxHp) - raw);
        s.hitFlashUntil = Date.now() + 280;
        spawnBloodParticles(state, s.x, s.y, 3);
        return false;
      }
    }
    if (ax.targetCastle) {
      const d = Math.hypot(ax.x - cx, ax.y - cy);
      if (d < castleR + 22) {
        state.castleHealth = Math.max(0, (state.castleHealth ?? 10) - 1);
        return false;
      }
    }
    return true;
  });
}

/**
 * Update enemy arrows; apply damage to soldier or castle on hit.
 */
export function updateEnemyArrows(state) {
  if (!state.enemyArrows || state.enemyArrows.length === 0) return;
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  const castleR = getCastleRadius();

  state.enemyArrows = state.enemyArrows.filter((arr) => {
    arr.x += arr.vx;
    arr.y += arr.vy;
    arr.age++;
    if (arr.age > ENEMY_ARROW_MAX_AGE) return false;

    if (arr.targetSoldier) {
      const d = Math.hypot(arr.x - arr.targetSoldier.x, arr.y - arr.targetSoldier.y);
      if (d < ENEMY_ARROW_HIT_R) {
        const s = arr.targetSoldier;
        s.hp = Math.max(0, (s.hp ?? s.maxHp) - (arr.damage ?? 12));
        s.hitFlashUntil = Date.now() + 280;
        spawnBloodParticles(state, s.x, s.y, 3);
        return false;
      }
    }
    if (arr.targetCastle) {
      const d = Math.hypot(arr.x - cx, arr.y - cy);
      if (d < castleR + 20) {
        state.castleHealth = Math.max(0, (state.castleHealth ?? 10) - 1);
        return false;
      }
    }
    return true;
  });
}

/**
 * Draw enemy arrows (darker / red tint to distinguish from ours).
 */
export function drawEnemyArrows(ctx, state) {
  if (!state.enemyArrows || state.enemyArrows.length === 0) return;
  const speed = ENEMY_ARROW_SPEED;
  state.enemyArrows.forEach((arr) => {
    const len = 10;
    const tipX = arr.x + (arr.vx / speed) * len;
    const tipY = arr.y + (arr.vy / speed) * len;
    ctx.strokeStyle = '#6b4030';
    ctx.fillStyle = '#4a3020';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(arr.x, arr.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/**
 * Draw dragon axe projectiles (flying axe shape).
 */
export function drawDragonAxes(ctx, state) {
  if (!state.dragonAxes || state.dragonAxes.length === 0) return;
  const speed = DRAGON_AXE_SPEED;
  state.dragonAxes.forEach((ax) => {
    const len = 14;
    const tipX = ax.x + (ax.vx / speed) * len;
    const tipY = ax.y + (ax.vy / speed) * len;
    ctx.strokeStyle = '#5a4a38';
    ctx.fillStyle = '#3d3528';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax.x, ax.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, 4, 2.5, Math.atan2(ax.vy, ax.vx), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/**
 * Enemies in melee range of a soldier deal damage to the nearest soldier (with cooldown).
 */
export function applyEnemyDamageToSoldiers(state) {
  const range = state.soldierRange ?? 100;
  const frame = state.frameCount || 0;
  const fieldSoldiers = (state.soldiers || []).filter((s) => s.status === 'field');
  if (fieldSoldiers.length === 0) return;

  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.frozenUntil && e.frozenUntil > Date.now()) continue;
    if (e.type === 'dragon' || e.type === 'dragon_warrior') continue;
    let nearest = null;
    let nearestDist = range + 1;
    for (const s of fieldSoldiers) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d <= range && d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    }
    if (!nearest) continue;
    const interval = ENEMY_ATTACK_INTERVAL;
    if (frame - (e.lastAttackFrame || 0) < interval) continue;
    e.lastAttackFrame = frame;
    const rawDmg = e.attack ?? 10;
    const soldierDefense = nearest.defense ?? state.soldierDefense ?? 5;
    const damage = Math.max(1, rawDmg - soldierDefense);
    nearest.hp = Math.max(0, (nearest.hp ?? nearest.maxHp) - damage);
    nearest.hitFlashUntil = Date.now() + 280;
    spawnBloodParticles(state, nearest.x, nearest.y, 3);
  }
}

/**
 * Compute final damage: base vs defense, optional crit.
 * Formula: max(1, baseDamage - defense) then crit multiplier.
 */
function computeDamage(baseDamage, defense, critChance, critMultiplier) {
  const raw = Math.max(1, (baseDamage ?? 20) - (defense ?? 0));
  const isCrit = Math.random() < (critChance ?? 0.15);
  return { damage: isCrit ? raw * (critMultiplier ?? 1.8) : raw, isCrit };
}

/**
 * Soldiers attack enemies within their own range (meet and fight at close range). Defense, crit, shield counter.
 */
export function applySoldierDamage(state) {
  state.soldierFrameCounter = (state.soldierFrameCounter || 0) + 1;
  if (state.soldierFrameCounter % (state.soldierAttackInterval || 20) !== 0) return;

  const range = state.soldierRange ?? 100;
  const baseDamage = state.soldierDamage ?? 20;
  const shieldChance = state.soldierShieldChance ?? 0.3;
  const critChance = state.soldierCritChance ?? 0.15;
  const critMult = state.soldierCritMultiplier ?? 1.8;
  const fieldSoldiers = (state.soldiers || []).filter((s) => s.status === 'field');
  if (fieldSoldiers.length === 0) return;

  fieldSoldiers.forEach((s) => { s.isBlocking = false; });

  for (const e of state.enemies) {
    if (!e.alive) continue;
    let nearestSoldier = null;
    let nearestDist = range + 1;
    for (const s of fieldSoldiers) {
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      if (dist <= range && dist < nearestDist) {
        nearestDist = dist;
        nearestSoldier = s;
      }
    }
    if (nearestSoldier) {
      const soldierAttack = nearestSoldier.attack ?? baseDamage;
      const isShieldCounter = Math.random() < shieldChance;
      const { damage: rawDmg, isCrit } = computeDamage(soldierAttack, e.defense, critChance, critMult);
      const damage = isShieldCounter ? rawDmg * 1.2 : rawDmg;
      e.hp -= damage;
      spawnBloodParticles(state, e.x, e.y, 4);
      e.hitFlashUntil = Date.now() + 350;
      e.lastHitCrit = isCrit;
      if (isShieldCounter && fieldSoldiers.length > 0) {
        const idx = Math.floor(Math.random() * fieldSoldiers.length);
        fieldSoldiers[idx].isBlocking = true;
      }
      if (e.hp <= 0) {
        e.alive = false;
        e.deadAt = Date.now();
        e.deathPhase = 'falling';
        e.fallProgress = 0;
        state.score = (state.score || 0) + 1;
        state.gold = (state.gold || 0) + (e.goldReward ?? state.goldPerKill ?? 8);
      }
    }
  }
}

/**
 * Draw health bar above unit. x,y = center, width, height, hp, maxHp.
 */
function drawHealthBar(ctx, x, y, width, height, hp, maxHp, isEnemy) {
  const left = x - width / 2;
  const top = y - height - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, width, height);
  const ratio = Math.max(0, Math.min(1, (hp || 0) / (maxHp || 1)));
  if (isEnemy) {
    ctx.fillStyle = ratio > 0.4 ? '#c44' : ratio > 0.2 ? '#a33' : '#822';
  } else {
    ctx.fillStyle = ratio > 0.4 ? '#4a8' : ratio > 0.2 ? '#6b9' : '#3a7';
  }
  ctx.fillRect(left, top, width * ratio, height);
}

/**
 * Draw enemy: alive = stick figure; dead = falling then lying corpse (15s).
 */
export function drawEnemies(ctx, state) {
  const now = Date.now();
  for (const e of state.enemies) {
    const x = e.x;
    const y = e.y;
    const isHeavy = e.type === 'heavy';
    const isShield = e.type === 'shield';
    const isArcher = e.type === 'archer';
    const isMage = e.type === 'mage';
    const isBossSummoner = e.type === 'boss_summoner';
    const isWarWolf = e.type === 'war_wolf';
    const isCommander = e.type === 'commander';
    const isDragon = e.type === 'dragon' || e.type === 'dragon_warrior';
    let scale = isHeavy ? 1.35 : 1;
    if (isBossSummoner || isCommander) scale = 1.25;
    else if (isWarWolf) scale = 0.95;
    else if (isDragon) scale = 1.1;

    if (isWarWolf) {
      if (e.alive) drawAliveWolf(ctx, e, x, y, now);
      else drawDeadWolf(ctx, e, x, y);
    } else if (isDragon) {
      if (e.alive) drawAliveDragon(ctx, e, x, y, now);
      else drawDeadDragon(ctx, e, x, y);
    } else if (e.alive) {
      drawAliveEnemy(ctx, e, x, y, scale, isShield, isArcher, isMage, isBossSummoner, isCommander, now);
    } else {
      drawDeadEnemy(ctx, e, x, y, scale);
    }
  }
}

function drawAliveEnemy(ctx, e, x, y, scale, isShield, isArcher, isMage, isBossSummoner, isCommander, now) {
  const r = 4.5 * scale;
  const bodyLen = 8 * scale;
  const armLen = 7 * scale;
  const swordLen = 9 * scale;
  const legStep = 3.5 * scale;
  const hipY = y + bodyLen;
  const footY = y + 20 * scale;

  const nameText = e.name || getEnemyTypeName(e.type);
  ctx.save();
  ctx.font = isBossSummoner || isCommander ? '12px sans-serif' : '11px sans-serif';
  ctx.fillStyle = isBossSummoner ? 'rgba(220,180,255,0.95)' : isCommander ? 'rgba(255,230,180,0.95)' : isMage ? 'rgba(200,220,255,0.95)' : 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeText(nameText, x, y - 16);
  ctx.fillText(nameText, x, y - 16);
  ctx.restore();

  drawHealthBar(ctx, x, y - 6, 22 * scale, 3, e.hp, e.maxHp, true);
  const flashing = e.hitFlashUntil > now;
  const wasCrit = e.lastHitCrit && flashing;
  if (isBossSummoner) {
    ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#5a2a6a';
    ctx.fillStyle = flashing ? '#c080e0' : '#6b3a7a';
  } else if (isCommander) {
    ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#4a3a20';
    ctx.fillStyle = flashing ? '#e8c870' : '#8a7040';
  } else if (isMage) {
    ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#3a3a6a';
    ctx.fillStyle = flashing ? '#8090e0' : '#4a5090';
  } else {
    ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#8b2500';
    ctx.fillStyle = flashing ? '#e05030' : '#a03010';
  }
  ctx.lineWidth = (wasCrit ? 2.5 : 1.8) * scale;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(x, y - 6, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isCommander) {
    ctx.fillStyle = '#3a3020';
    ctx.strokeStyle = '#2a2010';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 10);
    ctx.lineTo(x + 8, y - 10);
    ctx.lineTo(x + 7, y - 16);
    ctx.lineTo(x - 7, y - 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a4a30';
    ctx.beginPath();
    ctx.ellipse(x, y - 13, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isCommander ? '#4a3a20' : '#8b2500';
  }

  ctx.beginPath();
  ctx.moveTo(x, y - 1.5);
  ctx.lineTo(x, y + bodyLen);
  ctx.stroke();

  const dir = e.vx >= 0 ? 1 : -1;
  if (isShield) {
    ctx.strokeStyle = '#6a6a6a';
    ctx.fillStyle = '#5a5a5a';
    const shieldX = x - dir * 12;
    const shieldY = y + 4;
    ctx.beginPath();
    ctx.ellipse(shieldX, shieldY, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#8b2500';
  } else if (!isArcher && !isMage) {
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(e.vx < 0 ? x + armLen : x - armLen, y + 6);
    ctx.stroke();
  }

  if (isArcher) {
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(x + dir * 6, y + 2, 6, -0.5 * Math.PI, 0.4 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dir * 2, y - 1);
    ctx.lineTo(x + dir * 10, y + 3);
    ctx.stroke();
    ctx.strokeStyle = '#8b2500';
  } else if (isMage) {
    ctx.strokeStyle = '#3a3050';
    ctx.fillStyle = '#5a5080';
    ctx.lineWidth = 1.5 * scale;
    const staffTopX = x + dir * 4;
    const staffTopY = y - 10;
    ctx.beginPath();
    ctx.moveTo(x + dir * 2, y + 4);
    ctx.lineTo(staffTopX, staffTopY);
    ctx.stroke();
    ctx.fillStyle = '#7a6ab0';
    ctx.beginPath();
    ctx.arc(staffTopX, staffTopY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#8b2500';
  } else {
    const swordTipX = x + dir * (4 * scale + swordLen * 0.8);
    const swordTipY = y + 4 + swordLen * 0.4;
    ctx.strokeStyle = isBossSummoner ? '#4a3a5a' : isCommander ? '#5a4a30' : '#5a5a5a';
    ctx.fillStyle = isBossSummoner ? '#6a5a7a' : isCommander ? '#8a7a50' : '#7a7a7a';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(x + dir * 4, y + 2);
    ctx.lineTo(swordTipX, swordTipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(swordTipX, swordTipY);
    ctx.lineTo(swordTipX - dir * 1.5, swordTipY - 0.8);
    ctx.lineTo(swordTipX + dir * 0.5, swordTipY + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = isBossSummoner ? '#5a2a6a' : isCommander ? '#4a3a20' : '#8b2500';
  }

  const phase = e.animPhase || 0;
  const step = Math.sin(phase) * legStep;
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x - 5 + step, footY);
  ctx.moveTo(x, hipY);
  ctx.lineTo(x + 5 - step, footY);
  ctx.stroke();

  if (wasCrit) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRIT!', x, y - 14);
  }
  if (e.frozenUntil && e.frozenUntil > Date.now()) {
    ctx.fillStyle = 'rgba(120,200,255,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (e.burningUntil && e.burningUntil > now) {
    const flicker = Math.sin(now * 0.015 + x) * 0.5 + 0.5;
    ctx.fillStyle = flicker > 0.5 ? '#ff9900' : '#cc4400';
    const offs = [[-8, -6], [6, -4], [-4, 8], [7, 5], [-7, 2], [3, -7]];
    offs.forEach(([ox, oy], i) => {
      const ax = x + ox + (Math.sin(now * 0.02 + i) * 2);
      const ay = y + oy + (Math.cos(now * 0.018 + i * 1.2) * 2);
      ctx.fillRect(Math.floor(ax - 1.5), Math.floor(ay - 1.5), 3, 3);
    });
  }
  ctx.strokeStyle = '#8b2500';
  ctx.lineWidth = 1.8 * scale;
}

/** 战狼：四足动物造型，身体、头（耳、口鼻）、四腿、尾巴 */
function drawAliveWolf(ctx, e, x, y, now) {
  const nameText = e.name || getEnemyTypeName(e.type);
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(200,190,170,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeText(nameText, x, y - 22);
  ctx.fillText(nameText, x, y - 22);
  ctx.restore();

  drawHealthBar(ctx, x, y - 12, 28, 3, e.hp, e.maxHp, true);
  const flashing = e.hitFlashUntil > now;
  const wasCrit = e.lastHitCrit && flashing;
  const dir = e.vx >= 0 ? 1 : -1;
  ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#4a4030';
  ctx.fillStyle = flashing ? '#a09070' : '#5a5040';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';

  const phase = e.animPhase || 0;
  const run = Math.sin(phase * 1.2) * 3;
  const run2 = Math.sin(phase * 1.2 + Math.PI) * 3;

  const bodyLen = 20;
  const bodyH = 6;
  const cx = x;
  const cy = y + 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir > 0 ? 0 : Math.PI);
  ctx.translate(-cx, -cy);
  const bx = cx;
  const headX = cx + (bodyLen / 2 + 6);
  const headY = cy;
  const tailX = cx - (bodyLen / 2 + 4);
  const fwd = 1;

  ctx.beginPath();
  ctx.ellipse(bx, cy, bodyLen / 2, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(headX, headY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(headX + fwd * 8, headY - 1);
  ctx.lineTo(headX + fwd * 14, headY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headX + fwd * 14, headY + 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(headX + fwd * 5, headY - 8);
  ctx.lineTo(headX + fwd * 8, headY - 12);
  ctx.stroke();
  ctx.moveTo(headX + fwd * 9, headY - 7);
  ctx.lineTo(headX + fwd * 12, headY - 11);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tailX, cy);
  ctx.quadraticCurveTo(tailX - fwd * 12 + run, cy - 6, tailX - fwd * 18, cy - 4);
  ctx.stroke();

  const legY = cy + bodyH - 1;
  const footY = legY + 10;
  ctx.beginPath();
  ctx.moveTo(bx + fwd * 8, legY);
  ctx.lineTo(bx + fwd * 8 + run, footY);
  ctx.moveTo(bx + fwd * 2, legY);
  ctx.lineTo(bx + fwd * 2 + run2, footY);
  ctx.moveTo(bx - fwd * 2, legY);
  ctx.lineTo(bx - fwd * 2 + run, footY);
  ctx.moveTo(bx - fwd * 8, legY);
  ctx.lineTo(bx - fwd * 8 + run2, footY);
  ctx.stroke();
  ctx.restore();

  if (e.frozenUntil && e.frozenUntil > Date.now()) {
    ctx.fillStyle = 'rgba(120,200,255,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (e.burningUntil && e.burningUntil > now) {
    const flicker = Math.sin(now * 0.015 + x) * 0.5 + 0.5;
    ctx.fillStyle = flicker > 0.5 ? '#ff9900' : '#cc4400';
    [[-6, -4], [8, -2], [-4, 6], [6, 4]].forEach(([ox, oy], i) => {
      const ax = x + ox + Math.sin(now * 0.02 + i) * 2;
      const ay = y + oy + Math.cos(now * 0.018 + i * 1.2) * 2;
      ctx.fillRect(Math.floor(ax - 1.5), Math.floor(ay - 1.5), 3, 3);
    });
  }
}

function drawDeadWolf(ctx, e, x, y) {
  const dir = (e.vx >= 0 ? 1 : -1);
  ctx.strokeStyle = '#4a4030';
  ctx.fillStyle = '#5a5040';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(x, y + 4);
  ctx.rotate(dir > 0 ? 0 : Math.PI);
  const bodyLen = 20;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLen / 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bodyLen / 2 + 6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-bodyLen / 2 - 2, 0);
  ctx.lineTo(-bodyLen / 2 - 14, -3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 4);
  ctx.lineTo(8 + 4, 10);
  ctx.moveTo(2, 4);
  ctx.lineTo(2 + 3, 11);
  ctx.moveTo(-2, 4);
  ctx.lineTo(-2 + 4, 10);
  ctx.moveTo(-8, 4);
  ctx.lineTo(-8 + 3, 11);
  ctx.stroke();
  ctx.restore();
}

/** 飞龙：龙身 + 双翼（扇动）+ 龙头 + 尾 + 背上骑士（持斧） */
function drawAliveDragon(ctx, e, x, y, now) {
  const nameText = e.name || getEnemyTypeName(e.type);
  ctx.save();
  ctx.font = e.type === 'dragon_warrior' ? '12px sans-serif' : '11px sans-serif';
  ctx.fillStyle = 'rgba(220,200,160,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeText(nameText, x, y - 28);
  ctx.fillText(nameText, x, y - 28);
  ctx.restore();

  drawHealthBar(ctx, x, y - 18, 32, 3, e.hp, e.maxHp, true);
  const flashing = e.hitFlashUntil > now;
  const wasCrit = e.lastHitCrit && flashing;
  const dir = e.vx >= 0 ? 1 : -1;
  const phase = e.animPhase || 0;
  const wingFlap = Math.sin(phase * 0.8) * 0.35;

  ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#2a3a2a';
  ctx.fillStyle = flashing ? '#7a9a6a' : e.type === 'dragon_warrior' ? '#3d5a38' : '#4a6b42';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';

  ctx.save();
  ctx.translate(x, y);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.translate(-x, -y);

  const bodyLen = 24;
  const bodyH = 8;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyLen / 2, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const headX = x + dir * (bodyLen / 2 + 6);
  const headY = y - 2;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX + dir * 10, headY);
  ctx.lineTo(headX + dir * 16, headY + 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headX + dir * 16, headY + 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const tailX = x - dir * (bodyLen / 2 + 10);
  ctx.beginPath();
  ctx.moveTo(x - dir * bodyLen / 2, y);
  ctx.quadraticCurveTo(tailX - dir * 4, y - 6, tailX - dir * 12, y - 4);
  ctx.stroke();

  const wingY = y - 4;
  const wingSpan = 14 + wingFlap * 6;
  ctx.beginPath();
  ctx.moveTo(x + dir * 4, wingY);
  ctx.quadraticCurveTo(x + dir * 18, wingY - wingSpan, x + dir * 22, wingY - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - dir * 4, wingY);
  ctx.quadraticCurveTo(x - dir * 18, wingY - wingSpan, x - dir * 22, wingY - 2);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = flashing ? '#c0a060' : '#8a7040';
  ctx.strokeStyle = '#5a4a30';
  const riderY = y - 12;
  ctx.beginPath();
  ctx.arc(x, riderY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, riderY);
  ctx.lineTo(x + dir * 10, riderY - 2);
  ctx.stroke();
  ctx.fillStyle = '#5a4a38';
  ctx.strokeStyle = '#3d3528';
  ctx.beginPath();
  ctx.ellipse(x + dir * 10, riderY - 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (e.frozenUntil && e.frozenUntil > Date.now()) {
    ctx.fillStyle = 'rgba(120,200,255,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (e.burningUntil && e.burningUntil > now) {
    const flicker = Math.sin(now * 0.015 + x) * 0.5 + 0.5;
    ctx.fillStyle = flicker > 0.5 ? '#ff9900' : '#cc4400';
    [[-10, -8], [12, -6], [-6, 10], [8, 6]].forEach(([ox, oy], i) => {
      const ax = x + ox + Math.sin(now * 0.02 + i) * 2;
      const ay = y + oy + Math.cos(now * 0.018 + i * 1.2) * 2;
      ctx.fillRect(Math.floor(ax - 1.5), Math.floor(ay - 1.5), 3, 3);
    });
  }
}

function drawDeadDragon(ctx, e, x, y) {
  const dir = e.vx >= 0 ? 1 : -1;
  const fallProgress = Math.min(1, e.fallProgress || 0);
  const phase = e.deathPhase || 'lying';

  ctx.strokeStyle = '#2a3a2a';
  ctx.fillStyle = '#4a6b42';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(x, y + fallProgress * 8);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.translate(-x, -y - fallProgress * 8);

  const bodyLen = 22;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyLen / 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + dir * (bodyLen / 2 + 4), y - 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - dir * bodyLen / 2, y);
  ctx.lineTo(x - dir * (bodyLen / 2 + 14), y - 2);
  ctx.stroke();
  ctx.restore();
}

function drawDeadEnemy(ctx, e, x, y, scale) {
  const bodyLen = 13 * scale;
  const fallProgress = Math.min(1, e.fallProgress || 0);
  const phase = e.deathPhase || 'lying';

  ctx.strokeStyle = '#6b3520';
  ctx.fillStyle = '#8a4530';
  ctx.lineWidth = 1.8 * scale;
  ctx.lineCap = 'round';

  if (phase === 'falling' && fallProgress < 1) {
    // Falling: body rotates from vertical to horizontal
    const angle = fallProgress * (Math.PI / 2);
    const half = bodyLen / 2;
    const cx = x;
    const cy = y + 3;
    const topX = cx - half * Math.sin(angle);
    const topY = cy - half * Math.cos(angle);
    const botX = cx + half * Math.sin(angle);
    const botY = cy + half * Math.cos(angle);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();
    const headR = 4 * scale * (1 - fallProgress * 0.3);
    ctx.beginPath();
    ctx.arc(topX, topY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(botX, botY);
    ctx.lineTo(botX - 6, botY + 8 + fallProgress * 4);
    ctx.moveTo(botX, botY);
    ctx.lineTo(botX + 6, botY + 8 + fallProgress * 4);
    ctx.stroke();
  } else {
    // Lying: flat corpse on ground
    const dir = (e.vx >= 0 ? 1 : -1);
    const half = bodyLen / 2;
    const bodyY = y + 5;
    ctx.beginPath();
    ctx.moveTo(x - half, bodyY);
    ctx.lineTo(x + half, bodyY);
    ctx.stroke();
    const headR = 3.5 * scale;
    const headX = x + dir * (half + headR * 0.8);
    ctx.beginPath();
    ctx.arc(headX, bodyY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + half, bodyY);
    ctx.lineTo(x + half + 4, bodyY + 6);
    ctx.moveTo(x + half, bodyY);
    ctx.lineTo(x + half - 2, bodyY + 7);
    ctx.moveTo(x - half, bodyY);
    ctx.lineTo(x - half - 4, bodyY + 5);
    ctx.moveTo(x - half, bodyY);
    ctx.lineTo(x - half + 2, bodyY + 6);
    ctx.stroke();
  }
}

/**
 * Check if point (px, py) hits any alive enemy. Returns the enemy or null.
 */
export function hitTestEnemies(state, px, py) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dSq = (e.x - px) ** 2 + (e.y - py) ** 2;
    if (dSq <= e.radius * e.radius) return e;
  }
  return null;
}
