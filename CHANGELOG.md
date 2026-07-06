# Changelog

All notable changes to the MRFL Transactions system are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.2.0] — 2026-07-06

### Added — public reviews + playful interactive site

- **Reviews on the site** (webhook v7.4): "What agents say" section on the
  homepage. Realtors submit a review (name, optional brokerage, 1–5 star
  picker, text) → `doPost(action:'review')` saves it to a new "⭐ Reviews"
  sheet tab with **"Show on site?" unchecked**. Nothing goes public until
  Gloria ticks the checkbox (she reviews everything outbound). The site
  loads approved reviews via keyless `doGet?view=reviews` (public content
  by design; newest first, max 30). Light anti-spam: 5 submissions/hour cap.
- **Fun/interactive UI**: scroll-reveal animations, springy buttons,
  cards that lift on hover, wiggling service icons, floating hero emoji
  (hidden on phones + `prefers-reduced-motion`), count-up "24h" stat,
  bouncy star picker. Both themes re-audited: 0 contrast failures.
- Wording: "What is MRFL?" → **"Who is MRFL?"** (refer-page nav + About
  heading).

---

## [2.1.0] — 2026-07-06

### Changed — website redesign (command-center UI) + wording

- Marketing site and referral landing redesigned to a "command-center" look:
  deep-navy dark theme by default with glowing cyan/violet accents and ///
  section marks, plus a clean light theme. Theme toggle in the nav, choice
  saved and shared across both pages; all text passes contrast checks
  (4.5:1 / 3:1) in both themes. Hero gained quick stats (24h first response ·
  $0 monthly fees · $0 until closing).
- Wording: "dual agency" → **"double sided"** everywhere (site, referral
  landing, portal share message + referral card, portal/dashboard side
  labels).
- Removed the "deals close on time" claim from the About section — every
  transaction is different.

---

## [2.0.0] — 2026-07-06

### Added — public website, referral program, referral tracking

- **Public marketing site** at the domain root (`index.html`): hero, services,
  how-it-works, pricing ($500 single side / $700 double sided, pay only at
  close), about, contact CTAs (tap-to-text/call/email). Root redirect to the
  intake form removed from `vercel.json` — bookmark `/intake/intake-form.html`
  directly.
- **Referral landing page** (`refer/index.html`): personalized via
  `?from=<agent>` ("Martha invited you", "Martha's gift to you"), offer at
  50% off first transaction ($250 / $350), prefilled tap-to-text-Gloria CTAs
  mentioning the referrer.
- **Portal referral sharing**: "🎁 Refer an agent — you both save" card with
  📲 Share (native share sheet, clipboard fallback + confirmation) sending a
  prewritten colleague message with the agent's personal /refer/ link; plus a
  🎉 congrats banner when a deal closed within the last 14 days (highest-
  intent referral moment) that triggers the same share.
- **Referral tracking** (webhook v7.3): "🎁 Referrals" sheet tab
  (auto-created, status dropdown), 🛠 TC Tools → "🎁 Log a referral" dialog,
  referrals included in the operator payload, and a dashboard #referrals view
  + home row with 🎁 reward-due flags.
- Referral economics: new agent 50% off first closed deal; referrer 50% off
  their next deal when the referral's first deal closes.

---

## [1.9.1] — 2026-07-06

### Added — per-transaction print / save-as-PDF

- Agent portal: every deal card gains a "🖨 Print / save as PDF" button.
- Operator dashboard: same button in the deal detail view.
- Both open the device print dialog with a branded, print-optimized
  Transaction Overview (black on white): MRFL header, property, agent /
  side / status, key-dates table, milestone table with ✓ Completed /
  ◻ Upcoming / ⚠ Past due, all contact/detail sections, and a
  prepared-by footer with a generated-at timestamp. On phones the print
  dialog's share menu offers "Save as PDF". Front-end only — no Apps
  Script change.

---

## [1.9.0] — 2026-07-06

### Changed — dashboard v2: glass UI + full interactive drill-downs

- `dashboard/index.html` rebuilt as a single-page app in a premium
  dark-glass style (glow blobs, frosted cards, colored edge bars, day
  pills, floating bottom nav with glowing center button → opens the
  master sheet). Light theme kept; WCAG contrast audit passes both
  themes across home + detail views.
