"""BetaLog sprite definitions. Each builder returns a finished Sprite."""

from engine import (Sprite, T,
    SKIN, SKIN_HI, SKIN_LO, WHITE, WHITE_LO,
    WOOD, WOOD_HI, WOOD_LO, GREY, GREY_HI, GREY_LO,
    ORANGE, ORANGE_HI, ORANGE_LO, YELLOW, YELLOW_HI, YELLOW_LO,
    MUTE, MUTE_HI, MUTE_LO)


def thick(s, pts, rad, c):
    """Stamp a filled square of half-width rad along a polyline of points."""
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx = abs(x1 - x0); dy = abs(y1 - y0)
        steps = max(dx, dy, 1)
        for t in range(steps + 1):
            x = x0 + (x1 - x0) * t / steps
            y = y0 + (y1 - y0) * t / steps
            s.rect(round(x) - rad, round(y) - rad, round(x) + rad, round(y) + rad, c)


# ===========================================================================
# GROUP A - GRIP TYPES  (side-on right hand over a horizontal edge)
# ===========================================================================

def _edge(s):
    """Cross-section of a horizontal climbing edge; grippable face on the left."""
    s.shade_block(8, 27, 21, 41, WOOD, WOOD, WOOD_LO)
    # rounded top corners
    s.px(8, 27, T); s.px(21, 27, T)
    s.px(8, 41, T); s.px(21, 41, T)
    # the top lip you grip catches the light
    s.hline(9, 20, 27, WOOD_HI)
    s.px(9, 28, WOOD_HI)
    # grain on the front face
    s.hline(10, 19, 35, WOOD_LO)


def _forearm(s, top, bot):
    """Forearm entering horizontally from the right, tapering to the wrist."""
    s.shade_block(28, top, 47, bot, SKIN, SKIN_HI, SKIN_LO)
    s.px(28, top, T)


def _chalk(s, x0, y0, x1, y1):
    s.rect(x0, y0, x1, y1, WHITE)
    s.hline(x0, x1, y0, WHITE)


def _fingerband(s, pts, groove=True):
    thick(s, pts, 2, SKIN)
    # top-left highlight and a knuckle/finger groove down the middle
    hi = [(x - 1, y - 1) for (x, y) in pts]
    for i in range(len(hi) - 1):
        s.line(hi[i][0], hi[i][1], hi[i + 1][0], hi[i + 1][1], SKIN_HI)
    if groove:
        for i in range(len(pts) - 1):
            s.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], SKIN_LO)


def grip_drag():
    s = Sprite()
    _edge(s)
    _forearm(s, 15, 23)
    # low knuckle: back of the hand barely rises above the edge
    thick(s, [(30, 19), (26, 21), (23, 23)], 3, SKIN)
    # long, nearly-straight fingers draped low over the rounded edge and down the front
    _fingerband(s, [(23, 23), (18, 26), (13, 31), (11, 36)])
    # fingertip pad on the front face + chalk
    s.rect(9, 35, 12, 38, SKIN)
    _chalk(s, 9, 36, 11, 37)
    s.outline()
    return s


def grip_open():
    s = Sprite()
    _edge(s)
    _forearm(s, 14, 22)
    # gentle arch, mild knuckle
    thick(s, [(30, 18), (26, 19), (22, 21)], 3, SKIN)
    # fingers arch over the rounded edge, fingertips resting on the front
    _fingerband(s, [(22, 21), (18, 22), (14, 25), (12, 31)])
    s.rect(10, 30, 13, 33, SKIN)
    _chalk(s, 10, 31, 12, 32)
    s.outline()
    return s


def grip_halfcrimp():
    s = Sprite()
    _edge(s)
    _forearm(s, 13, 21)
    # raised knuckle ridge = the high point (bent ~90 at the PIP)
    thick(s, [(31, 17), (26, 16), (22, 16)], 3, SKIN)
    s.rect(17, 14, 23, 19, SKIN)                # knuckle block, high point
    s.hline(17, 23, 14, SKIN_HI)
    s.px(23, 18, SKIN_LO)
    # fingers turn over the top then drop straight down the front face
    _fingerband(s, [(19, 18), (15, 21), (14, 27), (14, 33)])
    s.rect(12, 32, 16, 36, SKIN)
    _chalk(s, 12, 33, 15, 34)
    s.outline()
    return s


