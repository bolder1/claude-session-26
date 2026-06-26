/* ============================================================================
   book.js — Interactive 3D field-guide book for Claude Session '26.
   A procedurally-built hardcover (no GLB) with a solid page-block body,
   fore-edge striations, cover overhang and curling leaves whose two faces
   carry real, magazine-style spreads (light / dark / bold-orange).

   One scroll track drives the cinematic:
     left content → right content → book travels to centre + ZOOM-IN → cover
     opens → pages turn (curl) revealing spreads → book ZOOMS-OUT and settles
     as the hero tile of a bento box → registration.

   Render family matches the site: ACESFilmic + RoomEnvironment + clearcoat.
   Accessible fallback (is-nogl) if WebGL is unavailable.
   ============================================================================ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const body   = document.body;
const stage  = document.getElementById('bk-stage');
const pin    = document.getElementById('bk-pin');
const canvas = document.getElementById('bk-canvas');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

function bail() {
  body.classList.add('is-nogl');
  document.querySelectorAll('.fg-reveal').forEach(el => el.classList.add('is-in'));
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no gl');
} catch (e) { bail(); throw e; }

/* ===========================================================================
   constants
   =========================================================================== */
const PAGE_W = 1.55, PAGE_H = 2.26, OVER = 0;     // taller codex proportion (~0.686), flush cover
const TEX_W = 864, TEX_H = 1260;                  // aspect matches PAGE_W/PAGE_H so the art isn't stretched
const N_LEAVES = 6, N_FLIP = 5, CURL = 0.30, GUTTER = 0.012;   // crisper fold (was 0.24)
// --- page-turn depth model (see apply) -------------------------------------
// A deep, MONOTONE z-ladder so the two piles occupy DISJOINT z-bands and every
// settled page is a perfectly flat plane — overlap becomes impossible by
// construction (was: 0.005 pitch with a baked gutter warp ~0.012 → z-fight).
const SHEET = 0.05;          // z-pitch between stacked pages (10x the old 0.005)
const RIGHT_TOP = 0.10;      // top of the closed / right reading pile
const LEFT_TOP  = -0.15;     // top of the settled left pile (a clear valley below right-bottom -0.10)
const BACK_Z    = -0.42;     // back inside page, beneath the whole left pile
const COVER_Z   = 0.16;      // cover closed, on very top
const COVER_OPEN_Z = -0.40;  // cover folded open, backing the (deeper) left pile
const LIFT   = 0.12;         // gentle, low peel (was a tall 0.42 arc — toned down to a real-book turn)
const LIFT_Y = 0.05;         // barely a rise — subtle, not theatrical

/* ===========================================================================
   MAGAZINE PAGE SYSTEM — varied layouts, real whitespace, 3 themes
   =========================================================================== */
const DISP = '"Cinzel", serif';                  // Roman inscriptional caps — titles, folios
const SANS = '"EB Garamond", Georgia, serif';    // calligraphic body — the tome's hand
// parchment grimoire palette — aged vellum, sepia ink, gilt accents.
// gold = the leaf used for frames/folios/flourishes; rune = the arcane glow.
const THEMES = {
  light:  { a:'#efe3c6', b:'#d9c39a', ink:'#3a2c18', sub:'#6a5230', hair:'rgba(120,86,40,.34)', acc:'#9c6a1c', gold:'#b58a32', rune:'#7c5cff', faint:'rgba(90,66,30,.42)', edge:'rgba(74,52,22,.5)' },   // aged parchment
  dark:   { a:'#2a2238', b:'#150f24', ink:'#ece2cf', sub:'#bca989', hair:'rgba(210,180,120,.22)', acc:'#d9b25a', gold:'#e6c873', rune:'#9d86ff', faint:'rgba(236,226,207,.34)', edge:'rgba(0,0,0,.5)' },        // night vellum
  orange: { a:'#7c2016', b:'#55110b', ink:'#f7e7d0', sub:'rgba(247,231,208,.86)', hair:'rgba(247,231,208,.34)', acc:'#f0d27e', gold:'#f0d27e', rune:'#ffd9a8', faint:'rgba(247,231,208,.6)', edge:'rgba(28,4,2,.55)' },   // illuminated vermilion leaf
};
const M = 120;                                   // generous outer margin

