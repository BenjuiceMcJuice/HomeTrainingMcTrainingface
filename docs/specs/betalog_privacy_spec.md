# BetaLog — Privacy & Data Spec

> This document covers two things:
> 1. The spec for building and maintaining the privacy page
> 2. The draft content for that page (plain English + legal policy)
>
> Last updated: 2026-03-27
> Review trigger: any new data touchpoint, new feature involving user data, or change to third-party services

---

## Build Spec

### Page location
`betalog.co.uk/privacy` — standalone HTML page, same visual style as the help page (dark theme, Barlow font, accent blue).

### Entry points
- Settings page — "Privacy & Data" link near the bottom, alongside feedback and version history
- Help page (`betalog.co.uk/help`) — linked in the footer and in a dedicated section
- App first-run / onboarding — linked during Google sign-in prompt ("By signing in you agree to our Privacy Policy")
- Share link pages — linked in the footer of every share page a recipient views

### Maintenance rule
**This page must be reviewed and updated every time any of the following happen:**
- A new third-party service is integrated
- A new data type is collected
- Friend/gym sharing features go live
- A legal entity is formed (data controller name changes)
- Gym data processing begins (controller/processor distinction changes)

Add a "Last reviewed" date visibly at the top of the page. When the page is stale it erodes trust — treat it as a living document, not a one-time task.

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

If you use BetaLog without an account, your training data stays entirely on your device — in your browser's local storage. Nothing leaves your phone or computer. We have no access to it.

