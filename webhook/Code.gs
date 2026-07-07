/**
 * TRANSACTION COORDINATOR WEBHOOK — v6.2 (Master Dashboard + Widget Endpoint)
 *
 * Built on top of v4. Adds:
 *   1. A Master "📊 Dashboard" tab pinned to the front of the sheet
 *   2. Auto-rebuilds the dashboard after every form submission
 *   3. Manual "🛠 TC Tools" menu in the sheet UI for on-demand refresh
 *   4. Color-coded urgency: Past Due, Urgent, Warning, On Track, Closed
 *   5. Sorted by next deadline (most urgent at top, closed at bottom)
 *   6. Clickable property names that jump to the property's tab
 *
 * IMPORTANT: After updating to v6.2:
 *   1. Save the script
 *   2. Deploy → Manage Deployments → pencil → New version → Deploy
 *   3. Refresh your Google Sheet — you'll see the new "🛠 TC Tools" menu
 *   4. Click TC Tools → Refresh Dashboard to build it for the first time
 *
 * v6.2 (May 2026): Added GET endpoint for iPhone widget consumption.
 *   Returns next N days of upcoming deadlines as JSON. See
 *   docs/WIDGET_ENDPOINT.md for contract and integration notes.
 *
 * v6.3 (May 2026): Auto-export the deliverable as a branded PDF on
 *   every form submit. Sits alongside the existing Google Sheet in
 *   the master sheet's Drive folder. No more manual "send prompt to
 *   Claude" step to get a polished PDF.
 */

// ============ CONFIG ============
const EVENT_HOUR = 9;          // 9:00 AM for calendar events
const REMINDER_MINUTES = [
  3 * 24 * 60,   // 3 days before
  0              // day-of (at event start time)
];
const DASHBOARD_TAB_NAME = '📊 Dashboard';

// Brand colors (matching Gloria's purple-indigo palette)
const COLOR_INDIGO_DEEP = '#4338CA';
const COLOR_PURPLE = '#8B5CF6';
const COLOR_INDIGO_NAVY = '#312E81';
const COLOR_LAVENDER = '#DDD6FE';
const COLOR_PURPLE_TINT = '#F5F3FF';

// Status colors
const COLOR_PAST_DUE = '#991B1B';   // dark red
const COLOR_URGENT = '#EF4444';     // red
const COLOR_WARNING = '#F59E0B';    // amber
const COLOR_ON_TRACK = '#10B981';   // emerald
const COLOR_CLOSED = '#6B7280';     // gray
const COLOR_ON_HOLD = '#F97316';    // orange (manual override)
const COLOR_CANCELLED = '#7F1D1D';  // dark maroon (manual override)

// Manual override dropdown values
const STATUS_DROPDOWN_OPTIONS = [
  '🔄 Auto',
  '🟢 Active',
  '⏸ On Hold',
  '❌ Cancelled',
  '✅ Closed'
];

// ============ MENU (runs when sheet opens) ============
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getDocumentProperties();
  const activeOnly = props.getProperty('activeOnly') === 'true';
  const filterLabel = activeOnly ? '👁 Show All Transactions' : '🔍 Show Active Only';
  
  ui.createMenu('🛠 TC Tools')
    .addItem('🔄 Refresh Dashboard', 'rebuildDashboard')
    .addItem(filterLabel, 'toggleActiveOnly')
    .addSeparator()
    .addItem('🔄 Sync dates → Calendar', 'syncActiveTabToCalendar')
    .addItem('📅 Set up calendar sync', 'setupCalendarSync')
    .addSeparator()
    .addItem('🏘 Add / update HOA info', 'showHoaDialog')
    .addItem('✏️ Add / update details', 'showDetailsDialog')
    .addItem('🔗 Agent portal links', 'showPortalLinks')
    .addItem('🖥 My dashboard link', 'showOperatorLink')
    .addItem('🎁 Log a referral', 'showReferralDialog')
    .addItem('⭐ Manage reviews', 'showReviewsManager')
    .addSeparator()
    .addItem('🔔 Preview / create reminder drafts', 'previewAndDraftReminders')
    .addItem('🔔 Set up daily reminder drafts', 'setupDailyReminders')
    .addItem('ℹ About', 'showAbout')
    .addToUi();
}

function toggleActiveOnly() {
  const props = PropertiesService.getDocumentProperties();
  const current = props.getProperty('activeOnly') === 'true';
  const newState = !current;
  props.setProperty('activeOnly', String(newState));
  rebuildDashboard();
  
  // Rebuild the menu so the label flips
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🛠 TC Tools')
    .addItem('🔄 Refresh Dashboard', 'rebuildDashboard')
    .addItem(newState ? '👁 Show All Transactions' : '🔍 Show Active Only', 'toggleActiveOnly')
    .addSeparator()
    .addItem('🔄 Sync dates → Calendar', 'syncActiveTabToCalendar')
    .addItem('📅 Set up calendar sync', 'setupCalendarSync')
    .addSeparator()
    .addItem('🏘 Add / update HOA info', 'showHoaDialog')
    .addItem('✏️ Add / update details', 'showDetailsDialog')
    .addItem('🔗 Agent portal links', 'showPortalLinks')
    .addItem('🖥 My dashboard link', 'showOperatorLink')
    .addItem('🎁 Log a referral', 'showReferralDialog')
    .addItem('⭐ Manage reviews', 'showReviewsManager')
    .addSeparator()
    .addItem('🔔 Preview / create reminder drafts', 'previewAndDraftReminders')
    .addItem('🔔 Set up daily reminder drafts', 'setupDailyReminders')
    .addItem('ℹ About', 'showAbout')
    .addToUi();
}

function showAbout() {
  SpreadsheetApp.getUi().alert(
    'Transaction Coordinator System v5\n\n' +
    'Master Dashboard auto-aggregates all your active transactions.\n' +
    'Refreshes automatically after every form submission.\n\n' +
    'Use 🛠 TC Tools → Refresh Dashboard to manually rebuild.'
  );
}

// ============ CURRENCY FORMATTER ============
function formatCurrency(value) {
  if (!value) return value;
  const strValue = String(value).trim();
  if (!strValue) return strValue;
  const cleaned = strValue.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return strValue;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return strValue;
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + intPart + '.' + parts[1];
}

// ============ DATE PARSER ============
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = String(dateStr).replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*/i, '');
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

// ============ CALENDAR EVENT CREATION ============
function createCalendarEvents(data) {
  const calendar = CalendarApp.getDefaultCalendar();
  const propertyAddress = data.propertyAddress || 'Property';
  const created = [];
  const gid = _calGidFromUrl(data.sheetUrl);
  const calProps = PropertiesService.getDocumentProperties();

  const contextLines = [];
  if (data.details && data.details.length > 0) {
    const findLine = (prefix) => {
      const m = data.details.find(d => d.startsWith(prefix));
      return m || '';
    };
    const sellerName = findLine('Seller(s):');
    const buyerName = findLine('Buyer(s):');
    const sellerAgent = findLine("Seller's Agent:");
    const buyerAgent = findLine("Buyer's Agent:");
    const financing = findLine('Financing Type:');
    
    if (sellerName) contextLines.push(sellerName);
    if (buyerName) contextLines.push(buyerName);
    if (sellerAgent) contextLines.push(sellerAgent);
    if (buyerAgent) contextLines.push(buyerAgent);
    if (financing) contextLines.push(financing);
  }

  if (data.milestones && data.milestones.length > 0) {
    data.milestones.forEach(m => {
      const eventDate = parseDate(m.date);
      if (!eventDate) return;

      const startTime = new Date(eventDate);
      startTime.setHours(EVENT_HOUR, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(EVENT_HOUR + 1, 0, 0, 0);

      const title = '📌 ' + m.name + ' — ' + propertyAddress;

      const descLines = [
        'Property: ' + propertyAddress,
        ''
      ];
      if (m.amount) {
        const formattedAmt = formatCurrency(m.amount);
        if (formattedAmt && formattedAmt !== m.amount) {
          descLines.push('Amount: ' + formattedAmt);
        } else if (formattedAmt) {
          descLines.push('Note: ' + formattedAmt);
        }
      }
      if (m.timeframe && m.timeframe !== 'Contract Start' && m.timeframe !== 'Contract End') {
        descLines.push('Timeframe: ' + m.timeframe);
      }
      if (descLines.length > 2) descLines.push('');
      contextLines.forEach(l => descLines.push(l));
      descLines.push('');
      descLines.push('🔗 Tab in sheet: ' + (data.sheetUrl || ''));

      try {
        const event = calendar.createEvent(title, startTime, endTime, {
          description: descLines.join('\n'),
          location: propertyAddress
        });
        REMINDER_MINUTES.forEach(min => {
          try { event.addPopupReminder(min); } catch (e) { /* ignore */ }
        });
        // Remember this event so a later date change in the sheet can move it.
        if (gid) calProps.setProperty(_calKey(gid, m.name), event.getId());
        created.push({ name: m.name, date: m.date });
      } catch (err) {
        // Continue on individual event errors
      }
    });
  }
  return created;
}

// ============ CALENDAR SYNC: SHEET DATE EDIT → MOVE THE EVENT ============
// A simple onEdit trigger runs in restricted mode and CANNOT call CalendarApp,
// so this runs as an INSTALLABLE onEdit trigger. Run setupCalendarSync() once
// (🛠 TC Tools → Set up calendar sync) to install it and authorize calendar.

const CAL_KNOWN_MILESTONES = [
  'Effective Date', 'Escrow Due', 'Inspection Due', 'Loan Application Due',
  'Loan Approval Due', 'HOA Application', 'HOA Approval', 'Title Commitment',
  'Closing Date', 'Additional Escrow Due'
];

function _calGidFromUrl(url) {
  const m = String(url || '').match(/gid=(\d+)/);
  return m ? m[1] : '';
}
function _calKey(gid, milestoneName) {
  return 'evt_' + gid + '_' + milestoneName;
}
function _calEventTitle(milestoneName, propertyAddress) {
  return '📌 ' + milestoneName + ' — ' + propertyAddress;
}
function _calDayWindow(date, padDays) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - padDays);
  const end = new Date(date); end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + padDays + 1);
  return { start: start, end: end };
}

// Tolerant title comparison — strip emoji/punctuation, lowercase, collapse
// spaces — so an em-dash, extra space, or emoji difference never blocks a match.
function _calNormalizeTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Move (or create) the calendar event for ONE milestone to newDate. Finds the
// existing event by stored id, else by tolerant title match across a window that
// spans the old and new dates; removes any duplicate matches; only creates a new
// event when none exists.
function _calSyncMilestone(calendar, props, gid, milestoneName, propertyAddress, newDate, oldDate) {
  const newStart = new Date(newDate); newStart.setHours(EVENT_HOUR, 0, 0, 0);
  const newEnd = new Date(newStart); newEnd.setHours(EVENT_HOUR + 1, 0, 0, 0);
  const key = _calKey(gid, milestoneName);

  // Fast path: the id we stored when the event was created / last matched.
  const storedId = props.getProperty(key);
  if (storedId) {
    try {
      const ev = calendar.getEventById(storedId);
      if (ev) { ev.setTime(newStart, newEnd); return; }
    } catch (e) { /* stale id — fall through to search */ }
  }

  // Search a window that covers BOTH the old and new dates (± 45 days) so we find
  // the original event and any stray duplicate near the new date.
  const oldMs = oldDate ? oldDate.getTime() : newDate.getTime();
  const lo = new Date(Math.min(newDate.getTime(), oldMs)); lo.setDate(lo.getDate() - 45); lo.setHours(0, 0, 0, 0);
  const hi = new Date(Math.max(newDate.getTime(), oldMs)); hi.setDate(hi.getDate() + 45); hi.setHours(23, 59, 59, 0);
  const wantNorm = _calNormalizeTitle(_calEventTitle(milestoneName, propertyAddress));
  const matches = calendar.getEvents(lo, hi).filter(ev => {
    try { return _calNormalizeTitle(ev.getTitle()) === wantNorm; } catch (e) { return false; }
  });

  if (matches.length > 0) {
    matches[0].setTime(newStart, newEnd);          // keep the first, move it
    props.setProperty(key, matches[0].getId());
    for (let i = 1; i < matches.length; i++) {     // delete any duplicates
      try { matches[i].deleteEvent(); } catch (e) { /* ignore */ }
    }
    return;
  }

  // None found — create one so the calendar stays complete.
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + gid;
  const ev = calendar.createEvent(_calEventTitle(milestoneName, propertyAddress), newStart, newEnd,
    { location: propertyAddress, description: 'Property: ' + propertyAddress + '\n\n🔗 Tab in sheet: ' + url });
  REMINDER_MINUTES.forEach(min => { try { ev.addPopupReminder(min); } catch (e) { /* ignore */ } });
  props.setProperty(key, ev.getId());
}

// Installable onEdit handler — when a milestone date (column B / "Deadline") is
// changed on a property tab, move the matching Google Calendar event to match.
function onEditCalendarSync(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) return;
    if (e.range.getColumn() !== 2) return;
    if (e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;

    const rowIdx = e.range.getRow();
    const milestoneName = String(sheet.getRange(rowIdx, 1).getValue() || '').trim();
    if (CAL_KNOWN_MILESTONES.indexOf(milestoneName) === -1) return;

    const raw = e.range.getValue();
    const newDate = (raw instanceof Date) ? raw : parseDate(String(raw || '').trim());
    if (!newDate || isNaN(newDate.getTime())) return;

    const propertyAddress = String(sheet.getRange(1, 1).getValue() || '').trim();
    const gid = String(sheet.getSheetId());
    const oldDate = parseDate(String(e.oldValue || '').trim());
    _calSyncMilestone(CalendarApp.getDefaultCalendar(), PropertiesService.getDocumentProperties(),
      gid, milestoneName, propertyAddress, newDate, oldDate);
  } catch (err) {
    Logger.log('onEditCalendarSync error: ' + err.toString());
  }
}

// Core sync for ONE property tab: align every milestone's calendar event with
// the sheet dates, delete duplicates. Returns counts (no UI) so it can serve
// both the menu button and dialog buttons.
function _calSyncSheetCore(sheet) {
  const propertyAddress = String(sheet.getRange(1, 1).getValue() || '').trim();
  const gid = String(sheet.getSheetId());
  const props = PropertiesService.getDocumentProperties();
  const calendar = CalendarApp.getDefaultCalendar();

  // Collect milestone rows + their dates.
  const values = sheet.getDataRange().getValues();
  const rows = [];
  let minMs = null, maxMs = null;
  for (let i = 0; i < values.length; i++) {
    const mName = String(values[i][0] || '').trim();
    if (CAL_KNOWN_MILESTONES.indexOf(mName) === -1) continue;
    const raw = values[i][1];
    const d = (raw instanceof Date) ? raw : parseDate(String(raw || '').trim());
    if (!d || isNaN(d.getTime())) continue;
    rows.push({ name: mName, date: d });
    minMs = (minMs === null) ? d.getTime() : Math.min(minMs, d.getTime());
    maxMs = (maxMs === null) ? d.getTime() : Math.max(maxMs, d.getTime());
  }
  if (rows.length === 0) throw new Error('No milestone dates found on this tab.');

  // One broad calendar read covering the whole transaction (± 180 days) so we
  // catch events still sitting on their old, pre-extension dates.
  const winStart = new Date(minMs); winStart.setDate(winStart.getDate() - 180); winStart.setHours(0, 0, 0, 0);
  const winEnd = new Date(maxMs); winEnd.setDate(winEnd.getDate() + 180); winEnd.setHours(23, 59, 59, 0);
  const allEvents = calendar.getEvents(winStart, winEnd);

  let moved = 0, created = 0;
  const toDelete = [];
  rows.forEach(r => {
    const wantNorm = _calNormalizeTitle(_calEventTitle(r.name, propertyAddress));
    const matches = allEvents.filter(ev => {
      try { return _calNormalizeTitle(ev.getTitle()) === wantNorm; } catch (e) { return false; }
    });
    const s = new Date(r.date); s.setHours(EVENT_HOUR, 0, 0, 0);
    const en = new Date(s); en.setHours(EVENT_HOUR + 1, 0, 0, 0);
    if (matches.length > 0) {
      matches[0].setTime(s, en);
      props.setProperty(_calKey(gid, r.name), matches[0].getId());
      moved++;
      for (let j = 1; j < matches.length; j++) toDelete.push(matches[j]);
    } else {
      const ev = calendar.createEvent(_calEventTitle(r.name, propertyAddress), s, en,
        { location: propertyAddress, description: 'Property: ' + propertyAddress });
      REMINDER_MINUTES.forEach(min => { try { ev.addPopupReminder(min); } catch (e) {} });
      props.setProperty(_calKey(gid, r.name), ev.getId());
      created++;
    }
  });
  let removed = 0;
  toDelete.forEach(ev => { try { ev.deleteEvent(); removed++; } catch (e) {} });

  return { property: propertyAddress, moved: moved, created: created, removed: removed };
}

