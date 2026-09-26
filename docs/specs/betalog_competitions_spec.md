# BetaLog — Bouldering Competitions

> Written 2026-09-26 from Ben's ask: *"a way in which an admin (climbing gym say) can set up a
> bouldering competition. This would be on a date and at a location, using a scoresheet that
> people can virtually enter."* Nothing here is built. Build status is `BACKLOG.md` **BTL-B74**;
> the questions Ben has to answer before the build starts are §10.

---

## 1. What it is

A gym runs a bouldering comp the same way every gym does: thirty-odd problems go up, each with a
number and a point value, every entrant gets a paper scorecard, ticks what they top, hands the
card in, and someone at the desk adds it all up while everyone waits. The scorecard is the whole
event. It is also the weak point — cards get lost, handwriting gets misread, the adding-up takes
an hour, and the leaderboard exists only once, on a whiteboard, at the end.

BetaLog replaces the card. An **organiser** creates the competition in the app — a name, a date,
a venue, a scoresheet of problems — and gets a **join code** to put on the poster. An **entrant**
types the code (or scans it), picks a category, and has the scoresheet on their phone. During the
comp they tick problems as they top them. The **leaderboard** is live for everyone entered, and on
a screen at the gym if the organiser wants it. When the organiser closes the comp the results are
final, and each entrant's tops can become a climb session in their own log, dated and located.

Three things it is not:

- **Not a judging system.** Ticks are self-reported, exactly as on a paper card. §7 says what the
  organiser can do about a wrong one and what the app does not pretend to know.
- **Not the route board.** Comp problems live for one day and carry a number and points, not a
  setter, a section or a lifecycle. The route board (`betalog_vision.md`) may one day feed a
  scoresheet; the scoresheet does not depend on it.
- **Not gym onboarding.** No `gyms/` collection, no staff table, no console setup. Whoever creates
  a comp organises it. §3 says why, and how a gym attaches later.

---

## 2. The two people and their day

### The organiser

1. Opens **Competitions** (§8 for where), taps *Organise a competition*.
2. Fills in name, date, start and end time, venue (the venue picker from the logger, so
   *Redpoint Bristol* is one tap if they have climbed there), a line of notes for the poster.
3. Builds the **scoresheet**: a list of problems, each with a number, a colour or circuit, a
   point value, and an optional grade. A generator fills the common case in one go — *30 problems,
   numbered 1–30, points by circuit: green 10, blue 20, red 30, black 50* — and each row can be
   edited after.
4. Picks the **format** (§4) and the **categories** (§5) — or leaves both at their defaults.
5. Saves. The comp is a **draft**. Nothing is visible to anyone else yet.
6. Taps **Open entries**. The comp gets its join code, `CP-XXXXX`, and a QR code for the same
   thing. Entrants can join from now until the organiser closes it.
7. On the day, taps **Start scoring** at the start time (or lets the app do it at the start time —
   an organiser option). Ticks are accepted from now.
8. Watches the live board on their own phone or opens `/comp/CP-XXXXX/board` on the gym's TV.
9. Taps **Close** at the end. Ticks stop. The results are final and the board says so.
10. Can correct a tick (void it, or add one an entrant forgot) at any point, with a note that the
    entrant sees. Can export the results as CSV.

### The entrant

1. Sees the poster, opens BetaLog, taps **Competitions → Join**, types `CP-XXXXX`.
2. Sees the comp card: name, date, venue, format, how scoring works in one sentence. Picks a
   category. Their display name is the profile name (§10 Q6). Taps *Enter*.
3. On the day, the Log page shows a banner — *Redpoint Autumn Comp is live · Open scorecard* —
   and the Dashboard card does the same.
4. The scorecard is the problem list. Each row: number, colour, points, and the outcome buttons the
   format needs — for the default format, **Flash · Top · —**. A tap records it and the running
   score updates at the top. The card works with no signal; §6 says how.
5. The **Leaderboard** tab shows their category and overall, live, with their own row pinned.
6. After the close, the results are frozen and *Add to my log* offers the topped problems as a
   climb session on the comp's date at the comp's venue (§9). Problems without a grade are listed
   but not logged as climbs.

---

## 3. Who can organise — and why there is no gym table yet

