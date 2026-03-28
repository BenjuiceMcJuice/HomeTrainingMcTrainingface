# BetaLog — Vision & Product

This is the ideas doc. It covers what BetaLog is trying to become, the commercial
opportunity, the feature roadmap, and the thinking behind key decisions. No build
instructions here — those live in betalog_technical.md.

Repo: github.com/BenjuiceMcJuice/HomeTrainingMcTrainingface
Live: betalog.co.uk
Technical doc: betalog_technical.md

---

## What BetaLog Is

A climbing training web app built by a climber, for climbers.

Right now it:
- Logs boulder, lead, top rope, gym, and hangboard sessions
- Tracks grade progression with visual charts
- Runs structured hangboard timers with audio
- Provides an AI coach that analyses real training data
- Works offline, installable on phone home screen like a native app
- Is free, requires no account, stores data locally on device

It started as a personal tool. The question is what it becomes.

---

## The Opportunity

### The gap

Most indoor climbing gyms have nothing to offer members beyond a booking system and
a social media account. Generic fitness apps know nothing about climbing. The apps
that do exist (Vertical Life, The Crag) focus on outdoor route databases.

Nobody has nailed the combination of training tracking, gym integration, and a social
layer for indoor climbing. That is the gap.

There are roughly 600-700 indoor climbing walls in the UK. The majority are independent
or small operators with no member-facing digital product. They have members who train
regularly and want to improve, and no tool to help them do it.

### The model

B2B2C: you sell to gyms, gyms give it to members.

The climber is the end user. The gym is the paying customer. You serve both but only
one pays directly.

Why this works:
- Climbers get a free, genuinely useful app — low barrier to adoption
- Gyms get a member engagement tool without building it themselves
- You get recurring monthly revenue from gyms rather than chasing individual climbers
- The gym does your marketing by telling their members about it

### Revenue

Gyms pay a monthly subscription for the admin tools and integration features.
Members always use the app free.

Illustrative tiers (not fixed — first partner shapes the actual pricing):

| Tier    | Price       | What's included |
|---------|-------------|-----------------|
| Free    | £0/month    | Gym profile page, logo, website link in app |
| Partner | ~£99/month  | Route board, plan view wall map, member auto-onboarding, coaching profiles |
| Pro     | ~£249/month | Everything + analytics, AI coach with gym context, comp features |

Revenue at scale (illustrative):

| Gyms | Avg fee  | Annual revenue |
|------|----------|----------------|
| 5    | £99/mo   | ~£6k           |
| 20   | £150/mo  | ~£36k          |
| 60   | £150/mo  | ~£108k         |
| 65   | £180/mo  | ~£140k         |

This is gym subscription revenue only — does not include individual premium features,
white-labelling, or an eventual sale.

### Exit options

A gym acquires it and runs it as a SaaS business. They own the platform their
competitors pay to use. Rock Gym Pro started exactly this way — built by a climber
for one gym.

Sell to a larger player: gym management companies (RGP, Mindbody, Onsight Pro),
climbing brands (Lattice, Tension, Moon) wanting a digital channel, or fitness tech
companies expanding into vertical sports. Acquisition value is driven by user count,
recurring gym revenue, and quality of training data. All three grow together.

Stay independent, bring in a gym as a partner, build from there.

---

## First Gym Partner: Redpoint

A close contact owns Redpoint, a climbing gym with multiple centres. This is the
intended first partner — informal pilot, no formal contract needed initially.

Goals for the pilot:
1. Get honest usage feedback from real members
2. Get a setter's perspective on the route logging tool specifically
3. Test the route board and RGP integration with a real setup
4. Build the reference case for approaching other gyms

Multi-centre design: Redpoint having multiple centres is an asset not a complication.
It forces the data model to support multi-centre from the start, which makes BetaLog
more valuable to every group operator approached afterwards. The PoC uses one centre.
The architecture supports the rest from day one.

