'use strict';
// ============================================================
//  Враги и боссы
// ============================================================

function hpScale(boss) {
  const s = G.stage;
  return boss ? 1 + 0.3 * (s - 1) : 1 + 0.16 * (s - 1);
}
function contactDmg() { return G.stage >= 7 ? 2 : 1; }
function canHit(e) { return !e.dead && !e.invuln && !e.hidden && e.z < 40 && !e.d.noHit; }
function countAlive(types) {
  let n = 0;
  for (const e of G.enemies) if (!e.dead && types.includes(e.type)) n++;
  return n;
}

class Enemy {
  constructor(type, x, y, o = {}) {
    const d = ENEMIES[type];
    this.type = type; this.d = d; this.name = d.name;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0; this.z = 0;
    this.r = d.r; this.flying = !!d.flying; this.boss = !!d.boss; this.manual = !!d.manual;
    const sc = o.hpScale != null ? o.hpScale : (d.fixedHp ? 1 : hpScale(this.boss));
    this.maxHp = this.hp = (o.hp != null ? o.hp : d.hp) * sc;
    this.champion = !!o.champion;
    if (this.champion) { this.maxHp *= 2; this.hp = this.maxHp; }
    this.t = randi(0, 30); this.st = 'idle'; this.timer = randi(30, 70); this.flash = 0; this.dead = false;
    this.spawn = o.noSpawn ? 0 : 22;
    this.dmg = contactDmg(); this.noClear = !!o.noClear; this.shareHp = o.shareHp || null; this.minionOf = o.minionOf || null;
    this.poison = 0; this.poisonDmg = 0; this.slow = 0; this.burn = 0; this.burnDmg = 0;
    this.invuln = false; this.hidden = false; this.alpha = 1; this.hitX = false; this.hitY = false;
    if (d.init) d.init(this, o);
  }
  get mul() { return (this.slow > 0 ? 0.5 : 1) * (G.slowT > 0 ? 0.45 : 1); }
  hitCircles() { return this.d.circles ? this.d.circles(this) : [this]; }

  update() {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.poison > 0) { this.poison--; if (this.poison % 20 === 0) hurtEnemy(this, this.poisonDmg, 0, 0, true); }
    if (this.burn > 0) { this.burn--; if (this.burn % 20 === 0) hurtEnemy(this, this.burnDmg, 0, 0, true); if (this.t % 4 === 0) addParticle(this.x + rand(-6, 6), this.y - 10, 0, -1, '#ff8a20', 3, 18); }
    if (this.slow > 0) this.slow--;
    if (this.dead) return;
    if (this.spawn > 0) { this.spawn--; return; }
    this.d.update(this);
    if (this.dead) return;
    if (!this.manual) {
      const m = this.mul;
      const res = moveCircle(this, this.vx * m + this.kx, this.vy * m + this.ky, this.flying || this.z > 6, false);
      this.hitX = res.hitX; this.hitY = res.hitY;
    }
    this.kx *= 0.78; this.ky *= 0.78;
  }

  draw(c) {
    if (this.hidden) return;
    const d = this.d;
    const hover = d.hover != null ? d.hover : (this.flying ? 14 : 0);
    if (!d.noShadow) {
      const k = 1 - Math.min(this.z, 300) / 400;
      shadow(c, this.x, this.y + this.r * 0.5, this.r * 0.95 * k, this.r * 0.38 * k, 0.32 * this.alpha);
    }
    c.save();
    let a = this.alpha;
    if (this.spawn > 0) {
      const k = 1 - this.spawn / 22;
      a *= k;
      const s = 0.4 + 0.6 * k;
      c.translate(this.x, this.y); c.scale(s, s); c.translate(-this.x, -this.y);
    }
    c.globalAlpha = a;
    FLASH = this.flash > 2;
    TINT = this.champion ? '#ff2020' : this.poison > 0 ? '#30c030' : this.burn > 0 ? '#ff7a10' : this.slow > 0 ? '#b8b8b8' : null;
    d.draw(c, this, this.x, this.y - hover - this.z);
    FLASH = false; TINT = null;
    c.restore();
  }
}

function hurtEnemy(e, dmg, kx = 0, ky = 0, silent = false) {
  if (e.dead || e.invuln) return false;
  const tgt = e.shareHp || e;
  if (tgt.dead) return false;
  tgt.hp -= dmg;
  e.flash = 6; tgt.flash = 6;
  const kb = (e.boss || e.d.heavy) ? 0.1 : 1;
  e.kx += kx * kb; e.ky += ky * kb;
  if (!silent) Sound.play('hit');
  if (tgt.hp <= 0) killEnemy(tgt);
  return true;
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.stats.kills++;
  const d = e.d;
  if (!d.noBlood) bloodBurst(e.x, e.y, e.boss ? 26 : 10, d.blood || '#8a1010');
  Sound.play('kill');
  if (e.champion) G.room.pickups.push(makePickup(chance(0.6) ? 'heart' : randomPickupKind(), e.x, e.y));
  if (d.onDeath) d.onDeath(e);
  for (const o of G.enemies) {
    if (o.dead) continue;
    if (o.shareHp === e) { o.dead = true; if (!o.d.noBlood) bloodBurst(o.x, o.y, 8); }
    else if (o.minionOf === e) killEnemy(o);
  }
  if (e.boss) G.shake = Math.max(G.shake, 12);
}

function enemyShot(x, y, a, sp = 4, o = {}) {
  G.tears.push(new Tear({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: o.z != null ? o.z : 14,
    dmg: o.dmg || contactDmg(), r: o.r || 6, life: o.life || 120, enemy: true,
    curve: o.curve || 0, accel: o.accel || 0, cause: o.cause || 'Вражеская слеза',
  }));
}

// ---------- помощники движения ----------
function steer(e, tx, ty, speed, acc = 0.15) {
  const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
  e.vx += (dx / l * speed - e.vx) * acc;
  e.vy += (dy / l * speed - e.vy) * acc;
}
function chase(e, speed, acc = 0.15) {
  if (e.flying) { steer(e, G.player.x, G.player.y, speed, acc); return; }
  const [tx, ty] = flowTarget(e);
  steer(e, tx, ty, speed, acc);
}
function wander(e, speed) {
  if (e.wa == null || e.t > e.wt || e.hitX || e.hitY) { e.wa = rand(0, Math.PI * 2); e.wt = e.t + randi(40, 100); }
  e.vx += (Math.cos(e.wa) * speed - e.vx) * 0.1;
  e.vy += (Math.sin(e.wa) * speed - e.vy) * 0.1;
}
function spawnMinion(type, x, y, owner, o = {}) {
  const m = new Enemy(type, x, y, Object.assign({ minionOf: owner, hpScale: 1 }, o));
  G.enemies.push(m);
  return m;
}

// ---------- помощники рисования ----------
function drawFly(c, e, x, y, col, r) {
  const f = Math.sin(e.t * 1.3) * 0.5;
  ellipse(c, x - r * 0.95, y - r * 0.85, r, r * 0.55, 'rgba(225,225,235,0.65)', null, 0, -0.5 + f);
  ellipse(c, x + r * 0.95, y - r * 0.85, r, r * 0.55, 'rgba(225,225,235,0.65)', null, 0, 0.5 - f);
  circle(c, x, y, r, fc(col), '#000', 1.2);
  circle(c, x - r * 0.35, y - r * 0.15, r * 0.22, '#d33');
  circle(c, x + r * 0.35, y - r * 0.15, r * 0.22, '#d33');
}
function hollowEyes(c, x, y, sp, r, bleed) {
  ellipse(c, x - sp, y, r * 0.85, r, '#120808');
  ellipse(c, x + sp, y, r * 0.85, r, '#120808');
  if (bleed) {
    line(c, x - sp, y + r, x - sp, y + r + 5, '#a01010', 1.6);
    line(c, x + sp, y + r, x + sp + 0.5, y + r + 4, '#a01010', 1.6);
  }
}
function pupilEye(c, x, y, r, e, look = true) {
  circle(c, x, y, r, '#f4efe8', OUT, 1.5);
  let px = 0, py = 0;
  if (look && G.player) { const a = angleTo({ x, y }, G.player); px = Math.cos(a) * r * 0.35; py = Math.sin(a) * r * 0.35; }
  circle(c, x + px, y + py, r * 0.5, '#111');
  circle(c, x + px - r * 0.15, y + py - r * 0.2, r * 0.15, '#fff');
}
function walkerBody(c, e, x, y, skin, sc = 1) {
  const mv = Math.hypot(e.vx, e.vy) > 0.2;
  const sw = mv ? Math.sin(e.t * 0.3) * 3 : 0;
  ellipse(c, x - 4 * sc + sw * 0.5, y + 6 * sc, 3.2 * sc, 3 * sc, fc(skin), OUT, 1.4);
  ellipse(c, x + 4 * sc - sw * 0.5, y + 6 * sc, 3.2 * sc, 3 * sc, fc(skin), OUT, 1.4);
  ellipse(c, x, y - 1 * sc, 7 * sc, 7 * sc, fc(skin), OUT, 1.5);
}

