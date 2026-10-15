import { $, $$, h, clamp, finePointer, watchVisibility } from '../core/util.js';
import { calm, onMotion } from '../core/motion.js';
import { pick, onLang } from '../core/i18n.js';

// Where each group sits in the map (fractions of width/height).
const CLUSTERS = {
  ai: { x: 0.22, y: 0.4 },
  backend: { x: 0.55, y: 0.3 },
  infra: { x: 0.83, y: 0.5 },
  data: { x: 0.46, y: 0.76 },
  front: { x: 0.76, y: 0.83 },
};

// Conceptual neighbours: tools that tend to show up in the same systems.
const EDGES = [
  ['python', 'fastapi'], ['python', 'ml'], ['ml', 'transformers'], ['python', 'transformers'], ['llms', 'python'],
  ['llms', 'agents'], ['agents', 'tools'], ['llms', 'rag'], ['rag', 'embeddings'], ['embeddings', 'pgvector'],
  ['pgvector', 'postgres'], ['tools', 'rest'],
  ['node', 'nest'], ['node', 'express'], ['nest', 'graphql'], ['nest', 'kafka'], ['nest', 'prisma'], ['ts', 'nest'],
  ['ts', 'node'], ['fastapi', 'rest'], ['express', 'rest'], ['spring', 'rest'], ['spring', 'oracle'],
  ['kafka', 'redis'], ['node', 'socketio'], ['docker', 'linux'], ['linux', 'nginx'], ['docker', 'cicd'],
  ['nginx', 'cloudflare'], ['bun', 'ts'], ['bun', 'node'],
  ['prisma', 'postgres'], ['fastapi', 'postgres'], ['postgres', 'sqlserver'], ['oracle', 'sqlserver'],
  ['react', 'ts'], ['react', 'next'], ['react', 'vite'], ['next', 'tailwind'], ['three', 'webgl'], ['vite', 'three'],
  ['socketio', 'react'],
];

const NOTES = {
  python: ['FastAPI, Machine Learning e automação.', 'FastAPI, machine learning and automation.'],
  llms: ['OpenAI, Claude e modelos open-source em sistemas reais.', 'OpenAI, Claude and open-source models in real systems.'],
  agents: ['Agentes com tool calling. O ibx é uma ferramenta feita para eles.', 'Agents with tool calling. ibx is a tool built for them.'],
  tools: ['Agentes que chamam APIs e ferramentas de verdade.', 'Agents that call real APIs and tools.'],
  rag: ['Recuperação e geração. A paleta ⌘K deste site faz a recuperação com BM25.', 'Retrieval and generation. This site’s ⌘K palette does the retrieval with BM25.'],
  embeddings: ['Busca semântica sobre dados próprios.', 'Semantic search over your own data.'],
  pgvector: ['Vetores dentro do Postgres, sem banco extra.', 'Vectors inside Postgres, no extra database.'],
  ml: ['Machine Learning aplicado na PGM Natal.', 'Machine learning applied at PGM Natal.'],
  transformers: ['Fine-tuning de modelos como o DistilBERT para NLP.', 'Fine-tuning models like DistilBERT for NLP.'],
  nest: ['Microsserviços na AMentoria.', 'Microservices at AMentoria.'],
  graphql: ['Nos microsserviços da AMentoria.', 'In AMentoria’s microservices.'],
  kafka: ['Arquitetura orientada a eventos na AMentoria.', 'Event-driven architecture at AMentoria.'],
  fastapi: ['APIs na PGM Natal.', 'APIs at PGM Natal.'],
  postgres: ['Usado na PGM Natal. Com pgvector, também faz busca semântica.', 'Used at PGM Natal. With pgvector it also handles semantic search.'],
  ts: ['De ponta a ponta: ShellShield, serviços NestJS e front-end.', 'End to end: ShellShield, NestJS services and front-end.'],
  bun: ['Runtime e compilador do ShellShield.', 'ShellShield’s runtime and compiler.'],
  webgl: ['O céu ASCII lá no topo desta página.', 'The ASCII sky at the top of this page.'],
  docker: ['Ambientes reproduzíveis, do dev à produção.', 'Reproducible environments, from dev to production.'],
  redis: ['Cache, filas e estado efêmero.', 'Caching, queues and ephemeral state.'],
  cloudflare: ['Expõe serviços sem abrir portas.', 'Exposes services without opening ports.'],
  cicd: ['Testes e deploy automáticos.', 'Automated tests and deploys.'],
  socketio: ['Tempo real sobre WebSockets.', 'Real time over WebSockets.'],
};

const HINT = finePointer.matches
  ? ['Passe o mouse, ou use Tab e as setas, em qualquer ferramenta.', 'Hover, or use Tab and the arrow keys, on any tool.']
  : ['Toque em qualquer ferramenta.', 'Tap any tool.'];