On naming: the app is BetaLog, not Redpoint. An app named after one gym cannot be
sold to another. BetaLog is the independent platform. Redpoint is the founding
partner. "Powered by BetaLog" is the relationship.

---

## The Route Board Feature

This is the centrepiece of the gym integration. It has two sides: the setter tool
(creating and managing routes) and the member experience (browsing and logging against
real problems on the wall).

---

## The Wall Map — Plan View

The decided approach for the visual interface is a plan view (top-down floorplan)
rather than photographs of the wall.

### Why plan view beats photos

A photo is a perspective view of one section. It distorts distances, gets occluded
by overhanging panels, looks different depending on where you stand, and requires
retaking whenever the wall is repainted or relit. For a gym with wiggly, L-shaped,
multi-level, or irregular wall layouts, a single coherent photo doesn't exist.

A plan view solves all of this:
- Wiggly, curved, or complex wall shapes map cleanly as SVG polygons
- One drawing covers the whole gym — setters and members see everything at once
- It never goes stale — the floor layout almost never changes
- Setters can see the whole wall spatially when placing a new route
- Members can orient themselves to the physical space: "I'm at the far end, that's
  the orange V5 in the corner"
- No lighting, perspective, or occlusion problems

The one thing photos do better is hold texture and character. This is handled by
the optional per-route photo attachment and the description field. A setter can
note "small crimps, start matched on the undercut" and optionally attach a single
photo of the starting holds. Members get the spatial overview from the plan and
the detail from the description and photo if provided.

### What the plan view looks like technically

The wall map is an SVG document. Each wall section is a polygon — the outline of
that section of wall as seen from above. Sections can be any shape: straight panels,
curved walls, angled corners, freestanding features, the training board in the middle
of the room.

Each section has:
- A name (Overhang, Slab, Cave, Arete, Training Board, etc.)
- An angle attribute that affects how it renders: slab is light, vertical is mid,
  slight overhang is medium-dark, steep is dark, roof is darkest. This gives the
  plan view instant visual information about wall character without needing labels.
- A colour attribute (optional gym-defined tint per section)

Routes appear as coloured dots on the plan. Dot colour matches hold colour.
Active routes are solid dots. Recently set routes have a small pulse animation.
Projected routes (member has flagged as a project) have a ring around the dot.

The whole thing is pan-and-zoomable. On a phone the member pinches to zoom into
the section they are standing in front of.

---

## The Wall Setup Tool (One-Time Admin Task)

A gym admin or head setter draws their wall once. This is a one-time task taking
roughly 15-30 minutes for a typical gym. The output is the permanent base map that
everything else sits on top of.

### Setup flow

The admin opens the wall editor (part of the gym admin dashboard, not the member
app). They see a blank canvas with a grid.

Step 1 — Draw wall sections

The admin clicks to place corner points of a wall section, then closes the shape.
A dialogue appears: name this section, set its angle (slab / vertical / slight
overhang / steep / roof), assign a label colour if desired. Repeat for each section.

For a typical mid-size climbing gym this means drawing 6-12 polygons. Most sections
are roughly rectangular — a few corner taps each. Odd-shaped or wiggly sections just
get more points. The editor snaps points to a grid to keep things clean.

Step 2 — Add landmarks

Optional but useful: add non-climbable landmarks to help orientation. Entrance,
toilets, training area, desk. These appear as labelled markers on the plan and help
members orient themselves, especially in larger gyms.

Step 3 — Preview and confirm

The admin sees the finished plan with section labels and angle shading. They can
drag points to adjust, rename sections, or delete and redraw. Once confirmed, the
plan is saved to Firestore as a JSON document describing the SVG polygons.

Step 4 — The map is live

The plan view immediately appears in the setter tool and the member route board.
It only needs editing if the gym physically restructures — which is rare. A reset
(strip holds and re-set same sections) requires no map changes at all.

### What the data looks like