- Everything is tappable now: stat cards open filtered lists (all /
  urgent & past due / closing in 7 days), Agents opens per-agent deal
  lists, week day-pills show that day's deadlines, search filters by
  property/agent/milestone, and every deal opens a **full detail view**
  — milestone checklist plus all contact/detail sections (seller, buyer,
  agents, title, lender, HOA, concessions) with tap-to-call/email and an
  "Open sheet tab" button. Hash-based navigation so back works.
- Webhook v7.2: the operator payload now includes the parsed `details`
  sections per deal (same parser as the agent portal).

---

## [1.8.0] — 2026-07-05

### Added — operator dashboard (Gloria's overview) at /dashboard/

- `dashboard/index.html`: private all-transactions overview styled after
  modern dashboard references — dark sidebar with section anchors, greeting
  header, stat chips, portfolio-health donut, "Needs attention" rail
  (overdue + next 3 days, colored cards), 7-day deadline strip, pastel
  sticky-note deal cards with milestone checklists and per-tab
  "open sheet" links, closed deals collapsed. Dark/light toggle
  (system default, persisted); WCAG contrast audit passes both themes.
- Webhook v7.1: key-protected `?view=operator` GET returns every
  transaction across all agents (status, dates, progress, milestones,
  done counts, sheet tab links). New menu item **🖥 My dashboard link**
  generates the operator key and shows the private link.
- Fix: dark-theme danger red darkened (#E0353B → #C82A30) so white text
  meets 4.5:1 — applied to the agent portal too. Mobile horizontal
  overflow from the week strip fixed (grid min-width).

---

## [1.7.1] — 2026-07-05

### Changed — portal UI redesign + dark/light mode

- Portal restyled after a modern mobile-app reference: dark rounded hero,
  soft tinted background, floating rounded cards, icon-badge stat chips,
  amber color-block next-deadline card (red past-due variant), list-row
  milestones. MRFL indigo kept as primary accent, amber secondary.
- Dark/light mode: sun/moon toggle in the header; defaults to the phone's
  system preference, manual choice persisted per device. All colors are
  theme tokens; a programmatic WCAG contrast audit of every text element
  passes in BOTH themes (0 failures).
- Personalization pass: brand row and subline removed — the header is just
  "Hello, [name]! 👋"; "South Florida" dropped from the footer.
- Fixed a Blink quirk where transitioning var-derived backgrounds on
  html/body wedged the background mid-theme-switch (transitions removed;
  theme now switches instantly).

---

## [1.7.0] — 2026-07-05

### Added — daily deadline reminder DRAFTS for agents (webhook v7.0)

- Daily time trigger (~7 AM): for each realtor with a milestone due in 3
  days, 1 day, or today, a Gmail DRAFT is prepared (branded urgency-colored
  table + "Open your portal" button with their personal short link).
  **Nothing sends automatically** — Gloria reviews and sends each draft
  personally; the script contains no send calls (GmailApp.createDraft only).
- Menu: "🔔 Set up daily reminder drafts" (installs the trigger) and
  "🔔 Preview / create reminder drafts" (shows exactly who gets what,
  creates drafts on YES).
- Agent emails derived from each tab's represented side (override via
  `portal_email_<agentref>` Script Property); skipped agents produce a
  note-to-self draft.
- Excludes Effective Date, completed milestones, and closed/cancelled/on-hold
  deals. Portal next-deadline banner also added: milestone + property +
  tap-to-jump, red past-due variant.

---

## [1.6.0] — 2026-07-05

### Added — short portal links + invite messages (webhook v6.8.3–v6.9)

- "📋 Copy invite message" per agent in the links dialog: a friendly,
  personalized ready-to-send text with the agent's link included.
- Portal links shrink to `portal/?a=<agent>&k=<key>` — the page now carries
  the webhook URL (`PORTAL_ENDPOINT`). Legacy long links keep working.
- HOA dialog: after saving deadline dates, an in-dialog prompt offers
  "📅 Sync calendar now" (runs the sync immediately) or "Later".

### Security

- Widget GET endpoint is no longer open: widget data requires
  `key=<widget_key>` (shown in the links dialog for the one-time widget URL
  update); keyless requests return a health check only, keeping the intake
  form's webhook Test working. Required before publishing the webhook URL on
  the public portal page.

---

## [1.5.2] — 2026-07-05

### Added — HOA info mid-transaction (webhook v6.8)