// Manual, reliable path (🛠 TC Tools menu): sync EVERY milestone date on the
// currently-open property tab to the calendar and remove any duplicate events.
function syncActiveTabToCalendar() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const name = sheet.getName();
    if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) {
      ui.alert('Open a property tab first (the one with the milestone dates), then run this.');
      return;
    }
    const r = _calSyncSheetCore(sheet);
    ui.alert('✅ Calendar synced — ' + r.property + '\n\n' +
      'Updated: ' + r.moved + '\nCreated: ' + r.created + '\nDuplicates removed: ' + r.removed);
  } catch (err) {
    ui.alert('Sync failed: ' + err.toString());
  }
}

// Same sync, callable from dialogs (google.script.run) — returns a summary
// string instead of showing alerts.
function syncCalendarForDialog(sheetId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .find(s => s.getSheetId() === Number(sheetId));
  if (!sheet) throw new Error('Property tab not found — close and try from 🛠 TC Tools → 🔄 Sync dates → Calendar.');
  const r = _calSyncSheetCore(sheet);
  return '✅ Calendar synced — updated ' + r.moved + ', created ' + r.created +
    ', duplicates removed ' + r.removed + '.';
}

// One-time setup: install the installable onEdit trigger and authorize Calendar.
function setupCalendarSync() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Remove any existing calendar-sync triggers so we don't stack duplicates.
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'onEditCalendarSync') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('onEditCalendarSync').forSpreadsheet(ss).onEdit().create();
    CalendarApp.getDefaultCalendar().getName();  // force the Calendar auth prompt now
    ui.alert(
      '✅ Calendar sync is on (v6.5).\n\n' +
      'When you change a milestone date in a property tab, the matching Google ' +
      'Calendar event moves to the new date automatically.\n\n' +
      'You can also run 🛠 TC Tools → "🔄 Sync dates → Calendar" anytime to force a ' +
      'sync of the open tab and clean up any duplicate events.'
    );
  } catch (err) {
    ui.alert('Setup failed: ' + err.toString() +
      '\n\nApprove the Google permissions when prompted, then run it again.');
  }
}

// ============ DASHBOARD: EXTRACT DATA FROM A TAB ============
function extractTabData(sheet) {
  const tabName = sheet.getName();
  
  // Skip dashboard tab and any other special tabs starting with emoji
  if (tabName.startsWith('📊')) return null;
  if (!tabName.includes('_')) return null;  // skip non-transaction tabs
  
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  
  // Parse tab name → agentRef and propertyFromName
  const underscoreIdx = tabName.indexOf('_');
  const agentRef = tabName.substring(0, underscoreIdx).trim();
  const propertyFromName = tabName.substring(underscoreIdx + 1).trim();
  
  // Property display = row 1 col 1, fallback to tab name
  const propertyDisplay = String(values[0][0] || propertyFromName).trim();
  
  // Side represented — scan details block in column A
  let side = '';
  let manualOverride = '';
  for (const row of values) {
    const cell = String(row[0] || '');
    if (cell.startsWith('Side Represented:')) {
      const sideText = cell.substring('Side Represented:'.length).trim().toLowerCase();
      if (sideText.includes('seller')) side = 'Seller';
      else if (sideText.includes('buyer')) side = 'Buyer';
      else if (sideText.includes('both')) side = 'Both';
    } else if (cell.startsWith('Manual Status:')) {
      const overrideText = cell.substring('Manual Status:'.length).trim().toLowerCase();
      if (overrideText.includes('active'))         manualOverride = 'active';
      else if (overrideText.includes('on hold'))   manualOverride = 'on_hold';
      else if (overrideText.includes('cancelled')) manualOverride = 'cancelled';
      else if (overrideText.includes('closed'))    manualOverride = 'closed';
    }
  }
  
  // Find milestone rows (column A matches a known milestone name)
  const knownMilestones = [
    'Effective Date', 'Escrow Due', 'Inspection Due', 'Loan Application Due',
    'Loan Approval Due', 'HOA Application', 'HOA Approval', 'Title Commitment',
    'Closing Date', 'Additional Escrow Due'
  ];
  
  const milestones = [];
  for (const row of values) {
    const name = String(row[0] || '').trim();
    if (!knownMilestones.includes(name)) continue;
    
    const dateStr = String(row[1] || '').trim();
    if (!dateStr) continue;
    
    const date = parseDate(dateStr);
    if (!date) continue;
    
    // Column C might be: checkbox (true/false), em-dash, or empty
    const statusCell = row[2];
    const completed = (statusCell === true || statusCell === 'TRUE');
    
    milestones.push({
      name: name,
      date: date,
      dateStr: dateStr,
      completed: completed
    });
  }
  
  if (milestones.length === 0) return null;
  
  const effective = milestones.find(m => m.name === 'Effective Date');
  const closing = milestones.find(m => m.name === 'Closing Date');
  
  // Find next deadline = first uncompleted milestone (excluding Effective Date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcoming = milestones
    .filter(m => m.name !== 'Effective Date' && !m.completed)
    .sort((a, b) => a.date - b.date);
  
  let daysUntil = null;
  let deadlineName = '';
  let deadlineDate = null;
  let status = 'unknown';
  
  if (upcoming.length > 0) {
    const next = upcoming[0];
    deadlineName = next.name;
    deadlineDate = next.date;
    daysUntil = Math.round((next.date - today) / 86400000);
    
    if (deadlineName === 'Closing Date' && daysUntil < 0) {
      status = 'closed';
    } else if (daysUntil < 0) {
      status = 'past_due';
    } else if (daysUntil <= 2) {
      status = 'urgent';
    } else if (daysUntil <= 7) {
      status = 'warning';
    } else {
      status = 'on_track';
    }
  } else if (closing) {
    // All milestones completed — show closing
    daysUntil = Math.round((closing.date - today) / 86400000);
    deadlineName = 'Closing Date';
    deadlineDate = closing.date;
    if (daysUntil < 0) {
      status = 'closed';
    } else if (daysUntil <= 2) {
      status = 'urgent';
    } else if (daysUntil <= 7) {
      status = 'warning';
    } else {
      status = 'on_track';
    }
  }
  
  // Calculate progress numbers (used for rendering the visual bar)
  let progressElapsed = null;
  let progressTotal = null;
  if (effective && closing) {
    const totalDays = Math.round((closing.date - effective.date) / 86400000);
    const elapsedDays = Math.round((today - effective.date) / 86400000);
    if (totalDays > 0) {
      progressTotal = totalDays;
      progressElapsed = Math.max(0, Math.min(elapsedDays, totalDays));
    }
  }
  
  // Apply manual override if set — it takes precedence over auto-computed status
  if (manualOverride) {
    status = manualOverride;
  }
  
  return {
    tabName: tabName,
    sheetId: sheet.getSheetId(),
    agentRef: agentRef,
    propertyDisplay: propertyDisplay,
    side: side,
    effectiveDate: effective ? effective.date : null,
    closingDate: closing ? closing.date : null,
    deadlineName: deadlineName,
    deadlineDate: deadlineDate,
    daysUntil: daysUntil,
    progressElapsed: progressElapsed,
    progressTotal: progressTotal,
    status: status,
    milestones: milestones  // full list (name, date, completed) — used by the agent portal
  };
}

// ============ DASHBOARD: STATUS HELPERS ============
function getStatusColor(status) {
  switch (status) {
    case 'past_due':  return COLOR_PAST_DUE;
    case 'urgent':    return COLOR_URGENT;
    case 'warning':   return COLOR_WARNING;
    case 'on_track':  return COLOR_ON_TRACK;
    case 'active':    return COLOR_ON_TRACK;  // manual override = on track
    case 'on_hold':   return COLOR_ON_HOLD;
    case 'cancelled': return COLOR_CANCELLED;
    case 'closed':    return COLOR_CLOSED;
    default:          return '#9CA3AF';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'past_due':  return '🔴 PAST DUE';
    case 'urgent':    return '🔴 URGENT';
    case 'warning':   return '🟡 WARNING';
    case 'on_track':  return '🟢 ON TRACK';
    case 'active':    return '🟢 Active';
    case 'on_hold':   return '⏸ On Hold';
    case 'cancelled': return '❌ Cancelled';
    case 'closed':    return '✅ Closed';
    default:          return '— UNKNOWN';
  }
}

// Get the dropdown option string that matches an internal status
function statusToDropdownValue(status) {
  switch (status) {
    case 'active':    return '🟢 Active';
    case 'on_hold':   return '⏸ On Hold';
    case 'cancelled': return '❌ Cancelled';
    case 'closed':    return '✅ Closed';
    default:          return '🔄 Auto';
  }
}

function formatDaysUntil(daysUntil, status) {
  // Manual overrides hide the days-until value since deadlines are no longer meaningful
  if (status === 'closed')    return '✅ Closed';
  if (status === 'cancelled') return '❌ Cancelled';
  if (status === 'on_hold')   return '⏸ On Hold';
  if (daysUntil === null) return '—';
  if (daysUntil === 0) return 'TODAY';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
  if (daysUntil === 1) return '1 day';
  return `${daysUntil} days`;
}

function formatDateShort(date) {
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'M/d/yy');
}

function formatDateMedium(date) {
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d');
}

// Build a progress bar string using Unicode block characters
// Returns { text, filledEnd, totalLen } so we can apply per-segment colors via RichText
function buildProgressVisual(elapsed, total, status) {
  const BAR_WIDTH = 8;
  
  // Terminal states get special displays
  if (status === 'cancelled') {
    return { text: '❌ Cancelled', filledEnd: 0, barEnd: 0 };
  }
  if (status === 'closed') {
    const fullBar = '█'.repeat(BAR_WIDTH);
    return { text: fullBar + '  ✅ Closed', filledEnd: BAR_WIDTH, barEnd: BAR_WIDTH };
  }
  
  // No data → show dash
  if (elapsed === null || total === null || total <= 0) {
    return { text: '—', filledEnd: 0, barEnd: 0 };
  }
  
  // Active: build progress bar
  const ratio = Math.min(1, Math.max(0, elapsed / total));
  const filled = Math.round(ratio * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const text = '█'.repeat(filled) + '░'.repeat(empty) + '  Day ' + elapsed + '/' + total;
  
  return { text: text, filledEnd: filled, barEnd: filled + empty };
}

// ============ DASHBOARD: REBUILD ============
function rebuildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashSheet = ss.getSheetByName(DASHBOARD_TAB_NAME);
  
  if (!dashSheet) {
    dashSheet = ss.insertSheet(DASHBOARD_TAB_NAME, 0);
  } else {
    dashSheet.clear();
    // Make sure it's the first tab
    ss.setActiveSheet(dashSheet);
    ss.moveActiveSheet(1);
  }
  
  // Color the tab itself
  dashSheet.setTabColor(COLOR_INDIGO_DEEP);
  
  // Set column widths
  dashSheet.setColumnWidth(1, 290);  // Property (with hyperlink)
  dashSheet.setColumnWidth(2, 100);  // Agent
  dashSheet.setColumnWidth(3, 80);   // Side
  dashSheet.setColumnWidth(4, 90);   // Effective
  dashSheet.setColumnWidth(5, 90);   // Closing
  dashSheet.setColumnWidth(6, 180);  // Progress (visual bar + Day X/Y)
  dashSheet.setColumnWidth(7, 165);  // Next Deadline name
  dashSheet.setColumnWidth(8, 80);   // Deadline date
  dashSheet.setColumnWidth(9, 130);  // Days Until
  dashSheet.setColumnWidth(10, 130); // Status
  
  // ROW 1: Title
  dashSheet.getRange(1, 1, 1, 10).merge();
  dashSheet.getRange(1, 1)
    .setValue('📊 TRANSACTIONS DASHBOARD')
    .setFontWeight('bold')
    .setFontSize(16)
    .setFontColor('#FFFFFF')
    .setBackground(COLOR_INDIGO_DEEP)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(1, 40);
  
  // Read filter state
  const props = PropertiesService.getDocumentProperties();
  const activeOnly = props.getProperty('activeOnly') === 'true';
  
  // Iterate through all sheets and extract transaction data
  const allSheets = ss.getSheets();
  const allTransactions = [];
  
  for (const sheet of allSheets) {
    if (sheet.getName() === DASHBOARD_TAB_NAME) continue;
    try {
      const tabData = extractTabData(sheet);
      if (tabData) allTransactions.push(tabData);
    } catch (e) {
      Logger.log('Error extracting from tab "' + sheet.getName() + '": ' + e);
    }
  }
  
  // Apply active-only filter if enabled
  const transactions = activeOnly
    ? allTransactions.filter(t => t.status !== 'closed' && t.status !== 'cancelled')
    : allTransactions;
  
  // Three-tier sort:
  //   Tier 0: Active deals (anything not closed or cancelled) → top, sorted by Effective Date ASC
  //   Tier 1: Closed deals (successful)                       → middle, sorted by Closing Date DESC
  //   Tier 2: Cancelled deals (dead)                          → bottom, sorted by Closing Date DESC
  // On Hold stays in Tier 0 with active deals since it's just paused, not dead.
  function statusTier(status) {
    if (status === 'cancelled') return 2;
    if (status === 'closed')    return 1;
    return 0;
  }
  
  transactions.sort((a, b) => {
    const ta = statusTier(a.status);
    const tb = statusTier(b.status);
    if (ta !== tb) return ta - tb;
    
    // Same tier — pick the right date to sort by
    if (ta === 0) {
      // Active: by Effective Date ASC (oldest first = closest to closing = most action)
      const ea = a.effectiveDate ? a.effectiveDate.getTime() : Number.MAX_SAFE_INTEGER;
      const eb = b.effectiveDate ? b.effectiveDate.getTime() : Number.MAX_SAFE_INTEGER;
      return ea - eb;
    }
    
    // Closed or Cancelled: by Closing Date DESC (most recent first)
    const ca = a.closingDate ? a.closingDate.getTime() : 0;
    const cb = b.closingDate ? b.closingDate.getTime() : 0;
    return cb - ca;
  });
  
  // Calculate summary stats from ALL transactions (not just filtered) for accurate counts
  const stats = {
    total: allTransactions.length,
    past_due: allTransactions.filter(t => t.status === 'past_due').length,
    urgent: allTransactions.filter(t => t.status === 'urgent').length,
    warning: allTransactions.filter(t => t.status === 'warning').length,
    on_track: allTransactions.filter(t => t.status === 'on_track').length,
    on_hold: allTransactions.filter(t => t.status === 'on_hold').length,
    cancelled: allTransactions.filter(t => t.status === 'cancelled').length,
    closed: allTransactions.filter(t => t.status === 'closed').length
  };
  
  // ROW 2: Summary stats + last refreshed
  const refreshTime = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEE MMM d 'at' h:mm a");
  const summaryParts = [];
  if (activeOnly) {
    summaryParts.push(`🔍 ACTIVE ONLY (${transactions.length} of ${stats.total})`);
  } else {
    summaryParts.push(`📋 Total: ${stats.total}`);
  }
  if (stats.past_due > 0) summaryParts.push(`🔴 Past Due: ${stats.past_due}`);
  if (stats.urgent > 0) summaryParts.push(`🔴 Urgent: ${stats.urgent}`);
  if (stats.warning > 0) summaryParts.push(`🟡 Warning: ${stats.warning}`);
  if (stats.on_track > 0) summaryParts.push(`🟢 On Track: ${stats.on_track}`);
  if (stats.on_hold > 0) summaryParts.push(`⏸ On Hold: ${stats.on_hold}`);
  if (stats.closed > 0) summaryParts.push(`✅ Closed: ${stats.closed}`);
  if (stats.cancelled > 0) summaryParts.push(`❌ Cancelled: ${stats.cancelled}`);
  
  dashSheet.getRange(2, 1, 1, 10).merge();
  dashSheet.getRange(2, 1)
    .setValue(summaryParts.join('   •   '))
    .setFontSize(11)
    .setFontWeight('bold')
    .setFontColor(COLOR_INDIGO_DEEP)
    .setBackground(COLOR_PURPLE_TINT)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(2, 28);
  
  // ROW 3: Last refreshed
  dashSheet.getRange(3, 1, 1, 10).merge();
  dashSheet.getRange(3, 1)
    .setValue(`Last refreshed: ${refreshTime}   •   🛠 TC Tools menu: Refresh, Toggle Active Only`)
    .setFontStyle('italic')
    .setFontSize(10)
    .setFontColor('#6B7280')
    .setHorizontalAlignment('center');
  dashSheet.setRowHeight(3, 22);
  
  // ROW 4: Headers
  const headers = ['Property', 'Agent', 'Side', 'Effective', 'Closing', 'Progress', 'Next Deadline', 'Date', 'Days Until', 'Status'];
  const headerRange = dashSheet.getRange(4, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontColor('#FFFFFF')
    .setBackground(COLOR_INDIGO_NAVY)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true);
  dashSheet.setRowHeight(4, 30);
  
  // ROWS 5+: Transaction data
  let row = 5;
  for (const t of transactions) {
    const isAlt = (row - 5) % 2 === 0;
    const rowBg = isAlt ? '#FAFAF7' : '#FFFFFF';
    
    // Column 1: Property (clickable hyperlink to the tab)
    const escapedAddress = String(t.propertyDisplay).replace(/"/g, '""');
    const propertyCell = dashSheet.getRange(row, 1);
    propertyCell.setFormula(`=HYPERLINK("#gid=${t.sheetId}", "${escapedAddress}")`);
    propertyCell.setFontWeight('bold')
      .setFontColor(COLOR_INDIGO_DEEP)
      .setBackground(rowBg)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('left');
    
    // Column 2: Agent
    dashSheet.getRange(row, 2)
      .setValue(t.agentRef)
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 3: Side
    dashSheet.getRange(row, 3)
      .setValue(t.side || '—')
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 4: Effective
    dashSheet.getRange(row, 4)
      .setValue(formatDateShort(t.effectiveDate))
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 5: Closing
    dashSheet.getRange(row, 5)
      .setValue(formatDateShort(t.closingDate))
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 6: Progress (Day X of Y as visual bar with text inside)
    const visual = buildProgressVisual(t.progressElapsed, t.progressTotal, t.status);
    const progressCell = dashSheet.getRange(row, 6);
    
    // Build rich text with multi-color segments:
    //   filled blocks   → status urgency color (or indigo brand for active states)
    //   empty blocks    → light gray
    //   day count text  → dark gray (readable)
    const filledColor = (t.status === 'closed' || t.status === 'cancelled')
      ? '#9CA3AF'                    // gray for terminal states
      : getStatusColor(t.status);    // urgency-coded for active deals
    
    if (visual.barEnd > 0) {
      const richBuilder = SpreadsheetApp.newRichTextValue()
        .setText(visual.text);

      // Filled segment — only style if non-empty (Apps Script setTextStyle
      // throws "Illegal argument" when start === end, which happens on a
      // brand-new contract whose effective date is today: elapsed = 0).
      if (visual.filledEnd > 0) {
        richBuilder.setTextStyle(0, visual.filledEnd,
          SpreadsheetApp.newTextStyle().setForegroundColor(filledColor).setBold(true).build());
      }

      if (visual.barEnd > visual.filledEnd) {
        richBuilder.setTextStyle(visual.filledEnd, visual.barEnd,
          SpreadsheetApp.newTextStyle().setForegroundColor('#E5E7EB').setBold(true).build());
      }

      if (visual.text.length > visual.barEnd) {
        richBuilder.setTextStyle(visual.barEnd, visual.text.length,
          SpreadsheetApp.newTextStyle().setForegroundColor('#374151').setBold(false).build());
      }

      progressCell.setRichTextValue(richBuilder.build());
    } else {
      progressCell.setValue(visual.text).setFontColor('#9CA3AF');
    }
    
    progressCell.setBackground(rowBg)
      .setFontFamily('Courier New')
      .setFontSize(10)
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    
    // Column 7: Next Deadline name
    dashSheet.getRange(row, 7)
      .setValue(t.deadlineName || '—')
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setFontWeight('bold')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    
    // Column 8: Deadline date
    dashSheet.getRange(row, 8)
      .setValue(formatDateMedium(t.deadlineDate))
      .setBackground(rowBg)
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 9: Days Until (color-coded by status)
    const daysCell = dashSheet.getRange(row, 9);
    daysCell.setValue(formatDaysUntil(t.daysUntil, t.status))
      .setBackground(getStatusColor(t.status))
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Column 10: Status (color-coded label)
    dashSheet.getRange(row, 10)
      .setValue(getStatusLabel(t.status))
      .setBackground(getStatusColor(t.status))
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // Add borders to all cells in row
    dashSheet.getRange(row, 1, 1, 10).setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    dashSheet.setRowHeight(row, 32);
    row++;
  }
  
  // If no transactions found, show a friendly message
  if (transactions.length === 0) {
    dashSheet.getRange(5, 1, 1, 10).merge();
    dashSheet.getRange(5, 1)
      .setValue('No transactions yet. Submit your first one through the form to populate the dashboard!')
      .setFontStyle('italic')
      .setFontSize(12)
      .setFontColor('#6B7280')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    dashSheet.setRowHeight(5, 60);
  }
  
  // Freeze the header rows
  dashSheet.setFrozenRows(4);
  
  // Apply data validation dropdown to the Status column for all transaction rows
  if (transactions.length > 0) {
    const dropdownRange = dashSheet.getRange(5, 10, transactions.length, 1);
    const dropdownRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_DROPDOWN_OPTIONS, true)
      .setAllowInvalid(true)  // allows the auto-computed values (URGENT, WARNING, etc.) to display
      .setHelpText('Pick a manual status, or 🔄 Auto to clear the override and recompute.')
      .build();
    dropdownRange.setDataValidation(dropdownRule);
  }
  
  // Hide gridlines for cleaner look
  dashSheet.setHiddenGridlines(true);
}

