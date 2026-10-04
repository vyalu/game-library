'use strict';
// ─── Левая панель: заголовок, фильтры, список, низ ────────────────────────────
function renderSideTop() {
  const list = filterList(S.filter);
  const tk = tabKeys();
  const extra = !tk.includes(S.filter);
  const [gName, gIcon] = GROUPS[S.group];
  $('#sb-top').innerHTML = `
    <div class="sb-head">
      <h1>Библиотека</h1><span class="sb-count">${list.length}</span>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-icon sb-ico${extra ? ' on' : ''}" data-act="filter-menu" title="Категории, жанры, теги" data-nav><i class="ph ph-funnel-simple"></i></button>
      <button class="btn btn-ghost btn-icon sb-ico" data-act="cycle-group" title="Группировка: ${esc(gName.toLowerCase())}" data-nav><i class="${gIcon}"></i></button>
      ${(() => { const i = LSIZES.findIndex((x) => x[0] === listSize()), nx = LSIZES[(i + 1) % LSIZES.length];
        return `<button class="btn btn-ghost btn-icon sb-ico" data-act="list-size" title="Размер обложек: ${LSIZES[i][1].toLowerCase()} → ${nx[1].toLowerCase()} (или Ctrl + колёсико над списком)" data-nav><i class="ph ${LSIZES[i][2]}"></i></button>`; })()}
      <button class="btn btn-ghost btn-icon sb-ico" data-act="lib-menu" title="Ещё" data-nav><i class="ph ph-dots-three"></i></button>
    </div>
    <div class="chips">
      ${tk.map((k) => { const c = k.startsWith('cat:') ? catById(k.slice(4)) : null;
        return `<button class="chip${S.filter === k ? ' on' : ''}" data-act="filter" data-arg="${esc(k)}" data-nav>${c ? `<span class="chip-dot" style="background:${esc(catColor(c))}"></span>` : ''}${esc(tabLabel(k))}</button>`; }).join('')}
      ${extra ? `<button class="chip on" data-act="filter-menu" data-nav>${esc(filterName(S.filter))}<i class="ph ph-x" data-act="filter" data-arg="all" title="Сбросить"></i></button>` : ''}
      <button class="chip chip-add" data-act="open-cats" title="Свои списки и порядок вкладок" data-nav><i class="ph ph-plus"></i></button>
    </div>
    ${(() => { const t = listHoursText(S.filter, list); return t ? `<div class="list-hours" title="${esc(listHoursTitle(list))}"><i class="ph ph-hourglass-medium"></i>${list.filter((g) => !g.completed).length} ${plural(list.filter((g) => !g.completed).length, 'игра', 'игры', 'игр')} · ${esc(t)}</div>` : ''; })()}
    ${(() => { const n = games.filter(isMissing).length; return n && !S.missDismissed ? `<div class="miss-bar"><i class="ph ph-warning-circle"></i><span class="grow" title="Игры из библиотеки, которых больше нет на компьютере">Нет на компьютере: ${n}</span>
      <button class="btn btn-ghost" data-act="check-games" data-nav>Разобраться</button><button class="btn btn-ghost btn-icon" data-act="miss-dismiss" title="Скрыть" data-nav><i class="ph ph-x"></i></button></div>` : ''; })()}`;
}
// Описание: разбираем текст из Steam на блоки — оценки критиков, «лид», списки, разделы
const DESC_OPEN = new Set();
const RX_REVIEW = /^(\d{1,3}(?:[.,]\d)?)\s*\/\s*(5|10|100)\b\s*[-–—:]?\s*(.*)$/;
const capsRatio = (s) => { const L = s.replace(/[^a-zа-яё]/gi, ''); return L ? L.replace(/[^A-ZА-ЯЁ]/g, '').length / L.length : 0; };
const tidyCaps = (s) => s.replace(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё.'’]*/g, (w) => w.length > 3 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w);
function parseReview(seg) {
  const m = seg.match(RX_REVIEW); if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.')), of = +m[2]; if (!(val >= 0 && val <= of)) return null;
  let rest = m[3].trim(), quote = '';
  const q = rest.match(/[«"“„](.+?)[»"”]?\s*$/);
  if (q) { quote = q[1].trim(); rest = rest.slice(0, q.index); }
  const src = rest.replace(/[\s:,–—-]+$/, '').trim();
  if (!src || src.length > 60) return null;
  return { pct: Math.round(val / of * 100), score: m[1].replace(',', '.') + '/' + of, src: tidyCaps(src), quote };
}
function descBlocks(text) {
  const segs = [];
  for (const p of String(text || '').replace(/\r/g, '').split(/\n\s*\n+/)) {
    for (const line of p.split('\n')) {
      const mk = line.trim().match(/^\[\[(img|vid|h)\]\](.*)$/);
      if (mk) { segs.push({ br: true }, { mk: mk[1], t: mk[2].trim() }, { br: true }); continue; }
      // «...ПОИГРАТЬ*: • 98/100 GAMESBEAT «...»» — несколько пунктов в одной строке
      const parts = line.split(/\s*•\s*/);
      parts.forEach((x, i) => { x = x.trim(); if (x) segs.push({ t: x, li: i > 0 }); });
    }
    segs.push({ br: true });
  }
  const out = [], reviews = [], notes = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) out.push({ k: 'p', t: para.join('\n') }); para = []; };
  const flushList = () => { if (list) out.push({ k: 'ul', items: list }); list = null; };
  for (const s of segs) {
    if (s.br) { flushPara(); flushList(); continue; }
    if (s.mk) {
      if (s.mk === 'h') { if (s.t) out.push({ k: 'h', t: capsRatio(s.t) > .8 ? tidyCaps(s.t) : s.t }); }
      else if (s.mk === 'img' && /^https:\/\//.test(s.t)) out.push({ k: 'img', u: s.t });
      else if (s.mk === 'vid') { const [u, po] = s.t.split('|'); if (/^https:\/\//.test(u)) out.push({ k: 'vid', u, po: /^https:\/\//.test(po || '') ? po : '' }); }
      continue;
    }
    const md = s.t.match(/^#{1,4}\s*(.+?)\s*#*$/);   // разметка RAWG: ###Gameplay
    if (md) { flushPara(); flushList(); out.push({ k: 'h', t: md[1].replace(/\*\*/g, '') }); continue; }
    s.t = s.t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
    const r = parseReview(s.t);
    if (r) { flushPara(); flushList(); reviews.push(r); continue; }
    if (/^\*/.test(s.t) && /metacritic|рейтинг|оценк|score|rating/i.test(s.t)) { notes.push(s.t.replace(/^\*+\s*/, '')); continue; }
    if (s.li) { flushPara(); (list ||= []).push(s.t); continue; }
    flushList();
    const caps = capsRatio(s.t) > .8;
    if ((caps && s.t.length < 140) || (s.t.length < 60 && /:$/.test(s.t))) { flushPara(); out.push({ k: 'h', t: tidyCaps(s.t).replace(/[*\s:]+$/, '') }); continue; }
    para.push(s.t);
  }
  flushPara(); flushList();
  // Заголовок-«зазывалка» прямо перед оценками («ВЫ ПРОСТО ОБЯЗАНЫ ПОИГРАТЬ…») и пустые заголовки — убираем
  const blocks = out.filter((b, i) => !(b.k === 'h' && (!out[i + 1] || (out[i + 1].k === 'h' && out[i + 1] !== out[i]) || (reviews.length && /\*$|обязан|must play|acclaim|оценк|рейтинг/i.test(b.t)))));
  return { blocks, reviews, notes };
}
const pctTone = (p) => (p >= 85 ? 'hi' : p >= 70 ? 'mid' : 'lo');
function reviewsHTML(reviews, notes, open) {
  if (!reviews.length) return '';
  const avg = Math.round(reviews.reduce((a, r) => a + r.pct, 0) / reviews.length);
  const withQ = reviews.filter((r) => r.quote), bare = reviews.filter((r) => !r.quote);
  const card = (r, i) => `<div class="rv${i >= 4 ? ' rv-x' : ''}"><span class="rv-sc ${pctTone(r.pct)}">${esc(r.score)}</span><div class="rv-b"><b>${esc(r.src)}</b>${r.quote ? `<q>${esc(r.quote)}</q>` : ''}</div></div>`;

  return `<div class="rvs">
    <div class="rvs-head"><span class="rvs-avg ${pctTone(avg)}" style="--p:${avg}"><b>${avg}</b></span>
      <div><div class="rvs-t">Оценки критиков</div><div class="rvs-s">${reviews.length} ${plural(reviews.length, 'обзор', 'обзора', 'обзоров')} · средняя ${avg} из 100</div></div></div>
    ${withQ.length ? `<div class="rv-grid">${withQ.map(card).join('')}</div>` : ''}
    <div class="rvs-more"><div class="rvs-in">
      ${bare.length ? `<div class="rv-chips">${bare.map((r) => `<span class="rv-chip"><span class="rv-sc ${pctTone(r.pct)}">${esc(r.score)}</span>${esc(r.src)}</span>`).join('')}</div>` : ''}
      ${notes.map((n) => `<div class="rv-note">${esc(n)}</div>`).join('')}
    </div></div>
  </div>`;
}
function descHTML(g) {
  const { blocks, reviews, notes } = descBlocks(descSource(g));
  if (!blocks.length && !reviews.length) return '';
  // «Лид» — первый настоящий абзац о самой игре, а не заголовок или рекламная строка
  let li = blocks.findIndex((b) => b.k === 'p' && b.t.length >= 60 && capsRatio(b.t) < .5);
  if (li < 0) li = blocks.findIndex((b) => b.k === 'p');
  const lead = li >= 0 ? blocks[li].t : '';
  const rest = blocks.filter((_, i) => i !== li);
  const hiddenRev = reviews.some((r) => !r.quote) || notes.length || reviews.filter((r) => r.quote).length > 4;
  const long = rest.length > 0 || hiddenRev;
  const open = DESC_OPEN.has(g.id);
  const bl = (b) => b.k === 'h' ? `<h4>${esc(b.t)}</h4>`
    : b.k === 'img' ? `<img class="desc-img" data-act="lb-img" data-arg="${esc(b.u)}" ${open ? 'src' : 'data-src'}="${esc(b.u)}" alt="" loading="lazy" draggable="false">`
    : b.k === 'vid' ? `<video class="desc-vid" ${open ? 'src' : 'data-src'}="${esc(b.u)}" ${b.po ? `poster="${esc(b.po)}"` : ''} muted loop playsinline autoplay></video>`
    : b.k === 'ul' ? `<ul class="desc-list">${b.items.map((x) => `<li><i class="ph-bold ph-check"></i><span>${esc(x)}</span></li>`).join('')}</ul>`
    : `<p>${esc(b.t)}</p>`;
  return `<div class="desc${open ? ' open' : ''}${long ? ' long' : ''}">
    ${lead ? `<p class="desc-lead">${esc(lead)}</p>` : ''}
    ${reviewsHTML(reviews, notes, open)}
    ${rest.length ? `<div class="desc-rest"><div class="desc-in">${rest.map(bl).join('')}</div></div>` : ''}
    ${long ? `<button class="desc-more" data-act="desc-toggle" data-id="${esc(g.id)}" data-nav><span>${open ? 'Свернуть' : 'Читать полностью'}</span><i class="ph ph-caret-${open ? 'up' : 'down'}"></i></button>` : ''}
  </div>`;
}
// ─── Подробности игры: отзывы, Metacritic, скриншоты, трейлеры ──────────────
const EXTRA = { p: new Map(), busy: false, busyTry: new Map(), busyUntil: 0 };
// v4: игры не из Steam перепроверяем — раньше поиск в Steam мог «не найти» игру (лимит запросов, игры скрыты в регионе RU)
const needExtra = (g) => !!g && (!g.extra || !g.extra.t || (g.extra.v || 0) < 2 || (g.extra.from !== 'steam' && (g.extra.v || 0) < 4)) && (g.extraTries || 0) < 3 && (EXTRA.busyTry.get(g.id) || 0) < 3;
function loadExtra(id) {
  if (!api.gameExtra) return Promise.resolve(null);
  if (EXTRA.p.has(id)) return EXTRA.p.get(id);
  const g = byId(id); if (!g) return Promise.resolve(null);
  const pr = (async () => {
    const r = await api.gameExtra({ name: g.name, year: g.year || null, steamAppId: storeOf(g) === 'steam' && /^\d+$/.test(String(g.storeId || '')) ? g.storeId : null }).catch(() => null);
    const cur = byId(id); if (!cur) return null;
    if (r && !r.error && r.v) { cur.extra = r; cur.extraTries = 0; }
    else if (r?.error === 'steam-busy') { EXTRA.busyTry.set(id, (EXTRA.busyTry.get(id) || 0) + 1); EXTRA.busyUntil = Date.now() + 90e3; return cur.extra; }   // Steam попросил подождать — не считаем это неудачей
    else cur.extraTries = (cur.extraTries || 0) + 1;
    await saveGame(cur);
    const shown = (selGame()?.id === id && !S.big.open) || S.big.page === id;
    if (shown && r?.from) render();
    return cur.extra;
  })().finally(() => EXTRA.p.delete(id));
  EXTRA.p.set(id, pr);
  return pr;
}
// Открыли игру без подробностей — грузим сразу, не дожидаясь фоновой очереди
function wantExtra(g) { if (needExtra(g) && !EXTRA.p.has(g.id)) setTimeout(() => loadExtra(g.id), 250); }
async function extraSync() {
  if (EXTRA.busy || !api.gameExtra) return;
  EXTRA.busy = true;
  try {
    for (const g0 of games.filter(needExtra)) {
      if (!byId(g0.id) || !needExtra(byId(g0.id))) continue;
      if (EXTRA.busyUntil > Date.now()) await new Promise((res) => setTimeout(res, EXTRA.busyUntil - Date.now()));   // Steam просил подождать
      await loadExtra(g0.id);
      await new Promise((res) => setTimeout(res, 2000));   // магазин Steam не любит частые запросы
    }
  } finally { EXTRA.busy = false; }
}
// Текст для описания: из Steam с картинками и видео, если его не правили вручную
function descSource(g) {
  const ab = g.extra?.about;
  if (ab && !g.descUser && (HAS_RU.test(ab) || !HAS_RU.test(g.description || ''))) return ab;
  return g.description || '';
}
const fmtNum = (n) => Number(n || 0).toLocaleString('ru-RU');
const FEAT_IDS = { 2: 'ph-user', 1: 'ph-users-three', 9: 'ph-handshake', 38: 'ph-handshake', 39: 'ph-monitor', 24: 'ph-monitor', 49: 'ph-sword', 36: 'ph-sword', 44: 'ph-broadcast', 41: 'ph-television-simple', 23: 'ph-cloud', 30: 'ph-wrench', 62: 'ph-users' };
function gameMedia(g) {
  const x = g.extra || {};
  return [...(x.movies || []).map((m) => ({ v: m.src, t: m.thumb, n: m.n })), ...(x.shots || []).map((s) => ({ f: s.f, t: s.t }))];
}
function extraHTML(g) {
  wantExtra(g);
  const x = g.extra; if (!x || (!x.from && !x.hltb && !x.avgPlay)) return EXTRA.p.has(g.id) ? '<div class="gx-load"><span></span><span></span><span></span></div>' : '';
  const b = [];
  if (x.rev) { const t = x.rev.pct >= 80 ? 'hi' : x.rev.pct >= 60 ? 'mid' : 'lo';
    b.push(`<div class="gx-b gx-rev ${t}" title="Отзывы игроков в Steam"><i class="ph-fill ph-thumbs-${t === 'lo' ? 'down' : 'up'}"></i><div><b>${esc(x.rev.desc || x.rev.pct + '% положительных')}</b><span>${x.rev.pct}% из ${fmtNum(x.rev.total)} ${plural(x.rev.total, 'отзыва', 'отзывов', 'отзывов')}</span></div></div>`); }
  if (x.mc) b.push(`<div class="gx-b" title="Оценка критиков на Metacritic"><span class="gx-mc ${pctTone(x.mc.score)}">${x.mc.score}</span><div><b>Metacritic</b><span>оценка критиков</span></div></div>`);
  if (x.rawgRating) b.push(`<div class="gx-b"><i class="ph-fill ph-star"></i><div><b>${String(x.rawgRating.r).replace('.', ',')} из 5</b><span>${fmtNum(x.rawgRating.n)} оценок RAWG</span></div></div>`);
  if (x.ru && x.from === 'steam') b.push(x.ru.ui ? `<div class="gx-b"><i class="ph ph-translate"></i><div><b>Русский язык</b><span>${x.ru.voice ? 'интерфейс и озвучка' : 'интерфейс и субтитры'}</span></div></div>`
    : `<div class="gx-b gx-off"><i class="ph ph-translate"></i><div><b>Без русского</b><span>только другие языки</span></div></div>`);
  const hb = playtimeBadge(g, x); if (hb) b.unshift(hb);
  if (x.ctrl) b.push(`<div class="gx-b"><i class="ph ph-game-controller"></i><div><b>${x.ctrl === 'full' ? 'Полная' : 'Частичная'}</b><span>поддержка геймпада</span></div></div>`);
  if (x.ach) b.push(`<div class="gx-b"><i class="ph ph-trophy"></i><div><b>${fmtNum(x.ach)}</b><span>${plural(x.ach, 'достижение', 'достижения', 'достижений')}</span></div></div>`);
  const feats = (x.cats || []).filter((c) => FEAT_IDS[c.id]).slice(0, 8);
  const media = gameMedia(g);
  return `<div class="gx">
    ${b.length ? `<div class="gx-badges">${b.join('')}</div>` : ''}
    ${media.length ? `<div class="gx-mwrap at-start"><button class="gx-arr l" data-act="gx-scroll" data-arg="-1" title="Назад" tabindex="-1"><i class="ph-bold ph-caret-left"></i></button><div class="gx-media">${media.map((m, i) => `<button class="gx-th${m.v ? ' vid' : ''}" data-act="lb" data-id="${esc(g.id)}" data-arg="${i}" title="${m.v ? esc(m.n || 'Трейлер') : 'Скриншот'}" data-nav><img src="${esc(m.t)}" alt="" loading="lazy" draggable="false">${m.v ? '<i class="ph-fill ph-play"></i>' : ''}</button>`).join('')}</div><button class="gx-arr r" data-act="gx-scroll" data-arg="1" title="Дальше" tabindex="-1"><i class="ph-bold ph-caret-right"></i></button></div>` : ''}
    ${feats.length ? `<div class="gx-feats">${feats.map((c) => `<span><i class="ph ${FEAT_IDS[c.id]}"></i>${esc(c.n)}</span>`).join('')}</div>` : ''}
  </div>`;
}
// «Сколько проходить»: сюжет / с допами / на 100% (HowLongToBeat) и сколько из этого уже наиграно
const fmtH = (h) => (h >= 10 ? Math.round(h) : Math.round(h * 2) / 2).toLocaleString('ru-RU') + ' ч';
function playtimeBadge(g, x) {
  const h = x.hltb;
  if (!h && !x.avgPlay) return '';
  const mine = (g.playtime || 0) / 60;
  const parts = h ? [['сюжет', h.main], ['с допами', h.plus], ['на 100%', h.full]].filter((p) => p[1] > 0) : [['в среднем играют', x.avgPlay.h]];
  const goal = h ? (h.main || h.plus || h.full) : x.avgPlay.h;
  let you = '';
  if (mine >= 0.5 && goal) {
    const pct = Math.round(mine / goal * 100);
    you = `<div class="gx-you"><span class="gx-ybar"><span style="width:${Math.min(100, pct)}%"></span></span><small>вы: ${esc(fmtH(mine))} · ${pct >= 100 ? (h && h.main ? 'больше, чем сюжет' : 'больше среднего') : `≈${pct}% ${h && h.main ? 'сюжета' : 'от среднего'}`}</small></div>`;
  }
  return `<div class="gx-b gx-hltb" title="${h ? 'Сколько проходить — по данным HowLongToBeat' : 'Сколько в среднем играют — по данным RAWG'}"><i class="ph ph-hourglass-medium"></i>
    <div class="gx-ht"><div class="gx-hr">${parts.map(([l, v]) => `<span><b>${esc(fmtH(v))}</b>${esc(l)}</span>`).join('')}</div>${you}</div></div>`;
}
// Сколько проходить весь список (свои списки вроде «Поиграть потом»): сумма «сюжета» непройденных игр
function listHours(list) {
  let sum = 0, have = 0, left = 0;
  for (const g of list) {
    if (g.completed) continue;
    left++;
    const h = g.extra?.hltb ? (g.extra.hltb.main || g.extra.hltb.plus || g.extra.hltb.full) : g.extra?.avgPlay?.h;
    if (h > 0) { sum += h; have++; }
  }
  return { sum: Math.round(sum), have, left };
}
function listHoursText(key, list) {
  if (!String(key || '').startsWith('cat:')) return '';
  const r = listHours(list); if (!r.sum) return '';
  return `≈ ${r.sum.toLocaleString('ru-RU')} ч на прохождение`;
}
function listHoursTitle(list) { const r = listHours(list); return `Сумма «сюжета» по HowLongToBeat для непройденных игр списка${r.have < r.left ? ` (данные есть у ${r.have} из ${r.left})` : ''}`; }
// ─── Мои скриншоты и клипы (Steam F12, Xbox Game Bar, NVIDIA) ─────────────────
const MYSHOTS = new Map();   // id игры → { t, list } | промис загрузки
function wantMyShots(g) {
  if (!api.myScreenshots || !g) return null;
  const c = MYSHOTS.get(g.id);
  if (c && !(c instanceof Promise) && Date.now() - c.t < 5 * 60e3) return c.list;
  if (!(c instanceof Promise)) {
    const pr = api.myScreenshots({ name: g.name, store: storeOf(g), storeId: g.storeId }).catch(() => []).then((list) => {
      MYSHOTS.set(g.id, { t: Date.now(), list: Array.isArray(list) ? list : [] });
      if (list?.length && ((selGame()?.id === g.id && !S.big.open) || S.big.page === g.id)) render();
    });
    MYSHOTS.set(g.id, pr);
  }
  return c && !(c instanceof Promise) ? c.list : null;
}
const shotDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
function myShotsHTML(g) {
  const list = wantMyShots(g); if (!list?.length) return '';
  const n = list.filter((x) => !x.v).length, v = list.length - n;
  return `<div class="gx-mine"><div class="gx-mh"><i class="ph ph-camera"></i>Мои скриншоты<span>${[n && `${n} ${plural(n, 'снимок', 'снимка', 'снимков')}`, v && `${v} ${plural(v, 'клип', 'клипа', 'клипов')}`].filter(Boolean).join(' · ')}</span></div>
    <div class="gx-mwrap at-start"><button class="gx-arr l" data-act="gx-scroll" data-arg="-1" tabindex="-1"><i class="ph-bold ph-caret-left"></i></button>
    <div class="gx-media">${list.map((x, i) => `<button class="gx-th mine${x.v ? ' vid' : ''}" data-act="lb-my" data-id="${esc(g.id)}" data-arg="${i}" title="${esc(shotDate(x.time))}" data-nav>${x.t || !x.v ? `<img src="${esc(x.t || x.f)}" alt="" loading="lazy" decoding="async" draggable="false">` : '<span class="gx-vph"></span>'}${x.v ? '<i class="ph-fill ph-play"></i>' : ''}<em>${esc(shotDate(x.time))}</em></button>`).join('')}</div>
    <button class="gx-arr r" data-act="gx-scroll" data-arg="1" tabindex="-1"><i class="ph-bold ph-caret-right"></i></button></div></div>`;
}
function lbMy(id, i) {
  const c = MYSHOTS.get(id); if (!c || c instanceof Promise) return;
  lbOpen(c.list.map((x) => (x.v ? { v: x.f, t: x.t, n: 'Мой клип · ' + shotDate(x.time) } : { f: x.f, t: x.t, d: shotDate(x.time) })), i);
}
// Просмотр скриншотов и трейлеров во весь экран: ←/→, LB/RB, A — пауза, B/Esc — закрыть
function lbOpen(items, i = 0) {
  if (!items.length) return;
  S.lb = { items, i: Math.max(0, Math.min(items.length - 1, i)) };
  sfx('open'); lbDraw();
}
function lbDraw() {
  const L = S.lb; if (!L) return;
  let box = $('#lb');
  if (!box) { box = document.createElement('div'); box.id = 'lb'; document.body.appendChild(box);
    box.addEventListener('click', (e) => { const a = e.target.closest('[data-lb]'); if (a) { e.stopPropagation(); const k = a.dataset.lb; return k === 'x' ? lbClose() : k === 'p' ? lbStep(-1) : k === 'n' ? lbStep(1) : lbGo(+k); } if (e.target === box || e.target.classList.contains('lb-stage')) lbClose(); }); }
  const it = L.items[L.i];
  box.innerHTML = `<div class="lb-stage">${it.v ? `<video class="lb-media" src="${esc(it.v)}" ${it.t ? `poster="${esc(it.t)}"` : ''} controls autoplay playsinline></video>` : `<img class="lb-media" src="${esc(it.f)}" alt="" draggable="false">`}</div>
    ${L.items.length > 1 ? `<button class="lb-nav lb-p" data-lb="p" ${L.i ? '' : 'disabled'}><i class="ph ph-caret-left"></i></button><button class="lb-nav lb-n" data-lb="n" ${L.i < L.items.length - 1 ? '' : 'disabled'}><i class="ph ph-caret-right"></i></button>` : ''}
    <div class="lb-top"><span>${it.v ? esc(it.n || 'Трейлер') : it.d ? 'Мой скриншот · ' + esc(it.d) : 'Скриншот'} · ${L.i + 1} из ${L.items.length}</span><button class="lb-x" data-lb="x" title="Закрыть (Esc / B)"><i class="ph ph-x"></i></button></div>
    ${L.items.length > 1 ? `<div class="lb-strip">${L.items.map((m, j) => `<button class="${j === L.i ? 'on' : ''}${m.v ? ' vid' : ''}" data-lb="${j}"><img src="${esc(m.t || m.f)}" alt="" loading="lazy" draggable="false">${m.v ? '<i class="ph-fill ph-play"></i>' : ''}</button>`).join('')}</div>` : ''}
    <div class="lb-hint">${keyCap('lb')}${keyCap('rb')} листать · ${it.v ? keyCap('a') + ' пауза · ' : ''}${keyCap('b')} закрыть</div>`;
  const on = box.querySelector('.lb-strip .on'); if (on) { const st = on.parentElement; st.scrollTo({ left: on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' }); }
}
function lbGo(j) { if (!S.lb || j === S.lb.i || j < 0 || j >= S.lb.items.length) return; S.lb.i = j; sfx('move'); lbDraw(); }
function lbStep(d) { if (S.lb) lbGo(S.lb.i + d); }
function lbClose() { if (!S.lb) return; S.lb = null; $('#lb')?.remove(); sfx('close'); }
function lbToggle() { const v = $('#lb video'); if (v) v.paused ? v.play() : v.pause(); }
function lbFromGame(id, i) { const g = byId(id); if (g) lbOpen(gameMedia(g), i); }
function listRow(g, on) {
  const sel = S.selected.has(g.id);
  return `<div class="lrow${on ? ' on' : ''}${sel ? ' sel' : ''}" data-act="row" data-id="${esc(g.id)}" data-nav>
    <div class="lthumb" style="${coverBg(g)}">${g.cover ? '' : esc(initials(g.name))}${S.selMode ? `<span class="selbox">${sel ? '<i class="ph-bold ph-check"></i>' : ''}</span>` : ''}</div>
    <div class="lbody"><div class="lname">${srcIconHTML(g, 'nsrc')}<span>${esc(g.name)}</span></div><div class="lmeta">${statusLine(g)}</div>${(() => { const x = [g.genre && String(g.genre).split(',')[0].trim(), g.year].filter(Boolean).join(' · '); return x ? `<div class="lmeta lmeta2">${esc(x)}</div>` : ''; })()}</div>
    ${running.has(g.id) ? '<span class="run-dot"></span>' : ''}
    ${isNewGame(g) ? '<span class="new-dot" title="Новая"></span>' : ''}
    ${g.completed ? '<i class="ph-fill ph-check-circle ldone" title="Пройдена"></i>' : ''}
    ${g.favorite ? '<i class="ph-fill ph-star lfav"></i>' : ''}
  </div>`;
}
function renderList() {
  const el = $('#list');
  const top = el.scrollTop;
  const items = currentList();
  const sel = selGame();
  if (!items.length) {
    el.innerHTML = `<div class="list-empty">${games.length ? 'Здесь пока пусто.' : 'Библиотека пуста — добавьте игры кнопками внизу.'}</div>`;
    return;
  }
  const groups = [];
  for (const g of items) {
    const label = bucketOf(g);
    let b = groups.find((x) => x.label === label);
    if (!b) groups.push(b = { label, items: [] });
    b.items.push(g);
  }
  el.innerHTML = groups.map((b) => `<div class="lgroup"><div class="lgroup-h"><span>${esc(b.label)}</span><span>${b.items.length}</span></div>
    ${b.items.map((g) => listRow(g, sel && g.id === sel.id)).join('')}</div>`).join('');
  el.scrollTop = top;
}
function renderSideFoot() {
  const vis = visible();
  const total = vis.reduce((a, g) => a + (g.playtime || 0), 0);
  if (S.selMode) {
    $('#sb-foot').innerHTML = `<div class="sel-bar"><b>Выбрано: ${S.selected.size}</b><span class="grow"></span>
      <button class="btn btn-ghost btn-icon" data-act="sel-all" title="Выбрать все" data-nav><i class="ph ph-checks"></i></button>
      <button class="btn btn-ghost btn-icon" data-act="sel-cat" title="Категория" data-nav><i class="ph ph-folder-simple"></i></button>
      <button class="btn btn-ghost btn-icon" data-act="sel-enrich" title="Авто-данные" data-nav><i class="ph ph-sparkle"></i></button>
      <button class="btn btn-ghost btn-icon" data-act="sel-hide" title="Скрыть / показать" data-nav><i class="ph ph-eye-slash"></i></button>
      <button class="btn btn-ghost btn-icon danger" data-act="sel-delete" title="Удалить" data-nav><i class="ph ph-trash"></i></button>
      <button class="btn btn-secondary" data-act="sel-exit" data-nav>Готово</button></div>`;
    return;
  }
  const tdy = typeof todayMinutes === 'function' ? todayMinutes() : 0;
  const allTxt = `${vis.length} ${plural(vis.length, 'игра', 'игры', 'игр')} · ${playLabel(total)} всего`;
  $('#sb-foot').innerHTML = `<span class="sb-total" ${tdy ? `data-act="open-stats-today" title="${esc(allTxt)} · нажмите — статистика за сегодня" style="cursor:pointer"` : ''}>${tdy ? `Сегодня <b>${esc(exactTime(tdy))}</b>` : esc(allTxt)}</span>
    <button class="btn btn-ghost btn-icon sb-ico" data-act="open-stats" title="Статистика" data-nav><i class="ph ph-chart-bar"></i></button>
    <button class="btn btn-ghost btn-icon sb-ico" data-act="scan-folder" title="Сканировать папку" data-nav><i class="ph ph-folder-open"></i></button>
    <button class="btn btn-ghost btn-icon sb-ico" data-act="add-game" title="Добавить игру" data-nav><i class="ph ph-plus"></i></button>
    <button class="btn btn-ghost btn-icon sb-ico${S.pop ? ' on' : ''}" data-act="toggle-pop" title="Настройки" data-nav><i class="ph ph-gear-six"></i></button>`;
}
// Быстрые настройки (как в макете) + вход в полные настройки
function popItems() {
  return [
    ['light', 'Светлая тема', 'Светлый фон во всём приложении', isLight()],
    ['rumble', 'Вибрация геймпада', 'Лёгкий отклик при навигации с геймпада', settings.rumble !== false],
    ['sound', 'Звуки интерфейса', 'Щелчки, запуск игры, смена режима', settings.sound !== false],
  ];
}
function renderPop() {
  $('#pop-host').innerHTML = S.pop ? `<div class="pop-back" data-act="close-pop"></div>
    <div class="pop elev-lg">
      <div class="pop-t">Настройки</div>
      ${popItems().map(([k, l, sub, on]) => `<div class="pop-item" data-act="pop-toggle" data-arg="${k}" data-nav>
        <span class="chk-box${on ? ' on' : ''}">${on ? '<i class="ph-bold ph-check"></i>' : ''}</span>
        <div><div class="pop-l">${esc(l)}</div><div class="pop-s">${esc(sub)}</div></div></div>`).join('')}
      <button class="btn btn-ghost pop-all" data-act="open-settings" data-nav><i class="ph ph-sliders-horizontal"></i>Все настройки…</button>
    </div>` : '';
}

// ─── Карточка выбранной игры ─────────────────────────────────────────────────
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
// Минуты по дням за последние 14 дней (последний элемент — сегодня)
function sessions14(g) {
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    let m = g.days?.[dayKey(d)] || 0;
    if (i === 0 && running.has(g.id)) m += Math.round((Date.now() - running.get(g.id)) / 60000);
    out.push(m);
  }
  return out;
}
function barsHTML(g, cls = 'bars') {
  const ses = sessions14(g), max = Math.max(60, ...ses);
  return `<div class="${cls}">${ses.map((v, i) => {
    const d = 13 - i;
    const title = (d === 0 ? 'Сегодня' : agoLabel(d)) + ': ' + (v ? exactTime(v) : 'не играли');
    return `<div class="bar-c${i === 13 && v ? ' today' : v ? ' has' : ''}" style="height:${Math.round(v / max * 100)}%" title="${esc(title)}"></div>`;
  }).join('')}</div>`;
}
function activityHTML(g) {
  const ses = sessions14(g), total = ses.reduce((a, b) => a + b, 0);
  const hasHist = !!(g.days && Object.keys(g.days).length) || running.has(g.id);
  let body;
  if (hasHist) body = `${barsHTML(g)}<div class="bars-axis"><span>2 недели назад</span><span>Сегодня</span></div>`;
  else if (isPlayed(g)) body = '<div class="act-note">График появится после следующей игры — время по дням считается с этой версии программы.</div>';
  else body = '<div class="act-note">Игра ещё не запускалась — здесь появится время сессий.</div>';
  return `<div class="act"><div class="act-h"><span>Активность</span>${hasHist ? `<span class="muted">${esc(exactTime(total))} за 2 недели</span>` : ''}</div>${body}</div>`;
}
function renderDetail() {
  const g = selGame();
  const main = $('#main');
  if (!g) {
    main.innerHTML = `<div class="d-empty"><i class="ph ph-game-controller"></i><h2>Библиотека пуста</h2>
      <p>Добавьте игру вручную или отсканируйте папку с играми — программа найдёт .exe и ярлыки.</p>
      <div class="btn-row"><button class="btn btn-primary" data-act="wizard" data-nav><i class="ph ph-magic-wand"></i>Найти мои игры</button>
      <button class="btn btn-secondary" data-act="scan-folder" data-nav><i class="ph ph-folder-open"></i>Сканировать папку</button>
      <button class="btn btn-secondary" data-act="scan-desktop" data-nav><i class="ph ph-desktop"></i>Рабочий стол</button>
      <button class="btn btn-secondary" data-act="add-game" data-nav><i class="ph ph-plus"></i>Добавить вручную</button></div></div>`;
    return;
  }
  const same = main.dataset.id === g.id;
  const top = same ? main.scrollTop : 0;
  const isRun = running.has(g.id);
  const rating = g.rating ? (Math.round(g.rating / 2) / 10).toFixed(1).replace('.', ',') + ' / 5' : null;
  const stats = [
    ['Время в игре', exactTime(g.playtime)],
    ['Последний запуск', isRun ? 'Сейчас' : lastLabel(g.lastPlayed)],
    ['Запусков', g.runs ? String(g.runs) : isPlayed(g) ? '—' : '0'],
    ...(rating ? [['Рейтинг', rating]] : []),
  ];
  const facts = [
    ['Источник', sourceOf(g)[0]],
    ['Разработчик', g.developer || '—'],
    ['Год выхода', g.year || '—'],
    ['Жанр', genresOf(g).join(', ') || '—'],
    ['Списки', gameLists(g).map((id) => catById(id).name).join(', ') || '—'],
    ['Добавлена', g.addedAt ? lastLabel(g.addedAt) : '—'],
  ];
  const path = g.exePath || g.lnkPath || '';
  main.dataset.id = g.id;
  main.innerHTML = `
    <div class="d-hero full${g.hero ? ' has-hero' : g.cover ? ' cover-only' : ''}">
      <div class="d-bg" style="${heroStyle(g)}"></div>
      ${g.hero || g.cover ? '' : `<div class="d-ini">${esc(initials(g.name))}</div>`}
      <div class="d-shade"></div>
      <div class="d-tools">
        <button class="btn btn-ghost btn-icon${g.favorite ? ' fav-on' : ''}" data-act="fav" data-id="${esc(g.id)}" title="${g.favorite ? 'Убрать из избранного' : 'В избранное'}" data-nav><i class="${g.favorite ? 'ph-fill' : 'ph'} ph-star"></i></button>
        <button class="btn btn-ghost btn-icon" data-act="folder" data-id="${esc(g.id)}" title="Открыть папку" data-nav><i class="ph ph-folder-open"></i></button>
        <button class="btn btn-ghost btn-icon" data-act="game-menu" data-id="${esc(g.id)}" title="Ещё" data-nav><i class="ph ph-dots-three"></i></button>
      </div>
      <div class="d-head">
        <div class="d-tags">${genresOf(g).map((t) => `<span class="tag tag-neutral">${esc(t)}</span>`).join('')}
          ${g.completed ? '<span class="tag tag-accent"><i class="ph-fill ph-check-circle"></i>Пройдена</span>' : ''}${g.hidden ? '<span class="tag tag-neutral">Скрыта</span>' : ''}</div>
        ${titleHTML(g, 'd-logo', 'h2')}
        <div class="d-by"><span class="d-store">${srcIconHTML(g, 'nsrc')}${esc(storeOf(g) ? STORES[storeOf(g)][0] : 'ПК')}</span>${[g.developer, g.year].filter(Boolean).length ? ' · ' + esc([g.developer, g.year].filter(Boolean).join(' · ')) : ''}</div>
        <div class="d-play">
          ${isRun ? `<button class="btn btn-secondary d-playbtn" data-act="play" data-id="${esc(g.id)}" data-nav><i class="ph ph-pulse"></i>Запущена</button>
            <div class="d-sess"><span class="run-dot"></span><span class="acc">Идёт сессия</span><span class="live-time" data-run="${esc(g.id)}">${runTime(g.id)}</span></div>`
          : `${g.cover ? `<img class="d-mini" src="${esc(g.cover)}" alt="" draggable="false">` : ''}<button class="btn btn-primary d-playbtn" data-act="play" data-id="${esc(g.id)}" data-nav><i class="ph-fill ph-play"></i>Играть</button>
            <span class="d-hint">${keyCap('a')}</span>`}
        </div>
      </div>
    </div>
    <div class="d-body">
      <div class="d-left">
        <div class="d-stats">${stats.map(([l, v]) => `<div><div class="stat-l">${esc(l)}</div><div class="stat-v">${esc(v)}</div></div>`).join('')}</div>
        ${settings.showActivity === false ? '' : activityHTML(g)}
        ${notesHTML(g)}
      </div>
      <div class="d-right">
        ${facts.map(([l, v]) => `<div class="fact"><span>${esc(l)}</span><span>${l === 'Источник' ? `<span class="fact-src">${srcIconHTML(g, 'lsrc')}${esc(v)}</span>` : esc(v)}</span></div>`).join('')}
        <div class="path-l">Файл игры${g.args ? ` <span class="muted">· параметры: ${esc(g.args)}</span>` : ""}</div>
        <div class="path-v">${esc(path || '—')}</div>
      </div>
      <div class="about d-about">
        <div class="about-t">Об игре</div>
        ${extraHTML(g)}
        ${myShotsHTML(g)}
        ${descSource(g) ? descHTML(g) : '<p>Описание ещё не загружено. Нажмите «Обновить обложку и описание» — программа найдёт обложку, описание и жанры.</p>'}
        ${(g.tags || []).length ? `<div class="user-tags">${g.tags.map((t) => `<span class="tag tag-outline" data-act="filter" data-arg="tag:${esc(t.toLowerCase())}" data-label="${esc(t)}">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="d-actions d-actions-row">
          <button class="btn btn-ghost" data-act="enrich" data-id="${esc(g.id)}" data-nav><i class="ph ph-arrows-clockwise"></i>Обновить обложку и описание</button>
          <button class="btn btn-ghost" data-act="cover" data-id="${esc(g.id)}" data-nav><i class="ph ph-image"></i>Обложка и фон</button>
          <button class="btn btn-ghost" data-act="edit" data-id="${esc(g.id)}" data-nav><i class="ph ph-pencil-simple"></i>Изменить</button>
          <button class="btn btn-ghost" data-act="done" data-id="${esc(g.id)}" data-nav><i class="ph ph-check-circle"></i>${g.completed ? 'Снять «Пройдена»' : 'Отметить пройденной'}</button>
          <button class="btn btn-ghost" data-act="hide" data-id="${esc(g.id)}" data-nav><i class="ph ${g.hidden ? 'ph-eye' : 'ph-eye-slash'}"></i>${g.hidden ? 'Вернуть в библиотеку' : 'Скрыть из библиотеки'}</button>
          <button class="btn btn-ghost" data-act="delete" data-id="${esc(g.id)}" data-nav><i class="ph ph-minus-circle"></i>Убрать из библиотеки</button>
          ${isMissing(g) ? '' : `<button class="btn btn-ghost danger" data-act="uninstall" data-id="${esc(g.id)}" data-nav><i class="ph ph-trash-simple"></i>Удалить с компьютера…</button>`}
        </div>
    </div>`;
  main.scrollTop = top;
  gxEdgesAll();
}

// Заметки к игре: поле не теряет фокус и набранный текст, даже если экран перерисовался (сессия закончилась и т.п.)
function notesSnap() { const a = document.activeElement; return a?.classList?.contains('notes-ta') ? { id: a.dataset.id, v: a.value, s: a.selectionStart, e: a.selectionEnd, sc: a.scrollTop } : null; }
function notesRestore(k) {
  if (!k) return; const t = document.querySelector(`.notes-ta[data-id="${CSS.escape(k.id)}"]`);
  if (!t || t === document.activeElement) return;
  t.value = k.v; t.focus({ preventScroll: true }); try { t.setSelectionRange(k.s, k.e); } catch {} t.scrollTop = k.sc;
}
const NOTES = { t: null, id: null };
function notesSave(id, v, now = false) {
  clearTimeout(NOTES.t); NOTES.id = id;
  const run = async () => { NOTES.id = null; const g = byId(id); if (!g) return; const val = String(v).slice(0, 5000); if ((g.notes || '') === val) return;
    g.notes = val; await saveGame(g);
    document.querySelectorAll(`.notes-st[data-for="${CSS.escape(id)}"]`).forEach((s) => { s.textContent = 'сохранено'; s.classList.add('on'); clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove('on'), 1600); }); };
  if (now) run(); else NOTES.t = setTimeout(run, 700);
}
function notesHTML(g) { return `<div class="notes"><div class="notes-h"><i class="ph ph-note-pencil"></i>Мои заметки<span class="notes-st" data-for="${esc(g.id)}"></span></div><textarea class="notes-ta" data-id="${esc(g.id)}" maxlength="5000" spellcheck="true" placeholder="Где остановился, что не забыть, коды, советы…" data-nav>${esc(g.notes || '')}</textarea></div>`; }
function render() {
  const nk = notesSnap();
  setTimeout(gxEdgesAll, 0);
  renderSideTop();
  renderList();
  renderSideFoot();
  renderPop();
  renderDetail();
  if (S.big.open) renderBig();
  if (S.pal.open) renderPal();
  tickRunning();
  gpRefocus();
  notesRestore(nk);
}
function select(id, { scroll = false } = {}) {
  if (!byId(id)) return;
  S.selId = id; settings.lastSel = id;
  clearTimeout(select.t); select.t = setTimeout(saveSettingsQuiet, 1500);
  renderList(); renderDetail();
  if (scroll) $(`#list .lrow[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  gpRefocus();
}
// ↑/↓ по списку слева (клавиатура и геймпад)
function moveSel(dir) {
  const list = currentList(); if (!list.length) return;
  const i = list.findIndex((g) => g.id === selGame()?.id);
  const j = Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i + dir)));
  if (j !== i) { sfx('move'); select(list[j].id, { scroll: true }); }
}

// ─── Действия с играми ───────────────────────────────────────────────────────
async function saveGame(g) { await api.saveGame(g); }
async function launch(id) {
  const g = byId(id); if (!g) return;
  if (running.has(id)) { sfx('back'); toast(`${g.name} уже запущена`); return; }
  sfx('launch');
  const res = await api.launchAndTrack(g.id, g.exePath, g.lnkPath || null, g.launchUrl || null, { args: g.args || '', workDir: g.workDir || '' });
  if (!res || !res.launched) { toast('Не удалось запустить: ' + (res?.error || 'неизвестная ошибка'), 'err'); return; }
  g.lastPlayed = Date.now(); g.launched = true; g.runs = (g.runs || 0) + 1;
  toast('▶ ' + g.name + (res.tracked ? ' — время игры учитывается' : ''), 'ok');
  render();
}
async function toggleFav(id) {
  const g = byId(id); if (!g) return;
  g.favorite = !g.favorite; sfx(g.favorite ? 'fav' : 'unfav');
  await saveGame(g); render();
}
async function toggleHidden(id) {
  const g = byId(id); if (!g) return;
  g.hidden = !g.hidden; await saveGame(g);
  toast(g.hidden ? `«${g.name}» скрыта — она в фильтре «Скрытые»` : `«${g.name}» снова в библиотеке`);
  render();
}
async function toggleCompleted(id) {
  const g = byId(id); if (!g) return;
  g.completed = !g.completed; sfx(g.completed ? 'success' : 'select');
  await saveGame(g); render();
}
async function deleteGames(ids) {
  const list = ids.map(byId).filter(Boolean);
  if (!list.length) return;
  const ok = await confirmDlg(list.length === 1 ? `Удалить «${list[0].name}» из библиотеки?` : `Удалить ${list.length} ${plural(list.length, 'игру', 'игры', 'игр')} из библиотеки?`,
    'Сами файлы игры на диске не удаляются.' + (list.some((g) => g.store && g.storeId) && settings.autoStores !== false ? ' Игры из лаунчеров не будут добавляться обратно автоматически.' : ''), 'Удалить');
  if (!ok) return;
  await api.deleteGames(list.map((g) => g.id));
  // Игры Steam/Epic, убранные вручную, не добавляем обратно автоматически
  const ign = list.filter((g) => g.store && g.storeId).map((g) => g.store + ':' + g.storeId);
  if (ign.length) { settings.storeIgnore = [...new Set([...(settings.storeIgnore || []), ...ign])]; saveSettingsQuiet(); }
  const set = new Set(list.map((g) => g.id));
  games = games.filter((g) => !set.has(g.id));
  S.selected.clear();
  if (set.has(S.selId)) S.selId = null;
  render();
  toast(list.length === 1 ? 'Игра удалена из библиотеки' : `Удалено: ${list.length}`);
}
function openFolder(id) { const g = byId(id); if (g) api.showInExplorer(g.exePath || g.lnkPath || ''); }
function randomGame() {
  const pool = visible();
  if (!pool.length) return toast('В библиотеке пока нет игр');
  const notPlayed = pool.filter((g) => !isPlayed(g));
  const src = notPlayed.length && Math.random() < 0.6 ? notPlayed : pool;
  const g = src[Math.floor(Math.random() * src.length)];
  if (S.big.open) { const i = bigList().findIndex((x) => x.id === g.id); if (i >= 0) { S.big.idx = i; renderBig(); } }
  else { if (!currentList().some((x) => x.id === g.id)) S.filter = 'all'; S.selId = g.id; render(); $(`#list .lrow[data-id="${CSS.escape(g.id)}"]`)?.scrollIntoView({ block: 'center' }); }
  sfx('success');
  toast('🎲 Попробуй: ' + g.name, 'ok');
}
// Быстро подтянуть обложку и описание без диалога (для компактного режима)
async function quickEnrich(id) {
  const g = byId(id); if (!g) return;
  toast(settings.sgdbKey ? 'Ищу обложку, фон и описание…' : 'Ищу… (без ключа SteamGridDB — только картинки RAWG)');
  const sid = storeOf(g) === 'steam' && g.storeId ? g.storeId : null;
  const r = await api.enrichGame(g.id, g.name, { downloadCover: true, downloadHero: true, downloadLogo: !!settings.sgdbKey || !!sid, steamAppId: sid });
  if (!r?.success) return toast('Ничего не нашлось — проверьте ключи API в настройках', 'err');
  const cur = byId(id); if (!cur) return;   // игру успели убрать из библиотеки
  applyEnrich(cur, r);
  await saveGame(cur); render();
  sfx('success'); toast('Обновлено: ' + artNote(r), 'ok');
}

// ─── Автоматический поиск игр в лаунчерах (Steam, Epic, GOG, Ubisoft, EA, Battle.net) ──────────────────────────────────
// Новые установленные игры из лаунчеров сами появляются в библиотеке (с обложками и описанием)
const AUTO = { busy: false, last: 0 };
async function autoStoreSync(manual = false) {
  if ((!manual && settings.autoStores === false) || AUTO.busy || !api.listStoreGames) return 0;
  if (!manual && (dlgOpen() && $('#dlg .wizard') || (!settings.onboarded && !games.length))) return 0;   // мастер первого запуска сам предложит эти игры
  if (!manual && Date.now() - AUTO.last < 60 * 1000) return 0;
  AUTO.busy = true; AUTO.last = Date.now();
  try {
    const stores = await api.listStoreGames().catch(() => []);
    const ignore = new Set(settings.storeIgnore || []);
    const have = new Set(games.map(gameKey).filter(Boolean));
    const nrm = (p) => String(p || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
    const dirs = games.flatMap((g) => [g.installDir, g.exePath].filter(Boolean).map(nrm));
    const names = new Set(games.map((g) => normTitle(g.name)).filter(Boolean));
    const fresh = stores.filter((x) => {
      const k = x.store + ':' + x.storeId;
      if (x.installed === false || have.has(k) || ignore.has(k)) return false;
      const d0 = nrm(x.installDir);
      if (d0 && dirs.some((p) => p === d0 || p.startsWith(d0 + '\\'))) return false;   // эта игра уже есть как «ПК» — её привяжет linkStores
      const nt = normTitle(x.name);
      return !nt || !names.has(nt);
    });
    if (!fresh.length) { if (manual) toast('Новых игр в лаунчерах не найдено'); return 0; }
    const add = fresh.map((x) => ({
      id: uid(), name: x.name, exePath: x.exePath, lnkPath: null, isLnk: false,
      store: x.store, storeId: x.storeId, launchUrl: x.launchUrl || null, installDir: x.installDir, workDir: x.workDir || null, args: x.args || null,
      addedAt: Date.now(), cover: null, description: '', genre: '', year: '', developer: '', playtime: 0, autoAdded: true,
    }));
    await api.saveGamesBulk(add);
    games.push(...add);
    render();
    const by = (st) => add.filter((g) => g.store === st).length;
    const parts = Object.keys(STORES).filter(by).map((st) => `${STORES[st][0]}: ${by(st)}`).join(', ');
    sfx('success');
    toast(add.length === 1 ? `Новая игра из ${STORES[add[0].store][0]}: «${add[0].name}»` : `Добавлены новые игры (${parts})`, 'ok');
    if (settings.steamTime !== false && add.some((g) => g.store === 'steam')) syncSteamTime().catch(() => {});
    if (settings.scanEnrich !== false) enrichQuiet(add.map((g) => g.id));
    return add.length;
  } finally { AUTO.busy = false; }
}
function normTitle(n) { return String(n || '').toLowerCase().replace(/[™®©]/g, '').replace(/[^a-zа-яё0-9]+/gi, ''); }
// Обложки, фон и описание — тихо, по одной игре, без окон
async function enrichQuiet(ids) {
  for (const id of ids) {
    const g = byId(id); if (!g || g.cover) continue;
    const sid = storeOf(g) === 'steam' && g.storeId ? g.storeId : null;
    const r = await api.enrichGame(g.id, g.name, { downloadCover: true, downloadHero: true, downloadLogo: !!settings.sgdbKey || !!sid, steamAppId: sid }).catch(() => null);
    const cur = byId(id); if (!r?.success || !cur) continue;
    applyEnrich(cur, r); await saveGame(cur); render();
  }
}

// Игры, добавленные ярлыком или .exe, но установленные через Steam/Epic, — помечаем магазином
// Ярлык ведёт на игру Steam / Epic → делаем из него игру магазина: значок, запуск через лаунчер,
// путь к настоящему .exe (для учёта времени); сам ярлык больше не нужен
async function applyStoreLinks(list) {
  const todo = list.filter((g) => !g.store || !g.storeId);
  if (!todo.length || !api.linkStores) return [];
  const res = await api.linkStores(todo.map((g) => ({ id: g.id, name: g.name, exePath: g.exePath, lnkPath: g.lnkPath }))).catch(() => ({}));
  const changed = [];
  for (const g of todo) {
    const h = res?.[g.id]; if (!h) continue;
    g.store = h.store; g.storeId = h.storeId;
    if (h.installDir) g.installDir = h.installDir;
    g.launchUrl = h.launchUrl || (h.store === 'steam' ? `steam://rungameid/${h.storeId}` : g.launchUrl);
    if (h.exePath && /\.exe$/i.test(h.exePath)) { g.exePath = h.exePath; g.lnkPath = null; g.isLnk = false; }
    changed.push(g);
  }
  return changed;
}
// Ярлык → сам .exe (+ параметры и рабочая папка ярлыка). Ярлык после этого не нужен.
async function detachShortcut(g) {
  const lnk = g.lnkPath || (/\.lnk$/i.test(g.exePath || '') ? g.exePath : null);
  if (!lnk) return true;
  const info = await api.shortcutInfo?.(lnk).catch(() => null);
  if (info?.target && /\.exe$/i.test(info.target)) {
    g.exePath = info.target; if (info.args && !g.args) g.args = info.args; if (info.cwd) g.workDir = info.cwd;
    g.lnkPath = null; g.isLnk = false; return true;
  }
  // Ярлыка уже нет, но файл игры известен — просто забываем ярлык
  if (g.exePath && /\.exe$/i.test(g.exePath)) { g.lnkPath = null; g.isLnk = false; return true; }
  return false;
}
async function detachShortcuts(list) {
  const changed = [];
  for (const g of list) { if ((g.lnkPath || /\.lnk$/i.test(g.exePath || '')) && !g.store) { if (await detachShortcut(g)) changed.push(g); } }
  return changed;
}
// Одна и та же игра дважды (например, по ярлыку и по .exe) — склеиваем в одну
function gameKey(g) {
  if (g.store && g.storeId) return g.store + ':' + g.storeId;
  const e = String(g.exePath || '').toLowerCase().replace(/\//g, '\\');
  return /\.exe$/.test(e) ? 'exe:' + e : null;
}
function mergeInto(a, b) {
  const has = (x) => x && String(x).length;
  for (const k of ['cover', 'hero', 'logo', 'description', 'genre', 'year', 'developer', 'rating', 'coverSrc', 'heroSrc', 'args', 'workDir']) if (!has(a[k]) && has(b[k])) a[k] = b[k];
  a.lists = [...new Set([...gameLists(a), ...gameLists(b)])]; a.catId = null;
  a.playtime = Math.max(a.playtime || 0, b.playtime || 0);
  a.lastPlayed = Math.max(a.lastPlayed || 0, b.lastPlayed || 0) || null;
  a.runs = Math.max(a.runs || 0, b.runs || 0);
  a.addedAt = Math.min(a.addedAt || Date.now(), b.addedAt || Date.now());
  a.favorite = !!(a.favorite || b.favorite); a.completed = !!(a.completed || b.completed); a.launched = !!(a.launched || b.launched);
  a.tags = [...new Set([...(a.tags || []), ...(b.tags || [])])];
  if (b.days) { a.days = { ...(a.days || {}) }; for (const [d, m] of Object.entries(b.days)) a.days[d] = Math.max(a.days[d] || 0, m); }
  if (b.sess) a.sess = [...(a.sess || []), ...b.sess].sort((x, y) => x[0] - y[0]).slice(-300);
}
async function dedupeGames() {
  const score = (g) => (g.cover ? 4 : 0) + (g.description ? 2 : 0) + (g.playtime ? 1 : 0) + (g.lnkPath ? 0 : 1);
  const groups = new Map();
  for (const g of games) { const k = gameKey(g); if (!k) continue; (groups.get(k) || groups.set(k, []).get(k)).push(g); }
  const drop = [], keep = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((x, y) => score(y) - score(x));
    const [main, ...rest] = list;
    rest.forEach((r) => { mergeInto(main, r); drop.push(r.id); if (S.selId === r.id) S.selId = main.id; });
    keep.push(main);
  }
  if (!drop.length) return 0;
  await api.saveGamesBulk(keep);
  await api.deleteGames(drop);
  const set = new Set(drop); games = games.filter((g) => !set.has(g.id));
  return drop.length;
}
// Чиним «кракозябры» в путях старых записей
async function repairPaths() {
  if (!api.repairPaths) return [];
  const fixed = await api.repairPaths(games.map((g) => g.exePath || '')).catch(() => []);
  const changed = [];
  games.forEach((g, i) => { if (fixed?.[i]) { g.exePath = fixed[i]; changed.push(g); } });
  return changed;
}
async function linkStores() {
  const changed = await applyStoreLinks(games);
  const det = await detachShortcuts(games);   // старые игры, добавленные ярлыком → по файлу игры
  const rep = await repairPaths();
  const all = [...new Set([...changed, ...det, ...rep])];
  if (all.length) await api.saveGamesBulk(all);
  const merged = await dedupeGames();
  if (merged) toast(`Найдены и объединены дубликаты игр: ${merged}`, 'ok');
  if (all.length || merged) render();
  await syncSteamTime();
}
// Время из Steam: берём большее из своего учёта и того, что насчитал Steam
async function syncSteamTime(manual = false) {
  if (settings.steamTime === false && !manual) return 0;
  const t = { ...((await api.steamPlaytime?.().catch(() => null)) || {}) };
  if (!Object.keys(t).length) { if (manual) toast('Steam не найден на этом компьютере'); return 0; }
  const changed = [];
  for (const g of games) {
    if (storeOf(g) !== 'steam' || !g.storeId || !t[g.storeId]) continue;
    const { minutes, lastPlayed } = t[g.storeId];
    let ch = false;
    if (minutes > (g.playtime || 0)) {
      // Steam насчитал больше, чем программа видела (играли не отсюда) — разницу пишем в день последнего запуска,
      // чтобы она попала в график и статистику. При первом импорте (старые годы игры) — не пишем.
      const delta = minutes - (g.playtime || 0);
      if (g.steamMinutes != null && delta > 0 && delta <= 20 * 60 && !running.has(g.id)) {
        const k = dayKey(new Date(lastPlayed || Date.now()));
        g.days = { ...(g.days || {}) }; g.days[k] = (g.days[k] || 0) + delta;
      }
      g.playtime = minutes; ch = true;
    }
    if (minutes && g.steamMinutes !== minutes) { g.steamMinutes = minutes; ch = true; }
    if (lastPlayed > (g.lastPlayed || 0)) { g.lastPlayed = lastPlayed; ch = true; }
    if ((minutes || lastPlayed) && !g.launched) { g.launched = true; ch = true; }
    if (ch) changed.push(g);
  }
  if (changed.length) { await api.saveGamesBulk(changed); render(); }
  if (manual) toast(changed.length ? `Время из Steam обновлено у ${changed.length} ${plural(changed.length, 'игры', 'игр', 'игр')}` : 'Время из Steam уже актуально', 'ok');
  return changed.length;
}
