// Iaï's engine: a port of references/iai/iai.html's script, kept close to the
// original so the two stay easy to compare (which is why it stays plain
// JavaScript; ./engine.d.ts types its API). Changes, marked "Game Room:":
// - Wrapped in createEngine(root, options): elements are looked up inside
//   `root`, and every listener is tracked so destroy() leaves nothing behind.
// - English text.
// - No timer: each samurai has health (lib/games/iai/rules.ts) and the run
//   lasts until every samurai has fallen. Difficulty keeps climbing and the oni
//   returns, stronger, after each defeat.
// - The samurai walk (A/D, which turns them), jump (W), slash the way they
//   face (Space) and unleash the wolf (Shift). Enemies chase a samurai rather
//   than a fixed spot, and the field can hold more than one samurai.
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions -- a few leftovers kept as in the original */
import { AIRBORNE_Y, bossHp, damage, enemyTopSpeed, FIRST_BOSS_AT, formatSurvived, GRAVITY, HEAL_EVERY_COMBO, healOnCombo, JUMP_SPEED, MAX_HP, MOVE_SPEED, nextBossAt, postBossGap, rankFor } from '@/lib/games/iai/rules';

export function createEngine(root, options = {}) {
// Game Room: every listener goes through listen(), so destroy() can remove it.
const cleanups = [];
function listen(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}
let destroyed = false, rafId = 0;
/* =========================================================================
   CORE — math, random, noise, colour
   ========================================================================= */
const TAU = Math.PI * 2;
const PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const Ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  outBack: t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inOutSine: t => -(Math.cos(PI * t) - 1) / 2,
};
function lerpAngle(a, b, t) { const d = ((b - a + PI) % TAU + TAU) % TAU - PI; return a + d * t; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
class Rand {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  sign() { return this.f() < .5 ? -1 : 1; }
  chance(p) { return this.f() < p; }
}
const rr = (a = 0, b = 1) => a + (b - a) * Math.random();
const rsign = () => Math.random() < .5 ? -1 : 1;

class Noise {
  constructor(seed) {
    const r = mulberry32(seed >>> 0), perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }
  n(x, y) {
    const p = this.p;
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y; X &= 255; Y &= 255;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
    const g = (h, x, y) => {
      switch (h & 7) {
        case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
        case 4: return x; case 5: return -x; case 6: return y; default: return -y;
      }
    };
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    return lerp(lerp(g(aa, x, y), g(ba, x - 1, y), u), lerp(g(ab, x, y - 1), g(bb, x - 1, y - 1), u), v) * .75;
  }
  fbm(x, y, oct = 4) {
    let s = 0, a = .5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n(x * f, y * f); n += a; a *= .5; f *= 2.03; }
    return s / n;
  }
}

function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function shade(c, k) { return [c[0] + k, c[1] + k, c[2] + k]; }
function jit(c, amt, r) { const k = ((r ? r.f() : Math.random()) * 2 - 1) * amt; return [c[0] + k * .8, c[1] + k * .9, c[2] + k * 1.1]; }

/* palette pulled from the reference painting */
const C = {
  paper: hex('#ebe3cf'), paperWarm: hex('#e6dcc3'), paperDark: hex('#cfc2a3'),
  cobalt: hex('#2246c0'), cobaltDeep: hex('#172f96'), indigo: hex('#0d1a5e'), ultra: hex('#2f58d4'), sky: hex('#4c7ae8'), blueLight: hex('#6b93ee'),
  ink: hex('#0b0d1c'), inkBlue: hex('#0a1238'),
  white: hex('#f7f3ea'), cream: hex('#efe6cf'),
  gold: hex('#c9a24f'), goldLight: hex('#ead08b'), goldDark: hex('#8d6a2a'),
  grassGold: hex('#c9ad6e'), grassPale: hex('#e5d6a8'), grassDry: hex('#b39256'), grassGreen: hex('#5f8d4e'), grassGreenL: hex('#8db46a'), grassDeep: hex('#3d6136'),
  crimson: hex('#b3242c'), blood: hex('#6e0d15'), ember: hex('#ff9b3d'), amber: hex('#ffb54a'),
  skin: hex('#d6ad86'),
};

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* =========================================================================
   PAINT — procedural brush painting. Everything visual that is static is
   painted here once, stroke by stroke, at load time.
   ========================================================================= */
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

const PROF = {
  taper: t => Math.pow(Math.max(0, Math.sin(PI * t)), .6),
  press: t => t < .15 ? .3 + .7 * t / .15 : 1 - .9 * Math.pow((t - .15) / .85, 1.5),
  flame: t => t < .08 ? .4 + .6 * t / .08 : Math.pow(Math.max(0, 1 - (t - .08) / .92), 1.25),
  lift: t => 1 - .92 * t,
  even: () => 1,
};

function ribbonPoly(pts, width, prof, jitAmt, r) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const t = n > 1 ? i / (n - 1) : 0, w = width * prof(t) * .5;
    const j1 = jitAmt ? (r.f() - .5) * jitAmt : 0, j2 = jitAmt ? (r.f() - .5) * jitAmt : 0;
    L.push(p[0] - dy * (w + j1), p[1] + dx * (w + j1));
    R.push(p[0] + dy * (w + j2), p[1] - dx * (w + j2));
  }
  const out = L;
  for (let i = n - 1; i >= 0; i--) out.push(R[2 * i], R[2 * i + 1]);
  return out;
}
function fillPoly(g, a) { g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); g.closePath(); g.fill(); }
function ribbon(g, pts, width, prof, jitAmt, r) { if (pts.length < 2) return; fillPoly(g, ribbonPoly(pts, width, prof || PROF.taper, jitAmt || 0, r || { f: Math.random })); }
function flowPts(x, y, steps, step, angleFn) {
  const pts = [[x, y]];
  for (let i = 0; i < steps; i++) { const a = angleFn(x, y, i); x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); }
  return pts;
}
function quadPt(p0, c, p1, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; }
function quadTan(p0, c, p1, t) { const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]); const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }

/* A stroke with dry‑brush bristle streaks on top — used for bigger marks */
function bristle(g, pts, width, col, alpha, r, prof) {
  g.fillStyle = rgba(col, alpha);
  ribbon(g, pts, width, prof || PROF.taper, width * .18, r);
  const n = 3 + Math.floor(width / 5);
  for (let k = 0; k < n; k++) {
    const off = (r.f() - .5) * width * .8, lw = .6 + r.f() * 1.4;
    const c2 = shade(col, (r.f() - .5) * 60);
    g.fillStyle = rgba(c2, alpha * (.25 + r.f() * .35));
    const sub = [];
    const s0 = Math.floor(r.f() * pts.length * .3), s1 = pts.length - Math.floor(r.f() * pts.length * .3);
    for (let i = s0; i < s1; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
      const t = i / (pts.length - 1), w = (prof || PROF.taper)(t);
      sub.push([p[0] - dy / l * off * w, p[1] + dx / l * off * w]);
    }
    if (sub.length > 1) ribbon(g, sub, lw, PROF.taper, 0, r);
  }
}

/* -------------------------------------------------------------------------
   Tileable fabric / material patterns
   ------------------------------------------------------------------------- */
function paintPattern(kind, q) {
  const S = 256, c = mkCanvas(S * q, S * q), g = c.getContext('2d');
  g.scale(q, q); g.lineCap = 'round'; g.lineJoin = 'round';
  const seed = { robe: 11, hakama: 12, ronin: 13, shinobi: 14, armor: 15, straw: 16, oni: 17, archer: 18, lining: 19 }[kind] || 9;
  const r = new Rand(seed * 977), nz = new Noise(seed * 131);
  const offs = [[-S, -S], [0, -S], [S, -S], [-S, 0], [0, 0], [S, 0], [-S, S], [0, S], [S, S]];
  const wrapFill = (poly, style) => { g.fillStyle = style; for (const o of offs) { g.save(); g.translate(o[0], o[1]); fillPoly(g, poly); g.restore(); } };
  const strokes = (n, cols, wmin, wmax, smin, smax, step, angleFn, amin, amax, prof) => {
    for (let i = 0; i < n; i++) {
      const x = r.f() * S, y = r.f() * S;
      const pts = flowPts(x, y, r.int(smin, smax), step, angleFn);
      wrapFill(ribbonPoly(pts, r.range(wmin, wmax), prof || PROF.taper, 1, r), rgba(jit(r.pick(cols), 10, r), r.range(amin, amax)));
    }
  };
  const flower = (x, y, s, col, colD) => {
    // five-petal gold floral motif with a curling vine
    const vine = [];
    const a0 = r.f() * TAU, dir = r.sign();
    for (let i = 0; i < 22; i++) { const t = i / 21, a = a0 + dir * t * 4.2, rad = s * (1.2 + t * 3.2); vine.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]); }
    wrapFill(ribbonPoly(vine, s * .55, PROF.lift, 0, r), rgba(col, .9));
    for (let k = 0; k < 3; k++) {
      const p = vine[6 + k * 5]; const la = r.f() * TAU;
      const leaf = [[p[0], p[1]], [p[0] + Math.cos(la) * s * 1.6, p[1] + Math.sin(la) * s * 1.6], [p[0] + Math.cos(la) * s * 2.8, p[1] + Math.sin(la) * s * 2.8]];
      wrapFill(ribbonPoly(leaf, s * 1.1, PROF.taper, 0, r), rgba(col, .85));
    }
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU + a0, px = x + Math.cos(a) * s * 1.1, py = y + Math.sin(a) * s * 1.1;
      const pet = [[x, y], [px, py], [x + Math.cos(a) * s * 2.1, y + Math.sin(a) * s * 2.1]];
      wrapFill(ribbonPoly(pet, s * 1.5, PROF.taper, 0, r), rgba(col, .95));
    }
    wrapFill(ribbonPoly([[x - s * .3, y], [x + s * .3, y]], s * .9, PROF.even, 0, r), rgba(colD, 1));
  };

  if (kind === 'robe' || kind === 'hakama') {
    const deep = kind === 'hakama';
    g.fillStyle = rgba(deep ? hex('#1a3191') : hex('#2246c0')); g.fillRect(0, 0, S, S);
    const cols = deep ? ['#152a80', '#1f3aa2', '#22409f', '#0f1f66', '#2a4ab4'].map(hex) : ['#1b3aa8', '#2a52cc', '#1d3596', '#3460d8', '#14297f', '#2c56d0'].map(hex);
    strokes(deep ? 300 : 260, cols, 3, 10, 6, 14, 6, (x, y) => PI / 2 + nz.n(x * .012, y * .012) * .5, .5, .9);
    strokes(deep ? 70 : 40, ['#0b1752', '#0d1b5e'].map(hex), 1.2, 3, 12, 22, 6, (x, y) => PI / 2 + nz.n(x * .01 + 5, y * .01) * .35, .45, .75);
    // high-contrast printmaking blotches: deep ink pools and white breaks, as in the reference robe
    const cluster = (cx, cy, rad, n, cols, a0, a1, w0, w1) => {
      for (let i = 0; i < n; i++) {
        const a = r.f() * TAU, d = Math.pow(r.f(), .7) * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 1.4;
        const pts = flowPts(x, y, r.int(3, 7), 5, (px, py) => PI / 2 + nz.n(px * .012, py * .012) * .6);
        wrapFill(ribbonPoly(pts, r.range(w0, w1), PROF.taper, 1.4, r), rgba(jit(r.pick(cols), 8, r), r.range(a0, a1)));
      }
    };
    for (let k = 0; k < (deep ? 3 : 2); k++) cluster(r.f() * S, r.f() * S, r.range(22, 40), 70, [hex('#070d33'), hex('#0a1440'), hex('#0c1a52')], .75, .95, 4, 10);
    for (let k = 0; k < (deep ? 1 : 2); k++) cluster(r.f() * S, r.f() * S, r.range(14, 26), 46, [C.white, C.cream, hex('#dfe3ee')], .8, .95, 3, 8);
    const nf = deep ? 4 : 6;
    for (let i = 0; i < nf; i++) flower(r.f() * S, r.f() * S, deep ? r.range(4, 5.5) : r.range(5.5, 7.5), mixc(C.gold, C.goldLight, r.f()), C.goldDark);
    strokes(deep ? 12 : 30, [C.white, C.cream], 1.4, 4, 2, 5, 4, () => r.f() * TAU, .45, .85);
  } else if (kind === 'lining') {
    g.fillStyle = rgba(C.cream); g.fillRect(0, 0, S, S);
    strokes(160, [hex('#e4d6b4'), hex('#f3ead6'), hex('#d8c59c')], 2, 7, 4, 10, 6, (x, y) => PI / 2 + nz.n(x * .01, y * .01) * .4, .5, .9);
  } else if (kind === 'ronin' || kind === 'shinobi' || kind === 'archer') {
    const base = kind === 'ronin' ? hex('#2b2f3d') : kind === 'shinobi' ? hex('#121319') : hex('#1f3436');
    g.fillStyle = rgba(base); g.fillRect(0, 0, S, S);
    const cols = kind === 'ronin' ? ['#3a3f52', '#22242e', '#454b60', '#2e3346', '#1a1c25'].map(hex) : kind === 'shinobi' ? ['#1d1f28', '#0a0a0f', '#23252f', '#16171e'].map(hex) : ['#2a4547', '#16272a', '#33534f', '#1b2e31'].map(hex);
    strokes(320, cols, 3, 11, 5, 13, 6, (x, y) => PI / 2 + nz.n(x * .014, y * .014) * .7, .55, .95);
    strokes(50, [hex('#0a0b10')], 1, 2.5, 10, 20, 6, (x, y) => PI / 2 + nz.n(x * .01 + 9, y * .01) * .4, .4, .7);
    if (kind === 'ronin') strokes(14, [hex('#5b6077'), hex('#8a8fa3')], .8, 2, 2, 5, 4, () => r.f() * TAU, .3, .55);
  } else if (kind === 'armor') {
    g.fillStyle = '#141419'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) {
      g.fillStyle = '#25252f'; g.fillRect(0, y, S, 3);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y + 3, S, 2);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, y + 14, S, 2);
      for (let x = (y / 16 % 2) * 8; x < S; x += 16) {
        g.strokeStyle = 'rgba(160,32,40,.85)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - 4, y + 2); g.lineTo(x + 4, y + 13); g.moveTo(x + 4, y + 2); g.lineTo(x - 4, y + 13); g.stroke();
        g.fillStyle = 'rgba(205,165,80,.9)'; g.beginPath(); g.arc(x, y + 7.5, 1.4, 0, TAU); g.fill();
      }
    }
    strokes(60, [hex('#2b2b38'), hex('#0b0b0e')], 1, 3, 4, 10, 6, () => 0, .25, .5);
  } else if (kind === 'straw') {
    g.fillStyle = '#c3a265'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = r.f() * S, y = r.f() * S, a = PI / 2 + (r.f() - .5) * .35, l = r.range(10, 34);
      g.strokeStyle = rgba(jit(r.pick([hex('#a68246'), hex('#dbc089'), hex('#8c6a35'), hex('#cfb173')]), 12, r), r.range(.4, .9));
      g.lineWidth = r.range(.6, 1.6);
      for (const o of offs) { g.beginPath(); g.moveTo(x + o[0], y + o[1]); g.lineTo(x + o[0] + Math.cos(a) * l, y + o[1] + Math.sin(a) * l); g.stroke(); }
    }
  } else if (kind === 'oni') {
    g.fillStyle = '#9e1f2a'; g.fillRect(0, 0, S, S);
    strokes(280, ['#b3242c', '#8a1822', '#c5343a', '#7a121c', '#a8262f'].map(hex), 3, 11, 5, 12, 6, (x, y) => .3 + nz.n(x * .012, y * .012) * .6, .55, .95);
    for (let k = 0; k < 6; k++) {
      const y0 = k * S / 6 + r.f() * 10;
      const pts = []; for (let i = 0; i < 18; i++) { const x = i * S / 16 - 10; pts.push([x, y0 + Math.sin(i * .9 + k) * 8 + i * 3]); }
      wrapFill(ribbonPoly(pts, r.range(5, 9), PROF.taper, 2, r), 'rgba(28,4,8,.85)');
    }
  }
  return c;
}

/* -------------------------------------------------------------------------
   Swirling cloud masses — flow-field brushwork (the signature of the piece)
   ------------------------------------------------------------------------- */
function paintCloud(spec, q) {
  const W = spec.w, H = spec.h;
  const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q);
  const r = new Rand(spec.seed), n1 = new Noise(spec.seed + 11), n2 = new Noise(spec.seed + 23), n3 = new Noise(spec.seed + 37), n4 = new Noise(spec.seed + 51);
  const fadeEdge = spec.edge || 70;
  const dens = (x, y) => {
    let d = -1;
    for (const b of spec.blobs) { const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry; d = Math.max(d, 1 - Math.sqrt(dx * dx + dy * dy)); }
    const bx = Math.min(x, W - x) / fadeEdge, by = Math.min(y, H - y) / fadeEdge;
    return d + n1.fbm(x * .0065, y * .0065, 4) * (spec.rough || .75) - (1 - clamp(Math.min(bx, by), 0, 1)) * 1.2;
  };
  const flow = (x, y) => {
    let a = spec.dir + n2.fbm(x * .0032 + 3.1, y * .0032 - 1.7, 3) * 2.4;
    for (const v of spec.swirls) {
      const dx = x - v.x, dy = y - v.y, k = Math.exp(-(dx * dx + dy * dy) / (v.r * v.r));
      a = lerpAngle(a, Math.atan2(dy, dx) + v.s * (PI * .5 + .32), k * .93);
    }
    return a;
  };
  const blues = (spec.blues || ['#1b3aa8', '#2246c0', '#2a50cc', '#18308f', '#2f58d4', '#2148bd', '#1d3aa6']).map(hex);
  const lights = [hex('#4f78e3'), hex('#5d84ea'), hex('#6b90ef'), hex('#3e68dc')];
  const whites = [hex('#f8f5ec'), hex('#efe8d6'), hex('#fbfaf5'), hex('#ece9e2')];
  const golds = [C.gold, C.goldLight, C.goldDark, hex('#d8b46a')];
  const area = W * H, dm = spec.dm || 1, sz = spec.size || 1;
  const ws = spec.white == null ? 1 : spec.white;
  // A — blue body, thick impasto dabs following the flow
  let N = Math.floor(area / 30 * dm);
  for (let i = 0; i < N; i++) {
    const x = r.f() * W, y = r.f() * H, d = dens(x, y);
    if (d < .14) continue;
    const e = smoothstep(.14, .55, d);
    const lt = r.f() < .14 * (1 - e * .5);
    g.fillStyle = rgba(jit(lt ? r.pick(lights) : r.pick(blues), 14, r), .8 + .2 * e);
    ribbon(g, flowPts(x, y, 2 + Math.floor(r.f() * (3 + 9 * e)), 4.4 * sz, flow), (5 + r.f() * (7 + 8 * e)) * sz, PROF.taper, 2.6 * sz, r);
  }
  // B — deep indigo pockets
  N = Math.floor(area / 120 * dm);
  for (let i = 0; i < N; i++) {
    const x = r.f() * W, y = r.f() * H, d = dens(x, y);
    if (d < .38 || n4.fbm(x * .008, y * .008, 3) < .02) continue;
    g.fillStyle = rgba(jit(r.pick([hex('#0f1f6e'), hex('#132a85'), hex('#0b1755')]), 10, r), r.range(.5, .85));
    ribbon(g, flowPts(x, y, r.int(4, 11), 4 * sz, flow), r.range(3, 9) * sz, PROF.taper, 1.5, r);
  }
  // C — white swirl rivers (ridges of a noise field) + D — white rims, each with a cool shadow under it
  const goldSeeds = [];
  N = Math.floor(area / 22 * dm);
  for (let i = 0; i < N; i++) {
    const x = r.f() * W, y = r.f() * H, d = dens(x, y);
    if (d < .02) continue;
    const rg = Math.abs(n3.fbm(x * .0046, y * .0046, 3));
    const th = (.026 + .026 * smoothstep(0, .6, d)) * ws;
    const rim = d < .16 && n4.fbm(x * .006 + 4, y * .006, 3) > .2 / ws;
    if (rg > th && !rim) continue;
    const pts = flowPts(x, y, r.int(rim ? 2 : 4, rim ? 6 : 13), 4 * sz, flow);
    const w = r.range(rim ? 5 : 4, rim ? 12 : 11) * sz;
    if (r.f() < .5) { g.fillStyle = rgba(hex('#8ea3d8'), .35); ribbon(g, pts.map(p => [p[0] + 1.5 * sz, p[1] + 2.5 * sz]), w * 1.05, PROF.taper, 1, r); }
    g.fillStyle = rgba(r.pick(whites), r.range(.86, .98));
    ribbon(g, pts, w, PROF.taper, 2 * sz, r);
    if (r.f() < .1) goldSeeds.push(pts[pts.length - 1]);
  }
  // E — gold leaf flecks clinging to the white rivers
  for (const p of goldSeeds) {
    const k = r.int(1, 3);
    for (let j = 0; j < k; j++) {
      const x = p[0] + r.range(-10, 10), y = p[1] + r.range(-8, 8);
      g.fillStyle = rgba(jit(r.pick(golds), 14, r), r.range(.75, 1));
      ribbon(g, flowPts(x, y, r.int(1, 4), 3 * sz, flow), r.range(1.4, 4) * sz, PROF.taper, .8, r);
    }
  }
  // F — fine dark ink definition lines
  N = Math.floor(area / 900 * dm);
  for (let i = 0; i < N; i++) {
    const x = r.f() * W, y = r.f() * H, d = dens(x, y);
    if (d < .5) continue;
    g.fillStyle = rgba(hex('#0a1340'), r.range(.25, .5));
    ribbon(g, flowPts(x, y, r.int(6, 14), 4 * sz, flow), r.range(.8, 1.8) * sz, PROF.taper, 0, r);
  }
  return c;
}

const CLOUD_SPECS = [
  { w: 1150, h: 640, seed: 101, dir: .1, blobs: [{ x: 300, y: 340, rx: 250, ry: 210 }, { x: 600, y: 290, rx: 330, ry: 200 }, { x: 900, y: 360, rx: 210, ry: 175 }], swirls: [{ x: 320, y: 330, r: 210, s: 1 }, { x: 760, y: 300, r: 190, s: -1 }] },
  { w: 1300, h: 440, seed: 202, dir: -.05, blobs: [{ x: 250, y: 230, rx: 200, ry: 120 }, { x: 560, y: 210, rx: 260, ry: 130 }, { x: 880, y: 240, rx: 240, ry: 120 }, { x: 1100, y: 220, rx: 150, ry: 100 }], swirls: [{ x: 420, y: 220, r: 160, s: -1 }, { x: 900, y: 230, r: 150, s: 1 }] },
  { w: 760, h: 520, seed: 303, dir: .4, blobs: [{ x: 300, y: 270, rx: 220, ry: 170 }, { x: 500, y: 250, rx: 190, ry: 150 }], swirls: [{ x: 380, y: 260, r: 200, s: 1 }] },
  { w: 560, h: 360, seed: 404, dir: -.3, blobs: [{ x: 220, y: 190, rx: 170, ry: 110 }, { x: 360, y: 170, rx: 140, ry: 100 }], swirls: [{ x: 290, y: 180, r: 140, s: -1 }] },
  { w: 980, h: 300, seed: 505, dir: 0, rough: .9, blobs: [{ x: 240, y: 150, rx: 210, ry: 70 }, { x: 520, y: 150, rx: 260, ry: 80 }, { x: 780, y: 150, rx: 170, ry: 60 }], swirls: [{ x: 520, y: 150, r: 130, s: 1 }] },
];

function paintFlameDabs(q) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const w = 150, h = 110;
    out.push(paintCloud({ w, h, seed: 900 + i * 17, dir: PI + (i % 2 ? .3 : -.2), edge: 26, rough: .8, size: .75, dm: 1.4,
      blobs: [{ x: 75, y: 55, rx: 50 + (i % 3) * 6, ry: 34 }], swirls: [{ x: 70 + (i % 3) * 8, y: 55, r: 38, s: i % 2 ? 1 : -1 }] }, q));
  }
  return out;
}

/* -------------------------------------------------------------------------
   The blue wolf spirit — head in profile, flame mane, painted fur
   ------------------------------------------------------------------------- */
