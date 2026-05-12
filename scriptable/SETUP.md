# MRFL iPhone Widget — Setup Guide

A live home-screen widget that shows your most-urgent upcoming transaction deadlines, color-coded by urgency. Refreshes itself every few minutes. Tap to open the master sheet.

**Total setup time:** ~5 minutes.

---

## What you'll see

A rectangular widget on your home screen that looks roughly like this:

```
┌─────────────────────────────────────┐
│ MRFL  ·  11 active        🔴 1     │
│                                     │
│ [2d]  12756 SW 49th Ct       5/11  │
│       Inspection Due                │
│ [3d]  9220 Sunset Dr         5/12  │
│       Loan Approval                 │
│ [4d]  442 NE 8th St          5/13  │
│       Title Commitment              │
│                                     │
│ Updated 9:12a       4-day window   │
└─────────────────────────────────────┘
```

- **Red chip (2d)** = urgent (≤2 days away or status flagged urgent)
- **Amber chip** = warning (3–5 days)
- **Green chip** = normal (further out)

Top-right shows your count of urgent items at a glance.

---

## Step 1 — Install Scriptable on your iPhone

1. Open the **App Store** on your iPhone
2. Search for **"Scriptable"** (purple icon, by "imkel")
3. Tap **Get** → install. It's free, no signup, no account.

That's all the app does — runs little JavaScript files and turns them into widgets. No data leaves your phone except the request to your own webhook.

---

## Step 2 — Get the widget code

You have two options for getting the code onto your phone. Pick whichever is easier.

### Option A — Copy from GitHub on your phone (easiest)

1. On your iPhone, open Safari and go to:
   https://github.com/mrfltransactions-bot/mrfl-transactions-sandbox/blob/main/scriptable/mrfl_widget.js
2. Tap the **Raw** button (top-right of the code view)
3. Tap and hold anywhere in the code → **Select All** → **Copy**

### Option B — AirDrop from your Mac

1. On this Mac, open Finder and navigate to:
   `/Users/gloriagrullon/TransactionSystem/scriptable/mrfl_widget.js`
2. Right-click → Share → AirDrop → your iPhone
3. On the iPhone, open the file → tap the **share icon** → **Copy**

---

## Step 3 — Paste into Scriptable

1. Open the **Scriptable** app on your iPhone
2. Tap the **+** in the top-right to create a new script
3. Tap inside the empty code area → paste (long-press → Paste)
4. Tap the **title at the top** (currently says "Untitled Script") → rename to **MRFL Transactions** → tap Done

---

## Step 4 — Configure your webhook URL

Near the top of the script you just pasted, find this line:

```javascript
const WEBHOOK_URL = "https://script.google.com/macros/s/PASTE_YOUR_SANDBOX_DEPLOYMENT_ID_HERE/exec";
```

Replace the placeholder URL with your **sandbox** webhook URL — the same one you have saved in the sandbox form's ⚙ Connection Settings.

Easiest way: tap and hold the placeholder text, select the whole URL (between the quotes), paste over it with your real URL.

Optional tweaks while you're in there:
- `DAYS_WINDOW = 4` — bump to 7 or 14 if you want a wider lookahead
- `AGENT_FILTER = ""` — leave empty to see all your deals; or put e.g. `"Carlos"` to filter

Tap **Done** (top-right) to save.

---

## Step 5 — Test the script before putting it on the home screen

Inside Scriptable, with the MRFL Transactions script open:

- Tap the **▶ Play button** (bottom-right)
- You should see a **preview of the widget** pop up on screen — header, deadline rows, footer, all rendered
- If it says **"⚠ MRFL Widget — Couldn't reach the webhook"** or similar, the URL is wrong or the script isn't deployed. Re-check step 4.
- If it says **"✓ No deadlines in the next 4 days"** — the script works, you just genuinely have nothing urgent. Try bumping `DAYS_WINDOW` to 30 to see real deals.

When it looks right, tap anywhere outside the preview to dismiss.

---

## Step 6 — Add the widget to your home screen

1. **Long-press an empty spot** on any home-screen page until the icons start jiggling
2. Tap the **+** in the top-left of the screen
3. Scroll or search for **Scriptable** → tap it
4. Choose **Medium** (the rectangular one — best balance of info)
   - Small (2×2 square) shows fewer rows; Large (full 4×4) shows up to 6
5. Tap **Add Widget**
6. The new widget appears, probably showing a default Scriptable icon. **Tap it once** while still in jiggle mode
7. In the Edit Widget panel:
   - **Script:** tap and choose **MRFL Transactions**
   - **When Interacting:** leave as **Open URL** (this makes tapping the widget open the master sheet)
   - **Parameter:** leave blank
8. Tap outside the widget, then tap **Done** in the top-right of the screen

Your widget is now live on the home screen. iOS will refresh it on its own schedule (typically every ~5–15 minutes when you're actively using the phone).

---

## Step 7 — Force a refresh anytime

iOS doesn't expose an explicit "refresh widget now" button — but the widget refreshes every time iOS thinks it needs to (which is fairly often during active use). To force one manually:

1. Open the Scriptable app
2. Tap the MRFL Transactions script
3. Tap ▶ Play once → preview appears, the widget on your home screen also refreshes from the same cache

---

## Switching to production later

When you're ready to point this at production instead of sandbox:

1. Open Scriptable → tap MRFL Transactions
2. Find the `WEBHOOK_URL` line near the top
3. Replace the sandbox URL with the production deployment URL (from the production Apps Script's Manage deployments page)
4. Tap Done — the widget picks up the new URL on next refresh

No need to delete or re-add the widget. Same script, just pointed at a different webhook.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `⚠ MRFL Widget — Open this script…` | URL is still the placeholder | Step 4 — paste your real webhook URL |
| `⚠ MRFL Widget — Couldn't reach the webhook` | Webhook URL wrong, or script not deployed | Paste the URL into Safari directly — if it doesn't return JSON, the deploy is the problem, not the widget |
| `Webhook returned an error: …` | The script ran but `widgetTest()` would have caught this — check the dashboard tab and column names | Open the Apps Script editor and run `widgetTest()` manually; fix whatever it complains about |
| Widget shows old data | iOS is showing a cached render | Open Scriptable → Play → it forces a refresh |
| Widget is blank / not updating for hours | Scriptable lost its data cache (rare) | Long-press the widget → Remove → re-add it via Step 6 |

If something's really stuck, screenshot the widget and paste it in the chat with Claude — fastest way to diagnose.

---

## What this widget does NOT do (yet)

- **Push notifications** — iOS widgets can only refresh on iOS's schedule; they can't ping you. For real urgency alerts, the existing Google Calendar reminders cover this.
- **Write actions** — the widget is read-only. Tap → open sheet. No way to mark something done from the widget itself.
- **Per-agent custom widgets** — one widget shows all your deals (or one filter). To give an individual agent their own widget you'd need the multi-tenant portal described in `docs/CLIENT_PORTAL_SPEC.md`.

These are intentional simplifications for v1. The widget code is small (~200 lines) and easy to extend later.
