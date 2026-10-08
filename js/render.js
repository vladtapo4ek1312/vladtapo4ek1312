'use strict';
// ============================================================
//  Отрисовка комнаты, дверей, препятствий, интерфейса
// ============================================================

function hrand(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- фон комнаты (кэшируется) ----------
function buildRoomBg(room) {
  const pal = paletteFor(room);
  const w = RW + WALL * 2, h = RH + WALL * 2;
  const cv = makeCanvas(w, h);
  const c = cv.ctx;
  c.translate(WALL - RX, WALL - RY);
  const rng = new RNG(room.seed);

  // пол
  c.fillStyle = pal.floor; c.fillRect(RX, RY, RW, RH);
  for (let i = 0; i < 70; i++) {
    const x = RX + rng.next() * RW, y = RY + rng.next() * RH, r = 18 + rng.next() * 70;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng.chance(0.6);
    g.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 160; i++) {
    const x = RX + rng.next() * RW, y = RY + rng.next() * RH;
    c.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.07)';
    c.fillRect(x, y, 1 + rng.next() * 2.5, 1 + rng.next() * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    let x = RX + rng.next() * RW, y = RY + rng.next() * RH;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rng.next() - 0.5) * 40; y += (rng.next() - 0.5) * 30; c.lineTo(x, y); }
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.2; c.stroke();
  }
  if (pal.veins) {
    for (let i = 0; i < 12; i++) {
      let x = RX + rng.next() * RW, y = RY + rng.next() * RH;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { const nx = x + (rng.next() - 0.5) * 80, ny = y + (rng.next() - 0.5) * 60; c.quadraticCurveTo((x + nx) / 2 + 10, (y + ny) / 2 - 10, nx, ny); x = nx; y = ny; }
      c.strokeStyle = 'rgba(60,5,10,0.4)'; c.lineWidth = 2 + rng.next() * 2; c.stroke();
    }
  }
  // особые полы
  const [cx, cy] = tileCenter(6, 3);
  if (room.type === 'shop') {
    rrect(c, cx - T * 4.6, cy - T * 0.9, T * 9.2, T * 1.9, 6, '#5a1e22', '#2a0a0c', 3);
    c.strokeStyle = 'rgba(230,190,90,0.5)'; c.lineWidth = 2; c.strokeRect(cx - T * 4.4, cy - T * 0.75, T * 8.8, T * 1.6);
  }
  if (room.type === 'devil') {
    c.save(); c.translate(cx, cy + 10);
    circle(c, 0, 0, 120, null, 'rgba(150,10,10,0.55)', 3);
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 115, Math.sin(a) * 115); }
    c.strokeStyle = 'rgba(150,10,10,0.55)'; c.lineWidth = 3; c.stroke();
    c.restore();
  }
  if (room.type === 'angel') {
    const g = c.createRadialGradient(cx, cy, 10, cx, cy, 220);
    g.addColorStop(0, 'rgba(255,255,230,0.5)'); g.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = g; c.fillRect(RX, RY, RW, RH);
  }
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

  // ямы и шипы — статичны
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const t = room.grid[r * COLS + col];
    const x = RX + col * T, y = RY + r * T;
    if (t.t === 'x') {
      c.fillStyle = pal.pit; c.fillRect(x, y, T, T);
      const up = room.tile(col, r - 1);
      if (!up || up.t !== 'x') {
        const g = c.createLinearGradient(0, y, 0, y + 18);
        g.addColorStop(0, pal.rock2); g.addColorStop(1, pal.pit);
        c.fillStyle = g; c.fillRect(x, y, T, 18);
      }
      for (const [dc, dr, ex, ey, ew, eh] of [[-1, 0, x, y, 3, T], [1, 0, x + T - 3, y, 3, T], [0, 1, x, y + T - 3, T, 3]]) {
        const n = room.tile(col + dc, r + dr);
        if (!n || n.t !== 'x') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(ex, ey, ew, eh); }
      }
    } else if (t.t === 's') {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 4, y + 4, T - 8, T - 8);
      for (const [sx, sy] of [[0.28, 0.32], [0.72, 0.32], [0.5, 0.55], [0.28, 0.78], [0.72, 0.78]]) {
        const px = x + sx * T, py = y + sy * T;
        poly(c, [px - 6, py + 4, px + 6, py + 4, px, py - 12], '#b8bcc4', '#2a2a30', 1.5);
        poly(c, [px - 1, py + 3, px + 4, py + 3, px, py - 9], '#e8ecf4');
      }
    }
  }

  // декали
  for (const d of room.decals) paintDecal(c, d);

  // тени у стен
  const sh = 34;
  let g = c.createLinearGradient(0, RY, 0, RY + sh); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(RX, RY, RW, sh);
  g = c.createLinearGradient(0, RY + RH, 0, RY + RH - sh * 0.6); g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(RX, RY + RH - sh, RW, sh);
  g = c.createLinearGradient(RX, 0, RX + sh, 0); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(RX, RY, sh, RH);
  g = c.createLinearGradient(RX + RW, 0, RX + RW - sh, 0); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(RX + RW - sh, RY, sh, RH);

  // стены
  const X0 = RX - WALL, Y0 = RY - WALL, X1 = RX + RW + WALL, Y1 = RY + RH + WALL;
  const wallPoly = (pts, gx0, gy0, gx1, gy1) => {
    const gr = c.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, pal.dark); gr.addColorStop(0.55, pal.wall); gr.addColorStop(1, pal.wall2);
    poly(c, pts, gr);
  };
  wallPoly([X0, Y0, X1, Y0, RX + RW, RY, RX, RY], 0, Y0, 0, RY);
  wallPoly([X0, Y1, X1, Y1, RX + RW, RY + RH, RX, RY + RH], 0, Y1, 0, RY + RH);
  wallPoly([X0, Y0, RX, RY, RX, RY + RH, X0, Y1], X0, 0, RX, 0);
  wallPoly([X1, Y0, RX + RW, RY, RX + RW, RY + RH, X1, Y1], X1, 0, RX + RW, 0);
  // камни в стенах
  c.save();
  c.beginPath(); c.rect(X0, Y0, X1 - X0, Y1 - Y0); c.rect(RX, RY, RW, RH); c.clip('evenodd');
  for (let i = 0; i < 140; i++) {
    const side = rng.int(0, 3);
    let x, y;
    if (side === 0) { x = X0 + rng.next() * (X1 - X0); y = Y0 + rng.next() * WALL; }
    else if (side === 1) { x = X0 + rng.next() * (X1 - X0); y = RY + RH + rng.next() * WALL; }
    else if (side === 2) { x = X0 + rng.next() * WALL; y = Y0 + rng.next() * (Y1 - Y0); }
    else { x = RX + RW + rng.next() * WALL; y = Y0 + rng.next() * (Y1 - Y0); }
    const rw = 8 + rng.next() * 16, rh = 5 + rng.next() * 9;
    rrect(c, x - rw / 2, y - rh / 2, rw, rh, 3, rng.chance(0.5) ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.05)');
  }
  c.restore();
  line(c, X0, Y0, RX, RY, 'rgba(0,0,0,0.35)', 2);
  line(c, X1, Y0, RX + RW, RY, 'rgba(0,0,0,0.35)', 2);
  line(c, X0, Y1, RX, RY + RH, 'rgba(0,0,0,0.35)', 2);
  line(c, X1, Y1, RX + RW, RY + RH, 'rgba(0,0,0,0.35)', 2);
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2; c.strokeRect(RX, RY, RW, RH);
  c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  return cv;
}

