const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');
const dl = require('./download');

// ─── Один экземпляр программы ────────────────────────────────────────────────
// Если лаунчер уже запущен (например, свёрнут в трей после автозапуска),
// повторный запуск просто показывает существующее окно.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const startHidden = process.argv.includes('--hidden');
let mainWindow = null;
let tray = null;
let isQuitting = false;

const userData = app.getPath('userData');
const dataFile = path.join(userData, 'games.json');
const settingsFile = path.join(userData, 'settings.json');
const coversDir = path.join(userData, 'covers');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

// ─── Надёжное хранение данных ────────────────────────────────────────────────
// Запись идёт во временный файл и только потом заменяет основной, а прошлая
// версия сохраняется как .bak. Если основной файл повреждён — читаем .bak,
// а испорченный файл откладываем в сторону, чтобы ничего не затереть.
let loadNotice = null;

function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  if (fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); } catch {} }
  // Антивирус, индексатор или OneDrive могут на миг держать файл — пробуем ещё несколько раз
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (err) {
      if (i >= 7 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        try { fs.copyFileSync(tmp, file); fs.unlinkSync(tmp); return; } catch { throw err; }
      }
      const until = Date.now() + 60 * (i + 1); while (Date.now() < until) { /* короткая пауза */ }
    }
  }
}

function readJsonSafe(file, fallback) {
  if (!fs.existsSync(file)) {
    // Основного файла нет, но есть .bak (например, сбой посреди записи)
    if (fs.existsSync(file + '.bak')) {
      try { return JSON.parse(fs.readFileSync(file + '.bak', 'utf8')); } catch {}
    }
    return fallback;
  }
  let text;
  for (let i = 0; ; i++) {   // файл может быть на миг занят — это не повреждение
    try { text = fs.readFileSync(file, 'utf8'); break; }
    catch (err) { if (i >= 5) throw err; const until = Date.now() + 100; while (Date.now() < until) { /* пауза */ } }
  }
  try {
    return JSON.parse(text);
  } catch {
    const aside = file.replace(/\.json$/, '') + `.corrupt-${Date.now()}.json`;
    try { fs.copyFileSync(file, aside); } catch {}
    try {
      const data = JSON.parse(fs.readFileSync(file + '.bak', 'utf8'));
      loadNotice = `Файл ${path.basename(file)} был повреждён — данные восстановлены из резервной копии.`;
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      return data;
    } catch {
      loadNotice = `Файл ${path.basename(file)} повреждён, резервной копии нет. Испорченный файл сохранён как ${path.basename(aside)}.`;
      try { fs.unlinkSync(file); } catch {}
      return fallback;
    }
  }
}

function loadGames() { const g = readJsonSafe(dataFile, []); return Array.isArray(g) ? g : []; }
function saveGames(games) { writeJsonAtomic(dataFile, games); }
function loadSettings() { const s = readJsonSafe(settingsFile, {}); return s && typeof s === 'object' ? s : {}; }
function saveSettingsFile(s) { writeJsonAtomic(settingsFile, s); }

// ─── Ярлыки .lnk ──────────────────────────────────────────────────────────────
function resolveLnkWindows(lnkPath) {
  try {
    const script = `var sh=new ActiveXObject("WScript.Shell");WScript.Echo(sh.CreateShortcut(WScript.Arguments(0)).TargetPath);`;
    const tmpScript = path.join(app.getPath('temp'), `_resolve_lnk_${process.pid}.js`);
    fs.writeFileSync(tmpScript, script);
    const out = execSync(`cscript //nologo "${tmpScript}" "${lnkPath.replace(/"/g, '')}"`, { timeout: 5000, windowsHide: true }).toString().trim();
    try { fs.unlinkSync(tmpScript); } catch {}
    return out || null;
  } catch { return null; }
}

function parseLnkRaw(lnkPath) {
  try {
    const buf = fs.readFileSync(lnkPath);
    if (buf.length < 80 || buf[0] !== 0x4C || buf[1] !== 0 || buf[2] !== 0 || buf[3] !== 0) return null;
    const flags = buf.readUInt32LE(20);
    let offset = 76;
    if (flags & 0x01) offset += 2 + buf.readUInt16LE(offset);
    if (!(flags & 0x02) || offset + 20 > buf.length) return null;
    const localBasePathOffset = buf.readUInt32LE(offset + 16);
    if (localBasePathOffset > 0 && offset + localBasePathOffset < buf.length) {
      let end = offset + localBasePathOffset;
      while (end < buf.length && buf[end] !== 0) end++;
      const raw = buf.slice(offset + localBasePathOffset, end);
      try { return new TextDecoder('windows-1251').decode(raw); } catch { return raw.toString('latin1'); }
    }
    return null;
  } catch { return null; }
}

function resolveShortcut(lnkPath) {
  if (process.platform === 'win32') {
    try { const t = shell.readShortcutLink(lnkPath).target; if (t) return t; } catch { /* не ярлык или нет доступа */ }
    const t = resolveLnkWindows(lnkPath);
    if (t) return t;
  }
  return parseLnkRaw(lnkPath);
}

// ─── Окно и трей ──────────────────────────────────────────────────────────────
const iconPath = path.join(__dirname, 'assets', 'icon.ico');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    frame: false, backgroundColor: '#161826', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required', // звуки интерфейса без предварительного клика
    },
    icon: iconPath,
  });
  // WebHID: геймпады PlayStation отдают через HID заряд батареи — разрешаем окну их читать
  const ses = mainWindow.webContents.session;
  ses.setPermissionCheckHandler(() => true);   // как по умолчанию в Electron (страница локальная)
  ses.setDevicePermissionHandler((d) => d.deviceType === 'hid');
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const pad = details.deviceList.find((d) => (d.collections || []).some((c) => c.usagePage === 1 && (c.usage === 4 || c.usage === 5)));
    callback(pad ? pad.deviceId : '');
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => { if (!startHidden) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); } });
  // Геймпад работает, только когда фокус у самой страницы, а не только у окна — отдаём его странице при каждой активации
  mainWindow.on('focus', () => { try { mainWindow.webContents.focus(); } catch {} });
  mainWindow.on('show', () => { try { mainWindow.webContents.focus(); } catch {} });

  // Кнопка ✕: сворачивать в трей, если включено в настройках
  mainWindow.on('close', (e) => {
    if (!isQuitting && shouldCloseToTray()) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.once('did-finish-load', () => { startPadWatch(); startGameWatch(); });
  mainWindow.on('enter-full-screen', () => sendToWindow('fullscreen-changed', true));
  mainWindow.on('leave-full-screen', () => sendToWindow('fullscreen-changed', false));

  // Внешние ссылки открываем в браузере, а не внутри лаунчера
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (dl.isHttpUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Уходить со страницы программы нельзя (например, если на окно перетащили файл)
  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    if (dl.isHttpUrl(url)) shell.openExternal(url);
  });
}

function shouldCloseToTray() {
  const s = loadSettings();
  // По умолчанию сворачиваем в трей, если включён автозапуск
  return s.closeToTray ?? !!s.autostart;
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();
}

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Недавние игры в меню трея: запуск без открытия окна (через окно программы — так же считается время)
const trayIcons = new Map();
function trayIcon(cover) {
  if (!cover) return undefined;
  if (trayIcons.has(cover)) return trayIcons.get(cover);
  let img;
  try {
    const p = /^file:/i.test(cover) ? require('url').fileURLToPath(cover) : cover;
    if (!/^https?:/i.test(p) && fs.existsSync(p)) {
      img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) { const { width: w, height: h } = img.getSize(), side = Math.min(w, h);
        img = img.crop({ x: Math.round((w - side) / 2), y: Math.round((h - side) / 4), width: side, height: side }).resize({ width: 16, height: 16, quality: 'best' }); }
      else img = undefined;
    }
  } catch { img = undefined; }
  if (trayIcons.size > 60) trayIcons.clear();
  trayIcons.set(cover, img);
  return img;
}
function trayLaunch(id) {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); mainWindow.webContents.once('did-finish-load', () => setTimeout(() => sendToWindow('tray-launch', id), 1500)); return; }
  sendToWindow('tray-launch', id);
}
function trayMenu() {
  let list = [];
  try { list = loadGames().filter((g) => !g.hidden && (g.lastPlayed || sessions.has(g.id))).sort((a, b) => (sessions.has(b.id) - sessions.has(a.id)) || (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 8); } catch {}
  const items = list.length ? [{ label: 'Недавние игры', enabled: false }, ...list.map((g) => {
    const run = sessions.has(g.id) && !sessions.get(g.id).stopped;
    return { label: (run ? '▶  ' : '') + String(g.name).replace(/&/g, '&&').slice(0, 60) + (run ? '  — запущена' : ''), icon: trayIcon(g.cover), enabled: !run, click: () => trayLaunch(g.id) };
  }), { type: 'separator' }] : [];
  return Menu.buildFromTemplate([
    ...items,
    { label: 'Открыть библиотеку', click: showWindow },
    { label: 'Компактный режим', click: () => { showWindow(); sendToWindow('open-fullscreen'); } },
    { label: 'ТВ-режим', click: () => { showWindow(); sendToWindow('open-tv'); } },
    { type: 'separator' },
    { label: 'Выход', click: () => { isQuitting = true; app.quit(); } },
  ]);
}
function createTray() {
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) img = nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Game Library');
  // Меню собирается заново при каждом открытии — чтобы недавние игры и «Запущена» были свежими
  tray.on('right-click', () => { try { tray.popUpContextMenu(trayMenu()); } catch {} });
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

// ─── Автозапуск с Windows ────────────────────────────────────────────────────
function loginItemOptions() {
  // В собранной программе запускается сам .exe; при npm start — electron + папка проекта
  return app.isPackaged
    ? { args: ['--hidden'] }
    : { path: process.execPath, args: [path.resolve(app.getAppPath()), '--hidden'] };
}

function applyAutostart(enabled) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return false;
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, ...loginItemOptions() });
    return true;
  } catch { return false; }
}

function getAutostart() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return { supported: false, enabled: false };
  try {
    const opts = loginItemOptions();
    return { supported: true, enabled: !!app.getLoginItemSettings(opts).openAtLogin };
  } catch { return { supported: true, enabled: false }; }
}

if (gotLock) {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.gamelibrary.app');
    createTray();
    createWindow();
    scheduleUpdateChecks();
  });
}

