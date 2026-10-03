'use strict';
// ─── Запуск ──────────────────────────────────────────────────────────────────
async function init() {
  settings = (await api.getSettings()) || {};
  cats = settings.cats || [];
  if (settings.theme !== 'light') settings.theme = 'dark';   // старые «Классика/Модерн» → тёмная
  S.group = GROUPS[settings.group] ? settings.group : 'recent';
  games = await api.getGames();
  S.selId = byId(settings.lastSel) ? settings.lastSel : null;
  $('#ver').textContent = 'v' + (await api.getAppVersion());
  applyTheme();
  await migrateGenres();
  for (const s of await api.getSessions()) running.set(s.id, s.start);
  document.body.dataset.input = INPUT.mode;
  refreshKeyHints();
  render();

  linkStores().then(() => autoStoreSync()).then(refreshExists).then(() => setTimeout(() => steamFixSync().then(ruDescSync).then(extraSync), 3000));
  setInterval(() => autoStoreSync().then(refreshExists), 10 * 60 * 1000);
  // При возврате в окно — не чаще раза в минуту (большая библиотека иначе тормозит на каждом Alt+Tab)
  addEventListener('focus', () => { clearTimeout(refreshExists.t); if (Date.now() - (refreshExists.last || 0) < 60000) return;
    refreshExists.t = setTimeout(() => { refreshExists.last = Date.now(); autoStoreSync().then(refreshExists); }, 800); });
  api.storeIcons?.().then((r) => { Object.assign(STORE_ICONS, r || {}); if (Object.keys(STORE_ICONS).length) render(); }).catch(() => {});
  api.onUpdateStatus(handleUpdate);
  api.getUpdateInfo().then((i) => { updateInfo = i; if (i.state) handleUpdate(i.state); });
  api.onOpenFullscreen(() => openBig());
  api.onSession(({ id, start }) => {
    if (start) running.set(id, start); else running.delete(id);
    render();
  });
  api.onPlaytimeResult((data) => {
    if (!data?.tracked || !data.minutes) return;
    const g = byId(data.id); if (!g) return;
    g.playtime = data.playtime ?? (g.playtime || 0) + data.minutes;
    g.lastPlayed = data.lastPlayed || Date.now();
    if (data.days) g.days = data.days;
    if (data.sess) g.sess = data.sess;
    running.delete(data.id);
    render();
    sfx('success');
    toast(`⏱ ${g.name}: +${exactTime(data.minutes)}`, 'ok');
  });
  setInterval(tickRunning, 1000);
  api.onFullscreenChanged?.((on) => { S.fs = !!on; if (settings.fullscreen !== S.fs) { settings.fullscreen = S.fs; saveSettingsQuiet(); } renderModeHost(); if (S.big.open) renderBig(); });
  // Полный экран восстанавливаем до входа в Big Picture — иначе при выходе из него он бы выключился
  if (settings.fullscreen) { S.fs = true; api.setFullscreen?.(true); }
  if (settings.viewMode === 'compact') openBig({ quiet: true });
  else if (settings.viewMode === 'bp') openBig({ quiet: true, bp: true });
  renderModeHost();
  addEventListener('beforeunload', () => { saveSettingsQuiet(); });
  gpInit();
  if (!settings.onboarded && !games.length) setTimeout(wizardDlg, 300);
  const notice = await api.getLoadNotice();
  if (notice) setTimeout(() => toast(notice, 'err'), 600);
}
init();
// Перетаскивание файлов на окно не должно уводить со страницы программы
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => e.preventDefault());

// Прокрутить только свой контейнер (scrollIntoView двигал бы и весь экран ТВ-режима — тогда «уплывала» нижняя панель)
function scrollInside(el, box, block = 'nearest') {
  if (!el || !box) return;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  let d = 0;
  if (block === 'center') d = (r.top + r.height / 2) - (b.top + b.height / 2);
  else if (r.top < b.top + 12) d = r.top - b.top - 12;
  else if (r.bottom > b.bottom - 12) d = r.bottom - b.bottom + 12;
  if (d) box.scrollBy({ top: d, behavior: 'smooth' });
}
// Экран компактного и ТВ-режима сам по себе прокручиваться не должен
(() => { const big = document.getElementById('big'); if (!big) return;
  big.addEventListener('scroll', (e) => { const t = e.target; if ((t === big || t.classList?.contains('bp') || t.classList?.contains('mn')) && (t.scrollTop || t.scrollLeft)) { t.scrollTop = 0; t.scrollLeft = 0; } }, true); })();
