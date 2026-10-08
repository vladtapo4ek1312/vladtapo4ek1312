'use strict';
// ============================================================
//  Отрисовка комнаты, дверей, препятствий, интерфейса
// ============================================================

function hrand(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- помощники окружения ----------
// разобрать hex-цвет без кэша (фон запекается со случайными оттенками)
function envRgb(h) {
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// смешать два hex-цвета → hex
function envMix(a, b, t) {
  const A = envRgb(a), B = envRgb(b);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
// осветлить (k > 0) или затемнить (k < 0)
function envShade(h, k) { return k >= 0 ? envMix(h, '#ffffff', k) : envMix(h, '#000000', -k); }
function envRgba(h, a) { const A = envRgb(h); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; }
// оформление комнаты: глава 1..4 или 'devil' / 'angel'
function envChapter(room) {
  if (room && (room.type === 'devil' || room.type === 'angel')) return room.type;
  return STAGES[G.stage] ? STAGES[G.stage].ch : 1;
}

// спрайт в памяти с точкой привязки (ox, oy) в логических пикселях
function envSprite(w, h, ox, oy) { const s = makeCanvas(w, h); s.ox = ox; s.oy = oy; return s; }
// текущее преобразование мира (масштаб + тряска): спрайты выводятся пиксель-в-пиксель,
// без пересэмплирования — это в разы быстрее, чем drawImage с масштабом
const envM = { a: 1, e: 0, f: 0, fast: false };
function envSetM(c) {
  const m = c.getTransform();
  envM.a = m.a; envM.e = m.e; envM.f = m.f;
  envM.fast = m.b === 0 && m.c === 0 && m.a === m.d && Math.abs(m.a - PIXEL_SCALE) < 1e-6;
}
function envBlit(c, s, x, y) {
  const ox = s.ox || 0, oy = s.oy || 0;
  if (!envM.fast) { c.drawImage(s.cv, x - ox, y - oy, s.w, s.h); return; }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(s.cv, Math.round((x - ox) * envM.a + envM.e), Math.round((y - oy) * envM.a + envM.f));
  c.setTransform(envM.a, 0, 0, envM.a, envM.e, envM.f);
}

// ---------- кисти для запекания фона ----------
// мягкое радиальное пятно; col — 'r,g,b'
function envSoft(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
// слой низкого разрешения (¼) для мягких пятен пола: градиенты в 16 раз дешевле,
// затем один раз растягивается на пол со сглаживанием
let envLowCv = null;
function envLowLayer(c, fn) {
  const k = 0.25;
  if (!envLowCv) { envLowCv = document.createElement('canvas'); envLowCv.width = Math.ceil(RW * k); envLowCv.height = Math.ceil(RH * k); }
  const lc = envLowCv.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, envLowCv.width, envLowCv.height);
  lc.setTransform(k, 0, 0, k, -RX * k, -RY * k);
  fn(lc);
  c.drawImage(envLowCv, RX, RY, RW, RH);
}
// неровное пятно из нескольких эллипсов одной заливкой (без двойной прозрачности)
function envBlob(c, rng, x, y, r, fill, n = 5) {
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rng.next() * Math.PI * 2, d = rng.next() * r * 0.6;
    const ex = x + Math.cos(a) * d, ey = y + Math.sin(a) * d * 0.7, rx = r * (0.35 + rng.next() * 0.4);
    c.moveTo(ex + rx, ey);
    c.ellipse(ex, ey, rx, rx * (0.55 + rng.next() * 0.3), 0, 0, Math.PI * 2);
  }
  c.fillStyle = fill; c.fill();
}
// камешек с тенью и бликом
function envPebble(c, x, y, r, col) {
  ellipse(c, x + r * 0.25, y + r * 0.35, r * 1.05, r * 0.7, 'rgba(0,0,0,0.3)');
  ellipse(c, x, y, r, r * 0.72, col);
  ellipse(c, x - r * 0.3, y - r * 0.28, r * 0.42, r * 0.26, 'rgba(255,255,255,0.22)');
}
function envPolyline(c, pts, dx, dy) {
  c.beginPath(); c.moveTo(pts[0] + dx, pts[1] + dy);
  for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k] + dx, pts[k + 1] + dy);
}
function envCrackPts(rng, x, y, a, len) {
  const pts = [x, y], n = 3 + rng.int(0, 3);
  for (let k = 0; k < n; k++) { a += (rng.next() - 0.5) * 1.1; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push(x, y); }
  return pts;
}
// трещина: тёмная линия со светлой кромкой и ответвлением
function envCrack(c, rng, x, y, a, len, w, depth = 0) {
  const pts = envCrackPts(rng, x, y, a, len);
  c.lineCap = 'round'; c.lineJoin = 'round';
  envPolyline(c, pts, 0.8, 1.1); c.strokeStyle = 'rgba(255,240,220,0.09)'; c.lineWidth = w; c.stroke();
  envPolyline(c, pts, 0, 0); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = w; c.stroke();
  if (depth < 1 && rng.chance(0.7)) {
    const k = 2 * rng.int(1, pts.length / 2 - 1);
    envCrack(c, rng, pts[k], pts[k + 1], a + (rng.chance(0.5) ? 1 : -1) * (0.6 + rng.next() * 0.6), len * 0.45, w * 0.7, depth + 1);
  }
}
// светящаяся (адская) трещина
function envGlowCrack(c, rng, x, y, a, len) {
  const pts = envCrackPts(rng, x, y, a, len);
  c.lineCap = 'round'; c.lineJoin = 'round';
  envPolyline(c, pts, 0.8, 1.1); c.strokeStyle = 'rgba(255,240,220,0.08)'; c.lineWidth = 1.6; c.stroke();
  envPolyline(c, pts, 0, 0); c.strokeStyle = 'rgba(255,30,10,0.12)'; c.lineWidth = 6; c.stroke();
  c.strokeStyle = 'rgba(40,0,0,0.7)'; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = 'rgba(255,90,30,0.6)'; c.lineWidth = 0.9; c.stroke();
}
// кровеносный сосуд: тёмный жгут со светлой серединкой и ветками
function envVein(c, rng, x, y, a, len, w, lvl, depth) {
  const pts = [x, y], n = 5;
  for (let k = 0; k < n; k++) { a += (rng.next() - 0.5) * 0.9; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push(x, y); }
  const path = () => {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length - 2; k += 2) c.quadraticCurveTo(pts[k], pts[k + 1], (pts[k] + pts[k + 2]) / 2, (pts[k + 1] + pts[k + 3]) / 2);
    c.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  path(); c.strokeStyle = 'rgba(55,0,12,0.55)'; c.lineWidth = w; c.stroke();
  if (lvl) { c.strokeStyle = 'rgba(200,60,85,0.5)'; c.lineWidth = w * 0.38; c.stroke(); }
  if (depth < 2) for (let b = 0; b < 2; b++) {
    if (!rng.chance(0.6)) continue;
    const k = 2 * rng.int(1, n - 1);
    envVein(c, rng, pts[k], pts[k + 1], a + (rng.chance(0.5) ? 1 : -1) * (0.7 + rng.next() * 0.5), len * 0.5, w * 0.65, lvl, depth + 1);
  }
}

// ---------- полы по главам ----------
function envFloor(c, rng, room, pal, ch, lvl) {
  if (ch === 3 || ch === 'devil') envFloorSlabs(c, rng, pal, lvl, ch === 'devil');
  else if (ch === 'angel') envFloorMarble(c, rng, pal, lvl);
  else { c.fillStyle = pal.floor; c.fillRect(RX, RY, RW, RH); }
  // крупные пятна света и тени (мягкие — рисуются в слой низкого разрешения)
  const nb = lvl ? (ch === 'angel' ? 14 : 48) : 10;
  if (lvl) envLowLayer(c, lc => {
    for (let i = 0; i < nb; i++) {
      const x = RX + rng.next() * RW, y = RY + rng.next() * RH, r = 24 + rng.next() * 80;
      const dark = rng.chance(0.6);
      envSoft(lc, x, y, r, dark ? '0,0,0' : '255,240,220', dark ? (ch === 'angel' ? 0.05 : 0.14) : 0.05);
    }
    if (ch === 4) for (let i = 0; i < 46; i++) {
      // бугры плоти
      const x = envRX(rng), y = envRY(rng), r = 16 + rng.next() * 34;
      envSoft(lc, x + r * 0.25, y + r * 0.3, r * 1.1, '40,0,6', 0.16);
      envSoft(lc, x - r * 0.15, y - r * 0.2, r * 0.8, '255,150,150', 0.08);
    }
  });
  else for (let i = 0; i < nb; i++) {
    const x = RX + rng.next() * RW, y = RY + rng.next() * RH, r = 24 + rng.next() * 80;
    ellipse(c, x, y, r * 0.7, r * 0.5, rng.chance(0.6) ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.025)');
  }
  // мелкая крошка
  const ns = ch === 'angel' ? (lvl ? 160 : 40) : lvl ? 700 : 160;
  for (let i = 0; i < ns; i++) {
    c.fillStyle = ch === 'angel' ? 'rgba(90,95,120,0.08)' : rng.chance(0.55) ? 'rgba(0,0,0,0.17)' : 'rgba(255,235,210,0.06)';
    c.fillRect(RX + rng.next() * RW, RY + rng.next() * RH, 1 + rng.next() * 2, 1 + rng.next() * 1.6);
  }
  if (ch === 1) envFloorDirt(c, rng, pal, lvl);
  else if (ch === 2) envFloorCave(c, rng, pal, lvl);
  else if (ch === 4) envFloorFlesh(c, rng, pal, lvl);
}
const envRX = rng => RX + rng.next() * RW;
const envRY = rng => RY + rng.next() * RH;

// Подвал: утоптанная земля, галька, сырые пятна
function envFloorDirt(c, rng, pal, lvl) {
  for (let i = 0; i < (lvl ? 8 : 3); i++) envBlob(c, rng, envRX(rng), envRY(rng), 30 + rng.next() * 50, 'rgba(25,12,4,' + (0.08 + rng.next() * 0.1).toFixed(3) + ')', 6);
  if (lvl) for (let i = 0; i < 5; i++) envBlob(c, rng, envRX(rng), envRY(rng), 40 + rng.next() * 50, 'rgba(255,225,180,0.035)', 5);
  for (let i = 0, n = lvl ? 60 : 18; i < n; i++) {
    const x = envRX(rng), y = envRY(rng), r = 1.4 + rng.next() * (rng.chance(0.15) ? 5 : 2.4);
    if (lvl) envPebble(c, x, y, r, envMix(pal.rock2, pal.floor, rng.next() * 0.6));
    else ellipse(c, x, y, r, r * 0.7, 'rgba(0,0,0,0.18)');
  }
  if (lvl) for (let i = 0; i < 6; i++) envCrack(c, rng, envRX(rng), envRY(rng), rng.next() * 6.3, 30 + rng.next() * 40, 1.2);
}

// Пещеры: плиты породы, сеть трещин, гравий
function envFloorCave(c, rng, pal, lvl) {
  for (let i = 0; i < (lvl ? 14 : 5); i++) {
    const x = envRX(rng), y = envRY(rng), r = 30 + rng.next() * 50, n = 6 + rng.int(0, 3), pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rng.next() * 0.4, rr = r * (0.7 + rng.next() * 0.4); pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); }
    const light = rng.chance(0.5);
    poly(c, pts, light ? 'rgba(255,250,235,0.045)' : 'rgba(0,0,0,0.08)', lvl ? (light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.05)') : null, 1.2);
  }
  for (let i = 0; i < (lvl ? 10 : 4); i++) envCrack(c, rng, envRX(rng), envRY(rng), rng.next() * 6.3, 40 + rng.next() * 70, lvl ? 1.6 : 1.2);
  if (lvl) for (let i = 0; i < 22; i++) {
    const x0 = envRX(rng), y0 = envRY(rng);
    for (let k = 0, n = 5 + rng.int(0, 10); k < n; k++) envPebble(c, x0 + (rng.next() - 0.5) * 34, y0 + (rng.next() - 0.5) * 20, 1 + rng.next() * 2.4, envMix(pal.rock, pal.floor, 0.3 + rng.next() * 0.5));
  }
}

// Глубины (и ад): крупные каменные плиты со швами
function envFloorSlabs(c, rng, pal, lvl, hell) {
  c.fillStyle = envShade(pal.floor, -0.45); c.fillRect(RX, RY, RW, RH);
  const sw = 104, sh = 78;
  let row = 0;
  for (let y = RY - rng.int(0, 30); y < RY + RH; y += sh, row++) {
    for (let x = RX - (row % 2 ? sw / 2 : 0) - rng.int(0, 12); x < RX + RW; x += sw) {
      rrect(c, x + 2, y + 2, sw - 4, sh - 4, 3, envMix(pal.floor, rng.chance(0.5) ? pal.floor2 : envShade(pal.floor, 0.07), rng.next()));
      if (!lvl) continue;
      line(c, x + 5, y + 3.6, x + sw - 6, y + 3.6, 'rgba(255,255,255,0.08)', 1.4);
      line(c, x + 3.6, y + 5, x + 3.6, y + sh - 6, 'rgba(255,255,255,0.05)', 1.4);
      line(c, x + 6, y + sh - 3.6, x + sw - 4, y + sh - 3.6, 'rgba(0,0,0,0.32)', 2);
      line(c, x + sw - 3.6, y + 6, x + sw - 3.6, y + sh - 4, 'rgba(0,0,0,0.24)', 2);
      for (let k = 0; k < 3; k++) ellipse(c, x + 10 + rng.next() * (sw - 20), y + 10 + rng.next() * (sh - 20), 6 + rng.next() * 14, 4 + rng.next() * 8, rng.chance(0.6) ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.035)');
      if (rng.chance(0.28)) envCrack(c, rng, x + 10 + rng.next() * (sw - 20), y + 8 + rng.next() * (sh - 16), rng.next() * 6.3, 20 + rng.next() * 40, 1.3);
      if (rng.chance(0.15)) {
        const L = rng.chance(0.5), U = rng.chance(0.5);
        const px = L ? x + 2 : x + sw - 2, py = U ? y + 2 : y + sh - 2, dx = L ? 1 : -1, dy = U ? 1 : -1;
        poly(c, [px, py, px + dx * (8 + rng.next() * 8), py, px, py + dy * (6 + rng.next() * 8)], envShade(pal.floor, -0.45));
      }
      if (hell && rng.chance(0.22)) envGlowCrack(c, rng, x + 12 + rng.next() * (sw - 24), y + 10 + rng.next() * (sh - 20), rng.next() * 6.3, 24 + rng.next() * 30);
    }
  }
}

// Утроба: влажная плоть, бугры, складки, вены, блики
function envFloorFlesh(c, rng, pal, lvl) {
  if (lvl) {
    for (let i = 0; i < 16; i++) {
      const x = envRX(rng), y = envRY(rng), a = rng.next() * 6.3, l = 30 + rng.next() * 60;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l * 0.6, mx = (x + x2) / 2 + (rng.next() - 0.5) * 30, my = (y + y2) / 2 + (rng.next() - 0.5) * 20;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y + 1.6); c.quadraticCurveTo(mx, my + 1.6, x2, y2 + 1.6); c.strokeStyle = 'rgba(255,140,140,0.12)'; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.strokeStyle = 'rgba(40,0,5,0.4)'; c.lineWidth = 1.8; c.stroke();
    }
  }
  for (let i = 0; i < (lvl ? 14 : 9); i++) envVein(c, rng, envRX(rng), envRY(rng), rng.next() * 6.3, 60 + rng.next() * 90, lvl ? 3.2 : 2.2, lvl, lvl ? 0 : 2);
  if (!lvl) return;
  for (let i = 0; i < 26; i++) {
    const x = envRX(rng), y = envRY(rng), r = 1.5 + rng.next() * 2.5;
    ellipse(c, x, y + r * 0.35, r * 1.25, r * 0.85, 'rgba(255,150,150,0.13)');
    ellipse(c, x, y, r, r * 0.7, 'rgba(30,0,4,0.5)');
  }
  for (let i = 0; i < 60; i++) {
    const rx = 1.5 + rng.next() * 6;
    ellipse(c, envRX(rng), envRY(rng), rx, rx * (0.25 + rng.next() * 0.25), 'rgba(255,225,225,' + (0.08 + rng.next() * 0.18).toFixed(3) + ')', null, 0, -0.5 + rng.next() * 0.4);
  }
}

