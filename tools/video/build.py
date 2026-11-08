"""Build the narrated tutorial video from shots/ (see capture.py)."""
import json, os, subprocess, wave
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = '/Users/lumun/Development/Jetty_mobile'
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MONT = f'{PROJ}/tools/fonts/Montserrat.ttf'
LOGO = f'{PROJ}/assets/brand/jetty-logo.png'
VOICE, RATE = 'Daniel', '158'

NAVY, GOLD, BG, INK = (15, 61, 110), (232, 160, 32), (238, 242, 247), (27, 36, 48)
VW, VH = 1080, 1920

SCENES = [
    ('title', None, None,
     "Good day, sir. This short video shows you how to write a letter, or a quotation, on the Jetty letterhead, using the Jetty Letters app on your phone."),
    ('02_open', 'Open the app', 'Tap  New letter  to start a fresh letter',
     "Tap the Jetty Letters icon on your phone to open the app. The letter form appears. Whenever you want to start a fresh letter, tap New letter, at the top right."),
    ('03_details', 'Step 1  ·  Letter details', 'Fill in the reference, who the letter is to, and their address',
     "Step one is the letter details. Today's date is filled in for you. Type a reference number if you have one. Then type who the letter is going to, and their address."),
    ('04_subject', 'Step 1  ·  Subject', 'Type the subject and your opening paragraph',
     "Next, type the subject of the letter, and your opening paragraph. For example: we are pleased to forward our quotation, as detailed below."),
    ('05_items', 'Step 2  ·  Items & prices', 'Choose the currency, then type each item, its quantity and price',
     "Step two is the items and prices. First, choose the currency: Naira, Dollar, or Euro. Then, for each item, type what it is, the quantity, and the price for one. The app works out the subtotal for you."),
    ('06_more', 'Step 2  ·  More items', 'Tap  + Add another item  for more.  Remove  takes one out',
     "To add another item, tap: Add another item. If you make a mistake, tap Remove, to take that item out."),
    ('07_totals', 'Step 2  ·  Tax & total', 'Choose VAT 7.5% if needed. The total is also written in words',
     "Below the items, you will see the totals. If the job carries VAT, change Tax to: VAT, seven point five percent. The VAT is added to the grand total, and the amount is written out in words."),
    ('08_closing', 'Step 3  ·  Closing & signature', 'Choose the closing line and who is signing',
     "Step three. Choose a closing line, such as: Thank you for your patronage. You can also pick: Write my own. Then choose who is signing the letter. Doctor Isaiah Asen is already selected."),
    ('09_preview', 'Preview your letter', 'Tap  Preview letter.  Check it.  Back to edit  to make changes',
     "When you have finished, tap Preview letter, at the bottom of the screen. Your letter appears on the Jetty letterhead. Read through it. If anything needs changing, tap Back to edit."),
    ('10_share', 'Send or save', 'Share  sends it by WhatsApp or Email.  Save PDF  keeps a copy',
     "To send the letter, tap Share, and choose WhatsApp, or Email. Or tap Save PDF, to keep a copy on your phone, ready for printing."),
    ('11_past', 'Past letters', 'Tap a letter to open it, or  Copy  to reuse it',
     "Every letter you preview is kept under Past letters. Tap a letter to open it again and make changes. Or tap Copy, to use an old quotation as the start of a new one."),
    ('12_backup', 'Backup on all your devices', 'Tap  Turn on backup  once on each device',
     "To see your letters on your phone, your tablet, and your computer, turn on backup. Open Past letters, tap: Turn on backup, and sign in with your Google account. Do this once on each device."),
    ('outro', 'Your letter is ready', 'Ready to send on the Jetty letterhead',
     "That is all. Your letter is ready, neatly laid out on the Jetty letterhead. Thank you, sir."),
]


def font(size, weight='Bold'):
    f = ImageFont.truetype(MONT, size)
    f.set_variation_by_name(weight)
    return f


def wrap(d, text, f, width):
    words, lines, cur = text.split(' '), [], ''
    for w in words:
        t = (cur + ' ' + w).strip() if w else cur + ' '
        if d.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur.strip()); cur = w
    lines.append(cur.strip())
    return lines


def paste_logo(img, cx, cy, width):
    logo = Image.open(LOGO).convert('RGBA')
    lg = logo.resize((width, round(logo.height * width / logo.width)), Image.LANCZOS)
    img.paste(lg, (cx - lg.width // 2, cy - lg.height // 2), lg)


def base(title, caption):
    img = Image.new('RGB', (VW, VH), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, VW, 200], fill=NAVY)
    d.rectangle([0, 200, VW, 208], fill=GOLD)
    d.ellipse([40, 46, 148, 154], fill='white')
    paste_logo(img, 94, 100, 80)
    d.text((176, 66), 'JETTY LETTERS', font=font(26, 'Bold'), fill=GOLD)
    f_t = font(46, 'ExtraBold')
    while d.textlength(title, font=f_t) > VW - 210:
        f_t = font(f_t.size - 2, 'ExtraBold')
    d.text((176, 104), title, font=f_t, fill='white')
    # caption panel
    d.rounded_rectangle([40, 1632, VW - 40, 1880], radius=28, fill='white')
    f_c = font(44, 'SemiBold')
    lines = wrap(d, caption, f_c, VW - 150)
    y = 1756 - len(lines) * 30
    for ln in lines:
        d.text((VW // 2, y), ln, font=f_c, fill=INK, anchor='ma')
        y += 60
    return img, d


def phone_frame(img, shot, boxes, highlight):
    ph = 1360
    s = ph / shot.height
    pw = round(shot.width * s)
    sc = shot.resize((pw, ph), Image.LANCZOS)
    if highlight:
        dd = ImageDraw.Draw(sc)
        for x, y, w, h in boxes:
            x, y, w, h = x * s, y * s, w * s, h * s
            dd.rounded_rectangle([x - 7, y - 7, x + w + 7, y + h + 7], radius=16, outline=GOLD, width=7)
    x0, y0 = (VW - pw) // 2, 240
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0 - 16, y0 - 16, x0 + pw + 16, y0 + ph + 16], radius=46, fill=(20, 24, 30))
    mask = Image.new('L', sc.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, ph], radius=32, fill=255)
    img.paste(sc, (x0, y0), mask)


