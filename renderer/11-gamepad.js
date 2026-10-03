'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Геймпад (Xbox / PlayStation): навигация по интерфейсу и полноэкранный режим
// ═══════════════════════════════════════════════════════════════════════════
const GP = { connected: false, index: null, focus: null, prev: [], next: 0, repeat: false, active: false };

function gpInit() {
  addEventListener('gamepadconnected', (e) => {
    GP.connected = true; GP.index = e.gamepad.index;
    INPUT.pad = e.gamepad.id; const st = padStyle(e.gamepad); INPUT.padName = padName(e.gamepad);
    setInputMode(st);
    startPadInfo();
    if (!nativeKnows(e.gamepad)) padToast(e.gamepad, 'on');
    gpShowHints(); if (S.big.open) renderBig();
    gpLoopStart();
  });
  addEventListener('gamepaddisconnected', (e) => {
    const name = padName(e.gamepad);
    const rest = [...(navigator.getGamepads?.() || [])].find(Boolean);
    const quiet = !!NATIVE.list;   // об отключении сообщит Windows
    if (rest) { GP.index = rest.index; INPUT.padName = padName(rest); refreshPadLabels(); if (!quiet) padToast(e.gamepad, 'off', name); return; }
    GP.connected = false; GP.active = false; gpClear(); setInputMode('kbd'); gpShowHints(); refreshPadLabels();
    if (S.big.open) renderBig();
    if (!quiet) padToast(e.gamepad, 'off', name);
  });
  const scanPads = () => {
    const p = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (p) { GP.connected = true; GP.index = p.index; padStyle(p); INPUT.padName = padName(p); gpShowHints(); startPadInfo(); refreshPadLabels(); gpLoopStart(); }
    else setTimeout(scanPads, 2000);
  };
  scanPads();
}
function gpShowHints() {
  const on = GP.connected && !S.big.open && INPUT.mode !== 'kbd';
  $('#gp-hints').hidden = !on;
  document.body.classList.toggle('gp-on', on);
}
function gpLoopStart() { if (GP.loop) return; GP.loop = true; requestAnimationFrame(gpLoop); }
function gpLoop(ts) {
  if (!GP.connected) { GP.loop = false; return; }
  const pads = navigator.getGamepads?.() || [];
  const p = pads[GP.index] || [...pads].find(Boolean);
  if (p) gpHandle(p, ts);
  requestAnimationFrame(gpLoop);
}
function pressed(p, i) {
  const b = p.buttons[i];
  const now = !!b && (b.pressed || b.value > 0.5);
  const was = GP.prev[i]; GP.prev[i] = now;
  return now && !was;
}
function gpHandle(p, ts) {
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0, DEAD = 0.55;
  if (INPUT.mode === 'kbd' || INPUT.pad !== p.id) {
    const used = p.buttons.some((b) => b && (b.pressed || b.value > 0.5)) || p.axes.some((a) => Math.abs(a) > DEAD);
    if (used) { INPUT.pad = p.id; INPUT.padName = padName(p); mouseAcc = 0; setInputMode(padStyle(p)); }
  }
  const btn = (i) => p.buttons[i]?.pressed;
  let dir = null;
  if (btn(12) || ay < -DEAD) dir = 'up'; else if (btn(13) || ay > DEAD) dir = 'down';
  else if (btn(14) || ax < -DEAD) dir = 'left'; else if (btn(15) || ax > DEAD) dir = 'right';
  if (dir) {
    if (ts > GP.next) { gpDir(dir); GP.next = ts + (GP.repeat ? 110 : 380); GP.repeat = true; }
  } else { GP.repeat = false; GP.next = 0; }
  // Правый стик — прокрутка (описание игры, список, диалог)
  const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
  if (Math.abs(ry) > 0.2 || Math.abs(rx) > 0.2) {
    const el = scrollTarget();
    if (el) { const k = (v) => Math.sign(v) * Math.pow(Math.max(0, Math.abs(v) - 0.2) / 0.8, 1.6) * 28; el.scrollBy(k(rx), k(ry)); }
  }
  if (pressed(p, 0)) gpA();
  if (pressed(p, 1)) gpB();
  if (pressed(p, 2)) gpX();
  if (pressed(p, 3)) gpY();
  if (pressed(p, 4)) gpBumper(-1);
  if (pressed(p, 5)) gpBumper(1);
  if (S.lb) { if (pressed(p, 8) || pressed(p, 9) || pressed(p, 16)) lbClose(); return; }   // в просмотре скриншотов прочие кнопки только закрывают его
  // Кнопки как в Steam: Xbox/PS (Guide) — меню Big Picture или вход в него; ≡ — опции игры; ⧉ — меню (если Guide не доходит)
  // Кнопка Xbox / PS. Некоторые драйверы присылают её вместе с ⧉ / ≡ — такие нажатия не считаем
  const now16 = pressed(p, 16);
  if (p.buttons[8]?.pressed || p.buttons[9]?.pressed) GP.selStartT = ts;
  if (now16 && !p.buttons[8]?.pressed && !p.buttons[9]?.pressed && ts - (GP.selStartT || -1e9) > 600) {
    if (S.pal.open) closePal(); if (dlgOpen()) closeDlg(); if (S.big.bp) bpMenuToggle(); else openBig({ bp: true });
  }
  // ⧉ + ≡ вместе — сменить режим «Обычный ↔ Компактный» (одной кнопкой случайно не переключить)
  const held = (i) => !!(p.buttons[i]?.pressed);
  const st = pressed(p, 9), vw = pressed(p, 8);
  if ((st && held(8)) || (vw && held(9))) {
    if (S.pal.open) closePal();
    if (!dlgOpen() && !S.big.bp) { S.big.open ? closeBig() : openBig(); toast(S.big.open ? 'Компактный режим' : 'Обычный режим'); }
    return;
  }
  // ≡ (Start) — меню игры с подробностями, как в Steam
  if (st && !dlgOpen()) {
    if (S.pal.open) { if (S.pal.osk?.zone === 'kb') { if (palResults().length) oskType('go'); } else if (S.pal.osk?.zone === 'res') palRun(false); else closePal(); }
    else if (S.big.bp) { if (S.big.menu) bpMenuToggle(false); else bigInfo(); }
    else if (S.big.open) bigOptions();
    else { const g = selGame(); const btn = $('#main [data-act="game-menu"]'); if (g && btn) { menuAt(btn, gameMenuItems(g)); GP.active = true; setTimeout(gpRefocus, 20); } }
  }
  if (vw && !dlgOpen()) { if (S.pal.open) closePal(); else if (S.big.bp) bpMenuToggle(); else openPal(); }
}
// Где сейчас «живёт» фокус: меню, диалог, быстрые настройки или главный экран
// Что прокручивать правым стиком в текущем состоянии
function scrollTarget() {
  const scrollable = (el) => el && el.scrollHeight > el.clientHeight + 4;
  if (S.pal.open) return $('#pal-res');
  if ($('#menu')) return $('#menu');
  if (dlgOpen()) {
    const d = $('#dlg .dialog');
    const inner = [...d.querySelectorAll('.en-right, .en-list, .add-list, .dlg-body, .b-list, .scan-list')].find(scrollable);
    return inner || d;
  }
  if (S.big.open) {
    if (S.big.sheet) return $('#big .sheet');
    return $('#bpage') || $('#bgrid');
  }
  // В обычном режиме — карточка игры справа (описание), если фокус не в списке — тоже она
  return scrollable($('#main')) ? $('#main') : $('#list');
}
function gpLayer() {
  if ($('#menu')) return $('#menu');
  if (dlgOpen()) return $('#dlg .dialog');
  if (S.big.open) return null;
  if (S.pop) return $('#pop-host');
  return document;
}
function bigMode() { return S.big.open && !dlgOpen() && !$('#menu'); }
function gpFocusables() {
  const layer = gpLayer(); if (!layer) return [];
  const sel = layer === document ? '#tb [data-nav], #sb [data-nav], #main [data-nav]' : '[data-nav], button, input, select, textarea, .scan-item, .cov-opt';
  return [...layer.querySelectorAll(sel)].filter((el) => el.offsetParent !== null && !el.disabled);
}
function gpSet(el) {
  gpClear(); GP.focus = el; el.classList.add('gp-focus');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // Перешли на игру в списке — сразу показываем её справа
  if (el.classList.contains('lrow') && el.dataset.id !== S.selId && !S.selMode) select(el.dataset.id);
}
function gpClear() { document.querySelectorAll('.gp-focus').forEach((x) => x.classList.remove('gp-focus')); }
function gpRefocus() {
  gpShowHints();
  if (!GP.active || bigMode() || S.pal.open) return;
  const els = gpFocusables();
  if (GP.focus && els.includes(GP.focus)) { GP.focus.classList.add('gp-focus'); return; }
  const same = GP.focus && GP.focus.dataset.act && els.find((x) => x.dataset.id === GP.focus.dataset.id && x.dataset.act === GP.focus.dataset.act && x.dataset.arg === GP.focus.dataset.arg);
  if (same) { gpClear(); GP.focus = same; same.classList.add('gp-focus'); return; }
  const first = els.find((x) => x.classList.contains('lrow') && x.classList.contains('on')) || els.find((x) => x.classList.contains('lrow')) || els[0];
  if (first) gpSet(first); else { GP.focus = null; gpClear(); }
}
function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function gpDir(dir) {
  if (S.lb) { if (dir === 'left' || dir === 'right') lbStep(dir === 'left' ? -1 : 1); return; }
  if (S.pal.open) { if (S.pal.osk) return oskDir(dir); if (dir === 'up') palMove(-1); if (dir === 'down') palMove(1); return; }
  if (bigMode()) return bigDir(dir);
  const was = GP.active; GP.active = true;
  const els = gpFocusables(); if (!els.length) return;
  if (!was || !GP.focus || !els.includes(GP.focus)) return gpRefocus();
  const c = center(GP.focus);
  let best = null, score = Infinity;
  for (const el of els) {
    if (el === GP.focus) continue;
    const p = center(el), dx = p.x - c.x, dy = p.y - c.y;
    let main, cross;
    if (dir === 'left') { if (dx > -8) continue; main = -dx; cross = Math.abs(dy); }
    else if (dir === 'right') { if (dx < 8) continue; main = dx; cross = Math.abs(dy); }
    else if (dir === 'up') { if (dy > -8) continue; main = -dy; cross = Math.abs(dx); }
    else { if (dy < 8) continue; main = dy; cross = Math.abs(dx); }
    const sc = main + cross * 2.2;
    if (sc < score) { score = sc; best = el; }
  }
  if (best) { sfx('move'); gpSet(best); }
}
function gpA() {
  if (S.lb) return lbToggle();
  if (S.pal.open) {
    if (S.pal.osk && S.pal.osk.zone === 'kb') { const [k] = oskRows()[S.pal.osk.r][S.pal.osk.c]; return oskType(k); }
    return palRun(false);
  }
  if (bigMode()) return bigA();
  if (!GP.active) { GP.active = true; return gpRefocus(); }
  const el = GP.focus; if (!el || !document.contains(el)) return gpRefocus();
  if (el.matches('input:not([type=radio]), textarea, select')) return el.focus();
  if (el.classList.contains('lrow') && !S.selMode) return launch(el.dataset.id);
  el.click();
  setTimeout(gpRefocus, 30);
}
function gpB() {
  if (S.lb) return lbClose();
  if (S.pal.open) {
    if (S.pal.osk) {
      if (S.pal.osk.zone === 'res') { S.pal.osk.zone = 'kb'; sfx('back'); renderPalRes(); return oskDraw(); }
      if (S.pal.q) return oskType('bs');
    }
    return closePal();
  }
  if ($('#menu')) return closeMenu();
  if (dlgOpen()) return closeDlg();
  if (S.big.open) return bigB();
  if (document.activeElement && document.activeElement.matches('input, textarea, select')) return document.activeElement.blur();
  if (S.pop) { S.pop = false; sfx('close'); renderSideFoot(); renderPop(); return gpRefocus(); }
  if (S.selMode) return setSelMode(false);
  sfx('back');
  // Из карточки игры — обратно в список
  const row = $('#list .lrow.on');
  if (row && GP.focus !== row) return gpSet(row);
  GP.active = false; gpClear();
}
function gpX() {
  if (S.lb) return;
  if (S.pal.open && S.pal.osk?.zone === 'kb') return oskType('space');
  if (S.pal.open || dlgOpen() || $('#menu')) return;
  const g = S.big.open ? bigCurrent() : selGame();
  if (g) toggleFav(g.id);
}
function gpY() {
  if (S.lb) return;
  if (S.pal.open) { if (S.pal.osk?.zone === 'kb') return oskType('lang'); return palRun(true); }
  if (dlgOpen() || $('#menu')) return;
  if (S.big.bp && !S.big.page && !S.big.sheet && !S.big.menu) return openPal();   // Y — поиск, как в Steam
  if (S.big.open) return bigInfo();
  const g = selGame(); if (!g) return;
  const btn = $('#main [data-act="game-menu"]');
  if (btn) { menuAt(btn, gameMenuItems(g)); GP.active = true; setTimeout(gpRefocus, 20); }
}
const SETTAB = { fn: null };
function gpBumper(dir) {
  if (S.lb) return lbStep(dir);
  if (dlgOpen() && $('#dlg .set-dlg') && SETTAB.fn) return SETTAB.fn(dir);
  if (dlgOpen() && $('#dlg .st-dlg')) return statsPer(dir);
  if (S.pal.open || dlgOpen() || $('#menu')) return;
  if (S.big.open) return bigTab(dir);
  const keys = tabKeys();
  const i = keys.indexOf(S.filter);
  sfx('tab');
  setFilter(keys[(Math.max(0, i) + dir + keys.length) % keys.length]);
}
