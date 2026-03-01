/**
 * Player magic skills: fire rain (AOE), fire arrow (projectiles), freeze (AOE).
 * Click skill button to select, then click on canvas to cast. Each skill has cooldown.
 */

import { spawnBloodParticles } from './blood.js';

export const SKILL_IDS = {
  FIRE_RAIN: 'fire_rain',
  FIRE_ARROW: 'fire_arrow',
  FREEZE: 'freeze',
  FIRE_SEA: 'fire_sea',
  MISSILE: 'missile',
};

const COOLDOWN_MS = {
  [SKILL_IDS.FIRE_RAIN]: 22000,
  [SKILL_IDS.FIRE_ARROW]: 20000,
  [SKILL_IDS.FREEZE]: 24000,
  [SKILL_IDS.FIRE_SEA]: 26000,
  [SKILL_IDS.MISSILE]: 28000,
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
  m.fireRainEffects = m.fireRainEffects || [];
  m.fireArrows = m.fireArrows || [];
  m.fireSeas = m.fireSeas || [];
  m.missiles = m.missiles || [];
}

function isOnCooldown(state, skillId) {
  return (state.magic?.cooldownUntil?.[skillId] ?? 0) > Date.now();
}

export function tryCastMagic(state, x, y) {
  const m = state.magic;
  if (!m || !m.selectedSkill) return false;
  const skill = m.selectedSkill;
  if (isOnCooldown(state, skill)) return false;
  const now = Date.now();
  m.cooldownUntil[skill] = now + (COOLDOWN_MS[skill] ?? 20000);
  m.selectedSkill = null;

  if (skill === SKILL_IDS.FIRE_RAIN) {
    castFireRain(state, x, y);
    return true;
  }
  if (skill === SKILL_IDS.FIRE_ARROW) {
    castFireArrow(state, x, y);
    return true;
  }
  if (skill === SKILL_IDS.FREEZE) {
    castFreeze(state, x, y);
    return true;
  }
  if (skill === SKILL_IDS.FIRE_SEA) {
    castFireSea(state, x, y);
    return true;
  }
  if (skill === SKILL_IDS.MISSILE) {
    castMissile(state, x, y);
    return true;
  }
  return false;
}

function castFireRain(state, x, y) {
  const w = state.width || 800;
  const h = state.height || 600;
  const particles = [];
  // 火雨从天上（画布上方）坠落，落点分布在目标范围内
  for (let i = 0; i < FIRE_RAIN_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * FIRE_RAIN_RADIUS;
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
    radius: FIRE_RAIN_RADIUS,
    damage: FIRE_RAIN_DAMAGE,
    applied: false,
    particles,
    createdAt: state.frameCount || 0,
    castAt: Date.now(),
  });

  const enemies = state.enemies || [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= FIRE_RAIN_RADIUS) {
      const raw = Math.max(1, FIRE_RAIN_DAMAGE - (e.defense ?? 0));
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

function castFireArrow(state, x, y) {
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
      damage: FIRE_ARROW_DAMAGE,
      hit: false,
    });
  }
}

function castFreeze(state, x, y) {
  const enemies = state.enemies || [];
  const until = Date.now() + FREEZE_DURATION_MS;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= FREEZE_RADIUS) {
      e.frozenUntil = Math.max(e.frozenUntil || 0, until);
    }
  }
  state.magic.lastFreezeAt = { x, y, until };
}

function castFireSea(state, x, y) {
  const now = Date.now();
  state.magic.fireSeas = state.magic.fireSeas || [];
  const zone = {
    x,
    y,
    length: FIRE_SEA_LENGTH,
    width: FIRE_SEA_WIDTH,
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

function castMissile(state, targetX, targetY) {
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
    damage: MISSILE_DAMAGE,
    radius: MISSILE_EXPLODE_RADIUS,
    exploded: false,
    explosionAt: 0,
  });
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
        const raw = Math.max(1, arr.damage - (e.defense ?? 0));
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
    const zoneAge = now - zone.createdAt;
    const zoneLife = Math.max(0, 1 - zoneAge / FIRE_SEA_DURATION_MS);
    const seg = fireSeaSegment(zone);
    const halfWidth = (zone.width ?? FIRE_SEA_WIDTH) / 2;
    if (now - zone.lastTick >= FIRE_SEA_TICK_MS) {
      zone.lastTick = now;
      const enemies = state.enemies || [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = distanceToSegment(e.x, e.y, seg.x1, seg.y1, seg.x2, seg.y2);
        if (d <= halfWidth) {
          const baseRaw = Math.max(1, FIRE_SEA_DAMAGE_PER_TICK - Math.floor((e.defense ?? 0) / 4));
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
  m.fireSeas = (m.fireSeas || []).filter((z) => now - z.createdAt < FIRE_SEA_DURATION_MS);

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

  for (const e of state.enemies || []) {
    if (!e.alive || !e.burningUntil || e.burningUntil <= now) continue;
    if (now - (e.lastBurnTick || 0) >= BURN_TICK_MS) {
      e.lastBurnTick = now;
      const raw = Math.max(1, BURN_DOT_DAMAGE - Math.floor((e.defense ?? 0) / 8));
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
    ctx.strokeStyle = `rgba(150,220,255,${alpha})`;
    ctx.fillStyle = `rgba(100,180,255,${alpha * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.lastFreezeAt.x, m.lastFreezeAt.y, FREEZE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const zone of m.fireSeas || []) {
    const age = now - zone.createdAt;
    if (age >= FIRE_SEA_DURATION_MS) continue;
    const life = Math.max(0, 1 - age / FIRE_SEA_DURATION_MS);
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
  };
  return names[skillId] || '';
}

export function selectSkill(state, skillId) {
  if (!state.magic) return;
  if (isOnCooldown(state, skillId)) return;
  state.magic.selectedSkill = state.magic.selectedSkill === skillId ? null : skillId;
}
