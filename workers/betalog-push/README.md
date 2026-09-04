# betalog-push

Sends BetaLog schedule reminders as web push. This is **Route B** of
`docs/specs/betalog_reminders_spec.md`; the calendar feed (Route A) is
`workers/betalog-calendar` and the two are independent — either, both or neither
can be on.

## What it does

    PUT    /sub/<token>   store {subscription, entries}
    DELETE /sub/<token>   forget it

plus a cron trigger that wakes every 5 minutes, works out which reminders are
due in each user's own wall-clock time, and sends them.

There is deliberately **no GET**. Nothing needs to read this back, and a mirror
that could be fetched with the token would turn a leaked URL into a push
endpoint someone else could send to.

## Deploying it

You need to do all five. The first two are once, ever.

**1. Generate the VAPID keypair.**

```
cd workers/betalog-push
npm install
node scripts/generate-vapid-keys.mjs
```

Generate this **once**. The public key is baked into each browser's subscription
at the moment it is created, so a new pair silently stops every already-enabled
device from receiving anything until it re-subscribes.

**2. Create the KV namespace** and paste the id into `wrangler.toml`:

```
npx wrangler kv namespace create SUBS
```

**3. Set the secrets.** Use the rotation script — it generates the pair and pipes
both halves straight to wrangler, so neither is ever printed or copied:

```
node scripts/rotate-vapid-keys.mjs
```

It prints only the public half, as the `VITE_VAPID_PUBLIC_KEY=` line for step 4.

> Setting these by hand is how the first live deploy failed: the two keys were
> printed, two `wrangler secret put` commands were pasted, and the literal
> placeholder text went into both secrets. Nothing surfaced until the cron tried
> to send and the push library said `Point is not on curve`.

**4. Give the app the public half.** `VITE_VAPID_PUBLIC_KEY` — in
`betalog-react/.env.local` for a local run, and as a Cloudflare Pages
environment variable for the deployed site. **Without it the app hides the
notifications card entirely** (`shouldOfferPush`), which is the intended
behaviour for a build that could not deliver a push anyway.

**5. Deploy:**

```
npx wrangler deploy
```

Redeploy after a change is just `npx wrangler deploy` again.

## Testing it without a phone

```
node scripts/smoke-test.mjs
```

Drives the cron path against an in-memory KV and a stubbed push service: who is
due, what is sent, what gets marked, what gets retried, what gets pruned. The
encryption is real — `buildPushPayload` does an actual ECDH against the test
subscription's key, so a structurally invalid key fails the same way it would in
production.

What it cannot tell you is whether a notification actually appears on a phone.
That needs a deploy, a real subscription and a device.

## Design notes

**The due-time rule is imported, not reimplemented.** `src/index.js` imports
`dueEntries`, `notificationFor` and `zonedParts` from
`betalog-react/src/lib/pushSchedule.js`, which is unit tested there. Wrangler
bundles across the directory boundary. This follows the precedent set by the
calendar Worker, which keeps the whole `.ics` builder in the app for the same
reason: one tested implementation rather than two that drift.

**Everything is in the user's own timezone.** Each entry carries the `tz` it was
created in and comparisons are done against the wall clock there, never by
arithmetic on UTC offsets. That is what keeps 07:00 meaning 07:00 through a DST
change.

**The grace window is 60 minutes** (`DEFAULT_GRACE_MINS`). A reminder that has
come due fires on the next tick; one that is more than an hour late is dropped
rather than sent. If the Worker were down all morning, the alternative is every
missed reminder arriving at once, telling you to do things you have already
missed.

**A subscription is per device, not per user.** Unlike the calendar feed — one
URL meant to be shared between devices — each browser issues its own endpoint,
so each device subscribes for itself and `il_pushSub` is deliberately excluded
from Firestore sync. Turning notifications off on the phone leaves the laptop
alone.

**Dedupe is per entry per local day.** `sent[entryId] = "YYYY-MM-DD"`, written
immediately after a successful send. A duplicate reminder is a worse bug than a
missed one, and the grace window bounds any retry. The map is pruned of entries
that no longer exist on every write.

**A 404 or 410 from the push service deletes the record.** That is the service
saying the subscription is dead — uninstalled, or the endpoint rotated. Nothing
we send will ever arrive again.

## Free tier

KV reads are one per subscribed device per tick. At `*/5` that is 288 ticks a
day against a 100,000 read/day limit, so the ceiling is comfortably in the
hundreds of devices. Widen the cron to `*/15` if that ever matters — the cost is
that the worst-case lateness goes from 5 minutes to 15.
