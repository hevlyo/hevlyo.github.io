// Portuguese lives in the HTML (it is what crawlers and no-JS visitors read);
// English lives here, keyed by the same data-i18n keys. Modules that render
// their own text keep [pt, en] pairs next to the code and call pick().

const EN = {
  'ui.skip': 'Skip to content',
  'ui.home': 'Riquelme Soares, home',
  'ui.paletteOpen': 'Open the command palette',
  'nav.label': 'Sections',
  'nav.about': 'About',
  'nav.work': 'Work',
  'nav.oss': 'Open source',
  'nav.stack': 'Stack',
  'nav.contact': 'Contact',

  'hero.eyebrow': 'Full-Stack &amp; AI Engineer · Natal, Brazil',
  'hero.lede': 'I turn manual processes into <em>systems that run on their own</em>, from APIs and event-driven architectures to integrations with LLMs and AI agents.',
  'hero.cta1': 'See the work',
  'hero.cta2': 'Search the site',
  'hero.scroll': 'Scroll',

  'sky.label': 'The sky over Natal right now',
  'sky.title': 'Sky over Natal',
  'sky.time': 'Local time',
  'sky.sun': 'Sunrise · sunset',
  'sky.moon': 'Moon phase',
  'sky.range': 'Time of day in Natal',
  'sky.now': 'Now',
  'sky.play': 'Timelapse',

  'about.label': 'About',
  'about.manifesto': 'I’m a full-stack and AI engineer in Natal, Brazil. I automate processes that still depend on people copying, pasting and double-checking, using APIs, event queues, machine learning models and <em>AI agents in production</em>.',
  'about.f1k': 'Now',
  'about.f1v': 'PGM Natal &amp; AMentoria Educação',
  'about.f2k': 'Focus',
  'about.f2v': 'LLMs, AI agents, RAG and workflow automation',
  'about.f3k': 'Education',
  'about.f3v': 'Science &amp; Technology, UFRN',
  'about.f4k': 'Open to',
  'about.f4v': 'Freelance and remote roles in AI, backend and automation',

  'work.label': 'Work',
  'work.title': 'My main work <em>isn’t on GitHub.</em>',
  'work.lead': 'It runs inside institutions and handles sensitive data, so the code is private for security reasons. Below is what I can show. The details are for a conversation.',
  'work.file1': 'File nº 01',
  'work.file2': 'File nº 02',
  'work.d1.sector': 'Public sector',
  'work.d1.full': 'Natal’s Municipal Attorney General’s Office',
  'work.d1.desc': 'I build solutions with FastAPI, PostgreSQL and machine learning for the city’s Attorney General’s Office.',
  'work.d2.sector': 'Education',
  'work.d2.full': 'AMentoria Educação',
  'work.d2.desc': 'I build microservices with NestJS, GraphQL and Apache Kafka in an event-driven architecture.',
  'work.now': 'Current',
  'work.redacted': 'Classified details',
  'work.k.scope': 'scope',
  'work.k.data': 'data',
  'work.k.arch': 'architecture',
  'work.k.impact': 'impact',
  'work.k.services': 'services',
  'work.k.topics': 'topics',
  'work.stamp1': 'Classified',
  'work.stamp2': 'Confidential',
  'work.note': 'In a conversation, I can walk through architecture, decisions and results without breaking confidentiality.',
  'work.cta': 'Let’s talk',

  'oss.title': 'Tools for working with <em>AI agents.</em>',
  'oss.lead': 'Two open-source tools for people who put AI agents to work in the terminal. The demos below run in your browser.',
  'oss.fallback': 'Enable JavaScript to try the interactive demo.',
  'oss.p1.kicker': 'Security · CLI · TypeScript + Bun',
  'oss.p1.desc': 'A shell hook that parses every command with a shell parser and blocks <code>rm -rf /</code>, <code>curl | bash</code> traps and homograph attacks before they run. Built for terminals where AI agents run commands.',
  'oss.p1.s1v': '~23.5 µs',
  'oss.p1.s1k': 'per command',
  'oss.p1.s2v': '42,573',
  'oss.p1.s2k': 'ops/s benchmark',
  'oss.p1.s3k': 'automated tests',
  'oss.p1.caption': 'A subset of the real rules, with the same messages as the CLI. Go ahead and try <code>rm -rf /</code>: nothing runs here.',
  'oss.p2.kicker': 'AI agents · Bash · Sandboxes',
  'oss.p2.desc': 'An agent skill with a single bash script for using disposable instabox.sh sandboxes. It keeps two agents from grabbing the same sandbox, handles idle pauses, never retries an exec that may have run and refuses to copy credentials. Works with Claude Code, Codex and OpenCode.',
  'oss.p2.s1v': '1 script',
  'oss.p2.s1k': 'bash + curl + jq',
  'oss.p2.s2k': 'daemons or SDKs',
  'oss.p2.s3k': 'actionable exit codes',
  'oss.p2.caption': 'A simulation of the problems ibx solves. Pick a scenario.',
  'oss.more': 'Smaller studies and experiments live on',

  'stack.title': 'Tools grouped <em>by what they solve.</em>',
  'stack.lead': 'Each group gathers tools that tend to show up together, like a map of embeddings. Hover or use Tab to see the connections.',
  'stack.g.ai': 'AI &amp; Data',
  'stack.g.infra': 'Messaging &amp; Infra',
  'stack.g.data': 'Databases',
  'stack.i.agents': 'AI agents',
  'stack.principles': 'Engineering principles',
  'stack.m1': 'API design',
  'stack.m2': 'Event-driven architecture',
  'stack.m3': 'AI in production',
  'stack.m4': 'Performance',
  'stack.m5': 'Observability',

  'site.label': 'This site',
  'site.title': 'How this site <em>was built.</em>',
  'site.lead': 'Hand-written HTML, CSS and JavaScript, with no template, framework or build step. The numbers in this section are measured right now, in your browser.',
  'site.source': 'Read the source code',
  'site.live': 'measured now',
  'site.t.weight': 'Transferred',
  'site.t.requests': 'Requests',
  'site.t.ready': 'Ready in',
  'site.t.fps': 'WebGL sky',
  'site.t.glyphs': 'Glyphs per frame',
  'site.t.dom': 'DOM elements',
  'site.t.deps': 'Dependencies',
  'site.t.trackers': 'Trackers',
  'site.f1.t': 'Real-time sky',
  'site.f1.d': 'The sun and moon at the top of the page follow their real position over Natal. Altitude, rise, set, phase and the moon’s tilt are computed in your browser.',
  'site.f2.t': 'ASCII in WebGL',
  'site.f2.d': 'The scene is drawn into a grid of cells and each cell becomes a character, picked by the ink density measured when the page loads. It takes two shader passes.',
  'site.f3.t': 'BM25 search',
  'site.f3.d': 'The <kbd data-kbd>⌘K</kbd> palette searches this site with BM25, the same retrieval step used in RAG. It runs without a server and nothing leaves your browser.',
  'site.f4.t': 'Accessibility',
  'site.f4.d': 'Semantic HTML, full keyboard navigation, AA contrast and support for reduced motion.',
  'site.f5.t': 'Language and theme',
  'site.f5.d': 'Portuguese or English, light or dark theme. Everything switches without reloading the page.',
  'site.f6.t': 'No trackers',
  'site.f6.d': 'No analytics, cookies or third-party requests. The fonts are served from here too.',

  'contact.label': 'Contact',
  'contact.title': 'Have a process that should <em>run on its own?</em>',
  'contact.lead': 'I’m open to freelance projects and remote roles in AI, backend and automation. LinkedIn is the best way to reach me.',

  'footer.made': 'Made in Natal, Brazil.',
  'footer.local': 'Time in Natal',
  'footer.top': 'Back to top',

  'palette.label': 'Command palette',
  'palette.placeholder': 'Search the site…',
  'palette.inputLabel': 'Search the site or type a command',
  'palette.close': 'Close',
  'palette.nav': 'navigate',
  'palette.open': 'open',
  'palette.note': 'Local BM25 search. Nothing leaves your browser.',
};

