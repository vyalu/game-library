const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Игры
  getGames: () => ipcRenderer.invoke('get-games'),
  saveGame: (game) => ipcRenderer.invoke('save-game', game),
  saveGamesBulk: (list) => ipcRenderer.invoke('save-games-bulk', list),
  deleteGame: (id) => ipcRenderer.invoke('delete-game', id),
  deleteGames: (ids) => ipcRenderer.invoke('delete-games', ids),
  getLoadNotice: () => ipcRenderer.invoke('get-load-notice'),
  // Файлы
  pickExe: () => ipcRenderer.invoke('pick-exe'),
  resolveShortcut: (p) => ipcRenderer.invoke('resolve-shortcut', p),
  pickImage: (gameId, kind) => ipcRenderer.invoke('pick-image', gameId, kind),
  downloadImage: (url, gameId, kind) => ipcRenderer.invoke('download-image', url, gameId, kind),
  setCoverFromUrl: (gameId, url, kind) => ipcRenderer.invoke('set-cover-from-url', gameId, url, kind),
  // Сканирование
  scanFolder: () => ipcRenderer.invoke('scan-folder'),
  scanDesktop: () => ipcRenderer.invoke('scan-desktop'),
  // Запуск
  launchGame: (exePath, lnkPath) => ipcRenderer.invoke('launch-game', exePath, lnkPath),
  launchAndTrack: (id, exePath, lnkPath, launchUrl, opts) => ipcRenderer.invoke('launch-and-track', id, exePath, lnkPath, launchUrl, opts),
  repairPaths: (list) => ipcRenderer.invoke('repair-paths', list),
  shortcutInfo: (lnk) => ipcRenderer.invoke('shortcut-info', lnk),
  onPlaytimeResult: (cb) => ipcRenderer.on('playtime-result', (_, data) => cb(data)),
  showInExplorer: (p) => ipcRenderer.invoke('show-in-explorer', p),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  checkPaths: (list) => ipcRenderer.invoke('check-paths', list),
  padInfo: () => ipcRenderer.invoke('pad-info'),
  padsNative: () => ipcRenderer.invoke('pads-native'),
  onPadsNative: (cb) => ipcRenderer.on('pads-native', (_, l) => cb(l)),
  testArtKeys: (keys) => ipcRenderer.invoke('test-art-keys', keys),
  checkGames: (list) => ipcRenderer.invoke('check-games', list),
  uninstallInfo: (g) => ipcRenderer.invoke('uninstall-info', g),
  uninstallGame: (g, method) => ipcRenderer.invoke('uninstall-game', g, method),
  linkStores: (list) => ipcRenderer.invoke('link-stores', list),
  steamPlaytime: () => ipcRenderer.invoke('steam-playtime'),
  listStoreGames: () => ipcRenderer.invoke('list-store-games'),
  storeIcons: () => ipcRenderer.invoke('store-icons'),
  listPrograms: () => ipcRenderer.invoke('list-programs'),
  fileIcons: (list) => ipcRenderer.invoke('file-icons', list),
  onSession: (cb) => ipcRenderer.on('session', (_, data) => cb(data)),
  updatePlaytime: (id, mins) => ipcRenderer.invoke('update-playtime', id, mins),
  // Резервная копия
  exportLibrary: () => ipcRenderer.invoke('export-library'),
  importLibrary: (mode) => ipcRenderer.invoke('import-library', mode),
  // Авто-данные
  ruDescription: (g) => ipcRenderer.invoke('ru-description', g),
  gameExtra: (g) => ipcRenderer.invoke('game-extra', g),
  enrichGame: (gameId, gameName, opts) => ipcRenderer.invoke('enrich-game', gameId, gameName, opts || {}),
  rawgSearch: (query) => ipcRenderer.invoke('rawg-search', query),
  // Настройки
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  testAi: (aiSettings) => ipcRenderer.invoke('test-ai', aiSettings),
  // Обновления
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  updateFromFile: () => ipcRenderer.invoke('update-from-file'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, data) => cb(data)),
  // Трей
  onOpenFullscreen: (cb) => ipcRenderer.on('open-fullscreen', () => cb()),
  // Окно
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toTray: () => ipcRenderer.send('window-to-tray'),
  quit: () => ipcRenderer.send('app-quit'),
  setFullscreen: (on) => ipcRenderer.invoke('set-fullscreen', on),
  onFullscreenChanged: (cb) => ipcRenderer.on('fullscreen-changed', (_, on) => cb(on)),
});
