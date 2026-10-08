'use strict';
// ============================================================
//  Интерфейс
// ============================================================

// Визуальное состояние интерфейса: всплывающие изменения характеристик,
// анимации счётчиков, сердец, полоски босса, подсказки. На игру не влияет.
const hudState = {
  p: null, t: 0, lastG: -1, dt: 0,
  stats: null, pops: {},
  cnt: {}, cntT: {}, cntDir: {},
  hp: 0, soul: 0, hurtT: -999, healT: -999, healIdx: -1, mantle: false, mantleT: -999,
  activeId: null, ready: false, readyT: -999, activeT: -999,
  consKey: '', consT: -999,
  boss: { room: null, max: 0, shown: 0, lag: 0, hold: 0, last: 0, hitT: -999, t0: 0 },
  banner: null, bannerT0: 1, bannerLay: null,
  descs: new Map(), tipRef: null, tipItem: null, tipT: 0, tipLay: null,
  map: { cv: null, key: '', floor: null, room: null, pad: 0, w: 0, h: 0 },
  grads: {}, sprites: {}, fontSt: null, layId: 0,
};
const hudStatOrder = ['speed', 'tears', 'damage', 'range', 'shotspeed', 'luck'];
const hudCounterKeys = ['coins', 'bombs', 'keys'];
const hudTipW = 252;
const hudLegend = [['boss', 'Босс'], ['treasure', 'Сокровищница'], ['shop', 'Магазин'], ['secret', 'Тайная комната']];

function drawHUD(c) {
  const p = G.player;
  if (!p) return;
  hudTick(p);
  hudTrack(p);
  const lv = gfxLevel();
  hudActive(c, p, lv);
  hudHearts(c, p, lv);
  hudCounters(c, p);
  if (Settings.v.statHud) hudStats(c, p, lv);
  hudConsumable(c, p, lv);

  drawMinimap(c);
  hudFloorName(c);
  hudBossBar(c, lv);
  if (G.state === 'play') hudItemInfo(c, p, lv);
  else hudState.tipRef = null;

  hudBanner(c, lv);
  hudRestart(c);

  if (Input.touchMode && G.state === 'play') drawTouchControls(c);
}

// ---------- служебное ----------
// часы интерфейса в кадрах игры; на паузе стоят
function hudTick(p) {
  const s = hudState;
  const d = s.lastG < 0 ? 0 : G.t - s.lastG;
  s.lastG = G.t;
  s.dt = G.state === 'pause' || G.state === 'settings' ? 0 : clamp(d, 0, 10);
  s.t += s.dt;
  if (s.p !== p) hudReset(p);
  // после загрузки шрифта перерисовываем всё закэшированное
  const fst = document.fonts ? document.fonts.status : '';
  if (fst !== s.fontSt) { s.fontSt = fst; s.sprites = {}; s.map.cv = null; s.bannerLay = null; s.tipLay = null; }
}

// Небольшие спрайты интерфейса в памяти: содержимое перерисовывается,
// только когда меняется ключ (значения, качество графики, масштаб экрана)
function hudSprite(slot, key, w, h, draw) {
  const all = hudState.sprites;
  let sp = all[slot];
  if (sp && sp.key === key && sp.ps === PIXEL_SCALE) return sp;
  if (!sp || sp.ps !== PIXEL_SCALE || sp.w !== w || sp.h !== h) {
    const m = makeCanvas(w, h);
    sp = all[slot] = { cv: m.cv, g: m.ctx, w, h, ps: PIXEL_SCALE, key: null };
  } else {
    sp.g.setTransform(1, 0, 0, 1, 0, 0);
    sp.g.clearRect(0, 0, sp.cv.width, sp.cv.height);
    sp.g.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
  }
  sp.key = key;
  sp.g.save(); draw(sp.g); sp.g.restore();
  return sp;
}
// вывод спрайта пиксель в пиксель (без размытия)
function hudBlit(c, sp, x, y) {
  const ps = PIXEL_SCALE;
  c.drawImage(sp.cv, Math.round(x * ps) / ps, Math.round(y * ps) / ps, sp.cv.width / ps, sp.cv.height / ps);
}

function hudConsKey(p) { const cs = p.consumable; return cs ? cs.type + ':' + cs.id : ''; }

// новый забег: запоминаем исходные значения, чтобы старт не мигал изменениями
function hudReset(p) {
  const s = hudState;
  s.p = p;
  s.stats = statSnapshot(p);
  s.pops = {};
  for (const k of hudCounterKeys) { s.cnt[k] = p[k]; s.cntT[k] = -999; s.cntDir[k] = 0; }
  s.hp = p.hp; s.soul = p.soul; s.hurtT = s.healT = s.mantleT = -999; s.healIdx = -1; s.mantle = p.mantle;
  s.activeId = p.active ? p.active.id : null;
  s.ready = !!(p.active && p.active.charge >= p.active.max);
  s.readyT = s.activeT = -999;
  s.consKey = hudConsKey(p); s.consT = -999;
  s.boss.room = null; s.banner = null; s.tipRef = null; s.tipLay = null;
  s.descs.clear();
}

// замечаем изменения, чтобы показать их анимацией
function hudTrack(p) {
  const s = hudState, now = s.t;
  const st = statSnapshot(p);
  for (const k of hudStatOrder) {
    const d = st[k] - s.stats[k];
    if (Math.abs(d) < 0.005) continue;
    // несколько изменений подряд складываем в одно
    const old = s.pops[k];
    const sum = old && now - old.t < 150 ? old.d + d : d;
    s.pops[k] = Math.abs(sum) >= 0.005 ? { d: sum, t: now } : null;
  }
  s.stats = st;
  for (const k of hudCounterKeys) {
    if (p[k] === s.cnt[k]) continue;
    s.cntDir[k] = p[k] > s.cnt[k] ? 1 : -1;
    s.cnt[k] = p[k]; s.cntT[k] = now;
  }
  if (p.hp + p.soul < s.hp + s.soul) s.hurtT = now;
  else if (p.hp > s.hp) { s.healT = now; s.healIdx = Math.ceil(p.hp / 2) - 1; }
  else if (p.soul > s.soul) { s.healT = now; s.healIdx = p.maxHearts + Math.ceil(p.soul / 2) - 1; }
  s.hp = p.hp; s.soul = p.soul;
  if (p.mantle !== s.mantle) { s.mantle = p.mantle; s.mantleT = now; if (!p.mantle) s.hurtT = now; }
  const id = p.active ? p.active.id : null;
  if (id !== s.activeId) { s.activeId = id; s.activeT = now; }
  const ready = !!(p.active && p.active.charge >= p.active.max);
  if (ready && !s.ready) s.readyT = now;
  s.ready = ready;
  const ck = hudConsKey(p);
  if (ck !== s.consKey) { s.consKey = ck; s.consT = now; }
}

