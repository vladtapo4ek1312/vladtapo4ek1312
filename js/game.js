'use strict';
// ============================================================
//  Главный цикл, состояния игры, переходы, меню
// ============================================================

const G = {
  state: 'menu', t: 0,
  seed: 0, stage: 1, floor: null, room: null, player: null,
  enemies: [], tears: [], beams: [], bombs: [], effects: [], particles: [],
  shake: 0, flash: 0, hurtFlash: 0, banner: null, slowT: 0,
  bgCache: null, snaps: [], ui: [], trans: null,
  seenItems: new Set(), bossesSeen: new Set(), pillKnown: new Set(), pillPool: [], pillColors: {},
  stats: { kills: 0, time: 0, items: 0 },
  charIdx: 0, menuSel: 0, menuFocus: 0, menuBtn: 0, pauseSel: 0, setSel: 0, settingsFrom: 'menu', restartHold: 0, flowTimer: 0, flowTile: -1,
  bossMax: 0, bossName: '', pendingVS: false, vsT: 0, introT: 0, fadeT: 0, deathT: 0, winT: 0,
  diarrhea: 0, diarrheaT: 0, devilTaken: false, damagedFloor: false, damagedBoss: false, deathCause: '',
};

let canvas, ctx;

// ---------- запуск забега ----------
function newRun(charIdx, seed) {
  G.charIdx = charIdx;
  G.seed = seed != null ? seed : (Math.random() * 0x7fffffff) | 0;
  G.seenItems = new Set();
  G.bossesSeen = new Set();
  G.stats = { kills: 0, time: 0, items: 0 };
  G.devilTaken = false; G.slowT = 0; G.diarrhea = 0; G.winT = 0; G.banner = null; G.restartHold = 0;
  G.shake = 0; G.flash = 0; G.hurtFlash = 0;
  setupPills();
  G.player = new Player(CHARACTERS[charIdx]);
  store('sp_runs', String((+store('sp_runs') || 0) + 1));
  startFloor(1);
}

function startFloor(stage) {
  G.stage = stage;
  G.enemies = []; G.tears = []; G.beams = []; G.bombs = []; G.effects = []; G.particles = [];
  G.floor = generateFloor(stage, G.seed);
  G.damagedFloor = false;
  const f = G.floor;
  if (stage > 1 && stage < LAST_STAGE && chance(0.2)) f.curse = pick(['darkness', 'lost']);
  if (G.player.flags.map) revealFloor();
  const p = G.player;
  p.x = RX + RW / 2; p.y = RY + RH / 2 + 20; p.vx = p.vy = 0;
  enterRoom(f.start, null);
  G.state = 'floorIntro';
  G.introT = 0;
  Sound.music(STAGES[stage].ch);
}

function nextFloor() {
  if (G.state !== 'play') return;
  G.state = 'floorOut';
  G.fadeT = 0;
  Sound.play('fall');
}

// ---------- комнаты ----------
function enterRoom(room, fromDir) {
  G.room = room;
  G.enemies = []; G.tears = []; G.beams = []; G.bombs = []; G.effects = []; G.particles = [];
  G.bgCache = null;
  G.slowT = 0;
  room.visited = true; room.seen = true;
  for (const d of DIR_NAMES) {
    const door = room.doors[d];
    if (door && (!door.hidden || room.type === 'secret')) otherRoom(door, room).seen = true;
  }
  initRoom(room);
  const p = G.player;
  if (fromDir) placeAtDoor(p, OPP[fromDir]);
  p.vx *= 0.3; p.vy *= 0.3;
  p.roomDmg = 0; p.roomDmgMult = 1; p.roomHoming = false; p.charge = 0;
  if (p.flags.mantle) p.mantle = true;
  p.trail = [];
  for (const f of p.familiars) { f.x = p.x; f.y = p.y; }
  if (!room.cleared) {
    if (room.type === 'boss') {
      spawnBoss(room.spawns[0].type);
      G.damagedBoss = false;
    } else {
      for (const s of room.spawns) {
        const [x, y] = tileCenter(s.c, s.r);
        const n = ENEMIES[s.type].group || 1;
        for (let i = 0; i < n; i++) {
          G.enemies.push(new Enemy(s.type, x + (n > 1 ? rand(-14, 14) : 0), y + (n > 1 ? rand(-14, 14) : 0), { champion: s.champion && i === 0 }));
        }
      }
    }
    if (!G.enemies.length) room.cleared = true;
  }
  computeFlow();
  G.pendingVS = room.type === 'boss' && !room.cleared;
  if (room.type === 'boss' && !room.cleared) Sound.music('boss');
  else Sound.music(STAGES[G.stage].ch);
}