// ============ HELPER: HANDLE EDITS ON PROPERTY TABS ============
// Triggers a dashboard rebuild when a meaningful milestone change happens.
// "Meaningful" = checkbox toggle (column 3) on a row that has a known milestone in column 1.
// We DON'T rebuild on every keystroke — only on completed milestone state changes.
function handlePropertyTabEdit(e, sheet) {
  // Only act on column 3 (the checkbox column for milestones)
  if (e.range.getColumn() !== 3) return;
  
  // Must be a single cell edit (not a paste or fill)
  if (e.range.getNumColumns() > 1 || e.range.getNumRows() > 1) return;
  
  // Read the new value — must be a boolean (checkbox toggle)
  const newValue = e.range.getValue();
  if (typeof newValue !== 'boolean') return;
  
  // Verify this row is actually a milestone row by reading column 1
  const milestoneName = String(sheet.getRange(e.range.getRow(), 1).getValue() || '').trim();
  const knownMilestones = [
    'Effective Date', 'Escrow Due', 'Inspection Due', 'Loan Application Due',
    'Loan Approval Due', 'HOA Application', 'HOA Approval', 'Title Commitment',
    'Closing Date', 'Additional Escrow Due'
  ];
  if (!knownMilestones.includes(milestoneName)) return;
  
  // It's a real milestone checkbox toggle — refresh the dashboard
  try {
    rebuildDashboard();
  } catch (err) {
    Logger.log('Auto-refresh error: ' + err.toString());
  }
}

// ============ ONEDIT: HANDLE STATUS DROPDOWN CHANGES + AUTO-REFRESH ============
function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    
    // CASE 1: Edit on a property tab — check if it's a meaningful milestone change
    if (sheetName !== DASHBOARD_TAB_NAME && !sheetName.startsWith('📊') && sheetName.includes('_')) {
      handlePropertyTabEdit(e, sheet);
      return;
    }
    
    // CASE 2: Edit on the dashboard's Status column (manual override)
    if (sheetName !== DASHBOARD_TAB_NAME) return;
    
    // Status column is column 10
    if (e.range.getColumn() !== 10) return;
    
    // Skip header rows (rows 1-4)
    if (e.range.getRow() < 5) return;
    
    const newValue = String(e.value || '').trim();
    if (!newValue) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Find the property tab via the hyperlink formula in column 1
    const propertyCell = sheet.getRange(e.range.getRow(), 1);
    const formula = propertyCell.getFormula();
    const gidMatch = formula.match(/gid=(\d+)/);
    if (!gidMatch) return;
    
    const gid = parseInt(gidMatch[1]);
    const targetSheet = ss.getSheets().find(s => s.getSheetId() === gid);
    if (!targetSheet) return;
    
    // Determine what status was selected
    let statusToWrite = '';
    let displayLabel = '';
    let displayColor = '';
    let isClear = false;
    
    if (newValue.includes('Auto')) {
      isClear = true;
      statusToWrite = '';  // empty = no override
    } else if (newValue.includes('Active')) {
      statusToWrite = 'Active';
      displayLabel = '🟢 Active';
      displayColor = COLOR_ON_TRACK;
    } else if (newValue.includes('On Hold')) {
      statusToWrite = 'On Hold';
      displayLabel = '⏸ On Hold';
      displayColor = COLOR_ON_HOLD;
    } else if (newValue.includes('Cancelled')) {
      statusToWrite = 'Cancelled';
      displayLabel = '❌ Cancelled';
      displayColor = COLOR_CANCELLED;
    } else if (newValue.includes('Closed')) {
      statusToWrite = 'Closed';
      displayLabel = '✅ Closed';
      displayColor = COLOR_CLOSED;
    } else {
      // Unrecognized value — could be auto-computed value the user kept; ignore
      return;
    }
    
    // Find existing "Manual Status:" line in target sheet, or append a new one
    const values = targetSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 0; i < values.length; i++) {
      const cell = String(values[i][0] || '');
      if (cell.startsWith('Manual Status:')) {
        foundRow = i + 1;  // 1-indexed
        break;
      }
    }
    
    const overrideText = `Manual Status: ${statusToWrite}`;
    if (foundRow > 0) {
      targetSheet.getRange(foundRow, 1).setValue(overrideText);
    } else {
      const lastRow = targetSheet.getLastRow();
      targetSheet.getRange(lastRow + 1, 1).setValue(overrideText);
    }
    
    // If user picked "Auto", trigger a full rebuild to recompute the row
    if (isClear) {
      rebuildDashboard();
      return;
    }
    
    // Otherwise update the dashboard cells in place for instant visual feedback
    e.range.setValue(displayLabel)
      .setBackground(displayColor)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10);
    
    // Also update Days Until column (col 9) to match
    sheet.getRange(e.range.getRow(), 9)
      .setValue(formatDaysUntil(null, statusToWrite.toLowerCase().replace(/\s+/g, '_')))
      .setBackground(displayColor)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
      
  } catch (err) {
    Logger.log('onEdit error: ' + err.toString());
  }
}

// ============ MAIN HANDLER ============
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // v7.4 — public review submission from the marketing site
    if (data && data.action === 'review') return _reviewSubmit(data);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!data.tabName || !data.propertyAddress) {
      return jsonResponse({ success: false, error: 'Missing tabName or propertyAddress' });
    }

    if (ss.getSheetByName(data.tabName)) {
      return jsonResponse({
        success: false,
        error: 'A tab named "' + data.tabName + '" already exists. Please rename or remove it first.'
      });
    }

    const sheet = ss.insertSheet(data.tabName);
    let row = 1;

    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 70);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 180);

    // Property Address Header
    sheet.getRange(row, 1, 1, 5).merge();
    sheet.getRange(row, 1)
      .setValue(data.propertyAddress)
      .setFontWeight('bold')
      .setFontSize(14)
      .setFontColor('#A020F0')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(row, 36);
    row++;

    sheet.setRowHeight(row, 8);
    row++;

    // Milestone table header
    sheet.getRange(row, 1, 1, 5).setValues([['Milestone', 'Deadline', '', 'Remarks', '']])
      .setFontWeight('bold')
      .setBackground('#404040')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true);
    sheet.setRowHeight(row, 28);
    row++;

    // Milestones
    if (data.milestones && data.milestones.length > 0) {
      data.milestones.forEach(m => {
        const isEffective = m.name === 'Effective Date';
        const isClosing = m.name === 'Closing Date';
        const formattedAmount = formatCurrency(m.amount || '');

        const rowValues = [m.name || '', m.date || '', '', formattedAmount, m.timeframe || ''];

        const range = sheet.getRange(row, 1, 1, 5);
        range.setValues([rowValues])
          .setVerticalAlignment('middle')
          .setBorder(true, true, true, true, true, true);

        sheet.getRange(row, 1).setHorizontalAlignment('left');
        sheet.getRange(row, 2).setHorizontalAlignment('center');
        sheet.getRange(row, 3).setHorizontalAlignment('center');
        sheet.getRange(row, 4).setHorizontalAlignment('right');
        sheet.getRange(row, 5).setHorizontalAlignment('left').setFontStyle('italic').setFontColor('#666666');

        if (m.status === 'checkbox') {
          sheet.getRange(row, 3).insertCheckboxes();
        }

        if (isEffective) {
          range.setFontWeight('bold').setFontColor('#0000FF');
        } else if (isClosing) {
          range.setBackground('#00FF00').setFontWeight('bold').setFontColor('#000000');
          sheet.getRange(row, 5).setFontStyle('normal').setFontColor('#000000');
        }
        sheet.setRowHeight(row, 26);
        row++;
      });
    }

    // Concessions
    if (data.concessions && data.concessions.length > 0) {
      sheet.setRowHeight(row, 14);
      row++;
      data.concessions.forEach(c => {
        sheet.getRange(row, 1, 1, 5).merge();
        sheet.getRange(row, 1)
          .setValue(c)
          .setFontWeight('bold')
          .setFontColor('#FF00FF')
          .setHorizontalAlignment('left')
          .setVerticalAlignment('middle');
        sheet.setRowHeight(row, 24);
        row++;
      });
    }

    // Details
    if (data.details && data.details.length > 0) {
      sheet.setRowHeight(row, 14);
      row++;
      const sectionStarts = [
        'Property Address:', "Seller(s):", "Seller's Agent:", "Co-Seller's Agent:",
        "Buyer(s):", "Buyer's Agent:", "Co-Buyer's Agent:",
        'Escrow Agent/', 'Seller Title', 'Loan Officer', 'Loan Processor'
      ];

      data.details.forEach(d => {
        if (d === '') {
          sheet.setRowHeight(row, 8);
        } else {
          let displayValue = d;
          if (d.startsWith('Purchase Price:')) {
            const priceText = d.substring('Purchase Price:'.length).trim();
            displayValue = 'Purchase Price: ' + formatCurrency(priceText);
          }
          const cell = sheet.getRange(row, 1);
          cell.setValue(displayValue).setVerticalAlignment('middle');

          const isSectionHeader = sectionStarts.some(s => displayValue.startsWith(s)) ||
                                  displayValue === 'Loan Officer' ||
                                  displayValue === 'Loan Processor' ||
                                  displayValue.startsWith('Escrow Agent/') ||
                                  displayValue.startsWith('Seller Title');

          if (displayValue.startsWith('EFFECTIVE DATE:')) {
            cell.setFontWeight('bold').setFontColor('#0000FF');
          } else if (isSectionHeader) {
            cell.setFontWeight('bold');
          }

          if (displayValue.startsWith('Property Address:') ||
              displayValue.startsWith('Property Tax ID:') ||
              displayValue.startsWith('Purchase Price:') ||
              displayValue.startsWith('Financing Type:')) {
            cell.setFontWeight('bold');
          }
        }
        row++;
      });
    }

    const sheetUrl = ss.getUrl() + '#gid=' + sheet.getSheetId();

    // ============ CREATE CALENDAR EVENTS ============
    let calendarEventsCreated = [];
    try {
      data.sheetUrl = sheetUrl;
      calendarEventsCreated = createCalendarEvents(data);
    } catch (calErr) {
      Logger.log('Calendar error: ' + calErr.toString());
    }

    // ============ REBUILD DASHBOARD ============
    let dashboardRebuilt = false;
    try {
      rebuildDashboard();
      dashboardRebuilt = true;
    } catch (dashErr) {
      Logger.log('Dashboard error: ' + dashErr.toString());
    }

    // ============ CREATE PER-PROPERTY DELIVERABLE ============
    // One private combined Google Sheet in the master sheet's parent folder:
    //   Transaction_Summary_<address> — Critical Deadlines section first,
    //   Transaction Summary section below, both stacked in a single tab.
    // Sheet stays private (only owner has access) per locked policy 3B.
    let deliverableUrl = null;
    let deliverablePdfUrl = null;
    try {
      const parentFolder = _getMasterParentFolder();
      const deliverableSpreadsheet = _buildDeliverableSheet(data, parentFolder);
      deliverableUrl = deliverableSpreadsheet.getUrl();
      // v6.3 — also export a branded PDF alongside the Google Sheet
      try {
        const slug = _shortAddressSlug(data.propertyAddress);
        deliverablePdfUrl = _exportDeliverableAsPdf(deliverableSpreadsheet, parentFolder, slug);
      } catch (pdfErr) {
        Logger.log('PDF export error (non-fatal): ' + pdfErr.toString());
      }
    } catch (delivErr) {
      Logger.log('Deliverable error: ' + delivErr.toString());
    }

    return jsonResponse({
      success: true,
      tabName: data.tabName,
      sheetUrl: sheetUrl,
      calendarEventsCreated: calendarEventsCreated.length,
      calendarEvents: calendarEventsCreated,
      dashboardRebuilt: dashboardRebuilt,
      deliverableUrl: deliverableUrl,
      deliverablePdfUrl: deliverablePdfUrl
    });

  } catch (err) {
    return jsonResponse({ success: false, error: 'Server error: ' + err.toString() });
  }
}

// ============ PER-PROPERTY DELIVERABLES ============

