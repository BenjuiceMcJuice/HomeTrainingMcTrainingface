# BACKLOG — BetaLog

Everything outstanding, one row each. **Why it matters and how it was found lives in `DEVLOG.md`;**
this file only says what is left and who can do it.

Follows [the Benjuicey Apps backlog standard](https://github.com/BenjuiceMcJuice/Benjuicey-apps/blob/main/docs/backlog-standard.md)
(`Benjuicey-apps/docs/backlog-standard.md`). IDs are never reused.

**Kinds:** Check (go and look, no code) · Bug (wrong now) · Decision (needs a human choice) ·
Feature · Chore. **State:** Ready or Blocked.

---

## Open

| ID | Item | Kind | Who | State | Blocked on |
|---|---|---|---|---|---|
| BTL-B118 | **Wall data — Bristol, Cardiff, Swansea.** Run `betalog-react/scripts/fetch-walls.mjs` from the laptop (Overpass is refused from the cloud session), review `scripts/walls.candidates.json` against the candidate list in `betalog_walls_spec.md` §5.1 (16 names from a web search, none verified), fix names, drop what is not a wall, add what OSM lacks with a position from the wall's site, commit as `src/lib/walls.json`. Data first; BTL-B117 is not worth testing without it. **Ben chose to populate by hand instead of the script** (2026-09-29, *"I'll just manually populate the table"*) — Google Maps long-press coordinates, one line per wall. **Bristol so far, 3 walls committed** (Flashpoint Bristol, Redpoint Bristol, Flashpoint Easton — the old Bloc; the name for that one is a guess from Ben's *"Flashpoint Bristol - Easton (Bloc)"*, check it). Still to come: TCA (Mothership, Church), any other Bristol wall, Cardiff, Swansea. The script stays as an option for when the list outgrows a person | Chore | **Ben** | Ready | — |
| BTL-B119 | Delete the stray `venues` documents from the 2026-09-29 registry in the Firebase console, if any were added — nobody has looked. **The rules half is done:** deployed from the laptop on 2026-09-30, off `main` at the BTL-B117 release, so the `venues/` block is gone and the collection is closed to every client | Chore | **Ben** | Ready | — |
| BTL-B102 | Link-preview image design — `public/og-image.png` is a placeholder (BL icon + name on dark ink). Replace with the chosen design, same file name, 1200×630 | Design | **Ben** | Ready | — |
| BTL-B9 | `attempts` never increments — probably not a bug, see note — **since comps step 3, `attempts` carries a real count on comp climbs** (goes to the top, or goes tried); the ordinary logger still writes 1 | Decision | **Ben** | Ready | — |
| BTL-B11 | Q4 — route identity per climb; **more relevant since the cap went** | Decision | **Ben** | Ready | — |
| BTL-B12 | Re-date the two stale goals — 7a and V5 are both unreachable | Chore | **Ben** | Ready | — |
| BTL-B15 | Feedback widget round-trip — one submission, now from the live HELP chip, seen arriving in the shared backend. Was the gate for the header button; Ben released without it on 2026-09-24 and owns checking it live | Check | **Ben** | Ready | — |
| BTL-B16 | Branch cleanup — 29 of 36 remote branches are merged | Chore | **Ben** | Ready | — |
| BTL-B17 | `step9-wip` — keep or drop? 158 commits behind `main` | Decision | **Ben** | Ready | — |
| BTL-B20 | Dashboard widget consistency — 6 phases, spec written, not started | Feature | Session | Blocked | 3 decisions in the spec |
| BTL-B21 | AI coach output review — diet review + mini plan | Feature | Session | Blocked | scope decision |
| BTL-B22 | Admin page | Feature | Session | Blocked | spec TBD — note the comp organiser role in `betalog_competitions_spec.md` §3 is the first real role beyond the hard-coded admin UID, and proposes not building the `gyms/` staff table for it |
| BTL-B23 | Calorie balance view — cardio burn vs drink intake | Feature | Session | Blocked | scope decision |
| BTL-B27 | Rename the repo `HomeTrainingMcTrainingface` → `betalog` (low priority) | Chore | **Ben** | Ready | — |
| BTL-B29 | Cardio goals read an all-time PB — the career-high pattern grades just dropped | Decision | **Ben** | Ready | — |
| BTL-B37 | If the removed 6b+ goal comes back after a reload, it is sync: on load the cloud copy replaces local whenever `users/{uid}.updatedAt` is newer than the *profile's* `updatedAt`, which is nearly always, so a delete whose write failed is undone silently — **cause confirmed 2026-09-28** in the harness (a climb tapped 150 ms before a reload was gone after it; no Firestore offline cache, so an unsent change never reaches the cloud and sign-in replaces it). Fix live with BTL-B76 2026-09-28 (spec §4.9); once live, the check is: delete something with signal off, reopen with signal on, it stays deleted | Check | **Ben** | Ready | — |
| BTL-B114 | Walls on a phone — walk into Redpoint, Flashpoint or Flashpoint Easton, tap the pin once (after that the logger checks on opening), and the wall should be filled in with its distance, no adding, no placing. BTL-B117 was seen in Chromium at 390 px with Firebase faked and a fix 58 m from Flashpoint; never on a phone | Check | **Ben** | Ready | — |
| BTL-B113 | Comps at a wall — `comp.venue.id` becomes a wall slug from the table; a page per wall listing its comps, and a gym-managed wall record later. Waits on the table | Feature | Session | Blocked | BTL-B117 |
| BTL-B68 | A hangboard session is saved as the routine was planned, even after *End* part-way; the log cannot show what was actually completed. The guide says so. Record completed reps, or leave it and say why | Decision | **Ben** | Ready | — |
| BTL-B73 | Delete a throwaway account end-to-end on the live site — sign up with a spare email, log a session, add your real account as a friend, turn on the calendar feed, then delete it. Check: it signs out to the login screen, the friend vanishes from your real friends list, the calendar link 404s, and Firebase console shows no `users/{uid}` and no auth user. Could not be run from the cloud session (no sign-in) | Check | **Ben** | Ready | — |
| BTL-B74 | Bouldering competitions — organiser sets up a comp on a date at a venue with a scoresheet of problems (max goes per problem, per-go percentages, zone value, optional grade with a show/hide toggle); entrants join by code and log goes / zone / top on a card that is a climb session in their own log; live leaderboard; organiser voids with a note; close reveals hidden grades. Spec ready for build 2026-09-26: `docs/specs/betalog_competitions_spec.md`, five steps in §11, decisions in §12. Each step stops at its branch for Ben's word to merge. Step 1 (model, maths, rules, storage) merged 2026-09-27; the rules need deploying (BTL-B77). **Step 2 (organise — `/comp` shell, home, editor, details, manage) merged 2026-09-27** on Ben's word, verified in Chromium at 390 px with Firebase faked. **Step 3 (enter and climb — Enter, the scorecard, the comp session in the log, the Dashboard card, History) merged 2026-09-27** on Ben's word. **Step 4 (leaderboard and voids) merged** — `/comp/:code/board`, a board per category + Overall, own row pinned, entrants' board refreshed every 30 s, the *Leaderboard visible to entrants* switch, organiser taps a climber to see the card and void a problem with a note; *Open the board* on the Next step card. Seen in Chromium with four climbers over two categories. **Merged to `main` on Ben's word 2026-09-27**, cache v58. **Step 5 (the final placing on History) built 2026-09-27 as BTL-B97** — all five steps done | Feature | Session | Ready | — |
| BTL-B80 | Comp colours and scoring — get real comp-setter feedback on the colour column (free text, and truncated to *gree* on a phone) and on the goes / zone / top scoring before changing either. Ben, 2026-09-27: *"I don't know re the colour choice and score functionality works for me"* | Decision | **Ben** | Blocked | setter feedback |
| BTL-B95 | Comps: a **judge** role — someone who can amend cards but not edit the comp. Needs a `judges` list on the comp, a rule letting judges write entries, a way to add one (e.g. by friend code), and a rules deploy. Split from BTL-B85 when organiser amending shipped | Decision | **Ben** | Ready | — |
| BTL-B90 | Comp notifications — a push the day before a comp, an hour before, and when scoring starts, to everyone entered and its organisers. Built on Route B (web push, `workers/betalog-push`): the mirror gains **one-off** entries (`{id, atMs, title, body, url}`) beside the weekly schedule; the app re-uploads it when a comp is entered, withdrawn, or its date/start changes; the Worker sends one-offs once and drops them after. Only devices with push reminders on (Plan › Schedule) get them — the comp's Enter step should offer to turn push on. Needs a Worker deploy by Ben. Ben, 2026-09-27: *"an app notification when a comp is 1 day away, an hour away and when it starts"* | Feature | Session | Ready | — |
| BTL-B107 | One `npm test` run on 2026-09-28 (building BTL-B106) reported *1 failed / 879 passed*; **caught by name 2026-09-29** (building BTL-B60): `weightGoalScore.test.js › demonstratedLossRate — keeps the scan bounded on a long daily log` asserts the bounded call is 3× faster than the unbounded one by wall clock, and the bounded call runs first, cold — *678 ms vs 427 ms* on a loaded container. Fix: warm both once, or take the best of three, before comparing | Bug | Session | Ready | — |
| BTL-B104 | Comp leaderboard reads can blow the Spark plan's 50k reads/day. Every open board is an `onSnapshot` on `entries` (`storage.js` `watchEntries`), billed one read per changed card per viewer — reads ≈ card writes × boards open. The entrant board's 30 s refresh (`CompBoard.jsx`) only throttles the redraw, not the reads. Rough: 30 climbers × ~80 taps ≈ 2.4k writes; ~10 boards open ≈ 25k reads, everyone watching ≈ 70k; 100 climbers with ~20 watching ≈ 160k. Over quota, Firestore refuses everything for everyone until 08:00 UK. Fixes: entrants poll `where('updatedAt', '>', last)` every 30 s (a card changed five times costs one read), or the spec §10 Worker-published `board` summary doc. Also correct §10's *"well inside"* line when fixed. Not needed for club-sized comps; do before a big one | Feature | Session | Ready | — |
| BTL-B122 | Comp poster and preview on a phone — on Manage tap **Poster (PDF)** and print or save it from the phone (iOS installed app included); paste a comp link that has never been shared into WhatsApp and see the BetaComp card with *Join the comp · CP-…*. Both seen only in Chromium and `wrangler pages dev` (BTL-B120, BTL-B121) | Check | **Ben** | Ready | — |
| BTL-B124 | Google sign-in in the installed app on **betalog.co.uk** — delete the old home-screen icon, add it again from Safari, sign in with Google from the icon. BTL-B123 was seen working on an iPhone on its preview (`claude-pwa-google-signin.betalog.pages.dev`), not yet on the live host. Then tell the friend who hit it to do the same. If Google answers *redirect_uri_mismatch*, the live redirect URI is missing from the OAuth client | Check | **Ben** | Ready | — |
| BTL-B105 | All of a user's data is one Firestore document (`users/{uid}`), capped at 1 MiB. A heavy logger reaches it in a few years (hundreds to a couple of thousand detailed sessions), after which cloud sync fails for that user. Measure a real payload size first; the fix is sessions in a subcollection, a migration | Check | Session | Ready | — |

### The current project

**Bouldering competitions (BTL-B74).** Ben, 2026-09-26: *"Yes plan this out"*, then *"Spec out a
basic version please in detail ready for build"*, then *"Do it your way :)"*. Spec:
`docs/specs/betalog_competitions_spec.md` — §11 is the build order, §12 the decisions taken.

