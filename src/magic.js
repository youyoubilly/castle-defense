/**
 * Player magic skills: fire rain (AOE), fire arrow (projectiles), freeze (AOE).
 * Click skill button to select, then click on canvas to cast. Each skill has cooldown.
 * Weather affects: some skills enhanced (e.g. freeze in hail), some limited (e.g. missile in hail, fire in rain).
 */

import { spawnBloodParticles } from './blood.js';
import { WEATHER_IDS } from './weather.js';

export const SKILL_IDS = {
  FIRE_RAIN: 'fire_rain',
  FIRE_ARROW: 'fire_arrow',
  FREEZE: 'freeze',
  FIRE_SEA: 'fire_sea',
  MISSILE: 'missile',
  ICE_ARROW: 'ice_arrow',
  FROST_RING: 'frost_ring',
  BALLISTA: 'ballista',
  VOLLEY: 'volley',
};

export const SKILL_MAX_LEVEL = 5;

/** 机械类技能（导弹、弩炮、齐射）每次施放需消耗金币，同时保留冷却 */
const MECHANICAL_SKILL_IDS = [SKILL_IDS.MISSILE, SKILL_IDS.BALLISTA, SKILL_IDS.VOLLEY];
const MECHANICAL_SKILL_GOLD = {
  [SKILL_IDS.MISSILE]: 35,
  [SKILL_IDS.BALLISTA]: 45,
  [SKILL_IDS.VOLLEY]: 28,
};
export function isMechanicalSkill(skillId) {
  return MECHANICAL_SKILL_IDS.includes(skillId);
}
export function getMechanicalSkillGoldCost(skillId) {
  return MECHANICAL_SKILL_GOLD[skillId] ?? 0;
}

/** 升级到下一级所需金币：Lv1→2=60, 2→3=120, 3→4=200, 4→5=320 */
export function getSkillUpgradeCost(currentLevel) {
  const costs = [60, 120, 200, 320];
  return currentLevel >= SKILL_MAX_LEVEL ? 0 : (costs[currentLevel - 1] ?? 320);
}

/** 技能等级对应的伤害/范围/持续时间倍数（1级=1.0，5级约 1.35 / 1.2 / 1.25） */
function getSkillMultiplier(level) {
  const L = Math.max(1, Math.min(SKILL_MAX_LEVEL, level || 1));
  return {
    damage: 1 + (L - 1) * 0.09,
    radius: 1 + (L - 1) * 0.05,
    duration: 1 + (L - 1) * 0.06,
  };
}

const COOLDOWN_MS = {
  [SKILL_IDS.FIRE_RAIN]: 22000,
  [SKILL_IDS.FIRE_ARROW]: 20000,
  [SKILL_IDS.FREEZE]: 24000,
  [SKILL_IDS.FIRE_SEA]: 26000,
  [SKILL_IDS.MISSILE]: 28000,
  [SKILL_IDS.ICE_ARROW]: 18000,
  [SKILL_IDS.FROST_RING]: 20000,
  [SKILL_IDS.BALLISTA]: 24000,
  [SKILL_IDS.VOLLEY]: 22000,
};

const FIRE_RAIN_RADIUS = 88;
const FIRE_RAIN_DAMAGE = 52;
const FIRE_RAIN_PARTICLES = 40;
const FIRE_RAIN_DURATION = 95; // 粒子从天上落下的存活帧数
const FIRE_RAIN_AOE_VISIBLE_MS = 400;
const FIRE_RAIN_SPAWN_TOP_OFFSET = 120; // 从画布上方多高处开始坠落

const FIRE_ARROW_COUNT = 3;
const FIRE_ARROW_SPEED = 11;
const FIRE_ARROW_DAMAGE = 42;
const FIRE_ARROW_SPREAD = 0.28;
const FIRE_ARROW_HIT_R = 24;
const FIRE_ARROW_AIM_RANGE = 280;

const FREEZE_RADIUS = 78;
const FREEZE_DURATION_MS = 3500;

const FIRE_SEA_LENGTH = 100;
const FIRE_SEA_WIDTH = 28;
const FIRE_SEA_DURATION_MS = 6200;
const FIRE_SEA_DAMAGE_PER_TICK = 7;
const FIRE_SEA_TICK_MS = 380;
const FIRE_SEA_PARTICLE_SPAWN_INTERVAL = 4;
const FIRE_SEA_PIXEL_SIZE = 8;
const FIRE_SEA_ALPHA = 0.82;
const FIRE_SEA_PALETTE = ['#1a0800', '#441100', '#882200', '#cc4400', '#ff6600', '#ff9900', '#ffcc00', '#ffee88'];
const BURN_DURATION_MS = 2600;
const BURN_DOT_DAMAGE = 2;
const BURN_TICK_MS = 420;

const MISSILE_EXPLODE_RADIUS = 95;
const MISSILE_DAMAGE = 65;
const MISSILE_EXPLOSION_DURATION_MS = 450;
const MISSILE_ARC_HEIGHT_RATIO = 0.4;
const MISSILE_BASE_FRAMES = 55;
const MISSILE_FRAMES_PER_DIST = 0.12;

const ICE_ARROW_SPEED = 13;
const ICE_ARROW_DAMAGE = 32;
const ICE_ARROW_SLOW_MS = 1800;
const ICE_ARROW_HIT_R = 16;

