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
      events = events.filter(e => e.campaignId === filters.campaignId || e.campaignName === filters.campaignId);
    }

    if (filters.sequence && filters.sequence !== 'all') {
      events = events.filter(e => {
        if (e.sequence && String(e.sequence) === String(filters.sequence)) return true;
        const j = data.journeys.find(j => j.journeyId === e.journeyId);
        return j && String(j.sequence) === String(filters.sequence);
      });
    }

    if (filters.version && filters.version !== 'all') {
      events = events.filter(e => {
        if (e.emailVersion && e.emailVersion === filters.version) return true;
        const j = data.journeys.find(j => j.journeyId === e.journeyId);
        return j && j.emailVersion === filters.version;
      });
    }

    if (filters.segment && filters.segment !== 'all') {
      events = events.filter(e => {
        if (e.targetSegment && e.targetSegment === filters.segment) return true;
        const j = data.journeys.find(j => j.journeyId === e.journeyId);
        return j && j.targetSegment === filters.segment;
      });
    }

    return events;
  }

  function calculateMetrics(filters = {}) {
    const data = DataEngine.getNormalized();
    const events = getFilteredEvents(filters);

    // Combine distinct users from Users tab, Journeys tab, and Email Events tab
    const recipientSet = new Set();
    data.users.forEach(u => { if (u.contactId || u.email) recipientSet.add(u.contactId || u.email); });
    events.forEach(e => { if (e.contactId || e.emailAddress) recipientSet.add(e.contactId || e.emailAddress); });
    data.journeys.forEach(j => { if (j.contactId || j.email) recipientSet.add(j.contactId || j.email); });

    const totalRecipients = recipientSet.size;
    const totalMessages = events.length;

    const totalSent = events.filter(e => {
      if (!e.mailStatus) return true;
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
