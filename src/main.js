import './style.css';
import { getCanvas, getCtx, resizeCanvas, clientToCanvas } from './canvas.js';
import { setupDrawing } from './drawing.js';
import { createState, gameLoop, startNextWave, resetState, continueGame, canContinue, CASTLE_MAX_LEVEL, syncCastleTowerHeight } from './game.js';
import { startSpawning } from './enemies.js';
import { createArchers } from './archers.js';
import { addSoldier, getUpgradeOptions, upgradeSoldierTo, UPGRADE_COSTS } from './soldiers.js';
import { addArtillery } from './artillery.js';
import {
  selectSkill,
  getSkillCooldownRemaining,
  getSkillName,
  getSkillLevel,
  getSkillUpgradeCost,
  upgradeSkill,
  canUseSkillInWeather,
  getSkillWeatherReason,
  SKILL_IDS,
  SKILL_MAX_LEVEL,
} from './magic.js';

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
    const gold = state.gold ?? 0;
    document.querySelectorAll('#shop-panel button[data-action]').forEach((btn) => {
      const action = btn.getAttribute('data-action');
      if (action === 'skill_upgrade') {
        const skillId = btn.dataset.skill;
        const level = getSkillLevel(state, skillId);
        const cost = getSkillUpgradeCost(level);
        const name = getSkillName(skillId);
        btn.textContent = level >= SKILL_MAX_LEVEL
          ? `${name} Lv.${level} (已满级)`
          : `${name} Lv.${level}→${level + 1} (${cost} 金币)`;
        btn.disabled = level >= SKILL_MAX_LEVEL || gold < cost;
        return;
      }
      const cost = parseInt(btn.getAttribute('data-cost'), 10);
      let disabled = Number.isNaN(cost) || gold < cost;
      if (action === 'castle' && (state.castleLevel || 1) >= CASTLE_MAX_LEVEL) disabled = true;
      if (action === 'life' && (state.castleHealth ?? 10) >= 10) disabled = true;
      if (action === 'soldier' && (state.soldiers?.length ?? 0) >= 8) disabled = true;
      if (action === 'artillery' && (state.artillery?.length ?? 0) >= (state.maxArtillery ?? 2)) disabled = true;
      btn.disabled = disabled;
    });
  }

  function closeShop() {
    state.shopOpen = false;
    shopOverlay.classList.add('shop-hidden');
  }

  document.getElementById('shop-btn').onclick = () => {
    state.shopOpen = !state.shopOpen;
    shopOverlay.classList.toggle('shop-hidden', !state.shopOpen);
    updateShopContent();
  };

  shopOverlay.addEventListener('click', (e) => {
    if (e.target === shopOverlay) closeShop();
  });

  document.querySelectorAll('#shop-close, #shop-close-bottom').forEach((btn) => {
    if (btn) btn.addEventListener('click', closeShop);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.shopOpen) {
      closeShop();
      e.preventDefault();
    }
  });

  const shopPanel = document.getElementById('shop-panel');
  if (shopPanel) {
    shopPanel.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.getAttribute('data-action');
      if (action === 'skill_upgrade') {
        const skillId = btn.getAttribute('data-skill');
        if (!skillId || !upgradeSkill(state, skillId)) return;
        updateShopContent();
        return;
      }
      const costNum = parseInt(btn.getAttribute('data-cost'), 10);
      if (Number.isNaN(costNum) || (state.gold ?? 0) < costNum) return;
      state.gold = (state.gold ?? 0) - costNum;
      if (action === 'castle') {
        state.castleLevel = Math.min(CASTLE_MAX_LEVEL, (state.castleLevel || 1) + 1);
        state.archers = createArchers(state);
        syncCastleTowerHeight(state);
      }
      if (action === 'life') {
        state.castleHealth = Math.min(10, (state.castleHealth ?? 10) + 1);
      }
      if (action === 'soldier') {
        addSoldier(state);
      }
      if (action === 'artillery') {
        addArtillery(state);
      }
      if (action === 'soldier_attack') {
        state.soldierAttackBonus = (state.soldierAttackBonus ?? 0) + 3;
        (state.soldiers || []).forEach((s) => { s.attack = (s.attack ?? 20) + 3; });
      }
      if (action === 'soldier_hp') {
        state.soldierHpBonus = (state.soldierHpBonus ?? 0) + 30;
        (state.soldiers || []).forEach((s) => { s.maxHp = (s.maxHp ?? 250) + 30; });
      }
      if (action === 'soldier_defense') {
        state.soldierDefenseBonus = (state.soldierDefenseBonus ?? 0) + 2;
        (state.soldiers || []).forEach((s) => { s.defense = (s.defense ?? 5) + 2; });
      }
      updateShopContent();
    });
  }

  window.addEventListener('resize', () => {
    resizeCanvas(canvas);
    state.width = canvas.width;
    state.height = canvas.height;
    state.castleCx = canvas.width / 2;
    state.castleCy = canvas.height * 0.75;
  });

  const SKILL_KEYS = [
    SKILL_IDS.FIRE_RAIN,
    SKILL_IDS.FIRE_ARROW,
    SKILL_IDS.FIRE_SEA,
    SKILL_IDS.FREEZE,
    SKILL_IDS.ICE_ARROW,
    SKILL_IDS.FROST_RING,
    SKILL_IDS.MISSILE,
    SKILL_IDS.BALLISTA,
    SKILL_IDS.VOLLEY,
  ];
  const btnIds = [
    'magic-fire-rain',
    'magic-fire-arrow',
    'magic-fire-sea',
    'magic-freeze',
    'magic-ice-arrow',
    'magic-frost-ring',
    'magic-missile',
    'magic-ballista',
    'magic-volley',
  ];
  const KEY_TO_SKILL = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8 };

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
    ids.forEach((skillId, i) => {
      const btn = document.getElementById(btnIds[i]);
      if (!btn) return;
      const rem = getSkillCooldownRemaining(state, skillId);
      const canUseWeather = canUseSkillInWeather(state, skillId);
      const weatherReason = getSkillWeatherReason(state, skillId);
      btn.disabled = rem > 0 || !canUseWeather;
      const name = getSkillName(skillId);
      const lv = getSkillLevel(state, skillId);
      if (rem > 0) {
        btn.textContent = `${name} ${Math.ceil(rem / 1000)}s`;
      } else if (!canUseWeather && weatherReason) {
        btn.textContent = name + ' ✕';
      } else {
        btn.textContent = `${name} [${i + 1}]`;
      }
      btn.title = weatherReason || (rem > 0 ? `冷却 ${Math.ceil(rem / 1000)}s` : `${name} Lv.${lv} · 键${i + 1}`);
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

  const soldierUpgradePanel = document.getElementById('soldier-upgrade-panel');
  const soldierUpgradeButtons = document.getElementById('soldier-upgrade-buttons');

  if (soldierUpgradeButtons) {
    soldierUpgradeButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-upgrade-class]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const newClassId = btn.getAttribute('data-upgrade-class');
      if (!newClassId) return;
      const sel = state.selectedUnit;
      if (sel?.type !== 'soldier' || !sel.unit) return;
      const soldier = sel.unit;
      if ((soldier.class || 'guard') !== 'guard') return;
      const cost = UPGRADE_COSTS[newClassId];
      if (cost == null || (state.gold ?? 0) < cost) return;
      if (upgradeSoldierTo(state, soldier, newClassId)) {
        _lastSoldierUpgradeKey = '';
        updateSoldierUpgradePanel();
      }
    });
  }

  const castlePanel = document.getElementById('castle-panel');
  const castlePanelLevel = document.getElementById('castle-panel-level');
  const castlePanelHp = document.getElementById('castle-panel-hp');
  const castlePanelGold = document.getElementById('castle-panel-gold');
  const castlePanelButtons = document.getElementById('castle-panel-buttons');
  const castlePanelClose = document.getElementById('castle-panel-close');

  function updateCastlePanel() {
    if (!castlePanel) return;
    const show = state.selectedUnit?.type === 'castle';
    if (show) {
      castlePanel.classList.remove('castle-panel-hidden');
      if (castlePanelLevel) castlePanelLevel.textContent = state.castleLevel ?? 1;
      if (castlePanelHp) castlePanelHp.textContent = Math.max(0, state.castleHealth ?? 10);
      if (castlePanelGold) castlePanelGold.textContent = state.gold ?? 0;
      const gold = state.gold ?? 0;
      castlePanelButtons.querySelectorAll('button[data-action]').forEach((btn) => {
        const action = btn.getAttribute('data-action');
        const cost = parseInt(btn.getAttribute('data-cost'), 10);
        let disabled = Number.isNaN(cost) || gold < cost;
        if (action === 'castle' && (state.castleLevel || 1) >= CASTLE_MAX_LEVEL) disabled = true;
        if (action === 'life' && (state.castleHealth ?? 10) >= 10) disabled = true;
        if (action === 'soldier' && (state.soldiers?.length ?? 0) >= 8) disabled = true;
        if (action === 'artillery' && (state.artillery?.length ?? 0) >= (state.maxArtillery ?? 2)) disabled = true;
        btn.disabled = disabled;
      });
    } else {
      castlePanel.classList.add('castle-panel-hidden');
    }
  }

  if (castlePanelClose) {
    castlePanelClose.addEventListener('click', () => { state.selectedUnit = null; });
  }

  if (castlePanelButtons) {
    castlePanelButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.getAttribute('data-action');
      const costNum = parseInt(btn.getAttribute('data-cost'), 10);
      if (Number.isNaN(costNum) || (state.gold ?? 0) < costNum) return;
      state.gold = (state.gold ?? 0) - costNum;
      if (action === 'castle') {
        state.castleLevel = Math.min(CASTLE_MAX_LEVEL, (state.castleLevel || 1) + 1);
        state.archers = createArchers(state);
        syncCastleTowerHeight(state);
      }
      if (action === 'life') {
        state.castleHealth = Math.min(10, (state.castleHealth ?? 10) + 1);
      }
      if (action === 'soldier') {
        addSoldier(state);
      }
      if (action === 'artillery') {
        addArtillery(state);
      }
      if (action === 'soldier_attack') {
        state.soldierAttackBonus = (state.soldierAttackBonus ?? 0) + 3;
        (state.soldiers || []).forEach((s) => { s.attack = (s.attack ?? 20) + 3; });
      }
      if (action === 'soldier_hp') {
        state.soldierHpBonus = (state.soldierHpBonus ?? 0) + 30;
        (state.soldiers || []).forEach((s) => { s.maxHp = (s.maxHp ?? 250) + 30; });
      }
      if (action === 'soldier_defense') {
        state.soldierDefenseBonus = (state.soldierDefenseBonus ?? 0) + 2;
        (state.soldiers || []).forEach((s) => { s.defense = (s.defense ?? 5) + 2; });
      }
      updateCastlePanel();
    });
  }

  let _lastSoldierUpgradeKey = '';
  function updateSoldierUpgradePanel() {
    if (!soldierUpgradePanel || !soldierUpgradeButtons) return;
    const sel = state.selectedUnit;
    if (sel?.type !== 'soldier' || !sel.unit) {
      soldierUpgradePanel.classList.add('soldier-upgrade-hidden');
      _lastSoldierUpgradeKey = '';
      return;
    }
    soldierUpgradePanel.classList.remove('soldier-upgrade-hidden');
    const soldier = sel.unit;
    const gold = state.gold ?? 0;
    const options = getUpgradeOptions(soldier);
    const key = `${soldier.class ?? 'guard'}-${gold}-${options.length}`;
    if (key === _lastSoldierUpgradeKey) return;
    _lastSoldierUpgradeKey = key;

    soldierUpgradeButtons.innerHTML = '';
    if (options.length === 0) {
      const p = document.createElement('p');
      p.className = 'soldier-upgrade-title';
      p.textContent = '已进阶，无法再升级';
      p.style.marginBottom = '0';
      soldierUpgradeButtons.appendChild(p);
      return;
    }
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `升级为 ${opt.name} (${opt.cost} 金币)`;
      btn.disabled = gold < opt.cost;
      btn.setAttribute('data-upgrade-class', opt.class);
      soldierUpgradeButtons.appendChild(btn);
    });
  }

  function loop() {
    gameLoop(ctx, canvas, state);
    const isGameOver = (state.castleHealth ?? 10) <= 0;
    gameOverOverlay.classList.toggle('game-over-hidden', !isGameOver);
    if (isGameOver) {
      gameOverScoreEl.textContent = state.score ?? 0;
      gameOverGoldEl.textContent = state.gold ?? 0;
      gameOverContinueBtn.disabled = !canContinue(state);
    }
    updateSoldierUpgradePanel();
    updateCastlePanel();
    updateMagicButtons();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
