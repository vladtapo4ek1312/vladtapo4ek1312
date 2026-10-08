'use strict';
// ============================================================
//  Графические примитивы, иконки предметов, спрайт героя
// ============================================================

const FONT = '"Neucha", "Comic Sans MS", "Segoe Print", "Trebuchet MS", cursive';
const OUT = '#2a1a16';

function font(size) { return size + 'px ' + FONT; }

function text(c, str, x, y, size, color = '#fff', align = 'left', outline = 'rgba(0,0,0,0.85)', ow = 3) {
  c.font = font(size);
  c.textAlign = align;
  c.textBaseline = 'middle';
  if (outline) {
    c.lineJoin = 'round';
    c.strokeStyle = outline;
    c.lineWidth = ow;
    c.strokeText(str, x, y);
  }
  c.fillStyle = color;
  c.fillText(str, x, y);
}

function circle(c, x, y, r, fill, stroke, lw = 2) {
  c.beginPath();
  c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function ellipse(c, x, y, rx, ry, fill, stroke, lw = 2, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function rrect(c, x, y, w, h, r, fill, stroke, lw = 2) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function line(c, x1, y1, x2, y2, color, lw = 2) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
}
function poly(c, pts, fill, stroke, lw = 2) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
function shadow(c, x, y, rx, ry, a = 0.35) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(0,0,0,' + a + ')';
  c.fill();
}

// ---------- окраска врагов (вспышка при попадании, яд, чемпионы) ----------
let FLASH = false, TINT = null;
function fc(col) {
  if (FLASH) return '#ffffff';
  if (TINT) return mixColor(col, TINT, 0.45);
  return col;
}

// ============================================================
//  Кеш спрайтов: статичные картинки (иконки, пикапы, снаряды)
//  рисуются один раз в маленький холст с учётом PIXEL_SCALE и
//  дальше копируются drawImage — градиенты и блики почти бесплатны.
//  На низком качестве спрайты строятся плоскими (artFlat).
// ============================================================
const artCache = new Map();
let artFlat = false;
function artSprite(key, hw, hh, draw) {
  const S = PIXEL_SCALE, lo = gfxLevel() === 0;
  const k = key + (lo ? '#f@' : '#s@') + S;
  let s = artCache.get(k);
  if (s) return s;
  if (artCache.size > 900) artCache.clear();
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(hw * 2 * S));
  cv.height = Math.max(1, Math.ceil(hh * 2 * S));
  const g = cv.getContext('2d');
  g.setTransform(S, 0, 0, S, hw * S, hh * S);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const was = artFlat;
  artFlat = lo;
  try { draw(g); } finally { artFlat = was; }
  s = { cv, hw, hh, w: cv.width / S, h: cv.height / S };
  artCache.set(k, s);
  return s;
}
// вывести спрайт центром в (x, y); без масштаба — с привязкой к пикселям экрана
function artBlit(c, s, x, y, k = 1) {
  if (k === 1) {
    const S = PIXEL_SCALE;
    c.drawImage(s.cv, Math.round((x - s.hw) * S) / S, Math.round((y - s.hh) * S) / S, s.w, s.h);
  } else c.drawImage(s.cv, x - s.hw * k, y - s.hh * k, s.w * k, s.h * k);
}
// детерминированный «шум» 0..1 для анимаций без состояния
function artHash(a, b) { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }

// ---------- объём ----------
// Заливает ТЕКУЩИЙ контур: основа, блик сверху-слева и тень снизу-справа
// (только внутри контура), затем обводка. Контур не теряется после restore().
function artVol(c, col, cx = 0, cy = 0, r = 14, lw = 2.2, stroke = OUT) {
  c.fillStyle = col; c.fill();
  if (!artFlat) {
    const g = c.createLinearGradient(cx - r * 0.6, cy - r * 0.85, cx + r * 0.6, cy + r * 0.85);
    g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.save(); c.clip(); c.fillStyle = g; c.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2); c.restore();
  }
  if (lw) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
// шар с объёмом
function artBall(c, x, y, r, col, lw = 2.2, stroke = OUT) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  if (artFlat) c.fillStyle = col;
  else {
    const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.06, x, y, r * 1.02);
    g.addColorStop(0, mixColor(col, '#ffffff', 0.5)); g.addColorStop(0.45, col); g.addColorStop(1, mixColor(col, '#000000', 0.4));
    c.fillStyle = g;
  }
  c.fill();
  if (lw) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
// блик
function artGlint(c, x, y, rx, ry, rot = -0.6, a = 0.85) {
  ellipse(c, x, y, rx, ry, 'rgba(255,255,255,' + a + ')', null, 0, rot);
}
// четырёхлучевая искра
function artStar4(c, x, y, s, col) {
  c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
  c.fillStyle = col; c.fill();
}
// пятиконечная звезда (контур)
function artStarPath(c, x, y, r, ri = r * 0.45, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5, rr = i % 2 ? ri : r;
    c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

// ---------- Сердца, монеты, ключи и т.д. ----------
function heartPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + 0.42 * s);
  c.bezierCurveTo(x - 0.62 * s, y + 0.02 * s, x - 0.52 * s, y - 0.52 * s, x, y - 0.2 * s);
  c.bezierCurveTo(x + 0.52 * s, y - 0.52 * s, x + 0.62 * s, y + 0.02 * s, x, y + 0.42 * s);
  c.closePath();
}
function artHeartBody(c, s, kind) {
  const soul = kind === 'soul' || kind === 'halfSoul', half = kind === 'half' || kind === 'halfSoul';
  const col = soul ? '#6f9ee8' : '#d82c2c', dark = soul ? '#2f548e' : '#7a0a10', hi = soul ? '#e2eeff' : '#ffb4ac';
  // пустой контейнер (и пустая половинка красного сердца) — тёмно-бурый со светлой
  // каймой, чтобы его было видно на чёрной полосе интерфейса
  const hollow = kind === 'empty' || kind === 'half', hollowFill = 'rgba(66,36,33,0.85)';
  heartPath(c, 0, 0, s);
  c.fillStyle = kind === 'empty' ? hollowFill : '#1a0d0d';
  c.fill();
  if (kind === 'half') { c.save(); c.beginPath(); c.rect(0, -s, s, s * 2); c.clip(); heartPath(c, 0, 0, s); c.fillStyle = hollowFill; c.fill(); c.restore(); }
  if (kind === 'empty' && !artFlat) ellipse(c, -s * 0.19, -s * 0.12, s * 0.11, s * 0.07, 'rgba(255,225,215,0.16)', null, 0, -0.6);
  if (kind !== 'empty') {
    c.save();
    if (half) { c.beginPath(); c.rect(-s, -s, s, s * 2); c.clip(); }
    heartPath(c, 0, s * 0.01, s * 0.8);
    if (artFlat) c.fillStyle = col;
    else {
      const g = c.createRadialGradient(-s * 0.17, -s * 0.15, s * 0.02, 0, s * 0.02, s * 0.46);
      g.addColorStop(0, mixColor(col, '#ffffff', 0.38)); g.addColorStop(0.42, col); g.addColorStop(1, dark);
      c.fillStyle = g;
    }
    c.fill();
    ellipse(c, -s * 0.19, -s * 0.12, s * 0.11, s * 0.07, hi, null, 0, -0.6);
    if (!artFlat && s >= 11) circle(c, s * 0.2, -s * 0.15, s * 0.035, 'rgba(255,255,255,0.7)');
    c.restore();
  }
  heartPath(c, 0, 0, s);
  c.strokeStyle = '#120808'; c.lineWidth = Math.max(1.2, s * 0.09); c.stroke();
  if (hollow) {
    c.save();
    if (half) { c.beginPath(); c.rect(0, -s, s, s * 2); c.clip(); }
    heartPath(c, 0, s * 0.01, s * 0.86);
    c.strokeStyle = 'rgba(214,160,146,0.6)'; c.lineWidth = Math.max(1, s * 0.065); c.stroke();
    c.restore();
  }
}
function drawHeart(c, x, y, s, kind) {
  const q = Math.max(4, Math.round(s * 2) / 2);
  const sp = artSprite('h' + kind + q, q * 0.56 + 2, q * 0.5 + 2, g => artHeartBody(g, q, kind));
  artBlit(c, sp, x, y, s / q);
}
function artCoinBody(c, r, value) {
  const col = value >= 10 ? '#8fd3ff' : value >= 5 ? '#d8dde6' : '#f2c53d';
  const dark = value >= 10 ? '#2f6e98' : value >= 5 ? '#6e7580' : '#9a6a0e';
  const hi = value >= 10 ? '#e8f8ff' : value >= 5 ? '#ffffff' : '#fff4b8';
  circle(c, 0, 0, r, dark, OUT, Math.max(1.2, r * 0.2));
  c.beginPath(); c.arc(-r * 0.06, -r * 0.06, r * 0.76, 0, Math.PI * 2);
  if (artFlat) c.fillStyle = col;
  else {
    const g = c.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, -r * 0.06, -r * 0.06, r * 0.8);
    g.addColorStop(0, hi); g.addColorStop(0.55, col); g.addColorStop(1, mixColor(col, dark, 0.45));
    c.fillStyle = g;
  }
  c.fill();
  if (r >= 5) circle(c, -r * 0.06, -r * 0.06, r * 0.54, null, mixColor(col, dark, 0.4), Math.max(0.7, r * 0.09));
  if (value >= 10) poly(c, [-r * 0.06, -r * 0.42, r * 0.2, -r * 0.06, -r * 0.06, r * 0.3, -r * 0.32, -r * 0.06], hi, dark, Math.max(0.7, r * 0.1));
  else if (value >= 5) { artStarPath(c, -r * 0.06, -r * 0.04, r * 0.34); c.fillStyle = mixColor(col, dark, 0.55); c.fill(); }
  else { c.fillStyle = dark; c.fillRect(-r * 0.16, -r * 0.4, r * 0.2, r * 0.68); }
  ellipse(c, -r * 0.36, -r * 0.38, r * 0.2, r * 0.12, 'rgba(255,255,255,0.92)', null, 0, -0.7);
}
// shine — фаза блеска 0..1 (пробегающая полоса), -1 — без блеска
function drawCoin(c, x, y, r, value = 1, shine = -1) {
  const q = Math.max(3, Math.round(r * 2) / 2);
  const sp = artSprite('c' + value + q, q + 2, q + 2, g => artCoinBody(g, q, value));
  artBlit(c, sp, x, y, r / q);
  if (shine >= 0 && shine < 1 && gfxLevel()) {
    c.save();
    c.beginPath(); c.arc(x - r * 0.06, y - r * 0.06, r * 0.76, 0, Math.PI * 2); c.clip();
    const sx = x - r * 1.7 + shine * r * 3.2;
    c.beginPath(); c.moveTo(sx, y + r); c.lineTo(sx + r * 0.45, y + r); c.lineTo(sx + r * 1.15, y - r); c.lineTo(sx + r * 0.7, y - r); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
    c.restore();
  }
}
function artKeyBody(c, s, col) {
  const hi = mixColor(col, '#ffffff', 0.6);
  c.rotate(-0.6);
  // бородка
  rrect(c, s * 0.34, s * 0.03, s * 0.13, s * 0.24, s * 0.03); artVol(c, col, s * 0.4, s * 0.15, s * 0.2, 1.3);
  rrect(c, s * 0.14, s * 0.03, s * 0.11, s * 0.17, s * 0.03); artVol(c, col, s * 0.2, s * 0.12, s * 0.2, 1.3);
  // стержень
  rrect(c, -s * 0.2, -s * 0.09, s * 0.76, s * 0.18, s * 0.06); artVol(c, col, s * 0.18, 0, s * 0.4, 1.4);
  // кольцо с дыркой
  c.beginPath(); c.arc(-s * 0.45, 0, s * 0.31, 0, Math.PI * 2); c.moveTo(-s * 0.45 + s * 0.12, 0); c.arc(-s * 0.45, 0, s * 0.12, 0, Math.PI * 2, true);
  artVol(c, col, -s * 0.45, 0, s * 0.32, 1.6);
  line(c, -s * 0.64, -s * 0.1, -s * 0.52, -s * 0.22, hi, Math.max(0.8, s * 0.06));
  line(c, -s * 0.1, -s * 0.03, s * 0.42, -s * 0.03, 'rgba(255,255,255,0.55)', Math.max(0.6, s * 0.04));
}
function drawKey(c, x, y, s, col = '#f0c94a') {
  const q = Math.max(4, Math.round(s * 2) / 2);
  const sp = artSprite('k' + col + q, q * 0.75 + 2, q * 0.75 + 2, g => artKeyBody(g, q, col));
  artBlit(c, sp, x, y, s / q);
}
function artBombBody(c, r, flash) {
  // колпачок и фитиль
  rrect(c, -r * 0.3, -r * 1.2, r * 0.6, r * 0.42, r * 0.08); artVol(c, '#6e6e78', 0, -r, r * 0.4, Math.max(1.1, r * 0.14));
  c.beginPath(); c.moveTo(0, -r * 1.15); c.quadraticCurveTo(r * 0.55, -r * 1.6, r * 0.3, -r * 1.9);
  c.strokeStyle = OUT; c.lineWidth = Math.max(2.2, r * 0.3); c.stroke();
  c.strokeStyle = '#c9a26b'; c.lineWidth = Math.max(1.2, r * 0.17); c.stroke();
  // шар
  artBall(c, 0, 0, r, flash ? '#d83030' : '#34343c', Math.max(1.4, r * 0.18), '#0a0a0a');
  ellipse(c, -r * 0.38, -r * 0.4, r * 0.3, r * 0.17, 'rgba(255,255,255,0.6)', null, 0, -0.7);
  if (!artFlat) circle(c, r * 0.42, r * 0.3, r * 0.08, 'rgba(255,255,255,0.35)');
}
// искры на конце фитиля — без состояния, по времени t
function artFuseSpark(c, x, y, t, r) {
  const sp = 2 + Math.sin(t * 0.8) * 1.5, L = gfxLevel();
  circle(c, x, y, sp + 1.6, 'rgba(255,190,60,0.65)');
  circle(c, x, y, sp * 0.6, '#fff8c0');
  if (!L) return;
  const n = L === 2 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const f = t * 0.09 + i / n, ph = f % 1, a = artHash(i, Math.floor(f)) * Math.PI * 2;
    const d = ph * (6 + r * 0.25);
    circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - ph * 3, 1.5 * (1 - ph) + 0.2, ph < 0.45 ? '#fff3a0' : '#ff9a30');
  }
}
function drawBomb(c, x, y, r, t = 0, flash = false) {
  const q = Math.max(3, Math.round(r * 2) / 2);
  const sp = artSprite('b' + (flash ? 1 : 0) + q, q * 1.25 + 3, q * 2.1 + 3, g => artBombBody(g, q, flash));
  artBlit(c, sp, x, y, r / q);
  if (t >= 0) artFuseSpark(c, x + r * 0.3, y - r * 1.9, t, r);
}
function artPillBody(c, s, cols, rot) {
  c.rotate(rot);
  const w = s, h = s * 0.48;
  c.save();
  rrect(c, -w / 2, -h / 2, w, h, h / 2);
  c.clip();
  c.fillStyle = cols[0]; c.fillRect(-w / 2, -h / 2, w / 2, h);
  c.fillStyle = cols[1]; c.fillRect(0, -h / 2, w / 2, h);
  if (artFlat) { c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-w / 2 + 2, -h / 2 + 1.5, w - 4, h * 0.22); }
  else {
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h);
    rrect(c, -w / 2 + h * 0.3, -h * 0.36, w * 0.5, h * 0.18, h * 0.09, 'rgba(255,255,255,0.75)');
  }
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-0.5, -h / 2, 1, h);
  c.restore();
  rrect(c, -w / 2, -h / 2, w, h, h / 2, null, OUT, 1.6);
}
function drawPill(c, x, y, s, cols, rot = -0.6) {
  cols = cols || ['#ffffff', '#ffffff'];
  const q = Math.max(4, Math.round(s * 2) / 2);
  const sp = artSprite('p' + cols[0] + cols[1] + rot + '|' + q, q * 0.58 + 2, q * 0.58 + 2, g => artPillBody(g, q, cols, rot));
  artBlit(c, sp, x, y, s / q);
}
function artCardBody(c, s, col) {
  c.rotate(0.15);
  rrect(c, -s * 0.36, -s * 0.5, s * 0.72, s, Math.max(1.5, s * 0.12)); artVol(c, '#f4ecd8', 0, 0, s * 0.5, 1.6);
  rrect(c, -s * 0.26, -s * 0.4, s * 0.52, s * 0.8, Math.max(1, s * 0.08)); artVol(c, col, 0, 0, s * 0.4, 0);
  poly(c, [0, -s * 0.3, s * 0.17, 0, 0, s * 0.3, -s * 0.17, 0], 'rgba(255,255,255,0.3)', 'rgba(60,30,10,0.45)', Math.max(0.6, s * 0.05));
  circle(c, 0, 0, s * 0.09, 'rgba(255,255,240,0.9)');
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) circle(c, dx * s * 0.18, dy * s * 0.31, s * 0.035, 'rgba(255,255,255,0.7)');
}
function drawCard(c, x, y, s, col = '#d8c27a') {
  const q = Math.max(4, Math.round(s * 2) / 2);
  const sp = artSprite('cd' + col + q, q * 0.5 + 3, q * 0.6 + 3, g => artCardBody(g, q, col));
  artBlit(c, sp, x, y, s / q);
}
function artChestBody(c, gold, open) {
  const body = gold ? '#e2b33c' : '#8a5a2e', dark = gold ? '#9a7316' : '#4e321a';
  const band = gold ? '#fff0a8' : '#aab2bc', bandD = gold ? '#b8902a' : '#5e6670';
  if (open) {
    // откинутая крышка — видна её внутренняя сторона
    poly(c, [-18, -8, 18, -8, 15, -25, -15, -25], mixColor(dark, '#000000', 0.15), OUT, 2);
    line(c, -16.5, -14, 16.5, -14, 'rgba(0,0,0,0.3)', 1); line(c, -15.8, -19.5, 15.8, -19.5, 'rgba(0,0,0,0.3)', 1);
    poly(c, [-14, -8, -10, -8, -9.4, -24.5, -12.4, -24.5], band, bandD, 1);
    poly(c, [14, -8, 10, -8, 9.4, -24.5, 12.4, -24.5], band, bandD, 1);
  }
  // корпус
  rrect(c, -17, -8, 34, 20, 3); artVol(c, body, 0, 2, 18, 2);
  if (!gold) { line(c, -16, -1.5, 16, -1.5, 'rgba(40,20,5,0.45)', 1); line(c, -16, 5, 16, 5, 'rgba(40,20,5,0.45)', 1); }
  else { line(c, -15, 6, 15, 6, 'rgba(120,80,10,0.5)', 1); }
  for (const bx of [-14, 10]) { rrect(c, bx, -8, 4, 20, 1, band, bandD, 1); }
  if (!open) {
    // крышка
    c.beginPath(); c.moveTo(-18, -7); c.lineTo(-18, -13); c.quadraticCurveTo(0, -24, 18, -13); c.lineTo(18, -7); c.closePath();
    artVol(c, body, 0, -12, 18, 2);
    for (const bx of [-12, 12]) line(c, bx, -8, bx, -17.2, band, 4);
    line(c, -17, -7, 17, -7, OUT, 1.8);
    // замок
    rrect(c, -4, -11, 8, 9, 2); artVol(c, gold ? '#fff0a8' : '#c8ced6', 0, -6.5, 5, 1.4);
    circle(c, 0, -7.6, 1.3, '#1a1010'); c.fillStyle = '#1a1010'; c.fillRect(-0.6, -7.4, 1.2, 3);
    if (!artFlat) artGlint(c, -9, -15, 4, 1.4, -0.25, 0.4);
  } else {
    // тёмное нутро с отблеском
    poly(c, [-16, -8, 16, -8, 15, -5, -15, -5], '#1a0f08');
    if (!artFlat) ellipse(c, 0, -6.8, 9, 1.4, 'rgba(255,220,120,0.25)');
  }
}
function drawChest(c, x, y, gold, open) {
  shadow(c, x, y + 10, 18, 6);
  const sp = artSprite('ch' + (gold ? 1 : 0) + (open ? 1 : 0), 21, 28, g => artChestBody(g, gold, open));
  artBlit(c, sp, x, y);
}