The data model already specifies `gyms/{gymId}/centres/{centreId}/staff/{uid}` with `admin` and
`setter` roles, and `firestore.rules` today has a single hard-coded admin UID with a comment
promising a `centreAdmins/{uid}` lookup. None of it exists in code. Building it first would make
the comp feature wait on gym onboarding — a console session per gym before anyone can run a
comp — and the first comp is going to be one person at one wall who wants a scoresheet on Saturday.

**Decision proposed: any signed-in user can create a competition, and becomes its first
organiser.** The comp document carries `organisers: [uid, …]`; an organiser can add another by
friend code or by comp-staff code. That is the friend-code pattern this app already has, and it
means a gym's head setter, a club secretary or a mate running a birthday comp are all the same
case. Abuse surface is small: a comp is invisible until someone has its code, an entrant sees only
the comps they have entered, and nothing an organiser does touches anyone's log.

When the `gyms/` tree is built, a comp gains `gymId` and `centreId` (nullable now, exactly as
`Climb` already has them), a centre's staff become organisers of its comps automatically, and a
gym's comp history rolls up under the centre. Nothing about the scoresheet changes.

---

## 4. Scoring formats

Bouldering comps in UK gyms run three ways. The first is the default and the only one in the first
build; the other two are specified so the data shape does not have to change to add them.

### 4a. Points, best N count *(default — v1)*

