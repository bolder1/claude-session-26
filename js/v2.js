/* v2.js — soft-3D specimen kit for the Claude Session '26 home page.
   ONE shared WebGL renderer draws every specimen into its own scissor region,
   so a dozen objects share a single GL context. Same render family as the GLB
   cold-open: ACESFilmic tone mapping + RoomEnvironment studio reflections +
   clearcoat (semi-gloss soft-touch, two high-gloss accents).
   Pointer-reactive + gentle idle float; respects prefers-reduced-motion;
   silent no-op (CSS fallback shows) if WebGL is unavailable. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer:fine)').matches;
const TAU = Math.PI * 2;

/* ---------------- shared material library (one renderer → reuse freely) -------- */
function materials() {
  return {
    orange:      new THREE.MeshPhysicalMaterial({ color: 0xff5a0a, roughness: 0.40, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.22, envMapIntensity: 1.0 }),
    orangeGloss: new THREE.MeshPhysicalMaterial({ color: 0xff6412, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25 }),
    cream:       new THREE.MeshPhysicalMaterial({ color: 0xeae0c8, roughness: 0.60, metalness: 0, clearcoat: 0.30, clearcoatRoughness: 0.40, envMapIntensity: 0.6 }),
    screen:      new THREE.MeshPhysicalMaterial({ color: 0x181106, roughness: 0.09, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 }),
    metal:       new THREE.MeshStandardMaterial({ color: 0xc7b89a, roughness: 0.34, metalness: 0.6, envMapIntensity: 1.0 }),
    teal:        new THREE.MeshPhysicalMaterial({ color: 0x1f7a73, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.0 }),
    glow:        new THREE.MeshStandardMaterial({ color: 0xffe6c4, emissive: 0xffb866, emissiveIntensity: 0.7, roughness: 0.35 }),
    ink:         new THREE.MeshStandardMaterial({ color: 0x2a1206, roughness: 0.5 }),
    ghost:       new THREE.MeshPhysicalMaterial({ color: 0xd2e7e4, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.36, envMapIntensity: 1.0 }),
  };
}

function rbox(w, h, d, r, mat) {
  const rr = Math.min(r, Math.min(w, h, d) * 0.5 * 0.92);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, rr), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function torusArc(R, t, arc, mat) {
  return new THREE.Mesh(new THREE.TorusGeometry(R, t, 16, 60, arc), mat);
}

/* ---------------- per-section object builders --------------------------------- */
/* the cover specimen — a glossy toy-terminal with a soft half-awake face */
function hero(M) {
  const g = new THREE.Group();
  const base = rbox(1.55, 0.16, 0.95, 0.07, M.cream); base.position.y = -1.18; g.add(base);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.52, 24), M.metal); stand.position.y = -0.85; stand.castShadow = true; g.add(stand);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 20), M.metal); hinge.rotation.z = Math.PI / 2; hinge.position.y = -0.6; hinge.castShadow = true; g.add(hinge);
  const body = rbox(2.7, 2.0, 0.5, 0.2, M.orange); body.position.y = 0.36; g.add(body);
  const scr = rbox(2.16, 1.46, 0.46, 0.1, M.screen); scr.position.set(0, 0.42, 0.07); g.add(scr);
  const fz = 0.33;
  // friendlier face: two round eyes + small smile-ish worried mouth, all glowing
  const eyeGeo = new THREE.SphereGeometry(0.13, 24, 24);
  const eL = new THREE.Mesh(eyeGeo, M.glow); eL.scale.set(1, 1, 0.5); eL.position.set(-0.42, 0.6, fz); g.add(eL);
  const eR = new THREE.Mesh(eyeGeo, M.glow); eR.scale.set(1, 1, 0.5); eR.position.set(0.42, 0.6, fz); g.add(eR);
  // sleepy half-lid over the right eye
  const lid = torusArc(0.17, 0.03, Math.PI, M.ink); lid.position.set(0.42, 0.62, fz + 0.04); g.add(lid);
  // small worried mouth
  const mouth = torusArc(0.2, 0.032, Math.PI * 0.6, M.glow); mouth.position.set(0.02, 0.06, fz); mouth.rotation.z = Math.PI * 0.7; g.add(mouth);
  // floating "brief" note
  const note = rbox(0.84, 0.84, 0.05, 0.05, M.cream); note.position.set(1.82, 1.04, 0.22); note.rotation.z = -0.17; g.add(note);
  const line = rbox(0.5, 0.07, 0.02, 0.03, M.orangeGloss); line.position.set(1.74, 0.82, 0.26); line.rotation.z = -0.17; g.add(line);
  return g;
}