// ---------- Иконки статов ----------
function drawStatIcon(c, kind, x, y) {
  switch (kind) {
    case 'speed':
      poly(c, [x - 6, y + 5, x - 6, y - 4, x - 1, y - 4, x + 1, y, x + 7, y + 2, x + 7, y + 5], '#e9e2d0', OUT, 1.2); break;
    case 'tears':
      c.beginPath(); c.moveTo(x, y - 7); c.quadraticCurveTo(x + 6, y + 1, x, y + 6); c.quadraticCurveTo(x - 6, y + 1, x, y - 7);
      c.fillStyle = '#8cc8ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(); break;
    case 'damage':
      poly(c, [x - 6, y + 6, x + 4, y - 4, x + 6, y - 6, x + 5, y - 2, x - 4, y + 7], '#dcdcdc', OUT, 1.2);
      line(c, x - 7, y + 2, x - 2, y + 7, '#a33', 2); break;
    case 'range':
      line(c, x - 7, y, x + 7, y, '#e9e2d0', 2);
      poly(c, [x + 7, y, x + 3, y - 4, x + 3, y + 4], '#e9e2d0');
      poly(c, [x - 7, y, x - 3, y - 4, x - 3, y + 4], '#e9e2d0'); break;
    case 'shotspeed':
      circle(c, x + 3, y, 4, '#8cc8ff', OUT, 1.2);
      line(c, x - 7, y - 3, x - 2, y - 3, '#e9e2d0', 1.5); line(c, x - 8, y + 1, x - 2, y + 1, '#e9e2d0', 1.5); break;
    case 'luck':
      for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) circle(c, x + dx, y + dy, 3.4, '#5cc45c', OUT, 1);
      line(c, x, y, x + 3, y + 7, '#3a7a3a', 1.5); break;
  }
}

