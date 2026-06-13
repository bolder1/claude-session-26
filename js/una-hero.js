/* una-hero.js — "gravity well" hero scene, written from scratch.
   A dark wireframe grid dips into a central well; a glowing amber core
   sits in the depression while satellite motes orbit and occasionally
   dive in, sending a luminous pulse rippling outward through the grid.
   Two moods, driven from una-main.js:
     'order' — calm orbits, satellites spiral in and get absorbed
     'chaos' — satellites scatter to the rim and jitter               */

import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('una-hero-canvas');
  const heroEl = document.getElementById('una-hero');
  if (!canvas || !heroEl) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return; // no WebGL — hero falls back to the static gradient
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const FOG_COLOR = 0x100f0f;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 28, 75);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const CAM_R = 25;
  const camBase = new THREE.Vector3(Math.sin(Math.PI / 4) * CAM_R, 18, Math.cos(Math.PI / 4) * CAM_R);
  camera.position.copy(camBase);
  const LOOK_AT = new THREE.Vector3(0, 1.5, 0);
  camera.lookAt(LOOK_AT);

  /* ---------------- grid ---------------- */

  const SIZE = 80;            // world units across
  const SEG = 96;             // segments per side
  const N = SEG + 1;          // vertices per side
  const HALF = SIZE / 2;

  const vertCount = N * N;
  const positions = new Float32Array(vertCount * 3);
  const intensity = new Float32Array(vertCount);
  const radii = new Float32Array(vertCount); // cached radius per vertex

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const idx = i * N + j;
      const x = (j / SEG) * SIZE - HALF;
      const z = (i / SEG) * SIZE - HALF;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = z;
      radii[idx] = Math.hypot(x, z);
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const intAttr = new THREE.BufferAttribute(intensity, 1);
  intAttr.setUsage(THREE.DynamicDrawUsage);

  // line indices — every horizontal + vertical neighbour pair
  const lineIdx = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j;
      if (j < SEG) lineIdx.push(a, a + 1);
      if (i < SEG) lineIdx.push(a, a + N);
    }
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', posAttr);
  lineGeo.setAttribute('aIntensity', intAttr);
  lineGeo.setIndex(lineIdx);

  const lineMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor:     { value: new THREE.Color(0xb6ada3) },
      uBaseAlpha: { value: 0.20 },
      uInnerR:    { value: 26.0 },
      uOuterR:    { value: 38.0 },
      uBoost:     { value: 2.6 },
      uFogNear:   { value: 28.0 },
      uFogFar:    { value: 75.0 },
    },
    vertexShader: `
      attribute float aIntensity;
      varying vec2 vXZ;
      varying float vIntensity;
      varying float vDepth;
      void main() {
        vXZ = position.xz;
        vIntensity = aIntensity;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec2 vXZ;
      varying float vIntensity;
      varying float vDepth;
      uniform vec3 uColor;
      uniform float uBaseAlpha;
      uniform float uInnerR;
      uniform float uOuterR;
      uniform float uBoost;
      uniform float uFogNear;
      uniform float uFogFar;
      void main() {
        float r = length(vXZ);
        float edge = 1.0 - smoothstep(uInnerR, uOuterR, r);
        float boost = clamp(vIntensity, 0.0, 1.0);
        float alpha = uBaseAlpha * (1.0 + boost * uBoost) * edge;
        vec3 col = mix(uColor, vec3(1.0), boost * 0.6);
        float fogF = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
        alpha *= 1.0 - fogF;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // opaque underlay so far-side lines vanish behind the funnel walls
  const triIdx = [];
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * N + j, b = a + 1, c = a + N, d = c + 1;
      triIdx.push(a, c, b, b, c, d);
    }
  }
  const underGeo = new THREE.BufferGeometry();
  underGeo.setAttribute('position', posAttr);
  underGeo.setIndex(triIdx);
  const underMat = new THREE.MeshBasicMaterial({
    color: FOG_COLOR, side: THREE.FrontSide, fog: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const underMesh = new THREE.Mesh(underGeo, underMat);
  underMesh.renderOrder = -1;
  scene.add(underMesh);

  /* ---------------- core + glows ---------------- */

  function radialTexture(stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  function glowSprite(tex, size) {
    const m = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }

  const CORE_Y = 1.0;
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uCenter:  { value: new THREE.Color(0x140d04) },
      uEdge:    { value: new THREE.Color(0x4a2406) },
      uRim:     { value: new THREE.Color(0xff8a2a) },
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      uniform vec3 uCenter;
      uniform vec3 uEdge;
      uniform vec3 uRim;
      uniform float uOpacity;
      void main() {
        float facing = max(dot(vNormalView, vViewDir), 0.0);
        vec3 base = mix(uEdge, uCenter, pow(facing, 1.6));
        float rim = 1.0 - smoothstep(0.04, 0.18, facing);
        vec3 col = mix(base, uRim, rim);
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.55, 48, 48), coreMat);
  core.position.set(0, CORE_Y, 0);
  scene.add(core);

  const ambientGlow = glowSprite(radialTexture([
    [0, 'rgba(255,138,42,0.30)'], [0.12, 'rgba(255,138,42,0.14)'],
    [0.28, 'rgba(255,255,255,0.05)'], [0.6, 'rgba(255,255,255,0.015)'],
    [1, 'rgba(255,255,255,0)'],
  ]), 9);
  ambientGlow.position.set(0, CORE_Y, 0);
  scene.add(ambientGlow);

  const flash = glowSprite(radialTexture([
    [0, 'rgba(255,250,240,1.0)'], [0.2, 'rgba(255,214,160,0.95)'],
    [0.45, 'rgba(255,165,77,0.7)'], [0.75, 'rgba(255,138,42,0.3)'],
    [1, 'rgba(255,138,42,0)'],
  ]), 2.6);
  flash.position.set(0, CORE_Y, 0);
  flash.material.opacity = 0;
  scene.add(flash);

  /* ---------------- satellites ---------------- */

  const satTex = radialTexture([
    [0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,236,214,0.85)'],
    [0.65, 'rgba(255,138,42,0.25)'], [1, 'rgba(255,138,42,0)'],
  ]);

  const SAT_COUNT = 7;
  const sats = [];
  for (let k = 0; k < SAT_COUNT; k++) {
    const sprite = glowSprite(satTex, 1.0);
    scene.add(sprite);
    sats.push({
      sprite,
      angle: (k / SAT_COUNT) * Math.PI * 2 + (k % 2) * 0.6,
      speed: 0.12 + 0.05 * ((k * 37) % 5),
      orderR: 5.5 + ((k * 53) % 50) / 9,        // 5.5 .. 11
      chaosR: 12 + ((k * 29) % 40) / 8,          // 12 .. 17
      jitterSeed: k * 13.7,
      dive: null,                                // {t0} when absorbing
      alpha: 1,
    });
  }

  /* ---------------- pulses ---------------- */

  const pulses = []; // {start, speed, width, strength}
  function emitPulse(strength = 1) {
    pulses.push({ start: simTime, speed: 14, width: 2.4, strength });
    flashBurst();
  }
  let flashT = -1;
  function flashBurst() { flashT = simTime; }

  /* ---------------- field maths ---------------- */

  const WELL_DEPTH = 7.0;
  const WELL_SIGMA = 5.2;
  function wellY(r, t) {
    const dip = -WELL_DEPTH * Math.exp(-(r * r) / (WELL_SIGMA * WELL_SIGMA));
    const ripple = 0.22 * Math.sin(r * 0.55 - t * 1.4) * Math.exp(-r / 22);
    return dip + ripple;
  }

  function updateGrid(t) {
    // prune dead pulses
    for (let p = pulses.length - 1; p >= 0; p--) {
      if ((t - pulses[p].start) * pulses[p].speed > 60) pulses.splice(p, 1);
    }
    for (let v = 0; v < vertCount; v++) {
      const r = radii[v];
      positions[v * 3 + 1] = wellY(r, t);
      let glow = 0;
      for (const p of pulses) {
        const pr = (t - p.start) * p.speed;
        const d = r - pr;
        const fade = Math.max(0, 1 - pr / 42);
        glow += p.strength * fade * Math.exp(-(d * d) / (p.width * p.width));
      }
      intensity[v] = glow;
    }
    posAttr.needsUpdate = true;
    intAttr.needsUpdate = true;
  }

  /* ---------------- mode + interaction ---------------- */

  let mode = 'order';          // 'order' | 'chaos'
  let modeMix = 0;             // 0 = order, 1 = chaos (lerped)
  window.unaHero = {
    setMode(m) { mode = m === 'chaos' ? 'chaos' : 'order'; },
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  heroEl.addEventListener('pointermove', (e) => {
    const rect = heroEl.getBoundingClientRect();
    pointer.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  }, { passive: true });
  heroEl.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
  canvas.addEventListener('pointerdown', () => emitPulse(1.0));

  /* ---------------- sizing / visibility ---------------- */

  function resize() {
    const w = heroEl.clientWidth || 1;
    const h = heroEl.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inView = true, rafId = null, oneShot = REDUCE;
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !REDUCE && rafId == null) { lastNow = performance.now(); rafId = requestAnimationFrame(frame); }
  }, { threshold: 0 }).observe(heroEl);

  /* ---------------- main loop ---------------- */

  let simTime = 0;
  let lastNow = performance.now();
  let nextDiveAt = 3.5;

  function frame(now) {
    if (!inView || document.hidden) { rafId = null; return; }
    rafId = oneShot ? null : requestAnimationFrame(frame);
    const dt = oneShot ? 0.016 : Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    simTime += dt;

    modeMix += ((mode === 'chaos' ? 1 : 0) - modeMix) * Math.min(1, dt * 2.2);

    updateGrid(simTime);

    // schedule satellite dives while calm
    if (mode === 'order' && simTime > nextDiveAt) {
      const candidates = sats.filter(s => !s.dive);
      if (candidates.length) {
        candidates[Math.floor(Math.random() * candidates.length)].dive = { t0: simTime };
      }
      nextDiveAt = simTime + 4 + Math.random() * 3;
    }

    for (const s of sats) {
      s.angle += s.speed * dt * (1 + modeMix * 1.8);

      let r;
      if (s.dive) {
        const k = (simTime - s.dive.t0) / 1.35; // dive duration
        if (k >= 1) {
          emitPulse(0.9);
          s.dive = null;
          s.angle += Math.PI * (0.5 + Math.random());
          s.alpha = 0;
          r = THREE.MathUtils.lerp(s.orderR, s.chaosR, modeMix);
        } else {
          const e = k * k * (3 - 2 * k);
          r = s.orderR * (1 - e);
          s.angle += dt * 3.2 * e;     // spiral faster as it falls
          s.alpha = 1 - Math.max(0, k - 0.75) * 4;
        }
      } else {
        const jx = Math.sin(simTime * 1.7 + s.jitterSeed) * 0.6
                 + Math.sin(simTime * 3.1 + s.jitterSeed * 2.1) * 0.3;
        r = THREE.MathUtils.lerp(s.orderR, s.chaosR + jx * modeMix * 2, modeMix);
        s.alpha = Math.min(1, s.alpha + dt * 1.2);
      }

      if (r === undefined) r = s.orderR;
      const x = Math.cos(s.angle) * r;
      const z = Math.sin(s.angle) * r;
      const y = wellY(r, simTime) + 0.35;
      s.sprite.position.set(x, y, z);
      const sc = 0.85 + 0.25 * Math.sin(simTime * 2 + s.jitterSeed);
      s.sprite.scale.set(sc, sc, 1);
      s.sprite.material.opacity = Math.max(0, s.alpha) * (1 - modeMix * 0.25);
    }

    // core flash decay
    if (flashT >= 0) {
      const k = (simTime - flashT) / 0.9;
      if (k >= 1) { flash.material.opacity = 0; flashT = -1; }
      else {
        flash.material.opacity = (1 - k) * 0.95;
        const fs = 2.6 + k * 2.2;
        flash.scale.set(fs, fs, 1);
      }
    }

    // core breathing + chaos dimming
    const breathe = 1 + Math.sin(simTime * 1.3) * 0.035;
    core.scale.setScalar(breathe);
    coreMat.uniforms.uOpacity.value = 1 - modeMix * 0.35;
    ambientGlow.material.opacity = 1 - modeMix * 0.55;

    // pointer parallax
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);
    camera.position.set(
      camBase.x + pointer.x * 1.4,
      camBase.y - pointer.y * 0.9,
      camBase.z
    );
    camera.lookAt(LOOK_AT);

    renderer.render(scene, camera);
    if (oneShot) oneShot = false;
  }
  rafId = requestAnimationFrame(frame);

  // opening pulse so the scene greets you (skip under reduced-motion)
  if (!REDUCE) setTimeout(() => emitPulse(0.8), 900);
})();
