'use strict';
// ─── Звуки интерфейса ─────────────────────────────────────────────────────────
// Синтезируются на лету через Web Audio — никаких файлов, ничего не качается.
const SND = { ctx: null, master: null, last: {} };
function sndCtx() {
  if (!SND.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    SND.ctx = new AC();
    SND.master = SND.ctx.createGain();
    const comp = SND.ctx.createDynamicsCompressor();
    SND.master.connect(comp); comp.connect(SND.ctx.destination);
  }
  if (SND.ctx.state === 'suspended') SND.ctx.resume();
  SND.master.gain.value = Math.max(0, Math.min(1, settings.soundVol ?? 0.6)) * 0.9;
  return SND.ctx;
}
// Одна нота: частота (или скольжение f→f2), длительность, форма волны, громкость, задержка
function tone(ctx, { f, f2, t = 0, d = 0.08, type = 'sine', v = 0.2, a = 0.004, lp = 0 }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  let node = o;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g); g.connect(SND.master);
  o.start(t0); o.stop(t0 + d + 0.03);
}
const SOUNDS_XBOX = {
  move:   (c) => tone(c, { f: 1320, d: 0.035, type: 'sine', v: 0.06 }),
  tab:    (c) => { tone(c, { f: 660, d: 0.05, type: 'triangle', v: 0.1 }); tone(c, { f: 990, t: 0.045, d: 0.06, type: 'triangle', v: 0.09 }); },
  select: (c) => tone(c, { f: 560, f2: 840, d: 0.07, type: 'sine', v: 0.14 }),
  back:   (c) => tone(c, { f: 720, f2: 430, d: 0.09, type: 'sine', v: 0.12 }),
  open:   (c) => { tone(c, { f: 392, f2: 587, d: 0.12, type: 'triangle', v: 0.1, lp: 2400 }); tone(c, { f: 784, t: 0.06, d: 0.1, type: 'sine', v: 0.05 }); },
  close:  (c) => tone(c, { f: 587, f2: 330, d: 0.11, type: 'triangle', v: 0.09, lp: 2200 }),
  fav:    (c) => { tone(c, { f: 988, d: 0.07, v: 0.1 }); tone(c, { f: 1319, t: 0.06, d: 0.14, v: 0.1 }); },
  unfav:  (c) => { tone(c, { f: 1175, d: 0.06, v: 0.08 }); tone(c, { f: 784, t: 0.05, d: 0.1, v: 0.08 }); },
  launch: (c) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { f, t: i * 0.07, d: 0.22, type: 'triangle', v: 0.12, lp: 3200 }));
    tone(c, { f: 130.8, f2: 261.6, d: 0.45, type: 'sine', v: 0.12 });
  },
  success: (c) => { tone(c, { f: 740, d: 0.08, v: 0.1 }); tone(c, { f: 988, t: 0.08, d: 0.16, v: 0.1 }); },
  error:  (c) => { tone(c, { f: 196, d: 0.1, type: 'square', v: 0.05, lp: 900 }); tone(c, { f: 175, t: 0.12, d: 0.14, type: 'square', v: 0.05, lp: 900 }); },
  bigIn:  (c) => { tone(c, { f: 220, f2: 880, d: 0.35, type: 'sawtooth', v: 0.05, lp: 1600 }); tone(c, { f: 659, t: 0.2, d: 0.3, v: 0.08 }); },
  bigOut: (c) => tone(c, { f: 880, f2: 220, d: 0.3, type: 'sawtooth', v: 0.045, lp: 1400 }),
};
// ─── Наборы звуков ────────────────────────────────────────────────────────────
const bell = (c, f, t = 0, d = 0.35, v = 0.08) => { tone(c, { f, t, d, type: 'sine', v }); tone(c, { f: f * 2.01, t, d: d * 0.6, type: 'sine', v: v * 0.35 }); tone(c, { f: f * 3.02, t, d: d * 0.35, type: 'sine', v: v * 0.15 }); };
const SOUNDS_SOFT = {   // мягкие, приглушённые — для вечера
  move:   (c) => tone(c, { f: 520, d: 0.05, type: 'sine', v: 0.05, lp: 1200 }),
  tab:    (c) => tone(c, { f: 440, f2: 520, d: 0.08, type: 'sine', v: 0.07, lp: 1400 }),
  select: (c) => tone(c, { f: 392, f2: 494, d: 0.1, type: 'sine', v: 0.1, lp: 1500 }),
  back:   (c) => tone(c, { f: 494, f2: 370, d: 0.12, type: 'sine', v: 0.09, lp: 1300 }),
  open:   (c) => { tone(c, { f: 330, d: 0.18, type: 'sine', v: 0.08, lp: 1200 }); tone(c, { f: 494, t: 0.07, d: 0.18, type: 'sine', v: 0.06, lp: 1400 }); },
  close:  (c) => tone(c, { f: 440, f2: 294, d: 0.16, type: 'sine', v: 0.07, lp: 1200 }),
  fav:    (c) => { tone(c, { f: 587, d: 0.12, v: 0.08, lp: 1800 }); tone(c, { f: 784, t: 0.09, d: 0.2, v: 0.07, lp: 1800 }); },
  unfav:  (c) => tone(c, { f: 587, f2: 440, d: 0.14, v: 0.06, lp: 1500 }),
  launch: (c) => { [262, 330, 392, 523].forEach((f, i) => tone(c, { f, t: i * 0.1, d: 0.5, type: 'sine', v: 0.08, lp: 1800 })); },
  success:(c) => { tone(c, { f: 523, d: 0.12, v: 0.07, lp: 1600 }); tone(c, { f: 659, t: 0.1, d: 0.22, v: 0.07, lp: 1600 }); },
  error:  (c) => { tone(c, { f: 220, d: 0.16, type: 'sine', v: 0.09, lp: 700 }); tone(c, { f: 196, t: 0.14, d: 0.2, type: 'sine', v: 0.09, lp: 700 }); },
  bigIn:  (c) => { tone(c, { f: 196, f2: 392, d: 0.45, type: 'sine', v: 0.08, lp: 1200 }); tone(c, { f: 587, t: 0.25, d: 0.35, v: 0.05, lp: 1500 }); },
  bigOut: (c) => tone(c, { f: 392, f2: 196, d: 0.4, type: 'sine', v: 0.07, lp: 1100 }),
};
const SOUNDS_RETRO = {   // 8 бит, как в старых приставках
  move:   (c) => tone(c, { f: 1568, d: 0.03, type: 'square', v: 0.03 }),
  tab:    (c) => { tone(c, { f: 988, d: 0.04, type: 'square', v: 0.04 }); tone(c, { f: 1319, t: 0.04, d: 0.05, type: 'square', v: 0.04 }); },
  select: (c) => { tone(c, { f: 784, d: 0.04, type: 'square', v: 0.05 }); tone(c, { f: 1175, t: 0.04, d: 0.06, type: 'square', v: 0.05 }); },
  back:   (c) => { tone(c, { f: 1175, d: 0.04, type: 'square', v: 0.045 }); tone(c, { f: 784, t: 0.04, d: 0.06, type: 'square', v: 0.045 }); },
  open:   (c) => [523, 784, 1047].forEach((f, i) => tone(c, { f, t: i * 0.035, d: 0.05, type: 'square', v: 0.04 })),
  close:  (c) => [1047, 784, 523].forEach((f, i) => tone(c, { f, t: i * 0.035, d: 0.05, type: 'square', v: 0.04 })),
  fav:    (c) => [1319, 1568, 2093].forEach((f, i) => tone(c, { f, t: i * 0.05, d: 0.07, type: 'square', v: 0.04 })),
  unfav:  (c) => [1568, 1047].forEach((f, i) => tone(c, { f, t: i * 0.05, d: 0.07, type: 'square', v: 0.04 })),
  launch: (c) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, { f, t: i * 0.075, d: 0.09, type: 'square', v: 0.05 })); tone(c, { f: 131, d: 0.5, type: 'triangle', v: 0.12 }); },
  success:(c) => [784, 1047, 1319].forEach((f, i) => tone(c, { f, t: i * 0.06, d: 0.08, type: 'square', v: 0.045 })),
  error:  (c) => { tone(c, { f: 147, d: 0.12, type: 'square', v: 0.06 }); tone(c, { f: 110, t: 0.12, d: 0.18, type: 'square', v: 0.06 }); },
  bigIn:  (c) => [262, 392, 523, 784, 1047].forEach((f, i) => tone(c, { f, t: i * 0.05, d: 0.07, type: 'square', v: 0.045 })),
  bigOut: (c) => [1047, 784, 523, 392, 262].forEach((f, i) => tone(c, { f, t: i * 0.05, d: 0.07, type: 'square', v: 0.045 })),
};
const SOUNDS_GLASS = {   // звонкие «стеклянные» колокольчики
  move:   (c) => bell(c, 2093, 0, 0.12, 0.025),
  tab:    (c) => { bell(c, 1568, 0, 0.18, 0.04); bell(c, 2093, 0.05, 0.2, 0.035); },
  select: (c) => bell(c, 1319, 0, 0.3, 0.07),
  back:   (c) => bell(c, 988, 0, 0.28, 0.06),
  open:   (c) => { bell(c, 1047, 0, 0.35, 0.06); bell(c, 1568, 0.07, 0.35, 0.05); },
  close:  (c) => { bell(c, 1568, 0, 0.3, 0.05); bell(c, 1047, 0.07, 0.3, 0.045); },
  fav:    (c) => { bell(c, 1760, 0, 0.3, 0.06); bell(c, 2637, 0.08, 0.4, 0.05); },
  unfav:  (c) => bell(c, 1175, 0, 0.3, 0.05),
  launch: (c) => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => bell(c, f, i * 0.08, 0.7, 0.06)),
  success:(c) => { bell(c, 1319, 0, 0.35, 0.06); bell(c, 1976, 0.1, 0.45, 0.05); },
  error:  (c) => { tone(c, { f: 233, d: 0.14, type: 'triangle', v: 0.1, lp: 1200 }); tone(c, { f: 220, t: 0.13, d: 0.2, type: 'triangle', v: 0.1, lp: 1200 }); },
  bigIn:  (c) => [784, 1175, 1568, 2349].forEach((f, i) => bell(c, f, i * 0.07, 0.6, 0.05)),
  bigOut: (c) => [2349, 1568, 1175, 784].forEach((f, i) => bell(c, f, i * 0.06, 0.5, 0.045)),
};
const SOUNDS_MIN = {   // только короткие тихие щелчки
  move:   (c) => tone(c, { f: 2400, d: 0.012, type: 'sine', v: 0.03 }),
  tab:    (c) => tone(c, { f: 1800, d: 0.018, type: 'sine', v: 0.045 }),
  select: (c) => tone(c, { f: 1400, d: 0.022, type: 'sine', v: 0.07 }),
  back:   (c) => tone(c, { f: 1000, d: 0.022, type: 'sine', v: 0.06 }),
  open:   (c) => tone(c, { f: 1200, d: 0.025, type: 'sine', v: 0.06 }),
  close:  (c) => tone(c, { f: 900, d: 0.025, type: 'sine', v: 0.05 }),
  fav:    (c) => { tone(c, { f: 1600, d: 0.02, v: 0.06 }); tone(c, { f: 2200, t: 0.04, d: 0.02, v: 0.05 }); },
  unfav:  (c) => tone(c, { f: 1100, d: 0.02, v: 0.05 }),
  launch: (c) => { tone(c, { f: 1400, d: 0.03, v: 0.08 }); tone(c, { f: 2100, t: 0.06, d: 0.04, v: 0.07 }); },
  success:(c) => tone(c, { f: 1800, d: 0.03, v: 0.06 }),
  error:  (c) => tone(c, { f: 300, d: 0.06, type: 'triangle', v: 0.09 }),
  bigIn:  (c) => tone(c, { f: 900, f2: 1500, d: 0.08, v: 0.05 }),
  bigOut: (c) => tone(c, { f: 1500, f2: 900, d: 0.08, v: 0.05 }),
};
const SOUND_PACKS = [['xbox', 'Консоль', 'Чёткие тоны, как в меню Xbox', SOUNDS_XBOX], ['soft', 'Мягкий', 'Приглушённые, тёплые — для вечера', SOUNDS_SOFT],
  ['retro', 'Ретро', '8 бит, как на старых приставках', SOUNDS_RETRO], ['glass', 'Стекло', 'Звонкие колокольчики', SOUNDS_GLASS], ['min', 'Минимум', 'Только тихие щелчки', SOUNDS_MIN]];
