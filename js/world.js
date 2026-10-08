'use strict';
// ============================================================
//  Мир: комнаты, генерация этажа, столкновения, поиск пути
// ============================================================

let ROOM_ID = 0;
class Room {
  constructor(gx, gy, type) {
    this.id = ++ROOM_ID;
    this.gx = gx; this.gy = gy; this.type = type;
    this.doors = {};
    this.visited = false; this.seen = false; this.cleared = false; this.inited = false;
    this.grid = makeGrid();
    this.spawns = [];
    this.pickups = []; this.pedestals = []; this.objects = [];
    this.decals = [];
    this.flow = new Int16Array(COLS * ROWS);
    this.seed = Math.floor(Math.random() * 1e9);
    this.dist = 0;
  }
  tile(c, r) { return inGrid(c, r) ? this.grid[r * COLS + c] : null; }
}

function makeGrid() {
  const g = [];
  for (let i = 0; i < COLS * ROWS; i++) g.push({ t: '.', hp: 0 });
  return g;
}

function otherRoom(door, room) { return door.a === room ? door.b : door.a; }

const DOOR_PRIORITY = ['boss', 'devil', 'angel', 'secret', 'treasure', 'shop'];
function makeDoor(a, b, stage) {
  let kind = 'normal';
  for (const k of DOOR_PRIORITY) if (a.type === k || b.type === k) { kind = k; break; }
  return {
    a, b, kind,
    locked: (kind === 'treasure' || kind === 'shop') && stage >= 2,
    hidden: kind === 'secret',
  };
}

// ---------- проходимость клеток ----------
function solidWalk(tile) {
  if (!tile) return true;
  switch (tile.t) {
    case 'r': case 't': case 'm': case 'p': case 'x': case 'S': return true;
    case 'f': return tile.hp > 0;
    default: return false;
  }
}
function solidTear(tile) {
  if (!tile) return true;
  switch (tile.t) {
    case 'r': case 't': case 'm': case 'p': case 'S': return true;
    case 'f': return tile.hp > 0;
    default: return false;
  }
}

// ---------- генерация этажа ----------
function generateFloor(stage, seed) {
  const rng = new RNG((seed ^ Math.imul(stage + 1, 0x9E3779B1)) >>> 0);
  for (let attempt = 0; attempt < 600; attempt++) {
    const f = tryGenerate(stage, rng);
    if (f) return f;
  }
  throw new Error('Не удалось сгенерировать этаж');
}

function tryGenerate(stage, rng) {
  const N = 13, S0 = 6;
  const target = Math.min(18, rng.int(0, 1) + 5 + Math.floor(stage * 2.2));
  const K = (x, y) => x + y * N;
  const cells = new Map();
  const nb = (x, y) => {
    let n = 0;
    for (const d of DIR_NAMES) if (cells.has(K(x + DIRS[d][0], y + DIRS[d][1]))) n++;
    return n;
  };
  const start = { x: S0, y: S0, dist: 0 };
  cells.set(K(S0, S0), start);
  const order = [start];
  const q = [start];
  let guard = 0;
  while (cells.size < target && guard++ < 400) {
    if (!q.length) q.push(rng.pick(order));
    const cur = q.shift();
    for (const d of rng.shuffle(DIR_NAMES.slice())) {
      if (cells.size >= target) break;
      const nx = cur.x + DIRS[d][0], ny = cur.y + DIRS[d][1];
      if (nx < 1 || ny < 1 || nx >= N - 1 || ny >= N - 1) continue;
      if (cells.has(K(nx, ny))) continue;
      if (nb(nx, ny) > 1) continue;
      if (rng.chance(0.5)) continue;
      const n = { x: nx, y: ny, dist: cur.dist + 1 };
      cells.set(K(nx, ny), n);
      q.push(n); order.push(n);
    }
  }
  if (cells.size < target) return null;
  const list = [...cells.values()];
  const ends = list.filter(c => c !== start && nb(c.x, c.y) === 1);
  if (ends.length < 3) return null;
  ends.sort((a, b) => b.dist - a.dist);
  const bossCell = ends[0];
  if (bossCell.dist < 3) return null;
  const rest = rng.shuffle(ends.slice(1));
  const treasureCell = rest[0], shopCell = rest[1];

  // тайная комната — пустая клетка рядом с несколькими комнатами
  let best = null, bestScore = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if (cells.has(K(x, y))) continue;
    let n = 0, bad = false;
    for (const d of DIR_NAMES) {
      const c = cells.get(K(x + DIRS[d][0], y + DIRS[d][1]));
      if (c) { n++; if (c === bossCell) bad = true; }
    }
    if (bad || n < 2) continue;
    const score = n + rng.next();
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }

  const rooms = new Map();
  const floor = { stage, rooms, start: null, boss: null, secret: null, treasure: null, shop: null, devil: null, curse: null };
  for (const c of list) {
    let type = 'normal';
    if (c === start) type = 'start';
    else if (c === bossCell) type = 'boss';
    else if (c === treasureCell) type = 'treasure';
    else if (c === shopCell) type = 'shop';
    const r = new Room(c.x, c.y, type);
    r.dist = c.dist;
    rooms.set(K(c.x, c.y), r);
    if (type !== 'normal') floor[type] = r;
  }
  if (best) {
    const r = new Room(best.x, best.y, 'secret');
    rooms.set(K(best.x, best.y), r);
    floor.secret = r;
  }
  for (const r of rooms.values()) {
    for (const d of DIR_NAMES) {
      if (r.doors[d]) continue;
      const o = rooms.get(K(r.gx + DIRS[d][0], r.gy + DIRS[d][1]));
      if (!o) continue;
      if ((r.type === 'secret' && o.type === 'boss') || (o.type === 'secret' && r.type === 'boss')) continue;
      const door = makeDoor(r, o, stage);
      r.doors[d] = door;
      o.doors[OPP[d]] = door;
    }
  }
  // босс
  let pool = BOSS_POOLS[stage].filter(b => !G.bossesSeen.has(b));
  if (!pool.length) pool = BOSS_POOLS[stage];
  floor.bossType = rng.pick(pool);

  for (const r of rooms.values()) {
    if (r.type === 'normal') buildNormalRoom(r, stage, rng);
    else if (r.type === 'boss') buildBossRoom(r, floor.bossType, rng);
  }
  return floor;
}

