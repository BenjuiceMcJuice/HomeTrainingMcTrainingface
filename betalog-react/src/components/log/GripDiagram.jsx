// Two-panel grip schematic shown above the hangboard timer countdown.
// Left  — top-down:  which fingers are active.
// Right — side view: 3-segment finger showing DIP + PIP joint angles per grip type.

var ACTIVE_FINGERS = {
  '4 Finger':     [0,1,2,3],
  'Front 3':      [0,1,2],
  'Back 3':       [1,2,3],
  'Front 2':      [0,1],
  'Middle 2':     [1,2],
  'Ring/Pinky 2': [2,3],
  'Mono Index':   [0],
  'Mono Middle':  [1],
  'Mono Ring':    [2],
  'Pinch':        [0,1,2,3],
}

// cx = centre x, w = width, h = height below edge  (index → pinky)
var FINGER_GEOM = [
  { cx: 40,  w: 20, h: 52 },
  { cx: 64,  w: 22, h: 60 },
  { cx: 88,  w: 20, h: 55 },
  { cx: 110, w: 16, h: 44 },
]

// Bottom corner radius of active finger shapes — rounder = more open
var TIP_R = {
  'drag':       11,
  'open-hand':   8,
  'half-crimp':  3,
  'full-crimp':  1,
}

// Iconic side-profile paths — one per grip type.
// Board right edge ≈ x172; edge lip bottom = y14 (aligned with left panel edge bar).
//   drag / open-hand → straight "I"
//   half-crimp       → "7"  (bar across top anchored at lip, drops down)
//   full-crimp       → "Λ"  (peaks out right, sweeps back left = hat / upside-down V)
var SIDE_PROFILE = {
  'drag':       'M 193,10 L 191,73',
  'open-hand':  'M 182,10 L 198,20 L 194,73',
  'half-crimp': 'M 172,10 L 212,18 L 208,73',
  'full-crimp': 'M 172,10 L 197,2 L 193,73',
}

// Accent dot at the bend point (makes the angle pop)
var PROFILE_DOT = {
  'half-crimp': [212, 18],
  'full-crimp': [197, 2],
}

// Pill shape with independent top / bottom radii
function pill(x, y, w, h, rTop, rBot) {
  var rt = Math.min(rTop, w / 2)
  var rb = Math.min(rBot, w / 2)
  return [
    'M', x + rt,     y,
    'L', x + w - rt, y,
    'Q', x + w, y,       x + w, y + rt,
    'L', x + w,          y + h - rb,
    'Q', x + w, y + h,   x + w - rb,  y + h,
    'L', x + rb,         y + h,
    'Q', x,     y + h,   x,           y + h - rb,
    'L', x,              y + rt,
    'Q', x,     y,       x + rt,      y,
    'Z',
  ].join(' ')
}

export default function GripDiagram({ grip, color, dimColor }) {
  if (!grip) return null

  var gt       = grip.gripType || grip.grip || 'open-hand'
  var active   = new Set(ACTIVE_FINGERS[grip.fingers] || [0,1,2,3])
  var tipR     = TIP_R[gt] != null ? TIP_R[gt] : 8
  var profileD = SIDE_PROFILE[gt] || SIDE_PROFILE['open-hand']
  var dot      = PROFILE_DOT[gt]

  return (
    <svg
      width="230"
      height="80"
      viewBox="0 0 230 80"
      style={{ display: 'block' }}
    >
      {/* ════════════════════════════════════════ */}
      {/* LEFT — top-down (which fingers)          */}
      {/* ════════════════════════════════════════ */}

      {/* Edge bar */}
      <rect x="8" y="6" width="134" height="8" rx="3" fill={dimColor} opacity="0.6"/>

      {FINGER_GEOM.map(function (f, i) {
        var on = active.has(i)
        return (
          <path
            key={i}
            d={pill(f.cx - f.w / 2, 6, f.w, f.h, f.w / 2, on ? tipR : f.w / 2)}
            fill={on ? color : dimColor}
            opacity={on ? 0.88 : 0.18}
          />
        )
      })}

      {/* ── divider ── */}
      <rect x="152" y="6" width="1" height="68" fill={dimColor} opacity="0.25"/>

      {/* ════════════════════════════════════════ */}
      {/* RIGHT — side profile (grip type)         */}
      {/* ════════════════════════════════════════ */}

      {/* Board face */}
      <rect x="158" y="4" width="14" height="73" rx="2" fill={dimColor} opacity="0.35"/>
      {/* Edge lip — y=6 h=8 matches left panel edge bar (both bottom at y=14) */}
      <rect x="158" y="6" width="38" height="8" rx="2" fill={dimColor} opacity="0.5"/>

      {/* Iconic finger shape */}
      <path
        d={profileD}
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />

      {/* Accent dot at the bend point for crimp types */}
      {dot && (
        <circle cx={dot[0]} cy={dot[1]} r="4.5" fill={color} opacity="0.95"/>
      )}
    </svg>
  )
}
