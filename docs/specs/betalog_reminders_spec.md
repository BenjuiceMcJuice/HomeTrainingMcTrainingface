# BetaLog — Schedule Reminders Spec

**Date:** 11 August 2026 · updated 3 September 2026
**Status:** Step 1, Route A and Route B all built. Route B is **not deployed** — see "Deploying Route B".
**Scope:** Reminding the user to do the routines they've already scheduled

---

## Goal

The app already knows what you intend to do and on which days (`useSchedule`, up to 3 entries). It
has no way of telling you. This spec covers getting a reminder onto a phone.

Two routes, deliberately staged: **a calendar feed first, web push second.** The first is a fraction
of the work and answers a question the second can't — whether a nudge actually changes behaviour.

---

## Correction to an earlier assumption

An earlier read of `index.html` flagged that `apple-touch-icon` points at an SVG and that iOS would
therefore show a blank Home Screen icon. **That was wrong** — Ben's Home Screen shows the BL icon
correctly. Modern iOS resolves the icon (via the manifest entry, the SVG `apple-touch-icon`, or
both). **No icon work is needed and it is not a blocker for anything below.**

A 180×180 PNG remains a cheap belt-and-braces for older iOS versions, but it is optional, not a
prerequisite.

---

## What exists today

| Piece | State |
|---|---|
| PWA manifest + `sw.js` | ✅ Present, SW registered in `main.jsx` |
| Home Screen install | ✅ Works, icon renders |
| Firebase Auth + Firestore | ✅ Per-user storage available |
| Cloudflare Worker | ✅ Pattern established (`benjuicey-feedback` Worker) |
| Schedule model | ✅ `{id, routineId, routineName, days[1–7], remindAt?, tz?}` — time of day added 19 Aug |
| Any notification code | ❌ None — nothing yet *sends* a reminder |

---

## Prerequisite for either route: time of day ✅ **built 19 August 2026**

`ScheduleEntry` carried days only. A reminder needs to know *when*.

**Decided:** one reminder per schedule entry, each with its own time — **not** a daily digest. A
morning and an evening reminder are simply two entries. This is the shape both routes now build on:
Route A emits one `VEVENT` per timed entry, Route B sends one push per timed entry.

```js
/**
 * @typedef {Object} ScheduleEntry
 * @property {string} id
 * @property {string} routineId
 * @property {string} routineName
 * @property {number[]} days        - 1=Monday … 7=Sunday
 * @property {string} [remindAt]    - "HH:MM" local, 24h. Absent = no reminder.
 * @property {string} [tz]          - IANA zone, e.g. "Europe/London"
 */
```

Both fields optional, so existing schedules keep working untouched. `tz` is captured once from
`Intl.DateTimeFormat().resolvedOptions().timeZone` — without it, a Worker running in UTC cannot know
whether 18:00 has arrived, and the app would be an hour out for half the year.

**UI:** a time picker per entry on `ScheduleCard`, with a **Clear** control. An empty time *is* the
off state, so no separate switch is needed — reminders are off until a time is set.

**Two limits worth knowing, both pre-existing and neither blocking:** the schedule is capped at 3
entries, and `ScheduleCard` won't let the same routine be scheduled twice. So "the same routine,
morning and evening" isn't expressible today — two *different* routines at two times is. Lifting
either is a small change to `ScheduleCard`/`useSchedule` if it turns out to matter.

**As built:**

- `remindAt` + `tz` on the `ScheduleEntry` typedef (`src/lib/types.js`), both optional.
- `src/lib/reminders.js` — pure helpers, no React imports, reusable by the Worker later:
  `isValidRemindAt`, `localTimeZone`, `withReminder`, `sortByRemindAt`. Unit tested in
  `src/lib/__tests__/reminders.test.js`.
- `useSchedule().setReminder(id, remindAt)` sets or clears one entry's time, capturing `tz` from the
  device on set. Clearing **deletes both keys** rather than nulling them, so "no reminder" is the
  absence this spec describes — which is what the `.ics` builder will test for.
- `ScheduleCard` shows a bell + `<input type="time">` per entry, and an optional time on the add form.
- `ScheduleNotice` (Dashboard) now shows the time against each routine and orders due-today entries
  by it, untimed last — so the morning session reads before the evening one.

---

## Route A — Calendar feed ✅ **built 19 August 2026**

### As built

