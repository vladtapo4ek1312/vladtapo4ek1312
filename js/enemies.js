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
      const k = 1 - Math.min(this.z, 300) / 400, sy = this.y + this.r * 0.5;
      if (gfxLevel() > 1) {   // мягкая тень: широкий полупрозрачный край и плотная середина
        shadow(c, this.x, sy, this.r * 1.05 * k, this.r * 0.42 * k, 0.2 * this.alpha);
        shadow(c, this.x, sy, this.r * 0.7 * k, this.r * 0.27 * k, 0.2 * this.alpha);
      } else shadow(c, this.x, sy, this.r * 0.95 * k, this.r * 0.38 * k, 0.32 * this.alpha);
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
// Объём: радиальные градиенты строятся один раз в единичных координатах и
// растягиваются трансформацией под нужный эллипс — кадр ничего не выделяет.
// На низком качестве (gfxLevel() === 0) и во вспышке попадания — плоская заливка.
const mobColCache = new Map(), mobGradCache = new Map(), mobLinCache = new Map();
const MOB_SIDE_ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const MOB_WING = ['rgba(236,238,248,0.66)', 'rgba(236,238,248,0.24)'];
// цвет col, затемнённый (k < 0) или осветлённый (k > 0), с учётом вспышки и оттенка
function mobShade(col, k = 0) {
  if (FLASH) return '#ffffff';
  const key = col + k + (TINT || '');
  let v = mobColCache.get(key);
  if (v) return v;
  const A = hexToRgb(col);
  let r = A[0], g = A[1], b = A[2];
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  else if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  if (TINT) { const B = hexToRgb(TINT); r = lerp(r, B[0], 0.45); g = lerp(g, B[1], 0.45); b = lerp(b, B[2], 0.45); }
  v = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  mobColCache.set(key, v);
  return v;
}
// свет сверху-слева, тень снизу-справа (единичный круг)
function mobGrad(c, col) {
  const key = col + (TINT || '');
  let g = mobGradCache.get(key);
  if (!g) {
    g = c.createRadialGradient(-0.36, -0.44, 0.04, -0.14, -0.2, 1.22);
    g.addColorStop(0, mobShade(col, 0.34));
    g.addColorStop(0.3, mobShade(col, 0.1));
    g.addColorStop(0.7, mobShade(col, -0.03));
    g.addColorStop(1, mobShade(col, -0.45));
    mobGradCache.set(key, g);
  }
  return g;
}
// цилиндр (нога, червь): по оси x от -1 до 1
function mobLinGrad(c, col) {
  const key = col + (TINT || '');
  let g = mobLinCache.get(key);
  if (!g) {
    g = c.createLinearGradient(-1, 0, 1, 0);
    g.addColorStop(0, mobShade(col, -0.28));
    g.addColorStop(0.3, mobShade(col, 0.2));
    g.addColorStop(0.62, mobShade(col, 0));
    g.addColorStop(1, mobShade(col, -0.42));
    mobLinCache.set(key, g);
  }
  return g;
}
// залить текущий контур: объёмно (по эллипсу x,y,rx,ry) или плоско
function mobFill(c, col, x, y, rx, ry, rot = 0, lin = false) {
  if (FLASH || gfxLevel() === 0) { c.fillStyle = mobShade(col); c.fill(); return; }
  rx = Math.max(0.1, rx); ry = Math.max(0.1, ry);
  // контур уже построен: трансформация влияет только на градиент; затем возвращаем её обратно
  c.translate(x, y); if (rot) c.rotate(rot); c.scale(rx, ry);
  c.fillStyle = lin ? mobLinGrad(c, col) : mobGrad(c, col);
  c.fill();
  c.scale(1 / rx, 1 / ry); if (rot) c.rotate(-rot); c.translate(-x, -y);
}
// эллипс с контуром-«подложкой»: две заливки обходятся заметно дешевле, чем stroke()
function mobEll(c, x, y, rx, ry, col, stroke, lw = 2, rot = 0) {
  if (stroke) {
    const h = lw * 0.5;
    c.beginPath(); c.ellipse(x, y, rx + h, ry + h, rot, 0, Math.PI * 2);
    c.fillStyle = stroke; c.fill();
    rx -= h; ry -= h;
  }
  rx = Math.max(0.1, rx); ry = Math.max(0.1, ry);
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  mobFill(c, col, x, y, rx, ry, rot);
}
// плоский эллипс с контуром-подложкой (глаза, ногти)
function mobDisc(c, x, y, rx, ry, fill, stroke, lw = 1, rot = 0) {
  if (stroke) { ellipse(c, x, y, rx + lw * 0.5, ry + lw * 0.5, stroke, null, 0, rot); rx -= lw * 0.5; ry -= lw * 0.5; }
  ellipse(c, x, y, rx, ry, fill, null, 0, rot);
}
function mobBall(c, x, y, r, col, stroke, lw = 2) { mobEll(c, x, y, r, r, col, stroke, lw); }
// блик: по умолчанию только на высоком качестве (minL — с какого уровня рисовать)
function mobGloss(c, x, y, rx, ry, a = 0.5, rot = -0.5, minL = 2) {
  if (FLASH || gfxLevel() < minL) return;
  ellipse(c, x, y, rx, ry, 'rgba(255,255,255,' + a + ')', null, 0, rot);
}
// мягкое свечение (кэшированный градиент; rgb — строка 'r,g,b'); только высокое качество
const mobGlowCache = new Map();
function mobGlow(c, x, y, r, rgb, a) {
  if (FLASH || gfxLevel() < 2 || a <= 0) return;
  let g = mobGlowCache.get(rgb);
  if (!g) {
    g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(0.45, 'rgba(' + rgb + ',0.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    mobGlowCache.set(rgb, g);
  }
  c.save(); c.globalAlpha *= Math.min(1, a); c.translate(x, y); c.scale(r, r);
  c.fillStyle = g; c.fillRect(-1, -1, 2, 2);
  c.restore();
}
// бугристый гладкий контур (Толстун, Князь, слизни)
function mobLumpPath(c, x, y, rx, ry, amp, seed, wob = 0, n = 18) {
  c.beginPath();
  let qx = 0, qy = 0;
  for (let i = 0; i <= n + 1; i++) {
    const a = (i % n) / n * Math.PI * 2;
    const k = 1 + amp * (Math.sin(a * 3 + seed + wob) * 0.6 + Math.sin(a * 5 + seed * 2.3 - wob * 1.3) * 0.4);
    const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
    if (i === 1) c.moveTo((qx + px) / 2, (qy + py) / 2);
    else if (i > 1) c.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2);
    qx = px; qy = py;
  }
  c.closePath();
}
// крылья с размытым следом взмаха; ro — где крепится крыло
function mobWings(c, x, y, r, t, sp = 1.3, L = gfxLevel(), ro = r * 0.2) {
  const w = r * 1.05, h = r * 0.48;
  for (let k = L > 1 ? 1 : 0; k >= 0; k--) {   // размытый след взмаха — на высоком качестве
    const a = -0.48 + Math.sin(t * sp - k * 0.75) * 0.42;
    for (let s = -1; s <= 1; s += 2) {
      const th = s > 0 ? a : Math.PI - a, rx = x + s * ro;
      ellipse(c, rx + Math.cos(th) * w * 0.8, y + Math.sin(th) * w * 0.8, w, h, MOB_WING[k], null, 0, th);
      if (!k && L > 1) line(c, rx, y, rx + Math.cos(th) * w * 1.45, y + Math.sin(th) * w * 1.45, 'rgba(60,50,60,0.3)', 0.7);
    }
  }
}
// покачивание летающих
function mobBob(e, r) { return Math.sin(e.t * 0.33) * r * 0.15; }
// растяжение в прыжке и присед перед ним -> [sx, sy]
const mobSq = [1, 1], MOB_SQ1 = [1, 1];
function mobHopSquash(e, crouch) {
  let sx = 1, sy = 1;
  if (e.st === 'jump' && e.jd) { const v = Math.abs(Math.cos(e.jt / e.jd * Math.PI)); sy = 1 + v * 0.14; sx = 1 - v * 0.08; }
  else if (e.st === 'rest' && e.timer < crouch) { const p = 1 - Math.max(0, e.timer) / crouch; sy = 1 - p * 0.16; sx = 1 + p * 0.12; }
  mobSq[0] = sx; mobSq[1] = sy;
  return mobSq;
}
// лягушачьи лапы прыгунов: согнуты на земле, свисают в прыжке
function mobLegs(c, x, y0, air, sc, col, lw, L, crouch = 0) {
  c.beginPath();
  for (let s = -1; s <= 1; s += 2) {
    c.moveTo(x + s * 4 * sc, y0);
    if (air) c.lineTo(x + s * 6 * sc, y0 + 10 * sc);
    else { c.lineTo(x + s * 10 * sc, y0 - 6 * sc + crouch); c.lineTo(x + s * 8 * sc, y0 + 6 * sc); }
  }
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (L) { c.strokeStyle = OUT; c.lineWidth = lw + 1.8; c.stroke(); }
  c.strokeStyle = mobShade(col); c.lineWidth = lw; c.stroke();
  if (L > 1) for (let s = -1; s <= 1; s += 2) {
    if (air) mobDisc(c, x + s * 6 * sc, y0 + 10.5 * sc, 2.2 * sc, 1.5 * sc, mobShade(col, -0.1), OUT, 1);
    else mobDisc(c, x + s * 9 * sc, y0 + 6.5 * sc, 2.6 * sc, 1.5 * sc, mobShade(col, -0.1), OUT, 1);
  }
}
const MOB_DASH = [3, 4], MOB_NODASH = [];
const MOB_TOES = [10, 8.3, 7.7, 7, 6.2], MOB_FINGERS = [10.5, 12, 11, 8];
const MOB_DUKE_WARTS =[[-16, -14, 4], [12, -18, 3], [20, 4, 3.5], [-20, 8, 3]];
// мелкая декоративная муха (рой вокруг боссов)
function mobGnat(c, x, y, t, L) {
  if (L > 1) {
    const f = (t & 2) ? 0.7 : -0.3;
    ellipse(c, x - 1.8, y - 1.6, 2, 1, 'rgba(236,238,248,0.6)', null, 0, f);
    ellipse(c, x + 1.8, y - 1.6, 2, 1, 'rgba(236,238,248,0.6)', null, 0, -f);
  }
  circle(c, x, y, 1.8, '#121214');
}
// капля крови/слюны, стекающая по циклу
function mobDrip(c, x, y, len, t, col, r = 1.2) {
  const k = t % 1;
  line(c, x, y, x, y + len * k, col, r * 0.9);
  circle(c, x, y + len * k + r * 0.4, r * (0.6 + k * 0.4), col);
}
// две линии одним контуром (брови, клыки)
function mobLines2(c, x1, y1, x2, y2, x3, y3, x4, y4, col, lw) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.moveTo(x3, y3); c.lineTo(x4, y4);
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
}
function drawFly(c, e, x, y, col, r, eye = '#d83030', stripes = true) {
  const L = gfxLevel();
  y += mobBob(e, r);
  mobWings(c, x, y - r * 0.55, r, e.t, 1.3, L);
  if (L > 1) {
    c.beginPath();
    for (let s = -1; s <= 1; s += 2) { c.moveTo(x + s * r * 0.3, y + r * 0.7); c.lineTo(x + s * r * 0.55, y + r * 1.25 + Math.sin(e.t * 0.5 + s) * 0.6); }
    c.strokeStyle = '#111'; c.lineWidth = 0.9; c.stroke();
  }
  mobBall(c, x, y, r, col, '#000', 1.2);
  if (L > 1 && stripes) {
    c.beginPath();
    c.arc(x, y - r * 0.6, r * 1.2, 0.9, Math.PI - 0.9);
    c.moveTo(x + Math.cos(1.08) * r * 1.42, y - r * 0.6 + Math.sin(1.08) * r * 1.42);
    c.arc(x, y - r * 0.6, r * 1.42, 1.08, Math.PI - 1.08);
    c.strokeStyle = mobShade(col, 0.22); c.lineWidth = Math.max(0.8, r * 0.16); c.stroke();
  }
  // фасеточные глаза
  if (eye) for (let s = -1; s <= 1; s += 2) {
    ellipse(c, x + s * r * 0.4, y - r * 0.24, r * 0.3, r * 0.35, eye, null, 0, s * 0.35);
    if (L > 1) circle(c, x + s * r * 0.4 - r * 0.1, y - r * 0.36, r * 0.1, 'rgba(255,255,255,0.85)');
  }
  mobGloss(c, x - r * 0.1, y - r * 0.62, r * 0.32, r * 0.14, 0.35, 0);
  return y;
}
// пустые глазницы; bleed — со стекающей кровью
function hollowEyes(c, x, y, sp, r, bleed, t = 0) {
  const L = gfxLevel();
  for (let s = -1; s <= 1; s += 2) {
    const ex = x + s * sp;
    if (L > 1) ellipse(c, ex, y + r * 0.12, r * 1.15, r * 1.25, 'rgba(70,15,15,0.28)');
    ellipse(c, ex, y, r * 0.85, r, '#120808');
    if (L > 1) ellipse(c, ex, y + r * 0.45, r * 0.5, r * 0.35, '#2e0c0c');
    if (bleed) {
      const by = y + r * 0.6, len = r * 1.5 + 2.5, bx = ex + s * 0.4;
      if (L) {   // струйка крови с каплей одним контуром
        c.beginPath();
        c.moveTo(ex - r * 0.5, by); c.lineTo(ex + r * 0.5, by); c.lineTo(bx + r * 0.2, by + len); c.lineTo(bx - r * 0.2, by + len); c.closePath();
        c.moveTo(bx + r * 0.32 + 0.35, by + len); c.arc(bx, by + len, r * 0.32 + 0.35, 0, Math.PI * 2);
        c.fillStyle = '#9a0e0e'; c.fill();
        if (L > 1) mobDrip(c, bx, by + len, r * 1.6, t * 0.02 + (s > 0 ? 0.5 : 0), '#a81414', r * 0.3 + 0.3);
      } else line(c, ex, y + r, bx, y + r + 4.5, '#a01010', 1.6);
    }
  }
}
// lid — цвет кожи нависающего злого века, side: -1 левый глаз, 1 правый
function pupilEye(c, x, y, r, e, look = true, lid = null, side = 0) {
  const L = gfxLevel();
  if (L) mobDisc(c, x, y, r, r, '#f4efe8', OUT, 1.5);
  else circle(c, x, y, r, '#f4efe8', OUT, 1.5);
  if (L > 1) {
    ellipse(c, x + r * 0.1, y + r * 0.4, r * 0.7, r * 0.4, 'rgba(120,60,50,0.2)');
    c.beginPath();
    c.moveTo(x - r * 0.92, y + r * 0.15); c.lineTo(x - r * 0.5, y + r * 0.05); c.lineTo(x - r * 0.35, y + r * 0.2);
    c.moveTo(x + r * 0.9, y - r * 0.3); c.lineTo(x + r * 0.5, y - r * 0.12);
    c.strokeStyle = 'rgba(200,40,40,0.7)'; c.lineWidth = 0.7; c.stroke();
  }
  let px = 0, py = 0;
  if (look && G.player) { const a = angleTo({ x, y }, G.player); px = Math.cos(a) * r * 0.35; py = Math.sin(a) * r * 0.35; }
  circle(c, x + px, y + py, r * 0.5, '#111');
  circle(c, x + px - r * 0.15, y + py - r * 0.2, r * 0.15, '#fff');
  if (L && lid) {   // злое нависающее веко
    const a1 = side < 0 ? Math.PI + 0.7 : Math.PI - 0.2, a2 = side < 0 ? Math.PI * 2 + 0.2 : Math.PI * 2 - 0.7;
    c.beginPath(); c.arc(x, y, r - 0.7, a1, a2); c.closePath();
    c.fillStyle = mobShade(lid, -0.08); c.fill();
    line(c, x + Math.cos(a1) * r, y + Math.sin(a1) * r, x + Math.cos(a2) * r, y + Math.sin(a2) * r, OUT, r * 0.3);
  }
}
// туловище с ножками и ручками; возвращает подпрыгивание при ходьбе
function walkerBody(c, e, x, y, skin, sc = 1) {
  const L = gfxLevel();
  const mv = Math.hypot(e.vx, e.vy) > 0.2;
  const ph = e.t * 0.3;
  const sw = mv ? Math.sin(ph) * 3 : 0;
  const bob = !L ? 0 : mv ? Math.abs(Math.cos(ph)) * 1.3 * sc : Math.sin(e.t * 0.08) * 0.35 * sc;
  mobEll(c, x - 4 * sc + sw * 0.5 * sc, y + 6 * sc, 3.2 * sc, 3 * sc, skin, OUT, 1.4);
  mobEll(c, x + 4 * sc - sw * 0.5 * sc, y + 6 * sc, 3.2 * sc, 3 * sc, skin, OUT, 1.4);
  if (L > 1) for (let s = -1; s <= 1; s += 2) mobEll(c, x + s * 6.8 * sc, y - 0.5 * sc - bob + s * sw * 0.3 * sc, 2.3 * sc, 3 * sc, skin, OUT, 1.2, s * 0.25);
  mobEll(c, x, y - 1 * sc - bob, 7 * sc, 7 * sc, skin, OUT, 1.5);
  if (L > 1) { c.beginPath(); c.arc(x, y - 1 * sc - bob, 4.2 * sc, 0.5, Math.PI - 0.5); c.strokeStyle = 'rgba(90,40,30,0.25)'; c.lineWidth = 0.8 * sc; c.stroke(); }
  return bob;
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
    draw(c, e, x, y) {
      const fy = drawFly(c, e, x, y, '#8a1414', 6.5, '#1a0505');
      if (gfxLevel()) mobLines2(c, x - 4.6, fy - 4.4, x - 1.2, fy - 2.6, x + 4.6, fy - 4.4, x + 1.2, fy - 2.6, OUT, 1.3);
    },
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
      const L = gfxLevel(), ch = e.charging, t = e.t, col = '#8a685a';
      if (L) y += Math.sin(t * 0.12) * 1.2;
      // перед выстрелом раздувается
      const s = ch ? 1.06 + Math.sin(t * 1.2) * 0.07 : 1 + (L ? Math.sin(t * 0.1) * 0.02 : 0);
      if (L) mobWings(c, x, y - 7, 10, t, 1.2, L, 6);
      else {
        const f = Math.sin(t * 1.2) * 0.5;
        ellipse(c, x - 11, y - 9, 10, 5, 'rgba(225,225,235,0.6)', null, 0, -0.5 + f);
        ellipse(c, x + 11, y - 9, 10, 5, 'rgba(225,225,235,0.6)', null, 0, 0.5 - f);
      }
      if (ch) mobGlow(c, x, y + 3, 19 * s, '255,60,40', 0.3 + Math.sin(t * 1.2) * 0.1);
      mobEll(c, x, y, 10.5 * s, 10 * s, col, OUT, 1.8);
      if (L > 1) {   // пятна и прожилки
        c.beginPath();
        c.moveTo(x - 4.8 * s, y + 3.5 * s); c.arc(x - 6.3 * s, y + 3.5 * s, 1.5, 0, Math.PI * 2);
        c.moveTo(x + 7.7 * s, y - 0.5 * s); c.arc(x + 6.6 * s, y - 0.5 * s, 1.1, 0, Math.PI * 2);
        c.moveTo(x + 4.4 * s, y + 6.8 * s); c.arc(x + 3.5 * s, y + 6.8 * s, 0.9, 0, Math.PI * 2);
        c.fillStyle = mobShade(col, -0.22); c.fill();
        c.beginPath(); c.moveTo(x - 9 * s, y - 2); c.quadraticCurveTo(x - 6 * s, y - 6, x - 3 * s, y - 8.6 * s);
        c.moveTo(x + 9.4 * s, y + 2); c.quadraticCurveTo(x + 7 * s, y - 3, x + 7.5 * s, y - 6 * s);
        c.strokeStyle = 'rgba(140,30,40,0.5)'; c.lineWidth = 0.8; c.stroke();
      } else if (!L) circle(c, x - 4, y - 4, 3, fc('#a8857a'));
      mobGloss(c, x - 4 * s, y - 5.5 * s, 3.4, 2, 0.32);
      const a = angleTo({ x, y }, G.player), ex = Math.cos(a) * 0.9, ey = Math.sin(a) * 0.7;
      ellipse(c, x - 4 + ex, y - 3 + ey, 2.1, 2.6, '#140808'); ellipse(c, x + 4 + ex, y - 3 + ey, 2.1, 2.6, '#140808');
      if (L > 1) { circle(c, x - 4.7 + ex, y - 4 + ey, 0.7, '#fff'); circle(c, x + 3.3 + ex, y - 4 + ey, 0.7, '#fff'); }
      if (ch && L) mobLines2(c, x - 6.6 + ex, y - 7.6 + ey, x - 1.8 + ex, y - 5.4 + ey, x + 6.6 + ex, y - 7.6 + ey, x + 1.8 + ex, y - 5.4 + ey, OUT, 1.4);
      // рот смотрит на игрока; перед плевком разинут
      const mx = x + Math.cos(a) * 3.6, my = y + 3.6 + Math.sin(a) * 2;
      const mr = ch ? 3.6 + Math.sin(t * 1.2) * 0.6 : 2.5;
      ellipse(c, mx, my, mr, mr * 0.9, '#2a0808');
      if (L && ch) ellipse(c, mx, my + mr * 0.4, mr * 0.55, mr * 0.35, '#8a2020');
      if (L > 1 && !ch) mobDrip(c, mx, my + mr * 0.8, 4, t * 0.015, 'rgba(220,225,200,0.75)', 0.9);
    },
  },
  gaper: {
    name: 'Зевака', hp: 10, r: 11,
    update(e) { chase(e, 1.25, 0.12); },
    draw(c, e, x, y) {
      const L = gfxLevel();
      const hy = y - 15 - walkerBody(c, e, x, y, '#d39a86');
      mobBall(c, x, hy, 10.5, '#d6a08c', OUT, 2);
      if (L > 1) {   // морщины на лбу
        c.beginPath();
        c.moveTo(x - 4.5, hy - 6.6); c.quadraticCurveTo(x, hy - 8, x + 4.5, hy - 6.6);
        c.moveTo(x - 3, hy - 4.9); c.quadraticCurveTo(x, hy - 5.9, x + 3, hy - 4.9);
        c.strokeStyle = 'rgba(120,55,45,0.4)'; c.lineWidth = 0.8; c.stroke();
      }
      mobGloss(c, x - 4.5, hy - 5.5, 3.2, 1.8, 0.3);
      // разинутый рот
      const o = L ? Math.sin(e.t * 0.12) * 0.5 : 0;
      ellipse(c, x, hy + 5, 3.6, 3.2 + o, '#1a0606');
      if (L) ellipse(c, x, hy + 6.7 + o * 0.5, 2.2, 1.2, '#7a2222');
      hollowEyes(c, x, hy - 2, 4, 2.8, true, e.t);
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
      const L = gfxLevel();
      const k = e.shake ? clamp(1 - e.timer / 25, 0, 1) : 0;   // 1 — сейчас плюнет
      const hx = x + (e.shake ? (L ? Math.sin(e.t * 9.7) * (0.8 + k) : rand(-1.5, 1.5)) : 0), hy = y - 6;
      const s = L ? 1 + k * 0.07 + Math.sin(e.t * 0.07) * 0.012 : 1;
      if (L) {   // обрубок шеи
        ellipse(c, x, y + 4.5, 7, 3, '#4a0808');
        if (L > 1) mobDrip(c, x + 2.5, y + 6.5, 4, e.t * 0.012, '#7a1010', 0.9);
      }
      mobGlow(c, hx, hy, 21 * s, '255,50,30', (k - 0.3) * 0.6);
      mobBall(c, hx, hy, 12 * s, '#c4b2a2', OUT, 2);
      if (L && k > 0 && !FLASH) circle(c, hx, hy, 12 * s - 1, 'rgba(210,40,30,' + (k * 0.3).toFixed(2) + ')');
      if (L > 1) {
        c.beginPath();
        c.moveTo(hx - 10.5 * s, hy - 2); c.quadraticCurveTo(hx - 7 * s, hy - 5, hx - 8.5 * s, hy - 9 * s);
        c.moveTo(hx + 10.5 * s, hy - 1); c.quadraticCurveTo(hx + 7.5 * s, hy - 4, hx + 8.8 * s, hy - 8.5 * s);
        c.strokeStyle = 'rgba(110,50,100,0.45)'; c.lineWidth = 0.9; c.stroke();
      }
      mobGloss(c, hx - 5, hy - 6.5, 3.6, 2, 0.3);
      if (!L) {
        line(c, hx - 7, y - 9, hx - 2, y - 8, '#1a0a0a', 2.2);
        line(c, hx + 2, y - 8, hx + 7, y - 9, '#1a0a0a', 2.2);
        ellipse(c, hx, y - 1, 4.5, e.shake ? 4.5 : 3.2, '#1a0606');
        return;
      }
      // глаза под злыми бровями
      circle(c, hx - 4.3, hy - 1.6, 1.7, '#1a0a0a'); circle(c, hx + 4.3, hy - 1.6, 1.7, '#1a0a0a');
      mobLines2(c, hx - 7.5, hy - 4.5 - k * 1.5, hx - 2, hy - 2.6, hx + 2, hy - 2.6, hx + 7.5, hy - 4.5 - k * 1.5, '#1a0a0a', 2.2);
      // рот раскрывается к выстрелу
      const mh = 3.2 + k * 2.4;
      ellipse(c, hx, hy + 5, 4.5 + k * 0.8, mh, '#1a0606');
      ellipse(c, hx, hy + 5 + mh * 0.5, 2.7, mh * 0.38, '#7a1e1e');
      c.beginPath();
      c.moveTo(hx - 2.6, hy + 5 - mh * 0.92); c.lineTo(hx - 0.6, hy + 5 - mh * 0.92); c.lineTo(hx - 1.6, hy + 6.4 - mh); c.closePath();
      c.moveTo(hx + 0.6, hy + 5 - mh * 0.92); c.lineTo(hx + 2.6, hy + 5 - mh * 0.92); c.lineTo(hx + 1.6, hy + 6.4 - mh); c.closePath();
      c.fillStyle = '#efe6d6'; c.fill();
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
      const L = gfxLevel();
      const w = Math.sin(e.t * 0.2) * 1.5;
      const mv = e.st === 'move', sq = mv && L ? 1 + Math.sin(e.t * 0.5) * 0.07 : 1;
      const r1 = 7 + w * 0.3, r2 = 7 - w * 0.3;
      if (L) {
        // общий контур-подложка трёх комков, поверх заливки — сгусток выглядит цельным
        c.beginPath();
        c.moveTo(x - 6 + r1 + 1.5, y - 2); c.arc(x - 6, y - 2, r1 + 1.5, 0, Math.PI * 2);
        c.moveTo(x + 6 + r2 + 1.5, y - 3); c.arc(x + 6, y - 3, r2 + 1.5, 0, Math.PI * 2);
        c.moveTo(x + 9 * sq + 1.5, y - 8); c.ellipse(x, y - 8, 9 * sq + 1.5, 9 / sq + 1.5, 0, 0, Math.PI * 2);
        c.fillStyle = OUT; c.fill();
        mobBall(c, x - 6, y - 2, r1, '#7e1818');
        mobBall(c, x + 6, y - 3, r2, '#7e1818');
        mobEll(c, x, y - 8, 9 * sq, 9 / sq, '#951e1e');
        mobGloss(c, x - 3.5, y - 12, 3, 1.7, 0.45, -0.5, 1);
        if (L > 1) {
          mobGloss(c, x - 8.5, y - 3.5, 1.8, 1, 0.3); mobGloss(c, x + 4, y - 5.5, 1.6, 0.9, 0.3);
          mobDrip(c, x - 7, y + 4.5, 4, e.t * 0.013, '#6a0c0c', 1.1); mobDrip(c, x + 5, y + 3.5, 3, e.t * 0.017 + 0.4, '#6a0c0c', 0.9);
        }
      } else {
        circle(c, x - 6, y - 2, r1, fc('#7e1818'), OUT, 1.5);
        circle(c, x + 6, y - 3, r2, fc('#7e1818'), OUT, 1.5);
        circle(c, x, y - 8, 9, fc('#951e1e'), OUT, 1.5);
        circle(c, x - 3, y - 11, 2.5, fc('#c84040'));
      }
      circle(c, x - 3, y - 6, 1.8, '#fff'); circle(c, x + 3, y - 6, 1.8, '#fff');
      if (L) {
        circle(c, x - 2.7, y - 5.6, 0.8, '#111'); circle(c, x + 3.3, y - 5.6, 0.8, '#111');
        if (mv) mobLines2(c, x - 5, y - 9, x - 1.5, y - 7.8, x + 5, y - 9, x + 1.5, y - 7.8, OUT, 1.1);
      }
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
      const L = gfxLevel();
      const m = e.st === 'dash' ? Math.sin(e.t * 1.5) * 3 : L ? Math.sin(e.t * 0.15) * 0.4 : 0;
      // восемь суставчатых лап одним контуром
      c.beginPath();
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
        const k = (i % 2 ? m : -m), mid = i === 1 || i === 2 ? 2 : 0;
        c.moveTo(x + s * 3.5, y - 5.5 + i * 1.6); c.lineTo(x + s * (9 + mid), y - 12 + i * 3.2 + k * 0.5); c.lineTo(x + s * (12.5 + mid * 1.2), y - 6 + i * 4.2 + k);
      }
      c.strokeStyle = '#1a1414'; c.lineWidth = L ? 1.8 : 1.6; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
      if (L > 1) {   // суставы
        c.beginPath();
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
          const mid = i === 1 || i === 2 ? 2 : 0, kx = x + s * (9 + mid), ky = y - 12 + i * 3.2 + (i % 2 ? m : -m) * 0.5;
          c.moveTo(kx + 0.9, ky); c.arc(kx, ky, 0.9, 0, Math.PI * 2);
        }
        c.fillStyle = '#4a3a3a'; c.fill();
      }
      mobEll(c, x, y - 5, 7.2, 6.2, '#2c2222', '#000', 1.2);
      if (L > 1) poly(c, [x - 1.6, y - 8.6, x + 1.6, y - 8.6, x, y - 6.4, x + 1.6, y - 4.2, x - 1.6, y - 4.2, x, y - 6.4], '#a01818');
      mobGloss(c, x - 2.6, y - 8, 2.4, 1.2, 0.3);
      mobBall(c, x, y - 0.5, 4.2, '#3a2c2c', '#000', 1);
      circle(c, x - 1.5, y - 0.8, 1.1, '#e33'); circle(c, x + 1.5, y - 0.8, 1.1, '#e33');
      if (L > 1) {
        circle(c, x - 2.6, y - 2.4, 0.6, '#e33'); circle(c, x + 2.6, y - 2.4, 0.6, '#e33');
        mobLines2(c, x - 1.2, y + 2.6, x - 0.8, y + 4.4, x + 1.2, y + 2.6, x + 0.8, y + 4.4, '#d8c8b8', 0.9);
      }
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
      const L = gfxLevel();
      const air = e.z > 2;
      const [sx, sy] = L ? mobHopSquash(e, 8) : MOB_SQ1;
      mobLegs(c, x, y - 2, air, 1, '#a07a66', 3, L, (sy < 1 ? (1 - sy) * 14 : 0));
      const cy = y - 6 * sy;
      mobEll(c, x, cy, 8.5 * sx, 8.5 * sy, '#b88a74', OUT, 1.8);
      if (L > 1) { const sp = mobShade('#b88a74', -0.2); circle(c, x + 5, cy + 2, 1.1, sp); circle(c, x - 5.5, cy + 3, 0.8, sp); }
      mobGloss(c, x - 3.4, cy - 4.4, 2.6, 1.5, 0.3);
      hollowEyes(c, x, cy - 2 * sy, 3.2, 2.2, false);
      if (L) {
        ellipse(c, x, cy + 4 * sy, 2.8, air ? 1.8 : 1.1, '#1a0606');
        line(c, x - 1.8, cy + 3.6 * sy, x + 1.8, cy + 3.6 * sy, '#efe6d6', 0.8);
      } else line(c, x - 2.5, y - 2, x + 2.5, y - 2, '#1a0606', 1.5);
    },
  },
  fatty: {
    name: 'Толстяк', hp: 26, r: 15, heavy: true,
    update(e) { chase(e, 0.75, 0.08); },
    draw(c, e, x, y) {
      const L = gfxLevel(), skin = '#e4c3b0';
      const mv = Math.hypot(e.vx, e.vy) > 0.2, ph = e.t * 0.25, sw = mv ? Math.sin(ph) * 2 : 0;
      const by = mv && L ? Math.abs(Math.cos(ph)) * 1.2 : 0, br = L ? Math.sin(e.t * 0.06) * 0.03 : 0;
      mobEll(c, x - 7 + sw, y + 10, 4.5, 3.5, '#d8b4a2', OUT, 1.5);
      mobEll(c, x + 7 - sw, y + 10, 4.5, 3.5, '#d8b4a2', OUT, 1.5);
      const cy = y - 2 - by;
      if (L > 1) for (let s = -1; s <= 1; s += 2) mobEll(c, x + s * 15.5, cy + 1 + s * sw * 0.4, 3.2, 5.2, '#dcb8a4', OUT, 1.4, s * -0.35);
      mobEll(c, x, cy, 16 * (1 + br), 14 * (1 - br * 0.5), skin, OUT, 2);
      if (L) {
        // складки: грудь, живот; пупок
        c.beginPath();
        c.moveTo(x - 10, cy - 3); c.quadraticCurveTo(x - 5.5, cy + 0.5, x - 1.5, cy - 3.5);
        c.moveTo(x + 10, cy - 3); c.quadraticCurveTo(x + 5.5, cy + 0.5, x + 1.5, cy - 3.5);
        c.moveTo(x - 11, cy + 8); c.quadraticCurveTo(x, cy + 13.5, x + 11, cy + 8);
        c.strokeStyle = 'rgba(130,70,55,0.45)'; c.lineWidth = 1.1; c.stroke();
        ellipse(c, x, cy + 5, 1.3, 1.7, '#7a4a3a');
        mobGloss(c, x - 7, cy - 7, 4.5, 2.4, 0.28);
      } else {
        ellipse(c, x, y + 3, 11, 7, fc('#d6ae9a'));
        circle(c, x, y + 2, 1.4, '#7a4a3a');
      }
      const hy = y - 20 - by;
      mobBall(c, x, hy, 8, skin, OUT, 1.8);
      if (L > 1) { c.beginPath(); c.arc(x, hy + 1, 6.5, 0.45, Math.PI - 0.45); c.strokeStyle = 'rgba(130,70,55,0.4)'; c.lineWidth = 1; c.stroke(); }
      mobGloss(c, x - 3, hy - 3.5, 2.4, 1.3, 0.3);
      hollowEyes(c, x, hy - 1, 3, 1.8, false);
      if (L) {
        ellipse(c, x, hy + 3.6, 2.3, 1.3, '#2a0808');
        if (L > 1) mobDrip(c, x + 1, hy + 4.6, 5, e.t * 0.012, 'rgba(225,230,205,0.8)', 1);
      } else line(c, x - 2, y - 16, x + 2, y - 16, '#1a0606', 1.3);
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
      const L = gfxLevel();
      const [dx, dy] = DIRS[e.dir || 'down'];
      const wig = Math.sin(e.t * 0.25) * 1.5;
      for (let i = 2; i >= 0; i--) {
        const k = i * 7, w = (i % 2 ? 1 : -1) * wig;
        const sx = x - dx * k + (dy ? w : 0), sy = y - 4 - dy * k + (dx ? w : 0);
        const r = (7 - i * 1.2) * (L ? 1 + Math.sin(e.t * 0.3 - i * 1.3) * 0.07 : 1);   // волна сокращений
        mobBall(c, sx, sy, r, i ? '#e2d8bc' : '#efe6cc', OUT, 1.4);
        if (L > 1) {
          if (i) {   // кольцо сегмента
            c.beginPath(); c.moveTo(sx + dx * r * 0.25 - dy * r * 0.85, sy + dy * r * 0.25 - dx * r * 0.85);
            c.quadraticCurveTo(sx + dx * r * 0.7, sy + dy * r * 0.7, sx + dx * r * 0.25 + dy * r * 0.85, sy + dy * r * 0.25 + dx * r * 0.85);
            c.strokeStyle = 'rgba(150,125,85,0.6)'; c.lineWidth = 1; c.stroke();
          }
          mobGloss(c, sx - r * 0.35, sy - r * 0.4, r * 0.32, r * 0.18, 0.5);
        }
      }
      // голова: рот с жвальцами и глазки
      const hx = x + dx * 3, hy = y - 4 + dy * 3;
      circle(c, hx, hy, 2, '#3a1a10');
      if (L > 1) mobLines2(c, hx - dy * 2.6, hy - dx * 2.6, hx + dx * 1.6 - dy * 1.2, hy + dy * 1.6 - dx * 1.2, hx + dy * 2.6, hy + dx * 2.6, hx + dx * 1.6 + dy * 1.2, hy + dy * 1.6 + dx * 1.2, '#5a3020', 0.9);
      if (L) {
        if (dx) { circle(c, x + dx * 1.2, y - 7.6, 0.9, '#1a0a06'); circle(c, x + dx * 4, y - 7.2, 0.9, '#1a0a06'); }
        else if (dy > 0) { circle(c, x - 2.8, y - 5.6, 0.9, '#1a0a06'); circle(c, x + 2.8, y - 5.6, 0.9, '#1a0a06'); }
      }
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
      const L = gfxLevel();
      const p = (Math.sin(e.t * 0.22) + 1) * 0.5;   // тлеющая пульсация
      mobGlow(c, x, y + mobBob(e, 9), 17 + p * 3, '255,120,30', 0.18 + p * 0.22);
      const fy = drawFly(c, e, x, y, '#cf5528', 9, null, false);
      if (L) {
        c.beginPath();
        c.moveTo(x - 7.6, fy + 0.5); c.quadraticCurveTo(x, fy + 3.5, x + 7.6, fy + 0.5);
        c.moveTo(x - 6.2, fy + 4.6); c.quadraticCurveTo(x, fy + 7.4, x + 6.2, fy + 4.6);
        c.strokeStyle = mobShade('#7a2a10'); c.lineWidth = 2.2; c.stroke();
        if (L > 1 && !FLASH) { c.strokeStyle = 'rgba(255,220,90,' + (0.25 + p * 0.5).toFixed(2) + ')'; c.lineWidth = 0.9; c.stroke(); }
      } else {
        line(c, x - 6, y + 1, x + 6, y + 1, '#7a2a10', 2);
        line(c, x - 5, y + 5, x + 5, y + 5, '#7a2a10', 2);
      }
      // жёлтые глаза со зрачками-щёлками и злыми бровями
      circle(c, x - 3, fy - 3, L ? 2.3 : 1.8, '#ffe060');
      circle(c, x + 3, fy - 3, L ? 2.3 : 1.8, '#ffe060');
      if (L) {
        mobLines2(c, x - 3, fy - 4.4, x - 3, fy - 1.6, x + 3, fy - 4.4, x + 3, fy - 1.6, '#1a0a00', 1);
        mobLines2(c, x - 6, fy - 6.4, x - 1.2, fy - 5, x + 6, fy - 6.4, x + 1.2, fy - 5, OUT, 1.4);
      }
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
      const L = gfxLevel();
      const [dx, dy] = DIRS[e.dir || 'down'];
      const ch = e.st === 'charge', stun = e.st === 'stun';
      if (ch && L && !FLASH) {   // полосы скорости
        c.beginPath();
        for (let j = -1; j <= 1; j++) {
          const o = j * 4.5, l0 = 26 + ((e.t * 3 + j * 7) % 10);
          c.moveTo(x - dx * l0 - dy * o, y - 4 - dy * l0 + dx * o); c.lineTo(x - dx * (l0 + 12) - dy * o, y - 4 - dy * (l0 + 12) + dx * o);
        }
        c.strokeStyle = 'rgba(255,240,220,0.4)'; c.lineWidth = 1.4; c.stroke();
      }
      for (let i = 3; i >= 0; i--) {
        const k = i * (ch ? 8 : 6.5), wob = ch || stun || !L ? 0 : Math.sin(e.t * 0.3 - i) * 0.8;
        const sx = x - dx * k - dy * wob, sy = y - 4 - dy * k + dx * wob, r = 7.5 - i * 0.9;
        mobBall(c, sx, sy, r, i ? '#a8483a' : '#c25a48', OUT, 1.5);
        if (L > 1) {
          if (i) {   // поперечные кольца-пластины
            c.beginPath(); c.moveTo(sx + dx * r * 0.3 - dy * r * 0.88, sy + dy * r * 0.3 - dx * r * 0.88);
            c.quadraticCurveTo(sx + dx * r * 0.75, sy + dy * r * 0.75, sx + dx * r * 0.3 + dy * r * 0.88, sy + dy * r * 0.3 + dx * r * 0.88);
            c.strokeStyle = mobShade('#a8483a', -0.35); c.lineWidth = 1.2; c.stroke();
          }
          mobGloss(c, sx - r * 0.35, sy - r * 0.42, r * 0.34, r * 0.18, 0.35);
        }
      }
      if (!L) {
        circle(c, x + dx * 3 - dy * 3, y - 6 + dy * 3 - dx, 1.8, ch ? '#ff3' : '#111');
        circle(c, x + dx * 3 + dy * 3, y - 6 + dy * 3 + dx, 1.8, ch ? '#ff3' : '#111');
        return;
      }
      // глаза сверху-спереди головы (в профиль оба видны сверху)
      const e1x = x + dx * 4 - dy * 3, e1y = y - 5 + dy * 1.5 - (dx ? 1.5 : 0);
      const e2x = x + dx * 0.8 + dy * 3, e2y = y - 5 + dy * 1.5 - (dx ? 2.5 : 0);
      if (stun) {   // оглушён: глаза-крестики и звёздочки
        c.beginPath();
        c.moveTo(e1x - 1.4, e1y - 1.4); c.lineTo(e1x + 1.4, e1y + 1.4); c.moveTo(e1x + 1.4, e1y - 1.4); c.lineTo(e1x - 1.4, e1y + 1.4);
        c.moveTo(e2x - 1.4, e2y - 1.4); c.lineTo(e2x + 1.4, e2y + 1.4); c.moveTo(e2x + 1.4, e2y - 1.4); c.lineTo(e2x - 1.4, e2y + 1.4);
        c.strokeStyle = '#111'; c.lineWidth = 1.1; c.stroke();
        c.beginPath();
        for (let j = 0; j < 3; j++) { const a = e.t * 0.15 + j * 2.1, sx = x + Math.cos(a) * 8, sy = y - 15 + Math.sin(a) * 2.5; c.moveTo(sx + 1.4, sy); c.arc(sx, sy, 1.4, 0, Math.PI * 2); }
        c.fillStyle = '#ffe36a'; c.fill();
        return;
      }
      circle(c, e1x, e1y, ch ? 2.2 : 1.8, ch ? '#ff3' : '#111');
      circle(c, e2x, e2y, ch ? 2.2 : 1.8, ch ? '#ff3' : '#111');
      if (ch) { circle(c, e1x, e1y, 0.8, '#111'); circle(c, e2x, e2y, 0.8, '#111'); }
      else if (L > 1) { circle(c, e1x - 0.5, e1y - 0.6, 0.5, '#fff'); circle(c, e2x - 0.5, e2y - 0.6, 0.5, '#fff'); }
      // злые брови и рот (с клыками в рывке)
      const s1 = e1x < e2x ? -1 : 1;
      mobLines2(c, e1x + s1 * 1.9, e1y - 2.7, e1x - s1 * 1.1, e1y - 1.7, e2x - s1 * 1.9, e2y - 2.7, e2x + s1 * 1.1, e2y - 1.7, OUT, 1.1);
      if (dy >= 0) {
        const mx = x + dx * 5.4, my = y - 1.6 + dy * 2.4;
        ellipse(c, mx, my, ch ? 2.6 : 2, ch ? 1.8 : 1.1, '#2a0606');
        if (ch && L > 1) { circle(c, mx - 1.1, my - 0.9, 0.55, '#f0e8d8'); circle(c, mx + 1.1, my - 0.9, 0.55, '#f0e8d8'); }
      }
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
      const L = gfxLevel();
      const b = walkerBody(c, e, x, y + 4, '#a3a882');
      const br = L ? 1 + Math.sin(e.t * 0.09) * 0.04 : 1, by = y - 6 - b;   // раздутое брюхо дышит
      mobEll(c, x, by, 12 * br, 11 * br, '#a9ae88', OUT, 2);
      if (L) {
        // зашитый разрез на брюхе
        c.beginPath(); c.moveTo(x - 1.5, by - 8.5); c.quadraticCurveTo(x + 3.5, by, x - 0.5, by + 8.5);
        for (let i = 0; i < 4; i++) { const sy = by - 6 + i * 4, sx = x + 0.6 + Math.sin((i + 0.5) / 4 * Math.PI) * 1.2; c.moveTo(sx - 2.2, sy - 0.6); c.lineTo(sx + 2.2, sy + 0.6); }
        c.strokeStyle = '#5a2424'; c.lineWidth = 1; c.stroke();
        if (L > 1) {
          mobDisc(c, x - 7, by + 2.5, 1.7, 1.7, mobShade('#d8cc70'), OUT, 0.7); mobDisc(c, x + 7.5, by - 4, 1.2, 1.2, mobShade('#d8cc70'), OUT, 0.6);
          c.beginPath(); c.moveTo(x - 10, by - 3); c.quadraticCurveTo(x - 6.5, by - 6, x - 6, by - 9.5); c.moveTo(x + 10.5, by + 2); c.quadraticCurveTo(x + 7, by + 4, x + 5.5, by + 8);
          c.strokeStyle = 'rgba(100,40,90,0.45)'; c.lineWidth = 0.9; c.stroke();
        }
        mobGloss(c, x - 5, by - 6, 3.4, 1.8, 0.3);
      } else {
        line(c, x - 6, y - 10, x - 2, y - 4, '#a03030', 1);
        line(c, x + 5, y - 12, x + 2, y - 2, '#a03030', 1);
      }
      const hy = y - 19 - b;
      mobBall(c, x, hy, 6, '#b4b892', OUT, 1.5);
      hollowEyes(c, x, hy - 1, 2.4, 1.5, false);
      if (L) { c.beginPath(); c.arc(x, hy + 4.8, 1.8, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = '#1a0606'; c.lineWidth = 1; c.stroke(); }
      // мухи вьются вокруг
      for (let i = 0; i < 3; i++) {
        const a = e.t * 0.2 + i * 2.1, fx = x + Math.cos(a) * 14, fy = y - 18 + Math.sin(a) * 6 + (L ? Math.sin(e.t * 0.7 + i) * 1.2 : 0);
        if (L) mobGnat(c, fx, fy, e.t + i, L); else circle(c, fx, fy, 1.6, '#111');
      }
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
      const L = gfxLevel();
      const yy = y + mobBob(e, 8.5);
      const a = angleTo({ x, y: yy }, G.player), ca = Math.cos(a), sa = Math.sin(a);
      if (L) {   // хоботок, сужающийся к концу
        const pl = 14 + Math.sin(e.t * 0.2) * 1.2;
        poly(c, [x - sa * 2.4, yy + ca * 2.4, x + ca * pl - sa * 0.7, yy + sa * pl + ca * 0.7, x + ca * pl + sa * 0.7, yy + sa * pl - ca * 0.7, x + sa * 2.4, yy - ca * 2.4], mobShade('#4a2448'));
        if (L > 1) {
          c.beginPath();
          for (let i = 1; i <= 3; i++) { const d = 9 + i * 1.6, w = 2.2 - i * 0.45; c.moveTo(x + ca * d - sa * w, yy + sa * d + ca * w); c.lineTo(x + ca * d + sa * w, yy + sa * d - ca * w); }
          c.strokeStyle = 'rgba(20,5,20,0.6)'; c.lineWidth = 0.8; c.stroke();
          circle(c, x + ca * pl, yy + sa * pl, 1.1, '#8a1020');
        }
      } else line(c, x, y, x + ca * 13, y + sa * 13, '#3a1a3a', 2.4);
      const fy = drawFly(c, e, x, y, '#6a3a6a', 8.5);
      if (L) {   // присоска-рот
        ellipse(c, x, fy + 3, 3.2, 2.3, mobShade('#8a5a8a', 0.1));
        circle(c, x, fy + 3, 1.3, '#2a0a2a');
      } else circle(c, x, y + 2, 3, fc('#8a5a8a'));
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
      const L = gfxLevel();
      const air = e.z > 3;
      const [sx, sy] = L ? mobHopSquash(e, 10) : MOB_SQ1;
      mobLegs(c, x, y, air, 1.3, '#8a5a4a', 4, L, (sy < 1 ? (1 - sy) * 18 : 0));
      const cy = y - 7 * sy;
      mobEll(c, x, cy, 11 * sx, 11 * sy, '#9a6a58', OUT, 2);
      if (L > 1) {
        c.beginPath();
        c.moveTo(x + 8.4, cy + 2); c.arc(x + 7, cy + 2, 1.4, 0, Math.PI * 2); c.moveTo(x - 6.5, cy + 3.5); c.arc(x - 7.5, cy + 3.5, 1, 0, Math.PI * 2); c.moveTo(x + 4.9, cy - 7); c.arc(x + 4, cy - 7, 0.9, 0, Math.PI * 2);
        c.fillStyle = mobShade('#9a6a58', -0.22); c.fill();
        c.beginPath(); c.moveTo(x - 9.5, cy - 4); c.quadraticCurveTo(x - 6, cy - 6, x - 4, cy - 9.5); c.strokeStyle = 'rgba(90,20,40,0.45)'; c.lineWidth = 0.9; c.stroke();
      }
      mobGloss(c, x - 4.5, cy - 5.5, 3.4, 1.9, 0.3);
      hollowEyes(c, x, cy - 3 * sy, 4, 2.6, true, e.t);
      ellipse(c, x, cy + 5 * sy, 3.5, air ? 3.4 : 2.5, '#1a0606');
      if (L > 1) ellipse(c, x, cy + 5 * sy + 1.2, 2, 1, '#7a2222');
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
      const L = gfxLevel();
      if (L) y += Math.sin(e.t * 0.09) * 1.5;
      const sw = L ? Math.sin(e.t * 0.06) * 2 : 0;   // подол колышется
      mobGlow(c, x, y - 4, 24, '190,210,255', 0.28);
      if (L > 1) for (let s = -1; s <= 1; s += 2) {   // ручки-обрывки
        const ay = y - 1 + Math.sin(e.t * 0.12 + s) * 1.5;
        poly(c, [x + s * 9, ay - 3.5, x + s * 15.5, ay + 0.5, x + s * 9.5, ay + 3], mobShade('#dfe4ee', -0.05), 'rgba(40,40,60,0.7)', 1.1);
      }
      c.beginPath();
      c.moveTo(x - 11 + sw, y + 8);
      c.quadraticCurveTo(x - 13, y - 16, x, y - 16);
      c.quadraticCurveTo(x + 13, y - 16, x + 11 + sw, y + 8);
      for (let i = 0; i < 4; i++) {
        const xx = x + 11 - (i + 1) * 5.5 + sw;
        c.quadraticCurveTo(xx + 2.75, y + 8 + (i % 2 ? -4 : 4) + Math.sin(e.t * 0.2 + i) * 2, xx, y + 8);
      }
      c.closePath();
      mobFill(c, '#e8ecf4', x, y - 6, 13, 15);
      c.strokeStyle = 'rgba(40,40,60,0.8)'; c.lineWidth = 1.5; c.stroke();
      mobGloss(c, x - 5, y - 11, 3.5, 2, 0.5);
      ellipse(c, x - 4, y - 5, 2.5, 3.5, '#111'); ellipse(c, x + 4, y - 5, 2.5, 3.5, '#111');
      if (L > 1 && !FLASH) { circle(c, x - 4, y - 4.4, 1, 'rgba(170,210,255,0.85)'); circle(c, x + 4, y - 4.4, 1, 'rgba(170,210,255,0.85)'); }
      if (L) mobLines2(c, x - 6.5, y - 9.2, x - 2.2, y - 9.8, x + 6.5, y - 9.2, x + 2.2, y - 9.8, 'rgba(40,40,60,0.6)', 1);
      ellipse(c, x, y + 2, 2.5, 2.8 + (L ? Math.sin(e.t * 0.1) * 0.7 : 0), '#222');
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
      const L = gfxLevel();
      // нора с земляным валиком
      if (L) {
        ellipse(c, x, y + 4, 14.5, 7, '#4a2e1c');
        ellipse(c, x, y + 4.4, 11.5, 5, '#120a06');
        if (L > 1) {
          c.beginPath();
          c.moveTo(x - 11.2, y + 2); c.arc(x - 13, y + 2, 1.8, 0, Math.PI * 2); c.moveTo(x + 14, y + 6); c.arc(x + 12.5, y + 6, 1.5, 0, Math.PI * 2); c.moveTo(x + 7.3, y - 2); c.arc(x + 6, y - 2, 1.3, 0, Math.PI * 2);
          c.fillStyle = '#5a3a24'; c.fill();
        }
      } else ellipse(c, x, y + 4, 13, 6, '#1a0f0a', 'rgba(0,0,0,0.5)', 1.5);
      let k = 1;
      if (e.st === 'rise') k = 1 - e.timer / 20;
      if (e.st === 'down') k = e.timer / 20;
      const h = 22 * k;
      if (h < 1) return;
      const top = y + 4 - h;
      const open = L && e.st === 'up' && e.timer > 38 && e.timer < 60 ? Math.sin((60 - e.timer) / 22 * Math.PI) : 0;   // рот перед плевком
      c.save();
      c.beginPath(); c.rect(x - 20, y - 40, 40, 44); c.clip();
      rrect(c, x - 7, top, 14, h + 4, 7, null);
      mobFill(c, '#d48888', x, top, 7.5, 1, 0, true);
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
      if (L) {   // кольца
        c.beginPath();
        for (let yy = y + 1; yy > top + 9; yy -= 4.5) { c.moveTo(x - 6.6, yy); c.quadraticCurveTo(x, yy + 2, x + 6.6, yy); }
        c.strokeStyle = 'rgba(120,40,40,0.5)'; c.lineWidth = 1; c.stroke();
        mobGloss(c, x - 3.2, top + 4, 1.4, 3, 0.35, 0);
      }
      const mr = 2.5 + open * 1.8;
      circle(c, x, top + 5, mr, '#3a0a0a');
      if (open > 0.2) {   // круглая пасть с зубами
        circle(c, x, top + 5, mr * 0.55, '#120202');
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, tx = x + Math.cos(a) * mr * 0.8, ty = top + 5 + Math.sin(a) * mr * 0.8; c.moveTo(tx + 0.55, ty); c.arc(tx, ty, 0.55, 0, Math.PI * 2); }
        c.fillStyle = '#f0e8d8'; c.fill();
      }
      circle(c, x - 3, top + 1, 1.3, '#111'); circle(c, x + 3, top + 1, 1.3, '#111');
      if (L > 1) { circle(c, x - 3.3, top + 0.6, 0.45, '#fff'); circle(c, x + 2.7, top + 0.6, 0.45, '#fff'); }
      c.restore();
      if (L) {   // передний край норы поверх червя
        c.beginPath(); c.ellipse(x, y + 4, 12.8, 6, 0, 0.15, Math.PI - 0.15);
        c.strokeStyle = '#4a2e1c'; c.lineWidth = 2.6; c.stroke();
        if (L > 1 && e.st !== 'up') for (let i = 0; i < 4; i++) {   // осыпается земля
          const p = ((e.t * 0.05 + i * 0.27) % 1);
          circle(c, x + (i - 1.5) * 6, y + 2 - p * 8 + p * p * 10, 1 - p * 0.4, '#6a4a30');
        }
      }
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
      const L = gfxLevel(), t = e.t, col = '#c9a296';
      // сжатие/растяжение: приземление, прыжок, вдох перед плевком, дыхание
      let sx = 1, sy = 1;
      if (e.st === 'hop') {
        if (e.z < 2) { sx = 1.06; sy = 1 / 1.06; }
        else if (L) { const v = Math.abs(Math.cos(e.jt / e.jd * Math.PI)); sx = 1 - v * 0.05; sy = 1 + v * 0.07; }
      } else if (e.st === 'jump' && e.z > 5) { sx = 0.9; sy = 1.14; }
      else if (e.st === 'spit' && L) { const k = e.timer > 22 ? (55 - e.timer) / 33 : e.timer / 22; sx = 1 + k * 0.05; sy = 1 + k * 0.04; }
      else if (L) { const b = Math.sin(t * 0.07) * 0.015; sx = 1 + b; sy = 1 - b; }
      const rx = 37 * sx, ry = 32 * sy, cy = y + 14 - ry;   // низ тела на месте
      const ox = (u) => x + u * sx, oy = (v) => y + 14 + (v - 14) * sy;
      if (L) {
        mobLumpPath(c, x, cy, rx, ry, 0.045, 0.6, L > 1 ? t * 0.03 : 0, 22);
        mobFill(c, col, x, cy, rx, ry);
        c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
        // бугры, бородавки и пятна
        mobBall(c, ox(-22), oy(-38), 6.5, '#d4b0a4', 'rgba(60,30,25,0.35)', 1);
        mobBall(c, ox(18), oy(-42), 5.5, '#d4b0a4', 'rgba(60,30,25,0.35)', 1);
        mobBall(c, ox(29), oy(-20), 3.5, '#d4b0a4', 'rgba(60,30,25,0.3)', 1);
        if (L > 1) {
          const sp = 'rgba(120,60,50,0.35)';
          circle(c, ox(-28), oy(-14), 1.6, sp); circle(c, ox(-24), oy(-9), 1.1, sp); circle(c, ox(24), oy(-6), 1.4, sp); circle(c, ox(4), oy(-44), 1.2, sp); circle(c, ox(-6), oy(-40), 0.9, sp);
          c.beginPath(); c.moveTo(ox(-32), oy(-26)); c.quadraticCurveTo(ox(-27), oy(-30), ox(-26), oy(-36)); c.moveTo(ox(31), oy(-12)); c.quadraticCurveTo(ox(27), oy(-15), ox(26), oy(-22));
          c.strokeStyle = 'rgba(150,40,60,0.35)'; c.lineWidth = 1; c.stroke();
        }
        // складка подбородка
        c.beginPath(); c.moveTo(ox(-20), oy(4)); c.quadraticCurveTo(x, oy(11), ox(20), oy(4));
        c.strokeStyle = 'rgba(90,40,35,0.4)'; c.lineWidth = 1.5; c.stroke();
        mobGloss(c, ox(-14), oy(-40), 9, 4.5, 0.25);
      } else {
        ellipse(c, x, y - 18, rx, ry, fc(col), OUT, 3);
        ellipse(c, x, y - 6, 30, 16, fc('#b58a80'));
        circle(c, x - 22, y - 38, 6, fc('#d4b0a4'));
        circle(c, x + 18, y - 42, 5, fc('#d4b0a4'));
      }
      pupilEye(c, ox(-13), oy(-30), 7.5, e, true, e.mouth ? null : col, -1);
      pupilEye(c, ox(12), oy(-28), 5.5, e, true, e.mouth ? null : col, 1);
      if (e.mouth) {
        // пасть с зубами, языком и слюной
        const my = oy(-8), op = e.timer > 22 ? 1 : 0.85 + e.timer / 22 * 0.15;
        ellipse(c, x, my, 17 * sx, 13 * op, '#2a0606', OUT, 2);
        if (L) {
          ellipse(c, x, my + 2, 12 * sx, 8 * op, '#120202');
          ellipse(c, x + 2, my + 8 * op, 9, 4, '#a83a3a');
          for (let i = -1; i <= 1; i++) poly(c, [x + i * 9 - 2.6, my + 11 * op, x + i * 9 + 2.6, my + 11 * op, x + i * 9, my + 6.5 * op], '#e8dcc0');
        }
        for (let i = -2; i <= 2; i++) poly(c, [x + i * 6 - 3, my - 11 * op, x + i * 6 + 3, my - 11 * op, x + i * 6, my - 5 * op], '#f0e8d8');
        if (L > 1) { line(c, x - 9, my - 7, x - 8, my + 6, 'rgba(230,230,210,0.55)', 1); line(c, x + 11, my - 6, x + 10.5, my + 4, 'rgba(230,230,210,0.5)', 0.9); }
      } else {
        c.beginPath(); c.moveTo(ox(-16), oy(-8)); c.quadraticCurveTo(x, oy(-14), ox(16), oy(-8));
        c.strokeStyle = '#2a0606'; c.lineWidth = 3; c.stroke();
        if (L) {
          c.beginPath(); c.moveTo(ox(-12), oy(-6.5)); c.quadraticCurveTo(x, oy(-11), ox(12), oy(-6.5));
          c.strokeStyle = 'rgba(90,40,35,0.35)'; c.lineWidth = 1.5; c.stroke();
          if (L > 1) mobDrip(c, ox(14), oy(-7.5), 7, t * 0.01, 'rgba(230,232,215,0.8)', 1.3);
        }
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
      const L = gfxLevel(), t = e.t, col = '#6f5638', bl = e.belch > 0;
      if (L) y += Math.sin(t * 0.05) * 2;
      if (L) mobWings(c, x, y - 14, 21, t, 1.1, L, 20);
      else {
        const f = Math.sin(t * 1.1) * 0.4;
        ellipse(c, x - 30, y - 18, 22, 11, 'rgba(225,225,235,0.6)', 'rgba(0,0,0,0.3)', 1, -0.4 + f);
        ellipse(c, x + 30, y - 18, 22, 11, 'rgba(225,225,235,0.6)', 'rgba(0,0,0,0.3)', 1, 0.4 - f);
      }
      const s = bl ? 1 + Math.sin(e.belch * 0.5) * 0.06 : 1 + (L ? Math.sin(t * 0.07) * 0.015 : 0);
      const r = 30 * s;
      if (L) {
        // косматый мешок: шерсть торчит из-под контура
        c.beginPath();
        for (let i = 0; i < 40; i++) {
          const a = i / 40 * Math.PI * 2 + Math.sin(i * 7.3) * 0.05, l = r + 2.5 + (i * 5 % 3) + Math.sin(t * 0.2 + i) * 0.6;
          c.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
          c.lineTo(x + Math.cos(a + 0.08) * l, y + Math.sin(a + 0.08) * l);
        }
        c.strokeStyle = OUT; c.lineWidth = 1.6; c.lineCap = 'round'; c.stroke();
        mobLumpPath(c, x, y, r, r * 0.97, 0.03, 2.2, L > 1 ? t * 0.04 : 0, 20);
        mobFill(c, col, x, y, r, r);
        c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
        mobEll(c, x, y + 9, 20 * s, 13 * s, '#8a7050');
        for (let i = 0; i < 4; i++) {
          const d = MOB_DUKE_WARTS[i];
          mobBall(c, x + d[0] * s, y + d[1] * s, d[2], '#5a4428', 'rgba(20,10,0,0.35)', 0.8);
        }
        if (L > 1) {   // волоски на бородавках и прожилки
          c.beginPath();
          for (let i = 0; i < 4; i++) { const d = MOB_DUKE_WARTS[i]; c.moveTo(x + d[0] * s, y + d[1] * s - d[2]); c.lineTo(x + d[0] * s + 1.5, y + d[1] * s - d[2] - 3); }
          c.moveTo(x - 25, y + 2); c.quadraticCurveTo(x - 20, y - 2, x - 21, y - 9);
          c.strokeStyle = 'rgba(30,15,5,0.7)'; c.lineWidth = 0.9; c.stroke();
        }
        mobGloss(c, x - 11, y - 18, 7, 3.5, 0.22);
      } else {
        circle(c, x, y, r, fc(col), OUT, 3);
        ellipse(c, x, y + 8, 20, 14, fc('#8a7050'));
        for (let i = 0; i < 4; i++) { const d = MOB_DUKE_WARTS[i]; circle(c, x + d[0], y + d[1], d[2], fc('#5a4428')); }
      }
      pupilEye(c, x - 10, y - 6, 6.5, e, true, bl ? null : col, -1);
      pupilEye(c, x + 10, y - 6, 6.5, e, true, bl ? null : col, 1);
      if (L) {   // кустистые брови
        line(c, x - 17, y - 15, x - 5, y - 11.5 + (bl ? -1.5 : 0), OUT, 3);
        line(c, x + 17, y - 15, x + 5, y - 11.5 + (bl ? -1.5 : 0), OUT, 3);
      }
      // рот: при отрыжке раскрыт, с зубами и брызгами
      const mw = bl ? 10 : 7.5, mh = bl ? 8 : 3;
      ellipse(c, x, y + 10, mw, mh, '#1a0a04', L ? OUT : null, 1.2);
      if (L) {
        if (bl) {
          ellipse(c, x, y + 14, 6, 3, '#7a2a20');
          for (let i = -1; i <= 1; i++) poly(c, [x + i * 5 - 2, y + 3.2, x + i * 5 + 2, y + 3.2, x + i * 5, y + 7], '#e6dcc0');
          if (L > 1) for (let i = 0; i < 3; i++) { const a = 1.2 + i * 0.4, d = 12 + (24 - e.belch) * 0.8; circle(c, x + Math.cos(a) * d - 6, y + 10 + Math.sin(a) * d * 0.6, 1.3, 'rgba(120,160,60,0.7)'); }
        } else {
          poly(c, [x - 4.5, y + 8, x - 2, y + 8, x - 3.2, y + 11], '#e6dcc0');
          poly(c, [x + 2.5, y + 8, x + 5, y + 8, x + 3.8, y + 10.5], '#e6dcc0');
        }
      }
      // рой мух вокруг
      const n = L ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = t * (i % 2 ? 0.07 : -0.09) + i * 1.3, d = 38 + Math.sin(t * 0.13 + i * 2) * 5;
        const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.55 - 4 + Math.sin(t * 0.6 + i) * 1.5;
        if (L) mobGnat(c, fx, fy, t + i, L); else circle(c, fx, fy, 1.8, '#111');
      }
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
      const L = gfxLevel(), n = e.segs.length;
      for (let i = n - 1; i >= 0; i--) {
        const s = e.segs[i], col = i % 2 ? '#c06666' : '#cc7272';
        const r = (13 - i * 0.35) * (i === n - 1 && n > 2 ? 0.82 : 1);
        shadow(c, s.x, s.y + 8, 12, 4, 0.3);
        if (L) {
          // кольцо-перетяжка поперёк направления движения
          const pv = i ? e.segs[i - 1] : e, sy = s.y - 8;
          let ux = pv.x - s.x, uy = pv.y - s.y;
          const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
          mobBall(c, s.x, sy, r, col, OUT, 2);
          c.beginPath();
          c.moveTo(s.x + ux * r * 0.2 - uy * r * 0.9, sy + uy * r * 0.2 + ux * r * 0.9);
          c.quadraticCurveTo(s.x + ux * r * 0.75, sy + uy * r * 0.75, s.x + ux * r * 0.2 + uy * r * 0.9, sy + uy * r * 0.2 - ux * r * 0.9);
          c.strokeStyle = mobShade(col, -0.32); c.lineWidth = 2.2; c.stroke();
          if (L > 1) { c.strokeStyle = 'rgba(255,200,200,0.25)'; c.lineWidth = 0.9; c.stroke(); }
          mobGloss(c, s.x - r * 0.35, sy - r * 0.42, r * 0.32, r * 0.18, 0.35);
          if (i === n - 1 && n > 2) circle(c, s.x - ux * r * 0.9, sy - uy * r * 0.9, 2, mobShade(col, -0.2), OUT, 1.2);   // кончик хвоста
        } else {
          circle(c, s.x, s.y - 8, r, fc(col), OUT, 2);
          ellipse(c, s.x - 4, s.y - 13, 4, 2.5, fc('#e09a9a'));
        }
      }
      mobBall(c, x, y - 8, 15, '#d27a7a', OUT, 2.5);
      mobGloss(c, x - 5, y - 14, 5, 2.6, 0.32);
      const [dx, dy] = DIRS[e.dir];
      const mx = x + dx * 10, my = y - 6 + dy * 8;
      if (L) {
        // глаза в три четверти, злые брови и чавкающая пасть с зубами
        let ex1, ey1, ex2, ey2;
        if (dx) { ex1 = x + dx * 2.5; ey1 = y - 15.5; ex2 = x + dx * 9.5; ey2 = y - 13.5; }
        else { ex1 = x - 5.5; ex2 = x + 5.5; ey1 = ey2 = y - 12 + dy * 4; }
        circle(c, ex1, ey1, 3.2, '#fff', OUT, 1); circle(c, ex2, ey2, 3.2, '#fff', OUT, 1);
        circle(c, ex1 + dx * 1.2, ey1 + dy * 1.2, 1.5, '#111'); circle(c, ex2 + dx * 1.2, ey2 + dy * 1.2, 1.5, '#111');
        if (dy >= 0) {
          const s1 = ex1 < ex2 ? 1 : -1;
          line(c, ex1 - s1 * 3.2, ey1 - 4.6, ex1 + s1 * 2.4, ey1 - 2.8, OUT, 1.8);
          line(c, ex2 + s1 * 3.2, ey2 - 4.6, ex2 - s1 * 2.4, ey2 - 2.8, OUT, 1.8);
        }
        if (dy >= 0) {   // ползёт вверх — пасть не видна
          const mr = 4 + Math.sin(e.t * 0.25) * 1.1;
          circle(c, mx, my, mr, '#3a0808', OUT, 1);
          circle(c, mx, my + 0.5, mr * 0.5, '#160202');
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; circle(c, mx + Math.cos(a) * mr * 0.78, my + Math.sin(a) * mr * 0.78, 0.7, '#f0e8d8'); }
          if (L > 1) mobDrip(c, mx + 1, my + mr, 5, e.t * 0.012, 'rgba(230,230,215,0.7)', 1);
        }
      } else {
        circle(c, x + dx * 6 - dy * 5, y - 12 + dy * 4, 3, '#fff', OUT, 1);
        circle(c, x + dx * 6 + dy * 5, y - 12 + dy * 4, 3, '#fff', OUT, 1);
        circle(c, x + dx * 7 - dy * 5, y - 12 + dy * 5, 1.4, '#111');
        circle(c, x + dx * 7 + dy * 5, y - 12 + dy * 5, 1.4, '#111');
        circle(c, mx, my, 4, '#3a0808');
      }
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
      const L = gfxLevel(), ch = e.st === 'charge';
      const pt = e.partner;
      if (pt && !pt.dead) {
        // пуповина к младшему брату (на экране «VS» он нарисован со сдвигом 40,-20 от точки 0,20)
        const vs = x !== e.x, px = vs ? x + 40 : pt.x, py = vs ? y - 40 : pt.y - 10;
        c.beginPath(); c.moveTo(x, y - 12);
        c.quadraticCurveTo((x + px) / 2 + Math.sin(e.t * 0.1) * 12, (y + py) / 2 + 20, px, py);
        if (L) {
          c.strokeStyle = OUT; c.lineWidth = 7; c.stroke();
          c.strokeStyle = mobShade('#b04a5c'); c.lineWidth = 5; c.stroke();
          c.setLineDash(MOB_DASH); c.lineDashOffset = -e.t * 0.25;
          c.strokeStyle = 'rgba(255,190,200,0.55)'; c.lineWidth = 1.6; c.stroke();
          if (L > 1) { c.lineDashOffset = -e.t * 0.25 + 3.5; c.strokeStyle = 'rgba(90,20,60,0.55)'; c.lineWidth = 1.4; c.stroke(); }
          c.setLineDash(MOB_NODASH); c.lineDashOffset = 0;
        } else {
          c.strokeStyle = '#8a2a3a'; c.lineWidth = 5; c.stroke();
          c.strokeStyle = '#c45a6a'; c.lineWidth = 2.5; c.stroke();
        }
      }
      const b = walkerBody(c, e, x, y + 2, '#c98a76', 1.9);
      const hy = y - 26 - b, skin = '#d79a86';
      if (L) for (let s = -1; s <= 1; s += 2) mobEll(c, x + s * 16.5, hy + 1, 3.2, 4.4, skin, OUT, 1.6);   // уши
      mobBall(c, x, hy, 17, skin, OUT, 2.5);
      if (L && ch && !FLASH) circle(c, x, hy, 15.5, 'rgba(220,30,30,0.22)');   // наливается кровью при рывке
      if (L > 1) {   // вздутая вена на лбу
        c.beginPath(); c.moveTo(x + 3, hy - 16); c.quadraticCurveTo(x + 5.5, hy - 12, x + 3.5, hy - 9); c.moveTo(x + 4.6, hy - 12.5); c.lineTo(x + 8, hy - 11);
        c.strokeStyle = 'rgba(110,40,90,' + (ch ? 0.8 : 0.5) + ')'; c.lineWidth = ch ? 1.6 : 1.1; c.stroke();
      }
      mobGloss(c, x - 7, hy - 9, 5, 2.6, 0.28);
      const by = ch ? 1 : 0;
      line(c, x - 11, hy - 8 + by, x - 3, hy - 4, '#1a0606', 2.5);
      line(c, x + 11, hy - 8 + by, x + 3, hy - 4, '#1a0606', 2.5);
      circle(c, x - 6, hy - 2, 2.5, '#111'); circle(c, x + 6, hy - 2, 2.5, '#111');
      if (L) { circle(c, x - 6.8, hy - 2.8, 0.8, ch ? '#ff5a3a' : '#fff'); circle(c, x + 5.2, hy - 2.8, 0.8, ch ? '#ff5a3a' : '#fff'); }
      // оскал
      const mh = ch ? 6 : 4;
      ellipse(c, x, hy + 8, 8, mh, '#2a0606');
      if (L) ellipse(c, x, hy + 8 + mh * 0.5, 5, mh * 0.4, '#8a2a2a');
      for (let i = -2; i <= 2; i++) poly(c, [x + i * 3 - 1.5, hy + 5, x + i * 3 + 1.5, hy + 5, x + i * 3, hy + 8], '#f0e8d8');
      if (L) for (let i = -1; i <= 1; i++) poly(c, [x + i * 3.6 - 1.4, hy + 8 + mh * 0.95, x + i * 3.6 + 1.4, hy + 8 + mh * 0.95, x + i * 3.6, hy + 6 + mh * 0.6], '#e6dcc4');
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
      const L = gfxLevel();
      if (L) y += Math.sin(e.t * 0.1) * 1.5;
      mobBall(c, x, y, 13, '#e8b7a6', OUT, 2);
      if (L) {
        // хохолок, румянец, грустные брови
        c.beginPath(); c.moveTo(x - 1, y - 12.6); c.quadraticCurveTo(x + 4, y - 18.5, x + 0.5, y - 19.5); c.quadraticCurveTo(x - 2, y - 19, x - 1.2, y - 17);
        c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
        ellipse(c, x - 8.5, y + 3, 2.6, 1.6, 'rgba(230,90,90,0.35)'); ellipse(c, x + 8.5, y + 3, 2.6, 1.6, 'rgba(230,90,90,0.35)');
        line(c, x - 7.5, y - 5.4, x - 2.5, y - 7, OUT, 1.3); line(c, x + 7.5, y - 5.4, x + 2.5, y - 7, OUT, 1.3);
        mobGloss(c, x - 5, y - 6.5, 3.6, 2, 0.35);
      }
      ellipse(c, x - 4.5, y - 1, 2.6, 3.4, '#111'); ellipse(c, x + 4.5, y - 1, 2.6, 3.4, '#111');
      circle(c, x - 5.3, y - 2.2, 0.9, '#fff'); circle(c, x + 3.7, y - 2.2, 0.9, '#fff');
      if (L) {   // слёзы ручьём
        c.beginPath(); c.moveTo(x - 5, y + 2); c.quadraticCurveTo(x - 6.5, y + 6, x - 5.5, y + 10); c.moveTo(x + 5, y + 2); c.quadraticCurveTo(x + 6.5, y + 6, x + 5.5, y + 10);
        c.strokeStyle = 'rgba(130,190,250,0.8)'; c.lineWidth = 1.6; c.stroke();
        if (L > 1) { mobDrip(c, x - 5.5, y + 10, 5, e.t * 0.03, 'rgba(130,190,250,0.85)', 1.1); mobDrip(c, x + 5.5, y + 10, 5, e.t * 0.03 + 0.5, 'rgba(130,190,250,0.85)', 1.1); }
      }
      ellipse(c, x, y + 6, 3, 2 + (L ? Math.abs(Math.sin(e.t * 0.15)) * 1.2 : 0), '#3a0a0a');
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
      const L = gfxLevel(), t = e.t;
      const fl = e.vx < 0 ? -1 : 1, ch = e.st === 'charge';
      const gal = Math.sin(t * (ch ? 0.5 : 0.3)) * 3;
      const horse = '#2c2a30', cloak = '#3e2c3a';
      if (!L) {
        for (let k = -1; k <= 1; k += 2) {
          line(c, x + k * 12, y + 6, x + k * 14 + gal * k, y + 20, '#1a181c', 4);
          line(c, x + k * 5, y + 8, x + k * 4 - gal * k, y + 21, '#1a181c', 4);
        }
        ellipse(c, x, y + 4, 22, 12, fc(horse), '#000', 2);
        ellipse(c, x + fl * 22, y - 4, 9, 7, fc(horse), '#000', 2);
        circle(c, x + fl * 25, y - 6, 1.8, '#ff3030');
        poly(c, [x - 10, y - 2, x + 10, y - 2, x + 7, y - 30, x - 7, y - 30], fc(cloak), '#000', 2);
        circle(c, x, y - 30, 9, fc(cloak), '#000', 2);
        circle(c, x + fl * 2, y - 29, 6, '#e8e2d4');
        circle(c, x + fl * 2 - 2.2, y - 30, 1.6, '#111'); circle(c, x + fl * 2 + 2.2, y - 30, 1.6, '#111');
        for (let i = 0; i < 4; i++) { const a = t * 0.15 + i * 1.57; circle(c, x + Math.cos(a) * 30, y - 20 + Math.sin(a) * 10, 1.8, '#111'); }
        return;
      }
      if (ch && !FLASH) {   // полосы рывка
        c.beginPath();
        for (let j = 0; j < 4; j++) { const yy = y - 24 + j * 11, l0 = 30 + ((t * 4 + j * 9) % 14); c.moveTo(x - fl * l0, yy); c.lineTo(x - fl * (l0 + 18), yy); }
        c.strokeStyle = 'rgba(220,210,240,0.35)'; c.lineWidth = 2; c.stroke();
      }
      // хвост
      c.beginPath(); c.moveTo(x - fl * 19, y - 1); c.quadraticCurveTo(x - fl * 33, y - 4 + gal, x - fl * 31, y + 14 + gal * 0.6);
      c.strokeStyle = '#0c0a0e'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke();
      if (L > 1) { c.strokeStyle = 'rgba(120,110,140,0.35)'; c.lineWidth = 1.2; c.stroke(); }
      // суставчатые ноги с копытами
      c.beginPath();
      for (let k = -1; k <= 1; k += 2) {
        const g = gal * k, hx = x + k * 12, kx = x + k * 13 + g * 0.6, fx = x + k * 14 + g;
        c.moveTo(hx, y + 6); c.lineTo(kx, y + 13); c.lineTo(fx, y + 20);
        const hx2 = x + k * 5, kx2 = x + k * 5.5 - g * 0.6, fx2 = x + k * 4 - g;
        c.moveTo(hx2, y + 8); c.lineTo(kx2, y + 14.5); c.lineTo(fx2, y + 21);
      }
      c.lineJoin = 'round';
      c.strokeStyle = '#000'; c.lineWidth = 5.6; c.stroke();
      c.strokeStyle = mobShade('#1e1c22'); c.lineWidth = 3.6; c.stroke();
      for (let k = -1; k <= 1; k += 2) {
        rrect(c, x + k * 14 + gal * k - 2.6, y + 19.5, 5.2, 3, 1, '#0a0a0c');
        rrect(c, x + k * 4 - gal * k - 2.6, y + 20.5, 5.2, 3, 1, '#0a0a0c');
      }
      mobGlow(c, x, y - 14, 40, '70,30,110', 0.35);
      // туловище, шея и голова коня
      mobEll(c, x, y + 4, 22, 12, horse, '#000', 2);
      if (!FLASH) { c.beginPath(); c.ellipse(x, y + 4, 19.5, 9.5, 0, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = 'rgba(170,150,215,0.35)'; c.lineWidth = 1.4; c.stroke(); }
      if (L > 1) { c.beginPath(); c.arc(x - fl * 8, y + 4, 7, -0.9, 0.9); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke(); }   // рёбра
      poly(c, [x + fl * 10, y - 3, x + fl * 16, y - 13, x + fl * 24, y - 10, x + fl * 20, y + 3], mobShade(horse), '#000', 2);
      mobEll(c, x + fl * 25, y - 6, 10, 6.2, horse, '#000', 2, fl * 0.5);
      if (!FLASH) line(c, x + fl * 21, y - 9.5, x + fl * 30, y - 4, 'rgba(200,190,225,0.3)', 1.6);   // проплешина-«череп» на морде
      poly(c, [x + fl * 19, y - 10.5, x + fl * 20, y - 16.5, x + fl * 23, y - 11], mobShade(horse, -0.1), '#000', 1.2);   // ухо
      // грива
      c.beginPath(); c.moveTo(x + fl * 9, y - 3);
      for (let i = 0; i < 5; i++) { const u = i / 4; c.lineTo(x + fl * (10 + u * 9) - fl * 3, y - 6 - u * 9 + Math.sin(t * 0.3 + i) * 1.2); c.lineTo(x + fl * (12 + u * 8), y - 3 - u * 9); }
      c.closePath(); c.fillStyle = mobShade('#0e0c10'); c.fill();
      circle(c, x + fl * 32, y - 3.5, 0.9, '#000');   // ноздря
      mobGlow(c, x + fl * 25, y - 7, 6, '255,40,30', 0.7);
      circle(c, x + fl * 25, y - 7, 1.9, '#ff3030');
      // всадник: рваный плащ
      c.beginPath(); c.moveTo(x - 7, y - 30); c.lineTo(x + 7, y - 30); c.lineTo(x + 10.5, y - 3);
      for (let i = 1; i < 6; i++) c.lineTo(x + 10.5 - i * 3.5, y - 3 + (i % 2 ? 3.5 : -0.5) + Math.sin(t * 0.25 + i) * 0.8);
      c.lineTo(x - 10.5, y - 2); c.closePath();
      mobFill(c, cloak, x, y - 16, 12, 16);
      c.strokeStyle = '#000'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
      // костлявая рука с поводьями
      line(c, x + fl * 4, y - 20, x + fl * 12, y - 13, '#000', 3);
      line(c, x + fl * 4, y - 20, x + fl * 12, y - 13, mobShade('#d8d0c0'), 1.5);
      line(c, x + fl * 12, y - 13, x + fl * 22, y - 8, 'rgba(150,120,90,0.8)', 0.8);
      // капюшон и череп
      mobBall(c, x, y - 30, 9.5, cloak, '#000', 2);
      if (!FLASH) { c.beginPath(); c.arc(x, y - 30, 7.6, Math.PI * 1.1, Math.PI * 1.6); c.strokeStyle = 'rgba(190,160,220,0.35)'; c.lineWidth = 1.3; c.stroke(); }
      ellipse(c, x + fl * 2.6, y - 28.6, 6.4, 7, '#0a0608');
      ellipse(c, x + fl * 2.8, y - 28.2, 4.6, 5.4, mobShade('#e8e2d4'));
      circle(c, x + fl * 2.8 - 2, y - 29.6, 1.6, '#111'); circle(c, x + fl * 2.8 + 2, y - 29.6, 1.6, '#111');
      mobGlow(c, x + fl * 2.8, y - 29.6, 7, '255,40,30', 0.45);
      circle(c, x + fl * 2.8 - 2, y - 29.6, 0.6, '#ff4a3a'); circle(c, x + fl * 2.8 + 2, y - 29.6, 0.6, '#ff4a3a');
      c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(x + fl * 2.8 + i * 1.2, y - 25.6); c.lineTo(x + fl * 2.8 + i * 1.2, y - 24); }
      c.strokeStyle = '#3a3030'; c.lineWidth = 0.6; c.stroke();
      line(c, x + fl * 2.8 - 2.4, y - 25.6, x + fl * 2.8 + 2.4, y - 25.6, '#3a3030', 0.6);
      mobGloss(c, x - 4, y - 35, 3, 1.5, 0.2);
      // мухи
      for (let i = 0; i < 4; i++) { const a = t * 0.15 + i * 1.57; mobGnat(c, x + Math.cos(a) * 30, y - 20 + Math.sin(a) * 10 + Math.sin(t * 0.6 + i) * 1.2, t + i, L); }
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
      const L = gfxLevel(), r = e.r, t = e.t;
      if (!L) {
        const sq = e.st === 'rest' ? 1 + Math.sin(t * 0.2) * 0.04 : 0.92;
        ellipse(c, x, y - r * 0.6, r * sq, r * 0.85 / sq, fc('#b01c2a'), OUT, 2.5);
        ellipse(c, x - r * 0.35, y - r * 0.95, r * 0.28, r * 0.16, fc('#e2606a'));
        circle(c, x - r * 0.3, y - r * 0.6, Math.max(1.5, r * 0.12), '#1a0404');
        circle(c, x + r * 0.3, y - r * 0.6, Math.max(1.5, r * 0.12), '#1a0404');
        return;
      }
      // желе: трясётся в покое, вытягивается в прыжке
      let sx, sy;
      if (e.st === 'jump' && e.jd) { const v = Math.abs(Math.cos(e.jt / e.jd * Math.PI)); sx = 0.94 - v * 0.05; sy = 1.06 + v * 0.08; }
      else { const w = Math.sin(t * 0.2) * 0.04; sx = 1 + w; sy = 1 - w; }
      const rx = r * sx, ry = r * 0.85 * sy, cy = y + r * 0.25 - ry;
      mobLumpPath(c, x, cy, rx, ry, 0.035, e.size * 1.7, t * 0.09, 16);
      c.save(); c.globalAlpha *= 0.86; mobFill(c, '#b01c2a', x, cy, rx, ry); c.restore();
      c.strokeStyle = OUT; c.lineWidth = r > 15 ? 2.5 : 2; c.stroke();
      // тёмное ядро внутри
      if (!FLASH) {
        c.save(); c.globalAlpha *= 0.7;
        mobEll(c, x + rx * 0.1 + Math.sin(t * 0.07) * rx * 0.06, cy + ry * 0.18 + Math.cos(t * 0.09) * ry * 0.05, rx * 0.52, ry * 0.46, '#5a0610');
        c.restore();
        if (L > 1 && r > 12) for (let i = 0; i < 3; i++) {   // пузырьки
          const p = (t * 0.006 + i * 0.33) % 1;
          circle(c, x + Math.sin(i * 2.4 + t * 0.03) * rx * 0.45, cy + ry * (0.55 - p * 1.1), r * 0.05 + 0.6, 'rgba(255,170,180,' + (0.45 * Math.sin(p * Math.PI)).toFixed(2) + ')');
        }
      }
      // капли по нижнему краю
      const dc = mobShade('#8a1020');
      ellipse(c, x - rx * 0.45, cy + ry * 0.92, r * 0.07 + 0.8, r * 0.1 + 1, dc);
      ellipse(c, x + rx * 0.3, cy + ry * 0.97, r * 0.06 + 0.7, r * 0.09 + 0.9, dc);
      if (L > 1 && r > 12) mobDrip(c, x + rx * 0.1, cy + ry * 0.98, r * 0.25, t * 0.01, '#8a1020', r * 0.04 + 0.7);
      // глянцевые блики
      mobGloss(c, x - rx * 0.38, cy - ry * 0.48, rx * 0.3, ry * 0.15, 0.55, -0.45, 1);
      mobGloss(c, x - rx * 0.62, cy - ry * 0.12, rx * 0.06, ry * 0.12, 0.4, 0.3);
      mobGloss(c, x + rx * 0.45, cy - ry * 0.55, rx * 0.06, ry * 0.05, 0.6, 0);
      // глаза и рот
      const er = Math.max(1.5, r * 0.12), ey = cy - ry * 0.05;
      ellipse(c, x - rx * 0.3, ey, er * 0.9, er * 1.2, '#1a0404'); ellipse(c, x + rx * 0.3, ey, er * 0.9, er * 1.2, '#1a0404');
      circle(c, x - rx * 0.3 - er * 0.3, ey - er * 0.45, er * 0.32, '#fff'); circle(c, x + rx * 0.3 - er * 0.3, ey - er * 0.45, er * 0.32, '#fff');
      if (r > 12) {
        line(c, x - rx * 0.48, ey - er * 2.3, x - rx * 0.14, ey - er * 1.5, OUT, Math.max(1.2, r * 0.06));
        line(c, x + rx * 0.48, ey - er * 2.3, x + rx * 0.14, ey - er * 1.5, OUT, Math.max(1.2, r * 0.06));
        c.beginPath(); c.moveTo(x - rx * 0.22, ey + er * 2.4);
        c.quadraticCurveTo(x - rx * 0.1, ey + er * 1.6 + Math.sin(t * 0.2) * 0.8, x, ey + er * 2.2); c.quadraticCurveTo(x + rx * 0.1, ey + er * 2.8, x + rx * 0.22, ey + er * 2.1);
        c.strokeStyle = '#1a0404'; c.lineWidth = Math.max(1.2, r * 0.05); c.stroke();
      }
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
      const L = gfxLevel();
      const k = clamp(1 - e.z / 500, 0, 1), sk = 0.4 + 0.6 * k;
      shadow(c, e.x, e.y, e.r * sk, e.r * 0.45 * sk, 0.2 + 0.35 * k);
      if (L) shadow(c, e.x, e.y, e.r * sk * 0.65, e.r * 0.28 * sk, 0.12 + 0.25 * k);
      if (e.st === 'aim') {
        // пульсирующая метка удара
        if (L) { const p = 0.5 + 0.5 * Math.sin(e.t * 0.45); ellipse(c, e.x, e.y, e.r * sk + 2, e.r * 0.45 * sk + 1, null, 'rgba(120,0,0,' + (0.2 + p * 0.25).toFixed(2) + ')', 2); }
        return;
      }
      const fy = e.y - e.z - 6, x = e.x, skin = '#e8bca6';
      // пыль и трещины в момент удара
      if (L && e.st === 'down' && e.timer > 38) {
        const p = (55 - e.timer) / 17;
        ellipse(c, x, e.y + 2, e.r * (1.05 + p * 0.7), e.r * 0.5 * (1.05 + p * 0.7), null, 'rgba(210,190,160,' + (0.55 * (1 - p)).toFixed(2) + ')', 5 * (1 - p) + 1);
        if (L > 1) for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + 0.2, d = e.r * (1 + p * 0.9);
          circle(c, x + Math.cos(a) * d, e.y + 2 + Math.sin(a) * d * 0.45 - Math.sin(p * Math.PI) * 8, 2.4 * (1 - p) + 0.5, 'rgba(120,95,70,' + (0.8 * (1 - p)).toFixed(2) + ')');
        }
      }
      // голень: свет слева, к лодыжке сужается
      c.beginPath();
      c.moveTo(x - 30, -20); c.lineTo(x - 30, fy - 46);
      if (L) { c.quadraticCurveTo(x - 30, fy - 22, x - 25, fy - 10); c.lineTo(x + 25, fy - 10); c.quadraticCurveTo(x + 30, fy - 22, x + 30, fy - 46); }
      else { c.lineTo(x - 30, fy - 10); c.lineTo(x + 30, fy - 10); }
      c.lineTo(x + 30, -20); c.closePath();
      mobFill(c, '#e2b49e', x, 0, 30, 1, 0, true);
      c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
      if (L > 1) {   // вены и косточка лодыжки
        c.beginPath(); c.moveTo(x + 12, fy - 160); c.quadraticCurveTo(x + 6, fy - 110, x + 14, fy - 70); c.quadraticCurveTo(x + 18, fy - 50, x + 10, fy - 30);
        c.moveTo(x + 14, fy - 70); c.lineTo(x + 22, fy - 56);
        c.strokeStyle = 'rgba(90,110,170,0.35)'; c.lineWidth = 1.6; c.stroke();
        ellipse(c, x - 22, fy - 18, 4, 6, 'rgba(255,235,220,0.35)');
      }
      // стопа и пальцы с накрашенными ногтями
      mobEll(c, x, fy, 48, 26, skin, OUT, 3);
      for (let i = 0; i < 5; i++) {
        const tr = MOB_TOES[i], a = Math.PI * (0.8 - i * 0.15), tx = x + Math.cos(a) * 39, ty = fy + 15 + Math.sin(a) * 9;
        mobEll(c, tx, ty, tr * 0.9, tr, skin, OUT, 2);
        if (L) {
          ellipse(c, tx, ty + tr * 0.32, tr * 0.52, tr * 0.42, mobShade('#c8323e'), 'rgba(60,10,10,0.6)', 0.8);
          if (L > 1) circle(c, tx - tr * 0.18, ty + tr * 0.18, tr * 0.12, 'rgba(255,255,255,0.7)');
          c.beginPath(); c.arc(tx, ty - tr * 0.55, tr * 0.5, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = 'rgba(120,60,50,0.4)'; c.lineWidth = 0.9; c.stroke();
        }
      }
      if (L) mobGloss(c, x - 16, fy - 9, 13, 5, 0.3, -0.15);
      else ellipse(c, x - 16, fy - 8, 12, 5, fc('#f4d4c4'));
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
      const L = gfxLevel();
      const open = e.timer > 150 ? (170 - e.timer) / 20 : e.timer < 20 ? e.timer / 20 : 1;
      const rot = MOB_SIDE_ROT[e.side] || 0;
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      rrect(c, -30, -28, 60, 34, 8, '#0a0505');
      if (!L) {
        ellipse(c, 0, -10, 24, 15 * open, fc('#f2eae0'), OUT, 2);
        if (open > 0.3) {
          const a = angleTo(e, G.player) - rot;
          circle(c, Math.cos(a) * 7, -10 + Math.sin(a) * 5, 9 * Math.min(1, open), '#6a3a1a');
          circle(c, Math.cos(a) * 7, -10 + Math.sin(a) * 5, 4.5 * Math.min(1, open), '#111');
        }
        line(c, -20, -12, -12, -10, '#c03030', 1); line(c, 18, -8, 10, -11, '#c03030', 1);
        c.restore();
        return;
      }
      // из темноты проёма: веки, налитый кровью глаз
      ellipse(c, 0, -10, 29, 15, '#1c0a08');
      mobEll(c, 0, -10, 27, 13 + 4 * open, '#d8a890', OUT, 2);
      const oh = Math.max(0.5, 15 * open);
      mobEll(c, 0, -10, 24, oh, '#f2eae0', OUT, 2);
      if (open > 0.3) {
        const op = Math.min(1, open), a = angleTo(e, G.player) - rot;
        const ix = Math.cos(a) * 7, iy = -10 + Math.sin(a) * 5;
        c.save();
        c.beginPath(); c.ellipse(0, -10, 24, oh, 0, 0, Math.PI * 2); c.clip();
        c.beginPath();
        c.moveTo(-24, -9); c.lineTo(-17, -10.5); c.lineTo(-12, -9); c.moveTo(-17, -10.5); c.lineTo(-14, -14);
        c.moveTo(24, -7); c.lineTo(17, -8); c.lineTo(12, -6); c.moveTo(17, -8); c.lineTo(15, -3.5);
        c.moveTo(-22, -3); c.lineTo(-15, -4); c.moveTo(21, -15); c.lineTo(15, -14);
        c.strokeStyle = 'rgba(200,30,30,0.75)'; c.lineWidth = 0.9; c.stroke();
        mobBall(c, ix, iy, 9 * op, '#7a4420', OUT, 1);
        if (L > 1) {
          c.beginPath();
          for (let i = 0; i < 10; i++) { const b = i / 10 * Math.PI * 2; c.moveTo(ix + Math.cos(b) * 5 * op, iy + Math.sin(b) * 5 * op); c.lineTo(ix + Math.cos(b) * 8.2 * op, iy + Math.sin(b) * 8.2 * op); }
          c.strokeStyle = 'rgba(40,20,5,0.35)'; c.lineWidth = 0.8; c.stroke();
        }
        circle(c, ix, iy, 4.5 * op, '#111');
        circle(c, ix - 3, iy - 3, 1.8 * op, 'rgba(255,255,255,0.9)');
        ellipse(c, 0, -10 - oh * 0.85, 26, oh * 0.45, 'rgba(70,30,20,0.3)');   // тень верхнего века
        c.restore();
      }
      // ресницы
      c.beginPath();
      for (let i = -2; i <= 2; i++) { const b = -Math.PI / 2 + i * 0.32, px = Math.cos(b) * 24, py = -10 + Math.sin(b) * oh; c.moveTo(px, py); c.lineTo(px + Math.cos(b) * 5, py + Math.sin(b) * 4 - 1); }
      c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
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
      const L = gfxLevel(), skin = '#e8bca6', a = e.a || 0;
      line(c, e.bx, e.by, x, y, OUT, 26);
      line(c, e.bx, e.by, x, y, mobShade('#e2b49e'), 21);
      if (L) {   // объём руки: светлая полоса сверху, тень снизу
        const nx = -Math.sin(a), ny = Math.cos(a);
        line(c, e.bx - nx * 5, e.by - ny * 5, x - nx * 5, y - ny * 5, mobShade('#e2b49e', 0.22), 5);
        line(c, e.bx + nx * 6.5, e.by + ny * 6.5, x + nx * 6.5, y + ny * 6.5, mobShade('#e2b49e', -0.2), 5);
        if (L > 1) line(c, e.bx + nx * 2, e.by + ny * 2, x - Math.cos(a) * 30 + nx * 2, y - Math.sin(a) * 30 + ny * 2, 'rgba(90,110,170,0.3)', 1.4);
      }
      c.save(); c.translate(x, y); c.rotate(a);
      if (L) {
        const t = 120 - e.timer, spread = t >= 30 && t < 80 ? 1 : 0.75;   // в броске пальцы растопырены
        for (let i = 0; i < 4; i++) {
          const fy = (i - 1.5) * 8 * (0.85 + spread * 0.15), len = MOB_FINGERS[i] * spread, fx = 14 + len * 0.55;
          mobEll(c, fx, fy, len * 0.62 + 4, 4, skin, OUT, 2, (i - 1.5) * 0.08 * spread);
          ellipse(c, fx + len * 0.62 + 1, fy, 2.4, 2.6, mobShade('#f6dcd0'), 'rgba(80,40,30,0.5)', 0.8);
          if (L > 1) line(c, fx - 1, fy - 2.6, fx - 1, fy + 2.6, 'rgba(120,60,50,0.4)', 0.8);
        }
        mobEll(c, 0, 0, 20, 18, skin, OUT, 2.5);
        mobEll(c, 3, -19, 9.5, 4.2, skin, OUT, 2, -0.6);
        ellipse(c, 9.5, -24, 2.2, 2.4, mobShade('#f6dcd0'), 'rgba(80,40,30,0.5)', 0.8);
        c.beginPath(); c.moveTo(10, -10); c.quadraticCurveTo(4, 0, 10, 10);
        c.strokeStyle = 'rgba(130,70,60,0.35)'; c.lineWidth = 1.2; c.stroke();
        mobGloss(c, -6, -7, 7, 3.5, 0.25);
      } else {
        ellipse(c, 0, 0, 20, 18, fc(skin), OUT, 2.5);
        for (let i = -1.5; i <= 1.5; i++) ellipse(c, 18, i * 8, 10, 4, fc(skin), OUT, 2);
        ellipse(c, 2, -20, 9, 4, fc(skin), OUT, 2, -0.6);
      }
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
      const L = gfxLevel();
      const rage = e.hp < e.maxHp * 0.45;
      const per = rage ? 40 : 60;
      const ph = (e.t % per) / per;
      const beat = ph < 0.15 ? Math.sin(ph / 0.15 * Math.PI) * 0.08 : 0;
      // «тук-тук»: второй, слабый удар
      const beat2 = L && ph > 0.2 && ph < 0.32 ? Math.sin((ph - 0.2) / 0.12 * Math.PI) * 0.035 : 0;
      const s = 1 + beat + beat2;
      if (L > 1 && ph < 0.35 && !FLASH) {   // волна от удара
        const k = ph / 0.35;
        ellipse(c, x, y - 18, 52 + k * 46, 46 + k * 40, null, 'rgba(210,30,40,' + (0.4 * (1 - k)).toFixed(2) + ')', 3.5 * (1 - k) + 0.5);
      }
      c.save(); c.translate(x, y - 20); c.scale(s, s);
      if (!L) {
        line(c, -14, -36, -20, -60, OUT, 16); line(c, -14, -36, -20, -60, fc('#9a2a3a'), 12);
        line(c, 12, -36, 22, -62, OUT, 14); line(c, 12, -36, 22, -62, fc('#3a4a9a'), 10);
        heartPath(c, 0, 0, 100);
        c.fillStyle = fc('#a51c2a'); c.fill(); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
        heartPath(c, -6, -4, 70); c.fillStyle = fc('#c2303c'); c.fill();
        c.beginPath(); c.moveTo(-30, -10); c.quadraticCurveTo(-10, 0, -14, 22); c.moveTo(20, -18); c.quadraticCurveTo(8, 4, 16, 18);
        c.strokeStyle = '#6a0a14'; c.lineWidth = 2.5; c.stroke();
        ellipse(c, -22, -20, 10, 6, 'rgba(255,170,170,0.5)', null, 0, -0.5);
        c.restore();
        return;
      }
      // сосуды: полая вена, дуга аорты с ветвями, лёгочный ствол
      const vein = mobShade('#4a4a9a'), art = mobShade('#b42a3a');
      line(c, -24, -24, -31, -64, OUT, 15); line(c, -24, -24, -31, -64, vein, 11);
      ellipse(c, -31, -64, 5.5, 3, '#1a0a20', OUT, 1.5);
      c.beginPath(); c.moveTo(-6, -24); c.bezierCurveTo(-9, -62, 24, -74, 29, -44);
      c.strokeStyle = OUT; c.lineWidth = 17; c.stroke(); c.strokeStyle = art; c.lineWidth = 13; c.stroke();
      c.beginPath(); c.moveTo(-1.5, -55); c.lineTo(-4, -72); c.moveTo(7, -61); c.lineTo(7, -78); c.moveTo(15, -61); c.lineTo(19, -75);
      c.strokeStyle = OUT; c.lineWidth = 8.5; c.stroke(); c.strokeStyle = art; c.lineWidth = 5; c.stroke();
      circle(c, -4, -72, 2, '#3a0610'); circle(c, 7, -78, 2, '#3a0610'); circle(c, 19, -75, 2, '#3a0610');
      if (!FLASH) {
        c.beginPath(); c.moveTo(-9, -30); c.bezierCurveTo(-12, -62, 20, -74, 26, -52);
        c.strokeStyle = 'rgba(255,190,190,0.4)'; c.lineWidth = 2.5; c.stroke();
      }
      line(c, 12, -24, 6, -52, OUT, 15); line(c, 12, -24, 6, -52, mobShade('#3a4a9a'), 11);
      ellipse(c, 6, -52, 5.5, 3, '#10102a', OUT, 1.5);
      if (!FLASH) line(c, 8, -28, 3.5, -48, 'rgba(190,200,255,0.35)', 2);
      // мышца сердца
      heartPath(c, 0, 0, 100);
      mobFill(c, '#a51c2a', 0, 4, 50, 44);
      c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
      if (!FLASH && beat > 0.02) { heartPath(c, 0, 0, 100); c.fillStyle = 'rgba(255,90,90,' + (beat * 2.6).toFixed(2) + ')'; c.fill(); }
      // борозда между желудочками, венечные артерии и вены
      c.beginPath(); c.moveTo(4, -22); c.bezierCurveTo(16, -4, 8, 22, 2, 40);
      c.strokeStyle = 'rgba(70,0,10,0.55)'; c.lineWidth = 3.2; c.stroke();
      c.beginPath(); c.moveTo(6, -22); c.bezierCurveTo(18, -4, 10, 22, 4, 38);
      c.moveTo(12, -4); c.quadraticCurveTo(18, 0, 24, 6); c.moveTo(10, 14); c.quadraticCurveTo(15, 17, 19, 22); c.moveTo(10, -12); c.quadraticCurveTo(5, -8, 1, -3);
      c.strokeStyle = mobShade('#e04a58'); c.lineWidth = 1.7; c.stroke();
      c.beginPath(); c.moveTo(-36, -14); c.bezierCurveTo(-26, -2, -32, 12, -18, 27); c.moveTo(-29, 1); c.lineTo(-39, 8); c.moveTo(-24, 16); c.lineTo(-14, 14);
      c.strokeStyle = 'rgba(80,70,170,0.75)'; c.lineWidth = 1.9; c.stroke();
      if (L > 1 && !FLASH) {   // жировые отложения в венечной борозде
        ellipse(c, -12, -21, 6, 2.8, 'rgba(240,215,140,0.55)', null, 0, 0.2);
        ellipse(c, 18, -23, 5, 2.4, 'rgba(240,215,140,0.5)', null, 0, -0.3);
        ellipse(c, -30, -18, 3.6, 2, 'rgba(240,215,140,0.45)', null, 0, 0.6);
      }
      if (rage) {   // трещины и кровь
        c.beginPath(); c.moveTo(-20, 6); c.lineTo(-14, 12); c.lineTo(-17, 18); c.lineTo(-10, 24); c.moveTo(26, -10); c.lineTo(21, -4); c.lineTo(25, 2);
        c.strokeStyle = '#3a0408'; c.lineWidth = 2; c.stroke();
        mobDrip(c, -10, 24, 10, e.t * 0.02, '#7a0a14', 1.6);
        mobDrip(c, 1, 40, 14, e.t * 0.016 + 0.4, '#7a0a14', 2);
      }
      ellipse(c, -22, -20, 10, 6, 'rgba(255,170,170,0.45)', null, 0, -0.5);
      mobGloss(c, -27, -24, 3.6, 2, 0.75, -0.5);
      mobGloss(c, 30, -16, 2, 4.5, 0.25, 0.4);
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
