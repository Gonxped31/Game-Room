// Night Highway's engine: a port of references/night-highway/Night Highway.html's
// script, kept as close to the original as possible so the two stay easy to
// compare (which is also why it stays plain JavaScript; ./engine.d.ts types
// its API). What changed, all marked "Game Room:" below:
// - It's wrapped in createEngine(root, options), looks its elements up inside
//   `root`, and tracks every listener so destroy() leaves nothing behind.
// - Same-direction traffic comes from lib/games/nighthighway/traffic.ts, in
//   world coordinates, so a race shows both players identical traffic.
//   Traffic can no longer be shoved: a collision moves the player instead.
// - A race (startRace) runs off the server's clock: a scripted, side-by-side
//   countdown, then 60 s of driving, then onFinish(result). The car's position
//   goes out through onLive ten times a second, and the other racer shows up
//   as a ghost car (setOpponent).
// - No pausing or restarting mid-race, since the clock is shared.
// - Pickups (nitro, phase, shield) and the rain/pickups options; see
//   lib/games/nighthighway/pickups.ts.
// - Rain (an option): less grip so the car slides, longer braking, harder
//   bends; falling rain, a wetter-looking road and a hiss.
// - The desert circuit (an option): sunset, dunes, mesas and cacti in place
//   of the city at night, and hills - the world lifted in the vertex shaders
//   the way the curves bend it. See setCircuit().
// - Curves: the world is bent sideways in the vertex shaders (the game itself
//   stays a straight road), and bends push the car outward; see
//   lib/games/nighthighway/road.ts.
import * as THREE from 'three';
import { TrafficSim } from '@/lib/games/nighthighway/traffic';
import { COUNTDOWN_SECONDS, COUNTDOWN_SPEED, LIVE_INTERVAL_MS, RUN_SECONDS } from '@/lib/games/nighthighway/constants';
import { COMBO_SECONDS, DEFAULT_OPTIONS, MAX_COMBO, NEAR_MISS_GAP, NEAR_MISS_MIN_SPEED, nearMissPoints } from '@/lib/games/nighthighway/game';
import { NITRO_REFILL, PHASE_SECONDS, pickupsBetween, reaches } from '@/lib/games/nighthighway/pickups';
import { inSand, SAND_DRAG, sandBetween, sandSpan } from '@/lib/games/nighthighway/sand';
import { BEND_EXAGGERATION, BEND_SAMPLES, BEND_START, BEND_STEP, bendAt, CENTRIFUGAL, curvatureAt, fillBendTable, fillHillTable } from '@/lib/games/nighthighway/road';

const DEAD_ENGINE = { startSolo() {}, startRace() {}, stopRace() {}, setOpponent() {}, setOptions() {}, trafficChecksum() { return ''; }, raceTrafficChecksum() { return ''; }, destroy() {} };
// Game Room: how long a broken shield lets the car pass through the car it hit (s).
const SHIELD_BREAK_SECONDS = 0.8;

export function createEngine(root, options = {}) {
const $ = (id) => root.querySelector('#' + id);
const bootEl = $('boot');
// Game Room: every listener goes through listen(), so destroy() can remove it.
const cleanups = [];
function listen(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}
function fatal(msg) {
  if (bootEl) {
    bootEl.hidden = false;
    bootEl.classList.add('err');
    bootEl.querySelector('p').textContent = msg;
  }
  if (options.onFatal) options.onFatal(msg);
}
const RACE_MODE = options.mode === 'race';

// ---------- small helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const mod = (a, n) => ((a % n) + n) % n;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const hdr = (r, g, b) => new THREE.Color(r, g, b);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const store = {
  get(k, d) { try { const v = window.localStorage.getItem('night-highway:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { window.localStorage.setItem('night-highway:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ---------- renderer ----------
const canvas = $('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
} catch { renderer = null; }
if (!renderer || !renderer.getContext()) { fatal('This game needs WebGL, and this browser has it turned off. Try another browser or turn on hardware acceleration.'); return DEAD_ENGINE; }
renderer.setClearColor(0x000000, 1);
const gl = renderer.getContext();
const isGL2 = renderer.capabilities.isWebGL2;
let hdrType = THREE.UnsignedByteType;
if (isGL2 && gl.getExtension('EXT_color_buffer_float')) hdrType = THREE.HalfFloatType;
else if (!isGL2 && gl.getExtension('OES_texture_half_float') && gl.getExtension('OES_texture_half_float_linear') && gl.getExtension('EXT_color_buffer_half_float')) hdrType = THREE.HalfFloatType;
const HDR = hdrType === THREE.HalfFloatType;
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();

// ---------- Game Room: curves ----------
// Every vertex is pushed sideways by how far the road has bent at its
// distance ahead (a table refilled every frame from road.ts). The car sits
// at z = 0 and the road runs toward -z, so "ahead" is -z.
// Game Room: the desert's hills lift it the same way, from a second table
// on the same grid (all zeros in the city).
const BEND = { nhBend: { value: new Float32Array(BEND_SAMPLES) }, nhHill: { value: new Float32Array(BEND_SAMPLES) } };
const BEND_GLSL = `
uniform float nhBend[${BEND_SAMPLES}];
uniform float nhHill[${BEND_SAMPLES}];
vec2 nhBendXY(float z) {
  float f = clamp((-z - (${BEND_START.toFixed(1)})) / ${BEND_STEP.toFixed(1)}, 0.0, ${(BEND_SAMPLES - 1.001).toFixed(3)});
  int i = int(f);
  return vec2(mix(nhBend[i], nhBend[i + 1], f - float(i)), mix(nhHill[i], nhHill[i + 1], f - float(i)));
}
`;
// three's project_vertex chunk, with the bend applied in world space.
const BEND_PROJECT = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelMatrix * mvPosition;
mvPosition.xy += nhBendXY( mvPosition.z );
mvPosition = viewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
// Built-in materials get the bend as they compile (custom shaders below include it themselves).
function bendMaterial(m) {
  if (!m || m.isShaderMaterial) return;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.nhBend = BEND.nhBend;
    shader.uniforms.nhHill = BEND.nhHill;
    shader.vertexShader = BEND_GLSL + shader.vertexShader.replace('#include <project_vertex>', BEND_PROJECT);
  };
}
let roadSeed = (Math.random() * 4294967296) >>> 0;
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 4200);

// ---------- post-processing: HDR scene -> bloom + anamorphic flare -> radial motion blur, grade ----------
const rtOpts = (depth) => ({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: hdrType, depthBuffer: depth, stencilBuffer: false });
let sceneRT;
if (isGL2 && THREE.WebGLMultisampleRenderTarget) {
  sceneRT = new THREE.WebGLMultisampleRenderTarget(4, 4, rtOpts(true));
  sceneRT.samples = 4;
} else {
  sceneRT = new THREE.WebGLRenderTarget(4, 4, rtOpts(true));
}
const LEVELS = 6;
const downRT = [];
const upRT = [];
for (let i = 0; i < LEVELS; i++) {
  downRT.push(new THREE.WebGLRenderTarget(4, 4, rtOpts(false)));
  upRT.push(new THREE.WebGLRenderTarget(4, 4, rtOpts(false)));
}
const flareRT = [new THREE.WebGLRenderTarget(4, 4, rtOpts(false)), new THREE.WebGLRenderTarget(4, 4, rtOpts(false))];
const maskRT = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
[sceneRT, maskRT].concat(downRT, upRT, flareRT).forEach((r) => { r.texture.generateMipmaps = false; });

const POST_VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const postMat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

const quadGeo = new THREE.BufferGeometry();
quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(quadGeo);
quad.frustumCulled = false;
postScene.add(quad);
function runPass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }

const prefilterMat = postMat(`
uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
vec3 pf(vec3 c) {
  c = clamp(c, vec3(0.0), vec3(40.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  return c * (max(soft, br - uThreshold) / max(br, 1e-4));
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 4.0;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(pf(c / 8.0), 1.0);
}`, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: HDR ? 1.5 : 0.9 }, uKnee: { value: 0.5 } });

const downMat = postMat(`
uniform sampler2D tDiffuse; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 4.0;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() } });

const upMat = postMat(`
uniform sampler2D tDiffuse; uniform sampler2D tAdd; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tDiffuse, vUv + vec2(-2.0 * o.x, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0, 2.0 * o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(2.0 * o.x, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0, -2.0 * o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`, { tDiffuse: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });

const flareMat = postMat(`
uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uSpread; uniform float uCut;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  float ws = 0.0;
  for (int i = -7; i <= 7; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 24.0);
    vec3 s = texture2D(tDiffuse, vUv + vec2(fi * uTexel.x * uSpread, 0.0)).rgb;
    c += max(s - vec3(uCut), vec3(0.0)) * w;
    ws += w;
  }
  gl_FragColor = vec4(c / ws, 1.0);
}`, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 }, uCut: { value: 0 } });

const compositeMat = postMat(`
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tFlare; uniform sampler2D tMask;
uniform vec2 uRes; uniform vec2 uVP;
uniform float uBlur; uniform float uSamples; uniform float uBloom; uniform float uFlare; uniform vec3 uFlareTint;
uniform float uExposure; uniform float uTime; uniform float uAberr; uniform float uVignette; uniform float uGrain;
uniform vec3 uFlash; uniform vec3 uTint; uniform float uTintAmt; uniform vec3 uLift;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 uv = vUv;
  vec3 base = min(texture2D(tScene, uv).rgb, vec3(60.0));
  float mask = texture2D(tMask, uv).r;
  vec2 d = uv - uVP;
  float len = length(d);
  vec2 nd = d / max(len, 1e-4);
  float amt = uBlur * min(len, 0.85) * (1.0 - mask);
  vec3 acc = base;
  float wsum = 1.0;
  if (amt > 0.0005) {
    float j = hash(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0);
    for (int i = 1; i <= 10; i++) {
      float fi = float(i);
      if (fi > uSamples) break;
      float t = (fi - j) / uSamples;
      vec2 suv = uv - nd * amt * t;
      float w = (1.0 - texture2D(tMask, suv).r) * (1.0 - 0.45 * t);
      acc += min(texture2D(tScene, suv).rgb, vec3(60.0)) * w;
      wsum += w;
    }
  }
  vec3 col = acc / wsum;
  vec2 cd = uv - 0.5;
  vec2 ca = cd * dot(cd, cd) * uAberr;
  float keep = 1.0 - mask;
  col.r += (texture2D(tScene, uv + ca).r - base.r) * keep;
  col.b += (texture2D(tScene, uv - ca).b - base.b) * keep;
  col = max(col, vec3(0.0));
  col += texture2D(tBloom, uv).rgb * uBloom;
  col += texture2D(tFlare, uv).rgb * uFlareTint * uFlare;
  col += uFlash;
  col = aces(col * uExposure);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col * uTint, (1.0 - l) * uTintAmt);
  col += uLift * (1.0 - l);
  vec2 vq = cd * vec2(uRes.x / uRes.y, 1.0);
  col *= mix(1.0, smoothstep(1.25, 0.32, length(vq)), uVignette);
  vec3 o = toSRGB(col);
  o += (hash(gl_FragCoord.xy + uTime * 61.7) - 0.5) * uGrain;
  gl_FragColor = vec4(o, 1.0);
}`, {
  tScene: { value: null }, tBloom: { value: null }, tFlare: { value: null }, tMask: { value: null },
  uRes: { value: new THREE.Vector2(1, 1) }, uVP: { value: new THREE.Vector2(0.5, 0.55) },
  uBlur: { value: 0 }, uSamples: { value: 9 }, uBloom: { value: HDR ? 0.16 : 0.12 }, uFlare: { value: 0.2 },
  uFlareTint: { value: new THREE.Vector3(0.45, 0.65, 1.25) },
  uExposure: { value: 0.95 }, uTime: { value: 0 }, uAberr: { value: 0.02 }, uVignette: { value: 0.7 }, uGrain: { value: 0.035 },
  uFlash: { value: new THREE.Vector3() },
  // Game Room: the grade's shadow tint and lift, per circuit (night blue in the city, warm in the desert).
  uTint: { value: new THREE.Vector3(0.9, 0.98, 1.14) }, uTintAmt: { value: 0.55 }, uLift: { value: new THREE.Vector3(0.004, 0.007, 0.016) },
});
const maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });

function renderFrame() {
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);

  // a quarter-res silhouette of the player's car keeps it sharp while the world smears
  scene.overrideMaterial = maskMat;
  camera.layers.set(1);
  renderer.setRenderTarget(maskRT);
  renderer.render(scene, camera);
  camera.layers.set(0);
  scene.overrideMaterial = null;

  prefilterMat.uniforms.tDiffuse.value = sceneRT.texture;
  prefilterMat.uniforms.uTexel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
  runPass(prefilterMat, downRT[0]);
  for (let i = 1; i < LEVELS; i++) {
    const s = downRT[i - 1];
    downMat.uniforms.tDiffuse.value = s.texture;
    downMat.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
    runPass(downMat, downRT[i]);
  }
  let cur = downRT[LEVELS - 1];
  for (let i = LEVELS - 2; i >= 0; i--) {
    upMat.uniforms.tDiffuse.value = cur.texture;
    upMat.uniforms.tAdd.value = downRT[i].texture;
    upMat.uniforms.uTexel.value.set(0.5 / cur.width, 0.5 / cur.height);
    runPass(upMat, upRT[i]);
    cur = upRT[i];
  }

  const fu = flareMat.uniforms;
  fu.uTexel.value.set(1 / downRT[1].width, 1 / downRT[1].height);
  fu.tDiffuse.value = downRT[1].texture; fu.uSpread.value = 1.6; fu.uCut.value = 2.4;
  runPass(flareMat, flareRT[0]);
  fu.tDiffuse.value = flareRT[0].texture; fu.uSpread.value = 5.0; fu.uCut.value = 0.0;
  runPass(flareMat, flareRT[1]);
  fu.tDiffuse.value = flareRT[1].texture; fu.uSpread.value = 14.0;
  runPass(flareMat, flareRT[0]);

  const cu = compositeMat.uniforms;
  cu.tScene.value = sceneRT.texture;
  cu.tBloom.value = upRT[0].texture;
  cu.tFlare.value = flareRT[0].texture;
  cu.tMask.value = maskRT.texture;
  runPass(compositeMat, null);
}

let qScale = 1;
const basePR = Math.min(window.devicePixelRatio || 1, coarse ? 1.0 : 1.25);
let viewW = 1;
let viewH = 1;
function resize() {
  viewW = Math.max(1, window.innerWidth);
  viewH = Math.max(1, window.innerHeight);
  const pr = basePR * qScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(viewW, viewH, false);
  const w = Math.max(2, Math.round(viewW * pr));
  const h = Math.max(2, Math.round(viewH * pr));
  sceneRT.setSize(w, h);
  let bw = w;
  let bh = h;
  for (let i = 0; i < LEVELS; i++) {
    bw = Math.max(1, bw >> 1);
    bh = Math.max(1, bh >> 1);
    downRT[i].setSize(bw, bh);
    upRT[i].setSize(bw, bh);
  }
  flareRT[0].setSize(downRT[1].width, downRT[2].height);
  flareRT[1].setSize(downRT[1].width, downRT[2].height);
  maskRT.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  compositeMat.uniforms.uRes.value.set(w, h);
  camera.aspect = viewW / viewH;
  camera.updateProjectionMatrix();
}

// ---------- geometry helpers ----------
const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cylAt = (rt, rb, h, seg, x, y, z) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);
const flatPlane = (w, l, x, y, z) => new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2).translate(x, y, z);

function mergeGeometries(list, colors) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const hasUv = parts.every((g) => !!g.attributes.uv);
  const uv = hasUv ? new Float32Array(total * 2) : null;
  const col = colors ? new Float32Array(total * 3) : null;
  let o = 0;
  parts.forEach((g, gi) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) {
      const c = colors[gi];
      for (let i = 0; i < n; i++) { col[(o + i) * 3] = c[0]; col[(o + i) * 3 + 1] = c[1]; col[(o + i) * 3 + 2] = c[2]; }
    }
    o += n;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// smooth shading across gentle curves, hard edges where faces meet at a sharp angle
function creaseNormals(geo, angle) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const cosT = Math.cos(angle);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const faceN = [];
  const buckets = new Map();
  const key = (i) => Math.round(pos.getX(i) * 500) + ',' + Math.round(pos.getY(i) * 500) + ',' + Math.round(pos.getZ(i) * 500);
  for (let f = 0; f < n; f += 3) {
    a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); c.fromBufferAttribute(pos, f + 2);
    e1.subVectors(c, b); e2.subVectors(a, b);
    const fn = e1.cross(e2).normalize().clone();
    faceN.push(fn);
    for (let k = 0; k < 3; k++) {
      const kk = key(f + k);
      let arr = buckets.get(kk);
      if (!arr) { arr = []; buckets.set(kk, arr); }
      arr.push(fn);
    }
  }
  const nor = new Float32Array(n * 3);
  const acc = new THREE.Vector3();
  for (let f = 0; f < n; f += 3) {
    const fn = faceN[f / 3];
    for (let k = 0; k < 3; k++) {
      acc.set(0, 0, 0);
      for (const o of buckets.get(key(f + k))) if (o.dot(fn) > cosT) acc.add(o);
      if (acc.lengthSq() < 1e-8) acc.copy(fn);
      acc.normalize();
      nor[(f + k) * 3] = acc.x; nor[(f + k) * 3 + 1] = acc.y; nor[(f + k) * 3 + 2] = acc.z;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}

// ---------- canvas textures ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (opts.repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  if (opts.aniso) t.anisotropy = maxAniso;
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const ROAD_W = 17;
const ROAD_TEX_LEN = 24;
// Game Room: the desert's road is packed dirt - ruts where the wheels run, sand drifting in at the edges, no paint.
function makeRoadTextures(desert) {
  const W = 512, H = 2048;
  const px = (x) => (x + ROAD_W / 2) * W / ROAD_W;
  const py = (m) => m * H / ROAD_TEX_LEN;
  const base = makeCanvas(W, H), g = base.getContext('2d');
  const emc = makeCanvas(W, H), e = emc.getContext('2d');
  const roc = makeCanvas(W, H), r = roc.getContext('2d');
  g.fillStyle = desert ? '#8c6a4a' : '#26292f'; g.fillRect(0, 0, W, H);
  e.fillStyle = '#000000'; e.fillRect(0, 0, W, H);
  r.fillStyle = desert ? 'rgb(255,255,255)' : 'rgb(168,168,168)'; r.fillRect(0, 0, W, H); // dirt doesn't shine
  const blot = (ctx, x, y, rx, ry, style) => {
    ctx.fillStyle = style;
    for (const oy of [-H, 0, H]) { ctx.beginPath(); ctx.ellipse(x, y + oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  };
  for (let i = 0; i < 80; i++) {
    blot(g, rand(0, W), rand(0, H), rand(8, 46), rand(30, 220), Math.random() < 0.55 ? `rgba(0,0,0,${rand(0.05, 0.14).toFixed(3)})` : desert ? `rgba(176,150,118,${rand(0.05, 0.1).toFixed(3)})` : `rgba(120,126,138,${rand(0.03, 0.07).toFixed(3)})`);
  }
  if (desert) for (let i = 0; i < 60; i++) blot(g, px((Math.random() < 0.5 ? -1 : 1) * rand(7.7, 8.6)), rand(0, H), rand(6, 26), rand(40, 260), `rgba(200,160,112,${rand(0.25, 0.6).toFixed(3)})`);
  if (!desert) for (let i = 0; i < 28; i++) blot(r, rand(0, W), rand(0, H), rand(20, 70), rand(80, 360), `rgba(55,55,55,${rand(0.35, 0.7).toFixed(3)})`);
  for (const lc of [-5.4, -1.8, 1.8, 5.4]) {
    for (const off of [-0.8, 0.8]) {
      const x0 = px(lc + off - 0.38), x1 = px(lc + off + 0.38);
      const gd = g.createLinearGradient(x0, 0, x1, 0);
      gd.addColorStop(0, 'rgba(0,0,0,0)'); gd.addColorStop(0.5, `rgba(0,0,0,${desert ? 0.3 : 0.17})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gd; g.fillRect(x0, 0, x1 - x0, H);
      const gr = r.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(80,80,80,0)'); gr.addColorStop(0.5, 'rgba(80,80,80,0.55)'); gr.addColorStop(1, 'rgba(80,80,80,0)');
      if (!desert) { r.fillStyle = gr; r.fillRect(x0, 0, x1 - x0, H); }
    }
  }
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const nz = (Math.random() - 0.5) * 30; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz + 2; }
  g.putImageData(img, 0, 0);
  const paint = (x0, x1, y0, y1, color, glow) => {
    const X0 = px(x0), X1 = px(x1), Y0 = py(y0), Y1 = py(y1);
    g.fillStyle = color; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    e.fillStyle = glow; e.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    r.fillStyle = 'rgb(205,205,205)'; r.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  };
  if (desert) return { map: toTex(base, { repeat: true, aniso: true }), emissive: toTex(emc, { repeat: true, aniso: true }), rough: toTex(roc, { srgb: false, repeat: true, aniso: true }) };
  paint(-7.43, -7.27, 0, 24, '#cfae45', '#2c2408');   // median-side edge line (yellow)
  paint(7.27, 7.43, 0, 24, '#dcd9cf', '#2a2a2a');     // outside edge line (white)
  for (const lx of [-3.6, 0, 3.6]) for (const y0 of [0, 12]) paint(lx - 0.075, lx + 0.075, y0, y0 + 3, '#d6d3ca', '#262626');
  const dot = (xm, ym, c, glow) => {
    const X = px(xm), Y = py(ym);
    g.fillStyle = c; g.fillRect(X - 2, Y - 3, 4, 6);
    e.fillStyle = glow; e.fillRect(X - 2, Y - 3, 4, 6);
  };
  for (const lx of [-3.6, 0, 3.6]) for (const ym of [7.5, 19.5]) dot(lx, ym, '#e6e6e6', '#ffffff');
  for (const ym of [3, 9, 15, 21]) { dot(-7.35, ym, '#e8c24a', '#ffc340'); dot(7.35, ym, '#e6e6e6', '#d6e0ff'); }
  return { map: toTex(base, { repeat: true, aniso: true }), emissive: toTex(emc, { repeat: true, aniso: true }), rough: toTex(roc, { srgb: false, repeat: true, aniso: true }) };
}

function makeBarrierTextures() {
  const W = 128, H = 512;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const ce = makeCanvas(W, H), e = ce.getContext('2d');
  g.fillStyle = '#7d8290'; g.fillRect(0, 0, W, H);
  e.fillStyle = '#000000'; e.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const nz = (Math.random() - 0.5) * 26; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz; }
  g.putImageData(img, 0, 0);
  const gd = g.createLinearGradient(0, 0, W * 0.5, 0);
  gd.addColorStop(0, 'rgba(18,18,24,0.6)'); gd.addColorStop(1, 'rgba(18,18,24,0)');
  g.fillStyle = gd; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(14,14,20,0.85)'; g.fillRect(0, 0, W, 3);
  const rx = Math.round(0.52 * W), ry = Math.round(H * 0.5);
  g.fillStyle = '#c9a033'; g.fillRect(rx, ry, 6, 10);
  e.fillStyle = '#ffb233'; e.fillRect(rx, ry, 6, 10);
  return { map: toTex(c, { repeat: true, aniso: true }), emissive: toTex(ce, { repeat: true }) };
}

function glowTexture(w, h, fn) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1;
      const a = clamp(fn(u, v), 0, 1) * 255;
      const i = (y * w + x) * 4;
      d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { srgb: false });
}
const texPool = glowTexture(128, 128, (u, v) => Math.pow(Math.max(0, 1 - Math.hypot(u, v)), 2.2));
const texStreak = glowTexture(32, 256, (u, v) => Math.exp(-(u * u) / 0.09) * Math.pow(Math.max(0, 1 - v * v), 1.6));
const texSoftRect = glowTexture(64, 128, (u, v) => smooth(1.0, 0.5, Math.max(Math.abs(u), Math.abs(v))));
const texShadow = glowTexture(64, 128, (u, v) => smooth(1.0, 0.35, Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25)));

