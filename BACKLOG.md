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
| BTL-B3 | Cardio calories understated by ~half (`CardioLogSheet.jsx:78` opens at 30 min) | Bug | Session | Blocked | BTL-B4-style steer — fix changes a working screen |
| BTL-B4 | 0% progress bar when a log has no base grade | Decision | **Ben** | Ready | — |
| BTL-B5 | Phase 3 — likelihood (projected ready date + margin) | Feature | Session | Ready | — |
| BTL-B6 | Q2 — "send a 7a" vs "become a 7a climber" goal kinds | Decision | **Ben** | Ready | — |
| BTL-B7 | Public profile publishes `base` (spec Q3) | Feature | Session | Blocked | BTL-B8 |
| BTL-B8 | Q3 — should friends see Base instead of the consistent grade? | Decision | **Ben** | Ready | — |
| BTL-B9 | `attempts` never increments — all 54 climbs carry `attempts: 1` | Bug | Session | Ready | — |
| BTL-B10 | A `gym` session scores 2 whatever it contains — distorts Shameometer history | Bug | Session | Ready | — |
| BTL-B11 | Q4 — route identity per climb (true dedupe + variety check) | Decision | **Ben** | Ready | — |
| BTL-B12 | Re-date the two stale goals — 7a and V5 are both unreachable | Chore | **Ben** | Ready | — |
| BTL-B13 | Prune the schedule — Sub-Max Repeaters is 7 days/wk with 2 reminders | Chore | **Ben** | Ready | — |
| BTL-B14 | Show app version + `CF_PAGES_COMMIT_SHA` + `CACHE_NAME` in Settings | Feature | Session | Ready | — |
| BTL-B15 | Feedback widget round-trip — never actually submitted to Firestore | Check | **Ben** | Ready | — |
| BTL-B16 | Branch cleanup — 29 of 36 remote branches are merged | Chore | **Ben** | Ready | — |
| BTL-B17 | `step9-wip` — keep or drop? 158 commits behind `main` | Decision | **Ben** | Ready | — |
| BTL-B18 | Two windows: `GRADE_WINDOW_DAYS` 180 vs `ACHIEVE_WINDOW_DAYS` 90 | Chore | Session | Blocked | BTL-B6 |
| BTL-B19 | User-facing pyramid explainer | Feature | Session | Blocked | `betalog.co.uk/help` existing |
| BTL-B20 | Dashboard widget consistency — 6 phases, spec written, not started | Feature | Session | Blocked | 3 decisions in the spec |
| BTL-B21 | AI coach output review — diet review + mini plan | Feature | Session | Blocked | scope decision |
| BTL-B22 | Admin page | Feature | Session | Blocked | spec TBD |
| BTL-B23 | Calorie balance view — cardio burn vs drink intake | Feature | Session | Blocked | scope decision |
| BTL-B24 | Climbing-specific CSV export | Feature | Session | Ready | — |
| BTL-B25 | Docs drift sweep whenever a feature ships | Chore | Session | Ready | — |
| BTL-B26 | `/privacy` route does not exist — spec and copy written, page not built | Feature | Session | Ready | — |
| BTL-B27 | Rename the repo `HomeTrainingMcTrainingface` → `betalog` (low priority) | Chore | **Ben** | Ready | — |
| BTL-B28 | **Cardio goals ignore `cardioUnit`** — miles and lengths read as km | Bug | Session | Ready | — |
| BTL-B29 | Cardio goals read an all-time PB — the career-high pattern grades just dropped | Decision | **Ben** | Ready | — |

### The current project

**Finish the grade pyramid.** Ben, 2026-09-12: *"this is the next thing I want to build completely."*
Build order and full reasoning in `docs/specs/betalog_grade_pyramid_spec.md` §9a and §9b.

Step 1 (reconcile *Currently*) shipped 2026-09-12. The rest is **BTL-B5** (unblocked — the next thing
to build), then **BTL-B6** → phase 4, then **BTL-B8** → **BTL-B7**, then **BTL-B19**.

### BTL-B28 — cardio goals are reading the wrong unit, live

`getCurrentValueDetail` compares raw `cardioQuantity` across sessions and labels the result `km`.
It never reads `cardioUnit`, though `deriveSessionMetres` in `stats.js` exists to normalise exactly
that. The logger's defaults are **`run`/`cycle` → miles, `swim` → lengths**, so the default path is
the broken one. Measured 2026-09-12:

```
6-mile run, goal 10 km        -> "Currently 6 km",    60%  (really 9.66 km, ~97%)
40 lengths + 1500 m, goal 1 km -> "Currently 1500 km", 100% -> auto-achieves
```

Two failures, opposite directions: distance goals **understate** (miles counted as km) and swim goals
**overstate** catastrophically (a length or a metre counted as a kilometre), then auto-achieve. The
"best" comparison is across mixed units too, so the max is whichever raw number is largest — `1500`
always beats `5`.

Fix is to normalise through `deriveSessionMetres` and compare metres. **Note it will change numbers
on screen** for anyone with an existing cardio goal, downward for swims. Achieved goals are sticky
(`useGoals.js:30`), so nothing already ticked off un-ticks.

**Distinct from BTL-B3**, which is about `cardioDurationMins` defaulting to 30 and corrupting
*calories*. This is `cardioQuantity` and *distance*. Same screen, different field, independent.

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

### Note on the most urgent

**BTL-B4** — `calcGoalProgress` reads `null` as zero, and a grade goal's current value is now the
base grade, absent on any log without 8 credited sends at one grade in 180 days. If it reads too
blunt, let the *bar* fall back to readiness `pct` while the *number* stays absent.

---

## Recently closed

| ID | Item | Closed |
|---|---|---|
| BTL-B2 | New goal card checked signed in — reads correctly | 2026-09-12 |
| BTL-B1 | Push Worker deploy — confirmed it went out; reminders were never dead | 2026-09-12 |
| BTL-B0 | Reconcile "Currently" — it is the base grade now (spec Q1) | 2026-09-12 |
| — | Grade pyramid phases 1 and 2 | 2026-09-12 |
| — | Weekly Shameometer dial + sealed week log | 2026-09-10 |
| — | `friendCodes` rule narrowed to `allow get` and deployed | 2026-09-04 |
| — | Route B web push — live and verified on a real iPhone | 2026-09-04 |
| — | Several reminder times per routine, Worker included | 2026-09-04 |
| — | IA declutter, all four phases | 2026-08-20 |
| — | Dashboard widget system, phases A–F | 2026-08-21 |
