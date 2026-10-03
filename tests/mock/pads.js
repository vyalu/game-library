// Фальшивые геймпады: window.__pad = {id, buttons:[{pressed,value}], axes:[]}
window.__pads = [null];
navigator.getGamepads = () => window.__pads;
window.__rumbles=[]; window.makePad = (id) => ({ id, index: 0, connected: true, mapping: 'standard', vibrationActuator: { type: 'dual-rumble', playEffect: async (t, o) => { window.__rumbles.push(o.duration); return 'complete'; } }, axes: [0,0,0,0], buttons: Array.from({length:17}, () => ({pressed:false, value:0})) });
window.connectPad = (id) => { const p = makePad(id); window.__pads = [p]; const e = new Event('gamepadconnected'); e.gamepad = p; dispatchEvent(e); return p; };
window.press = async (p, i) => { p.buttons[i] = {pressed:true, value:1}; await new Promise(r=>setTimeout(r,60)); p.buttons[i] = {pressed:false, value:0}; await new Promise(r=>setTimeout(r,60)); };

// Фальшивый WebHID: DualSense по USB, заряд 70% (уровень 6), разряжается
window.__hidDev = { vendorId: 0x054c, productId: 0x0ce6, productName: 'DualSense Wireless Controller', opened: false, collections: [{ usagePage: 1, usage: 5 }],
  _l: [], open: async function () { this.opened = true; }, receiveFeatureReport: async () => new DataView(new ArrayBuffer(41)),
  addEventListener: function (t, f) { this._l.push(f); },
  emit: function (lvl, cs) { const b = new ArrayBuffer(63); const v = new DataView(b); v.setUint8(52, (cs << 4) | lvl); this._l.forEach((f) => f({ reportId: 1, data: v })); } };
Object.defineProperty(navigator, 'hid', { value: { getDevices: async () => window.__hidOn ? [window.__hidDev] : [], addEventListener: () => {} } });
