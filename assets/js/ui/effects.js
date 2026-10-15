import { $, $$, h, clamp, reducedMotion } from '../core/util.js';
import { pick, onLang } from '../core/i18n.js';

/* ---------- Text scramble ---------- */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
const running = new Map();

export function scramble(element, finalText, { duration = 480, chars = GLYPHS } = {}) {
  cancelAnimationFrame(running.get(element));
  if (reducedMotion.matches) {
    element.textContent = finalText;
    return;
  }
  const start = performance.now();
  const length = Math.max(finalText.length, element.textContent.length);
  const tick = (now) => {
    const k = clamp((now - start) / duration, 0, 1);
    let out = '';
    for (let i = 0; i < length; i++) {
      const target = finalText[i] ?? '';
      if (target === ' ' || i < k * length) out += target;
      else out += chars[(Math.random() * chars.length) | 0];
    }
    element.textContent = out;
    if (k < 1) running.set(element, requestAnimationFrame(tick));
    else {
      element.textContent = finalText;
      running.delete(element);
    }
  };
  running.set(element, requestAnimationFrame(tick));
}

function cancelAllScrambles() {
  for (const id of running.values()) cancelAnimationFrame(id);
  running.clear();
}

export function initScramble() {
  for (const element of $$('[data-scramble]')) {
    const run = () => {
      if (running.has(element)) return;
      scramble(element, element.textContent, { duration: 420 });
    };
    element.addEventListener('pointerenter', run);
    element.addEventListener('focus', run);
  }
  onLang(cancelAllScrambles);
}

/* ---------- Hero letters ---------- */

export function splitHero() {
  for (const line of $$('[data-split]')) {
    const text = line.textContent.trim();
    line.textContent = '';
    [...text].forEach((char, i) => line.append(h('span', { class: 'ch', style: { '--i': i } }, char)));
    line.classList.add('is-split');
  }
}

/* ---------- Scroll reveal ---------- */

export function initReveal() {
  const targets = $$('[data-reveal], .footer-mark');
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      entering
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .forEach((el, i) => {
          el.style.setProperty('--rd', `${Math.min(i * 0.08, 0.4)}s`);
          el.classList.add('is-in');
          observer.unobserve(el);
        });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  targets.forEach((el) => observer.observe(el));
}

/* ---------- Manifesto: words light up as you read ---------- */

function splitWords(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) continue;
      fragment.append(/^\s+$/.test(part) ? part : h('span', { class: 'w' }, part));
    }
    node.replaceWith(fragment);
  }
  return $$('.w', element);
}

export function initWords() {
  for (const element of $$('[data-words]')) {
    let words = splitWords(element);
    let lit = -1;
    let queued = false;

    const update = () => {
      queued = false;
      if (reducedMotion.matches) {
        words.forEach((w) => w.classList.add('is-lit'));
        return;
      }
      const rect = element.getBoundingClientRect();
      const vh = innerHeight;
      const startLine = vh * 0.82;
      const endLine = vh * 0.42;
      const progress = clamp((startLine - rect.top) / (startLine - endLine + rect.height), 0, 1);
      const next = Math.round(progress * words.length);
      if (next === lit) return;
      words.forEach((word, i) => word.classList.toggle('is-lit', i < next));
      lit = next;
    };
    const queue = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };

    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    onLang(() => {
      words = splitWords(element);
      lit = -1;
      update();
    });
    update();
  }
}

/* ---------- Redacted bars ---------- */

const DENIED = [
  ['ACESSO NEGADO', 'ACCESS DENIED'],
  ['SIGILOSO', 'CLASSIFIED'],
  ['CONFIDENCIAL', 'CONFIDENTIAL'],
  ['SÓ NUMA CONVERSA', 'ASK ME IN PERSON'],
];

// Relative widths of the blacked-out "words" in each bar.
const WORD_PATTERNS = [[34, 22, 40], [52, 38], [18, 44, 26], [30, 30, 24, 12], [60, 28], [24, 52]];

export function initRedactions() {
  $$('[data-redact]').forEach((bar, index) => {
    let timer = 0;
    for (const grow of WORD_PATTERNS[index % WORD_PATTERNS.length]) bar.append(h('span', { class: 'r-word', style: { flexGrow: grow } }));
    const text = h('span', { class: 'r-text', 'aria-hidden': 'true' });
    bar.append(text);
    bar.addEventListener('pointerenter', () => {
      bar.classList.remove('is-scanning');
      void bar.offsetWidth;
      bar.classList.add('is-scanning');
      scramble(text, pick(DENIED[(index + Math.floor(Math.random() * 2)) % DENIED.length]), { duration: 520, chars: '█▓▒░#%&@$' });
      clearTimeout(timer);
      timer = setTimeout(() => {
        scramble(text, '', { duration: 380, chars: '█▓▒░' });
        bar.classList.remove('is-scanning');
      }, 1700);
    });
  });
}

/* ---------- Marquee ---------- */

export function initMarquee() {
  for (const track of $$('[data-marquee]')) {
    for (const child of [...track.children]) {
      const clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.dataset.clone = '';
      track.append(clone);
    }
  }
}
