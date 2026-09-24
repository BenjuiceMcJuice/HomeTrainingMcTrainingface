# BetaLog — Help & Feedback: one button in the header

**Written:** 2026-09-24 · **Supersedes** Parts 2 and 3 of `betalog_activity_help_spec.md` (the `?`
link-out and the Firestore feedback form), which were written in March before the shared feedback
widget existed. Build status is in `BACKLOG.md` (BTL-B61 onward), not here.

> Ben, 2026-09-24: *"The feedback widget and 'how app works'…. Can we make them more prominent.
> Maybe at the top banner of the app like a how app works / feedback button (word as appropriate)
> which opens a button to a how it works doc which explains the app in full in simple terms (have the
> goal info in there also) maybe as a wiki or suitable file. and also the feedback modal for bugs
> enhancements etc etc."*

---

## 1. The problem

Two things a new climber needs are three taps deep or nowhere:

- **Feedback** is one button at the bottom of the Settings sheet, under *Data* and *Restore
  defaults*. It opens the shared Benjuicey widget (`window.BenjuiceyFeedback.open()`), which works,
  but nobody finds it. BTL-B15 has been open since August because the round-trip has never been
  watched end to end from this app — a symptom of the same thing: nobody uses it.
- **How the app works** exists only for one feature. `/pyramid.html` (the explainer, shipped
  2026-09-13) covers grades, levels, the pyramid, goals, the dots and the forecast, and is reached
  from *How this works ↗* on the climbing widget, the goal card and the friends screen. There is
  nothing that says what the Log tab's five modes are, what a widget is, how Friends work, how to
  install the app, or where the data lives.

Both are discoverability problems, not build problems. The widget and the explainer are already
good; they are in the wrong place.

## 2. What is being built — read back

One **Help button in the app header**, on every screen, mobile and desktop. It opens a small sheet
with two choices:

1. **How BetaLog works** — a guide to the whole app in plain words, one page, every screen and
   feature, with the grade-and-goals material in it. Written for the climber, not the developer.
2. **Send feedback** — the existing shared widget, for bugs, ideas and anything else.

That is the whole feature. The guide is the large piece of work; the button and sheet are small.

## 3. The header button

### 3.1 Placement

The header today is **Logo · Friends · Settings** (mobile top bar and desktop top nav, `Nav.jsx`).
It becomes **Logo · Help · Friends · Settings**. Help sits first of the three because it is the one
a new user is looking for; Settings stays at the edge because it is where the hand expects it.

- **A labelled chip, on both header variants**: `HelpCircle` from lucide at 18px and the word
  **HELP** in Barlow Condensed 700 uppercase, brand blue `#4f7ef8` on the blue tint `#eef1ff`,
  fully rounded, `padding: 7px 11px 7px 9px`. Friends and Settings stay 18px muted grey, so the one
  call to action in the header is the one thing in colour. *Ben's choice, 2026-09-24, from four
  rendered treatments: A the grey icon as first mocked, B a 22px blue icon, C this chip, D a white
  `?` on a filled blue disc. D was rejected because a filled disc means a selected tab elsewhere in
  the app; A and B were too easy to miss beside the logo's blue.*
- The same chip on desktop; there is no icon-only variant anywhere.
- At 320px, the narrowest supported phone, logo + chip + two icons take about 270px. Rendered and
  checked; nothing wraps.
- Nothing else in the header moves. No badge, no pulse, no first-run highlight (see §7).

### 3.2 Wording

Ben asked for "how app works / feedback, worded as appropriate". **Help** is the word. It covers
both children, it is one syllable, and a `?` in a circle is universally read as it. *Support* implies
a person answering; *Info* implies a status page; *Guide* excludes feedback. On the desktop nav
where there is a label, it reads *Help*, not *Help & feedback* — the sheet makes the two choices
obvious in a second.

### 3.3 The Help sheet

A slide-up sheet in the house pattern (fixed overlay, white rounded panel from the bottom, as
`SettingsSheet` and `FriendsSheet`). Contents, top to bottom:

