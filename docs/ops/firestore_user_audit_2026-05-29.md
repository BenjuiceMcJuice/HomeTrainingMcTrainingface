# Firestore User Audit — 2026-05-29

Project: `betalog-340b3` (Spark plan, europe-west2)

---

## Summary

| Metric | Count |
|---|---|
| Total user documents | 19 |
| Ghost accounts (signed in, no data) | 10 |
| Accounts with sessions | 9 |
| Real external users (non-Steve) | 2–3 |
| Active in last 30 days | 3 (Steve, Dave, Another tester) |

---

## User breakdown

| Name | Sessions | Last active | Types | Weight entries | Goals | Notes |
|---|---|---|---|---|---|---|
| **Benjuice** (gWT9Fv74n…) | 40 | 2026-05-28 | gym×33, climb×4, hang×2, cardio×1 | 14 | 3 | **Steve's main account** |
| Dave of Knowle West (DRBBuRXF…) | 2 | 2026-05-20 | climb×2 | 0 | 0 | Real user, recent |
| Another tester (lLkEwHWF…) | 3 | 2026-05-19 | climb×3 | 1 | 0 | Possibly real user or friend tester |
| Dave of Knowle West (bBKcSLJZ…) | 1 | 2026-04-12 | climb×1 | 0 | 0 | Dave's second account — likely duplicate login |
| bentest (B8tWPfqI…) | 7 | 2026-03-28 | climb×4, hang×2, gym×1 | 2 | 0 | Steve's test account |
| Tester mc tester (Xggr8toX…) | 4 | 2026-03-28 | climb×3, gym×1 | 1 | 0 | Steve's test account |
| Benjuice (btcJmyzk…) | 15 | 2026-03-27 | climb×10, gym×4, hang×1 | 2 | 0 | Steve's old account (pre-current) |
| (no name) (q5bHKM2G…) | 1 | 2026-03-28 | climb×1 | 0 | 0 | Single session, test era |
| Ben Gmail (vfipIiWI…) | 2 | 2026-03-07 | climb×2 | 1 | 0 | Steve's Gmail test account |
| *(10 ghost accounts)* | 0 | — | — | 0 | 0 | Signed in but never set up |

---

## Observations

### Real usage
- **Only one real external user confirmed active:** Dave of Knowle West, 2 climb sessions, last logged 2026-05-20
- **"Another tester"** had 3 climb sessions up to 2026-05-19 — could be a friend testing, worth asking who this is
- Dave has **two accounts** — likely signed in once via Google and once via email/password. Both have minimal data, no duplication problem yet but worth watching

### Feature adoption (all users, excl. Steve)
- Every external session logged is **climb only** — nobody has tried gym, hangboard, or cardio logging yet
- **Zero goals set** by any external user
- **Minimal weight entries** — only 1–2 ghost entries on test accounts; Dave has none
- AI coach untested by anyone other than Steve (requires Groq key setup)

### Steve's main account (gWT9Fv74n…)
- 40 sessions, the only account using gym sessions at scale (33/40)
- 14 weight log entries — consistently tracking
- 3 goals set and in use
- Last session 2026-05-28 — active

### Ghost accounts (10)
- Signed in (have Firebase Auth entry + Firestore doc) but never entered a name or logged a session
- Likely: people who saw the app, created an account, bounced without onboarding
- No action needed now but onboarding friction is worth investigating

---

## Spark plan usage check

Spark limits: 1 GiB stored, 50k reads/day, 20k writes/day, 1 GiB/month transfer.

With 19 users and ~80 total sessions across all accounts, storage and read/write usage is **well within free limits**. No concern at current scale.

---

## Actions / follow-ups

- [ ] Ask around — who is "Another tester" (lLkEwHWF…)?
- [ ] Dave has two accounts — not a problem now but flag if he reports data missing
- [ ] Onboarding drop-off: 10/19 users (53%) bounced after sign-in with no data. Consider a lightweight onboarding prompt (set your name, log your first session)
- [ ] Nobody outside Steve has tried gym, hangboard, goals, or AI coach — these are undiscovered features for real users
