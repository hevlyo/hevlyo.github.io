// Two-pass ASCII renderer.
//   Pass 1 draws the scene into a tiny texture with one texel per character
//   cell (rgb = colour, a = luminance).
//   Pass 2 draws every screen pixel by looking up its cell and sampling a glyph
//   atlas whose characters are sorted by measured ink coverage.
// Luminance uses alpha 0–0.8; values above 0.82 address dedicated star glyphs.

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const SCENE = `
precision highp float;

uniform vec2 uRes;
uniform vec2 uCell;
uniform float uTime;
uniform float uHorizon;
uniform vec4 uSun;
uniform vec4 uMoon;
uniform vec3 uMoonLight;
uniform vec4 uSky;
uniform vec3 uMouse;
uniform vec3 uInk;
uniform vec3 uSunCore;
uniform vec3 uSunEdge;
uniform vec3 uGlow;
uniform vec3 uSea;
uniform vec3 uMoonCol;
uniform vec3 uBg;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void take(inout float lum, inout vec3 col, float l, vec3 c) {
  if (l > lum) { lum = l; col = c; }
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 p = ((cell + 0.5) * uCell - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // The pointer is a lens: it bulges the scene toward itself.
  vec2 dm = p - uMouse.xy;
  float lens = uMouse.z * exp(-dot(dm, dm) / 0.011);
  p -= dm * 0.42 * lens;

  float lum = 0.0;
  vec3 col = uInk;
  float star = 0.0;
  float starSize = 0.0;
  bool onDisc = false;

  if (p.y >= uHorizon) {
    float h = p.y - uHorizon;

    if (uSky.z > 0.001) {
      float v = dot(p - vec2(0.2, 0.1), normalize(vec2(-0.55, 0.84)));
      float milky = exp(-v * v / 0.02) * smoothstep(0.0, 0.14, h);
      float s = hash(cell + 17.0);
      if (s > 0.987 - milky * 0.05) {
        float twinkle = 0.5 + 0.5 * sin(t * (0.6 + fract(s * 13.7) * 2.6) + s * 50.0);
        starSize = pow(fract(s * 91.7), 1.6) * 0.75 + twinkle * 0.25;
        star = (0.4 + 0.6 * twinkle) * uSky.z;
      }
      take(lum, col, smoothstep(0.56, 0.86, fbm(p * 5.0 + 3.0)) * milky * 0.13 * uSky.z, uInk);
    }

    float cloud = fbm(vec2(p.x * 1.3 + t * 0.008, h * 6.0 + 1.7));
    take(lum, col, smoothstep(0.56, 0.86, cloud) * 0.22 * uSky.x * smoothstep(0.02, 0.1, h), uInk);

    float warm = exp(-pow((p.x - uSun.x) * 1.1, 2.0));
    float glow = uSky.y * exp(-h * 6.5) * (0.22 + 0.78 * warm) * 0.66;
    glow *= 0.72 + 0.28 * noise(vec2(p.x * 12.0, h * 30.0 - t * 0.3));
    take(lum, col, glow, uGlow);

    if (uSun.w > 0.001) {
      vec2 q = (p - uSun.xy) / uSun.z;
      float d = length(q);
      if (d < 1.0) {
        onDisc = true;
        float mu = sqrt(1.0 - d * d);
        float grain = fbm(q * 3.4 + vec2(t * 0.05, -t * 0.035));
        float l = 0.5 + 0.42 * pow(mu, 0.5) + (grain - 0.5) * 0.36;
        lum = max(lum, l * uSun.w);
        col = mix(uSunEdge, uSunCore, clamp(pow(mu, 0.8) + (grain - 0.5) * 0.4, 0.0, 1.0));
      } else {
        vec2 dir = q / d;
        float a = atan(q.y, q.x);
        float wobble = fbm(dir * 2.2 + vec2(t * 0.06, d * 0.4 - t * 0.04));
        float rays = pow(0.5 + 0.5 * sin(a * 11.0 + wobble * 7.0), 5.0);
        float corona = exp(-(d - 1.0) * 5.0) * 0.55 + rays * exp(-(d - 1.0) * 2.2) * 0.42;
        take(lum, col, corona * uSun.w, mix(uSunEdge, uGlow, 0.35));
      }
    }

    if (uMoon.w > 0.001) {
      vec2 q = (p - uMoon.xy) / uMoon.z;
      float d2 = dot(q, q);
      if (d2 < 1.0) {
        onDisc = onDisc || uMoon.w > 0.3;
        vec3 n = vec3(q, sqrt(1.0 - d2));
        float lit = smoothstep(-0.05, 0.22, dot(n, uMoonLight));
        float maria = smoothstep(0.42, 0.72, fbm(q * 2.3 + 4.1));
        float craters = smoothstep(0.62, 0.92, noise(q * 9.0 + 1.3)) * 0.22;
        float albedo = 0.96 - maria * 0.36 - craters;
        lum = max(lum, (0.045 + 0.9 * lit * albedo) * uMoon.w);
        col = uMoonCol;
      } else {
        take(lum, col, exp(-(sqrt(d2) - 1.0) * 7.0) * 0.17 * uMoon.w, uMoonCol);
      }
    }

    if (star > 0.05 && !onDisc && lum < 0.12) {
      gl_FragColor = vec4(mix(uBg, uInk, star), 0.85 + 0.06 * floor(clamp(starSize, 0.0, 0.999) * 3.0));
      return;
    }
  } else {
    float depth = clamp((uHorizon - p.y) / (uHorizon + 0.5), 0.0, 1.0);
    float persp = 1.0 / (depth + 0.06);
    float w = noise(vec2(p.x * 2.4 * persp + t * 0.25, depth * 34.0 - t * 0.6));
    w = w * 0.65 + 0.35 * noise(vec2(p.x * 7.0 * persp - t * 0.4, depth * 70.0 + t * 0.3));
    take(lum, col, smoothstep(0.45, 0.95, w) * (0.08 + 0.13 * depth), uSea);

    float sparkle = noise(vec2(p.x * 3.1 * persp + t * 0.5, depth * 160.0 - t * 2.2));
    if (uSun.w > 0.001) {
      float above = smoothstep(-uSun.z * 0.9, uSun.z * 0.2, uSun.y - uHorizon);
      float rw = uSun.z * (0.45 + depth * 2.3);
      float path = exp(-pow((p.x - uSun.x) / rw, 2.0));
      float refl = path * smoothstep(0.4, 0.92, sparkle) * (0.42 + 0.4 * uSky.w + 0.22 * (1.0 - depth));
      refl += path * exp(-depth * 18.0) * 0.35;
      take(lum, col, refl * uSun.w * above, mix(uSunCore, uSunEdge, 0.45));
    }
    if (uMoon.w > 0.001) {
      float above = smoothstep(-uMoon.z * 0.9, uMoon.z * 0.2, uMoon.y - uHorizon);
      float rw = uMoon.z * (0.35 + depth * 1.9);
      float path = exp(-pow((p.x - uMoon.x) / rw, 2.0));
      take(lum, col, path * smoothstep(0.55, 0.95, sparkle) * 0.5 * uMoon.w * above, uMoonCol);
    }
  }

  if (abs(p.y - uHorizon) * uRes.y / uCell.y < 0.5) take(lum, col, 0.18 + 0.1 * uSky.x, uSea);

  lum += lens * 0.16 * noise(cell * 0.7 + t * 4.0);
  gl_FragColor = vec4(col, clamp(lum, 0.0, 1.0) * 0.8);
}
`;