// Ангельская комната: мраморные плиты с прожилками
function envFloorMarble(c, rng, pal, lvl) {
  c.fillStyle = envShade(pal.floor2, -0.14); c.fillRect(RX, RY, RW, RH);
  const s = 78, x0 = RX + RW / 2 - s / 2 - Math.ceil((RW / 2 - s / 2) / s) * s, y0 = RY + RH / 2 - s / 2 - Math.ceil((RH / 2 - s / 2) / s) * s;
  for (let j = 0, y = y0; y < RY + RH; j++, y += s) for (let i = 0, x = x0; x < RX + RW; i++, x += s) {
    c.fillStyle = (i + j) & 1 ? pal.floor : envMix(pal.floor, '#ffffff', 0.3);
    c.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
    if (!lvl) continue;
    for (let k = 0; k < 2; k++) {
      let vx = x + rng.next() * s, vy = y + rng.next() * s, a = rng.next() * 6.3;
      c.beginPath(); c.moveTo(vx, vy);
      for (let q = 0; q < 4; q++) { a += (rng.next() - 0.5) * 0.9; const nx = vx + Math.cos(a) * 14, ny = vy + Math.sin(a) * 14; c.quadraticCurveTo(vx + (rng.next() - 0.5) * 8, vy + (rng.next() - 0.5) * 8, nx, ny); vx = nx; vy = ny; }
      c.strokeStyle = 'rgba(110,115,135,' + (0.1 + rng.next() * 0.12).toFixed(3) + ')'; c.lineWidth = 0.6 + rng.next() * 0.9; c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x + 1.5, y + 1.5, s - 3, 1.2);
    c.fillStyle = 'rgba(80,85,100,0.18)'; c.fillRect(x + 1.5, y + s - 2.7, s - 3, 1.2);
  }
}

// ---------- особые комнаты ----------
function envRug(c, cx, cy, lvl) {
  const w = T * 9.2, h = T * 1.9, x = cx - w / 2, y = cy - T * 0.9;
  if (!lvl) {
    rrect(c, x, y, w, h, 6, '#5a1e22', '#2a0a0c', 3);
    c.strokeStyle = 'rgba(230,190,90,0.5)'; c.lineWidth = 2; c.strokeRect(x + T * 0.2, y + T * 0.15, w - T * 0.4, h - T * 0.3);
    return;
  }
  rrect(c, x + 2, y + 5, w, h, 6, 'rgba(0,0,0,0.4)');
  for (let k = 0; k <= 12; k++) {
    const yy = y + 7 + k * (h - 14) / 12;
    line(c, x - 6, yy + 1, x + 2, yy, '#cdb88a', 2);
    line(c, x + w - 2, yy, x + w + 6, yy + 1, '#cdb88a', 2);
  }
  rrect(c, x, y, w, h, 6, '#5e1a20', '#24080a', 3);
  rrect(c, x + 5, y + 5, w - 10, h - 10, 4, '#2e0c12');
  c.strokeStyle = '#c9a048'; c.lineWidth = 1.6; c.strokeRect(x + 7, y + 7, w - 14, h - 14);
  const m = Math.floor((w - 24) / 14);
  for (let k = 0; k <= m; k++) {
    const dx = x + 12 + k * (w - 24) / m;
    for (const dy of [y + 10.5, y + h - 10.5]) poly(c, [dx, dy - 2.6, dx + 2.6, dy, dx, dy + 2.6, dx - 2.6, dy], '#b8862e');
  }
  rrect(c, x + 15, y + 15, w - 30, h - 30, 3, '#7a2228');
  c.strokeStyle = 'rgba(230,190,90,0.7)'; c.lineWidth = 1.2; c.strokeRect(x + 15, y + 15, w - 30, h - 30);
  for (let k = -1; k <= 1; k++) {
    const mx = cx + k * w * 0.3, my = y + h / 2, rw = k ? 26 : 46, rh = h / 2 - 20;
    poly(c, [mx, my - rh, mx + rw, my, mx, my + rh, mx - rw, my], '#4c1218', 'rgba(230,190,90,0.75)', 1.4);
    poly(c, [mx, my - rh * 0.5, mx + rw * 0.5, my, mx, my + rh * 0.5, mx - rw * 0.5, my], '#9a3a2a');
    circle(c, mx, my, 2.2, '#e0b860');
  }
  c.fillStyle = 'rgba(0,0,0,0.07)';
  for (let yy = y + 2; yy < y + h - 2; yy += 3) c.fillRect(x + 2, yy, w - 4, 1);
  envSoft(c, cx + 40, cy, 70, '255,220,180', 0.06);
}

function envPentagram(c, cx, cy, lvl) {
  c.save(); c.translate(cx, cy);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const star = () => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 113, Math.sin(a) * 113); } };
  const ring = r => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); };
  if (lvl) {
    envSoft(c, 0, 0, 160, '150,0,0', 0.2);
    for (const [w, a] of [[14, 0.05], [8, 0.1], [4, 0.25]]) {
      c.strokeStyle = 'rgba(255,30,20,' + a + ')'; c.lineWidth = w;
      star(); c.stroke(); ring(120); c.stroke(); ring(133); c.stroke();
    }
  }
  c.strokeStyle = lvl ? 'rgba(200,22,22,0.9)' : 'rgba(150,10,10,0.55)'; c.lineWidth = lvl ? 2.4 : 3;
  star(); c.stroke(); ring(120); c.stroke();
  if (lvl) {
    ring(133); c.stroke();
    c.strokeStyle = 'rgba(255,150,110,0.6)'; c.lineWidth = 0.9;
    star(); c.stroke(); ring(120); c.stroke();
    // руны между кольцами
    c.strokeStyle = 'rgba(230,40,30,0.85)'; c.lineWidth = 1.4;
    for (let i = 0; i < 18; i++) {
      c.save(); c.rotate(i / 18 * Math.PI * 2); c.translate(0, -126.5);
      c.beginPath();
      const v = i % 3;
      if (v === 0) { c.moveTo(-3, 3); c.lineTo(0, -3); c.lineTo(3, 3); c.moveTo(-2, 0.5); c.lineTo(2, 0.5); }
      else if (v === 1) { c.moveTo(-2.5, -3); c.lineTo(-2.5, 3); c.lineTo(2.5, -1); c.moveTo(1, 3); c.lineTo(2.5, 3); }
      else { c.moveTo(0, -3.2); c.lineTo(0, 3.2); c.moveTo(-3, -1); c.lineTo(3, 1.5); }
      c.stroke(); c.restore();
    }
  }
  c.restore();
}

function envHolyFloor(c, cx, cy, lvl) {
  envSoft(c, cx, cy, 230, '255,255,230', 0.5);
  if (!lvl) return;
  const sx = cx, sy = RY + T * 0.6;
  for (let k = -2; k <= 2; k++) {
    const a = Math.PI / 2 + k * 0.3;
    const g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * 320, sy + Math.sin(a) * 320);
    g.addColorStop(0, 'rgba(255,250,215,0.2)'); g.addColorStop(1, 'rgba(255,250,215,0)');
    poly(c, [sx, sy, sx + Math.cos(a - 0.08) * 330, sy + Math.sin(a - 0.08) * 330, sx + Math.cos(a + 0.08) * 330, sy + Math.sin(a + 0.08) * 330], g);
  }
  circle(c, cx, cy + 10, 78, null, 'rgba(205,165,70,0.5)', 2.5);
  circle(c, cx, cy + 10, 86, null, 'rgba(205,165,70,0.28)', 1.2);
}

// ---------- ямы и шипы ----------
function envPits(c, room, pal, lvl) {
  const pit = (col, r) => { const t = room.tile(col, r); return !!t && t.t === 'x'; };
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    if (room.grid[r * COLS + col].t === 's') envSpikes(c, RX + col * T, RY + r * T, lvl);
  }
  // соседние клетки ям заливаются одним контуром — без светлых швов на дробном масштабе
  const fillRects = (fill, test, rect) => {
    c.beginPath();
    let any = false;
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (pit(col, r) && test(col, r)) { rect(RX + col * T, RY + r * T); any = true; }
    if (any) { c.fillStyle = fill; c.fill(); }
  };
  fillRects(pal.pit, () => true, (x, y) => c.rect(x, y, T, T));
  // верхняя внутренняя стенка (видна сверху), по рядам; на среднем/высоком — с неровным низом
  const hh = lvl ? 24 : 18;
  for (let r = 0; r < ROWS; r++) {
    const y = RY + r * T, g = c.createLinearGradient(0, y, 0, y + hh + 4);
    g.addColorStop(0, pal.rock2); g.addColorStop(0.75, envMix(pal.rock2, pal.pit, 0.8)); g.addColorStop(1, pal.pit);
    fillRects(g, (col, rr) => rr === r && !pit(col, r - 1), (x, yy) => {
      if (!lvl) { c.rect(x, yy, T, hh); return; }
      const col = Math.round((x - RX) / T);
      c.moveTo(x, yy); c.lineTo(x + T, yy);
      for (let k = 6; k >= 0; k--) c.lineTo(x + k * T / 6, yy + hh - 3 + hrand(col * 6 + k, r * 31 + 7) * 7);
      c.closePath();
    });
  }
  // боковые тени, по столбцам
  for (let col = 0; col < COLS; col++) {
    for (const dc of [-1, 1]) {
      const x0 = RX + col * T + (dc < 0 ? 0 : T), x1 = x0 - dc * (lvl ? 10 : 3);
      let fill = 'rgba(0,0,0,0.6)';
      if (lvl) { fill = c.createLinearGradient(x0, 0, x1, 0); fill.addColorStop(0, 'rgba(0,0,0,0.7)'); fill.addColorStop(1, 'rgba(0,0,0,0)'); }
      fillRects(fill, (cc, r) => cc === col && !pit(col + dc, r), (x, y) => c.rect(Math.min(x0, x1), y, Math.abs(x1 - x0), T));
    }
  }
  fillRects('rgba(0,0,0,0.6)', (col, r) => !pit(col, r + 1), (x, y) => c.rect(x, y + T - 3, T, 3));
  if (!lvl) return;
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    if (!pit(col, r) || pit(col, r - 1)) continue;
    const x = RX + col * T, y = RY + r * T;
    // слои породы на стенке
    for (let k = 0; k < 2; k++) {
      const yy = y + 5 + k * 6 + hrand(col * 7 + r, k) * 2;
      c.beginPath(); c.moveTo(x, yy);
      for (let s = 1; s <= 4; s++) c.lineTo(x + s * T / 4, yy + (hrand(col + s, r + k * 9) - 0.5) * 3);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, T, 1.5);
  }
  // неровная кромка ям
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    if (!pit(col, r)) continue;
    const x = RX + col * T, y = RY + r * T;
    for (const [dc, dr, ax, ay, bx, by, nx, ny] of [[0, -1, x, y, x + T, y, 0, -1], [0, 1, x, y + T, x + T, y + T, 0, 1], [-1, 0, x, y, x, y + T, -1, 0], [1, 0, x + T, y, x + T, y + T, 1, 0]]) {
      const n = room.tile(col + dc, r + dr);
      if (!n || n.t === 'x') continue;
      // рваный край пола, нависающий над ямой
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const f = s / 8, j = s === 0 || s === 8 ? 0 : 0.6 + hrand(col * 17 + s, r * 13 + dc * 3 + dr * 5) * 3.4;
        pts.push(ax + (bx - ax) * f - nx * j, ay + (by - ay) * f - ny * j);
      }
      envPolyline(c, pts, 0, 0);
      c.lineTo(bx + nx * 2, by + ny * 2); c.lineTo(ax + nx * 2, ay + ny * 2); c.closePath();
      c.fillStyle = envShade(pal.floor, 0.03); c.fill();
      envPolyline(c, pts, 0, 0); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.5; c.stroke();
      envPolyline(c, pts, nx * 1.4, ny * 1.4); c.strokeStyle = 'rgba(255,240,220,0.13)'; c.lineWidth = 1.2; c.stroke();
      // редкие камни на кромке
      for (let s = 0; s < 2; s++) {
        if (hrand(col * 5 + s, r * 9 + dc + dr * 3) > 0.45) continue;
        const f = 0.15 + (s * 0.5 + hrand(col + s * 3, r * 7 + dc) * 0.35), rr = 1.6 + hrand(col + s * 7, r + dc * 5 + dr) * 2.6;
        const sx = ax + (bx - ax) * f + nx * rr * 0.2, sy = ay + (by - ay) * f + ny * rr * 0.2;
        ellipse(c, sx - nx * 1.5, sy - ny * 1.5 + 1, rr * 1.15, rr * 0.8, 'rgba(0,0,0,0.45)');
        ellipse(c, sx, sy, rr, rr * 0.72, envMix(pal.rock2, pal.floor, 0.35), 'rgba(0,0,0,0.35)', 0.8);
        ellipse(c, sx - rr * 0.3, sy - rr * 0.28, rr * 0.42, rr * 0.25, 'rgba(255,255,255,0.2)');
      }
    }
  }
}

function envSpikes(c, x, y, lvl) {
  const SP = [[0.28, 0.32], [0.72, 0.32], [0.5, 0.55], [0.28, 0.78], [0.72, 0.78]];
  if (!lvl) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 4, y + 4, T - 8, T - 8);
    for (const [sx, sy] of SP) {
      const px = x + sx * T, py = y + sy * T;
      poly(c, [px - 6, py + 4, px + 6, py + 4, px, py - 12], '#b8bcc4', '#2a2a30', 1.5);
      poly(c, [px - 1, py + 3, px + 4, py + 3, px, py - 9], '#e8ecf4');
    }
    return;
  }
  rrect(c, x + 4, y + 4, T - 8, T - 8, 5, '#2c2c33', '#141418', 2);
  rrect(c, x + 6.5, y + 6.5, T - 13, T - 13, 4, null, 'rgba(255,255,255,0.08)', 1.2);
  for (const [dx, dy] of [[8, 8], [T - 8, 8], [8, T - 8], [T - 8, T - 8]]) { circle(c, x + dx, y + dy, 1.6, '#55565e'); circle(c, x + dx - 0.4, y + dy - 0.4, 0.6, 'rgba(255,255,255,0.5)'); }
  for (const [sx, sy] of SP) {
    const px = x + sx * T, py = y + sy * T;
    ellipse(c, px, py + 4, 6.5, 2.6, '#0c0c10');
    ellipse(c, px + 2.5, py + 4.5, 5, 2, 'rgba(0,0,0,0.45)');
    poly(c, [px - 6, py + 4, px, py + 5.5, px, py - 13], '#dfe3ea');
    poly(c, [px, py + 5.5, px + 6, py + 4, px, py - 13], '#7e828d');
    poly(c, [px - 6, py + 4, px, py + 5.5, px + 6, py + 4, px, py - 13], null, '#1c1c22', 1.2);
    line(c, px - 1.6, py + 1.5, px - 0.3, py - 9, 'rgba(255,255,255,0.75)', 1);
  }
}

