# ShowCube-Logos als SVG neu erzeugen: docs/brand/logo/*.svg (Zeichen, Logo quer, gestapelt, einfarbig).
# Die Wortmarke wird aus der Schrift im Repo (assets/fonts, Bricolage Grotesque) zu Pfaden, damit die Dateien
# überall ohne Schrift funktionieren. Regeln und Maße: docs/brand/README.md
#
#   pip install fonttools brotli uharfbuzz
#   python3 scripts/marke-logos.py
#   node scripts/marke-png.mjs        # danach die PNGs in docs/brand/logo/png/
import sys, os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont
import io

repo = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = os.path.join(repo, 'docs/brand/logo')
os.makedirs(out, exist_ok=True)

font_path = os.path.join(repo, 'assets/fonts/bricolage-grotesque-latin-opsz-normal.woff2')
LOC = {'wght': 800, 'opsz': 24}
vf = TTFont(font_path)
inst = instantiateVariableFont(vf, LOC)
inst.flavor = None
buf = io.BytesIO(); inst.save(buf); data = buf.getvalue()
upem = inst['head'].unitsPerEm
cap = inst['OS/2'].sCapHeight

face = hb.Face(data); hbfont = hb.Font(face)
b = hb.Buffer(); b.add_str('ShowCube'); b.guess_segment_properties()
hb.shape(hbfont, b, {})
gs = inst.getGlyphSet()
order = inst.getGlyphOrder()
TRACK = -0.02 * upem

def wortmarke(size, x0, baseline):
    """Pfad der Wortmarke, Schriftgröße size, Start x0, Grundlinie baseline."""
    s = size / upem
    pen = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    x = 0
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        name = order[info.codepoint]
        t = TransformPen(pen, (s, 0, 0, -s, x0 + (x + pos.x_offset) * s, baseline - pos.y_offset * s))
        gs[name].draw(t)
        x += pos.x_advance + TRACK
    return pen.getCommands(), (x - TRACK) * s

# Zeichen (Bildmarke) auf 100er-Raster: Würfel 100, Ecke 26,7 %, Innenquadrat 36 mittig, Ecke 10
R_OUT, IN, R_IN = 26.67, 36, 10
I0 = (100 - IN) / 2

def zeichen(variante, ox=0, oy=0, k=1, uid='a'):
    """variante: 'farbe' (ShowCube-Grün, UI), 'verlauf' (groß, App/Vorschaltseite), 'mint' (auf Dunkel),
    'schwarz'/'weiss' (einfarbig, Innenquadrat ausgespart)."""
    def r(x, y, w, h, rr):
        return f'x="{ox + x*k:.2f}" y="{oy + y*k:.2f}" width="{w*k:.2f}" height="{h*k:.2f}" rx="{rr*k:.2f}"'
    if variante in ('schwarz', 'weiss'):
        c = '#14181a' if variante == 'schwarz' else '#ffffff'
        # Außen minus Innen als ein Pfad (evenodd)
        def rr_path(x, y, w, h, rad):
            x, y, w, h, rad = ox + x*k, oy + y*k, w*k, h*k, rad*k
            return (f'M{x+rad:.2f} {y:.2f}H{x+w-rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x+w:.2f} {y+rad:.2f}V{y+h-rad:.2f}'
                    f'A{rad:.2f} {rad:.2f} 0 0 1 {x+w-rad:.2f} {y+h:.2f}H{x+rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x:.2f} {y+h-rad:.2f}'
                    f'V{y+rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x+rad:.2f} {y:.2f}Z')
        return '', f'<path fill="{c}" fill-rule="evenodd" d="{rr_path(0,0,100,100,R_OUT)}{rr_path(I0,I0,IN,IN,R_IN)}"/>'
    defs = f'<clipPath id="w{uid}"><rect {r(0,0,100,100,R_OUT)}/></clipPath>'
    if variante == 'verlauf':
        defs += (f'<linearGradient id="g{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e8a75"/>'
                 f'<stop offset="1" stop-color="#096555"/></linearGradient>')
        fill, innen, schatten = f'url(#g{uid})', '#ffffff', 'rgba(6,63,53,.35)'
    elif variante == 'mint':
        fill, innen, schatten = '#46c9b0', '#0b1312', None
    else:
        fill, innen, schatten = '#0b7a67', '#ffffff', None
    body = f'<rect {r(0,0,100,100,R_OUT)} fill="{fill}"/>'
    # untere Kante etwas dunkler: der Würfel steht auf dem Tisch
    body += f'<rect clip-path="url(#w{uid})" x="{ox:.2f}" y="{oy+90*k:.2f}" width="{100*k:.2f}" height="{10*k:.2f}" fill="#000" fill-opacity=".18"/>'
    if schatten:
        body += f'<rect {r(I0, I0+2.7, IN, IN, R_IN)} fill="{schatten}"/>'
    body += f'<rect {r(I0,I0,IN,IN,R_IN)} fill="{innen}"/>'
    return defs, body

