/* midnight.js — interaction layer for the visual overhaul.
   Island nav reveal, bento tilt, count-up stats, in-view triggers,
   smooth anchor scrolling for nav links. */

(() => {
  'use strict';

  /* ---------- island nav: appears once the intro runway is behind you ---------- */

  const nav = document.getElementById('mnav');
  const intro = document.querySelector('.threejs-scroll-section');
  if (nav) {
    let threshold = 320;
    const measure = () => {
      threshold = intro && intro.offsetParent !== null
        ? Math.max(320, intro.offsetHeight - window.innerHeight * 0.6)
        : 320;
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });

    let ticking = false;
    const update = () => {
      ticking = false;
      nav.classList.toggle('is-on', window.scrollY > threshold);
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    // smooth-scroll only for nav anchors (global smooth would fight the intro)
    nav.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------- 3D tilt on bento + receipt cards ---------- */

  const fine = window.matchMedia('(pointer: fine)').matches;
  if (fine) {
    document.querySelectorAll('.lt, .rc').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', `${(nx * 6).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${(-ny * 6).toFixed(2)}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ---------- count-up stats ---------- */

  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const dur = 1300;
      const start = performance.now();
      (function tick(now) {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(target * eased);
        if (k < 1) requestAnimationFrame(tick);
      })(start);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }

  /* ---------- generic in-view trigger (token bar, etc.) ---------- */

  const inViewTargets = document.querySelectorAll('.lt-tokens');
  if (inViewTargets.length) {
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io2.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    inViewTargets.forEach((t) => io2.observe(t));
  }
})();