// ---------- мелочи на полу ----------
function envBone(c, x, y, a, s) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  ellipse(c, 1, 3.5, 10, 2.5, 'rgba(0,0,0,0.25)');
  line(c, -7, 0, 7, 0, '#3a2a20', 4.6);
  for (const e of [-7, 7]) { circle(c, e, -1.6, 2.6, '#3a2a20'); circle(c, e, 1.6, 2.6, '#3a2a20'); }
  line(c, -7, 0, 7, 0, '#dcd2b8', 2.6);
  for (const e of [-7, 7]) { circle(c, e, -1.6, 1.8, '#e2d8be'); circle(c, e, 1.6, 1.8, '#c4b99e'); }
  line(c, -5, -0.6, 5, -0.6, 'rgba(255,255,255,0.45)', 0.8);
  c.restore();
}
function envSkull(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ellipse(c, 1.5, 7.5, 9, 3, 'rgba(0,0,0,0.3)');
  rrect(c, -4.5, 1, 9, 6, 2, '#cfc5aa', '#3a2a20', 1.2);
  circle(c, 0, -2, 7, '#e2d8bc', '#3a2a20', 1.2);
  ellipse(c, 1.5, 0, 5, 3.5, 'rgba(120,100,70,0.25)');
  ellipse(c, -2.6, -1.5, 2, 2.3, '#2a1c14'); ellipse(c, 2.6, -1.5, 2, 2.3, '#2a1c14');
  poly(c, [0, 1, -1, 3, 1, 3], '#2a1c14');
  for (let k = -1; k <= 1; k++) line(c, k * 2, 4.5, k * 2, 6.5, '#7a6a50', 0.8);
  ellipse(c, -2.5, -6, 2.5, 1.2, 'rgba(255,255,255,0.45)', null, 0, -0.4);
  c.restore();
}
// паутина в углу (sx, sy — направление в комнату)
function envCobweb(c, rng, x, y, sx, sy, R) {
  const n = 5, th = [];
  for (let k = 0; k < n; k++) {
    const a = (0.06 + k / (n - 1) * 0.88) * Math.PI / 2 + (rng.next() - 0.5) * 0.12, l = R * (0.75 + rng.next() * 0.35);
    th.push([Math.cos(a) * sx, Math.sin(a) * sy, l]);
  }
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(230,230,235,0.26)'; c.lineWidth = 0.9;
  c.beginPath();
  for (const [dx, dy, l] of th) { c.moveTo(x, y); c.lineTo(x + dx * l, y + dy * l); }
  c.stroke();
  c.strokeStyle = 'rgba(225,225,230,0.2)'; c.lineWidth = 0.8;
  c.beginPath();
  for (let j = 1; j <= 4; j++) {
    const f = j / 5 + (rng.next() - 0.5) * 0.04;
    for (let k = 0; k < n - 1; k++) {
      const [ax, ay, al] = th[k], [bx, by, bl] = th[k + 1];
      const px = x + ax * al * f, py = y + ay * al * f, qx = x + bx * bl * f, qy = y + by * bl * f;
      c.moveTo(px, py); c.quadraticCurveTo((px + qx) / 2 * 0.85 + x * 0.15, (py + qy) / 2 * 0.85 + y * 0.15, qx, qy);
    }
  }
  c.stroke();
}
function envShroom(c, x, y, s) {
  ellipse(c, x + 1, y + 1, 5 * s, 1.8 * s, 'rgba(0,0,0,0.3)');
  rrect(c, x - 1.2 * s, y - 5 * s, 2.4 * s, 5 * s, 1, '#d8cfb8');
  c.beginPath(); c.ellipse(x, y - 5 * s, 4.5 * s, 3.2 * s, 0, Math.PI, 0); c.closePath();
  c.fillStyle = '#9a6a4a'; c.fill(); c.strokeStyle = '#3a2a20'; c.lineWidth = 0.9; c.stroke();
  circle(c, x - 1.5 * s, y - 6.5 * s, 0.8 * s, 'rgba(255,240,220,0.7)');
  circle(c, x + 1.8 * s, y - 6 * s, 0.6 * s, 'rgba(255,240,220,0.5)');
}
function envChain(c, x, y, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  for (let k = -2; k <= 2; k++) {
    const flat = k & 1;
    ellipse(c, k * 6 + 0.8, 1, 4.2, flat ? 1.4 : 2.6, null, 'rgba(0,0,0,0.35)', 1.8);
    ellipse(c, k * 6, 0, 4.2, flat ? 1.4 : 2.6, null, '#6a6e78', 1.6);
    if (!flat) ellipse(c, k * 6 - 1, -1.2, 2.2, 0.8, null, 'rgba(255,255,255,0.35)', 0.8);
  }
  c.restore();
}
function envTooth(c, x, y, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  ellipse(c, 1, 4, 4, 1.4, 'rgba(0,0,0,0.3)');
  c.beginPath(); c.moveTo(-3.5, -3); c.quadraticCurveTo(0, -6, 3.5, -3); c.lineTo(2.6, 2); c.lineTo(1.2, 4); c.lineTo(0, 1.5); c.lineTo(-1.2, 4); c.lineTo(-2.6, 2); c.closePath();
  c.fillStyle = '#f0e8d6'; c.fill(); c.strokeStyle = '#4a2a20'; c.lineWidth = 0.9; c.stroke();
  line(c, -1.8, -3.2, -1.2, 0, 'rgba(255,255,255,0.8)', 0.8);
  c.restore();
}
function envPuddle(c, rng, x, y, r, col, hi) {
  envBlob(c, rng, x, y, r, col, 4);
  ellipse(c, x - r * 0.2, y - r * 0.15, r * 0.35, r * 0.08, hi, null, 0, -0.15);
}
const envPropKinds = {
  1: ['bone', 'bones', 'pebbles', 'stain', 'crack', 'skull'],
  2: ['pebbles', 'crack', 'puddle', 'shroom', 'shroom', 'bone'],
  3: ['bone', 'skull', 'crack', 'chain', 'pebbles', 'stain'],
  4: ['puddle', 'puddle', 'tooth', 'pores'],
  devil: ['bone', 'skull', 'bones', 'crack'],
  angel: [],
};
function envProps(c, rng, room, pal, ch) {
  const kinds = envPropKinds[ch] || envPropKinds[1];
  if (ch !== 4 && ch !== 'angel') {
    for (const [x, y, sx, sy] of [[RX, RY, 1, 1], [RX + RW, RY, -1, 1], [RX, RY + RH, 1, -1], [RX + RW, RY + RH, -1, -1]]) {
      if (rng.chance(0.45)) envCobweb(c, rng, x, y, sx, sy, 34 + rng.next() * 30);
    }
  }
  if (!kinds.length) return;
  const n = room.type === 'shop' ? 1 : room.type === 'boss' ? 4 : 2 + rng.int(0, 4);
  for (let i = 0; i < n; i++) {
    const col = rng.int(0, COLS - 1), r = rng.int(0, ROWS - 1), kind = rng.pick(kinds);
    const x = RX + col * T + 10 + rng.next() * (T - 20), y = RY + r * T + 10 + rng.next() * (T - 20);
    const t = room.tile(col, r);
    if (!t || t.t === 'x' || t.t === 's') continue;
    switch (kind) {
      case 'bone': envBone(c, x, y, rng.next() * Math.PI, 0.8 + rng.next() * 0.4); break;
      case 'bones': for (let k = 0; k < 3; k++) envBone(c, x + (rng.next() - 0.5) * 22, y + (rng.next() - 0.5) * 14, rng.next() * Math.PI, 0.6 + rng.next() * 0.3); break;
      case 'skull': envSkull(c, x, y, 0.9 + rng.next() * 0.3); break;
      case 'pebbles': for (let k = 0, m = 4 + rng.int(0, 5); k < m; k++) envPebble(c, x + (rng.next() - 0.5) * 26, y + (rng.next() - 0.5) * 16, 1.5 + rng.next() * 2.5, envMix(pal.rock, pal.rock2, rng.next())); break;
      case 'stain': envBlob(c, rng, x, y, 14 + rng.next() * 16, 'rgba(20,10,4,0.16)', 5); break;
      case 'crack': envCrack(c, rng, x, y, rng.next() * 6.3, 26 + rng.next() * 30, 1.5); break;
      case 'puddle':
        if (ch === 4) envPuddle(c, rng, x, y, 10 + rng.next() * 12, 'rgba(80,0,10,0.55)', 'rgba(255,190,190,0.4)');
        else envPuddle(c, rng, x, y, 10 + rng.next() * 12, 'rgba(18,26,34,0.42)', 'rgba(200,220,240,0.28)');
        break;
      case 'shroom': for (let k = 0, m = 1 + rng.int(0, 2); k < m; k++) envShroom(c, x + k * 7 - 4, y + (rng.next() - 0.5) * 6, 0.8 + rng.next() * 0.5); break;
      case 'chain': envChain(c, x, y, rng.next() * Math.PI); break;
      case 'tooth': envTooth(c, x, y, rng.next() - 0.5); break;
      case 'pores':
        for (let k = 0; k < 5; k++) {
          const px = x + (rng.next() - 0.5) * 24, py = y + (rng.next() - 0.5) * 14, pr = 1.4 + rng.next() * 1.6;
          ellipse(c, px, py + pr * 0.4, pr * 1.3, pr * 0.9, 'rgba(255,150,150,0.15)');
          ellipse(c, px, py, pr, pr * 0.7, 'rgba(30,0,4,0.55)');
        }
        break;
    }
  }
}

// ---------- стены ----------
// ряды кладки от внешнего края к полу, ширина камней, скругление, неровность
const envWallStyle = {
  1: { rows: [12, 16, 22], bw: [18, 36], rad: 5, jit: 1.5, hv: 2 },
  2: { rows: [14, 17, 19], bw: [14, 30], rad: 7, jit: 2.5, hv: 5 },
  3: { rows: [22, 28], bw: [36, 62], rad: 2, jit: 0.5 },
  devil: { rows: [20, 30], bw: [30, 56], rad: 2, jit: 0.5 },
  angel: { rows: [22, 28], bw: [44, 70], rad: 1.5, jit: 0 },
};
function envBricks(c, rng, pal, st, L, lit, lvl) {
  let y = 0;
  for (let r = 0; r < st.rows.length; r++) {
    const h = st.rows[r], depth = (r + 1) / st.rows.length;
    let x = -rng.next() * st.bw[1];
    while (x < L) {
      const bw = st.bw[0] + rng.next() * (st.bw[1] - st.bw[0]);
      const col = envShade(envMix(pal.wall, pal.wall2, 0.2 + rng.next() * 0.55 + depth * 0.15), lit + (rng.chance(0.12) ? -0.16 : 0));
      // неровная кладка: камни разной высоты и с разным сдвигом в ряду
      const shrink = (st.hv || 0) * rng.next();
      const bx = x + 1.2, by = y + 1.2 + shrink * rng.next() + (rng.next() - 0.5) * st.jit, bww = bw - 2.4, bh = h - 2.4 - shrink;
      const rad = Math.min(st.rad, bh / 2, bww / 2);
      rrect(c, bx, by, bww, bh, rad, col);
      if (lvl) {
        const ins = Math.min(rad * 0.6, bww / 3);
        c.fillStyle = 'rgba(255,255,255,0.11)'; c.fillRect(bx + ins, by + 0.6, bww - ins * 2, 1.5);
        c.fillStyle = 'rgba(0,0,0,0.24)'; c.fillRect(bx + ins, by + bh - 2.2, bww - ins * 2, 2.2);
        if (rng.chance(0.3)) ellipse(c, bx + rng.next() * bww, by + rng.next() * bh, 2 + rng.next() * 4, 1 + rng.next() * 2, 'rgba(0,0,0,0.12)');
        if (rng.chance(0.16)) envCrack(c, rng, bx + 3 + rng.next() * (bww - 6), by + 1, 1.2 + rng.next() * 0.8, bh * 0.9, 1, 1);
      }
      x += bw;
    }
    y += h;
  }
}
// стена-плоть (Утроба)
function envFleshWall(c, rng, pal, L, lit, lvl) {
  c.fillStyle = envShade(pal.wall, lit); c.fillRect(0, 0, L, WALL);
  const n = Math.floor(L / (lvl ? 9 : 18));
  for (let k = 0; k < n; k++) {
    const x = rng.next() * L, y = rng.next() * WALL, r = 7 + rng.next() * 12;
    if (lvl) {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, envShade(pal.wall2, 0.12 + lit)); g.addColorStop(0.6, envShade(pal.wall2, -0.12 + lit)); g.addColorStop(1, envRgba(pal.dark, 0));
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); c.fill();
    } else ellipse(c, x, y, r, r * 0.8, envShade(pal.wall2, -0.15 + lit));
  }
  for (let k = 0; k < L / 120; k++) envVein(c, rng, rng.next() * L, rng.next() * WALL, rng.next() * 6.3, 40 + rng.next() * 40, 2.2, lvl, 1);
  if (lvl) for (let k = 0; k < L / 14; k++) ellipse(c, rng.next() * L, rng.next() * WALL, 1 + rng.next() * 3.5, 0.6 + rng.next() * 1.2, 'rgba(255,220,220,0.2)', null, 0, rng.next() - 0.5);
}
function envWalls(c, rng, pal, ch, lvl) {
  const X0 = RX - WALL, Y0 = RY - WALL, X1 = RX + RW + WALL, Y1 = RY + RH + WALL;
  const st = envWallStyle[ch];
  const mortar = envShade(pal.dark, -0.25);
  const lipCol = ch === 'angel' ? '#e0c060' : ch === 'devil' ? '#4a1410' : pal.wall2;
  // [начало, поворот, длина, освещённость]: верх виден «в лицо» — светлее, низ — темнее
  for (const [ox, oy, rot, L, lit] of [[X0, Y0, 0, X1 - X0, 0.08], [X1, Y0, Math.PI / 2, Y1 - Y0, -0.02], [X1, Y1, Math.PI, X1 - X0, -0.1], [X0, Y1, -Math.PI / 2, Y1 - Y0, -0.02]]) {
    c.save();
    c.translate(ox, oy); c.rotate(rot);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(L, 0); c.lineTo(L - WALL, WALL); c.lineTo(WALL, WALL); c.closePath();
    c.clip();
    if (st) { c.fillStyle = mortar; c.fillRect(0, 0, L, WALL); envBricks(c, rng, pal, st, L, lit, lvl); }
    else envFleshWall(c, rng, pal, L, lit, lvl);
    if (ch === 2 && lvl) for (let k = 0; k < L / 70; k++) envBlob(c, rng, rng.next() * L, WALL - 6 - rng.next() * 14, 5 + rng.next() * 9, 'rgba(85,115,55,0.3)', 4);
    // глубина: внешний край стены темнее
    let g = c.createLinearGradient(0, 0, 0, WALL);
    g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, L, WALL);
    // тень в углах
    for (const [a, b] of [[0, WALL * 1.6], [L, L - WALL * 1.6]]) {
      g = c.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(Math.min(a, b), 0, WALL * 1.6, WALL);
    }
    // кромка у пола с фаской
    c.fillStyle = envShade(lipCol, (ch === 'angel' ? 0 : 0.1) + lit); c.fillRect(0, WALL - 5, L, 5);
    c.fillStyle = 'rgba(255,255,255,' + (lvl ? 0.22 : 0.12) + ')'; c.fillRect(0, WALL - 5, L, 1.2);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, WALL - 1.6, L, 1.6);
    c.restore();
  }
}
// Кладка стен одинакова для всех комнат главы (как в оригинале) — слой кэшируется
// по главе, качеству и масштабу; детали (черепа, трещины) у каждой комнаты свои.
const envWallCache = new Map();
function envWallLayer(pal, ch, lvl) {
  const key = ch + '|' + lvl + '|' + PIXEL_SCALE;
  let L = envWallCache.get(key);
  if (L) { envWallCache.delete(key); envWallCache.set(key, L); return L; }
  L = makeCanvas(RW + WALL * 2, RH + WALL * 2);
  const c = L.ctx;
  c.translate(WALL - RX, WALL - RY);
  c.lineCap = 'round'; c.lineJoin = 'round';
  envWalls(c, new RNG(typeof ch === 'number' ? ch * 7919 + 17 : ch === 'devil' ? 666 : 777), pal, ch, lvl);
  envWallCache.set(key, L);
  if (envWallCache.size > 2) envWallCache.delete(envWallCache.keys().next().value);
  return L;
}
// тень от стен на полу (ambient occlusion)
function envWallAO(c, lvl) {
  for (const [x0, y0, x1, y1, a] of [[0, RY, 0, RY + 44, 0.55], [0, RY + RH, 0, RY + RH - 26, 0.34], [RX, 0, RX + 36, 0, 0.45], [RX + RW, 0, RX + RW - 36, 0, 0.45]]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    if (x0 === 0) c.fillRect(RX, Math.min(y0, y1), RW, Math.abs(y1 - y0));
    else c.fillRect(Math.min(x0, x1), RY, Math.abs(x1 - x0), RH);
  }
  if (!lvl) return;
  c.save(); c.beginPath(); c.rect(RX, RY, RW, RH); c.clip();
  for (const [x, y] of [[RX, RY], [RX + RW, RY], [RX, RY + RH], [RX + RW, RY + RH]]) envSoft(c, x, y, 80, '0,0,0', 0.32);
  c.restore();
}
// детали в стенах: трещины, черепа, мох, потёки, наросты
const envWallDet = {
  1: ['crack', 'skull', 'drip', 'crack', 'hole'],
  2: ['moss', 'crack', 'drip', 'hole', 'moss'],
  3: ['skull', 'crack', 'hole', 'drip'],
  4: ['nodule', 'nodule', 'drip'],
  devil: ['skull', 'rune', 'crack', 'crack'],
  angel: ['gold'],
};
function envWallDetails(c, rng, pal, ch) {
  const n = 4 + rng.int(0, 3);
  for (let i = 0; i < n; i++) {
    const side = rng.int(0, 3), L = side % 2 ? RH : RW;
    let u = 30 + rng.next() * (L - 60);
    if (Math.abs(u - L / 2) < 64) u = u < L / 2 ? L / 2 - 64 - rng.next() * 40 : L / 2 + 64 + rng.next() * 40;
    const d = 14 + rng.next() * 18;
    const [x, y, nx, ny] = side === 0 ? [RX + u, RY - d, 0, 1] : side === 1 ? [RX + RW + d, RY + u, -1, 0] : side === 2 ? [RX + u, RY + RH + d, 0, -1] : [RX - d, RY + u, 1, 0];
    switch (rng.pick(envWallDet[ch] || envWallDet[1])) {
      case 'crack': envCrack(c, rng, x - nx * 10, y - ny * 10, Math.atan2(ny, nx) + (rng.next() - 0.5) * 0.9, 22 + rng.next() * 14, 1.6); break;
      case 'skull': ellipse(c, x, y + 1, 10, 9, 'rgba(0,0,0,0.5)'); envSkull(c, x, y, 0.85); break;
      case 'hole': {
        // выбоина в кладке: светлый нижний край, тёмная глубина
        const r = 4 + rng.next() * 3;
        ellipse(c, x + 0.8, y + 1.2, r + 1.2, r * 0.75 + 1, 'rgba(255,240,220,0.14)');
        ellipse(c, x, y, r + 0.6, r * 0.75 + 0.4, envShade(pal.dark, -0.3));
        ellipse(c, x - 0.6, y - 0.6, r * 0.6, r * 0.42, 'rgba(0,0,0,0.6)');
        break;
      }
      case 'moss':
        for (let k = 0; k < 4; k++) envBlob(c, rng, x + (rng.next() - 0.5) * 26 * (1 - Math.abs(nx)), y + (rng.next() - 0.5) * 26 * (1 - Math.abs(ny)), 5 + rng.next() * 6, 'rgba(90,125,55,0.4)', 4);
        for (let k = 0; k < 5; k++) circle(c, x + (rng.next() - 0.5) * 22, y + (rng.next() - 0.5) * 22, 0.8 + rng.next(), 'rgba(170,210,110,0.35)');
        break;
      case 'drip': {
        const sx = x - nx * 18, sy = y - ny * 18, ex = x + nx * (d - 4), ey = y + ny * (d - 4);
        const g = c.createLinearGradient(sx, sy, ex, ey);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, ch === 4 ? 'rgba(60,0,8,0.4)' : 'rgba(0,0,0,0.28)');
        c.lineCap = 'round'; c.strokeStyle = g;
        for (let k = -1; k <= 1; k++) {
          const ox = -ny * k * 4, oy = nx * k * 4;
          c.lineWidth = k ? 2 : 3.5;
          c.beginPath(); c.moveTo(sx + ox, sy + oy); c.lineTo(ex + ox - nx * Math.abs(k) * 6, ey + oy - ny * Math.abs(k) * 6); c.stroke();
        }
        break;
      }
      case 'nodule':
        for (let k = 0; k < 3; k++) {
          const px = x + (rng.next() - 0.5) * 18, py = y + (rng.next() - 0.5) * 18, r = 4 + rng.next() * 5;
          ellipse(c, px + 1.5, py + 2, r, r * 0.85, 'rgba(40,0,6,0.45)');
          ellipse(c, px, py, r, r * 0.85, envShade(pal.wall2, 0.08), envShade(pal.dark, 0), 1);
          ellipse(c, px - r * 0.35, py - r * 0.35, r * 0.35, r * 0.2, 'rgba(255,230,230,0.5)', null, 0, -0.5);
        }
        break;
      case 'rune': envGlowCrack(c, rng, x - nx * 8, y - ny * 8, Math.atan2(ny, nx) + (rng.next() - 0.5) * 1.4, 14 + rng.next() * 10); break;
      case 'gold':
        circle(c, x, y, 6, 'rgba(255,240,180,0.25)');
        line(c, x, y - 7, x, y + 7, '#c9a040', 2.4); line(c, x - 4.5, y - 2.5, x + 4.5, y - 2.5, '#c9a040', 2.4);
        line(c, x - 0.6, y - 6, x - 0.6, y + 6, 'rgba(255,250,220,0.8)', 0.8);
        break;
    }
  }
}

