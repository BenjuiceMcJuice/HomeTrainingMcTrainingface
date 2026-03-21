# BetaLog — Technical Reference

This is the build doc. It covers the current codebase, the planned file split, the
Firebase migration, the wall map system, and known issues. No business strategy here —
that lives in betalog_vision.md.

Claude Code reads both docs when working on this repo. Update this file when
significant technical decisions are made or architecture changes.

Repo: github.com/BenjuiceMcJuice/HomeTrainingMcTrainingface
Live: betalog.co.uk
Vision doc: betalog_vision.md
Prototype: wall-map-prototype.html (in repo — open in browser to see the wall map UI)

---

## Current State

Single file app. Everything in index.html (~7,670 lines). No build step, no backend,
no accounts. All data in localStorage.

Version: v4.3
Hosting: GitHub Pages (auto-deploys on push to main)
Domain: betalog.co.uk (DNS pointing to GitHub Pages)

File structure right now:

```
/
├── index.html                 everything — HTML, CSS, JS (~7,670 lines)
├── betalog_technical.md       this file
├── betalog_vision.md          product strategy and ideas
├── wall-map-prototype.html    standalone wall map prototype — open in browser
└── CLAUDE.md                  guidance for Claude Code
```

No sw.js exists. index.html registers a service worker at /HomeTrainingMcTrainingface/sw.js
but the file is absent. PWA offline caching silently fails. Do not rely on it.

---

## Architecture of index.html

Three sections in order:

