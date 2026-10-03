'use strict';
// ─── Индикатор запущенной игры и живые часы ──────────────────────────────────
function tickRunning() {
  const pill = $('#run-pill');
  const first = [...running.entries()][0];
  if (!first) pill.hidden = true;
  else {
    const [id, start] = first;
    const g = byId(id);
    pill.hidden = false;
    $('#run-name').textContent = (g ? g.name : 'Игра') + (running.size > 1 ? ` +${running.size - 1}` : '');
    $('#run-time').textContent = clockText(Date.now() - start);
  }
  document.querySelectorAll('.live-time[data-run]').forEach((el) => { if (running.has(el.dataset.run)) el.textContent = runTime(el.dataset.run); });
  const n = new Date(), tc = $('#tb-clock'); if (tc) tc.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
}

// ─── Подписи кнопок: клавиатура / Xbox / PlayStation ──────────────────────────
// Режим меняется по последнему устройству, которым пользовались.
const INPUT = { mode: 'kbd', ps5: false, pad: null, padName: null };
const PS_SVG = {
  cross: '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  circle: '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  square: '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  triangle: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 2.8L13.6 12.6H2.4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
};
// Какой именно геймпад: Sony — PlayStation, остальное — раскладка Xbox
function padStyle(p) {
  const id = String(p?.id || '').toLowerCase();
  if (/xbox|xinput|045e/.test(id)) return 'xbox';
  if (/054c|sony|dualsense|dualshock|playstation|^wireless controller/.test(id)) {
    INPUT.ps5 = /0ce6|0df2|dualsense/.test(id);
    return 'ps';
  }
  return 'xbox';
}
// ─── Какой геймпад подключён и сколько у него заряда ─────────────────────────
// Имя — по коду производителя и модели (Chromium иногда пишет «HID-совместимый
// игровой контроллер»), заряд — из HID-отчётов PlayStation и из Windows (Xbox).
const PAD_MODELS = {
  '054c': { _: 'Геймпад PlayStation', '05c4': 'DualShock 4', '09cc': 'DualShock 4', '0ba0': 'DualShock 4', '0ce6': 'DualSense', '0df2': 'DualSense Edge', '0268': 'DualShock 3' },
  '045e': { _: 'Геймпад Xbox', '028e': 'Xbox 360', '028f': 'Xbox 360', '0719': 'Xbox 360 (беспроводной)', '02d1': 'Xbox One', '02dd': 'Xbox One', '02ea': 'Xbox One S',
    '02e0': 'Xbox One S', '02fd': 'Xbox One S', '0b20': 'Xbox One S', '02e3': 'Xbox Elite', '0b00': 'Xbox Elite 2', '0b05': 'Xbox Elite 2', '0b22': 'Xbox Elite 2',
    '0b12': 'Xbox Series X|S', '0b13': 'Xbox Series X|S', '0b21': 'Xbox Adaptive' },
  '057e': { _: 'Геймпад Nintendo', '2009': 'Switch Pro Controller', '2006': 'Joy-Con (L)', '2007': 'Joy-Con (R)', '200e': 'Joy-Con' },
  '2dc8': { _: 'Геймпад 8BitDo' }, '046d': { _: 'Геймпад Logitech', 'c21d': 'Logitech F310', 'c21e': 'Logitech F510', 'c21f': 'Logitech F710' },
  '0f0d': { _: 'Геймпад HORI' }, '0e6f': { _: 'Геймпад PDP' }, '1532': { _: 'Геймпад Razer' }, '28de': { _: 'Steam Controller' },
  '2563': { _: 'Геймпад ShanWan' }, '0079': { _: 'Геймпад DragonRise' }, '20d6': { _: 'Геймпад PowerA' }, '24c6': { _: 'Геймпад PowerA' },
  '3537': { _: 'Геймпад GameSir' },
};
const GENERIC_PAD = /hid|совместим|compatible|game ?controller|gamepad|игров|usb joystick|^controller$|^wireless controller$/i;
function padIds(p) {
  const id = String(p?.id || '');
  const m = id.match(/vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i) || id.match(/^([0-9a-f]{4})-([0-9a-f]{4})-/i);
  if (m) return { vid: m[1].toLowerCase(), pid: m[2].toLowerCase() };
  // XInput-геймпад: браузер не знает его номер модели — берём из списка Windows (тот же контроллер)
  const x = xinputMatch(p);
  if (x) return { vid: hex4(x.vid), pid: hex4(x.pid) };
  return { vid: /xinput|xbox/i.test(id) ? '045e' : null, pid: null };
}
// Сопоставляем XInput-геймпады без номера модели с геймпадами из списка Windows, которые ещё ни с кем не совпали
function xinputMatch(p) {
  if (!p || p.native || typeof NATIVE === 'undefined' || !NATIVE.list?.length) return null;
  const raw = (q) => { const m = String(q?.id || '').match(/vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i) || String(q?.id || '').match(/^([0-9a-f]{4})-([0-9a-f]{4})-/i); return m ? m[1].toLowerCase() + ':' + m[2].toLowerCase() : null; };
  if (raw(p)) return null;
  const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  const taken = new Set(pads.map(raw).filter(Boolean));
  const free = NATIVE.list.filter((x) => !taken.has(hex4(x.vid) + ':' + hex4(x.pid)));
  const xin = pads.filter((q) => !raw(q)).sort((a, b) => a.index - b.index);
  const i = xin.findIndex((q) => q.index === p.index);
  const pref = free.filter((x) => hex4(x.vid) === '045e').concat(free.filter((x) => hex4(x.vid) !== '045e'));
  return i >= 0 ? pref[i] || null : null;
}
const PADX = { hid: new Map(), win: [], timer: null, hidBusy: false };
const hex4 = (n) => Number(n || 0).toString(16).padStart(4, '0');
// Ключ конкретной модели контроллера — под ним запоминается своё название
function padKey(p) { const { vid, pid } = padIds(p); return vid && pid ? vid + ':' + pid : String(p?.id || '').replace(/\s*\(.*$/, '').trim().toLowerCase() || 'pad'; }
function padName(p) {
  const own = settings.pads?.[padKey(p)]?.name;
  if (own) return own;
  return padAutoName(p);
}
function padAutoName(p) {
  const { vid, pid } = padIds(p);
  const model = vid && PAD_MODELS[vid];
  if (model && pid && model[pid]) return model[pid];
  // Имя, которое знает Windows или HID-драйвер, если оно не «общее»
  const w = PADX.win.find((x) => hex4(x.vid) === vid && (!pid || hex4(x.pid) === pid)) || (vid === '045e' && !pid ? PADX.win.find((x) => hex4(x.vid) === '045e') : null);
  if (w?.name && !GENERIC_PAD.test(w.name)) return w.name.slice(0, 32);
  const h = [...PADX.hid.values()].find((x) => x.vid === vid && (!pid || x.pid === pid));
  if (h?.name && !GENERIC_PAD.test(h.name)) return h.name.slice(0, 32);
  const raw = String(p?.id || '').replace(/\s*\(.*$/, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim();
  if (raw && !GENERIC_PAD.test(raw)) return raw.slice(0, 32);
  if (model) return model._;
  return padStyle(p) === 'ps' ? 'Геймпад PlayStation' : /xinput/i.test(p?.id || '') ? 'Геймпад Xbox' : 'Геймпад';
}
// Заряд: {pct, charging} или null, если устройство его не сообщает
function padBattery(p) {
  const { vid, pid } = padIds(p);
  const h = [...PADX.hid.values()].find((x) => x.vid === vid && (!pid || x.pid === pid) && x.pct != null);
  if (h) return { pct: h.pct, charging: h.charging };
  const w = PADX.win.find((x) => x.pct != null && hex4(x.vid) === vid && (!pid || hex4(x.pid) === pid))
    || (vid === '045e' && !pid ? PADX.win.find((x) => x.pct != null && hex4(x.vid) === '045e') : null);
  if (w) return { pct: Math.max(0, Math.min(100, w.pct)), charging: /^charging$/i.test(w.status || '') };
  return null;
}
function batteryHTML() {
  return '';   // заряд геймпада больше не показываем
  // eslint-disable-next-line no-unreachable
  const b = null; if (!b) return '';
  const icon = b.charging ? 'ph-battery-charging' : b.pct >= 88 ? 'ph-battery-full' : b.pct >= 60 ? 'ph-battery-high' : b.pct >= 35 ? 'ph-battery-medium' : b.pct >= 15 ? 'ph-battery-low' : 'ph-battery-warning';
  return `<span class="pad-bat${b.pct < 15 && !b.charging ? ' low' : ''}" title="${b.charging ? 'Заряжается' : 'Заряд геймпада'}"><i class="ph ${icon}"></i>${b.pct}%</span>`;
}
function curPad() { const pads = navigator.getGamepads?.() || []; return pads[GP.index] || [...pads].find(Boolean) || null; }
function padLabelHTML(cls = 'big-pad') {
  const p = curPad() || (NATIVE.list?.[0] ? nativePad(NATIVE.list[0]) : null);
  if (!p || (!GP.connected && !NATIVE.list?.length)) return '';
  const n = new Set(allPads().map(padKey)).size;
  // Несколько геймпадов — значок «пары» с числом, по нажатию список всех
  if (n > 1) return `<span class="${cls} pad-multi" data-act="pads-pop" title="Подключено геймпадов: ${n}"><span class="pad-pair"><i class="ph ph-game-controller"></i><i class="ph-fill ph-game-controller"></i></span><span class="pad-nm">${n} ${plural(n, 'геймпад', 'геймпада', 'геймпадов')}</span><i class="ph ph-caret-down pad-car"></i></span>`;
  return `<span class="${cls}" data-act="pad-dlg" title="Настроить геймпад"><i class="ph ph-game-controller"></i><span class="pad-nm">${esc(INPUT.padName || padName(p))}</span>${batteryHTML(padBattery(p))}</span>`;
}
// ─── Уведомление о геймпаде (как в Xbox): имя и заряд ─────────────────────
const PT = { timer: null, pad: null, kind: null, t0: 0, lowWarned: new Set() };
function padToastHTML() {
  const p = PT.pad, off = PT.kind === 'off';
  const nm = PT.name || (p ? padName(p) : 'Геймпад');
  const ps = p && padStyle(p) === 'ps';
  return `<div class="pt-ic${off ? ' off' : ''}"><i class="ph${ps ? '' : '-fill'} ph-game-controller"></i></div>
    <div class="pt-body"><div class="pt-t">${off ? 'Геймпад отключён' : 'Геймпад подключён'}</div>
    <div class="pt-n">${esc(nm)}</div></div>`;
}
// Все известные геймпады: из браузерной части и из Windows (даже если на них ещё не нажимали)
function allPads() {
  const l = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  const keys = new Set(l.map(padKey));
  for (const x of NATIVE.list || []) { const p = nativePad(x); if (!keys.has(padKey(p))) { keys.add(padKey(p)); l.push(p); } }
  return l;
}
// Геймпады, о которых сообщила сама Windows (сразу при включении, как в Steam)
const NATIVE = { list: null, keys: new Set() };
function nativePad(x) { const v = hex4(x.vid), p = hex4(x.pid); return { id: `${v}-${p}-${x.name || ''}`, index: -1, native: true }; }
function onNativePads(list) {
  list = Array.isArray(list) ? list : [];
  const keys = new Set(list.map((x) => padKey(nativePad(x))));
  if (NATIVE.list) {   // первое сообщение — то, что уже было подключено при запуске: без уведомлений
    for (const x of list) { const k = padKey(nativePad(x)); if (!NATIVE.keys.has(k)) padToast(nativePad(x), 'on'); }
    for (const x of NATIVE.list) { const k = padKey(nativePad(x)); if (!keys.has(k)) padToast(nativePad(x), 'off', padName(nativePad(x))); }
  }
  NATIVE.list = list; NATIVE.keys = keys;
  PADX.win = list;
  refreshPadLabels();
}
api.onPadsNative?.(onNativePads);
api.padsNative?.().then((l) => { if (l && !NATIVE.list) onNativePads(l); }).catch(() => {});
// Уведомление от браузерной части — только если Windows об этом геймпаде не сообщила
const nativeKnows = (p) => !!NATIVE.list && NATIVE.keys.has(padKey(p));
function padToast(p, kind = 'on', name = null) {
  let el = $('#pad-toast');
  if (!el) { el = document.createElement('div'); el.id = 'pad-toast'; document.body.appendChild(el); }
  PT.pad = p; PT.kind = kind; PT.name = name; PT.t0 = performance.now();
  el.innerHTML = padToastHTML();
  el.className = 'show';
  clearTimeout(PT.timer);
  if (kind === 'on') sfx('success');
  PT.timer = setTimeout(() => { el.className = ''; PT.kind = null; }, 4500);
}
function padToastUpdate() {
  const el = $('#pad-toast'); if (!el || !PT.kind || PT.kind === 'off') return;
  el.innerHTML = padToastHTML();
}
function padLowCheck() {}
function refreshPadLabels() {
  const p = curPad();
  padToastUpdate(); padLowCheck(p);
  if (p) INPUT.padName = padName(p);
  const pill = $('#pad-pill');
  if (pill) { const h = padLabelHTML('pad-in'); pill.hidden = !h; pill.innerHTML = h; }
  document.querySelectorAll('#big .big-pad').forEach((el) => { el.outerHTML = padLabelHTML(); });
  document.querySelectorAll('#big .bp-pad-host').forEach((el) => { el.innerHTML = padLabelHTML('bp-pad'); });
}
// ─── Вибро-отклик в меню (совсем лёгкий) ─────────────────────────────────────
const RUMBLE = { move: [16, 0.16, 0], tab: [24, 0.22, 0.05], select: [32, 0.3, 0.1], open: [28, 0.25, 0.05], close: [22, 0.2, 0],
  back: [22, 0.2, 0], fav: [40, 0.35, 0.12], unfav: [26, 0.2, 0.05], success: [45, 0.3, 0.15], launch: [140, 0.55, 0.45],
  error: [90, 0.2, 0.5], bigIn: [60, 0.3, 0.2], bigOut: [40, 0.2, 0.1] };
function rumble(name, pad = null) {
  if (settings.rumble === false || INPUT.mode === 'kbd') return;
  const r = RUMBLE[name]; const p = pad || curPad(); const act = p?.vibrationActuator;
  if (!r || !act?.playEffect) return;
  const k = Math.max(0, Math.min(1, settings.rumbleStrength ?? 0.6)) * 1.4;
  act.playEffect(act.type === 'vibration' ? 'dual-rumble' : (act.type || 'dual-rumble'), {
    startDelay: 0, duration: r[0], weakMagnitude: Math.min(1, r[1] * k), strongMagnitude: Math.min(1, r[2] * k),
  }).catch(() => {});
}
// «Сигнал» — чтобы найти, какой именно контроллер настраиваешь
async function padSignal(p) {
  if (p?.native) { const real = [...(navigator.getGamepads?.() || [])].find((x) => x && padKey(x) === padKey(p)); if (real) p = real; else return toast('Нажмите любую кнопку на геймпаде — после этого вибрация заработает'); }
  const act = p?.vibrationActuator;
  if (!act?.playEffect) return toast('Этот контроллер не поддерживает вибрацию', 'err');
  for (let i = 0; i < 3; i++) {
    await act.playEffect('dual-rumble', { startDelay: 0, duration: 180, weakMagnitude: 0.8, strongMagnitude: 0.6 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 120));
  }
}
function padDlg() {
  const pads = allPads();
  const byKey = new Map(); pads.forEach((p) => { if (!byKey.has(padKey(p))) byKey.set(padKey(p), p); });
  const list = [...byKey.values()];
  const d = openDlg(`${head('Геймпад', list.length ? 'Как в Steam: название запоминается для этого контроллера' : '')}
    <div class="dlg-body">
      ${list.length ? list.map((p, i) => {
        const key = padKey(p), bat = padBattery(p), { vid, pid } = padIds(p);
        return `<div class="pad-card" data-i="${i}">
          <div class="pad-card-h"><i class="ph ph-game-controller"></i><div class="grow"><b>${esc(padName(p))}</b>
            <div class="muted">${esc(padAutoName(p))}${vid ? ` · ${esc(vid)}:${esc(pid || '????')}` : ''} · раскладка ${padStyle(p) === 'ps' ? 'PlayStation' : 'Xbox'}</div></div>${batteryHTML(bat)}</div>
          <div class="pad-row"><label>Название контроллера</label><input class="input" data-name="${esc(key)}" value="${esc(settings.pads?.[key]?.name || '')}" placeholder="${esc(padAutoName(p))}" maxlength="40"></div>
          <div class="pad-row"><label>Найти контроллер</label><button class="btn btn-secondary" data-sig="${i}"><i class="ph ph-vibrate"></i>Сигнал</button></div>
        </div>`;
      }).join('') : '<div class="dlg-text">Геймпад не подключён. Подключите его и нажмите любую кнопку — он появится здесь.</div>'}
      <div class="section-t">Вибрация</div>
      ${chk('rumble', settings.rumble !== false, 'Лёгкий вибро-отклик в меню', 'Короткий толчок при перемещении, выборе, смене вкладки и запуске игры.')}
      <div class="vol-row"><i class="ph ph-vibrate"></i><input type="range" id="p-rs" min="10" max="100" value="${Math.round((settings.rumbleStrength ?? 0.6) * 100)}"><button class="btn btn-secondary" id="p-rt">Проверить</button></div>
    </div>
    <div class="dialog-actions"><button class="btn btn-secondary" data-act="dlg-close">Отмена</button><button class="btn btn-primary" id="p-save">Сохранить</button></div>`, { cls: 'wide' });
  bindChecks(d);
  d.querySelectorAll('[data-sig]').forEach((b) => b.onclick = () => padSignal(list[+b.dataset.sig]));
  $('#p-rt', d).onclick = () => { const was = [settings.rumble, settings.rumbleStrength, INPUT.mode];
    settings.rumble = true; settings.rumbleStrength = +$('#p-rs', d).value / 100; if (INPUT.mode === 'kbd') INPUT.mode = 'xbox';
    rumble('select', list[0]); setTimeout(() => rumble('move', list[0]), 180);
    setTimeout(() => { rumble('launch', list[0]); [settings.rumble, settings.rumbleStrength, INPUT.mode] = was; }, 380); };
  $('#p-save', d).onclick = async () => {
    settings.pads = { ...(settings.pads || {}) };
    d.querySelectorAll('[data-name]').forEach((inp) => {
      const v = inp.value.trim(), k = inp.dataset.name;
      if (v) settings.pads[k] = { ...(settings.pads[k] || {}), name: v }; else if (settings.pads[k]) delete settings.pads[k].name;
    });
    settings.rumble = chkVal(d, 'rumble'); settings.rumbleStrength = +$('#p-rs', d).value / 100;
    await saveSettingsQuiet();
    closeDlg(); refreshPadLabels(); if (S.big.open) renderBig();
    toast('Настройки геймпада сохранены', 'ok');
  };
}

// PlayStation: заряд лежит во входном HID-отчёте (как читает драйвер Linux hid-sony / hid-playstation)
function parseSonyBattery(pid, reportId, data) {
  const ds5 = pid === '0ce6' || pid === '0df2';
  let off;
  if (ds5) off = reportId === 0x01 && data.byteLength >= 63 ? 52 : reportId === 0x31 && data.byteLength >= 76 ? 53 : -1;
  else off = reportId === 0x01 && data.byteLength >= 63 ? 29 : reportId === 0x11 && data.byteLength >= 76 ? 31 : -1;
  if (off < 0) return null;
  const st = data.getUint8(off), lvl = st & 0x0f;
  if (ds5) {
    const cs = st >> 4;
    if (cs === 2) return { pct: 100, charging: false };
    if (cs > 2) return null;
    return { pct: Math.min(100, lvl * 10 + 5), charging: cs === 1 };
  }
  const cable = !!(st & 0x10);
  if (!cable) return { pct: lvl >= 10 ? 100 : lvl * 10 + 5, charging: false };
  return lvl < 10 ? { pct: lvl * 10 + 5, charging: true } : { pct: 100, charging: lvl === 10 };
}
async function hidScan() {
  if (!navigator.hid || PADX.hidBusy) return;
  PADX.hidBusy = true;
  try {
    const devs = await navigator.hid.getDevices();
    for (const d of devs) {
      const vid = hex4(d.vendorId), pid = hex4(d.productId), key = vid + ':' + pid;
      const isPad = (d.collections || []).some((c) => c.usagePage === 1 && (c.usage === 4 || c.usage === 5));
      if (!isPad || PADX.hid.has(key)) continue;
      const entry = { vid, pid, name: d.productName || '', pct: null, charging: false, last: -1e9 };
      PADX.hid.set(key, entry);
      continue;   // заряд не читаем — нужны только имена устройств
      try {
        if (!d.opened) await d.open();
        // По Bluetooth полный отчёт (с зарядом) приходит после чтения калибровки
        try { await d.receiveFeatureReport(pid === '0ce6' || pid === '0df2' ? 0x05 : 0x02); } catch { /* по USB не нужно */ }
        d.addEventListener('inputreport', (e) => {
          const now = performance.now(); if (now - entry.last < 3000) return;
          entry.last = now;
          const b = parseSonyBattery(pid, e.reportId, e.data);
          if (b && (b.pct !== entry.pct || b.charging !== entry.charging)) { entry.pct = b.pct; entry.charging = b.charging; refreshPadLabels(); }
        });
      } catch { /* устройство занято — покажем без заряда */ }
    }
  } catch { /* WebHID недоступен */ }
  PADX.hidBusy = false;
  refreshPadLabels();
}
async function winPadPoll() {
  if (!api.padInfo) return;
  const list = await api.padInfo().catch(() => []);
  PADX.win = Array.isArray(list) ? list : [];
  refreshPadLabels();
}
function startPadInfo() {
  hidScan(); winPadPoll();
  clearInterval(PADX.timer);
  PADX.timer = setInterval(() => { if (GP.connected) { hidScan(); winPadPoll(); } }, 30000);
}
navigator.hid?.addEventListener?.('connect', () => setTimeout(hidScan, 500));
navigator.hid?.addEventListener?.('disconnect', (e) => { PADX.hid.delete(hex4(e.device.vendorId) + ':' + hex4(e.device.productId)); refreshPadLabels(); });
function setInputMode(mode) {
  if (INPUT.mode === mode) return;
  INPUT.mode = mode;
  document.body.dataset.input = mode;
  refreshKeyHints();
}
// Как нарисовать кнопку действия в текущем режиме
function keyCap(action) {
  const m = INPUT.mode;
  if (m === 'kbd') {
    const K = { a: 'Enter', b: 'Esc', x: 'F', y: 'I', lb: 'Q', rb: 'E', start: 'Ctrl B', back: 'Ctrl K', nav: '← →' };
    return `<span class="keycap">${K[action]}</span>`;
  }
  if (m === 'ps') {
    const face = { a: ['cross', 'ps-cross'], b: ['circle', 'ps-circle'], x: ['square', 'ps-square'], y: ['triangle', 'ps-triangle'] }[action];
    if (face) return `<span class="pad-key ${face[1]}">${PS_SVG[face[0]]}</span>`;
    const K = { lb: 'L1', rb: 'R1', start: 'Options', back: INPUT.ps5 ? 'Create' : 'Share', nav: '←→' };
    return `<span class="keycap">${K[action]}</span>`;
  }
  const face = { a: 'A', b: 'B', x: 'X', y: 'Y' }[action];
  if (face) return `<span class="pad-key xb-${face.toLowerCase()}">${face}</span>`;
  const K = { lb: 'LB', rb: 'RB', start: '≡', back: '⧉', nav: '←→' };
  return `<span class="keycap">${K[action]}</span>`;
}
function refreshKeyHints() {
  // Нижняя панель подсказок в библиотеке — только когда управляют геймпадом
  $('#gp-hints').innerHTML = `<span>${keyCap('a')}Выбрать</span><span>${keyCap('b')}Назад</span><span>${keyCap('x')}Избранное</span>
    <span>${keyCap('start')}Меню игры</span><span>${keyCap('lb')}${keyCap('rb')}Вкладки</span><span>${keyCap('back')}Поиск</span><span>${keyCap('back')}+${keyCap('start')}Режим</span>`;
  gpShowHints();
  const h = $('#main .d-hint'); if (h) h.innerHTML = keyCap('a');
  if (S.big.open) renderBig();
  if (S.pal.open) renderPalFoot();
}

// ─── Быстрый поиск (Ctrl+K) ──────────────────────────────────────────────────
const PAL_ACTIONS = [
  ['scan', 'Сканировать папку с играми', 'ph ph-folder-open', () => scan('folder')],
  ['desktop', 'Найти игры на рабочем столе', 'ph ph-desktop', () => scan('desktop')],
  ['add', 'Добавить игру', 'ph ph-plus', () => addDlg()],
  ['wizard', 'Мастер настройки (игры, ключи, обложки)', 'ph ph-magic-wand', () => wizardDlg()],
  ['check', 'Проверить, какие игры ещё есть на компьютере', 'ph ph-magnifying-glass-plus', () => checkDlg()],
  ['import', 'Импорт игр из лаунчеров', 'ph ph-download', () => addDlg({ tab: 'steam' })],
  ['big', 'Компактный режим (как Xbox)', 'ph ph-game-controller', () => openBig()],
  ['batch', 'Обновить обложки и описания для всех', 'ph ph-arrows-clockwise', () => batchDlg()],
  ['random', 'Что поиграть?', 'ph ph-dice-five', () => randomGame()],
  ['theme', () => isLight() ? 'Тёмная тема' : 'Светлая тема', 'ph ph-circle-half', () => toggleTheme()],
  ['sound', () => settings.sound === false ? 'Включить звуки' : 'Выключить звуки', 'ph ph-speaker-high', () => toggleSound()],
  ['pad', 'Геймпад: название и вибрация', 'ph ph-game-controller', () => padDlg()],
  ['rumble', () => settings.rumble === false ? 'Включить вибрацию геймпада' : 'Выключить вибрацию геймпада', 'ph ph-vibrate', () => { settings.rumble = settings.rumble === false; saveSettingsQuiet(); toast(settings.rumble ? 'Вибрация включена' : 'Вибрация выключена'); }],
  ['cats', 'Списки и вкладки', 'ph ph-list-bullets', () => catsDlg()],
  ['backup', 'Резервная копия', 'ph ph-download-simple', () => backupDlg()],
  ['settings', 'Настройки', 'ph ph-gear-six', () => settingsDlg()],
];
function palResults() {
  const q = S.pal.q.trim().toLowerCase();
  const pool = S.big.open ? visible() : games;
  const match = (g) => [g.name, g.developer, g.genre, ...(g.tags || [])].some((x) => String(x || '').toLowerCase().includes(q));
  const found = q ? sortBy(pool.filter(match), 'recent').slice(0, 8) : sortBy(pool, 'recent').slice(0, 5);
  const label = (a) => typeof a[1] === 'function' ? a[1]() : a[1];
  const acts = PAL_ACTIONS.filter((a) => !q || label(a).toLowerCase().includes(q)).slice(0, q ? 11 : 5);
  return [...found.map((g) => ({ kind: 'game', g })), ...acts.map((a) => ({ kind: 'act', a, label: label(a) }))];
}
function openPal() {
  closeMenu(); S.pop = false; renderPop();
  // С геймпада физической клавиатуры нет — показываем экранную
  const osk = INPUT.mode !== 'kbd';
  S.pal = { open: true, q: '', i: 0, osk: osk ? { r: 1, c: 0, lang: 'ru', zone: 'kb' } : null };
  sfx('open');
  renderPal();
  if (!osk) setTimeout(() => $('#pal-q')?.focus(), 20);
}
// ─── Экранная клавиатура для поиска с геймпада ───────────────────────────────
const OSK_ROWS = { ru: ['1234567890', 'йцукенгшщзх', 'фывапролджэ', 'ячсмитьбю'], en: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'] };
const OSK_ACT = [['bs', '<i class="ph ph-backspace"></i>Стереть'], ['space', 'Пробел'], ['lang', 'RU / EN'], ['go', '<i class="ph-fill ph-play"></i>Найти']];
function oskRows() { const o = S.pal.osk; return [...OSK_ROWS[o.lang].map((r) => [...r].map((ch) => [ch, ch])), OSK_ACT]; }
function oskHTML() {
  const o = S.pal.osk; if (!o) return '';
  return `<div class="osk${o.zone === 'kb' ? ' act' : ''}">${oskRows().map((row, r) => `<div class="osk-row${r === 4 ? ' acts' : ''}">${row.map(([k, l], c) => `<button class="osk-k${o.zone === 'kb' && o.r === r && o.c === c ? ' on' : ''}" data-act="osk" data-r="${r}" data-c="${c}">${r === 4 ? l : esc(l)}</button>`).join('')}</div>`).join('')}</div>`;
}
function oskDraw() { const k = $('#pal .osk'); if (k) k.outerHTML = oskHTML(); renderPalFoot(); }
function oskType(k) {
  const o = S.pal.osk; let q = S.pal.q;
  if (k === 'bs') q = q.slice(0, -1);
  else if (k === 'space') q += ' ';
  else if (k === 'lang') { o.lang = o.lang === 'ru' ? 'en' : 'ru'; sfx('tab'); return oskDraw(); }
  else if (k === 'go') { if (palResults().length) { o.zone = 'res'; S.pal.i = 0; sfx('select'); renderPalRes(); return oskDraw(); } return; }
  else q += k;
  S.pal.q = q; S.pal.i = 0; const inp = $('#pal-q'); if (inp) inp.value = q;
  sfx('move'); renderPalRes();
}
function oskDir(dir) {
  const o = S.pal.osk, rows = oskRows();
  if (o.zone === 'res') {
    if (dir === 'up' && S.pal.i === 0) { o.zone = 'kb'; o.r = rows.length - 1; o.c = 3; sfx('move'); renderPalRes(); return oskDraw(); }
    if (dir === 'up') palMove(-1); else if (dir === 'down') palMove(1);
    return;
  }
  if (dir === 'left') o.c = Math.max(0, o.c - 1);
  else if (dir === 'right') o.c = Math.min(rows[o.r].length - 1, o.c + 1);
  else if (dir === 'up') { if (o.r === 0) return; o.r--; }
  else if (dir === 'down') {
    if (o.r === rows.length - 1) { if (palResults().length) { o.zone = 'res'; S.pal.i = 0; sfx('move'); renderPalRes(); return oskDraw(); } return; }
    o.r++;
  }
  o.c = Math.min(o.c, rows[o.r].length - 1);
  sfx('move'); oskDraw();
}
function closePal() {
  if (!S.pal.open) return;
  S.pal.open = false; $('#pal').hidden = true; $('#pal').innerHTML = '';
  sfx('close');
  gpRefocus();
}
function renderPal() {
  const el = $('#pal');
  el.hidden = false;
  if (!$('#pal-q')) {
    el.innerHTML = `<div class="dialog-backdrop pal-back" data-act="pal-close"><div class="dialog pal-box">
      <div class="pal-head"><i class="ph ph-magnifying-glass"></i><input id="pal-q" placeholder="Найти игру или действие" spellcheck="false" autocomplete="off"><span class="tb-kbd">Esc</span></div>
      ${S.pal.osk ? oskHTML() : ''}
      <div class="pal-rule"></div><div class="pal-res" id="pal-res"></div><div class="pal-foot" id="pal-foot"></div></div></div>`;
    $('#pal-q').value = S.pal.q;
  }
  renderPalRes(); renderPalFoot();
}
function renderPalRes() {
  const res = palResults();
  S.pal.i = Math.max(0, Math.min(S.pal.i, res.length - 1));
  const games_ = res.filter((r) => r.kind === 'game'), acts = res.filter((r) => r.kind === 'act');
  let i = -1;
  const row = (r) => { i++; const on = i === S.pal.i && (!S.pal.osk || S.pal.osk.zone === 'res');
    return r.kind === 'game'
      ? `<div class="pal-item${on ? ' on' : ''}" data-act="pal-run" data-arg="${i}"><div class="pal-cov" style="${coverBg(r.g)}"></div>
          <span class="pal-l">${esc(r.g.name)}</span><span class="pal-sub">${running.has(r.g.id) ? 'Запущена' : !isPlayed(r.g) ? 'Новая' : esc(lastLabel(r.g.lastPlayed))}</span><span class="pal-hint">Играть ↵</span></div>`
      : `<div class="pal-item${on ? ' on' : ''}" data-act="pal-run" data-arg="${i}"><i class="${r.a[2]} pal-ic"></i><span class="pal-l">${esc(r.label)}</span><span class="pal-hint">↵</span></div>`; };
  $('#pal-res').innerHTML = (games_.length ? `<div class="pal-sec">Игры</div>${games_.map(row).join('')}` : '')
    + (acts.length ? `<div class="pal-sec">Действия</div>${acts.map(row).join('')}` : '')
    + (!res.length ? `<div class="pal-empty">Ничего не найдено по запросу «${esc(S.pal.q)}»</div>` : '');
  $('#pal-res .pal-item.on')?.scrollIntoView({ block: 'nearest' });
}
function renderPalFoot() {
  const f = $('#pal-foot'); if (!f) return;
  f.innerHTML = INPUT.mode === 'kbd'
    ? '<span>↑ ↓ выбор</span><span>Enter — запустить</span><span>Shift+Enter — открыть карточку</span><span>Esc — закрыть</span>'
    : S.pal.osk && S.pal.osk.zone === 'kb'
      ? `<span>${keyCap('a')}Ввести</span><span>${keyCap('b')}Стереть</span><span>${keyCap('x')}Пробел</span><span>${keyCap('y')}RU / EN</span><span>${keyCap('start')}К результатам</span>`
      : `<span>${keyCap('a')}Запустить</span><span>${keyCap('y')}Открыть карточку</span><span>${keyCap('b')}Назад к клавиатуре</span>`;
}
function palMove(d) {
  const n = palResults().length; if (!n) return;
  const j = Math.max(0, Math.min(n - 1, S.pal.i + d));
  if (j !== S.pal.i) { S.pal.i = j; sfx('move'); renderPalRes(); }
}
function palRun(open = false) {
  const r = palResults()[S.pal.i]; if (!r) return;
  closePal();
  if (r.kind === 'act') { sfx('select'); return r.a[3](); }
  if (!open) return launch(r.g.id);
  sfx('select');
  if (S.big.open) {
    if (S.big.bp) return openPage(r.g.id);
    Object.assign(S.big, { tab: 'all', sort: null, page: null, zone: 'grid', menu: false });
    S.big.idx = Math.max(0, bigList().findIndex((x) => x.id === r.g.id));
    S.big.sheet = true; S.big.sheetId = r.g.id; S.big.si = 0; renderBig();
  } else {
    if (!currentList().some((x) => x.id === r.g.id)) S.filter = r.g.hidden ? 'hidden' : 'all';
    S.selId = r.g.id; render();
    $(`#list .lrow[data-id="${CSS.escape(r.g.id)}"]`)?.scrollIntoView({ block: 'center' });
  }
}
async function toggleSound() {
  settings.sound = settings.sound === false;
  await saveSettingsQuiet();
  if (settings.sound) sfx('success');
  toast(settings.sound ? 'Звуки включены' : 'Звуки выключены');
  renderPop();
}