// ---------- фон комнаты (кэшируется) ----------
function buildRoomBg(room) {
  const pal = paletteFor(room);
  const ch = envChapter(room);
  const lvl = gfxLevel();
  const w = RW + WALL * 2, h = RH + WALL * 2;
  const cv = makeCanvas(w, h);
  cv.ox = 0; cv.oy = 0;
  const c = cv.ctx;
  c.translate(WALL - RX, WALL - RY);
  const rng = new RNG(room.seed);
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';

  // пол
  envFloor(c, rng, room, pal, ch, lvl);
  // особые полы
  const [cx, cy] = tileCenter(6, 3);
  if (room.type === 'shop') envRug(c, cx, cy, lvl);
  if (room.type === 'devil') envPentagram(c, cx, cy + 10, lvl);
  if (room.type === 'angel') envHolyFloor(c, cx, cy, lvl);
  // мелочи на полу: паутина, кости, камешки, лужи
  if (lvl) envProps(c, new RNG(room.seed ^ 0x5bd1e995), room, pal, ch);
  // ямы и шипы — статичны
  envPits(c, room, pal, lvl);
  if (room.type === 'start' && G.stage === 1) {
    const col = 'rgba(20,10,5,0.32)';
    if (Input.touchMode) {
      text(c, 'левый палец — ходить', RX + RW * 0.24, RY + RH * 0.3, 19, col, 'center', null);
      text(c, 'правый палец — плакать', RX + RW * 0.76, RY + RH * 0.3, 19, col, 'center', null);
    } else {
      text(c, 'W A S D — ходить', RX + RW * 0.22, RY + RH * 0.3, 21, col, 'center', null);
      text(c, '← ↑ ↓ → — плакать', RX + RW * 0.78, RY + RH * 0.3, 21, col, 'center', null);
      text(c, 'E — бомба     ПРОБЕЛ — предмет     Q — пилюля/карта', RX + RW / 2, RY + RH * 0.8, 19, col, 'center', null);
      text(c, 'TAB — карта     ESC — пауза     R (держать) — заново', RX + RW / 2, RY + RH * 0.9, 16, col, 'center', null);
    }
  }

  c.restore();

  // декали
  for (const d of room.decals) paintDecal(c, d);

  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // тени у стен
  envWallAO(c, lvl);
  // стены (общий для главы слой, копия 1:1)
  const wl = envWallLayer(pal, ch, lvl);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(wl.cv, 0, 0); c.restore();
  if (lvl) envWallDetails(c, new RNG(room.seed ^ 0x27d4eb2f), pal, ch);
  const X0 = RX - WALL, Y0 = RY - WALL, X1 = RX + RW + WALL, Y1 = RY + RH + WALL;
  for (const [ax, ay, bx, by] of [[X0, Y0, RX, RY], [X1, Y0, RX + RW, RY], [X0, Y1, RX, RY + RH], [X1, Y1, RX + RW, RY + RH]]) {
    line(c, ax, ay, bx, by, 'rgba(0,0,0,0.5)', 2.5);
    if (lvl) line(c, ax, ay + (ay < RY ? 2 : -2), bx, by + (ay < RY ? 2 : -2), 'rgba(255,255,255,0.05)', 1);
  }
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(RX, RY, RW, RH);
  c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  c.restore();
  return cv;
}

function paintDecal(c, d) {
  c.save();
  c.beginPath(); c.rect(RX, RY, RW, RH); c.clip();
  const r = d.r;
  const s = d.seed | 0;
  const lvl = gfxLevel();
  switch (d.type) {
    case 'blood': {
      const col = d.color || '#7a0c0c';
      if (!lvl) {
        c.globalAlpha = 0.7;
        for (let i = 0; i < 6; i++) circle(c, d.x + (hrand(s, i) - 0.5) * r * 1.8, d.y + (hrand(s, i + 9) - 0.5) * r * 1.1, r * (0.2 + hrand(s, i + 20) * 0.45), col);
        break;
      }
      // лужа одной заливкой, тёмная середина, брызги и влажный блик
      c.globalAlpha = 0.75;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const ex = d.x + (hrand(s, i) - 0.5) * r * 1.8, ey = d.y + (hrand(s, i + 9) - 0.5) * r * 1.1, er = r * (0.2 + hrand(s, i + 20) * 0.45);
        c.moveTo(ex + er, ey); c.arc(ex, ey, er, 0, Math.PI * 2);
      }
      c.fillStyle = col; c.fill();
      if (col[0] === '#') {
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const ex = d.x + (hrand(s, i) - 0.5) * r * 1.2, ey = d.y + (hrand(s, i + 9) - 0.5) * r * 0.7, er = r * (0.12 + hrand(s, i + 20) * 0.25);
          c.moveTo(ex + er, ey); c.arc(ex, ey, er, 0, Math.PI * 2);
        }
        c.fillStyle = envShade(col, -0.4); c.fill();
      }
      for (let i = 0; i < 7; i++) {
        const a = hrand(s, i + 40) * Math.PI * 2, dd = r * (1.1 + hrand(s, i + 50) * 1.1);
        circle(c, d.x + Math.cos(a) * dd, d.y + Math.sin(a) * dd * 0.6, 0.8 + hrand(s, i + 60) * 2, col);
      }
      c.globalAlpha = 0.5;
      ellipse(c, d.x - r * 0.3, d.y - r * 0.22, r * 0.28, r * 0.1, 'rgba(255,210,210,0.6)', null, 0, -0.3);
      break;
    }
    case 'scorch': {
      const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.6, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(d.x - r, d.y - r, r * 2, r * 2);
      if (!lvl) break;
      // лучи копоти и угольки
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + hrand(s, i) * 0.5, l = r * (0.9 + hrand(s, i + 10) * 0.6);
        line(c, d.x + Math.cos(a) * r * 0.3, d.y + Math.sin(a) * r * 0.2, d.x + Math.cos(a) * l, d.y + Math.sin(a) * l * 0.7, 'rgba(0,0,0,0.22)', 2 + hrand(s, i + 20) * 3);
      }
      for (let i = 0; i < 5; i++) circle(c, d.x + (hrand(s, i + 30) - 0.5) * r, d.y + (hrand(s, i + 40) - 0.5) * r * 0.6, 1 + hrand(s, i + 50) * 1.5, 'rgba(40,30,25,0.8)');
      break;
    }
    case 'rubble':
      if (!lvl) {
        for (let i = 0; i < 7; i++) circle(c, d.x + (hrand(s, i) - 0.5) * r * 2, d.y + (hrand(s, i + 7) - 0.5) * r * 1.4, 2 + hrand(s, i + 3) * 3.5, 'rgba(60,50,40,0.6)');
        break;
      }
      {
        const pal = paletteFor(G.room);
        ellipse(c, d.x, d.y + 2, r * 1.1, r * 0.6, 'rgba(0,0,0,0.18)');
        for (let i = 0; i < 9; i++) envPebble(c, d.x + (hrand(s, i) - 0.5) * r * 2, d.y + (hrand(s, i + 7) - 0.5) * r * 1.4, 1.6 + hrand(s, i + 3) * 3.2, hrand(s, i + 5) < 0.5 ? pal.rock : pal.rock2);
      }
      break;
    case 'poop':
      c.globalAlpha = 0.55;
      ellipse(c, d.x, d.y, r, r * 0.5, '#4a3418');
      if (!lvl) break;
      c.globalAlpha = 0.6;
      for (let i = 0; i < 5; i++) ellipse(c, d.x + (hrand(s, i) - 0.5) * r * 1.6, d.y + (hrand(s, i + 5) - 0.5) * r * 0.7, 2 + hrand(s, i + 9) * 3, 1.5 + hrand(s, i + 9) * 2, '#5a3e1c');
      c.globalAlpha = 0.25;
      ellipse(c, d.x - r * 0.3, d.y - r * 0.15, r * 0.3, r * 0.1, '#fff0d0');
      break;
  }
  c.restore();
}

// ---------- препятствия ----------
// Статичные препятствия рисуются один раз в спрайт (на комнату) и выводятся пиксель-в-пиксель;
// пламя костров и дым анимируются поверх каждый кадр.
const envTileCache = new Map();
let envTileOwner = null;
function envTileSprite(t, i, pal, lvl) {
  if (envTileOwner !== G.bgCache) { envTileCache.clear(); envTileOwner = G.bgCache; }
  const key = (t.t === 'p' ? 'p' + clamp(t.hp, 1, 4) : t.t === 'f' ? (t.hp > 0 ? 'f1' : 'f0') : t.t + (t.sub || '')) + ':' + i;
  let s = envTileCache.get(key);
  if (s) return s;
  // статуи высокие, остальным хватает клетки с запасом под тень
  s = t.t === 'S' ? envSprite(76, 100, 38, 64) : envSprite(64, 62, 32, 34);
  const c = s.ctx;
  c.translate(s.ox, s.oy);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const seed = G.room.seed + i * 13;
  switch (t.t) {
    case 'r': case 't': envRock(c, seed, pal, lvl, t.t === 't'); break;
    case 'm': envMetal(c, seed, lvl); break;
    case 'p': envPoop(c, clamp(t.hp, 1, 4), seed, lvl); break;
    case 'f': envFireBase(c, t.hp > 0, lvl); break;
    case 'S': envStatue(c, t.sub, lvl); break;
  }
  envTileCache.set(key, s);
  return s;
}

function drawTile(c, t, i, pal) {
  const col = i % COLS, row = (i / COLS) | 0;
  const x = RX + col * T + T / 2, y = RY + row * T + T / 2;
  const lvl = gfxLevel();
  envBlit(c, envTileSprite(t, i, pal, lvl), x, y);
  if (t.t === 'f') {
    if (t.hp > 0) envFlame(c, x, y, Math.min(1, t.hp / 4) * 0.4 + 0.6, G.room.type === 'devil', i, lvl);
    else envSmoke(c, x, y, i, lvl);
  }
}