function doorsConnected(grid, room) {
  const doorTiles = [];
  for (const d of DIR_NAMES) if (room.doors[d]) doorTiles.push(DOOR_TILE[d]);
  if (!doorTiles.length) return true;
  const blocked = t => t.t === 'r' || t.t === 't' || t.t === 'm' || t.t === 'x';
  for (const [c, r] of doorTiles) if (blocked(grid[r * COLS + c])) return false;
  const seen = new Uint8Array(COLS * ROWS);
  const q = [doorTiles[0]];
  seen[doorTiles[0][1] * COLS + doorTiles[0][0]] = 1;
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of DIR_NAMES) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (!inGrid(nc, nr)) continue;
      const i = nr * COLS + nc;
      if (seen[i] || blocked(grid[i])) continue;
      seen[i] = 1;
      q.push([nc, nr]);
    }
  }
  return doorTiles.every(([c, r]) => seen[r * COLS + c]);
}

function buildNormalRoom(room, stage, rng) {
  const ch = STAGES[stage].ch;
  for (let tries = 0; tries < 40; tries++) {
    const L = tries < 39 ? rng.pick(LAYOUTS) : LAYOUTS[0];
    const fx = rng.chance(0.5), fy = rng.chance(0.5);
    const grid = makeGrid();
    const marks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = L[fy ? ROWS - 1 - r : r][fx ? COLS - 1 - c : c];
      const tile = grid[r * COLS + c];
      if (k === 'E') marks.push([c, r]);
      else if (k !== '.') { tile.t = k; tile.hp = (k === 'p' || k === 'f') ? 4 : 0; }
    }
    if (!doorsConnected(grid, room)) continue;
    const rocks = [];
    grid.forEach((t, i) => { if (t.t === 'r') rocks.push(i); });
    if (rocks.length && rng.chance(0.3)) grid[rng.pick(rocks)].t = 't';
    room.grid = grid;

    const pool = ENEMY_POOLS[ch];
    const t1 = rng.pick(pool);
    const t2 = rng.chance(0.55) ? rng.pick(pool) : t1;
    rng.shuffle(marks);
    const frac = stage <= 1 ? 0.6 : stage <= 3 ? 0.8 : 1;
    const n = clamp(Math.round(marks.length * frac), Math.min(2, marks.length), marks.length);
    room.spawns = marks.slice(0, n).map(([c, r], i) => ({
      type: i % 2 ? t2 : t1, c, r,
      champion: stage >= 2 && rng.chance(0.03 + stage * 0.012),
    }));
    if (rng.chance(0.07)) room.extra = rng.chance(0.3) ? 'goldchest' : 'chest';
    return;
  }
}