Each problem is worth its point value. A top scores the points; a flash scores the points plus an
optional flash bonus (a percentage or a fixed amount — organiser's choice, default none). Only the
entrant's **best N** problems count (default N = 10; organiser sets it, or *all*). Ties break on
number of flashes, then on the hardest problem topped (highest points), then stand as a tie.

This is what nearly every "scorecard" comp does, and it is what the generator in §2 produces.

### 4b. Top and zone with attempts *(v2)*

IFSC style, used for finals and for comps that want attempts to matter. Per problem the entrant
records **top** (yes/no), **zone** (yes/no), **attempts to top**, **attempts to zone**. Ranking:
tops, then zones, then fewer attempts to top, then fewer attempts to zone. The scorecard row shows
a *+1 attempt* button and *Zone* / *Top* toggles rather than three outcome buttons.

### 4c. Shared points *(v2)*

Each problem's value is `basePoints / (number of entrants who topped it)`, so a problem only two
people topped is worth more than one everyone topped. The value is computed at leaderboard time
from all entries, never stored, so it is always right for the current ticks. This format needs the
whole entries collection to score one card, which is the one thing that makes it heavier than the
others (§6).

### The model that serves all three

```ts
type CompFormat =
  | { kind: 'points',  bestN: number | null, flashBonus: { kind: 'none' } | { kind: 'percent', value: number } | { kind: 'fixed', value: number } }
  | { kind: 'topzone' }
  | { kind: 'shared',  bestN: number | null, basePoints: number }
```

Scoring is a pure function in `lib/competition.js`: `scoreEntry(format, problems, ticks)` returns
`{ score, counted: Tick[], flashes, tiebreak: number[] }`, and `rankEntries(format, problems,
entries)` returns the leaderboard rows with `rank` (ties share a rank; the next rank skips) for one
category or for everyone. Both are tested in `lib/__tests__/competition.test.js` with a fixture of
a 30-problem sheet and a dozen cards, including the tie cases.

---

## 5. Categories

An organiser defines categories as a list of labels — the default set is **Open · Female ·
Male**, editable; a comp can add *Under 16*, *Masters 40+*, *Beginner (V0–V3)*, or have a single
*Everyone*. An entrant picks exactly one at entry and can change it until scoring starts. The
leaderboard shows one board per category plus **Overall**, and the organiser can hide Overall
if the categories are ability bands and an overall board would be meaningless.

Categories are labels, not rules: the app does not check anyone's age or gender or grade, any more
than a paper entry form does. It says so in the entry sheet.

---

## 6. Data

### Where it lives

A new top-level Firestore collection. Comps are shared between accounts, so they cannot live under
`users/{uid}`, and the join-by-code pattern wants the document ID to *be* the code so the lookup is
a `get` and never a `list` — the same reasoning as `friendCodes/`.

```
competitions/
  {code}/                            e.g. "CP-K7M2Q" — the join code is the document ID
    name, date, startAt, endAt, venue: {name, lat, lng}, notes,
    status: 'draft' | 'open' | 'live' | 'closed',
    format: CompFormat,
    categories: string[],
    showOverall: boolean,
    boardVisibleToEntrants: boolean,   // §10 Q5
    autoStart: boolean,
    problems: Problem[],               // the scoresheet — see below
    organisers: string[],              // uids
    organiserNames: {uid: name},       // denormalised for display
    gymId: null, centreId: null,       // reserved
    createdAt, updatedAt

    entries/
      {uid}/                           one card per entrant, doc ID is their uid
        displayName, category,
        ticks: { [problemId]: Tick },
        corrections: Correction[],     // organiser edits, each with a note
        enteredAt, updatedAt
```

```ts
interface Problem {
  id:      string          // "p12"
  number:  number          // what's written on the wall
  colour:  string | null   // "red", "#e63946" — display only
  points:  number
  grade:   string | null   // "V4" / "6b" — optional; if set, §9 can log it
  gradeSystem: 'v' | 'french' | null
  label:   string | null   // "Slab 3", free text
}

type Tick =
  | { result: 'flash' | 'top', at: string }                              // points formats
  | { top: boolean, zone: boolean, attempts: number, zoneAttempts: number, at: string }  // topzone

interface Correction {
  by: string, at: string, problemId: string, before: Tick | null, after: Tick | null, note: string
}
```

The scoresheet is an array on the comp document, not a subcollection: it is read as a unit every
time, edited only by organisers, and at most a couple of hundred rows — well inside the 1 MB
document limit. Entries are a subcollection because each entrant writes only their own.

### On the user's side

`users/{uid}` gains one synced field, `compEntries: [{ code, name, date, venueName, status }]`,
the list of comps this account has entered or organised — `il_compEntries` in localStorage,
added to `SYNC_KEYS` like everything else. It is what **Competitions** lists without querying
across the collection. The entrant's own **scorecard is mirrored locally** too, in
`il_compCards: { [code]: ticks }`, written first and pushed to `entries/{uid}` after, so a tick
made in a basement with no signal is on the phone the moment it is tapped and reaches Firestore
when the signal does. (The Firestore SDK queues writes offline but drops the queue on reload;
`getFirestore` here has no persistent cache, and turning one on is a bigger decision than this
feature should make.) On reconnect, the local card wins for the entrant's own ticks; organiser
corrections arrive from the server and are applied on top.

### Rules

```
match /competitions/{code} {
  function isOrganiser() {
    return request.auth != null && request.auth.uid in resource.data.organisers;
  }
  function isEntrant() {
    return request.auth != null
      && exists(/databases/$(database)/documents/competitions/$(code)/entries/$(request.auth.uid));
  }

  allow get:    if request.auth != null;                 // join by code; never `list`
  allow list:   if request.auth != null && request.auth.uid in resource.data.organisers;
  allow create: if request.auth != null
                && request.resource.data.organisers == [request.auth.uid]
                && request.resource.data.status == 'draft';
  allow update, delete: if isOrganiser();

  match /entries/{uid} {
    allow read:   if isOrganiser() || isEntrant();       // entrants see the board, outsiders don't
    allow create: if request.auth.uid == uid
                  && get(/databases/$(database)/documents/competitions/$(code)).data.status in ['open', 'live'];
    allow update: if (request.auth.uid == uid
                      && get(/databases/$(database)/documents/competitions/$(code)).data.status == 'live'
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ticks', 'updatedAt']))
                  || (request.auth.uid == uid
                      && get(/databases/$(database)/documents/competitions/$(code)).data.status == 'open'
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['category', 'displayName', 'updatedAt']))
                  || isOrganiser();
    allow delete: if isOrganiser()
                  || (request.auth.uid == uid
                      && get(/databases/$(database)/documents/competitions/$(code)).data.status == 'open');
  }
}
```

What the rules enforce and what they do not: an entrant can only ever write their own card, only
while the comp is live, and only the ticks; nobody outside the comp can read anything but the comp
card itself by its code; the leaderboard is computed on the client from ticks, so there is no
stored score for anyone to forge. What they cannot enforce is that a tick is true — see §7.
`isEntrant()` costs one extra document read per rule evaluation; that is acceptable at comp scale
and is what keeps a stranger with the code from reading the entries.

The `list` rule on `competitions` is what lets an organiser's device query
`where('organisers', 'array-contains', uid)` to rebuild `compEntries` if the local list is lost;
it does not let anyone enumerate comps they are not organising.

### Reads and the free plan

A live board is an `onSnapshot` on the `entries` subcollection while the leaderboard is on
screen — one read per entry on open, then one per changed card. For a 100-entrant comp with
everyone checking the board a dozen times in an afternoon that is on the order of 100 × 12 × 100 =
120k reads if every open were a cold load, which is over the Spark plan's 50k/day. Two things bring
it down to a fraction: the listener is shared across the app while it is open (one subscription,
not one per screen), and a snapshot re-open after a short close is served from the SDK's in-memory
cache. **The real safeguard is the throttle:** the entrant's board refreshes on a snapshot at most
once every 30 s and says *updated 12 s ago*; the gym-screen board (§8) is the one live view. If
comps get big, `shared` scoring or a Worker that publishes a `board` summary document once a
minute is the next step; it is not needed for a first comp of thirty people.

---

## 7. Honesty, corrections and what the board may say

`betalog_data_honesty_spec.md` applies: the leaderboard describes **what was reported**, not who
climbed best. Concretely:

- The board's caption is *Scores as entered by climbers · updated 12 s ago*, and after the close
  *Final — closed by the organiser at 16:42*.
- A paper comp asks for a witness's initials next to each tick. The first build does not: the
  witness is the person standing next to you, as it always was. **Witness confirmation** — a
  second entrant taps *I saw it* on a tick, shown as a small mark on the board — is a v3 option and
  is deliberately not a gate, because a comp with a queue for witnesses is a worse comp.
- An **organiser correction** voids or adds a tick and records `{before, after, note, by, at}` on
  the card. The entrant sees the note. The board recomputes. Nothing is silently changed and
  nothing is deleted — the same principle as retired routes.
- The scorecard refuses a tick on a problem that is not on the sheet and refuses any tick outside
  the live window (the rules enforce the second even if the client did not).
- The comp does not touch the pyramid, the level, or any friend-visible reading until the
  entrant chooses *Add to my log* (§9), and then only the graded problems, as ordinary sends.

---

## 8. Where it lives in the app

**Proposed: a Competitions screen reached the way Friends is** — a header button on the pages
where Friends has one, opening a full-height screen with three views: *Mine* (the comps I have
entered or organise, upcoming first), *Join*, *Organise*. A comp opens to a card with tabs
**Scorecard · Leaderboard · Details**, and an organiser sees a fourth, **Manage** (status,
scoresheet, categories, corrections, export). Reasons over the alternatives:

| Option | Against |
|---|---|
| A fifth tab on Plan | Plan is planning your own training. A comp is an event with other people in it, which is what Friends is. The IA declutter spec fixed Plan's tabs for a reason |
| A route, `/comps`, in the bottom nav | Five bottom tabs is the limit on a 320 px phone and there are five |
| Inside Friends | Friends is a screen about six people you know; a comp is thirty you don't. Sharing the screen muddles both |

Two more surfaces, both small:

- **A Dashboard card** — the widget system's shell — showing the next comp (*Redpoint Autumn Comp ·
  Sat 18 Oct · Redpoint Bristol · you're entered*), *Live now · open scorecard* on the day, and the
  final placing for a week after. Off by default until the account has entered a comp, then on.
- **The Log page banner** while a comp is live, because that is the page open at the wall.

**The gym screen** is `/comp/{code}/board`: the leaderboard alone, big type, dark background, no
nav, cycling through categories every 15 s, refreshing on every snapshot. It sits behind sign-in
like everything else — the organiser signs in on the TV's browser. A public, unauthenticated board
would need either a token like the calendar feed's or a Worker that republishes; it is listed in
§11 as the first thing to build if a gym asks.

---

## 9. Results into the log

After the close, *Add to my log* on the entrant's card builds a **climb session**: `date` the comp
date, `location` the comp venue, `discipline: 'boulder'`, `notes: "Redpoint Autumn Comp — 8th of
24 in Male"`, one `Climb` per topped problem **that has a grade**, `outcome: 'flashed' | 'sent'`,
`attempts: 1`, and a new nullable `compCode` on the session so it can be found and so the card
can say *added to your log*. Ungraded problems are listed in the notes and not logged as climbs —
a problem with no grade is not a send at any grade, and the pyramid must not be fed one.

Why it is a button and not automatic: the entrant may have logged the session themselves already
(the guide will tell them not to), and an automatic write into the log from a shared document is
the kind of thing the privacy copy would have to explain. One tap, once, and the card says it has
been done.

The organiser's **Export CSV** is the results table: place, name, category, score, flashes, tops,
then one column per problem. It is what the gym prints for the wall and keeps for next year.

---

## 10. Open questions for Ben

Answer before the build; each is a Decision row's worth.

| # | Question | Recommendation |
|---|---|---|
| Q1 | **Who may create a comp?** Anyone signed in, or only accounts Ben marks as organisers? | Anyone (§3). A comp is invisible without its code and touches no one's data. Gate it later at the `gyms/` layer if a real problem appears |
| Q2 | **First format** — points/best-N only, or top-zone too? | Points/best-N alone (§4a). It is what a gym scorecard is. Top-zone is a finals format and can wait for a comp that asks |
| Q3 | **Do tops go into the log?** Automatically at close, by a button, or never? | A button, graded problems only (§9) |
| Q4 | **Where it lives** — the Friends-style screen (§8), or a Plan tab? | The screen. Plan is your own training |
| Q5 | **Is the leaderboard live for entrants during the comp,** or hidden until the close? Some comps hide it to keep the ending open | Organiser's toggle, `boardVisibleToEntrants`, **default on**. The gym screen is always live |
| Q6 | **Display name** — the profile name (currently optional, defaults to *Climber*), or a name asked for at entry? | Ask at entry, prefilled from the profile, required. A board of eight *Climber*s is not a board |
| Q7 | **Walk-in entrants** without the app — should the organiser be able to add a name and enter their card for them in v1? | Not v1. The poster says *download BetaLog to enter*, which is also the point of the feature for a gym. v2 adds `entries/{code}-walkin-{n}` with `claimedBy` |

---

## 11. Build order

Each step is its own branch and release, verified on the branch preview first; nothing here is a
bug fix, so every merge waits for Ben's word.

1. **Model and scoring** — `types.js` typedefs, `lib/competition.js` (`generateSheet`, `scoreEntry`,
   `rankEntries`, `buildResultsCsv`, `sessionFromEntry`), tests. `firestore.rules` additions, tested
   with the Firestore emulator (`firebase emulators:exec`) — the first rules tests in this repo, and
   worth it because these are the first rules where a stranger could write. `Storage` gains
   `createComp`, `getComp`, `saveComp`, `enterComp`, `saveCard`, `watchEntries`, and `compEntries` /
   `compCards` in the local keys and `SYNC_KEYS`. Deploy the rules.
2. **Organise** — the Competitions screen with *Organise*: create and edit a comp, the scoresheet
   builder with the generator, categories, status buttons, join code and QR (`qrcode` is 20 kB; or
   draw it — it is one SVG). *Mine* lists it.
3. **Enter and tick** — *Join* by code, the entry sheet (name, category), the scorecard with the
   three outcome buttons and the running score, the local mirror and write-through, the Log banner
   and the Dashboard card.
4. **Leaderboard** — the entrant's board with the 30 s throttle and the caption; the organiser's
   corrections with notes; Export CSV; `/comp/{code}/board` for the gym screen.
5. **Into the log** — *Add to my log* and `compCode` on the session; the guide's new chapter;
   the explainer unchanged (nothing about grades changes).
6. **Later, in order of who asks first** — a public board via token or Worker; top-zone format;
   shared points; walk-in entrants; witness marks; comps under `gyms/` when that tree exists;
   a push reminder the morning of a comp you have entered, through the existing push Worker.

Every step that changes what a climber can see updates `public/help.html` in the same commit,
and the privacy copy gains a paragraph the first time step 3 ships: the comp organiser sees your
display name, category and ticks; other entrants see your name and score on the board.

---

## 12. Out of scope

- Lead or top-rope comps. The model does not forbid them (`discipline` can be added to the comp),
  but the scorecard, the generator and the log mapping are written for boulders, and a rope comp
  is a different day (belayers, one route at a time, attempts that matter).
- Payment, entry fees, waivers. The gym does that at the desk as it does now.
- Photos of problems. Comp problems are numbered on the wall; the route board owns photos.
- Anything cross-gym: a league, a season, a national ranking. One comp is one document.
