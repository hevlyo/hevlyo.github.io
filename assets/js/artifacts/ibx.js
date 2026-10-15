// A scripted simulation of the failure modes ibx (github.com/hevlyo/ibx) exists to handle.

import { h, reducedMotion, watchVisibility } from '../core/util.js';
import { pick, onLang } from '../core/i18n.js';

const BOXES = ['box-1', 'box-2', 'box-3', 'box-4'];

const STATES = {
  free: ['livre', 'free'],
  held: ['reservada', 'held'],
  running: ['executando', 'running'],
  paused: ['pausada', 'paused'],
  contended: ['disputada', 'contended'],
  vault: ['Vault', 'Vault'],
};

// Each step: [delay ms, speaker, [pt, en] | text, box changes, tone]
// Speakers: a / b (agents), ibx, out (command output), warn, err, ok.
const SCENARIOS = [
  {
    title: ['Fluxo', 'Flow'],
    start: { 'box-1': ['held', 'agent-c · build'], 'box-2': ['free'], 'box-3': ['free'], 'box-4': ['vault', 'Vault'] },
    steps: [
      [300, 'a', '$ ibx claim "run the test suite of expressjs/express"'],
      [900, 'out', 'box-2', { 'box-2': ['held', 'agent-a · tests', 1] }],
      [800, 'a', "$ ibx exec box-2 -t 480 -- 'npm ci -s && npm test >test.log 2>&1 && echo tests passed'", { 'box-2': ['running', 'agent-a · npm test', 1] }],
      [1900, 'out', 'tests passed', { 'box-2': ['held', 'agent-a · tests', 0.9] }],
      [800, 'a', '$ ibx release box-2'],
      [900, 'out', 'released box-2 (was: run the test suite of expressjs/express (agent-a, since 14:02:11Z))', { 'box-2': ['free'] }],
      [700, 'ok', ['emprestada, usada e devolvida limpa.', 'borrowed, used and handed back clean.']],
    ],
  },
  {
    title: ['Corrida', 'Race'],
    start: { 'box-1': ['held', 'agent-c · build'], 'box-2': ['free'], 'box-3': ['free'], 'box-4': ['vault', 'Vault'] },
    steps: [
      [300, 'a', '$ ibx claim "rodar a suíte de testes"'],
      [220, 'b', '$ ibx claim "build da imagem docker"'],
      [900, 'ibx', ['box-1 reservada · box-4 recebe segredos do Vault → pulando', 'box-1 held · box-4 gets Vault secrets → skipping']],
      [800, 'ibx', ['box-2 parece livre para os dois', 'box-2 looks free to both'], { 'box-2': ['contended', 'agent-a ⇄ agent-b'] }],
      [800, 'ibx', ['os dois gravam uma reserva com token aleatório (7f3a… / c41e…)', 'both write a reservation with a random token (7f3a… / c41e…)']],
      [900, 'ibx', ['espera escritores concorrentes e confere o token duas vezes', 'waits out concurrent writers and checks the token twice']],
      [900, 'a', ['box-2 ✓ token confere — é minha', 'box-2 ✓ token matches — it’s mine'], { 'box-2': ['held', 'agent-a · tests', 1] }],
      [500, 'b', ['box-2 ✕ token não confere → próxima', 'box-2 ✕ token mismatch → next one']],
      [800, 'b', 'box-3', { 'box-3': ['held', 'agent-b · docker', 1] }],
      [700, 'ok', ['ninguém trabalha em cima de ninguém.', 'nobody works on top of anybody.']],
    ],
  },
  {
    title: ['Ociosidade', 'Idle pause'],
    start: { 'box-1': ['held', 'agent-c · build'], 'box-2': ['held', 'agent-a · build', 1], 'box-3': ['free'], 'box-4': ['vault', 'Vault'] },
    steps: [
      [300, 'a', '$ ibx exec box-2 -t 600 -- "npm run build"', { 'box-2': ['running', 'agent-a · build', 1] }],
      [1000, 'ibx', ['lease de atividade de 1 h; keepalive renova a cada 15 min', 'one-hour activity lease; keepalive renews it every 15 min'], { 'box-2': ['running', 'agent-a · build', 0.75] }],
      [1100, 'out', ['build ok · dist/ gerado', 'build ok · dist/ written'], { 'box-2': ['held', 'agent-a · build', 0.4] }],
      [1000, 'warn', ['30 min ociosa e sem keepalive → o instabox pausa a box-2', '30 idle minutes, no keepalive → instabox pauses box-2'], { 'box-2': ['paused', 'agent-a · build', 0] }],
      [1200, 'a', '$ ibx exec box-2 -- "ls dist"'],
      [900, 'ibx', ['box-2 não está rodando → retomando antes do exec', 'box-2 isn’t running → resuming before the exec'], { 'box-2': ['running', 'agent-a · build', 1] }],
      [1000, 'warn', ['box-2 voltou de um boot novo: processos anteriores se foram', 'box-2 came back from a fresh boot: earlier processes are gone']],
      [800, 'out', 'index.js  index.js.map', { 'box-2': ['held', 'agent-a · build', 1] }],
      [700, 'ok', ['a pausa não derrubou o agente — e ele foi avisado.', 'the pause didn’t sink the agent — and it was told.']],
    ],
  },
  {
    title: ['Exec incerto', 'Uncertain exec'],
    start: { 'box-1': ['held', 'agent-c · build'], 'box-2': ['held', 'agent-a · db', 1], 'box-3': ['free'], 'box-4': ['vault', 'Vault'] },
    steps: [
      [300, 'a', '$ ibx exec box-2 -- "npm run db:migrate"', { 'box-2': ['running', 'agent-a · migrate', 1] }],
      [1200, 'err', ['✕ a conexão caiu depois que o comando foi enviado', '✕ the connection dropped after the command was sent'], { 'box-2': ['held', 'agent-a · db', 1] }],
      [900, 'ibx', ['"the command may or may not have run; check before retrying"', '"the command may or may not have run; check before retrying"']],
      [900, 'a', ['sem retry cego. conferindo o estado primeiro:', 'no blind retry. checking state first:']],
      [700, 'a', '$ ibx exec box-2 -- "npm run db:status"', { 'box-2': ['running', 'agent-a · status', 1] }],
      [1000, 'out', ['migrations: 12 aplicadas · 0 pendentes', 'migrations: 12 applied · 0 pending'], { 'box-2': ['held', 'agent-a · db', 1] }],
      [700, 'ok', ['a migração rodou uma vez — e só uma.', 'the migration ran once — and only once.']],
    ],
  },
  {
    title: ['Segredos', 'Secrets'],
    start: { 'box-1': ['held', 'agent-c · build'], 'box-2': ['held', 'agent-a · api', 1], 'box-3': ['free'], 'box-4': ['vault', 'Vault'] },
    steps: [
      [300, 'a', '$ ibx put box-2 .env'],
      [900, 'err', ['recusado: .env parece credencial (use --force só se tiver certeza)', 'refused: .env looks like credentials (use --force only if you’re sure)']],
      [900, 'a', '$ ibx pool add box-4'],
      [900, 'err', ['recusado: o Vault escreve segredos na box-4 (--allow-vault para forçar)', 'refused: the Vault writes secrets into box-4 (--allow-vault to override)']],
      [900, 'a', '$ ibx port box-2 3000'],
      [900, 'warn', ['porta 3000 publicada: URL pública e sem autenticação', 'port 3000 published: public URL with no authentication'], { 'box-2': ['held', 'agent-a · :3000', 1] }],
      [900, 'a', '$ ibx release box-2'],
      [900, 'ibx', ['despublica as portas do ibx antes de liberar · box-2 liberada', 'unpublishes ibx’s ports before releasing · released box-2'], { 'box-2': ['free'] }],
      [700, 'ok', ['nenhum segredo saiu da sua máquina.', 'no secret left your machine.']],
    ],
  },
];

