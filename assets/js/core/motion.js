import { reducedMotion } from './util.js';

// Visitors can pause every ambient animation (WCAG 2.2.2), on top of the
// prefers-reduced-motion setting. The choice is remembered.

const root = document.documentElement;
const listeners = new Set();

export const isStill = () => root.classList.contains('is-still');

/** True when nothing should move on its own: the OS setting or the visitor's toggle. */
export const calm = () => reducedMotion.matches || isStill();

export function onMotion(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStill(still) {
  root.classList.toggle('is-still', still);
  try {
    if (still) localStorage.setItem('motion', 'still');
    else localStorage.removeItem('motion');
  } catch {}
  for (const listener of listeners) listener(still);
}

export const toggleStill = () => setStill(!isStill());

reducedMotion.addEventListener?.('change', () => {
  for (const listener of listeners) listener(isStill());
});
