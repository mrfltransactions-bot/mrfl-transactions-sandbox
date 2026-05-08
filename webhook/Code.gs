/**
 * TRANSACTION COORDINATOR WEBHOOK — v5 (Master Dashboard)
 *
 * Built on top of v4. Adds:
 *   1. A Master "📊 Dashboard" tab pinned to the front of the sheet
 *   2. Auto-rebuilds the dashboard after every form submission
 *   3. Manual "🛠 TC Tools" menu in the sheet UI for on-demand refresh
 *   4. Color-coded urgency: Past Due, Urgent, Warning, On Track, Closed
 *   5. Sorted by next deadline (most urgent at top, closed at bottom)
 *   6. Clickable property names that jump to the property's tab
 *
 * IMPORTANT: After updating to v5:
 *   1. Save the script
 *   2. Deploy → Manage Deployments → pencil → New version → Deploy
 *   3. Refresh your Google Sheet — you'll see the new "🛠 TC Tools" menu
 *   4. Click TC Tools → Refresh Dashboard to build it for the first time
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
        created.push({ name: m.name, date: m.date });
      } catch (err) {
        // Continue on individual event errors
      }
    });
  }
  return created;
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
    status: status
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
    try {
      const parentFolder = _getMasterParentFolder();
      deliverableUrl = _buildDeliverableSheet(data, parentFolder);
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
      deliverableUrl: deliverableUrl
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

  // Move to master parent folder
  DriveApp.getFileById(ss.getId()).moveTo(parentFolder);

  return ss.getUrl();
}

// ============ HEALTH CHECK ============
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Transaction Coordinator Webhook (v6.1 - auto-refresh + filter + progress bar) is live.',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ HELPER ============
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
