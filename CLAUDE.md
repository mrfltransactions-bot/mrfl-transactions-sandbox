# CLAUDE.md — MRFL Transactions project context

_Last full update: 2026-07-07 (system v2.5.0, webhook v7.6). Keep this file
current whenever a feature ships — it is the canonical context/backup for
future sessions._

**Business facts:** pricing $500 single side / $700 double sided (Gloria's
preferred term — never say "dual agency" in user-facing copy), per closed
transaction, pay-only-at-close, no monthly fee. Referral program: new agent
50% off first closed deal ($250/$350); referrer 50% off their next deal when
the referral's first deal closes.

## What this project is

Production transaction-coordination system for **Gloria Grullon (MRFL
Transactions)** — a one-person Florida real estate TC business serving ~6-10
realtor clients ("agents"). Gloria is **non-technical**: explain in click-paths,
verify changes in a browser before shipping, and never assume she can debug.
Single-user operation; no staging environment — main is production.

Pipeline: contract PDF → intake form (Claude vision extraction) → Apps Script
webhook → master Google Sheet (per-property tabs + dashboard) → Google Calendar
events → branded deliverables (Sheet + PDF) → **agent portal** (realtors see
their deals live) → **operator dashboard** (Gloria's all-transactions SPA) →
**morning reminder drafts** in Gloria's Gmail → per-transaction **print/PDF
overviews** from either app. Growth layer: **public marketing site + referral
landing + public reviews** at **mrfltransactions.com** (her GoDaddy domain,
connected to Vercel 2026-07-06; www is the primary host, apex 307-redirects).

> README.md and docs/ARCHITECTURE.md describe the v1.0 (May 2026) chat-based
> flow and are partially stale. This file + CHANGELOG.md + docs/AGENT_PORTAL.md
> + docs/JULY_2026_*.md are current.

## Components & versions

| Component | File | Current state |
|---|---|---|
| Intake form | `intake/intake-form.html` | PDF-vision extraction: sends the actual PDF to Claude (`claude-opus-4-8`, max_tokens 8000, no temperature — rejected by model) with pdf.js text as spelling aid. Applies FL AS-IS "if blank" defaults (escrow 3 / loan app 5 / loan approval 30 / inspection 15 / title 15; cash → loan fields blank; ¶9(c) "no later than 5 days" is a cap, NOT title_days). HOA detection (`has_hoa` + contact fields). Calendar buttons on date fields. Failure-only diagnostics box (bottom-left). API key: Test auto-saves; uploader falls back to typed key. pdf.js detaches ArrayBuffers → always pass a copy (`buf.slice(0)`). |
| Webhook / Apps Script | `webhook/Code.gs` | **v7.6** (v7.6: operator payload adds `portal_links` per agent, keys generated on demand). **v7.5:** doPost (tab + calendar events + dashboard + deliverables + PDF export; `action:'review'` → ⭐ Reviews tab), doGet (health check / keyed widget view / keyed per-agent portal view / keyed all-deals operator view incl. `details` + `referrals` + `reviews` counts / keyless `view=reviews` → approved reviews + `google_url`), calendar sync, HOA dialog, portal links dialog, operator-link dialog, referral dialog, **⭐ Manage reviews dialog** (show/hide/delete, name-guarded writes), reminder drafts w/ referral+review footer. ~2,900 lines, container-bound to the master sheet. |
| Agent portal | `portal/index.html` | Mobile-first read-only app per agent: stats chips, next-deadline color-block banner (tap-to-jump, red past-due variant), deal cards (progress, milestone timeline from sheet checkboxes, collapsible Contacts & details with tap-to-call/email), past deals collapsed. `PORTAL_ENDPOINT` const = Gloria's webhook URL. **Dark/light mode** (v1.7.1): sun/moon toggle, system-preference default, choice persisted (`mrfl_portal_theme`); ALL colors are CSS theme tokens — run the WCAG contrast audit in both themes after any styling change (audit snippet in session history). Header is just "Hello, [name]! 👋" — no brand row/subline/"South Florida" (Gloria's personalization choice). Every deal card has a "🖨 Print / save as PDF" button (v1.9.1) → hidden `#printview` + `@media print` branded Transaction Overview. Growth hooks: "🎁 Refer an agent" share card (`shareInvite()` → `REFER_BASE = https://mrfltransactions.com/refer/`), 14-day closed-deal 🎉 congrats banner (also triggers share) paired with a "⭐ Leave a quick review" link to the site's #reviews (`SITE_BASE` derived from REFER_BASE). Side label for Both = "Double sided". Do NOT add background/color transitions on html/body — wedges the theme switch in Blink. |
| Operator dashboard | `dashboard/index.html` | Gloria's private all-transactions SPA (v2.5.0, aurora liquid-glass: violet-black bg + 3 vivid blobs, specular-edged frosted panels, glowing gradient ＋): hash-router views — #home (search, tappable stat cards, week day-pills w/ per-day deadline timeline, attention preview), #agents → #deals/agent/<name>, #deals/all|urgent|closing, #deal/<i> full detail (milestone checklist + ALL details sections + tel/mailto + Open-sheet-tab). Floating bottom nav; center ＋ opens the master sheet. Fed by `doGet?view=operator&key=<operator_key>` (v7.2 payload includes `details`; v7.6 adds `portal_links` map → 🔗 button on each Agents-tab row shares/copies that agent's portal invite). Link via 🛠 TC Tools → "🖥 My dashboard link". Detail view has "Open sheet tab ↗" + "🖨 Print / save as PDF" (same print pattern as the portal). Same dark/light token system + contrast-audit rule as the portal; `ENDPOINT` const = webhook URL. |
| Widget | `widget/index.html` (web) + `scriptable/mrfl_widget.js` (legacy iOS) | Upcoming-deadlines dashboard. Now requires `&key=<widget_key>` on the URL. Web version stores URL in localStorage (⚙ gear to change); shares `tc_webhook_url` key with the intake form. |
| Deliverables | `deliverables/` + Code.gs `_buildDeliverableSheet` / `_exportDeliverableAsPdf` | Branded combined Sheet + PDF per transaction, saved to Drive on submit. |
| Public site | `index.html` (root) + `refer/index.html` | Marketing site at `/` (services, how-it-works, pricing, contact CTAs) and the referral landing at `/refer/?from=<agent>` (personalized invite chip/copy/CTAs, $250/$350 offer). Canonical host: **https://mrfltransactions.com** — GoDaddy domain → Vercel, LIVE since 2026-07-06. Gloria set **www.mrfltransactions.com as primary**; the apex 307-redirects to it preserving path+query, so the apex-based generated links (portal REFER_BASE, Code.gs PORTAL/SITE/DASHBOARD_BASE_URL) all work — don't "fix" this. Machine-verify deploys against `https://www.mrfltransactions.com/` (apex curl returns a "Redirecting..." body). The vercel.app host stays attached so old shared links keep working. Hero: "Your deals, in good hands." (gradient em); closing CTA "Let's get your next deal moving."; refer-page closing CTA "<Referrer>'s deals are in good hands. Yours can be too." **Liquid-glass UI** (v2.3.0, from Gloria's references): deep indigo night #0A0A1F default with pink/blue orbs, frosted translucent panels (backdrop blur + `--glass-*` tokens + specular inset edge), hero light-beam cone + dotted texture, blue→violet gradient pill buttons (#2563EB→#7C3AED, white text — both endpoints pass 4.5:1), gradient hero text (fallback `color` is what audits measure; endpoints hand-verified ≥3:1) + frosted-white light mode; toggle persisted in localStorage `mrfl_site_theme` (shared by both pages). Copy rules: say "double sided" (never "dual agency"); no "deals close on time"-style absolute claims. ⚠️ vercel.json's old `/` → intake redirect was REMOVED for this — Gloria's intake bookmark must be `/intake/intake-form.html`. |
| Public reviews | `webhook/Code.gs` v7.5 + homepage `#reviews` | "⭐ Reviews" sheet tab (Date/Name/Brokerage/Stars/Review/**Show on site?** checkbox — nothing is public until approved). Site form → `doPost {action:'review'}` (text/plain to avoid CORS preflight; 5/hour anti-spam cap); display via keyless `doGet?view=reviews` (approved rows, newest first, max 30, + `google_url` from Script Property `google_review_url` → site shows a "Review on Google" button when set). **Manage via 🛠 TC Tools → ⭐ Manage reviews** (show/hide/delete; writes guarded by reviewer-name match). Growth hooks: portal congrats banner pairs with a review-ask link; /refer/ shows up to 3 approved reviews ("Loved by agents"); reminder drafts carry a referral+review footer; dashboard home flags pending reviews. `WEBHOOK` const in index.html + refer/index.html = same web-app URL as PORTAL_ENDPOINT. |
| Referral tracking | `webhook/Code.gs` v7.3 + dashboard `#referrals` | "🎁 Referrals" sheet tab is the source of truth (Date/Referred by/New agent/Contact/Status dropdown/Reward/Notes; statuses: Invited → Joined → First deal closed — reward due → Reward redeemed). Log via 🛠 TC Tools → "🎁 Log a referral"; operator payload carries `referrals[]`; dashboard shows home row + #referrals view with reward-due flags. Portal has the share card + 14-day closed-congrats banner (both trigger `shareInvite()`). |
| Portal mockup | `portal/agent-dashboard.html` | Static design mockup only (source of the design tokens). Not live. |

## Deploy model (critical)

| What changed | How it ships |
|---|---|
| Anything in the repo's HTML (intake, portal, widget, site) | Push to `main` → Vercel auto-deploys in ~1 min. **Public prod domains: `https://www.mrfltransactions.com` (primary; apex 307-redirects to it) and `https://mrfl-transactions.vercel.app`** — curl-verify against www or the vercel.app host (the apex returns a "Redirecting..." body). The `…-git-main-…` branch URL is behind Vercel login (Gloria's bookmark). Tell Gloria to hard-refresh (Cmd+Shift+R). |
| `Code.gs` menus / dialogs / triggers | Gloria pastes the whole file into Apps Script (Extensions → Apps Script) → Save. Head code runs immediately. |
| `Code.gs` `doGet`/`doPost` (web endpoint) | Paste + Save **AND** Deploy → Manage deployments → her deployment → ✏️ → **New version** → Deploy. Without this the endpoint keeps running the old version (portal shows "Almost ready"). |

- Apps Script **cannot be tested from this machine**. Verify pure logic by
  extracting functions from Code.gs and executing them in the preview browser
  (established pattern in this repo's history); verify live endpoint behavior
  with curl; Gloria tests UI dialogs.
- The script has **multiple web-app deployments**; the active one's URL is
  stored as Script Property `portal_webapp_url` and hardcoded as
  `PORTAL_ENDPOINT` in portal/index.html:
  `https://script.google.com/macros/s/AKfycbzheiPICRaOkutzU6kkrNS3n1pVebVVMtMwqAyQtDinMrzbqnaeTxFdHaqCeKtveKEzBw/exec`
  (as of 2026-07-05). An old stale deployment URL sits in
  `intake/intake-artifact.html` (excluded from Vercel). If the URL ever
  changes: update `PORTAL_ENDPOINT`, `portal_webapp_url`, and the widget URL.
- Always run a bracket-balance check on Code.gs after editing (python
  delta-count vs git HEAD — see repo history) — no compiler exists here.

## Master sheet & data model

- Master spreadsheet: **"Transactions Important Dates"**
  (ID `1HmBdzF8KRWvRFa01-QqmRIi9cKHF7Bh1-pf9jeDQ_7Y`), dashboard tab `📊 Dashboard`.
- One tab per transaction, named `<AgentRef>_<Address>` (e.g.
  `Martha_510 SW 181st Way, Pembroke Pines, FL 33029`). AgentRef spelling must
  stay consistent — each distinct prefix is treated as a separate agent.
- Tab layout: row 1 = property address; milestone table (A=name, B=Deadline
  date, C=done-checkbox, D=amount/remarks, E=timeframe); optional concession
  rows; then the **details block** in column A — `Label: value` lines grouped
  under section headers (`Seller(s):`, `Seller's Agent:`, `Escrow Agent/
  Title`, `Seller Title`, `Loan Officer`, `Loan Processor`,
  `HOA / Association`). The sheet is the single source of truth: **editing a
  tab directly is the supported way to update anything mid-deal** — portal,
  dashboard, and deliverables all re-read it.
- Milestone names (canonical list `CAL_KNOWN_MILESTONES` in Code.gs):
  Effective Date, Escrow Due, Inspection Due, Loan Application Due, Loan
  Approval Due, HOA Application, HOA Approval, Title Commitment, Closing Date,
  Additional Escrow Due.

## Feature map (all in Code.gs unless noted)

- **Calendar sync (v6.4-6.5):** installable onEdit trigger
  `onEditCalendarSync` moves the matching Calendar event when a Deadline cell
  (col B) is hand-edited. Tolerant title matching + duplicate deletion.
  Manual backstop: 🛠 TC Tools → "🔄 Sync dates → Calendar"
  (`syncActiveTabToCalendar` → `_calSyncSheetCore`). **Script-written dates do
  NOT fire onEdit** — the HOA dialog therefore offers "Sync calendar now"
  in-dialog after saving dates.
- **Agent portal endpoint (v6.6-6.7):** `doGet?view=portal&agent=&key=`
  validates per-agent key, returns only that agent's deals incl. milestones +
  `details` sections (`_portalDetailsFromValues` — generic Label:value parser,
  handles old tabs without the "Property Address:" marker).
- **Portal links (v6.8.3-6.9):** 🛠 TC Tools → "🔗 Agent portal links" —
  short links `portal/?a=<ref>&k=<key>`, per-agent "📋 Copy invite message",
  yellow box with the keyed widget URL. Legacy long `?u=` links still work.
- **HOA mid-deal dialog (v6.8-6.8.2):** 🛠 TC Tools → "🏘 Add / update HOA
  info" — prefilled form writes/replaces the HOA details section, inserts or
  updates HOA milestone rows above Closing Date, then in-dialog calendar-sync
  offer. (`SpreadsheetApp.getUi().alert()` from `google.script.run` silently
  fails — that's why the reminder is in-dialog. Remember this.)
- **Recreate summary email (v7.8):** 🛠 TC Tools → "✉️ Recreate summary
  email" — `createSummaryEmailDraft` + `_sum*` helpers rebuild the intake
  form's Transaction Summary email from the ACTIVE tab's current contents
  and create a Gmail **draft** (drafts-only constraint applies). Recipient
  policy mirrors the intake composer's `_emailComputeRecipients` (side from
  the tab's `Side Represented:` line; cash excludes lender). Subject
  "UPDATED — Transaction Summary: <address>" + amber disregard-earlier
  banner; non-$ concessions listed under OTHER AGREEMENTS.
- **Add / update details dialog (v7.7):** 🛠 TC Tools → "✏️ Add / update
  details" — generalizes the HOA pattern to the contact sections agents most
  often add later (buyer/closing title, **seller's title**, loan officer,
  loan processor). `DETAIL_EDIT_SECTIONS` config drives `showDetailsDialog` /
  `saveTransactionDetails`; `_detailSectionRange`/`_detailReadExisting`
  prefill + replace-in-place. Writes full `Label: value` lines into column A
  so `_portalDetailsFromValues` (portal + dashboard) shows them. Buyer-title
  header is split-aware (`Escrow Agent/ Title` vs `Escrow Agent/ Buyer Title`
  when a seller-title block exists). Parties/agents are still edited directly
  in the tab.
- **Endpoint hardening (v6.9):** keyless GET → `{status:'ok'}` health check
  only (keeps intake form's webhook Test green); widget data needs
  `key=<widget_key>`; portal needs per-agent keys.
- **Reminder drafts (v7.0):** daily trigger `remindersDailyJob` (~7 AM)
  creates **Gmail DRAFTS** (one per agent, milestones due in 3/1/0 days,
  branded HTML + plain fallback + portal button). **HARD CONSTRAINT: Gloria
  explicitly refused auto-send. The script contains ZERO send calls
  (`GmailApp.createDraft` only) — never add `MailApp.sendEmail`/`GmailApp.send*`.**
  Agent email: Script Property `portal_email_<ref>` override, else derived
  from the represented side's "Agent Email" line. Skipped agents → note-to-self
  draft. Menu: "🔔 Set up daily reminder drafts" / "🔔 Preview / create
  reminder drafts". Excludes Effective Date, checked milestones,
  closed/cancelled/on-hold deals, and overdue items.
- **Operator dashboard endpoint (v7.1-7.2):** `doGet?view=operator&key=`
  validates `operator_key`, returns ALL deals across agents (status, dates,
  progress, milestones, done counts, per-tab `sheet_link`, and — v7.2 — the
  parsed `details` sections). Link dialog: 🛠 TC Tools → "🖥 My dashboard
  link" (`showOperatorLink`; extra-long key; revoke = delete the property).
- **Print/PDF overviews (v1.9.1, front-end only):** portal deal cards and the
  dashboard detail view have "🖨 Print / save as PDF" — builds a branded
  black-on-white Transaction Overview into hidden `#printview`, `@media print`
  hides the app chrome, `window.print()` opens the dialog (phones: share →
  save PDF). Duplicated builder per file by design (self-contained pages).
- **Referral tracking (v7.3):** `_refSheet`/`_refList`/`saveReferral`/
  `showReferralDialog` — see Components table.
- **Public reviews (v7.4) + management (v7.5):** `_revSheet`/`_reviewSubmit`
  (doPost `action:'review'`, 5/hr CacheService cap)/`_reviewsResponse`
  (keyless, approved rows + `google_url`)/`showReviewsManager` +
  `listReviewsForManager`/`setReviewVisibility`/`deleteReview` (writes
  guarded by reviewer-name match at the target row).
- **Growth footer (v7.5):** `_remBuildEmailHtml/Plain` end with the agent's
  personal referral link (`REFER_BASE_URL + '?from=' + ref`) + a review link
  (`SITE_BASE_URL + '#reviews'`). Still drafts-only.
- **Dashboard portal links (v7.6):** `operatorResponse_` includes
  `portal_links` (per-agent portal URLs; keys generated on demand via
  `_portalRandomKey`) → dashboard Agents-tab 🔗 buttons share/copy the same
  invite message the sheet dialog uses.
- **Intake extraction** (intake-form.html): see Components table. The
  extraction system prompt (`EXTRACTION_SYSTEM_PROMPT`) is paragraph-by-
  paragraph FL AS-IS rules — edit surgically, it's battle-tested.

## Script Properties registry (Apps Script → Project Settings)

| Property | Purpose |
|---|---|
| `portal_webapp_url` | Webhook URL links are built from (delete → links dialog re-prompts) |
| `portal_key_<agentref>` | Agent's private portal key (delete → revoke; regenerates on next dialog open) |
| `portal_email_<agentref>` | Optional agent-email override for reminder drafts |
| `widget_key` | Key protecting the widget data view |
| `operator_key` | Gloria's private dashboard key (ALL deals — never share; delete to revoke) |
| `google_review_url` | (Optional, not yet set) Google Business Profile review link — once set, the site's reviews section shows a "Review on Google" button automatically |
| `evt_<tabGid>_<milestone>` | DocumentProperties — calendar event id cache for sync |

## 🛠 TC Tools menu (current)

Refresh Dashboard · Show Active Only/All · Sync dates → Calendar · Set up
calendar sync · Add / update HOA info · **Add / update details** ·
**Recreate summary email** · Agent portal links · My dashboard link ·
Log a referral · Manage reviews · Preview / create reminder drafts ·
Set up daily reminder drafts · About.

## Working with Gloria

- Non-technical: give numbered click-paths; she deploys Code.gs by
  paste-into-editor; diagnose via screenshots (the intake form has an
  on-failure diagnostics box for this reason; the portal self-reports stale
  deployments as "Almost ready").
- She personally reviews everything outbound: reminder emails are drafts she
  sends herself; deliverables she shares herself. Preserve this principle.
- Verify every change in the preview browser (localhost:8099 via
  `.claude/launch.json` "intake" config) before pushing; git push = live.
- Costs matter: the stack is intentionally $0/month (Vercel free, Apps
  Script, ~$0.02/contract Claude API). Don't introduce paid services without
  asking.

## Roadmap context

`docs/CLIENT_PORTAL_SPEC.md` is the full product vision (uploads, in-app
notifications, referrals, multi-tenant SaaS). The current portal is its
Phase 1. Detailed feature docs: `docs/AGENT_PORTAL.md` (technical),
`docs/JULY_2026_UPDATES.md` (extraction + calendar sync),
`docs/JULY_2026_PORTAL_UPDATES.md` (portal + HOA + reminders), `CHANGELOG.md`
(version history).
