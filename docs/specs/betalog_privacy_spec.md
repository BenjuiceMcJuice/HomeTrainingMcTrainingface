# BetaLog — Privacy & Data Spec

> This document covers two things:
> 1. The spec for building and maintaining the privacy page
> 2. The draft content for that page (plain English + legal policy)
>
> Last updated: 2026-09-26 — rewritten against the code (BTL-B31). Every statement below was
> checked against `betalog-react/src` and `workers/` on that date; see *How this copy was checked*
> at the end.
> Review trigger: any new data touchpoint, new feature involving user data, or change to third-party services

---

## Build Spec

### Page location
`betalog.co.uk/privacy.html` — a static page in `betalog-react/public/`, like `help.html` and
`pyramid.html`, in the same visual style.

### Entry points
- Settings — a "Privacy" link in the Account section, beside *Delete account…*
- The guide (`/help.html`) — from the *Your data* chapter
- The sign-in screen — "By signing in you agree to the Privacy Policy"

### Maintenance rule
**This page must be reviewed and updated every time any of the following happen:**
- A new third-party service or Worker is integrated
- A new data type is collected, or a new field joins the friend-visible profile
- A feature that shares data with other people ships
- A legal entity is formed (data controller name changes)
- Gym data processing begins (controller/processor distinction changes)

Add a "Last reviewed" date visibly at the top of the page. A policy that describes a plan instead
of the app is worse than none: on 2026-09-13 this draft described a share-links feature that was
never built, promised a delete button that did not exist, called a shipped export "coming soon",
and left out the friend profile entirely. Check every sentence against the code before it ships.

### Structure
1. Plain English explainer (top — this is what most users read)
2. Full legal privacy policy (below — for GDPR compliance)
3. Contact / data requests section

---

## Plain English Explainer

*This section goes at the top of the page. Written to be read, not to protect against lawyers.*

---

### Your data, plainly explained

BetaLog is a training app. Here is exactly what it does and doesn't do with your data.

---

**What BetaLog stores about you**

BetaLog needs an account — Google sign-in, or an email address and password. Your training data
is kept on each device you use it on, and in your account in Firebase (Google's cloud database,
hosted in London) so it follows you between devices. That includes:
- Your email address, and your Google display name if you signed in with Google
- Your session logs — climbing, gym, hangboard and cardio sessions, with any notes you write
- Your exercise library, routines and training schedule
- Your goals and your weekly scores
- Your health log — bodyweight, and drinks if you log them
- Your profile — the name you choose, height, and the climbing venues you have named

We use this data to run the app and nothing else. We do not sell it, share it with advertisers,
or use it for anything other than showing it back to you and to the friends you add.

The developer can read account data through an admin view, to fix problems and answer your
questions. It is not used for anything else.

---

**What your friends see**

You add a friend by giving them a friend code (it lasts 24 hours) or entering theirs. Once you are
friends, each of you can see the other's climbing profile:
- Your name as you set it in Settings
- Your climbing level for bouldering and for rope — your base grade, project, hardest flash and
  all-time best
- Your grade pyramid, and how many attempts, sends and flashes you have logged at each grade
- Your last 30 days — hardest send, sends, flashes and number of sessions — and the date you last
  climbed
- Your weekly training streak
- Your last five sessions, as a date, a type and a one-line count ("12 climbs, 8 sent",
  "5 exercises")

Friends do not see your notes, your health log, your goals, your venues or where you were, or
anything else in your log. The profile is updated whenever your log changes. Removing a friend
stops them seeing it.

---

**Your location**

When you log a climbing session, you can tap the pin beside the venue field to have BetaLog suggest
venues you have climbed at before that are near you. This asks your phone for its location once,
only when you tap, and only on that screen. BetaLog remembers where you were when you save a session
at a venue, so it can offer that venue next time you are there. Those coordinates are stored with
your own training data (on your device, and in Firebase), are never shown to friends, and are never
sent to any maps or places service. If you say no to the location prompt, the venue field works
exactly as before — you type it.

---

**The AI coach and Groq**

The AI coach is powered by Groq, a third-party AI service. To use it, you supply your own Groq API
key, which is stored on your device only — it is never sent to Firebase or anywhere we can see it.

When you ask the coach for an analysis, or the daily tip refreshes, BetaLog sends Groq:
- A summary of your training sessions — dates, types, grades, exercises, and your session notes
- Your profile — name, height and weight if you have entered them
- Your goals and how far along them you are
- Your question