// ============================================================
//  Определения врагов
// ============================================================
const ENEMIES = {
  fly: {
    name: 'Муха', hp: 4, r: 7, flying: true, hover: 12, group: 2, blood: '#2a2a2a',
    update(e) {
      if (e.t % 16 === 0) e.wa = (e.wa || rand(0, 6)) + rand(-1.6, 1.6);
      const a = angleTo(e, G.player), w = e.wa || 0;
      const tx = Math.cos(a) * 0.45 + Math.cos(w) * 0.8, ty = Math.sin(a) * 0.45 + Math.sin(w) * 0.8;
      e.vx += (tx * 1.15 - e.vx) * 0.08;
      e.vy += (ty * 1.15 - e.vy) * 0.08;
    },
    draw(c, e, x, y) { drawFly(c, e, x, y, '#1c1c20', 6); },
  },
  attackFly: {
    name: 'Злая муха', hp: 6, r: 7, flying: true, hover: 12,
    update(e) {
      const a = angleTo(e, G.player) + Math.sin(e.t * 0.15) * 0.6;
      e.vx += (Math.cos(a) * 1.9 - e.vx) * 0.1;
      e.vy += (Math.sin(a) * 1.9 - e.vy) * 0.1;
    },
    draw(c, e, x, y) { drawFly(c, e, x, y, '#8a1414', 6.5); },
  },
  pooter: {
    name: 'Пузырник', hp: 9, r: 11, flying: true, hover: 14,
    init(e) { e.timer = randi(50, 110); e.wa = rand(0, 6); },
    update(e) {
      const p = G.player, d = dist(e, p), a = angleTo(e, p);
      if (e.t % 30 === 0) e.wa += rand(-1.2, 1.2);
      const tx = Math.cos(e.wa) * 0.6 + (d > 180 ? Math.cos(a) * 0.5 : 0);
      const ty = Math.sin(e.wa) * 0.6 + (d > 180 ? Math.sin(a) * 0.5 : 0);
      e.vx += (tx - e.vx) * 0.05; e.vy += (ty - e.vy) * 0.05;
      e.timer--;
      e.charging = e.timer < 18;
      if (e.timer <= 0) {
        if (d < 380) { enemyShot(e.x, e.y, a, 4); Sound.play('eShoot'); }
        e.timer = randi(80, 120);
      }
    },
    draw(c, e, x, y) {
      const s = e.charging ? 1 + Math.sin(e.t * 1.2) * 0.1 : 1;
      const f = Math.sin(e.t * 1.2) * 0.5;
      ellipse(c, x - 11, y - 9, 10, 5, 'rgba(225,225,235,0.6)', null, 0, -0.5 + f);
      ellipse(c, x + 11, y - 9, 10, 5, 'rgba(225,225,235,0.6)', null, 0, 0.5 - f);
      circle(c, x, y, 10 * s, fc('#8a685a'), OUT, 1.8);
      circle(c, x - 4, y - 4, 3, fc('#a8857a'));
      const a = angleTo({ x, y }, G.player);
      circle(c, x + Math.cos(a) * 4, y + 3 + Math.sin(a) * 2, e.charging ? 4 : 2.6, '#2a0a0a');
      circle(c, x - 4, y - 3, 1.8, '#111'); circle(c, x + 4, y - 3, 1.8, '#111');
    },
  },
  gaper: {
    name: 'Зевака', hp: 10, r: 11,
    update(e) { chase(e, 1.25, 0.12); },
    draw(c, e, x, y) {
      walkerBody(c, e, x, y, '#d39a86');
      const hy = y - 15;
      circle(c, x, hy, 10.5, fc('#d6a08c'), OUT, 2);
      hollowEyes(c, x, hy - 2, 4, 2.8, true);
      ellipse(c, x, hy + 5, 3.6, 3.2, '#1a0606');
    },
  },
  horf: {
    name: 'Голова', hp: 10, r: 12, manual: true, heavy: true,
    init(e) { e.timer = randi(40, 90); },
    update(e) {
      const p = G.player;
      e.timer--;
      e.shake = e.timer < 25;
      if (e.timer <= 0) {
        if (dist(e, p) < 430 && lineOfSight(e.x, e.y, p.x, p.y)) { enemyShot(e.x, e.y, angleTo(e, p), 4.6); Sound.play('eShoot'); }
        e.timer = randi(70, 100);
      }
    },
    draw(c, e, x, y) {
      const sx = e.shake ? rand(-1.5, 1.5) : 0;
      circle(c, x + sx, y - 6, 12, fc('#c4b2a2'), OUT, 2);
      line(c, x + sx - 7, y - 9, x + sx - 2, y - 8, '#1a0a0a', 2.2);
      line(c, x + sx + 2, y - 8, x + sx + 7, y - 9, '#1a0a0a', 2.2);
      ellipse(c, x + sx, y - 1, 4.5, e.shake ? 4.5 : 3.2, '#1a0606');
    },
  },
  clotty: {
    name: 'Сгусток', hp: 12, r: 12,
    init(e) { e.timer = randi(30, 60); e.st = 'rest'; e.shots = 0; },
    update(e) {
      e.timer--;
      if (e.st === 'rest') {
        e.vx *= 0.85; e.vy *= 0.85;
        if (e.timer <= 0) {
          e.st = 'move'; e.timer = randi(25, 40);
          const a = chance(0.5) ? angleTo(e, G.player) + rand(-0.8, 0.8) : rand(0, Math.PI * 2);
          e.mvx = Math.cos(a) * 1.6; e.mvy = Math.sin(a) * 1.6;
        }
      } else {
        if (e.hitX) e.mvx = -e.mvx;
        if (e.hitY) e.mvy = -e.mvy;
        e.vx = e.mvx; e.vy = e.mvy;
        if (e.timer <= 0) {
          e.st = 'rest'; e.timer = randi(30, 50);
          if (++e.shots % 2 === 0) {
            const off = chance(0.5) ? 0 : Math.PI / 4;
            for (let i = 0; i < 4; i++) enemyShot(e.x, e.y, off + i * Math.PI / 2, 3.4);
            Sound.play('eShoot');
          }
        }
      }
    },
    draw(c, e, x, y) {
      const w = Math.sin(e.t * 0.2) * 1.5;
      circle(c, x - 6, y - 2, 7 + w * 0.3, fc('#7e1818'), OUT, 1.5);
      circle(c, x + 6, y - 3, 7 - w * 0.3, fc('#7e1818'), OUT, 1.5);
      circle(c, x, y - 8, 9, fc('#951e1e'), OUT, 1.5);
      circle(c, x - 3, y - 11, 2.5, fc('#c84040'));
      circle(c, x - 3, y - 6, 1.7, '#fff'); circle(c, x + 3, y - 6, 1.7, '#fff');
    },
  },
  spider: {
    name: 'Паук', hp: 6, r: 8,
    init(e) { e.timer = randi(10, 40); e.st = 'rest'; },
    update(e) {
      e.timer--;
      if (e.st === 'rest') {
        e.vx *= 0.7; e.vy *= 0.7;
        if (e.timer <= 0) {
          e.st = 'dash'; e.timer = randi(12, 20);
          const a = angleTo(e, G.player) + rand(-1.1, 1.1);
          e.mvx = Math.cos(a) * 4; e.mvy = Math.sin(a) * 4;
        }
      } else {
        e.vx = e.mvx; e.vy = e.mvy;
        if (e.timer <= 0) { e.st = 'rest'; e.timer = randi(15, 45); }
      }
    },
    draw(c, e, x, y) {
      const m = e.st === 'dash' ? Math.sin(e.t * 1.5) * 3 : 0;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const ly = y - 6 + i * 3;
        const k = (i % 2 ? m : -m);
        line(c, x + s * 4, ly, x + s * 11, ly - 4 + k, '#1a1414', 1.6);
        line(c, x + s * 11, ly - 4 + k, x + s * 14, ly + 3 + k, '#1a1414', 1.6);
      }
      ellipse(c, x, y - 4, 7, 6, fc('#2c2222'), '#000', 1.2);
      circle(c, x, y - 1, 4, fc('#3a2c2c'), '#000', 1);
      circle(c, x - 1.5, y - 1, 1, '#e33'); circle(c, x + 1.5, y - 1, 1, '#e33');
    },
  },
  hopper: {
    name: 'Прыгун', hp: 10, r: 10,
    init(e) { e.timer = randi(20, 50); e.st = 'rest'; },
    update(e) {
      if (e.st === 'rest') {
        e.vx *= 0.6; e.vy *= 0.6;
        if (--e.timer <= 0) {
          const p = G.player;
          const tx = p.x + rand(-60, 60), ty = p.y + rand(-60, 60);
          const l = Math.min(Math.hypot(tx - e.x, ty - e.y), 150), a = Math.atan2(ty - e.y, tx - e.x);
          e.jt = 0; e.jd = 32; e.mvx = Math.cos(a) * l / e.jd; e.mvy = Math.sin(a) * l / e.jd; e.st = 'jump';
        }
      } else {
        e.jt++;
        e.z = Math.sin(e.jt / e.jd * Math.PI) * 26;
        e.vx = e.mvx; e.vy = e.mvy;
        if (e.jt >= e.jd) { e.z = 0; e.st = 'rest'; e.timer = randi(15, 35); }
      }
    },
    draw(c, e, x, y) {
      const air = e.z > 2;
      for (const s of [-1, 1]) {
        if (air) line(c, x + s * 4, y - 2, x + s * 6, y + 8, fc('#a07a66'), 3);
        else { line(c, x + s * 4, y - 2, x + s * 10, y - 8, fc('#a07a66'), 3); line(c, x + s * 10, y - 8, x + s * 8, y + 4, fc('#a07a66'), 3); }
      }
      circle(c, x, y - 6, 8.5, fc('#b88a74'), OUT, 1.8);
      hollowEyes(c, x, y - 8, 3.2, 2.2, false);
      line(c, x - 2.5, y - 2, x + 2.5, y - 2, '#1a0606', 1.5);
    },
  },
  fatty: {
    name: 'Толстяк', hp: 26, r: 15, heavy: true,
    update(e) { chase(e, 0.75, 0.08); },
    draw(c, e, x, y) {
      const mv = Math.hypot(e.vx, e.vy) > 0.2, sw = mv ? Math.sin(e.t * 0.25) * 2 : 0;
      ellipse(c, x - 7 + sw, y + 10, 4.5, 3.5, fc('#d8b4a2'), OUT, 1.5);
      ellipse(c, x + 7 - sw, y + 10, 4.5, 3.5, fc('#d8b4a2'), OUT, 1.5);
      ellipse(c, x, y - 2, 16, 14, fc('#e4c3b0'), OUT, 2);
      ellipse(c, x, y + 3, 11, 7, fc('#d6ae9a'));
      circle(c, x, y + 2, 1.4, '#7a4a3a');
      circle(c, x, y - 20, 8, fc('#e4c3b0'), OUT, 1.8);
      hollowEyes(c, x, y - 21, 3, 1.8, false);
      line(c, x - 2, y - 16, x + 2, y - 16, '#1a0606', 1.3);
    },
  },
  maggot: {
    name: 'Опарыш', hp: 7, r: 9,
    init(e) { e.dir = pick(DIR_NAMES); e.timer = randi(40, 120); },
    update(e) {
      e.timer--;
      if (e.hitX || e.hitY || e.timer <= 0) { e.dir = pick(DIR_NAMES.filter(d => d !== e.dir)); e.timer = randi(50, 140); }
      const [dx, dy] = DIRS[e.dir];
      e.vx = dx * 0.8; e.vy = dy * 0.8;
    },
    draw(c, e, x, y) {
      const [dx, dy] = DIRS[e.dir || 'down'];
      const wig = Math.sin(e.t * 0.25) * 1.5;
      for (let i = 2; i >= 0; i--) {
        const k = i * 7;
        circle(c, x - dx * k + (dy ? wig : 0) * (i % 2 ? 1 : -1), y - 4 - dy * k + (dx ? wig : 0) * (i % 2 ? 1 : -1), 7 - i * 1.2, fc(i ? '#e2d8bc' : '#efe6cc'), OUT, 1.4);
      }
      circle(c, x + dx * 3, y - 4 + dy * 3, 2, '#3a1a10');
    },
  },
  boomFly: {
    name: 'Бомбомуха', hp: 12, r: 10, flying: true, hover: 12,
    init(e) { const a = pick([1, 3, 5, 7]) * Math.PI / 4; e.vx = Math.cos(a) * 1.9; e.vy = Math.sin(a) * 1.9; },
    update(e) {
      if (e.hitX) e.vx = -e.vx;
      if (e.hitY) e.vy = -e.vy;
      const s = Math.hypot(e.vx, e.vy) || 1;
      e.vx = e.vx / s * 1.9; e.vy = e.vy / s * 1.9;
    },
    onDeath(e) { explode(e.x, e.y, { r: 62, dmg: 30, cause: 'Бомбомуха' }); },
    draw(c, e, x, y) {
      drawFly(c, e, x, y, '#cf5528', 9);
      line(c, x - 6, y + 1, x + 6, y + 1, '#7a2a10', 2);
      line(c, x - 5, y + 5, x + 5, y + 5, '#7a2a10', 2);
      circle(c, x - 3, y - 3, 1.8, '#ffe060'); circle(c, x + 3, y - 3, 1.8, '#ffe060');
    },
  },
  charger: {
    name: 'Таран', hp: 12, r: 10,
    init(e) { e.dir = pick(DIR_NAMES); e.timer = randi(40, 100); e.st = 'walk'; },
    update(e) {
      const p = G.player;
      if (e.st === 'walk') {
        e.timer--;
        if (e.hitX || e.hitY || e.timer <= 0) { e.dir = pick(DIR_NAMES); e.timer = randi(40, 100); }
        const [dx, dy] = DIRS[e.dir];
        e.vx = dx * 0.9; e.vy = dy * 0.9;
        const ax = Math.abs(p.x - e.x), ay = Math.abs(p.y - e.y);
        if ((ax < 16 || ay < 16) && Math.hypot(ax, ay) < 420 && lineOfSight(e.x, e.y, p.x, p.y)) {
          e.dir = ax < 16 ? (p.y > e.y ? 'down' : 'up') : (p.x > e.x ? 'right' : 'left');
          e.st = 'charge'; e.timer = 90; e.hitX = e.hitY = false;
          Sound.play('buzz');
        }
      } else if (e.st === 'charge') {
        const [dx, dy] = DIRS[e.dir];
        e.vx = dx * 5.5; e.vy = dy * 5.5;
        e.timer--;
        if ((e.timer < 88 && (e.hitX || e.hitY)) || e.timer <= 0) { e.st = 'stun'; e.timer = 35; e.vx = e.vy = 0; G.shake = Math.max(G.shake, 2); }
      } else {
        e.vx *= 0.5; e.vy *= 0.5;
        if (--e.timer <= 0) { e.st = 'walk'; e.hitX = e.hitY = false; }
      }
    },
    draw(c, e, x, y) {
      const [dx, dy] = DIRS[e.dir || 'down'];
      const ch = e.st === 'charge';
      for (let i = 3; i >= 0; i--) {
        const k = i * (ch ? 8 : 6.5);
        circle(c, x - dx * k, y - 4 - dy * k, 7.5 - i * 0.9, fc(i ? '#a8483a' : '#c25a48'), OUT, 1.5);
      }
      circle(c, x + dx * 3 - dy * 3, y - 6 + dy * 3 - dx * 1, 1.8, ch ? '#ff3' : '#111');
      circle(c, x + dx * 3 + dy * 3, y - 6 + dy * 3 + dx * 1, 1.8, ch ? '#ff3' : '#111');
    },
  },
  mulligan: {
    name: 'Наседка', hp: 14, r: 12,
    init(e) { e.timer = randi(120, 200); },
    update(e) {
      const p = G.player, d = dist(e, p);
      if (d < 170) {
        const a = angleTo(p, e) + Math.sin(e.t * 0.05) * 0.6;
        e.vx += (Math.cos(a) * 1.3 - e.vx) * 0.1; e.vy += (Math.sin(a) * 1.3 - e.vy) * 0.1;
      } else wander(e, 0.6);
      if (--e.timer <= 0) {
        if (countAlive(['fly']) < 6) { spawnMinion('fly', e.x, e.y, null); Sound.play('buzz'); }
        e.timer = randi(160, 240);
      }
    },
    onDeath(e) { for (let i = 0; i < 3; i++) G.enemies.push(new Enemy('attackFly', e.x + rand(-10, 10), e.y + rand(-10, 10), { noSpawn: true, hpScale: 1 })); },
    draw(c, e, x, y) {
      walkerBody(c, e, x, y + 4, '#a3a882');
      ellipse(c, x, y - 6, 12, 11, fc('#a9ae88'), OUT, 2);
      line(c, x - 6, y - 10, x - 2, y - 4, '#a03030', 1);
      line(c, x + 5, y - 12, x + 2, y - 2, '#a03030', 1);
      circle(c, x, y - 19, 6, fc('#b4b892'), OUT, 1.5);
      hollowEyes(c, x, y - 20, 2.4, 1.5, false);
      for (let i = 0; i < 3; i++) { const a = e.t * 0.2 + i * 2.1; circle(c, x + Math.cos(a) * 14, y - 18 + Math.sin(a) * 6, 1.6, '#111'); }
    },
  },
  sucker: {
    name: 'Сосун', hp: 8, r: 9, flying: true, hover: 14,
    update(e) {
      const a = angleTo(e, G.player) + Math.sin(e.t * 0.1) * 0.7;
      e.vx += (Math.cos(a) * 1.7 - e.vx) * 0.08;
      e.vy += (Math.sin(a) * 1.7 - e.vy) * 0.08;
    },
    onDeath(e) { for (let i = 0; i < 4; i++) enemyShot(e.x, e.y, i * Math.PI / 2 + Math.PI / 4, 3.5); },
    draw(c, e, x, y) {
      const a = angleTo({ x, y }, G.player);
      line(c, x, y, x + Math.cos(a) * 13, y + Math.sin(a) * 13, '#3a1a3a', 2.4);
      drawFly(c, e, x, y, '#6a3a6a', 8.5);
      circle(c, x, y + 2, 3, fc('#8a5a8a'));
    },
  },
  leaper: {
    name: 'Попрыгун', hp: 18, r: 12,
    init(e) { e.st = 'rest'; e.timer = randi(40, 80); },
    update(e) {
      if (e.st === 'rest') {
        chase(e, 0.6, 0.1);
        if (--e.timer <= 0) {
          const p = G.player;
          e.sx = e.x; e.sy = e.y;
          e.tx = clamp(p.x, RX + 20, RX + RW - 20); e.ty = clamp(p.y, RY + 20, RY + RH - 20);
          e.jt = 0; e.jd = 48; e.st = 'jump';
        }
      } else {
        e.jt++;
        e.z = Math.sin(e.jt / e.jd * Math.PI) * 90;
        e.vx = (e.tx - e.sx) / e.jd; e.vy = (e.ty - e.sy) / e.jd;
        if (e.jt >= e.jd) {
          e.z = 0; e.st = 'rest'; e.timer = randi(60, 100);
          for (let i = 0; i < 6; i++) enemyShot(e.x, e.y, i * Math.PI / 3 + 0.3, 3.4);
          Sound.play('stomp'); G.shake = Math.max(G.shake, 3);
        }
      }
    },
    draw(c, e, x, y) {
      const air = e.z > 3;
      for (const s of [-1, 1]) {
        if (air) line(c, x + s * 5, y, x + s * 7, y + 10, fc('#8a5a4a'), 4);
        else { line(c, x + s * 5, y, x + s * 13, y - 8, fc('#8a5a4a'), 4); line(c, x + s * 13, y - 8, x + s * 10, y + 6, fc('#8a5a4a'), 4); }
      }
      circle(c, x, y - 7, 11, fc('#9a6a58'), OUT, 2);
      hollowEyes(c, x, y - 10, 4, 2.6, true);
      ellipse(c, x, y - 2, 3.5, 2.5, '#1a0606');
    },
  },
  ghost: {
    name: 'Призрак', hp: 14, r: 11, flying: true, hover: 14,
    init(e) { e.st = 'vis'; e.timer = randi(100, 160); e.alpha = 0.85; },
    update(e) {
      const p = G.player;
      e.timer--;
      if (e.st === 'vis') {
        e.alpha = 0.85;
        steer(e, p.x, p.y, 0.8, 0.04);
        if (e.timer % 60 === 30 && dist(e, p) < 420) {
          const a = angleTo(e, p);
          for (const o of [-0.25, 0, 0.25]) enemyShot(e.x, e.y, a + o, 3.6);
          Sound.play('eShoot');
        }
        if (e.timer <= 0) { e.st = 'fade'; e.timer = 30; }
      } else if (e.st === 'fade') {
        e.alpha = e.timer / 30 * 0.85;
        e.invuln = e.timer < 15;
        e.vx *= 0.9; e.vy *= 0.9;
        if (e.timer <= 0) {
          const [c, r] = freeTileNear(randi(1, COLS - 2), randi(1, ROWS - 2), true);
          [e.x, e.y] = tileCenter(c, r);
          e.st = 'appear'; e.timer = 30;
        }
      } else {
        e.alpha = (1 - e.timer / 30) * 0.85;
        e.invuln = e.timer > 15;
        if (e.timer <= 0) { e.st = 'vis'; e.timer = randi(120, 180); e.invuln = false; }
      }
    },
    draw(c, e, x, y) {
      c.beginPath();
      c.moveTo(x - 11, y + 8);
      c.quadraticCurveTo(x - 13, y - 16, x, y - 16);
      c.quadraticCurveTo(x + 13, y - 16, x + 11, y + 8);
      for (let i = 0; i < 4; i++) {
        const xx = x + 11 - (i + 1) * 5.5;
        c.quadraticCurveTo(xx + 2.75, y + 8 + (i % 2 ? -4 : 4) + Math.sin(e.t * 0.2 + i) * 2, xx, y + 8);
      }
      c.closePath();
      c.fillStyle = fc('#e8ecf4'); c.fill(); c.strokeStyle = 'rgba(40,40,60,0.8)'; c.lineWidth = 1.5; c.stroke();
      ellipse(c, x - 4, y - 5, 2.5, 3.5, '#111'); ellipse(c, x + 4, y - 5, 2.5, 3.5, '#111');
      ellipse(c, x, y + 2, 2.5, 2.8, '#222');
    },
  },
  roundworm: {
    name: 'Землерой', hp: 12, r: 10, manual: true, heavy: true,
    init(e) { e.st = 'under'; e.timer = randi(30, 70); e.hidden = true; e.invuln = true; },
    update(e) {
      e.timer--;
      const p = G.player;
      if (e.st === 'under') {
        e.hidden = true; e.invuln = true;
        if (e.timer <= 0) {
          const [pc, pr] = tileOf(p.x, p.y);
          let best = null;
          for (let i = 0; i < 20 && !best; i++) {
            const c = pc + randi(-4, 4), r = pr + randi(-3, 3);
            const t = G.room.tile(c, r);
            if (!t || t.t !== '.') continue;
            const [x, y] = tileCenter(c, r);
            const d = Math.hypot(x - p.x, y - p.y);
            if (d > 90 && d < 260) best = [x, y];
          }
          if (best) { [e.x, e.y] = best; e.st = 'rise'; e.timer = 20; e.hidden = false; }
          else e.timer = 20;
        }
      } else if (e.st === 'rise') {
        if (e.timer <= 0) { e.st = 'up'; e.timer = 70; e.invuln = false; }
      } else if (e.st === 'up') {
        if (e.timer === 45) {
          const a = angleTo(e, p);
          const n = G.stage >= 5 ? 3 : 1;
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y - 10, a + (i - (n - 1) / 2) * 0.25, 4);
          Sound.play('eShoot');
        }
        if (e.timer <= 0) { e.st = 'down'; e.timer = 20; e.invuln = true; }
      } else if (e.timer <= 0) { e.st = 'under'; e.timer = randi(40, 80); e.hidden = true; }
    },
    draw(c, e, x, y) {
      ellipse(c, x, y + 4, 13, 6, '#1a0f0a', 'rgba(0,0,0,0.5)', 1.5);
      let k = 1;
      if (e.st === 'rise') k = 1 - e.timer / 20;
      if (e.st === 'down') k = e.timer / 20;
      const h = 22 * k;
      if (h < 1) return;
      c.save();
      c.beginPath(); c.rect(x - 20, y - 40, 40, 44); c.clip();
      rrect(c, x - 7, y + 4 - h, 14, h + 4, 7, fc('#d48888'), OUT, 1.6);
      circle(c, x, y + 4 - h + 5, 2.5, '#3a0a0a');
      circle(c, x - 3, y + 4 - h + 1, 1.3, '#111'); circle(c, x + 3, y + 4 - h + 1, 1.3, '#111');
      c.restore();
    },
  },

  // ======================= БОССЫ =======================
  monstro: {
    name: 'Толстун', hp: 260, r: 34, boss: true,
    init(e) { e.st = 'idle'; e.timer = 50; },
    update(e) {
      const p = G.player;
      e.timer--;
      const setHop = () => {
        const a = angleTo(e, p), l = Math.min(dist(e, p), 110);
        e.jd = 34; e.jt = 0; e.mvx = Math.cos(a) * l / e.jd; e.mvy = Math.sin(a) * l / e.jd;
      };
      switch (e.st) {
        case 'idle':
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.timer <= 0) {
            const r = Math.random();
            if (r < 0.5) { e.st = 'hop'; e.hops = randi(1, 3); setHop(); }
            else if (r < 0.8) { e.st = 'spit'; e.timer = 55; }
            else { e.st = 'jump'; e.jt = 0; }
          }
          break;
        case 'hop':
          e.jt++;
          e.z = Math.sin(e.jt / e.jd * Math.PI) * 30;
          e.vx = e.mvx; e.vy = e.mvy;
          if (e.jt >= e.jd) {
            e.z = 0; Sound.play('stomp'); G.shake = Math.max(G.shake, 4);
            if (--e.hops > 0) setHop(); else { e.st = 'idle'; e.timer = randi(25, 45); }
          }
          break;
        case 'spit':
          e.vx *= 0.7; e.vy *= 0.7;
          e.mouth = e.timer < 40;
          if (e.timer === 22) {
            const a = angleTo(e, p);
            for (let i = 0; i < 14; i++) enemyShot(e.x, e.y + 6, a + rand(-0.45, 0.45), rand(2.6, 5.8), { r: rand(5, 8), life: randi(60, 110), cause: 'Толстун' });
            Sound.play('spit');
          }
          if (e.timer <= 0) { e.st = 'idle'; e.mouth = false; e.timer = randi(40, 60); }
          break;
        case 'jump':
          e.jt++;
          if (e.jt < 25) { e.z = e.jt * e.jt * 0.9; e.vx = e.vy = 0; }
          else if (e.jt < 85) { e.z = 600; steer(e, p.x, p.y, 3.5, 0.2); }
          else if (e.jt < 105) { const k = (105 - e.jt) / 20; e.z = k * k * 600; e.vx *= 0.5; e.vy *= 0.5; }
          else {
            e.z = 0; e.st = 'idle'; e.timer = 50;
            Sound.play('stomp'); G.shake = 12;
            for (let i = 0; i < 10; i++) enemyShot(e.x, e.y, i / 10 * Math.PI * 2, 3.5, { cause: 'Толстун' });
            if (dist(e, p) < e.r + 22) p.hurt(2, 'Толстун');
          }
          break;
      }
    },
    draw(c, e, x, y) {
      const sq = e.z < 2 && e.st === 'hop' ? 1.06 : 1;
      ellipse(c, x, y - 18, 37 * sq, 32 / sq, fc('#c9a296'), OUT, 3);
      ellipse(c, x, y - 6, 30, 16, fc('#b58a80'));
      circle(c, x - 22, y - 38, 6, fc('#d4b0a4'));
      circle(c, x + 18, y - 42, 5, fc('#d4b0a4'));
      pupilEye(c, x - 13, y - 30, 7.5, e);
      pupilEye(c, x + 12, y - 28, 5.5, e);
      if (e.mouth) {
        ellipse(c, x, y - 8, 17, 13, '#2a0606', OUT, 2);
        for (let i = -2; i <= 2; i++) poly(c, [x + i * 6 - 3, y - 19, x + i * 6 + 3, y - 19, x + i * 6, y - 13], '#f0e8d8');
      } else {
        c.beginPath(); c.moveTo(x - 16, y - 8); c.quadraticCurveTo(x, y - 14, x + 16, y - 8);
        c.strokeStyle = '#2a0606'; c.lineWidth = 3; c.stroke();
      }
    },
  },
  duke: {
    name: 'Князь Мух', hp: 240, r: 30, boss: true, flying: true, hover: 18,
    init(e) { const a = pick([1, 3, 5, 7]) * Math.PI / 4; e.vx = Math.cos(a) * 1.1; e.vy = Math.sin(a) * 1.1; e.timer = 100; e.belch = 0; },
    update(e) {
      if (e.hitX) e.vx = -e.vx;
      if (e.hitY) e.vy = -e.vy;
      const sp = e.hp < e.maxHp / 2 ? 1.6 : 1.1;
      const s = Math.hypot(e.vx, e.vy) || 1;
      e.vx = e.vx / s * sp; e.vy = e.vy / s * sp;
      if (e.belch > 0) e.belch--;
      if (--e.timer <= 0) {
        e.belch = 24;
        if (countAlive(['fly', 'attackFly']) < 6 && chance(0.7)) {
          for (let i = 0; i < 3; i++) spawnMinion(chance(0.6) ? 'attackFly' : 'fly', e.x + rand(-20, 20), e.y + rand(-10, 20), e, { noSpawn: true });
          Sound.play('buzz');
        } else {
          for (let i = 0; i < 10; i++) enemyShot(e.x, e.y, i / 10 * Math.PI * 2, 3.2, { cause: 'Князь Мух' });
          Sound.play('spit');
        }
        e.timer = randi(110, 150);
      }
    },
    draw(c, e, x, y) {
      const f = Math.sin(e.t * 1.1) * 0.4;
      ellipse(c, x - 30, y - 18, 22, 11, 'rgba(225,225,235,0.6)', 'rgba(0,0,0,0.3)', 1, -0.4 + f);
      ellipse(c, x + 30, y - 18, 22, 11, 'rgba(225,225,235,0.6)', 'rgba(0,0,0,0.3)', 1, 0.4 - f);
      const s = e.belch > 0 ? 1 + Math.sin(e.belch * 0.5) * 0.06 : 1;
      circle(c, x, y, 30 * s, fc('#6f5638'), OUT, 3);
      ellipse(c, x, y + 8, 20, 14, fc('#8a7050'));
      for (const [dx, dy, r] of [[-16, -14, 4], [12, -18, 3], [20, 4, 3.5], [-20, 8, 3]]) circle(c, x + dx, y + dy, r, fc('#5a4428'));
      pupilEye(c, x - 10, y - 6, 6.5, e);
      pupilEye(c, x + 10, y - 6, 6.5, e);
      ellipse(c, x, y + 10, e.belch > 0 ? 10 : 7, e.belch > 0 ? 8 : 3, '#1a0a04');
    },
  },
  worm: {
    name: 'Глист', hp: 300, r: 15, boss: true, manual: true,
    init(e) {
      const [c, r] = tileOf(e.x, e.y);
      [e.x, e.y] = tileCenter(c, r);
      e.dir = pick(DIR_NAMES); e.hist = [{ x: e.x, y: e.y }]; e.segs = []; e.n = 9; e.timer = 110;
      wormNext(e);
    },
    update(e) {
      const sp = (e.hp < e.maxHp / 2 ? 2.9 : 2.1) * e.mul;
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d <= sp) { e.x = e.tx; e.y = e.ty; wormNext(e); }
      else { e.x += dx / d * sp; e.y += dy / d * sp; }
      e.hist.unshift({ x: e.x, y: e.y });
      if (e.hist.length > 500) e.hist.pop();
      e.segs.length = 0;
      let acc = 0, need = 22;
      for (let i = 1; i < e.hist.length && e.segs.length < e.n; i++) {
        acc += Math.hypot(e.hist[i].x - e.hist[i - 1].x, e.hist[i].y - e.hist[i - 1].y);
        if (acc >= need) { e.segs.push(e.hist[i]); need += 22; }
      }
      if (e.hp < e.maxHp * 0.6 && --e.timer <= 0) {
        const a = angleTo(e, G.player);
        for (const o of [-0.25, 0, 0.25]) enemyShot(e.x, e.y, a + o, 3.8, { cause: 'Глист' });
        Sound.play('spit');
        e.timer = 110;
      }
    },
    circles(e) {
      const out = [{ x: e.x, y: e.y, r: 15 }];
      for (const s of e.segs) out.push({ x: s.x, y: s.y, r: 13 });
      return out;
    },
    draw(c, e, x, y) {
      for (let i = e.segs.length - 1; i >= 0; i--) {
        const s = e.segs[i];
        shadow(c, s.x, s.y + 8, 12, 4, 0.3);
        circle(c, s.x, s.y - 8, 13 - i * 0.35, fc(i % 2 ? '#c06666' : '#cc7272'), OUT, 2);
        ellipse(c, s.x - 4, s.y - 13, 4, 2.5, fc('#e09a9a'));
      }
      circle(c, x, y - 8, 15, fc('#d27a7a'), OUT, 2.5);
      const [dx, dy] = DIRS[e.dir];
      circle(c, x + dx * 6 - dy * 5, y - 12 + dy * 4 - dx * 0, 3, '#fff', OUT, 1);
      circle(c, x + dx * 6 + dy * 5, y - 12 + dy * 4, 3, '#fff', OUT, 1);
      circle(c, x + dx * 7 - dy * 5, y - 12 + dy * 5, 1.4, '#111');
      circle(c, x + dx * 7 + dy * 5, y - 12 + dy * 5, 1.4, '#111');
      circle(c, x + dx * 10, y - 6 + dy * 8, 4, '#3a0808');
    },
  },
  geminiBig: {
    name: 'Близнецы', hp: 170, r: 24, boss: true,
    init(e) { e.timer = 120; e.st = 'walk'; },
    update(e) {
      const p = G.player;
      if (e.st === 'walk') {
        chase(e, e.partnerDead ? 1.5 : 1.0, 0.1);
        if (--e.timer <= 0) {
          e.st = 'charge'; e.timer = 34; e.hitX = e.hitY = false;
          const a = angleTo(e, p);
          e.mvx = Math.cos(a) * 4.2; e.mvy = Math.sin(a) * 4.2;
          Sound.play('roar');
        }
      } else {
        e.vx = e.mvx; e.vy = e.mvy;
        if (--e.timer <= 0 || (e.timer < 32 && (e.hitX || e.hitY))) { e.st = 'walk'; e.timer = randi(110, 160); }
      }
    },
    onDeath(e) { if (e.partner) e.partner.partnerDead = true; },
    draw(c, e, x, y) {
      const pt = e.partner;
      if (pt && !pt.dead) {
        const px = pt.x, py = pt.y - 10;
        c.beginPath(); c.moveTo(x, y - 12);
        c.quadraticCurveTo((x + px) / 2 + Math.sin(e.t * 0.1) * 12, (y + py) / 2 + 20, px, py);
        c.strokeStyle = '#8a2a3a'; c.lineWidth = 5; c.stroke();
        c.strokeStyle = '#c45a6a'; c.lineWidth = 2.5; c.stroke();
      }
      walkerBody(c, e, x, y + 2, '#c98a76', 1.9);
      circle(c, x, y - 26, 17, fc('#d79a86'), OUT, 2.5);
      line(c, x - 11, y - 34, x - 3, y - 30, '#1a0606', 2.5);
      line(c, x + 11, y - 34, x + 3, y - 30, '#1a0606', 2.5);
      circle(c, x - 6, y - 28, 2.5, '#111'); circle(c, x + 6, y - 28, 2.5, '#111');
      ellipse(c, x, y - 18, 8, e.st === 'charge' ? 6 : 4, '#2a0606');
      for (let i = -2; i <= 2; i++) poly(c, [x + i * 3 - 1.5, y - 21, x + i * 3 + 1.5, y - 21, x + i * 3, y - 18], '#f0e8d8');
    },
  },
  geminiSmall: {
    name: 'Близнецы', hp: 100, r: 13, boss: true, flying: true, hover: 10,
    init(e) { e.timer = 70; },
    update(e) {
      const big = e.partner && !e.partner.dead ? e.partner : null, p = G.player;
      if (big) {
        const a = e.t * 0.03;
        steer(e, big.x + Math.cos(a) * 75, big.y + Math.sin(a) * 50, 2.2, 0.08);
        if (--e.timer <= 0) {
          const a2 = angleTo(e, p), n = G.stage >= 3 ? 3 : 1;
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y, a2 + (i - (n - 1) / 2) * 0.2, 4, { cause: 'Близнецы' });
          Sound.play('eShoot');
          e.timer = 75;
        }
      } else steer(e, p.x, p.y, 2.4, 0.06);
    },
    onDeath(e) { if (e.partner) e.partner.partnerDead = true; },
    draw(c, e, x, y) {
      circle(c, x, y, 13, fc('#e8b7a6'), OUT, 2);
      ellipse(c, x - 4.5, y - 1, 2.6, 3.4, '#111'); ellipse(c, x + 4.5, y - 1, 2.6, 3.4, '#111');
      circle(c, x - 5.3, y - 2.2, 0.9, '#fff'); circle(c, x + 3.7, y - 2.2, 0.9, '#fff');
      ellipse(c, x, y + 6, 3, 2, '#3a0a0a');
    },
  },
  famine: {
    name: 'Голод', hp: 280, r: 24, boss: true, flying: true, hover: 16,
    init(e) { e.st = 'float'; e.timer = 140; e.shoot = 40; },
    update(e) {
      const p = G.player;
      if (e.st === 'float') {
        if (!e.wt || e.t > e.wt) { e.wx = rand(RX + 80, RX + RW - 80); e.wy = rand(RY + 60, RY + RH - 60); e.wt = e.t + 90; }
        steer(e, e.wx, e.wy, 1.3, 0.05);
        if (--e.shoot <= 0) {
          const a = angleTo(e, p);
          enemyShot(e.x, e.y, a, 4.4, { cause: 'Голод' });
          if (e.hp < e.maxHp / 2) { enemyShot(e.x, e.y, a - 0.3, 4.4); enemyShot(e.x, e.y, a + 0.3, 4.4); }
          Sound.play('eShoot');
          e.shoot = 45;
        }
        if (e.hp < e.maxHp / 2 && e.t % 220 === 0 && countAlive(['attackFly']) < 4) {
          for (let i = 0; i < 2; i++) spawnMinion('attackFly', e.x, e.y, e, { noSpawn: true });
          Sound.play('buzz');
        }
        if (--e.timer <= 0) { e.st = 'prep'; e.side = e.x < RX + RW / 2 ? -1 : 1; e.timer = 70; e.charges = 2; }
      } else if (e.st === 'prep') {
        const tx = e.side < 0 ? RX + 40 : RX + RW - 40;
        steer(e, tx, p.y, 4, 0.15);
        if (--e.timer <= 0 || (Math.abs(e.x - tx) < 12 && Math.abs(e.y - p.y) < 20)) {
          e.st = 'charge'; e.timer = 100; e.hitX = false;
          Sound.play('roar');
        }
      } else {
        e.vx = -e.side * 7; e.vy = 0;
        if ((e.hitX && e.timer < 96) || --e.timer <= 0) {
          G.shake = Math.max(G.shake, 5);
          if (--e.charges > 0) { e.side = -e.side; e.st = 'prep'; e.timer = 50; }
          else { e.st = 'float'; e.timer = 160; }
        }
      }
    },
    draw(c, e, x, y) {
      const fl = e.vx < 0 ? -1 : 1;
      const gal = Math.sin(e.t * 0.3) * 3;
      for (const k of [-1, 1]) {
        line(c, x + k * 12, y + 6, x + k * 14 + gal * k, y + 20, '#1a181c', 4);
        line(c, x + k * 5, y + 8, x + k * 4 - gal * k, y + 21, '#1a181c', 4);
      }
      ellipse(c, x, y + 4, 22, 12, fc('#2c2a30'), '#000', 2);
      ellipse(c, x + fl * 22, y - 4, 9, 7, fc('#2c2a30'), '#000', 2);
      circle(c, x + fl * 25, y - 6, 1.8, '#ff3030');
      poly(c, [x - 10, y - 2, x + 10, y - 2, x + 7, y - 30, x - 7, y - 30], fc('#3e2c3a'), '#000', 2);
      circle(c, x, y - 30, 9, fc('#3e2c3a'), '#000', 2);
      circle(c, x + fl * 2, y - 29, 6, '#e8e2d4');
      circle(c, x + fl * 2 - 2.2, y - 30, 1.6, '#111'); circle(c, x + fl * 2 + 2.2, y - 30, 1.6, '#111');
      for (let i = 0; i < 4; i++) { const a = e.t * 0.15 + i * 1.57; circle(c, x + Math.cos(a) * 30, y - 20 + Math.sin(a) * 10, 1.8, '#111'); }
    },
  },
  blob: {
    name: 'Кровавый Слизень', hp: 110, r: 38, boss: true, blood: '#a01020',
    init(e, o) {
      e.size = o.size != null ? o.size : 3;
      const S = BLOB_SIZES[e.size];
      e.r = S.r;
      if (o.size != null) { e.maxHp = e.hp = S.hp * hpScale(true); }
      e.st = 'rest'; e.timer = o.size != null ? randi(45, 70) : randi(40, 70);
    },
    update(e) {
      if (e.st === 'rest') {
        e.vx *= 0.8; e.vy *= 0.8;
        if (--e.timer <= 0) {
          const p = G.player;
          const a = angleTo(e, p) + rand(-0.5, 0.5), l = Math.min(dist(e, p), 50 + e.size * 22);
          e.jd = 32 + e.size * 6; e.jt = 0; e.mvx = Math.cos(a) * l / e.jd; e.mvy = Math.sin(a) * l / e.jd; e.st = 'jump';
        }
      } else {
        e.jt++;
        e.z = Math.sin(e.jt / e.jd * Math.PI) * (18 + e.size * 12);
        e.vx = e.mvx; e.vy = e.mvy;
        if (e.jt >= e.jd) {
          e.z = 0; e.st = 'rest'; e.timer = randi(45, 75) + e.size * 6;
          // только самый большой слизень разбрасывает кольцо снарядов
          if (e.size >= 3) { const n = 6, off = rand(0, Math.PI); for (let i = 0; i < n; i++) enemyShot(e.x, e.y, i / n * Math.PI * 2 + off, 2.6, { cause: 'Кровавый Слизень' }); }
          if (e.size >= 1) Sound.play('stomp');
          G.shake = Math.max(G.shake, e.size * 2);
        }
      }
    },
    pending(e) { return blobPending(e.size) * hpScale(true); },
    onDeath(e) {
      // самые мелкие (размер 1) больше не делятся
      if (e.size > 1) for (const s of [-1, 1]) {
        const b = new Enemy('blob', e.x + s * e.r * 0.6, e.y, { size: e.size - 1, noSpawn: true });
        b.kx = s * 4;
        G.enemies.push(b);
      }
    },
    draw(c, e, x, y) {
      const r = e.r;
      const sq = e.st === 'rest' ? 1 + Math.sin(e.t * 0.2) * 0.04 : 0.92;
      ellipse(c, x, y - r * 0.6, r * sq, r * 0.85 / sq, fc('#b01c2a'), OUT, 2.5);
      ellipse(c, x - r * 0.35, y - r * 0.95, r * 0.28, r * 0.16, fc('#e2606a'));
      circle(c, x - r * 0.3, y - r * 0.6, Math.max(1.5, r * 0.12), '#1a0404');
      circle(c, x + r * 0.3, y - r * 0.6, Math.max(1.5, r * 0.12), '#1a0404');
    },
  },
  mom: {
    name: 'Мама', hp: 750, r: 1, boss: true, manual: true, noShadow: true, contact: false, noHit: true, noBlood: true, fixedHp: true,
    init(e) { e.timer = 60; e.part = null; e.x = RX + RW / 2; e.y = RY + RH / 2; },
    update(e) {
      if (e.part && e.part.dead) e.part = null;
      if (e.part || --e.timer > 0) return;
      const rage = e.hp < e.maxHp * 0.5;
      const r = Math.random();
      const side = pick(DIR_NAMES);
      const [sx, sy] = momSlot(side);
      if (r < 0.45) e.part = spawnPart('momFoot', G.player.x, G.player.y, e, {});
      else if (r < 0.7) e.part = spawnPart('momEye', sx, sy, e, { side });
      else if (r < 0.88) e.part = spawnPart('momHand', sx, sy, e, { side });
      else {
        if (countAlive(['gaper', 'attackFly', 'pooter', 'fatty']) < 5) {
          for (let i = 0; i < 2; i++) spawnMinion(pick(['gaper', 'attackFly', 'pooter', 'fatty']), sx + rand(-10, 10), sy + rand(-10, 10), e);
          Sound.play('roar');
        }
      }
      e.timer = rage ? 18 : 40;
    },
    draw() {},
  },
  momFoot: {
    name: 'Мама', hp: 1, r: 44, manual: true, heavy: true, noShadow: true, contact: false, noBlood: true,
    init(e) { e.st = 'aim'; e.timer = 70; e.z = 500; },
    update(e) {
      const p = G.player;
      e.timer--;
      if (e.st === 'aim') {
        if (e.timer > 22) { e.x += clamp(p.x - e.x, -4.5, 4.5); e.y += clamp(p.y - e.y, -4.5, 4.5); }
        if (e.timer <= 0) { e.st = 'fall'; e.timer = 8; }
      } else if (e.st === 'fall') {
        e.z = e.timer / 8 * 500;
        if (e.timer <= 0) {
          e.z = 0; e.st = 'down'; e.timer = 55;
          Sound.play('stomp'); G.shake = 14;
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 8) p.hurt(2, 'Нога Мамы');
          if (e.shareHp && e.shareHp.hp < e.shareHp.maxHp * 0.5) for (let i = 0; i < 8; i++) enemyShot(e.x, e.y, i * Math.PI / 4, 3.4, { cause: 'Мама' });
        }
      } else if (e.st === 'down') {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < e.r + p.r && d > 0.1) { p.x = e.x + (p.x - e.x) / d * (e.r + p.r); p.y = e.y + (p.y - e.y) / d * (e.r + p.r); collideWalls(p, true); }
        if (e.timer <= 0) { e.st = 'up'; e.timer = 22; }
      } else {
        e.z = (1 - e.timer / 22) * 500;
        if (e.timer <= 0) e.dead = true;
      }
    },
    draw(c, e) {
      const k = clamp(1 - e.z / 500, 0, 1);
      shadow(c, e.x, e.y, e.r * (0.4 + 0.6 * k), e.r * 0.45 * (0.4 + 0.6 * k), 0.2 + 0.35 * k);
      if (e.st === 'aim') return;
      const fy = e.y - e.z - 6;
      c.fillStyle = fc('#e2b49e'); c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.rect(e.x - 30, -20, 60, fy + 20 - 10); c.fill(); c.stroke();
      ellipse(c, e.x, fy, 48, 26, fc('#e8bca6'), OUT, 3);
      for (let i = -2; i <= 2; i++) circle(c, e.x + i * 12, fy + 20, 7, fc('#e8bca6'), OUT, 2);
      ellipse(c, e.x - 16, fy - 8, 12, 5, fc('#f4d4c4'));
    },
  },
  momEye: {
    name: 'Мама', hp: 1, r: 22, manual: true, heavy: true, noShadow: true, contact: false,
    init(e, o) { e.side = o.side; e.timer = 170; e.shootT = 40; },
    update(e) {
      e.timer--;
      const p = G.player;
      if (e.timer < 150 && e.timer > 20 && --e.shootT <= 0) {
        const a = angleTo(e, p);
        for (const o of [-0.22, 0, 0.22]) enemyShot(e.x, e.y, a + o, 4.2, { cause: 'Мама' });
        Sound.play('eShoot');
        e.shootT = 45;
      }
      e.invuln = e.timer > 150 || e.timer < 12;
      if (e.timer <= 0) e.dead = true;
    },
    draw(c, e, x, y) {
      const open = e.timer > 150 ? (170 - e.timer) / 20 : e.timer < 20 ? e.timer / 20 : 1;
      c.save();
      c.translate(x, y);
      c.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[e.side]);
      rrect(c, -30, -28, 60, 34, 8, '#0a0505');
      ellipse(c, 0, -10, 24, 15 * open, fc('#f2eae0'), OUT, 2);
      if (open > 0.3) {
        const a = angleTo(e, G.player) - { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[e.side];
        circle(c, Math.cos(a) * 7, -10 + Math.sin(a) * 5, 9 * Math.min(1, open), '#6a3a1a');
        circle(c, Math.cos(a) * 7, -10 + Math.sin(a) * 5, 4.5 * Math.min(1, open), '#111');
      }
      line(c, -20, -12, -12, -10, '#c03030', 1); line(c, 18, -8, 10, -11, '#c03030', 1);
      c.restore();
    },
  },
  momHand: {
    name: 'Мама', hp: 1, r: 22, manual: true, heavy: true, noShadow: true,
    init(e, o) { e.side = o.side; e.bx = e.x; e.by = e.y; e.timer = 120; e.a = null; },
    update(e) {
      const p = G.player;
      const t = 120 - e.timer;
      if (e.a == null) {
        const [dx, dy] = DIRS[OPP[e.side]];
        const base = Math.atan2(dy, dx);
        e.a = base + clamp(angDiff(base, angleTo({ x: e.bx, y: e.by }, p)), -1, 1);
        e.reach = clamp(Math.hypot(p.x - e.bx, p.y - e.by), 60, 190);
      }
      let ext;
      if (t < 30) ext = t / 30; else if (t < 80) ext = 1; else ext = Math.max(0, (120 - t) / 40);
      e.x = e.bx + Math.cos(e.a) * e.reach * ext;
      e.y = e.by + Math.sin(e.a) * e.reach * ext;
      if (--e.timer <= 0) e.dead = true;
    },
    draw(c, e, x, y) {
      line(c, e.bx, e.by, x, y, OUT, 26);
      line(c, e.bx, e.by, x, y, fc('#e2b49e'), 21);
      c.save(); c.translate(x, y); c.rotate(e.a || 0);
      ellipse(c, 0, 0, 20, 18, fc('#e8bca6'), OUT, 2.5);
      for (let i = -1.5; i <= 1.5; i++) ellipse(c, 18, i * 8, 10, 4, fc('#e8bca6'), OUT, 2);
      ellipse(c, 2, -20, 9, 4, fc('#e8bca6'), OUT, 2, -0.6);
      c.restore();
    },
  },
  heart: {
    name: 'Сердце Мамы', hp: 1300, r: 44, boss: true, manual: true, heavy: true, fixedHp: true,
    init(e) { e.timer = 80; e.pat = null; e.pt = 0; e.y = RY + RH / 2 - 10; },
    update(e) {
      const p = G.player;
      const rage = e.hp < e.maxHp * 0.45;
      if (!e.pat) {
        if (--e.timer <= 0) { e.pat = pick(rage ? ['ring', 'spiral', 'spiral', 'aimed', 'summon'] : ['ring', 'spiral', 'aimed', 'summon']); e.pt = 0; }
        return;
      }
      e.pt++;
      const end = () => { e.pat = null; e.timer = rage ? 35 : 65; };
      switch (e.pat) {
        case 'ring':
          if (e.pt === 1 || e.pt === 25 || e.pt === 50) {
            const n = rage ? 20 : 16, off = e.pt === 25 ? Math.PI / n : 0;
            for (let i = 0; i < n; i++) enemyShot(e.x, e.y, i / n * Math.PI * 2 + off, 3, { dmg: 2, cause: 'Сердце Мамы' });
            Sound.play('spit');
          }
          if (e.pt > 60) end();
          break;
        case 'spiral':
          if (e.pt % 5 === 0) {
            const arms = rage ? 3 : 2;
            for (let i = 0; i < arms; i++) enemyShot(e.x, e.y, e.pt * 0.19 + i * Math.PI * 2 / arms, 3.2, { dmg: 2, cause: 'Сердце Мамы' });
            Sound.play('eShoot');
          }
          if (e.pt > 130) end();
          break;
        case 'aimed':
          if (e.pt === 1 || e.pt === 22 || e.pt === 44) {
            const a = angleTo(e, p);
            for (let i = -2; i <= 2; i++) enemyShot(e.x, e.y, a + i * 0.16, 4.6, { dmg: 2, cause: 'Сердце Мамы' });
            Sound.play('spit');
          }
          if (e.pt > 55) end();
          break;
        case 'summon':
          if (e.pt === 1 && countAlive(['clotty', 'sucker']) < 4) {
            for (let i = 0; i < 2; i++) spawnMinion(pick(['clotty', 'sucker']), e.x + rand(-80, 80), e.y + rand(50, 90), e);
            Sound.play('roar');
          }
          if (e.pt > 30) end();
          break;
      }
    },
    draw(c, e, x, y) {
      const per = e.hp < e.maxHp * 0.45 ? 40 : 60;
      const ph = (e.t % per) / per;
      const beat = ph < 0.15 ? Math.sin(ph / 0.15 * Math.PI) * 0.08 : 0;
      const s = 1 + beat;
      c.save(); c.translate(x, y - 20); c.scale(s, s);
      line(c, -14, -36, -20, -60, OUT, 16); line(c, -14, -36, -20, -60, fc('#9a2a3a'), 12);
      line(c, 12, -36, 22, -62, OUT, 14); line(c, 12, -36, 22, -62, fc('#3a4a9a'), 10);
      heartPath(c, 0, 0, 100);
      c.fillStyle = fc('#a51c2a'); c.fill(); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
      heartPath(c, -6, -4, 70); c.fillStyle = fc('#c2303c'); c.fill();
      c.beginPath(); c.moveTo(-30, -10); c.quadraticCurveTo(-10, 0, -14, 22); c.moveTo(20, -18); c.quadraticCurveTo(8, 4, 16, 18);
      c.strokeStyle = '#6a0a14'; c.lineWidth = 2.5; c.stroke();
      ellipse(c, -22, -20, 10, 6, 'rgba(255,170,170,0.5)', null, 0, -0.5);
      c.restore();
    },
  },
};

