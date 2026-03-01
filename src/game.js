/**
 * Game state and main loop: clear, draw background, castle, lines, enemies; update.
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
  applySoldierDamage,
  applyEnemyDamageToSoldiers,
  getWaveTotal,
  getEnemyTypeName,
} from './enemies.js';
import { drawSoldiers, createSoldiers, updateSoldierPositions, updateSoldierReturnAndHeal } from './soldiers.js';
import { createArchers, updateArcherPositions, applyArcherShoot, updateArrows, drawArchers, drawArrows } from './archers.js';
import { updateBloodParticles, drawBloodParticles } from './blood.js';
import { initWeather, updateWeather, drawWeather, getWeatherName } from './weather.js';
import { initMagic, updateMagic, drawMagic } from './magic.js';

export function createState(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.75;
  setCastleCenter(cx, cy);

  const state = {
    enemies: [],
    lines: [],
    currentLine: [],
    isDrawing: false,
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
    castleHealth: 10,
    score: 0,
    gold: 0,
    goldPerKill: 8,
    running: true,
    level: 1,
    castleLevel: 1,
    nextCastleUpgradeAt: 10,
    soldierRange: 120,
    soldierDamage: 20,
    soldierAttackInterval: 20,
    soldierFrameCounter: 0,
    soldierShieldChance: 0.3,
    soldierCritChance: 0.15,
    soldierCritMultiplier: 1.8,
    soldierMaxHp: 250,
    soldierDefense: 5,
    soldiers: [],
    archers: [],
    arrows: [],
    bloodParticles: [],
    weather: null,
    magic: null,
    selectedUnit: null,
  };
  state.soldiers = createSoldiers(state);
  state.archers = createArchers(state);
  state.waveEnemiesToSpawn = getWaveTotal(1);
  initWeather(state);
  initMagic(state);
  return state;
}

export function startNextWave(state) {
  if (state.waveState !== 'completed') return;
  state.wave = (state.wave ?? 1) + 1;
  state.waveState = 'fighting';
  state.waveEnemiesToSpawn = getWaveTotal(state.wave);
  state.waveEnemiesSpawned = 0;
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

/** 重置为全新一局（重新开始） */
export function resetState(state) {
  state.enemies = [];
  state.lines = [];
  state.currentLine = [];
  state.isDrawing = false;
  state.castleHealth = 10;
  state.wave = 1;
  state.waveState = 'fighting';
  state.waveEnemiesToSpawn = getWaveTotal(1);
  state.waveEnemiesSpawned = 0;
  state.lastSpawnTime = performance.now();
  state.score = 0;
  state.gold = 0;
  state.running = true;
  state.soldiers = createSoldiers(state);
  state.archers = createArchers(state);
  state.bloodParticles = [];
  state.selectedUnit = null;
  state.frameCount = 0;
  const m = state.magic;
  if (m) {
    m.fireRainEffects = [];
    m.fireArrows = [];
    m.fireSeas = [];
    m.missiles = [];
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
  state.frameCount = (state.frameCount || 0) + 1;

  trySpawnWaveEnemy(state, w, h);
  if (
    state.waveState === 'fighting' &&
    (state.waveEnemiesSpawned ?? 0) >= (state.waveEnemiesToSpawn ?? 0) &&
    !(state.enemies || []).some((e) => e.alive)
  ) {
    state.waveState = 'completed';
  }

  updateSoldierPositions(state);
  updateArcherPositions(state);

  clear(ctx, w, h);
  drawBackground(ctx, w, h, state);
  drawCastle(ctx, state.castleLevel ?? 1);
  drawArchers(ctx, state);
  drawSoldiers(ctx, state);
  drawLines(ctx, state);
  updateEnemies(state, w, h);
  applyArcherShoot(state);
  updateArrows(state);
  applySoldierDamage(state);
  applyEnemyDamageToSoldiers(state);
  if (state.score >= (state.nextCastleUpgradeAt || 10) && state.castleLevel < 3) {
    state.castleLevel++;
    state.nextCastleUpgradeAt = state.score + 10;
  }
  updateSoldierReturnAndHeal(state);
  updateBloodParticles(state);
  updateWeather(state);
  updateMagic(state);
  drawEnemies(ctx, state);
  drawArrows(ctx, state);
  drawBloodParticles(ctx, state);
  drawWeather(ctx, state);
  drawMagic(ctx, state);
  drawHUD(ctx, state);
  drawUnitPanel(ctx, state);

  if (state.waveState === 'completed') {
    drawWaveCompleteOverlay(ctx, w, h, state);
  }

  if (state.castleHealth <= 0) {
    state.running = false;
    drawGameOver(ctx, w, h, state);
  }
}

function drawHUD(ctx, state) {
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('得分: ' + (state.score || 0), 16, 28);
  ctx.fillText('城堡血量: ' + Math.max(0, state.castleHealth ?? 10), 16, 52);
  ctx.fillStyle = '#e8c830';
  ctx.fillText('金币: ' + (state.gold ?? 0), 16, 76);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('天气: ' + (state.weather ? getWeatherName(state.weather.current) : '晴天'), 16, 98);
  ctx.fillStyle = '#b0d0ff';
  ctx.fillText('第' + (state.wave ?? 1) + '波', 16, 118);
  const alive = (state.enemies || []).filter((e) => e.alive).length;
  const left = Math.max(0, (state.waveEnemiesToSpawn ?? 0) - (state.waveEnemiesSpawned ?? 0));
  ctx.fillText('剩余: ' + (left + alive), 16, 136);
}

function drawUnitPanel(ctx, state) {
  const sel = state.selectedUnit;
  if (!sel) return;
  if (sel.type === 'enemy' && !sel.unit.alive) {
    state.selectedUnit = null;
    return;
  }

  const w = state.width || 800;
  const panelW = 160;
  const panelH = 88;
  const pad = 12;
  const x = w - panelW - 20;
  const y = 100;

  const isSoldier = sel.type === 'soldier';
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
    ctx.fillText('战斗力: ' + (state.soldierDamage ?? 20), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('防御力: ' + (state.soldierDefense ?? 5), x + pad, lineY);
  } else {
    const e = sel.unit;
    ctx.fillText('血量: ' + Math.max(0, e.hp) + ' / ' + (e.maxHp ?? 60), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('战斗力: ' + (e.attack ?? 10), x + pad, lineY);
    lineY += lineH;
    ctx.fillText('防御力: ' + (e.defense ?? 10), x + pad, lineY);
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