const PAGES = [
  { theme:'light',  layout:'opener',    no:'I',  kick:'What you summon', title:'The\nFamiliar', foot:'i · the premise' },
  { theme:'orange', layout:'stat',      big:'70%', kick:'Read the runes', cap:'is where the spell ends.', note:'The last thirty parts — taste, judgement, the call only a master can make — is the true craft.', foot:'ii · the law' },
  { theme:'light',  layout:'editorial', kick:'Three absences', title:'No sight.\nNo memory.\nNo taste.', body:'It has never seen your realm, your people, or your craft. An hour into the working it forgets how the spell began. It yields seven parts in ten, every time.', foot:'iii · the premise' },
  { theme:'dark',   layout:'quote',     quote:'Brief it like an apprentice. Judge it like a master.', by:'— the one charm every other spell hangs upon', foot:'iv · the casting' },
  { theme:'light',  layout:'opener',    no:'II', kick:'The whole craft, three passes', title:'The\nCasting', foot:'v · the casting' },
  { theme:'light',  layout:'moves',     kick:'Stop drawing glyphs', title:'Command them\ninstead.', steps:['Brief','Conjure','Judge'], take:'Your incantation is the work.', foot:'vi · the casting' },
  { theme:'dark',   layout:'editorial', kick:'Pass the second', title:'Let it\nconjure.', body:'At a speed no hand can match. A sketch becomes a verdict; a few plain words become living craft, taking shape as you watch. The first vision is a draft, never the deed.', foot:'vii · the casting' },
  { theme:'light',  layout:'list',      no:'III', kick:'The yield', title:'Before the\ncandle gutters.', items:['A screenshot → a working charm','Spend your tokens like a master','Grant your intern a memory','Set Claude inside Figma','A week of study in an afternoon'], foot:'viii · the yield' },
  { theme:'light',  layout:'opener',    no:'IV', kick:'Two hours, seven rites', title:'The\nRunning\nOrder', foot:'ix · the order' },
  { theme:'light',  layout:'feature',   kick:'Your conjurer', title:'Surajit Dutta', body:'Keeper of the craft · miniOrange. Everything here came off true work — IAM, IGA, PayOps. Every demo is cast live; if the spell breaks, you watch the master mend it.', stats:[['42','rites ranked'],['9','sigils'],['0','scrolls']], foot:'x · the conjurer' },
  { theme:'orange', layout:'stat',      big:'20', kick:'Last call', cap:'places at the table. One is yours.', note:'Claim your place on the right — choose your place and we shall pen your pass.', foot:'xi · the summons' },
];
const COVER   = { theme:'dark', layout:'cover' };
const TITLEPG = { theme:'light', layout:'title' };
const ENDPAGE = { theme:'dark', layout:'end' };
const BACKOUT = { theme:'dark', layout:'backcover' };

/* ---- canvas helpers ------------------------------------------------------- */
function ls(ctx, v) { try { ctx.letterSpacing = v; } catch (e) {} }
function cv() { const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H; return c; }
function wrap(ctx, text, x, y, max, lh) {
  let line = '', yy = y;
  for (const w of String(text).split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}
function lines(ctx, str, x, y, lh, f, color) { ctx.font = f; ctx.fillStyle = color; for (const l of String(str).split('\n')) { ctx.fillText(l, x, y); y += lh; } return y; }
function rule(ctx, x1, y, x2, color) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }

function paper(ctx, T) {
  // ---- aged parchment ground ----
  const g = ctx.createLinearGradient(0, 0, TEX_W * 0.3, TEX_H);
  g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H);

  // mottled age stains — a few soft foxing blobs
  const stain = T === THEMES.dark ? '12,7,24' : (T === THEMES.orange ? '40,6,2' : '96,68,28');
  [[.26, .22, 260, .05], [.74, .34, 220, .06], [.4, .82, 300, .05], [.84, .72, 180, .05], [.16, .58, 200, .045]].forEach(s => {
    const rg = ctx.createRadialGradient(TEX_W * s[0], TEX_H * s[1], 0, TEX_W * s[0], TEX_H * s[1], s[2]);
    rg.addColorStop(0, 'rgba(' + stain + ',' + s[3] + ')'); rg.addColorStop(1, 'rgba(' + stain + ',0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, TEX_W, TEX_H);
  });

  // fibre speckle
  ctx.fillStyle = T === THEMES.dark ? 'rgba(220,200,160,.05)' : 'rgba(74,52,22,.055)';
  for (let i = 0; i < 240; i++) ctx.fillRect((i * 97) % TEX_W, (i * 173) % TEX_H, 1.5, 1.5);

  // gutter shading on both inner edges (the binding crease)
  for (const left of [true, false]) {
    const g2 = ctx.createLinearGradient(left ? 0 : TEX_W, 0, left ? 66 : TEX_W - 66, 0);
    g2.addColorStop(0, T.edge); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(left ? 0 : TEX_W - 66, 0, 66, TEX_H);
  }

  // aged edge vignette
  const vg = ctx.createRadialGradient(TEX_W / 2, TEX_H * 0.46, TEX_H * 0.32, TEX_W / 2, TEX_H * 0.5, TEX_H * 0.84);
  vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, T.edge);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, TEX_W, TEX_H);

  // ---- gilt double frame + corner flourishes ----
  ctx.strokeStyle = goldGrad(ctx, 56, 0, TEX_W - 56, 0); ctx.lineWidth = 3;
  ctx.strokeRect(54, 54, TEX_W - 108, TEX_H - 108);
  ctx.strokeStyle = goldGrad(ctx, 66, 0, TEX_W - 66, 0); ctx.lineWidth = 1.2;
  ctx.strokeRect(64, 64, TEX_W - 128, TEX_H - 128);
  const fm = 88;
  fleuron(ctx, fm, fm, 28, 0);
  fleuron(ctx, TEX_W - fm, fm, 28, Math.PI / 2);
  fleuron(ctx, TEX_W - fm, TEX_H - fm, 28, Math.PI);
  fleuron(ctx, fm, TEX_H - fm, 28, -Math.PI / 2);

  // ---- a faint glowing rune in the foot margin ----
  rune(ctx, TEX_W / 2, TEX_H - 80, 11, T);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}
