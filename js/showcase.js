/* showcase.js — "see it live": a laser sweep that turns a rough first output
   into the polished version under your cursor (left of the seam = polished,
   right = rough), with a glowing orange seam + a subtle scan ripple.
   Reduced-motion → static split; no WebGL → the polished image as fallback. */
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

/* the finished, on-brand screen */
function drawPolished() {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 1280, 720);
  x.fillStyle = '#fffdf7'; rr(x, 78, 64, 1124, 592, 26); x.fill();
  x.fillStyle = '#EB5424'; x.save(); rr(x, 78, 64, 1124, 64, 26); x.clip(); x.fillRect(78, 64, 1124, 64); x.restore();
  x.fillStyle = 'rgba(255,243,234,.92)'; [120, 150, 180].forEach((cx) => { x.beginPath(); x.arc(cx, 96, 7, 0, 6.3); x.fill(); });
  x.fillStyle = 'rgba(42,18,6,.7)'; x.font = '600 20px Inter, sans-serif'; x.fillText('miniOrange — screen.fig', 230, 103);
  x.fillStyle = '#efe6d2'; x.fillRect(78, 128, 250, 528);
  x.fillStyle = '#d8cbac'; for (let i = 0; i < 7; i++) { rr(x, 106, 160 + i * 60, 196, 26, 8); x.fill(); }
  x.fillStyle = '#EB5424'; rr(x, 106, 160, 196, 26, 8); x.fill();
  x.fillStyle = '#241c12'; rr(x, 372, 168, 470, 42, 8); x.fill();
  x.fillStyle = '#c7b993'; rr(x, 372, 232, 720, 16, 6); x.fill(); rr(x, 372, 262, 660, 16, 6); x.fill(); rr(x, 372, 292, 700, 16, 6); x.fill();
  x.fillStyle = '#1d6e6b'; rr(x, 372, 344, 380, 230, 16); x.fill();
  x.fillStyle = '#EB5424'; rr(x, 778, 344, 314, 104, 16); x.fill();
  x.fillStyle = '#e7dcc2'; rr(x, 778, 470, 314, 104, 16); x.fill();
  x.fillStyle = '#EB5424'; rr(x, 372, 600, 188, 50, 25); x.fill();
  x.fillStyle = '#fff3ea'; x.font = '600 18px Inter, sans-serif'; x.fillText('Ship it', 432, 631);
  return c;
}

/* the rough first output — muted, misaligned, unfinished */
function drawRough() {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  x.fillStyle = '#dedacd'; x.fillRect(0, 0, 1280, 720);
  x.fillStyle = '#eeebe2'; rr(x, 84, 78, 1110, 566, 10); x.fill();          // off-position window, hard corners
  x.fillStyle = '#b7b0a0'; x.fillRect(84, 78, 1110, 52);                     // flat grey bar
  x.fillStyle = '#9a9384'; [120, 150, 180].forEach((cx) => { x.fillRect(cx - 6, 98, 12, 12); });
  x.fillStyle = '#8d8676'; x.font = '400 19px Inter, sans-serif'; x.fillText('untitled-3 (copy).fig', 232, 110);
  x.fillStyle = '#d3cdbe'; x.fillRect(84, 130, 236, 514);                    // sidebar, no rounding
  x.fillStyle = '#b3ab99'; for (let i = 0; i < 7; i++) { x.fillRect(104 + (i % 2 ? 8 : 0), 168 + i * 58, 170 + (i % 3) * 22, 22); } // ragged items
  x.fillStyle = '#9d9684'; x.fillRect(360, 172, 360, 38);                    // heading block, short/left
  x.fillStyle = '#c0b9a8'; x.fillRect(360, 232, 760, 14); x.fillRect(360, 258, 540, 14); x.fillRect(360, 284, 690, 14);
  x.fillStyle = '#b9b2a1'; x.fillRect(366, 338, 372, 222);                   // grey image block, slightly off
  x.fillStyle = '#cfc8b7'; x.fillRect(792, 352, 300, 96); x.fillRect(778, 466, 320, 96); // misaligned cards
  x.strokeStyle = '#a39c8b'; x.lineWidth = 2; x.strokeRect(372, 596, 176, 48); // empty outline button
  x.fillStyle = '#8d8676'; x.font = '400 17px Inter, sans-serif'; x.fillText('button', 410, 626);
  return c;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }';
const FRAG = [
  'precision highp float;',
  'uniform sampler2D uRough; uniform sampler2D uPolished; uniform vec2 uMouse; uniform float uTime; varying vec2 vUv;',
  'void main(){',
  '  float seam = uMouse.x;',
  '  vec2 uv = vUv;',
  '  float prox = smoothstep(0.05, 0.0, abs(uv.x - seam));',
  '  uv.y += sin(uv.y * 60.0 + uTime * 4.0) * 0.004 * prox;',
  '  vec3 rough = texture2D(uRough, uv).rgb;',
  '  vec3 pol = texture2D(uPolished, uv).rgb;',
  '  float m = smoothstep(seam + 0.004, seam - 0.004, vUv.x);',  // left of seam -> polished
  '  vec3 col = mix(rough, pol, m);',
  '  col += vec3(1.0, 0.42, 0.13) * smoothstep(0.010, 0.0, abs(vUv.x - seam)) * 1.35;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function init() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;
  const stage = canvas.closest('.fg-shader') || canvas.parentNode;
  const polished = drawPolished();
  const rough = drawRough();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    if (!renderer.getContext()) throw new Error('no gl');
  } catch (e) {
    const fb = stage.querySelector('.fg-shader__fallback');
    if (fb) { fb.style.backgroundImage = 'url(' + polished.toDataURL() + ')'; fb.style.opacity = '1'; }
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const size = () => renderer.setSize(stage.clientWidth || 800, stage.clientHeight || 450, false);
  size();

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tR = new THREE.CanvasTexture(rough); tR.colorSpace = THREE.SRGBColorSpace;
  const tP = new THREE.CanvasTexture(polished); tP.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uRough: { value: tR }, uPolished: { value: tP }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: 0 } };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG })));

  let mx = 0.5, tmx = 0.5, t = 0;
  if (!REDUCE) {
    stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width; }, { passive: true });
    stage.addEventListener('pointerleave', () => { tmx = 0.5; });
  }
  function frame() {
    t += 0.016; mx += (tmx - mx) * 0.12;
    uniforms.uMouse.value.x = mx; uniforms.uTime.value = t;
    renderer.render(scene, cam);
    if (!REDUCE) requestAnimationFrame(frame);
  }
  frame();
  window.addEventListener('resize', () => { size(); if (REDUCE) renderer.render(scene, cam); }, { passive: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
