# BetaLog — Bouldering Competitions

> Written 2026-09-26 from Ben's ask: *"a way in which an admin (climbing gym say) can set up a
> bouldering competition. This would be on a date and at a location, using a scoresheet that
> people can virtually enter."* Rewritten the same day, ready for build, after Ben's second pass:
> *"I'd want the comp specific 'sessions' to be slightly different though with comp style logging
> like attempt / zone / top / number of gos etc (max of x value — to be set when creating comp).
> The setter can grade each climb but can toggle whether to show the grade or not."*
>
> Build status is `BACKLOG.md` **BTL-B74**. The decisions taken are §12; the build order is §11.

---

## 1. What it is

A gym runs a bouldering comp the same way every gym does: thirty-odd problems go up, each with a
number and a point value, every entrant gets a paper scorecard, marks their goes, zones and tops,
hands the card in, and someone at the desk adds it all up while everyone waits. The scorecard is
the whole event. It is also the weak point — cards get lost, handwriting gets misread, the
adding-up takes an hour, and the leaderboard exists only once, on a whiteboard, at the end.

BetaLog replaces the card. An **organiser** creates the competition in the app — a name, a date,
a venue, a scoresheet of problems, the scoring — and gets a **join code** for the poster. An
**entrant** types the code, picks a category, and has the scoresheet on their phone. During the
comp they log each problem the way a comp is scored: a go, a zone, a top, up to the comp's maximum
number of goes. **The scorecard is a session in their own log**, created by the first go and
filled in as they climb, so the comp is in History that night and every graded top is a send the
pyramid can see. The **leaderboard** is live for everyone entered. When the organiser closes the
comp the results are final.

Three things it is not:

- **Not a judging system.** Goes and tops are self-reported, exactly as on a paper card. §8 says
  what the organiser can do about a wrong one and what the app does not pretend to know.
- **Not the route board.** Comp problems live for one day and carry a number and points, not a
  setter, a section or a lifecycle. The route board (`betalog_vision.md`) may one day feed a
  scoresheet; the scoresheet does not depend on it.
- **Not gym onboarding.** No `gyms/` collection, no staff table, no console setup. Whoever creates
  a comp organises it. §3 says why, and how a gym attaches later.

---

## 2. The two people and their day

### The organiser

1. Opens **Competitions** (§9), taps *Organise a competition*.
2. **Details**: name, date, start and end time, venue (the logger's venue picker, so *Redpoint
   Bristol* is one tap if they have climbed there), a line of notes for the poster.
3. **Scoring** (§4): the maximum number of goes per problem, what a top on each go is worth as a
   percentage of the problem's points, what a zone is worth, and whether every problem counts or
   only the best N. All prefilled with defaults that most comps will not touch.
4. **Categories** (§5): a list of labels, default *Open*.
5. **Scoresheet** (§6): the problems. A new comp starts with **10 problems** — green 1–3 (10 points),
   blue 4–6 (20), red 7–8 (30), black 9–10 (50) — and the generator makes any other count by circuit
   in one go. Each row can be edited after: number, colour, points, grade, and **Show grade** on or
   off. (Ben, 2026-09-27: ten by default, was thirty.)
   **Copy to a new comp**, on an old comp's Manage tab, starts the draft from that comp instead:
   type, times, venue, notes, scoring, categories and the scoresheet with its grades left blank (a new
   comp is a new set), dated today —
   most comps a wall runs are the same format.
6. Saves. The comp is a **draft**. Nothing is visible to anyone else yet.
7. Taps **Open entries**. The comp gets its join code, `CP-XXXXX`, shown large with a QR code
   that opens `betalog.co.uk/comp/CP-XXXXX`. Entrants can join from now until the organiser closes
   the comp.
8. On the day, taps **Start scoring**. Goes are accepted from now.
9. Watches the **Leaderboard** on their own phone, or on a laptop signed in and left on the desk.
10. Taps **Close**. Goes stop. Results are final, hidden grades are revealed, and the board says so.
11. Can **void** a problem on an entrant's card at any point, with a note the entrant sees. Can
    **export** the results as CSV.

### The entrant

1. Sees the poster and scans the QR code, which opens the comp in BetaLog (sign-in first if
   needed) — or opens BetaLog, taps **Competitions**, and types `CP-XXXXX` into *Join*.
2. Sees the comp card: name, date, venue, how scoring works in two sentences (*Max 5 goes per
   problem. Top first go 100%, second 80%, third 60%, then 50%. Zone 25%. Best 10 count.*). Enters
   a display name (prefilled from the profile) and picks a category. Taps *Enter*.
3. On the day, the Log page shows a banner — *Redpoint Autumn Comp is live · Open scorecard* —
   and the Dashboard card does the same.
