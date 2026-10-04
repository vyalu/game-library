// Проверка меню трея: недавние игры сверху, запущенная — первой и неактивной, скрытые не попадают
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const body = src.slice(src.indexOf('const trayIcons'), src.indexOf('function createTray'));
const games = [{ id: 'a', name: 'Old', lastPlayed: 1 }, { id: 'b', name: 'Fresh & Co', lastPlayed: 50, cover: '/nope.png' }, { id: 'c', name: 'Running', lastPlayed: 10 },
  { id: 'h', name: 'Hidden', lastPlayed: 99, hidden: true }, { id: 'n', name: 'Never' }];
const sent = [];
const env = { Menu: { buildFromTemplate: (t) => t }, loadGames: () => games, sessions: new Map([['c', { stopped: false }]]), nativeImage: {}, fs, require,
  mainWindow: { isDestroyed: () => false }, createWindow: () => {}, sendToWindow: (ch, d) => sent.push([ch, d]), showWindow: () => {}, isQuitting: false, app: { quit() {} } };
const names = Object.keys(env);
const { trayMenu } = new Function(...names, body + '\nreturn { trayMenu };')(...names.map((n) => env[n]));
const m = trayMenu();
const games_ = m.filter((x) => x.click && !/библиотек|режим|Выход/.test(x.label));
assert.deepStrictEqual(games_.map((x) => x.label), ['▶  Running  — запущена', 'Fresh && Co', 'Old'], JSON.stringify(games_.map((x) => x.label)));
assert.strictEqual(games_[0].enabled, false, 'запущенную игру нельзя запустить второй раз');
games_[1].click(); assert.deepStrictEqual(sent[0], ['tray-launch', 'b'], 'клик не отправил запуск');
assert.ok(m.some((x) => x.label === 'ТВ-режим') && m.some((x) => x.label === 'Выход'));
console.log('Меню трея: недавние игры, запущенная первой, скрытые не попадают, запуск по клику');
