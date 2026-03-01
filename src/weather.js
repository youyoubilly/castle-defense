/**
 * Random weather module: sunny, rain, snow, thunderstorm, heavy_rain, hail, storm.
 * State: current weather, particles, lightning flash, next change time.
 */

export const WEATHER_IDS = {
  SUNNY: 'sunny',
  RAIN: 'rain',
  SNOW: 'snow',
  THUNDERSTORM: 'thunderstorm',
  HEAVY_RAIN: 'heavy_rain',
  HAIL: 'hail',
  STORM: 'storm',
};

const WEATHER_LIST = [
  WEATHER_IDS.SUNNY,
  WEATHER_IDS.RAIN,
  WEATHER_IDS.SNOW,
  WEATHER_IDS.THUNDERSTORM,
  WEATHER_IDS.HEAVY_RAIN,
  WEATHER_IDS.HAIL,
  WEATHER_IDS.STORM,
];

const LIGHTNING_DURATION_MS = 120;
const LIGHTNING_INTERVAL_MS = 1800;

function pickRandomWeather(excludeCurrent) {
  const list = excludeCurrent
    ? WEATHER_LIST.filter((id) => id !== excludeCurrent)
    : WEATHER_LIST;
  return list[Math.floor(Math.random() * list.length)];
}

export function initWeather(state) {
  state.weather = state.weather || {};
  const w = state.weather;
  if (w.current == null) {
    w.current = WEATHER_IDS.SUNNY;
    w.lastWaveWhenChanged = 0;
    w.particles = [];
    w.lightningFlashUntil = 0;
    w.lastLightningAt = 0;
  }
}

export function updateWeather(state) {
  const w = state.weather;
  if (!w) return;
  const now = Date.now();
  const width = state.width || 800;
  const height = state.height || 600;
  const farY = height * 0.5;

  // 只在波次完成时换天气，不在波次中途换
  const wave = state.wave ?? 1;
  const waveState = state.waveState ?? 'fighting';
  if (waveState === 'completed' && (w.lastWaveWhenChanged == null || w.lastWaveWhenChanged !== wave)) {
    w.current = pickRandomWeather(w.current);
    w.lastWaveWhenChanged = wave;
    w.particles = [];
  }

  const isThunder = w.current === WEATHER_IDS.THUNDERSTORM || w.current === WEATHER_IDS.STORM;
  if (isThunder && now - w.lastLightningAt > LIGHTNING_INTERVAL_MS * (0.5 + Math.random())) {
    w.lightningFlashUntil = now + LIGHTNING_DURATION_MS;
    w.lastLightningAt = now;
  }

  const frame = state.frameCount || 0;
  const wind = w.current === WEATHER_IDS.STORM ? 4.5 : 0;

  if (w.current === WEATHER_IDS.RAIN || w.current === WEATHER_IDS.HEAVY_RAIN || w.current === WEATHER_IDS.THUNDERSTORM || w.current === WEATHER_IDS.STORM) {
    const count = w.current === WEATHER_IDS.HEAVY_RAIN || w.current === WEATHER_IDS.STORM ? 12 : 6;
    for (let i = 0; i < count; i++) {
      w.particles.push({
        type: 'rain',
        x: Math.random() * (width + 80) - 40,
        y: -10 - Math.random() * 30,
        len: 8 + Math.random() * 10,
        vy: 14 + Math.random() * 12,
        vx: (Math.random() - 0.5) * 2 + wind * (Math.random() - 0.5),
      });
    }
  }

  if (w.current === WEATHER_IDS.SNOW) {
    for (let i = 0; i < 3; i++) {
      w.particles.push({
        type: 'snow',
        x: Math.random() * (width + 60) - 30,
        y: -5 - Math.random() * 20,
        r: 1.5 + Math.random() * 1.5,
        vy: 0.8 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 1.2,
        sway: Math.random() * Math.PI * 2,
      });
    }
  }

  if (w.current === WEATHER_IDS.HAIL) {
    // 冰雹稀疏、下落较慢：每帧最多 1 颗，速度约 5～9
    if (Math.random() < 0.5) {
      w.particles.push({
        type: 'hail',
        x: Math.random() * (width + 40) - 20,
        y: -10 - Math.random() * 40,
        r: 2 + Math.random() * 2,
        vy: 5 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 1.5,
      });
    }
  }

  w.particles = w.particles.filter((p) => {
    p.x += p.vx || 0;
    p.y += p.vy;
    if (p.type === 'snow') {
      p.sway += 0.08;
      p.vx = (p.vx || 0) + Math.sin(p.sway) * 0.15;
    }
    return p.y < height + 30 && p.x > -30 && p.x < width + 30;
  });
}

export function drawWeather(ctx, state) {
  const w = state.weather;
  if (!w) return;
  const width = state.width || 800;
  const height = state.height || 600;
  const now = Date.now();

  if (w.lightningFlashUntil > now) {
    const alpha = 0.4 + 0.3 * (1 - (w.lightningFlashUntil - now) / LIGHTNING_DURATION_MS);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.save();
  const farY = height * 0.5;
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  for (const p of w.particles) {
    if (p.type === 'rain') {
      ctx.strokeStyle = `rgba(200,220,255,${0.25 + Math.random() * 0.2})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (p.vx || 0) * 0.8, p.y + p.len);
      ctx.stroke();
    } else if (p.type === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'hail') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function getSkyColors(weatherId) {
  switch (weatherId) {
    case WEATHER_IDS.SUNNY:
      return { top: '#4a6a8a', mid: '#6a8aaa', bottom: '#7a9aba' };
    case WEATHER_IDS.RAIN:
      return { top: '#5a6a7a', mid: '#6a7a8a', bottom: '#7a8a9a' };
    case WEATHER_IDS.SNOW:
      return { top: '#7a8a9a', mid: '#9aaaba', bottom: '#aabaca' };
    case WEATHER_IDS.THUNDERSTORM:
      return { top: '#3a4a5a', mid: '#4a5a6a', bottom: '#5a6a7a' };
    case WEATHER_IDS.HEAVY_RAIN:
      return { top: '#4a5a6a', mid: '#5a6a7a', bottom: '#6a7a8a' };
    case WEATHER_IDS.HAIL:
      return { top: '#5a6a7a', mid: '#6a7a8a', bottom: '#8a9aaa' };
    case WEATHER_IDS.STORM:
      return { top: '#2a3a4a', mid: '#3a4a5a', bottom: '#4a5a6a' };
    default:
      return { top: '#4a6a8a', mid: '#6a8aaa', bottom: '#7a9aba' };
  }
}

export function getWeatherName(weatherId) {
  const names = {
    [WEATHER_IDS.SUNNY]: '晴天',
    [WEATHER_IDS.RAIN]: '下雨天',
    [WEATHER_IDS.SNOW]: '下雪天',
    [WEATHER_IDS.THUNDERSTORM]: '大暴雷',
    [WEATHER_IDS.HEAVY_RAIN]: '暴雨天',
    [WEATHER_IDS.HAIL]: '冰雹天',
    [WEATHER_IDS.STORM]: '狂风暴雨',
  };
  return names[weatherId] || '晴天';
}
