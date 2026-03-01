/**
 * Castle archers: stand on the tower, shoot at enemies in range.
 */

import { spawnBloodParticles } from './blood.js';

const ARCHER_COUNT = 2;
const TOWER_H = 70;
const ARCHER_Y_OFFSET = 18;
const ARCHER_X_OFFSET = 18;
const ARCHER_RANGE = 220;
const ARCHER_DAMAGE = 14;
const ARCHER_ATTACK_INTERVAL = 35;
const ARROW_SPEED = 6;
const ARROW_HIT_RADIUS = 14;
const ARROW_MAX_AGE = 90;

export function createArchers(state) {
  const cx = state.castleCx;
  const cy = state.castleCy;
  const archers = [];
  for (let i = 0; i < ARCHER_COUNT; i++) {
    const sign = i === 0 ? -1 : 1;
    archers.push({
      x: cx + sign * ARCHER_X_OFFSET,
      y: cy - TOWER_H + ARCHER_Y_OFFSET,
      range: state.archerRange ?? ARCHER_RANGE,
      damage: state.archerDamage ?? ARCHER_DAMAGE,
      attackInterval: state.archerAttackInterval ?? ARCHER_ATTACK_INTERVAL,
      lastAttackFrame: -i * 15,
    });
  }
  return archers;
}

export function updateArcherPositions(state) {
  if (!state.archers || state.archers.length === 0) return;
  const cx = state.castleCx;
  const cy = state.castleCy;
  state.archers.forEach((a, i) => {
    const sign = i === 0 ? -1 : 1;
    a.x = cx + sign * ARCHER_X_OFFSET;
    a.y = cy - TOWER_H + ARCHER_Y_OFFSET;
  });
}

/**
 * Spawn an arrow from archer toward target enemy. Damage applied when arrow hits (in updateArrows).
 */
function shootArrow(state, archer, targetEnemy) {
  const dx = targetEnemy.x - archer.x;
  const dy = targetEnemy.y - archer.y;
  const len = Math.hypot(dx, dy) || 1;
  const damage = Math.max(1, (archer.damage ?? ARCHER_DAMAGE) - (targetEnemy.defense ?? 0) * 0.5);
  if (!state.arrows) state.arrows = [];
  state.arrows.push({
    x: archer.x,
    y: archer.y,
    vx: (dx / len) * ARROW_SPEED,
    vy: (dy / len) * ARROW_SPEED,
    damage,
    target: targetEnemy,
    age: 0,
  });
}

/**
 * Archers shoot at nearest enemy in range: spawn visible arrow instead of instant damage.
 */
export function applyArcherShoot(state) {
  if (!state.archers || !state.enemies.length) return;
  const frame = state.frameCount || 0;

  state.archers.forEach((archer) => {
    if ((frame - archer.lastAttackFrame) < (archer.attackInterval ?? ARCHER_ATTACK_INTERVAL)) return;

    const range = archer.range ?? ARCHER_RANGE;
    let nearest = null;
    let nearestDist = range;

    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - archer.x, e.y - archer.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      shootArrow(state, archer, nearest);
      archer.lastAttackFrame = frame;
    }
  });
}

/**
 * Update arrow positions; apply damage and remove when hit or expired.
 */
export function updateArrows(state) {
  if (!state.arrows || state.arrows.length === 0) return;
  const w = state.width || 2000;
  const h = state.height || 1000;

  state.arrows = state.arrows.filter((arr) => {
    arr.x += arr.vx;
    arr.y += arr.vy;
    arr.age++;

    if (arr.age > ARROW_MAX_AGE) return false;
    if (arr.x < -20 || arr.x > w + 20 || arr.y < -20 || arr.y > h + 20) return false;

    if (!arr.target || !arr.target.alive) return false;

    const dist = Math.hypot(arr.x - arr.target.x, arr.y - arr.target.y);
    if (dist < ARROW_HIT_RADIUS) {
      arr.target.hp -= arr.damage;
      spawnBloodParticles(state, arr.target.x, arr.target.y, 4);
      arr.target.hitFlashUntil = Date.now() + 300;
      arr.target.lastHitCrit = false;
      if (arr.target.hp <= 0) {
        arr.target.alive = false;
        arr.target.deadAt = Date.now();
        arr.target.deathPhase = 'falling';
        arr.target.fallProgress = 0;
        state.score = (state.score || 0) + 1;
        state.gold = (state.gold || 0) + (arr.target.goldReward ?? state.goldPerKill ?? 8);
      }
      return false;
    }
    return true;
  });
}

/**
 * Draw flying arrows (visible line + tip).
 */
export function drawArrows(ctx, state) {
  if (!state.arrows || state.arrows.length === 0) return;

  state.arrows.forEach((arr) => {
    const len = 10;
    const tipX = arr.x + (arr.vx / ARROW_SPEED) * len;
    const tipY = arr.y + (arr.vy / ARROW_SPEED) * len;
    ctx.strokeStyle = '#8b7355';
    ctx.fillStyle = '#6b5344';
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
 * Draw archers on the castle tower (small stick figure with bow).
 */
export function drawArchers(ctx, state) {
  if (!state.archers) return;
  const frame = state.frameCount || 0;

  state.archers.forEach((a, i) => {
    const x = a.x;
    const y = a.y;
    ctx.strokeStyle = '#3d2817';
    ctx.fillStyle = '#5a4a3a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x, y + 6);
    ctx.stroke();

    // Bow arm (drawing) - slight animation when shooting
    const drawPhase = Math.sin((frame - (a.lastAttackFrame || 0)) * 0.3) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 + drawPhase * 2, y - 2);
    ctx.stroke();

    // Bow (arc)
    ctx.beginPath();
    ctx.arc(x + 5, y - 1, 5, -0.6 * Math.PI, 0.6 * Math.PI);
    ctx.stroke();

    // Other arm (holding bow)
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x + 4, y + 2);
    ctx.stroke();

    // Legs (slight stance animation)
    const legPhase = Math.sin(frame * 0.05 + i) * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x - 2 + legPhase * 2, y + 11);
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x + 2 - legPhase * 2, y + 11);
    ctx.stroke();
  });
}
