(() => {
const D = 86400000, now = Date.now();
const G = [
 ['hades2','Hades II','Экшен, Рогалик',2025,'Supergiant Games',2890,0,1,0,'indie',25,60,94,142,'Колдунья Мелиноя спускается в подземный мир, чтобы одолеть титана времени Кроноса. Каждый забег — новые дары богов, оружие и маршруты.'],
 ['cp2077','Cyberpunk 2077','РПГ, Экшен',2020,'CD PROJEKT RED',7440,1,1,0,'rpg',330,400,86,96,'Наёмник Ви ищет способ избавиться от чипа с цифровым призраком в открытом мире Найт-Сити.'],
 ['bg3',"Baldur's Gate 3",'РПГ, Стратегия',2023,'Larian Studios',11280,3,1,0,'rpg',280,500,98,118,'Партия героев с личинкой иллитида в голове ищет исцеление, пока над Побережьем Мечей сгущается тьма.'],
 ['stardew','Stardew Valley','Симулятор, РПГ',2016,'ConcernedApe',5100,5,0,0,'indie',130,1000,96,210,'Унаследованная ферма, соседи из городка Пеликан и бесконечный цикл сезонов.'],
 ['eldenring','Elden Ring','РПГ, Экшен',2022,'FromSoftware',9180,9,1,1,'rpg',70,700,96,131,'Погасшие возвращаются в Междуземье.'],
 ['hollow','Hollow Knight','Метроидвания, Платформер',2017,'Team Cherry',2460,12,0,1,'indie',235,900,94,64,'Безымянный рыцарь исследует руины Халлоунеста.'],
 ['deadcells','Dead Cells','Рогалик, Экшен',2018,'Motion Twin',1320,20,0,0,'indie',175,800,90,58,''],
 ['disco','Disco Elysium','РПГ, Детектив',2019,'ZA/UM',1920,30,0,1,'rpg',200,600,92,22,''],
 ['witcher3','The Witcher 3: Wild Hunt','РПГ',2015,'CD PROJEKT RED',8820,45,0,1,'rpg',15,1200,96,140,''],
 ['celeste','Celeste','Платформер',2018,'Maddy Makes Games',540,90,0,0,'indie',320,800,92,19,''],
 ['sekiro','Sekiro: Shadows Die Twice','Экшен',2019,'FromSoftware',3060,150,0,1,'action',5,900,94,70,''],
 ['portal2','Portal 2','Головоломка',2011,'Valve',780,200,0,1,null,55,1500,98,12,''],
 ['rdr2','Red Dead Redemption 2','Экшен, Приключения',2018,'Rockstar Games',0,null,0,0,'backlog',40,3,94,0,''],
 ['outerwilds','Outer Wilds','Приключения, Головоломка',2019,'Mobius Digital',0,null,0,0,'backlog',250,5,94,0,''],
 ['terraria','Terraria — ярлык','Песочница',2011,'Re-Logic',0,null,0,0,null,110,40,92,0,''],
 ['hl2','Half-Life 2','Шутер',2004,'Valve',900,400,0,1,'action',90,2000,96,15,''],
];
const hh = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const games = G.map(([id,name,genre,year,dev,mins,last,fav,done,cat,h,added,rating,runs,desc]) => ({
  id, name, genre, year: String(year), developer: dev, playtime: mins, lastPlayed: last == null ? null : now - last * D - (last === 0 ? 3600e3 : 0),
  launched: last != null, favorite: !!fav, completed: !!done, catId: cat, hue: h, addedAt: now - added * D, rating, runs, description: desc,
  exePath: (['cp2077','bg3','stardew','hades2','eldenring','sekiro','portal2','terraria'].includes(id) ? 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\' : ['rdr2','outerwilds','hollow'].includes(id) ? 'C:\\Program Files\\Epic Games\\' : 'D:\\Games\\') + name + '\\game.exe',
  hero: id === 'hades2' ? 'tests/mock/covers/hero.png' : null, logo: id === 'hades2' ? 'tests/mock/covers/logo.png' : null,
  cover: id === 'stardew' ? 'tests/mock/covers/wide.png' : ['hades2','cp2077','bg3','eldenring','hollow','celeste'].includes(id) ? 'tests/mock/covers/' + id + '.png' : null,
  days: last == null ? null : (() => { const o = {}; for (let i = 0; i < 14; i++) { if (i < last) continue; if ((hh(id) >> i) & 1 || i === last) { const d = new Date(now - i * D); o[d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')] = 20 + (hh(id + i) % 160); } } return o; })(), hidden: id === 'hl2', lnkPath: id === 'celeste' ? 'C:\\Users\\k\\Desktop\\Celeste — ярлык.lnk' : null, isLnk: id === 'celeste', tags: id === 'bg3' ? ['на двоих'] : [],
}));
window.__calls = [];
const log = (...a) => window.__calls.push(a);
// История игры за ~13 месяцев для статистики (детерминированная, чтобы скриншоты не менялись)
(() => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const played = games.filter((g) => g.playtime).slice(0, 9);
  played.forEach((g, gi) => {
    g.days = { ...(g.days || {}) }; g.sess = [];
    for (let i = 400; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      if (rnd() > (weekend ? 0.55 : 0.82) - gi * 0.02) continue;
      const m = Math.round(20 + rnd() * (weekend ? 220 : 120) / (1 + gi * 0.4));
      const k = key(d); if (i < 14 && g.days[k]) continue;
      g.days[k] = (g.days[k] || 0) + m;
      const st = new Date(d); st.setHours(weekend ? 13 + Math.floor(rnd() * 9) : 19 + Math.floor(rnd() * 4), Math.floor(rnd() * 60));
      g.sess.push([st.getTime(), m]);
    }
  });
})();
window.api = {
  gameExtra: async (g) => { await new Promise(r=>setTimeout(r,300)); const c=['tests/mock/covers/hero.png','tests/mock/covers/wide.png','tests/mock/covers/bg3.png','tests/mock/covers/eldenring.png','tests/mock/covers/cp2077.png','tests/mock/covers/hades2.png'];
    return { v:2, from:'steam', hltb: { id: 1, name: g.name, main: 21.5, plus: 39, full: 64 }, t:Date.now(), about: window.__about || null, mc:{score:88}, rev:{pct:96,total:52340,desc:'Очень положительные'}, ru:{ui:true,voice:false}, ctrl:'full', ach:63,
    cats:[{id:2,n:'Для одного игрока'},{id:23,n:'Облако Steam'},{id:41,n:'Remote Play на телевизоре'},{id:22,n:'Достижения Steam'}],
    movies:[{n:'Релизный трейлер',thumb:c[0],src:'https://example.invalid/a.mp4'}], shots:c.slice(1).map(x=>({t:x,f:x})) }; },
  getGames: async () => games, saveGame: async (g) => log('saveGame', g.id), saveGamesBulk: async (l) => log('bulk', l.length),
  deleteGame: async () => {}, deleteGames: async (ids) => log('deleteGames', ids), getLoadNotice: async () => null,
  pickExe: async () => null, resolveShortcut: async () => null, pickImage: async () => null, downloadImage: async () => null, setCoverFromUrl: async (id,u) => { log('setCover', id, u); return null; },
  scanFolder: async () => ({ folder: 'D:\\Games', found: [
    { name: 'Hollow Knight Silksong', exePath: 'D:\\Games\\Silksong\\Hollow Knight Silksong.exe' },
    { name: 'Balatro', exePath: 'D:\\Games\\Balatro\\Balatro.exe' },
    { name: 'DOOMEternal', exePath: 'D:\\Games\\DOOMEternal\\DOOMEternalx64vk.exe' },
    { name: 'Hades II', exePath: 'D:\\Games\\Hades II\\game.exe' },
    { name: 'Satisfactory', exePath: 'D:\\Games\\Satisfactory\\FactoryGame.exe' } ] }),
  scanDesktop: async () => ({ folder: 'Рабочий стол', found: [] }),
  launchAndTrack: async (id) => { log('launch', id); return { launched: true, tracked: true }; }, onPlaytimeResult: () => {},
  showInExplorer: async (p) => log('explorer', p), getSessions: async () => [], storeIcons: async () => ({}), shortcutInfo: async (l) => /gone/.test(l) ? null : { target: 'D:\\Games\\AOB\\aob.exe', args: '-dx11', cwd: 'D:\\Games\\AOB' }, checkGames: async (l) => l.map((g) => !/Disco|Witcher/.test(g.exePath || '')),
  uninstallInfo: async (g) => g.store ? { store: g.store } : { folder: 'D:\\Games\\' + g.name, size: 7340032000, files: 1532, uninstaller: /Dead/.test(g.name) ? { name: g.name + ' (GOG)', cmd: 'unins000.exe' } : null },
  uninstallGame: async (g, m) => { log('uninstall', m); if (m === 'folder') return { ok: false, trashFailed: true, error: 'Failed to perform delete operation', busy: window.__busy || null }; return { ok: true, external: m !== 'folder' && m !== 'folder-perm', permanent: m === 'folder-perm' }; }, steamAccounts: async () => [{ steamid: '76561198000000001', name: 'Lavandar23', recent: true }],
  steamOwned: async (k, id) => k === 'good' ? { ok: true, games: [{ appid: '268910', name: 'Cuphead', minutes: 900, lastPlayed: Date.now() - 86400000 }, { appid: '570', name: 'Dota 2', minutes: 12000, lastPlayed: Date.now() - 5*86400000 }] } : { ok: false, error: 'Неверный ключ Steam Web API' },
  steamResolve: async () => '76561198000000002',
  linkStores: async (l) => Object.fromEntries(l.filter((g) => g.name === 'Celeste' || g.name === 'Captain Hardcore').map((g) => [g.id, { store: 'steam', storeId: '504230', launchUrl: 'steam://rungameid/504230', exePath: 'D:\\SteamLibrary\\steamapps\\common\\X\\x.exe' }])), steamPlaytime: async () => ({ '268910': { minutes: 754, lastPlayed: Date.now() - 3*86400000 } }), testArtKeys: async () => ({ rawg: 'ok', sgdb: 'ok' }), ruDescription: async (g) => (log('ru', g.name, g.steamAppId), { description: 'Русское описание для ' + g.name }), onPadsNative: (cb) => { window.__native = cb; }, padsNative: async () => null, listStoreGames: async () => [
    { store: 'steam', storeId: '268910', name: 'Cuphead', installDir: 'D:\\SteamLibrary\\steamapps\\common\\Cuphead', exePath: 'D:\\SteamLibrary\\steamapps\\common\\Cuphead\\Cuphead.exe', launchUrl: 'steam://rungameid/268910' },
    { store: 'steam', storeId: '892970', name: 'Valheim', installDir: 'D:\\SteamLibrary\\steamapps\\common\\Valheim', exePath: 'D:\\SteamLibrary\\steamapps\\common\\Valheim\\valheim.exe', launchUrl: 'steam://rungameid/892970' },
    { store: 'epic', storeId: 'Fortnite', name: 'Trine 4: The Nightmare Prince', installDir: 'C:\\Program Files\\Epic Games\\Trine4', exePath: 'C:\\Program Files\\Epic Games\\Trine4\\trine4.exe', launchUrl: 'com.epicgames.launcher://apps/x?action=launch' } ], listPrograms: async () => [
    { name: 'Captain Hardcore', exePath: 'F:\\Games\\Captain.Hardcore\\game\\Captain Hardcore.exe', lnkPath: 'C:\\Users\\k\\Desktop\\Captain Hardcore.lnk', isLnk: true, iconPath: 'x' },
    { name: 'Cuphead', exePath: 'C:\\Users\\k\\Start Menu\\Programs\\Steam\\Cuphead.url', lnkPath: null, store: 'steam', iconPath: 'y' },
    { name: 'Hard Disk Sentinel', exePath: 'C:\\Program Files (x86)\\Hard Disk Sentinel\\HDSentinel.exe', lnkPath: 'x.lnk', isLnk: true, iconPath: 'z' },
    { name: 'Hades II', exePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hades II\\game.exe', lnkPath: null, iconPath: 'h' },
    { name: 'PunchABunch', exePath: 'D:\\Games\\PunchABunch\\PunchABunch.exe', lnkPath: 'p.lnk', isLnk: true, iconPath: 'p' } ],
  fileIcons: async (l) => Object.fromEntries(l.slice(0,2).map((x) => [x.key, 'tests/mock/covers/hades2.png'])), padInfo: async () => window.__win || [], checkPaths: async (l) => l.map(() => true), onSession: (cb) => { window.__session = cb; },
  exportLibrary: async () => ({ ok: true, count: 16 }), importLibrary: async () => ({ ok: false }),
  enrichGame: async (id, name, o) => { log('enrich', id, name, JSON.stringify(o)); return { success: true, foundName: name, genre: 'РПГ', year: '2023', developer: 'Dev', description: 'Описание', coverRemoteUrl: '', sgdbGrids: [], log: ['✓ RAWG: "' + name + '"'] }; },
  rawgSearch: async () => [{ slug: 'a', name: 'First' }, { slug: 'b', name: 'Second' }],
  getSettings: async () => ({ cats: [
    { id: 'rpg', name: 'RPG', color: 'oklch(0.72 0.09 290)' }, { id: 'indie', name: 'Инди', color: 'oklch(0.72 0.09 160)' },
    { id: 'action', name: 'Экшен', color: 'oklch(0.72 0.09 30)' }, { id: 'backlog', name: 'Пройти в 2026', color: 'oklch(0.72 0.09 230)' } ],
    rawgKey: 'k', autostartSupported: true, autostart: false, closeToTray: false, theme: window.__theme || 'dark', sound: true }),
  saveSettings: async (s) => log('saveSettings', s), testAi: async () => ({ ok: true }),
  checkForUpdates: async () => ({ status: 'dev-mode' }), downloadUpdate: async () => true, installUpdate: async () => {},
  getAppVersion: async () => '1.2.0', getUpdateInfo: async () => ({ version: '1.2.0', packaged: true, feed: { configured: true, url: 'https://github.com/vasya/game-library/releases' }, state: window.__upd || { status: 'idle' } }), updateFromFile: async () => ({ ok: false }), onUpdateStatus: () => {}, onOpenFullscreen: () => {},
  setFullscreen: async (on) => { window.__fs = on; return on; }, onFullscreenChanged: (cb) => { window.__fsCb = cb; },
  minimize: () => {}, maximize: () => {}, close: () => {}, toTray: () => { window.__tray = (window.__tray || 0) + 1; }, quit: () => { window.__quit = (window.__quit || 0) + 1; },
};
})();

