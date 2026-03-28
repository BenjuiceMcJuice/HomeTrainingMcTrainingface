# BetaLog — Partner Overview

*For climbing centre owners and their teams.*
*This document covers what BetaLog is, what it can do for your members today, and what a gym integration unlocks. Commercials are a separate conversation.*

---

## What BetaLog Is

BetaLog is a climbing training app built by a climber, for climbers. Members install it on their phone like a native app — no app store, just a link — and use it to log sessions, track progress, run hangboard timers, and get AI coaching based on their real training data.

It is free for members. It requires no account to start using. Data is stored privately on the member's own device.

It is already live at **betalog.co.uk**.

---

## What Members Can Do Right Now

These features are built and working today.

### Session logging
Members log every type of training in one place:
- **Bouldering, lead, and top rope sessions** — discipline, grades, outcomes (flash, send, attempt, project), notes
- **Gym training sessions** — exercises, sets, reps, weights, linked to a personal routine library
- **Hangboard sessions** — structured timer with audio cues, configurable grips and protocols

### Personal exercise and routine library
A full library of exercises with coaching notes, categorised by muscle group. Members can build and save their own training routines. Gym training can be pre-programmed or logged ad-hoc.

### Progress tracking
Grade progression over time. Session history with full breakdown. Streak tracking. Everything a motivated climber wants to see about their own training.

### Hangboard timer
Structured timer for finger training protocols. Configurable grip type (crimp, open hand, slab, pinch), hang and rest durations, sets and reps. Audio countdown and phase cues. Works fully offline — important inside climbing walls where signal is poor.

### AI coaching
Four distinct coaching personas with different personalities and approaches. Each analyses the member's actual session data to give relevant, personalised feedback. Powered by Groq (fast, free for the member to access with their own API key).

---

## What a Gym Integration Unlocks

The following features require a gym to be on the platform. They are designed to work together, and they create something no generic fitness app can offer: a training tool that knows the actual wall the member is climbing on.

### Route board — members log against real routes

Members visiting your centre open BetaLog and see your active routes. They tap a route and log their outcome: Flash, Send, Attempt, or Project. That outcome is stored against the specific route ID.

This is the foundation everything else builds on. Once climbs are linked to real routes rather than just grades, the data becomes meaningful in ways it never was before.

**For members:**
- Their history shows not just "sent a V6" but which V6, how many attempts it took, how long they projected it
- They can flag a route as a project and get a reminder before it comes down
- Grade calibration across different centres — "your V6 flash rate here vs at other gyms" tells them something real about how your wall is set

**For setters:**
- See how members are actually performing on every route you set
- Flash rate, attempt distribution, average attempts to send — per route, not per grade
- Know immediately if a problem is set soft, set hard, or just unpopular
- See which routes get the most traffic and which are being ignored

### Wall map — a plan view of your centre

Rather than photos (which go stale, distort, and never cover the whole gym), BetaLog uses a top-down plan view of the wall. Each section is drawn once as a simple shape. Sections are shaded by wall angle — slabs are light, roofs are dark — giving instant visual information about wall character.

Routes appear as coloured dots on the plan matching their hold colour. Members pinch to zoom into the section they are standing at. Tapping a dot opens the route card.

**Why this works in practice:**
- The plan view never goes stale — the floor layout almost never changes
- It works for any wall shape: wiggly sections, overhangs, freestanding features, L-shaped layouts
- Setters can see the whole wall at once when placing new routes and thinking about grade distribution
- Members can orient themselves to the physical space: "the orange V5 is in the far corner of the cave"

### Setter tools

The setter experience is designed to be fast. Adding a route from the wall map takes roughly 20–30 seconds:

1. Tap the wall section you just set on
2. Fill in hold colour, grade, description (optional), your name, date
3. Save — the dot appears on the plan immediately

Setters get a dashboard showing all active routes sorted by age, routes past their threshold flagged, send rates per route, and community grade consensus against their set grade. Retiring a route (or bulk-retiring a section at reset time) is a single action.

**Planned reset workflow:** at reset time, select a section, tap "Retire all routes here." Members with active projects in that section receive a notification before the routes come down.

### Member engagement and promotions

Once members are actively using BetaLog at your centre, the platform enables engagement mechanics that generic apps cannot.

**Challenges**
Set gym-wide or cohort challenges: "Send 5 V4s this month," "Complete the summer circuit," "Hit a new grade PB before the end of September." Members see their progress against the target. You see participation rates. Challenges can carry a reward — a free session, a discount code, a badge.