| Row | Copy | Action |
|---|---|---|
| Title | **Help** | — |
| Primary | **How BetaLog works** — *Every screen and feature, in plain words. Grades, goals and the pyramid included.* | Opens `/help.html` in a new tab |
| Primary | **Send feedback** — *Found a bug? Want something added? Tell us — it takes a minute.* | `window.BenjuiceyFeedback.open()`, then closes the sheet |
| Footer | *BetaLog v1.0.0 · build `abc1234`* | — (the same version line Settings shows) |

Two tall tappable cards, not two text links; this is the one place in the app where big targets are
the point. Nothing else goes in this sheet. Version history, what's new, links to the privacy page
(when it exists) are all candidates and all rejected for now: two choices is the design.

The sheet is new code: `components/layout/HelpSheet.jsx`, opened by `helpOpen` state in `App.jsx`,
alongside `settingsOpen`.

### 3.4 What happens to the existing entry points

- **Settings → Feedback → Send feedback** stays. It is an action, not a fact, so the one-home rule
  does not apply, and somebody scrolling Settings for "where do I complain" should still find it.
- **How this works ↗** on the climbing widget, the goal card and the friends screen stays and keeps
  pointing at `/pyramid.html`. Those are deep links from the feature to its own explanation; the
  guide is the wide one.

## 4. The guide — `/help.html`

### 4.1 Form: a static page, not a wiki

Ben suggested "a wiki or suitable file". Options weighed:

| Option | Verdict |
|---|---|
| **Static page at `/help.html`**, same template as `pyramid.html` | **Chosen.** Public, no sign-in, linkable by section, phone-first, matches the app's look, and the template is already written and verified on a phone. Deploys with the app but is content, not code — a copy change is a one-file commit |
| GitHub wiki | Rejected. GitHub's chrome, GitHub sign-in to edit, a different look, a different domain, and it cannot open in the app's colours |
| In-app React page (`/help` route) | Rejected. Behind the sign-in wall, so a climber deciding whether to sign up cannot read it, and it cannot be sent as a link |
| Markdown in the repo, rendered at build | Rejected for now. It adds a build step for one page; revisit if the guide grows past one file |

### 4.2 Relationship to `/pyramid.html`

Two pages, one entry point. **The guide explains everything in simple terms; the explainer keeps the
reasoning.** The guide's *Your grade and your goals* chapter (§4.4, chapter 4) says what Base, Best,
Flash, the pyramid, the two goal kinds, the dots and the forecast *are*, in a paragraph each, and
ends with *The full reasoning, with the sources → How BetaLog reads your climbing*. The explainer is
not merged in: it is 320 lines of careful maths copy that a first-week climber does not need, and
folding it in would make the guide a scroll nobody finishes. Both pages link to each other in the
header nav.

### 4.3 Copy rules

These are the rules the page is written to, and the rules a reviewer checks a change against.

1. **Plain words, present tense, second person.** *You log a climb; BetaLog works out your base.*
   No "the user", no "functionality".
2. **Describes what a thing is, never what state it is in.** No *coming soon*, no *planned*, no
   *beta*. Status lives in `BACKLOG.md`; a public page saying *coming soon* about something that
   shipped is the same drift that put six wrong claims in the docs on 2026-09-12. This drops the old
   spec's *Coming Soon* section deliberately.
3. **Every sentence must be true of the app on `main`.** The privacy copy was found wrong in four
   places on 2026-09-13 because it was written from the plan, not the code (BTL-B26/B31). The guide
   is written from the running app, screen by screen, and each chapter is checked against it before
   merge. Where the app cannot do something people will expect — delete your account (BTL-B32) —
   the guide says so plainly rather than staying silent.
4. **A chapter is one screen or one idea**, under about 200 words plus a list. Anyone can find the
   bit about the thing in front of them from the table of contents in one scroll.
5. **The guide never contradicts the explainer or the data-honesty spec.** Where it summarises a
   number the app shows, it uses the app's word for it (*Base*, not *consistent grade*).
