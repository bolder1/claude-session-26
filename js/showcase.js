/* showcase.js — "see it live": a WebGL plane showing a design-screen image,
   rippled + chromatically split + laser-glow-ringed around the cursor.
   Reduced-motion → one static frame; no WebGL → the image shown as a fallback. */
import * as THREE from 'three';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rr(x, a, b, w, h, r) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

/* a fake "design in progress" screen, drawn to a canvas */
function drawMock() {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 1280, 720);
  // app window
  x.fillStyle = '#fffdf7'; rr(x, 78, 64, 1124, 592, 26); x.fill();
  // title bar
  x.fillStyle = '#EB5424'; x.save(); rr(x, 78, 64, 1124, 64, 26); x.clip(); x.fillRect(78, 64, 1124, 64); x.restore();
  x.fillStyle = 'rgba(255,243,234,.9)'; [120, 150, 180].forEach((cx) => { x.beginPath(); x.arc(cx, 96, 7, 0, 6.3); x.fill(); });
  x.fillStyle = 'rgba(42,18,6,.7)'; x.font = '600 20px Inter, sans-serif'; x.fillText('miniOrange — screen.fig', 230, 103);
  // sidebar
  x.fillStyle = '#efe6d2'; x.fillRect(78, 128, 250, 528);
  x.fillStyle = '#d8cbac'; for (let i = 0; i < 7; i++) { rr(x, 106, 160 + i * 60, 196, 26, 8); x.fill(); }
  x.fillStyle = '#EB5424'; rr(x, 106, 160, 196, 26, 8); x.fill();
  // main canvas content
  x.fillStyle = '#241c12'; rr(x, 372, 168, 470, 42, 8); x.fill();
  x.fillStyle = '#c7b993'; rr(x, 372, 232, 720, 16, 6); x.fill(); rr(x, 372, 262, 660, 16, 6); x.fill(); rr(x, 372, 292, 700, 16, 6); x.fill();
  x.fillStyle = '#1d6e6b'; rr(x, 372, 344, 380, 230, 16); x.fill();
  x.fillStyle = '#4d9965'; rr(x, 372, 344, 380, 230, 16); x.globalAlpha = .25; x.fill(); x.globalAlpha = 1;
  x.fillStyle = '#EB5424'; rr(x, 778, 344, 314, 104, 16); x.fill();
  x.fillStyle = '#e7dcc2'; rr(x, 778, 470, 314, 104, 16); x.fill();
  x.fillStyle = '#EB5424'; rr(x, 372, 600, 188, 50, 25); x.fill();
  x.fillStyle = '#fff3ea'; x.font = '600 18px Inter, sans-serif'; x.fillText('Ship it', 430, 631);
  return c;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }';
const FRAG = [
  'precision highp float;',
  'uniform sampler2D uTex; uniform vec2 uMouse; uniform float uTime; uniform float uActive; varying vec2 vUv;',
  'void main(){',
  '  vec2 uv = vUv;',
  '  float d = distance(uv, uMouse);',
  '  float infl = smoothstep(0.34, 0.0, d) * uActive;',
  '  vec2 dir = normalize(uv - uMouse + 1e-5);',
  '  uv += dir * sin(d * 42.0 - uTime * 3.5) * 0.014 * infl;',
  '  float ca = infl * 0.008;',
  '  vec3 col;',
  '  col.r = texture2D(uTex, uv + dir * ca).r;',
  '  col.g = texture2D(uTex, uv).g;',
  '  col.b = texture2D(uTex, uv - dir * ca).b;',
  '  col += vec3(0.95, 0.36, 0.15) * smoothstep(0.028, 0.0, abs(d - 0.12)) * infl;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function init() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;
  const stage = canvas.closest('.fg-shader') || canvas.parentNode;
  const mock = drawMock();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    if (!renderer.getContext()) throw new Error('no gl');
  } catch (e) {
    const fb = stage.querySelector('.fg-shader__fallback');
    if (fb) { fb.style.backgroundImage = 'url(' + mock.toDataURL() + ')'; fb.style.opacity = '1'; }
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const size = () => renderer.setSize(stage.clientWidth || 800, stage.clientHeight || 450, false);
  size();

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tex = new THREE.CanvasTexture(mock); tex.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uTex: { value: tex }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: 0 }, uActive: { value: 0 } };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG })));

  let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, act = 0, tact = 0, t = 0;
  if (!REDUCE) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width;
      tmy = 1 - (e.clientY - r.top) / r.height;
      tact = 1;
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { tact = 0; });
  }

  function frame() {
    t += 0.016;
    mx += (tmx - mx) * 0.1; my += (tmy - my) * 0.1; act += (tact - act) * 0.07;
    uniforms.uMouse.value.set(mx, my); uniforms.uTime.value = t; uniforms.uActive.value = act;
    renderer.render(scene, cam);
    if (!REDUCE) requestAnimationFrame(frame);
  }
  frame();
  window.addEventListener('resize', () => { size(); if (REDUCE) renderer.render(scene, cam); }, { passive: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
