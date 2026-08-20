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

    // Fallback recipient count to unique contacts across email events if Users tab is empty
    const uniqueContacts = new Set(events.map(e => e.contactId).filter(Boolean));
    const totalRecipients = data.users.length > 0 ? data.users.length : uniqueContacts.size;

    const totalMessages = events.length;

    // Treat any non-empty status (or status not containing "fail"/"error") as sent
    const totalSent = events.filter(e => {
      if (!e.mailStatus) return true; // Default to sent if row exists in Email Events
      const s = e.mailStatus.toLowerCase();
      return !s.includes('fail') && !s.includes('error') && !s.includes('bounce');
    }).length;

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

    const baseCount = totalSent > 0 ? totalSent : (totalMessages > 0 ? totalMessages : 1);

    return {
      recipients: totalRecipients,
      messages: totalMessages,
      sent: totalSent,
      verified: totalSent,
      openRate: baseCount > 0 ? ((openedCount / baseCount) * 100).toFixed(1) : '0.0',
      clickRate: baseCount > 0 ? ((clickedCount / baseCount) * 100).toFixed(1) : '0.0',
      replyRate: baseCount > 0 ? ((repliedCount / baseCount) * 100).toFixed(1) : '0.0',
      unsubscribeRate: baseCount > 0 ? ((unsubscribedCount / baseCount) * 100).toFixed(1) : '0.0'
    };
  }

  return {
    calculateMetrics: calculateMetrics,
    getFilteredEvents: getFilteredEvents
  };
})();
