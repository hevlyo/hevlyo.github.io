import { $, $$, isMac } from '../core/util.js';
import { pick, onLang, toggleLang } from '../core/i18n.js';
import { formatClock } from '../sky/astro.js';
import { isStill, toggleStill, onMotion } from '../core/motion.js';

/* ---------- Top bar: blur when scrolled, hide on the way down, track the section ---------- */

export function initTopbar() {
  const bar = $('[data-topbar]');
  if (!bar) return;
  let lastY = scrollY;
  let queued = false;

  const update = () => {
    queued = false;
    const y = scrollY;
    bar.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > innerHeight * 0.6 && !bar.contains(document.activeElement)) bar.classList.add('is-hidden');
    else if (goingUp || y < innerHeight * 0.6) bar.classList.remove('is-hidden');
    if (Math.abs(y - lastY) > 4) lastY = y;
  };
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));
  update();

  const links = $$('.nav a', bar);
  // The hero is watched too, so scrolling back to the top clears the highlight.
  const sections = [$('#top'), ...links.map((link) => $(link.getAttribute('href')))].filter(Boolean);
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = `#${entry.target.id}`;
        links.forEach((link) => {
          const active = link.getAttribute('href') === id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((section) => observer.observe(section));
}

/* ---------- Language toggle ---------- */

// Starts with the visible text so voice-control users can say what they see.
const LANG_LABEL = ['PT / EN: mudar o idioma para inglês', 'PT / EN: switch language to Portuguese'];

export function initLangToggle() {
  const buttons = $$('[data-lang-toggle]');
  const sync = () => buttons.forEach((button) => button.setAttribute('aria-label', pick(LANG_LABEL)));
  buttons.forEach((button) => button.addEventListener('click', toggleLang));
  onLang(sync);
  sync();
}

/* ---------- Pause / resume ambient motion ---------- */

const MOTION_LABEL = { pause: ['Pausar animações', 'Pause animations'], resume: ['Retomar animações', 'Resume animations'] };

export function initMotionToggle() {
  const buttons = $$('[data-motion-toggle]');
  const sync = () => {
    const still = isStill();
    for (const button of buttons) {
      $('[data-motion-label]', button).textContent = pick(still ? MOTION_LABEL.resume : MOTION_LABEL.pause);
      $('use', button)?.setAttribute('href', still ? '#i-play' : '#i-pause');
    }
  };
  buttons.forEach((button) => button.addEventListener('click', toggleStill));
  onMotion(sync);
  onLang(sync);
  sync();
}

/* ---------- Keyboard hints: ⌘K on Apple, Ctrl K elsewhere ---------- */

export function initKbd() {
  const sync = () => $$('[data-kbd]').forEach((kbd) => (kbd.textContent = isMac ? '⌘K' : 'Ctrl K'));
  sync();
  onLang(sync);
}

/* ---------- Footer clock & year ---------- */

export function initClock() {
  const clocks = $$('[data-clock]');
  const tick = () => clocks.forEach((el) => (el.textContent = formatClock(Date.now())));
  tick();
  setInterval(tick, 15000);
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ---------- A note for whoever opens the console ---------- */

export function greet() {
  const sun = [
    '         .  :  .',
    '      .  .:::::.  .',
    '    -  :::::::::::  -',
    ' ~~~~~~~~~~~~~~~~~~~~~~~',
    '   ~  ~  ~ ::: ~  ~  ~',
  ].join('\n');
  console.log(`%c${sun}`, 'color:#ff5a1f;font-family:monospace;line-height:1.2');
  console.log(
    `%c${pick(['Olá, dev curioso. Este site é feito à mão, sem framework.', 'Hi, curious dev. This site is handmade, no framework.'])}\n%chttps://github.com/hevlyo/hevlyo.github.io`,
    'font:500 13px/1.6 system-ui',
    'font:500 12px/1.6 monospace;color:#ff6a33',
  );
}
