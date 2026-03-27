# BetaLog — Default Routines

Reference doc for all default routines seeded into new BetaLog accounts.
Update this file when routines are added, removed, or their parameters change.

Last updated: 2026-03-24

---

## Notes

- Climbing routines need a `discipline` field (boulder / lead / toprope) and a `climbingParams` block. Claude Code should check the current schema before implementing — this doc describes behaviour, not code shapes.
- Hangboard exercises should use a `"finger_strength"` category tag. Display alongside existing muscle-group categories in the exercise library. The AI coach should treat finger strength volume separately from pull/push gym volume — it is a primary climbing performance limiter at V7+ / 7a+.
- All default routines are merge-seeded on app load — safe to re-run, won't overwrite user edits.
- User can edit or delete any default routine. A restore option in Settings should recover them (same pattern as exercise library restore).

---

## Climbing Routines

One routine stored per discipline for each protocol: boulder, lead, toprope.
Total: 12 default climbing routines.

---

### 4x4s

**Purpose:** Power endurance. Trains recovery between hard moves and sustained output across multiple efforts. Classic pre-competition sharpener.

**Protocol:**
- 4 climbs back to back at target grade, no rest between climbs
- 4 minutes rest between rounds
- 4 rounds total (16 climbs)

**Grade guidance:**
- Boulder: 2–3 grades below redpoint max
- Lead/Toprope: comfortable onsight grade — must complete all 4 each round

**Configurable:** target grade (user sets before session)

**Defaults per discipline:**

| | Boulder | Lead | Toprope |
|---|---|---|---|
| Climbs per round | 4 | 4 | 4 |
| Rounds | 4 | 4 | 4 |
| Rest between rounds | 4 min | 4 min | 4 min |
| Target grade | user sets | user sets | user sets |

**Stored as:** `"4x4s — Boulder"`, `"4x4s — Lead"`, `"4x4s — Toprope"`

---

### Pyramid

**Purpose:** Volume across a grade range. Builds base fitness and confidence at sub-max grades while touching limit grades.

**Protocol:**
- Climb up through grades then back down
- Boulder example: V3 → V4 → V5 → V4 → V3
- Lead example: 6b → 6c → 7a → 6c → 6b
- Rest between climbs: as needed — quality over speed
- One send per grade step

**Configurable:** peak grade (user sets; app steps up and down from there)

**Defaults per discipline:**

| | Boulder | Lead | Toprope |
|---|---|---|---|
| Climbs | 5 | 5 | 5 |
| Rest | as needed | as needed | as needed |
| Target grade | user sets peak | user sets peak | user sets peak |

**Stored as:** `"Pyramid — Boulder"`, `"Pyramid — Lead"`, `"Pyramid — Toprope"`

---

### ARCing

**Purpose:** Aerobic base. Continuous easy climbing to build the aerobic energy system in the forearms. Used in base-building phases and recovery weeks. ARC = Aerobic Restoration and Capillarity.

**Protocol:**
- Climb continuously for 20–45 minutes at very easy grade
- Never get pumped — downgrade immediately if a pump builds
- Boulder: traverse or link easy problems continuously
- Lead/Toprope: lap the same easy route repeatedly

**Grade guidance:**
- Boulder: 4–5 grades below max (trivially easy)
- Lead/Toprope: well below onsight grade — duration is the point, not difficulty

**Configurable:** duration (default 20 min, up to 45 min)

**Defaults per discipline:**

| | Boulder | Lead | Toprope |
|---|---|---|---|
| Duration | 20 min | 20 min | 20 min |
| Target grade | user sets | user sets | user sets |

**Stored as:** `"ARCing — Boulder"`, `"ARCing — Lead"`, `"ARCing — Toprope"`

---

### Endurance Laps

**Purpose:** Route endurance. Builds capacity to sustain climbing on pumpy routes by lapping the same route with controlled rest.

**Protocol:**
- Pick a comfortable route (not max effort)
- Complete laps with timed rest between each
- Should feel progressively harder — if too easy, reduce rest
- Boulder: repeat the same problem or circuit

**Configurable:** target grade, number of laps, rest between laps

**Defaults per discipline:**

| | Boulder | Lead | Toprope |
|---|---|---|---|
| Laps | 6 | 6 | 6 |
| Rest between laps | 2 min | 3 min | 3 min |
| Target grade | user sets | user sets | user sets |

**Stored as:** `"Endurance Laps — Boulder"`, `"Endurance Laps — Lead"`, `"Endurance Laps — Toprope"`

---

## Hangboard Routines

All hangboard routines are tagged `finger_strength`.

---

### Max Hangs

**Purpose:** Maximum finger strength and recruitment. Short, heavy, high-quality hangs with full recovery. Primary strength method for advanced climbers.