6. **No screenshots.** They date the fastest of anything on the page, and the page has to survive
   the cache-name changing forty times a year.

### 4.4 Chapters

Order follows the bottom nav left to right, with the two things everyone asks first — what is this
and how do I get it on my phone — before it, and the two things everyone asks last — my data and
help — after it.

| # | Chapter | Covers |
|---|---|---|
| 0 | **What BetaLog is** | One paragraph. A training log for climbers: climbing, gym, hangboard, cardio and health in one place, that reads your grade from what you log and helps you set a goal you can reach. Free. Works offline |
| 1 | **Getting started** | Install as an app from the browser, iOS (Share → Add to Home Screen) and Android (menu → Install app). No app store. Signing in with Google or email; sign-up; the two traps — Google sign-in does not work inside the installed app on iPhone, and there is no forgotten-password link. *Corrected 2026-09-24 while building: the app cannot be used without an account (`if (!user) return <LoginScreen />`), so the spec's "on this device only" mode did not exist and is not described* |
| 2 | **Getting around** | The five tabs — Dashboard, Log, History, Plan, Coach — one sentence each. The three header buttons — Help, Friends, Settings |
| 3 | **Log** | The five modes. *Climb*: boulder, lead, top rope; grades in V-scale or French; attempt, send, flash; venue chips and the location pin. *Train*: a gym session from your exercises or a routine, sets, reps, weight. *Hang*: the hangboard timer, routines, the cue sounds, the screen staying awake. *Cardio*: the activity types, distance, duration, the calorie estimate and what it is based on. *Health*: weight, drinks. Editing or deleting a session |
| 4 | **Your grade and your goals** | Base · Best · Flash and the 180-day window. The level badge and the bands. The pyramid shape, 1 · 2 · 4 · 8, in one paragraph. The two goal kinds, *Send* and *Own*. What the five dots answer. Where the forecast date comes from, in one sentence. Weight goals and cardio goals. Link to the full explainer. **This is the "goal info" Ben asked for** |
| 5 | **Dashboard** | What a widget is; the list of widgets, one line each (Training load, Boulder level, Rope level, Coach tip, Weight & BMI, Alcohol & streak, Gym stats, Cardio stats, Activity calendar, Shameometer). Edit mode: choosing, ordering, collapsing. Each widget's timeframe. The Shameometer gets its own paragraph: the week, the three parts of the score, the sealed week log |
| 6 | **History** | The feed, grouped by date. Tapping a session. Achieved goals appearing on the day of the send |
| 7 | **Plan** | *Goals*: setting one, the goal card, achieving it. *Schedule*: the week, routines on days, and the two kinds of reminder — a calendar feed you subscribe to, and push notifications — how to set each up. *Routines*: climbing and hangboard routines, the built-in ones. *Exercises*: the built-in list, adding your own, default weight |
| 8 | **Coach** | What it does and what it sees (your log, your goals, your schedule). The personas. Getting a Groq key, step by step, and where to paste it. What it does not do: it describes your log, it does not diagnose you |
| 9 | **Friends** | Friend codes, that they expire after 24 hours, adding and removing. **Exactly what a friend sees** — the list must match `buildPublicProfileWithBase`, and is the same list BTL-B31 owes the privacy copy, so it is written once and used by both |
| 10 | **Settings** | Name and height, beep timing, the Groq key, Export and Import JSON (what the file is and why you would), Restore defaults, Account and signing out, the version line |
| 11 | **Your data** | Where it lives: on your device, and in your account if you sign in. What syncs and when. That the coach sends your log to Groq only when you ask it something. Feedback goes to a separate shared service. **That there is no delete-account button yet and how to get your data removed in the meantime** — through *Send feedback*, since no email address appears anywhere in the app (checked 2026-09-24); BTL-B69 records that this is a promise Ben keeps by hand until BTL-B32 ships. Links to the privacy page once BTL-B26 ships, not before |
| 12 | **Questions people ask** | Is it free? Does it work offline? Can I use it at any wall? Why does my grade say 6a when I have sent 6b? (→ chapter 4). Why did my goal complete itself? Why is my friend's grade lower than they say? Where did my session go after I edited the date? |
| 13 | **Feedback** | One paragraph and a button that opens the same widget, on this page, so a reader who has just found the thing that confused them can say so without going back to the app |

