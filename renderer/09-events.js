'use strict';
// ─── Делегирование кликов ────────────────────────────────────────────────────
const QUIET = new Set(['row', 'play', 'fav', 'done', 'win-min', 'win-max', 'win-close', 'big-open', 'big-play', 'big-fav', 'big-tab',
  'big-sort', 'big-view', 'tile-set', 'big-exit', 'big-info', 'big-sheet', 'big-sheet-run', 'big-sheet-close', 'big-tile-play', 'big-tile-more', 'big-home', 'big-recent', 'big-back', 'big-page-act', 'open-pal', 'pal-run', 'pal-close',
  'open-big', 'set-mode', 'bp-tile', 'bp-menu', 'bp-menu-close', 'bp-menu-run', 'desc-toggle', 'toggle-fs', 'toggle-pop', 'close-pop', 'game-menu', 'lib-menu', 'filter-menu', 'toggle-theme', 'pop-toggle', 'dlg-close', 'lb', 'lb-img', 'lb-my', 'gx-scroll']);
let lastRowClick = { id: null, t: 0 };
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-url]');
  if (a) { e.preventDefault(); window.open(a.dataset.url, '_blank'); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, arg = el.dataset.arg;
  if (!QUIET.has(act)) sfx('select');
  switch (act) {
    case 'win-min': return api.minimize();
    case 'win-max': return api.maximize();
    case 'win-close': return api.close();
    case 'toggle-theme': sfx('select'); return toggleTheme();
    case 'open-update': return updateDlg();
    case 'open-pal': return S.pal.open ? closePal() : openPal();
    case 'pal-close': if (e.target === el) closePal(); return;
    case 'pal-run': S.pal.i = +arg; return palRun(e.shiftKey);
    case 'osk': { const o = S.pal.osk; if (!o) return; o.zone = 'kb'; o.r = +el.dataset.r; o.c = +el.dataset.c; const [k] = oskRows()[o.r][o.c]; oskDraw(); return oskType(k); }
    case 'filter': e.stopPropagation(); if (S.selMode) S.selected.clear(); closeDlg(); sfx('tab'); return setFilter(arg, el.dataset.label);
    case 'filter-menu': return menuAt(el, filterMenuItems(), 'left');
    case 'lb': return lbFromGame(id, +arg);
    case 'lb-my': return lbMy(id, +arg);
    case 'open-stats': return statsDlg();
    case 'open-stats-today': ST.per = 'today'; return statsDlg();
    case 'st-game': { closeDlg(); if (S.big.open) return openPage(id); if (S.filter !== 'all' && !filterList(S.filter).some((g) => g.id === id)) setFilter('all'); return select(id, { scroll: true }); }
    case 'gx-scroll': { const st = el.parentElement.querySelector('.gx-media'); if (st) st.scrollBy({ left: +arg * st.clientWidth * 0.8, behavior: 'smooth' }); return; }
    case 'lb-img': return lbOpen([{ f: arg }], 0);
    case 'desc-toggle': { const box = el.closest('.desc'); const open = !DESC_OPEN.has(id); open ? DESC_OPEN.add(id) : DESC_OPEN.delete(id);
      box?.classList.toggle('open', open); if (open) box?.querySelectorAll('[data-src]').forEach((m) => { m.src = m.dataset.src; m.removeAttribute('data-src'); });
      el.querySelector('span').textContent = open ? 'Свернуть' : 'Читать полностью';
      el.querySelector('i').className = 'ph ph-caret-' + (open ? 'up' : 'down'); if (!open && box) { const sc = box.closest('#bpage, #main'); if (sc) scrollInside(box, sc, 'nearest'); } return; }
    case 'list-size': { const i = LSIZES.findIndex((x) => x[0] === listSize()); return setListSize(LSIZES[(i + 1) % LSIZES.length][0]); }
    case 'cycle-group': {
      const keys = Object.keys(GROUPS); S.group = keys[(keys.indexOf(S.group) + 1) % keys.length];
      settings.group = S.group; saveSettingsQuiet(); render(); return toast('Группировка: ' + GROUPS[S.group][0].toLowerCase());
    }
    case 'lib-menu': return menuAt(el, libMenuItems());
    case 'big-menu': return menuAt(el, bigMenuItems());
    case 'toggle-pop': S.pop = !S.pop; sfx(S.pop ? 'open' : 'close'); renderSideFoot(); return renderPop();
    case 'close-pop': S.pop = false; sfx('close'); renderSideFoot(); return renderPop();
    case 'pop-toggle':
      if (arg === 'light') toggleTheme();
      else if (arg === 'sound') toggleSound();
      else if (arg === 'rumble') { settings.rumble = settings.rumble === false; saveSettingsQuiet(); renderPop(); toast(settings.rumble ? 'Вибрация включена' : 'Вибрация выключена'); if (settings.rumble) rumble('select'); }
      return;
    case 'row': {
      if (S.selMode) return toggleSelect(id);
      const now = Date.now(), dbl = lastRowClick.id === id && now - lastRowClick.t < 400;
      lastRowClick = { id, t: now };
      if (dbl) return launch(id);
      if (id !== S.selId) { sfx('move'); select(id); }
      return;
    }
    case 'play': e.stopPropagation(); return launch(id);
    case 'fav': return toggleFav(id);
    case 'done': return toggleCompleted(id);
    case 'folder': return openFolder(id);
    case 'game-menu': return menuAt(el, gameMenuItems(byId(id)));
    case 'enrich': return enrichDlg(id);
    case 'cover': return coverDlg(id);
    case 'edit': return editDlg(id);
    case 'hide': return toggleHidden(id);
    case 'delete': return deleteGames([id]);
    case 'store-sync': return autoStoreSync(true);
    case 'store-unignore': settings.storeIgnore = []; el.remove(); return saveSettingsQuiet().then(() => autoStoreSync(true));
    case 'add-game': return addDlg();
    case 'scan-folder': return scan('folder');
    case 'scan-desktop': return scan('desktop');
    case 'open-big': return openBig();
    case 'set-mode': return switchMode(arg);
    case 'bp-tile': { const r = +el.dataset.r, c = +el.dataset.c; const sh = bpShelves(); const key = sh[r]?.[0]; if (!key) return;
      if (key === 'tabs') { S.big.bpr = r; bpSetTab(bpCollections()[c][0]); return bpFocus(); }
      const same = S.big.bpr === r && (S.big.bpc[key] || 0) === c; S.big.bpr = r; S.big.bpc[key] = c;
      if (same) { const g = bpCurrent(); return g && openPage(g.id); } sfx('move'); return bpFocus(); }
    case 'bp-menu': return bpMenuToggle();
    case 'bp-menu-close': return bpMenuToggle(false);
    case 'bp-menu-run': S.big.mi = +arg; return bigA();
    case 'bp-menu-run-cur': return bigA();
    case 'bp-back': return bigB();
    case 'toggle-fs': return toggleFullscreen();
    case 'pad-dlg': return padDlg();
    case 'pads-pop': {
      const cur = curPad(), list = [...new Map(allPads().map((p) => [padKey(p), p])).values()];
      return menuAt(el, [{ head: 'Подключённые геймпады' },
        ...list.map((p) => ({ label: padName(p), icon: padStyle(p) === 'ps' ? 'ph ph-game-controller' : 'ph-fill ph-game-controller', on: cur && padKey(cur) === padKey(p),
          count: cur && padKey(cur) === padKey(p) ? 'управляет' : '', run: () => padSignal(p) })),
        '-', { label: 'Нажмите на геймпад в списке — он завибрирует', icon: 'ph ph-vibrate', disabled: true, run: () => {} },
        { label: 'Названия и вибрация…', icon: 'ph ph-gear-six', run: () => padDlg() }]);
    }
    case 'steam-sync': return syncSteamTime(true);
    case 'check-games': return checkDlg();
    case 'miss-dismiss': S.missDismissed = true; return renderSideTop();
    case 'uninstall': return uninstallDlg(id);
    case 'wizard': return wizardDlg();
    case 'open-settings': S.pop = false; renderPop(); renderSideFoot(); return settingsDlg();
    case 'open-cats': return catsDlg();
    case 'dlg-close': return closeDlg();
    case 'sel-all': currentList().forEach((g) => S.selected.add(g.id)); return render();
    case 'sel-exit': return setSelMode(false);
    case 'sel-cat': return S.selected.size ? assignCatDlg([...S.selected]) : toast('Сначала выберите игры');
    case 'sel-enrich': return S.selected.size ? batchDlg([...S.selected]) : toast('Сначала выберите игры');
    case 'sel-delete': return S.selected.size ? deleteGames([...S.selected]).then(() => { if (!S.selected.size) setSelMode(false); }) : toast('Сначала выберите игры');
    case 'sel-hide':
      if (!S.selected.size) return toast('Сначала выберите игры');
      return (async () => { const l = [...S.selected].map(byId).filter(Boolean); l.forEach((g) => { g.hidden = !g.hidden; }); await api.saveGamesBulk(l); S.selMode = false; S.selected.clear(); render(); toast('Готово'); })();
    // компактный режим
    case 'big-tab': S.big.tab = arg; Object.assign(S.big, { idx: 0, sort: null, sheet: false, zone: 'grid', page: null }); sfx('tab'); return renderBig();
    case 'big-sort': return bigSortCycle();
    case 'big-view': S.big.viewOpen = !S.big.viewOpen; sfx(S.big.viewOpen ? 'open' : 'close'); return renderBig();
    case 'tile-set': sfx('select'); return setTile({ [el.dataset.k]: el.dataset.k === 'cols' ? +arg : arg });
    case 'big-home': Object.assign(S.big, { page: null, sheet: false, zone: 'grid' }); sfx('back'); return renderBig();
    case 'big-open': { const g = bigList()[+arg]; S.big.idx = +arg; S.big.zone = 'grid'; return g && openPage(g.id); }
    case 'big-tile-play': { e.stopPropagation(); const g = bigList()[+arg]; S.big.idx = +arg; S.big.zone = 'grid'; renderBig(); return g && launch(g.id); }
    case 'big-tile-more': { e.stopPropagation(); const tg = bigList()[+arg]; Object.assign(S.big, { idx: +arg, zone: 'grid', sheet: !!tg, sheetId: tg?.id, si: 0 }); sfx('open'); return renderBig(); }
    case 'big-recent': { const i = recentList().findIndex((x) => x.id === arg); if (i >= 0) { S.big.zone = 'side'; S.big.ri = i; } return openPage(arg); }
    case 'big-back': return closePage();
    case 'big-page-act': { const g = byId(S.big.page); S.big.pi = +arg; const a = g && pageActs(g)[+arg]; if (a) { if (+arg) sfx('select'); a.run(); } return; }
    case 'big-enrich': return S.big.page && quickEnrich(S.big.page);
    case 'big-play': return bigA();
    case 'big-fav': { const g = bigCurrent(); if (g) toggleFav(g.id); return; }
    case 'big-info': return bigInfo();
    case 'big-exit': return closeBig();
    case 'big-options': return bigOptions();
    case 'big-sheet': S.big.si = +arg; return bigA();
    case 'big-sheet-run': return bigA();
    case 'big-sheet-close': S.big.sheet = false; sfx('close'); return renderBig();
  }
});
// Логотип не загрузился — показываем название текстом
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.matches('.d-logo, .pg-logo') && t.parentNode) t.parentNode.textContent = t.alt;
}, true);
let mouseAcc = 0;
document.addEventListener('mousemove', (e) => {
  if (INPUT.mode === 'kbd') return;
  mouseAcc += Math.abs(e.movementX) + Math.abs(e.movementY);
  if (mouseAcc > 40) { mouseAcc = 0; setInputMode('kbd'); }
});
document.addEventListener('mouseover', (e) => {
  const it = e.target.closest('#pal .pal-item');
  if (it && +it.dataset.arg !== S.pal.i) { S.pal.i = +it.dataset.arg; $('#pal-res .pal-item.on')?.classList.remove('on'); it.classList.add('on'); }
});
document.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('[data-id]');
  if (!el || S.big.open || dlgOpen()) return;
  const g = byId(el.dataset.id); if (!g) return;
  e.preventDefault();
  openMenu(e.clientX, e.clientY, gameMenuItems(g));
});
document.addEventListener('input', (e) => { if (e.target?.classList?.contains('notes-ta')) notesSave(e.target.dataset.id, e.target.value); });
document.addEventListener('focusout', (e) => { if (e.target?.classList?.contains('notes-ta') && NOTES.id === e.target.dataset.id) notesSave(e.target.dataset.id, e.target.value, true); });
document.addEventListener('input', (e) => {
  if (e.target.id === 'tile-size') { settings.tile = { ...tileView(), size: +e.target.value }; const g = $('#bgrid .bgrid'); if (g) g.setAttribute('style', tileGridStyle()); clearTimeout(setTile.t); setTile.t = setTimeout(saveSettingsQuiet, 400); return; }
  if (e.target.id === 'pal-q') { S.pal.q = e.target.value; S.pal.i = 0; renderPalRes(); }
});
addEventListener('resize', () => { if (S.big.open) renderBig(); });
// Ctrl + колесо — размер плиток в компактном режиме
addEventListener('wheel', (e) => {
  if (!e.ctrlKey || !S.big.open || S.big.page || !e.target.closest('#bgrid')) return;
  e.preventDefault();
  const v = tileView(); if (v.cols) return;
  const size = Math.max(110, Math.min(300, v.size + (e.deltaY < 0 ? 10 : -10)));
  if (size !== v.size) { settings.tile = { ...v, size }; const g = $('#bgrid .bgrid'); if (g) g.setAttribute('style', tileGridStyle()); const r = $('#tile-size'); if (r) r.value = size; clearTimeout(setTile.t); setTile.t = setTimeout(saveSettingsQuiet, 400); }
}, { passive: false });
document.addEventListener('keydown', (e) => {
  setInputMode('kbd');
  const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
  const ctrl = e.ctrlKey || e.metaKey;
  if (S.lb) {
    e.preventDefault();
    if (k === 'Escape' || k === 'Backspace') lbClose();
    else if (k === 'ArrowLeft' || low === 'q' || low === 'й') lbStep(-1);
    else if (k === 'ArrowRight' || low === 'e' || low === 'у') lbStep(1);
    else if (k === ' ' || k === 'Enter') lbToggle();
    return;
  }
  if (ctrl && (low === 'k' || low === 'л' || low === 'f' || low === 'а')) { e.preventDefault(); return S.pal.open ? closePal() : openPal(); }
  // Пишем заметку — горячие клавиши (F, I, Q, E, Enter…) не срабатывают; Esc — выйти из поля
  if (e.target?.classList?.contains('notes-ta')) { if (k === 'Escape') { e.preventDefault(); e.target.blur(); } return; }
  if (S.pal.open) {
    // Начали печатать на настоящей клавиатуре — экранная больше не нужна
    if (S.pal.osk && (k.length === 1 || k === 'Backspace')) { S.pal.osk = null; $('#pal .osk')?.remove(); renderPalFoot(); renderPalRes(); const inp = $('#pal-q'); inp?.focus(); return; }
    if (k === 'ArrowDown') { e.preventDefault(); palMove(1); }
    else if (k === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    else if (k === 'Enter') { e.preventDefault(); palRun(e.shiftKey); }
    else if (k === 'Escape') { e.preventDefault(); closePal(); }
    return;
  }
  if (S.big.open && !dlgOpen()) {
    const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (dirs[k]) bigDir(dirs[k]);
    else if (k === ' ' && S.big.bp && !S.big.menu && !S.big.sheet) bigInfo();   // пробел — опции, как ≡ на геймпаде
    else if (k === 'Enter' || k === ' ') bigA();
    else if (k === 'Escape' || k === 'Backspace') {
      if (S.big.bp && !S.big.sheet && !S.big.page && !S.big.menu) { if (k === 'Escape') bpMenuToggle(true); }
      else if (!S.big.bp && !S.big.sheet && !S.big.page && S.big.zone === 'grid' && k === 'Escape' && S.fs) toggleFullscreen(); else bigB(); }
    else if (k === 'F11') toggleFullscreen();
    else if (ctrl && e.shiftKey && (low === 'b' || low === 'и')) { if (S.big.bp) closeBig(); else openBig({ bp: true }); }
    else if (ctrl && (low === 'b' || low === 'и')) { if (S.big.bp) bpMenuToggle(); else closeBig(); }
    else if (k === 'PageUp' || low === 'q' || low === 'й') bigTab(-1);
    else if (k === 'PageDown' || low === 'e' || low === 'у') bigTab(1);
    else if (low === 'f' || low === 'а' || low === 'x' || low === 'ч') { const g = bigCurrent(); if (g) toggleFav(g.id); }
    else if (low === 'i' || low === 'ш' || low === 'y' || low === 'н') bigInfo();
    else if (S.big.bp && (k === 'Tab' || k === 'Home')) bpMenuToggle();
    else if (S.big.bp && (k === 'ContextMenu' || (k === 'F10' && e.shiftKey))) bigInfo();
    else if (low === '/') openPal();
    else return;
    e.preventDefault(); return;
  }
  if (k === 'Escape') {
    if ($('#menu')) return closeMenu();
    if (dlgOpen()) return closeDlg();
    if (S.pop) { S.pop = false; sfx('close'); renderSideFoot(); return renderPop(); }
    if (S.selMode) return setSelMode(false);
  }
  if (k === 'F11') { e.preventDefault(); return toggleFullscreen(); }
  if (ctrl && e.shiftKey && (low === 'b' || low === 'и')) { e.preventDefault(); return openBig({ bp: true }); }
  if (ctrl && (low === 'b' || low === 'и')) { e.preventDefault(); return openBig(); }
  if (k === 'Escape' && S.fs && !dlgOpen() && !$('#menu')) return toggleFullscreen();
  if (dlgOpen() || $('#menu') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (k === '/') { e.preventDefault(); return openPal(); }
  if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); return moveSel(k === 'ArrowDown' ? 1 : -1); }
  if (k === 'Enter' && !e.target.closest('button')) { const g = selGame(); if (g) { e.preventDefault(); launch(g.id); } }
});
