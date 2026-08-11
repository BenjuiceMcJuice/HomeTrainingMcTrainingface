# BetaLog — Schedule Reminders Spec

**Date:** 11 August 2026
**Status:** Specced, not yet implemented
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
| Schedule model | ⚠️ `{id, routineId, routineName, days[1–7]}` — **no time of day, no timezone** |
| Any notification code | ❌ None |

---

## Prerequisite for either route: time of day

`ScheduleEntry` carries days only. A reminder needs to know *when*.

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

**UI:** a time picker on `ScheduleCard`, and a "Remind me" switch. Off by default.

---

## Route A — Calendar feed *(build first)*

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

### Honest limitations

- It's a **calendar alert**, not a BetaLog notification. Tapping it opens Calendar, not the app
  (mitigate with a `URL:https://betalog.co.uk` property, which some clients make tappable).
- **Subscribed calendars refresh on the phone's schedule, not yours.** iOS decides; it can be hours.
  Change your schedule at 9am and the phone may not know until the afternoon. Acceptable for a
  weekly training pattern, wrong for anything time-critical.
- The feed URL is a bearer token — anyone with it sees your routine names. Use a long random token,
  serve `Cache-Control: private`, and make it revocable from Settings.

---

## Route B — Web push *(build second, only if A proves the habit)*

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

## Build order

1. `remindAt` + `tz` on `ScheduleEntry`, time picker on `ScheduleCard`. Needed by both routes.
2. Worker route serving the `.ics`, token stored in KV, "Subscribe to calendar" in Settings.
3. **Live with it for a fortnight.** Does a nudge actually change what you do?
4. Only if yes: `sw.js` push handlers, permission flow, KV mirror, cron Worker, VAPID.

Step 3 is the point of the ordering. Route B is several times the work and locks in a platform
constraint; it should not be built on the assumption that reminders help.

---

## Open questions

- **One reminder per entry, or a daily digest?** Three schedule entries could mean three
  notifications on a bad Monday.
- **Snooze / "done" from the notification?** Push supports actions; the calendar route doesn't.
- **What if a session is already logged that day?** Ideally it doesn't nag. Easy for push (the
  Worker can check), impossible for a static calendar feed.