function placeAtDoor(p, side) {
  const cxm = RX + RW / 2, cym = RY + RH / 2;
  switch (side) {
    case 'up': p.x = cxm; p.y = RY + T * 0.55; break;
    case 'down': p.x = cxm; p.y = RY + RH - T * 0.55; break;
    case 'left': p.x = RX + T * 0.55; p.y = cym; break;
    case 'right': p.x = RX + RW - T * 0.55; p.y = cym; break;
  }
}

function startTransition(dir) {
  const door = G.room.doors[dir];
  const p = G.player;
  if (!door) { collideWalls(p, false); return; }
  const next = otherRoom(door, G.room);
  door.hidden = false;
  const A = snapshot(0);
  Sound.play('door');
  enterRoom(next, dir);
  const B = snapshot(1);
  G.trans = { dir, t: 0, dur: 18, A, B };
  G.state = 'trans';
}

function snapshot(i) {
  if (!G.snaps[i]) G.snaps[i] = makeCanvas(W, H);
  const s = G.snaps[i];
  s.ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
  s.ctx.fillStyle = '#000';
  s.ctx.fillRect(0, 0, W, H);
  renderWorld(s.ctx, true);
  return s;
}

function teleportTo(room) {
  if (!room) return;
  enterRoom(room, null);
  const p = G.player;
  // ставим героя ниже центра, подальше от пьедесталов и босса
  const [c, r] = freeTileNear(6, room.type === 'boss' && !room.cleared ? 6 : 5, false);
  [p.x, p.y] = tileCenter(c, r);
  for (const f of p.familiars) { f.x = p.x; f.y = p.y; }
  computeFlow();
  G.flash = 20;
  Sound.play('teleport');
  if (G.pendingVS) { G.state = 'vs'; G.vsT = 0; Sound.play('boss'); }
}

function teleportRandom() {
  const rooms = [...G.floor.rooms.values()].filter(r => r !== G.room && r.type !== 'secret');
  teleportTo(pick(rooms));
}

function roomCleared() {
  const room = G.room, p = G.player;
  room.cleared = true;
  Sound.play('door');
  if (p.active && p.active.charge < p.active.max) p.active.charge++;
  if (room.type === 'boss') { bossReward(); return; }
  if (chance(0.38 + p.luck * 0.05)) {
    const [c, r] = freeTileNear(6, 3, false);
    const [x, y] = tileCenter(c, r);
    room.pickups.push(makePickup(randomPickupKind(), x, y));
  }
}

function bossReward() {
  const room = G.room;
  if (G.stage >= LAST_STAGE) {
    G.winT = 160;
    Sound.play('win');
    return;
  }
  const [cx, cy] = tileCenter(6, 3);
  room.pedestals.push(new Pedestal(cx, cy, takeItem('boss')));
  const h = makePickup('heart', cx + 70, cy + 20);
  h.value = 2;
  room.pickups.push(h);
  const [tx, ty] = tileCenter(6, 1);
  room.objects.push(new Trapdoor(tx, ty));
  Sound.play('trapdoor');
  if (G.stage >= 2) {
    const ch = 0.25 + (G.damagedBoss ? 0 : 0.3) + G.player.devilBonus;
    if (chance(ch)) addDealDoor(room, chance(G.devilTaken ? 0.1 : 0.4) ? 'angel' : 'devil');
  }
  Sound.music(STAGES[G.stage].ch);
}

function addDealDoor(room, kind) {
  const free = DIR_NAMES.filter(d => !room.doors[d]);
  if (!free.length) return;
  const d = free.includes('up') ? 'up' : pick(free);
  const dr = new Room(-1, -1, kind);
  const door = { a: room, b: dr, kind, locked: false, hidden: false };
  room.doors[d] = door;
  dr.doors[OPP[d]] = door;
  G.floor.devil = dr;
  G.bgCache = null;
  Sound.play(kind === 'angel' ? 'secret' : 'roar');
}

// ---------- обновление ----------
function update() {
  Input.pollPad();
  G.t++;
  if (Input.pressed('mute')) Sound.toggleMute();
  if (Input.pressed('fullscreen')) toggleFullscreen();
  switch (G.state) {
    case 'menu': updateMenu(); break;
    case 'play': updatePlay(); break;
    case 'trans':
      if (++G.trans.t >= G.trans.dur) {
        G.trans = null;
        if (G.pendingVS) { G.state = 'vs'; G.vsT = 0; Sound.play('boss'); }
        else G.state = 'play';
      }
      break;
    case 'vs':
      G.vsT++;
      if (G.vsT > 150 || (G.vsT > 25 && (Input.pressed('confirm') || Input.clicks.length))) { G.state = 'play'; G.pendingVS = false; }
      break;
    case 'pause': updatePause(); break;
    case 'settings': updateSettings(); break;
    case 'floorOut':
      if (++G.fadeT >= 40) startFloor(G.stage + 1);
      break;
    case 'floorIntro':
      G.introT++;
      if (G.introT >= 100 || (G.introT > 25 && (Input.pressed('confirm') || Input.clicks.length))) G.state = 'play';
      break;
    case 'dead': updateEnd(); break;
    case 'win': updateEnd(); break;
  }
  Input.endStep();
}

