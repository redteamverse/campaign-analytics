/**
 * ============================================================
 * CAMPAIGN ANALYTICS - FILTERS & AGGREGATIONS
 * ============================================================
 */
const AnalyticsEngine = (function () {
  const isAll = value => !value || String(value).toLowerCase() === 'all';

  function normalizeFilters(filters = {}) {
    return {
      campaignId: filters.campaignId || 'all',
      sequence: filters.sequence || 'all',
      version: filters.version || 'all',
      segment: filters.segment || 'all'
    };
  }

  function getFilteredEvents(filters = {}) {
    const f = normalizeFilters(filters);
    const data = DataEngine.getNormalized();

    return (data.emailEvents || []).filter(e => {
      if (!isAll(f.campaignId) && e.campaignId !== f.campaignId) return false;
      if (!isAll(f.sequence) && String(e.sequence) !== String(f.sequence)) return false;
      if (!isAll(f.version) && e.emailVersion !== f.version) return false;
      if (!isAll(f.segment) && e.targetSegment !== f.segment) return false;
      return true;
    });
  }

  function hasEventLevelFilters(filters = {}) {
    const f = normalizeFilters(filters);
    return !isAll(f.sequence) || !isAll(f.version) || !isAll(f.segment);
  }

  function getFilteredMembers(filters = {}, filteredEvents = null) {
    const f = normalizeFilters(filters);
    const data = DataEngine.getNormalized();
    let members = (data.campaignMembers || []).filter(m => m.membershipStatus === 'ACTIVE');

    if (!isAll(f.campaignId)) {
      members = members.filter(m => m.campaignId === f.campaignId);
    }

    // Campaign Members do not contain sequence/version/segment. When one of
    // those filters is active, recipients must be derived from matching events.
    if (hasEventLevelFilters(f)) {
      const events = filteredEvents || getFilteredEvents(f);
      return MetricsEngine.uniqueRecipientsFromEvents(events);
    }

    if (!members.length) {
      const events = filteredEvents || getFilteredEvents(f);
      return MetricsEngine.uniqueRecipientsFromEvents(events);
    }

    const seen = new Map();
    members.forEach(m => {
      const key = m.contactId || m.emailAddress || m.campaignMemberId;
      if (key && !seen.has(key)) seen.set(key, m);
    });
    return Array.from(seen.values());
  }

  function getFilteredFollowUps(filters = {}) {
    const f = normalizeFilters(filters);
    const data = DataEngine.getNormalized();
    const matchingEventIds = new Set(getFilteredEvents(f).map(e => e.emailEventId).filter(Boolean));

    return (data.followUp || []).filter(row => {
      if (!isAll(f.campaignId) && row.campaignId !== f.campaignId) return false;
      if (hasEventLevelFilters(f) && row.emailEventId && !matchingEventIds.has(row.emailEventId)) return false;
      return true;
    });
  }

  function getOverview(filters = {}) {
    const events = getFilteredEvents(filters);
    const recipients = getFilteredMembers(filters, events);
    const followUps = getFilteredFollowUps(filters);
    return {
      events,
      recipients,
      followUps,
      metrics: MetricsEngine.calculate(events, recipients),
      followUpMetrics: MetricsEngine.followUpMetrics(followUps)
    };
  }

  function groupByCampaign(filters = {}) {
    const data = DataEngine.getNormalized();
    const baseFilters = normalizeFilters(filters);
    const ids = new Map();

    data.campaigns.forEach(c => {
      if (c.campaignId) ids.set(c.campaignId, c.campaignName || c.campaignId);
    });
    data.emailEvents.forEach(e => {
      if (e.campaignId && !ids.has(e.campaignId)) ids.set(e.campaignId, e.campaignName || e.campaignId);
    });

    const rows = [];
    ids.forEach((name, id) => {
      if (!isAll(baseFilters.campaignId) && id !== baseFilters.campaignId) return;
      const f = { ...baseFilters, campaignId: id };
      const overview = getOverview(f);
      if (!overview.events.length && !overview.recipients.length) return;
      rows.push({ campaignId: id, campaignName: name, ...overview.metrics });
    });

    return rows.sort((a, b) => b.sent - a.sent || a.campaignName.localeCompare(b.campaignName));
  }

  function groupBySequence(filters = {}) {
    const events = getFilteredEvents(filters);
    const groups = new Map();
    events.forEach(e => {
      const key = e.sequence || '(No Sequence)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });

    return Array.from(groups.entries()).map(([sequence, rows]) => ({
      sequence,
      ...MetricsEngine.calculate(rows, MetricsEngine.uniqueRecipientsFromEvents(rows))
    })).sort((a, b) => b.sent - a.sent || a.sequence.localeCompare(b.sequence));
  }

  function getRecipientRows(filters = {}) {
    const data = DataEngine.getNormalized();
    const events = getFilteredEvents(filters);
    const f = normalizeFilters(filters);
    let members = (data.campaignMembers || []).filter(m => m.membershipStatus === 'ACTIVE');
    if (!isAll(f.campaignId)) members = members.filter(m => m.campaignId === f.campaignId);

    if (!members.length) {
      return MetricsEngine.uniqueRecipientsFromEvents(events).map(e => ({
        emailAddress: e.emailAddress,
        campaignName: e.campaignName,
        membershipStatus: 'ACTIVE',
        preDeliveryCheckStatus: e.preDeliveryCheckStatus,
        leadStatus: e.leadStatus,
        sent: events.filter(x => (x.contactId && x.contactId === e.contactId) || (x.emailAddress && x.emailAddress === e.emailAddress)).filter(MetricsEngine.isSent).length,
        opened: events.some(x => ((x.contactId && x.contactId === e.contactId) || x.emailAddress === e.emailAddress) && DataEngine.getEngagement(x).opened),
        replied: events.some(x => ((x.contactId && x.contactId === e.contactId) || x.emailAddress === e.emailAddress) && DataEngine.getEngagement(x).replied)
      }));
    }

    return members.map(m => {
      const user = DataEngine.getUserById(m.userId);
      const memberEvents = events.filter(e =>
        (m.contactId && e.contactId === m.contactId) ||
        (m.emailAddress && e.emailAddress === m.emailAddress)
      );
      return {
        emailAddress: m.emailAddress || (user && user.emailAddress) || '',
        campaignName: m.campaignName || (data.campaigns.find(c => c.campaignId === m.campaignId) || {}).campaignName || m.campaignId,
        membershipStatus: m.membershipStatus,
        preDeliveryCheckStatus: m.preDeliveryCheckStatus,
        leadStatus: (user && user.leadStatus) || '',
        sent: memberEvents.filter(MetricsEngine.isSent).length,
        opened: memberEvents.some(e => DataEngine.getEngagement(e).opened),
        replied: memberEvents.some(e => DataEngine.getEngagement(e).replied)
      };
    });
  }

  return {
    getFilteredEvents,
    getFilteredMembers,
    getFilteredFollowUps,
    getOverview,
    groupByCampaign,
    groupBySequence,
    getRecipientRows
  };
})();