function paintWolf(q) {
  const W = 800, H = 480, OX = 170;
  const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q); g.lineCap = 'round'; g.lineJoin = 'round';
  const r = new Rand(4242), nz = new Noise(4243), nz2 = new Noise(4244);
  const X = x => x + OX;
  const head = new Path2D();
  head.moveTo(X(602), 203);
  head.quadraticCurveTo(X(578), 176, X(540), 168);
  head.quadraticCurveTo(X(505), 160, X(474), 146);
  head.quadraticCurveTo(X(452), 132, X(432), 112);
  head.quadraticCurveTo(X(420), 70, X(398), 20);
  head.quadraticCurveTo(X(372), 62, X(352), 104);
  head.quadraticCurveTo(X(326), 112, X(300), 138);
  head.bezierCurveTo(X(270), 175, X(262), 300, X(322), 352);
  head.quadraticCurveTo(X(342), 362, X(362), 352);
  head.quadraticCurveTo(X(440), 374, X(520), 338);
  head.quadraticCurveTo(X(548), 326, X(552), 304);
  head.quadraticCurveTo(X(505), 292, X(430), 266);
  head.quadraticCurveTo(X(512), 252, X(594), 232);
  head.quadraticCurveTo(X(610), 220, X(602), 203);
  head.closePath();

  const blues = ['#1b3aa8', '#2448c2', '#2f58d4', '#1a2f8f', '#3a63dc', '#2550c9'].map(hex);
  // --- flame mane: a cloud mass streaming back from the skull
  const mane = paintCloud({ w: 560, h: 480, seed: 4250, dir: PI - .12, edge: 36, rough: .7, dm: 1.15, white: 1.15,
    blobs: [{ x: 420, y: 190, rx: 170, ry: 175 }, { x: 290, y: 240, rx: 190, ry: 140 }, { x: 140, y: 220, rx: 130, ry: 95 }, { x: 360, y: 370, rx: 140, ry: 85 }],
    swirls: [{ x: 300, y: 180, r: 120, s: -1 }, { x: 170, y: 280, r: 95, s: 1 }, { x: 420, y: 330, r: 80, s: -1 }] }, q);
  g.drawImage(mane, 0, 0, mane.width, mane.height, 10, 0, 560, 480);

  // --- mouth interior (behind lips)
  const C0 = [X(430), 266], UC = [X(512), 252], UF = [X(594), 232], LF = [X(552), 304], LC = [X(505), 292];
  const mouth = new Path2D();
  mouth.moveTo(C0[0], C0[1]); mouth.quadraticCurveTo(UC[0], UC[1], UF[0], UF[1]);
  mouth.lineTo(LF[0], LF[1]); mouth.quadraticCurveTo(LC[0], LC[1], C0[0], C0[1]); mouth.closePath();
  let gr = g.createLinearGradient(X(430), 240, X(590), 300);
  gr.addColorStop(0, '#05081f'); gr.addColorStop(.6, '#0d0b2c'); gr.addColorStop(1, '#2a0c2a');
  g.fillStyle = gr; g.fill(mouth);
  g.fillStyle = 'rgba(110,20,45,.85)';
  g.beginPath(); g.ellipse(X(505), 286, 46, 9, -.18, 0, TAU); g.fill();

  // --- head base
  gr = g.createLinearGradient(X(560), 120, X(320), 360);
  gr.addColorStop(0, '#3561da'); gr.addColorStop(.5, '#2347c0'); gr.addColorStop(1, '#13287e');
  g.fillStyle = gr; g.fill(head);

  // --- painted fur, clipped to the head
  g.save(); g.clip(head);
  const furA = (x, y) => Math.atan2(y - 222, x - X(670)) + nz2.fbm(x * .01, y * .01, 2) * .5;
  for (let i = 0; i < 6200; i++) {
    const x = X(r.range(255, 612)), y = r.range(15, 378);
    if (!g.isPointInPath(head, x * q, y * q)) continue;
    const lt = 1 - clamp(Math.hypot(x - X(470), y - 150) / 250, 0, 1);
    const sh = smoothstep(285, 365, y) * .8 + (x < X(330) ? .35 : 0) + smoothstep(170, 200, y) * smoothstep(X(500), X(440), x) * .15;
    let col = r.pick(blues);
    col = mixc(col, hex('#7fa0f2'), lt * .45);
    col = mixc(col, hex('#0b1755'), clamp(sh, 0, .85));
    g.fillStyle = rgba(jit(col, 14, r), r.range(.7, .95));
    ribbon(g, flowPts(x, y, r.int(2, 6), 5, furA), r.range(2.5, 6.5), PROF.taper, 1, r);
  }
  // highlight strokes along bridge, brow and cheek
  const hl = (p0, c0, p1, n, off0, off1, wmin, wmax) => {
    for (let i = 0; i < n; i++) {
      const t = r.f(), p = quadPt(p0, c0, p1, t), o = r.range(off0, off1);
      const x = p[0], y = p[1] + o;
      g.fillStyle = rgba(r.pick([C.white, hex('#dfe7fb'), hex('#b9cbf6')]), r.range(.65, .95));
      ribbon(g, flowPts(x, y, r.int(2, 5), 4.5, furA), r.range(wmin, wmax), PROF.taper, .8, r);
    }
  };
  hl([X(600), 200], [X(560), 168], [X(474), 150], 110, 3, 16, 1.6, 4.2);
  hl([X(474), 150], [X(452), 130], [X(432), 114], 40, 3, 12, 1.4, 3.4);
  hl([X(590), 232], [X(510), 250], [X(440), 262], 90, -18, -4, 1.4, 3.8);
  hl([X(500), 150], [X(475), 145], [X(445), 155], 40, 2, 9, 1.4, 3);
  hl([X(395), 30], [X(410), 70], [X(425), 108], 30, 0, 8, 1.2, 3);
  // dark accents
  for (let i = 0; i < 260; i++) {
    const x = X(r.range(270, 560)), y = r.range(200, 375);
    if (!g.isPointInPath(head, x * q, y * q) || r.f() > smoothstep(240, 360, y) + .1) continue;
    g.fillStyle = rgba(hex('#0a1346'), r.range(.4, .75));
    ribbon(g, flowPts(x, y, r.int(3, 7), 5, furA), r.range(1.5, 4), PROF.taper, .8, r);
  }
  // snarl wrinkles on the bridge
  g.fillStyle = 'rgba(8,16,60,.85)';
  for (let k = 0; k < 4; k++) {
    const x0 = X(512 + k * 14), y0 = 186 + k * 2;
    ribbon(g, [[x0, y0], [x0 + 8, y0 - 9], [x0 + 18, y0 - 13]], 3.4 - k * .4, PROF.taper, .4, r);
  }
  // under-brow shadow
  g.fillStyle = 'rgba(8,16,70,.6)';
  g.beginPath(); g.ellipse(X(482), 168, 34, 12, -.12, 0, TAU); g.fill();
  // inner ear
  g.fillStyle = 'rgba(6,12,52,.9)';
  g.beginPath(); g.moveTo(X(400), 44); g.quadraticCurveTo(X(408), 80, X(420), 108); g.quadraticCurveTo(X(392), 100, X(372), 104); g.quadraticCurveTo(X(384), 72, X(400), 44); g.fill();
  for (let i = 0; i < 26; i++) {
    const p = quadPt([X(398), 34], [X(410), 72], [X(424), 106], r.f());
    g.fillStyle = rgba(r.pick([C.white, hex('#c9d6f7')]), .85);
    ribbon(g, [[p[0], p[1]], [p[0] - 7, p[1] + 5], [p[0] - 12, p[1] + 11]], r.range(1.5, 3), PROF.taper, .4, r);
  }
  g.restore();

  // --- teeth
  const tooth = (b, tan, dir, len, w) => {
    g.beginPath();
    g.moveTo(b[0] - tan[0] * w / 2, b[1] - tan[1] * w / 2);
    g.quadraticCurveTo(b[0] + dir[0] * len * .6 - tan[0] * w * .2, b[1] + dir[1] * len * .6 - tan[1] * w * .2, b[0] + dir[0] * len, b[1] + dir[1] * len);
    g.quadraticCurveTo(b[0] + dir[0] * len * .5 + tan[0] * w * .3, b[1] + dir[1] * len * .5 + tan[1] * w * .3, b[0] + tan[0] * w / 2, b[1] + tan[1] * w / 2);
    g.closePath();
    const tg = g.createLinearGradient(b[0], b[1], b[0] + dir[0] * len, b[1] + dir[1] * len);
    tg.addColorStop(0, '#c9c4b8'); tg.addColorStop(.35, '#f6f2e8'); tg.addColorStop(1, '#ffffff');
    g.fillStyle = tg; g.fill();
    g.strokeStyle = 'rgba(10,14,40,.55)'; g.lineWidth = 1; g.stroke();
  };
  for (let t = .2; t < .97; t += .07) {
    const b = quadPt(C0, UC, UF, t), tan = quadTan(C0, UC, UF, t);
    const can = Math.abs(t - .81) < .035;
    const d = [-.18, 1], l = Math.hypot(d[0], d[1]);
    tooth(b, tan, [d[0] / l, d[1] / l], can ? 36 : r.range(7, 11), can ? 12 : r.range(5, 7));
  }
  for (let t = .04; t < .82; t += .075) {
    const b = quadPt(LF, LC, C0, t), tan = quadTan(LF, LC, C0, t);
    const can = Math.abs(t - .12) < .04;
    const d = [.12, -1], l = Math.hypot(d[0], d[1]);
    tooth(b, tan, [d[0] / l, d[1] / l], can ? 30 : r.range(6, 10), can ? 11 : r.range(5, 7));
  }

  // --- eye (amber, angry)
  const eye = new Path2D();
  eye.moveTo(X(456), 186); eye.quadraticCurveTo(X(474), 166, X(502), 168); eye.quadraticCurveTo(X(488), 190, X(456), 186); eye.closePath();
  gr = g.createRadialGradient(X(480), 177, 1, X(480), 177, 24);
  gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.35, '#ffc23d'); gr.addColorStop(.8, '#e06a12'); gr.addColorStop(1, '#8a2a06');
  g.fillStyle = gr; g.fill(eye);
  g.fillStyle = '#05050c'; g.beginPath(); g.ellipse(X(482), 177, 2.6, 8.5, .25, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(X(477), 173, 1.8, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(6,10,40,.95)'; g.lineWidth = 2.4; g.stroke(eye);
  // heavy brow
  g.fillStyle = 'rgba(6,12,50,.92)';
  ribbon(g, [[X(444), 166], [X(468), 157], [X(494), 158], [X(520), 170]], 7, PROF.taper, 1, r);
  g.fillStyle = 'rgba(230,236,252,.75)';
  ribbon(g, [[X(450), 156], [X(474), 149], [X(500), 151]], 2.6, PROF.taper, .5, r);

  // --- nose
  g.fillStyle = '#070b26'; g.beginPath(); g.ellipse(X(588), 199, 17, 12, -.3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(200,215,255,.55)'; g.beginPath(); g.ellipse(X(583), 193, 6, 3, -.4, 0, TAU); g.fill();

  // --- fur breaking the silhouette along the brow, ear and skull
  const edge = (p0, c0, p1, n, a0, len) => {
    for (let i = 0; i < n; i++) {
      const p = quadPt(p0, c0, p1, r.f()), a = a0 + r.range(-.35, .35);
      const pts = flowPts(p[0] + r.range(-3, 3), p[1] + r.range(0, 5), r.int(2, len), 4.5, (x, y, k) => a + k * .06);
      g.fillStyle = rgba(r.f() < .3 ? r.pick([C.white, hex('#c9d6f7')]) : jit(r.pick(blues), 12, r), .92);
      ribbon(g, pts, r.range(3, 7), PROF.flame, .8, r);
    }
  };
  edge([X(474), 146], [X(452), 130], [X(432), 112], 30, -PI * .8, 5);
  edge([X(352), 104], [X(326), 112], [X(300), 138], 40, -PI * .82, 7);
  edge([X(300), 138], [X(262), 240], [X(322), 352], 70, PI * .95, 8);
  edge([X(398), 22], [X(372), 62], [X(352), 104], 30, -PI * .9, 5);
  // --- ink contour only where the form needs it: snout, lips, jaw
  const front = new Path2D();
  front.moveTo(X(474), 146); front.quadraticCurveTo(X(505), 160, X(540), 168); front.quadraticCurveTo(X(578), 176, X(602), 203);
  front.quadraticCurveTo(X(610), 220, X(594), 232);
  front.moveTo(X(552), 304); front.quadraticCurveTo(X(548), 326, X(520), 338); front.quadraticCurveTo(X(440), 374, X(362), 352);
  g.strokeStyle = 'rgba(6,12,46,.82)'; g.lineWidth = 3; g.stroke(front);
  g.strokeStyle = 'rgba(6,12,46,.7)'; g.lineWidth = 2.2; g.stroke(mouth);

  // --- mane curling back over the nape (soft-masked so there is no seam)
  const ov = mkCanvas(W * q, H * q), og = ov.getContext('2d');
  og.drawImage(mane, 0, 0, mane.width, mane.height, 10 * q, 0, 560 * q, 480 * q);
  og.globalCompositeOperation = 'destination-in';
  let mg = og.createLinearGradient(X(282) * q, 0, X(336) * q, 0);
  mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  og.fillStyle = mg; og.fillRect(0, 0, W * q, H * q);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ov, 0, 0); g.restore();
  // ruff tufts spilling from cheek and jaw
  for (let k = 0; k < 80; k++) {
    const p = quadPt([X(292), 300], [X(360), 392], [X(480), 352], r.f());
    const a0 = PI * .78 + r.range(-.35, .3);
    const pts = flowPts(p[0] + r.range(-6, 6), p[1] + r.range(-10, 4), r.int(4, 9), 5, (x, y, i) => a0 + i * .05);
    g.fillStyle = rgba(jit(r.pick(blues), 14, r), .92);
    ribbon(g, pts, r.range(6, 12), PROF.flame, 1.2, r);
    if (r.f() < .35) { g.fillStyle = rgba(C.white, .85); ribbon(g, pts.slice(Math.floor(pts.length / 2)), r.range(2, 5), PROF.lift, .6, r); }
  }

  // --- fade the trailing mane into nothing
  g.globalCompositeOperation = 'destination-in';
  gr = g.createLinearGradient(0, 0, 150, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return { canvas: c, w: W, h: H, eye: [X(480), 177], mouth: [X(540), 275], nose: [X(600), 205] };
}

/* -------------------------------------------------------------------------
   The Oni — giant crimson demon face, kintsugi-ready
   ------------------------------------------------------------------------- */
function paintOni(q) {
  const W = 960, H = 820, cx = 360, OXo = 120, OYo = 60;
  const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q); g.translate(OXo, OYo); g.lineCap = 'round'; g.lineJoin = 'round';
  const r = new Rand(6611), nz = new Noise(6612);
  // wild ink hair
  for (let k = 0; k < 420; k++) {
    const a = r.range(-PI * 1.08, .08), rad = r.range(170, 230);
    const x0 = cx + Math.cos(a) * rad * 1.05, y0 = 340 + Math.sin(a) * rad * 1.1;
    const wob = r.range(-.4, .4);
    const pts = flowPts(x0, y0, r.int(18, 40), 6, (x, y, i) => a + Math.sin(i * .25 + wob * 8) * .35 + nz.n(x * .01, y * .01) * .5);
    const col = r.f() < .08 ? hex('#3a3f55') : r.f() < .05 ? hex('#efe8d8') : hex('#07070b');
    g.fillStyle = rgba(jit(col, 8, r), r.range(.7, .95));
    ribbon(g, pts, r.range(5, 14), PROF.flame, 1.4, r);
  }
  for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 60; k++) {
    const x0 = cx + s * r.range(150, 210), y0 = r.range(330, 520);
    const pts = flowPts(x0, y0, r.int(14, 30), 6, (x, y, i) => PI / 2 + s * (-.6 + i * .02) + nz.n(x * .01, y * .01) * .4);
    g.fillStyle = rgba(hex('#08080d'), r.range(.7, .95));
    ribbon(g, pts, r.range(5, 12), PROF.flame, 1.2, r);
  }
  // horns
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([cx + s * (78 + t * 150 + Math.sin(t * PI) * 20), 150 - t * 140 + Math.pow(t, 2.2) * 30]); }
    const hg = g.createLinearGradient(cx, 150, cx + s * 230, 10);
    hg.addColorStop(0, '#8c6624'); hg.addColorStop(.4, '#e6c675'); hg.addColorStop(.75, '#c49a45'); hg.addColorStop(1, '#fff1c2');
    g.fillStyle = hg; ribbon(g, pts, 44, t => 1 - t * .92, 0, r);
    g.strokeStyle = 'rgba(60,35,8,.6)'; g.lineWidth = 2;
    for (let i = 2; i < 18; i += 3) { const p = pts[i], w = 20 * (1 - i / 24 * .92); g.beginPath(); g.moveTo(p[0] - 4 * s, p[1] - w); g.quadraticCurveTo(p[0] + 6 * s, p[1], p[0] - 4 * s, p[1] + w); g.stroke(); }
  }
  // face shape
  const face = new Path2D();
  face.moveTo(cx, 108);
  face.bezierCurveTo(cx + 82, 106, cx + 132, 140, cx + 142, 200);
  face.bezierCurveTo(cx + 154, 252, cx + 172, 300, cx + 156, 352);
  face.bezierCurveTo(cx + 146, 412, cx + 120, 470, cx + 70, 516);
  face.bezierCurveTo(cx + 44, 540, cx + 24, 552, cx, 552);
  face.bezierCurveTo(cx - 24, 552, cx - 44, 540, cx - 70, 516);
  face.bezierCurveTo(cx - 120, 470, cx - 146, 412, cx - 156, 352);
  face.bezierCurveTo(cx - 172, 300, cx - 154, 252, cx - 142, 200);
  face.bezierCurveTo(cx - 132, 140, cx - 82, 106, cx, 108);
  face.closePath();
  let gr = g.createRadialGradient(cx, 260, 40, cx, 340, 260);
  gr.addColorStop(0, '#d03a3a'); gr.addColorStop(.6, '#a51f2a'); gr.addColorStop(1, '#5c0c14');
  g.fillStyle = gr; g.fill(face);
  g.save(); g.clip(face);
  const fa = (x, y) => Math.atan2(y - 330, x - cx) + PI / 2 + nz.fbm(x * .008, y * .008, 2) * .7;
  for (let i = 0; i < 5200; i++) {
    const x = r.range(cx - 175, cx + 175), y = r.range(100, 560);
    if (!g.isPointInPath(face, x * q, y * q)) continue;
    const lt = 1 - clamp(Math.hypot(x - cx, y - 200) / 220, 0, 1) + (Math.abs(Math.abs(x - cx) - 100) < 40 && y > 290 && y < 360 ? .35 : 0);
    const dk = smoothstep(150, 175, Math.hypot((x - cx) * .9, (y - 330) * .7)) + smoothstep(430, 550, y) * .5;
    let col = r.pick(['#b3242c', '#9a1b26', '#c4333a', '#a3202b'].map(hex));
    col = mixc(col, hex('#f07a5a'), clamp(lt, 0, 1) * .45);
    col = mixc(col, hex('#3d070e'), clamp(dk, 0, .85));
    g.fillStyle = rgba(jit(col, 14, r), r.range(.7, .95));
    ribbon(g, flowPts(x, y, r.int(2, 6), 5, fa), r.range(3, 8), PROF.taper, 1, r);
  }
  // creases (furrowed forehead, cheeks)
  g.fillStyle = 'rgba(50,5,12,.8)';
  for (let k = 0; k < 4; k++) ribbon(g, [[cx - 60 + k * 6, 150 + k * 12], [cx, 168 + k * 14], [cx + 60 - k * 6, 150 + k * 12]], 4 - k * .5, PROF.taper, 1, r);
  for (const s of [-1, 1]) {
    ribbon(g, [[cx + s * 40, 330], [cx + s * 70, 380], [cx + s * 110, 400]], 6, PROF.taper, 1, r);
    ribbon(g, [[cx + s * 120, 300], [cx + s * 130, 360], [cx + s * 118, 430]], 5, PROF.taper, 1, r);
  }
  // gold lacquer ornament on the brow
  g.fillStyle = 'rgba(220,182,96,.9)';
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i < 26; i++) { const t = i / 25, a = t * 4.5; pts.push([cx + s * (18 + t * 40 + Math.cos(a) * 10), 132 + t * 16 + Math.sin(a) * 10]); }
    ribbon(g, pts, 3.4, PROF.lift, .4, r);
  }
  g.restore();
  // brows
  for (const s of [-1, 1]) {
    const pts = [[cx + s * 14, 236], [cx + s * 50, 214], [cx + s * 96, 196], [cx + s * 132, 204]];
    g.fillStyle = 'rgba(16,4,8,.95)'; ribbon(g, pts, 30, t => .5 + .5 * Math.sin(PI * t) + (1 - t) * .3, 2, r);
    g.fillStyle = 'rgba(255,214,150,.4)'; ribbon(g, pts.map(p => [p[0], p[1] - 12]), 4, PROF.taper, .6, r);
  }
  // eyes
  for (const s of [-1, 1]) {
    const ex = cx + s * 72, ey = 262;
    g.fillStyle = 'rgba(30,2,6,.9)'; g.beginPath(); g.ellipse(ex, ey + 4, 54, 30, s * .18, 0, TAU); g.fill();
    const eye = new Path2D();
    eye.moveTo(ex - s * 44, ey + 6); eye.quadraticCurveTo(ex, ey - 26, ex + s * 44, ey - 10); eye.quadraticCurveTo(ex + s * 6, ey + 24, ex - s * 44, ey + 6); eye.closePath();
    const eg = g.createRadialGradient(ex, ey, 2, ex, ey, 40);
    eg.addColorStop(0, '#fff6c8'); eg.addColorStop(.4, '#ffd257'); eg.addColorStop(.85, '#d27a1a'); eg.addColorStop(1, '#6e2a05');
    g.fillStyle = eg; g.fill(eye);
    g.fillStyle = '#080306'; g.beginPath(); g.arc(ex + s * 4, ey - 2, 7, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + s * 1, ey - 6, 2.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(20,2,4,.95)'; g.lineWidth = 3.5; g.stroke(eye);
  }
  // nose
  g.fillStyle = 'rgba(70,8,14,.9)';
  ribbon(g, [[cx - 6, 250], [cx - 10, 300], [cx - 30, 352]], 5, PROF.taper, 1, r);
  for (const s of [-1, 1]) { g.fillStyle = 'rgba(20,2,5,.95)'; g.beginPath(); g.ellipse(cx + s * 24, 356, 14, 9, s * .4, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(240,120,90,.6)'; g.beginPath(); g.ellipse(cx, 330, 18, 10, 0, 0, TAU); g.fill();
  // mouth
  const m = new Path2D();
  m.moveTo(cx - 118, 404); m.quadraticCurveTo(cx - 50, 380, cx, 392); m.quadraticCurveTo(cx + 50, 380, cx + 118, 404);
  m.quadraticCurveTo(cx + 90, 470, cx + 50, 492); m.quadraticCurveTo(cx, 512, cx - 50, 492); m.quadraticCurveTo(cx - 90, 470, cx - 118, 404); m.closePath();
  gr = g.createLinearGradient(cx, 390, cx, 510); gr.addColorStop(0, '#1a0306'); gr.addColorStop(1, '#3e0610');
  g.fillStyle = gr; g.fill(m);
  g.fillStyle = 'rgba(150,30,50,.8)'; g.beginPath(); g.ellipse(cx, 478, 52, 16, 0, 0, TAU); g.fill();
  const fang = (bx, by, tx, ty, w) => {
    g.beginPath(); g.moveTo(bx - w / 2, by); g.quadraticCurveTo((bx + tx) / 2 - w * .2, (by + ty) / 2, tx, ty); g.quadraticCurveTo((bx + tx) / 2 + w * .3, (by + ty) / 2, bx + w / 2, by); g.closePath();
    const tg = g.createLinearGradient(bx, by, tx, ty); tg.addColorStop(0, '#cfc6b2'); tg.addColorStop(.4, '#f7f1e3'); tg.addColorStop(1, '#fff');
    g.fillStyle = tg; g.fill(); g.strokeStyle = 'rgba(30,4,8,.7)'; g.lineWidth = 1.6; g.stroke();
  };
  for (let i = -4; i <= 4; i++) fang(cx + i * 22, 392 + Math.abs(i) * 2, cx + i * 22 + i * .6, 410 + Math.abs(i) * 2, 18);
  fang(cx - 74, 404, cx - 70, 448, 16); fang(cx + 74, 404, cx + 70, 448, 16);
  fang(cx - 64, 494, cx - 72, 392, 26); fang(cx + 64, 494, cx + 72, 392, 26);
  g.strokeStyle = 'rgba(25,2,6,.9)'; g.lineWidth = 4; g.stroke(m);
  g.strokeStyle = 'rgba(25,2,6,.85)'; g.lineWidth = 4; g.stroke(face);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const fg = g.createRadialGradient(W * q / 2, H * q * .48, Math.min(W, H) * q * .3, W * q / 2, H * q * .48, Math.min(W, H) * q * .52);
  fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fg; g.fillRect(0, 0, W * q, H * q);
  g.globalCompositeOperation = 'source-over';
  return { canvas: c, w: W, h: H, eyes: [[cx - 72 + OXo, 262 + OYo], [cx + 72 + OXo, 262 + OYo]], cx: cx + OXo, cy: 330 + OYo };
}

/* -------------------------------------------------------------------------
   Landscape: ink-wash ridges and the meadow floor
   ------------------------------------------------------------------------- */
function paintRidge(q, o) {
  const W = 2800, top = o.top, bot = o.bot, H = bot - top;
  const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q); g.translate(W / 2, -top);
  const r = new Rand(o.seed), nz = new Noise(o.seed + 1);
  const ridge = x => o.base - Math.abs(nz.fbm(x * o.freq, 0, 5)) * o.amp - nz.fbm(x * o.freq * 3 + 9, 1, 3) * o.amp * .25;
  const pts = []; for (let x = -W / 2; x <= W / 2; x += 6) pts.push([x, ridge(x)]);
  g.beginPath(); g.moveTo(-W / 2, bot); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(W / 2, bot); g.closePath();
  const gr = g.createLinearGradient(0, o.base - o.amp, 0, bot);
  gr.addColorStop(0, rgba(o.col, o.alpha)); gr.addColorStop(.55, rgba(o.col, o.alpha * .45)); gr.addColorStop(1, rgba(o.col, 0));
  g.fillStyle = gr; g.fill();
  // dry-brush texture inside, following the slope
  for (let i = 0; i < o.strokes; i++) {
    const x = r.range(-W / 2, W / 2), y0 = ridge(x), y = y0 + r.range(2, (bot - y0) * .6);
    const k = 1 - (y - y0) / (bot - y0);
    g.fillStyle = rgba(jit(o.col, 18, r), o.alpha * r.range(.25, .7) * k);
    const s = (ridge(x + 8) - ridge(x - 8)) / 16;
    ribbon(g, flowPts(x, y, r.int(3, 9), 6, () => Math.atan(s) + r.range(-.2, .2)), r.range(2, 6), PROF.taper, 1, r);
  }
  // inked ridge line
  g.fillStyle = rgba(o.ink, o.alpha * 1.4);
  for (let i = 0; i < pts.length - 6; i += 5) {
    if (r.f() < .25) continue;
    const seg = pts.slice(i, i + r.int(4, 9)).map(p => [p[0], p[1] + r.range(0, 2)]);
    if (seg.length > 1) ribbon(g, seg, r.range(1.5, 4), PROF.taper, .8, r);
  }
  // little pines on the ridge
  if (o.trees) for (let i = 0; i < o.trees; i++) {
    const x = r.range(-W / 2, W / 2), y = ridge(x) + 2, h = r.range(16, 34);
    g.fillStyle = rgba(o.ink, o.alpha * 1.3);
    for (let k = 0; k < 4; k++) { const yy = y - h * k / 4, w = h * (.5 - k * .1); g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.lineTo(x + r.range(-2, 2), yy - h * .35); g.closePath(); g.fill(); }
    g.fillRect(x - 1, y - h * .2, 2, h * .25);
  }
  // mist bands
  for (let i = 0; i < 26; i++) {
    const x = r.range(-W / 2, W / 2), y = o.base + r.range(-o.amp * .5, 20);
    g.fillStyle = rgba(C.paper, r.range(.25, .55));
    ribbon(g, flowPts(x, y, r.int(10, 30), 10, () => r.range(-.03, .03)), r.range(8, 22), PROF.taper, 2, r);
  }
  return { canvas: c, x: -W / 2, y: top, w: W, h: H };
}

function paintGround(q) {
  const W = 2800, top = -60, bot = 760, H = bot - top;
  const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q); g.translate(W / 2, -top);
  const r = new Rand(31337), nz = new Noise(31338);
  let gr = g.createLinearGradient(0, 0, 0, bot);
  gr.addColorStop(0, '#9aa26a'); gr.addColorStop(.12, '#7f8c58'); gr.addColorStop(.45, '#5b6a42'); gr.addColorStop(1, '#3a4630');
  g.fillStyle = gr; g.fillRect(-W / 2, 0, W, bot);
  const cols = [hex('#6f8a4c'), hex('#8ba062'), hex('#4f6a3c'), C.grassGold, C.grassDry, hex('#a49a5e'), hex('#b8b27c'), hex('#c9b27a')];
  for (let i = 0; i < 26000; i++) {
    const x = r.range(-W / 2, W / 2), y = Math.pow(r.f(), 1.6) * bot - 20;
    const depth = clamp(y / bot, 0, 1);
    let col = r.pick(cols);
    if (r.f() < .18) col = r.pick([C.grassPale, C.cream]);
    col = mixc(col, hex('#203a22'), depth * .55);
    g.fillStyle = rgba(jit(col, 16, r), r.range(.55, .95));
    const h = r.range(8, 26) * (1 - depth * .3), a = -PI / 2 + .35 + nz.n(x * .01, y * .02) * .45;
    ribbon(g, [[x, y], [x + Math.cos(a) * h * .5, y + Math.sin(a) * h * .5], [x + Math.cos(a + .1) * h, y + Math.sin(a + .1) * h]], r.range(2, 5), PROF.lift, .6, r);
  }
  // soft paper fade at the very top so the meadow melts into the field
  g.globalCompositeOperation = 'destination-out';
  gr = g.createLinearGradient(0, top, 0, 30);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-W / 2, top, W, 90);
  g.globalCompositeOperation = 'source-over';
  return { canvas: c, x: -W / 2, y: top, w: W, h: H };
}

/* Ink splat sprites for blood/ink decals */
function paintSplats(q) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const S = 160, c = mkCanvas(S * q, S * q), g = c.getContext('2d');
    g.scale(q, q); const r = new Rand(700 + i);
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(80, 80, r.range(26, 38), r.range(10, 16), r.range(-.2, .2), 0, TAU); g.fill();
    for (let k = 0; k < 26; k++) { const a = r.f() * TAU, d = r.range(20, 70), s = r.range(1.5, 7) * (1 - d / 90); g.beginPath(); g.ellipse(80 + Math.cos(a) * d, 80 + Math.sin(a) * d * .45, s, s * .6, 0, 0, TAU); g.fill(); }
    for (let k = 0; k < 8; k++) { const a = r.f() * TAU; ribbon(g, [[80, 80], [80 + Math.cos(a) * 40, 80 + Math.sin(a) * 18], [80 + Math.cos(a) * r.range(55, 75), 80 + Math.sin(a) * r.range(20, 30)]], r.range(3, 6), PROF.lift, 1, r); }
    out.push(c);
  }
  return out;
}

/* =========================================================================
   POST — WebGL compositor: bloom from an emissive layer, shockwaves,
   radial blur, chromatic aberration, linen paper, grain, grading.
   ========================================================================= */