const soundPack = () => (SOUND_PACKS.find((x) => x[0] === settings.soundPack) || SOUND_PACKS[0])[3];
const SOUNDS = new Proxy({}, { get: (_, k) => soundPack()[k] || SOUNDS_XBOX[k], has: (_, k) => k in SOUNDS_XBOX });
function sfx(name) {
  const now = performance.now();
  if (now - (SND.last[name] || 0) < (name === 'move' ? 45 : 70)) return;  // не трещать при удержании
  SND.last[name] = now;
  try { rumble(name); } catch { /* вибрация необязательна */ }
  if (settings.sound === false || !SOUNDS[name]) return;
  try { const c = sndCtx(); if (c) SOUNDS[name](c); } catch { /* звук необязателен */ }
}

// ─── Словарь жанров (перевод уже сохранённых английских жанров) ─────────────────
const GENRE_RU = {
  'action': 'Экшен', 'adventure': 'Приключения', 'rpg': 'РПГ', 'role-playing': 'РПГ', 'role-playing games (rpg)': 'РПГ',
  'strategy': 'Стратегия', 'shooter': 'Шутер', 'puzzle': 'Головоломка', 'racing': 'Гонки', 'sports': 'Спорт',
  'simulation': 'Симулятор', 'simulator': 'Симулятор', 'fighting': 'Файтинг', 'platformer': 'Платформер', 'arcade': 'Аркада',
  'indie': 'Инди', 'casual': 'Казуальные', 'family': 'Семейные', 'board games': 'Настольные', 'card': 'Карточная',
  'educational': 'Обучающая', 'massively multiplayer': 'MMO', 'horror': 'Хоррор', 'survival': 'Выживание', 'stealth': 'Стелс',
  'metroidvania': 'Метроидвания', 'roguelike': 'Рогалик', 'rogue-like': 'Рогалик', 'roguelite': 'Рогалик', 'sandbox': 'Песочница',
  'open world': 'Открытый мир', 'visual novel': 'Визуальная новелла', 'point-and-click': 'Квест', 'tactical': 'Тактика',
  'turn-based strategy': 'Пошаговая стратегия', 'real-time strategy': 'RTS', 'real time strategy': 'RTS', 'hack and slash': 'Слешер',
  'music': 'Музыкальная', 'rhythm': 'Ритм-игра', 'co-op': 'Кооператив', 'multiplayer': 'Мультиплеер', 'singleplayer': 'Одиночная',
  'action rpg': 'Экшен РПГ', 'action-rpg': 'Экшен РПГ', 'soulslike': 'Соулслайк', 'mmorpg': 'MMORPG', 'moba': 'MOBA',
};
function translateGenre(str) { return String(str || '').split(',').map((x) => GENRE_RU[x.trim().toLowerCase()] || x.trim()).filter(Boolean).join(', '); }
async function migrateGenres() {
  const changed = [];
  for (const g of games) {
    let ch = false;
    if (g.genre) { const t = translateGenre(g.genre); if (t !== g.genre) { g.genre = t; ch = true; } }
    // «Игра — ярлык» → «Игра»: хвост, который Windows дописывает к ярлыкам
    const n = String(g.name || '').replace(/\s*[-—–]\s*(ярлык|shortcut)(\s*\(\d+\))?$/i, '').replace(/\.exe$/i, '').trim();
    if (n && n !== g.name) { g.name = n; ch = true; }
    if (ch) changed.push(g);
  }
  if (changed.length) await api.saveGamesBulk(changed);
}

