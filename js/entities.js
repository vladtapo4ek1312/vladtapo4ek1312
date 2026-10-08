'use strict';
// ============================================================
//  Сущности: игрок, слёзы, лучи, бомбы, подбираемое, пьедесталы
// ============================================================

// ---------- пул предметов ----------
function takeItem(pool) {
  const avail = [];
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (!it.pools.includes(pool) || G.seenItems.has(id)) continue;
    if (G.player && (G.player.items.includes(id) || (G.player.active && G.player.active.id === id))) continue;
    avail.push([id, it.w || 1]);
  }
  const id = avail.length ? weighted(avail) : 'meat';
  G.seenItems.add(id);
  return id;
}

// ---------- частицы и декали ----------
function addParticle(x, y, vx, vy, color, size = 3, life = 30, grav = false, z = 0) {
  if (G.particles.length > 400) return;
  G.particles.push({ x, y, vx, vy, color, size, life, max: life, grav, z, vz: grav ? rand(1, 3) : 0 });
}
function bloodBurst(x, y, n = 10, color = '#9a1010') {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(0.5, 3.5);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(2, 4.5), randi(20, 40), true, rand(4, 14));
  }
  addDecal({ type: 'blood', x, y, r: rand(10, 18), color });
}
function addDecal(d) {
  const room = G.room;
  d.seed = Math.random() * 1e6;
  room.decals.push(d);
  if (room.decals.length > 120) room.decals.shift();
  if (G.bgCache) paintDecal(G.bgCache.ctx, d, true);
}

function addEffect(fx) { fx.t = 0; G.effects.push(fx); return fx; }

function poof(x, y, r = 14, color = 'rgba(230,230,230,') {
  addEffect({
    x, y, life: 18,
    draw(c, e) {
      const k = e.t / e.life;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + x;
        circle(c, x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * 0.7, r * 0.5 * (1 - k * 0.6), color + (0.6 * (1 - k)) + ')');
      }
    },
  });
}
function splashFx(x, y, color, size = 6) {
  addEffect({
    x, y, life: 14,
    draw(c, e) {
      const k = e.t / e.life;
      c.globalAlpha = 1 - k;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        circle(c, x + Math.cos(a) * size * 1.6 * k, y + Math.sin(a) * size * k, size * 0.45 * (1 - k), color);
      }
      ellipse(c, x, y, size * (0.6 + k), size * 0.6 * (0.6 + k), null, color, 1.5);
      c.globalAlpha = 1;
    },
  });
}

// ---------- взрыв ----------
function explode(x, y, o = {}) {
  const R = o.r || 72, dmg = o.dmg != null ? o.dmg : 60;
  addEffect({
    x, y, life: 26,
    draw(c, e) {
      const k = e.t / e.life;
      const rr = R * (0.4 + k * 0.7);
      c.globalAlpha = 1 - k;
      circle(c, x, y, rr, 'rgba(255,170,40,0.55)');
      circle(c, x, y, rr * 0.7, 'rgba(255,230,120,0.7)');
      circle(c, x, y, rr * 0.35 * (1 - k), '#fff');
      c.globalAlpha = 1;
    },
  });
  for (let i = 0; i < (o.small ? 8 : 22); i++) {
    const a = rand(0, Math.PI * 2), s = rand(1, 5);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, pick(['#555', '#777', '#ff9a30', '#ffd060']), rand(3, 7), randi(20, 45));
  }
  Sound.play(o.small ? 'hit' : 'explode');
  G.shake = Math.max(G.shake, o.small ? 4 : 11);
  for (const e of G.enemies) {
    if (e.dead) continue;
    for (const hc of e.hitCircles()) {
      if (Math.hypot(hc.x - x, hc.y - y) < R + hc.r) {
        const a = Math.atan2(hc.y - y, hc.x - x);
        hurtEnemy(e, dmg, Math.cos(a) * 8, Math.sin(a) * 8);
        break;
      }
    }
  }
  const p = G.player;
  if (!o.friendly && Math.hypot(p.x - x, p.y - y) < R * 0.8 + p.r) p.hurt(2, o.cause || 'Взрыв');
  if (o.small) return;
  let changed = false;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [tx, ty] = tileCenter(c, r);
    if (Math.hypot(tx - x, ty - y) < R + T * 0.3) changed = destroyTile(c, r) || changed;
  }
  for (const b of G.bombs) if (!b.dead && Math.hypot(b.x - x, b.y - y) < R) b.fuse = Math.min(b.fuse, 6);
  for (const d of DIR_NAMES) {
    const door = G.room.doors[d];
    if (door && door.hidden) {
      const [dx, dy] = doorCenter(d);
      if (Math.hypot(dx - x, dy - y) < R + 45) {
        door.hidden = false;
        otherRoom(door, G.room).seen = true;
        Sound.play('secret');
        G.shake = 14;
      }
    }
  }
  for (const pk of G.room.pickups) {
    const d = Math.hypot(pk.x - x, pk.y - y);
    if (d < R * 1.3 && !pk.shop && d > 0.1) { pk.vx += (pk.x - x) / d * 5; pk.vy += (pk.y - y) / d * 5; pk.vz = 3; }
  }
  addDecal({ type: 'scorch', x, y, r: R * 0.55 });
  if (changed) computeFlow();
}

// ============================================================
//  Игрок
// ============================================================
class Player {
  constructor(ch) {
    this.ch = ch;
    this.x = RX + RW / 2; this.y = RY + RH / 2 + 40;
    this.vx = 0; this.vy = 0; this.r = 11; this.z = 0;
    this.soulOnly = !!ch.soulOnly;
    this.maxHearts = ch.hearts; this.hp = ch.hearts * 2; this.soul = (ch.soul || 0) * 2;
    this.coins = ch.coins || 0; this.bombs = ch.bombs != null ? ch.bombs : 1; this.keys = ch.keys || 0;
    this.dmgUp = 0; this.dmgMult = ch.dmgMult || 1; this.tearsUp = ch.tears || 0; this.tearsMult = 1;
    this.speedUp = ch.speed || 0; this.rangeUp = ch.range || 0; this.shotSpeedUp = 0; this.luck = ch.luck || 0;
    this.flags = {}; this.multi = 0; this.flight = !!ch.flight; this.size = 1; this.tearScale = 1;
    this.items = []; this.familiars = []; this.active = null; this.consumable = null;
    this.fireCd = 0; this.eye = 1; this.dir = 'down'; this.headDir = 'down'; this.walk = 0;
    this.invuln = 0; this.shootT = 0; this.charge = 0; this.chargeDir = null; this.beamT = 0;
    this.trail = []; this.roomDmg = 0; this.shieldT = 0; this.mantle = false; this.holding = 0; this.holdItem = null;
    this.extraLives = 0; this.devilBonus = 0; this.dead = false; this.restartHold = 0; this.roomHoming = false;
    this.flashT = 0;
    if (ch.active) this.setActive(ch.active);
  }