function paintDecal(c, d) {
  c.save();
  c.beginPath(); c.rect(RX, RY, RW, RH); c.clip();
  const r = d.r;
  const s = d.seed | 0;
  switch (d.type) {
    case 'blood': {
      c.globalAlpha = 0.7;
      const col = d.color || '#7a0c0c';
      for (let i = 0; i < 6; i++) circle(c, d.x + (hrand(s, i) - 0.5) * r * 1.8, d.y + (hrand(s, i + 9) - 0.5) * r * 1.1, r * (0.2 + hrand(s, i + 20) * 0.45), col);
      break;
    }
    case 'scorch': {
      const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(d.x - r, d.y - r, r * 2, r * 2);
      break;
    }
    case 'rubble':
      for (let i = 0; i < 7; i++) circle(c, d.x + (hrand(s, i) - 0.5) * r * 2, d.y + (hrand(s, i + 7) - 0.5) * r * 1.4, 2 + hrand(s, i + 3) * 3.5, 'rgba(60,50,40,0.6)');
      break;
    case 'poop':
      c.globalAlpha = 0.55;
      ellipse(c, d.x, d.y, r, r * 0.5, '#4a3418');
      break;
  }
  c.restore();
}

// ---------- препятствия ----------
function drawTile(c, t, i, pal) {
  const col = i % COLS, row = (i / COLS) | 0;
  const x = RX + col * T + T / 2, y = RY + row * T + T / 2;
  const s = G.room.seed + i * 13;
  switch (t.t) {
    case 'r': case 't': {
      shadow(c, x, y + 14, 22, 7, 0.35);
      const pts = [], top = [];
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2, rr = 20 + hrand(s, k) * 5;
        pts.push(x + Math.cos(a) * rr, y + 4 + Math.sin(a) * rr * 0.8);
        top.push(x + Math.cos(a) * rr * 0.82, y - 1 + Math.sin(a) * rr * 0.62);
      }
      poly(c, pts, pal.rock2, OUT, 2.5);
      poly(c, top, pal.rock);
      ellipse(c, x - 6, y - 7, 7, 3.5, 'rgba(255,255,255,0.18)', null, 0, -0.3);
      line(c, x + 3, y - 2, x + 9, y + 5, 'rgba(0,0,0,0.3)', 1.5);
      if (t.t === 't') {
        for (const [dx, dy] of [[-6, 2], [5, -4], [7, 6]]) {
          line(c, x + dx - 3, y + dy - 3, x + dx + 3, y + dy + 3, '#9fd4ff', 2);
          line(c, x + dx + 3, y + dy - 3, x + dx - 3, y + dy + 3, '#9fd4ff', 2);
        }
      }
      break;
    }
    case 'm':
      shadow(c, x, y + 16, 24, 6, 0.4);
      rrect(c, x - 24, y - 22, 48, 42, 4, '#6a6e78', OUT, 2.5);
      rrect(c, x - 20, y - 22, 40, 30, 3, '#8c909a');
      for (const [dx, dy] of [[-14, -14], [14, -14], [-14, 2], [14, 2]]) circle(c, x + dx, y + dy, 2.2, '#4a4e58');
      break;
    case 'p': {
      const k = clamp(t.hp, 1, 4);
      shadow(c, x, y + 14, 18, 6, 0.35);
      const tiers = [[0, 10, 18, 10], [0, 1, 13, 8], [0, -7, 8, 6]];
      const n = k >= 4 ? 3 : k >= 2 ? 2 : 1;
      const sc = k === 3 || k === 1 ? 0.85 : 1;
      for (let j = 0; j < n; j++) {
        const [dx, dy, rx, ry] = tiers[j];
        ellipse(c, x + dx, y + dy * sc + 2, rx * sc, ry * sc, '#7a5426', OUT, 2);
        ellipse(c, x + dx - rx * 0.3 * sc, y + dy * sc - ry * 0.25, rx * 0.35 * sc, ry * 0.3 * sc, '#9a7038');
      }
      if (n === 3) poly(c, [x - 3, y - 12, x + 3, y - 12, x, y - 19], '#7a5426', OUT, 1.5);
      break;
    }
    case 'f': {
      shadow(c, x, y + 14, 18, 6, 0.4);
      line(c, x - 14, y + 12, x + 12, y + 4, '#5a3418', 7);
      line(c, x + 14, y + 12, x - 12, y + 4, '#6a4020', 7);
      if (t.hp > 0) {
        const f = Math.sin(G.t * 0.3 + i) * 2;
        const blue = G.room.type === 'devil';
        const s1 = Math.min(1, t.hp / 4) * 0.4 + 0.6;
        c.beginPath();
        c.moveTo(x - 12 * s1, y + 8);
        c.quadraticCurveTo(x - 14 * s1, y - 12 * s1, x + f, y - 30 * s1);
        c.quadraticCurveTo(x + 14 * s1, y - 12 * s1, x + 12 * s1, y + 8);
        c.closePath();
        c.fillStyle = blue ? '#c02040' : '#ff8a24'; c.fill();
        c.beginPath();
        c.moveTo(x - 6 * s1, y + 8);
        c.quadraticCurveTo(x - 7 * s1, y - 4, x - f * 0.5, y - 16 * s1);
        c.quadraticCurveTo(x + 7 * s1, y - 4, x + 6 * s1, y + 8);
        c.closePath();
        c.fillStyle = blue ? '#ff6080' : '#ffe060'; c.fill();
        const g = c.createRadialGradient(x, y, 4, x, y, 60);
        g.addColorStop(0, blue ? 'rgba(255,40,60,0.18)' : 'rgba(255,160,40,0.2)'); g.addColorStop(1, 'rgba(255,160,40,0)');
        c.fillStyle = g; c.fillRect(x - 60, y - 60, 120, 120);
      } else {
        circle(c, x, y + 6, 6, '#3a2a20');
        if (G.t % 20 < 10) circle(c, x + 2, y - 4 - (G.t % 20), 3, 'rgba(150,150,150,0.4)');
      }
      break;
    }
    case 'S': {
      shadow(c, x, y + 16, 22, 6, 0.4);
      if (t.sub === 'angel') {
        rrect(c, x - 18, y + 4, 36, 14, 3, '#d8dce4', OUT, 2);
        for (const k of [-1, 1]) { c.beginPath(); c.moveTo(x + k * 6, y - 18); c.quadraticCurveTo(x + k * 30, y - 40, x + k * 26, y - 6); c.quadraticCurveTo(x + k * 18, y - 8, x + k * 6, y - 6); c.fillStyle = '#f2f4f8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(); }
        poly(c, [x - 10, y + 5, x + 10, y + 5, x + 6, y - 22, x - 6, y - 22], '#eceef4', OUT, 2);
        circle(c, x, y - 30, 9, '#eceef4', OUT, 2);
        ellipse(c, x, y - 42, 9, 3, null, '#ffe060', 2);
      } else {
        rrect(c, x - 18, y + 4, 36, 14, 3, '#3a3236', OUT, 2);
        for (const k of [-1, 1]) { c.beginPath(); c.moveTo(x + k * 6, y - 18); c.lineTo(x + k * 32, y - 34); c.lineTo(x + k * 24, y - 22); c.lineTo(x + k * 30, y - 10); c.lineTo(x + k * 6, y - 6); c.closePath(); c.fillStyle = '#2a2428'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(); }
        poly(c, [x - 10, y + 5, x + 10, y + 5, x + 6, y - 22, x - 6, y - 22], '#4a4046', OUT, 2);
        circle(c, x, y - 30, 9, '#4a4046', OUT, 2);
        poly(c, [x - 6, y - 36, x - 12, y - 48, x - 2, y - 38], '#2a2428', OUT, 1.5);
        poly(c, [x + 6, y - 36, x + 12, y - 48, x + 2, y - 38], '#2a2428', OUT, 1.5);
        circle(c, x - 3, y - 30, 1.6, '#ff3030'); circle(c, x + 3, y - 30, 1.6, '#ff3030');
      }
      break;
    }
  }
}

