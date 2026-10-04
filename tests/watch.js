// Проверка слежения за запущенными играми без Windows: подменяем ответы реестра (Steam) и списка процессов
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const body = src.slice(src.indexOf('const GENERIC_EXE'), src.indexOf('// Время записывается прямо в main'));
let reg = '0x0', procs = [], saved = 0;
const games = [{ id: 'ori', store: 'steam', storeId: '1057090', exePath: 'D:\\S\\ori.exe' }, { id: 'witcher', store: 'gog', exePath: 'C:\\GOG\\witcher3.exe' }, { id: 'generic', exePath: 'D:\\X\\game.exe' }];
const sent = [], added = [];
const env = {
  process: { platform: 'win32' }, execFile: (cmd, args, o, cb) => {
    const out = cmd === 'reg' ? `\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    ${reg}\r\n` : procs.map((p) => `"${p}","123","Console","1","10 000 K"`).join('\r\n');
    cb(null, Buffer.from(out));
  },
  loadGames: () => games, saveGames: () => { saved++; }, sessions: new Map(), path: require('path').win32,
  trackedExeName: (exe) => (exe ? require('path').win32.basename(exe) : null),
  addPlaytime: (id, m, start) => { added.push([id, m, !!start]); return { playtime: 100 + m }; },
  sendToWindow: (ch, d) => sent.push([ch, d]),
};
const names = Object.keys(env);
const api = new Function(...names, body + '\nreturn { watchTick, watch, gameIndex };')(...names.map((n) => env[n]));
(async () => {
  await api.watchTick();
  assert.strictEqual(env.sessions.size, 0, 'ничего не запущено — сессий нет');
  reg = '0x' + (1057090).toString(16);                       // запустили Ori через Steam (не через программу)
  await api.watchTick();
  assert.ok(env.sessions.get('ori')?.watch === 'steam', 'игра Steam не замечена');
  assert.ok(sent.some(([c, d]) => c === 'session' && d.id === 'ori' && d.start), 'окно не узнало о запуске');
  env.sessions.get('ori').start -= 95 * 60000;                  // прошло 95 минут
  reg = '0x0';
  await api.watchTick(); assert.ok(env.sessions.has('ori'), 'один промах — ещё не выход');
  await api.watchTick(); assert.ok(!env.sessions.has('ori'), 'после двух промахов сессия должна закончиться');
  assert.deepStrictEqual(added[0], ['ori', 95, true], 'время записано неверно: ' + JSON.stringify(added));
  // Игра GOG по процессу; game.exe — слишком общее имя, не берём
  procs = ['explorer.exe', 'witcher3.exe', 'game.exe']; api.watch.n = 0;
  await api.watchTick();
  assert.ok(env.sessions.get('witcher')?.watch === 'exe', 'игра по процессу не замечена');
  assert.ok(!env.sessions.has('generic'), 'общее имя game.exe не должно засчитываться');
  env.sessions.get('witcher').start -= 30 * 60000; procs = ['explorer.exe'];
  api.watch.burstUntil = Date.now() + 1e5;
  await api.watchTick(); await api.watchTick();
  assert.ok(!env.sessions.has('witcher') && added.some(([id, m]) => id === 'witcher' && m === 30), 'выход из игры по процессу не записан');
  // Запуск из программы, а игра так и не появилась
  api.watch.pending.set('ori', Date.now() - 200000);
  await api.watchTick();
  assert.ok(sent.some(([c, d]) => c === 'playtime-result' && d.id === 'ori' && d.tracked === false), 'не снято «запускается»');
  console.log('Слежение за играми: Steam (RunningAppID) и процессы — запуск, выход, запись времени работают');
})().catch((e) => { console.error(e.message); process.exit(1); });
