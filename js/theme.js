/* theme.js — dark/light toggle + reserve ticket bottom-sheet.
   Loaded on the home and register pages. The no-flash inline script in <head>
   sets the initial data-theme; this wires the toggle button and the sheet. */
(function () {
  'use strict';
  var KEY = 'moTheme';
  var root = document.documentElement;
  function cur() { return root.getAttribute('data-theme') || 'dark'; }
  function apply(t) {
    root.setAttribute('data-theme', t);
    root.style.background = (t === 'light' ? '#F7F3EC' : '#14110b');
    try { localStorage.setItem(KEY, t); } catch (e) {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
  }
  var btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', function () { apply(cur() === 'dark' ? 'light' : 'dark'); });

  /* reserve ticket bottom-sheet (home only) */
  var sheet = document.getElementById('ticket-sheet');
  if (sheet) {
    var open = function () {
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      var c = sheet.querySelector('.ticket__cta');
      if (c) setTimeout(function () { try { c.focus({ preventScroll: true }); } catch (e) {} }, 380);
    };
    var close = function () {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-reserve]'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    Array.prototype.forEach.call(sheet.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('is-open')) close();
    });
  }
})();
