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
 * Mouse input: castle / unit selection, wave complete, magic cast.
 * 画线阻挡敌人功能已移除。
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
  };

  canvas.addEventListener('mousedown', onDown);
}

/** 画线功能已移除，保留空实现以免调用处报错 */
export function drawLines(_ctx, _state) {}