1. style block — all CSS, ~366 lines. CSS custom properties on :root define design
   tokens. Two accent colours: --accent (#4f7ef8, blue) for gym/training, --climb-accent
   (#c0622a, orange) for climbing.

2. HTML body — page shells as div.page elements shown/hidden by showPage(). Nav is a
   fixed bottom bar on mobile, sticky top on desktop (700px breakpoint).

3. script block — all JavaScript, vanilla ES5 style. No modules, no bundler, no
   const/let, no arrow functions in most of the codebase. New code must match this
   style unless a full refactor is explicitly in scope.

---

## Data Layer

Three functions handle all storage:

```
loadData()        reads all keys from localStorage on init, returns DATA object
save(key, val)    JSON.stringify → localStorage
saveRaw(key, val) raw string write
```

localStorage keys in use:

```
il_sessions       array of session objects
il_exercises      exercise library
il_routines       saved routines
il_hbRoutines     hangboard routines
il_schedule       weekly schedule
il_weightLog      bodyweight log
il_athleteProfile athlete profile data
il_badges         earned badges
il_groq_key       Groq API key (user-supplied)
```

Session object shape:

```js
{
  id:        string,
  date:      string (ISO),
  type:      "gym" | "climb" | "hangboard" | "quick",
  diff:      1-5,
  exercises: array,
  climbs:    array,   // climb type only
  grips:     array    // hangboard type only
}
```

Climb object shape (within session.climbs):

```js
{
  grade:    string,    // "V4", "6b", etc.
  outcome:  "flashed" | "sent" | "attempt" | "fell" | "project",
  routeId:  string | null,   // null = standalone, string = linked to gym route
  gymId:    string | null,
  centreId: string | null
}
```

The routeId, gymId, centreId fields are new additions for the route board feature.
They are nullable so standalone logging continues to work unchanged.

---

## Key Functions

Navigation:
  showPage(id, btn)   toggles .active on .page divs and .nav-btn elements

Page IDs (actual): dashboard, log, history, plan
Sub-page: page-session (session detail drill-down)
Tabs/panels within pages (not top-level): train, coach, rewards, settings

Subsystems:

```
Dashboard     renderDashboard(), renderDashGradeChart(), renderActivityCal()
Logging       initLog(), setLogSessionType(), renderLogGymPanel(),
              renderLogClimbPanel(), renderLogHangboardPanel()
Session save  saveSession(mode) — handles gym, quick, climb, hangboard
Exercises     renderExerciseLibrary(), openExerciseModal(), saveExercise()
Routines      renderRoutines(), rbSaveRoutine(), renderEditRoutineOrder()
Hangboard     renderLogHangboardPanel(), openHbRoutineModal()
History       renderHistory(), showSessionDetail(), saveSessionEdit()
AI coach      multiple personas (Jonas, Chad, Marina, Geoff)
              each calls https://api.groq.com/openai/v1/chat/completions
Streak        calcStreak(), updateStreak()
Import/export exportData(), importData()
```

---

## Local Development

No build step.

```
open index.html in a browser
# or
npx serve .
# or
python -m http.server
```

To see changes on the live site: commit to main, wait 30 seconds, hard refresh
(Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac).

---

## Step 1 — Code Split

The app must be split into separate files before Firebase is added. Adding a backend
to a 7,670-line single file produces something impossible to debug or hand to anyone.
Split first, then migrate.

Every split step leaves the app fully working. Test the live site after each step.
Do not move on until it works.

### Target structure after split

```
/
├── index.html              HTML skeleton only, ~300 lines
├── betalog_technical.md    this file
├── betalog_vision.md       product strategy
├── wall-map-prototype.html wall map prototype
├── CLAUDE.md               Claude Code guidance
├── css/
│   └── app.css             all styles
└── js/
    ├── data.js             loadData(), save(), storage adapter, later Firebase sync
    ├── coach.js            AI coach functions, Groq calls, persona definitions
    ├── dashboard.js        renderDashboard(), charts, activity calendar
    ├── log.js              session logging — gym, climb, hangboard
    ├── train.js            exercise library, routines, schedule
    ├── wallmap.js          wall map canvas rendering and interaction (new)
    └── app.js              nav, streak, badges, init, everything else
```

index.html after split:

```html
<link rel="stylesheet" href="css/app.css">
<script src="js/data.js"></script>
<script src="js/coach.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/log.js"></script>
<script src="js/train.js"></script>
<script src="js/wallmap.js"></script>
<script src="js/app.js"></script>
```

### Split order

One step at a time. One commit per step. Test before continuing.

Step 1a — css/app.css
Extract the entire style block. Replace with link rel="stylesheet" href="css/app.css".
Nothing functional can break. Safest first step.

Step 1b — js/data.js
Extract loadData(), save(), saveRaw(), and the Storage adapter (see below).
Lowest-level functions — everything else calls them.
Test: sessions save and load correctly.

Step 1c — js/coach.js
Extract all AI coach functions: Groq API calls, persona definitions (Jonas, Chad,
Marina, Geoff), coach rendering. Self-contained.
Test: AI coach responds correctly with a Groq key set.

Step 1d — js/dashboard.js
Extract renderDashboard(), renderDashGradeChart(), renderActivityCal().
Test: dashboard renders charts and stats correctly.

Step 1e — js/log.js
Extract initLog(), setLogSessionType(), renderLogGymPanel(), renderLogClimbPanel(),
renderLogHangboardPanel(), saveSession(). Largest chunk — take care.
Test: log a gym session, a climb session, a hangboard session end to end.

Step 1f — js/train.js
Extract renderExerciseLibrary(), openExerciseModal(), saveExercise(), renderRoutines(),
rbSaveRoutine(), renderEditRoutineOrder(), hangboard timer.
Test: exercise library, routines, hangboard timer all work.

Step 1g — js/wallmap.js
New file — wall map canvas system (see Wall Map section below).
Nothing to extract from index.html yet. Create the file with the wall map functions.
It will be populated as that feature is built.

Step 1h — js/app.js
Everything remaining: showPage(), calcStreak(), updateStreak(), badges, exportData(),
importData(), init().
Test: full end-to-end pass of the entire app.

### How to split using the GitHub web editor (no computer required)

1. Repo > Add file > Create new file
2. Type js/data.js as the filename (GitHub creates the folder)
3. Paste the functions
4. Commit to main
5. Edit index.html — remove the moved block, add the script tag
6. Commit to main
7. Wait 30 seconds, hard refresh the live site
8. F12 > Console — if a function is undefined, it is still in the old file. Move it.

With Claude Code: one step at a time. Specify the file and the functions. Do not ask
it to do all steps at once.

### The Storage adapter

Centralise all storage calls into one adapter object in data.js before adding Firebase.
When Firebase is wired up, only this adapter changes — nothing else touches Firebase.

```js
var Storage = {
  save: function(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch(e) {
      alert('Storage full — export a backup to avoid losing data.');
    }
    // Firebase sync added here in Step 2. Nothing else changes.
  },

  load: function(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch(e) {
      return fallback;
    }
  }
};
```

---

## Step 2 — Firebase Migration

Do this after the code split is complete and working.

### 2a — Create the Firebase project

1. console.firebase.google.com
2. Add project > name: betalog > disable Analytics > Create
3. Firestore Database > Create database > Start in test mode > europe-west2 > Done
4. Authentication > Get started > Enable Google sign-in > Save
5. Gear > Project settings > Your apps > </> > register as betalog-web
6. Copy config object — store it safely, do not commit to the public repo

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "betalog.firebaseapp.com",
  projectId: "betalog",
  storageBucket: "betalog.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abcdef"
};
```

Free tier (Spark): 50k reads/day, 20k writes/day, 1GB storage, unlimited auth.
Blaze (pay-as-you-go) needed for Cloud Functions with outbound calls. ~£10-30/month
at small scale. Also needed for Firebase Storage (route photos).

### 2b — Load Firebase in index.html

Add before your own script tags:

```html
<script type="module">
  import { initializeApp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getStorage, ref, uploadBytes, getDownloadURL }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
  import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = { /* paste config here */ };
  const app = initializeApp(firebaseConfig);
  window._db      = getFirestore(app);
  window._storage = getStorage(app);
  window._auth    = getAuth(app);

  onAuthStateChanged(window._auth, function(user) {
    window._currentUser = user;
    if (user) syncFromFirebase(user.uid);
  });
</script>
```

Note: firebase-storage is imported here because route photos will use it.

### 2c — Update the Storage adapter

```js
var Storage = {
  save: function(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch(e) { alert('Storage full — export a backup.'); }

    if (window._currentUser && window._db) {
      var uid = window._currentUser.uid;
      setDoc(
        doc(window._db, 'users', uid, 'data', key),
        { value: val, updatedAt: new Date().toISOString() }
      ).catch(function(e) { console.warn('Firebase write failed:', e); });
    }
  },

  load: function(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch(e) { return fallback; }
  }
};

function syncFromFirebase(uid) {
  var keys = ['il_sessions', 'il_exercises', 'il_routines', 'il_schedule'];
  keys.forEach(function(key) {
    getDoc(doc(window._db, 'users', uid, 'data', key))
      .then(function(snap) {
        if (snap.exists()) {
          localStorage.setItem(key, JSON.stringify(snap.data().value));
        }
      })
      .then(function() { DATA = loadData(); renderDashboard(); })
      .catch(function(e) { console.warn('Firebase read failed:', e); });
  });
}
```

### 2d — Add login UI

```js
function signInWithGoogle() {
  var provider = new GoogleAuthProvider();
  signInWithPopup(window._auth, provider)
    .then(function(result) { ilToast('Signed in as ' + result.user.displayName); })
    .catch(function(e) { ilToast('Sign in failed — ' + e.message); });
}

function signOut() {
  window._auth.signOut().then(function() {
    window._currentUser = null;
    ilToast('Signed out');
  });
}
```

Add to Settings panel HTML:

```html
<div class="card" style="margin-bottom:16px">
  <div id="accountSignedOut">
    <div style="font-size:14px;font-weight:700;margin-bottom:8px">Sync your data</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
      Sign in to back up your sessions and access them on any device.
    </div>
    <button onclick="signInWithGoogle()" class="btn btn-primary" style="width:100%">
      Sign in with Google
    </button>
  </div>
  <div id="accountSignedIn" style="display:none">
    <div id="accountName" style="font-size:14px;font-weight:700;margin-bottom:4px"></div>
    <div id="accountEmail" style="font-size:12px;color:var(--muted);margin-bottom:12px"></div>
    <div style="font-size:12px;color:var(--green);margin-bottom:12px">
      Data syncing to cloud
    </div>
    <button onclick="signOut()" class="btn btn-secondary btn-sm">Sign out</button>
  </div>
</div>
```

### 2e — Test checklist

- App loads and works without signing in
- Sign in with Google button appears in Settings
- Signing in works — no errors in F12 console
- Log a session while signed in
- Open in incognito, sign in — session is there
- Sign out — app still works from local data

---

## Firestore Data Structure

Full schema including wall map and route board collections.

```
users/
  {userId}/
    data/
      il_sessions     { value: [...], updatedAt: "ISO" }
      il_exercises    { value: [...], updatedAt: "ISO" }
      il_routines     { value: [...], updatedAt: "ISO" }
      il_schedule     { value: {...}, updatedAt: "ISO" }
    profile/
      info            { name, email, gymId, centreId, memberSince, role }

      role field values:
        "member"       default — can log sessions and view route board
        "setter"       can add, edit, and retire routes
        "admin"        can edit wall map, manage setters, access gym dashboard
        "head_setter"  setter + aggregate stats view

gyms/
  {gymId}/
    info/
      details         { name, logo, website, rgpKey, tier, colours[] }

      colours[] is the gym's defined circuit colour palette:
      [
        { id: "orange", hex: "#e87d3e", label: "Orange" },
        { id: "blue",   hex: "#4f7ef8", label: "Blue"   },
        ...
      ]
      Stored on the gym so all setters and members see the same colour definitions.

    centres/
      {centreId}/
        info          { name, address, phone }

        wallMap/
          layout      (see Wall Map Data Structure below)

        routes/
          {routeId}   (see Route Data Structure below)
```

---

## Wall Map Data Structure

Stored at:
  gyms/{gymId}/centres/{centreId}/wallMap/layout

This is a single document — the entire plan view definition for one centre.

```js
{
  canvasWidth:  800,        // reference canvas dimensions
  canvasHeight: 520,        // points stored as % so these are just aspect ratio hints
  updatedAt:    "ISO string",
  updatedBy:    "userId",

  sections: [
    {
      id:      "overhang",           // stable ID — used in route.sectionId
      name:    "Overhang",           // display name — shown as label on map
      angle:   "steep",             // "slab" | "vert" | "slight" | "steep" | "roof"
      points:  [                    // polygon vertices as [x%, y%] percentages
        [5, 5],
        [38, 5],
        [38, 48],
        [22, 62],
        [5, 62]
      ]
    },
    {
      id:      "cave",
      name:    "Cave",
      angle:   "roof",
      points:  [[40,5],[60,5],[60,30],[40,30]]
    }
    // ... more sections
  ],

  landmarks: [
    { label: "Entrance",       x: 5,  y: 95 },
    { label: "Training board", x: 82, y: 30 }
  ]
}
```

### Why percentage coordinates

Points are stored as percentages of the reference canvas (not pixels). This means
the map renders correctly at any screen size — phone, tablet, or desktop — without
any coordinate recalculation in the Firestore data. The rendering code multiplies
by actual canvas dimensions at draw time.

### Angle shading

The angle field drives visual shading on the canvas. This gives the plan view
immediate character — a setter can glance at the map and see where the steep
sections are without reading labels.

```
slab:   rgba(255,255,255,0.10)   lightest
vert:   rgba(255,255,255,0.06)   near-invisible
slight: rgba(79,126,248,0.16)    light blue tint
steep:  rgba(79,126,248,0.26)    medium blue
roof:   rgba(79,126,248,0.40)    darkest
```

These values come from the prototype (wall-map-prototype.html) and should be used
as-is in production unless the gym's colour scheme requires adjustment.

---

## Route Data Structure

Each active or retired route is a document at:
  gyms/{gymId}/centres/{centreId}/routes/{routeId}

```js
{
  id:          "r_1234567890",    // auto-generated
  gymId:       "gym_abc",
  centreId:    "centre_xyz",

  // Position on wall map
  sectionId:   "overhang",       // matches a section.id in wallMap/layout
  x:           18.4,             // % of canvas width — where the dot sits on the plan
  y:           22.1,             // % of canvas height

  // Route identity
  colour:      "orange",         // matches an id in gym.info.colours[]
  grade:       "V5",
  description: "Start matched on the undercling. Big move to left sloper at half-height.",

  // Setter info
  setterUid:   "userId",
  setterName:  "Jamie",
  setDate:     "2026-03-09",     // ISO date string
  setDateTs:   1234567890,       // Unix timestamp for age calculations

  // Status
  active:      true,
  retireDate:  null,             // ISO date string when retired, null if active
  retiredBy:   null,             // userId who retired it

  // Optional photo
  photoUrl:    null,             // Firebase Storage URL, null if no photo attached
  // Photo is of the starting holds or crux — not the whole wall section.
  // Stored in Firebase Storage at:
  //   gyms/{gymId}/centres/{centreId}/routes/{routeId}/start.jpg

  // Analytics (updated by Cloud Function or client aggregate)
  stats: {
    totalLogs:    0,
    flashes:      0,
    sends:        0,
    attempts:     0,
    projects:     0,
    gradeVotes:   { harder: 0, right: 0, softer: 0 }
  },

  updatedAt:   "ISO string"
}
```

### Querying active routes for a centre

```js
// Get all active routes for a centre (called when member opens route board)
getDocs(
  query(
    collection(window._db, 'gyms', gymId, 'centres', centreId, 'routes'),
    where('active', '==', true)
  )
).then(function(snap) {
  var routes = [];
  snap.forEach(function(doc) { routes.push(doc.data()); });
  renderWallMap(routes);
});
```

### Retiring a route

```js
// Single route retirement
setDoc(
  doc(window._db, 'gyms', gymId, 'centres', centreId, 'routes', routeId),
  {
    active:     false,
    retireDate: new Date().toISOString().split('T')[0],
    retiredBy:  window._currentUser.uid,
    updatedAt:  new Date().toISOString()
  },
  { merge: true }
);
```

---

## Wall Map Canvas System (js/wallmap.js)

The wall map is a Canvas 2D element. All rendering uses the native Canvas API —
no external library required. The prototype (wall-map-prototype.html) contains the
full working implementation. This section documents how it should be structured
when integrated into the main app.

### Module structure in wallmap.js

```js
// ── WALL MAP STATE ───────────────────────────────────────────────────────
var WallMap = {
  canvas:        null,    // the canvas element
  ctx:           null,    // 2D context
  sections:      [],      // loaded from Firestore wallMap/layout
  routes:        [],      // loaded from Firestore routes/ collection
  activeFilter:  'all',   // colour filter for member view
  pendingPin:    null,    // { x%, y% } — where setter tapped to place a route
  selectedRoute: null,    // route object currently selected
  mode:          'member' // 'member' | 'setter' | 'setup'
};

// ── PUBLIC FUNCTIONS (called from log.js and app.js) ─────────────────────
WallMap.init = function(canvasEl, mode)  { ... }  // initialise canvas and load data
WallMap.draw = function()                { ... }  // full redraw — call after any state change
WallMap.loadCentre = function(centreId) { ... }  // fetch wallMap and active routes from Firestore
WallMap.setFilter = function(colour)    { ... }  // member colour filter
WallMap.setMode = function(mode)        { ... }  // switch between member/setter/setup

// ── INTERNAL FUNCTIONS ───────────────────────────────────────────────────
function drawSections()    { ... }  // render wall section polygons with angle shading
function drawRoutes()      { ... }  // render route dots with colour, grade label, glow
function drawSetupLayer()  { ... }  // render in-progress polygon during wall setup
function hitTestRoute(x,y) { ... }  // returns route at canvas coords or null
function hitTestSection(x,y){ ... } // returns section at canvas % coords or null
function pct2px(px, py)    { ... }  // convert % coords to canvas pixels
function px2pct(x, y)      { ... }  // convert canvas pixels to % coords
function pointInPolygon(px,py,pts) { ... } // raycasting hit test for section tap
```

### Canvas sizing

The canvas fills its parent container. On resize, redraw immediately.

```js
function resizeCanvas() {
  WallMap.canvas.width  = WallMap.canvas.parentElement.clientWidth;
  WallMap.canvas.height = WallMap.canvas.parentElement.clientHeight;
  WallMap.draw();
}
window.addEventListener('resize', resizeCanvas);
```

### Touch and click handling

A single handler covers both touch and mouse. Route dots have a tap target
larger than their visual radius (1.8× dot radius) to account for fat fingers.

```js
canvas.addEventListener('click', function(e) {
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  handleCanvasTap(x, y);
});
canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  var rect  = canvas.getBoundingClientRect();
  var touch = e.changedTouches[0];
  var x = touch.clientX - rect.left;
  var y = touch.clientY - rect.top;
  handleCanvasTap(x, y);
}, { passive: false });