function rune(ctx, x, y, s, T) {
  ctx.save();
  ctx.shadowColor = T.rune; ctx.shadowBlur = 16;
  ctx.strokeStyle = T.rune; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
  ctx.moveTo(x - s * 0.72, y - s * 0.45); ctx.lineTo(x + s * 0.72, y + s * 0.45);
  ctx.moveTo(x + s * 0.72, y - s * 0.45); ctx.lineTo(x - s * 0.72, y + s * 0.45);
  ctx.moveTo(x, y - s); ctx.lineTo(x - s * 0.5, y - s * 1.5);
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.5, y - s * 1.5);
  ctx.stroke();
  ctx.restore();
}
function masthead(ctx, T, right) {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = T.acc; ctx.font = '600 19px ' + DISP; ls(ctx, '3px');
  ctx.fillText('LIBER CLAUDE', M, 86);
  if (right) { ctx.textAlign = 'right'; ctx.fillStyle = T.faint; ctx.fillText(String(right).toUpperCase(), TEX_W - M, 86); ctx.textAlign = 'left'; }
  ls(ctx, '0px');
  ctx.strokeStyle = goldGrad(ctx, M, 0, TEX_W - M, 0); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(M, 108); ctx.lineTo(TEX_W - M, 108); ctx.stroke();
}
function folio(ctx, T, label) {
  ctx.strokeStyle = goldGrad(ctx, M, 0, TEX_W - M, 0); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(M, TEX_H - 96); ctx.lineTo(TEX_W - M, TEX_H - 96); ctx.stroke();
  ctx.fillStyle = T.faint; ctx.font = '500 17px ' + DISP; ls(ctx, '2.5px'); ctx.textAlign = 'left';
  ctx.fillText(String(label).toUpperCase(), M, TEX_H - 62); ls(ctx, '0px');
  ctx.fillStyle = T.gold; ctx.beginPath(); ctx.arc(TEX_W - M, TEX_H - 68, 4, 0, 7); ctx.fill();
}
function kicker(ctx, T, txt, y) { ctx.fillStyle = T.acc; ctx.font = '600 21px ' + DISP; ls(ctx, '3px'); ctx.fillText(String(txt).toUpperCase(), M, y); ls(ctx, '0px'); }

