'use strict';
// ============================================================
//  Ввод: клавиатура, сенсорный экран, геймпад
// ============================================================

const SHOOT_KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyI: 'up', KeyK: 'down', KeyJ: 'left', KeyL: 'right',
};
const ACTIONS = {
  bomb: ['KeyE'],
  active: ['Space'],
  pill: ['KeyQ'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  map: ['Tab'],
  restart: ['KeyR'],
  mute: ['KeyM'],
  menu: ['KeyQ', 'Backspace'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  fullscreen: ['KeyF'],
};
const TOUCH_BUTTONS = [
  { action: 'active', x: W - 46, y: 160, r: 30 },
  { action: 'bomb', x: W - 46, y: 236, r: 27 },
  { action: 'pill', x: W - 46, y: 306, r: 24 },
  { action: 'pause', x: W - 46, y: 496, r: 20 },
];

const Input = {
  down: new Set(),
  hit: new Set(),
  vHit: new Set(),
  padHeld: new Set(),
  touchHeld: new Set(),
  shootOrder: [],
  touchMode: false,
  sticks: { move: null, shoot: null },
  btnPointers: {},
  clicks: [],
  padPrev: [],
  padMove: { x: 0, y: 0 },
  padShoot: null,
  padStickPrev: null,

  init(canvas) {
    addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      Sound.init();
      this.touchMode = false;
      if (!e.repeat) this.hit.add(e.code);
      this.down.add(e.code);
      if (SHOOT_KEYS[e.code]) {
        this.shootOrder = this.shootOrder.filter(k => k !== e.code);
        this.shootOrder.push(e.code);
      }
    });
    addEventListener('keyup', e => {
      this.down.delete(e.code);
      this.shootOrder = this.shootOrder.filter(k => k !== e.code);
    });
    addEventListener('blur', () => this.reset());

    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    };
    canvas.addEventListener('pointerdown', e => {
      Sound.init();
      e.preventDefault();
      const p = pos(e);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchMode = true;
      this.clicks.push(p);
      if (!this.touchMode) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (G.state !== 'play') return;
      for (const b of TOUCH_BUTTONS) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 10) {
          this.vHit.add(b.action);
          this.touchHeld.add(b.action);
          this.btnPointers[e.pointerId] = b.action;
          return;
        }
      }
      const s = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      if (p.x < W / 2) this.sticks.move = s; else this.sticks.shoot = s;
    });
    canvas.addEventListener('pointermove', e => {
      const p = pos(e);
      for (const k of ['move', 'shoot']) {
        const s = this.sticks[k];
        if (s && s.id === e.pointerId) {
          s.x = p.x; s.y = p.y;
          const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy);
          if (l > 56) { s.ox = s.x - dx / l * 56; s.oy = s.y - dy / l * 56; }
        }
      }
    });
    const up = e => {
      for (const k of ['move', 'shoot']) {
        const s = this.sticks[k];
        if (s && s.id === e.pointerId) this.sticks[k] = null;
      }
      const a = this.btnPointers[e.pointerId];
      if (a) { this.touchHeld.delete(a); delete this.btnPointers[e.pointerId]; }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  reset() {
    this.down.clear();
    this.shootOrder = [];
    this.sticks.move = this.sticks.shoot = null;
    this.touchHeld.clear();
    this.btnPointers = {};
  },

  pressed(action) {
    const codes = ACTIONS[action];
    if (codes) for (const c of codes) if (this.hit.has(c)) return true;
    return this.vHit.has(action);
  },
  held(action) {
    const codes = ACTIONS[action];
    if (codes) for (const c of codes) if (this.down.has(c)) return true;
    return this.padHeld.has(action) || this.touchHeld.has(action);
  },
  anyKey() { return this.hit.size > 0 || this.vHit.size > 0 || this.clicks.length > 0; },

  moveVec() {
    let x = 0, y = 0;
    if (this.down.has('KeyA')) x -= 1;
    if (this.down.has('KeyD')) x += 1;
    if (this.down.has('KeyW')) y -= 1;
    if (this.down.has('KeyS')) y += 1;
    const s = this.sticks.move;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy);
      if (l > 6) { const k = Math.min(1, l / 40); x += dx / l * k; y += dy / l * k; }
    }
    x += this.padMove.x; y += this.padMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },

  shootDir() {
    if (this.shootOrder.length) return SHOOT_KEYS[this.shootOrder[this.shootOrder.length - 1]];
    const s = this.sticks.shoot;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy;
      if (Math.hypot(dx, dy) > 12) {
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
    }
    return this.padShoot;
  },

  pollPad() {
    this.padHeld.clear();
    this.padMove = { x: 0, y: 0 };
    this.padShoot = null;
    if (!navigator.getGamepads) return;
    let gp = null;
    try { for (const p of navigator.getGamepads()) if (p && p.connected) { gp = p; break; } } catch (e) { return; }
    if (!gp) return;
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes;
    const dz = v => Math.abs(v) < 0.22 ? 0 : v;
    let mx = dz(ax[0] || 0), my = dz(ax[1] || 0);
    if (btn(12)) my -= 1;
    if (btn(13)) my += 1;
    if (btn(14)) mx -= 1;
    if (btn(15)) mx += 1;
    this.padMove = { x: mx, y: my };
    const rx = ax[2] || 0, ry = ax[3] || 0;
    if (Math.hypot(rx, ry) > 0.5) this.padShoot = Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? 'right' : 'left') : (ry > 0 ? 'down' : 'up');
    if (G.state === 'play') {
      if (btn(3)) this.padShoot = 'up';
      else if (btn(0)) this.padShoot = 'down';
      else if (btn(2)) this.padShoot = 'left';
      else if (btn(1)) this.padShoot = 'right';
    }
    const map = [[0, 'confirm'], [1, 'back'], [4, 'bomb'], [5, 'active'], [6, 'pill'], [7, 'active'],
      [8, 'map'], [9, 'pause'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']];
    for (const [i, a] of map) {
      const now = btn(i);
      if (now) this.padHeld.add(a);
      if (now && !this.padPrev[i]) { this.vHit.add(a); Sound.init(); }
      this.padPrev[i] = now;
    }
    // левый стик как стрелки в меню
    let sd = null;
    if (Math.abs(ax[0] || 0) > 0.6) sd = ax[0] > 0 ? 'right' : 'left';
    else if (Math.abs(ax[1] || 0) > 0.6) sd = ax[1] > 0 ? 'down' : 'up';
    if (sd && sd !== this.padStickPrev) this.vHit.add(sd);
    this.padStickPrev = sd;
  },

  endStep() {
    this.hit.clear();
    this.vHit.clear();
    this.clicks.length = 0;
  },
};