// ============================================================
//  Иконки предметов — рисуются в квадрате ±16 вокруг (0,0)
//  (строятся один раз в спрайт, см. drawItemIcon)
// ============================================================
function eyeShape(c, x, y, rx, ry, iris = '#3a6fb0') {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  artVol(c, '#f6f1ea', x, y, Math.max(rx, ry), 1.8);
  artBall(c, x, y, ry * 0.74, iris, 0);
  circle(c, x, y, ry * 0.36, '#111');
  circle(c, x - ry * 0.28, y - ry * 0.3, ry * 0.19, '#fff');
  circle(c, x + ry * 0.2, y + ry * 0.24, ry * 0.08, 'rgba(255,255,255,0.8)');
}
function bookShape(c, cover, mark) {
  // блок страниц
  rrect(c, -9, -12, 21, 27, 3, '#efe6d0', OUT, 2);
  for (let i = 0; i < 4; i++) line(c, 10, -8 + i * 6, 10, -5 + i * 6, 'rgba(120,100,70,0.5)', 0.8);
  // обложка
  rrect(c, -12, -15, 21, 28, 3); artVol(c, cover, -1.5, -1, 15, 2.2);
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(-11, -14, 3, 26);
  line(c, -6, -12.5, 7, -12.5, 'rgba(255,255,255,0.25)', 1);
  if (mark) mark();
}
function dropShape(c, x, y, s, col, lw = 1.8) {
  c.beginPath(); c.moveTo(x, y - s);
  c.bezierCurveTo(x + s * 0.9, y - s * 0.1, x + s * 0.8, y + s * 0.8, x, y + s * 0.8);
  c.bezierCurveTo(x - s * 0.8, y + s * 0.8, x - s * 0.9, y - s * 0.1, x, y - s);
  artVol(c, col, x, y + s * 0.2, s, lw);
}
function babyHead(c, skin, extra) {
  artBall(c, 0, 2, 12.5, skin, 2.2);
  ellipse(c, -4.6, 2.5, 2.7, 3.5, '#141010'); ellipse(c, 4.6, 2.5, 2.7, 3.5, '#141010');
  circle(c, -5.4, 1.2, 1, '#fff'); circle(c, 3.8, 1.2, 1, '#fff');
  circle(c, -3.9, 3.9, 0.45, '#fff'); circle(c, 5.3, 3.9, 0.45, '#fff');
  if (!artFlat) { ellipse(c, -8.5, 7, 2.2, 1.2, 'rgba(240,110,110,0.3)'); ellipse(c, 8.5, 7, 2.2, 1.2, 'rgba(240,110,110,0.3)'); }
  c.beginPath(); c.arc(0, 11, 3, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
  if (extra) extra();
}
// искорки свечения вокруг иконки
function artSparkIcon(c, pts, col = '#fff6c0') { for (const [x, y, s] of pts) artStar4(c, x, y, s, col); }

const ICONS = {
  onion(c) {
    for (const k of [-1, 1]) {
      c.beginPath(); c.moveTo(k * 0.5, -8); c.quadraticCurveTo(k * 3, -13, k * 8, -16); c.quadraticCurveTo(k * 6.5, -10, k * 3.5, -7); c.closePath();
      artVol(c, '#66ba46', k * 4, -11, 6, 1.6);
    }
    c.beginPath(); c.moveTo(0, -10);
    c.bezierCurveTo(8, -7.5, 14, 0, 13, 6.5); c.bezierCurveTo(12, 14, -12, 14, -13, 6.5); c.bezierCurveTo(-14, 0, -8, -7.5, 0, -10); c.closePath();
    artVol(c, '#c99be0', 0, 3, 13);
    c.strokeStyle = 'rgba(110,50,140,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-2.5, -8); c.quadraticCurveTo(-9, 1, -7.5, 11.5); c.moveTo(2.5, -8); c.quadraticCurveTo(9, 1, 7.5, 11.5); c.stroke();
    ellipse(c, -4.5, 3, 2, 2.7, '#2a1420'); ellipse(c, 4.5, 3, 2, 2.7, '#2a1420');
    circle(c, -5.1, 2, 0.8, '#fff'); circle(c, 3.9, 2, 0.8, '#fff');
    line(c, -7.5, 0.2, -3, -1.2, '#2a1420', 1.2); line(c, 7.5, 0.2, 3, -1.2, '#2a1420', 1.2);
    c.beginPath(); c.arc(0, 10.5, 2.6, Math.PI * 1.2, Math.PI * 1.8); c.strokeStyle = '#2a1420'; c.lineWidth = 1.4; c.stroke();
    dropShape(c, -6.6, 8.6, 2.6, '#8cc8ff', 1.1); dropShape(c, 6.6, 8.6, 2.6, '#8cc8ff', 1.1);
  },
  syringe(c) {
    c.rotate(-0.75);
    line(c, 0, 9, 0, 17, OUT, 2.6); line(c, 0, 9, 0, 16.5, '#dfe8ee', 1.2);
    rrect(c, -1.6, -15, 3.2, 8, 1, '#8a909a', OUT, 1.3);
    rrect(c, -5.5, -17, 11, 3, 1.5); artVol(c, '#a8b0bc', 0, -15.5, 5, 1.6);
    rrect(c, -5, -9, 10, 19, 2.5); artVol(c, '#e6f0f4', 0, 0, 10, 2);
    rrect(c, -3.6, -1.5, 7.2, 10, 1.5); artVol(c, '#9b4fd8', 0, 3.5, 6, 0);
    for (let i = 0; i < 4; i++) line(c, 1.6, -7 + i * 3.6, 4, -7 + i * 3.6, '#5a6670', 0.9);
    rrect(c, -2.6, 9, 5.2, 2.6, 1, '#cfd8dc', OUT, 1.2);
    line(c, -3.1, -7, -3.1, 7, 'rgba(255,255,255,0.85)', 1.1);
  },
  blood(c) {
    dropShape(c, 0, 0, 14, '#c81c1c', 2.2);
    ellipse(c, -4.6, -0.5, 2.1, 4.3, 'rgba(255,175,170,0.8)', null, 0, 0.35);
    circle(c, -2.6, 6.2, 1.2, 'rgba(255,255,255,0.75)');
  },
  pentagram(c) {
    artBall(c, 0, 0, 14.5, '#3a1414', 2.2);
    circle(c, 0, 0, 12, null, '#7a1616', 1.4);
    artStarPath(c, 0, 0.5, 11, 4.3);
    if (!artFlat) { c.strokeStyle = 'rgba(255,60,40,0.35)'; c.lineWidth = 4.5; c.stroke(); }
    c.strokeStyle = '#ff3a32'; c.lineWidth = 1.8; c.stroke();
    if (!artFlat) artSparkIcon(c, [[-9, -10, 2.2], [10, 8, 1.6]], '#ffb0a0');
  },
  mushroom(c) {
    c.beginPath(); c.moveTo(-5, 2); c.quadraticCurveTo(-6.8, 9, -5.4, 14); c.lineTo(5.4, 14); c.quadraticCurveTo(6.8, 9, 5, 2); c.closePath();
    artVol(c, '#f2e6c8', 0, 8, 8, 2);
    circle(c, -2.1, 7.5, 1.05, OUT); circle(c, 2.1, 7.5, 1.05, OUT);
    c.beginPath(); c.moveTo(-16, 4); c.bezierCurveTo(-16, -14.5, 16, -14.5, 16, 4); c.quadraticCurveTo(0, 0, -16, 4); c.closePath();
    artVol(c, '#e0302c', 0, -4, 15, 2.2);
    ellipse(c, -8.5, -1.5, 2.8, 2.1, '#fff8ee'); circle(c, 0, -7.5, 3.2, '#fff8ee'); ellipse(c, 8.5, -2, 2.6, 2, '#fff8ee');
    circle(c, -4.5, -9.5, 1.4, '#fff8ee'); circle(c, 11.5, -6.5, 1.2, '#fff8ee');
    if (!artFlat) artGlint(c, -7, -8.5, 3.4, 1.4, -0.55, 0.5);
  },
  innerEye(c) {
    c.beginPath(); c.ellipse(0, 0, 15, 9.5, 0, 0, Math.PI * 2); artVol(c, '#f6f1ea', 0, 0, 15, 2.2);
    line(c, -14, 1.5, -10.5, 0.5, '#e08080', 0.8); line(c, 14, -1.5, 10.8, -0.5, '#e08080', 0.8);
    for (const x of [-6.2, 0, 6.2]) { artBall(c, x, 0.5, 3.6, '#4a7ac0', 1); circle(c, x, 0.5, 1.7, '#111'); circle(c, x - 1, -0.6, 0.75, '#fff'); }
    c.beginPath(); c.ellipse(0, 0, 15, 9.5, 0, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
  },
  twenty(c) {
    c.beginPath(); c.moveTo(-2.5, -1); c.quadraticCurveTo(0, -4, 2.5, -1); c.strokeStyle = '#2a2a2a'; c.lineWidth = 2.4; c.stroke();
    line(c, -14.5, -2, -16, -7, '#2a2a2a', 2.2); line(c, 14.5, -2, 16, -7, '#2a2a2a', 2.2);
    for (const x of [-8.3, 8.3]) {
      c.beginPath(); c.arc(x, 0, 6.6, 0, Math.PI * 2);
      if (artFlat) c.fillStyle = 'rgba(160,210,255,0.45)';
      else { const g = c.createLinearGradient(x - 6, -6, x + 6, 6); g.addColorStop(0, 'rgba(220,240,255,0.85)'); g.addColorStop(1, 'rgba(110,170,230,0.55)'); c.fillStyle = g; }
      c.fill(); c.strokeStyle = '#2a2a2a'; c.lineWidth = 2.6; c.stroke();
      line(c, x - 3.2, -2.5, x - 1, -4.2, 'rgba(255,255,255,0.95)', 1.4);
    }
  },
  homing(c) {
    if (!artFlat) circle(c, 0, 0, 15.5, 'rgba(200,120,255,0.25)');
    artBall(c, 0, 0, 14, '#4a2a6a', 2.2);
    circle(c, 0, 0, 11, null, '#d4a43e', 2);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 9.6, Math.sin(a) * 9.6, '#d8b8f0', 1); }
    c.save(); c.rotate(0.6);
    poly(c, [0, -9, 2.8, 0, -2.8, 0], '#ff7ae8', OUT, 1.1);
    poly(c, [0, 9, 2.8, 0, -2.8, 0], '#9a86b0', OUT, 1.1);
    c.restore();
    circle(c, 0, 0, 1.8, '#ffd84a', OUT, 1);
    artGlint(c, -6, -7, 3, 1.6, -0.7, 0.5);
  },
  cupid(c) {
    c.save(); c.rotate(-0.78);
    line(c, -16, 0, -5, 0, OUT, 4); line(c, -16, 0, -5, 0, '#a8743a', 2.2);
    poly(c, [-16, 0, -12, -5, -8, -5, -11, 0, -8, 5, -12, 5], '#f07aa0', OUT, 1.2);
    c.restore();
    heartPath(c, 2, 4, 25); artVol(c, '#f04a6a', 2, 3, 11, 2);
    artGlint(c, -2, -1, 2.4, 1.4, -0.6, 0.7);
    c.save(); c.rotate(-0.78);
    line(c, 6, 0, 12, 0, OUT, 4); line(c, 6, 0, 12, 0, '#a8743a', 2.2);
    poly(c, [16.5, 0, 10, -4.5, 11.5, 0, 10, 4.5], '#e6edf0', OUT, 1.3);
    c.restore();
  },
  spectral(c) {
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(-9 + i * 9, 6); c.quadraticCurveTo(-12 + i * 9, 11, -8 + i * 9, 15);
      c.strokeStyle = 'rgba(190,225,255,0.75)'; c.lineWidth = 2.2; c.stroke();
    }
    if (!artFlat) circle(c, 0, -2, 15, 'rgba(160,215,255,0.22)');
    c.globalAlpha = 0.9;
    eyeShape(c, 0, -2, 14, 9, '#7fc8ff');
    c.globalAlpha = 1;
    c.beginPath(); c.ellipse(0, -2, 14, 9, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(200,235,255,0.9)'; c.lineWidth = 1; c.stroke();
  },
  rubber(c) {
    artBall(c, 0, 0, 13.5, '#e2443a', 0);
    c.save(); c.beginPath(); c.arc(0, 0, 13.5, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.ellipse(0, 0, 18, 5.2, -0.55, 0, Math.PI * 2); c.fillStyle = '#f4d23a'; c.fill();
    if (!artFlat) {
      const g = c.createRadialGradient(-5, -6, 1, 0, 0, 14);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      c.fillStyle = g; c.fillRect(-15, -15, 30, 30);
    }
    c.restore();
    artStarPath(c, 6, 6, 3.4); c.fillStyle = '#3a6fd0'; c.fill();
    artGlint(c, -5, -6.5, 4, 2.3, -0.6, 0.7);
    circle(c, 0, 0, 13.5, null, OUT, 2.2);
  },
  poison(c) {
    dropShape(c, 0, 1, 13, '#5ccf4a', 2.2);
    circle(c, -3.2, 3, 2.3, '#1f5a18'); circle(c, 3.2, 3, 2.3, '#1f5a18');
    line(c, -3, 8, 3, 8, '#1f5a18', 1.6); line(c, -1, 7, -1, 9, '#1f5a18', 1); line(c, 1, 7, 1, 9, '#1f5a18', 1);
    ellipse(c, -4.5, -2, 1.6, 3, 'rgba(230,255,220,0.7)', null, 0, 0.35);
    artBall(c, 10, -10, 2.6, '#8ce07a', 1); artBall(c, -11, -7, 2, '#8ce07a', 1); artBall(c, 12, -2, 1.4, '#8ce07a', 0.8);
  },
  slime(c) {
    c.beginPath(); c.moveTo(-14, 8);
    c.quadraticCurveTo(-15, -12, 0, -12); c.quadraticCurveTo(15, -12, 14, 8);
    c.lineTo(10.5, 8); c.quadraticCurveTo(9, 15, 6.5, 8); c.lineTo(-3, 8); c.quadraticCurveTo(-5.5, 16, -8, 8); c.closePath();
    artVol(c, '#a8c49c', 0, -2, 14, 2.2);
    circle(c, -4.5, -1, 1.8, '#2e3a2a'); circle(c, 4.5, -1, 1.8, '#2e3a2a');
    c.beginPath(); c.arc(0, 4, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); c.strokeStyle = '#2e3a2a'; c.lineWidth = 1.3; c.stroke();
    artGlint(c, -6, -6.5, 3.6, 1.8, -0.5, 0.65); circle(c, 8, -6, 1, 'rgba(255,255,255,0.7)');
  },
  wings(c) {
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.beginPath(); c.moveTo(1.5, 7); c.quadraticCurveTo(4, -13, 16, -13);
      c.quadraticCurveTo(15.5, -8, 12.5, -6.5); c.quadraticCurveTo(13.5, -3, 9.5, -1.5); c.quadraticCurveTo(10, 2, 6, 3); c.quadraticCurveTo(5, 6, 1.5, 7); c.closePath();
      artVol(c, '#f6f6fa', 8, -3, 11, 1.8);
      c.strokeStyle = '#b8bccc'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(4, 2); c.lineTo(12.5, -6.5); c.moveTo(3.5, -2); c.lineTo(9.5, -9.5); c.stroke();
      c.restore();
    }
    if (!artFlat) artSparkIcon(c, [[0, -12, 2.4], [-13, 9, 1.6]]);
  },
  brimstone(c) {
    if (!artFlat) ellipse(c, 0, 9, 11, 4.5, 'rgba(255,60,30,0.35)');
    ellipse(c, 0, 10, 7, 3.2, '#ff5a2a', OUT, 1.4);
    ellipse(c, 0, 9.6, 3.5, 1.4, '#ffd0a0');
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 3, 10); c.quadraticCurveTo(s * 17, 3, s * 12, -15); c.quadraticCurveTo(s * 9, -1, s * 0.5, 4); c.closePath();
      artVol(c, '#b81818', s * 9, -2, 12, 2);
      c.strokeStyle = 'rgba(40,0,0,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(s * 5, 4); c.lineTo(s * 9, 6.5); c.moveTo(s * 8, -2); c.lineTo(s * 12.5, 0); c.moveTo(s * 9.5, -8); c.lineTo(s * 13.5, -7); c.stroke();
    }
  },
  tech(c) {
    artBall(c, 0, 0, 13.5, '#8a929c', 2.2);
    circle(c, 0, 0, 9.5, null, '#5a626c', 1.4);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; circle(c, Math.cos(a) * 11, Math.sin(a) * 11, 1.4, '#3a3f46'); }
    circle(c, 0, 0, 7, '#1e1e24', OUT, 1.2);
    if (!artFlat) circle(c, 0, 0, 6, 'rgba(255,40,40,0.35)');
    artBall(c, 0, 0, 4, '#ff3030', 0);
    circle(c, -1.4, -1.4, 1.2, '#ffd0d0');
  },
  polyphemus(c) {
    artBall(c, 0, 0, 14.5, '#f3d9c9', 2.2);
    c.beginPath(); c.ellipse(0, -0.5, 11, 8.5, 0, 0, Math.PI * 2); c.fillStyle = '#f8f4ee'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    artBall(c, 0, -0.5, 6.4, '#a8442a', 0);
    circle(c, 0, -0.5, 3.2, '#111');
    circle(c, -2.2, -2.8, 1.5, '#fff'); circle(c, 1.6, 1.3, 0.6, 'rgba(255,255,255,0.8)');
    line(c, -10, -1, -7, -0.5, '#e07070', 0.8); line(c, 10, 0.5, 7.4, 0, '#e07070', 0.8);
  },
  wiz(c) {
    c.beginPath(); c.moveTo(-13, 11); c.quadraticCurveTo(-4, 2, 1, -10); c.quadraticCurveTo(5, -16, 12, -14); c.quadraticCurveTo(6, -10, 7, -2); c.lineTo(13, 11); c.closePath();
    artVol(c, '#3a52c4', 0, 0, 14, 2.2);
    c.beginPath(); c.ellipse(0, 11.5, 15.5, 3.6, 0, 0, Math.PI * 2); artVol(c, '#2a3a96', 0, 11.5, 15, 1.8);
    artStar4(c, -3, 4, 2.6, '#ffe866'); artStar4(c, 4, -5, 2, '#ffe866'); circle(c, 6, 6, 1.2, '#ffe866'); circle(c, -6, 9, 0.9, '#ffe866');
    c.beginPath(); c.arc(1, -1, 2.6, 0.5, 4.2); c.arc(2.2, -1.8, 2, 4.2, 0.5, true); c.fillStyle = '#ffe866'; c.fill();
  },
  ipecac(c) {
    c.beginPath(); c.moveTo(-4, -8); c.lineTo(-4, -5); c.quadraticCurveTo(-10, -3, -10, 4); c.lineTo(-10, 12); c.quadraticCurveTo(-10, 15, -7, 15); c.lineTo(7, 15); c.quadraticCurveTo(10, 15, 10, 12); c.lineTo(10, 4); c.quadraticCurveTo(10, -3, 4, -5); c.lineTo(4, -8); c.closePath();
    artVol(c, '#7a4a22', 0, 3, 12, 2.2);
    rrect(c, -8, 3, 16, 10, 2); artVol(c, '#9ccf3a', 0, 8, 8, 0);
    rrect(c, -7, -1, 14, 5, 1, '#f4ecd8', 'rgba(60,40,20,0.5)', 1);
    line(c, -4, 1.5, 4, 1.5, '#a04040', 1);
    rrect(c, -5, -15, 10, 8, 2); artVol(c, '#c49a5a', 0, -11, 5, 1.6);
    line(c, -7, -3, -7, 11, 'rgba(255,255,255,0.35)', 1.4);
  },
  sneakers(c) {
    c.beginPath(); c.moveTo(-14, 9); c.lineTo(-14, -2); c.quadraticCurveTo(-11, -5, -6, -4); c.lineTo(-3, -10); c.lineTo(4, -9); c.quadraticCurveTo(6, -2, 9, 1); c.quadraticCurveTo(15, 2, 15, 7); c.lineTo(15, 9); c.closePath();
    artVol(c, '#eeeef4', 0, 0, 15, 2.2);
    rrect(c, -15, 6, 31, 4.5, 2); artVol(c, '#d42c2c', 0, 8, 15, 1.6);
    poly(c, [-10, 0, -2, -1, 5, 3, -6, 4], '#3a6fd0', OUT, 1);
    for (let i = 0; i < 3; i++) line(c, -2 + i * 2.2, -7 + i * 2, 2 + i * 2.2, -7.5 + i * 2, '#9aa0b0', 1.1);
  },
  spyglass(c) {
    c.rotate(-0.5);
    rrect(c, -15.5, -4, 12, 8, 2); artVol(c, '#b88a3a', -9.5, 0, 6, 1.6);
    rrect(c, -4, -5, 10, 10, 2); artVol(c, '#d4a84a', 1, 0, 6, 1.6);
    rrect(c, 6, -6.5, 9, 13, 2); artVol(c, '#e6c264', 10.5, 0, 7, 1.6);
    line(c, -3.5, -5, -3.5, 5, '#8a6420', 1.6); line(c, 6, -6, 6, 6, '#a07a28', 1.6);
    ellipse(c, 15, 0, 1.8, 5.5, '#9fd8ff', OUT, 1);
    line(c, 15, -3.5, 15, -1, '#fff', 1);
  },
  slingshot(c) {
    for (const [x1, y1, x2, y2] of [[0, 15, 0, 0], [0, 1, -8.5, -12], [0, 1, 8.5, -12]]) { line(c, x1, y1, x2, y2, OUT, 6.5); line(c, x1, y1, x2, y2, '#9a6a36', 4); }
    line(c, -1, 13, -1, 2, 'rgba(255,230,190,0.5)', 1.2);
    c.beginPath(); c.moveTo(-8.5, -12); c.quadraticCurveTo(-2, 0, 0, 1); c.quadraticCurveTo(2, 0, 8.5, -12); c.strokeStyle = '#c43a3a'; c.lineWidth = 1.6; c.stroke();
    rrect(c, -2.5, -1, 5, 3.5, 1.2, '#7a4a2a', OUT, 1);
    circle(c, -8.5, -12, 1.8, '#5a3a1a'); circle(c, 8.5, -12, 1.8, '#5a3a1a');
  },
  horseshoe(c) {
    c.beginPath(); c.arc(0, -1, 11, Math.PI * 0.85, Math.PI * 2.15, false);
    c.strokeStyle = OUT; c.lineWidth = 9; c.stroke();
    c.strokeStyle = artFlat ? '#b8bec8' : '#9aa2ae'; c.lineWidth = 6; c.stroke();
    if (!artFlat) { c.beginPath(); c.arc(0, -1, 12.2, Math.PI * 1.05, Math.PI * 1.75); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.5; c.stroke(); }
    for (const a of [3.3, 4.1, 5.3, 6.1]) circle(c, Math.cos(a) * 11, -1 + Math.sin(a) * 11, 1.1, '#2a2a30');
    if (!artFlat) artSparkIcon(c, [[11, -12, 2.4], [-13, 10, 1.6]], '#fff8c8');
  },
  heartUp(c) {
    c.beginPath(); c.moveTo(-4, -8); c.quadraticCurveTo(-5, -14, -2, -16); c.lineTo(1, -16); c.quadraticCurveTo(-1, -12, 1, -8); c.closePath(); artVol(c, '#a83040', -1, -12, 4, 1.4);
    c.beginPath(); c.moveTo(3, -8); c.quadraticCurveTo(5, -13, 9, -15); c.lineTo(10.5, -12.5); c.quadraticCurveTo(7, -11, 6.5, -7); c.closePath(); artVol(c, '#5a74c8', 7, -11, 4, 1.4);
    heartPath(c, 0, 2, 31); artVol(c, '#c42c3a', 0, 1, 14, 2.2);
    c.strokeStyle = 'rgba(90,10,20,0.55)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(2, -3); c.quadraticCurveTo(0, 4, 3, 11); c.moveTo(-7, -2); c.quadraticCurveTo(-4, 2, -6, 6); c.stroke();
    artGlint(c, -7, -2.5, 3, 1.8, -0.6, 0.6);
  },
  meat(c) {
    c.beginPath(); c.ellipse(0, 4, 15.5, 9, 0, 0, Math.PI * 2); artVol(c, '#f4f4f6', 0, 4, 15, 2.2);
    ellipse(c, 0, 4.5, 10.5, 5.5, '#dcdce4');
    c.beginPath(); c.moveTo(-10, 2); c.quadraticCurveTo(-10, -5, -3, -4); c.quadraticCurveTo(1, -3, 1, 2); c.quadraticCurveTo(-4, 7, -10, 2); c.closePath(); artVol(c, '#fbfbf6', -4, 0, 7, 1.4);
    artBall(c, -4.5, 0, 2.8, '#ffc020', 1);
    for (const dy of [-1, 4]) {
      c.beginPath(); c.moveTo(1, dy); c.quadraticCurveTo(5, dy - 3, 8, dy); c.quadraticCurveTo(11, dy + 3, 13, dy); c.strokeStyle = OUT; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = '#b8483a'; c.lineWidth = 2.6; c.stroke();
    }
  },
  rosary(c) {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; artBall(c, Math.cos(a) * 10, -3.5 + Math.sin(a) * 9, 2.4, '#8a62e0', 1); }
    line(c, 0, 5.5, 0, 9, '#c8b060', 1.2);
    for (const [x1, y1, x2, y2] of [[0, 8, 0, 16], [-4, 11, 4, 11]]) { line(c, x1, y1, x2, y2, OUT, 4.4); line(c, x1, y1, x2, y2, '#e6c264', 2.6); }
  },
  halo(c) {
    if (!artFlat) { c.beginPath(); c.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,230,100,0.35)'; c.lineWidth = 9; c.stroke(); }
    ellipse(c, 0, 0, 14, 6, null, '#8a6a10', 6.5);
    ellipse(c, 0, 0, 14, 6, null, '#ffe060', 3.8);
    c.beginPath(); c.ellipse(0, 0, 14, 6, 0, Math.PI * 1.1, Math.PI * 1.6); c.strokeStyle = '#fff8d0'; c.lineWidth = 1.4; c.stroke();
    if (!artFlat) artSparkIcon(c, [[-12, -9, 2.4], [11, 9, 2], [3, -11, 1.4]]);
  },
  mantle(c) {
    c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(8, -12, 12, -6); c.quadraticCurveTo(15, 4, 15, 14); c.lineTo(-15, 14); c.quadraticCurveTo(-15, 4, -12, -6); c.quadraticCurveTo(-8, -12, 0, -14); c.closePath();
    artVol(c, '#f2f2f8', 0, 0, 15, 2.2);
    c.strokeStyle = 'rgba(140,140,170,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-7, -4); c.quadraticCurveTo(-9, 5, -8, 13); c.moveTo(7, -4); c.quadraticCurveTo(9, 5, 8, 13); c.stroke();
    c.beginPath(); c.ellipse(0, -9, 5, 3, 0, 0, Math.PI * 2); c.fillStyle = '#d8d8e4'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    for (const [x1, y1, x2, y2] of [[0, -4, 0, 10], [-5, 0, 5, 0]]) { line(c, x1, y1, x2, y2, '#a07a20', 4); line(c, x1, y1, x2, y2, '#ffd84a', 2.4); }
  },
  cross(c) {
    rrect(c, -3.8, -15, 7.6, 30, 2); artVol(c, '#9a6a3a', 0, 0, 15, 2);
    rrect(c, -11, -8, 22, 7.6, 2); artVol(c, '#9a6a3a', 0, -4, 11, 2);
    c.strokeStyle = 'rgba(60,30,10,0.45)'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-1, -12); c.lineTo(-1, -9); c.moveTo(1, 2); c.lineTo(1, 11); c.moveTo(-8, -4.5); c.lineTo(-5, -4.5); c.stroke();
    circle(c, 0, -4.2, 1.2, '#5a3a1a');
  },
  goat(c) {
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 4, -6); c.bezierCurveTo(s * 12, -16, s * 20, -6, s * 13, 2); c.quadraticCurveTo(s * 11, 4, s * 10, 1); c.bezierCurveTo(s * 15, -5, s * 10, -10, s * 5, -2); c.closePath();
      artVol(c, '#d8c8a8', s * 11, -5, 8, 1.6);
      c.strokeStyle = 'rgba(90,70,40,0.5)'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(s * 9, -10); c.lineTo(s * 11, -8); c.moveTo(s * 13, -9); c.lineTo(s * 13.5, -6); c.stroke();
    }
    c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(9, -8, 8, 2); c.quadraticCurveTo(6, 12, 0, 14); c.quadraticCurveTo(-6, 12, -8, 2); c.quadraticCurveTo(-9, -8, 0, -9); c.closePath();
    artVol(c, '#3a3030', 0, 2, 11, 2);
    poly(c, [-3, 11, 3, 11, 0, 16], '#2a2222', OUT, 1.2);
    if (!artFlat) { circle(c, -3.3, -0.5, 3.2, 'rgba(255,40,40,0.3)'); circle(c, 3.3, -0.5, 3.2, 'rgba(255,40,40,0.3)'); }
    ellipse(c, -3.3, -0.5, 2, 1.4, '#ff3030'); ellipse(c, 3.3, -0.5, 2, 1.4, '#ff3030');
    line(c, -3.3, -1.5, -3.3, 0.5, '#200', 0.8); line(c, 3.3, -1.5, 3.3, 0.5, '#200', 0.8);
    ellipse(c, 0, 8, 2.4, 1.4, '#1a1414');
  },
  pact(c) {
    c.beginPath(); c.moveTo(-11, -13); c.lineTo(10, -13); c.quadraticCurveTo(12, -13, 12, -11); c.lineTo(11, 12); c.quadraticCurveTo(6, 15, 0, 13); c.quadraticCurveTo(-6, 11, -11, 13); c.closePath();
    artVol(c, '#efe2c0', 0, 0, 13, 2);
    for (let i = 0; i < 4; i++) line(c, -7, -8 + i * 4, 7 - (i === 3 ? 6 : 0), -8 + i * 4, '#8a7a5a', 1);
    c.beginPath(); c.moveTo(-7, 8); c.quadraticCurveTo(-4, 5, -2, 8); c.quadraticCurveTo(0, 10, 2, 7); c.strokeStyle = '#7a1a1a'; c.lineWidth = 1.1; c.stroke();
    artBall(c, 5.5, 7.5, 4.6, '#b01818', 1.3);
    artStarPath(c, 5.5, 7.8, 2.6, 1.1); c.fillStyle = '#ff6a5a'; c.fill();
    dropShape(c, 5.5, 14.5, 1.8, '#b01818', 0.9);
  },
  bro(c) { babyHead(c, '#f3d9c9'); },
  sis(c) {
    babyHead(c, '#f3d9c9', () => {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(s * 6, -17, s * 10, -13); c.quadraticCurveTo(s * 10, -7, 0, -10); c.closePath(); artVol(c, '#f07aa0', s * 5, -12, 6, 1.3); }
      artBall(c, 0, -10, 2.6, '#d84a7a', 1.1);
    });
  },
  orbital(c) {
    ellipse(c, 0, 1, 15, 5, null, '#8a6a10', 3);
    ellipse(c, 0, 1, 15, 5, null, '#ffe060', 1.6);
    for (const s of [-1, 1]) ellipse(c, s * 5.5, -5.5, 5.4, 3, 'rgba(235,238,248,0.85)', OUT, 1.1, s * 0.45);
    artBall(c, 0, 0, 6.2, '#2a2a30', 1.6);
    circle(c, -2.2, -0.8, 1.6, '#fff'); circle(c, 2.2, -0.8, 1.6, '#fff');
    circle(c, -2, -0.5, 0.8, '#111'); circle(c, 2.4, -0.5, 0.8, '#111');
    c.beginPath(); c.ellipse(0, 1, 15, 5, 0, 0, Math.PI); c.strokeStyle = '#ffe060'; c.lineWidth = 1.6; c.stroke();
  },
  demon(c) {
    babyHead(c, '#4a4048', () => {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 9, -6); c.quadraticCurveTo(s * 13, -11, s * 11, -17); c.quadraticCurveTo(s * 8, -11, s * 3, -9.5); c.closePath(); artVol(c, '#1e1418', s * 9, -11, 5, 1.2); }
      ellipse(c, -4.6, 2.5, 2.7, 3.5, '#d81818'); ellipse(c, 4.6, 2.5, 2.7, 3.5, '#d81818');
      circle(c, -5.4, 1.2, 1, '#ffc0b0'); circle(c, 3.8, 1.2, 1, '#ffc0b0');
    });
  },
  bombBag(c) {
    c.beginPath(); c.moveTo(-12, 14); c.quadraticCurveTo(-17, -3, -6, -8); c.lineTo(6, -8); c.quadraticCurveTo(17, -3, 12, 14); c.closePath();
    artVol(c, '#9a7040', 0, 3, 14, 2.2);
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-8, -14, -3, -13); c.lineTo(3, -13); c.quadraticCurveTo(8, -14, 6, -8); c.closePath(); artVol(c, '#8a6034', 0, -11, 6, 1.8);
    line(c, -7, -8, 7, -8, '#5a3a1a', 3);
    c.save(); c.translate(1.5, 5); artBombBody(c, 5.5, false); c.restore();
    c.strokeStyle = 'rgba(60,40,15,0.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-9, 0); c.quadraticCurveTo(-10, 6, -8, 12); c.stroke();
  },
  bigBombs(c) {
    c.save(); c.translate(-1, 4); artBombBody(c, 10.5, false); c.restore();
    for (const [x1, y1, x2, y2] of [[11, -14, 11, -5], [6.5, -9.5, 15.5, -9.5]]) { line(c, x1, y1, x2, y2, OUT, 5); line(c, x1, y1, x2, y2, '#ff4040', 2.8); }
  },
  piggy(c) {
    for (const x of [-8, -2.5, 3.5, 8.5]) rrect(c, x - 1.6, 8, 3.2, 6, 1, '#e88ab4', OUT, 1.2);
    c.beginPath(); c.ellipse(0, 2, 14, 10, 0, 0, Math.PI * 2); artVol(c, '#f5a3c7', 0, 2, 14, 2.2);
    poly(c, [-6, -6, -3, -13, 0, -7], '#f5a3c7', OUT, 1.4);
    c.beginPath(); c.ellipse(12.5, 2.5, 4, 3.6, 0, 0, Math.PI * 2); artVol(c, '#f07aa0', 12.5, 2.5, 4, 1.4);
    circle(c, 11.5, 2.5, 0.8, '#7a3a50'); circle(c, 13.5, 2.5, 0.8, '#7a3a50');
    circle(c, 5, -1.5, 1.5, '#222'); circle(c, 4.6, -2, 0.5, '#fff');
    rrect(c, -5, -9, 7, 2.4, 1, '#7a3a50');
    c.beginPath(); c.moveTo(-14, 1); c.quadraticCurveTo(-18, -1, -16, -4); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
    c.save(); c.translate(-1.5, -13); artCoinBody(c, 3.6, 1); c.restore();
  },
  keyRing(c) {
    circle(c, -1, -7, 7, null, OUT, 4); circle(c, -1, -7, 7, null, '#c8ced8', 2.2);
    c.save(); c.translate(-4, 4); artKeyBody(c, 14, '#f0c94a'); c.restore();
    c.save(); c.translate(5, 5); c.rotate(0.9); artKeyBody(c, 13, '#d8dde6'); c.restore();
  },
  lump(c) {
    if (!artFlat) circle(c, 2, 2, 14, 'rgba(255,110,40,0.2)');
    poly(c, [-12, 4, -8, -9, 3, -12.5, 12, -4, 10, 9, -3, 12.5]); artVol(c, '#26262c', 0, 0, 13, 2.2, '#000');
    poly(c, [-8, -9, 3, -12.5, 0, -4, -6, -3], '#3a3a44');
    c.strokeStyle = '#ff7a30'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-4, 3); c.lineTo(1, 1); c.lineTo(5, 5); c.moveTo(1, 1); c.lineTo(3, -4); c.stroke();
    circle(c, 5.5, 5.5, 1.4, '#ffb050'); circle(c, -6, 6, 0.9, '#ff7a30');
  },
  compass(c) {
    c.beginPath(); c.moveTo(-14, -11); c.lineTo(14, -11); c.lineTo(13, 0); c.lineTo(14, 11); c.lineTo(-14, 11); c.lineTo(-13, 0); c.closePath();
    artVol(c, '#e6d4a4', 0, 0, 15, 2);
    c.strokeStyle = 'rgba(120,90,50,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -11); c.lineTo(-5, 11); c.moveTo(5, -11); c.lineTo(5, 11); c.stroke();
    c.beginPath(); c.moveTo(-10, 6); c.lineTo(-4, -2); c.lineTo(2, 3); c.lineTo(8, -5); c.setLineDash([2, 2]); c.strokeStyle = '#8a5a2e'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    line(c, 6, -9, 12, -3, '#c42424', 2.4); line(c, 12, -9, 6, -3, '#c42424', 2.4);
    circle(c, -10, 6, 1.6, '#3a6fd0', OUT, 0.8);
  },
  soy(c) {
    poly(c, [-9, -6, 0, -14, 9, -6, 9, 14, -9, 14]); artVol(c, '#f6f6f2', 0, 2, 13, 2.2);
    poly(c, [0, -14, 9, -6, 0, -6], '#e0e0da', OUT, 1.4);
    rrect(c, -9, -1, 18, 8, 0); artVol(c, '#5ab07a', 0, 3, 9, 0);
    ellipse(c, 0, 3, 3.6, 2.4, '#f6f6f2');
    line(c, -9, -6, 9, -6, OUT, 1.5);
    line(c, -7, -4, -7, 12, 'rgba(255,255,255,0.8)', 1.2);
  },
  fireMind(c) {
    if (!artFlat) circle(c, 0, 2, 15, 'rgba(255,140,40,0.25)');
    c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(-14, 10, -10, -4, -4, -15); c.quadraticCurveTo(-2, -4, 2, -6); c.quadraticCurveTo(4, -12, 6, -15); c.bezierCurveTo(14, -2, 12, 10, 0, 14);
    artVol(c, '#ff7a1c', 0, 2, 13, 2.2);
    c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-7.5, 8, -5.5, 0, -1, -5); c.quadraticCurveTo(2, 2, 4, 0); c.bezierCurveTo(7.5, 6, 5, 10, 0, 12);
    c.fillStyle = '#ffd84a'; c.fill();
    c.beginPath(); c.moveTo(0, 11); c.bezierCurveTo(-3, 9, -2.5, 5, 0, 3); c.bezierCurveTo(2.5, 5, 3, 9, 0, 11); c.fillStyle = '#fff6d0'; c.fill();
  },
  ankh(c) {
    c.beginPath(); c.ellipse(0, -7, 6, 7, 0, 0, Math.PI * 2); c.strokeStyle = OUT; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#ffd84a'; c.lineWidth = 4; c.stroke();
    for (const [x1, y1, x2, y2] of [[0, 0, 0, 15], [-10.5, 2, 10.5, 2]]) { line(c, x1, y1, x2, y2, OUT, 7); line(c, x1, y1, x2, y2, '#ffd84a', 4); }
    if (!artFlat) {
      c.beginPath(); c.ellipse(0, -7, 6, 7, 0, Math.PI * 0.9, Math.PI * 1.5); c.strokeStyle = '#fff8c0'; c.lineWidth = 1.4; c.stroke();
      line(c, -1, 4, -1, 13, 'rgba(255,250,200,0.9)', 1.2);
      c.beginPath(); c.ellipse(0, -7, 6, 7, 0, 0.1, Math.PI * 0.6); c.strokeStyle = '#c49a20'; c.lineWidth = 1.4; c.stroke();
      artSparkIcon(c, [[10, -10, 2.4], [-11, 11, 1.6]]);
    }
  },
  lens(c) {
    line(c, 5.5, 5.5, 14, 14, OUT, 7.5); line(c, 5.5, 5.5, 14, 14, '#7a4a2a', 5);
    line(c, 7, 6.5, 12.5, 12, 'rgba(255,220,180,0.4)', 1.2);
    c.beginPath(); c.arc(-2, -2, 10, 0, Math.PI * 2);
    if (artFlat) c.fillStyle = 'rgba(170,220,255,0.45)';
    else { const g = c.createRadialGradient(-5, -5, 1, -2, -2, 10); g.addColorStop(0, 'rgba(240,250,255,0.9)'); g.addColorStop(1, 'rgba(120,180,240,0.45)'); c.fillStyle = g; }
    c.fill();
    c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#a8aeb8'; c.lineWidth = 3; c.stroke();
    ellipse(c, -6, -6, 3.2, 1.8, 'rgba(255,255,255,0.9)', null, 0, -0.7);
  },
  candy(c) {
    line(c, 0, 0, 0, 15.5, OUT, 4); line(c, 0, 0, 0, 15.5, '#ecdcb4', 2.2);
    c.beginPath();
    for (const [x, y, r] of [[-5, -4, 7.5], [5, -5, 7.5], [0, -10, 7], [0, -1.5, 6.5], [-7.5, -10, 4.5], [7.5, -11, 4.5]]) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
    c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#f5a3c7'; c.fill();
    if (!artFlat) { circle(c, -4, -9, 4, 'rgba(255,255,255,0.35)'); circle(c, 4, -1, 4.5, 'rgba(200,60,120,0.18)'); }
    circle(c, -5, -10, 1.6, 'rgba(255,255,255,0.8)');
  },
  // --- активные ---
  d6(c) {
    rrect(c, -13, -13, 26, 26, 5); artVol(c, '#f4f0e6', 0, 0, 14, 2.2);
    for (const [x, y] of [[-6, -6], [6, -6], [-6, 0], [6, 0], [-6, 6], [6, 6]]) { circle(c, x, y, 2.5, '#1a1a1a'); circle(c, x - 0.7, y - 0.8, 0.7, 'rgba(255,255,255,0.5)'); }
    if (!artFlat) line(c, -9, -11, 6, -11, 'rgba(255,255,255,0.9)', 1.2);
  },
  blackbook(c) { bookShape(c, '#26202a', () => ICONS.pentagramSmall(c)); },
  pentagramSmall(c) {
    if (!artFlat) { circle(c, -1.5, 0, 8, 'rgba(220,30,30,0.18)'); }
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 7 - 1.5, Math.sin(a) * 7); }
    c.closePath(); c.strokeStyle = '#e02c2c'; c.lineWidth = 1.6; c.stroke();
    circle(c, -1.5, 0, 7.6, null, '#a01c1c', 0.9);
  },
  prayer(c) {
    bookShape(c, '#7a4a22', () => {
      for (const [x1, y1, x2, y2] of [[-1.5, -9, -1.5, 9], [-6.5, -3.5, 3.5, -3.5]]) { line(c, x1, y1, x2, y2, '#7a5a10', 4.2); line(c, x1, y1, x2, y2, '#ffd84a', 2.6); }
      for (const [x, y] of [[-9.5, -12.5], [6.5, -12.5], [-9.5, 10.5], [6.5, 10.5]]) circle(c, x, y, 1.3, '#e6c264');
    });
  },
  catHead(c) {
    for (const s of [-1, 1]) { poly(c, [s * 12.5, -3, s * 10.5, -15.5, s * 3, -9.5]); artVol(c, '#8a8a92', s * 9, -9, 6, 1.6); poly(c, [s * 10.5, -5, s * 9.8, -12, s * 5.5, -8.5], '#e8a0b8'); }
    artBall(c, 0, 2, 12.5, '#9a9aa2', 2.2);
    ellipse(c, 0, 7, 6, 4, '#c8c8ce');
    for (const s of [-1, 1]) { ellipse(c, s * 4.6, 0, 2.6, 2.8, '#e8d040', OUT, 0.8); line(c, s * 4.6, -2, s * 4.6, 2, '#111', 1.2); circle(c, s * 4.6 - 0.8, -0.9, 0.5, '#fff'); }
    poly(c, [-1.6, 5, 1.6, 5, 0, 7], '#f07aa0');
    line(c, 0, 7, 0, 8.5, OUT, 0.9);
    for (const s of [-1, 1]) { line(c, s * 13, 5, s * 5.5, 6, '#eee', 0.8); line(c, s * 13, 8.5, s * 5.5, 7.2, '#eee', 0.8); }
    c.strokeStyle = 'rgba(60,60,70,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-2, -9); c.lineTo(-1.5, -6); c.moveTo(2, -9); c.lineTo(1.5, -6); c.moveTo(0, -10); c.lineTo(0, -6.5); c.stroke();
  },
  teleport(c) {
    artBall(c, 0, 0, 14.5, '#2a1a4a', 2.2);
    if (!artFlat) circle(c, 0, 0, 10, 'rgba(180,120,255,0.3)');
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 3.5 + i * 3.4, i * 1.7, i * 1.7 + 4.2); c.strokeStyle = ['#ffffff', '#d0b0ff', '#9a6ae0'][i]; c.lineWidth = 2.1; c.stroke(); }
    circle(c, 0, 0, 1.8, '#fff');
    artSparkIcon(c, [[9, -9, 2], [-10, 7, 1.5]], '#e8d8ff');
  },
  hourglass(c) {
    poly(c, [-8, -12, 8, -12, 1.6, 0, 8, 12, -8, 12, -1.6, 0]);
    if (artFlat) { c.fillStyle = 'rgba(200,230,255,0.55)'; c.fill(); }
    else { const g = c.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, 'rgba(230,245,255,0.85)'); g.addColorStop(1, 'rgba(140,190,230,0.5)'); c.fillStyle = g; c.fill(); }
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    poly(c, [-5.5, 11, 5.5, 11, 0, 4.5], '#e6c264'); poly(c, [-4.5, -9, 4.5, -9, 0, -3], '#e6c264');
    line(c, 0, -2, 0, 5, '#e6c264', 1);
    for (const y of [-14, 14]) { rrect(c, -11, y - 2.2, 22, 4.4, 2); artVol(c, '#8a5a2e', 0, y, 11, 1.6); }
    line(c, -9, -12, -9, 12, '#6a4220', 1.6); line(c, 9, -12, 9, 12, '#6a4220', 1.6);
    line(c, -5, -9, -2.2, -3, 'rgba(255,255,255,0.8)', 1);
  },
  yum(c) {
    heartPath(c, 0, 2, 31); artVol(c, '#d8a050', 0, 1, 14, 2.2);
    heartPath(c, 0, 2.5, 21); c.fillStyle = '#b8243a'; c.fill();
    for (let i = -1; i <= 1; i++) { line(c, i * 5 - 1, -4, i * 5 + 1.5, 6, OUT, 3.2); line(c, i * 5 - 1, -4, i * 5 + 1.5, 6, '#f0cc8c', 1.8); }
    if (!artFlat) { circle(c, -3, 1, 1, '#ff7088'); circle(c, 4, 3, 0.9, '#ff7088'); }
  },
  grimoire(c) {
    bookShape(c, '#4a2a6a', () => {
      if (!artFlat) circle(c, -1.5, 0, 8, 'rgba(255,60,60,0.2)');
      eyeShape(c, -1.5, 0, 6.5, 4.2, '#c42424');
      for (const [x, y] of [[-9.5, -12.5], [6.5, -12.5], [-9.5, 10.5], [6.5, 10.5]]) poly(c, [x, y - 1.6, x + 1.6, y, x, y + 1.6, x - 1.6, y], '#c8a8e8');
    });
  },
  mrBoom(c) {
    c.save(); c.translate(0, 4); artBombBody(c, 11.5, false); c.restore();
    circle(c, -4, 3, 2.4, '#fff'); circle(c, 4, 3, 2.4, '#fff'); circle(c, -3.6, 3.5, 1.2, '#000'); circle(c, 4.4, 3.5, 1.2, '#000');
    line(c, -7, -0.5, -2, 0.8, '#fff', 1.2); line(c, 7, -0.5, 2, 0.8, '#fff', 1.2);
    c.beginPath(); c.arc(0, 8, 3.5, 0.2, Math.PI - 0.2); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
  },
  unknown(c) {
    c.beginPath(); c.arc(0, -5, 6.5, Math.PI * 1.05, Math.PI * 2.35); c.quadraticCurveTo(0, 0, 0, 4.5);
    c.strokeStyle = OUT; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 3.6; c.stroke();
    circle(c, 0, 11, 3.4, '#ffffff', OUT, 1.8);
  },
};