function buildBossRoom(room, bossType, rng) {
  if (bossType !== 'worm' && bossType !== 'mom' && bossType !== 'heart' && rng.chance(0.45)) {
    for (const [c, r] of [[2, 1], [10, 1], [2, 5], [10, 5]]) room.grid[r * COLS + c].t = 'r';
  }
  room.spawns = [{ type: bossType, c: 6, r: 3, boss: true }];
}

// ---------- первое посещение комнаты: предметы, магазин и т.п. ----------
function initRoom(room) {
  if (room.inited) return;
  room.inited = true;
  const [cx, cy] = tileCenter(6, 3);
  switch (room.type) {
    case 'start':
      room.cleared = true;
      break;
    case 'treasure':
      room.cleared = true;
      room.pedestals.push(new Pedestal(cx, cy, takeItem('treasure')));
      break;
    case 'shop': {
      room.cleared = true;
      room.objects.push(makeShopkeeper(cx, RY + T * 0.9));
      const slots = [-3, -1, 1, 3];
      const itemSlot = randi(0, 3);
      const goods = shuffle([['heart', 3], ['bomb', 5], ['key', 5], ['pill', 4], ['soulheart', 5], ['card', 5], ['doublebomb', 7]]);
      slots.forEach((s, i) => {
        const x = cx + s * T * 1.15, y = cy + 6;
        if (i === itemSlot) {
          const p = new Pedestal(x, y, takeItem('shop'));
          p.price = 15;
          room.pedestals.push(p);
        } else {
          const [kind, price] = goods.pop();
          const pk = makePickup(kind, x, y);
          pk.price = price; pk.shop = true; pk.vx = pk.vy = 0; pk.z = 0; pk.vz = 0;
          room.pickups.push(pk);
        }
      });
      break;
    }
    case 'secret': {
      room.cleared = true;
      if (chance(0.35)) room.pedestals.push(new Pedestal(cx, cy, takeItem(chance(0.5) ? 'secret' : 'treasure')));
      else {
        for (let i = 0; i < randi(3, 6); i++) room.pickups.push(makePickup('coin', cx + rand(-60, 60), cy + rand(-40, 40)));
        room.pickups.push(makePickup(pick(['bomb', 'key', 'soulheart', 'pill']), cx + rand(-40, 40), cy + rand(-30, 30)));
        if (chance(0.4)) room.pickups.push(makePickup('goldchest', cx, cy - 40));
      }
      break;
    }
    case 'devil': {
      room.cleared = true;
      room.grid[1 * COLS + 6].t = 'S';
      room.grid[1 * COLS + 6].sub = 'devil';
      for (const [c, r] of [[1, 1], [11, 1], [1, 5], [11, 5]]) { room.grid[r * COLS + c].t = 'f'; room.grid[r * COLS + c].hp = 99; room.grid[r * COLS + c].eternal = true; }
      const offs = chance(0.5) ? [-2, 2] : [-3, 0, 3];
      for (const o of offs) {
        const p = new Pedestal(cx + o * T, cy + 10, takeItem('devil'));
        p.devil = chance(0.35) ? 2 : 1;
        room.pedestals.push(p);
      }
      break;
    }
    case 'angel': {
      room.cleared = true;
      room.grid[1 * COLS + 6].t = 'S';
      room.grid[1 * COLS + 6].sub = 'angel';
      room.pedestals.push(new Pedestal(cx, cy + 10, takeItem('angel')));
      if (chance(0.4)) room.pedestals.push(new Pedestal(cx - 3 * T, cy + 10, takeItem('angel')), new Pedestal(cx + 3 * T, cy + 10, takeItem('angel')));
      break;
    }
    case 'normal':
      if (!room.spawns.length) room.cleared = true;
      if (room.extra) { room.pickups.push(makePickup(room.extra, cx, cy)); }
      break;
  }
}

// ---------- столкновения окружностей с сеткой и стенами ----------
function doorOpen(door) {
  return G.room.cleared && !door.locked && (!door.hidden || G.room.type === 'secret');
}
function doorCenter(dir) {
  switch (dir) {
    case 'up': return [RX + RW / 2, RY];
    case 'down': return [RX + RW / 2, RY + RH];
    case 'left': return [RX, RY + RH / 2];
    case 'right': return [RX + RW, RY + RH / 2];
  }
}

