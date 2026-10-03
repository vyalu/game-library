'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Big Picture — режим для телевизора и геймпада, как в Steam
// ═══════════════════════════════════════════════════════════════════════════
function min14(g) { return sessions14(g).reduce((a, b) => a + b, 0); }
function bpCollections() {
  // те же вкладки и в том же порядке, что и в библиотеке
  return tabKeys().map((k) => [k, k === 'all' ? 'Все игры' : tabLabel(k), sortBy(tabGames(k), k === 'all' ? 'alpha' : k === 'new' ? 'added' : 'recent')])
    .filter((x, i) => i === 0 || x[2].length);
}
function bpColl() { const cs = bpCollections(); return cs.find((x) => x[0] === S.big.bpTab) || cs[0]; }
// Ряды: недавние игры → вкладки коллекций (как «Что нового / Друзья» в Steam) → игры выбранной коллекции
function bpShelves() {
  const vis = visible();
  const rec = sortBy(vis.filter((g) => isPlayed(g) || running.has(g.id)), 'recent').slice(0, 14);
  const col = bpColl();
  return [['recent', 'Недавние игры', rec.length ? rec : sortBy(vis, 'added').slice(0, 14), 'shelf'],
    ['tabs', 'Коллекции', bpCollections(), 'tabs'],
    ['col', col[1], col[2], 'shelf']].filter((x) => x[2].length);
}
function bpPos() {
  const sh = bpShelves();
  S.big.bpr = Math.max(0, Math.min(S.big.bpr || 0, sh.length - 1));
  S.big.bpc = S.big.bpc || {};
  const [key, , items, type] = sh[S.big.bpr] || [];
  if (key === 'tabs') { const c = Math.max(0, bpCollections().findIndex((x) => x[0] === bpColl()[0])); return { sh, key, items: items || [], c, g: null, type }; }
  const c = Math.max(0, Math.min(S.big.bpc[key] || 0, (items?.length || 1) - 1));
  return { sh, key, items: items || [], c, g: items?.[c] || null, type };
}
function bpCurrent() { return bpPos().g; }
function bpTileHTML(g, r, c, on) {
  const wide = r === 0;   // в первом ряду выбранная игра раскрывается широкой картинкой
  return `<button class="bp-tile${on ? ' on' : ''}${wide && on ? ' wide' : ''}${wide ? ' w-able' : ''}" data-act="bp-tile" data-r="${r}" data-c="${c}">
    <span class="bp-cov" style="${coverBg(g, 150)}">${g.cover ? '' : noCoverHTML(g)}</span>
    ${wide ? `<span class="bp-hero" style="${heroStyle(g)}"></span><span class="bp-hero-fade"></span>
      <span class="bp-hero-t">${g.logo && settings.showLogos !== false ? `<img src="${esc(g.logo)}" alt="" draggable="false">` : `<b>${esc(g.name)}</b>`}</span>` : ''}
    ${running.has(g.id) ? '<span class="bp-run"><i class="ph-fill ph-circle"></i>Запущена</span>' : ''}
    ${g.favorite ? '<i class="ph-fill ph-star bp-fav"></i>' : ''}
  </button>`;
}
function bpInfoHTML(g) {
  if (!g) return '';
  const m = min14(g);
  const sub = running.has(g.id) ? `<span class="acc">Запущена · <span class="live-time" data-run="${esc(g.id)}">${runTime(g.id)}</span></span>`
    : m ? `${esc(exactTime(m))} за последние две недели` : isPlayed(g) ? `Всего ${esc(exactTime(g.playtime))} · ${esc(lastLabel(g.lastPlayed).toLowerCase())}` : 'Ещё не запускали';
  return `<div class="bp-name">${srcIconHTML(g, 'nsrc')}${esc(g.name)}</div><div class="bp-sub"><i class="ph-fill ph-play"></i>${sub}</div>`;
}
function bpLegendHTML(g) {
  let right;
  if (S.big.menu) right = [['a', 'Выбрать', 'bp-menu-run-cur'], ['b', 'Назад', 'bp-menu-close']];
  else if (S.big.sheet) right = [['a', 'Выбрать', 'big-sheet-run'], ['b', 'Назад', 'big-sheet-close']];
  else if (S.big.page) right = [['start', 'Опции', 'big-info'], ['a', S.big.pf === 'media' ? 'Смотреть' : S.big.pf === 'desc' ? (DESC_OPEN.has(S.big.page) ? 'Свернуть' : 'Читать полностью') : g && running.has(g.id) ? 'Запущена' : 'Играть', 'big-play'], ['b', 'Назад', 'big-back']];
  else right = [['y', 'Поиск', 'open-pal'], ['start', 'Опции', 'big-info'], ['a', 'Выбрать', 'big-play'], ['b', 'Назад', 'bp-back']];
  const KB = { a: 'Enter', b: 'Esc', x: 'F', y: '/', start: 'Пробел', back: 'Tab' };
  const cap = (k) => INPUT.mode === 'kbd' ? `<span class="keycap">${KB[k]}</span>` : keyCap(k);
  return `<footer class="bp-legend"><button class="bp-hint" data-act="bp-menu">${cap('back')}Меню</button><span class="grow"></span>
    ${right.map(([k, l, act]) => `<button class="bp-hint" data-act="${act}">${cap(k)}${esc(l)}</button>`).join('')}</footer>`;
}
function bpMenuItems() {
  return [
    { label: 'Продолжить', icon: 'ph ph-play', run: () => {} },
    { label: 'Поиск игры', icon: 'ph ph-magnifying-glass', run: () => openPal() },
    { label: 'Статистика', icon: 'ph ph-chart-bar', run: () => statsDlg() },
    { label: 'Компактный режим', icon: 'ph ph-squares-four', run: () => switchMode('compact') },
    { label: 'Обычный режим', icon: 'ph ph-rows', run: () => switchMode('normal') },
    { label: S.fs ? 'Выйти из полноэкранного режима' : 'Во весь экран', icon: S.fs ? 'ph ph-corners-in' : 'ph ph-corners-out', run: () => toggleFullscreen() },
    { label: 'Настройки', icon: 'ph ph-gear-six', run: () => settingsDlg() },
    { label: 'Свернуть в трей', icon: 'ph ph-arrow-line-down', run: () => api.toTray() },
    { label: 'Выйти из программы', icon: 'ph ph-power', run: () => api.quit() },
  ];
}
function bpMenuHTML() {
  const items = bpMenuItems(); S.big.mi = Math.max(0, Math.min(S.big.mi || 0, items.length - 1));
  return `<div class="sheet-back" data-act="bp-menu-close"></div><div class="bp-menu elev-lg">
    <div class="bp-menu-h"><img src="assets/icon.png" alt=""><b>Game Library</b><span class="muted">ТВ-режим</span></div>
    ${items.map((m, i) => `<button class="sheet-item${i === S.big.mi ? ' on' : ''}" data-act="bp-menu-run" data-arg="${i}"><i class="${m.icon}"></i>${esc(m.label)}</button>`).join('')}</div>`;
}
function bpRender() {
  if (S.big.page && !byId(S.big.page)) S.big.page = null;   // игру убрали, пока была открыта её страница
  const pg = S.big.page ? byId(S.big.page) : null;
  const oldPage = $('#bpage'); if (oldPage && pg && S.big.pageShown === pg.id) S.big.pageTop = oldPage.scrollTop;
  S.big.pageShown = pg ? pg.id : null;
  const { sh, c: cc, g } = bpPos();
  const scr = $('#bpscroll'), top = scr ? scr.scrollTop : 0;
  const lefts = {}; document.querySelectorAll('#big .bp-row').forEach((r) => { lefts[r.dataset.key] = r.scrollLeft; });
  const bgG = pg || g;
  let html = `<div class="bp${pg ? ' bp-onpage' : ''}">
    <div class="bp-bg" style="${bgG ? heroStyle(bgG) : ''}"></div><div class="bp-shade"></div>
    <header class="bp-top"><span class="bp-logo"><img src="assets/icon.png" alt="">Game Library</span><span class="grow"></span>
      <span class="bp-pad-host">${padLabelHTML('bp-pad')}</span>
      <button class="bp-ico" data-act="open-pal" title="Поиск"><i class="ph ph-magnifying-glass"></i></button>
      <span class="bp-clock" id="bp-clock">${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
      <button class="bp-ico" data-act="bp-menu" title="Меню"><i class="ph ph-list"></i></button></header>`;
  if (pg) html += `<div class="bp-page">${bpPageHTML(pg)}</div>`;
  else html += `<div class="bp-scroll" id="bpscroll">${sh.map(([key, label, items, type], r) => {
    if (type === 'tabs') return bpTabsHTML(r);
    const col = r === S.big.bpr ? cc : Math.min(S.big.bpc[key] || 0, items.length - 1);
    return `<section class="bp-shelf${r === 0 ? ' first' : ''}${r === S.big.bpr ? ' cur' : ''}" data-r="${r}" data-key="${esc(key)}">
      <h3>${esc(label)}<span>${items.length}</span></h3>
      <div class="bp-row" data-key="${esc(key)}">${items.map((x, c) => bpTileHTML(x, r, c, r === S.big.bpr && c === col)).join('')}</div>
      ${r === 0 ? `<div class="bp-info" id="bp-info">${bpInfoHTML(items[col])}</div>` : ''}</section>`;
  }).join('')}</div>`;
  const legend = bpLegendHTML(pg || g);
  let over = '';
  if (S.big.sheet && (pg || g)) over += sheetHTML(pg || g);
  if (S.big.menu) over += bpMenuHTML();
  // Открылось/закрылось только меню поверх — не трогаем экран под ним (иначе фон мигает)
  const baseKey = html.replace(/ (on|wide|cur|sel)(?=["\s])/g, '').replace(/<div class="bp-bg" style="[^"]*"/, '') + '|pi' + S.big.pi;
  if (S.big.bpBase === baseKey && $('#big .bp')) {
    document.querySelectorAll('#big > :not(.bp)').forEach((x) => x.remove());
    const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = legend;
    if (over) $('#big').insertAdjacentHTML('beforeend', over);
    S.big.pageTop = 0;
    return;
  }
  S.big.bpBase = baseKey;
  $('#big').innerHTML = html + legend + '</div>' + over;
  const ns = $('#bpscroll'); if (ns) ns.scrollTop = top;
  document.querySelectorAll('#big .bp-row').forEach((r) => { if (lefts[r.dataset.key] != null) r.scrollLeft = lefts[r.dataset.key]; });
  const pgEl = $('#bpage'); if (pgEl && S.big.pageTop) { pgEl.scrollTop = S.big.pageTop; S.big.pageTop = 0; }
  bpScrollIntoView(false);
}
function bpTabsHTML(r) {
  const cur = bpColl()[0], on = S.big.bpr === r;
  const pk = INPUT.mode !== 'kbd';
  return `<section class="bp-shelf bp-tabsrow${on ? ' cur' : ''}" data-r="${r}" data-key="tabs"><div class="bp-tabs">${pk ? keyCap('lb') : '<span class="keycap">Q</span>'}
    ${bpCollections().map(([k, l, items], c) => `<button class="bp-tab${k === cur ? ' sel' : ''}${on && k === cur ? ' on' : ''}" data-act="bp-tile" data-r="${r}" data-c="${c}">${esc(l)}<span>${items.length}</span></button>`).join('')}
    ${pk ? keyCap('rb') : '<span class="keycap">E</span>'}</div></section>`;
}
// Сменить коллекцию — перерисовываем только её полку (без мигания всего экрана)
function bpSetTab(key, quiet) {
  if (key === bpColl()[0]) return;
  S.big.bpTab = key; S.big.bpc.col = 0;
  if (!quiet) sfx('tab');
  const sh = bpShelves(), tr = sh.findIndex((x) => x[0] === 'tabs');
  const tabs = $('#big .bp-tabsrow'); if (tabs) tabs.outerHTML = bpTabsHTML(tr);
  const colR = sh.findIndex((x) => x[0] === 'col'), old = $('#big .bp-shelf[data-key="col"]');
  if (old && colR >= 0) {
    const [key2, label, items] = sh[colR];
    old.outerHTML = `<section class="bp-shelf${S.big.bpr === colR ? ' cur' : ''}" data-r="${colR}" data-key="col"><h3>${esc(label)}<span>${items.length}</span></h3>
      <div class="bp-row" data-key="${key2}">${items.map((x, c) => bpTileHTML(x, colR, c, S.big.bpr === colR && c === 0)).join('')}</div></section>`;
  } else bpRender();
}
function bpScrollIntoView(smooth = true) {
  const t = $('#big .bp-shelf.cur .bp-tile.on, #big .bp-shelf.cur .bp-tab.on'); if (!t) return;
  const row = t.parentElement, sc = $('#bpscroll');
  const want = t.offsetLeft - (S.big.bpr === 0 ? 0 : 48);
  if (t.offsetLeft < row.scrollLeft + 24 || t.offsetLeft + t.offsetWidth > row.scrollLeft + row.clientWidth - 24) row.scrollTo({ left: Math.max(0, want), behavior: smooth ? 'smooth' : 'auto' });
  const shelf = t.closest('.bp-shelf');
  if (sc) sc.scrollTo({ top: S.big.bpr === 0 ? 0 : Math.max(0, shelf.offsetTop - (shelf.classList.contains('bp-tabsrow') ? 260 : 120)), behavior: smooth ? 'smooth' : 'auto' });
}
// Перемещение без перерисовки — чтобы широкая плитка плавно раскрывалась
function bpFocus() {
  const { c, g, key } = bpPos();
  document.querySelectorAll('#big .bp-tile.on').forEach((x) => x.classList.remove('on', 'wide'));
  document.querySelectorAll('#big .bp-shelf').forEach((x) => x.classList.toggle('cur', +x.dataset.r === S.big.bpr));
  const tabsEl = $('#big .bp-tabsrow');
  if (tabsEl) tabsEl.outerHTML = bpTabsHTML(+tabsEl.dataset.r);
  if (key === 'tabs') { const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = bpLegendHTML(null); setTimeout(() => bpScrollIntoView(true), 20); return; }
  const t = $(`#big .bp-tile[data-r="${S.big.bpr}"][data-c="${c}"]`);
  if (!t) return bpRender();
  t.classList.add('on'); if (S.big.bpr === 0) t.classList.add('wide');
  if (S.big.bpr === 0) { const inf = $('#bp-info'); if (inf) inf.innerHTML = bpInfoHTML(g); }
  const bg = $('#big .bp-bg');
  if (bg && g) { bg.classList.add('fade'); clearTimeout(bpFocus.t); bpFocus.t = setTimeout(() => { bg.style.cssText = heroStyle(g); bg.classList.remove('fade'); }, 160); }
  const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = bpLegendHTML(g);
  setTimeout(() => bpScrollIntoView(true), 20);
}
function bpDir(dir) {
  if (S.big.menu) {
    const n = bpMenuItems().length;
    const j = dir === 'up' ? Math.max(0, S.big.mi - 1) : dir === 'down' ? Math.min(n - 1, S.big.mi + 1) : S.big.mi;
    if (j !== S.big.mi) { S.big.mi = j; sfx('move'); document.querySelectorAll('#big .bp-menu .sheet-item').forEach((x, i) => x.classList.toggle('on', i === j)); }
    return;
  }
  const { sh, key, items, c } = bpPos();
  if (key === 'tabs' && (dir === 'left' || dir === 'right')) {
    const cs = bpCollections(), j = Math.max(0, Math.min(cs.length - 1, c + (dir === 'right' ? 1 : -1)));
    if (j !== c) { bpSetTab(cs[j][0], true); sfx('move'); bpFocus(); }
    return;
  }
  if (dir === 'left' || dir === 'right') {
    const j = Math.max(0, Math.min(items.length - 1, c + (dir === 'right' ? 1 : -1)));
    if (j === c) return;
    S.big.bpc[key] = j; sfx('move'); return bpFocus();
  }
  // Вкладки коллекций переключаются только бамперами — вверх/вниз их перепрыгиваем, как в Steam
  let r = S.big.bpr + (dir === 'down' ? 1 : -1);
  while (sh[r] && sh[r][0] === 'tabs') r += dir === 'down' ? 1 : -1;
  if (!sh[r]) return;
  S.big.bpr = r; sfx('move'); bpFocus();
}
// LB / RB — переключить коллекцию, как вкладки в Steam
function bpShelfJump(d) {
  const cs = bpCollections(), i = Math.max(0, cs.findIndex((x) => x[0] === bpColl()[0]));
  const j = (i + d + cs.length) % cs.length; bpSetTab(cs[j][0]);
  // Сразу к играм выбранной коллекции
  const colR = bpShelves().findIndex((x) => x[0] === 'col');
  if (colR >= 0) { S.big.bpr = colR; S.big.bpc.col = 0; }
  bpFocus();
}
function bpMenuToggle(open = !S.big.menu) {
  const hadSheet = S.big.sheet;
  S.big.menu = open; S.big.mi = 0; S.big.sheet = false; sfx(open ? 'open' : 'close');
  if (hadSheet) return bpRender();
  document.querySelectorAll('#big > .sheet-back, #big > .bp-menu').forEach((x) => x.remove());
  if (open) $('#big').insertAdjacentHTML('beforeend', bpMenuHTML());
  const leg = $('#big .bp-legend'); if (leg) leg.outerHTML = bpLegendHTML(bigCurrent());
}
function switchMode(m) {
  if (m === 'normal') return closeBig();
  if (m === 'bp') return S.big.open && S.big.bp ? null : openBig({ bp: true });
  if (S.big.open && !S.big.bp) return;
  openBig({ bp: false });
}
setInterval(() => { const c = $('#bp-clock'); if (c) c.textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }, 15000);

// ─── Переключатель «Обычный / Компактный» и «Во весь экран» ───────────────────
function modeSwitchHTML() {
  // Режимы переключаются в настройках или комбинацией ⧉ + ≡ / Ctrl+B — в заголовке только «во весь экран»
  return `<button class="btn btn-ghost btn-icon tb-ico fs-btn${S.fs ? ' on' : ''}" data-act="toggle-fs" title="${S.fs ? 'Выйти из полноэкранного режима (F11)' : 'Во весь экран (F11)'}"><i class="ph ${S.fs ? 'ph-corners-in' : 'ph-corners-out'}"></i></button>`;
}
function modeSwitchHTMLOld() {
  return `<div class="mode-sw" role="group" title="Вид программы (Ctrl+B)">
      <button class="${S.big.open ? '' : 'on'}" data-act="set-mode" data-arg="normal"><i class="ph ph-rows"></i>Обычный</button>
      <button class="${S.big.open && !S.big.bp ? 'on' : ''}" data-act="set-mode" data-arg="compact"><i class="ph ph-squares-four"></i>Компактный</button>
      <button class="${S.big.bp ? 'on' : ''}" data-act="set-mode" data-arg="bp" title="ТВ-режим — для телевизора и геймпада (как Big Picture в Steam)"><i class="ph ph-television-simple"></i>ТВ-режим</button></div>
    <button class="btn btn-ghost btn-icon tb-ico fs-btn${S.fs ? ' on' : ''}" data-act="toggle-fs" title="${S.fs ? 'Выйти из полноэкранного режима (F11)' : 'Во весь экран (F11)'}"><i class="ph ${S.fs ? 'ph-corners-in' : 'ph-corners-out'}"></i></button>`;
}
function renderModeHost() { const h = $('#mode-host'); if (h) h.innerHTML = modeSwitchHTML(); document.body.classList.toggle('is-fs', !!S.fs); }
async function toggleFullscreen() {
  sfx('select');
  S.big.bpFs = false;   // пользователь сам выбрал режим окна — при выходе из Big Picture его не трогаем
  const on = await api.setFullscreen?.(!S.fs);
  if (typeof on === 'boolean') { S.fs = on; settings.fullscreen = on; saveSettingsQuiet(); renderModeHost(); if (S.big.open) renderBig(); }
}

// Ctrl + колёсико над списком — размер обложек
document.addEventListener('wheel', (e) => {
  if (!e.ctrlKey || !e.target.closest('#list')) return;
  e.preventDefault();
  const now = performance.now(); if (now - (setListSize.t || 0) < 180) return; setListSize.t = now;
  const i = LSIZES.findIndex((x) => x[0] === listSize()), j = Math.max(0, Math.min(LSIZES.length - 1, i + (e.deltaY < 0 ? 1 : -1)));
  if (j !== i) setListSize(LSIZES[j][0], true), sfx('move');
}, { passive: false });
// ТВ-режим: прокрутили страницу игры — верхней полоске с часами нужен фон, иначе текст просвечивает
document.addEventListener('scroll', (e) => {
  if (e.target?.id === 'bpage') document.body.classList.toggle('bp-scrolled', e.target.scrollTop > 30);
}, true);
// Лента скриншотов: без полосы прокрутки — стрелки по краям, затухание и прокрутка колёсиком вбок
function gxEdges(st) {
  const w = st.parentElement; if (!w) return;
  const max = st.scrollWidth - st.clientWidth - 8;
  w.classList.toggle('at-start', st.scrollLeft <= 8);
  w.classList.toggle('at-end', st.scrollLeft >= max);
  w.classList.toggle('no-scroll', max <= 0);
}
function gxEdgesAll() { requestAnimationFrame(() => document.querySelectorAll('.gx-media').forEach(gxEdges)); }
document.addEventListener('scroll', (e) => { if (e.target?.classList?.contains('gx-media')) gxEdges(e.target); }, true);
document.addEventListener('wheel', (e) => {
  const st = e.target.closest?.('.gx-media'); if (!st || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const max = st.scrollWidth - st.clientWidth;
  if ((e.deltaY > 0 && st.scrollLeft < max - 1) || (e.deltaY < 0 && st.scrollLeft > 1)) { e.preventDefault(); st.scrollBy({ left: e.deltaY * 1.6, behavior: 'smooth' }); }
}, { passive: false });
window.addEventListener('resize', gxEdgesAll);
// Картинка или видео из Steam не загрузились — убираем пустое место
document.addEventListener('error', (e) => {
  const t = e.target; if (!(t instanceof HTMLElement)) return;
  if (t.matches('.desc-img, .desc-vid')) t.remove();
  else if (t.matches('.gx-th img')) t.closest('.gx-th')?.remove();
}, true);
