# betalog-calendar

Serves each user's private training calendar as a subscribable `.ics`. This is **Route A** of
`docs/specs/betalog_reminders_spec.md`.

## What it does

```
BetaLog (Settings → Set up calendar reminders)
   │  generates a 128-bit token, renders the .ics, PUTs it
   ▼
Cloudflare KV          feed:<token> → .ics text
   ▲
   │  GET on the phone's own refresh cycle
Phone Calendar  ── subscribed once ──▶  native alert on the day
```

The `.ics` is rendered in the app (`betalog-react/src/lib/ics.js`, unit tested in
`src/lib/__tests__/ics.test.js`) and uploaded as finished text. The Worker stores and serves it —
no iCalendar logic here, so there's one implementation rather than two.

## Routes

| Method | Path | Purpose |
|---|---|---|
| `PUT` | `/cal/<token>.ics` | Store the feed. Body must start `BEGIN:VCALENDAR`, max 64 KB |
| `GET` | `/cal/<token>.ics` | Serve it to a calendar client |
| `DELETE` | `/cal/<token>.ics` | Revoke it — subscribed calendars start 404ing |

Tokens must match `^[a-f0-9]{32}$`; anything else 404s without touching KV.

## Security model

**The token is the credential, for reads and writes alike.** Anyone holding it can read the feed or
overwrite it. That's deliberate: the alternative is authenticating a Worker against Firebase for what
is a list of routine names and times, which the spec ruled out as disproportionate.

What that buys and costs:

- 128 bits of client-side randomness — not enumerable.
- Never logged, and only leaves the user's devices inside the subscription URL.
- Revocable from Settings, which kills every subscribed device at once.
- Responses are `Cache-Control: private` so no shared cache holds one person's schedule.
- **A leaked link exposes routine names and times, and lets someone overwrite the feed.** It exposes
  no sessions, no grades, no account access, and no way back into Firebase.

## Deploy

```bash
cd workers/betalog-calendar
npx wrangler kv namespace create FEEDS     # paste the returned id into wrangler.toml
npx wrangler deploy
```

Then point the app at it. The default in `betalog-react/src/lib/calendarFeed.js` is
`https://betalog-calendar.benjuicemcjuice.workers.dev`; override with `VITE_CALENDAR_API` if the
Worker lands on a different hostname (e.g. a `calendar.betalog.co.uk` custom domain).

## CORS

`PUT`/`DELETE` come from the browser, so the origin allowlist has to include wherever the app runs:
`betalog.co.uk`, `www.betalog.co.uk`, `betalog.pages.dev`, and `localhost:5173` for dev. `GET` is
called by calendar clients, which don't send an `Origin` at all — it works regardless.
