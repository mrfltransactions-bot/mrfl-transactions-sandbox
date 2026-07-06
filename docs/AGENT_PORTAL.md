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

Portal links (v6.9+) have the short shape
`https://mrfl-transactions.vercel.app/portal/?a=<ref>&k=<key>` — the page
carries the webhook URL itself (`PORTAL_ENDPOINT` constant). Publishing that
URL is safe because the endpoint returns no data without a valid key: the
widget view requires `key=<widget_key>` (Script Properties; keyless GETs get
a health check only, which keeps the intake form's webhook Test green), and
the portal view requires per-agent keys. Legacy long links
(`?u=<base64url-of-webapp-url>&agent=&key=`) continue to work unchanged.
⚠️ If the webhook URL ever changes (a NEW deployment rather than a new
version), update `PORTAL_ENDPOINT` in `portal/index.html`, the stored
`portal_webapp_url` Script Property, and the widget URLs.

## Relationship to the Client Portal spec

`docs/CLIENT_PORTAL_SPEC.md` describes the full product vision (auth,
notifications, uploads, referrals). This portal is its **Phase 1 —
read-only validation**, built at zero cost on the existing
Sheet + Apps Script + Vercel stack. If agents love it, the spec remains the
roadmap for the bigger build. `portal/agent-dashboard.html` is the original
static design mockup the visual style came from.

## Updating transaction details mid-transaction

The portal is a **live view of the property tab** — it re-reads the sheet on
every open/refresh. To change any detail (title company switches, new lender,
updated phone number), edit the text **directly in that property tab**
(column A, below the milestone table). The agent sees the new value the next
time they open or refresh their portal. Rules of the road:

- Keep the `Label: value` shape — e.g. change
  `Company: Old Title LLC` → `Company: New Title Group`.
- Lines belong to the section header above them (`Loan Officer`,
  `Seller Title`, `Escrow Agent/ Title`, `HOA / Association`).
- To add a missing piece, insert a row in the right section, e.g.
  `Email: closer@newtitle.com` under the title section.
- To add a whole new section (say a lender was added to a cash-turned-financed
  deal), type the header on its own row (`Loan Officer`) and the
  `Company:` / `Contact:` / `Email:` / `Mobile:` rows beneath it.

The parser is generic — any `Label: value` row in a section shows up in the
portal, so new kinds of info work without code changes.

### HOA info arriving mid-transaction

HOA details often aren't known at contract time. Instead of hand-typing the
section, use **🛠 TC Tools → 🏘 Add / update HOA info** (webhook v6.8) with the
property tab open:

- A form asks for association name, management company, contact
  name/email/phone, and estoppel fee — prefilled if the tab already has HOA
  info. Empty fields are left out.
- Optional **HOA Application / HOA Approval deadline** dates: existing
  milestone rows are updated in place; missing ones are inserted above
  Closing Date (with a checkbox), so they appear on the dashboard and the
  agent's portal timeline.
- Script-inserted dates don't fire the calendar onEdit trigger — so when you
  save deadline dates, a popup offers to run the calendar sync **right then**
  (Yes = synced immediately with the usual summary; No = a reminder to run
  🛠 TC Tools → 🔄 Sync dates → Calendar later).
- The dashboard rebuilds automatically after saving.

## Known limits (v1)

- Read-only — no uploads, messages, or notifications (spec Phases 2–3).
- No push alerts; agents see updates when they open the page. (A weekly
  email digest from Apps Script is a feasible follow-up.)
- One link per agent-ref spelling: `Carlos_…` and `Carlitos_…` tabs would be
  treated as two different agents — keep agent refs consistent.