/* premise trio — one blank slate, one dissolving memory, one 70% ring */
function ctx(M) {
  const g = new THREE.Group();
  const tray = rbox(1.7, 0.2, 1.15, 0.1, M.cream); tray.position.y = -0.5; g.add(tray);
  const well = rbox(1.3, 0.08, 0.8, 0.06, M.screen); well.position.y = -0.38; g.add(well);
  // floating question mark
  const q = new THREE.Group();
  const hook = torusArc(0.3, 0.1, Math.PI * 1.35, M.orangeGloss); hook.rotation.z = -Math.PI * 0.32; hook.position.y = 0.62; q.add(hook);
  const stem = rbox(0.1, 0.34, 0.1, 0.05, M.orangeGloss); stem.position.set(0.02, 0.18, 0); q.add(stem);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), M.orangeGloss); dot.position.set(0.02, -0.12, 0); q.add(dot);
  q.position.y = 0.35; g.add(q);
  g.userData.spin = q;
  return g;
}
function mem(M) {
  const g = new THREE.Group();
  const card = rbox(1.4, 1.7, 0.12, 0.07, M.cream); card.rotation.z = -0.04; g.add(card);
  // a few "text" bars fading
  const ys = [0.5, 0.2, -0.1, -0.4];
  ys.forEach((y, i) => { const b = rbox(0.9 - i * 0.12, 0.1, 0.04, 0.03, i < 2 ? M.ink : M.ghost); b.position.set(-0.12, y, 0.08); b.rotation.z = -0.04; g.add(b); });
  // top-right corner dissolving into floating cubes
  const cubes = [[0.62, 0.92, 0.18], [0.8, 1.05, 0.06], [0.95, 0.82, 0.3], [1.05, 1.12, 0.22]];
  cubes.forEach((p, i) => { const c = rbox(0.2 - i * 0.02, 0.2 - i * 0.02, 0.2 - i * 0.02, 0.05, i === 0 ? M.cream : M.orangeGloss); c.position.set(p[0], p[1], p[2]); c.rotation.set(0.4 * i, 0.3 * i, 0.2 * i); g.add(c); });
  return g;
}
function taste(M) {
  const g = new THREE.Group();
  const done = torusArc(0.78, 0.24, TAU * 0.7, M.orangeGloss); g.add(done);
  const rest = torusArc(0.78, 0.2, TAU * 0.3, M.ghost); rest.rotation.z = TAU * 0.7; g.add(rest);
  g.rotation.x = -0.35; g.rotation.z = 0.2;
  return g;
}

/* method trio (dark spread) — brief card, producing stack, judgment check */
function brief(M) {
  const g = new THREE.Group();
  const card = rbox(1.5, 1.85, 0.12, 0.07, M.cream); g.add(card);
  const bar = rbox(1.5, 0.34, 0.14, 0.06, M.orangeGloss); bar.position.set(0, 0.74, 0.0); g.add(bar);
  const ys = [0.34, 0.08, -0.18, -0.44];
  ys.forEach((y, i) => {
    const b = rbox(0.78, 0.08, 0.04, 0.03, M.ink); b.position.set(0.08, y, 0.07); g.add(b);
    const tick = rbox(0.12, 0.12, 0.05, 0.04, M.glow); tick.position.set(-0.5, y, 0.08); g.add(tick);
  });
  return g;
}
function produce(M) {
  const g = new THREE.Group();
  const back = rbox(1.5, 1.05, 0.08, 0.06, M.ghost); back.position.set(-0.34, -0.16, -0.3); back.rotation.z = 0.12; g.add(back);
  const mid = rbox(1.55, 1.1, 0.09, 0.06, M.cream); mid.position.set(-0.1, 0.04, -0.05); mid.rotation.z = 0.05; g.add(mid);
  const front = rbox(1.6, 1.15, 0.1, 0.06, M.orangeGloss); front.position.set(0.2, 0.26, 0.25); front.rotation.z = -0.03; g.add(front);
  const img = rbox(0.5, 0.4, 0.06, 0.04, M.screen); img.position.set(-0.1, 0.36, 0.32); g.add(img);
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), M.glow); spark.position.set(1.0, 0.85, 0.4); g.add(spark);
  return g;
}
function judge(M) {
  const g = new THREE.Group();
  const panel = rbox(1.7, 1.15, 0.1, 0.07, M.cream); panel.position.set(-0.1, -0.1, 0); panel.rotation.z = -0.05; g.add(panel);
  // big approval check
  const c = new THREE.Group();
  const sh = rbox(0.55, 0.2, 0.2, 0.09, M.orangeGloss); sh.rotation.z = 0.9; sh.position.set(-0.28, -0.1, 0); c.add(sh);
  const lo = rbox(1.05, 0.2, 0.2, 0.09, M.orangeGloss); lo.rotation.z = -0.6; lo.position.set(0.22, 0.18, 0); c.add(lo);
  c.position.set(0.25, 0.25, 0.4); g.add(c);
  g.userData.spin = c;
  return g;
}