- New menu item **🛠 TC Tools → 🏘 Add / update HOA info**: with a property tab
  open, a form collects association name, management company, contact
  name/email/phone, and estoppel fee (prefilled from the tab when present) and
  writes a correctly-formatted "HOA / Association" details section — replacing
  the existing one or appending a new one.
- Optional HOA Application / HOA Approval deadline dates update existing
  milestone rows in place or insert new rows above Closing Date (with status
  checkbox), so they flow to the dashboard, agent portal timeline, and — after
  running 🔄 Sync dates → Calendar — calendar reminders.
- Dashboard rebuilds automatically after saving.

---

## [1.5.1] — 2026-07-05

### Added — portal "Contacts & details" per deal (webhook v6.7)

- Each deal card now has a collapsible Contacts & details section showing
  everything extracted from the intake form: price/tax ID/financing, seller,
  buyer, listing/buyer's agents (incl. co-agents), title & escrow companies
  (both when split), loan officer/processor, HOA information, and concessions.
- Emails render as tap-to-email and phones as tap-to-call links.
- `_portalDetailsFromValues` parses the tab's details block generically
  (label/value with section headers), so new intake fields appear in the
  portal without further changes. Existing agent links keep working — only a
  Code.gs paste + new-version deployment is needed.

### Fixed

- Agent portal links are now built from a stored, known-good webhook URL
  (one-time prompt; `portal_webapp_url` in Script Properties) instead of
  auto-detecting — the script has multiple web-app deployments and detection
  could pick a stale/non-public one. The portal page now shows a clear
  "Almost ready" message if the endpoint is running a pre-portal version.

---

## [1.5.0] — 2026-07-05

### Added — Agent Portal (realtor-facing transaction view)

- `portal/index.html`: mobile-first read-only web app where each realtor sees
  their own transactions live — stats, per-deal cards with side/status pills,
  "Day X of Y" progress, next-deadline callout, and a full milestone timeline
  (done ✓ from the sheet's checkboxes, past-due, upcoming). Past deals
  collapsed. Friendly error screens; "Add to Home Screen" friendly.
  Public at `mrfl-transactions.vercel.app/portal/`.
- Webhook v6.6: key-protected `?view=portal` GET mode returning only the
  requesting agent's deals (matched by tab-name prefix, validated against a
  per-agent key in Script Properties). `extractTabData` now also returns the
  full milestones array.
- New menu item **🛠 TC Tools → 🔗 Agent portal links**: auto-generates each
  agent's private key and shows copyable personal links to share.
- Access model: private per-agent links (no logins). The public page contains
  no endpoint URL — it travels base64-encoded inside each personal link.
- `docs/AGENT_PORTAL.md` — usage, security model, endpoint contract, deploy
  steps. This is Phase 1 (read-only validation) of `CLIENT_PORTAL_SPEC.md`.

### Notes

- Apps Script `doGet` changes require a **new version** web-app deployment
  (Deploy → Manage deployments → Edit → New version), not just a paste+save.
- Discovered the production domain `mrfl-transactions.vercel.app` is public,
  while the `-git-main-` branch URL remains behind Vercel login protection.

---

## [1.4.0] — 2026-07-05

See `docs/JULY_2026_UPDATES.md` for the full usage + deploy guide.

### Added — intake form: PDF-vision extraction

- Contract upload now sends the actual PDF pages to Claude (`claude-opus-4-8`)
  so it can read checkboxes, initials, handwriting, and signature dates —
  not just pdf.js-extracted text (kept as a secondary spelling aid).
- Applies the AS-IS contract's pre-printed default periods when a timeframe
  blank is empty: escrow 3, loan application 5, loan approval 30, inspection
  15, title commitment 15. Avoids the ¶9(c) "no later than 5 days" trap and
  leaves loan periods blank for cash deals.
- On-screen "Extraction diagnostics" readout that appears only when an upload
  fails, with a step-by-step log.

### Added — intake form: HOA & date-field improvements

- Detects an HOA / condo association rider or addendum, checks "HOA
  Application & Approval Required," and captures Association Name, Management
  Company, HOA Contact Name/Phone/Email, and Estoppel Fee (in addition to the
  application/approval day fields). New fields flow to the per-property tab and
  Google Sheet.
- Calendar-picker button on every date field; manual typing still works and
  the stored value stays `YYYY-MM-DD`.

### Added — webhook v6.5: calendar sync