| Piece | Where |
|---|---|
| `.ics` renderer | `betalog-react/src/lib/ics.js` — pure, 22 unit tests |
| Feed client (token, URLs, upload, revoke) | `betalog-react/src/lib/calendarFeed.js` |
| Enable / disable / mirror | `betalog-react/src/hooks/useCalendarFeed.js` |
| Keeps the feed matching the schedule | `betalog-react/src/components/CalendarFeedSync.jsx`, mounted at the app root |
| Setup UI | `CalendarReminders` in `src/components/schedule/CalendarReminders.jsx`, on Plan → Schedule |
| Worker | `workers/betalog-calendar/` (`PUT`/`GET`/`DELETE /cal/<token>.ics`, KV-backed) |
| Feed record | `CalendarFeed` typedef; `il_calendarFeed`, synced to Firestore |

**The app renders the `.ics`, the Worker only stores and serves it.** One tested implementation
instead of two, and the Worker stays trivial.

**Times are floating** — no `TZID`, no `Z`. This is a deviation from the sketch below, which used
`DTSTART;TZID=Europe/London`. A `TZID` reference obliges us to ship a correct `VTIMEZONE` per IANA
zone, including DST transition rules, which is hard to generate correctly and easy to get subtly
wrong. Floating time means "07:00 wherever you are" — DST-safe, no `VTIMEZONE`, universally
supported, and the behaviour you actually want from a training reminder while travelling. The stored
`tz` is retained for Route B, where a server must resolve an absolute instant.

**`CalendarFeedSync` is mounted at the app root, not inside any one screen** — the schedule can be
edited from more than one place, so a mirror scoped to a single screen would miss real edits. It fingerprints the
rendered feed and uploads only on a genuine change, with a module-level in-flight guard so
overlapping renders can't fire duplicate uploads.

### Original plan



### How it works

The Worker serves a calendar file at a private URL. The phone subscribes to it once. From then on
the phone's own Calendar app produces the alerts — BetaLog is not involved at reminder time at all.

```
BetaLog (save schedule)
   │  mirror {days, remindAt, tz, routineName} + a random feed token
   ▼
Cloudflare KV
   ▲
   │  read on request
Worker  GET /cal/<token>.ics
   │
   ▼
Phone Calendar  ── subscribed once ──▶  native alert on the day
```

### The .ics

One recurring event per schedule entry. The existing `days` array maps straight onto an `RRULE`:

```
BEGIN:VEVENT
UID:betalog-<entryId>@betalog.co.uk
SUMMARY:Hangboard — BetaLog
DTSTART;TZID=Europe/London:20260811T180000
DURATION:PT30M
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
BEGIN:VALARM
TRIGGER:-PT10M
ACTION:DISPLAY
DESCRIPTION:Hangboard — BetaLog
END:VALARM
END:VEVENT
```

### Why this first

- **No permissions, no Home Screen requirement, no Apple caveats.**
- Fires whether or not BetaLog has been opened in weeks — which is exactly when a reminder matters.
- Works identically on iPhone and Android.
- The whole thing is one Worker route and a text format. Realistically an afternoon.

### Decided 19 August 2026

- **Only a timed entry gets a `VALARM`.** An entry with no `remindAt` is emitted as a **silent
  all-day event** — visible in the calendar, never buzzes. So *clear the time* = silent, *delete the
  entry* = gone. An earlier draft gave untimed entries a 09:00 alarm; that was wrong, since clearing
  a time is exactly how a user says "stop reminding me".
- **`DTSTART` is anchored once, not recomputed.** Store `remindFrom: "YYYY-MM-DD"` when the reminder
  is set — the first matching weekday on or after that moment. Computing it fresh per request would
  give the same `UID` a moving `DTSTART` on every refresh, which some clients duplicate or drop.
  With it stored, the feed is a pure function of the data and is byte-identical between refreshes
  unless something actually changed.
- **Stable `UID` per entry** (`betalog-<entryId>@betalog.co.uk`) so an edit updates the existing
  event rather than spawning a duplicate, and a deletion removes it.
- **The KV mirror is what makes changes propagate.** Writing a schedule mirrors
  `{days, remindAt, tz, remindFrom, routineName}` into KV; the Worker never reads Firestore. Without
  this step an edit never reaches the feed.
- **One feed URL per user, not per device.** Subscribing on a second device shares the token, and
  revoking it kills every subscription at once.

