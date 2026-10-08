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

// ---------- Сердца, монеты, ключи и т.д. ----------
function heartPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + 0.42 * s);
  c.bezierCurveTo(x - 0.62 * s, y + 0.02 * s, x - 0.52 * s, y - 0.52 * s, x, y - 0.2 * s);
  c.bezierCurveTo(x + 0.52 * s, y - 0.52 * s, x + 0.62 * s, y + 0.02 * s, x, y + 0.42 * s);
  c.closePath();
}
function drawHeart(c, x, y, s, kind) {
  const red = kind === 'red' || kind === 'half';
  const soul = kind === 'soul' || kind === 'halfSoul';
  const col = soul ? '#6f9ee8' : '#d42c2c';
  const hi = soul ? '#b8d4ff' : '#ff7a7a';
  heartPath(c, x, y, s);
  c.fillStyle = kind === 'empty' ? 'rgba(20,10,10,0.6)' : '#1a0d0d';
  c.fill();
  if (kind !== 'empty') {
    c.save();
    if (kind === 'half' || kind === 'halfSoul') { c.beginPath(); c.rect(x - s, y - s, s, s * 2); c.clip(); }
    heartPath(c, x, y, s * 0.82);
    c.fillStyle = col; c.fill();
    ellipse(c, x - s * 0.18, y - s * 0.12, s * 0.1, s * 0.07, hi);
    c.restore();
  }
  heartPath(c, x, y, s);
  c.strokeStyle = '#120808'; c.lineWidth = Math.max(1.2, s * 0.09); c.stroke();
  if (red && false) return;
}
function drawCoin(c, x, y, r, value = 1) {
  const col = value >= 10 ? '#8fd3ff' : value >= 5 ? '#d8dde6' : '#f2c53d';
  const dark = value >= 10 ? '#3e7ea8' : value >= 5 ? '#7e8590' : '#9a6f12';
  circle(c, x, y, r, dark, OUT, 1.5);
  circle(c, x - r * 0.08, y - r * 0.08, r * 0.78, col);
  ellipse(c, x - r * 0.3, y - r * 0.32, r * 0.22, r * 0.14, '#fff', null, 0, -0.6);
  if (value === 1) { c.fillStyle = dark; c.fillRect(x - r * 0.12, y - r * 0.38, r * 0.24, r * 0.76); }
}
function drawKey(c, x, y, s, col = '#f0c94a') {
  c.save(); c.translate(x, y); c.rotate(-0.6);
  circle(c, -s * 0.45, 0, s * 0.3, col, OUT, 1.6);
  circle(c, -s * 0.45, 0, s * 0.12, '#1a1010');
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.4;
  c.beginPath(); c.rect(-s * 0.18, -s * 0.09, s * 0.75, s * 0.18); c.fill(); c.stroke();
  c.beginPath(); c.rect(s * 0.35, s * 0.05, s * 0.12, s * 0.2); c.rect(s * 0.15, s * 0.05, s * 0.1, s * 0.16); c.fill(); c.stroke();
  c.restore();
}
function drawBomb(c, x, y, r, t = 0, flash = false) {
  circle(c, x, y, r, flash ? '#c43030' : '#262628', '#0a0a0a', 1.8);
  ellipse(c, x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.18, 'rgba(255,255,255,0.55)', null, 0, -0.7);
  c.fillStyle = '#555'; c.fillRect(x - r * 0.25, y - r * 1.1, r * 0.5, r * 0.3);
  c.beginPath(); c.moveTo(x, y - r * 1.1); c.quadraticCurveTo(x + r * 0.5, y - r * 1.6, x + r * 0.3, y - r * 1.9);
  c.strokeStyle = '#c9a26b'; c.lineWidth = 2; c.stroke();
  if (t >= 0) {
    const sp = 2 + Math.sin(t * 0.8) * 1.5;
    circle(c, x + r * 0.3, y - r * 1.9, sp + 1.5, 'rgba(255,200,60,0.7)');
    circle(c, x + r * 0.3, y - r * 1.9, sp * 0.6, '#fff8c0');
  }
}
function drawPill(c, x, y, s, cols, rot = -0.6) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const w = s, h = s * 0.48;
  c.save();
  rrect(c, -w / 2, -h / 2, w, h, h / 2, null);
  c.clip();
  c.fillStyle = cols[0]; c.fillRect(-w / 2, -h / 2, w / 2, h);
  c.fillStyle = cols[1]; c.fillRect(0, -h / 2, w / 2, h);
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-w / 2 + 2, -h / 2 + 1.5, w - 4, h * 0.22);
  c.restore();
  rrect(c, -w / 2, -h / 2, w, h, h / 2, null, OUT, 1.6);
  c.restore();
}
function drawCard(c, x, y, s, col = '#d8c27a') {
  c.save(); c.translate(x, y); c.rotate(0.15);
  rrect(c, -s * 0.36, -s * 0.5, s * 0.72, s, 3, '#f4ecd8', OUT, 1.6);
  rrect(c, -s * 0.26, -s * 0.4, s * 0.52, s * 0.8, 2, col);
  circle(c, 0, 0, s * 0.13, '#fff8');
  c.restore();
}
function drawChest(c, x, y, gold, open) {
  const body = gold ? '#e2b33c' : '#8a5a2e', dark = gold ? '#9a7316' : '#5a3a1c', band = gold ? '#fff0a8' : '#c9a15e';
  shadow(c, x, y + 10, 18, 6);
  rrect(c, x - 17, y - 8, 34, 20, 3, body, OUT, 2);
  c.fillStyle = dark; c.fillRect(x - 17, y + 2, 34, 3);
  if (!open) {
    rrect(c, x - 18, y - 18, 36, 12, 4, body, OUT, 2);
    c.fillStyle = band; c.fillRect(x - 3, y - 14, 6, 10);
    if (gold) circle(c, x, y - 4, 2.5, '#222');
  } else {
    poly(c, [x - 18, y - 8, x + 18, y - 8, x + 14, y - 22, x - 14, y - 22], dark, OUT, 2);
    c.fillStyle = '#1a0f08'; c.fillRect(x - 15, y - 8, 30, 4);
  }
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
// ============================================================
function eyeShape(c, x, y, rx, ry, iris = '#3a6fb0') {
  ellipse(c, x, y, rx, ry, '#f6f1ea', OUT, 1.6);
  circle(c, x, y, ry * 0.75, iris);
  circle(c, x, y, ry * 0.38, '#111');
  circle(c, x - ry * 0.25, y - ry * 0.3, ry * 0.18, '#fff');
}
function bookShape(c, cover, mark) {
  rrect(c, -11, -14, 22, 28, 3, cover, OUT, 2);
  c.fillStyle = '#efe6d0'; c.fillRect(8, -12, 3, 24);
  if (mark) mark();
}
function dropShape(c, x, y, s, col) {
  c.beginPath(); c.moveTo(x, y - s);
  c.bezierCurveTo(x + s * 0.9, y - s * 0.1, x + s * 0.8, y + s * 0.8, x, y + s * 0.8);
  c.bezierCurveTo(x - s * 0.8, y + s * 0.8, x - s * 0.9, y - s * 0.1, x, y - s);
  c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke();
}
function babyHead(c, skin, extra) {
  circle(c, 0, 2, 12, skin, OUT, 2);
  ellipse(c, -4.5, 2, 2.6, 3.4, '#111'); ellipse(c, 4.5, 2, 2.6, 3.4, '#111');
  circle(c, -5.2, 0.8, 0.9, '#fff'); circle(c, 3.8, 0.8, 0.9, '#fff');
  c.beginPath(); c.arc(0, 10, 3, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
  if (extra) extra();
}

const ICONS = {
  onion(c) {
    ellipse(c, 0, 4, 12, 11, '#c69bd6', OUT, 2);
    line(c, -2, -7, -4, -14, '#5aa84a', 3); line(c, 2, -7, 4, -15, '#5aa84a', 3);
    ellipse(c, -4, 3, 1.8, 2.4, '#222'); ellipse(c, 4, 3, 1.8, 2.4, '#222');
    c.beginPath(); c.arc(0, 11, 3, Math.PI * 1.2, Math.PI * 1.8); c.strokeStyle = '#222'; c.lineWidth = 1.4; c.stroke();
    dropShape(c, -6, 9, 2.6, '#8cc8ff');
  },
  syringe(c) {
    c.rotate(-0.75);
    rrect(c, -4, -9, 8, 18, 2, '#e6eef2', OUT, 1.8);
    c.fillStyle = '#9b59d0'; c.fillRect(-2.5, -2, 5, 10);
    line(c, 0, 9, 0, 16, '#cfd8dc', 1.6);
    line(c, 0, -9, 0, -14, '#888', 3); line(c, -5, -14, 5, -14, '#888', 3);
  },
  blood(c) { dropShape(c, 0, -1, 13, '#c41e1e'); ellipse(c, -4, -2, 2, 4, '#ff7070', null, 0, 0.3); },
  pentagram(c) {
    circle(c, 0, 0, 14, '#2a1010', '#c42424', 2.2);
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 12, Math.sin(a) * 12); }
    c.closePath(); c.strokeStyle = '#e03030'; c.lineWidth = 2; c.stroke();
  },
  mushroom(c) {
    rrect(c, -5, 0, 10, 14, 4, '#efe2c4', OUT, 1.8);
    c.beginPath(); c.moveTo(-15, 3); c.quadraticCurveTo(0, -24, 15, 3); c.closePath();
    c.fillStyle = '#d42c2c'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    circle(c, -6, -4, 2.8, '#fff'); circle(c, 4, -8, 3.2, '#fff'); circle(c, 8, -1, 2, '#fff');
  },
  innerEye(c) {
    eyeShape(c, 0, 0, 14, 9, '#f6f1ea');
    circle(c, -5, 0, 2.6, '#222'); circle(c, 0, 0, 2.6, '#222'); circle(c, 5, 0, 2.6, '#222');
  },
  twenty(c) {
    circle(c, -7, 0, 6.5, 'rgba(160,210,255,0.4)', '#333', 2.2); circle(c, 7, 0, 6.5, 'rgba(160,210,255,0.4)', '#333', 2.2);
    line(c, -1, 0, 1, 0, '#333', 2); line(c, -13, -1, -16, -4, '#333', 2); line(c, 13, -1, 16, -4, '#333', 2);
  },
  homing(c) {
    circle(c, 0, 0, 13, '#3a1f4a', '#c27cf0', 2.2);
    circle(c, 0, 0, 7, null, '#c27cf0', 1.6);
    line(c, -13, 0, 13, 0, '#c27cf0', 1.2); line(c, 0, -13, 0, 13, '#c27cf0', 1.2);
    circle(c, 0, 0, 2.5, '#f0d0ff');
  },
  cupid(c) {
    c.rotate(-0.78);
    line(c, -14, 0, 12, 0, '#8a5a2e', 2.5);
    poly(c, [14, 0, 8, -4, 8, 4], '#cfd8dc', OUT, 1.2);
    poly(c, [-14, 0, -10, -5, -7, -5, -10, 0, -7, 5, -10, 5], '#f07aa0', OUT, 1);
    c.rotate(0.78); heartPath(c, 5, 6, 10); c.fillStyle = '#f04a6a'; c.fill();
  },
  spectral(c) {
    c.globalAlpha = 0.85;
    eyeShape(c, 0, 0, 13, 9, '#9fd8ff');
    c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) line(c, -12 + i * 8, 12, -14 + i * 8, 16, 'rgba(200,230,255,0.8)', 1.5);
  },
  rubber(c) {
    circle(c, 0, 0, 13, '#e2443a', OUT, 2);
    c.beginPath(); c.arc(0, 0, 13, -0.5, 0.9); c.lineTo(0, 0); c.closePath(); c.fillStyle = '#f4e04a'; c.fill();
    ellipse(c, -5, -6, 4, 2.5, 'rgba(255,255,255,0.6)', null, 0, -0.6);
    circle(c, 0, 0, 13, null, OUT, 2);
  },
  poison(c) {
    dropShape(c, 0, 0, 12, '#5ccf4a');
    circle(c, -3, 1, 2.2, '#1f5a18'); circle(c, 3, 1, 2.2, '#1f5a18'); line(c, -3, 6, 3, 6, '#1f5a18', 1.6);
    circle(c, 10, -10, 2.4, '#8ce07a'); circle(c, -11, -7, 1.8, '#8ce07a');
  },
  slime(c) {
    c.beginPath(); c.moveTo(-14, 8);
    c.quadraticCurveTo(-14, -12, 0, -12); c.quadraticCurveTo(14, -12, 14, 8);
    c.lineTo(10, 8); c.quadraticCurveTo(8, 14, 6, 8); c.lineTo(-4, 8); c.quadraticCurveTo(-6, 15, -8, 8); c.closePath();
    c.fillStyle = '#b4c4b0'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    ellipse(c, -5, -5, 3.5, 2, 'rgba(255,255,255,0.6)');
  },
  wings(c) {
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.beginPath(); c.moveTo(2, 6); c.quadraticCurveTo(6, -14, 15, -12); c.quadraticCurveTo(14, 0, 2, 6);
      c.fillStyle = '#f6f6fa'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
      line(c, 4, 3, 12, -9, '#bbb', 1);
      c.restore();
    }
  },
  brimstone(c) {
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 4, 10); c.quadraticCurveTo(s * 16, 2, s * 12, -14); c.quadraticCurveTo(s * 9, 0, s * 1, 4); c.closePath();
      c.fillStyle = '#b01818'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke();
    }
    ellipse(c, 0, 10, 6, 3, '#ff5a2a');
  },
  tech(c) {
    circle(c, 0, 0, 13, '#8a929c', OUT, 2);
    circle(c, 0, 0, 7, '#2a2a30'); circle(c, 0, 0, 4, '#ff3030');
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; circle(c, Math.cos(a) * 10, Math.sin(a) * 10, 1.5, '#444'); }
  },
  polyphemus(c) {
    circle(c, 0, 0, 14, '#f3d9c9', OUT, 2);
    eyeShape(c, 0, -1, 10, 8, '#a8442a');
  },
  wiz(c) {
    poly(c, [-14, 12, 14, 12, 3, -15], '#3a52c4', OUT, 2);
    ellipse(c, 0, 12, 15, 3.5, '#2a3a96', OUT, 1.6);
    circle(c, -2, 2, 1.8, '#ffe866'); circle(c, 3, -5, 1.5, '#ffe866'); circle(c, 5, 6, 1.4, '#ffe866');
  },
  ipecac(c) {
    rrect(c, -8, -6, 16, 20, 4, '#7a4a22', OUT, 2);
    c.fillStyle = '#9ccf3a'; c.fillRect(-6, 2, 12, 10);
    rrect(c, -4, -14, 8, 9, 2, '#c49a5a', OUT, 1.6);
    c.fillStyle = '#f4ecd8'; c.fillRect(-6, -3, 12, 4);
  },
  sneakers(c) {
    poly(c, [-14, 8, -14, -2, -6, -4, -2, -10, 4, -8, 6, 0, 14, 3, 14, 8], '#e8e8ee', OUT, 2);
    c.fillStyle = '#d42c2c'; c.fillRect(-14, 6, 28, 3);
    line(c, -4, -6, 2, -5, '#3a6fd0', 2);
  },
  spyglass(c) {
    c.rotate(-0.5);
    rrect(c, -15, -4, 12, 8, 2, '#b88a3a', OUT, 1.6);
    rrect(c, -4, -5, 10, 10, 2, '#d4a84a', OUT, 1.6);
    rrect(c, 6, -6, 9, 12, 2, '#e6c264', OUT, 1.6);
    ellipse(c, 15, 0, 1.6, 5, '#9fd8ff');
  },
  slingshot(c) {
    line(c, 0, 14, 0, 0, '#8a5a2e', 4); line(c, 0, 0, -8, -12, '#8a5a2e', 4); line(c, 0, 0, 8, -12, '#8a5a2e', 4);
    c.beginPath(); c.moveTo(-8, -12); c.quadraticCurveTo(0, -2, 8, -12); c.strokeStyle = '#c44'; c.lineWidth = 1.5; c.stroke();
  },
  horseshoe(c) {
    c.beginPath(); c.arc(0, -2, 11, Math.PI * 0.9, Math.PI * 2.1, false);
    c.strokeStyle = OUT; c.lineWidth = 8; c.stroke();
    c.strokeStyle = '#b8bec8'; c.lineWidth = 5; c.stroke();
    for (const a of [3.4, 4.2, 5.2, 6]) circle(c, Math.cos(a) * 11, -2 + Math.sin(a) * 11, 1, '#333');
  },
  heartUp(c) { heartPath(c, 0, 1, 30); c.fillStyle = '#c42c3a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); ellipse(c, -6, -4, 3, 2, '#ff8a8a'); line(c, 2, -6, 8, -14, '#7a1a20', 3); },
  meat(c) {
    ellipse(c, 0, 4, 15, 9, '#f2f2f2', OUT, 2); ellipse(c, 0, 4, 10, 5.5, '#dcdcdc');
    ellipse(c, 0, 1, 9, 6, '#a0522d', OUT, 1.6); ellipse(c, -2, 0, 4, 2, '#d2804a');
  },
  rosary(c) {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; circle(c, Math.cos(a) * 10, -3 + Math.sin(a) * 9, 2.4, '#7a5ad0', OUT, 1); }
    line(c, 0, 6, 0, 16, '#e6c264', 3); line(c, -4, 10, 4, 10, '#e6c264', 3);
  },
  halo(c) {
    ellipse(c, 0, 0, 14, 6, null, '#8a6a10', 6);
    ellipse(c, 0, 0, 14, 6, null, '#ffe060', 3.5);
  },
  mantle(c) {
    poly(c, [0, -14, 12, -6, 14, 14, -14, 14, -12, -6], '#f2f2f8', OUT, 2);
    line(c, 0, -6, 0, 10, '#e6c264', 3); line(c, -5, -1, 5, -1, '#e6c264', 3);
  },
  cross(c) {
    rrect(c, -3.5, -14, 7, 28, 2, '#9a6a3a', OUT, 1.8);
    rrect(c, -10, -7, 20, 7, 2, '#9a6a3a', OUT, 1.8);
  },
  goat(c) {
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 4, -6); c.quadraticCurveTo(s * 18, -10, s * 14, 4); c.strokeStyle = '#d8c8a8'; c.lineWidth = 4; c.stroke(); }
    ellipse(c, 0, 2, 8, 11, '#3a3030', OUT, 2);
    circle(c, -3, -1, 1.8, '#ff3030'); circle(c, 3, -1, 1.8, '#ff3030');
  },
  pact(c) {
    rrect(c, -11, -13, 22, 26, 2, '#efe2c0', OUT, 2);
    for (let i = 0; i < 4; i++) line(c, -7, -8 + i * 4, 7, -8 + i * 4, '#8a7a5a', 1);
    circle(c, 4, 7, 4.5, '#b01818', OUT, 1.2);
  },
  bro(c) { babyHead(c, '#f3d9c9'); },
  sis(c) { babyHead(c, '#f3d9c9', () => { poly(c, [0, -10, -9, -15, -9, -5], '#f07aa0', OUT, 1.2); poly(c, [0, -10, 9, -15, 9, -5], '#f07aa0', OUT, 1.2); circle(c, 0, -10, 2.5, '#d84a7a'); }); },
  orbital(c) {
    ellipse(c, 0, 0, 15, 5, null, '#ffe060', 1.6);
    circle(c, 0, 0, 6, '#222', OUT, 1.5);
    ellipse(c, -5, -5, 5, 3, 'rgba(230,230,240,0.7)', null, 0, -0.4); ellipse(c, 5, -5, 5, 3, 'rgba(230,230,240,0.7)', null, 0, 0.4);
  },
  demon(c) {
    babyHead(c, '#4a4048', () => {
      poly(c, [-8, -7, -11, -16, -3, -10], '#222', OUT, 1); poly(c, [8, -7, 11, -16, 3, -10], '#222', OUT, 1);
    });
  },
  bombBag(c) {
    c.beginPath(); c.moveTo(-12, 14); c.quadraticCurveTo(-16, -4, -5, -8); c.lineTo(5, -8); c.quadraticCurveTo(16, -4, 12, 14); c.closePath();
    c.fillStyle = '#9a7040'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    line(c, -6, -8, 6, -8, '#5a3a1a', 3);
    drawBomb(c, 2, 4, 5, -1);
  },
  bigBombs(c) {
    drawBomb(c, 0, 3, 11, -1);
    text(c, '+', 10, -9, 16, '#ff4040', 'center');
  },
  piggy(c) {
    ellipse(c, 0, 2, 14, 10, '#f5a3c7', OUT, 2);
    ellipse(c, 12, 2, 4, 3.5, '#f07aa0', OUT, 1.4);
    poly(c, [-6, -6, -3, -13, 0, -7], '#f5a3c7', OUT, 1.4);
    circle(c, 4, -1, 1.5, '#222');
    c.fillStyle = '#7a3a50'; c.fillRect(-4, -8, 6, 2);
    for (const x of [-8, -2, 4]) c.fillRect(x, 10, 3, 4);
  },
  keyRing(c) {
    circle(c, 0, -6, 7, null, '#b8bec8', 2.5);
    c.save(); c.translate(-4, 4); drawKey(c, 0, 0, 14); c.restore();
    c.save(); c.translate(5, 5); c.rotate(0.9); drawKey(c, 0, 0, 14); c.restore();
  },
  lump(c) {
    poly(c, [-12, 4, -8, -9, 3, -12, 12, -4, 10, 9, -3, 12], '#1e1e22', '#000', 2);
    line(c, -6, -5, -1, -8, '#555', 2); circle(c, 5, 2, 1.5, '#ff7a30');
  },
  compass(c) {
    rrect(c, -14, -11, 28, 22, 2, '#e6d4a4', OUT, 2);
    c.beginPath(); c.moveTo(-10, 6); c.lineTo(-4, -2); c.lineTo(2, 3); c.lineTo(9, -6); c.setLineDash([2, 2]); c.strokeStyle = '#8a5a2e'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    line(c, 6, -9, 12, -3, '#c42424', 2.2); line(c, 12, -9, 6, -3, '#c42424', 2.2);
  },
  soy(c) {
    poly(c, [-9, -6, 0, -14, 9, -6, 9, 14, -9, 14], '#f6f6f2', OUT, 2);
    c.fillStyle = '#5ab07a'; c.fillRect(-9, 0, 18, 6);
    line(c, -9, -6, 9, -6, OUT, 1.5);
  },
  fireMind(c) {
    c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(-14, 10, -10, -4, -4, -14); c.quadraticCurveTo(-2, -4, 2, -6); c.quadraticCurveTo(4, -12, 6, -14); c.bezierCurveTo(14, -2, 12, 10, 0, 14);
    c.fillStyle = '#ff8a24'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-7, 8, -5, 0, -1, -4); c.quadraticCurveTo(2, 2, 4, 0); c.bezierCurveTo(7, 6, 5, 10, 0, 12);
    c.fillStyle = '#ffe060'; c.fill();
  },
  ankh(c) {
    ellipse(c, 0, -7, 6, 7, null, '#c49a20', 6); ellipse(c, 0, -7, 6, 7, null, '#ffd84a', 3.5);
    line(c, 0, 0, 0, 15, '#c49a20', 6); line(c, 0, 0, 0, 15, '#ffd84a', 3.5);
    line(c, -10, 2, 10, 2, '#c49a20', 6); line(c, -10, 2, 10, 2, '#ffd84a', 3.5);
  },
  lens(c) {
    line(c, 5, 5, 14, 14, '#6a4a2a', 5);
    circle(c, -2, -2, 10, 'rgba(170,220,255,0.45)', '#888', 3);
    ellipse(c, -6, -6, 3, 2, 'rgba(255,255,255,0.8)', null, 0, -0.7);
  },
  candy(c) {
    line(c, 0, 0, 0, 15, '#e8d8b0', 2.5);
    circle(c, -4, -5, 8, '#f5a3c7'); circle(c, 4, -6, 8, '#f5a3c7'); circle(c, 0, -10, 8, '#f8bcd6'); circle(c, 0, -2, 7, '#f5a3c7');
  },
  // --- активные ---
  d6(c) {
    rrect(c, -13, -13, 26, 26, 5, '#f4f0e6', OUT, 2.2);
    for (const [x, y] of [[-6, -6], [6, -6], [-6, 0], [6, 0], [-6, 6], [6, 6]]) circle(c, x, y, 2.4, '#222');
  },
  blackbook(c) { bookShape(c, '#1e1a1e', () => ICONS.pentagramSmall(c)); },
  pentagramSmall(c) {
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 7 - 1, Math.sin(a) * 7); }
    c.closePath(); c.strokeStyle = '#d42c2c'; c.lineWidth = 1.6; c.stroke();
  },
  prayer(c) { bookShape(c, '#7a4a22', () => { line(c, -1, -8, -1, 8, '#ffd84a', 3); line(c, -6, -3, 4, -3, '#ffd84a', 3); }); },
  catHead(c) {
    poly(c, [-12, -4, -10, -15, -3, -9], '#8a8a92', OUT, 1.6); poly(c, [12, -4, 10, -15, 3, -9], '#8a8a92', OUT, 1.6);
    circle(c, 0, 2, 12, '#9a9aa2', OUT, 2);
    circle(c, -4.5, 0, 2.2, '#e8d040'); circle(c, 4.5, 0, 2.2, '#e8d040');
    line(c, -4.5, -1.5, -4.5, 1.5, '#111', 1.2); line(c, 4.5, -1.5, 4.5, 1.5, '#111', 1.2);
    poly(c, [-1.5, 5, 1.5, 5, 0, 7], '#f07aa0');
    line(c, -12, 6, -5, 6, '#ddd', 0.8); line(c, 12, 6, 5, 6, '#ddd', 0.8);
  },
  teleport(c) {
    circle(c, 0, 0, 14, '#2a1a4a', '#9a6ae0', 2);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 4 + i * 3.5, i, i + 4); c.strokeStyle = ['#fff', '#c8a8ff', '#9a6ae0'][i]; c.lineWidth = 2; c.stroke(); }
  },
  hourglass(c) {
    line(c, -10, -14, 10, -14, '#8a5a2e', 3.5); line(c, -10, 14, 10, 14, '#8a5a2e', 3.5);
    poly(c, [-8, -12, 8, -12, 1.5, 0, 8, 12, -8, 12, -1.5, 0], 'rgba(200,230,255,0.55)', OUT, 1.6);
    poly(c, [-5, 11, 5, 11, 0, 4], '#e6c264'); poly(c, [-4, -9, 4, -9, 0, -3], '#e6c264');
  },
  yum(c) {
    heartPath(c, 0, 2, 30); c.fillStyle = '#d8a050'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    heartPath(c, 0, 2, 20); c.fillStyle = '#c42c3a'; c.fill();
    for (let i = -1; i <= 1; i++) line(c, i * 5, -4, i * 5 + 2, 6, '#e8c080', 1.5);
  },
  grimoire(c) { bookShape(c, '#4a2a6a', () => { eyeShape(c, -1, 0, 6, 4, '#c42424'); }); },
  mrBoom(c) {
    drawBomb(c, 0, 4, 12, -1);
    circle(c, -4, 3, 2.2, '#fff'); circle(c, 4, 3, 2.2, '#fff'); circle(c, -4, 3.5, 1.1, '#000'); circle(c, 4, 3.5, 1.1, '#000');
    c.beginPath(); c.arc(0, 8, 3.5, 0.2, Math.PI - 0.2); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  },
  unknown(c) { text(c, '?', 0, 1, 28, '#fff', 'center'); },
};

