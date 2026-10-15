import { initI18n } from './core/i18n.js';
import { $$, whenNear } from './core/util.js';
import { initTheme } from './ui/theme.js';
import { splitHero, initReveal, initWords, initScramble, initRedactions, initMarquee } from './ui/effects.js';
import { initTopbar, initLangToggle, initKbd, initClock, initMotionToggle, greet } from './ui/chrome.js';
import { initCursor } from './ui/cursor.js';
import { initPalette } from './ui/palette.js';
import { initSky } from './sky/sky.js';
import { initLatent } from './ui/latent.js';
import { initTelemetry } from './ui/telemetry.js';

const root = document.documentElement;

// Order matters: i18n captures the Portuguese copy before anything rewrites the DOM.
initI18n();
splitHero();
initMarquee();
root.classList.add('is-booted');

const steps = [
  initTheme,
  initLangToggle,
  initMotionToggle,
  initKbd,
  initTopbar,
  initScramble,
  initReveal,
  initWords,
  initRedactions,
  initClock,
  initCursor,
  initPalette,
  initSky,
  initLatent,
  initTelemetry,
];
for (const step of steps) {
  try {
    step();
  } catch (error) {
    console.error(`[boot] ${step.name} failed`, error);
  }
}

// The interactive demos are only fetched when you scroll near them.
const artifacts = {
  shellshield: () => import('./artifacts/shellshield.js'),
  ibx: () => import('./artifacts/ibx.js'),
};
for (const host of $$('[data-artifact]')) {
  whenNear(host, async () => {
    try {
      const module = await artifacts[host.dataset.artifact]();
      module.mount(host);
    } catch (error) {
      console.error(`[artifact] ${host.dataset.artifact} failed`, error);
    }
  }, '1600px 0px');
}

requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
greet();
