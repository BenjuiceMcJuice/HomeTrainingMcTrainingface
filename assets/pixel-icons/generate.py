"""Render every BetaLog sprite, plus a labelled contact-sheet grid."""

import os
from PIL import Image, ImageDraw, ImageFont
from engine import hx
from sprites import GROUP_A, GROUP_B, GROUP_C

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITES_DIR = os.path.join(HERE, "sprites")        # display size (5x = 240px)
NATIVE_DIR = os.path.join(HERE, "sprites-48")      # native 48px, for app use
os.makedirs(SPRITES_DIR, exist_ok=True)
os.makedirs(NATIVE_DIR, exist_ok=True)

# ---- layout config --------------------------------------------------------
SCALE = 5                     # 48 -> 240 px sprites
SPR = 48 * SCALE              # 240
CELL_W = 300
CELL_H = 300
COLS = 6
PAD = 40
BG = hx("12141F")[:3]
PANEL = hx("1B1E2C")[:3]
PANEL_EDGE = hx("2A2E42")[:3]
TEXT = hx("D7DBE8")[:3]
SUB = hx("878DA3")[:3]
ACCENT = hx("FF7A2F")[:3]

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
f_head = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), 34)
f_grp = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), 26)
f_lbl = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans.ttf"), 20)
f_sub = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans.ttf"), 18)


def ctext(d, cx, y, s, font, fill, anchor="ma"):
    d.text((cx, y), s, font=font, fill=fill, anchor=anchor)


groups = [
    ("GROUP A  ·  GRIP TYPES", "Side-on right hand curling over a horizontal edge", GROUP_A),
    ("GROUP B  ·  FINGER POSITIONS", "Top-down over a wooden edge — engaged vs. greyed-out", GROUP_B),
    ("GROUP C  ·  APP OBJECTS & ICONS", "Sessions, tools, stats, coach, social", GROUP_C),
]

# ---- measure canvas height ------------------------------------------------
def rows_for(n):
    return (n + COLS - 1) // COLS

header_h = 150
group_head_h = 90
y = header_h
for _, _, items in groups:
    y += group_head_h + rows_for(len(items)) * CELL_H + 30
total_h = y + 40
total_w = COLS * CELL_W + PAD * 2

canvas = Image.new("RGB", (total_w, total_h), BG)
d = ImageDraw.Draw(canvas)

# title bar
ctext(d, total_w // 2, 40, "BetaLog — Pixel Icon Set", f_head, TEXT)
ctext(d, total_w // 2, 90, "8/16-bit climbing sprites  ·  48×48  ·  shared palette", f_sub, SUB)
d.rectangle([PAD, 132, total_w - PAD, 135], fill=ACCENT)

# palette swatches row
sw = [("skin", "F2B184"), ("light", "FAD2AC"), ("shadow", "C67E4E"),
      ("chalk", "FDF5E8"), ("wood", "6E4E32"), ("wood hi", "96745C"),
      ("rock", "8A8FA3"), ("orange", "FF7A2F")]

def draw_cell(cx, cy, img, label):
    # panel
    px0, py0 = cx - CELL_W // 2 + 18, cy - 12
    px1, py1 = cx + CELL_W // 2 - 18, cy + SPR + 14
    d.rounded_rectangle([px0, py0, px1, py1], radius=16, fill=PANEL, outline=PANEL_EDGE, width=2)
    canvas.paste(img, (cx - SPR // 2, cy), img)
    ctext(d, cx, cy + SPR + 24, label, f_lbl, TEXT)


y = header_h
for gtitle, gsub, items in groups:
    # group header
    d.rectangle([PAD, y + 8, PAD + 8, y + 60], fill=ACCENT)
    d.text((PAD + 24, y + 6), gtitle, font=f_grp, fill=TEXT)
    d.text((PAD + 24, y + 44), gsub, font=f_sub, fill=SUB)
    y += group_head_h

    for i, (key, label, builder) in enumerate(items):
        spr = builder()
        img = spr.image(SCALE)
        img.save(os.path.join(SPRITES_DIR, key + ".png"))
        spr.image(1).save(os.path.join(NATIVE_DIR, key + ".png"))
        col = i % COLS
        row = i // COLS
        cx = PAD + col * CELL_W + CELL_W // 2
        cy = y + row * CELL_H + 20
        draw_cell(cx, cy, img, label)
    y += rows_for(len(items)) * CELL_H + 30

out = os.path.join(HERE, "betalog-pixel-icons.png")
canvas.save(out)
print("wrote", out, canvas.size)
print("sprites ->", SPRITES_DIR)