```
gyms/{gymId}/centres/{centreId}/wallMap
  sections: [
    {
      id:      "overhang",
      name:    "Overhang",
      angle:   "steep",
      points:  [ [120,80], [340,80], [360,200], [100,200] ],
      colour:  null
    },
    {
      id:      "slab",
      name:    "Slab",
      angle:   "slab",
      points:  [ [400,80], [580,80], [580,300], [400,300] ],
      colour:  null
    }
    // ... more sections
  ],
  landmarks: [
    { label: "Entrance", x: 50, y: 400 },
    { label: "Training board", x: 600, y: 350 }
  ],
  canvasWidth:  800,
  canvasHeight: 500
```

Points are stored as percentages of the canvas dimensions so the map renders
correctly at any screen size.

---

## The Setter Tool — Full Flow

Once the wall map exists, logging a new route takes a setter roughly 20-30 seconds.

### Adding a route

1. Setter opens the setter view (role-gated — only visible to users with setter role)
2. They see the plan view of their centre
3. They tap anywhere on a wall section — the section highlights and a route form
   slides up from the bottom of the screen
4. The form is pre-filled with the section name. The setter fills in:
   - Hold colour (colour picker — the gym's defined circuit colours appear as chips)
   - Grade
   - Short description or starting beta (optional)
   - Their name (pre-filled from their profile)
   - Date set (defaults to today)
5. Tap Save — a dot appears on the plan at the tap location, coloured to match the
   hold colour
6. Done

The setter never leaves the plan view. The whole interaction is: tap location,
fill form, save. 20-30 seconds per route.

### Optional: attach a starting photo

After saving, the setter can optionally attach a single photo — just the starting
holds or the crux sequence. This is not required and most routes won't have one.
When present it appears in the route card that members see. Stored in Firebase Storage.

### Managing existing routes

The setter view shows all active routes as dots on the plan. Tapping an existing
dot opens the route card with an Edit and a Retire button.

Retire removes the route from the member-facing board immediately and logs the
retirement date. The route stays in history — it never disappears from data, only
from the active view.

The setter dashboard (list view alongside the plan) shows:
- All active routes sorted by age
- Routes past the configured threshold highlighted in amber (e.g. 8 weeks old)
- Routes with dropping engagement in the last two weeks flagged
- Quick retire button per row for bulk retirement at reset time

### Reset workflow (bulk retirement)

At reset time, a setter selects a section on the plan and taps "Retire all routes
in this section." A confirmation shows how many routes will be retired and lists
any that have active projects from members (so the setter can decide whether to
leave them a few more days). Confirm — all routes in that section retire at once.

Members who had a project in that section receive a notification. The section is
flagged as "freshly reset" on the plan for two weeks.

---

## Member Experience — Route Board

### Finding routes

Member opens the Log page during a session at their home centre. They see the plan
view of their gym. Coloured dots show all active routes.

Filter controls float above the map:
- Grade range slider (e.g. V3 to V6)
- Colour chips (tap to show only orange routes)
- "New this week" toggle
- "My projects" toggle (shows only routes they have flagged)

Pinch to zoom into the section they are standing in front of. The dots are large
enough to tap on mobile — each one has a tap target larger than its visual size.

### Logging a climb

Tap a dot — the route card slides up:
- Colour chip and grade prominent at the top
- Section name and days since set
- Setter name
- Description if provided
- Starting photo if attached
- Community grade consensus if enough votes exist
- List of outcomes to tap: Flash / Send / Fell / Project

Tap an outcome — the climb is logged and linked to that routeId. The dot on the
plan gets a small checkmark for the rest of the session (visual confirmation that
this route is done for today).

### Standalone logging

The toggle "Standalone" in the log view bypasses the route board entirely and
drops into the existing grade-picker experience for sessions at gyms not on the
platform, outdoor climbing, or any climb not linked to a set route.

### Location before the route board exists

There is a gap between now (no Firebase, no centres collection) and Phase 2 (route
board PoC). During this gap, users are logging real climbing sessions with no
location context attached. That data is permanently context-free once it is written.

The pragmatic bridge: a free-text `session.location` field on climb sessions,
captured at save time ("Redpoint Bristol", "Depot Leeds", "Malham Cove"). No
validation, no lookup, just a string.

**Entry point: session level. Storage: climb level.**

The user enters location once per session — one field on the save screen, not once
per climb. At save time, the location is denormalised onto every `Climb` object in
the session automatically. The user does nothing extra; every climb carries the
location in the data.

This matters for analytics. Grade data without location context is flat. With
location stamped on each climb you can ask:

- What is your V6 flash rate at Redpoint Bristol vs The Depot Leeds?
- Which centres set consistently soft or hard relative to consensus grades?
- What is your reliable sending grade at each venue you visit?
- Do you climb harder at your home wall than visiting?

This is the sandbagged vs featherbagged problem — a climber's effective grade
varies by centre. The data to answer it only exists if location is captured at
the climb level, even if it is entered at the session level.

When the centres collection exists in Firestore, `session.location` (free text)
maps to `session.centreId`, and that centreId is stamped on each climb at save
time. The free-text string remains as a display fallback for outdoor crags and
gyms not on the platform.

This means location data captured before Firebase is not wasted. It also means
the AI coach can reference "your last four sessions at Redpoint" from day one,
without waiting for full centre integration.

---

## Route Analytics — What This Unlocks

Once members log against real route IDs, the data has meaning that grade logging
alone never can.

For members:
- "You've attempted this route 4 times — you usually send at this grade in 2 visits"
- Send rate per setter style — some setters' problems suit you better
- How long routes take you to send vs. the gym average for that grade
- Which grades you flash vs. project — identifies the ceiling clearly
- Style profile building over time: compression, dynamic, crimp, sloper tendency
- Grade calibration across venues — your V6 flash rate at Redpoint vs The Depot tells you which walls set soft or hard relative to your ability. The sandbagged vs featherbagged picture emerges naturally from location-stamped climb data.

For setters:
- Send rate per route — a V5 with 90% flash rate was set soft
- Which routes get the most attempts — popular problems, worth keeping longer
- Grade distribution: are there enough V4s on the wall right now?
- Routes with dropping engagement — retirement candidates
- Community consensus grade vs. setter grade — calibration feedback

For the AI coach:
- Current wall map and active routes injected into coach prompts
- "There's a new compression problem on the overhang — exactly the style your
  recent sessions suggest you need to work. Worth projecting it before it comes down."
- Retirement alerts used as training nudges: "Your project on the cave is being
  retired Thursday — three sessions to send it"

---

## Multi-Centre Design

The Firestore structure supports multi-centre from day one even if the PoC
hardcodes one centre.

```
gyms/
  {gymId}/                       "Redpoint" as an organisation
    info/                        name, logo, subscription tier
    centres/
      {centreId}/                "Redpoint Bristol", "Redpoint Cardiff"
        info/                    name, address
        wallMap/                 SVG plan — the polygon data above
        sectors/                 section definitions (also in wallMap but queryable)
        routes/                  active and retired routes for this centre
```

For the PoC: one centreId hardcoded. The path structure already includes it.
No data migration needed when multi-centre is added.

For multi-centre: member settings gets a home centre picker. The route board
shows the selected centre. Visiting another centre is a one-tap switch. The gym
admin dashboard rolls up across all centres with per-centre breakdowns.

---

## Wall-Specific Features

Features only possible because this is a climbing wall. These are the ones that
make the gym subscription worth paying for.

### Route lifecycle management

Routes have a natural life. BetaLog manages it explicitly.

- Route appears in member view the moment it is saved by the setter
- After a configurable age threshold, flagged as aging in the setter dashboard
- Setter retires individually or in bulk at reset time
- Members with a project in that section notified before retirement
- Full historical data preserved — members can see every route they ever climbed
  including ones retired years ago

### Setter profiles

Name, setting style, difficulty tendency (does their grading run hard or soft),
typical hold types. Members can follow setters — notifications when they put up
new routes. For gyms with well-known setters this is a real engagement driver.

### Setting calendar

Setter logs planned reset dates. Triggers:
- Advance notification to members with projects on that section
- After reset: section auto-flagged as freshly set in member view
- Setter dashboard shows upcoming resets and overdue sections

### Community grade consensus

Members give a one-tap vote when logging: harder / right / softer. After enough
votes, consensus grade shown alongside setter grade. Useful calibration data
for setters. Makes grade data more trustworthy for members.

### Wall condition reporting

Members flag conditions using one-tap tags: polish on key holds, chalk build-up,
greasy conditions, loose hold. Surfaces in setter/staff dashboard. Feeds into AI
coach context.

### Recurring training circuits

Setter tags routes as part of a named circuit. Members log a circuit as a unit
rather than individual routes. Useful for gyms that run structured training nights
or beginner programmes.

### Head setter dashboard

Aggregate view across the whole wall: grade density per section, average route age,
sections overdue for reset, member traffic by area, setter workload over time.

### Member send clips

Members attach a short video to a logged send. Private by default. One tap to share
to the route's community page. Lightweight beta sharing without needing a full social
network first.

### Injury notes on routes

Members flag a route as causing discomfort. Private — only they see it. AI coach
tracks patterns: "You've flagged shoulder discomfort on three overhang routes this
month. Worth addressing before it becomes an injury."

---

## Feature Roadmap

### Phase 1 — Make it shareable (current focus)

Goal: an app someone can install and use, backed by an account.

- Firebase auth and sync — data persists across devices
- betalog.co.uk live
- App loads cleanly for a new user
- Introduce to Redpoint gym owner

### Phase 2 — Route board PoC (list view, one centre)

Goal: validate that setters will log routes and members will log against them.
No wall map yet — prove the concept first with a simple list.

Setter: add route form (sector, colour, grade, description, name, date), active list
with retire button, age flagging.

Member: route board tab in log view, filterable list, tap to log outcome, routeId
stored on logged climb.

Infrastructure: Firestore routes collection, setter role, one centre hardcoded.

### Phase 3 — Plan view wall map + friend sharing

Goal: the route board becomes a spatial representation of the actual gym. Also:
a member can share their climbing data with a friend on request, without needing
a full social graph to exist first.

Wall map:
- Wall setup tool: admin draws sections as polygons on a canvas
- Sections rendered with angle shading (slab light, roof dark)
- Routes appear as coloured dots on the plan
- Setter taps plan to place a new route
- Member taps dot to open route card and log
- Pan and zoom on mobile
- Optional per-route photo attachment

Friend data sharing:
- Member can generate a share link from their profile or history page
- Link is scoped: they choose what to share — full history, last 30 days, or
  a specific session — and whether the recipient can see grades, outcomes, both,
  or just aggregate stats ("climbed 4 times this week")
- Link is time-limited (7 days by default, configurable) and single-use or
  open-access — member's choice
- Recipient opens the link in a browser — no app install or account required to
  view. Sees a read-only summary page with the shared data
- If the recipient has a BetaLog account they can optionally add the sharer as
  a friend (which enables persistent sharing in Phase 6)
- Member can revoke any active share link from their settings at any time
- No data is visible to anyone until the member explicitly generates a link

This is deliberately minimal — no following, no feed, no social graph. Just a
climber saying "here's what I've been up to" to a specific person. It works
before Firebase auth is rolled out to friends and before the social layer exists.
It is also a natural funnel: a non-user receives a share link, sees the app,
and has a reason to sign up.

### Phase 4 — Route lifecycle tools

Goal: the gym manages the full route lifecycle without manual bookkeeping.

- Setting calendar with project retirement notifications
- Bulk retire by section at reset time
- Community grade consensus
- Setter profiles with style and grading tendency
- Head setter dashboard: grade density, section age, traffic
- Wall condition reporting from members

### Phase 5 — Route analytics

Goal: logged route data generates insight.

- Member: send rate, time-to-send, style profile
- Setter: send rates, consensus, engagement curves
- Gym: grade distribution, section traffic, retirement candidates
- AI coach: route board and setter context in prompts

### Phase 6 — Social and community

Goal: the app becomes a place where the gym community exists, not just a private log.

Two distinct things live in this phase with different build approaches.

**The public share page (share.html) — separate file, not part of the main app**

The friend data sharing introduced in Phase 3 uses a separate HTML file hosted at
betalog.co.uk/share?token=abc123. No nav, no login required, no connection to the
main app UI. A non-user opens it in any browser and sees exactly what was shared —
nothing more. Simple static HTML that reads one Firestore document by token and renders
it. Also a passive acquisition funnel: someone who has never heard of BetaLog receives
a link, sees it working, has a reason to sign up.

Phase 6 extends it: shared data can optionally include the sharer's leaderboard
position, challenge progress, and gym aggregate stats if they choose to include them.

**The community tab — new page inside the main app, not a separate file**

The leaderboard, session feed, and gym community features live inside the existing app
as a new top-level tab alongside Dashboard, Log, History, and Plan. It is a new
showPage('social', btn) destination wired into the existing nav — the same pattern
as every other page in the app. Not a separate file. Only meaningful once Firebase
auth is live and gym members are using the app. Everything is filtered to the member's
home centre. Nothing is cross-gym.

What the community tab contains:

Gym leaderboard (opt-in):
- Member explicitly opts in to appear — default is off, no one appears without choosing to
- Ranked by sessions this month, sends this month, current streak, or V-points — member picks
- Filtered to home centre by default, switchable to full gym group
- Shows display name and grade range only — no personal data visible to others
- Gym can configure which metrics appear and whether the board is visible at all

Session activity feed (opt-in):
- Members who opt in appear in a chronological feed for their gym
- Feed entries are minimal: "Jamie logged a session — 3 sends, top grade V6"
- No detailed session data visible unless Jamie has shared more via a share link
- Members can follow specific people for a filtered feed

Gym stats card:
- Aggregate numbers for the gym this week: total sessions, total sends, most popular grade,
  most attempted route on the wall
- Anonymised — no individual data visible
- Refreshes daily, not real-time (avoids expensive Firestore reads)

Challenges:
- Gym-set challenges: "Send 5 V4s this month — 12 members participating"
- Member's own progress shown against the target
- Opt-in leaderboard for challenge participants
- Gym can attach a reward: badge, free session, merch discount code

Belay partner finder:
- Member flags they are looking: grade range, usual days, rope or boulder preference
- Shows other members at the same gym also flagged as looking
- No in-app messaging — contact happens via gym reception or a gym-provided WhatsApp link
- BetaLog is not trying to be a messaging platform

Setter follow and new route notifications:
- Member follows a setter — notification when they put up new routes
- Surfaces in the community tab and as a push notification if PWA is installed

Session invites:
- Member creates an invite: "Climbing Thursday 7pm — who's in?"
- Sent to gym feed or specific followers
- Tap to indicate interest, shows a headcount
- No RSVP management, no calendar integration — simple headcount only

### Phase 7 — Multi-centre rollout

Goal: Redpoint's other centres are live, model works for any group operator.

- Centre picker in member settings
- Per-centre route boards and analytics
- Gym admin dashboard rolling up across centres
- Visiting member flow

### Phase 8 — Full AI integration

Goal: AI coach meaningfully informed by live gym context.

- Route board, setter profiles, and retirement alerts in coach prompts
- Style matching to current wall
- Gym-branded AI persona option

---

## Broader Ideas Backlog

### Training
- Structured plan builder: mesocycles
- Fingerboard max-hang tracking
- Body weight vs. performance correlation
- Injury log with pattern detection
- Warm-up protocols by session type
- Weakness analysis from movement patterns

### Climbing
- Outdoor session logging with crag, GPS, conditions
- Project tracker across sessions
- Grade calibration across gyms
- Style tagging on logged climbs

### Gym and platform
- Gym discovery for logged-out users
- Comp mode with live leaderboard on gym screen
- Coach notes on member sessions (opt-in)
- Booking integration beyond RGP
- White-label under gym's own brand

### Social
- Friend data sharing via share link — Phase 3 (separate share.html file)
- Community tab inside main app — Phase 6 (new showPage tab, not a separate file)
- Monthly gym-wide aggregate stats — Phase 6 gym stats card
- Crew: small training groups with shared stats

### Platform
- iOS and Android native apps
- Offline sync conflict resolution
- Full data export
- Third-party API

---

## Protecting the Foundation

Own the infrastructure personally:
- GitHub repo stays in your name
- Domain (betalog.co.uk) registered personally
- Firebase project under your Google account

If a developer partner joins:
- Equity split in writing before they write a line of code
- 70/30 or 60/40 in your favour — you own IP, concept, gym relationships
- Vesting over 2-3 years
- Exit terms agreed before anything else

What you bring that is hard to hire for:
- Product intuition from being an actual climber
- The check-in + training + AI loop — identified and built independently
- Warm intro to first gym partner
- Proof you can ship

---

## Decision Log

Date       Decision                                  Reason
Mar 2026   Name: BetaLog                             Beta is climbing slang for route advice. Log is the function.
Mar 2026   Not betalog.com                           Beta Systems enterprise software — trademark conflict risk.
Mar 2026   Registered betalog.co.uk                  UK focus, ~£8/year. betalog.app worth registering later.
Mar 2026   GitHub Pages hosting                      Free, auto-deploy, sufficient until Cloud Functions needed.
Mar 2026   First partner: Redpoint                   Close contact, honest feedback, real pilot environment.
Mar 2026   Keep app name separate from gym           BetaLog must be sellable to other gyms.
Mar 2026   Offline-first                             Climbing walls have poor signal.
Mar 2026   AI via Groq, user-supplied key            Zero running costs while validating the feature.
Mar 2026   Domain registered personally              Too early for Ltd.
Mar 2026   Friend sharing via link in Phase 3        Doesn't need a social graph. Works before friends have accounts. Share links are a natural new-user funnel.
Mar 2026   share.html is a separate file               Public share page has no nav, no auth, no app UI. Separate file is simpler and lets non-users view without installing anything.
Mar 2026   Leaderboard/community is an in-app tab      Lives inside the existing showPage nav — same pattern as Dashboard and History. Not a separate file. Requires auth.
Mar 2026   Route board: list/form PoC first          Validate concept before investing in map tooling.
Mar 2026   Plan view over photos for wall map        Photos distort, go stale, fail on wiggly walls. SVG plan view is stable, works at any shape, never needs retaking. Photos attached per route optionally.
Mar 2026   Per-route optional photo not per-section  Section photos go stale on repaint. A single starting-holds photo per route is always relevant to that route's lifetime.
Mar 2026   Multi-centre in data model from day one   Redpoint has multiple centres. Building it in avoids migration later.
Mar 2026   Location: entered at session level, stored at climb level   User enters one location per session (simple UX). At save time it is denormalised onto every Climb object so per-climb analytics work — grade calibration across venues, sandbagged vs featherbagged comparisons, send rate by centre. Free text now, maps to centreId when Firebase centres collection exists.

---

Last updated: March 2026
App version: v4.3
See betalog_technical.md for build instructions, code architecture, and Firebase migration.