const BLOB_SIZES = [{ r: 10, hp: 10 }, { r: 17, hp: 20 }, { r: 26, hp: 45 }, { r: 38, hp: 110 }];
function blobPending(s) { return s > 1 ? 2 * (BLOB_SIZES[s - 1].hp + blobPending(s - 1)) : 0; }

function wormNext(e) {
  const [c, r] = tileOf(e.x, e.y);
  const ok = d => { const nc = c + DIRS[d][0], nr = r + DIRS[d][1]; return inGrid(nc, nr) && !solidWalk(G.room.tile(nc, nr)); };
  const opts = DIR_NAMES.filter(d => d !== OPP[e.dir] && ok(d));
  let d;
  if (!opts.length) d = ok(OPP[e.dir]) ? OPP[e.dir] : e.dir;
  else if (chance(0.35)) {
    const p = G.player;
    let best = Infinity;
    for (const o of opts) {
      const [tx, ty] = tileCenter(c + DIRS[o][0], r + DIRS[o][1]);
      const dd = Math.hypot(tx - p.x, ty - p.y);
      if (dd < best) { best = dd; d = o; }
    }
  } else if (opts.includes(e.dir) && chance(0.5)) d = e.dir;
  else d = pick(opts);
  e.dir = d;
  const nc = clamp(c + DIRS[d][0], 0, COLS - 1), nr = clamp(r + DIRS[d][1], 0, ROWS - 1);
  [e.tx, e.ty] = tileCenter(nc, nr);
}

