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
 * Draw battlefield background: sky above (full width), ground by weather (snow layer / wet + puddles / normal).
 */
export function drawBackground(ctx, width, height, state) {
  const farY = height * 0.5;
  const weatherId = state?.weather?.current;
  const sky = getSkyColors(weatherId);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, farY);
  skyGradient.addColorStop(0, sky.top);
  skyGradient.addColorStop(0.5, sky.mid);
  skyGradient.addColorStop(1, sky.bottom);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, farY);

  const groundPath = () => {
    ctx.beginPath();
    ctx.moveTo(width * 0.15, farY);
    ctx.lineTo(width * 0.85, farY);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  };

  if (isSnowWeather(weatherId)) {
    const snowGrad = ctx.createLinearGradient(0, farY, 0, height);
    snowGrad.addColorStop(0, '#c8d8e8');
    snowGrad.addColorStop(0.4, '#e0eaf4');
    snowGrad.addColorStop(0.8, '#e8eef6');
    snowGrad.addColorStop(1, '#d8e0ec');
    ctx.fillStyle = snowGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d0dce8';
    ctx.fillRect(0, farY, width * 0.15, height - farY);
    ctx.fillRect(width * 0.85, farY, width * 0.15, height - farY);
  } else if (isRainWeather(weatherId)) {
    const wetGrad = ctx.createLinearGradient(0, farY, 0, height);
    wetGrad.addColorStop(0, '#3d6b4d');
    wetGrad.addColorStop(0.5, '#355d42');
    wetGrad.addColorStop(1, '#2a4d38');
    ctx.fillStyle = wetGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#355d42';
    ctx.fillRect(0, farY, width * 0.15, height - farY);
    ctx.fillRect(width * 0.85, farY, width * 0.15, height - farY);
    drawPuddles(ctx, width, height, farY);
  } else {
    const groundGrad = ctx.createLinearGradient(0, farY, 0, height);
    groundGrad.addColorStop(0, '#5a8c69');
    groundGrad.addColorStop(0.6, '#4a7c59');
    groundGrad.addColorStop(1, '#3a6b49');
    ctx.fillStyle = groundGrad;
    groundPath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#4a7c59';
    ctx.fillRect(0, farY, width * 0.15, height - farY);
    ctx.fillRect(width * 0.85, farY, width * 0.15, height - farY);
  }

  drawMapDetails(ctx, width, height, farY, state);
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
  const roadWide = width * 0.22;
  const roadNarrow = width * 0.08;
  ctx.beginPath();
  ctx.moveTo(width / 2 - roadWide, roadBottom);
  ctx.lineTo(width / 2 + roadWide, roadBottom);
  ctx.lineTo(width / 2 + roadNarrow, roadTopY);
  ctx.lineTo(width / 2 - roadNarrow, roadTopY);
  ctx.closePath();

  if (snow) {
    const roadGrad = ctx.createLinearGradient(0, roadBottom, 0, roadTopY);
    roadGrad.addColorStop(0, '#b8c8d8');
    roadGrad.addColorStop(0.6, '#d0dce8');
    roadGrad.addColorStop(1, '#c0d0e0');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  } else if (rain) {
    ctx.fillStyle = '#3a3025';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  } else {
    const roadGrad = ctx.createLinearGradient(width / 2 - roadWide, 0, width / 2 + roadWide, 0);
    roadGrad.addColorStop(0, '#4a3a2a');
    roadGrad.addColorStop(0.5, '#6b5a4a');
    roadGrad.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  }
  ctx.lineWidth = 1;
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