  get damage() {
    const d = (3.5 + this.dmgUp) * this.dmgMult * (this.roomDmgMult || 1) + this.roomDmg;
    return Math.max(0.5, d);
  }
  get tps() { return clamp(2.73 + this.tearsUp, 0.7, 5.2) * this.tearsMult; }
  get fireDelay() { return 60 / this.tps; }
  get speed() { return clamp(1 + this.speedUp, 0.4, 2); }
  get range() { return Math.max(2.5, 6.5 + this.rangeUp); }
  get shotSpeed() { return clamp(1 + this.shotSpeedUp, 0.6, 2.2); }

  // --- здоровье ---
  addContainers(n, heal) {
    if (this.soulOnly) { if (n > 0) this.addSoul(n * 2); return; }
    this.maxHearts = clamp(this.maxHearts + n, 0, 12);
    const cap = (12 - this.maxHearts) * 2;
    if (this.soul > cap) this.soul = cap;
    this.hp = clamp(this.hp + (heal != null ? heal : 0), 0, this.maxHearts * 2);
    if (this.maxHearts * 2 + this.soul <= 0 && this.hp <= 0) this.die('Пустота');
  }
  heal(halves) {
    const b = this.hp;
    this.hp = Math.min(this.maxHearts * 2, this.hp + halves);
    return this.hp > b;
  }
  addSoul(halves) {
    const cap = (12 - this.maxHearts) * 2;
    const b = this.soul;
    this.soul = Math.min(cap, this.soul + halves);
    return this.soul > b;
  }
  canHeal() { return !this.soulOnly && this.hp < this.maxHearts * 2; }
  canSoul() { return this.maxHearts * 2 + this.soul < 24; }

  hurt(amount, cause) {
    if (this.dead || this.invuln > 0 || G.state !== 'play') return false;
    if (this.shieldT > 0) return false;
    if (this.mantle) {
      this.mantle = false; this.invuln = 50;
      Sound.play('shield');
      addEffect({ x: this.x, y: this.y, life: 20, draw: (c, e) => circle(c, this.x, this.y - 18, 20 + e.t * 1.5, null, 'rgba(255,255,220,' + (1 - e.t / 20) + ')', 3) });
      return false;
    }
    for (let i = 0; i < amount; i++) {
      if (this.soul > 0) this.soul--;
      else if (this.hp > 0) this.hp--;
    }
    G.damagedFloor = true;
    if (G.room.type === 'boss') G.damagedBoss = true;
    this.invuln = 60;
    Sound.play('hurt');
    G.shake = Math.max(G.shake, 6);
    G.hurtFlash = 10;
    bloodBurst(this.x, this.y, 8, '#b81414');
    if (this.hp <= 0 && this.soul <= 0) this.die(cause);
    return true;
  }

  die(cause) {
    if (this.dead) return;
    if (this.extraLives > 0) {
      this.extraLives--;
      if (this.soulOnly) this.soul = 6; else { this.maxHearts = Math.max(1, this.maxHearts); this.hp = this.maxHearts * 2; }
      this.invuln = 120;
      Sound.play('secret');
      G.banner = { title: 'Ещё одна жизнь!', desc: 'Анкх спас тебя', t: 150 };
      return;
    }
    this.dead = true;
    G.deathCause = cause || 'Неизвестно';
    G.deathT = 70;
    Sound.play('death');
    bloodBurst(this.x, this.y, 30, '#b81414');
  }

  // --- предметы ---
  setActive(id, charge) {
    const it = ITEMS[id];
    this.active = { id, charge: charge != null ? charge : it.charge, max: it.charge };
  }
  giveItem(id, silent) {
    const it = ITEMS[id];
    if (!it) return;
    if (it.active) this.setActive(id);
    else { this.items.push(id); if (it.apply) it.apply(this); }
    G.stats.items++;
    if (!silent) {
      this.holding = 50; this.holdItem = id;
      G.banner = { title: it.name, desc: it.desc, t: 170 };
      Sound.play('item');
    }
  }
  addFamiliar(kind) {
    const f = new Familiar(kind, this.familiars.filter(x => x.kind !== 'orbital').length);
    f.x = this.x; f.y = this.y;
    this.familiars.push(f);
    if (kind === 'orbital') { const orbs = this.familiars.filter(x => x.kind === 'orbital'); orbs.forEach((o, i) => { o.phase = i / orbs.length * Math.PI * 2; }); }
  }