function updatePlay() {
  const p = G.player;
  if (Input.pressed('pause') && !p.dead) { G.state = 'pause'; G.pauseSel = 0; return; }
  G.stats.time++;
  if (Input.held('restart')) { if (++G.restartHold >= 50) { newRun(G.charIdx); return; } }
  else G.restartHold = 0;

  p.update();
  if (G.state !== 'play') return;
  for (const f of p.familiars) f.update();

  if (++G.flowTimer >= 6) {
    G.flowTimer = 0;
    const [pc, pr] = tileOf(p.x, p.y);
    const ti = clamp(pr, 0, ROWS - 1) * COLS + clamp(pc, 0, COLS - 1);
    if (ti !== G.flowTile) computeFlow();
  }

  for (let i = 0; i < G.enemies.length; i++) G.enemies[i].update();
  separateEnemies();
  contactDamage();
  for (let i = 0; i < G.tears.length; i++) if (!G.tears[i].dead) G.tears[i].update();
  for (const b of G.beams) b.update();
  for (let i = 0; i < G.bombs.length; i++) if (!G.bombs[i].dead) G.bombs[i].update();
  const room = G.room;
  for (let i = 0; i < room.pickups.length; i++) if (!room.pickups[i].dead) room.pickups[i].update();
  for (const pd of room.pedestals) pd.update();
  for (const o of room.objects) if (o.update) o.update();
  if (G.state !== 'play' && G.state !== 'floorOut') return;
  for (const fx of G.effects) fx.t++;
  G.effects = G.effects.filter(fx => fx.t < fx.life);
  updateParticles();

  G.enemies = G.enemies.filter(e => !e.dead);
  G.tears = G.tears.filter(t => !t.dead);
  G.beams = G.beams.filter(b => !b.dead);
  G.bombs = G.bombs.filter(b => !b.dead);
  room.pickups = room.pickups.filter(pk => !pk.dead);

  if (!room.cleared && !G.enemies.some(e => !e.noClear)) roomCleared();

  if (G.shake > 0) { G.shake *= 0.86; if (G.shake < 0.3) G.shake = 0; }
  if (G.banner && --G.banner.t <= 0) G.banner = null;
  if (G.slowT > 0) G.slowT--;
  if (G.hurtFlash > 0) G.hurtFlash--;
  if (G.flash > 0) G.flash--;
  if (G.diarrhea > 0 && ++G.diarrheaT % 30 === 0) { G.bombs.push(new Bomb(p.x, p.y + 4)); G.diarrhea--; }
  if (p.dead && --G.deathT <= 0) toEnd('dead');
  if (G.winT > 0 && --G.winT <= 0) toEnd('win');
}

function separateEnemies() {
  const es = G.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.dead || a.boss || a.manual || a.hidden) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead || b.boss || b.manual || b.hidden || a.flying !== b.flying) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r - 2;
      if (d < m && d > 0.01) {
        const k = (m - d) / d * 0.25;
        a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k;
      }
    }
  }
}

function contactDamage() {
  const p = G.player;
  if (p.dead || p.invuln > 0) return;
  for (const e of G.enemies) {
    if (e.dead || e.spawn > 0 || e.hidden || e.invuln || e.z > 10 || e.alpha < 0.4) continue;
    if (e.d.contact === false) continue;
    for (const hc of e.hitCircles()) {
      if (Math.hypot(hc.x - p.x, hc.y - p.y) < hc.r + p.r - 3) { p.hurt(e.dmg, e.name); return; }
    }
  }
}

function toEnd(kind) {
  G.state = kind;
  G.endT = 0;
  G.banner = null;
  if (kind === 'win') {
    store('sp_wins', String((+store('sp_wins') || 0) + 1));
    Sound.music('win');
  } else Sound.music(null);
  const best = +store('sp_best') || 0;
  if (G.stage > best) store('sp_best', String(G.stage));
}

function updateEnd() {
  G.endT++;
  if (G.endT < 40) return;
  if (handleClicks()) return;
  if (Input.pressed('confirm') || Input.pressed('restart')) newRun(G.charIdx);
  else if (Input.pressed('back')) toMenu();
}

function toMenu() {
  G.state = 'menu';
  G.player = null;
  G.floor = null;
  G.room = null;
  Sound.music('menu');
}