### Honest limitations

- It's a **calendar alert**, not a BetaLog notification. Tapping it opens Calendar, not the app
  (mitigate with a `URL:https://betalog.co.uk` property, which some clients make tappable).
- **Subscribed calendars refresh on the phone's schedule, not yours.** iOS decides; it can be hours.
  Change your schedule at 9am and the phone may not know until the afternoon. **Accepted 19 August
  2026** — the schedule is a weekly pattern that rarely changes, so eventual correctness is fine.
  A deletion twenty minutes before a reminder may still fire once. Wrong for anything time-critical.
- The feed URL is a bearer token — anyone with it sees your routine names. Use a long random token,
  serve `Cache-Control: private`, and make it revocable from the app (Plan → Schedule).

---

## Route B — Web push *(built 3 September 2026)*

Deferred on 19 August, revisited on 3 September on Ben's verdict of Route A: **"works but it's
rough"**. The roughness was the mechanism, not the idea — a calendar alert that opens the Calendar
app, arrives on the phone's refresh schedule rather than yours, and needs the iOS **Remove Alerts**
toggle turned off by hand before it ever fires. None of those are fixable within Route A.

Route A is **kept, not replaced**. The two are independent: either, both or neither can be on. Push
is the better experience where it works; the calendar feed is the one that works everywhere,
including devices that can never do push.

### How it works

```
BetaLog Settings  ──enable──▶  Notification.requestPermission()
                                       │
                                       ▼
                          PushSubscription (endpoint + keys)
                                       │
                                       ▼
                             Firestore + mirrored to KV
                                       ▲
                                       │ read
Cron Trigger (*/15) ──▶  Worker  ──VAPID push──▶  Push service ──▶ sw.js 'push' ──▶ notification
```

### Pieces

1. **`sw.js`** — add `push` and `notificationclick` handlers. The existing SW is fine; this is
   additive, and the cache version should be bumped so it actually updates.
2. **Permission** — must be requested from a **user gesture** (the Settings switch), never on load.
3. **Subscription storage** — Firestore for the record, mirrored into **KV or D1** for the Worker.
   Don't have the Worker read Firestore: authenticating a Worker to Firestore is fiddly, and the
   only data the sender needs is `{endpoint, keys, days, remindAt, tz, routineName}`.