Five steps, each its own branch and release on Ben's word. **All five are live** (2026-09-27): the
model, maths, rules and storage; the organiser's side under `/comp`; entering and the scorecard as a
session in the log; the leaderboard with amending (BTL-B85); and step 5, the final placing on the
History card (BTL-B97). The first real comp is the acceptance test. Logging as you go (BTL-B75, BTL-B76) live 2026-09-28. Next: the comp follow-ups BTL-B90 (notifications) and BTL-B95 (judges).

**Venues.** The shared registry (BTL-B110) and the manager (BTL-B60) went live on 2026-09-29, and
the same evening Ben, using them, asked for something simpler: *"No pins and shared locations
etc."* The direction is now a walls table the app ships with (`betalog_walls_spec.md`):
**BTL-B117** (the table, the picker, the removals) released the same night on Ben's word; **BTL-B118**
(more walls — TCA, Cardiff, Swansea, by hand from Ben) is open, and **BTL-B119** — the rules deploy
to drop the old collection — went out on 2026-09-30; what is left of it is deleting any stray
documents in the console. B112 and B115 closed as superseded.

**Paused for testing.** Ben, 2026-09-30: *"I think I'll have a pause and test for a few days and
get back to you"*. The phone checks (BTL-B114 first) are his; nothing is in flight on a branch.

The grade pyramid, the previous project, finished on 2026-09-13 (DEVLOG).

### BTL-B9 and BTL-B30 — Ben's logging model, and what it costs the cap

Ben, 2026-09-12: *"I will only likely log each climb I do. So for example if I do the same V4 twice
I'd log it twice. Repeating a grade / climb still counts imho. If I log it it should count. And
realistically people won't log the same V4 loads and then expect to try a V5."*