def svg(w, h, defs, body, titel):
    d = f'<defs>{defs}</defs>' if defs else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.0f}" height="{h:.0f}" role="img">'
            f'<title>{titel}</title>{d}{body}</svg>\n')

def speichern(name, inhalt):
    with open(os.path.join(out, name), 'w') as f: f.write(inhalt)

# Bildmarken
for v, name in [('farbe', 'showcube-zeichen.svg'), ('verlauf', 'showcube-zeichen-verlauf.svg'), ('mint', 'showcube-zeichen-mint.svg'),
                ('schwarz', 'showcube-zeichen-schwarz.svg'), ('weiss', 'showcube-zeichen-weiss.svg')]:
    d, bd = zeichen(v, uid='z')
    speichern(name, svg(100, 100, d, bd, 'ShowCube'))

# Logo quer: Zeichen 100 + Abstand 33,3 + Wortmarke 73,3 (wie im Kopf der Startseite: 30 px Würfel, 10 px Abstand, 22 px Schrift)
SIZE, GAP = 73.33, 33.33
baseline = 50 + cap * SIZE / upem / 2
_, breite = wortmarke(SIZE, 0, 0)
W = 100 + GAP + breite
for v, txt, name in [('farbe', '#14181a', 'showcube-logo.svg'), ('mint', '#e9efed', 'showcube-logo-dunkel.svg'),
                     ('verlauf', '#ffffff', 'showcube-logo-verlauf-weiss.svg'),
                     ('schwarz', '#14181a', 'showcube-logo-schwarz.svg'), ('weiss', '#ffffff', 'showcube-logo-weiss.svg')]:
    d, bd = zeichen(v, uid='l')
    p, _ = wortmarke(SIZE, 100 + GAP, baseline)
    speichern(name, svg(W, 100, d, bd + f'<path fill="{txt}" d="{p}"/>', 'ShowCube'))

# Logo gestapelt (wie auf der Vorschaltseite): Zeichen oben, Wortmarke, Claim
SIZE2 = 64 * 100 / 184 * 1.0  # Verhältnis der Vorschaltseite: Würfel 184 px, Name 64 px
_, b2 = wortmarke(SIZE2, 0, 0)
H2 = 100 + 16 + SIZE2 * 0.95
W2 = max(100, b2)
for v, txt, name in [('verlauf', '#14181a', 'showcube-logo-gestapelt.svg'), ('verlauf', '#ffffff', 'showcube-logo-gestapelt-weiss.svg')]:
    d, bd = zeichen(v, ox=(W2 - 100) / 2, uid='s')
    p, _ = wortmarke(SIZE2, (W2 - b2) / 2, 100 + 16 + cap * SIZE2 / upem)
    speichern(name, svg(W2, 100 + 16 + cap * SIZE2 / upem + 2, d, bd + f'<path fill="{txt}" d="{p}"/>', 'ShowCube'))

print('Breite Logo quer', W, 'Kapitälchenhöhe', cap)