### 4.5 Template and mechanics

- Copy `pyramid.html`'s head, `:root` tokens, `.top` header, `.hero`, `.toc`, `.eyebrow`,
  `section`, `.to-top` and the 480px breakpoint. Shared CSS is **not** extracted into a file yet:
  two pages is not a pattern. When the third static page arrives (privacy, BTL-B26), pull it out.
- The header nav links the chapters by anchor and has one extra link, **Explainer →**
  `/pyramid.html`. `pyramid.html`'s header gets the mirror link, **Guide →** `/help.html`.
- The feedback button in chapter 13 needs the widget script on the page: the same `<script defer
  src="…/widget.js" data-app-id="betalog" data-accent="#4f7ef8" data-no-button="true">` tag as
  `index.html`. There is no CSP header on the site to update.
- Cache: `/pyramid.html` is not precached (the worker caches it on first visit), so `/help.html` is
  not either; the cache name is bumped with the release, v42 → v43.
- Title: **How BetaLog works**. Description meta: *Every screen and feature of BetaLog in plain
  words — logging, your grade, goals, the dashboard, coach, friends and your data.*

### 4.6 Keeping it true — the maintenance rule

The guide is only worth having while it is right, and it will go wrong the way every other doc here
has: a screen changes and the page does not. So the rule is the same one that already governs
`BACKLOG.md` and spec status lines:

> **A change that adds, removes, renames or moves anything the climber can see updates `help.html`
> in the same commit.** It joins the pre-merge checklist in `docs/guides/betalog_sdlc.md`, one line,
> next to the `BACKLOG.md` line. Copy-only edits to the guide are documentation changes and merge
> without asking, per `CLAUDE.md`.

The guide carries **no version number and no date** of its own. The app's version line in the Help
sheet is enough, and a *last updated* stamp on the page is one more thing to forget.

## 5. Feedback

Nothing new is built for feedback itself. The shared Benjuicey widget stays exactly as it is:
`window.BenjuiceyFeedback.open()`, its own categories (bug · content · request · general, per the
2026-08-10 check), submissions landing in the shared backend as `BTL-000x`. What changes is reach:
it now opens from the header on every screen, from Settings as before, and from the guide.

Two things the build must settle, both checks not code:

- **BTL-B15 is now a gate.** Making the button prominent before knowing a submission arrives is
  inviting people to shout into a bucket. One real submission from the preview deploy, seen at the
  other end, before the header button is released. Ben owns it; it is a five-minute check.
- **Can `open()` take a category?** If the widget accepts one, the sheet's feedback row could split
  into *Report a bug* / *Suggest something*, pre-filled. The widget script sits on a Worker the
  session's proxy cannot fetch, so this is checked from the browser console on the laptop. If it
  cannot, one button, the widget's own picker does the job, and nothing is lost.

## 6. Build order

Two releases, each stopped at the branch for Ben's word — both are new UI, neither is a fix.

### Release A — the guide

1. `public/help.html`, all fourteen chapters, from the template. Written against the running app,
   one screen open beside each chapter.
2. Cross-links between guide and explainer. The widget script and the feedback button on the guide.
3. Verified in the browser pane at desktop and phone width; every anchor in the nav and toc resolves;
   the feedback button opens the widget. Build, tests, lint.
4. Backlog row closed, SDLC checklist line added, `betalog_activity_help_spec.md` status header
   pointed here.

The guide can ship on its own: it is reachable at its URL and from nothing else, which is a harmless
release, and it lets Ben read the copy on a phone before the button points the world at it.

### Release B — the button

