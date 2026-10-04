'use strict';
// ─── Выбор нескольких ────────────────────────────────────────────────────────
function toggleSelect(id) { S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); sfx('move'); render(); }
function setSelMode(on) { S.selMode = on; S.selected.clear(); render(); }

// ─── Контекстное меню ────────────────────────────────────────────────────────
let menuItems = [];
function openMenu(x, y, items) {
  closeMenu();
  menuItems = items;
  const host = $('#menu-host');
  host.innerHTML = `<div class="menu" id="menu">${items.map((it, i) => it === '-' ? '<hr>'
    : it.head ? `<div class="menu-h">${esc(it.head)}</div>`
    : `<button data-mi="${i}" class="${it.danger ? 'danger' : ''}${it.on ? ' on' : ''}" data-nav>${it.dot ? `<span class="cat-dot" style="background:${esc(it.dot)}"></span>` : `<i class="${it.icon || 'ph ph-dot'}"></i>`}<span class="grow">${esc(it.label)}</span>${it.count != null ? `<span class="menu-n">${it.count}</span>` : ''}</button>`).join('')}</div>`;
  const m = $('#menu');
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.onclick = (e) => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = items[+b.dataset.mi]; closeMenu(); sfx('select'); it.run(); };
  setTimeout(() => document.addEventListener('mousedown', outsideMenu), 0);
  sfx('open');
  gpRefocus();
}
function outsideMenu(e) { if (!e.target.closest('#menu')) closeMenu(); }
function closeMenu() { if (!$('#menu')) return; $('#menu-host').innerHTML = ''; document.removeEventListener('mousedown', outsideMenu); gpRefocus(); }
function menuAt(el, items, align = 'right') {
  const r = el.getBoundingClientRect();
  openMenu(align === 'left' ? r.left : r.right - 230, r.bottom + 6, items);
}

function gameMenuItems(g) {
  return [
    { label: running.has(g.id) ? 'Уже запущена' : 'Играть', icon: 'ph-fill ph-play', run: () => launch(g.id) },
    '-',
    { label: g.favorite ? 'Убрать из избранного' : 'В избранное', icon: g.favorite ? 'ph-fill ph-star' : 'ph ph-star', run: () => toggleFav(g.id) },
    { label: g.completed ? 'Снять отметку «Пройдена»' : 'Отметить пройденной', icon: 'ph ph-check-circle', run: () => toggleCompleted(g.id) },
    { label: 'Добавить в список…', icon: 'ph ph-list-plus', run: () => assignCatDlg([g.id]) },
    '-',
    { label: 'Обновить обложку и описание', icon: 'ph ph-arrows-clockwise', run: () => enrichDlg(g.id) },
    { label: 'Обложка и фон…', icon: 'ph ph-image', run: () => coverDlg(g.id) },
    { label: 'Найти обложку и фон автоматически', icon: 'ph ph-magic-wand', run: () => quickEnrich(g.id) },
    { label: 'Изменить', icon: 'ph ph-pencil-simple', run: () => editDlg(g.id) },
    { label: 'Открыть папку', icon: 'ph ph-folder-open', run: () => openFolder(g.id) },
    '-',
    { label: g.hidden ? 'Вернуть в библиотеку' : 'Скрыть', icon: g.hidden ? 'ph ph-eye' : 'ph ph-eye-slash', run: () => toggleHidden(g.id) },
    { label: 'Удалить с компьютера…', icon: 'ph ph-trash-simple', danger: true, run: () => uninstallDlg(g.id) },
    { label: 'Убрать из библиотеки', icon: 'ph ph-minus-circle', run: () => deleteGames([g.id]) },
  ];
}
// Меню компактного режима — чтобы мышкой можно было сменить режим и открыть настройки
function bigMenuItems() {
  return [
    { label: 'Обычный режим', icon: 'ph ph-rows', run: () => switchMode('normal') },
    { label: 'ТВ-режим', icon: 'ph ph-television-simple', run: () => switchMode('bp') },
    '-',
    { label: 'Поиск игры', icon: 'ph ph-magnifying-glass', run: () => openPal() },
    { label: 'Статистика', icon: 'ph ph-chart-bar', run: () => statsDlg() },
    { label: 'Добавить игру', icon: 'ph ph-plus', run: () => addDlg() },
    { label: 'Найти мои игры…', icon: 'ph ph-magic-wand', run: () => wizardDlg() },
    { label: 'Списки и вкладки…', icon: 'ph ph-list-bullets', run: catsDlg },
    '-',
    { label: S.fs ? 'Выйти из полноэкранного режима' : 'Во весь экран', icon: S.fs ? 'ph ph-corners-in' : 'ph ph-corners-out', run: () => toggleFullscreen() },
    { label: 'Настройки', icon: 'ph ph-gear-six', run: () => settingsDlg() },
    '-',
    { label: 'Свернуть в трей', icon: 'ph ph-arrow-line-down', run: () => api.toTray() },
    { label: 'Выйти из программы', icon: 'ph ph-power', run: () => api.quit() },
  ];
}
function libMenuItems() {
  return [
    { label: 'Авто-данные для всей библиотеки', icon: 'ph ph-sparkle', run: () => batchDlg() },
    { label: S.selMode ? 'Закончить выбор' : 'Выбрать несколько', icon: 'ph ph-check-square', run: () => setSelMode(!S.selMode) },
    { label: 'Что поиграть?', icon: 'ph ph-dice-five', run: randomGame },
    { label: 'Статистика', icon: 'ph ph-chart-bar', run: () => statsDlg() },
    '-',
    { label: 'Проверить игры на компьютере', icon: 'ph ph-magnifying-glass-plus', run: () => checkDlg() },
    { label: 'Импорт из лаунчеров (Steam, Epic, GOG…)', icon: 'ph ph-download', run: () => addDlg({ tab: 'steam' }) },
    { label: 'Мастер настройки…', icon: 'ph ph-magic-wand', run: () => wizardDlg() },
    { label: 'Сканировать рабочий стол', icon: 'ph ph-desktop', run: () => scan('desktop') },
    { label: 'Списки и вкладки…', icon: 'ph ph-list-bullets', run: catsDlg },
    { label: 'Резервная копия', icon: 'ph ph-download-simple', run: backupDlg },
    { label: 'Настройки', icon: 'ph ph-gear-six', run: () => settingsDlg() },
  ];
}
// Меню фильтров: пройденные, скрытые, категории, жанры, теги
function filterMenuItems() {
  const vis = visible();
  const items = [];
  const it = (f, label, icon, count, extra = {}) => ({ label, icon, count, on: S.filter === f, run: () => setFilter(f, extra.flabel || label), ...extra });
  items.push(it('done', 'Пройденные', 'ph ph-check-circle', filterList('done').length));
  const hid = filterList('hidden').length;
  if (hid) items.push(it('hidden', 'Скрытые', 'ph ph-eye-slash', hid));
  const miss = filterList('missing').length;
  if (miss) items.push(it('missing', 'Нет на компьютере', 'ph ph-warning-circle', miss));
  items.push('-', { head: 'Мои списки' });
  cats.forEach((c) => items.push(it('cat:' + c.id, c.name, null, vis.filter((g) => inList(g, c.id)).length, { dot: catColor(c) })));
  items.push({ label: cats.length ? 'Списки и порядок вкладок…' : 'Создать список…', icon: 'ph ph-plus', run: catsDlg });
  const count = (fn) => { const m = {}; vis.forEach((g) => fn(g).forEach((t) => { const k = t.toLowerCase(); (m[k] ||= { label: t, n: 0 }).n++; })); return Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 10); };
  const gen = count(genresOf);
  if (gen.length) { items.push('-', { head: 'Жанры' }); gen.forEach(([k, v]) => items.push(it('genre:' + k, v.label, 'ph ph-shapes', v.n))); }
  const tags = count((g) => g.tags || []);
  if (tags.length) { items.push('-', { head: 'Теги' }); tags.forEach(([k, v]) => items.push(it('tag:' + k, '#' + v.label, 'ph ph-hash', v.n, { flabel: v.label }))); }
  return items;
}

// ─── Диалоги: общий механизм ─────────────────────────────────────────────────
let dlgClose = null;
function openDlg(html, { cls = '', onClose } = {}) {
  closeMenu();
  const host = $('#dlg');
  // Открываем окно поверх другого — сначала даём прежнему откатить незасохранённые превью
  if (dlgClose && dlgOpen()) { const prevCb = dlgClose; dlgClose = null; try { prevCb(); } catch {} }
  host.innerHTML = `<div class="dialog-backdrop"><div class="dialog ${cls}" role="dialog">${html}</div></div>`;
  const back = host.firstElementChild;
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeDlg(); });
  dlgClose = onClose || null;
  sfx('open');
  gpRefocus();
  return back.firstElementChild;
}
function closeDlg() {
  const cb = dlgClose; dlgClose = null;
  if (!dlgOpen()) return;
  $('#dlg').innerHTML = '';
  sfx('close');
  if (cb) cb();
  gpRefocus();
}
function dlgOpen() { return !!$('#dlg').firstElementChild; }
function head(title, sub = '') {
  return `<div class="dlg-head"><div style="flex:1;min-width:0"><div class="dialog-title">${title}</div>${sub ? `<div class="dlg-sub">${sub}</div>` : ''}</div>
    <button class="btn btn-ghost btn-icon dlg-x" data-act="dlg-close" title="Закрыть" data-nav><i class="ph ph-x"></i></button></div>`;
}
function chk(id, on, label, hint = '') {
  return `<label class="chk${on ? ' on' : ''}" data-chk="${id}" data-nav><span class="chk-box">${on ? '<i class="ph-bold ph-check"></i>' : ''}</span>
    <span>${label}${hint ? `<div class="hint">${hint}</div>` : ''}</span></label>`;
}
function chkVal(root, id) { return root.querySelector(`[data-chk="${id}"]`).classList.contains('on'); }
function bindChecks(root) {
  root.querySelectorAll('[data-chk]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.toggle('on');
    el.querySelector('.chk-box').innerHTML = el.classList.contains('on') ? '<i class="ph-bold ph-check"></i>' : '';
    el.dispatchEvent(new CustomEvent('chk'));
  }));
}
function confirmDlg(title, text, okLabel = 'OK') {
  return new Promise((resolve) => {
    let answered = false;
    const d = openDlg(`${head(esc(title))}<div class="dlg-text">${esc(text)}</div>
      <div class="dialog-actions"><button class="btn btn-secondary" data-r="0" data-nav>Отмена</button><button class="btn btn-primary" data-r="1" data-nav>${esc(okLabel)}</button></div>`,
    { onClose: () => { if (!answered) resolve(false); } });
    d.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { answered = true; resolve(b.dataset.r === '1'); closeDlg(); }));
  });
}