function drawItemIcon(c, id, x, y, scale = 1) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  (ICONS[id] || ICONS.unknown)(c);
  c.restore();
}

// ============================================================
//  Главный герой
// ============================================================
function drawHero(c, x, y, o) {
  const s = o.scale || 1;
  const dir = o.dir || 'down';
  const skin = o.skin || '#f3d9c9';
  const look = o.look || 'kai';
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  const sw = o.moving ? Math.sin(o.walk || 0) * 3 : 0;
  const side = dir === 'left' || dir === 'right';
  // крылья
  if (o.wings) {
    const fl = Math.sin((o.t || 0) * 0.3) * 0.25;
    for (const k of [-1, 1]) {
      c.save(); c.translate(k * 5, -14); c.rotate(k * (0.3 + fl)); c.scale(k, 1);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -16, 22, -12); c.quadraticCurveTo(16, -2, 0, 4);
      c.fillStyle = 'rgba(250,250,255,0.95)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
      c.restore();
    }
  }
  // ноги
  const lx = side ? sw : 0, ly = side ? 0 : sw * 0.5;
  ellipse(c, -4 + lx, -2 + ly, 3.3, 3, skin, OUT, 1.5);
  ellipse(c, 4 - lx, -2 - ly, 3.3, 3, skin, OUT, 1.5);
  // тело
  ellipse(c, 0, -9, 7.5, 7, skin, OUT, 1.6);
  if (look === 'outcast') { c.save(); c.beginPath(); c.ellipse(0, -9, 7.5, 7, 0, 0, Math.PI * 2); c.clip(); c.fillStyle = '#6a1e1e'; c.fillRect(-8, -12, 16, 12); c.restore(); ellipse(c, 0, -9, 7.5, 7, null, OUT, 1.6); }
  // руки
  if (o.holding) {
    ellipse(c, -9, -20, 3, 4, skin, OUT, 1.4); ellipse(c, 9, -20, 3, 4, skin, OUT, 1.4);
  } else {
    ellipse(c, -7.5, -8 + (side ? 0 : -sw * 0.3), 2.8, 3, skin, OUT, 1.3);
    ellipse(c, 7.5, -8 + (side ? 0 : sw * 0.3), 2.8, 3, skin, OUT, 1.3);
  }
  // голова
  const hy = -25, hr = 14.5;
  if (look === 'magda') { circle(c, 0, hy - 13, 6, '#7a3e1c', OUT, 1.6); }
  circle(c, 0, hy, hr, skin, OUT, 2);
  // румянец/тень на голове
  ellipse(c, 0, hy + 7, 10, 5, 'rgba(0,0,0,0.06)');
  if (look === 'magda') {
    c.save(); c.beginPath(); c.arc(0, hy, hr, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.ellipse(0, hy - 10, 17, 10, 0, 0, Math.PI * 2); c.fillStyle = '#7a3e1c'; c.fill();
    c.restore();
    circle(c, 0, hy, hr, null, OUT, 2);
  }
  if (look === 'outcast') {
    poly(c, [-9, hy - 10, 9, hy - 10, 7, hy - 22, -7, hy - 22], '#8a1e22', OUT, 1.6);
    line(c, 3, hy - 22, 9, hy - 16, '#e6c264', 1.5);
  }
  // лицо
  const tearing = o.shoot > 0;
  const eye = (ex, ey, sc = 1) => {
    ellipse(c, ex, ey, 3.3 * sc, 4.3, '#141010');
    circle(c, ex - 1.1 * sc, ey - 1.6, 1.2, '#fff');
    if (tearing) ellipse(c, ex, ey + 6, 1.6, 2.4, '#8cc8ff');
  };
  if (dir === 'down') {
    eye(-5.5, hy + 1); eye(5.5, hy + 1);
    if (look === 'shade') { line(c, -3, hy + 9, 3, hy + 9, OUT, 1.4); for (let i = -2; i <= 2; i += 2) line(c, i, hy + 7.5, i, hy + 10.5, OUT, 1); }
    else { c.beginPath(); c.arc(0, hy + 11, 3.2, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); }
  } else if (side) {
    const k = dir === 'left' ? -1 : 1;
    eye(k * 2.5, hy + 1, 0.85); eye(k * 9.5, hy + 1, 0.6);
    if (look !== 'shade') { c.beginPath(); c.arc(k * 7, hy + 11, 2.4, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(); }
    ellipse(c, -k * 12, hy + 1, 2.2, 3.4, skin, OUT, 1.2);
  } else {
    // затылок
    ellipse(c, -13.5, hy + 1, 2.2, 3.4, skin, OUT, 1.2);
    ellipse(c, 13.5, hy + 1, 2.2, 3.4, skin, OUT, 1.2);
  }
  // косметика от предметов
  if (o.horns) {
    poly(c, [-9, hy - 9, -14, hy - 20, -4, hy - 13], '#b01818', OUT, 1.4);
    poly(c, [9, hy - 9, 14, hy - 20, 4, hy - 13], '#b01818', OUT, 1.4);
  }
  if (o.hat) {
    poly(c, [-14, hy - 8, 14, hy - 8, 2, hy - 34], '#3a52c4', OUT, 1.8);
    circle(c, 0, hy - 20, 1.8, '#ffe866');
  }
  if (o.halo) {
    ellipse(c, 0, hy - 20, 11, 4, null, '#8a6a10', 4);
    ellipse(c, 0, hy - 20, 11, 4, null, '#ffe060', 2.2);
  }
  c.restore();
}