/* host — a small workstation vignette */
function host(M) {
  const g = new THREE.Group();
  const desk = rbox(2.7, 0.2, 1.25, 0.09, M.cream); desk.position.y = -0.7; g.add(desk);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 20), M.metal); stand.position.y = -0.45; stand.castShadow = true; g.add(stand);
  const body = rbox(1.7, 1.2, 0.16, 0.1, M.orange); body.position.y = 0.2; g.add(body);
  const scr = rbox(1.42, 0.92, 0.12, 0.06, M.screen); scr.position.set(0, 0.24, 0.07); g.add(scr);
  [0.45, 0.2, -0.05].forEach((y, i) => { const l = rbox(0.9 - i * 0.18, 0.07, 0.03, 0.03, M.glow); l.position.set(-0.12, y, 0.12); g.add(l); });
  const chips = [M.orangeGloss, M.teal, M.cream];
  chips.forEach((m, i) => { const c = rbox(0.34, 0.34, 0.1, 0.05, m); c.position.set(-0.7 + i * 0.55, -0.55, 0.45); c.rotation.x = -0.5; g.add(c); });
  return g;
}

/* small accent specimens */
function yield_(M) {
  const g = new THREE.Group();
  const box = rbox(1.5, 0.55, 0.7, 0.08, M.cream); box.position.y = -0.2; g.add(box);
  [-0.3, -0.1, 0.1, 0.3].forEach((x, i) => { const c = rbox(1.15, 0.95, 0.05, 0.05, i === 3 ? M.orangeGloss : M.cream); c.position.set(x * 0.5, 0.25, x); c.rotation.z = (x) * 0.12; g.add(c); });
  return g;
}
function menu(M) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const t = (i - 2);
    const c = rbox(1.5, 0.95, 0.06, 0.05, i === 4 ? M.orangeGloss : M.cream);
    c.position.set(t * 0.12, t * 0.06, i * 0.08); c.rotation.z = t * 0.09; g.add(c);
  }
  g.rotation.x = -0.2;
  return g;
}
function lastcall(M) {
  const g = new THREE.Group();
  const tag = rbox(1.9, 1.0, 0.14, 0.1, M.cream); g.add(tag);
  const stripe = rbox(1.9, 0.26, 0.16, 0.06, M.orangeGloss); stripe.position.y = 0.32; g.add(stripe);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 24), M.ink); hole.rotation.x = Math.PI / 2; hole.position.set(-0.72, 0.32, 0); g.add(hole);
  [-0.2, -0.44].forEach((y) => { const b = rbox(1.0, 0.09, 0.05, 0.03, M.ink); b.position.set(0.1, y, 0.08); g.add(b); });
  g.rotation.z = -0.06;
  return g;
}

const CONFIG = {
  hero:     { build: hero,     dist: 4.9, target: [0, 0.15, 0], dark: false },
  ctx:      { build: ctx,      dist: 3.4, target: [0, 0.05, 0], dark: false },
  mem:      { build: mem,      dist: 3.6, target: [0.12, 0.12, 0], dark: false },
  taste:    { build: taste,    dist: 3.2, target: [0, 0, 0],    dark: false },
  brief:    { build: brief,    dist: 3.9, target: [0, 0.05, 0], dark: true },
  produce:  { build: produce,  dist: 3.9, target: [0.08, 0.05, 0], dark: true },
  judge:    { build: judge,    dist: 3.9, target: [0.05, 0.05, 0], dark: true },
  host:     { build: host,     dist: 4.4, target: [0, -0.06, 0], dark: false },
  yield:    { build: yield_,   dist: 3.7, target: [0, 0, 0],    dark: false },
  menu:     { build: menu,     dist: 3.6, target: [0, 0, 0],    dark: false },
  lastcall: { build: lastcall, dist: 3.6, target: [0, 0, 0],    dark: false },
};

