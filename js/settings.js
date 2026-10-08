'use strict';
// ============================================================
//  Настройки игры (сохраняются в localStorage)
// ============================================================

const SETTINGS_DEF = [
  {
    key: 'gfx', label: 'Качество графики', def: 'high',
    options: [['low', 'Низкое'], ['mid', 'Среднее'], ['high', 'Высокое']],
    hint: 'Освещение, частицы, текстуры и эффекты экрана',
  },
  {
    key: 'shake', label: 'Тряска экрана', def: 1,
    options: [[1, 'Вкл'], [0, 'Выкл']],
    hint: 'Встряска камеры от взрывов и ударов',
  },
  {
    key: 'projVis', label: 'Заметность снарядов', def: 'high',
    options: [['normal', 'Обычная'], ['high', 'Повышенная'], ['max', 'Максимальная']],
    hint: 'Вражеские снаряды ярче и крупнее, свои слёзы — прозрачнее',
  },
  {
    key: 'shotColor', label: 'Цвет вражеских снарядов', def: 'red',
    options: [['red', 'Красный'], ['magenta', 'Пурпурный'], ['yellow', 'Жёлтый'], ['white', 'Белый']],
    hint: 'Помогает отличать вражеские снаряды от своих слёз',
  },
  {
    key: 'itemInfo', label: 'Описания предметов', def: 'full',
    options: [['off', 'Только название'], ['short', 'С изменениями'], ['full', 'Подробно']],
    hint: 'Изменения характеристик при подборе; «Подробно» — ещё и подсказка у пьедестала',
  },
  {
    key: 'statHud', label: 'Характеристики на экране', def: 1,
    options: [[1, 'Вкл'], [0, 'Выкл']],
    hint: 'Скорость, слёзы, урон и т.д. слева, с изменениями после подбора',
  },
  {
    key: 'sfxVol', label: 'Громкость звуков', def: 0.8,
    options: [[0, '0%'], [0.2, '20%'], [0.4, '40%'], [0.6, '60%'], [0.8, '80%'], [1, '100%']],
  },
  {
    key: 'musicVol', label: 'Громкость музыки', def: 0.6,
    options: [[0, '0%'], [0.2, '20%'], [0.4, '40%'], [0.6, '60%'], [0.8, '80%'], [1, '100%']],
  },
];

const SHOT_COLORS = {
  red: { fill: '#d42828', hi: '#ff9a9a', dark: '#3a0606', glow: 'rgba(255,40,40,' },
  magenta: { fill: '#d42cc8', hi: '#ffb0f4', dark: '#3a063a', glow: 'rgba(255,60,240,' },
  yellow: { fill: '#f0c020', hi: '#fff6b0', dark: '#4a3200', glow: 'rgba(255,220,40,' },
  white: { fill: '#f4f4f4', hi: '#ffffff', dark: '#202020', glow: 'rgba(255,255,255,' },
};

const Settings = {
  v: {},
  load() {
    let saved = {};
    try { saved = JSON.parse(store('sp_settings') || '{}') || {}; } catch (e) { saved = {}; }
    for (const d of SETTINGS_DEF) {
      const ok = d.options.some(o => o[0] === saved[d.key]);
      this.v[d.key] = ok ? saved[d.key] : d.def;
    }
    this.apply();
  },
  save() { store('sp_settings', JSON.stringify(this.v)); },
  get(k) { return this.v[k]; },
  set(k, val) { this.v[k] = val; this.save(); this.apply(); },
  // переключить значение на соседнее
  cycle(k, dir = 1) {
    const d = SETTINGS_DEF.find(x => x.key === k);
    if (!d) return;
    let i = d.options.findIndex(o => o[0] === this.v[k]);
    i = (i + dir + d.options.length) % d.options.length;
    this.set(k, d.options[i][0]);
  },
  label(k) {
    const d = SETTINGS_DEF.find(x => x.key === k);
    const o = d && d.options.find(o => o[0] === this.v[k]);
    return o ? o[1] : '';
  },
  apply() {
    if (Sound.sfx) Sound.sfx.gain.value = this.v.sfxVol;
    if (Sound.mus) Sound.mus.gain.value = this.v.musicVol * 0.5;
    if (typeof G !== 'undefined') G.bgCache = null;
  },
};

// уровень графики: 0 — низкое, 1 — среднее, 2 — высокое
function gfxLevel() { return Settings.v.gfx === 'low' ? 0 : Settings.v.gfx === 'mid' ? 1 : 2; }
// уровень заметности снарядов: 0 — обычная, 1 — повышенная, 2 — максимальная
function projLevel() { return Settings.v.projVis === 'normal' ? 0 : Settings.v.projVis === 'high' ? 1 : 2; }
function shotColor() { return SHOT_COLORS[Settings.v.shotColor] || SHOT_COLORS.red; }

Settings.load();
