"""Проверка: в файлах renderer/ нет двух глобальных функций или констант с одним именем.
Скрипты подключаются по очереди в одну общую область — одноимённая функция молча заменит прежнюю."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seen, bad = {}, []
for f in sorted(os.listdir(os.path.join(ROOT, 'renderer'))):
    for n, line in enumerate(open(os.path.join(ROOT, 'renderer', f), encoding='utf-8'), 1):
        m = re.match(r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', line)
        if not m: continue
        name = m.group(1) or m.group(2)
        if name in seen: bad.append(f'{name}: {seen[name]} и {f}:{n}')
        else: seen[name] = f'{f}:{n}'
if bad: print('Одинаковые имена в renderer/:\n  ' + '\n  '.join(bad)); sys.exit(1)
print(f'Имена в renderer/ без повторов ({len(seen)})')
