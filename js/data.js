/**
 * ============================================================
 * CAMPAIGN ANALYTICS - NORMALIZATION LAYER
 * ============================================================
 * Converts Google Sheet row objects into one stable relational model.
 */
const DataEngine = (function () {
  let normalizedData = emptyData();
  let trackingByEvent = new Map();
  let usersById = new Map();

  function emptyData() {
    return {
      users: [],
      campaigns: [],
      campaignMembers: [],
      journeys: [],
      emailEvents: [],
      tracking: [],
      followUp: [],
      analysis: [],
      reports: [],
      lastUpdated: null,
      sourceWarnings: []
    };
  }

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function findProp(obj, aliases) {
    if (!obj || typeof obj !== 'object') return '';
    const wanted = new Set(aliases.map(normalizeKey));
    const key = Object.keys(obj).find(k => wanted.has(normalizeKey(k)));
    if (key === undefined || obj[key] === null || obj[key] === undefined) return '';
    return obj[key];
  }

  function text(obj, aliases) {
    return String(findProp(obj, aliases) || '').trim();
  }

  function lower(obj, aliases) {
    return text(obj, aliases).toLowerCase();
  }

  function upper(obj, aliases) {
    return text(obj, aliases).toUpperCase();
  }

  function yesNo(value) {
    const clean = String(value || '').trim().toLowerCase();
    return ['y', 'yes', 'true', '1'].includes(clean);
  }

  function booleanProp(obj, aliases) {
    return yesNo(findProp(obj, aliases));
  }

  function numberProp(obj, aliases) {
    const value = Number(findProp(obj, aliases));
    return Number.isFinite(value) ? value : 0;
  }

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const textValue = String(value).trim();
    if (!textValue) return null;

    // dd/MM/yyyy and dd/MM/yyyy HH:mm:ss
    const dmY = textValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dmY) {
      const d = new Date(
        Number(dmY[3]),
        Number(dmY[2]) - 1,
        Number(dmY[1]),
        Number(dmY[4] || 0),
        Number(dmY[5] || 0),
        Number(dmY[6] || 0)
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // yyyy-MM-dd HH:mm:ss
    const ymd = textValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ymd) {
      const d = new Date(
        Number(ymd[1]),
        Number(ymd[2]) - 1,
        Number(ymd[3]),
        Number(ymd[4] || 0),
        Number(ymd[5] || 0),
        Number(ymd[6] || 0)
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const parsed = new Date(textValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dateProp(obj, aliases) {
    return parseDateValue(findProp(obj, aliases));
  }

  function init(rawStore) {
    const raw = rawStore || {};
    normalizedData = emptyData();

    normalizedData.users = (raw.users || []).map(row => ({
      userId: text(row, ['User ID']),
      firstName: text(row, ['First Name']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      company: text(row, ['Company']),
      contactId: text(row, ['Contact ID']),
      leadStatus: text(row, ['Lead Status']),
      unsubscribed: booleanProp(row, ['Unsubscribed']),
      createdAt: dateProp(row, ['Created At']),
      updatedAt: dateProp(row, ['Updated At'])
    }));

    normalizedData.campaigns = (raw.campaigns || []).map(row => ({
      campaignId: text(row, ['Campaign ID']),
      campaignName: text(row, ['Campaign Name']),
      campaignStatus: upper(row, ['Campaign Status', 'Status']),
      createdAt: dateProp(row, ['Created At']),
      updatedAt: dateProp(row, ['Updated At']),
      totalContactsStored: numberProp(row, ['Total Contacts']),
      totalEmailEventsStored: numberProp(row, ['Total Email Events'])
    }));

    normalizedData.campaignMembers = (raw.campaignMembers || []).map(row => ({
      campaignMemberId: text(row, ['Campaign Member ID']),
      campaignId: text(row, ['Campaign ID']),
      userId: text(row, ['User ID']),
      contactId: text(row, ['Contact ID']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      campaignName: text(row, ['Campaign Name']),
      membershipStatus: upper(row, ['Membership Status']),
      createdAt: dateProp(row, ['Created At']),
      updatedAt: dateProp(row, ['Updated At']),
      preDeliveryCheckStatus: text(row, ['Pre Delivery Check Status']),
      preDeliveryCheckMessage: text(row, ['Pre Delivery Check Message']),
      preDeliveryCheckAt: dateProp(row, ['Pre Delivery Check At'])
    }));

    normalizedData.journeys = (raw.journeys || []).map(row => ({
      journeyId: text(row, ['Journey ID']),
      campaignId: text(row, ['Campaign ID']),
      userId: text(row, ['User ID']),
      contactId: text(row, ['Contact ID']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      campaignName: text(row, ['Campaign Name']),
      journeyStatus: upper(row, ['Journey Status', 'Status']),
      createdAt: dateProp(row, ['Created At']),
      updatedAt: dateProp(row, ['Updated At'])
    }));

    normalizedData.emailEvents = (raw.emailEvents || []).map(row => ({
      firstName: text(row, ['First Name']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      company: text(row, ['Company']),
      contactId: text(row, ['Contact ID']),
      campaignId: text(row, ['Campaign ID']),
      journeyId: text(row, ['Journey ID']),
      emailEventId: text(row, ['Email Event ID']),
      campaignName: text(row, ['Campaign Name']),
      sequence: text(row, ['Sequence']),
      sequenceStep: numberProp(row, ['Sequence Step']),
      emailVersion: text(row, ['Email Version']),
      targetSegment: text(row, ['Target Segment']),
      preDeliveryCheckStatus: text(row, ['Pre Delivery Check Status']),
      preDeliveryCheckMessage: text(row, ['Pre Delivery Check Message']),
      preDeliveryCheckAt: dateProp(row, ['Pre Delivery Check At']),
      mailSentStatus: text(row, ['Mail Sent Status', 'Mail Status']),
      sentTimestamp: dateProp(row, ['Sent Timestamp']),
      messageId: text(row, ['Message ID']),
      postDeliveryCheckStatus: text(row, ['Post Delivery Check Status']),
      postDeliveryCheckMessage: text(row, ['Post Delivery Check Message']),
      isOpened: booleanProp(row, ['Is Opened?', 'Is Opened', 'Opened']),
      firstOpenTime: dateProp(row, ['First Open Time']),
      linkClicked: booleanProp(row, ['Link Clicked', 'Clicked']),
      isReplied: booleanProp(row, ['Is Replied?', 'Is Replied', 'Replied']),
      replyTimestamp: dateProp(row, ['Reply Timestamp']),
      unsubscribed: booleanProp(row, ['Unsubscribed']),
      followUpStatus: text(row, ['Follow-Up Status', 'Follow Up Status']),
      followUpDueAt: dateProp(row, ['Follow-Up Due At', 'Follow Up Due At']),
      followUpSentAt: dateProp(row, ['Follow-Up Sent At', 'Follow Up Sent At']),
      leadStatus: text(row, ['Lead Status']),
      outreachType: upper(row, ['Outreach Type'])
    }));

    normalizedData.tracking = (raw.tracking || []).map(row => ({
      emailEventId: text(row, ['Email Event ID']),
      journeyId: text(row, ['Journey ID']),
      contactId: text(row, ['Contact ID']),
      campaignId: text(row, ['Campaign ID']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      messageId: text(row, ['Message ID']),
      isOpened: booleanProp(row, ['Is Opened?', 'Is Opened', 'Opened']),
      firstOpenTime: dateProp(row, ['First Open Time']),
      linkClicked: booleanProp(row, ['Link Clicked', 'Clicked']),
      isReplied: booleanProp(row, ['Is Replied?', 'Is Replied', 'Replied']),
      replyTimestamp: dateProp(row, ['Reply Timestamp']),
      unsubscribed: booleanProp(row, ['Unsubscribed']),
      postDeliveryCheckStatus: text(row, ['Post Delivery Check Status']),
      postDeliveryCheckMessage: text(row, ['Post Delivery Check Message']),
      sentTimestamp: dateProp(row, ['Sent Timestamp']),
      outreachType: upper(row, ['Outreach Type'])
    }));

    normalizedData.followUp = (raw.followUp || []).map(row => ({
      followUpId: text(row, ['Follow-Up ID', 'Follow Up ID']),
      emailEventId: text(row, ['Email Event ID']),
      journeyId: text(row, ['Journey ID']),
      contactId: text(row, ['Contact ID']),
      campaignId: text(row, ['Campaign ID']),
      emailAddress: lower(row, ['Email Address', 'Email']),
      campaignName: text(row, ['Campaign Name']),
      sequence: text(row, ['Sequence']),
      sequenceStep: numberProp(row, ['Sequence Step']),
      emailVersion: text(row, ['Email Version']),
      followUpStatus: text(row, ['Follow-Up Status', 'Follow Up Status']),
      followUpDueAt: dateProp(row, ['Follow-Up Due At', 'Follow Up Due At']),
      followUpSentAt: dateProp(row, ['Follow-Up Sent At', 'Follow Up Sent At']),
      isReplied: booleanProp(row, ['Is Replied?', 'Is Replied']),
      unsubscribed: booleanProp(row, ['Unsubscribed']),
      createdAt: dateProp(row, ['Created At'])
    }));

    normalizedData.analysis = Array.isArray(raw.analysis) ? raw.analysis : [];
    normalizedData.reports = Array.isArray(raw.reports) ? raw.reports : [];
    normalizedData.lastUpdated = raw.lastUpdated || null;
    normalizedData.sourceWarnings = Array.isArray(raw.sourceWarnings) ? raw.sourceWarnings : [];

    trackingByEvent = new Map();
    normalizedData.tracking.forEach(t => {
      const key = t.emailEventId || t.messageId;
      if (key) trackingByEvent.set(key, t);
    });

    usersById = new Map();
    normalizedData.users.forEach(u => {
      if (u.userId) usersById.set(u.userId, u);
    });

    return normalizedData;
  }

  function getTrackingForEvent(event) {
    if (!event) return null;
    const id = typeof event === 'string' ? event : (event.emailEventId || event.messageId);
    return trackingByEvent.get(id) || null;
  }

  function getEngagement(event) {
    const tracking = getTrackingForEvent(event);
    return {
      opened: Boolean(event && event.isOpened) || Boolean(tracking && tracking.isOpened),
      clicked: Boolean(event && event.linkClicked) || Boolean(tracking && tracking.linkClicked),
      replied: Boolean(event && event.isReplied) || Boolean(tracking && tracking.isReplied),
      unsubscribed: Boolean(event && event.unsubscribed) || Boolean(tracking && tracking.unsubscribed)
    };
  }

  return {
    init,
    getNormalized: () => normalizedData,
    getTrackingForEvent,
    getEngagement,
    getUserById: id => usersById.get(id) || null,
    parseDateValue
  };
})();