// ─── Добавление / изменение игры ─────────────────────────────────────────────
function editDlg(id, pre = null) {
  const orig = id ? byId(id) : null;
  const g = orig ? { ...orig } : { id: uid(), addedAt: Date.now(), name: pre?.name || '', playtime: 0, exePath: pre?.exe || '' };
  let cover = g.cover || null, coverChanged = false, busy = false;
  const d = openDlg(`${head(orig ? 'Изменить игру' : 'Добавить игру')}
    <div class="dlg-body"><div class="fields">
      <div class="field"><label>Название</label><input class="input" id="f-name" value="${esc(g.name)}" placeholder="Например, Hades II"></div>
      <div class="field"><label>Файл игры (.exe)</label>
        <div class="row-in"><input class="input mono" id="f-exe" value="${esc(g.exePath || g.lnkPath || '')}" placeholder="D:\\Games\\Game\\game.exe" style="font-size:12.5px">
        <button class="btn btn-secondary" id="f-browse">Обзор…</button></div>
        <div class="hint">Можно выбрать и ярлык — программа найдёт по нему файл игры и запомнит именно его.</div></div>
      <div class="field"><label>Параметры запуска (необязательно)</label><input class="input mono" id="f-args" value="${esc(g.args || '')}" placeholder="например: -windowed -novid" style="font-size:12.5px"></div>
      <div class="field"><label>Обложка</label>
        <div class="cover-pick"><div class="cover-prev" id="f-cprev"></div>
          <div class="cover-ops"><button class="btn btn-secondary" id="f-cfile" style="align-self:flex-start"><i class="ph ph-image"></i>Выбрать файл…</button>
            <div class="row-in"><input class="input" id="f-curl" placeholder="или вставьте ссылку на картинку"><button class="btn btn-secondary" id="f-curl-go">Загрузить</button></div>
            <div class="hint" style="margin:0">Проще всего — «Обновить данные» после сохранения: обложка найдётся сама.</div></div></div></div>
      <div class="field"><label>Описание</label><textarea class="input" id="f-desc" rows="3">${esc(g.description || '')}</textarea></div>
      <div class="row2">
        <div class="field"><label>Жанры (через запятую)</label><input class="input" id="f-genre" value="${esc(g.genre || '')}" placeholder="RPG, Экшен"></div>
        <div class="field"><label>Год</label><input class="input" id="f-year" value="${esc(g.year || '')}" placeholder="2024"></div>
      </div>
      <div class="field"><label>Разработчик</label><input class="input" id="f-dev" value="${esc(g.developer || '')}"></div>
      <div class="field"><label>Списки</label><div class="list-pick" id="f-lists">${cats.map((c) => `<button type="button" class="lp-opt${gameLists(g).includes(c.id) ? ' on' : ''}" data-l="${esc(c.id)}" data-nav><span class="chip-dot" style="background:${esc(catColor(c))}"></span>${esc(c.name)}<i class="ph-bold ph-check"></i></button>`).join('')}
        <button type="button" class="lp-opt lp-new" data-act="open-cats" data-nav><i class="ph ph-plus"></i>Новый список</button></div></div>
      <div class="field"><label>Теги (через запятую)</label><input class="input" id="f-tags" value="${esc((g.tags || []).join(', '))}" placeholder="на двоих, VR, пройти в 2026"></div>
    </div></div>
    <div class="dialog-actions"><button class="btn btn-secondary" data-act="dlg-close">Отмена</button><button class="btn btn-primary" id="f-save">${orig ? 'Сохранить' : 'Добавить'}</button></div>`, { cls: 'wide',
    // Новая обложка уже записана на диск вместо старой — даже при «Отмене» оставляем её, иначе картинка пропадёт
    onClose: () => { const cur = orig && byId(orig.id); if (cur && coverChanged && cur.cover !== cover) { cur.cover = cover; cur.coverSrc = 'user'; saveGame(cur); render(); } } });
  const prev = () => {
    const t = { ...g, cover, name: $('#f-name', d).value || g.name };
    const p = $('#f-cprev', d);
    p.setAttribute('style', coverBg(t));
    p.innerHTML = cover ? '' : `<span class="ini">${esc(initials(t.name || '?'))}</span>`;
  };
  prev();
  $('#f-lists', d).addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; b.classList.toggle('on'); sfx('move'); });
  $('#f-name', d).addEventListener('input', prev);
  $('#f-browse', d).onclick = async () => {
    const r = await api.pickExe(); if (!r) return;
    $('#f-exe', d).value = r.path;
    if (!$('#f-name', d).value.trim()) { $('#f-name', d).value = r.name; prev(); }
  };
  $('#f-cfile', d).onclick = async () => { const u = await api.pickImage(g.id); if (u) { cover = u; coverChanged = true; prev(); } };
  $('#f-curl-go', d).onclick = async () => {
    const url = $('#f-curl', d).value.trim(); if (!url) return;
    toast('Загружаю обложку…');
    const u = await api.downloadImage(url, g.id);
    if (u) { cover = u; coverChanged = true; prev(); toast('Обложка загружена', 'ok'); } else toast('Не удалось загрузить картинку по этой ссылке', 'err');
  };
  $('#f-save', d).onclick = async () => {
    if (busy) return;
    // Пока окно было открыто, фоновые задачи могли обновить игру (обложка, фон, описание) — берём свежие данные,
    // а из формы — только то, что в ней редактируется
    if (orig) {
      const cur = byId(orig.id);
      if (cur) {
        const FORM = new Set(['name', 'description', 'genre', 'year', 'developer', 'catId', 'lists', 'tags', 'args', 'exePath', 'lnkPath', 'isLnk', 'cover']);
        for (const k of Object.keys(cur)) if (!FORM.has(k)) g[k] = cur[k];
        if (!coverChanged) cover = cur.cover ?? null;
      }
    }
    const name = $('#f-name', d).value.trim();
    g.args = $('#f-args', d).value.trim();
    const exe = $('#f-exe', d).value.trim().replace(/^"|"$/g, '');
    if (!name) return toast('Введите название', 'err');
    if (!exe) return toast('Укажите файл запуска', 'err');
    const newDesc = $('#f-desc', d).value.trim();
    if (orig && newDesc !== (orig.description || '')) g.descUser = true;   // описание правили вручную — фоновые задачи его не трогают
    g.name = name; g.description = newDesc;
    g.genre = translateGenre($('#f-genre', d).value); g.year = $('#f-year', d).value.trim();
    g.developer = $('#f-dev', d).value.trim();
    g.lists = [...d.querySelectorAll('#f-lists .lp-opt.on')].map((b) => b.dataset.l); g.catId = null;
    g.tags = $('#f-tags', d).value.split(',').map((t) => t.trim()).filter(Boolean);
    g.cover = cover; if (coverChanged) g.coverSrc = 'user';
    busy = true; $('#f-save', d).disabled = true;
    let linkMsg = '';
    if (exe.toLowerCase().endsWith('.lnk')) { g.lnkPath = exe; g.isLnk = true; g.exePath = exe; g.args = ''; }
    else { g.lnkPath = null; g.isLnk = false; g.exePath = exe; }
    if (!orig || g.exePath !== orig.exePath || g.lnkPath !== orig.lnkPath) {
      const ln = await applyStoreLinks([g]);
      if (ln.length) linkMsg = `«${g.name}» — игра ${STORES[g.store][0]}, будет запускаться через ${STORES[g.store][0]}`;
      else if (g.lnkPath) {
        // Ярлык нужен только чтобы найти игру — дальше запоминаем сам .exe
        const ok = await detachShortcut(g);
        if (!ok) { busy = false; $('#f-save', d).disabled = false; return toast('Ярлык ведёт не на программу (.exe). Укажите файл игры через «Обзор…».', 'err'); }
        linkMsg = `«${g.name}» добавлена по файлу игры, а не по ярлыку — ярлык можно удалять или переносить`;
      }
    }
    if (!orig) { const k = gameKey(g), dup = k && games.find((x) => gameKey(x) === k);
      if (dup) { closeDlg(); select(dup.id); return toast(`«${dup.name}» уже есть в библиотеке`); } }
    await saveGame(g);
    if (orig) Object.assign(orig, g); else games.push(g);
    closeDlg(); render();
    toast(linkMsg || (orig ? 'Изменения сохранены' : `«${g.name}» добавлена`), 'ok');
  };
  setTimeout(() => $('#f-name', d).focus(), 50);
}

// ─── Проверка: какие игры ещё есть на компьютере ─────────────────────────────
async function checkDlg() {
  const d = openDlg(`${head('Проверка игр', 'Есть ли игры из библиотеки на этом компьютере')}<div class="dlg-body" id="ck"><div class="add-empty"><i class="ph ph-circle-notch spin"></i>Проверяю ${games.length} ${plural(games.length, 'игру', 'игры', 'игр')}…</div></div>
    <div class="dialog-actions" id="ck-act"><button class="btn btn-secondary" data-act="dlg-close">Закрыть</button></div>`, { cls: 'wide' });
  await refreshExists();
  if (!dlgOpen() || !$('#ck', d)) return;
  // Сначала пробуем найти «потерявшиеся» игры: вдруг их переустановили через Steam/Epic
  const miss0 = games.filter(isMissing);
  if (miss0.length) {
    const relinked = await applyStoreLinks(miss0.map((g) => ({ ...g, store: null, storeId: null }))).catch(() => []);
    if (relinked.length) {
      for (const r of relinked) { const g = byId(r.id); if (g) Object.assign(g, { store: r.store, storeId: r.storeId, installDir: r.installDir, launchUrl: r.launchUrl, exePath: r.exePath, lnkPath: r.lnkPath, isLnk: r.isLnk }); }
      await api.saveGamesBulk(relinked.map((r) => byId(r.id)).filter(Boolean));
      await refreshExists();
    }
  }
  const miss = games.filter(isMissing);
  const ok = games.length - miss.length;
  const picked = new Set(miss.map((g) => g.id));
  const draw = () => {
    $('#ck', d).innerHTML = miss.length
      ? `<div class="ck-sum"><span class="ok"><i class="ph-fill ph-check-circle"></i>На месте: ${ok}</span><span class="bad"><i class="ph-fill ph-warning-circle"></i>Не найдено: ${miss.length}</span></div>
         <div class="hint" style="margin:0">Эти игры удалены с компьютера или перенесены в другую папку. Отмеченные можно убрать из библиотеки (время в игре и заметки тоже удалятся), а перенесённой игре — указать новый путь.</div>
         <div class="ck-list">${miss.map((g) => `<div class="ck-item${picked.has(g.id) ? ' on' : ''}" data-ck="${esc(g.id)}">
           <span class="chk-box">${picked.has(g.id) ? '<i class="ph-bold ph-check"></i>' : ''}</span>
           <div class="ck-ic" style="${coverBg(g)}"></div>
           <div class="grow"><b>${srcIconHTML(g, 'nsrc')}${esc(g.name)}</b><span class="mono">${esc(g.installDir || g.exePath || g.lnkPath || '—')}</span></div>
           <button class="btn btn-ghost" data-relocate="${esc(g.id)}" title="Указать, где игра теперь"><i class="ph ph-folder-simple-dashed"></i>Новый путь</button></div>`).join('')}</div>`
      : `<div class="ck-allok"><i class="ph-fill ph-check-circle"></i><b>Все игры на месте</b><span>${ok} ${plural(ok, 'игра найдена', 'игры найдены', 'игр найдено')} на компьютере.</span></div>`;
    $('#ck-act', d).innerHTML = `<button class="btn btn-secondary" data-act="dlg-close">Закрыть</button>${miss.length ? `<button class="btn btn-primary" id="ck-rm"${picked.size ? '' : ' disabled'}>Убрать из библиотеки (${picked.size})</button>` : ''}`;
  };
  d.addEventListener('click', async (e) => {
    const rel = e.target.closest('[data-relocate]');
    if (rel) { closeDlg(); return editDlg(rel.dataset.relocate); }
    const it = e.target.closest('[data-ck]');
    if (it) { const id = it.dataset.ck; picked.has(id) ? picked.delete(id) : picked.add(id); sfx('move'); return draw(); }
    if (e.target.closest('#ck-rm')) {
      const ids = [...picked]; if (!ids.length) return;
      await api.deleteGames(ids);
      const set = new Set(ids); games = games.filter((g) => !set.has(g.id));
      if (set.has(S.selId)) S.selId = null;
      closeDlg(); render(); sfx('success');
      toast(`Убрано из библиотеки: ${ids.length}`, 'ok');
    }
  });
  draw();
}