/* ---- layouts -------------------------------------------------------------- */
function L_opener(ctx, T, p) {
  masthead(ctx, T, 'chapter');
  ctx.textAlign = 'right'; ctx.fillStyle = T.hair; ctx.font = '600 460px ' + DISP;
  ctx.fillText(p.no, TEX_W - M + 30, TEX_H * 0.62); ctx.textAlign = 'left';
  kicker(ctx, T, p.kick, TEX_H * 0.6);
  let y = TEX_H * 0.66; lines(ctx, p.title, M, y, 96, '700 96px ' + DISP, T.ink);
  folio(ctx, T, p.foot);
}
function L_editorial(ctx, T, p) {
  masthead(ctx, T, 'essay');
  kicker(ctx, T, p.kick, 250);
  lines(ctx, p.title, M, 322, 70, '600 64px ' + DISP, T.ink);
  ctx.fillStyle = T.acc; ctx.fillRect(M, TEX_H * 0.52 - 30, 46, 4);
  ctx.fillStyle = T.sub; ctx.font = '300 30px ' + SANS;
  wrap(ctx, p.body, M, TEX_H * 0.52 + 18, TEX_W * 0.56, 46);
  folio(ctx, T, p.foot);
}
function L_stat(ctx, T, p) {
  masthead(ctx, T, 'figure');
  ctx.textAlign = 'center';
  kicker2(ctx, T, p.kick, TEX_H * 0.3);
  // big number + caption sized to stay well within the folio rules (≤ TEX_W-M)
  // so the centred figure never reaches a page edge / the spine.
  ctx.fillStyle = T.ink; ctx.font = '700 250px ' + DISP; ctx.fillText(p.big, TEX_W / 2, TEX_H * 0.55);
  ctx.fillStyle = T.ink; ctx.font = '400 34px ' + DISP;
  wrapCentre(ctx, p.cap, TEX_W / 2, TEX_H * 0.645, TEX_W - M * 2, 44);
  ctx.fillStyle = T.hair; ctx.fillRect(TEX_W / 2 - 40, TEX_H * 0.71, 80, 3);
  ctx.fillStyle = T.sub; ctx.font = '300 27px ' + SANS;
  wrapCentre(ctx, p.note, TEX_W / 2, TEX_H * 0.76, TEX_W - M * 2.4, 40);
  ctx.textAlign = 'left'; folio(ctx, T, p.foot);
}
function L_quote(ctx, T, p) {
  masthead(ctx, T, 'note');
  ctx.fillStyle = T.acc; ctx.font = '700 200px ' + DISP; ctx.fillText('“', M - 12, 320);
  ctx.fillStyle = T.ink; ctx.font = '400 58px ' + DISP;
  wrap(ctx, p.quote, M, TEX_H * 0.42, TEX_W - M * 2, 74);
  ctx.fillStyle = T.sub; ctx.font = '400 22px ' + SANS; ctx.fillText(p.by, M, TEX_H * 0.82);
  folio(ctx, T, p.foot);
}
function L_moves(ctx, T, p) {
  masthead(ctx, T, 'method');
  kicker(ctx, T, p.kick, 250);
  lines(ctx, p.title, M, 322, 64, '600 58px ' + DISP, T.ink);
  const bw = 168, gap = 30, total = bw * 3 + gap * 2, x0 = (TEX_W - total) / 2, cy = TEX_H * 0.56;
  p.steps.forEach((s, i) => {
    const x = x0 + i * (bw + gap), on = i === 2;
    ctx.strokeStyle = on ? T.acc : T.hair; ctx.lineWidth = 3;
    ctx.fillStyle = on ? (T === THEMES.dark ? 'rgba(255,138,77,.10)' : 'rgba(207,74,28,.07)') : 'transparent';
    rrect(ctx, x, cy - 86, bw, 150, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = on ? T.acc : T.ink; ctx.font = '700 40px ' + DISP; ctx.fillText('0' + (i + 1), x + bw / 2, cy - 18);
    ctx.fillStyle = T.sub; ctx.font = '500 24px ' + SANS; ctx.fillText(s, x + bw / 2, cy + 34); ctx.textAlign = 'left';
    if (i < 2) { ctx.strokeStyle = T.faint; ctx.lineWidth = 2.5; const ax = x + bw + 4, ay = cy - 12;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + gap - 8, ay); ctx.lineTo(ax + gap - 16, ay - 7); ctx.moveTo(ax + gap - 8, ay); ctx.lineTo(ax + gap - 16, ay + 7); ctx.stroke(); }
  });
  ctx.fillStyle = T.acc; ctx.font = '500 28px ' + DISP; ctx.textAlign = 'center';
  ctx.fillText(p.take, TEX_W / 2, TEX_H * 0.76); ctx.textAlign = 'left';
  folio(ctx, T, p.foot);
}
function L_list(ctx, T, p) {
  masthead(ctx, T, p.no ? 'index · ' + p.no : 'index');
  kicker(ctx, T, p.kick, 250);
  lines(ctx, p.title, M, 322, 62, '600 56px ' + DISP, T.ink);
  let y = TEX_H * 0.5;
  p.items.forEach((it, i) => {
    rule(ctx, M, y - 36, TEX_W - M, T.hair);
    ctx.fillStyle = T.acc; ctx.font = '700 26px ' + DISP; ctx.fillText('0' + (i + 1), M, y);
    ctx.fillStyle = T.ink; ctx.font = '400 28px ' + SANS; ctx.fillText(it, M + 70, y);
    y += 64;
  });
  folio(ctx, T, p.foot);
}
function L_feature(ctx, T, p) {
  masthead(ctx, T, 'profile');
  kicker(ctx, T, p.kick, 250);
  lines(ctx, p.title, M, 320, 60, '600 56px ' + DISP, T.ink);
  // monogram
  const cx = M + 96, cy = TEX_H * 0.5;
  ctx.fillStyle = T === THEMES.dark ? 'rgba(255,255,255,.05)' : 'rgba(27,28,36,.05)';
  ctx.beginPath(); ctx.arc(cx, cy, 92, 0, 7); ctx.fill();
  ctx.strokeStyle = T.acc; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 92, 0, 7); ctx.stroke();
  ctx.fillStyle = T.acc; ctx.font = '700 70px ' + DISP; ctx.textAlign = 'center'; ctx.fillText('SD', cx, cy + 24); ctx.textAlign = 'left';
  ctx.fillStyle = T.sub; ctx.font = '300 28px ' + SANS; wrap(ctx, p.body, cx + 150, cy - 50, TEX_W - (cx + 150) - M, 42);
  let x = M;
  p.stats.forEach(s => { ctx.fillStyle = T.ink; ctx.font = '700 44px ' + DISP; ctx.fillText(s[0], x, TEX_H * 0.78);
    ctx.fillStyle = T.sub; ctx.font = '400 18px ' + SANS; ctx.fillText(s[1], x, TEX_H * 0.78 + 30); x += 220; });
  folio(ctx, T, p.foot);
}

function kicker2(ctx, T, txt, y) { ctx.fillStyle = T.acc; ctx.font = '600 22px ' + SANS; ls(ctx, '2.5px'); ctx.textAlign = 'center'; ctx.fillText(String(txt).toUpperCase(), TEX_W / 2, y); ls(ctx, '0px'); ctx.textAlign = 'left'; }
function wrapCentre(ctx, text, cx, y, max, lh) {
  ctx.textAlign = 'center'; let line = '', yy = y;
  for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, cx, yy); ctx.textAlign = 'left';
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* ---- special pages -------------------------------------------------------- */
/* ---- illuminated-manuscript cover helpers ---- */
const CINZEL = '"Cinzel", serif';
const CINZEL_D = '"Cinzel Decorative", "Cinzel", serif';
function goldGrad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0.00, '#8a6a22'); g.addColorStop(0.26, '#e7c66a'); g.addColorStop(0.50, '#fbeeb0');
  g.addColorStop(0.74, '#d9ab44'); g.addColorStop(1.00, '#94701d');
  return g;
}
function fleuron(ctx, cx, cy, s, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const gold = goldGrad(ctx, -s, -s, s, s);
  ctx.strokeStyle = gold; ctx.fillStyle = gold; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.9, -s * 0.15, s, -s); ctx.stroke();
  ctx.beginPath(); ctx.arc(s, -s, s * 0.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.15, s * 0.9, -s, s); ctx.stroke();
  ctx.beginPath(); ctx.arc(-s, s, s * 0.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, s * 0.13, 0, 7); ctx.fill();
  ctx.restore();
}
function jewel(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.32, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, color); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = goldGrad(ctx, cx - r, cy - r, cx + r, cy + r);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
}

