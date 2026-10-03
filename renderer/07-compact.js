'use strict';
// ─── Компактный режим (как библиотека Xbox) ───────────────────────────────────
// Слева «Самые последние», справа плитки игр; щелчок по плитке открывает
// страницу игры, при наведении — «Играть» и «⋯». Управляется мышью, клавиатурой и геймпадом.
const BIG_SORT = { recent: 'Последние использованные', alpha: 'По названию', time: 'Больше всего времени', added: 'Недавно добавленные' };
const exists = new Map();   // id игры → есть ли файл запуска на диске
async function refreshExists() {
  const list = games.slice();   // пока идёт проверка, список может измениться — сопоставляем по id, а не по позиции
  const res = api.checkGames ? await api.checkGames(list.map((g) => ({ exePath: g.exePath, lnkPath: g.lnkPath, installDir: g.installDir }))).catch(() => null)
    : await api.checkPaths?.(list.map((g) => g.lnkPath || g.exePath || '')).catch(() => null);
  if (!res) return;
  const before = games.filter(isMissing).length;
  list.forEach((g, i) => exists.set(g.id, !!res[i]));
  if (games.filter(isMissing).length !== before) S.missDismissed = false;
  render();
}
function bigTabs() {
  return tabKeys().map((k) => [k, k === 'all' ? 'Мои игры' : tabLabel(k)]);
}
function bigDefaultSort(t) { return t === 'new' ? 'added' : 'recent'; }
function bigSortKey() { return S.big.sort || bigDefaultSort(S.big.tab); }
function bigList() {
  const vis = visible(); const t = S.big.tab;
  let list;
  if (t === 'fav') list = vis.filter((g) => g.favorite);
  else if (t === 'new') list = vis.filter((g) => !isPlayed(g));
  else if (t.startsWith('cat:')) list = vis.filter((g) => inList(g, t.slice(4)));
  else if (t === 'done') list = vis.filter((g) => g.completed);
  else if (t === 'recent') list = vis.filter((g) => isPlayed(g) || running.has(g.id));
  else list = vis;
  return sortBy(list, bigSortKey());
}
function recentList() { return sortBy(visible().filter((g) => isPlayed(g) || running.has(g.id)), 'recent').slice(0, 8); }
function bigCols() {
  const g = $('#bgrid .bgrid');
  if (g) { const n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length; if (n) return n; }
  return 6;
}
function openBig({ quiet = false, bp = false } = {}) {
  closeDlg(); closeMenu(); closePal();
  S.pop = false; renderPop();
  const wasOpen = S.big.open;
  Object.assign(S.big, { open: true, sheet: false, zone: 'grid', page: null, sort: null, pi: 0, ri: 0, bp: !!bp, menu: false });
  document.body.classList.toggle('bp-on', !!bp);
  if (bp && !S.fs) { S.big.bpFs = true; api.setFullscreen?.(true).then((on) => { if (typeof on === 'boolean') { S.fs = on; renderModeHost(); } }); }
  else if (!bp && S.big.bpFs && wasOpen) { S.big.bpFs = false; api.setFullscreen?.(false).then((on) => { if (typeof on === 'boolean') { S.fs = on; renderModeHost(); } }); }
  if (!bigTabs().some((t) => t[0] === S.big.tab)) S.big.tab = 'all';
  const sel = selGame();
  S.big.idx = Math.max(0, sel ? bigList().findIndex((x) => x.id === sel.id) : 0);
  const big = $('#big');
  clearTimeout(openBig.t); big.hidden = false; big.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => big.classList.add('show')));
  document.body.classList.add('big-on');
  const vm = bp ? 'bp' : 'compact';
  if (settings.viewMode !== vm) { settings.viewMode = vm; saveSettingsQuiet(); }
  if (!quiet) sfx('bigIn');
  renderBig(); renderModeHost();
  refreshExists();
  gpShowHints();
}
function closeBig() {
  if (!S.big.open) return;
  const g = S.big.page ? byId(S.big.page) : bigCurrent();
  S.big.open = false; S.big.sheet = false; S.big.page = null;
  const big = $('#big'); big.classList.remove('show');
  clearTimeout(openBig.t); openBig.t = setTimeout(() => { if (!S.big.open) { big.hidden = true; big.innerHTML = ''; } }, 240);
  document.body.classList.remove('big-on', 'bp-on');
  if (S.big.bp && S.big.bpFs) { S.big.bpFs = false; api.setFullscreen?.(false).then((on) => { if (typeof on === 'boolean') { S.fs = on; renderModeHost(); } }); }
  S.big.bp = false; S.big.menu = false;
  if (settings.viewMode !== 'normal') { settings.viewMode = 'normal'; saveSettingsQuiet(); }
  sfx('bigOut');
  renderModeHost();
  if (g && g.id !== S.selId) { S.selId = g.id; if (!currentList().some((x) => x.id === g.id)) S.filter = 'all'; render(); }
  gpRefocus();
}
function bigCurrent() {
  // Меню «Опции» относится к той игре, для которой его открыли, даже если список под ним изменился
  if (S.big.sheet && S.big.sheetId) { const sg = byId(S.big.sheetId); if (sg) return sg; S.big.sheet = false; S.big.sheetId = null; }
  if (S.big.page) return byId(S.big.page);
  if (S.big.bp) return bpCurrent();
  if (S.big.zone === 'side') return recentList()[S.big.ri];
  const l = bigList(); return l[Math.min(S.big.idx, l.length - 1)];
}
function bigTab(dir) {
  if (S.big.page) return;
  if (S.big.bp) return bpShelfJump(dir);
  const tabs = bigTabs(); const i = tabs.findIndex((t) => t[0] === S.big.tab);
  S.big.tab = tabs[(i + dir + tabs.length) % tabs.length][0];
  Object.assign(S.big, { idx: 0, sort: null, zone: 'grid', sheet: false });
  sfx('tab'); renderBig();
}
function bigSortCycle() {
  const keys = Object.keys(BIG_SORT); const i = keys.indexOf(bigSortKey());
  S.big.sort = keys[(i + 1) % keys.length]; S.big.idx = 0;
  sfx('tab'); renderBig();
}
function openPage(id) {
  if (!byId(id)) return;
  Object.assign(S.big, { page: id, pi: 0, pf: 'acts', mx: 0, sheet: false }); document.body.classList.remove('bp-scrolled');
  sfx('open'); renderBig();
  $('#bpage')?.scrollTo(0, 0);
}
function closePage() {
  const id = S.big.page; S.big.page = null; S.big.sheet = false;
  if (S.big.bp) { sfx('back'); return renderBig(); }
  const i = bigList().findIndex((x) => x.id === id);
  if (i >= 0 && S.big.zone === 'grid') S.big.idx = i;
  sfx('back'); renderBig();
}
function pageActs(g) {
  const run = running.has(g.id);
  return [
    { label: run ? 'Запущена' : 'Играть', icon: run ? 'ph ph-pulse' : 'ph-fill ph-play', cls: 'pg-play', run: () => launch(g.id) },
    { label: g.favorite ? 'В избранном' : 'В избранное', icon: g.favorite ? 'ph-fill ph-star' : 'ph ph-star', cls: 'pg-sq', title: true, run: () => toggleFav(g.id) },
    { label: 'Ещё', icon: 'ph ph-dots-three', cls: 'pg-sq', title: true, run: () => { S.big.sheet = true; S.big.sheetId = g.id; S.big.si = 0; sfx('open'); renderBig(); } },
  ];
}
function sheetItems(g) {
  if (!g) return [];
  const run = running.has(g.id);
  const back = () => { S.big.sheet = false; sfx('close'); renderBig(); };
  return [
    { label: run ? 'Уже запущена' : 'Играть', icon: run ? 'ph ph-pulse' : 'ph-fill ph-play', run: () => { S.big.sheet = false; launch(g.id); } },
    ...(S.big.page === g.id ? [] : [{ label: 'Показать подробности', icon: 'ph ph-info', run: () => openPage(g.id) }]),
    { label: g.favorite ? 'Убрать из избранного' : 'Добавить в избранное', icon: g.favorite ? 'ph-fill ph-star' : 'ph ph-star', run: () => toggleFav(g.id) },
    { label: g.completed ? 'Снять отметку «Пройдена»' : 'Отметить пройденной', icon: 'ph ph-check-circle', run: () => toggleCompleted(g.id) },
    { label: 'Добавить в список…', icon: 'ph ph-list-plus', run: () => { S.big.sheet = false; renderBig(); assignCatDlg([g.id]); } },
    { label: 'Открыть папку игры', icon: 'ph ph-folder-open', run: () => { openFolder(g.id); toast('Папка открыта в проводнике'); } },
    { label: 'Обновить обложку и описание', icon: 'ph ph-arrows-clockwise', run: () => quickEnrich(g.id) },
    { label: 'Назад', icon: 'ph ph-arrow-left', run: back },
  ];
}
// Подсказки кнопок внизу — только когда играют с геймпада
function legendHTML(g) {
  if (INPUT.mode === 'kbd') return '';
  let items;
  if (S.big.sheet) items = [['a', 'Выбрать', true, 'big-sheet-run'], ['b', 'Закрыть', false, 'big-sheet-close']];
  else if (S.big.page) items = [['a', g && running.has(g.id) ? 'Запущена' : 'Играть', true, 'big-play'], ['b', 'Назад', false, 'big-back'], ['x', g?.favorite ? 'Убрать из избранного' : 'В избранное', false, 'big-fav'], ['y', 'Ещё', false, 'big-info']];
  else if (S.big.zone === 'side') items = [['a', 'Открыть', true, 'big-play'], ['start', 'Опции', false, 'big-options']];
  else items = [['a', g && running.has(g.id) ? 'Запущена' : 'Играть', true, 'big-play'], ['start', 'Опции', false, 'big-options'], ['x', g?.favorite ? 'Убрать из избранного' : 'В избранное', false, 'big-fav'], ['y', 'Подробнее', false, 'big-info']];
  return `<div class="big-legend">${items.map(([k, l, acc, act]) => `<button class="big-hint${acc ? ' primary' : ''}" data-act="${act}">${keyCap(k)}${esc(l)}</button>`).join('')}</div>`;
}
// Под названием — магазин (Steam, Epic…) или разработчик, без лишнего
function storeName(g) { const st = storeOf(g); return st ? STORES[st][0] : 'ПК'; }
function statusHTML(x) {
  if (running.has(x.id)) return `<div class="bt-st run"><i class="ph-fill ph-circle"></i><span>Запущена · <span class="live-time" data-run="${esc(x.id)}">${runTime(x.id)}</span></span></div>`;
  if (exists.get(x.id) === false) return '<div class="bt-st miss"><i class="ph ph-warning-circle"></i><span>Файл не найден</span></div>';
  return isPlayed(x) ? `<div class="bt-st"><i class="ph ph-clock"></i><span>${esc(playLabel(x.playtime))} · ${esc(lastLabel(x.lastPlayed).toLowerCase())}</span></div>` : '<div class="bt-st new"><i class="ph ph-sparkle"></i><span>Ещё не запускали</span></div>';
}
function tileHTML(x, i) {
  const on = S.big.zone === 'grid' && !S.big.page && i === S.big.idx, [src, srcIcon] = sourceOf(x);
  return `<div class="btile${on ? ' on' : ''}" data-act="big-open" data-arg="${i}">
    <div class="bt-art"><div class="bt-cover" style="${coverBg(x, 150)}">${x.cover ? '' : noCoverHTML(x)}</div>
      <div class="bt-fade"></div>${x.favorite ? '<i class="ph-fill ph-star bt-fav"></i>' : ''}
      <div class="bt-hover"><button class="bt-hb play" data-act="big-tile-play" data-arg="${i}" title="Играть"><i class="ph-fill ph-play"></i></button>
        <button class="bt-hb" data-act="big-tile-more" data-arg="${i}" title="Ещё"><i class="ph ph-dots-three"></i></button></div></div>
    <div class="bt-info"><div class="bt-name">${srcIconHTML(x, 'nsrc')}${esc(x.name)}</div><div class="bt-srcl">${esc(storeName(x))}</div>${statusHTML(x)}</div>
  </div>`;
}
function sheetHTML(g) {
  const items = sheetItems(g);
  S.big.si = Math.min(S.big.si, items.length - 1);
  return `<div class="sheet-back" data-act="big-sheet-close"></div>
    <div class="sheet elev-lg">
      <div class="sheet-head"><div class="sheet-ico" style="${coverBg(g)}">${g.cover ? '' : esc(initials(g.name))}</div>
        <div><h2>${esc(g.name)}</h2><div class="muted">${esc(sourceOf(g)[0])} · ${esc(playLabel(g.playtime))} в игре</div></div></div>
      <div class="sheet-items">${items.map((m, i) => `<button class="sheet-item${i === S.big.si ? ' on' : ''}" data-act="big-sheet" data-arg="${i}"><i class="${m.icon}"></i>${esc(m.label)}</button>`).join('')}</div>
    </div>`;
}
function sideHTML() {
  const rec = recentList();
  return `<aside class="mn-side">
    <button class="mn-nav${S.big.page ? '' : ' on'}" data-act="big-home"><i class="ph ph-books"></i>Моя библиотека</button>
    <div class="mn-sec">Самые последние</div>
    <div class="mn-recent">${rec.map((g, i) => `<button class="mn-rec${S.big.zone === 'side' && S.big.ri === i && !S.big.sheet ? ' on' : ''}${S.big.page === g.id ? ' cur' : ''}" data-act="big-recent" data-arg="${esc(g.id)}">
      <div class="mn-ico" style="${coverBg(g)}">${g.cover ? '' : esc(initials(g.name))}</div>
      <div class="mn-rt"><b>${srcIconHTML(g, 'nsrc')}${esc(g.name)}</b><span>${running.has(g.id) ? '<span class="acc">Запущена</span>' : esc(storeName(g))}</span></div></button>`).join('') || '<div class="mn-none">Здесь появятся игры, в которые вы недавно играли.</div>'}</div>
  </aside>`;
}
// ─── Вид плиток в компактном режиме: размер, столбцы, форма обложки, подписи ─
function tileView() {
  const t = settings.tile || {};
  return { size: Math.max(110, Math.min(300, +t.size || 150)), cols: Math.max(0, Math.min(12, +t.cols || 0)),
    shape: ['square', 'portrait', 'wide'].includes(t.shape) ? t.shape : 'square', info: ['full', 'name', 'none'].includes(t.info) ? t.info : 'full' };
}
function tileClass() { const v = tileView(); return `shape-${v.shape} info-${v.info}`; }
function tileGridStyle() {
  const v = tileView();
  return v.cols ? `grid-template-columns:repeat(${v.cols}, minmax(0, 1fr))` : `grid-template-columns:repeat(auto-fill, minmax(${v.size}px, 1fr))`;
}
function setTile(patch) {
  settings.tile = { ...tileView(), ...patch };
  clearTimeout(setTile.t); setTile.t = setTimeout(saveSettingsQuiet, 400);
  renderBig();
}
function viewPopHTML() {
  const v = tileView();
  const seg = (key, opts) => `<div class="vp-seg">${opts.map(([val, label, icon]) => `<button class="${v[key] === val ? 'on' : ''}" data-act="tile-set" data-k="${key}" data-arg="${val}">${icon ? `<i class="${icon}"></i>` : ''}${label}</button>`).join('')}</div>`;
  return `<div class="vp-back" data-act="big-view"></div><div class="vpop elev-lg">
    <div class="vp-row"><span>Размер карточек</span><div class="vp-range"><i class="ph ph-squares-four"></i><input type="range" id="tile-size" min="110" max="300" step="10" value="${v.size}"${v.cols ? ' disabled' : ''}><i class="ph ph-square"></i></div></div>
    <div class="vp-row"><span>Столбцы</span><div class="vp-seg">${[0, 3, 4, 5, 6, 7, 8, 10].map((n) => `<button class="${v.cols === n ? 'on' : ''}" data-act="tile-set" data-k="cols" data-arg="${n}">${n || 'Авто'}</button>`).join('')}</div></div>
    <div class="vp-row"><span>Обложка</span>${seg('shape', [['square', 'Квадрат', 'ph ph-square'], ['portrait', 'Вертикальная', 'ph ph-rectangle ph-rot'], ['wide', 'Широкая', 'ph ph-rectangle']])}</div>
    <div class="vp-row"><span>Подписи</span>${seg('info', [['full', 'Всё'], ['name', 'Только название'], ['none', 'Без подписей']])}</div>
    <div class="vp-hint">Размер можно менять и колёсиком мыши с зажатым Ctrl.</div>
  </div>`;
}
function libraryHTML(list) {
  const pk = INPUT.mode !== 'kbd';
  return `<div class="mn-tabs">${pk ? keyCap('lb') : ''}${bigTabs().map(([k, l]) => `<button class="big-tab${S.big.tab === k ? ' on' : ''}" data-act="big-tab" data-arg="${esc(k)}">${esc(l)}</button>`).join('')}${pk ? keyCap('rb') : ''}</div>
    <div class="big-bar"><button class="btn btn-secondary big-sort" data-act="big-sort"><i class="ph ph-sort-descending"></i>${esc(BIG_SORT[bigSortKey()])}<i class="ph ph-caret-down muted"></i></button>
      <button class="btn btn-secondary big-sort${S.big.viewOpen ? ' on' : ''}" data-act="big-view" title="Размер и вид карточек (Ctrl + колесо мыши)"><i class="ph ph-sliders-horizontal"></i>Вид</button>
      <span class="grow"></span><span class="muted">Игр: ${list.length}</span>
      <button class="btn btn-secondary big-sort" data-act="big-menu" title="Режим, настройки, добавление игр"><i class="ph ph-list"></i>Меню</button></div>
    ${S.big.viewOpen ? viewPopHTML() : ''}
    <div class="bgrid-wrap" id="bgrid">${list.length ? `<div class="bgrid ${tileClass()}" style="${tileGridStyle()}">${list.map(tileHTML).join('')}</div>`
      : '<div class="big-empty"><i class="ph ph-ghost"></i>В этом разделе пока нет игр.</div>'}</div>`;
}
// Страница игры в ТВ-режиме — как в Steam Big Picture: большая картинка, логотип, крупные кнопки и цифры
function bpPageHTML(g) {
  const acts = pageActs(g), [src] = sourceOf(g), m14 = min14(g);
  const hasHist = !!(g.days && Object.keys(g.days).length) || running.has(g.id);
  const stats = [
    ['ph ph-calendar-check', 'Последний запуск', running.has(g.id) ? 'Сейчас' : lastLabel(g.lastPlayed)],
    ['ph ph-clock', 'Вы играли', isPlayed(g) ? exactTime(g.playtime) : 'Ещё не запускали'],
    ...(m14 ? [['ph ph-chart-bar', 'За 2 недели', exactTime(m14)]] : []),
    ['ph ph-play-circle', 'Запусков', String(g.runs || (isPlayed(g) ? '—' : 0))],
  ];
  const facts = [['Разработчик', g.developer], ['Год выхода', g.year], ['Жанр', genresOf(g).join(', ')],
    ['Списки', gameLists(g).map((id) => catById(id).name).join(', ')], ['Магазин', src], ['Добавлена', g.addedAt ? lastLabel(g.addedAt) : '']].filter((x) => x[1]);
  return `<div class="pg tvp" id="bpage">
    <div class="tvp-hero"><div class="tvp-art" style="${heroStyle(g)}"></div><div class="tvp-fade"></div>
      <button class="tvp-back" data-act="big-back" title="Назад (B / Esc)"><i class="ph ph-caret-left"></i></button>
      <div class="tvp-head">
        ${titleHTML(g, 'tvp-logo', 'h1')}
        <div class="pg-acts tvp-acts">${acts.map((a, i) => `<button class="${a.cls}${S.big.pi === i && (S.big.pf || 'acts') === 'acts' && !S.big.sheet ? ' on' : ''}" data-act="big-page-act" data-arg="${i}" ${a.title ? `title="${esc(a.label)}"` : ''}><i class="${a.icon}"></i>${a.title ? '' : esc(a.label)}</button>`).join('')}</div>
        <div class="tvp-stats">${stats.map(([ic, l, v]) => `<div><i class="${ic}"></i><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      </div>
    </div>
    <div class="tvp-body">
      <section class="tvp-about">
        <h2>Об игре</h2>
        ${genresOf(g).length || g.completed ? `<div class="pg-chips">${genresOf(g).map((t) => `<span class="pg-chip">${esc(t)}</span>`).join('')}${g.completed ? '<span class="pg-chip done"><i class="ph-fill ph-check-circle"></i>Пройдена</span>' : ''}</div>` : ''}
        ${extraHTML(g)}
        ${descSource(g) ? descHTML(g) : '<p class="pg-empty">Описание ещё не загружено. Опции → «Обновить обложку и описание».</p>'}
      </section>
      <aside class="tvp-side">
        <div class="tvp-facts"><h2>Сведения</h2>${facts.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      </aside>
      ${hasHist ? `<section class="tvp-act"><h2>Активность<span>${esc(exactTime(m14))} за последние две недели</span></h2>${barsHTML(g)}<div class="bars-axis"><span>2 недели назад</span><span>Сегодня</span></div></section>` : ''}
    </div>
  </div>`;
}
function pageHTML(g) {
  const acts = pageActs(g);
  const [src, srcIcon] = sourceOf(g);
  const hasHist = !!(g.days && Object.keys(g.days).length) || running.has(g.id);
  const info = [
    ['Разработчик', g.developer || '—', 'ph ph-code'], ['Год выхода', g.year || '—', 'ph ph-calendar-blank'],
    ['Жанр', genresOf(g).join(', ') || '—', 'ph ph-shapes'], ['Списки', gameLists(g).map((id) => catById(id).name).join(', ') || '—', 'ph ph-list-bullets'],
    ['Добавлена', g.addedAt ? lastLabel(g.addedAt) : '—', 'ph ph-calendar-plus'], ['Файл игры', g.exePath || g.lnkPath || '—', 'ph ph-file'],
  ];
  return `<div class="pg" id="bpage">
    <div class="pg-hero${g.hero ? ' has-hero' : ''}"><div class="pg-art" style="${heroStyle(g)}"></div><div class="pg-fade"></div></div>
    <div class="pg-body">
      <button class="btn btn-secondary btn-icon pg-back" data-act="big-back" title="Назад (B / Esc)"><i class="ph ph-caret-left"></i></button>
      <div class="pg-head">${titleHTML(g, 'pg-logo', 'h1')}</div>
      <div class="pg-acts">${acts.map((a, i) => `<button class="${a.cls}${S.big.pi === i && !S.big.sheet ? ' on' : ''}" data-act="big-page-act" data-arg="${i}" ${a.title ? `title="${esc(a.label)}"` : ''}><i class="${a.icon}"></i>${a.title ? '' : esc(a.label)}</button>`).join('')}</div>
      <div class="pg-stats">
        <span><i class="ph ph-clock"></i>Время в игре: ${esc(exactTime(g.playtime))}</span>
        <span><i class="ph ph-calendar-check"></i>${running.has(g.id) ? 'Запущена сейчас' : 'Последний запуск: ' + esc(lastLabel(g.lastPlayed).toLowerCase())}</span>
        <span><i class="ph ph-play-circle"></i>Запусков: ${esc(String(g.runs || (isPlayed(g) ? '—' : 0)))}</span>
        <span>${srcIconHTML(g, 'pg-src')}${esc(src)}</span>
      </div>
      <div class="pg-grid">
        <div class="pg-main">
          <section class="pg-sec"><h3 class="pg-h">Об игре</h3>
            ${genresOf(g).length || g.completed ? `<div class="pg-chips">${genresOf(g).map((t) => `<span class="pg-chip">${esc(t)}</span>`).join('')}${g.completed ? '<span class="pg-chip done"><i class="ph-fill ph-check-circle"></i>Пройдена</span>' : ''}</div>` : ''}
            ${extraHTML(g)}
            ${descSource(g) ? descHTML(g) : `<p class="pg-empty">Описание ещё не загружено.</p><button class="btn btn-secondary" data-act="big-enrich" style="align-self:flex-start">Найти обложку и описание</button>`}
          </section>
          ${hasHist ? `<section class="pg-sec"><h3 class="pg-h">Активность за 2 недели<span>${esc(exactTime(min14(g)))}</span></h3><div class="pg-act">${barsHTML(g)}<div class="bars-axis"><span>2 недели назад</span><span>Сегодня</span></div></div></section>` : ''}
        </div>
        <aside class="pg-side">
          ${g.cover ? `<img class="pg-poster" src="${esc(g.cover)}" alt="" draggable="false">` : `<div class="pg-poster ini-box" style="${coverBg(g)}">${noCoverHTML(g)}</div>`}
          <div class="pg-facts">${info.filter(([l]) => l !== 'Файл игры').map(([l, v, ic]) => `<div class="pg-row"><i class="${ic}"></i><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
            <div class="pg-row"><i class="ph ph-storefront"></i><span>Источник</span><b class="pg-srcv">${srcIconHTML(g, 'pg-src')}${esc(src)}</b></div></div>
          <div class="pg-file"><span>Файл игры</span><code>${esc(g.exePath || g.lnkPath || '—')}</code></div>
        </aside>
      </div>
    </div>
  </div>`;
}
function renderBig() {
  setTimeout(gxEdgesAll, 0);
  if (S.big.bp) return bpRender();
  const list = bigList();
  S.big.idx = Math.max(0, Math.min(S.big.idx, list.length - 1));
  S.big.zone = 'grid';   // боковой панели «Самые последние» больше нет
  if (S.big.page && !byId(S.big.page)) S.big.page = null;
  const g = bigCurrent();
  const oldGrid = $('#bgrid'), top = oldGrid ? oldGrid.scrollTop : 0;
  const oldPage = $('#bpage'), ptop = oldPage ? oldPage.scrollTop : 0;
  const pg = S.big.page ? byId(S.big.page) : null;
  let html = `<div class="mn"><section class="mn-main">${pg ? bpPageHTML(pg) : libraryHTML(list)}${legendHTML(g)}</section></div>`;
  if (S.big.sheet && g) html += sheetHTML(g);
  $('#big').innerHTML = html;
  const page = $('#bpage'); if (page) page.scrollTop = ptop;
  const grid = $('#bgrid');
  if (grid) {
    grid.scrollTop = top;
    const t = grid.querySelector('.btile.on');
    if (t) {
      const r = t.getBoundingClientRect(), pr = grid.getBoundingClientRect();
      if (r.bottom > pr.bottom - 16) grid.scrollTop += r.bottom - pr.bottom + 16;
      else if (r.top < pr.top + 16) grid.scrollTop -= pr.top + 16 - r.top;
    }
  }
  $('#big .mn-rec.on')?.scrollIntoView({ block: 'nearest' });
  $('#big .sheet-item.on')?.scrollIntoView({ block: 'nearest' });
}
function bigSetIdx(j) {
  if (j === S.big.idx) return;
  S.big.idx = j; sfx('move'); renderBig();
}
function bigDir(dir) {
  if (S.big.bp && (S.big.menu || (!S.big.sheet && !S.big.page))) return bpDir(dir);
  if (S.big.sheet) {
    const k = sheetItems(bigCurrent()).length;
    const j = dir === 'up' ? Math.max(0, S.big.si - 1) : dir === 'down' ? Math.min(k - 1, S.big.si + 1) : S.big.si;
    if (j !== S.big.si) { S.big.si = j; sfx('move'); document.querySelectorAll('#big .sheet .sheet-item').forEach((x, i) => x.classList.toggle('on', i === j)); $('#big .sheet-item.on')?.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  if (S.big.page) {
    const k = pageActs(byId(S.big.page)).length;
    // На странице два места фокуса: кнопки (Играть / ★ / …) и «Читать полностью» под описанием
    const more = $('#bpage .desc-more');
    const ths = [...document.querySelectorAll('#bpage .gx-th')];
    const pa = () => {
      ths.forEach((x, i) => x.classList.toggle('on', S.big.pf === 'media' && i === S.big.mx));
      const th = S.big.pf === 'media' && ths[S.big.mx]; if (th) { const st = th.parentElement; st.scrollTo({ left: th.offsetLeft - st.clientWidth / 2 + th.offsetWidth / 2, behavior: 'smooth' }); }
      document.querySelectorAll('#big .pg-acts button').forEach((x, i) => x.classList.toggle('on', (S.big.pf || 'acts') === 'acts' && i === S.big.pi));
      more?.classList.toggle('on', S.big.pf === 'desc');
      if (S.big.bp) { const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = bpLegendHTML(byId(S.big.page)); }
    };
    const toActs = () => { S.big.pf = 'acts'; sfx('move'); pa(); $('#bpage')?.scrollTo({ top: 0, behavior: 'smooth' }); };
    const toMedia = () => { S.big.pf = 'media'; S.big.mx = Math.min(S.big.mx || 0, ths.length - 1); sfx('move'); pa(); scrollInside(ths[0].parentElement, $('#bpage'), 'center'); };
    if (S.big.pf === 'desc') {
      if (dir === 'up') ths.length ? toMedia() : toActs();
      else if (dir === 'left' || dir === 'right') toActs();
      else $('#bpage')?.scrollBy({ top: 260, behavior: 'smooth' });
      return;
    }
    if (S.big.pf === 'media') {
      if (dir === 'left' || dir === 'right') { const j = Math.max(0, Math.min(ths.length - 1, (S.big.mx || 0) + (dir === 'right' ? 1 : -1))); if (j !== S.big.mx) { S.big.mx = j; sfx('move'); pa(); } }
      else if (dir === 'up') toActs();
      else if (more) { S.big.pf = 'desc'; sfx('move'); pa(); scrollInside(more, $('#bpage'), 'center'); }
      else $('#bpage')?.scrollBy({ top: 260, behavior: 'smooth' });
      return;
    }
    if (dir === 'left' && S.big.pi > 0) { S.big.pi--; sfx('move'); pa(); }
    else if (dir === 'right' && S.big.pi < k - 1) { S.big.pi++; sfx('move'); pa(); }
    else if (dir === 'down' && ths.length) toMedia();
    else if (dir === 'down' && more) { S.big.pf = 'desc'; sfx('move'); pa(); scrollInside(more, $('#bpage'), 'center'); }
    else if (dir === 'up' || dir === 'down') $('#bpage')?.scrollBy({ top: dir === 'down' ? 240 : -240, behavior: 'smooth' });
    return;
  }
  if (S.big.zone === 'side') {
    const k = recentList().length;
    if (dir === 'up' && S.big.ri > 0) { S.big.ri--; sfx('move'); renderBig(); }
    else if (dir === 'down' && S.big.ri < k - 1) { S.big.ri++; sfx('move'); renderBig(); }
    else if (dir === 'right' && bigList().length) { S.big.zone = 'grid'; sfx('move'); renderBig(); }
    return;
  }
  const n = bigList().length, i = S.big.idx, cols = bigCols();
  if (dir === 'left' && (i % cols === 0 || !n)) return;
  if (!n) return;
  let j = i;
  if (dir === 'left') j = Math.max(0, i - 1);
  else if (dir === 'right') j = Math.min(n - 1, i + 1);
  else if (dir === 'up') j = i - cols >= 0 ? i - cols : i;
  else if (dir === 'down') j = i + cols < n ? i + cols : (Math.floor(i / cols) < Math.floor((n - 1) / cols) ? n - 1 : i);
  bigSetIdx(j);
}
function bigA() {
  if (S.big.bp && !S.big.page && !S.big.sheet && !S.big.menu && bpPos().key === 'tabs') return bpDir('down');
  if (S.big.bp && S.big.menu) { const it = bpMenuItems()[S.big.mi]; S.big.menu = false; sfx('select'); bpRender(); it?.run(); return; }
  const g = bigCurrent();
  if (S.big.sheet) { const it = sheetItems(g)[S.big.si]; if (it) { sfx('select'); it.run(); } return; }
  if (!g) return;
  if (S.big.page && S.big.pf === 'media') { const th = document.querySelectorAll('#bpage .gx-th')[S.big.mx || 0]; sfx('select'); return lbFromGame(S.big.page, +(th?.dataset.arg || 0)); }
  if (S.big.page && S.big.pf === 'desc') { const m = $('#bpage .desc-more'); if (m) { m.click(); m.classList.add('on'); if (S.big.bp) { const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = bpLegendHTML(byId(S.big.page)); } } return; }
  if (S.big.page) { const a = pageActs(g)[S.big.pi]; if (a) { if (S.big.pi) sfx('select'); a.run(); } return; }
  if (S.big.zone === 'side' || S.big.bp) return openPage(g.id);
  launch(g.id);
}
function bigB() {
  if (S.big.bp && S.big.menu) return bpMenuToggle(false);
  if (S.big.sheet) { S.big.sheet = false; sfx('close'); return renderBig(); }
  if (S.big.page) return closePage();
  if (S.big.zone === 'side') { S.big.zone = 'grid'; sfx('back'); return renderBig(); }
}
// ≡ в компактном режиме — сразу меню «Опции» для выбранной игры
function bigOptions() {
  if (S.big.sheet) { S.big.sheet = false; sfx('close'); return renderBig(); }
  const g = bigCurrent(); if (!g) return;
  S.big.sheet = true; S.big.sheetId = g.id; S.big.si = 0; sfx('open'); renderBig();
}
// Y / I: в сетке — страница игры, на странице — меню «Ещё»
function bigInfo() {
  if (S.big.menu) return;
  const g = bigCurrent(); if (!g) return;
  if (S.big.sheet) { S.big.sheet = false; sfx('close'); return renderBig(); }
  if (!S.big.page && !S.big.bp) return openPage(g.id);
  S.big.sheet = true; S.big.sheetId = g.id; S.big.si = 0; sfx('open'); renderBig();
}