const GLYPH = `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec2 uCell;
uniform float uGlyphs;
uniform float uTotal;
uniform vec3 uBg;
uniform float uReveal;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec4 s = texture2D(uScene, (cell + 0.5) / uGrid);
  float r = hash(cell);
  float gi = s.a > 0.81
    ? uGlyphs + clamp(floor((s.a - 0.82) / 0.06), 0.0, uTotal - uGlyphs - 1.0)
    : clamp(floor(s.a / 0.8 * uGlyphs + (r - 0.5) * 0.85), 0.0, uGlyphs - 1.0);

  if (uReveal < 1.0) {
    float k = (uReveal - r * 0.7) / 0.3;
    if (k <= 0.0) gi = 0.0;
    else if (k < 1.0 && gi > 0.0) gi = 1.0 + floor(hash(cell + floor(uTime * 22.0)) * (uGlyphs - 1.0));
  }

  vec2 local = fract(gl_FragCoord.xy / uCell);
  float coverage = texture2D(uAtlas, vec2((gi + local.x) / uTotal, 1.0 - local.y)).a;
  gl_FragColor = vec4(mix(uBg, s.rgb, coverage), 1.0);
}
`;

// Candidate glyphs; the atlas keeps them sorted by how much ink they lay down.
const CHARSET = [' ', '.', '·', ',', ':', ';', '-', '~', '=', '+', '*', 'x', 'o', 'e', '%', '#', '&', '$', '@'];
// Appended after the sorted ramp, in this order: dim, medium and bright stars.
const STARS = ['·', '+', '*'];

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function link(gl, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(program, i);
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function texture(gl, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** Draws CHARSET into a one-row atlas, ordered by measured ink coverage. */
function drawAtlas(cellW, cellH) {
  const fontPx = Math.round(cellH * 0.86);
  const font = `500 ${fontPx}px "Geist Mono", ui-monospace, Menlo, monospace`;

  const probe = document.createElement('canvas');
  probe.width = cellW;
  probe.height = cellH;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });
  probeCtx.font = font;
  probeCtx.textAlign = 'center';
  probeCtx.textBaseline = 'middle';
  probeCtx.fillStyle = '#fff';

  const measured = CHARSET.map((char) => {
    probeCtx.clearRect(0, 0, cellW, cellH);
    probeCtx.fillText(char, cellW / 2, cellH / 2 + fontPx * 0.04);
    const data = probeCtx.getImageData(0, 0, cellW, cellH).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) ink += data[i];
    return { char, ink };
  });
  measured.sort((a, b) => a.ink - b.ink);

  const glyphs = [...measured.map((m) => m.char), ...STARS];
  const atlas = document.createElement('canvas');
  atlas.width = cellW * glyphs.length;
  atlas.height = cellH;
  const ctx = atlas.getContext('2d');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  glyphs.forEach((char, i) => ctx.fillText(char, i * cellW + cellW / 2, cellH / 2 + fontPx * 0.04));
  return { canvas: atlas, count: measured.length, total: glyphs.length, order: glyphs.join('') };
}