function L_cover(ctx) {
  const W = TEX_W, H = TEX_H, CX = W / 2;
  // ---- deep lapis jewel ground + glow + vellum speckle + vignette ----
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, '#242c80'); g.addColorStop(0.5, '#161b58'); g.addColorStop(1, '#0b0f36');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(CX, H * 0.33, 20, CX, H * 0.33, W);
  rg.addColorStop(0, 'rgba(150,170,255,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,238,200,0.05)';
  for (let i = 0; i < 520; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.3, 1.3);
  const vg = ctx.createRadialGradient(CX, H / 2, H * 0.32, CX, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // ---- gold double border + corner fleurons ----
  const m = 54;
  ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H); ctx.lineWidth = 7; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.lineWidth = 2.5; ctx.strokeRect(m + 13, m + 13, W - 2 * m - 26, H - 2 * m - 26);
  const fm = m + 13;
  fleuron(ctx, fm + 8, fm + 8, 30, 0);
  fleuron(ctx, W - fm - 8, fm + 8, 30, Math.PI / 2);
  fleuron(ctx, W - fm - 8, H - fm - 8, 30, Math.PI);
  fleuron(ctx, fm + 8, H - fm - 8, 30, -Math.PI / 2);

  ctx.textAlign = 'center';
  // ---- top label + rule (height-relative so it recentres at any TEX_H) ----
  const topY = Math.round(H * 0.122);
  ctx.fillStyle = goldGrad(ctx, CX - 220, 0, CX + 220, 0); ctx.font = '700 25px ' + CINZEL; ls(ctx, '7px');
  ctx.fillText('MINIORANGE · ANNO MMXXVI', CX, topY); ls(ctx, '0px');
  ctx.strokeStyle = goldGrad(ctx, CX - 90, 0, CX + 90, 0); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CX - 92, topY + 24); ctx.lineTo(CX + 92, topY + 24); ctx.stroke();

  // ---- illuminated initial "C" (vermilion panel, gold diaper + frame) ----
  const ps = 150, py = Math.round(H * 0.27), x0 = CX - ps / 2, y0 = py - ps / 2;
  ctx.fillStyle = '#9c241c'; ctx.fillRect(x0, y0, ps, ps);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, ps, ps); ctx.clip();   // keep the diaper + initial inside the panel
  ctx.strokeStyle = 'rgba(255,214,150,0.28)'; ctx.lineWidth = 1.5;
  for (let d = -ps; d < ps; d += 20) { ctx.beginPath(); ctx.moveTo(x0 + d, y0); ctx.lineTo(x0 + d + ps, y0 + ps); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0 + d + ps, y0); ctx.lineTo(x0 + d, y0 + ps); ctx.stroke(); }
  ctx.fillStyle = goldGrad(ctx, x0, y0, x0 + ps, y0 + ps); ctx.font = '900 168px ' + CINZEL_D;
  ctx.textBaseline = 'middle'; ctx.fillText('C', CX, py + 8); ctx.textBaseline = 'alphabetic'; ctx.restore();
  ctx.strokeStyle = goldGrad(ctx, x0, y0, x0 + ps, y0 + ps); ctx.lineWidth = 5; ctx.strokeRect(x0, y0, ps, ps);

  // ---- gilded title ----
  ctx.fillStyle = goldGrad(ctx, CX - 300, 0, CX + 300, 0);
  ctx.font = '900 76px ' + CINZEL; ls(ctx, '3px');
  ctx.fillText('CLAUDE', CX, py + 192); ctx.fillText('SESSION', CX, py + 276); ls(ctx, '0px');
  ctx.font = '700 40px ' + CINZEL; ctx.fillText('· MMXXVI ·', CX, py + 336);
  ctx.fillStyle = 'rgba(247,237,208,0.85)'; ctx.font = '500 30px ' + CINZEL; ls(ctx, '4px');
  ctx.fillText('THE FIELD GUIDE', CX, py + 396); ls(ctx, '0px');

  // ---- jewel ornament row ----
  const oy = H - 244;
  ctx.strokeStyle = goldGrad(ctx, CX - 200, 0, CX + 200, 0); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CX - 200, oy); ctx.lineTo(CX - 30, oy); ctx.moveTo(CX + 30, oy); ctx.lineTo(CX + 200, oy); ctx.stroke();
  jewel(ctx, CX - 64, oy, 11, '#1f7a52');   // emerald
  jewel(ctx, CX, oy, 15, '#c4302a');         // ruby
  jewel(ctx, CX + 64, oy, 11, '#2a52c4');    // sapphire

  // ---- bottom folio ----
  ctx.fillStyle = goldGrad(ctx, CX - 90, 0, CX + 90, 0); ctx.font = '700 42px ' + CINZEL;
  ctx.fillText('№ XXVI', CX, H - 128);
  ctx.fillStyle = 'rgba(247,237,208,0.62)'; ctx.font = '500 19px ' + CINZEL; ls(ctx, '4px');
  ctx.fillText('A LIVE FIELD GUIDE TO DIRECTING CLAUDE', CX, H - 94); ls(ctx, '0px');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function L_title(ctx, T) {
  paper(ctx, T); masthead(ctx, T, 'colophon');
  ctx.fillStyle = T.acc; ctx.font = '600 22px ' + DISP; ls(ctx, '3px'); ctx.fillText('A GRIMOIRE FOR', M, 320); ls(ctx, '0px');
  lines(ctx, 'Directing your\nmost forgetful\nfamiliar.', M, 404, 78, '700 72px ' + DISP, T.ink);
  ctx.fillStyle = T.sub; ctx.font = '400 27px ' + SANS;
  wrap(ctx, 'Two hours. Seven rites. Twenty places. No scrolls — the terminal is the altar.', M, TEX_H * 0.72, TEX_W * 0.62, 40);
  folio(ctx, T, 'miniOrange · Surajit Dutta');
}
function L_end(ctx, T) {
  paper(ctx, T);
  ctx.fillStyle = T.ink; ctx.font = '700 72px ' + DISP; ctx.fillText('Finis.', M, TEX_H * 0.42);
  ctx.fillStyle = T.sub; ctx.font = '400 30px ' + SANS;
  wrap(ctx, 'Now go and command your familiar. New chat, new spell — context is your currency.', M, TEX_H * 0.5, TEX_W * 0.62, 44);
  folio(ctx, T, 'shipped by candlelight');
}
function L_back(ctx) {
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, '#0d1530'); g.addColorStop(1, '#0a0f22');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = '#aab4d0'; ctx.font = '300 32px ' + SANS;
  wrap(ctx, 'Brief it like an apprentice. Judge it like a master. New spell, new chat — context is your currency.', M, TEX_H * 0.46, TEX_W - M * 2, 46);
  ctx.fillStyle = '#ff8a4d'; ctx.font = '600 20px ' + SANS; ls(ctx, '2px'); ctx.fillText('SHIPPED BY CANDLELIGHT', M, TEX_H - 96); ls(ctx, '0px');
}

