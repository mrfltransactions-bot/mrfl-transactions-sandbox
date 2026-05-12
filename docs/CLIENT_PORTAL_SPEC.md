# MRFL Client Portal — Product Spec

**Author:** Gloria Grullon (design) · Claude (compilation)
**Date:** May 2026
**Status:** Design complete, ready for build scoping
**Companion docs:** `ARCHITECTURE.md`, `FIRST_EMAIL_SPEC.md`, `PDF_EXTRACTION_FEATURE_SPEC.md`

---

## TL;DR

A multi-tenant web portal for the agents Gloria coordinates transactions for. Agents log in, see their active deals as timelines, upload new contracts directly, get notified of milestones, and refer fellow agents through a built-in growth loop. Gloria gets a command center (Review queue, internal notes per deal, upload-on-behalf-of-agent capability) that turns her current ad-hoc Slack/email workflow into structured intake. Built as the productized layer on top of the existing MRFL Transactions v1 (Google Sheet + Apps Script).

**Strategic frame:** This is a Path B move — productize a one-person TC service into a SaaS that can scale to 50-500 agents via referral-driven viral growth. Different from Path A (feature for the current 6 agents).

---

## Part 1: Product overview

### The problem (today)
- Agents have no visibility into their transaction status between Gloria's check-ins
- Every "where are we on X?" requires a Slack message or call
- Onboarding new agents requires Gloria's manual handholding through every contract
- No referral mechanism — growth is word-of-mouth with no tracking or incentive

### The users
- **Agents** (primary): real estate agents in South Florida who hire Gloria for transaction coordination. Examples in current portfolio: Carlos Brown, Linda Julien, Elba Rojas, Krystal, Hilda, Martha, Silvia. Multi-tenant — each agent sees only their own deals.
- **Operator** (singular for v1): Gloria. Sees everything across all agents.

### The vision
Agents have a portal that makes them feel in control of their transactions without micromanaging. Gloria has a command center that turns her inbox into a Review queue. Both sides get a notification system that replaces "did you see my text?" The referral loop creates compounding agent acquisition.

---

## Part 2: Screens

### 2.1 Agent dashboard

**Purpose:** Agent's home screen. Daily orientation tool.

**Layout:**
- Top: brand mark + "Welcome back, [name]" + prominent "Refer an agent" button + bell icon (with badge count)
- Stats row (4 cards): Active, Closing this week, Pipeline, Closed YTD
- Active deals section: one expanded card showing the most-urgent deal with full timeline + amber "next deadline" callout; remaining deals as compact rows with progress bar, day-count, next-milestone-in-plain-language
- Referral progress card (lavender bg): "Refer an agent — earn 50% off your next deal" with 3-dot progress indicator showing signups, send buttons (SMS / email / copy link)
- Nav entries: Dashboard, All timelines, Closed deals, Settings

**Key decisions baked in:**
- Day-count framing: "Day 22 of 46" (not countdown)
- Compact cards default; only the most urgent deal expanded
- Referral attribution: counts only, names hidden (privacy for inviter on their own dashboard)
- Stats card #4 = "Closed YTD" (agent's lifetime count)

### 2.2 Agent deal detail page

**Purpose:** The screen agents spend most of their time on. Replaces "let me text Gloria for X" with direct visibility.

**Layout:**
- Back-to-dashboard link
- Header: address h1, parties/price/closing-date subtitle, urgent pill (Day X/Y) right-aligned
- Timeline card: same 7-milestone horizontal component as on dashboard, with "next deadline" amber callout below
- Parties section grouped by side (Listing / Buyer / Title / Financing) with phone + email icons on each contactable row
- Documents section with colored type-coded icons (green executed contract, teal xlsx deliverables, coral disclosures), each with download action
- Recent activity feed (5 items, reverse-chronological) with relative timestamps and colored event dots
- Bottom actions: "Message Gloria" (primary), "Download all docs" (secondary)

