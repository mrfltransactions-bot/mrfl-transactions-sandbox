# Changelog

All notable changes to the MRFL Transactions system are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
