import * as A from './astro.js';
import { createSkyRenderer } from './renderer.js';
import { $, $$, clamp, smoothstep, lerp, reducedMotion, finePointer, hexToRgb, watchVisibility } from '../core/util.js';
import { pick, onLang, lang } from '../core/i18n.js';
import { theme, onTheme } from '../ui/theme.js';

const DAY_MS = 86400000;
const TIMELAPSE_SECONDS = 18;

const PALETTES = {
  dark: { bg: '#0b0a09', ink: '#ede6da', sunCore: '#ffd27f', sunEdge: '#ff5a1f', glow: '#ff7a3d', sea: '#86a2ad', moon: '#f3ecdf' },
  light: { bg: '#f1ebe0', ink: '#2a251e', sunCore: '#f08a2c', sunEdge: '#c2410c', glow: '#d9541a', sea: '#3f6877', moon: '#2a251e' },
};
const GOLDEN = {
  dark: { sunCore: '#ff9a4a', sunEdge: '#ff3b1f' },
  light: { sunCore: '#e8601a', sunEdge: '#a8300c' },
};

const PHASES = [
  ['Lua nova', 'New moon'],
  ['Crescente', 'Waxing crescent'],
  ['Quarto crescente', 'First quarter'],
  ['Crescente gibosa', 'Waxing gibbous'],
  ['Lua cheia', 'Full moon'],
  ['Minguante gibosa', 'Waning gibbous'],
  ['Quarto minguante', 'Last quarter'],
  ['Minguante', 'Waning crescent'],
];
const COMPASS = {
  pt: ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
};
const TEXT = {
  live: ['Ao vivo', 'Live'],
  sim: ['Simulado', 'Simulated'],
  sun: ['Sol agora', 'Sun now'],
  moon: ['Lua agora', 'Moon now'],
  play: ['Timelapse', 'Timelapse'],
  pause: ['Pausar', 'Pause'],
};

/** Read by the telemetry panel. */
export const skyStats = { fps: 0, glyphs: 0, frames: 0, webgl: false };
/** Filled in by initSky; used by the command palette. */
export const skyControl = {};

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const deg = (radians) => A.toDegrees(radians);

