"""Рисует картинки демо-библиотеки (обложки, фоны, логотипы, скриншоты) в tests/demo/art/."""
import os, base64, json, re
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'art'); os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(HERE, 'library.js'), encoding='utf-8').read()
def save(pg, spec, name):
    url = pg.evaluate('(s) => render(s)', spec)
    open(os.path.join(OUT, name), 'wb').write(base64.b64decode(url.split(',')[1]))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page()
    pg.goto('file://' + os.path.join(HERE, 'art.html')); pg.add_script_tag(content=src)
    pg.evaluate("Promise.all([document.fonts.load('800 40px Inter', 'AZ Кузня'), document.fonts.load('600 20px Inter', 'AZ Кузня')])"); pg.wait_for_timeout(800)
    demo = pg.evaluate('DEMO')
    for i, g in enumerate(demo):
        gid, title, genre, year, dev, kind, hue = g[:7]
        base = {'title': title, 'dev': dev, 'kind': kind, 'hue': hue, 'figure': kind in ('mount', 'desert', 'ice', 'forest'), 'figX': .62 + (i % 3) * .08}
        save(pg, {**base, 'type': 'cover', 'w': 600, 'h': 900, 'seed': 101 + i * 7}, f'{gid}-cover.png')
        save(pg, {**base, 'type': 'hero', 'w': 1920, 'h': 620, 'seed': 501 + i * 13, 'figure': False}, f'{gid}-hero.png')
        save(pg, {**base, 'type': 'logo', 'w': 1200, 'h': 220, 'seed': 1}, f'{gid}-logo.png')
        for k in range(4):
            save(pg, {**base, 'type': 'shot', 'w': 1280, 'h': 720, 'seed': 900 + i * 31 + k * 5, 'hue': hue + (k - 1) * 12, 'figure': k % 2 == 0, 'figX': .3 + k * .15}, f'{gid}-shot{k}.png')
    b.close()
print(len(os.listdir(OUT)), 'картинок')