def title_card():
    img = Image.new('RGB', (VW, VH), NAVY)
    d = ImageDraw.Draw(img)
    d.ellipse([VW // 2 - 190, 470, VW // 2 + 190, 850], fill='white', outline=GOLD, width=12)
    paste_logo(img, VW // 2, 660, 270)
    d.text((VW // 2, 960), 'Jetty Letters', font=font(96, 'ExtraBold'), fill='white', anchor='ma')
    d.rectangle([VW // 2 - 90, 1090, VW // 2 + 90, 1098], fill=GOLD)
    for i, ln in enumerate(['How to write a letter or', 'quotation on the letterhead']):
        d.text((VW // 2, 1140 + i * 66), ln, font=font(50, 'Medium'), fill=(220, 230, 242), anchor='ma')
    d.text((VW // 2, 1720), 'JETTY GLOBAL RESOURCES LIMITED', font=font(30, 'Bold'), fill=GOLD, anchor='ma')
    return img


def outro_card(caption, title):
    img, d = base(title, caption)
    page = Image.open(os.path.join(HERE, 'letter_page.png')).convert('RGB')
    ph = 1340
    pw = round(page.width * ph / page.height)
    page = page.resize((pw, ph), Image.LANCZOS)
    x0 = (VW - pw) // 2
    d.rectangle([x0 + 10, 250 + 10, x0 + pw + 10, 250 + ph + 10], fill=(200, 208, 218))
    img.paste(page, (x0, 250))
    return img


def say(text, path):
    subprocess.run(['say', '-v', VOICE, '-r', RATE, '-o', path, '--data-format=LEI16@22050', text], check=True)
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


# Render the finished letter's first page for the outro (vector-rendered by Quick Look).
subprocess.run(['qlmanage', '-t', '-s', '2000', '-o', HERE, os.path.join(HERE, 'letter.pdf')],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
os.replace(os.path.join(HERE, 'letter.pdf.png'), os.path.join(HERE, 'letter_page.png'))

meta = {s['name']: s['boxes'] for s in json.load(open(os.path.join(HERE, 'shots', 'scenes.json')))}
LEAD, TAIL, HL_AT = 0.5, 0.9, 0.7
concat, audio_parts = [], []

for i, (name, title, caption, text) in enumerate(SCENES):
    wav = os.path.join(OUT, f'{i:02d}.wav')
    dur = LEAD + say(text, wav) + TAIL
    audio_parts.append((wav, dur))
    if name == 'title':
        frames = [(title_card(), dur)]
    elif name == 'outro':
        frames = [(outro_card(caption, title), dur)]
    else:
        shot = Image.open(os.path.join(HERE, 'shots', name + '.png')).convert('RGB')
        plain, _ = base(title, caption); phone_frame(plain, shot, meta[name], False)
        lit, _ = base(title, caption); phone_frame(lit, shot, meta[name], True)
        frames = [(plain, HL_AT), (lit, dur - HL_AT)]
    for j, (im, d) in enumerate(frames):
        p = os.path.join(OUT, f'f{i:02d}_{j}.png')
        im.save(p)
        concat.append((p, d))
    print(f'{name}: {dur:.1f}s')

with open(os.path.join(OUT, 'frames.txt'), 'w') as f:
    for p, d in concat:
        f.write(f"file '{p}'\nduration {d:.3f}\n")
    f.write(f"file '{concat[-1][0]}'\n")

# Narration track: each clip padded to its scene length.
with wave.open(os.path.join(OUT, 'voice.wav'), 'w') as out:
    out.setnchannels(1); out.setsampwidth(2); out.setframerate(22050)
    for wav, dur in audio_parts:
        with wave.open(wav) as w:
            frames = w.readframes(w.getnframes())
        lead = b'\0\0' * int(LEAD * 22050)
        total = int(dur * 22050)
        body = lead + frames
        out.writeframes(body + b'\0\0' * max(0, total - len(body) // 2))

final = os.path.join(HERE, 'Jetty_Letters_How_To.mp4')
subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(OUT, 'frames.txt'),
                '-i', os.path.join(OUT, 'voice.wav'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow',
                '-crf', '22', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-shortest',
                '-movflags', '+faststart', final], check=True)
print('wrote', final, round(sum(d for _, d in audio_parts), 1), 's')
