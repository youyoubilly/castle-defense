/**
 * Game state and main loop: clear, draw background, castle, enemies; update.
 */

import {
  clear,
  drawBackground,
  drawCastle,
  setCastleCenter,
  getCastleRadius,
} from './canvas.js';
import { drawLines } from './drawing.js';
import {
  updateEnemies,
  drawEnemies,
  startSpawning,
  trySpawnWaveEnemy,
  applyBossSummon,
  applySoldierDamage,
  applyEnemyDamageToSoldiers,
  applyEnemyArcherShoot,
  updateEnemyArrows,
  drawEnemyArrows,
  applyDragonActions,
  updateDragonAxes,
  drawDragonAxes,
  applyKingOrbShoot,
  updateKingOrbs,
  drawKingOrbs,
  getWaveTotal,
  getEnemyTypeName,
} from './enemies.js';
import { drawSoldiers, createSoldiers, updateSoldierPositions, updateSoldierReturnAndHeal, applySoldierArcherShoot, applySoldierMageShoot } from './soldiers.js';
import { createArchers, updateArcherPositions, applyArcherShoot, updateArrows, drawArchers, drawArrows } from './archers.js';
import {
  createArtillery,
  updateArtilleryPositions,
  applyArtilleryShoot,
  updateCannonballs,
  drawArtillery,
  drawCannonballs,
} from './artillery.js';
import { updateBloodParticles, drawBloodParticles } from './blood.js';
import { initWeather, updateWeather, drawWeather, getWeatherName } from './weather.js';
import { initMagic, updateMagic, drawMagic, SKILL_IDS } from './magic.js';

export const CASTLE_MAX_LEVEL = 5;

/** 城堡等级对应的防御力（敌人冲进城堡时，减少对己方士兵的伤害） */
export function getCastleDefense(level) {
  const L = Math.max(1, Math.min(CASTLE_MAX_LEVEL, level || 1));
  return [0, 0, 2, 4, 6, 8][L];
}

export function createState(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.75;
  setCastleCenter(cx, cy);

  const state = {
    enemies: [],
    castleCx: cx,
    castleCy: cy,
    width: w,
    height: h,
    lastSpawnTime: 0,
    spawnInterval: null,
    wave: 1,
    waveState: 'fighting',
    waveEnemiesToSpawn: 10,
    waveEnemiesSpawned: 0,
    waveBossesToSpawn: 0,
    waveBossesSpawned: 0,
    castleHealth: 10,
    score: 0,
    gold: 0,
    goldPerKill: 8,
    running: true,
    level: 1,
    castleLevel: 1,
    nextCastleUpgradeAt: 10,
    soldierRange: 50,
    soldierDamage: 20,
    soldierAttackInterval: 20,
    soldierFrameCounter: 0,
    soldierShieldChance: 0.3,
    soldierCritChance: 0.15,
    soldierCritMultiplier: 1.8,
    soldierMaxHp: 250,
    soldierDefense: 5,
    soldierAttackBonus: 0,
    soldierHpBonus: 0,
    soldierDefenseBonus: 0,
    soldiers: [],
    archers: [],
    arrows: [],
    enemyArrows: [],
    dragonAxes: [],
    kingOrbs: [],
    artillery: [],
    cannonballs: [],
    maxArtillery: 2,
    bloodParticles: [],
    weather: null,
    magic: null,
    selectedUnit: null,
    castleSpellSupport: false,
  };
  state.soldiers = createSoldiers(state);
  state.archers = createArchers(state);
  createArtillery(state);
  state.waveEnemiesToSpawn = getWaveTotal(1);
  initWeather(state);
  initMagic(state);
  syncCastleTowerHeight(state);
  return state;
}

/** 根据城堡等级更新塔高（弓箭手位置与绘制用） */
export function syncCastleTowerHeight(state) {
  const L = Math.max(1, Math.min(CASTLE_MAX_LEVEL, state.castleLevel ?? 1));
  state.castleTowerH = 68 + (L - 1) * 10;
}

