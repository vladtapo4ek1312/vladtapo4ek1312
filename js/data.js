'use strict';
// ============================================================
//  Игровые данные: этажи, персонажи, предметы, пилюли, карты, комнаты
// ============================================================

const STAGES = [null,
  { name: 'Подвал I', ch: 1 }, { name: 'Подвал II', ch: 1 },
  { name: 'Пещеры I', ch: 2 }, { name: 'Пещеры II', ch: 2 },
  { name: 'Глубины I', ch: 3 }, { name: 'Глубины II', ch: 3 },
  { name: 'Утроба I', ch: 4 }, { name: 'Утроба II', ch: 4 },
];
const LAST_STAGE = 8;

const PALETTES = {
  1: { floor: '#5e4737', floor2: '#4f3b2d', dark: '#24180f', wall: '#3a291e', wall2: '#5c4332', rock: '#857261', rock2: '#5c4c3e', pit: '#0e0906' },
  2: { floor: '#5a554b', floor2: '#4a453d', dark: '#1f1c18', wall: '#35312a', wall2: '#5d584d', rock: '#8c826f', rock2: '#625a4d', pit: '#0b0a09' },
  3: { floor: '#3f414a', floor2: '#33353d', dark: '#141519', wall: '#24252b', wall2: '#4a4c57', rock: '#72747f', rock2: '#4f515b', pit: '#060608' },
  4: { floor: '#702b2d', floor2: '#5d2124', dark: '#260809', wall: '#481315', wall2: '#82363a', rock: '#a14f4e', rock2: '#743335', pit: '#160304', veins: true },
  devil: { floor: '#2c1514', floor2: '#221010', dark: '#0a0404', wall: '#170909', wall2: '#3d1714', rock: '#5c2c29', rock2: '#3c1c1a', pit: '#000000' },
  angel: { floor: '#cdd2da', floor2: '#bcc2cc', dark: '#6f7482', wall: '#959cab', wall2: '#e4e7ee', rock: '#ececf2', rock2: '#b4b8c2', pit: '#2a2a33' },
};

const CHARACTERS = [
  {
    id: 'kai', name: 'Кай', look: 'kai', skin: '#f3d9c9',
    desc: 'Обычный ребёнок. Ничего лишнего.',
    hearts: 3, bombs: 1, keys: 0, coins: 0, active: 'd6',
  },
  {
    id: 'magda', name: 'Магда', look: 'magda', skin: '#f3d9c9',
    desc: 'Больше сердец, но чуть медленнее.',
    hearts: 4, speed: -0.15, bombs: 1, active: 'yum',
  },
  {
    id: 'outcast', name: 'Изгой', look: 'outcast', skin: '#ecd1bf',
    desc: 'Хрупкий, зато бьёт очень больно.',
    hearts: 1, dmgMult: 1.35, speed: 0.1, coins: 3, bombs: 0, active: 'blackbook',
  },
  {
    id: 'shade', name: 'Тень', look: 'shade', skin: '#8cb6ea',
    desc: 'Только синие сердца. Быстрые слёзы.',
    hearts: 0, soul: 3, soulOnly: true, tears: 0.35, range: 0.75, bombs: 1, active: 'catHead',
  },
];

