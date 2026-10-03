// «Сколько проходить» — HowLongToBeat. Официального API нет: адрес поиска сайт время от времени меняет
// (/api/search, /api/seek, /api/bleed, /api/search/site…), поэтому сначала ищем его в скриптах самого сайта,
// а если не вышло — пробуем известные. Любая ошибка — просто нет данных, программа работает дальше.
let { fetchRaw } = require('./download');
const BASE = 'https://howlongtobeat.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const KNOWN = ['/api/search/site', '/api/bleed', '/api/seek', '/api/search', '/api/find', '/api/lookup', '/api/locate', '/api/s'];
const H = { 'User-Agent': UA, Referer: BASE + '/', Origin: BASE, Accept: 'application/json, text/plain, */*' };
const state = { ep: null, token: null, hp: null, tokT: 0, eps: null, epsT: 0, fails: 0, offUntil: 0 };

const norm = (x) => String(x || '').toLowerCase().replace(/[™®©]/g, '').replace(/&/g, 'and').replace(/[^a-zа-яё0-9]+/gi, '');
// Адреса API из скриптов сайта: fetch("/api/xxx/yyy") или "/api/".concat("xxx")
function endpointsFromJs(js) {
  const out = new Set();
  for (const m of js.matchAll(/["'`](\/api\/[a-z0-9_\-/]{1,40}?)(?:\/init)?["'`]/gi)) if (!/\/(user|auth|log|game\/|stats|forum)/i.test(m[1])) out.add(m[1].replace(/\/$/, ''));
  for (const m of js.matchAll(/["'`]\/api\/["'`]\s*\.concat\(\s*["'`]([a-z0-9_-]{1,30})["'`]/gi)) out.add('/api/' + m[1]);
  return [...out];
}
async function discover() {
  if (state.eps && Date.now() - state.epsT < 6 * 3600e3) return state.eps;
  const found = [];
  try {
    const home = await fetchRaw(BASE + '/', { headers: { ...H, Accept: 'text/html' }, timeout: 10000 });
    const srcs = [...home.text.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]).filter((s) => /pages\/_app|chunks\/(pages|\d)/.test(s)).slice(0, 12);
    for (const s of srcs) {
      const js = await fetchRaw(BASE + s, { headers: H, timeout: 10000 });
      for (const ep of endpointsFromJs(js.text)) if (!found.includes(ep)) found.push(ep);
    }
  } catch {}
  state.eps = [...found.filter((x) => /search|seek|find|bleed|lookup|locate|\/s$/i.test(x)), ...KNOWN].filter((x, i, a) => a.indexOf(x) === i).slice(0, 10);
  state.epsT = Date.now();
  return state.eps;
}
async function initToken(ep) {
  const r = await fetchRaw(`${BASE}${ep}/init?t=${Date.now()}`, { headers: H, timeout: 8000 });
  if (r.status !== 200) return null;
  try { const j = JSON.parse(r.text); return j?.token ? { token: j.token, hp: j.hpKey ? [j.hpKey, j.hpVal] : null } : null; } catch { return null; }
}
function body(terms, hp) {
  const b = { searchType: 'games', searchTerms: terms, searchPage: 1, size: 20,
    searchOptions: { games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: null, max: null },
      gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: '', max: '' }, modifier: '' },
    users: { sortCategory: 'postcount' }, lists: { sortCategory: 'follows' }, filter: '', sort: 0, randomizer: 0 }, useCache: true };
  if (hp) b[hp[0]] = hp[1];
  return JSON.stringify(b);
}
async function searchRaw(name) {
  const terms = String(name).replace(/[™®©:]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
  const tryEp = async (ep) => {
    if (!state.token || state.ep !== ep || Date.now() - state.tokT > 10 * 60e3) {
      const t = await initToken(ep); if (!t) return null;
      Object.assign(state, { ep, token: t.token, hp: t.hp, tokT: Date.now() });
    }
    const hdr = { ...H, 'Content-Type': 'application/json', 'x-auth-token': state.token };
    if (state.hp) { hdr['x-hp-key'] = state.hp[0]; hdr['x-hp-val'] = state.hp[1]; }
    const r = await fetchRaw(BASE + ep, { method: 'POST', headers: hdr, body: body(terms, state.hp), timeout: 10000 });
    if (r.status !== 200) { state.token = null; return null; }
    try { const j = JSON.parse(r.text); return Array.isArray(j?.data) ? j.data : null; } catch { return null; }
  };
  if (state.ep) { const d = await tryEp(state.ep); if (d) return d; }
  for (const ep of await discover()) { if (ep === state.ep) continue; const d = await tryEp(ep); if (d) return d; }
  return null;
}
// Лучшее совпадение: точное название (без знаков), при нескольких — по году выхода
function pick(list, name, year) {
  const want = norm(name), y = String(year || '');
  const ok = (list || []).filter((x) => norm(x.game_name) === want || norm(x.game_alias) === want);
  if (!ok.length) return null;
  return ok.find((x) => y && String(x.release_world || '') === y) || ok.sort((a, b) => (b.comp_all_count || 0) - (a.comp_all_count || 0))[0];
}
const hrs = (sec) => (sec > 0 ? Math.round(sec / 1800) / 2 : 0);   // секунды → часы, с точностью до получаса
async function hltbLookup(name, year) {
  if (!name || Date.now() < state.offUntil) return null;
  const list = await searchRaw(name).catch(() => null);
  if (!list) { if (++state.fails >= 3) { state.offUntil = Date.now() + 30 * 60e3; state.fails = 0; } return null; }   // сайт сломал API — не долбим его
  state.fails = 0;
  let g = pick(list, name, year);
  // «Conan Exiles Enhanced», «… Game of the Year Edition» — пробуем без приписки
  if (!g) { const base = String(name).replace(/\s*[:\-–—]\s*(game of the year|goty|definitive|enhanced|complete|remastered|deluxe|ultimate|anniversary).*$|\s+(enhanced|definitive|complete|goty|remastered)( edition)?$/i, '').trim();
    if (base && base !== name) { const l2 = await searchRaw(base).catch(() => null); g = pick(l2, base, year); } }
  if (!g) return null;
  const out = { id: g.game_id, name: g.game_name, main: hrs(g.comp_main), plus: hrs(g.comp_plus), full: hrs(g.comp_100) };
  return out.main || out.plus || out.full ? out : null;
}
module.exports = { hltbLookup, endpointsFromJs, pick, _test: { setFetch: (f) => { fetchRaw = f; }, state } };