function makeShopkeeper(x, y) {
  return {
    kind: 'shopkeeper', x, y,
    draw(c) {
      shadow(c, x, y + 10, 16, 5, 0.4);
      ellipse(c, x, y, 14, 12, '#7a7470', OUT, 2);
      circle(c, x, y - 18, 12, '#8c8682', OUT, 2);
      line(c, x - 7, y - 20, x - 2, y - 19, '#111', 2);
      line(c, x + 2, y - 19, x + 7, y - 20, '#111', 2);
      line(c, x - 4, y - 11, x + 4, y - 11, '#111', 1.5);
      line(c, x - 10, y - 30, x - 4, y - 26, '#6a6460', 3);
      line(c, x + 10, y - 30, x + 4, y - 26, '#6a6460', 3);
    },
  };
}

// ---------- двери ----------
const DOOR_ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const DOOR_FRAME = { normal: '#6a5040', boss: '#5a1414', treasure: '#c9a032', shop: '#6a5040', devil: '#1e0a0a', angel: '#e8eaf2' };

function drawDoors(c) {
  const room = G.room;
  for (const d of DIR_NAMES) {
    const door = room.doors[d];
    if (!door) continue;
    if (door.hidden && room.type !== 'secret') continue;
    drawDoor(c, d, door, doorOpen(door));
  }
}

