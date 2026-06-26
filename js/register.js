/* register.js — "Liber Claude" flow: choose a place → name the caster (name /
   email / craft) → a gamified reveal of your 3D sealed pass + sigil + countdown.
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
  const STEP_ORDER = ['you', 'pass'];
  let currentStep = 'you';
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
      if (target === 'pass' && !state.registered) return;
      goto(target);
    });
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.back)));

  const saved = loadSaved();

  /* ======================================================================
     STEP 1 — YOUR DETAILS
     ====================================================================== */
  const inpName = $('#inp-name'), inpEmail = $('#inp-email'), inpDesig = $('#inp-designation');
  function validateYou() {
    state.name = inpName.value.trim();
    state.email = inpEmail.value.trim();
    state.designation = inpDesig.value.trim();
    const ok = state.name.length >= 2 && state.designation.length >= 2;
    const cta = $('#cta-you'); cta.disabled = !ok;
    cta.textContent = ok ? 'Seal my pass →' : 'Name + craft to continue';
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
    save();
    buildTicket3D();
    startCountdown();
    goto('pass');
    const head = $('#pass-headline');
    if (head) head.textContent = firstName(state.name) + ", your pass is sealed.";
    if (fresh) {
      if (!REDUCE) setTimeout(confettiBurst, 450);
      toast('Sealed. Your pass awaits.');
    }
  }
  function firstName(n) { return (n || 'Caster').split(/\s+/)[0]; }

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

  /* ---- gilt + wax canvas helpers (echo /home's book.js paper() ornament) ---- */
  function goldGrad(x, x0, y0, x1, y1) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#8a5e1a'); g.addColorStop(0.5, '#caa24a'); g.addColorStop(1, '#8a5e1a');
    return g;
  }
  function fleuron(x, cx, cy, s, rot) {
    x.save(); x.translate(cx, cy); x.rotate(rot || 0);
    x.fillStyle = 'rgba(156,106,28,0.85)';
    x.beginPath(); x.moveTo(0, 0);
    x.bezierCurveTo(s * 0.5, -s * 0.3, s * 0.8, s * 0.2, 0, s);
    x.bezierCurveTo(-s * 0.8, s * 0.2, -s * 0.5, -s * 0.3, 0, 0);
    x.fill();
    x.beginPath(); x.arc(0, -s * 0.22, s * 0.2, 0, 7); x.fill();
    x.restore();
  }
  function giltFrame(x) {
    x.strokeStyle = goldGrad(x, 0, 0, TICKET_W, 0); x.lineWidth = 3;
    roundRectPath(x, 14, 14, TICKET_W - 28, TICKET_H - 28, R - 4); x.stroke();
    x.strokeStyle = 'rgba(156,106,28,0.5)'; x.lineWidth = 1.4;
    roundRectPath(x, 24, 24, TICKET_W - 48, TICKET_H - 48, R - 8); x.stroke();
    fleuron(x, 46, 46, 13, Math.PI * 0.25); fleuron(x, TICKET_W - 46, 46, 13, Math.PI * 0.75);
    fleuron(x, TICKET_W - 46, TICKET_H - 46, 13, Math.PI * 1.25); fleuron(x, 46, TICKET_H - 46, 13, -Math.PI * 0.25);
  }
  function drawWaxSeal(x, cx, cy, r) {
    x.save();
    x.shadowColor = 'rgba(90,40,20,0.40)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#d65a2c'); g.addColorStop(0.45, '#c0451f'); g.addColorStop(0.78, '#a3380f'); g.addColorStop(1, '#7c1d10');
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (0.94 + Math.sin(a * 5) * 0.045), px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.closePath(); x.fill();
    x.shadowColor = 'transparent';
    x.strokeStyle = 'rgba(94,22,12,0.6)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r * 0.74, 0, 7); x.stroke();
    x.fillStyle = '#5e160c'; x.font = '900 ' + Math.round(r * 0.95) + 'px Cinzel, serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('C', cx, cy + r * 0.04);
    x.restore();
  }

  function drawFront(data) {
    const c = document.createElement('canvas'); c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');
    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R); x.save(); x.clip();
    // aged parchment ground
    x.fillStyle = '#efe3c6'; x.fillRect(0, 0, TICKET_W, TICKET_H);
    let g = x.createRadialGradient(300, -60, 0, 300, -60, 1000);
    g.addColorStop(0, 'rgba(255,250,235,0.75)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    x.fillStyle = g; x.fillRect(0, 0, TICKET_W, TICKET_H);
    g = x.createRadialGradient(TICKET_W - 180, TICKET_H + 40, 0, TICKET_W - 180, TICKET_H + 40, 720);
    g.addColorStop(0, 'rgba(150,110,50,0.16)'); g.addColorStop(1, 'rgba(150,110,50,0)');
    x.fillStyle = g; x.fillRect(0, 0, TICKET_W, TICKET_H);
    x.fillStyle = 'rgba(90,66,30,0.05)';
    for (let i = 0; i < 260; i++) x.fillRect(Math.random() * TICKET_W, Math.random() * TICKET_H, 1.4, 1.4);
    const STUB_X = 960;
    x.fillStyle = '#6a5230'; x.font = '600 24px "Cinzel", serif';
    x.fillText('MINIORANGE × CLAUDE · THE INNER CIRCLE', 64, 86);
    const grad = x.createLinearGradient(60, 0, 820, 0);
    grad.addColorStop(0, '#9c6a1c'); grad.addColorStop(0.5, '#caa24a'); grad.addColorStop(1, '#9c6a1c');
    x.fillStyle = grad; x.font = "900 72px Cinzel, serif"; x.fillText("CLAUDE SESSION '26", 60, 170);
    x.fillStyle = '#7a6038'; x.font = '400 21px "Cinzel", serif';
    x.fillText('ADMIT ONE — THE INNER CIRCLE', 64, 210);
    x.fillStyle = '#3a2c18'; x.font = '700 58px Cinzel, serif'; x.fillText(clip(x, data.name, 820), 64, 326);
    x.fillStyle = '#a3380f'; x.font = 'italic 400 31px "EB Garamond", serif'; x.fillText(clip(x, data.designation, 820), 64, 372);
    x.fillStyle = '#6a5230'; x.font = '400 20px "Cinzel", serif';
    x.fillText('CONJURED LIVE BY SURAJIT DUTTA · NO SLIDES, ONLY SPELLS', 64, 466);
    x.fillStyle = '#5a4524'; x.font = '400 21px "Cinzel", serif';
    x.fillText('FRI 26 JUN 2026 · 11:00 · MINIORANGE HQ', 64, 504);
    let bx = 64; x.fillStyle = 'rgba(120,86,40,0.7)';
    while (bx < 470) { const w = 2 + Math.random() * 7; if (Math.random() > 0.35) x.fillRect(bx, 528, w, 36); bx += w + 4; }
    x.strokeStyle = 'rgba(124,29,16,0.45)'; x.setLineDash([4, 10]); x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(STUB_X, 18); x.lineTo(STUB_X, TICKET_H - 18); x.stroke(); x.setLineDash([]);
    const sg = x.createLinearGradient(STUB_X, 0, TICKET_W, TICKET_H);
    sg.addColorStop(0, 'rgba(181,138,50,0.14)'); sg.addColorStop(1, 'rgba(181,138,50,0.03)');
    x.fillStyle = sg; x.fillRect(STUB_X, 0, TICKET_W - STUB_X, TICKET_H);
    x.save(); x.translate(STUB_X + 54, TICKET_H / 2); x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(156,106,28,0.9)'; x.font = "700 34px Cinzel, serif"; x.textAlign = 'center'; x.fillText('✦ SEALED ✦', 0, 0); x.restore();
    x.textAlign = 'center';
    x.fillStyle = '#6a5230'; x.font = '400 18px "Cinzel", serif'; x.fillText('ADMIT', STUB_X + 168, 248);
    x.fillStyle = '#3a2c18'; x.font = "900 92px Cinzel, serif"; x.fillText('ONE', STUB_X + 168, 338);
    x.fillStyle = '#7a6038'; x.font = '400 15px "Cinzel", serif';
    x.fillText('BOUND TO BEARER', STUB_X + 168, 420); x.fillText('(NO SCALPING SPELLS)', STUB_X + 168, 446); x.textAlign = 'left';
    drawWaxSeal(x, STUB_X, TICKET_H - 92, 46);
    giltFrame(x);
    x.restore(); return c;
  }
  function drawBack() {
    const c = document.createElement('canvas'); c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');
    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R); x.save(); x.clip();
    x.fillStyle = '#efe3c6'; x.fillRect(0, 0, TICKET_W, TICKET_H);
    const g = x.createRadialGradient(TICKET_W - 160, TICKET_H + 80, 0, TICKET_W - 160, TICKET_H + 80, 900);
    g.addColorStop(0, 'rgba(150,110,50,0.14)'); g.addColorStop(1, 'rgba(150,110,50,0)');
    x.fillStyle = g; x.fillRect(0, 0, TICKET_W, TICKET_H);
    x.fillStyle = 'rgba(90,66,30,0.05)';
    for (let i = 0; i < 200; i++) x.fillRect(Math.random() * TICKET_W, Math.random() * TICKET_H, 1.4, 1.4);
    x.strokeStyle = 'rgba(156,106,28,0.5)'; x.lineWidth = 2; x.font = "900 104px Cinzel, serif";
    x.strokeText('CLAUDE', 80, 196); x.strokeText("SESSION '26", 80, 312);
    x.fillStyle = '#5a4524'; x.font = '400 21px "Cinzel", serif';
    ['I · BRIEF LIKE AN APPRENTICE, JUDGE LIKE A MASTER', 'II · NEW SPELL, NEW CHAT', 'III · CONTEXT IS YOUR CURRENCY', 'IV · THE FIRST CONJURING IS A SKETCH, NEVER A COMP', 'V · YOUR TASTE IS THE SPELL']
      .forEach((r, i) => x.fillText(r, 80, 392 + i * 38));
    giltFrame(x);
    x.restore(); return c;
  }

  let three = null, frontCanvas = null;
  function buildTicket3D() {
    frontCanvas = drawFront({ name: state.name || 'A Nameless Caster', designation: state.designation || 'Caster', seat: state.seat || '??' });
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
      fragmentShader: 'varying vec2 vUv; uniform float uShift; float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))-r; } void main(){ float d=rbox(vUv-0.5, vec2(0.5), 0.055); if(d>0.0) discard; float g=sin((vUv.x*1.6+vUv.y*0.7)*6.2831+uShift); float band=pow(max(g,0.0),4.0); vec3 holo=mix(vec3(0.85,0.66,0.28), vec3(1.0,0.92,0.74), vUv.y); gl_FragColor=vec4(holo, band*0.16); }',
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), holoMat); holo.position.z = 0.02; group.add(holo);
    const sparkGeo = new THREE.BufferGeometry(); const N = 70; const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * (W + 2.4); pos[i * 3 + 1] = (Math.random() - 0.5) * (H + 2.0); pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6; }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xd9b25a, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
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
     CONFETTI
     ====================================================================== */
  function confettiBurst() {
    const canvas = $('#confetti'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * DPR; canvas.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const COLORS = ['#b58a32', '#9c6a1c', '#c0451f', '#e6c068', '#6f4fe0', '#efe6d2'];
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
      if (diff === 0) { clearInterval(cdTimer); const w = $('#wait-title'); if (w) w.textContent = 'Your familiar is awake. Come in.'; }
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
        if (cb.checked) toast('Rite noted. A gilt star pends.');
      });
    });
  })();

  /* ======================================================================
     BOOT
     ====================================================================== */
  if (saved && saved.name) {
    state.name = saved.name; state.email = saved.email || ''; state.designation = saved.designation || 'Caster';
    if (inpName) inpName.value = state.name;
    if (inpEmail) inpEmail.value = state.email;
    if (inpDesig) inpDesig.value = state.designation;
    finalize(false);
  }
})();