function updateMenu() {
  if (handleClicks()) return;
  const n = CHARACTERS.length;
  if (G.menuFocus === 1) {
    // фокус на кнопках «Начать» / «Настройки»
    if (Input.pressed('left') || Input.pressed('right')) { G.menuBtn = 1 - (G.menuBtn || 0); Sound.play('menu'); }
    if (Input.pressed('up')) { G.menuFocus = 0; Sound.play('menu'); }
    if (Input.pressed('confirm')) {
      Sound.play('select');
      if (G.menuBtn === 1) openSettings('menu'); else newRun(G.menuSel);
    }
  } else {
    if (Input.pressed('left')) { G.menuSel = (G.menuSel + n - 1) % n; Sound.play('menu'); }
    if (Input.pressed('right')) { G.menuSel = (G.menuSel + 1) % n; Sound.play('menu'); }
    if (Input.pressed('down')) { G.menuFocus = 1; G.menuBtn = 0; Sound.play('menu'); }
    if (Input.pressed('confirm')) { Sound.play('select'); newRun(G.menuSel); }
  }
  if (Input.pressed('back')) { openSettings('menu'); return; }
  if (G.t % 60 === 0) Sound.music('menu');
}

// ---------- экран настроек ----------
function openSettings(from) {
  G.settingsFrom = from;
  G.state = 'settings';
  G.setSel = 0;
}
function closeSettings() {
  G.state = G.settingsFrom === 'pause' ? 'pause' : 'menu';
}
function updateSettings() {
  if (handleClicks()) return;
  const rows = SETTINGS_DEF.length + 1;
  if (Input.pressed('back') || Input.pressed('pause')) { Sound.play('menu'); closeSettings(); return; }
  if (Input.pressed('up')) { G.setSel = (G.setSel + rows - 1) % rows; Sound.play('menu'); }
  if (Input.pressed('down')) { G.setSel = (G.setSel + 1) % rows; Sound.play('menu'); }
  const d = SETTINGS_DEF[G.setSel];
  if (d) {
    if (Input.pressed('left')) { Settings.cycle(d.key, -1); Sound.play('menu'); }
    if (Input.pressed('right') || Input.pressed('confirm')) { Settings.cycle(d.key, 1); Sound.play('menu'); }
  } else if (Input.pressed('confirm')) { Sound.play('select'); closeSettings(); }
}

const PAUSE_OPTS = [
  ['Продолжить', () => { G.state = 'play'; }],
  ['Начать заново', () => newRun(G.charIdx)],
  ['Настройки', () => openSettings('pause')],
  ['Главное меню', () => toMenu()],
];
function updatePause() {
  if (handleClicks()) return;
  if (Input.pressed('pause') || Input.pressed('back')) { G.state = 'play'; return; }
  if (Input.pressed('up')) { G.pauseSel = (G.pauseSel + PAUSE_OPTS.length - 1) % PAUSE_OPTS.length; Sound.play('menu'); }
  if (Input.pressed('down')) { G.pauseSel = (G.pauseSel + 1) % PAUSE_OPTS.length; Sound.play('menu'); }
  if (Input.pressed('restart')) { newRun(G.charIdx); return; }
  if (Input.pressed('confirm')) { Sound.play('select'); PAUSE_OPTS[G.pauseSel][1](); }
}

// ---------- отрисовка ----------
function render() {
  const c = ctx;
  c.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  G.ui = [];
  switch (G.state) {
    case 'menu': renderMenu(c); renderRotateHint(c); return;
    case 'settings':
      if (G.settingsFrom === 'pause' && G.room) { renderWorld(c, true); drawHUD(c); }
      else renderMenu(c, true);
      G.ui = [];
      renderSettings(c);
      renderRotateHint(c);
      return;
    case 'trans': renderTrans(c); drawHUD(c); return;
    case 'win': renderWorld(c, true); renderWin(c); return;
  }
  renderWorld(c);
  drawHUD(c);
  if (G.state === 'play' && Input.held('map')) drawBigMap(c);
  if (G.state === 'pause') renderPause(c);
  if (G.state === 'vs') renderVS(c);
  if (G.state === 'floorIntro') renderIntro(c);
  if (G.state === 'floorOut') { c.fillStyle = 'rgba(0,0,0,' + Math.min(1, G.fadeT / 36) + ')'; c.fillRect(0, 0, W, H); }
  if (G.state === 'dead') renderDeath(c);
  renderRotateHint(c);
}

function renderRotateHint(c) {
  if (!Input.touchMode || window.innerHeight <= window.innerWidth) return;
  c.fillStyle = 'rgba(0,0,0,0.88)';
  c.fillRect(0, 0, W, H);
  text(c, 'Поверните устройство горизонтально', W / 2, H / 2, 40, '#f2e6cf', 'center');
}