// Find the Drive folder containing the active master spreadsheet.
// Falls back to the user's root if the master sheet is at root level.
function _getMasterParentFolder() {
  const masterId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const file = DriveApp.getFileById(masterId);
  const parents = file.getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

// Build a short address slug for filenames — strip non-alphanumerics from
// the first comma-separated chunk. Matches the form's _emailShortAddress.
function _shortAddressSlug(addr) {
  if (!addr) return 'Property';
  const firstChunk = String(addr).split(',')[0].trim();
  return firstChunk.replace(/[^A-Za-z0-9\s]/g, '').replace(/\s+/g, '_');
}

// Build a single combined Transaction_Summary_<address> Google Sheet
// with two stacked sections in one tab:
//   1. CRITICAL DEADLINES — milestones table at top
//   2. TRANSACTION SUMMARY — property/parties/title/loan info below
// Returns the new sheet's URL. Five-column layout used throughout: deadlines
// occupy all 5 columns, summary uses col 1 for labels and merges cols 2–5
// for values so the unified look stays clean.
function _buildDeliverableSheet(data, parentFolder) {
  const slug = _shortAddressSlug(data.propertyAddress);
  const ss = SpreadsheetApp.create('Transaction_Summary_' + slug);
  const sheet = ss.getActiveSheet();
  sheet.setName('Transaction Summary');

  // Column widths — sized for the deadlines table
  sheet.setColumnWidth(1, 220);  // Milestone / Label
  sheet.setColumnWidth(2, 220);  // Deadline / Value (merged into 2-5 for summary)
  sheet.setColumnWidth(3, 80);   // Status
  sheet.setColumnWidth(4, 150);  // Amount
  sheet.setColumnWidth(5, 200);  // Timeframe

  let row = 1;

  // ===== Property header bar =====
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue(data.propertyAddress || '')
    .setFontWeight('bold').setFontSize(14)
    .setFontColor('#FFFFFF').setBackground(COLOR_INDIGO_DEEP)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontFamily('Arial');
  sheet.setRowHeight(row, 36);
  row++;

  // ===== SECTION 1: CRITICAL DEADLINES =====
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue('CRITICAL DEADLINES')
    .setFontWeight('bold').setFontSize(11)
    .setFontColor('#FFFFFF').setBackground('#312E81')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontFamily('Arial');
  sheet.setRowHeight(row, 22);
  row++;

  // Spacer
  sheet.setRowHeight(row, 8);
  row++;

  // Deadlines table header
  sheet.getRange(row, 1, 1, 5)
    .setValues([['Milestone', 'Deadline', 'Status', 'Amount', 'Timeframe']])
    .setFontWeight('bold').setFontColor('#FFFFFF')
    .setBackground('#374151')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true);
  sheet.setRowHeight(row, 26);
  row++;

  // Milestone rows
  if (data.milestones && data.milestones.length > 0) {
    data.milestones.forEach(function(m) {
      const isEffective = m.name === 'Effective Date';
      const isClosing = m.name === 'Closing Date';
      const formattedAmt = formatCurrency(m.amount || '');

      const range = sheet.getRange(row, 1, 1, 5);
      range.setValues([[m.name || '', m.date || '', '', formattedAmt || '—', m.timeframe || '']])
        .setVerticalAlignment('middle')
        .setBorder(true, true, true, true, true, true);

      sheet.getRange(row, 1).setHorizontalAlignment('left').setFontWeight('bold');
      sheet.getRange(row, 2).setHorizontalAlignment('center');
      sheet.getRange(row, 3).setHorizontalAlignment('center');
      sheet.getRange(row, 4).setHorizontalAlignment('right');
      sheet.getRange(row, 5).setHorizontalAlignment('left').setFontStyle('italic').setFontColor('#6B7280');

      if (m.status === 'checkbox') {
        sheet.getRange(row, 3).insertCheckboxes();
      } else {
        sheet.getRange(row, 3).setValue('—').setFontColor('#9CA3AF');
      }

      if (isEffective) {
        range.setBackground('#DDD6FE').setFontColor('#312E81').setFontWeight('bold');
        sheet.getRange(row, 5).setFontColor('#312E81');
      } else if (isClosing) {
        range.setBackground('#A7F3D0').setFontColor('#064E3B').setFontWeight('bold');
        sheet.getRange(row, 5).setFontColor('#064E3B');
      } else {
        range.setBackground((row % 2 === 0) ? '#FFFFFF' : '#FAFAF7');
      }
      sheet.setRowHeight(row, 26);
      row++;
    });
  }

  // Notes immediately under the deadlines table
  sheet.setRowHeight(row, 8);
  row++;
  const notes = [
    'NOTES',
    '• All deadlines are calculated from the Effective Date unless otherwise noted (CD = Closing Date).',
    '• Any deadline that falls on a Saturday, Sunday, or national legal holiday shall extend to 5:00 PM of the next business day.'
  ];
  notes.forEach(function(line, i) {
    sheet.getRange(row, 1, 1, 5).merge();
    const cell = sheet.getRange(row, 1).setValue(line)
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    if (i === 0) {
      cell.setFontWeight('bold').setFontColor('#312E81').setFontSize(11);
    } else {
      cell.setFontColor('#374151').setFontSize(10);
    }
    sheet.setRowHeight(row, 22);
    row++;
  });

  // ===== SECTION 2: TRANSACTION SUMMARY =====
  sheet.setRowHeight(row, 16);
  row++;
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue('TRANSACTION SUMMARY')
    .setFontWeight('bold').setFontSize(11)
    .setFontColor('#FFFFFF').setBackground('#312E81')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontFamily('Arial');
  sheet.setRowHeight(row, 22);
  row++;

  sheet.setRowHeight(row, 8);
  row++;

  // Render data.details as label/value rows. Section headers (e.g. "Loan
  // Officer", "Escrow Agent / Buyer Title") get an indigo banner spanning
  // all 5 columns; regular "Label: Value" lines split across col 1 (label,
  // gray background) and merged cols 2–5 (value, white).
  const isSectionHeader = function(line) {
    if (line === 'Loan Officer' || line === 'Loan Processor' || line === 'Seller Title') return true;
    if (line.indexOf('Escrow Agent') === 0) return true;
    return false;
  };

  if (data.details && data.details.length > 0) {
    data.details.forEach(function(line) {
      if (line === '' || line === undefined) {
        sheet.setRowHeight(row, 8);
        row++;
        return;
      }
      if (isSectionHeader(line)) {
        sheet.getRange(row, 1, 1, 5).merge();
        sheet.getRange(row, 1).setValue(line)
          .setFontWeight('bold').setFontColor('#FFFFFF')
          .setBackground('#312E81').setFontSize(10)
          .setHorizontalAlignment('left').setVerticalAlignment('middle')
          .setFontFamily('Arial');
        sheet.setRowHeight(row, 22);
        row++;
        return;
      }
      const colonIdx = line.indexOf(':');
      let label = line, value = '';
      if (colonIdx > -1) {
        label = line.substring(0, colonIdx + 1);
        value = line.substring(colonIdx + 1).trim();
        if (label === 'Purchase Price:') {
          value = formatCurrency(value);
        }
      }
      sheet.getRange(row, 1).setValue(label)
        .setFontWeight('bold').setFontColor('#374151')
        .setBackground('#F3F4F6').setVerticalAlignment('middle')
        .setHorizontalAlignment('left').setFontSize(10);
      // Value spans columns 2-5
      sheet.getRange(row, 2, 1, 4).merge();
      sheet.getRange(row, 2).setValue(value)
        .setFontColor('#1A1F2E').setVerticalAlignment('middle')
        .setHorizontalAlignment('left').setFontSize(10);
      // Highlight the EFFECTIVE DATE: line in indigo
      if (line.indexOf('EFFECTIVE DATE') === 0) {
        sheet.getRange(row, 1, 1, 5).setBackground('#DDD6FE').setFontColor('#312E81').setFontWeight('bold');
      }
      sheet.setRowHeight(row, 22);
      row++;
    });
  }

  // Concessions block (only if present)
  if (data.concessions && data.concessions.length > 0) {
    sheet.setRowHeight(row, 12);
    row++;
    sheet.getRange(row, 1, 1, 5).merge();
    sheet.getRange(row, 1).setValue('★ CLOSING COST CONTRIBUTIONS / CONCESSIONS')
      .setFontWeight('bold').setFontColor('#FFFFFF')
      .setBackground('#4338CA').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontFamily('Arial');
    sheet.setRowHeight(row, 24);
    row++;
    data.concessions.forEach(function(c) {
      sheet.getRange(row, 1, 1, 5).merge();
      sheet.getRange(row, 1).setValue('• ' + c)
        .setFontColor('#312E81').setVerticalAlignment('middle')
        .setHorizontalAlignment('left').setFontSize(10)
        .setBackground('#F5F3FF').setWrap(true);
      sheet.setRowHeight(row, 26);
      row++;
    });
  }

  // ===== Footer signature =====
  sheet.setRowHeight(row, 14);
  row++;
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1).setValue(
    'MRFL Transactions  •  Gloria Grullon, TC  •  401.282.8414  •  MRFLTransactions@gmail.com'
  ).setFontStyle('italic').setFontColor('#6B7280').setFontSize(9)
   .setHorizontalAlignment('center');
  sheet.setRowHeight(row, 20);

  // ===== Trim unused rows and columns so the PDF export is tight =====
  // Sheets default to 1000 rows × 26 columns, which would leave acres of
  // whitespace in the exported PDF. Delete everything past the content.
  const lastContentRow = row;
  const maxRows = sheet.getMaxRows();
  if (maxRows > lastContentRow) {
    sheet.deleteRows(lastContentRow + 1, maxRows - lastContentRow);
  }
  const maxCols = sheet.getMaxColumns();
  if (maxCols > 5) {
    sheet.deleteColumns(6, maxCols - 5);
  }

  // Move to master parent folder
  DriveApp.getFileById(ss.getId()).moveTo(parentFolder);

  return ss;
}

// v6.3 — Export the deliverable Google Sheet as a branded PDF and save it
// alongside in the master sheet's parent folder. Uses Sheets' native PDF
// export URL with letter size, portrait orientation, narrow margins, no
// gridlines, no print title. The result is a polished single-document
// PDF that mirrors the brand identity already styled into the Sheet.
function _exportDeliverableAsPdf(spreadsheet, parentFolder, slug) {
  const exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheet.getId() +
    '/export?exportFormat=pdf' +
    '&format=pdf' +
    '&size=letter' +
    '&portrait=true' +
    '&fitw=true' +              // fit to width
    '&top_margin=0.5' +
    '&bottom_margin=0.5' +
    '&left_margin=0.5' +
    '&right_margin=0.5' +
    '&sheetnames=false' +       // no tab name in PDF
    '&printtitle=false' +
    '&pagenumbers=false' +
    '&gridlines=false' +
    '&fzr=false' +              // no frozen-row repeat
    '&horizontal_alignment=CENTER';

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('PDF export failed (HTTP ' + response.getResponseCode() + ')');
  }

  const pdfBlob = response.getBlob().setName('Transaction_Summary_' + slug + '.pdf');
  const pdfFile = parentFolder.createFile(pdfBlob);
  return pdfFile.getUrl();
}

// v6.3 — One-off helper to backfill the branded PDF for an EXISTING
// Transaction_Summary Google Sheet that was created before v6.3 shipped.
//
// HOW TO USE:
//   1. Open the existing Transaction_Summary_<address> Google Sheet
//      in your browser. Its URL looks like:
//        https://docs.google.com/spreadsheets/d/{FILE_ID}/edit
//   2. Copy the FILE_ID portion (the long random string between
//      /d/ and /edit).
//   3. Paste it into the SHEET_FILE_ID line below, replacing the
//      placeholder. Save (⌘S).
//   4. From the Run dropdown at the top of the editor, select
//      `regenerateExistingPdf` → click ▶ Run.
//   5. View → Logs to see where the PDF was saved.
//
// The PDF is placed in the SAME folder as the source Google Sheet, so
// this works for sheets in either the sandbox or production master
// folder.
function regenerateExistingPdf() {
  const SHEET_FILE_ID = 'PASTE_THE_SHEET_FILE_ID_HERE';

  if (!SHEET_FILE_ID || SHEET_FILE_ID.indexOf('PASTE_') === 0) {
    throw new Error(
      'Edit the SHEET_FILE_ID line at the top of regenerateExistingPdf() ' +
      'with the file ID of the Transaction_Summary Google Sheet you want ' +
      'to backfill. See the comment above the function for how to find it.'
    );
  }

  const file = DriveApp.getFileById(SHEET_FILE_ID);
  const spreadsheet = SpreadsheetApp.openById(SHEET_FILE_ID);
  const parents = file.getParents();
  const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  const slug = file.getName().replace(/^Transaction_Summary_/, '');
  Logger.log('Regenerating PDF for: ' + file.getName());
  Logger.log('Source Sheet folder: ' + parentFolder.getName());

  const pdfUrl = _exportDeliverableAsPdf(spreadsheet, parentFolder, slug);
  Logger.log('✅ PDF created: ' + pdfUrl);
  return pdfUrl;
}

// ============ HELPER ============
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// v6.6 — AGENT PORTAL ENDPOINT + PRIVATE LINKS
//
// Lets each realtor view their own transactions in a read-only
// web app (portal/index.html on Vercel). Access is via a private
// per-agent key stored in Script Properties; the endpoint returns
// ONLY that agent's deals. Keys are generated and shared from the
// sheet menu: 🛠 TC Tools → 🔗 Agent portal links.
// ============================================================

// Canonical host is Gloria's custom domain (GoDaddy → Vercel). The old
// mrfl-transactions.vercel.app host stays attached, so links already
// shared with agents keep working.
const PORTAL_BASE_URL = 'https://mrfltransactions.com/portal/';
const SITE_BASE_URL = 'https://mrfltransactions.com/';               // public site
const REFER_BASE_URL = SITE_BASE_URL + 'refer/';                     // referral landing

function _portalKeyProp(agentRef) {
  return 'portal_key_' + String(agentRef || '').trim().toLowerCase();
}

function _portalRandomKey() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';  // unambiguous charset
  let s = '';
  for (let i = 0; i < 20; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function _portalIso(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Distinct agent refs from transaction tab names ("Martha_510 SW..." → "Martha"),
// preserving the casing of the first occurrence.
function _portalListAgents() {
  const seen = {};
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (name.startsWith('📊') || !name.includes('_')) return;
    const ref = name.substring(0, name.indexOf('_')).trim();
    if (ref && !seen[ref.toLowerCase()]) seen[ref.toLowerCase()] = ref;
  });
  return Object.keys(seen).map(k => seen[k]).sort();
}

// Parse a property tab's details block (written by doPost from the intake
// form) into display sections for the portal: parties, agents, title
// companies, lender, HOA, concessions. Generic label:value capture, so new
// intake fields flow through without portal changes.
function _portalDetailsFromValues(values) {
  const skipPrefixes = ['Property Address:', 'EFFECTIVE DATE:', 'Side Represented:', 'Manual Status:'];
  const standalone = [
    ['Escrow Agent/ Buyer Title', 'Buyer title / escrow'],
    ['Escrow Agent/ Title', 'Title / escrow'],
    ['Seller Title', 'Seller title'],
    ['Loan Officer', 'Loan officer'],
    ['Loan Processor', 'Loan processor'],
    ['HOA / Association', 'HOA / Association']
  ];
  const partyStarts = [
    ['Seller(s):', 'Seller'],
    ['Buyer(s):', 'Buyer'],
    ["Seller's Agent:", 'Listing agent'],
    ["Co-Seller's Agent:", 'Co-listing agent'],
    ["Buyer's Agent:", "Buyer's agent"],
    ["Co-Buyer's Agent:", "Co-buyer's agent"]
  ];

  const txn = { title: 'Transaction', items: [] };
  const sections = [];
  const concessions = [];
  let current = null;
  let inDetails = false;

  for (let i = 1; i < values.length; i++) {  // skip row 1 (property header)
    const line = String(values[i][0] || '').trim();
    if (!line) continue;
    if (line === 'Milestone') continue;
    if (CAL_KNOWN_MILESTONES.indexOf(line) >= 0) continue;

    if (!inDetails) {
      if (line.indexOf('Property Address:') === 0) { inDetails = true; continue; }
      // Older tabs may lack the "Property Address:" marker line — also enter
      // details mode on any recognizable detail line, so nothing gets misfiled
      // as a concession.
      const looksDetail =
        ['Property Tax ID:', 'Purchase Price:', 'Financing Type:', 'EFFECTIVE DATE:', 'Side Represented:', 'Manual Status:']
          .some(function (p) { return line.indexOf(p) === 0; }) ||
        partyStarts.some(function (ps) { return line.indexOf(ps[0]) === 0; }) ||
        standalone.some(function (st) { return line === st[0]; });
      if (!looksDetail) { concessions.push(line); continue; }
      inDetails = true;  // fall through and process this line normally
    }
    if (skipPrefixes.some(function (p) { return line.indexOf(p) === 0; })) continue;

    // Standalone section headers (no colon-value on the line)
    let handled = false;
    for (let s = 0; s < standalone.length; s++) {
      if (line === standalone[s][0]) {
        current = { title: standalone[s][1], items: [] };
        sections.push(current);
        handled = true;
        break;
      }
    }
    if (handled) continue;

    // Section-starting "Label: value" lines (parties and agents)
    for (let p = 0; p < partyStarts.length; p++) {
      if (line.indexOf(partyStarts[p][0]) === 0) {
        current = { title: partyStarts[p][1], items: [] };
        sections.push(current);
        const v = line.substring(partyStarts[p][0].length).trim();
        if (v) current.items.push({ label: 'Name', value: v });
        handled = true;
        break;
      }
    }
    if (handled) continue;

    // Generic "Label: value" line → goes to the current section (or Transaction)
    const idx = line.indexOf(':');
    if (idx > 0 && idx <= 40) {
      const label = _portalPrettyLabel(line.substring(0, idx));
      const value = line.substring(idx + 1).trim();
      if (!value) continue;
      (current || txn).items.push({ label: label, value: value });
    }
  }

  const out = [];
  if (txn.items.length) out.push(txn);
  sections.forEach(function (s) { if (s.items.length) out.push(s); });
  if (concessions.length) {
    out.push({
      title: 'Concessions',
      items: concessions.map(function (c) { return { label: '', value: c }; })
    });
  }
  return out;
}