**Key decisions baked in:**
- "Flag for review" button removed — agents message Gloria as the safety valve
- Phone + email icons on every contactable row (one tap to act)
- Activity feed at bottom, not sidebar
- Same timeline component as dashboard — consistency across views

### 2.3 All timelines view

**Purpose:** Pipeline-at-a-glance. "Where is my entire book of business?"

**Layout:**
- Header: "All timelines — 4 active deals · 2 urgent · pipeline $3.39M"
- Sort dropdown (default: closing date; alternatives: urgency, recently active)
- Vertical stack of all active deals, each as a row with:
  - Property address + parties subtitle + urgency pill
  - Full 7-milestone timeline (same component, slightly compacted labels)
  - "Next:" deadline line in plain language

**Key decisions baked in:**
- Compact label widths ("Loan apv" not "Loan approval")
- Two red urgent + two amber warning shown for realistic spread
- One outer card, rows separated by 0.5px lines (density over padding)

### 2.4 Notifications panel (bidirectional)

**Purpose:** The communication backbone. Same component, two perspectives.

**Layout:**
- Bell icon in top-right of every page; badge shows action-required count only (not total unread)
- Click → dropdown panel anchored to bell with triangle pointer
- Header: "Notifications · N unread" + "Mark all read" link + preferences gear
- List of items, each with: small purple unread dot (left), color-coded type icon, body line + context line, relative timestamp (right)
- Read items at 62% opacity
- Footer: "See all N" link → full notifications log

**Icon color taxonomy:**
- Purple: communication and referrals (notes, messages, gift)
- Amber: time-sensitive (deadlines, reminders)
- Teal: completed (milestones, documents received)
- Coral: needs attention (uploads to review, documents needed)
- Gray: passive updates (edits, system info)

**Triggers — agent receives:**
- Gloria leaves a note on their deal
- Milestone gets completed
- Document uploaded by third party (title, lender)
- Deadline approaching (3-day, 1-day reminders)
- Their referral signed up

**Triggers — Gloria receives:**
- Agent uploads document or addendum
- Agent sends message
- Agent updates contact info / makes changes
- Agent's referral signed up
- System auto-flag: deadline approaching without movement, new contract submitted