// градиенты строятся один раз (в координатах вокруг 0,0) и рисуются через translate
function hudGrad(c, key, make) {
  let g = hudState.grads[key];
  if (!g) g = hudState.grads[key] = make(c);
  return g;
}
function hudEase(k) { return 1 - (1 - k) * (1 - k) * (1 - k); }
function hudFmt(d) { return (d > 0 ? '+' : '-') + Math.abs(d).toFixed(2); }
function hudArrow(c, x, y, up, col, outline = 'rgba(0,0,0,0.85)') {
  poly(c, up ? [x - 4, y + 3, x + 4, y + 3, x, y - 4] : [x - 4, y - 3, x + 4, y - 3, x, y + 4], col, outline, 1.5);
}
function hudWrap(c, str, w, size) {
  c.font = font(size);
  const out = [];
  let cur = '';
  for (const wd of String(str).split(' ')) {
    const t = cur ? cur + ' ' + wd : wd;
    if (cur && c.measureText(t).width > w) { out.push(cur); cur = wd; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- активный предмет и шкала заряда ----------
function hudActive(c, p, lv) {
  const s = hudState, now = s.t, a = p.active;
  const x = 6, y = 6, sz = 44, cx = x + sz / 2, cy = y + sz / 2;
  if (!a) { rrect(c, x, y, sz, sz, 8, 'rgba(0,0,0,0.22)', lv ? 'rgba(168,136,90,0.2)' : null, 1.5); return; }
  const ready = a.charge >= a.max;
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.12);
  rrect(c, x, y, sz, sz, 8, lv ? 'rgba(18,11,8,0.72)' : 'rgba(0,0,0,0.4)', lv ? OUT : null, 3);
  if (ready && lv > 1) {
    c.save(); c.translate(cx, cy); c.globalAlpha = 0.6 + 0.4 * pulse;
    circle(c, 0, 0, 21, hudGrad(c, 'ready', g => {
      const r = g.createRadialGradient(0, 0, 3, 0, 0, 21);
      r.addColorStop(0, 'rgba(255,236,150,0.6)'); r.addColorStop(1, 'rgba(255,236,150,0)');
      return r;
    }));
    c.restore();
  } else if (ready && lv) circle(c, cx, cy, 17 + pulse * 2, 'rgba(255,240,170,0.14)');
  // «подпрыгивание» при подборе и при полной зарядке
  const pk = Math.max(0, 1 - (now - Math.max(s.activeT, s.readyT)) / 18);
  drawItemIcon(c, a.id, cx, cy, 1.05 * (1 + 0.28 * pk * pk));
  if (pk > 0.5) rrect(c, x + 3, y + 3, sz - 6, sz - 6, 6, 'rgba(255,248,220,' + ((pk - 0.5) * 1.2).toFixed(2) + ')');
  if (lv) rrect(c, x + 2.5, y + 2.5, sz - 5, sz - 5, 6, null, ready ? 'rgba(255,220,120,' + (0.45 + 0.4 * pulse).toFixed(2) + ')' : 'rgba(168,136,90,0.45)', 1.5);

  // шкала заряда с делениями
  const bx = 53, by = 7, bw = 9, bh = 42, ih = bh - 4, fh = ih * clamp(a.charge / a.max, 0, 1);
  rrect(c, bx, by, bw, bh, 3, '#120c0a', lv ? OUT : '#ddd', lv ? 2 : 1.5);
  if (fh > 0) {
    if (lv > 1) {
      c.save(); c.translate(bx + 2, 0);
      c.fillStyle = hudGrad(c, ready ? 'chgY' : 'chgG', g => {
        const r = g.createLinearGradient(0, 0, bw - 4, 0);
        r.addColorStop(0, ready ? '#fff4b0' : '#b0f4a8'); r.addColorStop(0.5, ready ? '#ffd84a' : '#5cc45c'); r.addColorStop(1, ready ? '#c8961a' : '#2e8a2e');
        return r;
      });
      c.fillRect(0, by + 2 + ih - fh, bw - 4, fh);
      c.restore();
    } else {
      c.fillStyle = ready ? '#ffd84a' : '#5cc45c';
      c.fillRect(bx + 2, by + 2 + ih - fh, bw - 4, fh);
      if (lv) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(bx + 2, by + 2 + ih - fh, 1.5, fh); }
    }
  }
  c.fillStyle = '#120c0a';
  for (let j = 1; j < a.max; j++) c.fillRect(bx + 1, by + 2 + ih * j / a.max - 0.75, bw - 2, 1.5);
  if (lv) {
    rrect(c, bx, by, bw, bh, 3, null, ready ? 'rgba(255,232,150,' + (0.55 + 0.4 * pulse).toFixed(2) + ')' : 'rgba(216,200,168,0.75)', 1.2);
    if (ready && lv > 1) rrect(c, bx - 2.5, by - 2.5, bw + 5, bh + 5, 5, null, 'rgba(255,214,90,' + (0.15 + 0.25 * pulse).toFixed(2) + ')', 2.5);
  }
}

// ---------- сердца ----------
// двойной удар сердца: 0..1
function hudBeat(t) {
  const ph = (t % 56) / 56;
  const bump = (c0, w) => Math.max(0, 1 - Math.abs(ph - c0) / w);
  return Math.max(bump(0.06, 0.06), 0.65 * bump(0.25, 0.06));
}
// щит Святой мантии
function hudShield(c, x, y, s, lv) {
  c.beginPath();
  c.moveTo(x, y - s * 0.55);
  c.quadraticCurveTo(x + s * 0.5, y - s * 0.52, x + s * 0.5, y - s * 0.12);
  c.quadraticCurveTo(x + s * 0.42, y + s * 0.38, x, y + s * 0.6);
  c.quadraticCurveTo(x - s * 0.42, y + s * 0.38, x - s * 0.5, y - s * 0.12);
  c.quadraticCurveTo(x - s * 0.5, y - s * 0.52, x, y - s * 0.55);
  c.closePath();
  c.fillStyle = 'rgba(236,244,255,0.9)'; c.fill();
  c.strokeStyle = '#4a6a94'; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = '#8fb0dc';
  c.fillRect(x - s * 0.07, y - s * 0.34, s * 0.14, s * 0.66);
  c.fillRect(x - s * 0.24, y - s * 0.16, s * 0.48, s * 0.13);
  if (lv) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x - s * 0.36, y - s * 0.34, s * 0.12, s * 0.2); }
}
// призрачная иконка Потерянного вместо сердец
function hudGhost(c, x, y, s, t) {
  const by = y + Math.sin(t * 0.08) * 1.2, r = s * 0.42;
  c.beginPath();
  c.arc(x, by - s * 0.08, r, Math.PI, 0);
  c.lineTo(x + r, by + s * 0.4);
  for (let i = 0; i < 4; i++) {
    const xa = x + r - (i + 0.5) * r * 0.5, xb = x + r - (i + 1) * r * 0.5;
    c.quadraticCurveTo(xa, by + s * (i % 2 ? 0.58 : 0.22), xb, by + s * 0.4);
  }
  c.closePath();
  c.fillStyle = 'rgba(238,242,252,0.82)'; c.fill();
  c.strokeStyle = 'rgba(30,30,50,0.85)'; c.lineWidth = 1.4; c.stroke();
  ellipse(c, x - s * 0.15, by - s * 0.1, s * 0.07, s * 0.1, '#1a1a2a');
  ellipse(c, x + s * 0.15, by - s * 0.1, s * 0.07, s * 0.1, '#1a1a2a');
}
function hudAnkh(c, x, y, s) {
  for (const [col, lw] of [[OUT, 3.4], ['#ffd84a', 1.8]]) {
    ellipse(c, x, y - s * 0.5, s * 0.3, s * 0.38, null, col, lw);
    line(c, x, y - s * 0.12, x, y + s * 0.9, col, lw);
    line(c, x - s * 0.5, y + s * 0.12, x + s * 0.5, y + s * 0.12, col, lw);
  }
}
function hudHearts(c, p, lv) {
  const s = hudState, now = s.t;
  const hx = 72, hy = 15, hs = 17;
  const hurt = now - s.hurtT, shake = hurt < 22 ? (1 - hurt / 22) * 2.6 : 0;
  const flash = hurt < 9 ? (1 - hurt / 9) * 0.75 : 0;
  const heal = now - s.healT, healPop = heal < 16 ? 1 - heal / 16 : 0;
  // последнее непустое сердце бьётся, когда здоровья мало
  const life = p.hp + p.soul;
  const beat = !p.lost && !p.dead && life > 0 && life <= 2 ? hudBeat(now) : 0;
  const last = p.soul > 0 ? p.maxHearts + Math.ceil(p.soul / 2) - 1 : Math.ceil(p.hp / 2) - 1;
  let i = 0;
  const slot = () => { const x = hx + (i % 6) * hs, y = hy + Math.floor(i / 6) * 16; i++; return [x, y]; };
  const one = (kind, idx) => {
    const [x0, y0] = slot();
    let sz = 16;
    if (beat && idx === last) sz *= 1 + 0.24 * beat;
    if (healPop && idx === s.healIdx) sz *= 1 + 0.35 * healPop * healPop;
    const x = shake ? x0 + Math.sin(now * 1.9 + idx * 2.3) * shake : x0;
    const y = shake ? y0 + Math.cos(now * 2.3 + idx * 1.3) * shake * 0.7 : y0;
    if (beat && idx === last && lv > 1) {
      c.save(); c.translate(x, y); c.globalAlpha = beat * 0.7;
      circle(c, 0, 0, 15, hudGrad(c, 'beat', g => {
        const r = g.createRadialGradient(0, 0, 2, 0, 0, 15);
        r.addColorStop(0, 'rgba(255,60,60,0.7)'); r.addColorStop(1, 'rgba(255,60,60,0)');
        return r;
      }));
      c.restore();
    }
    if (lv) { heartPath(c, x + 0.8, y + 1.6, sz); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill(); }
    drawHeart(c, x, y, sz, kind);
    if (flash && kind !== 'empty') {
      c.globalAlpha = flash;
      heartPath(c, x, y, sz * 0.82); c.fillStyle = '#fff'; c.fill();
      c.globalAlpha = 1;
    }
  };
  if (p.lost) { const [x, y] = slot(); hudGhost(c, x, y, 19, now); }
  for (let k = 0; k < p.maxHearts; k++) {
    const v = p.hp - k * 2;
    one(v >= 2 ? 'red' : v === 1 ? 'half' : 'empty', k);
  }
  for (let k = 0; k < Math.ceil(p.soul / 2); k++) {
    const v = p.soul - k * 2;
    one(v >= 2 ? 'soul' : 'halfSoul', p.maxHearts + k);
  }
  // щит мантии; при потере — разлетается
  const m = now - s.mantleT;
  if (p.mantle) {
    const [x, y] = slot(), pop = m < 18 ? 1 - m / 18 : 0;
    hudShield(c, x, y, 15 * (1 + 0.4 * pop * pop), lv);
  } else if (m < 24) {
    const [x, y] = slot();
    c.globalAlpha = 1 - m / 24;
    hudShield(c, x, y, 15 * (1 + m / 20), lv);
    c.globalAlpha = 1;
  }
  if (p.extraLives > 0) {
    const x = hx + 6 * hs + 2;
    hudAnkh(c, x, hy - 1, 8);
    text(c, 'x' + p.extraLives, x + 7, hy + 1, 14, '#ffd84a');
  }
}

