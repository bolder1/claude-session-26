/* field.js — editorial motion: scroll-reveal, floating nav, subtle parallax,
   pointer-tilt on the hero illustration. All gated by prefers-reduced-motion.
   Vanilla, dependency-free, defensive. */
(() => {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveal ---- */
  const reveals = Array.prototype.slice.call(document.querySelectorAll('.fg-reveal'));
  if (REDUCE || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
    // safety: if anything is still hidden after 4s (observer missed it), reveal it
    setTimeout(() => reveals.forEach((el) => { if (!el.classList.contains('is-in')) el.classList.add('is-in'); }), 4000);
  }

  /* ---- floating nav: appears once the hero is behind you ---- */
  const nav = document.getElementById('fg-nav');
  const hero = document.getElementById('hero');
  if (nav && hero) {
    let ticking = false;
    const update = () => {
      ticking = false;
      nav.classList.toggle('is-on', window.scrollY > hero.offsetHeight * 0.72);
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    // smooth in-page anchors (only when motion is allowed)
    nav.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const t = document.querySelector(a.getAttribute('href'));
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  if (REDUCE) return;

  /* ---- subtle scroll parallax on illustration layers ---- */
  const layers = reveals.length ? Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')).map((el) => ({
    svg: el.querySelector('svg') || el, amt: parseFloat(el.dataset.parallax) || 8
  })) : [];
  let pT = false;
  const parallax = () => {
    pT = false;
    const vh = window.innerHeight;
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const r = L.svg.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const off = ((r.top + r.height / 2) - vh / 2) / vh; // -0.5..0.5
      L.svg.style.transform = 'translate3d(0,' + (-off * L.amt).toFixed(1) + 'px,0)';
    }
  };
  if (layers.length) {
    addEventListener('scroll', () => { if (!pT) { pT = true; requestAnimationFrame(parallax); } }, { passive: true });
    addEventListener('resize', () => requestAnimationFrame(parallax), { passive: true });
    parallax();
  }

  /* ---- pointer tilt on the hero illustration (3D-ish) ---- */
  const tilt = document.querySelector('[data-tilt]');
  if (tilt && matchMedia('(pointer:fine)').matches) {
    const host = tilt.closest('section') || document.body;
    host.addEventListener('pointermove', (e) => {
      const dx = (e.clientX / window.innerWidth) - 0.5;
      const dy = (e.clientY / window.innerHeight) - 0.5;
      tilt.style.transform = 'perspective(1000px) rotateY(' + (dx * 7).toFixed(2) + 'deg) rotateX(' + (-dy * 7).toFixed(2) + 'deg)';
      tilt.style.transition = 'transform .2s ease-out';
    });
    host.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  /* ---- pinned horizontal scroll (the method) ---- */
  const hTrack = document.getElementById('method-track');
  const hSec = hTrack ? hTrack.closest('.fg-hpin') : null;
  if (hTrack && hSec && window.innerWidth > 760) {
    hSec.classList.add('is-pinned');
    const hBar = document.getElementById('method-bar');
    let hTick = false;
    const hUpdate = () => {
      hTick = false;
      const scrollable = hSec.offsetHeight - window.innerHeight;
      if (scrollable <= 0) { hTrack.style.transform = ''; return; }
      const prog = Math.min(Math.max(-hSec.getBoundingClientRect().top / scrollable, 0), 1);
      const maxX = hTrack.scrollWidth - window.innerWidth;
      hTrack.style.transform = 'translate3d(' + (-prog * maxX).toFixed(1) + 'px,0,0)';
      if (hBar) hBar.style.width = (prog * 100).toFixed(1) + '%';
    };
    addEventListener('scroll', () => { if (!hTick) { hTick = true; requestAnimationFrame(hUpdate); } }, { passive: true });
    addEventListener('resize', () => requestAnimationFrame(hUpdate), { passive: true });
    hUpdate();
  }
})();