const FROST_RING_RADIUS = 55;
const FROST_RING_DAMAGE = 22;
const FROST_RING_FREEZE_MS = 2000;
const FROST_RING_VISIBLE_MS = 800;

const BALLISTA_SPEED = 18;
const BALLISTA_DAMAGE = 78;
const BALLISTA_HIT_R = 20;

const VOLLEY_COUNT = 5;
const VOLLEY_SPREAD = 0.35;
const VOLLEY_DAMAGE = 18;
const VOLLEY_SPEED = 14;
const VOLLEY_HIT_R = 22;
const VOLLEY_AOE_R = 28;

/** 魔法伤害：受敌方魔法防御减免 */
function magicDamageRaw(damage, enemy) {
  return Math.max(1, Math.floor(damage) - (enemy.magicDefense ?? 0));
}

/** 点到线段 (x1,y1)-(x2,y2) 的距离 */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= 0) return Math.hypot(px - x1, py - y1);
  if (c1 >= c2) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const qx = x1 + t * vx;
  const qy = y1 + t * vy;
  return Math.hypot(px - qx, py - qy);
}

/** 根据火海区域（中心、长度、宽度、角度）得到线段端点 */
function fireSeaSegment(zone) {
  const half = (zone.length || FIRE_SEA_LENGTH) / 2;
  const a = zone.angle ?? 0;
  const cx = zone.x;
  const cy = zone.y;
  return {
    x1: cx - half * Math.cos(a),
    y1: cy - half * Math.sin(a),
    x2: cx + half * Math.cos(a),
    y2: cy + half * Math.sin(a),
  };
}

export function initMagic(state) {
  state.magic = state.magic || {};
  const m = state.magic;
  m.selectedSkill = null;
  m.cooldownUntil = m.cooldownUntil || {};
  m.cooldownUntil[SKILL_IDS.FIRE_RAIN] = 0;
  m.cooldownUntil[SKILL_IDS.FIRE_ARROW] = 0;
  m.cooldownUntil[SKILL_IDS.FREEZE] = 0;
  m.cooldownUntil[SKILL_IDS.FIRE_SEA] = 0;
  m.cooldownUntil[SKILL_IDS.MISSILE] = 0;
  m.cooldownUntil[SKILL_IDS.ICE_ARROW] = 0;
  m.cooldownUntil[SKILL_IDS.FROST_RING] = 0;
  m.cooldownUntil[SKILL_IDS.BALLISTA] = 0;
  m.cooldownUntil[SKILL_IDS.VOLLEY] = 0;
  m.skillLevels = m.skillLevels || {
    [SKILL_IDS.FIRE_RAIN]: 1,
    [SKILL_IDS.FIRE_ARROW]: 1,
    [SKILL_IDS.FREEZE]: 1,
    [SKILL_IDS.FIRE_SEA]: 1,
    [SKILL_IDS.MISSILE]: 1,
    [SKILL_IDS.ICE_ARROW]: 1,
    [SKILL_IDS.FROST_RING]: 1,
    [SKILL_IDS.BALLISTA]: 1,
    [SKILL_IDS.VOLLEY]: 1,
  };
  m.fireRainEffects = m.fireRainEffects || [];
  m.fireArrows = m.fireArrows || [];
  m.fireSeas = m.fireSeas || [];
  m.missiles = m.missiles || [];
  m.iceArrows = m.iceArrows || [];
  m.frostRings = m.frostRings || [];
  m.ballistaBolts = m.ballistaBolts || [];
  m.volleyArrows = m.volleyArrows || [];
}

export function getSkillLevel(state, skillId) {
  return Math.max(1, Math.min(SKILL_MAX_LEVEL, state.magic?.skillLevels?.[skillId] ?? 1));
}

export function upgradeSkill(state, skillId) {
  const m = state.magic;
  if (!m || !skillId) return false;
  const cur = getSkillLevel(state, skillId);
  if (cur >= SKILL_MAX_LEVEL) return false;
  const cost = getSkillUpgradeCost(cur);
  if ((state.gold ?? 0) < cost) return false;
  state.gold -= cost;
  m.skillLevels[skillId] = (m.skillLevels[skillId] ?? 1) + 1;
  return true;
}

function isOnCooldown(state, skillId) {
  return (state.magic?.cooldownUntil?.[skillId] ?? 0) > Date.now();
}

/** 冷却时间随等级略微缩短；城堡法术支援可再减 8% */
function getCooldownMs(state, skillId) {
  const base = COOLDOWN_MS[skillId] ?? 20000;
  const level = getSkillLevel(state, skillId);
  const factor = 1 - (level - 1) * 0.05;
  let ms = Math.max(base * 0.6, Math.floor(base * factor));
  if (state.castleSpellSupport) ms = Math.floor(ms * 0.92);
  return ms;
}

const WEATHER_RAIN_LIKE = [WEATHER_IDS.RAIN, WEATHER_IDS.HEAVY_RAIN, WEATHER_IDS.THUNDERSTORM, WEATHER_IDS.STORM];

/**
 * 天气对技能的影响：能否使用、伤害/范围/持续时间倍数、额外伤害（如冰雹下冻结）
 * @returns {{ canUse: boolean, damageMult: number, radiusMult: number, durationMult: number, extraDamage: number, reason?: string }}
 */