app.on('before-quit', () => { isQuitting = true; flushActiveSessions(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── Обновления ───────────────────────────────────────────────────────────────
// Схема: установщик .exe ставит программу, а новые версии она находит сама на
// GitHub Releases (адрес зашит в app-update.yml при сборке), скачивает в фоне и
// ставит при выходе или по кнопке «Перезапустить и обновить». Без сервера можно
// обновиться из скачанного Setup.exe — «Обновить из файла» в настройках.
autoUpdater.autoDownload = false;          // включается по настройке ниже
autoUpdater.autoInstallOnAppQuit = true;   // скачанное ставится при выходе
autoUpdater.allowDowngrade = false;

let lastUpdate = { status: 'idle' };
let updateTimer = null;

function setUpdate(state) {
  lastUpdate = { ...state, at: Date.now() };
  sendToWindow('update-status', lastUpdate);
}

// Настроен ли сервер обновлений в этой сборке
function updateFeed() {
  if (!app.isPackaged) return { configured: false, reason: 'dev' };
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const owner = (yml.match(/^owner:\s*(.+)$/m) || [])[1]?.trim().replace(/['"]/g, '');
    const repo = (yml.match(/^repo:\s*(.+)$/m) || [])[1]?.trim().replace(/['"]/g, '');
    const provider = (yml.match(/^provider:\s*(.+)$/m) || [])[1]?.trim();
    if (provider === 'github' && (!owner || owner === 'YOUR_GITHUB_USERNAME')) return { configured: false, reason: 'placeholder' };
    return { configured: true, provider, owner, repo, url: provider === 'github' ? `https://github.com/${owner}/${repo}/releases` : null };
  } catch { return { configured: false, reason: 'no-file' }; }
}

function friendlyUpdateError(err) {
  const m = String(err?.message || err || '');
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|net::/i.test(m)) return 'Нет подключения к интернету.';
  if (/404|Cannot find channel|latest\.yml|No published versions/i.test(m)) return 'На сервере пока нет опубликованных версий.';
  if (/403|rate limit/i.test(m)) return 'GitHub временно ограничил запросы — попробуйте через час.';
  if (/sha512|checksum/i.test(m)) return 'Файл обновления повреждён при загрузке — попробуйте ещё раз.';
  return m.split('\n')[0].slice(0, 160);
}

function checkUpdatesSafe(manual = false) {
  const feed = updateFeed();
  if (!feed.configured) {
    setUpdate({ status: feed.reason === 'dev' ? 'dev-mode' : 'not-configured' });
    return;
  }
  if (['checking', 'downloading'].includes(lastUpdate.status)) return;
  autoUpdater.autoDownload = loadSettings().autoDownloadUpdates !== false;
  lastUpdate.manual = manual;
  try {
    const p = autoUpdater.checkForUpdates();
    if (p && p.catch) p.catch((err) => setUpdate({ status: 'error', message: friendlyUpdateError(err) }));
  } catch (err) {
    setUpdate({ status: 'error', message: friendlyUpdateError(err) });
  }
}

function scheduleUpdateChecks() {
  clearInterval(updateTimer);
  if (loadSettings().autoUpdate === false) return;
  setTimeout(() => checkUpdatesSafe(false), 8000);                 // вскоре после запуска
  updateTimer = setInterval(() => checkUpdatesSafe(false), 6 * 3600 * 1000); // и раз в 6 часов
}

autoUpdater.on('checking-for-update', () => setUpdate({ status: 'checking' }));
autoUpdater.on('update-available', (info) => setUpdate({
  status: autoUpdater.autoDownload ? 'downloading' : 'available', version: info.version, percent: 0,
  notes: typeof info.releaseNotes === 'string' ? info.releaseNotes.replace(/<[^>]+>/g, '').trim().slice(0, 600) : '',
}));
autoUpdater.on('update-not-available', () => setUpdate({ status: 'up-to-date' }));
autoUpdater.on('error', (err) => setUpdate({ status: 'error', message: friendlyUpdateError(err) }));
autoUpdater.on('download-progress', (p) => setUpdate({ ...lastUpdate, status: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (info) => {
  setUpdate({ status: 'downloaded', version: info.version });
  if (tray) tray.displayBalloon?.({ title: 'Game Library', content: `Версия ${info.version} готова. Установится при выходе или по кнопке в настройках.` });
});

ipcMain.handle('get-update-info', () => ({ version: app.getVersion(), packaged: app.isPackaged, feed: updateFeed(), state: lastUpdate }));
ipcMain.handle('check-for-updates', () => {
  checkUpdatesSafe(true);
  return lastUpdate;
});
ipcMain.handle('download-update', () => {
  if (!updateFeed().configured) return false;
  setUpdate({ ...lastUpdate, status: 'downloading', percent: 0 });
  autoUpdater.downloadUpdate().catch((err) => setUpdate({ status: 'error', message: friendlyUpdateError(err) }));
  return true;
});
ipcMain.handle('install-update', () => {
  isQuitting = true;
  flushActiveSessions();
  // true, true — тихая установка и сразу запуск новой версии
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
});

// Обновление из скачанного установщика — без сервера обновлений
ipcMain.handle('update-from-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите установщик новой версии',
    filters: [{ name: 'Установщик', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { ok: false };
  const file = result.filePaths[0];
  const name = path.basename(file);
  if (!/game.?library/i.test(name)) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['Отмена', 'Всё равно запустить'], defaultId: 0, cancelId: 0,
      message: 'Похоже, это не установщик Game Library', detail: name,
    });
    if (response !== 1) return { ok: false };
  }
  if (!app.isPackaged) {
    shell.openPath(file);
    return { ok: true, dev: true };
  }
  // /S — тихая установка поверх текущей версии, --force-run — запустить после установки.
  // Библиотека, обложки и настройки хранятся отдельно и не затрагиваются.
  const { spawn } = require('child_process');
  const started = await new Promise((resolve) => {
    const pr = spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    pr.once('error', (err) => resolve(err)); pr.once('spawn', () => { pr.unref(); resolve(null); });
  });
  if (started) return { ok: false, error: 'Не удалось запустить установщик: ' + started.message };
  isQuitting = true;
  flushActiveSessions();
  setTimeout(() => app.quit(), 400);
  return { ok: true };
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-load-notice', () => { const n = loadNotice; loadNotice = null; return n; });

// ─── Управление окном ─────────────────────────────────────────────────────────
ipcMain.on('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window-maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('window-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
// Из ТВ-режима (там нет кнопки ✕): спрятать окно в трей или выйти совсем
let trayHintShown = false;
ipcMain.on('window-to-tray', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender); if (!win) return;
  win.hide();
  if (!trayHintShown && tray) { trayHintShown = true; tray.displayBalloon?.({ title: 'Game Library', content: 'Программа работает в трее — нажмите на значок, чтобы вернуться.' }); }
});
ipcMain.on('app-quit', () => { isQuitting = true; app.quit(); });
// Полный экран — настоящий, поверх панели задач Windows
ipcMain.handle('set-fullscreen', (e, on) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return false;
  if (win.isFullScreen() !== !!on) win.setFullScreen(!!on);
  return win.isFullScreen();
});

// ─── Геймпады: имя и заряд через Windows.Gaming.Input (Xbox и другие) ─────────
// Chromium иногда называет устройство «HID-совместимый игровой контроллер» —
// Windows знает настоящее имя и уровень заряда беспроводных геймпадов.
const PAD_PS = `$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8
[void][Windows.Gaming.Input.RawGameController,Windows.Gaming.Input,ContentType=WindowsRuntime]
Start-Sleep -Milliseconds 1200
$o=@()
foreach($c in [Windows.Gaming.Input.RawGameController]::RawGameControllers){
  $o+=[pscustomobject]@{name=$c.DisplayName;vid=$c.HardwareVendorId;pid=$c.HardwareProductId;wireless=$c.IsWireless}
}
ConvertTo-Json -InputObject @($o) -Compress`;
// ─── Геймпады «как в Steam»: Windows сообщает о подключении сразу, без нажатия кнопки ─────
// (браузерная часть программы видит геймпад только после первого нажатия — так устроен Chromium)
const PAD_WATCH_PS = `$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8
[void][Windows.Gaming.Input.RawGameController,Windows.Gaming.Input,ContentType=WindowsRuntime]
$parent=[int]$args[0]; $last='~'
while($true){
  if($parent -and -not (Get-Process -Id $parent)){ exit }
  $o=@(); foreach($c in [Windows.Gaming.Input.RawGameController]::RawGameControllers){ $o+=[pscustomobject]@{name=$c.DisplayName;vid=$c.HardwareVendorId;pid=$c.HardwareProductId;wireless=$c.IsWireless} }
  $j=ConvertTo-Json -InputObject @($o) -Compress
  if($j -ne $last){ [Console]::Out.WriteLine($j); [Console]::Out.Flush(); $last=$j }
  Start-Sleep -Milliseconds 800
}`;
const padWatch = { proc: null, list: null, restarts: 0 };
function startPadWatch() {
  if (process.platform !== 'win32' || padWatch.proc) return;
  const { spawn } = require('child_process');
  const pr = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `& {${PAD_WATCH_PS}} ${process.pid}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  padWatch.proc = pr;
  pr.on('error', () => { padWatch.proc = null; });   // PowerShell не запустился — просто живём без него
  let buf = '';
  pr.stdout.setEncoding('utf8');
  pr.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try { const j = JSON.parse(line); padWatch.list = (Array.isArray(j) ? j : [j]).filter((x) => x && (x.vid || x.name)); } catch { continue; }
      sendToWindow('pads-native', padWatch.list);
    }
  });
  pr.on('exit', () => {
    padWatch.proc = null;
    if (!isQuitting && padWatch.restarts++ < 5) setTimeout(startPadWatch, 3000);
  });
}
ipcMain.handle('pads-native', () => padWatch.list);
app.on('will-quit', () => { try { padWatch.proc?.kill(); } catch {} });
let padCache = { t: 0, data: [] };
ipcMain.handle('pad-info', async () => {
  if (process.platform !== 'win32') return [];
  if (padWatch.list) return padWatch.list;
  if (Date.now() - padCache.t < 15000) return padCache.data;
  const data = await new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PAD_PS],
      { timeout: 10000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) => {
        if (err) return resolve([]);
        try { const j = JSON.parse(String(stdout).trim() || '[]'); resolve(Array.isArray(j) ? j : [j]); } catch { resolve([]); }
      });
  });
  padCache = { t: Date.now(), data };
  return data;
});

// ─── Выбор файлов ─────────────────────────────────────────────────────────────
ipcMain.handle('pick-exe', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите игру',
    filters: [
      { name: 'Все поддерживаемые', extensions: ['exe', 'lnk'] },
      { name: 'Исполняемые файлы', extensions: ['exe'] },
      { name: 'Ярлыки', extensions: ['lnk'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled) return null;
  const picked = result.filePaths[0];
  if (picked.toLowerCase().endsWith('.lnk')) {
    const target = resolveShortcut(picked);
    return { path: picked, resolvedPath: target || null, isLnk: true, name: lnkName(picked) };
  }
  return { path: picked, resolvedPath: picked, isLnk: false, name: path.basename(picked, path.extname(picked)) };
});

// Старые версии иногда сохраняли путь с русскими буквами «кракозябрами» (кодировка ярлыка) — чиним
function fixMojibake(p) {
  if (!p || fs.existsSync(p) || !/[\u0080-\u00ff]/.test(p)) return null;
  for (const enc of ['windows-1251', 'ibm866']) {
    try { const t = new TextDecoder(enc).decode(Buffer.from(p, 'latin1')); if (t !== p && fs.existsSync(t)) return t; } catch {}
  }
  return null;
}
ipcMain.handle('repair-paths', (e, list) => (Array.isArray(list) ? list : []).slice(0, 5000).map((p) => fixMojibake(String(p || ''))));

// Всё о ярлыке: куда ведёт, с какими параметрами и из какой папки запускать
ipcMain.handle('shortcut-info', (e, lnk) => {
  if (!lnk || !/\.lnk$/i.test(lnk) || !fs.existsSync(lnk)) return null;
  if (process.platform === 'win32') {
    try { const l = shell.readShortcutLink(lnk); if (l.target) return { target: l.target, args: l.args || '', cwd: l.cwd || '' }; } catch {}
  }
  const t = resolveShortcut(lnk);
  return t ? { target: t, args: '', cwd: '' } : null;
});

// Узнать реальный .exe за ярлыком (для учёта времени)
ipcMain.handle('resolve-shortcut', (e, lnkPath) => {
  if (!lnkPath || !lnkPath.toLowerCase().endsWith('.lnk')) return null;
  return resolveShortcut(lnkPath);
});

ipcMain.handle('pick-image', async (e, gameId, kind) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите обложку',
    filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return null;
  try { return dl.storeCoverFromFile(coversDir, artId(gameId, kind), result.filePaths[0]); }
  catch { return null; }
});

function safeId(id) { return String(id || 'tmp').replace(/[^a-zA-Z0-9_]/g, '_'); }
// Фон (широкая картинка) хранится отдельно от обложки: «id~hero-…»
function artId(id, kind) { return safeId(id) + (kind === 'hero' ? '~hero' : kind === 'logo' ? '~logo' : ''); }

ipcMain.handle('download-image', async (e, url, gameId, kind) => {
  return dl.storeCoverFromUrl(coversDir, artId(gameId, kind), url);
});

ipcMain.handle('set-cover-from-url', async (e, gameId, url, kind) => {
  // Картинка из кэша Steam на этом компьютере (только из папки librarycache)
  if (/^file:/i.test(String(url))) {
    try {
      const f = require('url').fileURLToPath(url); const root = steamRoot();
      const cache = root && path.join(root, 'appcache', 'librarycache');
      if (!cache || !normP(f).startsWith(normP(cache) + '\\') || !fs.existsSync(f)) return null;
      return dl.storeCoverFromFile(coversDir, artId(gameId, kind), f);
    } catch { return null; }
  }
  const settings = loadSettings();
  const headers = (settings.sgdbKey && /^https:\/\/(www\.)?steamgriddb\.com\//i.test(url)) ? { Authorization: `Bearer ${settings.sgdbKey}` } : {};
  return dl.storeCoverFromUrl(coversDir, artId(gameId, kind), url, headers);
});

// ─── Сканирование папок ──────────────────────────────────────────────────────
const SKIP_NAMES = ['unins', 'uninst', 'setup', 'install', 'crash', 'report', 'helper', 'redist',
  'vcredist', 'directx', 'dotnet', 'support', 'update', 'launcher_fix', 'benchmark', 'unitycrashhandler'];

// «Игра — ярлык» / «Игра - Shortcut» → «Игра» (Windows дописывает это к именам ярлыков)
function lnkName(file) {
  return path.basename(file, path.extname(file)).replace(/\s*[-—–]\s*(ярлык|shortcut|копия|copy)(\s*\(\d+\))?$/i, '').replace(/\.exe$/i, '').trim() || path.basename(file, path.extname(file));
}

function shouldSkip(filename) {
  const lower = filename.toLowerCase();
  return SKIP_NAMES.some((s) => lower.includes(s));
}

function scanDirForGames(dir, depth = 0) {
  const found = [];
  if (depth > 2) return found;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return found; }

  const exes = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.exe') && !shouldSkip(e.name));
  const lnks = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.lnk'));

  if (exes.length > 0) {
    // Предпочитаем exe, похожий на имя папки, иначе самый большой
    const folder = path.basename(dir).toLowerCase().replace(/[^a-z0-9а-я]/g, '');
    const scored = exes.map((e) => {
      let size = 0;
      try { size = fs.statSync(path.join(dir, e.name)).size; } catch {}
      const n = e.name.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9а-я]/g, '');
      const match = folder && (n.includes(folder) || folder.includes(n)) ? 1 : 0;
      return { e, size, match };
    }).sort((a, b) => b.match - a.match || b.size - a.size);
    found.push({ name: path.basename(dir), exePath: path.join(dir, scored[0].e.name), isLnk: false, lnkPath: null });
    return found;
  }

  for (const lnk of lnks) {
    const lnkFullPath = path.join(dir, lnk.name);
    const target = resolveShortcut(lnkFullPath);
    if (target && target.toLowerCase().endsWith('.exe') && !shouldSkip(path.basename(target))) {
      found.push({ name: lnkName(lnk.name), exePath: target, isLnk: true, lnkPath: lnkFullPath });
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('$')) {
      found.push(...scanDirForGames(path.join(dir, entry.name), depth + 1));
    }
  }
  return found;
}

ipcMain.handle('scan-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Выберите папку с играми', properties: ['openDirectory'] });
  if (result.canceled) return null;
  const folder = result.filePaths[0];
  return { folder, found: scanDirForGames(folder) };
});

ipcMain.handle('scan-desktop', async () => {
  const desktopPaths = [app.getPath('desktop'), path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')];
  const found = [];
  const seen = new Set();
  for (const desktop of desktopPaths) {
    if (!fs.existsSync(desktop)) continue;
    let entries;
    try { entries = fs.readdirSync(desktop, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(desktop, entry.name);
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.lnk')) {
        const target = resolveShortcut(fullPath);
        if (target && target.toLowerCase().endsWith('.exe') && !shouldSkip(path.basename(target)) && !seen.has(target.toLowerCase())) {
          seen.add(target.toLowerCase());
          found.push({ name: lnkName(entry.name), exePath: target, isLnk: true, lnkPath: fullPath });
        }
      } else if (lower.endsWith('.exe') && !shouldSkip(entry.name) && !seen.has(fullPath.toLowerCase())) {
        seen.add(fullPath.toLowerCase());
        found.push({ name: path.basename(entry.name, path.extname(entry.name)), exePath: fullPath, isLnk: false, lnkPath: null });
      }
    }
  }
  return { folder: 'Рабочий стол', found };
});

// ─── Игры из Steam и Epic Games ──────────────────────────────────────────────
function regQuery(key, value) {
  try {
    const out = execSync(`reg query "${key}" /v ${value}`, { timeout: 4000, windowsHide: true }).toString();
    const m = out.match(new RegExp(value + '\\s+REG_\\w+\\s+(.+)', 'i'));
    return m ? m[1].trim() : null;
  } catch { return null; }
}
let steamRootCache = { t: 0, v: null };
function steamRoot() {
  if (process.platform !== 'win32') return null;
  if (Date.now() - steamRootCache.t < 5 * 60 * 1000) return steamRootCache.v;
  steamRootCache = { t: Date.now(), v: steamRootFind() };
  return steamRootCache.v;
}
function steamRootFind() {
  const cands = [regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'), regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'].filter(Boolean).map((p) => p.replace(/\//g, '\\'));
  return cands.find((p) => fs.existsSync(path.join(p, 'steamapps'))) || null;
}
// Простенький разбор VDF/ACF Steam: вытаскиваем пары "ключ" "значение"
function vdfPairs(text) {
  const out = []; const re = /"((?:[^"\\]|\\.)+)"\s+"((?:[^"\\]|\\.)*)"/g; let m;
  const un = (x) => x.replace(/\\(["\\])/g, '$1');
  while ((m = re.exec(text))) out.push([un(m[1]), un(m[2])]);
  return out;
}
const STEAM_SKIP = new Set(['228980', '1070560', '1391110', '1628350', '1493710', '2180100', '1826330']);
function mainExeIn(dir) {
  try { const f = scanDirForGames(dir, 0)[0]; if (f?.exePath) return f.exePath; } catch {}
  try {   // Unreal: Binaries\Win64\*-Shipping.exe
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const w = path.join(dir, e.name, 'Binaries', 'Win64');
      if (fs.existsSync(w)) { const x = fs.readdirSync(w).find((n) => /\.exe$/i.test(n) && !shouldSkip(n)); if (x) return path.join(w, x); }
    }
  } catch {}
  return null;
}
function steamGames() {
  const root = steamRoot(); if (!root) return [];
  // Одна и та же библиотека бывает записана по-разному (регистр, «/» вместо «\») — сравниваем нормализованно
  const libs = new Map(); const addLib = (p) => { const k = path.resolve(p).toLowerCase(); if (!libs.has(k)) libs.set(k, p); };
  addLib(path.join(root, 'steamapps'));
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const [k, v] of vdfPairs(vdf)) if (k === 'path' && v) addLib(path.join(v, 'steamapps'));
  } catch {}
  const out = []; const seen = new Set();
  for (const lib of libs.values()) {
    let files = []; try { files = fs.readdirSync(lib).filter((f) => /^appmanifest_\d+\.acf$/i.test(f)); } catch { continue; }
    for (const f of files) {
      try {
        const kv = Object.fromEntries(vdfPairs(fs.readFileSync(path.join(lib, f), 'utf8')).slice(0, 40));
        const appid = kv.appid, name = kv.name, dir = kv.installdir;
        if (!appid || seen.has(appid)) continue; seen.add(appid);
        if (!name || STEAM_SKIP.has(appid) || /redistributable|steamworks common|proton|runtime/i.test(name)) continue;
        const install = path.join(lib, 'common', dir || '');
        if (!dir || !fs.existsSync(install)) continue;
        const flags = Number(kv.StateFlags || 4);
        out.push({ store: 'steam', storeId: appid, name, installDir: install, exePath: mainExeIn(install) || install,
          launchUrl: `steam://rungameid/${appid}`, installed: !!(flags & 4) });   // 4 — установлена полностью (2 — просто ждёт обновления)
      } catch {}
    }
  }
  return out;
}
function epicGames() {
  if (process.platform !== 'win32') return [];
  const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = []; try { files = fs.readdirSync(dir).filter((f) => /\.item$/i.test(f)); } catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (m.bIsIncompleteInstall || !m.DisplayName || !m.InstallLocation) continue;
      const cats = (m.AppCategories || []).map((c) => String(c).toLowerCase());
      if (cats.length && !cats.includes('games')) continue;
      const exe = m.LaunchExecutable ? path.join(m.InstallLocation, m.LaunchExecutable) : mainExeIn(m.InstallLocation);
      const id = `${m.CatalogNamespace}:${m.CatalogItemId}:${m.AppName}`;
      out.push({ store: 'epic', storeId: m.AppName, name: m.DisplayName, installDir: m.InstallLocation, exePath: exe || m.InstallLocation,
        launchUrl: `com.epicgames.launcher://apps/${encodeURIComponent(id)}?action=launch&silent=true` });
    } catch {}
  }
  return out;
}
// ─── GOG, Ubisoft Connect, EA app, Battle.net ────────────────────────────────
// GOG и Ubisoft хранят список установленных игр в реестре; игры EA и Battle.net видно в «Программах и компонентах»
// по команде удаления (её пишет сам лаунчер). Всё читаем одним запросом PowerShell.
const OTHER_PS = `$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8
$gog=@(Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\*','HKLM:\\SOFTWARE\\GOG.com\\Games\\*' | Select-Object gameID,gameName,path,exe,workingDir,launchParam,dependsOn)
$ubi=@(Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\*','HKLM:\\SOFTWARE\\Ubisoft\\Launcher\\Installs\\*' | Select-Object PSChildName,InstallDir)
$k=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')
$un=@(Get-ItemProperty $k | Where-Object { $_.DisplayName -and $_.InstallLocation } | Select-Object PSChildName,DisplayName,InstallLocation,UninstallString,DisplayIcon,Publisher)
ConvertTo-Json -InputObject @{ gog=$gog; ubi=$ubi; un=$un } -Compress -Depth 3`;
// Разбор ответа (отдельно — чтобы проверять без Windows). exists и findExe подменяются в тестах.
function parseOtherStores(j, exists = (p) => { try { return fs.existsSync(p); } catch { return false; } }, findExe = mainExeIn) {
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((o) => o && typeof o === 'object');
  const str = (x) => String(x ?? '').trim();
  const exeOf = (icon) => { const m = str(icon).replace(/^"/, '').match(/^(.*?\.exe)/i); return m ? m[1] : null; };
  const out = [], seen = new Set();
  const push = (o) => { o.name = String(o.name || '').replace(/[™®]/g, '').replace(/\s+/g, ' ').trim(); const k = o.store + ':' + o.storeId; if (!o.name || !o.installDir || seen.has(k)) return; seen.add(k); out.push(o); };
  for (const g of arr(j?.gog)) {
    if (str(g.dependsOn)) continue;   // дополнения (DLC) — не отдельные игры
    const dir = str(g.path), exe = str(g.exe);
    if (!dir || !exists(dir)) continue;
    push({ store: 'gog', storeId: str(g.gameID) || str(g.gameName), name: str(g.gameName), installDir: dir,
      exePath: exe && exists(exe) ? exe : findExe(dir) || dir, workDir: str(g.workingDir) || null, args: str(g.launchParam) || null, installed: true });
  }
  const un = arr(j?.un);
  for (const u of arr(j?.ubi)) {
    const id = str(u.PSChildName), dir = str(u.InstallDir).replace(/\//g, '\\').replace(/\\+$/, '');
    if (!/^\d+$/.test(id) || !dir || !exists(dir)) continue;
    const e = un.find((x) => str(x.PSChildName) === 'Uplay Install ' + id);
    push({ store: 'ubisoft', storeId: id, name: str(e?.DisplayName) || path.basename(dir), installDir: dir, exePath: findExe(dir) || dir,
      launchUrl: `uplay://launch/${id}/0`, installed: true });
  }
  for (const u of un) {
    const name = str(u.DisplayName), dir = str(u.InstallLocation).replace(/^"|"$/g, '').replace(/\\+$/, '');
    const cmd = str(u.UninstallString), icon = exeOf(u.DisplayIcon);
    let store = null;
    if (/battle\.net|blizzard uninstaller/i.test(cmd) && !/^battle\.net$/i.test(name)) store = 'battlenet';
    else if ((/EAInstaller|__Installer|EA Desktop|\\Origin\\|eadm/i.test(cmd) || /^electronic arts/i.test(str(u.Publisher))) && !/^(ea app|ea|origin)$/i.test(name)) store = 'ea';
    if (!store || !dir || !exists(dir)) continue;
    if (/redist|directx|vcredist|easyanticheat|punkbuster|touchup/i.test(name)) continue;
    const exe = icon && exists(icon) && icon.toLowerCase().startsWith(dir.toLowerCase()) ? icon : findExe(dir);
    push({ store, storeId: str(u.PSChildName) || name, name: name.replace(/[™®]/g, '').trim(), installDir: dir, exePath: exe || dir, installed: true });
  }
  return out;
}
let otherCache = { t: 0, list: [] };
async function otherStoreGames() {
  if (process.platform !== 'win32') return [];
  if (Date.now() - otherCache.t < 60000) return otherCache.list;
  const j = await new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', OTHER_PS],
    { timeout: 25000, windowsHide: true, maxBuffer: 16 << 20 }, (err, out) => { try { resolve(JSON.parse(String(out).trim() || '{}')); } catch { resolve({}); } }));
  let list = []; try { list = parseOtherStores(j); } catch {}
  otherCache = { t: Date.now(), list };
  return list;
}
// Вложенный разбор VDF (localconfig.vdf) — только то, что нужно для времени игры
function vdfParse(text) {
  const root = {}; const stack = [root]; let key = null;
  const re = /"((?:[^"\\]|\\.)*)"|([{}])/g; let m;
  while ((m = re.exec(text))) {
    const cur = stack[stack.length - 1];
    if (m[2] === '{') { const o = {}; if (key != null) cur[key] = o; stack.push(o); key = null; }
    else if (m[2] === '}') { if (stack.length > 1) stack.pop(); key = null; }
    else if (key == null) key = m[1];
    else { cur[key] = m[1]; key = null; }
  }
  return root;
}
function lcGet(o, ...keys) { for (const k of keys) { if (!o) return null; const f = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()); o = f ? o[f] : null; } return o; }
// Время в играх Steam: userdata/<аккаунт>/config/localconfig.vdf → apps → Playtime (минуты), LastPlayed (сек)
ipcMain.handle('steam-playtime', async () => {
  const root = steamRoot(); if (!root) return {};
  const out = {};
  let users = []; try { users = fs.readdirSync(path.join(root, 'userdata')); } catch { return {}; }
  for (const u of users) {
    const f = path.join(root, 'userdata', u, 'config', 'localconfig.vdf');
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const apps = lcGet(vdfParse(txt), 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps') || lcGet(vdfParse(txt), 'UserLocalConfigStore', 'Software', 'valve', 'steam', 'Apps');
    if (!apps) continue;
    for (const [id, a] of Object.entries(apps)) {
      if (!a || typeof a !== 'object') continue;
      const minutes = parseInt(lcGet(a, 'Playtime'), 10) || 0, last = (parseInt(lcGet(a, 'LastPlayed'), 10) || 0) * 1000;
      if (!minutes && !last) continue;
      const cur = out[id] || { minutes: 0, lastPlayed: 0 };
      out[id] = { minutes: Math.max(cur.minutes, minutes), lastPlayed: Math.max(cur.lastPlayed, last) };
    }
  }
  return out;
});

// ─── Мои скриншоты и клипы игры: Steam (F12), Xbox Game Bar (Win+Alt+PrtScn), NVIDIA ShadowPlay ───
const SHOT_EXT = /\.(png|jpe?g|webp|bmp)$/i, CLIP_EXT = /\.(mp4|webm)$/i;
function listFiles(dir, re, max = 400) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && re.test(e.name)).slice(0, max).map((e) => path.join(dir, e.name)); } catch { return []; } }
function myScreenshots(g, dirs = {}) {
  const out = [], seen = new Set();
  const add = (file, thumb, src) => { const k = file.toLowerCase(); if (seen.has(k)) return; seen.add(k);
    let mt = 0; try { mt = fs.statSync(file).mtimeMs; } catch { return; }
    out.push({ file, thumb: thumb && fs.existsSync(thumb) ? thumb : null, video: CLIP_EXT.test(file), time: mt, src }); };
  // Steam: userdata/<аккаунт>/760/remote/<appid>/screenshots (+ thumbnails/ с тем же именем)
  const root = dirs.steam !== undefined ? dirs.steam : steamRoot();
  if (root && g.store === 'steam' && /^\d+$/.test(String(g.storeId || ''))) {
    let users = []; try { users = fs.readdirSync(path.join(root, 'userdata')); } catch {}
    for (const u of users) {
      const d = path.join(root, 'userdata', u, '760', 'remote', String(g.storeId), 'screenshots');
      for (const f of listFiles(d, SHOT_EXT)) add(f, path.join(d, 'thumbnails', path.basename(f)), 'steam');
    }
  }
  // Xbox Game Bar: «Видео\Клипы» (Captures) — имя файла начинается с названия окна игры
  const want = normName(g.name);
  let videos = dirs.videos; if (videos === undefined) { try { videos = app.getPath('videos'); } catch { videos = null; } }
  if (videos && want.length >= 3) {
    for (const f of listFiles(path.join(videos, 'Captures'), /\.(png|jpe?g|mp4)$/i, 3000)) if (normName(path.basename(f).replace(/\.[^.]+$/, '')).startsWith(want)) add(f, null, 'gamebar');
    // NVIDIA ShadowPlay: «Видео\<Название игры>\»
    let sub = []; try { sub = fs.readdirSync(videos, { withFileTypes: true }).filter((e) => e.isDirectory() && normName(e.name) === want); } catch {}
    for (const e of sub) for (const f of listFiles(path.join(videos, e.name), /\.(png|jpe?g|mp4)$/i)) add(f, null, 'nvidia');
  }
  return out.sort((a, b) => b.time - a.time).slice(0, 300);
}
ipcMain.handle('my-screenshots', (e, g = {}) => {
  try {
    const { pathToFileURL } = require('url');
    return myScreenshots({ name: String(g.name || ''), store: g.store, storeId: g.storeId }).map((x) => ({ f: pathToFileURL(x.file).href, t: x.thumb ? pathToFileURL(x.thumb).href : null, v: x.video, time: x.time, src: x.src }));
  } catch { return []; }
});

