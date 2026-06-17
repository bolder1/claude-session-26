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
const PAGE_W = 1.55, PAGE_H = 2.13, OVER = 0;     // flush magazine cover (no hardcover lip)
const TEX_W = 864, TEX_H = 1188;
const N_LEAVES = 6, N_FLIP = 5, CURL = 0.24, GUTTER = 0.012;

/* ===========================================================================
   MAGAZINE PAGE SYSTEM — varied layouts, real whitespace, 3 themes
   =========================================================================== */
const DISP = '"TASA Orbiter","Inter",sans-serif';
const SANS = '"Inter",sans-serif';
const THEMES = {
  light:  { a:'#f6f3ec', b:'#ece5d8', ink:'#1b1c24', sub:'#5b5c69', hair:'rgba(27,28,36,.16)', acc:'#cf4a1c', faint:'rgba(27,28,36,.34)' },
  dark:   { a:'#141d34', b:'#0a0e1c', ink:'#eef1f8', sub:'#9aa4c0', hair:'rgba(180,196,236,.18)', acc:'#ff8a4d', faint:'rgba(234,238,247,.34)' },
  orange: { a:'#ef5a2a', b:'#db4a1d', ink:'#fff4ec', sub:'rgba(255,244,236,.86)', hair:'rgba(255,244,236,.34)', acc:'#fff4ec', faint:'rgba(255,244,236,.6)' },
};
const M = 120;                                   // generous outer margin

const PAGES = [
  { theme:'light',  layout:'opener',    no:'01', kick:'What you’re working with', title:'The\nPremise', foot:'i · the premise' },
  { theme:'orange', layout:'stat',      big:'70%', kick:'Read the label', cap:'is where it stops.', note:'The last thirty percent — taste, judgment, the call only you can make — is the whole job.', foot:'ii · the label' },
  { theme:'light',  layout:'editorial', kick:'Three ingredients', title:'No context.\nNo memory.\nNo taste.', body:'It has never seen your product, your users, or your taste. An hour into a chat it has forgotten how the chat began. It hands you seventy percent, every time.', foot:'iii · the premise' },
  { theme:'dark',   layout:'quote',     quote:'Brief it like a junior. Judge it like a director.', by:'— the one rule everything else hangs on', foot:'iv · the method' },
  { theme:'light',  layout:'opener',    no:'02', kick:'The whole job, three moves', title:'The\nMethod', foot:'v · the method' },
  { theme:'light',  layout:'moves',     kick:'Stop making pixels', title:'Direct them instead.', steps:['Brief','Produce','Judge'], take:'Your brief is the product.', foot:'vi · the method' },
  { theme:'dark',   layout:'editorial', kick:'Move 02', title:'Let it\nproduce.', body:'At a speed you can’t match. Screenshots become critiques; briefs become working React, rendering while you watch. The first output is a sketch, never a comp.', foot:'vii · the method' },
  { theme:'light',  layout:'list',      no:'03', kick:'The yield', title:'Before the\ncoffee’s cold.', items:['Screenshot → working prototype','Spend tokens like a director','Give your intern a memory','Put Claude inside Figma','A week of research in an afternoon'], foot:'viii · the yield' },
  { theme:'light',  layout:'opener',    no:'04', kick:'Two hours, seven acts', title:'The\nRunning\nOrder', foot:'ix · the order' },
  { theme:'light',  layout:'feature',   kick:'Your host', title:'Surajit Dutta', body:'Product designer · miniOrange. Everything here came off real work — IAM, IGA, PayOps. Every demo runs live; if it breaks, you watch me debug it.', stats:[['42','ranked reqs'],['9','screens'],['0','slides']], foot:'x · your host' },
  { theme:'orange', layout:'stat',      big:'20', kick:'Last call', cap:'seats. one of them is yours.', note:'Reserve on the right — pick your slot and we’ll print your pass.', foot:'xi · last call' },
];
const COVER   = { theme:'dark', layout:'cover' };
const TITLEPG = { theme:'light', layout:'title' };
const ENDPAGE = { theme:'dark', layout:'end' };
const BACKOUT = { theme:'dark', layout:'backcover' };

