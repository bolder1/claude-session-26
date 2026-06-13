/* una-main.js — GSAP orchestration for the Unabyss-style chapter.
   Everything below is written from scratch: chip glyphs, marquee,
   headline cycling, scroll reveals, the three problem vignettes,
   the how-it-works accordion sims, engine layer sims and the
   built-for grid touches. */

(() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap) {
    // GSAP CDN failed to load — reveal all content so the page isn't a blank void.
    document.querySelectorAll('.una .reveal').forEach((el) => {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ======================================================================
     1. tool chips — tiny hand-drawn monograms (own artwork)
     ====================================================================== */

  const GLYPHS = {
    claude: { color: '#D97757', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#D97757" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>' },
    cursor: { color: '#e5e5e5', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#e5e5e5" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2v10l9 5"/></svg>' },
    codex: { color: '#ffffff', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/></svg>' },
    gemini: { color: '#4E82EE', svg: '<svg viewBox="0 0 24 24" fill="#4E82EE"><path d="M12 2c.6 5.5 4.5 9.4 10 10-5.5.6-9.4 4.5-10 10-.6-5.5-4.5-9.4-10-10 5.5-.6 9.4-4.5 10-10z"/></svg>' },
    perplexity: { color: '#22B8CD', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#22B8CD" stroke-width="1.8"><path d="M12 2v20M5 6v5l7-5v5l7-5v5M5 18v-5l7 5v-5l7 5v-5"/></svg>' },
    notion: { color: '#ffffff', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9 16V9l6 7V9"/></svg>' },
    slack: { color: '#E01E5A', svg: '<svg viewBox="0 0 24 24"><rect x="10.5" y="3" width="3" height="8" rx="1.5" fill="#36C5F0"/><rect x="13" y="10.5" width="8" height="3" rx="1.5" fill="#2EB67D"/><rect x="10.5" y="13" width="3" height="8" rx="1.5" fill="#ECB22E"/><rect x="3" y="10.5" width="8" height="3" rx="1.5" fill="#E01E5A"/></svg>' },
    gmail: { color: '#EA4335', svg: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10h4V11l5 4 5-4v6h4V7l-9 6z" stroke="#EA4335"/></svg>' },
    github: { color: '#ffffff', svg: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="13" r="7"/><path d="M6.5 8.5L5 4l4 2M17.5 8.5L19 4l-4 2" stroke="#fff" stroke-width="1.6" fill="none"/></svg>' },
    drive: { color: '#FBBC04', svg: '<svg viewBox="0 0 24 24"><path d="M9 4h6l6 11h-6z" fill="#FBBC04"/><path d="M9 4L3 15l3 5 6-11z" fill="#34A853"/><path d="M6 20h12l3-5H9z" fill="#4285F4"/></svg>' },
    obsidian: { color: '#8B7EF8', svg: '<svg viewBox="0 0 24 24" fill="#8B7EF8"><path d="M13 2l6 5-2 13-7 2-5-7 3-9z"/></svg>' },
    openclaw: { color: '#ff4d4d', text: '🦞' },
    opencode: { color: '#f5f5f5', text: '⌘' },
    granola: { color: '#f59e0b', text: 'G' },
    fireflies: { color: '#f97316', text: 'F' },
    tldv: { color: '#8b5cf6', text: 'tv' },
    // session-surface glyphs
    chat: { color: '#ff8a2a', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff8a2a" stroke-width="1.8" stroke-linejoin="round"><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>' },
    artifacts: { color: '#e5e5e5', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#e5e5e5" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M11 12.5l4 2.5-4 2.5z" fill="#e5e5e5"/></svg>' },
    projects: { color: '#ff8a2a', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff8a2a" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
    skills: { color: '#4ade80', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 3v18"/></svg>' },
    mcp: { color: '#60a5fa', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/></svg>' },
    plugins: { color: '#a78bfa', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linejoin="round"><path d="M10 3h4v4h4v4h-4v4h-4v-4H6V7h4z"/></svg>' },
    cowork: { color: '#22d3ee', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>' },
    memory: { color: '#f472b6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 7V4M15 7V4M9 20v-3M15 20v-3M7 9H4M7 15H4M20 9h-3M20 15h-3"/></svg>' },
    tasks: { color: '#fbbf24', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>' },
    code: { color: '#f87171', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/></svg>' },
    // brief-builder glyphs (how-it-works sim)
    ctx: { color: '#ff8a2a', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff8a2a" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
    rules: { color: '#60a5fa', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/></svg>' },
    refs: { color: '#4ade80', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l5-5 4 4 2-2 3 3"/></svg>' },
  };

  function chipHTML(tool) {
    const g = GLYPHS[tool];
    if (!g) return tool.slice(0, 2).toUpperCase();
    return g.svg || `<b style="font-style:normal;font-weight:500;color:${g.color}">${g.text}</b>`;
  }

  document.querySelectorAll('.tool-chip[data-tool]').forEach((el) => {
    el.innerHTML = chipHTML(el.dataset.tool);
  });

  /* ======================================================================
     2. hero marquee
     ====================================================================== */

  const MARQUEE = [
    ['claude', 'Claude'], ['chat', 'Chat'], ['artifacts', 'Artifacts'],
    ['projects', 'Projects'], ['skills', 'Skills'], ['mcp', 'Connectors (MCP)'],
    ['plugins', 'Plugins'], ['cowork', 'Cowork'], ['memory', 'Memory'],
    ['tasks', 'Scheduled tasks'], ['code', 'Claude Code'],
  ];

  const track = document.getElementById('una-marquee');
  if (track) {
    const itemsHTML = MARQUEE.map(([key, name]) =>
      `<div class="marquee__item"><span class="tool-chip" aria-hidden="true">${chipHTML(key)}</span><span class="marquee__name">${name}</span></div>`
    ).join('');
    track.innerHTML = itemsHTML + itemsHTML; // doubled for a seamless wrap
    const half = () => track.scrollWidth / 2;
    if (!REDUCE) {
      const tween = gsap.to(track, {
        x: () => -half(),
        duration: 55,
        ease: 'none',
        repeat: -1,
        modifiers: { x: (x) => `${parseFloat(x) % half()}px` },
      });
      track.closest('.marquee').addEventListener('pointerenter', () => tween.pause());
      track.closest('.marquee').addEventListener('pointerleave', () => tween.play());
    }
  }

  /* ======================================================================
     3. hero headline ↔ scene mood cycle
     ====================================================================== */

  const lineOrder = document.querySelector('[data-hero-line="order"]');
  const lineChaos = document.querySelector('[data-hero-line="chaos"]');
  const subOrder = document.querySelector('[data-hero-sub="order"]');
  const subChaos = document.querySelector('[data-hero-sub="chaos"]');

  if (lineOrder && lineChaos) {
    const swap = (showChaos) => {
      const inEls = showChaos ? [lineChaos, subChaos] : [lineOrder, subOrder];
      const outEls = showChaos ? [lineOrder, subOrder] : [lineChaos, subChaos];
      gsap.to(outEls, { opacity: 0, y: -14, duration: 0.55, ease: 'power2.in', overwrite: 'auto' });
      gsap.fromTo(inEls, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.72, delay: 0.3, ease: 'power3.out', overwrite: 'auto' });
      window.unaHero?.setMode(showChaos ? 'chaos' : 'order');
    };
    let chaos = false;
    if (!REDUCE) setInterval(() => { chaos = !chaos; swap(chaos); }, chaosInterval());
    function chaosInterval() { return 9000; }
  }

  /* ======================================================================
     4. cursor sheen on glass surfaces
     ====================================================================== */

  document.querySelectorAll('.shine').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--shine-x', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--shine-y', `${((e.clientY - r.top) / r.height) * 100}%`);
      el.setAttribute('data-shine-active', '');
    });
    el.addEventListener('pointerleave', () => el.removeAttribute('data-shine-active'));
  });

  /* ======================================================================
     5. scroll reveals (the v2-reveal feel, driven by GSAP)
     ====================================================================== */

  document.querySelectorAll('.una .reveal').forEach((el) => {
    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--reveal-delay')) || 0;
    gsap.fromTo(el,
      { opacity: 0, y: 30, filter: 'blur(10px)', visibility: 'visible' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, delay, ease: 'expo.out',
        clearProps: 'filter',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
  });

  // the Sprint intro swaps the hero between fixed/static — re-measure after
  window.addEventListener('threeJsCanvas', () => ScrollTrigger.refresh());

  /* ======================================================================
     6. problem section
     ====================================================================== */

  // --- rotating headline words ---
  const ROTA_SETS = {
    'agents-a': [['claude', 'Claude'], ['cursor', 'Cursor'], ['gemini', 'Gemini'], ['perplexity', 'Perplexity']],
    'agents-b': [['codex', 'Codex'], ['claude', 'Claude'], ['cursor', 'Cursor'], ['gemini', 'Gemini']],
    'sources': [['slack', 'Slack'], ['notion', 'Notion'], ['gmail', 'Gmail'], ['obsidian', 'Obsidian']],
  };

  document.querySelectorAll('.rota').forEach((slot, slotIdx) => {
    const set = ROTA_SETS[slot.dataset.rota];
    if (!set) return;
    // the slot is sized to the word currently showing; an absolutely
    // positioned measuring twin lets us tween the width between swaps
    slot.innerHTML =
      `<span class="rota__word rota__measure">${wordHTML(set[0])}</span>` +
      `<span class="rota__word rota__live">${wordHTML(set[0])}</span>`;
    const live = slot.querySelector('.rota__live');
    const measure = slot.querySelector('.rota__measure');

    function lockWidth() { slot.style.width = `${measure.offsetWidth}px`; }
    if (document.fonts?.ready) document.fonts.ready.then(lockWidth);
    else lockWidth();
    window.addEventListener('resize', () => {
      measure.innerHTML = live.innerHTML;
      lockWidth();
    });

    let i = 0;
    if (!REDUCE) setInterval(() => {
      const next = set[(i + 1) % set.length];
      measure.innerHTML = wordHTML(next);
      gsap.to(slot, { width: measure.offsetWidth, duration: 0.45, ease: 'power2.inOut' });
      gsap.to(live, {
        yPercent: -55, opacity: 0, duration: 0.38, ease: 'power2.in',
        onComplete() {
          i = (i + 1) % set.length;
          live.innerHTML = wordHTML(set[i]);
          gsap.fromTo(live, { yPercent: 55, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: 'back.out(1.4)' });
        },
      });
    }, 2400 + slotIdx * 380);

    function wordHTML([key, name]) {
      // the original shows just the logo mark; the name stays for screen readers
      return `<span class="rota__glyph" aria-hidden="true">${chipHTML(key)}</span><span class="sr-only">${name}</span>`;
    }
  });

  // --- card 1: scattered clusters ---
  const scatter = document.getElementById('scatter-viz');
  if (scatter) {
    const CLUSTERS = [
      { cx: 50, cy: 75, nodes: [[-60, -45], [10, -57], [-15, 0], [45, 20], [-35, 70]] },
      { cx: 152, cy: 110, nodes: [[-12, -72], [33, -30], [-22, 20], [23, 60], [-42, 90]] },
      { cx: 252, cy: 95, nodes: [[-32, -70], [18, -40], [-12, 20], [53, 0], [30, 90]] },
    ];
    const NS = 'http://www.w3.org/2000/svg';
    CLUSTERS.forEach((cl) => {
      const g = document.createElementNS(NS, 'g');
      const pts = cl.nodes.map(([dx, dy]) => [cl.cx + dx, cl.cy + dy]);
      // intra-cluster links
      for (let a = 0; a < pts.length; a++) {
        const b = (a + 1) % pts.length;
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', pts[a][0]); ln.setAttribute('y1', pts[a][1]);
        ln.setAttribute('x2', pts[b][0]); ln.setAttribute('y2', pts[b][1]);
        ln.setAttribute('stroke', 'rgba(255,255,255,0.13)');
        ln.setAttribute('stroke-width', '0.8');
        g.appendChild(ln);
      }
      pts.forEach(([x, y]) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 14);
        c.setAttribute('fill', 'none');
        c.setAttribute('stroke', 'rgba(255,255,255,0.55)');
        c.setAttribute('stroke-width', '1.2');
        c.setAttribute('stroke-dasharray', '3 3');
        g.appendChild(c);
      });
      scatter.appendChild(g);
      // each island drifts on its own, never connecting to the others
      gsap.to(g, {
        x: 'random(-7, 7)', y: 'random(-7, 7)',
        duration: 'random(3, 5)', ease: 'sine.inOut',
        repeat: -1, yoyo: true, repeatRefresh: true,
      });
    });
    gsap.to(scatter.querySelectorAll('circle'), {
      attr: { 'stroke-dashoffset': 24 },
      duration: 8, ease: 'none', repeat: -1,
    });
  }

  // --- card 2: decay ---
  const decay = document.getElementById('decay-viz');
  if (decay) {
    const rows = decay.querySelectorAll('.decay__row');
    const targets = [0.85, 0.6, 0.38, 0.2];
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    tl.set(rows, { opacity: 1 })
      .set(rows.length ? decay.querySelectorAll('.decay__stale') : [], { opacity: 0, scale: 0.8 });
    rows.forEach((row, i) => {
      tl.to(row, { opacity: targets[i], duration: 1.1, ease: 'power1.inOut' }, 0.5 + i * 0.45)
        .to(row.querySelector('.decay__stale'), { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 0.7 + i * 0.45);
    });
  }

  // --- card 3: sprawl ---
  const sprawl = document.getElementById('sprawl-viz');
  if (sprawl) {
    const FILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/></svg>';
    const NAMES = ['hero-v1.html', 'hero-v2.html', 'hero-v3.html', 'final.html', 'final-final.html', 'FINAL-v3.html', 'approved.html', 'approved-2.html', 'use-this-one.html', 'no-this-one.html', 'v4-rollback.html', 'hero-new.html', 'hero-newer.html', 'latest.html', 'latest(1).html', 'ok-done.html'];
    const chips = NAMES.map((n, i) => {
      const w = i % 5 === 0 ? 2 : 1;
      const el = document.createElement('div');
      el.className = 'sprawl__chip';
      el.style.setProperty('--w', w);
      el.innerHTML = `${FILE_SVG}<span>${n}</span>`;
      sprawl.appendChild(el);
      return el;
    });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
    tl.set(chips, { opacity: 0, scale: 0.6 })
      .to(chips, { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2.2)', stagger: 0.14 })
      .to(sprawl, { x: 2, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, '+=0.4')
      .to(chips, { opacity: 0, scale: 0.85, duration: 0.4, stagger: 0.02 }, '+=0.8');
  }

  /* ======================================================================
     7. how-it-works accordion + sims
     ====================================================================== */

  const howRow = document.getElementById('how-row');
  if (howRow) {
    const cards = [...howRow.querySelectorAll('.how-card')];
    let activeIdx = 0;
    let autoTimer = null;

    const simPlayers = [playConnectSim(), playTokenSim(), playAccessSim()];

    function activate(idx) {
      if (idx === activeIdx) return;
      cards[activeIdx]?.classList.remove('active');
      cards[activeIdx]?.setAttribute('aria-pressed', 'false');
      cards[idx]?.setAttribute('aria-pressed', 'true');
      simPlayers[activeIdx]?.pause();
      activeIdx = idx;
      cards[idx].classList.add('active');
      simPlayers[idx]?.restart();
    }
    cards.forEach((card, idx) => {
      card.addEventListener('click', () => { activate(idx); scheduleAuto(); });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(idx); scheduleAuto(); }
      });
    });

    function scheduleAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => activate((activeIdx + 1) % cards.length), 5200);
    }
    howRow.addEventListener('pointerenter', () => clearInterval(autoTimer));
    howRow.addEventListener('pointerleave', scheduleAuto);

    ScrollTrigger.create({
      trigger: howRow, start: 'top 80%', once: true,
      onEnter() { simPlayers[0].restart(); scheduleAuto(); },
    });

    function playConnectSim() {
      const rows = document.querySelectorAll('#connect-sim .connect-sim__row');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2 });
      rows.forEach((row, i) => {
        const btn = row.querySelector('.connect-sim__btn-connect');
        const done = row.querySelector('.connect-sim__btn-done');
        tl.set(row, { className: 'connect-sim__row' }, 0)
          .set(btn, { opacity: 1 }, 0).set(done, { opacity: 0 }, 0)
          .to(btn, { opacity: 0, duration: 0.22 }, 0.8 + i * 0.85)
          .to(done, { opacity: 1, duration: 0.3 }, 0.92 + i * 0.85)
          .add(() => row.classList.add('is-connected'), 0.92 + i * 0.85)
          .fromTo(row, { scale: 1 }, { scale: 1.03, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.9 + i * 0.85);
      });
      return tl;
    }

    function playTokenSim() {
      const btn = document.querySelector('#token-sim .token-sim__btn');
      const result = document.querySelector('#token-sim .token-sim__result');
      const tokenText = document.getElementById('token-text');
      const TOKEN = '› critique, then rebuild as React…';
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.4 });
      tl.set(result, { opacity: 0, y: 8 })
        .set(tokenText, { textContent: '' })
        .set(btn, { scale: 1, opacity: 1 })
        .to(btn, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, 0.9)
        .to(result, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 1.3)
        .to({}, {
          duration: TOKEN.length * 0.045,
          onUpdate() { tokenText.textContent = TOKEN.slice(0, Math.round(this.progress() * TOKEN.length)); },
        }, 1.5);
      gsap.to('.token-sim__caret', { opacity: 0.15, duration: 0.55, repeat: -1, yoyo: true, ease: 'none' });
      return tl;
    }

    function playAccessSim() {
      const toggles = document.querySelectorAll('#access-sim .toggle');
      const save = document.querySelector('#access-sim .access-sim__save');
      const saveLbl = save.querySelector('.access-sim__save-label');
      const savedLbl = save.querySelector('.access-sim__saved-label');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.2 });
      tl.add(() => toggles.forEach(t => t.classList.remove('toggle--on')), 0)
        .set(saveLbl, { opacity: 1 }).set(savedLbl, { opacity: 0 });
      toggles.forEach((t, i) => tl.add(() => t.classList.add('toggle--on'), 0.7 + i * 0.55));
      tl.to(save, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, 2.6)
        .to(saveLbl, { opacity: 0, duration: 0.2 }, 2.85)
        .to(savedLbl, { opacity: 1, duration: 0.25 }, 2.95)
        .to(save, { backgroundColor: '#4ade80', duration: 0.3 }, 2.85)
        .to(save, { backgroundColor: '#ffffff', duration: 0.4 }, '+=1.4');
      return tl;
    }
  }

  /* ======================================================================
     8. engine layer sims
     ====================================================================== */

  // --- segmentation: incoming chips sort into buckets ---
  const segIncoming = document.getElementById('seg-incoming');
  if (segIncoming) {
    const ITEMS = [
      ['Brand guide v4', 'personal'],
      ['Critique playbook', 'company'],
      ['One-off banner ask', 'interests'],
      ['PRODUCT.md', 'personal'],
      ['Handoff checklist', 'company'],
      ['Quick error-copy fix', 'interests'],
    ];
    const COLORS = { personal: '#60a5fa', company: '#fbbf24', interests: '#4ade80' };
    const buckets = {};
    document.querySelectorAll('#seg-sim .seg-bucket').forEach((b) => {
      buckets[b.dataset.bucket] = b.querySelector('.seg-bucket__slot');
    });

    let segIdx = 0;
    function dropOne() {
      const [label, bucket] = ITEMS[segIdx % ITEMS.length];
      segIdx++;
      const chip = document.createElement('span');
      chip.className = 'seg-chip';
      chip.innerHTML = `<i style="color:${COLORS[bucket]}"></i>${label}`;
      segIncoming.appendChild(chip);

      const areaW = segIncoming.clientWidth;
      const areaH = segIncoming.clientHeight;
      const slot = buckets[bucket];
      const slotRect = slot.getBoundingClientRect();
      const areaRect = segIncoming.getBoundingClientRect();
      const targetX = slotRect.left + slotRect.width / 2 - areaRect.left;
      const startX = areaW * (0.25 + Math.random() * 0.5);

      gsap.timeline({ onComplete() { chip.remove(); addBucketItem(slot); } })
        .fromTo(chip,
          { x: startX - chip.offsetWidth / 2, y: -26, opacity: 0 },
          { y: areaH * 0.42, opacity: 1, duration: 0.9, ease: 'power1.in' })
        .to(chip, { x: targetX - chip.offsetWidth / 2, y: areaH + 4, scale: 0.7, opacity: 0.9, duration: 0.75, ease: 'power2.in' });
    }
    function addBucketItem(slot) {
      const item = document.createElement('span');
      item.className = 'seg-bucket__item';
      slot.prepend(item);
      gsap.from(item, { scaleX: 0.3, opacity: 0, duration: 0.3, ease: 'back.out(2)' });
      while (slot.children.length > 4) slot.lastElementChild.remove();
    }
    let segTimer = null;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !segTimer) { dropOne(); segTimer = setInterval(dropOne, 1700); }
      else if (!e.isIntersecting && segTimer) { clearInterval(segTimer); segTimer = null; }
    }, { threshold: 0.3 }).observe(document.getElementById('seg-sim'));
  }

  // --- retrieval: query types, rows score, weak ones drop ---
  const retSim = document.getElementById('ret-sim');
  if (retSim) {
    const QUERY = 'rebuild the PayOps screen as a clickable prototype';
    const queryEl = document.getElementById('ret-query');
    const rows = [...retSim.querySelectorAll('.ret-row')];
    const tokens = document.getElementById('ret-tokens');
    const tokensAfter = document.getElementById('ret-tokens-after');
    const badge = retSim.querySelector('.ret-sim__badge');
    gsap.to(retSim.querySelector('.ret-sim__caret'), { opacity: 0.15, duration: 0.55, repeat: -1, yoyo: true, ease: 'none' });

    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 3 });
    tl.set(rows, { opacity: 0, y: 10, scale: 1 })
      .add(() => { rows.forEach(r => r.classList.remove('is-kept')); tokens.textContent = '12,480'; tokensAfter.textContent = ''; })
      .set(rows.map(r => r.querySelector('.ret-row__bar i')), { width: 0 })
      .set([tokensAfter, badge], { opacity: 0 })
      .set(queryEl, { textContent: '' })
      .to({}, {
        duration: QUERY.length * 0.038,
        onUpdate() { queryEl.textContent = QUERY.slice(0, Math.round(this.progress() * QUERY.length)); },
      })
      .to(rows, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, '+=0.3');
    rows.forEach((row, i) => {
      const score = parseFloat(row.dataset.score);
      tl.to(row.querySelector('.ret-row__bar i'), { width: `${score * 100}%`, duration: 0.6, ease: 'power2.out' }, 1.9 + i * 0.12);
    });
    tl.add(() => rows.forEach((r) => { if (parseFloat(r.dataset.score) > 0.5) r.classList.add('is-kept'); }), '+=0.4')
      .to(rows.filter(r => parseFloat(r.dataset.score) <= 0.5), { opacity: 0.22, scale: 0.985, duration: 0.5 }, '<')
      .to(tokensAfter, { opacity: 1, duration: 0.3 }, '+=0.3')
      .fromTo(badge, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '<+=0.15');
    const counter = { v: 12480 };
    tl.to(counter, {
      v: 1240, duration: 0.9, ease: 'power2.out',
      onUpdate() { tokensAfter.textContent = Math.round(counter.v).toLocaleString('en-US'); },
      onStart() { counter.v = 12480; },
    }, '<');

    new IntersectionObserver(([e]) => { e.isIntersecting ? tl.play() : tl.pause(); }, { threshold: 0.3 }).observe(retSim);
  }

  // --- permissions: scope flips on, confidential rows lock ---
  const permSim = document.getElementById('perm-sim');
  if (permSim) {
    const toggle = document.getElementById('perm-toggle');
    const confRows = [...permSim.querySelectorAll('.perm-row[data-kind="conf"]')];
    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.2 });
    tl.add(() => { toggle.classList.remove('toggle--on'); confRows.forEach(r => r.classList.remove('is-blocked')); })
      .add(() => toggle.classList.add('toggle--on'), 1.2);
    confRows.forEach((row, i) => {
      tl.add(() => row.classList.add('is-blocked'), 1.5 + i * 0.3)
        .fromTo(row, { x: 0 }, { x: -3, duration: 0.07, repeat: 3, yoyo: true, ease: 'none' }, 1.5 + i * 0.3);
    });
    tl.add(() => toggle.classList.remove('toggle--on'), 4.6)
      .add(() => confRows.forEach(r => r.classList.remove('is-blocked')), 4.9);
    new IntersectionObserver(([e]) => { e.isIntersecting ? tl.play() : tl.pause(); }, { threshold: 0.3 }).observe(permSim);
  }

  /* ======================================================================
     9. built-for touches
     ====================================================================== */

  // marketer bars grow in when the card appears
  gsap.utils.toArray('.persona-mock--marketer .chan-row__bar i').forEach((bar, i) => {
    gsap.from(bar, {
      scaleX: 0, transformOrigin: 'left center', duration: 0.9, delay: i * 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 92%', once: true },
    });
  });

  // sync dots breathe
  gsap.to('.sync-row__status i', {
    opacity: 0.35, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.2,
  });
})();