function drawItemIcon(c, id, x, y, scale = 1) {
  const fn = ICONS[id] || ICONS.unknown;
  // масштаб квантуется шагом 0.05, чтобы анимации размера не плодили спрайты
  const q = Math.max(0.1, Math.round(scale * 20) / 20);
  const sp = artSprite('i' + (ICONS[id] ? id : '?') + '|' + q, 21 * q, 21 * q, g => { g.scale(q, q); fn(g); });
  artBlit(c, sp, x, y, Math.abs(scale - q) < 1e-6 ? 1 : scale / q);
}

// ============================================================
//  Снаряды: вражеские (с настройкой заметности) и слёзы героя
// ============================================================
function artShotBody(c, r, sc, pl) {
  const fill = pl ? mixColor(sc.fill, '#ffffff', 0.12) : sc.fill;
  if (pl === 1) {
    // мягкое внешнее свечение
    if (artFlat) circle(c, 0, 0, r + 4, sc.glow + '0.3)');
    else {
      const g = c.createRadialGradient(0, 0, r * 0.7, 0, 0, r + 5.5);
      g.addColorStop(0, sc.glow + '0.6)'); g.addColorStop(1, sc.glow + '0)');
      circle(c, 0, 0, r + 5.5, g);
    }
  }
  if (pl === 2) circle(c, 0, 0, r + 3.2, null, '#ffffff', 1.8);
  // тело
  if (artFlat) circle(c, 0, 0, r, fill);
  else {
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    g.addColorStop(0, mixColor(fill, '#ffffff', pl ? 0.55 : 0.4)); g.addColorStop(0.5, fill); g.addColorStop(1, mixColor(fill, sc.dark, 0.38));
    circle(c, 0, 0, r, g);
  }
  // обводка: обычная, толстая, двойная (тёмная + светлая снаружи)
  if (pl === 0) circle(c, 0, 0, r, null, sc.dark, 1.5);
  else if (pl === 1) {
    // контрастная кайма: тёмное кольцо и светлый ободок — снаряд виден даже на полу того же цвета
    circle(c, 0, 0, r + 0.3, null, sc.dark, 2.4);
    circle(c, 0, 0, r + 1.5, null, 'rgba(0,0,0,0.5)', 1.5);
    const a0 = c.globalAlpha;
    c.globalAlpha = a0 * 0.85;
    circle(c, 0, 0, r + 2.6, null, mixColor(sc.fill, '#ffffff', 0.75), 1.2);
    c.globalAlpha = a0;
  } else circle(c, 0, 0, r + 0.9, null, sc.dark, 2.8);
  // блик
  if (pl === 0) circle(c, -r * 0.3, -r * 0.3, r * 0.32, sc.hi);
  else {
    ellipse(c, -r * 0.3, -r * 0.36, r * 0.36, r * 0.24, '#ffffff', null, 0, -0.6);
    circle(c, r * 0.34, r * 0.3, r * 0.1, 'rgba(255,255,255,0.7)');
  }
}
// Один вражеский снаряд. Внешний вид — по настройкам «Заметность снарядов» и «Цвет».
function drawEnemyShot(c, x, y, r, t = 0) {
  const pl = projLevel(), sc = shotColor();
  const R = pl === 2 ? r * 1.3 : r;
  if (pl === 2) {
    // пульсирующий ореол
    const p = 0.5 + 0.5 * Math.sin(t * 0.22);
    circle(c, x, y, R + 5 + p * 3.5, sc.glow + (0.14 + p * 0.2).toFixed(2) + ')');
  }
  const q = Math.max(2, Math.round(R * 2) / 2);
  const sp = artSprite('es' + Settings.v.shotColor + pl + '|' + q, q + 6, q + 6, g => artShotBody(g, q, sc, pl));
  artBlit(c, sp, x, y, R / q);
}
function artTearBody(c, r, col, glow) {
  if (glow) {
    const A = hexToRgb(col), rgb = 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',';
    const g = c.createRadialGradient(0, 0, r * 0.6, 0, 0, r + 5);
    g.addColorStop(0, rgb + '0.4)'); g.addColorStop(1, rgb + '0)');
    circle(c, 0, 0, r + 5, g);
  }
  if (artFlat) {
    circle(c, 0, 0, r, col, 'rgba(10,20,40,0.6)', 1.2);
    circle(c, -r * 0.3, -r * 0.32, r * 0.3, 'rgba(255,255,255,0.85)');
    return;
  }
  const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.36, col); g.addColorStop(1, mixColor(col, '#1a2848', 0.5));
  circle(c, 0, 0, r, g, 'rgba(10,20,40,0.62)', Math.min(1.4, 0.6 + r * 0.12));
  // преломлённый свет у нижнего края
  c.beginPath(); c.arc(0, 0, r * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(0.7, r * 0.14); c.stroke();
  // блики
  ellipse(c, -r * 0.32, -r * 0.38, r * 0.32, r * 0.2, 'rgba(255,255,255,0.95)', null, 0, -0.65);
  if (r > 4) circle(c, r * 0.36, -r * 0.3, r * 0.08, 'rgba(255,255,255,0.8)');
}
// светлые цвета слёз, смещённые к синему (mixColor(col, '#4a8ae0', 0.35))
const fixBTearBlue = { '#a9d9ff': '#88bdf4', '#e4e4e4': '#aec5e3' };
// Слеза героя: стеклянная капля, слегка вытянутая по скорости, с коротким следом.
// При повышенной заметности вражеских снарядов свои слёзы прозрачнее.
function artTear(c, x, y, r, col, vx, vy, spectral) {
  const L = gfxLevel(), pl = projLevel();
  // при белых вражеских снарядах светлые слёзы героя заметно голубее
  if (Settings.v.shotColor === 'white' && fixBTearBlue[col]) col = fixBTearBlue[col];
  const glow = L === 2 && pl < 2;
  const q = Math.max(1.5, Math.round(r * 2) / 2), pad = glow ? 6 : 2;
  const sp = artSprite('t' + col + (glow ? 1 : 0) + '|' + q, q + pad, q + pad, g => artTearBody(g, q, col, glow));
  const a0 = c.globalAlpha, a = a0 * (pl === 1 ? 0.85 : pl === 2 ? 0.6 : 1);
  const v = Math.hypot(vx, vy);
  if (L === 2 && v > 1) {
    for (let i = 1; i <= 2; i++) { c.globalAlpha = a * 0.2 / i; circle(c, x - vx * i * 1.6, y - vy * i * 1.6, r * (1 - i * 0.2), col); }
  }
  c.globalAlpha = a;
  if (L && v > 1.5) {
    const st = Math.min(0.2, v * 0.022), an = Math.atan2(vy, vx);
    c.save(); c.translate(x, y); c.rotate(an); c.scale(1 + st, 1 - st * 0.5); c.rotate(-an);
    artBlit(c, sp, 0, 0, r / q);
    c.restore();
  } else artBlit(c, sp, x, y, r / q);
  if (spectral) circle(c, x, y, r + 2, null, 'rgba(255,255,255,0.35)', 1);
  c.globalAlpha = a0;
}