class Post {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    this.gl = gl; this.canvas = canvas;
    const vs = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
    const hp = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
    this.pCopy = this.prog(vs, hp + `varying vec2 vUv; uniform sampler2D t; uniform vec2 tx;
      void main(){ vec3 c = texture2D(t, vUv + tx*vec2(-.5,-.5)).rgb + texture2D(t, vUv + tx*vec2(.5,-.5)).rgb + texture2D(t, vUv + tx*vec2(-.5,.5)).rgb + texture2D(t, vUv + tx*vec2(.5,.5)).rgb;
      gl_FragColor = vec4(c*.25, 1.); }`);
    this.pBlur = this.prog(vs, hp + `varying vec2 vUv; uniform sampler2D t; uniform vec2 dir;
      void main(){
        vec3 c = texture2D(t, vUv).rgb * .2270270270;
        c += texture2D(t, vUv + dir*1.3846153846).rgb * .3162162162;
        c += texture2D(t, vUv - dir*1.3846153846).rgb * .3162162162;
        c += texture2D(t, vUv + dir*3.2307692308).rgb * .0702702703;
        c += texture2D(t, vUv - dir*3.2307692308).rgb * .0702702703;
        gl_FragColor = vec4(c, 1.); }`);
    this.pComp = this.prog(vs, hp + `varying vec2 vUv;
      uniform sampler2D uScene, uBloom, uBloom2, uPaperTex;
      uniform vec2 uRes; uniform float uTime, uCA, uSlow, uHurt, uBloomStr, uPaper, uVig, uFade;
      uniform vec4 uFlash, uShock; uniform vec3 uRadial; uniform vec3 uFadeCol;
      float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
      vec3 sCA(vec2 uv, float ca){ vec2 d=(uv-.5)*ca; return vec3(texture2D(uScene, uv+d).r, texture2D(uScene, uv).g, texture2D(uScene, uv-d).b); }
      void main(){
        vec2 uv = vUv; float aspect = uRes.x/uRes.y;
        if(uShock.w > .001){
          vec2 d = uv - uShock.xy; d.x *= aspect; float dist = length(d);
          float ring = exp(-pow((dist - uShock.z)*16., 2.));
          uv -= (d/max(dist,1e-4)) * vec2(1./aspect, 1.) * ring * uShock.w * .03;
        }
        float ca = .0012 + uCA;
        vec3 col;
        if(uRadial.z > .001){
          vec3 acc = vec3(0.); vec2 dir = uv - uRadial.xy;
          for(int i=0;i<10;i++){ float k = float(i)/9.; acc += sCA(uv - dir*k*uRadial.z, ca); }
          col = acc/10.;
        } else col = sCA(uv, ca);
        vec3 b1 = texture2D(uBloom, uv).rgb, b2 = texture2D(uBloom2, uv).rgb;
        col += (b1*.9 + b2*1.1) * uBloomStr;
        vec2 px = gl_FragCoord.xy;
        vec4 pt = texture2D(uPaperTex, px / 512.);
        vec4 pb = texture2D(uPaperTex, px / 2048. + .37);
        float paper = 1. - uPaper*((pt.r-.5)*.34 + (pt.g-.5)*.16 + (pb.b-.5)*.4);
        col *= paper;
        float lum = dot(col, vec3(.299,.587,.114));
        vec3 graded = mix(vec3(lum), col, .5) * vec3(.97,1.,1.07);
        graded = (graded-.5)*1.15+.5;
        col = mix(col, graded, uSlow);
        vec2 q = vUv-.5; q.x *= aspect*.72;
        float vig = smoothstep(.98, .2, length(q));
        col *= mix(1.-uVig, 1., vig);
        float hm = clamp((1.-vig)*uHurt*1.4 + uHurt*.12, 0., 1.);
        col = mix(col, vec3(.42,.04,.07), hm*.8);
        col = mix(col, uFlash.rgb, uFlash.a);
        col = mix(col, uFadeCol, uFade);
        col += (hash(px + fract(uTime*7.31)*91.) - .5) * .03;
        gl_FragColor = vec4(col, 1.);
      }`);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.buf = buf;
    this.tScene = this.tex(); this.tGlow = this.tex();
    this.tPaper = this.paperTexture();
    this.fA = this.fbo(4, 4); this.fB = this.fbo(4, 4); this.fC = this.fbo(4, 4); this.fD = this.fbo(4, 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }
  prog(vsSrc, fsSrc) {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  paperTexture() {
    // tileable linen: weave (r), fibres (g), soft blotches (b) — computed once
    const N = 512, c = mkCanvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
    const lat = (n, seed) => { const r = mulberry32(seed), a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
    const vnoise = (L, n, x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const i0 = ((xi % n) + n) % n, j0 = ((yi % n) + n) % n, i1 = (i0 + 1) % n, j1 = (j0 + 1) % n;
      return lerp(lerp(L[j0 * n + i0], L[j0 * n + i1], u), lerp(L[j1 * n + i0], L[j1 * n + i1], u), v); };
    const oct = [[8, 11], [16, 12], [32, 13], [64, 14], [128, 15]].map(o => [o[0], lat(o[0], o[1])]);
    const fib = [[16, 21], [64, 22], [128, 23]].map(o => [o[0], lat(o[0], o[1])]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const w = Math.sin(x / N * TAU * 160 + vnoise(oct[2][1], 32, x / N * 32, y / N * 32) * 3) * Math.sin(y / N * TAU * 160 + vnoise(oct[3][1], 64, x / N * 64, y / N * 64) * 3);
      let f = 0; f += vnoise(fib[0][1], 16, x / N * 16, y / N * 128 % 16) * .2; f += vnoise(fib[1][1], 64, x / N * 64, (y / N * 4 % 1) * 64) * .4; f += vnoise(fib[2][1], 128, (x / N * 6 % 1) * 128, y / N * 128) * .4;
      let b = 0, a = .5, tot = 0; for (const [n, L] of oct) { b += a * vnoise(L, n, x / N * n, y / N * n); tot += a; a *= .5; }
      d[i] = 128 + w * 90; d[i + 1] = f * 255; d[i + 2] = b / tot * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    return t;
  }
  tex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  fbo(w, h) {
    const gl = this.gl, t = this.tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f, t, w, h };
  }
  resizeFbo(o, w, h) {
    const gl = this.gl; o.w = w; o.h = h;
    gl.bindTexture(gl.TEXTURE_2D, o.t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  resize(w, h, gw, gh) {
    this.w = w; this.h = h;
    const bw = Math.max(1, Math.ceil(gw / 2)), bh = Math.max(1, Math.ceil(gh / 2));
    this.resizeFbo(this.fA, bw, bh); this.resizeFbo(this.fB, bw, bh);
    const cw = Math.max(1, Math.ceil(gw / 6)), ch = Math.max(1, Math.ceil(gh / 6));
    this.resizeFbo(this.fC, cw, ch); this.resizeFbo(this.fD, cw, ch);
  }
  draw(prog, target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  bind(unit, t) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  render(scene, glow, U) {
    const gl = this.gl;
    this.bind(0, this.tScene); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    this.bind(0, this.tGlow); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glow);
    // glow -> half res
    let P = this.pCopy; gl.useProgram(P.p);
    gl.uniform1i(P.u.t, 0); gl.uniform2f(P.u.tx, 1 / glow.width, 1 / glow.height);
    this.draw(P, this.fA, this.fA.w, this.fA.h);
    // two blur passes at half res
    const B = this.pBlur;
    const blur = (src, dst, dx, dy) => { gl.useProgram(B.p); this.bind(0, src.t); gl.uniform1i(B.u.t, 0); gl.uniform2f(B.u.dir, dx / src.w, dy / src.h); this.draw(B, dst, dst.w, dst.h); };
    blur(this.fA, this.fB, 1.2, 0); blur(this.fB, this.fA, 0, 1.2);
    blur(this.fA, this.fB, 2.4, 0); blur(this.fB, this.fA, 0, 2.4);
    // wide halo at 1/6 res
    gl.useProgram(P.p); this.bind(0, this.fA.t); gl.uniform1i(P.u.t, 0); gl.uniform2f(P.u.tx, 1 / this.fA.w, 1 / this.fA.h);
    this.draw(P, this.fC, this.fC.w, this.fC.h);
    blur(this.fC, this.fD, 1.5, 0); blur(this.fD, this.fC, 0, 1.5);
    blur(this.fC, this.fD, 3, 0); blur(this.fD, this.fC, 0, 3);
    // composite
    const Cp = this.pComp; gl.useProgram(Cp.p);
    this.bind(0, this.tScene); gl.uniform1i(Cp.u.uScene, 0);
    this.bind(1, this.fA.t); gl.uniform1i(Cp.u.uBloom, 1);
    this.bind(2, this.fC.t); gl.uniform1i(Cp.u.uBloom2, 2);
    this.bind(3, this.tPaper); gl.uniform1i(Cp.u.uPaperTex, 3);
    const u = Cp.u;
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1f(u.uTime, U.time); gl.uniform1f(u.uCA, U.ca); gl.uniform1f(u.uSlow, U.slow);
    gl.uniform1f(u.uHurt, U.hurt); gl.uniform1f(u.uBloomStr, U.bloom); gl.uniform1f(u.uPaper, U.paper);
    gl.uniform1f(u.uVig, U.vig); gl.uniform1f(u.uFade, U.fade); gl.uniform3f(u.uFadeCol, U.fadeCol[0], U.fadeCol[1], U.fadeCol[2]);
    gl.uniform4f(u.uFlash, U.flash[0], U.flash[1], U.flash[2], U.flash[3]);
    gl.uniform4f(u.uShock, U.shock[0], U.shock[1], U.shock[2], U.shock[3]);
    gl.uniform3f(u.uRadial, U.radial[0], U.radial[1], U.radial[2]);
    this.draw(Cp, null, this.w, this.h);
  }
}

/* =========================================================================
   AUDIO — everything synthesised: taiko, blades, steel, wind, wolf howl
   ========================================================================= */
const SND = {
  ctx: null, muted: store.get('iai.muted', false),
  mus: { on: false, next: 0, step: 0, level: 0 },
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      const ctx = this.ctx = new A();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .22;
      comp.connect(ctx.destination);
      this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : .9; this.out.connect(comp);
      this.sfx = ctx.createGain(); this.sfx.gain.value = .95; this.sfx.connect(this.out);
      this.musBus = ctx.createGain(); this.musBus.gain.value = .5; this.musBus.connect(this.out);
      const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb = ctx.createConvolver(); this.verb.buffer = ir;
      this.send = ctx.createGain(); this.send.gain.value = .9;
      const vo = ctx.createGain(); vo.gain.value = .55;
      this.send.connect(this.verb); this.verb.connect(vo); vo.connect(this.out);
      const nl = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
      const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      this.startWind();
    } catch { this.ctx = null; }
  },
  setMuted(m) { this.muted = m; store.set('iai.muted', m); if (this.out) this.out.gain.setTargetAtTime(m ? 0 : .9, this.ctx.currentTime, .05); },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },
  env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); },
  route(node, pan, send, bus) {
    let n = node;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); n = p; }
    n.connect(bus || this.sfx);
    if (send) { const s = this.ctx.createGain(); s.gain.value = send; n.connect(s); s.connect(this.send); }
  },
  noiseSrc(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t, Math.random() * 1.6, dur + .05); return s; },
  osc(type, f, t, dur) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + .05); return o; },
  filt(type, f, q) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; },
  ring(t, base, vol, dur, parts, pan, send) {
    parts = parts || [1, 2.76, 5.4, 8.93];
    parts.forEach((p, i) => {
      const o = this.osc('sine', base * p, t, dur), g = this.ctx.createGain();
      this.env(g, t, .002, vol / Math.pow(i + 1, .8), dur / (1 + i * .7));
      o.connect(g); this.route(g, pan, send);
    });
  },
  /* ---------------- drums ---------------- */
  taiko(t, vol, pitch, bus) {
    if (!this.ctx) return;
    const o = this.osc('sine', 115 * pitch, t, .7), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(46 * pitch, t + .2);
    this.env(g, t, .004, vol, .6); o.connect(g); this.route(g, 0, .25, bus);
    const n = this.noiseSrc(t, .1), f = this.filt('lowpass', 900), g2 = this.ctx.createGain();
    this.env(g2, t, .002, vol * .45, .08); n.connect(f); f.connect(g2); this.route(g2, 0, .15, bus);
  },
  odaiko(t, vol, bus) {
    if (!this.ctx) return;
    const o = this.osc('sine', 72, t, 1.6), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(34, t + .45);
    this.env(g, t, .006, vol, 1.4); o.connect(g); this.route(g, 0, .45, bus);
    const n = this.noiseSrc(t, .18), f = this.filt('lowpass', 420), g2 = this.ctx.createGain();
    this.env(g2, t, .003, vol * .6, .16); n.connect(f); f.connect(g2); this.route(g2, 0, .3, bus);
  },
  ka(t, vol, bus) {
    if (!this.ctx) return;
    const n = this.noiseSrc(t, .05), f = this.filt('bandpass', 2600, 1.4), g = this.ctx.createGain();
    this.env(g, t, .001, vol, .04); n.connect(f); f.connect(g); this.route(g, .15, .1, bus);
    const o = this.osc('triangle', 1650, t, .05), g2 = this.ctx.createGain();
    this.env(g2, t, .001, vol * .4, .03); o.connect(g2); this.route(g2, .15, 0, bus);
  },
  shime(t, vol, bus) {
    if (!this.ctx) return;
    const o = this.osc('sine', 330, t, .2), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(190, t + .07);
    this.env(g, t, .002, vol, .12); o.connect(g); this.route(g, -.2, .1, bus);
    const n = this.noiseSrc(t, .05), f = this.filt('bandpass', 1500, 1), g2 = this.ctx.createGain();
    this.env(g2, t, .001, vol * .5, .04); n.connect(f); f.connect(g2); this.route(g2, -.2, 0, bus);
  },
  wood(t, f, vol) {
    if (!this.ctx) return;
    const o = this.osc('sine', f, t, .1), g = this.ctx.createGain();
    this.env(g, t, .001, vol, .07); o.connect(g); this.route(g, 0, .2);
  },
  /* ---------------- blades & bodies ---------------- */
  whoosh(t, vol, pan, bright, dur) {
    if (!this.ctx) return;
    dur = dur || .18;
    const n = this.noiseSrc(t, dur + .05), f = this.filt('bandpass', 3800 * bright, .9), g = this.ctx.createGain();
    f.frequency.setValueAtTime(4200 * bright, t); f.frequency.exponentialRampToValueAtTime(450, t + dur);
    this.env(g, t, .02, vol, dur); n.connect(f); f.connect(g); this.route(g, pan, .15);
  },
  slash(dir, perfect) {
    if (!this.ctx) return; const t = this.t;
    this.whoosh(t, perfect ? .55 : .42, dir * .5, perfect ? 1.25 : 1, .17);
  },
  cut(dir, perfect) {
    if (!this.ctx) return; const t = this.t + .01;
    const o = this.osc('sine', 170, t, .2), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(52, t + .12);
    this.env(g, t, .003, .55, .16); o.connect(g); this.route(g, dir * .6, .1);
    const n = this.noiseSrc(t, .14), f = this.filt('bandpass', 1300, .8), g2 = this.ctx.createGain();
    this.env(g2, t, .002, .4, .12); n.connect(f); f.connect(g2); this.route(g2, dir * .6, .15);
    const n2 = this.noiseSrc(t, .06), f2 = this.filt('highpass', 4200), g3 = this.ctx.createGain();
    this.env(g3, t, .001, .3, .05); n2.connect(f2); f2.connect(g3); this.route(g3, dir * .6, 0);
    if (perfect) { this.ring(t, 1318, .1, 1.3, [1, 2.0, 3.01, 4.2], dir * .4, .5); this.ring(t + .03, 1975, .05, .9, [1, 2.76], dir * .4, .5); }
  },
  clang(dir, big) {
    if (!this.ctx) return; const t = this.t;
    this.ring(t, big ? 540 : 780, big ? .3 : .22, big ? 1.4 : .8, [1, 2.32, 4.25, 6.63, 8.1], dir * .5, .4);
    const n = this.noiseSrc(t, .06), f = this.filt('highpass', 3500), g = this.ctx.createGain();
    this.env(g, t, .001, .35, .05); n.connect(f); f.connect(g); this.route(g, dir * .5, .2);
  },
  ping(dir) { if (!this.ctx) return; this.ring(this.t, 2350, .09, .35, [1, 2.4, 4.1], dir * .6, .3); this.whoosh(this.t, .15, dir * .6, 1.6, .08); },
  whiff(dir) { if (!this.ctx) return; this.whoosh(this.t, .25, dir * .4, .7, .22); },
  hurt() {
    if (!this.ctx) return; const t = this.t;
    const o = this.osc('sine', 95, t, .4), g = this.ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(38, t + .3);
    this.env(g, t, .003, .7, .35); o.connect(g); this.route(g, 0, .2);
    const n = this.noiseSrc(t, .3), f = this.filt('lowpass', 600), g2 = this.ctx.createGain();
    this.env(g2, t, .002, .5, .25); n.connect(f); f.connect(g2); this.route(g2, 0, .2);
    this.ring(t, 233, .08, .8, [1, 1.41, 2.13], 0, .4);
  },
  bell(f, vol, delay) { if (!this.ctx) return; this.ring(this.t + (delay || 0), f, vol, 1.8, [1, 2.0, 3.01, 4.2, 5.4], 0, .6); },
  gong() { if (!this.ctx) return; this.ring(this.t, 98, .42, 6, [1, 1.47, 2.09, 2.56, 3.17, 4.2], 0, .8); this.odaiko(this.t, .6); },
  howl() {
    if (!this.ctx) return; const t = this.t, ctx = this.ctx;
    const out = ctx.createGain(); this.env(out, t, .25, .32, 2.2);
    const f1 = this.filt('bandpass', 750, 5), f2 = this.filt('bandpass', 1250, 6), f3 = this.filt('lowpass', 2600);
    f1.connect(out); f2.connect(out);
    const lfo = this.osc('sine', 5.5, t, 2.6), lg = ctx.createGain(); lg.gain.value = 9;
    lfo.connect(lg);
    [1, 1.007, .5].forEach((m, i) => {
      const o = this.osc(i === 2 ? 'triangle' : 'sawtooth', 260 * m, t, 2.6);
      o.frequency.setValueAtTime(240 * m, t); o.frequency.exponentialRampToValueAtTime(520 * m, t + .55);
      o.frequency.exponentialRampToValueAtTime(470 * m, t + 1.3); o.frequency.exponentialRampToValueAtTime(260 * m, t + 2.3);
      lg.connect(o.frequency);
      o.connect(f3);
    });
    f3.connect(f1); f3.connect(f2);
    this.route(out, 0, .9);
    this.whoosh(t + .1, .35, 0, .6, 1.2);
    this.odaiko(t + .05, .7);
  },
  roar() {
    if (!this.ctx) return; const t = this.t, ctx = this.ctx;
    const out = ctx.createGain(); this.env(out, t, .15, .5, 1.6);
    const o = this.osc('sawtooth', 70, t, 1.9); o.frequency.exponentialRampToValueAtTime(42, t + 1.6);
    const o2 = this.osc('sawtooth', 73, t, 1.9); o2.frequency.exponentialRampToValueAtTime(40, t + 1.6);
    const f = this.filt('lowpass', 520, 2); o.connect(f); o2.connect(f);
    const trem = this.osc('sine', 17, t, 1.9), tg = ctx.createGain(); tg.gain.value = .35; trem.connect(tg);
    const vca = ctx.createGain(); vca.gain.value = .65; tg.connect(vca.gain); f.connect(vca); vca.connect(out);
    const n = this.noiseSrc(t, 1.7), nf = this.filt('lowpass', 380), ng = ctx.createGain(); ng.gain.value = .5; n.connect(nf); nf.connect(ng); ng.connect(out);
    this.route(out, 0, .7);
    this.odaiko(t, .8);
  },
  shatter() {
    if (!this.ctx) return; const t = this.t;
    for (let i = 0; i < 6; i++) this.ring(t + i * .04, 900 + Math.random() * 1600, .06, .9, [1, 2.7, 5.1], rr(-.8, .8), .5);
    const n = this.noiseSrc(t, .8), f = this.filt('lowpass', 1800), g = this.ctx.createGain();
    this.env(g, t, .004, .5, .7); n.connect(f); f.connect(g); this.route(g, 0, .5);
    this.odaiko(t, .9);
  },
  shaku(f, dur, vol, delay) {
    if (!this.ctx) return; const t = this.t + (delay || 0), ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .14);
    g.gain.setValueAtTime(vol, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const o = this.osc('triangle', f * .97, t, dur), o2 = this.osc('sine', f * 2, t, dur);
    o.frequency.exponentialRampToValueAtTime(f, t + .18);
    const lfo = this.osc('sine', 5, t, dur), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .014, t + dur * .6);
    lfo.connect(lg); lg.connect(o.frequency);
    const g2 = ctx.createGain(); g2.gain.value = .12; o2.connect(g2);
    const lp = this.filt('lowpass', f * 3.5); o.connect(lp); g2.connect(lp); lp.connect(g);
    const n = this.noiseSrc(t, dur), nf = this.filt('bandpass', f * 1.5, 2.5), ng = ctx.createGain(); ng.gain.value = .35;
    n.connect(nf); nf.connect(ng); ng.connect(g);
    this.route(g, -.1, .8, this.musBus);
  },
  phrase(level) {
    const D = 293.66, F = 349.23, G = 392, A = 440, Cc = 523.25, D2 = 587.33;
    const ps = [[[A, 1.2], [G, .6], [F, 1.6]], [[D, .8], [F, .8], [G, 1.6], [A, 2]], [[D2, 1.4], [Cc, .6], [A, 2.2]], [[G, .9], [A, .5], [Cc, .6], [A, 2.4]]];
    const p = ps[(Math.random() * ps.length) | 0];
    let d = 0; for (const [f, l] of p) { this.shaku(f, l + .15, level || .08, d); d += l; }
  },
  startWind() {
    const ctx = this.ctx, n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const f = this.filt('bandpass', 420, .6), g = ctx.createGain(); g.gain.value = .05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = .09; const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(f.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = .13; const lg2 = ctx.createGain(); lg2.gain.value = .025;
    lfo2.connect(lg2); lg2.connect(g.gain);
    n.connect(f); f.connect(g); g.connect(this.out);
    n.start(); lfo.start(); lfo2.start();
    this.windGain = g;
  },
  /* ---------------- music sequencer ---------------- */
  PAT: [
    { bpm: 70, od: 'x.........x.....', tk: '................', ka: '................', sh: '................' },
    { bpm: 104, od: 'x...............', tk: 'x...x...x.o.x...', ka: '....x.......x...', sh: '................' },
    { bpm: 116, od: 'x.......x.......', tk: 'x..ox...x.o.x.oo', ka: '..o.x..o..o.x..o', sh: 'o.o.o.o.o.o.o.o.' },
    { bpm: 128, od: 'x.......x.......', tk: 'x.oxx.o.x.oxx.ox', ka: 'o.x.o.x.o.x.o.x.', sh: 'oooooooooooooooo' },
    { bpm: 138, od: 'x...x...x...x...', tk: 'x.x.xxx.x.x.xxxx', ka: 'x.x.x.x.x.x.x.x.', sh: 'oooooooooooooooo' },
  ],
  musicStart(level) { if (!this.ctx) return; this.mus.on = true; this.mus.level = level; this.mus.next = this.ctx.currentTime + .08; this.mus.step = 0; },
  musicLevel(l) { this.mus.level = l; },
  musicStop() { this.mus.on = false; },
  tick() {
    if (!this.ctx || !this.mus.on) return;
    const m = this.mus, ahead = this.ctx.currentTime + .14;
    while (m.next < ahead) {
      const P = this.PAT[m.level], s = m.step % 16, t = m.next, bus = this.musBus;
      const v = c => c === 'x' ? 1 : c === 'o' ? .45 : 0;
      if (v(P.od[s])) this.odaiko(t, .55 * v(P.od[s]), bus);
      if (v(P.tk[s])) this.taiko(t, .42 * v(P.tk[s]), 1, bus);
      if (v(P.ka[s])) this.ka(t, .18 * v(P.ka[s]), bus);
      if (v(P.sh[s])) this.shime(t, .16 * v(P.sh[s]), bus);
      m.next += 60 / P.bpm / 4; m.step++;
    }
  },
};

/* =========================================================================
   WORLD — view/camera, painted layers, the susuki meadow, particles, FX
   ========================================================================= */
const V = { W: 1, H: 1, pr: 1, S: 1, Z: 1, gy: 0, camX: 0, camTX: 0, shx: 0, shy: 0, trauma: 0, portrait: false, halfW: 1, top: -1, bottom: 1, punch: 0 };
function layout() {
  V.W = window.innerWidth; V.H = window.innerHeight;
  V.portrait = V.H > V.W * 1.05;
  V.S = Math.min(V.H / 760, V.W / (V.H > V.W * 1.05 ? 880 : 950));
  let pr = Math.min(window.devicePixelRatio || 1, 2);
  const maxPx = 2.6e6; if (V.W * V.H * pr * pr > maxPx) pr = Math.sqrt(maxPx / (V.W * V.H));
  V.pr = pr;
  V.gy = V.H * (V.portrait ? .7 : .8);
  V.halfW = V.W / 2 / V.S; V.top = -V.gy / V.S; V.bottom = (V.H - V.gy) / V.S;
}
function camT(g, k, par = 1, parY = 1) {
  const s = V.S * V.Z * k;
  g.setTransform(s, 0, 0, s, (V.W / 2 + V.shx * par - V.camX * par * V.S * V.Z) * k, (V.gy + V.shy * parY) * k);
}
function shake(amount) { V.trauma = Math.min(1.2, V.trauma + amount); }

/* ---------- assets created at load ---------- */
const AS = {};
function glowSprite(col, size = 128) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(.25, rgba(col, .55)); gr.addColorStop(.6, rgba(col, .12)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function tintCopy(src, col) {
  const c = mkCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c;
}
function paintSwipe(q) {
  const W = 620, H = 120, c = mkCanvas(W * q, H * q), g = c.getContext('2d');
  g.scale(q, q); const r = new Rand(55);
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([20 + t * 580, 64 - Math.sin(t * PI) * 16 + t * 6]); }
  const prof = t => t < .06 ? .5 + t / .06 * .5 : Math.pow(1 - (t - .06) / .94, .7);
  g.fillStyle = 'rgba(10,10,18,.96)'; ribbon(g, pts, 46, prof, 5, r);
  for (let k = 0; k < 26; k++) {
    const off = r.range(-20, 20), s0 = r.int(2, 14), s1 = r.int(26, 40);
    const sub = pts.slice(s0, s1).map((p, i) => [p[0], p[1] + off * prof((s0 + i) / 40) + r.range(-1, 1)]);
    g.fillStyle = `rgba(10,10,18,${r.range(.5, .95)})`;
    ribbon(g, sub, r.range(1.2, 4), PROF.taper, .5, r);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 120; k++) { const t = r.range(.3, 1), p = pts[Math.floor(t * 40)]; g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(p[0] + r.range(-14, 14), p[1] + r.range(-22, 22), r.range(6, 30), r.range(.6, 1.6)); }
  return c;
}

/* ---------- the meadow ---------- */
const GRASS = { layers: [] };
function buildGrass() {
  const r = new Rand(2024);
  const mk = (n, y0, y1, h0, h1, w0, w1, cols, plumeP, plumeCols, lw, x0 = -1600, x1 = 1600) => {
    const L = { groups: cols.map(() => []), cols: cols.map(c => rgba(c)), plumes: [], plumeCols: plumeCols.map(c => rgba(c, .9)), lw, blades: [] };
    for (let i = 0; i < n; i++) {
      const b = { x: r.range(x0, x1), y: r.range(y0, y1), h: r.range(h0, h1), w: r.range(w0, w1), ph: r.f() * TAU, flex: r.range(.7, 1.25), lean: r.range(-.12, .22), ci: r.int(0, cols.length - 1) };
      b.plume = r.f() < plumeP ? r.int(0, plumeCols.length - 1) : -1;
      L.groups[b.ci].push(b); L.blades.push(b);
      if (b.plume >= 0) { b.pl = []; const n2 = r.int(5, 8); for (let k = 0; k < n2; k++) b.pl.push([r.range(-.5, .55), r.range(.18, .32) * b.h, r.range(.02, .1)]); }
    }
    return L;
  };
  GRASS.layers = [
    mk(620, -40, -6, 30, 84, 1, 1.9, [hex('#cdbd92'), hex('#dccfa8'), hex('#bdae84'), hex('#aab08c'), hex('#c7b689')], .45, [hex('#f1eadb'), hex('#e6d9b5')], 1.2),
    mk(420, -6, 24, 64, 150, 1.6, 3, [C.grassGold, C.grassDry, hex('#d8c38c'), hex('#8fa264'), hex('#b5a96d'), hex('#cdb47a')], .42, [hex('#f3ebd6'), hex('#e6d3a3'), hex('#dcc48f')], 1.7),
    mk(150, 40, 180, 120, 260, 2.8, 5.5, [hex('#b8964f'), hex('#a3833f'), hex('#c8a862'), hex('#6f8c4a'), hex('#d4ba7c'), hex('#8a7136')], .5, [hex('#f0e6ca'), hex('#dcc288')], 2.4),
  ];
}
const WIND = { t: 0, gust: 0, gustT: 0, base: .2 };
function windAt(x, t) { return WIND.base + .11 * Math.sin(t * .6 + x * .002) + WIND.gust * (.6 + .4 * Math.sin(x * .004 - t * 2)); }
const RIPPLES = [];
function addRipple(x, amp, speed = 950, life = 1.3) { RIPPLES.push({ x, t0: WIND.t, amp, speed, life }); if (RIPPLES.length > 8) RIPPLES.shift(); }
function bladeAngle(b, t, pushX, pushK) {
  let a = b.lean + windAt(b.x, t) * b.flex * (.75 + .25 * Math.sin(t * 2.1 + b.ph + b.x * .01)) + .05 * Math.sin(t * 3.4 + b.ph);
  for (const R of RIPPLES) {
    const age = t - R.t0; if (age > R.life) continue;
    const dx = b.x - R.x, d = Math.abs(dx), f = R.speed * age;
    const k = Math.exp(-Math.pow((d - f) / 110, 2)) * R.amp * (1 - age / R.life);
    a += Math.sign(dx || 1) * k;
  }
  if (pushK) { const dx = b.x - pushX; if (Math.abs(dx) < 80) a += Math.sign(dx || 1) * (1 - Math.abs(dx) / 80) * pushK; }
  return a;
}
function drawGrassLayer(g, L, t, pushX, pushK) {
  const pl = [];
  for (let gi = 0; gi < L.groups.length; gi++) {
    const grp = L.groups[gi]; if (!grp.length) continue;
    g.fillStyle = L.cols[gi]; g.beginPath();
    for (const b of grp) {
      if (Math.abs(b.x - V.camX) > V.halfW / V.Z + 200) continue;
      const a = bladeAngle(b, t, pushX, pushK), h = b.h;
      const sa = Math.sin(a), ca = Math.cos(a), sh = Math.sin(a * .45), ch = Math.cos(a * .45);
      const tx = b.x + sa * h, ty = b.y - ca * h, cx = b.x + sh * h * .55, cy = b.y - ch * h * .55;
      g.moveTo(b.x - b.w, b.y); g.quadraticCurveTo(cx - b.w * .45, cy, tx, ty); g.quadraticCurveTo(cx + b.w * .45, cy, b.x + b.w, b.y);
      if (b.plume >= 0) pl.push(b, tx, ty, a);
    }
    g.fill();
  }
  // feathery plumes, batched by colour
  g.lineCap = 'round'; g.lineWidth = L.lw;
  for (let ci = 0; ci < L.plumeCols.length; ci++) {
    g.strokeStyle = L.plumeCols[ci]; g.beginPath();
    for (let i = 0; i < pl.length; i += 4) {
      const b = pl[i]; if (b.plume !== ci) continue;
      const tx = pl[i + 1], ty = pl[i + 2], a = pl[i + 3];
      for (const s of b.pl) {
        const aa = a + s[0] * .5 + .35, len = s[1];
        const ex = tx + Math.sin(aa + .4) * len, ey = ty - Math.cos(aa + .4) * len * .6 + len * .35;
        g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.sin(aa) * len * .6, ty - Math.cos(aa) * len * .6, ex, ey);
      }
    }
    g.stroke();
  }
}

