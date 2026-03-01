/**
 * Canvas setup, coordinate conversion, background and castle drawing.
 */

export function getCanvas() {
  const canvas = document.getElementById('game');
  if (!canvas) throw new Error('Canvas #game not found');
  return canvas;
}

export function getCtx(canvas) {
  return canvas.getContext('2d');
}

/**
 * Convert client (page) coordinates to canvas coordinates.
 * Handles canvas size vs display size (e.g. high-DPI or CSS scaling).
 */
export function clientToCanvas(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/**
 * Resize canvas to fill window and return current dimensions.
 */
export function resizeCanvas(canvas) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  return { width: w, height: h };
}

/** Castle center (updated when canvas is resized) */
export let CASTLE_CX = 0;
export let CASTLE_CY = 0;
const CASTLE_BASE_RX = 55;
const CASTLE_BASE_RY = 35;
const CASTLE_TOWER_H = 70;

export function setCastleCenter(cx, cy) {
  CASTLE_CX = cx;
  CASTLE_CY = cy;
}

export function getCastleRadius() {
  return Math.max(CASTLE_BASE_RX, CASTLE_BASE_RY) + 10;
}

export function clear(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

import { getSkyColors, WEATHER_IDS } from './weather.js';

function isSnowWeather(weatherId) {
  return weatherId === WEATHER_IDS.SNOW;
}

function isRainWeather(weatherId) {
  return (
    weatherId === WEATHER_IDS.RAIN ||
    weatherId === WEATHER_IDS.HEAVY_RAIN ||
    weatherId === WEATHER_IDS.THUNDERSTORM ||
    weatherId === WEATHER_IDS.STORM
  );
}

/**
 * 宽屏下左右侧草地宽度：用比例与最大像素限制，避免过宽显得奇怪。
 */
function getSidePanelWidth(width) {
  const ratio = 0.12 + 80 / width;
  return Math.min(width * Math.min(ratio, 0.22), 280);
}

/**
 * Draw battlefield background: sky (with depth), ground by weather.
 * 宽屏友好：左右侧草地用渐变与固定感比例；整体增加立体感。
 */
export function drawBackground(ctx, width, height, state) {
  const farY = height * 0.48;
  const weatherId = state?.weather?.current;
  const sky = getSkyColors(weatherId);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, farY);
  skyGrad.addColorStop(0, sky.top);
  skyGrad.addColorStop(0.45, sky.mid);
  skyGrad.addColorStop(1, sky.bottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, farY);
  const skyDepth = ctx.createLinearGradient(0, 0, width, 0);
  skyDepth.addColorStop(0, 'rgba(0,0,0,0.08)');
  skyDepth.addColorStop(0.5, 'rgba(0,0,0,0)');
  skyDepth.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = skyDepth;
  ctx.fillRect(0, 0, width, farY);

  const sideW = getSidePanelWidth(width);
  const leftEdge = sideW;
  const rightEdge = width - sideW;

  const groundPath = () => {
    ctx.beginPath();
    ctx.moveTo(leftEdge, farY);
    ctx.lineTo(rightEdge, farY);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  };

  if (isSnowWeather(weatherId)) {
    const snowGrad = ctx.createLinearGradient(0, farY, 0, height);
    snowGrad.addColorStop(0, '#c8d8e8');
    snowGrad.addColorStop(0.35, '#e0eaf4');
    snowGrad.addColorStop(0.75, '#e8eef6');
    snowGrad.addColorStop(1, '#d0dae6');
    ctx.fillStyle = snowGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawSidePanels(ctx, 0, width, farY, height, sideW, 'snow');
  } else if (isRainWeather(weatherId)) {
    const wetGrad = ctx.createLinearGradient(0, farY, 0, height);
    wetGrad.addColorStop(0, '#3d6b4d');
    wetGrad.addColorStop(0.4, '#355d42');
    wetGrad.addColorStop(0.85, '#2a4d38');
    wetGrad.addColorStop(1, '#243d2e');
    ctx.fillStyle = wetGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawSidePanels(ctx, 0, width, farY, height, sideW, 'rain');
    drawPuddles(ctx, width, height, farY);
  } else {
    const groundGrad = ctx.createLinearGradient(0, farY, 0, height);
    groundGrad.addColorStop(0, '#5e9070');
    groundGrad.addColorStop(0.35, '#528a62');
    groundGrad.addColorStop(0.7, '#427a52');
    groundGrad.addColorStop(1, '#356945');
    ctx.fillStyle = groundGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const nearBand = ctx.createLinearGradient(0, height - 80, 0, height);
    nearBand.addColorStop(0, 'rgba(0,0,0,0)');
    nearBand.addColorStop(0.5, 'rgba(0,0,0,0.06)');
    nearBand.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = nearBand;
    groundPath();
    ctx.fill();
    drawSidePanels(ctx, 0, width, farY, height, sideW, 'grass');
  }

  drawMapDetails(ctx, width, height, farY, state);
}

