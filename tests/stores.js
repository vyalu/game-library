// Проверка разбора игр GOG / Ubisoft / EA / Battle.net из реестра — на образце ответа PowerShell, без Windows
const fs = require('fs'), path = require('path').win32, assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'main.js'), 'utf8');
const body = src.slice(src.indexOf('function parseOtherStores'), src.indexOf('let otherCache'));
const parseOtherStores = new Function('path', 'fs', 'mainExeIn', body + '\nreturn parseOtherStores;')(path, fs, () => null);
const disk = new Set(['C:\\GOG Games\\Witcher 3', 'C:\\GOG Games\\Witcher 3\\bin\\x64\\witcher3.exe', 'D:\\Ubisoft\\Far Cry 6', 'C:\\Program Files\\EA Games\\Battlefield 2042',
  'C:\\Program Files\\EA Games\\Battlefield 2042\\BF2042.exe', 'C:\\Program Files (x86)\\Overwatch', 'C:\\Program Files (x86)\\Overwatch\\Overwatch Launcher.exe', 'C:\\GOG Games\\DLC']);
const exists = (p) => disk.has(p);
const findExe = (dir) => (dir === 'D:\\Ubisoft\\Far Cry 6' ? 'D:\\Ubisoft\\Far Cry 6\\bin\\FarCry6.exe' : null);
const sample = {
  gog: [{ gameID: '1207664663', gameName: 'The Witcher 3: Wild Hunt', path: 'C:\\GOG Games\\Witcher 3', exe: 'C:\\GOG Games\\Witcher 3\\bin\\x64\\witcher3.exe', workingDir: 'C:\\GOG Games\\Witcher 3\\bin\\x64', launchParam: '', dependsOn: '' },
    { gameID: '1', gameName: 'Witcher 3 DLC', path: 'C:\\GOG Games\\DLC', exe: '', dependsOn: '1207664663' },
    { gameID: '2', gameName: 'Удалённая игра', path: 'C:\\GOG Games\\Gone', exe: 'C:\\GOG Games\\Gone\\x.exe', dependsOn: '' }],
  ubi: { PSChildName: '5266', InstallDir: 'D:/Ubisoft/Far Cry 6/' },
  un: [{ PSChildName: 'Uplay Install 5266', DisplayName: 'Far Cry® 6', InstallLocation: 'D:\\Ubisoft\\Far Cry 6', UninstallString: '"C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\upc.exe" uplay://uninstall/5266' },
    { PSChildName: '{BF2042}', DisplayName: 'Battlefield™ 2042', InstallLocation: 'C:\\Program Files\\EA Games\\Battlefield 2042', UninstallString: '"C:\\Program Files\\Common Files\\EAInstaller\\Battlefield 2042\\Cleanup.exe" uninstall_game', DisplayIcon: 'C:\\Program Files\\EA Games\\Battlefield 2042\\BF2042.exe,0', Publisher: 'Electronic Arts' },
    { PSChildName: 'EA app', DisplayName: 'EA app', InstallLocation: 'C:\\Program Files\\Electronic Arts\\EA Desktop', UninstallString: 'x', Publisher: 'Electronic Arts' },
    { PSChildName: 'Overwatch', DisplayName: 'Overwatch', InstallLocation: 'C:\\Program Files (x86)\\Overwatch', UninstallString: '"C:\\ProgramData\\Battle.net\\Agent\\Blizzard Uninstaller.exe" --lang=ruRU --uid=prometheus --displayname="Overwatch"', DisplayIcon: '"C:\\Program Files (x86)\\Overwatch\\Overwatch Launcher.exe"' },
    { PSChildName: 'Battle.net', DisplayName: 'Battle.net', InstallLocation: 'C:\\Program Files (x86)\\Battle.net', UninstallString: '"C:\\Program Files (x86)\\Battle.net\\Battle.net Uninstaller.exe"' },
    { PSChildName: '7-Zip', DisplayName: '7-Zip', InstallLocation: 'C:\\Program Files\\7-Zip', UninstallString: 'x', Publisher: 'Igor Pavlov' }],
};
const r = parseOtherStores(sample, exists, findExe);
const by = (st) => r.filter((x) => x.store === st);
assert.deepStrictEqual(r.map((x) => x.store).sort(), ['battlenet', 'ea', 'gog', 'ubisoft'], 'набор найденных: ' + JSON.stringify(r.map((x) => x.name)));
assert.strictEqual(by('gog')[0].exePath, 'C:\\GOG Games\\Witcher 3\\bin\\x64\\witcher3.exe');
assert.strictEqual(by('gog')[0].workDir, 'C:\\GOG Games\\Witcher 3\\bin\\x64');
assert.strictEqual(by('ubisoft')[0].name, 'Far Cry 6');
assert.strictEqual(by('ubisoft')[0].launchUrl, 'uplay://launch/5266/0');
assert.strictEqual(by('ubisoft')[0].exePath, 'D:\\Ubisoft\\Far Cry 6\\bin\\FarCry6.exe');
assert.strictEqual(by('ea')[0].name, 'Battlefield 2042');
assert.strictEqual(by('ea')[0].exePath, 'C:\\Program Files\\EA Games\\Battlefield 2042\\BF2042.exe');
assert.strictEqual(by('battlenet')[0].exePath, 'C:\\Program Files (x86)\\Overwatch\\Overwatch Launcher.exe');
assert.deepStrictEqual(parseOtherStores({}, exists, findExe), []);
assert.deepStrictEqual(parseOtherStores(null, exists, findExe), []);
console.log('Разбор GOG / Ubisoft / EA / Battle.net: ' + r.map((x) => `${x.store}: ${x.name}`).join(', '));