// камень: объём, освещённая верхняя грань, тёмное основание, трещины
function envRock(c, seed, pal, lvl, tinted) {
  let base = pal.rock2, top = pal.rock;
  if (tinted) { base = envMix(base, '#56789e', 0.3); top = envMix(top, '#9cc2e4', 0.3); }
  const n = lvl ? 11 : 9, pts = [], tp = [];
  const lump = lvl ? 3 + hrand(seed, 90) * 6 : 5;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2, rr = 25 - lump + hrand(seed, k) * lump;
    pts.push(Math.cos(a) * rr, 4 + Math.sin(a) * rr * 0.8);
    tp.push(Math.cos(a) * rr * (lvl ? 0.8 : 0.82), (lvl ? -2 : -1) + Math.sin(a) * rr * (lvl ? 0.6 : 0.62));
  }
  if (!lvl) {
    shadow(c, 0, 14, 22, 7, 0.35);
    poly(c, pts, base, OUT, 2.5);
    poly(c, tp, top);
    ellipse(c, -6, -7, 7, 3.5, 'rgba(255,255,255,0.18)', null, 0, -0.3);
    line(c, 3, -2, 9, 5, 'rgba(0,0,0,0.3)', 1.5);
    if (tinted) envTintMark(c, lvl);
    return;
  }
  ellipse(c, 2, 16, 25, 8, 'rgba(0,0,0,0.22)');
  ellipse(c, 1, 15, 19, 5.5, 'rgba(0,0,0,0.3)');
  let g = c.createLinearGradient(0, -14, 0, 24);
  g.addColorStop(0, envShade(base, 0.1)); g.addColorStop(1, envShade(base, -0.38));
  poly(c, pts, g, OUT, 2.5);
  g = c.createRadialGradient(-6, -9, 2, 0, -2, 23);
  g.addColorStop(0, envShade(top, 0.2)); g.addColorStop(0.6, top); g.addColorStop(1, envMix(top, base, 0.6));
  poly(c, tp, g);
  // грани от верхней площадки к краю
  for (let k = 0; k < 3; k++) {
    const j = (1 + k * 4 + Math.floor(hrand(seed, 30 + k) * 2)) % n;
    line(c, tp[j * 2], tp[j * 2 + 1], pts[j * 2], pts[j * 2 + 1], 'rgba(0,0,0,0.24)', 1.3);
  }
  // светлый край сверху-слева
  c.beginPath();
  for (let k = 5; k <= 8; k++) c[k === 5 ? 'moveTo' : 'lineTo'](tp[k * 2], tp[k * 2 + 1]);
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.6; c.stroke();
  // трещина
  let cx = (hrand(seed, 41) - 0.5) * 10, cy = -6 + hrand(seed, 42) * 6, a = hrand(seed, 40) * 6.3;
  const cp = [cx, cy];
  for (let k = 0; k < 3; k++) { a += (hrand(seed, 43 + k) - 0.5) * 1.4; cx += Math.cos(a) * 5; cy += Math.sin(a) * 3.5; cp.push(cx, cy); }
  envPolyline(c, cp, 0.6, 0.9); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1.1; c.stroke();
  envPolyline(c, cp, 0, 0); c.strokeStyle = 'rgba(0,0,0,0.42)'; c.lineWidth = 1.3; c.stroke();
  for (let k = 0; k < 6; k++) circle(c, (hrand(seed, 50 + k) - 0.5) * 26, -2 + (hrand(seed, 60 + k) - 0.5) * 16, 0.7 + hrand(seed, 70 + k) * 1.1, k & 1 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.14)');
  envPebble(c, -19 + hrand(seed, 80) * 5, 18, 2.2, base);
  envPebble(c, 15 + hrand(seed, 81) * 5, 19, 1.7, base);
  if (tinted) envTintMark(c, lvl);
}
// светящийся знак меченого камня
function envTintMark(c, lvl) {
  const path = () => { c.beginPath(); c.moveTo(-8, -9); c.quadraticCurveTo(-1, -4, 8, 2); c.moveTo(7, -9); c.quadraticCurveTo(1, -4, -7, 3); };
  c.lineCap = 'round';
  if (lvl) {
    path(); c.strokeStyle = 'rgba(110,200,255,0.22)'; c.lineWidth = 9; c.stroke();
    c.strokeStyle = 'rgba(140,220,255,0.55)'; c.lineWidth = 4.2; c.stroke();
  } else { path(); c.strokeStyle = '#4a7aa8'; c.lineWidth = 4.5; c.stroke(); }
  path(); c.strokeStyle = lvl ? '#effaff' : '#9fd4ff'; c.lineWidth = lvl ? 1.8 : 2.4; c.stroke();
}
// металлический блок: фаски, заклёпки, царапины
function envMetal(c, seed, lvl) {
  if (!lvl) {
    shadow(c, 0, 16, 24, 6, 0.4);
    rrect(c, -24, -22, 48, 42, 4, '#6a6e78', OUT, 2.5);
    rrect(c, -20, -22, 40, 30, 3, '#8c909a');
    for (const [dx, dy] of [[-14, -14], [14, -14], [-14, 2], [14, 2]]) circle(c, dx, dy, 2.2, '#4a4e58');
    return;
  }
  ellipse(c, 2, 18, 27, 7, 'rgba(0,0,0,0.35)');
  let g = c.createLinearGradient(0, -2, 0, 21);
  g.addColorStop(0, '#6c717c'); g.addColorStop(1, '#3a3e47');
  rrect(c, -24, -22, 48, 43, 4, g, OUT, 2.5);
  g = c.createLinearGradient(-20, -22, 18, 0);
  g.addColorStop(0, '#bcc2cc'); g.addColorStop(1, '#848a95');
  rrect(c, -21.5, -20.5, 43, 21.5, 3, g);
  line(c, -19, -19.5, 19, -19.5, 'rgba(255,255,255,0.55)', 1.2);
  line(c, -20.5, -18, -20.5, -2, 'rgba(255,255,255,0.25)', 1);
  line(c, -22, 1.5, 22, 1.5, 'rgba(0,0,0,0.5)', 1.6);
  line(c, -21, 3.2, 21, 3.2, 'rgba(255,255,255,0.14)', 1);
  // крестовая пластина
  c.save(); c.beginPath(); c.rect(-21, -20, 42, 21); c.clip();
  line(c, -18, -17, 18, -2, 'rgba(0,0,0,0.12)', 4); line(c, 18, -17, -18, -2, 'rgba(0,0,0,0.12)', 4);
  c.restore();
  rrect(c, -15, 7, 30, 10, 2, 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.08)', 1);
  for (const [dx, dy] of [[-16, -15], [16, -15], [-16, -5], [16, -5], [-19, 12], [19, 12]]) {
    circle(c, dx, dy, 2.4, '#3a3e46');
    circle(c, dx - 0.6, dy - 0.6, 1.1, 'rgba(255,255,255,0.65)');
  }
  for (let k = 0; k < 3; k++) {
    const sx = (hrand(seed, k) - 0.5) * 30, sy = -16 + hrand(seed, k + 5) * 12;
    line(c, sx, sy, sx + 4 + hrand(seed, k + 9) * 6, sy + 1.5, 'rgba(255,255,255,0.22)', 0.8);
  }
}
// куча: ярусы с завитком и влажным блеском
function envPoop(c, k, seed, lvl) {
  const tiers = [[0, 10, 18, 10], [0, 1, 13, 8], [0, -7, 8, 6]];
  const n = k >= 4 ? 3 : k >= 2 ? 2 : 1;
  const sc = k === 3 || k === 1 ? 0.85 : 1;
  if (!lvl) {
    shadow(c, 0, 14, 18, 6, 0.35);
    for (let j = 0; j < n; j++) {
      const [dx, dy, rx, ry] = tiers[j];
      ellipse(c, dx, dy * sc + 2, rx * sc, ry * sc, '#7a5426', OUT, 2);
      ellipse(c, dx - rx * 0.3 * sc, dy * sc - ry * 0.25, rx * 0.35 * sc, ry * 0.3 * sc, '#9a7038');
    }
    if (n === 3) poly(c, [-3, -12, 3, -12, 0, -19], '#7a5426', OUT, 1.5);
    return;
  }
  ellipse(c, 1, 15, 20, 6.5, 'rgba(0,0,0,0.38)');
  for (let j = 0; j < n; j++) {
    const [dx, dy, rx, ry] = tiers[j];
    const ex = dx, ey = dy * sc + 2, erx = rx * sc, ery = ry * sc;
    if (j > 0) ellipse(c, ex + 1, ey + ery * 0.7, erx * 1.02, ery * 0.6, 'rgba(30,15,5,0.4)');
    const g = c.createRadialGradient(ex - erx * 0.35, ey - ery * 0.45, 1, ex, ey, erx * 1.05);
    g.addColorStop(0, '#ab7c42'); g.addColorStop(0.55, '#7a5426'); g.addColorStop(1, '#4a3014');
    ellipse(c, ex, ey, erx, ery, g, OUT, 2);
    c.beginPath(); c.ellipse(ex + erx * 0.08, ey + ery * 0.12, erx * 0.62, ery * 0.48, 0, 0.25, 2.3);
    c.strokeStyle = 'rgba(40,20,5,0.38)'; c.lineWidth = 1.4; c.stroke();
    ellipse(c, ex - erx * 0.38, ey - ery * 0.42, erx * 0.3, ery * 0.2, 'rgba(255,240,210,0.38)', null, 0, -0.3);
  }
  if (n === 3) {
    c.beginPath(); c.moveTo(-4, -11); c.quadraticCurveTo(-2, -18, 3, -20); c.quadraticCurveTo(1, -16, 4, -11); c.closePath();
    c.fillStyle = '#86602e'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    line(c, -1.5, -14, 1, -18, 'rgba(255,240,210,0.4)', 1);
  }
  for (let q = 0; q < 4; q++) circle(c, (hrand(seed, q) - 0.5) * 22 * sc, 4 + (hrand(seed, q + 4) - 0.5) * 10, 0.9, 'rgba(230,200,120,0.5)');
}
// основание костра: поленья, угли или зола
function envLog(c, x1, y1, x2, y2, lit) {
  line(c, x1, y1, x2, y2, OUT, 9);
  line(c, x1, y1, x2, y2, lit ? '#6a4020' : '#3a302c', 7);
  line(c, x1, y1 - 1.6, x2, y2 - 1.6, lit ? '#8e5e32' : '#4a403a', 2.4);
  line(c, x1 + (x2 - x1) * 0.3, y1 + (y2 - y1) * 0.3 + 1.5, x1 + (x2 - x1) * 0.6, y1 + (y2 - y1) * 0.6 + 1.5, 'rgba(0,0,0,0.3)', 1);
  ellipse(c, x1, y1, 3.2, 3.8, lit ? '#c8925a' : '#5a5450', OUT, 1.2);
  circle(c, x1, y1, 1.3, lit ? '#8a5a30' : '#2a2422');
}
function envFireBase(c, lit, lvl) {
  if (!lvl) {
    shadow(c, 0, 14, 18, 6, 0.4);
    line(c, -14, 12, 12, 4, '#5a3418', 7);
    line(c, 14, 12, -12, 4, '#6a4020', 7);
    if (!lit) circle(c, 0, 6, 6, '#3a2a20');
    return;
  }
  ellipse(c, 1, 14, 22, 7, 'rgba(0,0,0,0.38)');
  ellipse(c, 0, 10, 17, 5.5, lit ? '#24140c' : '#3e3836');
  for (let k = 0; k < 7; k++) circle(c, (hrand(k, 3) - 0.5) * 26, 9 + (hrand(k, 4) - 0.5) * 6, 1.4 + hrand(k, 5) * 1.6, lit ? '#2e2a28' : '#5a5654');
  envLog(c, -15, 12, 12, 3, lit);
  envLog(c, 15, 12, -12, 3, lit);
  if (lit) {
    for (let k = 0; k < 6; k++) circle(c, (hrand(k, 7) - 0.5) * 16, 8 + hrand(k, 8) * 4, 1.2 + hrand(k, 9) * 1.4, k & 1 ? '#ff7a1a' : '#ffc040');
  } else {
    ellipse(c, 0, 7, 7, 3, '#6a6664');
    for (let k = 0; k < 4; k++) circle(c, (hrand(k, 11) - 0.5) * 10, 6 + hrand(k, 12) * 3, 1, '#9a9694');
  }
}
// пламя: слои + мерцание + искры (каждый кадр)
const envFlameCols = { fire: ['#d8401c', '#ff8a24', '#ffd250', '#fff8d8'], hell: ['#7a0820', '#c81e3c', '#ff5a7a', '#ffd8e0'] };
function envFlame(c, x, y, s1, hell, i, lvl) {
  const P = hell ? envFlameCols.hell : envFlameCols.fire;
  const t = G.t;
  const f = Math.sin(t * 0.3 + i) * 2;
  const fl = 1 + Math.sin(t * 0.47 + i * 2.1) * 0.06 + Math.sin(t * 1.13 + i) * 0.04;
  const Hh = 31 * s1 * fl, Wd = 13 * s1, by = y + 8;
  const layers = lvl === 0 ? 2 : lvl === 1 ? 3 : 4;
  for (let k = 0; k < layers; k++) {
    const q = lvl === 0 ? 1 - k * 0.5 : 1 - k * 0.24;
    const sw = f * (1 - k * 0.2) + Math.sin(t * 0.21 + i + k) * 1.2;
    c.beginPath();
    c.moveTo(x - Wd * q, by);
    c.bezierCurveTo(x - Wd * q * 1.25, by - Hh * q * 0.45, x - Wd * q * 0.3 + sw * 0.5, by - Hh * q * 0.7, x + sw, by - Hh * q);
    c.bezierCurveTo(x + Wd * q * 0.3 + sw * 0.5, by - Hh * q * 0.7, x + Wd * q * 1.25, by - Hh * q * 0.45, x + Wd * q, by);
    c.quadraticCurveTo(x, by + 4 * q, x - Wd * q, by);
    c.fillStyle = P[lvl === 0 ? k + 1 : k]; c.fill();
  }
  if (lvl < 2) return;
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.018 + k * 0.27 + i * 0.13) % 1;
    c.globalAlpha = 1 - ph;
    c.fillStyle = P[2];
    c.fillRect(x + Math.sin(ph * 7 + k * 2 + i) * (5 + ph * 7) - 1, y - 6 - ph * 44 * s1 - 1, 2, 2);
  }
  c.globalAlpha = 1;
}
// дымок погасшего костра
function envSmoke(c, x, y, i, lvl) {
  for (let k = 0, n = lvl ? 2 : 1; k < n; k++) {
    const ph = ((G.t + i * 7 + k * 20) % 40) / 40;
    c.globalAlpha = 0.4 * (1 - ph);
    circle(c, x + Math.sin(ph * 4 + k) * 3, y - 2 - ph * 24, 2.5 + ph * 5, '#8c8c8c');
  }
  c.globalAlpha = 1;
}
// статуи ангела и дьявола
function envStatue(c, sub, lvl) {
  const angel = sub === 'angel';
  if (!lvl) {
    shadow(c, 0, 16, 22, 6, 0.4);
    if (angel) {
      rrect(c, -18, 4, 36, 14, 3, '#d8dce4', OUT, 2);
      for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 6, -18); c.quadraticCurveTo(k * 30, -40, k * 26, -6); c.quadraticCurveTo(k * 18, -8, k * 6, -6); c.fillStyle = '#f2f4f8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(); }
      poly(c, [-10, 5, 10, 5, 6, -22, -6, -22], '#eceef4', OUT, 2);
      circle(c, 0, -30, 9, '#eceef4', OUT, 2);
      ellipse(c, 0, -42, 9, 3, null, '#ffe060', 2);
    } else {
      rrect(c, -18, 4, 36, 14, 3, '#3a3236', OUT, 2);
      for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 6, -18); c.lineTo(k * 32, -34); c.lineTo(k * 24, -22); c.lineTo(k * 30, -10); c.lineTo(k * 6, -6); c.closePath(); c.fillStyle = '#2a2428'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(); }
      poly(c, [-10, 5, 10, 5, 6, -22, -6, -22], '#4a4046', OUT, 2);
      circle(c, 0, -30, 9, '#4a4046', OUT, 2);
      poly(c, [-6, -36, -12, -48, -2, -38], '#2a2428', OUT, 1.5);
      poly(c, [6, -36, 12, -48, 2, -38], '#2a2428', OUT, 1.5);
      circle(c, -3, -30, 1.6, '#ff3030'); circle(c, 3, -30, 1.6, '#ff3030');
    }
    return;
  }
  const L = angel ? ['#ffffff', '#e4e7ee', '#a9afbd'] : ['#5e5258', '#3c3338', '#1e181b'];
  ellipse(c, 2, 17, 25, 7, 'rgba(0,0,0,0.4)');
  // пьедестал
  let g = c.createLinearGradient(0, 3, 0, 19);
  g.addColorStop(0, L[1]); g.addColorStop(1, L[2]);
  rrect(c, -19, 3, 38, 16, 3, g, OUT, 2);
  rrect(c, -19, 3, 38, 4.5, 2, L[0]);
  line(c, -19, 7.5, 19, 7.5, 'rgba(0,0,0,0.3)', 1);
  // крылья
  for (const k of [-1, 1]) {
    c.beginPath();
    if (angel) { c.moveTo(k * 6, -18); c.quadraticCurveTo(k * 32, -44, k * 28, -6); c.quadraticCurveTo(k * 18, -9, k * 6, -6); }
    else { c.moveTo(k * 6, -18); c.lineTo(k * 33, -35); c.lineTo(k * 25, -23); c.lineTo(k * 31, -11); c.lineTo(k * 6, -6); }
    c.closePath();
    g = c.createLinearGradient(k * 6, -30, k * 30, -6);
    g.addColorStop(0, L[angel ? 0 : 1]); g.addColorStop(1, L[angel ? 1 : 2]);
    c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke();
    if (angel) {
      for (let q = 0; q < 3; q++) { c.beginPath(); c.moveTo(k * (9 + q * 5), -9 - q * 1.5); c.quadraticCurveTo(k * (15 + q * 5), -17 - q * 4, k * (13 + q * 6), -24 - q * 4); c.strokeStyle = 'rgba(120,130,155,0.55)'; c.lineWidth = 1; c.stroke(); }
    } else {
      line(c, k * 7, -12, k * 25, -23, 'rgba(0,0,0,0.45)', 1.2);
      line(c, k * 7, -10, k * 30, -11, 'rgba(0,0,0,0.45)', 1.2);
      line(c, k * 8, -17, k * 31, -34, 'rgba(255,255,255,0.15)', 1);
    }
  }
  // тело
  g = c.createLinearGradient(-8, -22, 8, 5);
  g.addColorStop(0, L[0]); g.addColorStop(1, L[2]);
  poly(c, [-10, 5, 10, 5, 6, -22, -6, -22], g, OUT, 2);
  line(c, -2, -18, -4, 3, 'rgba(0,0,0,0.18)', 1); line(c, 3, -18, 5, 3, 'rgba(0,0,0,0.18)', 1);
  // голова
  g = c.createRadialGradient(-3, -33, 1, 0, -30, 10);
  g.addColorStop(0, L[0]); g.addColorStop(1, L[angel ? 1 : 2]);
  circle(c, 0, -30, 9, g, OUT, 2);
  if (angel) {
    line(c, -4, -30, -1.5, -30, 'rgba(90,100,120,0.6)', 1.2); line(c, 1.5, -30, 4, -30, 'rgba(90,100,120,0.6)', 1.2);
    ellipse(c, 0, -43, 11, 3.6, null, 'rgba(255,230,120,0.35)', 5);
    ellipse(c, 0, -43, 9.5, 3, null, '#ffe060', 2);
    ellipse(c, -3, -44, 3, 0.8, null, 'rgba(255,255,255,0.8)', 1);
  } else {
    for (const k of [-1, 1]) { poly(c, [k * 6, -36, k * 13, -49, k * 2, -38], L[1], OUT, 1.5); line(c, k * 6, -38, k * 11, -46, 'rgba(255,255,255,0.18)', 1); }
    for (const k of [-1, 1]) { circle(c, k * 3, -30, 3.4, 'rgba(255,40,40,0.35)'); circle(c, k * 3, -30, 1.7, '#ff3030'); circle(c, k * 3 - 0.5, -30.5, 0.6, '#ffd0d0'); }
    line(c, -12, 10, -6, 16, 'rgba(0,0,0,0.4)', 1);
  }
}

