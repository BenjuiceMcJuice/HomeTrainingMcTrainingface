"""
BetaLog pixel-art icon engine.

A tiny software rasteriser for authoring 48x48 sprites out of hard-edged
square pixels. No anti-aliasing, transparent background, limited palette,
per-material 1px dark outlines and simple top-left light / bottom-right
shadow.

Colours are RGBA tuples. Transparent is (0, 0, 0, 0).
"""

from PIL import Image

GRID = 48
T = (0, 0, 0, 0)


def hx(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


# ----------------------------------------------------------------------------
# Palette
# ----------------------------------------------------------------------------
# skin
SKIN      = hx("F2B184")
SKIN_HI   = hx("FAD2AC")
SKIN_LO   = hx("C67E4E")
SKIN_OUT  = hx("74482A")
# chalk white
WHITE     = hx("FDF5E8")
WHITE_LO  = hx("D9CDBB")
# wood / holds
WOOD      = hx("6E4E32")
WOOD_HI   = hx("96745C")
WOOD_LO   = hx("513824")
WOOD_OUT  = hx("2E2013")
# rock grey / metal
GREY      = hx("8A8FA3")
GREY_HI   = hx("B4B9C9")
GREY_LO   = hx("5E6478")
GREY_OUT  = hx("30354A")
# accents
ORANGE    = hx("FF7A2F")
ORANGE_HI = hx("FF9E63")
ORANGE_LO = hx("D8551A")
YELLOW    = hx("FFD24A")
YELLOW_HI = hx("FFE79A")
YELLOW_LO = hx("D9A521")
# greyed-out (unused fingers)
MUTE      = hx("6B7186")
MUTE_HI   = hx("878CA0")
MUTE_LO   = hx("4C5266")
MUTE_OUT  = hx("2C3044")

# generic dark outline, kept lighter than the #12141F slate so silhouettes read
DARK_OUT  = hx("232840")

# material -> outline colour, and outline priority (lower = wins when neighbours conflict)
FILL_OUTLINE = {
    SKIN: SKIN_OUT, SKIN_HI: SKIN_OUT, SKIN_LO: SKIN_OUT,
    WOOD: WOOD_OUT, WOOD_HI: WOOD_OUT, WOOD_LO: WOOD_OUT,
    GREY: GREY_OUT, GREY_HI: GREY_OUT, GREY_LO: GREY_OUT,
    WHITE: GREY_OUT, WHITE_LO: GREY_OUT,
    ORANGE: ORANGE_LO, ORANGE_HI: ORANGE_LO, ORANGE_LO: WOOD_OUT,
    YELLOW: YELLOW_LO, YELLOW_HI: YELLOW_LO, YELLOW_LO: WOOD_OUT,
    MUTE: MUTE_OUT, MUTE_HI: MUTE_OUT, MUTE_LO: MUTE_OUT,
}
PRIORITY = [SKIN_OUT, WOOD_OUT, MUTE_OUT, GREY_OUT, ORANGE_LO, YELLOW_LO, WOOD_OUT, DARK_OUT]


class Sprite:
    def __init__(self, size=GRID):
        self.n = size
        self.buf = [[T for _ in range(size)] for _ in range(size)]

    # -- primitives ---------------------------------------------------------
    def px(self, x, y, c):
        x = int(round(x)); y = int(round(y))
        if 0 <= x < self.n and 0 <= y < self.n and c is not None:
            self.buf[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.n and 0 <= y < self.n:
            return self.buf[y][x]
        return T

    def rect(self, x0, y0, x1, y1, c):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.px(x, y, c)

    def hline(self, x0, x1, y, c):
        if x1 < x0: x0, x1 = x1, x0
        for x in range(int(x0), int(x1) + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        if y1 < y0: y0, y1 = y1, y0
        for y in range(int(y0), int(y1) + 1):
            self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx = abs(x1 - x0); dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.35:
                    self.px(x, y, c)

    def ring(self, cx, cy, r, c):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if (r - 1.1) ** 2 <= d <= r * r + r * 0.35:
                    self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05:
                    self.px(x, y, c)

    def replace(self, a, b):
        for y in range(self.n):
            for x in range(self.n):
                if self.buf[y][x] == a:
                    self.buf[y][x] = b

    # rounded rect: filled block with the four hard corner pixels knocked out
    def rrect(self, x0, y0, x1, y1, c, corner=1):
        self.rect(x0, y0, x1, y1, c)
        for dx in range(corner):
            for dy in range(corner):
                if dx + dy < corner:
                    self.px(x0 + dx, y0 + dy, T)
                    self.px(x1 - dx, y0 + dy, T)
                    self.px(x0 + dx, y1 - dy, T)
                    self.px(x1 - dx, y1 - dy, T)

    # -- shading helpers ----------------------------------------------------
    def shade_block(self, x0, y0, x1, y1, base, hi, lo):
        """Fill a block, light top+left inner edge, shadow bottom+right."""
        self.rect(x0, y0, x1, y1, base)
        self.hline(x0, x1, y0, hi)
        self.vline(x0, y0, y1, hi)
        self.hline(x0, x1, y1, lo)
        self.vline(x1, y0, y1, lo)

    # -- outline ------------------------------------------------------------
    def outline(self):
        snap = [row[:] for row in self.buf]
        adds = {}
        for y in range(self.n):
            for x in range(self.n):
                if snap[y][x] != T:
                    continue
                best = None
                for (nx, ny) in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1),
                                 (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1)):
                    if 0 <= nx < self.n and 0 <= ny < self.n:
                        nb = snap[ny][nx]
                        if nb != T:
                            oc = FILL_OUTLINE.get(nb, DARK_OUT)
                            if best is None or PRIORITY.index(oc) < PRIORITY.index(best):
                                best = oc
                if best is not None:
                    adds[(x, y)] = best
        for (x, y), c in adds.items():
            self.buf[y][x] = c

    # -- authored pixel maps ------------------------------------------------
    def stamp_map(self, ox, oy, rows, legend):
        """Blit an authored pixel map (list of equal-length strings)."""
        for j, line in enumerate(rows):
            for i, ch in enumerate(line):
                c = legend.get(ch)
                if c is not None:
                    self.px(ox + i, oy + j, c)

    # -- export -------------------------------------------------------------
    def image(self, scale=1):
        img = Image.new("RGBA", (self.n, self.n), T)
        px = img.load()
        for y in range(self.n):
            for x in range(self.n):
                px[x, y] = self.buf[y][x]
        if scale != 1:
            img = img.resize((self.n * scale, self.n * scale), Image.NEAREST)
        return img