// text-bearing textures get redrawn once the web fonts arrive
// Game Room: next/font hashes the family names, so the page passes the real stacks.
const fonts = options.fonts || {};
const SIGN_FONT = fonts.body || '"Overpass", "Arial Narrow", Arial, sans-serif';
const MONO_FONT = fonts.mono || '"Overpass Mono", Menlo, Consolas, monospace';
const DISPLAY_FONT = fonts.display || '"Big Shoulders Display", "Oswald", "Arial Narrow", Impact, sans-serif';
const textTextures = [];
function textTexture(w, h, draw) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  draw(g, w, h);
  const t = toTex(c, { aniso: true });
  textTextures.push({ g, w, h, draw, t });
  return t;
}
function redrawText() {
  for (const tt of textTextures) { tt.g.clearRect(0, 0, tt.w, tt.h); tt.draw(tt.g, tt.w, tt.h); tt.t.needsUpdate = true; }
}
function arrowGlyph(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath();
  g.moveTo(-s * 0.12, s * 0.5); g.lineTo(-s * 0.12, -s * 0.02); g.lineTo(-s * 0.34, -s * 0.02);
  g.lineTo(0, -s * 0.5); g.lineTo(s * 0.34, -s * 0.02); g.lineTo(s * 0.12, -s * 0.02); g.lineTo(s * 0.12, s * 0.5);
  g.closePath(); g.fill(); g.restore();
}
function drawSign(spec) {
  return (g, w, h) => {
    g.fillStyle = '#0d6a44'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#eef2ec'; g.lineWidth = 10; rr(g, 14, 14, w - 28, h - 28, 26); g.stroke();
    g.fillStyle = '#eef2ec'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    if (spec.exit) {
      g.font = `800 44px ${SIGN_FONT}`;
      const tw = g.measureText(spec.exit).width + 44;
      g.lineWidth = 6; rr(g, w - tw - 44, 40, tw, 66, 12); g.stroke();
      g.fillText(spec.exit, w - tw - 22, 90);
    }
    g.font = `800 ${spec.big}px ${SIGN_FONT}`; g.fillText(spec.l1, 60, spec.y1);
    g.font = `600 ${spec.mid}px ${SIGN_FONT}`; g.fillText(spec.l2, 64, spec.y2);
    if (spec.arrow === 'exit') arrowGlyph(g, w - 140, h - 140, 150, Math.PI / 4);
    if (spec.arrow === 'down') { arrowGlyph(g, w - 230, h - 110, 110, Math.PI); arrowGlyph(g, w - 110, h - 110, 110, Math.PI); }
  };
}
const texSignA = textTexture(1024, 448, drawSign({ exit: 'EXIT 21', l1: 'Downtown', l2: 'Harbor Blvd', big: 150, y1: 255, mid: 84, y2: 365, arrow: 'exit' }));
const texSignB = textTexture(1024, 544, drawSign({ l1: 'Airport', l2: 'Ocean Ave', big: 150, y1: 210, mid: 84, y2: 320, arrow: 'down' }));
const texPlate = textTexture(256, 64, (g, w, h) => {
  g.fillStyle = '#e6e9f0'; rr(g, 2, 2, w - 4, h - 4, 8); g.fill();
  g.strokeStyle = '#1b2440'; g.lineWidth = 3; rr(g, 3, 3, w - 6, h - 6, 7); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#25389a'; g.font = `600 11px ${MONO_FONT}`; g.fillText('AFTER MIDNIGHT', w / 2, 16);
  g.fillStyle = '#121a33'; g.font = `600 34px ${MONO_FONT}`; g.fillText('NITE 60', w / 2, 53);
});
function drawNeon(lines) {
  return (g, w, h) => {
    const gd = g.createLinearGradient(0, 0, 0, h);
    gd.addColorStop(0, '#0b0d1a'); gd.addColorStop(1, '#03040a');
    g.fillStyle = gd; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const L of lines) {
      g.font = L.font;
      g.shadowColor = L.glow; g.shadowBlur = 30; g.fillStyle = L.color; g.fillText(L.t, w / 2, L.y);
      g.shadowBlur = 10; g.fillText(L.t, w / 2, L.y);
      g.shadowBlur = 0; g.globalAlpha = 0.55; g.fillStyle = '#ffffff'; g.fillText(L.t, w / 2, L.y); g.globalAlpha = 1;
    }
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  };
}
const texBoards = [
  textTexture(1024, 384, drawNeon([
    { t: 'NOVA', font: `900 200px ${DISPLAY_FONT}`, color: '#6ff3ff', glow: '#1ad9ff', y: 225 },
    { t: 'OPEN ALL NIGHT', font: `800 52px ${SIGN_FONT}`, color: '#ff6fd8', glow: '#ff2fb9', y: 318 },
  ])),
  textTexture(1024, 384, drawNeon([
    { t: 'LATE DINER', font: `900 150px ${DISPLAY_FONT}`, color: '#ffb35c', glow: '#ff7a1a', y: 190 },
    { t: 'COFFEE · PANCAKES · 24/7', font: `800 46px ${SIGN_FONT}`, color: '#ffe8c4', glow: '#ff9d3d', y: 292 },
  ])),
  textTexture(1024, 384, drawNeon([
    { t: 'NIGHT FM', font: `900 170px ${DISPLAY_FONT}`, color: '#ff5470', glow: '#ff1f4a', y: 205 },
    { t: '101.7 · NO TALK, JUST DRIVING', font: `800 42px ${SIGN_FONT}`, color: '#d4e3ff', glow: '#7fa8ff', y: 300 },
  ])),
];
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load(`800 80px ${SIGN_FONT}`),
    document.fonts.load(`600 30px ${MONO_FONT}`),
    document.fonts.load(`900 80px ${DISPLAY_FONT}`),
  ]).then(redrawText).catch(() => {});
}

// ---------- sky, stars, distant skyline ----------
const SKY = { zenith: lin('#03060f'), mid: lin('#0a1633'), horizon: lin('#1b3263'), glow: lin('#25386a') };
const FOG_DENSITY = 0.0021;
// Game Room: where the desert's sun hangs - low, ahead and to the left.
const SUN_DIR = new THREE.Vector3(-0.62, 0.06, -0.78).normalize();
const FOG_COLOR = SKY.horizon.clone().add(SKY.glow.clone().multiplyScalar(0.45));
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    uZenith: { value: SKY.zenith.clone() }, uMid: { value: SKY.mid.clone() }, uHorizon: { value: SKY.horizon.clone() }, uGlow: { value: SKY.glow.clone() }, uTime: { value: 0 },
    // Game Room: the desert's low sun (uSun 0 in the city).
    uSunDir: { value: new THREE.Vector3(0, 0, -1) }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uSun: { value: 0 },
  },
  vertexShader: `
    varying vec3 vDir;
    void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uTime;
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSun;
    varying vec3 vDir;
    float h21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
      col = mix(col, uZenith, smoothstep(0.12, 0.75, h));
      col += uGlow * exp(-max(h, 0.0) * 11.0) * 0.45;
      vec2 cp = d.xz / max(h + 0.08, 0.04);
      float c = fbm(cp * 0.55 + vec2(uTime * 0.004, 0.0));
      float band = smoothstep(0.02, 0.10, h) * (1.0 - smoothstep(0.30, 0.65, h));
      float cl = smoothstep(0.48, 0.82, c) * band;
      col = mix(col, uGlow * 0.9 + uMid * 0.5, cl * 0.45);
      float sd = max(dot(d, uSunDir), 0.0);
      col += uSunCol * uSun * (smoothstep(0.99935, 0.9996, sd) * 6.0 + pow(sd, 60.0) * 0.6 + pow(sd, 6.0) * 0.18);
      col = mix(col, uHorizon + uGlow * 0.45, smoothstep(0.0, -0.05, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), skyMat);
sky.renderOrder = -3;
sky.frustumCulled = false;
scene.add(sky);

const stars = (() => {
  const N = 1100;
  const pos = new Float32Array(N * 3), aB = new Float32Array(N), aP = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const az = rand(0, Math.PI * 2);
    const el = Math.asin(rand(Math.sin(0.12), 0.98));
    const R = 2600;
    pos[i * 3] = Math.cos(el) * Math.sin(az) * R;
    pos[i * 3 + 1] = Math.sin(el) * R;
    pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * R;
    aB[i] = Math.pow(Math.random(), 3) * 1.6 + 0.12;
    aP[i] = rand(0, 6.28);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aB', new THREE.BufferAttribute(aB, 1));
  geo.setAttribute('aP', new THREE.BufferAttribute(aP, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `
      attribute float aB; attribute float aP; uniform float uTime; uniform float uPR; varying float vB;
      void main() {
        vB = aB * (0.75 + 0.25 * sin(uTime * (1.5 + aP) + aP * 7.0)) * smoothstep(0.0, 0.3, normalize(position).y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (1.2 + aB * 1.1) * uPR;
      }`,
    fragmentShader: `
      varying float vB;
      void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(vec3(0.75, 0.83, 1.0) * vB * a, 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -2;
  scene.add(pts);
  return pts;
})();

function makeSkylineTextures() {
  const W = 2048, H = 512;
  const sc = makeCanvas(W, H), g = sc.getContext('2d');
  const lc = makeCanvas(W, H), l = lc.getContext('2d');
  l.fillStyle = '#000000'; l.fillRect(0, 0, W, H);
  const block = (x, bw, bh, shade) => {
    for (const ox of [0, -W, W]) { const X = x + ox; if (X > W || X + bw < 0) continue; g.fillStyle = shade; g.fillRect(X, H - bh, bw, bh); }
  };
  const lite = (x, y, color) => {
    l.fillStyle = color;
    for (const ox of [0, -W, W]) { const X = x + ox; if (X >= 0 && X < W) l.fillRect(X, y, 1, 1); }
  };
  let x = 0;
  while (x < W) {
    const bw = rand(10, 46);
    const t = x / W;
    const cluster = Math.pow(0.5 + 0.5 * Math.cos((t - 0.3) * Math.PI * 4), 3);
    const bh = rand(20, 70) + cluster * rand(60, 330) * (Math.random() < 0.55 ? 1 : 0.45);
    const k = (rand(0, 10)) | 0;
    const shade = `rgb(${9 + k},${14 + k},${30 + k})`;
    block(x, bw, bh, shade);
    const top = H - bh;
    for (let wy = top + 5; wy < H - 6; wy += 4) {
      if (Math.random() < 0.08) continue;
      for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
        if (Math.random() < 0.16) { const r = Math.random(); lite(Math.round(wx), wy, r < 0.5 ? '#ffcf8a' : r < 0.85 ? '#cfe0ff' : '#8fb0ff'); }
      }
    }
    if (bh > 260 && Math.random() < 0.6) block(x + bw / 2 - 1, 2, bh + rand(15, 40), shade);
    if (bh > 220) { l.fillStyle = '#ff3a3a'; l.fillRect(Math.round(x + bw / 2), Math.round(top - 3), 2, 2); }
    x += bw + rand(-4, 3);
  }
  return { sil: toTex(sc, { repeat: true }), lit: toTex(lc, { repeat: true }) };
}
// Game Room: the desert's horizon - mesas and buttes, no lights.
function makeMesaTextures() {
  const W = 2048, H = 512;
  const sc = makeCanvas(W, H), g = sc.getContext('2d');
  const ridge = (x0, w, h, shade) => {
    for (const ox of [0, -W, W]) {
      const X = x0 + ox;
      if (X > W || X + w < 0) continue;
      const slope = w * rand(0.12, 0.22);
      g.fillStyle = shade;
      g.beginPath();
      g.moveTo(X, H);
      g.lineTo(X + slope * rand(0.6, 1), H - h * rand(0.75, 0.9));
      g.lineTo(X + slope, H - h);
      g.lineTo(X + w - slope, H - h + rand(-4, 4));
      g.lineTo(X + w - slope * rand(0.6, 1), H - h * rand(0.7, 0.9));
      g.lineTo(X + w, H);
      g.closePath();
      g.fill();
    }
  };
  // A low far range first, then the mesas in front of it.
  for (let x = 0; x < W; x += rand(60, 160)) ridge(x, rand(120, 320), rand(18, 50), 'rgb(92,60,84)');
  for (let x = 0; x < W; x += rand(140, 420)) ridge(x, rand(60, 260), Math.random() < 0.3 ? rand(110, 190) : rand(40, 100), `rgb(${62 + rand(0, 14) | 0},${36 + rand(0, 8) | 0},${46 + rand(0, 10) | 0})`);
  const lc = makeCanvas(4, 4), l = lc.getContext('2d');
  l.fillStyle = '#000000'; l.fillRect(0, 0, 4, 4);
  return { sil: toTex(sc, { repeat: true }), lit: toTex(lc) };
}
const skylineTex = makeSkylineTextures();
const mesaTex = makeMesaTextures();
mesaTex.sil.wrapT = THREE.ClampToEdgeWrapping;
skylineTex.sil.wrapT = THREE.ClampToEdgeWrapping;
skylineTex.lit.wrapT = THREE.ClampToEdgeWrapping;
const skyline = new THREE.Mesh(
  new THREE.CylinderGeometry(1700, 1700, 380, 96, 1, true),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { tSil: { value: skylineTex.sil }, tLit: { value: skylineTex.lit }, uHaze: { value: FOG_COLOR.clone() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tSil; uniform sampler2D tLit; uniform vec3 uHaze;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x * 3.0, vUv.y);
        vec4 s = texture2D(tSil, uv);
        vec3 lights = texture2D(tLit, uv).rgb;
        float hz = smoothstep(0.5, 0.0, vUv.y);
        vec3 col = mix(s.rgb, uHaze, 0.45 + 0.4 * hz) + lights * (1.6 - 0.7 * hz);
        gl_FragColor = vec4(col, s.a);
      }`,
  }),
);
skyline.position.y = 380 / 2 - 30;
skyline.renderOrder = -1;
skyline.frustumCulled = false;
scene.add(skyline);

// ---------- environment reflections (built once) ----------
// Game Room: built twice - the city at night, and the desert at sunset (a warm sky, no lamps, the sun low ahead).
function buildEnvMap(desert) {
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(60, 64, 32);
  const ep = envGeo.attributes.position;
  const ec = new Float32Array(ep.count * 3);
  const zen = lin(desert ? '#3a3f86' : '#0b1530'), hor = lin(desert ? '#ff9a5a' : '#3d5ea6'), gnd = lin(desert ? '#6a4030' : '#0a0d16');
  const ccol = new THREE.Color();
  for (let i = 0; i < ep.count; i++) {
    const h = ep.getY(i) / 60;
    ccol.copy(hor).lerp(zen, smooth(0, 0.6, h)).lerp(gnd, smooth(0, -0.12, h));
    const band = 1.2 * Math.exp(-Math.abs(h) * 18);
    ec[i * 3] = ccol.r + hor.r * band; ec[i * 3 + 1] = ccol.g + hor.g * band; ec[i * 3 + 2] = ccol.b + hor.b * band;
  }
  envGeo.setAttribute('color', new THREE.BufferAttribute(ec, 3));
  envScene.add(new THREE.Mesh(envGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  if (desert) {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: hdr(3.2, 1.8, 0.8) }));
    sun.position.copy(SUN_DIR).multiplyScalar(52);
    envScene.add(sun);
    const pmremD = new THREE.PMREMGenerator(renderer);
    const rtD = pmremD.fromScene(envScene, 0.03);
    pmremD.dispose();
    return rtD.texture;
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: hdr(2.6, 2.5, 2.4) });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 1.6), lampMat);
    b.position.set(rand(-20, 20), 26, -50 + i * 20);
    b.rotation.y = rand(-0.2, 0.2);
    envScene.add(b);
  }
  const warm = new THREE.MeshBasicMaterial({ color: hdr(1.2, 0.7, 0.3), side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(rand(8, 20), rand(1, 3)), warm);
    b.position.set(Math.sin(a) * 55, rand(1, 5), Math.cos(a) * 55);
    b.lookAt(0, b.position.y, 0);
    envScene.add(b);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  return rt.texture;
}
const envMap = buildEnvMap(false);
const envMapDesert = buildEnvMap(true);

// additive light decals (pools, wet-road reflections) fade to black in the haze instead of to fog colour
const GLOW_VS = BEND_GLSL + `
  varying vec2 vUv; varying float vDepth; varying vec3 vTint;
  void main() {
    vUv = uv;
    vTint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    vec4 w = modelMatrix * p;
    w.xy += nhBendXY(w.z);
    vec4 mv = viewMatrix * w;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const GLOW_FS = `
  uniform sampler2D map; uniform vec3 uColor; uniform float uDensity;
  varying vec2 vUv; varying float vDepth; varying vec3 vTint;
  void main() {
    float fd = vDepth * uDensity;
    gl_FragColor = vec4(texture2D(map, vUv).rgb * uColor * vTint * exp(-fd * fd), 1.0);
  }`;
function makeGlowMaterial(map, color, fogScale) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uColor: { value: color }, uDensity: { value: FOG_DENSITY * (fogScale || 1) }, nhBend: BEND.nhBend, nhHill: BEND.nhHill },
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// ---------- the freeway ----------
const LANES = [-5.4, -1.8, 1.8, 5.4];
const OPP_LANES = [-12.3, -15.9, -19.5, -23.1];
const MEDIAN_X = -8.85;
const RIGHT_X = 8.85;
const OPP_OUTER_X = -26.55;
const OPP_CENTER = -17.7;
const ROAD_LEN = 1400;
const ROAD_NEAR = 60;
let dist = 0;

const hemi = new THREE.HemisphereLight(lin('#86a2e6'), lin('#0d0f18'), 0.8);
const moon = new THREE.DirectionalLight(lin('#9fb6ff'), 0.35);
moon.position.set(-60, 120, 40);
scene.add(hemi, moon);

const roadTex = makeRoadTextures(false);
roadTex.map.repeat.set(1, ROAD_LEN / ROAD_TEX_LEN);
const roadTexDesert = makeRoadTextures(true);
roadTexDesert.map.repeat.set(1, ROAD_LEN / ROAD_TEX_LEN);
const roadMat = new THREE.MeshStandardMaterial({
  color: hdr(1.2, 1.2, 1.3), map: roadTex.map, roughnessMap: roadTex.rough, roughness: 1, metalness: 0,
  emissive: hdr(1, 1, 1), emissiveMap: roadTex.emissive, emissiveIntensity: 1.0, envMap, envMapIntensity: 0.7,
});
const highwayOnly = []; // Game Room: the oncoming road and the barriers - the desert is a single track
for (const cx of [0, OPP_CENTER]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, 140), roadMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0, ROAD_NEAR - ROAD_LEN / 2);
  scene.add(m);
  if (cx !== 0) highwayOnly.push(m);
}
// Game Room: 10 m rows (the original had 100 m), so the desert's hills can't lift it through the road.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 900), new THREE.MeshStandardMaterial({ color: lin('#0b0f18'), roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.15;
scene.add(ground);
const walkMat = new THREE.MeshStandardMaterial({ color: lin('#1c212c'), roughness: 0.95, metalness: 0, envMap, envMapIntensity: 0.3 });
const walks = []; // Game Room: the city's sidewalks, which the desert doesn't have
for (const [cx, w] of [[11.45, 4.6], [-28.75, 3.8]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROAD_LEN, 1, 140), walkMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0.03, ROAD_NEAR - ROAD_LEN / 2);
  scene.add(m);
  walks.push(m);
}

const barTex = makeBarrierTextures();
barTex.map.repeat.set(1, 1 / 6);
const barMat = new THREE.MeshStandardMaterial({
  color: hdr(1.2, 1.2, 1.28), map: barTex.map, emissive: hdr(1, 1, 1), emissiveMap: barTex.emissive, emissiveIntensity: 1.1,
  roughness: 0.92, metalness: 0, envMap, envMapIntensity: 0.35,
});
const barProfile = new THREE.Shape([[-0.305, 0], [0.305, 0], [0.305, 0.075], [0.175, 0.33], [0.075, 0.81], [-0.075, 0.81], [-0.175, 0.33], [-0.305, 0.075]].map((p) => new THREE.Vector2(p[0], p[1])));
const barGeo = new THREE.ExtrudeGeometry(barProfile, { depth: ROAD_LEN, bevelEnabled: false, steps: 140 });
barGeo.translate(0, 0, ROAD_NEAR - ROAD_LEN);
for (const x of [MEDIAN_X, RIGHT_X, OPP_OUTER_X]) {
  const m = new THREE.Mesh(barGeo, barMat);
  m.position.x = x;
  scene.add(m);
  highwayOnly.push(m);
}