// ============================================================
//  Лучи: адская сера и лазер
// ============================================================
function artBeamNoise(d, t) { return 0.5 + 0.3 * Math.sin(d * 0.13 - t * 0.8) + 0.2 * Math.sin(d * 0.31 + t * 1.7); }
// вспышка в точке удара
function artFlare(c, x, y, r, t, col, core, n = 6) {
  circle(c, x, y, r, col);
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = t * 0.15 + i * Math.PI * 2 / n, l = r * (1.45 + 0.35 * Math.sin(t * 0.5 + i * 2.1));
    c.moveTo(x + Math.cos(a - 0.22) * r * 0.5, y + Math.sin(a - 0.22) * r * 0.5);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.lineTo(x + Math.cos(a + 0.22) * r * 0.5, y + Math.sin(a + 0.22) * r * 0.5);
  }
  c.fillStyle = col; c.fill();
  circle(c, x, y, r * 0.45, core);
}
function artBeam(c, x0, y0, x1, y1, w, kind, t) {
  const L = gfxLevel(), len = Math.hypot(x1 - x0, y1 - y0);
  c.save();
  c.lineCap = 'round';
  if (kind === 'brim') {
    const wob = Math.sin(t * 0.9) * 2;
    // у героя луч начинается узко и без круглого «колпака», чтобы не закрывать голову
    c.lineCap = 'butt';
    if (!L) {
      line(c, x0, y0, x1, y1, 'rgba(120,0,0,0.55)', w + 10 + wob);
      line(c, x0, y0, x1, y1, '#d01818', w + wob);
      line(c, x0, y0, x1, y1, '#ff8a6a', w * 0.4);
      circle(c, x1, y1, w * 0.8, 'rgba(220,30,30,0.7)');
      c.restore();
      return;
    }
    if (L === 2) line(c, x0, y0, x1, y1, 'rgba(150,0,0,0.22)', w + 22 + wob * 2);
    line(c, x0, y0, x1, y1, 'rgba(190,10,10,0.42)', w + 9 + wob);
    c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
    // тело луча с рваными краями; у начала сужается
    const hw = (w + wob) / 2, h0 = hw * 0.6, step = L === 2 ? 8 : 13, amp = hw * 0.42;
    c.beginPath(); c.moveTo(0, -h0);
    for (let d = step; d < len; d += step) c.lineTo(d, -hw - artBeamNoise(d, t) * amp);
    c.lineTo(len, -hw);
    c.arc(len, 0, hw, -Math.PI / 2, Math.PI / 2);
    for (let d = Math.floor(len / step) * step; d > 0; d -= step) c.lineTo(d, hw + artBeamNoise(d + 40, t + 5) * amp);
    c.lineTo(0, h0);
    c.arc(0, 0, h0, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
    c.fillStyle = '#c81212'; c.fill();
    line(c, 0, 0, len, 0, '#ff4a32', hw * 1.15);
    line(c, 0, 0, len, 0, L === 2 ? '#ffb8a0' : '#ff9a7a', hw * 0.5);
    if (L === 2) {
      line(c, 0, 0, len, 0, '#fff4ee', Math.max(1, hw * 0.16));
      // бегущие сгустки вдоль луча
      for (let d = (t * 9) % 46; d < len; d += 46) ellipse(c, d, 0, hw * 0.9, hw * 0.55, 'rgba(255,200,170,0.45)');
    }
    // вспышки у глаз и в точке удара
    circle(c, 0, 0, hw * 0.75, 'rgba(255,110,80,0.5)');
    artFlare(c, len, 0, hw * 1.25, t, 'rgba(255,70,40,0.75)', L === 2 ? '#fff0e0' : '#ffb090', L === 2 ? 7 : 5);
  } else {
    line(c, x0, y0, x1, y1, 'rgba(255,40,40,0.45)', w + 6);
    if (L === 2) line(c, x0, y0, x1, y1, 'rgba(255,60,60,0.18)', w + 14);
    line(c, x0, y0, x1, y1, '#ff4040', w);
    line(c, x0, y0, x1, y1, '#fff', Math.max(1, w * 0.35));
    if (L) artFlare(c, x1, y1, w * 0.9 + 1, t, 'rgba(255,90,80,0.7)', '#ffffff', 4);
  }
  c.restore();
}

// ============================================================
//  Эффекты: взрыв, брызги, облачка
// ============================================================
function artFireballSprite() {
  return artSprite('fireball', 50, 50, g => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 50);
    gr.addColorStop(0, 'rgba(255,252,236,1)'); gr.addColorStop(0.22, 'rgba(255,226,120,1)');
    gr.addColorStop(0.5, 'rgba(255,150,40,0.92)'); gr.addColorStop(0.78, 'rgba(225,70,20,0.55)'); gr.addColorStop(1, 'rgba(160,20,10,0)');
    g.fillStyle = gr; g.fillRect(-50, -50, 100, 100);
  });
}
// k — прогресс 0..1; seed — случайное зерно эффекта
function artExplosion(c, x, y, R, k, seed, small) {
  const L = gfxLevel();
  // первая вспышка
  if (k < 0.1) {
    const q = 1 - k / 0.1;
    if (L === 2) { const a0 = c.globalAlpha; c.globalAlpha = a0 * q * 0.8; artBlit(c, artFireballSprite(), x, y, R * 1.1 / 42); c.globalAlpha = a0; }
    else circle(c, x, y, R * (0.75 + k * 2), 'rgba(255,225,150,' + (0.45 * q).toFixed(3) + ')');
  }
  // ударная волна
  if (k < 0.55) {
    const q = k / 0.55;
    circle(c, x, y, R * (0.35 + q), null, 'rgba(255,238,205,' + (0.8 * (1 - q)).toFixed(3) + ')', (1 - q) * (L ? 7 : 4) + 0.5);
    if (L === 2) circle(c, x, y, R * (0.3 + q * 0.85), null, 'rgba(255,170,80,' + (0.35 * (1 - q)).toFixed(3) + ')', (1 - q) * 3 + 0.5);
  }
  // клубы дыма
  const n = small ? [0, 2, 4][L] : [2, 6, 10][L];
  const pa = Math.min(1, k * 4) * (1 - k) * 0.85;
  for (let i = 0; i < n; i++) {
    const an = seed + i * 2.39996, h = artHash(seed, i);
    const d = R * (0.25 + 0.5 * h) * (0.45 + k * 0.8);
    const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * 0.7 - k * R * 0.35;
    const pr = R * (0.17 + 0.1 * artHash(i, seed)) * (0.65 + k);
    circle(c, px, py, pr, 'rgba(52,46,42,' + pa.toFixed(3) + ')');
    if (L === 2) circle(c, px - pr * 0.3, py - pr * 0.32, pr * 0.58, 'rgba(120,110,100,' + (pa * 0.7).toFixed(3) + ')');
  }
  // огненный шар
  if (k < 0.6) {
    const q = k / 0.6, fr = R * (0.42 + 0.42 * Math.sqrt(q)) * (1 - q * 0.35), fa = 1 - q * q;
    const a0 = c.globalAlpha;
    if (L === 2) { c.globalAlpha = a0 * fa; artBlit(c, artFireballSprite(), x, y, fr / 42); c.globalAlpha = a0; }
    else {
      circle(c, x, y, fr, 'rgba(255,140,40,' + (0.6 * fa).toFixed(3) + ')');
      circle(c, x, y, fr * 0.7, 'rgba(255,220,100,' + (0.8 * fa).toFixed(3) + ')');
    }
    if (L) {
      // языки пламени по краю
      const m = L === 2 ? 8 : 6;
      for (let i = 0; i < m; i++) {
        const an = seed * 3 + i * Math.PI * 2 / m + k * 1.5, dd = fr * (0.7 + 0.15 * artHash(i, seed));
        circle(c, x + Math.cos(an) * dd, y + Math.sin(an) * dd * 0.85, fr * 0.34 * (1 - q * 0.5), 'rgba(255,' + (110 + i * 9) + ',30,' + (0.5 * fa).toFixed(3) + ')');
      }
    }
    circle(c, x, y, fr * 0.36 * (1 - q), '#fff8e0');
  }
}

