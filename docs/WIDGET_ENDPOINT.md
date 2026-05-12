# Widget GET Endpoint (v6.2)

The webhook v6.2 includes a GET handler designed to feed iPhone home-screen widgets via the Scriptable iOS app. Lives alongside the existing v6.1 `doPost` in `webhook/Code.gs`.

## URL

Same deployment URL as the intake form's POST endpoint:

```
https://script.google.com/macros/s/{deployment-id}/exec
```

## Query parameters

| Param | Default | Description |
| --- | --- | --- |
| `days` | 4 | Window of upcoming deadlines (in days from today) |
| `agent` | (none) | Filter to deals where agent name contains this substring |

### Examples

| URL | Returns |
| --- | --- |
| `/exec` | All upcoming deadlines in 4 days |
| `/exec?days=7` | All upcoming deadlines in 7 days |
| `/exec?days=4&agent=Carlos` | Carlos's deals only, next 4 days |

## Response shape

```json
{
  "generated_at": "2026-05-12T19:00:00.000Z",
  "days_window": 4,
  "agent_filter": null,
  "summary": {
    "active_deals": 11,
    "urgent_count": 1,
    "closing_this_week": 0,
    "agents_count": 8
  },
  "deadlines": [
    {
      "property": "12756 SW 49th Court Ct, Miramar, FL 33027",
      "agent": "AHK",
      "side": "Buyer",
      "milestone": "Inspection Due",
      "date": "2026-05-13",
      "days_until": 2,
      "urgency": "urgent",
      "closing_date": "2026-06-09"
    }
  ]
}
```

## Urgency tiers

| Tier | Trigger |
| --- | --- |
| `urgent` | `days_until` ≤ 2 OR status contains "URGENT" |
| `warning` | `days_until` ≤ 5 OR status contains "WARNING" |
| `normal` | everything else |

## Data source

Reads the first sheet of the master spreadsheet (the dashboard tab) by default. To override, set the `WIDGET_DASHBOARD_TAB` constant at the top of `Code.gs` to the actual tab name.

The endpoint expects these column headers (case-insensitive, alternates supported):
- Property / Property Address / Address
- Agent / Realtor
- Side / Representing
- Effective / Effective Date
- Closing / Closing Date
- Next Deadline / Next Milestone
- Date / Deadline Date / Due Date
- Days Until / Days Out
- Status

## Filtering rules

The endpoint filters out:
- Deals with status containing "closed", "cancel", or "hold"
- Deals where `days_until` is null or unparseable
- Deals with negative `days_until` (already passed)
- Deals with `days_until` greater than the requested window

Results are sorted by `days_until` ascending.

## Authentication

Currently open — anyone with the deployment URL can hit it. Acceptable for v1 since the URL is obscured by Google's random deployment ID and the response contains only deadline data (no PII beyond names and addresses already on the dashboard).

A future hardening pass may add a `?key=SECRET` parameter validation.

## Testing in the Apps Script editor

After pasting the new code into the editor, run `widgetTest()` via the Run dropdown. The Execution Log (View → Logs) will show the JSON output. Verify:
- `summary.active_deals` matches the count of active rows in the dashboard
- `deadlines[]` contains items with `days_until` ≤ 4
- No items are closed, cancelled, or on hold

If `widgetTest()` errors, check:
- The dashboard tab is the first sheet (or `WIDGET_DASHBOARD_TAB` is set correctly)
- Column headers haven't been renamed since this code was written
- The master sheet ID matches `WIDGET_MASTER_SHEET_ID`

## Deployment

Apps Script does not deploy from git. To deploy:
1. Open the master sheet → Extensions → Apps Script
2. Paste the updated `Code.gs` content (Cmd/Ctrl + S to save)
3. Click Deploy → Manage deployments
4. Edit the current web app deployment → Version: New version → Deploy
5. The URL stays the same — existing intake form continues to work

## Consumed by

A future Scriptable iOS widget at `scriptable/mrfl_widget.js` will consume this endpoint. See [forthcoming] task: *Build Scriptable widget v1*.
