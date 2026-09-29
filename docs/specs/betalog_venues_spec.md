# BetaLog — Venues: a shared registry

> Written 2026-09-29 from Ben's ask: *"I'm still not totally happy with the venue picker it seems a
> bit random (maybe cos I set venues when at home to test). I'd like it to be either location based
> or a picker so you can pick from a list of options based on entered data. No dups. This way we
> can lock down features to location perhaps? Or open up location 'admins' / teams maybe?? … I see
> this as barely impacting the UI but the back end only."* Then: *"Can you build it now?"*
>
> Build status is `BACKLOG.md` **BTL-B110**. The decisions taken are §9; what is deliberately not
> in this build is §8.

---

## 1. What was wrong

Until this a venue was a string. The climb logger's location field kept the text typed, and
`profile.venues` hung a pair of coordinates off each distinct text — **moved to wherever the phone
was on every save** (`recordVenue` took the latest fix). BTL-B41 built it on 2026-09-18 and
BTL-B59 named the flaw six days later: a session dated today but saved from home stamps home's
coordinates on the wall. Ben tested from home, so Redpoint and Flashpoint walked to his house.
After that the logger said a wall was 12 m away at home and prefilled it, and at the actual wall
nothing was within 300 m, so it fell back to the five most recent names — reordered after every
session, and holding spelling twins (*Redpoint* / *Redpoint bristol*, BTL-B60). That is the
"random".

The fix is not a better guess. It is giving a venue an identity, fixing its position once, and
never letting a save move it.

## 2. What it is now

A venue is a document in `venues/{id}`, readable by every signed-in user: a name, a position fixed
once by the person who added it standing there, and an `admins` list for what comes next. A climb
session carries `venueId` and keeps `location` as the display text. The athlete's profile holds a
small cache of the venues they use, with their positions, so the chips work offline and cost no
reads.

It is the `centres` collection from `betalog_vision.md`, flattened: a venue exists before any gym
claims it, which is the same argument `betalog_competitions_spec.md` §3 made for organisers. It
covers a crag and a mate's garage as well as Redpoint.

**The picker looks the same.** One input, the pin, chips. What changed is where the chips come
from, and one new chip.

## 3. The picker

Three sources, cheapest first (`VenuePicker.jsx`, `useVenues.js`, `lib/venues.js`):

1. **The athlete's own venues** — the profile's cache merged with every venue in the session log
   (`mergeVenues`, `venuesFromSessions`): by id, or by name for sessions from before the registry.
   If one is within 300 m of the fix it prefills, with its distance, exactly as before. Without a
   fix, the most used eight in a stable order (`topVenues`) — not the five most recent.
2. **Registry venues near the fix** the athlete has never used — a geohash prefix query
   (`Storage.findVenuesNear`), only when none of their own is in range. One to four small reads.
3. **A name search** of the registry once two characters are typed, debounced
   (`Storage.searchVenues`), so a wall someone else added is a tap.

Chips are deduplicated by id, so a venue never shows twice. Tapping a chip fills the field, links
the session to that venue, caches it, and **links the athlete's old text-only sessions that carry
its exact name** (`legacySessionIds` → `updateSessionsWhere`) — one venue where there were two
spellings. Exact match only; *Redpoint* is not linked to *Redpoint Bristol* by guesswork.

**The new chip.** When the typed name matches no registry chip (a text-only chip of that name
still counts as new — adding it is how those sessions get linked):

> ＋ Add “Flashpoint” as a shared venue

The venue goes on **unplaced, always**; the line under it says so. Placing is a separate chip,
**Place Flashpoint here**, on a picked venue with no position when there is a fix, with its own
warning line (*only tap this standing at the wall*), and it is a once-only change (§6). The first
build placed on Add whenever there was a fix; Ben, sat at home on 2026-09-29 with *Add "Redpoint"
as a shared venue here* on screen, showed why not: a fix says where the phone is, not that the
phone is at the wall, and a misplaced venue can only be undone in the console (decision 11).

The Add tap is the only way anything enters the shared list, and the Place tap the only way a
venue gets a position. **A name typed and never added stays private text on the session**, exactly as before —
which is what keeps a home wall out of a public list. The note under the Add chip says it: *A
shared venue is a public place every climber on BetaLog can pick — add a wall, not your house.*

Before adding, the app searches the registry for the exact name and uses that venue instead of
adding a twin (`duplicateCandidates`). Rules cannot enforce geography, so two names for one wall
can still both get added; an admin merge fixes it after (§8). That is how every community place
list works.

The pin's behaviour is unchanged: the first fix is always from a tap, and once the athlete has a
placed venue the field asks for a fix on open (`hasLocatedBefore`) — not when editing an older
session, whose position now says nothing about where it was.