const LAYOUTS = { opener:L_opener, editorial:L_editorial, stat:L_stat, quote:L_quote, moves:L_moves, list:L_list, feature:L_feature };
function makeFace(p) {
  const c = cv(), ctx = c.getContext('2d'), T = THEMES[p.theme];
  if (p.layout === 'cover') L_cover(ctx);
  else if (p.layout === 'title') L_title(ctx, T);
  else if (p.layout === 'end') L_end(ctx, T);
  else if (p.layout === 'backcover') L_back(ctx);
  else { paper(ctx, T); LAYOUTS[p.layout](ctx, T, p); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}

/* ===========================================================================
   leaf material — two-sided content + scroll-driven curl
   =========================================================================== */
function leafMaterial(frontTex, backTex, pageW, gutter, idx) {
  const mat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.40 });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -(1 + (idx || 0));   // UNIQUE per leaf — deterministic tie-break
  const u = { uCurl: { value: 0 }, uPageW: { value: pageW }, uBackMap: { value: backTex }, uGutter: { value: gutter || 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCurl = u.uCurl; sh.uniforms.uPageW = u.uPageW; sh.uniforms.uBackMap = u.uBackMap; sh.uniforms.uGutter = u.uGutter;
    sh.vertexShader = 'uniform float uCurl;\nuniform float uPageW;\nuniform float uGutter;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float _xn = clamp(position.x / uPageW, 0.0, 1.0);
       transformed.z += sin(_xn * 3.14159265) * uCurl;
       transformed.x -= (1.0 - cos(_xn * 1.5707963)) * uCurl * 0.45;
       // gentle gutter: pages dip toward the spine (the crease) with a tiny
       // raised binding right at the centre (the bump)
       transformed.z -= pow(1.0 - _xn, 2.6) * uGutter;
       transformed.z += smoothstep(0.06, 0.0, _xn) * uGutter * 0.55;`
    );
    sh.fragmentShader = 'uniform sampler2D uBackMap;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
         vec4 _c = gl_FrontFacing ? texture2D(map, vMapUv) : texture2D(uBackMap, vec2(1.0 - vMapUv.x, vMapUv.y));
         diffuseColor *= _c;
       #endif`
    );
  };
  return { mat, u };
}
function leaf(frontTex, backTex, w, gutter, idx) {
  w = w || PAGE_W;
  const geo = new THREE.PlaneGeometry(w, PAGE_H + (w > PAGE_W ? OVER : 0), 40, 1); geo.translate(w / 2, 0, 0);
  const { mat, u } = leafMaterial(frontTex, backTex, w, gutter, idx);
  const pivot = new THREE.Group(); pivot.add(new THREE.Mesh(geo, mat));
  return { pivot, u };
}

/* ===========================================================================
   scene
   =========================================================================== */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.5, 100);   // near 0.1→0.5 → ~5x depth precision at z≈5.7 (kills flat-region z-fight)
camera.position.set(0, 0, 7.4);   // looks straight down -Z → world (0,0) is screen centre

renderer.setClearAlpha(0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xc4d4ff, 0x0a0c16, 0.5));
const key = new THREE.DirectionalLight(0xfff4e8, 2.0); key.position.set(3.0, 3.2, 5.2); scene.add(key);   // lower elevation → grazing highlight rakes the curling fold
const fill = new THREE.DirectionalLight(0xbcccff, 0.5); fill.position.set(4, 0.5, 2.5); scene.add(fill);
const rim = new THREE.DirectionalLight(0xff7a3a, 0.9); rim.position.set(-5, 1.4, -1.5); scene.add(rim);
const edge = new THREE.PointLight(0xff7a3a, 9, 16, 2); edge.position.set(-0.2, 0.6, 2.4); scene.add(edge);   // orange streak pulled to the spine valley