/* ---------- particles ---------- */
const PARTS = [], DECALS = [], FX = [];
function addP(p) { if (PARTS.length < 900) PARTS.push(p); return p; }
function inkBurst(x, y, dir, n, power, crimson) {
  for (let i = 0; i < n; i++) {
    const sp = rr(.25, 1) * power;
    addP({ k: 'ink', x: x + rr(-8, 8), y: y + rr(-10, 10), vx: dir * sp * rr(.35, 1.2) + rr(-90, 90), vy: -sp * rr(.15, .85) - rr(0, 140), r: rr(1.5, 5.5), life: 2, t: 0, crimson: crimson && Math.random() < .35, gy: rr(-4, 26) });
  }
}
function sparks(x, y, dir, n, col) {
  for (let i = 0; i < n; i++) {
    const a = rr(-PI, PI), sp = rr(250, 1100);
    addP({ k: 'spark', x, y, vx: Math.cos(a) * sp + dir * 200, vy: Math.sin(a) * sp - 150, life: rr(.18, .45), t: 0, col: col || 0 });
  }
}
function embers(x, y, n, spread, vy, big) {
  for (let i = 0; i < n; i++) addP({ k: 'ember', x: x + rr(-spread, spread), y: y + rr(-spread * .5, spread * .5), vx: rr(-40, 40), vy: vy + rr(-60, 20), life: rr(.6, 1.3), t: 0, s: rr(.18, .4) * (big || 1), rot: rr(0, TAU), vr: rr(-2, 2), spr: (Math.random() * 7) | 0 });
}
function smoke(x, y, n, size, col) {
  for (let i = 0; i < n; i++) addP({ k: 'smoke', x: x + rr(-20, 20), y: y + rr(-20, 10), vx: rr(-60, 60), vy: rr(-50, 10), life: rr(.6, 1.2), t: 0, s: size * rr(.6, 1.2), col: col || 0 });
}
function updateParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i]; p.t += dt;
    if (p.t >= p.life) { PARTS.splice(i, 1); continue; }
    switch (p.k) {
      case 'ink':
        p.vy += 1500 * dt; p.vx *= .995; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vy > 0 && p.y >= p.gy) {
          if (Math.random() < .5) addDecal(p.x, p.gy, p.r * rr(1.5, 3), p.crimson);
          PARTS.splice(i, 1);
        }
        break;
      case 'spark': p.vy += 900 * dt; p.vx *= .97; p.x += p.vx * dt; p.y += p.vy * dt; break;
      case 'ember': p.vx += windAt(p.x, WIND.t) * 60 * dt; p.vy -= 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
      case 'smoke': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; break;
      case 'leaf': case 'fluff':
        p.vx += (windAt(p.x, WIND.t) * 140 - p.vx) * dt * .8; p.vy += (Math.sin(WIND.t * 1.7 + p.ph) * 18 - p.vy * .3) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
      case 'chunk':
        p.vy += 1700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > p.gy && p.vy > 0) { p.y = p.gy; p.vy *= -.25; p.vx *= .5; p.vr *= .4; if (Math.abs(p.vy) < 60) { p.vy = 0; p.vx *= .8; p.vr = 0; } }
        break;
    }
  }
}
function addDecal(x, y, s, crimson) {
  if (DECALS.length > 46) DECALS.shift();
  DECALS.push({ x, y, s: s * rr(.8, 1.2), rot: rr(-.3, .3), spr: (Math.random() * AS.splatInk.length) | 0, t: 0, life: rr(7, 11), crimson });
}
function drawDecals(g, dt) {
  for (let i = DECALS.length - 1; i >= 0; i--) {
    const d = DECALS[i]; d.t += dt;
    if (d.t > d.life) { DECALS.splice(i, 1); continue; }
    const a = Math.min(1, (d.life - d.t) / 2) * .8, spr = (d.crimson ? AS.splatRed : AS.splatInk)[d.spr];
    g.globalAlpha = a; g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.scale(d.s / 30, d.s / 30 * .55);
    g.drawImage(spr, -80, -80, 160, 160); g.restore();
  }
  g.globalAlpha = 1;
}
function drawParts(g, gg, front) {
  for (const p of PARTS) {
    const u = p.t / p.life;
    switch (p.k) {
      case 'ink': {
        if (front) break;
        const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx), st = 1 + Math.min(3, sp / 500);
        g.fillStyle = p.crimson ? 'rgba(122,16,24,.92)' : 'rgba(14,12,22,.92)';
        g.save(); g.translate(p.x, p.y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, p.r * st, p.r, 0, 0, TAU); g.fill(); g.restore();
        break;
      }
      case 'spark': {
        if (!front) break;
        const a = 1 - u;
        g.strokeStyle = p.col ? `rgba(160,200,255,${a})` : `rgba(255,236,170,${a})`; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); g.stroke();
        gg.strokeStyle = p.col ? `rgba(120,170,255,${a})` : `rgba(255,200,110,${a})`; gg.lineWidth = 6;
        gg.beginPath(); gg.moveTo(p.x, p.y); gg.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); gg.stroke();
        break;
      }
      case 'ember': {
        if (!front) break;
        const a = Math.sin(u * PI) * .9, spr = AS.dabs[p.spr], s = p.s * (1 + u * .6);
        g.globalAlpha = a; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(spr, -75 * s, -55 * s, 150 * s, 110 * s); g.restore();
        gg.globalAlpha = a * .7; gg.drawImage(AS.gBlue, p.x - 60 * s, p.y - 60 * s, 120 * s, 120 * s);
        g.globalAlpha = 1; gg.globalAlpha = 1;
        break;
      }
      case 'smoke': {
        if (front) break;
        const a = Math.sin(u * PI) * .55, s = p.s * (1 + u * 1.4);
        g.globalAlpha = a; g.drawImage(p.col ? AS.puffBlue : AS.puffInk, p.x - s, p.y - s, s * 2, s * 2); g.globalAlpha = 1;
        break;
      }
      case 'leaf': {
        if (!front) break;
        const gl = .5 + .5 * Math.sin(p.rot * 2);
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.3));
        g.fillStyle = `rgb(${200 + gl * 50 | 0},${160 + gl * 60 | 0},${70 + gl * 60 | 0})`;
        g.fillRect(-p.s, -p.s * .6, p.s * 2, p.s * 1.2); g.restore();
        if (gl > .85) { gg.globalAlpha = (gl - .85) * 4; gg.drawImage(AS.gGold, p.x - 14, p.y - 14, 28, 28); gg.globalAlpha = 1; }
        break;
      }
      case 'fluff': {
        if (!front) break;
        g.strokeStyle = 'rgba(250,245,230,.75)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(p.rot) * 6, p.y + Math.sin(p.rot) * 6); g.stroke();
        break;
      }
      case 'chunk': {
        if (front) break;
        const a = Math.min(1, (p.life - p.t) / .6);
        g.globalAlpha = a; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); p.draw(g); g.restore(); g.globalAlpha = 1;
        break;
      }
    }
  }
}
function ambient(dt) {
  const n = PARTS.reduce((s, p) => s + (p.k === 'leaf' || p.k === 'fluff' ? 1 : 0), 0);
  if (n < 46 && Math.random() < dt * 12) {
    const leaf = Math.random() < .5;
    addP({ k: leaf ? 'leaf' : 'fluff', x: V.camX - V.halfW - 40, y: rr(V.top * .9, 40), vx: rr(60, 140), vy: 0, life: rr(9, 14), t: 0, s: rr(2, 4.5), rot: rr(0, TAU), vr: rr(-4, 4), ph: rr(0, TAU) });
  }
}

/* ---------- combat FX ---------- */
function fxSlash(x, y, dir, perfect, big) { FX.push({ k: 'slash', x, y, dir, t: 0, life: perfect ? .3 : .24, perfect, big: big || 1 }); }
function fxBurst(x, y, perfect, col) { FX.push({ k: 'burst', x, y, t: 0, life: perfect ? .26 : .18, perfect, seed: Math.random() * 1000, col: col || 0 }); }
function fxRing(x, y, r1, life, col, w) { FX.push({ k: 'ring', x, y, t: 0, life, r1, col: col || 'rgba(12,12,20,', w: w || 10 }); }
function fxLine(y, dir) { FX.push({ k: 'line', y, dir, t: 0, life: .42 }); }
function fxSwipe(x, y, dir, rot, scale) { FX.push({ k: 'swipe', x, y, dir, rot, s: scale || 1, t: 0, life: .7 }); }
function fxStamp(x, y, kanji, sub, red) { FX.push({ k: 'stamp', x, y, kanji, sub, red, t: 0, life: 1.05, rot: rr(-.12, .12) }); }
function fxPop(x, y, text, col, size) { FX.push({ k: 'pop', x, y, text, col, size: size || 22, t: 0, life: .9 }); }

function drawFX(g, gg, layer, dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i];
    if (layer === 0) { f.t += dt; if (f.t >= f.life) { FX.splice(i, 1); continue; } }
    const u = f.t / f.life;
    if (f.k === 'swipe' && layer === 1) {
      const a = u < .05 ? u / .05 : Math.max(0, 1 - (u - .25) / .75);
      const grow = Ease.outExpo(Math.min(1, u * 8));
      g.save(); g.globalAlpha = a; g.translate(f.x, f.y); g.rotate(f.rot); g.scale(f.dir * f.s * .62, f.s * .5);
      g.drawImage(AS.swipe, -310, -60, 620 * grow, 120); g.restore(); g.globalAlpha = 1;
    } else if (f.k === 'ring' && layer === 0) {
      const r = f.r1 * Ease.outCubic(u), a = 1 - u;
      g.strokeStyle = f.col + (a * .5) + ')'; g.lineWidth = f.w * (1 - u) + 1;
      g.beginPath(); g.ellipse(f.x, f.y, r, r * .32, 0, 0, TAU); g.stroke();
    } else if (f.k === 'slash' && layer === 1) {
      drawSlashArc(g, gg, f, u);
    } else if (f.k === 'burst' && layer === 1) {
      const r = new Rand(f.seed | 0), n = f.perfect ? 14 : 9, a = 1 - u;
      for (let k = 0; k < n; k++) {
        const ang = r.f() * TAU, l0 = r.range(10, 30), l1 = l0 + r.range(60, f.perfect ? 220 : 130) * Ease.outCubic(Math.min(1, u * 3));
        const x0 = f.x + Math.cos(ang) * l0, y0 = f.y + Math.sin(ang) * l0, x1 = f.x + Math.cos(ang) * l1, y1 = f.y + Math.sin(ang) * l1;
        g.strokeStyle = `rgba(255,252,240,${a})`; g.lineWidth = (f.perfect ? 3.4 : 2.4) * (1 - u);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        gg.strokeStyle = f.col ? `rgba(255,120,80,${a})` : `rgba(150,190,255,${a})`; gg.lineWidth = 10 * (1 - u);
        gg.beginPath(); gg.moveTo(x0, y0); gg.lineTo(x1, y1); gg.stroke();
      }
      gg.globalAlpha = (1 - u) * .8; const s = (f.perfect ? 190 : 130) * (1 + u * .6);
      gg.drawImage(f.col ? AS.gOrange : AS.gWhite, f.x - s / 2, f.y - s / 2, s, s); gg.globalAlpha = 1;
    } else if (f.k === 'line' && layer === 2) {
      // anime-style horizon flash through the cut (screen space)
      const a = u < .15 ? u / .15 : 1 - (u - .15) / .85, w = V.W * Ease.outExpo(Math.min(1, u * 3));
      const y = f.y, cx = V.W / 2 + f.dir * V.W * .1;
      g.fillStyle = `rgba(255,255,255,${a * .95})`; g.fillRect(cx - w / 2, y - 1.5 * (1 - u) - .5, w, 3 * (1 - u) + 1);
      gg.fillStyle = `rgba(170,205,255,${a})`; gg.fillRect((cx - w / 2) / 2, (y - 8) / 2, w / 2, 8);
    } else if (f.k === 'stamp' && layer === 1) {
      drawStamp(g, f, u);
    } else if (f.k === 'pop' && layer === 1) {
      const a = u < .15 ? u / .15 : 1 - Math.max(0, (u - .55) / .45);
      g.save(); g.globalAlpha = a; g.translate(f.x, f.y - Ease.outCubic(u) * 50);
      g.font = `700 ${f.size}px "Yuji Boku", "Shippori Mincho", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(12,10,20,.85)'; g.strokeText(f.text, 0, 0);
      g.fillStyle = f.col || '#f3dc9a'; g.fillText(f.text, 0, 0); g.restore();
    }
  }
}
function drawSlashArc(g, gg, f, u) {
  const R = 214 * f.big, piv = [f.x, f.y];
  const a0 = -PI * .98, a1 = PI * .2;
  const head = a0 + (a1 - a0) * Ease.outQuint(Math.min(1, u * 2.6));
  const tail = a0 + (a1 - a0) * Ease.inCubic(Math.min(1, u * 1.15));
  if (head - tail < .02) return;
  const N = 34, outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = tail + (head - tail) * t;
    const th = Math.pow(Math.sin(t * PI), .7) * (f.perfect ? 34 : 24) * f.big * (1 - u * .7) + 1.5;
    const ca = Math.cos(a) * f.dir, sa = Math.sin(a);
    outer.push([piv[0] + ca * R, piv[1] + sa * R]); inner.push([piv[0] + ca * (R - th), piv[1] + sa * (R - th)]);
  }
  const path = (c) => { c.beginPath(); c.moveTo(outer[0][0], outer[0][1]); for (const p of outer) c.lineTo(p[0], p[1]); for (let i = inner.length - 1; i >= 0; i--) c.lineTo(inner[i][0], inner[i][1]); c.closePath(); };
  const a = u < .1 ? 1 : 1 - (u - .1) / .9;
  path(g); g.fillStyle = f.perfect ? `rgba(255,250,232,${a})` : `rgba(244,248,255,${a * .92})`; g.fill();
  g.strokeStyle = f.perfect ? `rgba(230,190,90,${a})` : `rgba(70,110,220,${a * .9})`; g.lineWidth = 2;
  g.beginPath(); for (let i = 0; i < outer.length; i++) { const p = outer[i]; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
  path(gg); gg.fillStyle = f.perfect ? `rgba(255,214,140,${a})` : `rgba(140,180,255,${a * .9})`; gg.fill();
}
function drawStamp(g, f, u) {
  const sIn = u < .14 ? lerp(2.2, 1, Ease.outBack(u / .14)) : 1, a = u < .1 ? u / .1 : u > .7 ? 1 - (u - .7) / .3 : 1;
  g.save(); g.translate(f.x, f.y - u * 26); g.rotate(f.rot); g.scale(sIn, sIn); g.globalAlpha = a;
  const s = f.kanji.length > 1 ? 70 : 56;
  if (f.red) {
    g.fillStyle = 'rgba(178,30,38,.94)';
    g.beginPath(); g.moveTo(-s / 2 + 2, -s / 2); g.lineTo(s / 2, -s / 2 + 3); g.lineTo(s / 2 - 2, s / 2); g.lineTo(-s / 2, s / 2 - 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,240,225,.85)'; g.lineWidth = 2.5; g.strokeRect(-s / 2 + 6, -s / 2 + 6, s - 12, s - 12);
    g.fillStyle = '#fff6ea';
  } else g.fillStyle = 'rgba(12,10,22,.95)';
  g.font = `${f.kanji.length > 1 ? 28 : 40}px "Yuji Boku", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (f.kanji.length > 1) { g.fillText(f.kanji[0], 0, -14); g.fillText(f.kanji[1], 0, 15); } else g.fillText(f.kanji, 0, 2);
  if (f.sub) {
    g.font = '800 15px "Shippori Mincho", serif'; g.fillStyle = f.red ? '#b21e26' : '#0c0a16';
    g.lineWidth = 4; g.strokeStyle = 'rgba(240,232,212,.85)'; g.strokeText(f.sub, 0, s / 2 + 16); g.fillText(f.sub, 0, s / 2 + 16);
  }
  g.restore();
}

/* ---------- static painted layers ---------- */
const CLOUDS = [];
function buildClouds() {
  const r = new Rand(77);
  const defs = [[0, .62, .02, .78, .16, 1], [1, -1.25, 0, .66, .12, .92], [3, 1.5, .32, .55, .22, .9], [4, .05, .46, .5, .08, .5], [2, -2.1, .3, .5, .2, .85]];
  for (const d of defs) CLOUDS.push({ spr: d[0], u: d[1], v: d[2], sc: d[3], par: d[4], a: d[5], off: 0, bob: r.f() * TAU });
}
function drawSky(g, t) {
  camT(g, V.pr, 0, 0); g.setTransform(V.pr, 0, 0, V.pr, 0, 0);
  g.fillStyle = rgba(C.paper); g.fillRect(0, 0, V.W, V.H);
  const gr = g.createRadialGradient(V.W * .55, V.H * .25, 0, V.W * .55, V.H * .3, Math.max(V.W, V.H) * .8);
  gr.addColorStop(0, 'rgba(255,250,236,.55)'); gr.addColorStop(1, 'rgba(206,192,160,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, V.W, V.H);
}
function drawSun(g, gg) {
  camT(g, V.pr, .04, .04); camT(gg, V.pr / 2, .04, .04);
  const x = V.halfW * (V.portrait ? .35 : .5), y = V.top * .62, R = 120;
  const gr = g.createRadialGradient(x, y, R * .2, x, y, R);
  gr.addColorStop(0, 'rgba(232,196,120,.34)'); gr.addColorStop(.86, 'rgba(222,182,104,.3)'); gr.addColorStop(1, 'rgba(222,182,104,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  gg.globalAlpha = .08; gg.drawImage(AS.gGold, x - 220, y - 220, 440, 440); gg.globalAlpha = 1;
}
function drawClouds(g, dt, layerFilter) {
  for (const c of CLOUDS) {
    if ((c.par >= .2) !== layerFilter) continue;
    const spr = AS.clouds[c.spr], spec = CLOUD_SPECS[c.spr];
    c.off += dt * (8 + 26 * c.par) * (1 + WIND.gust * 2);
    const w = spec.w * c.sc, h = spec.h * c.sc, span = V.halfW * 2.9 + w;
    let x = c.u * V.halfW + c.off; x = ((x + span / 2) % span + span) % span - span / 2;
    const y = lerp(V.top + h * .42, -260 - h * .3, c.v) + Math.sin(WIND.t * .3 + c.bob) * 6;
    camT(g, V.pr, c.par, c.par);
    g.globalAlpha = c.a; g.drawImage(spr, x - w / 2, y - h / 2, w, h); g.globalAlpha = 1;
  }
}

/* =========================================================================
   ACTORS — the masked samurai, his enemies, the oni, the wolf spirit
   All characters are drawn live as layered painted vector forms with
   pattern-filled fabric, ink contours and secondary motion.
   ========================================================================= */
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul2 = (a, k) => [a[0] * k, a[1] * k];
const rot2 = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const INK = 'rgba(8,10,26,.92)';
const NULLG = new Proxy({}, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
let PAT = {};
function makePatterns(g) {
  const mk = (k) => { const p = g.createPattern(AS.pat[k], 'repeat'); try { p.setTransform(new DOMMatrix([1 / AS.q, 0, 0, 1 / AS.q, 0, 0])); } catch {} return p; };
  PAT = { robe: mk('robe'), hakama: mk('hakama'), ronin: mk('ronin'), shinobi: mk('shinobi'), armor: mk('armor'), straw: mk('straw'), oni: mk('oni'), lining: mk('lining'), archer: mk('archer') };
}
function shapeQ(g, pts) {
  // closed smooth shape through midpoints
  const n = pts.length; g.beginPath();
  let m = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2]; g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}
function fillShade(g, fill, shadeFrom, shadeTo, a0, a1, outline, lw) {
  g.fillStyle = fill; g.fill();
  if (shadeFrom) {
    const gr = g.createLinearGradient(shadeFrom[0], shadeFrom[1], shadeTo[0], shadeTo[1]);
    gr.addColorStop(0, `rgba(6,10,40,${a0})`); gr.addColorStop(1, `rgba(6,10,40,${a1})`);
    g.fillStyle = gr; g.fill();
  }
  if (outline !== false) { g.strokeStyle = outline || INK; g.lineWidth = lw || 2.2; g.stroke(); }
}
function lerpPose(a, b, t) { const o = {}; for (const k in b) o[k] = lerp(a[k] != null ? a[k] : b[k], b[k], t); return o; }

/* ---------------- the katana ---------------- */
function drawKatana(g, G, dir, len, opts) {
  opts = opts || {};
  const n = [-dir[1], dir[0]];
  const base = add2(G, mul2(dir, 11)), tip = add2(G, mul2(dir, 11 + len)), mid = add2(G, mul2(dir, 11 + len * .55));
  const cv = 6 * (len / 200);
  // handle
  const pom = sub2(G, mul2(dir, 36));
  g.strokeStyle = '#120f16'; g.lineWidth = 7.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pom[0], pom[1]); g.lineTo(base[0], base[1]); g.stroke();
  g.fillStyle = opts.dull ? 'rgba(150,140,130,.55)' : 'rgba(225,215,195,.7)';
  for (let k = 0; k < 7; k++) { const p = sub2(G, mul2(dir, 3 + k * 4.6)); g.beginPath(); g.moveTo(p[0] + dir[0] * 1.6, p[1] + dir[1] * 1.6); g.lineTo(p[0] + n[0] * 2, p[1] + n[1] * 2); g.lineTo(p[0] - dir[0] * 1.6, p[1] - dir[1] * 1.6); g.lineTo(p[0] - n[0] * 2, p[1] - n[1] * 2); g.closePath(); g.fill(); }
  g.fillStyle = '#c9a24f'; g.beginPath(); g.arc(pom[0], pom[1], 4, 0, TAU); g.fill();
  // blade
  g.beginPath();
  g.moveTo(base[0] + n[0] * 3.4, base[1] + n[1] * 3.4);
  g.quadraticCurveTo(mid[0] + n[0] * (3.4 + cv), mid[1] + n[1] * (3.4 + cv), tip[0], tip[1]);
  g.quadraticCurveTo(mid[0] + n[0] * (cv - 2.8), mid[1] + n[1] * (cv - 2.8), base[0] - n[0] * 2.8, base[1] - n[1] * 2.8);
  g.closePath();
  const gr = g.createLinearGradient(base[0] + n[0] * 5, base[1] + n[1] * 5, base[0] - n[0] * 4, base[1] - n[1] * 4);
  if (opts.dull) { gr.addColorStop(0, '#5d6270'); gr.addColorStop(1, '#c4c8d0'); }
  else { gr.addColorStop(0, '#6f7a91'); gr.addColorStop(.45, '#c9d1e2'); gr.addColorStop(1, '#ffffff'); }
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(10,12,30,.75)'; g.lineWidth = 1; g.stroke();
  if (!opts.dull) {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = .9; g.beginPath();
    for (let i = 0; i <= 12; i++) { const t = i / 12, p = add2(base, mul2(dir, len * t * .96)); const w = Math.sin(i * 1.7) * .8 - 1.2 + cv * Math.sin(t * PI) * .9; const q = [p[0] + n[0] * w, p[1] + n[1] * w]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    g.stroke();
  }
  // habaki + tsuba
  g.fillStyle = '#d8b464'; const hb = add2(G, mul2(dir, 13));
  g.beginPath(); g.ellipse(hb[0], hb[1], 3.2, 3.6, Math.atan2(dir[1], dir[0]), 0, TAU); g.fill();
  const ts = add2(G, mul2(dir, 9));
  g.fillStyle = opts.dull ? '#3a3330' : '#c9a24f'; g.strokeStyle = 'rgba(40,24,6,.9)'; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(ts[0], ts[1], 3, 10, Math.atan2(dir[1], dir[0]), 0, TAU); g.fill(); g.stroke();
  return { base, tip };
}
function drawHand(g, p, dir, skin) {
  const a = Math.atan2(dir[1], dir[0]);
  g.save(); g.translate(p[0], p[1]); g.rotate(a);
  g.fillStyle = skin || '#d2a77f'; g.beginPath(); g.ellipse(0, 0, 7.5, 6.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(30,16,10,.85)'; g.lineWidth = 1.3; g.stroke();
  g.strokeStyle = 'rgba(245,238,222,.9)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-3, -6); g.lineTo(-3, 6); g.moveTo(2, -6); g.lineTo(2, 6); g.stroke();
  g.restore();
}


function drawArrow(g, gg, a) {
  g.save(); g.translate(a.x, a.y); g.rotate(a.rot);
  g.strokeStyle = '#3e2c1a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-40, 0); g.lineTo(26, 0); g.stroke();
  g.fillStyle = '#9aa1ad'; g.beginPath(); g.moveTo(26, -3.5); g.lineTo(38, 0); g.lineTo(26, 3.5); g.closePath(); g.fill();
  g.fillStyle = '#f1ebdc'; g.beginPath(); g.moveTo(-40, 0); g.lineTo(-30, -6); g.lineTo(-22, -6); g.lineTo(-30, 0); g.lineTo(-22, 6); g.lineTo(-30, 6); g.closePath(); g.fill();
  g.restore();
  if (!a.dead) { gg.globalAlpha = .4; gg.drawImage(AS.gWhite, a.x - 30, a.y - 30, 60, 60); gg.globalAlpha = 1; }
}

/* =========================================================================
   CORPSES — two clipped halves of the frozen enemy, flying apart
   ========================================================================= */
function makeCorpse(e, slashDir, perfect) {
  const ang = -.42 + rr(-.2, .2);
  const R = enemyRig(e);
  return {
    e: Object.assign({}, e, { pose: Object.assign({}, e.pose), noShadow: true, glint: 0, state: 'dead' }),
    cut: [R.H[0] + 4, R.Hd[1] + (R.H[1] - R.Hd[1]) * .62], ang, t: 0, life: 2.4,
    up: { x: 0, y: 0, vx: -rr(160, 320) * (perfect ? 1.4 : 1), vy: -rr(260, 420), r: 0, vr: -rr(2, 5) },
    lo: { r: 0, vr: 0, y: 0 }, perfect,
  };
}
function updateCorpse(c, dt) {
  c.t += dt;
  const u = c.up; u.vy += 1500 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.r += u.vr * dt;
  const floorY = -c.cut[1] - 30;
  if (u.y > floorY) { u.y = floorY; u.vy *= -.2; u.vx *= .6; u.vr *= .5; }
  if (c.t > .25) { c.lo.vr += -4 * dt; c.lo.r = Math.max(-1.45, c.lo.r + c.lo.vr * dt); c.lo.y = Math.min(12, c.lo.y + 30 * dt); }
  if (c.t < .5 && Math.random() < .6) inkBurst(c.wx + c.cut[0] * c.f, c.cut[1] + u.y * .3, -c.f, 2, 300, true);
}
function drawCorpse(g, gg, c) {
  const e = c.e, sc = ENEMY_KIND[e.kind].scale, a = c.t > c.life - .6 ? (c.life - c.t) / .6 : 1;
  const half = (upper) => {
    g.save(); g.globalAlpha = a;
    g.translate(e.x, 0); g.scale(e.face * sc, sc);
    if (upper) { g.translate(c.up.x, c.up.y); g.translate(c.cut[0], c.cut[1]); g.rotate(c.up.r); g.translate(-c.cut[0], -c.cut[1]); }
    else { g.translate(0, c.lo.y); g.rotate(c.lo.r * .9); }
    const cx = c.cut[0], cy = c.cut[1], ca = Math.cos(c.ang), sa = Math.sin(c.ang), L = 400, s = upper ? -1 : 1;
    g.beginPath();
    g.moveTo(cx - ca * L, cy - sa * L); g.lineTo(cx + ca * L, cy + sa * L);
    g.lineTo(cx + ca * L - sa * L * s, cy + sa * L + ca * L * s); g.lineTo(cx - ca * L - sa * L * s, cy - sa * L + ca * L * s); g.closePath();
    g.save(); g.clip();
    drawEnemy(g, NULLG, e);
    g.restore();
    // wound edge
    g.strokeStyle = 'rgba(120,14,22,.95)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - ca * 30, cy - sa * 30); g.lineTo(cx + ca * 30, cy + sa * 30); g.stroke();
    g.restore();
  };
  half(false); half(true);
}

/* =========================================================================
   THE WOLF SPIRIT
   ========================================================================= */
const WOLF = { a: .2, special: -1, pos: [0, 0], scale: 1, eye: [0, 0], fx: 0 };
function wolfHome() {
  if (GAME.mode === 'title') return V.portrait ? [V.camX - 40, V.top * .62] : [V.camX + V.halfW * .02, V.top * .6];
  return V.portrait ? [V.camX - V.halfW * .2, V.top * .66] : [V.camX - V.halfW * .44, V.top * .55];
}
function updateWolf(dt, gauge, samurai) {
  WOLF.fx += dt;
  const home = wolfHome();
  let tx = home[0], ty = home[1], ts = clamp(V.halfW / 760, .55, 1) * (.86 + gauge * .22), ta = .16 + gauge * .7;
  if (WOLF.special >= 0) {
    WOLF.special += dt;
    const s = WOLF.special;
    if (s < 1.9) { tx = V.camX - 40; ty = V.top * .5; ts = clamp(V.halfW / 600, .7, 1.35); ta = 1; }
    else WOLF.special = -1;
  }
  const k = 1 - Math.exp(-dt * (WOLF.special >= 0 ? 7 : 2.5));
  if (!WOLF.init) { WOLF.pos = [tx, ty]; WOLF.scale = ts; WOLF.a = ta; WOLF.init = true; }
  WOLF.pos[0] += (tx - WOLF.pos[0]) * k; WOLF.pos[1] += (ty - WOLF.pos[1]) * k;
  WOLF.scale += (ts - WOLF.scale) * k; WOLF.a += (ta - WOLF.a) * k;
  // spirit stream flowing from the mane to the samurai
  const rate = (gauge > .05 ? 4 + gauge * 28 : 2) * (WOLF.special >= 0 ? 3 : 1);
  if (Math.random() < rate * dt) {
    const w = AS.wolf, sc = WOLF.scale;
    const a0 = [WOLF.pos[0] + (w.w * .32 - w.w / 2) * sc, WOLF.pos[1] + rr(-60, 80) * sc];
    const b = [samurai.x - samurai.face * 20, -200];
    const t = Math.random();
    const c = [lerp(a0[0], b[0], .5) - 120, lerp(a0[1], b[1], .5) + 120];
    const p = quadPt(a0, c, b, t), tg = quadTan(a0, c, b, t);
    addP({ k: 'ember', x: p[0], y: p[1], vx: tg[0] * 120, vy: tg[1] * 120, life: rr(1, 1.8), t: 0, s: rr(.25, .5) * (gauge + .4), rot: rr(0, TAU), vr: rr(-1, 1), spr: (Math.random() * 7) | 0 });
  }
}
function drawWolf(g, gg) {
  const w = AS.wolf, sc = WOLF.scale, x = WOLF.pos[0], y = WOLF.pos[1];
  const bob = Math.sin(WOLF.fx * 1.3) * 8, br = 1 + Math.sin(WOLF.fx * 2.1) * .012;
  const roar = WOLF.special >= 0 ? Math.max(0, Math.sin(Math.min(1, WOLF.special / 1.6) * PI)) : 0;
  const shk = roar * 6;
  const dx = x - w.w / 2 * sc + rr(-shk, shk), dy = y + bob - w.h / 2 * sc + rr(-shk, shk);
  g.globalAlpha = clamp(WOLF.a, 0, 1);
  g.drawImage(w.canvas, dx, dy, w.w * sc * br, w.h * sc * br);
  g.globalAlpha = 1;
  const ex = dx + w.eye[0] * sc, ey = dy + w.eye[1] * sc, ea = clamp(WOLF.a * 1.1 - .1, 0, 1);
  WOLF.eye = [ex, ey];
  gg.globalAlpha = ea; const es = 70 * sc * (1 + roar);
  gg.drawImage(AS.gOrange, ex - es / 2, ey - es / 2, es, es); gg.globalAlpha = 1;
  if (WOLF.a > .5) { gg.globalAlpha = (WOLF.a - .5) * .35 + roar * .4; gg.drawImage(AS.gBlue, x - 380 * sc, y - 260 * sc, 760 * sc, 520 * sc); gg.globalAlpha = 1; }
}

/* =========================================================================
   THE ONI
   ========================================================================= */
class Oni {
  constructor() {
    this.hp = 8; this.max = 8; this.t = 0; this.state = 'intro'; this.alpha = 0; this.flash = 0; this.cracks = []; this.arms = []; this.shake = 0; this.dead = false; this.deathT = 0;
  }
  get pos() { return [V.camX, V.top * (V.portrait ? .66 : .72) + (1 - Ease.outCubic(Math.min(1, this.t / 2.2))) * 160]; }
  get scale() { return clamp(V.halfW / 1100, .44, .66) * (this.state === 'intro' ? lerp(.82, 1, Ease.outCubic(Math.min(1, this.t / 2.2))) : 1); }
  update(dt) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 4); this.shake = Math.max(0, this.shake - dt * 3);
    if (this.state === 'intro') { this.alpha = Math.min(1, this.t / 1.4); if (this.t > 2.2) this.state = 'fight'; }
    if (this.state === 'dying') {
      this.deathT += dt; this.shake = .8;
      if (Math.random() < dt * 30) this.addCrack();
      if (this.deathT > 1.5 && !this.dead) { this.dead = true; this.state = 'gone'; }
    }
    if (this.state === 'leave') { this.alpha = Math.max(0, this.alpha - dt * .8); }
    for (const a of this.arms) a.t += dt;
  }
  addCrack() {
    const r = new Rand((Math.random() * 1e9) | 0);
    const pts = [[r.range(-120, 120), r.range(-150, 170)]];
    let a = r.f() * TAU;
    for (let i = 0; i < r.int(5, 10); i++) { a += r.range(-.9, .9); const p = pts[pts.length - 1]; pts.push([p[0] + Math.cos(a) * r.range(14, 34), p[1] + Math.sin(a) * r.range(14, 34)]); }
    this.cracks.push(pts);
  }
  hurt() { this.hp--; this.flash = 1; this.shake = .5; this.addCrack(); this.addCrack(); }
  drawFace(g, gg) {
    if (this.alpha <= 0 || this.state === 'gone') return;
    const o = AS.oni, [x, y] = this.pos, sc = this.scale;
    const sh = this.shake * 10, jx = rr(-sh, sh), jy = rr(-sh, sh);
    g.save(); g.translate(x + jx, y + jy); g.scale(sc, sc);
    g.globalAlpha = clamp(this.alpha * (this.state === 'dying' ? 1 - Math.max(0, this.deathT - 1.2) / .3 : 1), 0, 1);
    g.drawImage(o.canvas, -o.w / 2, -o.h / 2, o.w, o.h);
    if (this.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = this.flash * .35; g.drawImage(o.canvas, -o.w / 2, -o.h / 2, o.w, o.h); g.globalCompositeOperation = 'source-over'; }
    g.globalAlpha = 1;
    // kintsugi cracks
    const off = [-o.w / 2 + o.cx, -o.h / 2 + o.cy];
    for (const c of this.cracks) {
      g.strokeStyle = 'rgba(40,20,4,.85)'; g.lineWidth = 6; g.beginPath(); c.forEach((p, i) => i ? g.lineTo(p[0] + off[0], p[1] + off[1]) : g.moveTo(p[0] + off[0], p[1] + off[1])); g.stroke();
      g.strokeStyle = '#f1d283'; g.lineWidth = 3; g.stroke();
    }
    g.restore();
    // glowing eyes + cracks on glow layer
    gg.save(); gg.translate(x + jx, y + jy); gg.scale(sc, sc);
    const ea = this.alpha * (.75 + .25 * Math.sin(this.t * 6));
    for (const e of o.eyes) { gg.globalAlpha = ea; gg.drawImage(AS.gOrange, e[0] - o.w / 2 - 70, e[1] - o.h / 2 - 50, 140, 100); }
    gg.globalAlpha = 1;
    const glow = this.state === 'dying' ? 1 : .6;
    if (this.state === 'dying') {
      // god rays bursting through the cracks
      const k = clamp(this.deathT / 1.4, 0, 1), r = new Rand(99);
      for (let i = 0; i < 14; i++) {
        const a = r.f() * TAU + this.deathT * .3, len = (300 + r.f() * 500) * k, w = 20 + r.f() * 40;
        gg.save(); gg.rotate(a); gg.globalAlpha = .35 * k;
        const lg = gg.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, 'rgba(255,220,140,1)'); lg.addColorStop(1, 'rgba(255,220,140,0)');
        gg.fillStyle = lg; gg.beginPath(); gg.moveTo(0, -w * .2); gg.lineTo(len, -w); gg.lineTo(len, w); gg.lineTo(0, w * .2); gg.closePath(); gg.fill(); gg.restore();
      }
      gg.globalAlpha = 1;
    }
    for (const c of this.cracks) { gg.strokeStyle = `rgba(255,214,120,${glow})`; gg.lineWidth = this.state === 'dying' ? 18 : 9; gg.beginPath(); c.forEach((p, i) => i ? gg.lineTo(p[0] + off[0], p[1] + off[1]) : gg.moveTo(p[0] + off[0], p[1] + off[1])); gg.stroke(); }
    gg.restore();
  }
  /* giant arm reaching down to the field */
  drawArm(g, gg, arm) {
    if (this.state === 'gone') return;
    const [fx, fy] = this.pos, sc = this.scale, s = arm.side, hand = arm.hand;
    const sh = [fx + s * 210 * sc, fy + 150 * sc];
    const mid = lerp2(sh, hand, .5);
    const el = [mid[0] + s * 150, mid[1] - 70];
    const N = 18, pts = []; for (let i = 0; i <= N; i++) pts.push(quadPt(sh, el, hand, i / N));
    const prof = t => (1.15 - t * .62) * (1 + .16 * Math.sin(t * PI * 2.2));
    g.save(); g.globalAlpha = this.alpha;
    // underside shadow, limb, outline
    g.fillStyle = 'rgba(30,2,6,.4)'; ribbon(g, pts.map(p => [p[0] + 10, p[1] + 14]), 96, prof, 0);
    const poly = ribbonPoly(pts, 96, prof, 0, { f: () => .5 });
    g.beginPath(); g.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]); g.closePath();
    g.fillStyle = PAT.oni; g.fill();
    const lg = g.createLinearGradient(sh[0], sh[1] - 60, hand[0], hand[1] + 60); lg.addColorStop(0, 'rgba(255,140,110,.18)'); lg.addColorStop(1, 'rgba(30,2,6,.35)');
    g.fillStyle = lg; g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; g.stroke();
    // black fur tufts along the forearm
    g.fillStyle = 'rgba(10,6,8,.9)';
    for (let i = 6; i < N - 2; i += 2) { const p = pts[i], tg = quadTan(sh, el, hand, i / N), nn = [-tg[1], tg[0]], w = 46 * prof(i / N); ribbon(g, [add2(p, mul2(nn, w * .9)), add2(p, add2(mul2(nn, w * 1.4), mul2(tg, -18))), add2(p, add2(mul2(nn, w * 1.6), mul2(tg, -34)))], 9, PROF.flame, 0); }
    // gold bracelet
    const wr = quadPt(sh, el, hand, .84), wt = quadTan(sh, el, hand, .84);
    g.save(); g.translate(wr[0], wr[1]); g.rotate(Math.atan2(wt[1], wt[0]));
    const bgd = g.createLinearGradient(0, -34, 0, 34); bgd.addColorStop(0, '#fff1c2'); bgd.addColorStop(.5, '#c9a24f'); bgd.addColorStop(1, '#7a5a20');
    g.fillStyle = bgd; g.beginPath(); g.rect(-9, -32, 18, 64); g.fill(); g.strokeStyle = 'rgba(60,30,4,.9)'; g.lineWidth = 2; g.stroke();
    g.restore();
    // clawed hand
    const ht = quadTan(sh, el, hand, 1);
    g.save(); g.translate(hand[0], hand[1]); g.rotate(Math.atan2(ht[1], ht[0]));
    g.beginPath(); g.moveTo(-26, -30); g.quadraticCurveTo(20, -40, 34, -10); g.quadraticCurveTo(38, 18, 10, 34); g.quadraticCurveTo(-24, 34, -30, 10); g.closePath();
    g.fillStyle = PAT.oni; g.fill(); g.fillStyle = 'rgba(30,2,6,.25)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    for (let k = 0; k < 4; k++) {
      const a = -.55 + k * .36, bx = Math.cos(a) * 30, by = Math.sin(a) * 30;
      g.save(); g.translate(bx, by); g.rotate(a + .25);
      g.fillStyle = PAT.oni; ribbon(g, [[0, 0], [16, 2], [30, 8]], 14, t => 1 - t * .35, 0);
      g.fillStyle = '#0d0a0c'; g.beginPath(); g.moveTo(26, 2); g.quadraticCurveTo(46, 6, 56, 24); g.quadraticCurveTo(40, 14, 26, 14); g.closePath(); g.fill();
      g.fillStyle = '#e6c675'; g.beginPath(); g.moveTo(46, 12); g.quadraticCurveTo(52, 16, 56, 24); g.quadraticCurveTo(50, 20, 44, 18); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    g.restore();
    if (arm.state === 'wind' || arm.state === 'strike') {
      const k = arm.state === 'wind' ? .4 + .6 * Math.min(1, arm.t / Math.max(.1, arm.windDur)) : 1;
      gg.globalAlpha = k; gg.drawImage(AS.gRed, hand[0] - 100, hand[1] - 100, 200, 200); gg.globalAlpha = 1;
    }
  }
}