// ---------- city blocks: one instanced draw, windows generated in the shader ----------
const BLD_L = 1700;
const BLD_NEAR = 90;
const blds = [];
function rollBuilding(b) {
  if (b.row === 0) {
    b.w = rand(10, 26);
    b.h = Math.random() < 0.14 ? rand(55, 120) : rand(8, 38);
    b.x = b.side * ((b.side > 0 ? 21 : 37) + b.w / 2 + rand(0, 12));
  } else {
    b.w = rand(22, 52);
    b.h = Math.random() < 0.35 ? rand(120, 270) : rand(35, 115);
    b.x = b.side * ((b.side > 0 ? 60 : 78) + b.w / 2 + rand(0, 90));
  }
  b.seed = Math.random();
}
for (const side of [1, -1]) {
  for (const row of [0, 1]) {
    let cur = rand(0, 20);
    while (cur < BLD_L - 12) {
      const depth = row === 0 ? rand(14, 34) : rand(24, 60);
      const b = { side, row, depth, base: cur + depth / 2, z: null };
      rollBuilding(b);
      blds.push(b);
      cur += depth + (row === 0 ? rand(2, 10) : rand(6, 30));
    }
  }
}
const bGeo = new THREE.BoxGeometry(1, 1, 1);
bGeo.translate(0, 0.5, 0);
const bSeeds = new THREE.InstancedBufferAttribute(new Float32Array(blds.length), 1);
bGeo.setAttribute('aSeed', bSeeds);
const bMat = new THREE.ShaderMaterial({
  uniforms: { uFogColor: { value: FOG_COLOR }, uFogDensity: { value: FOG_DENSITY }, nhBend: BEND.nhBend, nhHill: BEND.nhHill },
  extensions: { derivatives: true },
  vertexShader: BEND_GLSL + `
    attribute float aSeed;
    varying vec3 vLocal; varying vec3 vN; varying float vSeed; varying vec3 vSize; varying float vDepth;
    void main() {
      vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vSize = size;
      vLocal = vec3((position.x + 0.5) * size.x, position.y * size.y, (position.z + 0.5) * size.z);
      vN = normal;
      vSeed = aSeed;
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      w.xy += nhBendXY(w.z);
      vec4 mv = viewMatrix * w;
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uFogColor; uniform float uFogDensity;
    varying vec3 vLocal; varying vec3 vN; varying float vSeed; varying vec3 vSize; varying float vDepth;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec3 col;
      float glowAmt = 0.0;
      if (vN.y > 0.5) {
        col = vec3(0.006, 0.008, 0.014);
      } else {
        vec2 fc; float face;
        if (abs(vN.x) > 0.5) { fc = vec2(vLocal.z, vLocal.y); face = vN.x > 0.0 ? 1.0 : 2.0; }
        else { fc = vec2(vLocal.x, vLocal.y); face = vN.z > 0.0 ? 3.0 : 4.0; }
        float style = fract(vSeed * 7.31);
        vec2 sp = style < 0.4 ? vec2(3.1, 3.5) : (style < 0.75 ? vec2(2.2, 3.2) : vec2(4.2, 3.8));
        vec2 ws = style < 0.4 ? vec2(0.58, 0.52) : (style < 0.75 ? vec2(0.78, 0.46) : vec2(0.86, 0.66));
        vec2 g = fc / sp;
        vec2 cell = floor(g);
        vec2 f = fract(g) - 0.5;
        vec2 fw = max(fwidth(g), vec2(0.001));
        vec2 edge = 0.5 * ws;
        vec2 m = smoothstep(edge + fw, edge - fw, abs(f));
        float win = m.x * m.y;
        float blur = clamp(max(fw.x, fw.y) * 2.2 - 0.35, 0.0, 1.0);
        win = mix(win, ws.x * ws.y, blur);
        float h = hash(cell + vec2(vSeed * 91.7, face * 13.3));
        float litP = mix(0.06, 0.24, fract(vSeed * 3.71));
        float lit = step(1.0 - litP, h);
        float fh = hash(vec2(cell.y * 1.37, vSeed * 57.0 + face));
        lit = max(lit, step(0.92, fh) * step(0.25, h));
        float floorOK = step(1.0, cell.y) * step(fc.y + sp.y * 0.6, vSize.y);
        lit = mix(lit * floorOK, litP * 0.85, blur);
        float hc = hash(cell.yx + vSeed * 3.3);
        vec3 wc = hc < 0.45 ? vec3(1.0, 0.70, 0.40) : (hc < 0.85 ? vec3(0.66, 0.80, 1.0) : vec3(0.45, 0.55, 1.0));
        float inten = mix(0.45, 1.25, hash(cell * 1.7 + vSeed));
        vec3 facade = vec3(0.010, 0.013, 0.022) * (0.75 + 0.5 * fract(vSeed * 13.1));
        vec3 glass = vec3(0.016, 0.026, 0.050) + vec3(0.02, 0.035, 0.07) * clamp(fc.y / max(vSize.y, 1.0), 0.0, 1.0);
        col = mix(facade, glass, win * floorOK);
        col += win * lit * wc * inten;
        glowAmt = win * lit;
        float accentOn = step(0.82, fract(vSeed * 5.37)) * step(30.0, vSize.y);
        float band = smoothstep(vSize.y - 1.2, vSize.y - 0.9, vLocal.y) * (1.0 - smoothstep(vSize.y - 0.5, vSize.y - 0.3, vLocal.y));
        vec3 accent = fract(vSeed * 11.0) < 0.5 ? vec3(0.25, 0.85, 1.6) : vec3(1.5, 0.3, 0.75);
        col += band * accentOn * accent * 1.0;
        glowAmt = max(glowAmt, band * accentOn);
        col += vec3(0.30, 0.20, 0.12) * exp(-vLocal.y * 0.28) * 0.18;
      }
      float fd = vDepth * uFogDensity;
      float fogF = 1.0 - exp(-fd * fd);
      col = mix(col, uFogColor, fogF * (1.0 - 0.4 * clamp(glowAmt, 0.0, 1.0)));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const bMesh = new THREE.InstancedMesh(bGeo, bMat, blds.length);
bMesh.frustumCulled = false;
bMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(bMesh);
const bArr = bMesh.instanceMatrix.array;
function writeBuilding(i, b) {
  const o = i * 16;
  bArr.fill(0, o, o + 16);
  bArr[o] = b.w; bArr[o + 5] = b.h; bArr[o + 10] = b.depth;
  bArr[o + 12] = b.x; bArr[o + 14] = b.z || 0; bArr[o + 15] = 1;
  bSeeds.array[i] = b.seed;
}
blds.forEach((b, i) => writeBuilding(i, b));
function updateBuildings() {
  let seedsDirty = false;
  for (let i = 0; i < blds.length; i++) {
    const b = blds[i];
    const z = BLD_NEAR - mod(b.base - dist, BLD_L);
    if (b.z !== null && z < b.z - BLD_L * 0.5) {
      rollBuilding(b);
      b.z = z;
      writeBuilding(i, b);
      seedsDirty = true;
    } else {
      b.z = z;
      bArr[i * 16 + 14] = z;
    }
  }
  bMesh.instanceMatrix.needsUpdate = true;
  if (seedsDirty) bSeeds.needsUpdate = true;
}

// ---------- shared materials for structures ----------
const metalMat = new THREE.MeshStandardMaterial({ color: lin('#2a2f39'), roughness: 0.55, metalness: 0.7, envMap, envMapIntensity: 0.6 });
const concreteMat = new THREE.MeshStandardMaterial({ color: lin('#4a5161'), roughness: 0.92, metalness: 0, envMap, envMapIntensity: 0.25 });
const fasciaMat = new THREE.MeshStandardMaterial({ color: lin('#6d7586'), roughness: 0.85, metalness: 0, envMap, envMapIntensity: 0.3 });
const shellMat = new THREE.MeshStandardMaterial({ color: lin('#15181f'), roughness: 0.4, metalness: 0.6, envMap, envMapIntensity: 0.8 });
const LAMP_COOL = hdr(2.3, 2.45, 2.9);
const matCool = new THREE.MeshBasicMaterial({ color: LAMP_COOL });
const matWarm = new THREE.MeshBasicMaterial({ color: hdr(2.5, 1.45, 0.6) });
const matRed = new THREE.MeshBasicMaterial({ color: hdr(2.6, 0.06, 0.09) });
const glowCool = makeGlowMaterial(texPool, lin('#a9bfff').multiplyScalar(0.18));
const glowWarm = makeGlowMaterial(texPool, lin('#ffb36b').multiplyScalar(0.24));

function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const a = m.instanceMatrix.array;
  for (let i = 0; i < count; i++) { const o = i * 16; a.fill(0, o, o + 16); a[o] = 1; a[o + 5] = 1; a[o + 10] = 1; a[o + 15] = 1; }
  scene.add(m);
  return m;
}

// median lamps: tall double-arm poles every 45 m
const LAMP_SP = 45, LAMP_N = 32, LAMP_L = LAMP_SP * LAMP_N, LAMP_NEAR = 45;
const LAMP_Y = 11.8, LAMP_ARM = 6.0;
const LAMP_OUR_X = MEDIAN_X + LAMP_ARM - 0.2;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept from the original
const LAMP_OPP_X = MEDIAN_X - LAMP_ARM + 0.2;
const lampPoles = instanced(mergeGeometries([
  cylAt(0.12, 0.17, 11.2, 8, 0, 0.81 + 5.6, 0),
  boxAt(LAMP_ARM + 0.2, 0.12, 0.14, LAMP_ARM / 2, LAMP_Y + 0.12, 0),
  boxAt(LAMP_ARM + 0.2, 0.12, 0.14, -LAMP_ARM / 2, LAMP_Y + 0.12, 0),
]), metalMat, LAMP_N);
const lampHeads = instanced(mergeGeometries([
  boxAt(1.1, 0.16, 0.45, LAMP_ARM - 0.2, LAMP_Y, 0),
  boxAt(1.1, 0.16, 0.45, -LAMP_ARM + 0.2, LAMP_Y, 0),
]), matCool, LAMP_N);
const lampPools = instanced(mergeGeometries([
  flatPlane(13, 18, LAMP_ARM - 0.2, 0.05, 0),
  flatPlane(13, 18, -LAMP_ARM + 0.2, 0.05, 0),
]), glowCool, LAMP_N);
const lampZ = new Float32Array(LAMP_N);
for (const m of [lampPoles, lampHeads, lampPools]) { const a = m.instanceMatrix.array; for (let i = 0; i < LAMP_N; i++) a[i * 16 + 12] = MEDIAN_X; }

// sodium street lamps along the frontage roads
const SL_SP = 32, SL_N = 45, SL_L = SL_SP * SL_N, SL_NEAR = 45;
const slPosts = instanced(mergeGeometries([cylAt(0.07, 0.1, 6.6, 6, 0, 3.3, 0), boxAt(1.5, 0.08, 0.1, -0.75, 6.55, 0)]), metalMat, SL_N * 2);
const slHeads = instanced(boxAt(0.6, 0.12, 0.26, -1.35, 6.48, 0), matWarm, SL_N * 2);
const slPools = instanced(flatPlane(9, 12, -1.6, 0.08, 0), glowWarm, SL_N * 2);
for (const m of [slPosts, slHeads, slPools]) {
  const a = m.instanceMatrix.array;
  for (let i = 0; i < SL_N * 2; i++) {
    const o = i * 16;
    if (i >= SL_N) { a[o] = -1; a[o + 10] = -1; a[o + 12] = -28.2; } else { a[o + 12] = 11.0; }
  }
}

// ---------- props that recycle along the road: overpasses, sign gantries, billboards ----------
const props = [];
function addProp(obj, base, L, near, update) { props.push({ obj, base, L, near, update }); scene.add(obj); }

function makeOverpass() {
  const grp = new THREE.Group();
  const deckY = 8.2, deckH = 1.5, deckD = 13, span = 170, cx = -12;
  const top = deckY + deckH / 2;
  const concrete = [
    boxAt(span, deckH, deckD, cx, deckY, 0),
    boxAt(span, 1.0, 0.35, cx, top + 0.5, deckD / 2 - 0.18),
    boxAt(span, 1.0, 0.35, cx, top + 0.5, -deckD / 2 + 0.18),
  ];
  for (const px of [MEDIAN_X, 11.6, -28.8, 34, -58]) concrete.push(boxAt(1.3, deckY - deckH / 2, 3.4, px, (deckY - deckH / 2) / 2, 0));
  grp.add(new THREE.Mesh(mergeGeometries(concrete), concreteMat));
  grp.add(new THREE.Mesh(boxAt(span, 0.45, 0.1, cx, deckY + 0.22, deckD / 2 + 0.05), fasciaMat));
  const under = [];
  for (let x = -27; x <= 9; x += 9) for (const z of [deckD / 2 - 1.2, -deckD / 2 + 1.2]) under.push(boxAt(1.2, 0.08, 0.3, x, deckY - deckH / 2 - 0.05, z));
  grp.add(new THREE.Mesh(mergeGeometries(under), matCool));
  const fascia = [];
  for (let x = cx - span / 2 + 4; x <= cx + span / 2 - 4; x += 7.2) fascia.push(boxAt(0.32, 0.12, 0.08, x, deckY - 0.32, deckD / 2 + 0.1));
  grp.add(new THREE.Mesh(mergeGeometries(fascia), matWarm));
  const posts = [], heads = [];
  for (const x of [-52, -30, -8, 14, 36]) {
    posts.push(cylAt(0.09, 0.12, 5.2, 6, x, top + 2.6, deckD / 2 - 0.3));
    posts.push(boxAt(1.6, 0.08, 0.1, x - 0.8, top + 5.2, deckD / 2 - 0.3));
    heads.push(boxAt(0.7, 0.12, 0.3, x - 1.5, top + 5.12, deckD / 2 - 0.3));
  }
  grp.add(new THREE.Mesh(mergeGeometries(posts), metalMat));
  grp.add(new THREE.Mesh(mergeGeometries(heads), matCool));
  grp.add(new THREE.Mesh(flatPlane(30, 12, -9, 0.06, 0), glowCool));
  const cars = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Group();
    const y = top + 0.75;
    c.add(new THREE.Mesh(boxAt(4.4, 1.2, 1.8, 0, y, 0), shellMat));
    c.add(new THREE.Mesh(mergeGeometries([boxAt(0.06, 0.12, 0.34, 2.23, y - 0.1, 0.55), boxAt(0.06, 0.12, 0.34, 2.23, y - 0.1, -0.55)]), matCool));
    c.add(new THREE.Mesh(mergeGeometries([boxAt(0.06, 0.12, 0.34, -2.23, y - 0.05, 0.55), boxAt(0.06, 0.12, 0.34, -2.23, y - 0.05, -0.55)]), matRed));
    const dir = i % 2 === 0 ? 1 : -1;
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    c.position.set(rand(-85, 60), 0, dir > 0 ? -2.8 : 2.8);
    c.userData.dir = dir;
    c.userData.v = rand(14, 22);
    grp.add(c);
    cars.push(c);
  }
  grp.userData.cars = cars;
  return grp;
}
function updateOverpass(dt, grp) {
  for (const c of grp.userData.cars) {
    c.position.x += c.userData.dir * c.userData.v * dt;
    if (c.position.x > 66) c.position.x = -90;
    else if (c.position.x < -90) c.position.x = 66;
  }
}

function makeGantry() {
  const grp = new THREE.Group();
  const signMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, emissive: hdr(1, 1, 1), emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0 });
  const parts = [
    boxAt(0.45, 8.6, 0.45, MEDIAN_X, 5.1, 0),
    boxAt(0.45, 9.4, 0.45, 10.3, 4.7, 0),
    boxAt(19.6, 0.32, 0.32, 0.72, 8.3, -0.35),
    boxAt(19.6, 0.32, 0.32, 0.72, 8.3, 0.35),
    boxAt(19.6, 0.32, 0.32, 0.72, 6.0, -0.35),
  ];
  for (let x = -8.4; x <= 9.8; x += 1.4) parts.push(boxAt(0.08, 2.3, 0.08, x, 7.15, -0.35));
  parts.push(boxAt(7.4, 3.2, 0.12, -3.0, 7.4, 0.55), boxAt(6.0, 3.2, 0.12, 4.6, 7.4, 0.55));
  grp.add(new THREE.Mesh(mergeGeometries(parts), metalMat));
  const a = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.2), signMat(texSignA));
  a.position.set(-3.0, 7.4, 0.62);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.2), signMat(texSignB));
  b.position.set(4.6, 7.4, 0.62);
  grp.add(a, b);
  const fixtures = [];
  for (const x of [-5.6, -3.0, -0.4, 2.6, 6.6]) fixtures.push(boxAt(0.5, 0.1, 0.25, x, 5.65, 0.9));
  grp.add(new THREE.Mesh(mergeGeometries(fixtures), matWarm));
  return grp;
}

function makeBillboard(tex, side) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(mergeGeometries([
    cylAt(0.35, 0.45, 11.5, 10, 0, 5.75, 0),
    boxAt(10.8, 4.3, 0.4, 0, 13.4, -0.1),
    boxAt(10.8, 0.12, 0.9, 0, 11.2, 0.3),
  ]), metalMat));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 3.82), new THREE.MeshBasicMaterial({ map: tex, color: hdr(2.3, 2.3, 2.3) }));
  panel.position.set(0, 13.4, 0.12);
  grp.add(panel);
  const lights = [];
  for (const x of [-4, -1.3, 1.3, 4]) lights.push(boxAt(0.4, 0.1, 0.2, x, 11.3, 0.6));
  grp.add(new THREE.Mesh(mergeGeometries(lights), matCool));
  grp.rotation.y = side > 0 ? -0.42 : 0.42;
  grp.position.x = side > 0 ? 12.4 : -30.6;
  return grp;
}

for (let i = 0; i < 3; i++) addProp(makeOverpass(), 180 + i * 480, 1440, 70, updateOverpass);
addProp(makeGantry(), 420, 1440, 70);
addProp(makeGantry(), 900, 1440, 70);
addProp(makeBillboard(texBoards[0], 1), 330, 1440, 70);
addProp(makeBillboard(texBoards[1], 1), 1010, 1440, 70);
addProp(makeBillboard(texBoards[2], -1), 700, 1440, 70);


// ---------- Game Room: the desert circuit ----------
// Sand, dunes, mesas, cacti, rocks and telephone poles in place of the city,
// at sunset. Built once beside the city; setCircuit() swaps them, along with
// the sky, fog, light, grade, reflections and road. The hills are drawn by
// the shaders (see BEND), so everything here rides them for free.
const desertObjs = [];
const _dm4 = new THREE.Matrix4();
const _dq = new THREE.Quaternion();
const _dp = new THREE.Vector3();
const _ds = new THREE.Vector3();
const _dy = new THREE.Vector3(0, 1, 0);
const _dc = new THREE.Color();
const pickOne = (arr) => arr[(Math.random() * arr.length) | 0];
function sandTexture() {
  const W = 256, c = makeCanvas(W, W), g = c.getContext('2d');
  g.fillStyle = '#c99a6a'; g.fillRect(0, 0, W, W);
  // Wind ripples, and some darker grit.
  for (let y = 0; y < W; y += 3) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,80,52' : '236,200,156'},${rand(0.04, 0.12).toFixed(3)})`;
    g.fillRect(0, y, W, rand(1, 2.5));
  }
  const img = g.getImageData(0, 0, W, W), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const nz = (Math.random() - 0.5) * 22; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz; }
  g.putImageData(img, 0, 0);
  return toTex(c, { repeat: true, aniso: true });
}
const SAND_TILE = 60;
const SAND_LEN = 1700;
const sandTex = sandTexture();
sandTex.repeat.set(1600 / SAND_TILE, SAND_LEN / SAND_TILE);
const sandMat = new THREE.MeshStandardMaterial({ color: hdr(1.05, 0.95, 0.88), map: sandTex, roughness: 1, metalness: 0 });
const sand = new THREE.Mesh(new THREE.PlaneGeometry(1600, SAND_LEN, 1, 170), sandMat);
sand.rotation.x = -Math.PI / 2;
sand.position.set(0, -0.06, ROAD_NEAR - SAND_LEN / 2);
scene.add(sand);
desertObjs.push(sand);
// Things scattered along the road, recycled like the city's buildings: each
// re-rolls (`roll`) when it wraps from behind the car to the far end.
function scatter(geo, mat, count, L, near, roll) {
  const mesh = instanced(geo, mat, count);
  const items = [];
  const write = (i, it) => {
    _dq.setFromAxisAngle(_dy, it.rot || 0);
    _dm4.compose(_dp.set(it.x, it.y || 0, it.z || 0), _dq, _ds.set(it.sx, it.sy, it.sz));
    _dm4.toArray(mesh.instanceMatrix.array, i * 16);
    mesh.setColorAt(i, _dc.copy(it.color));
  };
  for (let i = 0; i < count; i++) {
    const it = { base: rand(0, L), z: null, color: new THREE.Color() };
    roll(it);
    items.push(it);
    write(i, it);
  }
  mesh.instanceColor.needsUpdate = true;
  desertObjs.push(mesh);
  return () => {
    const a = mesh.instanceMatrix.array;
    let colors = false;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      const z = near - mod(it.base - dist, L);
      const wrapped = it.z !== null && z < it.z - L * 0.5;
      it.z = z;
      if (wrapped) { roll(it); write(i, it); colors = true; }
      a[i * 16 + 14] = z;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colors) mesh.instanceColor.needsUpdate = true;
  };
}
const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true, envMap: envMapDesert, envMapIntensity: 0.2 });
// Either side of both carriageways, `near` to `far` from our road's centre on
// the right, or as far beyond the oncoming one on the left (mirrored about
// the median), keeping a thing of radius `r` clear of the road.
// A single track now: either side of it, mirrored, keeping a thing of radius `r` clear of the road.
const offRoad = (near, far, r) => { const x = rand(near, far) + r; return Math.random() < 0.5 ? x : -x; };
const DESERT_L = 1600;

// The canyon: a wall on each side, rebuilt every frame from the world
// distance, so it winds in and out and rises and falls as you drive. Rows
// are 10 m apart so the walls follow the hills. A picture only: nothing
// here touches the game.
function strataTexture() {
  const W = 128, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  const bands = ['#8a3f28', '#a14b2c', '#b8603a', '#7a3424', '#c47a4a', '#9a4a30', '#6e2f22', '#b35c36', '#d08a58', '#8e4229'];
  let y = 0;
  while (y < H) {
    const h = rand(6, 40);
    g.fillStyle = pickOne(bands);
    g.fillRect(0, y, W, h + 1);
    y += h;
  }
  // Thin ledges, and dark streaks of desert varnish down the cliffs.
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(50,22,14,${rand(0.15, 0.4).toFixed(2)})`; g.fillRect(0, rand(0, H), W, rand(1, 3)); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,18,12,${rand(0.08, 0.22).toFixed(2)})`; g.fillRect(rand(0, W), rand(0, H), rand(1, 4), rand(30, 160)); }
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const nz = (Math.random() - 0.5) * 26; d[i] += nz; d[i + 1] += nz; d[i + 2] += nz; }
  g.putImageData(img, 0, 0);
  return toTex(c, { repeat: true, aniso: true });
}
const strataTex = strataTexture();
const wallMat = new THREE.MeshStandardMaterial({ color: hdr(0.85, 0.78, 0.74), map: strataTex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
const WALL_ROWS = 171, WALL_STEP = 10;
// The wall's cross-section from its foot outward: [metres out, share of its height] - a talus slope, the cliff, the rim, the plateau.
const WALL_PROFILE = [[0, 0], [6, 0.04], [10, 0.13], [11, 0.3], [11.5, 0.72], [12.4, 0.95], [15, 1], [80, 1.04]];
const WP = WALL_PROFILE.length;
// Smooth value noise in 0..1 along the road (a picture only, so Math.sin is fine here).
function wallNoise(s, scale, seed) {
  const f = s / scale, i = Math.floor(f), t = f - i, u = t * t * (3 - 2 * t);
  const h = (n) => { const x = Math.sin((n + seed) * 127.1) * 43758.5453; return x - Math.floor(x); };
  return h(i) + (h(i + 1) - h(i)) * u;
}
function canyonWall(side) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WALL_ROWS * WP * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(WALL_ROWS * WP * 2), 2));
  const idx = [];
  for (let r = 0; r < WALL_ROWS - 1; r++) {
    for (let k = 0; k < WP - 1; k++) {
      const a = r * WP + k, b = a + WP;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  desertObjs.push(mesh);
  return { geo, side, seed: side > 0 ? 0 : 57 };
}
const canyonWalls = [canyonWall(1), canyonWall(-1)];
function updateWall(w) {
  const pos = w.geo.attributes.position.array, uv = w.geo.attributes.uv.array;
  for (let r = 0; r < WALL_ROWS; r++) {
    const z = ROAD_NEAR - r * WALL_STEP;
    const s = dist - z; // this row's distance down the road
    const foot = 20 + 16 * wallNoise(s, 170, w.seed) + 5 * wallNoise(s, 45, w.seed + 9);
    // Blocky: the rim steps up and down every few rows, like buttresses along the cliff.
    const height = (25 + 65 * wallNoise(s, 260, w.seed + 3)) * (0.82 + 0.3 * wallNoise(s, 22, w.seed + 5));
    for (let k = 0; k < WP; k++) {
      const [dx, dy] = WALL_PROFILE[k];
      const y = dy * height;
      const o = (r * WP + k) * 3;
      pos[o] = w.side * (foot + dx * (0.8 + 0.4 * wallNoise(s, 90, w.seed + k)));
      pos[o + 1] = y;
      pos[o + 2] = z;
      uv[(r * WP + k) * 2] = s / 40;
      uv[(r * WP + k) * 2 + 1] = y / 38;
    }
  }
  w.geo.attributes.position.needsUpdate = true;
  w.geo.attributes.uv.needsUpdate = true;
  w.geo.computeVertexNormals();
}

// The road's edges wander, like a dirt track's: sand drifts in over the outer
// lanes in tongues, and behind it a low bank of sand and rock (where the city
// had barriers) bulges in and out. Both are strips rebuilt every frame from the
// road position, like the canyon walls. A picture only: the car still stops at
// the same place (LIM) and scrapes along the bank.
function bermTexture() {
  const W = 128, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#b08458'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.6 ? `rgba(84,52,34,${rand(0.2, 0.5).toFixed(2)})` : `rgba(226,186,140,${rand(0.2, 0.5).toFixed(2)})`;
    g.beginPath(); g.ellipse(rand(0, W), rand(0, H), rand(1, 5), rand(1, 4), 0, 0, Math.PI * 2); g.fill();
  }
  return toTex(c, { repeat: true, aniso: true });
}
const bermMat = new THREE.MeshStandardMaterial({ color: hdr(1, 0.92, 0.85), map: bermTexture(), roughness: 1, metalness: 0, side: THREE.DoubleSide });
const spillMat = new THREE.MeshStandardMaterial({ color: hdr(1.08, 0.98, 0.9), map: sandTexture(), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
// A strip of `rows` cross-sections, `cols` points each, 5 m apart; its positions and uvs are rewritten every frame.
const EDGE_ROWS = 341, EDGE_STEP = 5;
function stripMesh(rows, cols, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rows * cols * 2), 2));
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let k = 0; k < cols - 1; k++) {
      const a = r * cols + k, b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  desertObjs.push(mesh);
  return geo;
}
// How far sand has drifted in over the road's edge here (m, from the edge toward the middle).
const sandSpill = (s, seed) => clamp(2.2 * wallNoise(s, 55, seed) - 0.55, 0, 1.7) + 0.3 * wallNoise(s, 9, seed + 2);
const edges = [1, -1].map((side) => ({ side, seed: side > 0 ? 11 : 23, spill: stripMesh(EDGE_ROWS, 3, spillMat), berm: stripMesh(EDGE_ROWS, 6, bermMat) }));
// The bank's cross-section: [metres out from its foot, share of its height].
const BERM_PROFILE = [[0, 0], [0.5, 0.45], [1.1, 0.95], [2.0, 1], [3.0, 0.45], [3.9, 0]];
function updateEdge(e) {
  const sp = e.spill.attributes.position.array, su = e.spill.attributes.uv.array;
  const bp = e.berm.attributes.position.array, bu = e.berm.attributes.uv.array;
  for (let r = 0; r < EDGE_ROWS; r++) {
    const z = ROAD_NEAR - r * EDGE_STEP;
    const s = dist - z;
    const foot = 8.75 + 0.9 * wallNoise(s, 30, e.seed + 4); // never inside where the car stops
    const height = 0.45 + 0.6 * wallNoise(s, 18, e.seed + 6);
    const inner = 8.5 - sandSpill(s, e.seed);
    const xs = [inner, foot, foot + 0.6];
    const ys = [0.015, 0.03, 0.12];
    for (let k = 0; k < 3; k++) {
      const o = r * 3 + k;
      sp[o * 3] = e.side * xs[k]; sp[o * 3 + 1] = ys[k]; sp[o * 3 + 2] = z;
      su[o * 2] = xs[k] / SAND_TILE; su[o * 2 + 1] = s / SAND_TILE;
    }
    for (let k = 0; k < BERM_PROFILE.length; k++) {
      const o = r * BERM_PROFILE.length + k;
      bp[o * 3] = e.side * (foot + BERM_PROFILE[k][0]); bp[o * 3 + 1] = BERM_PROFILE[k][1] * height; bp[o * 3 + 2] = z;
      bu[o * 2] = BERM_PROFILE[k][0] / 4; bu[o * 2 + 1] = s / 8;
    }
  }
  for (const g of [e.spill, e.berm]) { g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; }
  e.spill.computeVertexNormals();
  e.berm.computeVertexNormals();
}