function drawCastleBase(ctx, cx, cy, extraRing) {
  const rx = CASTLE_BASE_RX;
  const ry = CASTLE_BASE_RY;
  const baseGrad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.2, 0, cx, cy, rx * 1.2);
  baseGrad.addColorStop(0, '#5c5c5c');
  baseGrad.addColorStop(0.6, '#4a4a4a');
  baseGrad.addColorStop(1, '#383838');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (extraRing) {
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, rx - 5, ry - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawCastleRoof(ctx, cx, cy, towerW, towerH) {
  const roofGrad = ctx.createLinearGradient(cx, cy - towerH - 22, cx, cy - towerH);
  roofGrad.addColorStop(0, '#5a4030');
  roofGrad.addColorStop(0.4, '#4a3424');
  roofGrad.addColorStop(1, '#3d2817');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2 - 5, cy - towerH);
  ctx.lineTo(cx, cy - towerH - 22);
  ctx.lineTo(cx + towerW / 2 + 5, cy - towerH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a1810';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCastleFlag(ctx, cx, cy, towerH, big) {
  const poleTop = cy - towerH - (big ? 28 : 22);
  ctx.strokeStyle = '#3a3028';
  ctx.lineWidth = big ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(cx, poleTop + (big ? 18 : 14));
  ctx.lineTo(cx, cy - towerH - (big ? 12 : 8));
  ctx.stroke();
  ctx.fillStyle = '#8b0000';
  ctx.beginPath();
  const fw = big ? 14 : 10;
  ctx.moveTo(cx, cy - towerH - (big ? 22 : 18));
  ctx.lineTo(cx + fw, cy - towerH - (big ? 18 : 14));
  ctx.lineTo(cx, cy - towerH - (big ? 14 : 10));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6a0000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawCastleLevel1(ctx, cx, cy, towerW, towerH) {
  const rx = CASTLE_BASE_RX;
  const ry = CASTLE_BASE_RY;

  // Shadow under base
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry + 4, rx * 1.05, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Base: stone ellipse with gradient
  const baseGrad = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.2, 0, cx, cy, rx * 1.15);
  baseGrad.addColorStop(0, '#5a5a5a');
  baseGrad.addColorStop(0.5, '#4a4a4a');
  baseGrad.addColorStop(1, '#383838');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Base rim (darker band)
  ctx.strokeStyle = '#323232';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 2, ry - 1, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Simple gate/door hint (dark arch)
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tower: gradient for depth (lighter left = light source)
  const towerGrad = ctx.createLinearGradient(cx - towerW / 2, 0, cx + towerW / 2, 0);
  towerGrad.addColorStop(0, '#6a6a6a');
  towerGrad.addColorStop(0.35, '#5a5a5a');
  towerGrad.addColorStop(0.65, '#505050');
  towerGrad.addColorStop(1, '#454545');
  ctx.fillStyle = towerGrad;
  ctx.fillRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - towerW / 2, cy - towerH, towerW, towerH);

  // Tower front edge highlight
  ctx.strokeStyle = 'rgba(120,120,120,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - towerW / 2, cy - towerH);
  ctx.lineTo(cx - towerW / 2, cy);
  ctx.stroke();

  // One small window
  ctx.fillStyle = '#2a3540';
  ctx.fillRect(cx - 5, cy - towerH * 0.55, 10, 12);
  ctx.strokeStyle = '#1a2028';
  ctx.strokeRect(cx - 5, cy - towerH * 0.55, 10, 12);
  ctx.fillStyle = 'rgba(180,200,255,0.4)';
  ctx.fillRect(cx - 4, cy - towerH * 0.55 + 1, 8, 10);

  // Roof with gradient
  drawCastleRoof(ctx, cx, cy, towerW, towerH);

  // Flag pole + flag
  drawCastleFlag(ctx, cx, cy, towerH);
}

/** 2 级：有底座环与主塔，两侧各一小翼（可站 1 弓箭手） */
function drawCastleLevel2(ctx, cx, cy, towerW, towerH) {
  drawCastleBase(ctx, cx, cy, true);
  drawMainTower(ctx, cx, cy, towerW, towerH, 1);
  drawCastleRoof(ctx, cx, cy, towerW, towerH);
  drawCastleFlag(ctx, cx, cy, towerH);
  const wingW = 12;
  const wingH = 28;
  ctx.fillStyle = '#525a5a';
  ctx.fillRect(cx - towerW / 2 - wingW - 2, cy - towerH + 20, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 2, cy - towerH + 20, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 2, cy - towerH + 20, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 2, cy - towerH + 20, wingW, wingH);
}

/** 3 级：主塔更高，两窗，两侧翼稍大 */
function drawCastleLevel3(ctx, cx, cy, towerW, towerH) {
  drawCastleBase(ctx, cx, cy, true);
  drawMainTower(ctx, cx, cy, towerW, towerH, 2);
  drawCastleRoof(ctx, cx, cy, towerW, towerH);
  drawCastleFlag(ctx, cx, cy, towerH);
  const wingW = 14;
  const wingH = 38;
  ctx.fillStyle = '#5a6262';
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 12, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 4, cy - towerH + 12, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 4, cy - towerH + 12, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 4, cy - towerH + 12, wingW, wingH);
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(cx - towerW / 2 - wingW - 2, cy - towerH + 22, 6, 8);
  ctx.fillRect(cx + towerW / 2 + 8, cy - towerH + 22, 6, 8);
}