**Freshly set notifications**
Members who follow specific setters (or opt in to wall notifications) get a push notification when new routes go up. For gyms with well-known or popular setters this is a genuine engagement driver — members come in specifically because they know the wall is fresh.

**Project retirement alerts**
When a reset is approaching, members with active projects on that section get a heads-up: "Your project on the cave comes down Thursday — two sessions left to send it." This drives footfall around reset windows rather than the quiet period before one.

**Leaderboards (opt-in)**
Members explicitly choose whether to appear on the gym leaderboard. Those who do are ranked by sessions this month, sends, current streak, or grade points — member's choice. Visible to other opted-in members at the same centre. Nothing is shown without the member choosing to be there.

### Management information — what the data tells you

This is where the gym side becomes genuinely useful beyond member experience.

**Route analytics**
- Send rate per route and per grade — which problems are working and which are not
- Average attempts to send across the membership — calibration signal for setters
- Grade distribution on the wall right now — are there enough V4s? Too many V2s?
- Community consensus grade vs. setter grade — aggregate member feedback on every route, passively collected
- Route engagement curves — how does traffic on a route change over its lifespan?

**Member behaviour**
- Visit frequency trends — are members coming in more or less over time?
- Grade progression across the membership — how is the community improving?
- Most active training periods by day and time — useful for scheduling coaching sessions and classes
- Retention signal — members whose visit frequency is dropping, before they churn

**Wall condition feedback**
Members can one-tap flag conditions: polish on key holds, chalk build-up, greasy conditions, a loose hold. Surfaces in a staff dashboard. Catches hold issues between staff inspections without requiring members to find someone to tell.

**AI coach with gym context**
The AI coach (already working for members today) can be given context about your current wall: which routes are active, which grades are on, which setters are setting. It can then give members advice that is specific to your centre:

- "There's a new compression problem on the overhang that matches exactly what your recent sessions suggest you need to work — worth projecting it before the reset."
- "Your project on the cave is coming down Thursday. Here is what your last three attempts tell us about what to try next."
- "You tend to underperform on slabs relative to your ability — there are three new slab problems set this week, good time to address it."

This is not generic fitness AI. It is coaching that knows the actual wall.

---

## Grade Calibration Across Centres

One feature worth calling out specifically because it is hard to find anywhere else.

Once members have logged sessions at multiple centres with location attached, BetaLog can show them how their grades compare across venues. A member's V6 flash rate at one gym vs. another reveals whether a wall grades consistently soft or hard relative to consensus. Over time, with enough members logging at multiple centres, this becomes a meaningful calibration signal — not just for individual members, but for setters who want to know how their grading sits relative to other walls in the network.

For a multi-centre operator, this is particularly useful: consistent grading across centres is something members care about and comment on. Having data to inform that conversation is valuable.

---

## What Is Already Built vs. What Requires Integration

| Feature | Status |
|---|---|
| Session logging (climb, gym, hangboard) | ✅ Live now |
| Exercise and routine library | ✅ Live now |
| Grade progression and history | ✅ Live now |
| Hangboard timer with audio | ✅ Live now |
| AI coaching (member's own API key) | ✅ Live now |
| Account and cross-device sync | 🔧 In development |
| Session location tagging | 🔧 In development |
| Route board (list view, one centre) | 📋 Designed, ready to build |
| Wall map plan view | 📋 Designed, ready to build |
| Setter tools | 📋 Designed, ready to build |
| Route analytics and MI dashboard | 📋 Follows route board |
| Member challenges and promotions | 📋 Follows route board |
| AI coach with gym context | 📋 Follows route board |
| Leaderboards and community features | 📋 Phase after route board |
| Multi-centre dashboard | 📋 Designed from day one |

The route board and everything that follows it requires a gym to be actively using the platform — setters logging routes is the foundation all the analytics builds on. The earlier a gym comes on, the more historical route data and member behaviour data accumulates.

---

## The Pilot

The intended first step is a focused pilot at one centre. No full rollout, no commitments beyond trying it. The goals are:

- Get real setter feedback on the route logging flow (is 20 seconds realistic? what is missing?)
- Get real member feedback on logging against routes vs. standalone grade logging
- Understand what MI a head setter or ops lead actually wants to see
- Build the reference case that shows it works with real members on a real wall

The first partner shapes the product. Features that matter to that gym get prioritised. The data model is designed to support multi-centre from day one, so nothing built in a pilot needs to be thrown away when more centres come on.

---

*BetaLog is an independent platform — not named after any one gym, not owned by any one gym. The relationship is "Powered by BetaLog." This is intentional: it means the platform can grow across operators, and the data and tools are yours to use, not locked to a vendor relationship.*

*Last updated: March 2026*