// ---------- Предметы ----------
// pools: treasure, boss, shop, devil, angel, secret
const ITEMS = {
  // --- пассивные ---
  onion: { name: 'Грустная луковица', desc: 'Слёзы вверх', pools: ['treasure', 'secret'], apply: p => { p.tearsUp += 0.7; } },
  syringe: { name: 'Странный шприц', desc: 'Урон и скорость вверх', pools: ['treasure', 'boss'], apply: p => { p.dmgUp += 1; p.speedUp += 0.2; } },
  blood: { name: 'Капля крови', desc: 'Урон вверх', pools: ['treasure', 'boss'], apply: p => { p.dmgUp += 1; } },
  pentagram: { name: 'Пентаграмма', desc: 'Урон вверх', pools: ['treasure', 'devil'], apply: p => { p.dmgUp += 1; p.devilBonus += 0.1; } },
  mushroom: { name: 'Пятнистый гриб', desc: 'Всё вверх!', pools: ['treasure', 'secret'], w: 0.35, apply: p => { p.addContainers(1, 99); p.dmgUp += 0.3; p.dmgMult *= 1.5; p.speedUp += 0.3; p.rangeUp += 1.5; p.size *= 1.2; } },
  innerEye: { name: 'Третий глаз', desc: 'Тройной выстрел', pools: ['treasure'], apply: p => { p.multi += 2; p.tearsMult *= 0.58; } },
  twenty: { name: 'Двойное зрение', desc: 'Двойной выстрел', pools: ['treasure'], w: 0.6, apply: p => { p.multi += 1; p.dmgMult *= 0.85; } },
  homing: { name: 'Компас души', desc: 'Самонаводящиеся слёзы', pools: ['treasure'], apply: p => { p.flags.homing = true; } },
  cupid: { name: 'Стрела Купидона', desc: 'Пробивающие слёзы', pools: ['treasure'], apply: p => { p.flags.piercing = true; } },
  spectral: { name: 'Призрачный взгляд', desc: 'Слёзы сквозь камни', pools: ['treasure', 'angel'], apply: p => { p.flags.spectral = true; p.rangeUp += 0.5; } },
  rubber: { name: 'Резиновый мячик', desc: 'Прыгучие слёзы', pools: ['treasure'], apply: p => { p.flags.bounce = true; p.rangeUp += 1; } },
  poison: { name: 'Ядовитая слюна', desc: 'Ядовитые слёзы', pools: ['treasure'], apply: p => { p.flags.poison = true; p.dmgUp += 0.3; } },
  slime: { name: 'Липкая слизь', desc: 'Замедляющие слёзы', pools: ['treasure'], apply: p => { p.flags.slow = true; p.tearsUp += 0.3; } },
  wings: { name: 'Голубиные перья', desc: 'Полёт!', pools: ['angel', 'treasure'], w: 0.4, apply: p => { p.flight = true; p.speedUp += 0.3; } },
  brimstone: { name: 'Адская сера', desc: 'Заряди луч!', pools: ['devil'], apply: p => { p.flags.brimstone = true; p.flags.tech = false; } },
  tech: { name: 'Лазерный глаз', desc: 'Лазерные слёзы', pools: ['treasure'], w: 0.6, apply: p => { if (!p.flags.brimstone) p.flags.tech = true; } },
  polyphemus: { name: 'Глаз циклопа', desc: 'Огромный урон, мало слёз', pools: ['treasure', 'devil'], w: 0.5, apply: p => { p.dmgUp += 4; p.dmgMult *= 1.6; p.tearsMult *= 0.45; p.flags.big = true; } },
  wiz: { name: 'Колпак волшебника', desc: 'Слёзы по диагонали', pools: ['treasure'], w: 0.6, apply: p => { p.flags.wiz = true; } },
  ipecac: { name: 'Рвотный корень', desc: 'Взрывные слёзы', pools: ['devil', 'treasure'], w: 0.4, apply: p => { p.flags.ipecac = true; p.dmgUp += 2; p.tearsMult *= 0.42; } },
  sneakers: { name: 'Кроссовки', desc: 'Скорость вверх', pools: ['boss', 'shop'], apply: p => { p.speedUp += 0.3; } },
  spyglass: { name: 'Подзорная труба', desc: 'Дальность вверх', pools: ['boss', 'shop'], apply: p => { p.rangeUp += 2.5; p.shotSpeedUp += 0.15; } },
  slingshot: { name: 'Рогатка', desc: 'Скорость слёз и урон вверх', pools: ['boss'], apply: p => { p.shotSpeedUp += 0.4; p.dmgUp += 0.5; } },
  horseshoe: { name: 'Подкова', desc: 'Удача вверх', pools: ['shop', 'treasure'], apply: p => { p.luck += 1; } },
  heartUp: { name: 'Свиное сердце', desc: 'Здоровье вверх', pools: ['boss'], apply: p => { p.addContainers(1, 2); } },
  meat: { name: 'Завтрак', desc: 'Здоровье вверх', pools: ['boss'], apply: p => { p.addContainers(1, 2); } },
  rosary: { name: 'Чётки', desc: 'Вера вверх', pools: ['angel'], apply: p => { p.addSoul(6); p.tearsUp += 0.5; } },
  halo: { name: 'Нимб', desc: 'Всё вверх', pools: ['angel'], apply: p => { p.addContainers(1, 2); p.dmgUp += 0.3; p.tearsUp += 0.2; p.speedUp += 0.3; p.rangeUp += 0.25; p.flags.halo = true; } },
  mantle: { name: 'Святой плащ', desc: 'Щит в каждой комнате', pools: ['angel'], apply: p => { p.flags.mantle = true; p.mantle = true; } },
  goat: { name: 'Голова козла', desc: 'Ты чувствуешь зло...', pools: ['devil'], apply: p => { p.devilBonus += 1; p.speedUp += 0.1; } },
  pact: { name: 'Договор кровью', desc: 'Урон и слёзы вверх', pools: ['devil'], apply: p => { p.dmgUp += 0.5; p.tearsUp += 0.7; p.addSoul(4); } },
  bro: { name: 'Братец', desc: 'Стреляет вместе с тобой', pools: ['treasure'], apply: p => { p.addFamiliar('bro'); } },
  sis: { name: 'Сестрёнка', desc: 'Быстрые слёзы-друзья', pools: ['treasure', 'angel'], apply: p => { p.addFamiliar('sis'); } },
  orbital: { name: 'Мушка-страж', desc: 'Защищает от пуль', pools: ['treasure'], apply: p => { p.addFamiliar('orbital'); } },
  demon: { name: 'Бесёнок', desc: 'Сам находит врагов', pools: ['devil'], apply: p => { p.addFamiliar('demon'); } },
  bombBag: { name: 'Мешок бомб', desc: '+5 бомб', pools: ['treasure', 'shop'], apply: p => { p.bombs = Math.min(99, p.bombs + 5); } },
  bigBombs: { name: 'Мега-бомбы', desc: 'Бомбы сильнее, +5 бомб', pools: ['treasure', 'shop'], apply: p => { p.flags.bigBombs = true; p.bombs = Math.min(99, p.bombs + 5); } },
  piggy: { name: 'Копилка', desc: '+15 монет', pools: ['shop'], apply: p => { p.coins = Math.min(99, p.coins + 15); p.addContainers(0, 2); } },
  keyRing: { name: 'Связка ключей', desc: '+5 ключей', pools: ['shop'], apply: p => { p.keys = Math.min(99, p.keys + 5); } },
  lump: { name: 'Уголёк', desc: 'Урон растёт с расстоянием', pools: ['treasure'], apply: p => { p.flags.coal = true; } },
  compass: { name: 'Карта сокровищ', desc: 'Видишь весь этаж', pools: ['shop', 'treasure'], apply: p => { p.flags.map = true; if (G.floor) revealFloor(); } },
  soy: { name: 'Соевое молоко', desc: 'Много слабых слёз', pools: ['treasure'], w: 0.5, apply: p => { p.tearsMult *= 4.5; p.dmgMult *= 0.22; p.flags.small = true; } },
  fireMind: { name: 'Огненный разум', desc: 'Слёзы поджигают', pools: ['treasure', 'devil'], apply: p => { p.flags.burn = true; p.luck += 1; } },
  ankh: { name: 'Анкх', desc: 'Вечная жизнь?', pools: ['treasure', 'secret'], w: 0.25, apply: p => { p.extraLives += 1; } },
  lens: { name: 'Увеличительное стекло', desc: 'Большие слёзы, урон вверх', pools: ['treasure', 'secret'], apply: p => { p.dmgUp += 0.5; p.dmgMult *= 1.1; p.tearScale *= 1.4; } },
  candy: { name: 'Сахарная вата', desc: 'Слёзы вверх', pools: ['treasure', 'boss'], apply: p => { p.tearsUp += 0.5; p.speedUp += 0.1; } },
  cross: { name: 'Деревянный крест', desc: 'Защита', pools: ['angel', 'treasure'], w: 0.6, apply: p => { p.flags.mantle = true; p.mantle = true; p.tearsUp += 0.2; } },
  // --- активируемые ---
  d6: { name: 'Шестигранник', desc: 'Перебрось судьбу', active: true, charge: 6, pools: ['treasure', 'shop'], w: 0.4 },
  blackbook: { name: 'Чёрная книга', desc: 'Урон вверх на комнату', active: true, charge: 3, pools: ['treasure', 'devil'] },
  prayer: { name: 'Молитвенник', desc: 'Временная неуязвимость', active: true, charge: 3, pools: ['angel', 'shop'] },
  catHead: { name: 'Голова кошки', desc: 'Взрыв слёз', active: true, charge: 1, pools: ['treasure'] },
  teleport: { name: 'Телепорт', desc: 'Перенос в случайную комнату', active: true, charge: 2, pools: ['treasure', 'shop'] },
  hourglass: { name: 'Песочные часы', desc: 'Враги замедляются', active: true, charge: 2, pools: ['treasure', 'shop'] },
  yum: { name: 'Сердечный пирог', desc: 'Лечение', active: true, charge: 4, pools: ['treasure', 'shop', 'boss'] },
  grimoire: { name: 'Гримуар', desc: 'Урон всем врагам', active: true, charge: 3, pools: ['treasure', 'devil'] },
  mrBoom: { name: 'Мистер Бум', desc: 'Большая бомба', active: true, charge: 2, pools: ['treasure'] },
};
for (const id in ITEMS) ITEMS[id].id = id;

