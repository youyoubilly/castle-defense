/**
 * Castle artillery (炮兵): purchase in shop for 1000 gold. Fires cannonballs at enemies (slower, higher damage, small AOE).
 */

import { spawnBloodParticles } from './blood.js';

const ARTILLERY_Y_OFFSET = 42;
const ARTILLERY_X_OFFSET = 32;
const ARTILLERY_RANGE = 280;
const ARTILLERY_DAMAGE = 38;
const ARTILLERY_ATTACK_INTERVAL = 85;
const CANNONBALL_SPEED = 3.5;
const CANNONBALL_HIT_RADIUS = 22;
const CANNONBALL_AOE_RADIUS = 42;
const CANNONBALL_MAX_AGE = 150;

export function createArtillery(state) {
  state.artillery = state.artillery || [];
  return state.artillery;
}

export function addArtillery(state) {
  if (!state.artillery) state.artillery = [];
  const max = state.maxArtillery ?? 2;
  if (state.artillery.length >= max) return;
  const cx = state.castleCx;
  const cy = state.castleCy;
  const sign = state.artillery.length % 2 === 0 ? -1 : 1;
  state.artillery.push({
    x: cx + sign * ARTILLERY_X_OFFSET,
    y: cy - ARTILLERY_Y_OFFSET,
    range: state.artilleryRange ?? ARTILLERY_RANGE,
    damage: state.artilleryDamage ?? ARTILLERY_DAMAGE,
    attackInterval: state.artilleryAttackInterval ?? ARTILLERY_ATTACK_INTERVAL,
    lastAttackFrame: -(state.artillery.length * 30),
  });
}

export function updateArtilleryPositions(state) {
  if (!state.artillery || state.artillery.length === 0) return;
  const cx = state.castleCx;
  const cy = state.castleCy;
  state.artillery.forEach((a, i) => {
    const sign = i % 2 === 0 ? -1 : 1;
    a.x = cx + sign * (ARTILLERY_X_OFFSET + (state.artillery.length > 1 ? (i * 6 - 6) : 0));
    a.y = cy - ARTILLERY_Y_OFFSET;
  });
}

function shootCannonball(state, artillery, targetEnemy) {
  const dx = targetEnemy.x - artillery.x;
  const dy = targetEnemy.y - artillery.y;
  const len = Math.hypot(dx, dy) || 1;
  const baseDamage = Math.max(5, (artillery.damage ?? ARTILLERY_DAMAGE) - (targetEnemy.defense ?? 0) * 0.6);
  if (!state.cannonballs) state.cannonballs = [];
  state.cannonballs.push({
    x: artillery.x,
    y: artillery.y,
    vx: (dx / len) * CANNONBALL_SPEED,
    vy: (dy / len) * CANNONBALL_SPEED,
    baseDamage,
    target: targetEnemy,
    age: 0,
  });
}

export function applyArtilleryShoot(state) {
  if (!state.artillery || !state.enemies.length) return;
  const frame = state.frameCount || 0;

  state.artillery.forEach((art) => {
    if ((frame - art.lastAttackFrame) < (art.attackInterval ?? ARTILLERY_ATTACK_INTERVAL)) return;

    const range = art.range ?? ARTILLERY_RANGE;
    let nearest = null;
    let nearestDist = range;

    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - art.x, e.y - art.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      shootCannonball(state, art, nearest);
      art.lastAttackFrame = frame;
    }
  });
}

/**
 * Update cannonballs; on hit apply AOE damage and remove.
 */
export function updateCannonballs(state) {
  if (!state.cannonballs || state.cannonballs.length === 0) return;
  const w = state.width || 2000;
  const h = state.height || 1000;

  state.cannonballs = state.cannonballs.filter((cb) => {
    cb.x += cb.vx;
    cb.y += cb.vy;
    cb.age++;

    if (cb.age > CANNONBALL_MAX_AGE) return false;
    if (cb.x < -30 || cb.x > w + 30 || cb.y < -30 || cb.y > h + 30) return false;

    const hitX = cb.x;
    const hitY = cb.y;
    let hitAny = false;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x - hitX, e.y - hitY);
      if (dist > CANNONBALL_AOE_RADIUS) continue;
      hitAny = true;
      const factor = dist < CANNONBALL_HIT_RADIUS ? 1 : 1 - (dist - CANNONBALL_HIT_RADIUS) / (CANNONBALL_AOE_RADIUS - CANNONBALL_HIT_RADIUS);
      const damage = Math.max(1, Math.floor((cb.baseDamage ?? ARTILLERY_DAMAGE) * factor));
      e.hp -= damage;
      spawnBloodParticles(state, e.x, e.y, 3);
      e.hitFlashUntil = Date.now() + 350;
      e.lastHitCrit = false;
      if (e.hp <= 0) {
        e.alive = false;
        e.deadAt = Date.now();
        e.deathPhase = 'falling';
        e.fallProgress = 0;
        if (e.type === 'boss_king') e.spawnMinions = true;
        state.score = (state.score || 0) + 1;
        state.gold = (state.gold || 0) + (e.goldReward ?? state.goldPerKill ?? 8);
      }
    }
    if (hitAny) return false;
    return true;
  });
}

export function drawCannonballs(ctx, state) {
  if (!state.cannonballs || state.cannonballs.length === 0) return;

  state.cannonballs.forEach((cb) => {
    ctx.fillStyle = '#4a4a4a';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cb.x, cb.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

export function drawArtillery(ctx, state) {
  if (!state.artillery) return;
  const frame = state.frameCount || 0;

  state.artillery.forEach((a, i) => {
    const x = a.x;
    const y = a.y;
    ctx.strokeStyle = '#3d2817';
    ctx.fillStyle = '#6a5a4a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x, y + 8);
    ctx.stroke();

    // Cannon (thick short barrel)
    const recoil = Math.max(0, 1 - (frame - (a.lastAttackFrame || 0)) * 0.04) * 3;
    ctx.strokeStyle = '#3a3a3a';
    ctx.fillStyle = '#5a5a5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 2);
    ctx.lineTo(x + 14 - recoil, y - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 14 - recoil, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 1.5;
    // Legs
    const legPhase = Math.sin(frame * 0.04 + i) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x - 3 + legPhase * 2, y + 14);
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x + 3 - legPhase * 2, y + 14);
    ctx.stroke();
  });
}
