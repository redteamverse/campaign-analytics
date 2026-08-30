/**
 * ============================================================
 * CAMPAIGN ANALYTICS - SINGLE METRICS ENGINE
 * ============================================================
 * This is the ONLY module that defines KPI math.
 */
const MetricsEngine = (function () {
  const clean = value => String(value || '').trim().toLowerCase();
  const unique = (items, getter) => new Set(items.map(getter).filter(Boolean)).size;
  const pct = (n, d) => d > 0 ? (n / d) * 100 : 0;

  function isSent(event) {
    return clean(event.mailSentStatus) === 'sent';
  }

  function isDelivered(event) {
    return clean(event.postDeliveryCheckStatus) === 'delivered';
  }

  function isBounced(event) {
    return clean(event.postDeliveryCheckStatus) === 'bounced';
  }

  function preCheckStatus(event) {
    return clean(event.preDeliveryCheckStatus);
  }

  function calculate(events, recipients) {
    const list = Array.isArray(events) ? events : [];
    const recipientList = Array.isArray(recipients) ? recipients : [];

    const sent = list.filter(isSent).length;
    const delivered = list.filter(isDelivered).length;
    const bounced = list.filter(isBounced).length;
    const preCheckSource = recipientList.length ? recipientList : list;
    const preCheckValid = preCheckSource.filter(e => preCheckStatus(e) === 'valid').length;
    const preCheckRisky = preCheckSource.filter(e => preCheckStatus(e) === 'risky').length;

    const engagement = list.map(e => DataEngine.getEngagement(e));
    const opened = engagement.filter(e => e.opened).length;
    const clicked = engagement.filter(e => e.clicked).length;
    const replied = engagement.filter(e => e.replied).length;
    const unsubscribed = engagement.filter(e => e.unsubscribed).length;

    // Delivered is the preferred denominator. Before post-delivery checks have
    // run, fall back to Sent so a fresh campaign does not display unusable 0%.
    const engagementBase = delivered > 0 ? delivered : sent;

    return {
      recipients: recipientList.length,
      messages: list.length,
      sent,
      delivered,
      bounced,
      preCheckValid,
      preCheckRisky,
      opened,
      clicked,
      replied,
      unsubscribed,
      firstOutreach: list.filter(e => e.outreachType === 'FIRST_OUTREACH').length,
      freshOutreach: list.filter(e => e.outreachType === 'FRESH_OUTREACH').length,
      followUpMessages: list.filter(e => e.outreachType === 'FOLLOW_UP').length,
      openRate: pct(opened, engagementBase),
      clickRate: pct(clicked, engagementBase),
      replyRate: pct(replied, engagementBase),
      unsubscribeRate: pct(unsubscribed, engagementBase),
      clickToOpenRate: pct(clicked, opened),
      replyToOpenRate: pct(replied, opened),
      deliveryRate: pct(delivered, sent),
      bounceRate: pct(bounced, sent)
    };
  }

  function followUpMetrics(followUps) {
    const list = Array.isArray(followUps) ? followUps : [];
    return {
      pending: list.filter(f => clean(f.followUpStatus) === 'pending').length,
      completed: list.filter(f => clean(f.followUpStatus) === 'completed').length,
      cancelled: list.filter(f => clean(f.followUpStatus) === 'cancelled').length
    };
  }

  function uniqueRecipientsFromEvents(events) {
    const list = Array.isArray(events) ? events : [];
    const seen = new Map();
    list.forEach(e => {
      const key = e.contactId || e.emailAddress;
      if (key && !seen.has(key)) seen.set(key, e);
    });
    return Array.from(seen.values());
  }

  return {
    calculate,
    followUpMetrics,
    uniqueRecipientsFromEvents,
    isSent,
    isDelivered,
    isBounced,
    percentage: pct,
    countUnique: unique
  };
})();
