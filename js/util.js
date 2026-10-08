'use strict';
// ============================================================
//  Общие константы и утилиты
// ============================================================

const W = 960, H = 540;              // логическое разрешение
const T = 52, COLS = 13, ROWS = 7;   // размер клетки и сетка комнаты
const RW = COLS * T, RH = ROWS * T;  // внутренний размер комнаты
const RX = (W - RW) / 2, RY = (H - RH) / 2;
const WALL = 50;                     // толщина стен
const STEP = 1000 / 60;

const DIR_NAMES = ['up', 'right', 'down', 'left'];
const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const DOOR_TILE = { up: [6, 0], down: [6, ROWS - 1], left: [0, 3], right: [COLS - 1, 3] };

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function weighted(list, rnd = Math.random) {
  let s = 0;
  for (const e of list) s += e[1];
  let r = rnd() * s;
  for (const e of list) { r -= e[1]; if (r < 0) return e[0]; }
  return list[list.length - 1][0];
}
function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
// расстояние от точки до отрезка
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function tileOf(x, y) { return [Math.floor((x - RX) / T), Math.floor((y - RY) / T)]; }
function tileCenter(c, r) { return [RX + c * T + T / 2, RY + r * T + T / 2]; }
function inGrid(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// луч из точки до стены комнаты
function rayToWall(x, y, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = 1e9;
  if (dx > 1e-6) t = Math.min(t, (RX + RW - x) / dx);
  if (dx < -1e-6) t = Math.min(t, (RX - x) / dx);
  if (dy > 1e-6) t = Math.min(t, (RY + RH - y) / dy);
  if (dy < -1e-6) t = Math.min(t, (RY - y) / dy);
  t = Math.max(0, t);
  return [x + dx * t, y + dy * t];
}

// ---------- Детерминированный ГПСЧ для генерации этажей ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  shuffle(a) { return shuffle(a, this.f); }
}

// ---------- Цвета ----------
const _rgbCache = new Map();
function hexToRgb(h) {
  let v = _rgbCache.get(h);
  if (v) return v;
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgbCache.set(h, v);
  return v;
}
const _mixCache = new Map();
function mixColor(a, b, t) {
  if (a[0] !== '#') return a;
  const k = a + b + t;
  let v = _mixCache.get(k);
  if (v) return v;
  const A = hexToRgb(a), B = hexToRgb(b);
  v = 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  _mixCache.set(k, v);
  return v;
}

// ---------- Холсты в памяти с учётом масштаба ----------
let PIXEL_SCALE = 1; // реальные пиксели на логический пиксель
function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * PIXEL_SCALE));
  cv.height = Math.max(1, Math.ceil(h * PIXEL_SCALE));
  const ctx = cv.getContext('2d');
  ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
  return { cv, ctx, w, h };
}

function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch (e) { /* хранилище может быть недоступно */ }
  return null;
}