4. **Sender** — Cloudflare Worker on a Cron Trigger every 15 minutes. Node's `web-push` **does not
   run on Workers** (it needs Node crypto); use [PushForge](https://github.com/draphy/pushforge) or
   [`@block65/webcrypto-web-push`](https://github.com/block65/webcrypto-web-push), both built on
   WebCrypto for this exact case.
5. **VAPID keypair** — generated once, public key in the client, private key in Worker secrets.
6. **Dedupe** — store `lastSentDate` per entry so a 15-minute cron can't fire the same reminder four
   times.

### The iOS constraint

**Push only works on iPhone if the app is on the Home Screen.** The Push API is not exposed to a
normal Safari tab and has not been since it arrived in iOS 16.4. Ben already has it installed, so
this is a non-issue for him — but it is a real barrier for anyone else, and the UI must handle it
rather than silently failing.

**Notification action buttons were assumed and are not confirmed.** The open questions below list
snooze/done as a push capability. That is true of the Push API in general; whether iOS honours
`actions` in an installed web app is **unverified**, and nothing built here depends on it. The tap
target is the notification itself, which deep-links into the app. Treat any claim about action
buttons as unproven until someone checks on a device.

### Does this affect other users? — No, and here's the design that guarantees it

**It's opt-in, per user, and feature-detected.** Nothing changes for anyone who ignores it.

```js
const canPush =
  'serviceWorker' in navigator &&
  'PushManager'  in window &&
  'Notification' in window
```

Three states in Settings, and no other user-visible change anywhere:

| State | What the user sees |
|---|---|
| Push supported (Android, desktop, installed iOS PWA) | A **"Remind me" switch**, off by default |
| iOS Safari tab, not installed | The switch, disabled, with one line: *"Add BetaLog to your Home Screen to get reminders."* |
| No support at all | The switch is not rendered. Offer the calendar feed instead |

`display-mode: standalone` detects the installed case, so the message only appears to people it
applies to.

Everything is per-user and stored per-user: no subscription, no notifications, no behaviour change,
no extra permission prompt on load. **The failure mode is silence, not breakage** — which is the
right failure mode for a feature nobody asked for.

---

## As built — Route B

- **`src/lib/pushSchedule.js`** — the due-time rule, pure and unit tested (32 tests):
  `zonedParts`, `toMinutes`, `isDue`, `dueEntries`, `notificationFor`, `mirrorEntries`. The Worker
  **imports this file directly** rather than reimplementing it, the way the calendar Worker leaves
  the whole `.ics` builder in the app. One tested implementation, not two that drift.
- **`src/lib/push.js`** — support detection, token generation, base64url decoding, subscription
  serialisation, the mirror client (24 tests). `pushSupport` is pure and takes its readings as an
  argument, so the three device states can be tested on hardware nobody here owns.
- **`src/hooks/usePush.js`** + **`src/components/PushSync.jsx`** — enable/disable/sync, mounted at
  the app root so a schedule edit from any screen reaches the mirror.
- **`src/components/schedule/PushReminders.jsx`** — the switch, in Plan → Schedule above the
  calendar card.
- **`public/sw.js`** — `push` and `notificationclick` handlers. **`CACHE_NAME` bumped v2 → v3**;
  without that an existing install keeps the old worker and never receives them.
- **`workers/betalog-push/`** — `PUT`/`DELETE /sub/<token>`, KV-backed, plus a `*/5` cron sender.

**Decisions taken while building, none of them in the spec sketch:**

- **A subscription is per device, so `il_pushSub` is deliberately excluded from Firestore sync.**
  This is the opposite of the calendar feed, which is one URL per user meant to be shared between
  devices. A push endpoint is issued by one browser on one device; syncing it would hand the
  phone's endpoint to the laptop, where revoking on one silently breaks the other.
- **A 60-minute grace window.** A reminder fires on the first tick at or after its time and is
  dropped if it is more than an hour late. Without this, a Worker that was down all morning comes
  back and fires every missed reminder at once, telling you to do things you have already missed.
- **Dedupe is per entry per local day**, written immediately after a successful send. A duplicate
  reminder is a worse bug than a missed one, and the grace window bounds the retry.
- **No `GET` on the Worker.** Unlike the calendar feed, nothing needs to read the mirror back, and
  a readable mirror would turn a leaked token into a push endpoint someone else could send to.
- **The title drops the " — BetaLog" suffix** the `.ics` uses. A calendar event needs identifying
  among everything else in the Calendar app; a push notification is already labelled by the OS, so
  the suffix would read as "Glutes!!! — BetaLog / BetaLog".
- **No VAPID key configured means the card and its section header both disappear** rather than
  offering a switch that could only fail.

## Deploying Route B

**Nothing sends until this is done**, and none of it can be done from a cloud session. Full steps
in `workers/betalog-push/README.md`; in short:

1. `node scripts/generate-vapid-keys.mjs` — **once, ever**. A new pair silently breaks every device
   that has already subscribed.
2. `npx wrangler kv namespace create SUBS`, paste the id into `wrangler.toml`.
3. `npx wrangler secret put VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
4. `VITE_VAPID_PUBLIC_KEY` as a Cloudflare Pages environment variable.
5. `npx wrangler deploy`.

## Build order

1. ✅ `remindAt` + `tz` on `ScheduleEntry`, time picker on `ScheduleCard`. Needed by both routes.
2. ✅ Worker route serving the `.ics`, token stored in KV, "Subscribe to calendar" in the app
   (Settings originally; moved to Plan → Schedule by the 2026-08-20 declutter).
3. ✅ Lived with it, 19 August – 3 September. Verdict: the nudge is worth having, the delivery
   mechanism is the weak part.
4. ✅ `sw.js` push handlers, permission flow, KV mirror, cron Worker, VAPID.

Step 3 was the point of the ordering, and it did its job: Route B was built against a verdict on
Route A rather than on the assumption that reminders help.

---

## Open questions

- ~~**One reminder per entry, or a daily digest?**~~ **Resolved 19 August 2026: one per entry.**
  Each entry carries its own time, which is what makes a morning *and* an evening reminder possible.
  Three entries on one day means three alerts — accepted, and capped anyway by the 3-entry maximum.
- **Snooze / "done" from the notification?** Push supports actions; the calendar route doesn't.
- **What if a session is already logged that day?** Ideally it doesn't nag. Easy for push (the
  Worker can check), impossible for a static calendar feed.