function handleCanvasTap(x, y) {
  var pct = px2pct(x, y);
  if (WallMap.mode === 'setup') { handleSetupTap(pct[0], pct[1]); return; }
  var route = hitTestRoute(x, y);
  if (route) {
    if (WallMap.mode === 'member') { openRoutePopup(route, x, y); }
    if (WallMap.mode === 'setter') { openEditForm(route); }
    return;
  }
  if (WallMap.mode === 'setter' && WallMap.activeTool === 'place') {
    var section = hitTestSection(pct[0], pct[1]);
    if (section) {
      WallMap.pendingPin = { x: pct[0], y: pct[1], sectionId: section.id };
      openNewRouteForm(section);
    }
  }
}
```

### Dense section handling (many routes in one area)

When more than 5 routes are within a 10% radius on the canvas, routes overlap.
Handle with a proximity list on long-press or tap-and-hold:

```js
function getRoutesNear(x, y, radiusPx) {
  var dotR = Math.max(10, WallMap.canvas.width * 0.016);
  return WallMap.routes.filter(function(r) {
    if (WallMap.activeFilter !== 'all' && r.colour !== WallMap.activeFilter) return false;
    var rp = pct2px(r.x, r.y);
    var dx = rp[0] - x, dy = rp[1] - y;
    return Math.sqrt(dx*dx + dy*dy) < radiusPx;
  });
}
```

If getRoutesNear returns more than 1 route within 2× tap radius, show a bottom
sheet listing those routes rather than opening one directly.

### Route dot rendering detail

Each dot gets a radial gradient glow behind it, the hold colour as fill, and
the grade as white text. Selected dot gets a white ring. Logged-this-session
dots get a green badge. Old routes (setter mode, >35 days) get a red badge.

```js
function drawRouteDot(r, dotR) {
  var col = getColourHex(r.colour);
  var rp  = pct2px(r.x, r.y);

  // Glow
  var grd = ctx.createRadialGradient(rp[0],rp[1],0, rp[0],rp[1],dotR*2.2);
  grd.addColorStop(0, col + '55');
  grd.addColorStop(1, col + '00');
  ctx.beginPath();
  ctx.arc(rp[0], rp[1], dotR*2.2, 0, Math.PI*2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.arc(rp[0], rp[1], dotR, 0, Math.PI*2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = (r.id === WallMap.selectedRoute) ? '#fff' : 'rgba(0,0,0,0.4)';
  ctx.lineWidth   = (r.id === WallMap.selectedRoute) ? 3 : 1.5;
  ctx.stroke();

  // Grade label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.max(8, WallMap.canvas.width*0.012) + 'px "Barlow Condensed"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.grade, rp[0], rp[1]);
}
```

---

## Wall Setup Tool

The setup tool is admin-only and is used once per centre to draw the wall map.
It lives in js/wallmap.js as WallMap.setupMode functions. It should also be
accessible as a standalone page at /setup.html for use on a desktop or tablet
during the initial gym onboarding.

### Setup flow

1. Admin opens setup tool (role: admin only)
2. Sees blank gridded canvas
3. Clicks/taps to place corner points of a wall section
4. When 3+ points placed, a "Close section" button appears
5. Clicking near the first point (within 18px) also closes the section
6. On close: inline form slides up asking for section name and angle
   (NOT browser prompt() — use a proper slide-up panel matching the route form style)
7. Section saved, dot handles visible for drag adjustment
8. Repeat for each section
9. Optional: add landmark labels (Entrance, Toilets, etc.)
10. Save — writes wallMap/layout document to Firestore

### Setup data flow

On save, the setup tool writes:

```js
setDoc(
  doc(window._db, 'gyms', gymId, 'centres', centreId, 'wallMap', 'layout'),
  {
    canvasWidth:  800,
    canvasHeight: 520,
    sections:     sections_array,
    landmarks:    landmarks_array,
    updatedAt:    new Date().toISOString(),
    updatedBy:    window._currentUser.uid
  }
);
```

After save, WallMap.loadCentre() is called to reload and verify.

### Known issue in prototype

The prototype uses browser prompt() dialogs for section name and angle input.
This is acceptable for a prototype but must be replaced with proper inline form
panels in the production implementation. Style should match the route form panel
(slides up from bottom, same card/input styling as the rest of the app).

---

## Route Form (Setter UI)

### Opening the form

The route form slides up from the bottom of the screen (position:absolute, bottom:0,
transform:translateY(100%) when closed, translateY(0) when open). The wall map
remains visible behind it. CSS transition: 0.25s cubic-bezier(0.4,0,0.2,1).

The form is pre-populated based on context:
- New route: section name pre-filled from the tapped section, date defaults to today,
  setter name pre-filled from user profile
- Edit route: all fields populated from the existing route document

### Form fields

```
Grade          select — V0 through V10 (or French grades for lead)
Section        select — populated from wallMap sections, pre-selected from tap location
Hold colour    colour chip picker — populated from gym.info.colours[]
Description    textarea — optional starting beta or notes
Setter         text input — pre-filled from profile, editable
Date set       date input — defaults to today
Photo          file input — optional, hidden behind "Add photo" button
               on select: upload to Firebase Storage, store URL on route
```

### Saving a new route

```js
function saveNewRoute(sectionId, x, y, formData) {
  var routeId = 'r_' + Date.now();
  var route = {
    id:          routeId,
    gymId:       window._currentGymId,
    centreId:    window._currentCentreId,
    sectionId:   sectionId,
    x:           x,
    y:           y,
    colour:      formData.colour,
    grade:       formData.grade,
    description: formData.description,
    setterUid:   window._currentUser.uid,
    setterName:  formData.setter,
    setDate:     formData.date,
    setDateTs:   new Date(formData.date).getTime(),
    active:      true,
    retireDate:  null,
    retiredBy:   null,
    photoUrl:    null,
    stats:       { totalLogs:0, flashes:0, sends:0, attempts:0, projects:0,
                   gradeVotes:{ harder:0, right:0, softer:0 } },
    updatedAt:   new Date().toISOString()
  };

  setDoc(
    doc(window._db, 'gyms', route.gymId, 'centres', route.centreId, 'routes', routeId),
    route
  ).then(function() {
    WallMap.routes.push(route);
    WallMap.draw();
    ilToast('Route placed');
  });
}
```

---

## Member Route Logging

### Where it fits in the existing log flow

In renderLogClimbPanel() (in js/log.js), add a toggle above the existing grade
picker: "Gym routes" | "Standalone."

Standalone: existing flow unchanged.
Gym routes: hides grade picker, shows WallMap canvas in member mode.

Member selects a route from the map. The route card slides up. Member taps an
outcome. The climb is added to climbLog with routeId attached:

```js
// Modified climb object when logging against a gym route
climbLog.push({
  grade:    route.grade,           // from the route record
  outcome:  outcome,               // 'flashed' | 'sent' | 'attempt' | 'fell' | 'project'
  routeId:  route.id,
  gymId:    route.gymId,
  centreId: route.centreId
});
```

### Updating route stats

When a session is saved (saveSession()), for each climb with a routeId:

```js
// Increment the route's stats document
// Use Firestore increment() to avoid read-then-write race conditions
var routeRef = doc(window._db,
  'gyms', climb.gymId, 'centres', climb.centreId, 'routes', climb.routeId);
setDoc(routeRef, {
  stats: {
    totalLogs: increment(1),
    flashes:   outcome === 'flashed' ? increment(1) : increment(0),
    sends:     outcome === 'sent'    ? increment(1) : increment(0),
    // etc.
  },
  updatedAt: new Date().toISOString()
}, { merge: true });
```

Import increment from Firestore:
```js
import { increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

---

## Route Photo Upload

Photos are optional per route. When a setter attaches a photo, it is uploaded to
Firebase Storage and the download URL stored on the route document.

```
Firebase Storage path:
  gyms/{gymId}/centres/{centreId}/routes/{routeId}/start.jpg
```

Upload flow in the route form:

```js
function uploadRoutePhoto(file, gymId, centreId, routeId) {
  var storageRef = ref(window._storage,
    'gyms/' + gymId + '/centres/' + centreId + '/routes/' + routeId + '/start.jpg');
  return uploadBytes(storageRef, file)
    .then(function(snapshot) { return getDownloadURL(snapshot.ref); })
    .then(function(url) {
      return setDoc(
        doc(window._db, 'gyms', gymId, 'centres', centreId, 'routes', routeId),
        { photoUrl: url, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    });
}
```

Firebase Storage requires Blaze plan (pay-as-you-go). Cost at small scale is
negligible — photos are small JPEGs, typically 200-500KB each.

---

## Security Rules

Full rules covering user data, gym data, routes, and wall maps.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User's own data — read/write only by that user
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Gym info — any authenticated user can read
    // Only gym admin can write
    match /gyms/{gymId}/info/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.role == 'admin'
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.gymId == gymId;
    }

    // Wall map — any authenticated user can read (needed to render the map)
    // Only admin can write
    match /gyms/{gymId}/centres/{centreId}/wallMap/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.role in ['admin']
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.gymId == gymId;
    }

    // Routes — any authenticated user can read
    // Setters and admins can write
    match /gyms/{gymId}/centres/{centreId}/routes/{routeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.role in ['setter', 'head_setter', 'admin']
        && get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/info)
             .data.gymId == gymId;
    }
  }
}
```

Firebase Storage rules (add in Storage > Rules tab):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /gyms/{gymId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)/profile/info)
             .data.role in ['setter', 'head_setter', 'admin']
        && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)/profile/info)
             .data.gymId == gymId;
    }
  }
}
```