function momSlot(side) {
  switch (side) {
    case 'up': return [RX + RW / 2, RY + 16];
    case 'down': return [RX + RW / 2, RY + RH - 16];
    case 'left': return [RX + 16, RY + RH / 2];
    default: return [RX + RW - 16, RY + RH / 2];
  }
}
function spawnPart(type, x, y, owner, o) {
  const e = new Enemy(type, x, y, Object.assign({ shareHp: owner, noClear: true, noSpawn: true, hpScale: 1 }, o));
  G.enemies.push(e);
  return e;
}

function spawnBoss(type) {
  const [x, y] = tileCenter(6, 3);
  G.bossName = BOSS_NAMES[type];
  G.bossesSeen.add(type);
  if (type === 'gemini') {
    const a = new Enemy('geminiBig', x - 50, y, { noSpawn: true });
    const b = new Enemy('geminiSmall', x + 50, y - 20, { noSpawn: true });
    a.partner = b; b.partner = a;
    G.enemies.push(a, b);
  } else {
    G.enemies.push(new Enemy(type, x, y, { noSpawn: true }));
  }
  G.bossMax = bossTotal();
}

function bossTotal() {
  let s = 0;
  for (const e of G.enemies) {
    if (e.dead || !e.boss) continue;
    s += Math.max(0, e.hp) + (e.d.pending ? e.d.pending(e) : 0);
  }
  return s;
}
