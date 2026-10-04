const ai = require('./ai');
const dl = require('./download');
const { fetchJson } = dl;
const { hltbLookup } = require('./hltb');
// Ключ отправляем только в API SteamGridDB; картинки с CDN (cdn2.steamgriddb.com) качаются без него
// Официальные картинки библиотеки Steam (обложка 600×900, фон, логотип) — без ключа
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const SGDB_API = /^https:\/\/(www\.)?steamgriddb\.com\//i;

async function rawgSearch(name, apiKey) {
  if (!apiKey) return { error: 'no_key', results: [] };
  const q = encodeURIComponent(name.replace(/[_\-.]/g, ' ').trim());
  const res = await fetchJson(`https://api.rawg.io/api/games?key=${encodeURIComponent(apiKey)}&search=${q}&page_size=8`);
  if (res.status === 401 || res.status === 403) return { error: 'bad_key', results: [] };
  if (res.status !== 200 || !res.body?.results) return { error: 'not_found', results: [] };
  return { results: res.body.results };
}

async function rawgDetails(slug, apiKey) {
  const res = await fetchJson(`https://api.rawg.io/api/games/${encodeURIComponent(slug)}?key=${encodeURIComponent(apiKey)}`);
  return res.status === 200 ? res.body : null;
}

async function rawgScreenshots(slug, apiKey) {
  const res = await fetchJson(`https://api.rawg.io/api/games/${encodeURIComponent(slug)}/screenshots?key=${encodeURIComponent(apiKey)}&page_size=6`);
  return res.status === 200 ? (res.body?.results||[]).map(s=>s.image) : [];
}

async function sgdbSearch(name, apiKey) {
  if (!apiKey) return null;
  const res = await fetchJson(
    `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(name)}`,
    { Authorization: `Bearer ${apiKey}` }
  );
  return res.body?.success && res.body.data?.length ? res.body.data[0] : null;
}

// Точное совпадение по номеру игры в Steam — без угадывания по названию
async function sgdbBySteam(appid, apiKey) {
  if (!apiKey || !appid) return null;
  const res = await fetchJson(`https://www.steamgriddb.com/api/v2/games/steam/${encodeURIComponent(appid)}`, { Authorization: `Bearer ${apiKey}` });
  return res.body?.success && res.body.data?.id ? res.body.data : null;
}

async function sgdbGrids(id, apiKey) {
  const res = await fetchJson(
    `https://www.steamgriddb.com/api/v2/grids/game/${id}?dimensions=600x900,342x482&limit=8`,
    { Authorization: `Bearer ${apiKey}` }
  );
  return res.body?.success ? (res.body.data||[]).map(g=>({url:g.url,thumb:g.thumb})) : [];
}

async function sgdbHeroes(id, apiKey) {
  const res = await fetchJson(
    `https://www.steamgriddb.com/api/v2/heroes/game/${id}?limit=4`,
    { Authorization: `Bearer ${apiKey}` }
  );
  return res.body?.success ? (res.body.data||[]).map(h=>({url:h.url,thumb:h.thumb})) : [];
}

async function sgdbLogos(id, apiKey) {
  const res = await fetchJson(
    `https://www.steamgriddb.com/api/v2/logos/game/${id}?limit=6&mimes=image/png,image/webp`,
    { Authorization: `Bearer ${apiKey}` }
  );
  return res.body?.success ? (res.body.data||[]).map(l=>({url:l.url,thumb:l.thumb})) : [];
}

// ─── Steam Store: описание на русском (как на странице игры в Steam) ─────────
const HAS_RU = /[а-яё]/i;
const STEAM_GENRE = { 'экшены': 'Экшен', 'приключенческие игры': 'Приключения', 'ролевые игры': 'РПГ', 'стратегии': 'Стратегия',
  'симуляторы': 'Симулятор', 'казуальные игры': 'Казуальные', 'спортивные игры': 'Спорт', 'гонки': 'Гонки', 'инди': 'Инди',
  'массовые многопользовательские': 'MMO', 'ранний доступ': null, 'бесплатные': null, 'бесплатно играть': null };