const desertUpdaters = [
  // Loose stones on the track itself (you drive straight over them).
  scatter(new THREE.DodecahedronGeometry(1, 0), rockMat, 220, 500, 40, (it) => {
    const k = rand(0.05, 0.2);
    it.x = rand(-8.2, 8.2); it.sx = k * rand(1, 1.6); it.sy = k * rand(0.4, 0.7); it.sz = k * rand(1, 1.6); it.rot = rand(0, 6.3);
    it.color.copy(lin(pickOne(['#7a5a44', '#a0805e', '#5e4434', '#b89470'])));
  }),
  // Boulders: small ones on the berms, big ones out on the canyon floor.
  scatter(new THREE.DodecahedronGeometry(1, 0), rockMat, 90, DESERT_L, 60, (it) => {
    const big = Math.random() < 0.35;
    const k = big ? rand(1.6, 4.2) : rand(0.25, 0.9);
    it.sx = k * rand(0.8, 1.5); it.sy = k * rand(0.5, 0.9); it.sz = k * rand(0.8, 1.4); it.rot = rand(0, 6.3);
    it.x = big ? offRoad(12, 22, it.sx) : offRoad(9.6, 11.5, 0);
    it.y = big ? 0 : 0.45;
    it.color.copy(lin(pickOne(['#a0583a', '#b8693f', '#8c4a32', '#c47a4a'])));
  }),
  // Scrub: low dry bushes on the canyon floor.
  scatter(new THREE.IcosahedronGeometry(1, 0).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true }), 60, DESERT_L, 60, (it) => {
    const k = rand(0.4, 1.1);
    it.x = offRoad(11.5, 24, k); it.sx = k * rand(1, 1.6); it.sy = k * rand(0.6, 0.9); it.sz = k * rand(1, 1.6); it.rot = rand(0, 6.3);
    it.color.copy(lin(pickOne(['#6b6a3a', '#7d7444', '#5a5a34', '#8a7a4a'])));
  }),
  // A few saguaros.
  scatter(mergeGeometries([
    cylAt(0.3, 0.34, 5, 9, 0, 2.5, 0), new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 5, 0),
    boxAt(0.7, 0.36, 0.36, 0.38, 1.7, 0), cylAt(0.2, 0.22, 1.6, 8, 0.72, 2.5, 0),
    boxAt(0.6, 0.32, 0.32, -0.34, 2.4, 0), cylAt(0.18, 0.2, 1.3, 8, -0.62, 3.0, 0),
  ]), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, envMap: envMapDesert, envMapIntensity: 0.3 }), 16, DESERT_L, 60, (it) => {
    const k = rand(0.7, 1.3);
    it.x = offRoad(12, 20, 1.2 * k);
    it.sx = k * (Math.random() < 0.5 ? -1 : 1); it.sy = k; it.sz = k; it.rot = rand(0, 6.3);
    it.color.copy(lin(pickOne(['#3f5a35', '#4a6a3c', '#36502f'])));
  }),
];
function updateDesert() {
  sandTex.offset.y = (dist / SAND_TILE) % 1;
  roadTexDesert.map.offset.y = (dist / ROAD_TEX_LEN) % 1;
  for (const w of canyonWalls) updateWall(w);
  for (const e of edges) updateEdge(e);
  for (const u of desertUpdaters) u();
}

// The two circuits' looks, applied all at once when the shown switch changes.
const CIRCUITS = {
  city: {
    sky: SKY, sun: 0, fog: FOG_COLOR.clone(), fogDensity: FOG_DENSITY,
    hemi: ['#86a2e6', '#0d0f18', 0.8], light: ['#9fb6ff', 0.35, [-60, 120, 40]], ground: '#0b0f18',
    tint: [0.9, 0.98, 1.14], tintAmt: 0.55, lift: [0.004, 0.007, 0.016], flareTint: [0.45, 0.65, 1.25], exposure: 1,
    env: envMap, skyline: skylineTex, road: roadTex, roadColor: hdr(1.2, 1.2, 1.3), roadGlow: 1.0, barrier: hdr(1.2, 1.2, 1.28), barrierGlow: 1.1,
  },
  desert: {
    sky: { zenith: lin('#1c2250'), mid: lin('#6e3a74'), horizon: lin('#ff8746'), glow: lin('#ffad55') }, sun: 1,
    fog: lin('#d0805e'), fogDensity: 0.0013,
    hemi: ['#ffb791', '#4a2c22', 1.2], light: ['#ffb070', 1.4, [SUN_DIR.x * 300, 40, SUN_DIR.z * 300]], ground: '#9c6440',
    tint: [1.05, 0.94, 1.06], tintAmt: 0.35, lift: [0.012, 0.006, 0.01], flareTint: [1.25, 0.7, 0.45], exposure: 1.05,
    env: envMapDesert, skyline: mesaTex, road: roadTexDesert, roadColor: hdr(1.1, 1.0, 0.92), roadGlow: 0, barrier: hdr(1.55, 1.32, 1.12), barrierGlow: 0.3,
  },
};
const cityObjs = [bMesh, lampPoles, lampHeads, lampPools, slPosts, slHeads, slPools, stars, ...walks, ...highwayOnly, ...props.map((p) => p.obj)];
let circuit = null;
let circuitFog = FOG_DENSITY;
let circuitExposure = 1;
function setCircuit(name) {
  if (name === circuit) return;
  circuit = name;
  const c = CIRCUITS[name];
  const desert = name === 'desert';
  for (const o of cityObjs) o.visible = !desert;
  root.classList.toggle('nh-desert', desert); // the screens and HUD need more contrast over a bright sky
  for (const o of desertObjs) o.visible = desert;
  // The desert's off-road truck in place of the car, for the player and the ghost.
  showVehicle(chassis, desert);
  showVehicle(ghostChassis, desert);
  const lamps = LAMPS[desert ? 'offroad' : 'car'];
  headSpot.position.set(...lamps.head);
  tailGlow.position.set(...lamps.tail);
  const su = skyMat.uniforms;
  su.uZenith.value.copy(c.sky.zenith); su.uMid.value.copy(c.sky.mid); su.uHorizon.value.copy(c.sky.horizon); su.uGlow.value.copy(c.sky.glow);
  su.uSun.value = c.sun;
  su.uSunDir.value.copy(SUN_DIR);
  su.uSunCol.value.setRGB(1.6, 0.85, 0.4);
  scene.fog.color.copy(c.fog);
  circuitFog = c.fogDensity;
  scene.fog.density = circuitFog;
  hemi.color.copy(lin(c.hemi[0])); hemi.groundColor.copy(lin(c.hemi[1])); hemi.intensity = c.hemi[2];
  moon.color.copy(lin(c.light[0])); moon.intensity = c.light[1]; moon.position.set(...c.light[2]);
  ground.material.color.copy(lin(c.ground));
  const cu = compositeMat.uniforms;
  cu.uTint.value.set(...c.tint); cu.uTintAmt.value = c.tintAmt; cu.uLift.value.set(...c.lift); cu.uFlareTint.value.set(...c.flareTint);
  circuitExposure = c.exposure;
  const sk = skyline.material.uniforms;
  sk.tSil.value = c.skyline.sil; sk.tLit.value = c.skyline.lit; sk.uHaze.value.copy(c.fog);
  roadMat.map = c.road.map; roadMat.emissiveMap = c.road.emissive; roadMat.roughnessMap = c.road.rough;
  roadMat.color.copy(c.roadColor); roadMat.emissiveIntensity = c.roadGlow;
  barMat.color.copy(c.barrier); barMat.emissiveIntensity = c.barrierGlow;
  // Everything that reflects the sky reflects this circuit's.
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) if (m.envMap === envMap || m.envMap === envMapDesert) m.envMap = c.env;
  });
  if (!desert) BEND.nhHill.value.fill(0);
  applyGlow();
}

function updateWorld(dt) {
  if (circuit === 'desert') {
    // Game Room: the desert moves its own scenery instead (the barriers are shared).
    barTex.map.offset.y = (dist / 6) % 1;
    updateDesert();
    return;
  }
  roadTex.map.offset.y = (dist / ROAD_TEX_LEN) % 1;
  barTex.map.offset.y = (dist / 6) % 1;
  updateBuildings();
  const lp = lampPoles.instanceMatrix.array, lh = lampHeads.instanceMatrix.array, lo = lampPools.instanceMatrix.array;
  for (let i = 0; i < LAMP_N; i++) {
    const z = LAMP_NEAR - mod(i * LAMP_SP + 20 - dist, LAMP_L);
    lampZ[i] = z;
    lp[i * 16 + 14] = z; lh[i * 16 + 14] = z; lo[i * 16 + 14] = z;
  }
  lampPoles.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  lampPools.instanceMatrix.needsUpdate = true;
  const sp = slPosts.instanceMatrix.array, sh = slHeads.instanceMatrix.array, so = slPools.instanceMatrix.array;
  for (let i = 0; i < SL_N * 2; i++) {
    const k = i % SL_N;
    const z = SL_NEAR - mod(k * SL_SP + (i >= SL_N ? 16 : 0) - dist, SL_L);
    sp[i * 16 + 14] = z; sh[i * 16 + 14] = z; so[i * 16 + 14] = z;
  }
  slPosts.instanceMatrix.needsUpdate = true;
  slHeads.instanceMatrix.needsUpdate = true;
  slPools.instanceMatrix.needsUpdate = true;
  for (const p of props) {
    p.obj.position.z = p.near - mod(p.base - dist, p.L);
    if (p.update) p.update(dt, p.obj);
  }
}

// ---------- vehicles ----------
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// side profile (u: rear -> front, v: height) extruded across the car's width; rear ends up at +z
function profileGeometry(build, width, bevel, length) {
  const s = new THREE.Shape();
  build(s);
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10, steps: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  g.translate(0, 0, length / 2);
  return creaseNormals(g.index ? g.toNonIndexed() : g, 0.75);
}

const CAR_L = 4.5;
const PAINTS = [
  { name: 'Midnight blue', hex: '#1b2f72' },
  { name: 'Candy red', hex: '#9e0d1d' },
  { name: 'Pearl white', hex: '#d7dbe4' },
  { name: 'Gloss black', hex: '#0c0d11' },
  { name: 'Ultraviolet', hex: '#3a1d78' },
  { name: 'Harbor teal', hex: '#0b7f86' },
  { name: 'Sunset orange', hex: '#c9500c' },
];
const paintMat = new THREE.MeshPhysicalMaterial({ color: lin(PAINTS[0].hex), metalness: 0.55, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.08, envMap, envMapIntensity: 1.0 });
const glassMat = new THREE.MeshStandardMaterial({ color: lin('#05080e'), metalness: 0.4, roughness: 0.05, envMap, envMapIntensity: 1.1 });
const trimMat = new THREE.MeshStandardMaterial({ color: lin('#0c0e13'), metalness: 0.3, roughness: 0.5, envMap, envMapIntensity: 0.6 });
const chromeMat = new THREE.MeshStandardMaterial({ color: lin('#c3c8d2'), metalness: 1, roughness: 0.16, envMap, envMapIntensity: 1.1 });
const tireMat = new THREE.MeshStandardMaterial({ color: lin('#0b0b0d'), roughness: 0.9, metalness: 0 });
const rimMat = new THREE.MeshStandardMaterial({ color: lin('#3a3e47'), metalness: 0.9, roughness: 0.28, envMap, envMapIntensity: 1.2 });
const lensMat = new THREE.MeshStandardMaterial({ color: lin('#2b0408'), metalness: 0.2, roughness: 0.1, envMap, envMapIntensity: 1.2 });
const TAIL_ON = hdr(3.0, 0.07, 0.11);
const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_ON.clone() });
const headMat = new THREE.MeshBasicMaterial({ color: hdr(2.4, 2.5, 2.8) });
const plateMat = new THREE.MeshStandardMaterial({ map: texPlate, emissive: hdr(1, 1, 1), emissiveMap: texPlate, emissiveIntensity: 0.35, roughness: 0.5 });
let paintIdx = 0;
function setPaint(i) { paintIdx = mod(i, PAINTS.length); paintMat.color.copy(lin(PAINTS[paintIdx].hex)); }

const carRoot = new THREE.Group();
const chassis = new THREE.Group();
const body = new THREE.Group();
carRoot.add(chassis);
chassis.add(body);
scene.add(carRoot);
const addTo = (parent, geo, mat) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

addTo(body, profileGeometry((s) => {
  s.moveTo(0.10, 0.26);
  s.lineTo(0.54, 0.26); s.lineTo(0.54, 0.34);
  s.absarc(0.98, 0.34, 0.44, Math.PI, 0, true);
  s.lineTo(1.42, 0.26); s.lineTo(3.12, 0.26); s.lineTo(3.12, 0.34);
  s.absarc(3.56, 0.34, 0.44, Math.PI, 0, true);
  s.lineTo(4.00, 0.26); s.lineTo(4.36, 0.27);
  s.quadraticCurveTo(4.52, 0.38, 4.48, 0.55);
  s.quadraticCurveTo(4.25, 0.73, 3.55, 0.83);
  s.lineTo(3.22, 0.88);
  s.lineTo(1.20, 0.94);
  s.lineTo(0.32, 0.93);
  s.quadraticCurveTo(0.05, 0.92, 0.02, 0.80);
  s.lineTo(0.0, 0.50);
  s.quadraticCurveTo(0.0, 0.30, 0.10, 0.26);
}, 1.96, 0.05, CAR_L), paintMat);
addTo(body, profileGeometry((s) => {
  s.moveTo(0.80, 0.90); s.lineTo(3.26, 0.86);
  s.quadraticCurveTo(2.95, 1.04, 2.52, 1.18);
  s.quadraticCurveTo(2.05, 1.255, 1.55, 1.225);
  s.quadraticCurveTo(1.12, 1.15, 0.80, 0.90);
}, 1.46, 0.06, CAR_L), glassMat);
addTo(body, profileGeometry((s) => {
  s.moveTo(1.32, 1.235);
  s.quadraticCurveTo(1.62, 1.31, 2.05, 1.325);
  s.quadraticCurveTo(2.42, 1.315, 2.60, 1.25);
  s.lineTo(2.54, 1.235);
  s.quadraticCurveTo(2.05, 1.295, 1.38, 1.215);
  s.lineTo(1.32, 1.235);
}, 1.36, 0.02, CAR_L), paintMat);
addTo(body, mergeGeometries([boxAt(0.2, 0.09, 0.16, -1.02, 1.0, -0.55), boxAt(0.2, 0.09, 0.16, 1.02, 1.0, -0.55)]), paintMat);
addTo(body, mergeGeometries([
  boxAt(1.88, 0.045, 0.34, 0, 1.28, 1.98),
  boxAt(0.03, 0.22, 0.42, -0.95, 1.22, 1.98), boxAt(0.03, 0.22, 0.42, 0.95, 1.22, 1.98),
  boxAt(0.04, 0.32, 0.12, -0.45, 1.10, 1.98), boxAt(0.04, 0.32, 0.12, 0.45, 1.10, 1.98),
]), trimMat);
addTo(body, boxAt(1.86, 0.15, 0.035, 0, 0.755, 2.282), lensMat);
addTo(body, mergeGeometries([
  boxAt(1.50, 0.028, 0.03, 0, 0.75, 2.302),
  boxAt(0.36, 0.05, 0.03, -0.72, 0.787, 2.302), boxAt(0.36, 0.05, 0.03, 0.72, 0.787, 2.302),
  boxAt(0.05, 0.13, 0.03, -0.88, 0.745, 2.30), boxAt(0.05, 0.13, 0.03, 0.88, 0.745, 2.30),
]), tailMat);
const plate = addTo(body, new THREE.PlaneGeometry(0.52, 0.13), plateMat);
plate.position.set(0, 0.52, 2.312);
const diffParts = [boxAt(1.36, 0.16, 0.42, 0, 0.27, 2.08)];
for (let i = -2; i <= 2; i++) diffParts.push(boxAt(0.02, 0.15, 0.36, i * 0.22, 0.27, 2.12));
addTo(body, mergeGeometries(diffParts), trimMat);
const EXHAUST_X = [-0.64, -0.5, 0.5, 0.64];
addTo(body, mergeGeometries(EXHAUST_X.map((x) => new THREE.CylinderGeometry(0.052, 0.052, 0.24, 14).rotateX(Math.PI / 2).translate(x, 0.30, 2.26))), chromeMat);
addTo(body, mergeGeometries(EXHAUST_X.map((x) => new THREE.CircleGeometry(0.04, 12).translate(x, 0.30, 2.381))), new THREE.MeshBasicMaterial({ color: hdr(0.05, 0.02, 0.02) }));
addTo(body, mergeGeometries([boxAt(0.44, 0.05, 0.05, -0.66, 0.62, -2.29), boxAt(0.44, 0.05, 0.05, 0.66, 0.62, -2.29)]), headMat);

const flameMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uLen: { value: 1 }, uCore: { value: hdr(2.5, 3.2, 6.0) }, uEdge: { value: hdr(0.5, 0.3, 2.2) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform float uTime; uniform float uPower; uniform float uLen; uniform vec3 uCore; uniform vec3 uEdge;
    varying vec2 vUv;
    void main() {
      float t = vUv.y / max(uLen, 0.05);
      float flick = 0.7 + 0.3 * sin(uTime * 70.0 + vUv.y * 24.0) * sin(uTime * 23.0);
      float k = max(1.0 - t, 0.0);
      gl_FragColor = vec4(mix(uEdge, uCore, k * k * k) * pow(k, 1.7) * flick * uPower, 1.0);
    }`,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
addTo(body, mergeGeometries(EXHAUST_X.map((x) => new THREE.ConeGeometry(0.06, 0.9, 12, 1, true).rotateX(Math.PI / 2).translate(x, 0.30, 2.38 + 0.45))), flameMat);

const wheels = [];
const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.27, 28).rotateZ(Math.PI / 2);
const rimParts = [new THREE.CylinderGeometry(0.24, 0.24, 0.275, 20).rotateZ(Math.PI / 2)];
for (let k = 0; k < 5; k++) rimParts.push(new THREE.BoxGeometry(0.29, 0.42, 0.055).rotateX((k * Math.PI * 2) / 5));
const rimGeo = mergeGeometries(rimParts);
for (const [x, z] of [[-0.86, 1.27], [0.86, 1.27], [-0.86, -1.31], [0.86, -1.31]]) {
  const w = new THREE.Group();
  w.position.set(x, 0.35, z);
  w.rotation.order = 'YXZ';
  w.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, rimMat));
  chassis.add(w);
  wheels.push(w);
}
chassis.add(new THREE.Mesh(flatPlane(2.7, 5.4, 0, 0.02, 0.05), new THREE.MeshBasicMaterial({
  color: 0x000000, alphaMap: texShadow, transparent: true, opacity: 0.82, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
})));
const UNDERGLOW = hdr(0.1, 0.08, 0.4);
const underglowMat = makeGlowMaterial(texSoftRect, UNDERGLOW.clone());
const UNDERGLOW_DESERT = hdr(0.05, 0.03, 0.015);
chassis.add(new THREE.Mesh(flatPlane(2.6, 5.2, 0, 0.03, 0), underglowMat));

const headSpot = new THREE.SpotLight(lin('#dfe8ff'), 2.4, 120, 0.42, 0.55, 1.2);
headSpot.position.set(0, 0.7, -2.0);
headSpot.target.position.set(0, 0, -32);
chassis.add(headSpot, headSpot.target);
const tailGlow = new THREE.PointLight(hdr(1, 0.05, 0.08), 1.6, 9, 2);
tailGlow.position.set(0, 0.55, 2.7);
chassis.add(tailGlow);
const lampLight = new THREE.PointLight(lin('#dbe6ff'), 0, 28, 2);
scene.add(lampLight);
for (const l of [hemi, moon, headSpot, tailGlow, lampLight]) l.layers.enable(1);
body.traverse((o) => o.layers.enable(1));
for (const w of wheels) w.traverse((o) => o.layers.enable(1));

// ---------- Game Room: the off-road truck (the desert's car) ----------
// A Baja-style trophy truck: high ride, big knobbly tyres on long-travel
// arms, an open bed with a spare wheel and a roll cage, a roof light bar.
// It sits in the same chassis as the car (sharing its paint, lamps and nitro
// flame) and setCircuit() swaps the two, for the player and the ghost. Same
// hitbox as the car, so racing doesn't change.
for (const o of [body, ...wheels]) o.userData.vehicle = 'car';
const OR_L = 4.3;
const OR_WHEEL_R = 0.5;
const orBody = new THREE.Group();
orBody.userData.vehicle = 'offroad';
chassis.add(orBody);
// A tube from a to b (each [x, y, z]): the cage, the suspension arms.
function tube(a, b, r) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 8);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_yAxis, d.clone().normalize())));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}
// The body, tail to nose: the bed, the cab's base, a tall flat hood and a square nose.
addTo(orBody, profileGeometry((s) => {
  s.moveTo(0.06, 0.82);
  s.lineTo(0.0, 1.26); s.lineTo(1.45, 1.28); s.lineTo(1.6, 1.46); s.lineTo(2.75, 1.46);
  s.lineTo(3.95, 1.4); s.quadraticCurveTo(4.24, 1.38, 4.28, 1.24);
  s.lineTo(4.3, 0.98); s.lineTo(4.18, 0.8);
  s.lineTo(0.06, 0.82);
}, 1.62, 0.05, OR_L), paintMat);
// The bed is open: a dark floor sunk into the body's top.
addTo(orBody, boxAt(1.4, 0.04, 1.38, 0, 1.29, 1.42), trimMat);
// The cab: glass all round, a painted roof.
addTo(orBody, profileGeometry((s) => {
  s.moveTo(1.62, 1.46); s.lineTo(2.72, 1.46);
  s.lineTo(2.42, 1.94); s.lineTo(1.74, 1.96);
  s.lineTo(1.62, 1.42);
}, 1.44, 0.03, OR_L), glassMat);
addTo(orBody, boxAt(1.4, 0.07, 0.74, 0, 1.99, 0.05), paintMat);
// Fender flares over the wheels, a skid plate and bumpers.
addTo(orBody, mergeGeometries([
  ...[-1.45, 1.45].flatMap((z) => [-1, 1].map((sx) => boxAt(0.22, 0.12, 1.25, sx * 0.86, 1.06, z))),
  boxAt(1.5, 0.12, 0.55, 0, 0.72, -1.95), boxAt(1.8, 0.16, 0.14, 0, 0.92, -2.2), boxAt(1.8, 0.14, 0.14, 0, 0.92, 2.17),
]), trimMat);
// The roll cage over the bed and the cab, and long-travel suspension arms.
addTo(orBody, mergeGeometries([
  tube([-0.66, 1.95, 0.4], [-0.66, 1.3, 2.05], 0.045), tube([0.66, 1.95, 0.4], [0.66, 1.3, 2.05], 0.045),
  tube([-0.66, 1.3, 2.05], [0.66, 1.3, 2.05], 0.045), tube([-0.66, 1.7, 1.2], [0.66, 1.7, 1.2], 0.04),
  tube([-0.66, 1.95, 0.4], [0.66, 1.95, 0.4], 0.045),
  ...[-1.45, 1.45].flatMap((z) => [-1, 1].flatMap((sx) => [
    tube([sx * 0.45, 0.95, z - 0.2], [sx * 0.86, OR_WHEEL_R, z], 0.04),
    tube([sx * 0.45, 1.15, z + 0.15], [sx * 0.86, OR_WHEEL_R + 0.12, z], 0.05),
  ])),
]), chromeMat);
// A spare wheel lying in the bed.
addTo(orBody, new THREE.CylinderGeometry(0.42, 0.42, 0.26, 18).translate(0, 1.44, 1.45), tireMat);
// The light bar on the roof, the headlights in the nose, the tail lights.
addTo(orBody, boxAt(1.2, 0.1, 0.1, 0, 2.08, -0.28), trimMat);
addTo(orBody, mergeGeometries([
  ...[-0.45, -0.15, 0.15, 0.45].map((x) => boxAt(0.2, 0.06, 0.04, x, 2.08, -0.34)),
  boxAt(0.3, 0.1, 0.05, -0.55, 1.02, -2.17), boxAt(0.3, 0.1, 0.05, 0.55, 1.02, -2.17),
]), headMat);
addTo(orBody, mergeGeometries([boxAt(0.14, 0.28, 0.04, -0.72, 1.1, 2.16), boxAt(0.14, 0.28, 0.04, 0.72, 1.1, 2.16)]), tailMat);
const orPlate = addTo(orBody, new THREE.PlaneGeometry(0.42, 0.11), plateMat);
orPlate.position.set(0, 0.9, 2.25);
// Twin exhausts out the back, with the nitro flame.
const OR_EXHAUST_X = [-0.42, 0.42];
addTo(orBody, mergeGeometries(OR_EXHAUST_X.map((x) => new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).rotateX(Math.PI / 2).translate(x, 0.82, 2.2))), chromeMat);
addTo(orBody, mergeGeometries(OR_EXHAUST_X.map((x) => new THREE.ConeGeometry(0.07, 0.9, 12, 1, true).rotateX(Math.PI / 2).translate(x, 0.82, 2.35 + 0.45))), flameMat);
// Big knobbly tyres: a 12-sided tread over a round tyre, and a rim.
const orTireGeo = mergeGeometries([
  new THREE.CylinderGeometry(OR_WHEEL_R - 0.03, OR_WHEEL_R - 0.03, 0.4, 24).rotateZ(Math.PI / 2),
  new THREE.CylinderGeometry(OR_WHEEL_R, OR_WHEEL_R, 0.34, 12).rotateZ(Math.PI / 2),
]);
const orRimParts = [new THREE.CylinderGeometry(0.28, 0.28, 0.41, 16).rotateZ(Math.PI / 2)];
for (let k = 0; k < 6; k++) orRimParts.push(new THREE.BoxGeometry(0.42, 0.5, 0.05).rotateX((k * Math.PI * 2) / 6));
const orRimGeo = mergeGeometries(orRimParts);
const orWheels = [];
for (const [x, z] of [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]]) {
  const w = new THREE.Group();
  w.userData.vehicle = 'offroad';
  w.position.set(x, OR_WHEEL_R, z);
  w.rotation.order = 'YXZ';
  w.add(new THREE.Mesh(orTireGeo, tireMat), new THREE.Mesh(orRimGeo, rimMat));
  chassis.add(w);
  orWheels.push(w);
}
orBody.traverse((o) => o.layers.enable(1));
for (const w of orWheels) w.traverse((o) => o.layers.enable(1));
// Where the lamps sit on each.
const LAMPS = { car: { head: [0, 0.7, -2.0], tail: [0, 0.55, 2.7] }, offroad: { head: [0, 1.05, -2.2], tail: [0, 1.0, 2.5] } };
// Shows the car or the truck in a chassis (the player's, or the ghost's).
function showVehicle(ch, offroad) {
  for (const c of ch.children) if (c.userData.vehicle) c.visible = (c.userData.vehicle === 'offroad') === offroad;
}
showVehicle(chassis, false);

// ---------- Game Room: pickups ----------
// Floating over the road: a blue nitro canister, a violet phase ring and a
// gold shield. Laid out from the run's seed (lib/games/nighthighway/pickups.ts),
// so both racers meet the same ones; each collects in their own world.
const PICKUP_LOOK = {
  nitro: { color: hdr(0.6, 1.7, 3.4), geo: () => new THREE.CylinderGeometry(0.26, 0.26, 0.78, 18) },
  phase: { color: hdr(2.2, 0.9, 3.4), geo: () => new THREE.TorusGeometry(0.42, 0.09, 12, 32) },
  shield: { color: hdr(3.2, 2.1, 0.45), geo: () => new THREE.OctahedronGeometry(0.46) },
};
const PICKUP_POOL = 6; // per kind - more than are ever in sight at once
const pickupMeshes = {};
for (const kind of Object.keys(PICKUP_LOOK)) {
  const look = PICKUP_LOOK[kind];
  const geo = look.geo();
  const coreMat = new THREE.MeshBasicMaterial({ color: look.color });
  const glowMat = makeGlowMaterial(texPool, look.color.clone().multiplyScalar(0.25));
  pickupMeshes[kind] = [];
  for (let i = 0; i < PICKUP_POOL; i++) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(geo, coreMat);
    core.position.y = 0.95;
    if (kind === 'nitro') core.rotation.z = 0.35;
    grp.add(core, new THREE.Mesh(flatPlane(2.6, 2.6, 0, 0.05, 0), glowMat));
    grp.visible = false;
    grp.userData.core = core;
    scene.add(grp);
    pickupMeshes[kind].push(grp);
  }
}
// The car's materials, so phasing can fade it (and restore it afterwards).
const playerMats = [];
carRoot.traverse((o) => {
  if (o.isMesh && !o.material.transparent && !playerMats.some((e) => e.m === o.material)) playerMats.push({ m: o.material, depthWrite: o.material.depthWrite });
});
let carFaded = false;
function setCarFaded(on) {
  if (on === carFaded) return;
  carFaded = on;
  for (const e of playerMats) {
    e.m.transparent = on;
    e.m.opacity = on ? 0.3 : 1;
    e.m.depthWrite = on ? false : e.depthWrite;
    e.m.needsUpdate = true;
  }
}

// ---------- Game Room: the other racer's ghost ----------
// A copy of the player's car (sharing geometry) in the other player's paint,
// with their name floating above it. It never collides: it's only where
// their car is on their own screen.
const ghostRoot = carRoot.clone(true);
const ghostPaint = paintMat.clone();
const ghostDrop = [];
ghostRoot.traverse((o) => {
  if (o.isLight || (o.isMesh && o.material === flameMat)) ghostDrop.push(o);
  else if (o.isMesh && o.material === paintMat) o.material = ghostPaint;
  else if (o.isMesh) o.material = o.material.clone();
});
for (const o of ghostDrop) o.parent.remove(o);
const ghostChassis = ghostRoot.children[0];
const ghostWheels = ghostChassis.children.filter((c) => c.isGroup && c.children.length === 2);
let ghostName = '';
const ghostLabelTex = textTexture(512, 128, (g, w, h) => {
  if (!ghostName) return;
  g.font = `800 72px ${DISPLAY_FONT}`;
  const tw = Math.min(w - 8, g.measureText(ghostName).width + 56);
  g.fillStyle = 'rgba(4,7,15,0.62)';
  rr(g, (w - tw) / 2, 14, tw, h - 28, 18); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#e8efff';
  g.fillText(ghostName, w / 2, h - 36, w - 40);
});
const ghostLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: ghostLabelTex, transparent: true, depthWrite: false, fog: false }));
ghostLabel.scale.set(2.8, 0.7, 1);
ghostLabel.position.set(0, 2.15, 0);
ghostRoot.add(ghostLabel);
ghostRoot.visible = false;
scene.add(ghostRoot);
function setGhostName(name) {
  ghostName = String(name || '').toUpperCase();
  const tt = textTextures.find((x) => x.t === ghostLabelTex);
  tt.g.clearRect(0, 0, tt.w, tt.h); tt.draw(tt.g, tt.w, tt.h); tt.t.needsUpdate = true;
}

// ---------- traffic ----------
function sedanGeometry() {
  const L = 4.7;
  const bodyG = profileGeometry((s) => {
    s.moveTo(0.05, 0.36); s.lineTo(4.62, 0.36); s.quadraticCurveTo(4.72, 0.40, 4.72, 0.60);
    s.quadraticCurveTo(4.55, 0.78, 3.55, 0.88); s.lineTo(1.30, 0.96); s.lineTo(0.30, 0.95);
    s.quadraticCurveTo(0.02, 0.92, 0.0, 0.70); s.quadraticCurveTo(0.0, 0.40, 0.05, 0.36);
  }, 1.82, 0.06, L);
  const cabinG = profileGeometry((s) => {
    s.moveTo(0.95, 0.94); s.lineTo(3.40, 0.88); s.quadraticCurveTo(3.0, 1.18, 2.70, 1.40);
    s.quadraticCurveTo(2.15, 1.47, 1.55, 1.44); s.quadraticCurveTo(1.20, 1.30, 0.95, 0.94);
  }, 1.54, 0.05, L);
  const wheelG = [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.4], [0.8, -1.4]].map(([x, z]) => new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16).rotateZ(Math.PI / 2).translate(x, 0.34, z));
  const parts = [bodyG, cabinG].concat(wheelG, [boxAt(1.84, 0.2, 0.14, 0, 0.44, 2.36), boxAt(1.84, 0.2, 0.14, 0, 0.44, -2.36)]);
  const cols = [[1, 1, 1], [0.06, 0.07, 0.09]].concat(wheelG.map(() => [0.03, 0.03, 0.035]), [[0.22, 0.22, 0.24], [0.22, 0.22, 0.24]]);
  const TAIL = [2.8, 0.07, 0.11], HEAD = [2.3, 2.4, 2.7];
  const lights = mergeGeometries([
    boxAt(0.42, 0.14, 0.06, -0.62, 0.78, 2.42), boxAt(0.42, 0.14, 0.06, 0.62, 0.78, 2.42),
    boxAt(0.40, 0.11, 0.06, -0.62, 0.66, -2.42), boxAt(0.40, 0.11, 0.06, 0.62, 0.66, -2.42),
  ], [TAIL, TAIL, HEAD, HEAD]);
  return { body: mergeGeometries(parts, cols), lights };
}
function truckGeometry() {
  const parts = [], cols = [];
  const add = (g, c) => { parts.push(g); cols.push(c); };
  add(boxAt(2.55, 2.9, 11.4, 0, 2.6, 1.5), [0.86, 0.88, 0.92]);
  add(boxAt(2.2, 0.35, 11.0, 0, 1.0, 1.5), [0.06, 0.06, 0.07]);
  add(boxAt(2.4, 0.16, 0.12, 0, 0.75, 7.15), [0.1, 0.1, 0.1]);
  for (const x of [-0.42, 0.42]) add(boxAt(0.04, 2.7, 0.03, x, 2.6, 7.215), [0.3, 0.3, 0.32]);
  add(boxAt(2.45, 2.3, 2.3, 0, 2.05, -5.95), [1, 1, 1]);
  add(boxAt(2.4, 0.95, 1.7, 0, 3.6, -5.65), [1, 1, 1]);
  add(boxAt(2.2, 0.85, 0.05, 0, 2.55, -7.11), [0.05, 0.06, 0.08]);
  add(boxAt(2.5, 0.35, 0.2, 0, 0.75, -7.1), [0.2, 0.2, 0.22]);
  add(boxAt(1.0, 0.5, 2.0, 0, 0.9, -4.3), [0.06, 0.06, 0.07]);
  for (const z of [6.2, 5.0, -3.4, -6.2]) for (const x of [-1.0, 1.0]) add(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16).rotateZ(Math.PI / 2).translate(x, 0.5, z), [0.03, 0.03, 0.035]);
  const lp = [], lc = [];
  const L = (g, c) => { lp.push(g); lc.push(c); };
  const RED = [2.8, 0.07, 0.11], AMB = [2.6, 1.1, 0.1], WHT = [2.3, 2.4, 2.7];
  L(boxAt(0.32, 0.16, 0.06, -1.0, 1.25, 7.24), RED); L(boxAt(0.32, 0.16, 0.06, 1.0, 1.25, 7.24), RED);
  for (const x of [-1.15, -0.3, 0, 0.3, 1.15]) L(boxAt(0.12, 0.08, 0.06, x, 3.98, 7.24), AMB);
  for (let z = -3.6; z <= 6.6; z += 2.55) for (const x of [-1.29, 1.29]) L(boxAt(0.04, 0.08, 0.16, x, 1.42, z), AMB);
  for (const x of [-0.85, 0.85]) L(boxAt(0.4, 0.15, 0.06, x, 1.2, -7.12), WHT);
  for (const x of [-0.9, -0.3, 0.3, 0.9]) L(boxAt(0.1, 0.07, 0.06, x, 4.1, -6.48), AMB);
  return { body: mergeGeometries(parts, cols), lights: mergeGeometries(lp, lc) };
}

const trafficPaint = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.38, envMap, envMapIntensity: 1.0 });
const trafficLight = new THREE.MeshBasicMaterial({ vertexColors: true });
const sedan = sedanGeometry();
const truck = truckGeometry();
// Game Room: same-direction traffic is simulated by a TrafficSim
// (lib/games/nighthighway/traffic.ts) in world coordinates - deterministic in a
// race, so both racers see the same cars - and mapped onto these instanced
// slots every frame (z = dist - s). Oncoming traffic never meets the player,
// so it stays local and random, as in the original.
const N_SAME_CARS = 30, N_OPP = 12, N_TRUCKS = 8;
const HIDDEN_Z = -5000; // past the camera's far plane
const N_CARS = N_SAME_CARS + N_OPP;
function withColors(mesh, n) {
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
const carBodies = withColors(instanced(sedan.body, trafficPaint, N_CARS), N_CARS);
const carLights = withColors(instanced(sedan.lights, trafficLight, N_CARS), N_CARS);
const truckBodies = withColors(instanced(truck.body, trafficPaint, N_TRUCKS), N_TRUCKS);
const truckLights = withColors(instanced(truck.lights, trafficLight, N_TRUCKS), N_TRUCKS);

const CAR_COLORS = ['#e9ebef', '#c9ccd3', '#8d929c', '#2a2d33', '#101114', '#1f3f7a', '#7d1620', '#3c4b3a', '#b9a888', '#4b5a6e', '#e9ebef', '#c9ccd3'].map(lin);
const TRUCK_COLORS = ['#f2f2f2', '#d9dde3', '#9fb3c8', '#c94b3b'].map(lin);

// ---------- Game Room: the desert's traffic ----------
// Jeeps and pickups in place of the sedans, dusty tipper haulers in place of
// the trucks. Same lengths, widths and light positions as the city's, so the
// traffic plays exactly the same; writeTraffic draws whichever set the
// circuit shows (each car is a jeep or a pickup by its id).
const DARK = [0.05, 0.05, 0.06], TYRE = [0.03, 0.03, 0.035], TRIM = [0.2, 0.2, 0.22];
const D_TAIL = [2.8, 0.07, 0.11], D_HEAD = [2.3, 2.4, 2.7];
function trafficParts() {
  const parts = [], cols = [];
  return { parts, cols, add(g, c) { parts.push(g); cols.push(c); }, body() { return mergeGeometries(parts, cols); } };
}
function carLightsAt(z0, z1, yt, yh) {
  return mergeGeometries([
    boxAt(0.32, 0.16, 0.06, -0.62, yt, z0), boxAt(0.32, 0.16, 0.06, 0.62, yt, z0),
    boxAt(0.32, 0.12, 0.06, -0.62, yh, z1), boxAt(0.32, 0.12, 0.06, 0.62, yh, z1),
  ], [D_TAIL, D_TAIL, D_HEAD, D_HEAD]);
}
function jeepGeometry() {
  const L = 4.4, b = trafficParts();
  b.add(profileGeometry((s) => {
    s.moveTo(0.05, 0.52); s.lineTo(0.0, 1.2); s.lineTo(3.0, 1.22); s.lineTo(4.3, 1.12);
    s.lineTo(4.4, 0.86); s.lineTo(4.32, 0.52); s.lineTo(0.05, 0.52);
  }, 1.78, 0.04, L), [1, 1, 1]);
  b.add(profileGeometry((s) => {
    s.moveTo(0.3, 1.2); s.lineTo(2.9, 1.22); s.lineTo(2.6, 1.84); s.lineTo(0.36, 1.86); s.lineTo(0.3, 1.2);
  }, 1.66, 0.03, L), DARK);
  b.add(boxAt(1.72, 0.07, 2.26, 0, 1.89, 0.72), [1, 1, 1]); // roof
  b.add(boxAt(1.5, 0.08, 1.6, 0, 1.97, 0.75), TRIM); // roof rack
  for (const z of [-1.4, 1.4]) for (const x of [-0.82, 0.82]) {
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14).rotateZ(Math.PI / 2).translate(x, 0.42, z), TYRE);
    b.add(boxAt(0.24, 0.1, 1.0, x * 1.06, 0.88, z), DARK); // fender flare
  }
  b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14).rotateX(Math.PI / 2).translate(0, 1.0, 2.3), TYRE); // spare wheel
  b.add(boxAt(1.84, 0.18, 0.16, 0, 0.6, 2.24), TRIM);
  b.add(boxAt(1.84, 0.2, 0.18, 0, 0.62, -2.24), TRIM);
  return { body: b.body(), lights: carLightsAt(2.24, -2.24, 0.86, 0.96) };
}
function pickupGeometry() {
  const L = 4.8, b = trafficParts();
  b.add(profileGeometry((s) => {
    s.moveTo(0.05, 0.5); s.lineTo(0.0, 1.15); s.lineTo(3.6, 1.15); s.lineTo(4.6, 1.08);
    s.lineTo(4.8, 0.86); s.lineTo(4.72, 0.5); s.lineTo(0.05, 0.5);
  }, 1.8, 0.04, L), [1, 1, 1]);
  b.add(boxAt(1.6, 0.05, 1.55, 0, 1.13, 1.5), DARK); // the open bed
  b.add(profileGeometry((s) => {
    s.moveTo(1.85, 1.15); s.lineTo(3.5, 1.15); s.lineTo(3.15, 1.74); s.lineTo(1.92, 1.77); s.lineTo(1.85, 1.15);
  }, 1.66, 0.03, L), DARK);
  b.add(boxAt(1.7, 0.07, 1.25, 0, 1.79, -0.13), [1, 1, 1]); // cab roof
  for (const z of [-1.55, 1.55]) for (const x of [-0.82, 0.82]) b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14).rotateZ(Math.PI / 2).translate(x, 0.4, z), TYRE);
  b.add(boxAt(1.84, 0.16, 0.16, 0, 0.58, 2.44), TRIM);
  b.add(boxAt(1.84, 0.2, 0.16, 0, 0.6, -2.44), TRIM);
  return { body: b.body(), lights: carLightsAt(2.44, -2.44, 0.86, 0.96) };
}
// The city truck's cab and lights, with an open tipper body heaped with sand instead of the box trailer.
function haulerGeometry() {
  const b = trafficParts();
  const SAND = [0.82, 0.62, 0.42];
  b.add(boxAt(2.5, 0.3, 11.4, 0, 1.35, 1.5), DARK);
  for (const x of [-1.2, 1.2]) b.add(boxAt(0.1, 1.5, 11.4, x, 2.2, 1.5), [1, 1, 1]);
  b.add(boxAt(2.5, 1.5, 0.12, 0, 2.2, 7.16), [1, 1, 1]);
  b.add(boxAt(2.5, 1.9, 0.14, 0, 2.4, -4.2), [1, 1, 1]);
  b.add(new THREE.CylinderGeometry(1.15, 1.15, 10.8, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, 2.55, 1.5), SAND);
  b.add(boxAt(2.2, 0.35, 11.0, 0, 1.0, 1.5), DARK);
  b.add(boxAt(2.4, 0.16, 0.12, 0, 0.75, 7.15), [0.1, 0.1, 0.1]);
  b.add(boxAt(2.45, 2.3, 2.3, 0, 2.05, -5.95), [1, 1, 1]);
  b.add(boxAt(2.4, 0.95, 1.7, 0, 3.6, -5.65), [1, 1, 1]);
  b.add(boxAt(2.2, 0.85, 0.05, 0, 2.55, -7.11), [0.05, 0.06, 0.08]);
  b.add(boxAt(2.5, 0.35, 0.2, 0, 0.75, -7.1), [0.2, 0.2, 0.22]);
  for (const z of [6.2, 5.0, -3.4, -6.2]) for (const x of [-1.0, 1.0]) b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14).rotateZ(Math.PI / 2).translate(x, 0.55, z), TYRE);
  return { body: b.body(), lights: truck.lights };
}
const jeep = jeepGeometry(), pickup = pickupGeometry(), hauler = haulerGeometry();
const jeepBodies = withColors(instanced(jeep.body, trafficPaint, N_CARS), N_CARS);
const jeepLights = withColors(instanced(jeep.lights, trafficLight, N_CARS), N_CARS);
const pickupBodies = withColors(instanced(pickup.body, trafficPaint, N_CARS), N_CARS);
const pickupLights = withColors(instanced(pickup.lights, trafficLight, N_CARS), N_CARS);
const haulerBodies = withColors(instanced(hauler.body, trafficPaint, N_TRUCKS), N_TRUCKS);
const haulerLights = withColors(instanced(hauler.lights, trafficLight, N_TRUCKS), N_TRUCKS);
cityObjs.push(carBodies, carLights, truckBodies, truckLights);
desertObjs.push(jeepBodies, jeepLights, pickupBodies, pickupLights, haulerBodies, haulerLights);
const DESERT_CAR_COLORS = ['#c8b08a', '#a8865c', '#7a6a52', '#5b4a3a', '#d8cfc0', '#8a3a2a', '#3f4a3a', '#b0703c', '#6a7a7a', '#e0d6c4', '#9a8a6a', '#4a3a30'].map(lin);
const DESERT_TRUCK_COLORS = ['#d9c8a8', '#c2a070', '#a85a3a', '#8a8a80'].map(lin);
const vehicles = [];
for (let i = 0; i < N_CARS; i++) vehicles.push({ kind: 'car', idx: i, dir: i < N_SAME_CARS ? 1 : -1, len: 4.85, halfW: 0.94, x: 0, z: i < N_SAME_CARS ? HIDDEN_Z : null, v: 30, cruise: 30, lane: 0, sy: 1, brake: 0, lc: null, prevZ: HIDDEN_Z, color: CAR_COLORS[0], id: -1 });
for (let i = 0; i < N_TRUCKS; i++) vehicles.push({ kind: 'truck', idx: i, dir: 1, len: 14.5, halfW: 1.28, x: 0, z: HIDDEN_Z, v: 23, cruise: 23, lane: 2, sy: 1, brake: 0, lc: null, prevZ: HIDDEN_Z, color: TRUCK_COLORS[0], id: -1 });
const carSlots = vehicles.filter((v) => v.kind === 'car' && v.dir > 0);
const truckSlots = vehicles.filter((v) => v.kind === 'truck');

function laneBlocked(v, laneX, z, gap) {
  let near = 0;
  for (const o of vehicles) {
    if (o === v || o.dir !== v.dir || o.z === null) continue;
    const dz = Math.abs(o.z - z);
    if (Math.abs(o.x - laneX) < 2.4 && dz < gap + (o.len + v.len) / 2) return true;
    if (v.dir > 0 && dz < 22 && Math.abs(o.x - laneX) > 1) near++;
  }
  return v.dir > 0 && near >= 3;
}
function spawn(v, zMin, zMax) {
  const lanes = v.dir > 0 ? LANES : OPP_LANES;
  for (let t = 0; t < 16; t++) {
    const li = v.kind === 'truck' ? 2 + ((Math.random() * 2) | 0) : (Math.random() * 4) | 0;
    const z = rand(zMin, zMax);
    if (!laneBlocked(v, lanes[li], z, 14)) {
      v.lane = li; v.x = lanes[li]; v.z = z; v.prevZ = z; v.lc = null; v.brake = 0;
      v.cruise = v.kind === 'truck' ? rand(21, 25) : (v.dir > 0 ? rand(23, 31) + (3 - li) * 1.6 : rand(25, 36));
      v.v = v.cruise;
      v.sy = v.kind === 'truck' ? 1 : (Math.random() < 0.3 ? rand(1.12, 1.25) : rand(0.97, 1.05));
      v.color = v.kind === 'truck' ? pick(TRUCK_COLORS) : pick(CAR_COLORS);
      return true;
    }
  }
  v.z = zMin - 320;
  v.prevZ = v.z;
  return false;
}
for (const v of vehicles) if (v.dir < 0) spawn(v, -900, -20);

const randomSeed = () => (Math.random() * 4294967296) >>> 0;
let traffic = new TrafficSim(randomSeed(), 'recycle', 0);
// The time the traffic is drawn at: the race clock in a race, else local time.
let trafficClock = 0;
// Each traffic car's z last frame (by id), so a car passing the player is noticed even as slots get reassigned.
let lastRel = new Map();
function newTraffic(seed, mode) {
  traffic = new TrafficSim(seed, mode, dist);
  trafficClock = 0;
  lastRel = new Map();
}
function hideSlot(v) { v.id = -1; v.z = HIDDEN_Z; v.prevZ = HIDDEN_Z; v.brake = 0; v.lc = null; }

function updateTraffic(dt, pv) {
  for (const v of vehicles) {
    if (v.dir > 0) continue;
    v.prevZ = v.z;
    v.z += (pv + v.v) * dt;
    if (v.z > 40) { spawn(v, -980, -700); v.prevZ = v.z; }
  }
  if (!raceLive()) { trafficClock += dt; traffic.advanceTo(trafficClock, dist); }
  syncTraffic();
}
// Maps the simulated cars within sight onto the slots, nearest first if there are more than slots.
function syncTraffic() {
  const ahead = trafficClock - traffic.time;
  const cars = [], trucks = [];
  for (const c of traffic.cars) {
    const z = dist - (c.s + c.v * ahead);
    if (z > 40 || z < -980) continue;
    (c.kind === 'truck' ? trucks : cars).push({ c, z });
  }
  const seen = new Map();
  const fill = (list, slots, colors) => {
    if (list.length > slots.length) list.sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
    for (let i = 0; i < slots.length; i++) {
      const v = slots[i], e = list[i];
      if (!e) { hideSlot(v); continue; }
      const prev = lastRel.get(e.c.id);
      v.id = e.c.id; v.x = e.c.x; v.z = e.z; v.v = e.c.v; v.brake = e.c.brake; v.lc = e.c.lc; v.sy = e.c.sy; v.lane = e.c.lane;
      v.color = colors[e.c.color % colors.length];
      v.prevZ = prev === undefined ? e.z : prev;
      seen.set(e.c.id, e.z);
    }
  };
  const desert = circuit === 'desert';
  fill(cars, carSlots, desert ? DESERT_CAR_COLORS : CAR_COLORS);
  fill(trucks, truckSlots, desert ? DESERT_TRUCK_COLORS : TRUCK_COLORS);
  lastRel = seen;
}
// Game Room: which instanced meshes draw a traffic slot - the city's, or in the
// desert a hauler, or a jeep or pickup (by the car's id); the rest get nothing.
const TRAFFIC_SETS = [carBodies, carLights, truckBodies, truckLights, jeepBodies, jeepLights, pickupBodies, pickupLights, haulerBodies, haulerLights];
function trafficMeshes(v) {
  if (circuit !== 'desert') return v.kind === 'truck' ? [truckBodies, truckLights] : [carBodies, carLights];
  if (v.kind === 'truck') return [haulerBodies, haulerLights];
  return v.id % 2 ? [pickupBodies, pickupLights] : [jeepBodies, jeepLights];
}
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function writeTraffic() {
  for (const v of vehicles) {
    for (const m of TRAFFIC_SETS) if (v.idx < m.count && (m === truckBodies || m === truckLights || m === haulerBodies || m === haulerLights) === (v.kind === 'truck')) m.setMatrixAt(v.idx, _zero);
    // Game Room: no oncoming lane in the desert.
    if (v.z === HIDDEN_Z || (v.dir < 0 && circuit === 'desert')) continue;
    const [bodyM, lightM] = trafficMeshes(v);
    let yaw = v.dir > 0 ? 0 : Math.PI;
    if (v.lc) yaw += -Math.sign(v.lc.to - v.lc.from) * 0.05 * Math.sin(Math.PI * clamp(v.lc.t, 0, 1));
    _q.setFromAxisAngle(_yAxis, yaw);
    _p.set(v.x, 0, v.z);
    _s.set(1, v.sy, 1);
    _m4.compose(_p, _q, _s);
    bodyM.setMatrixAt(v.idx, _m4);
    lightM.setMatrixAt(v.idx, _m4);
    const c = bodyM.instanceColor.array;
    c[v.idx * 3] = v.color.r; c[v.idx * 3 + 1] = v.color.g; c[v.idx * 3 + 2] = v.color.b;
    const k = smooth(-900, -560, v.z) * (1 + v.brake * 1.3);
    const lc = lightM.instanceColor.array;
    lc[v.idx * 3] = k; lc[v.idx * 3 + 1] = k; lc[v.idx * 3 + 2] = k;
  }
  for (const m of TRAFFIC_SETS) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
}

// ---------- effects: wet-road reflections, sparks, wind streaks ----------
const STREAK_MAX = 150;
const streakMesh = withColors(instanced(flatPlane(1, 1, 0, 0, 0), makeGlowMaterial(texStreak, hdr(1, 1, 1), 0.8), STREAK_MAX), STREAK_MAX);
let streakN = 0;
function addStreak(lx, ly, lz, r, g, b, lenScale) {
  if (streakN >= STREAK_MAX) return;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const dz = lz - cz;
  if (dz > -2 || dz < -460 || cy < 0.2) return;
  const t = cy / (cy + ly);
  const rz = cz + dz * t;
  const rx = cx + (lx - cx) * t;
  const d = -dz;
  _q.setFromAxisAngle(_yAxis, Math.atan2(lx - cx, lz - cz));
  _p.set(rx, 0.04, rz);
  _s.set(clamp(0.32 + d * 0.006, 0.32, 1.5), 1, clamp(d * 0.42 * (lenScale || 1), 1.6, 32));
  _m4.compose(_p, _q, _s);
  streakMesh.setMatrixAt(streakN, _m4);
  const ca = streakMesh.instanceColor.array;
  ca[streakN * 3] = r; ca[streakN * 3 + 1] = g; ca[streakN * 3 + 2] = b;
  streakN++;
}

function lineCloud(n) {
  const pos = new Float32Array(n * 6), col = new Float32Array(n * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  lines.frustumCulled = false;
  scene.add(lines);
  return { pos, col, geo };
}
const SPARK_N = 160;
const sparkCloud = lineCloud(SPARK_N);
const sparks = [];
for (let i = 0; i < SPARK_N; i++) sparks.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
let sparkCursor = 0;
function emitSparks(x, y, z, sideX, count, power) {
  for (let i = 0; i < count; i++) {
    const s = sparks[sparkCursor];
    sparkCursor = (sparkCursor + 1) % SPARK_N;
    s.life = s.max = rand(0.25, 0.7);
    s.x = x; s.y = y; s.z = z + rand(-0.6, 0.6);
    s.vx = sideX * rand(0.5, 4) + rand(-1, 1);
    s.vy = rand(0.5, 4.5) * power;
    s.vz = rand(3, 14) * power;
  }
}
function updateSparks(dt, pv) {
  const P = sparkCloud.pos, C = sparkCloud.col;
  for (let i = 0; i < SPARK_N; i++) {
    const s = sparks[i];
    const o = i * 6;
    if (s.life <= 0) { C.fill(0, o, o + 6); continue; }
    s.life -= dt;
    s.vy -= 9.8 * dt;
    s.vz += pv * 0.9 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    if (s.y < 0.02) { s.y = 0.02; s.vy *= -0.35; }
    const k = clamp(s.life / s.max, 0, 1);
    P[o] = s.x; P[o + 1] = s.y; P[o + 2] = s.z;
    P[o + 3] = s.x - s.vx * 0.025; P[o + 4] = s.y - s.vy * 0.025; P[o + 5] = s.z - s.vz * 0.025;
    C[o] = 4 * k; C[o + 1] = 1.6 * k * k; C[o + 2] = 0.4 * k * k * k;
    C[o + 3] = 1.2 * k; C[o + 4] = 0.3 * k * k; C[o + 5] = 0;
  }
  sparkCloud.geo.attributes.position.needsUpdate = true;
  sparkCloud.geo.attributes.color.needsUpdate = true;
}


// ---------- Game Room: dust (the desert) ----------
// Soft puffs kicked up behind the player's wheels (more when sliding or on
// nitro), behind the traffic and behind the ghost. Each is dragged along in
// its vehicle's wake at first (`carry`, m/s), then slows and streams back. Camera-facing quads, bent and
// lifted with the road like everything else.
const DUST_N = 320;
const dustGeo = new THREE.PlaneGeometry(1, 1);
const dustAlpha = new THREE.InstancedBufferAttribute(new Float32Array(DUST_N), 1);
dustAlpha.setUsage(THREE.DynamicDrawUsage);
dustGeo.setAttribute('aAlpha', dustAlpha);
const dustMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: texPool }, uColor: { value: hdr(0.6, 0.4, 0.26) }, uFog: { value: scene.fog.color }, uDensity: { value: FOG_DENSITY }, nhBend: BEND.nhBend, nhHill: BEND.nhHill },
  vertexShader: BEND_GLSL + `
    attribute float aAlpha;
    varying vec2 vUv; varying float vA; varying float vDepth;
    void main() {
      vUv = uv;
      vA = aAlpha;
      vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float size = length(instanceMatrix[0].xyz);
      c.xy += nhBendXY(c.z);
      vec4 mv = viewMatrix * c;
      mv.xy += position.xy * size;
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D map; uniform vec3 uColor; uniform vec3 uFog; uniform float uDensity;
    varying vec2 vUv; varying float vA; varying float vDepth;
    void main() {
      float fd = vDepth * uDensity;
      float f = 1.0 - exp(-fd * fd);
      gl_FragColor = vec4(mix(uColor, uFog, f), texture2D(map, vUv).r * vA * (1.0 - 0.7 * f));
    }`,
  transparent: true, depthWrite: false,
});
const dustMesh = new THREE.InstancedMesh(dustGeo, dustMat, DUST_N);
dustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dustMesh.frustumCulled = false;
scene.add(dustMesh);
desertObjs.push(dustMesh);
const dust = [];
for (let i = 0; i < DUST_N; i++) dust.push({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, carry: 0, size: 1, grow: 1, a: 0 });
let dustCursor = 0;
function kickDust(x, z, size, a, carry) {
  const d = dust[dustCursor];
  dustCursor = (dustCursor + 1) % DUST_N;
  d.x = x + rand(-0.3, 0.3); d.y = rand(0.2, 0.5); d.z = z + rand(-0.3, 0.3);
  d.vx = rand(-0.8, 0.8); d.vy = rand(0.4, 1.4);
  d.size = size * rand(0.7, 1.2); d.grow = size * rand(1.2, 2.2);
  d.carry = carry * rand(0.7, 0.9);
  d.life = 0; d.max = rand(1.4, 2.6); d.a = a;
}
let dustAcc = 0;
const dustFrom = new Map();
function updateDust(dt, pv) {
  dustMat.uniforms.uDensity.value = scene.fog.density;
  if (G.state === 'drive' || G.state === 'countdown' || G.state === 'title' || G.state === 'end') {
    // The player's rear wheels: more dust the faster, the more sideways, and on nitro.
    const speedK = clamp(player.v / 60, 0, 1.4);
    dustAcc += dt * speedK * (40 + 90 * clamp(Math.abs(player.vx) / 8, 0, 1) + 40 * player.flame + (player.inSand ? 200 : 0));
    while (dustAcc >= 1) {
      dustAcc -= 1;
      kickDust(player.x + (Math.random() < 0.5 ? -0.86 : 0.86), 1.6, 1.8, 0.75, pv);
    }
    // The traffic near enough to see, and the ghost.
    for (const v of vehicles) {
      if (v.dir < 0 || v.z === HIDDEN_Z || v.z < -260 || v.z > 30) continue;
      const k = (dustFrom.get(v) || 0) + dt * 9;
      dustFrom.set(v, k % 1);
      if (k >= 1) kickDust(v.x + rand(-v.halfW, v.halfW), v.z + v.len / 2, v.kind === 'truck' ? 2.6 : 1.8, 0.6, v.v);
    }
    if (ghostRoot.visible && Math.random() < dt * 24) kickDust(ghostRoot.position.x + rand(-0.86, 0.86), ghostRoot.position.z + 1.6, 1.8, 0.6, pv);
  }
  const a = dustMesh.instanceMatrix.array;
  for (let i = 0; i < DUST_N; i++) {
    const d = dust[i];
    d.life += dt;
    const t = d.life / d.max;
    if (t >= 1) { dustAlpha.array[i] = 0; a.fill(0, i * 16, i * 16 + 16); continue; }
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += (pv - d.carry) * dt;
    d.carry *= 1 - Math.min(1, dt * 1.6);
    d.vy *= 1 - dt * 0.8;
    const size = d.size + d.grow * d.life;
    const o = i * 16;
    a.fill(0, o, o + 16);
    a[o] = size; a[o + 5] = size; a[o + 10] = size; a[o + 15] = 1;
    a[o + 12] = d.x; a[o + 13] = d.y; a[o + 14] = d.z;
    dustAlpha.array[i] = d.a * Math.pow(1 - t, 1.5) * Math.min(1, d.life * 6);
  }
  dustMesh.instanceMatrix.needsUpdate = true;
  dustAlpha.needsUpdate = true;
}

// The desert track's bumps under a point `s` m down the road (m): washboard,
// a rolling surface and the odd stone. A picture only - it moves the truck's
// body and the camera, never the game.
function dirtBump(s) {
  const wash = Math.sin(s * 2.4) * 0.012;
  const roll = Math.sin(s * 0.55 + Math.sin(s * 0.13) * 2) * 0.028;
  const seg = Math.floor(s / 14);
  const h = Math.sin(seg * 91.7) * 43758.5;
  const r = h - Math.floor(h);
  const jolt = r > 0.78 ? Math.sin(Math.PI * clamp((s / 14 - seg - 0.4) / 0.12, 0, 1)) * 0.1 * ((r - 0.78) / 0.22) : 0;
  return wash + roll + jolt;
}

// ---------- Game Room: rain ----------
// Thin quads, not lines: WebGL lines are always 1 px, which all but vanishes
// once the engine lowers its resolution or the motion blur smears it.
const RAIN_N = 900;
const rainMat = new THREE.MeshBasicMaterial({ color: hdr(0.5, 0.6, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const rainMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.02, 1.0), rainMat, RAIN_N);
rainMesh.frustumCulled = false;
rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rainMesh.visible = false;
scene.add(rainMesh);
const _rainAxis = new THREE.Vector3(1, 0, 0);
const _one = new THREE.Vector3(1, 1, 1);
const drops = [];
function resetDrop(d, px, anywhere) {
  d.x = px + rand(-16, 16);
  d.y = anywhere ? rand(0, 12) : rand(8, 13);
  // Never right in front of the lens, where a drop would fill the screen.
  d.z = rand(-70, camera.position.z - 5);
}
for (let i = 0; i < RAIN_N; i++) { const d = {}; resetDrop(d, 0, true); drops.push(d); }
let rainK = 0; // eases in and out, 0 = dry
function updateRain(dt, pv, px) {
  rainK = damp(rainK, raining() ? 1 : 0, 2, dt);
  rainMesh.visible = rainK > 0.01;
  scene.fog.density = circuitFog * (1 + 0.7 * rainK);
  roadMat.roughness = 1 - 0.45 * rainK;
  if (!rainMesh.visible) return;
  rainMat.opacity = 0.32 * rainK;
  // Streaks slant back with speed, as they would past a moving car.
  _q.setFromAxisAngle(_rainAxis, -Math.min(pv * 0.012, 0.75));
  const fall = 17;
  for (let i = 0; i < RAIN_N; i++) {
    const d = drops[i];
    d.y -= fall * dt;
    d.z += pv * dt;
    if (d.y < 0 || d.z > camera.position.z - 4) resetDrop(d, px, false);
    _p.set(d.x, d.y, d.z);
    _m4.compose(_p, _q, _one);
    rainMesh.setMatrixAt(i, _m4);
  }
  rainMesh.instanceMatrix.needsUpdate = true;
}

const WIND_N = 90;
const windCloud = lineCloud(WIND_N);
const wind = [];
function resetWind(w, px, far) {
  w.x = px + (Math.random() < 0.5 ? -1 : 1) * rand(1.8, 13);
  w.y = rand(0.2, 7);
  w.z = far ? rand(-130, -30) : rand(-130, 6);
}
for (let i = 0; i < WIND_N; i++) { const w = {}; resetWind(w, 0, false); wind.push(w); }
function updateWind(dt, pv, px, boostK) {
  const P = windCloud.pos, C = windCloud.col;
  const len = clamp(pv * 0.07, 0, 7);
  const I = smooth(35, 85, pv) * 0.22 + boostK * 0.35;
  for (let i = 0; i < WIND_N; i++) {
    const w = wind[i];
    w.z += pv * dt;
    if (w.z > camera.position.z + 1) resetWind(w, px, true);
    const o = i * 6;
    P[o] = w.x; P[o + 1] = w.y; P[o + 2] = w.z;
    P[o + 3] = w.x; P[o + 4] = w.y; P[o + 5] = w.z - len;
    C[o] = 0.6 * I; C[o + 1] = 0.75 * I; C[o + 2] = 1.0 * I;
    C[o + 3] = 0; C[o + 4] = 0; C[o + 5] = 0;
  }
  windCloud.geo.attributes.position.needsUpdate = true;
  windCloud.geo.attributes.color.needsUpdate = true;
}

// ---------- game state ----------
const HUD = {
  hud: $('hud'), clock: $('clock'), timebar: $('timebar'), timefill: $('timefill'), score: $('score'), dist: $('dist'), nm: $('nm'),
  hint: $('hint'), speedo: $('speedo'), speed: $('speed'), arc: $('arc'), gear: $('gear'), nitro: $('nitro'), pops: $('pops'),
  count: $('count'), title: $('title'), results: $('results'), pause: $('pause'), touch: $('touch'), bestLine: $('bestLine'),
  opp: $('opp'),
  power: $('power'),
  optRain: $('optRain'), optPickups: $('optPickups'), optDesert: $('optDesert'),
};
if (RACE_MODE && HUD.hint) HUD.hint.innerHTML = 'W / ↑ gas · S / ↓ brake · A D / ← → steer<br>Shift or Space nitro · V camera · C paint · L glow · H hide HUD';
(function drawTicks() {
  let svg = '';
  for (let k = 0; k <= 18; k++) {
    const a = Math.PI + (k / 18) * Math.PI;
    const major = k % 3 === 0;
    const c = Math.cos(a), s = Math.sin(a);
    const r0 = major ? 84 : 89, r1 = 95;
    svg += `<line class="tick${major ? ' major' : ''}" x1="${(125 + c * r0).toFixed(1)}" y1="${(125 + s * r0).toFixed(1)}" x2="${(125 + c * r1).toFixed(1)}" y2="${(125 + s * r1).toFixed(1)}"></line>`;
    if (major) svg += `<text class="tick-num" x="${(125 + c * 110).toFixed(1)}" y="${(125 + s * 110 + 3).toFixed(1)}">${k * 20}</text>`;
  }
  $('ticks').innerHTML = svg;
})();

const G = {
  state: 'boot', t: 0, time: 60, cd: 0, lastCd: 0, score: 0, bonus: 0, distRun: 0, nearMiss: 0, overtakes: 0, crashes: 0,
  top: 0, sumV: 0, sumT: 0, combo: 0, comboT: 0, shake: 0, flash: 0, flashCol: new THREE.Vector3(1, 1, 1), paused: false, hudOff: false,
  shot: 0, shotT: 6.5, best: Number(store.get('best', 0)) || 0, hintT: 0,
  // Game Room: the race being driven (see startRace), and the countdown to the next live sample.
  race: null, liveT: 0, pickups: 0,
};
const raceLive = () => !!G.race && (G.state === 'countdown' || G.state === 'drive');
let opponent = null;
// Game Room: a race this device already finished is never started again (e.g. by a re-render).
let lastFinishedRace = -1;
const player = {
  x: LANES[2], vx: 0, v: 34, lastV: 34, nitro: 1, boosting: false, throttle: 0, braking: 0, gear: 1, rpm: 900, cut: 0,
  wheelRot: 0, crashT: 0, pop: 0, flame: 0, ap: LANES[2], scrape: 0,
  // Game Room: pickups - seconds of phasing left, and whether a shield is up.
  phaseT: 0, shield: false,
};
// Game Room: the switches for solo runs (a race brings its own), and this run's pickups.
let soloOptions = { ...DEFAULT_OPTIONS, ...store.get('options', {}) };
let pickupSeed = 0;
let pickupBase = 0;
let collected = new Set();
const runOptions = () => (G.race ? G.race.options || DEFAULT_OPTIONS : soloOptions);
// Game Room: the switches the road shows right now - the race's while one runs, otherwise the next race's (or solo's).
const shownOptions = () => (raceLive() ? runOptions() : RACE_MODE ? previewOptions : soloOptions);
const raining = () => shownOptions().rain;
// The race page shows the next race's switches between races (setOptions).
let previewOptions = { ...DEFAULT_OPTIONS };
function resetPickups(seed) {
  pickupSeed = seed >>> 0;
  sandSeed = (seed ^ 0x27d4eb2f) >>> 0; // Game Room: the desert's deep sand comes from the same seed (mixed)
  collected = new Set();
  player.phaseT = 0;
  player.shield = false;
}
function collect(p) {
  collected.add(p.id);
  G.pickups++;
  if (p.kind === 'nitro') {
    player.nitro = Math.min(1, player.nitro + NITRO_REFILL);
    popup('Nitro', '+' + Math.round(NITRO_REFILL * 100) + '%', 'cool');
  } else if (p.kind === 'phase') {
    player.phaseT = PHASE_SECONDS;
    popup('Phase', PHASE_SECONDS + ' s · drive through traffic', 'cool');
  } else {
    player.shield = true;
    popup('Shield', 'absorbs your next crash', 'cool');
  }
  audio.beep(p.kind === 'nitro' ? 990 : 1320, 0.1);
}
// Places the pickups in sight, and collects any the car drives through.
function updatePickups(dt) {
  player.phaseT = Math.max(0, player.phaseT - dt);
  const live = (G.state === 'countdown' || G.state === 'drive') && runOptions().pickups;
  const used = { nitro: 0, phase: 0, shield: 0 };
  if (live) {
    const d = dist - pickupBase;
    for (const p of pickupsBetween(pickupSeed, d - 30, d + 700)) {
      if (collected.has(p.id)) continue;
      if (G.state === 'drive' && reaches(p, d, player.x)) { collect(p); continue; }
      const grp = pickupMeshes[p.kind][used[p.kind]++];
      if (!grp) continue;
      grp.visible = true;
      grp.position.set(LANES[p.lane], 0, d - p.s);
      const core = grp.userData.core;
      core.position.y = 0.95 + (reduceMotion ? 0 : Math.sin(G.t * 2.4 + p.s) * 0.12);
      core.rotation.y = G.t * 2.2;
    }
  }
  for (const kind of Object.keys(pickupMeshes)) for (let i = used[kind]; i < PICKUP_POOL; i++) pickupMeshes[kind][i].visible = false;
  setCarFaded(player.phaseT > 0);
  // Game Room: no neon under the desert's truck - just a faint warm glow, unless a shield is up.
  underglowMat.uniforms.uColor.value.copy(player.shield ? PICKUP_LOOK.shield.color : circuit === 'desert' ? UNDERGLOW_DESERT : UNDERGLOW).multiplyScalar(player.shield ? 0.35 : 1);
}
// ---------- Game Room: deep sand (the desert) ----------
// Soft, rippled patches across one or two lanes, laid out from the run's seed
// (lib/games/nighthighway/sand.ts) so both racers meet the same ones. They
// drag the car back and make it slide (drive()), and kick up a plume.
function deepSandTexture() {
  const W = 128, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e2b47a'; g.fillRect(0, 0, W, H);
  // Wind ripples running across the road: a lit crest and a shadowed trough each.
  for (let y = 0; y < H; y += 7) {
    g.strokeStyle = `rgba(${y % 14 ? '150,96,56' : '255,226,180'},${rand(0.45, 0.75).toFixed(2)})`;
    g.lineWidth = rand(2, 3.5);
    g.beginPath();
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * 0.09 + y * 0.3) * 2.5);
    g.stroke();
  }
  return toTex(c, { repeat: true, aniso: true });
}
const SAND_POOL = 8;
const sandPatchMat = new THREE.MeshStandardMaterial({
  // Opaque: faded in at soft edges, it vanished against the dirt. The drift's mound shape softens its edges instead.
  color: hdr(1.3, 1.12, 0.92), map: deepSandTexture(), roughness: 1, metalness: 0,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
sandPatchMat.map.repeat.set(2, 6);
const sandGroup = new THREE.Group();
const sandMeshes = [];
for (let i = 0; i < SAND_POOL; i++) {
  // A low drift, highest in the middle (so the light shows its shape), with rows close enough to follow the hills.
  const g = new THREE.PlaneGeometry(1, 1, 6, 8).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, 0.04 + 0.16 * Math.cos(pos.getX(k) * Math.PI) * Math.cos(pos.getZ(k) * Math.PI));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, sandPatchMat);
  m.visible = false;
  sandGroup.add(m);
  sandMeshes.push(m);
}
scene.add(sandGroup);
desertObjs.push(sandGroup);
let sandSeed = 0;
function updateSand(dt) {
  let used = 0;
  player.inSand = false;
  if (circuit === 'desert' && (G.state === 'countdown' || G.state === 'drive')) {
    const d = dist - pickupBase;
    for (const p of sandBetween(sandSeed, d - 60, d + 800)) {
      const m = sandMeshes[used++];
      if (!m) break;
      const { left, right } = sandSpan(p);
      m.visible = true;
      // Wider and longer than the patch itself: the soft edges fade out over the extra.
      m.scale.set(right - left + 1.6, 1, p.length + 6);
      m.position.set((left + right) / 2, 0, d - (p.s + p.length / 2));
    }
    player.inSand = G.state === 'drive' && inSand(sandSeed, d, player.x);
  }
  for (let i = used; i < SAND_POOL; i++) sandMeshes[i].visible = false;
  // The sand drifts slowly across the road.
  sandPatchMat.map.offset.x = (sandPatchMat.map.offset.x + dt * 0.04) % 1;
}
const keys = { up: false, down: false, left: false, right: false, boost: false };
const CAMS = [
  { name: 'Chase', dist: 8.6, h: 2.5, look: 30, lookH: 1.05, fov: 58 },
  { name: 'Cinematic', dist: 13, h: 1.7, look: 42, lookH: 1.7, fov: 46 },
  { name: 'Bumper', dist: 5.4, h: 0.9, look: 24, lookH: 0.95, fov: 70 },
  { name: 'Roof', dist: -0.2, h: 1.42, look: 30, lookH: 1.1, fov: 72, inside: true },
];
let camMode = mod(Number(store.get('cam', 0)) || 0, CAMS.length);
const GLOW = [
  { name: 'Soft lights', bloom: 0.035, flare: 0.0, exposure: 0.8 },
  { name: 'Normal lights', bloom: 0.065, flare: 0.05, exposure: 0.86 },
  { name: 'Vivid lights', bloom: 0.11, flare: 0.12, exposure: 0.92 },
];
let glowIdx = clamp(Math.round(Number(store.get('glow', 1)) || 0), 0, GLOW.length - 1);
function applyGlow() {
  const g = GLOW[glowIdx];
  const cu = compositeMat.uniforms;
  cu.uBloom.value = g.bloom * (HDR ? 1 : 0.8);
  cu.uFlare.value = g.flare;
  cu.uExposure.value = g.exposure * circuitExposure;
}
applyGlow();
setPaint(Number(store.get('paint', 0)) || 0);

function popup(text, sub, cls) {
  const el = document.createElement('div');
  el.className = 'pop' + (cls ? ' ' + cls : '');
  const b = document.createElement('b');
  b.textContent = text;
  el.appendChild(b);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
  HUD.pops.appendChild(el);
  while (HUD.pops.children.length > 3) HUD.pops.firstChild.remove();
  setTimeout(() => el.remove(), 1300);
}
function showCount(text, go) {
  HUD.count.textContent = '';
  const s = document.createElement('span');
  s.textContent = text;
  if (go) s.className = 'go';
  HUD.count.appendChild(s);
}

// ---------- sound: a synthesized engine, wind and road noise ----------
const audio = {
  ctx: null, master: null, enabled: store.get('sound', true) !== false,
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 0.42 : 0;
      this.master.connect(ctx.destination);
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
      this.o2 = ctx.createOscillator(); this.o2.type = 'square';
      this.o3 = ctx.createOscillator(); this.o3.type = 'sawtooth';
      this.eFilter = ctx.createBiquadFilter(); this.eFilter.type = 'lowpass'; this.eFilter.Q.value = 3;
      this.eGain = ctx.createGain(); this.eGain.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.45;
      const g3 = ctx.createGain(); g3.gain.value = 0.5;
      this.o1.connect(this.eFilter);
      this.o2.connect(g2).connect(this.eFilter);
      this.o3.connect(g3).connect(this.eFilter);
      this.eFilter.connect(this.eGain).connect(this.master);
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let lastS = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lastS = (lastS + 0.02 * w) / 1.02; d[i] = lastS * 3.5 + w * 0.25; }
      this.noiseBuf = buf;
      const loop = (rate) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; return s; };
      this.wind = loop(1);
      this.wFilter = ctx.createBiquadFilter(); this.wFilter.type = 'bandpass'; this.wFilter.Q.value = 0.5;
      this.wGain = ctx.createGain(); this.wGain.gain.value = 0;
      this.wind.connect(this.wFilter).connect(this.wGain).connect(this.master);
      this.rumble = loop(0.6);
      this.rFilter = ctx.createBiquadFilter(); this.rFilter.type = 'lowpass'; this.rFilter.frequency.value = 160;
      this.rGain = ctx.createGain(); this.rGain.gain.value = 0;
      this.rumble.connect(this.rFilter).connect(this.rGain).connect(this.master);
      this.scrapeSrc = loop(1.7);
      this.sFilter = ctx.createBiquadFilter(); this.sFilter.type = 'bandpass'; this.sFilter.frequency.value = 2400; this.sFilter.Q.value = 3;
      this.sGain = ctx.createGain(); this.sGain.gain.value = 0;
      this.scrapeSrc.connect(this.sFilter).connect(this.sGain).connect(this.master);
      // Game Room: rain's hiss.
      this.rainSrc = loop(1.3);
      this.rainFilter = ctx.createBiquadFilter(); this.rainFilter.type = 'highpass'; this.rainFilter.frequency.value = 2600;
      this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
      this.rainSrc.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
      const t = ctx.currentTime;
      [this.o1, this.o2, this.o3, this.wind, this.rumble, this.scrapeSrc, this.rainSrc].forEach((n) => n.start(t));
    } catch {
      this.ctx = null;
    }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  setEnabled(on) {
    this.enabled = on;
    store.set('sound', on);
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.05);
  },
  update(rpm, throttle, pv, boost, scrape, rain = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = Math.max(30, (rpm / 60) * 3);
    this.o1.frequency.setTargetAtTime(f, t, 0.03);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.o3.frequency.setTargetAtTime(f * 1.012, t, 0.03);
    this.eFilter.frequency.setTargetAtTime(220 + rpm * 0.12 + throttle * 700, t, 0.05);
    this.eGain.gain.setTargetAtTime(0.05 + throttle * 0.07 + boost * 0.03, t, 0.06);
    const s01 = clamp(pv / 95, 0, 1);
    this.wFilter.frequency.setTargetAtTime(500 + s01 * 1600, t, 0.1);
    this.wGain.gain.setTargetAtTime(s01 * s01 * 0.22 + boost * 0.06, t, 0.1);
    this.rGain.gain.setTargetAtTime(0.05 + s01 * 0.12, t, 0.1);
    this.sGain.gain.setTargetAtTime(scrape * 0.25, t, 0.03);
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(rain * 0.22, t, 0.3);
  },
  burst(freq, q, dur, vol, type) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  },
  whoosh() { this.burst(900, 0.8, 0.5, 0.35); },
  crash() { this.burst(300, 0.6, 0.6, 0.9, 'lowpass'); this.burst(1800, 1.5, 0.35, 0.4); },
  pop() { this.burst(700, 2, 0.12, 0.3); },
  beep(freq, dur) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
};

// ---------- driving ----------
const GEAR_TOP = [62, 104, 148, 198, 252, 345];
const P_HALF_W = 0.98, P_HALF_L = 2.3, LIM = 7.45;
function nearestLane(x) {
  let bi = 0, bd = 1e9;
  for (let i = 0; i < LANES.length; i++) { const d = Math.abs(LANES[i] - x); if (d < bd) { bd = d; bi = i; } }
  return bi;
}
function laneClearAhead(laneX, range) {
  for (const v of vehicles) if (v.dir > 0 && Math.abs(v.x - laneX) < 2.2 && v.z < 6 && v.z > -range) return false;
  return true;
}
function laneClearBeside(laneX) {
  for (const v of vehicles) if (v.dir > 0 && Math.abs(v.x - laneX) < 2.3 && Math.abs(v.z) < v.len / 2 + 7) return false;
  return true;
}
function autopilot(dt, targetV) {
  const li = nearestLane(player.ap);
  if (!laneClearAhead(player.ap, 70)) {
    const opts = [li - 1, li + 1].filter((l) => l >= 0 && l < 4);
    if (Math.random() < 0.5) opts.reverse();
    for (const l of opts) if (laneClearAhead(LANES[l], 90) && laneClearBeside(LANES[l])) { player.ap = LANES[l]; break; }
  }
  player.vx = damp(player.vx, clamp((player.ap - player.x) * 1.8, -6, 6), 5, dt);
  player.x += player.vx * dt;
  let tv = targetV;
  for (const v of vehicles) if (v.dir > 0 && Math.abs(v.x - player.x) < 2.3 && v.z < 0 && v.z > -40) tv = Math.min(tv, v.v - 2);
  player.throttle = damp(player.throttle, player.v < tv ? 0.7 : 0.2, 6, dt);
  player.v = damp(player.v, Math.max(tv, 5), 1.2, dt);
  player.boosting = false;
  player.braking = tv < player.v - 3 ? 1 : 0;
}
function drive(dt) {
  const up = keys.up || coarse;
  const down = keys.down;
  const steerIn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.boosting = keys.boost && player.nitro > 0.02 && !down;
  const vmax = player.boosting ? 104 : 86;
  let a = 0;
  if (up || player.boosting) a += (player.boosting ? 24 : 15) * Math.max(0, 1 - Math.pow(player.v / vmax, 1.7)) * (player.cut > 0 ? 0.3 : 1);
  const wet = raining(); // Game Room: rain - less grip, longer braking
  if (down) a -= wet ? 21 : 32;
  a -= 0.6 + 0.00042 * player.v * player.v;
  if (player.crashT > 0) a -= 6;
  if (player.inSand) a -= SAND_DRAG * player.v * player.v; // Game Room: deep sand drags the car back
  player.v = clamp(player.v + a * dt, 0, 110);
  player.throttle = damp(player.throttle, up || player.boosting ? 1 : 0, 10, dt);
  player.braking = down ? 1 : 0;
  player.nitro = player.boosting ? Math.max(0, player.nitro - dt * 0.24) : Math.min(1, player.nitro + dt * 0.05);
  const latMax = lerp(3.5, 10.5, clamp(player.v / 45, 0, 1));
  // Game Room: on a wet road, sideways speed settles slowly - the car slides.
  // The desert's loose dirt does the same, more mildly (and more so when wet).
  const dirt = circuit === 'desert';
  player.vx = damp(player.vx, steerIn * latMax * (wet ? 0.85 : 1), wet ? (dirt ? 1.6 : 2.0) : player.inSand ? 2.0 : dirt ? 3.2 : 7, dt);
  player.x += player.vx * dt;
  // Game Room: a bend pushes the car toward its outside, harder the faster you go (and on dirt).
  player.x -= curvatureAt(roadSeed, dist) * player.v * player.v * CENTRIFUGAL * (wet ? 1.5 : 1) * (dirt ? 1.2 : 1) * dt;
  player.ap = LANES[nearestLane(player.x)];
  return steerIn;
}
function contactBarriers(dt, steerIn) {
  player.scrape = 0;
  for (const side of [1, -1]) {
    if (player.x * side <= LIM) continue;
    player.x = LIM * side;
    if (player.vx * side > 0) player.vx = -side * Math.min(2, Math.abs(player.vx) * 0.3);
    if (steerIn === side && player.v > 8 && G.state === 'drive') {
      player.scrape = 1;
      player.v = Math.max(0, player.v - 9 * dt);
      G.shake = Math.max(G.shake, 0.35);
      if (Math.random() < dt * 40) emitSparks(player.x + side * 1.0, 0.35, rand(-1.5, 1.8), side, 3, 0.9);
    }
  }
}
function hit(strength, sx, side) {
  player.crashT = 0.8;
  G.shake = Math.min(1.4, G.shake + strength);
  G.flash = 0.5 * strength;
  G.flashCol.set(1.0, 0.12, 0.1);
  G.combo = 0;
  G.comboT = 0;
  if (G.state === 'drive') { G.crashes++; popup('Crash', 'combo lost', 'hot'); }
  emitSparks(sx, 0.6, side === 0 ? -2.2 : rand(-1, 1), side || (Math.random() < 0.5 ? -1 : 1), 26, 1.2);
  audio.crash();
}
function nearMiss(gap) {
  G.comboT = COMBO_SECONDS;
  G.combo = Math.min(G.combo + 1, MAX_COMBO);
  const pts = nearMissPoints(G.combo, gap);
  G.bonus += pts;
  G.nearMiss++;
  player.nitro = Math.min(1, player.nitro + 0.15);
  popup(gap < 0.5 ? 'Close call' : 'Near miss', '+' + pts + (G.combo > 1 ? '  ×' + G.combo : ''), 'cool');
  audio.whoosh();
}
function checkTraffic() {
  for (const v of vehicles) {
    if (v.dir < 0) continue;
    const ox = (v.halfW + P_HALF_W) - Math.abs(v.x - player.x);
    const oz = (v.len / 2 + P_HALF_L) - Math.abs(v.z);
    if (ox > 0 && oz > 0 && player.phaseT <= 0 && player.shield) {
      // Game Room: the shield takes the hit, then the car slips through.
      player.shield = false;
      player.phaseT = SHIELD_BREAK_SECONDS;
      G.flash = 0.25;
      G.flashCol.set(1.0, 0.8, 0.2);
      if (G.state === 'drive') popup('Shield', 'crash absorbed', 'cool');
      audio.whoosh();
    } else if (ox > 0 && oz > 0 && player.phaseT <= 0) {
      if (ox < oz) {
        const side = Math.sign(player.x - v.x) || 1;
        player.x += side * (ox + 0.02);
        player.vx = side * 5;
        player.v *= 0.93;
        if (player.crashT <= 0) hit(0.6, player.x - side * P_HALF_W, side);
      } else if (v.z < 0) {
        // Game Room: ran into its back. Traffic can't be shoved (both racers
        // must keep identical traffic), so the player drops back behind it.
        const nz = -(v.len / 2 + P_HALF_L + 0.3);
        dist += nz - v.z;
        v.z = nz; v.prevZ = nz; lastRel.set(v.id, nz);
        player.v = Math.max(0, Math.min(player.v, v.v - 3));
        if (player.crashT <= 0) hit(1, player.x, 0);
      } else {
        // Game Room: it caught up from behind: the player is nudged ahead of it.
        const nz = v.len / 2 + P_HALF_L + 0.3;
        dist += nz - v.z;
        v.z = nz; v.prevZ = nz; lastRel.set(v.id, nz);
        player.v = Math.max(player.v, v.v + 1);
      }
    }
    if (v.prevZ < 0 && v.z >= 0 && G.state === 'drive') {
      G.overtakes++;
      const gap = Math.abs(v.x - player.x) - v.halfW - P_HALF_W;
      // Game Room: driving through a car while phasing isn't a near miss.
      if (gap < NEAR_MISS_GAP && (player.phaseT <= 0 || gap >= 0) && player.v > NEAR_MISS_MIN_SPEED && player.crashT <= 0) nearMiss(gap);
    }
  }
}
function updateGears(dt) {
  const kmh = player.v * 3.6;
  let g = 0;
  while (g < GEAR_TOP.length - 1 && kmh > GEAR_TOP[g]) g++;
  const lo = g === 0 ? 0 : GEAR_TOP[g - 1], hi = GEAR_TOP[g];
  const frac = clamp((kmh - lo) / (hi - lo), 0, 1);
  const target = 1100 + frac * 6300 + (g === 0 ? player.throttle * 1500 : 0);
  if (g + 1 > player.gear && player.throttle > 0.5 && G.state === 'drive') { player.cut = 0.12; player.pop = 0.18; audio.pop(); }
  player.gear = g + 1;
  player.cut = Math.max(0, player.cut - dt);
  player.rpm = damp(player.rpm, target, 12, dt);
}
function updateCarVisual(dt, steerIn) {
  carRoot.position.x = player.x;
  chassis.rotation.y = damp(chassis.rotation.y, -player.vx * 0.028, 10, dt);
  body.rotation.z = damp(body.rotation.z, player.vx * 0.006, 8, dt);
  const acc = (player.v - player.lastV) / Math.max(dt, 1e-4);
  player.lastV = player.v;
  body.rotation.x = damp(body.rotation.x, clamp(acc * 0.0016, -0.03, 0.025), 6, dt);
  body.position.y = (reduceMotion ? 0 : Math.sin(G.t * 31) * 0.004 * clamp(player.v / 80, 0, 1)) + (player.crashT > 0 ? Math.sin(G.t * 60) * 0.02 * player.crashT : 0);
  player.wheelRot -= (player.v * dt) / 0.35;
  for (let i = 0; i < 4; i++) {
    wheels[i].rotation.x = player.wheelRot;
    wheels[i].rotation.y = i >= 2 ? damp(wheels[i].rotation.y, steerIn * 0.32 - player.vx * 0.02, 10, dt) : 0;
    // Game Room: the off-road truck's bigger wheels turn slower, and its body rolls and pitches like the car's.
    orWheels[i].rotation.x = (player.wheelRot * 0.35) / OR_WHEEL_R;
    orWheels[i].rotation.y = wheels[i].rotation.y;
  }
  orBody.rotation.copy(body.rotation);
  orBody.position.copy(body.position);
  if (circuit === 'desert') {
    // The wheels follow the dirt's bumps exactly; the body follows them softly, a little behind, and pitches with them.
    for (const w of orWheels) w.position.y = OR_WHEEL_R + dirtBump(dist - w.position.z);
    const front = dirtBump(dist + 1.45), rear = dirtBump(dist - 1.45);
    player.bounce = damp(player.bounce || 0, (front + rear) * 0.5, 14, dt);
    player.pitchB = damp(player.pitchB || 0, (front - rear) / 2.9, 14, dt);
    orBody.position.y += player.bounce * 1.3;
    orBody.rotation.x += player.pitchB * 1.2;
  }
  const brakeK = player.braking ? 2.3 : 1;
  tailMat.color.copy(TAIL_ON).multiplyScalar(brakeK);
  tailGlow.intensity = 1.6 * brakeK;
  player.flame = damp(player.flame, player.boosting ? 1 : 0, 12, dt);
  let pow = player.flame;
  const fu = flameMat.uniforms;
  if (player.pop > 0) {
    player.pop -= dt;
    const k = clamp(player.pop / 0.18, 0, 1) * 0.9;
    if (k > pow) { pow = k; fu.uCore.value.setRGB(6, 3.2, 1.2); fu.uEdge.value.setRGB(2.2, 0.6, 0.1); fu.uLen.value = 0.45; }
  } else {
    fu.uCore.value.setRGB(2.5, 3.2, 6.0);
    fu.uEdge.value.setRGB(0.5, 0.3, 2.2);
    fu.uLen.value = 0.55 + 0.45 * player.flame;
  }
  fu.uPower.value = pow;
  fu.uTime.value = G.t;
}
function updateLampLight() {
  if (circuit === 'desert') { lampLight.intensity = 0; return; } // Game Room: no street lamps in the desert
  let bd = 1e9, bz = 0;
  for (let i = 0; i < LAMP_N; i++) { const d = Math.abs(lampZ[i] - 0.5); if (d < bd) { bd = d; bz = lampZ[i]; } }
  lampLight.position.set(LAMP_OUR_X, LAMP_Y - 0.4, bz);
  lampLight.intensity = 2.6 * Math.exp(-(bd * bd) / 160);
}
function updateStreaks() {
  streakN = 0;
  const bk = (player.braking ? 1.8 : 1) * (1 + 0.6 * rainK); // Game Room: a wet road reflects more
  for (const s of [-0.72, 0.72]) addStreak(player.x + s, 0.76, 2.3, 0.45 * bk, 0.015 * bk, 0.025 * bk, 0.45);
  for (const v of vehicles) {
    const fade = smooth(-900, -560, v.z);
    if (fade <= 0) continue;
    if (v.dir > 0) {
      const k = 0.3 * fade * (1 + v.brake * 0.8) * (1 + 0.6 * rainK);
      const truckish = v.kind === 'truck';
      const off = truckish ? 1.0 : 0.62;
      const y = truckish ? 1.25 : 0.78 * v.sy;
      const zz = v.z + (truckish ? 7.24 : 2.42);
      addStreak(v.x - off, y, zz, k, k * 0.03, k * 0.05);
      addStreak(v.x + off, y, zz, k, k * 0.03, k * 0.05);
    } else if (circuit !== 'desert') {
      const k = 0.22 * fade;
      for (const s of [-0.62, 0.62]) addStreak(v.x + s, 0.66 * v.sy, v.z + 2.42, k * 0.92, k * 0.95, k);
    }
  }
  streakMesh.count = streakN;
  streakMesh.instanceMatrix.needsUpdate = true;
  streakMesh.instanceColor.needsUpdate = true;
}

// ---------- camera ----------
const camPos = new THREE.Vector3(0, 2.5, 8.6);
const camLook = new THREE.Vector3(0, 1, -30);
const _vpDir = new THREE.Vector3();
function updateCamera(dt) {
  const speedK = clamp(player.v / 90, 0, 1);
  const boostK = player.flame;
  let fov = 58;
  let blurScale = 1;
  const driving = G.state === 'drive' || G.state === 'countdown';
  if (driving) {
    const c = CAMS[camMode];
    camPos.x = damp(camPos.x, player.x * (c.inside ? 1 : 0.8) + (c.inside ? 0 : player.vx * 0.05), c.inside ? 40 : 5, dt);
    camPos.y = c.h + (c.inside ? 0 : speedK * 0.2);
    camPos.z = c.dist + (c.inside ? 0 : speedK * 1.3 + boostK * 0.9);
    camLook.set(player.x * 0.9 + player.vx * 0.15 + bendAt(BEND.nhBend.value, c.look), c.lookH, -c.look);
    fov = c.fov + speedK * 8 + boostK * 7;
  } else {
    G.shotT -= dt;
    if (G.shotT <= 0) { G.shot = (G.shot + 1) % 4; G.shotT = 6.5; }
    const px = player.x;
    const sway = Math.sin(G.t * 0.25);
    if (G.shot === 0) { camPos.set(px * 0.8, 1.75, 13); camLook.set(px + bendAt(BEND.nhBend.value, 42), 1.7, -42); fov = 46; }
    else if (G.shot === 1) { camPos.set(px + 3.0 + sway * 0.3, 0.85, -7.6); camLook.set(px, 0.75, 0.2); fov = 50; blurScale = 0.5; }
    else if (G.shot === 2) { camPos.set(px - 5.6, 1.05, -0.4 + sway); camLook.set(px, 0.7, 0.4); fov = 48; blurScale = 0.6; }
    else { camPos.set(px * 0.6 + sway * 2, 6.2, 16); camLook.set(px, 0.6, -24); fov = 50; }
  }
  let sx = 0, sy = 0;
  if (!reduceMotion) {
    const amp = speedK * speedK * 0.025 + G.shake * 0.18 + boostK * 0.02 + (circuit === 'desert' ? speedK * 0.05 : 0); // Game Room: dirt rumbles
    sx = (Math.random() - 0.5) * amp;
    sy = (Math.random() - 0.5) * amp;
  }
  // Game Room: the camera rides the hills, and looks up or down the road with them.
  const hills = BEND.nhHill.value;
  const jolt = circuit === 'desert' && driving ? (player.bounce || 0) * 0.9 : 0;
  camera.position.set(camPos.x + sx, camPos.y + sy + jolt + bendAt(hills, -camPos.z), camPos.z);
  camera.lookAt(camLook.x, camLook.y + bendAt(hills, -camLook.z), camLook.z);
  if (driving) camera.rotateZ(-player.vx * 0.0035);
  else if (camera.aspect > 1.2) camera.rotateY(0.13);
  if (camera.aspect < 1.3) fov = Math.min(88, fov * lerp(1.45, 1, clamp((camera.aspect - 0.45) / 0.85, 0, 1)));
  camera.fov = damp(camera.fov, fov, 4, dt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return blurScale;
}
function updatePost(blurScale) {
  const cu = compositeMat.uniforms;
  _vpDir.set(0, 0, -1).transformDirection(camera.matrixWorldInverse);
  let dx = _vpDir.x, dy = _vpDir.y, dz = _vpDir.z;
  if (dz > 0) { dx = -dx; dy = -dy; dz = -dz; }
  const f = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const iz = 1 / Math.max(-dz, 0.02);
  cu.uVP.value.set(0.5 + 0.5 * clamp((f / camera.aspect) * dx * iz, -60, 60), 0.5 + 0.5 * clamp(f * dy * iz, -60, 60));
  const speedK = clamp((player.v - 12) / 78, 0, 1);
  cu.uBlur.value = (reduceMotion ? 0.3 : 1) * blurScale * (0.032 * speedK * speedK + 0.022 * player.flame);
  cu.uSamples.value = qScale < 0.85 ? 6 : 9;
  cu.uAberr.value = 0.003 + 0.006 * speedK + 0.01 * player.flame;
  cu.uTime.value = G.t;
  cu.uFlash.value.copy(G.flashCol).multiplyScalar(G.flash);
}

// ---------- HUD ----------
const hudCache = {};
function setText(el, key, val) { if (hudCache[key] !== val) { hudCache[key] = val; el.textContent = val; } }
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
function updateHUD() {
  if (HUD.hud.hidden) return;
  const kmh = Math.round(player.v * 3.6);
  setText(HUD.speed, 'speed', String(kmh));
  setText(HUD.gear, 'gear', String(player.gear));
  HUD.arc.style.strokeDashoffset = (314.16 * (1 - clamp(kmh / 360, 0, 1))).toFixed(1);
  HUD.nitro.style.transform = 'scaleX(' + player.nitro.toFixed(3) + ')';
  HUD.speedo.classList.toggle('boost', player.boosting);
  HUD.speedo.classList.toggle('redline', !player.boosting && kmh > 290);
  const tl = Math.max(0, G.time);
  setText(HUD.clock, 'clock', tl.toFixed(1));
  HUD.timefill.style.transform = 'scaleX(' + (tl / 60).toFixed(4) + ')';
  const late = G.state === 'drive' && tl < 10;
  HUD.clock.classList.toggle('late', late);
  HUD.timebar.classList.toggle('late', late);
  setText(HUD.score, 'score', fmt(G.score));
  setText(HUD.dist, 'dist', (G.distRun / 1000).toFixed(2));
  setText(HUD.nm, 'nm', String(G.nearMiss));
  if (HUD.power) {
    const parts = [];
    if (player.phaseT > 0) parts.push('Phase ' + player.phaseT.toFixed(1) + ' s');
    if (player.shield) parts.push('Shield up');
    setText(HUD.power, 'power', parts.join('  ·  '));
  }
  if (HUD.opp) {
    const latest = G.race && opponent ? opponent.latest() : undefined;
    let line = '';
    if (latest && latest.race === G.race.race) {
      const gap = Math.round(latest.s - dist);
      line = opponent.name + '  ' + fmt(latest.score) + '  ·  ' + (Math.abs(gap) < 3 ? 'side by side' : Math.abs(gap) + ' m ' + (gap > 0 ? 'ahead' : 'behind'));
    }
    setText(HUD.opp, 'opp', line);
  }
}

// ---------- flow ----------
function showTitle() {
  G.state = 'title';
  G.shot = 0;
  G.shotT = 6.5;
  if (HUD.title) HUD.title.hidden = false;
  if (HUD.results) HUD.results.hidden = true;
  HUD.hud.hidden = true;
  HUD.touch.hidden = true;
  if (HUD.bestLine) HUD.bestLine.textContent = G.best > 0 ? 'Best run on this device: ' + fmt(G.best) : '';
}
function resetRunStats() {
  Object.assign(G, { state: 'countdown', cd: COUNTDOWN_SECONDS, lastCd: COUNTDOWN_SECONDS + 1, time: RUN_SECONDS, score: 0, bonus: 0, distRun: 0, nearMiss: 0, overtakes: 0, crashes: 0, top: 0, sumV: 0, sumT: 0, combo: 0, comboT: 0, hintT: 9, liveT: 0, pickups: 0 });
}
function startRun() {
  audio.init();
  resetRunStats();
  resetPickups(randomSeed());
  // Solo runs start where the car already is: pickups lay out from there on.
  pickupBase = dist;
  roadSeed = randomSeed();
  togglePause(false);
  player.nitro = 1;
  player.crashT = 0;
  if (player.v < 28) player.v = 30;
  showRunHud();
}
// Game Room: a race's countdown begins (or this device joins it late, e.g.
// after a reload): fresh stats, the race's traffic, and the car on the grid
// in its lane - or where the countdown would have taken it by now.
function beginRaceCountdown(R, rt) {
  audio.init();
  resetRunStats();
  togglePause(false);
  dist = COUNTDOWN_SPEED * Math.max(0, rt);
  newTraffic(R.seed, 'fixed');
  // A race's pickups come from its seed too (mixed, so they don't track the traffic).
  resetPickups(R.seed ^ 0x5bd1e995);
  pickupBase = 0;
  // ...and so do its curves: both racers drive the same road.
  roadSeed = (R.seed ^ 0x1b873593) >>> 0;
  trafficClock = Math.max(0, rt);
  traffic.advanceTo(trafficClock);
  player.x = player.ap = LANES[R.lane];
  player.vx = 0;
  player.v = COUNTDOWN_SPEED;
  player.nitro = 1;
  player.crashT = 0;
  showRunHud();
}
function showRunHud() {
  if (runOptions().rain) popup('Rain', 'wet road · the car slides', 'cool');
  if (HUD.title) HUD.title.hidden = true;
  if (HUD.results) HUD.results.hidden = true;
  HUD.hud.hidden = false;
  HUD.hud.classList.toggle('off', G.hudOff);
  HUD.touch.hidden = !coarse;
  HUD.hint.style.opacity = '1';
  try { canvas.focus({ preventScroll: true }); } catch { /* focus is optional */ }
}
function runResult() {
  return {
    score: Math.floor(G.score),
    distance: Math.round(G.distRun),
    top: Math.round(G.top),
    avg: Math.round(G.sumT > 0 ? (G.sumV / G.sumT) * 3.6 : 0),
    nearMiss: G.nearMiss,
    overtakes: G.overtakes,
    crashes: G.crashes,
  };
}
function endRun() {
  G.state = 'end';
  G.shot = 0;
  G.shotT = 7;
  if (G.race) {
    // Game Room: the race is over for this device - report, then back to the
    // cinematic cameras on fresh local traffic while the page shows results.
    const R = G.race;
    sendLive(R, COUNTDOWN_SECONDS + RUN_SECONDS);
    lastFinishedRace = R.race;
    G.race = null;
    newTraffic(randomSeed(), 'recycle');
    ghostRoot.visible = false;
    HUD.hud.hidden = true;
    HUD.touch.hidden = true;
    for (const k in keys) keys[k] = false;
    if (R.onFinish) R.onFinish(runResult());
    return;
  }
  const score = Math.floor(G.score);
  const prev = G.best;
  const isBest = score > prev;
  if (isBest) { G.best = score; store.set('best', score); }
  $('resKicker').textContent = isBest ? 'New best run' : 'Run complete';
  $('resScore').textContent = fmt(score);
  const rb = $('resBest');
  rb.textContent = isBest ? (prev > 0 ? 'Previous best ' + fmt(prev) : 'First run on this device') : 'Best ' + fmt(G.best);
  rb.classList.toggle('new', isBest);
  $('rDist').textContent = (G.distRun / 1000).toFixed(2);
  $('rTop').textContent = String(Math.round(G.top));
  $('rAvg').textContent = String(Math.round(G.sumT > 0 ? (G.sumV / G.sumT) * 3.6 : 0));
  $('rNm').textContent = String(G.nearMiss);
  $('rOv').textContent = String(G.overtakes);
  $('rCr').textContent = String(G.crashes);
  HUD.hud.hidden = true;
  HUD.touch.hidden = true;
  HUD.results.hidden = false;
  for (const k in keys) keys[k] = false;
}
function togglePause(on) {
  if (on === G.paused) return;
  G.paused = on;
  HUD.pause.hidden = !on;
  if (on) audio.suspend(); else audio.resume();
}
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  } catch { /* fullscreen is not allowed here */ }
}

function sendLive(R, rt) {
  if (!R.onLive) return;
  const r2 = (n) => Math.round(n * 100) / 100;
  R.onLive({ race: R.race, t: Math.round(rt * 1000), s: r2(dist), x: r2(player.x), v: r2(player.v), score: Math.floor(G.score), paint: paintIdx });
}
const GHOST_DELAY_MS = 150;
let ghostLastX = 0;
function updateGhost(dt, rt) {
  let show = false;
  if (raceLive() && opponent) {
    const p = opponent.sample(rt * 1000 - GHOST_DELAY_MS);
    const latest = opponent.latest();
    if (p) {
      const z = dist - p.s;
      if (z > -900 && z < 60) {
        show = true;
        ghostRoot.position.set(p.x, 0, z);
        ghostLabel.position.x = bendAt(BEND.nhBend.value, -z); // sprites don't go through the bend
        ghostLabel.position.y = 2.15 + bendAt(BEND.nhHill.value, -z); // ...or the hills
        ghostChassis.rotation.y = damp(ghostChassis.rotation.y, -clamp((p.x - ghostLastX) / Math.max(dt, 1e-3), -10, 10) * 0.028, 10, dt);
        for (const w of ghostWheels) w.rotation.x -= (p.v * dt) / 0.35;
      }
      ghostLastX = p.x;
    }
    if (latest && Number.isInteger(latest.paint)) ghostPaint.color.copy(lin(PAINTS[mod(latest.paint, PAINTS.length)].hex));
  }
  ghostRoot.visible = show;
}

function update(dt) {
  G.t += dt;
  setCircuit(shownOptions().desert ? 'desert' : 'city');
  let steerIn = 0;
  // Game Room: in a race the clock, not the frame count, drives the countdown and the run.
  const R = G.race;
  const rt = R ? (R.serverNow() - R.startAt) / 1000 : 0;
  if (R && !raceLive() && rt >= 0 && rt < COUNTDOWN_SECONDS + RUN_SECONDS) beginRaceCountdown(R, rt);
  if (G.state === 'drive') {
    steerIn = drive(dt);
    G.time = R ? COUNTDOWN_SECONDS + RUN_SECONDS - rt : G.time - dt;
    if (G.time <= 0) { G.time = 0; endRun(); }
  } else if (G.state === 'countdown') {
    if (R) {
      // Both racers cruise side by side in their own lanes until "Go".
      player.x = player.ap = LANES[R.lane];
      player.vx = 0;
      player.v = COUNTDOWN_SPEED;
      player.throttle = damp(player.throttle, 0.6, 6, dt);
      player.boosting = false;
      player.braking = 0;
      G.cd = COUNTDOWN_SECONDS - rt;
    } else {
      autopilot(dt, 31);
      G.cd -= dt;
    }
    const n = Math.ceil(G.cd);
    if (n !== G.lastCd && n > 0) { G.lastCd = n; showCount(String(n)); audio.beep(440, 0.12); }
    if (G.cd <= 0) {
      G.state = 'drive';
      showCount('Go', true);
      audio.beep(880, 0.25);
      G.flash = 0.25;
      G.flashCol.set(0.5, 0.6, 1.0);
    }
  } else {
    autopilot(dt, G.state === 'end' ? 33 : 40);
  }
  contactBarriers(dt, steerIn);
  player.crashT = Math.max(0, player.crashT - dt);
  updateGears(dt);
  const pv = player.v;
  if (G.race && G.state === 'countdown') dist = COUNTDOWN_SPEED * Math.max(0, rt);
  else dist += pv * dt;
  if (raceLive()) {
    trafficClock = Math.max(trafficClock, rt);
    traffic.advanceTo(trafficClock);
    G.liveT -= dt;
    if (G.liveT <= 0) { G.liveT = LIVE_INTERVAL_MS / 1000; sendLive(G.race, rt); }
  }
  if (G.state === 'drive') {
    G.distRun += pv * dt;
    G.sumV += pv * dt;
    G.sumT += dt;
    G.top = Math.max(G.top, pv * 3.6);
    if (player.phaseT <= 0) G.comboT -= dt; // Game Room: phasing protects the combo
    if (G.comboT <= 0) G.combo = 0;
    G.score = G.distRun + G.bonus;
    if (G.hintT > 0) { G.hintT -= dt; if (G.hintT <= 0) HUD.hint.style.opacity = '0'; }
  }
  updateTraffic(dt, pv);
  checkTraffic();
  fillBendTable(roadSeed, dist, BEND.nhBend.value);
  for (let i = 0; i < BEND_SAMPLES; i++) BEND.nhBend.value[i] *= BEND_EXAGGERATION;
  if (circuit === 'desert') fillHillTable(roadSeed, dist, BEND.nhHill.value);
  updateGhost(dt, rt);
  updatePickups(dt);
  updateSand(dt);
  updateWorld(dt);
  writeTraffic();
  updateCarVisual(dt, steerIn);
  updateSparks(dt, pv);
  if (circuit === 'desert') updateDust(dt, pv);
  updateWind(dt, pv, player.x, player.flame);
  updateRain(dt, pv, player.x);
  updateLampLight();
  G.shake = damp(G.shake, 0, 3.5, dt);
  G.flash = damp(G.flash, 0, 5, dt);
  const blurScale = updateCamera(dt);
  updateStreaks();
  updatePost(blurScale);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  skyline.position.x = camera.position.x;
  skyline.position.z = camera.position.z;
  skyMat.uniforms.uTime.value = G.t;
  stars.material.uniforms.uTime.value = G.t;
  stars.material.uniforms.uPR.value = renderer.getPixelRatio();
  audio.update(player.rpm, player.throttle, pv, player.flame, player.scrape, rainK);
  updateHUD();
}

// ---------- input ----------
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'boost' };
const HOTKEYS = ['KeyV', 'KeyC', 'KeyL', 'KeyM', 'KeyH', 'KeyP', 'Escape', 'KeyR', 'KeyF', 'Enter', 'NumpadEnter'];
// Game Room: the page has text fields (the name, the room name) - keys typed
// there are text, not driving or hotkeys, and must keep their default action.
function isTyping(target) {
  return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
listen(window, 'keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTyping(e.target)) return;
  const code = e.code;
  const k = KEYMAP[code];
  const idle = !RACE_MODE && (G.state === 'title' || G.state === 'end');
  if (k || HOTKEYS.includes(code)) e.preventDefault();
  if (!e.repeat && (code === 'Enter' || code === 'NumpadEnter' || (code === 'Space' && idle))) {
    if (idle) { startRun(); return; }
    if (G.paused) { togglePause(false); return; }
  }
  if (k) keys[k] = true;
  if (e.repeat) return;
  audio.resume();
  switch (code) {
    case 'KeyV':
      camMode = (camMode + 1) % CAMS.length;
      store.set('cam', camMode);
      popup(CAMS[camMode].name + ' camera');
      break;
    case 'KeyC':
      setPaint(paintIdx + 1);
      store.set('paint', paintIdx);
      popup(PAINTS[paintIdx].name);
      break;
    case 'KeyL':
      glowIdx = (glowIdx + 1) % GLOW.length;
      store.set('glow', glowIdx);
      applyGlow();
      popup(GLOW[glowIdx].name);
      break;
    case 'KeyM':
      audio.init();
      audio.setEnabled(!audio.enabled);
      popup(audio.enabled ? 'Sound on' : 'Sound off');
      break;
    case 'KeyH':
      G.hudOff = !G.hudOff;
      HUD.hud.classList.toggle('off', G.hudOff);
      break;
    case 'KeyP':
    case 'Escape':
      if (!G.race && (G.state === 'drive' || G.state === 'countdown')) togglePause(!G.paused);
      break;
    case 'KeyR':
      if (!RACE_MODE && G.state !== 'title' && G.state !== 'boot') startRun();
      break;
    case 'KeyF':
      toggleFullscreen();
      break;
    default:
      break;
  }
});
listen(window, 'keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
listen(window, 'blur', () => {
  for (const k in keys) keys[k] = false;
  if (G.state === 'drive' && !G.race) togglePause(true);
});
listen(document, 'visibilitychange', () => {
  if (document.hidden) audio.suspend(); else if (!G.paused) audio.resume();
});
listen($('startBtn'), 'click', startRun);
// Game Room: the title card's Pickups / Rain / Desert switches (solo), remembered on this device.
const SOLO_SWITCHES = [[HUD.optRain, 'rain'], [HUD.optPickups, 'pickups'], [HUD.optDesert, 'desert']];
function showSoloOptions() {
  for (const [el, key] of SOLO_SWITCHES) if (el) el.setAttribute('aria-checked', String(!!soloOptions[key]));
}
for (const [el, key] of SOLO_SWITCHES) {
  listen(el, 'click', () => {
    soloOptions = { ...soloOptions, [key]: !soloOptions[key] };
    store.set('options', soloOptions);
    showSoloOptions();
  });
}
showSoloOptions();
listen($('againBtn'), 'click', startRun);
listen(HUD.pause, 'click', () => togglePause(false));
listen(canvas, 'pointerdown', () => {
  try { canvas.focus({ preventScroll: true }); } catch { /* focus is optional */ }
  audio.resume();
});
for (const btn of root.querySelectorAll('.tbtn')) {
  const k = btn.dataset.k;
  const off = () => { keys[k] = false; btn.classList.remove('on'); };
  listen(btn, 'pointerdown', (e) => {
    e.preventDefault();
    keys[k] = true;
    btn.classList.add('on');
    try { btn.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
  });
  listen(btn, 'pointerup', off);
  listen(btn, 'pointercancel', off);
  listen(btn, 'lostpointercapture', off);
}

// ---------- loop ----------
let ftAvg = 16, qTimer = 0, last = 0;
function adaptQuality(ms) {
  ftAvg = lerp(ftAvg, ms, 0.05);
  qTimer += ms;
  if (qTimer < 2500) return;
  qTimer = 0;
  if (ftAvg > 24 && qScale > 0.6) { qScale = Math.max(0.6, qScale * 0.85); resize(); }
  else if (ftAvg < 13 && qScale < 1) { qScale = Math.min(1, qScale * 1.1); resize(); }
}
let rafId = 0;
let destroyed = false;
function frame(now) {
  if (destroyed) return;
  rafId = requestAnimationFrame(frame);
  const ms = now - last;
  last = now;
  if (G.paused) return;
  // Game Room: a race runs on the shared clock, so a slow frame is made up in
  // 50 ms sub-steps instead of being dropped (the original's cap) - otherwise a
  // device drawing under 20 fps would simply cover less road in its 60 seconds.
  let left = Math.min(ms / 1000, G.race ? 0.25 : 0.05);
  while (left > 1e-6) {
    const step = Math.min(left, 0.05);
    update(step);
    left -= step;
  }
  renderFrame();
  adaptQuality(Math.min(ms, 100));
}

let booted = false;
function boot(data) {
  if (booted) return;
  booted = true;
  if (data && typeof data === 'object') {
    if (Number.isInteger(data.paint)) setPaint(data.paint);
    if (Number.isInteger(data.cam)) camMode = mod(data.cam, CAMS.length);
  }
  if (coarse) root.classList.add('touch');
  resize();
  listen(window, 'resize', resize);
  try {
    update(1 / 60);
    // Game Room: compile the other circuit's shaders now too (and the desert's
    // truck), so the first switch doesn't stall a frame compiling them.
    const hidden = [...cityObjs, ...desertObjs, ...chassis.children, ...ghostChassis.children].filter((o) => !o.visible);
    for (const o of hidden) o.visible = true;
    renderer.compile(scene, camera);
    for (const o of hidden) o.visible = false;
    renderFrame();
  } catch {
    fatal('The graphics engine hit an error while starting. Reloading the page usually fixes it.');
    return;
  }
  bootEl.hidden = true;
  showTitle();
  rafId = requestAnimationFrame((t) => { last = t; frame(t); });
  if (options.onReady) options.onReady();
}

// Game Room: the page drives the engine through this API (see ./engine.d.ts).
const api = {
  /** Solo: starts a run from the title or results screen. */
  startSolo() { if (G.state === 'title' || G.state === 'end') startRun(); },
  /** Race: drives the race described by `race` (its countdown begins at `startAt` on the server's clock). */
  startRace(race) { if (race.race > lastFinishedRace && (!G.race || G.race.race !== race.race)) G.race = race; },
  /** Race: abandons the current race (e.g. the room was reset), back to the cinematic cameras. */
  stopRace() {
    if (!G.race) return;
    G.race = null;
    if (G.state === 'countdown' || G.state === 'drive') {
      G.state = 'title';
      newTraffic(randomSeed(), 'recycle');
      HUD.hud.hidden = true;
      HUD.touch.hidden = true;
    }
    ghostRoot.visible = false;
  },
  /** Race: who the other racer is, and where their car is (`sample(raceMs)`), or null. */
  setOpponent(o) { opponent = o; setGhostName(o ? o.name : ''); },
  /** Race page: the next race's switches, shown on the road between races (rain falls in the lobby). */
  setOptions(o) { previewOptions = { ...DEFAULT_OPTIONS, ...o }; },
  /** A fingerprint of the traffic right now - two devices in the same race should agree. */
  trafficChecksum() { return traffic.checksum(); },
  /** Test hook: the traffic a race with this seed has at this time (s), simulated from scratch in this browser - two browsers must agree. */
  raceTrafficChecksum(seed, time) { const sim = new TrafficSim(seed, 'fixed'); sim.advanceTo(time, 0, 1e6); return sim.checksum(); },
  destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    for (const off of cleanups.splice(0)) off();
    if (audio.ctx) audio.ctx.close().catch(() => {});
    [sceneRT, maskRT].concat(downRT, upRT, flareRT).forEach((r) => r.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    if (window.NightHighway === api) delete window.NightHighway;
  },
};
if (options.exposeForTests) {
  window.NightHighway = Object.assign(api, {
    G, player, keys,
    // Test hooks: skip down the road, and read the curve where the car is / ahead of it.
    jump(metres) { dist += metres; },
    curvature() { return curvatureAt(roadSeed, dist); },
    bend(ahead) { return bendAt(BEND.nhBend.value, ahead); },
    rain() { return { k: rainK, visible: rainMesh.visible }; },
    // ...the circuit shown, and the road's height (m) `ahead` of the car relative to it.
    circuit() { return circuit; },
    // ...and the same-direction traffic in sight (a jeep has an even id, a pickup an odd one, in the desert).
    traffic() { return vehicles.filter((v) => v.dir > 0 && v.z !== HIDDEN_Z).map((v) => ({ kind: v.kind, id: v.id, x: v.x, z: v.z, v: v.v })); },
    hill(ahead) { return bendAt(BEND.nhHill.value, ahead); },
    // ...whether the car is in deep sand, and the patches ahead (s and x relative to the run).
    sand() { const d = dist - pickupBase; return { inSand: !!player.inSand, at: d, shown: sandMeshes.filter((m) => m.visible).map((m) => [+m.position.x.toFixed(1), +m.position.z.toFixed(1), +m.scale.x.toFixed(1), +m.scale.z.toFixed(1)]), group: sandGroup.visible, patches: sandBetween(sandSeed, d, d + 1500).map((p) => ({ ...p, ...sandSpan(p) })) }; },
  });
}
// Game Room: curves - bend every built-in material (and the motion-blur mask's),
// and stop culling, since objects are drawn away from where three thinks they are.
scene.traverse((o) => {
  for (const m of [].concat(o.material || [])) bendMaterial(m);
  o.frustumCulled = false;
});
bendMaterial(maskMat);
boot({});
return api;
}