// ─── Привязка уже добавленных игр к Steam / Epic ─────────────────────────────
// По ярлыку (.url steam://rungameid/ID, .lnk «steam.exe -applaunch ID»), по папке установки и по названию.
const normName = (x) => String(x || '').toLowerCase().replace(/[™®©]/g, '').replace(/[^a-zа-яё0-9]+/gi, '');
function storeFromShortcut(file) {
  if (!file) return null;
  try {
    if (/\.url$/i.test(file)) {
      const u = (fs.readFileSync(file, 'utf8').match(/^URL=(.+)$/mi) || [])[1] || '';
      let m = u.match(/^steam:\/\/(?:rungameid|run|launch)\/(\d+)/i); if (m) return { store: 'steam', storeId: m[1] };
      m = u.match(/^com\.epicgames\.launcher:\/\/apps\/([^?]+)/i); if (m) { const parts = decodeURIComponent(m[1]).split(':'); return { store: 'epic', storeId: parts[parts.length - 1] }; }
    } else if (/\.lnk$/i.test(file) && process.platform === 'win32') {
      const l = shell.readShortcutLink(file);
      const m = String(l.args || '').match(/-applaunch\s+(\d+)/i) || String(l.target || '').match(/steam:\/\/rungameid\/(\d+)/i);
      if (m && /steam/i.test(l.target || '')) return { store: 'steam', storeId: m[1] };
      const t = String(l.target || '').toLowerCase();
      if (t.endsWith('.url')) return storeFromShortcut(l.target);
    }
  } catch {}
  return null;
}
ipcMain.handle('link-stores', async (e, list) => {
  const store = [...steamGames(), ...epicGames(), ...(await otherStoreGames().catch(() => []))];
  const norm = (x) => String(x || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
  const out = {};
  for (const g of Array.isArray(list) ? list : []) {
    let hit = storeFromShortcut(g.lnkPath) || storeFromShortcut(g.exePath);
    if (hit) { const s2 = store.find((x) => x.store === hit.store && x.storeId === hit.storeId); if (s2) hit = { ...hit, installDir: s2.installDir, launchUrl: s2.launchUrl, exePath: s2.exePath, name: s2.name }; }
    if (!hit) {
      const exe = norm(g.exePath);
      // По названию — только если у игры нет своего настоящего .exe (иначе GOG-версия «стала бы» игрой Steam)
      const ownExe = /\.exe$/i.test(g.exePath || '') && fs.existsSync(g.exePath);
      const s2 = store.find((x) => (x.installDir && exe.startsWith(norm(x.installDir) + '\\')) || (x.exePath && exe === norm(x.exePath)))
        || (ownExe ? null : store.find((x) => normName(x.name) && normName(x.name) === normName(g.name)));
      if (s2) hit = { store: s2.store, storeId: s2.storeId, installDir: s2.installDir, launchUrl: s2.launchUrl, exePath: s2.exePath, name: s2.name };
    }
    if (hit) out[g.id] = hit;
  }
  return out;
});

// ─── Проверка наличия и удаление игр с компьютера ────────────────────────────
// Есть ли игра на диске: .exe / ярлык / папка установки
ipcMain.handle('check-games', async (e, list) => (Array.isArray(list) ? list : []).slice(0, 5000).map((g) => {
  const ok = (p) => { try { return !!p && fs.existsSync(String(p)); } catch { return false; } };
  if (g.installDir) return ok(g.installDir) && (!/\.exe$/i.test(g.exePath || '') || ok(g.exePath));
  return /\.exe$/i.test(g.exePath || '') ? ok(g.exePath) : (ok(g.exePath) || ok(g.lnkPath));
}));
// Деинсталляторы из реестра Windows (Программы и компоненты)
const UNINST_PS = `$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8
$k=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')
$o=Get-ItemProperty $k | Where-Object { $_.DisplayName -and $_.UninstallString } | Select-Object DisplayName,InstallLocation,UninstallString,QuietUninstallString,DisplayIcon
ConvertTo-Json -InputObject @($o) -Compress`;
let uninstCache = { t: 0, list: [] };
async function uninstallers() {
  if (process.platform !== 'win32') return [];
  if (Date.now() - uninstCache.t < 60000) return uninstCache.list;
  const list = await new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', UNINST_PS],
    { timeout: 20000, windowsHide: true, maxBuffer: 8 << 20 }, (err, out) => { try { const j = JSON.parse(String(out).trim() || '[]'); resolve(Array.isArray(j) ? j : [j]); } catch { resolve([]); } }));
  uninstCache = { t: Date.now(), list };
  return list;
}
const normP = (p) => String(p || '').replace(/^"|"$/g, '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
// Папка, которую безопасно удалять целиком: не корень диска и не системные/пользовательские папки
function safeGameDir(g) {
  if (process.platform !== 'win32' && !process.env.GL_TEST_UNSAFE) return null;
  const exe = /\.exe$/i.test(g.exePath || '') ? g.exePath : null;
  let dir = g.installDir || (exe ? path.dirname(exe) : null);
  if (!dir || !fs.existsSync(dir)) return null;
  // exe лежит в bin\x64 и т.п. — поднимаемся к папке игры (до 3 уровней), если она осталась «игровой»
  if (!g.installDir && exe) {
    let d = dir;
    for (let i = 0; i < 3; i++) {
      const up = path.dirname(d); if (up === d) break;
      if (/^(bin|binaries|win64|win32|x64|x86|game|client|release)$/i.test(path.basename(d))) d = up; else break;
    }
    dir = d;
  }
  const n = normP(dir);
  const home = normP(app.getPath('home'));
  const banned = [process.env.WINDIR, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData, process.env.APPDATA, process.env.LOCALAPPDATA,
    app.getPath('home'), app.getPath('desktop'), app.getPath('documents'), app.getPath('downloads'), process.env.OneDrive,
    process.env.OneDrive && path.join(process.env.OneDrive, 'Рабочий стол'), process.env.OneDrive && path.join(process.env.OneDrive, 'Desktop')].filter(Boolean).map(normP);
  if (path.parse(dir).root.toLowerCase().replace(/\\$/, '') === n.replace(/\\$/, '')) return null;   // корень диска
  if (n.split('\\').filter(Boolean).length < 2) return null;
  if (banned.includes(n)) return null;
  if (/\\(steamapps\\common|steamapps|steamlibrary|epic games|games|игры|program files( \(x86\))?)$/i.test(n)) return null;   // общие папки с играми
  if (home && home.startsWith(n + '\\')) return null;   // папка выше профиля пользователя
  if (exe && !normP(exe).startsWith(n + '\\')) return null;
  if (process.env.WINDIR && n.startsWith(normP(process.env.WINDIR) + '\\')) return null;   // всё внутри Windows
  // Папки «для всего подряд» — удалять целиком нельзя
  if (/\\(downloads|загрузки|desktop|рабочий стол|documents|документы|torrents?|торренты|soft|software|programs|программы|portable|apps|tools|users|public|общие)$/i.test(n)) return null;
  // Папка должна быть похожа на саму игру: совпадает слово из названия игры или имени .exe
  if (!g.installDir) {
    const toks = (x) => String(x || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((t) => t.length >= 3 && !/^(the|game|games|edition|remake|remastered|definitive|win64|x64|bin)$/.test(t));
    const folder = path.basename(dir), fl = normName(folder);
    const keys = [...toks(g.name), ...toks(exe && path.basename(exe, '.exe'))];
    const exeN = normName(exe && path.basename(exe, '.exe'));
    const related = keys.some((k) => fl.includes(k)) || (exeN.length >= 4 && (fl.includes(exeN) || exeN.includes(fl)));
    if (!related) return null;
  }
  return dir;
}
// Первый файл, который сейчас кем-то занят (игра, лаунчер, античит) — чтобы подсказать, что закрыть
function findLocked(dir, cap = 5000) {
  const stack = [dir]; let n = 0;
  while (stack.length && n < cap) {
    const d = stack.pop(); let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { stack.push(f); continue; }
      if (!/\.(exe|dll|sys)$/i.test(e.name)) continue;
      n++;
      try { const fd = fs.openSync(f, 'r+'); fs.closeSync(fd); }
      catch (err) {
        if (err.code === 'EBUSY') return path.relative(dir, f);
        if (err.code === 'EPERM') { try { if (fs.statSync(f).mode & 0o200) return path.relative(dir, f); } catch {} }   // EPERM у «только чтения» — не занятость
      }
    }
  }
  return null;
}
function dirSize(dir, cap = 200000) {
  let size = 0, files = 0; const stack = [dir];
  while (stack.length && files < cap) {
    const d = stack.pop(); let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) stack.push(f);
      else if (e.isFile()) { try { size += fs.statSync(f).size; } catch {} files++; }
    }
  }
  return { size, files, partial: files >= cap };
}
ipcMain.handle('uninstall-info', async (e, g) => {
  const info = { store: g.store || null, folder: null, size: 0, uninstaller: null };
  if (g.store === 'steam' || g.store === 'epic') return info;
  const dir = safeGameDir(g);
  if (dir) { info.folder = dir; const sz = dirSize(dir); info.size = sz.size; info.files = sz.files; }
  const exeDir = normP(g.installDir || (g.exePath && path.dirname(g.exePath)));
  const nm = normName(g.name);
  const list = await uninstallers();
  const u = list.find((x) => x.InstallLocation && exeDir && (exeDir === normP(x.InstallLocation) || exeDir.startsWith(normP(x.InstallLocation) + '\\')) && normP(x.InstallLocation).split('\\').length > 2)
    || list.find((x) => nm && normName(x.DisplayName) === nm)
    || list.find((x) => { const ic = normP(String(x.DisplayIcon || '').split(',')[0]); return ic && exeDir && ic.startsWith(exeDir + '\\'); });
  if (u) info.uninstaller = { name: u.DisplayName, cmd: u.UninstallString, location: u.InstallLocation || '' };
  return info;
});
ipcMain.handle('uninstall-game', async (e, g, method) => {
  try {
    if (method === 'steam' && /^\d+$/.test(String(g.storeId || ''))) { await shell.openExternal(`steam://uninstall/${g.storeId}`); return { ok: true, external: true }; }
    if (method === 'epic') { await shell.openExternal('com.epicgames.launcher://store/library'); return { ok: true, external: true, manual: true }; }
    if (method === 'uninstaller') {
      const list = await uninstallers();
      const u = list.find((x) => x.UninstallString === g.uninstallCmd);   // только команды, которые реально есть в реестре
      if (!u) return { ok: false, error: 'Деинсталлятор не найден' };
      const { spawn } = require('child_process');
      // Часть установщиков пишет путь без кавычек («C:\Program Files\…\unins000.exe») — cmd тогда не находит файл
      let cmd = String(u.UninstallString).trim();
      if (!cmd.startsWith('"') && !/^msiexec/i.test(cmd)) { const m = cmd.match(/^(.*?\.exe)(.*)$/i); if (m && fs.existsSync(m[1])) cmd = `"${m[1]}"${m[2]}`; }
      const pr = spawn(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: false });
      pr.on('error', () => {}); pr.unref();
      return { ok: true, external: true };
    }
    if (method === 'folder') {
      const dir = safeGameDir(g);
      if (!dir || normP(dir) !== normP(g.folder)) return { ok: false, error: 'Эту папку нельзя удалить автоматически' };
      try { await shell.trashItem(dir); }
      catch (err) {
        // Корзина не принимает слишком большие папки (её размер — % от диска), сетевые и съёмные диски
        return { ok: false, trashFailed: true, error: err.message, busy: findLocked(dir) };
      }
      return { ok: true, external: false };
    }
    if (method === 'folder-perm') {
      const dir = safeGameDir(g);
      if (!dir || normP(dir) !== normP(g.folder)) return { ok: false, error: 'Эту папку нельзя удалить автоматически' };
      try { await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); }
      catch (err) {
        const busy = findLocked(dir);
        return { ok: false, error: busy ? `файл занят другой программой: ${busy}` : err.code === 'EPERM' || err.code === 'EACCES' ? 'нет доступа к части файлов — запустите Game Library от имени администратора' : err.message, partial: fs.existsSync(dir) };
      }
      return { ok: true, external: false, permanent: true };
    }
    return { ok: false, error: 'Неизвестный способ удаления' };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('list-store-games', async () => {
  const list = [...steamGames(), ...epicGames(), ...(await otherStoreGames().catch(() => []))];
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});
// Значки самих лаунчеров (Steam, Epic) — берём с компьютера пользователя
ipcMain.handle('store-icons', async () => {
  const res = {};
  const tryIcon = async (key, files) => {
    for (const f of files) {
      if (!f || !fs.existsSync(f)) continue;
      try { const img = await app.getFileIcon(f, { size: 'normal' }); if (!img.isEmpty()) { res[key] = img.toDataURL(); return; } } catch {}
    }
  };
  const sr = steamRoot();
  await tryIcon('steam', [sr && path.join(sr, 'steam.exe')]);
  await tryIcon('epic', ['C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe',
    'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
    'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe']);
  return res;
});

// ─── Программы на компьютере (окно «Добавить игру», как в приложении Xbox) ──
// Меню «Пуск» и рабочие столы: ярлыки .lnk → .exe, ярлыки Steam/Epic (.url).
const JUNK_NAME = /uninstall|unins\d*|удален|удалить|readme|read me|help|справк|manual|руководств|documentation|license|лиценз|website|веб-сайт|homepage|release notes|changelog|what'?s new|support|поддержк|update|обновлен|repair|восстанов|safe mode|config|настройк|registration|регистрац|feedback|report|отч[её]т/i;
function programDirs() {
  const dirs = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop'),
  ];
  try { dirs.push(app.getPath('desktop')); } catch {}
  if (process.env.OneDrive) dirs.push(path.join(process.env.OneDrive, 'Desktop'), path.join(process.env.OneDrive, 'Рабочий стол'));
  return [...new Set(dirs)].filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
}
function readUrlFile(file) {
  try {
    const t = fs.readFileSync(file, 'utf8');
    const url = (t.match(/^URL=(.+)$/mi) || [])[1]?.trim() || '';
    const icon = (t.match(/^IconFile=(.+)$/mi) || [])[1]?.trim() || '';
    return { url, icon };
  } catch { return { url: '', icon: '' }; }
}
ipcMain.handle('list-programs', async () => {
  const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
  const out = [], seen = new Set();
  const walk = (dir, depth) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name), lower = e.name.toLowerCase();
      if (e.isDirectory()) { if (depth < 4 && !/^(startup|автозагрузка|administrative tools|windows tools)$/i.test(e.name)) walk(full, depth + 1); continue; }
      const name = lnkName(e.name);
      if (JUNK_NAME.test(name)) continue;
      if (lower.endsWith('.lnk')) {
        let target = null, icon = null;
        try { const l = shell.readShortcutLink(full); target = l.target; icon = l.icon || null; } catch { target = resolveShortcut(full); }
        if (!target || !/\.exe$/i.test(target) || target.toLowerCase().startsWith(winDir) || shouldSkip(path.basename(target))) continue;
        const key = target.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
        out.push({ name, exePath: target, lnkPath: full, isLnk: true, iconPath: target, iconFile: icon && /\.ico$/i.test(icon) ? icon : null });
      } else if (lower.endsWith('.url')) {
        const { url, icon } = readUrlFile(full);
        if (!/^(steam|com\.epicgames\.launcher|uplay|origin2?|goggalaxy|battlenet):/i.test(url)) continue;
        const key = url.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
        out.push({ name, exePath: full, lnkPath: null, isLnk: false, iconPath: full, iconFile: icon && fs.existsSync(icon) ? icon : null, store: url.split(':')[0] });
      } else if (lower.endsWith('.exe') && !shouldSkip(e.name)) {
        const key = full.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
        out.push({ name: path.basename(e.name, '.exe'), exePath: full, lnkPath: null, isLnk: false, iconPath: full });
      }
    }
  };
  for (const d of programDirs()) walk(d, 0);
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});
// Иконки программ для списка — по 40 штук за раз, как data:URL
ipcMain.handle('file-icons', async (e, list) => {
  const res = {};
  for (const it of (Array.isArray(list) ? list : []).slice(0, 60)) {
    try {
      let img = null;
      if (it.iconFile && /\.ico$/i.test(it.iconFile) && fs.existsSync(it.iconFile)) img = nativeImage.createFromPath(it.iconFile);
      if ((!img || img.isEmpty()) && it.iconPath) img = await app.getFileIcon(it.iconPath, { size: 'large' });
      if (img && !img.isEmpty()) res[it.key] = img.toDataURL();
    } catch { /* без иконки */ }
  }
  return res;
});

