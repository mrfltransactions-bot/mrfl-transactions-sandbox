# MRFL Transactions — Transaction Coordinator System

> End-to-end automation for a Florida real estate Transaction Coordinator workflow.
> Built for and operated by Gloria Grullon (MRFL Transactions).

**Version:** 1.0
**Status:** In production
**License:** Proprietary (private use)

---

## What this is

A complete pipeline that takes a real estate contract PDF and produces a tracked
transaction with calendar reminders, a live dashboard, and branded client/agent
deliverables — with minimal manual data entry.

```
Contract PDF
   │
   ▼
[ Claude extracts intake JSON ]
   │
   ▼
[ Intake form: paste JSON or upload PDF directly (artifact version) ]
   │
   ▼
[ Apps Script webhook — creates property tab + Calendar events + rebuilds dashboard ]
   │
   ▼
[ Master Google Sheet "Transactions Important Dates" ]
   │
   ▼
[ Branded deliverables: Critical Deadlines, Transaction Summary, Realtor Email, Client Email ]
```

---

## Repository structure

```
mrfl-transactions/
├── README.md                    ← this file
├── CHANGELOG.md                 ← version history
├── .gitignore                   ← what git should ignore
│
├── webhook/
│   └── Code.gs                  ← Google Apps Script (v6.1) — the engine
│
├── intake/
│   ├── intake-form.html         ← standalone HTML form (paste JSON workflow)
│   └── intake-artifact.html     ← Claude artifact version (upload PDF directly)
│
├── deliverables/
│   ├── build_portfolio.py       ← consolidated portfolio xlsx builder
│   ├── build_pdfs.py            ← per-property PDF generator
│   └── requirements.txt         ← Python dependencies
│
├── docs/
│   ├── ARCHITECTURE.md          ← how the system fits together
│   └── CLAUDE_PROJECT_SETUP.md  ← Claude Project setup guide
│
├── assets/
│   ├── logo.png                 ← MRFL Transactions logo
│   └── signature.png            ← Gloria's signature
│
└── samples/                     ← drop your own sample contracts here (gitignored)
```

---

## Quick start

### 1. Deploy the webhook (one-time, ~10 minutes)

1. Open your Google Sheet "Transactions Important Dates"
2. **Extensions → Apps Script**
3. Replace `Code.gs` content with `webhook/Code.gs` from this repo
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL — paste it into the `WEBHOOK_URL` constant in:
   - `intake/intake-form.html` (line ~30, look for `const WEBHOOK_URL`)
   - `intake/intake-artifact.html` (same)

### 2. Use the intake form

**Option A: Standalone form (works anywhere, paste JSON workflow)**

1. Open `intake/intake-form.html` in any browser
2. In Claude chat, upload a contract → "Extract intake JSON"
3. Click **Import from Claude** → paste → Apply
4. Review and **Submit**

**Option B: Claude artifact (PDF upload built in)**

1. Open the artifact in claude.ai
2. Click **Upload Contract PDF**
3. PDF.js extracts text locally, regex pre-fills ~12 fields
4. Click **Copy text + prompt** → paste in Claude chat → get JSON → Paste JSON
5. Review and **Submit**

### 3. Generate deliverables

```bash
cd deliverables
pip install -r requirements.txt
python3 build_portfolio.py    # → Transaction_Portfolio_Summary.xlsx (12 tabs)
python3 build_pdfs.py         # → 11 individual transaction PDFs
```

Both scripts read transaction data hardcoded in `build_portfolio.py` (the
`TRANSACTIONS` list near the top). Update that list when active deals change.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Webhook | Google Apps Script |
| Master sheet | Google Sheets |
| Calendar | Google Calendar |
| Intake form | HTML + vanilla JS |
| PDF parsing (artifact) | PDF.js (browser-side) |
| Document generation | Python 3 + openpyxl + reportlab |
| Brand identity | Purple/indigo (#4338CA, #8B5CF6, #312E81, #DDD6FE) |

---

## Brand

- **Company:** MRFL Transactions
- **Operator:** Gloria Grullon, Transaction Coordinator
- **Tagline:** *"I handle the details so you can focus on what you do best —
  closing deals and building relationships."*
- **Phone:** 401.282.8414
- **Email:** MRFLTransactions@gmail.com

---

## Working with Claude on this project

Set up a Claude Project per `docs/CLAUDE_PROJECT_SETUP.md`. The project's
custom instructions teach Claude the brand, workflow, and deliverable
formats — so future conversations skip the context-setting and go straight
to producing output.

For ongoing development, this repo plays nicely with **Claude Code**
(Anthropic's terminal-based agentic coding tool). See `docs/ARCHITECTURE.md`
for entry points.

---

## License

Proprietary — internal use by MRFL Transactions only. Not for redistribution.