export function createSkyRenderer(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const scene = link(gl, SCENE);
  const glyph = link(gl, GLYPH);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const sceneTex = texture(gl, gl.NEAREST);
  const atlasTex = texture(gl, gl.NEAREST);
  const fbo = gl.createFramebuffer();

  const size = { width: 1, height: 1, cols: 1, rows: 1, cellW: 8, cellH: 14, glyphs: 1, total: 1, order: '' };

  function resize(cssWidth, cssHeight, dpr) {
    const narrow = cssWidth < 700;
    const cssCellH = narrow ? 12 : 14;
    const cssCellW = narrow ? 7 : 8;
    size.cellW = Math.max(4, Math.round(cssCellW * dpr));
    size.cellH = Math.max(6, Math.round(cssCellH * dpr));
    size.width = Math.max(1, Math.round(cssWidth * dpr));
    size.height = Math.max(1, Math.round(cssHeight * dpr));
    size.cols = Math.ceil(size.width / size.cellW);
    size.rows = Math.ceil(size.height / size.cellH);
    canvas.width = size.width;
    canvas.height = size.height;

    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.cols, size.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const atlas = drawAtlas(size.cellW, size.cellH);
    size.glyphs = atlas.count;
    size.total = atlas.total;
    size.order = atlas.order;
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  }

  function render(state) {
    const { palette } = state;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, size.cols, size.rows);
    gl.useProgram(scene.program);
    const u = scene.uniforms;
    gl.uniform2f(u.uRes, size.width, size.height);
    gl.uniform2f(u.uCell, size.cellW, size.cellH);
    gl.uniform1f(u.uTime, state.time);
    gl.uniform1f(u.uHorizon, state.horizon);
    gl.uniform4fv(u.uSun, state.sun);
    gl.uniform4fv(u.uMoon, state.moon);
    gl.uniform3fv(u.uMoonLight, state.moonLight);
    gl.uniform4fv(u.uSky, state.sky);
    gl.uniform3fv(u.uMouse, state.mouse);
    gl.uniform3fv(u.uInk, palette.ink);
    gl.uniform3fv(u.uSunCore, palette.sunCore);
    gl.uniform3fv(u.uSunEdge, palette.sunEdge);
    gl.uniform3fv(u.uGlow, palette.glow);
    gl.uniform3fv(u.uSea, palette.sea);
    gl.uniform3fv(u.uMoonCol, palette.moon);
    gl.uniform3fv(u.uBg, palette.bg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, size.width, size.height);
    gl.useProgram(glyph.program);
    const g = glyph.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(g.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(g.uAtlas, 1);
    gl.uniform2f(g.uGrid, size.cols, size.rows);
    gl.uniform2f(g.uCell, size.cellW, size.cellH);
    gl.uniform1f(g.uGlyphs, size.glyphs);
    gl.uniform1f(g.uTotal, size.total);
    gl.uniform3fv(g.uBg, palette.bg);
    gl.uniform1f(g.uReveal, state.reveal);
    gl.uniform1f(g.uTime, state.time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { gl, size, resize, render };
}