// ---------- Пилюли ----------
const PILL_COLORS = [
  ['#ffffff', '#3f6fd0'], ['#ffffff', '#ffffff'], ['#2a2a2a', '#e8cf3a'], ['#3f6fd0', '#3f6fd0'],
  ['#f08a24', '#f08a24'], ['#d83333', '#ffffff'], ['#f5a3c7', '#d83333'], ['#e8cf3a', '#ffffff'], ['#ffffff', '#2a2a2a'],
];
const PILLS = {
  hpUp: { name: 'Здоровье вверх', good: true },
  hpDown: { name: 'Здоровье вниз', good: false },
  fullHp: { name: 'Полное исцеление', good: true },
  badTrip: { name: 'Плохой трип', good: false },
  balls: { name: 'Стальные шары', good: true },
  tearsUp: { name: 'Слёзы вверх', good: true },
  tearsDown: { name: 'Слёзы вниз', good: false },
  speedUp: { name: 'Скорость вверх', good: true },
  speedDown: { name: 'Скорость вниз', good: false },
  rangeUp: { name: 'Дальность вверх', good: true },
  luckUp: { name: 'Удача вверх', good: true },
  bombs: { name: 'Взрывная диарея', good: false },
  tele: { name: 'Телепилюля', good: true },
  energy: { name: '48 часов энергии', good: true },
  nothing: { name: 'Я ничего не чувствую', good: true },
};