**Key decisions baked in:**
- Badge count = action-required only (informational notifications appear in list but don't bump the count)
- Persistence: 30 days, then archive
- Auto-mark-read: click navigates and marks read (Gmail/Slack pattern); hover shows "mark as unread"
- Channels (configurable per type): in-app + email default on; SMS opt-in only; daily digest option; quiet hours; per-deal mute

### 2.5 Operator console (Gloria's dashboard)

**Purpose:** Gloria's command center. Triage, not exploration.

**Layout:**
- Header: "MRFL OPERATOR CONSOLE · Welcome back Gloria · [Day], May 11 · 7 unread messages overnight"; bell with badge + avatar
- Stats row: Active (across all agents) / Closing this week / Review queue (red text if items present) / Transactions closed (Gloria's internal count)
- Review queue: dominant section. Each item has icon + description + deal context + timestamp + primary action button ("Review" / "Reply" / "Check status" / "Respond") + 3-dot menu with snooze/delegate/mark-done options
- Lavender CTA at bottom of Review queue: "Did an agent email you paperwork? Upload to deal" — opens a flow to select deal, drop file, attribute back to agent
- This week's critical deadlines: forward-looking, 4-row list with day · what · deal · agent · urgency pill
- Bottom nav: All deals, Agents, Activity log

**Key decisions baked in:**
- Review queue items persist until actioned (not just notifications)
- Snooze available on each item via 3-dot menu
- Broadcast button moved out of primary action bar (less-frequent action; lives in Agents page sidebar)
- Stats card #4 = "Transactions closed" (Gloria's count, not pipeline value)
- Subtitle "7 unread messages overnight" stays — useful overnight context

### 2.6 Operator deal detail page

**Purpose:** Gloria's deep-work view on a single deal. Agent's deal page + her private workspace.

**Layout (same agent-facing sections plus three operator-only sections):**
- Back-to-operator-console link
- Header: address + agent attribution + parties + day pill
- Timeline + next callout (identical to agent view)
- **Internal notes card** (private — amber left-border stripe + lock icon + "Private · agent can't see this" pill) with three category sections:
  - Agent compensation: structured field (split %, brokerage to bill, special arrangements)
  - Special requests: free-form bullets
  - Process notes: free-form bullets
  - "Add note" button at bottom; date stamps visible inline on each note
- **TC tasks card** (private — same amber treatment) with checkbox-based task list, priority flags, strike-through on completion. Separate from milestones (which are date-anchored, agent-facing). Auto-creation hooks when needed (e.g., "Send first email" → auto-creates "Confirm receipt with all parties")
- Documents card: new uploads highlighted (NEW pill + purple bg); two upload buttons — "Add document" (as Gloria) + "Upload on behalf of [agent]" (lavender, attributes to agent)
- Compact 2-column parties grid (denser than agent's full-width version)
- Recent activity feed (same as agent view)
- Bottom actions: "Send note to [agent]" (primary), "Send first email", "Generate deliverables"
- **"View as [agent]" toggle** (top-right) — preview what the agent sees with private sections hidden

**Key decisions baked in:**
- Date stamps on internal notes visible inline
- TC tasks auto-created when relevant operator actions trigger them
- "View as agent" toggle built in v1 (not a later feature)
- Compensation as structured field, not free text (enables commission reporting later)

### 2.7 Upload contract flow

**Purpose:** Agent's self-serve entry point. Most-important new feature for agent adoption.

**Layout — State 1 (Agent submits):**
- Back to dashboard link, then "Upload a new contract" h1
- Lavender drop zone: cloud-upload icon + "Drag your executed contract PDF here — Florida AS IS preferred · max 25MB"
- File-selected card (when file added): coral document icon + filename + "3.2 MB · 13 pages · all signatures present" + remove X. Pre-flight client-side signature scan flags missing signatures
- **Multi-file upload supported** — drop multiple files in one submission (main contract + addenda + disclosures)
- Required field: "Which side are you representing?" — three radio rows (Listing / Buyer / Dual agency) each with informative sub-text explaining what changes downstream
- Optional field: Urgency — binary 2-up (Standard / Urgent — closing within 30 days)
- Optional field: Notes for Gloria — textarea with placeholder hints (special requests, compensation, scheduling preferences)
- 3-item confirmation checklist (executed / addenda included / authorization)
- Action row: Cancel link (left), "Submit to Gloria" purple primary button (right)

**Layout — State 2 (After submission):**
- Green success banner with checkmark + filename + timestamp
- "What happens next" — 4 numbered steps with timing icons:
  1. Gloria extracts your key dates from the contract · within 24 hours
  2. Property tab created in master sheet + calendar reminders scheduled · within 24 hours
  3. First emails go out to all parties — you'll be cc'd · within 24 hours
  4. Deal appears on your dashboard · notification when ready
- Action row: "Upload another contract" (secondary), "Back to dashboard" (primary)
- **No auto-redirect** — agents stay on confirmation until they click an action

**Key decisions baked in:**
- 24-hour SLA throughout (changed from "4 business hours")
- Multi-file upload (minimize agent friction)
- Pre-flight signature scan (catches #1 cause of TC frustration)
- Auto-task created on Gloria's side: "Process new contract: [address]"
- In-app notification only (no SMS) on agent upload
- Side-represented sub-text explains what differs downstream for each option

### 2.8 Referral landing page

**Purpose:** Conversion funnel for invited agents. Standalone marketing page, different visual style from app.

**URL pattern:** `mrfl.app/r/[REFERRAL_CODE]` (e.g., `mrfl.app/r/CARLOS24`)

**Layout (in order):**
1. Top strip: "MRFL TRANSACTIONS" wordmark left, "Sign in" link right
2. **Hero** (lavender bg, centered):
   - Referrer chip: avatar circle ("CB") + "Carlos Brown invited you"
   - H1 (navy): "Your transaction coordinator, on demand"
   - Body: "Carlos uses MRFL for every deal. Sign up through his link and your first transaction is **50% off** — a gift for taking the tip from a fellow agent."
   - **CTA #1**: "Claim my 50% off →" (bigger, brighter button)
   - Fine print: "Takes 30 seconds · no card required to start"
3. **What you get** — three value cards (icons + 1-line titles + 2-line bodies):
   - Contract dates extracted in 24 hours
   - First emails go out within 24 hours
   - Reminders before every deadline
4. **How it works** (NEW) — 4-step numbered process illustration:
   1. Upload your executed contract PDF
   2. Gloria reviews and builds your timeline · within 24 hours
   3. First emails go out to all parties · within 24 hours
   4. Your dashboard goes live · you get a notification
5. **Trust strip**: "Trusted by [N] agents across South Florida · 0 missed deadlines to date"
6. **Testimonial card**: personalized quote from the referrer (Carlos's words for Carlos's invites, Hilda's for Hilda's, etc.). Avatar + quote + attribution (name · brokerage · N closed deals with MRFL)
7. **CTA banner #2** (NEW — between testimonial and pricing): "Ready to take Carlos up on his offer?" + bigger/brighter CTA button
8. **Pricing card** (lavender border, centered):
   - "CARLOS'S GIFT TO YOU" pill
   - Price comparison: ~~$400~~ → **$200** first transaction
   - Fine print: "Standard rate $400 per closed transaction · $600 for dual agency · same 50% off applies · pay only when you close · no monthly fee"
   - **CTA #3**: "Sign up — claim your 50% off →"
9. Footer: "Have questions? Talk to Gloria · MRFL Transactions · South Florida"

**Key decisions baked in:**
- Invitee discount = 50% off first deal (symmetry with referrer reward)
- Three CTAs on page (top, middle, bottom)
- All CTAs bigger/brighter than default (16px text, deeper purple #3F37A0, arrow icon)
- Personalized testimonial collected from each agent when they generate their first link
- Referrer name shown publicly here (different from internal dashboards where names are hidden — different audiences, different rules)

---

## Part 3: System spec

### 3.1 Data model (sketch)

Tables in a Postgres database (Supabase recommended for auth + RLS).

**agents** — id, name, email, phone, brokerage, license_number, referrer_code, referrer_agent_id (if signed up via link), signup_date, lifetime_closed_count, ytd_closed_count, last_active_at

**deals** — id, agent_id (FK), property_address, tax_id, purchase_price, financing_type, side_represented, effective_date, closing_date, urgency, status (active/closed/cancelled), submitted_at

**milestones** — id, deal_id (FK), type (effective/escrow/loan_app/inspection/loan_approval/title/closing), date, status (pending/done/missed), amount (for escrow)

**notifications** — id, recipient_user_id (could be agent or Gloria), type, body, deal_id (nullable FK), created_at, read_at, action_required (boolean), archived_at

**review_queue_items** — id, deal_id, agent_id, type (upload/message/request/auto_flag), description, primary_action_url, created_at, snoozed_until, completed_at, completed_by

**referrals** — id, referrer_agent_id, invitee_agent_id, referral_code, invited_at, signed_up_at, first_deal_closed_at, referrer_reward_status (pending/earned/redeemed)

**internal_notes** — id, deal_id, category (compensation/special_requests/process_notes), body, created_by, created_at, updated_at

**tc_tasks** — id, deal_id, body, priority, status (open/done), auto_created_from (nullable), created_at, completed_at

**documents** — id, deal_id, filename, file_size, page_count, type (contract/addendum/disclosure/xlsx/other), uploaded_by_user_id, uploaded_on_behalf_of_agent_id (nullable), is_new (boolean), uploaded_at

**activity_log** — id, deal_id, actor_type (agent/operator/system/third_party), actor_name, event_description, visibility (public/private), created_at

### 3.2 Notification rules

| Trigger | Recipient | Type | Channel default | Action-required? |
| --- | --- | --- | --- | --- |
| Gloria adds note to deal | Agent | purple/pencil | in-app + email | No |
| Milestone completed | Agent | teal/check | in-app | No |
| Third party uploads doc | Agent | teal/file-text | in-app + email | No |
| Deadline ≤3 days away | Agent | amber/clock | in-app + email | Yes |
| Referral signs up | Referrer | purple/gift | in-app + email | No (informational) |
| Agent uploads doc | Gloria | coral/upload | in-app | **Yes** |
| Agent sends message | Gloria | purple/message | in-app | **Yes** |
| Agent makes request | Gloria | coral/file-text | in-app | **Yes** |
| Deadline approaching without movement | Gloria | amber/clock | in-app | **Yes** |
| Agent's referral signs up | Gloria | purple/gift | in-app | No (informational) |
| Agent edits contact info | Gloria | gray/edit | in-app | No |

Badge count = sum of `action_required = true AND read_at IS NULL` only.

### 3.3 Business rules

**Pricing:**
- $400 per closed transaction (single-side representation)
- $600 per closed transaction (dual agency)

**Discount logic:**
- **Invitee** (new agent signing up via referral link): 50% off first closed transaction. Applies once. $200 single-side or $300 dual agency.
- **Referrer** (existing agent who invited others): 50% off next closed transaction after 3 of their referred agents have signed up (NOT closed — just signed up). Applies once per 3-signup tier.

**SLA:**
- 24 hours from contract upload to: (a) dates extracted, (b) property tab created, (c) first emails sent
- Notification to agent when dashboard goes live

**Attribution:**
- Documents uploaded on behalf of agent appear in agent's activity feed as if uploaded by them (with internal record of who actually uploaded)
- Referrals tracked via cookie + URL referral code on landing page
- All activity events have visibility flag (public/private) — agents see public only

### 3.4 Referral mechanics (end-to-end)

1. Existing agent (Carlos) signs up → receives unique referral code (e.g., `CARLOS24`) on first dashboard visit
2. Carlos clicks "Refer an agent" → message composer opens with pre-filled text + his unique link
3. Carlos picks channel: SMS / email / copy link
4. New agent (Maria) receives link, clicks → lands on `/r/CARLOS24`
5. Landing page reads referral code, hydrates with Carlos's name, avatar, testimonial
6. Maria clicks CTA → signup flow (separate page, not yet mocked)
7. On signup completion: insert row in `referrals` table linking Maria to Carlos
8. Carlos receives notification: "Maria signed up via your link · 1 of 3 toward your 50% off"
9. Gloria receives notification: "New referral signed up via Carlos's link" (informational)
10. When Carlos hits 3 signups → his next transaction is automatically discounted 50% at closing
11. When Maria closes her first transaction → automatically discounted 50%

---

## Part 4: MVP scope (recommended)

### Phase 1 — Read-only validation (weeks 1-3)
Goal: prove the timeline UX is valuable before investing in writes.

- Multi-tenant auth (Google Sign-in via Supabase)
- Agent dashboard (read-only, populated from existing Google Sheet via sync)
- Agent deal detail page (read-only)
- All timelines view (read-only)
- One agent at a time onboarded (start with Carlos)

**Ship to:** Carlos only. Get reaction. Iterate visual + UX.

### Phase 2 — Operator console + notifications (weeks 4-6)
Goal: replace Gloria's current ad-hoc workflow with structured intake.

- Operator console (Review queue, stats, deadlines)
- Operator deal detail (internal notes, TC tasks, upload-on-behalf)
- Bidirectional notification system (bell + dropdown + preferences)
- Bidirectional sync with existing Google Sheet (sheet remains source of truth)

**Ship to:** Gloria + 1-2 agents. Confirm the operator side is faster than current workflow.

### Phase 3 — Self-serve upload + referrals (weeks 7-9)
Goal: ship the growth loop.

- Upload contract flow (drag-drop, multi-file, side picker, notes)
- Referral mechanism (unique codes, send buttons, attribution, reward logic)
- Referral landing page (public, conversion-optimized)
- Signup flow for invited agents

**Ship to:** All current agents. Open referrals. Measure viral coefficient.

### Out of scope for v1
- Buyer/seller mini-portal (Gloria's clients' clients)
- Mobile native apps (responsive web is enough)
- Custom branding per-agent (single MRFL brand)
- Subscription billing (stay per-deal)
- Multi-operator (other TCs joining Gloria's platform)

---

## Part 5: Build paths

| Path | Time to MVP | Cost | Risk | When to pick |
| --- | --- | --- | --- | --- |
| **A. Solo + Claude Code** | 6-10 weeks evenings | $0 + your time | Medium (you can do this but it's slow) | You want full ownership, have evening capacity, can wait 2-3 months |
| **B. Contractor (Next.js + Supabase)** | 4-6 weeks | $8-15K | Low | You can fund it, want to ship fast, want clean code you can take over later |
| **C. No-code (Softr/Glide on existing sheet)** | 2-3 weeks | $30-100/mo SaaS fees | High (will need to migrate at scale) | You want max-speed validation before investing in real software |

**Recommendation:** Start with Path B if budget allows, Path A if not. Skip Path C unless you specifically want to validate demand before committing. The mockups above are detailed enough that a competent contractor can scope and build from this spec alone.

---

## Part 6: Open questions

These should be answered before contractor handoff or build kickoff.

1. **Branding** — Stays "MRFL Transactions" as the product name, or rebrands to something more platform-feeling ("MRFL Portal", "FlowOps", etc.)? Affects domain, logo, marketing copy.
2. **Pricing model evolution** — Per-deal pricing stays for v1. Does Phase 4 introduce monthly subscription tiers (e.g., $99/mo for unlimited deals at a lower per-deal rate)?
3. **Signup flow details** — What fields does the agent fill in? Email, name, brokerage, license number, phone — anything else? Auto-verification of license number via FREC API?
4. **Trust stats threshold** — At launch with 3 agents and 0 missed deadlines, do we show the strip ("3 agents · 0 missed") or hide it until double-digit agents?
5. **Testimonial collection friction** — Do we require a testimonial before an agent can generate their first referral link, or make it optional with a fallback to a Gloria-authored line?
6. **Multi-operator architecture** — V1 has one operator (Gloria). Data model should support multiple operators later (other TCs running on MRFL infrastructure) but UI doesn't need to expose it yet. How much should we future-proof the schema?

---

## Part 7: Validation plan (before building)

Before writing a line of production code:

1. **This week:** Share these mockups (or a clickable Figma version) with Carlos. Get his unfiltered reaction. Specific questions: *Would you actually use this? What would you remove? What's missing? Does the timeline visualization make sense at first glance?*
2. **Next week:** Repeat with 2 more agents (different profiles — pick one who uses tech heavily, one who doesn't).
3. **Week 3:** Show the operator console mockups to a fellow TC (a peer) — does the Review queue + internal notes pattern match their workflow needs too?
4. **Decision gate:** If 4 of 4 agents say "I'd use this," proceed to build. If < 3, iterate on the design before investing.

The mockups make this cheap. A 30-minute call per agent gets you real signal before you spend $0 (Path A) or $10K (Path B).

---

## Appendix: Related repo files

- `claude-skills/mrfl-first-email/SKILL.md` — canonical first-email format spec
- `docs/FIRST_EMAIL_SPEC.md` — mirror of the skill, for Claude Code reference
- `docs/ARCHITECTURE.md` — existing v1 architecture
- `docs/PDF_EXTRACTION_FEATURE_SPEC.md` — v1.1 extraction feature spec
- `intake/intake-form.html` — v21 intake form (the operator-side input that this portal extends)
- `webhook/Code.gs` — Apps Script webhook v6.1
- Master sheet: `Transactions Important Dates` (ID `1HmBdzF8KRWvRFa01-QqmRIi9cKHF7Bh1-pf9jeDQ_7Y`)

---

*End of spec — ~7 pages, ~3,800 words. Designed to be handed off to Claude Code, a contractor, or future-you without losing fidelity from the design conversations.*
