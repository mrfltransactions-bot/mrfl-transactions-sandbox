// MRFL Transactions — iPhone Home-Screen Widget
// Built for Scriptable (https://scriptable.app — free on the App Store)
// Consumes the v6.2 GET endpoint exposed by webhook/Code.gs.
//
// Setup: see scriptable/SETUP.md in the repo for step-by-step instructions.
//
// Author: Gloria + Claude · May 2026

// ============================================================
// CONFIG — Edit these after first install
// ============================================================

// 1. Paste your SANDBOX deployment URL between the quotes.
//    You can find it in the sandbox form's ⚙ Connection Settings,
//    or in the Apps Script editor: Deploy → Manage deployments.
//    To switch to production later, paste the production URL here.
const WEBHOOK_URL = "https://script.google.com/macros/s/PASTE_YOUR_SANDBOX_DEPLOYMENT_ID_HERE/exec";

// 2. URL to open when you tap the widget. Default: the master sheet.
//    Tapping opens it in the Google Sheets iOS app if installed,
//    otherwise in Safari.
const TAP_URL = "https://docs.google.com/spreadsheets/d/1HmBdzF8KRWvRFa01-QqmRIi9cKHF7Bh1-pf9jeDQ_7Y";

// 3. How many days of upcoming deadlines to show.
//    4 = matches the dashboard's "urgent + warning" window.
//    7 = one week. 14 = two weeks.
const DAYS_WINDOW = 4;

// 4. Filter to a single agent's deals (case-insensitive substring match).
//    Leave as "" (empty string) to show all agents.
//    Example: "Carlos" → only deals where agent name contains "Carlos".
const AGENT_FILTER = "";

// ============================================================
// BRAND COLORS — match the master sheet dashboard
// ============================================================
const COLORS = {
  bg:            "#1E1B4B", // deep indigo background
  textPrimary:   "#FFFFFF",
  textSecondary: "#C7D2FE",
  textMuted:     "#818CF8",
  urgent:        "#EF4444", // red
  warning:       "#F59E0B", // amber
  normal:        "#10B981", // green
  accent:        "#A78BFA", // purple
};

// ============================================================
// MAIN
// ============================================================
async function buildWidget() {
  const data = await fetchData();
  const widget = new ListWidget();
  widget.backgroundColor = new Color(COLORS.bg);
  widget.setPadding(12, 14, 12, 14);
  widget.url = TAP_URL;

  if (data.error) {
    renderError(widget, data.error);
    return widget;
  }

  renderHeader(widget, data);
  widget.addSpacer(6);

  const family = config.widgetFamily || "medium";
  const maxItems = family === "small" ? 2 : family === "medium" ? 3 : 6;
  const items = (data.deadlines || []).slice(0, maxItems);

  if (items.length === 0) {
    const empty = widget.addText("✓ No deadlines in the next " + DAYS_WINDOW + " days");
    empty.font = Font.systemFont(13);
    empty.textColor = new Color(COLORS.normal);
  } else {
    for (const item of items) {
      renderDeadlineRow(widget, item, family);
    }
  }

  widget.addSpacer();
  renderFooter(widget, data);
  return widget;
}

// ============================================================
// RENDER HELPERS
// ============================================================
function renderHeader(widget, data) {
  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const title = headerStack.addText("MRFL");
  title.font = Font.boldSystemFont(15);
  title.textColor = new Color(COLORS.textPrimary);

  const active = (data.summary && data.summary.active_deals) || 0;
  const sep = headerStack.addText("  ·  " + active + " active");
  sep.font = Font.systemFont(13);
  sep.textColor = new Color(COLORS.textSecondary);

  headerStack.addSpacer();

  const urgent = (data.summary && data.summary.urgent_count) || 0;
  if (urgent > 0) {
    const pill = headerStack.addText("🔴 " + urgent);
    pill.font = Font.boldSystemFont(13);
    pill.textColor = new Color(COLORS.urgent);
  }
}

