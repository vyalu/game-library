'use strict';
// ─── Статистика: сколько, во что и когда вы играете ──────────────────────────
// Данные: минуты по дням (g.days), журнал сессий (g.sess = [[начало, минуты]…]) и общее время (g.playtime,
// в том числе перенесённое из Steam). За «всё время» берём общее время, за периоды — дни.
const ST = { per: 'month' };
const ST_PERIODS = [['week', 'Неделя', 7], ['month', 'Месяц', 30], ['year', 'Год', 365], ['all', 'Всё время', 0]];
const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WDAY = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const WD2 = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function dayStart(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
// Минуты по дням по всем играм (с учётом идущей сейчас сессии)
function allDays() {
  const m = new Map(), today = dayKey(new Date());
  for (const g of games) {
    for (const [k, v] of Object.entries(g.days || {})) m.set(k, (m.get(k) || 0) + v);
    if (running.has(g.id)) m.set(today, (m.get(today) || 0) + Math.round((Date.now() - running.get(g.id)) / 60000));
  }
  return m;
}
function statsData(per) {
  const len = ST_PERIODS.find((p) => p[0] === per)[2];
  const fromKey = len ? dayKey(dayStart(len - 1)) : '';
  const fromTs = len ? dayStart(len - 1).getTime() : 0;
  const today = dayKey(new Date());
  const live = (g) => (running.has(g.id) ? Math.round((Date.now() - running.get(g.id)) / 60000) : 0);
  // Минуты по играм за период
  const byGame = [];
  for (const g of games) {
    let m = 0;
    if (!len) m = (g.playtime || 0) + live(g);
    else { for (const [k, v] of Object.entries(g.days || {})) if (k >= fromKey) m += v; m += live(g); }
    if (m > 0) byGame.push([g, m]);
  }
  byGame.sort((a, b) => b[1] - a[1]);
  const total = byGame.reduce((a, x) => a + x[1], 0);
  const days = allDays();
  const activeKeys = [...days.keys()].filter((k) => days.get(k) > 0 && k >= fromKey);
  // Ряд для графика: по дням (неделя, месяц) или по месяцам (год, всё время)
  let series = [];
  if (len && len <= 31) {
    for (let i = len - 1; i >= 0; i--) { const d = dayStart(i), k = dayKey(d); series.push({ v: days.get(k) || 0, l: len === 7 ? WD2[d.getDay()] : (i % 5 === 0 || i === len - 1 ? String(d.getDate()) : ''), t: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), today: k === today }); }
  } else {
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1), pre = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-`;
      let v = 0; for (const [k, m] of days) if (k.startsWith(pre)) v += m;
      series.push({ v, l: MON[d.getMonth()], t: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }), today: i === 0 });
    }
  }
  // Сессии за период
  const sess = [];
  for (const g of games) for (const [s, m] of g.sess || []) if (s >= fromTs && m > 0) sess.push({ g, s, m });
  sess.sort((a, b) => b.m - a.m);
  // Жанры
  const gen = new Map();
  for (const [g, m] of byGame) { const k = genresOf(g)[0] || 'Без жанра'; gen.set(k, (gen.get(k) || 0) + m); }
  const genres = [...gen].sort((a, b) => b[1] - a[1]);
  // Любимый день недели и время суток
  const wd = Array(7).fill(0); for (const k of activeKeys) { const [y, mo, d] = k.split('-').map(Number); wd[new Date(y, mo - 1, d).getDay()] += days.get(k); }
  const favWd = wd.some(Boolean) ? wd.indexOf(Math.max(...wd)) : -1;
  const tod = [0, 0, 0, 0]; for (const x of sess) { const h = new Date(x.s).getHours(); tod[h < 6 ? 3 : h < 12 ? 0 : h < 18 ? 1 : 2] += x.m; }
  const favTod = tod.some(Boolean) ? tod.indexOf(Math.max(...tod)) : -1;
  // Серии дней подряд
  let cur = 0; for (let i = days.get(today) ? 0 : 1; days.get(dayKey(dayStart(i))) > 0; i++) cur++;
  let best = 0, run = 0, prev = null;
  for (const k of [...days.keys()].filter((k) => days.get(k) > 0).sort()) {
    const [y, mo, d] = k.split('-').map(Number), t = new Date(y, mo - 1, d).getTime();
    run = prev !== null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; prev = t; best = Math.max(best, run);
  }
  return { len, total, byGame, activeDays: activeKeys.length, series, sess, genres, favWd, favTod, cur, best, days };
}
const GEN_COLORS = ['var(--color-accent)', '#4f8fe0', '#d8913a', '#b45cc9', '#3fb8a9', '#d2554f', '#8a8f98'];
function statsBody(per) {
  const D = statsData(per);
  const perName = { week: 'за неделю', month: 'за 30 дней', year: 'за год', all: 'за всё время' }[per];
  if (!D.total) return `<div class="st-empty"><i class="ph ph-chart-bar"></i><b>Пока нечего показать ${esc(perName)}</b>
    <span>Запустите игру через программу — время будет считаться само, и здесь появятся графики.</span></div>`;
  const kpi = (ic, v, l, sub = '') => `<div class="st-kpi"><i class="ph ${ic}"></i><div><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const avg = D.sess.length ? Math.round(D.sess.reduce((a, x) => a + x.m, 0) / D.sess.length) : 0;
  const max = Math.max(1, ...D.series.map((x) => x.v));
  const top = D.byGame.slice(0, 8), topMax = top[0][1];
  const genTotal = D.genres.reduce((a, x) => a + x[1], 0);
  const gens = D.genres.slice(0, 6); if (D.genres.length > 6) gens.push(['Другие', D.genres.slice(6).reduce((a, x) => a + x[1], 0)]);
  const facts = [];
  if (D.favWd >= 0) facts.push(['ph-calendar-star', 'Чаще всего играете', 'в ' + WDAY[D.favWd]]);
  if (D.favTod >= 0) facts.push(['ph-clock-afternoon', 'Любимое время', ['утром', 'днём', 'вечером', 'ночью'][D.favTod]]);
  if (D.sess[0]) facts.push(['ph-hourglass-high', 'Самая долгая сессия', `${exactTime(D.sess[0].m)} · ${D.sess[0].g.name}`]);
  if (D.best > 1) facts.push(['ph-fire', 'Рекорд дней подряд', `${D.best} ${plural(D.best, 'день', 'дня', 'дней')}`]);
  // Календарь за год: 53 недели, начиная с понедельника
  const start = dayStart(7 * 52 + ((new Date().getDay() + 6) % 7));
  const cells = []; let hmMax = 1;
  for (let i = 0; i < 53 * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const v = D.days.get(dayKey(d)) || 0; if (d <= new Date()) hmMax = Math.max(hmMax, v); cells.push([d, v]); }
  const lvl = (v) => (!v ? 0 : v < hmMax * 0.25 ? 1 : v < hmMax * 0.5 ? 2 : v < hmMax * 0.75 ? 3 : 4);
  const monthLabels = []; for (let w = 0; w < 53; w++) { const d = cells[w * 7][0]; if (d.getDate() <= 7) monthLabels.push(`<span style="grid-column:${w + 1}">${MON[d.getMonth()]}</span>`); }
  return `
    <div class="st-kpis">
      ${kpi('ph-timer', esc(exactTime(D.total)), 'наиграно ' + esc(perName))}
      ${D.len ? kpi('ph-calendar-check', `${D.activeDays} <em>из ${D.len}</em>`, plural(D.activeDays, 'день с игрой', 'дня с игрой', 'дней с игрой')) : kpi('ph-calendar-check', String(D.days.size), 'дней с игрой', 'с начала записи')}
      ${kpi('ph-game-controller', String(D.byGame.length), plural(D.byGame.length, 'игра', 'игры', 'игр'), D.len ? 'запускали' : 'с наигранным временем')}
      ${D.sess.length ? kpi('ph-hourglass-medium', esc(exactTime(avg)), 'средняя сессия', `${D.sess.length} ${plural(D.sess.length, 'сессия', 'сессии', 'сессий')}`) : kpi('ph-fire', `${D.cur}`, plural(D.cur, 'день подряд', 'дня подряд', 'дней подряд'), 'текущая серия')}
    </div>
    <section class="st-card st-chart-card">
      <h3>${D.len && D.len <= 31 ? 'По дням' : 'По месяцам'}<span>${esc(D.len && D.len <= 31 ? perName : 'последние 12 месяцев')}</span></h3>
      <div class="st-chart">${D.series.map((x) => `<div class="st-col${x.today ? ' now' : ''}" title="${esc(x.t)}: ${esc(x.v ? exactTime(x.v) : 'не играли')}">
        <div class="st-bar" style="height:${x.v ? Math.max(3, Math.round(x.v / max * 100)) : 0}%">${x.v === max && max > 1 ? `<em>${esc(playLabel(x.v))}</em>` : ''}</div><span>${esc(x.l)}</span></div>`).join('')}</div>
    </section>
    <div class="st-grid">
      <section class="st-card"><h3>Во что играли<span>${esc(perName)}</span></h3>
        <div class="st-top">${top.map(([g, m], i) => `<button class="st-game" data-act="st-game" data-id="${esc(g.id)}" data-nav>
          <span class="st-n">${i + 1}</span><span class="st-ico" style="${coverBg(g)}">${g.cover ? '' : esc(initials(g.name))}</span>
          <span class="st-gb"><b>${esc(g.name)}</b><span class="st-track"><span style="width:${Math.max(2, Math.round(m / topMax * 100))}%"></span></span></span>
          <span class="st-gv"><b>${esc(playLabel(m))}</b><small>${Math.round(m / D.total * 100)}%</small></span></button>`).join('')}</div></section>
      <div class="st-col2">
        <section class="st-card"><h3>Жанры</h3>
          <div class="st-gbar">${gens.map(([k, m], i) => `<span style="flex:${m};background:${GEN_COLORS[i % GEN_COLORS.length]}" title="${esc(k)}: ${esc(exactTime(m))}"></span>`).join('')}</div>
          <div class="st-legend">${gens.map(([k, m], i) => `<span><i style="background:${GEN_COLORS[i % GEN_COLORS.length]}"></i>${esc(k)}<b>${Math.round(m / genTotal * 100)}%</b></span>`).join('')}</div></section>
        ${facts.length ? `<section class="st-card st-facts">${facts.map(([ic, l, v]) => `<div><i class="ph ${ic}"></i><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</section>` : ''}
      </div>
    </div>
    <section class="st-card"><h3>Календарь за год<span>${D.cur ? `серия: ${D.cur} ${plural(D.cur, 'день', 'дня', 'дней')} подряд` : ''}</span></h3>
      <div class="st-hm-wrap"><div class="st-hm-days"><span>Пн</span><span></span><span>Ср</span><span></span><span>Пт</span><span></span><span></span></div>
        <div><div class="st-hm-m">${monthLabels.join('')}</div>
        <div class="st-hm">${cells.map(([d, v]) => d > new Date() ? '<i class="fut"></i>' : `<i class="l${lvl(v)}" title="${esc(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))}: ${esc(v ? exactTime(v) : 'не играли')}"></i>`).join('')}</div></div></div>
      <div class="st-hm-key">меньше <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> больше</div></section>
    ${D.sess.length > 1 ? `<section class="st-card"><h3>Самые долгие сессии<span>${esc(perName)}</span></h3>
      <div class="st-sess">${D.sess.slice(0, 5).map((x) => `<div><span class="st-ico" style="${coverBg(x.g)}">${x.g.cover ? '' : esc(initials(x.g.name))}</span><b>${esc(x.g.name)}</b>
        <span>${esc(new Date(x.s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))}, ${esc(new Date(x.s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</span><em>${esc(exactTime(x.m))}</em></div>`).join('')}</div></section>` : ''}`;
}
function statsDlg() {
  const d = openDlg(`<div class="st-dlg">${head('Статистика', 'Сколько, во что и когда вы играете')}
    <div class="st-pers">${ST_PERIODS.map(([k, l]) => `<button class="st-per${ST.per === k ? ' on' : ''}" data-st-per="${k}" data-nav>${l}</button>`).join('')}${INPUT.mode !== 'kbd' ? `<span class="st-pk">${keyCap('lb')}${keyCap('rb')}</span>` : ''}</div>
    <div class="st-body">${statsBody(ST.per)}</div></div>`, { cls: 'wide st' });
  d.querySelector('.st-pers').addEventListener('click', (e) => { const b = e.target.closest('[data-st-per]'); if (b) statsPer(b.dataset.stPer); });
}
function statsPer(p) {
  const d = $('#dlg .st-dlg'); if (!d) return;
  if (typeof p === 'number') { const i = ST_PERIODS.findIndex((x) => x[0] === ST.per); p = ST_PERIODS[Math.max(0, Math.min(ST_PERIODS.length - 1, i + p))][0]; }
  if (p === ST.per && d.querySelector('.st-body').children.length) return;
  ST.per = p; sfx('tab');
  d.querySelectorAll('[data-st-per]').forEach((b) => b.classList.toggle('on', b.dataset.stPer === p));
  const body = d.querySelector('.st-body'); body.innerHTML = statsBody(p); body.scrollTop = 0;
  gpRefocus();
}