function renderTrans(c) {
  const tr = G.trans;
  const k = tr.t / tr.dur;
  const e = k * k * (3 - 2 * k);
  const [dx, dy] = DIRS[tr.dir];
  const sw = RW + 2 * WALL, sh = RH + 2 * WALL;
  c.save();
  c.beginPath(); c.rect(RX - WALL, RY - WALL, sw, sh); c.clip();
  c.drawImage(tr.A.cv, -dx * e * sw, -dy * e * sh, W, H);
  c.drawImage(tr.B.cv, dx * (1 - e) * sw, dy * (1 - e) * sh, W, H);
  c.restore();
}

function renderIntro(c) {
  const a = G.introT < 45 ? 1 : Math.max(0, 1 - (G.introT - 45) / 40);
  c.fillStyle = 'rgba(0,0,0,' + a + ')';
  c.fillRect(0, 0, W, H);
  const ta = G.introT < 65 ? Math.min(1, G.introT / 12) : Math.max(0, 1 - (G.introT - 65) / 30);
  c.save();
  c.globalAlpha = ta;
  text(c, STAGES[G.stage].name, W / 2, H / 2 - 10, 54, '#f2e6cf', 'center', '#000', 5);
  if (G.floor.curse) text(c, G.floor.curse === 'darkness' ? 'Проклятие тьмы' : 'Проклятие потерянного', W / 2, H / 2 + 40, 24, '#d04848', 'center');
  c.restore();
}

function renderVS(c) {
  const k = Math.min(1, G.vsT / 12);
  const out = G.vsT > 135 ? (150 - G.vsT) / 15 : 1;
  c.save();
  c.globalAlpha = Math.min(k, out);
  c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, H / 2); c.rotate(-0.12);
  c.fillStyle = '#5a0c0c'; c.fillRect(-W, -90, W * 2, 180);
  c.fillStyle = '#8a1414'; c.fillRect(-W, -90, W * 2, 10); c.fillRect(-W, 80, W * 2, 10);
  c.restore();
  const p = G.player;
  const slide = (1 - k) * 300;
  drawHero(c, 230 - slide, H / 2 + 70, { dir: 'down', skin: p.ch.skin, look: p.ch.look, scale: 3.4, wings: p.flight, halo: p.flags.halo, horns: p.flags.brimstone, hat: p.flags.wiz });
  text(c, p.ch.name.toUpperCase(), 230 - slide, H / 2 + 115, 38, '#f2e6cf', 'center', '#000', 5);
  const boss = G.enemies.find(e => e.boss);
  c.save();
  c.translate(W - 250 + slide, H / 2 + 20);
  if (boss) {
    if (boss.type === 'mom') {
      ellipse(c, 0, -10, 90, 50, '#f2eae0', OUT, 4);
      circle(c, 0, -10, 34, '#6a3a1a'); circle(c, 0, -10, 16, '#111'); circle(c, -10, -20, 6, '#fff');
    } else {
      const s = boss.type === 'heart' ? 1.3 : boss.type === 'duke' || boss.type === 'monstro' ? 2 : boss.type === 'blob' ? 1.6 : 2.6;
      c.scale(s, s);
      const z = boss.z; boss.z = 0;
      FLASH = false; TINT = null;
      boss.d.draw(c, boss, 0, 20);
      if (boss.type === 'geminiBig' && boss.partner) { c.translate(40, -20); boss.partner.d.draw(c, boss.partner, 0, 0); }
      boss.z = z;
    }
  }
  c.restore();
  text(c, 'VS', W / 2, H / 2, 64, '#ffd84a', 'center', '#000', 6);
  text(c, (G.bossName || '').toUpperCase(), W - 250 + slide, H / 2 + 115, 38, '#f2e6cf', 'center', '#000', 5);
  c.restore();
}

function renderPause(c) {
  c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(0, 0, W, H);
  rrect(c, W / 2 - 300, 40, 600, 460, 14, '#e8dcc0', '#3a2a1a', 4);
  text(c, 'ПАУЗА', W / 2, 78, 40, '#2a1a10', 'center', null);
  const p = G.player;
  text(c, p.ch.name + ' — ' + STAGES[G.stage].name, W / 2, 112, 20, '#5a4030', 'center', null);
  // предметы
  const items = p.items.slice();
  if (p.active) items.unshift(p.active.id);
  const cols = 12, sz = 40;
  const x0 = W / 2 - Math.min(items.length, cols) * sz / 2 + sz / 2;
  items.forEach((id, i) => {
    const x = x0 + (i % cols) * sz, y = 150 + Math.floor(i / cols) * sz;
    drawItemIcon(c, id, x, y, 0.95);
  });
  if (!items.length) text(c, 'Предметов пока нет', W / 2, 150, 18, '#8a7a60', 'center', null);
  const y0 = 150 + Math.ceil(Math.max(1, items.length) / cols) * sz + 10;
  const s = G.stats;
  text(c, 'Убито: ' + s.kills + '   Время: ' + fmtTime(s.time) + '   Сид: ' + seedStr(), W / 2, y0, 17, '#5a4030', 'center', null);
  PAUSE_OPTS.forEach(([label, cb], i) => {
    uiButton(c, W / 2 - 130, y0 + 26 + i * 52, 260, 42, label, cb, { selected: G.pauseSel === i });
  });
}

