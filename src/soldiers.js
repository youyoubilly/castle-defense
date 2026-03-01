/**
 * Friendly soldiers: spawn in front of castle, draw as stick figures with shield.
 * In snow weather they wear sweaters.
 */

import { WEATHER_IDS } from './weather.js';

const SOLDIER_COUNT = 4;
const SOLDIER_SPACING = 45;
const SOLDIER_Y_OFFSET = 25;
const SOLDIER_MAX_HP = 250;
const ENGAGEMENT_RANGE = 280;
const SOLDIER_MOVE_SPEED = 1.7;
const RETURN_SPEED = 2;
const FORMATION_SNAP_DIST = 6;
const HEAL_RATE = 2;
const INFIRMARY_OFFSET_Y = 35;

const SOLDIER_NAME = '卫兵';

/**
 * Create soldiers in a row in front of the castle.
 */
export function createSoldiers(state) {
  const cx = state.castleCx;
  const cy = state.castleCy;
  const soldiers = [];
  const totalWidth = (SOLDIER_COUNT - 1) * SOLDIER_SPACING;
  const startX = cx - totalWidth / 2;
  const maxHp = state.soldierMaxHp ?? SOLDIER_MAX_HP;
  for (let i = 0; i < SOLDIER_COUNT; i++) {
    soldiers.push({
      x: startX + i * SOLDIER_SPACING,
      y: cy + SOLDIER_Y_OFFSET,
      direction: 1,
      isBlocking: false,
      hp: maxHp,
      maxHp,
      status: 'field',
      formationIndex: i,
      name: SOLDIER_NAME,
    });
  }
  return soldiers;
}

/**
 * Update soldier positions: advance toward nearby enemies to attack, return to formation when none in range.
 */
export function addSoldier(state) {
  if (!state.soldiers) state.soldiers = [];
  const cx = state.castleCx;
  const cy = state.castleCy;
  const count = state.soldiers.length;
  const formationY = cy + SOLDIER_Y_OFFSET;
  const formationX = cx + (count * SOLDIER_SPACING) / 2;
  const maxHp = state.soldierMaxHp ?? SOLDIER_MAX_HP;
  state.soldiers.push({
    x: formationX,
    y: formationY,
    direction: 1,
    isBlocking: false,
    hp: maxHp,
    maxHp,
    status: 'field',
    formationIndex: count,
    name: SOLDIER_NAME,
  });
}

const SOLDIER_CLICK_RADIUS = 28;

/**
 * Return the soldier at (px, py) or null.
 */
export function hitTestSoldiers(state, px, py) {
  const soldiers = state.soldiers || [];
  for (const s of soldiers) {
    const d = Math.hypot(px - s.x, py - s.y);
    if (d <= SOLDIER_CLICK_RADIUS) return s;
  }
  return null;
}

export function updateSoldierPositions(state) {
  if (!state.soldiers || state.soldiers.length === 0) return;
  const cx = state.castleCx;
  const cy = state.castleCy;
  const totalWidth = (state.soldiers.length - 1) * SOLDIER_SPACING;
  const startX = cx - totalWidth / 2;
  const formationY = cy + SOLDIER_Y_OFFSET;
  const attackRange = state.soldierRange ?? 100;

  state.soldiers.forEach((s, i) => {
    if (s.status !== 'field') return;

    const formationX = startX + (s.formationIndex ?? i) * SOLDIER_SPACING;

    const aliveEnemies = (state.enemies || []).filter((e) => e.alive);
    let nearest = null;
    let nearestDist = ENGAGEMENT_RANGE;

    for (const e of aliveEnemies) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      const distToEnemy = Math.hypot(nearest.x - s.x, nearest.y - s.y);
      if (distToEnemy > attackRange) {
        const dx = nearest.x - s.x;
        const dy = nearest.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        s.x += (dx / len) * SOLDIER_MOVE_SPEED;
        s.y += (dy / len) * SOLDIER_MOVE_SPEED;
      }
    } else {
      const dx = formationX - s.x;
      const dy = formationY - s.y;
      const distToFormation = Math.hypot(dx, dy);
      if (distToFormation > FORMATION_SNAP_DIST) {
        const len = Math.hypot(dx, dy) || 1;
        s.x += (dx / len) * Math.min(RETURN_SPEED, distToFormation);
        s.y += (dy / len) * Math.min(RETURN_SPEED, distToFormation);
      } else {
        s.x = formationX;
        s.y = formationY;
      }
    }
  });
}

/**
 * Auto return when hp < 15; heal at infirmary; then return to field.
 */
export function updateSoldierReturnAndHeal(state) {
  if (!state.soldiers) return;
  const cx = state.castleCx;
  const cy = state.castleCy;
  const infirmaryY = cy + INFIRMARY_OFFSET_Y;
  const totalWidth = (state.soldiers.length - 1) * SOLDIER_SPACING;
  const startX = cx - totalWidth / 2;

  state.soldiers.forEach((s, i) => {
    if (s.status === 'field' && s.hp < 15) {
      s.status = 'returning';
      s.targetX = cx + (i - 1.5) * 18;
      s.targetY = infirmaryY;
    }
    if (s.status === 'returning') {
      const dx = (s.targetX ?? cx) - s.x;
      const dy = (s.targetY ?? infirmaryY) - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        s.status = 'healing';
        s.x = s.targetX;
        s.y = s.targetY;
      } else {
        s.x += (dx / dist) * 2;
        s.y += (dy / dist) * 2;
      }
    }
    if (s.status === 'healing') {
      s.hp = Math.min(s.maxHp, s.hp + HEAL_RATE);
      if (s.hp >= s.maxHp) {
        s.status = 'field';
        const formationX = startX + (s.formationIndex ?? i) * SOLDIER_SPACING;
        s.x = formationX;
        s.y = cy + SOLDIER_Y_OFFSET;
      }
    }
  });
}