// ---------- Карты Таро ----------
const CARDS = {
  fool: { name: '0 — Шут', desc: 'Назад к началу', color: '#d8c27a' },
  magician: { name: 'I — Маг', desc: 'Самонаводка на комнату', color: '#b57be0' },
  hermit: { name: 'IX — Отшельник', desc: 'Телепорт в магазин', color: '#7a9ad8' },
  star: { name: 'XVII — Звезда', desc: 'Телепорт в сокровищницу', color: '#e8d24a' },
  moon: { name: 'XVIII — Луна', desc: 'Телепорт в тайную комнату', color: '#9fb0d8' },
  tower: { name: 'XVI — Башня', desc: 'Взрывы!', color: '#d8763a' },
  strength: { name: 'VIII — Сила', desc: 'Урон вверх на комнату', color: '#d84a4a' },
  justice: { name: 'XI — Справедливость', desc: 'Монета, бомба, ключ и сердце', color: '#5ab07a' },
  lovers: { name: 'VI — Влюблённые', desc: 'Два сердца', color: '#f07aa0' },
  emperor: { name: 'IV — Император', desc: 'Телепорт к боссу', color: '#c8a050' },
};

// ---------- Раскладки комнат 13x7 ----------
// . пусто  r камень  m металл  p куча  x яма  s шипы  f огонь  E враг
const LAYOUTS = [
  ['.............', '..E.......E..', '.............', '......E......', '.............', '..E.......E..', '.............'],
  ['.............', '.rr.......rr.', '.r..E...E..r.', '.............', '.r..E...E..r.', '.rr.......rr.', '.............'],
  ['.............', '...E.....E...', '....rrrrr....', '..E.rmmmr.E..', '....rrrrr....', '...E.....E...', '.............'],
  ['.............', '..xxx...xxx..', '..x.E...E.x..', '.............', '..x.E...E.x..', '..xxx...xxx..', '.............'],
  ['.............', '.p...E.E...p.', '......p......', '..E.p...p.E..', '......p......', '.p...E.E...p.', '.............'],
  ['.............', '.rrrrr.rrrrr.', '.....E.E.....', '...E.....E...', '.....E.E.....', '.rrrrr.rrrrr.', '.............'],
  ['.............', '.....E.E.....', '..s.s...s.s..', '.E....s....E.', '..s.s...s.s..', '.....E.E.....', '.............'],
  ['f...........f', '.............', '....E...E....', '.............', '....E...E....', '.............', 'f...........f'],
  ['.............', '.r.........r.', '..r..E.E..r..', '.............', '..r..E.E..r..', '.r.........r.', '.............'],
  ['.............', '.E.........E.', 'xxxxx...xxxxx', '.............', 'xxxxx...xxxxx', '.E.........E.', '.............'],
  ['.............', '..m...E...m..', '.............', '.E..m...m..E.', '.............', '..m...E...m..', '.............'],
  ['...r.....r...', '.E.r..E..r.E.', '...r.....r...', '.............', '...r.....r...', '.E.r..E..r.E.', '...r.....r...'],
  ['.............', '..E.......E..', '...xxxxxxx...', '...xxxxxxx...', '...xxxxxxx...', '..E.......E..', '.............'],
  ['.............', '...p..r..p...', '.E.........E.', '...r..E..r...', '.E.........E.', '...p..r..p...', '.............'],
  ['.............', '.r.r.....r.r.', '...E..r..E...', '.r...rrr...r.', '...E..r..E...', '.r.r.....r.r.', '.............'],
  ['.............', '...x.....x...', '.E.x..E..x.E.', '...x.....x...', '.E.x..E..x.E.', '...x.....x...', '.............'],
  ['.............', '.ssss...ssss.', '.....E.E.....', '.E.........E.', '.....E.E.....', '.ssss...ssss.', '.............'],
  ['.............', '....rr.rr....', '...r..E..r...', '.E....E....E.', '...r..E..r...', '....rr.rr....', '.............'],
  ['.............', '.f.........f.', '...p.E.E.p...', '.............', '...p.E.E.p...', '.f.........f.', '.............'],
  ['xx.........xx', 'x...E...E...x', '.............', '......E......', '.............', 'x...E...E...x', 'xx.........xx'],
  ['.............', '.mm.......mm.', '.m...E.E...m.', '....r...r....', '.m...E.E...m.', '.mm.......mm.', '.............'],
  ['.............', '..E..ppp..E..', '.....p.p.....', '.....p.p.....', '.....ppp.....', '..E.......E..', '.............'],
];

