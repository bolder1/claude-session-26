/* una-speaker.js — low-poly miniOrange orbited by artifact shards.
   Lives in the speaker panel. Drag to orbit, gentle idle spin,
   renders only while visible. */

import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('speaker-canvas');
  if (!canvas) return;
  const holder = canvas.parentElement;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return; // panel keeps its chips + label as the fallback
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0.25, 7.4);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x171008, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(3.4, 4.2, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xff7d1f, 14, 12);
  rim.position.set(-3.2, -1.6, -2.4);
  scene.add(rim);

  /* ---------- the orange ---------- */
  const root = new THREE.Group();
  scene.add(root);

  const fruit = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.72, 1),
    new THREE.MeshStandardMaterial({ color: 0xf25c05, flatShading: true, roughness: 0.52, metalness: 0.06 })
  );
  root.add(fruit);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 0.42, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1e, flatShading: true, roughness: 0.9 })
  );
  stem.position.set(0.05, 1.86, 0);
  root.add(stem);

  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 7, 5),
    new THREE.MeshStandardMaterial({ color: 0x3fae5e, flatShading: true, roughness: 0.65 })
  );
  leaf.scale.set(1, 0.22, 0.5);
  leaf.position.set(0.5, 2.0, 0.05);
  leaf.rotation.z = -0.5;
  root.add(leaf);

  /* ---------- orbiting artifact shards ---------- */
  const shardMats = [
    new THREE.MeshBasicMaterial({ color: 0xffd9b8, wireframe: true, transparent: true, opacity: 0.85 }),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, wireframe: true, transparent: true, opacity: 0.9 }),
  ];
  const shardGeos = [
    new THREE.OctahedronGeometry(0.22),
    new THREE.TetrahedronGeometry(0.24),
    new THREE.BoxGeometry(0.26, 0.26, 0.26),
  ];
  const SHARDS = 7;
  const shards = [];
  for (let i = 0; i < SHARDS; i++) {
    const m = new THREE.Mesh(shardGeos[i % shardGeos.length], shardMats[i % shardMats.length]);
    scene.add(m);
    shards.push({
      m,
      a: (i / SHARDS) * Math.PI * 2,
      r: 2.65 + (i % 3) * 0.28,
      speed: 0.35 + (i % 4) * 0.09,
      tilt: 0.5,
      spin: 0.4 + (i % 3) * 0.3,
      wob: i * 1.7,
    });
  }

  // dashed orbit ring
  const ringGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 121 }, (_, i) => {
      const t = (i / 120) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(t) * 2.85, 0, Math.sin(t) * 2.85);
    })
  );
  const ring = new THREE.Line(ringGeo, new THREE.LineDashedMaterial({
    color: 0xff8a2a, transparent: true, opacity: 0.35, dashSize: 0.12, gapSize: 0.14,
  }));
  ring.computeLineDistances();
  ring.rotation.x = 0.5;
  scene.add(ring);

  /* ---------- interaction ---------- */
  let dragging = false, px = 0, py = 0;
  let targetRY = 0, targetRX = 0;
  holder.style.cursor = 'grab';
  holder.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    holder.style.cursor = 'grabbing';
    holder.setPointerCapture(e.pointerId);
  });
  holder.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    targetRY += (e.clientX - px) * 0.007;
    targetRX = Math.max(-0.7, Math.min(0.7, targetRX + (e.clientY - py) * 0.005));
    px = e.clientX; py = e.clientY;
  });
  const end = () => { dragging = false; holder.style.cursor = 'grab'; };
  holder.addEventListener('pointerup', end);
  holder.addEventListener('pointercancel', end);

  /* ---------- sizing + visibility ---------- */
  function resize() {
    const w = holder.clientWidth || 1;
    const h = holder.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(holder);

  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inView = false, rafId = null;
  let t = 0, last = performance.now();

  function step(dt) {
    t += dt;
    if (!dragging) targetRY += dt * 0.28; // lazy idle spin
    root.rotation.y += (targetRY - root.rotation.y) * Math.min(1, dt * 6);
    root.rotation.x += (targetRX - root.rotation.x) * Math.min(1, dt * 6);
    root.position.y = Math.sin(t * 0.9) * 0.14;
    ring.rotation.z = t * 0.05;
    for (const s of shards) {
      s.a += s.speed * dt;
      const y = Math.sin(t * 0.8 + s.wob) * 0.5;
      s.m.position.set(
        Math.cos(s.a) * s.r,
        y + Math.sin(s.a) * s.r * Math.sin(s.tilt) * 0.4,
        Math.sin(s.a) * s.r * Math.cos(s.tilt)
      );
      s.m.rotation.x += s.spin * dt;
      s.m.rotation.y += s.spin * 0.7 * dt;
    }
  }

  /* ---------- loop (halts offscreen; one static frame under reduced-motion) ---------- */
  function frame(now) {
    if (!inView || document.hidden) { rafId = null; return; }
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    renderer.render(scene, camera);
  }
  function kick() {
    if (rafId == null && inView && !document.hidden) { last = performance.now(); rafId = requestAnimationFrame(frame); }
  }
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (!inView) return;
    if (REDUCE) { step(0); renderer.render(scene, camera); } // static
    else kick();
  }, { threshold: 0.1 }).observe(holder);
})();