/**
 * Draw health bar above soldier.
 */
function drawSoldierHealthBar(ctx, x, y, hp, maxHp) {
  const width = 24;
  const height = 3;
  const left = x - width / 2;
  const top = y - 18;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, width, height);
  const ratio = Math.max(0, Math.min(1, (hp || 0) / (maxHp || 1)));
  ctx.fillStyle = ratio > 0.4 ? '#4a8' : ratio > 0.2 ? '#6b9' : '#3a7';
  ctx.fillRect(left, top, width * ratio, height);
}

/**
 * Draw soldiers as stick figures (head, body, limbs) with shield and sword. Blue/armor color. Health bar above.
 * Draw returning/healing at current position; healing shows a small cross icon.
 */
export function drawSoldiers(ctx, state) {
  const now = Date.now();
  for (const s of state.soldiers) {
    const x = s.x;
    const y = s.y;
    const isHealing = s.status === 'healing';
    const isReturning = s.status === 'returning';
    const hitFlash = s.hitFlashUntil > now;
    const nameText = s.name || SOLDIER_NAME;
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(200,230,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeText(nameText, x, y - 20);
    ctx.fillText(nameText, x, y - 20);
    ctx.restore();
    drawSoldierHealthBar(ctx, x, y, s.hp, s.maxHp);
    ctx.strokeStyle = hitFlash ? '#5a7aaa' : '#2a4a6a';
    ctx.fillStyle = hitFlash ? '#6a8aba' : '#3a5a7a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const isSnow = state.weather?.current === WEATHER_IDS.SNOW;

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Body (sweater in snow, else normal)
    if (isSnow) {
      const torsoLeft = x - 6;
      const torsoTop = y - 5;
      const torsoW = 12;
      const torsoH = 16;
      ctx.fillStyle = hitFlash ? '#c4a574' : '#a08050';
      ctx.strokeStyle = hitFlash ? '#8a6a3a' : '#6a4a2a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(torsoLeft, torsoTop, torsoW, torsoH);
      ctx.strokeRect(torsoLeft, torsoTop, torsoW, torsoH);
      ctx.strokeStyle = '#5a3a1a';
      for (let row = 0; row < 4; row++) {
        const ly = torsoTop + 3 + row * 4;
        ctx.beginPath();
        ctx.moveTo(torsoLeft + 2, ly);
        ctx.lineTo(torsoLeft + torsoW - 2, ly);
        ctx.stroke();
      }
      ctx.strokeStyle = hitFlash ? '#5a7aaa' : '#2a4a6a';
      ctx.lineWidth = 2;
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }

    // Arm (shield side) - one arm for shield
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x - 8, y + 5);
    ctx.stroke();

    // Sword (other hand): blade from shoulder down-right, tip
    const swordLen = 10;
    const swordTipX = x + 6 + swordLen * 0.7;
    const swordTipY = y + 4 + swordLen * 0.7;
    ctx.strokeStyle = '#6a7a8a';
    ctx.fillStyle = '#8a9aaa';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    ctx.lineTo(swordTipX, swordTipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(swordTipX, swordTipY);
    ctx.lineTo(swordTipX - 2, swordTipY - 1);
    ctx.lineTo(swordTipX + 0.5, swordTipY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#2a4a6a';

    // Legs: two-segment with walk animation (slower, like walking in place)
    const phase = (state.frameCount || 0) * 0.06;
    const leftSwing = Math.sin(phase) * 2.5;
    const rightSwing = Math.sin(phase + Math.PI) * 2.5;
    const hipY = y + 10;
    const kneeY = y + 16;
    const footY = y + 22;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x - 4 + leftSwing * 0.5, kneeY);
    ctx.lineTo(x - 6 + leftSwing * 0.9, footY);
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + 4 + rightSwing * 0.5, kneeY);
    ctx.lineTo(x + 6 + rightSwing * 0.9, footY);
    ctx.stroke();

    // Shield (small rectangle on one side)
    const shieldW = 10;
    const shieldH = 14;
    ctx.fillStyle = '#5a6a8a';
    ctx.strokeStyle = '#2a3a5a';
    if (s.isBlocking) {
      ctx.fillRect(x + 4, y - 2, shieldW, shieldH);
      ctx.strokeRect(x + 4, y - 2, shieldW, shieldH);
    } else {
      ctx.fillRect(x - 4 - shieldW, y - 2, shieldW, shieldH);
      ctx.strokeRect(x - 4 - shieldW, y - 2, shieldW, shieldH);
    }

    if (isHealing) {
      ctx.fillStyle = '#8f0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', x, y - 18);
      ctx.strokeStyle = '#2a4a6a';
      ctx.fillStyle = '#3a5a7a';
    }
  }
}
