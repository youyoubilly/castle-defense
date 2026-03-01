import { tryCastMagic } from './magic.js';
import { hitTestSoldiers } from './soldiers.js';
import { hitTestEnemies } from './enemies.js';
import { getCastleRadius } from './canvas.js';

function hitTestCastle(state, px, py) {
  const cx = state.castleCx ?? 0;
  const cy = state.castleCy ?? 0;
  return Math.hypot(px - cx, py - cy) < (getCastleRadius() + 15);
}

/**
 * Line drawing: mouse events, storage, and rendering.
 * Click on castle shows castle panel; click on unit shows attributes; wave complete / magic / draw line as before.
 */
export function setupDrawing(canvas, state, clientToCanvas, { onWaveComplete } = {}) {
  const onDown = (e) => {
    const p = clientToCanvas(canvas, e.clientX, e.clientY);
    if (state.waveState === 'completed' && onWaveComplete) {
      onWaveComplete();
      return;
    }
    if (hitTestCastle(state, p.x, p.y)) {
      state.selectedUnit = { type: 'castle' };
      return;
    }
    const soldier = hitTestSoldiers(state, p.x, p.y);
    if (soldier) {
      state.selectedUnit = { type: 'soldier', unit: soldier };
      return;
    }
    const enemy = hitTestEnemies(state, p.x, p.y);
    if (enemy) {
      state.selectedUnit = { type: 'enemy', unit: enemy };
      return;
    }
    if (state.magic?.selectedSkill && tryCastMagic(state, p.x, p.y)) return;
    state.selectedUnit = null;
    state.isDrawing = true;
    state.currentLine = [{ x: p.x, y: p.y }];
  };

  const onMove = (e) => {
    if (!state.isDrawing) return;
    const p = clientToCanvas(canvas, e.clientX, e.clientY);
    state.currentLine.push({ x: p.x, y: p.y });
  };

  const onUp = () => {
    if (!state.isDrawing) return;
    if (state.currentLine.length >= 2) {
      state.lines.push([...state.currentLine]);
    }
    state.isDrawing = false;
    state.currentLine = [];
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
}

/**
 * Draw all stored lines and the current line preview.
 */
export function drawLines(ctx, state) {
  ctx.strokeStyle = 'rgba(200, 80, 80, 0.9)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const points of state.lines) {
    if (points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  if (state.currentLine && state.currentLine.length >= 2) {
    ctx.strokeStyle = 'rgba(255, 150, 150, 0.8)';
    ctx.beginPath();
    ctx.moveTo(state.currentLine[0].x, state.currentLine[0].y);
    for (let i = 1; i < state.currentLine.length; i++) {
      ctx.lineTo(state.currentLine[i].x, state.currentLine[i].y);
    }
    ctx.stroke();
  }
}