function makeShopkeeper(x, y) {
  return {
    kind: 'shopkeeper', x, y,
    draw(c) {
      const hi = gfxLevel() > 0;
      shadow(c, x, y + 10, 16, 5, 0.4);
      ellipse(c, x, y, 14, 12, '#7a7470', OUT, 2);
      if (hi) { ellipse(c, x + 3, y + 3, 9, 7, 'rgba(0,0,0,0.15)'); ellipse(c, x - 5, y - 5, 4, 2.5, 'rgba(255,255,255,0.15)'); }
      circle(c, x, y - 18, 12, '#8c8682', OUT, 2);
      if (hi) { ellipse(c, x + 3, y - 15, 8, 7, 'rgba(0,0,0,0.12)'); ellipse(c, x - 5, y - 24, 4, 2.4, 'rgba(255,255,255,0.22)', null, 0, -0.4); }
      line(c, x - 7, y - 20, x - 2, y - 19, '#111', 2);
      line(c, x + 2, y - 19, x + 7, y - 20, '#111', 2);
      line(c, x - 4, y - 11, x + 4, y - 11, '#111', 1.5);
      if (hi) for (let k = -1; k <= 1; k++) line(c, x + k * 2.6, y - 12.6, x + k * 2.6, y - 9.4, '#111', 0.9);
      line(c, x - 10, y - 30, x - 4, y - 26, '#6a6460', 3);
      line(c, x + 10, y - 30, x + 4, y - 26, '#6a6460', 3);
    },
  };
}

// ---------- двери ----------
const DOOR_ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const DOOR_FRAME = { normal: '#6a5040', boss: '#5a1414', treasure: '#c9a032', shop: '#6a5040', devil: '#1e0a0a', angel: '#e8eaf2' };

// Двери запекаются в спрайты (по направлению, виду, состоянию и главе) и выводятся пиксель-в-пиксель.
const envDoorCache = new Map();
let envDoorScale = 0;
function drawDoors(c) {
  const room = G.room;
  const lvl = gfxLevel(), ch = envChapter(room);
  if (envDoorScale !== PIXEL_SCALE || envDoorCache.size > 24) { envDoorCache.clear(); envDoorScale = PIXEL_SCALE; }
  envSetM(c);
  for (const d of DIR_NAMES) {
    const door = room.doors[d];
    if (!door) continue;
    if (door.hidden && room.type !== 'secret') continue;
    const open = doorOpen(door);
    const key = d + door.kind + (open ? 1 : 0) + (door.locked ? 1 : 0) + ch + lvl;
    const [cx, cy] = doorCenter(d);
    let s = envDoorCache.get(key);
    if (!s) {
      s = envSprite(150, 150, 75, 75);
      s.ctx.translate(75 - cx, 75 - cy);
      drawDoor(s.ctx, d, door, open);
      envDoorCache.set(key, s);
    }
    envBlit(c, s, cx, cy);
  }
}

// путь арки: прямые косяки и дуга-квадратика
function envArchPath(c, w, yTop, ctrlY, yBot) {
  c.beginPath();
  c.moveTo(-w, yBot); c.lineTo(-w, yTop);
  c.quadraticCurveTo(0, ctrlY, w, yTop);
  c.lineTo(w, yBot); c.closePath();
}
function envQ(p0, p1, p2, t) { return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2; }
// каменная арка из клинчатых блоков
function envStoneFrame(c, top, col, lvl) {
  const g = c.createLinearGradient(0, top - 8, 0, 4);
  g.addColorStop(0, envShade(col, 0.22)); g.addColorStop(1, envShade(col, -0.25));
  envArchPath(c, 34, top + 12, top - 8, 3);
  c.fillStyle = lvl ? g : col; c.fill();
  if (lvl) {
    // швы между блоками дуги и косяков
    c.lineCap = 'butt';
    for (const t of [0.12, 0.3, 0.42, 0.58, 0.7, 0.88]) {
      const ox = envQ(-34, 0, 34, t), oy = envQ(top + 12, top - 8, top + 12, t), ix = envQ(-24, 0, 24, t), iy = envQ(top + 16, top + 2, top + 16, t);
      line(c, ix, iy, ox, oy, 'rgba(0,0,0,0.45)', 1.5);
      line(c, ix + 1.2, iy, ox + 1.2, oy, 'rgba(255,255,255,0.12)', 1);
    }
    for (const k of [-1, 1]) for (const y of [-8, -22]) {
      line(c, k * 24, y, k * 34, y, 'rgba(0,0,0,0.45)', 1.5);
      line(c, k * 24, y + 1.4, k * 34, y + 1.4, 'rgba(255,255,255,0.1)', 1);
    }
    // замковый камень
    const kx0 = envQ(-34, 0, 34, 0.42), kx1 = envQ(-34, 0, 34, 0.58), ky = envQ(top + 12, top - 8, top + 12, 0.42);
    poly(c, [kx0 - 1, ky - 2, kx1 + 1, ky - 2, envQ(-24, 0, 24, 0.58), envQ(top + 16, top + 2, top + 16, 0.58) + 1, envQ(-24, 0, 24, 0.42), envQ(top + 16, top + 2, top + 16, 0.42) + 1], envShade(col, 0.28), 'rgba(0,0,0,0.4)', 1.2);
  }
  envArchPath(c, 34, top + 12, top - 8, 3);
  c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
}
// створки закрытой двери: доски, оковка
function envDoorLeaves(c, top, wood, band, lvl) {
  c.fillStyle = wood; c.fillRect(-25, top, 50, -top + 2);
  if (!lvl) {
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, top, 25, -top + 2);
    for (let k = -18; k <= 18; k += 9) line(c, k, top + 8, k, 0, 'rgba(0,0,0,0.25)', 1.2);
    line(c, 0, top + 4, 0, 2, OUT, 2);
    return;
  }
  for (let k = -25, j = 0; k < 25; k += 8.4, j++) {
    c.fillStyle = j & 1 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; c.fillRect(k, top, 8.4, -top + 2);
    line(c, k, top + 4, k, 1, 'rgba(0,0,0,0.35)', 1);
    line(c, k + 3, top + 12 + j * 3, k + 3.6, top + 22 + j * 3, 'rgba(0,0,0,0.15)', 0.8);
  }
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, top, 25, -top + 2);
  for (const y of [top + 18, -8]) {
    c.fillStyle = band; c.fillRect(-25, y, 50, 4.5);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-25, y, 50, 1);
    for (let k = -19; k <= 19; k += 9.5) circle(c, k, y + 2.3, 1.1, 'rgba(255,255,255,0.55)');
  }
  line(c, 0, top + 4, 0, 2, OUT, 2);
  for (const k of [-1, 1]) circle(c, k * 5, -16, 2.2, null, band, 1.4);
}
function envPadlock(c, x, y, lvl) {
  c.beginPath(); c.arc(x, y - 7, 6, Math.PI, 0);
  c.strokeStyle = '#2e3138'; c.lineWidth = 4.6; c.stroke();
  c.strokeStyle = '#c8ccd4'; c.lineWidth = 2.6; c.stroke();
  let fill = '#e6c040';
  if (lvl) { fill = c.createLinearGradient(0, y - 8, 0, y + 7); fill.addColorStop(0, '#ffe680'); fill.addColorStop(1, '#b8861e'); }
  rrect(c, x - 9, y - 8, 18, 15, 3, fill, OUT, 2);
  if (lvl) line(c, x - 6, y - 5.8, x + 6, y - 5.8, 'rgba(255,255,255,0.6)', 1.2);
  circle(c, x, y - 2, 2.2, '#2a1a10');
  poly(c, [x - 1.1, y - 1, x + 1.1, y - 1, x + 1.8, y + 3.6, x - 1.8, y + 3.6], '#2a1a10');
}
// пролом тайной комнаты
function envSecretHole(c, top, pal, lvl) {
  const P = [-24, 2, -20, -12, -28, -22, -14, -34, -16, top + 6, 2, top, 12, top + 8, 24, -30, 18, -18, 26, -8, 22, 2];
  if (!lvl) { poly(c, P, '#050303', 'rgba(0,0,0,0.6)', 3); return; }
  const big = P.map((v, i) => i & 1 ? (v < 0 ? v * 1.1 - 1 : v + 1) : v * 1.18);
  poly(c, big, envShade(pal.rock2, -0.1), 'rgba(0,0,0,0.5)', 2);
  for (let i = 0; i < big.length; i += 4) line(c, big[i], big[i + 1], big[i] * 1.25, big[i + 1] * 1.12 - 2, 'rgba(0,0,0,0.45)', 1.4);
  const g = c.createLinearGradient(0, top, 0, 2);
  g.addColorStop(0, '#000'); g.addColorStop(1, '#140c08');
  poly(c, P, g, 'rgba(0,0,0,0.7)', 2.5);
  c.beginPath(); c.moveTo(P[0], P[1]);
  for (let i = 2; i < 10; i += 2) c.lineTo(P[i], P[i + 1]);
  c.strokeStyle = 'rgba(255,240,220,0.18)'; c.lineWidth = 1.4; c.stroke();
  for (const [x, y, r] of [[-26, 5, 3], [-18, 7, 2.2], [20, 6, 2.8], [27, 4, 2], [5, 6, 1.8]]) envPebble(c, x, y, r, pal.rock);
}
// рога над дверью босса / дьявола
function envHorn(c, k, top, col, dark) {
  c.beginPath();
  c.moveTo(k * 28, top + 16);
  c.quadraticCurveTo(k * 44, top + 8, k * 47, top - 6);
  c.quadraticCurveTo(k * 40, top + 2, k * 34, top + 24);
  c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  for (let q = 0; q < 3; q++) { const t = 0.25 + q * 0.22; line(c, k * envQ(29, 44, 46, t), envQ(top + 16, top + 8, top - 5, t), k * envQ(34, 40, 47, t), envQ(top + 24, top + 2, top - 6, t), dark, 1); }
}

