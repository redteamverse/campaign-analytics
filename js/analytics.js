/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - ANALYTICS ENGINE
 * ============================================================
 */

const AnalyticsEngine = (function () {

  function getFilteredEvents(filters = {}) {
    const data = DataEngine.getNormalized();
    let events = data.emailEvents || [];

    if (filters.campaignId && filters.campaignId !== 'all') {
      events = events.filter(e => e.campaignId === filters.campaignId);
    }

    if (filters.sequence && filters.sequence !== 'all') {
      const journeys = data.journeys.filter(j => String(j.sequence) === String(filters.sequence));
      const journeyIds = new Set(journeys.map(j => j.journeyId));
      events = events.filter(e => journeyIds.has(e.journeyId));
    }

    if (filters.version && filters.version !== 'all') {
      const journeys = data.journeys.filter(j => j.emailVersion === filters.version);
      const journeyIds = new Set(journeys.map(j => j.journeyId));
      events = events.filter(e => journeyIds.has(e.journeyId));
    }

    if (filters.segment && filters.segment !== 'all') {
      const journeys = data.journeys.filter(j => j.targetSegment === filters.segment);
      const journeyIds = new Set(journeys.map(j => j.journeyId));
      events = events.filter(e => journeyIds.has(e.journeyId));
    }

    return events;
  }

  function calculateMetrics(filters = {}) {
    const data = DataEngine.getNormalized();
    const events = getFilteredEvents(filters);

    const totalRecipients = data.users.length;
    const totalMessages = events.length;
    const totalSent = events.filter(e => e.mailStatus && e.mailStatus.toLowerCase() !== 'failed').length;
    
    // Check engagement status either directly on event or via tracking join
    const openedCount = events.filter(e => {
      const t = DataEngine.getTrackingForEvent(e.emailEventId);
      return e.isOpened || (t && t.isOpened);
    }).length;

    const clickedCount = events.filter(e => {
      const t = DataEngine.getTrackingForEvent(e.emailEventId);
      return e.linkClicked || (t && t.linkClicked);
    }).length;

    const repliedCount = events.filter(e => {
      const t = DataEngine.getTrackingForEvent(e.emailEventId);
      return e.isReplied || (t && t.isReplied);
    }).length;

    const unsubscribedCount = events.filter(e => {
      const t = DataEngine.getTrackingForEvent(e.emailEventId);
      return e.unsubscribed || (t && t.unsubscribed);
    }).length;

    const baseCount = totalSent > 0 ? totalSent : 1;

    return {
      recipients: totalRecipients,
      messages: totalMessages,
      sent: totalSent,
      verified: totalSent, // Verified delivered count
      openRate: totalSent > 0 ? ((openedCount / baseCount) * 100).toFixed(1) : '0.0',
      clickRate: totalSent > 0 ? ((clickedCount / baseCount) * 100).toFixed(1) : '0.0',
      replyRate: totalSent > 0 ? ((repliedCount / baseCount) * 100).toFixed(1) : '0.0',
      unsubscribeRate: totalSent > 0 ? ((unsubscribedCount / baseCount) * 100).toFixed(1) : '0.0',
      rawCounts: {
        opened: openedCount,
        clicked: clickedCount,
        replied: repliedCount,
        unsubscribed: unsubscribedCount
      }
    };
  }

  return {
    calculateMetrics: calculateMetrics,
    getFilteredEvents: getFilteredEvents
  };
})();