def grip_fullcrimp():
    s = Sprite()
    _edge(s)
    _forearm(s, 13, 21)
    # knuckles stacked high
    thick(s, [(31, 17), (27, 15), (23, 14)], 3, SKIN)
    s.rect(18, 11, 24, 17, SKIN)               # high stacked knuckle
    s.hline(18, 24, 11, SKIN_HI)
    s.px(24, 16, SKIN_LO)
    # thumb wrapping over the top of the index finger
    s.rect(19, 8, 26, 12, SKIN)
    s.hline(19, 26, 8, SKIN_HI)
    s.px(26, 11, SKIN_LO)
    # steep front section, fingertip curled under the lip of the edge
    _fingerband(s, [(20, 16), (16, 20), (14, 26)])
    thick(s, [(14, 27), (15, 30), (18, 31)], 1, SKIN)   # tip hooks back under the lip
    _chalk(s, 15, 30, 18, 31)
    s.outline()
    return s


# ===========================================================================
# GROUP B - FINGER POSITIONS  (top-down over a wooden edge)
# ===========================================================================

F_CX = [15, 22, 29, 36]        # index, middle, ring, pinky centres
F_W = 2                        # half-width -> 5px fingers


def _handback(s):
    s.shade_block(11, 5, 40, 16, SKIN, SKIN_HI, SKIN_LO)
    s.px(11, 5, T); s.px(40, 5, T)


def _rung_topdown(s):
    s.shade_block(4, 26, 44, 35, WOOD, WOOD_HI, WOOD_LO)
    # a couple of grain lines
    s.hline(6, 42, 30, WOOD_LO)


def _finger(s, cx, engaged):
    x0, x1 = cx - F_W, cx + F_W
    if engaged:
        s.rect(x0, 14, x1, 41, SKIN)
        s.vline(x0, 14, 41, SKIN_HI)
        s.vline(x1, 14, 41, SKIN_LO)
        # rounded chalk tip
        s.rect(x0, 39, x1, 42, WHITE)
        s.px(x0, 42, T); s.px(x1, 42, T)
        s.hline(x0, x1, 39, WHITE_LO)
    else:
        # short, greyed-out stub that never reaches the edge
        s.rect(x0, 14, x1, 24, MUTE)
        s.vline(x0, 14, 24, MUTE_HI)
        s.vline(x1, 14, 24, MUTE_LO)
        s.px(x0, 24, T); s.px(x1, 24, T)


def _fingers_sprite(engaged, thumb=False):
    s = Sprite()
    _rung_topdown(s)
    _handback(s)
    for i in range(4):
        _finger(s, F_CX[i], engaged[i])
    if thumb:
        # opposing thumb pressing in from the lower left (side view)
        s.rect(2, 30, 12, 37, SKIN)
        s.hline(2, 12, 30, SKIN_HI)
        s.hline(2, 12, 37, SKIN_LO)
        s.px(2, 30, T); s.px(2, 37, T)
        s.rect(2, 31, 4, 36, WHITE)   # chalked thumb pad
    s.outline()
    return s


def fp_four():     return _fingers_sprite([1, 1, 1, 1])
def fp_front3():   return _fingers_sprite([1, 1, 1, 0])
def fp_back3():    return _fingers_sprite([0, 1, 1, 1])
def fp_front2():   return _fingers_sprite([1, 1, 0, 0])
def fp_middle2():  return _fingers_sprite([0, 1, 1, 0])
def fp_ringpinky():return _fingers_sprite([0, 0, 1, 1])
def fp_mono_index():  return _fingers_sprite([1, 0, 0, 0])
def fp_mono_middle(): return _fingers_sprite([0, 1, 0, 0])
def fp_mono_ring():   return _fingers_sprite([0, 0, 1, 0])
def fp_pinch():    return _fingers_sprite([1, 1, 1, 1], thumb=True)