**That probably closes BTL-B9 rather than fixing it.** `attempts: 1` on all 54 climbs was filed as a
defect because 7 rows marked `sent` and 3 marked `attempt` all carried the same count. Under
one-row-per-climb that is not a contradiction: each row *is* one attempt, and the field is
degenerate rather than broken. The real question is whether `attempts` should exist at all, or
whether projecting is better read from several rows at one grade with no send among them — which the
pyramid already sees. **Decide before building anything on it.**

**BTL-B30 is the sharper one, because it contradicts a shipped decision.**
`MAX_SENDS_PER_SESSION = 2` (spec decision 1) credits at most two sends per grade per session. It
exists as the cheap stand-in for route identity — eight laps on one soft V3 is not a base — and Q4
(BTL-B11) asks whether to replace it with real route identity. Ben's position cuts underneath both:
if the athlete logged ten V4s, the cap throws away eight things they deliberately recorded, and his
argument is that the failure mode it guards against does not happen in practice.

**It is load-bearing in three places**, so this is not a one-line change: the base itself, the
readiness shortfall, and — since 2026-09-12 — the phase 3 **fill rate**, which counts credited sends
precisely so that the sends filling the base are counted like the sends that are the base. Raising or
removing the cap moves every pyramid, every readiness score and every projected date at once. Worth
measuring against the real export before changing, since the whole model has been wrong twice
already and both times a real log caught it.

### After BTL-B28 — one thing the fix cannot undo

Cardio goal readings are now normalised to km (fixed 2026-09-12). **A goal that auto-achieved on the
old reading stays achieved**: `useGoals.js:30` is `if (g.achieved) return g`, so achievement is
stamped once and never re-evaluated — which is what stops corrections un-ticking real history, and
here means a swim goal that ticked off because 1500 m read as 1500 km is still marked done. Nothing
recalculates it. Delete and recreate that goal if it matters; there is no bulk fix worth writing for
what is at most a couple of rows.

### BTL-B27 — the repo rename, if it ever comes up

Not important, filed so it stops costing a wrong turn at the start of sessions that don't know.
**Everything except the repo name already says BetaLog**: the Pages project is `betalog`, the domain
is betalog.co.uk, Firebase is `betalog-340b3`, the app is `betalog-react/`, the trigram is `BTL`.

Cheap: no GitHub Actions in this repo, GitHub redirects old clone URLs, and Cloudflare's GitHub App
tracks the repo by ID so Pages survives. Four live references to update — the root
`.claude/launch.json`, `Benjuicey-apps/docs/trigrams.md`, `BristolStorm/CLAUDE.md`, and
`docs/guides/betalog_deployment.md`; the four in `logs/` are history, leave them.

**Do all of it or none.** `Publicdisaster` is a half-finished rename — product *Not a Disaster*, repo
`notadisaster`, Pages project `publicdisaster`, folder `Publicdisaster` — which is worse than never
having started (PUB-B11). Rename the GitHub repo, `git remote set-url`, and the local folder in one
go, with sessions and editors closed so OneDrive isn't renaming under a live working directory.

---

### BTL-B41 / BTL-B42 — the climb location from where the phone is

Ben, 2026-09-17: *"in the logging part where you choose a location can we add to the background a
GPS / location based selection of places for the climbing location maybe rather than free text?"*

**Decided 2026-09-18 — a saved-venues list the app grows itself**, over OpenStreetMap or Google
Places: free, no third party, the coordinates never leave the athlete's own data, and after one
visit to each wall every session there is a tap. Built the same day (`lib/venues.js`,
`hooks/useVenues.js`, `hooks/useGeolocation.js`, `components/log/VenuePicker.jsx`). An OSM lookup
for the first visit to a new wall slots in behind the same chips if typing it ever grates; nothing
built for the list would change. Location permission is asked only from the pin, on the Log page,
and the privacy copy carries a drafted paragraph for it — Ben's to settle under BTL-B31.

Ben, 2026-09-24, with the logger open at home: *"I've been to flashpoint before but it's not
showing against the options and no obvious location functionally working. Pressing the button
does nothing."* Two causes. The list only knew venues saved since 18 September, and only a venue
saved with a fix could ever be a chip, so every wall from before that day was invisible; and the
pin's only feedback was its colour and one grey line, so a tap that found nothing near looked
like a tap that did nothing. Fixed the same day: the names now come from the whole session log
(`venuesFromSessions`, merged with the saved coordinates by `mergeVenues`), the most recent
venues are offered as chips when none is within 300 m, a same-day edit attaches the fix too, and
the line under the chips says what the pin found. Open under BTL-B58 and BTL-B59.