// ─── Полное удаление игры с компьютера ───────────────────────────────────────
function fmtSize(b) { if (!b) return '0 Б'; const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']; const i = Math.min(4, Math.floor(Math.log(b) / Math.log(1024))); return (b / 1024 ** i).toFixed(i > 1 ? 1 : 0).replace('.', ',') + ' ' + u[i]; }
async function uninstallDlg(id) {
  const g = byId(id); if (!g) return;
  if (running.has(g.id)) return toast('Сначала закройте игру', 'err');
  const st = storeOf(g);
  const d = openDlg(`${head('Удалить с компьютера', esc(g.name))}<div class="dlg-body" id="un"><div class="add-empty"><i class="ph ph-circle-notch spin"></i>Ищу, как правильно удалить игру…</div></div>
    <div class="dialog-actions" id="un-act"><button class="btn btn-secondary" data-act="dlg-close">Отмена</button></div>`, { cls: 'wide' });
  const info = await api.uninstallInfo?.({ id: g.id, name: g.name, store: st, storeId: g.storeId, exePath: g.exePath, lnkPath: g.lnkPath, installDir: g.installDir }).catch(() => null) || {};
  if (!dlgOpen() || !$('#un', d)) return;
  const opts = [];
  if (st === 'steam' && g.storeId) opts.push({ k: 'steam', icon: STORE_ICONS.steam ? `<img src="${esc(STORE_ICONS.steam)}" alt="">` : '<i class="ph ph-steam-logo"></i>', t: 'Через Steam', sub: 'Рекомендуется. Steam сам удалит игру и спросит подтверждение.' });
  if (st === 'epic') opts.push({ k: 'epic', icon: STORE_ICONS.epic ? `<img src="${esc(STORE_ICONS.epic)}" alt="">` : '<i class="ph ph-storefront"></i>', t: 'Через Epic Games', sub: 'Откроется библиотека Epic: на игре нажмите «⋯» → «Удалить».' });
  if (info.uninstaller) opts.push({ k: 'uninstaller', icon: '<i class="ph ph-package"></i>', t: 'Деинсталлятор игры', sub: `«${esc(info.uninstaller.name)}» — как в «Программы и компоненты» Windows. Удалит игру вместе с записями в системе.` });
  if (info.folder) opts.push({ k: 'folder', icon: '<i class="ph ph-trash"></i>', t: 'Удалить папку игры в Корзину', sub: `${esc(info.folder)}<br>${fmtSize(info.size)}, файлов: ${info.files}. Если передумаете — восстановите из Корзины.`, mono: true });
  let pick = opts[0]?.k || null, removeFromLib = true, trashFail = null;
  const draw = () => {
    if (trashFail) {
      $('#un', d).innerHTML = `<div class="dlg-text warn-box"><i class="ph ph-warning"></i><span><b>Windows не смогла положить папку в Корзину.</b><br>
        ${trashFail.busy ? `Файл <span class="mono">${esc(trashFail.busy)}</span> занят — закройте игру, её лаунчер или античит и попробуйте снова.`
          : `Скорее всего, папка (${fmtSize(info.size)}) больше, чем вмещает Корзина на этом диске, или диск съёмный/сетевой — у таких Корзины нет.`}</span></div>
        <div class="dlg-text">Можно удалить папку <b>навсегда</b>, минуя Корзину. Восстановить её потом будет нельзя.</div>
        <div class="mono un-path">${esc(info.folder)}</div>
        ${chk('un-lib', removeFromLib, 'Убрать игру из библиотеки после удаления', '')}`;
      $('#un-act', d).innerHTML = `<button class="btn btn-secondary" data-act="dlg-close">Отмена</button>
        ${trashFail.busy ? '<button class="btn btn-secondary" id="un-go" data-retry="1">Попробовать снова</button>' : ''}
        <button class="btn btn-primary btn-danger" id="un-go" data-perm="1"><i class="ph ph-trash-simple"></i>Удалить навсегда</button>`;
      bindChecks(d);
      d.querySelector('[data-chk="un-lib"]')?.addEventListener('chk', () => { removeFromLib = chkVal(d, 'un-lib'); });
      return;
    }
    $('#un', d).innerHTML = opts.length ? `<div class="un-opts">${opts.map((o) => `<label class="un-opt${pick === o.k ? ' on' : ''}" data-un="${o.k}"><span class="un-radio"></span><span class="un-ic">${o.icon}</span>
        <div class="grow"><b>${esc(o.t)}</b><span class="${o.mono ? 'mono' : ''}">${o.sub}</span></div></label>`).join('')}</div>
      ${chk('un-lib', removeFromLib, 'Убрать игру из библиотеки после удаления', 'Иначе она останется со статусом «Нет на компьютере» — с временем в игре и заметками.')}
      ${pick === 'folder' ? '<div class="dlg-text warn-box"><i class="ph ph-warning"></i><span>Сохранения игры, если они лежат в её папке, тоже окажутся в Корзине. Сохранения в «Документах» и AppData не трогаются.</span></div>' : ''}`
      : `<div class="dlg-text">Не нашлось безопасного способа удалить эту игру автоматически: у неё нет деинсталлятора, а папка общая или системная. Откройте папку и удалите вручную.</div>
         <button class="btn btn-secondary" data-act="folder" data-id="${esc(g.id)}" style="align-self:flex-start"><i class="ph ph-folder-open"></i>Открыть папку игры</button>`;
    $('#un-act', d).innerHTML = `<button class="btn btn-secondary" data-act="dlg-close">Отмена</button>${opts.length ? `<button class="btn btn-primary btn-danger" id="un-go"><i class="ph ph-trash-simple"></i>Удалить</button>` : ''}`;
    bindChecks(d);
    d.querySelector('[data-chk="un-lib"]')?.addEventListener('chk', () => { removeFromLib = chkVal(d, 'un-lib'); });
  };
  d.addEventListener('click', async (e) => {
    const o = e.target.closest('[data-un]'); if (o) { pick = o.dataset.un; sfx('move'); return draw(); }
    if (!e.target.closest('#un-go')) return;
    const btn = e.target.closest('#un-go');
    if (btn.dataset.retry) trashFail = null;
    const perm = btn.dataset.perm === '1';
    btn.disabled = true; btn.innerHTML = '<i class="ph ph-circle-notch spin"></i>' + (perm ? 'Удаляю навсегда…' : 'Удаляю…');
    d.querySelectorAll('[data-act="dlg-close"]').forEach((b) => { b.disabled = true; });
    const r = await api.uninstallGame({ id: g.id, name: g.name, storeId: g.storeId, exePath: g.exePath, installDir: g.installDir, folder: info.folder, uninstallCmd: info.uninstaller?.cmd }, perm ? 'folder-perm' : pick);
    d.querySelectorAll('[data-act="dlg-close"]').forEach((b) => { b.disabled = false; });
    if (!r?.ok && r?.trashFailed) {   // Корзина не взяла папку — предлагаем удалить навсегда
      trashFail = r; draw(); sfx('error'); return;
    }
    if (!r?.ok) { draw(); return toast('Не удалось удалить: ' + (r?.error || 'неизвестная ошибка'), 'err'); }
    closeDlg();
    if (!r.external) {   // папка удалена (в Корзину или навсегда)
      if (removeFromLib) { await api.deleteGames([g.id]); games = games.filter((x) => x.id !== g.id); if (S.selId === g.id) S.selId = null; }
      else exists.set(g.id, false);
      render(); sfx('success'); return toast(r.permanent ? `«${g.name}» удалена с компьютера` : `«${g.name}» удалена в Корзину`, 'ok');
    }
    toast(r.manual ? 'Открыта библиотека Epic — удалите игру там' : 'Удаление запущено — следуйте подсказкам', 'ok');
    // Ждём, пока файлы игры исчезнут (до 15 минут), и тогда обновляем библиотеку
    const t0 = Date.now();
    const poll = async () => {
      const [ok] = await api.checkGames([{ exePath: g.exePath, lnkPath: g.lnkPath, installDir: g.installDir }]).catch(() => [true]);
      if (!ok) {
        if (removeFromLib && byId(g.id)) { await api.deleteGames([g.id]); games = games.filter((x) => x.id !== g.id); if (S.selId === g.id) S.selId = null; toast(`«${g.name}» удалена с компьютера и из библиотеки`, 'ok'); }
        else { exists.set(g.id, false); toast(`«${g.name}» удалена с компьютера`, 'ok'); }
        return render();
      }
      if (Date.now() - t0 < 15 * 60 * 1000) setTimeout(poll, 5000);
    };
    setTimeout(poll, 5000);
  });
  draw();
}

// ─── Мастер первого запуска: игры → ключи → обложки ──────────────────────────
async function wizardDlg() {
  const W = { step: 0, stores: null, importAll: true, rawg: settings.rawgKey || '', sgdb: settings.sgdbKey || '', art: true, test: null };
  // «Уже в библиотеке» считаем каждый раз заново: пока открыт мастер, автопоиск мог добавить эти игры
  const known = () => new Set(games.filter((g) => g.store && g.storeId).map((g) => g.store + ':' + g.storeId));
  const fresh = () => { const k = known(); return (W.stores || []).filter((x) => !k.has(x.store + ':' + x.storeId)); };
  const d = openDlg('<div id="wz"></div>', { cls: 'wizard' });
  const steps = ['Игры', 'Обложки и описания', 'Готово'];
  const draw = () => {
    const st = W.stores ? fresh() : [];
    const nS = st.filter((x) => x.store === 'steam').length, nE = st.filter((x) => x.store === 'epic').length;
    const ic = (k) => STORE_ICONS[k] ? `<img src="${esc(STORE_ICONS[k])}" alt="">` : `<i class="${STORES[k][1]}"></i>`;
    const body = [
      `<h2>Добро пожаловать в Game Library</h2>
       <p class="wz-lead">Соберём все ваши игры в одном месте. Сначала найдём то, что уже установлено.</p>
       ${!W.stores ? '<div class="wz-find"><i class="ph ph-circle-notch spin"></i>Ищу игры Steam, Epic, GOG, Ubisoft, EA и Battle.net…</div>'
         : `<div class="wz-stores">
             <div class="wz-store"><span class="wz-ic">${ic('steam')}</span><div><b>Steam</b><span>${nS ? `${nS} ${plural(nS, 'игра найдена', 'игры найдены', 'игр найдено')}` : 'игр не найдено'}</span></div></div>
             <div class="wz-store"><span class="wz-ic">${ic('epic')}</span><div><b>Epic Games</b><span>${nE ? `${nE} ${plural(nE, 'игра найдена', 'игры найдены', 'игр найдено')}` : 'игр не найдено'}</span></div></div>
             ${(() => { const o = st.filter((x) => x.store !== 'steam' && x.store !== 'epic'); if (!o.length) return '';
               const names = [...new Set(o.map((x) => STORES[x.store]?.[0]).filter(Boolean))].join(', ');
               return `<div class="wz-store"><span class="wz-ic"><i class="ph ph-stack"></i></span><div><b>${esc(names)}</b><span>${o.length} ${plural(o.length, 'игра найдена', 'игры найдены', 'игр найдено')}</span></div></div>`; })()}
           </div>
           ${st.length ? chk('wz-all', W.importAll, `Добавить все найденные игры (${st.length})`, 'Потом их можно скрыть или удалить.') : ''}`}
       <div class="wz-more"><span>Остальные игры можно добавить так:</span>
         <button class="btn btn-secondary" data-w="pick"><i class="ph ph-list-checks"></i>Выбрать из программ на компьютере…</button>
         <button class="btn btn-secondary" data-w="scan"><i class="ph ph-folder-open"></i>Сканировать папку с играми…</button></div>`,
      `<h2>Обложки, фоны и описания</h2>
       <p class="wz-lead">Программа сама найдёт картинки и описание для каждой игры. Нужны два бесплатных ключа — это займёт пару минут.</p>
       <div class="wz-key"><div class="wz-kh"><b>1. RAWG</b><span>описания, жанры, год</span></div>
         <ol><li>Откройте <a data-url="https://rawg.io/apidocs">rawg.io/apidocs</a> и войдите (можно через Google).</li><li>Нажмите «Get API Key» и скопируйте ключ.</li></ol>
         <input class="input" id="wz-rawg" placeholder="Вставьте ключ RAWG" value="${esc(W.rawg)}"></div>
       <div class="wz-key"><div class="wz-kh"><b>2. SteamGridDB</b><span>вертикальные обложки, фоны, логотипы</span></div>
         <ol><li>Откройте <a data-url="https://www.steamgriddb.com/profile/preferences/api">steamgriddb.com → API</a> и войдите через Steam.</li><li>Нажмите «Generate API Key» и скопируйте ключ.</li></ol>
         <input class="input" id="wz-sgdb" placeholder="Вставьте ключ SteamGridDB" value="${esc(W.sgdb)}"></div>
       <div class="btn-row"><button class="btn btn-secondary" data-w="test"><i class="ph ph-plug"></i>Проверить ключи</button><span class="hint" style="margin:0">${W.test || ''}</span></div>`,
      `<h2>Всё готово</h2>
       <p class="wz-lead">${W.importAll && st.length ? `Будет добавлено игр: <b>${st.length}</b>. ` : ''}${W.rawg || W.sgdb ? 'Ключи сохранены.' : 'Ключи можно добавить позже в настройках.'}</p>
       ${W.rawg || W.sgdb ? chk('wz-art', W.art, 'Сразу скачать обложки, фоны и описания', 'Идёт в фоне, можно пользоваться программой.') : ''}
       <div class="wz-tips">
         <div><i class="ph ph-magnifying-glass"></i><span><b>Ctrl+K</b> — найти и запустить любую игру</span></div>
         <div><i class="ph ph-squares-four"></i><span><b>Обычный / Компактный</b> — переключатель вида в заголовке</span></div>
         <div><i class="ph ph-game-controller"></i><span>Геймпад работает везде: <b>Start</b> — сменить вид, правый стик — прокрутка</span></div>
       </div>`,
    ][W.step];
    $('#wz', d).innerHTML = `<div class="wz-steps">${steps.map((t, i) => `<span class="${i === W.step ? 'on' : i < W.step ? 'done' : ''}"><em>${i < W.step ? '<i class="ph-bold ph-check"></i>' : i + 1}</em>${t}</span>`).join('<i class="ph ph-caret-right"></i>')}</div>
      <div class="wz-body">${body}</div>
      <div class="dialog-actions">${W.step === 0 ? '<button class="btn btn-ghost" data-w="skip">Пропустить</button>' : '<button class="btn btn-secondary" data-w="back">Назад</button>'}
        <span style="flex:1"></span><button class="btn btn-primary" data-w="next">${W.step === 2 ? 'Начать' : W.step === 1 && !W.rawg && !W.sgdb ? 'Пропустить' : 'Далее'}</button></div>`;
    bindChecks(d);
    d.querySelector('[data-chk="wz-all"]')?.addEventListener('chk', () => { W.importAll = chkVal(d, 'wz-all'); });
    d.querySelector('[data-chk="wz-art"]')?.addEventListener('chk', () => { W.art = chkVal(d, 'wz-art'); });
    $('#wz-rawg', d)?.addEventListener('input', (e) => { W.rawg = e.target.value.trim(); d.querySelector('[data-w="next"]').textContent = W.rawg || W.sgdb ? 'Далее' : 'Пропустить'; });
    $('#wz-sgdb', d)?.addEventListener('input', (e) => { W.sgdb = e.target.value.trim(); d.querySelector('[data-w="next"]').textContent = W.rawg || W.sgdb ? 'Далее' : 'Пропустить'; });
  };
  const finish = async () => {
    settings.onboarded = true;
    if (W.rawg) settings.rawgKey = W.rawg;
    if (W.sgdb) settings.sgdbKey = W.sgdb;
    await saveSettingsQuiet();
    let add = [];
    if (W.importAll && W.stores) {
      add = fresh().map((x) => ({ id: uid(), name: x.name, exePath: x.exePath, lnkPath: null, isLnk: false, store: x.store, storeId: x.storeId,
        launchUrl: x.launchUrl || null, installDir: x.installDir, workDir: x.workDir || null, args: x.args || null, addedAt: Date.now(), cover: null, description: '', genre: '', year: '', developer: '', playtime: 0 }));
      if (add.length) { await api.saveGamesBulk(add); games.push(...add); await syncSteamTime(); }
    }
    closeDlg(); S.filter = 'all'; render();
    if (add.length) toast(`Добавлено игр: ${add.length}`, 'ok');
    if ((W.rawg || W.sgdb) && W.art && games.length) batchDlg(null, true);
  };
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const w = b.dataset.w;
    if (w === 'skip') { settings.onboarded = true; saveSettingsQuiet(); return closeDlg(); }
    if (w === 'back') { W.step--; sfx('back'); return draw(); }
    if (w === 'next') { if (W.step === 2) return finish(); W.step++; sfx('select'); return draw(); }
    if (w === 'pick') { settings.onboarded = true; saveSettingsQuiet(); closeDlg(); return addDlg(); }
    if (w === 'scan') { settings.onboarded = true; saveSettingsQuiet(); closeDlg(); return scan('folder'); }
    if (w === 'test') {
      W.test = 'Проверяю…'; draw();
      const r = await api.testArtKeys?.({ rawgKey: W.rawg, sgdbKey: W.sgdb });
      const t = { ok: '✓ работает', bad: '✗ неверный ключ', err: 'нет связи', none: 'не задан' };
      W.test = r ? `RAWG: ${t[r.rawg]} · SteamGridDB: ${t[r.sgdb]}` : ''; draw();
    }
  });
  draw();
  W.stores = await (api.listStoreGames?.() || Promise.resolve([])).catch(() => []);
  if (dlgOpen() && $('#wz', d) && W.step === 0) draw();
}

