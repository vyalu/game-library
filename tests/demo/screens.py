"""Скриншоты и анимация для README на выдуманной демо-библиотеке.
Запуск: python3 tests/demo/make_art.py  (один раз — картинки)  →  python3 tests/demo/screens.py
Результат: docs/screenshots/*.webp и docs/demo.webp"""
import os, sys, glob, shutil, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tests'))
from make_stand import build
OUT = os.path.join(ROOT, 'docs', 'screenshots'); os.makedirs(OUT, exist_ok=True)
LIB = open(os.path.join(HERE, 'library.js'), encoding='utf-8').read()
import json
VER = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']

# Превращаем DEMO в игры программы: магазины, история по дням, сессии, подробности Steam, время прохождения
SETUP = r"""
async () => {
  const D = 864e5, now = Date.now(), A = 'tests/demo/art/';
  const stores = ['steam', 'steam', 'epic', 'gog', 'steam', 'steam', 'steam', 'gog', 'steam', 'epic', 'steam', 'ubisoft', 'steam', 'steam', 'ea', 'steam', 'battlenet', 'steam'];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  games = DEMO.map(([id, name, genre, year, dev, kind, hue, hours, ago, fav, done, list, desc], i) => {
    const g = { id, name, genre, year: String(year), developer: dev, hue, playtime: hours * 60, favorite: !!fav, completed: !!done, lists: list ? [list] : [],
      lastPlayed: ago == null ? null : now - ago * D - 3 * 3600e3, launched: ago != null, runs: hours ? Math.round(hours / 1.6) : 0, rating: 72 + (i * 7) % 26,
      addedAt: now - (ago == null ? 3 + i : 30 + i * 20) * D, description: desc, store: stores[i], storeId: String(1000 + i),
      exePath: `D:\\Games\\${name}\\game.exe`, installDir: `D:\\Games\\${name}`, cover: A + id + '-cover.png', coverSrc: 'steam', hero: A + id + '-hero.png', heroSrc: 'steam',
      logo: ['ashfall', 'starfall', 'tides', 'arcana', 'neon'].includes(id) ? A + id + '-logo.png' : null, days: {}, sess: [] };
    if (ago != null && hours) {
      let left = hours * 60;
      for (let d = ago; left > 0 && d < 420; d += 1 + Math.floor(rnd() * (i < 4 ? 2 : 6))) {
        const m = Math.min(left, Math.round(35 + rnd() * 150)); left -= m;
        const day = new Date(now - d * D); g.days[key(day)] = (g.days[key(day)] || 0) + m;
        const st = new Date(day); st.setHours(18 + Math.floor(rnd() * 5), Math.floor(rnd() * 60)); g.sess.push([st.getTime(), m]);
      }
      g.sess.sort((a, b) => a[0] - b[0]);
    }
    const main = [42, 9, 16, 38, 30, 55, 7, 12, 14, 6, 24, 48, 10, 11, 9, 20, 18, 15][i];
    g.extra = { v: 2, from: 'steam', t: now, rev: (() => { const pct = 74 + (i * 7) % 24; return { pct, total: 3200 + i * 4711, desc: pct >= 95 ? 'Крайне положительные' : pct >= 80 ? 'Очень положительные' : 'В основном положительные' }; })(),
      mc: i % 3 === 2 ? null : { score: 76 + (i * 3) % 20 }, ru: { ui: true, voice: i % 2 === 0 }, ctrl: i % 4 === 3 ? 'partial' : 'full', ach: 20 + (i * 13) % 70,
      cats: [{ id: 2, n: 'Для одного игрока' }, ...(['north', 'dune', 'neon'].includes(id) ? [{ id: 9, n: 'Кооператив' }, { id: 39, n: 'Общий экран' }] : []), { id: 23, n: 'Облако Steam' }, { id: 41, n: 'Remote Play на телевизоре' }],
      shots: [0, 1, 2, 3].map((k) => ({ t: A + id + '-shot' + k + '.png', f: A + id + '-shot' + k + '.png' })), movies: [],
      hltb: { id: i, name, main, plus: Math.round(main * 1.7), full: Math.round(main * 2.9) } };
    return g;
  });
  cats = DEMO_LISTS; settings.cats = cats;
  settings.tabs = ['all', 'fav', 'cat:party', 'cat:later', 'cat:cozy', 'new'];
  settings.tile = { size: 190, cols: 0, shape: 'portrait', info: 'full' }; settings.autoStores = false; S.missDismissed = true; exists.clear?.();
  S.selId = 'ashfall'; S.filter = 'all';
  api.getAppVersion = async () => '__VER__'; api.getUpdateInfo = async () => ({ version: '__VER__', packaged: true, feed: { configured: false, reason: 'placeholder' }, state: null });
  document.getElementById('ver').textContent = 'v__VER__';
  render();
  document.getElementById('toast').classList.remove('show');
}
"""

def shot(pg, name, clip=None):
    png = os.path.join(OUT, name + '.png')
    pg.wait_for_timeout(350)
    pg.evaluate("document.getElementById('toast').classList.remove('show'); document.querySelectorAll('.pad-toast, #pad-toast, .gp-toast').forEach(e => e.remove())")
    pg.screenshot(path=png, clip=clip)
    webp = os.path.join(OUT, name + '.webp')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', png, '-quality', '92', webp], check=True)
    os.remove(png)
    print('  ', name)