function moveCircle(e, dx, dy, fly, isPlayer) {
  const ox = e.x + dx, oy = e.y + dy;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(4, e.r * 0.6)));
  for (let i = 0; i < steps; i++) {
    e.x += dx / steps;
    e.y += dy / steps;
    if (!fly) collideTiles(e);
    collideWalls(e, isPlayer);
  }
  return { hitX: Math.abs(e.x - ox) > 0.01, hitY: Math.abs(e.y - oy) > 0.01 };
}

function collideTiles(e) {
  const r = e.r;
  const c0 = Math.floor((e.x - r - RX) / T), c1 = Math.floor((e.x + r - RX) / T);
  const r0 = Math.floor((e.y - r - RY) / T), r1 = Math.floor((e.y + r - RY) / T);
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
    if (!inGrid(cc, rr)) continue;
    const tile = G.room.grid[rr * COLS + cc];
    if (!solidWalk(tile)) continue;
    const x0 = RX + cc * T, y0 = RY + rr * T;
    const pad = tile.t === 'x' ? 6 : 2; // в яму можно чуть «залезть» краем
    const bx0 = x0 + pad, by0 = y0 + pad, bx1 = x0 + T - pad, by1 = y0 + T - pad;
    const nx = clamp(e.x, bx0, bx1), ny = clamp(e.y, by0, by1);
    let ddx = e.x - nx, ddy = e.y - ny;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 >= r * r) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      e.x = nx + ddx / d * r;
      e.y = ny + ddy / d * r;
    } else {
      // центр внутри блока — выталкиваем по ближайшей оси
      const l = e.x - bx0, rgt = bx1 - e.x, u = e.y - by0, dn = by1 - e.y;
      const m = Math.min(l, rgt, u, dn);
      if (m === l) e.x = bx0 - r; else if (m === rgt) e.x = bx1 + r; else if (m === u) e.y = by0 - r; else e.y = by1 + r;
    }
  }
}

function collideWalls(e, isPlayer) {
  const r = e.r;
  let minX = RX + r, maxX = RX + RW - r, minY = RY + r, maxY = RY + RH - r;
  if (isPlayer) {
    const lane = T / 2 - r + 2;
    const cxm = RX + RW / 2, cym = RY + RH / 2;
    const room = G.room;
    const du = room.doors.up, dd = room.doors.down, dl = room.doors.left, dr = room.doors.right;
    if (du && doorOpen(du) && Math.abs(e.x - cxm) <= lane) minY = RY - WALL;
    if (dd && doorOpen(dd) && Math.abs(e.x - cxm) <= lane) maxY = RY + RH + WALL;
    if (dl && doorOpen(dl) && Math.abs(e.y - cym) <= lane) minX = RX - WALL;
    if (dr && doorOpen(dr) && Math.abs(e.y - cym) <= lane) maxX = RX + RW + WALL;
    // в проёме двери держим игрока по центру
    if (e.y < RY + r || e.y > RY + RH - r) e.x = clamp(e.x, cxm - lane, cxm + lane);
    if (e.x < RX + r || e.x > RX + RW - r) e.y = clamp(e.y, cym - lane, cym + lane);
  }
  e.x = clamp(e.x, minX, maxX);
  e.y = clamp(e.y, minY, maxY);
}

// ---------- поле расстояний до игрока (для наземных врагов) ----------
function computeFlow() {
  const room = G.room, p = G.player;
  const fl = room.flow;
  fl.fill(-1);
  let [pc, pr] = tileOf(p.x, p.y);
  pc = clamp(pc, 0, COLS - 1); pr = clamp(pr, 0, ROWS - 1);
  const q = new Int16Array(COLS * ROWS);
  let qh = 0, qt = 0;
  const si = pr * COLS + pc;
  fl[si] = 0; q[qt++] = si;
  while (qh < qt) {
    const i = q[qh++];
    const c = i % COLS, r = (i / COLS) | 0;
    for (const d of DIR_NAMES) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (!inGrid(nc, nr)) continue;
      const ni = nr * COLS + nc;
      if (fl[ni] !== -1 || solidWalk(room.grid[ni])) continue;
      fl[ni] = fl[i] + 1;
      q[qt++] = ni;
    }
  }
  G.flowTile = si;
}