// ─── Тема: тёмная / светлая ──────────────────────────────────────────────────
// Цвета тем — в assets/app.css (:root[data-theme=…]), как в приложении Xbox
// Размер обложек в списке слева: обычный / крупный / большой
const LSIZES = [['m', 'Обычные', 'ph-list'], ['l', 'Крупные', 'ph-rows'], ['xl', 'Большие', 'ph-image']];
const listSize = () => (LSIZES.some((x) => x[0] === settings.listSize) ? settings.listSize : 'm');
function applyListSize() { document.body.dataset.lsize = listSize(); }
function setListSize(k, quiet) {
  if (k === listSize()) return;
  const el = $('#list'); const sel = el && $(`.lrow.on`, el);
  settings.listSize = k; applyListSize(); if (!dlgOpen()) saveSettingsQuiet(); renderSideTop();   // из окна настроек — сохранится по «Сохранить»
  sel?.scrollIntoView({ block: 'nearest' });
  if (!quiet) { sfx('tab'); toast('Обложки в списке: ' + LSIZES.find((x) => x[0] === k)[1].toLowerCase()); }
}
// ─── Цветовые схемы (акцент: кнопки, выделение, полоски) ───────────────────────
const ACCENTS = [
  ['xbox', 'Xbox', '#107c10', '#52b043'], ['ps', 'PlayStation', '#0062c4', '#4a9bff'], ['steam', 'Steam', '#1a73c4', '#66c0f4'],
  ['violet', 'Фиолетовая', '#6a4bd6', '#9d8bff'], ['teal', 'Бирюзовая', '#0d8577', '#2dd4bf'], ['orange', 'Оранжевая', '#c95a0a', '#ff8c3a'],
  ['red', 'Красная', '#bf2530', '#ff5a62'], ['pink', 'Розовая', '#b8306f', '#ff6fb1'],
];
// Фон, панели и выделение слегка окрашиваются в цвет схемы. Сила: нет / лёгкий / заметный
const TINTS = [['none', 'Нет'], ['soft', 'Лёгкий'], ['strong', 'Заметный']];
const TINT_BASE = {
  dark: { '--color-bg': '#1a1b1e', '--color-surface': '#25282c', '--xb-panel': '#25282c', '--xb-field': '#24262a', '--xb-hover': '#2f3237', '--xb-sel': '#3e434b', '--color-neutral-900': '#2c2f33', '--color-neutral-800': '#3a3d42' },
  light: { '--color-bg': '#f3f3f3', '--color-surface': '#ffffff', '--xb-panel': '#ffffff', '--xb-field': '#ffffff', '--xb-hover': '#e9eaec', '--xb-sel': '#dcdde0', '--color-neutral-900': '#e8e9eb', '--color-neutral-800': '#d6d7da' },
};
function applyTint(a) {
  const root = document.documentElement.style;
  const light = isLight(), base = TINT_BASE[light ? 'light' : 'dark'];
  const k = settings.tint || 'soft';
  if (!a || k === 'none') { Object.keys(base).forEach((p) => root.removeProperty(p)); return; }
  const pct = (light ? { soft: 5, strong: 10 } : { soft: 7, strong: 14 })[k] || 7;
  const c = light ? a[2] : a[3];
  for (const [p, v] of Object.entries(base)) {
    const w = p === '--xb-sel' || p === '--xb-hover' ? pct * 1.8 : p === '--color-bg' ? pct * 0.8 : pct;   // выделение — чуть ярче
    root.setProperty(p, `color-mix(in srgb, ${c} ${w.toFixed(1)}%, ${v})`);
  }
}
function applyAccent() {
  const root = document.documentElement.style;
  const a = ACCENTS.find((x) => x[0] === (settings.accent || 'xbox')) || ACCENTS[0];
  applyTint(a);
  const props = ['--xb-green', '--xb-green-hover', '--color-accent', ...[100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => '--color-accent-' + n)];
  if (a[0] === 'xbox') { props.forEach((p) => root.removeProperty(p)); return; }
  const [, , btn, hi] = a, mix = (c, pct, w) => `color-mix(in srgb, ${c} ${pct}%, ${w})`;
  const light = isLight();
  root.setProperty('--xb-green', btn); root.setProperty('--xb-green-hover', mix(btn, 86, '#fff'));
  root.setProperty('--color-accent', light ? btn : hi);
  const scale = light
    ? [mix(btn, 55, '#000'), mix(btn, 75, '#000'), btn, mix(btn, 50, hi), hi, hi, mix(hi, 50, '#fff'), mix(hi, 25, '#fff'), mix(hi, 12, '#fff')]
    : [mix(hi, 12, '#fff'), mix(hi, 35, '#fff'), mix(hi, 65, '#fff'), mix(hi, 85, '#fff'), hi, mix(btn, 60, hi), btn, mix(btn, 65, '#000'), mix(btn, 35, '#16171a')];
  scale.forEach((v, i) => root.setProperty('--color-accent-' + (i + 1) * 100, v));
}
function applyTheme() {
  const light = isLight();
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  applyBlur(); applyListSize(); applyAccent();
  $('#theme-ico').className = light ? 'ph ph-moon' : 'ph ph-sun';
  $('#theme-btn').title = light ? 'Тёмная тема' : 'Светлая тема';
}
// Размытие фоновой картинки (Настройки → Внешний вид), 0 — без размытия
function blurPx() { const v = Number(settings.bgBlur); return Number.isFinite(v) ? Math.max(0, Math.min(60, v)) : 28; }
function applyBlur() { document.documentElement.style.setProperty('--bg-blur', blurPx() + 'px'); }
async function toggleTheme() {
  settings.theme = isLight() ? 'dark' : 'light';
  applyTheme(); render();
  await saveSettingsQuiet();
}
async function saveSettingsQuiet() {
  await api.saveSettings({ ...settings, cats });
}