// ─── Добавить игру: поиск программ на компьютере (как в приложении Xbox) ─────
const PROG_ICONS = new Map();
let progCache = null;
async function addDlg(opts = {}) {
  let items = [], q = '', tab = opts.tab || 'steam';
  const picked = new Set();
  const d = openDlg(`<div class="add-top"><h2 class="add-t">Добавить игру в библиотеку</h2>
      <button class="btn btn-ghost btn-icon dlg-x" data-act="dlg-close" title="Закрыть" data-nav><i class="ph ph-x"></i></button></div>
    <div class="add-bar"><div class="add-search"><i class="ph ph-magnifying-glass"></i><input id="a-q" placeholder="Поиск игр и программ на компьютере" spellcheck="false" autocomplete="off" data-nav>
      <button class="add-clear" id="a-clear" title="Очистить" hidden><i class="ph ph-x"></i></button></div>
      <button class="btn btn-secondary btn-icon add-folder" id="a-browse" title="Выбрать .exe или ярлык вручную" data-nav><i class="ph ph-folder-open"></i></button></div>
    <div class="add-tabs" id="a-tabs"></div>
    <div class="add-cols">
      <div class="add-list" id="a-list"><div class="add-empty"><i class="ph ph-circle-notch spin"></i>Ищу программы в меню «Пуск» и на рабочем столе…</div></div>
      <div class="add-side">
        <button class="btn btn-primary" id="a-add" disabled data-nav>Добавить</button>
        <button class="btn btn-secondary" data-act="dlg-close" data-nav>Отменить</button>
        <button class="btn btn-ghost" id="a-all" data-nav><i class="ph ph-checks"></i>Выбрать все новые</button>
        <div class="add-sel" id="a-sel"></div>
        ${chk('a-enrich', settings.scanEnrich !== false, 'Найти обложки и описания', 'Сразу после добавления.')}
        <div class="add-more"><span>Нет в списке?</span>
          <button class="btn btn-ghost" data-act="scan-folder" data-nav><i class="ph ph-folders"></i>Сканировать папку</button>
          <button class="btn btn-ghost" id="a-browse2" data-nav><i class="ph ph-file-plus"></i>Выбрать файл…</button></div>
      </div>
    </div>`, { cls: 'add-dlg' });
  bindChecks(d);
  const known = new Set(games.flatMap((g) => [g.lnkPath, g.exePath]).filter(Boolean).map((p) => p.toLowerCase()));
  const libStore = new Set(games.filter((g) => g.store && g.storeId).map((g) => g.store + ':' + g.storeId));
  const keyOf = (x) => x.store ? x.store + ':' + x.storeId : (x.lnkPath || x.exePath).toLowerCase();
  const inLib = (x) => (x.store && libStore.has(keyOf(x))) || known.has((x.lnkPath || x.exePath || '').toLowerCase()) || known.has(String(x.exePath).toLowerCase());
  const inTab = (x, t) => t === 'all' || (t === 'prog' ? !x.store : x.store === t);
  const list = () => {
    const t = q.trim().toLowerCase();
    return items.filter((x) => inTab(x, tab) && (!t || x.name.toLowerCase().includes(t) || String(x.exePath).toLowerCase().includes(t)));
  };
  const drawTabs = () => {
    const tabs = [['steam', 'Steam', 'steam'], ['epic', 'Epic Games', 'epic'], ['gog', 'GOG', 'gog'], ['ubisoft', 'Ubisoft', 'ubisoft'], ['ea', 'EA', 'ea'], ['battlenet', 'Battle.net', 'battlenet'], ['all', 'Все', null], ['prog', 'Программы на ПК', null]];
    $('#a-tabs', d).innerHTML = tabs.map(([k, l, st]) => {
      const n = items.filter((x) => inTab(x, k)).length;
      if (st && !n) return '';
      const ic = st ? (STORE_ICONS[st] ? `<img src="${esc(STORE_ICONS[st])}" alt="">` : `<i class="${STORES[st][1]}"></i>`) : '';
      return `<button class="add-tab${tab === k ? ' on' : ''}" data-tab="${k}" data-nav>${ic}${esc(l)}<span>${n}</span></button>`;
    }).join('');
  };
  const iconFor = (x) => PROG_ICONS.get(keyOf(x));
  const draw = () => {
    const l = list();
    $('#a-list', d).innerHTML = l.length ? l.map((x) => {
      const k = keyOf(x), lib = inLib(x), on = picked.has(k), ic = iconFor(x);
      const st = x.store || (x.urlStore === 'steam' ? 'steam' : x.urlStore === 'com.epicgames.launcher' ? 'epic' : null);
      const badge = st ? (STORE_ICONS[st] ? `<img class="add-badge" src="${esc(STORE_ICONS[st])}" alt="">` : `<i class="${STORES[st][1]} add-badge"></i>`) : '';
      return `<div class="add-item${on ? ' on' : ''}${lib ? ' lib' : ''}" data-k="${esc(k)}" data-nav>
        <div class="add-ico">${ic ? `<img src="${esc(ic)}" alt="">` : `<i class="ph ${st ? 'ph-game-controller' : 'ph-app-window'}"></i>`}${badge}</div>
        <div class="add-txt"><b>${esc(x.name)}</b><span>${st ? `<em class="add-st">${esc(STORES[st][0])}</em> · ` : ''}${esc(x.installDir || (x.urlStore ? 'ярлык лаунчера' : x.exePath))}</span></div>
        ${lib ? '<span class="tag tag-neutral">В библиотеке</span>' : `<span class="chk-box">${on ? '<i class="ph-bold ph-check"></i>' : ''}</span>`}</div>`;
    }).join('') : `<div class="add-empty">${items.length ? 'Ничего не найдено. Выберите файл вручную кнопкой с папкой.' : 'Программы не найдены.'}</div>`;
    const n = picked.size;
    $('#a-add', d).disabled = !n;
    $('#a-add', d).textContent = n > 1 ? `Добавить (${n})` : 'Добавить';
    $('#a-sel', d).textContent = n ? `Выбрано: ${n}` : 'Отметьте одну или несколько игр';
    loadIcons(l.slice(0, 80));
  };
  let iconBusy = false;
  const loadIcons = async (l) => {
    if (iconBusy || !api.fileIcons) return;
    const need = l.filter((x) => !PROG_ICONS.has(keyOf(x))).slice(0, 40);
    if (!need.length) return;
    iconBusy = true;
    need.forEach((x) => PROG_ICONS.set(keyOf(x), null));
    const res = await api.fileIcons(need.map((x) => ({ key: keyOf(x), iconPath: x.iconPath, iconFile: x.iconFile }))).catch(() => ({}));
    iconBusy = false;
    for (const [k, v] of Object.entries(res || {})) PROG_ICONS.set(k, v);
    if (!dlgOpen() || !$('#a-list', d)) return;
    d.querySelectorAll('.add-item').forEach((row) => { const v = PROG_ICONS.get(row.dataset.k); if (v) row.querySelector('.add-ico').innerHTML = `<img src="${esc(v)}" alt="">`; });
    loadIcons(list().slice(0, 80));
  };
  $('#a-tabs', d).addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; sfx('tab'); drawTabs(); draw(); });
  $('#a-all', d).onclick = () => { list().filter((x) => !inLib(x)).forEach((x) => picked.add(keyOf(x))); sfx('select'); draw(); };
  $('#a-list', d).addEventListener('click', (e) => {
    const row = e.target.closest('.add-item'); if (!row || row.classList.contains('lib')) return;
    const k = row.dataset.k;
    picked.has(k) ? picked.delete(k) : picked.add(k);
    sfx('move'); draw();
  });
  $('#a-list', d).addEventListener('dblclick', (e) => {
    const row = e.target.closest('.add-item'); if (!row || row.classList.contains('lib')) return;
    picked.clear(); picked.add(row.dataset.k); $('#a-add', d).click();
  });
  const qEl = $('#a-q', d);
  qEl.addEventListener('input', () => { q = qEl.value; $('#a-clear', d).hidden = !q; draw(); });
  qEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const l = list().filter((x) => !inLib(x)); if (l.length === 1) { picked.add(keyOf(l[0])); draw(); } } });
  $('#a-clear', d).onclick = () => { qEl.value = ''; q = ''; $('#a-clear', d).hidden = true; draw(); qEl.focus(); };
  const browse = async () => {
    const r = await api.pickExe(); if (!r) return;
    closeDlg(); editDlg(null, { name: r.name, exe: r.path });
  };
  $('#a-browse', d).onclick = browse; $('#a-browse2', d).onclick = browse;
  $('#a-add', d).onclick = async (ev) => {
    // защита от двойного нажатия: пока идёт добавление, второе нажатие ничего не делает
    const btnEl = ev?.currentTarget; if (btnEl?.dataset.busy) return; if (btnEl) { btnEl.dataset.busy = '1'; setTimeout(() => { delete btnEl.dataset.busy; }, 4000); }
    const chosen = items.filter((x) => picked.has(keyOf(x)));
    if (!chosen.length) return;
    const enrich = chkVal(d, 'a-enrich');
    settings.scanEnrich = enrich; saveSettingsQuiet();
    if (chosen.length === 1 && !chosen[0].store && !chosen[0].urlStore && !(await api.linkStores?.([{ id: 'x', name: chosen[0].name, exePath: chosen[0].exePath, lnkPath: chosen[0].lnkPath }]).then((r) => r?.x).catch(() => null))) {
      // Одна игра — дальше обычное окно с настройками (название, обложка, категория…)
      closeDlg(); return editDlg(null, { name: chosen[0].name, exe: chosen[0].lnkPath || chosen[0].exePath });
    }
    const add = chosen.map((x) => ({
      id: uid(), name: x.name, exePath: x.exePath, lnkPath: x.lnkPath || null, isLnk: !!x.isLnk,
      ...(x.store ? { store: x.store, storeId: x.storeId, launchUrl: x.launchUrl || null, installDir: x.installDir, workDir: x.workDir || null, args: x.args || null } : {}),
      addedAt: Date.now(), cover: null, description: '', genre: '', year: '', developer: '', playtime: 0,
    }));
    const linked = await applyStoreLinks(add);
    await detachShortcuts(add);
    { const have = new Set(games.map(gameKey).filter(Boolean)); const before = add.length;
      for (let i = add.length - 1; i >= 0; i--) { const k = gameKey(add[i]); if (k && have.has(k)) add.splice(i, 1); else if (k) have.add(k); }
      if (before !== add.length) toast(`Уже в библиотеке: ${before - add.length} — пропущены`);
      if (!add.length) { closeDlg(); return; } }
    if (linked.length) toast(`Ярлыки превращены в игры ${[...new Set(linked.map((g) => STORES[g.store][0]))].join(' и ')}: ${linked.length}`, 'ok');
    if (add.length === 1) {
      // Игра из Steam/Epic: сразу в библиотеку, дальше — окно настроек этой игры
      await api.saveGamesBulk(add); games.push(add[0]); closeDlg(); S.selId = add[0].id; render();
      if (enrich) quickEnrich(add[0].id);
      return editDlg(add[0].id);
    }
    await api.saveGamesBulk(add);
    games.push(...add);
    closeDlg();
    S.filter = 'all'; S.group = 'added'; S.selId = add[0].id;
    render(); $('#list').scrollTop = 0;
    sfx('success'); toast(`Добавлено: ${add.length}`, 'ok');
    if (enrich) batchDlg(add.map((g) => g.id), true);
  };
  setTimeout(() => qEl.focus(), 40);
  const [progs, stores] = await Promise.all([
    (api.listPrograms?.() || Promise.resolve([])).catch(() => progCache || []),
    (api.listStoreGames?.() || Promise.resolve([])).catch(() => []),
  ]);
  progCache = progs;
  // Ярлыки Steam/Epic (.url) не дублируем, если та же игра есть в списке магазина
  // Ярлыки лаунчеров (steam://, com.epicgames…) не показываем: установленные игры уже есть во вкладках Steam/Epic,
  // а ярлык без установленной игры (купленная, но удалённая) запустить всё равно нельзя
  const nrm = (x) => String(x || '').toLowerCase().replace(/\//g, '\\');
  const dirs = stores.map((x) => nrm(x.installDir)).filter(Boolean);
  items = [...stores.map((x) => ({ ...x, iconPath: x.exePath })),
    ...progs.filter((x) => !x.store && !dirs.some((d0) => nrm(x.exePath).startsWith(d0 + '\\'))).map((x) => ({ ...x, urlStore: x.store, store: undefined }))]
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (!items.some((x) => inTab(x, tab))) tab = ['steam', 'epic', 'prog', 'all'].find((t) => items.some((x) => inTab(x, t))) || 'all';
  if (dlgOpen() && $('#a-list', d)) { drawTabs(); draw(); }
}