function renderDeath(c) {
  const k = Math.min(1, G.endT / 30);
  c.fillStyle = 'rgba(0,0,0,' + 0.7 * k + ')'; c.fillRect(0, 0, W, H);
  if (G.endT < 10) return;
  c.save();
  c.globalAlpha = k;
  c.translate(W / 2, H / 2);
  c.rotate(-0.03);
  rrect(c, -230, -215, 460, 410, 6, '#efe4c8', '#3a2a1a', 4);
  for (let i = 0; i < 9; i++) line(c, -200, -120 + i * 34, 200, -120 + i * 34, 'rgba(120,100,70,0.25)', 1);
  text(c, 'Здесь покоится', 0, -160, 26, '#3a2a1a', 'center', null);
  text(c, G.player.ch.name, 0, -122, 40, '#2a1a10', 'center', null);
  drawHero(c, -120, -20, { dir: 'down', skin: G.player.ch.skin, look: G.player.ch.look, scale: 2, alpha: 0.85 });
  line(c, -150, -70, -90, 0, '#8a1010', 4); line(c, -90, -70, -150, 0, '#8a1010', 4);
  text(c, 'Убит:', 70, -60, 22, '#5a4030', 'center', null);
  text(c, G.deathCause, 70, -30, 26, '#8a1010', 'center', null);
  text(c, STAGES[G.stage].name, 70, 10, 22, '#5a4030', 'center', null);
  const items = G.player.items.slice(0, 10);
  items.forEach((id, i) => drawItemIcon(c, id, -180 + i * 40, 70, 0.85));
  text(c, 'Убито врагов: ' + G.stats.kills + '   Время: ' + fmtTime(G.stats.time), 0, 120, 18, '#5a4030', 'center', null);
  c.restore();
  if (G.endT > 40) {
    uiButton(c, W / 2 - 220, H / 2 + 212, 210, 40, 'Ещё раз (Enter)', () => newRun(G.charIdx));
    uiButton(c, W / 2 + 10, H / 2 + 212, 210, 40, 'Меню (Esc)', () => toMenu());
  }
}

function renderWin(c) {
  const k = Math.min(1, G.endT / 40);
  c.fillStyle = 'rgba(255,250,235,' + 0.9 * k + ')'; c.fillRect(0, 0, W, H);
  c.save();
  c.globalAlpha = k;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + G.t * 0.004;
    c.beginPath(); c.moveTo(W / 2, 170); c.lineTo(W / 2 + Math.cos(a) * 700, 170 + Math.sin(a) * 700); c.lineTo(W / 2 + Math.cos(a + 0.2) * 700, 170 + Math.sin(a + 0.2) * 700); c.closePath();
    c.fillStyle = 'rgba(255,220,120,0.12)'; c.fill();
  }
  const p = G.player;
  drawHero(c, W / 2, 210, { dir: 'down', skin: p.ch.skin, look: p.ch.look, scale: 3, halo: true, wings: true, t: G.t });
  text(c, 'ПОБЕДА!', W / 2, 270, 60, '#c48a10', 'center', '#3a2a1a', 6);
  text(c, p.ch.name + ' победил(а) Сердце Мамы', W / 2, 318, 24, '#3a2a1a', 'center', null);
  text(c, 'Время: ' + fmtTime(G.stats.time) + '    Убито: ' + G.stats.kills + '    Предметов: ' + G.stats.items, W / 2, 352, 20, '#5a4030', 'center', null);
  const items = p.items.slice(0, 14);
  items.forEach((id, i) => drawItemIcon(c, id, W / 2 - (items.length - 1) * 20 + i * 40, 392, 0.85));
  c.restore();
  if (G.endT > 40) {
    uiButton(c, W / 2 - 220, 440, 210, 42, 'Ещё раз (Enter)', () => newRun(G.charIdx));
    uiButton(c, W / 2 + 10, 440, 210, 42, 'Меню (Esc)', () => toMenu());
  }
}

function charStats(i) {
  if (!G.charStats) G.charStats = [];
  if (!G.charStats[i]) G.charStats[i] = statSnapshot(new Player(CHARACTERS[i]));
  return G.charStats[i];
}