const book = new THREE.Group(); scene.add(book);
let frontCover, leaves = [], coverU;

// Sleek magazine: no centre spine, no chunky page-block "support", no gutter
// crease — just a flush cover over a thin stack of clean leaves.
function buildBook(T) {
  // Every STACKING sheet gets gutter 0 → at rest it is a perfectly FLAT plane
  // (the old baked gutter warp ~0.012 was bigger than the 0.005 page gap and
  // z-fought). Pages live on a deep monotone z-ladder (RIGHT_TOP..-0.15 by
  // SHEET) and each gets a UNIQUE idx → unique polygon-offset tie-break.
  const back = leaf(T.backInside, T.backOut, PAGE_W, 0, 90); back.pivot.position.set(0, 0, BACK_Z); book.add(back.pivot);

  for (let i = 0; i < N_LEAVES; i++) {
    const lf = leaf(T.leaves[i].front, T.leaves[i].back, PAGE_W, 0, i);
    lf.pivot.position.set(0, 0, RIGHT_TOP - i * SHEET); book.add(lf.pivot); leaves.push(lf);   // 0.10,0.05,0.00,-0.05,-0.10,-0.15
  }
  // front cover — keeps a token gutter (never stacks against another sheet)
  const fc = leaf(T.cover, T.title, PAGE_W, GUTTER, 80); fc.pivot.position.set(0, 0, COVER_Z); book.add(fc.pivot); frontCover = fc; coverU = fc.u;
}