// ─── Фильтры и группы ────────────────────────────────────────────────────────
const CHIPS = [['all', 'Все'], ['fav', 'Избранное'], ['new', 'Новые']];   // запасной набор; на деле вкладки берутся из tabKeys()
const GROUPS = {
  recent: ['По дате запуска', 'ph ph-clock-counter-clockwise'],
  alpha: ['По названию', 'ph ph-sort-ascending'],
  time: ['По времени в игре', 'ph ph-hourglass-medium'],
  added: ['По дате добавления', 'ph ph-calendar-plus'],
};
function visible() { return games.filter((g) => !g.hidden); }
function filterList(f) {
  const vis = visible();
  if (f === 'fav') return vis.filter((g) => g.favorite);
  if (f === 'new') return vis.filter((g) => !isPlayed(g));
  if (f === 'long') return vis.filter((g) => (g.playtime || 0) >= LONG_MIN);
  if (f === 'done') return vis.filter((g) => g.completed);
  if (f === 'hidden') return games.filter((g) => g.hidden);
  if (f === 'missing') return games.filter((g) => isMissing(g));
  if (f === 'recent') return vis.filter((g) => isPlayed(g) || running.has(g.id));
  if (f.startsWith('cat:')) return vis.filter((g) => inList(g, f.slice(4)));
  if (f.startsWith('tag:')) return vis.filter((g) => (g.tags || []).some((t) => t.toLowerCase() === f.slice(4)));
  if (f.startsWith('genre:')) return vis.filter((g) => genresOf(g).some((x) => x.toLowerCase() === f.slice(6)));
  return vis;
}
function recentSort(a, b) {
  const ra = running.has(a.id), rb = running.has(b.id);
  if (ra !== rb) return ra ? -1 : 1;
  return (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.addedAt || 0) - (a.addedAt || 0) || a.name.localeCompare(b.name, 'ru');
}
function sortBy(list, how) {
  return list.slice().sort((a, b) => how === 'alpha' ? a.name.localeCompare(b.name, 'ru')
    : how === 'time' ? (b.playtime || 0) - (a.playtime || 0) || a.name.localeCompare(b.name, 'ru')
    : how === 'added' ? (b.addedAt || 0) - (a.addedAt || 0)
    : recentSort(a, b));
}
function currentList() { return sortBy(filterList(S.filter), S.group); }
function bucketOf(g) {
  const how = S.group;
  if (how === 'alpha') { const c = (g.name.trim()[0] || '#').toUpperCase(); return /[0-9]/.test(c) ? '#' : c; }
  if (how === 'time') { const m = g.playtime || 0; return m >= 6000 ? 'Больше 100 часов' : m >= 1200 ? '20–100 часов' : m > 0 ? 'Меньше 20 часов' : 'Не запускались'; }
  if (how === 'added') { const d = daysAgo(g.addedAt); return d == null ? 'Давно' : d < 7 ? 'На этой неделе' : d <= 31 ? 'В этом месяце' : 'Раньше'; }
  if (running.has(g.id)) return 'Сейчас';
  if (!g.lastPlayed) return isPlayed(g) ? 'Давно' : 'Не запускались';
  const d = daysAgo(g.lastPlayed);
  return d <= 0 ? 'Сегодня' : d < 7 ? 'На этой неделе' : d <= 31 ? 'В этом месяце' : 'Давно';
}
function filterName(f) {
  if (TAB_BUILTIN[f]) return TAB_BUILTIN[f];
  if (f === 'done') return 'Пройденные';
  if (f === 'hidden') return 'Скрытые';
  if (f === 'missing') return 'Нет на компьютере';
  if (f.startsWith('cat:')) return catById(f.slice(4))?.name || 'Список';
  if (f.startsWith('tag:')) return '#' + (S.filterLabel || f.slice(4));
  if (f.startsWith('genre:')) return S.filterLabel || f.slice(6);
  return 'Все';
}
function setFilter(f, label) {
  S.filter = f; S.filterLabel = label || null;
  render();
  $('#list').scrollTop = 0;
}
function selGame() {
  return byId(S.selId) || currentList()[0] || visible()[0] || games[0] || null;
}
