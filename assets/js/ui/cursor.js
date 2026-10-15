import { $, $$, finePointer, reducedMotion, clamp } from '../core/util.js';

const INTERACTIVE = 'a, button, [role="button"], [data-cursor], input[type="range"], .latent-node, .r-bar, .term-chip, .ibx-tab';
const TEXTUAL = 'input:not([type="range"]), textarea, [contenteditable]';

/** A soft halo that trails the (still visible) native cursor and swells over interactive things. */
export function initCursor() {
  if (!finePointer.matches) return;
  const cursor = $('.cursor');
  if (!cursor) return;
  const label = $('.cursor-label', cursor);

  let x = -100;
  let y = -100;
  let targetX = x;
  let targetY = y;
  let raf = 0;

  const loop = () => {
    raf = 0;
    const k = reducedMotion.matches ? 1 : 0.24;
    x += (targetX - x) * k;
    y += (targetY - y) * k;
    cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2) raf = requestAnimationFrame(loop);
  };

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!cursor.classList.contains('is-active')) {
        x = targetX;
        y = targetY;
        cursor.classList.add('is-active');
      }
      const target = event.target instanceof Element ? event.target : null;
      const interactive = target?.closest(INTERACTIVE);
      const textual = target?.closest(TEXTUAL);
      cursor.classList.toggle('is-hover', Boolean(interactive) && !textual);
      cursor.classList.toggle('is-text', Boolean(textual));
      const text = interactive?.dataset.cursor || '';
      cursor.classList.toggle('has-label', Boolean(text));
      if (text && label.textContent !== text) label.textContent = text;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-active'));
  addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  addEventListener('pointerup', () => cursor.classList.remove('is-down'));

  initMagnetic();
}

/** Buttons lean a few pixels toward the pointer. */
function initMagnetic() {
  if (reducedMotion.matches) return;
  for (const element of $$('[data-magnetic]')) {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const dx = clamp((event.clientX - (rect.left + rect.width / 2)) / rect.width, -0.5, 0.5);
      const dy = clamp((event.clientY - (rect.top + rect.height / 2)) / rect.height, -0.5, 0.5);
      element.style.transform = `translate(${(dx * 12).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`;
    });
    element.addEventListener('pointerleave', () => (element.style.transform = ''));
  }
}