// ---------- двери утробы (глава 4): мясистая губа вместо каменной арки ----------
// осевая линия рамы: косяки x = ±29 и дуга
function fixAFleshAxis(c, top) {
  c.beginPath(); c.moveTo(-29, 2); c.lineTo(-29, top + 14);
  c.quadraticCurveTo(0, top - 3, 29, top + 14); c.lineTo(29, 2);
}
// бугры губы: [сторона (-1/1 косяк, 0 дуга), y косяка или t дуги, радиус]
const fixAFleshLobes = [[-1, -3, 7], [-1, -15, 6.4], [-1, -27, 7.2], [0, 0.13, 6.2], [0, 0.31, 5.8], [0, 0.5, 6], [0, 0.69, 5.6], [0, 0.87, 6.4], [1, -27, 6.8], [1, -15, 7.2], [1, -3, 6.6]];
function fixAFleshFrame(c, top, lvl) {
  const P = fixAFleshLobes.map(([k, v, r]) => k ? [k * 29, v, r] : [envQ(-29, 0, 29, v), envQ(top + 14, top - 3, top + 14, v), r]);
  // общий контур: сначала всё обводкой, затем заливка поверх
  fixAFleshAxis(c, top); c.strokeStyle = OUT; c.lineWidth = 15.5; c.stroke();
  for (const [x, y, r] of P) circle(c, x, y, r + 1.7, OUT);
  let fill = '#9a3a40';
  if (lvl) { fill = c.createLinearGradient(0, top - 6, 0, 4); fill.addColorStop(0, '#c45a60'); fill.addColorStop(1, '#7a2228'); }
  fixAFleshAxis(c, top); c.strokeStyle = fill; c.lineWidth = 12; c.stroke();
  for (const [x, y, r] of P) circle(c, x, y, r, fill);
  if (!lvl) {
    for (const [x, y, r] of P) circle(c, x - r * 0.3, y - r * 0.3, r * 0.35, '#b85258');
    return;
  }
  // объём бугров: тень снизу, влажный блик сверху
  for (let i = 0; i < P.length; i++) {
    const [x, y, r] = P[i];
    c.beginPath(); c.arc(x, y, r - 0.6, 0.15 * Math.PI, 0.95 * Math.PI);
    c.strokeStyle = 'rgba(60,4,12,0.45)'; c.lineWidth = 1.6; c.stroke();
    ellipse(c, x - r * 0.28, y - r * 0.34, r * 0.46, r * 0.28, 'rgba(255,200,200,0.3)', null, 0, -0.5);
    if (lvl === 2) circle(c, x - r * 0.38, y - r * 0.42, r * 0.13, 'rgba(255,240,240,0.75)');
  }
  // прожилки
  const V = 'rgba(70,8,28,0.6)';
  for (const [x0, y0, cx1, cy1, x1, y1] of [[-34, -6, -28, -12, -31, -20], [-25, -24, -34, -31, -26, top + 12], [-8, top + 3, 0, top + 7, 9, top + 3], [33, -8, 27, -18, 32, -24], [26, top + 13, 22, top + 7, 16, top + 5]]) {
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx1, cy1, x1, y1);
    c.strokeStyle = V; c.lineWidth = 1.1; c.stroke();
  }
  if (lvl === 2) for (const [x, y] of [[-33, -20], [31, -14], [-14, top + 6]]) { circle(c, x, y, 1.8, '#d8787a', 'rgba(70,8,20,0.6)', 0.8); circle(c, x - 0.5, y - 0.6, 0.6, 'rgba(255,255,255,0.7)'); }
}
// контур зева: косяки и скруглённый верх (ap — вершина); closed=false — без нижней кромки
function fixAMawPath(c, w, ap, closed) {
  c.beginPath(); c.moveTo(-w, 1); c.lineTo(-w, -24);
  c.quadraticCurveTo(-w, ap, 0, ap); c.quadraticCurveTo(w, ap, w, -24); c.lineTo(w, 1);
  if (closed) c.closePath();
}
// проём: тёмный зев (открыто) или сомкнутая перепонка со щелью (закрыто)
function fixAFleshMaw(c, top, open, lvl) {
  const ap = top + 9;
  fixAMawPath(c, 24, ap, true);
  if (open) {
    let g = '#0a0203';
    if (lvl) { g = c.createLinearGradient(0, top, 0, 1); g.addColorStop(0, '#000'); g.addColorStop(0.55, '#140204'); g.addColorStop(1, '#3e090e'); }
    c.fillStyle = g; c.fill();
    if (lvl) {
      // перепонки слизи в верхних углах — проход остаётся свободным
      c.save(); c.clip();
      for (const k of [-1, 1]) {
        const y0 = k < 0 ? -25 : -22, x1 = k * (k < 0 ? 9 : 11);
        c.beginPath(); c.moveTo(k * 25, y0); c.quadraticCurveTo(k * 15, y0 - 2, x1, ap - 1); c.lineTo(k * 25, ap - 1); c.closePath();
        c.fillStyle = 'rgba(150,48,58,0.5)'; c.fill();
        c.beginPath(); c.moveTo(k * 25, y0); c.quadraticCurveTo(k * 15, y0 - 2, x1, ap - 1);
        c.strokeStyle = '#2a0306'; c.lineWidth = 2.4; c.stroke();
        c.strokeStyle = '#b4505a'; c.lineWidth = 1.1; c.stroke();
        // капля на нижней точке перепонки
        const dx = k * 17, dy = y0 - 4;
        ellipse(c, dx, dy + 3, 1.5, 2.3, '#b4505a', '#2a0306', 0.8);
        if (lvl === 2) circle(c, dx - 0.4, dy + 2.2, 0.5, 'rgba(255,230,230,0.8)');
      }
      c.restore();
    }
  } else {
    let g = '#7e2028';
    if (lvl) { g = c.createRadialGradient(0, -18, 3, 0, -18, 30); g.addColorStop(0, '#a83c46'); g.addColorStop(0.6, '#74202a'); g.addColorStop(1, '#3a080e'); }
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // складки, сходящиеся к щели
    if (lvl) for (let i = 0; i < 10; i++) {
      const a = (i + 0.5) / 10 * Math.PI * 2, k = i < 5 ? 1 : -1;
      const ex = Math.cos(a) * 34, ey = -18 + Math.sin(a) * 34, sy = -18 + Math.sin(a) * 15;
      c.beginPath(); c.moveTo(k * 1.5, sy); c.quadraticCurveTo(ex * 0.5 + k * 3, (sy + ey) / 2 - 3, ex, ey);
      c.strokeStyle = 'rgba(40,2,8,0.5)'; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.moveTo(k * 2.5, sy + 1.2); c.quadraticCurveTo(ex * 0.5 + k * 4, (sy + ey) / 2 - 1.8, ex, ey + 1.2);
      c.strokeStyle = 'rgba(255,170,170,0.2)'; c.lineWidth = 1; c.stroke();
    }
    // сомкнутая щель с припухшими краями
    c.beginPath(); c.moveTo(0, ap + 3); c.quadraticCurveTo(-5.5, -20, 0, -3); c.quadraticCurveTo(5.5, -20, 0, ap + 3);
    if (lvl) { c.strokeStyle = 'rgba(200,90,100,0.55)'; c.lineWidth = 3; c.stroke(); }
    c.fillStyle = '#220205'; c.fill();
    if (lvl) {
      c.beginPath(); c.moveTo(-2.4, ap + 6); c.quadraticCurveTo(-7.4, -20, -2.4, -5.5);
      c.strokeStyle = 'rgba(255,200,200,0.4)'; c.lineWidth = 1; c.stroke();
    }
    c.restore();
  }
  // влажная кайма зева
  fixAMawPath(c, 24, ap, false);
  c.strokeStyle = '#2e0408'; c.lineWidth = 2.4; c.stroke();
  if (lvl) { fixAMawPath(c, 25.6, ap - 1.6, false); c.strokeStyle = 'rgba(255,180,180,0.32)'; c.lineWidth = 1; c.stroke(); }
}

function drawDoor(c, dir, door, open) {
  const [cx, cy] = doorCenter(dir);
  const lvl = gfxLevel();
  const pal = paletteFor(G.room);
  c.save();
  c.translate(cx, cy);
  c.rotate(DOOR_ROT[dir]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const kind = door.kind;
  const top = -WALL + 2;
  if (kind === 'secret') {
    envSecretHole(c, top, pal, lvl);
    c.restore();
    return;
  }
  const frame = DOOR_FRAME[kind] || DOOR_FRAME.normal;
  if (kind === 'devil' || kind === 'angel') {
    const g = c.createRadialGradient(0, -14, 4, 0, -14, 62);
    g.addColorStop(0, kind === 'devil' ? 'rgba(255,30,30,0.5)' : 'rgba(255,255,220,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(-70, -74, 140, 122);
  }
  // рама (в утробе обычные двери — мясистые)
  const flesh = (kind === 'normal' || kind === 'shop') && envChapter(G.room) === 4;
  if (flesh) fixAFleshFrame(c, top, lvl);
  else if (kind === 'normal' || kind === 'shop') envStoneFrame(c, top, kind === 'shop' ? '#7a5638' : envMix(pal.wall2, '#8a7866', 0.4), lvl);
  else {
    let fill = frame;
    if (lvl) {
      const C = { boss: ['#7a2020', '#2a0606'], treasure: ['#ffe68a', '#a87a1e'], devil: ['#3a1414', '#0a0202'], angel: ['#ffffff', '#b8bccb'] }[kind] || [frame, frame];
      fill = c.createLinearGradient(0, top - 8, 0, 4); fill.addColorStop(0, C[0]); fill.addColorStop(1, C[1]);
    }
    envArchPath(c, 34, top + 12, top - 8, 3);
    c.fillStyle = fill; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
    if (lvl) {
      // внутренняя кайма рамы
      envArchPath(c, 29.5, top + 14, top - 3, 3);
      c.strokeStyle = { boss: 'rgba(220,200,170,0.35)', treasure: 'rgba(255,250,210,0.75)', devil: 'rgba(255,40,30,0.55)', angel: 'rgba(225,185,80,0.9)' }[kind] || 'rgba(0,0,0,0.2)';
      c.lineWidth = 1.6; c.stroke();
      if (kind === 'treasure') for (const t of [0.2, 0.5, 0.8]) circle(c, envQ(-31, 0, 31, t), envQ(top + 13, top - 5, top + 13, t), 1.8, t === 0.5 ? '#e83030' : '#fff6c8');
    }
  }
  // проём
  if (flesh) fixAFleshMaw(c, top, open, lvl);
  else {
    envArchPath(c, 24, top + 16, top + 2, 1);
    if (lvl) {
      const g = c.createLinearGradient(0, top, 0, 1);
      if (kind === 'angel') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f4e6b8'); }
      else if (kind === 'devil') { g.addColorStop(0, '#000'); g.addColorStop(1, '#4a0606'); }
      else { g.addColorStop(0, '#000'); g.addColorStop(1, '#1c100a'); }
      c.fillStyle = g;
    } else c.fillStyle = kind === 'angel' ? '#fffbe8' : '#080404';
    c.fill();
  }
  if (!open && !flesh) {
    c.save(); c.clip();
    if (kind === 'boss') {
      c.fillStyle = '#2a0808'; c.fillRect(-25, top, 50, -top + 2);
      if (lvl) envSoft(c, 0, -14, 22, '255,30,20', 0.35);
      for (let i = -2; i <= 2; i++) {
        line(c, i * 9, top + 6, i * 9, 2, lvl ? '#4a4a50' : '#8a8a8a', 3.5);
        if (lvl) line(c, i * 9 - 0.8, top + 6, i * 9 - 0.8, 2, '#b0b2ba', 1.2);
      }
      if (lvl) { c.fillStyle = '#3a3a40'; c.fillRect(-25, -26, 50, 4); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-25, -26, 50, 1); }
    } else if (kind === 'angel') {
      c.fillStyle = '#d8dce8'; c.fillRect(-25, top, 50, -top + 2);
      if (lvl) {
        c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, top, 25, -top + 2);
        line(c, 0, top + 4, 0, 2, '#9aa0b0', 1.5);
        line(c, -10, -30, -10, -12, '#d8b050', 2.4); line(c, -15, -24, -5, -24, '#d8b050', 2.4);
        line(c, 10, -30, 10, -12, '#d8b050', 2.4); line(c, 5, -24, 15, -24, '#d8b050', 2.4);
      }
    } else {
      const devil = kind === 'devil';
      envDoorLeaves(c, top, devil ? '#3a0a0a' : '#5c3c24', devil ? '#1a0606' : '#3a3c44', lvl);
    }
    c.restore();
  }
  if (!open && door.locked) envPadlock(c, 0, -16, lvl);
  // порог
  if (lvl) { rrect(c, -27, -2.5, 54, 5, 2, 'rgba(0,0,0,0.35)'); line(c, -26, -2.2, 26, -2.2, 'rgba(255,255,255,0.12)', 1); }
  // украшения
  if (kind === 'boss') {
    if (lvl) for (const k of [-1, 1]) envHorn(c, k, top, '#e0d6c2', 'rgba(90,70,50,0.6)');
    else for (const k of [-1, 1]) poly(c, [k * 30, top + 14, k * 46, top - 2, k * 36, top + 22], '#d8d0c0', OUT, 2);
    circle(c, 0, top + 3, lvl ? 7.5 : 6, '#e8e0d0', OUT, 1.5);
    if (lvl) {
      rrect(c, -4, top + 8, 8, 4.5, 1.5, '#d8cfbc', OUT, 1.2);
      for (const k of [-1, 1]) { circle(c, k * 2.8, top + 2.5, 2.1, '#1a0606'); circle(c, k * 2.8, top + 2.5, 1, '#ff3a2a'); }
      ellipse(c, -2.5, top - 1.5, 2.5, 1.2, 'rgba(255,255,255,0.6)', null, 0, -0.4);
    } else { circle(c, -2, top + 2, 1.4, '#111'); circle(c, 2, top + 2, 1.4, '#111'); }
  } else if (kind === 'treasure') {
    poly(c, [-8, top + 6, -8, top - 2, -4, top + 2, 0, top - 4, 4, top + 2, 8, top - 2, 8, top + 6], '#ffe060', OUT, 1.5);
    if (lvl) { circle(c, 0, top + 2.5, 1.6, '#e83030'); line(c, -6, top + 4.5, 6, top + 4.5, 'rgba(160,110,20,0.7)', 1); }
  } else if (kind === 'shop') {
    if (lvl) {
      line(c, -7, top - 4, -7, top + 1, '#3a2a20', 1); line(c, 7, top - 4, 7, top + 1, '#3a2a20', 1);
      rrect(c, -11, top - 5, 22, 15, 2.5, '#8a5e36', OUT, 1.5);
      line(c, -10, top - 3.6, 10, top - 3.6, 'rgba(255,255,255,0.2)', 1);
      drawCoin(c, 0, top + 2.5, 5, 1);
    } else drawCoin(c, 0, top + 2, 6, 1);
  } else if (kind === 'devil') {
    if (lvl) for (const k of [-1, 1]) envHorn(c, k * 0.82, top + 2, '#8a1010', 'rgba(0,0,0,0.5)');
    else for (const k of [-1, 1]) poly(c, [k * 22, top + 10, k * 34, top - 8, k * 30, top + 16], '#8a1010', OUT, 2);
  } else if (kind === 'angel' && lvl) {
    for (const k of [-1, 1]) {
      c.beginPath(); c.moveTo(k * 33, top + 18); c.quadraticCurveTo(k * 50, top + 2, k * 46, top + 26); c.quadraticCurveTo(k * 42, top + 22, k * 34, top + 30); c.closePath();
      c.fillStyle = '#f6f7fb'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
      line(c, k * 37, top + 22, k * 44, top + 14, 'rgba(120,130,155,0.5)', 1);
    }
    circle(c, 0, top + 1, 3.2, '#ffe060', OUT, 1.2);
  }
  c.restore();
}