export function initSky() {
  const host = $('[data-sky]');
  const panel = $('[data-skypanel]');
  if (!host || !panel) return;

  const hero = host.closest('.hero') || host;
  const canvas = $('canvas', host);
  const fields = Object.fromEntries($$('[data-sky]', panel).map((el) => [el.dataset.sky, el]));
  const status = $('[data-sky-status]', panel);
  const range = $('[data-sky-range]', panel);
  const track = $('[data-sky-track]', panel);
  const playButton = $('[data-sky-action="play"]', panel);
  const nowButton = $('[data-sky-action="now"]', panel);

  let renderer = null;
  try {
    renderer = createSkyRenderer(canvas);
  } catch (error) {
    console.warn('[sky] WebGL unavailable, using the CSS fallback.', error);
  }
  if (!renderer) host.classList.add('is-fallback');
  skyStats.webgl = Boolean(renderer);

  const clock = { mode: 'live', sim: Date.now(), tween: null, playing: false };
  let day = null;
  let astro = null;
  let layout = { horizon: -0.2, baseX: 0.45, r: 0.16, alt: 0.44, drift: 0.07 };
  let palette = null;
  const mouse = { x: 0, y: 0, strength: 0, target: 0 };
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let lastAstro = 0;
  let reveal = reducedMotion.matches ? 1 : 0;
  let ready = false;
  let scrubbing = false;

  const displayed = () => (clock.mode === 'live' ? Date.now() : clock.sim);

  /* ---------- Astronomy ---------- */

  function computeDay(ms) {
    const start = A.natalDayStart(ms);
    if (day && day.start === start) return;
    day = { start, sun: A.sunTimes(start) };
    paintTrack();
  }

  function computeAstro(ms) {
    computeDay(ms);
    const sun = A.sunPosition(ms);
    const moon = A.moonPosition(ms);
    astro = {
      ms,
      sunAlt: deg(sun.altitude),
      sunBearing: A.bearing(sun.azimuth),
      moonAlt: deg(moon.altitude),
      moonBearing: A.bearing(moon.azimuth),
      illumination: A.moonIllumination(ms),
      moonLight: A.moonLightVector(ms),
    };
  }

  /* ---------- Rendering ---------- */

  function buildPalette() {
    const source = PALETTES[theme()];
    palette = Object.fromEntries(Object.entries(source).map(([key, hex]) => [key, hexToRgb(hex)]));
    palette.golden = Object.fromEntries(Object.entries(GOLDEN[theme()]).map(([key, hex]) => [key, hexToRgb(hex)]));
  }

  function computeLayout(width, height) {
    const aspect = width / height;
    if (aspect > 1.05) {
      // Wide hero: the sky sits to the right of the name, sunsets clear the sky panel.
      layout = { horizon: -0.12, baseX: aspect * 0.5 * 0.55, r: 0.16, alt: 0.4, drift: 0.07 };
    } else if (aspect > 0.7) {
      // Phone "window" above the text: the sky gets the whole frame.
      layout = { horizon: -0.24, baseX: aspect * 0.5 * 0.18, r: 0.15, alt: 0.5, drift: 0.05 };
    } else {
      layout = { horizon: 0.04, baseX: aspect * 0.5 * 0.22, r: Math.min(0.12, aspect * 0.27), alt: 0.32, drift: 0.035 };
    }
  }

  function uniforms(time) {
    const a = astro;
    const s = a.sunAlt;
    const golden = s > -3 && s < 14 ? 1 - smoothstep(0, 14, s) : 0;
    const drift = (bearing) => clamp((bearing - 180) / 90, -1.2, 1.2) * layout.drift;

    const sunR = layout.r * (1 + 0.1 * golden);
    const sun = [layout.baseX + drift(a.sunBearing), layout.horizon + Math.sin((s * Math.PI) / 180) * layout.alt, sunR, smoothstep(-7, 0.5, s)];
    const moonVisible = (1 - smoothstep(-8, -2, s)) * smoothstep(-3, 2, a.moonAlt);
    const moon = [
      layout.baseX + drift(a.moonBearing),
      layout.horizon + Math.sin((a.moonAlt * Math.PI) / 180) * layout.alt,
      layout.r * 0.82,
      moonVisible,
    ];
    const sky = [smoothstep(-4, 8, s), Math.exp(-(((s + 3) / 7) ** 2)), 1 - smoothstep(-16, -6, s), golden];

    return {
      time,
      horizon: layout.horizon,
      sun,
      moon,
      moonLight: a.moonLight,
      sky,
      mouse: [mouse.x, mouse.y, mouse.strength],
      reveal,
      palette: {
        ...palette,
        sunCore: mix3(palette.sunCore, palette.golden.sunCore, golden * 0.8),
        sunEdge: mix3(palette.sunEdge, palette.golden.sunEdge, golden * 0.7),
      },
    };
  }

  function draw(time) {
    if (!renderer || !astro) return;
    renderer.render(uniforms(time));
    if (!ready) {
      ready = true;
      host.classList.add('is-ready');
    }
  }

  function resize() {
    if (!renderer) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    computeLayout(rect.width, rect.height);
    skyStats.glyphs = renderer.size.cols * renderer.size.rows;
    draw(performance.now() / 1000);
  }

  /* ---------- Loop ---------- */

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (clock.tween) {
      const k = clamp((now - clock.tween.start) / clock.tween.duration, 0, 1);
      const eased = 1 - (1 - k) ** 4;
      clock.sim = lerp(clock.tween.from, clock.tween.to, eased);
      if (k >= 1) {
        const goLive = clock.tween.live;
        clock.tween = null;
        if (goLive) clock.mode = 'live';
      }
    } else if (clock.playing) {
      clock.sim += (dt * DAY_MS) / TIMELAPSE_SECONDS;
      const start = A.natalDayStart(Date.now());
      if (clock.sim >= start + DAY_MS) clock.sim -= DAY_MS;
    }

    if (clock.mode !== 'live' || now - lastAstro > 1000) {
      computeAstro(displayed());
      updatePanel();
      lastAstro = now;
    }

    mouse.strength = lerp(mouse.strength, mouse.target, 0.06);
    if (reveal < 1) reveal = Math.min(1, reveal + dt / 2.6);

    draw(now / 1000);

    if (dt > 0) {
      skyStats.fps = skyStats.fps ? lerp(skyStats.fps, 1 / dt, 0.05) : 1 / dt;
      skyStats.frames += 1;
    }
    schedule();
  }

  function schedule() {
    if (raf || !renderer || !visible || document.hidden) return;
    if (reducedMotion.matches && !clock.tween && !clock.playing) return;
    raf = requestAnimationFrame(frame);
  }

  /** Re-renders once; used when animation is paused or motion is reduced. */
  function refresh() {
    computeAstro(displayed());
    updatePanel();
    if (reducedMotion.matches) draw(0);
    schedule();
  }

  /* ---------- Panel ---------- */

  function compass(bearing) {
    const list = COMPASS[lang()];
    return list[Math.round(bearing / 22.5) % 16];
  }

  function paintTrack() {
    if (!track || !day?.sun.rise || !day?.sun.set) return;
    const rise = ((day.sun.rise - day.start) / DAY_MS) * 100;
    const set = ((day.sun.set - day.start) / DAY_MS) * 100;
    const n = 'var(--sky-night)';
    const dusk = 'var(--sol)';
    const noon = 'var(--sol-2)';
    track.style.background = `linear-gradient(90deg, ${n} 0%, ${n} ${rise - 4}%, ${dusk} ${rise}%, ${noon} ${rise + 7}%, ${noon} ${set - 7}%, ${dusk} ${set}%, ${n} ${set + 4}%, ${n} 100%)`;
  }

  function updatePanel() {
    if (!astro) return;
    const a = astro;
    const one = new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const live = clock.mode === 'live' && !clock.tween;

    status.dataset.skyStatus = live ? 'live' : 'sim';
    fields.status.textContent = pick(live ? TEXT.live : TEXT.sim);
    fields.time.textContent = A.formatClock(a.ms, live);

    // By day the panel follows the sun; after dusk it follows the moon, even below the horizon.
    const sunIsSubject = a.sunAlt > -6;
    const body = sunIsSubject
      ? { label: TEXT.sun, alt: a.sunAlt, bearing: a.sunBearing }
      : { label: TEXT.moon, alt: a.moonAlt, bearing: a.moonBearing };
    fields.bodyLabel.textContent = pick(body.label);
    fields.body.textContent = `${body.alt >= 0 ? '↑' : '↓'} ${one.format(Math.abs(body.alt))}° · ${compass(body.bearing)}`;
    fields.sunTimes.textContent = day.sun.rise && day.sun.set ? `${A.formatClock(day.sun.rise)} → ${A.formatClock(day.sun.set)}` : '—';
    fields.moon.textContent = `${pick(PHASES[A.phaseIndex(a.illumination.phase)])} · ${Math.round(a.illumination.fraction * 100)}%`;

    if (!scrubbing) range.value = String(clamp(Math.round(A.natalMinutes(a.ms)), 0, 1439));
    range.setAttribute('aria-valuetext', A.formatClock(a.ms));
  }

  function setPlaying(playing) {
    clock.playing = playing;
    if (playing) {
      if (clock.mode === 'live') clock.sim = Date.now();
      clock.mode = 'sim';
      clock.tween = null;
    }
    playButton.setAttribute('aria-pressed', String(playing));
    $('use', playButton)?.setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('span', playButton).textContent = pick(playing ? TEXT.pause : TEXT.play);
    schedule();
    refresh();
  }

  /** Smoothly moves the displayed time to `target` (ms). */
  function travel(target, { live = false, duration = 1100 } = {}) {
    setPlaying(false);
    const from = displayed();
    clock.mode = 'sim';
    clock.sim = from;
    if (reducedMotion.matches) {
      clock.sim = target;
      if (live) clock.mode = 'live';
      refresh();
      return;
    }
    clock.tween = { from, to: target, start: performance.now(), duration, live };
    schedule();
  }

  range.addEventListener('input', () => {
    // Read the slider before anything can repaint the panel (and reset it).
    const minutes = Number(range.value);
    if (clock.playing) setPlaying(false);
    clock.tween = null;
    clock.mode = 'sim';
    clock.sim = A.natalDayStart(Date.now()) + minutes * 60000;
    refresh();
  });
  range.addEventListener('pointerdown', () => (scrubbing = true));
  window.addEventListener('pointerup', () => (scrubbing = false));
  range.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = (event.shiftKey ? 60 : 15) * (event.key === 'ArrowLeft' ? -1 : 1);
    range.value = String(clamp(Number(range.value) + step, 0, 1439));
    range.dispatchEvent(new Event('input'));
  });
  nowButton.addEventListener('click', () => travel(Date.now(), { live: true, duration: 900 }));
  playButton.addEventListener('click', () => setPlaying(!clock.playing));

  /* ---------- Pointer lens ---------- */

  if (finePointer.matches && !reducedMotion.matches) {
    hero.addEventListener('pointermove', (event) => {
      const rect = host.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left - rect.width / 2) / rect.height;
      mouse.y = (rect.height / 2 - (event.clientY - rect.top)) / rect.height;
      const overUi = event.target.closest('.skypanel, .btn, .topbar');
      mouse.target = overUi ? 0 : 1;
    });
    hero.addEventListener('pointerleave', () => (mouse.target = 0));
  }

  /* ---------- Lifecycle ---------- */

  watchVisibility(hero, (isVisible) => {
    visible = isVisible;
    schedule();
  });
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    schedule();
  });
  reducedMotion.addEventListener?.('change', () => {
    reveal = 1;
    refresh();
  });
  // Without the animation loop, the live clock and sky still need to tick.
  setInterval(() => {
    if (reducedMotion.matches && clock.mode === 'live' && visible && !document.hidden) refresh();
  }, 1000);
  onTheme(() => {
    buildPalette();
    draw(performance.now() / 1000);
  });
  onLang(() => {
    updatePanel();
    $('span', playButton).textContent = pick(clock.playing ? TEXT.pause : TEXT.play);
  });

  if (renderer) {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      renderer = null;
      host.classList.remove('is-ready');
      host.classList.add('is-fallback');
    });
    new ResizeObserver(() => resize()).observe(host);
  }

  /* ---------- Palette hooks ---------- */

  Object.assign(skyControl, {
    now: () => travel(Date.now(), { live: true, duration: 900 }),
    sunrise: () => day?.sun.rise && travel(day.sun.rise + 12 * 60000),
    sunset: () => day?.sun.set && travel(day.sun.set - 8 * 60000),
    night: () => {
      // Find tonight's best moment for the moon: highest while the sun is well down.
      const start = A.natalDayStart(Date.now());
      let best = start + 22 * 3600000;
      let bestAlt = -90;
      for (let m = 18 * 60; m <= 30 * 60; m += 10) {
        const ms = start + m * 60000;
        if (deg(A.sunPosition(ms).altitude) > -14) continue;
        const alt = deg(A.moonPosition(ms).altitude);
        if (alt > bestAlt) {
          bestAlt = alt;
          best = ms;
        }
      }
      travel(best);
    },
    play: () => setPlaying(true),
  });

  /* ---------- Boot ---------- */

  buildPalette();
  computeAstro(Date.now());
  updatePanel();

  const fontReady = document.fonts?.load('500 16px "Geist Mono"') ?? Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 1200))])
    .catch(() => {})
    .then(() => {
      if (!renderer) return;
      resize();
      last = performance.now();
      if (reducedMotion.matches) draw(0);
      schedule();
    });
}