// ─── Запуск и учёт времени ────────────────────────────────────────────────────
// shell.openPath не бросает ошибку, а возвращает её текстом — проверяем явно.
async function openTarget(target) {
  if (!target) return 'Не указан файл для запуска';
  if (!fs.existsSync(target)) return 'Файл не найден: ' + target;
  const err = await shell.openPath(target);
  return err || null;
}

ipcMain.handle('launch-game', async (e, exePath, lnkPath) => {
  const target = (lnkPath && fs.existsSync(lnkPath)) ? lnkPath : exePath;
  const err = await openTarget(target);
  return !err;
});

// Активные сессии: gameId → { exeName, start, stopped }
const sessions = new Map();

function processRunning(exeName) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    execFile('tasklist', ['/FI', `IMAGENAME eq ${exeName}`, '/NH', '/FO', 'CSV'], { timeout: 5000, windowsHide: true, encoding: 'buffer' }, (err, stdout) => {
      if (err) return resolve(false);
      // tasklist пишет в кодировке консоли (cp866) — иначе русские имена .exe не находятся
      const want = `"${exeName.toLowerCase()}"`;
      const texts = [String(stdout)]; try { texts.push(new TextDecoder('ibm866').decode(stdout), new TextDecoder('windows-1251').decode(stdout)); } catch {}
      resolve(texts.some((t) => t.toLowerCase().includes(want)));
    });
  });
}

