/* register.js — simplified flow: pick a seat → your details (name / email /
   designation) → a gamified reveal of your 3D VIP pass + badge + countdown.
   Vanilla + GSAP + three.js (lazy-loaded only when the pass is built, so the
   seat map and form work instantly). Roles, avatars and the loadout step removed. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const SESSION_DATE = new Date('2026-06-26T11:00:00+05:30');
  const ROWS = ['A', 'B', 'C', 'D', 'E'];
  const COLS = 4;                       // 2 + aisle + 2
  const TOTAL = ROWS.length * COLS;     // 20
  const INITIAL_TAKEN = 0;              // honest seat map — no fake fill
  const STORE_KEY = 'moClaudeReg';
  const HW_KEY = 'moClaudeHomework';

  const hasGsap = typeof window.gsap !== 'undefined';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { seat: null, name: '', email: '', designation: '', registered: false };

  /* ---------- toast ---------- */
  function toast(html, ms = 3400) {
    const wrap = $('#toasts'); if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'reg-toast'; el.innerHTML = html;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 400); }, ms);
  }

  /* ---------- steps ---------- */
  const STEP_ORDER = ['seat', 'you', 'pass'];
  let currentStep = 'seat';
  function goto(step) {
    currentStep = step;
    document.querySelectorAll('.reg-step').forEach((s) => s.classList.toggle('is-current', s.dataset.step === step));
    document.querySelectorAll('.reg-progress__dot').forEach((d) => {
      const idx = STEP_ORDER.indexOf(d.dataset.goto), cur = STEP_ORDER.indexOf(step);
      d.classList.toggle('is-active', idx === cur);
      d.classList.toggle('is-done', idx < cur);
    });
    window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
  }
  document.querySelectorAll('.reg-progress__dot').forEach((d) => {
    d.addEventListener('click', () => {
      const target = d.dataset.goto;
      if (target === 'you' && !state.seat) return;
      if (target === 'pass' && !state.registered) return;
      goto(target);
    });
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.back)));

  /* ======================================================================
     STEP 1 — SEAT MAP
     ====================================================================== */
  const seatMapEl = $('#seat-map');
  const seats = new Map();
  let selectedSeat = null;
  const saved = loadSaved();

  function buildSeatMap() {
    ROWS.forEach((row) => {
      const rowEl = document.createElement('div'); rowEl.className = 'seat-row';
      const lab = document.createElement('span'); lab.className = 'seat-row__label'; lab.textContent = row;
      rowEl.appendChild(lab);
      for (let c = 1; c <= COLS; c++) {
        if (c === 3) { const aisle = document.createElement('span'); aisle.className = 'seat-aisle'; rowEl.appendChild(aisle); }
        const id = row + c;
        const btn = document.createElement('button');
        btn.className = 'seat'; btn.dataset.seat = id; btn.type = 'button';
        btn.setAttribute('aria-label', 'Seat ' + id);
        btn.addEventListener('click', () => onSeatClick(id));
        rowEl.appendChild(btn);
        seats.set(id, { el: btn, taken: false, mine: false });
      }
      const lab2 = lab.cloneNode(true); rowEl.appendChild(lab2);
      seatMapEl.appendChild(rowEl);
    });
    const ids = [...seats.keys()].filter((id) => id !== (saved && saved.seat));
    shuffle(ids).slice(0, INITIAL_TAKEN).forEach((id) => setTaken(id, true));
    if (saved && saved.seat) { const s = seats.get(saved.seat); if (s) { s.mine = true; s.el.classList.add('is-mine'); } }
    updateSeatStats();
  }
  function onSeatClick(id) {
    const s = seats.get(id);
    if (!s || s.taken || s.mine || state.registered) return;
    if (selectedSeat && seats.get(selectedSeat)) seats.get(selectedSeat).el.classList.remove('is-selected');
    selectedSeat = id; state.seat = id;
    s.el.classList.add('is-selected');
    const cta = $('#cta-seat'); cta.disabled = false; cta.textContent = 'Lock seat ' + id + ' →';
    const yl = $('#you-seat-label'); if (yl) yl.textContent = id;
    if (hasGsap && !REDUCE) gsap.fromTo(s.el, { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }
  function setTaken(id, silent) {
    const s = seats.get(id); if (!s || s.taken || s.mine) return;
    s.taken = true; s.el.classList.add('is-taken'); s.el.disabled = true;
  }
  function freeCount() { let f = 0; seats.forEach((s) => { if (!s.taken && !s.mine) f++; }); return f; }
  function updateSeatStats() {
    const left = freeCount(); const el = $('#seats-left'); if (!el) return;
    el.textContent = left;
    const bar = $('#seats-bar'); if (bar) bar.style.width = ((TOTAL - left) / TOTAL * 100) + '%';
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  $('#cta-seat').addEventListener('click', () => { if (state.seat) goto('you'); });

  /* ======================================================================
     STEP 2 — YOUR DETAILS
     ====================================================================== */
  const inpName = $('#inp-name'), inpEmail = $('#inp-email'), inpDesig = $('#inp-designation');
  function validateYou() {
    state.name = inpName.value.trim();
    state.email = inpEmail.value.trim();
    state.designation = inpDesig.value.trim();
    const ok = state.name.length >= 2 && state.designation.length >= 2;
    const cta = $('#cta-you'); cta.disabled = !ok;
    cta.textContent = ok ? 'Make my VIP pass →' : 'Name + designation to continue';
  }
  [inpName, inpEmail, inpDesig].forEach((i) => i && i.addEventListener('input', validateYou));
  $('#cta-you').addEventListener('click', () => { if (!$('#cta-you').disabled) finalize(true); });

  /* ======================================================================
     FINALIZE → PASS
     ====================================================================== */
  let fontsRedrawDone = false;
  function finalize(fresh) {
    state.registered = true;
    if (!fontsRedrawDone && document.fonts && document.fonts.status !== 'loaded') {
      fontsRedrawDone = true;
      document.fonts.ready.then(() => { if (state.registered) buildTicket3D(); });
    }
    const s = seats.get(state.seat);
    if (s) { s.mine = true; s.el.classList.remove('is-selected'); s.el.classList.add('is-mine'); }
    save();
    buildTicket3D();
    buildBadge();
    startCountdown();
    goto('pass');
    const head = $('#pass-headline');
    if (head) head.textContent = firstName(state.name) + ", you're in. Seat " + state.seat + '.';
    if (fresh) {
      if (!REDUCE) setTimeout(confettiBurst, 450);
      toast('Locked. <b>' + state.seat + '</b> is officially yours.');
    }
  }
  function firstName(n) { return (n || 'Designer').split(/\s+/)[0]; }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ seat: state.seat, name: state.name, email: state.email, designation: state.designation })); } catch (e) {}
  }
  function loadSaved() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } }
  $('#btn-reset').addEventListener('click', () => { try { localStorage.removeItem(STORE_KEY); } catch (e) {} location.reload(); });

  /* ======================================================================
     PASS — 2D canvas faces + 3D WebGL card
     ====================================================================== */
  const TICKET_W = 1280, TICKET_H = 600, R = 30;
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function clip(ctx, text, maxW) { let t = text; while (ctx.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2); return t === text ? t : t + '…'; }

  function drawFront(data) {
    const c = document.createElement('canvas'); c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');
    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R); x.save(); x.clip();
    x.fillStyle = '#16110d'; x.fillRect(0, 0, TICKET_W, TICKET_H);
    const glow = x.createRadialGradient(220, -80, 0, 220, -80, 900);
    glow.addColorStop(0, 'rgba(255,122,26,0.32)'); glow.addColorStop(0.5, 'rgba(255,122,26,0.07)'); glow.addColorStop(1, 'rgba(255,122,26,0)');
    x.fillStyle = glow; x.fillRect(0, 0, TICKET_W, TICKET_H);
    x.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 40; i < TICKET_W - 320; i += 36) for (let j = 40; j < TICKET_H; j += 36) { x.beginPath(); x.arc(i, j, 1.5, 0, 7); x.fill(); }
    const STUB_X = 960;
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '500 22px "IBM Plex Mono", monospace';
    x.fillText('MINIORANGE × CLAUDE · IN-HOUSE', 64, 84);
    const grad = x.createLinearGradient(64, 0, 760, 0); grad.addColorStop(0, '#ffb066'); grad.addColorStop(1, '#f25c05');
    x.fillStyle = grad; x.font = "700 76px Fraunces, serif"; x.fillText("CLAUDE SESSION '26", 60, 168);
    x.fillStyle = 'rgba(255,255,255,0.45)'; x.font = '400 20px "IBM Plex Mono", monospace';
    x.fillText('ADMIT ONE — DESIGN TEAM ONLY', 64, 208);
    x.fillStyle = '#ffffff'; x.font = '600 58px Fraunces, serif'; x.fillText(clip(x, data.name, 820), 64, 322);
    x.fillStyle = '#ff7d1f'; x.font = '400 27px "Space Grotesk", sans-serif'; x.fillText(clip(x, data.designation, 820), 64, 366);
    x.fillStyle = 'rgba(255,255,255,0.42)'; x.font = '400 19px "IBM Plex Mono", monospace';
    x.fillText('HOSTED LIVE BY SURAJIT DUTTA · NO SLIDES, ALL DEMOS', 64, 462);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '400 21px "IBM Plex Mono", monospace';
    x.fillText('FRI 26 JUN 2026 · 11:00 · MINIORANGE HQ', 64, 500);
    let bx = 64; x.fillStyle = 'rgba(255,255,255,0.8)';
    while (bx < 480) { const w = 2 + Math.random() * 7; if (Math.random() > 0.35) x.fillRect(bx, 528, w, 40); bx += w + 3; }
    x.strokeStyle = 'rgba(255,255,255,0.3)'; x.setLineDash([4, 10]); x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(STUB_X, 18); x.lineTo(STUB_X, TICKET_H - 18); x.stroke(); x.setLineDash([]);
    const sg = x.createLinearGradient(STUB_X, 0, TICKET_W, TICKET_H);
    sg.addColorStop(0, 'rgba(255,122,26,0.16)'); sg.addColorStop(1, 'rgba(255,122,26,0.02)');
    x.fillStyle = sg; x.fillRect(STUB_X, 0, TICKET_W - STUB_X, TICKET_H);
    x.save(); x.translate(STUB_X + 60, TICKET_H / 2); x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(255,138,42,0.85)'; x.font = "700 44px Fraunces, serif"; x.textAlign = 'center'; x.fillText('★ VIP ★', 0, 0); x.restore();
    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.font = '400 18px "IBM Plex Mono", monospace'; x.fillText('SEAT', STUB_X + 170, 230);
    x.fillStyle = '#ffffff'; x.font = "700 110px Fraunces, serif"; x.fillText(data.seat, STUB_X + 170, 348);
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.font = '400 15px "IBM Plex Mono", monospace';
    x.fillText('NON-TRANSFERABLE', STUB_X + 170, 420); x.fillText('(NICE TRY)', STUB_X + 170, 446); x.textAlign = 'left';
    x.strokeStyle = 'rgba(255,138,42,0.5)'; x.lineWidth = 3; roundRectPath(x, 2, 2, TICKET_W - 4, TICKET_H - 4, R - 2); x.stroke();
    x.restore(); return c;
  }
  function drawBack() {
    const c = document.createElement('canvas'); c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');
    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R); x.save(); x.clip();
    x.fillStyle = '#16110d'; x.fillRect(0, 0, TICKET_W, TICKET_H);
    const glow = x.createRadialGradient(TICKET_W - 160, TICKET_H + 80, 0, TICKET_W - 160, TICKET_H + 80, 900);
    glow.addColorStop(0, 'rgba(255,122,26,0.25)'); glow.addColorStop(1, 'rgba(255,122,26,0)');
    x.fillStyle = glow; x.fillRect(0, 0, TICKET_W, TICKET_H);
    x.strokeStyle = 'rgba(255,138,42,0.35)'; x.lineWidth = 2; x.font = "700 110px Fraunces, serif";
    x.strokeText('CLAUDE', 80, 200); x.strokeText("SESSION '26", 80, 320);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '400 21px "IBM Plex Mono", monospace';
    ['1 · BRIEF IT LIKE A JUNIOR, JUDGE IT LIKE A DIRECTOR', '2 · NEW TASK, NEW CHAT', '3 · CONTEXT IS CURRENCY', '4 · THE FIRST OUTPUT IS A SKETCH, NEVER A COMP', '5 · YOUR TASTE IS THE PRODUCT']
      .forEach((r, i) => x.fillText(r, 80, 400 + i * 38));
    x.strokeStyle = 'rgba(255,138,42,0.5)'; x.lineWidth = 3; roundRectPath(x, 2, 2, TICKET_W - 4, TICKET_H - 4, R - 2); x.stroke();
    x.restore(); return c;
  }

  let three = null, frontCanvas = null;
  function buildTicket3D() {
    frontCanvas = drawFront({ name: state.name || 'Mystery Designer', designation: state.designation || 'Designer', seat: state.seat || '??' });
    const backCanvas = drawBack();
    const holder = $('#ticket-3d'); if (!holder) return;
    import('three').then((THREE) => {
    if (three) { cancelAnimationFrame(three.raf); three.renderer.dispose(); holder.innerHTML = ''; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { frontCanvas.style.width = '100%'; frontCanvas.style.height = 'auto'; frontCanvas.style.borderRadius = '18px'; holder.appendChild(frontCanvas); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0);
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 50); camera.position.set(0, 0, 6.4);
    const W = 4.2, H = 4.2 * (TICKET_H / TICKET_W);
    const group = new THREE.Group(); scene.add(group);
    const frontTex = new THREE.CanvasTexture(frontCanvas), backTex = new THREE.CanvasTexture(backCanvas);
    frontTex.anisotropy = 8; backTex.anisotropy = 8; frontTex.colorSpace = THREE.SRGBColorSpace; backTex.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })); front.position.z = 0.012;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: backTex, transparent: true })); back.rotation.y = Math.PI; back.position.z = -0.012;
    group.add(front, back);
    const holoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uShift: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uShift; float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))-r; } void main(){ float d=rbox(vUv-0.5, vec2(0.5), 0.055); if(d>0.0) discard; float g=sin((vUv.x*1.6+vUv.y*0.7)*6.2831+uShift); float band=pow(max(g,0.0),4.0); vec3 holo=mix(vec3(1.0,0.55,0.18), vec3(1.0,0.9,0.75), vUv.y); gl_FragColor=vec4(holo, band*0.22); }',
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), holoMat); holo.position.z = 0.02; group.add(holo);
    const sparkGeo = new THREE.BufferGeometry(); const N = 70; const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * (W + 2.4); pos[i * 3 + 1] = (Math.random() - 0.5) * (H + 2.0); pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6; }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffb066, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(sparkGeo, sparkMat));
    let dragging = false, px = 0, py = 0, targetRY = 0, targetRX = 0;
    holder.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; holder.setPointerCapture(e.pointerId); });
    holder.addEventListener('pointermove', (e) => { if (!dragging) return; targetRY += (e.clientX - px) * 0.008; targetRX += (e.clientY - py) * 0.006; targetRX = Math.max(-0.6, Math.min(0.6, targetRX)); px = e.clientX; py = e.clientY; });
    const endDrag = () => { dragging = false; }; holder.addEventListener('pointerup', endDrag); holder.addEventListener('pointercancel', endDrag);
    function resize() { const w = holder.clientWidth || 1, h = holder.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); new ResizeObserver(resize).observe(holder);
    let t = 0, last = performance.now();
    function frame(now) {
      three.raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      t += dt;
      if (REDUCE) { renderer.render(scene, camera); return; }
      if (!dragging) { targetRY += (Math.sin(t * 0.5) * 0.22 - targetRY) * dt * 0.7; targetRX += (Math.sin(t * 0.7) * 0.07 - targetRX) * dt * 0.7; }
      group.rotation.y += (targetRY - group.rotation.y) * Math.min(1, dt * 7);
      group.rotation.x += (targetRX - group.rotation.x) * Math.min(1, dt * 7);
      group.position.y = Math.sin(t * 1.1) * 0.06; group.rotation.z = Math.sin(t * 0.6) * 0.015;
      holoMat.uniforms.uShift.value = group.rotation.y * 3.0 + t * 0.6;
      sparkMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;
      renderer.render(scene, camera);
    }
    three = { renderer, scene, camera, group, holo, raf: 0 };
    three.raf = requestAnimationFrame(frame);
    if (hasGsap && !REDUCE) {
      gsap.fromTo(group.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(1.6)' });
      gsap.fromTo(group.rotation, { y: -2.4 }, { y: 0, duration: 1.1, ease: 'power3.out' });
    }
    }).catch(() => { frontCanvas.style.width = '100%'; frontCanvas.style.height = 'auto'; frontCanvas.style.borderRadius = '18px'; holder.appendChild(frontCanvas); });
  }

  $('#btn-download').addEventListener('click', () => {
    if (!frontCanvas) return;
    const a = document.createElement('a');
    a.download = 'claude-session-26-' + (state.seat || 'pass').toLowerCase() + '.png';
    a.href = frontCanvas.toDataURL('image/png'); a.click();
  });

  /* ======================================================================
     BADGE
     ====================================================================== */
  function buildBadge() {
    const wrap = $('#badge-wrap'); if (!wrap) return;
    wrap.innerHTML =
      '<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="bgrad" x1="0" y1="0" x2="160" y2="160"><stop stop-color="#ffb066"/><stop offset="1" stop-color="#f25c05"/></linearGradient>' +
      '<radialGradient id="bcore" cx=".5" cy=".35" r=".8"><stop stop-color="#3a2a1c"/><stop offset="1" stop-color="#1b1410"/></radialGradient></defs>' +
      '<circle class="badge-ring" cx="80" cy="80" r="74" fill="none" stroke="url(#bgrad)" stroke-width="2.5" stroke-dasharray="5 9" stroke-linecap="round"/>' +
      '<circle cx="80" cy="80" r="61" fill="url(#bcore)" stroke="url(#bgrad)" stroke-width="3"/>' +
      '<text x="80" y="40" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="#ffb066">✦ \'26 ✦</text>' +
      '<path d="M80 60 l5 14 15 1 -12 10 4 15 -12 -8 -12 8 4 -15 -12 -10 15 -1z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
      '<text x="80" y="118" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" letter-spacing="3" fill="#fff">VIP</text>' +
      '<text x="80" y="134" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" letter-spacing="2" fill="rgba(255,255,255,.6)">SEAT ' + (state.seat || '—') + '</text>' +
      '</svg>';
    $('#badge-name').textContent = 'Front-row VIP';
    $('#badge-desc').textContent = 'Awarded to ' + (state.name || 'a mysterious designer') + ' — ' + (state.designation || 'designer') + ', seat ' + state.seat + '. Redeemable at the door for exactly zero rupees and maximum bragging rights.';
    if (hasGsap && !REDUCE) gsap.from('#badge-wrap svg', { scale: 0.4, opacity: 0, rotate: -30, duration: 0.8, delay: 0.3, ease: 'back.out(1.8)', transformOrigin: 'center' });
  }

  /* ======================================================================
     CONFETTI
     ====================================================================== */
  function confettiBurst() {
    const canvas = $('#confetti'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * DPR; canvas.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const COLORS = ['#ff7d1f', '#f25c05', '#ffd166', '#efe6d2', '#1d6e6b', '#4d9965'];
    const parts = [];
    for (let i = 0; i < 150; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5, v = 7 + Math.random() * 9;
      parts.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 160, y: innerHeight * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, rot: Math.random() * 7, vr: (Math.random() - 0.5) * 0.3, color: COLORS[i % COLORS.length], life: 1 });
    }
    let last = performance.now();
    (function frame(now) {
      const dt = Math.min((now - last) / 16.7, 2.2); last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight); let alive = 0;
      for (const p of parts) {
        p.vy += 0.22 * dt; p.vx *= 0.992; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.004 * dt;
        if (p.life <= 0 || p.y > innerHeight + 30) continue; alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.sin(p.rot * 2)) * 0.6)); ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(performance.now());
  }

  /* ======================================================================
     COUNTDOWN + HOMEWORK
     ====================================================================== */
  let cdTimer = null;
  function startCountdown() {
    clearInterval(cdTimer);
    const tick = () => {
      const diff = Math.max(0, SESSION_DATE - Date.now());
      $('#cd-d').textContent = Math.floor(diff / 86400000);
      $('#cd-h').textContent = String(Math.floor(diff / 3600000) % 24).padStart(2, '0');
      $('#cd-m').textContent = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
      $('#cd-s').textContent = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
      if (diff === 0) { clearInterval(cdTimer); const w = $('#wait-title'); if (w) w.textContent = 'Your intern is in the building. Go!'; }
    };
    tick(); cdTimer = setInterval(tick, 1000);
  }
  (function homework() {
    let done = []; try { done = JSON.parse(localStorage.getItem(HW_KEY) || '[]'); } catch (e) {}
    document.querySelectorAll('[data-hw]').forEach((cb) => {
      cb.checked = done.includes(cb.dataset.hw);
      cb.addEventListener('change', () => {
        const set = new Set(done); cb.checked ? set.add(cb.dataset.hw) : set.delete(cb.dataset.hw); done = [...set];
        try { localStorage.setItem(HW_KEY, JSON.stringify(done)); } catch (e) {}
        if (cb.checked) toast('Homework saved. Gold star pending.');
      });
    });
  })();

  /* ======================================================================
     BOOT
     ====================================================================== */
  buildSeatMap();
  if (saved && saved.seat && saved.name) {
    state.seat = saved.seat; state.name = saved.name; state.email = saved.email || ''; state.designation = saved.designation || 'Designer';
    if (inpName) inpName.value = state.name;
    if (inpEmail) inpEmail.value = state.email;
    if (inpDesig) inpDesig.value = state.designation;
    const yl = $('#you-seat-label'); if (yl) yl.textContent = state.seat;
    finalize(false);
  }
})();
