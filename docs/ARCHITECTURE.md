# Architecture

This document explains how the four components of the MRFL Transactions system
work together. Read this when you need to extend or debug the system.

---

## High-level data flow

```
┌─────────────────┐
│  Contract PDF   │
└────────┬────────┘
         │ uploaded by Gloria
         ▼
┌─────────────────────────────────┐
│  Claude (chat or artifact)      │
│  Extracts intake JSON in        │
│  STRICT mode using project      │
│  custom instructions            │
└────────┬────────────────────────┘
         │ JSON
         ▼
┌─────────────────────────────────┐
│  intake-form.html               │
│  intake-artifact.html           │
│                                 │
│  Form populated, reviewed       │
│  by Gloria                      │
└────────┬────────────────────────┘
         │ POST (text/plain to avoid CORS preflight)
         ▼
┌─────────────────────────────────┐
│  webhook/Code.gs (Apps Script)  │
│                                 │
│  doPost():                      │
│   1. Create property tab        │
│   2. Compute milestones         │
│   3. Create Calendar events     │
│   4. Rebuild dashboard          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Google Sheet                   │
│  "Transactions Important Dates" │
│                                 │
│  📊 Dashboard (sorted, styled)  │
│  Carlitos_1001 NW 148th St...   │
│  Serf_5024 Gambero Way...       │
│  ...                            │
└────────┬────────────────────────┘
         │ read by deliverable scripts when needed
         ▼
┌─────────────────────────────────┐
│  deliverables/                  │
│  build_portfolio.py → xlsx      │
│  build_pdfs.py → 11× PDFs       │
└─────────────────────────────────┘
```

---

## Component reference

### 1. `webhook/Code.gs` — the engine

A Google Apps Script web app that exposes a single POST endpoint. Triggered by:

- Form submissions from `intake-*.html`
- `onOpen` (sheet load) — installs the `🛠 TC Tools` menu
- `onEdit` — listens for milestone checkbox toggles and dashboard status
  dropdown changes

Key functions:

| Function | Purpose |
|----------|---------|
| `doPost(e)` | HTTP entry point. Parses JSON and calls `processIntake()` |
| `doGet(e)` | Returns the version banner so deployment can be verified |
| `processIntake(data)` | Creates property tab, calendar events, rebuilds dashboard |
| `rebuildDashboard()` | Reads every property tab and produces the dashboard |
| `getManualStatus(sheet)` | Reads `Manual Status:` line from a property tab |
| `setManualStatus(sheet, value)` | Writes/updates `Manual Status:` line |
| `onOpen(e)` | Installs the TC Tools menu |
| `onEdit(e)` | Detects relevant edits and triggers refresh/override |

Tab naming convention: `<AgentRef>_<PropertyAddress>`

### 2. `intake/intake-form.html` — standalone form

Pure HTML/CSS/JS. Works in any browser. Designed to be hosted at
[claude.site](https://claude.site) or simply opened locally.

- 42 form fields matching the intake JSON schema
- "Import from Claude" modal accepts JSON paste (with or without code fences,
  trailing commas, partial objects)
- Submits via `fetch` with `Content-Type: text/plain` to avoid Apps Script's
  CORS preflight limitation

### 3. `intake/intake-artifact.html` — Claude artifact version

Same form layout as the standalone, but adds:

- PDF.js loaded from `cdnjs.cloudflare.com` for in-browser text extraction
- Local regex pattern matching for the easy fields (address, parties, prices,
  dates) — populates ~10–15 fields without any network call
- Optimistic Anthropic API call for full extraction
- Manual fallback panel with one-click "copy text + extraction prompt to
  clipboard" when the API isn't reachable

### 4. `deliverables/` — document generation

Python scripts using openpyxl (spreadsheets) and reportlab (PDFs).

- `build_portfolio.py` — defines the master `TRANSACTIONS` list and produces
  a single xlsx with an Index tab plus one tab per transaction
- `build_pdfs.py` — imports `TRANSACTIONS` from the portfolio script and
  produces one branded PDF per transaction with status badge, milestones
  table, parties, contacts, and concessions

Today these scripts are run manually with the `TRANSACTIONS` list updated
by hand. A future iteration could read directly from the Google Sheet.

---

## Intake JSON schema

The contract between the extractor (Claude) and the webhook is a single
JSON object with these 42 keys:

| Field | Type | Notes |
|-------|------|-------|
| `agent_ref` | string | Tab prefix (e.g., `Carlitos`, `Serf`, `Krystal`) |
| `side_represented` | string | `Listing Side (Seller's Agent)` / `Buyer Side (Buyer's Agent)` / `Both (Dual Agency)` |
| `prop_address` | string | Full address |
| `prop_tax_id` | string | Folio number |
| `purchase_price` | string | `$XXX,XXX.XX` format |
| `financing_type` | string | `Cash` / `Conventional` / `FHA` / `VA` / `Other` |
| `loan_days` | string | Loan approval period (blank = 30) |
| `effective_date` | string | `YYYY-MM-DD` |
| `closing_date` | string | `YYYY-MM-DD` |
| `escrow_amount` | string | `$X,XXX.XX` format |
| `escrow_days` | string | Days after effective (blank = 3) |
| `inspection_days` | string | Inspection period (blank = 15) |
| `loanapp_days` | string | Loan application period (blank = 5) |
| `title_days` | string | Days prior to closing (blank = 15) |
| `seller_names` | string | Full legal names |
| `seller_email`, `seller_phone` | string | Contact info |
| `lst_agent_*` | string | Listing agent name/lic/phone/email |
| `lst_brokerage`, `lst_office_addr`, `lst_office_phone` | string | Brokerage info |
| `buyer_names` | string | Full legal names |
| `buyer_email`, `buyer_phone` | string | Contact info |
| `byr_agent_*` | string | Buyer's agent name/lic/phone/email |
| `byr_brokerage`, `byr_office_addr`, `byr_office_phone` | string | Brokerage info |
| `byr_title_*` | string | Title/escrow company/contact/email/phone |
| `lo_*` | string | Loan officer company/contact/email/phone |
| `concessions` | array of strings | Each concession on its own line |

Empty strings (`""`) are valid — STRICT mode means "leave blank if not in contract."

---

## Where to make changes

| Want to... | Edit |
|------------|------|
| Change milestone calculation logic | `webhook/Code.gs` → `processIntake()` |
| Adjust dashboard sort or columns | `webhook/Code.gs` → `rebuildDashboard()` |
| Add a new field to the form | Both intake HTML files + `webhook/Code.gs` write logic |
| Change the brand colors | Search-replace `#4338CA` etc. across the repo |
| Change deliverable layout | `deliverables/build_portfolio.py` or `build_pdfs.py` |
| Change Claude's extraction behavior | `docs/CLAUDE_PROJECT_SETUP.md` (custom instructions) |

---

## Future ideas (not in v1)

- Auto-pull transaction data from the Google Sheet into the deliverable scripts
  (eliminates the manual `TRANSACTIONS` list)
- Email auto-send via Apps Script (eliminates the copy-from-HTML step)
- Weekly digest email summarizing upcoming deadlines
- Per-agent and per-month dashboard filter variants
- Logo embedded in PDF headers
- Form field for additional escrow amount (currently optional in webhook only)
