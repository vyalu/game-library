'use strict';
// ─── Категории ───────────────────────────────────────────────────────────────
// Свои списки и порядок вкладок: создать, переименовать, перекрасить, удалить, показать/скрыть, переставить
function catsDlg() {
  const hiddenKeys = () => {
    const vis = tabKeys();
    return [...Object.keys(TAB_BUILTIN), ...cats.map((c) => 'cat:' + c.id)].filter((k) => !vis.includes(k));
  };
  let rows = [...tabKeys().map((k) => ({ k, on: true })), ...hiddenKeys().map((k) => ({ k, on: false }))];
  const persist = async () => {
    rows = rows.filter((r) => r.k in TAB_BUILTIN || catById(r.k.slice(4)));
    settings.tabs = rows.filter((r) => r.on).map((r) => r.k);
    settings.tabsHidden = rows.filter((r) => !r.on && r.k.startsWith('cat:')).map((r) => r.k);
    await saveSettingsQuiet(); render(); if (S.big.open) renderBig();
  };
  const count = (k) => tabGames(k).length;
  const rowHTML = (r, i) => {
    const c = r.k.startsWith('cat:') ? catById(r.k.slice(4)) : null;
    return `<div class="tab-row${r.on ? '' : ' off'}" draggable="true" data-i="${i}">
      <i class="ph ph-dots-six-vertical tr-grip" title="Перетащите, чтобы поменять порядок"></i>
      ${c ? `<button class="tr-dot" data-color="${i}" title="Сменить цвет" style="background:${esc(catColor(c))}"></button>` : `<i class="ph ${{ all: 'ph-books', recent: 'ph-clock-counter-clockwise', fav: 'ph-star', new: 'ph-sparkle', done: 'ph-check-circle' }[r.k]} tr-ic"></i>`}
      ${c ? `<input class="input tr-name" data-name="${i}" value="${esc(c.name)}" maxlength="40" data-nav>` : `<span class="tr-label">${esc(TAB_BUILTIN[r.k])}<small>встроенная</small></span>`}
      <span class="tr-n">${count(r.k)}</span>
      <button class="btn btn-ghost btn-icon" data-up="${i}" title="Выше" ${i === 0 ? 'disabled' : ''} data-nav><i class="ph ph-caret-up"></i></button>
      <button class="btn btn-ghost btn-icon" data-down="${i}" title="Ниже" ${i === rows.length - 1 ? 'disabled' : ''} data-nav><i class="ph ph-caret-down"></i></button>
      ${r.k === 'all' ? '<span class="tr-sp"></span>' : `<button class="btn btn-ghost btn-icon" data-eye="${i}" title="${r.on ? 'Скрыть вкладку' : 'Показать вкладку'}" data-nav><i class="ph ${r.on ? 'ph-eye' : 'ph-eye-slash'}"></i></button>`}
      ${c ? `<button class="btn btn-ghost btn-icon tr-del" data-del="${i}" title="Удалить список" data-nav><i class="ph ph-trash"></i></button>` : '<span class="tr-sp"></span>'}
    </div>`;
  };
  const draw = () => `${head('Списки и вкладки', 'Свои списки — «Для компании», «Поиграть потом»… Порядок здесь = порядок вкладок везде')}
    <div class="row-in"><input class="input" id="c-name" placeholder="Новый список" data-nav><button class="btn btn-primary" id="c-add" data-nav><i class="ph ph-plus"></i>Создать</button></div>
    <div class="dlg-body tab-rows" id="c-rows">${rows.map(rowHTML).join('')}</div>
    <div class="hint" style="margin:0">Перетаскивайте строки мышью или двигайте стрелками. Встроенные вкладки можно скрыть, «Все» — всегда первая.</div>
    <div class="dialog-actions"><button class="btn btn-primary" data-act="dlg-close">Готово</button></div>`;
  const d = openDlg(draw(), { cls: 'wide' });
  const redraw = () => { $('#c-rows', d).innerHTML = rows.map(rowHTML).join(''); };
  const move = (i, j) => { if (j < 0 || j >= rows.length || rows[i].k === 'all' || (j === 0 && rows[0].k === 'all')) return; const [r] = rows.splice(i, 1); rows.splice(j, 0, r); sfx('move'); redraw(); persist(); };
  d.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-up],[data-down],[data-eye],[data-del],[data-color]'); if (!t) return;
    if (t.dataset.up) return move(+t.dataset.up, +t.dataset.up - 1);
    if (t.dataset.down) return move(+t.dataset.down, +t.dataset.down + 1);
    if (t.dataset.eye) { const r = rows[+t.dataset.eye]; r.on = !r.on; sfx('select'); redraw(); return persist(); }
    if (t.dataset.color) {
      const c = catById(rows[+t.dataset.color].k.slice(4)); const m = String(c.color).match(/oklch\([\d.\s]+ ([\d.]+)\)/);
      const i = CAT_HUES.indexOf(m ? +m[1] : -1); c.color = `oklch(0.72 0.09 ${CAT_HUES[(i + 1) % CAT_HUES.length]})`; sfx('move'); redraw(); return persist();
    }
    if (t.dataset.del) {
      const r = rows[+t.dataset.del], id = r.k.slice(4), c = catById(id);
      if (!(await confirmDlg(`Удалить список «${c.name}»?`, 'Сами игры останутся в библиотеке.', 'Удалить'))) return catsDlg();
      cats = cats.filter((x) => x.id !== id);
      const changed = games.filter((g) => inList(g, id)); changed.forEach((g) => setInList(g, id, false));
      if (changed.length) await api.saveGamesBulk(changed);
      if (S.filter === r.k) S.filter = 'all'; if (S.big.tab === r.k) S.big.tab = 'all'; if (S.big.bpTab === r.k) S.big.bpTab = 'all';
      rows.splice(+t.dataset.del, 1); await persist(); return catsDlg();
    }
  });
  d.addEventListener('change', (e) => {
    const t = e.target.closest('[data-name]'); if (!t) return;
    const c = catById(rows[+t.dataset.name].k.slice(4)); const v = t.value.trim();
    if (v && c) { c.name = v; persist(); toast('Список переименован', 'ok'); } else t.value = c?.name || '';
  });
  // Перетаскивание мышью
  let dragI = null;
  d.addEventListener('dragstart', (e) => { const r = e.target.closest('.tab-row'); if (!r) return; dragI = +r.dataset.i; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
  d.addEventListener('dragend', () => { dragI = null; d.querySelectorAll('.tab-row').forEach((x) => x.classList.remove('drag', 'over')); });
  d.addEventListener('dragover', (e) => { const r = e.target.closest('.tab-row'); if (!r || dragI == null) return; e.preventDefault(); d.querySelectorAll('.tab-row.over').forEach((x) => x.classList.remove('over')); r.classList.add('over'); });
  d.addEventListener('drop', (e) => { const r = e.target.closest('.tab-row'); if (!r || dragI == null) return; e.preventDefault(); move(dragI, +r.dataset.i); });
  const add = async () => {
    const name = $('#c-name', d).value.trim(); if (!name) return;
    const c = { id: uid(), name, color: `oklch(0.72 0.09 ${CAT_HUES[cats.length % CAT_HUES.length]})` };
    cats.push(c); rows.push({ k: 'cat:' + c.id, on: true });
    $('#c-name', d).value = ''; sfx('success'); redraw(); await persist();
    toast(`Список «${name}» создан. Добавить игру: меню игры → «Добавить в список…»`, 'ok');
  };
  $('#c-add', d).onclick = add;
  $('#c-name', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  setTimeout(() => $('#c-name', d)?.focus(), 30);
}
// Добавить игру (или несколько) в свои списки — переключатели, работает и с геймпада
function assignCatDlg(ids) {
  const list = ids.map(byId).filter(Boolean);
  if (!list.length) return;
  const all = (id) => list.every((g) => inList(g, id));
  const draw = () => `${head('Списки', list.length === 1 ? esc(list[0].name) : `Для ${list.length} игр`)}
    <div class="row-in"><input class="input" id="al-name" placeholder="Новый список, например «Для компании»" data-nav><button class="btn btn-primary" id="al-add" data-nav><i class="ph ph-plus"></i>Создать</button></div>
    <div class="cat-pick al-list">${cats.map((c) => `<button class="nav-item al-opt${all(c.id) ? ' on' : ''}" data-c="${esc(c.id)}" data-nav><span class="cat-dot" style="background:${esc(catColor(c))}"></span>
      <span class="nav-label">${esc(c.name)}</span><span class="al-chk">${all(c.id) ? '<i class="ph-bold ph-check"></i>' : ''}</span></button>`).join('') || '<div class="hint">Списков пока нет — создайте первый.</div>'}</div>
    <div class="dialog-actions"><button class="btn btn-ghost" data-act="open-cats">Порядок вкладок…</button><span style="flex:1"></span><button class="btn btn-primary" data-act="dlg-close">Готово</button></div>`;
  const d = openDlg(draw());
  const bind = () => {
    d.querySelectorAll('[data-c]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.c, on = !all(id);
      list.forEach((g) => setInList(g, id, on));
      await api.saveGamesBulk(list);
      sfx(on ? 'fav' : 'unfav'); d.innerHTML = draw(); bind(); render();
      toast(on ? `Добавлено в «${catById(id).name}»` : `Убрано из «${catById(id).name}»`, 'ok');
    });
    const add = async () => {
      const name = $('#al-name', d).value.trim(); if (!name) return;
      const c = { id: uid(), name, color: `oklch(0.72 0.09 ${CAT_HUES[cats.length % CAT_HUES.length]})` };
      cats.push(c); list.forEach((g) => setInList(g, c.id, true));
      await api.saveGamesBulk(list); await saveSettingsQuiet();
      d.innerHTML = draw(); bind(); render(); toast(`Список «${name}» создан`, 'ok');
    };
    $('#al-add', d).onclick = add;
    $('#al-name', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  };
  bind();
  if (S.selMode) { S.selMode = false; S.selected.clear(); }
}

// ─── Настройки ───────────────────────────────────────────────────────────────
async function settingsDlg(focus) {
  const fresh = await api.getSettings();
  updateInfo = await api.getUpdateInfo();
  if (updateInfo.state && (!updateState.status || updateState.status === 'idle')) updateState = updateInfo.state;
  const s = { ...settings, autostart: fresh.autostart, closeToTray: fresh.closeToTray, autostartSupported: fresh.autostartSupported };
  const keyState = (v) => `<span class="key-state ${v ? 'ok' : 'no'}">${v ? 'задан' : 'не задан'}</span>`;
  const pads = allPads();
  const padList = [...new Map(pads.map((p) => [padKey(p), p])).values()];
  const updDot = ['available', 'downloaded'].includes(updateState?.status);
  const NAV = [
    ['look', 'Внешний вид', 'ph-paint-brush', 'Тема, фон и карточка игры'],
    ['lib', 'Библиотека', 'ph-books', 'Steam, Epic и новые игры'],
    ['art', 'Обложки и описания', 'ph-image', 'Где искать картинки и текст'],
    ['sound', 'Звук', 'ph-speaker-high', 'Звуки интерфейса'],
    ['pad', 'Геймпад', 'ph-game-controller', 'Контроллеры и вибрация'],
    ['sys', 'Система', 'ph-gear-six', 'Запуск и обновления'],
  ];
  const tab0 = focus === 'updates' ? 'sys' : NAV.some((n) => n[0] === focus) ? focus : (NAV.some((n) => n[0] === settings.setTab) ? settings.setTab : 'look');
  const grp = (title, body, sub = '') => `<div class="set-grp">${title ? `<div class="set-grp-t">${title}${sub ? `<span>${sub}</span>` : ''}</div>` : ''}${body}</div>`;
  const pane = (k, body) => { const n = NAV.find((x) => x[0] === k); return `<section class="set-pane" data-pane="${k}"${k === tab0 ? '' : ' hidden'}>
      <div class="set-h"><i class="ph ${n[2]}"></i><div><h3>${n[1]}</h3><p>${n[3]}</p></div></div>${body}</section>`; };
  const d = openDlg(`<div class="set-wrap">
    <nav class="set-nav"><div class="set-nav-t">Настройки</div>
      ${NAV.map(([k, l, ic]) => `<button class="set-nav-i${k === tab0 ? ' on' : ''}" data-set="${k}" data-nav><i class="ph ${ic}"></i><span>${l}</span>${k === 'sys' && updDot ? '<em class="set-dot" title="Есть обновление"></em>' : ''}</button>`).join('')}
      <div class="set-ver" id="set-ver"></div>
    </nav>
    <div class="set-main">
      <button class="btn btn-ghost btn-icon dlg-x set-x" data-act="dlg-close" title="Закрыть" data-nav><i class="ph ph-x"></i></button>
      <div class="set-scroll dlg-body">
      ${pane('look', `
        ${grp('Тема', `<div class="seg" style="align-self:flex-start">
          <label class="seg-opt"><input type="radio" name="theme" value="dark"${s.theme !== 'light' ? ' checked' : ''}>Тёмная</label>
          <label class="seg-opt"><input type="radio" name="theme" value="light"${s.theme === 'light' ? ' checked' : ''}>Светлая</label></div>`)}
        ${grp('Режим программы', `<div class="mode-pick">${[['normal', 'Обычный', 'ph-rows', 'Список слева, карточка игры справа'], ['compact', 'Компактный', 'ph-squares-four', 'Плитки, как в приложении Xbox'], ['bp', 'ТВ-режим', 'ph-television-simple', 'Для телевизора и геймпада']].map(([k, l, ic, sub]) => `<button class="mode-opt${(S.big.bp ? 'bp' : S.big.open ? 'compact' : 'normal') === k ? ' on' : ''}" data-mode="${k}" data-nav><i class="ph ${ic}"></i><b>${l}</b><span>${sub}</span></button>`).join('')}</div>`, 'с геймпада: ⧉ + ≡ вместе, ТВ-режим — кнопка Xbox / PS')}
        ${grp('Цветовая схема', `<div class="acc-pick">${ACCENTS.map(([k, l, btn, hi]) => `<button class="acc-opt${(settings.accent || 'xbox') === k ? ' on' : ''}" data-acc="${k}" title="${l}" data-nav>
            <span class="acc-sw" style="background:linear-gradient(135deg, ${hi}, ${btn})"></span><span>${l}</span></button>`).join('')}</div>
          <div class="tint-row"><span>Оттенок интерфейса</span><div class="seg tint-seg">${TINTS.map(([k, l]) => `<label class="seg-opt"><input type="radio" name="tint" value="${k}"${(settings.tint || 'soft') === k ? ' checked' : ''}>${l}</label>`).join('')}</div></div>`, 'кнопки, выделение, фон и панели')}
        ${grp('Фон за карточкой игры', `<div class="vol-row blur-row"><span class="blur-l">Размытие</span><input type="range" id="k-blur" min="0" max="60" step="2" value="${blurPx()}"><span class="blur-v" id="k-blur-v">${blurPx() ? blurPx() + ' px' : 'нет'}</span></div>`, 'Меняется сразу — видно за окном')}
        ${grp('Список игр слева', `<div class="lsz-pick">${LSIZES.map(([k, l]) => `<label class="lsz-opt${listSize() === k ? ' on' : ''}" data-lsz="${k}" data-nav><span class="lsz-prev lsz-${k}"><i></i><b></b></span>${l}</label>`).join('')}</div>`, 'размер обложек · Ctrl + колёсико над списком')}
        ${grp('Карточка игры', chk('activity', s.showActivity !== false, 'График активности', 'Сколько вы играли в каждый из последних 14 дней.'))}`)}
      ${pane('lib', `
        ${grp('Лаунчеры', `
          ${chk('autostores', settings.autoStores !== false, 'Автоматически находить игры из лаунчеров', 'Steam, Epic Games, GOG, Ubisoft Connect, EA app и Battle.net. ' +  'Установленные игры сами появляются в библиотеке. Проверка при запуске программы и при возврате в окно.')}
          <div class="row-btns"><button class="btn btn-secondary" data-act="store-sync"><i class="ph ph-magnifying-glass"></i>Найти новые игры сейчас</button>
            ${(settings.storeIgnore || []).length ? `<button class="btn btn-ghost" data-act="store-unignore" title="Эти игры вы убрали из библиотеки вручную — они не добавляются снова">Вернуть убранные вручную (${settings.storeIgnore.length})</button>` : ''}</div>
          <div class="set-sep"></div>
          ${chk('steamtime', settings.steamTime !== false, 'Брать время в игре из Steam', 'Часы и дата последнего запуска подтягиваются из самого Steam — даже если игру запускали не через эту программу.')}
          <button class="btn btn-secondary" data-act="steam-sync" style="align-self:flex-start"><i class="ph ph-arrows-clockwise"></i>Обновить время из Steam сейчас</button>`)}
        ${grp('Новые игры', chk('scanenrich', settings.scanEnrich !== false, 'Сразу искать обложку, фон и описание', 'Для игр, добавленных вручную, сканированием папки и автоматически из лаунчеров.'))}
        ${grp('Обслуживание', `<div class="row-btns">
          <button class="btn btn-secondary" data-act="check-games"><i class="ph ph-magnifying-glass-plus"></i>Проверить, все ли игры на месте</button>
          <button class="btn btn-secondary" id="k-backup"><i class="ph ph-download-simple"></i>Резервная копия…</button></div>`)}`)}
      ${pane('art', `
        ${grp('RAWG', `<div class="field"><label>Ключ API ${keyState(s.rawgKey)}</label><input class="input" type="password" id="k-rawg" value="${esc(s.rawgKey || '')}" placeholder="Вставьте ключ RAWG">
          <div class="hint">Бесплатно: <a data-url="https://rawg.io/apidocs">rawg.io/apidocs</a> → Get API Key. Без ключа описания и жанры не находятся.</div></div>`, 'описания, жанры, год')}
        ${grp('SteamGridDB', `<div class="field"><label>Ключ API ${keyState(s.sgdbKey)}</label><input class="input" type="password" id="k-sgdb" value="${esc(s.sgdbKey || '')}" placeholder="Вставьте ключ SteamGridDB">
          <div class="hint">Бесплатно: <a data-url="https://www.steamgriddb.com/profile/preferences/api">steamgriddb.com</a> → Profile → Preferences → API. Нужен для вертикальных обложек, фонов и логотипов игр не из Steam.</div></div>
          <div class="btn-row"><button class="btn btn-secondary" id="k-art-test"><i class="ph ph-plug"></i>Проверить оба ключа</button><span class="hint" id="k-art-res" style="margin:0"></span></div>`, 'обложки, фоны, логотипы')}
        ${grp('Перевод описаний на русский', `<div class="field"><label>Сервис</label><select class="input" id="k-prov" style="width:100%">
          <option value="none"${(s.aiProvider || 'none') === 'none' ? ' selected' : ''}>Не переводить (описания на английском)</option>
          <option value="gemini"${s.aiProvider === 'gemini' ? ' selected' : ''}>Google Gemini — бесплатно</option>
          <option value="groq"${s.aiProvider === 'groq' ? ' selected' : ''}>Groq — бесплатно</option>
          <option value="claude"${s.aiProvider === 'claude' ? ' selected' : ''}>Claude — платно</option></select></div>
        <div class="field" data-prov="gemini"><label>Ключ Gemini ${keyState(s.geminiKey)}</label><input class="input" type="password" id="k-gemini" value="${esc(s.geminiKey || '')}" placeholder="AIza…">
          <div class="hint">Бесплатно, без карты: <a data-url="https://aistudio.google.com/apikey">aistudio.google.com/apikey</a> → Create API key.</div></div>
        <div class="field" data-prov="groq"><label>Ключ Groq ${keyState(s.groqKey)}</label><input class="input" type="password" id="k-groq" value="${esc(s.groqKey || '')}" placeholder="gsk_…">
          <div class="hint">Бесплатно: <a data-url="https://console.groq.com/keys">console.groq.com/keys</a>.</div></div>
        <div class="field" data-prov="claude"><label>Ключ Anthropic ${keyState(s.claudeKey)}</label><input class="input" type="password" id="k-claude" value="${esc(s.claudeKey || '')}" placeholder="sk-ant-…">
          <div class="hint"><a data-url="https://console.anthropic.com/">console.anthropic.com</a></div></div>
        <div class="btn-row" id="k-test-row"><button class="btn btn-secondary" id="k-test">Проверить ключ</button><span class="hint" id="k-test-res" style="margin:0"></span></div>`)}
        <div class="hint set-note"><i class="ph ph-info"></i>Для игр Steam картинки берутся прямо из Steam — ключи для них не нужны.</div>`)}
      ${pane('sound', `
        ${grp('Набор звуков', `<div class="snd-pick">${SOUND_PACKS.map(([k, l, d]) => `<button class="snd-opt${(settings.soundPack || 'xbox') === k ? ' on' : ''}" data-snd="${k}" data-nav><i class="ph ph-waveform"></i><div><b>${l}</b><span>${d}</span></div><i class="ph ph-play-circle snd-play"></i></button>`).join('')}</div>`, 'нажмите, чтобы послушать')}
        ${grp('', `${chk('sound', s.sound !== false, 'Звуки интерфейса', 'Щелчки при навигации, звук запуска игры, смена режима.')}
          <div class="vol-row"><i class="ph ph-speaker-low"></i><input type="range" id="k-vol" min="0" max="100" value="${Math.round((s.soundVol ?? 0.6) * 100)}"><i class="ph ph-speaker-high"></i>
          <button class="btn btn-secondary" id="k-vol-test"><i class="ph ph-play"></i>Проверить</button></div>`)}`)}
      ${pane('pad', `
        ${grp('Подключённые контроллеры', padList.length ? `<div class="set-pads">${padList.map((p) => `<div class="set-pad"><i class="ph ph-game-controller"></i><b>${esc(padName(p))}</b></div>`).join('')}</div>
            <button class="btn btn-secondary" data-act="pad-dlg" style="align-self:flex-start"><i class="ph ph-pencil-simple"></i>Переименовать и найти контроллер…</button>`
          : '<div class="hint" style="margin:0">Сейчас ни один геймпад не подключён. Подключите его и нажмите любую кнопку.</div>')}
        ${grp('Вибрация', `${chk('rumble', settings.rumble !== false, 'Лёгкий вибро-отклик в меню', 'Короткий толчок при перемещении, выборе, смене вкладки и запуске игры.')}
          <div class="vol-row"><i class="ph ph-vibrate"></i><input type="range" id="k-rs" min="10" max="100" value="${Math.round((settings.rumbleStrength ?? 0.6) * 100)}"><button class="btn btn-secondary" id="k-rt"${padList.length ? '' : ' disabled'}>Проверить</button></div>`)}`)}
      ${pane('sys', `
        ${s.autostartSupported ? grp('Запуск', `${chk('autostart', !!s.autostart, 'Запускать вместе с Windows', 'Программа стартует свёрнутой в трей (значок у часов) и не мешает. Открыть — щелчок по значку.')}
          ${chk('tray', !!s.closeToTray, 'Кнопка ✕ сворачивает в трей', 'Программа продолжит работать и считать время игр. Выйти — правой кнопкой по значку в трее → «Выход».')}`) : ''}
        ${grp('<span id="upd-sec">Обновления</span>', `<div id="upd-block">${updateBlockHTML()}</div>
          ${chk('autoupd', s.autoUpdate !== false, 'Проверять обновления автоматически', 'При запуске программы и раз в 6 часов.')}
          ${chk('autodl', s.autoDownloadUpdates !== false, 'Скачивать сразу, а ставить при выходе', 'Новая версия тихо скачается в фоне и установится, когда вы закроете программу. Иначе — только уведомление.')}`)}`)}
      </div>
      <div class="dialog-actions set-act"><button class="btn btn-secondary" data-act="dlg-close">Отмена</button><button class="btn btn-primary" id="k-save">Сохранить</button></div>
    </div></div>`, { cls: 'set-dlg' });
  const showTab = (k) => {
    d.querySelectorAll('[data-set]').forEach((b) => b.classList.toggle('on', b.dataset.set === k));
    d.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== k; });
    $('.set-scroll', d).scrollTop = 0; settings.setTab = k;
  };
  d.querySelector('.set-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-set]'); if (!b || b.classList.contains('on')) return; sfx('tab'); showTab(b.dataset.set); });
  SETTAB.fn = (dir) => { const i = NAV.findIndex((n) => n[0] === settings.setTab); const k = NAV[(Math.max(0, i) + dir + NAV.length) % NAV.length][0]; sfx('tab'); showTab(k); };
  settings.setTab = tab0;
  api.getAppVersion?.().then((v) => { const el = $('#set-ver', d); if (el) el.textContent = 'Game Library ' + v; });
  $('#k-backup', d).onclick = () => backupDlg();
  d.querySelector('.mode-pick').addEventListener('click', (e) => { const o = e.target.closest('[data-mode]'); if (!o) return; closeDlg(); switchMode(o.dataset.mode); });
  const accBefore = settings.accent, packBefore = settings.soundPack, tintBefore = settings.tint, lsBefore = settings.listSize, soundWas = settings.sound;
  d.querySelectorAll('input[name="tint"]').forEach((r) => r.onchange = () => { settings.tint = r.value; applyAccent(); render(); });
  d.querySelector('.acc-pick').addEventListener('click', (e) => { const o = e.target.closest('[data-acc]'); if (!o) return;
    settings.accent = o.dataset.acc; applyAccent(); render(); sfx('move');
    d.querySelectorAll('[data-acc]').forEach((x) => x.classList.toggle('on', x === o)); });
  d.querySelector('.snd-pick').addEventListener('click', (e) => { const o = e.target.closest('[data-snd]'); if (!o) return;
    settings.soundPack = o.dataset.snd; d.querySelectorAll('[data-snd]').forEach((x) => x.classList.toggle('on', x === o));
    settings.sound = true; SND.last = {};
    clearTimeout(SND.prevT); ['move', 'select', 'tab'].forEach((n, i) => setTimeout(() => { SND.last = {}; sfx(n); }, i * 180));
    SND.prevT = setTimeout(() => { SND.last = {}; sfx('launch'); settings.sound = soundWas; }, 620); });
  d.querySelector('.lsz-pick').addEventListener('click', (e) => { const o = e.target.closest('[data-lsz]'); if (!o) return;
    setListSize(o.dataset.lsz, true); sfx('move'); d.querySelectorAll('[data-lsz]').forEach((x) => x.classList.toggle('on', x === o)); });
  $('#k-rt', d).onclick = () => { const was = [settings.rumble, settings.rumbleStrength, INPUT.mode];
    settings.rumble = true; settings.rumbleStrength = +$('#k-rs', d).value / 100; if (INPUT.mode === 'kbd') INPUT.mode = 'xbox';
    rumble('select', padList[0]); setTimeout(() => rumble('move', padList[0]), 180);
    setTimeout(() => { rumble('launch', padList[0]); [settings.rumble, settings.rumbleStrength, INPUT.mode] = was; }, 380); };
  bindChecks(d);
  bindUpdateBlock(d);
  const provSync = () => {
    const p = $('#k-prov', d).value;
    d.querySelectorAll('[data-prov]').forEach((el) => { el.hidden = el.dataset.prov !== p; });
    $('#k-test-row', d).hidden = p === 'none';
    $('#k-test-res', d).textContent = '';
  };
  provSync();
  $('#k-prov', d).onchange = provSync;
  d.querySelectorAll('input[name="theme"]').forEach((r) => r.onchange = () => { settings.theme = r.value; applyTheme(); render(); });
  const blurBefore = settings.bgBlur;
  $('#k-blur', d).oninput = () => { settings.bgBlur = +$('#k-blur', d).value; applyBlur(); $('#k-blur-v', d).textContent = blurPx() ? blurPx() + ' px' : 'нет'; };
  const volBefore = settings.soundVol, soundBefore = settings.sound;
  const volTry = () => { settings.soundVol = +$('#k-vol', d).value / 100; settings.sound = true; sfx('launch'); settings.sound = soundBefore; };
  $('#k-vol', d).onchange = volTry;
  $('#k-vol-test', d).onclick = volTry;
  d.querySelector('[data-chk="autostart"]')?.addEventListener('chk', () => {
    if (chkVal(d, 'autostart') && !chkVal(d, 'tray')) d.querySelector('[data-chk="tray"]').click();
  });
  const keys = () => ({ aiProvider: $('#k-prov', d).value, geminiKey: $('#k-gemini', d).value.trim(), groqKey: $('#k-groq', d).value.trim(), claudeKey: $('#k-claude', d).value.trim() });
  $('#k-art-test', d).onclick = async () => {
    const out = $('#k-art-res', d); out.style.color = ''; out.textContent = 'Проверяю…';
    const r = await api.testArtKeys?.({ rawgKey: $('#k-rawg', d).value.trim(), sgdbKey: $('#k-sgdb', d).value.trim() });
    if (!r) { out.textContent = ''; return; }
    const t = { ok: 'работает', bad: 'неверный ключ', err: 'нет связи', none: 'не задан' };
    out.textContent = `RAWG: ${t[r.rawg]} · SteamGridDB: ${t[r.sgdb]}`;
    out.style.color = r.rawg === 'ok' && r.sgdb === 'ok' ? '#7fd7a8' : r.rawg === 'bad' || r.sgdb === 'bad' ? '#f08a8d' : '';
  };
  $('#k-test', d).onclick = async () => {
    const out = $('#k-test-res', d); out.style.color = ''; out.textContent = 'Проверяю…';
    const r = await api.testAi(keys());
    out.style.color = r.ok ? '#7fd7a8' : '#f08a8d';
    out.textContent = r.ok ? 'Работает' : 'Ошибка: ' + r.message;
  };
  $('#k-save', d).onclick = async () => {
    Object.assign(settings, keys(), {
      rawgKey: $('#k-rawg', d).value.trim(), sgdbKey: $('#k-sgdb', d).value.trim(),
      theme: d.querySelector('input[name="theme"]:checked').value, showActivity: chkVal(d, 'activity'),
      sound: chkVal(d, 'sound'), rumble: chkVal(d, 'rumble'), steamTime: chkVal(d, 'steamtime'), autoStores: chkVal(d, 'autostores'), scanEnrich: chkVal(d, 'scanenrich'), rumbleStrength: +$('#k-rs', d).value / 100, soundVol: +$('#k-vol', d).value / 100, bgBlur: +$('#k-blur', d).value,
      autoUpdate: chkVal(d, 'autoupd'), autoDownloadUpdates: chkVal(d, 'autodl'),
    });
    if (s.autostartSupported) { settings.autostart = chkVal(d, 'autostart'); settings.closeToTray = chkVal(d, 'tray'); }
    await saveSettingsQuiet();
    dlgClose = null; closeDlg(); applyTheme(); render();
    toast(settings.autostart ? 'Сохранено — программа будет запускаться с Windows в трее' : 'Настройки сохранены', 'ok');
  };
  const themeBefore = settings.theme;
  dlgClose = () => { settings.theme = themeBefore; settings.soundVol = volBefore; settings.bgBlur = blurBefore; settings.accent = accBefore; settings.soundPack = packBefore; settings.tint = tintBefore; settings.listSize = lsBefore; applyListSize(); renderSideTop(); applyTheme(); render(); };
}