Your email address and account ID are never sent. Groq's own privacy policy (linked below) governs
what it does with the request. If you do not want any training data sent to Groq, do not add a key;
the coach is entirely optional.

---

**Reminders**

If you turn on schedule reminders, your routine names, days and times go to a small BetaLog
service on Cloudflare so it can send them:
- **Calendar feed** — your schedule is stored as a calendar file behind a long random link. Anyone
  with the link can read it, so share it only with your own calendar. You can revoke it from
  Plan › Schedule.
- **Notifications** — the service stores your routine times and the address your browser gives
  it for sending notifications. Each device is set up separately and switched off separately.

Nothing else from your log goes to either service, and neither is linked to your account or email.

---

**Feedback**

If you send feedback through the app, it goes to a separate feedback service shared by the
Benjuicey apps, with your message and anything else you type into the form, and is read by the
developer only.

---

**What we don't do**

- We do not sell your data
- We do not show you ads
- We do not share your data with third parties except as described above (Firebase for storage and
  sign-in, Groq for the AI coach if you use it, Cloudflare for reminders and page counts)
- We do not use your training data to train AI models
- We do not track your behaviour across other websites

We do count page views, using Cloudflare Web Analytics. It is cookieless: no cookies, nothing stored
on your device, no identifier that follows you between visits or to any other site. It tells us how
many people opened a page — never who, and never anything connected to your account or your
training data.

---

**Your rights**

You can:
- Export your whole log at any time — Settings › Data › Export JSON
- Delete your account and everything in it — Settings › Account › Delete account…. It removes your
  log and profile from Firebase, takes you off your friends' lists, deletes your calendar feed and
  this device's reminders, deletes your sign-in, and clears this device. It happens at once and
  cannot be undone.
- Ask for anything the button cannot reach — feedback you have sent, or reminders set up on a device
  you no longer have

Signing out does not delete anything, and leaves your log on that device until you sign in again or
clear the browser's site data.

To ask a data question or make a request, contact: **benjuice.apps@gmail.com**

---

## Full Legal Privacy Policy

*This section follows the plain English explainer on the same page.*

---

### Privacy Policy

**Effective date:** [the date the page goes live]
**Last reviewed:** 2026-09-26
**Data controller:** Ben Phipps, operating as BetaLog at betalog.co.uk

