# Campaign Analytics

Relational email outreach dashboard for the AltSecCON/Altered Security Apps Script mailer.

## Data source

The dashboard calls the Apps Script web app with:

`?action=get_dashboard_data`

Expected top-level arrays:

- Users
- Campaigns
- Campaign Members
- Journeys
- Email Events
- Tracking
- Follow-Up
- Analysis
- Reports

`Campaign Members` is required for exact recipient and pre-delivery verification reporting. If it is not returned, the dashboard remains usable and falls back to unique recipients from Email Events, while showing a warning.

## Metric definitions

- Recipients: unique active Campaign Members in the selected campaign; event-derived fallback when needed.
- Messages: Email Event rows.
- Sent: `Mail Sent Status = Sent`.
- Delivered: `Post Delivery Check Status = Delivered`.
- Bounced: `Post Delivery Check Status = Bounced`.
- Valid pre-check: `Pre Delivery Check Status = Valid`.
- Risky pre-check: `Pre Delivery Check Status = Risky`.
- Opened/Clicked/Replied/Unsubscribed: Email Event or Tracking flag is true/Y.
- Engagement rates: Delivered is the preferred denominator; Sent is used until delivery checks exist.

## Files

- `js/datasource.js` — API loading only
- `js/data.js` — relational normalization and joins
- `js/metrics.js` — single source of truth for KPI math
- `js/analytics.js` — filtering and grouping
- `js/charts.js` — Chart.js rendering
- `js/tables.js` — table rendering
- `js/app.js` — UI controller

## User Management

The Users view uses the read-only Apps Script dashboard endpoint for listing users and the Cloudflare Worker `altsec-outreach-api.deepak-95d.workers.dev` for admin writes.

Supported write actions: `create_user`, `update_user`, and `set_user_unsubscribed`.

The Apps Script API secret is not stored in this repository; it remains in Cloudflare Worker Secrets and Apps Script Script Properties.