function _portalPrettyLabel(label) {
  let l = String(label || '').trim();
  if (l === 'Seller(s)' || l === 'Buyer(s)') return 'Name';
  l = l.replace(/^Seller\(s\)\s+/, '').replace(/^Buyer\(s\)\s+/, '');
  if (l === 'Co-Brokerage') return 'Brokerage';
  l = l.replace(/^Co-Brokerage\s+/, '').replace(/^Co-Agent\s+/, '').replace(/^Agent\s+/, '');
  return l;
}

// GET ?view=portal&agent=X&key=Y → that agent's deals (or an error).
function portalResponse_(params) {
  const agent = String(params.agent || '').trim();
  const key = String(params.key || '').trim();
  if (!agent || !key) {
    return jsonResponse({ success: false, error: 'This link is incomplete. Ask Gloria for a fresh portal link.' });
  }
  const stored = PropertiesService.getScriptProperties().getProperty(_portalKeyProp(agent));
  if (!stored || stored !== key) {
    return jsonResponse({ success: false, error: 'This link is not valid anymore. Ask Gloria for a fresh portal link.' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wanted = agent.toLowerCase();
  let displayRef = agent;
  const deals = [];

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (name.startsWith('📊') || !name.includes('_')) return;
    const ref = name.substring(0, name.indexOf('_')).trim();
    if (ref.toLowerCase() !== wanted) return;
    displayRef = ref;
    let d = null;
    try { d = extractTabData(sheet); } catch (err) { return; }
    if (!d) return;
    let details = [];
    try { details = _portalDetailsFromValues(sheet.getDataRange().getValues()); } catch (err) { details = []; }
    deals.push({
      property: d.propertyDisplay,
      side: d.side || '',
      status: d.status,
      effective_date: _portalIso(d.effectiveDate),
      closing_date: _portalIso(d.closingDate),
      next_deadline: d.deadlineName || '',
      next_deadline_date: _portalIso(d.deadlineDate),
      days_until: (typeof d.daysUntil === 'number') ? d.daysUntil : null,
      progress_elapsed: d.progressElapsed,
      progress_total: d.progressTotal,
      milestones: (d.milestones || []).map(m => ({
        name: m.name,
        date: _portalIso(m.date),
        completed: !!m.completed
      })),
      details: details
    });
  });

  // Active deals first (soonest closing first), then closed/cancelled/on-hold.
  const doneStatuses = ['closed', 'cancelled'];
  deals.sort((a, b) => {
    const aDone = doneStatuses.indexOf(a.status) >= 0 ? 1 : 0;
    const bDone = doneStatuses.indexOf(b.status) >= 0 ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return String(a.closing_date).localeCompare(String(b.closing_date));
  });

  return jsonResponse({
    success: true,
    agent: displayRef,
    generated_at: new Date().toISOString(),
    deals: deals
  });
}

// Base64url without padding — used to pack the web-app URL into portal links
// so the public portal page never hardcodes this endpoint.
function _portalB64Url(s) {
  return Utilities.base64EncodeWebSafe(s, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

// Menu: generate (if needed) and show each agent's private portal link.
function showPortalLinks() {
  const ui = SpreadsheetApp.getUi();
  const agents = _portalListAgents();
  if (agents.length === 0) {
    ui.alert('No transaction tabs found yet — portal links appear once you have deals in the sheet.');
    return;
  }

  // Use the SAME webhook URL the intake form uses — stored once, then reused.
  // (Auto-detecting via ScriptApp.getService().getUrl() proved unreliable when
  // multiple deployments exist; the stored URL is deterministic.)
  const props = PropertiesService.getScriptProperties();
  let execUrl = props.getProperty('portal_webapp_url') || '';
  if (!execUrl) {
    const resp = ui.prompt(
      'Portal setup — one time',
      'Paste your webhook URL — the SAME one saved in the intake form under ' +
      '⚙ Connection Settings → Apps Script Webhook URL.\n\n' +
      'It looks like: https://script.google.com/macros/s/…/exec',
      ui.ButtonSet.OK_CANCEL
    );
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    execUrl = String(resp.getResponseText() || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(execUrl)) {
      ui.alert('That doesn\'t look like a webhook URL. It must start with ' +
        'https://script.google.com/macros/s/ and end with /exec. ' +
        'Copy it from the intake form\'s ⚙ Connection Settings and try again.');
      return;
    }
    props.setProperty('portal_webapp_url', execUrl);
  }

  // v6.9 — widget data key (protects the widget view now that the portal page
  // publishes the webhook URL). Generated once; shown in the dialog footer.
  let widgetKey = props.getProperty('widget_key');
  if (!widgetKey) {
    widgetKey = _portalRandomKey();
    props.setProperty('widget_key', widgetKey);
  }

  const rows = agents.map(function (ref, i) {
    let key = props.getProperty(_portalKeyProp(ref));
    if (!key) {
      key = _portalRandomKey();
      props.setProperty(_portalKeyProp(ref), key);
    }
    // v6.9 — short link; the portal page knows the webhook URL itself.
    const link = PORTAL_BASE_URL + '?a=' + encodeURIComponent(ref) + '&k=' + key;
    const msg = 'Hi ' + ref + '! 🏡 I set up a private portal for your transactions with me. ' +
      'Your personal link shows your deals live — timelines, deadlines, and every contact on the file:\n\n' +
      link + '\n\n' +
      'On your phone: open it, then Share → Add to Home Screen, and it works like an app. ' +
      'It updates automatically whenever anything changes. This link is just for you — please don\'t forward it.\n\n' +
      '— Gloria · MRFL Transactions';
    return '<tr>' +
      '<td style="padding:10px 12px 10px 0;font-weight:600;white-space:nowrap;vertical-align:top">' + _hoaEsc(ref) + '</td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #F3F4F6">' +
      '<input type="text" readonly value="' + link + '" data-copylink ' +
      'style="width:100%;font-size:11px;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
      '<span style="display:none;color:#10B981;font-size:11px;margin-left:6px">Link copied!</span>' +
      '<div style="margin-top:6px">' +
      '<button type="button" data-copymsg="m_' + i + '" ' +
      'style="background:#4338CA;color:#fff;border:none;padding:6px 12px;border-radius:5px;' +
      'font-size:12px;font-weight:700;cursor:pointer">📋 Copy invite message</button>' +
      '<span style="display:none;color:#10B981;font-size:11px;margin-left:8px">Message copied — paste into a text or email!</span>' +
      '</div>' +
      '<textarea id="m_' + i + '" readonly ' +
      'style="position:absolute;left:-9999px;top:0;width:300px;height:200px">' + _hoaEsc(msg) + '</textarea>' +
      '</td></tr>';
  }).join('');

  const html = '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5">' +
    '<p><b>Each agent gets their own private link.</b> Click a link to copy just the link, or use ' +
    '<b>📋 Copy invite message</b> for a friendly ready-to-send text with the link included.</p>' +
    '<p style="color:#991B1B">Only send each agent <b>their own</b> link — a link shows that agent\'s deals to whoever has it.</p>' +
    '<table style="width:100%;border-collapse:collapse">' + rows + '</table>' +
    '<div style="margin-top:14px;padding:10px;border:1px solid #FDE68A;background:#FFFBEB;border-radius:6px">' +
    '<b>📱 Your widget URL (one-time update):</b> widget data is now key-protected. ' +
    'Paste this full URL into your iPhone widget / widget web page settings:<br>' +
    '<input type="text" readonly value="' + _hoaEsc(execUrl + '?days=4&key=' + widgetKey) + '" data-copylink ' +
    'style="width:100%;font-size:11px;padding:6px;margin-top:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<span style="display:none;color:#10B981;font-size:11px;margin-left:6px">Copied!</span></div>' +
    '<p style="color:#9CA3AF;font-size:11px;margin-top:10px">Links use the webhook URL ending ' +
    '“…' + execUrl.slice(-14) + '”. To point them at a different webhook URL, delete the ' +
    '<b>portal_webapp_url</b> row under Apps Script → Project Settings → Script Properties, ' +
    'then open this dialog again.</p>' +
    '<script>' +
    'function _fb(el){if(!el)return;el.style.display="inline";setTimeout(function(){el.style.display="none";},1800);}' +
    'document.querySelectorAll("[data-copylink]").forEach(function(inp){' +
    'inp.addEventListener("click",function(){this.select();document.execCommand("copy");_fb(this.nextElementSibling);});});' +
    'document.querySelectorAll("[data-copymsg]").forEach(function(btn){' +
    'btn.addEventListener("click",function(){' +
    'var t=document.getElementById(this.getAttribute("data-copymsg"));' +
    't.style.left="0";t.select();document.execCommand("copy");t.style.left="-9999px";' +
    'window.getSelection&&window.getSelection().removeAllRanges();' +
    '_fb(this.nextElementSibling);});});' +
    '<\/script></div>';

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(680).setHeight(Math.min(190 + agents.length * 92, 600)),
    '🔗 Agent portal links'
  );
}

// ============================================================
// v6.8 — HOA INFO DIALOG (add/update mid-transaction)
//
// HOA details often arrive after the contract is opened. This menu
// dialog writes a correctly-formatted "HOA / Association" section into
// the active property tab (and optionally HOA milestone dates), so the
// info flows to the dashboard, deliverables, and the agent portal.
// ============================================================

const HOA_SECTION_HEADER = 'HOA / Association';
const HOA_FIELDS = [
  ['association', 'Association'],
  ['mgmt', 'Management Company'],
  ['contact', 'Contact'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['estoppel', 'Estoppel Fee']
];

function _hoaEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Locate the existing HOA section (1-indexed rows, header included), or null.
function _hoaSectionRange(values) {
  const stoppers = ['Seller Title', 'Loan Officer', 'Loan Processor',
    'Escrow Agent/ Title', 'Escrow Agent/ Buyer Title'];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== HOA_SECTION_HEADER) continue;
    let end = i + 1;
    for (let j = i + 1; j < values.length; j++) {
      const l = String(values[j][0] || '').trim();
      if (!l || stoppers.indexOf(l) >= 0 || l.indexOf(':') < 0) break;
      end = j + 1;
    }
    return { start: i + 1, end: end };
  }
  return null;
}

// Read current HOA values (details section + milestone dates) for prefill.
function _hoaReadExisting(values) {
  const out = { association: '', mgmt: '', contact: '', email: '', phone: '', estoppel: '', appDate: '', approvalDate: '' };
  const sec = _hoaSectionRange(values);
  if (sec) {
    for (let r = sec.start; r < sec.end; r++) {  // rows after the header
      const line = String(values[r][0] || '').trim();
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const label = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      for (let f = 0; f < HOA_FIELDS.length; f++) {
        if (HOA_FIELDS[f][1] === label) { out[HOA_FIELDS[f][0]] = value; break; }
      }
    }
  }
  const tz = Session.getScriptTimeZone();
  for (let i = 0; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    if (name !== 'HOA Application' && name !== 'HOA Approval') continue;
    const raw = values[i][1];
    const d = (raw instanceof Date) ? raw : parseDate(String(raw || '').trim());
    if (!d) continue;
    const isoStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    if (name === 'HOA Application') out.appDate = isoStr; else out.approvalDate = isoStr;
  }
  return out;
}

function showHoaDialog() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name = sheet.getName();
  if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) {
    ui.alert('Open the property tab you want to add HOA info to, then run this again.');
    return;
  }
  const values = sheet.getDataRange().getValues();
  const cur = _hoaReadExisting(values);
  const property = String(values[0][0] || name).trim();

  const field = (id, label, placeholder) =>
    '<label style="display:block;margin:10px 0 3px;font-weight:600">' + label + '</label>' +
    '<input id="' + id + '" type="text" value="' + _hoaEsc(cur[id]) + '" placeholder="' + placeholder + '" ' +
    'style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">';
  const dateField = (id, label) =>
    '<label style="display:block;margin:10px 0 3px;font-weight:600">' + label + '</label>' +
    '<input id="' + id + '" type="date" value="' + _hoaEsc(cur[id]) + '" ' +
    'style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">';

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.4">' +
    '<p style="margin:0 0 4px;color:#4B5563">Fill in what you have — empty fields are simply left out. ' +
    'This updates the tab, the agent portal, and (if dates are set) the milestone table.</p>' +
    field('association', 'Association name', 'Sunset Ridge HOA') +
    field('mgmt', 'Management company', 'ABC Property Mgmt') +
    field('contact', 'Contact name', 'Jane Manager') +
    field('email', 'Contact email', 'hoa@example.com') +
    field('phone', 'Contact phone', '(555) 123-4567') +
    field('estoppel', 'Estoppel fee', '$250.00') +
    '<div style="display:flex;gap:10px"><div style="flex:1">' +
    dateField('appDate', 'HOA Application deadline') + '</div><div style="flex:1">' +
    dateField('approvalDate', 'HOA Approval deadline') + '</div></div>' +
    '<div id="out" style="margin-top:10px;color:#10B981;font-weight:600"></div>' +
    '<div style="margin-top:14px;text-align:right">' +
    '<button id="save" style="background:#4338CA;color:#fff;border:none;padding:9px 18px;' +
    'border-radius:6px;font-weight:700;cursor:pointer">Save HOA info</button></div>' +
    '<script>' +
    'document.getElementById("save").onclick=function(){' +
    'var b=this;b.disabled=true;b.textContent="Saving…";' +
    'var f={};["association","mgmt","contact","email","phone","estoppel","appDate","approvalDate"]' +
    '.forEach(function(id){f[id]=document.getElementById(id).value.trim();});' +
    'f.sheetId=' + sheet.getSheetId() + ';' +
    'google.script.run.withSuccessHandler(function(res){' +
    'if(res&&res.datesSaved){' +
    'document.body.innerHTML=\'<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;padding:10px 6px">\'+' +
    '\'<h3 style="margin:0 0 8px">📅 One more click for calendar reminders</h3>\'+' +
    '\'<p style="margin:0 0 6px;color:#4B5563">\'+(res.msg||"Saved.")+\'</p>\'+' +
    '\'<p style="margin:0 0 16px;color:#4B5563">Deadline dates added by this form need a quick sync to show on your Google Calendar.</p>\'+' +
    '\'<button id="syncnow" style="background:#4338CA;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:700;cursor:pointer">📅 Sync calendar now</button>\'+' +
    '\'<button id="later" style="background:#fff;color:#4338CA;border:1px solid #4338CA;padding:10px 16px;border-radius:6px;font-weight:700;cursor:pointer;margin-left:8px">Later</button>\'+' +
    '\'<div id="out2" style="margin-top:12px;font-weight:600;color:#10B981"></div></div>\';' +
    'document.getElementById("syncnow").onclick=function(){' +
    'var sb=this;sb.disabled=true;sb.textContent="Syncing…";' +
    'google.script.run.withSuccessHandler(function(m){' +
    'document.getElementById("out2").textContent=m;setTimeout(function(){google.script.host.close();},2400);' +
    '}).withFailureHandler(function(e){' +
    'document.getElementById("out2").style.color="#991B1B";' +
    'document.getElementById("out2").textContent="Sync error: "+e.message+" — you can run 🔄 Sync dates → Calendar from the menu.";' +
    'sb.disabled=false;sb.textContent="📅 Sync calendar now";' +
    '}).syncCalendarForDialog(' + sheet.getSheetId() + ');};' +
    'document.getElementById("later").onclick=function(){' +
    'document.getElementById("out2").style.color="#92400E";' +
    'document.getElementById("out2").textContent="OK — remember: 🛠 TC Tools → 🔄 Sync dates → Calendar when you\\u2019re ready.";' +
    'setTimeout(function(){google.script.host.close();},2800);};' +
    '}else{' +
    'document.getElementById("out").textContent=(res&&res.msg)||"✓ Saved";' +
    'setTimeout(function(){google.script.host.close();},1600);}' +
    '}).withFailureHandler(function(e){' +
    'document.getElementById("out").style.color="#991B1B";' +
    'document.getElementById("out").textContent="Error: "+e.message;b.disabled=false;b.textContent="Save HOA info";' +
    '}).saveHoaInfo(f);};' +
    '<\/script></div>';

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(430).setHeight(600),
    '🏘 HOA information — ' + property
  );
}