/** 左右两侧草地/雪地：渐变营造立体感，宽屏下不会过宽。 */
function drawSidePanels(ctx, x0, width, farY, height, sideW, weather) {
  const panelH = height - farY;
  if (weather === 'snow') {
    const leftGrad = ctx.createLinearGradient(0, farY, sideW, farY);
    leftGrad.addColorStop(0, '#b8c8d8');
    leftGrad.addColorStop(1, '#8a9aaa');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    const rightGrad = ctx.createLinearGradient(width - sideW, farY, width, farY);
    rightGrad.addColorStop(0, '#8a9aaa');
    rightGrad.addColorStop(1, '#b8c8d8');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - sideW, farY, sideW, panelH);
    const vertGrad = ctx.createLinearGradient(0, farY, 0, height);
    vertGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
    vertGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = vertGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    ctx.fillRect(width - sideW, farY, sideW, panelH);
  } else if (weather === 'rain') {
    const leftGrad = ctx.createLinearGradient(0, farY, sideW, farY);
    leftGrad.addColorStop(0, '#355d42');
    leftGrad.addColorStop(1, '#2a4535');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    const rightGrad = ctx.createLinearGradient(width - sideW, farY, width, farY);
    rightGrad.addColorStop(0, '#2a4535');
    rightGrad.addColorStop(1, '#355d42');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - sideW, farY, sideW, panelH);
    const vertGrad = ctx.createLinearGradient(0, farY, 0, height);
    vertGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    vertGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = vertGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    ctx.fillRect(width - sideW, farY, sideW, panelH);
  } else {
    const leftGrad = ctx.createLinearGradient(0, farY, sideW, farY);
    leftGrad.addColorStop(0, '#4a7c59');
    leftGrad.addColorStop(1, '#3a5c45');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    const rightGrad = ctx.createLinearGradient(width - sideW, farY, width, farY);
    rightGrad.addColorStop(0, '#3a5c45');
    rightGrad.addColorStop(1, '#4a7c59');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - sideW, farY, sideW, panelH);
    const vertGrad = ctx.createLinearGradient(0, farY, 0, height);
    vertGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    vertGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = vertGrad;
    ctx.fillRect(0, farY, sideW, panelH);
    ctx.fillRect(width - sideW, farY, sideW, panelH);
  }
}