  // --- обновление ---
  update() {
    if (this.dead) return;
    const mv = Input.moveVec();
    const max = 3.3 * this.speed;
    this.vx += (mv.x * max - this.vx) * 0.24;
    this.vy += (mv.y * max - this.vy) * 0.24;
    const moving = Math.hypot(mv.x, mv.y) > 0.1;
    // помощь при входе в дверь
    this.doorAssist(mv);
    moveCircle(this, this.vx, this.vy, this.flight, true);
    if (moving) {
      this.walk += 0.32 * this.speed;
      this.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x > 0 ? 'right' : 'left') : (mv.y > 0 ? 'down' : 'up');
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 120) this.trail.length = 120;
    }
    this.moving = moving;

    // переход между комнатами
    if (this.y < RY - 16) return startTransition('up');
    if (this.y > RY + RH + 16) return startTransition('down');
    if (this.x < RX - 16) return startTransition('left');
    if (this.x > RX + RW + 16) return startTransition('right');

    // запертые двери
    this.tryUnlockDoors(mv);

    // стрельба
    const sd = this.holding > 0 ? null : Input.shootDir();
    this.fireCd -= 1;
    if (this.beamT > 0) this.beamT--;
    if (this.flags.brimstone) {
      if (sd && this.beamT <= 0) {
        this.chargeDir = sd;
        const was = this.charge;
        this.charge = Math.min(this.chargeMax, this.charge + 1);
        if (was < this.chargeMax && this.charge >= this.chargeMax) Sound.play('charge');
      } else if (!sd && this.charge > 0) {
        if (this.charge >= this.chargeMax) this.fireBrimstone(this.chargeDir);
        this.charge = 0;
      }
    } else if (sd) {
      if (this.fireCd <= 0) { this.shoot(sd); this.fireCd += this.fireDelay; if (this.fireCd < 0) this.fireCd = 0; }
    } else if (this.fireCd < 0) this.fireCd = 0;
    if (sd) { this.headDir = sd; this.lastShootDir = sd; this.headT = 12; }
    else if (this.headT > 0) this.headT--;
    else this.headDir = this.dir;
    if (this.shootT > 0) this.shootT--;

    if (this.invuln > 0) this.invuln--;
    if (this.shieldT > 0) this.shieldT--;
    if (this.holding > 0) this.holding--;

    // действия
    if (Input.pressed('bomb')) this.placeBomb();
    if (Input.pressed('active')) useActive();
    if (Input.pressed('pill')) useConsumable();

    // ловушки на полу
    if (!this.flight) {
      const [c, r] = tileOf(this.x, this.y);
      const t = G.room.tile(c, r);
      if (t && t.t === 's') this.hurt(1, 'Шипы');
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = G.room.grid[r * COLS + c];
      if (t.t !== 'f' || t.hp <= 0) continue;
      const [x, y] = tileCenter(c, r);
      if (Math.abs(this.x - x) < T / 2 + this.r - 2 && Math.abs(this.y - y) < T / 2 + this.r - 2) this.hurt(1, 'Огонь');
    }
  }

  doorAssist(mv) {
    const cxm = RX + RW / 2, cym = RY + RH / 2;
    const room = G.room;
    const tryAxis = (dir, cond, along, center) => {
      const d = room.doors[dir];
      if (!d || !doorOpen(d) || !cond) return;
      const off = this[along] - center;
      if (Math.abs(off) < T * 0.85 && Math.abs(off) > 0.5) this[along] -= Math.sign(off) * Math.min(Math.abs(off), 1.8);
    };
    tryAxis('up', mv.y < -0.5 && this.y < RY + T * 0.9, 'x', cxm);
    tryAxis('down', mv.y > 0.5 && this.y > RY + RH - T * 0.9, 'x', cxm);
    tryAxis('left', mv.x < -0.5 && this.x < RX + T * 0.9, 'y', cym);
    tryAxis('right', mv.x > 0.5 && this.x > RX + RW - T * 0.9, 'y', cym);
  }

  tryUnlockDoors(mv) {
    const room = G.room;
    if (!room.cleared) return;
    const cxm = RX + RW / 2, cym = RY + RH / 2;
    const checks = {
      up: mv.y < -0.5 && this.y < RY + this.r + 3 && Math.abs(this.x - cxm) < T * 0.6,
      down: mv.y > 0.5 && this.y > RY + RH - this.r - 3 && Math.abs(this.x - cxm) < T * 0.6,
      left: mv.x < -0.5 && this.x < RX + this.r + 3 && Math.abs(this.y - cym) < T * 0.6,
      right: mv.x > 0.5 && this.x > RX + RW - this.r - 3 && Math.abs(this.y - cym) < T * 0.6,
    };
    for (const d of DIR_NAMES) {
      const door = room.doors[d];
      if (!door || !door.locked || !checks[d]) continue;
      if (this.keys > 0) { this.keys--; door.locked = false; Sound.play('unlock'); }
    }
  }

  get chargeMax() { return Math.max(20, this.fireDelay * 2.4); }

  shotAngles(base) {
    const n = 1 + this.multi;
    const fan = [];
    if (n === 1) fan.push({ a: 0, off: this.eye * 5 });
    else if (n === 2) fan.push({ a: 0, off: -7 }, { a: 0, off: 7 });
    else for (let i = 0; i < n; i++) fan.push({ a: (i - (n - 1) / 2) * 0.13, off: 0 });
    const bases = this.flags.wiz ? [base - Math.PI / 4, base + Math.PI / 4] : [base];
    const out = [];
    for (const b of bases) for (const f of fan) out.push({ a: b + f.a, off: f.off });
    return out;
  }

  tearColor() {
    const f = this.flags;
    if (f.ipecac) return '#b8d446';
    if (f.poison) return '#6ad35a';
    if (f.burn) return '#ff9a3c';
    if (f.homing || this.roomHoming) return '#c98af2';
    if (f.slow) return '#e4e4e4';
    if (f.coal) return '#3a3a3a';
    if (this.roomDmg > 0 || this.dmgUp >= 4) return '#e45a5a';
    return '#a9d9ff';
  }

  shoot(dir) {
    const base = DIR_ANGLE[dir];
    const shots = this.shotAngles(base);
    if (this.flags.tech) {
      for (const s of shots) {
        G.beams.push(new Beam({ x: this.x, y: this.y - 4, angle: s.a, width: 7, life: 9, dmg: this.damage, once: true, kind: 'laser', status: this.statusFlags() }));
      }
      Sound.play('laser');
    } else {
      for (const s of shots) this.spawnTear(s.a, s.off);
      Sound.play('shoot');
    }
    this.eye = -this.eye;
    this.shootT = 8;
  }

  statusFlags() {
    const f = this.flags;
    return { poison: f.poison, slow: f.slow, burn: f.burn, luck: this.luck };
  }

  spawnTear(a, off, o = {}) {
    const sp = 7 * this.shotSpeed;
    const px = -Math.sin(a) * off, py = Math.cos(a) * off;
    const dmg = o.dmg || this.damage;
    let r = (4.6 + Math.sqrt(dmg) * 1.25) * this.tearScale;
    if (this.flags.small) r = 3.6 * this.tearScale;
    if (this.flags.big) r *= 1.45;
    r = Math.min(r, 16);
    const life = (o.range || this.range) * T / sp;
    const inherit = 0.35;
    const t = new Tear({
      x: this.x + px + Math.cos(a) * 4, y: this.y + py + Math.sin(a) * 4,
      vx: Math.cos(a) * sp + this.vx * inherit, vy: Math.sin(a) * sp + this.vy * inherit,
      z: 18, dmg, r, life,
      color: this.tearColor(),
      flags: {
        homing: this.flags.homing || this.roomHoming, piercing: this.flags.piercing, spectral: this.flags.spectral,
        bounce: this.flags.bounce, ipecac: this.flags.ipecac, coal: this.flags.coal,
      },
      status: this.statusFlags(),
    });
    if (this.flags.ipecac) { t.arc = true; t.z = 10; }
    G.tears.push(t);
    return t;
  }

  fireBrimstone(dir) {
    const base = DIR_ANGLE[dir];
    for (const s of this.shotAngles(base)) {
      G.beams.push(new Beam({ x: this.x, y: this.y - 6, angle: s.a, width: 26 * Math.min(1.6, this.tearScale), life: 26, dmg: this.damage * 0.6, tick: 3, kind: 'brim', follow: this, status: this.statusFlags() }));
    }
    this.beamT = 26;
    this.headDir = dir; this.headT = 26;
    Sound.play('brim');
    G.shake = Math.max(G.shake, 4);
  }

  placeBomb() {
    if (this.bombs <= 0) return;
    this.bombs--;
    G.bombs.push(new Bomb(this.x, this.y + 4, { big: this.flags.bigBombs }));
    Sound.play('pickup');
  }

  draw(c) {
    if (this.dead) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0;
    shadow(c, this.x, this.y + 1, 12 * this.size, 4.5 * this.size, 0.4);
    if (this.charge > 0 && this.flags.brimstone) {
      const k = this.charge / this.chargeMax;
      circle(c, this.x, this.y - 25 * this.size, 16 + k * 6, 'rgba(200,20,20,' + (0.15 + k * 0.35) + ')');
    }
    if (this.shieldT > 0) circle(c, this.x, this.y - 18, 24, 'rgba(255,250,200,0.25)', 'rgba(255,240,160,0.8)', 2);
    else if (this.mantle) circle(c, this.x, this.y - 18, 23, null, 'rgba(255,255,255,0.35)', 1.5);
    drawHero(c, this.x, this.y - (this.flight ? 6 + Math.sin(G.t * 0.1) * 2 : 0), {
      dir: this.holding > 0 ? 'down' : this.headDir, skin: this.ch.skin, look: this.ch.look,
      moving: this.moving, walk: this.walk, shoot: this.shootT || (this.charge > 0 ? 1 : 0), scale: this.size,
      alpha: blink ? 0.35 : 1, holding: this.holding > 0, t: G.t,
      wings: this.flight, halo: this.flags.halo, horns: this.flags.brimstone || this.items.includes('pentagram') && this.items.includes('goat'),
      hat: this.flags.wiz,
    });
    if (this.holding > 0 && this.holdItem) drawItemIcon(c, this.holdItem, this.x, this.y - 64 * this.size, 1);
  }
}