4. The **scorecard** is the problem list (§7). Each row: number, colour, points, grade if shown,
   and three controls: a **goes** stepper, **Zone**, **Top**. The running score is at the top. The
   card works with no signal.
5. The **Leaderboard** tab shows their category and Overall, live, with their own row pinned.
6. That evening the comp is in **History** as a session with a comp badge; tapping it shows the
   card. Graded tops are sends and flashes in the log; graded problems tried and not topped are
   attempts, with the real number of goes. Nothing needs adding by hand.

---

## 3. Who can organise — and why there is no gym table yet

The data model already specifies `gyms/{gymId}/centres/{centreId}/staff/{uid}` with `admin` and
`setter` roles, and `firestore.rules` today has a single hard-coded admin UID with a comment
promising a `centreAdmins/{uid}` lookup. None of it exists in code. Building it first would make
the comp feature wait on gym onboarding — a console session per gym before anyone can run a
comp — and the first comp is going to be one person at one wall who wants a scoresheet on Saturday.

**Any signed-in user can create a competition and becomes its first organiser.** The comp document
carries `organisers: [uid, …]`; an organiser can add another by that person's friend code. Abuse
surface is small: a comp is invisible until someone has its code, an entrant sees only the comps
they have entered, and nothing an organiser does touches anyone else's log beyond the card the
entrant chose to keep there.

When the `gyms/` tree is built, a comp gains `gymId` and `centreId` (nullable now, exactly as
`Climb` already has them), a centre's staff become organisers of its comps automatically, and a
gym's comp history rolls up under the centre. Nothing about the scoresheet changes.

---

## 4. Scoring

One format, with the knobs a gym scorecard actually has. Every problem has a point value; what an
entrant earns on it depends on whether they topped it, on which go, or reached the zone.

```ts
interface CompScoring {
  maxAttempts:          number      // 1–20; the stepper stops here. Default 5
  topPercentByAttempt:  number[]    // length === maxAttempts; % of problem.points for a top on go n.
                                    // Default [100, 80, 60, 50, 50]
  zonePercent:          number      // % of problem.points for a zone without a top. Default 25
  bestN:                number|null // only the entrant's best N problems count; null = all. Default null
}
```

**Score on one problem** — `scoreProblem(scoring, problem, result)`:

| Result | Score |
|---|---|
| Top on go *n* | `problem.points × topPercentByAttempt[n − 1] / 100` |
| Zone, no top | `problem.points × zonePercent / 100` |
| Goes but no zone, or untouched | 0 |

**Score on a card** — `scoreCard(scoring, problems, card)`: the sum of problem scores, over the
best `bestN` if set. Returns `{ score, tops, zones, attempts, flashes, counted: problemId[] }`,
where `attempts` is the total goes across every problem (the IFSC tiebreak) and `flashes` is tops
on go 1.

**Ranking** — `rankEntries(comp, entries)`: score descending, then tops, then zones, then fewer
total goes, then a shared rank (1, 2, 2, 4). Scores display to one decimal place when the
percentages make them fractional and as integers otherwise.

Why percentages of the problem's points rather than a flat table: it lets the same comp mix a
20-point blue and a 50-point black and still reward a flash on each proportionally, which is what
every "points by circuit, less for more goes" card does. A gym that wants IFSC-style flat scoring
sets every percentage to 100 and the tiebreaks do the rest. Changing the table after entries
exist is refused by the editor once the comp is live (§8).

The editor validates: `maxAttempts` an integer 1–20; every percentage 0–100 and the top table
non-increasing (a top on go 3 cannot be worth more than on go 2); `bestN` null or 1 to the number
of problems.

---

## 5. Categories

`categories: string[]`, default `['Open']`. An organiser edits the list freely (*Female · Male ·
Under 16 · Masters*, or ability bands). An entrant picks exactly one at entry and can change it
until scoring starts. The leaderboard shows one board per category plus **Overall** when there is
more than one category. Categories are labels, not rules: the app checks nobody's age, gender or
grade, any more than a paper form does, and the entry sheet says so.

---

## 6. The scoresheet

**Comp type.** `discipline` on the comp document is `'boulder'` or `'toprope'`, picked in Details as
*Boulder* or *Rope*; a comp without it is a boulder comp. A rope comp uses the same goes / zone / top
card — the zone a marked hold, the top the chains — so only two things follow the type: the grade
picker (V-scale for boulder, French for rope; the grade is a pick from the scale, not free text, and
`validateComp` refuses a grade off it) and the discipline the comp session and its climbs are logged
under. Changing the type clears the grades. It is fixed once scoring is live. Ben, 2026-09-27: rope
comps on the same card now; lead highpoint scoring waits for setter feedback.