function trackedExeName(exePath, lnkPath) {
  let exe = exePath;
  if (exe && exe.toLowerCase().endsWith('.lnk')) exe = resolveShortcut(exe);
  if ((!exe || !exe.toLowerCase().endsWith('.exe')) && lnkPath) exe = resolveShortcut(lnkPath);
  if (!exe || !exe.toLowerCase().endsWith('.exe')) return null;
  return path.basename(exe);
}

// ─── Слежение за запущенными играми — даже если их открыли не через программу ──
// Steam сам пишет в реестр, какая игра сейчас запущена (HKCU\Software\Valve\Steam → RunningAppID).
// Остальные игры ищем по имени .exe в списке процессов. Общие имена (game.exe, launcher.exe…) не берём — легко спутать.
const GENERIC_EXE = /^(game|games|launcher|start|play|run|setup|install|unins\d*|update|updater|crashreport\w*|crashhandler\w*|unitycrashhandler\d*|ue4prereqsetup\w*|dxsetup|vc_redist\S*|python\w*|javaw?|node|cmd|explorer|steam|epicgameslauncher)\.exe$/i;
const watch = { pending: new Map(), map: null, mapT: 0, busy: false, n: 0, burstUntil: 0 };
function execText(cmd, args, timeout = 6000) {
  return new Promise((resolve) => execFile(cmd, args, { timeout, windowsHide: true, encoding: 'buffer', maxBuffer: 8 << 20 }, (err, out) => {
    if (err && !out?.length) return resolve(null);
    let t = String(out); try { t += '\n' + new TextDecoder('ibm866').decode(out); } catch {}
    resolve(t);
  }));
}
async function steamRunningAppId() {
  const out = await execText('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID']);
  const m = String(out || '').match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-f]+)/i);
  return m ? String(parseInt(m[1], 16)) : '0';
}
async function runningExes() {
  const out = await execText('tasklist', ['/NH', '/FO', 'CSV'], 8000);
  if (!out) return null;
  const set = new Set();
  for (const m of out.matchAll(/^"([^"]+\.exe)"/gim)) set.add(m[1].toLowerCase());
  return set;
}
function gameIndex() {
  if (watch.map && Date.now() - watch.mapT < 120000) return watch.map;
  const steam = new Map(), exe = new Map();
  for (const g of loadGames()) {
    if (g.store === 'steam' && /^\d+$/.test(String(g.storeId || ''))) { steam.set(String(g.storeId), g.id); continue; }
    let n = null; try { n = trackedExeName(g.exePath, g.lnkPath); } catch {}
    n = n && n.toLowerCase();
    if (n && !GENERIC_EXE.test(n) && !exe.has(n)) exe.set(n, g.id);
  }
  watch.map = { steam, exe }; watch.mapT = Date.now();
  return watch.map;
}
function watchStart(gameId, kind, extra = {}) {
  if (sessions.has(gameId)) return;
  const s = { start: Date.now(), stopped: false, watch: kind, miss: 0, ...extra };
  sessions.set(gameId, s);
  watch.pending.delete(gameId);
  const games = loadGames(); const g = games.find((x) => x.id === gameId);
  if (g) { g.lastPlayed = Date.now(); g.launched = true; saveGames(games); }
  sendToWindow('session', { id: gameId, start: s.start });
}
function watchStop(gameId) {
  const s = sessions.get(gameId); if (!s || s.stopped) return;
  s.stopped = true; sessions.delete(gameId);
  const minutes = Math.max(1, Math.round((Date.now() - s.start) / 60000));
  const updated = addPlaytime(gameId, minutes, s.start);
  sendToWindow('playtime-result', { id: gameId, minutes, tracked: true, playtime: updated?.playtime, lastPlayed: updated?.lastPlayed, days: updated?.days, sess: updated?.sess });
  sendToWindow('session', { id: gameId, start: null });
}
async function watchTick() {
  if (process.platform !== 'win32' || watch.busy) return;
  watch.busy = true;
  try {
    const idx = gameIndex();
    // Steam: какая игра запущена прямо сейчас
    const appid = await steamRunningAppId();
    for (const [gid, s] of sessions) if (s.watch === 'steam' && !s.stopped) { if (s.appid === appid) s.miss = 0; else if (++s.miss >= 2) watchStop(gid); }
    const sg = appid !== '0' ? idx.steam.get(appid) : null;
    if (sg && !sessions.has(sg)) watchStart(sg, 'steam', { appid });
    // Остальные игры — по процессам, раз в 30 секунд (и чаще сразу после запуска из программы)
    if (idx.exe.size && (watch.n++ % 2 === 0 || Date.now() < watch.burstUntil)) {
      const procs = await runningExes();
      if (procs) for (const [exe, gid] of idx.exe) {
        const s = sessions.get(gid);
        if (procs.has(exe)) { if (!s) watchStart(gid, 'exe', { exeName: exe }); else if (s.watch === 'exe') s.miss = 0; }
        else if (s && s.watch === 'exe' && !s.stopped && ++s.miss >= 2) watchStop(gid);
      }
    }
    // Игру Steam запустили из программы, но она так и не появилась — снимаем «запускается»
    for (const [gid, t] of watch.pending) if (Date.now() - t > 150000) { watch.pending.delete(gid); if (!sessions.has(gid)) sendToWindow('playtime-result', { id: gid, minutes: 0, tracked: false }); }
  } catch {} finally { watch.busy = false; }
}
let watchTimer = null;
function startGameWatch() {
  if (process.platform !== 'win32' || watchTimer) return;
  watchTimer = setInterval(() => { watchTick(); }, 15000);
  setTimeout(watchTick, 4000);
}
// Сразу после запуска из программы проверяем чаще — чтобы «Запущена» появилось быстро
function watchBurst() {
  watch.burstUntil = Date.now() + 120000; watch.mapT = 0;
  let k = 0; const t = setInterval(() => { watchTick(); if (++k >= 30 || !watch.pending.size) clearInterval(t); }, 4000);
}

