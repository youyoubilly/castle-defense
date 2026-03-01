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
  normal: { hp: 60, defense: 10, attack: 10, speed: 1.0, radius: 10, gold: 8, name: '步兵' },
  shield: { hp: 55, defense: 18, attack: 8, speed: 0.9, radius: 10, gold: 10, name: '盾卫' },
  heavy: { hp: 120, defense: 15, attack: 16, speed: 0.6, radius: 14, gold: 15, name: '重甲兵' },
  siege: { hp: 100, defense: 12, attack: 18, speed: 0.55, radius: 12, gold: 22, name: '攻城兵' },
  archer: { hp: 45, defense: 4, attack: 12, speed: 0.8, radius: 10, gold: 12, name: '敌弓箭手' },
};

const ENEMY_ARCHER_STOP_RANGE = 200;
const ENEMY_ARCHER_SHOOT_RANGE = 220;
const ENEMY_ARCHER_INTERVAL = 55;
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
  if (r < 0.50) return 'normal';
  if (r < 0.75) return 'shield';
  if (r < 0.90) return 'heavy';
  if (r < 0.97) return 'siege';
  return 'archer';
}

/** By wave: wave 1 easier (mostly normal), later waves more shield/heavy/siege. */
export function pickEnemyTypeByWave(wave) {
  const w = Math.max(1, wave || 1);
  const r = Math.random();
  if (w <= 1) {
    if (r < 0.78) return 'normal';
    if (r < 0.92) return 'shield';
    if (r < 0.98) return 'heavy';
    if (r < 0.995) return 'siege';
    return 'archer';
  }
  if (w <= 2) {
    if (r < 0.58) return 'normal';
    if (r < 0.80) return 'shield';
    if (r < 0.92) return 'heavy';
    if (r < 0.97) return 'siege';
    return 'archer';
  }
  if (w <= 3) {
    if (r < 0.46) return 'normal';
    if (r < 0.70) return 'shield';
    if (r < 0.86) return 'heavy';
    if (r < 0.94) return 'siege';
    return 'archer';
  }
  if (r < 0.38) return 'normal';
  if (r < 0.64) return 'shield';
  if (r < 0.82) return 'heavy';
  if (r < 0.92) return 'siege';
  return 'archer';
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

/** Target (tx, ty) = castle center. type: 'normal' | 'shield' | 'heavy' (default random). */
export function createEnemy(x, y, tx, ty, type) {
  const kind = type || pickEnemyType();
  const t = ENEMY_TYPES[kind];
  const dx = tx - x;
  const dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x,
    y,
    vx: (dx / len) * t.speed,
    vy: (dy / len) * t.speed,
    radius: t.radius,
    hp: t.hp,
    maxHp: t.hp,
    defense: t.defense,
    attack: t.attack,
    goldReward: t.gold,
    type: kind,
    name: t.name ?? getEnemyTypeName(kind),
    alive: true,
    lastAttackFrame: 0,
    lastShotFrame: 0,
  };
}

/**
 * Spawn one enemy from left or right; type by state.wave if wave-based.
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
  const y = groundY + (Math.random() - 0.5) * 40;
  const type = state.wave != null ? pickEnemyTypeByWave(state.wave) : pickEnemyType();
  const enemy = createEnemy(x, y, state.castleCx, state.castleCy, type);
  state.enemies.push(enemy);
}

/** Wave-based: spawn one enemy if wave fighting and interval elapsed. */
export function trySpawnWaveEnemy(state, width, height) {
  if (state.waveState !== 'fighting') return;
  if ((state.waveEnemiesSpawned ?? 0) >= (state.waveEnemiesToSpawn ?? 999)) return;
  const now = performance.now();
  const interval = getSpawnIntervalMs(state.wave);
  if (now - (state.lastSpawnTime ?? 0) < interval) return;
  state.lastSpawnTime = now;
  state.waveEnemiesSpawned = (state.waveEnemiesSpawned ?? 0) + 1;
  spawnEnemy(state, width, height);
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
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    let distToCastle = Math.hypot(e.x - state.castleCx, e.y - state.castleCy);
    if (e.type === 'archer' && distToCastle < ENEMY_ARCHER_STOP_RANGE && distToCastle > 0) {
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
    if (!e.alive || e.type !== 'archer') continue;
    if (e.frozenUntil && e.frozenUntil > Date.now()) continue;
    const distToCastle = Math.hypot(e.x - cx, e.y - cy);
    if (distToCastle > ENEMY_ARCHER_SHOOT_RANGE) continue;
    if ((frame - (e.lastShotFrame || 0)) < ENEMY_ARCHER_INTERVAL) continue;

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
    const scale = isHeavy ? 1.35 : 1;

    if (e.alive) {
      drawAliveEnemy(ctx, e, x, y, scale, isShield, isArcher, now);
    } else {
      drawDeadEnemy(ctx, e, x, y, scale);
    }
  }
}

function drawAliveEnemy(ctx, e, x, y, scale, isShield, isArcher, now) {
  const r = 4.5 * scale;
  const bodyLen = 8 * scale;
  const armLen = 7 * scale;
  const swordLen = 9 * scale;
  const legStep = 3.5 * scale;
  const hipY = y + bodyLen;
  const footY = y + 20 * scale;

  const nameText = e.name || getEnemyTypeName(e.type);
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
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
  ctx.strokeStyle = wasCrit ? '#ffcc00' : flashing ? '#fff' : '#8b2500';
  ctx.fillStyle = flashing ? '#e05030' : '#a03010';
  ctx.lineWidth = (wasCrit ? 2.5 : 1.8) * scale;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(x, y - 6, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

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
  } else if (!isArcher) {
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
  } else {
    const swordTipX = x + dir * (4 * scale + swordLen * 0.8);
    const swordTipY = y + 4 + swordLen * 0.4;
    ctx.strokeStyle = '#5a5a5a';
    ctx.fillStyle = '#7a7a7a';
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
    ctx.strokeStyle = '#8b2500';
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
