# BetaLog — Technical Brief & IT FAQ

*For the partner's IT / systems contact.*
*Companion to the Partner Overview (what BetaLog does). This document covers how
it works, what access it needs, where data lives, and what the risks and exit
routes are. It also contains the proposed proof-of-concept scope.*

*We've written this to answer the questions we'd ask if the roles were reversed.
Where something is a limitation of an early-stage product, it's stated plainly
along with the compensating control — we'd rather you find honesty here than
surprises later.*

---

## 1. What BetaLog Is, Technically

- **Member app:** a React progressive web app (PWA) — installs from a link, no
  app store. Hosted on Cloudflare Pages at betalog.co.uk.
- **Data:** Google Firebase — Auth for sign-in, Firestore for storage, region
  **europe-west2 (London)**.
- **RGP integration:** a Cloudflare Worker (small server-side process) that
  polls your Rock Gym Pro API on a schedule and writes a minimised copy of
  visit data into Firestore. No software is installed on your systems.

```
Your RGP install(s) ──(HTTPS, read-only API, 15-min poll)──► Cloudflare Worker
                                                                   │
                                                     (service account, HTTPS)
                                                                   ▼
Members' phones ◄──(HTTPS)── BetaLog app ◄──────────────── Firestore (London)
```

---

## 2. Access & Credentials

**Q: What access do you need to our systems?**
One **read-only** RGP API key per centre, which you generate yourselves in RGP
(RGP Cloud dashboard, or the settings screen on a locally hosted install). That
is the entire footprint. No VPN, no database access, no software installed on
your machines, no staff accounts on your systems.

**Q: Read-only means what, exactly?**
The RGP API has no write endpoints. BetaLog *cannot* modify, create, or delete
anything in your RGP system — not members, not bookings, not transactions. The
worst-case failure mode of the integration is "sync stops"; it can never be
"your member database is corrupted." Your RGP install remains the sole source
of truth at all times.

**Q: Where are the API keys stored?**
As encrypted secrets in the Cloudflare Worker environment. They are never in
source code, never in the member app, never in the browser, never in the git
repository. One person (the founder) has access to the Cloudflare account,
protected by 2FA.

**Q: Can we revoke access? Rotate keys?**
Yes, unilaterally, at any time, from your own RGP admin — no cooperation from
BetaLog needed. Revoking the key stops the sync immediately; the app degrades
gracefully to its non-integrated features. Rotation is: generate a new key,
send it over, we update the secret — no downtime, a five-minute job.

**Q: Our RGP is locally hosted — what does that mean for our network?**
The Worker calls your RGP API endpoint over HTTPS (outbound from Cloudflare's
network). You need that endpoint reachable from the internet on its HTTPS port
— which is already true if you're using RGP's own API for your current
collation. Nothing else on your LAN is touched. One honest caveat: Cloudflare
Workers make requests from Cloudflare's published IP ranges, not a single
static IP, so IP-allowlisting is by CIDR range rather than one address. If
that's not acceptable, we can discuss alternatives (e.g. an additional shared
secret header the Worker sends) during the PoC.

---

## 3. Data — What Is Taken, What Is Not

**Q: Exactly which fields do you pull?**

| Synced | Explicitly never synced |
|---|---|
| RGP customer ID | Payment / card details |
| Email — **hashed (SHA-256) on ingest**; plaintext is not stored unless the member explicitly links their account in the app | Date of birth |
| Check-in timestamps | Postal address, phone number |
| Membership type (member / PAYG / punch card) | Waiver contents, signatures |
| Booking records (for course/coaching funnel reporting) | Emergency contacts, medical notes, staff notes |

The sync code simply never requests or maps the right-hand column. Data
minimisation is structural, not a policy promise.

**Q: Where does the data live, and how is it protected?**
Firestore, europe-west2 (London) — UK data residency. Encrypted in transit
(TLS 1.2+) and at rest (Google-managed encryption, Firestore default). The
Worker itself is stateless — it holds nothing at rest.

**Q: Who can see our data?**
Your gym's data is scoped under its own document tree with Firestore security
rules: your staff accounts (roles you control), the member themselves (only
their own linked record), and the founder for support/administration. Other
gyms on the platform can never see your data — and vice versa. Members never
see other members' RGP data.

**Q: How long is data kept? What about deletion?**
- Members who never install the app: minimal records (hashed email + visit
  counters), purged after 12 months of inactivity (configurable).
- If someone exercises their right to erasure with you, you delete them in RGP
  as normal; the sync detects removals and purges the mirror, and your staff
  view includes a manual "purge member" button for immediate effect.
- On contract end: full purge of your gym's tree, confirmed in writing.

**Q: Backups?**
A nightly export of your gym's data (JSON) to separate storage (Cloudflare R2),
retained on a 30-day rolling window. Worth stating the deeper reassurance
though: because the integration is read-only, **BetaLog is never the system of
record** — everything in it can be rebuilt from your RGP data. A total loss of
BetaLog's database would lose app-side member logs, not anything of yours.

---

## 4. GDPR Posture

- **You are the data controller; BetaLog is your data processor** for RGP-derived
  data. A signed Data Processing Agreement precedes the first sync of real
  member data — a draft is a PoC deliverable, not an afterthought.
- Lawful basis: your legitimate interest in service improvement/retention
  analysis for the staff-facing aggregates; explicit member consent for
  account linking (the member ticks the box in the app, versioned and logged).
- Sub-processors (each with purpose and what data they touch):

