import { $, $$, watchVisibility, reducedMotion } from '../core/util.js';
import { calm } from '../core/motion.js';
import { pick, onLang, lang } from '../core/i18n.js';
import { skyStats } from '../sky/sky.js';

/** Measures this very page with the Performance API and shows it in the colophon. */
export function initTelemetry() {
  const panel = $('[data-telemetry]');
  if (!panel) return;
  const fields = Object.fromEntries($$('[data-tm]', panel).map((el) => [el.dataset.tm, el]));
  let timer = 0;
  let introduced = false;

  function measure() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    let transferred = navigation?.transferSize || 0;
    let encoded = navigation?.encodedBodySize || 0;
    for (const entry of resources) {
      transferred += entry.transferSize || 0;
      encoded += entry.encodedBodySize || 0;
    }
    return {
      kb: (transferred || encoded) / 1024,
      cached: !transferred && encoded > 0,
      requests: resources.length + 1,
      ready: navigation ? navigation.domContentLoadedEventEnd || navigation.duration : performance.now(),
      fps: skyStats.frames > 10 ? Math.min(skyStats.fps, 240) : null,
      glyphs: skyStats.glyphs || null,
      dom: document.getElementsByTagName('*').length,
    };
  }

  function paint(m, k = 1) {
    const locale = lang() === 'en' ? 'en-US' : 'pt-BR';
    const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const dec = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const unit = (text) => `<small>${text}</small>`;
    fields.weight.innerHTML = `${dec.format(m.kb * k)}${unit(m.cached ? 'KB · cache' : 'KB')}`;
    fields.requests.textContent = int.format(Math.round(m.requests * k));
    fields.ready.innerHTML = `${int.format(m.ready * k)}${unit('ms')}`;
    fields.fps.innerHTML = m.fps ? `${int.format(m.fps * k)}${unit('fps')}` : skyStats.webgl ? (calm() ? `0${unit(pick(['fps · estático', 'fps · static']))}` : `…${unit(pick(['aguardando', 'waiting']))}`) : `n/d${unit(pick(['sem WebGL', 'no WebGL']))}`;
    fields.glyphs.textContent = m.glyphs ? int.format(Math.round(m.glyphs * k)) : '…';
    fields.dom.textContent = int.format(Math.round(m.dom * k));
  }

  function introduce() {
    introduced = true;
    const target = measure();
    if (reducedMotion.matches) {
      paint(target);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      paint(target, 1 - (1 - t) ** 3);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  watchVisibility(panel, (visible) => {
    clearInterval(timer);
    if (!visible) return;
    if (!introduced) introduce();
    timer = setInterval(() => paint(measure()), 2000);
  });
  onLang(() => introduced && paint(measure()));
}
