/* v2-hero.js — soft-3D "forgetful intern" hero specimen.
   Same render family as the GLB cold-open: ACESFilmic tone mapping +
   RoomEnvironment studio reflections + clearcoat (semi-gloss soft-touch).
   Pointer-reactive + gentle idle float; renders one static frame under
   prefers-reduced-motion; silent no-op if WebGL is unavailable. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rbox(w, h, d, r, mat) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, r), mat);
}

/* the cover specimen: a glossy toy-terminal with a soft, half-awake face */
function buildIntern() {
  const g = new THREE.Group();

  const orange = new THREE.MeshPhysicalMaterial({ color: 0xf25c05, roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.26, envMapIntensity: 0.9 });
  const screen = new THREE.MeshPhysicalMaterial({ color: 0x191207, roughness: 0.10, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const cream  = new THREE.MeshPhysicalMaterial({ color: 0xe7dcc2, roughness: 0.62, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.55 });
  const metal  = new THREE.MeshStandardMaterial({ color: 0xc7b89a, roughness: 0.36, metalness: 0.55, envMapIntensity: 1.0 });
  const eye    = new THREE.MeshPhysicalMaterial({ color: 0xfff3ea, emissive: 0xffce92, emissiveIntensity: 0.4, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x2a1206, roughness: 0.5 });
  // glowing light face-marks so the sleepy eye + mouth read on the dark screen
  const glow   = new THREE.MeshStandardMaterial({ color: 0xffe6c4, emissive: 0xffb866, emissiveIntensity: 0.6, roughness: 0.35 });

  // base plinth
  const base = rbox(1.55, 0.16, 0.95, 0.07, cream);
  base.position.y = -1.18; base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  // stand + hinge
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.52, 24), metal);
  stand.position.y = -0.85; stand.castShadow = true; g.add(stand);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 20), metal);
  hinge.rotation.z = Math.PI / 2; hinge.position.y = -0.6; hinge.castShadow = true; g.add(hinge);

  // monitor body (the lead orange clearcoat form)
  const body = rbox(2.7, 2.0, 0.5, 0.2, orange);
  body.position.y = 0.36; body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // recessed glossy screen
  const scr = rbox(2.16, 1.46, 0.46, 0.1, screen);
  scr.position.set(0, 0.42, 0.07);
  g.add(scr);

  // face — sits just in front of the screen surface
  const fz = 0.33;
  // awake eye
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 28), eye);
  e1.scale.set(1, 1, 0.45); e1.position.set(-0.44, 0.58, fz); g.add(e1);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 18), dark);
  pupil.scale.set(1, 1, 0.5); pupil.position.set(-0.41, 0.55, fz + 0.07); g.add(pupil);
  // sleepy eye (a soft closed-lid arc, drawn in glowing light)
  const lid = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 12, 32, Math.PI), glow);
  lid.position.set(0.44, 0.6, fz); g.add(lid);
  // small worried mouth
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.034, 12, 32, Math.PI * 0.62), glow);
  mouth.position.set(0.02, 0.04, fz); mouth.rotation.z = Math.PI * 0.69; g.add(mouth);

  // floating "brief" note — soft-touch accent
  const note = rbox(0.84, 0.84, 0.05, 0.05, cream);
  note.position.set(1.78, 1.02, 0.22); note.rotation.z = -0.17; note.castShadow = true; g.add(note);
  const line = rbox(0.5, 0.07, 0.02, 0.03, orange);
  line.position.set(1.7, 0.8, 0.26); line.rotation.z = -0.17; g.add(line);

  g.position.y = 0.12;
  return g;
}

export function mountHero(container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer || !renderer.getContext()) return false;

  const W = () => container.clientWidth || 440;
  const H = () => container.clientHeight || 440;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement;
  cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
  container.appendChild(cv);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 100);
  camera.position.set(1.9, 1.1, 5.5);
  camera.lookAt(0, 0.18, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 8; key.shadow.bias = -0.0004;
  const s = key.shadow.camera; s.near = 1; s.far = 22; s.left = -4; s.right = 4; s.top = 4; s.bottom = -4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe9d4, 0.5);
  fill.position.set(-4, 2.5, 2);
  scene.add(fill);

  const obj = buildIntern();
  scene.add(obj);

  // transparent shadow-catcher so the soft shadow lands on the paper
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.ShadowMaterial({ opacity: 0.16, color: 0x241c12 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.27; ground.receiveShadow = true;
  scene.add(ground);

  // pointer reactivity (fine pointers only, motion allowed)
  const host = container.closest('section') || container;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  if (!REDUCE && matchMedia('(pointer:fine)').matches) {
    host.addEventListener('pointermove', (e) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  }

  let t = 0;
  function frame() {
    t += 0.016;
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    obj.rotation.y = cx * 0.6 + (REDUCE ? 0 : Math.sin(t * 0.5) * 0.05);
    obj.rotation.x = cy * 0.34;
    obj.position.y = 0.12 + (REDUCE ? 0 : Math.sin(t * 0.9) * 0.05);
    renderer.render(scene, camera);
    if (!REDUCE) requestAnimationFrame(frame);
  }
  frame();

  window.addEventListener('resize', () => {
    const w = W(), h = H();
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (REDUCE) renderer.render(scene, camera);
  }, { passive: true });

  window.addEventListener('v2-ready', () => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  return true;
}

const el = document.getElementById('hero3d');
if (el) { try { mountHero(el); } catch (e) { /* leave the fallback in place */ } }
