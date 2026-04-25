# GovLens Finals Implementation Plan

## Goal
Ship GovLens as a truthful, Ghana-focused, AI-enabled civic accountability MVP for the finals.

## Core Product Decisions
- MPs do not unilaterally close issues. They can only claim a fix; citizens verify it.
- MP identity is gated by approval, not self-declared in open registration.
- MP onboarding is locked behind approval, invite, or whitelist instead of open self-registration.
- AI should help with intake, routing, prioritization, and accountability, not act as decoration.
- Ghana should be visible in the data model: MP as oversight owner, MMDA or agency as likely implementing authority.
- Agency escalation stays visible as a future-facing trace, but never pretends to be live.

## Tasks
- [x] Task 1: Lock the trust model.
  Verify: MP self-registration is no longer enough to gain MP powers; MP onboarding requires approval, invite, or whitelist; constituency-mismatched MP actions are rejected; guest and mock-auth shortcuts are hidden from the finals path.

- [x] Task 2: Replace the issue lifecycle with accountability states.
  Verify: valid statuses are `Reported`, `Acknowledged`, `In Progress`, `Pending Verification`, `Verified Resolved`, `Reopened`; MPs cannot jump directly to `Verified Resolved`; a resolution note is required before `Pending Verification`.

- [x] Task 3: Add citizen verification flow.
  Verify: the original reporter can confirm a fix or dispute it; disputed issues reopen with a reason; verification timestamps are stored and visible in the issue timeline.

- [x] Task 4: Rework MP metrics and approval logic.
  Verify: MP profile shows `Resolution Claims` vs `Citizen-Verified Resolutions`; approval rating updates from citizen-verified outcomes and citizen sentiment, not MP-claimed closures alone.

- [x] Task 5: Make MP actions fully persistent.
  Verify: status changes, official responses, comments, notes, and briefings survive refresh and appear consistently in a second session.
  Progress:
  - [x] Status changes persist through the API.
  - [x] Citizen verification actions persist through the API.
  - [x] Official responses and comments persist through the API.
  - [x] MP private notes and assignment persist through the API.
  - [x] Briefings persist with their published metadata through the API.

- [x] Task 6: Upgrade citizen intake into an AI-assisted flow.
  Verify: sector is AI-suggested before submit instead of being mandatory manual input; the UI shows confidence, severity, and a clear override; issue creation stores ML-enriched values cleanly.

- [x] Task 7: Add Ghana civic routing context.
  Verify: each issue can show `oversight_owner`, `likely_responsible_authority`, and committee-aware labels; the issue detail includes a truthful `Who should fix this?` card.

- [x] Task 8: Strengthen the AI story with decision-support features.
  Verify: duplicate or similar issue hints appear during submission; recurring hotspot signals appear in MP views; AI-generated briefing drafts can be created from real issue clusters but still require human review before publishing.
  Progress:
  - [x] Recurring hotspot signals appear in MP analytics views.
  - [x] Duplicate or similar issue hints appear during submission.
  - [x] AI-generated briefing drafts can be created from real issue clusters with required human review.

- [x] Task 9: Keep the future-agency trace honest.
  Verify: escalation controls remain visible but are labeled as upcoming, pilot, or planned; no screen implies an external agency has received a case unless it truly has.

- [x] Task 10: Run a finals hardening pass.
  Verify: one full demo flow works end to end: citizen submits, AI classifies, MP acknowledges, MP claims fix, citizen verifies or reopens, metrics update, and cross-constituency abuse is blocked.
  Progress:
  - [x] Backend auth and issue-flow tests pass.
  - [x] Frontend typecheck and production build pass after the finals-path changes.
  - [x] One live end-to-end demo run was executed against running services.

## AI Features To Prioritize
- AI-assisted classification: sector, severity, confidence.
- AI-assisted routing: likely Ghana MMDA or agency plus relevant parliamentary committee.
- AI duplicate detection: warn when a similar issue already exists nearby.
- AI hotspot detection: recurring zone x sector patterns for MPs.
- AI briefing generation: summarize clusters and response needs for MP offices.
- AI trust signals: flag unresolved sentiment after closure claims and separate claimed vs verified performance.

## Stretch If Time Allows
- Voice-to-text issue submission with support for Ghana-relevant language expansion.
- Image-assisted evidence tagging for potholes, flooding, refuse, broken streetlights, and similar civic scenes.
- Spam, bot, and manipulation detection on repeated reports or suspicious engagement.
- Parliament-directory-assisted MP verification workflow.

## Explicit Non-Goals For This Finals Build
- Real inter-agency API integrations.
- Full national government workflow orchestration.
- Fully automatic MP verification with no human oversight.
- AI deciding truth on its own without citizen verification.

## Critical Path
1. Trust model
2. Accountability lifecycle
3. Citizen verification
4. Metrics rewrite
5. Persistent MP actions
6. AI-assisted intake
7. Ghana routing layer
8. Demo hardening

## Done When
- [x] GovLens tells the truth about who is verified, what is AI-derived, and what is still future-facing.
- [x] Judges can follow one complete accountability story without hitting prototype-only behavior.
- [x] The AI features feel necessary to the product, not bolted on for presentation value.