/* =========================================================================
   FIGURE — a small 2D character rig (IK arms and legs) dressed in painted
   costume layers: hakama, kimono, hanging sleeves, armour, masks, hats.
   Local space: facing +x, feet on y = 0, up is −y.
   ========================================================================= */
const nrm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function ik2(S, T, L1, L2, choose) {
  let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
  const mx = L1 + L2 - .5; let tx = T[0], ty = T[1];
  if (d > mx) { tx = S[0] + dx / d * mx; ty = S[1] + dy / d * mx; d = mx; }
  d = Math.max(d, 1e-3);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), b = Math.atan2(ty - S[1], tx - S[0]);
  const e1 = [S[0] + Math.cos(b + a) * L1, S[1] + Math.sin(b + a) * L1], e2 = [S[0] + Math.cos(b - a) * L1, S[1] + Math.sin(b - a) * L1];
  return { E: choose(e1, e2), T: [tx, ty] };
}
const kneeFwd = (a, b) => a[0] > b[0] ? a : b;
const elbowDown = (a, b) => a[1] > b[1] ? a : b;
function perpOut(a, b, sign) { const d = nrm2(sub2(b, a)); let n = [-d[1], d[0]]; if (n[0] * sign < 0 || (Math.abs(n[0]) < .05 && n[1] > 0)) n = [-n[0], -n[1]]; return n; }
function perpUp(a, b) { const d = nrm2(sub2(b, a)); let n = [-d[1], d[0]]; if (n[1] > 0) n = [-n[0], -n[1]]; return n; }
function smoothPath(g, pts, closed = true) {
  const n = pts.length; g.beginPath();
  if (!closed) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const m = lerp2(pts[i], pts[i + 1], .5); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } g.lineTo(pts[n - 1][0], pts[n - 1][1]); return; }
  let m = lerp2(pts[n - 1], pts[0], .5); g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mm = lerp2(p, q, .5); g.quadraticCurveTo(p[0], p[1], mm[0], mm[1]); }
  g.closePath();
}
function shadeFill(g, fill, from, to, a0, a1, col) {
  g.fillStyle = fill; g.fill();
  const gr = g.createLinearGradient(from[0], from[1], to[0], to[1]);
  const c = col || '6,10,40';
  gr.addColorStop(0, `rgba(${c},${a0})`); gr.addColorStop(1, `rgba(${c},${a1})`);
  g.fillStyle = gr; g.fill();
}

/* ---------------- costumes ---------------- */
const COSTUME = {
  samurai: { robe: 'robe', hak: 'hakama', legs: 'hakama', hipW: 17, kneeW: 22, hemW: 33, hang: 58, trim: true, belt: 'obi', head: 'mask', skin: '#d4aa82', sleeveTrim: true },
  ronin: { robe: 'ronin', hak: 'ronin', legs: 'hakama', hipW: 14, kneeW: 17, hemW: 24, hang: 38, ragged: true, belt: 'sash', sash: '#8f1d25', head: 'kasa', skin: '#b98c66' },
  armored: { robe: 'armor', hak: 'hakama', legs: 'hakama', hipW: 15, kneeW: 18, hemW: 24, hang: 16, belt: 'none', head: 'kabuto', skin: '#b98c66', armor: true, darkHak: true },
  shinobi: { robe: 'shinobi', hak: 'shinobi', legs: 'pants', hipW: 10, kneeW: 9, hemW: 8, hang: 10, belt: 'sash', sash: '#3a0a10', head: 'hood', skin: '#c9a07a' },
  archer: { robe: 'archer', hak: 'ronin', legs: 'hakama', hipW: 14, kneeW: 17, hemW: 22, hang: 32, belt: 'sash', sash: '#c9a24f', head: 'kasa', skin: '#b98c66', ragged: true },
};

/* ---------------- legs ---------------- */
function drawLeg(g, L, out, cos, back, t, flap) {
  const H = L.H, K = L.K, A = L.A;
  const nT = perpOut(H, K, out), nS = perpOut(K, A, out);
  const shade = back ? .28 : 0;
  if (cos.legs === 'hakama') {
    const fl = (flap || 0) * out;
    const hipO = add2(H, mul2(nT, cos.hipW)), hipI = add2(H, mul2(nT, -cos.hipW * .7));
    const kO = add2(K, mul2(nT, cos.kneeW + 5)), kI = add2(K, mul2(nS, -cos.kneeW * .85));
    const hy = Math.max(A[1] + 3, -2) + (A[1] < -6 ? 0 : 0);
    const hemO = [A[0] + nS[0] * cos.hemW + fl * 8 + out * 6, hy], hemI = [A[0] - nS[0] * cos.hemW * .9 - out * 4, hy];
    if (A[1] < -6) { hemO[1] = A[1] + 4; hemI[1] = A[1] + 6; }
    const crotch = lerp2(add2(H, mul2(nT, -cos.hipW * .5)), K, .55);
    g.beginPath(); g.moveTo(hipI[0], hipI[1]); g.lineTo(hipO[0], hipO[1]);
    g.quadraticCurveTo(kO[0], kO[1], hemO[0], hemO[1]);
    const n = 7;
    for (let i = 1; i <= n; i++) { const u = i / n; const x = lerp(hemO[0], hemI[0], u), y = lerp(hemO[1], hemI[1], u) + (cos.ragged ? (i % 2 ? -7 : 2) : Math.sin(u * PI * 3 + t * 7) * 1.4); g.lineTo(x, y); }
    g.quadraticCurveTo(kI[0], kI[1], crotch[0], crotch[1]);
    g.closePath();
    const fill = cos.darkHak ? PAT.shinobi : PAT[cos.hak];
    shadeFill(g, fill, H, [A[0], A[1]], .02 + shade, .38 + shade);
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    // pleats
    g.strokeStyle = back ? 'rgba(4,8,30,.55)' : 'rgba(6,10,40,.5)'; g.lineWidth = 1.3;
    for (let k = 1; k <= 3; k++) {
      const u = k / 4, a = lerp2(hipO, hipI, u), b = lerp2(hemO, hemI, u), c = lerp2(kO, kI, u);
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]); g.stroke();
    }
    // light catching the forward folds
    if (!back) { g.strokeStyle = 'rgba(200,215,255,.22)'; g.lineWidth = 2.5; const a = lerp2(hipO, hipI, .15), b = lerp2(hemO, hemI, .12), c = lerp2(kO, kI, .1); g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]); g.stroke(); }
    if (cos.trim) { g.strokeStyle = 'rgba(214,176,92,.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(hemO[0], hemO[1] - 3); g.lineTo(hemI[0], hemI[1] - 3); g.stroke(); }
  } else {
    // fitted trousers with shin wraps
    g.fillStyle = PAT[cos.hak];
    ribbon(g, [add2(H, mul2(nT, 2)), K, A], cos.hipW * 2 + 4, t2 => 1 - t2 * .45, 0);
    if (back) { g.fillStyle = 'rgba(4,6,20,.35)'; ribbon(g, [H, K, A], cos.hipW * 2 + 4, t2 => 1 - t2 * .45, 0); }
    g.strokeStyle = 'rgba(235,228,210,.85)'; g.lineWidth = 2;
    for (let k = 1; k < 5; k++) { const q = lerp2(K, A, .25 + k * .14); g.beginPath(); g.moveTo(q[0] - 6, q[1] - 2); g.lineTo(q[0] + 6, q[1] + 2); g.stroke(); }
  }
  // tabi + waraji sandal
  const fd = A[1] < -6 ? nrm2([1, .35]) : [1, 0];
  g.save(); g.translate(A[0], A[1]); g.rotate(Math.atan2(fd[1], fd[0]));
  g.fillStyle = '#efe8d6'; g.beginPath(); g.moveTo(-8, -6); g.quadraticCurveTo(10, -9, 16, -2); g.lineTo(16, 1); g.lineTo(-9, 1); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = '#b8995e'; g.fillRect(-10, 1, 28, 3.2);
  g.strokeStyle = 'rgba(60,40,20,.9)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(8, -6); g.lineTo(2, 1); g.moveTo(8, -6); g.lineTo(12, 1); g.stroke();
  g.restore();
}

/* ---------------- arms & sleeves ---------------- */
function drawArm(g, arm, cos, flap, back) {
  const S = arm.S, E = arm.E, W = arm.W;
  const C = lerp2(E, W, cos.hang > 20 ? .38 : .7);
  // forearm skin first, the sleeve covers its root
  g.fillStyle = cos.skin; ribbon(g, [C, W], 10, t => 1 - t * .25, 0);
  g.strokeStyle = 'rgba(40,20,10,.75)'; g.lineWidth = 1.1;
  const fa = nrm2(sub2(W, C)), fn = [-fa[1], fa[0]];
  for (let k = 1; k < 4; k++) { const q = lerp2(C, W, .2 + k * .2); g.beginPath(); g.moveTo(q[0] + fn[0] * 5, q[1] + fn[1] * 5); g.lineTo(q[0] - fn[0] * 5 + fa[0] * 3, q[1] - fn[1] * 5 + fa[1] * 3); g.stroke(); }
  if (cos.armor) {
    // armoured sleeve (kote) + hanging sode plate
    g.fillStyle = PAT.armor; ribbon(g, [S, E, C], 17, t => 1 - t * .2, 0);
    g.strokeStyle = 'rgba(200,160,80,.8)'; g.lineWidth = 1.2; smoothPath(g, [S, E, C], false); g.stroke();
    const sd = add2(S, [0, 2]);
    g.save(); g.translate(sd[0], sd[1]); g.rotate(clamp((Math.atan2(E[1] - S[1], E[0] - S[0]) - PI / 2) * .35, -.6, .6));
    g.beginPath(); g.moveTo(-17, -4); g.lineTo(17, -6); g.lineTo(19, 40); g.lineTo(-15, 42); g.closePath();
    shadeFill(g, PAT.armor, [0, -4], [0, 42], back ? .25 : 0, .35);
    g.strokeStyle = 'rgba(214,170,86,.95)'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#9c1f27'; for (let k = 0; k < 3; k++) g.fillRect(-15 + k * 13, -2, 4, 4);
    g.restore();
    return;
  }
  const ua = nrm2(sub2(E, S)), uf = nrm2(sub2(C, E)), horiz = 1 - Math.abs(uf[1]) * .5;
  const hang = cos.hang * (.72 + .28 * horiz);
  const nu = perpUp(S, E), nf = perpUp(E, C);
  const sTop = add2(S, mul2(nu, 14)), eTop = add2(E, mul2(nu, 14)), cTop = add2(C, mul2(nf, 15)), cBot = add2(C, mul2(nf, -15));
  const fx = flap ? flap[0] : 0, fy = flap ? flap[1] : 0;
  const low = Math.max(E[1], C[1], S[1] - 10);
  const bag2 = [cBot[0] + fx * .7 + uf[0] * 4, Math.max(cBot[1] + hang * .55, low + hang * .62) + fy * .6];
  const bag1 = [lerp(E[0], S[0], .35) + fx - ua[0] * 8, Math.max(E[1], S[1]) + hang + fy];
  const pit = add2(S, [-ua[0] * 6, 16]);
  const shape = [sTop, eTop, cTop, cBot, bag2, bag1, pit];
  smoothPath(g, shape);
  const top = Math.min(sTop[1], eTop[1], cTop[1]);
  g.fillStyle = PAT[cos.robe]; g.fill();
  if (!back) { g.fillStyle = 'rgba(150,180,255,.14)'; g.fill(); }
  const sg = g.createLinearGradient(0, top, 0, bag1[1]);
  sg.addColorStop(0, back ? 'rgba(6,10,40,.25)' : 'rgba(160,190,255,.12)'); sg.addColorStop(.55, back ? 'rgba(6,10,40,.4)' : 'rgba(6,10,40,.12)'); sg.addColorStop(1, back ? 'rgba(4,6,30,.7)' : 'rgba(4,8,36,.55)');
  g.fillStyle = sg; g.fill();
  g.strokeStyle = INK; g.lineWidth = 2.1; g.stroke();
  // folds falling from the arm
  g.strokeStyle = back ? 'rgba(2,4,20,.5)' : 'rgba(4,8,36,.45)'; g.lineWidth = 1.4;
  for (const u of [.35, .7]) { const a = lerp2(eTop, cBot, u * .7), b = lerp2(bag2, bag1, u); g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(lerp(a[0], b[0], .5) + 6, lerp(a[1], b[1], .5), b[0], b[1]); g.stroke(); }
  // hem of the hanging bag: gold trim (or frayed)
  if (cos.sleeveTrim) { g.strokeStyle = 'rgba(214,176,92,.9)'; g.lineWidth = 2; smoothPath(g, [lerp2(cBot, bag2, .4), bag2, bag1], false); g.stroke(); }
  // rim light along the top of the sleeve
  if (!back) { g.strokeStyle = 'rgba(232,238,255,.6)'; g.lineWidth = 2.6; smoothPath(g, [lerp2(sTop, eTop, .15), eTop, lerp2(eTop, cTop, .85)], false); g.stroke(); }
  // cuff opening + lining + gold trim
  g.save(); g.translate(C[0], C[1]); g.rotate(Math.atan2(fa[1], fa[0]));
  g.fillStyle = 'rgba(6,8,34,.96)'; g.beginPath(); g.ellipse(1, 0, 4.5, 11, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(236,226,200,.95)'; g.lineWidth = 2; g.stroke();
  if (cos.sleeveTrim) { g.strokeStyle = 'rgba(214,176,92,.9)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(-2, 0, 5, 12.5, 0, -1.4, 1.4); g.stroke(); }
  g.restore();
}

/* ---------------- torso, belt ---------------- */
function drawTorso(g, K, cos, ext) {
  const T = (x, y) => add2(K.H, rot2(x, y, K.lean));
  const pts = [T(-22, -2), T(-27, -44), T(-23, -77), T(-9, -88), T(11, -88), T(21, -78), T(26, -50), T(21, -2)];
  smoothPath(g, pts);
  shadeFill(g, PAT[cos.robe], T(16, -60), T(-24, -20), 0, .38);
  g.strokeStyle = INK; g.lineWidth = 2.1; g.stroke();
  if (!cos.armor) {
    g.strokeStyle = 'rgba(4,8,36,.5)'; g.lineWidth = 1.5;
    smoothPath(g, [T(-16, -70), T(-10, -40), T(-2, -8)], false); g.stroke();
    smoothPath(g, [T(-22, -30), T(-14, -18), T(-10, -4)], false); g.stroke();
  }
  if (cos.armor) {
    g.strokeStyle = 'rgba(214,170,86,.95)'; g.lineWidth = 2.2;
    for (const y of [-74, -40, -12]) { g.beginPath(); const a = T(-21, y), b = T(20, y); g.moveTo(a[0], a[1]); g.quadraticCurveTo(T(0, y + 4)[0], T(0, y + 4)[1], b[0], b[1]); g.stroke(); }
    g.fillStyle = '#8e1820'; const kn = T(-18, -34); g.beginPath(); g.ellipse(kn[0], kn[1], 5, 7, 0, 0, TAU); g.fill();
    return;
  }
  // inner collar, lapel and chest shadow
  g.fillStyle = 'rgba(8,10,40,.9)'; g.beginPath(); const c1 = T(-1, -86), c2 = T(10, -86), c3 = T(14, -46), c4 = T(9, -40); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c3[0], c3[1]); g.lineTo(c4[0], c4[1]); g.closePath(); g.fill();
  if (cos.head === 'mask' || cos.head === 'kasa') {
    g.fillStyle = 'rgba(240,233,214,.96)'; ribbon(g, [T(-2, -88), T(5, -64), T(10, -40)], 5, PROF.lift, 0);
    g.fillStyle = cos.trim ? 'rgba(214,176,92,.96)' : 'rgba(30,30,40,.8)'; ribbon(g, [T(9, -88), T(14, -64), T(15, -40)], 3.6, PROF.lift, 0);
  }
  // back shoulder rim light
  g.strokeStyle = 'rgba(230,236,255,.4)'; g.lineWidth = 2.6; smoothPath(g, [T(-22, -50), T(-18, -74), T(-6, -86)], false); g.stroke();
}
function drawBelt(g, K, cos, ext) {
  const T = (x, y) => add2(K.H, rot2(x, y, K.lean));
  if (cos.belt === 'none') return;
  const b = [T(-22, -14), T(20, -15), T(21, -3), T(-22, -2)];
  g.beginPath(); g.moveTo(b[0][0], b[0][1]); b.forEach(p => g.lineTo(p[0], p[1])); g.closePath();
  if (cos.belt === 'obi') { shadeFill(g, PAT.lining, b[0], b[2], .02, .3); g.strokeStyle = 'rgba(214,176,92,.95)'; g.lineWidth = 1.6; const a = T(-22, -9), c = T(20, -9); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); }
  else { g.fillStyle = cos.sash; g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(b[0][0], b[0][1]); b.forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.stroke();
  // knot with fluttering tails
  const kn = T(cos.belt === 'obi' ? 18 : -21, -8), fl = ext.obi || 0, tt = ext.t || 0;
  g.fillStyle = cos.belt === 'obi' ? PAT.lining : cos.sash;
  for (const s of [0, 1]) ribbon(g, [kn, [kn[0] + (s ? 6 : -4) + fl * 6, kn[1] + 16], [kn[0] + (s ? 10 : -6) + fl * 18 + Math.sin(tt * 9 + s) * 3, kn[1] + 32 + s * 6]], 7, PROF.lift, 0);
  g.beginPath(); g.ellipse(kn[0], kn[1], 6, 5, .3, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
}

/* ---------------- heads ---------------- */
function drawMask(g, gg, c, a) {
  g.save(); g.translate(c[0], c[1]); g.rotate(a); g.scale(1.3, 1.3);
  g.fillStyle = 'rgba(244,240,230,.97)';
  for (let k = 0; k < 8; k++) ribbon(g, [[-3 + k * 2, -17], [-10 + k, -25 - (k % 3) * 3], [-20 + k * .5, -23 - k * 1.5]], 5, PROF.taper, 0);
  const horn = (pts) => { const hg = g.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]); hg.addColorStop(0, '#8d6a2a'); hg.addColorStop(.5, '#e6c675'); hg.addColorStop(1, '#fff1c2'); g.fillStyle = hg; ribbon(g, pts, 6.5, t => 1 - t * .9, 0); };
  horn([[-5, -15], [-12, -24], [-20, -36]]); horn([[7, -16], [6, -28], [-1, -41]]);
  const face = [[-10, -17], [6, -20], [15, -11], [17, 1], [12, 13], [3, 19], [-7, 15], [-12, 4], [-13, -8]];
  shapeQ(g, face);
  const fg = g.createLinearGradient(0, -20, 6, 20); fg.addColorStop(0, '#4a74e8'); fg.addColorStop(.55, '#2446c0'); fg.addColorStop(1, '#14287f');
  g.fillStyle = fg; g.fill();
  g.fillStyle = 'rgba(190,212,255,.4)'; g.beginPath(); g.ellipse(4, -11, 8, 3.6, -.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(8,14,60,.35)'; g.beginPath(); g.ellipse(-6, 4, 6, 10, .2, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.6; shapeQ(g, face); g.stroke();
  g.fillStyle = 'rgba(8,10,40,.95)';
  ribbon(g, [[-2, -7], [5, -11.5], [9.5, -9]], 3.4, PROF.taper, 0); ribbon(g, [[10.5, -10], [14, -12.5], [17, -8]], 2.6, PROF.taper, 0);
  for (const e of [[4, -5, 4.2], [13.5, -5, 3]]) {
    g.fillStyle = '#f2c94c'; g.beginPath(); g.ellipse(e[0], e[1], e[2], e[2] * .58, -.15, 0, TAU); g.fill();
    g.fillStyle = '#0a0606'; g.beginPath(); g.arc(e[0] + .8, e[1], 1.3, 0, TAU); g.fill();
  }
  g.fillStyle = '#4c0a12'; g.beginPath(); g.moveTo(1, 6); g.quadraticCurveTo(8, 3, 15, 5); g.quadraticCurveTo(13, 14, 7, 14.5); g.quadraticCurveTo(2, 14, 1, 6); g.fill();
  g.strokeStyle = '#b3242c'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = '#f5f0e2';
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(3 + k * 3, 6); g.lineTo(4.5 + k * 3, 6); g.lineTo(3.8 + k * 3, 8.6); g.fill(); }
  g.beginPath(); g.moveTo(5, 14); g.lineTo(6, 10.5); g.lineTo(7, 14); g.fill(); g.beginPath(); g.moveTo(11, 13.5); g.lineTo(12, 10); g.lineTo(13, 13.5); g.fill();
  g.restore();
  gg.save(); gg.translate(c[0], c[1]); gg.rotate(a); gg.scale(1.3, 1.3); gg.globalAlpha = .5;
  for (const e of [[4, -5], [13.5, -5]]) gg.drawImage(AS.gGold, e[0] - 9, e[1] - 9, 18, 18);
  gg.restore();
}
function drawHead(g, gg, K, cos, e) {
  const c = K.Hd, a = K.headA, kind = cos.head;
  if (kind === 'mask') return drawMask(g, gg, c, a);
  g.save(); g.translate(c[0], c[1]); g.rotate(a);
  const angry = e && e.state === 'windup';
  if (kind === 'kasa') {
    g.fillStyle = '#2a1d17'; g.beginPath(); g.ellipse(1, 3, 12, 14, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(8,5,5,.9)'; g.beginPath(); g.ellipse(4, 1, 12, 9, 0, 0, TAU); g.fill();
    g.fillStyle = angry ? '#ffdf9a' : 'rgba(240,230,210,.9)'; g.beginPath(); g.ellipse(9, 0, 2.6, 1.2, -.2, 0, TAU); g.fill();
    if (angry) { gg.save(); gg.translate(c[0], c[1]); gg.rotate(a); gg.drawImage(AS.gOrange, -5, -12, 26, 24); gg.restore(); }
    g.beginPath(); g.moveTo(-54, 3); g.quadraticCurveTo(-22, -6, -1, -33); g.quadraticCurveTo(24, -6, 56, 5); g.quadraticCurveTo(0, 11, -54, 3); g.closePath();
    shadeFill(g, PAT.straw, [0, -32], [0, 9], 0, .5, '30,20,8');
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(80,58,24,.6)'; g.lineWidth = 1;
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(-1, -31); g.lineTo(k * 13, 4 + Math.abs(k) * .3); g.stroke(); }
    g.strokeStyle = 'rgba(255,236,190,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-1, -31); g.quadraticCurveTo(18, -12, 50, 2); g.stroke();
  } else if (kind === 'kabuto') {
    // shikoro neck guard
    g.beginPath(); g.moveTo(-15, -10); g.lineTo(13, -10); g.lineTo(18, 12); g.lineTo(-28, 15); g.closePath();
    shadeFill(g, PAT.armor, [0, -10], [0, 15], 0, .35); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(214,170,86,.9)'; g.lineWidth = 1.3;
    for (const y of [-3, 4, 11]) { g.beginPath(); g.moveTo(-16 - (y + 10) * .5, y); g.lineTo(14 + (y + 10) * .2, y); g.stroke(); }
    // menpo
    g.fillStyle = '#8e1820'; g.beginPath(); g.moveTo(-2, -4); g.lineTo(15, -6); g.lineTo(17, 9); g.lineTo(6, 17); g.lineTo(-4, 11); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#f2ead8'; ribbon(g, [[5, 7], [11, 9], [17, 14]], 3, PROF.lift, 0); ribbon(g, [[5, 7], [1, 10], [-3, 15]], 3, PROF.lift, 0);
    g.fillStyle = angry ? '#ffb347' : '#e8d9a0'; g.beginPath(); g.ellipse(10, -7, 2.8, 1.4, 0, 0, TAU); g.fill();
    // bowl
    g.beginPath(); g.ellipse(0, -10, 18, 15, 0, PI, TAU); g.closePath();
    const bg = g.createLinearGradient(0, -25, 0, -10); bg.addColorStop(0, '#2a2833'); bg.addColorStop(1, '#0f0e13'); g.fillStyle = bg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = 'rgba(214,170,86,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -10); g.lineTo(18, -10); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -10, 13, 10, 0, PI * 1.2, PI * 1.65); g.stroke();
    // golden maedate crescent
    const mg = g.createLinearGradient(-26, -44, 26, -20); mg.addColorStop(0, '#8d6a2a'); mg.addColorStop(.5, '#f5dc93'); mg.addColorStop(1, '#a8812f');
    g.fillStyle = mg; g.beginPath(); g.moveTo(-26, -46); g.quadraticCurveTo(2, -12, 30, -48); g.quadraticCurveTo(2, -24, -26, -46); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,50,10,.7)'; g.lineWidth = 1; g.stroke();
    gg.save(); gg.translate(c[0], c[1]); gg.rotate(a); gg.globalAlpha = .35; gg.drawImage(AS.gGold, -32, -56, 64, 40); gg.restore();
  } else if (kind === 'hood') {
    g.fillStyle = '#0d0e13'; g.beginPath(); g.ellipse(1, 0, 14, 16, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#d7b38c'; g.fillRect(-1, -6, 16, 5.5);
    g.fillStyle = angry ? '#ff4d3a' : '#0a0a0a'; g.fillRect(8, -5, 4, 2.4);
    if (angry) { gg.save(); gg.translate(c[0], c[1]); gg.drawImage(AS.gRed, 0, -14, 22, 20); gg.restore(); }
  }
  g.restore();
}