```ts
interface CompProblem {
  id:          string        // "p12" — stable; the number can be edited, the id cannot
  number:      number        // what is written on the wall
  colour:      string|null   // a circuit colour name or hex; display only
  points:      number        // > 0
  grade:       string|null   // "V4" / "6b" — the setter's grade, or null if not graded
  gradeSystem: 'v'|'french'|null
  showGrade:   boolean       // false = entrants do not see the grade until the comp closes
  label:       string|null   // free text, "Slab 3"
}
```

**The generator** (`generateProblems(count, circuits)`) makes `count` rows numbered from 1, colour
and points from a circuits table the organiser edits in place (`[{colour:'green', points:10,
from:1, to:8}, …]`), grades null, `showGrade` false (hidden). Rows can then be edited singly, reordered by
number, added and deleted. Deleting a problem that has results on any card is refused once the
comp is live.

**Grades and the toggle.** The setter can grade every problem; whether entrants see the grade is
`showGrade`, per problem, with a switch above the list that says the state in words — *Grades NOT visible to entrants*, *3 of 10 grades visible to entrants*, *Grades visible to entrants* — and a legend under it for the eye (open: entrants see it; crossed: hidden until the close). **Grades start hidden** (`showGrade: false` from the generator and *Add a problem*; Ben, 2026-09-27). A hidden grade must not
reach an entrant's phone at all, because the comp document is readable by everyone entered. So:

- The comp document's `problems[].grade` is **null for every problem with `showGrade: false`**.
- The real grades for those live in `competitions/{code}/private/grades` —
  `{ [problemId]: { grade, gradeSystem } }` — readable and writable by organisers only.
- **Close** copies the private grades onto `problems[]` and clears the private document. From that
  moment every entrant's device sees the grade, and their comp session's climbs are re-derived
  (§7) so the log gains the sends it could not see during the comp. History says *grades revealed
  when the comp closed* on the card.

**Every problem must carry a grade** — `validateComp` refuses the sheet otherwise (Ben, 2026-09-27: *"I want all climbs to be graded"*), so every problem tried is a climb in the entrant's log, as normal as any free session's. A comp saved before the rule may still hold an ungraded problem: it is scored like any other and never becomes a climb.

---

## 7. The comp session — how the card lives in the log

### One object, two homes

The entrant's card is a **climb session in their own log** with a `comp` block, and a **mirror in
the comp's `entries` subcollection** for the leaderboard. The session is the source of truth for
the entrant's own goes; the mirror is written after it, every time it changes, and re-pushed whole
on reconnect. Nothing else writes the entrant's goes except an organiser's void (§8), which arrives
through the mirror and is applied to the session.

```ts
// Session gains:
comp: {
  code:       string          // "CP-K7M2Q"
  name:       string          // denormalised for History
  category:   string
  card:       { [problemId]: ProblemResult }
  problems:   CompProblem[]   // a copy of the sheet as last seen, so History renders offline
  scoring:    CompScoring     // ditto
  status:     'live'|'closed' // as last seen
  voids:      Correction[]    // organiser voids, with notes
} | null

interface ProblemResult {
  attempts:    number        // 0..maxAttempts — goes taken
  zone:        boolean
  zoneAttempt: number|null   // the go on which the zone was reached
  top:         boolean
  topAttempt:  number|null   // the go on which it was topped
  at:          string        // ISO, last change
}

// Climb gains two nullable fields:
compCode:      string|null
compProblemId: string|null
```

The session itself: `type: 'climb'`, `discipline` the comp's type (`'boulder'` or `'toprope'`), `date` the comp date, `location` the
comp venue name, `notes` empty (the entrant may add to it after the close), `difficulty` 3 until
edited, `routineId` null. Because it is a climb session, every existing reading — the pyramid, the
level, History's summary line, the CSV export, the public profile — works on it unchanged.

### Climbs are derived, never edited

`session.climbs` is **recomputed from `comp.card` and `comp.problems`** on every change by the
pure `climbsFromCard(comp)`:

| Problem state | Climb |
|---|---|
| No grade visible (null, or hidden until close) | none |
| Graded, 0 goes | none |
| Graded, goes but no top | `outcome: 'attempt'`, `attempts` = goes |
| Graded, top on go 1 | `outcome: 'flashed'`, `attempts: 1` |
| Graded, top on go n > 1 | `outcome: 'sent'`, `attempts: n` |

Each climb carries `compCode` and `compProblemId`, `location` from the session, `grade` and
`gradeSystem` from the problem. Zones do not make a climb: a zone is a comp fact, not a grade fact.
This is the first place `Climb.attempts` carries a real count — BTL-B9 noted the field has been
`1` on every row; nothing in `stats.js` or `pyramid.js` reads it (they count rows), so a real
number is safe there, and the History summary can show it.

### What the card controls do

The scorecard row for a problem has a **goes stepper** (− n +), a **Zone** button and a **Top**
button. All three go through one pure reducer, `applyCardAction(card, scoring, action)`, so the
invariants hold whatever order the taps come in:

