# Agent Portal — Realtor-Facing Transaction View

_Added 2026-07-05 (webhook v6.6 + `portal/index.html`)._

A read-only web app where each realtor sees **their own transactions live** —
milestones, what's done, what's next, and every deadline — without texting
Gloria "where are we on X?". It reads the master Google Sheet through the
existing Apps Script webhook, so whatever Gloria updates in the sheet
(including extension date changes) is what agents see, instantly.

**Public page:** `https://mrfl-transactions.vercel.app/portal/`
(useless without a personal link — see Access below).

---

## What an agent sees

- **Welcome header** with their name and a refresh button
- **Stats:** active deals · closing within 7 days · days to next deadline
- **One card per active deal:**
  - address, side (Buyer/Listing/Dual), status pill (On track / Deadline soon / Urgent / Past due)
  - "Day X of Y" progress bar from effective date to closing
  - amber "Next: [milestone] — [date] (in N days)" callout
  - full milestone list: ✓ done (from the sheet's checkboxes), red **!** past due, amber ● within 7 days, gray ○ upcoming
  - collapsible **Contacts & details** section (v6.7): everything the intake
    form extracted — purchase price/tax ID/financing, seller & buyer, listing
    and buyer's agents (incl. co-agents), title/escrow companies (both sides
    when split), loan officer & processor, HOA info, and concessions. Emails
    are tap-to-email and phone numbers tap-to-call. Parsed generically from
    the tab's details block, so new intake fields flow through automatically.
- **Past transactions** collapsed at the bottom
- Footer with Gloria's contact info

The page is mobile-first. Agents can use **Share → Add to Home Screen** on
their phone and it behaves like an app.

## Access model — private links, no passwords

- Each agent gets a **personal private link** containing a random access key.
- The Apps Script endpoint validates the key server-side and returns **only
  that agent's deals** (matched by the tab-name prefix, e.g. `Martha_…`).
- No login system to run; treat links like private Google Doc links. If a
  link leaks, regenerate the key (delete the `portal_key_<agent>` row under
  Apps Script → Project Settings → Script Properties and reshare).
- The public page contains **no** endpoint URL or secrets — everything an
  agent needs travels inside their personal link.

## How Gloria shares links

1. Open the master Sheet → **🛠 TC Tools → 🔗 Agent portal links**.
2. **First time only:** a prompt asks for the webhook URL — paste the same
   one saved in the intake form's ⚙ Connection Settings. It's stored in
   Script Properties (`portal_webapp_url`) and reused from then on.
   (Auto-detecting the URL was unreliable because the script has multiple
   web-app deployments — links must use the actively-maintained one.)
3. The dialog lists every agent (from transaction tab prefixes) with their
   personal link. Keys are generated automatically the first time.
4. Click a link to copy it, then text/email it to that agent — **only their
   own link**.
5. New agents appear in the list automatically once they have a transaction
   tab; just open the dialog again.

⚠️ **The deployment behind that webhook URL must be updated to a new version**
whenever `Code.gs` changes (Deploy → Manage deployments → the deployment whose
URL matches → ✏️ → New version). If the deployed version predates v6.6, the
portal shows an "Almost ready" screen telling Gloria exactly that.

## Deploying changes

Two halves, two deploy paths:

| Piece | Where it lives | How it deploys |
| --- | --- | --- |
| `portal/index.html` | Vercel | Push to `main` → auto-deploys. Public at `mrfl-transactions.vercel.app/portal/` (the production domain is public; the `-git-main-` URL is login-protected). |
| `webhook/Code.gs` | Apps Script | Paste the file into the editor, Save, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. ⚠️ Unlike triggers, `doGet` changes only go live after a **new version** deployment. The URL stays the same. |

## Endpoint reference

`GET {webapp}/exec?view=portal&agent=<ref>&key=<key>` →

```json
{
  "success": true,
  "agent": "Martha",
  "generated_at": "2026-07-05T21:00:00.000Z",
  "deals": [
    {
      "property": "510 SW 181st Way, Pembroke Pines, FL 33029",
      "side": "Buyer",
      "status": "urgent",
      "effective_date": "2026-06-13",
      "closing_date": "2026-07-29",
      "next_deadline": "Loan Approval Due",
      "next_deadline_date": "2026-07-06",
      "days_until": 1,
      "progress_elapsed": 22,
      "progress_total": 46,
      "milestones": [
        { "name": "Effective Date", "date": "2026-06-13", "completed": true }
      ]
    }
  ]
}
```

Bad or missing key → `{ "success": false, "error": "…" }` (the page shows a
friendly "ask Gloria for a fresh link" screen).

Portal links have the shape
`https://mrfl-transactions.vercel.app/portal/?u=<base64url-of-webapp-url>&agent=<ref>&key=<key>`
— the page decodes `u`, accepts only `script.google.com` /
`script.googleusercontent.com` endpoints, and stores the trio in
localStorage so the bookmark keeps working.

## Relationship to the Client Portal spec

`docs/CLIENT_PORTAL_SPEC.md` describes the full product vision (auth,
notifications, uploads, referrals). This portal is its **Phase 1 —
read-only validation**, built at zero cost on the existing
Sheet + Apps Script + Vercel stack. If agents love it, the spec remains the
roadmap for the bigger build. `portal/agent-dashboard.html` is the original
static design mockup the visual style came from.

## Known limits (v1)

- Read-only — no uploads, messages, or notifications (spec Phases 2–3).
- No push alerts; agents see updates when they open the page. (A weekly
  email digest from Apps Script is a feasible follow-up.)
- One link per agent-ref spelling: `Carlos_…` and `Carlitos_…` tabs would be
  treated as two different agents — keep agent refs consistent.