/* =========================================================================
   SAMURAI
   ========================================================================= */
const POSE = {
  ready: { lean: -.06, crouch: .55, step: 0, gx: 12, gy: -58, sA: PI + .18, head: .05 },
  wind: { lean: -.13, crouch: .64, step: -6, gx: -4, gy: -68, sA: PI + .02, head: .02 },
  strike: { lean: .24, crouch: .86, step: 44, gx: 70, gy: 26, sA: TAU + .3, head: -.04 },
  follow: { lean: .32, crouch: .92, step: 56, gx: 78, gy: 56, sA: TAU + .95, head: -.08 },
  whiff: { lean: .42, crouch: .98, step: 64, gx: 84, gy: 70, sA: TAU + 1.3, head: -.12 },
  hurt: { lean: -.38, crouch: .3, step: -24, gx: -20, gy: -6, sA: PI * .8, head: -.38 },
  howl: { lean: -.12, crouch: .42, step: 6, gx: 8, gy: -88, sA: PI * 1.5, head: -.28 },
  sheath: { lean: .03, crouch: .36, step: 10, gx: -22, gy: 70, sA: PI + .08, head: .14 },
  // Game Room: slumped on one knee, blade down.
  fallen: { lean: .62, crouch: 1.05, step: 34, gx: 64, gy: 88, sA: TAU + .62, head: .5 },
};
function samuraiRig(p) {
  const hipY = -138 + 26 * p.crouch, H = [p.step * .4, hipY];
  const ff = [44 + p.step, 0], bf = [-42 - p.crouch * 10 - p.step * .15, 0];
  const lean = p.lean;
  const Sh = add2(H, rot2(0, -82, lean)), N = add2(Sh, rot2(2, -12, lean)), Hd = add2(N, rot2(8, -22, lean + p.head));
  const SF = add2(Sh, rot2(9, 3, lean)), SB = add2(Sh, rot2(-12, 1, lean));
  const Hf = add2(H, rot2(7, 2, lean)), Hb = add2(H, rot2(-7, 2, lean));
  const lf = ik2(Hf, ff, 66, 68, kneeFwd), lb = ik2(Hb, bf, 66, 68, kneeFwd);
  const G = [Sh[0] + p.gx, Sh[1] + p.gy], dir = [Math.cos(p.sA), Math.sin(p.sA)], G2 = sub2(G, mul2(dir, 21));
  const af = ik2(SF, G, 44, 42, elbowDown), ab = ik2(SB, G2, 44, 42, elbowDown);
  return { H, Sh, N, Hd, headA: lean + p.head, lean, SF, SB, G, G2, dir,
    legs: [{ H: Hf, K: lf.E, A: lf.T }, { H: Hb, K: lb.E, A: lb.T }],
    arms: [{ S: SF, E: af.E, W: af.T }, { S: SB, E: ab.E, W: ab.T }] };
}
const wind0 = (s) => clamp(windAt(s.x, WIND.t) * 1.6, 0, 1.2);
class Samurai {
  constructor() {
    this.x = 0; this.face = 1; this.pose = Object.assign({}, POSE.ready);
    this.anim = null; this.lock = 0; this.hurtT = 0; this.inv = 0; this.t = 0;
    this.flapF = [0, 0]; this.flapFV = [0, 0]; this.flapB = [0, 0]; this.flapBV = [0, 0]; this.hem = 0; this.hemV = 0; this.lastG = null; this.obi = 0; this.obiV = 0;
    const roots = [[-10, -16], [-12, -10], [-13, -2], [-11, 6], [-6, -19], [0, -20], [-8, 12], [-14, -14], [4, -19], [-4, 9], [-15, 1], [-9, -6], [-2, -18], [-13, 9]];
    this.hair = roots.map((r, i) => ({ r: [r[0] * 1.3, r[1] * 1.3], seg: 9 + (i % 3) * 2, w: 6 + (i % 4) * 1.2, p: [], q: [] }));
    this.hairInit = false; this.aura = 0; this.blade = null;
    // Game Room: height off the ground (negative is up), health, walking.
    this.y = 0; this.vy = 0; this.hp = MAX_HP; this.dead = false; this.moving = 0; this.buffer = 0;
  }
  play(segs) { this.anim = { segs, i: 0, t: 0, from: Object.assign({}, this.pose) }; }
  slash(dir, whiff) {
    this.face = dir;
    if (whiff) this.play([[POSE.wind, .03, Ease.outQuad], [POSE.strike, .045, Ease.inQuad], [POSE.whiff, .12, Ease.outCubic], [POSE.whiff, .1, null], [POSE.ready, .2, Ease.inOutCubic]]);
    else this.play([[POSE.wind, .03, Ease.outQuad], [POSE.strike, .04, Ease.inQuad], [POSE.follow, .09, Ease.outCubic], [POSE.ready, .17, Ease.inOutCubic]]);
  }
  hit() { this.play([[POSE.hurt, .08, Ease.outCubic], [POSE.hurt, .2, null], [POSE.ready, .3, Ease.inOutCubic]]); }
  howl() { this.play([[POSE.howl, .2, Ease.outBack], [POSE.howl, 1.1, null], [POSE.ready, .35, Ease.inOutCubic]]); }
  sheath() { this.play([[POSE.follow, .12, Ease.outCubic], [POSE.sheath, .5, Ease.inOutCubic], [POSE.sheath, 99, null]]); }
  die() { this.play([[POSE.hurt, .1, Ease.outCubic], [POSE.fallen, .55, Ease.inOutCubic], [POSE.fallen, 1e6, null]]); }
  rig() { return samuraiRig(this.pose); }
  drawTails(g, R, wind) {
    // two tapering haori tails streaming behind in the wind
    const T = (x, y) => add2(R.H, rot2(x, y, R.lean)), t = this.t;
    for (const tail of [{ y: -30, L: 104, g0: 34, ph: 0, dy: 34 }, { y: -10, L: 86, g0: 26, ph: 1.7, dy: 50 }]) {
      const root = T(-18, tail.y), n = 12, L = tail.L * (1 + wind * .35);
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wv = (Math.sin(t * 5.6 - u * 3.6 + tail.ph) * 13 + Math.sin(t * 2.4 - u * 2.2 + tail.ph) * 6) * u * (.8 + wind);
        const c = [root[0] - u * L, root[1] + u * tail.dy + wv];
        const gap = lerp(tail.g0, 6, Math.pow(u, .8)) * (1 + Math.sin(t * 4 - u * 5 + tail.ph) * .08);
        top.push([c[0], c[1] - gap / 2]); bot.push([c[0] + u * 4, c[1] + gap / 2]);
      }
      const tip = [top[n][0] - 14, (top[n][1] + bot[n][1]) / 2 + 4];
      g.beginPath(); g.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i <= n; i++) { const m = lerp2(top[i - 1], top[i], .5); g.quadraticCurveTo(top[i - 1][0], top[i - 1][1], m[0], m[1]); }
      g.lineTo(tip[0], tip[1]); g.lineTo(bot[n][0], bot[n][1]);
      for (let i = n - 1; i >= 0; i--) { const m = lerp2(bot[i + 1], bot[i], .5); g.quadraticCurveTo(bot[i + 1][0], bot[i + 1][1], m[0], m[1]); }
      g.lineTo(bot[0][0], bot[0][1]); g.closePath();
      g.fillStyle = PAT.robe; g.fill();
      const sg = g.createLinearGradient(root[0], 0, root[0] - L, 0); sg.addColorStop(0, 'rgba(6,10,40,.5)'); sg.addColorStop(1, 'rgba(140,170,255,.1)');
      g.fillStyle = sg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
      g.strokeStyle = 'rgba(214,176,92,.85)'; g.lineWidth = 1.8; smoothPath(g, bot.slice(1).map(p => [p[0], p[1] - 2]), false); g.stroke();
      g.strokeStyle = 'rgba(232,238,255,.4)'; g.lineWidth = 2; smoothPath(g, top.slice(2).map(p => [p[0], p[1] + 2]), false); g.stroke();
    }
  }
  update(dt, wind) {
    this.t += dt;
    if (this.anim) {
      const a = this.anim, s = a.segs[a.i];
      a.t += dt;
      const k = s[1] > 0 ? Math.min(1, a.t / s[1]) : 1;
      this.pose = lerpPose(a.from, s[0], s[2] ? s[2](k) : 1);
      if (k >= 1) { a.from = Object.assign({}, s[0]); a.i++; a.t = 0; if (a.i >= a.segs.length) this.anim = null; }
    } else {
      const b = Math.sin(this.t * 2.2);
      this.pose.crouch = POSE.ready.crouch + b * .015; this.pose.gy = POSE.ready.gy + b * 1.5; this.pose.lean = POSE.ready.lean + Math.sin(this.t * 1.1) * .01;
      // Game Room: a quick stride while walking, and knees tucked in the air.
      const stride = this.moving && this.y >= 0 ? Math.sin(this.t * 15) * 22 : 0;
      this.pose.step = lerp(this.pose.step, stride, Math.min(1, dt * 18));
      if (this.y < 0) this.pose.crouch = lerp(this.pose.crouch, .8, Math.min(1, dt * 12));
    }
    const R = this.rig();
    if (this.lastG && dt > 0) {
      const vx = (R.G[0] - this.lastG[0]) / dt, vy = (R.G[1] - this.lastG[1]) / dt;
      const sp = (f, v, kx, ky) => { v[0] += (-f[0] * 90 - v[0] * 9 - vx * kx) * dt; v[1] += (-f[1] * 90 - v[1] * 9 - vy * ky) * dt; f[0] += v[0] * dt; f[1] += v[1] * dt; f[0] = clamp(f[0], -40, 40); f[1] = clamp(f[1], -30, 30); };
      sp(this.flapF, this.flapFV, .45, .3); sp(this.flapB, this.flapBV, .3, .2);
      this.hemV += (-this.hem * 70 - this.hemV * 8 - vx * .02 + wind * 6) * dt; this.hem = clamp(this.hem + this.hemV * dt, -2, 2);
      this.obiV += (-this.obi * 60 - this.obiV * 6 - vx * .05 + wind * 30 * this.face) * dt; this.obi = clamp(this.obi + this.obiV * dt, -2, 2);
    }
    this.lastG = R.G;
    const hc = R.Hd, ha = R.headA, wx = wind * 900 * this.face;
    for (const s of this.hair) {
      const root = add2(hc, rot2(s.r[0], s.r[1], ha));
      if (!this.hairInit) { s.p = []; s.q = []; for (let i = 0; i < 9; i++) { const p = [root[0] - i * s.seg * .8, root[1] + i * s.seg * .5]; s.p.push(p); s.q.push([p[0], p[1]]); } }
      s.p[0] = root; s.q[0] = [root[0], root[1]];
      const ddt = Math.min(dt, 1 / 30);
      for (let i = 1; i < s.p.length; i++) {
        const p = s.p[i], q = s.q[i];
        const nx = p[0] + (p[0] - q[0]) * .9 + (wx - 120 + Math.sin(this.t * 3 + i + s.r[1]) * 140) * ddt * ddt;
        const ny = p[1] + (p[1] - q[1]) * .9 + (200 + Math.cos(this.t * 2.3 + i) * 70) * ddt * ddt;
        q[0] = p[0]; q[1] = p[1]; p[0] = nx; p[1] = ny;
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < s.p.length; i++) {
        const a = s.p[i - 1], b = s.p[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, k = (d - s.seg) / d;
        if (i === 1) { b[0] -= dx * k; b[1] -= dy * k; } else { a[0] += dx * k * .5; a[1] += dy * k * .5; b[0] -= dx * k * .5; b[1] -= dy * k * .5; }
      }
    }
    this.hairInit = true;
  }
  draw(g, gg) {
    const R = this.rig(), cos = COSTUME.samurai;
    g.save(); g.translate(this.x, this.y); g.scale(this.face, 1);
    gg.save(); gg.translate(this.x, this.y); gg.scale(this.face, 1);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // The shadow stays on the ground, shrinking as he jumps.
    const shadowK = Math.max(.4, 1 + this.y / 500);
    g.fillStyle = 'rgba(20,24,40,.22)'; g.beginPath(); g.ellipse((R.legs[0].A[0] + R.legs[1].A[0]) / 2, 3 - this.y, 86 * shadowK, 9 * shadowK, 0, 0, TAU); g.fill();
    if (this.aura > .02) { gg.globalAlpha = this.aura * .8; gg.drawImage(AS.gBlue, -160, -340, 320, 340); gg.globalAlpha = 1; }
    // white mane
    for (const s of this.hair) {
      g.fillStyle = 'rgba(244,240,230,.97)'; ribbon(g, s.p, s.w, PROF.lift, 0);
      g.fillStyle = 'rgba(140,140,160,.45)'; ribbon(g, s.p.slice(1).map(q => [q[0] + 1, q[1] + 1]), s.w * .3, PROF.lift, 0);
    }
    this.drawTails(g, R, wind0(this));
    drawArm(g, R.arms[1], cos, this.flapB, true);
    // saya on the left hip
    const sy0 = add2(R.H, rot2(-8, -6, R.lean * .5)), sy1 = add2(R.H, rot2(-122, 30, R.lean * .4));
    g.strokeStyle = '#0d0b10'; g.lineWidth = 9; g.beginPath(); g.moveTo(sy0[0], sy0[1]); g.lineTo(sy1[0], sy1[1]); g.stroke();
    g.strokeStyle = 'rgba(140,160,210,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sy0[0], sy0[1] - 3); g.lineTo(sy1[0], sy1[1] - 3); g.stroke();
    g.fillStyle = '#c9a24f'; g.beginPath(); g.arc(sy1[0], sy1[1], 5.5, 0, TAU); g.fill();
    drawLeg(g, R.legs[1], -1, cos, true, this.t, this.hem);
    drawLeg(g, R.legs[0], 1, cos, false, this.t, this.hem);
    drawTorso(g, R, cos, this);
    drawBelt(g, R, cos, this);
    drawArm(g, R.arms[0], cos, this.flapF, false);
    drawHead(g, gg, R, cos, null);
    drawHand(g, R.G2, R.dir, cos.skin);
    const blade = drawKatana(g, R.G, R.dir, 205);
    drawHand(g, R.G, R.dir, cos.skin);
    this.blade = blade;
    const sw = this.anim && this.anim.segs.length > 2 && this.anim.i <= 2;
    if (sw) { gg.strokeStyle = 'rgba(150,190,255,.55)'; gg.lineWidth = 7; gg.beginPath(); gg.moveTo(blade.base[0], blade.base[1]); gg.lineTo(blade.tip[0], blade.tip[1]); gg.stroke(); }
    g.restore(); gg.restore();
  }
}

/* =========================================================================
   ENEMIES
   ========================================================================= */
const EPOSE = {
  run: { lean: .3, crouch: .5, gx: -12, gy: 44, sA: PI * .82, run: 1 },
  stand: { lean: .05, crouch: .5, gx: 10, gy: 26, sA: PI * .85, run: 0 },
  windup: { lean: -.12, crouch: .62, gx: 8, gy: -62, sA: PI + .32, run: 0 },
  strike: { lean: .3, crouch: .8, gx: 64, gy: 24, sA: TAU + .4, run: 0 },
  recoil: { lean: -.35, crouch: .4, gx: -8, gy: 10, sA: PI * .9, run: 0 },
  crouch: { lean: .5, crouch: .95, gx: 34, gy: 36, sA: TAU + .2, run: 0 },
  dash: { lean: .6, crouch: .9, gx: 60, gy: 32, sA: TAU + .1, run: 1 },
  kneel: { lean: .02, crouch: .9, gx: 30, gy: -10, sA: -PI / 2, run: 0 },
};
const ENEMY_KIND = {
  ronin: { scale: 1, hp: 1, score: 100 },
  armored: { scale: 1.12, hp: 2, score: 220 },
  shinobi: { scale: .95, hp: 1, score: 160 },
  archer: { scale: .95, hp: 1, score: 120 },
};
function enemyRig(e) {
  const p = e.pose, run = p.run;
  const bob = Math.abs(Math.sin(e.phase)) * 8 * run;
  const kneel = e.kind === 'archer' && e.kneel;
  const hipY = kneel ? -78 : -134 + 24 * p.crouch - bob;
  const H = [0, hipY], lean = p.lean;
  const Sh = add2(H, rot2(0, -78, lean)), N = add2(Sh, rot2(2, -11, lean)), Hd = add2(N, rot2(6, -20, lean * .6));
  const SF = add2(Sh, rot2(9, 3, lean)), SB = add2(Sh, rot2(-11, 1, lean));
  const legs = [];
  for (let i = 0; i < 2; i++) {
    const Hp = add2(H, rot2(i ? -6 : 6, 2, lean));
    let A, Kp;
    if (kneel) { A = i ? [-58, -4] : [34, 0]; Kp = i ? [-8, -6] : null; }
    else {
      const ph = e.phase + i * PI;
      const stance = (i ? -32 : 34) * (1 - run) * (.7 + p.crouch * .5);
      A = [H[0] + Math.sin(ph) * 46 * run + stance, -Math.max(0, Math.cos(ph)) * 26 * run];
    }
    const k = Kp ? { E: Kp, T: A } : ik2(Hp, A, 62, 64, kneeFwd);
    legs.push({ H: Hp, K: k.E, A: k.T });
  }
  const G = [Sh[0] + p.gx, Sh[1] + p.gy], dir = [Math.cos(p.sA), Math.sin(p.sA)], G2 = sub2(G, mul2(dir, 19));
  const af = ik2(SF, G, 42, 40, elbowDown), ab = ik2(SB, G2, 42, 40, elbowDown);
  return { H, Sh, N, Hd, headA: lean * .5, lean, SF, SB, G, G2, dir, legs, arms: [{ S: SF, E: af.E, W: af.T }, { S: SB, E: ab.E, W: ab.T }] };
}
function drawEnemy(g, gg, e) {
  const R = enemyRig(e), cos = COSTUME[e.kind];
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (!e.noShadow) { g.fillStyle = 'rgba(20,24,40,.2)'; g.beginPath(); g.ellipse(0, 3, 52, 7, 0, 0, TAU); g.fill(); }
  const fl = Math.sin(e.t * 7) * 4;
  if (e.kind === 'shinobi') {
    const pts = []; for (let i = 0; i < 11; i++) { const t = i / 10; pts.push([R.N[0] - 6 - t * 130, R.N[1] + 4 + Math.sin(e.t * 9 - t * 6) * 13 * t + t * 12]); }
    g.fillStyle = '#b3242c'; ribbon(g, pts, 13, PROF.lift, 1); g.fillStyle = 'rgba(60,4,10,.5)'; ribbon(g, pts.map(q => [q[0], q[1] + 3]), 5, PROF.lift, 0);
  }
  if (e.kind !== 'archer') drawArm(g, R.arms[1], cos, [fl * .5, 0], true);
  // legs: whichever foot is further back is drawn first
  const order = R.legs[0].A[0] < R.legs[1].A[0] ? [0, 1] : [1, 0];
  for (const i of order) drawLeg(g, R.legs[i], R.legs[i].A[0] >= R.H[0] ? 1 : -1, cos, i === order[0], e.t, Math.sin(e.t * 6 + i));
  if (cos.armor) {
    for (let k = -1; k <= 1; k++) {
      const q = add2(R.H, rot2(k * 16, -4, R.lean)); g.save(); g.translate(q[0], q[1]); g.rotate(R.lean * .4 + k * .14);
      g.beginPath(); g.rect(-11, 0, 22, 38); shadeFill(g, PAT.armor, [0, 0], [0, 38], 0, .35); g.strokeStyle = 'rgba(214,170,86,.9)'; g.lineWidth = 1.4; g.stroke(); g.restore();
    }
  }
  drawTorso(g, R, cos, e);
  drawBelt(g, R, cos, { obi: Math.sin(e.t * 5) * .6, t: e.t });
  if (e.kind === 'archer') { drawBow(g, gg, e, R, cos); drawHead(g, gg, R, cos, e); return; }
  drawArm(g, R.arms[0], cos, [fl, 0], false);
  drawHead(g, gg, R, cos, e);
  drawHand(g, R.G2, R.dir, cos.skin);
  const bl = drawKatana(g, R.G, R.dir, e.kind === 'shinobi' ? 120 : 185, { dull: e.kind !== 'armored' });
  drawHand(g, R.G, R.dir, cos.skin);
  e.tip = bl.tip;
  if (e.glint > 0) {
    const t = bl.tip, s = 18 + 34 * e.glint;
    g.save(); g.translate(t[0], t[1]); g.rotate(e.t * 3);
    g.fillStyle = `rgba(255,255,255,${e.glint})`;
    g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .16 : s; const a = i * PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore();
    gg.globalAlpha = e.glint; gg.drawImage(AS.gWhite, t[0] - 44, t[1] - 44, 88, 88); gg.globalAlpha = 1;
  }
}
function drawBow(g, gg, e, R, cos) {
  const hold = add2(R.Sh, [30, 4]), top = add2(hold, [-8, -92]), bot = add2(hold, [-4, 66]);
  const draw = e.draw || 0, nock = add2(hold, [-36 - draw * 26, 2]);
  drawArm(g, { S: R.SB, E: ik2(R.SB, nock, 40, 38, elbowDown).E, W: nock }, cos, [0, 0], true);
  g.strokeStyle = '#2e1b0c'; g.lineWidth = 4.2;
  g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(hold[0] + 24, hold[1] - 44, hold[0], hold[1]); g.quadraticCurveTo(hold[0] + 18, hold[1] + 36, bot[0], bot[1]); g.stroke();
  g.strokeStyle = 'rgba(214,176,92,.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hold[0] - 1, hold[1] - 8); g.lineTo(hold[0] - 1, hold[1] + 8); g.stroke();
  g.strokeStyle = 'rgba(235,225,205,.9)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(nock[0], nock[1]); g.lineTo(bot[0], bot[1]); g.stroke();
  if (e.armed) {
    g.strokeStyle = '#4a3420'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(nock[0], nock[1]); g.lineTo(hold[0] + 44, hold[1]); g.stroke();
    g.fillStyle = '#9aa1ad'; g.beginPath(); g.moveTo(hold[0] + 44, hold[1] - 3); g.lineTo(hold[0] + 54, hold[1]); g.lineTo(hold[0] + 44, hold[1] + 3); g.fill();
    if (draw > .6) { gg.globalAlpha = (draw - .6) * 2.5; gg.drawImage(AS.gWhite, hold[0] + 30, hold[1] - 20, 40, 40); gg.globalAlpha = 1; }
  }
  drawArm(g, { S: R.SF, E: ik2(R.SF, hold, 42, 40, elbowDown).E, W: hold }, cos, [0, 0], false);
  drawHand(g, hold, [0, -1], cos.skin); drawHand(g, nock, [1, 0], cos.skin);
}