const CAPTIONS = [['01','the premise'],['✦','the label'],['02','the method'],['✦','let it produce'],['03','the yield'],['✦','last call']];

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
  const g = ctx.createLinearGradient(0, 0, TEX_W * 0.2, TEX_H);
  g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H);
  if (T !== THEMES.orange) {
    const rg = ctx.createRadialGradient(TEX_W * 0.32, TEX_H * 0.28, 40, TEX_W * 0.32, TEX_H * 0.28, TEX_W);
    rg.addColorStop(0, T === THEMES.dark ? 'rgba(120,150,230,.10)' : 'rgba(255,253,247,.6)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, TEX_W, TEX_H);
  }
  // faint gutter shading on both inner edges so the centre crease reads
  for (const left of [true, false]) {
    const x0 = left ? 0 : TEX_W - 58;
    const g2 = ctx.createLinearGradient(left ? 0 : TEX_W, 0, left ? 58 : TEX_W - 58, 0);
    g2.addColorStop(0, 'rgba(12,10,22,.17)'); g2.addColorStop(1, 'rgba(12,10,22,0)');
    ctx.fillStyle = g2; ctx.fillRect(x0, 0, 58, TEX_H);
  }
  // a hair of light right at the binding (the gutter "bump")
  ctx.fillStyle = T === THEMES.dark ? 'rgba(190,205,255,.10)' : 'rgba(255,250,242,.14)';
  ctx.fillRect(3, 0, 2, TEX_H); ctx.fillRect(TEX_W - 5, 0, 2, TEX_H);
}
function masthead(ctx, T, right) {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = T.faint; ctx.font = '600 19px ' + SANS; ls(ctx, '2.5px');
  ctx.fillText('CLAUDE SESSION ’26', M, 84);
  if (right) { ctx.textAlign = 'right'; ctx.fillText(String(right).toUpperCase(), TEX_W - M, 84); ctx.textAlign = 'left'; }
  ls(ctx, '0px'); rule(ctx, M, 108, TEX_W - M, T.hair);
}
function folio(ctx, T, label) {
  rule(ctx, M, TEX_H - 96, TEX_W - M, T.hair);
  ctx.fillStyle = T.faint; ctx.font = '500 18px ' + SANS; ls(ctx, '2px'); ctx.textAlign = 'left';
  ctx.fillText(String(label).toUpperCase(), M, TEX_H - 62); ls(ctx, '0px');
  ctx.fillStyle = T.acc; ctx.beginPath(); ctx.arc(TEX_W - M, TEX_H - 68, 5, 0, 7); ctx.fill();
}
function kicker(ctx, T, txt, y) { ctx.fillStyle = T.acc; ctx.font = '600 22px ' + SANS; ls(ctx, '2.5px'); ctx.fillText(String(txt).toUpperCase(), M, y); ls(ctx, '0px'); }

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
  ctx.fillStyle = T.ink; ctx.font = '700 300px ' + DISP; ctx.fillText(p.big, TEX_W / 2, TEX_H * 0.56);
  ctx.fillStyle = T.ink; ctx.font = '400 40px ' + DISP; ctx.fillText(p.cap, TEX_W / 2, TEX_H * 0.66);
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
function L_cover(ctx) {
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
  g.addColorStop(0, '#16203f'); g.addColorStop(.5, '#0d1530'); g.addColorStop(1, '#0a0f22');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.save(); ctx.translate(TEX_W * 0.5, TEX_H * 0.64);
  for (let i = 8; i >= 1; i--) { ctx.strokeStyle = i === 2 ? 'rgba(255,138,77,.9)' : 'rgba(190,205,255,.10)'; ctx.lineWidth = i === 2 ? 5 : 2; ctx.beginPath(); ctx.arc(0, 0, i * 36, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#ff8a4d'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ff8a4d'; ctx.font = '600 22px ' + SANS; ls(ctx, '4px'); ctx.fillText('MINIORANGE DESIGN STUDIO', M, 156); ls(ctx, '0px');
  ctx.fillStyle = '#f4ece0'; ctx.font = '700 96px ' + DISP; ctx.fillText('Claude', M, 300); ctx.fillText('Session ’26', M, 396);
  ctx.fillStyle = '#aab4d0'; ctx.font = '300 36px ' + SANS; ctx.fillText('The Field Guide', M, 462);
  rule(ctx, M, TEX_H - 150, TEX_W - M, 'rgba(190,205,255,.22)');
  ctx.fillStyle = '#aab4d0'; ctx.font = '500 22px ' + SANS; ls(ctx, '2px'); ctx.fillText('FIELD GUIDE', M, TEX_H - 102); ls(ctx, '0px');
  ctx.textAlign = 'right'; ctx.fillStyle = '#ff8a4d'; ctx.font = '700 42px ' + DISP; ctx.fillText('№ 26', TEX_W - M, TEX_H - 96); ctx.textAlign = 'left';
}
function L_title(ctx, T) {
  paper(ctx, T); masthead(ctx, T, 'colophon');
  ctx.fillStyle = T.acc; ctx.font = '600 22px ' + SANS; ls(ctx, '3px'); ctx.fillText('A LIVE FIELD GUIDE TO', M, 320); ls(ctx, '0px');
  lines(ctx, 'Running your\nmost forgetful\nhire.', M, 404, 78, '700 72px ' + DISP, T.ink);
  ctx.fillStyle = T.sub; ctx.font = '300 27px ' + SANS;
  wrap(ctx, 'Two hours. Seven acts. Forty-eight seats. No slides — the terminal is the deck.', M, TEX_H * 0.72, TEX_W * 0.62, 40);
  folio(ctx, T, 'miniOrange · Surajit Dutta');
}
function L_end(ctx, T) {
  paper(ctx, T);
  ctx.fillStyle = T.ink; ctx.font = '700 72px ' + DISP; ctx.fillText('The end.', M, TEX_H * 0.42);
  ctx.fillStyle = T.sub; ctx.font = '300 30px ' + SANS;
  wrap(ctx, 'Now go brief your intern. New task, new chat — context is currency.', M, TEX_H * 0.5, TEX_W * 0.62, 44);
  folio(ctx, T, 'shipped with Claude');
}
function L_back(ctx) {
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, '#0d1530'); g.addColorStop(1, '#0a0f22');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = '#aab4d0'; ctx.font = '300 32px ' + SANS;
  wrap(ctx, 'Brief it like a junior. Judge it like a director. New task, new chat — context is currency.', M, TEX_H * 0.46, TEX_W - M * 2, 46);
  ctx.fillStyle = '#ff8a4d'; ctx.font = '600 20px ' + SANS; ls(ctx, '2px'); ctx.fillText('SHIPPED WITH CLAUDE', M, TEX_H - 96); ls(ctx, '0px');
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
function leafMaterial(frontTex, backTex, pageW, gutter) {
  const mat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.34 });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1;
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
function leaf(frontTex, backTex, w, gutter) {
  w = w || PAGE_W;
  const geo = new THREE.PlaneGeometry(w, PAGE_H + (w > PAGE_W ? OVER : 0), 40, 1); geo.translate(w / 2, 0, 0);
  const { mat, u } = leafMaterial(frontTex, backTex, w, gutter);
  const pivot = new THREE.Group(); pivot.add(new THREE.Mesh(geo, mat));
  return { pivot, u };
}

/* ===========================================================================
   scene
   =========================================================================== */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
camera.position.set(0, 0, 7.4);   // looks straight down -Z → world (0,0) is screen centre

renderer.setClearAlpha(0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xc4d4ff, 0x0a0c16, 0.5));
const key = new THREE.DirectionalLight(0xfff4e8, 2.0); key.position.set(3.4, 5.4, 4.6); scene.add(key);
const fill = new THREE.DirectionalLight(0xbcccff, 0.5); fill.position.set(4, 0.5, 2.5); scene.add(fill);
const rim = new THREE.DirectionalLight(0xff7a3a, 0.9); rim.position.set(-5, 1.4, -1.5); scene.add(rim);
const edge = new THREE.PointLight(0xff7a3a, 7, 16, 2); edge.position.set(-1.6, 0.3, 1.8); scene.add(edge);