// ---------- монеты, бомбы, ключи ----------
// одна строка счётчика; q > 0 — счётчик «подпрыгивает» после изменения
function hudCounterRow(c, k, j, v, q, dir) {
  const y = 70 + (j === 0 ? 0 : j === 1 ? 26 : 50);
  if (q) { const sc = 1 + 0.3 * q; c.save(); c.translate(18, y); c.scale(sc, sc); }
  const ix = q ? 0 : 18, iy = q ? 0 : y;
  if (k === 'coins') drawCoin(c, ix, iy, 7, 1);
  else if (k === 'bombs') drawBomb(c, ix, iy, 7, -1);
  else drawKey(c, ix, iy, 15);
  if (q) {
    c.restore();
    const sc = 1 + 0.45 * q;
    c.save(); c.translate(32, y + 1); c.scale(sc, sc);
    text(c, String(v).padStart(2, '0'), 0, 0, 18, mixColor('#ffffff', dir > 0 ? '#ffe680' : '#ff8a7a', q));
    c.restore();
  } else text(c, String(v).padStart(2, '0'), 32, y + 1, 18, '#fff');
}
function hudCounters(c, p) {
  const s = hudState, now = s.t, qs = [];
  // значки монеты, бомбы и ключа зависят от качества графики
  let key = gfxLevel() + '|';
  hudCounterKeys.forEach((k, j) => {
    const age = now - s.cntT[k], pop = age < 18 ? 1 - age / 18 : 0;
    qs[j] = Math.round(pop * pop * 10) / 10;
    key += p[k] + (qs[j] ? '*' : '') + ',';
  });
  // спокойные счётчики берём из кэша, «подпрыгивающий» рисуем поверх
  const sp = hudSprite('cnt', key, 76, 80, g => {
    g.translate(-2, -56);
    hudCounterKeys.forEach((k, j) => { if (!qs[j]) hudCounterRow(g, k, j, p[k], 0, 0); });
  });
  hudBlit(c, sp, 2, 56);
  hudCounterKeys.forEach((k, j) => { if (qs[j]) hudCounterRow(c, k, j, p[k], qs[j], s.cntDir[k]); });
}

// ---------- характеристики со всплывающими изменениями ----------
function hudStats(c, p, lv) {
  const s = hudState, now = s.t, x0 = 4, y0 = 146, rh = 24;
  // панель со значениями — из кэша; свежие изменения подсвечены
  let key = lv + '|';
  for (const k of hudStatOrder) {
    const pp = s.pops[k];
    key += s.stats[k].toFixed(2) + (pp && now - pp.t < 50 ? (pp.d > 0 ? '+' : '-') : '') + ',';
  }
  const sp = hudSprite('stats', key, 70, 156, g => {
    g.translate(-2, -144);
    if (lv) {
      rrect(g, x0, y0, 64, rh * 6 + 6, 7, 'rgba(0,0,0,0.3)', 'rgba(255,236,200,0.08)', 1);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let j = 1; j < 6; j += 2) g.fillRect(x0 + 3, y0 + 3 + j * rh, 58, rh);
    }
    hudStatOrder.forEach((k, j) => {
      const y = y0 + 3 + rh / 2 + j * rh;
      drawStatIcon(g, k, 16, y);
      const pp = s.pops[k], age = pp ? now - pp.t : 999;
      const col = age < 50 ? (pp.d > 0 ? '#c4f4b8' : '#f8bcb0') : '#e8e0d0';
      text(g, s.stats[k].toFixed(2), 63, y + 1, 16, col, 'right');
    });
  });
  hudBlit(c, sp, 2, 144);
  hudStatOrder.forEach((k, j) => {
    const y = y0 + 3 + rh / 2 + j * rh;
    const pp = s.pops[k], age = pp ? now - pp.t : 999;
    if (!pp) return;
    if (age > 180) { s.pops[k] = null; return; }
    const a = age < 140 ? 1 : 1 - (age - 140) / 40, sl = Math.min(1, age / 8);
    const up = pp.d > 0, gc = up ? '#5ee05e' : '#ff5a4a', ax = 74 - (1 - sl) * 8;
    c.globalAlpha = a * sl;
    hudArrow(c, ax, y, up, gc);
    text(c, hudFmt(pp.d), ax + 7, y + 1, 15, gc);
    c.globalAlpha = 1;
  });
}

// ---------- пилюля / карта ----------
function hudConsumable(c, p, lv) {
  const cs = p.consumable;
  if (!cs) return;
  const s = hudState, x = 24, y = H - 32;
  const age = s.t - s.consT, pop = age < 18 ? 1 - age / 18 : 0;
  rrect(c, x - 19, y - 19, 38, 38, 9, lv ? 'rgba(18,11,8,0.62)' : 'rgba(0,0,0,0.4)', lv ? 'rgba(168,136,90,0.55)' : null, 1.5);
  c.save(); c.translate(x, y);
  if (pop) { const sc = 1 + 0.35 * pop * pop; c.scale(sc, sc); }
  if (cs.type === 'pill') drawPill(c, 0, 0, 22, G.pillColors[cs.id]);
  else drawCard(c, 0, 0, 26, CARDS[cs.id].color);
  c.restore();
  const nm = cs.type === 'pill' ? (G.pillKnown.has(cs.id) ? PILLS[cs.id].name : '???') : CARDS[cs.id].name;
  text(c, nm, x + 26, y - 7, 14, '#e8e0d0');
  if (!Input.touchMode) {
    rrect(c, x + 26, y + 3, 16, 15, 3, 'rgba(232,224,208,0.14)', 'rgba(232,224,208,0.6)', 1);
    text(c, 'Q', x + 34, y + 10.5, 11, '#e8e0d0', 'center', null);
  }
}

// ---------- название этажа ----------
function hudFloorName(c) {
  if (!G.floor) return;
  const curse = G.floor.curse, name = STAGES[G.stage].name;
  // на сенсорном экране справа внизу кнопка паузы — подпись левее
  const xr = Input.touchMode ? W - 76 : W - 12;
  const sp = hudSprite('floor', name + '|' + curse, 160, 44, g => {
    text(g, name, 156, 30, 15, '#a89c88', 'right');
    if (curse) text(g, curse === 'darkness' ? 'Проклятие тьмы' : 'Проклятие потерянного', 156, 12, 12, '#c45a5a', 'right');
  });
  hudBlit(c, sp, xr - 156, H - 44);
}