// ============================================================
//  Слёзы
// ============================================================
class Tear {
  constructor(o) {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.z = 16; this.dmg = 3.5; this.r = 6;
    this.life = 50; this.enemy = false; this.flags = {}; this.status = null; this.color = '#a9d9ff';
    this.dead = false; this.traveled = 0; this.bounces = 0; this.hits = null; this.arc = false; this.accel = 0; this.curve = 0;
    Object.assign(this, o);
    this.max = this.life;
    this.z0 = this.z;
    if (this.flags.piercing) this.hits = new Set();
    if (this.flags.bounce) this.bounces = 2;
  }

  update() {
    if (this.flags.homing && !this.enemy) {
      let best = null, bd = 240;
      for (const e of G.enemies) {
        if (!canHit(e) || (this.hits && this.hits.has(e))) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(this.vx, this.vy);
        const a = Math.atan2(this.vy, this.vx);
        const na = a + clamp(angDiff(a, Math.atan2(best.y - this.y, best.x - this.x)), -0.12, 0.12);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    if (this.curve) {
      const a = Math.atan2(this.vy, this.vx) + this.curve, sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    }
    if (this.accel) { this.vx *= 1 + this.accel; this.vy *= 1 + this.accel; }
    const px = this.x, py = this.y;
    this.x += this.vx; this.y += this.vy;
    this.traveled += Math.hypot(this.vx, this.vy);
    this.life--;
    // высота: в конце полёта слеза падает
    if (this.arc) {
      const k = 1 - this.life / this.max;
      this.z = this.z0 + Math.sin(k * Math.PI) * 30 - k * this.z0;
    } else {
      const fall = this.max * 0.28;
      if (this.life < fall) this.z = this.z0 * Math.max(0, this.life / fall);
    }
    // стены
    if (this.x < RX + 3 || this.x > RX + RW - 3) {
      if (this.bounces > 0) { this.bounces--; this.vx = -this.vx; this.x = clamp(this.x, RX + 3, RX + RW - 3); }
      else return this.die();
    }
    if (this.y < RY + 3 || this.y > RY + RH - 3) {
      if (this.bounces > 0) { this.bounces--; this.vy = -this.vy; this.y = clamp(this.y, RY + 3, RY + RH - 3); }
      else return this.die();
    }
    // препятствия
    if (!this.flags.spectral && !this.arc) {
      const [c, r] = tileOf(this.x, this.y);
      const t = G.room.tile(c, r);
      if (t && solidTear(t)) {
        if (!this.enemy && (t.t === 'p' || t.t === 'f')) { damageTile(c, r, 1); return this.die(); }
        if (this.bounces > 0) {
          this.bounces--;
          const [pc, pr] = tileOf(px, py);
          if (pc !== c) this.vx = -this.vx;
          if (pr !== r) this.vy = -this.vy;
          if (pc === c && pr === r) { this.vx = -this.vx; this.vy = -this.vy; }
          this.x = px; this.y = py;
        } else return this.die();
      }
    }
    // попадания
    if (this.enemy) {
      const p = G.player;
      for (const f of p.familiars) {
        if (f.kind === 'orbital' && Math.hypot(f.x - this.x, f.y - this.y) < this.r + 9) return this.die();
      }
      if (!p.dead && Math.hypot(p.x - this.x, p.y - 8 - this.y) < this.r + 8) {
        p.hurt(this.dmg, this.cause || 'Вражеская слеза');
        return this.die();
      }
    } else if (!this.arc || this.life < 6) {
      for (const e of G.enemies) {
        if (!canHit(e) || (this.hits && this.hits.has(e))) continue;
        let hit = false;
        for (const hc of e.hitCircles()) if (Math.hypot(hc.x - this.x, hc.y - this.y) < this.r + hc.r) { hit = true; break; }
        if (!hit) continue;
        let dmg = this.dmg;
        if (this.flags.coal) dmg *= 1 + this.traveled / 260;
        const sp = Math.hypot(this.vx, this.vy) || 1;
        hurtEnemy(e, dmg, this.vx / sp * 2.2, this.vy / sp * 2.2);
        applyStatus(e, this.status, this.dmg);
        if (this.flags.ipecac) return this.die();
        if (this.hits) { this.hits.add(e); continue; }
        return this.die();
      }
    }
    if (this.life <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    if (this.flags.ipecac && !this.enemy) {
      explode(this.x, this.y, { r: 40, dmg: this.dmg * 1.6, friendly: true, small: true });
      return;
    }
    splashFx(this.x, this.y - this.z * 0.6, this.enemy ? '#c43030' : this.color, this.r);
    if (this.r > 3.5) Sound.play('splash');
  }

  draw(c) {
    const y = this.y - this.z;
    shadow(c, this.x, this.y + 2, this.r * 0.8, this.r * 0.32, 0.3);
    if (this.enemy) {
      circle(c, this.x, y, this.r, '#c42828', '#3a0808', 1.5);
      circle(c, this.x - this.r * 0.3, y - this.r * 0.3, this.r * 0.32, '#ff9a9a');
    } else {
      const g = c.createRadialGradient(this.x - this.r * 0.3, y - this.r * 0.35, this.r * 0.1, this.x, y, this.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, this.color);
      g.addColorStop(1, mixColor(this.color, '#203050', 0.45));
      circle(c, this.x, y, this.r, g, 'rgba(10,20,40,0.6)', 1.2);
      if (this.flags.spectral) circle(c, this.x, y, this.r + 2, null, 'rgba(255,255,255,0.35)', 1);
    }
  }
}

function applyStatus(e, st, dmg) {
  if (!st || e.dead) return;
  const luck = st.luck || 0;
  if (st.poison && chance(0.35 + luck * 0.05)) { e.poison = 120; e.poisonDmg = Math.max(1, dmg * 0.35); }
  if (st.slow && chance(0.35 + luck * 0.05)) e.slow = 100;
  if (st.burn && chance(0.2 + luck * 0.04)) { e.burn = 100; e.burnDmg = Math.max(1, dmg * 0.4); }
}

// ============================================================
//  Лучи (лазер и адская сера)
// ============================================================
class Beam {
  constructor(o) {
    this.x = 0; this.y = 0; this.angle = 0; this.width = 8; this.life = 10; this.dmg = 1; this.tick = 3;
    this.t = 0; this.once = false; this.follow = null; this.kind = 'laser'; this.dead = false; this.status = null;
    Object.assign(this, o);
    this.max = this.life;
    this.hitSet = new Set();
    this.tileHits = new Set();
    this.calc();
  }
  calc() {
    if (this.follow) { this.x = this.follow.x; this.y = this.follow.y - 6; }
    const [ex, ey] = rayToWall(this.x, this.y, this.angle);
    this.ex = ex; this.ey = ey;
  }
  update() {
    this.calc();
    this.t++;
    const doHit = this.once ? this.t === 1 : (this.t % this.tick === 1);
    if (doHit) {
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      for (const e of G.enemies) {
        if (!canHit(e) || (this.once && this.hitSet.has(e))) continue;
        for (const hc of e.hitCircles()) {
          if (segDist(hc.x, hc.y, this.x, this.y, this.ex, this.ey) < hc.r + this.width / 2) {
            hurtEnemy(e, this.dmg, ca * 1.2, sa * 1.2);
            applyStatus(e, this.status, this.dmg);
            this.hitSet.add(e);
            break;
          }
        }
      }
      const len = Math.hypot(this.ex - this.x, this.ey - this.y);
      for (let d = 0; d < len; d += 16) {
        const [c, r] = tileOf(this.x + ca * d, this.y + sa * d);
        const k = c + ',' + r;
        if (this.tileHits.has(k)) continue;
        const t = G.room.tile(c, r);
        if (t && (t.t === 'p' || (t.t === 'f' && t.hp > 0))) { this.tileHits.add(k); damageTile(c, r, this.kind === 'brim' ? 2 : 1); }
      }
    }
    if (--this.life <= 0) this.dead = true;
  }
  draw(c) {
    const k = this.life / this.max;
    const w = this.width * (this.kind === 'brim' ? (0.6 + 0.4 * Math.min(1, k * 3)) : k);
    c.save();
    c.lineCap = 'round';
    const wob = this.kind === 'brim' ? Math.sin(G.t * 0.9) * 2 : 0;
    const y0 = this.y - 10, y1 = this.ey - 10;
    if (this.kind === 'brim') {
      line(c, this.x, y0, this.ex, y1, 'rgba(120,0,0,0.55)', w + 10 + wob);
      line(c, this.x, y0, this.ex, y1, '#d01818', w + wob);
      line(c, this.x, y0, this.ex, y1, '#ff8a6a', w * 0.4);
      circle(c, this.ex, y1, w * 0.8, 'rgba(220,30,30,0.7)');
    } else {
      line(c, this.x, y0, this.ex, y1, 'rgba(255,40,40,0.45)', w + 6);
      line(c, this.x, y0, this.ex, y1, '#ff4040', w);
      line(c, this.x, y0, this.ex, y1, '#fff', Math.max(1, w * 0.35));
    }
    c.restore();
  }
}

// ============================================================
//  Бомба
// ============================================================
class Bomb {
  constructor(x, y, o = {}) {
    this.x = x; this.y = y; this.vx = o.vx || 0; this.vy = o.vy || 0; this.r = 10;
    this.fuse = o.fuse != null ? o.fuse : 84; this.big = !!o.big; this.dead = false; this.t = 0;
    this.friendly = !!o.friendly; this.cause = o.cause || 'Собственная бомба';
  }
  update() {
    this.t++;
    this.fuse--;
    moveCircle(this, this.vx, this.vy, false, false);
    this.vx *= 0.88; this.vy *= 0.88;
    const p = G.player;
    const d = Math.hypot(this.x - p.x, this.y - p.y);
    if (d < this.r + p.r && d > 0.01) { this.vx += (this.x - p.x) / d * 0.7; this.vy += (this.y - p.y) / d * 0.7; }
    if (this.fuse <= 0) {
      this.dead = true;
      explode(this.x, this.y, { r: this.big ? 98 : 72, dmg: this.big ? 110 : 60, friendly: this.friendly, cause: this.cause });
    }
  }
  draw(c) {
    const s = this.big ? 1.35 : 1;
    const pulse = 1 + (this.fuse < 30 ? Math.sin(this.t * 0.9) * 0.08 : 0);
    shadow(c, this.x, this.y + 6, 11 * s, 4 * s, 0.4);
    drawBomb(c, this.x, this.y - 6, 9.5 * s * pulse, this.t, this.fuse < 30 && Math.floor(this.t / 3) % 2 === 0);
  }
}

// ============================================================
//  Подбираемое
// ============================================================
function randomPickupKind() {
  return weighted([['coin', 34], ['heart', 18], ['key', 12], ['bomb', 12], ['chest', 6], ['pill', 6], ['card', 4], ['soulheart', 5], ['goldchest', 2]]);
}
function makePickup(kind, x, y) {
  const p = new Pickup(kind, x, y);
  return p;
}

class Pickup {
  constructor(kind, x, y) {
    this.kind = kind; this.x = x; this.y = y;
    const a = rand(0, Math.PI * 2), s = rand(0.5, 2.5);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; this.z = 2; this.vz = rand(2, 4);
    this.r = 9; this.t = 0; this.cd = 12; this.price = 0; this.shop = false; this.dead = false; this.value = 1;
    if (kind === 'coin') { const r = Math.random(); this.value = r < 0.03 ? 10 : r < 0.1 ? 5 : 1; }
    if (kind === 'heart') this.value = chance(0.3) ? 1 : 2;
    if (kind === 'soulheart') this.value = 2;
    if (kind === 'bomb') this.value = 1;
    if (kind === 'doublebomb') { this.kind = 'bomb'; this.value = 2; }
    if (kind === 'pill') this.pill = pick(G.pillPool);
    if (kind === 'card') this.card = pick(Object.keys(CARDS));
    if (kind === 'chest' || kind === 'goldchest') { this.r = 15; this.opened = false; }
  }

  canTake(p) {
    switch (this.kind) {
      case 'heart': return p.canHeal();
      case 'soulheart': return p.canSoul();
      case 'chest': return !this.opened;
      case 'goldchest': return !this.opened && p.keys > 0;
      default: return true;
    }
  }

  collect(p) {
    switch (this.kind) {
      case 'coin': p.coins = Math.min(99, p.coins + this.value); Sound.play('coin'); break;
      case 'heart': p.heal(this.value); Sound.play('heart'); break;
      case 'soulheart': p.addSoul(this.value); Sound.play('heart'); break;
      case 'bomb': p.bombs = Math.min(99, p.bombs + this.value); Sound.play('pickup'); break;
      case 'key': p.keys = Math.min(99, p.keys + 1); Sound.play('key'); break;
      case 'pill': case 'card': {
        const old = p.consumable;
        p.consumable = this.kind === 'pill' ? { type: 'pill', id: this.pill } : { type: 'card', id: this.card };
        if (old) {
          const d = new Pickup(old.type, this.x, this.y);
          if (old.type === 'pill') d.pill = old.id; else d.card = old.id;
          d.cd = 90; d.vx = d.vy = 0;
          G.room.pickups.push(d);
        }
        Sound.play('pickup');
        const name = this.kind === 'pill' ? (G.pillKnown.has(this.pill) ? PILLS[this.pill].name : 'Пилюля') : CARDS[this.card].name;
        G.banner = { title: name, desc: this.kind === 'card' ? CARDS[this.card].desc : (G.pillKnown.has(this.pill) ? '' : 'Что же она делает?'), t: 110, small: true };
        break;
      }
      case 'chest': case 'goldchest':
        if (this.kind === 'goldchest') p.keys--;
        this.opened = true;
        Sound.play('chest');
        openChest(this);
        return false;
    }
    return true;
  }

  update() {
    this.t++;
    if (this.cd > 0) this.cd--;
    if (!this.shop) {
      this.z += this.vz; this.vz -= 0.35;
      if (this.z <= 0) { this.z = 0; this.vz = Math.abs(this.vz) > 1.2 ? -this.vz * 0.4 : 0; }
      moveCircle(this, this.vx, this.vy, false, false);
      this.vx *= 0.9; this.vy *= 0.9;
    }
    const p = G.player;
    if (p.dead) return;
    const d = Math.hypot(this.x - p.x, this.y - p.y);
    if (d < this.r + p.r && this.z < 4) {
      if (this.cd <= 0 && this.canTake(p) && (!this.price || p.coins >= this.price)) {
        if (this.price) { p.coins -= this.price; this.price = 0; this.shop = false; }
        if (this.collect(p)) { this.dead = true; poof(this.x, this.y, 8, 'rgba(255,255,255,'); }
      } else if (!this.shop && d > 0.01 && !(this.opened)) {
        this.vx += (this.x - p.x) / d * 0.6; this.vy += (this.y - p.y) / d * 0.6;
      }
    }
  }

  draw(c) {
    const y = this.y - this.z;
    const bob = this.shop ? Math.sin(this.t * 0.06) * 1.5 : 0;
    if (this.kind !== 'chest' && this.kind !== 'goldchest') shadow(c, this.x, this.y + 5, 8, 3, 0.35);
    switch (this.kind) {
      case 'coin': {
        const sx = this.shop ? 1 : Math.abs(Math.cos(this.t * 0.05)) * 0.6 + 0.4;
        c.save(); c.translate(this.x, y - 3 + bob); c.scale(sx, 1); drawCoin(c, 0, 0, 7, this.value); c.restore();
        break;
      }
      case 'heart': drawHeart(c, this.x, y - 4 + bob, 18, this.value === 1 ? 'half' : 'red'); break;
      case 'soulheart': drawHeart(c, this.x, y - 4 + bob, 18, 'soul'); break;
      case 'bomb': drawBomb(c, this.x - (this.value > 1 ? 4 : 0), y - 2 + bob, 7, -1); if (this.value > 1) drawBomb(c, this.x + 5, y + bob, 7, -1); break;
      case 'key': drawKey(c, this.x, y - 3 + bob, 16); break;
      case 'pill': drawPill(c, this.x, y - 3 + bob, 15, G.pillColors[this.pill]); break;
      case 'card': drawCard(c, this.x, y - 5 + bob, 18, CARDS[this.card].color); break;
      case 'chest': case 'goldchest': drawChest(c, this.x, y, this.kind === 'goldchest', this.opened); break;
    }
    if (this.price) {
      text(c, this.price + '¢', this.x, this.y + 20, 15, '#fff', 'center');
    }
  }
}

function openChest(ch) {
  const n = ch.kind === 'goldchest' ? randi(2, 4) : randi(1, 3);
  if (ch.kind === 'goldchest' && chance(0.12)) {
    G.room.pedestals.push(new Pedestal(ch.x, ch.y - 2, takeItem('treasure')));
    ch.dead = true;
    return;
  }
  for (let i = 0; i < n; i++) {
    const k = weighted([['coin', 40], ['heart', 15], ['key', 12], ['bomb', 14], ['pill', 8], ['soulheart', 6], ['card', 5]]);
    const p = makePickup(k, ch.x, ch.y);
    p.vz = rand(3, 5); p.cd = 25;
    G.room.pickups.push(p);
  }
}

// ============================================================
//  Пьедестал с предметом
// ============================================================
class Pedestal {
  constructor(x, y, item) {
    this.x = x; this.y = y; this.item = item; this.r = 16; this.t = randi(0, 100); this.cd = 0;
    this.price = 0; this.devil = 0;
  }
  devilCost(p) {
    if (!this.devil) return null;
    if (p.maxHearts >= this.devil && !p.soulOnly) return { hearts: this.devil };
    if (p.soul >= 6) return { soul: 6 };
    return null;
  }
  update() {
    this.t++;
    const p = G.player;
    const d = Math.hypot(this.x - p.x, this.y - p.y);
    if (this.cd > 0) { this.cd--; return; }
    if (this.needLeave) { if (d > this.r + p.r + 12) this.needLeave = false; return; }
    if (!this.item || p.dead || p.holding > 0) return;
    if (d > this.r + p.r) return;
    if (this.price && p.coins < this.price) return;
    let cost = null;
    if (this.devil) {
      cost = this.devilCost(p);
      if (!cost) return;
    }
    if (this.price) p.coins -= this.price;
    if (cost) {
      if (cost.hearts) { p.maxHearts -= cost.hearts; p.hp = Math.min(p.hp, p.maxHearts * 2); if (p.hp <= 0 && p.soul <= 0) p.soul = 1; }
      else p.soul -= cost.soul;
      G.devilTaken = true;
    }
    this.price = 0; this.devil = 0;
    const id = this.item;
    const it = ITEMS[id];
    const stored = this.charge;
    const old = p.active;
    if (it.active && old) {
      this.item = old.id;
      this.charge = old.charge;
      this.cd = 20;
      this.needLeave = true;
    } else { this.item = null; this.charge = null; }
    p.giveItem(id);
    if (it.active && stored != null) p.active.charge = stored;
    if (G.room.type === 'devil' || G.room.type === 'angel') {
      // в комнате сделок можно взять только один предмет... как в оригинале у ангелов
      if (G.room.type === 'angel') for (const o of G.room.pedestals) if (o !== this && o.item) { o.item = null; poof(o.x, o.y - 30, 16); }
    }
  }
  draw(c) {
    shadow(c, this.x, this.y + 8, 17, 5, 0.4);
    // каменная подставка
    rrect(c, this.x - 15, this.y - 8, 30, 16, 3, '#8b8578', OUT, 2);
    c.fillStyle = '#a8a294'; c.fillRect(this.x - 13, this.y - 7, 26, 4);
    rrect(c, this.x - 18, this.y - 12, 36, 6, 2, '#9c968a', OUT, 2);
    if (this.item) {
      const by = this.y - 34 + Math.sin(this.t * 0.06) * 3;
      const g = c.createRadialGradient(this.x, by, 2, this.x, by, 26);
      g.addColorStop(0, 'rgba(255,255,220,0.35)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      circle(c, this.x, by, 26, g);
      drawItemIcon(c, this.item, this.x, by, 1);
      if (this.price) text(c, this.price + '¢', this.x, this.y + 22, 16, '#fff', 'center');
      if (this.devil) {
        const p = G.player;
        const cost = this.devilCost(p);
        const soul = cost && cost.soul;
        const n = soul ? 3 : this.devil;
        for (let i = 0; i < n; i++) drawHeart(c, this.x + (i - (n - 1) / 2) * 15, this.y + 22, 13, soul ? 'soul' : 'red');
      }
    }
  }
}

// ============================================================
//  Люк на следующий этаж
// ============================================================
class Trapdoor {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.armed = false; this.kind = 'trapdoor'; }
  update() {
    this.t++;
    const p = G.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (!this.armed) { if (d > 50 && this.t > 30) this.armed = true; return; }
    if (d < 18 && !p.dead) nextFloor();
  }
  draw(c) {
    const k = Math.min(1, this.t / 20);
    ellipse(c, this.x, this.y, 30 * k, 22 * k, '#3a2414', OUT, 3);
    ellipse(c, this.x, this.y + 1, 24 * k, 17 * k, '#000');
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.6;
      circle(c, this.x + Math.cos(a) * 28 * k, this.y + Math.sin(a) * 20 * k, 2.5, '#8a8a8a', OUT, 1);
    }
  }
}

// ============================================================
//  Фамильяры
// ============================================================
class Familiar {
  constructor(kind, index) {
    this.kind = kind; this.index = index; this.x = 0; this.y = 0; this.cd = 0; this.phase = 0; this.dir = 'down'; this.t = 0;
    this.hitCd = 0;
  }
  update() {
    const p = G.player;
    this.t++;
    if (this.kind === 'orbital') {
      this.phase += 0.055;
      this.x = p.x + Math.cos(this.phase) * 36;
      this.y = p.y - 8 + Math.sin(this.phase) * 30;
      if (this.hitCd > 0) this.hitCd--;
      else for (const e of G.enemies) {
        if (canHit(e) && Math.hypot(e.x - this.x, e.y - this.y) < e.r + 8) { hurtEnemy(e, 3, 0, 0); this.hitCd = 8; break; }
      }
      return;
    }
    const idx = Math.min(p.trail.length - 1, (this.index + 1) * 14);
    const tgt = idx >= 0 ? p.trail[idx] : p;
    if (tgt) { this.x = lerp(this.x, tgt.x, 0.25); this.y = lerp(this.y, tgt.y, 0.25); }
    if (this.cd > 0) this.cd--;
    if (this.kind === 'demon') {
      let best = null, bd = 230;
      for (const e of G.enemies) { if (!canHit(e)) continue; const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < bd) { bd = d; best = e; } }
      if (best && this.cd <= 0) {
        const a = Math.atan2(best.y - this.y, best.x - this.x);
        G.tears.push(new Tear({ x: this.x, y: this.y, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, z: 12, dmg: 3, r: 5, life: 45, color: '#e45a5a' }));
        this.cd = 22;
        this.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
      }
      return;
    }
    const sd = p.holding > 0 ? null : Input.shootDir();
    if (sd) this.dir = sd;
    if (sd && this.cd <= 0) {
      const a = DIR_ANGLE[sd];
      const dmg = this.kind === 'sis' ? 3 : 3.5;
      G.tears.push(new Tear({ x: this.x, y: this.y, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, z: 12, dmg, r: 5.2, life: 48, color: '#a9d9ff', flags: { homing: p.flags.homing } }));
      this.cd = this.kind === 'sis' ? 16 : 28;
    }
  }
  draw(c) {
    if (this.kind === 'orbital') {
      shadow(c, this.x, this.y + 14, 6, 2.5, 0.25);
      c.save(); c.translate(this.x, this.y); c.scale(0.7, 0.7); ICONS.orbital(c); c.restore();
      return;
    }
    shadow(c, this.x, this.y + 2, 8, 3, 0.3);
    const skin = this.kind === 'demon' ? '#4a4048' : '#f3d9c9';
    drawHero(c, this.x, this.y, { dir: this.dir, skin, look: 'kai', scale: 0.55, moving: false, horns: this.kind === 'demon' });
    if (this.kind === 'sis') { poly(c, [this.x, this.y - 21, this.x - 6, this.y - 25, this.x - 6, this.y - 18], '#f07aa0', OUT, 1); poly(c, [this.x, this.y - 21, this.x + 6, this.y - 25, this.x + 6, this.y - 18], '#f07aa0', OUT, 1); }
  }
}

// ============================================================
//  Активные предметы, пилюли, карты
// ============================================================
function useActive() {
  const p = G.player;
  const a = p.active;
  if (!a || p.dead) return;
  if (a.charge < a.max) { Sound.play('menu'); return; }
  let used = true;
  switch (a.id) {
    case 'd6': {
      let n = 0;
      for (const ped of G.room.pedestals) if (ped.item) {
        const pool = G.room.type === 'shop' ? 'shop' : G.room.type === 'devil' ? 'devil' : G.room.type === 'angel' ? 'angel' : G.room.type === 'boss' ? 'boss' : 'treasure';
        ped.item = takeItem(pool); ped.charge = null; n++;
        poof(ped.x, ped.y - 34, 16);
      }
      if (!n) used = false;
      break;
    }
    case 'blackbook': p.roomDmg += 2; p.devilBonus += 0.05; Sound.play('roar'); break;
    case 'prayer': p.shieldT = 300; Sound.play('shield'); break;
    case 'catHead':
      for (let i = 0; i < 10; i++) {
        const t = p.spawnTear(i / 10 * Math.PI * 2, 0, { dmg: p.damage + 25 });
        t.vx -= p.vx * 0.35; t.vy -= p.vy * 0.35;
      }
      Sound.play('shoot');
      break;
    case 'teleport': teleportRandom(); break;
    case 'hourglass': G.slowT = 480; Sound.play('teleport'); break;
    case 'yum':
      if (p.soulOnly) p.addSoul(2); else if (!p.heal(2)) p.addSoul(1);
      Sound.play('heart');
      break;
    case 'grimoire':
      for (const e of G.enemies) if (canHit(e)) hurtEnemy(e, 40, 0, 0);
      G.shake = 10; G.hurtFlash = 6; Sound.play('roar');
      break;
    case 'mrBoom': G.bombs.push(new Bomb(p.x, p.y + 4, { big: true, fuse: 60 })); break;
  }
  if (used) a.charge = 0;
}

function useConsumable() {
  const p = G.player;
  const cs = p.consumable;
  if (!cs || p.dead) return;
  p.consumable = null;
  if (cs.type === 'pill') {
    G.pillKnown.add(cs.id);
    const pl = PILLS[cs.id];
    Sound.play(pl.good ? 'pill' : 'bad');
    G.banner = { title: pl.name, desc: '', t: 120, small: true };
    switch (cs.id) {
      case 'hpUp': p.addContainers(1, 2); break;
      case 'hpDown': if (p.maxHearts > 1) p.addContainers(-1); else if (p.soul > 2) p.soul -= 2; break;
      case 'fullHp': p.hp = p.maxHearts * 2; if (p.soulOnly) p.addSoul(4); break;
      case 'badTrip':
        if (p.hp + p.soul <= 2) { p.hp = p.maxHearts * 2; G.banner.title = 'Полное исцеление'; }
        else { const inv = p.invuln; p.invuln = 0; p.hurt(2, 'Плохой трип'); p.invuln = Math.max(inv, 60); }
        break;
      case 'balls': p.addSoul(4); break;
      case 'tearsUp': p.tearsUp += 0.35; break;
      case 'tearsDown': p.tearsUp -= 0.28; break;
      case 'speedUp': p.speedUp += 0.15; break;
      case 'speedDown': p.speedUp -= 0.12; break;
      case 'rangeUp': p.rangeUp += 0.75; break;
      case 'luckUp': p.luck += 1; break;
      case 'bombs': G.diarrhea = 5; G.diarrheaT = 0; break;
      case 'tele': teleportRandom(); break;
      case 'energy': if (p.active) p.active.charge = p.active.max; break;
      case 'nothing': break;
    }
  } else {
    const cd = CARDS[cs.id];
    Sound.play('pill');
    G.banner = { title: cd.name, desc: cd.desc, t: 120, small: true };
    const f = G.floor;
    switch (cs.id) {
      case 'fool': teleportTo(f.start); break;
      case 'magician': p.roomHoming = true; break;
      case 'hermit': teleportTo(f.shop); break;
      case 'star': teleportTo(f.treasure); break;
      case 'moon': if (f.secret) { for (const d of DIR_NAMES) if (f.secret.doors[d]) f.secret.doors[d].hidden = false; teleportTo(f.secret); } break;
      case 'tower':
        for (let i = 0; i < 6; i++) G.bombs.push(new Bomb(rand(RX + 40, RX + RW - 40), rand(RY + 40, RY + RH - 40), { fuse: 20 + i * 12 }));
        break;
      case 'strength': p.roomDmg += 2; p.roomDmgMult = 1.3; break;
      case 'justice': for (const k of ['coin', 'bomb', 'key', 'heart']) G.room.pickups.push(makePickup(k, p.x, p.y)); break;
      case 'lovers': for (let i = 0; i < 2; i++) { const h = makePickup('heart', p.x, p.y); h.value = 2; G.room.pickups.push(h); } break;
      case 'emperor': teleportTo(f.boss); break;
    }
  }
}

function setupPills() {
  const ids = shuffle(Object.keys(PILLS)).slice(0, PILL_COLORS.length);
  G.pillPool = ids;
  G.pillColors = {};
  ids.forEach((id, i) => { G.pillColors[id] = PILL_COLORS[i]; });
  G.pillKnown = new Set();
}