// ---------- виньетка и цветокоррекция ----------
// На высоком качестве в виньетку запечён лёгкий цветовой тон главы (бесплатно по времени кадра).
let VIGNETTE = null;
const envGradeCols = { 1: '255,170,100', 2: '150,175,200', 3: '100,125,190', 4: '215,50,60', devil: '230,30,20', angel: '255,240,200' };
function envVigKey() {
  const lvl = gfxLevel();
  return lvl + '|' + (lvl === 2 && G.room ? envChapter(G.room) : '') + '|' + PIXEL_SCALE;
}
function buildVignette() {
  const lvl = gfxLevel();
  const v = makeCanvas(W, H);
  const c = v.ctx;
  if (lvl === 2 && G.room) {
    c.fillStyle = 'rgba(' + envGradeCols[envChapter(G.room)] + ',0.05)';
    c.fillRect(RX - WALL, RY - WALL, RW + 2 * WALL, RH + 2 * WALL);
  }
  const g = c.createRadialGradient(W / 2, H / 2, H * (lvl === 2 ? 0.3 : 0.32), W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  if (lvl === 2) g.addColorStop(0.55, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,' + (lvl === 2 ? 0.7 : 0.62) + ')');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  v.envKey = envVigKey();
  VIGNETTE = v;
}

// ---------- частицы ----------
function updateParticles() {
  for (const q of G.particles) {
    q.x += q.vx; q.y += q.vy;
    q.vx *= 0.93; q.vy *= 0.93;
    q.life--;
    if (q.grav) {
      q.z += q.vz; q.vz -= 0.35;
      if (q.z < 0) { q.z = 0; q.vz = 0; q.vx *= 0.4; q.vy *= 0.4; }
    }
  }
  G.particles = G.particles.filter(q => q.life > 0);
}
// вид частицы по цвету: 0 — обычная, 1 — кровь, 2 — дым, 3 — каменная крошка, 4 — искра/огонь
const envPartKinds = new Map();
function envPartKind(q) {
  const col = q.color;
  if (typeof col !== 'string') return 0;
  if (q.grav) {
    const pal = G.room ? paletteFor(G.room) : null;
    return pal && (col === pal.rock || col === pal.rock2) ? 3 : 1;
  }
  let k = envPartKinds.get(col);
  if (k === undefined) {
    k = 0;
    if (col[0] === '#') {
      const [r, g, b] = envRgb(col);
      if (Math.abs(r - g) < 16 && Math.abs(g - b) < 16 && r < 200) k = 2;
      else if (r > 220 && g > 70 && b < 120) k = 4;
    }
    if (envPartKinds.size < 256) envPartKinds.set(col, k);
  }
  return k;
}
function drawParticles(c) {
  const lvl = gfxLevel();
  // подробно рисуется ограниченное число частиц — в массовой каше остальные простыми кружками
  let fancy = lvl === 2 ? 220 : 140;
  for (const q of G.particles) {
    const life = q.life / q.max, a = Math.min(1, life * 2);
    let k = q.ek;
    if (k === undefined) k = q.ek = envPartKind(q);
    const sz = q.size * (0.5 + 0.5 * life), y = q.y - q.z;
    c.globalAlpha = a;
    if (!lvl || k === 0 || fancy-- <= 0) { circle(c, q.x, y, sz, q.color); continue; }
    if (k === 1) {
      // капля крови: тёмная середина и блик; на полу — сплющенная
      const dk = q.color[0] === '#' ? mixColor(q.color, '#000000', 0.45) : q.color;
      if (q.z > 0.5) {
        circle(c, q.x, y, sz, q.color);
        circle(c, q.x + sz * 0.2, y + sz * 0.25, sz * 0.6, dk);
      } else {
        ellipse(c, q.x, y, sz * 1.25, sz * 0.7, q.color);
        ellipse(c, q.x + sz * 0.15, y + sz * 0.1, sz * 0.8, sz * 0.42, dk);
      }
      if (lvl === 2) { c.fillStyle = 'rgba(255,225,225,0.6)'; c.fillRect(q.x - sz * 0.55, y - sz * 0.5, sz * 0.45, sz * 0.35); }
    } else if (k === 2) {
      // дым: клуб растёт, поднимается и тает
      const grow = q.size * (1 + (1 - life) * 1.8), yy = y - (1 - life) * 6;
      c.globalAlpha = Math.min(1, life * 1.4) * 0.55;
      circle(c, q.x, yy, grow, q.color);
      if (lvl === 2) { c.globalAlpha *= 0.7; circle(c, q.x - grow * 0.3, yy - grow * 0.3, grow * 0.55, mixColor(q.color, '#ffffff', 0.3)); }
    } else if (k === 3) {
      // каменная крошка: светлый верх, тёмный низ
      c.fillStyle = q.color; c.fillRect(q.x - sz, y - sz * 0.8, sz * 2, sz * 1.6);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(q.x - sz, y - sz * 0.8, sz * 2, sz * 0.5);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(q.x - sz, y + sz * 0.4, sz * 2, sz * 0.4);
    } else {
      // искры: на высоком — росчерк по скорости и белое ядро
      if (lvl === 2) {
        line(c, q.x - q.vx * 2.2, y - q.vy * 2.2, q.x, y, q.color, sz * 1.1);
        circle(c, q.x, y, sz * 0.5, '#fff6c8');
      } else { circle(c, q.x, y, sz, q.color); circle(c, q.x, y, sz * 0.45, '#fff0b0'); }
    }
  }
  c.globalAlpha = 1;
}

// ---------- освещение ----------
// Один атлас радиальных пятен (цвет × радиус), нарисованный в пикселях экрана:
// источники выводятся пиксель-в-пиксель с режимом 'lighter'. Не более 32 источников.
const envLightCols = { fire: '255,140,50', hell: '255,40,70', tear: '130,190,255', blast: '255,180,80', brim: '255,30,20', tint: '100,200,255', holy: '255,245,215' };
const envLightR = [20, 46, 90];
let envLightAtlas = null;
function envBuildLights() {
  const S = PIXEL_SCALE, keys = Object.keys(envLightCols);
  const rd = envLightR.map(r => Math.ceil(r * S));
  const cell = rd.map(r => 2 * r + 2);
  const cv = document.createElement('canvas');
  cv.width = keys.length * cell[cell.length - 1];
  cv.height = cell.reduce((a, b) => a + b, 0);
  const c = cv.getContext('2d');
  const cells = {};
  let y = 0;
  rd.forEach((r, ri) => {
    keys.forEach((k, ci) => {
      const x = ci * cell[ri], cx = x + r + 1, cy = y + r + 1, col = envLightCols[k];
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(' + col + ',1)'); g.addColorStop(0.22, 'rgba(' + col + ',0.62)');
      g.addColorStop(0.5, 'rgba(' + col + ',0.22)'); g.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = g; c.fillRect(x, y, cell[ri], cell[ri]);
      (cells[k] = cells[k] || [])[ri] = { sx: x, sy: y, s: cell[ri], r: envLightR[ri] };
    });
    y += cell[ri];
  });
  envLightAtlas = { cv, cells, scale: S };
}
const envLights = [];
let envLightN = 0, envLightCap = 32;
function envAddLight(x, y, col, ri, a) {
  if (envLightN >= envLightCap || a <= 0.01) return;
  const L = envLights[envLightN] || (envLights[envLightN] = { x: 0, y: 0, col: '', ri: 0, a: 0 });
  L.x = x; L.y = y; L.col = col; L.ri = ri; L.a = a > 1 ? 1 : a;
  envLightN++;
}
function envLighting(c, room, lvl, dark) {
  if (!envLightAtlas || envLightAtlas.scale !== PIXEL_SCALE) envBuildLights();
  const hi = lvl === 2, t = G.t, boost = dark ? 1.35 : 1;
  envLightN = 0; envLightCap = hi ? 32 : 12;
  // взрывы (эффект взрыва живёт 26 кадров)
  for (const fx of G.effects) {
    if (fx.life !== 26 || fx.x == null) continue;
    const q = 1 - fx.t / fx.life;
    envAddLight(fx.x, fx.y, 'blast', 2, q * (hi ? 0.95 : 0.6));
    if (hi) envAddLight(fx.x, fx.y, 'blast', 1, q * 0.7);
  }
  // костры и меченые камни
  const grid = room.grid;
  for (let i = 0; i < grid.length; i++) {
    const tl = grid[i];
    if (tl.t !== 'f' && (tl.t !== 't' || !hi)) continue;
    const x = RX + (i % COLS) * T + T / 2, y = RY + ((i / COLS) | 0) * T + T / 2;
    if (tl.t === 't') { envAddLight(x, y - 4, 'tint', 0, 0.2 + Math.sin(t * 0.08 + i) * 0.1); continue; }
    if (tl.hp <= 0) continue;
    const fl = 0.85 + Math.sin(t * 0.23 + i * 1.7) * 0.09 + Math.sin(t * 0.61 + i) * 0.06;
    const col = room.type === 'devil' ? 'hell' : 'fire';
    envAddLight(x, y - 6, col, 2, (hi ? 0.42 : 0.26) * fl * boost);
    if (hi) envAddLight(x, y - 12, col, 1, 0.3 * fl * boost);
  }
  // лучи
  for (const b of G.beams) {
    if (b.ex == null) continue;
    const brim = b.kind === 'brim', q = Math.min(1, b.life / b.max * 2);
    const n = Math.min(brim ? 6 : 3, 1 + (Math.hypot(b.ex - b.x, b.ey - b.y) / 90 | 0));
    for (let j = 0; j <= n; j++) envAddLight(b.x + (b.ex - b.x) * j / n, b.y - 10 + (b.ey - b.y) * j / n, 'brim', brim ? 1 : 0, (brim ? 0.45 : 0.35) * q);
  }
  // свет сделок
  if (room.type === 'angel') envAddLight(RX + RW / 2, RY + T * 1.2, 'holy', 2, 0.25 + Math.sin(t * 0.05) * 0.05);
  for (const d of DIR_NAMES) {
    const door = room.doors[d];
    if (!door || (door.kind !== 'devil' && door.kind !== 'angel') || (door.hidden && room.type !== 'secret')) continue;
    const [dx, dy] = doorCenter(d);
    envAddLight(dx, dy, door.kind === 'devil' ? 'hell' : 'holy', 1, 0.32 + 0.12 * Math.sin(t * 0.07));
  }
  if (hi) {
    for (const b of G.bombs) envAddLight(b.x, b.y - 18, 'fire', 0, 0.35 + (b.t & 4 ? 0.15 : 0));
    for (const tr of G.tears) if (!tr.enemy) envAddLight(tr.x, tr.y - tr.z * 0.5, 'tear', 0, 0.2);
  }
  if (!envLightN) return;
  const A = envLightAtlas;
  c.globalCompositeOperation = 'lighter';
  if (envM.fast) c.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < envLightN; j++) {
    const L = envLights[j], cl = A.cells[L.col][L.ri];
    c.globalAlpha = L.a;
    if (envM.fast) c.drawImage(A.cv, cl.sx, cl.sy, cl.s, cl.s, Math.round(L.x * envM.a + envM.e - cl.s / 2), Math.round(L.y * envM.a + envM.f - cl.s / 2), cl.s, cl.s);
    else c.drawImage(A.cv, cl.sx, cl.sy, cl.s, cl.s, L.x - cl.r - 1, L.y - cl.r - 1, cl.r * 2 + 2, cl.r * 2 + 2);
  }
  if (envM.fast) c.setTransform(envM.a, 0, 0, envM.a, envM.e, envM.f);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

// проклятие тьмы: готовое пятно света + сплошная тьма вокруг (без градиента каждый кадр)
let envDarkSpr = null;
function envDarkness(c, x, y) {
  const R = 250, X0 = RX - WALL - 20, Y0 = RY - WALL - 20, X1 = RX + RW + WALL + 20, Y1 = RY + RH + WALL + 20;
  if (!envM.fast) {
    const g = c.createRadialGradient(x, y, 40, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = g; c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    return;
  }
  if (!envDarkSpr || envDarkSpr.scale !== PIXEL_SCALE) {
    const s = envSprite(R * 2, R * 2, R, R);
    const g = s.ctx.createRadialGradient(R, R, 40, R, R, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    s.ctx.fillStyle = g; s.ctx.fillRect(-2, -2, R * 2 + 4, R * 2 + 4);
    s.scale = PIXEL_SCALE;
    envDarkSpr = s;
  }
  const a = envM.a, D = envDarkSpr;
  const dx = Math.round((x - R) * a + envM.e), dy = Math.round((y - R) * a + envM.f), dw = D.cv.width, dh = D.cv.height;
  const rx0 = Math.floor(X0 * a + envM.e), ry0 = Math.floor(Y0 * a + envM.f), rx1 = Math.ceil(X1 * a + envM.e), ry1 = Math.ceil(Y1 * a + envM.f);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(D.cv, dx, dy);
  c.fillStyle = 'rgba(0,0,0,0.92)';
  if (dy > ry0) c.fillRect(rx0, ry0, rx1 - rx0, dy - ry0);
  if (dy + dh < ry1) c.fillRect(rx0, dy + dh, rx1 - rx0, ry1 - dy - dh);
  const ty0 = Math.max(ry0, dy), ty1 = Math.min(ry1, dy + dh);
  if (ty1 > ty0) {
    if (dx > rx0) c.fillRect(rx0, ty0, dx - rx0, ty1 - ty0);
    if (dx + dw < rx1) c.fillRect(dx + dw, ty0, rx1 - dx - dw, ty1 - ty0);
  }
  c.setTransform(a, 0, 0, a, envM.e, envM.f);
}

// заметность снарядов во тьме: вражеские снаряды повторно рисуются поверх тьмы
// с прозрачностью по её густоте (у героя — ничего, чтобы не удваивать); «Высокая» — частично, «Максимальная» — полностью
function fixAShotsOverDark(c, x, y) {
  const k = projLevel() === 2 ? 1 : 0.55, a0 = c.globalAlpha;
  for (const t of G.tears) {
    if (!t.enemy || t.dead) continue;
    const d = Math.hypot(t.x - x, t.y - t.z - y), q = (d - 40) / 105; // тьма от 40 до 250 px
    if (q <= 0) continue;
    c.globalAlpha = a0 * k * (q > 1 ? 1 : q);
    drawEnemyShot(c, t.x, t.y - t.z, t.r, G.t);
  }
  c.globalAlpha = a0;
}

// плёночное зерно (высокое качество): плитка шума с прозрачностью в пикселях экрана,
// выводится 1:1 со сдвигом каждые 2 кадра (заливка узором в разы дороже)
let envGrainCv = null;
function envGrain(c) {
  if (!envM.fast) return;
  const N = 256;
  if (!envGrainCv) {
    envGrainCv = document.createElement('canvas');
    envGrainCv.width = envGrainCv.height = N;
    const g = envGrainCv.getContext('2d'), id = g.createImageData(N, N);
    let s = 1234567;
    for (let i = 0; i < id.data.length; i += 4) {
      s = (Math.imul(s, 1103515245) + 12345) | 0;
      const v = (s >>> 16) & 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v > 127 ? 255 : 0;
      id.data[i + 3] = (Math.abs(v - 127.5) / 127.5 * 13) | 0;
    }
    g.putImageData(id, 0, 0);
  }
  const a = envM.a, o = (G.t >> 1) * 37;
  const ox = o % N, oy = (o * 7) % N;
  const x0 = Math.floor((RX - WALL) * a + envM.e), y0 = Math.floor((RY - WALL) * a + envM.f);
  const x1 = Math.ceil((RX + RW + WALL) * a + envM.e), y1 = Math.ceil((RY + RH + WALL) * a + envM.f);
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = y0 - oy; y < y1; y += N) for (let x = x0 - ox; x < x1; x += N) {
    const sx = Math.max(0, x0 - x), sy = Math.max(0, y0 - y);
    const w = Math.min(N, x1 - x) - sx, h = Math.min(N, y1 - y) - sy;
    if (w > 0 && h > 0) c.drawImage(envGrainCv, sx, sy, w, h, x + sx, y + sy, w, h);
  }
  c.setTransform(a, 0, 0, a, envM.e, envM.f);
}

// ---------- весь мир ----------
function renderWorld(c, noShake) {
  const room = G.room, p = G.player;
  const lvl = gfxLevel();
  c.save();
  if (!noShake && G.shake > 0.5 && Settings.v.shake) c.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  envSetM(c);
  if (!G.bgCache) G.bgCache = buildRoomBg(room);
  envBlit(c, G.bgCache, RX - WALL, RY - WALL);
  drawDoors(c);
  for (const o of room.objects) if (o.kind === 'trapdoor') o.draw(c);

  const pal = paletteFor(room);
  const L = [];
  for (let i = 0; i < room.grid.length; i++) {
    const t = room.grid[i].t;
    if (t === 'r' || t === 't' || t === 'm' || t === 'p' || t === 'f' || t === 'S') L.push({ y: RY + ((i / COLS) | 0) * T + T * 0.65, i });
  }
  for (const o of room.objects) if (o.kind !== 'trapdoor') L.push({ y: o.y, o });
  for (const o of room.pedestals) L.push({ y: o.y, o });
  for (const o of room.pickups) L.push({ y: o.y, o });
  for (const o of G.bombs) L.push({ y: o.y, o });
  for (const o of G.enemies) L.push({ y: o.y + (o.type === 'momFoot' ? 400 : 0), o });
  for (const o of p.familiars) L.push({ y: o.y, o });
  L.push({ y: p.y, o: p });
  for (const o of G.tears) L.push({ y: o.y + 1, o });
  L.sort((a, b) => a.y - b.y);
  for (const it of L) {
    if (it.o) it.o.draw(c);
    else drawTile(c, room.grid[it.i], it.i, pal);
  }
  for (const b of G.beams) b.draw(c);
  drawParticles(c);
  for (const fx of G.effects) fx.draw(c, fx);

  envSetM(c);
  const dark = G.floor && G.floor.curse === 'darkness' && room.type !== 'angel';
  if (dark) {
    envDarkness(c, p.x, p.y - 15);
    // во тьме костры видны издалека
    if (lvl) for (let i = 0; i < room.grid.length; i++) {
      const tl = room.grid[i];
      if (tl.t === 'f' && tl.hp > 0) envFlame(c, RX + (i % COLS) * T + T / 2, RY + ((i / COLS) | 0) * T + T / 2, Math.min(1, tl.hp / 4) * 0.4 + 0.6, room.type === 'devil', i, lvl);
    }
  }
  if (lvl) envLighting(c, room, lvl, dark);
  if (dark && projLevel()) fixAShotsOverDark(c, p.x, p.y - 15);
  if (lvl === 2) envGrain(c);
  c.restore();
  if (!VIGNETTE || VIGNETTE.envKey !== envVigKey()) buildVignette();
  const vm = c.getTransform();
  if (vm.b === 0 && vm.c === 0 && vm.a === vm.d && Math.abs(vm.a - PIXEL_SCALE) < 1e-6) {
    c.setTransform(1, 0, 0, 1, vm.e, vm.f);
    c.drawImage(VIGNETTE.cv, 0, 0);
    c.setTransform(vm);
  } else c.drawImage(VIGNETTE.cv, 0, 0, W, H);
  if (G.slowT > 0) { c.fillStyle = 'rgba(120,150,255,0.08)'; c.fillRect(0, 0, W, H); }
  if (G.hurtFlash > 0) { c.fillStyle = 'rgba(200,0,0,' + (G.hurtFlash / 10 * 0.25) + ')'; c.fillRect(0, 0, W, H); }
  if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (G.flash / 20) + ')'; c.fillRect(0, 0, W, H); }
}
