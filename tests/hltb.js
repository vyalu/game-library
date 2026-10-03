// Проверка клиента HowLongToBeat без сети: поиск адреса в скриптах сайта, токен, поиск, выбор игры, переход на другой адрес
const assert = require('assert');
const h = require('../hltb.js');
// 1) Адреса из скриптов сайта
assert.deepStrictEqual(h.endpointsFromJs('a=fetch("/api/search/site/init?t=1");b=fetch("/api/search/site",{method:"POST"});c="/api/user/1"').sort(), ['/api/search/site']);
assert.deepStrictEqual(h.endpointsFromJs('fetch("/api/".concat("seek","/").concat(k))'), ['/api/seek']);
// 2) Выбор игры
const data = [{ game_id: 1, game_name: 'Elden Ring Nightreign', comp_main: 72000 }, { game_id: 2, game_name: 'ELDEN RING', release_world: 2022, comp_main: 216000, comp_plus: 360000, comp_100: 482400, comp_all_count: 900 }];
assert.strictEqual(h.pick(data, 'Elden Ring', '2022').game_id, 2);
assert.strictEqual(h.pick(data, 'Elden', ''), null);
// 3) Весь путь на подменённой сети: старый адрес отвечает 404, новый — работает
const calls = [];
h._test.setFetch(async (url, o = {}) => {
  calls.push((o.method || 'GET') + ' ' + url.replace('https://howlongtobeat.com', ''));
  if (url === 'https://howlongtobeat.com/') return { status: 200, text: '<script src="/_next/static/chunks/pages/_app-abc.js"></script>' };
  if (url.endsWith('_app-abc.js')) return { status: 200, text: 'x=fetch("/api/finder/init?t="+Date.now());y=fetch("/api/finder",{method:"POST"})' };
  if (url.includes('/api/finder/init')) return { status: 200, text: JSON.stringify({ token: 'T1', hpKey: 'hk', hpVal: 'hv' }) };
  if (url.endsWith('/api/finder') && o.method === 'POST') {
    assert.strictEqual(o.headers['x-auth-token'], 'T1'); assert.strictEqual(o.headers['x-hp-key'], 'hk');
    const b = JSON.parse(o.body); assert.deepStrictEqual(b.searchTerms, ['Conan', 'Exiles', 'Enhanced'].slice(0, b.searchTerms.length)); assert.strictEqual(b.hk, 'hv');
    const term = b.searchTerms.join(' ');
    return { status: 200, text: JSON.stringify({ data: term === 'Conan Exiles' ? [{ game_id: 9, game_name: 'Conan Exiles', comp_main: 160000, comp_plus: 400000, comp_100: 900000 }] : [] }) };
  }
  return { status: 404, text: '' };
});
(async () => {
  const r = await h.hltbLookup('Conan Exiles Enhanced', '2018');
  assert.ok(r, 'не нашлось: ' + calls.join(' | '));
  assert.deepStrictEqual([r.main, r.plus, r.full], [44.5, 111, 250]);
  assert.ok(calls.some((c) => c.startsWith('GET /api/finder/init')), 'адрес не найден в скриптах');
  const n = calls.length;
  const r2 = await h.hltbLookup('Conan Exiles', '');
  assert.ok(r2 && calls.slice(n).every((c) => !c.includes('_app-')), 'адрес и токен не запомнились');
  console.log('HowLongToBeat: адрес найден в скриптах сайта, «Conan Exiles Enhanced» → сюжет ' + r.main + ' ч, с допами ' + r.plus + ' ч, 100% ' + r.full + ' ч');
})().catch((e) => { console.error(e); process.exit(1); });