function coverDlg(id) {
  const g = byId(id); if (!g) return;
  const d = openDlg(`${head('Обложка, фон и логотип', esc(g.name))}
    <div class="dlg-body"><div class="cover-pick"><div class="cover-prev" style="${coverBg(g)}">${g.cover ? '' : `<span class="ini">${esc(initials(g.name))}</span>`}</div>
      <div class="cover-ops">
        <button class="btn btn-secondary" data-c="find" style="justify-content:flex-start"><i class="ph ph-magnifying-glass"></i>Найти в интернете (RAWG, SteamGridDB)</button>
        <button class="btn btn-secondary" data-c="file" style="justify-content:flex-start"><i class="ph ph-image"></i>Выбрать файл на компьютере…</button>
        <div class="row-in"><input class="input" id="c-url" placeholder="Ссылка на картинку"><button class="btn btn-secondary" data-c="url">Загрузить</button></div>
        ${g.cover ? '<button class="btn btn-ghost" data-c="clear" style="align-self:flex-start;color:var(--color-neutral-400)"><i class="ph ph-x"></i>Убрать обложку</button>' : ''}
      </div></div>
      <div class="section-t">Фон карточки (широкая картинка)</div>
      <div class="cover-pick"><div class="hero-prev" style="${heroStyle(g)}"></div>
      <div class="cover-ops">
        <button class="btn btn-secondary" data-c="find" style="justify-content:flex-start"><i class="ph ph-magnifying-glass"></i>Найти в интернете</button>
        <button class="btn btn-secondary" data-c="hfile" style="justify-content:flex-start"><i class="ph ph-image"></i>Выбрать файл на компьютере…</button>
        <div class="row-in"><input class="input" id="h-url" placeholder="Ссылка на картинку"><button class="btn btn-secondary" data-c="hurl">Загрузить</button></div>
        ${g.hero ? '<button class="btn btn-ghost" data-c="hclear" style="align-self:flex-start;color:var(--color-neutral-400)"><i class="ph ph-x"></i>Убрать фон (будет обложка)</button>' : ''}
      </div></div>
      <div class="section-t">Логотип вместо названия</div>
      <div class="cover-pick"><div class="logo-prev">${g.logo ? `<img src="${esc(g.logo)}" alt="">` : '<span class="muted">Нет — показывается название</span>'}</div>
      <div class="cover-ops">
        <button class="btn btn-secondary" data-c="find" style="justify-content:flex-start"><i class="ph ph-magnifying-glass"></i>Найти в SteamGridDB</button>
        <button class="btn btn-secondary" data-c="lfile" style="justify-content:flex-start"><i class="ph ph-image"></i>Выбрать файл (лучше PNG с прозрачным фоном)…</button>
        ${g.logo ? '<button class="btn btn-ghost" data-c="lclear" style="align-self:flex-start;color:var(--color-neutral-400)"><i class="ph ph-x"></i>Убрать логотип (будет название)</button>' : ''}
      </div></div></div>`, { cls: 'wide' });
  const apply = async (u) => { g.cover = u; g.coverSrc = u ? 'user' : null; await saveGame(g); closeDlg(); render(); toast(u ? 'Обложка обновлена' : 'Обложка убрана', 'ok'); };
  const applyHero = async (u) => { g.hero = u; g.heroSrc = u ? 'user' : null; await saveGame(g); closeDlg(); render(); toast(u ? 'Фон обновлён' : 'Фон убран', 'ok'); };
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = b.dataset.c;
    if (c === 'find') { closeDlg(); enrichDlg(id); }
    if (c === 'file') { const u = await api.pickImage(g.id); if (u) apply(u); }
    if (c === 'url') {
      const url = $('#c-url', d).value.trim(); if (!url) return;
      b.disabled = true; const u = await api.downloadImage(url, g.id); b.disabled = false;
      u ? apply(u) : toast('Не удалось загрузить картинку по этой ссылке', 'err');
    }
    if (c === 'clear') apply(null);
    if (c === 'hfile') { const u = await api.pickImage(g.id, 'hero'); if (u) applyHero(u); }
    if (c === 'hurl') {
      const url = $('#h-url', d).value.trim(); if (!url) return;
      b.disabled = true; const u = await api.downloadImage(url, g.id, 'hero'); b.disabled = false;
      u ? applyHero(u) : toast('Не удалось загрузить картинку по этой ссылке', 'err');
    }
    if (c === 'hclear') applyHero(null);
    if (c === 'lfile') { const u = await api.pickImage(g.id, 'logo'); if (u) { g.logo = u; await saveGame(g); closeDlg(); render(); toast('Логотип обновлён', 'ok'); } }
    if (c === 'lclear') { g.logo = null; g.logoChecked = true; await saveGame(g); closeDlg(); render(); toast('Логотип убран — показывается название', 'ok'); }
  });
}