/* ---------------- single shared renderer + scissor compositor ----------------- */
function init() {
  const els = Array.prototype.slice.call(document.querySelectorAll('[data-spec]'));
  if (!els.length) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('no gl');
  } catch (e) { return; }

  const canvas = renderer.domElement;
  canvas.id = 'v2-gl';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' });
  document.body.appendChild(canvas);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setScissorTest(true);
  renderer.autoClear = false;

  const M = materials();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  function makeLights(scene, dark) {
    const key = new THREE.DirectionalLight(0xffffff, dark ? 1.5 : 2.0);
    key.position.set(3.5, 6, 4.5); key.castShadow = true;
    key.shadow.mapSize.set(512, 512); key.shadow.radius = 6; key.shadow.bias = -0.0005;
    const s = key.shadow.camera; s.near = 1; s.far = 24; s.left = -4; s.right = 4; s.top = 4; s.bottom = -4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe9d4, dark ? 0.25 : 0.5); fill.position.set(-4, 2.5, 2); scene.add(fill);
    if (dark) { const rim = new THREE.DirectionalLight(0xff8a3a, 1.6); rim.position.set(-1.5, 1.5, -4); scene.add(rim); }
  }

  const specs = els.map((el) => {
    const cfg = CONFIG[el.dataset.spec] || CONFIG.hero;
    const scene = new THREE.Scene();
    scene.environment = envTex;
    const obj = cfg.build(M);
    scene.add(obj);
    makeLights(scene, cfg.dark);
    if (!cfg.dark) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.15, color: 0x241c12 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -1.3; ground.receiveShadow = true; scene.add(ground);
    }
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(1.7, 1.05, cfg.dist);
    camera.lookAt(cfg.target[0], cfg.target[1], cfg.target[2]);
    return { el, scene, camera, obj, baseY: obj.position.y, phase: 0 };
  });
  // stable per-spec idle phase
  specs.forEach((s, i) => { s.phase = i * 1.7; });

  let px = 0, py = 0, gx = 0, gy = 0, t = 0, dirty = true;
  const mark = () => { dirty = true; };
  addEventListener('scroll', mark, { passive: true });
  if (!REDUCE && FINE) {
    addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
    addEventListener('pointerleave', () => { px = 0; py = 0; });
  }
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); dirty = true; }, { passive: true });

  function render() {
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    const vh = innerHeight;
    gx += (px - gx) * 0.07; gy += (py - gy) * 0.07;
    for (const s of specs) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vh + 40 || r.width < 2) continue;
      const w = r.width, h = r.height, left = r.left, bottom = vh - r.bottom;
      renderer.setViewport(left, bottom, w, h);
      renderer.setScissor(left, bottom, w, h);
      s.camera.aspect = w / h; s.camera.updateProjectionMatrix();
      const idle = REDUCE ? 0 : Math.sin(t + s.phase) * 0.07;
      // scroll-linked turn: object rotates as its well travels up the viewport
      const scrollTurn = REDUCE ? 0 : (((r.top + h / 2) - vh / 2) / vh) * -0.5;
      s.obj.rotation.y = gx * 0.8 + idle + scrollTurn;
      s.obj.rotation.x = gy * 0.45 + (REDUCE ? 0 : Math.sin(t * 0.7 + s.phase) * 0.02);
      s.obj.position.y = s.baseY + (REDUCE ? 0 : Math.sin(t * 0.9 + s.phase) * 0.07);
      const spin = s.obj.userData && s.obj.userData.spin;
      if (spin && !REDUCE) spin.rotation.y = Math.sin(t * 0.6 + s.phase) * 0.45;
      renderer.render(s.scene, s.camera);
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!REDUCE) { t += 0.016; dirty = true; }
    if (!dirty) return;
    dirty = false;
    render();
  }
  loop();

  // first paint once fonts/layout settle
  setTimeout(() => { dirty = true; }, 300);
  window.addEventListener('load', () => { dirty = true; });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