| Action | Effect |
|---|---|
| `+` | `attempts + 1`, refused at `maxAttempts` |
| `−` | `attempts − 1`; if the new count is below `topAttempt`, the top is cleared; below `zoneAttempt`, the zone is cleared |
| Zone on | if `attempts` is 0 it becomes 1; `zone: true`, `zoneAttempt: attempts` |
| Zone off | `zone: false, zoneAttempt: null`; if `top` is set, it is cleared too (a top implies a zone) |
| Top on | if `attempts` is 0 it becomes 1; `top: true, topAttempt: attempts`; if no zone yet, `zone: true, zoneAttempt: attempts` |
| Top off | `top: false, topAttempt: null`; the zone stays |

Invariants, tested: `0 ≤ attempts ≤ maxAttempts`; `top ⇒ zone`; `zoneAttempt ≤ topAttempt ≤
attempts` where set. A row at `maxAttempts` without a top reads *max goes*. The row's score updates
on every action. The stepper is the `NumericStepper` from `ui/`.

### Offline and sync

The session lives in `il_sessions` and syncs as sessions always have. The mirror write to
`competitions/{code}/entries/{uid}` is a `setDoc` of the whole card, so a lost write is repaired
by the next one, and on regaining signal (the `online` event, and every app foreground) the hook
re-pushes the current card once. An entrant's device also listens to its own entry document while
the card is open, for voids.

### What History does with it

- The session row shows a **Comp** badge and the comp name; the summary line reads *Redpoint
  Autumn Comp · 12 tops · 9 zones · 41 goes · 3rd in Open* after the close, without the placing
  before.
- Tapping a **live** comp session opens the scorecard, not the climb editor. Delete is hidden.
- Tapping a **closed** one shows the card read-only with the placing and the voids, plus the
  session's notes editable. Delete is allowed and removes the session from the log only; the
  result stands in the comp. The climb editor never opens on a comp session.
- The CSV export gains `compCode` on each climb row.

---

## 7b. The clock — auto end (BTL-B86) — *the close at the end is replaced by §7d*

Ben, 2026-09-27: *"can we have the comp auto end on Comp end date/time, which can be overridden by
creator … in the top of the Score card show how much time of comp is left"*.

- `autoClose` on the comp (absent = on; the editor's *End scoring automatically* switch). With it on
  and an end time set, `compEndMs(comp)` is `date` + `endAt` on the device's own clock — the venue's
  wall clock, which everyone at the comp shares. The end must be after the start (`validateComp`).
- **Entrants:** at the end the scorecard stops taking goes (`live` is false once `now ≥ end`) and says
  *Time's up*. A strip above the score shows *2h 14m left · Scoring ends at 17:00* while live (red in
  the last 15 minutes), *Starts in …* while entries are open, *Live · no set end* with the switch off.
- **The close** reveals hidden grades, which only an organiser can read, and the app has no server
  (Spark plan). So an organiser's device runs `setCompStatus(code, 'closed')` — at the end time if a
  comp screen is open (`useComp` sets a timer), or the moment one opens after it. Until then the comp
  is still `live` in Firestore; the cards are shut by the clock, not the status.
- **Override:** change the end time (the Details fields stay editable while live) or turn the switch off.
- Not enforced in the rules: an entrant's card could still be written after the end by an old build or
  a hand-made request. A rules check needs the end stored as a timestamp — backlog if it matters.

## 7c. Stages as the app says them (BTL-B87)

The badge on a comp, on its pages and on each *Mine* row, says its stage (§7d has the flow they
map to). The *Mine* list reads each comp once per visit for it (`useCompsNow`). The same words are
the guide's *How a comp runs* (`help.html#comp-flow`), linked as *How comps work* from the comps
page, the editor and the scorecard; the SDLC checklist keeps that list true.

## 7d. The stage flow — automatic start, judging, reopen (BTL-B88)

Ben, 2026-09-27, replacing §7b's end-closes-the-comp: *"Auto end goes to review / judging mode. So
flow is Draft, Pending start, start (when start date/time reached), Finished (when end date
reaches), Judging period (judges check score and adjust as per), Closed and leaderboard etc
updated."* Then: *"Reopen scoring. Yea. Done by amending the end date perhaps. A reopen button and
date picker."* Finished and Judging are **one stage** (the recommendation, taken — nothing happens
between the end time and the judges starting).

| Stage (badge) | `status` | Starts | Entrants | Organiser / judges |
|---|---|---|---|---|
| Draft | (device-local) | *Organise a competition* | cannot see it | edit anything |
| Pending start | `open` | *Open entries* | enter; card shown, locked | edit anything |
| Running | `live` | **automatically at the start date/time**; *Start now* overrides | log goes / zone / top; countdown | end time only (below) |
| Judging | `judging` | **automatically at the end date/time** (switch on) | card locked, *Time's up*; sees adjustments with the note | check cards, void / adjust (BTL-B85), **Reopen scoring**, **Close** |
| Final | `closed` | the organiser taps *Close* — never automatic | final; hidden grades revealed; climbs final in the log | export |