const META = {
  title: ['Riquelme Soares · Full-Stack & AI Engineer · Natal, RN', 'Riquelme Soares · Full-Stack & AI Engineer · Natal, Brazil'],
  description: [
    'Riquelme Soares, engenheiro full-stack e de IA em Natal, RN. Trabalha com LLMs, agentes de IA, RAG, NestJS, Kafka, FastAPI e Python.',
    'Riquelme Soares, full-stack and AI engineer in Natal, Brazil. Works with LLMs, AI agents, RAG, NestJS, Kafka, FastAPI and Python.',
  ],
};

const root = document.documentElement;
let current = root.dataset.lang === 'en' ? 'en' : 'pt';
const listeners = new Set();
const ptText = new Map();
const ptAttrs = new WeakMap();

export const lang = () => current;

/** Picks the current-language entry of a [pt, en] pair or {pt, en} object. */
export function pick(pair) {
  if (Array.isArray(pair)) return current === 'en' ? pair[1] : pair[0];
  if (pair && typeof pair === 'object') return pair[current] ?? pair.pt;
  return pair;
}

/** Text for a DOM key in the current language. */
export function t(key) {
  return current === 'en' ? EN[key] ?? ptText.get(key) ?? key : ptText.get(key) ?? key;
}

export function onLang(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function capture() {
  for (const element of document.querySelectorAll('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (!ptText.has(key)) ptText.set(key, element.innerHTML.trim());
  }
  for (const element of document.querySelectorAll('[data-i18n-attr]')) {
    const saved = {};
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attr] = pair.split(':');
      saved[attr] = element.getAttribute(attr);
    }
    ptAttrs.set(element, saved);
  }
}

function apply() {
  root.dataset.lang = current;
  root.lang = current === 'en' ? 'en' : 'pt-BR';

  for (const element of document.querySelectorAll('[data-i18n]')) {
    const html = t(element.dataset.i18n);
    if (element.innerHTML !== html) element.innerHTML = html;
  }
  for (const element of document.querySelectorAll('[data-i18n-attr]')) {
    const saved = ptAttrs.get(element) || {};
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      const value = current === 'en' ? EN[key] ?? saved[attr] : saved[attr];
      if (value != null) element.setAttribute(attr, value);
    }
  }

  document.title = pick(META.title);
  document.querySelector('meta[name="description"]')?.setAttribute('content', pick(META.description));
  for (const listener of listeners) listener(current);
}

export function initI18n() {
  capture();
  if (current === 'en') apply();
}

export function setLang(next) {
  if (next !== 'pt' && next !== 'en') return;
  current = next;
  try {
    localStorage.setItem('lang', next);
  } catch {}
  apply();
}

export const toggleLang = () => setLang(current === 'en' ? 'pt' : 'en');
