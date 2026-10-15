import { $, h, normalize, escapeHtml, toast, isMac } from '../core/util.js';
import { pick, onLang, toggleLang } from '../core/i18n.js';
import { toggleTheme } from './theme.js';
import { skyControl } from '../sky/sky.js';

/* ---------- Knowledge base: short passages, retrieved with BM25 ---------- */

const DOCS = [
  {
    href: '#sobre', section: ['Sobre', 'About'],
    title: ['Quem é Riquelme Soares', 'Who Riquelme Soares is'],
    text: ['Engenheiro full-stack e de IA em Natal, RN. Transforma processos manuais em sistemas que funcionam sozinhos — APIs, arquiteturas orientadas a eventos, LLMs e agentes de IA em produção.', 'Full-stack and AI engineer in Natal, Brazil. Turns manual processes into systems that run on their own — APIs, event-driven architectures, LLMs and AI agents in production.'],
    keywords: 'riquelme soares hevlyo engenheiro engineer desenvolvedor developer dev quem who perfil profile sobre about',
  },
  {
    href: '#trabalho', section: ['Trabalho', 'Work'],
    title: ['Onde trabalha hoje', 'Where he works now'],
    text: ['Atualmente na PGM Natal — Procuradoria Geral do Município de Natal — e na AMentoria Educação.', 'Currently at PGM Natal — Natal’s Municipal Attorney General’s Office — and at AMentoria Educação.'],
    keywords: 'emprego job empresa company atual current trabalha works experiencia experience',
  },
  {
    href: '#trabalho', section: ['Trabalho', 'Work'],
    title: ['PGM Natal', 'PGM Natal'],
    text: ['Na Procuradoria Geral do Município de Natal, desenvolve soluções com FastAPI, PostgreSQL e Machine Learning. Os detalhes são sigilosos.', 'At Natal’s Municipal Attorney General’s Office he builds solutions with FastAPI, PostgreSQL and machine learning. The details are confidential.'],
    keywords: 'procuradoria setor publico public sector governo government juridico legal prefeitura city',
  },
  {
    href: '#trabalho', section: ['Trabalho', 'Work'],
    title: ['AMentoria Educação', 'AMentoria Educação'],
    text: ['Na AMentoria Educação, constrói microsserviços com NestJS, GraphQL e Apache Kafka.', 'At AMentoria Educação he builds microservices with NestJS, GraphQL and Apache Kafka.'],
    keywords: 'educacao education mentoria enem microsservicos microservices',
  },
  {
    href: '#trabalho', section: ['Trabalho', 'Work'],
    title: ['Por que o código é privado', 'Why the code is private'],
    text: ['O trabalho principal roda dentro de instituições e lida com dados sensíveis; por segurança, o código é privado. Arquitetura, decisões e resultados podem ser detalhados numa conversa.', 'The main work runs inside institutions and handles sensitive data; for security, the code is private. Architecture, decisions and results can be discussed in a conversation.'],
    keywords: 'sigilo sigiloso confidencial confidential privado private seguranca security nda portfolio projetos projects github',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Foco atual: IA', 'Current focus: AI'],
    text: ['LLMs, agentes de IA com tool calling, RAG com embeddings e pgvector, e automação de fluxos.', 'LLMs, AI agents with tool calling, RAG with embeddings and pgvector, and workflow automation.'],
    keywords: 'ia ai inteligencia artificial intelligence automacao automation foco focus',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['LLMs em produção', 'LLMs in production'],
    text: ['Integra LLMs da OpenAI, Claude e modelos open-source em sistemas reais.', 'Integrates LLMs from OpenAI, Claude and open-source models into real systems.'],
    keywords: 'gpt openai anthropic claude modelo model chatbot llm ia ai',
  },
  {
    href: '#trabalho', section: ['Trabalho', 'Work'],
    title: ['Kafka e eventos', 'Kafka and events'],
    text: ['Arquitetura orientada a eventos com Apache Kafka: serviços desacoplados que conversam por eventos, na AMentoria.', 'Event-driven architecture with Apache Kafka: decoupled services that talk through events, at AMentoria.'],
    keywords: 'mensageria messaging fila queue streaming eventos events',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Backend', 'Backend'],
    text: ['Node.js com NestJS e Express, Python com FastAPI e Java com Spring Boot; APIs GraphQL e REST.', 'Node.js with NestJS and Express, Python with FastAPI and Java with Spring Boot; GraphQL and REST APIs.'],
    keywords: 'api servidor server node java python typescript back',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Bancos de dados', 'Databases'],
    text: ['PostgreSQL, Oracle e SQL Server; Prisma como ORM e pgvector para busca semântica.', 'PostgreSQL, Oracle and SQL Server; Prisma as ORM and pgvector for semantic search.'],
    keywords: 'banco database sql postgres dados data orm',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Infraestrutura', 'Infrastructure'],
    text: ['Docker, Linux, Nginx, CI/CD, Redis e Cloudflare Tunnel.', 'Docker, Linux, Nginx, CI/CD, Redis and Cloudflare Tunnel.'],
    keywords: 'devops deploy infra servidor server cloud container',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Frontend', 'Frontend'],
    text: ['React, Next.js, TypeScript e Tailwind CSS — e WebGL quando a ideia pede.', 'React, Next.js, TypeScript and Tailwind CSS — and WebGL when the idea calls for it.'],
    keywords: 'front interface ui web react',
  },
  {
    href: '#shellshield', section: ['Open source', 'Open source'],
    title: ['ShellShield', 'ShellShield'],
    text: ['Guarda de terminal em tempo real: bloqueia rm -rf /, curl | bash e ataques de homógrafo em cerca de 23,5 µs por comando, com 117 testes.', 'Real-time terminal guard: blocks rm -rf /, curl | bash and homograph attacks in about 23.5 µs per command, with 117 tests.'],
    keywords: 'seguranca security terminal shell cli bun typescript open source projeto project',
  },
  {
    href: '#ibx', section: ['Open source', 'Open source'],
    title: ['ibx', 'ibx'],
    text: ['Skill de agente e script bash para sandboxes descartáveis do instabox.sh: reservas sem corrida, pausa por ociosidade, exec seguro e guarda de credenciais.', 'Agent skill and bash script for disposable instabox.sh sandboxes: race-free reservations, idle pauses, safe exec and credential guards.'],
    keywords: 'agentes agents sandbox claude code codex opencode bash open source projeto project',
  },
  {
    href: '#sobre', section: ['Sobre', 'About'],
    title: ['Formação', 'Education'],
    text: ['Ciência e Tecnologia na UFRN, a Universidade Federal do Rio Grande do Norte.', 'Science and Technology at UFRN, the Federal University of Rio Grande do Norte.'],
    keywords: 'faculdade universidade university graduacao degree estudo study ect formacao',
  },
  {
    href: '#top', section: ['Início', 'Home'],
    title: ['Natal, RN', 'Natal, Brazil'],
    text: ['Natal, Rio Grande do Norte, Brasil — a Cidade do Sol. Fuso horário UTC−3.', 'Natal, Rio Grande do Norte, Brazil — the City of the Sun. Time zone UTC−3.'],
    keywords: 'onde where localizacao location cidade city mora lives brasil brazil fuso timezone horario',
  },
  {
    href: '#contato', section: ['Contato', 'Contact'],
    title: ['Disponibilidade', 'Availability'],
    text: ['Aberto a projetos freelance e vagas remotas em IA, backend e automação.', 'Open to freelance projects and remote roles in AI, backend and automation.'],
    keywords: 'freela freelance vaga job contratar hire disponivel available remoto remote trabalho work',
  },
  {
    href: '#contato', section: ['Contato', 'Contact'],
    title: ['Contato', 'Contact'],
    text: ['O melhor canal é o LinkedIn, em /in/riquelme-soares. O código público está no GitHub, @hevlyo.', 'The best channel is LinkedIn, at /in/riquelme-soares. Public code is on GitHub, @hevlyo.'],
    keywords: 'email linkedin github falar talk mensagem message contatar reach',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Princípios de engenharia', 'Engineering principles'],
    text: ['API design, arquitetura orientada a eventos, IA em produção, performance e observabilidade.', 'API design, event-driven architecture, AI in production, performance and observability.'],
    keywords: 'principios principles engenharia engineering qualidade quality',
  },
  {
    href: '#este-site', section: ['Este site', 'This site'],
    title: ['Como este site foi feito', 'How this site was built'],
    text: ['HTML, CSS e JavaScript escritos à mão, sem framework nem build. Céu em WebGL com algoritmos astronômicos e busca BM25 local nesta paleta.', 'Hand-written HTML, CSS and JavaScript, no framework or build. A WebGL sky driven by astronomical algorithms and local BM25 search in this palette.'],
    keywords: 'site portfolio feito built webgl ascii bm25 codigo source performance rag',
  },
  {
    href: '#top', section: ['Início', 'Home'],
    title: ['O céu no topo da página', 'The sky at the top'],
    text: ['O sol e a lua no topo estão na posição real sobre Natal agora. Use o controle de hora ou o timelapse para ver o dia passar.', 'The sun and moon at the top are where they really are over Natal right now. Use the time slider or the timelapse to watch the day go by.'],
    keywords: 'sol sun lua moon ceu sky ascii hora time timelapse astronomia astronomy',
  },
  {
    href: '#stack', section: ['Stack', 'Stack'],
    title: ['Python', 'Python'],
    text: ['Python para APIs com FastAPI, Machine Learning, NLP com Transformers e automação.', 'Python for FastAPI APIs, machine learning, NLP with Transformers and automation.'],
    keywords: 'fastapi ml nlp transformers distilbert',
  },
];