## 4. Data

### 4.1 `venues/{id}` — the registry

```ts
interface VenueDoc {
  name:          string          // as added, trimmed, whitespace collapsed; ≤ 80 chars
  nameKey:       string          // name lower-cased — the name search and the exact-match dedup
  lat:           number | null   // null = unplaced
  lng:           number | null
  geohash:       string | null   // 9 chars of the position; the nearby query is a 6-char prefix
  createdBy:     string          // uid — the rules require it to be the writer's own
  createdAt:     string
  updatedAt:     string
  admins:        string[]        // empty on creation; nobody claims a venue by adding it
  schemaVersion: 1
}
```

The id is a uuid, not the name: names get corrected by admins.

### 4.2 `session.venueId`

`Session` gains `venueId: string | null` (absent on sessions from before). `location` stays: the
venue's name at the time, the display text, and the whole record for a typed name. Climbs keep
carrying `location` text as before; a climb's venue is its session's. `climb.centreId` stays null
— superseded by `session.venueId` (§9).

`climbSessionFields` writes `venueId` only with a name; a blank name carries no venue.

### 4.3 `profile.venues` — the cache

```ts
interface VenueRef { id: string; name: string; lat: number | null; lng: number | null }
```

The registry venues this athlete uses, most recently picked first, capped at 100. Written on every
pick, add or place; refreshed from the registry when a venue is picked again. It syncs with the
rest of the profile. **The pre-registry entries** (`{name, lat, lng, uses, lastUsed}` — a typed
name with the phone's position at some save, exactly the data that went wrong) **are dropped on
load and on cloud merge** (`migrateVenueCache`, `migrateProfile`); the names are in the session
log anyway.

### 4.4 `comp.venue`

Gains `id`: `{ id: string | null, name, lat, lng }`. Picked from the registry, the comp carries the
venue's id and position; typed, the name alone. The entrant's comp session gets `venueId` from it.

## 5. Geohash

Firestore has no geoqueries, so each placed venue stores a standard base-32 geohash and the nearby
lookup is a prefix range on it: `where('geohash', '>=', cell)`, `where('geohash', '<=', cell + '~')`.
`geohashCells(pos, 300)` is the set of 6-character cells (about 1.2 km × 0.6 km) the radius reaches —
found by encoding the centre and the eight points round the bounding box, so one to four cells, one
query each, and the results are filtered by real haversine distance on the client. In house, ~40
lines, tested against the spec's reference hashes; no dependency.

## 6. Rules

`firestore.rules`, block `/venues/{venueId}`; tested in `rules/firestore.rules.test.js`
(`npm run test:rules`, 18/18 in the emulator on 2026-09-29):

| Who | May |
|---|---|
| Anyone signed in | `get`, `list` (the nearby and name queries), `create` — as themselves (`createdBy == uid`), with `admins == []`, a name of 1–80 characters, a `nameKey`, an integer `schemaVersion` |
| Anyone signed in | place an **unplaced** venue: only `lat`, `lng`, `geohash`, `updatedAt`, only when `lat` is null, and the new values numbers — so a position is set once and never moved by a save |
| A venue's admin | change `name`, `nameKey`, `lat`, `lng`, `geohash`, `admins`, `updatedAt` — nothing else (`createdBy` is fixed) |
| The app admin (`isAdmin()`) | anything, including delete |
| Signed out | nothing |

The first admin of a venue is set by hand in the Firebase console — as the data model always said
the first centre admin would be. **The rules need deploying** (`firebase deploy --only
firestore:rules`); until then every registry read and write fails and the picker falls back to the
athlete's own list (every registry call is caught).

## 7. Cost

Spark plan, 50k reads/day (BTL-B104 is the comps' worry). A logger open costs: nothing for the
athlete's own chips; one to four reads for the nearby query, only when a fix arrives and nothing of
theirs is in range; a few reads per name typed, debounced. Single digits per session. The profile
document grows by ~100 bytes per venue cached.

## 8. Not in this build — the backlog rows

- **BTL-B111 — deploy the rules.** Ben, from the laptop.
- **BTL-B112 — venue admins and the venue manager.** Rename, merge (`mergedInto` on the loser;
  readers follow the pointer), add an admin by friend code (the comp organiser pattern); and
  BTL-B60's manager in Settings, now pointing a legacy name at a registry venue so *Redpoint* and
  *Redpoint Bristol* become one. The rules already let an admin rename and move. Both are specced
  together in `betalog_venue_manager_spec.md` (2026-09-29).
- **BTL-B113 — comps at a venue.** A comp's `venueId` is written now; a venue's admins organising
  its comps automatically, a venue page listing its comps, and anything else "locked to location"
  waits on B112. Then the route board (`betalog_vision.md`) hangs off `venues/{id}/routes`.
- A `private` flag for a home wall in the registry. Not needed while a typed name that is never
  added stays private; revisit if people add their houses anyway.
- Offline: a venue added with no signal is lost with an error line, not queued. Type it and add it
  next time.

## 9. Decisions

1. **Shared registry, not a per-user list with fixed coordinates.** A per-user list cannot be
   locked to or administered, comps already need one venue that organiser and entrants share, and
   this is the bridge to `centres` without building `gyms/` first.
2. **A flat `venues/` collection, not `gyms/{g}/centres/{c}`.** A venue exists before a gym claims
   it (`gymId` can be added later); crags and garages are venues too.
3. **Position set once, at an explicit tap, never by a save.** BTL-B59's two options were both
   rejected: the mechanism is deleted. This is the whole fix for "random".
4. **Adding is deliberate and named as shared.** Nothing enters the registry as a side effect of
   saving a session. Typed names stay private.
5. **Adding never claims.** `admins` is empty on creation; the first admin is set by hand.
6. **`session.venueId`, and `climb.centreId` stays null.** Per-climb analytics read the venue
   through the session; stamping every climb again bought nothing.
7. **Exact-name linking only** for old sessions. Prefix or fuzzy matching would guess; B60's
   manager is where a person says two names are one wall.
8. **The cache lives in the profile**, so it syncs like everything else and the chips work with no
   signal — climbing walls have poor signal.
9. **No dependency for geohash.** Forty lines in house, tested.
10. **`profile.venues` migrates by dropping**, not converting: the old coordinates were the bug.
11. **Add never places** (2026-09-29, same evening). Adding puts a name on the list; placing is
    always its own *Place … here* tap. Two taps at the wall instead of one, and no tap from the
    sofa can put a wall at a house.

## 10. Files

| File | What |
|---|---|
| `src/lib/venues.js` | Rewritten, pure: names and keys; geohash; `newVenueDoc`, `placedFields`, `venueRef`, `duplicateCandidates`, `nameProblem`; the cache (`cacheVenue`, `migrateVenueCache`, `hasLocatedBefore`); the log's venues (`venuesFromSessions`, `mergeVenues`, `legacySessionIds`); what the picker offers (`topVenues`, `nearbyVenues`, `suggestVenue`, `matchVenues`, `isNewName`) |
| `src/lib/storage.js` | `createVenue`, `placeVenue`, `getVenue`, `findVenuesNear`, `searchVenues`; `migrateProfile` on load and cloud merge |
| `src/hooks/useVenues.js` | `venues`, `locatedBefore`, `pickVenue`, `addVenue`, `placeVenue`, `findNearby`, `search` |
| `src/hooks/useSessions.js` | `updateSessionsWhere(ids, updates)` — one save for the linking |
| `src/components/log/VenuePicker.jsx` | Owns the fix, the three sources, the prefill, the Add and Place chips; props `value`, `venue`, `onChange(name, ref)`, `accent`, `autoLocate` |
| `src/components/log/ClimbLogger.jsx` | `venue` state beside `location`; `venueId` on every write; no geolocation of its own |
| `src/lib/sessions.js` | `climbSessionFields` carries `venueId` |
| `src/pages/comp/CompEditor.jsx`, `src/lib/competition.js` | `comp.venue.id`; the comp session's `venueId` |
| `firestore.rules`, `rules/firestore.rules.test.js` | §6 |
| `dev/fake-firebase/firestore.js` | Range operators and `limit`, so the harness runs the queries |
| `src/lib/types.js`, `docs/specs/betalog_data_model.md`, `docs/specs/betalog_privacy_spec.md`, `public/privacy.html`, `public/help.html` | Shapes and copy |

Tests: `venues.test.js` (43), `sessions.test.js`, `competition.test.js`, `storageUnsynced.test.js`
(the migration); 890 pass. Seen in Chromium at 390 px with Firebase faked: the migrated cache empty;
the old text-only names as chips, most used first; the pin at Redpoint with nothing on the registry;
tapping *Redpoint bristol* then *Add … here* → one registry document with the fix, both old
spellings' sessions linked, the cache holding it; a climb logged carries the id; after a reload the
field auto-locates and prefills *Redpoint bristol 0 m*; a stranger at Redpoint gets it as a chip
at 81 m and prefilled; *The Depot* added unplaced, found by typing *red*, placed later from the wall;
the comp editor prefilling the same venue with its id on the draft.