/* =========================================================================
   GAME — rules, director, input, HUD, render pipeline, boot
   ========================================================================= */
const R_IDEAL = 175, R_MIN = 60, R_MAX = 265, ATTACK_D = 92, SPAWN_D = 1080, FEINT_D = 315, ARROW_V = 860, PERFECT_T = .07;
const $ = id => root.querySelector('#' + id);

let outCanvas, sceneCanvas, glowCanvas, SC, GC, post = null;
const P = new Samurai();
const GAME = {
  mode: 'loading', t: 0, real: 0, score: 0, combo: 0, maxCombo: 0, gauge: 0, kills: 0, perfects: 0, goods: 0, hits: 0, whiffs: 0,
  enemies: [], arrows: [], corpses: [], boss: null, bossesBeaten: 0, nextBoss: FIRST_BOSS_AT,
  ts: 1, tsTarget: 1, tsT: 0, hitstop: 0, ending: false, endT: 0, wave: null, comboPulse: 0, banner: null,
  best: store.get('iai.best', 0), bestCombo: store.get('iai.bestCombo', 0), newBest: false,
};
const FXU = { ca: 0, hurt: 0, flash: [1, 1, 1, 0], shock: [.5, .5, 0, 0], shockR: 0, radial: [.5, .5, 0], fade: 1, fadeCol: [C.paper[0] / 255, C.paper[1] / 255, C.paper[2] / 255] };
const DIR = { next: 0, lastSide: 1, streak: 0, archerCD: 0 };

/* ---------------- helpers ---------------- */
function toUV(x, y) { return [(V.W / 2 + (x - V.camX) * V.S * V.Z) / V.W, 1 - (V.gy + y * V.S * V.Z) / V.H]; }
function flash(r, g, b, a) { FXU.flash = [r, g, b, Math.max(FXU.flash[3], a)]; }
function shock(x, y, amp) { const uv = toUV(x, y); FXU.shock = [uv[0], uv[1], 0, amp]; FXU.shockR = 0; }
function radial(x, y, amt) { const uv = toUV(x, y); FXU.radial = [uv[0], uv[1], Math.max(FXU.radial[2], amt)]; }
function slowmo(scale, dur) { GAME.ts = Math.min(GAME.ts, scale); GAME.tsTarget = scale; GAME.tsT = dur; }
function mult() { return 1 + Math.min(7, Math.floor(GAME.combo / 8)); }
function gapAt(t) { return lerp(1.02, .38, clamp(t / 42, 0, 1)); }
function claim(tmin, gap) { const t = Math.max(tmin, DIR.next); DIR.next = t + (gap != null ? gap : gapAt(GAME.t) * rr(1, 1.4)); return t; }
function banner(k, fr) { GAME.banner = { k, fr, t: 0 }; }
const KNUM = ['', '十', '二十', '三十', '四十', '五十', '六十', '七十', '八十', '九十', '百'];

/* ---------------- players ---------------- */
// Game Room: the samurai walk (A/D, which also turns them), jump (W) and have
// health; the run lasts until every samurai has fallen. P is this device's
// samurai; PLAYERS holds every samurai on the field.
const PLAYERS = [P];
const living = () => PLAYERS.filter((p) => !p.dead);
function nearestLiving(x) {
  let best = null, bd = 1e9;
  for (const p of PLAYERS) { if (p.dead) continue; const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
  return best;
}
function arenaHalf() { return Math.max(220, V.halfW - 80); }
const grounded = (p) => p.y > AIRBORNE_Y;
const INPUT = { left: false, right: false, jump: false };
function movePlayer(p, dt, inp) {
  p.moving = 0;
  if (p.dead) {
    if (p.y < 0 || p.vy < 0) { p.vy += GRAVITY * dt; p.y = Math.min(0, p.y + p.vy * dt); if (p.y >= 0) p.vy = 0; }
    return;
  }
  const free = p.hurtT <= 0 && !GAME.ending;
  const mv = free ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
  if (mv) { p.moving = mv; if (p.lock <= 0) p.face = mv; }
  const lim = arenaHalf();
  p.x = clamp(p.x + mv * MOVE_SPEED * dt * (p.y < 0 ? .85 : 1), -lim, lim);
  if (inp.jump) {
    inp.jump = false;
    if (free && p.y >= 0) { p.vy = -JUMP_SPEED; SND.whoosh(SND.t, .12, 0, .6, .12); smoke(p.x, -6, 2, 26); }
  }
  if (p.y < 0 || p.vy < 0) {
    p.vy += GRAVITY * dt; p.y += p.vy * dt;
    if (p.y >= 0) { p.y = 0; p.vy = 0; smoke(p.x, -4, 2, 24); addRipple(p.x, .25); }
  }
}

/* ---------------- spawning ---------------- */
function pickSide() {
  let s = Math.random() < .5 ? -1 : 1;
  if (s === DIR.lastSide) DIR.streak++; else DIR.streak = 0;
  if (DIR.streak >= 3) { s = -s; DIR.streak = 0; }
  DIR.lastSide = s; return s;
}
// Each enemy picks the samurai nearest the edge it comes from, and chases them.
function newEnemy(kind, side) {
  const target = nearestLiving(side * SPAWN_D) || P;
  const e = { kind, side, face: -side, target, x: target.x + side * SPAWN_D, d: SPAWN_D, hp: ENEMY_KIND[kind].hp, state: 'approach', t: 0, phase: rr(0, TAU), pose: Object.assign({}, EPOSE.run), glint: 0, speed: 300 };
  GAME.enemies.push(e); return e;
}
function spawnTick(dt) {
  const t = GAME.t, n = GAME.bossesBeaten;
  DIR.archerCD -= dt;
  if (GAME.boss) return;
  if (t > GAME.nextBoss - 2) return; // clear the field for the oni
  const vmax = enemyTopSpeed(t, n);
  const travel = (SPAWN_D - R_IDEAL) / vmax;
  if (DIR.next > t + (SPAWN_D - R_IDEAL) / 230) return;
  // archer volleys
  if (t > 25 && DIR.archerCD <= 0 && !GAME.enemies.some(e => e.kind === 'archer')) { spawnArcher(); DIR.archerCD = rr(8, 11); return; }
  const w = [['ronin', 1]];
  if (t > 9 || n > 0) w.push(['armored', .26]);
  if (t > 18 || n > 0) w.push(['shinobi', .3]);
  let sum = w.reduce((s, x) => s + x[1], 0), pick = Math.random() * sum, kind = 'ronin';
  for (const x of w) { pick -= x[1]; if (pick <= 0) { kind = x[0]; break; } }
  // Two samurai face denser waves.
  const gap = (n > 0 ? postBossGap(n, Math.random()) : gapAt(t) * rr(1, 1.4)) * (PLAYERS.length > 1 ? .75 : 1);
  const side = pickSide(), arr = claim(t + travel, gap);
  const e = newEnemy(kind, side);
  e.arrival = arr;
  if (kind === 'shinobi') {
    e.wait = rr(.4, .75); const dashT = (FEINT_D - R_IDEAL) / 1050;
    e.speed = (SPAWN_D - FEINT_D) / Math.max(.4, arr - e.wait - dashT - t);
  } else e.speed = (SPAWN_D - R_IDEAL) / Math.max(.4, arr - t);
}
function spawnArcher() {
  const side = pickSide();
  const AX = clamp(V.halfW - 95, 430, 720);
  const e = newEnemy('archer', side);
  e.x = side * (V.halfW + 120); e.d = Math.abs(e.x); e.ax = AX; e.state = 'walkin'; e.speed = 340; e.shots = 3; e.kneel = false;
  e.pose = Object.assign({}, EPOSE.run);
}
function fireArrow(e) {
  GAME.arrows.push({ x: e.side * (e.ax - 20), y: -158, side: e.side, rot: e.side > 0 ? PI : 0, dead: false, vx: -e.side * ARROW_V, vy: 0, t: 0 });
  SND.whoosh(SND.t, .2, e.side * .7, 1.4, .15);
}

/* ---------------- enemy behaviour ---------------- */
function setPose(e, P, k) { e.pose = lerpPose(e.pose, P, k); }
// A chasing enemy keeps a distance `d` from its target on side `side`; if the
// target gets past it (a jump over its head), it turns around.
function chase(e) {
  if (!e.target || e.target.dead) e.target = nearestLiving(e.x) || e.target;
  const tx = e.target ? e.target.x : 0, rel = e.x - tx;
  if (Math.abs(rel) > 1 && Math.sign(rel) !== e.side) { e.side = Math.sign(rel); e.face = -e.side; e.d = Math.abs(rel); }
  return tx;
}
function updateEnemies(dt) {
  for (let i = GAME.enemies.length - 1; i >= 0; i--) {
    const e = GAME.enemies[i]; e.t += dt;
    const blend = 1 - Math.exp(-dt * 14);
    switch (e.state) {
      case 'approach': {
        const tx = chase(e);
        e.d -= e.speed * dt; e.x = tx + e.side * e.d;
        e.phase += dt * (e.speed / 34) * (e.kind === 'armored' ? .75 : 1);
        setPose(e, e.kind === 'armored' ? Object.assign({}, EPOSE.run, { lean: .18 }) : EPOSE.run, blend);
        if (e.kind === 'shinobi' && !e.feinted && e.d <= FEINT_D) { e.state = 'feint'; e.t = 0; e.d = FEINT_D; e.x = tx + e.side * e.d; e.feinted = true; }
        else if (e.d <= ATTACK_D) { e.state = 'windup'; e.t = 0; e.d = ATTACK_D; e.x = tx + e.side * e.d; }
        break;
      }
      case 'feint': {
        const tx = chase(e); e.x = tx + e.side * e.d;
        setPose(e, EPOSE.crouch, blend);
        if (e.t > e.wait) { e.state = 'dash'; e.t = 0; e.speed = 1050; smoke(e.x, -10, 3, 30); SND.whoosh(SND.t, .25, e.side * .6, .8, .12); }
        break;
      }
      case 'dash': {
        const tx = chase(e);
        e.d -= 1050 * dt; e.x = tx + e.side * e.d; e.phase += dt * 30; setPose(e, EPOSE.dash, blend);
        if (e.d <= ATTACK_D) { e.state = 'windup'; e.t = 0; e.d = ATTACK_D; e.x = tx + e.side * e.d; }
        break;
      }
      case 'windup': {
        // Rooted for the swing: step back or jump to make it miss.
        const wd = e.kind === 'shinobi' ? .13 : e.kind === 'armored' ? .24 : .19;
        setPose(e, EPOSE.windup, 1 - Math.exp(-dt * 22)); e.glint = Math.min(1, e.t / wd);
        if (e.t >= wd) { e.state = 'strike'; e.t = 0; e.glint = 0; }
        break;
      }
      case 'strike':
        setPose(e, EPOSE.strike, 1 - Math.exp(-dt * 40));
        if (e.t > .05 && !e.struck) {
          e.struck = true;
          for (const p of living()) if (grounded(p) && Math.abs(p.x - e.x) <= ATTACK_D + 50 && Math.sign(p.x - e.x) === e.face) playerHurt(p, e);
        }
        if (e.t > .2) { e.state = 'recoil'; e.t = 0; e.struck = false; }
        break;
      case 'recoil': case 'stagger': {
        const tx = chase(e);
        setPose(e, EPOSE.recoil, blend);
        const back = e.state === 'stagger' ? 330 : 380;
        e.d = lerp(e.d, back, 1 - Math.exp(-dt * 7)); e.x = tx + e.side * e.d;
        if (e.t > .38) {
          const arr = claim(GAME.t + .5);
          e.arrival = arr; e.speed = (e.d - R_IDEAL) / Math.max(.3, arr - GAME.t); e.state = 'approach'; e.t = 0; e.feinted = true;
        }
        break;
      }
      case 'walkin':
        e.x -= e.side * e.speed * dt; e.d = Math.abs(e.x); e.phase += dt * 10; setPose(e, EPOSE.run, blend);
        if (e.d <= e.ax) { e.x = e.side * e.ax; e.d = e.ax; e.state = 'aim'; e.t = 0; e.kneel = true; e.nextShot = null; }
        break;
      case 'aim': {
        setPose(e, EPOSE.kneel, blend);
        if (e.nextShot == null && e.shots > 0) { const flight = (e.ax - 20 - R_IDEAL) / ARROW_V; e.nextShot = claim(GAME.t + .55 + flight) - flight; }
        if (e.nextShot != null) {
          const left = e.nextShot - GAME.t; e.armed = left < .5; e.draw = clamp(1 - left / .5, 0, 1);
          if (left <= 0) { fireArrow(e); e.shots--; e.nextShot = null; e.armed = false; e.draw = 0; }
        }
        if (e.shots <= 0 && !e.nextShot) { e.state = 'leave'; e.t = 0; e.kneel = false; }
        break;
      }
      case 'leave':
        e.face = e.side; e.x += e.side * 420 * dt; e.d = Math.abs(e.x); e.phase += dt * 12; setPose(e, EPOSE.run, blend);
        if (e.d > V.halfW + 200) GAME.enemies.splice(i, 1);
        break;
    }
  }
  for (let i = GAME.arrows.length - 1; i >= 0; i--) {
    const a = GAME.arrows[i]; a.t += dt;
    if (a.dead) { a.vy += 1400 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.vr * dt; if (a.t > 1.5) GAME.arrows.splice(i, 1); continue; }
    a.x += a.vx * dt;
    // Chest-high: jump over it, or cut it.
    const hit = living().find((p) => Math.abs(a.x - p.x) <= 34 && a.y > p.y - 215 && a.y < p.y - 10);
    if (hit) { GAME.arrows.splice(i, 1); playerHurt(hit, null); continue; }
    if (Math.abs(a.x) > V.halfW + 400) GAME.arrows.splice(i, 1);
  }
  for (let i = GAME.corpses.length - 1; i >= 0; i--) {
    const c = GAME.corpses[i];
    if (c.burn) { c.t += dt; if (Math.random() < .7) embers(c.wx + rr(-20, 20), rr(-200, -20), 1, 20, -90, 1.2); if (c.t > c.life) GAME.corpses.splice(i, 1); continue; }
    updateCorpse(c, dt); if (c.t > c.life) GAME.corpses.splice(i, 1);
  }
}

/* ---------------- the oni fight ---------------- */
function startBoss() {
  GAME.boss = new Oni();
  GAME.boss.hp = GAME.boss.max = bossHp(GAME.bossesBeaten);
  SND.roar(); shake(.9); banner('鬼', GAME.bossesBeaten ? 'The oni returns' : 'The oni wakes');
  flash(.55, .05, .08, .35); FXU.ca = .012;
  smoke(0, V.top * .5, 18, 160);
  SND.musicLevel(4); $('bossbar').classList.add('on'); updateBossBar();
  DIR.next = GAME.t + 2.6;
}
function updateBoss(dt) {
  const B = GAME.boss; if (!B) return;
  B.update(dt);
  if (B.state === 'fight') {
    if (!B.arms.some(a => a.state === 'wind' || a.state === 'strike') && DIR.next <= GAME.t + 1.2) {
      const lost = (B.max - B.hp) / B.max;
      const windDur = lerp(.75, .48, lost);
      const arr = claim(GAME.t + windDur + .18, lerp(.92, .56, lost) * rr(1, 1.2));
      const side = pickSide();
      // The fist lands where a samurai stands when it starts its swing.
      const tp = nearestLiving(side * 400) || P;
      B.arms.push({ side, tx: tp.x, state: 'wind', t: 0, windDur: arr - GAME.t - .18, arrival: arr, hand: [tp.x + side * 700, -520], from: null });
      SND.whoosh(SND.t, .2, side * .6, .5, .5);
    }
  }
  for (let i = B.arms.length - 1; i >= 0; i--) {
    const a = B.arms[i];
    const raised = [a.tx + a.side * 520, -400 + Math.sin(B.t * 8) * 6], target = [a.tx + a.side * R_IDEAL, -110], through = [a.tx + a.side * 26, -86];
    if (a.state === 'wind') {
      const k = 1 - Math.exp(-dt * 6); a.hand[0] += (raised[0] - a.hand[0]) * k; a.hand[1] += (raised[1] - a.hand[1]) * k;
      if (GAME.t >= a.arrival - .18) { a.state = 'strike'; a.t = 0; a.from = a.hand.slice(); }
    } else if (a.state === 'strike') {
      const u = (GAME.t - (a.arrival - .18)) / .18;
      if (u <= 1) { const e = Ease.inQuad(clamp(u, 0, 1)); a.hand = [lerp(a.from[0], target[0], e), lerp(a.from[1], target[1], e)]; }
      else {
        const v = clamp((u - 1) / .45, 0, 1); a.hand = [lerp(target[0], through[0], v), lerp(target[1], through[1], v)];
        if (v >= 1 && !a.hit) {
          a.hit = true;
          for (const p of living()) if (grounded(p) && Math.abs(p.x - a.tx) < 120) playerHurt(p, null, true);
          a.state = 'recoil'; a.t = 0;
        }
      }
    } else if (a.state === 'recoil') {
      const k = 1 - Math.exp(-dt * 5); a.hand[0] += (a.tx + a.side * 760 - a.hand[0]) * k; a.hand[1] += (-640 - a.hand[1]) * k;
      if (a.t > .7) B.arms.splice(i, 1);
    }
  }
  if (B.state === 'gone') {
    // Defeated: it comes back later, stronger.
    GAME.bossesBeaten++; GAME.nextBoss = nextBossAt(GAME.bossesBeaten, GAME.t);
    $('bossbar').classList.remove('on');
    SND.shatter(); flash(1, .92, .7, .8); shake(1.2); FXU.ca = .02;
    const [x, y] = B.pos; shock(x, y, 2); radial(x, y, .12);
    for (let k = 0; k < 40; k++) addP({ k: 'chunk', x: x + rr(-200, 200), y: y + rr(-200, 200), vx: rr(-700, 700), vy: rr(-600, 100), life: rr(1.5, 2.6), t: 0, rot: rr(0, TAU), vr: rr(-8, 8), gy: rr(0, 30), draw: shardDraw(rr(10, 34)) });
    smoke(x, y, 10, 70); sparks(x, y, 0, 50); embers(x, y, 24, 160, -60, 1.6);
    addScore(5000 * GAME.bossesBeaten, x, y, true); stampAt(0, -330, '退治', 'ONI SLAIN', true);
    SND.musicLevel(4); DIR.next = GAME.t + .6;
    GAME.boss = null;
  }
}
function shardDraw(s) {
  const r = Math.random(); const pts = [[0, -s], [s * .7, -s * .2], [s * .3, s * .8], [-s * .6, s * .4]];
  return g => { g.fillStyle = r < .25 ? '#e6c675' : r < .7 ? '#a51f2a' : '#14080a'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.strokeStyle = 'rgba(10,4,6,.8)'; g.lineWidth = 1.5; g.stroke(); };
}
function updateBossBar() { const B = GAME.boss; if (B) $('bossHp').style.width = (B.hp / B.max * 100) + '%'; }

/* ---------------- combat resolution ---------------- */
function addScore(n, x, y, big) {
  n = Math.round(n); GAME.score += n;
  fxPop(x, y - 30, '+' + n.toLocaleString('en-US'), big ? '#ffe39a' : '#f1d58b', big ? 30 : 22);
  hud.score = true;
}
function stampAt(x, y, k, sub, red) { fxStamp(x, y, k, sub, red); }
function comboUp() {
  GAME.combo++; GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo); GAME.comboPulse = 1;
  if (GAME.combo % 10 === 0) {
    const n = GAME.combo / 10; banner(n <= 10 ? KNUM[n] + '連' : GAME.combo + '連', `${GAME.combo} in a row`);
    SND.bell(880, .12); SND.bell(1318, .07, .08);
  }
  // Game Room: a long combo heals everyone still standing.
  if (GAME.combo % HEAL_EVERY_COMBO === 0) for (const p of living()) {
    const before = p.hp; p.hp = healOnCombo(p.hp, GAME.combo);
    if (p.hp > before) fxPop(p.x, p.y - 270, '+' + (p.hp - before) + ' 体', '#8fd6a0', 22);
  }
  hud.score = true;
}
// Slash the way the samurai faces, at the nearest thing in reach.
function slash(p) {
  if (GAME.mode !== 'play' || GAME.ending || !p || p.dead) return;
  const dir = p.face;
  if (p.lock > 0 || p.hurtT > 0) { if (p.lock < .12 && p.hurtT <= 0) p.buffer = .12; return; }
  let best = null, bd = 1e9, type = null;
  for (const e of GAME.enemies) {
    if (e.state === 'recoil' || e.state === 'stagger' || e.state === 'leave') continue;
    const rel = e.x - p.x, d = Math.abs(rel);
    if (Math.sign(rel) !== dir) continue;
    if (d >= R_MIN && d <= R_MAX && d < bd) { bd = d; best = e; type = 'enemy'; }
  }
  for (const a of GAME.arrows) {
    if (a.dead || Math.sign(a.vx) === dir) continue; // only arrows coming at you
    const rel = a.x - p.x, d = Math.abs(rel);
    if (Math.sign(rel) !== dir) continue;
    if (d >= R_MIN - 25 && d <= R_MAX + 10 && d < bd) { bd = d; best = a; type = 'arrow'; }
  }
  if (GAME.boss) for (const a of GAME.boss.arms) {
    if (a.state !== 'strike') continue;
    const rel = a.hand[0] - p.x, d = Math.abs(rel);
    if (Math.sign(rel) !== dir) continue;
    if (d >= 30 && d <= R_MAX + 120 && d < bd) { bd = d; best = a; type = 'arm'; }
  }
  if (!best) { whiff(p, dir); return; }
  p.slash(dir, false); p.lock = .1;
  if (type === 'enemy') hitEnemy(best, dir, p, bd);
  else if (type === 'arrow') hitArrow(best, dir, p, bd);
  else hitArm(best, dir, p);
}
function judge(d, speed, arrival) {
  if (arrival != null && Math.abs(GAME.t - arrival) <= PERFECT_T) return true;
  if (speed > 0) return Math.abs((d - R_IDEAL) / speed) <= PERFECT_T;
  return Math.abs(d - R_IDEAL) <= 24;
}
function impact(x, y, dir, perfect, p) {
  const piv = [p.x, p.y - 192];
  fxSlash(piv[0], piv[1], dir, perfect, 1.08);
  fxBurst(x, y, perfect);
  addRipple(x, perfect ? .9 : .6); addRipple(p.x, .35);
  shake(perfect ? .42 : .26);
  GAME.hitstop = Math.max(GAME.hitstop, perfect ? .085 : .045);
  FXU.ca = Math.max(FXU.ca, perfect ? .009 : .004);
  if (perfect) {
    slowmo(.28, .2); shock(x, y, 1.2); radial(x, y, .06); flash(1, 1, 1, .18);
    fxLine(V.gy + y * V.S * V.Z, dir); fxSwipe(x, y - 10, dir, -.38 + rr(-.15, .15), 1.1);
    V.punch = .045;
  }
  SND.slash(dir, perfect); SND.cut(dir, perfect);
}
function hitEnemy(e, dir, p, d) {
  // Its scheduled arrival times a perfect cut on the samurai it was chasing; anyone else is judged by distance.
  const speed = e.state === 'windup' || e.state === 'feint' || e.state === 'aim' ? 0 : e.state === 'dash' ? 1050 : e.speed;
  const perfect = judge(d, speed, e.state === 'approach' && e.target === p ? e.arrival : null);
  const x = e.x, y = -150 * ENEMY_KIND[e.kind].scale;
  if (e.kind === 'armored' && e.hp > 1) {
    e.hp--; e.state = 'stagger'; e.t = 0;
    sparks(x - dir * 10, y, dir, 22); fxBurst(x, y, perfect, 0); fxSlash(p.x, p.y - 192, dir, perfect, 1.05);
    SND.slash(dir, perfect); SND.clang(dir, false); shake(.3); GAME.hitstop = .06; FXU.ca = .006;
    comboUp(); GAME.gauge = Math.min(1, GAME.gauge + .05); addScore(60 * mult(), x, y);
    stampAt(x, y - 120, '鋼', perfect ? 'PERFECT' : 'ARMOR', false);
    return;
  }
  const i = GAME.enemies.indexOf(e); if (i >= 0) GAME.enemies.splice(i, 1);
  impact(x, y, dir, perfect, p);
  inkBurst(x, y, e.side, perfect ? 34 : 22, perfect ? 900 : 650, true);
  smoke(x, y, 3, 40);
  const c = makeCorpse(e, dir, perfect); c.wx = e.x; c.f = e.face; GAME.corpses.push(c);
  if (e.kind === 'ronin' || e.kind === 'archer') {
    const hx = x, hy = -232;
    addP({ k: 'chunk', x: hx, y: hy, vx: e.side * rr(150, 320), vy: -rr(400, 650), life: 2.2, t: 0, rot: 0, vr: e.side * rr(6, 12), gy: rr(0, 18), draw: hatDraw() });
  }
  GAME.kills++; if (perfect) GAME.perfects++; else GAME.goods++;
  comboUp();
  GAME.gauge = Math.min(1, GAME.gauge + (perfect ? .1 : .06));
  addScore(ENEMY_KIND[e.kind].score * (perfect ? 1.5 : 1) * mult(), x, y - 60);
  if (perfect) stampAt(x, y - 130, '一閃', 'PERFECT', true); else stampAt(x, y - 125, '斬', null, false);
}
function hatDraw() { return g => { g.scale(.85, .85); g.beginPath(); g.moveTo(-50, 1); g.quadraticCurveTo(-20, -6, -2, -31); g.quadraticCurveTo(22, -6, 52, 3); g.quadraticCurveTo(0, 9, -50, 1); g.closePath(); g.fillStyle = PAT.straw; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }; }
function hitArrow(a, dir, p, d) {
  const perfect = judge(d, ARROW_V, null);
  a.dead = true; a.t = 0; a.vx = dir * rr(300, 500); a.vy = -rr(700, 900); a.vr = dir * rr(12, 20);
  fxSlash(p.x, p.y - 192, dir, perfect, 1.05); fxBurst(a.x, a.y, perfect);
  sparks(a.x, a.y, dir, 16); SND.slash(dir, perfect); SND.ping(dir);
  shake(.15); GAME.hitstop = .03; if (perfect) { slowmo(.4, .12); GAME.perfects++; } else GAME.goods++;
  comboUp(); GAME.gauge = Math.min(1, GAME.gauge + .05);
  addScore(60 * (perfect ? 1.5 : 1) * mult(), a.x, a.y);
  stampAt(a.x, a.y - 80, '矢', perfect ? 'PERFECT' : 'DEFLECTED', perfect);
}
function hitArm(a, dir, p) {
  const B = GAME.boss;
  const perfect = Math.abs(GAME.t - a.arrival) <= PERFECT_T * 1.3;
  a.state = 'recoil'; a.t = 0;
  B.hurt(); updateBossBar();
  sparks(a.hand[0], a.hand[1], dir, 36); sparks(a.hand[0], a.hand[1], dir, 14, 1);
  fxSlash(p.x, p.y - 192, dir, perfect, 1.15); fxBurst(a.hand[0], a.hand[1], true, 1);
  SND.slash(dir, perfect); SND.clang(dir, true); shake(.6); GAME.hitstop = .1; slowmo(.3, .18);
  shock(a.hand[0], a.hand[1], 1.4); radial(a.hand[0], a.hand[1], .05); FXU.ca = .012; flash(1, .85, .6, .2);
  if (perfect) GAME.perfects++; else GAME.goods++;
  comboUp(); GAME.gauge = Math.min(1, GAME.gauge + .08);
  addScore(300 * (perfect ? 1.5 : 1) * mult(), a.hand[0], a.hand[1]);
  stampAt(a.hand[0], a.hand[1] - 110, '受', perfect ? 'PERFECT PARRY' : 'PARRY', true);
  if (B.hp <= 0 && B.state === 'fight') { B.state = 'dying'; B.deathT = 0; B.arms.forEach(x => { x.state = 'recoil'; x.t = 0; }); SND.roar(); slowmo(.25, 1); }
}
function whiff(p, dir) {
  p.slash(dir, true); p.lock = .3; GAME.whiffs++;
  fxSlash(p.x, p.y - 192, dir, false, .9); SND.whiff(dir); addRipple(p.x + dir * 120, .3);
}
function playerHurt(p, e, heavy) {
  if (!p || p.dead || p.inv > 0 || GAME.ending) return;
  p.hit(); p.hurtT = .42; p.inv = .7; p.lock = 0;
  p.hp = damage(p.hp, heavy);
  GAME.combo = 0; GAME.hits++; hud.score = true;
  SND.hurt(); shake(heavy ? .9 : .65); GAME.hitstop = .07;
  if (p === P) { FXU.hurt = 1; FXU.ca = .014; }
  inkBurst(p.x, p.y - 160, e ? e.side * -1 : rsign(), 14, 520, true);
  if (p.hp <= 0) fall(p);
  else fxStamp(p.x, p.y - 340, '傷', 'HIT', true);
}
// A samurai falls; the run ends once nobody is left standing.
function fall(p) {
  p.dead = true; p.hurtT = 0; p.lock = 99; p.inv = 0; p.buffer = 0; p.die();
  fxStamp(p.x, -340, '死', 'FALLEN', true); slowmo(.3, .7); shake(.8);
  if (!living().length) endRun();
}
function howl(p) {
  if (GAME.mode !== 'play' || GAME.ending || !p || p.dead || GAME.gauge < 1 || WOLF.special >= 0) return;
  GAME.gauge = 0; WOLF.special = 0; p.howl(); p.lock = 1.1; p.inv = 1.8;
  SND.howl(); slowmo(.35, 1.1); shake(.5); flash(.75, .85, 1, .35); FXU.ca = .012;
  shock(p.x, p.y - 160, 1.6); radial(p.x, p.y - 200, .1);
  GAME.wave = { t: 0, front: 0, bossHit: false, x: p.x };
  banner('狼魂', 'The wolf spirit');
}
function updateWave(dt) {
  const w = GAME.wave; if (!w) return;
  w.t += dt;
  if (w.t > .35) {
    const prev = w.front; w.front = (w.t - .35) * 1700;
    for (let k = 0; k < 6; k++) { const s = k % 2 ? 1 : -1; embers(w.x + s * w.front + rr(-30, 30), rr(-60, 0), 1, 30, -120, 1.6); }
    if (prev === 0) { fxRing(w.x, 0, 1400, 1, 'rgba(60,100,230,', 16); addRipple(w.x, 1.4, 1700, 1.2); }
    for (let i = GAME.enemies.length - 1; i >= 0; i--) {
      const e = GAME.enemies[i];
      if (Math.abs(e.x - w.x) <= w.front && Math.abs(e.x) < V.halfW + 150) {
        GAME.enemies.splice(i, 1);
        GAME.corpses.push({ burn: true, e: Object.assign({}, e, { pose: Object.assign({}, e.pose), glint: 0, noShadow: true }), wx: e.x, t: 0, life: .9 });
        embers(e.x, -140, 10, 40, -160, 1.4); smoke(e.x, -100, 3, 50, 1);
        GAME.kills++; comboUp(); addScore(150 * mult(), e.x, -150);
      }
    }
    for (const a of GAME.arrows) if (!a.dead && Math.abs(a.x - w.x) <= w.front) { a.dead = true; a.t = 0; a.vx = a.side * 400; a.vy = -800; a.vr = 14; }
    if (GAME.boss && !w.bossHit && w.t > .6 && GAME.boss.state === 'fight') {
      w.bossHit = true; for (let k = 0; k < 3; k++) GAME.boss.hurt(); updateBossBar();
      GAME.boss.arms.forEach(x => { x.state = 'recoil'; x.t = 0; });
      addScore(900 * mult(), V.camX, GAME.boss.pos[1]);
      if (GAME.boss.hp <= 0) { GAME.boss.state = 'dying'; GAME.boss.deathT = 0; SND.roar(); }
    }
  }
  if (w.t > 1.7) GAME.wave = null;
}

