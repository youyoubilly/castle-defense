import './style.css';
import { getCanvas, getCtx, resizeCanvas, clientToCanvas } from './canvas.js';
import { setupDrawing } from './drawing.js';
import { createState, gameLoop, startNextWave, resetState, continueGame, canContinue } from './game.js';
import { startSpawning } from './enemies.js';
import { addSoldier } from './soldiers.js';
import { selectSkill, getSkillCooldownRemaining, getSkillName, SKILL_IDS } from './magic.js';

function main() {
  const canvas = getCanvas();
  const ctx = getCtx(canvas);
  if (!ctx) throw new Error('Could not get 2D context');

  resizeCanvas(canvas);
  const state = createState(canvas);
  setupDrawing(canvas, state, clientToCanvas, { onWaveComplete: () => startNextWave(state) });
  startSpawning(state, canvas.width, canvas.height);

  const shopOverlay = document.getElementById('shop-overlay');
  const shopGoldEl = document.getElementById('shop-gold');

  function updateShopContent() {
    shopGoldEl.textContent = state.gold ?? 0;
    document.querySelectorAll('[data-action]').forEach((btn) => {
      const cost = parseInt(btn.dataset.cost, 10);
      const action = btn.dataset.action;
      let disabled = state.gold < cost;
      if (action === 'castle' && (state.castleLevel || 1) >= 3) disabled = true;
      if (action === 'life' && (state.castleHealth ?? 10) >= 10) disabled = true;
      if (action === 'soldier' && (state.soldiers?.length ?? 0) >= 8) disabled = true;
      btn.disabled = disabled;
    });
  }

  document.getElementById('shop-btn').onclick = () => {
    state.shopOpen = !state.shopOpen;
    shopOverlay.classList.toggle('shop-hidden', !state.shopOpen);
    updateShopContent();
  };

  document.getElementById('shop-close').onclick = () => {
    state.shopOpen = false;
    shopOverlay.classList.add('shop-hidden');
  };

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => {
      const cost = parseInt(btn.dataset.cost, 10);
      const action = btn.dataset.action;
      if (state.gold < cost) return;
      state.gold -= cost;
      if (action === 'castle') {
        state.castleLevel = Math.min(3, (state.castleLevel || 1) + 1);
      }
      if (action === 'life') {
        state.castleHealth = Math.min(10, (state.castleHealth ?? 10) + 1);
      }
      if (action === 'soldier') {
        addSoldier(state);
      }
      updateShopContent();
    };
  });

  window.addEventListener('resize', () => {
    resizeCanvas(canvas);
    state.width = canvas.width;
    state.height = canvas.height;
    state.castleCx = canvas.width / 2;
    state.castleCy = canvas.height * 0.75;
  });

  const SKILL_KEYS = [SKILL_IDS.FIRE_RAIN, SKILL_IDS.FIRE_ARROW, SKILL_IDS.FREEZE, SKILL_IDS.FIRE_SEA, SKILL_IDS.MISSILE];
  const KEY_TO_SKILL = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };

  window.addEventListener('keydown', (e) => {
    if (!state.running) return;
    const idx = KEY_TO_SKILL[e.key];
    if (idx != null) {
      e.preventDefault();
      selectSkill(state, SKILL_KEYS[idx]);
    }
  });

  function updateMagicButtons() {
    const ids = SKILL_KEYS;
    const btnIds = ['magic-fire-rain', 'magic-fire-arrow', 'magic-freeze', 'magic-fire-sea', 'magic-missile'];
    ids.forEach((skillId, i) => {
      const btn = document.getElementById(btnIds[i]);
      if (!btn) return;
      const rem = getSkillCooldownRemaining(state, skillId);
      btn.disabled = rem > 0;
      const name = getSkillName(skillId);
      const keyHint = ` [${i + 1}]`;
      btn.textContent = rem > 0 ? `${name} (${Math.ceil(rem / 1000)}s)` : name + keyHint;
      btn.classList.toggle('selected', state.magic?.selectedSkill === skillId);
    });
  }

  document.querySelectorAll('[data-skill]').forEach((btn) => {
    btn.onclick = () => selectSkill(state, btn.dataset.skill);
  });

  const gameOverOverlay = document.getElementById('game-over-overlay');
  const gameOverScoreEl = document.getElementById('game-over-score');
  const gameOverGoldEl = document.getElementById('game-over-gold');
  const gameOverRestartBtn = document.getElementById('game-over-restart');
  const gameOverContinueBtn = document.getElementById('game-over-continue');

  gameOverRestartBtn.onclick = () => {
    resetState(state);
    gameOverOverlay.classList.add('game-over-hidden');
  };

  gameOverContinueBtn.onclick = () => {
    if (!canContinue(state)) return;
    continueGame(state);
    gameOverOverlay.classList.add('game-over-hidden');
  };

  function loop() {
    gameLoop(ctx, canvas, state);
    const isGameOver = (state.castleHealth ?? 10) <= 0;
    gameOverOverlay.classList.toggle('game-over-hidden', !isGameOver);
    if (isGameOver) {
      gameOverScoreEl.textContent = state.score ?? 0;
      gameOverGoldEl.textContent = state.gold ?? 0;
      gameOverContinueBtn.disabled = !canContinue(state);
    }
    updateMagicButtons();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