function drawDoor(c, dir, door, open) {
  const [cx, cy] = doorCenter(dir);
  c.save();
  c.translate(cx, cy);
  c.rotate(DOOR_ROT[dir]);
  const kind = door.kind;
  const top = -WALL + 2;
  if (kind === 'secret') {
    poly(c, [-24, 2, -20, -12, -28, -22, -14, -34, -16, top + 6, 2, top, 12, top + 8, 24, -30, 18, -18, 26, -8, 22, 2], '#050303', 'rgba(0,0,0,0.6)', 3);
    c.restore();
    return;
  }
  const frame = DOOR_FRAME[kind] || DOOR_FRAME.normal;
  if (kind === 'devil' || kind === 'angel') {
    const g = c.createRadialGradient(0, -20, 4, 0, -20, 60);
    g.addColorStop(0, kind === 'devil' ? 'rgba(255,30,30,0.5)' : 'rgba(255,255,220,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(-60, -80, 120, 90);
  }
  // рама
  c.beginPath();
  c.moveTo(-34, 3); c.lineTo(-34, top + 12);
  c.quadraticCurveTo(0, top - 8, 34, top + 12);
  c.lineTo(34, 3); c.closePath();
  c.fillStyle = frame; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
  // проём
  c.beginPath();
  c.moveTo(-24, 1); c.lineTo(-24, top + 16);
  c.quadraticCurveTo(0, top + 2, 24, top + 16);
  c.lineTo(24, 1); c.closePath();
  c.fillStyle = kind === 'angel' ? '#fffbe8' : '#080404';
  c.fill();
  if (!open) {
    c.save(); c.clip();
    if (kind === 'boss') {
      c.fillStyle = '#2a0808'; c.fillRect(-25, top, 50, -top + 2);
      for (let i = -2; i <= 2; i++) line(c, i * 9, top + 6, i * 9, 2, '#8a8a8a', 3.5);
    } else if (kind === 'angel') {
      c.fillStyle = '#d8dce8'; c.fillRect(-25, top, 50, -top + 2);
    } else {
      c.fillStyle = kind === 'devil' ? '#3a0a0a' : '#5c3c24'; c.fillRect(-25, top, 25, -top + 2);
      c.fillStyle = kind === 'devil' ? '#300808' : '#523420'; c.fillRect(0, top, 25, -top + 2);
      for (let k = -18; k <= 18; k += 9) line(c, k, top + 8, k, 0, 'rgba(0,0,0,0.25)', 1.2);
      line(c, 0, top + 4, 0, 2, OUT, 2);
    }
    c.restore();
    if (door.locked) {
      rrect(c, -9, -24, 18, 15, 3, '#e6c040', OUT, 2);
      c.beginPath(); c.arc(0, -24, 6, Math.PI, 0); c.strokeStyle = '#c0c4cc'; c.lineWidth = 3; c.stroke();
      circle(c, 0, -17, 2.4, '#222');
    }
  }
  // украшения
  if (kind === 'boss') {
    for (const k of [-1, 1]) poly(c, [k * 30, top + 14, k * 46, top - 2, k * 36, top + 22], '#d8d0c0', OUT, 2);
    circle(c, 0, top + 3, 6, '#e8e0d0', OUT, 1.5);
    circle(c, -2, top + 2, 1.4, '#111'); circle(c, 2, top + 2, 1.4, '#111');
  } else if (kind === 'treasure') {
    poly(c, [-8, top + 6, -8, top - 2, -4, top + 2, 0, top - 4, 4, top + 2, 8, top - 2, 8, top + 6], '#ffe060', OUT, 1.5);
  } else if (kind === 'shop') {
    drawCoin(c, 0, top + 2, 6, 1);
  } else if (kind === 'devil') {
    for (const k of [-1, 1]) poly(c, [k * 22, top + 10, k * 34, top - 8, k * 30, top + 16], '#8a1010', OUT, 2);
  }
  c.restore();
}

// ---------- виньетка ----------
let VIGNETTE = null;
function buildVignette() {
  const v = makeCanvas(W, H);
  const g = v.ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  v.ctx.fillStyle = g;
  v.ctx.fillRect(0, 0, W, H);
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
function drawParticles(c) {
  for (const q of G.particles) {
    c.globalAlpha = Math.min(1, q.life / q.max * 2);
    circle(c, q.x, q.y - q.z, q.size * (0.5 + 0.5 * q.life / q.max), q.color);
  }
  c.globalAlpha = 1;
}

// ---------- весь мир ----------
function renderWorld(c, noShake) {
  const room = G.room, p = G.player;
  c.save();
  if (!noShake && G.shake > 0.5) c.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  if (!G.bgCache) G.bgCache = buildRoomBg(room);
  c.drawImage(G.bgCache.cv, RX - WALL, RY - WALL, RW + 2 * WALL, RH + 2 * WALL);
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

  if (G.floor && G.floor.curse === 'darkness' && room.type !== 'angel') {
    const g = c.createRadialGradient(p.x, p.y - 15, 40, p.x, p.y - 15, 250);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = g;
    c.fillRect(RX - WALL - 20, RY - WALL - 20, RW + 2 * WALL + 40, RH + 2 * WALL + 40);
  }
  c.restore();
  if (VIGNETTE) c.drawImage(VIGNETTE.cv, 0, 0, W, H);
  if (G.slowT > 0) { c.fillStyle = 'rgba(120,150,255,0.08)'; c.fillRect(0, 0, W, H); }
  if (G.hurtFlash > 0) { c.fillStyle = 'rgba(200,0,0,' + (G.hurtFlash / 10 * 0.25) + ')'; c.fillRect(0, 0, W, H); }
  if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (G.flash / 20) + ')'; c.fillRect(0, 0, W, H); }
}

// ============================================================
//  Интерфейс
// ============================================================
function drawHUD(c) {
  const p = G.player;
  if (!p) return;
  // активный предмет
  rrect(c, 6, 6, 44, 44, 6, 'rgba(0,0,0,0.35)');
  if (p.active) {
    const a = p.active;
    const ready = a.charge >= a.max;
    if (ready) circle(c, 28, 28, 20 + Math.sin(G.t * 0.15) * 2, 'rgba(255,255,200,0.15)');
    drawItemIcon(c, a.id, 28, 28, 1.05);
    const bx = 53, by = 8, bh = 40;
    rrect(c, bx, by, 8, bh, 2, '#111', '#ddd', 1.5);
    const fh = (bh - 4) * a.charge / a.max;
    c.fillStyle = ready ? '#ffe060' : '#5cc45c';
    c.fillRect(bx + 2, by + bh - 2 - fh, 4, fh);
    for (let k = 1; k < a.max; k++) { const yy = by + 2 + (bh - 4) * k / a.max; line(c, bx + 1, yy, bx + 7, yy, '#111', 1); }
  }
  // сердца
  let i = 0;
  const hx = 72, hy = 15, hs = 17;
  const slot = () => { const x = hx + (i % 6) * hs, y = hy + Math.floor(i / 6) * 16; i++; return [x, y]; };
  for (let k = 0; k < p.maxHearts; k++) {
    const v = p.hp - k * 2;
    const [x, y] = slot();
    drawHeart(c, x, y, 16, v >= 2 ? 'red' : v === 1 ? 'half' : 'empty');
  }
  for (let k = 0; k < Math.ceil(p.soul / 2); k++) {
    const v = p.soul - k * 2;
    const [x, y] = slot();
    drawHeart(c, x, y, 16, v >= 2 ? 'soul' : 'halfSoul');
  }
  if (p.mantle) { const [x, y] = slot(); circle(c, x, y, 6, 'rgba(255,255,255,0.3)', '#fff', 1.5); }
  if (p.extraLives > 0) text(c, '+' + p.extraLives, hx + 6 * hs + 4, hy, 14, '#ffd84a');

  // расходники
  const cy0 = 70;
  drawCoin(c, 18, cy0, 7, 1);
  text(c, String(p.coins).padStart(2, '0'), 32, cy0 + 1, 18, '#fff');
  drawBomb(c, 18, cy0 + 26, 7, -1);
  text(c, String(p.bombs).padStart(2, '0'), 32, cy0 + 26, 18, '#fff');
  drawKey(c, 18, cy0 + 50, 15);
  text(c, String(p.keys).padStart(2, '0'), 32, cy0 + 50, 18, '#fff');

  // характеристики
  const stats = [
    ['speed', p.speed.toFixed(2)], ['tears', p.tps.toFixed(2)], ['damage', p.damage.toFixed(2)],
    ['range', p.range.toFixed(2)], ['shotspeed', p.shotSpeed.toFixed(2)], ['luck', String(Math.round(p.luck * 100) / 100)],
  ];
  stats.forEach(([k, v], j) => {
    const y = 160 + j * 24;
    drawStatIcon(c, k, 16, y);
    text(c, v, 30, y + 1, 16, '#e8e0d0');
  });

  // пилюля/карта
  if (p.consumable) {
    const cs = p.consumable;
    const y = H - 34;
    if (cs.type === 'pill') drawPill(c, 22, y, 20, G.pillColors[cs.id]);
    else drawCard(c, 22, y, 24, CARDS[cs.id].color);
    const nm = cs.type === 'pill' ? (G.pillKnown.has(cs.id) ? PILLS[cs.id].name : '???') : CARDS[cs.id].name;
    text(c, nm, 40, y - 6, 13, '#e8e0d0');
    if (!Input.touchMode) text(c, '[Q]', 40, y + 10, 12, '#a89c88');
  }

  drawMinimap(c);

  // этаж
  if (G.floor) {
    text(c, STAGES[G.stage].name, W - 48, H - 14, 15, '#a89c88', 'center');
    if (G.floor.curse) text(c, G.floor.curse === 'darkness' ? 'Проклятие тьмы' : 'Проклятие потерянного', W - 48, H - 32, 12, '#c45a5a', 'center');
  }

  // полоска здоровья босса
  if (G.room && G.room.type === 'boss' && !G.room.cleared && G.bossMax) {
    const cur = bossTotal();
    const w = 340, x = W / 2 - w / 2, y = H - 22;
    rrect(c, x - 3, y - 3, w + 6, 16, 5, '#120606', '#000', 2);
    c.fillStyle = '#7a0c0c'; c.fillRect(x, y, w, 10);
    c.fillStyle = '#e02a2a'; c.fillRect(x, y, w * clamp(cur / G.bossMax, 0, 1), 10);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, w * clamp(cur / G.bossMax, 0, 1), 3);
    drawSkull(c, x - 14, y + 5, 9);
    text(c, G.bossName || '', W / 2, y - 12, 16, '#f2e6cf', 'center');
  }

  // баннер предмета
  if (G.banner) {
    const b = G.banner;
    const a = Math.min(1, b.t / 20, (b.small ? 110 : 170) - b.t < 15 ? ((b.small ? 110 : 170) - b.t) / 15 : 1);
    c.save();
    c.globalAlpha = clamp(a, 0, 1);
    c.font = font(b.small ? 24 : 30);
    const tw = Math.max(c.measureText(b.title).width, b.desc ? (c.font = font(17), c.measureText(b.desc).width) : 0) + 50;
    const by = 50;
    rrect(c, W / 2 - tw / 2, by - 26, tw, b.desc ? 60 : 42, 6, '#e8dcc0', '#3a2a1a', 3);
    c.fillStyle = 'rgba(120,90,50,0.15)'; c.fillRect(W / 2 - tw / 2 + 6, by - 20, tw - 12, 4);
    text(c, b.title, W / 2, by - 4, b.small ? 24 : 30, '#2a1a10', 'center', null);
    if (b.desc) text(c, b.desc, W / 2, by + 20, 17, '#5a4030', 'center', null);
    c.restore();
  }

  // удержание R
  if (G.restartHold > 5) {
    const k = G.restartHold / 50;
    rrect(c, W / 2 - 90, H / 2 - 14, 180, 28, 8, 'rgba(0,0,0,0.7)');
    c.fillStyle = '#c43030'; c.fillRect(W / 2 - 84, H / 2 + 6, 168 * k, 4);
    text(c, 'Начать заново...', W / 2, H / 2 - 3, 16, '#fff', 'center');
  }

  if (Input.touchMode && G.state === 'play') drawTouchControls(c);
}

