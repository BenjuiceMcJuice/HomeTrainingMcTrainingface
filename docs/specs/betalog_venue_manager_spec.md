# BetaLog — The venue manager

> Written 2026-09-29 from Ben's ask, after his export showed four spellings for two walls and no
> venue on the registry yet: *"Venue manager a more strategic way to do it yea? Spec it out and
> how it'd work."* BTL-B60 was filed on 2026-09-24 (*"For later maybe"*) as a rename-and-merge
> list; this is that row, redrawn on top of the shared registry (`betalog_venues_spec.md`).
>
> Build status is `BACKLOG.md` **BTL-B60**. The admin layer is **BTL-B112** and is §7 here; it is
> the same screen, so it is specced with it. Decisions are §10.

---

## 1. What it is for

Every climb session carries where it was — as text from before the registry, or as a link to a
shared venue since. The picker lets you *add* a venue from the logger, standing at the wall. What
it cannot do is tidy what is already there: say that *Redpoint* and *Redpoint bristol* are one
wall, give two venue-less sessions a venue, or, later, correct a venue on the registry itself.

The venue manager is **one screen that lists every venue in your log and lets you say what it
is.** Personal first (your sessions, your cache), and the same rows grow admin actions when you
administer a venue. It is the place a person makes a judgement the app must not guess: that two
names are one place.

Ben's export, 2026-09-29, is the acceptance case:

| Text on sessions | Sessions | Registry |
|---|---|---|
| Redpoint bristol | 4 | not yet |
| Redpoint | 4 | not yet |
| Flashpoint bristol | 3 | not yet |
| Flashpoint | 3 | not yet |
| *(no venue)* | 2 | — |

Two taps per wall should leave that as two rows, both shared, and the *(no venue)* row emptied if
he wants.

## 2. Where it lives

**Settings › Venues.** A row under the profile fields: *Venues · 4* (the count of distinct venues
in the log), with a chevron. Tapping it opens a slide-up sheet, **Your venues**, in the app's
sheet pattern (the Friends sheet: fixed overlay, white rounded panel from the bottom, its own
scroll). Settings is right because it is housekeeping, not logging; nothing about it belongs on
the Log page, which should stay four taps to a climb.

Not on the Dashboard, not in Plan.

## 3. The list

The same list the picker's own chips come from — `mergeVenues(profile.venues,
venuesFromSessions(sessions))` — so the manager and the picker never disagree. Most used first.
One row per venue:

```
Redpoint bristol            4 sessions · last 16 Sep
● Shared · placed

Redpoint                    4 sessions · last 12 Sep
○ Name only — tap to say which venue this is

Flashpoint                  3 sessions · last 20 Aug
○ Name only

The Depot                   0 sessions
● Shared · not placed yet