/** 4 级：主塔更多砖纹与窗，两侧翼带垛口 */
function drawCastleLevel4(ctx, cx, cy, towerW, towerH) {
  drawCastleBase(ctx, cx, cy, true);
  drawMainTower(ctx, cx, cy, towerW, towerH, 3);
  drawCastleRoof(ctx, cx, cy, towerW, towerH);
  drawCastleFlag(ctx, cx, cy, towerH);
  const wingW = 18;
  const wingH = 48;
  ctx.fillStyle = '#5c6464';
  ctx.fillRect(cx - towerW / 2 - wingW - 6, cy - towerH + 8, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 6, cy - towerH + 8, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 6, cy - towerH + 8, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 6, cy - towerH + 8, wingW, wingH);
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? cx - towerW / 2 - wingW - 6 : cx + towerW / 2 + 6;
    ctx.fillStyle = '#4a5050';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(sx + 2 + i * 4, cy - towerH + 6, 2, 4);
    }
  }
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(cx - towerW / 2 - wingW - 2, cy - towerH + 20, 8, 10);
  ctx.fillRect(cx + towerW / 2 + 10, cy - towerH + 20, 8, 10);
}

/** 5 级：完整要塞，主塔与双翼带垛口，旗更大 */
function drawCastleLevel5(ctx, cx, cy, towerW, towerH) {
  drawCastleBase(ctx, cx, cy, true);
  ctx.fillStyle = '#363a3a';
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, CASTLE_BASE_RX - 8, CASTLE_BASE_RY - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawMainTower(ctx, cx, cy, towerW, towerH, 4);
  drawCastleRoof(ctx, cx, cy, towerW, towerH);
  drawCastleFlag(ctx, cx, cy, towerH, true);
  const wingW = 22;
  const wingH = 58;
  ctx.fillStyle = '#5e6666';
  ctx.fillRect(cx - towerW / 2 - wingW - 8, cy - towerH + 4, wingW, wingH);
  ctx.strokeRect(cx - towerW / 2 - wingW - 8, cy - towerH + 4, wingW, wingH);
  ctx.fillRect(cx + towerW / 2 + 8, cy - towerH + 4, wingW, wingH);
  ctx.strokeRect(cx + towerW / 2 + 8, cy - towerH + 4, wingW, wingH);
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? cx - towerW / 2 - wingW - 8 : cx + towerW / 2 + 8;
    ctx.fillStyle = '#4a5252';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(sx + 2 + i * 4, cy - towerH + 2, 2, 5);
    }
  }
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 16, 10, 12);
  ctx.fillRect(cx - towerW / 2 - wingW - 4, cy - towerH + 36, 10, 12);
  ctx.fillRect(cx + towerW / 2 + 10, cy - towerH + 16, 10, 12);
  ctx.fillRect(cx + towerW / 2 + 10, cy - towerH + 36, 10, 12);
}

/** 主塔：砖纹 + 若干窗户 */
function drawMainTower(ctx, cx, cy, towerW, towerH, windowCount) {
  const towerGrad = ctx.createLinearGradient(cx - towerW / 2, 0, cx + towerW / 2, 0);
  towerGrad.addColorStop(0, '#6a6e6e');
  towerGrad.addColorStop(0.4, '#5a5e5e');
  towerGrad.addColorStop(0.6, '#525656');
  towerGrad.addColorStop(1, '#4a4e4e');
  ctx.fillStyle = towerGrad;
  ctx.fillRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - towerW / 2, cy - towerH, towerW, towerH);
  ctx.fillStyle = '#424848';
  const step = Math.floor(towerW / 10);
  for (let row = 0; row < Math.floor(towerH / 12); row++) {
    for (let col = 0; col < 4; col++) {
      const bx = cx - towerW / 2 + 6 + col * (step + 2);
      const by = cy - towerH + 6 + row * 12;
      ctx.fillRect(bx, by, 6, 6);
    }
  }
  const winH = 10;
  const winW = 8;
  for (let i = 0; i < windowCount; i++) {
    const ty = cy - towerH * (0.35 + i * 0.25);
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(cx - winW / 2, ty, winW, winH);
    ctx.strokeRect(cx - winW / 2, ty, winW, winH);
    ctx.fillStyle = 'rgba(180,200,255,0.35)';
    ctx.fillRect(cx - winW / 2 + 1, ty + 1, winW - 2, winH - 2);
  }
}