**Protocol:**
- 10s hang at near-maximal load
- 3 minutes rest between sets (single rep per set — no within-set rest)
- 6 sets per grip
- Load: add weight until 10s is barely completable; use assistance if not yet at bodyweight
- Grips: Half Crimp then Open Hand

**Defaults:**

| Grip | Hang | Rest | Reps | Sets |
|---|---|---|---|---|
| Half Crimp | 10s | 3 min | 1 | 6 |
| Open Hand | 10s | 3 min | 1 | 6 |

Weight: bodyweight by default — user adds or subtracts before session.

**Stored as:** `"Max Hangs"`

---

### 7:3 Repeaters

**Purpose:** Finger strength endurance. High volume, moderate intensity. Builds capacity to sustain grip force across multiple hard moves or clips.

**Protocol:**
- 7s hang / 3s rest × 6 reps = one set
- 2.5 minutes rest between sets
- 4 sets per grip
- Grips: Half Crimp then Open Hand

**Defaults:**

| Grip | Hang | Rep rest | Reps | Set rest | Sets |
|---|---|---|---|---|---|
| Half Crimp | 7s | 3s | 6 | 2.5 min | 4 |
| Open Hand | 7s | 3s | 6 | 2.5 min | 4 |

Weight: bodyweight by default.

**Stored as:** `"7:3 Repeaters"`

---

### Sub-Max Repeaters

**Purpose:** Sub-maximal daily finger loading across multiple grip positions. Builds connective tissue strength and contact strength with low nervous system cost. Designed to be done daily or near-daily as a maintenance and development protocol.

**Protocol:**
- 10s hang / 20s rest per rep
- 1 set per grip — no set rest needed, the 20s between reps covers transition time
- Move directly from one grip to the next — the 20s rest doubles as changeover time
- 6 grip positions in sequence, progressing from full-hand to isolated two-finger positions
- Bodyweight throughout — intensity comes from grip isolation, not added load

**Grip sequence:**

| Order | Grip | Reps | Hang | Rest |
|---|---|---|---|---|
| 1 | Full Hand (4-finger drag) | 6 | 10s | 20s |
| 2 | Front 3 Open (index + middle + ring) | 6 | 10s | 20s |
| 3 | Front 2 Open (index + middle) | 2 | 10s | 20s |
| 4 | Middle 2 Open (middle + ring) | 2 | 10s | 20s |
| 5 | Front 2 Half Crimp (index + middle) | 2 | 10s | 20s |
| 6 | Middle 2 Half Crimp (middle + ring) | 2 | 10s | 20s |

Total session: 20 reps × (10s hang + 20s rest) = ~10 minutes

**Stored as:** `"Sub-Max Repeaters"`

---

## Hangboard Timer — UI & Behaviour Spec

Reference screenshot: `IMG_9533.png` (Free Hang app, purple timer screen)

---

### Get Ready phase

- Before the first rep of every session, show a 15-second countdown phase labelled **"GET READY"**
- Same full-screen timer layout as the hang/rest phases
- Audio cue at 3s, 2s, 1s, then a distinct start beep when the hang begins
- This is on by default; user can skip it by tapping Skip

---

### Timer screen layout

Current layout issues to fix (based on screenshot):

**"HANG" / "REST" label** — currently small caps above the number. Make it much larger — should read clearly at a glance from arm's length while hanging. Suggested: same weight as the countdown number, roughly half its size.

**Countdown number** — keep large, centred, dominant. No change needed.

**Grip name** ("4 Finger · Half Crimp") — keep as is, bold, below the number.

**Progress indicator** ("Grip 1/1 · Set 1/1 · Rep 3/6") — make larger and highlight the active segment:
- Each segment (Grip X/X, Set X/X, Rep X/X) displayed as a pill or chip
- The segment that is currently incrementing should be visually highlighted (white background, coloured text, or increased opacity) vs the others which are muted
- During a hang: Rep is active → highlight Rep chip
- Between reps (rest): Rep is still active
- Between sets: Set is active → highlight Set chip
- Between grips: Grip is active → highlight Grip chip

---

### Controls

Pause / Skip / End — keep layout as is.

**"Discard session"** — rename to **"Cancel session"** for clarity.

---

### Bug — timer continues after exit

**Issue:** Closing or cancelling the timer screen does not stop the audio or the underlying interval/timeout. Beeps and countdown continue in the background.

**Fix required:**
- On exit (X button, Cancel session, or any navigation away from the timer), all `setInterval`, `setTimeout`, and Web Audio / `AudioContext` instances must be cleared/closed immediately
- Recommended pattern: store all timer IDs in a ref or module-level variable on start; call a single `cleanupTimer()` function on every exit path
- This must cover: X button, Cancel session tap, browser back gesture, and navigating to another tab/page while the timer is active
- If using Web Audio, call `audioContext.close()` on cleanup
- Add a check: if the timer component unmounts and cleanup has not been called, call it automatically (React `useEffect` cleanup function is the right place for this)