| Sub-processor | Purpose | Data touched |
|---|---|---|
| Google (Firebase/Firestore) | Storage, authentication | The synced fields above; member app data. London region |
| Cloudflare | App hosting, sync worker, backup storage | Data in transit; encrypted backups |
| Anthropic (Claude API) | AI insights reports (optional tier) | **Aggregate statistics only — never member-level data.** The report generator can only read pre-computed totals; PII cannot reach it by construction |
| Groq | Members' own AI coach | Only the individual member's own training data, at their choice |

- Breach notification: without undue delay and within 72 hours of awareness,
  per UK GDPR. The kill-switch is fast and in your hands: revoke the API key.

---

## 5. Security Posture — the Honest Version

BetaLog is an early-stage product built by a single developer. Rather than
dress that up, here is the real posture and the compensating controls:

| Question you should ask | Straight answer |
|---|---|
| Pen test? SOC 2? ISO 27001? | No — not proportionate at this stage. Compensating controls: read-only access, structural data minimisation (section 3), UK-region managed infrastructure (Google/Cloudflare — which *do* hold those certifications), and your unilateral kill-switch. |
| Who has admin access? | One person, 2FA on all accounts (Google, Cloudflare, GitHub). No shared credentials, no offshore team, no access sprawl. |
| Code review / testing? | Core stats logic has automated tests; the app is linted; there is no full CI pipeline yet. The sync worker will ship with tests and failure alerting as part of the PoC because it touches your data. |
| Firebase client keys are visible in the app source — is that a leak? | No — Firebase client keys are public identifiers by design. Access control is enforced server-side by Firestore security rules, which are versioned in the repository and reviewable by you on request. |
| What's your uptime SLA? | None at PoC stage — honest answer. The infrastructure (Cloudflare, Google) is enterprise-grade; the app is best-effort. Mitigations: a missed sync self-heals (each poll re-covers a safety overlap window, so downtime means *delayed*, never *lost*), and sync failures alert the operator. Nothing in your operation depends on BetaLog being up. |
| What if BetaLog-the-company stops existing? | Your exposure is near zero by design: your RGP is untouched and remains the system of record; you revoke one API key; your data tree is purged (or handed to you as a full JSON/CSV export first — available on request at any time, not just at exit). Code escrow can be discussed if the relationship deepens. |

The theme: the architecture is arranged so that trust in BetaLog-the-company is
required for very little. Read-only access + minimised data + your kill-switch
means the blast radius of any failure — technical or commercial — is small and
bounded.

---

## 6. Operational Impact on Your Systems

- **API load:** check-in polling every 15 minutes plus a nightly bookings pass
  — on the order of 100–200 small HTTPS requests per centre per day. RGP's API
  serves this comfortably; your current manual collation likely pulls more in
  one run.
- **No schedule interference:** polls are read-only GETs; there is no locking,
  no bulk export job on your server, nothing that competes with front-desk use.
- **Front desk:** the only operational asks are human ones — hand out QR cards,
  validate reward codes (a 10-second screen), and pre-create the matching promo
  items in your own POS. No till software changes.
- **Monitoring:** the Worker's scheduled runs are health-checked; consecutive
  failures alert the operator. You'll hear about a broken sync from us, not
  from a stale dashboard.

---

## 7. Proposed Proof of Concept

Deliberately small, cheap to run, and cheap to walk away from — for both sides.

### Scope (6–8 weeks, one centre)

| Week | Deliverable |
|---|---|
| 1 | **AI insights on your existing exports** — no integration needed: your current collated data, analysed with a saved prompt in an off-the-shelf AI assistant. Immediate value; also calibrates what the later automated reports should contain. |
| 1–2 | DPA signed; API key issued; sync running against one centre (read-only); data audit — you review exactly what landed in Firestore against section 3's table. |
| 2–4 | Staff dashboard v1: cohort retention curves, first-timer conversion, visit-frequency/at-risk list, peak-hours heatmap. Built to the questions your current collation actually answers, plus the ones it can't. |
| 3–5 | Member-side: QR cards at the desk, gym-branded onboarding, first-five-visits journey with **one** manually-run reward (you pick it; staff validate codes at the desk). |
| 6–8 | Review against success criteria (below); decision point. |

### What we need from you

1. One read-only API key (you generate, you can revoke).
2. A sample of your current collation output (so the dashboard replicates what
   you actually use).
3. One promo item configured in your POS for the reward.
4. QR cards on the front desk and staff told what they're for.
5. A 30-minute review call at weeks 2, 5, and 8.

Total IT effort on your side: an hour or two, front-loaded.

### Success criteria (agreed up front, measured at week 8)

- **Data:** dashboard numbers reconcile with your own collation (spot-check);
  sync ran with no manual intervention for the final 4 weeks.
- **Retention signal:** ≥20% of first-time visitors during the PoC scan the QR
  and open the app; 30-day return rate of installers vs non-installers is
  measured (the PoC establishes the baseline — moving it is the pilot's job).
- **Operational:** front desk validated reward codes without friction; staff
  opened the dashboard unprompted at least weekly.
- **Trust:** the week-2 data audit found nothing outside section 3's table.

### Exit ramps

At any point, for any reason: revoke the API key, request the purge, keep the
week-1 AI-analysis setup (it's yours — it runs on your own exports). No fees,
no lock-in, no dependency created. If the PoC succeeds, the conversation moves
to a multi-centre pilot and commercial terms; nothing is pre-committed.

---

## 8. Questions We Haven't Answered

Send them over — direct line to the person who built it, which for an
integration like this beats a support ticket queue. Anything answered here that
turns out to matter contractually gets lifted into the DPA/agreement rather
than living only in a document.

---

*Last updated: July 2026. This document describes intended PoC-stage
architecture; where a control is planned rather than live today (worker tests,
failure alerting, nightly R2 backups), it is a named PoC deliverable above.*
