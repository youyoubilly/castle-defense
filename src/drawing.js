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
 * Mouse & touch input: castle / unit selection, wave complete, magic cast.
 * 画线阻挡敌人功能已移除。
 */
export function setupDrawing(canvas, state, clientToCanvas, { onWaveComplete } = {}) {
  const handlePoint = (clientX, clientY) => {
    const p = clientToCanvas(canvas, clientX, clientY);
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

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    handlePoint(e.clientX, e.clientY);
  };

  const onTouch = (e) => {
    if (e.cancelable) e.preventDefault();
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    handlePoint(t.clientX, t.clientY);
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('touchend', onTouch, { passive: false });
}

/** 画线功能已移除，保留空实现以免调用处报错 */
export function drawLines(_ctx, _state) {}
