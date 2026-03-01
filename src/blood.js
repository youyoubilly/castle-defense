/**
 * Blood particles: subtle hit effect, few small drops that fade quickly.
 */

const PARTICLE_LIFE = 20;
const PARTICLE_SPEED = 0.4;

export function spawnBloodParticles(state, x, y, count = 4) {
  if (!state.bloodParticles) state.bloodParticles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.15 + Math.random() * PARTICLE_SPEED;
    state.bloodParticles.push({
      x: x + (Math.random() - 0.5) * 5,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: 0.3 + Math.random() * 0.3,
      life: PARTICLE_LIFE,
      maxLife: PARTICLE_LIFE,
      r: 0.8 + Math.random() * 0.8,
    });
  }
}

export function updateBloodParticles(state) {
  if (!state.bloodParticles || state.bloodParticles.length === 0) return;
  state.bloodParticles = state.bloodParticles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.vx *= 0.98;
    p.life--;
    return p.life > 0;
  });
}

export function drawBloodParticles(ctx, state) {
  if (!state.bloodParticles || state.bloodParticles.length === 0) return;
  state.bloodParticles.forEach((p) => {
    const alpha = (p.life / p.maxLife) * 0.6;
    ctx.fillStyle = `rgba(160, 30, 40, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
}