// цель для шага к игроку по полю расстояний
function flowTarget(e) {
  const room = G.room, p = G.player, fl = room.flow;
  const [c, r] = tileOf(e.x, e.y);
  if (!inGrid(c, r)) return [p.x, p.y];
  const cur = fl[r * COLS + c];
  if (cur <= 1) return [p.x, p.y];
  let best = cur, bc = -1, br = -1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nc = c + dx, nr = r + dy;
    if (!inGrid(nc, nr)) continue;
    const v = fl[nr * COLS + nc];
    if (v < 0 || v >= best) continue;
    if (dx && dy && (solidWalk(room.tile(c + dx, r)) || solidWalk(room.tile(c, r + dy)))) continue;
    best = v; bc = nc; br = nr;
  }
  if (bc < 0) return [p.x, p.y];
  return tileCenter(bc, br);
}

// прямая видимость (камни блокируют, ямы — нет)
function lineOfSight(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.ceil(d / 10);
  for (let i = 1; i < n; i++) {
    const x = lerp(x1, x2, i / n), y = lerp(y1, y2, i / n);
    const [c, r] = tileOf(x, y);
    const t = G.room.tile(c, r);
    if (t && solidTear(t)) return false;
  }
  return true;
}

function freeTileNear(c0, r0, avoidPlayer) {
  for (let rad = 0; rad < 8; rad++) {
    const cand = [];
    for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) {
      if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== rad) continue;
      const t = G.room.tile(c, r);
      if (!t || t.t !== '.') continue;
      if (avoidPlayer) { const [x, y] = tileCenter(c, r); if (Math.hypot(x - G.player.x, y - G.player.y) < 70) continue; }
      cand.push([c, r]);
    }
    if (cand.length) return pick(cand);
  }
  return [c0, r0];
}

// ---------- повреждение клеток (кучи, костры, камни) ----------
function damageTile(c, r, amount = 1) {
  const t = G.room.tile(c, r);
  if (!t) return;
  const [x, y] = tileCenter(c, r);
  if (t.t === 'p') {
    t.hp -= amount;
    Sound.play('poop');
    for (let i = 0; i < 4; i++) addParticle(x + rand(-10, 10), y, rand(-1.5, 1.5), rand(-2, 0), '#6b4a22', 3, 25);
    if (t.hp <= 0) {
      t.t = '.'; t.hp = 0;
      addDecal({ type: 'poop', x, y: y + 6, r: 16 });
      if (chance(0.12 + G.player.luck * 0.02)) G.room.pickups.push(makePickup(chance(0.8) ? 'coin' : 'heart', x, y));
      computeFlow();
    }
  } else if (t.t === 'f' && t.hp > 0 && !t.eternal) {
    t.hp -= amount;
    Sound.play('fire');
    for (let i = 0; i < 5; i++) addParticle(x + rand(-8, 8), y - 8, rand(-1, 1), rand(-2.5, -0.5), '#999', 3, 30);
    if (t.hp <= 0) {
      t.hp = 0;
      if (chance(0.2 + G.player.luck * 0.02)) G.room.pickups.push(makePickup(randomPickupKind(), x, y));
      computeFlow();
    }
  }
}

function destroyTile(c, r) {
  const t = G.room.tile(c, r);
  if (!t) return false;
  const [x, y] = tileCenter(c, r);
  if (t.t === 'r' || t.t === 't') {
    const tinted = t.t === 't';
    t.t = '.';
    addDecal({ type: 'rubble', x, y, r: 18 });
    const pal = paletteFor(G.room);
    for (let i = 0; i < 8; i++) addParticle(x + rand(-12, 12), y + rand(-12, 12), rand(-2.5, 2.5), rand(-3, 0), pal.rock, rand(2, 5), 35, true);
    if (tinted) {
      Sound.play('secret');
      const k = pick(['soulheart', 'bomb', 'key', 'coin', 'coin', 'pill']);
      for (let i = 0; i < randi(1, 3); i++) G.room.pickups.push(makePickup(k, x, y));
    }
    return true;
  }
  if (t.t === 'p') { t.hp = 1; damageTile(c, r, 5); return true; }
  if (t.t === 'f' && t.hp > 0 && !t.eternal) { t.hp = 1; damageTile(c, r, 5); return true; }
  return false;
}

function paletteFor(room) {
  if (room.type === 'devil') return PALETTES.devil;
  if (room.type === 'angel') return PALETTES.angel;
  return PALETTES[STAGES[G.stage].ch];
}

function revealFloor() {
  for (const r of G.floor.rooms.values()) if (r.type !== 'secret') r.seen = true;
}
