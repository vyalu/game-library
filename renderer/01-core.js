/* Game Library — логика интерфейса (дизайн Nocturne v2).
   Слева — список игр по группам, справа — карточка выбранной игры,
   Ctrl+K — быстрый поиск, F11 — полноэкранный режим для геймпада.
   Все действия идут через data-act и делегирование событий,
   пользовательские строки всегда экранируются через esc(). */
'use strict';

// ─── Состояние ────────────────────────────────────────────────────────────────
let games = [];
let cats = [];
let settings = {};
const S = {
  filter: 'all',            // all | fav | new | long | done | hidden | cat:… | tag:… | genre:…
  filterLabel: null,
  group: 'recent',          // recent | alpha | time | added
  selId: null,
  selMode: false,
  selected: new Set(),
  fs: false,                // окно во весь экран (F11)
  pop: false,               // быстрые настройки над кнопкой-шестерёнкой
  pal: { open: false, q: '', i: 0 },
  big: { open: false, tab: 'all', idx: 0, sort: null, sheet: false, si: 0, zone: 'grid', ri: 0, page: null, pi: 0 },
};
const running = new Map();  // id игры → время старта (мс)
let updateState = {};

const DAY = 86400000;
const CAT_HUES = [290, 160, 30, 230, 350, 200, 90, 130];
const LONG_MIN = 20 * 60;   // «Долгие» — от 20 часов

