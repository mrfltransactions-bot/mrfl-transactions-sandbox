# July 2026 Updates — Agent Portal, HOA Workflow & Reminder Drafts

_Last updated: 2026-07-05 · Companion to `JULY_2026_UPDATES.md` (extraction &
calendar sync) and the technical reference `AGENT_PORTAL.md`._

This round built the **realtor-facing side** of the system: a live transaction
portal for each agent, tools for keeping it accurate mid-transaction, and a
morning reminder-drafts routine. Versions: webhook **v6.6 → v7.0**, portal page
`portal/index.html`.

---

## 1. Agent Portal — a live app for each realtor

**What it is:** each realtor gets a **personal private link** that opens a
mobile-friendly page showing *their* transactions only — live from the master
sheet:

- Stats: active deals · closing within 7 days · next deadline
- **Next-deadline banner**: what's due, when, and for which property — tap it
  to jump to that deal. Turns **red** if something is past due.
- One card per deal: side + status pills, "Day X of Y" progress bar, amber
  next-deadline callout, and the full milestone timeline (✓ done from the
  sheet's checkboxes, red ! past due, amber ● within 7 days)
- **Contacts & details** (tap to expand): everything from the intake form —
  price/tax ID/financing, seller, buyer, agents & co-agents, title companies
  (both when split), loan officer/processor, HOA info, concessions. Emails
  are tap-to-email, phones tap-to-call.
- Past transactions collapsed at the bottom; refresh button; auto-refreshes
  when reopened.

**Phone tip for agents:** open the link → Share → **Add to Home Screen** — it
behaves like an app.

**Because it reads the sheet live**, anything you change on a property tab
(dates after an extension, a new title company, added HOA info) appears in the
agent's portal on their next open/refresh. The sheet stays the single source
of truth.

### Sharing links

**🛠 TC Tools → 🔗 Agent portal links**

- Every agent (from tab prefixes like `Martha_…`) is listed with their link —
  short form: `…/portal/?a=Martha&k=xxxxxxxx`.
- **📋 Copy invite message** — a friendly, personalized ready-to-send text
  with the link included. Paste into a text or email.
- ⚠️ Only send each agent **their own** link. If a link leaks, delete that
  agent's `portal_key_…` row in Apps Script → Project Settings → Script
  Properties and share the newly generated link.
- New agents appear automatically once they have a transaction tab.

### Security notes

- No logins/passwords — private keyed links, validated server-side; each key
  returns only that agent's deals.
- The widget endpoint is **no longer open**: widget data needs your widget
  key (the yellow box in the links dialog holds your updated widget URL).
  Keyless requests return a harmless "webhook is live" check, so the intake
  form's Test button stays green.

---

## 2. Keeping transaction details accurate mid-deal

**Edit the property tab directly** — the portal mirrors it:

- Change any `Label: value` line (e.g. `Company: Old Title LLC` →
  `Company: New Title Group`) under the right section header.
- Add missing lines (e.g. `Email: closer@newtitle.com`) or whole sections
  (type the header, e.g. `Loan Officer`, then `Company:` / `Contact:` /
  `Email:` / `Mobile:` rows under it).

### HOA information arriving late (very common)

**🛠 TC Tools → 🏘 Add / update HOA info** (with the property tab open):

- Form asks for association name, management company, contact
  name/email/phone, estoppel fee — prefilled if the tab already has HOA info.
  Empty fields are simply left out.
- Optional **HOA Application / HOA Approval deadline dates** update or insert
  the milestone rows (above Closing Date, with checkbox) — so they show on
  the dashboard and the agent's timeline.
- If you saved dates, the dialog then offers **📅 Sync calendar now** (one
  click, shows the Updated/Created summary) or **Later** (reminder of the
  menu button). Dates written by the form need this sync because they don't
  trigger the automatic calendar watcher.

---

## 3. Morning reminder drafts (nothing sends automatically)

Every morning (~7 AM), the system prepares **Gmail drafts** — one per realtor
who has a milestone due in **3 days, 1 day, or today**:

- Branded email: urgency-colored deadline table (red DUE TODAY / amber
  upcoming), property names, and an "Open your portal →" button with their
  personal link.
- **Your routine:** Gmail → Drafts → review/edit → hit Send on the ones you
  approve. Delete any you don't want.
- If an agent's email can't be found, you get a **note-to-self draft**
  flagging them (fix: make sure their `Agent Email:` line is on their tab, or
  set Script Property `portal_email_<agentref>`).
- The script **cannot send email** — it contains zero send commands, only
  draft creation. Google's permission screen words Gmail access broadly;
  the behavior is drafts-only.

**Menu items:**

| Item | What it does |
| --- | --- |
| 🔔 Set up daily reminder drafts | One-time: installs the ~7 AM trigger (approve the Gmail permission when asked) |
| 🔔 Preview / create reminder drafts | Shows exactly who would get what today; creates the drafts on Yes |

**What counts as a reminder:** uncompleted (unchecked) milestones due in
3/1/0 days on active deals. Excluded: Effective Date, checked-off milestones,
Closed/Cancelled/On-hold deals, and overdue items (the portal's red banner
covers those).

---

## 4. Deploy cheat-sheet

| Change | How it goes live |
| --- | --- |
| Portal page (`portal/index.html`) | Push to `main` → Vercel auto-deploys. Agents just refresh. |
| Menus, dialogs, triggers in `Code.gs` | Paste into Apps Script → **Save**. That's it. |
| The web endpoint (`doGet`) in `Code.gs` | Paste + Save **and** Deploy → Manage deployments → your deployment → ✏️ → **New version** → Deploy. The portal shows "Almost ready" if this step was missed. |

Key Script Properties (Apps Script → Project Settings → Script Properties):

- `portal_webapp_url` — the webhook URL links are built from (delete to re-prompt)
- `portal_key_<agentref>` — an agent's private key (delete to revoke + regenerate)
- `portal_email_<agentref>` — optional email override for reminder drafts
- `widget_key` — the key protecting widget data

⚠️ If the webhook URL ever changes (a brand-NEW deployment instead of a new
version), three things must be updated: `PORTAL_ENDPOINT` in
`portal/index.html`, the `portal_webapp_url` property, and your widget URL.

---

## 5. What's deliberately not included (yet)

From `CLIENT_PORTAL_SPEC.md` (the full product vision), still future work:
agent uploads through the portal, in-app messaging/notifications, referral
links, and true phone push notifications (needs real backend infrastructure).
The portal built here is the spec's **Phase 1 (read-only validation)** — if
agents love it, the spec is the roadmap for the rest.