const SPEAKERS = {
  a: { label: '[agent-a]', class: 'ibx-who-a' },
  b: { label: '[agent-b]', class: 'ibx-who-b' },
  ibx: { label: 'ibx', class: 'ibx-who-ibx' },
};
const TONES = { out: 't-fg2', warn: 't-yellow', err: 't-red', ok: 't-green' };

export function mount(host) {
  host.textContent = '';
  host.classList.add('ibx');

  const title = h('span', { class: 'win-title' });
  const badge = h('span', { class: 'win-badge' });
  const tabs = h('div', { class: 'ibx-scenarios', role: 'tablist' });
  const stage = h('div', { class: 'ibx-stage', 'aria-hidden': 'true' });
  const log = h('div', { class: 'ibx-log', role: 'log', 'aria-live': 'polite', tabindex: '0' });
  const progress = h('span', {});
  const replay = h('button', { class: 'ibx-replay', type: 'button', html: '<svg class="i" aria-hidden="true"><use href="#i-play"/></svg><span></span>' });

  host.append(
    h('div', { class: 'win-bar' }, h('span', { class: 'win-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), title, badge),
    tabs,
    stage,
    log,
    h('div', { class: 'ibx-controls' }, progress, replay),
  );

  const boxes = new Map(
    BOXES.map((name) => {
      const element = h(
        'div',
        { class: 'ibx-box', 'data-state': 'free' },
        h('span', { class: 'ibx-box-name' }, name),
        h('span', { class: 'ibx-box-owner' }),
        h('span', { class: 'ibx-box-state' }),
        h('span', { class: 'ibx-box-meter' }),
      );
      stage.append(element);
      return [name, { element, state: 'free', owner: '', lease: 0 }];
    }),
  );

  const tabButtons = SCENARIOS.map((scenario, index) => {
    const button = h('button', { class: 'ibx-tab', type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => play(index, true) });
    tabs.append(button);
    return button;
  });

  let current = 0;
  let token = 0;
  let visible = false;
  let started = false;
  let wake = null;

  function setBox(name, [state, owner = '', lease = 0]) {
    const box = boxes.get(name);
    Object.assign(box, { state, owner, lease });
    paintBox(box);
  }

  function paintBox(box) {
    box.element.dataset.state = box.state;
    box.element.querySelector('.ibx-box-owner').textContent = box.owner || '—';
    box.element.querySelector('.ibx-box-state').textContent = pick(STATES[box.state] || STATES.free);
    box.element.style.setProperty('--lease', box.lease || 0);
  }

  function line(speaker, text) {
    const content = typeof text === 'string' ? text : pick(text);
    const who = SPEAKERS[speaker];
    const p = h('p', { class: TONES[speaker] || '' });
    if (who) p.append(h('span', { class: who.class }, who.label), ' ', content);
    else p.append(speaker === 'out' ? content : `${speaker === 'ok' ? '✓ ' : ''}${content}`);
    log.append(p);
    log.scrollTop = log.scrollHeight;
  }

  /** Resolves after `ms`, but only counts time while the artifact is on screen. */
  function wait(ms, mine) {
    return new Promise((resolve) => {
      const tick = () => {
        if (mine !== token) return resolve(false);
        if (!visible) {
          wake = tick;
          return;
        }
        setTimeout(() => resolve(mine === token), ms);
      };
      tick();
    });
  }

  async function play(index, manual = false) {
    const mine = ++token;
    current = index;
    const scenario = SCENARIOS[index];
    tabButtons.forEach((button, i) => button.setAttribute('aria-selected', String(i === index)));
    progress.textContent = `${pick(['cenário', 'scenario'])} ${index + 1}/${SCENARIOS.length}`;
    log.textContent = '';
    for (const name of BOXES) setBox(name, scenario.start[name] || ['free']);

    for (const [delay, speaker, text, changes] of scenario.steps) {
      if (!reducedMotion.matches && !(await wait(delay, mine))) return;
      if (mine !== token) return;
      line(speaker, text);
      if (changes) for (const [name, value] of Object.entries(changes)) setBox(name, value);
    }
    if (reducedMotion.matches || manual) return;
    if (await wait(3200, mine)) play((index + 1) % SCENARIOS.length);
  }

  function syncText() {
    title.textContent = pick(['ibx · pool de 4 sandboxes', 'ibx · pool of 4 sandboxes']);
    badge.textContent = pick(['simulação', 'simulation']);
    tabs.setAttribute('aria-label', pick(['Cenários', 'Scenarios']));
    log.setAttribute('aria-label', pick(['Saída da simulação', 'Simulation output']));
    replay.querySelector('span').textContent = pick(['repetir', 'replay']);
    tabButtons.forEach((button, i) => (button.textContent = pick(SCENARIOS[i].title)));
    progress.textContent = `${pick(['cenário', 'scenario'])} ${current + 1}/${SCENARIOS.length}`;
    boxes.forEach(paintBox);
  }

  replay.addEventListener('click', () => play(current, true));
  syncText();
  onLang(syncText);

  watchVisibility(host, (isVisible) => {
    visible = isVisible;
    if (isVisible && !started) {
      started = true;
      play(0);
    } else if (isVisible && wake) {
      const resume = wake;
      wake = null;
      resume();
    }
  }, '0px 0px -15% 0px');
}