**The clock in the data.** On save the organiser's device stores `startMs` and `endMs` (epoch ms of
`date` + `startAt` / `endAt` on its clock — the venue's wall clock) beside the display strings.
`endMs` is null when *End scoring automatically* is off.

**Enforced in the rules, not only the app.** An entrant's card write is allowed while
`status == 'live'`, or `status == 'open'` and `request.time ≥ startMs` (the start has passed but no
device has flipped the status yet) — and in both cases only while `endMs` is null or
`request.time < endMs`. So cards open and lock on the clock even with no organiser's phone awake,
and an old build cannot score after the end. The stored status catches up on the next organiser
device that sees the comp (`open → live` after the start, `live → judging` after the end). Needs a
rules deploy by Ben (`firebase deploy --only firestore:rules`), before the build that relies on it.

**Date and time amendments in flight.**

| Stage | Date | Start | End | Auto-end switch |
|---|---|---|---|---|
| Draft / Pending start | yes | yes | yes | yes |
| Running | locked | locked | extend, or bring forward — never earlier than now | yes |
| Finished — judging | locked | locked | only through **Reopen scoring** | — |
| Final | locked | locked | locked | — |

**Reopen scoring** (Manage, judging only): a button that opens a date-and-time picker for the new
end, which must be in the future; saving sets `endAt` / `endMs` and `status: 'live'`, and every card
opens again with the new countdown. For a lost half hour, not a second comp.

**The workflow panel.** Ben, 2026-09-27: *"obvious in the comp main panel what the next steps are
… states shown as phases at the top and the button to move on, reopen etc … like a workflow type
thingy."* At the top of Manage (organisers) a stepper of the five stages — done ones ticked, the
current one filled, later ones grey — and under it one **Next step** card: what happens next, when,
and the button that does it. Entrants see the same stepper on Details and the scorecard, without the
buttons, and a line of what happens next for them.

| Stage | Organiser's next-step card | Buttons | Entrant's line |
|---|---|---|---|
| Draft | *Finish the details and grade every problem, then open entries.* Lists what is missing | **Open entries** | — |
| Pending start | *Scoring starts by itself at 10:00 on Sat 18 Oct — 2d 4h. Share the code.* N entered | **Start now** · *Edit* | *Scoring opens at 10:00* |
| Running | *Scoring ends by itself at 17:00 — 2h 14m left.* N entered, N cards with goes | **End scoring now** · *Change end time* | countdown |
| Finished — judging | *Check the cards: void or adjust anything wrong, then close. Closing reveals hidden grades and makes results final.* | **Close and publish results** (second tap) · **Reopen scoring** (date-time picker) | *Scoring ended — results after the judges check* |
| Final | *Results are final.* | *Export results* · *Copy to a new comp* | *Final — your climbs are in your log* |

With the automatic end off, Running's card says *No set end — end scoring when you are ready* and
*End scoring now* moves the comp to judging. Every stage change asks for a second tap.

**Depends on.** The leaderboard and voids (step 4) for *"leaderboard etc updated"* at the close; judge
adjustments beyond void are BTL-B85. Order: this flow and the rules → step 4 → BTL-B85.

## 8. Honesty, voids and what the board may say

`betalog_data_honesty_spec.md` applies: the leaderboard describes **what was reported**, not who
climbed best.

- The board's caption is *Scores as entered by climbers · updated 12 s ago*, and after the close
  *Final · closed at 16:42*.
- **Void.** The only correction in the basic version. An organiser opens an entrant's card from the
  leaderboard, taps a problem, taps *Void*, types a note. `entries/{uid}.voids` gains
  `{ problemId, by, at, note, before: ProblemResult }` and the entry's `card[problemId]` is reset
  to no goes. The entrant's device applies the same to the session and shows the note on the row.
  Nothing is deleted; the `before` is kept.
- The scorecard refuses a go outside the live window; the rules enforce it too.
- The editor refuses changes to scoring, `maxAttempts` and the problem list once the comp is live,
  except adding a problem and toggling `showGrade`. Points on an existing problem cannot change
  after the first entry exists. This is what keeps a card scored the same way all afternoon.
- A witness mark and a full edit-with-note are listed for later (§11).

---

## 9. Where it lives in the app — its own URL space