// Время записывается прямо в main — не теряется, даже если окно закрыто
function addPlaytime(gameId, minutes, start = null) {
  if (!minutes || minutes < 1) return null;
  const games = loadGames();
  const g = games.find((x) => x.id === gameId);
  if (!g) return null;
  g.playtime = (g.playtime || 0) + minutes;
  g.lastPlayed = Date.now();
  g.launched = true;
  // История по дням — для графика активности и статистики (храним до ~3 лет дней с игрой)
  const d = new Date(), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  g.days = { ...(g.days || {}) };
  g.days[key] = (g.days[key] || 0) + minutes;
  const keys = Object.keys(g.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 1100))) delete g.days[k];
  // Журнал сессий: [начало, минуты] — для «самых долгих сессий» и «любимого времени»
  if (start && Number.isFinite(start)) { g.sess = [...(g.sess || []), [Math.round(start), minutes]].slice(-300); }
  saveGames(games);
  return g;
}

// Окно могло прислать старую копию игры — не теряем то, что записал main
function keepTracked(game, cur) {
  game.playtime = Math.max(game.playtime || 0, cur.playtime || 0);
  game.lastPlayed = Math.max(game.lastPlayed || 0, cur.lastPlayed || 0) || null;
  if ((cur.sess || []).length > (game.sess || []).length) game.sess = cur.sess;
  if (cur.days || game.days) {
    const days = { ...(game.days || {}) };
    for (const [k, v] of Object.entries(cur.days || {})) days[k] = Math.max(days[k] || 0, v);
    game.days = days;
  }
}