function getWeatherSkillModifiers(state, skillId) {
  const weather = state.weather?.current ?? WEATHER_IDS.SUNNY;
  const def = { canUse: true, damageMult: 1, radiusMult: 1, durationMult: 1, extraDamage: 0 };

  if (skillId === SKILL_IDS.MISSILE) {
    if (weather === WEATHER_IDS.HAIL) {
      return { ...def, canUse: false, reason: '冰雹天气无法使用导弹' };
    }
  }

  if (skillId === SKILL_IDS.FREEZE) {
    if (weather === WEATHER_IDS.HAIL) {
      return { ...def, radiusMult: 1.35, extraDamage: 12 };
    }
    if (weather === WEATHER_IDS.SNOW) {
      return { ...def, durationMult: 1.15, radiusMult: 1.08 };
    }
  }

  if (skillId === SKILL_IDS.FIRE_RAIN || skillId === SKILL_IDS.FIRE_SEA) {
    if (WEATHER_RAIN_LIKE.includes(weather)) {
      return { ...def, damageMult: 0.38 };
    }
    if (weather === WEATHER_IDS.SUNNY) {
      return { ...def, damageMult: 1.12 };
    }
  }

  if (skillId === SKILL_IDS.FIRE_ARROW) {
    if (WEATHER_RAIN_LIKE.includes(weather)) return { ...def, damageMult: 0.75 };
    if (weather === WEATHER_IDS.SUNNY) return { ...def, damageMult: 1.1 };
  }

  if (skillId === SKILL_IDS.ICE_ARROW || skillId === SKILL_IDS.FROST_RING) {
    if (weather === WEATHER_IDS.HAIL) return { ...def, damageMult: 1.25, radiusMult: 1.15 };
    if (weather === WEATHER_IDS.SNOW) return { ...def, damageMult: 1.12, durationMult: 1.1 };
  }

  if (skillId === SKILL_IDS.BALLISTA || skillId === SKILL_IDS.VOLLEY) {
    if (weather === WEATHER_IDS.HAIL) return { ...def, canUse: false, reason: '冰雹天气无法使用机械技能' };
  }

  return def;
}

/** 当前天气下该技能是否可用（用于禁用按钮与提示） */
export function canUseSkillInWeather(state, skillId) {
  return getWeatherSkillModifiers(state, skillId).canUse;
}

/** 获取天气导致的不可用原因（如「冰雹天气无法使用导弹」） */
export function getSkillWeatherReason(state, skillId) {
  const m = getWeatherSkillModifiers(state, skillId);
  return m.reason ?? null;
}