function renderMenu(c, bgOnly) {
  // фон — тёмный подвал
  const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#0a0605');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = hrand(i, 1) * W, y = hrand(i, 2) * H;
    circle(c, x, y, 20 + hrand(i, 3) * 60, 'rgba(0,0,0,0.12)');
  }
  // заголовок
  const bob = Math.sin(G.t * 0.03) * 3;
  text(c, 'СЛЁЗЫ ПОДВАЛА', W / 2, 58 + bob, 62, '#e8dcc0', 'center', '#000', 7);
  text(c, '~ покаяние ~', W / 2, 102 + bob, 25, '#c44040', 'center', '#000', 4);
  if (bgOnly) return;

  // карусель персонажей: выбранный в центре, по два соседа с каждой стороны
  const n = CHARACTERS.length;
  const sel = G.menuSel;
  const order = [-2, 2, -1, 1, 0];
  const y = 262;
  for (const k of order) {
    const i = (sel + k + n * 2) % n;
    const ch = CHARACTERS[i];
    const x = W / 2 + k * 128;
    const big = k === 0;
    const sc = big ? 2.7 : Math.abs(k) === 1 ? 1.55 : 1.15;
    if (big) {
      const gl = c.createRadialGradient(x, y - 45, 10, x, y - 45, 110);
      gl.addColorStop(0, 'rgba(255,230,180,0.25)'); gl.addColorStop(1, 'rgba(255,230,180,0)');
      c.fillStyle = gl; c.fillRect(x - 110, y - 160, 220, 220);
    }
    shadow(c, x, y + 2, 12 * sc, 3.6 * sc, 0.5);
    drawHero(c, x, y, {
      dir: 'down', skin: ch.skin, look: ch.look, scale: sc, alpha: big ? (ch.lost ? 0.85 : 1) : Math.abs(k) === 1 ? 0.5 : 0.25,
      moving: false, shoot: big && G.t % 90 < 20 ? 1 : 0, wings: ch.flight, t: G.t,
    });
    G.ui.push({ x: x - 50, y: y - 110, w: 100, h: 125, cb: () => { if (k === 0) { Sound.play('select'); newRun(i); } else { G.menuSel = i; G.menuFocus = 0; } } });
  }
  const ch = CHARACTERS[sel];
  text(c, ch.name, W / 2, 300, 36, G.menuFocus === 1 ? '#c8b89a' : '#f2e6cf', 'center', '#000', 5);
  text(c, ch.desc, W / 2, 332, 18, '#c8b89a', 'center', '#000', 3);
  // стартовые сердца, предмет и характеристики
  const hearts = [];
  for (let i = 0; i < ch.hearts; i++) hearts.push('red');
  for (let i = 0; i < (ch.soul || 0); i++) hearts.push('soul');
  const rowW = hearts.length * 20 + (ch.active ? 44 : 0) + (ch.extraLives ? 40 : 0) + (ch.lost ? 120 : 0);
  let hx = W / 2 - rowW / 2 + 10;
  for (const k of hearts) { drawHeart(c, hx, 364, 18, k); hx += 20; }
  if (ch.lost) { text(c, 'нет сердец', hx + 50, 364, 16, '#c8b89a', 'center'); hx += 120; }
  if (ch.extraLives) { text(c, '+1 жизнь', hx + 16, 364, 14, '#ffd84a', 'center'); hx += 40; }
  if (ch.active) drawItemIcon(c, ch.active, hx + 18, 362, 0.8);
  const st = charStats(sel);
  const rows = [['speed', st.speed], ['tears', st.tears], ['damage', st.damage], ['range', st.range], ['shotspeed', st.shotspeed], ['luck', st.luck]];
  rows.forEach(([k, v], j) => {
    const x = W / 2 - 225 + j * 90;
    drawStatIcon(c, k, x, 398);
    text(c, (Math.round(v * 100) / 100).toFixed(k === 'luck' ? 0 : 2), x + 14, 399, 16, '#e8e0d0');
  });
  // стрелки и кнопки
  uiButton(c, W / 2 - 400, 196, 44, 44, '‹', () => { G.menuSel = (G.menuSel + n - 1) % n; G.menuFocus = 0; }, { size: 30 });
  uiButton(c, W / 2 + 356, 196, 44, 44, '›', () => { G.menuSel = (G.menuSel + 1) % n; G.menuFocus = 0; }, { size: 30 });
  const fb = G.menuFocus === 1 ? (G.menuBtn || 0) : -1;
  uiButton(c, W / 2 - 230, 426, 220, 44, 'Начать', () => { Sound.play('select'); newRun(G.menuSel); }, { selected: fb !== 1, size: 24 });
  uiButton(c, W / 2 + 10, 426, 220, 44, 'Настройки', () => { Sound.play('select'); openSettings('menu'); }, { selected: fb === 1, size: 22 });

  const help = Input.touchMode
    ? 'Левый палец — ходить • Правый палец — стрелять • Кнопки справа — предмет, бомба, пилюля'
    : 'WASD — ходить • Стрелки — стрелять • E — бомба • Пробел — предмет • Q — пилюля • Tab — карта • F — полный экран • M — звук';
  text(c, help, W / 2, 496, 15, '#9a8a70', 'center', '#000', 3);
  const wins = +store('sp_wins') || 0, runs = +store('sp_runs') || 0, best = +store('sp_best') || 0;
  if (runs) text(c, 'Забегов: ' + runs + '   Побед: ' + wins + (best ? '   Глубже всего: ' + STAGES[best].name : ''), W / 2, 520, 13, '#6a5a48', 'center', null);
}