function drawSkull(c, x, y, r) {
  circle(c, x, y - 1, r, '#e8e0d0', OUT, 1.5);
  rrect(c, x - r * 0.55, y + r * 0.4, r * 1.1, r * 0.6, 2, '#e8e0d0', OUT, 1.2);
  circle(c, x - r * 0.38, y - 1, r * 0.28, '#111'); circle(c, x + r * 0.38, y - 1, r * 0.28, '#111');
}

function floorBounds() {
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (const r of G.floor.rooms.values()) { x0 = Math.min(x0, r.gx); y0 = Math.min(y0, r.gy); x1 = Math.max(x1, r.gx); y1 = Math.max(y1, r.gy); }
  return [x0, y0, x1, y1];
}

function drawMap(c, ox, oy, cw, ch, gap) {
  const [x0, y0] = floorBounds();
  const lost = G.floor.curse === 'lost';
  for (const r of G.floor.rooms.values()) {
    const cur = r === G.room;
    if (!r.seen && !cur) continue;
    if (lost && !r.visited && !cur) continue;
    const x = ox + (r.gx - x0) * cw, y = oy + (r.gy - y0) * ch;
    const fill = cur ? '#ffffff' : r.visited ? '#b4ac9e' : '#4e4942';
    rrect(c, x + gap / 2, y + gap / 2, cw - gap, ch - gap, 2, fill, 'rgba(0,0,0,0.8)', 1);
    const ix = x + cw / 2, iy = y + ch / 2, s = Math.min(cw, ch) * 0.32;
    if (r.type === 'boss') drawSkull(c, ix, iy, s);
    else if (r.type === 'treasure') poly(c, [ix - s, iy + s * 0.6, ix - s, iy - s * 0.4, ix - s * 0.4, iy, ix, iy - s * 0.8, ix + s * 0.4, iy, ix + s, iy - s * 0.4, ix + s, iy + s * 0.6], '#ffd84a', OUT, 1);
    else if (r.type === 'shop') drawCoin(c, ix, iy, s * 0.9, 1);
    else if (r.type === 'secret') text(c, '?', ix, iy + 1, s * 2.4, '#fff', 'center', '#000', 2);
  }
}

