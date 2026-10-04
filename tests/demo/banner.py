"""Баннер README и картинка для соцсетей: docs/banner.webp и docs/social-preview.jpg.
Запуск: python3 tests/demo/make_art.py (один раз) → python3 tests/demo/banner.py"""
import os, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); DOCS = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    for name, w, h, scale, out, args in [('banner', 1280, 420, 2, 'banner.webp', ['-quality', '90']), ('social', 1280, 640, 1, 'social-preview.jpg', ['-q:v', '3'])]:
        pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=scale)
        pg.goto('file://' + os.path.join(HERE, name + '.html')); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(800)
        png = os.path.join(HERE, name + '.png'); pg.screenshot(path=png)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', png, *args, os.path.join(DOCS, out)], check=True); os.remove(png); print('  ', out)
    b.close()
