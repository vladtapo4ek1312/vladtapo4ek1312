'use strict';
// ============================================================
//  Подробные описания предметов: что именно меняет предмет
// ============================================================

// особые свойства, которые не видны по характеристикам
const ITEM_NOTES = {
  pentagram: 'Шанс сделки с дьяволом +10%',
  mushroom: 'Герой становится больше',
  innerEye: 'Три слезы веером',
  twenty: 'Две слезы параллельно',
  homing: 'Слёзы сами летят во врагов',
  cupid: 'Слёзы пробивают врагов насквозь',
  spectral: 'Слёзы пролетают сквозь камни',
  rubber: 'Слёзы отскакивают от стен',
  poison: 'Шанс отравить врага',
  slime: 'Шанс замедлить врага',
  wings: 'Полёт над ямами, камнями и шипами',
  brimstone: 'Держи стрельбу, чтобы зарядить луч, отпусти — выстрел',
  tech: 'Вместо слёз — мгновенный лазер',
  polyphemus: 'Огромные слёзы',
  wiz: 'Две слезы по диагонали',
  ipecac: 'Слёзы летят дугой и взрываются',
  mantle: 'Щит блокирует первый удар в каждой комнате',
  cross: 'Щит блокирует первый удар в каждой комнате',
  goat: 'Шанс сделки с дьяволом +100%',
  bro: 'Друг повторяет твои выстрелы',
  sis: 'Друг быстро стреляет вместе с тобой',
  orbital: 'Летает вокруг и сбивает вражеские снаряды',
  demon: 'Сам стреляет в ближайшего врага',
  bigBombs: 'Взрывы бомб больше и сильнее',
  lump: 'Чем дальше летит слеза, тем больнее бьёт',
  compass: 'Показывает весь этаж и особые комнаты',
  soy: 'Очень много маленьких слёз',
  fireMind: 'Шанс поджечь врага',
  ankh: 'Вернёт к жизни после смерти',
  lens: 'Слёзы становятся крупнее',
  // активные
  d6: 'Меняет все предметы в комнате на случайные',
  blackbook: '+2 урона до конца комнаты',
  prayer: 'Неуязвимость на 5 секунд',
  catHead: 'Выпускает 10 слёз во все стороны',
  teleport: 'Переносит в случайную комнату этажа',
  hourglass: 'Враги замедлены на 8 секунд',
  yum: 'Лечит одно сердце',
  grimoire: '40 урона всем врагам в комнате',
  mrBoom: 'Ставит большую бомбу',
};

const STAT_ROWS = [
  ['damage', 'Урон', p => p.damage],
  ['tears', 'Слёзы', p => p.tps],
  ['speed', 'Скорость', p => p.speed],
  ['range', 'Дальность', p => p.range],
  ['shotspeed', 'Скорость слёз', p => p.shotSpeed],
  ['luck', 'Удача', p => p.luck],
];

// снимок характеристик игрока (для отображения изменений)
function statSnapshot(p) {
  const s = {};
  for (const [k, , f] of STAT_ROWS) s[k] = f(p);
  s.hearts = p.maxHearts; s.soul = p.soul; s.bombs = p.bombs; s.keys = p.keys; s.coins = p.coins;
  return s;
}

// копия игрока, на которой можно безопасно примерить предмет
function sandboxPlayer(p) {
  const sb = Object.create(Player.prototype);
  for (const k in p) {
    const v = p[k];
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || v == null) sb[k] = v;
  }
  sb.ch = p.ch;
  sb.flags = Object.assign({}, p.flags);
  sb.items = p.items.slice();
  sb.familiars = p.familiars.slice();
  sb.trail = [];
  sb.active = p.active ? Object.assign({}, p.active) : null;
  sb.sandbox = true;
  return sb;
}

function fmtDelta(v) {
  const r = Math.round(v * 100) / 100;
  return (r > 0 ? '+' : '') + String(r);
}

// Возвращает { name, desc, lines: [{ text, kind: 'up'|'down'|'note' }] }
function describeItem(id, p) {
  const it = ITEMS[id];
  if (!it) return { name: '?', desc: '', lines: [] };
  const lines = [];
  if (it.active) {
    lines.push({ text: 'Активный предмет — ' + (Input.touchMode ? 'верхняя кнопка' : 'Пробел'), kind: 'note' });
    lines.push({ text: 'Заряд: ' + it.charge + ' ' + plural(it.charge, 'комната', 'комнаты', 'комнат'), kind: 'note' });
  } else if (p && it.apply) {
    const sb = sandboxPlayer(p);
    const before = statSnapshot(sb);
    const livesBefore = sb.extraLives;
    try { it.apply(sb); } catch (e) { /* примерка не должна ломать игру */ }
    const after = statSnapshot(sb);
    for (const [k, label] of STAT_ROWS) {
      const d = after[k] - before[k];
      if (Math.abs(d) > 0.005) lines.push({ text: label + ' ' + fmtDelta(d), kind: d > 0 ? 'up' : 'down' });
    }
    if (after.hearts !== before.hearts) lines.push({ text: 'Сердца ' + fmtDelta(after.hearts - before.hearts), kind: after.hearts > before.hearts ? 'up' : 'down' });
    if (after.soul !== before.soul) lines.push({ text: 'Синие сердца ' + fmtDelta((after.soul - before.soul) / 2), kind: after.soul > before.soul ? 'up' : 'down' });
    if (after.bombs !== before.bombs) lines.push({ text: 'Бомбы ' + fmtDelta(after.bombs - before.bombs), kind: 'up' });
    if (after.keys !== before.keys) lines.push({ text: 'Ключи ' + fmtDelta(after.keys - before.keys), kind: 'up' });
    if (after.coins !== before.coins) lines.push({ text: 'Монеты ' + fmtDelta(after.coins - before.coins), kind: 'up' });
    if (sb.extraLives > livesBefore) lines.push({ text: 'Дополнительная жизнь', kind: 'up' });
  }
  if (ITEM_NOTES[id]) lines.push({ text: ITEM_NOTES[id], kind: 'note' });
  return { name: it.name, desc: it.desc, lines };
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
