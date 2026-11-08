"""Draws the Jetty letterhead used by the app.

Run from the project folder:   python3 tools/make_letterhead.py
Writes assets/brand/letterhead.png (A4, 300 dpi). Edit COMPANY below to change details.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/brand/letterhead.png"
OUT_JPG = ROOT / "assets/brand/letterhead.jpg"  # used by the app (fast to embed in PDFs)
LOGO = ROOT / "assets/brand/jetty-logo.png"
MONT = str(ROOT / "tools/fonts/Montserrat.ttf")
LORA = str(ROOT / "tools/fonts/Lora-Italic.ttf")

COMPANY = {
    "name": "JETTY GLOBAL RESOURCES LIMITED",
    "tagline": "Specialist in all kinds of Painting, POP, Screeding, Taroline, etc.",
    "rc": "RC: 143474",
    "address": "No. 15 Thomas Gberindyer Street, Beside JAMB Zonal Office, Makurdi, Benue State",
    "phone": "08061231036, 07029768812",
    "email": "revasen80@gmail.com",
    "bank": [("Bank:", "Fidelity Bank"), ("Account No:", "5601384114"), ("Account Name:", "Jetty Global Resources Ltd")],
}

NAVY = (15, 61, 110)
GOLD = (232, 160, 32)
INK = (40, 48, 60)
WHITE = (255, 255, 255)

DPI = 300
P = DPI / 25.4            # pixels per mm
W, H = round(210 * P), round(297 * P)
mm = lambda v: round(v * P)
pt = lambda v: round(v * DPI / 72)


def font(path, size_pt, weight=None):
    f = ImageFont.truetype(path, pt(size_pt))
    if weight:
        f.set_variation_by_name(weight)
    return f


def runs_width(runs):
    return sum(f.getlength(t) for t, f, _ in runs)


def draw_runs(d, x, y, runs):
    for t, f, c in runs:
        d.text((x, y), t, font=f, fill=c, anchor="ls")
        x += f.getlength(t)


def tracked(d, x, y, text, f, fill, track):
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill, anchor="ls")
        x += f.getlength(ch) + track
    return x


def tracked_width(text, f, track):
    return sum(f.getlength(ch) for ch in text) + track * (len(text) - 1)


def main():
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    logo = Image.open(LOGO).convert("RGBA")

    # Watermark: faint logo in the middle of the page.
    wm_w = mm(115)
    wm = logo.resize((wm_w, round(logo.height * wm_w / logo.width)), Image.LANCZOS)
    alpha = wm.getchannel("A").point(lambda a: a * 0.06)
    wm.putalpha(alpha)
    img.paste(wm, ((W - wm.width) // 2, mm(160) - wm.height // 2), wm)

    # ---- Header ---------------------------------------------------------
    band_h, stripe = mm(31), mm(1.4)
    d.rectangle([0, 0, W, band_h], fill=NAVY)
    d.rectangle([0, band_h, W, band_h + stripe], fill=GOLD)

    # Logo badge overlapping the band
    cx, cy, r = mm(31), mm(21), mm(17)
    d.ellipse([cx - r - mm(0.9), cy - r - mm(0.9), cx + r + mm(0.9), cy + r + mm(0.9)], fill=GOLD)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    lw = mm(27)
    lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(lg, (cx - lg.width // 2, cy - lg.height // 2), lg)

    left, right = mm(55), W - mm(14)
    avail = right - left

    # Company name, sized to fill the line
    track = mm(0.45)
    size = 30.0
    while size > 10:
        f_name = font(MONT, size, "ExtraBold")
        if tracked_width(COMPANY["name"], f_name, track) <= avail:
            break
        size -= 0.25
    tracked(d, left, mm(15.5), COMPANY["name"], f_name, WHITE, track)

    # Tagline
    f_tag = font(LORA, 11.5, "Medium Italic")
    while f_tag.getlength(COMPANY["tagline"]) > avail:
        f_tag = font(LORA, f_tag.size * 72 / DPI - 0.25, "Medium Italic")
    d.text((left, mm(25)), COMPANY["tagline"], font=f_tag, fill=GOLD, anchor="ls")

    # Contact lines under the stripe
    f_lbl = font(MONT, 6.6, "Bold")
    f_val = font(MONT, 7.6, "Medium")
    gap = "   "
    line1 = [("ADDRESS  ", f_lbl, GOLD), (COMPANY["address"], f_val, INK)]
    line2 = [("TEL  ", f_lbl, GOLD), (COMPANY["phone"], f_val, INK), (gap + "   ", f_val, INK),
             ("EMAIL  ", f_lbl, GOLD), (COMPANY["email"], f_val, INK)]
    while runs_width(line1) > avail:  # shrink if address is long
        f_val = font(MONT, f_val.size * 72 / DPI - 0.2, "Medium")
        line1[1] = (COMPANY["address"], f_val, INK)
        line2 = [(t, f_val if ff is not f_lbl else ff, c) for t, ff, c in line2]
    draw_runs(d, left, mm(38.2), line1)
    draw_runs(d, left, mm(43), line2)

    # RC number under the badge
    f_rc = font(MONT, 8, "Bold")
    d.text((cx, mm(43)), COMPANY["rc"], font=f_rc, fill=NAVY, anchor="ms")

    # Fine rule closing the header
    d.rectangle([mm(14), mm(46.5), W - mm(14), mm(46.5) + max(2, mm(0.25))], fill=(200, 210, 222))

    # ---- Footer ---------------------------------------------------------
    top = H - mm(15)
    d.rectangle([0, top - mm(1.2), W, top], fill=GOLD)
    d.rectangle([0, top, W, H], fill=NAVY)
    f_bl = font(MONT, 7.4, "Bold")
    f_bv = font(MONT, 7.6, "Medium")
    runs = []
    for i, (label, value) in enumerate(COMPANY["bank"]):
        if i:
            runs.append(("     |     ", f_bv, (120, 150, 185)))
        runs += [(label + " ", f_bl, GOLD), (value, f_bv, WHITE)]
    draw_runs(d, (W - runs_width(runs)) / 2, top + mm(8.6), runs)

    img.save(OUT, optimize=True, dpi=(DPI, DPI))
    img.save(OUT_JPG, quality=90, subsampling=0, optimize=True, dpi=(DPI, DPI))
    print(f"Wrote {OUT.relative_to(ROOT)} and {OUT_JPG.relative_to(ROOT)} ({W}x{H})")


if __name__ == "__main__":
    main()