function decodeEntities(t) {
  return t.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => (+n > 0 && +n <= 0x10ffff ? String.fromCodePoint(+n) : '')).replace(/&amp;/g, '&');
}
// HTML из Steam → обычный текст с абзацами; заголовки разделов — отдельной строкой
function steamHtmlToText(html) {
  let t = String(html || '')
    .replace(/<img[^>]*>/gi, '').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|ul|ol)>/gi, '\n\n').replace(/<(h1|h2|h3|h4)[^>]*>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, '');
  t = decodeEntities(t).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  t = t.replace(/^(Об игре|About This Game)\s*\n+/i, '');
  if (t.length > 6000) { const cut = t.lastIndexOf('\n', 6000); t = t.slice(0, cut > 3000 ? cut : 6000).trim(); }
  return t;
}
// HTML описания Steam → текст с метками для богатого показа: [[h]]заголовок, [[img]]url, [[vid]]url|постер
const SAFE_MEDIA = /^https:\/\/[a-z0-9.-]*(steamstatic\.com|steampowered\.com|akamaihd\.net)\//i;
function steamHtmlToRich(html) {
  let h = String(html || '');
  h = h.replace(/<video([^>]*)>([\s\S]*?)<\/video>/gi, (m, attrs, inner) => {
    const srcs = [...(attrs + inner).matchAll(/src="([^"]+)"/gi)].map((x) => x[1]);
    const src = srcs.find((u) => /\.mp4/i.test(u)) || srcs.find((u) => /\.webm/i.test(u));
    const poster = (attrs.match(/poster="([^"]+)"/i) || [])[1] || '';
    return src && SAFE_MEDIA.test(src) ? `\n\n[[vid]]${src}|${SAFE_MEDIA.test(poster) ? poster : ''}\n\n` : '';
  });
  h = h.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (m, u) => (SAFE_MEDIA.test(u) ? `\n\n[[img]]${u}\n\n` : ''));
  h = h.replace(/<(h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, x) => { const tx = decodeEntities(x.replace(/<[^>]+>/g, '')).trim(); return tx ? `\n\n[[h]]${tx}\n\n` : ''; });
  let t = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|ul|ol)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '').replace(/<[^>]+>/g, '');
  t = decodeEntities(t).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  t = t.replace(/^(\[\[h\]\])?(Об игре|About This Game)\s*\n+/i, '');
  if (t.length > 14000) { const cut = t.lastIndexOf('\n', 14000); t = t.slice(0, cut > 8000 ? cut : 14000).trim(); }
  return t;
}
const REVIEW_RU = { 'overwhelmingly positive': 'Крайне положительные', 'very positive': 'Очень положительные', 'positive': 'Положительные',
  'mostly positive': 'В основном положительные', 'mixed': 'Смешанные', 'mostly negative': 'В основном отрицательные', 'negative': 'Отрицательные',
  'very negative': 'Очень отрицательные', 'overwhelmingly negative': 'Крайне отрицательные' };