---

## Step 3 — RGP Webhook (Gym Pilot)

Do after Firebase is working and a gym partner is confirmed.

RGP fires Zapier events (new member, check-in, booking) which POST to a Firebase
Cloud Function URL.

```js
exports.rgpWebhook = functions.https.onRequest(async (req, res) => {
  const { email, name, gymId, centreId } = req.body;
  try {
    // Look up or create Firebase Auth user by email
    // Create or update users/{uid}/profile/info with gymId, centreId, role:'member'
    // Send welcome email (optional — requires Blaze plan for outbound calls)
    res.status(200).send('ok');
  } catch(e) {
    console.error('rgpWebhook error:', e);
    res.status(500).send('error');
  }
});
```

Cloud Functions with outbound calls require Blaze plan. ~£5/month at small scale.

---

## Infrastructure

Domain: betalog.co.uk, via Cloudflare, ~£8-10/year, auto-renewal on. Do not let lapse.

DNS records:
```
Type  Name  Value
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
CNAME www   benjuicemcjuice.github.io
```

GitHub Pages: Settings > Pages > Custom domain > betalog.co.uk > Enforce HTTPS.

Firebase: under personal Google account. Keep config out of public repo.
Firebase Storage: required for route photos — needs Blaze plan.

---

## Legal (before taking money or storing member data)