// ─── Резервная копия ─────────────────────────────────────────────────────────
function backupDlg() {
  const d = openDlg(`${head('Резервная копия')}
    <div class="dlg-text">Вся библиотека — игры, обложки, категории, теги и время — в одном файле. Пригодится при переносе на другой компьютер. Ключи API в копию не попадают.</div>
    <button class="btn btn-primary" data-b="export" style="align-self:flex-start"><i class="ph ph-download-simple"></i>Сохранить копию…</button>
    <div class="section-t">Восстановить из копии</div>
    <div class="btn-row"><button class="btn btn-secondary" data-b="merge"><i class="ph ph-plus"></i>Добавить к текущим</button>
      <button class="btn btn-secondary" data-b="replace" style="color:#f08a8d"><i class="ph ph-arrows-counter-clockwise"></i>Заменить всё</button></div>
    <div class="hint" style="margin:0">«Добавить» пропускает игры, которые уже есть. «Заменить» удалит текущий список и восстановит его из файла.</div>`);
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    if (b.dataset.b === 'export') {
      const r = await api.exportLibrary();
      if (r.ok) toast(`Копия сохранена: ${r.count} ${plural(r.count, 'игра', 'игры', 'игр')}`, 'ok'); else if (r.error) toast('Ошибка: ' + r.error, 'err');
      return;
    }
    const mode = b.dataset.b;
    if (mode === 'replace' && !(await confirmDlg('Заменить всю библиотеку?', 'Текущий список игр будет заменён данными из файла копии.', 'Заменить'))) return backupDlg();
    const r = await api.importLibrary(mode);
    if (r.ok) {
      games = await api.getGames(); settings = await api.getSettings(); cats = settings.cats || [];
      closeDlg(); render(); toast(`Восстановлено: ${r.count}, всего игр: ${r.total}`, 'ok');
    } else if (r.error) toast('Ошибка: ' + r.error, 'err');
  });
}

