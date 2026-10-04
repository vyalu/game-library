// Поиск игр Epic/GOG в Steam по названию: ограничение запросов Steam (429) не должно превращаться в «игры нет в Steam»
process.env.GL_FAST = '1';
const assert = require('assert');
const dl = require('../download');
let mode = 'busy-then-ok', calls = [];
dl.fetchJson = async (url) => {
  calls.push(url.replace('https://store.steampowered.com', ''));
  if (url.includes('storesearch')) {
    if (mode === 'down') return { status: 429, body: null };
    if (mode === 'busy-then-ok' && calls.filter((c) => c.includes('storesearch')).length <= 2) return { status: 429, body: null };
    const term = decodeURIComponent(url.match(/term=([^&]+)/)[1]);
    return { status: 200, body: { items: term === 'Trine 4: The Nightmare Prince' ? [{ id: 690640, name: 'Trine 4: The Nightmare Prince', type: 'app' }, { id: 1224800, name: 'Trine 4: The Nightmare Prince Soundtrack', type: 'app' }] : [] } };
  }
  if (url.includes('steamcommunity.com/actions/SearchApps/')) {
    if (mode === 'down') return { status: 429, body: null };
    const term = decodeURIComponent(url.split('/SearchApps/')[1]);
    return { status: 200, body: term === 'The Escapists' ? [{ appid: '298630', name: 'The Escapists' }] : [] };
  }
  if (url.includes('appdetails?appids=298630')) return { status: 200, body: { 298630: { success: true, data: { name: 'The Escapists', about_the_game: '<p>Побег из тюрьмы — ваша единственная цель.</p>', categories: [], screenshots: [], movies: [], release_date: { date: '13 фев. 2015' } } } } };
  if (url.includes('appdetails')) return { status: 200, body: { 690640: { success: true, data: { name: 'Trine 4: The Nightmare Prince', about_the_game: '<p>Серия Trine возвращается к волшебству 2.5D.</p>', categories: [], screenshots: [], movies: [], release_date: { date: '8 окт. 2019' } } } } };
  if (url.includes('appreviews')) return { status: 200, body: { query_summary: { total_reviews: 100, total_positive: 93, review_score_desc: 'Very Positive' } } };
  return { status: 404, body: null };
};
require.cache[require.resolve('../hltb')] = { exports: { hltbLookup: async () => null } };
const { gameExtra } = require('../enricher');
(async () => {
  const r = await gameExtra({ name: 'Trine 4: The Nightmare Prince™' });
  assert.strictEqual(r.from, 'steam', 'после двух отказов Steam игра должна найтись: ' + JSON.stringify(r).slice(0, 200));
  assert.strictEqual(r.appid, '690640'); assert.ok(/волшебству/.test(r.about), 'нет русского описания');
  assert.strictEqual(r.rev.desc, 'Очень положительные');
  mode = 'down'; calls = [];
  const r2 = await gameExtra({ name: 'The Escapists', rawgKey: 'k' });
  assert.strictEqual(r2.error, 'steam-busy', 'Steam не ответил — нельзя подставлять данные RAWG: ' + JSON.stringify(r2).slice(0, 200));
  mode = 'ok'; calls = [];
  const r4 = await gameExtra({ name: 'The Escapists' });   // магазин с регионом RU игру не показывает — находит поиск сообщества
  assert.strictEqual(r4.appid, '298630', 'игра, скрытая в регионе RU, должна найтись: ' + JSON.stringify(r4).slice(0, 200));
  assert.ok(/Побег/.test(r4.about));
  calls = [];
  const r3 = await gameExtra({ name: 'Совсем Своя Игра' });
  assert.strictEqual(r3.from, null, 'игры нет в Steam — так и запоминаем');
  console.log('Поиск в Steam по названию: отказы Steam пережидаются, «не ответил» ≠ «нет в Steam», скрытые в регионе игры находятся');
})().catch((e) => { console.error(e.message); process.exit(1); });