export function startNextWave(state) {
  if (state.waveState !== 'completed') return;
  state.wave = (state.wave ?? 1) + 1;
  state.waveState = 'fighting';
  state.waveEnemiesToSpawn = getWaveTotal(state.wave);
  state.waveEnemiesSpawned = 0;
  const isBossWave = (state.wave % 5) === 0;
  state.waveBossesToSpawn = isBossWave ? 2 : 0;
  state.waveBossesSpawned = 0;
  state.lastSpawnTime = performance.now();
}

const CONTINUE_COST_GOLD = 300;
const CONTINUE_CASTLE_HEALTH = 5;

export function canContinue(state) {
  return (state.gold ?? 0) >= CONTINUE_COST_GOLD;
}

export function continueGame(state) {
  if (!canContinue(state)) return false;
  state.gold -= CONTINUE_COST_GOLD;
  state.castleHealth = CONTINUE_CASTLE_HEALTH;
  state.running = true;
  return true;
}

export function continueGameFromAd(state) {
  state.castleHealth = CONTINUE_CASTLE_HEALTH;
  state.running = true;
  return true;
}

/** 重置为全新一局（重新开始） */
export function resetState(state) {
  state.enemies = [];
  state.castleHealth = 10;
  state.wave = 1;
  state.waveState = 'fighting';
  state.waveEnemiesToSpawn = getWaveTotal(1);
  state.waveEnemiesSpawned = 0;
  state.waveBossesToSpawn = 0;
  state.waveBossesSpawned = 0;
  state.lastSpawnTime = performance.now();
  state.score = 0;
  state.gold = 0;
  state.running = true;
  state.castleLevel = 1;
  state.soldiers = createSoldiers(state);
  state.archers = createArchers(state);
  state.artillery = [];
  state.cannonballs = [];
  state.enemyArrows = [];
  state.enemyMageCastleHits = 0;
  state.dragonAxes = [];
  state.kingOrbs = [];
  state.bloodParticles = [];
  state.selectedUnit = null;
  state.soldierAttackBonus = 0;
  state.soldierHpBonus = 0;
  state.soldierDefenseBonus = 0;
  state.frameCount = 0;
  state.castleSpellSupport = false;
  syncCastleTowerHeight(state);
  const m = state.magic;
  if (m) {
    m.fireRainEffects = [];
    m.fireArrows = [];
    m.fireSeas = [];
    m.missiles = [];
    m.iceArrows = [];
    m.frostRings = [];
    m.ballistaBolts = [];
    m.volleyArrows = [];
    m.skillLevels = {
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
  }
}

export function gameLoop(ctx, canvas, state) {
  if (!state.running) return;

  const w = canvas.width;
  const h = canvas.height;
  state.width = w;
  state.height = h;
  state.castleCx = w / 2;
  state.castleCy = h * 0.75;
  setCastleCenter(state.castleCx, state.castleCy);
  syncCastleTowerHeight(state);
  state.frameCount = (state.frameCount || 0) + 1;

  trySpawnWaveEnemy(state, w, h);
  applyBossSummon(state);
  if (
    state.waveState === 'fighting' &&
    (state.waveEnemiesSpawned ?? 0) >= (state.waveEnemiesToSpawn ?? 0) &&
    !(state.enemies || []).some((e) => e.alive)
  ) {
    state.waveState = 'completed';
  }

  updateSoldierPositions(state);
  updateArcherPositions(state);
  updateArtilleryPositions(state);

  clear(ctx, w, h);
  drawBackground(ctx, w, h, state);
  drawCastle(ctx, state.castleLevel ?? 1);
  drawArchers(ctx, state);
  drawArtillery(ctx, state);
  drawSoldiers(ctx, state);
  drawLines(ctx, state);
  updateEnemies(state, w, h);
  applyEnemyArcherShoot(state);
  applyDragonActions(state);
  applyKingOrbShoot(state);
  updateEnemyArrows(state);
  updateDragonAxes(state);
  updateKingOrbs(state);
  applyArcherShoot(state);
  applySoldierArcherShoot(state);
  applySoldierMageShoot(state);
  applyArtilleryShoot(state);
  updateArrows(state);
  updateCannonballs(state);
  applySoldierDamage(state);
  applyEnemyDamageToSoldiers(state);
  // 城堡升级仅通过商店购买，不再按得分自动升级
  updateSoldierReturnAndHeal(state);
  updateBloodParticles(state);
  updateWeather(state);
  updateMagic(state);
  drawEnemies(ctx, state);
  drawArrows(ctx, state);
  drawEnemyArrows(ctx, state);
  drawDragonAxes(ctx, state);
  drawKingOrbs(ctx, state);
  drawCannonballs(ctx, state);
  drawBloodParticles(ctx, state);
  drawWeather(ctx, state);
  drawMagic(ctx, state);
  drawHUD(ctx, state);
  drawBossHealthBar(ctx, state);
  drawUnitPanel(ctx, state);

  if (state.waveState === 'completed') {
    drawWaveCompleteOverlay(ctx, w, h, state);
  }

  if (state.castleHealth <= 0) {
    state.running = false;
    drawGameOver(ctx, w, h, state);
  }
}

/** 移动端时 HUD 下移，避免被顶栏遮挡（顶栏约 52–80px） */
const HUD_TOP_OFFSET_MOBILE = 72;
const HUD_TOP_OFFSET_DESKTOP = 16;
const HUD_LINE_HEIGHT = 22;
const HUD_FONT = '18px sans-serif';
const HUD_FONT_SMALL = '14px sans-serif';

function drawHUD(ctx, state) {
  const isNarrow = (state.width || 800) <= 768;
  const top = isNarrow ? HUD_TOP_OFFSET_MOBILE : HUD_TOP_OFFSET_DESKTOP;
  const line = HUD_LINE_HEIGHT;
  ctx.fillStyle = '#fff';
  ctx.font = HUD_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('得分: ' + (state.score || 0), 16, top);
  ctx.fillText('城堡血量: ' + Math.max(0, state.castleHealth ?? 10) + '  Lv.' + (state.castleLevel ?? 1), 16, top + line);
  ctx.fillStyle = '#e8c830';
  ctx.fillText('金币: ' + (state.gold ?? 0), 16, top + line * 2);
  ctx.font = HUD_FONT_SMALL;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('天气: ' + (state.weather ? getWeatherName(state.weather.current) : '晴天'), 16, top + line * 3);
  ctx.fillStyle = '#b0d0ff';
  ctx.fillText('第' + (state.wave ?? 1) + '波', 16, top + line * 4);
  const alive = (state.enemies || []).filter((e) => e.alive).length;
  const left = Math.max(0, (state.waveEnemiesToSpawn ?? 0) - (state.waveEnemiesSpawned ?? 0));
  ctx.fillText('剩余: ' + (left + alive), 16, top + line * 5);
}

const BOSS_TYPES = ['boss_king', 'boss_general', 'boss_summoner', 'war_wolf'];
const BOSS_BAR_HEIGHT = 14;

function drawBossHealthBar(ctx, state) {
  const bosses = (state.enemies || []).filter((e) => e.alive && BOSS_TYPES.includes(e.type));
  if (bosses.length === 0) return;

  const totalHp = bosses.reduce((s, e) => s + (e.hp ?? 0), 0);
  const totalMaxHp = bosses.reduce((s, e) => s + (e.maxHp ?? 1), 0);
  const ratio = totalMaxHp > 0 ? Math.max(0, Math.min(1, totalHp / totalMaxHp)) : 0;

  const w = state.width || 800;
  const isNarrow = w <= 768;
  const barWidth = isNarrow ? Math.min(280, w - 32) : 300;
  const barTop = isNarrow ? 76 : 64;
  const x = (w - barWidth) / 2;
  const y = barTop;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeStyle = 'rgba(180,80,60,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, BOSS_BAR_HEIGHT, 6);
  ctx.fill();
  ctx.stroke();

  if (ratio > 0) {
    const fillW = Math.max(2, barWidth * ratio);
    const grad = ctx.createLinearGradient(x, 0, x + fillW, 0);
    grad.addColorStop(0, '#c03030');
    grad.addColorStop(0.5, '#a02020');
    grad.addColorStop(1, '#701818');
    ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, fillW - 4, BOSS_BAR_HEIGHT - 4, 4);
  ctx.fill();
  }

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = '首领';
  ctx.strokeText(label, w / 2, y + BOSS_BAR_HEIGHT / 2);
  ctx.fillText(label, w / 2, y + BOSS_BAR_HEIGHT / 2);
  ctx.restore();
}

