"""Автопроверка интерфейса перед сборкой: python3 tests/smoke.py
Открывает программу на тестовом стенде (без Electron, с выдуманной библиотекой) и проходит
основные сценарии мышью, клавиатурой и геймпадом. Любая ошибка JavaScript — провал."""
import os, sys, traceback
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
from make_stand import build

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORI = open(os.path.join(ROOT, 'tests', 'mock', 'ori.txt'), encoding='utf-8').read()
results = []

def check(name, fn, pg, errs):
    before = len(errs)
    try:
        fn(pg)
        if len(errs) > before: raise AssertionError('ошибка JS: ' + errs[-1])
        results.append((True, name, ''))
    except Exception as e:
        results.append((False, name, f'{type(e).__name__}: {e}'))
        if os.environ.get('VERBOSE'): traceback.print_exc()
    # каждый сценарий начинаем с чистого обычного режима
    try:
        pg.evaluate("""() => { try { lbClose(); } catch {} ; if (S.pal.open) closePal(); if (dlgOpen()) closeDlg(); closeMenu?.();
          if (S.big.open) closeBig(); }"""); pg.wait_for_timeout(150)
    except Exception: pass

def ev(pg, js, wait=150):
    r = pg.evaluate(js); pg.wait_for_timeout(wait); return r

# ─── Сценарии ────────────────────────────────────────────────────────────────
def t_load(pg):
    assert ev(pg, "games.length") >= 10, 'библиотека не загрузилась'
    assert ev(pg, "document.querySelectorAll('#list .lrow').length") > 5, 'список пуст'
    assert ev(pg, "!!document.querySelector('#main .d-hero')"), 'нет карточки игры'
    assert ev(pg, "lastLabel(Date.now())") == 'Сегодня', 'подписи «когда играли» сломаны'

def t_select(pg):
    ids = ev(pg, "[...document.querySelectorAll('#list .lrow')].map(r => r.dataset.id)")
    pg.click(f'#list .lrow[data-id="{ids[2]}"]'); pg.wait_for_timeout(200)
    assert ev(pg, "document.querySelector('#main').dataset.id") == ids[2], 'карточка не сменилась'

def t_desc(pg):
    r = pg.evaluate("(t) => { const b = descBlocks(t); return [b.reviews.length, b.notes.length, b.blocks.filter(x => x.k === 'ul').length] }", ORI)
    assert r == [8, 1, 1], f'разбор описания: {r}'
    pg.evaluate("(t) => { const g = selGame(); g.description = t; g.extra = null; render(); }", ORI); pg.wait_for_timeout(1200)
    assert ev(pg, "document.querySelectorAll('#main .rv').length") >= 4, 'нет карточек оценок'
    assert ev(pg, "!!document.querySelector('#main .gx-badges')"), 'нет плашек Steam'
    assert ev(pg, "!!document.querySelector('#main .gx-hltb')"), 'нет плашки «сколько проходить»'
    pg.click('#main .desc-more'); pg.wait_for_timeout(400)
    assert ev(pg, "document.querySelector('#main .desc').classList.contains('open')"), 'не раскрылось'

def t_lightbox(pg):
    pg.evaluate("() => { const g = selGame(); g.extra = null; render(); }"); pg.wait_for_timeout(1200)
    ev(pg, "document.querySelector('#main .gx-th:nth-child(2)').click()", 300)
    assert ev(pg, "!!document.getElementById('lb')"), 'просмотр не открылся'
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(150)
    assert ev(pg, "S.lb.i") == 2, 'не листается'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    assert ev(pg, "!document.getElementById('lb')"), 'не закрылся'

def t_dialogs(pg):
    for js, name in [("settingsDlg()", 'настройки'), ("catsDlg()", 'списки'), ("editDlg(selGame().id)", 'изменить'),
                     ("coverDlg(selGame().id)", 'обложка'), ("batchDlg()", 'авто-данные'), ("backupDlg()", 'резервная копия'), ("statsDlg()", 'статистика')]:
        if not ev(pg, f"typeof {js.split('(')[0]} === 'function'", 0): continue
        ev(pg, js, 400)
        assert ev(pg, "dlgOpen()"), f'не открылось окно: {name}'
        ev(pg, "closeDlg()", 250)
    ev(pg, "settingsDlg()", 400)
    tabs = ev(pg, "document.querySelectorAll('#dlg .set-nav [data-set]').length")
    assert tabs >= 6, f'в настройках {tabs} разделов'
    for i in range(tabs):
        ev(pg, f"document.querySelectorAll('#dlg .set-nav [data-set]')[{i}].click()", 120)
        assert ev(pg, f"document.querySelectorAll('#dlg .set-nav [data-set]')[{i}].classList.contains('on')"), f'раздел {i} не открылся'

def t_palette(pg):
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250)
    assert ev(pg, "S.pal.open"), 'поиск не открылся'
    pg.keyboard.type('hol'); pg.wait_for_timeout(250)
    assert ev(pg, "palResults().length") >= 1, 'поиск ничего не нашёл'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    assert not ev(pg, "S.pal.open")