*Revised 2026-09-27.* Ben: *"Would it make more sense if it were a different url slightly and/or
the betalog app had a link to that url / page to save the main app getting too cluttered but
keeping as much look and feel?"* Yes. The first draft put comps in a Friends-style screen inside
the app; that keeps every comp view behind the app's header and bottom tabs and gives a QR code
nothing to land on. A separate site (`comp.betalog.co.uk`) would look cleanest and cost the most:
sign-in does not carry across subdomains, the log write-back gets awkward, and it is a second
build, service worker and set of components. The middle is nearly free.

**Competitions live under `/comp/…` in the same app, with their own shell.** Same codebase, same
sign-in, same data context, same fonts and colours — it is BetaLog — but the `/comp` routes render
without the app's bottom tabs and with a header of their own: a **BetaComp** wordmark and a
*← BetaLog* link back. A QR code on the poster encodes `https://betalog.co.uk/comp/CP-K7M2Q` and
opens that comp directly (sign-in first if needed, then on to the comp). The gym-screen board,
when it comes, is `/comp/CP-K7M2Q/board`.

| Route | What it is |
|---|---|
| `/comp` | **Mine** — comps this account has entered or organises (live first, then upcoming, then closed), a *Join* field for a code, and *Organise a competition* |
| `/comp/new` | The editor for a new draft (§2); the draft is held on this device until *Open entries* gives it a code |
| `/comp/:code` | The comp: **Details** for anyone with the code (name, date, venue, scoring in two sentences, categories, the problem list with the grades that are shown); the **Scorecard** for an entrant (step 3); the **Enter** button for a signed-in visitor (step 3) |
| `/comp/:code/board` | **Leaderboard** — `CompBoard.jsx`; tabs read *Details · Card · Board · Manage* |
| `/comp/:code/manage` | **Manage**, organisers only: status buttons, the code and QR, entrant count, *Edit*, *Export CSV*, *Delete* |
| `/comp/:code/edit` | The editor on an existing comp, organisers only, with the live-time freezes of §8 |

Inside a comp the shell's bottom bar is the comp's own tabs — *Details · Scorecard · Board*, plus
*Manage* for organisers — so a phone at the wall has the same thumb reach as the main app.

**The main app carries two small things and nothing else.** A *Competitions* button in the header
beside Friends, which goes to `/comp`. And a **Dashboard card** in the widget system's shell (step
3): the next comp, *Live now · open scorecard* on the day, the placing for a week after; hidden
until the account has entered or organised a comp, then on by default. The Log page banner from
the first draft is dropped in favour of the card and the deep link — the comp is one tap from the
Dashboard and zero taps from the poster.

**Drafts.** A comp has no Firestore document until *Open entries*, so a draft being built lives
in `il_compDraft` on the organiser's device (not synced, like the Groq key) and survives a reload.
One draft at a time; *Organise a competition* resumes it if there is one.

---

## 10. Data, rules and reads

### Firestore

```
competitions/
  {code}/                          "CP-K7M2Q" — the join code is the document ID
    schemaVersion: 1
    name, date, startAt, endAt, autoClose, venue: {name, lat, lng}, notes,
    status: 'draft'|'open'|'live'|'closed',
    scoring: CompScoring,
    categories: string[],
    boardVisibleToEntrants: boolean,
    problems: CompProblem[],       // grade null where showGrade is false, until close
    organisers: string[], organiserNames: {uid: name},
    gymId: null, centreId: null,
    createdAt, updatedAt, closedAt

    private/
      grades                       { [problemId]: {grade, gradeSystem} } — organisers only

    entries/
      {uid}/
        displayName, category,
        card: { [problemId]: ProblemResult },
        voids: Correction[],
        enteredAt, updatedAt
```

`users/{uid}` gains one synced field, `compEntries: [{ code, name, date, venueName, role:
'entrant'|'organiser' }]` — `il_compEntries` locally, in `SYNC_KEYS`. It is what *Mine* lists
without a cross-collection query.

The join code is `CP-` + five characters from an unambiguous alphabet (no 0/O/1/I), generated on
*Open entries* and checked for collision with one `get`, as friend codes are. `schemaVersion` is on
the comp document from day one so an older build can say *update BetaLog to see this comp* rather
than misread a newer shape.

### Rules