1. `HelpSheet.jsx`, `helpOpen` in `App.jsx`, the Help button in both header variants of `Nav.jsx`.
2. BTL-B15 closed (a submission seen arriving) — before merge, not after.
3. The category question (§5) answered; one row or two in the sheet accordingly.
4. Verified on the preview deploy on a phone: the header at 320px wide with four items still fits
   (the logo is 24px Barlow Condensed and the three icons are 34px each; it does, but look).

### Not in this spec

- **A first-run nudge** (a one-time *New here? →* on the Dashboard). Worth doing once the guide has
  been read by someone other than Ben; not before, and not as a pulse on the header icon.
- **What's New / version history.** The old spec's Part 4. The DEVLOG is the record and the version
  line names the build; a public changelog is a separate decision.
- **Privacy page.** BTL-B26, blocked on BTL-B31. The guide's *Your data* chapter is the honest
  interim, and is written so that the privacy page can quote it.
- **Search on the guide.** Fourteen anchors and a browser's find-in-page is enough for one page.

## 7. Decisions for Ben

| # | Question | Recommendation |
|---|---|---|
| D1 | One header button opening a two-choice sheet, or two header buttons (`?` and a speech bubble)? | **One button.** The mobile header would carry four icons otherwise, and the sheet gives each choice a sentence of explanation the header cannot |
| D2 | Fold the explainer into the guide as one long page, or keep two pages cross-linked? | **Two pages.** The guide is for week one; the explainer is for the day you argue with the dots. Merging makes both worse |
| D3 | Does the Settings *Send feedback* button stay once the header has one? | **Stays.** It costs nothing and people look for it there |
| D4 | The guide's *Your data* chapter says there is no delete-account button and gives an email. Publish that, or wait for BTL-B32? | **Publish it.** Saying so is the data-honesty rule applied to the app itself, and it is true today |
| D5 | Release A alone first (the guide live at its URL, no button), then B a day later — or both together? | **A then B.** The copy is the risk; a day of reading it on a phone is cheap |

---

## Appendix — what the old spec got right and wrong

`betalog_activity_help_spec.md` Parts 2–4, March 2026, before launch. Kept for the record; this
spec replaces them.

- **Right:** a `?` in the header, a standalone page at a public URL, guides for install and the Groq
  key, an FAQ, feedback reachable from the help page.
- **Wrong since:** a Firestore `feedback/` collection — the shared widget landed in July and made
  it moot; a *Coming Soon* section — status on a public page, retired by the backlog standard;
  `/help` as a route — it is `/help.html`, a file, like the explainer; a link-out with no sheet —
  the feedback half needs an in-app action, so the button opens a sheet, not a tab.
- **Part 1 (activity sessions)** shipped as Cardio (`betalog_cardio_spec.md`) and is not touched by
  this spec. **Part 4 (version history)** is still unbuilt and still deferred, see §6.

---

## Build record — Release A, 2026-09-24

Built the same day the recommendations were accepted (Ben: *"Looks right, go with the recommendations
and build the guide."*). Written from three read-only code sweeps — the Log tab; Dashboard, History
and Plan; Coach, Friends, Settings and data — not from the specs, per copy rule 3. What the sweeps
changed in the plan above is marked inline. What they found in the app and the guide does not hide:

- No mode without an account; no forgotten-password link (BTL-B67); Google sign-in fails inside
  the installed app on iPhone — the login screen already says so, and now the guide does too.
- The Coach is an analysis button, not a chat; the Coach tip widget calls Groq once a day on its own.
- A push notification's tap does not open the routine (BTL-B64); the calendar card's wording points
  at a tab that moved (BTL-B63); cardio goal progress differs between two screens (BTL-B65); the goal
  card's X gives no sign after its first tap (BTL-B66); a hangboard session is saved as planned even
  when ended early (BTL-B68). The guide describes what the app does, and the rows describe the fix.
- Fourteen chapters, about 5,500 words, no date, no version, no screenshots. Verified in Chromium at
  390 and 1280 px: no horizontal scroll, every in-page anchor resolves, the feedback button calls
  `BenjuiceyFeedback.open()`. Build, 744 tests and lint clean. Not yet read on a phone — that is D5.
