# The RGP Offering, In Plain English

*Internal — for Ben. No jargon without an explanation. This is the "get to grips
with it" version of `betalog_rgp_integration.md` and `betalog_technical_brief.md`.
Read this first; dip into those when you need the detail.*

---

## The one-paragraph version

The climbing centre's till system (Rock Gym Pro) knows every time someone scans
in, but it can't tell them anything useful about it. We plug into it — read-only,
like a window not a door — copy the visit data into BetaLog's database, and turn
it into three things they'll pay for: **spotting first-timers before they vanish**,
**rewards that give regulars a reason to keep coming**, and **plain-English
monthly insights** about how their business is actually doing. The app is the
member-facing face of it; the data plumbing is the real product.

---

## The cast of characters

| Thing | What it actually is | Kitchen analogy |
|---|---|---|
| **Rock Gym Pro (RGP)** | The gym's till + membership + check-in software. Each of their centres runs its own copy. | The till and the signing-in book at the front desk |
| **The RGP API** | A tap on the side of RGP that lets other software *read* its data. It physically cannot write — nobody can change their data through it. | A serving hatch you can look through but not reach through |
| **API key** | A password the gym generates that lets us use that tap. They can cancel it any time without asking us. | A key they cut for us — and they keep the ability to change the locks |
| **Cloudflare Worker** | A tiny program of ours running in the cloud. Every 15 minutes it asks each centre's RGP "any new check-ins?" and files the answers away. It's the only thing that ever touches their systems. | A courier who pops round on a schedule, reads the signing-in book, and carries a copy back to our filing cabinet |
| **Firestore** | BetaLog's database (Google's, hosted in London). Where the copies get filed, and where the app's own data already lives. | Our filing cabinet |
| **The dashboard** | A private webpage for gym staff showing the numbers: who's new, who's fading away, when the wall is busy. | The manager's clipboard, kept up to date automatically |
| **Claude / AI layer** | Reads the *totals* (never individual people) and writes the "so what" — a monthly briefing in plain English. | An analyst who reads the clipboard and tells you the three things worth doing about it |

---

## Why the gym would care (the three sells)

**1. The first-visit problem.** Most people who try climbing once never come
back, and the gym has no way to catch them. With check-in data we know the
moment someone's on their first visit. Front desk hands them a QR card → the app
opens already set to their gym → they get a "first five visits" journey with a
small reward at the end (free shoe hire, a coffee — the gym picks). Then the
killer number we can produce and nobody else can: *did people who installed the
app come back more often than people who didn't?* That's the report that
justifies paying for it.

**2. Keeping the regulars.** Streaks, milestones ("first V3!"), comeback rewards
for people who lapsed and returned. The app spots the moment; the gym attaches
the perk; staff validate a code at the desk. And on the flip side: a staff list
of members whose visits are dropping off *before* they cancel — so the gym can
reach out while there's still something to save.

**3. New money.** The app sees what no till can: performance. Someone stuck at
the same grade for ten sessions gets shown "book a session with our coach" at
exactly the moment they're frustrated enough to buy it. Someone paying per visit
eight times a month gets shown the membership maths.

---

## The multi-centre bit (their own request)

Each of their centres runs a **separate copy** of RGP, and someone at the gym
currently glues the numbers together by hand. Our courier can visit all of them
and file everything into one cabinet automatically — so we'd be replacing a
chore they already do, which is a much easier sell than a brand-new idea.

One wrinkle worth understanding: because each centre's RGP is separate, *the
same customer is a different record at each centre*. We match them up using
their email address (scrambled — see below), which their manual process almost
certainly doesn't do. That unlocks a question they've never been able to answer:
"do people who use more than one of our centres stick around longer?" (Almost
certainly yes — which helps them price multi-centre memberships.)

---

## The AI bit, demystified

Three levels, cheapest first:

- **Level 0 — this week, no building:** they drag their existing spreadsheet
  exports into Claude (the chat app) with a saved prompt like "you're analysing
  a climbing gym's visit data — give me three headlines and one thing to try."
  Costs a Claude subscription. We can set this up for them in an afternoon —
  it's the free taster that makes us look like the people who get their data.