- Privacy policy: what is stored, why, how long, user rights
- Terms of service: liability, training advice disclaimer, account termination
- GDPR: lawful basis, right to erasure
- Age gating: gyms have under-18 members — 18+ or parental consent
- DPA with each gym: required before member emails flow from RGP to Firebase
- Business registration: sole trader automatic in UK; Ltd when revenue is significant

---

## Common Issues

"Changes aren't showing on the live site"
Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac). Or wait 2 minutes.

"Console says Firebase is not defined"
Firebase script tags must come before your own script tags.

"Sign in popup is blocked"
signInWithGoogle() must be called directly from a button onclick handler.
Not inside setTimeout, a promise, or an async callback.

"Data isn't syncing between devices"
Confirm syncFromFirebase() is inside onAuthStateChanged.
Check F12 console for Firestore permission errors — usually a security rules issue.

"App breaks after a file split"
F12 > Console tells you exactly which function is undefined. Move it.

"Wall map not rendering"
Confirm canvas.width and canvas.height are set (not just CSS width/height).
Canvas dimensions must be set via JS, not CSS, or drawing will be blurry/wrong-scale.

"Route dots are hard to tap on mobile"
Tap target is 1.8× visual radius. If still an issue, increase to 2.2× and add
proximity list fallback for dense sections (see Dense section handling above).