/* ===========================================================================
   choreography
   =========================================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// the story: book ON THE RIGHT (hero) → travels to CENTRE + opens (reads) →
// closes and slides to the LEFT while the reserve CTA appears on the right
const FIT_ASPECT = 1.18;   // below this aspect, dolly back so the book fits (see apply)
const HERO = { pos: [1.95, -0.05, 0], rot: [0.16, -0.62, 0.06], scl: 1.14, cam: 7.2 };
const READ = { pos: [0, 0, 0], rot: [-0.18, 0, 0], scl: 1.18, cam: 5.7 };   // FACE-ON while reading: zero yaw/roll so the spine sits at world x=0 and the
                                                                            // two pages project to disjoint screen halves. Any yaw made the nearer
                                                                            // (shallower-z) page overlap a strip of the deeper page at the spine,
                                                                            // clipping centred content (the 70% / 20 stat pages). Slight x-tilt kept
                                                                            // for thickness; that only affects vertical projection, never the spine.
const CLOSED_LEFT = { pos: [-1.62, 0.0, 0], rot: [0.12, -0.5, 0.05], scl: 0.92, cam: 6.6 };
function mix(a, b, k) {
  return { pos: a.pos.map((v, i) => lerp(v, b.pos[i], k)), rot: a.rot.map((v, i) => lerp(v, b.rot[i], k)), scl: lerp(a.scl, b.scl, k), cam: lerp(a.cam, b.cam, k) };
}

const panelL = document.getElementById('panel-left');
const panelR = document.getElementById('panel-right');
const rail = document.getElementById('bk-rail-fill');
const nav = document.getElementById('bk-nav');
const seclabel = document.querySelector('.bk-seclabel');

let pSmooth = 0;
function progress() { const total = stage.offsetHeight - innerHeight; return clamp(-stage.getBoundingClientRect().top / total, 0, 1); }

function apply(p, t) {
  const closeK = ease(smooth(0.86, 0.985, p));   // 0 = open/reading → 1 = closed into its cover

  // book on the right (hero) → centre (reads) → left + closed (finale)
  let st;
  if (p < 0.12) st = HERO;
  else if (p < 0.30) st = mix(HERO, READ, ease(smooth(0.12, 0.30, p)));
  else if (p < 0.86) st = READ;
  else st = mix(READ, CLOSED_LEFT, closeK);

  const floatA = REDUCE ? 0 : 0.012 * (1 - smooth(0.12, 0.30, p)) + 0.012 * smooth(0.9, 1, p);
  book.position.set(st.pos[0], st.pos[1] + Math.sin(t * 0.9) * floatA * 1.4, st.pos[2]);
  book.rotation.set(st.rot[0], st.rot[1] + Math.sin(t * 0.6) * floatA, st.rot[2]);
  book.scale.setScalar(st.scl);
  // Narrow / portrait viewports: dolly the camera back so the full open spread
  // (~2·PAGE_W wide) and the off-centre hero book stay on-screen. Wide desktop
  // (aspect ≥ FIT_ASPECT) is untouched (mul = 1) so the verified centred desktop
  // framing is unchanged; only sub-~1.18 aspects (phones, portrait, very narrow
  // windows) pull back to fit.
  const fitMul = camera.aspect < FIT_ASPECT ? FIT_ASPECT / camera.aspect : 1;
  camera.position.z = st.cam * fitMul;

  // cover opens as the book arrives at centre, then folds back shut at the finale
  if (coverU !== undefined) {
    const coverOpen = ease(smooth(0.22, 0.40, p)) * (1 - closeK);
    frontCover.pivot.rotation.y = -Math.PI * coverOpen;
    frontCover.pivot.position.z = lerp(COVER_Z, COVER_OPEN_Z, coverOpen);   // 0.16 → -0.40 : backs the deep left pile
  }

  // leaves turn (and re-stack so the latest is on top) during reading, then fold
  // back shut at the finale. The mid-flip lift keeps a turning page above the
  // stack so it arcs over cleanly (no clip/z-fight glitch when it lands).
  // IMPORTANT: every flip must COMPLETE before the close starts (closeK ramps
  // from p=0.86). The last leaf finishes at F0 + (N_FLIP-1+1.5)*per, so F1 is
  // tuned so that lands ~0.82 — leaving a clean fully-open rest before the
  // close. (Earlier F1=0.85 let the host page finish at ~0.89, i.e. it was
  // still mid-turn — nearly flat, grazing — when the close began, so it
  // overlapped the already-flat INDEX/yield page and the text garbled.)
  // STRICTLY one active page at a time: the flip windows ABUT EXACTLY (divisor
  // is `per`, not per*1.5), so at most one leaf is ever mid-turn — a leaf reaches
  // pr=1 (settled, FLAT, curl=0) at the same p the next reaches pr=0. Settled
  // pages sit on a deep, DISJOINT z-ladder (right 0.10..-0.10, left -0.35..-0.15),
  // so two flat pages are never coplanar; the single turning page rides a tall
  // camera-facing arc (LIFT) + y-rise (LIFT_Y) high above BOTH piles and drops
  // into its own slot. No overlap by construction. Last flip done by F1=0.80,
  // leaving a clean fully-open rest before the close ramps at 0.86.
  const F0 = 0.42, F1 = 0.80, per = (F1 - F0) / N_FLIP;   // per = 0.076, non-overlapping
  for (let i = 0; i < N_FLIP; i++) {
    const pr    = clamp((p - (F0 + i * per)) / per, 0, 1);          // full 0..1 inside its own slice
    const open  = ease(pr) * (1 - closeK);
    const zRight = RIGHT_TOP - i * SHEET;                           //  0.10 .. -0.10
    const zLeft  = LEFT_TOP - (N_FLIP - 1 - i) * SHEET;             // -0.35 (leaf0) .. -0.15 (leaf4 lands on top)
    const bell   = Math.sin(Math.PI * pr) * (1 - closeK);          // EXACTLY 0 at pr=0 and pr=1 → flat at rest
    leaves[i].pivot.rotation.y = -Math.PI * open;                  // 0 (right) → -PI (left)
    leaves[i].pivot.position.z = lerp(zRight, zLeft, open) + bell * LIFT;   // arc toward camera, crest clears both piles
    leaves[i].pivot.position.y = bell * LIFT_Y;                    // up-and-over peel
    leaves[i].u.uCurl.value    = bell * CURL;                      // bows only in flight
  }

  // hero text (left) dissolves as the book heads to centre; the reserve CTA
  // (right) fades in as the book closes and slides left — one continuous story
  const heroOut = smooth(0.05, 0.22, p);
  panelL.style.opacity = (1 - heroOut).toFixed(3); panelL.style.setProperty('--out', heroOut.toFixed(3));
  const reserveIn = smooth(0.87, 0.99, p);
  panelR.style.opacity = reserveIn.toFixed(3); panelR.style.setProperty('--in', reserveIn.toFixed(3));
  if (seclabel) seclabel.style.opacity = (smooth(0.12, 0.30, p) * (1 - closeK)).toFixed(3);

  pin.style.setProperty('--aura', (0.2 + 0.34 * smooth(0.12, 0.36, p) * (1 - 0.5 * closeK)).toFixed(3));
  rail.style.width = (p * 100).toFixed(2) + '%';
  nav.classList.toggle('is-on', p > 0.02 || scrollY > 60);
}

/* ===========================================================================
   sizing + loop + boot
   =========================================================================== */
function resize() {
  const w = pin.clientWidth, h = pin.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  pSmooth += (progress() - pSmooth) * 0.14;
  apply(pSmooth, clock.getElapsedTime());
  renderer.render(scene, camera);
}

async function boot() {
  try {
    await Promise.all([
      document.fonts.load('400 32px "EB Garamond"'),
      document.fonts.load('600 32px "EB Garamond"'),
      document.fonts.load('italic 400 32px "EB Garamond"'),
      document.fonts.load('900 90px "Cinzel"'),
      document.fonts.load('600 24px "Cinzel"'),
      document.fonts.load('700 30px "Cinzel"'),
      document.fonts.load('900 90px "Cinzel Decorative"'),
    ]);
  } catch (e) {}
  try { await document.fonts.ready; } catch (e) {}

  const T = { cover: makeFace(COVER), title: makeFace(TITLEPG), backOut: makeFace(BACKOUT), backInside: makeFace(ENDPAGE), leaves: [] };
  for (let i = 0; i < N_LEAVES; i++) {
    T.leaves.push({ front: makeFace(PAGES[i * 2] || ENDPAGE), back: makeFace(PAGES[i * 2 + 1] || ENDPAGE) });
  }
  buildBook(T);
  resize();
  addEventListener('resize', resize, { passive: true });
  loop();

  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-in'); }), { threshold: 0.2 });
  document.querySelectorAll('.fg-reveal').forEach(el => io.observe(el));
}

boot();