// ============================================================
//  Пьедестал, люк, фамильяры, аура героя
// ============================================================
const artAltarPal = {
  normal: { top: '#aaa496', side: '#8b8578', base: '#77716a', carve: 'rgba(40,30,20,0.28)' },
  devil: { top: '#6a3a36', side: '#4e2624', base: '#3a1a18', carve: 'rgba(255,60,40,0.3)' },
  angel: { top: '#f2f2f8', side: '#d8dae4', base: '#bcc0cc', carve: 'rgba(200,160,60,0.45)' },
};
function artAltarBody(c, p) {
  // плинтус, тумба и столешница
  rrect(c, -17, 2, 34, 8, 2); artVol(c, p.base, 0, 6, 17, 2);
  rrect(c, -13.5, -9, 27, 13, 2); artVol(c, p.side, 0, -2.5, 14, 2);
  // резная панель
  rrect(c, -9.5, -6.5, 19, 8.5, 1.5, p.carve, 'rgba(255,255,255,0.18)', 1);
  poly(c, [0, -5.2, 4, -2.3, 0, 0.6, -4, -2.3], 'rgba(255,255,255,0.14)', p.carve, 1);
  circle(c, -7, -2.3, 0.9, p.carve); circle(c, 7, -2.3, 0.9, p.carve);
  rrect(c, -18.5, -14, 37, 6, 2); artVol(c, p.top, 0, -11, 18, 2);
  line(c, -16, -12.8, 16, -12.8, 'rgba(255,255,255,0.35)', 1.2);
  // сколы и трещинки
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(10, -8.5); c.lineTo(11.5, -5); c.lineTo(10.5, -2); c.moveTo(-14, 3); c.lineTo(-12, 6); c.stroke();
}
function artAltar(c, x, y, type) {
  const key = type === 'devil' || type === 'angel' ? type : 'normal';
  artBlit(c, artSprite('altar' + key, 20, 16, g => artAltarBody(g, artAltarPal[key])), x, y);
}
// свет над пьедесталом: конус от столешницы к предмету и мягкое пятно позади
function artItemLight(c, x, y, t, L) {
  const sp = artSprite('pedlight', 30, 36, g => {
    let gr = g.createLinearGradient(0, 22, 0, -30);
    gr.addColorStop(0, 'rgba(255,248,210,0.42)'); gr.addColorStop(1, 'rgba(255,248,210,0)');
    g.beginPath(); g.moveTo(-15, 22); g.lineTo(15, 22); g.lineTo(24, -30); g.lineTo(-24, -30); g.closePath(); g.fillStyle = gr; g.fill();
    gr = g.createRadialGradient(0, 0, 2, 0, 0, 26);
    gr.addColorStop(0, 'rgba(255,255,225,0.4)'); gr.addColorStop(1, 'rgba(255,255,225,0)');
    g.fillStyle = gr; g.fillRect(-30, -30, 60, 56);
  });
  const a0 = c.globalAlpha;
  c.globalAlpha = a0 * (L === 2 ? 0.85 + 0.15 * Math.sin(t * 0.05) : 0.7);
  artBlit(c, sp, x, y - 12 - 22, 1.0001);
  c.globalAlpha = a0;
}
function artSparkles(c, x, y, t, n = 3, R = 17, col = '#fffbe0') {
  for (let i = 0; i < n; i++) {
    const f = t * 0.012 + i / n, ph = f % 1, cyc = Math.floor(f);
    const a = artHash(i + 3, cyc) * Math.PI * 2, d = R * (0.6 + 0.5 * artHash(cyc, i));
    const s = Math.sin(ph * Math.PI) * 2.8;
    if (s > 0.3) artStar4(c, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - ph * 4, s, col);
  }
}
// деревянный люк в полу: рама из досок, колодец с лестницей, уходящей в темноту
function artTrapdoorBody(c) {
  if (!artFlat) { rrect(c, -32, -22.5, 64, 46, 8, 'rgba(0,0,0,0.25)'); }
  // рама
  rrect(c, -29, -20, 58, 40, 4); artVol(c, '#70482a', 0, 0, 30, 2.4);
  c.strokeStyle = 'rgba(40,20,5,0.55)'; c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-29, -20); c.lineTo(-22, -14); c.moveTo(29, -20); c.lineTo(22, -14); c.moveTo(-29, 20); c.lineTo(-22, 14); c.moveTo(29, 20); c.lineTo(22, 14);
  c.moveTo(-10, -20); c.lineTo(-10, -14); c.moveTo(12, 14); c.lineTo(12, 20); c.stroke();
  for (const [x, y] of [[-25.5, -17], [25.5, -17], [-25.5, 17], [25.5, 17]]) { circle(c, x, y, 1.4, '#3a3a40'); circle(c, x - 0.4, y - 0.4, 0.5, '#9aa0a8'); }
  // колодец
  rrect(c, -22, -14, 44, 28, 2, '#060403', OUT, 2);
  // дальняя стенка колодца
  poly(c, [-21, -13, 21, -13, 17, -3, -17, -3], artFlat ? '#2e1e12' : null);
  if (!artFlat) {
    const g = c.createLinearGradient(0, -13, 0, -3);
    g.addColorStop(0, '#4a3220'); g.addColorStop(1, '#120a06');
    c.fillStyle = g; c.fill();
    for (const x of [-12, -4, 4, 12]) line(c, x, -13, x * 0.82, -3, 'rgba(0,0,0,0.45)', 1);
  }
  // лестница
  for (const k of [-1, 1]) line(c, k * 7.5, -13, k * 5.5, 13, '#7a5434', 1.8);
  for (let i = 0; i < 5; i++) {
    const y = -10 + i * 5.2, w = 7.4 - i * 0.4;
    line(c, -w, y, w, y, 'rgba(150,108,70,' + (0.95 - i * 0.18).toFixed(2) + ')', 1.6);
  }
  // темнота внизу
  if (!artFlat) {
    const g = c.createLinearGradient(0, -6, 0, 14);
    g.addColorStop(0, 'rgba(6,4,3,0)'); g.addColorStop(1, 'rgba(6,4,3,0.95)');
    c.fillStyle = g; c.fillRect(-21, -6, 42, 19);
  } else { c.fillStyle = 'rgba(6,4,3,0.7)'; c.fillRect(-21, 5, 42, 8); }
  rrect(c, -22, -14, 44, 28, 2, null, OUT, 2);
  line(c, -27, -18.5, 27, -18.5, 'rgba(255,220,170,0.25)', 1);
}
function artTrapdoor(c, x, y, k) {
  if (k <= 0) return;
  artBlit(c, artSprite('trapdoor2', 33, 25, artTrapdoorBody), x, y, k < 1 ? k : 1);
}
// Мушка-страж
function artOrbital(c, x, y, t) {
  const L = gfxLevel(), fl = Math.sin(t * 0.9);
  if (L === 2) ellipse(c, x, y + 1, 10, 3.8, null, 'rgba(255,224,96,0.45)', 1.2);
  for (const k of [-1, 1]) ellipse(c, x + k * 4.5, y - 4.5, 4.6, 2.2 + fl * 1.1, 'rgba(232,236,248,0.8)', OUT, 1, k * (0.55 + fl * 0.25));
  circle(c, x, y, 5.2, '#2a2a30', OUT, 1.5);
  if (L) artGlint(c, x - 2, y - 2.6, 1.6, 0.9, -0.6, 0.5);
  circle(c, x - 1.9, y - 0.4, 1.4, '#fff'); circle(c, x + 1.9, y - 0.4, 1.4, '#fff');
  circle(c, x - 1.7, y - 0.1, 0.7, '#111'); circle(c, x + 2.1, y - 0.1, 0.7, '#111');
}
// свечение заряда адской серы над головой
function artChargeGlow(c, x, y, k, t) {
  const L = gfxLevel(), full = k >= 1;
  circle(c, x, y, 16 + k * 6, 'rgba(200,20,20,' + (0.15 + k * 0.35).toFixed(3) + ')');
  if (!L) return;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + t * 0.12, d = 27 - ((t * 0.9 + i * 4.5) % 14);
    circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.2 + k, 'rgba(255,70,40,' + (0.3 + k * 0.6).toFixed(3) + ')');
  }
  if (full) circle(c, x, y, 22 + Math.sin(t * 0.5) * 2, null, 'rgba(255,90,60,0.7)', L === 2 ? 2.4 : 1.6);
}
// пузырь неуязвимости (молитвенник)
function artShield(c, x, y, t, left) {
  if (left < 60 && Math.floor(left / 5) % 2) return;
  const L = gfxLevel();
  circle(c, x, y, 24, 'rgba(255,250,200,0.2)', 'rgba(255,240,160,0.85)', 2);
  if (!L) return;
  c.beginPath(); c.arc(x, y, 20, Math.PI * 1.1, Math.PI * 1.45); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2.2; c.stroke();
  if (L === 2) { c.beginPath(); c.arc(x, y, 24, t * 0.05, t * 0.05 + 1); c.strokeStyle = 'rgba(255,255,230,0.9)'; c.lineWidth = 3; c.stroke(); }
}
// лучи за поднятым над головой предметом
function artHoldRays(c, x, y, t) {
  const L = gfxLevel();
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = t * 0.02 + i * Math.PI / 4;
    c.moveTo(x, y); c.lineTo(x + Math.cos(a - 0.14) * 30, y + Math.sin(a - 0.14) * 30); c.lineTo(x + Math.cos(a + 0.14) * 30, y + Math.sin(a + 0.14) * 30);
  }
  c.fillStyle = 'rgba(255,245,190,0.22)'; c.fill();
  if (L === 2) artSparkles(c, x, y, t * 2, 3, 20);
}