const ENEMY_POOLS = {
  1: ['fly', 'attackFly', 'pooter', 'gaper', 'horf', 'spider', 'maggot', 'clotty', 'mulligan', 'hopper'],
  2: ['attackFly', 'pooter', 'sucker', 'hopper', 'charger', 'boomFly', 'spider', 'gaper', 'roundworm', 'fatty', 'clotty'],
  3: ['charger', 'fatty', 'gaper', 'leaper', 'ghost', 'boomFly', 'sucker', 'roundworm', 'horf', 'mulligan'],
  4: ['ghost', 'leaper', 'sucker', 'charger', 'clotty', 'fatty', 'boomFly', 'roundworm', 'gaper'],
};

const BOSS_POOLS = {
  1: ['monstro', 'duke', 'worm', 'blob'],
  2: ['monstro', 'duke', 'worm', 'blob'],
  3: ['gemini', 'famine', 'worm', 'monstro'],
  4: ['gemini', 'famine', 'blob', 'duke'],
  5: ['famine', 'gemini', 'blob', 'monstro'],
  6: ['mom'],
  7: ['gemini', 'famine', 'duke', 'blob', 'worm'],
  8: ['heart'],
};

const BOSS_NAMES = {
  monstro: 'Толстун', duke: 'Князь Мух', worm: 'Глист', gemini: 'Близнецы', famine: 'Голод',
  blob: 'Кровавый Слизень', mom: 'Мама', heart: 'Сердце Мамы',
};

// проверка раскладок
for (const [i, L] of LAYOUTS.entries()) {
  if (L.length !== ROWS || L.some(r => r.length !== COLS)) console.warn('Неверная раскладка', i);
}