// ---------- полоска здоровья босса ----------
function hudBossBar(c, lv) {
  const s = hudState, b = s.boss, room = G.room;
  if (!room || room.type !== 'boss' || room.cleared || !G.bossMax) { b.room = null; return; }
  const now = s.t, dt = s.dt, max = G.bossMax, cur = bossTotal();
  if (b.room !== room || b.max !== max) { b.room = room; b.max = max; b.shown = b.lag = b.last = cur; b.hold = 0; b.t0 = now; b.hitT = -999; }
  if (cur < b.last - 0.01) { b.hold = 26; b.hitT = now; }
  b.last = cur;
  // основная полоса быстро догоняет здоровье, светлый «след» урона — с задержкой
  b.shown += (cur - b.shown) * (1 - Math.pow(0.6, dt));
  if (Math.abs(cur - b.shown) < 0.05) b.shown = cur;
  if (cur >= b.lag) b.lag = cur;
  else if (b.hold > 0) b.hold -= dt;
  else b.lag = Math.max(cur, b.lag - (max * 0.004 + (b.lag - cur) * 0.07) * dt);
  const w = 360, h = 12, x = W / 2 - w / 2;
  const intro = hudEase(clamp((now - b.t0) / 24, 0, 1)), y = H - 25 + (1 - intro) * 40;
  const kS = clamp(b.shown / max, 0, 1), kL = clamp(Math.max(b.lag, b.shown) / max, 0, 1);
  c.save();
  if (intro < 1) c.globalAlpha = intro;
  if (lv) {
    poly(c, [x + w + 3, y - 4, x + w + 20, y + h / 2, x + w + 3, y + h + 4], '#3a2418', OUT, 2);
    rrect(c, x - 6, y - 5, w + 12, h + 10, 6, '#1c100c', OUT, 2.5);
    rrect(c, x - 2.5, y - 1.5, w + 5, h + 3, 4, null, '#5e4030', 1.2);
  } else rrect(c, x - 3, y - 3, w + 6, h + 6, 4, '#120606', '#000', 2);
  c.fillStyle = '#2c0707'; c.fillRect(x, y, w, h);
  if (kL > kS) { c.fillStyle = '#f4c48c'; c.fillRect(x + w * kS, y, w * (kL - kS), h); }
  if (kS > 0) {
    if (lv > 1) {
      c.save(); c.translate(0, y);
      c.fillStyle = hudGrad(c, 'boss', g => {
        const r = g.createLinearGradient(0, 0, 0, h);
        r.addColorStop(0, '#ff6a50'); r.addColorStop(0.45, '#d42424'); r.addColorStop(1, '#7a0c0c');
        return r;
      });
      c.fillRect(x, 0, w * kS, h);
      c.restore();
    } else { c.fillStyle = '#d42424'; c.fillRect(x, y, w * kS, h); }
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x, y + 1, w * kS, 2.5);
    if (lv) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 3, w * kS, 3); }
  }
  const hit = now - b.hitT;
  if (hit < 7) { c.fillStyle = 'rgba(255,255,255,' + ((1 - hit / 7) * 0.35).toFixed(2) + ')'; c.fillRect(x, y, w * kL, h); }
  if (lv) { c.fillStyle = 'rgba(0,0,0,0.45)'; for (let q = 1; q < 4; q++) c.fillRect(x + w * q / 4 - 0.75, y, 1.5, h); }
  // медальон с черепом
  if (lv) { circle(c, x - 14, y + h / 2, 14, '#24140f', OUT, 2.5); circle(c, x - 14, y + h / 2, 10.5, null, '#6a4a34', 1.2); }
  drawSkull(c, x - 14, y + h / 2 + 0.5, lv ? 7.5 : 9);
  // имя босса на табличке
  const name = G.bossName || '';
  if (name) {
    if (lv) { c.font = font(16); const nw = c.measureText(name).width + 26; rrect(c, W / 2 - nw / 2, y - 28, nw, 20, 7, 'rgba(24,12,9,0.88)', '#6a4a34', 1.5); }
    text(c, name, W / 2, y - 17, 16, '#f2e6cf', 'center');
  }
  c.restore();
}

// ---------- баннер подобранного предмета: свиток ----------
function hudBannerLayout(c, b) {
  const s = hudState, lines = b.lines || [];
  let key = b.title + '|' + (b.desc || '') + '|' + (b.small ? 1 : 0);
  for (const l of lines) key += '|' + l.kind + l.text;
  if (s.bannerLay && s.bannerLay.key === key) return s.bannerLay;
  const ts = b.small ? 24 : 30, gap = 20;
  c.font = font(ts);
  const tw = c.measureText(b.title).width;
  c.font = font(17);
  const dw = b.desc ? c.measureText(b.desc).width : 0;
  c.font = font(15);
  const chips = lines.map(l => ({ l, w: c.measureText(l.text).width + (l.kind === 'note' ? 0 : 13) }));
  const total = chips.reduce((a, ch) => a + ch.w, 0) + gap * Math.max(0, chips.length - 1);
  // слишком длинная строка изменений делится на ряды примерно поровну
  const maxRow = Math.max(540, tw, dw);
  const nRows = total > maxRow ? Math.ceil(total / maxRow) : 1;
  const lim = nRows > 1 ? Math.max(total / nRows * 1.12, ...chips.map(ch => ch.w)) : Infinity;
  const rows = [];
  let row = null;
  for (const ch of chips) {
    if (!row || (row.items.length && row.w + gap + ch.w > lim)) { row = { items: [], w: -gap }; rows.push(row); }
    row.items.push(ch); row.w += gap + ch.w;
  }
  const inner = Math.max(tw, dw, ...rows.map(r => r.w));
  const h = 10 + ts + (b.desc ? 22 : 0) + (rows.length ? 6 + rows.length * 20 : 0) + 10;
  return (s.bannerLay = { key, ts, rows, gap, w: Math.ceil(Math.max(inner, 180)) + 64, h });
}
function hudScrollRoll(c, x, top, h, lv) {
  rrect(c, x - 7, top - 5, 14, h + 10, 6, '#dccca6', OUT, 2.5);
  if (lv) {
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x - 4, top - 1, 2, h + 2);
    c.fillStyle = 'rgba(110,70,30,0.3)'; c.fillRect(x + 2, top - 1, 3, h + 2);
  }
  rrect(c, x - 4.5, top - 11, 9, 7, 2.5, '#7a5230', OUT, 1.5);
  rrect(c, x - 4.5, top + h + 4, 9, 7, 2.5, '#7a5230', OUT, 1.5);
}
// бумага свитка с текстом — рисуется один раз на баннер
function hudBannerPaint(g, b, lay, lv) {
  const w = lay.w, h = lay.h, cx = 2 + w / 2;
  let paper = '#e8dcc0';
  if (lv > 1) {
    paper = g.createLinearGradient(0, 2, 0, 2 + h);
    paper.addColorStop(0, '#f4ebd4'); paper.addColorStop(0.55, '#e8dcc0'); paper.addColorStop(1, '#d2bf98');
  }
  rrect(g, 2, 2, w, h, 3, paper, OUT, 2.5);
  if (lv) {
    g.fillStyle = 'rgba(120,80,40,0.12)';
    g.fillRect(4, 5, w - 4, 2); g.fillRect(4, h - 3, w - 4, 2);
    if (lv > 1) for (let i = 0; i < 4; i++) {
      ellipse(g, cx + Math.sin(i * 2.7 + w) * w * 0.38, 2 + h * (0.25 + 0.5 * ((i * 0.37 + w * 0.01) % 1)), 12 + i * 4, 5 + i * 1.5, 'rgba(140,96,40,0.07)');
    }
  }
  text(g, b.title, cx, 12 + lay.ts / 2, lay.ts, '#2a1a10', 'center', null);
  let yy = 12 + lay.ts;
  if (b.desc) { text(g, b.desc, cx, yy + 11, 17, '#5a4030', 'center', null); yy += 22; }
  yy += 6;
  // изменения: зелёные — улучшения, красные — ухудшения
  for (const row of lay.rows) {
    let lx = cx - row.w / 2;
    const ry = yy + 10;
    for (const ch of row.items) {
      const l = ch.l, col = l.kind === 'up' ? '#2a7a2a' : l.kind === 'down' ? '#a02020' : '#6a5a48';
      let tx = lx;
      if (l.kind !== 'note') { hudArrow(g, lx + 4, ry, l.kind === 'up', col, null); tx += 13; }
      text(g, l.text, tx, ry, 15, col, 'left', null);
      lx += ch.w + lay.gap;
    }
    yy += 20;
  }
}
function hudBanner(c, lv) {
  const s = hudState, b = G.banner;
  if (!b) { s.banner = null; return; }
  if (s.banner !== b) { s.banner = b; s.bannerT0 = Math.max(1, b.t); }
  const lay = hudBannerLayout(c, b);
  const el = s.bannerT0 - b.t;
  // свиток разворачивается из середины и сворачивается в конце
  const k = Math.min(hudEase(clamp(el / 14, 0, 1)), hudEase(clamp(b.t / 14, 0, 1)));
  const a = clamp(Math.min(el / 6 + 0.15, b.t / 12), 0, 1);
  if (a <= 0) return;
  const ps = PIXEL_SCALE, top = 22, h = lay.h;
  const sp = hudSprite('banner', lay.key + '|' + lv, lay.w + 4, h + 4, g => hudBannerPaint(g, b, lay, lv));
  // видна только развёрнутая середина бумаги
  const sw = Math.max(1, Math.round(Math.max(20, lay.w * k) * ps)), bw = sw / ps;
  const sx = Math.round((2 + (lay.w - bw) / 2) * ps);
  const x0 = Math.round((W / 2 - bw / 2) * ps) / ps, x1 = x0 + bw;
  c.save();
  c.globalAlpha = a;
  if (lv) rrect(c, x0 + 3, top + 5, bw, h, 3, 'rgba(0,0,0,0.35)');
  c.drawImage(sp.cv, sx, 0, sw, sp.cv.height, x0, Math.round((top - 2) * ps) / ps, bw, sp.cv.height / ps);
  hudScrollRoll(c, x0, top, h, lv);
  hudScrollRoll(c, x1, top, h, lv);
  c.restore();
}