No venue                    2 sessions
```

The status line is one of:

| Status | Meaning |
|---|---|
| **Shared · placed** | On the registry with a position. The pin is a tap in the logger. |
| **Shared · not placed yet** | On the registry, no position — added away from the wall. Placing it happens from the logger at the wall (*Place … here*), not here; the row says so. |
| **Name only** | Text on sessions, never added. This row is what the manager exists for. |
| **No venue** | Sessions with no location at all. Only shown when there are any. |

Comp sessions are counted but never rewritten (§5.3), and a row that is only comp sessions says
*from competitions*.

## 4. Actions

Tapping a row opens a small action list under it (an inline expansion, not another sheet — the
sheet is already one deep). Which actions appear depends on the status.

### 4.1 Name only → **This is …**

The core action. Opens a panel headed *Which venue is "Redpoint"?* with the **same `VenuePicker`**
the logger uses, `value` prefilled with the row's name, `autoLocate` off (you are on the sofa).
Its chips are therefore: your own shared venues, a registry name search as you type, and the
*Add "Redpoint" as a shared venue* chip (unplaced, as Add always is; the logger places it next
visit). The row's own text-only chip is left out of the chips — picking itself means nothing.

When a shared venue is picked, an **Apply** button reads *Link 4 sessions to Redpoint bristol*
and does exactly that (§5.1). The row disappears into the venue it joined; the count on that row
rises. When the row's own name is *added* as a shared venue (or a shared venue of that exact name
is picked), the picker's pick has already linked its sessions — that is what a pick does
everywhere — so there is no Apply step: the row turns *Shared* in place with *Linked 4 sessions to
Redpoint bristol* under it (found building it, 2026-09-29; the earlier draft had an Apply here
that would have had nothing left to do).

If the person types a different plain name and applies without picking, that is a **rename**
(§4.2), and the button says so: *Rename on 4 sessions*.

### 4.2 Name only → **Rename**

Retype the text. Applies to every session carrying the exact old name (§5.2). A rename to a name
that already exists as a text-only row merges the two rows, because they now share a key. A rename
to a shared venue's name is offered as *This is …* instead, since that is what it means.

### 4.3 Shared (mine) → **Move sessions to …**

The same picker again, for a shared venue you linked by mistake, or two shared venues that are
one wall in your log. Rewrites your sessions from venue A to venue B (§5.1); says *Move 3 sessions
to Flashpoint bristol*. Nothing on the registry changes — that is an admin's merge (§7).

### 4.4 Shared (mine) → **Forget**

Drops the venue from your cache. Only offered on a row with **0 sessions** (a venue you picked and
never logged at); a venue with sessions comes straight back from them, so the action would lie.

### 4.5 No venue → **Set to …**

The picker, for the venue-less sessions. *Link 2 sessions to Redpoint bristol*. Same operation as
4.1 with an empty key. The one row where a person might reasonably want *some* sessions and not
others — this version does all of them, and says so in the button. A per-session choice is
History's edit sheet, which already exists.

### 4.6 What there is not

No delete of a venue from your log — a session's venue is deleted by editing the session. No
per-session picking here. No map. No bulk "guess the rest".

## 5. What each action writes

All pure, in `lib/venues.js`, tested; the hook applies them with **one** `updateSessionsWhere` per
action, so one localStorage write and one sync however many sessions moved.

### 5.1 `relinkSessions(sessions, from, to)`

`from` is `{ id }` (a shared venue) or `{ key }` (a text-only name; `''` for *no venue*). `to` is a
`VenueRef`. Returns the ids of the sessions to rewrite and the fields:

```
{ venueId: to.id, location: to.name, climbs: climbs.map(c → { ...c, location: to.name }) }
```

Climbs are rewritten too. **This also fixes an omission in BTL-B110:** the pick-time linking
(`pickVenue` → `legacySessionIds`) rewrites `session.location` and leaves `climb.location` as the
old text. Harmless today (every reader takes the session's text first) but wrong, and the manager
must not repeat it. The B110 path moves onto the same function in this build.

Matching for `{ key }` is `venueKey(sessionLocation(s)) === key && !s.venueId`; for `{ id }` it is
`s.venueId === id`. Comp sessions are excluded (§5.3).

### 5.2 `renameSessions(sessions, key, newName)`

Text-only sessions with that key get `location: cleanName(newName)` and their climbs the same.
`venueId` stays null. Blank new name refused (`nameProblem`).

### 5.3 Comp sessions

A comp session's venue is the comp's (`sessionForComp` re-derives it on every refresh), so any
rewrite here would be undone. They are counted on the row and skipped by both functions; the
button says *Link 4 sessions (1 from a competition stays as it is)* when it matters.

### 5.4 The cache

`relinkSessions` to a venue also `cacheVenue`s it (it may be a search result not yet cached).
*Forget* is `profile.venues` without that id.

## 6. The undo question

A relink of four sessions is four session edits; there is no undo in the app for any edit. The
manager confirms with the count in the button and nothing more — a `ConfirmDialog` on top of an
explicit *Link 4 sessions to …* button is a second question with the same answer. Reversal is
*Move sessions to …* the other way, which is the same cost as the mistake. No new mechanism.

## 7. The admin layer — BTL-B112, same screen

A row whose registry document lists you in `admins` (or every shared row, for the app admin)
gains a second group of actions, headed *You admin this venue*:

| Action | Writes | Rule (already deployed) |
|---|---|---|
| **Rename** | `name`, `nameKey`, `updatedAt` on the document | admin: those fields only |
| **Move here** | `lat`, `lng`, `geohash` from a fresh fix, after a confirm that says the old distance | admin |
| **Add admin** | `admins` += uid, by friend code (`lookupFriendCode`, the comp organiser pattern) | admin |
| **Merge into …** | picker → `mergedInto: <winner id>` on this document, and `updatedAt` | **needs a rules change**: `mergedInto` added to the admin field list |
| **Remove** | delete the document | app admin only (`isAdmin()`) |

**Merge follows a pointer.** The loser keeps its document with `mergedInto` set. `Storage.getVenue`
returns the winner when it meets a pointer; the nearby and name queries drop pointed documents
before returning; `mergeVenues` treats a cached loser as the winner on the next `pickVenue`.
Every athlete's sessions that point at the loser are relinked **on their own device, on their next
app open**: a small pass in `useVenues` that reads each cached venue once (a handful of reads),
follows any pointer, and runs `relinkSessions` for it. No cross-user writes, which the rules
would refuse anyway, and no Worker.

The first admin of a venue is set by hand in the console (BTL-B115); after that admins add
admins. The comp side (BTL-B113) is where a venue's admins organise its comps and a venue page
appears; none of that is in the sheet.

## 8. Files

| File | What |
|---|---|
| `src/lib/venues.js` | `relinkSessions`, `renameSessions`, `venueRows` (the list with status and counts, comp sessions marked) |
| `src/hooks/useVenues.js` | `relink(from, to)`, `rename(key, name)`, `forget(id)`; `pickVenue` moves onto `relinkSessions` |
| `src/hooks/useSessions.js` | `updateSessionsWhere` gains a per-session updater form (climbs differ per session) |
| `src/components/layout/VenuesSheet.jsx` | New: the sheet, rows, inline actions, the picker panel, the Apply button |
| `src/components/layout/SettingsSheet.jsx` | The *Venues · n* row |
| `src/components/log/VenuePicker.jsx` | An `exclude` prop (the row's own name) — nothing else |
| `public/help.html` | Settings chapter: *Venues* |
| B112 additions | `firestore.rules` (`mergedInto`), `storage.js` (pointer following, `renameVenue`, `moveVenue`, `addVenueAdmin`, `mergeVenue`, `deleteVenue`), the admin group in the sheet, the on-open relink pass |

## 9. Tests and checks

- Pure: `relinkSessions` by key, by id, from *no venue*; climbs rewritten; comp sessions skipped;
  `renameSessions` merges into an existing key; `venueRows` statuses and counts on Ben's export
  shape (four names, two venue-less, one comp).
- Rules (B112): an admin may set `mergedInto`; nobody else may; placing still refused once placed.
- Chromium, Firebase faked, seeded with the shape above: *Redpoint* → *This is …* → *Add
  "Redpoint bristol"*… no — pick the existing *Redpoint bristol* row's venue once that is shared;
  the honest first run is: *Redpoint bristol* → *This is …* → *Add as a shared venue* (unplaced),
  4 linked; *Redpoint* → *This is …* → pick *Redpoint bristol*, 4 more linked, row gone; the same
  for Flashpoint; *No venue* → *Set to …*. Then the logger shows two chips. Then a phone, at the
  wall: *Place Redpoint bristol here*.

## 10. Decisions

1. **Settings, not Log.** Housekeeping lives with the profile; the logger stays for logging.
2. **One list for the picker and the manager** — `mergeVenues` — so they cannot disagree.
3. **Reuse `VenuePicker` for "This is …"** rather than a second chooser. Same chips, same Add,
   same code path; the manager adds one prop.
4. **Exact-name only, by a person.** The app never guesses that *Redpoint* is *Redpoint bristol*;
   it makes saying so one tap.
5. **All-or-nothing per row.** Splitting a name's sessions between venues is History's job.
6. **No confirm dialog** on top of a button that already states the count.
7. **Comp sessions are never rewritten** here; the comp owns their venue.
8. **Climbs are rewritten with the session**, and B110's pick-time link is moved onto the same
   function.
9. **Merge is a pointer, relinked lazily per user.** No cross-user writes, no Worker, no big-bang.
10. **Admin actions are the same rows**, not an admin page. BTL-B22's admin page stays about the
    app admin's cross-user view; a venue's admin is a climber in Settings.
