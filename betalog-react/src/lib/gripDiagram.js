// Hangboard grip diagram — the drawing, as SVG markup. Pure: no React, no DOM.
//
// Two views side by side in a 300 × 140 box:
//   left  — the back of the hand, stylised, the same for every grip type. A finger in use is
//           extended and lands on the hold; a finger not in use is folded to its second knuckle.
//   right — the hand from the thumb side, hanging below the edge, one shape per grip type, drawn
//           to Ben's photos (2026-09-17). Pinch is drawn front-on.
// Every shape is a round-capped stroke or a rounded rect. The palm and wrist fade out of the
// frame through a gradient in the foreground colour, which is why the background colour is needed:
// creases and the halo where the thumb lies in front are painted in it.
//
// render(spec(fingers, gripType), color, dimColor, bg) -> the markup inside the <svg>.
// VIEW_BOX is the box it is drawn in.

export var VIEW_BOX = '0 0 300 140'

export var ACTIVE_FINGERS = {
  '4 Finger': [0,1,2,3], 'Front 3': [0,1,2], 'Back 3': [1,2,3], 'Front 2': [0,1],
  'Middle 2': [1,2], 'Ring/Pinky 2': [2,3], 'Mono Index': [0], 'Mono Middle': [1],
  'Mono Ring': [2], 'Pinch': [0,1,2,3]
};

