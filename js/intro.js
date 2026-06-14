/* intro.js — the cold-open lives at "/". When the 500vh runway completes
   (main.js auto-scrolls to the bottom) we fade out and hand off to /home.
   scrollRestoration is forced manual so the browser Back button doesn't
   restore us at the bottom and instantly bounce forward again. */
(function () {
  'use strict';
  if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch (e) {} }
  window.scrollTo(0, 0);

  var nudge = document.getElementById('scroll-nudge');
  var label = nudge ? nudge.querySelector('span') : null;
  var overlay = document.getElementById('intro-exit');
  if (overlay) {
    try { overlay.style.background = getComputedStyle(document.documentElement).backgroundColor || '#14110b'; } catch (e) {}
  }

  var gone = false;
  function go() {
    if (gone) return; gone = true;
    if (overlay) overlay.classList.add('is-on');
    setTimeout(function () { window.location.href = '/home'; }, 430);
  }

  var enterMode = false;
  function setEnter(on) {
    if (on === enterMode || !nudge) return;
    enterMode = on;
    nudge.classList.toggle('is-enter', on);
    if (label) label.textContent = on ? 'ENTER THE SESSION →' : 'SCROLL TO MEET YOUR NEW INTERN';
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var p = window.scrollY / max;
    setEnter(p > 0.8);
    if (p >= 0.992) go();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  if (nudge) {
    nudge.addEventListener('click', function () {
      if (enterMode) go();
      else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }
  onScroll();
})();
