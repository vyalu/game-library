"""Иконка программы «пиксельный геймпад»: assets/icon.png (512), assets/icon.ico (16…256) и assets/logo.svg.
Каждый размер рисуется отдельно попиксельно — клетки геймпада целые, поэтому иконка чёткая и на 16 px.
Запуск: python3 tools/make_icon.py  (нужен Pillow)"""
import os, struct, io
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = ["..##########..",
        ".############.",
        "####D####B####",
        "###DDD####A###",
        "####D####C####",
        "##############",
        "#####....#####",
        ".###......###."]
COL = {'#': (233, 227, 255), 'D': (255, 95, 162), 'A': (255, 210, 63), 'B': (63, 210, 255), 'C': (125, 255, 155)}
TOP, BOT = (59, 29, 110), (21, 9, 43)
W, H = len(ROWS[0]), len(ROWS)

def cell_for(s):
    if s <= 30: return 1
    if s <= 96: return max(2, round(s * 0.78 / W))
    return round(s * 0.66 / W)

def background(s):
    k = 4; big = s * k
    grad = Image.new('RGBA', (1, big))
    for y in range(big):
        t = y / (big - 1); grad.putpixel((0, y), tuple(round(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)) + (255,))
    grad = grad.resize((big, big))
    mask = Image.new('L', (big, big), 0)
    r = round(big * (0.227 if s >= 48 else 0.18))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), r, fill=255)
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0)); img.paste(grad, (0, 0), mask)
    img = img.resize((s, s), Image.LANCZOS)
    if s >= 64:   # лёгкие «строки развёртки», как на старом мониторе
        sc = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(sc); step = max(2, s // 64)
        for y in range(0, s, step * 2): d.rectangle((0, y, s, y + step - 1), fill=(255, 255, 255, 9))
        img = Image.alpha_composite(img, Image.composite(sc, Image.new('RGBA', (s, s)), img.split()[3]))
    return img

def icon(s):
    img = background(s); c = cell_for(s)
    shadow = s >= 24
    pw, ph = W * c, (H + (1 if shadow else 0)) * c
    x0, y0 = (s - pw) // 2, (s - ph) // 2
    d = ImageDraw.Draw(img)
    if shadow:
        sh = Image.new('RGBA', (s, s), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
        for y, row in enumerate(ROWS):
            for x, ch in enumerate(row):
                if ch != '.': ds.rectangle((x0 + x * c, y0 + (y + 1) * c, x0 + x * c + c - 1, y0 + (y + 2) * c - 1), fill=(0, 0, 0, 100))
        img = Image.alpha_composite(img, sh); d = ImageDraw.Draw(img)
    for y, row in enumerate(ROWS):
        for x, ch in enumerate(row):
            if ch != '.': d.rectangle((x0 + x * c, y0 + y * c, x0 + x * c + c - 1, y0 + y * c + c - 1), fill=COL[ch] + (255,))
    return img

def dib(img):
    s = img.size[0]; px = img.load()
    rows = b''.join(bytes(b for x in range(s) for b in (px[x, y][2], px[x, y][1], px[x, y][0], px[x, y][3])) for y in range(s - 1, -1, -1))
    stride = ((s + 31) // 32) * 4
    andmask = bytes(stride * s)
    return struct.pack('<IiiHHIIiiII', 40, s, s * 2, 1, 32, 0, len(rows) + len(andmask), 0, 0, 0, 0) + rows + andmask

def write_ico(path, sizes):
    blobs = []
    for s in sizes:
        im = icon(s)
        if s >= 256: b = io.BytesIO(); im.save(b, 'PNG'); blobs.append((s, b.getvalue()))
        else: blobs.append((s, dib(im)))
    head = struct.pack('<HHH', 0, 1, len(blobs)); off = 6 + 16 * len(blobs); ents = b''
    for s, data in blobs:
        ents += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(data), off); off += len(data)
    open(path, 'wb').write(head + ents + b''.join(d for _, d in blobs))

def svg():
    c = 22; s = 512; x0 = (s - W * c) // 2; y0 = (s - (H + 1) * c) // 2
    cells = lambda dy, fill: ''.join(f'<rect x="{x0 + x * c}" y="{y0 + (y + dy) * c}" width="{c}" height="{c}" fill="{fill(ch)}"/>' for y, row in enumerate(ROWS) for x, ch in enumerate(row) if ch != '.')
    hexc = lambda ch: '#%02x%02x%02x' % COL[ch]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" shape-rendering="crispEdges">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1d6e"/><stop offset="1" stop-color="#15092b"/></linearGradient></defs>
 <rect width="512" height="512" rx="116" fill="url(#bg)" shape-rendering="geometricPrecision"/>
 <g opacity=".4">{cells(1, lambda ch: '#000')}</g>
 {cells(0, hexc)}
</svg>
'''

if __name__ == '__main__':
    icon(512).save(os.path.join(ROOT, 'assets', 'icon.png'))
    write_ico(os.path.join(ROOT, 'assets', 'icon.ico'), [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128, 256])
    open(os.path.join(ROOT, 'assets', 'logo.svg'), 'w').write(svg())
    for s in (16, 24, 32, 48, 256): print(s, 'клетка', cell_for(s))