export function tryCastMagic(state, x, y) {
  const m = state.magic;
  if (!m || !m.selectedSkill) return false;
  const skill = m.selectedSkill;
  if (isOnCooldown(state, skill)) return false;
  const weatherMod = getWeatherSkillModifiers(state, skill);
  if (!weatherMod.canUse) {
    m.selectedSkill = null;
    return false;
  }
  const goldCost = getMechanicalSkillGoldCost(skill);
  if (goldCost > 0 && (state.gold ?? 0) < goldCost) {
    m.selectedSkill = null;
    return false;
  }

  const now = Date.now();
  if (goldCost > 0) state.gold = (state.gold ?? 0) - goldCost;
  m.cooldownUntil[skill] = now + getCooldownMs(state, skill);
  m.selectedSkill = null;

  if (skill === SKILL_IDS.FIRE_RAIN) {
    castFireRain(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.FIRE_ARROW) {
    castFireArrow(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.FREEZE) {
    castFreeze(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.FIRE_SEA) {
    castFireSea(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.MISSILE) {
    castMissile(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.ICE_ARROW) {
    castIceArrow(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.FROST_RING) {
    castFrostRing(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.BALLISTA) {
    castBallista(state, x, y, weatherMod);
    return true;
  }
  if (skill === SKILL_IDS.VOLLEY) {
    castVolley(state, x, y, weatherMod);
    return true;
  }
  return false;
}

function castFireRain(state, x, y, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.FIRE_RAIN);
  const mult = getSkillMultiplier(level);
  const radius = Math.floor(FIRE_RAIN_RADIUS * mult.radius * (weatherMod?.radiusMult ?? 1));
  const damage = Math.floor(FIRE_RAIN_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));

  const w = state.width || 800;
  const h = state.height || 600;
  const particles = [];
  for (let i = 0; i < FIRE_RAIN_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const fallX = x + Math.cos(angle) * r;
    const startY = -FIRE_RAIN_SPAWN_TOP_OFFSET - Math.random() * 80;
    particles.push({
      x: fallX,
      y: startY,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 2 + Math.random() * 4,
      life: FIRE_RAIN_DURATION,
      maxLife: FIRE_RAIN_DURATION,
      r: 2 + Math.random() * 3,
    });
  }
  state.magic.fireRainEffects.push({
    cx: x,
    cy: y,
    radius,
    damage,
    applied: false,
    particles,
    createdAt: state.frameCount || 0,
    castAt: Date.now(),
  });

  const enemies = state.enemies || [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= radius) {
      const raw = magicDamageRaw(damage, e);
      e.hp -= raw;
      e.hitFlashUntil = Date.now() + 400;
      e.lastHitCrit = false;
      spawnBloodParticles(state, e.x, e.y, 4);
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

function castFireArrow(state, x, y, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.FIRE_ARROW);
  const mult = getSkillMultiplier(level);
  const damage = Math.floor(FIRE_ARROW_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));

  const enemies = (state.enemies || []).filter((e) => e.alive);
  let aimAngle = Math.PI * 0.5;
  let nearestDist = FIRE_ARROW_AIM_RANGE;
  let hasTarget = false;
  for (const e of enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < nearestDist) {
      nearestDist = d;
      aimAngle = Math.atan2(e.y - y, e.x - x);
      hasTarget = true;
    }
  }
  const spread = hasTarget ? FIRE_ARROW_SPREAD : 0.55;
  for (let i = 0; i < FIRE_ARROW_COUNT; i++) {
    const s = (i - (FIRE_ARROW_COUNT - 1) / 2) * spread;
    const angle = aimAngle + s;
    state.magic.fireArrows.push({
      x,
      y,
      vx: Math.cos(angle) * FIRE_ARROW_SPEED,
      vy: Math.sin(angle) * FIRE_ARROW_SPEED,
      damage,
      hit: false,
    });
  }
}

function castFreeze(state, x, y, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.FREEZE);
  const mult = getSkillMultiplier(level);
  const durationMult = (weatherMod?.durationMult ?? 1);
  const radiusMult = (weatherMod?.radiusMult ?? 1);
  const durationMs = Math.floor(FREEZE_DURATION_MS * mult.duration * durationMult);
  const radius = Math.floor(FREEZE_RADIUS * mult.radius * radiusMult);
  const extraDamage = weatherMod?.extraDamage ?? 0;
  const until = Date.now() + durationMs;

  const enemies = state.enemies || [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= radius) {
      e.frozenUntil = Math.max(e.frozenUntil || 0, until);
      if (extraDamage > 0) {
        e.hp = Math.max(0, (e.hp ?? e.maxHp) - extraDamage);
        e.hitFlashUntil = Date.now() + 300;
        spawnBloodParticles(state, e.x, e.y, 3);
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
  state.magic.lastFreezeAt = { x, y, until, radius };
}

function castFireSea(state, x, y, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.FIRE_SEA);
  const mult = getSkillMultiplier(level);
  const damageMult = weatherMod?.damageMult ?? 1;
  const durationMs = Math.floor(FIRE_SEA_DURATION_MS * mult.duration);
  const damagePerTick = Math.max(1, Math.floor(FIRE_SEA_DAMAGE_PER_TICK * mult.damage * damageMult));
  const length = Math.floor(FIRE_SEA_LENGTH * mult.radius);
  const width = Math.floor(FIRE_SEA_WIDTH * mult.radius);

  const now = Date.now();
  state.magic.fireSeas = state.magic.fireSeas || [];
  const zone = {
    x,
    y,
    length,
    width,
    durationMs,
    damagePerTick,
    angle: 0,
    createdAt: now,
    lastTick: now,
    particles: [],
    spawnCounter: 0,
  };
  const seg = fireSeaSegment(zone);
  for (let i = 0; i < 25; i++) {
    const t = Math.random();
    const px = seg.x1 + t * (seg.x2 - seg.x1) + (Math.random() - 0.5) * zone.width;
    const py = seg.y1 + t * (seg.y2 - seg.y1) + (Math.random() - 0.5) * zone.width;
    zone.particles.push({
      px,
      py,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.6 - Math.random() * 1.2,
      life: 20 + Math.floor(Math.random() * 35),
      maxLife: 55,
      r: 1.5 + Math.random() * 2.5,
    });
  }
  state.magic.fireSeas.push(zone);
}

function castMissile(state, targetX, targetY, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.MISSILE);
  const mult = getSkillMultiplier(level);
  const damage = Math.floor(MISSILE_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));
  const radius = Math.floor(MISSILE_EXPLODE_RADIUS * mult.radius * (weatherMod?.radiusMult ?? 1));

  const cx = state.castleCx ?? state.width / 2;
  const cy = state.castleCy ?? state.height * 0.75;
  const dist = Math.hypot(targetX - cx, targetY - cy) || 1;
  const totalFrames = Math.max(40, Math.min(120, MISSILE_BASE_FRAMES + dist * MISSILE_FRAMES_PER_DIST));
  const arcHeight = dist * MISSILE_ARC_HEIGHT_RATIO;
  state.magic.missiles = state.magic.missiles || [];
  state.magic.missiles.push({
    startX: cx,
    startY: cy,
    targetX: targetX,
    targetY: targetY,
    t: 0,
    tIncrement: 1 / totalFrames,
    arcHeight,
    damage,
    radius,
    exploded: false,
    explosionAt: 0,
  });
}

function castIceArrow(state, targetX, targetY, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.ICE_ARROW);
  const mult = getSkillMultiplier(level);
  const damage = Math.floor(ICE_ARROW_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));
  const slowMs = Math.floor(ICE_ARROW_SLOW_MS * mult.duration * (weatherMod?.durationMult ?? 1));
  const cx = state.castleCx ?? state.width / 2;
  const cy = state.castleCy ?? state.height * 0.75;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const len = Math.hypot(dx, dy) || 1;
  state.magic.iceArrows = state.magic.iceArrows || [];
  state.magic.iceArrows.push({
    x: cx,
    y: cy,
    vx: (dx / len) * ICE_ARROW_SPEED,
    vy: (dy / len) * ICE_ARROW_SPEED,
    damage,
    slowMs,
    hit: false,
  });
}