function renderDeadlineRow(widget, item, family) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;
  row.setPadding(4, 0, 4, 0);

  const urgencyColor = item.urgency === "urgent" ? COLORS.urgent
                     : item.urgency === "warning" ? COLORS.warning
                     : COLORS.normal;

  // Days-until colored chip on the left
  const daysChip = row.addStack();
  daysChip.backgroundColor = new Color(urgencyColor);
  daysChip.cornerRadius = 6;
  daysChip.setPadding(3, 7, 3, 7);
  const daysText = daysChip.addText(item.days_until + "d");
  daysText.font = Font.boldSystemFont(13);
  daysText.textColor = new Color("#FFFFFF");

  // Main column: property + milestone
  const main = row.addStack();
  main.layoutVertically();
  main.spacing = 0;

  const propertyLine = main.addText(shortAddress(item.property));
  propertyLine.font = Font.semiboldSystemFont(family === "small" ? 11 : 12);
  propertyLine.textColor = new Color(COLORS.textPrimary);
  propertyLine.lineLimit = 1;

  const milestoneLine = main.addText(item.milestone || "—");
  milestoneLine.font = Font.systemFont(family === "small" ? 10 : 11);
  milestoneLine.textColor = new Color(COLORS.textMuted);
  milestoneLine.lineLimit = 1;

  row.addSpacer();

  // Date on the right (medium/large only — too tight on small)
  if (family !== "small" && item.date) {
    const dateTxt = row.addText(formatDate(item.date));
    dateTxt.font = Font.systemFont(11);
    dateTxt.textColor = new Color(COLORS.textSecondary);
  }
}

function renderFooter(widget, data) {
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  const updated = footer.addText("Updated " + formatTime(data.generated_at));
  updated.font = Font.systemFont(9);
  updated.textColor = new Color(COLORS.textMuted);

  footer.addSpacer();

  const win = footer.addText(DAYS_WINDOW + "-day window");
  win.font = Font.systemFont(9);
  win.textColor = new Color(COLORS.textMuted);
}

function renderError(widget, msg) {
  const t1 = widget.addText("⚠ MRFL Widget");
  t1.font = Font.boldSystemFont(14);
  t1.textColor = new Color(COLORS.warning);
  widget.addSpacer(4);
  const t2 = widget.addText(msg);
  t2.font = Font.systemFont(11);
  t2.textColor = new Color(COLORS.textSecondary);
  t2.lineLimit = 4;
  widget.addSpacer();
  const hint = widget.addText("Tap → open the master sheet");
  hint.font = Font.systemFont(9);
  hint.textColor = new Color(COLORS.textMuted);
}

// ============================================================
// DATA + UTILITIES
// ============================================================
async function fetchData() {
  if (!WEBHOOK_URL || WEBHOOK_URL.indexOf("PASTE_YOUR") >= 0) {
    return { error: "Open this script in Scriptable and paste your sandbox webhook URL into the WEBHOOK_URL line at the top." };
  }
  try {
    const url = WEBHOOK_URL
              + "?days=" + DAYS_WINDOW
              + (AGENT_FILTER ? "&agent=" + encodeURIComponent(AGENT_FILTER) : "");
    const req = new Request(url);
    req.timeoutInterval = 15;
    const json = await req.loadJSON();
    if (json.error) return { error: "Webhook returned an error: " + json.error };
    return json;
  } catch (err) {
    return { error: "Couldn't reach the webhook. " + (err.message || err) };
  }
}

function shortAddress(addr) {
  if (!addr) return "—";
  const idx = addr.indexOf(",");
  return idx > 0 ? addr.substring(0, idx) : addr;
}

function formatDate(iso) {
  if (!iso) return "";
  // iso is "YYYY-MM-DD"; anchor to noon so timezone math doesn't shift the date
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return h + ":" + m + ampm;
}

// ============================================================
// ENTRY POINT
// ============================================================
const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // When you tap "Play" inside Scriptable, this shows a preview.
  await widget.presentMedium();
}
Script.complete();
