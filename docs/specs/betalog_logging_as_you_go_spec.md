# BetaLog — Logging as you go: continue today's session, save on every tap

**Written:** 2026-09-28 · Covers **BTL-B75** (*Continue today's session* card) and **BTL-B76**
(save the climb session on the first climb, update on each). Build status is in `BACKLOG.md`, not
here.

> Ben, 2026-09-26: *"at the moment I often log a session and some climbs then go to history and
> click edit and amend. It's a bit clunky but would having a session in a pending state just make
> things a bit too complex or over engineered?"* — answered in chat: yes, a pending state is
> over-engineered; the comp card's model gets the benefit without it. Ben: *"Do it your way :)"*

---

## 1. The problem

Ben's habit at the wall: log a few climbs, **Save Session**, climb more, then History → the session
→ Edit → add the rest → **Update Session**. Four screens to add one climb to a session that is
still happening. And until the first Save, the climbs exist only in React state on the Log page —
a tab switch, a reload, a service-worker update or a dead battery loses the lot.

Two separate faults, two rows:

| Row | Fault | Fix |
|---|---|---|
| BTL-B75 | Getting back into today's session takes History → detail → Edit | A card on Log that reopens it in one tap |
| BTL-B76 | Nothing is saved until *Save Session*, which also demands a feel | The session is saved on the first climb and updated on every change |

B75 is useful on its own and changes no data. B76 changes when a session is written, so it builds
on B75: once every session is saved from the first tap, *leaving* the logger is harmless, and B75's
card is how you get back.

## 2. What we are not building — no *pending* state

A session with a status (`open` / `in progress` / `finished`) was considered and rejected. It needs
an end rule (when does an open session close — midnight? next session? never?), a pyramid rule (do
open sessions count?), a sync rule (two devices, one open session) and a History treatment (how does
an unfinished session look). None of that is needed, because the comp card already proved the
simpler model: **the session is real from the first go and is simply updated.** There is no
"unfinished" — a session with three climbs and no feel is a session with three climbs and no feel.

"In progress" is not stored anywhere. It is a reading: *a climb session dated today, on this
account, that is not a comp session*. That reading is all B75 needs.

---

## 3. BTL-B75 — *Continue today's session*

### 3.1 When the card shows

On **Log › Climb**, above the discipline buttons, when all of:

- the logger is **empty** — no climbs logged in this form yet (once you start a new session the
  card gets out of the way);
- there is at least one session with `type === 'climb'`, `date === today` (local
  `toISOString().slice(0, 10)`, the same "today" the logger uses), and **no `comp` block** — a comp
  session is edited only through its card (`/comp/:code/card`), never through the logger, because
  its climbs are derived (`climbsFromCard`, competitions spec §7).

If there are several, the card offers the **most recently changed** one (`updatedAt`, then
`createdAt`). Only one card; a second session today is still reachable from History.

### 3.2 What it says

```
┌───────────────────────────────────────────────┐
│ TODAY · FLASHPOINT                            │
│ 8 climbs · 3 Flash · 4 Send · 1 Att           │
│ [ Continue session ]        New session →     │
└───────────────────────────────────────────────┘
```

- Heading: **Today** and the venue if the session has one (`location`, else the first climb's).
- Line 2: the same summary History's card shows. `climbDetail` in `SessionCard.jsx` is private
  today — move it to a pure helper (e.g. `lib/stats.js` `climbSummaryLine`) and use it in both, so
  the two lines cannot drift (the BTL-B70 miscount was exactly this kind of summary).
- If the session has no feel (only possible after B76, §4.4): a grey third line, *Feel not set*.
- **Continue session** — primary button, the discipline accent of the session's last climb.
- **New session** — a quiet text link. It dismisses the card for this visit to the page (component
  state, not stored) and leaves the empty logger as it is today.

### 3.3 What Continue does

Mounts the **same `ClimbLogger` inline on the Log page** with `initialSession` set — exactly what
`ClimbEditSheet` does inside a sheet. Nothing new in the form: the climbs already logged in the list,
the last climb's discipline picked so the grade chips are ready, feel / venue / notes / date filled,
and the button reading **Update Session**. Above the form, a slim header in place of the card:

```
CONTINUING · TODAY · FLASHPOINT          New session
```

**New session** there drops back to the empty logger without saving (as closing the edit sheet
does today).

On **Update Session** the session is updated, the toast says *Session updated*, and the page
returns to the empty logger with the card showing again (now with the new count). Continue is the
same-day edit the logger already knows (`sameDayEdit`): it fetches a position on open and may stamp
the venue's coordinates, under the rules BTL-B41 set.

### 3.4 On the Dashboard too — one tap from opening the app

The app opens on the **Dashboard** (`/`), not Log. Ben, 2026-09-28: *"could we have the open
session appear at the top. Ideally I wanna reduce button presses as much as possible."*

So the same session also appears as a row at the **very top of the Dashboard**, above the
*Due today / Coming up* strip (`ScheduleNotice`), in the strip's compact style:

```
┌───────────────────────────────────────────────┐
│ ▶ Continue · Flashpoint · 8 climbs         ›  │
└───────────────────────────────────────────────┘
```

One tap on it goes to `/log` **already in continuing mode** (§3.3): `navigate('/log', { state:
{ continueSession: id } })`, picked up by a one-shot effect in `Log.jsx` the same way the *Due
today* chips hand over `openRoutine` today. The grade chips are showing for the last climb's
discipline, so the next climb is **grade → outcome**.

Taps from opening the app to the next climb logged:

| | Today | With B75 |
|---|---|---|
| Add a climb to today's session | Nav *History* → session → *Edit* → grade → outcome = **5**, in a sheet | Dashboard row → grade → outcome = **3** |
| Start a new session | Nav *Log* → discipline → grade → outcome = **4** | Unchanged |

**When the Dashboard row shows (Q4):** only while you are plausibly still at the wall — the
session was **last changed within the last 3 hours**. A session finished at lunchtime should not
sit on the Dashboard all evening. The Log card (§3.1) has no such window: on Log it shows all day,
because opening Log is already a sign you are logging. Before B76 "last changed" is `updatedAt`
from the last Save / Update; after B76 it is the last tap, which makes the window more accurate.

Not a widget: it is not in the widget picker, has no collapse and no timeframe (widget system
spec) — it is a notice, like the strip under it, and is simply absent when there is nothing to
continue.

### 3.5 Files

| File | Change |
|---|---|
| `src/pages/Log.jsx` | Climb mode: pick today's session, render the card / the continuing header, hold `continuing` (session id or null) and a `dismissed` flag; key the `ClimbLogger` on the id so switching reseeds it. One-shot effect for `location.state.continueSession` (sets mode `climb` and `continuing`, then `replace`s the state so a reload does not re-trigger) |
| `src/components/dashboard/ContinueNotice.jsx` | New — the Dashboard row in §3.4 |
| `src/pages/Dashboard.jsx` | Render `ContinueNotice` above `ScheduleNotice` |
| `src/components/log/ContinueSessionCard.jsx` | New — the card in §3.2 |
| `src/lib/sessions.js` | New, pure: `todaysClimbSession(sessions, today, { nowMs, withinMs })`, the moved summary helper `climbSummaryLine`, `sessionVenue`, `climbAccent` — tested in `sessions.test.js` |
| `src/components/log/ClimbLogger.jsx` | One optional prop, `onClimbCount(n)`, so Log knows when a new session has started and takes the card away |
| `src/components/log/SessionCard.jsx` | Use the moved helper |
| `public/help.html` | The Log chapter: one paragraph on the card |

`ClimbLogger`'s behaviour is unchanged by B75.

### 3.6 Tests and checks

- Unit: `todaysClimbSession` — none today, one, several (newest by `updatedAt` wins), a comp
  session today (ignored), a climb session yesterday (ignored), a hang session today (ignored);
  with a `withinMs` argument for the Dashboard's 3-hour window (2h59 shows, 3h01 does not).
- Unit: the summary helper gives the same string History showed before the move, including the
  BTL-B70 case (a lone attempt is not a send).
- Harness (`dev/`, 390 px): log and save a session → card appears with the right count → Continue →
  add a climb → Update → card shows +1 → New session → empty logger, no card until the page is
  revisited. A comp session dated today shows no card.
- Harness: Dashboard row appears after a save → tap → Log opens in Climb, continuing, grade chips
  showing → log one climb in two taps. Move the session's `updatedAt` back 4 h → the row is gone
  from the Dashboard but the Log card still shows. Reload on `/log` after arriving from the row →
  no re-trigger.

---

## 4. BTL-B76 — Save on the first climb, update on every change

### 4.1 The rule

In a **new** session and in a **continued** one (§3.3), every change to the form is written to the
log straight away:

| Change | When it is written |
|---|---|
| First climb tapped (Flash / Send / Attempt / Project) | `addSession` — the session now exists, id minted client-side once |
| Each further climb, a climb removed (✕) | `updateSession` with the new `climbs` |
| Feel tapped, date changed | `updateSession` at once |
| Venue, notes (typed) | `updateSession` on blur and on *Done* — not per keystroke |

`addSession` / `updateSession` already write localStorage first and the App-level `setData` wrapper
already debounces the Firestore sync by 300 ms, so a burst of taps is one cloud write and an
offline wall costs nothing. No new storage path; `useCompetitions.upsertSession` is the proof this
pattern works in this app.

**The History edit sheet does not change.** Editing an old session is a deliberate
change-then-commit, and closing the sheet must still mean *cancel*. `ClimbLogger` gains a prop
`live` (true on the Log page, false in `ClimbEditSheet`); with `live` false it behaves exactly as
today.

### 4.2 The button

**Save Session** / **Update Session** becomes **Done**. Everything is already saved, so Done means
"I've finished": it writes venue and notes, remembers the venue (`rememberVenue`, §4.5), clears the
form back to the empty logger and shows the toast *Session saved*. The B75 card then shows the
session, ready if you climb again later.

Leaving the page without Done loses nothing — the session is in the log, and the B75 card is on Log
when you come back.

A small grey status line above Done replaces the save confirmation: *Saved · 5 climbs*. There is
no *Saving…* state to show — localStorage is written synchronously, and the cloud sync behind it
is the same background sync every other save uses.

### 4.3 Removing the last climb

If ✕ removes the only climb, the session is **deleted** (`deleteSession`) and the form is back to
empty — a session with no climbs is not a session, and it would otherwise sit in History as
"0 climbs". No confirm: the climb row's ✕ has never asked, and the state before the first tap is
exactly what you get back. In a *continued* session (§3.3) this is the same.

### 4.4 Feel — the one real decision (Q1)

Today *Save Session* refuses without a feel. With save-on-tap the session exists before a feel has
been given. Two options:

| | A — `difficulty: null` until given (**recommended**) | B — default 3 until edited (the comp card's choice) |
|---|---|---|
| Honest | Yes — the log says "not given" (data honesty spec) | Records a feel nobody gave |
| Readers | All already guard: `coach.js` averages only `if (s.difficulty)`, `SessionCard` / `SessionDetailSheet` draw no dot, `stats.js` MET only reads cardio | Nothing to check |
| Done | Done asks for a feel if none (the same inline *Select a session feel* line) but the climbs are already saved either way | Done needs no check |

With A, Done without a feel shows the prompt once; a second tap on Done finishes anyway, and the B75
card says *Feel not set*. The data model's "required on all types" line for `difficulty` becomes
"required on all types except a climb session still being logged" — update
`betalog_data_model.md` in the build commit.

(The comp card chose 3 because an entrant has no feel control mid-comp; the ordinary logger has one
on screen the whole time.)

### 4.5 Venue coordinates

`rememberVenue` runs today once, on save. It stays once-per-session-ish: on the **first climb** (if
a venue is filled) and on **Done**, not on every tap — the saved-venues list should not churn on
each climb. The coordinates rule from BTL-B41 is unchanged; BTL-B59 (home coordinates on a late
save) is if anything *less* likely, because the first climb is tapped at the wall.

### 4.6 Things that change because the session is real sooner

Checked, and acceptable — listed so nobody is surprised:

- **Dashboard, pyramid, Shameometer, public profile** see the session mid-climb. That is the point.
- **Goals auto-achieve.** `useGoals` stamps a goal achieved once and never un-stamps it
  (`useGoals.js`, `if (g.achieved) return g`). It runs where `useGoals` is mounted — Dashboard,
  History, Plan › Goals — **not** on Log. So a mis-tapped V7 Flash removed before leaving Log never
  achieves anything; one left in and seen on the Dashboard does, exactly as a mis-tapped save does
  today. No change in risk; not worth a guard.
- **Firestore writes**: one per debounced burst per user — trivial against the Spark quota. The user
  document grows no faster than today (BTL-B105 is the size question, unaffected).
- **Two devices** logging the same session at once: last write wins, as for every other edit today.
  Out of scope.

### 4.7 Files

| File | Change |
|---|---|
| `src/components/log/ClimbLogger.jsx` | `live` prop; mint the session id on the first climb; `addSession` / `updateSession` / `deleteSession` per §4.1 and §4.3; Done in place of Save / Update when `live`; status line; feel rule per Q1 |
| `src/pages/Log.jsx` | Pass `live`; after Done return to the empty logger; toast text |
| `src/components/log/ClimbEditSheet.jsx` | Unchanged (`live` defaults to false) |
| `docs/specs/betalog_data_model.md` | The `difficulty` line, if Q1 is A |
| `public/help.html` | Log chapter: "every climb is saved as you tap; Done when you've finished" |

### 4.8 Tests and checks

- Unit (pure helper for the form → session mapping, extracted so it can be tested): the first climb
  gives a session with one climb and the venue stamped; removing the last climb says *delete*;
  `difficulty` null until set (Q1 A).
- Harness (`dev/`, 390 px):
  1. Tap one climb → History shows the session with 1 climb, no Save pressed.
  2. Reload the page mid-session → nothing lost; Log shows the B75 card; Continue → the climbs are
     there.
  3. Add, remove, remove the last → the session is gone from History.
  4. Done without a feel → prompt; Done again → saved, card says *Feel not set*.
  5. History → Edit an older session → change a climb → close the sheet → **unchanged** (edit sheet
     still cancels).
  6. Airplane mode: log three climbs, reload, still there; back online → one sync.

---

## 5. Build order

1. **BTL-B75** — its own branch and release. No data change; stops at the branch for Ben's word (it
   changes a screen that works).
2. **BTL-B76** — after B75 is merged, its own branch. Changes when sessions are written; stops at
   the branch. Q1 answered before it starts.

## 6. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Feel before it is given: `null` or 3? (§4.4) | `null` — honest, and every reader already copes |
| Q2 | Should the app open straight into *Continue* (skip the Dashboard, or skip the Log card) when today's session exists? | No — a second session in a day (morning board, evening lead) is normal, and landing in a form you didn't ask for is its own wrong tap. The Dashboard row (§3.4) gets the same result for one tap and never guesses wrong |
| Q3 | Should the History edit sheet also save on tap? | No — it is the one place *cancel* is wanted (§4.1) |
| Q4 | How long the Dashboard row shows after the session's last change (§3.4) | 3 hours — covers a long session with a break; the Log card has no window |