// ---------- подсказки у пьедесталов и товаров ----------
// описание предмета считается редко: только когда меняются характеристики героя
function hudDescribe(id, p) {
  const s = hudState, st = s.stats;
  let sig = id;
  for (const k of hudStatOrder) sig += ',' + st[k].toFixed(3);
  sig += '|' + p.maxHearts + ',' + p.soul + ',' + p.bombs + ',' + p.keys + ',' + p.coins + ',' + p.items.length + ',' + p.extraLives + ',' + (Input.touchMode ? 1 : 0);
  const e = s.descs.get(id);
  if (e && e.sig === sig) return e.res;
  if (s.descs.size > 40) s.descs.clear();
  const res = describeItem(id, p);
  s.descs.set(id, { sig, res });
  return res;
}
// плавное появление подсказки при смене цели
function hudTipFade(ref, id) {
  const s = hudState;
  if (s.tipRef !== ref || s.tipItem !== id) { s.tipRef = ref; s.tipItem = id; s.tipT = s.t; }
  return clamp((s.t - s.tipT) / 8, 0, 1);
}
function hudPickupName(pk) {
  switch (pk.kind) {
    case 'pill': return G.pillKnown.has(pk.pill) ? PILLS[pk.pill].name : 'Неизвестная пилюля';
    case 'card': return CARDS[pk.card] ? CARDS[pk.card].name : 'Карта';
    case 'heart': return pk.value >= 2 ? 'Красное сердце' : 'Половинка сердца';
    case 'soulheart': return 'Синее сердце';
    case 'bomb': return pk.value >= 2 ? 'Две бомбы' : 'Бомба';
    case 'key': return 'Ключ';
    case 'coin': return 'Монета';
    case 'chest': return 'Сундук';
    case 'goldchest': return 'Золотой сундук';
  }
  return '';
}
// Области интерфейса, которые подсказки не должны закрывать: [x0, y0, x1, y1]
function fixBHudZones(c, p) {
  const z = [];
  // активный предмет, сердца, счётчики и характеристики слева
  const nh = (p.lost ? 1 : 0) + p.maxHearts + Math.ceil(p.soul / 2) + (p.mantle ? 1 : 0);
  z.push([0, 0, 64, 54], [64, 0, 72 + 6 * 17 + (p.extraLives > 0 ? 34 : 0), 25 + Math.max(0, Math.ceil(nh / 6) - 1) * 16]);
  z.push([0, 54, 82, 140]);
  if (Settings.v.statHud) z.push([0, 140, 80, 300]);
  if (p.consumable) z.push([0, H - 54, 180, H]);
  // мини-карта
  if (G.floor) {
    const [x0, y0, x1, y1] = floorBounds();
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, cw = Math.min(16, 100 / bw, 84 / bh / 0.8);
    z.push([W - 16 - bw * cw, 0, W, 16 + bh * cw * 0.8]);
    // название этажа
    const xr = Input.touchMode ? W - 76 : W - 12;
    z.push([xr - 140, H - (G.floor.curse ? 44 : 28), xr + 4, H]);
  }
  // полоска босса
  if (hudState.boss.room) z.push([W / 2 - 200, H - 58, W / 2 + 200, H]);
  // свиток подобранного предмета
  if (G.banner) { const bl = hudBannerLayout(c, G.banner); z.push([W / 2 - bl.w / 2 - 12, 0, W / 2 + bl.w / 2 + 12, 22 + bl.h + 14]); }
  return z;
}
// площадь пересечения прямоугольника (x, y, w, h) с [x0, y0, x1, y1]
function fixBOverlap(x, y, w, h, r) {
  return Math.max(0, Math.min(x + w, r[2]) - Math.max(x, r[0])) * Math.max(0, Math.min(y + h, r[3]) - Math.max(y, r[1]));
}
// Выбор места для подсказки: варианты [x, y, сторона] по порядку предпочтения.
// Нельзя закрывать героя и предмет (keep), нежелательно — интерфейс (zones)
// и выходить за пределы комнаты со стенами. Возвращает [x, y, сторона].
function fixBPlace(cands, w, h, keep, zones) {
  const rx0 = RX - WALL, ry0 = RY - WALL, rx1 = RX + RW + WALL, ry1 = RY + RH + WALL;
  // в сенсорном режиме справа колонка кнопок — подсказка не заходит под неё
  const xr = Input.touchMode ? W - 84 : W - 4;
  let best = null, bs = Infinity;
  for (const [cx0, cy0, sd] of cands) {
    const x = clamp(cx0, 4, xr - w), y = clamp(cy0, 4, H - 4 - h);
    let sc = (w * h - fixBOverlap(x, y, w, h, [rx0, ry0, rx1, ry1])) * 0.02;
    for (const r of keep) sc += 4 * fixBOverlap(x, y, w, h, r);
    for (const r of zones) sc += fixBOverlap(x, y, w, h, r);
    if (sc < bs - 0.5) { bs = sc; best = [x, y, sd]; }
  }
  return best;
}
function hudItemInfo(c, p, lv) {
  const s = hudState, mode = Settings.v.itemInfo, room = G.room;
  if (mode === 'off' || !room || p.dead || p.holding > 0) { s.tipRef = null; return; }
  let pd = null, pdD = 85;
  for (const o of room.pedestals) {
    if (!o.item || !ITEMS[o.item]) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < pdD) { pdD = d; pd = o; }
  }
  let pk = null, pkD = 64;
  for (const o of room.pickups) {
    if (o.dead || !(o.price > 0 || o.kind === 'pill' || o.kind === 'card')) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < pkD) { pkD = d; pk = o; }
  }
  if (pk && (!pd || pkD < pdD)) {
    const sub = pk.kind === 'card' && CARDS[pk.card] ? CARDS[pk.card].desc : '';
    hudLabel(c, pk.x, pk.y - (pk.z || 0) - 18, pk.y + 30, hudPickupName(pk), sub, p, lv, hudTipFade(pk, pk.kind));
  } else if (pd) {
    if (mode === 'full') hudTooltip(c, pd, p, lv);
    else hudLabel(c, pd.x, pd.y - 56, pd.y + 34, ITEMS[pd.item].name, '', p, lv, hudTipFade(pd, pd.item));
  } else s.tipRef = null;
}
// маленькая табличка с названием над предметом (под ним, если сверху стоит герой)
function hudLabel(c, x, aboveY, belowY, name, sub, p, lv, a) {
  const key = name + '|' + sub + '|' + lv;
  let sp = hudState.sprites.label;
  if (!sp || sp.key !== key || sp.ps !== PIXEL_SCALE) {
    c.font = font(15);
    let tw = c.measureText(name).width;
    if (sub) { c.font = font(12); tw = Math.max(tw, c.measureText(sub).width); }
    const w = Math.ceil(tw) + 18, h = sub ? 36 : 22;
    sp = hudSprite('label', key, w + 6, h + 7, g => {
      g.translate(2, 2);
      if (lv) rrect(g, 2, 3, w, h, 8, 'rgba(0,0,0,0.35)');
      rrect(g, 0, 0, w, h, 8, 'rgba(22,14,11,0.9)', '#a8885a', 1.5);
      text(g, name, w / 2, 11.5, 15, '#f8ead0', 'center', null);
      if (sub) text(g, sub, w / 2, 26, 12, '#c9b48c', 'center', null);
    });
    sp.lw = w; sp.lh = h;
  }
  const w = sp.lw, h = sp.lh;
  // над предметом, под ним или сбоку — так, чтобы не закрыть героя, предмет и интерфейс
  const my = (aboveY + belowY) / 2 - h / 2;
  const sides = p.x > x ? [[x - 26 - w, my], [x + 26, my]] : [[x + 26, my], [x - 26 - w, my]];
  const keep = [[p.x - 18, p.y - 44, p.x + 18, p.y + 12], [x - 16, aboveY, x + 16, belowY]];
  const pos = fixBPlace([[x - w / 2, aboveY - h], [x - w / 2, belowY], ...sides], w, h, keep, fixBHudZones(c, p));
  const x0 = pos[0];
  let y0 = pos[1];
  y0 += (1 - a) * 4;
  c.globalAlpha = a;
  hudBlit(c, sp, x0 - 2, y0 - 2);
  c.globalAlpha = 1;
}
function hudTipLayout(c, info, it, costKey) {
  const pad = 10, iw = hudTipW - pad * 2, ops = [];
  let y = pad;
  // заголовок: иконка + название (+ отметка активного предмета)
  const names = hudWrap(c, info.name, iw - 46, 19).slice(0, 2);
  const badge = !!(it && it.active);
  const nh = names.length * 20 + (badge ? 18 : 0);
  const hh = Math.max(40, nh + 4);
  let ny = y + (hh - nh) / 2 + 10;
  for (const n of names) { ops.push({ t: n, x: pad + 46, y: ny, size: 19, col: '#f8ead0' }); ny += 20; }
  const badgeY = badge ? ny - 1 : 0;
  y += hh + 4;
  if (info.desc) {
    for (const d of hudWrap(c, '«' + info.desc + '»', iw, 14)) { ops.push({ t: d, x: pad, y: y + 8, size: 14, col: '#c9b48c' }); y += 17; }
    y += 3;
  }
  const sepY = info.lines.length ? y + 2 : 0;
  if (info.lines.length) y += 7;
  for (const l of info.lines) {
    const str = l.text.replace(/^Активный предмет — /, 'Использовать: ');
    const col = l.kind === 'up' ? '#78e070' : l.kind === 'down' ? '#ff7a68' : '#d2c4a8';
    hudWrap(c, str, iw - 14, 14).forEach((t, i) => { ops.push({ t, x: pad + 14, y: y + 8, size: 14, col, bullet: i === 0 ? l.kind : null }); y += 17; });
  }
  const costY = costKey ? y + 14 : 0;
  if (costKey) y += 26;
  y += pad - 2;
  return { info, costKey, h: Math.round(y), ops, sepY, badgeY, hh, pad, costY, id: 0 };
}
// содержимое подсказки рисуется один раз в спрайт (панель в точке 2,2)
function hudTipPaint(g, lay, pd, p, lv, cost) {
  const w = hudTipW, h = lay.h, pad = lay.pad;
  g.translate(2, 2);
  if (lv) rrect(g, 3, 4, w, h, 9, 'rgba(0,0,0,0.4)');
  let fill = 'rgba(22,14,11,0.94)';
  if (lv > 1) {
    fill = g.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgba(48,32,24,0.95)'); fill.addColorStop(1, 'rgba(18,11,8,0.95)');
  }
  rrect(g, 0, 0, w, h, 9, fill, '#a8885a', 2);
  if (lv) rrect(g, 3.5, 3.5, w - 7, h - 7, 6, null, 'rgba(168,136,90,0.25)', 1);
  // иконка
  const iby = pad + (lay.hh - 38) / 2;
  rrect(g, pad, iby, 38, 38, 7, 'rgba(0,0,0,0.35)', 'rgba(168,136,90,0.5)', 1.2);
  drawItemIcon(g, pd.item, pad + 19, iby + 19, 1);
  for (const op of lay.ops) {
    if (op.bullet === 'up' || op.bullet === 'down') hudArrow(g, pad + 5, op.y, op.bullet === 'up', op.col, null);
    else if (op.bullet === 'note') circle(g, pad + 5, op.y, 2, op.col);
    text(g, op.t, op.x, op.y, op.size, op.col, 'left', null);
  }
  if (lay.badgeY) {
    const bt = 'Активный предмет';
    g.font = font(12);
    const bw = g.measureText(bt).width + 14;
    rrect(g, pad + 46, lay.badgeY - 7.5, bw, 15, 7, 'rgba(255,216,74,0.14)', 'rgba(255,216,74,0.6)', 1);
    text(g, bt, pad + 53, lay.badgeY + 0.5, 12, '#ffd84a', 'left', null);
  }
  if (lay.sepY) { g.fillStyle = 'rgba(168,136,90,0.35)'; g.fillRect(pad, lay.sepY, w - pad * 2, 1); }
  // цена
  if (!lay.costKey) return;
  const cy = lay.costY, cx = pad + 44;
  g.fillStyle = 'rgba(168,136,90,0.35)'; g.fillRect(pad, cy - 13, w - pad * 2, 1);
  text(g, 'Цена:', pad, cy + 1, 14, '#c9b48c', 'left', null);
  if (pd.price) {
    const ok = p.coins >= pd.price;
    drawCoin(g, cx + 6, cy, 7, 1);
    text(g, String(pd.price), cx + 17, cy + 1, 16, ok ? '#ffe9a0' : '#ff7a68', 'left', null);
    if (!ok) text(g, 'не хватает монет', w - pad, cy + 1, 13, '#ff7a68', 'right', null);
  } else if (cost && cost.free) text(g, 'бесплатно', cx, cy + 1, 15, '#ffd84a', 'left', null);
  else {
    const soul = cost && cost.soul, n = soul ? 3 : pd.devil;
    for (let i = 0; i < n; i++) drawHeart(g, cx + 7 + i * 15, cy, 13, !cost ? 'empty' : soul ? 'soul' : 'red');
    const note = !cost ? 'не хватает здоровья' : soul ? 'синих сердца' : plural(n, 'контейнер', 'контейнера', 'контейнеров');
    text(g, note, cx + n * 15 + 6, cy + 1, 13, !cost ? '#ff7a68' : '#d2c4a8', 'left', null);
  }
}
function hudTooltip(c, pd, p, lv) {
  const s = hudState, it = ITEMS[pd.item];
  const info = hudDescribe(pd.item, p);
  const cost = pd.devil ? pd.devilCost(p) : null;
  const costKey = pd.price ? 'c' + pd.price : pd.devil ? (cost ? (cost.free ? 'f' : cost.hearts ? 'h' + cost.hearts : 's') : 'n' + pd.devil) : '';
  let lay = s.tipLay;
  if (!lay || lay.info !== info || lay.costKey !== costKey) { lay = s.tipLay = hudTipLayout(c, info, it, costKey); lay.id = ++s.layId; }
  const a = hudTipFade(pd, pd.item);
  const w = hudTipW, h = lay.h;
  // выбираем место, где подсказка не закроет героя, сам предмет, свиток и интерфейс
  const iy = pd.y - 34;
  const above = [pd.x - w / 2, pd.y - 60 - h, 'up'], below = [pd.x - w / 2, pd.y + 36, 'down'];
  const right = [pd.x + 34, iy - h / 2, 'right'], left = [pd.x - 34 - w, iy - h / 2, 'left'];
  const sides = p.x > pd.x ? [left, right] : [right, left];
  const order = p.y > pd.y - 20 ? [above, ...sides, below] : [below, ...sides, above];
  // запасные варианты: сбоку, но выше или ниже предмета
  for (const [sx, , sd] of sides) order.push([sx, iy - h + 22, sd], [sx, iy - 22, sd]);
  const keep = [[p.x - 20, p.y - 46, p.x + 20, p.y + 14], [pd.x - 18, pd.y - 54, pd.x + 18, pd.y + 30]];
  let [px, py, side] = fixBPlace(order, w, h, keep, fixBHudZones(c, p));
  py += (1 - a) * (side === 'up' ? 6 : side === 'down' ? -6 : 0);
  const ps = PIXEL_SCALE;
  px = Math.round(px * ps) / ps; py = Math.round(py * ps) / ps;
  const key = lay.id + '|' + lv + '|' + pd.item + '|' + (pd.price && p.coins >= pd.price ? 1 : 0);
  const sp = hudSprite('tip', key, w + 7, h + 8, g => hudTipPaint(g, lay, pd, p, lv, cost));
  c.save();
  c.globalAlpha = a;
  hudBlit(c, sp, px - 2, py - 2);
  // хвостик к предмету
  c.translate(px, py);
  const tipCol = lv > 1 ? (side === 'down' ? 'rgb(48,32,24)' : 'rgb(18,11,8)') : 'rgb(22,14,11)';
  if (side === 'up' || side === 'down') {
    const tx = clamp(pd.x - px, 16, w - 16), ey = side === 'up' ? h : 0, d = side === 'up' ? 9 : -9;
    poly(c, [tx - 8, ey - Math.sign(d) * 1.5, tx + 8, ey - Math.sign(d) * 1.5, tx, ey + d], tipCol);
    line(c, tx - 8, ey, tx, ey + d, '#a8885a', 2); line(c, tx + 8, ey, tx, ey + d, '#a8885a', 2);
  } else {
    const ty = clamp(iy - py, 16, h - 16), ex = side === 'right' ? 0 : w, d = side === 'right' ? -9 : 9;
    poly(c, [ex - Math.sign(d) * 1.5, ty - 8, ex - Math.sign(d) * 1.5, ty + 8, ex + d, ty], lv > 1 ? 'rgb(30,20,15)' : tipCol);
    line(c, ex, ty - 8, ex + d, ty, '#a8885a', 2); line(c, ex, ty + 8, ex + d, ty, '#a8885a', 2);
  }
  c.restore();
}