```
match /competitions/{code} {
  function isOrganiser() {
    return request.auth != null && request.auth.uid in resource.data.organisers;
  }
  function compStatus() {
    return get(/databases/$(database)/documents/competitions/$(code)).data.status;
  }
  function isEntrant() {
    return request.auth != null
      && exists(/databases/$(database)/documents/competitions/$(code)/entries/$(request.auth.uid));
  }

  allow get:    if request.auth != null;                        // join by code; never list
  allow list:   if request.auth != null && request.auth.uid in resource.data.organisers;
  allow create: if request.auth != null
                && request.resource.data.organisers == [request.auth.uid]
                && request.resource.data.status == 'draft';
  allow update, delete: if isOrganiser();

  match /private/grades {
    allow read, write: if request.auth != null
      && request.auth.uid in get(/databases/$(database)/documents/competitions/$(code)).data.organisers;
  }

  match /entries/{uid} {
    allow read:   if isEntrant()
                  || request.auth.uid in get(/databases/$(database)/documents/competitions/$(code)).data.organisers;
    allow create: if request.auth.uid == uid && compStatus() in ['open', 'live']
                  && request.resource.data.voids.size() == 0;
    allow update: if (request.auth.uid == uid && compStatus() == 'live'
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['card', 'updatedAt']))
                  || (request.auth.uid == uid && compStatus() == 'open'
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'category', 'updatedAt']))
                  || request.auth.uid in get(/databases/$(database)/documents/competitions/$(code)).data.organisers;
    allow delete: if (request.auth.uid == uid && compStatus() == 'open')
                  || request.auth.uid in get(/databases/$(database)/documents/competitions/$(code)).data.organisers;
  }
}
```

What the rules enforce: an entrant writes only their own card, only while live, only the card;
nobody outside the comp reads anything but the comp card by its code; hidden grades are unreadable
to entrants; scores are never stored, so there is nothing to forge but one's own goes. What they
cannot enforce is that a go is true — §8. The `list` rule lets an organiser's device run
`where('organisers', 'array-contains', uid)` to rebuild *Mine* if the local list is lost, and
nothing else.

### Reads on the free plan

A live board is an `onSnapshot` on `entries` while the Leaderboard tab is on screen: one read per
entry on open, then one per changed card. One shared subscription per app, dropped when the tab
closes. The entrant's board redraws from snapshots at most once every 30 s and says *updated 12 s
ago*. For a 30-person comp that is well inside the Spark plan's 50k reads a day; for a 200-person
comp a Worker that publishes a `board` summary document once a minute is the next step and is not
needed first.

---

## 11. Build order

Five steps, each its own branch and release, verified on the branch preview first; nothing here is
a bug fix, so every merge waits for Ben's word. New code in the repo's ES5 style.

### Step 1 — the model, the maths and the rules

- `lib/types.js`: `CompScoring`, `CompProblem`, `ProblemResult`, `Correction`, `Competition`,
  `CompEntry`, the `comp` block on `Session`, `compCode` / `compProblemId` on `Climb`.
- `lib/competition.js` (pure, no React, no Storage):
  `DEFAULT_SCORING`, `newComp(fields)`, `makeCode(random)`, `generateProblems(count, circuits)`,
  `validateComp(comp)` → `string[]` of problems, `emptyCard(problems)`,
  `applyCardAction(card, scoring, action)`, `scoreProblem`, `scoreCard`, `rankEntries`,
  `climbsFromCard(comp, sessionLocation)`, `sessionForComp(comp, entry, existing)`,
  `scoringSentence(scoring)` (the two sentences on the comp card), `resultsCsv(comp, entries)`,
  `splitHiddenGrades(problems)` → `{ public, private }`, `revealGrades(problems, private)`.
- `lib/__tests__/competition.test.js`: the reducer's invariants under every action sequence
  (including `−` through a top, Zone off with a top set, `+` at max); `scoreProblem` on each row of
  the §4 table; `scoreCard` with and without `bestN`; `rankEntries` ties and shared ranks;
  `climbsFromCard` for the five states in §7 and for a hidden grade before and after reveal;
  `generateProblems` against the example circuits; `validateComp` on each rule in §4; the CSV.
- `firestore.rules` as §10, plus the first rules tests in the repo:
  `@firebase/rules-unit-testing` as a devDependency, `betalog-react/rules.test.js` run by
  `firebase emulators:exec --only firestore "npx vitest run rules"` (a separate script,
  `npm run test:rules`, not part of `npm test`). Cases: stranger cannot read entries; entrant
  cannot write another card, a card while `open`, or `voids`; organiser can read `private/grades`,
  entrant cannot; non-organiser cannot `list`.
- `lib/storage.js`: `il_compEntries` in load/save and `SYNC_KEYS`; `createComp`, `getComp`,
  `watchComp`, `saveComp` (comp + private grades in one batch), `setCompStatus` (Close does the
  reveal in the same batch), `enterComp`, `saveEntryCard`, `saveEntryDetails`, `watchEntry`,
  `watchEntries`, `voidProblem`, `listOrganised`.
- Deploy the rules. Nothing visible changes in the app.

### Step 2 — organise

- `hooks/useCompetitions.js`: `mine` (from `compEntries`), `draft` / `saveDraft` / `clearDraft`
  (`il_compDraft`), `openEntries(draft)` (→ `Storage.createComp`, adds the organiser row to
  `compEntries`), `save`, `setStatus`, `remove`; `useComp(code, {organiser})` watches one comp and,
  for an organiser, merges the private grades back for the editor.