- Changing a milestone date in a property tab (the "Deadline" column) moves the
  matching Google Calendar event to the new date. One-to-one; no cascade.
- Created events store their id (keyed by tab + milestone) so they can be found
  and moved later; matching is tolerant of emoji/spacing/dash differences and
  searches a window spanning the old and new dates.
- New "🔄 Sync dates → Calendar" menu item (🛠 TC Tools): force-syncs every
  milestone on the open tab to the sheet dates, removes duplicate events, and
  reports what it did.
- New "📅 Set up calendar sync" menu item installs the installable onEdit
  trigger and authorizes Calendar (a simple `onEdit` trigger cannot call
  CalendarApp).

### Fixed

- Intake form: uploads fell back to manual mode because pdf.js detaches the
  ArrayBuffer it reads — the PDF is now copied so the original survives for the
  API call ("Cannot perform Construct on a detached ArrayBuffer").
- Intake form: API extraction only ran when a key was saved; the uploader now
  also uses a key typed but not yet saved, and Test now auto-saves the key.
- Calendar sync: the first version duplicated events (created a new one instead
  of moving the existing one). Fixed with tolerant matching + duplicate cleanup.

### Notes

- Intake form (Vercel) auto-deploys on push to `main`; hard-refresh to load it.
- Webhook (`Code.gs`) is updated by pasting the file into the Apps Script
  editor, then re-running "📅 Set up calendar sync" (confirm the version in the
  popup). Calendar sync needs the one-time setup + Calendar authorization.

---

## [1.3.0] — 2026-05-14

### Added — webhook v6.3 auto-PDF deliverable

- On every form submit, the webhook now ALSO exports the combined
  Transaction Summary Google Sheet as a polished PDF and saves it
  alongside the Sheet in the master sheet's Drive folder. No more manual
  "send the prompt to Claude" step to get a branded PDF deliverable.
- Single click on "Generate Output" now produces: per-property tab,
  dashboard refresh, combined Google Sheet, AND PDF version.
- PDF export uses Google Sheets' native export URL — letter size,
  portrait, narrow margins, no gridlines, fit-to-width. Output matches
  the brand identity already styled into the Sheet (indigo headers,
  lavender concession boxes, status-colored milestone rows).
- Deliverable Sheet now also trims its unused rows/columns before
  export so the PDF doesn't include 1000 rows of blank whitespace.
- API response includes new `deliverablePdfUrl` field for clients that
  want to link directly to the PDF.

### Notes

- Existing v6.2 widget endpoint and `doPost` flow are unchanged.
- First-run note: Apps Script may prompt for an additional Drive
  authorization scope when the new PDF export call runs (the script
  fetches its own export URL via `UrlFetchApp`). Approve the prompt.
- The PDF auto-export failing does NOT block form submission — it's
  wrapped in its own try/catch so the rest of the deliverable flow
  still completes if PDF export hits a transient error.

---

## [1.2.0] — 2026-05-09

### Added — webhook v6.2 GET endpoint

- GET endpoint for iPhone widget consumption. Reads the dashboard tab of the
  master sheet and returns upcoming deadlines (within N days) as JSON.
  Default window: 4 days. Optional `?days` and `?agent` query params.
  Endpoint coexists with the existing `doPost` — no breaking changes.
- `widgetTest()` function for in-editor verification before deploy.
- `docs/WIDGET_ENDPOINT.md` documenting the endpoint contract.

### Notes

- The v6.1 health-check `doGet` was replaced by the widget `doGet`. Calling
  the URL with no params still returns useful JSON (summary block), so it
  doubles as a "script is alive" signal.
- Deployment is manual — Gloria pastes the updated `Code.gs` into the Apps
  Script editor and redeploys via "Manage deployments → New version." The
  deployment URL does not change.
- Form's ⚙ Test button updated to recognize the widget response shape as a
  healthy reply (previously hardcoded to look for `status: 'ok'` from the old
  v6.1 health-check).

---

## [1.1.0] — 2026-05-07

### Added — In-form PDF extraction via Anthropic API

- `intake/intake-form.html`: optional one-click PDF → all 60+ fields extraction.
  After PDF.js extracts text and the regex prefill runs, if an Anthropic API
  key is configured the form sends the contract text to Claude Sonnet 4.6
  with the canonical extraction system prompt and applies the returned JSON
  to all matching form fields.
