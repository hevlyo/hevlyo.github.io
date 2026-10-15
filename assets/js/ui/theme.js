import { $$, reducedMotion } from '../core/util.js';
import { pick, onLang } from '../core/i18n.js';

const root = document.documentElement;
const listeners = new Set();

const LABELS = {
  toLight: ['Mudar para o tema claro', 'Switch to light theme'],
  toDark: ['Mudar para o tema escuro', 'Switch to dark theme'],
};
const THEME_COLOR = { dark: '#0b0a09', light: '#f1ebe0' };

export const theme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

export function onTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function syncChrome() {
  const label = pick(theme() === 'dark' ? LABELS.toLight : LABELS.toDark);
  for (const button of $$('[data-theme-toggle]')) button.setAttribute('aria-label', label);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme()]);
}

export function setTheme(next, origin) {
  if (next === theme()) return;

  const commit = () => {
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    syncChrome();
    for (const listener of listeners) listener(next);
  };

  if (!document.startViewTransition || reducedMotion.matches) {
    commit();
    return;
  }

  // A circle of the new theme grows out of the button that was pressed.
  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('no-transitions');
  const transition = document.startViewTransition(commit);
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 760, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove('no-transitions'));
}

export function toggleTheme(origin) {
  setTheme(theme() === 'dark' ? 'light' : 'dark', origin);
}

export function initTheme() {
  syncChrome();
  onLang(syncChrome);
  for (const button of $$('[data-theme-toggle]')) {
    button.addEventListener('click', () => {
      const rect = button.getBoundingClientRect();
      toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
  }
}