- `pages/comp/CompLayout.jsx` (the `/comp` shell: BetaComp header, *← BetaLog*, the comp tab bar
  inside a comp), `CompsHome.jsx` (Mine, Join, Organise), `CompEditor.jsx` (details with the
  venue picker, scoring, categories, the scoresheet with the generator and the `showGrade`
  switches, the live-time freezes), `CompDetails.jsx` (the comp card and problem list),
  `CompManage.jsx` (status buttons with a confirm on Close, the code and QR via
  `qrcode-generator`, entrant count, Edit, Export CSV, Delete with confirm).
- `App.jsx`: the `/comp/*` routes, and the main `Nav` hidden on them; `Nav.jsx`: the
  *Competitions* header button.
- `public/help.html`: a *Competitions* chapter, organiser half.

### Step 3 — enter and climb

- `useCompetitions`: `join(code)`, `enter(code, name, category)`, `act(code, problemId, action)`
  (session first via `useSessions`, then the mirror), `resync()` on `online` and foreground.
- `JoinView.jsx`, `EntrySheet.jsx`, `Scorecard.jsx` (`ProblemRow` with the stepper, Zone, Top,
  the score, the void note), the Log page banner, the Dashboard card
  (`components/dashboard/CompCard.jsx` in `WidgetShell`).
- History: the badge, the summary line, the scorecard on tap, delete hidden while live, the climb
  editor not opening on comp sessions; `compCode` in `climbCsv.js`.
- `help.html` entrant half; `betalog_privacy_spec.md` and `public/privacy.html` gain the paragraph:
  the organiser sees your display name, category and card; other entrants see your name and score
  on the leaderboard; your card is a session in your log and stays there when you delete nothing.

### Step 4 — leaderboard and voids — *built 2026-09-27 (BTL-B74)*

- `Leaderboard.jsx`: per-category boards and Overall, the pinned own row, the 30 s throttle and
  caption, the `boardVisibleToEntrants` gate (organisers always see it).
- Void from the board for organisers; the entrant's row shows the note.
- Results CSV from Manage.

### Step 5 — close and reveal

- Close: status, `closedAt`, the grade reveal, the final board, the placing on the History card,
  `climbsFromCard` re-run on the entrant's device when the closed comp arrives.
- The Dashboard card's *placing* state.

### Later, in the order someone asks

A public board for the gym screen; a full edit-with-note beyond void; witness marks; walk-in
entrants with a claim code; adding an organiser by friend code (step 2 ships with the creator
only); a push reminder the morning of a comp through the existing Worker; comps under `gyms/`
when that tree exists; lead comps scored by highpoint (a rope comp on the goes / zone / top card
exists — §6).

Every step that changes what a climber can see updates `public/help.html` in the same commit and
bumps the service worker cache.

### Verification

`npm run build`, `npm test`, `npm run test:rules`, `npm run lint` on every step. The screens are
verified in Chromium at 390 px with Firebase stubbed, as BTL-B63–66 were, with a seeded comp and
three cards. What a cloud session cannot do is sign two real accounts into the live rules: Ben
verifies each step on the branch preview with his account and a spare, and the first real comp is
the acceptance test — a Check row is opened for it when step 5 ships.

---

## 12. Decisions taken

Ben's *"mostly agree"* on 2026-09-26 to the seven questions in the first draft, with two of them
overtaken by his second pass. Recorded here so the build does not reopen them.

| # | Question | Decision |
|---|---|---|
| Q1 | Who may create a comp? | Anyone signed in; they organise it (§3) |
| Q2 | First scoring format | Replaced: goes / zone / top with a per-comp `maxAttempts` and a per-go percentage table (§4). The earlier "points, best N" is the same model with every percentage at 100 |
| Q3 | Do tops go into the log? | Replaced: the card **is** a session in the log from the first go; graded tops are sends, graded tries are attempts with a real count (§7). No button, no opt-out — an entrant who does not want it deletes the session after the close |
| Q4 | Where it lives | The Friends-style screen (§9) |
| Q5 | Is the board live for entrants? | Organiser's toggle, default on |
| Q6 | Display name | Asked at entry, prefilled from the profile, required |
| Q7 | Walk-in entrants | Not in the basic version |
| — | Grades | Per-problem `showGrade`; hidden grades live in an organiser-only document and are revealed at close (§6) |
| — | Corrections | Void with a note only; full edit later (§8) |
| — | Gym screen | Not in the basic version; a signed-in laptop on the Leaderboard tab (§9) |

---

## 13. Out of scope

- Lead comps scored by highpoint. A rope comp exists (§6), but on the boulder card: goes, zone, top.
- Payment, entry fees, waivers. The gym does that at the desk as it does now.
- Photos of problems. Comp problems are numbered on the wall; the route board owns photos.
- Anything cross-gym: a league, a season, a national ranking. One comp is one document.