function castFrostRing(state, x, y, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.FROST_RING);
  const mult = getSkillMultiplier(level);
  const radius = Math.floor(FROST_RING_RADIUS * mult.radius * (weatherMod?.radiusMult ?? 1));
  const damage = Math.floor(FROST_RING_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));
  const freezeMs = Math.floor(FROST_RING_FREEZE_MS * mult.duration * (weatherMod?.durationMult ?? 1));
  const until = Date.now() + freezeMs;
  const enemies = state.enemies || [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= radius) {
      e.frozenUntil = Math.max(e.frozenUntil || 0, until);
      e.hp = Math.max(0, (e.hp ?? e.maxHp) - magicDamageRaw(damage, e));
      e.hitFlashUntil = Date.now() + 280;
      spawnBloodParticles(state, e.x, e.y, 3);
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
  state.magic.frostRings = state.magic.frostRings || [];
  state.magic.frostRings.push({ x, y, radius, castAt: Date.now() });
}

/** 弩炮每升 1 级可多穿透 1 名敌人（1 级=1 人，5 级=5 人） */
function castBallista(state, targetX, targetY, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.BALLISTA);
  const mult = getSkillMultiplier(level);
  const damage = Math.floor(BALLISTA_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));
  const cx = state.castleCx ?? state.width / 2;
  const cy = state.castleCy ?? state.height * 0.75;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const maxHits = Math.max(1, level);
  state.magic.ballistaBolts = state.magic.ballistaBolts || [];
  state.magic.ballistaBolts.push({
    x: cx,
    y: cy,
    vx: (dx / len) * BALLISTA_SPEED,
    vy: (dy / len) * BALLISTA_SPEED,
    damage,
    hit: false,
    maxHits,
    hitEnemies: [],
  });
}

function castVolley(state, targetX, targetY, weatherMod) {
  const level = getSkillLevel(state, SKILL_IDS.VOLLEY);
  const mult = getSkillMultiplier(level);
  const damage = Math.floor(VOLLEY_DAMAGE * mult.damage * (weatherMod?.damageMult ?? 1));
  const cx = state.castleCx ?? state.width / 2;
  const cy = state.castleCy ?? state.height * 0.75;
  const baseAngle = Math.atan2(targetY - cy, targetX - cx);
  state.magic.volleyArrows = state.magic.volleyArrows || [];
  for (let i = 0; i < VOLLEY_COUNT; i++) {
    const s = (i - (VOLLEY_COUNT - 1) / 2) * VOLLEY_SPREAD;
    const angle = baseAngle + s;
    state.magic.volleyArrows.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * VOLLEY_SPEED,
      vy: Math.sin(angle) * VOLLEY_SPEED,
      damage,
      hit: false,
    });
  }
}

