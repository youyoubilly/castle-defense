/**
 * Friendly soldiers: spawn in front of castle, draw as stick figures with shield.
 * In snow weather they wear sweaters.
 */

import { WEATHER_IDS } from './weather.js';
import { spawnArrowFrom } from './archers.js';

const SOLDIER_COUNT = 4;
const SOLDIER_SPACING = 45;
const SOLDIER_Y_OFFSET = 25;
const ENGAGEMENT_RANGE = 280;
const SOLDIER_MOVE_SPEED = 1.7;
const RETURN_SPEED = 2;
const FORMATION_SNAP_DIST = 6;
const HEAL_RATE = 2;
const SOLDIER_ARCHER_RANGE = 200;
const SOLDIER_ARCHER_INTERVAL = 42;
const INFIRMARY_OFFSET_Y = 35;

/** 士兵职业：卫兵(基础) 可升级为 战士/弓箭手/圣骑士 */
export const SOLDIER_CLASSES = {
  guard: { name: '卫兵', attack: 20, defense: 5, maxHp: 250 },
  warrior: { name: '战士', attack: 34, defense: 4, maxHp: 220 },
  archer: { name: '弓箭手', attack: 26, defense: 3, maxHp: 180 },
  paladin: { name: '圣骑士', attack: 24, defense: 16, maxHp: 320 },
};

/** 卫兵升级到其他职业的金币消耗 */
export const UPGRADE_COSTS = {
  warrior: 80,
  archer: 100,
  paladin: 120,
};

export function getSoldierClassName(classId) {
  return SOLDIER_CLASSES[classId]?.name ?? '卫兵';
}

/** 当前职业基础属性 + 全局加成 */
export function getSoldierClassStats(classId, state) {
  const c = SOLDIER_CLASSES[classId] || SOLDIER_CLASSES.guard;
  return {
    name: c.name,
    attack: c.attack + (state.soldierAttackBonus ?? 0),
    defense: c.defense + (state.soldierDefenseBonus ?? 0),
    maxHp: c.maxHp + (state.soldierHpBonus ?? 0),
  };
}

/** 仅卫兵可升级，返回可升级目标列表 */
export function getUpgradeOptions(soldier) {
  if ((soldier?.class || 'guard') !== 'guard') return [];
  return [
    { class: 'warrior', name: '战士', cost: UPGRADE_COSTS.warrior },
    { class: 'archer', name: '弓箭手', cost: UPGRADE_COSTS.archer },
    { class: 'paladin', name: '圣骑士', cost: UPGRADE_COSTS.paladin },
  ];
}

/** 将士兵升级为指定职业，扣金币并更新属性。仅卫兵可升级。 */
export function upgradeSoldierTo(state, soldier, newClassId) {
  if (!soldier || (soldier.class || 'guard') !== 'guard') return false;
  const cost = UPGRADE_COSTS[newClassId];
  if (cost == null || (state.gold ?? 0) < cost) return false;
  state.gold -= cost;
  soldier.class = newClassId;
  const stats = getSoldierClassStats(newClassId, state);
  soldier.attack = stats.attack;
  soldier.defense = stats.defense;
  soldier.maxHp = stats.maxHp;
  soldier.hp = Math.min(soldier.hp, soldier.maxHp);
  soldier.name = stats.name;
  return true;
}

/**
 * Create soldiers in a row in front of the castle. All start as 卫兵.
 */
export function createSoldiers(state) {
  const cx = state.castleCx;
  const cy = state.castleCy;
  const soldiers = [];
  const totalWidth = (SOLDIER_COUNT - 1) * SOLDIER_SPACING;
  const startX = cx - totalWidth / 2;
  const stats = getSoldierClassStats('guard', state);
  for (let i = 0; i < SOLDIER_COUNT; i++) {
    soldiers.push({
      x: startX + i * SOLDIER_SPACING,
      y: cy + SOLDIER_Y_OFFSET,
      direction: 1,
      isBlocking: false,
      class: 'guard',
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      defense: stats.defense,
      name: stats.name,
      status: 'field',
      formationIndex: i,
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
  const stats = getSoldierClassStats('guard', state);
  state.soldiers.push({
    x: formationX,
    y: formationY,
    direction: 1,
    isBlocking: false,
    class: 'guard',
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
    name: stats.name,
    status: 'field',
    formationIndex: count,
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
    const isArcher = (s.class || 'guard') === 'archer';

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

    if (nearest && !isArcher) {
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
 * Soldier archers (class === 'archer') shoot at nearest enemy in range; they do not melee.
 */
export function applySoldierArcherShoot(state) {
  const frame = state.frameCount || 0;
  const soldiers = state.soldiers || [];
  const enemies = (state.enemies || []).filter((e) => e.alive);

  for (const s of soldiers) {
    if ((s.class || 'guard') !== 'archer' || s.status !== 'field') continue;
    if ((frame - (s.lastArrowFrame || 0)) < SOLDIER_ARCHER_INTERVAL) continue;

    let nearest = null;
    let nearestDist = SOLDIER_ARCHER_RANGE;
    for (const e of enemies) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }
    if (!nearest) continue;

    const damage = s.attack ?? 26;
    spawnArrowFrom(state, s.x, s.y, nearest, damage);
    s.lastArrowFrame = frame;
  }
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
    const nameText = s.name || getSoldierClassName(s.class || 'guard');
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

    const sc = s.class || 'guard';

    // Arm (shield side) - one arm for shield
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x - 8, y + 5);
    ctx.stroke();

    // Weapon: sword (guard/warrior/paladin) or bow (archer)
    if (sc === 'archer') {
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x + 6, y + 1, 7, -0.5 * Math.PI, 0.4 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 1);
      ctx.lineTo(x + 10, y + 3);
      ctx.stroke();
    } else {
      const swordLen = sc === 'warrior' ? 14 : 10;
      const swordTipX = x + 6 + swordLen * 0.7;
      const swordTipY = y + 4 + swordLen * 0.7;
      ctx.strokeStyle = sc === 'warrior' ? '#8a6a5a' : '#6a7a8a';
      ctx.fillStyle = sc === 'warrior' ? '#a08070' : '#8a9aaa';
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
    }
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

    // Shield (archer has no shield; paladin has larger golden shield)
    if (sc !== 'archer') {
      const shieldW = sc === 'paladin' ? 14 : 10;
      const shieldH = sc === 'paladin' ? 18 : 14;
      ctx.fillStyle = sc === 'paladin' ? '#8a7a4a' : '#5a6a8a';
      ctx.strokeStyle = sc === 'paladin' ? '#5a4a2a' : '#2a3a5a';
      if (s.isBlocking) {
        ctx.fillRect(x + 4, y - 2, shieldW, shieldH);
        ctx.strokeRect(x + 4, y - 2, shieldW, shieldH);
      } else {
        ctx.fillRect(x - 4 - shieldW, y - 2, shieldW, shieldH);
        ctx.strokeRect(x - 4 - shieldW, y - 2, shieldW, shieldH);
      }
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
