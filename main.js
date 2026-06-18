import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

try {
  const PREFERS_REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CONFIG = {
    glbPath: window.innerWidth < 768
      ? 'assets/Sprint_mobile.glb'
      : 'assets/Sprint.glb',
    targetCamera: 'DutchCamera001',
    parallax: {
      enabled: true,
      horizontalIntensityMin: 0.2,
      horizontalIntensityMax: 1.4,
      verticalIntensity: 0.15,
      rotationIntensity: 0.04,
      smoothness: 0.06,
    },
    mobile: {
      breakpoint: 768,
      cameraOffsetX: 0.35,
      disableParallax: true,
      parallaxBreakpoint: 768
    }
  };

  const scrollSection = document.querySelector('.threejs-scroll-section');
  const heroSection = document.querySelector('.hero-section');
  let heroPlaceholder = null;
  const sectionBottom = scrollSection ? scrollSection.offsetHeight : 0;

  // The hero fold rides fixed underneath the canvas until the 3D intro
  // finishes, then takes over via a crossfade.
  if (heroSection) {
    heroPlaceholder = document.createElement('div');
    heroPlaceholder.style.height = heroSection.offsetHeight + 'px';
    heroPlaceholder.style.width = '100%';
    heroPlaceholder.className = 'hero-placeholder';
    heroSection.parentNode.insertBefore(heroPlaceholder, heroSection.nextSibling);
    heroSection.style.position = 'fixed';
    heroSection.style.top = '0';
    heroSection.style.left = '0';
    heroSection.style.width = '100%';
    heroSection.style.height = '100vh';
    heroSection.style.zIndex = '1';
    heroSection.style.opacity = '0';
  }
  let heroIsFixed = true;
  let stableViewportHeight = window.innerHeight;

  function getMaxScroll() {
    if (scrollSection) {
      const val = scrollSection.offsetHeight - stableViewportHeight;
      if (val > 100) return val;
    }
    return Math.max(document.body.scrollHeight - stableViewportHeight, 1);
  }

  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.targetX = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    mouse.targetX = 0;
    mouse.targetY = 0;
  });

  const container = document.getElementById('canvas-container');
  const isMobile = window.innerWidth < CONFIG.mobile.breakpoint;

  // Skip the heavy 500vh 3D intro when WebGL is unavailable (locked-down GPUs)
  // or the visitor asked for reduced motion — reveal the static hero instead.
  const _webglOK = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  })();
  if (!_webglOK || PREFERS_REDUCED_MOTION) {
    if (scrollSection) scrollSection.style.display = 'none';
    if (heroSection) {
      heroSection.style.position = ''; heroSection.style.top = ''; heroSection.style.left = '';
      heroSection.style.width = ''; heroSection.style.height = ''; heroSection.style.zIndex = ''; heroSection.style.opacity = '1';
    }
    if (heroPlaceholder) heroPlaceholder.style.display = 'none';
    window.dispatchEvent(new CustomEvent('glbLoaded'));
    window.dispatchEvent(new CustomEvent('threeJsCanvas', { detail: { active: false } }));
    throw new Error('Intro skipped (no WebGL or reduced-motion) — static hero shown');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#FF5C00'); // miniOrange, not Razorpay blue

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    logarithmicDepthBuffer: false,
    failIfMajorPerformanceCaveat: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  container.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));
  });

  let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  let mixer = null;
  let animationDuration = 0;
  let glbCamera = null;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  let renderStopped = false;
  let completionPermanent = false; // once true, re-entry into the 3D section is blocked

  // ---- Rebrand the baked Sprint/26 marks to CLAUDE/26 ----
  // The GLB's "SPRINT/26" texts are geometry, not texture: the billboard's
  // dark panel gets covered by textured planes (children -> they inherit the
  // node animation), and the shoe-tag letters are hidden and replaced by a
  // plane glued to the toe bone so it tracks the skinned foot.
  function rebrandIntro(gltf) {
    try {
      const root = gltf.scene;
      root.updateMatrixWorld(true);

      function makeTex(w, h, draw) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const paint = () => draw(c.getContext('2d'), w, h);
        paint();
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.userData.moSkip = true; // our own art — exempt from the recolor pass
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => { paint(); t.needsUpdate = true; });
        }
        return t;
      }

      let dark = null, tagText = null, poleMain = null, poleSub = null;
      root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        if (o.material.name === 'darktexture' && !dark) dark = o;
        if (o.material.name === 'EmissionText.001' && !tagText) tagText = o;
        if (o.name === 'Curve126') poleMain = o; // "SPRINT 26" on the pole billboard
        if (o.name === 'Curve127') poleSub = o;  // "100+ LAUNCHES & UPDATES"
      });

      // main pole billboard letters -> one CLAUDE 26 plane covering both lines
      if (poleMain && poleSub) {
        [poleMain, poleSub].forEach((m) => {
          m.material = m.material.clone(); // shared emission mat — clone before hiding
          m.material.visible = false;
        });
        poleMain.geometry.computeBoundingBox();
        poleSub.geometry.computeBoundingBox();
        const bb = poleMain.geometry.boundingBox.clone().union(poleSub.geometry.boundingBox);
        const w = (bb.max.x - bb.min.x) * 1.06;
        const h = (bb.max.z - bb.min.z) * 1.1;
        const cx = (bb.max.x + bb.min.x) / 2;
        const cz = (bb.max.z + bb.min.z) / 2;
        const tex = makeTex(1024, Math.max(2, Math.round(1024 * h / w)), (x, W, H) => {
          x.clearRect(0, 0, W, H);
          x.textAlign = 'center';
          x.fillStyle = '#f5f1ea';
          x.font = `500 ${Math.round(H * 0.5)}px Lexend, Arial, sans-serif`;
          x.fillText('CLAUDE 26', W / 2, H * 0.52);
          x.fillStyle = 'rgba(245,241,234,0.85)';
          x.font = `400 ${Math.round(H * 0.11)}px Lexend, Arial, sans-serif`;
          x.fillText('1 0 0 +   F E A T U R E S   &   L I V E   D E M O S', W / 2, H * 0.93);
        });
        const g = new THREE.PlaneGeometry(w, h);
        g.rotateX(-Math.PI / 2); // letters lie flat in local XZ, top toward -z
        const plane = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false,
        }));
        plane.position.set(cx, 0.004, cz);
        poleMain.add(plane);
      }

      // billboard: "SPRINT 26 / 100+ LAUNCHES & UPDATES" -> CLAUDE/26
      if (dark) {
        dark.geometry.computeBoundingBox();
        const b = dark.geometry.boundingBox;
        const w = b.max.x - b.min.x, h = b.max.z - b.min.z;
        const cx = (b.max.x + b.min.x) / 2, cz = (b.max.z + b.min.z) / 2;
        const tex = makeTex(1024, Math.max(2, Math.round(1024 * h / w)), (x, W, H) => {
          x.fillStyle = '#0a0a0b';
          x.fillRect(0, 0, W, H);
          x.textAlign = 'center';
          x.fillStyle = '#f5f1ea';
          x.font = `600 ${Math.round(H * 0.3)}px Lexend, Arial, sans-serif`;
          x.fillText('CLAUDE/26', W / 2, H * 0.52);
          x.fillStyle = 'rgba(245,241,234,0.72)';
          x.font = `400 ${Math.round(H * 0.05)}px Lexend, Arial, sans-serif`;
          x.fillText('T H E   D E S I G N   T E A M   S E S S I O N', W / 2, H * 0.665);
        });
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const gA = new THREE.PlaneGeometry(w, h);
        gA.rotateX(-Math.PI / 2);            // readable from the camera side
        const gB = gA.clone();
        gB.rotateZ(Math.PI);                 // readable mirror for the far side
        const coverA = new THREE.Mesh(gA, mat);
        coverA.position.set(cx, 0.02, cz);
        const coverB = new THREE.Mesh(gB, mat);
        coverB.position.set(cx, -0.02, cz);
        dark.add(coverA, coverB);
      }

      // shoe tag: hide the SPRINT/26 letters and lay "CLAUDE/26" as a decal
      // that SNAPS onto the patch surface (Object_1004, the dashed label) and
      // borrows the patch's own per-vertex skin weights — so it conforms to
      // the shoe and deforms with the foot, reading as part of it instead of
      // a flat sticker floating above. Tunable: TAG_FILL_U/V, TAG_LIFT.
      const TAG_FILL_U = 0.84;  // fraction of the patch width the text spans
      const TAG_FILL_V = 0.56;  // fraction of the patch height
      const TAG_FLIP_U = false; // mirror horizontally if the text reads reversed
      const TAG_FLIP_V = false; // flip vertically if upside-down
      // hide every SPRINT/26 letter mesh (both shoes share the material)
      root.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.name === 'EmissionText.001') {
          o.material = o.material.clone();
          o.material.visible = false;
        }
      });
      // For each dashed-border patch, CLONE its exact geometry + skin data and
      // only remap the UVs so a transparent "CLAUDE/26" texture lands on the
      // front face. An exact clone shares the patch's vertices, normals and
      // bone weights, so it conforms perfectly and deforms identically with the
      // foot — no heightfield approximation, no torn faces, no floating.
      const tagPatches = [];
      root.traverse((o) => {
        if (o.isMesh && o.isSkinnedMesh && o.material && !Array.isArray(o.material) && o.material.name === 'BlueTag') tagPatches.push(o);
      });
      tagPatches.forEach((surf) => {
        const sg = surf.geometry;
        sg.computeBoundingBox();
        const sCenter = sg.boundingBox.getCenter(new THREE.Vector3());
        const sSize = sg.boundingBox.getSize(new THREE.Vector3());

        // widest box axis = reading direction, middle = text height
        const axisOf = { x: 0, y: 1, z: 2 };
        const ranked = [['x', sSize.x], ['y', sSize.y], ['z', sSize.z]].sort((a, b) => a[1] - b[1]);
        const uA = ranked[2][0], vA = ranked[1][0];
        const ui = axisOf[uA], vi = axisOf[vA];
        const uLen = ranked[2][1] * TAG_FILL_U;
        const vLen = ranked[1][1] * TAG_FILL_V;
        const uStart = sCenter[uA] - uLen / 2;
        const vStart = sCenter[vA] - vLen / 2;

        // text texture with transparent margins; ClampToEdge means UVs that
        // fall outside the centred text band sample clear pixels (no text)
        const aspect = uLen / vLen;
        const TH = 256, TW = Math.max(64, Math.round(TH * aspect));
        const tex = makeTex(TW, TH, (x, W, H) => {
          x.clearRect(0, 0, W, H);
          x.fillStyle = '#ffffff';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          let fs = Math.round(H * 0.78);
          x.font = `800 ${fs}px Lexend, Arial, sans-serif`;
          while (x.measureText('CLAUDE/26').width > W * 0.9 && fs > 8) {
            fs -= 2; x.font = `800 ${fs}px Lexend, Arial, sans-serif`;
          }
          x.fillText('CLAUDE/26', W / 2, H * 0.55);
        });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

        // exact clone of the patch — keep position/normal/skin*, swap only UVs
        const dg = sg.clone();
        const sp = sg.attributes.position;
        const uvArr = new Float32Array(sp.count * 2);
        for (let i = 0; i < sp.count; i++) {
          let u = (sp.getComponent(i, ui) - uStart) / uLen;
          let v = (sp.getComponent(i, vi) - vStart) / vLen;
          if (TAG_FLIP_U) u = 1 - u;
          if (TAG_FLIP_V) v = 1 - v;
          uvArr[i * 2] = u;
          uvArr[i * 2 + 1] = v;
        }
        dg.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

        const decal = new THREE.SkinnedMesh(dg, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false,
          depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        }));
        decal.frustumCulled = false;
        decal.renderOrder = 4;
        decal.position.copy(surf.position);
        decal.quaternion.copy(surf.quaternion);
        decal.scale.copy(surf.scale);
        surf.parent.add(decal);
        decal.bind(surf.skeleton, surf.bindMatrix);
      });

      // shopping bag -> a laptop bag, same blueprint material, same swing.
      // The bag is 100% skinned to a single bone, so a rigid attach to that
      // bone reproduces its motion exactly.
      let bag = null;
      root.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.name === 'Bag' && !bag) bag = o;
      });
      if (bag && bag.isSkinnedMesh) {
        bag.geometry.computeBoundingBox();
        const bb = bag.geometry.boundingBox;
        const c = bb.getCenter(new THREE.Vector3());

        // dominant (only) bone of the bag rig
        const idx = bag.geometry.attributes.skinIndex;
        const wgt = bag.geometry.attributes.skinWeight;
        const acc = {};
        for (let i = 0; i < idx.count; i++) {
          for (let k = 0; k < 4; k++) {
            const w = wgt.getComponent(i, k);
            if (w > 0) {
              const b = idx.getComponent(i, k);
              acc[b] = (acc[b] || 0) + w;
            }
          }
        }
        const bone = bag.skeleton.bones[+Object.entries(acc).sort((a, b) => b[1] - a[1])[0][0]];
        const mat = bag.material; // the blue blueprint-grid look, reused as-is

        // a slim LAPTOP BAG, hung from a top handle the hand grips. Group origin
        // sits at the handle apex (the grip); the body hangs below.
        const BW = 0.36, BH = 0.27, BD = 0.085;     // body: wide + flat (a laptop fits)
        const HR = 0.072, HT = 0.013;               // top-handle arch radius + tube
        const TOP = -HR;                            // body/flap top edge (just under the handle)
        const hp = new THREE.Group();
        // main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), mat);
        body.position.set(0, TOP - BH / 2, 0);
        hp.add(body);
        // front flap over the top third of the face
        const flap = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.014, BH * 0.42, 0.018), mat);
        flap.position.set(0, TOP - BH * 0.2, BD / 2 + 0.004);
        hp.add(flap);
        // clasp / buckle on the flap
        const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.036, 0.022), mat);
        clasp.position.set(0, TOP - BH * 0.4, BD / 2 + 0.013);
        hp.add(clasp);
        // two grommets where the handle meets the body
        [-1, 1].forEach((s) => {
          const g = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 14), mat);
          g.rotation.z = Math.PI / 2; g.position.set(s * HR * 0.62, TOP + 0.004, 0);
          hp.add(g);
        });
        // top handle — a flat arch; the hand grips its apex (at the group origin)
        const handle = new THREE.Mesh(new THREE.TorusGeometry(HR, HT, 8, 30, Math.PI), mat);
        handle.position.y = TOP;
        hp.add(handle);
        hp.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
        // place the handle where the hand held the original bag, body hanging
        // below; attach to the bone so it swings with the arm (tuned live)
        hp.rotation.y = Math.PI / 2;
        hp.position.set(c.x, bb.max.y - 0.075, c.z);   // handle apex sits in the palm (same grip the headphone used)
        root.add(hp);
        root.updateMatrixWorld(true);
        bone.attach(hp);
        hp.position.add(new THREE.Vector3(0.215, -0.03, 0).applyQuaternion(hp.quaternion).multiplyScalar(0.5));
        bag.visible = false;
      }

      // vase statue -> rotating 3D Claude spark, same gridded material,
      // same pedestal, inherits the vase's spin animation
      let vase = null;
      root.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.name === 'Vase' && !vase) vase = o;
      });
      if (vase) {
        const vaseMat = vase.material;
        vase.material = vaseMat.clone();
        vase.material.visible = false;
        vase.geometry.computeBoundingBox();
        const vb = vase.geometry.boundingBox;
        const vc = vb.getCenter(new THREE.Vector3());
        const R = (vb.max.y - vb.min.y) * 0.42;
        const shape = new THREE.Shape();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? R : R * 0.34;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
        }
        shape.closePath();
        const starGeo = new THREE.ExtrudeGeometry(shape, {
          depth: R * 0.26, bevelEnabled: true,
          bevelThickness: R * 0.05, bevelSize: R * 0.05, bevelSegments: 2,
        });
        starGeo.translate(0, 0, -R * 0.13);
        const star = new THREE.Mesh(starGeo, vaseMat);
        star.position.copy(vc);
        star.frustumCulled = false;
        vase.add(star);
      }

      // ---- runway side props: payments content -> session content ----
      // generic recipe: hide a flat letter mesh, mount a canvas plane in
      // its own local frame so it inherits every transform/animation
      function swapFlatLetters(mesh, drawFn, padW) {
        mesh.material = mesh.material.clone();
        mesh.material.visible = false;
        mesh.geometry.computeBoundingBox();
        const b = mesh.geometry.boundingBox;
        const w = (b.max.x - b.min.x) * (padW || 1.04);
        const h = (b.max.z - b.min.z) * 1.12;
        const tex = makeTex(1024, Math.max(2, Math.round(1024 * h / w)), drawFn);
        const g = new THREE.PlaneGeometry(w, h);
        g.rotateX(-Math.PI / 2);
        const p = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false,
        }));
        p.position.set((b.max.x + b.min.x) / 2, 0.004, (b.max.z + b.min.z) / 2);
        p.frustumCulled = false;
        mesh.add(p);
        return p;
      }

      const COIN_GLYPHS = { Dollar: '✦', Pound: '＋', Yen: '✳', Euro: '◆' }; // mirror-safe
      root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;

        // "MAGIC CHECKOUT" sign -> LIVE DEMOS
        if (o.name === 'Text' && o.parent && o.parent.name === 'vaseCTRL001') {
          swapFlatLetters(o, (x, W, H) => {
            x.clearRect(0, 0, W, H);
            x.textAlign = 'center';
            x.fillStyle = '#f5f1ea';
            x.font = `600 ${Math.round(H * 0.46)}px Lexend, Arial, sans-serif`;
            x.fillText('LIVE', W / 2, H * 0.42);
            x.fillText('DEMOS', W / 2, H * 0.9);
          });
        }

        // "Payment Complete" toast -> the session version of done
        // (dark ink: after the recolor its pill reads cream, like the
        // "Ask me anything" bubble below it)
        if (o.name === 'Text001') {
          swapFlatLetters(o, (x, W, H) => {
            x.clearRect(0, 0, W, H);
            x.textAlign = 'center';
            x.fillStyle = '#1c1208';
            x.font = `500 ${Math.round(H * 0.76)}px Lexend, Arial, sans-serif`;
            x.fillText('Prototype Complete', W / 2, H * 0.78);
          });
        }

        // "GLOBAL CHECKOUT" sign face -> Act 3
        if (o.name === 'GlobalCheckout001') {
          swapFlatLetters(o, (x, W, H) => {
            x.clearRect(0, 0, W, H);
            x.textAlign = 'center';
            x.fillStyle = '#f5f1ea';
            x.font = `600 ${Math.round(H * 0.32)}px Lexend, Arial, sans-serif`;
            x.fillText('TOOLBOX ✦ TOUR', W / 2, H * 0.56);
          });
        }

        // currency coins -> session sparks
        const glyph = COIN_GLYPHS[o.material.name];
        if (glyph) {
          o.material = o.material.clone();
          o.material.visible = false;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          const side = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 1.05;
          const tex = makeTex(256, 256, (x, W, H) => {
            x.clearRect(0, 0, W, H);
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillStyle = '#ffffff';
            x.font = `${Math.round(H * 0.82)}px "Segoe UI Symbol", Arial, sans-serif`;
            x.fillText(glyph, W / 2, H * 0.54);
          });
          const g = new THREE.PlaneGeometry(side, side);
          g.rotateX(-Math.PI / 2);
          const p = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
            map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false,
          }));
          p.position.set((b.max.x + b.min.x) / 2, b.max.y + 0.0006, (b.max.z + b.min.z) / 2);
          p.frustumCulled = false;
          o.add(p);
        }

        // "CONVERSIONS" card -> ARTIFACTS (text is baked in the texture)
        if (o.material.name === 'AdSpends' && o.material.map && o.material.map.image) {
          const src = o.material.map;
          const img = src.image;
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          x.fillStyle = '#ffffff';
          x.fillRect(c.width * 0.05, c.height * 0.04, c.width * 0.9, c.height * 0.155);
          x.fillStyle = '#111111';
          x.textAlign = 'left';
          x.font = `700 ${Math.round(c.height * 0.105)}px Arial, sans-serif`;
          x.fillText('ARTIFACTS', c.width * 0.085, c.height * 0.165);
          const nt = new THREE.CanvasTexture(c); // no moSkip: recolor pass tints it
          nt.flipY = src.flipY;
          nt.colorSpace = src.colorSpace;
          nt.wrapS = src.wrapS; nt.wrapT = src.wrapT;
          o.material.map = nt;
          if (o.material.emissiveMap === src) o.material.emissiveMap = nt;
          o.material.needsUpdate = true;
        }
      });

      // ---- environment recolor: the whole blue scene -> miniOrange ----
      // The asset set is monochrome blue + white/black, so one hue rotation
      // (blue ~225° -> orange ~20°) converts everything; neutrals untouched.
      const HUE_SHIFT_DEG = 155; // +155° ≡ -205°: 225° blue lands on 20° orange
      const shiftedTex = new Map();
      function shiftTexture(tex) {
        if (!tex || tex.userData.moSkip) return tex;
        if (shiftedTex.has(tex)) return shiftedTex.get(tex);
        const img = tex.image;
        if (!img || !img.width) return tex;
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.filter = `hue-rotate(${HUE_SHIFT_DEG}deg)`;
        ctx.drawImage(img, 0, 0);
        const nt = new THREE.CanvasTexture(c);
        nt.flipY = tex.flipY;
        nt.colorSpace = tex.colorSpace;
        nt.wrapS = tex.wrapS;
        nt.wrapT = tex.wrapT;
        nt.anisotropy = 4;
        shiftedTex.set(tex, nt);
        return nt;
      }
      const HSL = { h: 0, s: 0, l: 0 };
      function shiftColor(col) {
        if (!col) return;
        col.getHSL(HSL);
        if (HSL.s > 0.15 && HSL.h > 0.5 && HSL.h < 0.83) { // blue-ish only
          let h = HSL.h - 205 / 360;
          if (h < 0) h += 1;
          col.setHSL(h, HSL.s, HSL.l);
        }
      }
      const doneMats = new Set();
      root.traverse((o) => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (!m || doneMats.has(m)) return;
          doneMats.add(m);
          shiftColor(m.color);
          shiftColor(m.emissive);
          if (m.map) m.map = shiftTexture(m.map);
          if (m.emissiveMap) m.emissiveMap = shiftTexture(m.emissiveMap);
          m.needsUpdate = true;
        });
      });
    } catch (e) {
      // cosmetic only — never let the rebrand break the intro
    }
  }

  function skipThreeJs() {
    renderStopped = true;
    if (isMobile) completionPermanent = true;
    if (container) container.style.display = 'none';
    if (scrollSection) scrollSection.style.display = 'none';
    if (heroSection) {
      heroSection.style.position = '';
      heroSection.style.top = '';
      heroSection.style.left = '';
      heroSection.style.width = '';
      heroSection.style.height = '';
      heroSection.style.zIndex = '';
      heroSection.style.opacity = '1';
    }
    if (heroPlaceholder) heroPlaceholder.style.display = 'none';
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('glbLoaded'));
    window.dispatchEvent(new CustomEvent('threeJsCanvas', { detail: { active: false } }));
  }

  // Mobile: skip gracefully if the GLB hasn't loaded within 6s
  let mobileGlbTimeout = null;
  if (isMobile) {
    mobileGlbTimeout = setTimeout(function () {
      if (!mixer) skipThreeJs();
    }, 6000);
  }

  loader.load(
    CONFIG.glbPath,
    (gltf) => {
      if (renderStopped) return;
      if (mobileGlbTimeout) clearTimeout(mobileGlbTimeout);
      window.__introGltf = gltf; // rebrand + debug hook
      scene.add(gltf.scene);
      rebrandIntro(gltf);
      gltf.scene.traverse((child) => {
        if (child.name === CONFIG.targetCamera || child.name.includes(CONFIG.targetCamera)) {
          if (child.isCamera) {
            glbCamera = child;
          } else {
            child.traverse((sub) => {
              if (sub.isCamera) glbCamera = sub;
            });
          }
        }
        if (child.isCamera && !glbCamera) glbCamera = child;
        if (child.isMesh) {
          if (child.material) child.material.side = THREE.DoubleSide;
          child.frustumCulled = false;
        }
      });
      if (!glbCamera && gltf.cameras.length > 0) {
        glbCamera = gltf.cameras.find(c => c.name.includes(CONFIG.targetCamera)) || gltf.cameras[0];
      }
      if (glbCamera) {
        glbCamera.aspect = window.innerWidth / window.innerHeight;
        glbCamera.near = 0.01;
        glbCamera.far = 1000;
        glbCamera.updateProjectionMatrix();
        camera = glbCamera;
      }
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.play();
        });
        animationDuration = Math.max(...gltf.animations.map(a => a.duration));
      }
      window.dispatchEvent(new CustomEvent('glbLoaded'));
      window.dispatchEvent(new CustomEvent('threeJsCanvas', { detail: { active: true } }));
    },
    undefined,
    (error) => {
      if (mobileGlbTimeout) clearTimeout(mobileGlbTimeout);
      skipThreeJs();
    }
  );

  // ---- Scroll progress drives the baked GLB animation ----
  let currentScrollProgress = 0;
  let targetScrollProgress = 0;
  function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const maxScroll = getMaxScroll();
    targetScrollProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
  }

  let isAutoScrolling = false;
  let introScrollDone = false;
  let completionTriggered = false;
  let lastCompletionTime = 0;

  function smoothScrollTo(targetY, duration, onComplete) {
    isAutoScrolling = true;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const startTime = performance.now();
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, startY + distance * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        isAutoScrolling = false;
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  // Small automatic scroll-in right after the loader exits, so the scene
  // visibly "lifts off" without any user input.
  function startIntroScroll() {
    if (introScrollDone || window.scrollY > 0) return;
    const maxScroll = getMaxScroll();
    smoothScrollTo(maxScroll * 0.02, 1200, () => { introScrollDone = true; });
  }
  function triggerCompletionScroll() {
    if (completionTriggered) return;
    completionTriggered = true;
    smoothScrollTo(sectionBottom, 1500);
  }

  window.addEventListener('scroll', () => {
    updateScrollProgress();
    // Scrolling back up into the 3D section: re-enter mid-animation
    if (renderStopped && !completionPermanent && window.scrollY < sectionBottom) {
      renderStopped = false;
      if (isMobile) {
        completionTriggered = true;
        setTimeout(function () { completionTriggered = false; }, 2500);
      } else {
        completionTriggered = false;
      }
      const snapTarget = getMaxScroll() * 0.7;
      window.scrollTo(0, snapTarget);
      targetScrollProgress = 0.7;
      currentScrollProgress = 0.7;
      container.style.opacity = '1';
      container.style.pointerEvents = '';
      if (heroSection && !heroIsFixed) {
        heroSection.style.position = 'fixed';
        heroSection.style.top = '0';
        heroSection.style.left = '0';
        heroSection.style.width = '100%';
        heroSection.style.height = '100vh';
        heroSection.style.zIndex = '1';
        if (heroPlaceholder) heroPlaceholder.style.display = 'block';
        heroIsFixed = true;
      }
      window.dispatchEvent(new CustomEvent('threeJsCanvas', { detail: { active: true } }));
      requestAnimationFrame(animate);
    }
    if (window.scrollY <= sectionBottom) {
      if (completionTriggered && targetScrollProgress < 0.60) {
        completionTriggered = false;
      }
      // Near the end of the runway: glide the rest of the way automatically
      if (!completionTriggered && !completionPermanent && targetScrollProgress >= (isMobile ? 0.85 : 0.98)) {
        const now = Date.now();
        if (now - lastCompletionTime > 2500) {
          lastCompletionTime = now;
          triggerCompletionScroll();
        }
      }
    }
  }, { passive: true });

  window.addEventListener('loaderExited', () => {
    requestAnimationFrame(startIntroScroll);
  });

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  let lastTime = 0;
  const _savedPos = new THREE.Vector3();
  const _savedRot = new THREE.Euler();

  function animate(currentTime) {
    if (renderStopped) return;
    requestAnimationFrame(animate);
    try {
      const gl = renderer.getContext();
      if (gl && gl.isContextLost()) return;
    } catch (e) { return; }
    const delta = currentTime - lastTime;
    if (delta < 16) return;
    lastTime = currentTime;

    // Self-heal if the viewport changed without a resize event
    const canvasEl = renderer.domElement;
    if (canvasEl.clientWidth !== window.innerWidth || canvasEl.clientHeight !== window.innerHeight) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    currentScrollProgress = lerp(currentScrollProgress, targetScrollProgress, 0.05);
    if (Math.abs(currentScrollProgress - targetScrollProgress) < 0.005) {
      currentScrollProgress = targetScrollProgress;
    }

    if (mixer && animationDuration > 0) {
      const targetTime = Math.min(currentScrollProgress * animationDuration, animationDuration - 0.01);
      mixer.setTime(targetTime);
      if (glbCamera) {
        glbCamera.near = 0.001;
        glbCamera.far = 1000;
        glbCamera.updateProjectionMatrix();
      }
    }

    const scrollTop = window.scrollY;
    if (heroSection) {
      if (scrollTop >= sectionBottom) {
        // Past the runway: hand the page back to normal document flow
        if (heroIsFixed) {
          heroSection.style.position = '';
          heroSection.style.top = '';
          heroSection.style.left = '';
          heroSection.style.width = '';
          heroSection.style.height = '';
          heroSection.style.zIndex = '';
          heroSection.style.opacity = '1';
          if (heroPlaceholder) heroPlaceholder.style.display = 'none';
          heroIsFixed = false;
        }
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        renderStopped = true;
        window.dispatchEvent(new CustomEvent('threeJsCanvas', { detail: { active: false } }));
        return;
      } else {
        if (!heroIsFixed) {
          heroSection.style.position = 'fixed';
          heroSection.style.top = '0';
          heroSection.style.left = '0';
          heroSection.style.width = '100%';
          heroSection.style.height = '100vh';
          heroSection.style.zIndex = '1';
          if (heroPlaceholder) heroPlaceholder.style.display = 'block';
          heroIsFixed = true;
        }
        container.style.pointerEvents = '';
        // Final 1%: crossfade canvas -> hero fold
        if (currentScrollProgress >= 0.99) {
          const fadeProgress = Math.min((currentScrollProgress - 0.99) / 0.01, 1);
          container.style.opacity = String(1 - fadeProgress);
          heroSection.style.opacity = String(fadeProgress);
        } else {
          container.style.opacity = '1';
          heroSection.style.opacity = '0';
        }
      }
    }

    // Mouse parallax is additive per-frame on top of the baked camera
    // animation, so save/restore around the render call.
    _savedPos.copy(camera.position);
    _savedRot.copy(camera.rotation);
    const intensityProgress = Math.min(currentScrollProgress / 0.3, 1.0);
    const dynamicHorizontalIntensity = lerp(
      CONFIG.parallax.horizontalIntensityMin,
      CONFIG.parallax.horizontalIntensityMax,
      intensityProgress
    );
    const shouldDisableParallax = CONFIG.mobile.disableParallax && (window.innerWidth < CONFIG.mobile.parallaxBreakpoint);
    const parallaxEnabled = CONFIG.parallax.enabled && !shouldDisableParallax;
    if (parallaxEnabled && glbCamera && mixer) {
      mouse.x = lerp(mouse.x, mouse.targetX, CONFIG.parallax.smoothness);
      mouse.y = lerp(mouse.y, mouse.targetY, CONFIG.parallax.smoothness);
      camera.position.x += mouse.x * dynamicHorizontalIntensity;
      camera.position.y += mouse.y * CONFIG.parallax.verticalIntensity;
      camera.position.y = Math.min(camera.position.y, 0.6);
      camera.rotation.y -= mouse.x * CONFIG.parallax.rotationIntensity;
    }
    if (window.innerWidth < CONFIG.mobile.breakpoint) {
      camera.position.x += CONFIG.mobile.cameraOffsetX;
    }
    renderer.render(scene, camera);
    camera.position.copy(_savedPos);
    camera.rotation.copy(_savedRot);
  }
  animate(0);

  let resizeTimeout;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (renderStopped) return;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const widthChanged = newWidth !== lastWidth;
      const bigHeightChange = Math.abs(newHeight - stableViewportHeight) > 100;
      if (widthChanged || bigHeightChange) {
        stableViewportHeight = newHeight;
        lastWidth = newWidth;
      }
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    }, 100);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === ' ') window.scrollBy(0, 200);
    if (e.key === 'ArrowUp') window.scrollBy(0, -200);
  });
} catch (fatalError) {
  // fatal error — animation silently disabled
}
