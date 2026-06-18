/* magic.js — the "Liber Claude" enchantments for /home.
   Builds the drifting-ember layer + the wand sparkle-trail and flips the
   .magic-on class (which arms the wand cursor in magic.css). All purely
   decorative, pointer-events:none, and self-disabling on touch / coarse
   pointer / reduced-motion so it never gets in the reader's way.
   The wax seal is static markup in home.html; the page-runes are in book.js. */
(function () {
  'use strict';

  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  if (!body) return;

  // small deterministic-enough RNG helpers (browser Math.random is fine here)
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(p) { return Math.random() < p; }

  // ---- the wand cursor only makes sense with a real pointer ----
  if (fine && !calm) body.classList.add('magic-on');

  if (calm) return;   // reduced-motion: no embers, no trail

  // ---- 3 · drifting gold embers (ambient) ----
  var ambient = document.createElement('div');
  ambient.className = 'magic-ambient';
  ambient.setAttribute('aria-hidden', 'true');
  var EMBERS = window.innerWidth < 760 ? 10 : 16;
  for (var i = 0; i < EMBERS; i++) {
    var d = document.createElement('i');
    d.className = 'magic-ember-dot' + (pick(0.22) ? ' is-rune' : '');
    var s = rnd(2.4, 5.2);
    d.style.left = rnd(2, 98).toFixed(2) + 'vw';
    d.style.setProperty('--s', s.toFixed(1) + 'px');
    d.style.setProperty('--dur', rnd(12, 23).toFixed(1) + 's');
    d.style.setProperty('--delay', (-rnd(0, 23)).toFixed(1) + 's');   // negative → already mid-flight, no empty start
    d.style.setProperty('--sway', (pick(0.5) ? 1 : -1) * rnd(14, 46) + 'px');
    d.style.setProperty('--peak', rnd(0.32, 0.72).toFixed(2));
    ambient.appendChild(d);
  }
  body.appendChild(ambient);

  // ---- 2 · the wand sparkle trail (only with a fine pointer) ----
  if (!fine) return;

  var trail = document.createElement('div');
  trail.className = 'magic-trail';
  trail.setAttribute('aria-hidden', 'true');
  body.appendChild(trail);

  var lastX = null, lastY = null, live = 0;
  var MAX_LIVE = 70;   // safety cap on concurrent sparkles

  function spark(x, y) {
    if (live > MAX_LIVE) return;
    var el = document.createElement('span');
    el.className = 'magic-spark' + (pick(0.16) ? ' is-rune' : '');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--dx', rnd(-16, 16).toFixed(1) + 'px');
    el.style.setProperty('--dy', rnd(8, 26).toFixed(1) + 'px');   // dust drifts gently downward
    el.style.setProperty('--life', rnd(0.58, 0.86).toFixed(2) + 's');
    var sz = rnd(7, 13);
    el.style.width = el.style.height = sz.toFixed(1) + 'px';
    el.style.margin = (-sz / 2).toFixed(1) + 'px 0 0 ' + (-sz / 2).toFixed(1) + 'px';
    trail.appendChild(el);
    live++;
    el.addEventListener('animationend', function () { el.remove(); live--; }, { once: true });
  }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var x = e.clientX, y = e.clientY;
    if (lastX === null) { lastX = x; lastY = y; return; }
    var dx = x - lastX, dy = y - lastY;
    if (dx * dx + dy * dy < 240) return;   // ~15px before the next mote
    lastX = x; lastY = y;
    spark(x, y);
    if (pick(0.3)) spark(x + rnd(-6, 6), y + rnd(-6, 6));   // occasional twin for a fuller trail
  }, { passive: true });

  // a little burst on click — a flick of the wand
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    for (var k = 0; k < 8; k++) spark(e.clientX + rnd(-10, 10), e.clientY + rnd(-10, 10));
  }, { passive: true });
})();
