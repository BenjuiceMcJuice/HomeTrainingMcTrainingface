# BetaLog — Walls: a table the app ships with, and your own places

> Written 2026-09-29, the evening the shared venue registry (BTL-B110) and the venue manager
> (BTL-B60) went live, from Ben's reaction to using them: *"I just want it to be super simple for
> people. No pins and shared locations etc. Maybe people can add their own custom locations like
> 'my loft wall' or outside crags perhaps. Start planning / speccing out getting wall locations in
> Bristol and south wales (Cardiff and Swansea specifically)."* And, a message earlier: *"Would it
> not be easier to trawl addresses for climbing centres and rough coordinates and load them into a
> table?"* — yes.
>
> Build status is `BACKLOG.md` **BTL-B117** (the table and the picker) and **BTL-B118** (the
> Bristol, Cardiff and Swansea data). Decisions are §9. This supersedes the *shared registry*
> parts of `betalog_venues_spec.md` (§9 says which parts survive).

---

## 1. What is wrong with what shipped today

The registry asks climbers to do two things a climber should never have to do: put a wall on a
public list, and stand in it to pin it. Every wall in the country is already a known place with a
known position. Asking the first visitor to add it, and the first visitor with location on to
place it, is work the app should have done once, for everyone, before anyone opened it. Ben saw
the result on his own phone: *Add "Loft wall" as a shared venue*, a pin that did nothing at
Flashpoint, and the question *"can you move the pin?"* with no good answer.

## 2. What it is instead

**One table of walls, shipped with the app.** A JSON file in the repo — name, city, position —
curated in the repo, deployed like any other change. The picker reads it directly: no Firestore
reads, no rules, no quota, works with no signal, nothing for anyone to add or place. Adding a wall
is a commit; a climber whose wall is missing says so through *Send feedback* and it is there in the
next release.

**Your own places, private.** Anything typed that is not a wall — *my loft wall*, *Avon Gorge*,
*Dave's board* — is text on the session, exactly as before the registry. It is offered back as a
chip from your own log. It goes nowhere.

**The picker looks the same, minus two chips.** Input, pin, chips. No *Add as a shared venue*, no
*Place here*, no talk of shared anything.

## 3. The picker

- **Located** (the pin, or on open once location has been allowed): the walls within 300 m of the
  fix, nearest first with the distance; exactly one → filled in. This now works at any wall in the
  table on the first visit, for everyone.
- **Not located**: your recent places, most used first — walls and your own names alike, from
  your log. Up to eight.
- **Typing**: the table filtered by any part of the name (*fla* → *Flashpoint Bristol*,
  *Flashpoint Cardiff*, *Flashpoint Swansea*), plus your own names that match. Client-side; the
  table is small.
- **A typed name that matches nothing** is simply kept, as your own place. No chip, no prompt.
- **The line under the chips** says what the pin found, as now, and nothing about adding.

**Asking for location on open.** Today the logger only auto-locates once a placed venue exists.
Now: once a fix has ever succeeded on this device (a device-local flag, `il_locationOn`, set by the
first successful fix — the Permissions API is not reliable enough on iOS Safari to be the only
signal), the logger asks on open, so the chips are there before the field is reached. The first
ask is still from a tap on the pin.

## 4. Data

### 4.1 The table — `src/lib/walls.json`

```ts
interface Wall {
  id:      string        // stable slug: "redpoint-bristol"
  name:    string        // "Redpoint Bristol" — as the wall calls itself
  city:    string        // "Bristol" — for the chip's second line when two names collide
  lat:     number
  lng:     number
  source:  "osm" | "manual"
  osm?:    string        // "way/123456" — so the fetch script can refresh it
  aka?:    string[]      // other names people type: ["Redpoint", "Redpoint bristol"]
}
```

`aka` is what links old text to a wall without guessing: *Redpoint* matches Redpoint Bristol
because the table says so, not because of a prefix. The manager (§6) adds to it by hand when a
person says two names are one wall.

### 4.2 The session

`session.venueId` stays and holds the wall's slug (the field is already on every session logged
since B110; renaming it buys nothing). `location` stays the display text — the wall's name when
linked, else the typed place. Climbs carry `location` as text, as now.

### 4.3 What goes

- `profile.venues` (the cache) — dropped on load, again. Walls ship with the app.
- The `venues/` Firestore collection and its rules block — removed. `Storage.createVenue`,
  `placeVenue`, `getVenue`, `findVenuesNear`, `searchVenues` — removed. The geohash code —
  removed (nearby is a haversine over a small array).