// ─── Сканирование ────────────────────────────────────────────────────────────
async function scan(kind) {
  const res = kind === 'desktop' ? (toast('Ищу игры на рабочем столе…'), await api.scanDesktop()) : await api.scanFolder();
  if (!res) return;
  if (!res.found.length) return toast(kind === 'desktop' ? 'На рабочем столе игр не найдено' : 'В этой папке игр не найдено');
  scanDlg(res, kind);
}
function scanDlg(res, kind) {
  const known = new Set(games.flatMap((g) => [g.lnkPath, g.exePath]).filter(Boolean).map((p) => p.toLowerCase()));
  const items = res.found.map((f, i) => ({ ...f, i, exists: known.has((f.lnkPath || f.exePath).toLowerCase()), on: true }));
  const fresh = items.filter((x) => !x.exists);
  const d = openDlg(`${head(`Найдено игр: ${fresh.length}`, `<i class="ph ph-folder"></i><span class="mono">${esc(res.folder)}</span><span>· .exe и ярлыки .lnk</span>
      <button class="btn btn-ghost" data-s="other" style="font-size:13px;margin-left:auto">${kind === 'desktop' ? 'Выбрать папку' : 'Другая папка'}</button>`)}
    <div class="hint" style="margin:-4px 0 0">Снимите галочки с лишнего. Название можно исправить прямо в списке.</div>
    <div class="scan-list">${items.map((x) => `
      <div class="scan-item row-rule${x.exists ? ' exists' : ' on'}" data-i="${x.i}">
        <span class="chk-box">${x.exists ? '' : '<i class="ph-bold ph-check"></i>'}</span>
        <div style="flex:1;min-width:0">${x.exists ? `<div style="font-size:14px">${esc(x.name)}</div>` : `<input class="scan-name" value="${esc(x.name)}" data-i="${x.i}" spellcheck="false">`}
          <div class="scan-path">${esc(x.lnkPath || x.exePath)}</div></div>
        ${x.exists ? '<span class="tag tag-neutral">Уже в библиотеке</span>' : ''}
      </div>`).join('')}</div>
    ${chk('enrich', settings.scanEnrich !== false, 'Сразу найти обложки, описания и жанры')}
    <div class="dialog-actions"><button class="btn btn-secondary" data-act="dlg-close">Отмена</button><button class="btn btn-primary" id="s-add">Добавить ${fresh.length}</button></div>`, { cls: 'wide' });
  bindChecks(d);
  const count = () => { const n = items.filter((x) => !x.exists && x.on).length; $('#s-add', d).textContent = 'Добавить ' + n; $('#s-add', d).disabled = !n; };
  d.querySelectorAll('.scan-item:not(.exists)').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.classList.contains('scan-name')) return;
    const x = items[+row.dataset.i]; x.on = !x.on;
    row.classList.toggle('on', x.on); row.querySelector('.chk-box').innerHTML = x.on ? '<i class="ph-bold ph-check"></i>' : '';
    count();
  }));
  d.querySelectorAll('.scan-name').forEach((inp) => inp.addEventListener('input', () => { items[+inp.dataset.i].name = inp.value; }));
  $('[data-s="other"]', d).onclick = () => { closeDlg(); scan('folder'); };
  $('#s-add', d).onclick = async (ev) => {
    // защита от двойного нажатия: пока идёт добавление, второе нажатие ничего не делает
    const btnEl = ev?.currentTarget; if (btnEl?.dataset.busy) return; if (btnEl) { btnEl.dataset.busy = '1'; setTimeout(() => { delete btnEl.dataset.busy; }, 4000); }
    const enrich = chkVal(d, 'enrich');
    settings.scanEnrich = enrich; saveSettingsQuiet();
    const add = items.filter((x) => !x.exists && x.on).map((x) => ({
      id: uid(), name: (x.name || '').trim() || 'Без названия', exePath: x.exePath, lnkPath: x.lnkPath || null, isLnk: !!x.isLnk,
      addedAt: Date.now(), cover: null, description: '', genre: '', year: '', developer: '', playtime: 0,
    }));
    if (!add.length) return;
    await applyStoreLinks(add);
    await detachShortcuts(add);
    { const have = new Set(games.map(gameKey).filter(Boolean));
      for (let i = add.length - 1; i >= 0; i--) { const k = gameKey(add[i]); if (k && have.has(k)) add.splice(i, 1); else if (k) have.add(k); }
      if (!add.length) { closeDlg(); return toast('Эти игры уже есть в библиотеке'); } }
    await api.saveGamesBulk(add);
    games.push(...add);
    closeDlg();
    S.filter = 'all'; S.group = 'added'; S.selId = add[0].id;
    render(); $('#list').scrollTop = 0;
    sfx('success');
    toast(`Добавлено: ${add.length}`, 'ok');
    if (enrich) batchDlg(add.map((g) => g.id), true);
  };
  count();
}