// ─── Утилиты ─────────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function initials(name) {
  return String(name || '?').split(/[\s:]+/).map((w) => (w.match(/[A-Za-zА-Яа-яЁё0-9]/) || [''])[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}
function hash(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function hueOf(g) { const h = Number(g.hue); return Number.isFinite(h) ? h : (hash(g.id || g.name) % 360); }
function isLight() { return settings.theme === 'light'; }
function gradient(g, deg = 160) {
  const h = hueOf(g);
  return isLight()
    ? `linear-gradient(${deg}deg, oklch(0.9 0.045 ${h}) 0%, oklch(0.82 0.06 ${h}) 55%, oklch(0.76 0.05 ${h}) 100%)`
    : `linear-gradient(${deg}deg, oklch(0.38 0.055 ${h}) 0%, oklch(0.26 0.035 ${h}) 55%, oklch(0.2 0.02 ${h}) 100%)`;
}
function cssUrl(u) { return `url("${String(u).replace(/["\\\n]/g, (c) => encodeURIComponent(c))}")`; }
// Фон обложки: картинка, если есть, иначе цветной градиент по названию
function coverBg(g, deg = 160) {
  return g.cover ? `background-image:${esc(cssUrl(g.cover))}, ${gradient(g, deg)};` : `background:${gradient(g, deg)};`;
}
// Заглушка вместо обложки для крупных плиток: название игры как на коробке, а не две буквы
function noCoverHTML(g) {
  const st = storeOf(g);
  return `<span class="nocov"><span class="nocov-ini">${esc(initials(g.name))}</span><i class="ph-fill ${st === 'steam' ? 'ph-steam-logo' : 'ph-game-controller'}"></i><b>${esc(g.name)}</b></span>`;
}
function coverBox(g, cls, deg = 160) {
  return `<div class="${cls}" style="${coverBg(g, deg)}">${g.cover ? '' : `<span class="ini">${esc(initials(g.name))}</span>`}</div>`;
}
// Название игры: логотип с прозрачным фоном (SteamGridDB), если есть, иначе текстом
function titleHTML(g, cls, tag) {
  if (g.logo && settings.showLogos !== false) return `<${tag} class="has-logo"><img class="${cls}" src="${esc(g.logo)}" alt="${esc(g.name)}" title="${esc(g.name)}" draggable="false"></${tag}>`;
  return `<${tag}>${esc(g.name)}</${tag}>`;
}
// Фон карточки: широкая картинка (hero), если есть, иначе обложка
function heroStyle(g, deg = 120) {
  return g.hero ? `background-image:${esc(cssUrl(g.hero))}, ${gradient(g, deg)};` : coverBg(g, deg);
}
// Пропорции картинки (ширина / высота), чтобы понять, вертикальная ли обложка
const ASPECT = new Map();
function imgAspect(url) {
  if (!url) return Promise.resolve(null);
  if (ASPECT.has(url)) return Promise.resolve(ASPECT.get(url));
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { const r = im.naturalWidth / (im.naturalHeight || 1); ASPECT.set(url, r); res(r); };
    im.onerror = () => res(null);
    im.src = url;
  });
}
async function needsCover(g) { if (!g.cover) return true; const r = await imgAspect(g.cover); return r != null && r > 1.15; }
function playLabel(m) { m = m || 0; if (!m) return '0 мин'; if (m < 60) return m + ' мин'; return Math.round(m / 60).toLocaleString('ru-RU') + ' ч'; }
function exactTime(m) { m = m || 0; if (m < 60) return m + ' мин'; const h = Math.floor(m / 60), r = m % 60; return h.toLocaleString('ru-RU') + ' ч' + (r ? ' ' + r + ' мин' : ''); }
function daysAgo(ts) { if (!ts) return null; const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(ts); b.setHours(0, 0, 0, 0); return Math.round((a - b) / DAY); }
function plural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; }
function agoLabel(d) {
  if (d == null) return 'Не запускалась';
  if (d <= 0) return 'Сегодня';
  if (d === 1) return 'Вчера';
  if (d < 21) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  if (d < 60) return Math.round(d / 7) + ' нед. назад';
  if (d < 365) return Math.round(d / 30) + ' мес. назад';
  return 'Больше года назад';
}
function lastLabel(ts) { return agoLabel(daysAgo(ts)); }
function genresOf(g) { return String(g.genre || '').split(',').map((x) => x.trim()).filter(Boolean); }
function isPlayed(g) { return !!(g.lastPlayed || g.launched || g.playtime); }
function catById(id) { return cats.find((c) => c.id === id); }
function catColor(c) { return /^(#[0-9a-f]{3,8}|oklch\([\d.\s]+\))$/i.test(String(c?.color || '')) ? c.color : 'var(--color-neutral-500)'; }
// ─── Свои списки («Для компании», «Поиграть потом»…). Игра может быть в нескольких списках ─────
function gameLists(g) { const l = Array.isArray(g.lists) ? g.lists.slice() : []; if (g.catId && !l.includes(g.catId)) l.push(g.catId); return l.filter((id) => catById(id)); }
function inList(g, id) { return (Array.isArray(g.lists) && g.lists.includes(id)) || g.catId === id; }
function setInList(g, id, on) {
  const l = new Set(Array.isArray(g.lists) ? g.lists : []); if (g.catId) l.add(g.catId); g.catId = null;
  on ? l.add(id) : l.delete(id); g.lists = [...l];
}
// Вкладки библиотеки (одни и те же в обычном, компактном и ТВ-режиме) — порядок задаёт пользователь
const TAB_BUILTIN = { all: 'Все', recent: 'Недавние', fav: 'Избранное', new: 'Новые', done: 'Пройденные' };
function tabKeys() {
  const order = Array.isArray(settings.tabs) ? settings.tabs : ['all', 'fav', 'new'];
  const ok = (k) => k in TAB_BUILTIN || (k.startsWith('cat:') && catById(k.slice(4)));
  const out = ['all', ...order.filter((k) => k !== 'all' && ok(k))];
  for (const c of cats) if (!out.includes('cat:' + c.id) && !(settings.tabsHidden || []).includes('cat:' + c.id)) out.push('cat:' + c.id);   // новые списки — в конец
  return [...new Set(out)];
}
function tabLabel(k) { return TAB_BUILTIN[k] || catById(k.slice(4))?.name || '?'; }
function tabGames(k) {
  const vis = visible();
  if (k === 'recent') return vis.filter((g) => isPlayed(g) || running.has(g.id));
  return filterList(k);
}
function byId(id) { return games.find((g) => g.id === id); }
function pad(n) { return String(n).padStart(2, '0'); }
function clockText(ms) { const el = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(el / 3600))}:${pad(Math.floor(el / 60) % 60)}:${pad(el % 60)}`; }
function runTime(id) { return clockText(Date.now() - (running.get(id) || Date.now())); }
function isNewGame(g) { return !isPlayed(g) && g.addedAt && Date.now() - g.addedAt < 7 * DAY; }

// Откуда игра: Steam, Epic Games и т.д. — из импорта магазина или по пути к файлу
const STORES = {
  steam: ['Steam', 'ph ph-steam-logo'], epic: ['Epic Games', 'ph ph-storefront'], gog: ['GOG', 'ph ph-disc'],
  ubisoft: ['Ubisoft Connect', 'ph ph-cube'], ea: ['EA', 'ph ph-cube'], battlenet: ['Battle.net', 'ph ph-lightning'],
  xbox: ['Xbox', 'ph ph-game-controller'], riot: ['Riot Games', 'ph ph-sword'],
};
function storeOf(g) {
  if (g.store && STORES[g.store]) return g.store;
  const u = String(g.launchUrl || '');
  if (/^steam:/i.test(u)) return 'steam';
  if (/^com\.epicgames/i.test(u)) return 'epic';
  const p = [g.exePath, g.installDir, g.lnkPath].filter(Boolean).join('|').toLowerCase().replace(/\//g, '\\');
  if (/\\steamapps\\|\\steam\\|^steam:/.test(p)) return 'steam';
  if (/epic games|\\epic\\|^com\.epicgames/.test(p)) return 'epic';
  if (/\\gog( galaxy)?\\|gog games|\\gog\.com\\/.test(p)) return 'gog';
  if (/ubisoft|uplay/.test(p)) return 'ubisoft';
  if (/\\ea games\\|\\origin games\\|\\electronic arts\\/.test(p)) return 'ea';
  if (/battle\.net|blizzard/.test(p)) return 'battlenet';
  if (/xboxgames|windowsapps/.test(p)) return 'xbox';
  if (/riot games/.test(p)) return 'riot';
  return null;
}
function sourceOf(g) {
  const st = storeOf(g);
  return st ? STORES[st] : ['Игра на ПК', 'ph ph-desktop-tower'];
}
// Значок источника: логотип лаунчера (Steam, Epic) с компьютера пользователя,
// а у игр без магазина — значок самой игры (из её .exe)
const STORE_ICONS = {};
const EXE_ICONS = new Map();   // id игры → data:URL | null (грузится)
let exeIconQueue = new Set(), exeIconTimer = null;
function srcIconHTML(g, cls = 'src-ic') {
  const st = storeOf(g);
  if (st) {
    if (STORE_ICONS[st]) return `<img class="${cls} store-img" src="${esc(STORE_ICONS[st])}" alt="" title="${esc(STORES[st][0])}">`;
    return `<i class="${STORES[st][1]} ${cls}" title="${esc(STORES[st][0])}"></i>`;
  }
  return `<i class="ph-fill ph-desktop-tower ${cls} pc-ic" title="Игра на ПК (без магазина)"></i>`;
}
function queueExeIcon(id) {
  exeIconQueue.add(id);
  clearTimeout(exeIconTimer);
  exeIconTimer = setTimeout(async () => {
    const ids = [...exeIconQueue].slice(0, 50); ids.forEach((x) => exeIconQueue.delete(x));
    ids.forEach((x) => EXE_ICONS.set(x, null));
    if (!api.fileIcons) return;
    const list = ids.map(byId).filter(Boolean).map((g) => ({ key: g.id, iconPath: /\.url$/i.test(g.exePath || '') ? (g.lnkPath || g.exePath) : (g.exePath || g.lnkPath) }));
    const res = await api.fileIcons(list).catch(() => ({}));
    for (const [k, v] of Object.entries(res || {})) EXE_ICONS.set(k, v);
    document.querySelectorAll('[data-exeicon]').forEach((el) => {
      const v = EXE_ICONS.get(el.dataset.exeicon); if (!v || el.tagName === 'IMG') return;
      const img = document.createElement('img'); img.className = el.className.replace(/\bph\S*\s?/g, '').trim() + ' exe-img';
      img.src = v; img.alt = ''; img.dataset.exeicon = el.dataset.exeicon; el.replaceWith(img);
    });
    if (exeIconQueue.size) queueExeIcon([...exeIconQueue][0]);
  }, 60);
}
// Строка состояния под названием: «Запущена», «12 ч · вчера», «Не запускалась»
function isMissing(g) { return exists.get(g.id) === false && !running.has(g.id); }
function statusLine(g) {
  if (isMissing(g)) return '<span class="miss-t"><i class="ph ph-warning-circle"></i>Нет на компьютере</span>';
  if (running.has(g.id)) return `Запущена · <span class="live-time" data-run="${esc(g.id)}">${runTime(g.id)}</span>`;
  if (!isPlayed(g)) return 'Не запускалась';
  return esc(playLabel(g.playtime) + ' · ' + lastLabel(g.lastPlayed).toLowerCase());
}

let toastTimer;
function toast(msg, type = '') {
  const el = $('#toast');
  el.innerHTML = `<i class="ph ${type === 'err' ? 'ph-warning-circle' : 'ph-check-circle'}"></i><span></span>`;
  el.lastChild.textContent = msg;
  el.className = 'show ' + type;
  if (type === 'err') sfx('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3800);
}