def prepare(pg):
    pg.goto(build()); pg.wait_for_timeout(2500)
    pg.evaluate("() => { " + LIB + " }")
    pg.evaluate(SETUP.replace('__VER__', VER)); pg.wait_for_timeout(1200)
    pg.evaluate("Promise.all([...document.images].map(i => i.decode().catch(() => {})))"); pg.wait_for_timeout(500)

def screenshots(p):
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1.2)
    prepare(pg)
    shot(pg, 'library')                                                   # обычный режим, верх карточки
    pg.evaluate("document.querySelector('#main').scrollTop = document.querySelector('#main .d-about').offsetTop - 40")
    shot(pg, 'game-page')                                                 # «Об игре»: плашки, галерея, описание
    pg.evaluate("document.querySelector('#main').scrollTop = 0; select('tides')"); pg.wait_for_timeout(400)
    pg.evaluate("statsDlg()"); pg.wait_for_timeout(600)
    shot(pg, 'stats')                                                     # статистика
    pg.evaluate("closeDlg(); settingsDlg()"); pg.wait_for_timeout(600)
    shot(pg, 'settings')                                                  # настройки: схемы, режимы
    pg.evaluate("closeDlg()")
    pg.evaluate("lbFromGame('ashfall', 1)"); pg.wait_for_timeout(600)
    shot(pg, 'viewer')                                                    # просмотр скриншотов
    pg.evaluate("lbClose()")
    # геймпад: Xbox-контроллер, поиск с экранной клавиатурой
    pg.evaluate("window.__p = connectPad('045e-0b13-Xbox Wireless Controller'); setInputMode('xbox'); render()"); pg.wait_for_timeout(400)
    pg.evaluate("__p.buttons[8] = {pressed: true, value: 1}; setTimeout(() => { __p.buttons[8] = {pressed: false, value: 0}; }, 200)"); pg.wait_for_timeout(700)
    pg.evaluate("if (S.pal.osk) { S.pal.osk.lang = 'en'; oskDraw(); } oskType('n'); oskType('e'); S.pal.osk.r = 2; S.pal.osk.c = 4; oskDraw()"); pg.wait_for_timeout(500)
    shot(pg, 'gamepad-search')
    pg.evaluate("closePal()")
    pg.evaluate("switchMode('compact')"); pg.wait_for_timeout(800)
    pg.evaluate("Promise.all([...document.images].map(i => i.decode().catch(() => {})))"); pg.wait_for_timeout(400)
    shot(pg, 'compact')                                                   # компактный режим
    pg.evaluate("switchMode('bp')"); pg.wait_for_timeout(900)
    for d in ['right', 'right']: pg.evaluate(f"bigDir('{d}')"); pg.wait_for_timeout(250)
    shot(pg, 'tv')                                                        # ТВ-режим, полки
    pg.evaluate("bigA()"); pg.wait_for_timeout(1000)
    shot(pg, 'tv-page')                                                   # ТВ-режим, страница игры
    b.close()

def demo_gif(p):
    tmp = os.path.join(HERE, '.video'); shutil.rmtree(tmp, ignore_errors=True)
    b = p.chromium.launch(args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}, record_video_dir=tmp, record_video_size={'width': 1280, 'height': 720})
    pg = ctx.new_page(); prepare(pg)
    t0 = pg.evaluate("performance.now()")
    W = lambda ms: pg.wait_for_timeout(ms)
    W(900)
    for _ in range(3): pg.evaluate("moveSel(1)"); W(650)
    pg.evaluate("document.querySelector('#main').scrollTo({top: document.querySelector('#main .d-about').offsetTop - 40, behavior: 'smooth'})"); W(1500)
    pg.evaluate("document.querySelector('#main').scrollTo({top: 0, behavior: 'smooth'})"); W(900)
    pg.evaluate("window.__p = connectPad('045e-0b13-Xbox Wireless Controller'); setInputMode('xbox')")
    pg.evaluate("switchMode('bp')"); W(1300)
    for d in ['right', 'right', 'right', 'down', 'down', 'right', 'right', 'up', 'up']: pg.evaluate(f"bigDir('{d}')"); W(420)
    pg.evaluate("bigA()"); W(1600)
    pg.evaluate("document.getElementById('bpage').scrollTo({top: 560, behavior: 'smooth'})"); W(1500)
    pg.evaluate("bigB()"); W(700)
    pg.evaluate("switchMode('compact')"); W(1400)
    for d in ['right', 'right', 'down']: pg.evaluate(f"bigDir('{d}')"); W(380)
    pg.evaluate("statsDlg()"); W(1600)
    pg.evaluate("statsPer('year')"); W(1500)
    path = pg.video.path(); ctx.close(); b.close()
    start = max(0, (t0 / 1000) + 0.3)
    out = os.path.join(ROOT, 'docs', 'demo.webp')   # анимированный WebP: в разы легче GIF, GitHub показывает его так же
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{start:.2f}', '-i', path, '-vf', 'fps=12,scale=1000:-1:flags=lanczos',
      '-c:v', 'libwebp', '-lossless', '0', '-q:v', '62', '-compression_level', '6', '-loop', '0', '-an', out], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print('   demo.webp', round(os.path.getsize(out) / 1e6, 1), 'МБ')

if __name__ == '__main__':
    with sync_playwright() as p:
        screenshots(p)
        if '--no-gif' not in sys.argv: demo_gif(p)
