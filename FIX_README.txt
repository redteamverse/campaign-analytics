CAMPAIGN ANALYTICS - RELATIONAL FIX
===================================

This package is ready to replace the existing Git project.

Fixed architecture:
- DataSource loads Campaign Members in addition to all existing relational tabs.
- DataEngine normalizes Users, Campaigns, Campaign Members, Journeys,
  Email Events, Tracking and Follow-Up using the current mailer headers.
- MetricsEngine is the only KPI calculation layer.
- AnalyticsEngine handles filters and groupings only.
- app.js is UI/controller only and uses element IDs (no select indexes).
- Charts use real Sent Timestamp and relational delivery/engagement metrics.
- Campaigns, Sequences and Recipients views are functional tables.
- Recipient counts use ACTIVE Campaign Members when available.
- Pre-check Valid/Risky metrics use Campaign Member verification status.
- Delivered = Post Delivery Check Status: Delivered.
- Bounced = Post Delivery Check Status: Bounced.
- Engagement flags are merged from Email Events + Tracking.
- Rates use Delivered as denominator; Sent is fallback until delivery checks run.

IMPORTANT BACKEND EXPECTATION
-----------------------------
The Apps Script get_dashboard_data response should include:
  "Campaign Members": [...]

If it does not, the dashboard still works by falling back to Email Events and
shows a warning banner, but exact membership/pre-check reporting is best when
Campaign Members is returned.