function renderSettings(c) {
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
  const px = W / 2 - 340, py = 24, pw = 680, ph = 492;
  rrect(c, px, py, pw, ph, 14, '#e8dcc0', '#3a2a1a', 4);
  text(c, 'НАСТРОЙКИ', W / 2, py + 34, 36, '#2a1a10', 'center', null);
  const rowH = 43, y0 = py + 66;
  SETTINGS_DEF.forEach((d, i) => {
    const y = y0 + i * rowH;
    const selRow = G.setSel === i;
    if (selRow) rrect(c, px + 16, y, pw - 32, rowH - 5, 8, 'rgba(120,60,40,0.18)', '#a8885a', 2);
    text(c, d.label, px + 34, y + rowH / 2 - 2, 21, '#2a1a10', 'left', null);
    const vx = px + pw - 170;
    // стрелки
    const bl = { x: vx - 112, y: y + 4, w: 30, h: rowH - 13 }, br = { x: vx + 82, y: y + 4, w: 30, h: rowH - 13 };
    rrect(c, bl.x, bl.y, bl.w, bl.h, 6, 'rgba(40,24,18,0.85)', '#a8885a', 1.5);
    rrect(c, br.x, br.y, br.w, br.h, 6, 'rgba(40,24,18,0.85)', '#a8885a', 1.5);
    text(c, '‹', bl.x + bl.w / 2, bl.y + bl.h / 2, 22, '#f2e6cf', 'center', null);
    text(c, '›', br.x + br.w / 2, br.y + br.h / 2, 22, '#f2e6cf', 'center', null);
    G.ui.push({ x: bl.x, y: bl.y, w: bl.w, h: bl.h, cb: () => { G.setSel = i; Settings.cycle(d.key, -1); } });
    G.ui.push({ x: br.x, y: br.y, w: br.w, h: br.h, cb: () => { G.setSel = i; Settings.cycle(d.key, 1); } });
    G.ui.push({ x: px + 16, y, w: bl.x - px - 20, h: rowH - 5, cb: () => { G.setSel = i; Settings.cycle(d.key, 1); } });
    text(c, Settings.label(d.key), vx - 15, y + rowH / 2 - 2, 20, '#5a1e10', 'center', null);
    // образец снаряда рядом с настройками заметности
    if (d.key === 'projVis' || d.key === 'shotColor') drawShotSample(c, vx + 54, y + rowH / 2 - 2);
  });
  const by = y0 + SETTINGS_DEF.length * rowH + 4;
  uiButton(c, W / 2 - 110, by, 220, 40, 'Назад', () => closeSettings(), { selected: G.setSel === SETTINGS_DEF.length });
  const d = SETTINGS_DEF[G.setSel];
  text(c, d && d.hint ? d.hint : (Input.touchMode ? 'Нажмите на стрелки, чтобы изменить' : '↑↓ — выбрать   ←→ — изменить   Esc — назад'), W / 2, py + ph - 14, 15, '#6a5a48', 'center', null);
}

// маленький образец вражеского снаряда для экрана настроек
function drawShotSample(c, x, y) {
  if (typeof drawEnemyShot === 'function') { drawEnemyShot(c, x, y, 6, G.t); return; }
  const sc = shotColor();
  circle(c, x, y, 6, sc.fill, sc.dark, 1.5);
}

function fmtTime(frames) {
  const s = Math.floor(frames / 60);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function seedStr() {
  const s = (G.seed >>> 0).toString(36).toUpperCase().padStart(7, '0');
  return s.slice(0, 4) + ' ' + s.slice(4);
}

// ---------- экран ----------
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
  canvas.width = Math.max(1, Math.round(W * scale * dpr));
  canvas.height = Math.max(1, Math.round(H * scale * dpr));
  PIXEL_SCALE = canvas.width / W;
  G.bgCache = null;
  G.snaps = [];
  buildVignette();
}

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  } catch (e) { /* не поддерживается */ }
}

function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  Input.init(canvas);
  try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) Input.touchMode = true; } catch (e) { /* нет matchMedia */ }
  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') G.state = 'pause';
    Input.reset();
  });
  if (document.fonts && document.fonts.load) {
    document.fonts.load('20px Neucha').then(() => { G.bgCache = null; }).catch(() => {});
  }
  Sound.music('menu');
  let last = performance.now(), acc = 0;
  const frame = now => {
    requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) { update(); acc -= STEP; n++; }
    if (n >= 5) acc = 0;
    render();
    Sound.updateMusic();
  };
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