# ===========================================================================
# GROUP C - APP OBJECTS / ICONS
# ===========================================================================

def obj_hangboard():
    s = Sprite()
    s.shade_block(5, 12, 42, 33, WOOD, WOOD_HI, WOOD_LO)
    s.px(5, 12, T); s.px(42, 12, T); s.px(5, 33, T); s.px(42, 33, T)
    # two round pockets
    s.disc(14, 20, 3, WOOD_LO); s.disc(14, 20, 2, WOOD_OUT_FIX())
    s.disc(33, 20, 3, WOOD_LO); s.disc(33, 20, 2, WOOD_OUT_FIX())
    # centre edge / rail
    s.rect(20, 16, 27, 24, WOOD_LO)
    s.hline(20, 27, 16, WOOD_HI)
    # angled sloper cuts along the bottom edge
    s.rect(8, 29, 18, 33, WOOD_LO)
    s.rect(29, 29, 39, 33, WOOD_LO)
    s.outline()
    return s


def WOOD_OUT_FIX():
    # darker pocket bottom
    return WOOD_LO


def obj_timer():
    s = Sprite()
    # top button + side lugs
    s.rect(22, 5, 26, 9, GREY); s.hline(22, 26, 5, GREY_HI)
    s.rect(11, 12, 14, 15, GREY_LO)
    s.rect(34, 12, 37, 15, GREY_LO)
    # body
    s.disc(24, 27, 15, GREY)
    s.ring(24, 27, 15, GREY_LO)
    s.disc(24, 27, 12, WHITE)
    # top-left light on the case
    s.line(15, 19, 12, 25, GREY_HI)
    # tick marks
    for a in (0, 90, 180, 270):
        pass
    s.px(24, 16, GREY_LO); s.px(24, 38, GREY_LO)
    s.px(13, 27, GREY_LO); s.px(35, 27, GREY_LO)
    # orange countdown hand
    s.line(24, 27, 31, 20, ORANGE)
    s.line(24, 27, 24, 19, ORANGE_LO)
    s.disc(24, 27, 1, ORANGE_LO)
    s.outline()
    return s


def obj_chalkbag():
    s = Sprite()
    # bag body (tan)
    s.shade_block(12, 18, 36, 40, WOOD_HI, hx_light(), WOOD)
    s.px(12, 18, T); s.px(36, 18, T)
    s.px(12, 40, T); s.px(36, 40, T)
    # drawstring rim
    s.rect(11, 15, 37, 19, WOOD)
    s.hline(11, 37, 15, WOOD_HI)
    # chalk puff spilling out of the opening
    s.disc(24, 15, 6, WHITE)
    s.disc(18, 16, 3, WHITE)
    s.disc(30, 16, 3, WHITE)
    s.px(24, 12, WHITE_LO)
    # side clip
    s.rect(35, 26, 39, 30, ORANGE)
    s.outline()
    return s


def hx_light():
    return SKIN_HI  # reuse a warm light for the tan bag


def obj_bouldering():
    s = Sprite()
    # crash pad
    s.shade_block(4, 34, 44, 42, ORANGE, ORANGE_HI, ORANGE_LO)
    s.hline(4, 44, 38, ORANGE_LO)
    # chunky boulder
    s.disc(24, 26, 13, GREY)
    s.rect(11, 26, 37, 34, GREY)
    s.line(12, 20, 16, 16, GREY_HI)   # light top-left
    s.rect(11, 32, 37, 34, GREY_LO)   # shadow base
    # colourful holds
    s.disc(18, 21, 2, ORANGE); s.px(18, 21, ORANGE_HI)
    s.disc(30, 24, 2, WOOD_HI)
    s.rect(24, 30, 27, 32, WHITE)
    s.outline()
    return s