> **Note:** Currently operating as an individual, Ben Phipps. (Earlier drafts carried a wrong name, taken from a borrowed laptop's user account; corrected 2026-09-26.) Update the controller name when a legal entity (sole trader or Ltd) is formed. At that point also consider whether a formal Data Processing Agreement is needed with gym partners.

---

#### 1. Who we are

BetaLog is a climbing training web application available at betalog.co.uk, operated by Ben Phipps ("we", "us", "our"). We are the data controller for personal data processed through this service.

Contact: benjuice.apps@gmail.com

---

#### 2. What data we collect and why

**2.1 Account data**

BetaLog requires an account. You sign in with Google or with an email address and password. We
receive and store:
- Your email address
- Your Google display name (Google sign-in only)
- A Firebase user ID

Legal basis: Contract performance (an account is how the service syncs your log between devices).

**2.2 Training data**

Stored in Firebase Firestore (region europe-west2, London) under your user ID, and in your
browser's localStorage on each device you use:
- Session logs (type, date, grades, climbs, exercises, hangboard grips, cardio, effort, notes)
- Exercise library, routines and training schedule
- Goals and sealed weekly scores
- Health log — bodyweight entries and, if you log them, drinks
- Athlete profile (name, height — only fields you choose to complete)
- Climbing venues you have named, and, if you have used the venue suggestion, the approximate
  location of your device when you saved a session at each one (used only to suggest that venue to
  you again; never shared or sent to a third party)
- Your friends list and your current friend code

Legal basis: Contract performance (providing the service you have signed up for).

The developer has read access to account documents through an admin view, used only to support
users and fix faults.

**2.3 Friend-visible profile**

A second document, `users/{id}/public/profile`, is readable by you and by the people on your
friends list, and by no one else. It holds: your chosen name; per discipline (bouldering, rope)
your base grade, project, hardest flash, all-time best send and level; your grade pyramid with
attempts, sends and flashes per grade; your last-30-day hardest send, send, flash and session
counts; the date you last climbed; your weekly streak; and your last five sessions as date, type,
discipline and a one-line count. It is rewritten whenever your log changes.

Friends are added with a friend code: a short code, valid for 24 hours, that maps to your user ID
so the person you gave it to can add you. Adding is mutual — each of you is placed on the other's
list.

Legal basis: Contract performance (friends are a feature you choose to use by exchanging a code).

**2.4 AI coaching data**

When you use the AI coach, the following is sent to Groq, Inc. (a third-party AI provider), from
your browser, using your own API key:
- A structured summary of your training sessions, including session notes
- Your athlete profile fields (name, height, weight if entered)
- Your goals and progress towards them
- Your coaching query

Your email address and user ID are never sent to Groq. Your Groq API key is stored in your
browser's localStorage only and is never transmitted to Firebase or to us.

Groq processes this data under its own terms, available at groq.com/privacy. We recommend
reviewing them if you intend to use the AI coach feature.

Legal basis: Consent (the AI coach is an optional feature requiring you to supply your own API key).

**2.5 Reminder data**

If you turn on reminders, two small services we run on Cloudflare Workers store:
- **Calendar feed:** a calendar file of your scheduled routines (names, days, times), stored
  against a random 128-bit token. Anyone holding the feed link can read it. Deleted when you revoke
  the feed or delete your account.
- **Push notifications:** the push endpoint and keys your browser issues, and your scheduled
  routines (names, days, times, timezone), stored against a random token per device. Deleted when
  you switch notifications off on that device, when you delete your account from that device, or
  automatically when your browser's push service reports the subscription is gone.

Neither service stores your user ID, email or any other part of your log.

Legal basis: Consent (reminders are off until you turn them on).

**2.6 Feedback submissions**

If you submit feedback via the in-app form, your message and anything else you enter are sent to
the Benjuicey feedback service (a Cloudflare Worker shared by the developer's apps) and are
accessible only to the developer.

> **[CHECK before publishing]** Confirm against the Benjuicey feedback service what it stores
> alongside the message (email field, app ID, page URL, browser) and for how long, and list it
> here. It is not in this repository and could not be read from here.

Legal basis: Legitimate interests (improving the service).

---

#### 3. Third-party services

| Service | Purpose | Data sent | Privacy policy |
|---|---|---|---|
| Firebase (Google) | Sign-in and data storage | Account data, training data, friend profile | firebase.google.com/support/privacy |
| Groq, Inc. | AI coaching responses (only with your own key) | Training summary, athlete profile, goals, coaching query | groq.com/privacy |
| Cloudflare Workers | Calendar feed, push reminders, feedback form | Routine names and times, push endpoint, feedback message | cloudflare.com/privacypolicy |
| Cloudflare Web Analytics | Aggregate page-view statistics | Page URL, referrer, browser and country — no cookies, no identifiers | cloudflare.com/privacypolicy |

No other third-party services receive your personal data. BetaLog does not use advertising networks or cross-site tracking pixels.

**Cloudflare Web Analytics** is cookieless. It sets no cookies, stores nothing on your device, and assigns no identifier that would let it follow you between visits or across other websites. It records that a page was viewed, not who viewed it, and the measurements cannot be tied back to your account or your training data. Because it neither stores information on your device nor processes personal data, it needs no consent banner under PECR, and there is nothing to opt out of.

Legal basis: Legitimate interests (understanding aggregate usage to improve the service).

---

#### 4. Data retention

- **Account and training data:** Retained until you delete your account. Deleting from Settings
  removes your Firestore documents and your sign-in immediately. Firebase's own backups, if any,
  are outside our control and follow Google's retention.
- **Friend-visible profile and friend code:** Deleted with your account. You are removed from every
  friend's list at the same time.
- **Calendar feed:** Until you revoke it or delete your account.
- **Push reminders:** Until you switch them off on that device, delete your account from it, or the
  browser's push service reports the subscription gone. Reminders set up on another device must be
  switched off on that device.
- **Feedback submissions:** Retained for up to 2 years or until deletion is requested.
- **On your devices:** Your log stays in the browser's localStorage until you delete your account
  (which clears the device you delete from) or clear the site's data. Signing out does not clear it.

---

#### 5. Your rights (UK GDPR)

You have the right to:
- **Access** the personal data we hold about you
- **Rectify** inaccurate data
- **Erase** your data ("right to be forgotten")
- **Restrict** processing of your data
- **Data portability** — receive your data in a structured, machine-readable format
- **Object** to processing based on legitimate interests
- **Withdraw consent** at any time for consent-based processing (e.g. AI coach)

Erasure and portability are self-service: Settings › Account › Delete account… and Settings › Data › Export JSON. For anything else, or anything those do not reach, contact: **benjuice.apps@gmail.com**

We will respond within 30 days. We may need to verify your identity before processing a request.

If you are unsatisfied with our response, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at ico.org.uk.

---

#### 6. Data security

Training data in Firebase is protected by:
- Firebase security rules restricting access to the authenticated user's own data, with two exceptions: friends can read the friend-visible profile (§2.3), and the developer's admin account can read account documents (§2.2)
- Google's infrastructure-level encryption at rest and in transit
- HTTPS for all data transmission

Calendar feed and push tokens are 128-bit random values. The feed link is the only key to your feed, so share it only with your own calendar app.

Your Groq API key is stored in your browser's localStorage only. Do not share it with others or enter it on untrusted devices.

---

#### 7. Children

BetaLog is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us with personal data, contact us and we will delete it.

---

#### 8. Changes to this policy

We will update this policy when our data practices change — for example when new features involving personal data are launched. The "Last reviewed" date at the top of this page will be updated each time. Significant changes will be flagged in the app.

---

#### 9. Contact

For data-related requests or questions:

**Ben Phipps**
BetaLog — betalog.co.uk
**benjuice.apps@gmail.com**

---

## TODOs — Legal Loose Ends

These are flagged for future action, not blockers now:

- [ ] **Legal entity** — when formed, update data controller name throughout. Consider sole trader registration (simple, free) even before Ltd to formalise the trading name.
- [ ] **ICO registration** — data controllers in the UK processing personal data are generally required to register with the ICO (£40/year for small organisations). Do this when gyms start paying or when member data at scale is processed.
- [ ] **Data Processing Agreements with gyms** — when a gym comes on as a partner and their members' data flows through BetaLog, BetaLog becomes a data processor for that gym (the data controller). A simple DPA is required under GDPR. Draft this before Redpoint pilot goes live with member data.
- [x] **Data export feature** — shipped (Settings › Data › Export JSON); the policy now says so.
- [x] **Account deletion** — shipped 2026-09-26 (BTL-B32); the policy now describes it.
- [x] **Controller name** — Ben Phipps (Ben, 2026-09-26).
- [ ] **Feedback service** — list what the Benjuicey feedback Worker stores, §2.6.
- [ ] **Cookie policy** — Firebase Auth uses cookies/localStorage. Technically requires a cookie notice for UK users. Low priority until traffic is meaningful but worth adding to the help page.
- [ ] **Groq policy review** — confirm Groq's data retention and training data policy periodically. If Groq changes their terms, this policy may need updating.

---

## How this copy was checked

2026-09-26, against the code on the branch that added account deletion:

| Claim | Where it is true |
|---|---|
| An account is required | `App.jsx` renders `LoginScreen` whenever there is no user |
| Google or email/password | `LoginScreen.jsx` |
| What is synced | `SYNC_KEYS` in `lib/storage.js`, plus `email`, `authDisplayName`, `friends`, `friendCode` |
| The Groq key stays on the device | `groqKey` is not in `SYNC_KEYS` |
| What friends see | `buildPublicProfile` (`lib/stats.js`) and `buildPublicProfileWithBase` (`lib/goals.js`) |
| Who can read the friend profile | `firestore.rules`, `match /public/profile` |
| The developer can read accounts | `isAdmin()` in `firestore.rules`; `pages/Admin.jsx` |
| What Groq receives | `buildContext` in `lib/coach.js` — name, height, weight, sessions with capped notes, goals |
| Reminders | `lib/calendarFeed.js`, `lib/push.js`, `workers/betalog-calendar`, `workers/betalog-push` |
| Feedback | `index.html` loads the widget from `benjuicey-feedback…workers.dev` — **not** Firebase, as the March draft said |
| Deletion | `lib/accountDeletion.js`, `Storage.deleteCloudData` |
| Signing out leaves the log on the device | `handleSignOut` in `App.jsx` only calls `signOut` |

Removed from the March draft because none of it exists: share links (a whole section, and the
revoke-from-Settings right), and *"use the app without an account"*.
