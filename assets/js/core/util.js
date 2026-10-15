export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
export const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);

/** Runs `callback` once, the first time `element` gets close to the viewport. */
export function whenNear(element, callback, rootMargin = '300px 0px') {
  if (!('IntersectionObserver' in window)) {
    callback();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      callback();
    }
  }, { rootMargin });
  observer.observe(element);
}

/** Calls `callback(isVisible)` whenever `element` enters or leaves the viewport. */
export function watchVisibility(element, callback, rootMargin = '0px') {
  if (!('IntersectionObserver' in window)) {
    callback(true);
    return () => {};
  }
  const observer = new IntersectionObserver((entries) => {
    callback(entries[entries.length - 1].isIntersecting);
  }, { rootMargin });
  observer.observe(element);
  return () => observer.disconnect();
}

/** Tiny element builder: h('p', { class: 'x', onclick }, 'text', child). */
export function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (key === 'class') element.className = value;
    else if (key === 'html') element.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/** Lowercase, strip accents — used by every search/match in the site. */
export function normalize(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let toastTimer = 0;
export function toast(message) {
  const element = $('[data-toast]');
  if (!element) return;
  element.textContent = message;
  element.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('is-on'), 2200);
}

export function cssVar(name, element = document.documentElement) {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/** Parses #rgb / #rrggbb into [r, g, b] in 0..1. */
export function hexToRgb(hex) {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  const number = parseInt(value, 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}