function drawPuddles(ctx, width, height, farY) {
  const seed = 331;
  const rand = (n) => ((Math.sin(seed * n) * 0.5 + 0.5) * 1000) % 1;
  const puddles = [
    [width * 0.25, farY + (height - farY) * 0.35, 28, 14],
    [width * 0.72, farY + (height - farY) * 0.5, 22, 11],
    [width * 0.5, height - 90, 20, 10],
    [width * 0.38, height - 55, 18, 9],
    [width * 0.62, height - 70, 24, 12],
    [width * 0.18, farY + (height - farY) * 0.6, 16, 8],
    [width * 0.82, farY + (height - farY) * 0.28, 20, 10],
  ];
  puddles.forEach(([x, y, rx, ry], i) => {
    const alpha = 0.35 + rand(i) * 0.2;
    ctx.fillStyle = `rgba(35,55,75,${alpha})`;
    ctx.strokeStyle = `rgba(25,45,65,0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(55,85,110,0.15)`;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Clouds (animated), road, rocks, trees. Road/trees/rocks change by weather (snow / rain).
 */
function drawMapDetails(ctx, width, height, farY, state) {
  const seed = 12345;
  const rand = (n) => ((Math.sin(seed * n) * 0.5 + 0.5) * 1000) % 1;
  const frame = (state && state.frameCount) || 0;
  const weatherId = state?.weather?.current;
  const snow = isSnowWeather(weatherId);
  const rain = isRainWeather(weatherId);

  // Clouds: drift (snow = more grey/white clouds)
  const cloudCount = 7;
  for (let i = 0; i < cloudCount; i++) {
    const speed = 0.12 + rand(i * 7) * 0.12;
    const baseX = width * (0.05 + rand(i) * 0.9);
    const drift = (frame * speed) % (width + 140) - 70;
    const cx = baseX + drift;
    const cy = farY * (0.18 + rand(i + 10) * 0.42);
    const r = 16 + rand(i + 20) * 22;
    const alpha = snow ? 0.85 : 0.7 + rand(i + 30) * 0.2;
    ctx.fillStyle = snow ? `rgba(220,230,245,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.55, cy - r * 0.15, r * 0.65, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.25, cy + r * 0.28, r * 0.75, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.2, cy + r * 0.1, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const roadBottom = height - 20;
  const roadTopY = farY + (height - farY) * 0.35;
  const roadWide = Math.min(width * 0.22, 320);
  const roadNarrow = Math.min(width * 0.08, 100);
  const cxRoad = width / 2;
  ctx.beginPath();
  ctx.moveTo(cxRoad - roadWide, roadBottom);
  ctx.lineTo(cxRoad + roadWide, roadBottom);
  ctx.lineTo(cxRoad + roadNarrow, roadTopY);
  ctx.lineTo(cxRoad - roadNarrow, roadTopY);
  ctx.closePath();

  if (snow) {
    const roadGrad = ctx.createLinearGradient(0, roadBottom, 0, roadTopY);
    roadGrad.addColorStop(0, '#9aacbc');
    roadGrad.addColorStop(0.4, '#c0d0e0');
    roadGrad.addColorStop(0.8, '#d4e0ee');
    roadGrad.addColorStop(1, '#b8c8d8');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  } else if (rain) {
    const roadGrad = ctx.createLinearGradient(cxRoad - roadWide, 0, cxRoad + roadWide, 0);
    roadGrad.addColorStop(0, '#2a2520');
    roadGrad.addColorStop(0.5, '#3a3025');
    roadGrad.addColorStop(1, '#2a2520');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  } else {
    const roadGrad = ctx.createLinearGradient(cxRoad - roadWide, 0, cxRoad + roadWide, 0);
    roadGrad.addColorStop(0, '#3d3025');
    roadGrad.addColorStop(0.35, '#5a4a38');
    roadGrad.addColorStop(0.5, '#6b5a4a');
    roadGrad.addColorStop(0.65, '#5a4a38');
    roadGrad.addColorStop(1, '#3d3025');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  }
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const rocks = [
    [width * 0.22, farY + (height - farY) * 0.3, 12, 8],
    [width * 0.78, farY + (height - farY) * 0.5, 10, 6],
    [width * 0.35, height - 80, 8, 5],
    [width * 0.65, height - 100, 14, 9],
  ];
  rocks.forEach(([x, y, rx, ry], i) => {
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y - ry * 0.4, rx * 0.8, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, rx * 0.9, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = snow ? '#8a9299' : '#6a6a6a';
    ctx.strokeStyle = snow ? '#6a7a88' : '#4a4a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const trees = [
    [width * 0.18, farY + (height - farY) * 0.25],
    [width * 0.82, farY + (height - farY) * 0.22],
    [width * 0.28, height - 60],
    [width * 0.72, height - 70],
  ];
  trees.forEach(([tx, ty]) => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(tx + 4, ty + 2, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = snow ? '#4a4035' : '#3d2818';
    ctx.strokeStyle = snow ? '#3a3028' : '#2a1a10';
    ctx.lineWidth = 1;
    ctx.fillRect(tx - 4, ty, 8, 28);
    ctx.strokeRect(tx - 4, ty, 8, 28);
    const foliageGrad = ctx.createRadialGradient(tx - 8, ty - 10, 0, tx, ty, 32);
    if (snow) {
      foliageGrad.addColorStop(0, '#9aacb8');
      foliageGrad.addColorStop(0.6, '#7a8c98');
      foliageGrad.addColorStop(1, '#5a6c78');
    } else {
      foliageGrad.addColorStop(0, '#3a6a3a');
      foliageGrad.addColorStop(0.7, '#2d5a2d');
      foliageGrad.addColorStop(1, '#1e4a1e');
    }
    ctx.fillStyle = foliageGrad;
    ctx.beginPath();
    ctx.ellipse(tx, ty - 5, 22, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = snow ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    ctx.stroke();
    if (snow) {
      ctx.fillStyle = '#e8eef4';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 12, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

/** 城堡等级对应塔高（与 game.js syncCastleTowerHeight 一致） */
function getTowerH(level) {
  const L = Math.max(1, Math.min(5, level || 1));
  return 68 + (L - 1) * 10;
}

/**
 * Draw the castle at (CASTLE_CX, CASTLE_CY). Levels 1–5 each have a distinct appearance.
 */
export function drawCastle(ctx, level = 1) {
  const L = Math.max(1, Math.min(5, level || 1));
  const cx = CASTLE_CX;
  const cy = CASTLE_CY;
  const towerH = getTowerH(L);
  const towerW = 34 + L * 2;

  if (L === 1) {
    drawCastleLevel1(ctx, cx, cy, towerW, towerH);
    return;
  }
  if (L === 2) {
    drawCastleLevel2(ctx, cx, cy, towerW, towerH);
    return;
  }
  if (L === 3) {
    drawCastleLevel3(ctx, cx, cy, towerW, towerH);
    return;
  }
  if (L === 4) {
    drawCastleLevel4(ctx, cx, cy, towerW, towerH);
    return;
  }
  drawCastleLevel5(ctx, cx, cy, towerW, towerH);
}

function drawCastleRoof(ctx, cx, cy, towerW, towerH, style) {
  const roofH = style === 'tall' ? 28 : 22;
  const roofGrad = ctx.createLinearGradient(cx, cy - towerH - roofH, cx, cy - towerH + 4);
  roofGrad.addColorStop(0, '#6b5344');
  roofGrad.addColorStop(0.3, '#5a4538');
  roofGrad.addColorStop(0.7, '#4a3828');
  roofGrad.addColorStop(1, '#3d2e20');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2 - 4, cy - towerH);
  ctx.lineTo(cx, cy - towerH - roofH);
  ctx.lineTo(cx + towerW / 2 + 4, cy - towerH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2 - 2, cy - towerH);
  ctx.lineTo(cx - towerW / 4, cy - towerH - roofH * 0.6);
  ctx.lineTo(cx, cy - towerH);
  ctx.closePath();
  ctx.fill();
}

function drawCastleFlag(ctx, cx, cy, towerH, big) {
  const roofH = big ? 28 : 22;
  const poleTop = cy - towerH - roofH - (big ? 10 : 6);
  ctx.strokeStyle = '#4a4035';
  ctx.lineWidth = big ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(cx, poleTop + (big ? 20 : 16));
  ctx.lineTo(cx, cy - towerH - roofH + 4);
  ctx.stroke();
  const fw = big ? 16 : 12;
  const fh = big ? 10 : 8;
  const flagGrad = ctx.createLinearGradient(cx, cy - towerH - roofH, cx + fw, cy - towerH - roofH);
  flagGrad.addColorStop(0, '#a02020');
  flagGrad.addColorStop(1, '#6a1010');
  ctx.fillStyle = flagGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - towerH - roofH - (big ? 4 : 2));
  ctx.lineTo(cx + fw, cy - towerH - roofH - fh / 2);
  ctx.lineTo(cx, cy - towerH - roofH + (big ? 4 : 2));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a1010';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTowerBlock(ctx, cx, cy, towerW, towerH, stoneColor) {
  const grad = ctx.createLinearGradient(cx - towerW / 2, 0, cx + towerW / 2, 0);
  grad.addColorStop(0, stoneColor.light);
  grad.addColorStop(0.4, stoneColor.mid);
  grad.addColorStop(0.6, stoneColor.mid);
  grad.addColorStop(1, stoneColor.dark);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = stoneColor.stroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2, cy - towerH);
  ctx.lineTo(cx - towerW / 2, cy);
  ctx.stroke();
}

/** 1 级：无底座，主塔落地 + 底部门 + 屋顶 + 旗 */
function drawCastleLevel1(ctx, cx, cy, towerW, towerH) {
  const stone = { light: '#7a7e82', mid: '#5e6266', dark: '#464a4e', stroke: '#3a3e42' };
  drawTowerBlock(ctx, cx, cy, towerW, towerH, stone);
  ctx.fillStyle = '#1e2228';
  ctx.fillRect(cx - 6, cy - 18, 12, 16);
  ctx.strokeStyle = '#2a2e34';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 6, cy - 18, 12, 16);
  ctx.fillStyle = 'rgba(180,200,255,0.25)';
  ctx.fillRect(cx - 5, cy - 17, 10, 14);
  ctx.fillStyle = '#2c3038';
  ctx.fillRect(cx - 4, cy - towerH * 0.5, 8, 10);
  ctx.strokeStyle = '#1a1e26';
  ctx.strokeRect(cx - 4, cy - towerH * 0.5, 8, 10);
  ctx.fillStyle = 'rgba(200,220,255,0.35)';
  ctx.fillRect(cx - 3, cy - towerH * 0.5 + 1, 6, 8);
  drawCastleRoof(ctx, cx, cy, towerW, towerH, 'normal');
  drawCastleFlag(ctx, cx, cy, towerH, false);
}

/** 2 级：主塔落地 + 两侧小翼 */
function drawCastleLevel2(ctx, cx, cy, towerW, towerH) {
  drawMainTower(ctx, cx, cy, towerW, towerH, 1);
  drawCastleRoof(ctx, cx, cy, towerW, towerH, 'normal');
  drawCastleFlag(ctx, cx, cy, towerH, false);
  const wingW = 14;
  const wingH = 30;
  const wingGrad = ctx.createLinearGradient(cx - towerW / 2 - wingW, 0, cx - towerW / 2, 0);
  wingGrad.addColorStop(0, '#5a5e62');
  wingGrad.addColorStop(1, '#4a4e52');
  ctx.fillStyle = wingGrad;
  ctx.fillRect(cx - towerW / 2 - wingW - 2, cy - towerH + 18, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 2, cy - towerH + 18, wingW, wingH);
  ctx.fillStyle = wingGrad;
  ctx.fillRect(cx + towerW / 2 + 2, cy - towerH + 18, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 2, cy - towerH + 18, wingW, wingH);
}

/** 3 级：主塔两窗，两侧翼稍大 */
function drawCastleLevel3(ctx, cx, cy, towerW, towerH) {
  drawMainTower(ctx, cx, cy, towerW, towerH, 2);
  drawCastleRoof(ctx, cx, cy, towerW, towerH, 'normal');
  drawCastleFlag(ctx, cx, cy, towerH, false);
  const wingW = 16;
  const wingH = 40;
  const wingGrad = ctx.createLinearGradient(cx - towerW / 2 - wingW, 0, cx - towerW / 2, 0);
  wingGrad.addColorStop(0, '#5e6266');
  wingGrad.addColorStop(1, '#4e5256');
  ctx.fillStyle = wingGrad;
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 10, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 4, cy - towerH + 10, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 4, cy - towerH + 10, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 4, cy - towerH + 10, wingW, wingH);
  ctx.fillStyle = '#2a2e34';
  ctx.fillRect(cx - towerW / 2 - wingW, cy - towerH + 22, 6, 8);
  ctx.fillRect(cx + towerW / 2 + 10, cy - towerH + 22, 6, 8);
}

/** 4 级：主塔多窗，两侧翼带垛口 */
function drawCastleLevel4(ctx, cx, cy, towerW, towerH) {
  drawMainTower(ctx, cx, cy, towerW, towerH, 3);
  drawCastleRoof(ctx, cx, cy, towerW, towerH, 'normal');
  drawCastleFlag(ctx, cx, cy, towerH, false);
  const wingW = 20;
  const wingH = 50;
  const wingGrad = ctx.createLinearGradient(cx - towerW / 2 - wingW, 0, cx - towerW / 2, 0);
  wingGrad.addColorStop(0, '#62666a');
  wingGrad.addColorStop(1, '#505458');
  ctx.fillStyle = wingGrad;
  ctx.fillRect(cx - towerW / 2 - wingW - 6, cy - towerH + 6, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 6, cy - towerH + 6, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 6, cy - towerH + 6, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 6, cy - towerH + 6, wingW, wingH);
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? cx - towerW / 2 - wingW - 6 : cx + towerW / 2 + 6;
    ctx.fillStyle = '#484c50';
    for (let i = 0; i < 4; i++) ctx.fillRect(sx + 3 + i * 5, cy - towerH + 4, 3, 5);
  }
  ctx.fillStyle = '#2a2e34';
  ctx.fillRect(cx - towerW / 2 - wingW - 2, cy - towerH + 20, 8, 10);
  ctx.fillRect(cx + towerW / 2 + 12, cy - towerH + 20, 8, 10);
}

/** 5 级：完整要塞，大旗 */
function drawCastleLevel5(ctx, cx, cy, towerW, towerH) {
  drawMainTower(ctx, cx, cy, towerW, towerH, 4);
  drawCastleRoof(ctx, cx, cy, towerW, towerH, 'tall');
  drawCastleFlag(ctx, cx, cy, towerH, true);
  const wingW = 24;
  const wingH = 60;
  const wingGrad = ctx.createLinearGradient(cx - towerW / 2 - wingW, 0, cx - towerW / 2, 0);
  wingGrad.addColorStop(0, '#666a6e');
  wingGrad.addColorStop(1, '#52565a');
  ctx.fillStyle = wingGrad;
  ctx.fillRect(cx - towerW / 2 - wingW - 8, cy - towerH + 2, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 8, cy - towerH + 2, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 8, cy - towerH + 2, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 8, cy - towerH + 2, wingW, wingH);
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? cx - towerW / 2 - wingW - 8 : cx + towerW / 2 + 8;
    ctx.fillStyle = '#4a4e52';
    for (let i = 0; i < 5; i++) ctx.fillRect(sx + 3 + i * 5, cy - towerH, 3, 6);
  }
  ctx.fillStyle = '#2a2e34';
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 16, 10, 12);
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 38, 10, 12);
  ctx.fillRect(cx + towerW / 2 + 12, cy - towerH + 16, 10, 12);
  ctx.fillRect(cx + towerW / 2 + 12, cy - towerH + 38, 10, 12);
}

/** 主塔：石墙渐变 + 砖纹 + 窗户 */
function drawMainTower(ctx, cx, cy, towerW, towerH, windowCount) {
  const towerGrad = ctx.createLinearGradient(cx - towerW / 2, 0, cx + towerW / 2, 0);
  towerGrad.addColorStop(0, '#787c80');
  towerGrad.addColorStop(0.35, '#5e6266');
  towerGrad.addColorStop(0.65, '#54585c');
  towerGrad.addColorStop(1, '#464a4e');
  ctx.fillStyle = towerGrad;
  ctx.fillRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = '#404448';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2, cy - towerH);
  ctx.lineTo(cx - towerW / 2, cy);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  const step = Math.floor(towerW / 10);
  for (let row = 0; row < Math.floor(towerH / 14); row++) {
    for (let col = 0; col < 4; col++) {
      const bx = cx - towerW / 2 + 8 + col * (step + 2);
      const by = cy - towerH + 8 + row * 14;
      ctx.fillRect(bx, by, 6, 7);
    }
  }
  const winH = 10;
  const winW = 8;
  for (let i = 0; i < windowCount; i++) {
    const ty = cy - towerH * (0.32 + i * 0.24);
    ctx.fillStyle = '#1e2228';
    ctx.fillRect(cx - winW / 2, ty, winW, winH);
    ctx.strokeStyle = '#2a2e34';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - winW / 2, ty, winW, winH);
    ctx.fillStyle = 'rgba(190,210,255,0.4)';
    ctx.fillRect(cx - winW / 2 + 1, ty + 1, winW - 2, winH - 2);
  }
}