/** Tiny seeded PRNG so the layout is the same on every visit. */
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function initLatent() {
  const host = $('[data-latent]');
  const list = $('[data-stack]', host);
  if (!host || !list) return;

  const groups = $$('.stack-group', list).map((group) => ({
    id: group.dataset.group,
    heading: $('h3', group),
    items: $$('li', group),
  }));

  const map = h('div', { class: 'latent-map' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'latent-svg');
  svg.setAttribute('aria-hidden', 'true');
  const hullLayer = document.createElementNS(svg.namespaceURI, 'g');
  const edgeLayer = document.createElementNS(svg.namespaceURI, 'g');
  svg.append(hullLayer, edgeLayer);
  const tip = h('div', { class: 'latent-tip', 'aria-live': 'polite' });
  map.append(
    svg,
    h('span', { class: 'latent-axis latent-axis--y', 'aria-hidden': 'true' }, '↑ dim₂'),
    h('span', { class: 'latent-axis latent-axis--x', 'aria-hidden': 'true' }, 'dim₁ →'),
    tip,
  );

  const random = seeded(7);
  const nodes = [];
  const byId = new Map();
  const clusters = new Map();

  for (const group of groups) {
    const center = CLUSTERS[group.id] || { x: 0.5, y: 0.5 };
    const label = h('span', { class: 'latent-cluster', 'aria-hidden': 'true' });
    const hull = document.createElementNS(svg.namespaceURI, 'ellipse');
    hull.setAttribute('class', 'latent-hull');
    hullLayer.append(hull);
    map.append(label);
    clusters.set(group.id, { ...group, center, label, hull });

    group.items.forEach((item, i) => {
      const button = h('button', { class: 'latent-node', type: 'button', 'data-id': item.dataset.id });
      map.append(button);
      const angle = i * 2.399963;
      const radius = 0.035 + 0.03 * Math.sqrt(i);
      const node = {
        id: item.dataset.id,
        source: item,
        group: group.id,
        element: button,
        x: 0,
        y: 0,
        seedX: center.x + Math.cos(angle) * radius,
        seedY: center.y + Math.sin(angle) * radius * 1.4,
        w: 80,
        h: 28,
        phase: random() * Math.PI * 2,
        depth: 0.35 + random() * 0.65,
        neighbours: new Set(),
      };
      nodes.push(node);
      byId.set(node.id, node);
    });
  }

  const edges = EDGES.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('class', 'latent-edge');
    edgeLayer.append(path);
    byId.get(a).neighbours.add(b);
    byId.get(b).neighbours.add(a);
    return { a: byId.get(a), b: byId.get(b), path };
  });

  host.prepend(map);
  host.classList.add('has-map');

  /* ---------- Text (re-run on language change) ---------- */

  function syncText() {
    for (const node of nodes) node.element.textContent = node.source.textContent.trim();
    for (const cluster of clusters.values()) cluster.label.textContent = cluster.heading.textContent.trim();
    showTip(null);
  }

  /* ---------- Layout: seeded spiral + collision relaxation ---------- */

  let width = 0;
  let height = 0;

  function layout() {
    const rect = map.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return false;

    // The hint box lives in the bottom-left corner; nodes stay out of it.
    const tipZone = { right: 18 + Math.min(460, width - 36) + 12, top: height - 18 - Math.max(tip.offsetHeight, 84) - 12 };
    for (const node of nodes) {
      node.w = node.element.offsetWidth;
      node.h = node.element.offsetHeight;
      node.x = node.seedX * width;
      node.y = node.seedY * height;
    }
    const pad = 10;
    for (let iteration = 0; iteration < 260; iteration++) {
      for (const node of nodes) {
        const center = clusters.get(node.group).center;
        node.x += (center.x * width - node.x) * 0.012;
        node.y += (center.y * height - node.y) * 0.012;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = (a.w + b.w) / 2 + pad - Math.abs(dx);
          const overlapY = (a.h + b.h) / 2 + pad - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const sameGroup = a.group === b.group ? 0.5 : 0.62;
          if (overlapX / (a.w + b.w) < overlapY / (a.h + b.h)) {
            const push = overlapX * sameGroup * Math.sign(dx || 1);
            a.x -= push;
            b.x += push;
          } else {
            const push = overlapY * sameGroup * Math.sign(dy || 1);
            a.y -= push;
            b.y += push;
          }
        }
      }
      for (const node of nodes) {
        node.x = clamp(node.x, node.w / 2 + 24, width - node.w / 2 - 24);
        node.y = clamp(node.y, node.h / 2 + 52, height - node.h / 2 - 24);
        if (node.x - node.w / 2 < tipZone.right && node.y + node.h / 2 > tipZone.top) node.y = tipZone.top - node.h / 2;
      }
    }

    for (const cluster of clusters.values()) {
      const members = nodes.filter((node) => node.group === cluster.id);
      const left = Math.min(...members.map((n) => n.x - n.w / 2));
      const right = Math.max(...members.map((n) => n.x + n.w / 2));
      const top = Math.min(...members.map((n) => n.y - n.h / 2));
      const bottom = Math.max(...members.map((n) => n.y + n.h / 2));
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      cluster.hull.setAttribute('cx', cx);
      cluster.hull.setAttribute('cy', cy);
      cluster.hull.setAttribute('rx', (right - left) / 2 + 34);
      cluster.hull.setAttribute('ry', (bottom - top) / 2 + 30);
      cluster.label.style.transform = `translate(${Math.max(16, left - 6)}px, ${Math.max(14, top - 30 - 22)}px)`;
    }
    return true;
  }

  /* ---------- Motion ---------- */

  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let visible = false;
  let raf = 0;

  function place(time) {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const still = calm();
    for (const node of nodes) {
      const floatX = still ? 0 : Math.sin(time * 0.45 + node.phase) * 3.2;
      const floatY = still ? 0 : Math.cos(time * 0.38 + node.phase * 1.3) * 3.2;
      const parallaxX = still ? 0 : (pointer.x - 0.5) * -18 * node.depth;
      const parallaxY = still ? 0 : (pointer.y - 0.5) * -12 * node.depth;
      node.px = node.x + floatX + parallaxX;
      node.py = node.y + floatY + parallaxY;
      node.element.style.transform = `translate(${(node.px - node.w / 2).toFixed(1)}px, ${(node.py - node.h / 2).toFixed(1)}px)`;
    }
    for (const edge of edges) {
      const { a, b } = edge;
      const mx = (a.px + b.px) / 2;
      const my = (a.py + b.py) / 2;
      const bend = 0.14;
      const cx = mx - (b.py - a.py) * bend;
      const cy = my + (b.px - a.px) * bend;
      edge.path.setAttribute('d', `M${a.px.toFixed(1)} ${a.py.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.px.toFixed(1)} ${b.py.toFixed(1)}`);
    }
  }

  function frame(now) {
    raf = 0;
    place(now / 1000);
    if (visible && !calm()) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  /* ---------- Focus / hover ---------- */

  let pinned = null;

  function showTip(node) {
    tip.textContent = '';
    if (!node) {
      const counts = [
        `${nodes.length} ferramentas · ${clusters.size} grupos · ${edges.length} conexões`,
        `${nodes.length} tools · ${clusters.size} groups · ${edges.length} links`,
      ];
      tip.append(h('b', {}, pick(counts)), pick(HINT));
      return;
    }
    const cluster = clusters.get(node.group);
    tip.append(h('b', {}, node.element.textContent), h('span', {}, cluster.heading.textContent.trim()));
    const note = NOTES[node.id];
    if (note) tip.append(' · ', pick(note));
  }

  function focusNode(node) {
    map.classList.toggle('has-focus', Boolean(node));
    for (const other of nodes) {
      other.element.classList.toggle('is-on', other === node);
      other.element.classList.toggle('is-near', Boolean(node && node.neighbours.has(other.id)));
    }
    for (const edge of edges) edge.path.classList.toggle('is-on', Boolean(node && (edge.a === node || edge.b === node)));
    for (const cluster of clusters.values()) {
      const on = Boolean(node && cluster.id === node.group);
      cluster.hull.classList.toggle('is-on', on);
      cluster.label.classList.toggle('is-on', on);
    }
    showTip(node);
  }

  let roving = 0;
  const moveTo = (index) => {
    roving = (index + nodes.length) % nodes.length;
    nodes.forEach((node, i) => node.element.setAttribute('tabindex', i === roving ? '0' : '-1'));
    nodes[roving].element.focus();
  };

  nodes.forEach((node, index) => {
    node.element.setAttribute('tabindex', index === 0 ? '0' : '-1');
    node.element.setAttribute('aria-pressed', 'false');
    node.element.addEventListener('pointerenter', () => focusNode(node));
    node.element.addEventListener('focus', () => {
      roving = index;
      nodes.forEach((other, i) => other.element.setAttribute('tabindex', i === index ? '0' : '-1'));
      focusNode(node);
    });
    node.element.addEventListener('pointerleave', () => focusNode(pinned));
    node.element.addEventListener('blur', () => focusNode(pinned));
    node.element.addEventListener('click', () => {
      pinned = pinned === node ? null : node;
      nodes.forEach((other) => other.element.setAttribute('aria-pressed', String(other === pinned)));
      focusNode(pinned || node);
    });
    node.element.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (step) moveTo(roving + step);
      else if (event.key === 'Home') moveTo(0);
      else if (event.key === 'End') moveTo(nodes.length - 1);
      else return;
      event.preventDefault();
    });
  });

  map.addEventListener('pointermove', (event) => {
    const rect = map.getBoundingClientRect();
    pointer.tx = (event.clientX - rect.left) / rect.width;
    pointer.ty = (event.clientY - rect.top) / rect.height;
  });
  map.addEventListener('pointerleave', () => {
    pointer.tx = 0.5;
    pointer.ty = 0.5;
  });

  /* ---------- Boot ---------- */

  syncText();
  const relayout = () => {
    if (layout()) place(performance.now() / 1000);
  };
  new ResizeObserver(relayout).observe(map);
  document.fonts?.ready.then(relayout);
  onLang(() => {
    syncText();
    relayout();
  });
  onMotion(() => {
    place(performance.now() / 1000);
    start();
  });
  watchVisibility(map, (isVisible) => {
    visible = isVisible;
    start();
  }, '100px');
}