- **Level 1 — the monthly briefing:** once our sync is running, a scheduled job
  sends the *totals* to Claude and stores the written report for the dashboard.
  Costs literally under £1 a report.
- **Level 2 — "ask your data":** a chat box for staff — "which centre's Tuesday
  evenings are dying?" Fancy, later, top-tier feature.

**The privacy rule that makes it safe:** the AI only ever sees totals and
percentages — counts of visits, not names of visitors. It's built so member
data *can't* reach it, not just *doesn't*.

---

## Words that will come up (and what they mean)

- **Read-only** — we can look, never touch. Their data can't be broken by us.
  This is the single most reassuring word in the whole pitch; use it a lot.
- **Sync / polling** — our courier's rounds. "Every 15 minutes we check for new
  check-ins."
- **Hashed email** — the email address run through a one-way scrambler before we
  store it. We can *recognise* the same email again (that's how we match people
  across centres) but can't unscramble it back to the address. We only keep the
  real address if the member ties their own app account to their membership, by
  choice.
- **DPA (Data Processing Agreement)** — the contract that says the gym owns the
  data and we only handle it on their instructions. We sign one before touching
  real member data. Having this ready *before they ask* is part of the polish.
- **Controller / processor** — GDPR roles. They're the controller (it's their
  customers' data, their rules); we're the processor (we handle it for them).
- **Sub-processor** — companies *we* rely on that therefore touch the data:
  Google (database), Cloudflare (hosting), Anthropic (AI — totals only). The IT
  guy will want this list; it's in the technical brief.
- **PoC (proof of concept)** — the 6–8 week trial at one centre. Success
  criteria agreed up front, walk-away ramp at every point.
- **Kill-switch** — they cancel the API key in their own RGP admin and we're
  locked out instantly. Their safety net, in their hands.

---

## If they ask you X, the simple answer is Y

| They ask | You say |
|---|---|
| "Can this break our till system?" | "No — the connection is read-only. RGP literally has no way for us to change anything. Worst case, our copy goes stale." |
| "What do you take?" | "Visit times, membership type, and a scrambled version of the email. Never payments, birthdays, or waivers — the code doesn't even ask for them." |
| "Where does it go?" | "Google's database, hosted in London. Same infrastructure half the internet runs on." |
| "What if we want out?" | "Cancel the key in your RGP admin — takes effect immediately, you don't need us. We then delete your copy and confirm in writing." |
| "What if *you* get hit by a bus?" | "Your RGP is untouched and still has everything — we only ever hold a copy. Cancel the key and it's as if we were never here. Nothing about running your gym depends on us." |
| "Who else sees our data?" | "Your staff, each member for their own record only, and me. Other gyms on the platform can never see yours." |
| "Is this secure? Are you certified?" | "Honestly: it's an early-stage product, no formal certifications yet — which is why it's designed to need very little trust: read-only, minimal data, your kill-switch. The infrastructure underneath (Google, Cloudflare) holds all the certifications." |
| "What does the AI see?" | "Totals only. Counts and percentages, never a person. It's built so it *can't* see individuals, not just *doesn't*." |
| "What's it cost to try?" | "The trial is free and scoped — one centre, 6–8 weeks, criteria we agree up front. If it doesn't earn a yes, you cancel one key and keep the AI-analysis setup from week one." |
| "How much work for our IT person?" | "An hour or two, front-loaded: generate one key, send us a sample of your current spreadsheet, set up one promo item in the till." |

The pattern in every answer: **small footprint, their control, honest about
limits.** If you remember nothing else, remember that read-only + kill-switch
means they risk almost nothing by trying it — that's the whole sales posture.

---

## Which document is for whom

| Doc | Audience | Hand it over? |
|---|---|---|
| `betalog_partner_overview.md` | The owner — what it does for the business | ✅ Yes |
| `betalog_technical_brief.md` | Their IT contact — how it works, risks, PoC scope | ✅ Yes |
| `betalog_rgp_integration.md` | You / future build sessions — full architecture and strategy | ❌ Internal |
| `betalog_vision.md` | You — commercial strategy, revenue, the ladder | ❌ Definitely internal |
| This doc | You — the plain-English grounding | ❌ Internal (it's your crib sheet) |

---

*Last updated: July 2026*