function flushActiveSessions() {
  for (const [id, s] of sessions) {
    if (s.start && !s.stopped) {
      s.stopped = true;
      addPlaytime(id, Math.round((Date.now() - s.start) / 60000), s.start);
    }
  }
}

// Разбор строки параметров запуска с учётом кавычек
function splitArgs(str) { const out = []; const re = /"([^"]*)"|(\S+)/g; let m; while ((m = re.exec(String(str || '')))) out.push(m[1] ?? m[2]); return out; }
// Запуск .exe напрямую: из папки игры и с параметрами (как делал ярлык)
function spawnExe(exe, args, cwd) {
  return new Promise((resolve) => {
    if (!fs.existsSync(exe)) return resolve('Файл не найден: ' + exe);
    const { spawn } = require('child_process');
    let done = false;
    try {
      const ch = spawn(exe, splitArgs(args), { cwd: cwd && fs.existsSync(cwd) ? cwd : path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false });
      ch.once('error', async (err) => {
        if (done) return; done = true;
        // Игра требует прав администратора (ошибка 740) — запускаем через Windows, он покажет запрос UAC
        resolve(await shell.openPath(exe) || null);
      });
      ch.once('spawn', () => { if (done) return; done = true; ch.unref(); resolve(null); });
    } catch { shell.openPath(exe).then((r) => resolve(r || null)); }
  });
}
ipcMain.handle('launch-and-track', async (e, gameId, exePath, lnkPath, launchUrl, opts = {}) => {
  if (sessions.has(gameId) && !sessions.get(gameId).stopped) return { launched: true, tracked: true, already: true };   // уже запущена — второй копии не надо
  let err = null;
  if (launchUrl && /^(steam|com\.epicgames\.launcher|uplay):\/\//i.test(launchUrl)) {
    // Игры Steam, Epic и Ubisoft запускаем через их лаунчер — так работают облачные сохранения и оверлей
    try { await shell.openExternal(launchUrl); } catch (x) { err = 'Не удалось открыть лаунчер: ' + x.message; }
  } else if (exePath && /\.exe$/i.test(exePath) && process.platform === 'win32') {
    err = await spawnExe(exePath, opts.args, opts.workDir);
  } else {
    const target = (lnkPath && fs.existsSync(lnkPath)) ? lnkPath : exePath;
    err = await openTarget(target);
  }
  if (err) return { launched: false, error: err };

  // Отметка о запуске сохраняется сразу
  const games = loadGames();
  const g = games.find((x) => x.id === gameId);
  if (g) { g.lastPlayed = Date.now(); g.launched = true; g.runs = (g.runs || 0) + 1; saveGames(games); }

  // Игры Steam: что запущено, Steam сообщает сам — время считает общий наблюдатель, а не поиск .exe
  const steamId = (String(launchUrl || '').match(/^steam:\/\/rungameid\/(\d+)/i) || [])[1];
  if (steamId && process.platform === 'win32') {
    if (!sessions.has(gameId)) { watch.pending.set(gameId, Date.now()); watchBurst(); }
    return { launched: true, tracked: true };
  }

  const exeName = trackedExeName(exePath, lnkPath);
  if (process.platform !== 'win32' || !exeName) return { launched: true, tracked: false };
  if (sessions.has(gameId)) return { launched: true, tracked: true }; // уже отслеживается

  const session = { exeName, start: null, stopped: false };
  sessions.set(gameId, session);

  (async () => {
    try {
      // Ждём появления процесса до 90 секунд (игры через лаунчеры стартуют долго)
      for (let i = 0; i < 45 && !session.stopped; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (await processRunning(exeName)) { session.start = Date.now(); sendToWindow('session', { id: gameId, start: session.start }); break; }
      }
      if (!session.start) {
        sendToWindow('playtime-result', { id: gameId, minutes: 0, tracked: false });
        return;
      }
      // Игра закрыта, только если её не видно две проверки подряд (одна может сорваться под нагрузкой)
      let miss = 0;
      while (!session.stopped && miss < 2) {
        await new Promise((r) => setTimeout(r, miss ? 3000 : 10000));
        miss = (await processRunning(exeName)) ? 0 : miss + 1;
      }
      if (session.stopped) return; // уже записано при выходе
      session.stopped = true;
      const minutes = Math.max(1, Math.round((Date.now() - session.start) / 60000));
      const updated = addPlaytime(gameId, minutes, session.start);
      sendToWindow('playtime-result', {
        id: gameId, minutes, tracked: true,
        playtime: updated?.playtime, lastPlayed: updated?.lastPlayed, days: updated?.days, sess: updated?.sess,
      });
    } finally {
      sessions.delete(gameId);
      sendToWindow('session', { id: gameId, start: null });
    }
  })();

  return { launched: true, tracked: true };
});

// Есть ли файлы запуска на диске (для «Установлено» / «Файл не найден» на плитках)
ipcMain.handle('check-paths', (e, list) => (Array.isArray(list) ? list : []).slice(0, 5000).map((p) => {
  try { return !!p && fs.existsSync(String(p)); } catch { return false; }
}));

// Какие игры сейчас запущены (для индикатора в заголовке после перезагрузки окна)
ipcMain.handle('get-sessions', () => [...sessions].filter(([, s]) => s.start && !s.stopped).map(([id, s]) => ({ id, start: s.start })));

ipcMain.handle('show-in-explorer', async (e, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  else if (filePath) shell.openPath(path.dirname(filePath));
});

// ─── Игры ─────────────────────────────────────────────────────────────────────
ipcMain.handle('get-games', () => loadGames());

ipcMain.handle('save-game', (e, game) => {
  const games = loadGames();
  const idx = games.findIndex((g) => g.id === game.id);
  if (idx >= 0) {
    // Время игры считает main — не даём старой копии из окна его уменьшить
    keepTracked(game, games[idx]);
    games[idx] = game;
  } else {
    games.push(game);
  }
  saveGames(games);
  return true;
});

// Сохранить сразу много игр одной записью (массовые операции, миграции)
ipcMain.handle('save-games-bulk', (e, list) => {
  const games = loadGames();
  const byId = new Map(games.map((g, i) => [g.id, i]));
  for (const game of list || []) {
    const idx = byId.get(game.id);
    if (idx === undefined) { byId.set(game.id, games.length); games.push(game); continue; }
    keepTracked(game, games[idx]);
    games[idx] = game;
  }
  saveGames(games);
  return true;
});

function deleteGameCovers(id) { dl.removeOldCovers(coversDir, safeId(id), null); dl.removeOldCovers(coversDir, artId(id, 'hero'), null); dl.removeOldCovers(coversDir, artId(id, 'logo'), null); }

ipcMain.handle('delete-game', (e, id) => {
  saveGames(loadGames().filter((g) => g.id !== id));
  deleteGameCovers(id);
  return true;
});

ipcMain.handle('delete-games', (e, ids) => {
  const set = new Set(ids || []);
  const rest = loadGames().filter((g) => !set.has(g.id));
  saveGames(rest);
  // Картинки, которые после объединения дублей перешли к другой игре, не трогаем
  const used = new Set(rest.flatMap((g) => [g.cover, g.hero, g.logo]).filter(Boolean).map((u) => { try { return path.basename(dl.coverUrlToPath(u) || ''); } catch { return ''; } }));
  for (const id of set) {
    for (const pre of [safeId(id), artId(id, 'hero'), artId(id, 'logo')]) {
      let files = []; try { files = fs.readdirSync(coversDir); } catch {}
      for (const f of files) if ((f.startsWith(pre + '-') || f.startsWith(pre + '.')) && !used.has(f) && !f.endsWith('.part')) { try { fs.unlinkSync(path.join(coversDir, f)); } catch {} }
    }
  }
  return true;
});