If you sign in with Google, your training data syncs to Firebase (Google's cloud database) so you can access it across devices. This includes:
- Your Google display name and email address (from your Google account)
- Your session logs — climbing sessions, gym sessions, hangboard sessions
- Your exercise library and routines
- Your bodyweight log and athlete profile
- Your training schedule

We use this data to run the app and nothing else. We do not sell it, share it with advertisers, or use it for any purpose other than showing it back to you.

---

**The AI coach and Groq**

The AI coaching feature is powered by Groq, a third-party AI service. To use it, you supply your own Groq API key, which is stored locally on your device only — it is never sent to Firebase or stored anywhere we can access it.

When you ask the AI coach a question, BetaLog sends the following to Groq:
- A summary of your recent training sessions (grades, session types, frequency, effort ratings)
- Your athlete profile (name, goals, height, weight if you have entered them)
- Your question or coaching request

**Groq processes this data to generate a response and does not retain it for training their models** (subject to Groq's own privacy policy, linked below). No identifying information beyond what you have entered in your profile is sent. Your Google email address is never sent to Groq.

If you do not want any training data sent to Groq, do not use the AI coach feature. It is entirely optional.

---

**Share links**

When you generate a share link, you choose exactly what to share — a specific session, a date range, or summary stats. Only the data you select is included in the link.

Anyone with the link can view that data without an account. Links expire after 7 days by default (you can set this shorter). You can revoke any active link from your settings at any time.

We do not track who opens your share links or what they do with the data after viewing it.

---

**Feedback form**

If you submit feedback through the app, we store your message and optionally your email address (only if you provide it). We use this only to respond to your feedback. Feedback submissions are stored in Firebase and reviewed by the BetaLog developer only.

---

**What we don't do**

- We do not sell your data
- We do not show you ads
- We do not share your data with third parties except as described above (Firebase for sync, Groq for AI coaching)
- We do not use your training data to train AI models
- We do not track your behaviour across other websites

---

**Your rights**

You can:
- Export your data at any time (full data export — coming soon)
- Delete your account and all associated data from Settings
- Revoke any active share links from Settings
- Use the app without an account — no data ever leaves your device in that case

To request deletion of your data or ask any data-related question, contact: **[your email address]**

---

## Full Legal Privacy Policy

*This section follows the plain English explainer on the same page.*

---

### Privacy Policy

**Effective date:** March 2026
**Last reviewed:** March 2026
**Data controller:** [Your full name], operating as BetaLog at betalog.co.uk

> **TODO:** Update data controller name when a legal entity (sole trader or Ltd) is formed. At that point also consider whether a formal Data Processing Agreement is needed with gym partners.

---

#### 1. Who we are

BetaLog is a climbing training web application available at betalog.co.uk, operated by [Your full name] ("we", "us", "our"). We are the data controller for personal data processed through this service.

Contact: [your email address]

---

#### 2. What data we collect and why

**2.1 Account data (if you sign in)**

When you sign in with Google, we receive from Google:
- Your Google account email address
- Your Google display name
- Your Google user ID (an anonymised identifier)

Legal basis: Legitimate interests (providing account functionality and cross-device sync). You may use BetaLog without signing in — in which case no account data is collected.

**2.2 Training data**

If you are signed in, the following is stored in Firebase Firestore under your user ID:
- Session logs (type, date, grades, exercises, effort, notes)
- Exercise library and routines
- Athlete profile (name, height, weight, goals — only fields you choose to complete)
- Bodyweight log
- Training schedule

Legal basis: Contract performance (providing the service you have signed up for).

If you are not signed in, this data is stored only in your browser's localStorage on your own device and is never transmitted to us.

**2.3 AI coaching data**

When you use the AI coach, the following is sent to Groq, LLC (a third-party AI provider):
- A structured summary of your recent training sessions
- Your athlete profile fields (name, goals, height, weight if entered)
- Your coaching query

Your Google email address and user ID are never sent to Groq. Your Groq API key is stored in your browser's localStorage only and is never transmitted to Firebase or to us.

Groq processes this data as a data processor on your behalf. Their privacy policy is available at groq.com/privacy. We recommend reviewing it if you intend to use the AI coach feature.

Legal basis: Consent (the AI coach is an optional feature requiring you to supply your own API key).

**2.4 Share link data**

When you generate a share link, the selected training data is written to a time-limited Firestore document accessible via the share token. This document:
- Contains only the data you explicitly selected to share
- Expires after the period you set (default 7 days)
- Can be revoked by you at any time
- Is readable by anyone with the link (no authentication required)

We do not collect data about share link recipients. Recipients do not need an account to view shared data.

Legal basis: Consent (share links are explicitly generated by you).

**2.5 Feedback submissions**

If you submit feedback via the in-app form, we store:
- Your message
- Your email address (only if you provide it)
- Submission timestamp
- App version
- Your user ID (if signed in)

This data is used only to respond to your feedback and improve the app. It is stored in Firebase Firestore and accessible only to the BetaLog developer.

Legal basis: Legitimate interests (improving the service).

---

#### 3. Third-party services

| Service | Purpose | Data sent | Privacy policy |
|---|---|---|---|
| Firebase (Google) | Authentication and data sync | Account data, training data | firebase.google.com/support/privacy |
| Groq, LLC | AI coaching responses | Training summary, athlete profile, coaching query | groq.com/privacy |

No other third-party services receive your personal data. BetaLog does not use advertising networks, analytics platforms, or tracking pixels.

---

#### 4. Data retention

- **Account and training data:** Retained until you delete your account. Deletion removes all data from Firebase within 30 days.
- **Share link data:** Deleted automatically on expiry or immediately on manual revocation.
- **Feedback submissions:** Retained for up to 2 years or until deletion is requested.
- **localStorage data (no account):** Stored on your device only. We have no access to it and cannot delete it — use your browser's clear site data function to remove it.

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

To exercise any of these rights, contact: **[your email address]**

We will respond within 30 days. We may need to verify your identity before processing a request.

If you are unsatisfied with our response, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at ico.org.uk.

---

#### 6. Data security

Training data in Firebase is protected by:
- Firebase security rules restricting read/write access to the authenticated user's own data
- Google's infrastructure-level encryption at rest and in transit
- HTTPS for all data transmission

Share link tokens are randomly generated and time-limited. We recommend not sharing links containing sensitive training data with people you do not trust.

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

**[Your full name]**
BetaLog — betalog.co.uk
**[your email address]**

---

## TODOs — Legal Loose Ends

These are flagged for future action, not blockers now:

- [ ] **Legal entity** — when formed, update data controller name throughout. Consider sole trader registration (simple, free) even before Ltd to formalise the trading name.
- [ ] **ICO registration** — data controllers in the UK processing personal data are generally required to register with the ICO (£40/year for small organisations). Do this when gyms start paying or when member data at scale is processed.
- [ ] **Data Processing Agreements with gyms** — when a gym comes on as a partner and their members' data flows through BetaLog, BetaLog becomes a data processor for that gym (the data controller). A simple DPA is required under GDPR. Draft this before Redpoint pilot goes live with member data.
- [ ] **Data export feature** — referenced in the policy as "coming soon." Must ship before the policy states it is available.
- [ ] **Cookie policy** — Firebase Auth uses cookies/localStorage. Technically requires a cookie notice for UK users. Low priority until traffic is meaningful but worth adding to the help page.
- [ ] **Groq policy review** — confirm Groq's data retention and training data policy periodically. If Groq changes their terms, this policy may need updating.