function drawMinimap(c) {
  if (!G.floor) return;
  const [x0, y0, x1, y1] = floorBounds();
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const maxW = 84, maxH = 80;
  const cw = Math.min(14, maxW / bw, maxH / bh / 0.8), ch = cw * 0.8;
  const ox = W - 6 - bw * cw, oy = 6;
  rrect(c, ox - 4, oy - 4, bw * cw + 8, bh * ch + 8, 5, 'rgba(0,0,0,0.45)');
  if (G.floor.curse === 'lost') {
    drawMap(c, ox, oy, cw, ch, 2);
    text(c, '?', ox + bw * cw / 2, oy + bh * ch / 2, 24, 'rgba(255,255,255,0.4)', 'center');
  } else drawMap(c, ox, oy, cw, ch, 2);
}

function drawBigMap(c) {
  const [x0, y0, x1, y1] = floorBounds();
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cw = Math.min(46, 520 / bw, 330 / bh / 0.8), ch = cw * 0.8;
  const ox = W / 2 - bw * cw / 2, oy = H / 2 - bh * ch / 2 + 10;
  rrect(c, ox - 20, oy - 46, bw * cw + 40, bh * ch + 66, 10, 'rgba(15,10,8,0.85)', '#6a5a44', 2);
  text(c, STAGES[G.stage].name, W / 2, oy - 24, 22, '#f2e6cf', 'center');
  drawMap(c, ox, oy, cw, ch, 4);
}