- New "Anthropic API Key" field in the Connection Settings panel
  (password-masked, persisted to `localStorage` under `mrfl_anthropic_api_key`).
  Includes Save and Test buttons; Test makes a tiny call to `claude-haiku-4-5`
  to verify the key is valid.
- Prompt caching enabled on the system prompt → ~90% off the system-prompt
  tokens after the first extraction in a 5-minute window. Per-extraction
  cost: ~$0.02 with cache, ~$0.04 cold.
- All existing flows preserved: if no API key is configured, or the API call
  fails for any reason (network, invalid key, malformed JSON), the form
  falls back to the existing "Copy text + prompt" manual chat workflow with
  an error toast explaining what happened.

### Fixed — Sandbox-leftover paths in Python builders

- `deliverables/build_portfolio.py`: removed hardcoded
  `/mnt/user-data/outputs/` path, now writes to `deliverables/output/`
  next to the script.
- `deliverables/build_pdfs.py`: same fix; also removed dead
  `sys.path.insert(0, '/home/claude')` line, replaced with a path to the
  script's own directory so the import of `build_portfolio` resolves
  on any machine.

---

## [1.0.0] — 2026-05-07

First production release. Captures the system as it has been running and
iterated against ~11 active transactions over multiple weeks.

### Added — Webhook (`webhook/Code.gs`, v6.1)

- `doPost` endpoint that receives intake JSON from the form
- Auto-creates a styled property tab with all parties, milestones, and contacts
- Auto-creates Google Calendar events for every milestone with reminders
  (3 days before + day-of)
- `📊 Dashboard` tab pinned to the front of the sheet
  - Three-tier sort: Active (oldest effective first) → Closed → Cancelled
  - Visual progress bar column with embedded `Day X/Y` text in status color
  - Color-coded urgency in Days Until column
  - Status dropdown per row: 🔄 Auto / 🟢 Active / ⏸ On Hold / ❌ Cancelled / ✅ Closed
  - Manual override persisted via `Manual Status:` line in property tab
- `🛠 TC Tools` custom menu (added by `onOpen`)
  - 🔄 Refresh Dashboard
  - 🔍 Show Active Only / 👁 Show All Transactions toggle
- `onEdit` trigger that auto-rebuilds the dashboard when a milestone checkbox
  is toggled in any property tab

### Added — Intake form (`intake/intake-form.html`)

- Branded HTML form with all 42 intake fields organized into sections
- "Import from Claude" modal — paste JSON, populates all fields
- Direct POST to webhook (text/plain to avoid CORS preflight)
- Required field validation before submit

### Added — Intake artifact (`intake/intake-artifact.html`)

- Claude artifact version of the intake form
- **Upload Contract PDF** button: PDF.js extracts text in browser
- Local regex pattern matching auto-fills ~10–15 fields with no network call
- Optimistic Anthropic API call for full extraction (when reachable)
- Reliable manual fallback panel with one-click "copy text + prompt" to clipboard
- Yellow highlighting on auto-filled cells for clear visual review

### Added — Deliverables (`deliverables/`)

- `build_portfolio.py` — consolidated Transaction Portfolio xlsx
  (Index tab + one tab per transaction, branded MRFL purple/indigo)
- `build_pdfs.py` — per-property branded PDFs with status badges,
  milestone tables, and concession callouts
- Reusable `TRANSACTIONS` data structure shared across both scripts

### Added — Documentation

- `README.md` — top-level project overview and quick start
- `docs/ARCHITECTURE.md` — system design and data flow
- `docs/CLAUDE_PROJECT_SETUP.md` — paste-ready custom instructions for
  setting up a Claude Project

### Brand identity

- Purple/indigo palette established:
  - `#4338CA` Indigo Deep (primary)
  - `#8B5CF6` Purple (accent)
  - `#312E81` Indigo Navy (table headers)
  - `#DDD6FE` Lavender (highlights)
  - `#F5F3FF` Purple Tint (subtle backgrounds)
- Status colors:
  - Past Due `#991B1B` · Urgent `#EF4444` · Warning `#F59E0B` ·
    On Track `#10B981` · On Hold `#F97316` · Cancelled `#7F1D1D` · Closed `#6B7280`

### Known limitations

- The artifact's direct Anthropic API call may fail with CORS/network errors
  in some artifact iframe environments — manual fallback is always available
- `build_portfolio.py` currently has transaction data hardcoded; future
  versions should read directly from the Google Sheet
- No automated tests yet