function saveHoaInfo(f) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(s => s.getSheetId() === Number(f.sheetId));
  if (!sheet) throw new Error('Could not find the property tab. Close the dialog and try again.');

  // ---- 1. Details section: replace existing or append ----
  const lines = [];
  for (let i = 0; i < HOA_FIELDS.length; i++) {
    const v = String(f[HOA_FIELDS[i][0]] || '').trim();
    if (v) lines.push(HOA_FIELDS[i][1] + ': ' + v);
  }

  let values = sheet.getDataRange().getValues();
  const sec = _hoaSectionRange(values);
  let detailsMsg = '';
  if (lines.length > 0) {
    let insertAt;
    if (sec) {
      sheet.deleteRows(sec.start, sec.end - sec.start + 1);
      sheet.insertRowsBefore(sec.start, lines.length + 1);
      insertAt = sec.start;
      detailsMsg = 'HOA details updated';
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow + lines.length + 2 > sheet.getMaxRows()) {
        sheet.insertRowsAfter(sheet.getMaxRows(), lines.length + 2);
      }
      insertAt = lastRow + 2;  // one blank spacer row
      detailsMsg = 'HOA details added';
    }
    sheet.getRange(insertAt, 1).setValue(HOA_SECTION_HEADER).setFontWeight('bold');
    for (let i = 0; i < lines.length; i++) {
      sheet.getRange(insertAt + 1 + i, 1).setValue(lines[i]).setFontWeight('normal');
    }
  } else if (sec) {
    detailsMsg = 'HOA details unchanged';
  }

  // ---- 2. Milestone rows: update in place, or insert before Closing Date ----
  const tz = Session.getScriptTimeZone();
  const toDisplay = (isoStr) => {
    const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return Utilities.formatDate(new Date(+m[1], +m[2] - 1, +m[3]), tz, 'MM/dd/yyyy');
  };
  const wanted = [];
  if (f.appDate) wanted.push(['HOA Application', toDisplay(f.appDate)]);
  if (f.approvalDate) wanted.push(['HOA Approval', toDisplay(f.approvalDate)]);

  let datesMsg = '';
  if (wanted.length > 0) {
    values = sheet.getDataRange().getValues();  // re-read after section edits
    let closingRow = -1;
    const existingRow = {};
    for (let i = 0; i < values.length; i++) {
      const n = String(values[i][0] || '').trim();
      if (n === 'Closing Date' && closingRow < 0) closingRow = i + 1;
      if (n === 'HOA Application' || n === 'HOA Approval') existingRow[n] = i + 1;
    }
    let added = 0, updated = 0;
    wanted.forEach(function (w) {
      if (existingRow[w[0]]) {
        sheet.getRange(existingRow[w[0]], 2).setValue(w[1]);
        updated++;
      } else if (closingRow > 0) {
        sheet.insertRowBefore(closingRow);
        const range = sheet.getRange(closingRow, 1, 1, 5);
        range.setValues([[w[0], w[1], '', '', '']])
          .setVerticalAlignment('middle')
          .setBorder(true, true, true, true, true, true)
          .setBackground(null).setFontWeight('normal').setFontColor('#000000');
        sheet.getRange(closingRow, 1).setHorizontalAlignment('left');
        sheet.getRange(closingRow, 2).setHorizontalAlignment('center');
        sheet.getRange(closingRow, 3).insertCheckboxes();
        sheet.setRowHeight(closingRow, 26);
        closingRow++;  // keep inserting above Closing Date, preserving order
        added++;
      }
    });
    datesMsg = (updated ? updated + ' deadline' + (updated > 1 ? 's' : '') + ' updated' : '') +
      (updated && added ? ', ' : '') +
      (added ? added + ' deadline' + (added > 1 ? 's' : '') + ' added' : '');
  }

  try { rebuildDashboard(); } catch (e) { /* non-fatal */ }

  // datesSaved tells the dialog to show the "Sync calendar now" reminder —
  // script-written dates don't fire the calendar onEdit trigger.
  return {
    msg: '✓ ' + [detailsMsg, datesMsg].filter(String).join(' · '),
    datesSaved: wanted.length > 0
  };
}

// ============================================================
// v7.7 — ADD / UPDATE TRANSACTION DETAILS (mid-deal)
//
// Same idea as the HOA dialog, generalized to the contact sections an
// agent most often forgets to add up front: both title companies and
// the lender. Writes full "Label: value" lines into column A — the
// exact format the portal, dashboard, and deliverables all re-read —
// replacing an existing section in place or appending a new one.
// ============================================================

// Sections this dialog can edit. Each: menu title, canonical sheet
// header, header alias(es) used to find an existing block, and the
// ordered fields (id, sheet-label, placeholder). Labels match what the
// intake form writes so the sheet stays consistent.
const DETAIL_EDIT_SECTIONS = [
  {
    key: 'buyertitle',
    title: 'Closing / Title company (buyer side)',
    headerAliases: ['Escrow Agent/ Buyer Title', 'Escrow Agent/ Title'],
    defaultHeader: 'Escrow Agent/ Title',
    fields: [['company', 'Company', 'Sunshine Title, LLC'], ['contact', 'Contact', 'Jane Closer'], ['email', 'Email', 'closings@title.com'], ['phone', 'Phone', '(555) 123-4567']]
  },
  {
    key: 'sellertitle',
    title: "Seller's title company",
    headerAliases: ['Seller Title'],
    defaultHeader: 'Seller Title',
    fields: [['company', 'Company', 'Seller Title Co.'], ['contact', 'Contact', ''], ['email', 'Email', ''], ['phone', 'Phone', '']]
  },
  {
    key: 'loanofficer',
    title: 'Loan Officer',
    headerAliases: ['Loan Officer'],
    defaultHeader: 'Loan Officer',
    fields: [['company', 'Company', 'ABC Mortgage'], ['contact', 'Contact', ''], ['email', 'Email', ''], ['mobile', 'Mobile', '']]
  },
  {
    key: 'loanprocessor',
    title: 'Loan Processor',
    headerAliases: ['Loan Processor'],
    defaultHeader: 'Loan Processor',
    fields: [['company', 'Company', ''], ['contact', 'Contact', ''], ['email', 'Email', ''], ['mobile', 'Mobile', '']]
  }
];

// Standalone-header names + party-start prefixes — used as boundaries so
// one section's block never bleeds into the next when we scan its extent.
const DETAIL_ALL_HEADERS = ['Escrow Agent/ Buyer Title', 'Escrow Agent/ Title', 'Seller Title', 'Loan Officer', 'Loan Processor', 'HOA / Association'];
const DETAIL_PARTY_STARTS = ["Seller(s):", "Buyer(s):", "Seller's Agent:", "Co-Seller's Agent:", "Buyer's Agent:", "Co-Buyer's Agent:"];

// Locate a standalone-header section's row range (1-indexed, header row
// included). Returns { start, end, header } or null.
function _detailSectionRange(values, headerAliases) {
  for (let i = 0; i < values.length; i++) {
    const l = String(values[i][0] || '').trim();
    if (headerAliases.indexOf(l) < 0) continue;
    let end = i + 1;  // header only, if it has no value rows
    for (let j = i + 1; j < values.length; j++) {
      const line = String(values[j][0] || '').trim();
      if (!line) break;
      if (DETAIL_ALL_HEADERS.indexOf(line) >= 0) break;
      if (DETAIL_PARTY_STARTS.some(function (p) { return line.indexOf(p) === 0; })) break;
      if (line.indexOf(':') < 0) break;
      end = j + 1;
    }
    return { start: i + 1, end: end, header: l };
  }
  return null;
}

// Read current section values keyed as "<sectionkey>_<fieldid>" for prefill.
function _detailReadExisting(values) {
  const out = {};
  DETAIL_EDIT_SECTIONS.forEach(function (sec) {
    sec.fields.forEach(function (f) { out[sec.key + '_' + f[0]] = ''; });
    const range = _detailSectionRange(values, sec.headerAliases);
    if (!range) return;
    for (let r = range.start; r < range.end; r++) {
      const line = String(values[r][0] || '').trim();
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const label = line.substring(0, idx).trim().toLowerCase();
      const value = line.substring(idx + 1).trim();
      sec.fields.forEach(function (f) {
        if (f[1].toLowerCase() === label) out[sec.key + '_' + f[0]] = value;
      });
    }
  });
  return out;
}

function showDetailsDialog() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name = sheet.getName();
  if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) {
    ui.alert('Open the property tab you want to update, then run 🛠 TC Tools → ✏️ Add / update details again.');
    return;
  }
  const values = sheet.getDataRange().getValues();
  const cur = _detailReadExisting(values);
  const property = String(values[0][0] || name).trim();

  let body = '';
  const allIds = [];
  DETAIL_EDIT_SECTIONS.forEach(function (sec) {
    body += '<div style="margin:16px 0 4px;font-weight:700;color:#312E81;border-bottom:1px solid #E5E7EB;padding-bottom:3px">' +
      _hoaEsc(sec.title) + '</div>';
    sec.fields.forEach(function (fld) {
      const id = sec.key + '_' + fld[0];
      allIds.push(id);
      body += '<label style="display:block;margin:8px 0 2px;font-weight:600;font-size:12px">' + _hoaEsc(fld[1]) + '</label>' +
        '<input id="' + id + '" type="text" value="' + _hoaEsc(cur[id]) + '" placeholder="' + _hoaEsc(fld[2]) + '" ' +
        'style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:13px">';
    });
  });

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.4">' +
    '<p style="margin:0 0 4px;color:#4B5563">Fill in whatever you need to add or change — blank fields are left as they are. ' +
    'Saving updates this tab, the agent portal, and your dashboard right away. ' +
    '(HOA info has its own 🏘 button; other parties can be edited directly in the tab.)</p>' +
    body +
    '<div id="out" style="margin-top:12px;color:#10B981;font-weight:600"></div>' +
    '<div style="margin-top:14px;text-align:right">' +
    '<button id="save" style="background:#4338CA;color:#fff;border:none;padding:9px 18px;' +
    'border-radius:6px;font-weight:700;cursor:pointer">Save details</button></div>' +
    '<script>' +
    'var IDS=' + JSON.stringify(allIds) + ';' +
    'document.getElementById("save").onclick=function(){' +
    'var b=this;b.disabled=true;b.textContent="Saving…";' +
    'var f={sheetId:' + sheet.getSheetId() + '};' +
    'IDS.forEach(function(id){f[id]=document.getElementById(id).value.trim();});' +
    'google.script.run.withSuccessHandler(function(res){' +
    'document.getElementById("out").textContent=(res&&res.msg)||"✓ Saved";' +
    'setTimeout(function(){google.script.host.close();},2400);' +
    '}).withFailureHandler(function(e){' +
    'document.getElementById("out").style.color="#991B1B";' +
    'document.getElementById("out").textContent="Error: "+e.message;b.disabled=false;b.textContent="Save details";' +
    '}).saveTransactionDetails(f);};' +
    '<\/script></div>';

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(450).setHeight(640),
    '✏️ Add / update details — ' + property
  );
}

function saveTransactionDetails(f) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(function (s) { return s.getSheetId() === Number(f.sheetId); });
  if (!sheet) throw new Error('Could not find the property tab. Close the dialog and try again.');

  // Will a seller-title block exist after this save? Controls whether a
  // brand-new buyer-title block uses the split ("Buyer Title") header.
  const sellerSec = DETAIL_EDIT_SECTIONS.filter(function (s) { return s.key === 'sellertitle'; })[0];
  const sellerTitleFilled = sellerSec.fields.some(function (fld) {
    return String(f['sellertitle_' + fld[0]] || '').trim();
  });

  const changed = [];
  DETAIL_EDIT_SECTIONS.forEach(function (sec) {
    const lines = [];
    sec.fields.forEach(function (fld) {
      const v = String(f[sec.key + '_' + fld[0]] || '').trim();
      if (v) lines.push(fld[1] + ': ' + v);
    });
    if (lines.length === 0) return;  // nothing entered — leave any existing block as-is

    let values = sheet.getDataRange().getValues();
    const range = _detailSectionRange(values, sec.headerAliases);

    let header = range ? range.header : sec.defaultHeader;
    if (!range && sec.key === 'buyertitle') {
      const hasSeller = sellerTitleFilled || !!_detailSectionRange(values, ['Seller Title']);
      header = hasSeller ? 'Escrow Agent/ Buyer Title' : 'Escrow Agent/ Title';
    }

    let insertAt, verb;
    if (range) {
      sheet.deleteRows(range.start, range.end - range.start + 1);
      sheet.insertRowsBefore(range.start, lines.length + 1);
      insertAt = range.start;
      verb = 'updated';
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow + lines.length + 2 > sheet.getMaxRows()) {
        sheet.insertRowsAfter(sheet.getMaxRows(), lines.length + 2);
      }
      insertAt = lastRow + 2;  // one blank spacer row before the new section
      verb = 'added';
    }
    sheet.getRange(insertAt, 1).setValue(header).setFontWeight('bold').setFontColor('#000000');
    for (let i = 0; i < lines.length; i++) {
      sheet.getRange(insertAt + 1 + i, 1).setValue(lines[i]).setFontWeight('normal').setFontColor('#000000');
    }
    changed.push(sec.title.replace(/\s*\(.*\)$/, '') + ' ' + verb);
  });

  try { rebuildDashboard(); } catch (e) { /* non-fatal */ }

  if (!changed.length) return { msg: 'Nothing to save — fill in at least one field first.' };
  return { msg: '✓ ' + changed.join(' · ') + '. Tab, agent portal, and dashboard updated.' };
}

// ============================================================
// v7.1 — OPERATOR DASHBOARD (Gloria's all-transactions overview)
//
// GET ?view=operator&key=<operator_key> returns EVERY transaction
// (all agents) for the private dashboard at /dashboard/. The key is
// generated once and shown via 🛠 TC Tools → 🖥 My dashboard link.
// ============================================================

const DASHBOARD_BASE_URL = 'https://mrfltransactions.com/dashboard/';

function operatorResponse_(params) {
  const key = String(params.key || '').trim();
  const stored = PropertiesService.getScriptProperties().getProperty('operator_key');
  if (!stored || stored !== key) {
    return jsonResponse({
      success: false,
      error: 'This dashboard link is not valid. Open 🛠 TC Tools → 🖥 My dashboard link in the sheet for a fresh one.'
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const base = ss.getUrl();
  const deals = [];

  ss.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) return;
    let d = null;
    try { d = extractTabData(sheet); } catch (e) { return; }
    if (!d) return;
    const ms = d.milestones || [];
    // v7.2 — include the parsed details sections (parties, title, lender, HOA…)
    let details = [];
    try { details = _portalDetailsFromValues(sheet.getDataRange().getValues()); } catch (e) { details = []; }
    deals.push({
      property: d.propertyDisplay,
      agent: d.agentRef,
      side: d.side || '',
      status: d.status,
      effective_date: _portalIso(d.effectiveDate),
      closing_date: _portalIso(d.closingDate),
      next_deadline: d.deadlineName || '',
      next_deadline_date: _portalIso(d.deadlineDate),
      days_until: (typeof d.daysUntil === 'number') ? d.daysUntil : null,
      progress_elapsed: d.progressElapsed,
      progress_total: d.progressTotal,
      done_count: ms.filter(function (m) { return m.completed; }).length,
      total_count: ms.length,
      milestones: ms.map(function (m) {
        return { name: m.name, date: _portalIso(m.date), completed: !!m.completed };
      }),
      details: details,
      sheet_link: base + '#gid=' + d.sheetId
    });
  });

  let referrals = [];
  try { referrals = _refList(); } catch (e) { referrals = []; }

  let reviewStats = { pending: 0, shown: 0 };
  try { reviewStats = _revStats(); } catch (e) {}

  // v7.6 — each agent's personal portal link, so Gloria can send them
  // straight from her dashboard (same keys as the sheet's links dialog;
  // generated here if an agent doesn't have one yet). Safe to include:
  // this payload already requires her private operator key.
  const portalLinks = {};
  try {
    const props = PropertiesService.getScriptProperties();
    const seen = {};
    deals.forEach(function (d) {
      const ref = d.agent;
      if (!ref || seen[ref]) return;
      seen[ref] = true;
      let k = props.getProperty(_portalKeyProp(ref));
      if (!k) {
        k = _portalRandomKey();
        props.setProperty(_portalKeyProp(ref), k);
      }
      portalLinks[ref] = PORTAL_BASE_URL + '?a=' + encodeURIComponent(ref) + '&k=' + k;
    });
  } catch (e) { /* dashboard still works without links */ }

  return jsonResponse({
    success: true,
    generated_at: new Date().toISOString(),
    deals: deals,
    referrals: referrals,
    reviews: reviewStats,
    portal_links: portalLinks
  });
}

// Menu: show (and on first run create) Gloria's private dashboard link.
function showOperatorLink() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('operator_key');
  if (!key) {
    key = _portalRandomKey() + _portalRandomKey();  // extra-long: it opens everything
    props.setProperty('operator_key', key);
  }
  const link = DASHBOARD_BASE_URL + '?k=' + key;
  ui.showModalDialog(HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5">' +
    '<p><b>Your personal overview dashboard.</b> Every transaction across all agents, ' +
    'live from this sheet. Bookmark it or add it to your phone\'s home screen.</p>' +
    '<p style="color:#991B1B"><b>Keep this link to yourself</b> — it shows ALL your transactions. ' +
    'If it ever leaks, delete the <b>operator_key</b> row in Apps Script → Project Settings → ' +
    'Script Properties and open this dialog again for a new one.</p>' +
    '<input type="text" readonly value="' + link + '" ' +
    'onclick="this.select();document.execCommand(\'copy\');this.nextElementSibling.style.display=\'inline\'" ' +
    'style="width:100%;font-size:11px;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<span style="display:none;color:#10B981;font-size:11px">Copied!</span></div>'
  ).setWidth(600).setHeight(220), '🖥 My dashboard link');
}