ipcMain.handle('update-playtime', (e, id, minutes) => { addPlaytime(id, minutes); return true; });

// ─── Резервная копия ──────────────────────────────────────────────────────────
ipcMain.handle('export-library', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить резервную копию библиотеки',
    defaultPath: `game-library-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    const games = loadGames();
    const settings = loadSettings();
    const covers = {}, heroes = {}, logos = {};
    for (const g of games) {
      const p = dl.coverUrlToPath(g.cover);
      if (p && fs.existsSync(p)) {
        covers[g.id] = { ext: path.extname(p).slice(1) || 'jpg', data: fs.readFileSync(p).toString('base64') };
      }
      const h = dl.coverUrlToPath(g.hero);
      if (h && fs.existsSync(h)) heroes[g.id] = { ext: path.extname(h).slice(1) || 'jpg', data: fs.readFileSync(h).toString('base64') };
      const lg = dl.coverUrlToPath(g.logo);
      if (lg && fs.existsSync(lg)) logos[g.id] = { ext: path.extname(lg).slice(1) || 'png', data: fs.readFileSync(lg).toString('base64') };
    }
    // Ключи API в копию не кладём
    fs.writeFileSync(result.filePath, JSON.stringify({ version: 2, exportedAt: Date.now(), games, cats: settings.cats || [], covers, heroes, logos }));
    return { ok: true, path: result.filePath, count: games.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('import-library', async (e, mode) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите файл резервной копии',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { ok: false };
  try {
    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    if (!Array.isArray(backup.games)) return { ok: false, error: 'Неверный формат файла' };

    const games = (mode === 'replace') ? [] : loadGames();
    const settings = loadSettings();
    const cats = settings.cats || [];

    let added = 0;
    for (const g of backup.games) {
      if (!g || !g.id) continue;
      if (mode !== 'replace' && games.some((x) => x.id === g.id || ((x.lnkPath || x.exePath) && (x.lnkPath || x.exePath) === (g.lnkPath || g.exePath)))) continue;
      const c = backup.covers?.[g.id];
      if (c && c.data) {
        try {
          const ext = String(c.ext || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
          const dest = path.join(coversDir, `${safeId(g.id)}-${Date.now()}.${ext}`);
          fs.writeFileSync(dest, Buffer.from(c.data, 'base64'));
          dl.removeOldCovers(coversDir, safeId(g.id), dest);
          g.cover = dl.toFileUrl(dest);
        } catch {}
      } else if (g.cover && g.cover.startsWith('file:')) {
        g.cover = null; // локальный путь с другого ПК всё равно не откроется
      }
      const hh = backup.heroes?.[g.id];
      if (hh && hh.data) {
        try {
          const ext = String(hh.ext || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
          const dest = path.join(coversDir, `${artId(g.id, 'hero')}-${Date.now()}.${ext}`);
          fs.writeFileSync(dest, Buffer.from(hh.data, 'base64'));
          dl.removeOldCovers(coversDir, artId(g.id, 'hero'), dest);
          g.hero = dl.toFileUrl(dest);
        } catch {}
      } else if (g.hero && String(g.hero).startsWith('file:')) g.hero = null;
      const lb = backup.logos?.[g.id];
      if (lb && lb.data) {
        try {
          const ext = String(lb.ext || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
          const dest = path.join(coversDir, `${artId(g.id, 'logo')}-${Date.now()}.${ext}`);
          fs.writeFileSync(dest, Buffer.from(lb.data, 'base64'));
          g.logo = dl.toFileUrl(dest);
        } catch {}
      } else if (g.logo && String(g.logo).startsWith('file:')) g.logo = null;
      games.push(g);
      added++;
    }

    for (const c of backup.cats || []) {
      if (!cats.some((x) => x.id === c.id || x.name === c.name)) cats.push(c);
    }

    saveGames(games);
    saveSettingsFile({ ...settings, cats });
    return { ok: true, count: added, total: games.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── Настройки ────────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => {
  const s = loadSettings();
  const a = getAutostart();
  // Реальное состояние автозапуска берём из системы
  return { ...s, autostart: a.enabled, autostartSupported: a.supported, closeToTray: s.closeToTray ?? !!s.autostart };
});

ipcMain.handle('save-settings', (e, settings) => {
  const clean = { ...settings };
  delete clean.autostartSupported;
  const before = loadSettings();
  saveSettingsFile(clean);
  if ('autostart' in clean) applyAutostart(clean.autostart);
  if (before.autoUpdate !== clean.autoUpdate) scheduleUpdateChecks();
  return true;
});

// ─── Авто-данные ──────────────────────────────────────────────────────────────
const { enrichGame, rawgSearch, steamStoreInfo, gameExtra, setSearchLog } = require('./enricher');
// Журнал поиска игр в Steam по названию (для игр Epic, GOG и др.): %APPDATA%\Game Library\steam-search.log
{
  const logFile = path.join(userData, 'steam-search.log');
  try { if (fs.statSync(logFile).size > 300e3) fs.renameSync(logFile, logFile + '.old'); } catch {}
  setSearchLog((s) => fs.appendFile(logFile, `${new Date().toLocaleString('ru-RU')}  ${s}\n`, () => {}));
}
const ai = require('./ai');

ipcMain.handle('test-ai', async (e, aiSettings) => ai.testProvider(aiSettings));

function buildAiSettings(settings) {
  return {
    aiProvider: settings.aiProvider || 'none',
    geminiKey: settings.geminiKey || '',
    groqKey: settings.groqKey || '',
    claudeKey: settings.claudeKey || '',
  };
}

// Картинки игры из кэша самого Steam (то, что Steam показывает в своей библиотеке)
function steamLocalArt(appid) {
  const root = steamRoot(); if (!root || !/^\d+$/.test(String(appid || ''))) return null;
  const cache = path.join(root, 'appcache', 'librarycache');
  const files = [];
  const add = (f) => { try { const st = fs.statSync(f); if (st.isFile() && st.size > 2000) files.push({ f, n: path.basename(f).toLowerCase(), size: st.size }); } catch {} };
  try { for (const n of fs.readdirSync(cache)) if (n.startsWith(appid + '_')) add(path.join(cache, n)); } catch {}   // старый вид: 123_library_hero.jpg
  const walk = (d, depth) => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const f = path.join(d, e.name); if (e.isDirectory()) { if (depth < 2) walk(f, depth + 1); } else add(f); } };
  walk(path.join(cache, String(appid)), 0);   // новый вид: 123/<хеш>/library_600x900.jpg
  const pick = (re) => files.filter((x) => re.test(x.n.replace(/^\d+_/, ''))).sort((a, b) => b.size - a.size)[0]?.f || null;
  const res = { cover: pick(/^library_(600x900|capsule)(_2x)?\.(jpg|png)$/), hero: pick(/^library_hero(_2x)?\.(jpg|png)$/), logo: pick(/^(logo|library_logo)(_2x)?\.png$/) };
  return res.cover || res.hero || res.logo ? res : null;
}

// opts: { slug, downloadCover }
ipcMain.handle('enrich-game', async (e, gameId, gameName, opts = {}) => {
  const settings = loadSettings();
  try {
    return await enrichGame(gameName, safeId(gameId), coversDir, {
      rawgKey: settings.rawgKey || '',
      sgdbKey: settings.sgdbKey || '',
      aiSettings: buildAiSettings(settings),
      rawgSlug: opts.slug || null,
      downloadCover: opts.downloadCover === true,
      downloadHero: opts.downloadHero === true,
      downloadLogo: opts.downloadLogo === true,
      steamAppId: /^\d+$/.test(String(opts.steamAppId || '')) ? String(opts.steamAppId) : null,
      steamLocal: /^\d+$/.test(String(opts.steamAppId || '')) ? steamLocalArt(String(opts.steamAppId)) : null,
    });
  } catch (err) {
    return { success: false, log: ['❌ Ошибка: ' + err.message] };
  }
});

// Подробности для страницы игры: отзывы, Metacritic, скриншоты, трейлеры, описание с картинками
ipcMain.handle('game-extra', async (e, g = {}) => {
  try {
    const st = loadSettings();
    return await gameExtra({ appid: /^\d+$/.test(String(g.steamAppId || '')) ? String(g.steamAppId) : null, name: String(g.name || '').slice(0, 200) || null, year: /^\d{4}$/.test(String(g.year || '')) ? String(g.year) : null, rawgKey: st.rawgKey || '' });
  } catch (err) { return { error: err.message }; }
});

// Русское описание для игры, у которой сейчас английское: магазин Steam, иначе перевод через AI (если настроен)
ipcMain.handle('ru-description', async (e, g = {}) => {
  try {
    const st = await steamStoreInfo({ appid: /^\d+$/.test(String(g.steamAppId || '')) ? String(g.steamAppId) : null, name: g.steamAppId ? null : g.name });
    if (st?.ru && st.description) return { description: st.description, from: 'steam', genre: st.genre, developer: st.developer, year: st.year };
    const aiS = buildAiSettings(loadSettings());
    if (g.description && ai.aiAvailable(aiS)) {
      const ru = await ai.translateToRussian(g.description, aiS);
      if (ru) return { description: ru, from: 'ai' };
    }
    return { description: null };
  } catch (err) { return { description: null, error: err.message }; }
});

// Проверка ключей RAWG и SteamGridDB (кнопка в настройках)
ipcMain.handle('test-art-keys', async (e, keys = {}) => {
  const out = { rawg: 'none', sgdb: 'none' };
  try {
    if (keys.rawgKey) {
      const r = await dl.fetchJson(`https://api.rawg.io/api/games?key=${encodeURIComponent(keys.rawgKey)}&search=portal&page_size=1`);
      out.rawg = r.status === 200 ? 'ok' : (r.status === 401 || r.status === 403) ? 'bad' : 'err';
    }
  } catch { out.rawg = 'err'; }
  try {
    if (keys.sgdbKey) {
      const r = await dl.fetchJson('https://www.steamgriddb.com/api/v2/search/autocomplete/portal', { Authorization: `Bearer ${keys.sgdbKey}` });
      out.sgdb = r.status === 200 && r.body?.success ? 'ok' : (r.status === 401 || r.status === 403) ? 'bad' : 'err';
    }
  } catch { out.sgdb = 'err'; }
  return out;
});

ipcMain.handle('rawg-search', async (e, query) => {
  const settings = loadSettings();
  const r = await rawgSearch(query, settings.rawgKey || '');
  return r.results || [];
});