- Existing sessions pointing at a registry uuid (only Ben's tonight, if any): on load, the
  `venueId` is matched by name key against the table's names and `aka`; a match becomes the slug,
  no match becomes text-only. Idempotent.
- `comp.venue.id` becomes a wall slug when picked from the table; typed stays text.

## 5. Sourcing the walls — BTL-B118

**OpenStreetMap is the source**, via a script in the repo run from the laptop (this cloud session
cannot reach OSM, UKC or a postcode geocoder — every fetch was refused by the network policy on
2026-09-29). `scripts/fetch-walls.mjs`:

1. Runs one Overpass query per area (bounding boxes for Bristol, Cardiff, Swansea) for
   `sport=climbing` + `leisure=sports_centre`, `climbing=gym`, and `sport=climbing` + `indoor=yes`,
   with `out center` so ways and relations get one point.
2. Prints a candidate list — name, position, address tags, website, OSM id — to
   `scripts/walls.candidates.json` and to the terminal. **Nothing is written to the app.**
3. Ben reads it, fixes names, drops what is not a wall (a school's climbing wall, a soft-play
   "crazy climb"), adds what OSM lacks by hand with a position from the wall's own website or a
   map, and the reviewed list is committed as `src/lib/walls.json`.

Attribution: OSM data is ODbL. One line in the guide and the privacy page: *The wall list
includes data © OpenStreetMap contributors.*

### 5.1 The candidates so far — names from a web search tonight, none verified, no positions

To be confirmed or struck by the script and Ben. Names as the walls use them where known.

| Area | Candidate | Note |
|---|---|---|
| Bristol | Redpoint Bristol | Ben's log has it as *Redpoint* / *Redpoint bristol* |
| Bristol | Flashpoint Bristol | near Temple Meads; Ben's *Flashpoint* / *Flashpoint bristol* |
| Bristol | The Climbing Academy — The Mothership | TCA's bouldering centre; check the current name |
| Bristol | The Climbing Academy — The Church | TCA's roped centre, Cotham |
| Bristol | Bloc Climbing Bristol | |
| Bristol | Undercover Rock | listed on one page as Bristol's original wall, St Werburghs; **check it is still open** |
| Cardiff | Boulders | Newport Road |
| Cardiff | Flashpoint Cardiff | Freemans Parc |
| Cardiff | Climbing Blocks | independent bouldering |
| Cardiff | UniWall | St Andrew's Crescent; check |
| Cardiff | 270 Climbing | a Cardiff page exists; check what and where |
| Swansea | Flashpoint Swansea | Parc Tawe |
| Swansea | The Climbing Hive | formerly The Climbing Hangar Swansea |
| Swansea | Dynamic Rock | roped |
| Swansea | LC Swansea climbing wall | a leisure-centre wall; include or not is Ben's call |
| Swansea | Crazy Climb | Parc Tawe; a fun-climb, probably not a wall for this app |

Sources are in the 2026-09-29 log. Everything above is a name to check, not a fact.

## 6. Settings › Locations — the manager, simplified

The sheet built today stays, renamed *Locations*, with two statuses instead of four:

| Status | Meaning |
|---|---|
| **Wall** | In the table. Position known; suggested by the pin. |
| **Your place** | Text on your sessions. Private. |

Actions: on *Your place*, **This is …** opens the picker filtered to the table, to link every
session of that name to a wall (and the name is proposed for that wall's `aka` — a note for Ben,
not a write); **Rename**. On a wall, **Move sessions to …**. *No venue* → *Set to …*. No Add, no
Forget, no admin group; BTL-B112 as written is closed by this.

## 7. Files

| File | What |
|---|---|
| `src/lib/walls.json` | New — the table (§4.1) |
| `src/lib/venues.js` | Keep: names, distance, `venuesFromSessions`, `nearbyVenues`, `suggestVenue`, `topVenues`, `matchVenues`, the manager functions. Add: `findWall(nameKey)` (name + `aka`), `migrateVenueId`. Remove: geohash, `newVenueDoc`, `placedFields`, `duplicateCandidates`, the cache functions |
| `src/lib/storage.js` | Remove the venue registry functions; migrate `venueId`s on load and cloud merge |
| `src/hooks/useVenues.js` | `venues` = walls the log uses ∪ own places; no add/place/search/findNearby; `locatedBefore` from the device flag |
| `src/components/log/VenuePicker.jsx` | Chips from the table and the log; no Add or Place chip |
| `src/components/layout/VenuesSheet.jsx` | Two statuses; no Add / Forget |
| `firestore.rules`, `rules/firestore.rules.test.js` | The `venues/` block and its tests removed |
| `scripts/fetch-walls.mjs` | The Overpass fetch (§5) |
| `public/help.html`, `public/privacy.html`, the privacy spec | Walls and your own places; the OSM line; nothing about shared venues or placing |
| `docs/specs/betalog_data_model.md` | `Wall`, `venueId` = slug, the `venues/` collection struck |

## 8. Order

1. **BTL-B118 first** — run the script on the laptop, review, commit `walls.json` with Bristol,
   Cardiff and Swansea. Data before code; nothing else is worth testing without it.
2. **BTL-B117** — the picker over the table, the removals, the migration, the manager's two
   statuses, the rules cleanup (a rules deploy, to remove the block). One branch, one release.
3. Later, when a gym wants to run its own wall: a `venues/` collection for gym-managed walls can
   come back behind the same picker, keyed by the same slug. Nothing in the table's shape blocks
   it.

## 9. Decisions

1. **A static table, not a Firestore collection.** Zero reads, offline, no rules, nothing to
   place or administer. A commit per new wall is fine at this scale, and Ben curates.
2. **Nobody adds to the table from the app.** A missing wall is feedback.
3. **Own places stay text and private.** No flag, no registry, no position — a name.
4. **Position comes from the data, never from a phone.** So no pin can ever be at a house, and
   there is nothing to move.
5. **`venueId` keeps its name** and holds a slug.
6. **`aka` is how spellings meet walls** — a list a person maintains, not a matcher that guesses.
7. **Location on open is a device flag**, set by the first successful fix; the first ask is
   still from the pin.
8. **What survives from `betalog_venues_spec.md`:** the picker's shape and states, the 300 m
   rule, the one-in-range prefill, the haversine, the session's `venueId` + `location`, and the
   manager's *This is …*. What goes: the registry, adding, placing, admins, geohash, the cache.
9. **OSM is the seed** and gets its attribution line; the reviewed table is the truth.