// ─── Авто-данные для одной игры ──────────────────────────────────────────────
let enrichReq = 0;
function enrichDlg(id) {
  const g = byId(id); if (!g) return;
  let data = null, chosenCover = null, chosenHero = null, chosenLogo = null;
  const d = openDlg(`${head('Обновить данные', esc(g.name) + ' · название игры не меняется')}
    <div class="row-in"><input class="input" id="e-q" value="${esc(g.name)}" placeholder="Название для поиска"><button class="btn btn-primary" id="e-find"><i class="ph ph-magnifying-glass"></i>Найти</button></div>
    <div class="en-cols"><div class="en-list" id="e-list"><div class="hint">Нажмите «Найти» и выберите игру из списка.</div></div>
      <div class="en-right" id="e-right"><div class="hint" style="margin:0">Здесь появятся описание, жанры и варианты обложек.</div></div></div>
    <div class="dialog-actions"><span class="en-status" id="e-status"></span><button class="btn btn-secondary" data-act="dlg-close">Отмена</button><button class="btn btn-primary" id="e-apply" disabled>Применить</button></div>`,
  { cls: 'xwide', onClose: () => { enrichReq++; } });
  const status = (t) => { $('#e-status', d).textContent = t; };
  const load = async (slug, name) => {
    const req = ++enrichReq; data = null; chosenCover = null; chosenHero = null; chosenLogo = null; $('#e-apply', d).disabled = true;
    $('#e-right', d).innerHTML = '<div class="hint" style="margin:0">Загружаю данные…</div>';
    status('Загрузка…');
    const fromSteam = !slug && isSteamG;
    const r = await api.enrichGame(g.id, name, { slug, downloadCover: false, steamAppId: fromSteam ? g.storeId : null });
    if (req !== enrichReq) return;
    data = r;
    const sa = fromSteam && r.steamArt ? r.steamArt : null;
    const covers = [...(sa ? [{ url: sa.cover, thumb: sa.cover }] : []),...(r.sgdbGrids || []).map((x) => ({ url: x.url, thumb: x.thumb || x.url })), ...(r.coverRemoteUrl ? [{ url: r.coverRemoteUrl, thumb: r.coverRemoteUrl }] : [])];
    chosenCover = covers[0]?.url || null;
    // Широкие картинки для фона карточки: hero из SteamGridDB, картинка и скриншоты RAWG
    const heroes = [...(sa ? [sa.hero, ...sa.shots].map((u) => ({ url: u, thumb: u })) : []), ...(r.sgdbHeroes || []).map((x) => ({ url: x.url, thumb: x.thumb || x.url })),
      ...(r.coverRemoteUrl ? [{ url: r.coverRemoteUrl, thumb: r.coverRemoteUrl }] : []),
      ...(r.screenshots || []).slice(0, 4).map((u) => ({ url: u, thumb: u }))];
    chosenHero = g.hero && !sa ? null : heroes[0]?.url || null;
    const logos = [...(sa ? [{ url: sa.logo, thumb: sa.logo }] : []), ...(r.sgdbLogos || []).map((x) => ({ url: x.url, thumb: x.thumb || x.url }))];
    chosenLogo = g.logo && !sa ? null : logos[0]?.url || null;
    $('#e-right', d).innerHTML = `
      <div class="row2"><div class="field"><label>Жанры</label><input class="input" id="e-genre" value="${esc(r.genre || g.genre || '')}"></div>
        <div class="field"><label>Год</label><input class="input" id="e-year" value="${esc(r.year || g.year || '')}"></div></div>
      <div class="field"><label>Разработчик</label><input class="input" id="e-dev" value="${esc(r.developer || g.developer || '')}"></div>
      <div class="field"><label>Описание${r.foundName ? ` · найдено как «${esc(r.foundName)}»` : ''}</label><textarea class="input" id="e-desc" rows="5">${esc(r.description || g.description || '')}</textarea></div>
      ${covers.length ? `<div class="field"><label>Обложка — выберите</label><div class="cov-grid">${covers.map((c, i) => `<button class="cov-opt${i === 0 ? ' on' : ''}" data-u="${esc(c.url)}" style="background-image:${esc(cssUrl(c.thumb))}"></button>`).join('')}
        <button class="cov-opt" data-u="" style="display:grid;place-items:center;background:var(--color-bg);color:var(--color-neutral-500);font-size:12px">Не менять</button></div></div>` : ''}
      ${heroes.length ? `<div class="field"><label>Фон карточки — выберите</label><div class="cov-grid hero-grid">${heroes.map((c) => `<button class="cov-opt hero-opt${c.url === chosenHero ? ' on' : ''}" data-h="${esc(c.url)}" style="background-image:${esc(cssUrl(c.thumb))}"></button>`).join('')}
        <button class="cov-opt hero-opt${chosenHero ? '' : ' on'}" data-h="" style="display:grid;place-items:center;background:var(--color-bg);color:var(--color-neutral-500);font-size:12px">Не менять</button></div></div>` : ''}
      ${logos.length ? `<div class="field"><label>Логотип вместо названия — выберите</label><div class="cov-grid logo-grid">${logos.map((c) => `<button class="cov-opt logo-opt${c.url === chosenLogo ? ' on' : ''}" data-l="${esc(c.url)}" style="background-image:${esc(cssUrl(c.thumb))}"></button>`).join('')}
        <button class="cov-opt logo-opt${chosenLogo ? '' : ' on'}" data-l="" style="display:grid;place-items:center;color:var(--color-neutral-500);font-size:12px">${g.logo ? 'Не менять' : 'Без логотипа'}</button></div></div>` : ''}
      <div class="log">${(r.log || []).map((l) => `<div class="${/^✓/.test(l) ? 'ok' : /^(⚠|❌)/.test(l) ? 'warn' : ''}">${esc(l)}</div>`).join('')}</div>`;
    $('#e-right', d).querySelectorAll('.logo-opt').forEach((b) => b.addEventListener('click', () => {
      $('#e-right', d).querySelectorAll('.logo-opt').forEach((x) => x.classList.remove('on')); b.classList.add('on'); chosenLogo = b.dataset.l || null;
    }));
    $('#e-right', d).querySelectorAll('.cov-opt:not(.hero-opt):not(.logo-opt)').forEach((b) => b.addEventListener('click', () => {
      $('#e-right', d).querySelectorAll('.cov-opt:not(.hero-opt):not(.logo-opt)').forEach((x) => x.classList.remove('on')); b.classList.add('on'); chosenCover = b.dataset.u || null;
    }));
    $('#e-right', d).querySelectorAll('.hero-opt').forEach((b) => b.addEventListener('click', () => {
      $('#e-right', d).querySelectorAll('.hero-opt').forEach((x) => x.classList.remove('on')); b.classList.add('on'); chosenHero = b.dataset.h || null;
    }));
    $('#e-apply', d).disabled = !r.success;
    status(r.success ? 'Проверьте данные и нажмите «Применить»' : 'Ничего не нашлось — проверьте ключи API в настройках');
  };
  const find = async () => {
    const q = $('#e-q', d).value.trim(); if (!q) return;
    status('Ищу в RAWG…');
    $('#e-list', d).innerHTML = '<div class="hint">Поиск…</div>';
    const res = await api.rawgSearch(q);
    if (!dlgOpen()) return;
    if (!res.length) {
      $('#e-list', d).innerHTML = '<div class="hint">Ничего не найдено. Проверьте название или ключ RAWG в настройках.</div>';
      status(settings.rawgKey ? 'Не найдено' : 'Нужен ключ RAWG — откройте настройки');
      return;
    }
    $('#e-list', d).innerHTML = res.map((r, i) => `<button class="en-res${i === 0 ? ' on' : ''}" data-slug="${esc(r.slug)}" data-name="${esc(r.name)}" data-nav>${esc(r.name)}
      <small>${esc((r.released || '').slice(0, 4) || '—')}${r.genres?.length ? ' · ' + esc(r.genres.slice(0, 2).map((x) => translateGenre(x.name)).join(', ')) : ''}</small></button>`).join('');
    $('#e-list', d).querySelectorAll('.en-res').forEach((b) => b.addEventListener('click', () => {
      $('#e-list', d).querySelectorAll('.en-res').forEach((x) => x.classList.remove('on')); b.classList.add('on');
      load(b.dataset.slug, b.dataset.name);
    }));
    load(res[0].slug, res[0].name);
  };
  $('#e-find', d).onclick = find;
  const isSteamG = storeOf(g) === 'steam' && /^\d+$/.test(String(g.storeId || ''));
  if (isSteamG) {
    $('#e-list', d).innerHTML = `<button class="en-res on" data-steam="1" data-nav>${STORE_ICONS.steam ? `<img class="nsrc" src="${esc(STORE_ICONS.steam)}" alt="">` : ''}${esc(g.name)}<small>Точно: из Steam по номеру игры</small></button>
      <div class="hint" style="margin:8px 4px 0">Нужно другое? Введите название выше и нажмите «Найти».</div>`;
    $('#e-list', d).querySelector('[data-steam]').addEventListener('click', () => load(null, g.name));
    load(null, g.name);
  }
  $('#e-q', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') find(); });
  $('#e-apply', d).onclick = async (ev) => {
    // защита от двойного нажатия: пока идёт добавление, второе нажатие ничего не делает
    const btnEl = ev?.currentTarget; if (btnEl?.dataset.busy) return; if (btnEl) { btnEl.dataset.busy = '1'; setTimeout(() => { delete btnEl.dataset.busy; }, 4000); }
    if (!data) return;
    const btn = $('#e-apply', d); btn.disabled = true; status('Применяю…');
    g.genre = translateGenre($('#e-genre', d).value) || g.genre;
    g.year = $('#e-year', d).value.trim() || g.year;
    g.developer = $('#e-dev', d).value.trim() || g.developer;
    g.description = $('#e-desc', d).value.trim() || g.description;
    if (data.rating) g.rating = data.rating;
    let coverFailed = false;
    if (chosenCover) {
      const tries = [chosenCover, data.sgdbGrids?.[0]?.url, data.coverRemoteUrl].filter((u, i, a) => u && a.indexOf(u) === i);
      coverFailed = true;
      for (const u of tries) { const local = await api.setCoverFromUrl(g.id, u); if (local) { g.cover = local; g.coverSrc = /steamgriddb/i.test(u) ? 'sgdb' : 'rawg'; coverFailed = false; if (/steamstatic|^file:/i.test(u)) g.coverSrc = 'steam'; break; } }
    }
    if (chosenLogo) { const l = await api.setCoverFromUrl(g.id, chosenLogo, 'logo'); if (l) { g.logo = l; g.logoSrc = /steamstatic|^file:/i.test(chosenLogo) ? 'steam' : 'sgdb'; } }
    if (chosenHero) { const h = await api.setCoverFromUrl(g.id, chosenHero, 'hero'); if (h) { g.hero = h; g.heroSrc = /steamstatic|^file:/i.test(chosenHero) ? 'steam' : /steamgriddb/i.test(chosenHero) ? 'sgdb' : 'rawg'; } }
    await saveGame(g);
    closeDlg(); render();
    toast(coverFailed ? 'Данные обновлены, но обложку скачать не удалось' : 'Данные обновлены', coverFailed ? 'err' : 'ok');
  };
  if (!isSteamG) find();
}

// ─── Авто-данные для многих игр ──────────────────────────────────────────────
let batch = { running: false, stop: false };
// Что скачивать для игры: обложку — если её нет, она широкая или не из SteamGridDB; фон — аналогично
async function artPlan(g, force) {
  const sg = !!settings.sgdbKey;
  const cover = force || await needsCover(g) || (sg && !['sgdb', 'user'].includes(g.coverSrc));
  const hero = force || !g.hero || (sg && !['sgdb', 'user'].includes(g.heroSrc));
  const isSteam = storeOf(g) === 'steam' && g.storeId;
  const logo = (sg || isSteam) && (force || !g.logo || (isSteam && g.logoSrc !== 'steam'));
  // Игры Steam: официальные картинки из библиотеки Steam — если их ещё нет
  if (isSteam && !force) return { cover: cover || g.coverSrc !== 'steam', hero: hero || g.heroSrc !== 'steam', logo, steamAppId: g.storeId };
  return { cover, hero, logo, steamAppId: isSteam ? g.storeId : null };
}
const HAS_RU = /[а-яё]/i;
// Описания на английском, сохранённые раньше, заменяем русскими — тихо, по одной игре
async function ruDescSync() {
  if (!api.ruDescription || ruDescSync.busy) return;
  ruDescSync.busy = true;
  try {
    // Игры не из Steam ждут, пока найдутся подробности (там тот же поиск в Steam) — не ищем дважды и не злим Steam
    const todo = games.filter((g) => g.description && !g.descUser && !HAS_RU.test(g.description) && (g.ruTried || 0) < 2 && !isMissing(g)
      && !(g.extra?.about && HAS_RU.test(g.extra.about)) && (storeOf(g) === 'steam' || !needExtra(g)));
    let n = 0;
    for (const g0 of todo) {
      const g = byId(g0.id); if (!g) continue;
      const sent = g.description;
      const r = await api.ruDescription({ name: g.name, steamAppId: storeOf(g) === 'steam' ? g.storeId : (g.extra?.from === 'steam' && g.extra.appid) || null, description: g.description }).catch(() => null);
      const cur = byId(g0.id); if (!cur) continue;
      if (r?.description && HAS_RU.test(r.description) && cur.description === sent && !cur.descUser) { cur.description = r.description; n++; if (S.selId === cur.id) render(); }
      cur.ruTried = (cur.ruTried || 0) + 1;   // не стучимся бесконечно, если русского описания нигде нет
      await saveGame(cur);
      await new Promise((res) => setTimeout(res, 1800));   // магазин Steam не любит частые запросы
    }
    if (n) { render(); toast(`Описания на русском: ${n} ${plural(n, 'игра', 'игры', 'игр')}`, 'ok'); }
  } finally { ruDescSync.busy = false; }
}
// Игры Steam, данные которых раньше искались по названию (и могли взяться от другой игры), —
// один раз перепроверяем по номеру игры в Steam: описание, разработчик, год, фон и логотип
async function steamFixSync() {
  if (steamFixSync.busy) return;
  steamFixSync.busy = true;
  let n = 0;
  try {
    const todo = games.filter((g) => storeOf(g) === 'steam' && /^\d+$/.test(String(g.storeId || '')) && (g.steamFixV || 0) < 2 && !isMissing(g));
    for (const g0 of todo) {
      const g = byId(g0.id); if (!g) continue;
      const fixImg = (src) => !['steam', 'user'].includes(src);
      const r = await api.enrichGame(g.id, g.name, { steamAppId: g.storeId, downloadCover: !g.cover || fixImg(g.coverSrc),
        downloadHero: !g.hero || fixImg(g.heroSrc), downloadLogo: !g.logo || fixImg(g.logoSrc) }).catch(() => null);
      const cur = byId(g0.id); if (!cur) continue;
      if (r?.fromSteam) {
        const before = JSON.stringify([cur.description, cur.hero, cur.logo, cur.developer]);
        applyEnrich(cur, r);
        // Логотип, найденный раньше по похожему названию, но не подтверждённый для этой игры, — убираем
        if (!r.logoUrl && cur.logo && fixImg(cur.logoSrc)) { cur.logo = null; cur.logoSrc = null; }
        if (JSON.stringify([cur.description, cur.hero, cur.logo, cur.developer]) !== before) n++;
        cur.steamFixV = 2;
      } else cur.steamFixTries = (cur.steamFixTries || 0) + 1;
      if ((cur.steamFixTries || 0) >= 2) cur.steamFixV = 2;
      await saveGame(cur);
      if (S.selId === cur.id || S.big.open) render();
      await new Promise((res) => setTimeout(res, 1200));   // магазин Steam не любит частые запросы
    }
  } finally { steamFixSync.busy = false; }
  if (n) { render(); toast(`Данные игр Steam уточнены: ${n}`, 'ok'); }
}
function applyEnrich(g, r, overwriteText = false) {
  if (r.fromSteam && !g.descUser) overwriteText = true;   // данные из самого Steam по номеру игры — точнее найденных по названию (но не то, что правили вручную)
  const put = (k, v) => { if (v && (overwriteText || !g[k])) g[k] = v; };
  put('description', r.description);
  // Английское описание меняем на русское, если оно нашлось (например, из Steam)
  if (!g.descUser && r.description && HAS_RU.test(r.description) && g.description && !HAS_RU.test(g.description)) g.description = r.description;
  put('genre', r.genre); put('year', r.year); put('developer', r.developer);
  if (r.rating) g.rating = r.rating;
  if (r.coverUrl) { g.cover = r.coverUrl; g.coverSrc = r.coverSrc || 'rawg'; }
  if (r.heroUrl) { g.hero = r.heroUrl; g.heroSrc = r.heroSrc || 'rawg'; }
  if (r.logoUrl) { g.logo = r.logoUrl; g.logoSrc = /steamstatic/.test(r.logoFrom || '') ? 'steam' : 'sgdb'; }
  if (settings.sgdbKey) g.artChecked = g.logoChecked = true;
  if (storeOf(g) === 'steam') g.steamArtChecked = true;
  if (g.extra) g.extra.t = 0;   // данные игры обновили — подробности тоже перечитаем
}
function artNote(r) {
  const src = (x) => x === 'steam' ? 'Steam' : x === 'sgdb' ? 'SteamGridDB' : 'RAWG';
  return [r.coverUrl && 'обложка ' + src(r.coverSrc), r.heroUrl && 'фон ' + src(r.heroSrc), r.logoUrl && 'логотип'].filter(Boolean).join(', ') || (r.description ? 'только описание' : 'данные');
}
function batchDlg(ids, autostart = false) {
  if (batch.running) return toast('Авто-данные уже обрабатываются');
  const pool = ids ? ids.map(byId).filter(Boolean) : visible();
  const pick = (force) => ids || force ? pool : pool.filter((g) => !g.cover || !g.description || !g.hero || (settings.sgdbKey && (!g.artChecked || !g.logoChecked))
    || (storeOf(g) === 'steam' && g.storeId && g.coverSrc !== 'steam' && !g.steamArtChecked));
  let todo = pick(false);
  const draw = () => `<div class="b-list">${todo.map((g) => `<div class="b-item" id="b-${esc(g.id)}"><i class="ph ph-circle"></i><span class="grow">${esc(g.name)}</span><small>ожидание</small></div>`).join('') || '<div class="hint">У всех игр уже есть обложка, фон и описание. Включите «Заменить все картинки», чтобы искать заново.</div>'}</div>`;
  const d = openDlg(`${head('Авто-данные', 'Обложки, фоны, описания и жанры · названия игр не меняются')}
    ${!settings.sgdbKey ? `<div class="dlg-text warn-box"><i class="ph ph-warning"></i><span>Ключ SteamGridDB не задан — вертикальные обложки и широкие фоны найти не получится, будут только картинки из RAWG. <a data-act="open-settings">Открыть настройки</a></span></div>` : ''}
    ${!settings.rawgKey && !settings.sgdbKey ? '<div class="dlg-text warn-box"><i class="ph ph-warning"></i><span>Ключ RAWG тоже не задан — искать будет не в чем.</span></div>' : ''}
    ${chk('b-force', false, 'Заменить все картинки', 'Заново скачать обложку и фон даже там, где они уже есть.')}
    <div id="b-prog" hidden><div class="dlg-sub" style="justify-content:space-between;margin:0 0 6px"><span id="b-lbl"></span><span id="b-pct">0%</span></div><div class="bar"><div id="b-bar"></div></div></div>
    <div id="b-wrap">${draw()}</div>
    <div class="dialog-actions"><span class="en-status" id="b-note"></span>
      <button class="btn btn-secondary" data-act="dlg-close">Закрыть</button><button class="btn btn-primary" id="b-go">Запустить</button></div>`,
  { cls: 'wide', onClose: () => { if (batch.running) toast('Авто-данные продолжают работать в фоне'); } });
  bindChecks(d);
  const note = () => { $('#b-note', d).textContent = todo.length ? `${todo.length} ${plural(todo.length, 'игра', 'игры', 'игр')}` : ''; $('#b-go', d).disabled = !todo.length; };
  d.querySelector('[data-chk="b-force"]').addEventListener('chk', () => { if (batch.running) return; todo = pick(chkVal(d, 'b-force')); $('#b-wrap', d).innerHTML = draw(); note(); });
  note();
  const go = $('#b-go', d);
  go.onclick = async () => {
    if (batch.running) { batch.stop = true; go.disabled = true; go.textContent = 'Останавливаю…'; return; }
    const force = chkVal(d, 'b-force');
    batch = { running: true, stop: false };
    go.textContent = 'Остановить';
    $('#b-prog', d).hidden = false;
    let done = 0, found = 0, pics = 0;
    for (const g of todo) {
      if (batch.stop) break;
      const row = document.getElementById('b-' + g.id);
      const setRow = (cls, icon, txt) => { if (!row) return; row.className = 'b-item ' + cls; row.querySelector('i').className = icon; row.querySelector('small').textContent = txt; };
      setRow('run', 'ph ph-circle-notch', 'поиск…');
      const plan = await artPlan(g, force);
      const r = await api.enrichGame(g.id, g.name, { downloadCover: plan.cover, downloadHero: plan.hero, downloadLogo: plan.logo, steamAppId: plan.steamAppId });
      const cur = byId(g.id);   // игру могли удалить или заменить, пока шёл поиск
      if (!cur) { setRow('', 'ph ph-minus-circle', 'убрана из библиотеки'); done++; continue; }
      if (r.success) {
        applyEnrich(cur, r);
        await saveGame(cur); found++; if (r.coverUrl || r.heroUrl || r.logoUrl) pics++;
        setRow('ok', 'ph-fill ph-check-circle', artNote(r));
      } else setRow('fail', 'ph ph-x-circle', (r.log || []).find((l) => /^(⚠|❌)/.test(l))?.replace(/^\S+\s*/, '') || 'не найдено');
      done++;
      const pct = Math.round(done / todo.length * 100);
      const bar = document.getElementById('b-bar'); if (bar) bar.style.width = pct + '%';
      const lbl = document.getElementById('b-lbl'); if (lbl) lbl.textContent = `${done} из ${todo.length}`;
      const pp = document.getElementById('b-pct'); if (pp) pp.textContent = pct + '%';
      if (done % 3 === 0) render();
      await new Promise((r2) => setTimeout(r2, 300));
    }
    const stopped = batch.stop && done < todo.length;
    batch = { running: false, stop: false };
    render();
    const n = document.getElementById('b-note'); if (n) n.textContent = stopped ? `Остановлено: ${done} из ${todo.length}` : `Готово: данные для ${found} из ${done}, картинки для ${pics}`;
    const g2 = document.getElementById('b-go'); if (g2) g2.remove();
    toast(stopped ? `Авто-данные остановлены (${done} из ${todo.length})` : `Авто-данные: картинки обновлены у ${pics} ${plural(pics, 'игры', 'игр', 'игр')}`, 'ok');
  };
  if (autostart) go.click();
}