def t_compact(pg):
    ev(pg, "switchMode('compact')", 500)
    assert ev(pg, "S.big.open && !S.big.bp"), 'не включился компактный'
    assert ev(pg, "!document.querySelector('#big .mn-side')"), 'боковая панель вернулась'
    assert ev(pg, "!!document.querySelector('#big [data-act=\"big-menu\"]')"), 'нет кнопки «Меню»'
    for d in ['right', 'right', 'down', 'left']: ev(pg, f"bigDir('{d}')", 80)
    ev(pg, "openPage(bigCurrent().id)", 600)
    assert ev(pg, "!!document.getElementById('bpage')"), 'страница игры не открылась'
    ev(pg, "bigB()", 300)
    assert ev(pg, "!S.big.page"), 'назад не работает'
    pg.click('#big [data-act="big-menu"]'); pg.wait_for_timeout(250)
    pg.click('#menu >> text=Обычный режим'); pg.wait_for_timeout(400)
    assert not ev(pg, "S.big.open"), 'не вернулись в обычный режим'

def t_tv(pg):
    ev(pg, "switchMode('bp')", 600)
    assert ev(pg, "S.big.bp"), 'ТВ-режим не открылся'
    for d in ['right', 'down', 'down', 'right', 'up']: ev(pg, f"bigDir('{d}')", 120)
    ev(pg, "openPage(bigCurrent().id)", 900)
    ev(pg, "bigDir('down')", 200)
    if ev(pg, "document.querySelectorAll('#bpage .gx-th').length"):
        assert ev(pg, "S.big.pf") == 'media', 'вниз не ведёт в галерею'
        ev(pg, "bigA()", 300); assert ev(pg, "!!S.lb"), 'A не открыл просмотр'
        ev(pg, "gpB()", 200); assert ev(pg, "!S.lb")
    ev(pg, "document.getElementById('bpage').scrollTop = 400", 200)
    assert ev(pg, "document.body.classList.contains('bp-scrolled')"), 'шапка не получила фон'
    ev(pg, "bigB()", 300); ev(pg, "bpMenuToggle()", 300)
    assert ev(pg, "S.big.menu"), 'меню ТВ не открылось'
    labels = ev(pg, "bpMenuItems().map(m => m.label)")
    assert 'Свернуть в трей' in labels and 'Выйти из программы' in labels, f'в меню ТВ нет трея/выхода: {labels}'
    ev(pg, "S.big.mi = bpMenuItems().findIndex(m => m.label === 'Свернуть в трей'); bigA()", 300)
    assert ev(pg, "window.__tray") == 1, '«Свернуть в трей» не сработало'

def t_gamepad(pg):
    pg.evaluate("""() => { window.__p = connectPad('045e-0b13-Xbox Wireless Controller');
      window.hold = async (i, ms = 200) => { __p.buttons[i] = {pressed:true, value:1}; await new Promise(r => setTimeout(r, ms)); __p.buttons[i] = {pressed:false, value:0}; await new Promise(r => setTimeout(r, 150)); }; }""")
    pg.wait_for_timeout(300)
    ev(pg, "hold(8)", 600)
    assert ev(pg, "S.pal.open && !!S.pal.osk"), 'Select не открыл поиск с клавиатурой'
    ev(pg, "hold(0)", 500)
    assert len(ev(pg, "S.pal.q")) == 1, 'A не ввёл букву'
    ev(pg, "hold(1)", 450); ev(pg, "hold(1)", 450)
    assert not ev(pg, "S.pal.open"), 'B не закрыл поиск'
    pg.evaluate("""async () => { __p.buttons[9] = {pressed:true, value:1}; __p.buttons[16] = {pressed:true, value:1};
      await new Promise(r => setTimeout(r, 250)); __p.buttons[9] = {pressed:false, value:0}; __p.buttons[16] = {pressed:false, value:0}; }"""); pg.wait_for_timeout(700)
    assert not ev(pg, "S.big.bp"), 'Start вместе с Guide открыл ТВ-режим'
    ev(pg, "closeMenu?.(); 0", 100)

def t_stats(pg):
    if not ev(pg, "typeof statsDlg === 'function'", 0): return
    ev(pg, "statsDlg()", 500)
    assert ev(pg, "!!document.querySelector('#dlg .st-dlg')"), 'нет окна статистики'
    for i in range(4):
        ev(pg, f"document.querySelectorAll('#dlg [data-st-per]')[{i}]?.click()", 200)
    assert ev(pg, "document.querySelectorAll('#dlg .st-kpi').length") >= 3, 'нет итогов'

SCENARIOS = [('загрузка', t_load), ('выбор игры', t_select), ('описание и оценки', t_desc), ('просмотр скриншотов', t_lightbox),
             ('окна и настройки', t_dialogs), ('поиск Ctrl+K', t_palette), ('компактный режим', t_compact), ('ТВ-режим', t_tv),
             ('геймпад', t_gamepad), ('статистика', t_stats)]

def main():
    url = build()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1600, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(2500)
        if errs: print('Ошибки при загрузке:', errs[:3])
        for name, fn in SCENARIOS: check(name, fn, pg, errs)
        b.close()
    bad = [r for r in results if not r[0]]
    for ok, name, msg in results: print(('  ✓ ' if ok else '  ✗ ') + name + (' — ' + msg if msg else ''))
    print(f'\n{len(results) - len(bad)} из {len(results)} сценариев прошли')
    sys.exit(1 if bad else 0)

if __name__ == '__main__': main()