function f(n) { return Math.round(n * 10) / 10; }
function norm(v) { var l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function mul(v, k) { return [v[0] * k, v[1] * k]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function perp(v) { return [-v[1], v[0]]; }
function pt(p) { return f(p[0]) + ',' + f(p[1]); }

// one bone: a round-capped stroke
function bone(a, b, w, color, op, extra) {
  return '<path d="M' + pt(a) + ' L' + pt(b) + '" stroke="' + color + '" stroke-width="' + f(w) +
         '" stroke-linecap="round" fill="none" opacity="' + (op == null ? 1 : op) + '"' + (extra || '') + '/>';
}
// a chain of bones with a width per bone (thin at the tip, thick at the base)
function chain(pts, ws, color, op) {
  var s = '';
  for (var i = 0; i < pts.length - 1; i++) s += bone(pts[i], pts[i + 1], ws[i], color, op);
  return s;
}
// the same chain with a halo of the background colour, for a digit lying in front of another
function chainHalo(pts, ws, color, bg) {
  return chain(pts, ws.map(function (w) { return w + 4; }), bg, 1) + chain(pts, ws, color, 1);
}
function R(x, y, w, h, r, fill, op) {
  return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + r + '" fill="' + fill + '" opacity="' + (op == null ? 1 : op) + '"/>';
}
function E(cx, cy, rx, ry, rot, fill, op) {
  return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + f(rot) + ' ' + f(cx) + ' ' + f(cy) + ')" fill="' + fill + '" opacity="' + op + '"/>';
}
function C(cx, cy, r, fill, op) {
  return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="' + fill + '" opacity="' + op + '"/>';
}

// ───────────────────────── the back of the hand, stylised ─────────────────────────
// To Ben's photos: fingers together with a fine crease between neighbours, natural lengths with
// the pinky shorter, a thick short thumb lying close along the hand. One icon for every grip type.
// A finger in use is extended and lands on the hold. A finger not in use is FOLDED: only its first
// bone stays, from the hand up to the second knuckle, which shows as a rounded bump.
var TOP = {
  fingers: [                                   // index -> pinky, touching
    { cx: 40,  w: 20, tip: 12 },
    { cx: 61,  w: 21, tip: 8 },
    { cx: 82,  w: 20, tip: 10 },
    { cx: 100.5, w: 17, tip: 20 }
  ],
  palmTop: 84
};
function knuckleY(fg) { return TOP.palmTop - 0.42 * (TOP.palmTop - fg.tip); }   // where the second knuckle sits

function topHand(g, c, dim, bg, fade) {
  var s = '', pinch = g.pinch, act = g.act;
  var barTop = 8, barH = pinch ? 28 : 14;
  if (pinch) s += bone([22, 30], [32, 108], 22, c, 0.5);                 // thumb under the block
  s += R(6, barTop, 120, barH, 4, dim, pinch ? 0.7 : 0.6);                 // the hold
  var hand = '';
  hand += R(16, TOP.palmTop, 94, 96, 20, fade);                           // palm, out to the little finger's edge, fading at the wrist
  var tops = [];
  TOP.fingers.forEach(function (fg, i) {
    var on = act.has(i), ky = knuckleY(fg);
    var top = on ? fg.tip + fg.w / 2 : ky;                                 // extended to the hold, or folded to the knuckle
    tops.push(on ? fg.tip : ky - fg.w / 2);
    hand += bone([fg.cx, top], [fg.cx, 98], fg.w, c);         // ends inside the solid part of the palm
    // the second knuckle: a crease just under the bump on a folded finger, across the joint on an extended one
    var cy = on ? ky + 2 : ky + fg.w * 0.45;
    hand += bone([fg.cx - fg.w * 0.3, cy], [fg.cx + fg.w * 0.3, cy], 1.4, bg, 0.3);
  });
  for (var i = 0; i < 3; i++) {                                           // crease between neighbours
    var a = TOP.fingers[i], b = TOP.fingers[i + 1];
    var x = (a.cx + a.w / 2 + b.cx - b.w / 2) / 2, top = Math.max(tops[i], tops[i + 1]) + 12;
    hand += bone([x, top], [x, 92], 1.4, bg, 0.3);
  }
  if (!pinch) hand += bone([18, 74], [27, 100], 23, c);                   // thumb: thick, short, along the hand; ends inside the solid palm
  s += '<g opacity="0.92">' + hand + '</g>';
  return s;
}

// ───────────────────────── side profile, from the thumb side ─────────────────────────
// To Ben's photos. Wall on the left, lip top at y=40 out to x=196. The pad rests on the lip;
// the first bone stands near vertical with the wrist straight below it, so:
//   half crimp  - a 7: middle bone flat across the lip, knuckle at lip height, tip drooping a touch,
//                 thumb pressed up along the first bone in front
//   full crimp  - knuckle peaks above the lip, middle bone steep, last bone bent back flat, thumb over it
//   open hand   - a hook: only the last bone turns over the lip, the rest hangs nearly straight
//   drag        - the same hook, straighter and lower
// fin: tip -> DIP -> PIP -> MCP.  back: MCP -> wrist.  Pinch is drawn front-on.
var SIDE = {
  'half-crimp': { fin: [[180, 37], [196, 34], [216, 36], [222, 72]],
                  back: [[222, 72], [228, 110], [234, 150]],
                  thumb: [[204, 48], [208, 70], [214, 94]], thumbAlong: true },
  'full-crimp': { fin: [[178, 35], [194, 32], [208, 10], [214, 50]],
                  back: [[214, 50], [220, 100], [228, 150]],
                  thumb: [[188, 24], [206, 38], [222, 60]], thumbOver: true },
  'open-hand':  { fin: [[178, 35], [194, 34], [208, 60], [216, 96]],
                  back: [[216, 96], [222, 122], [228, 150]],
                  thumb: [[198, 58], [204, 80], [212, 106]], thumbUnder: true },
  'drag':       { fin: [[178, 35], [192, 42], [200, 70], [206, 104]],
                  back: [[206, 104], [212, 128], [218, 150]],
                  thumb: [[190, 66], [196, 88], [204, 112]], thumbUnder: true },
  'pinch':      { fin: [[168, 34], [166, 58], [176, 88]],
                  thumb: [[204, 36], [206, 60], [214, 88]] }
};
var FIN_W = [10, 11.5, 13];       // bone widths, tip -> base
var THUMB_W = [9, 10.5, 12];
var BACK_W = [19, 22];

function sideHand(g, c, dim, bg, fade) {
  var s = '', pinch = g.pinch, gt = g.gt, key = pinch ? 'pinch' : gt, S = SIDE[key];
  s += R(150, 0, 12, 140, 2, dim, 0.35);                                   // wall / board face
  if (pinch) s += R(172, 24, 26, 48, 4, dim, 0.5);                          // pinch block, front-on
  else       s += R(150, 40, 46, 10, 3, dim, 0.5);                          // the edge
  var hand = '';
  if (pinch) {
    hand += R(160, 84, 64, 80, 20, fade);                                   // palm below the block
    hand += chain(S.fin, [11, 13], c);
    hand += chain(S.thumb, [11, 13], c);
  } else {
    hand += bone(S.back[0], S.back[2], 21, fade);                            // back of the hand, one stroke so the fade never doubles
    if (S.thumbUnder) hand += chain(S.thumb, THUMB_W, c, 0.55);            // thumb loose on the wall side
    hand += chain(S.fin, FIN_W, c);
    var T0 = S.fin[0], dd = norm(sub(S.fin[1], T0)), up = perp(dd);        // nail on top of the last bone
    if (up[1] > 0) up = mul(up, -1);
    var nc = add(add(T0, mul(dd, 4)), mul(up, 2.4));
    hand += E(nc[0], nc[1], 3.6, 2, Math.atan2(dd[1], dd[0]) * 180 / Math.PI, bg, 0.28);
    hand += C(S.fin[1][0], S.fin[1][1], 1.4, bg, 0.45) + C(S.fin[2][0], S.fin[2][1], 1.4, bg, 0.45);   // joint creases
    if (S.thumbAlong || S.thumbOver) hand += chainHalo(S.thumb, THUMB_W, c, bg);   // thumb in front, haloed
  }
  s += '<g opacity="0.92">' + hand + '</g>';
  return s;
}

var seq = 0;
export function render(g, c, dim, bg) {
  var gid = 'fade' + (++seq), fade = 'url(#' + gid + ')';
  var s = '<defs><linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="0" y1="116" x2="0" y2="146">' +
          '<stop offset="0" stop-color="' + c + '" stop-opacity="1"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>';
  s += topHand(g, c, dim, bg, fade);
  s += R(140, 6, 1, 128, 0, dim, 0.25);
  s += sideHand(g, c, dim, bg, fade);
  return s;
}

export function spec(fingers, gt, label) {
  return { fingers: fingers, gt: gt, act: new Set(ACTIVE_FINGERS[fingers] || [0, 1, 2, 3]), pinch: fingers === 'Pinch',
           name: fingers + ' · ' + (label || gt) };
}