"Firebase Storage upload fails"
Check Blaze plan is active. Check Storage security rules allow the user's role.
Check Firebase Storage is imported in the module block in index.html.

"Cloud Functions won't make outbound calls"
Free Spark tier blocks outbound network. Upgrade to Blaze.

---

## Decision Log

Date       Decision                                  Reason
Mar 2026   Single file to start                      No build complexity, fast iteration
Mar 2026   ES5 style throughout                      Readable without a transpiler
Mar 2026   localStorage as primary store             Offline-first; climbing walls have poor signal
Mar 2026   AI via Groq, user-supplied key            Zero running costs during validation
Mar 2026   Split before Firebase                     Can't debug a 7,670-line file with a backend on it
Mar 2026   GitHub Pages hosting                      Free, auto-deploy, no server to manage
Mar 2026   Firebase for backend                      Firestore + Auth + Storage + Functions covers everything
Mar 2026   Offline-first sync pattern                localStorage is instant and always available; Firebase syncs in background
Mar 2026   Canvas 2D for wall map                    No external library needed; SVG polygons for sections, Canvas for rendering; percentage coordinates for screen-size independence
Mar 2026   Plan view over photos                     Photos distort and go stale; SVG plan works for any wall shape and never needs retaking
Mar 2026   Per-route optional photo, not per-section Section photos go stale on repaint; a starting-holds photo is tied to one route's lifetime
Mar 2026   Percentage coordinates in wallMap         Renders correctly at any screen size without coordinate recalculation in the database
Mar 2026   Role field on user profile                Setter and admin capabilities controlled by role, not a separate collection; simpler queries
Mar 2026   Firestore increment() for route stats     Avoids read-then-write race condition when multiple members log the same route simultaneously
Mar 2026   wallmap.js as its own file                Wall map system is large enough to warrant isolation; keeps log.js focused on session logging

---

Last updated: March 2026
App version: v4.3
See betalog_vision.md for product strategy, roadmap, and commercial notes.