export function updateMagic(state) {
  const m = state.magic;
  if (!m) return;
  const w = state.width || 800;
  const h = state.height || 600;

  m.fireRainEffects = (m.fireRainEffects || []).filter((eff) => {
    eff.particles = eff.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      return p.life > 0;
    });
    return eff.particles.length > 0;
  });

  m.fireArrows = (m.fireArrows || []).filter((arr) => {
    if (arr.hit) return false;
    arr.x += arr.vx;
    arr.y += arr.vy;
    if (arr.x < -30 || arr.x > w + 30 || arr.y < -30 || arr.y > h + 30) return false;
    const enemies = state.enemies || [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(arr.x - e.x, arr.y - e.y);
      if (d < FIRE_ARROW_HIT_R) {
        const raw = magicDamageRaw(arr.damage, e);
        e.hp -= raw;
        e.hitFlashUntil = Date.now() + 350;
        e.lastHitCrit = false;
        spawnBloodParticles(state, e.x, e.y, 4);
        if (e.hp <= 0) {
          e.alive = false;
          e.deadAt = Date.now();
          e.deathPhase = 'falling';
          e.fallProgress = 0;
          state.score = (state.score || 0) + 1;
          state.gold = (state.gold || 0) + (e.goldReward ?? state.goldPerKill ?? 8);
        }
        arr.hit = true;
        return false;
      }
    }
    return true;
  });

  const now = Date.now();
  (m.fireSeas || []).forEach((zone) => {
    const durationMs = zone.durationMs ?? FIRE_SEA_DURATION_MS;
    const zoneAge = now - zone.createdAt;
    const zoneLife = Math.max(0, 1 - zoneAge / durationMs);
    const seg = fireSeaSegment(zone);
    const halfWidth = (zone.width ?? FIRE_SEA_WIDTH) / 2;
    if (now - zone.lastTick >= FIRE_SEA_TICK_MS) {
      zone.lastTick = now;
      const enemies = state.enemies || [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = distanceToSegment(e.x, e.y, seg.x1, seg.y1, seg.x2, seg.y2);
        if (d <= halfWidth) {
          const baseRaw = magicDamageRaw(zone.damagePerTick ?? FIRE_SEA_DAMAGE_PER_TICK, e);
          const raw = Math.max(0, Math.floor(baseRaw * zoneLife));
          if (raw > 0) {
            e.hp -= raw;
            e.hitFlashUntil = Date.now() + 200;
            e.lastHitCrit = false;
            spawnBloodParticles(state, e.x, e.y, 2);
            e.burningUntil = Math.max(e.burningUntil || 0, now + BURN_DURATION_MS);
            e.lastBurnTick = e.lastBurnTick || now;
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
    }
    zone.spawnCounter = (zone.spawnCounter || 0) + 1;
    if (zone.spawnCounter % FIRE_SEA_PARTICLE_SPAWN_INTERVAL === 0 && zone.particles) {
      const t = Math.random();
      const nx = seg.x2 - seg.x1;
      const ny = seg.y2 - seg.y1;
      const perpX = -ny;
      const perpY = nx;
      const len = Math.hypot(perpX, perpY) || 1;
      const off = (Math.random() - 0.5) * (zone.width ?? FIRE_SEA_WIDTH);
      zone.particles.push({
        px: seg.x1 + t * nx + (perpX / len) * off,
        py: seg.y1 + t * ny + (perpY / len) * off,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.5 - Math.random() * 1,
        life: 25 + Math.floor(Math.random() * 30),
        maxLife: 55,
        r: 1.2 + Math.random() * 2,
      });
    }
    if (zone.particles) {
      const midY = zone.y;
      zone.particles = zone.particles.filter((p) => {
        p.px += p.vx;
        p.py += p.vy;
        p.vy -= 0.008;
        p.life--;
        return p.life > 0 && p.py > midY - (zone.length || FIRE_SEA_LENGTH) - 20;
      });
    }
  });
  m.fireSeas = (m.fireSeas || []).filter((z) => now - z.createdAt < (z.durationMs ?? FIRE_SEA_DURATION_MS));

  (m.missiles || []).forEach((missile) => {
    if (missile.exploded) return;
    const t = missile.t;
    const sx = missile.startX;
    const sy = missile.startY;
    const tx = missile.targetX;
    const ty = missile.targetY;
    const ah = missile.arcHeight ?? 0;
    missile.x = sx + (tx - sx) * t;
    missile.y = sy + (ty - sy) * t - ah * 4 * t * (1 - t);
    missile.t += missile.tIncrement;
    if (missile.t >= 1) {
      missile.x = tx;
      missile.y = ty;
      missile.exploded = true;
      missile.explosionAt = now;
      const enemies = state.enemies || [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - missile.x, e.y - missile.y);
        if (d <= missile.radius) {
          const raw = Math.max(1, missile.damage - Math.floor((e.defense ?? 0) * 0.6));
          e.hp -= raw;
          e.hitFlashUntil = Date.now() + 400;
          e.lastHitCrit = false;
          spawnBloodParticles(state, e.x, e.y, 5);
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
  });
  m.missiles = (m.missiles || []).filter(
    (missile) => !missile.exploded || now - missile.explosionAt < MISSILE_EXPLOSION_DURATION_MS
  );

  (m.iceArrows || []).forEach((arr) => {
    if (arr.hit) return;
    arr.x += arr.vx;
    arr.y += arr.vy;
    const enemies = state.enemies || [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(arr.x - e.x, arr.y - e.y);
      if (d < ICE_ARROW_HIT_R) {
        e.hp = Math.max(0, (e.hp ?? e.maxHp) - magicDamageRaw(arr.damage, e));
        e.frozenUntil = Math.max(e.frozenUntil || 0, now + (arr.slowMs ?? ICE_ARROW_SLOW_MS));
        e.hitFlashUntil = now + 300;
        spawnBloodParticles(state, e.x, e.y, 3);
        if (e.hp <= 0) {
          e.alive = false;
          e.deadAt = now;
          e.deathPhase = 'falling';
          e.fallProgress = 0;
          state.score = (state.score || 0) + 1;
          state.gold = (state.gold || 0) + (e.goldReward ?? state.goldPerKill ?? 8);
        }
        arr.hit = true;
        return;
      }
    }
  });
  m.iceArrows = (m.iceArrows || []).filter((arr) => !arr.hit && arr.x > -50 && arr.x < w + 50 && arr.y > -50 && arr.y < h + 50);

  (m.ballistaBolts || []).forEach((arr) => {
    if (arr.hit) return;
    arr.x += arr.vx;
    arr.y += arr.vy;
    const hitEnemies = arr.hitEnemies || [];
    const maxHits = arr.maxHits ?? 1;
    const enemies = state.enemies || [];
    for (const e of enemies) {
      if (!e.alive || hitEnemies.includes(e)) continue;
      const d = Math.hypot(arr.x - e.x, arr.y - e.y);
      if (d < BALLISTA_HIT_R) {
        const raw = Math.max(1, arr.damage - Math.floor((e.defense ?? 0) * 0.5));
        e.hp = Math.max(0, (e.hp ?? e.maxHp) - raw);
        e.hitFlashUntil = now + 400;
        spawnBloodParticles(state, e.x, e.y, 5);
        if (e.hp <= 0) {
          e.alive = false;
          e.deadAt = now;
          e.deathPhase = 'falling';
          e.fallProgress = 0;
          state.score = (state.score || 0) + 1;
          state.gold = (state.gold || 0) + (e.goldReward ?? state.goldPerKill ?? 8);
        }
        hitEnemies.push(e);
        if (hitEnemies.length >= maxHits) arr.hit = true;
        break;
      }
    }
  });
  m.ballistaBolts = (m.ballistaBolts || []).filter((arr) => !arr.hit && arr.x > -50 && arr.x < w + 50 && arr.y > -50 && arr.y < h + 50);

  (m.volleyArrows || []).forEach((arr) => {
    if (arr.hit) return;
    arr.x += arr.vx;
    arr.y += arr.vy;
    const enemies = state.enemies || [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(arr.x - e.x, arr.y - e.y);
      if (d < VOLLEY_HIT_R) {
        for (const e2 of enemies) {
          if (!e2.alive) continue;
          const d2 = Math.hypot(arr.x - e2.x, arr.y - e2.y);
          if (d2 <= VOLLEY_AOE_R) {
            const raw = Math.max(1, arr.damage - (e2.defense ?? 0));
            e2.hp = Math.max(0, (e2.hp ?? e2.maxHp) - raw);
            e2.hitFlashUntil = now + 250;
            spawnBloodParticles(state, e2.x, e2.y, 2);
            if (e2.hp <= 0) {
              e2.alive = false;
              e2.deadAt = now;
              e2.deathPhase = 'falling';
              e2.fallProgress = 0;
              state.score = (state.score || 0) + 1;
              state.gold = (state.gold || 0) + (e2.goldReward ?? state.goldPerKill ?? 8);
            }
          }
        }
        arr.hit = true;
        return;
      }
    }
  });
  m.volleyArrows = (m.volleyArrows || []).filter((arr) => !arr.hit && arr.x > -50 && arr.x < w + 50 && arr.y > -50 && arr.y < h + 50);

  m.frostRings = (m.frostRings || []).filter((r) => now - r.castAt < FROST_RING_VISIBLE_MS);

  for (const e of state.enemies || []) {
    if (!e.alive || !e.burningUntil || e.burningUntil <= now) continue;
    if (now - (e.lastBurnTick || 0) >= BURN_TICK_MS) {
      e.lastBurnTick = now;
      const raw = magicDamageRaw(BURN_DOT_DAMAGE, e);
      e.hp -= raw;
      e.hitFlashUntil = Date.now() + 150;
      spawnBloodParticles(state, e.x, e.y, 1);
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

export function drawMagic(ctx, state) {
  const m = state.magic;
  if (!m) return;

  const now = Date.now();

  for (const eff of m.fireRainEffects || []) {
    if (eff.castAt && now - eff.castAt < FIRE_RAIN_AOE_VISIBLE_MS) {
      const t = 1 - (now - eff.castAt) / FIRE_RAIN_AOE_VISIBLE_MS;
      ctx.strokeStyle = `rgba(255,140,40,${0.5 * t})`;
      ctx.fillStyle = `rgba(255,80,20,${0.12 * t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(eff.cx, eff.cy, eff.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const p of eff.particles) {
      const alpha = (p.life / p.maxLife) * 0.9;
      const len = (p.r || 3) * 3;
      const dx = p.vx;
      const dy = p.vy;
      const norm = Math.hypot(dx, dy) || 1;
      const ux = (dx / norm) * len;
      const uy = (dy / norm) * len;
      ctx.strokeStyle = `rgba(255,120,30,${alpha})`;
      ctx.lineWidth = Math.max(1.5, (p.r || 2));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - ux, p.y - uy);
      ctx.lineTo(p.x + ux, p.y + uy);
      ctx.stroke();
    }
  }

  for (const arr of m.fireArrows || []) {
    if (arr.hit) continue;
    const dx = arr.vx;
    const dy = arr.vy;
    const len = 14;
    const nx = (dx / (Math.hypot(dx, dy) || 1)) * len;
    const ny = (dy / (Math.hypot(dx, dy) || 1)) * len;
    ctx.strokeStyle = '#ffaa40';
    ctx.fillStyle = '#ff8820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arr.x - nx, arr.y - ny);
    ctx.lineTo(arr.x + nx, arr.y + ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(arr.x + nx, arr.y + ny, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (m.lastFreezeAt && m.lastFreezeAt.until > now) {
    const t = 1 - (m.lastFreezeAt.until - now) / FREEZE_DURATION_MS;
    const alpha = 0.15 + t * 0.1;
    const freezeR = m.lastFreezeAt.radius ?? FREEZE_RADIUS;
    ctx.strokeStyle = `rgba(150,220,255,${alpha})`;
    ctx.fillStyle = `rgba(100,180,255,${alpha * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.lastFreezeAt.x, m.lastFreezeAt.y, freezeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const zone of m.fireSeas || []) {
    const age = now - zone.createdAt;
    const zoneDuration = zone.durationMs ?? FIRE_SEA_DURATION_MS;
    if (age >= zoneDuration) continue;
    const life = Math.max(0, 1 - age / zoneDuration);
    const alpha = FIRE_SEA_ALPHA * life;
    ctx.save();
    ctx.globalAlpha = alpha;
    const ps = FIRE_SEA_PIXEL_SIZE;
    const seg = fireSeaSegment(zone);
    const halfW = (zone.width ?? FIRE_SEA_WIDTH) / 2;
    const minX = Math.min(seg.x1, seg.x2) - halfW;
    const maxX = Math.max(seg.x1, seg.x2) + halfW;
    const minY = Math.min(seg.y1, seg.y2) - halfW;
    const maxY = Math.max(seg.y1, seg.y2) + halfW;

    for (let gx = Math.floor(minX / ps) * ps; gx < maxX; gx += ps) {
      for (let gy = Math.floor(minY / ps) * ps; gy < maxY; gy += ps) {
        const px = gx + ps / 2;
        const py = gy + ps / 2;
        const dist = distanceToSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
        if (dist > halfW) continue;
        const flicker = Math.sin(now * 0.02 + gx * 0.08 + gy * 0.06) * 0.5 + 0.5;
        const edge = 1 - dist / halfW;
        const idx = Math.min(
          FIRE_SEA_PALETTE.length - 1,
          Math.floor((flicker * 0.7 + edge * 0.3 + (1 - life) * 0.2) * FIRE_SEA_PALETTE.length)
        );
        ctx.fillStyle = FIRE_SEA_PALETTE[Math.max(0, idx)];
        ctx.fillRect(gx, gy, ps, ps);
      }
    }

    for (const p of zone.particles || []) {
      const t = p.life / p.maxLife;
      const brightness = Math.floor(t * (FIRE_SEA_PALETTE.length - 1));
      ctx.fillStyle = FIRE_SEA_PALETTE[Math.min(brightness, FIRE_SEA_PALETTE.length - 1)];
      const size = 4;
      ctx.fillRect(Math.floor(p.px - size / 2), Math.floor(p.py - size / 2), size, size);
    }
    ctx.restore();
  }

  for (const missile of m.missiles || []) {
    if (missile.exploded) {
      const elapsed = now - missile.explosionAt;
      if (elapsed >= MISSILE_EXPLOSION_DURATION_MS) continue;
      const t = elapsed / MISSILE_EXPLOSION_DURATION_MS;
      const r = missile.radius * (0.3 + t * 0.9);
      const alpha = (1 - t) * (0.9 - t * 0.5);
      const grad = ctx.createRadialGradient(
        missile.x, missile.y, 0,
        missile.x, missile.y, r
      );
      grad.addColorStop(0, `rgba(255,220,120,${alpha * 0.95})`);
      grad.addColorStop(0.3, `rgba(255,120,40,${alpha * 0.6})`);
      grad.addColorStop(0.7, `rgba(200,50,10,${alpha * 0.25})`);
      grad.addColorStop(1, 'rgba(80,10,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,180,60,${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      continue;
    }
    const dt = missile.tIncrement;
    const t = missile.t;
    const ah = missile.arcHeight ?? 0;
    const dx = (missile.targetX - missile.startX) * dt;
    const dy = (missile.targetY - missile.startY) * dt - ah * 4 * (1 - 2 * t) * dt;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (dx / len) * 12;
    const ny = (dy / len) * 12;
    ctx.fillStyle = '#c0c0c0';
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(missile.x + nx, missile.y + ny);
    ctx.lineTo(missile.x - nx * 0.6, missile.y - ny * 0.6 + 3);
    ctx.lineTo(missile.x - nx * 0.3, missile.y - ny * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(missile.x + nx * 0.5, missile.y + ny * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const arr of m.iceArrows || []) {
    if (arr.hit) continue;
    const len = 12;
    const nx = (arr.vx / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    const ny = (arr.vy / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    ctx.strokeStyle = 'rgba(180,220,255,0.95)';
    ctx.fillStyle = 'rgba(220,240,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arr.x - nx, arr.y - ny);
    ctx.lineTo(arr.x + nx, arr.y + ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(arr.x + nx, arr.y + ny, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const r of m.frostRings || []) {
    const age = now - r.castAt;
    const t = 1 - age / FROST_RING_VISIBLE_MS;
    const alpha = t * 0.4;
    ctx.strokeStyle = `rgba(150,220,255,${alpha})`;
    ctx.fillStyle = `rgba(100,180,255,${alpha * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius ?? FROST_RING_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const arr of m.ballistaBolts || []) {
    if (arr.hit) continue;
    const len = 18;
    const nx = (arr.vx / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    const ny = (arr.vy / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    ctx.fillStyle = '#5a5a5a';
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arr.x - nx, arr.y - ny);
    ctx.lineTo(arr.x + nx, arr.y + ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(arr.x + nx, arr.y + ny, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const arr of m.volleyArrows || []) {
    if (arr.hit) continue;
    const len = 10;
    const nx = (arr.vx / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    const ny = (arr.vy / (Math.hypot(arr.vx, arr.vy) || 1)) * len;
    ctx.strokeStyle = '#6a6a5a';
    ctx.fillStyle = '#7a7a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(arr.x - nx, arr.y - ny);
    ctx.lineTo(arr.x + nx, arr.y + ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(arr.x + nx, arr.y + ny, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getSkillCooldownRemaining(state, skillId) {
  const until = state.magic?.cooldownUntil?.[skillId] ?? 0;
  const rem = until - Date.now();
  return rem <= 0 ? 0 : rem;
}

export function getSkillName(skillId) {
  const names = {
    [SKILL_IDS.FIRE_RAIN]: '火雨',
    [SKILL_IDS.FIRE_ARROW]: '火箭',
    [SKILL_IDS.FREEZE]: '冻结',
    [SKILL_IDS.FIRE_SEA]: '火海',
    [SKILL_IDS.MISSILE]: '导弹',
    [SKILL_IDS.ICE_ARROW]: '冰箭',
    [SKILL_IDS.FROST_RING]: '冰环',
    [SKILL_IDS.BALLISTA]: '弩炮',
    [SKILL_IDS.VOLLEY]: '齐射',
  };
  return names[skillId] || '';
}

export function selectSkill(state, skillId) {
  if (!state.magic) return;
  if (isOnCooldown(state, skillId)) return;
  if (!canUseSkillInWeather(state, skillId)) return;
  state.magic.selectedSkill = state.magic.selectedSkill === skillId ? null : skillId;
}