/* ---------- Tokenizer + BM25 ---------- */

const STOP = new Set(
  ('a o e de da do das dos em no na nos nas um uma uns umas para pra por com que se ao aos as os ou mais mas seu sua seus suas eu ele ela voce vc ja tem ter sabe faz usa qual quais como ' +
    'the of and to in is it on for with as at by an be are does you your he his him what which how know use uses can')
    .split(' '),
);

const stem = (token) => (token.length > 4 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token);

function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9µ#+]+/)
    .filter((token) => token && !STOP.has(token))
    .map(stem);
}

class BM25 {
  constructor(documents, { k1 = 1.2, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = documents.map((tokens) => {
      const tf = new Map();
      for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
      return { tf, length: tokens.length };
    });
    this.avg = this.docs.reduce((sum, d) => sum + d.length, 0) / this.docs.length;
    this.df = new Map();
    for (const doc of this.docs) for (const token of doc.tf.keys()) this.df.set(token, (this.df.get(token) || 0) + 1);
    this.vocabulary = [...this.df.keys()];
  }

  idf(token) {
    const n = this.df.get(token) || 0;
    return Math.log((this.docs.length - n + 0.5) / (n + 0.5) + 1);
  }

  /** Each query term also matches vocabulary words it prefixes (live, as-you-type search). */
  expand(terms) {
    const expanded = new Map();
    for (const term of terms) {
      if (this.df.has(term)) expanded.set(term, Math.max(expanded.get(term) || 0, 1));
      if (term.length >= 3) {
        for (const word of this.vocabulary) {
          if (word !== term && word.startsWith(term)) expanded.set(word, Math.max(expanded.get(word) || 0, 0.7));
        }
      }
    }
    return expanded;
  }

  search(query) {
    const terms = this.expand(tokenize(query));
    if (!terms.size) return [];
    return this.docs
      .map((doc, index) => {
        let score = 0;
        const matched = new Set();
        for (const [term, weight] of terms) {
          const f = doc.tf.get(term);
          if (!f) continue;
          matched.add(term);
          score += weight * this.idf(term) * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * doc.length) / this.avg)));
        }
        return { index, score, matched };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

const index = new BM25(
  DOCS.map((doc) => tokenize([doc.title.join(' '), doc.title.join(' '), doc.text.join(' '), doc.keywords].join(' '))),
);

function highlight(text, matched) {
  return text
    .split(/(\s+|[.,;:—()]+)/)
    .map((part) => {
      const token = stem(normalize(part).replace(/[^a-z0-9µ#+]/g, ''));
      return token && matched.has(token) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part);
    })
    .join('');
}

/* ---------- Commands ---------- */

function go(selector, after) {
  const target = $(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', selector === '#top' ? location.pathname : selector);
  if (after) setTimeout(after, 650);
}

const skyAction = (name) => () => go('#top', () => skyControl[name]?.());

const COMMANDS = [
  { group: 'go', icon: 'i-sun', title: ['Início', 'Home'], keywords: 'topo top hero inicio home', run: () => go('#top') },
  { group: 'go', icon: 'i-hash', title: ['Sobre', 'About'], keywords: 'sobre about manifesto quem who', run: () => go('#sobre') },
  { group: 'go', icon: 'i-doc', title: ['Trabalho — dossiês sob sigilo', 'Work — confidential files'], keywords: 'trabalho work pgm amentoria experiencia experience', run: () => go('#trabalho') },
  {
    group: 'go', icon: 'i-terminal', title: ['ShellShield — testar no terminal', 'ShellShield — try it in the terminal'], keywords: 'shellshield terminal demo seguranca security',
    run: () => go('#shellshield', () => $('#shellshield .term-input')?.focus({ preventScroll: true })),
  },
  { group: 'go', icon: 'i-terminal', title: ['ibx — simulador de sandboxes', 'ibx — sandbox simulator'], keywords: 'ibx sandbox agentes agents instabox', run: () => go('#ibx') },
  { group: 'go', icon: 'i-hash', title: ['Stack — espaço latente', 'Stack — latent space'], keywords: 'stack tecnologias technologies ferramentas tools skills', run: () => go('#stack') },
  { group: 'go', icon: 'i-bolt', title: ['Este site — telemetria ao vivo', 'This site — live telemetry'], keywords: 'site telemetria telemetry performance colofao colophon', run: () => go('#este-site') },
  { group: 'go', icon: 'i-link', title: ['Contato', 'Contact'], keywords: 'contato contact falar talk', run: () => go('#contato') },

  { group: 'act', icon: 'i-theme', title: ['Alternar tema claro / escuro', 'Toggle light / dark theme'], keywords: 'tema theme dark light escuro claro modo mode', run: () => toggleTheme() },
  { group: 'act', icon: 'i-lang', title: ['Switch to English', 'Mudar para português'], keywords: 'idioma language ingles english portugues portuguese lingua', run: () => toggleLang() },
  { group: 'act', icon: 'i-sun', title: ['Céu: voltar para agora', 'Sky: back to now'], keywords: 'ceu sky agora now ao vivo live', run: skyAction('now') },
  { group: 'act', icon: 'i-sun', title: ['Céu: ver o pôr do sol de hoje', 'Sky: watch today’s sunset'], keywords: 'ceu sky por do sol sunset entardecer', run: skyAction('sunset') },
  { group: 'act', icon: 'i-sun', title: ['Céu: ver o nascer do sol', 'Sky: watch the sunrise'], keywords: 'ceu sky nascer sunrise amanhecer manha', run: skyAction('sunrise') },
  { group: 'act', icon: 'i-moon', title: ['Céu: ver a noite', 'Sky: see tonight'], keywords: 'ceu sky noite night lua moon estrelas stars', run: skyAction('night') },
  { group: 'act', icon: 'i-play', title: ['Céu: timelapse de 24 horas', 'Sky: 24-hour timelapse'], keywords: 'ceu sky timelapse dia day animacao', run: skyAction('play') },
  {
    group: 'act', icon: 'i-link', title: ['Copiar o link deste site', 'Copy this site’s link'], keywords: 'copiar copy link url compartilhar share',
    run: async () => {
      try {
        await navigator.clipboard.writeText(`${location.origin}/`);
        toast(pick(['Link copiado', 'Link copied']));
      } catch {
        toast(location.origin);
      }
    },
  },
  { group: 'act', icon: 'i-print', title: ['Imprimir como currículo', 'Print as a résumé'], keywords: 'imprimir print cv curriculo resume pdf', run: () => setTimeout(() => print(), 250) },

  { group: 'link', icon: 'i-linkedin', title: ['LinkedIn', 'LinkedIn'], sub: '/in/riquelme-soares', keywords: 'linkedin contato contact', run: () => open('https://www.linkedin.com/in/riquelme-soares/', '_blank', 'noopener') },
  { group: 'link', icon: 'i-github', title: ['GitHub', 'GitHub'], sub: '@hevlyo', keywords: 'github codigo code repositorios repositories', run: () => open('https://github.com/hevlyo', '_blank', 'noopener') },
  { group: 'link', icon: 'i-github', title: ['Código-fonte deste site', 'This site’s source code'], sub: 'hevlyo/hevlyo.github.io', keywords: 'source codigo fonte site', run: () => open('https://github.com/hevlyo/hevlyo.github.io', '_blank', 'noopener') },
];

const GROUPS = {
  answers: ['Respostas · BM25', 'Answers · BM25'],
  go: ['Ir para', 'Go to'],
  act: ['Ações', 'Actions'],
  link: ['Links', 'Links'],
};

/** Subsequence match with bonuses for word starts and contiguous runs. */
function fuzzy(query, text) {
  const q = normalize(query).trim();
  const t = normalize(text);
  if (!q) return 1;
  const direct = t.indexOf(q);
  if (direct >= 0) return 100 - direct * 0.5 + (direct === 0 || t[direct - 1] === ' ' ? 20 : 0);
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const char of q) {
    if (char === ' ') continue;
    const found = t.indexOf(char, ti);
    if (found < 0) return 0;
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2 + (found === 0 || t[found - 1] === ' ' ? 3 : 0);
    ti = found + 1;
  }
  return score;
}

/* ---------- UI ---------- */

export function initPalette() {
  const dialog = $('[data-palette]');
  if (!dialog) return;
  const input = $('[data-palette-input]', dialog);
  const list = $('[data-palette-list]', dialog);
  let items = [];
  let selected = 0;

  function render() {
    const query = input.value.trim();
    const sections = [];

    if (query) {
      const answers = index.search(query).slice(0, 3).filter((r, i, all) => r.score >= Math.max(1.2, all[0].score * 0.35));
      if (answers.length) {
        sections.push({
          group: 'answers',
          entries: answers.map((r) => {
            const doc = DOCS[r.index];
            return {
              kind: 'answer',
              icon: 'i-doc',
              titleHtml: highlight(pick(doc.title), r.matched),
              textHtml: highlight(pick(doc.text), r.matched),
              meta: `BM25 ${r.score.toLocaleString(pick(['pt-BR', 'en-US']), { maximumFractionDigits: 2 })} · ${pick(doc.section)}`,
              run: () => go(doc.href),
            };
          }),
        });
      }
      const ranked = COMMANDS.map((cmd) => ({ cmd, score: Math.max(fuzzy(query, pick(cmd.title)), fuzzy(query, cmd.keywords) * 0.8) }))
        .filter((r) => r.score > 4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 7);
      if (ranked.length) sections.push({ group: 'act', label: pick(['Comandos', 'Commands']), entries: ranked.map((r) => toEntry(r.cmd)) });
    } else {
      for (const group of ['go', 'act', 'link']) {
        sections.push({ group, entries: COMMANDS.filter((cmd) => cmd.group === group).map(toEntry) });
      }
    }

    list.textContent = '';
    items = [];
    if (!sections.length) {
      list.append(
        h('p', { class: 'pal-empty' }, pick([`Nada sobre “${query}”. Tente “kafka”, “sigilo”, “pôr do sol” ou “tema”.`, `Nothing about “${query}”. Try “kafka”, “confidential”, “sunset” or “theme”.`])),
      );
      input.removeAttribute('aria-activedescendant');
      return;
    }

    for (const section of sections) {
      const groupId = `pal-g-${section.group}`;
      const group = h('div', { role: 'group', 'aria-labelledby': groupId });
      group.append(h('div', { class: 'pal-group', id: groupId }, section.label || pick(GROUPS[section.group])));
      for (const entry of section.entries) {
        const id = `pal-opt-${items.length}`;
        const isAnswer = entry.kind === 'answer';
        const option = h(
          'div',
          { class: `pal-item${isAnswer ? ' pal-item--answer' : ''}`, role: 'option', id, 'aria-selected': 'false' },
          h('span', { class: 'pal-icon', 'aria-hidden': 'true', html: `<svg class="i"><use href="#${entry.icon}"/></svg>` }),
          h(
            'span',
            {},
            h('span', { class: 'pal-title', html: entry.titleHtml }),
            entry.textHtml ? h('span', { class: 'pal-text', html: entry.textHtml }) : null,
            entry.sub ? h('span', { class: 'pal-sub' }, entry.sub) : null,
            entry.meta ? h('span', { class: 'pal-score' }, entry.meta) : null,
          ),
          h('span', { class: 'pal-hint', 'aria-hidden': 'true' }, isAnswer ? '↵' : ''),
        );
        const position = items.length;
        option.addEventListener('pointermove', () => select(position, false));
        option.addEventListener('click', () => execute(position));
        group.append(option);
        items.push({ element: option, run: entry.run });
      }
      list.append(group);
    }
    select(0, false);
  }

  function toEntry(cmd) {
    return { icon: cmd.icon, titleHtml: escapeHtml(pick(cmd.title)), sub: cmd.sub, run: cmd.run };
  }

  function select(position, scroll = true) {
    if (!items.length) return;
    selected = (position + items.length) % items.length;
    items.forEach((item, i) => item.element.setAttribute('aria-selected', String(i === selected)));
    const element = items[selected].element;
    input.setAttribute('aria-activedescendant', element.id);
    if (scroll) element.scrollIntoView({ block: 'nearest' });
  }

  function execute(position) {
    const item = items[position];
    if (!item) return;
    close();
    item.run();
  }

  function openPalette() {
    if (dialog.open) return;
    input.value = '';
    render();
    dialog.showModal();
    input.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      select(selected + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      select(selected - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(selected);
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) close();
  });

  document.querySelectorAll('[data-palette-open]').forEach((button) => button.addEventListener('click', openPalette));
  addEventListener('keydown', (event) => {
    const typing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]');
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? close() : openPalette();
    } else if (event.key === '/' && !typing && !dialog.open) {
      event.preventDefault();
      openPalette();
    }
  });
  onLang(() => dialog.open && render());

  // Shown in tooltips/aria for discoverability.
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';
  document.querySelectorAll('[data-palette-open]').forEach((button) => button.setAttribute('aria-keyshortcuts', shortcut === '⌘K' ? 'Meta+K' : 'Control+K'));
}