async function steamDetails(id) {
  for (const cc of ['&cc=RU', '', '&cc=US']) {
    const r = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=russian${cc}`);
    const d = r.body?.[id]?.success ? r.body[id].data : null;
    if (d) return d;
  }
  return null;
}
// Всё, что нужно для «живой» страницы игры: описание с картинками, отзывы игроков, Metacritic, скриншоты, трейлеры, русский язык
// Время прохождения: HowLongToBeat, а если он недоступен — среднее время из RAWG (одно число)
async function addPlaytimes(out, name, year, rawgKey, rawgTop = null) {
  try { const h = await hltbLookup(name, year); if (h) out.hltb = h; } catch {}
  if (out.hltb || !rawgKey) return out;
  let top = rawgTop;
  if (!top) { const r = await rawgSearch(name, rawgKey).catch(() => null); const want = normTitle(name); top = (r?.results || []).find((x) => normTitle(x.name) === want); }
  if (top?.playtime > 0) out.avgPlay = { h: top.playtime, src: 'rawg' };
  return out;
}
async function gameExtra({ appid = null, name = null, year = null, rawgKey = '' } = {}) {
  let id = appid && /^\d+$/.test(String(appid)) ? String(appid) : null;
  if (!id && name) {
    const f = await steamFindApp(name).catch(() => undefined);
    if (f === undefined) return { error: 'steam-busy' };   // Steam не ответил — повторим позже, не подставляя английский текст из RAWG
    id = f;
  }
  if (id) {
    const d = await steamDetails(id);
    if (d) {
      const out = { v: 4, from: 'steam', appid: id, t: Date.now() };
      out.about = steamHtmlToRich(d.about_the_game || d.detailed_description || '') || null;
      if (d.metacritic?.score) out.mc = { score: d.metacritic.score, url: /^https:\/\/www\.metacritic\.com\//.test(d.metacritic.url || '') ? d.metacritic.url : null };
      const rv = await fetchJson(`https://store.steampowered.com/appreviews/${id}?json=1&language=all&purchase_type=all&num_per_page=0&filter=summary`).catch(() => null);
      const q = rv?.body?.query_summary;
      if (q && q.total_reviews > 0) out.rev = { pct: Math.round(q.total_positive / q.total_reviews * 100), total: q.total_reviews, score: q.review_score || 0,
        desc: REVIEW_RU[String(q.review_score_desc || '').toLowerCase()] || null };
      out.cats = (d.categories || []).map((c) => ({ id: c.id, n: String(c.description || '') })).slice(0, 30);
      out.shots = (d.screenshots || []).slice(0, 16).map((x) => ({ t: x.path_thumbnail, f: x.path_full })).filter((x) => SAFE_MEDIA.test(x.f || ''));
      out.movies = (d.movies || []).map((m) => ({ n: m.name || '', thumb: m.thumbnail, src: m.mp4?.max || m.mp4?.['480'] || m.webm?.max || m.webm?.['480'] }))
        .filter((m) => m.src && SAFE_MEDIA.test(m.src)).slice(0, 4);
      if (d.achievements?.total) out.ach = d.achievements.total;
      if (d.controller_support) out.ctrl = d.controller_support;   // 'full' | 'partial'
      const L = String(d.supported_languages || '');
      const ru = L.match(/(?:русский|russian)(.{0,40})/i);
      out.ru = ru ? { ui: true, voice: /<strong>\*<\/strong>|\*/.test(ru[1].split(/,|<br>/)[0]) } : { ui: false, voice: false };
      if (d.website && /^https?:\/\//.test(d.website)) out.site = d.website;
      const y = (String(d.release_date?.date || '').match(/\b(19|20)\d{2}\b/) || [])[0] || year;
      return addPlaytimes(out, d.name || name, y, rawgKey);
    }
  }
  // Не из Steam — что-то найдём в RAWG по точному названию
  if (rawgKey && name) {
    const r = await rawgSearch(name, rawgKey).catch(() => null);
    const want = normTitle(name);
    const top = (r?.results || []).find((x) => normTitle(x.name) === want);
    if (top) {
      const out = { v: 4, from: 'rawg', t: Date.now() };
      if (top.metacritic) out.mc = { score: top.metacritic, url: null };
      if (top.ratings_count > 20 && top.rating) out.rawgRating = { r: top.rating, n: top.ratings_count };
      out.shots = (top.short_screenshots || []).slice(1, 13).map((x) => ({ t: x.image, f: x.image })).filter((x) => /^https:\/\//.test(x.f || ''));
      return addPlaytimes(out, name, year, rawgKey, top);
    }
  }
  return name ? addPlaytimes({ v: 4, from: null, t: Date.now() }, name, year, '') : { v: 4, from: null, t: Date.now() };
}
const normTitle = (n) => String(n || '').toLowerCase().replace(/[™®©]/g, '').replace(/&/g, 'and').replace(/[^a-zа-яё0-9]+/gi, '');
// Поиск игры в Steam по названию (для игр Epic, GOG и т.д.).
// Steam часто отвечает «слишком много запросов» (429) — тогда ждём и пробуем ещё. Возвращает id, null (такой игры нет)
// или undefined (Steam не ответил — проверим позже, а не будем считать, что игры в Steam нет).
const sleep = (ms) => new Promise((r) => setTimeout(r, process.env.GL_FAST ? 5 : ms));
// Журнал поиска (main.js пишет его в steam-search.log рядом с библиотекой) — чтобы понять, почему игра не нашлась
let searchLog = null;
const setSearchLog = (fn) => { searchLog = typeof fn === 'function' ? fn : null; };
const slog = (s) => { try { searchLog?.(s); } catch {} };
// Ответ: массив { id, name, type } — Steam ответил; null — не ответил (лимит запросов, сбой сети, страница вместо JSON)
async function steamSearch(term, l, cc) {
  for (let a = 0; a < 3; a++) {
    const r = await fetchJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=${l}${cc ? '&cc=' + cc : ''}`).catch(() => ({ status: 0 }));
    slog(`storesearch ${cc || '-'} «${term}» → ${r.status}${r.body?.items ? ' ' + r.body.items.length : ''}`);
    if (r.status === 200 && r.body && typeof r.body === 'object') return Array.isArray(r.body.items) ? r.body.items : [];
    if (r.status === 404) return [];
    await sleep(2500 * (a + 1));
  }
  return null;
}
// Поиск сообщества Steam: другой сервер (свой лимит запросов) и не скрывает игры, которые не продаются в регионе
async function communitySearch(term) {
  for (let a = 0; a < 2; a++) {
    const r = await fetchJson(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(term)}`).catch(() => ({ status: 0 }));
    slog(`community «${term}» → ${r.status}${Array.isArray(r.body) ? ' ' + r.body.length : ''}`);
    if (r.status === 200 && Array.isArray(r.body)) return r.body.map((x) => ({ id: x.appid, name: x.name, type: 'app' }));
    if (r.status === 404) return [];
    await sleep(2000 * (a + 1));
  }
  return null;
}
const EDITION = /\s*[:\-–—]?\s*\b(game of the year|goty|definitive|enhanced|complete|remastered|deluxe|ultimate|anniversary|gold|standard|director'?s cut)( edition)?\s*$/i;
const looseTitle = (n) => normTitle(String(n || '').replace(/[™®©]/g, '').replace(EDITION, '')).replace(/^the/, '');
function pickApp(items, want) {
  const w = normTitle(want), wl = looseTitle(want);
  return items.find((x) => normTitle(x.name) === w)
    || (wl.length > 5 ? items.find((x) => x.type === 'app' && looseTitle(x.name) === wl) : null);
}
// Ищем по очереди: магазин (регион RU) → сообщество Steam → магазин (регион US). В России часть игр
// в магазине скрыта — поиск с регионом RU их «не видит», хотя страница игры и русское описание есть.
async function steamFindApp(name) {
  if (!name) return null;
  const clean = String(name).replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
  const variants = [...new Set([clean, clean.replace(EDITION, '').trim()])].filter(Boolean);
  const sources = [(v) => steamSearch(v, 'russian', 'RU'), (v) => communitySearch(v), (v) => steamSearch(v, 'english', 'US')];
  let answered = false;
  for (const v of variants) {
    for (const src of sources) {
      const items = await src(v);
      if (items === null) continue;
      answered = true;
      const hit = pickApp(items, clean) || pickApp(items, v);
      if (hit) { slog(`  найдено: «${name}» → ${hit.id} «${hit.name}»`); return String(hit.id); }
    }
  }
  slog(`  ${answered ? 'нет в Steam' : 'Steam не ответил'}: «${name}»`);
  return answered ? null : undefined;
}
// Данные игры из магазина Steam на русском. appid не известен — ищем по точному названию.
async function steamStoreInfo({ appid = null, name = null } = {}) {
  let id = appid && /^\d+$/.test(String(appid)) ? String(appid) : null;
  if (!id) id = await steamFindApp(name);
  if (!id) return null;
  // Часть игр в регионе RU магазин не отдаёт (success:false) — тогда спрашиваем без региона и для US
  let d = null;
  for (const cc of ['&cc=RU', '', '&cc=US']) {
    const r = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=russian${cc}`);
    d = r.body?.[id]?.success ? r.body[id].data : null;
    if (d) break;
  }
  if (!d) return null;
  const description = steamHtmlToText(d.about_the_game || d.detailed_description || '') || steamHtmlToText(d.short_description || '');
  const genres = (d.genres || []).map((g) => { const k = String(g.description || '').toLowerCase(); return k in STEAM_GENRE ? STEAM_GENRE[k] : g.description; }).filter(Boolean);
  return { appid: id, name: d.name, description: description || null, ru: HAS_RU.test(description), shortDescription: steamHtmlToText(d.short_description || ''),
    genre: genres.slice(0, 2).join(', ') || null, developer: (d.developers || []).slice(0, 2).join(', ') || null,
    year: (String(d.release_date?.date || '').match(/\b(19|20)\d{2}\b/) || [])[0] || null,
    screenshots: (d.screenshots || []).slice(0, 3).map((x) => x.path_full).filter(Boolean), header: d.header_image || null };
}

// ─── Картинки библиотеки Steam ─────────────────────────────────────────────
// У новых игр файлы лежат по «хешированным» путям, поэтому старый адрес вида /apps/ID/library_600x900.jpg
// не работает. Настоящие адреса отдаёт IStoreBrowseService/GetItems (без ключа).
const STEAM_ASSETS = 'https://shared.steamstatic.com/store_item_assets/';
async function steamAssetUrls(appid) {
  let a = null;
  for (const cc of ['RU', 'US']) {
    const input = { ids: [{ appid: Number(appid) }], context: { language: 'russian', country_code: cc }, data_request: { include_assets: true } };
    const r = await fetchJson(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    a = r.body?.response?.store_items?.[0]?.assets;
    if (a?.asset_url_format) break;
  }
  if (!a?.asset_url_format) return {};
  const url = (f) => {
    if (!f) return null;
    const fmt = String(a.asset_url_format);
    const p = fmt.includes('${FILENAME}') ? fmt.replace('${FILENAME}', f) : fmt.replace(/\/?$/, '/') + f;
    return /^https?:/i.test(p) ? p : STEAM_ASSETS + p.replace(/^\//, '');
  };
  return { cover: [url(a.library_capsule_2x), url(a.library_capsule)].filter(Boolean), hero: [url(a.library_hero_2x), url(a.library_hero)].filter(Boolean),
    logo: [url(a.library_logo_2x), url(a.library_logo)].filter(Boolean), header: url(a.header) };
}
// Все варианты картинки игры Steam по порядку: файлы из кэша самого Steam на этом компьютере → адреса из GetItems → старые адреса CDN
function steamArtCands(kind, appid, assets, local) {
  const old = { cover: ['library_600x900_2x.jpg', 'library_600x900.jpg'], hero: ['library_hero.jpg'], logo: ['logo.png'] }[kind];
  return [...(local?.[kind] ? [{ file: local[kind], src: 'steam' }] : []), ...(assets?.[kind] || []).map((u) => ({ url: u, src: 'steam' })),
    ...old.map((f) => ({ url: `${STEAM_CDN}/${appid}/${f}`, src: 'steam' }))];
}

// ─── Русификация жанров и тегов ───────────────────────────────────────────────
const GENRE_RU = {
  'action': 'Экшен', 'adventure': 'Приключения', 'rpg': 'РПГ', 'role-playing': 'РПГ',
  'role-playing games (rpg)': 'РПГ', 'strategy': 'Стратегия', 'shooter': 'Шутер',
  'puzzle': 'Головоломка', 'racing': 'Гонки', 'sports': 'Спорт', 'simulation': 'Симулятор',
  'simulator': 'Симулятор', 'fighting': 'Файтинг', 'platformer': 'Платформер',
  'arcade': 'Аркада', 'indie': 'Инди', 'casual': 'Казуальные', 'family': 'Семейные',
  'board games': 'Настольные', 'card': 'Карточная', 'educational': 'Обучающая',
  'massively multiplayer': 'MMO', 'mmorpg': 'MMORPG', 'horror': 'Хоррор',
  'survival': 'Выживание', 'stealth': 'Стелс', 'metroidvania': 'Метроидвания',
  'roguelike': 'Рогалик', 'rogue-like': 'Рогалик', 'roguelite': 'Рогалик',
  'sandbox': 'Песочница', 'open world': 'Открытый мир', 'visual novel': 'Визуальная новелла',
  'point-and-click': 'Квест', 'point & click': 'Квест', 'tactical': 'Тактика',
  'turn-based strategy': 'Пошаговая стратегия', 'real time strategy': 'RTS',
  'real-time strategy': 'RTS', 'hack and slash': 'Слешер', 'beat \'em up': 'Битемап',
  'music': 'Музыкальная', 'rhythm': 'Ритм-игра', 'pinball': 'Пинбол',
  'first-person': 'От первого лица', 'third-person': 'От третьего лица',
  'co-op': 'Кооператив', 'multiplayer': 'Мультиплеер', 'singleplayer': 'Одиночная',
  'singleplayer ': 'Одиночная', 'mmo': 'MMO', 'moba': 'MOBA',
};

function translateGenre(genreStr) {
  if (!genreStr) return genreStr;
  return genreStr.split(',').map(g => {
    const key = g.trim().toLowerCase();
    return GENRE_RU[key] || g.trim();
  }).join(', ');
}

async function enrichGame(gameName, gameId, coversDir, opts = {}) {
  const { rawgKey='', sgdbKey='', aiSettings={}, downloadCover=false, downloadHero=false, downloadLogo=false, rawgSlug=null, steamAppId=null, steamLocal=null } = opts;
  const log = [];
  const result = {
    success: false,
    foundName: null, description: null, genre: null,
    year: null, developer: null, rating: null,
    coverUrl: null, coverRemoteUrl: null,
    sgdbGrids: [], sgdbHeroes: [], sgdbLogos: [], screenshots: [],
    searchedAs: gameName, log
  };

  const aiOn = ai.aiAvailable(aiSettings);
  const providerNames = { gemini: 'Gemini', groq: 'Groq', claude: 'Claude' };
  const providerLabel = providerNames[aiSettings.aiProvider] || 'AI';

  // 0. Игра из Steam: точные данные берём из самого Steam по номеру игры, название — оттуда же
  let st = null;
  if (steamAppId) {
    try { st = await steamStoreInfo({ appid: steamAppId }); } catch {}
    if (st) log.push(`✓ Steam: «${st.name}»`);
  }
  const strict = !!steamAppId;
  let sAssets = {};
  if (steamAppId) { try { sAssets = await steamAssetUrls(steamAppId); } catch {} }
  const store = async (c, id) => {
    if (c.file) { try { return dl.storeCoverFromFile(coversDir, id, c.file); } catch { return null; } }
    const headers = (c.auth && SGDB_API.test(c.url)) ? { Authorization: `Bearer ${c.auth}` } : {};
    return dl.storeCoverFromUrl(coversDir, id, c.url, headers);
  };   // для игр Steam чужие совпадения «по похожему названию» не принимаем

  // 1. Normalize name
  let searchName = st?.name || gameName;
  if (aiOn && !rawgSlug && !st) {
    log.push(`🤖 ${providerLabel}: нормализация...`);
    const norm = await ai.normalizeName(gameName, aiSettings);
    if (norm?.title) { searchName = norm.title; result.searchedAs = searchName; log.push(`🤖 "${gameName}" → "${searchName}"`); }
    else log.push(`⚠ ${providerLabel}: ${ai.getLastError() || 'пропуск нормализации'}`);
  }

  // 2. RAWG
  let englishDesc = null, rawgUsed = false;
  if (strict && !st && !rawgSlug) log.push('⚠ Магазин Steam не ответил — данные с RAWG по названию не берём, чтобы не подставить чужую игру');
  if (rawgKey && !(strict && !st && !rawgSlug)) {
    let top = null;
    if (rawgSlug) {
      // Пользователь выбрал конкретную игру в списке — ищем именно её
      top = { slug: rawgSlug };
      log.push(`🔍 RAWG: выбранная игра (${rawgSlug})`);
    } else {
      log.push(`🔍 RAWG: "${searchName}"...`);
      let rawg = await rawgSearch(searchName, rawgKey);
      if (!rawg.results?.length && searchName !== gameName) rawg = await rawgSearch(gameName, rawgKey);
      const want = normTitle(searchName);
      if (rawg.error === 'bad_key') log.push('❌ RAWG: неверный ключ');
      else if (!rawg.results?.length) log.push('⚠ RAWG: не найдено');
      else {
        top = rawg.results.find((x) => normTitle(x.name) === want) || (strict ? null : rawg.results[0]);
        if (!top) log.push(`⚠ RAWG: точного совпадения с «${searchName}» нет — данные RAWG не используются`);
      }
    }
    if (top) {
      let det = await rawgDetails(top.slug, rawgKey);
      // Игра Steam: одинаковое название ещё не значит ту же игру — сверяем год и разработчика
      if (det && strict && st && !rawgSlug) {
        const y1 = Number(String(det.released || '').slice(0, 4)), y2 = Number(st.year);
        const devs = (x) => String(x || '').toLowerCase().split(/[,;]/).map((d) => normTitle(d.replace(/\b(ltd|llc|inc|gmbh|studios?|games|entertainment|interactive)\b/g, ''))).filter(Boolean);
        const sd = devs(st.developer), rd = devs((det.developers || []).map((d) => d.name).join(','));
        const devOk = sd.some((a) => rd.some((b) => a === b || a.includes(b) || b.includes(a)));
        const yearOk = y1 && y2 && Math.abs(y1 - y2) <= 1;
        if (!(devOk || (yearOk && !rd.length))) { log.push(`⚠ RAWG: «${det.name}» — другая игра (год ${y1 || '?'}, ${rd.join(', ') || 'разработчик неизвестен'}) — не используем`); det = null; top = null; }
      }
      if (det) {
        rawgUsed = true;
        result.foundName = det.name || top.name || null;
        if (result.foundName) log.push(`✓ RAWG: "${result.foundName}"`);
        if (rawgSlug && det.name) searchName = det.name; // для поиска обложек — точное название
        result.year = det.released?.slice(0,4)||null;
        result.rating = det.rating ? Math.round(det.rating*20) : null;
        result.genre = translateGenre(det.genres?.slice(0,2).map(g=>g.name).join(', ')||null);
        result.developer = det.developers?.slice(0,2).map(d=>d.name).join(', ')||null;
        // Полное описание: чистим HTML, убираем дубли переносов, лимит выше
        let raw = (det.description_raw || det.description || '').replace(/<[^>]+>/g, '');
        raw = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
        // RAWG часто дублирует текст на разных языках через "Español"/"Deutsch" — берём до первого языкового разделителя
        const cutMarkers = ['\nEspañol', '\nDeutsch', '\nFrançais', '\nPolski', '\nPortuguês', '\nItaliano', '\n日本語', '\nРусский'];
        for (const m of cutMarkers) { const i = raw.indexOf(m); if (i > 200) raw = raw.slice(0, i).trim(); }
        englishDesc = raw.slice(0, 2000) || null;
        result.description = englishDesc;
        const bg = det.background_image || top.background_image;
        if (bg) result.coverRemoteUrl = bg;
      }
      if (top) result.screenshots = await rawgScreenshots(top.slug, rawgKey);
    }
  } else if (!rawgKey) { log.push('⚠ RAWG: ключ не задан'); }

  // 3. SteamGridDB
  if (sgdbKey) {
    let game = steamAppId ? await sgdbBySteam(steamAppId, sgdbKey) : null;
    if (!game && !strict) game = await sgdbSearch(searchName, sgdbKey);
    if (!game && strict) { const g2 = await sgdbSearch(searchName, sgdbKey); if (g2 && normTitle(g2.name) === normTitle(searchName)) game = g2; }
    if (game) {
      log.push(`✓ SGDB: "${game.name}"`);
      const [grids, heroes, logos] = await Promise.all([
        sgdbGrids(game.id,sgdbKey), sgdbHeroes(game.id,sgdbKey), sgdbLogos(game.id,sgdbKey)
      ]);
      result.sgdbGrids=grids; result.sgdbHeroes=heroes; result.sgdbLogos=logos;
      log.push(`✓ ${grids.length} обложек, ${heroes.length} hero, ${logos.length} логотипов`);
    } else { log.push('⚠ SGDB: не найдено'); }
  } else { log.push('⚠ SGDB: ключ не задан'); }

  // 3½. Магазин Steam — описание на русском, как на странице игры
  let steamRu = false;
  try {
    if (!st && !steamAppId) { st = await steamStoreInfo({ name: result.foundName || searchName }); if (st) log.push(`✓ Steam: «${st.name}»`); }
    if (st) {
      if (st.ru) log.push('✓ Описание из Steam на русском');
      // Игра из Steam — её собственные данные главнее найденных по названию
      if (st.description && (strict || st.ru || !result.description)) { result.description = st.description; steamRu = st.ru; englishDesc = st.ru ? null : st.description; }
      if (st.genre && (!result.genre || (strict && !rawgUsed))) result.genre = st.genre;
      if (st.developer && (strict || !result.developer)) result.developer = st.developer;
      if (st.year && (strict || !result.year)) result.year = st.year;
      if (!result.foundName) result.foundName = st.name;
      result.steamAppId = st.appid;
      if (strict) result.fromSteam = true;

    }
  } catch { /* магазин Steam недоступен — останется описание RAWG */ }

  if (steamAppId) {
    const local = (k) => steamLocal?.[k] ? require('url').pathToFileURL(steamLocal[k]).href : null;
    result.steamArt = { cover: local('cover') || sAssets.cover?.[0] || `${STEAM_CDN}/${steamAppId}/library_600x900_2x.jpg`,
      hero: local('hero') || sAssets.hero?.[0] || `${STEAM_CDN}/${steamAppId}/library_hero.jpg`,
      logo: local('logo') || sAssets.logo?.[0] || `${STEAM_CDN}/${steamAppId}/logo.png`, shots: st?.screenshots || [], header: st?.header || sAssets.header || null };
    if (st || sAssets.cover?.length || steamLocal) result.fromSteam = true;
  }

  // 4. Translate description to Russian
  if (steamRu) { /* уже на русском из Steam */ }
  else if (aiOn && englishDesc) {
    log.push(`🌐 ${providerLabel}: перевод описания...`);
    const ru = await ai.translateToRussian(englishDesc, aiSettings);
    if (ru) { result.description = ru; log.push('✓ Описание переведено на русский'); }
    else log.push('⚠ Перевод не удался: ' + (ai.getLastError() || 'неизвестная ошибка'));
  } else if (englishDesc && !aiOn) {
    log.push('ℹ Описание на английском (AI для перевода не настроен)');
  }

  // 5. Скачивание обложки — только если явно попросили (пакетный режим для игр без обложки).
  // В окне ручного выбора обложка скачивается лишь после нажатия «Применить».
  if (downloadCover) {
    const candidates = [
      ...(steamAppId ? steamArtCands('cover', steamAppId, sAssets, steamLocal) : []),
      ...(result.sgdbGrids.length ? [{ url: result.sgdbGrids[0].url, auth: sgdbKey }] : []),
      ...(result.coverRemoteUrl ? [{ url: result.coverRemoteUrl, auth: '' }] : []),
    ];
    for (const c of candidates) {
      const saved = await store(c, gameId);
      if (saved) { result.coverUrl = saved; result.coverSrc = c.src || (/steamgriddb\.com/i.test(c.url) ? 'sgdb' : 'rawg'); log.push('✓ Обложка сохранена' + (c.file ? ' (из Steam на этом ПК)' : '')); break; }
    }
    if (candidates.length && !result.coverUrl) log.push('⚠ Обложку скачать не удалось');
  }

  // 6. Широкий фон для карточки игры: hero из SteamGridDB, иначе картинка/скриншот из RAWG
  if (downloadHero) {
    const cands = [
      ...(steamAppId ? steamArtCands('hero', steamAppId, sAssets, steamLocal) : []),
      ...result.sgdbHeroes.slice(0, 2).map((h) => ({ url: h.url, auth: sgdbKey })),
      ...(st?.screenshots || []).slice(0, 2).map((u) => ({ url: u, auth: '', src: 'steam' })),
      ...(result.coverRemoteUrl ? [{ url: result.coverRemoteUrl, auth: '' }] : []),
      ...(result.screenshots || []).slice(0, 2).map((u) => ({ url: u, auth: '' })),
    ];
    for (const c of cands) {
      const saved = await store(c, gameId + '~hero');
      if (saved) { result.heroUrl = saved; result.heroSrc = c.src || (/steamgriddb\.com/i.test(c.url) ? 'sgdb' : 'rawg'); log.push('✓ Фон сохранён'); break; }
    }
  }

  // 7. Логотип игры с прозрачным фоном (SteamGridDB) — вместо названия текстом
  if (downloadLogo && (steamAppId || result.sgdbLogos.length)) {
    for (const l of [...(steamAppId ? steamArtCands('logo', steamAppId, sAssets, steamLocal) : []), ...result.sgdbLogos.slice(0, 3)]) {
      const saved = await store(l, gameId + '~logo');
      if (saved) { result.logoUrl = saved; result.logoFrom = l.src === 'steam' ? 'steamstatic' : l.url; log.push('✓ Логотип сохранён'); break; }
    }
  }

  result.success = !!(result.description || result.genre || result.coverUrl || result.heroUrl || result.logoUrl ||
    result.coverRemoteUrl || result.sgdbGrids.length);
  return result;
}

module.exports = { setSearchLog, gameExtra, enrichGame, rawgSearch, translateGenre, steamStoreInfo, steamHtmlToText, steamAssetUrls };