function drawUnitPanel(ctx, state) {
  const sel = state.selectedUnit;
  if (!sel) return;
  if (sel.type === 'castle') return;
  if (sel.type === 'enemy' && !sel.unit.alive) {
    state.selectedUnit = null;
    return;
  }

  const w = state.width || 800;
  const panelW = 160;
  const pad = 12;
  const isSoldier = sel.type === 'soldier';
  const extraLine = isSoldier ? (sel.unit.magicAttack ?? 0) > 0 : (sel.unit.magicDefense ?? 0) > 0;
  const panelH = 88 + (extraLine ? 18 : 0);
  const isNarrow = w <= 768;
  const x = w - panelW - (isNarrow ? 12 : 20);
  const y = isNarrow ? 88 : 100;

  if (isSoldier) {
    ctx.fillStyle = 'rgba(22,38,58,0.92)';
    ctx.strokeStyle = 'rgba(70,130,200,0.95)';
    ctx.lineWidth = 2.5;
  } else {
    ctx.fillStyle = 'rgba(58,28,28,0.92)';
    ctx.strokeStyle = 'rgba(200,70,60,0.95)';
    ctx.lineWidth = 2.5;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = isSoldier ? '#b8d4f0' : '#f0c8c0';
  const name = isSoldier
    ? (sel.unit.name || '卫兵')
    : getEnemyTypeName(sel.unit.type);
  ctx.fillText(name, x + pad, y + pad + 14);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = isSoldier ? '#a0b8d0' : '#d8b8b0';
  const lineH = 18;
  let lineY = y + pad + 14 + lineH;

  if (isSoldier) {
    const s = sel.unit;
    ctx.fillText('血量: ' + Math.max(0, s.hp) + ' / ' + (s.maxHp ?? 250), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('战斗力: ' + (s.attack ?? state.soldierDamage ?? 20), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('防御力: ' + (s.defense ?? state.soldierDefense ?? 5), x + pad, lineY);
    if ((s.magicAttack ?? 0) > 0) {
      lineY += lineH;
      ctx.fillText('魔法攻击: ' + s.magicAttack, x + pad, lineY);
    }
  } else {
    const e = sel.unit;
    ctx.fillText('血量: ' + Math.max(0, e.hp) + ' / ' + (e.maxHp ?? 60), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('战斗力: ' + (e.attack ?? 10), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('防御力: ' + (e.defense ?? 10), x + pad, lineY);
    if ((e.magicDefense ?? 0) > 0) {
      lineY += lineH;
      ctx.fillText('魔法防御: ' + e.magicDefense, x + pad, lineY);
    }
  }
}

function drawWaveCompleteOverlay(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('第' + (state.wave ?? 1) + '波 完成！', w / 2, h / 2 - 24);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c8e0ff';
  ctx.fillText('点击任意处开始下一波', w / 2, h / 2 + 16);
}

function drawGameOver(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('游戏结束', w / 2, h / 2 - 20);
  ctx.font = '24px sans-serif';
  ctx.fillText('得分: ' + (state.score || 0), w / 2, h / 2 + 20);
  ctx.fillText('城堡血量归零', w / 2, h / 2 + 48);
  ctx.fillText('金币: ' + (state.gold || 0), w / 2, h / 2 + 76);
}