// ============================================================
//  Главный герой
// ============================================================
// особенности внешности: hair — волосы, cloth — одежда, out — цвет контура
const artLook = {
  kai: {},
  magda: { hair: '#7a3e1c', cloth: '#b04a5e' },
  outcast: { cloth: '#6a1e22' },
  shade: { out: '#1c2846', noBlush: true },
  brute: { hair: '#3a2216', cloth: '#5a4030' },
  phoenix: { cloth: '#c4521c' },
  horned: { eye: '#e01818', out: '#1a0c12', noBlush: true },
  lost: { out: '#4a5266', eye: '#30343e', noBlush: true },
};
// градиент кожи (кешируется: голова и тело рисуются в своих локальных координатах)
const artGradCache = new Map();
function artSkinGrad(c, skin, r, key) {
  const k = skin + key + r;
  let g = artGradCache.get(k);
  if (!g) {
    g = c.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.05, 0, 0, r * 1.05);
    g.addColorStop(0, mixColor(skin, '#ffffff', 0.42)); g.addColorStop(0.5, skin); g.addColorStop(1, mixColor(skin, '#3a1810', 0.3));
    if (artGradCache.size > 80) artGradCache.clear();
    artGradCache.set(k, g);
  }
  return g;
}
// полутень снизу-справа без градиента (среднее качество)
function artCrescent(c, r, a = 0.13) {
  const a0 = -0.12 * Math.PI, a1 = 0.95 * Math.PI;
  c.beginPath(); c.arc(0, 0, r, a0, a1);
  c.quadraticCurveTo(r * 0.3, r * 0.5, Math.cos(a0) * r, Math.sin(a0) * r);
  c.fillStyle = 'rgba(90,30,20,' + a + ')'; c.fill();
}
function artHeroEye(c, ex, ey, sx, col, L, hiCol) {
  ellipse(c, ex, ey, 3.3 * sx, 4.3, col);
  circle(c, ex - 1.1 * sx, ey - 1.6, 1.25, hiCol);
  if (L) circle(c, ex + 0.95 * sx, ey + 1.65, 0.6, 'rgba(255,255,255,0.75)');
}
function artTearStreak(c, ex, ey, L) {
  if (!L) { ellipse(c, ex, ey + 6, 1.6, 2.4, '#8cc8ff'); return; }
  c.beginPath(); c.moveTo(ex - 1.4, ey + 3); c.quadraticCurveTo(ex - 1.7, ey + 7, ex - 0.6, ey + 9.4); c.lineTo(ex + 0.7, ey + 9.2); c.quadraticCurveTo(ex + 0.2, ey + 6, ex + 1.2, ey + 3.2); c.closePath();
  c.fillStyle = 'rgba(140,200,255,0.85)'; c.fill();
  circle(c, ex + 0.05, ey + 9.8, 1.8, '#8cc8ff', 'rgba(40,90,150,0.55)', 0.6);
  if (L === 2) circle(c, ex - 0.45, ey + 9.2, 0.55, '#fff');
}
function artHeroWings(c, bat, t, L, ghost) {
  const a0 = c.globalAlpha;
  if (ghost) c.globalAlpha = a0 * 0.8;
  const fl = Math.sin(t * (bat ? 0.35 : 0.3)) * (bat ? 0.3 : 0.25);
  for (const k of [-1, 1]) {
    c.save(); c.translate(k * 5, -14); c.rotate(k * ((bat ? 0.25 : 0.3) + fl)); c.scale(k, 1);
    if (bat) {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(10, -16); c.lineTo(24, -14);
      c.quadraticCurveTo(20, -9, 22, -4); c.quadraticCurveTo(16, -5, 15, 0); c.quadraticCurveTo(9, -2, 0, 4); c.closePath();
      c.fillStyle = '#2a1c24'; c.fill();
      // обводка до тени: poly() начинает новый путь, и контур крыла бы потерялся
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
      if (L) { c.save(); c.clip(); poly(c, [2, 1, 10, -14, 15, 0], 'rgba(120,60,85,0.35)'); c.restore(); }
      line(c, 10, -16, 15, 0, '#140c12', 1);
      if (L) { line(c, 10, -16, 22, -4, '#140c12', 0.8); circle(c, 10, -16, 1.3, '#3a2a32'); }
    } else {
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(9, -17, 23, -13);
      c.quadraticCurveTo(22, -8.5, 18, -7.5); c.quadraticCurveTo(18.5, -3.5, 13, -3); c.quadraticCurveTo(12, 1, 6, 1.5); c.quadraticCurveTo(3, 4, 0, 4); c.closePath();
      if (L === 2) { const g = c.createLinearGradient(0, -14, 8, 4); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6dae8'); c.fillStyle = g; }
      else c.fillStyle = 'rgba(250,250,255,0.95)';
      c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
      if (L) { c.strokeStyle = 'rgba(150,155,180,0.7)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(4, 0.5); c.lineTo(17, -7.5); c.moveTo(3, -3); c.lineTo(13, -11); c.stroke(); }
    }
    c.restore();
  }
  c.globalAlpha = a0;
}
// одежда на теле (локальные координаты тела, эллипс 7.5 x 7)
function artHeroCloth(c, look, col, L) {
  if (!L) {
    // низкое качество: одежда — нижний сегмент эллипса тела, без обрезки (clip дорогой)
    const top = look === 'outcast' ? -3.5 : look === 'magda' ? -2.5 : look === 'brute' ? 1.8 : look === 'phoenix' ? -1.5 : 0;
    const a = Math.asin(top / 7);
    c.beginPath(); c.ellipse(0, 0, 7.5, 7, 0, a, Math.PI - a); c.closePath();
    c.fillStyle = col; c.fill();
    return;
  }
  c.save();
  c.beginPath(); c.ellipse(0, 0, 7.5, 7, 0, 0, Math.PI * 2); c.clip();
  const dk = mixColor(col, '#000000', 0.35);
  if (look === 'outcast') {
    c.fillStyle = col; c.fillRect(-8, -3.5, 16, 11);
    poly(c, [-3, -3.5, 3, -3.5, 0, 0.5], mixColor(col, '#ffffff', 0.15));
    c.fillStyle = dk; c.fillRect(-8, 1.2, 16, 1.6);
  } else if (look === 'phoenix') {
    c.beginPath(); c.moveTo(-8, 0.5);
    for (let i = 0; i < 6; i++) c.lineTo(-8 + i * 3.2 + 1.6, i % 2 ? -1.5 : -3);
    c.lineTo(8, 0.5); c.lineTo(8, 8); c.lineTo(-8, 8); c.closePath();
    c.fillStyle = col; c.fill();
    if (L) line(c, -8, 2, 8, 2, '#ffb040', 1);
  } else if (look === 'magda') {
    c.fillStyle = col; c.fillRect(-8, -2.5, 16, 10);
    if (L) { line(c, -8, -2.2, 8, -2.2, mixColor(col, '#ffffff', 0.45), 1.2); for (const x of [-2, 2]) circle(c, x, 1.5, 0.6, '#f4e8e0'); }
  } else if (look === 'brute') {
    c.fillStyle = col; c.fillRect(-8, 2, 16, 6);
    c.fillStyle = dk; c.fillRect(-8, 1.6, 16, 1.4);
  }
  c.restore();
}
// голова в локальных координатах (центр 0,0, радиус 14.5)
function artHeroHead(c, o, look, lk, skin, ol, dir, L, t, sh) {
  const pf = artFlat;
  artFlat = L < 2; // объёмные градиенты на шапках и рогах — только на высоком качестве
  const hr = 14.5, up = dir === 'up', side = dir === 'left' || dir === 'right', kd = dir === 'left' ? -1 : 1;
  // --- позади головы ---
  if (look === 'magda' && !up) {
    artBall(c, 0, -15.5, 6.2, lk.hair, 1.6, ol);
    ellipse(c, 0, -10.5, 4.4, 1.6, '#e05a8a', ol, 1);
  }
  if (look === 'brute' && !up) {
    // хвосты повязки развеваются сзади
    const bx = side ? -kd * 12 : 12, fl = Math.sin(t * 0.2) * 1.5;
    const s = side ? -kd : 1;
    for (const dy of [0, 4]) poly(c, [bx, -6 + dy * 0.5, bx + s * 9, -8 + dy + fl, bx + s * 8, -4 + dy + fl, bx, -3 + dy * 0.5], '#c42424', ol, 1.2);
  }
  if (look === 'horned') {
    for (const k of [-1, 1]) {
      // короткий толстый рог: внутренний край почти прямой, внешний — выпуклый
      c.beginPath(); c.moveTo(k * 3, -11); c.quadraticCurveTo(k * 8, -19, k * 15.5, -26.5); c.quadraticCurveTo(k * 19, -14, k * 13.5, -5); c.closePath();
      artVol(c, '#3e2c38', k * 11, -15, 9, 1.5, ol);
      if (L) {
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(k * 9, -14.5); c.quadraticCurveTo(k * 13, -14, k * 16.6, -12); c.moveTo(k * 11, -18.5); c.quadraticCurveTo(k * 14, -18.5, k * 16.8, -16.5); c.moveTo(k * 13, -22); c.quadraticCurveTo(k * 15, -22, k * 16.6, -21); c.stroke();
        c.beginPath(); c.moveTo(k * 6, -14); c.quadraticCurveTo(k * 9.5, -19.5, k * 14.5, -24.5); c.strokeStyle = 'rgba(255,220,235,0.3)'; c.lineWidth = 1.1; c.stroke();
      }
    }
  }
  // --- сама голова ---
  c.beginPath(); c.arc(0, 0, hr, 0, Math.PI * 2);
  c.fillStyle = L === 2 ? artSkinGrad(c, skin, hr, 'h') : skin; c.fill();
  if (L === 1) artCrescent(c, hr, 0.12);
  // волосы, лежащие на голове
  if (look === 'magda') {
    c.save(); c.beginPath(); c.arc(0, 0, hr, 0, Math.PI * 2); c.clip();
    c.beginPath();
    if (up) { c.rect(-16, -16, 32, 22); }
    else {
      const sx = side ? -kd * 3 : 0;
      c.moveTo(-16, 5); c.lineTo(-16, -16); c.lineTo(16, -16); c.lineTo(16, 5);
      c.quadraticCurveTo(12 + sx, -2, 9 + sx, -4.5); c.quadraticCurveTo(5 + sx, -7.5, 0.6 + sx, -5.6);
      c.lineTo(-0.6 + sx, -5.6); c.quadraticCurveTo(-5 + sx, -7.5, -9 + sx, -4.5); c.quadraticCurveTo(-12 + sx, -2, -16, 5); c.closePath();
    }
    c.fillStyle = lk.hair; c.fill();
    if (L) {
      c.strokeStyle = mixColor(lk.hair, '#ffffff', 0.25); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-3, -13); c.quadraticCurveTo(-8, -10, -11, -4); c.moveTo(4, -13); c.quadraticCurveTo(8, -10, 11, -5); c.stroke();
      if (!up && !side) line(c, 0, -14, 0, -6, mixColor(lk.hair, '#000000', 0.3), 1);
    }
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, hr, 0, Math.PI * 2); c.strokeStyle = ol; c.lineWidth = 2; c.stroke();
  if (look === 'magda' && up) { artBall(c, 0, -10, 6, lk.hair, 1.6, ol); ellipse(c, 0, -5, 4.2, 1.5, '#e05a8a', ol, 1); }
  if (look === 'brute') {
    poly(c, [-13, -5, -12.5, -16, -7.5, -12, -5, -20.5, 0, -14, 4, -21.5, 6, -13, 12.5, -17, 13, -5, 0, -9], lk.hair, ol, 1.4);
    if (L) { line(c, -5, -18, -4, -12.5, 'rgba(255,255,255,0.18)', 1); line(c, 4, -19, 4.5, -13, 'rgba(255,255,255,0.18)', 1); }
  }
  if (look === 'shade' && L) {
    // шов на макушке
    c.beginPath(); c.moveTo(2, -14); c.quadraticCurveTo(9, -12, 12.5, -5); c.strokeStyle = 'rgba(20,30,70,0.6)'; c.lineWidth = 1; c.stroke();
    for (const [x, y] of [[4, -13.5], [7.5, -12], [10.5, -8.5]]) line(c, x - 1.2, y - 1.4, x + 1.2, y + 1.4, 'rgba(20,30,70,0.6)', 0.9);
  }
  // --- лицо ---
  const eyeCol = lk.eye || '#141010', hiCol = look === 'horned' ? '#ffc8b8' : '#ffffff';
  const blush = L && !lk.noBlush;
  if (dir === 'down') {
    if (look === 'shade') { circle(c, -5.5, 1, 4.8, 'rgba(20,30,80,0.22)'); circle(c, 5.5, 1, 4.8, 'rgba(20,30,80,0.22)'); }
    if (look === 'horned' && L === 2) { circle(c, -5.5, 1, 6, 'rgba(255,40,30,0.22)'); circle(c, 5.5, 1, 6, 'rgba(255,40,30,0.22)'); }
    artHeroEye(c, -5.5, 1, 1, eyeCol, L, hiCol); artHeroEye(c, 5.5, 1, 1, eyeCol, L, hiCol);
    if (blush) { ellipse(c, -9.6, 7, 2.6, 1.4, 'rgba(240,100,100,0.32)'); ellipse(c, 9.6, 7, 2.6, 1.4, 'rgba(240,100,100,0.32)'); }
    if (look === 'shade') {
      line(c, -3.5, 9, 3.5, 9, ol, 1.4);
      for (let i = -2.5; i <= 2.5; i += 2.5) line(c, i, 7.4, i, 10.6, ol, 1);
    } else if (sh > 0.3 && L) {
      ellipse(c, 0, 10.2, 2.3, 1.2 + sh * 0.7, '#3a1414', ol, 1);
    } else {
      c.beginPath(); c.arc(0, 11, 3.2, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = ol; c.lineWidth = 1.5; c.stroke();
    }
    if (look === 'horned') { poly(c, [-2.4, 8.4, -1.4, 8.6, -1.9, 10.4], '#fff'); poly(c, [2.4, 8.4, 1.4, 8.6, 1.9, 10.4], '#fff'); }
    if (sh > 0) { artTearStreak(c, -5.5, 1, L); artTearStreak(c, 5.5, 1, L); }
  } else if (side) {
    const k = kd;
    if (look === 'horned' && L === 2) circle(c, k * 2.5, 1, 6, 'rgba(255,40,30,0.22)');
    artHeroEye(c, k * 2.5, 1, 0.85, eyeCol, L, hiCol); artHeroEye(c, k * 9.5, 1, 0.6, eyeCol, L, hiCol);
    if (blush) ellipse(c, k * 6.5, 7.5, 2.2, 1.3, 'rgba(240,100,100,0.32)');
    if (look === 'shade') { line(c, k * 4.5, 9.5, k * 9.5, 9.5, ol, 1.3); line(c, k * 6, 8, k * 6, 11, ol, 0.9); line(c, k * 8, 8, k * 8, 11, ol, 0.9); }
    else { c.beginPath(); c.arc(k * 7, 11, 2.4, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = ol; c.lineWidth = 1.4; c.stroke(); }
    if (sh > 0) { artTearStreak(c, k * 2.5, 1, L); artTearStreak(c, k * 9.5, 1, L); }
    ellipse(c, -k * 12.5, 1, 2.2, 3.4, skin, ol, 1.2);
    if (L) ellipse(c, -k * 12.3, 1.3, 0.9, 1.8, 'rgba(120,40,30,0.18)');
  } else {
    ellipse(c, -13.5, 1, 2.2, 3.4, skin, ol, 1.2);
    ellipse(c, 13.5, 1, 2.2, 3.4, skin, ol, 1.2);
  }
  // --- головные уборы и прочее спереди ---
  if (look === 'brute') {
    c.beginPath(); c.arc(0, 1, hr - 0.5, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = '#c42424'; c.lineWidth = 3.6; c.stroke();
    if (L) { c.beginPath(); c.arc(0, 0, hr - 0.5, Math.PI * 1.15, Math.PI * 1.5); c.strokeStyle = 'rgba(255,140,120,0.5)'; c.lineWidth = 1; c.stroke(); }
    if (dir === 'down') { line(c, -9.5, -5, -2.5, -2.2, ol, 2); line(c, 9.5, -5, 2.5, -2.2, ol, 2); }
    else if (side) line(c, kd * 0.5, -4.6, kd * 6.5, -2.4, ol, 2);
    else {
      // узел на затылке
      const fl = Math.sin(t * 0.2) * 1.2;
      poly(c, [-1, -10, -7 + fl, -1, -4 + fl, 0, 1, -9], '#c42424', ol, 1.2);
      poly(c, [1, -10, 6 + fl, 0, 8 + fl, -2, 2, -10], '#c42424', ol, 1.2);
      circle(c, 0, -10, 2.4, '#a81c1c', ol, 1.1);
    }
  }
  if (look === 'outcast') {
    c.save(); c.translate(1, -11); c.rotate(0.08);
    poly(c, [-8.5, 1, 8.5, 1, 6, -11, -6, -11]); artVol(c, '#a81e24', 0, -5, 9, 1.6, ol);
    poly(c, [-8.5, 1, 8.5, 1, 8, -2.5, -8, -2.5], '#5a0c10', ol, 1.2);
    ellipse(c, 0, -11, 6, 1.6, '#c8343a', ol, 1.2);
    const sw = Math.sin(t * 0.12) * 1.2;
    c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(6, -11, 7.5 + sw, -4); c.strokeStyle = '#e6c264'; c.lineWidth = 1.4; c.stroke();
    poly(c, [6.3 + sw, -5, 8.7 + sw, -5, 9.2 + sw, -1, 5.8 + sw, -1], '#e6c264', ol, 0.9);
    c.restore();
  }
  if (look === 'phoenix') {
    const f = Math.sin(t * 0.25) * 1.5, f2 = Math.sin(t * 0.33 + 1) * 1.2;
    for (const [dx, h, col, fx] of [[-6, 10, '#ff8a24', f2], [6, 10, '#ff8a24', -f2], [0, 15, '#ff5a1a', f]]) {
      c.beginPath(); c.moveTo(dx - 4.5, -11); c.quadraticCurveTo(dx - 4 + fx, -11 - h * 0.6, dx + fx * 0.6, -13 - h); c.quadraticCurveTo(dx + 1.5, -11 - h * 0.5, dx + 4.5, -11); c.closePath();
      c.fillStyle = col; c.fill(); c.strokeStyle = ol; c.lineWidth = 1.3; c.stroke();
      if (L) {
        c.beginPath(); c.moveTo(dx - 2.2, -11.5); c.quadraticCurveTo(dx - 1.5 + fx * 0.6, -11 - h * 0.45, dx + fx * 0.4, -12 - h * 0.7); c.quadraticCurveTo(dx + 1, -11 - h * 0.35, dx + 2.2, -11.5); c.closePath();
        c.fillStyle = '#ffd84a'; c.fill();
      }
    }
    if (!L) circle(c, 0, -14, 3, '#ffd84a');
    if (L === 2) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.015 + i / 3) % 1;
        circle(c, Math.sin(ph * 9 + i * 2) * 5 + (i - 1) * 3, -18 - ph * 22, 1.4 * (1 - ph) + 0.2, 'rgba(255,170,60,' + (1 - ph).toFixed(2) + ')');
      }
    }
  }
  // --- косметика от предметов ---
  if (o.horns && look !== 'horned') {
    for (const k of [-1, 1]) { poly(c, [k * 9, -9, k * 14, -20, k * 4, -13]); artVol(c, '#c01c1c', k * 9, -14, 6, 1.4, ol); }
  }
  if (o.hat) {
    c.beginPath(); c.moveTo(-14, -8); c.quadraticCurveTo(-4, -16, 0, -28); c.quadraticCurveTo(4, -35, 11, -33); c.quadraticCurveTo(5, -29, 6, -20); c.lineTo(14, -8); c.closePath();
    artVol(c, '#3a52c4', 0, -18, 14, 1.8, ol);
    ellipse(c, 0, -8.5, 15, 3, '#2a3a96', ol, 1.4);
    artStar4(c, -3, -15, 2.4, '#ffe866'); circle(c, 4, -21, 1.3, '#ffe866'); circle(c, 5, -13, 1, '#ffe866');
  }
  if (o.halo) {
    if (L === 2) ellipse(c, 0, -20, 11, 4, null, 'rgba(255,230,100,0.35)', 7);
    ellipse(c, 0, -20, 11, 4, null, '#8a6a10', 4);
    ellipse(c, 0, -20, 11, 4, null, '#ffe060', 2.2);
  }
  if (o.bow) {
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(k * 7, -19, k * 11, -15); c.quadraticCurveTo(k * 11, -8, 0, -12); c.closePath(); c.fillStyle = '#f07aa0'; c.fill(); c.strokeStyle = ol; c.lineWidth = 1.4; c.stroke(); }
    circle(c, 0, -12, 2.8, '#d84a7a', ol, 1.2);
  }
  artFlat = pf;
}
function drawHero(c, x, y, o) {
  const L = gfxLevel();
  const s = o.scale || 1;
  const dir = o.dir || 'down';
  const skin = o.skin || '#f3d9c9';
  const look = o.look || 'kai';
  const lk = artLook[look] || artLook.kai, ol = lk.out || OUT, t = o.t || 0;
  const side = dir === 'left' || dir === 'right';
  const walk = o.walk || 0, sw = o.moving ? Math.sin(walk) * 3 : 0;
  // покачивание при ходьбе и лёгкое «дыхание» на месте
  const bob = o.moving ? -Math.abs(Math.cos(walk)) * 1.3 : (L && o.t != null ? Math.sin(t * 0.06) * 0.45 : 0);
  // сплющивание головы при выстреле
  const sh = o.shoot > 0 ? Math.min(1, o.shoot / 8) : 0;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  // ярость Буяна
  if (o.rage) {
    if (L) {
      const a0 = c.globalAlpha;
      c.globalAlpha = a0 * (L === 2 ? 0.8 + 0.2 * Math.sin(t * 0.18) : 1);
      artBlit(c, artSprite('rage', 36, 36, g => {
        const gr = g.createRadialGradient(0, 0, 4, 0, 0, 34);
        gr.addColorStop(0, 'rgba(255,40,20,0.4)'); gr.addColorStop(1, 'rgba(255,40,20,0)');
        g.fillStyle = gr; g.fillRect(-36, -36, 72, 72);
      }), 0, -22, 1.0001);
      c.globalAlpha = a0;
    } else circle(c, 0, -22, 30, 'rgba(255,40,20,0.16)');
  }
  // призрачное сияние Потерянного
  if (look === 'lost' && L === 2) { circle(c, 0, -22, 22, 'rgba(210,225,255,0.12)'); circle(c, 0, -24, 17.5, 'rgba(230,240,255,0.14)'); }
  // крылья
  if (o.wings) artHeroWings(c, look === 'horned', t, L, look === 'lost');
  // ноги
  const lx = side ? sw : 0, ly = side ? 0 : sw * 0.5;
  ellipse(c, -4 + lx, -2 + ly, 3.4, 3, skin, ol, 1.5);
  ellipse(c, 4 - lx, -2 - ly, 3.4, 3, skin, ol, 1.5);
  // тело (сдвиг туда и обратно вместо save/restore — так дешевле)
  const bodyY = -9 + bob * 0.6;
  c.translate(0, bodyY);
  c.beginPath(); c.ellipse(0, 0, 7.5, 7, 0, 0, Math.PI * 2);
  c.fillStyle = L === 2 ? artSkinGrad(c, skin, 7.5, 'b') : skin; c.fill();
  if (lk.cloth) artHeroCloth(c, look, lk.cloth, L);
  if (L === 1) artCrescent(c, 7.2, 0.12);
  c.beginPath(); c.ellipse(0, 0, 7.5, 7, 0, 0, Math.PI * 2); c.strokeStyle = ol; c.lineWidth = 1.6; c.stroke();
  c.translate(0, -bodyY);
  // руки
  if (!o.holding) {
    const ay = side ? 0 : sw * 0.3, ax = side ? -sw * 0.4 : 0;
    ellipse(c, -7.5 + ax, -8 + bob * 0.6 - ay, 2.8, 3, skin, ol, 1.3);
    ellipse(c, 7.5 - ax, -8 + bob * 0.6 + ay, 2.8, 3, skin, ol, 1.3);
  }
  // поднятые руки (за головой видна только часть над макушкой)
  if (o.holding) for (const k of [-1, 1]) { line(c, k * 6, -14 + bob, k * 10, -44 + bob, ol, 5.6); line(c, k * 6, -14 + bob, k * 10, -44 + bob, skin, 3); }
  // голова; save/restore нужен только для сплющивания при выстреле
  const squash = sh && L, headY = -25 + bob;
  if (squash) c.save();
  c.translate(0, headY);
  if (squash) { c.translate(0, 10); c.scale(1 + sh * 0.07, 1 - sh * 0.06); c.translate(0, -10); }
  artHeroHead(c, o, look, lk, skin, ol, dir, L, t, sh);
  if (squash) c.restore(); else c.translate(0, -headY);
  // руки, держащие предмет над головой
  if (o.holding) {
    ellipse(c, -10, -45 + bob, 3.2, 3.4, skin, ol, 1.4);
    ellipse(c, 10, -45 + bob, 3.2, 3.4, skin, ol, 1.4);
  }
  c.restore();
}
