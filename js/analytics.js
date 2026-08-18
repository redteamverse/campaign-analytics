/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - ANALYTICS ENGINE
 * ============================================================
 * Computes performance analytics, engagement rates, and aggregated
 * metrics across Users, Campaigns, Email Events, Tracking, and Follow-Ups.
 */

const AnalyticsEngine = (function () {

  /**
   * Calculates overall high-level KPIs across all system data
   */
  function getExecutiveKPIs() {
    const data = DataEngine.getNormalized();
    const totalContacts = data.users.length;
    const totalCampaigns = data.campaigns.length;
    const totalEvents = data.emailEvents.length;
    const sentEvents = data.emailEvents.filter(e => e.mailStatus.toLowerCase() === 'sent');
    
    let totalOpens = 0;
    let totalClicks = 0;
    let totalReplies = 0;
    let totalUnsubscribes = 0;

    data.tracking.forEach(t => {
      if (t.isOpened) totalOpens++;
      if (t.linkClicked) totalClicks++;
      if (t.isReplied) totalReplies++;
      if (t.unsubscribed) totalUnsubscribes++;
    });

    const sentCount = sentEvents.length || 1; // Prevent divide by zero

    return {
      totalContacts,
      totalCampaigns,
      totalSent: sentEvents.length,
      totalOpens,
      totalClicks,
      totalReplies,
      totalUnsubscribes,
      openRate: ((totalOpens / sentCount) * 100).toFixed(1) + '%',
      clickRate: ((totalClicks / sentCount) * 100).toFixed(1) + '%',
      replyRate: ((totalReplies / sentCount) * 100).toFixed(1) + '%',
      unsubscribeRate: ((totalUnsubscribes / sentCount) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Calculates metrics for a specific campaign ID
   */
  function getCampaignAnalytics(campaignId) {
    const events = DataEngine.getEventsForCampaign(campaignId);
    const sentEvents = events.filter(e => e.mailStatus.toLowerCase() === 'sent');
    
    let opens = 0;
    let clicks = 0;
    let replies = 0;
    let unsubscribes = 0;

    events.forEach(e => {
      const track = DataEngine.getTrackingForEvent(e.emailEventId);
      if (track) {
        if (track.isOpened) opens++;
        if (track.linkClicked) clicks++;
        if (track.isReplied) replies++;
        if (track.unsubscribed) unsubscribes++;
      }
    });

    const sentCount = sentEvents.length || 1;

    return {
      campaignId,
      totalEvents: events.length,
      sentCount: sentEvents.length,
      opens,
      clicks,
      replies,
      unsubscribes,
      openRate: ((opens / sentCount) * 100).toFixed(1) + '%',
      clickRate: ((clicks / sentCount) * 100).toFixed(1) + '%',
      replyRate: ((replies / sentCount) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Aggregates follow-up queue status counts
   */
  function getFollowUpQueueMetrics() {
    const followUps = DataEngine.getNormalized().followUp;
    const summary = {
      pending: 0,
      due: 0,
      sent: 0,
      replied: 0,
      unsubscribed: 0,
      total: followUps.length
    };

    const now = new Date();

    followUps.forEach(f => {
      const status = f.status.toLowerCase();
      if (status === 'sent') summary.sent++;
      else if (status === 'replied') summary.replied++;
      else if (status === 'unsubscribed') summary.unsubscribed++;
      else {
        summary.pending++;
        if (f.dueAt && f.dueAt <= now) {
          summary.due++;
        }
      }
    });

    return summary;
  }

  return {
    getExecutiveKPIs,
    getCampaignAnalytics,
    getFollowUpQueueMetrics
  };
})();