const book = new THREE.Group(); scene.add(book);
let frontCover, leaves = [], coverU;

// Sleek magazine: no centre spine, no chunky page-block "support", no gutter
// crease — just a flush cover over a thin stack of clean leaves.
function buildBook(T) {
  // every sheet (covers + leaves) gets the SAME tiny gutter dip so the whole
  // stack curves toward the spine together — a subtle crease with no page
  // intersecting another (which was the left-side glitch). Visual crease/bump
  // is carried mostly by the drawn gutter shading in paper().
  const back = leaf(T.backInside, T.backOut, PAGE_W, GUTTER); back.pivot.position.set(0, 0, -0.02); book.add(back.pivot);

  const zTop = 0.024, zStep = 0.005;
  for (let i = 0; i < N_LEAVES; i++) {
    const lf = leaf(T.leaves[i].front, T.leaves[i].back, PAGE_W, GUTTER);
    lf.pivot.position.set(0, 0, zTop - i * zStep); book.add(lf.pivot); leaves.push(lf);
  }
  const fc = leaf(T.cover, T.title, PAGE_W, GUTTER); fc.pivot.position.set(0, 0, 0.042); book.add(fc.pivot); frontCover = fc; coverU = fc.u;
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
const HERO = { pos: [1.95, -0.05, 0], rot: [0.16, -0.62, 0.06], scl: 1.0, cam: 7.2 };
const READ = { pos: [0, 0, 0], rot: [-0.30, 0, 0], scl: 1.2, cam: 5.35 };
const CLOSED_LEFT = { pos: [-1.62, 0.0, 0], rot: [0.12, -0.5, 0.05], scl: 0.92, cam: 6.6 };
function mix(a, b, k) {
  return { pos: a.pos.map((v, i) => lerp(v, b.pos[i], k)), rot: a.rot.map((v, i) => lerp(v, b.rot[i], k)), scl: lerp(a.scl, b.scl, k), cam: lerp(a.cam, b.cam, k) };
}

const panelL = document.getElementById('panel-left');
const panelR = document.getElementById('panel-right');
const capEl = document.getElementById('bk-caption');
const capNo = capEl.querySelector('.bk-caption__no');
const capTx = capEl.querySelector('.bk-caption__txt');
const rail = document.getElementById('bk-rail-fill');
const nav = document.getElementById('bk-nav');
const seclabel = document.querySelector('.bk-seclabel');

let pSmooth = 0, lastCap = -1;
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
    frontCover.pivot.position.z = lerp(0.042, -0.030, coverOpen);
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
  const F0 = 0.42, F1 = 0.78, per = (F1 - F0) / N_FLIP;
  const zTop = 0.024, zStep = 0.005, LEFT_BASE = -0.030;
  for (let i = 0; i < N_FLIP; i++) {
    const pr = clamp((p - (F0 + i * per)) / (per * 1.5), 0, 1);
    const open = ease(pr) * (1 - closeK);
    leaves[i].pivot.rotation.y = -Math.PI * open;
    leaves[i].pivot.position.z = lerp(zTop - i * zStep, LEFT_BASE + (i + 1) * zStep, open) + Math.sin(Math.PI * pr) * 0.07 * (1 - closeK);
    leaves[i].u.uCurl.value = Math.sin(Math.PI * pr) * CURL * (1 - closeK);
  }

  // hero text (left) dissolves as the book heads to centre; the reserve CTA
  // (right) fades in as the book closes and slides left — one continuous story
  const heroOut = smooth(0.05, 0.22, p);
  panelL.style.opacity = (1 - heroOut).toFixed(3); panelL.style.setProperty('--out', heroOut.toFixed(3));
  const reserveIn = smooth(0.87, 0.99, p);
  panelR.style.opacity = reserveIn.toFixed(3); panelR.style.setProperty('--in', reserveIn.toFixed(3));
  if (seclabel) seclabel.style.opacity = (smooth(0.12, 0.30, p) * (1 - closeK)).toFixed(3);

  const cap = smooth(0.34, 0.40, p) * (1 - smooth(0.80, 0.86, p));
  capEl.style.opacity = cap.toFixed(3);
  if (cap > 0.1) { const idx = clamp(Math.round((p - F0) / per), 0, CAPTIONS.length - 1); if (idx !== lastCap) { capNo.textContent = CAPTIONS[idx][0]; capTx.textContent = CAPTIONS[idx][1]; lastCap = idx; } }

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
      document.fonts.load('700 90px "TASA Orbiter"'),
      document.fonts.load('600 90px "TASA Orbiter"'),
      document.fonts.load('300 30px "Inter"'),
      document.fonts.load('600 22px "Inter"'),
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