// ─── Обновления ──────────────────────────────────────────────────────────────
let updateInfo = null;
function updateText(d) {
  const v = d.version ? esc(d.version) : '';
  switch (d.status) {
    case 'checking': return 'Проверяю, есть ли новая версия…';
    case 'up-to-date': return 'Установлена последняя версия.';
    case 'available': return `Доступна версия ${v}.`;
    case 'downloading': return `Скачиваю версию ${v}… ${d.percent || 0}%`;
    case 'downloaded': return `Версия ${v} скачана — установится при выходе из программы или сейчас по кнопке.`;
    case 'error': return 'Не удалось проверить: ' + esc(d.message || 'неизвестная ошибка');
    case 'not-configured': return 'Сервер обновлений не подключён в этой сборке. Можно обновиться из скачанного установщика.';
    case 'dev-mode': return 'Программа запущена из исходников (npm start). Автообновление работает в установленной версии.';
    default: return 'Ещё не проверялось.';
  }
}
function updateBlockHTML() {
  const d = updateState;
  const feed = updateInfo?.feed;
  const canCheck = feed?.configured;
  let actions = '';
  if (canCheck && !['checking', 'downloading'].includes(d.status)) actions += '<button class="btn btn-secondary" data-u="check"><i class="ph ph-arrows-clockwise"></i>Проверить сейчас</button>';
  if (d.status === 'available') actions += '<button class="btn btn-primary" data-u="dl"><i class="ph ph-download-simple"></i>Скачать</button>';
  if (d.status === 'downloaded') actions += '<button class="btn btn-primary" data-u="install"><i class="ph ph-arrow-clockwise"></i>Перезапустить и обновить</button>';
  actions += '<button class="btn btn-ghost" data-u="file"><i class="ph ph-file-arrow-up"></i>Обновить из файла…</button>';
  return `<div class="upd-box">
    <div class="upd-row"><span class="upd-ver">Версия ${esc(updateInfo?.version || '')}</span>
      ${canCheck && feed.url ? `<a data-url="${esc(feed.url)}" class="upd-link">все версии</a>` : ''}</div>
    <div class="upd-status ${d.status === 'error' ? 'err' : d.status === 'downloaded' || d.status === 'available' ? 'new' : ''}">${updateText(d)}</div>
    ${d.status === 'downloading' ? `<div class="bar"><div style="width:${d.percent || 0}%"></div></div>` : ''}
    <div class="btn-row" style="flex-wrap:wrap">${actions}</div></div>`;
}
function bindUpdateBlock(root) {
  root.querySelector('#upd-block')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-u]'); if (!b) return;
    const u = b.dataset.u;
    if (u === 'check') { updateState = { status: 'checking' }; refreshUpdateBlock(); api.checkForUpdates(); }
    if (u === 'dl') { updateState = { ...updateState, status: 'downloading', percent: 0 }; refreshUpdateBlock(); api.downloadUpdate(); }
    if (u === 'install') api.installUpdate();
    if (u === 'file') {
      const r = await api.updateFromFile();
      if (r?.ok && r.dev) toast('Установщик запущен');
      else if (r?.ok) toast('Устанавливаю обновление — программа перезапустится сама', 'ok');
    }
  });
}
function refreshUpdateBlock() { const el = $('#upd-block'); if (el) el.innerHTML = updateBlockHTML(); }
function handleUpdate(d) {
  const prev = updateState.status;
  updateState = d || {};
  const btn = $('#upd-btn');
  btn.hidden = !['available', 'downloading', 'downloaded'].includes(d.status);
  $('#upd-txt').textContent = d.status === 'downloading' ? `Обновление ${d.percent || 0}%` : d.status === 'downloaded' ? 'Перезапустить и обновить' : `Доступна ${d.version || 'новая версия'}`;
  refreshUpdateBlock();
  if (d.status === 'downloaded' && prev !== 'downloaded') toast(`Версия ${d.version} скачана — установится при выходе`, 'ok');
  if (d.manual && d.status === 'up-to-date' && $('#upd-block')) toast('Установлена последняя версия');
}
function updateDlg() {
  if (updateState.status === 'downloaded') return api.installUpdate();
  settingsDlg('updates');
}