// ============================================================
// v7.3 — REFERRAL TRACKING
//
// Referrals live in a "🎁 Referrals" tab of the master sheet (source of
// truth — Gloria can edit it directly). The menu dialog logs new ones;
// the operator dashboard reads them via the operator view.
// Pricing basis: $500 single-side / $700 double sided; referred agents get
// off their first closed deal; referrer gets 50% off their next deal
// when the referral's first deal closes.
// ============================================================

const REFERRAL_TAB = '🎁 Referrals';
const REFERRAL_HEADERS = ['Date', 'Referred by', 'New agent', 'Contact', 'Status', 'Reward', 'Notes'];
const REFERRAL_STATUSES = ['Invited', 'Joined', 'First deal closed — reward due', 'Reward redeemed'];

function _refSheet(createIfMissing) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(REFERRAL_TAB);
  if (!sh && createIfMissing) {
    sh = ss.insertSheet(REFERRAL_TAB);
    sh.getRange(1, 1, 1, REFERRAL_HEADERS.length).setValues([REFERRAL_HEADERS])
      .setFontWeight('bold').setBackground('#4338CA').setFontColor('#FFFFFF');
    sh.setColumnWidths(1, REFERRAL_HEADERS.length, 150);
    sh.setColumnWidth(7, 260);
    sh.setFrozenRows(1);
    // Status dropdown on the whole column
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(REFERRAL_STATUSES, true).build();
    sh.getRange(2, 5, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  return sh;
}

function _refList() {
  const sh = _refSheet(false);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!String(r[1] || '').trim() && !String(r[2] || '').trim()) continue;
    out.push({
      date: (r[0] instanceof Date) ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0] || ''),
      referred_by: String(r[1] || ''),
      new_agent: String(r[2] || ''),
      contact: String(r[3] || ''),
      status: String(r[4] || ''),
      reward: String(r[5] || ''),
      notes: String(r[6] || '')
    });
  }
  return out;
}

function saveReferral(f) {
  const sh = _refSheet(true);
  const tz = Session.getScriptTimeZone();
  sh.appendRow([
    Utilities.formatDate(new Date(), tz, 'MM/dd/yyyy'),
    String(f.referredBy || '').trim(),
    String(f.newAgent || '').trim(),
    String(f.contact || '').trim(),
    String(f.status || 'Invited').trim(),
    String(f.reward || '').trim(),
    String(f.notes || '').trim()
  ]);
  return '✓ Referral logged — see the "' + REFERRAL_TAB + '" tab. Update its Status there as things progress.';
}

function showReferralDialog() {
  const ui = SpreadsheetApp.getUi();
  const agents = _portalListAgents();
  const existing = _refList();
  const rewardDue = existing.filter(function (r) { return r.status.indexOf('reward due') >= 0; }).length;

  const opts = agents.map(function (a) { return '<option value="' + _hoaEsc(a) + '">'; }).join('');
  const statusOpts = REFERRAL_STATUSES.map(function (s, i) {
    return '<option' + (i === 0 ? ' selected' : '') + '>' + _hoaEsc(s) + '</option>';
  }).join('');

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.45">' +
    '<p style="margin:0 0 6px;color:#4B5563">' + existing.length + ' referral' + (existing.length === 1 ? '' : 's') +
    ' logged so far' + (rewardDue ? ' · <b style="color:#B45309">' + rewardDue + ' reward' + (rewardDue > 1 ? 's' : '') + ' due 🎁</b>' : '') +
    '. Full list lives in the <b>' + REFERRAL_TAB + '</b> tab.</p>' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">Referred by (agent)</label>' +
    '<input id="referredBy" list="agents" style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<datalist id="agents">' + opts + '</datalist>' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">New agent name</label>' +
    '<input id="newAgent" style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">Contact (phone / email)</label>' +
    '<input id="contact" style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">Status</label>' +
    '<select id="status" style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px">' + statusOpts + '</select>' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">Reward</label>' +
    '<input id="reward" value="New agent: 50% off first closed deal · Referrer: 50% off next deal after it closes" ' +
    'style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<label style="display:block;margin:10px 0 3px;font-weight:600">Notes</label>' +
    '<input id="notes" style="width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box">' +
    '<div id="out" style="margin-top:10px;color:#10B981;font-weight:600"></div>' +
    '<div style="margin-top:14px;text-align:right">' +
    '<button id="save" style="background:#4338CA;color:#fff;border:none;padding:9px 18px;border-radius:6px;font-weight:700;cursor:pointer">Log referral</button></div>' +
    '<script>' +
    'document.getElementById("save").onclick=function(){' +
    'var b=this;b.disabled=true;b.textContent="Saving…";' +
    'var f={};["referredBy","newAgent","contact","status","reward","notes"].forEach(function(id){f[id]=document.getElementById(id).value;});' +
    'google.script.run.withSuccessHandler(function(msg){' +
    'document.getElementById("out").textContent=msg;setTimeout(function(){google.script.host.close();},1800);' +
    '}).withFailureHandler(function(e){' +
    'document.getElementById("out").style.color="#991B1B";document.getElementById("out").textContent="Error: "+e.message;' +
    'b.disabled=false;b.textContent="Log referral";' +
    '}).saveReferral(f);};' +
    '<\/script></div>';

  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(520), '🎁 Log a referral');
}

// ============================================================
// v7.0 — DAILY DEADLINE REMINDER DRAFTS FOR AGENTS
//
// A daily time trigger scans every active property tab and creates a
// Gmail DRAFT for each realtor with milestones due in 3 days, 1 day, or
// today — Gloria reviews the drafts each morning and sends them herself.
// NOTHING is ever sent automatically.
// Setup: 🛠 TC Tools → 🔔 Set up daily reminder drafts.
// Test:  🛠 TC Tools → 🔔 Preview / create reminder drafts.
// ============================================================

const REMINDER_DUE_DAYS = [3, 1, 0];   // days-until values that trigger a reminder
const REMINDER_HOUR = 7;               // daily send hour (script timezone)

// Pure: pick milestones due for a reminder. Excludes Effective Date (not a
// deadline) and completed (checked) milestones.
function _remSelectDue(milestones, todayMs) {
  const out = [];
  (milestones || []).forEach(function (m) {
    if (!m || m.completed || m.name === 'Effective Date') return;
    if (!(m.date instanceof Date) || isNaN(m.date.getTime())) return;
    const d = new Date(m.date); d.setHours(0, 0, 0, 0);
    const days = Math.round((d.getTime() - todayMs) / 86400000);
    if (REMINDER_DUE_DAYS.indexOf(days) >= 0) out.push({ name: m.name, date: d, days: days });
  });
  return out;
}

// Pure: derive the realtor's email from a tab's details block.
// Priority: explicit override → the represented side's "Agent Email".
function _remAgentEmail(values, override) {
  if (override) return override;
  let side = '';
  for (let i = 0; i < values.length; i++) {
    const l = String(values[i][0] || '').trim();
    if (l.indexOf('Side Represented:') === 0) { side = l.toLowerCase(); break; }
  }
  const wantSection = (side.indexOf('buyer') >= 0 && side.indexOf('seller') < 0)
    ? "Buyer's agent" : 'Listing agent';   // seller side + dual agency → listing agent
  let sections = [];
  try { sections = _portalDetailsFromValues(values); } catch (e) { return ''; }
  const sec = sections.filter(function (s) { return s.title === wantSection; })[0];
  if (!sec) return '';
  const item = sec.items.filter(function (it) { return it.label === 'Email'; })[0];
  return item ? item.value : '';
}

// Pure: branded reminder email HTML for one agent.
function _remBuildEmailHtml(ref, items, portalLink) {
  const urg = function (days) {
    if (days === 0) return ['#EF4444', 'DUE TODAY'];
    if (days === 1) return ['#F59E0B', 'due tomorrow'];
    return ['#F59E0B', 'in ' + days + ' days'];
  };
  const rows = items.map(function (it) {
    const u = urg(it.days);
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-weight:700;color:#1E1B4B">' + it.name + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;white-space:nowrap;color:#4B5563">' + it.dateStr + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;white-space:nowrap;font-weight:700;color:' + u[0] + '">' + u[1] + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;color:#4B5563;font-size:13px">' + it.property + '</td>' +
      '</tr>';
  }).join('');
  return '' +
    '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto">' +
    '<div style="background:#1E1B4B;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:14px;font-weight:800;letter-spacing:1.5px">MRFL <span style="color:#8B5CF6">TRANSACTIONS</span></div></div>' +
    '<div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;padding:22px">' +
    '<p style="margin:0 0 6px;font-size:16px;color:#1E1B4B"><b>Hi ' + ref + '</b> — heads up on ' +
    (items.length === 1 ? 'a deadline' : items.length + ' deadlines') + ' coming up:</p>' +
    '<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:14px">' +
    '<tr><td style="padding:8px 12px;font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase">Milestone</td>' +
    '<td style="padding:8px 12px;font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase">Date</td>' +
    '<td style="padding:8px 12px;font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase">When</td>' +
    '<td style="padding:8px 12px;font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase">Property</td></tr>' +
    rows + '</table>' +
    (portalLink
      ? '<div style="text-align:center;margin:20px 0 8px"><a href="' + portalLink + '" ' +
        'style="background:#4338CA;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;' +
        'font-weight:700;font-size:14px;display:inline-block">Open your portal →</a></div>'
      : '') +
    // v7.5 growth footer — referral + review nudge in every reminder
    // (drafts only, as always: Gloria reviews and sends each one herself)
    '<div style="margin:18px 0 0;padding:12px 14px;background:#F5F3FF;border-radius:8px;font-size:12.5px;color:#4B5563">' +
    '🎁 <b style="color:#1E1B4B">Know an agent who\'d love this support?</b> Your invite gives them ' +
    '50% off their first transaction — and you 50% off your next when theirs closes: ' +
    '<a href="' + REFER_BASE_URL + '?from=' + encodeURIComponent(ref) + '" style="color:#4338CA;font-weight:700">share your invite</a>. ' +
    'Loved working together? <a href="' + SITE_BASE_URL + '#reviews" style="color:#4338CA;font-weight:700">Leave a quick review ⭐</a></div>' +
    '<p style="margin:14px 0 0;font-size:12.5px;color:#9CA3AF;text-align:center">' +
    'Gloria · MRFL Transactions — questions? Just reply to this email.</p>' +
    '</div></div>';
}

// Plain-text fallback body for the draft (shown by clients without HTML).
function _remBuildEmailPlain(ref, items, portalLink) {
  const when = function (d) { return d === 0 ? 'DUE TODAY' : d === 1 ? 'due tomorrow' : 'in ' + d + ' days'; };
  return 'Hi ' + ref + ' — heads up on ' + (items.length === 1 ? 'a deadline' : items.length + ' deadlines') + ' coming up:\n\n' +
    items.map(function (it) {
      return '• ' + it.name + ' — ' + it.dateStr + ' (' + when(it.days) + ') · ' + it.property;
    }).join('\n') +
    (portalLink ? '\n\nYour portal: ' + portalLink : '') +
    '\n\n🎁 Know an agent who\'d love this support? Your invite gives them 50% off their first ' +
    'transaction (and you 50% off your next when theirs closes): ' +
    REFER_BASE_URL + '?from=' + encodeURIComponent(ref) +
    '\n⭐ Loved working together? Leave a quick review: ' + SITE_BASE_URL + '#reviews' +
    '\n\n— Gloria · MRFL Transactions';
}

// Scan all tabs → reminders grouped per agent: { ref: {email, items:[...]}, ... }
function _remGatherAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const tz = Session.getScriptTimeZone();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const byAgent = {};

  ss.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (name === DASHBOARD_TAB_NAME || name.startsWith('📊') || !name.includes('_')) return;
    let d = null;
    try { d = extractTabData(sheet); } catch (e) { return; }
    if (!d) return;
    if (['closed', 'cancelled', 'on_hold'].indexOf(d.status) >= 0) return;

    const due = _remSelectDue(d.milestones, today.getTime());
    if (due.length === 0) return;

    const ref = d.agentRef;
    if (!byAgent[ref]) {
      let email = '';
      try {
        email = _remAgentEmail(sheet.getDataRange().getValues(),
          props.getProperty('portal_email_' + ref.toLowerCase()) || '');
      } catch (e) { email = ''; }
      byAgent[ref] = { email: email, items: [] };
    } else if (!byAgent[ref].email) {
      try {
        byAgent[ref].email = _remAgentEmail(sheet.getDataRange().getValues(), '');
      } catch (e) { /* keep empty */ }
    }
    due.forEach(function (m) {
      byAgent[ref].items.push({
        name: m.name, days: m.days,
        dateStr: Utilities.formatDate(m.date, tz, 'EEE, MMM d'),
        property: d.propertyDisplay
      });
    });
  });

  // Soonest first within each agent
  Object.keys(byAgent).forEach(function (ref) {
    byAgent[ref].items.sort(function (a, b) { return a.days - b.days; });
  });
  return byAgent;
}

function _remPortalLink(ref) {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(_portalKeyProp(ref));
  if (!key) { key = _portalRandomKey(); props.setProperty(_portalKeyProp(ref), key); }
  return PORTAL_BASE_URL + '?a=' + encodeURIComponent(ref) + '&k=' + key;
}

// Create one Gmail DRAFT per agent — never sends anything.
// Returns a human-readable summary of what happened.
function _remCreateDrafts(byAgent) {
  const drafted = [];
  const skipped = [];
  Object.keys(byAgent).sort().forEach(function (ref) {
    const rec = byAgent[ref];
    if (!rec.email) { skipped.push(ref + ' (no email found on their tabs)'); return; }
    const first = rec.items[0];
    const subject = '⏰ ' + first.name + ' ' +
      (first.days === 0 ? 'is due TODAY' : first.days === 1 ? 'is due tomorrow' : 'due in ' + first.days + ' days') +
      (rec.items.length > 1 ? ' (+' + (rec.items.length - 1) + ' more)' : '') +
      ' — ' + first.property;
    try {
      const link = _remPortalLink(ref);
      GmailApp.createDraft(rec.email, subject,
        _remBuildEmailPlain(ref, rec.items, link),
        { htmlBody: _remBuildEmailHtml(ref, rec.items, link), name: 'MRFL Transactions' });
      drafted.push(ref + ' → ' + rec.email + ' (' + rec.items.length + ' deadline' + (rec.items.length > 1 ? 's' : '') + ')');
    } catch (e) {
      skipped.push(ref + ' (draft failed: ' + e.message + ')');
    }
  });
  let summary = '';
  if (drafted.length) summary += 'Drafts created (in your Gmail Drafts folder — review & send):\n• ' + drafted.join('\n• ');
  if (skipped.length) summary += (summary ? '\n\n' : '') + 'Skipped:\n• ' + skipped.join('\n• ');
  return summary || 'No deadlines due in ' + REMINDER_DUE_DAYS.join('/') + ' days today — no drafts needed.';
}

// Trigger handler — runs daily. Creates drafts only; sends nothing.
function remindersDailyJob() {
  try {
    const byAgent = _remGatherAll();
    if (Object.keys(byAgent).length === 0) return;
    const summary = _remCreateDrafts(byAgent);
    // If an agent had to be skipped, leave Gloria a note as a draft to herself
    // (she reviews drafts each morning anyway).
    if (summary.indexOf('Skipped:') >= 0) {
      GmailApp.createDraft(Session.getEffectiveUser().getEmail(),
        'MRFL reminders — attention needed (do not send)',
        'This morning\'s reminder drafts:\n\n' + summary +
        '\n\nTo fix a missing email: make sure the agent\'s email is on their property tab ' +
        '(Agent Email line), or set a Script Property portal_email_<agentref> with their address.' +
        '\n\n(This note is just for you — you can discard it.)');
    }
  } catch (err) {
    Logger.log('remindersDailyJob error: ' + err.toString());
  }
}

