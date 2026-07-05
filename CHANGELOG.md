# Changelog

All notable changes to the MRFL Transactions system are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
