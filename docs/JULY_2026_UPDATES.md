# July 2026 Updates — Extraction, HOA & Calendar Sync

_Last updated: 2026-07-05_

A summary of the features added in this round, how to use each one, and how to
deploy them. Two parts of the system are involved:

- **Intake form** (`intake/intake-form.html`) — hosted on Vercel, auto-deploys on push to `main`.
- **Webhook / Apps Script** (`webhook/Code.gs`) — lives in Google Apps Script, updated by pasting the file in (see [Deploying](#deploying)).

---

## 1. Smarter contract extraction (PDF vision)

**What changed:** When you upload a contract PDF, the form now sends the **actual
PDF pages** to Claude instead of just stripped-out text. Claude can now *see*
checkboxes, initials, handwriting, and signature dates — the things plain text
extraction misses.

- Model: `claude-opus-4-8`.
- The browser-extracted text is still sent as a secondary spelling aid for names/emails.
- Requires an **Anthropic API key** saved in the form (see below).

**Requires an API key.** Under **⚙ Connection Settings → Anthropic API Key**,
paste your key (`sk-ant-…`) and click **Test** — it now saves automatically
("✓ Connected & saved"). Without a key, the form falls back to the manual
"copy into Claude chat" workflow.

**Diagnostics:** If an upload fails, a small "Extraction diagnostics" box appears
in the bottom-left corner with a step-by-step log. On successful uploads it stays
hidden.

### AS-IS default periods

The Florida AS-IS contract pre-prints a default beside each timeframe blank
("if left blank, then N days"). When a blank is empty, the extractor now fills
the default instead of leaving it empty:

| Field | Default if blank |
|---|---|
| Initial deposit / escrow | 3 days |
| Loan application | 5 days |
| Loan approval period | 30 days |
| Inspection | 15 days |
| Title commitment | 15 days (the "at least ___ days" figure — **not** the "no later than 5 days" cap) |

For **cash** deals, the loan fields are left blank.

---

## 2. Calendar buttons on date fields

Every date field (Effective Date, Closing Date, Date Submitted) has a **📅
calendar button** to pick a date, and you can still type the date manually. The
stored value stays in `YYYY-MM-DD` format, so nothing downstream changes.

---

## 3. Richer HOA capture

When a contract includes an HOA / condo association rider or addendum, the form
now detects it, checks **"HOA Application & Approval Required,"** and fills these
fields (whatever the contract provides):

- Association Name
- Management Company
- HOA Contact Name / Phone / Email
- Estoppel Fee
- HOA Application days / HOA Approval days

_Note:_ management-company contact details are often **not** in the contract
(they live on the estoppel/disclosure), so those fields may come through blank
and you fill them once you order the estoppel.

These flow into the per-property tab and the Google Sheet automatically.

---

## 4. Calendar sync — sheet date changes move calendar events

**What it does:** When you change a milestone date in a property tab (the
**"Deadline"** column), the matching Google Calendar event moves to the new date.
Use this when an extension is agreed. It moves **only** the date you change — it
does not cascade.

### One-time setup

1. Update `webhook/Code.gs` in Apps Script (see [Deploying](#deploying)).
2. In the Sheet: **🛠 TC Tools → 📅 Set up calendar sync**.
3. Approve the Google permission prompt (allow Calendar access). If you see an
   "unverified app" screen, click **Advanced → Go to [project]** — that's normal
   because it's your own script.
4. Confirm the popup says **"Calendar sync is on (v6.5)"**.

### Everyday use

- **Automatic:** change a date in a property tab → the event moves on its own.
- **Reliable backstop:** open the property's tab and click **🛠 TC Tools →
  🔄 Sync dates → Calendar**. This re-aligns every event on that tab to the sheet
  dates **and removes duplicates**, then reports what it did
  (e.g., "Updated: 10, Duplicates removed: 1"). Use this anytime the calendar
  looks off.

### How it works (for reference)

- Calendar events are titled `📌 <Milestone> — <Property Address>`.
- Each event's id is stored (keyed by tab + milestone) so it can be found and moved.
- Matching is tolerant (ignores emoji/spacing/dash differences) and searches a
  window spanning the old and new dates, so it finds the existing event instead
  of creating a duplicate; extra copies are deleted.
- Uses your **default** Google Calendar.
- Because a simple `onEdit` trigger can't touch Calendar, the automatic sync runs
  as an **installable** onEdit trigger — that's what the one-time setup installs.

---

## Deploying

### Intake form (`intake/intake-form.html`)

Hosted on Vercel. Pushing to the `main` branch auto-deploys. After it deploys,
**hard-refresh** the form (Cmd+Shift+R) to load the new version.

### Webhook / Apps Script (`webhook/Code.gs`)

Not automatic — update it by hand:

1. Open the master Google Sheet → **Extensions → Apps Script**.
2. Click `Code.gs`, select all (**Cmd+A**), and paste the full updated file over it.
3. **Save** (💾).
4. Reload the Sheet so the **🛠 TC Tools** menu refreshes.
5. Re-run **📅 Set up calendar sync** and confirm the version number in the popup
   — that's how you know the paste fully took.

---

## Version reference

- Intake form: PDF-vision extraction, AS-IS defaults, calendar buttons, richer HOA, failure-only diagnostics.
- Webhook: **v6.5** — calendar sync with tolerant matching, duplicate cleanup, and the "🔄 Sync dates → Calendar" menu button.