/* ---------------- run lifecycle ---------------- */
function resetRun() {
  Object.assign(GAME, { t: 0, score: 0, combo: 0, maxCombo: 0, gauge: 0, kills: 0, perfects: 0, goods: 0, hits: 0, whiffs: 0, enemies: [], arrows: [], corpses: [], boss: null, bossesBeaten: 0, nextBoss: FIRST_BOSS_AT, ts: 1, tsTarget: 1, tsT: 0, hitstop: 0, ending: false, endT: 0, wave: null, banner: null, newBest: false });
  PARTS.length = 0; DECALS.length = 0; FX.length = 0; RIPPLES.length = 0;
  DIR.next = 1.6; DIR.archerCD = 0; DIR.streak = 0;
  PLAYERS.forEach((p, i) => {
    p.x = PLAYERS.length > 1 ? (i ? 70 : -70) : 0; p.y = 0; p.vy = 0; p.hp = MAX_HP; p.dead = false; p.moving = 0;
    p.face = PLAYERS.length > 1 ? (i ? 1 : -1) : 1; p.lock = 0; p.hurtT = 0; p.inv = 0; p.buffer = 0;
    p.play([[POSE.ready, .25, Ease.inOutCubic]]);
  });
  INPUT.left = INPUT.right = INPUT.jump = false;
  WOLF.special = -1;
  $('bossbar').classList.remove('on');
}
function startRun() {
  SND.init(); resetRun();
  GAME.mode = 'play'; V.camTX = 0;
  show('title', false); show('end', false); $('hud').classList.add('on');
  $('touch').classList.toggle('on', IS_TOUCH);
  SND.musicStart(1); SND.phrase(.06);
  banner('居合', 'The wind rises');
  flash(1, 1, 1, .25);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function endRun() {
  GAME.ending = true; GAME.endT = 0;
  slowmo(.2, 2.2); SND.gong(); SND.musicStop(); P.lock = 99;
  flash(1, .95, .85, .35); shake(.3);
  if (GAME.boss && GAME.boss.state === 'fight') GAME.boss.state = 'leave';
  GAME.newBest = GAME.score > GAME.best;
  if (GAME.newBest) { GAME.best = GAME.score; store.set('iai.best', GAME.score); }
  if (GAME.maxCombo > GAME.bestCombo) { GAME.bestCombo = GAME.maxCombo; store.set('iai.bestCombo', GAME.maxCombo); }
}
function showResults() {
  GAME.mode = 'end';
  const rank = rankFor(GAME.score);
  $('rankK').textContent = rank[1]; $('rankK').classList.toggle('two', rank[1].length > 1); $('rankFr').textContent = rank[2];
  $('eScore').textContent = GAME.score.toLocaleString('en-US');
  $('eKills').textContent = GAME.kills;
  const att = GAME.perfects + GAME.goods;
  $('ePerf').textContent = att ? Math.round(GAME.perfects / att * 100) + '%' : '—';
  $('eCombo').textContent = GAME.maxCombo;
  $('eOni').textContent = GAME.bossesBeaten;
  $('eTime').textContent = formatSurvived(GAME.t);
  $('eBest').textContent = GAME.best.toLocaleString('en-US');
  $('eNew').classList.toggle('on', GAME.newBest);
  $('hud').classList.remove('on'); $('touch').classList.remove('on');
  show('end', true);
  SND.phrase(.07);
  setTimeout(() => { const b = $('btnAgain'); if (b && GAME.mode === 'end') b.focus({ preventScroll: true }); }, 400);
}
function toMenu() {
  GAME.mode = 'title'; resetRun(); refreshTitle();
  show('end', false); show('title', true); $('hud').classList.remove('on'); $('touch').classList.remove('on');
  SND.musicStart(0);
}

/* ---------------- HUD ---------------- */
const hud = { score: true, lastSecs: -1, lastGauge: -1, lastHp: -1 };
function updateHUD() {
  if (hud.score) {
    hud.score = false;
    $('score').textContent = GAME.score.toLocaleString('en-US');
    $('mult').textContent = '×' + mult();
    $('mult').classList.toggle('hot', mult() > 1);
  }
  // Game Room: health and time survived, in place of the countdown.
  if (P.hp !== hud.lastHp) {
    hud.lastHp = P.hp;
    $('hpFill').style.transform = 'scaleX(' + (P.hp / MAX_HP).toFixed(3) + ')';
    $('health').classList.toggle('low', P.hp > 0 && P.hp <= 30);
    $('health').setAttribute('aria-valuenow', String(P.hp));
  }
  const secs = Math.floor(GAME.t);
  if (secs !== hud.lastSecs) { hud.lastSecs = secs; $('survived').textContent = formatSurvived(GAME.t); }
  const gg = Math.round(GAME.gauge * 100);
  if (gg !== hud.lastGauge) {
    hud.lastGauge = gg;
    $('wolfFill').setAttribute('y', 64 - 64 * GAME.gauge);
    $('wolfBtn').classList.toggle('full', GAME.gauge >= 1);
    if (GAME.gauge >= 1 && hud.wasFull !== true) { SND.bell(660, .08); SND.bell(990, .06, .1); }
    hud.wasFull = GAME.gauge >= 1;
  }
}
function show(id, on) { $(id).classList.toggle('show', on); }
function refreshTitle() {
  $('tBest').textContent = GAME.best ? GAME.best.toLocaleString('en-US') : '—';
  $('tCombo').textContent = GAME.bestCombo || '—';
}

/* ---------------- input ---------------- */
// Game Room: A/D (or ←/→) move and turn, W (or ↑) jumps, Space slashes the
// way you face, Shift unleashes the wolf. Phones get on-screen buttons.
let IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
const KEY_MOVE = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
listen(window, 'keydown', e => {
  const c = e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(c)) e.preventDefault();
  if (c === 'KeyM') { SND.setMuted(!SND.muted); refreshMute(); return; }
  if (GAME.mode === 'title') { if (c === 'Enter' || c === 'Space') { e.preventDefault(); startRun(); } return; }
  if (GAME.mode === 'end') { if ((c === 'Enter' || c === 'Space' || c === 'KeyR') && !e.repeat) { e.preventDefault(); if (document.activeElement === $('btnMenu') && c === 'Enter') toMenu(); else startRun(); } if (c === 'Escape') toMenu(); return; }
  if (GAME.mode !== 'play') return;
  if (KEY_MOVE[c]) { INPUT[KEY_MOVE[c]] = true; return; }
  if (e.repeat) return;
  if (c === 'KeyW' || c === 'ArrowUp') INPUT.jump = true;
  else if (c === 'Space') slash(P);
  else if (c === 'ShiftLeft' || c === 'ShiftRight') howl(P);
  else if (c === 'Escape') toMenu();
});
listen(window, 'keyup', e => { const k = KEY_MOVE[e.code]; if (k) INPUT[k] = false; });
listen(window, 'blur', () => { INPUT.left = INPUT.right = false; });
function wireTouch() {
  for (const b of root.querySelectorAll('#touch [data-k]')) {
    const k = b.dataset.k;
    const down = (e) => {
      e.preventDefault(); SND.init(); b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch { /* optional */ }
      if (k === 'left' || k === 'right') INPUT[k] = true;
      else if (k === 'jump') INPUT.jump = true;
      else if (k === 'slash') slash(P);
    };
    const up = () => { b.classList.remove('on'); if (k === 'left' || k === 'right') INPUT[k] = false; };
    listen(b, 'pointerdown', down);
    listen(b, 'pointerup', up); listen(b, 'pointercancel', up); listen(b, 'lostpointercapture', up);
  }
}
function refreshMute() { const t = SND.muted ? 'Sound off' : 'Sound on'; root.querySelectorAll('.mute').forEach(b => { b.textContent = t + (IS_TOUCH ? '' : ' (M)'); b.setAttribute('aria-pressed', SND.muted ? 'true' : 'false'); }); }

/* ---------------- render ---------------- */
const SKIP = new Set(((location.search.match(/skip=([\w,]+)/) || [])[1] || '').split(','));
function render(dt, rdt) {
  const g = SC, gg = GC, t = WIND.t;
  gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over'; gg.globalAlpha = 1;
  gg.fillStyle = '#000'; gg.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
  gg.globalCompositeOperation = 'lighter';
  if (!SKIP.has('sky')) drawSky(g, t);
  if (!SKIP.has('sun')) drawSun(g, gg);
  if (!SKIP.has('clouds')) drawClouds(g, dt, false);
  if (!SKIP.has('clouds')) drawClouds(g, dt, true);
  camT(g, V.pr); camT(gg, V.pr / 2);
  if (!SKIP.has('wolf')) drawWolf(g, gg);
  if (!SKIP.has('ridge')) for (const [L, par] of [[AS.ridgeFar, .12], [AS.ridgeNear, .3]]) { camT(g, V.pr, par, par); g.drawImage(L.canvas, L.x + V.camX * par, L.y, L.w, L.h); }
  camT(g, V.pr); camT(gg, V.pr / 2);
  if (!SKIP.has('ground')) g.drawImage(AS.ground.canvas, AS.ground.x, AS.ground.y, AS.ground.w, AS.ground.h);
  drawDecals(g, dt);
  if (!SKIP.has('grass')) drawGrassLayer(g, GRASS.layers[0], t, 0, 0);
  drawFX(g, gg, 0, dt);
  if (!SKIP.has('grass')) drawGrassLayer(g, GRASS.layers[1], t, P.x, .25);
  // boss arms behind the fighters
  if (GAME.boss) {
    for (const a of GAME.boss.arms) {
      if (a.state === 'wind') { const k = Math.min(1, a.t / Math.max(.1, a.windDur)); g.save(); g.globalAlpha = k * .9; drawSigil(g, a.tx + a.side * R_IDEAL, 0, k); g.restore(); }
      GAME.boss.drawArm(g, gg, a);
    }
    GAME.boss.drawFace(g, gg);
  }
  // enemies (far to near), corpses, arrows
  for (const c of GAME.corpses) {
    if (c.burn) {
      const e = c.e, sc = ENEMY_KIND[e.kind].scale, u = c.t / c.life;
      g.save(); g.globalAlpha = 1 - u; g.translate(e.x, 0); g.scale(e.face * sc, sc); drawEnemy(g, NULLG, e); g.restore();
    } else drawCorpse(g, gg, c);
  }
  const ens = GAME.enemies.slice().sort((a, b) => b.d - a.d);
  for (const e of ens) {
    const sc = ENEMY_KIND[e.kind].scale;
    g.save(); g.translate(e.x, 0); g.scale(e.face * sc, sc);
    gg.save(); gg.translate(e.x, 0); gg.scale(e.face * sc, sc);
    drawEnemy(g, gg, e);
    g.restore(); gg.restore();
  }
  for (const a of GAME.arrows) drawArrow(g, gg, a);
  if (!SKIP.has('parts')) drawParts(g, gg, false);
  if (!SKIP.has('sam')) for (const p of PLAYERS) p.draw(g, gg);
  drawFX(g, gg, 1, dt);
  if (!SKIP.has('grass')) drawGrassLayer(g, GRASS.layers[2], t, P.x, .4);
  if (!SKIP.has('parts')) drawParts(g, gg, true);
  // screen space
  g.setTransform(V.pr, 0, 0, V.pr, 0, 0); gg.setTransform(V.pr / 2, 0, 0, V.pr / 2, 0, 0);
  drawFX(g, gg, 2, dt);
  if (GAME.mode === 'play') { drawCombo(g, gg); drawIndicators(g); }
  drawBanner(g, gg, rdt);
}
function drawSigil(g, x, y, k) {
  g.save(); g.translate(x, y);
  g.strokeStyle = `rgba(178,30,38,${.85 * k})`; g.lineWidth = 5;
  g.beginPath(); g.ellipse(0, 0, 70 * (1.4 - k * .4), 20 * (1.4 - k * .4), 0, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 54, 15, 0, 0, TAU); g.stroke();
  g.scale(1, .32); g.font = '64px "Yuji Boku", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = `rgba(178,30,38,${.9 * k})`; g.fillText('鬼', 0, 0);
  g.restore();
}
function drawCombo(g, gg) {
  if (GAME.combo < 2) return;
  const pulse = GAME.comboPulse, s = (1 + pulse * .35) * clamp(V.S, .7, 1.3);
  const x = V.W / 2, y = V.gy - 405 * V.S * V.Z;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '64px "Yuji Boku", serif';
  g.lineWidth = 8; g.strokeStyle = 'rgba(235,227,207,.85)'; g.strokeText(GAME.combo, 0, 0);
  g.fillStyle = mult() >= 4 ? '#b21e26' : '#0c0d1c'; g.fillText(GAME.combo, 0, 0);
  g.font = '700 15px "Cormorant Garamond", serif'; g.fillStyle = '#0c0d1c';
  g.fillText('連 撃  ·  COMBO', 0, 22);
  g.restore();
  if (pulse > .3) { gg.globalAlpha = pulse * .5; gg.drawImage(AS.gGold, (x - 80 * s) , (y - 80 * s), 160 * s, 120 * s); gg.globalAlpha = 1; }
}
function drawIndicators(g) {
  for (const e of GAME.enemies) {
    const sx = V.W / 2 + (e.x - V.camX) * V.S * V.Z;
    if (sx > -10 && sx < V.W + 10) continue;
    if (e.state === 'leave') continue;
    const side = sx < 0 ? -1 : 1, x = side < 0 ? 22 : V.W - 22, y = V.gy - 140 * V.S;
    const near = clamp(1 - (e.d - V.halfW) / 500, .2, 1);
    g.save(); g.translate(x, y); g.scale(side, 1); g.globalAlpha = .4 + near * .6;
    g.fillStyle = e.kind === 'archer' ? '#c9a24f' : '#b21e26';
    g.beginPath(); g.moveTo(10, 0); g.lineTo(-8, -12); g.lineTo(-4, 0); g.lineTo(-8, 12); g.closePath(); g.fill();
    g.restore();
  }
}
function drawBanner(g, gg, rdt) {
  const b = GAME.banner; if (!b) return;
  b.t += rdt; if (b.t > 2) { GAME.banner = null; return; }
  const a = b.t < .2 ? b.t / .2 : b.t > 1.5 ? (2 - b.t) / .5 : 1, s = lerp(1.25, 1, Ease.outCubic(Math.min(1, b.t / .3)));
  const x = V.W / 2, y = V.H * (V.portrait ? .2 : .25);
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(120, V.W / (b.k.length + 1.5));
  g.font = `${fs}px "Yuji Boku", serif`;
  g.lineWidth = 10; g.strokeStyle = 'rgba(235,227,207,.8)'; g.strokeText(b.k, 0, 0);
  g.fillStyle = '#0c0d1c'; g.fillText(b.k, 0, 0);
  g.font = `italic 600 ${Math.round(Math.min(26, V.W / 22))}px "Cormorant Garamond", serif`;
  g.lineWidth = 5; g.strokeText(b.fr, 0, fs * .62); g.fillStyle = '#7a1018'; g.fillText(b.fr, 0, fs * .62);
  g.restore();
}

/* ---------------- main loop ---------------- */
let last = 0;
function frame(now) {
  if (destroyed) return;
  rafId = requestAnimationFrame(frame);
  const rdt = Math.min(.05, (now - (last || now)) / 1000); last = now;
  if (GAME.mode === 'loading') return;
  // time scale & hitstop
  if (GAME.tsT > 0) { GAME.tsT -= rdt; if (GAME.tsT <= 0) GAME.tsTarget = 1; }
  GAME.ts += (GAME.tsTarget - GAME.ts) * (1 - Math.exp(-rdt * (GAME.tsTarget > GAME.ts ? 6 : 30)));
  let dt = rdt * GAME.ts;
  if (GAME.hitstop > 0) { GAME.hitstop -= rdt; dt *= .06; }
  WIND.t += dt;
  WIND.gustT -= dt; if (WIND.gustT <= 0) { WIND.gustT = rr(3, 7); WIND.gustTarget = rr(0, .25); }
  WIND.gust += ((WIND.gustTarget || 0) - WIND.gust) * dt * .8;
  if (GAME.mode === 'play' && !GAME.ending) {
    GAME.t += dt;
    if (GAME.t >= 15 && SND.mus.level < 2) SND.musicLevel(2);
    if (GAME.t >= 30 && SND.mus.level < 3) SND.musicLevel(3);
    if (GAME.t >= GAME.nextBoss && !GAME.boss && (GAME.enemies.filter(e => e.kind !== 'archer').length === 0 || GAME.t > GAME.nextBoss + 2)) startBoss();
    spawnTick(dt);
  }
  if (GAME.mode === 'play') {
    for (const p of PLAYERS) {
      if (!p.dead) { p.lock = Math.max(0, p.lock - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.inv = Math.max(0, p.inv - dt); }
      if (p.buffer > 0) { p.buffer -= rdt; if (p.lock <= 0 && p.hurtT <= 0) { p.buffer = 0; slash(p); } }
    }
    movePlayer(P, dt, INPUT);
    if (!GAME.ending) { updateEnemies(dt); updateBoss(dt); updateWave(dt); }
    else {
      GAME.endT += rdt;
      for (const c of GAME.corpses) if (!c.burn) updateCorpse(c, dt);
      if (GAME.boss) GAME.boss.update(dt);
      if (GAME.endT > 2.1 && GAME.mode === 'play') showResults();
    }
  }
  P.aura += ((GAME.mode === 'play' ? GAME.gauge : .15) - P.aura) * rdt * 3;
  for (const p of PLAYERS) p.update(dt, windAt(p.x, WIND.t));
  if (GAME.gauge >= 1 && Math.random() < dt * 14) embers(P.x + rr(-30, 30), -200, 1, 30, -140, .9);
  updateWolf(dt, GAME.mode === 'play' ? GAME.gauge : GAME.mode === 'title' ? .55 : .2, P);
  updateParts(dt); ambient(dt);
  GAME.comboPulse = Math.max(0, GAME.comboPulse - rdt * 4);
  // camera
  V.camTX = GAME.mode === 'title' ? (V.portrait ? 0 : -V.halfW * .36) : 0;
  V.camX += (V.camTX - V.camX) * (1 - Math.exp(-rdt * 2.4));
  V.trauma = Math.max(0, V.trauma - rdt * 1.6);
  const tr = V.trauma * V.trauma, ss = 26;
  V.shx = (Math.random() * 2 - 1) * tr * ss; V.shy = (Math.random() * 2 - 1) * tr * ss * .7;
  V.punch = Math.max(0, V.punch - rdt * .25);
  V.Z = 1 + V.punch + (WOLF.special >= 0 ? .04 * Math.sin(Math.min(1, WOLF.special / 1.6) * PI) : 0) + (GAME.ending ? .05 * Ease.inOutSine(Math.min(1, GAME.endT / 2)) : 0);
  // post FX decay
  FXU.ca = Math.max(0, FXU.ca - rdt * .04); FXU.hurt = Math.max(0, FXU.hurt - rdt * 2.2);
  FXU.flash[3] = Math.max(0, FXU.flash[3] - rdt * 3.2);
  FXU.shockR += rdt * 1.1; FXU.shock[2] = FXU.shockR; FXU.shock[3] = Math.max(0, FXU.shock[3] - rdt * 2.2);
  FXU.radial[2] = Math.max(0, FXU.radial[2] - rdt * .35);
  FXU.fade = Math.max(0, FXU.fade - rdt * 1.2);
  const _t0 = performance.now();
  render(dt, rdt);
  const _t1 = performance.now();
  if (post) {
    post.render(sceneCanvas, glowCanvas, { time: now / 1000, ca: FXU.ca, slow: clamp((1 - GAME.ts) * 1.3, 0, 1), hurt: FXU.hurt, bloom: 1.05, paper: .95, vig: .3, fade: FXU.fade, fadeCol: FXU.fadeCol, flash: FXU.flash, shock: FXU.shock, radial: FXU.radial });
  }
  const _t2 = performance.now();
  adaptQuality(rdt);
  PERF.render = PERF.render * .9 + (_t1 - _t0) * .1; PERF.post = PERF.post * .9 + (_t2 - _t1) * .1;
  if (GAME.mode === 'play') updateHUD();
  SND.tick();
}
const PERF = { render: 0, post: 0 };

/* ---------------- dynamic resolution ---------------- */
const DYN = { ema: 1 / 60, t: 0, scale: 1, good: 0 };
function adaptQuality(rdt) {
  if (GAME.mode === 'loading' || /fixedres/.test(location.search)) return;
  DYN.ema = DYN.ema * .95 + rdt * .05; DYN.t += rdt;
  if (DYN.t < 1) return; DYN.t = 0;
  if (DYN.ema > 1 / 44 && DYN.scale > .55) { DYN.scale = Math.max(.55, DYN.scale * .86); DYN.good = 0; sizeCanvases(); }
  else if (DYN.ema < 1 / 57) { if (++DYN.good >= 4 && DYN.scale < 1) { DYN.scale = Math.min(1, DYN.scale * 1.08); DYN.good = 0; sizeCanvases(); } }
  else DYN.good = 0;
}

/* ---------------- boot ---------------- */
function sizeCanvases() {
  layout(); V.pr *= DYN.scale;
  const w = Math.round(V.W * V.pr), h = Math.round(V.H * V.pr);
  sceneCanvas.width = w; sceneCanvas.height = h;
  glowCanvas.width = Math.max(1, Math.round(w / 2)); glowCanvas.height = Math.max(1, Math.round(h / 2));
  if (post) { outCanvas.width = w; outCanvas.height = h; post.resize(w, h, glowCanvas.width, glowCanvas.height); }
}
async function boot() {
  outCanvas = $('out');
  sceneCanvas = document.createElement('canvas'); glowCanvas = document.createElement('canvas');
  try { if (!/nopost/.test(location.search)) post = new Post(outCanvas); } catch { post = null; }
  if (!post) { outCanvas.replaceWith(sceneCanvas); sceneCanvas.id = 'out'; }
  SC = sceneCanvas.getContext('2d'); GC = glowCanvas.getContext('2d');
  sizeCanvases();
  listen(window, 'resize', sizeCanvases);
  root.classList.toggle('touch', IS_TOUCH);
  listen(window, 'touchstart', () => { if (!IS_TOUCH) { IS_TOUCH = true; root.classList.add('touch'); refreshMute(); } }, { passive: true });
  wireTouch();
  const q = clamp(V.S * V.pr, .8, 2), qc = Math.min(q, 1.5);
  AS.q = q;
  const steps = [
    ['Grinding the ink', () => { AS.pat = {}; for (const k of ['robe', 'hakama', 'ronin', 'shinobi', 'armor', 'straw', 'oni', 'lining', 'archer']) AS.pat[k] = paintPattern(k, q); }],
    ['The wind rises', () => { AS.clouds = [paintCloud(CLOUD_SPECS[0], qc), paintCloud(CLOUD_SPECS[1], qc)]; }],
    ['The clouds turn', () => { for (let i = 2; i < CLOUD_SPECS.length; i++) AS.clouds.push(paintCloud(CLOUD_SPECS[i], qc)); }],
    ['The wolf spirit wakes', () => { AS.wolf = paintWolf(Math.min(q, 1.6)); AS.dabs = paintFlameDabs(Math.min(q, 1)); }],
    ['A demon waits', () => { AS.oni = paintOni(Math.min(q, 1.4)); }],
    ['The mountains', () => {
      AS.ridgeFar = paintRidge(Math.min(q, 1), { seed: 5, top: -420, bot: 40, base: -70, amp: 230, freq: .0013, col: hex('#3a4d97'), ink: hex('#1b2766'), alpha: .2, strokes: 1600, trees: 0 });
      AS.ridgeNear = paintRidge(Math.min(q, 1), { seed: 9, top: -260, bot: 40, base: -24, amp: 110, freq: .0024, col: hex('#2a3b7c'), ink: hex('#141d55'), alpha: .3, strokes: 1800, trees: 46 });
    }],
    ['The meadow', () => { AS.ground = paintGround(Math.min(q, 1)); }],
    ['The blade', () => {
      AS.splat = paintSplats(Math.min(q, 1)); AS.splatInk = AS.splat.map(c => tintCopy(c, '#14101c')); AS.splatRed = AS.splat.map(c => tintCopy(c, '#6e0d15'));
      AS.swipe = paintSwipe(Math.min(q, 1.5));
      AS.gBlue = glowSprite([90, 140, 255]); AS.gGold = glowSprite([255, 200, 110]); AS.gWhite = glowSprite([220, 235, 255]); AS.gOrange = glowSprite([255, 140, 40]); AS.gRed = glowSprite([255, 50, 40]);
      const puff = (col) => { const c = mkCanvas(96, 96), g = c.getContext('2d'); const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48); gr.addColorStop(0, rgba(col, .8)); gr.addColorStop(.5, rgba(col, .35)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return c; };
      AS.puffInk = puff([20, 18, 30]); AS.puffBlue = puff([40, 80, 200]);
    }],
  ];
  for (let i = 0; i < steps.length; i++) {
    if (destroyed) return;
    $('loadTxt').textContent = steps[i][0] + '…';
    $('loadBar').style.width = (i / steps.length * 100) + '%';
    await nextFrame(); await nextFrame();
    steps[i][1]();
  }
  $('loadBar').style.width = '100%';
  try { await Promise.race([Promise.all([document.fonts.load('40px "Yuji Boku"', '居合一閃'), document.fonts.load('600 20px "Cormorant Garamond"')]), new Promise(r => setTimeout(r, 2500))]); } catch {}
  makePatterns(SC); buildGrass(); buildClouds();
  for (let i = 0; i < 30; i++) addP({ k: i % 2 ? 'leaf' : 'fluff', x: rr(-V.halfW, V.halfW), y: rr(V.top * .9, 30), vx: rr(60, 140), vy: 0, life: rr(6, 14), t: rr(0, 4), s: rr(2, 4.5), rot: rr(0, TAU), vr: rr(-4, 4), ph: rr(0, TAU) });
  P.update(.016, 0);
  V.camX = V.portrait ? 0 : -V.halfW * .36;
  GAME.mode = 'title'; refreshTitle(); refreshMute();
  show('loading', false); show('title', true);
  if (destroyed) return;
  listen($('btnPlay'), 'click', () => startRun());
  listen($('btnAgain'), 'click', () => startRun());
  listen($('btnMenu'), 'click', toMenu);
  listen($('wolfBtn'), 'click', () => howl(P));
  root.querySelectorAll('.mute').forEach(b => listen(b, 'click', () => { SND.init(); SND.setMuted(!SND.muted); refreshMute(); }));
  const firstGesture = () => { SND.init(); if (GAME.mode === 'title' && !SND.mus.on) { SND.musicStart(0); SND.phrase(.05); } };
  listen(window, 'pointerdown', firstGesture, { once: true }); listen(window, 'keydown', firstGesture, { once: true });
  if (options.onReady) options.onReady();
}
// Game Room: the page drives the engine through this API (see ./engine.d.ts).
const api = {
  /** Starts a run from the title or results screen. */
  startSolo() { if (GAME.mode === 'title' || GAME.mode === 'end') startRun(); },
  destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    for (const off of cleanups.splice(0)) off();
    try { if (SND.ctx) SND.ctx.close(); } catch { /* already closed */ }
    try { const lose = post && post.gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch { /* optional */ }
    if (window.Iai === api) delete window.Iai;
  },
};
if (options.exposeForTests) window.Iai = Object.assign(api, { GAME, P, PLAYERS, V, WOLF, INPUT, slash, howl, startRun });
rafId = requestAnimationFrame(frame);
boot();
return api;
}