// Menu: preview what drafts would be created today, then create on confirmation.
function previewAndDraftReminders() {
  const ui = SpreadsheetApp.getUi();
  const byAgent = _remGatherAll();
  const refs = Object.keys(byAgent).sort();
  if (refs.length === 0) {
    ui.alert('No deadlines due in ' + REMINDER_DUE_DAYS.join('/') + ' days today — no drafts needed.');
    return;
  }
  const preview = refs.map(function (ref) {
    const rec = byAgent[ref];
    return ref + ' → ' + (rec.email || '⚠ NO EMAIL FOUND') + '\n' +
      rec.items.map(function (it) {
        return '   • ' + it.name + ' — ' + it.dateStr +
          (it.days === 0 ? ' (TODAY)' : it.days === 1 ? ' (tomorrow)' : ' (in ' + it.days + ' days)') +
          ' · ' + it.property;
      }).join('\n');
  }).join('\n\n');
  const answer = ui.alert('🔔 Reminder drafts ready',
    preview + '\n\nCreate these as Gmail DRAFTS now? Nothing is sent — you review and ' +
    'send each one yourself from your Drafts folder.',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  ui.alert(_remCreateDrafts(byAgent));
}

// Menu: one-time setup of the daily trigger.
function setupDailyReminders() {
  const ui = SpreadsheetApp.getUi();
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'remindersDailyJob') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('remindersDailyJob').timeBased().everyDays(1).atHour(REMINDER_HOUR).create();
    GmailApp.getAliases();  // force the Gmail permission prompt now, not at 7am
    ui.alert('✅ Daily reminder drafts are on.\n\n' +
      'Every morning (around ' + REMINDER_HOUR + '–' + (REMINDER_HOUR + 1) + ' AM), a Gmail DRAFT is prepared for each ' +
      'realtor with a milestone due in 3 days, 1 day, or today. Nothing is sent automatically — ' +
      'open your Drafts folder, review each one, and hit Send yourself.\n\n' +
      'Use 🔔 Preview / create reminder drafts anytime to see or create today\'s batch.');
  } catch (err) {
    ui.alert('Setup failed: ' + err.toString() +
      '\n\nApprove the Google permissions when prompted, then run it again.');
  }
}

// ============================================================
// v6.2 — WIDGET GET ENDPOINT
//
// Reads the dashboard tab of the master sheet and returns the
// next N days of upcoming deadlines as JSON. Designed for
// consumption by a Scriptable iPhone home-screen widget.
//
// Coexists with v6.1 doPost — no breaking changes.
// Replaces the previous v6.1 health-check doGet; calling this
// endpoint with no params still returns useful JSON (summary
// block doubles as a "script is alive" signal).
// ============================================================

const WIDGET_MASTER_SHEET_ID = '1HmBdzF8KRWvRFa01-QqmRIi9cKHF7Bh1-pf9jeDQ_7Y';
const WIDGET_DASHBOARD_TAB = '';      // empty = first sheet; set to actual tab name if different
const WIDGET_DEFAULT_DAYS = 4;        // default window if no ?days param

// ============================================================
// v7.4 — PUBLIC REVIEWS
//
// Realtors leave a review on the public site → doPost(action:'review')
// appends it to a "⭐ Reviews" tab with "Show on site?" UNCHECKED.
// Nothing appears publicly until Gloria ticks that checkbox — she
// reviews everything outbound. doGet?view=reviews (keyless — public
// content by design) returns only checked rows, newest first.
// ============================================================

const REVIEWS_TAB = '⭐ Reviews';
const REVIEWS_HEADERS = ['Date', 'Name', 'Brokerage', 'Stars', 'Review', 'Show on site?'];

function _revSheet(createIfMissing) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(REVIEWS_TAB);
  if (!sh) {
    if (!createIfMissing) return null;
    sh = ss.insertSheet(REVIEWS_TAB);
    sh.getRange(1, 1, 1, REVIEWS_HEADERS.length).setValues([REVIEWS_HEADERS])
      .setFontWeight('bold').setBackground('#404040').setFontColor('#FFFFFF');
    sh.setColumnWidth(1, 90);
    sh.setColumnWidth(2, 150);
    sh.setColumnWidth(3, 150);
    sh.setColumnWidth(4, 60);
    sh.setColumnWidth(5, 420);
    sh.setColumnWidth(6, 110);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _revClean(s, max) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function _reviewSubmit(data) {
  const name = _revClean(data.name, 60);
  const brokerage = _revClean(data.brokerage, 80);
  const text = _revClean(data.text, 600);
  let stars = parseInt(data.stars, 10);
  if (!(stars >= 1 && stars <= 5)) stars = 5;
  if (!name || !text) {
    return jsonResponse({ success: false, error: 'Name and review text are required.' });
  }

  // Light anti-spam: at most 5 submissions per rolling hour, site-wide.
  const cache = CacheService.getScriptCache();
  const count = parseInt(cache.get('rev_hour_count') || '0', 10);
  if (count >= 5) {
    return jsonResponse({ success: false, error: 'Too many reviews right now — please try again in a bit.' });
  }
  cache.put('rev_hour_count', String(count + 1), 3600);

  const sh = _revSheet(true);
  sh.appendRow([new Date(), name, brokerage, stars, text, false]);
  sh.getRange(sh.getLastRow(), 6).insertCheckboxes();
  return jsonResponse({ success: true, message: 'Review received — it will appear once approved.' });
}

function _reviewsResponse() {
  const sh = _revSheet(false);
  const out = [];
  if (sh && sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, REVIEWS_HEADERS.length).getValues();
    for (let i = rows.length - 1; i >= 0 && out.length < 30; i--) {
      if (rows[i][5] !== true) continue;   // only rows Gloria approved
      out.push({
        name: String(rows[i][1] || ''),
        brokerage: String(rows[i][2] || ''),
        stars: Math.max(1, Math.min(5, parseInt(rows[i][3], 10) || 5)),
        text: String(rows[i][4] || ''),
        date: (rows[i][0] instanceof Date)
          ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), 'MMM yyyy') : ''
      });
    }
  }
  // Future Google Business Profile tie-in: set Script Property
  // google_review_url to the profile's review link and the site will
  // show a "review us on Google" button automatically.
  const gUrl = PropertiesService.getScriptProperties().getProperty('google_review_url') || '';
  return jsonResponse({ status: 'ok', reviews: out, google_url: gUrl });
}

// ---------- v7.5 — review management (⭐ Manage reviews dialog) ----------

function _revStats() {
  const sh = _revSheet(false);
  const stats = { pending: 0, shown: 0 };
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      if (r[0] === true) stats.shown++; else stats.pending++;
    });
  }
  return stats;
}

// All reviews with their sheet row numbers, newest first — feeds the dialog.
function listReviewsForManager() {
  const sh = _revSheet(true);
  const out = [];
  if (sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, REVIEWS_HEADERS.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      out.push({
        row: i + 2,
        date: (rows[i][0] instanceof Date)
          ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), 'MMM d, yyyy') : String(rows[i][0] || ''),
        name: String(rows[i][1] || ''),
        brokerage: String(rows[i][2] || ''),
        stars: Math.max(1, Math.min(5, parseInt(rows[i][3], 10) || 5)),
        text: String(rows[i][4] || ''),
        shown: rows[i][5] === true
      });
    }
  }
  return out;
}

// Guarded write: the name at the row must match what the dialog showed,
// so a stale dialog can never flip or delete the wrong review.
function _revGuard(sh, row, expectName) {
  if (!sh || row < 2 || row > sh.getLastRow()) return false;
  return String(sh.getRange(row, 2).getValue() || '') === String(expectName || '');
}

function setReviewVisibility(row, expectName, show) {
  const sh = _revSheet(false);
  if (!_revGuard(sh, row, expectName)) {
    return { ok: false, error: 'That review moved (sheet edited?) — reopening the list.', list: listReviewsForManager() };
  }
  sh.getRange(row, 6).setValue(show === true);
  return { ok: true, list: listReviewsForManager() };
}

function deleteReview(row, expectName) {
  const sh = _revSheet(false);
  if (!_revGuard(sh, row, expectName)) {
    return { ok: false, error: 'That review moved (sheet edited?) — reopening the list.', list: listReviewsForManager() };
  }
  sh.deleteRow(row);
  return { ok: true, list: listReviewsForManager() };
}

function showReviewsManager() {
  const html = '' +
    '<style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;margin:0;padding:14px;color:#1E1B4B}' +
    'h3{margin:0 0 2px;font-size:16px}' +
    '.hint{font-size:12px;color:#6B7280;margin:0 0 12px}' +
    '.rev{border:1px solid #E5E7EB;border-radius:10px;padding:10px 12px;margin-bottom:10px}' +
    '.rev.live{border-color:#A7F3D0;background:#F0FDF9}' +
    '.top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.who{font-weight:700;font-size:13.5px}.meta{font-size:11.5px;color:#6B7280}' +
    '.stars{color:#D97706;font-size:13px;letter-spacing:1px}' +
    '.txt{font-size:13px;color:#374151;margin:6px 0 8px}' +
    '.chip{font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px}' +
    '.chip.live{background:#D1FAE5;color:#065F46}.chip.hidden{background:#FEF3C7;color:#92400E}' +
    'button{border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;margin-right:6px}' +
    '.show{background:#4338CA;color:#fff}.hide{background:#E5E7EB;color:#374151}.del{background:#FEE2E2;color:#B91C1C}' +
    '.empty{color:#6B7280;font-size:13px;text-align:center;padding:26px 0}' +
    '#err{display:none;color:#B91C1C;font-size:12px;margin-bottom:8px;font-weight:700}' +
    '</style>' +
    '<h3>⭐ Manage reviews</h3>' +
    '<p class="hint">Only reviews marked <b>Live on site</b> are shown publicly. New submissions start hidden.</p>' +
    '<div id="err"></div><div id="list"><p class="empty">Loading…</p></div>' +
    '<script>' +
    'function esc(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c];});}' +
    'function stars(n){var h="";for(var i=1;i<=5;i++)h+=(i<=n?"★":"☆");return h;}' +
    'function paint(list){var box=document.getElementById("list");' +
    'if(!list||!list.length){box.innerHTML=\'<p class="empty">No reviews yet — they land here when an agent submits one on your site.</p>\';return;}' +
    'var h="";list.forEach(function(r){' +
    'h+=\'<div class="rev\'+(r.shown?" live":"")+\'"><div class="top"><span><span class="who">\'+esc(r.name)+\'</span> ' +
    '<span class="meta">\'+esc(r.brokerage||"Realtor")+\' · \'+esc(r.date)+\'</span></span>' +
    '<span class="chip \'+(r.shown?"live":"hidden")+\'">\'+(r.shown?"LIVE ON SITE":"HIDDEN")+\'</span></div>' +
    '<div class="stars">\'+stars(r.stars)+\'</div><div class="txt">\'+esc(r.text)+\'</div>' +
    '<button class="\'+(r.shown?"hide":"show")+\'" onclick="flip(\'+r.row+\',this)" data-name="\'+esc(r.name)+\'" data-show="\'+(r.shown?"0":"1")+\'">\'+(r.shown?"🙈 Hide from site":"✅ Show on site")+\'</button>' +
    '<button class="del" onclick="kill(\'+r.row+\',this)" data-name="\'+esc(r.name)+\'">🗑 Delete</button></div>\';});' +
    'box.innerHTML=h;}' +
    'function done(res){var e=document.getElementById("err");' +
    'if(res&&res.error){e.textContent=res.error;e.style.display="block";}else{e.style.display="none";}' +
    'paint(res&&res.list?res.list:[]);}' +
    'function fail(err){var e=document.getElementById("err");e.textContent="Hmm, that did not save: "+err.message;e.style.display="block";}' +
    'function flip(row,btn){btn.disabled=true;btn.textContent="Saving…";' +
    'google.script.run.withSuccessHandler(done).withFailureHandler(fail).setReviewVisibility(row,btn.getAttribute("data-name"),btn.getAttribute("data-show")==="1");}' +
    'function kill(row,btn){if(!confirm("Delete this review permanently?"))return;btn.disabled=true;' +
    'google.script.run.withSuccessHandler(done).withFailureHandler(fail).deleteReview(row,btn.getAttribute("data-name"));}' +
    'google.script.run.withSuccessHandler(paint).withFailureHandler(fail).listReviewsForManager();' +
    '</script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(560).setHeight(480), '⭐ Manage reviews');
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    // v7.4 — approved public reviews (keyless — this is public content)
    if (params.view === 'reviews') return _reviewsResponse();

    // v6.6 — agent portal view (key-protected, per-agent data)
    if (params.view === 'portal') return portalResponse_(params);

    // v7.1 — operator dashboard view (key-protected, ALL deals)
    if (params.view === 'operator') return operatorResponse_(params);

    // v6.9 — widget data now requires the widget key (shown in the
    // "🔗 Agent portal links" dialog). Keyless requests get a health check
    // only — keeps the intake form's webhook Test working, exposes no data.
    const widgetKey = PropertiesService.getScriptProperties().getProperty('widget_key');
    if (!widgetKey || params.key !== widgetKey) {
      return jsonResponse({
        status: 'ok',
        message: 'Transaction Coordinator Webhook is live.',
        timestamp: new Date().toISOString()
      });
    }

    const days = parseInt(params.days, 10) || WIDGET_DEFAULT_DAYS;
    const agentFilter = params.agent || null;

    const allDeals = widgetReadDashboard_();
    const upcoming = widgetFilterUpcoming_(allDeals, days, agentFilter);
    const summary = widgetComputeSummary_(allDeals);

    const payload = {
      generated_at: new Date().toISOString(),
      days_window: days,
      agent_filter: agentFilter,
      summary: summary,
      deadlines: upcoming
    };

    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: err.toString(),
        stack: err.stack || null
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function widgetReadDashboard_() {
  const ss = SpreadsheetApp.openById(WIDGET_MASTER_SHEET_ID);
  const sheet = WIDGET_DASHBOARD_TAB
    ? ss.getSheetByName(WIDGET_DASHBOARD_TAB)
    : ss.getSheets()[0];

  if (!sheet) throw new Error('Dashboard tab not found');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const col = {
    property:     widgetFindCol_(headers, ['Property', 'Property Address', 'Address']),
    agent:        widgetFindCol_(headers, ['Agent', 'Realtor']),
    side:         widgetFindCol_(headers, ['Side', 'Representing']),
    effective:    widgetFindCol_(headers, ['Effective', 'Effective Date']),
    closing:      widgetFindCol_(headers, ['Closing', 'Closing Date']),
    nextDeadline: widgetFindCol_(headers, ['Next Deadline', 'Next Milestone']),
    date:         widgetFindCol_(headers, ['Date', 'Deadline Date', 'Due Date']),
    daysUntil:    widgetFindCol_(headers, ['Days Until', 'Days Out']),
    status:       widgetFindCol_(headers, ['Status'])
  };

  return values.slice(1)
    .filter(row => row[col.property])
    .map(row => ({
      property:      String(row[col.property] || '').trim(),
      agent:         String(row[col.agent] || '').trim(),
      side:          String(row[col.side] || '').trim(),
      effective:     row[col.effective],
      closing:       row[col.closing],
      next_deadline: String(row[col.nextDeadline] || '').trim(),
      date_raw:      row[col.date],
      date_iso:      widgetToIsoDate_(row[col.date]),
      days_until:    widgetParseDaysUntil_(row[col.daysUntil]),
      status:        String(row[col.status] || '').trim()
    }));
}

function widgetFindCol_(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase() === c.toLowerCase());
    if (i >= 0) return i;
  }
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

function widgetToIsoDate_(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string' && val) {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return widgetToIsoDate_(parsed);
  }
  return null;
}

function widgetParseDaysUntil_(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const match = val.match(/^(-?\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function widgetFilterUpcoming_(deals, daysWindow, agentFilter) {
  const upcoming = deals.filter(d => {
    const s = (d.status || '').toLowerCase();
    if (s.includes('closed') || s.includes('cancel') || s.includes('hold')) return false;
    if (d.days_until === null) return false;
    if (d.days_until < 0 || d.days_until > daysWindow) return false;
    return true;
  });

  const filtered = agentFilter
    ? upcoming.filter(d => d.agent.toLowerCase().includes(agentFilter.toLowerCase()))
    : upcoming;

  filtered.sort((a, b) => a.days_until - b.days_until);

  return filtered.map(d => ({
    property:     d.property,
    agent:        d.agent,
    side:         d.side || null,
    milestone:    d.next_deadline,
    date:         d.date_iso,
    days_until:   d.days_until,
    urgency:      widgetClassifyUrgency_(d.days_until, d.status),
    closing_date: widgetToIsoDate_(d.closing)
  }));
}

function widgetClassifyUrgency_(daysUntil, status) {
  const s = (status || '').toLowerCase();
  if (s.includes('urgent') || daysUntil <= 2) return 'urgent';
  if (s.includes('warning') || daysUntil <= 5) return 'warning';
  return 'normal';
}

function widgetComputeSummary_(deals) {
  let active = 0, urgent = 0, closingThisWeek = 0;
  const agents = new Set();
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);

  for (const d of deals) {
    const s = (d.status || '').toLowerCase();
    if (s.includes('closed') || s.includes('cancel') || s.includes('hold')) continue;
    active++;
    if (s.includes('urgent')) urgent++;
    if (d.agent) agents.add(d.agent);
    if (d.closing instanceof Date && d.closing >= now && d.closing <= weekFromNow) {
      closingThisWeek++;
    }
  }

  return {
    active_deals: active,
    urgent_count: urgent,
    closing_this_week: closingThisWeek,
    agents_count: agents.size
  };
}

function widgetTest() {
  const result = doGet({ parameter: { days: '4' } });
  const json = JSON.parse(result.getContent());
  Logger.log(JSON.stringify(json, null, 2));
  return json;
}