function drawTouchControls(c) {
  c.save();
  c.globalAlpha = 0.55;
  const p = G.player;
  for (const b of TOUCH_BUTTONS) {
    const held = Input.touchHeld.has(b.action);
    circle(c, b.x, b.y, b.r, held ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.6)', 2);
    if (b.action === 'active') { if (p.active) drawItemIcon(c, p.active.id, b.x, b.y, 0.8); else text(c, '—', b.x, b.y, 16, '#fff', 'center'); }
    else if (b.action === 'bomb') { drawBomb(c, b.x, b.y + 3, 9, -1); text(c, String(p.bombs), b.x + 16, b.y + 16, 13, '#fff', 'center'); }
    else if (b.action === 'pill') { if (p.consumable) { if (p.consumable.type === 'pill') drawPill(c, b.x, b.y, 18, G.pillColors[p.consumable.id]); else drawCard(c, b.x, b.y, 20, CARDS[p.consumable.id].color); } else text(c, 'Q', b.x, b.y, 16, '#aaa', 'center'); }
    else if (b.action === 'pause') { c.fillStyle = '#fff'; c.fillRect(b.x - 6, b.y - 7, 4, 14); c.fillRect(b.x + 2, b.y - 7, 4, 14); }
  }
  for (const k of ['move', 'shoot']) {
    const s = Input.sticks[k];
    if (!s) continue;
    circle(c, s.ox, s.oy, 46, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.5)', 2);
    const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), m = Math.min(l, 46);
    circle(c, s.ox + (l ? dx / l * m : 0), s.oy + (l ? dy / l * m : 0), 18, k === 'move' ? 'rgba(255,255,255,0.6)' : 'rgba(140,200,255,0.7)');
  }
  c.restore();
}

// кнопки интерфейса (мышь/палец)
function uiButton(c, x, y, w, h, label, cb, o = {}) {
  G.ui.push({ x, y, w, h, cb });
  const hot = o.selected;
  rrect(c, x, y, w, h, 8, hot ? 'rgba(120,60,40,0.95)' : 'rgba(40,24,18,0.88)', hot ? '#ffd890' : '#a8885a', hot ? 3 : 2);
  text(c, label, x + w / 2, y + h / 2 + 1, o.size || 20, o.color || '#f2e6cf', 'center');
}
function handleClicks() {
  for (const k of Input.clicks) {
    for (const b of G.ui) {
      if (k.x >= b.x && k.x <= b.x + b.w && k.y >= b.y && k.y <= b.y + b.h) { Sound.play('menu'); b.cb(); return true; }
    }
  }
  return false;
}