// ---------- удержание R ----------
function hudRestart(c) {
  if (G.restartHold <= 5) return;
  const k = clamp(G.restartHold / 50, 0, 1);
  rrect(c, W / 2 - 100, H / 2 - 20, 200, 38, 10, 'rgba(14,9,7,0.85)', '#8a7050', 1.5);
  text(c, 'Начать заново...', W / 2, H / 2 - 6, 16, '#f2e6cf', 'center');
  rrect(c, W / 2 - 84, H / 2 + 6, 168, 5, 2.5, 'rgba(255,255,255,0.12)');
  if (k > 0) rrect(c, W / 2 - 84, H / 2 + 6, Math.max(5, 168 * k), 5, 2.5, '#d43a3a');
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

// значок особой комнаты на карте
function hudRoomIcon(c, type, x, y, s) {
  switch (type) {
    case 'boss': drawSkull(c, x, y, s); break;
    case 'treasure': poly(c, [x - s, y + s * 0.6, x - s, y - s * 0.4, x - s * 0.4, y, x, y - s * 0.8, x + s * 0.4, y, x + s, y - s * 0.4, x + s, y + s * 0.6], '#ffd84a', OUT, 1); break;
    case 'shop': drawCoin(c, x, y, s * 0.9, 1); break;
    case 'secret': text(c, '?', x, y + 1, s * 2.4, '#fff', 'center', '#000', 2); break;
    case 'devil':
      poly(c, [x - s * 0.7, y - s * 0.1, x - s * 0.95, y - s, x - s * 0.2, y - s * 0.55], '#c43030', OUT, 1);
      poly(c, [x + s * 0.7, y - s * 0.1, x + s * 0.95, y - s, x + s * 0.2, y - s * 0.55], '#c43030', OUT, 1);
      circle(c, x, y + s * 0.15, s * 0.75, '#c43030', OUT, 1);
      break;
    case 'angel':
      ellipse(c, x, y - s * 0.75, s * 0.6, s * 0.2, null, '#ffd84a', 1.5);
      circle(c, x, y + s * 0.15, s * 0.65, '#f4f4ff', OUT, 1);
      break;
  }
}

function drawMap(c, ox, oy, cw, ch, gap, mini) {
  const [x0, y0] = floorBounds();
  const lost = G.floor.curse === 'lost', lv = gfxLevel();
  const list = [];
  for (const r of G.floor.rooms.values()) {
    const cur = r === G.room;
    if (!r.seen && !cur) continue;
    if (lost && !r.visited && !cur) continue;
    list.push(r);
  }
  if (lv) for (const r of list) rrect(c, ox + (r.gx - x0) * cw + gap / 2 + 1, oy + (r.gy - y0) * ch + gap / 2 + 1.5, cw - gap, ch - gap, 2, 'rgba(0,0,0,0.5)');
  for (const r of list) {
    const cur = r === G.room;
    const x = ox + (r.gx - x0) * cw + gap / 2, y = oy + (r.gy - y0) * ch + gap / 2, w = cw - gap, h = ch - gap;
    const fill = cur ? '#ffffff' : r.visited ? '#b4ac9e' : '#4e4942';
    rrect(c, x, y, w, h, 2, fill, 'rgba(0,0,0,0.8)', 1);
    if (lv && !cur && h > 4) { c.fillStyle = r.visited ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'; c.fillRect(x + 1.5, y + 1.5, w - 3, Math.max(1, h * 0.2)); }
  }
  // значки поверх всех клеток, чтобы их не перекрывали соседи
  const s = mini ? Math.max(3.6, Math.min(cw, ch) * 0.38) : Math.min(cw, ch) * 0.32;
  for (const r of list) {
    if (r.type === 'normal' || r.type === 'start') continue;
    hudRoomIcon(c, r.type, ox + (r.gx - x0 + 0.5) * cw, oy + (r.gy - y0 + 0.5) * ch, s);
  }
}

// клетка текущей комнаты (если она есть на карте этажа)
function hudCurCell() {
  for (const r of G.floor.rooms.values()) if (r === G.room) return r;
  return null;
}

function drawMinimap(c) {
  if (!G.floor) return;
  const lv = gfxLevel(), m = hudState.map;
  const [x0, y0, x1, y1] = floorBounds();
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const maxW = 100, maxH = 84;
  const cw = Math.min(16, maxW / bw, maxH / bh / 0.8), ch = cw * 0.8;
  const mw = bw * cw, mh = bh * ch, ox = W - 8 - mw, oy = 8;
  if (lv) {
    rrect(c, ox - 6, oy - 6, mw + 12, mh + 12, 6, 'rgba(12,8,6,0.62)', OUT, 2);
    rrect(c, ox - 3.5, oy - 3.5, mw + 7, mh + 7, 4, null, 'rgba(168,136,90,0.38)', 1);
  } else rrect(c, ox - 4, oy - 4, mw + 8, mh + 8, 5, 'rgba(0,0,0,0.45)');
  // клетки рисуются в маленький холст и обновляются, только когда карта меняется
  let seen = 0, vis = 0;
  for (const r of G.floor.rooms.values()) { if (r.seen) seen++; if (r.visited) vis++; }
  const key = seen + ',' + vis + ',' + G.floor.curse + ',' + PIXEL_SCALE + ',' + lv + ',' + bw + ',' + bh;
  if (!m.cv || m.floor !== G.floor || m.room !== G.room || m.key !== key) {
    const pad = 8, cv = makeCanvas(mw + pad * 2, mh + pad * 2);
    drawMap(cv.ctx, pad, pad, cw, ch, 2, true);
    m.cv = cv.cv; m.floor = G.floor; m.room = G.room; m.key = key; m.pad = pad; m.w = mw + pad * 2; m.h = mh + pad * 2;
    m.cur = hudCurCell();
  }
  c.drawImage(m.cv, ox - m.pad, oy - m.pad, m.w, m.h);
  // текущая комната пульсирует
  if (lv && m.cur) {
    const a = 0.35 + 0.35 * Math.sin(hudState.t * 0.1);
    rrect(c, ox + (m.cur.gx - x0) * cw, oy + (m.cur.gy - y0) * ch, cw, ch, 3, null, 'rgba(255,255,255,' + a.toFixed(2) + ')', 1.5);
  }
  if (G.floor.curse === 'lost') text(c, '?', ox + mw / 2, oy + mh / 2, 24, 'rgba(255,255,255,0.4)', 'center');
}

function drawBigMap(c) {
  if (!G.floor) return;
  const lv = gfxLevel();
  const [x0, y0, x1, y1] = floorBounds();
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cw = Math.min(46, 520 / bw, 300 / bh / 0.8), ch = cw * 0.8;
  const mw = bw * cw, mh = bh * ch;
  const lost = G.floor.curse === 'lost';
  // легенда — только для встреченных особых комнат
  const legend = [];
  c.font = font(13);
  for (const [type, label] of hudLegend) {
    for (const r of G.floor.rooms.values()) {
      if (r.type !== type || !(r.seen || r === G.room) || (lost && !r.visited && r !== G.room)) continue;
      legend.push([type, label, c.measureText(label).width + 34]);
      break;
    }
  }
  const lw = legend.reduce((a, l) => a + l[2], 0) - (legend.length ? 12 : 0);
  const pw = Math.max(mw + 56, lw + 40, 280), ph = 62 + mh + 22 + (legend.length ? 30 : 0);
  const px = W / 2 - pw / 2, py = H / 2 - ph / 2, ox = W / 2 - mw / 2, oy = py + 62;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, H);
  if (lv) rrect(c, px + 4, py + 6, pw, ph, 12, 'rgba(0,0,0,0.45)');
  rrect(c, px, py, pw, ph, 12, 'rgba(18,12,9,0.94)', '#8a7050', 2.5);
  if (lv) {
    rrect(c, px + 6, py + 6, pw - 12, ph - 12, 8, null, 'rgba(168,136,90,0.35)', 1);
    for (const [cx, cy] of [[px + 6, py + 6], [px + pw - 6, py + 6], [px + 6, py + ph - 6], [px + pw - 6, py + ph - 6]]) poly(c, [cx, cy - 5, cx + 5, cy, cx, cy + 5, cx - 5, cy], '#a8885a', OUT, 1);
  }
  text(c, STAGES[G.stage].name, W / 2, py + 28, 24, '#f2e6cf', 'center');
  c.fillStyle = 'rgba(168,136,90,0.5)'; c.fillRect(W / 2 - 70, py + 44, 140, 1.5);
  if (G.floor.curse) text(c, G.floor.curse === 'darkness' ? 'Проклятие тьмы' : 'Проклятие потерянного', W / 2, py + 54, 13, '#d86a5a', 'center');
  drawMap(c, ox, oy, cw, ch, 4, false);
  const cur = hudCurCell();
  if (cur) {
    const a = lv ? 0.5 + 0.4 * Math.sin(hudState.t * 0.1) : 0.9;
    rrect(c, ox + (cur.gx - x0) * cw + 0.5, oy + (cur.gy - y0) * ch + 0.5, cw - 1, ch - 1, 4, null, 'rgba(255,226,140,' + a.toFixed(2) + ')', 2.5);
  }
  let lx = W / 2 - lw / 2;
  const ly = py + ph - 24;
  for (const [type, label, w] of legend) {
    hudRoomIcon(c, type, lx + 8, ly, 6.5);
    text(c, label, lx + 20, ly + 1, 13, '#c9b48c', 'left');
    lx += w;
  }
}

function drawTouchControls(c) {
  const p = G.player, lv = gfxLevel();
  c.save();
  for (const b of TOUCH_BUTTONS) {
    const held = Input.touchHeld.has(b.action);
    c.globalAlpha = held ? 0.85 : 0.62;
    if (lv) circle(c, b.x + 1.5, b.y + 2.5, b.r, 'rgba(0,0,0,0.35)');
    circle(c, b.x, b.y, b.r, held ? 'rgba(255,240,210,0.3)' : 'rgba(18,12,10,0.6)', held ? '#ffe0a0' : 'rgba(255,240,210,0.6)', 2.5);
    if (lv) circle(c, b.x, b.y, b.r - 4, null, 'rgba(255,255,255,0.12)', 1.5);
    const sc = held ? 0.9 : 1;
    if (b.action === 'active') {
      if (p.active) {
        drawItemIcon(c, p.active.id, b.x, b.y, 0.8 * sc);
        // кольцо заряда
        const k = clamp(p.active.charge / p.active.max, 0, 1);
        if (k > 0) {
          c.beginPath(); c.arc(b.x, b.y, b.r + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          c.strokeStyle = k >= 1 ? '#ffd84a' : '#5cc45c'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
        }
      } else text(c, '—', b.x, b.y, 16, '#fff', 'center');
    } else if (b.action === 'bomb') {
      drawBomb(c, b.x, b.y + 3, 9 * sc, -1);
      circle(c, b.x + 18, b.y + 17, 9, '#2a1a16', 'rgba(255,240,210,0.7)', 1.5);
      text(c, String(p.bombs), b.x + 18, b.y + 17.5, 12, '#fff', 'center', null);
    } else if (b.action === 'pill') {
      const cs = p.consumable;
      if (cs) { if (cs.type === 'pill') drawPill(c, b.x, b.y, 18 * sc, G.pillColors[cs.id]); else drawCard(c, b.x, b.y, 20 * sc, CARDS[cs.id].color); }
      else text(c, 'Q', b.x, b.y, 16, '#aaa', 'center');
    } else if (b.action === 'pause') {
      c.fillStyle = '#fff'; c.fillRect(b.x - 6, b.y - 7, 4, 14); c.fillRect(b.x + 2, b.y - 7, 4, 14);
    }
  }
  for (const k of ['move', 'shoot']) {
    const s = Input.sticks[k];
    if (!s) continue;
    c.globalAlpha = 0.62;
    circle(c, s.ox, s.oy, 46, 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.5)', 2);
    if (lv) {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, cx = s.ox + Math.cos(a) * 37, cy = s.oy + Math.sin(a) * 37;
        poly(c, [cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, cx + Math.cos(a + 2.2) * 4, cy + Math.sin(a + 2.2) * 4, cx + Math.cos(a - 2.2) * 4, cy + Math.sin(a - 2.2) * 4], 'rgba(255,255,255,0.45)');
      }
    }
    const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), m = Math.min(l, 46);
    const kx = s.ox + (l ? dx / l * m : 0), ky = s.oy + (l ? dy / l * m : 0);
    if (lv) circle(c, kx + 1, ky + 2, 18, 'rgba(0,0,0,0.3)');
    circle(c, kx, ky, 18, k === 'move' ? 'rgba(240,235,225,0.75)' : 'rgba(140,200,255,0.8)', 'rgba(0,0,0,0.4)', 1.5);
    if (lv) circle(c, kx - 5, ky - 5, 5, 'rgba(255,255,255,0.45)');
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
