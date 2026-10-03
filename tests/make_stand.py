"""Собирает тестовый стенд: настоящий index.html + подменённый window.api (tests/mock) вместо Electron.
Стенд лежит в tests/.stand/index.html и берёт assets/ и renderer/ прямо из проекта."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def build():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    html = html.replace('<head>', '<head>\n<base href="../../">', 1)
    first = re.search(r'<script src="renderer/', html).start()
    html = html[:first] + '<script src="tests/mock/mock.js"></script>\n<script src="tests/mock/pads.js"></script>\n' + html[first:]
    out = os.path.join(ROOT, 'tests', '.stand'); os.makedirs(out, exist_ok=True)
    path = os.path.join(out, 'index.html')
    open(path, 'w', encoding='utf-8').write(html)
    return 'file://' + path
if __name__ == '__main__': print(build())