**Decided 2026-09-29 — a venue is a shared document, and its position never moves.** Ben: *"it
seems a bit random (maybe cos I set venues when at home to test) … either location based or a
picker … from a list of options based on entered data. No dups … lock down features to location
perhaps? Or open up location 'admins' / teams."* The random was BTL-B59 in the wild: every save
moved a venue's coordinates to the phone, and testing from home had walked both walls to his house.
Rather than a better guess (either of B59's options), the string-with-coordinates was replaced by
`venues/{id}` — a registry every signed-in user reads, a position set once by an explicit *Add …
as a shared venue here* tap, `session.venueId`, and an `admins` list that is the hook for comps at
a venue and a setters team. Per-user with fixed coordinates was rejected because it cannot be locked
to or administered; `gyms/{g}/centres/{c}` because a venue should exist before a gym claims it.
Built the same day as BTL-B110; B58 and B59 closed by it. `docs/specs/betalog_venues_spec.md`.

## Recently closed

| ID | Item | Closed |
|---|---|---|
| BTL-B123 | **Google sign-in in the installed iPhone app.** The login screen refused Google there and sent the climber to Safari, which never carried over — the installed app's storage is separate. Firebase's handler is now served from our origin (`functions/__/auth/[[path]].js`, a proxy to firebaseapp.com), the host is the `authDomain` for `PROXIED_AUTH_HOSTS` (`src/lib/googleSignIn.js`), the installed app signs in by redirect; deleting a Google account there takes a sign-in from the last 3 minutes; the service worker leaves `/__/` alone, cache v81. Ben added both redirect URIs to the OAuth client and the preview host to Firebase's authorised domains, then saw it work on an iPhone on the preview: *"It works."* **Merged to `main`** as a fix. The preview host stays in the list, harmless and registered. Live check: BTL-B124 | 2026-10-02 |
| BTL-B120 | **Comp poster as a PDF.** Manage › Join code › **Poster (PDF)** downloads an A4 page — name, type, date and start, venue, the editor's *notes for the poster*, the QR (drawn as vectors, so it prints sharp), the code and the link. Built by hand in `src/lib/compPoster.js` (no library; PDF standard fonts, a name in a script they lack prints `?`). Built 2026-10-02 on `claude/comp-poster-pdf-preview`, seen in Chromium at 390 px with Firebase faked, the PDF rendered and checked. Ben: *"Merge."* **Merged to `main`**, cache v80. Ben's check, print one from a phone | 2026-10-02 |
| BTL-B121 | **Comp links get their own preview.** A Cloudflare Pages Function, `functions/comp/[[path]].js` at the repo root, serves `/comp` and `/comp/CP-XXXXX/…` with the Open Graph tags swapped: `og-comp.png` (BetaComp card), *Join the comp · CP-XXXXX* as the title. The comp's name is not in the preview — comps are readable only when signed in. First Pages Function on the project (free plan, 100k requests/day; only `/comp` routes run it). Tested with `wrangler pages dev`; built on the same branch as BTL-B120. Ben: *"Merge."* **Merged to `main`**. Ben's check: paste a comp link into WhatsApp. If a preview is cached from before, WhatsApp keeps it — test with a code not shared before | 2026-10-02 |
| BTL-B117 | **Walls: a table the app ships with, and your own places.** `src/lib/walls.json` (id, name, city, position, `aka` spellings) replaces the shared registry: the picker suggests a wall within 300 m on any first visit, filled in when there is one; typing filters the table; anything else typed is your own place, private, kept from the log — no Add, no Place, no shared anything. Old sessions carrying a wall's spelling link on load (`migrateSessionVenue`); registry-era ids are dropped to text; `profile.venues` dropped. Location asked on open once a fix has ever succeeded on the device (`il_locationOn`). Settings › **Locations**: *wall* / *your place*, This is … / Rename / Move / Set to …. `venues/` rules block, registry storage, geohash and cache removed; 884 tests, rules 14/14. Seen in Chromium with the shape of Ben's export. Ben: *"Build it and merge please."* **Merged to `main`**, cache v79, version 1.2.0 | 2026-09-29 |
| BTL-B67 | Forgotten password — **Forgot password?** under the email Sign in sends Firebase's reset email (same answer whether or not the account exists); a wrong password now reads *Email or password is wrong…* instead of the raw `auth/invalid-credential` error. Merged after main's venue work (B110, B111, B60, B116), re-verified on the merged tree. Ben: *"Merge. But check carefully as a lot has changed since."* — his check after release: one real reset email, and whether it lands in inbox or spam | 2026-09-29 |
| BTL-B112 · B115 | Venue admins, and Redpoint's first admin by hand — superseded 2026-09-29 by the walls table (`betalog_walls_spec.md`): nothing to administer when position comes from the data | 2026-09-29 |
| BTL-B116 | *Add … as a shared venue **here*** placed a venue at the phone's fix, and the fix does not know the phone is at the wall — Ben, sat at home with the chip on screen: *"Example (I'm sat at home)"*. Add now never places; *Place … here* is always its own chip with its own warning line. Guide, privacy copy and the venues spec (decision 11) follow. Seen in Chromium. Released as a fix, cache v77 | 2026-09-29 |
| BTL-B60 | Venue manager — **Settings › Venues**: every venue in the log with its status; *This is …* links a name's sessions to a shared venue (or adds it, unplaced); Rename; Move sessions to …; Forget; *Set to …* for venue-less sessions. One save per action, climbs rewritten with the session, comp sessions never rewritten. Spec `docs/specs/betalog_venue_manager_spec.md`. Seen in Chromium on the shape of Ben's export. **Merged to `main` on Ben's word** (*"Merge ready?? Go!"*), cache v76 | 2026-09-29 |
| BTL-B111 | Venue rules deployed to `betalog-340b3` from Ben's laptop, off `claude/venue-registry` and before the merge, so the picker had its registry the moment the release landed. Compiled and released; the emulator suite was not re-run on the laptop (no Java) — its 18/18 is from the build session. The first admin of Redpoint is BTL-B115 | 2026-09-29 |
| BTL-B110 | Venues as a shared registry — a venue is a document in `venues/{id}`, its position set once at an explicit *Add … here* tap and never by a save; a session carries `venueId`; the profile caches the venues you use; old sessions with the exact name are linked on pick; the pre-registry coordinates are dropped on load. Spec `docs/specs/betalog_venues_spec.md`. Ben: *"I give you auth to do the lot please."* The phone check is BTL-B114 | 2026-09-29 |
| BTL-B59 | Home's coordinates stamped on a venue by a save from home — closed by BTL-B110, which deletes the mechanism: a venue's position is set once, at an explicit *Add … here* tap, and never by a save | 2026-09-29 |
| BTL-B58 | Venue chips on a phone, second look — superseded: the picker was rebuilt under BTL-B110; the phone check is on that row | 2026-09-29 |
| BTL-B109 | Climb sessions close only by hand, and only with a feel — no 3 h or midnight cut-off; Done / Finish need a session feel (Finish without one opens the session asking). *Open* is `endedAt === null`, so pre-B76 sessions never show. History marks an open session **OPEN** and offers **Continue logging**. Ben: *"Merge tho."* | 2026-09-28 |
| BTL-B108 | Climb logger: the picked grade's level sits in the chip row, in an always-present slot, so the outcome buttons no longer move when a grade is picked. Ben: *"Merge."* | 2026-09-28 |
| BTL-B106 | Shorter climb summary on History and the Log card — *11 climbs · Best V4 · Tried V5* (best send; hardest grade tried only when harder; attempts and projects both count) in place of a count per outcome. Ben: *"Merge."* | 2026-09-28 |
| BTL-B76 | Save as you go — the Log page's climb logger writes the session on the first climb and on every change (removing the last deletes it); *Save Session* → **Done**, which ends it (`endedAt`); **Finish** on the Log card and the Dashboard row ends it without opening it; feel null until picked. History's edit sheet unchanged. Carries the sign-in fix for unsent changes (spec §4.9). Ben: *"Merge"* | 2026-09-28 |
| BTL-B75 | *Continue today's session* — a card on Log › Climb (*Today · venue*, History's summary line, **Continue session** / **New session →**) and a row at the top of the Dashboard (*Continue · venue · n climbs ›*, within 3 h of the last change) that opens Log already continuing it, grade chips ready. Adding a climb from app open: 5 taps → 3. Comp sessions excluded. `lib/sessions.js`; spec `betalog_logging_as_you_go_spec.md` §3. Ben: *"Merge"* | 2026-09-28 |
| BTL-B13 | *Prune the schedule — Sub-Max Repeaters is 7 days/wk with 2 reminders.* Closed, not done: daily is the protocol — low-intensity background tendon work (see BTL-B103). Ben, 2026-09-28: *"Yes, close BTL-B13"* | 2026-09-28 |
| BTL-B103 | Coach read daily Sub-Max Repeaters as overload (Ben, Geoff screenshot). A hang session at feel 1–2 is now LOW-INTENSITY in the prompt, out of the rest gap, counted apart; effort averaged per type; each used hang routine's purpose and any added/assisted load go in the prompt. Feel is the signal, no new field; Shameometer untouched. **Merged to `main` on Ben's word** (*"Merge please."*), cache v69. Seen live by Ben the same day — Jonas and Geoff both read the hangs as low-intensity tendon work, neither calls them overload | 2026-09-28 |
| BTL-B101 | Bottom tabs floated a keyboard's height up the screen after the iOS keyboard closed (Ben, comp Manage screenshot). BTL-B44's fix was already on the comp tabs, so the trigger is the keyboard leaving the viewport offset. `useViewportSettle` (mounted in `App.jsx`, both tab bars) nudges the scroll a pixel and back on `focusout` / visual viewport growing. **Merged to `main` on Ben's word** (*"Merge."*), cache v68. Not reproducible off an iPhone — not yet seen fixed on one | 2026-09-27 |
| BTL-B100 | Link previews — Open Graph + Twitter-card tags on the app (`index.html`, covers every in-app link incl. comps), `help.html`, `pyramid.html`, `privacy.html`; `comps.html` gains the Twitter card. `public/og-image.png` (1200×630) is a placeholder: swap the file, same name, when the design is decided. **Merged to `main` on Ben's word** (*"Merge."*) | 2026-09-27 |
| BTL-B88 | Comp stage flow — Draft → Pending start → **Running (automatically at the start)** → **Finished — judging (automatically at the end; no longer closes)** → **Final (organiser taps Close)**. Start/end stored as `startMs`/`endMs` and enforced in the Firestore rules, so cards open and lock on the clock; date/time amendments locked in flight except extending or shortening the end while running; **Reopen scoring** on Manage in judging — button and date-time picker for a new end. A **workflow panel** at the top of Manage: the five stages as a stepper and one *Next step* card with the button that moves the comp on (Open entries / Start now / End scoring now / Close and publish results / Reopen scoring); entrants see the stepper and what happens next for them. Ben, 2026-09-27. Spec §7d. Built on `claude/serene-johnson-f8194u` and seen working in Chromium (fake Firebase): auto start, auto end into Judging, Reopen scoring with the picker, End scoring now, Close and publish; editor time locks; rules emulator 14/14. **Released to `main` on Ben's word before the rules deploy** (cache v57). Until BTL-B89 is deployed, the old rules accept an entrant's goes only once the stored status is `live`: after an automatic start, goes are kept on the phone and reach the comp when an organiser's device has moved it to Running (the card re-sends on reconnect / coming to the front); the end is locked by the app, not yet the rules | 2026-09-27 |
| BTL-B87 | Comp stages everywhere: *Mine* rows show each comp's stage (*Entries open* / *Running* / *Checking results* / *Final*), the badge on the comp pages uses the same words (*Live* → *Running*; *Checking results* = past the automatic end, not yet closed); the guide gains *How a comp runs* (`help.html#comp-flow`), a five-stage flow, linked as *How comps work* from the comps page, the editor and the scorecard; the SDLC checklist now keeps it current. Ben, 2026-09-27. **Released to `main` on Ben's word**, cache v56 | 2026-09-27 |
| BTL-B86 | Comps end automatically at their end date and time — cards stop taking goes on every phone, and an organiser's device closes the comp (grades revealed) at the end or the moment one opens after; *End scoring automatically* switch in the editor (on by default) and a changeable end time are the override. The scorecard shows the time left (*2h 14m left · Scoring ends at 17:00*, red in the last 15 minutes; *Starts in …*; *Time's up*). Ben, 2026-09-27. Seen in Chromium with a two-minute comp: countdown, cards locked at the end, the organiser's screen closed it and the V3s were revealed. **Released to `main` on Ben's word**, cache v55. Not in the rules — see spec §7b | 2026-09-27 |
| BTL-B83 | Comp editor grade visibility says its state in words — a switch at the top of the scoresheet reading *Grades NOT visible to entrants* / *3 of 10 grades visible to entrants* / *Grades visible to entrants*, an eye legend (*entrants see the grade* · *hidden until the close*), and **grades hidden by default** (Ben, 2026-09-27). Seen in Chromium at 375 px in all three states. **Released to `main` on Ben's word**, cache v54 | 2026-09-27 |
| BTL-B84 · B79 | Comps: a new comp starts with **10 problems** (was an empty sheet and a generator set to 30), and **Copy to a new comp** on Manage starts a draft in an old comp's format — type, times, venue, notes, scoring, categories, scoresheet with grades blank for the new set — dated today. Ben, 2026-09-27. Also **BTL-B79 — every problem must be graded** (*"I want all climbs to be graded!!!"*): `validateComp` refuses an ungraded sheet and names the problems, the empty grade cells go red, so every problem tried is an ordinary climb in the log. Seen working in Chromium. **Released to `main` on Ben's word**, cache v53 | 2026-09-27 |
| BTL-B82 | Entrants other than the organiser got *Missing or insufficient permissions* on *Enter*: joining first reads your own entry to catch a second device, and the rules refuse that read until you have entered. `Storage.getEntry` now reads the refusal as *not entered*. Unit tests and a rules-emulator test (13/13) pin it; no rules change, no deploy. Released to `main` as a live bug fix, cache v52 | 2026-09-27 |
| BTL-B81 | Comp editor: date and time fields ran out of the card on iOS (Safari's intrinsic width on date/time inputs) — now `appearance-none` and `min-w-0`. Comp **type** *Boulder / Rope* added: rope comps use the same card, French grades, logged as top rope; the grade is a picker on the type's scale, not free text, and a type change clears grades. Ben, 2026-09-27. **Released to `main` on Ben's word**, cache v51 | 2026-09-27 |
| BTL-B78 | Log switcher reordered *Climb · Hang · Train · Cardio · Health*, and the page opens on Climb — a climbing app leads with climbing. Ben, 2026-09-27. Guide and health spec updated to match. **Released to `main` on Ben's word**, cache v50 | 2026-09-27 |
| BTL-B99 | Everyone's cards open once a comp is final — on the final board anyone entered can tap a climber and see their card read-only, with each problem's grade and result and any amendment with its note; never before the close (organisers always). Ben, 2026-09-27, from his first test comp: *"Only allow viewing others data at the end (including judge notes etc)"*. No rules change (entrants could already read entries). Privacy notice (reviewed date bumped), Help's *What other people see* and `/comps.html` *Who sees what* updated. **Merged to `main` on Ben's word** (cache v67); seen in Chromium as a plain entrant — running: rows not tappable; final: Amy's card opens with *Amended: Top not held*, no Amend buttons | 2026-09-27 |
| BTL-B98 | From Ben's first real test comp: amending sat on *Saving…* though the change had landed — it read the entry again before writing and waited for the server's confirmation. Now it writes from the entry the board already holds and closes at once (Firestore shows the write locally); a refusal reopens the problem with the error. And the organiser's card sheet shows each problem's grade beside its colour (hidden ones stay hidden until the close). Seen in Chromium. Merged as a fix, cache v66 | 2026-09-27 |
| BTL-B97 | Comps step 5 — the final placing. `placingFor` ranks the climber in their category and overall from every entry (ties shared, one board when there is one category); `placingText` says it (*2nd of 5 in Female · 7th of 20 overall*); kept on `session.comp.placing`. History runs a catch-up (`catchUpClosed`: each unplaced comp session from the last 60 days reads its comp once per visit, and a closed one reads the entries, applies the last amendments and sets the placing); the scorecard settles it too. Shown on the History card (*Final: …* first), the session sheet and the closed scorecard; no Dashboard placing (BTL-B92). `Storage.getEntries`; tests. Seen in Chromium: the demo comp closed → *Final: 2nd of 3 in Male · 4th of 6 overall* on History, the sheet and the card. Help, `/comps.html` and the spec updated. Ben, 2026-09-27: *"do the final placing thing on the history card"*. **Merged to `main` on Ben's word**, cache v65 | 2026-09-27 |
| BTL-B96 | The phone's own pop-ups replaced with the app's `ConfirmDialog` (Ben, from a screenshot, 2026-09-27): *Copy to a new comp* over a draft (Manage), changing a comp's type with grades set (editor), and Settings › Import JSON (the replace warning, the not-an-export and failed notices, the done notice). `ConfirmDialog` gains a one-button `notice` mode and sits above the sheets (z-100). None left in `src`. Seen in Chromium. Merged as a fix, cache v64 | 2026-09-27 |
| BTL-B85 | Organisers **amend** a card, not just void it — *Amend* on each problem in the board's card sheet opens it with the climber's controls (− / + / Zone / Top) and *Clear (void)*; a note is required; allowed until the comp is final. Each record in `voids[]` now carries `after` and `kind`; the climber's phone applies the record's `after` rather than the mirror's card, and pushes the card back, so a stale push cannot undo an amendment. No rules change (organisers could already write entries). `applyAmend`, `sameResult`, `amendKind`, `Storage.amendProblem`; tests. Seen in Chromium: Zone · go 1 → Top · go 2 with a note, the climber's card 72.5 → 83.5 with *Amended by the organiser*. Help and `/comps.html` updated; the emoji tile icons on `/comps.html` removed (Ben). The judge role is BTL-B95. Ben, 2026-09-27: *"build the judge fix… then just move directly to prod"*. Merged, cache v63 | 2026-09-27 |
| BTL-B94 | Comp card: after a top, + / − move the top to a later / earlier go (and a zone that came with it) instead of adding goes after it — a flash then + stayed *Flash* at full points with an extra go counted (Ben, testing, 2026-09-27). A top on go 1 stepped to no goes clears the problem; zone-only problems unchanged. `applyCardAction` in `lib/competition.js`, tests replaced and added; seen on the card in Chromium (Flash +10 → Top · go 2 +8, total 72.5 → 70.5). Help and `/comps.html` say so. Merged to `main` as a fix, cache v62 | 2026-09-27 |
| BTL-B93 | Comps explainer — `/comps.html`, a public page Ben can send to a climbing centre: the pitch for centres (what it does, what they need, honest limits), the five stages as a rail with what's automatic vs a tap and what organiser and climbers each do, a comp-night timeline, organising (four steps, hidden grades, a checklist for the night), climbing in one, scoring with a worked example and tiebreaks, the board and judging, who sees what, FAQ; six phone screenshots in `public/comps/` of a made-up comp (fake Firebase, made-up names); link-preview tags. Help: stale Dashboard rows (Training load, Gym stats) removed, the *Coming up* box described, the comp-card line fixed, a link to the explainer. Ben, 2026-09-27. **Merged to `main` on Ben's word** (cache v61); checked at 390 px and 1200 px, no sideways scroll. | 2026-09-27 |
| BTL-B92 | One *Coming up* strip on the Dashboard — comps fold into the *Due today* routine strip (BTL-B91's separate comp strip removed): a comp shows only while it starts within 24 hours or is running, and drops off at its end time or when the card is final — nothing past. Comp list rows now carry `startMs` / `endMs` (`refFor`), refreshed when the comp's details are opened; a row saved before that is read by its day. `dashComps` in `lib/compUi.js`, tested. Ben, 2026-09-27. **Merged to `main` on Ben's word** (cache v60); seen in Chromium (fake Firebase) at 375 px — running + in-10-hours shown, 30-hours-off and ended hidden, the next routine under them | 2026-09-27 |
| BTL-B91 | Dashboard declutter — **Training load** and **Gym stats** widgets removed (components, picker chips, collapse/window defaults); the **comp widget** replaced by a strip beside *Due today* (`CompNotice`), shown only while a comp is scheduled (today or later) or still happening (card not final, dated within the last week) — nothing about comps otherwise. Which comps: `dashComps` in `lib/compUi.js`, tested. Ben, 2026-09-27. **Merged to `main` on Ben's word** (cache v59); seen in Chromium (fake Firebase) at desktop and phone width — today + upcoming shown, old and final hidden, no strip with no comps; build, 840 tests, lint (no errors) | 2026-09-27 |
| BTL-B89 | Stage-flow rules (BTL-B88) deployed to `betalog-340b3` — `firebase deploy --only firestore:rules` from `main` at `cf8d1a3`, compiled and released. Cards now open and lock on the comp's start/end without an organiser's device | 2026-09-27 |
| BTL-B77 | Competitions rules deployed to `betalog-340b3` — Ben, 2026-09-27: *"step 1 should be done now"* | 2026-09-27 |
| BTL-B26 | `/privacy.html` — the spec's copy as a page in the explainer's style, linked from Settings › Account, the guide's *Your data* chapter and the sign-in screen. Effective 2026-09-26 | 2026-09-26 |
| BTL-B71 | Feedback worker storage listed in §2.6 — read from `Benjuicey-apps/worker/src` on this laptop: app ID, type, name, optional email, message, timestamp, ref, status notes; Resend emails; nothing auto-deletes | 2026-09-26 |
| BTL-B72 | Friend-code delete rule deployed to `betalog-340b3` — `firebase deploy --only firestore:rules`, released 2026-09-26 | 2026-09-26 |
| BTL-B63 · B64 · B65 · B66 | Four live bugs. **B63** the calendar reminders card pointed to *Plan → Routines → Schedule*; now *Plan → Schedule*. **B64** a reminder tap opens its routine: a cold start reads `/log?routine=`, and an app already open is sent the link by the service worker as a message, since `client.navigate()` fails on iOS. **B65** the Cardio stats widget reads cardio goals through the same km reading as Plan › Goals — a 6-mile run against 10 km now reads 9.7 km · 97% in both, not 6 km · 60% on the dashboard. **B66** the first tap on a goal's X turns it into a red *Tap again to delete* for 3 s. Verified in Chromium at 390 px against the real app with Firebase stubbed, build, 752 tests, lint; released, cache v46 | 2026-09-26 |
| BTL-B32 · B69 | Delete account — Settings › Account › *Delete account…*: what goes (with export), a tick, then DELETE and a fresh sign-in before anything is touched; unlinks friends, deletes profile, friend code, main document, reminders, the auth user and the device copy. The guide's *Your data* chapter describes it, replacing the delete-by-hand promise. Verified by build, 752 tests, lint and the three steps in Chromium at 390 px; a real deletion is BTL-B73. **Released to `main` on Ben's word**, cache v45 | 2026-09-26 |
| BTL-B31 | Privacy copy reconciled with the app — share links dropped (Ben's call), deletion and export described as they now are, friends' view listed field by field, and three more errors found and fixed: no-account use, feedback storage, reminders and admin access left out. Two facts left for Ben under BTL-B71 | 2026-09-26 |
| BTL-B70 | History climb summary read a lone attempt as a send — *10 climbs · Top: V4 · 9 Flash · 1 Att* beside a V3 level pill, because *Top* was the hardest grade touched, sends and attempts together. Now each outcome carries its own hardest grade — *10 climbs · 9 Flash to V3 · 1 Att at V4* — and *Top* is gone, the pill already being the hardest send. Reported by Ben from today's session; verified in Chromium at 390 px, build, 744 tests, lint; **released to `main` on Ben's word**, cache v44 | 2026-09-24 |
| BTL-B61 · B62 | Help & feedback — a HELP chip in the header (blue labelled, Ben's pick of four) opening a sheet with *How BetaLog works* and *Send feedback*; the guide at `/help.html`, fourteen chapters written from three code sweeps, cross-linked with the explainer, feedback button on the page; a pre-merge checklist line so a visible UI change updates it in the same commit. Verified in Chromium at 320/390/1280 px, build, 744 tests, lint. **Released to `main` on Ben's word**, v1.1.0, cache v43 | 2026-09-24 |
| — | Venue chips never offered a wall from before 18 September — the list grew only from saves since then, and a venue with no fix could never be a chip. Now every location in the session log is a venue; the most recent five are chips when nothing is within 300 m; a same-day edit attaches the fix; the pin's line says *Located — none of your venues is within 300 m* rather than looking dead. Reported by Ben; released the same day at his word | 2026-09-24 |
| BTL-B45 | Friends screen on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B46 | Venue chips on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B51 | Own goal pyramid on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B47 | Level colours on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B55 | Complete! card on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B56 | Pyramid counts on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B54 | Automatic release pickup on a phone — seen by Ben, 2026-09-24: *"I've seen them all"* | 2026-09-24 |
| BTL-B57 | Own forecast on a phone — closed unchecked at Ben's call, 2026-09-24: *"I'm sure it's fine."* Verified in tests against his 18 September numbers only | 2026-09-24 |
| BTL-B49 | *"Explore both using maths … would the rate of improvement follow a pattern?"* Researched and simulated (write-up: <https://claude.ai/artifact/T4YjhVE1T4Evz4zxyWc1Ak>). The base rate standing in for the target was four to eight times too fast, so the measured rate looked like a leap when it was nearer the truth. An *Own* goal's target rate is now a blend: the base rate × the log's own row-to-row ratio (default ½), worth two sends, plus the real sends since the first. On Ben's numbers: no 6c send mid-January, one late December, two late November. Explainer step 3 and the steps line rewritten; `firstSend` per grade on the pyramid | 2026-09-24 |
| BTL-B56 | *"Always show x/8 for owned irrespective of the goal."* Every pyramid's count column is now that grade's sends out of eight — Send goals, no goal and friends' pyramids too, not just *Own* goals — so the blocks say the pyramid and the count says how far each grade is from owned. Green only when owned | 2026-09-23 |
| — | Settings sheet could not be closed on a phone — the panel had no height cap, so once the AI Coach key, Beep timing, build line and Admin panel rows made it taller than the screen it overflowed off the top, taking the X with it; the page underneath scrolled, the sheet did not. Capped at 85vh and scrolls inside itself, as the friends sheet already did | 2026-09-19 |
| — | An achieved goal keeps its slot on Plan › Goals as a *Complete!* card with *Set your next goal*, one rung up; the Achieved list is gone; History's green row is the record and the only delete | 2026-09-18 |
| — | A release runs on its first launch, not its second: the page reloads once when a new service worker takes over, and an app returning to the foreground checks for one. A friend's republished profile no longer waits on a second launch | 2026-09-18 |
| BTL-B41 | Climb venue from where the phone is — the logger's location field offers saved venues within 300 m as chips, prefills the one in range, and remembers where each session was saved | 2026-09-18 |
| BTL-B42 | Where venues come from — a saved list the app grows itself; OSM or Places can sit behind it later | 2026-09-18 |
| — | Friends see the pyramid, and two boards: **Level** (Base then Best, 180 days) and **Last 30 days** (hardest send then sends — the one that moves after every session). Every number on the friends screen names its window; each row says when they last climbed. The profile carries the readiness tiers for the next rung up, per-grade counts, the 30-day counts, the last climb date and an all-time best. The All Time / Last 90 Days toggle is gone — *All Time* showed the 180-day overlay and *Last 90 Days* the retired consistent grade. Live while open; republished once after update | 2026-09-18 |
| BTL-B53 | *"The wording base complete is confusing."* One word meant two things on one card: **Base 6a+** in the header is the grade you own, *Base complete* under it was the rows beneath the target. *Base* now means the owned grade only. Labels: *Pyramid complete · Ready for 6c · Nearly ready · Pyramid forming · Pyramid thin · No pyramid yet*; *Pyramid for 6c* eyebrow; *fill the pyramid*; picker legend *Ready · Pyramid part-built* with the ring dropped. The label describes the picture for either kind. Cut: *1 send at 6c already* and *Nothing logged at 6c yet* (the row says it); tries without a send stay | 2026-09-18 |
| BTL-B52 | Ben on BTL-B50 as shipped: *"I don't like it … the pyramid should stay the pyramid."* The eight-wide target row is gone; an *Own* goal keeps the 1·2·4·8 pyramid and the count beside each row is that grade's sends out of eight — *owned*, 5/8, 2/8, 1/8 — so owning reads as climbing the rows. Send goals unchanged | 2026-09-18 |
| BTL-B50 | An *Own* goal's pyramid drew the send pyramid — 6c 1/1 in green above "7 more 6c sends". The target row is now drawn against eight (1/8) on the card, the sheet and the Dashboard, labelled *Base complete* until full; a row with eight sends at its own grade reads **owned** in a deeper blue on every pyramid, friends' included | 2026-09-18 |
| BTL-B48 | Ben's first 6c pushed *Own 6c* from mid-December to October **2027** and one dot — one send over the 58 days since his first climb read as the 6c rate. The target row's rate now needs two sends; before that the base rate stands in, as it did at none. The forecast names the year when it is not this year, and says *now* rather than *around mid-September* when nothing is left | 2026-09-18 |
| BTL-B44 | Bottom tabs drifted up the page on iOS — a `position:fixed` bar with `backdrop-filter` is painted at a stale scroll position after the document height changes under it (widget collapse, sheet close, keyboard). Blur dropped, solid white, own compositing layer | 2026-09-18 |
| BTL-B43 | Hangboard grip diagram redrawn — the back of the hand for which fingers (unused ones fold to the knuckle), the hand from the thumb side for the grip, drawn to Ben's photos; 300×140 above the countdown | 2026-09-17 |
| — | Hangboard beeps land on the number — each cue is booked on the audio clock ahead of its second, led by the reported latency plus Settings › Beep timing (Bluetooth preset 180 ms) | 2026-09-17 |
| — | Hangboard timer keeps the screen awake — Screen Wake Lock while a set runs, re-taken when the app comes back to the front, released on done or close | 2026-09-17 |
| BTL-B40 | Analysis came back empty at v28 — gpt-oss spent the 1,400 budget reasoning. `reasoning_effort: 'low'` on every call, and an empty answer is asked for once more at 2,800 | 2026-09-13 |
| BTL-B39 | Coach page rate limits: waits out Groq's stated retry and sends again, counts down on the button, quotes Groq's own numbers, keeps one analysis per persona; Settings key test no longer names the retired llama model | 2026-09-13 |
| BTL-B38 | Both pyramids in the one blue, grade labels in their level colour, bar charts left orange | 2026-09-13 (branch) |
| BTL-B36 | Editing a climb session uses the logging form — discipline buttons, grade chips, the four outcome buttons — not a separate three-dropdown sheet | 2026-09-13 (branch) |
| BTL-B35 | Achieved goals can be removed from History, and the Achieved card's delete shows its confirm step | 2026-09-13 (branch) |
| BTL-B19 | The explainer — `betalog.co.uk/pyramid.html`: grades, levels, Base/Best/Flash, the pyramid, goals, the dots, the forecast, sources. Linked from the climbing widget and the goal card | 2026-09-13 (branch) |
| — | Level badge on the climbing widget, from the base; goal picker grouped by level band | 2026-09-13 (branch) |
| BTL-B33 | An *Own* goal's forecast projects the target row too — "Own 6c around June", "then 7 more 6c sends at your 6c rate" | 2026-09-13 (branch) |
| — | The dots read the deadline margin alone — a year in hand reads 5/5 on a forming base, not 3/5 | 2026-09-13 (branch) |
| — | One active goal per type — the sheet crosses out a type that already has one | 2026-09-13 (branch) |
| BTL-B34 | One vocabulary — *Base / Best / Flash*, goals are *Send X* / *Own X*; *Consistent* and *Project* (as a reading) retired from every screen | 2026-09-13 (branch) |
| BTL-B8 | Q3 answered — friends see Base, level word from the base | 2026-09-13 |
| BTL-B7 | Public profile publishes `base` via `buildPublicProfileWithBase`; older keys kept for older builds | 2026-09-13 (branch) |
| — | Send goals count any send in the pyramid window, and `achievedBy` records the send / base / value that did it | 2026-09-13 (branch) |
| — | The goal sheet refuses a send goal the log has already met, and says why; *become* stays open on a single send | 2026-09-13 (branch) |
| — | A sent target charges no grade-change time — Ben's 6a read 2/5 on a complete base | 2026-09-13 (branch) |
| — | Achieved goals appear in History on the day of the evidence | 2026-09-13 (branch) |
| — | Dashboard climbing cards draw the pyramid for the next rung up when no goal is set | 2026-09-13 (branch) |
| — | Readiness label takes the dots' colour; the Dashboard's last 90-day send count reads the pyramid window; auto-achieve re-runs when goals change | 2026-09-13 (branch) |
| — | Goal sheet dots match the goal card and Dashboard — one `readGradeGoal` call for all three | 2026-09-13 |
| BTL-B6 | Q2 answered — grade goals are *send* (default) or *become*, and tick off by kind | 2026-09-13 |
| BTL-B18 | Two windows — gone: auto-achieve's 90-day reading was deleted with B6 | 2026-09-13 |
| — | Fill rate measured from the first climb in the window, not the whole 180 days | 2026-09-13 |
| — | Forecast says "Ready for 6c around …" and splits the date into base + grade change | 2026-09-13 |
| BTL-B30 | Per-session send cap removed — every logged send counts | 2026-09-13 |
| — | Dashboard climbing card shows the projected date and deadline margin | 2026-09-13 |
| BTL-B4 | Grade goals drop the % bar — the pyramid is the progress display | 2026-09-13 |
| BTL-B25 | Docs drift swept, and folded into the merge checklist | 2026-09-13 |
| BTL-B24 | Climbs CSV export, one row per climb | 2026-09-13 |
| BTL-B14 | Build, cache and version shown in Settings | 2026-09-13 |
| BTL-B10 | Gym sessions score by exercise count, not a flat 2 | 2026-09-13 |
| BTL-B5 | Phase 3 — projected ready date and deadline margin | 2026-09-12 |
| BTL-B3 | Cardio calories — duration optional, distance-based model added | 2026-09-12 |
| BTL-B28 | Cardio goals normalise miles/lengths/metres to km | 2026-09-12 |
| BTL-B2 | New goal card checked signed in — reads correctly | 2026-09-12 |
| BTL-B1 | Push Worker deploy — confirmed it went out; reminders were never dead | 2026-09-12 |
| BTL-B0 | Reconcile "Currently" — it is the base grade now (spec Q1) | 2026-09-12 |
| — | Grade pyramid phases 1 and 2 | 2026-09-12 |
| — | Weekly Shameometer dial + sealed week log | 2026-09-10 |
| — | `friendCodes` rule narrowed to `allow get` and deployed | 2026-09-04 |
| — | Route B web push — live and verified on a real iPhone | 2026-09-04 |
| — | Several reminder times per routine, Worker included | 2026-09-04 |
| — | Dashboard widget system, phases A–F | 2026-08-21 |
| — | IA declutter, all four phases | 2026-08-20 |
