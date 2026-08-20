/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - DATA NORMALIZATION & RELATIONS
 * ============================================================
 */

const DataEngine = (function () {
  let normalizedData = {
    users: [],
    campaigns: [],
    journeys: [],
    emailEvents: [],
    tracking: [],
    followUp: [],
    analysis: [],
    reports: []
  };

  /* ============================================================
     HELPERS & PARSERS
     ============================================================ */

  function parseBool(val) {
    if (typeof val === 'boolean') return val;
    const clean = String(val || '').trim().toLowerCase();
    return clean === 'y' || clean === 'yes' || clean === 'true' || clean === '1';
  }

  function parseDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseNum(val) {
    const n = parseFloat(String(val || '').replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function cleanStr(val) {
    return String(val || '').trim();
  }

  /* ============================================================
     NORMALIZATION PIPELINE
     ============================================================ */

  function init(rawDataStore) {
    // 1. Normalize Users
    normalizedData.users = (rawDataStore.users || []).map(row => ({
      userId: cleanStr(row['User ID'] || row['Contact ID']),
      contactId: cleanStr(row['Contact ID'] || row['User ID']),
      firstName: cleanStr(row['First Name']),
      email: cleanStr(row['Email Address'] || row['Email']).toLowerCase(),
      company: cleanStr(row['Company']),
      leadStatus: cleanStr(row['Lead Status']),
      unsubscribed: parseBool(row['Unsubscribed'] || row['Unsubscribed?']),
      createdAt: parseDate(row['Created At']),
      updatedAt: parseDate(row['Updated At'])
    }));

    // 2. Normalize Campaigns
    normalizedData.campaigns = (rawDataStore.campaigns || []).map(row => ({
      campaignId: cleanStr(row['Campaign ID']),
      campaignName: cleanStr(row['Campaign Name']),
      status: cleanStr(row['Campaign Status'] || row['Status']),
      totalEmailEvents: parseNum(row['Total Email Events']),
      totalContacts: parseNum(row['Total Contacts']),
      createdAt: parseDate(row['Created At']),
      updatedAt: parseDate(row['Updated At'])
    }));

    // 3. Normalize Journeys
    normalizedData.journeys = (rawDataStore.journeys || []).map(row => ({
      journeyId: cleanStr(row['Journey ID']),
      contactId: cleanStr(row['Contact ID']),
      campaignId: cleanStr(row['Campaign ID']),
      sequence: parseNum(row['Sequence']),
      targetSegment: cleanStr(row['Target Segment']),
      emailVersion: cleanStr(row['Email Version']),
      outreachType: cleanStr(row['OUTREACH_TYPE'] || row['Outreach Type'])
    }));

    // 4. Normalize Email Events
    normalizedData.emailEvents = (rawDataStore.emailEvents || []).map(row => ({
      emailEventId: cleanStr(row['Email Event ID'] || row['Message ID']),
      journeyId: cleanStr(row['Journey ID']),
      contactId: cleanStr(row['Contact ID']),
      campaignId: cleanStr(row['Campaign ID']),
      messageId: cleanStr(row['Message ID']),
      mailStatus: cleanStr(row['Mail Sent Status'] || row['Mail Status']),
      sentTimestamp: parseDate(row['Sent Timestamp']),
      outreachType: cleanStr(row['OUTREACH_TYPE'] || row['Outreach Type']),
      // Inline Tracking Fallbacks
      isOpened: parseBool(row['Is Opened?'] || row['Opened']),
      firstOpenTime: parseDate(row['First Open Time']),
      linkClicked: parseBool(row['Link Clicked'] || row['Clicked']),
      isReplied: parseBool(row['Is Replied?'] || row['Replied']),
      replyTimestamp: parseDate(row['Reply Timestamp']),
      unsubscribed: parseBool(row['Unsubscribed'] || row['Unsubscribed?'])
    }));

    // 5. Normalize Tracking Tab (or synthesize from Email Events if empty)
    const rawTracking = rawDataStore.tracking || [];
    if (rawTracking.length > 0) {
      normalizedData.tracking = rawTracking.map(row => ({
        emailEventId: cleanStr(row['Email Event ID'] || row['Message ID']),
        messageId: cleanStr(row['Message ID']),
        isOpened: parseBool(row['Is Opened?'] || row['Opened']),
        firstOpenTime: parseDate(row['First Open Time']),
        linkClicked: parseBool(row['Link Clicked'] || row['Clicked']),
        isReplied: parseBool(row['Is Replied?'] || row['Replied']),
        replyTimestamp: parseDate(row['Reply Timestamp']),
        unsubscribed: parseBool(row['Unsubscribed'] || row['Unsubscribed?'])
      }));
    } else {
      // Fallback: Map engagement state directly from emailEvents tab
      normalizedData.tracking = normalizedData.emailEvents.map(evt => ({
        emailEventId: evt.emailEventId,
        messageId: evt.messageId,
        isOpened: evt.isOpened,
        firstOpenTime: evt.firstOpenTime,
        linkClicked: evt.linkClicked,
        isReplied: evt.isReplied,
        replyTimestamp: evt.replyTimestamp,
        unsubscribed: evt.unsubscribed
      }));
    }

    // 6. Normalize Follow-Up
    normalizedData.followUp = (rawDataStore.followUp || []).map(row => ({
      followUpId: cleanStr(row['Follow-Up ID']),
      emailEventId: cleanStr(row['Email Event ID']),
      journeyId: cleanStr(row['Journey ID']),
      contactId: cleanStr(row['Contact ID']),
      campaignId: cleanStr(row['Campaign ID']),
      status: cleanStr(row['Follow-Up Status'] || row['Status']),
      dueAt: parseDate(row['Follow-Up Due At'] || row['Due At']),
      sentAt: parseDate(row['Follow-Up Sent At'] || row['Sent At'])
    }));

    // 7. Normalize Analysis
    normalizedData.analysis = (rawDataStore.analysis || []).map(row => ({
      analysisId: cleanStr(row['Analysis ID']),
      analysisDate: parseDate(row['Analysis Date']),
      periodStart: parseDate(row['Period Start']),
      periodEnd: parseDate(row['Period End']),
      campaignId: cleanStr(row['Campaign ID']),
      campaignName: cleanStr(row['Campaign Name']),
      openRate: parseNum(row['Open Rate']),
      clickRate: parseNum(row['Click Rate']),
      replyRate: parseNum(row['Reply Rate']),
      analysisType: cleanStr(row['Analysis Type'])
    }));

    // 8. Normalize Reports
    normalizedData.reports = (rawDataStore.reports || []).map(row => ({
      reportId: cleanStr(row['Report ID']),
      reportName: cleanStr(row['Report Name']),
      generatedAt: parseDate(row['Generated At']),
      reportType: cleanStr(row['Report Type']),
      dataPayload: row['Data Payload'] || ''
    }));

    console.log('Data Engine initialized with normalized models:', normalizedData);
    return normalizedData;
  }

  /* ============================================================
     RELATIONAL LOOKUP HELPERS
     ============================================================ */

  function getUserByContactId(contactId) {
    return normalizedData.users.find(u => u.contactId === contactId || u.userId === contactId);
  }

  function getCampaignById(campaignId) {
    return normalizedData.campaigns.find(c => c.campaignId === campaignId);
  }

  function getJourneysForContact(contactId) {
    return normalizedData.journeys.filter(j => j.contactId === contactId);
  }

  function getEventsForCampaign(campaignId) {
    return normalizedData.emailEvents.filter(e => e.campaignId === campaignId);
  }

  function getTrackingForEvent(emailEventId) {
    return normalizedData.tracking.find(t => t.emailEventId === emailEventId) || 
           normalizedData.emailEvents.find(e => e.emailEventId === emailEventId);
  }

  function getFollowUpsForEvent(emailEventId) {
    return normalizedData.followUp.filter(f => f.emailEventId === emailEventId);
  }

  return {
    init: init,
    getNormalized: () => normalizedData,
    getUserByContactId: getUserByContactId,
    getCampaignById: getCampaignById,
    getJourneysForContact: getJourneysForContact,
    getEventsForCampaign: getEventsForCampaign,
    getTrackingForEvent: getTrackingForEvent,
    getFollowUpsForEvent: getFollowUpsForEvent
  };
})();