def _wavy_rope(s, x, y0, y1, amp=2, col=ORANGE):
    pts = []
    yy = y0
    k = 0
    while yy <= y1:
        off = (amp if (k // 2) % 2 == 0 else -amp)
        pts.append((x + off, yy))
        yy += 3
        k += 1
    thick(s, pts, 1, col)
    # twist ticks
    for i in range(0, len(pts) - 1, 1):
        s.px(pts[i][0], pts[i][1], ORANGE_LO)


def obj_lead():
    s = Sprite()
    # rope feeding down into the quickdraw
    _wavy_rope(s, 16, 4, 22, amp=2)
    # top carabiner clipped to a bolt on the wall
    s.rect(30, 5, 40, 9, GREY_LO)                 # wall bolt hanger
    s.disc(35, 7, 1, GREY_HI)
    s.ellipse(30, 15, 4, 5, GREY); s.ellipse(30, 15, 2, 3, T)
    # dogbone sling
    s.rect(27, 19, 33, 29, ORANGE)
    s.hline(27, 33, 19, ORANGE_HI); s.hline(27, 33, 29, ORANGE_LO)
    s.vline(27, 19, 29, ORANGE_HI)
    # lower carabiner (the hero) holding the rope
    s.ellipse(24, 34, 7, 9, GREY)
    s.ellipse(24, 34, 4, 6, T)
    s.line(17, 30, 16, 38, GREY_HI)               # ring highlight
    s.line(30, 29, 31, 33, GREY_LO)               # gate
    # rope out the bottom of the lower carabiner
    _wavy_rope(s, 22, 42, 47, amp=2)
    s.outline()
    return s


def obj_toprope():
    s = Sprite()
    # anchor bar
    s.shade_block(10, 10, 38, 15, GREY, GREY_HI, GREY_LO)
    # carabiner on the anchor
    s.ring(24, 18, 4, GREY)
    # rope up over the anchor and down both sides
    for y in range(15, 40, 2):
        s.px(17, y, ORANGE); s.px(18, y + 1, ORANGE_LO)
        s.px(30, y, ORANGE); s.px(31, y + 1, ORANGE_LO)
    s.rect(16, 20, 18, 40, ORANGE)
    s.rect(30, 20, 32, 40, ORANGE)
    s.vline(16, 20, 40, ORANGE_HI)
    s.vline(30, 20, 40, ORANGE_HI)
    # rope crest over the top
    thick(s, [(17, 20), (20, 16), (24, 15), (28, 16), (31, 20)], 1, ORANGE)
    s.outline()
    return s


def obj_wall():
    s = Sprite()
    s.shade_block(7, 6, 41, 42, GREY, GREY_HI, GREY_LO)
    s.px(7, 6, T); s.px(41, 6, T); s.px(7, 42, T); s.px(41, 42, T)
    # panel seams
    s.line(24, 6, 24, 42, GREY_LO)
    s.line(7, 24, 41, 24, GREY_LO)
    # scattered coloured holds
    s.disc(15, 14, 2, ORANGE); s.px(15, 14, ORANGE_HI)
    s.disc(33, 13, 2, WOOD_HI)
    s.disc(16, 33, 2, WHITE)
    s.disc(32, 32, 3, ORANGE); s.px(31, 31, ORANGE_HI)
    s.disc(24, 20, 1, YELLOW)
    s.outline()
    return s


def obj_gym():
    s = Sprite()
    # dumbbell, horizontal
    s.rect(20, 22, 28, 26, GREY)              # handle
    s.hline(20, 28, 22, GREY_HI)
    s.shade_block(9, 16, 15, 32, GREY, GREY_HI, GREY_LO)   # left plates
    s.shade_block(33, 16, 39, 32, GREY, GREY_HI, GREY_LO)  # right plates
    s.rect(6, 20, 8, 28, GREY_LO)             # left inner collar
    s.rect(40, 20, 42, 28, GREY_LO)
    # orange grip wrap
    s.rect(22, 22, 26, 26, ORANGE)
    s.hline(22, 26, 22, ORANGE_HI)
    s.outline()
    return s


def obj_cardio():
    s = Sprite()
    # heart
    s.disc(18, 20, 6, ORANGE)
    s.disc(30, 20, 6, ORANGE)
    s.rect(12, 20, 36, 26, ORANGE)
    # point of the heart
    for i in range(12):
        s.hline(12 + i, 36 - i, 26 + i, ORANGE)
    s.disc(16, 17, 2, ORANGE_HI)   # light glint
    # pulse line across
    s.line(10, 24, 16, 24, WHITE)
    s.line(16, 24, 19, 18, WHITE)
    s.line(19, 18, 23, 30, WHITE)
    s.line(23, 30, 27, 24, WHITE)
    s.line(27, 24, 38, 24, WHITE)
    s.outline()
    return s


def obj_hydration():
    s = Sprite()
    # cap
    s.rect(20, 5, 28, 9, ORANGE); s.hline(20, 28, 5, ORANGE_HI)
    s.rect(21, 9, 27, 11, ORANGE_LO)
    # bottle body
    s.shade_block(17, 11, 31, 43, WHITE, WHITE, WHITE_LO)
    s.px(17, 11, T); s.px(31, 11, T); s.px(17, 43, T); s.px(31, 43, T)
    # water fill line
    s.rect(18, 26, 30, 42, GREY_HI)
    s.replace(GREY_HI, hx_water())
    s.hline(18, 30, 26, WHITE)
    # measure ticks
    s.hline(28, 30, 18, GREY_LO)
    s.hline(28, 30, 22, GREY_LO)
    s.outline()
    return s


def hx_water():
    return GREY_HI


def obj_bodyweight():
    s = Sprite()
    # scale slab
    s.shade_block(7, 20, 41, 40, GREY, GREY_HI, GREY_LO)
    s.px(7, 20, T); s.px(41, 20, T)
    # dial window
    s.disc(24, 30, 8, WHITE)
    s.ring(24, 30, 8, GREY_LO)
    # needle + ticks
    s.line(24, 30, 27, 24, ORANGE)
    s.disc(24, 30, 1, ORANGE_LO)
    for x in (18, 24, 30):
        s.px(x, 24, GREY_LO)
    # front feet
    s.rect(9, 40, 13, 42, GREY_LO)
    s.rect(35, 40, 39, 42, GREY_LO)
    s.outline()
    return s


def obj_grade():
    s = Sprite()
    # mountain
    for i in range(20):
        s.hline(24 - i, 24 + i, 40 - i, GREY)
    s.rect(4, 40, 44, 42, GREY_LO)
    # snow cap
    for i in range(7):
        s.hline(24 - i, 24 + i, 20 + i, WHITE)
    # left light face / right shadow
    for i in range(20):
        s.px(24 - i, 40 - i, GREY_HI)
        s.px(24 + i, 40 - i, GREY_LO)
    # summit flag
    s.vline(24, 10, 21, WOOD)
    s.rect(25, 10, 31, 14, ORANGE); s.hline(25, 31, 10, ORANGE_HI)
    s.outline()
    return s


def obj_dashboard():
    s = Sprite()
    # axis
    s.rect(8, 8, 10, 40, GREY_LO)
    s.rect(8, 38, 40, 40, GREY_LO)
    # bars
    s.shade_block(13, 28, 18, 37, GREY, GREY_HI, GREY_LO)
    s.shade_block(21, 20, 26, 37, ORANGE, ORANGE_HI, ORANGE_LO)
    s.shade_block(29, 13, 34, 37, GREY, GREY_HI, GREY_LO)
    # trend dot on top of the tallest
    s.disc(31, 11, 1, WHITE)
    s.outline()
    return s


def obj_schedule():
    s = Sprite()
    # calendar body
    s.shade_block(8, 10, 40, 42, WHITE, WHITE, WHITE_LO)
    s.px(8, 10, T); s.px(40, 10, T); s.px(8, 42, T); s.px(40, 42, T)
    # header
    s.rect(8, 10, 40, 18, ORANGE); s.hline(8, 40, 10, ORANGE_HI)
    s.px(8, 10, T); s.px(40, 10, T)
    # binding rings
    s.rect(15, 6, 17, 12, GREY); s.rect(31, 6, 33, 12, GREY)
    # grid of day cells
    for gy in (23, 30, 37):
        for gx in (13, 21, 29, 37):
            s.rect(gx, gy, gx + 3, gy + 3, GREY_HI)
    s.outline()
    return s


def obj_history():
    s = Sprite()
    s.shade_block(8, 10, 40, 42, WHITE, WHITE, WHITE_LO)
    s.px(8, 10, T); s.px(40, 10, T); s.px(8, 42, T); s.px(40, 42, T)
    s.rect(8, 10, 40, 18, GREY); s.hline(8, 40, 10, GREY_HI)
    s.px(8, 10, T); s.px(40, 10, T)
    s.rect(15, 6, 17, 12, GREY_LO); s.rect(31, 6, 33, 12, GREY_LO)
    # faint rows
    for gy in (23, 30, 37):
        s.hline(13, 25, gy + 1, WHITE_LO)
    # big orange tick
    thick(s, [(16, 30), (22, 37), (34, 22)], 1, ORANGE)
    s.line(16, 30, 22, 37, ORANGE_HI)
    s.outline()
    return s


def _robot(mood="idle"):
    s = Sprite()
    # antenna
    s.vline(24, 4, 9, GREY_LO); s.disc(24, 4, 1, ORANGE)
    # head
    s.shade_block(11, 9, 37, 34, GREY, GREY_HI, GREY_LO)
    s.px(11, 9, T); s.px(37, 9, T); s.px(11, 34, T); s.px(37, 34, T)
    # screen face
    s.rect(14, 13, 34, 30, WOOD_OUT_FIX2())
    # ears
    s.rect(8, 17, 11, 25, GREY_LO); s.rect(37, 17, 40, 25, GREY_LO)
    if mood == "recovery":
        # closed, calm eyes + zzz
        s.hline(17, 22, 21, ORANGE); s.hline(26, 31, 21, ORANGE)
        s.px(33, 12, WHITE); s.px(35, 10, WHITE)
    elif mood == "plateau":
        s.rect(17, 18, 21, 22, ORANGE); s.rect(26, 18, 30, 22, ORANGE)
        s.hline(19, 29, 27, WHITE_LO)          # flat mouth
    elif mood == "projecting":
        # determined, angled brows
        s.rect(17, 19, 21, 23, ORANGE); s.rect(26, 19, 30, 23, ORANGE)
        s.line(16, 16, 21, 18, WHITE); s.line(31, 16, 26, 18, WHITE)
        s.hline(21, 27, 27, ORANGE_HI)         # open mouth
    else:  # idle / coach
        s.rect(17, 18, 21, 23, ORANGE); s.px(18, 19, ORANGE_HI)
        s.rect(26, 18, 30, 23, ORANGE); s.px(27, 19, ORANGE_HI)
        s.hline(20, 28, 27, WHITE)             # smile
        s.px(19, 26, WHITE); s.px(29, 26, WHITE)
    s.outline()
    return s


def WOOD_OUT_FIX2():
    return hx_screen()


def hx_screen():
    from engine import hx
    return hx("2B2F44")


def obj_coach():       return _robot("idle")
def obj_projecting():  return _robot("projecting")
def obj_plateau():     return _robot("plateau")
def obj_recovery():    return _robot("recovery")


def obj_friends():
    s = Sprite()
    # back figure (orange)
    s.disc(31, 15, 5, SKIN)                      # head
    s.shade_block(24, 22, 39, 40, ORANGE, ORANGE_HI, ORANGE_LO)
    s.px(24, 40, T); s.px(39, 40, T)
    # front figure (grey/blue body, skin head)
    s.disc(17, 17, 5, SKIN)
    s.shade_block(9, 24, 25, 42, GREY, GREY_HI, GREY_LO)
    s.px(9, 42, T); s.px(25, 42, T)
    # little face hints
    s.px(15, 16, WOOD_LO); s.px(19, 16, WOOD_LO)
    s.px(29, 14, WOOD_LO); s.px(33, 14, WOOD_LO)
    s.outline()
    return s


def obj_streak():
    s = Sprite()

    def flame(color, cx, base_y, top_y, wid):
        for y in range(top_y, base_y + 1):
            f = (y - top_y) / max(1, (base_y - top_y))
            w = wid * (f ** 0.7)
            off = int((1 - f) * 3)        # flicker lean near the tip
            s.hline(cx - w + off, cx + w + off, y, color)

    flame(ORANGE, 24, 42, 6, 11)
    flame(ORANGE_HI, 23, 40, 14, 7)
    flame(YELLOW, 23, 39, 22, 4)
    flame(WHITE, 23, 38, 30, 2)
    s.outline()
    return s


def obj_achievement():
    s = Sprite()
    # ribbon tails
    s.rect(18, 30, 21, 44, ORANGE); s.rect(27, 30, 30, 44, ORANGE)
    s.px(18, 44, T); s.px(30, 44, T)
    s.rect(19, 40, 20, 42, ORANGE_LO); s.rect(28, 40, 29, 42, ORANGE_LO)
    # medal disc
    s.disc(24, 22, 11, YELLOW)
    s.ring(24, 22, 11, YELLOW_LO)
    s.disc(24, 22, 8, YELLOW_HI)
    # star
    star = [(24, 15), (26, 21), (32, 21), (27, 25), (29, 31),
            (24, 27), (19, 31), (21, 25), (16, 21), (22, 21)]
    # simple star: draw a small orange plus + diagonals
    s.rect(23, 17, 25, 27, ORANGE)
    s.rect(19, 21, 29, 23, ORANGE)
    s.line(20, 18, 28, 26, ORANGE)
    s.line(28, 18, 20, 26, ORANGE)
    s.disc(24, 22, 1, ORANGE_HI)
    s.outline()
    return s


# ---------------------------------------------------------------------------
# Registry: (key, label, builder)
# ---------------------------------------------------------------------------

GROUP_A = [
    ("drag", "Drag", grip_drag),
    ("open_hand", "Open Hand", grip_open),
    ("half_crimp", "Half Crimp", grip_halfcrimp),
    ("full_crimp", "Full Crimp", grip_fullcrimp),
]

GROUP_B = [
    ("four_fingers", "4 Fingers", fp_four),
    ("front_three", "Front 3", fp_front3),
    ("back_three", "Back 3", fp_back3),
    ("front_two", "Front 2", fp_front2),
    ("middle_two", "Middle 2", fp_middle2),
    ("ring_pinky", "Ring + Pinky", fp_ringpinky),
    ("mono_index", "Mono Index", fp_mono_index),
    ("mono_middle", "Mono Middle", fp_mono_middle),
    ("mono_ring", "Mono Ring", fp_mono_ring),
    ("pinch", "Pinch", fp_pinch),
]

GROUP_C = [
    ("hangboard", "Hangboard", obj_hangboard),
    ("timer", "Hang Timer", obj_timer),
    ("chalk_bag", "Chalk Bag", obj_chalkbag),
    ("bouldering", "Bouldering", obj_bouldering),
    ("lead", "Lead", obj_lead),
    ("top_rope", "Top Rope", obj_toprope),
    ("wall", "Climbing Wall", obj_wall),
    ("gym", "Gym / Strength", obj_gym),
    ("cardio", "Cardio", obj_cardio),
    ("hydration", "Hydration", obj_hydration),
    ("bodyweight", "Bodyweight", obj_bodyweight),
    ("grade", "Grade Progression", obj_grade),
    ("dashboard", "Dashboard", obj_dashboard),
    ("schedule", "Schedule / Plan", obj_schedule),
    ("history", "History", obj_history),
    ("coach", "AI Coach", obj_coach),
    ("coach_projecting", "Coach: Projecting", obj_projecting),
    ("coach_plateau", "Coach: Plateau", obj_plateau),
    ("coach_recovery", "Coach: Recovery", obj_recovery),
    ("friends", "Friends", obj_friends),
    ("streak", "Streak", obj_streak),
    ("achievement", "Achievement", obj_achievement),
]
