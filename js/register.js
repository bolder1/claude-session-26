/* register.js — Claude Session '26 registration experience.
   Live-filling seat map → role avatar → interest loadout that dresses
   the avatar → WebGL 3D ticket + badge → countdown. Vanilla + GSAP + three. */

import * as THREE from 'three';

(() => {
  'use strict';

  /* ======================================================================
     CONFIG + STATE
     ====================================================================== */

  const SESSION_DATE = new Date('2026-06-26T11:00:00+05:30');
  const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const COLS = 8;                      // 4 + aisle + 4
  const TOTAL = ROWS.length * COLS;    // 48
  const INITIAL_TAKEN = 0;
  const AUTOFILL_FLOOR = 6;            // never auto-sell below this many free
  const STORE_KEY = 'moClaudeReg';
  const HW_KEY = 'moClaudeHomework';

  const state = {
    seat: null,          // 'B4'
    name: '',
    email: '',
    role: null,          // role id
    interests: [],       // interest ids
    wish: '',
    registered: false,
  };

  const COWORKERS = [
    'Aarav · UI', 'Priya · UX', 'Rohan · Research', 'Sneha · Product',
    'Kabir · Motion', 'Ananya · Graphic', 'Dev · Web', 'Isha · UX',
    'Vikram · UI', 'Meera · Product', 'Arjun · Systems', 'Tara · Research',
    'Nikhil · Brand', 'Zoya · Motion', 'Sahil · UI', 'Diya · UX',
  ];

  /* ======================================================================
     ROLES
     ====================================================================== */

  const ROLE_ICONS = {
    ui: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
    ux: '<circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="12" r="2.5"/><circle cx="7" cy="19" r="2.5"/><path d="M7.4 6.2 16.6 11M16.4 13.6 9.2 17.6"/>',
    uxr: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    uxui: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18"/><circle cx="7.5" cy="12" r="2"/><path d="M15 8h4M15 12h4M15 16h4"/>',
    product: '<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z"/>',
    motion: '<path d="M4 18C7 6 17 6 20 18"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>',
    graphic: '<path d="M12 3l6 6-7 11-5-5L12 3z"/><circle cx="11.5" cy="12.5" r="1.5"/>',
  };

  const ROLES = [
    {
      id: 'ui', label: 'UI Designer', tag: 'Pixels & components', color: '#5aa9ff',
      badge: 'Pixel Director',
      expects: [
        'Critique any screen against Nielsen heuristics, then get a token-based fix — not vague advice.',
        'Turn a screenshot into an interactive React prototype you can hand to devs.',
        'Build and query a --mo-* token spine without leaving the chat.',
      ],
    },
    {
      id: 'ux', label: 'UX Designer', tag: 'Flows & journeys', color: '#4ade80',
      badge: 'Flow Architect',
      expects: [
        'Feed in a flow and get friction points, edge cases and IA alternatives back.',
        'Prototype the happy path live in Act 5 — then iterate it with the room’s feedback.',
        'Your briefing skill is your unfair advantage — we’ll sharpen it into prompts.',
      ],
    },
    {
      id: 'uxr', label: 'UX Researcher', tag: 'Signals & synthesis', color: '#fbbf24',
      badge: 'Signal Hunter',
      expects: [
        'Synthesize 5 interview snippets into themes and 3 design recommendations — live.',
        'Turn raw notes into personas and design implications in one pass.',
        'Set up a Project so every study starts pre-briefed with your method.',
      ],
    },
    {
      id: 'uxui', label: 'UX + UI Designer', tag: 'Both hats', color: '#a78bfa',
      badge: 'Double-Hat Director',
      expects: [
        'The full loop: research synthesis → flows → screens → working prototype.',
        'One brief, both hats — chunks pass from UX to UI without re-explaining.',
        'Projects + Skills so context follows you across both crafts.',
      ],
    },
    {
      id: 'product', label: 'Product Designer', tag: 'Strategy to screens', color: '#ff7d1f',
      badge: 'Ship Captain',
      expects: [
        'Drop a one-line idea — Claude interviews you with 5 questions, then writes the mini-PRD.',
        'See competitive analysis across 6 vendors become 42 ranked requirements.',
        'PRD → 9-screen clickable prototype, production-ready and animated.',
      ],
    },
    {
      id: 'web', label: 'Web Designer', tag: 'Pages that ship', color: '#22d3ee',
      badge: 'Viewport Virtuoso',
      expects: [
        'Landing page concept → live critique → iteration loop, all inside Act 5.',
        'Real HTML/CSS you can inspect and ship — not a flat mockup.',
        'Responsive, token-driven layouts from a two-paragraph brief.',
      ],
    },
    {
      id: 'motion', label: 'Motion Designer', tag: 'Easing & energy', color: '#f472b6',
      badge: 'Easing Whisperer',
      expects: [
        'Framer Motion specs for micro-interactions, with real easing values.',
        'Animated SVG decks — the Claude Mythos deck, dissected.',
        'Describe a feeling, get a spring config you can tune.',
      ],
    },
    {
      id: 'graphic', label: 'Graphic Designer', tag: 'Vectors & visuals', color: '#f87171',
      badge: 'Vector Vanguard',
      expects: [
        '3 SVG illustration concepts in flat enterprise style, on demand.',
        'The DLP marketing set — raw first output vs. what actually shipped.',
        'Batch-generate variants, then spend your hours on taste, not production.',
      ],
    },
  ];

  const TIERS = [
    { min: 0, name: 'Curious Cadet' },
    { min: 3, name: 'Prompt Operator' },
    { min: 5, name: 'Context Keeper' },
    { min: 7, name: 'Creative Director' },
  ];

  /* ======================================================================
     INTERESTS  (each one equips an accessory on the avatar)
     ====================================================================== */

  const INTERESTS = [
    { id: 'prompt', name: 'Prompt craft', sub: 'brief like a director' },
    { id: 'artifacts', name: 'Artifacts & prototypes', sub: 'ideas you can click' },
    { id: 'memory', name: 'Projects & memory', sub: 'never re-explain again' },
    { id: 'skills', name: 'Skills & playbooks', sub: 'your process, installed' },
    { id: 'mcp', name: 'Figma via MCP', sub: 'Claude inside your tools' },
    { id: 'live', name: 'Live build', sub: 'watch it happen' },
    { id: 'research', name: 'Research synthesis', sub: 'notes → themes' },
    { id: 'motion', name: 'Motion & micro-interactions', sub: 'specs with easing' },
  ];

  /* ======================================================================
     DOM SHORTHAND + TOASTS
     ====================================================================== */

  const $ = (sel) => document.querySelector(sel);
  const hasGsap = typeof window.gsap !== 'undefined';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(html, ms = 3600) {
    const wrap = $('#toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast__dot"></span><span>${html}</span>`;
    wrap.appendChild(el);
    if (hasGsap) {
      gsap.from(el, { x: -28, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' });
      gsap.to(el, { opacity: 0, x: -16, delay: ms / 1000, duration: 0.4, onComplete: () => el.remove() });
    } else {
      setTimeout(() => el.remove(), ms);
    }
    while (wrap.children.length > 4) wrap.firstElementChild.remove();
  }

  /* ======================================================================
     STEP NAVIGATION
     ====================================================================== */

  const STEP_ORDER = ['seat', 'you', 'loadout', 'ticket'];
  let currentStep = 'seat';

  function goto(step) {
    if (step === currentStep) return;
    document.querySelectorAll('.reg-step').forEach((s) => s.classList.toggle('is-current', s.dataset.step === step));
    document.querySelectorAll('.reg-progress__dot').forEach((d) => {
      const idx = STEP_ORDER.indexOf(d.dataset.goto);
      const cur = STEP_ORDER.indexOf(step);
      d.classList.toggle('is-active', d.dataset.goto === step);
      d.classList.toggle('is-done', idx < cur);
    });
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // the avatar travels between step 2 and step 3
    if (avatarEl) {
      if (step === 'loadout') $('#ill-holder-2').appendChild(avatarEl);
      if (step === 'you') $('#ill-holder').appendChild(avatarEl);
    }
    if (step === 'loadout') updateLoadoutMeta();
  }

  document.querySelectorAll('.reg-progress__dot').forEach((d) => {
    d.addEventListener('click', () => {
      const target = d.dataset.goto;
      if (target === 'ticket' && !state.registered) return;
      if (target === 'you' && !state.seat) return;
      if (target === 'loadout' && (!state.seat || !state.role || !state.name)) return;
      goto(target);
    });
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.back)));

  /* ======================================================================
     STEP 1 — SEAT MAP
     ====================================================================== */

  const seatMapEl = $('#seat-map');
  const seats = new Map(); // id -> {el, taken, mine}
  let selectedSeat = null;
  let autofillTimer = null;

  const saved = loadSaved();

  function buildSeatMap() {
    ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';
      const lab = document.createElement('span');
      lab.className = 'seat-row__label mono';
      lab.textContent = row;
      rowEl.appendChild(lab);

      for (let c = 1; c <= COLS; c++) {
        if (c === COLS / 2 + 1) {
          const aisle = document.createElement('span');
          aisle.className = 'seat-aisle';
          rowEl.appendChild(aisle);
        }
        const id = `${row}${c}`;
        const btn = document.createElement('button');
        btn.className = 'seat';
        btn.type = 'button';
        btn.setAttribute('aria-label', `Seat ${id}`);
        btn.innerHTML = `<span class="seat__tip">${id}</span>`;
        btn.addEventListener('click', () => onSeatClick(id));
        rowEl.appendChild(btn);
        seats.set(id, { el: btn, taken: false, mine: false });
      }
      const lab2 = lab.cloneNode(true);
      rowEl.appendChild(lab2);
      seatMapEl.appendChild(rowEl);
    });

    // pre-sold seats (never the saved one)
    const ids = [...seats.keys()].filter((id) => id !== (saved && saved.seat));
    shuffle(ids).slice(0, INITIAL_TAKEN).forEach((id) => setTaken(id, true));

    if (saved && saved.seat) {
      const s = seats.get(saved.seat);
      if (s) { s.mine = true; s.el.classList.add('is-mine'); }
    }
    updateSeatStats();
  }

  function onSeatClick(id) {
    const s = seats.get(id);
    if (!s || s.taken || s.mine || state.registered) return;
    if (selectedSeat && seats.get(selectedSeat)) seats.get(selectedSeat).el.classList.remove('is-selected');
    selectedSeat = id;
    state.seat = id;
    s.el.classList.add('is-selected');
    const cta = $('#cta-seat');
    cta.disabled = false;
    cta.textContent = `Lock seat ${id} →`;
    $('#you-seat-label').textContent = id;
    if (hasGsap) gsap.fromTo(s.el, { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  function setTaken(id, silent) {
    const s = seats.get(id);
    if (!s || s.taken || s.mine) return;
    s.taken = true;
    s.el.classList.add('is-taken');
    s.el.disabled = true;
    if (!silent) {
      s.el.classList.add('just-taken');
      setTimeout(() => s.el.classList.remove('just-taken'), 600);
    }
  }

  function freeCount() {
    let free = 0;
    seats.forEach((s) => { if (!s.taken && !s.mine) free++; });
    return free;
  }

  function updateSeatStats() {
    const left = freeCount() + (selectedSeat && !state.registered ? 0 : 0);
    const el = $('#seats-left');
    const prev = parseInt(el.textContent, 10);
    el.textContent = left;
    if (hasGsap && !Number.isNaN(prev) && prev !== left) {
      gsap.fromTo(el, { scale: 1.3, color: '#fff' }, { scale: 1, color: '#ff7d1f', duration: 0.5, ease: 'power2.out', clearProps: 'color' });
    }
    $('#seats-bar').style.width = `${((TOTAL - left) / TOTAL) * 100}%`;
  }

  // Honest seat map: no simulated "live" filling. Seats change only when the user
  // picks one. startAutofill is a no-op (kept so existing callers are unaffected).
  function startAutofill() {}
  function stopAutofill() { clearTimeout(autofillTimer); autofillTimer = null; }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  $('#cta-seat').addEventListener('click', () => {
    if (!state.seat) return;
    toast(`Seat <b>${state.seat}</b> is on hold for you. Finish up before someone charms it away.`);
    goto('you');
  });

  /* ======================================================================
     STEP 2 — ROLE GRID + AVATAR
     ====================================================================== */

  const roleGrid = $('#role-grid');
  let avatarEl = null; // the <div> wrapping the avatar svg

  ROLES.forEach((role) => {
    const card = document.createElement('button');
    card.className = 'role-card';
    card.type = 'button';
    card.style.setProperty('--role-color', role.color);
    card.style.setProperty('--role-soft', hexToSoft(role.color, 0.13));
    card.innerHTML = `
      <span class="role-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ROLE_ICONS[role.id]}</svg></span>
      <span><span class="role-card__name">${role.label}</span><br><span class="role-card__tag">${role.tag}</span></span>`;
    card.addEventListener('click', () => selectRole(role.id));
    card.dataset.role = role.id;
    roleGrid.appendChild(card);
  });

  function selectRole(id) {
    state.role = id;
    const role = ROLES.find((r) => r.id === id);
    document.querySelectorAll('.role-card').forEach((c) => c.classList.toggle('is-active', c.dataset.role === id));

    buildAvatar(role);
    document.querySelectorAll('.ill-frame').forEach((f) => {
      f.style.setProperty('--role-color', role.color);
      f.style.setProperty('--role-glow', hexToSoft(role.color, 0.12));
    });
    $('#ill-meta').innerHTML = `
      <p class="ill-meta__role">${role.label}<small>${role.badge} in training</small></p>
      <ul class="ill-expect">${role.expects.map((e) => `<li>${e}</li>`).join('')}</ul>`;
    validateYou();
  }

  $('#inp-name').addEventListener('input', validateYou);
  function validateYou() {
    state.name = $('#inp-name').value.trim();
    state.email = $('#inp-email').value.trim();
    const ok = state.name.length >= 2 && !!state.role;
    const cta = $('#cta-you');
    cta.disabled = !ok;
    cta.textContent = ok ? 'Build my loadout →' : 'Name + role to continue';
  }
  $('#cta-you').addEventListener('click', () => { if (!$('#cta-you').disabled) goto('loadout'); });

  /* ======================================================================
     THE AVATAR — big illustrated role character (SVG)
     ====================================================================== */

  function hexToSoft(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const SKIN = '#f3c9a4';
  const INK = '#1d1a17';
  const PANEL = '#211d19';

  function roleProps(role) {
    const c = role.color;
    switch (role.id) {
      case 'ui': return `
        <g transform="translate(368,156)">
          <rect x="-56" y="-42" width="112" height="84" rx="11" fill="${PANEL}" stroke="${c}" stroke-width="2.5"/>
          <path d="M-56 -22h112" stroke="${c}" stroke-opacity=".5" stroke-width="2"/>
          <circle cx="-44" cy="-32" r="3.5" fill="${c}"/>
          <rect x="-40" y="-10" width="56" height="9" rx="4.5" fill="#fff" opacity=".25"/>
          <rect x="-40" y="6" width="38" height="9" rx="4.5" fill="#fff" opacity=".14"/>
          <rect x="-40" y="22" width="46" height="13" rx="6.5" fill="${c}"/>
          <path d="M34 18 l16 7 -7 3 -3 7z" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
        </g>`;
      case 'ux': return `
        <g stroke="${c}" stroke-width="2.5" fill="${PANEL}">
          <path d="M345 162 372 190M370 196 350 224" fill="none"/>
          <circle cx="336" cy="154" r="14"/>
          <circle cx="381" cy="198" r="14"/>
          <circle cx="342" cy="232" r="14"/>
          <path d="M331 154h10M336 149v10" stroke-width="2"/>
          <path d="M376 198h10" stroke-width="2"/>
          <path d="M337 232h10M342 227v10" stroke-width="2" opacity=".5"/>
        </g>`;
      case 'uxr': return `
        <g>
          <rect x="382" y="120" width="40" height="40" rx="5" fill="#ffd166" transform="rotate(8 402 140)"/>
          <rect x="392" y="166" width="34" height="34" rx="5" fill="#4ade80" opacity=".85" transform="rotate(-7 409 183)"/>
          <circle cx="348" cy="172" r="27" fill="${PANEL}" fill-opacity=".55" stroke="${c}" stroke-width="5"/>
          <path d="M368 192 388 214" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
          <path d="M338 165 q8 -9 18 -3" stroke="#fff" stroke-width="2.5" fill="none" opacity=".6" stroke-linecap="round"/>
        </g>`;
      case 'uxui': return `
        <g>
          <rect x="312" y="120" width="96" height="72" rx="10" fill="${PANEL}" stroke="${c}" stroke-width="2.5"/>
          <path d="M360 120v72" stroke="${c}" stroke-opacity=".5" stroke-width="2"/>
          <circle cx="336" cy="150" r="9" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.5"/>
          <path d="M336 159v14" stroke="#fff" stroke-opacity=".6" stroke-width="2.5"/>
          <rect x="372" y="138" width="26" height="8" rx="4" fill="#fff" opacity=".25"/>
          <rect x="372" y="152" width="20" height="8" rx="4" fill="#fff" opacity=".15"/>
          <rect x="372" y="166" width="24" height="10" rx="5" fill="${c}"/>
          <path d="M336 204 q24 18 48 0" stroke="${c}" stroke-width="2.5" fill="none" stroke-dasharray="4 6"/>
        </g>`;
      case 'product': return `
        <g transform="translate(364,168)">
          <rect x="-58" y="-40" width="116" height="86" rx="11" fill="${PANEL}" stroke="${c}" stroke-width="2.5"/>
          ${[-38, 0, 38].map((x, i) => `
            <rect x="${x - 14}" y="-28" width="28" height="8" rx="4" fill="${c}" opacity="${0.9 - i * 0.25}"/>
            <rect x="${x - 14}" y="-14" width="28" height="${16 - i * 4}" rx="4" fill="#fff" opacity=".14"/>
            <rect x="${x - 14}" y="${8 - i * 4}" width="28" height="${12 + i * 3}" rx="4" fill="#fff" opacity=".08"/>`).join('')}
          <path d="M0 -40 V-64 l22 7 -22 7" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
        </g>`;
      case 'web': return `
        <g transform="translate(366,162)">
          <rect x="-58" y="-44" width="116" height="88" rx="11" fill="${PANEL}" stroke="${c}" stroke-width="2.5"/>
          <path d="M-58 -26h116" stroke="${c}" stroke-opacity=".5" stroke-width="2"/>
          <circle cx="-46" cy="-35" r="3" fill="#f87171"/><circle cx="-36" cy="-35" r="3" fill="#ffd166"/><circle cx="-26" cy="-35" r="3" fill="#4ade80"/>
          <rect x="-12" y="-39" width="62" height="8" rx="4" fill="#fff" opacity=".14"/>
          <text x="0" y="16" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="26" fill="${c}">&lt;/&gt;</text>
        </g>`;
      case 'motion': return `
        <g fill="none">
          <path d="M310 226 C 330 130, 392 130, 412 226" stroke="${c}" stroke-width="3" stroke-dasharray="6 8"/>
          <circle cx="310" cy="226" r="7" fill="${c}"/>
          <circle cx="412" cy="226" r="7" fill="${c}"/>
          <circle cx="383" cy="152" r="13" fill="#fff"/>
          <circle cx="362" cy="146" r="8" fill="#fff" opacity=".4"/>
          <circle cx="343" cy="148" r="5" fill="#fff" opacity=".2"/>
          <path d="M310 226 L340 180M412 226 L390 196" stroke="${c}" stroke-width="2" opacity=".5"/>
        </g>`;
      case 'graphic': return `
        <g>
          <path d="M352 122 l34 34 -40 62 -28 -28 z" fill="${PANEL}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="350" cy="166" r="6" fill="${c}"/>
          <path d="M350 166 L322 194" stroke="${c}" stroke-width="2"/>
          <circle cx="330" cy="244" r="11" fill="${c}"/>
          <circle cx="358" cy="248" r="11" fill="#ffd166"/>
          <circle cx="386" cy="244" r="11" fill="#4ade80"/>
        </g>`;
      default: return '';
    }
  }

  // accessory layers — one per interest, anchored around the character
  function accessoryLayers(color) {
    const acc = {
      prompt: `<g transform="translate(118,112)">
        <rect x="-58" y="-26" width="116" height="52" rx="14" fill="${PANEL}" stroke="${color}" stroke-width="2"/>
        <path d="M22 26 l10 16 4-16z" fill="${PANEL}" stroke="${color}" stroke-width="2"/>
        <text x="0" y="6" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="15" fill="#fff">✦ brief it</text>
      </g>`,
      artifacts: `<g transform="translate(432,84)">
        <rect x="-44" y="-32" width="88" height="64" rx="9" fill="${PANEL}" stroke="${color}" stroke-width="2"/>
        <path d="M-44 -14h88" stroke="${color}" stroke-opacity=".5" stroke-width="1.5"/>
        <path d="M-8 0 l18 10 -18 10z" fill="${color}"/>
      </g>`,
      memory: `<g transform="translate(84,254)">
        <rect x="-26" y="-26" width="52" height="52" rx="9" fill="${PANEL}" stroke="${color}" stroke-width="2"/>
        ${[-14, 0, 14].map((d) => `<path d="M${d} -26V-38M${d} 26V38M-26 ${d}H-38M26 ${d}H38" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
        <text x="0" y="6" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="14" fill="${color}">ctx</text>
      </g>`,
      skills: `<g transform="translate(116,398)">
        <path d="M-30 -36 h44 a12 12 0 0 1 12 12 v60 h-44 a12 12 0 0 0 -12 12 z" fill="${PANEL}" stroke="${color}" stroke-width="2.5"/>
        <path d="M-18 -36 v84" stroke="${color}" stroke-opacity=".5" stroke-width="2"/>
        <path d="M-6 -14h22M-6 0h22M-6 14h14" stroke="#fff" stroke-opacity=".4" stroke-width="2.5" stroke-linecap="round"/>
      </g>`,
      mcp: `<g transform="translate(440,300)">
        <path d="M-10 -36 V-52 M10 -36 V-52" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <path d="M-22 -36 h44 v14 a22 22 0 0 1 -44 0 z" fill="${PANEL}" stroke="${color}" stroke-width="2.5"/>
        <path d="M0 0 V20 Q0 44 -34 50" stroke="${color}" stroke-width="3" fill="none" stroke-dasharray="2 6" stroke-linecap="round"/>
      </g>`,
      live: `<g transform="translate(262,62)">
        <path d="M6 -28 L-14 6 h12 L-6 30 L16 -4 h-12 z" fill="#ffd166" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/>
      </g>`,
      research: `<g transform="translate(414,408)">
        <circle cx="-6" cy="-6" r="20" fill="${PANEL}" fill-opacity=".5" stroke="${color}" stroke-width="4"/>
        <path d="M9 9 24 24" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="-34" cy="18" r="4" fill="${color}"/><circle cx="-22" cy="30" r="3" fill="${color}" opacity=".6"/>
      </g>`,
      motion: `<g transform="translate(170,452)">
        <path d="M-44 10 q11 -34 22 0 t22 0 t22 0" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="26" cy="2" r="8" fill="#fff"/>
      </g>`,
    };
    return Object.entries(acc).map(([id, svg]) =>
      `<g class="acc" data-acc="${id}" opacity="0">${svg}</g>`).join('');
  }

  function buildAvatar(role) {
    const c = role.color;
    const svg = `
    <svg viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${role.label} avatar">
      <circle cx="260" cy="262" r="186" fill="${c}" fill-opacity=".06"/>
      <circle cx="260" cy="262" r="186" fill="none" stroke="${c}" stroke-opacity=".3" stroke-dasharray="3 10"/>
      <ellipse cx="260" cy="452" rx="118" ry="15" fill="#000" opacity=".4"/>

      <g class="char">
        <g data-power="aura" opacity="0">
          <circle cx="260" cy="250" r="158" fill="none" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="2 14" stroke-linecap="round"/>
        </g>
        <g data-power="cape" opacity="0">
          <path d="M216 268 Q158 330 178 414 Q220 392 248 402 L238 300 Z" fill="${c}" opacity=".55"/>
        </g>

        <!-- arms -->
        <path d="M222 282 Q188 304 182 338" stroke="${SKIN}" stroke-width="15" stroke-linecap="round" fill="none"/>
        <circle cx="182" cy="340" r="10" fill="${SKIN}"/>
        <path d="M298 282 Q332 256 342 224" stroke="${SKIN}" stroke-width="15" stroke-linecap="round" fill="none"/>
        <circle cx="343" cy="221" r="10" fill="${SKIN}"/>

        <!-- body -->
        <rect x="212" y="252" width="96" height="140" rx="46" fill="${c}"/>
        <rect x="212" y="252" width="96" height="140" rx="46" fill="url(#bodyShade)"/>
        <circle cx="260" cy="296" r="10" fill="#fff" opacity=".92"/>
        <circle cx="260" cy="296" r="4.5" fill="${c}"/>

        <!-- head -->
        <circle cx="260" cy="198" r="50" fill="${SKIN}"/>
        <path d="M210 198 a50 50 0 0 1 100 0 c-2-26-18-42-50-42s-48 16-50 42z" fill="#2a2320"/>
        <circle cx="243" cy="202" r="4.5" fill="${INK}"/>
        <circle cx="277" cy="202" r="4.5" fill="${INK}"/>
        <path d="M246 222 q14 12 28 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="233" cy="215" r="6" fill="${c}" opacity=".28"/>
        <circle cx="287" cy="215" r="6" fill="${c}" opacity=".28"/>

        <g data-power="shades" opacity="0">
          <path d="M230 196h60" stroke="${INK}" stroke-width="3"/>
          <rect x="234" y="192" width="22" height="15" rx="6" fill="#111" stroke="#000"/>
          <rect x="264" y="192" width="22" height="15" rx="6" fill="#111" stroke="#000"/>
          <path d="M239 197 q5 -3 9 0" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6"/>
        </g>
        <g data-power="crown" opacity="0">
          <path d="M234 152 l7 -24 13 14 6 -22 6 22 13 -14 7 24 z" fill="#ffd166" stroke="#b45309" stroke-width="2.5" stroke-linejoin="round"/>
        </g>
      </g>

      <g class="props">${roleProps(role)}</g>
      <g class="accs">${accessoryLayers(c)}</g>

      <defs>
        <linearGradient id="bodyShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".14"/>
          <stop offset="1" stop-color="#000" stop-opacity=".22"/>
        </linearGradient>
      </defs>
    </svg>`;

    if (!avatarEl) {
      avatarEl = document.createElement('div');
      avatarEl.style.width = '100%';
      avatarEl.style.height = '100%';
      (currentStep === 'loadout' ? $('#ill-holder-2') : $('#ill-holder')).appendChild(avatarEl);
    }
    avatarEl.innerHTML = svg;

    if (hasGsap) {
      gsap.from(avatarEl.querySelector('.char'), { y: 26, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' });
      gsap.from(avatarEl.querySelector('.props'), { scale: 0.6, opacity: 0, duration: 0.55, delay: 0.12, transformOrigin: 'center', ease: 'back.out(1.8)' });
    }
    // re-equip whatever was already selected
    state.interests.forEach((id) => setAccessory(id, true, false));
    applyPowerUps(false);
  }

  function setAccessory(id, on, animate = true) {
    if (!avatarEl) return;
    const g = avatarEl.querySelector(`[data-acc="${id}"]`);
    if (!g) return;
    if (hasGsap && animate) {
      if (on) gsap.fromTo(g, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, transformOrigin: 'center', ease: 'back.out(2.2)' });
      else gsap.to(g, { opacity: 0, scale: 0.4, duration: 0.3, transformOrigin: 'center', ease: 'power2.in' });
    } else {
      g.setAttribute('opacity', on ? '1' : '0');
      if (!hasGsap) return;
      gsap.set(g, { scale: on ? 1 : 0.4, transformOrigin: 'center' });
    }
  }

  let prevPower = { shades: false, cape: false, crown: false };
  function applyPowerUps(announce = true) {
    if (!avatarEl) return;
    const n = state.interests.length;
    const want = { shades: n >= 3, cape: n >= 5, crown: n >= 7 };
    ['shades', 'cape', 'crown'].forEach((k) => {
      // the aura rides along with the crown
      const target = k === 'crown'
        ? avatarEl.querySelectorAll('[data-power="crown"], [data-power="aura"]')
        : avatarEl.querySelectorAll(`[data-power="${k}"]`);
      target.forEach((g) => {
        if (hasGsap) {
          if (want[k] && !prevPower[k] && announce) {
            gsap.fromTo(g, { opacity: 0, scale: 0.4, y: -8 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, transformOrigin: 'center', ease: 'back.out(2.4)' });
          } else {
            gsap.to(g, { opacity: want[k] ? 1 : 0, scale: want[k] ? 1 : 0.6, duration: 0.35, transformOrigin: 'center' });
          }
        } else {
          g.setAttribute('opacity', want[k] ? '1' : '0');
        }
      });
      if (announce && want[k] && !prevPower[k]) {
        const msg = { shades: '😎 Shades unlocked — 3 modules equipped', cape: '🦸 Cape equipped — 5 modules. Showing off now.', crown: '👑 Crown + aura — full Creative Director mode' }[k];
        toast(msg);
      }
    });
    prevPower = want;
  }

  /* ======================================================================
     STEP 3 — INTERESTS / LOADOUT
     ====================================================================== */

  const interestGrid = $('#interest-grid');
  INTERESTS.forEach((it) => {
    const chip = document.createElement('button');
    chip.className = 'interest-chip';
    chip.type = 'button';
    chip.dataset.interest = it.id;
    chip.innerHTML = `
      <span class="interest-chip__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 10 18 20 6"/></svg></span>
      <span><span class="interest-chip__name">${it.name}</span><br><span class="interest-chip__sub">${it.sub}</span></span>`;
    chip.addEventListener('click', () => toggleInterest(it.id, chip));
    interestGrid.appendChild(chip);
  });

  function toggleInterest(id, chip) {
    const idx = state.interests.indexOf(id);
    const on = idx === -1;
    if (on) state.interests.push(id);
    else state.interests.splice(idx, 1);
    chip.classList.toggle('is-on', on);
    setAccessory(id, on);
    applyPowerUps(true);
    updatePowerMeter();
    updateLoadoutMeta();
  }

  function updatePowerMeter() {
    const n = state.interests.length;
    $('#power-bar').style.width = `${(n / INTERESTS.length) * 100}%`;
    $('#power-val').textContent = `${n} / ${INTERESTS.length}`;
  }

  function tierFor(n) {
    let t = TIERS[0];
    TIERS.forEach((x) => { if (n >= x.min) t = x; });
    return t;
  }

  function updateLoadoutMeta() {
    const role = ROLES.find((r) => r.id === state.role);
    if (!role) return;
    const n = state.interests.length;
    const next = n >= 7 ? null : n >= 5 ? ['👑 Crown', 7] : n >= 3 ? ['🦸 Cape', 5] : ['😎 Shades', 3];
    $('#ill-meta-2').innerHTML = `
      <p class="ill-meta__role">${state.name || role.label}<small>${tierFor(n).name}</small></p>
      <ul class="ill-expect">
        <li>${n} of ${INTERESTS.length} modules equipped.</li>
        <li>${next ? `${next[0]} unlocks at ${next[1]} modules.` : 'Fully maxed. The room will know.'}</li>
      </ul>`;
  }

  $('#inp-wish').addEventListener('input', () => { state.wish = $('#inp-wish').value.trim(); });

  $('#cta-loadout').addEventListener('click', () => {
    finalize(true);
  });

  /* ======================================================================
     FINALIZE → TICKET
     ====================================================================== */

  let fontsRedrawDone = false;
  function finalize(fresh) {
    state.registered = true;
    // ticket text is canvas-drawn; redraw once webfonts are actually in
    if (!fontsRedrawDone && document.fonts && document.fonts.status !== 'loaded') {
      fontsRedrawDone = true;
      document.fonts.ready.then(() => { if (state.registered) buildTicket3D(); });
    }
    const s = seats.get(state.seat);
    if (s) {
      s.mine = true;
      s.el.classList.remove('is-selected');
      s.el.classList.add('is-mine');
    }
    save();
    buildTicket3D();
    buildBadge();
    startCountdown();
    goto('ticket');
    $('#ticket-headline').textContent = `${firstName(state.name)}, you're in. Seat ${state.seat}.`;
    if (fresh) {
      if (!REDUCE) setTimeout(confettiBurst, 450);
      toast(`Locked. <b>${state.seat}</b> is officially yours.`);
    }
  }

  function firstName(n) { return (n || 'Designer').split(/\s+/)[0]; }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        seat: state.seat, name: state.name, email: state.email,
        role: state.role, interests: state.interests, wish: state.wish,
      }));
    } catch (e) { /* private mode — session-only */ }
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
    catch (e) { return null; }
  }

  $('#btn-reset').addEventListener('click', () => {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    location.reload();
  });

  /* ======================================================================
     TICKET — 2D canvas faces + 3D WebGL card
     ====================================================================== */

  const TICKET_W = 1280, TICKET_H = 600, R = 30;

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFront(data) {
    const c = document.createElement('canvas');
    c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');

    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R);
    x.save(); x.clip();

    // base
    x.fillStyle = '#16110d';
    x.fillRect(0, 0, TICKET_W, TICKET_H);
    const glow = x.createRadialGradient(220, -80, 0, 220, -80, 900);
    glow.addColorStop(0, 'rgba(255,122,26,0.32)');
    glow.addColorStop(0.5, 'rgba(255,122,26,0.07)');
    glow.addColorStop(1, 'rgba(255,122,26,0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, TICKET_W, TICKET_H);

    // dotted texture
    x.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 40; i < TICKET_W - 320; i += 36) {
      for (let j = 40; j < TICKET_H; j += 36) { x.beginPath(); x.arc(i, j, 1.5, 0, 7); x.fill(); }
    }

    const STUB_X = 960;

    // header
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.font = '500 22px "JetBrains Mono", monospace';
    x.fillText('MINIORANGE × CLAUDE · IN-HOUSE', 64, 84);

    const grad = x.createLinearGradient(64, 0, 760, 0);
    grad.addColorStop(0, '#ffb066');
    grad.addColorStop(1, '#f25c05');
    x.fillStyle = grad;
    x.font = '700 76px Lexend, sans-serif';
    x.fillText("CLAUDE SESSION '26", 60, 168);

    x.fillStyle = 'rgba(255,255,255,0.45)';
    x.font = '400 20px "JetBrains Mono", monospace';
    x.fillText('ADMIT ONE — DESIGN TEAM ONLY', 64, 208);

    // attendee
    x.fillStyle = '#ffffff';
    x.font = '600 58px Lexend, sans-serif';
    x.fillText(clip(x, data.name, 820), 64, 318);
    x.fillStyle = '#ff7d1f';
    x.font = '400 27px Lexend, sans-serif';
    x.fillText(`${data.roleLabel}  ·  ${data.badge}`, 64, 362);
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.font = '300 21px Lexend, sans-serif';
    x.fillText(`Loadout: ${data.modules}/8 modules · ${data.tier}`, 64, 398);

    // footer
    x.fillStyle = 'rgba(255,255,255,0.42)';
    x.font = '400 19px "JetBrains Mono", monospace';
    x.fillText('HOSTED LIVE BY SURAJIT DUTTA · NO SLIDES, ALL DEMOS', 64, 468);
    x.fillStyle = 'rgba(255,255,255,0.6)';
    x.font = '400 21px "JetBrains Mono", monospace';
    x.fillText('FRI 26 JUN 2026 · 11:00 · DESIGN STUDIO, MINIORANGE HQ', 64, 506);

    // barcode
    let bx = 64;
    x.fillStyle = 'rgba(255,255,255,0.8)';
    while (bx < 480) {
      const w = 2 + Math.random() * 7;
      if (Math.random() > 0.35) x.fillRect(bx, 528, w, 40);
      bx += w + 3;
    }

    // perforation
    x.strokeStyle = 'rgba(255,255,255,0.3)';
    x.setLineDash([4, 10]);
    x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(STUB_X, 18); x.lineTo(STUB_X, TICKET_H - 18); x.stroke();
    x.setLineDash([]);

    // stub
    const sg = x.createLinearGradient(STUB_X, 0, TICKET_W, TICKET_H);
    sg.addColorStop(0, 'rgba(255,122,26,0.16)');
    sg.addColorStop(1, 'rgba(255,122,26,0.02)');
    x.fillStyle = sg;
    x.fillRect(STUB_X, 0, TICKET_W - STUB_X, TICKET_H);

    x.save();
    x.translate(STUB_X + 60, TICKET_H / 2);
    x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(255,138,42,0.85)';
    x.font = '700 44px Lexend, sans-serif';
    x.textAlign = 'center';
    x.fillText('★ VIP ★', 0, 0);
    x.restore();

    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.font = '400 18px "JetBrains Mono", monospace';
    x.fillText('SEAT', STUB_X + 170, 230);
    x.fillStyle = '#ffffff';
    x.font = '700 110px Lexend, sans-serif';
    x.fillText(data.seat, STUB_X + 170, 340);
    x.fillStyle = 'rgba(255,255,255,0.4)';
    x.font = '400 15px "JetBrains Mono", monospace';
    x.fillText('NON-TRANSFERABLE', STUB_X + 170, 420);
    x.fillText('(NICE TRY)', STUB_X + 170, 446);
    x.textAlign = 'left';

    // border
    x.strokeStyle = 'rgba(255,138,42,0.5)';
    x.lineWidth = 3;
    roundRectPath(x, 2, 2, TICKET_W - 4, TICKET_H - 4, R - 2);
    x.stroke();

    x.restore();
    return c;
  }

  function clip(ctx, text, maxW) {
    let t = text;
    while (ctx.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2);
    return t === text ? t : t + '…';
  }

  function drawBack() {
    const c = document.createElement('canvas');
    c.width = TICKET_W; c.height = TICKET_H;
    const x = c.getContext('2d');
    roundRectPath(x, 0, 0, TICKET_W, TICKET_H, R);
    x.save(); x.clip();
    x.fillStyle = '#16110d';
    x.fillRect(0, 0, TICKET_W, TICKET_H);
    const glow = x.createRadialGradient(TICKET_W - 160, TICKET_H + 80, 0, TICKET_W - 160, TICKET_H + 80, 900);
    glow.addColorStop(0, 'rgba(255,122,26,0.25)');
    glow.addColorStop(1, 'rgba(255,122,26,0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, TICKET_W, TICKET_H);

    x.strokeStyle = 'rgba(255,138,42,0.35)';
    x.lineWidth = 2;
    x.font = '700 110px Lexend, sans-serif';
    x.strokeText("CLAUDE", 80, 200);
    x.strokeText("SESSION '26", 80, 320);

    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.font = '400 21px "JetBrains Mono", monospace';
    const rules = [
      '1 · BRIEF IT LIKE A JUNIOR, JUDGE IT LIKE A DIRECTOR',
      '2 · NEW TASK, NEW CHAT',
      '3 · CONTEXT IS CURRENCY',
      '4 · THE FIRST OUTPUT IS A SKETCH, NEVER A COMP',
      '5 · YOUR TASTE IS THE PRODUCT',
    ];
    rules.forEach((r, i) => x.fillText(r, 80, 400 + i * 38));

    x.strokeStyle = 'rgba(255,138,42,0.5)';
    x.lineWidth = 3;
    roundRectPath(x, 2, 2, TICKET_W - 4, TICKET_H - 4, R - 2);
    x.stroke();
    x.restore();
    return c;
  }

  /* ---------- 3D scene ---------- */

  let three = null; // { renderer, scene, camera, group, holo, raf }
  let frontCanvas = null;

  function buildTicket3D() {
    const role = ROLES.find((r) => r.id === state.role) || ROLES[0];
    const tier = tierFor(state.interests.length);
    frontCanvas = drawFront({
      name: state.name || 'Mystery Designer',
      roleLabel: role.label,
      badge: role.badge,
      seat: state.seat || '??',
      modules: state.interests.length,
      tier: tier.name,
    });
    const backCanvas = drawBack();

    const holder = $('#ticket-3d');
    if (three) { cancelAnimationFrame(three.raf); three.renderer.dispose(); holder.innerHTML = ''; }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      // no WebGL — fall back to the flat canvas
      frontCanvas.style.width = '100%';
      frontCanvas.style.height = 'auto';
      frontCanvas.style.borderRadius = '18px';
      holder.appendChild(frontCanvas);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    holder.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 50);
    camera.position.set(0, 0, 6.4);

    const W = 4.2, H = 4.2 * (TICKET_H / TICKET_W);
    const group = new THREE.Group();
    scene.add(group);

    const frontTex = new THREE.CanvasTexture(frontCanvas);
    const backTex = new THREE.CanvasTexture(backCanvas);
    frontTex.anisotropy = 8; backTex.anisotropy = 8;
    frontTex.colorSpace = THREE.SRGBColorSpace;
    backTex.colorSpace = THREE.SRGBColorSpace;

    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
    );
    front.position.z = 0.012;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: backTex, transparent: true })
    );
    back.rotation.y = Math.PI;
    back.position.z = -0.012;
    group.add(front, back);

    // holographic sheen
    const holoMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uShift: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uShift;
        float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) - r; }
        void main() {
          float d = rbox(vUv - 0.5, vec2(0.5), 0.055);
          if (d > 0.0) discard;
          float g = sin((vUv.x * 1.6 + vUv.y * 0.7) * 6.2831 + uShift);
          float band = pow(max(g, 0.0), 4.0);
          vec3 holo = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.9, 0.75), vUv.y);
          gl_FragColor = vec4(holo, band * 0.22);
        }`,
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), holoMat);
    holo.position.z = 0.02;
    group.add(holo);

    // sparkles
    const sparkGeo = new THREE.BufferGeometry();
    const N = 70;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (W + 2.4);
      pos[i * 3 + 1] = (Math.random() - 0.5) * (H + 2.0);
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffb066, size: 0.035, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    scene.add(new THREE.Points(sparkGeo, sparkMat));

    // drag interaction
    let dragging = false, px = 0, py = 0;
    let targetRY = 0, targetRX = 0;
    holder.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; holder.setPointerCapture(e.pointerId); });
    holder.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      targetRY += (e.clientX - px) * 0.008;
      targetRX += (e.clientY - py) * 0.006;
      targetRX = Math.max(-0.6, Math.min(0.6, targetRX));
      px = e.clientX; py = e.clientY;
    });
    const endDrag = () => { dragging = false; };
    holder.addEventListener('pointerup', endDrag);
    holder.addEventListener('pointercancel', endDrag);

    function resize() {
      const w = holder.clientWidth || 1;
      const h = holder.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(holder);

    let t = 0, last = performance.now();
    function frame(now) {
      three.raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (document.hidden) return;
      t += dt;
      if (!dragging) {
        // ease back toward a lazy idle wobble
        targetRY += (Math.sin(t * 0.5) * 0.22 - targetRY) * dt * 0.7;
        targetRX += (Math.sin(t * 0.7) * 0.07 - targetRX) * dt * 0.7;
      }
      group.rotation.y += (targetRY - group.rotation.y) * Math.min(1, dt * 7);
      group.rotation.x += (targetRX - group.rotation.x) * Math.min(1, dt * 7);
      group.position.y = Math.sin(t * 1.1) * 0.06;
      group.rotation.z = Math.sin(t * 0.6) * 0.015;
      holoMat.uniforms.uShift.value = group.rotation.y * 3.0 + t * 0.6;
      sparkMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;
      renderer.render(scene, camera);
    }
    three = { renderer, scene, camera, group, holo, raf: 0 };
    three.raf = requestAnimationFrame(frame);

    // entrance flourish
    if (hasGsap) {
      gsap.fromTo(group.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(1.6)' });
      gsap.fromTo(group.rotation, { y: -2.4 }, { y: 0, duration: 1.1, ease: 'power3.out' });
    }
  }

  $('#btn-download').addEventListener('click', () => {
    if (!frontCanvas) return;
    const a = document.createElement('a');
    a.download = `claude-session-26-${(state.seat || 'ticket').toLowerCase()}.png`;
    a.href = frontCanvas.toDataURL('image/png');
    a.click();
  });

  /* ======================================================================
     BADGE
     ====================================================================== */

  function buildBadge() {
    const role = ROLES.find((r) => r.id === state.role) || ROLES[0];
    const n = state.interests.length;
    const tier = tierFor(n);

    $('#badge-wrap').innerHTML = `
      <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgrad" x1="0" y1="0" x2="160" y2="160">
            <stop stop-color="#ffb066"/><stop offset="1" stop-color="#f25c05"/>
          </linearGradient>
          <radialGradient id="bcore" cx=".5" cy=".35" r=".8">
            <stop stop-color="#3a2a1c"/><stop offset="1" stop-color="#1b1410"/>
          </radialGradient>
        </defs>
        <circle class="badge-ring" cx="80" cy="80" r="74" fill="none" stroke="url(#bgrad)" stroke-width="2.5" stroke-dasharray="5 9" stroke-linecap="round"/>
        <circle cx="80" cy="80" r="61" fill="url(#bcore)" stroke="url(#bgrad)" stroke-width="3"/>
        <circle cx="80" cy="80" r="50" fill="none" stroke="${role.color}" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="2 5"/>
        <text x="80" y="38" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#ffb066">✦ '26 ✦</text>
        <g transform="translate(56,52) scale(2)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          ${ROLE_ICONS[role.id]}
        </g>
        <text x="80" y="126" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="2" fill="rgba(255,255,255,.7)">LV ${Math.max(1, n)}</text>
      </svg>`;

    $('#badge-name').textContent = `${role.badge} · ${tier.name}`;
    $('#badge-desc').textContent =
      `Awarded to ${state.name || 'a mysterious designer'} — ${role.label}, seat ${state.seat}. ` +
      `${n}/8 modules equipped. Redeemable at the door for exactly zero rupees and maximum bragging rights.`;

    const pips = $('#badge-pips');
    pips.innerHTML = '';
    for (let i = 0; i < INTERESTS.length; i++) {
      const p = document.createElement('span');
      p.className = 'badge-pip' + (i < n ? ' is-lit' : '');
      pips.appendChild(p);
    }
    if (hasGsap) {
      gsap.from('#badge-wrap svg', { scale: 0.4, opacity: 0, rotate: -30, duration: 0.8, delay: 0.3, ease: 'back.out(1.8)', transformOrigin: 'center' });
      gsap.from('.badge-pip.is-lit', { scale: 0, duration: 0.3, stagger: 0.07, delay: 0.8, ease: 'back.out(3)' });
    }
  }

  /* ======================================================================
     CONFETTI
     ====================================================================== */

  function confettiBurst() {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * DPR;
    canvas.height = innerHeight * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const COLORS = ['#ff7d1f', '#f25c05', '#ffd166', '#ffffff', '#d97757', '#4ade80'];
    const parts = [];
    for (let i = 0; i < 150; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const v = 7 + Math.random() * 9;
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 160,
        y: innerHeight * 0.42,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
        rot: Math.random() * 7, vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length],
        life: 1,
      });
    }
    let last = performance.now();
    (function frame(now) {
      const dt = Math.min((now - last) / 16.7, 2.2);
      last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.22 * dt;
        p.vx *= 0.992;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= 0.004 * dt;
        if (p.life <= 0 || p.y > innerHeight + 30) continue;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.sin(p.rot * 2)) * 0.6));
        ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
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
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const s = Math.floor(diff / 1000) % 60;
      $('#cd-d').textContent = d;
      $('#cd-h').textContent = String(h).padStart(2, '0');
      $('#cd-m').textContent = String(m).padStart(2, '0');
      $('#cd-s').textContent = String(s).padStart(2, '0');
      if (diff === 0) {
        clearInterval(cdTimer);
        $('.wait-title') && ($('.wait-title').textContent = 'Your intern is in the building. Go!');
      }
    };
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  (function homework() {
    let done = [];
    try { done = JSON.parse(localStorage.getItem(HW_KEY) || '[]'); } catch (e) {}
    document.querySelectorAll('[data-hw]').forEach((cb) => {
      cb.checked = done.includes(cb.dataset.hw);
      cb.addEventListener('change', () => {
        const set = new Set(done);
        cb.checked ? set.add(cb.dataset.hw) : set.delete(cb.dataset.hw);
        done = [...set];
        try { localStorage.setItem(HW_KEY, JSON.stringify(done)); } catch (e) {}
        if (cb.checked) toast('Homework progress saved. Gold star pending.');
      });
    });
  })();

  /* ======================================================================
     BOOT
     ====================================================================== */

  buildSeatMap();
  startAutofill();

  if (saved && saved.seat && saved.role && saved.name) {
    // returning attendee — restore everything and jump to the ticket
    state.seat = saved.seat;
    state.name = saved.name;
    state.email = saved.email || '';
    state.interests = Array.isArray(saved.interests) ? saved.interests : [];
    state.wish = saved.wish || '';
    $('#inp-name').value = state.name;
    $('#inp-email').value = state.email;
    $('#inp-wish').value = state.wish;
    $('#you-seat-label').textContent = state.seat;
    selectRole(saved.role);
    state.interests.forEach((id) => {
      const chip = document.querySelector(`[data-interest="${id}"]`);
      if (chip) chip.classList.add('is-on');
      setAccessory(id, true, false);
    });
    applyPowerUps(false);
    updatePowerMeter();
    finalize(false);
    toast(`Welcome back, <b>${firstName(state.name)}</b>. Seat ${state.seat} is still yours.`);
  }
})();
