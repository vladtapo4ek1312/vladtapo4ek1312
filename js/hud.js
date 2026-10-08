'use strict';
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
  if (Settings.v.statHud) stats.forEach(([k, v], j) => {
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
    const lines = b.lines || [];
    const lineText = lines.map(l => l.text).join('   ');
    let tw = c.measureText(b.title).width;
    c.font = font(17);
    if (b.desc) tw = Math.max(tw, c.measureText(b.desc).width);
    c.font = font(15);
    if (lineText) tw = Math.max(tw, c.measureText(lineText).width);
    tw += 50;
    const by = 50;
    const bh = (b.desc ? 60 : 42) + (lines.length ? 20 : 0);
    rrect(c, W / 2 - tw / 2, by - 26, tw, bh, 6, '#e8dcc0', '#3a2a1a', 3);
    c.fillStyle = 'rgba(120,90,50,0.15)'; c.fillRect(W / 2 - tw / 2 + 6, by - 20, tw - 12, 4);
    text(c, b.title, W / 2, by - 4, b.small ? 24 : 30, '#2a1a10', 'center', null);
    if (b.desc) text(c, b.desc, W / 2, by + 20, 17, '#5a4030', 'center', null);
    if (lines.length) {
      // строка изменений: зелёные — улучшения, красные — ухудшения
      c.font = font(15);
      let lx = W / 2 - c.measureText(lineText).width / 2;
      for (const l of lines) {
        const col = l.kind === 'up' ? '#2a7a2a' : l.kind === 'down' ? '#a02020' : '#6a5a48';
        text(c, l.text, lx, by + 41, 15, col, 'left', null);
        c.font = font(15);
        lx += c.measureText(l.text + '   ').width;
      }
    }
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
