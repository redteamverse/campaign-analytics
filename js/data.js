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

  /**
   * Safe reader that looks up a property in a row object 
   * regardless of case, extra spaces, or underscores.
   */
  function getVal(row, possibleKeys) {
    if (!row || typeof row !== 'object') return '';
    const keys = Object.keys(row);
    if (!Array.isArray(possibleKeys)) possibleKeys = [possibleKeys];

    for (let targetKey of possibleKeys) {
      const cleanTarget = String(targetKey).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (let actualKey of keys) {
        const cleanActual = String(actualKey).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanActual === cleanTarget && row[actualKey] !== undefined && row[actualKey] !== null) {
          return String(row[actualKey]).trim();
        }
      }
    }
    return '';
  }

  function parseBool(val) {
    if (typeof val === 'boolean') return val;
    const clean = String(val || '').trim().toLowerCase();
    return clean === 'y' || clean === 'yes' || clean === 'true' || clean === '1' || clean === 'opened' || clean === 'clicked';
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

  function init(rawDataStore) {
    // 1. Normalize Users
    normalizedData.users = (rawDataStore.users || [])
      .map(row => ({
        userId: getVal(row, ['User ID', 'UserId', 'Contact ID', 'ContactId', 'ID']),
        contactId: getVal(row, ['Contact ID', 'ContactId', 'User ID', 'UserId', 'ID']),
        firstName: getVal(row, ['First Name', 'FirstName', 'Name']),
        email: getVal(row, ['Email Address', 'Email', 'EmailAddress']).toLowerCase(),
        company: getVal(row, ['Company', 'Organization']),
        leadStatus: getVal(row, ['Lead Status', 'Status']),
        unsubscribed: parseBool(getVal(row, ['Unsubscribed', 'Unsubscribed?'])),
        createdAt: parseDate(getVal(row, ['Created At', 'CreatedAt'])),
        updatedAt: parseDate(getVal(row, ['Updated At', 'UpdatedAt']))
      }))
      // Filter out completely blank rows
      .filter(u => u.userId || u.contactId || u.email || u.firstName);

    // 2. Normalize Campaigns
    normalizedData.campaigns = (rawDataStore.campaigns || [])
      .map(row => ({
        campaignId: getVal(row, ['Campaign ID', 'CampaignId', 'ID']),
        campaignName: getVal(row, ['Campaign Name', 'CampaignName', 'Name']),
        status: getVal(row, ['Campaign Status', 'Status']),
        totalEmailEvents: parseNum(getVal(row, ['Total Email Events', 'TotalEvents'])),
        totalContacts: parseNum(getVal(row, ['Total Contacts', 'TotalContacts'])),
        createdAt: parseDate(getVal(row, ['Created At', 'CreatedAt'])),
        updatedAt: parseDate(getVal(row, ['Updated At', 'UpdatedAt']))
      }))
      .filter(c => c.campaignId || c.campaignName);

    // 3. Normalize Journeys
    normalizedData.journeys = (rawDataStore.journeys || [])
      .map(row => ({
        journeyId: getVal(row, ['Journey ID', 'JourneyId']),
        contactId: getVal(row, ['Contact ID', 'ContactId']),
        campaignId: getVal(row, ['Campaign ID', 'CampaignId']),
        sequence: parseNum(getVal(row, ['Sequence', 'Seq'])),
        targetSegment: getVal(row, ['Target Segment', 'Segment']),
        emailVersion: getVal(row, ['Email Version', 'Version']),
        outreachType: getVal(row, ['OUTREACH_TYPE', 'Outreach Type', 'Type'])
      }))
      .filter(j => j.journeyId || j.contactId || j.campaignId);

    // 4. Normalize Email Events
    normalizedData.emailEvents = (rawDataStore.emailEvents || [])
      .map(row => ({
        emailEventId: getVal(row, ['Email Event ID', 'EmailEventId', 'Message ID', 'MessageId', 'ID']),
        journeyId: getVal(row, ['Journey ID', 'JourneyId']),
        contactId: getVal(row, ['Contact ID', 'ContactId']),
        campaignId: getVal(row, ['Campaign ID', 'CampaignId']),
        messageId: getVal(row, ['Message ID', 'MessageId']),
        mailStatus: getVal(row, ['Mail Sent Status', 'Mail Status', 'MailStatus', 'Status', 'Sent Status']),
        sentTimestamp: parseDate(getVal(row, ['Sent Timestamp', 'SentTimestamp', 'Timestamp'])),
        outreachType: getVal(row, ['OUTREACH_TYPE', 'Outreach Type', 'Type']),
        isOpened: parseBool(getVal(row, ['Is Opened?', 'Opened', 'Is Opened'])),
        firstOpenTime: parseDate(getVal(row, ['First Open Time', 'FirstOpenTime'])),
        linkClicked: parseBool(getVal(row, ['Link Clicked', 'Clicked', 'Is Clicked'])),
        isReplied: parseBool(getVal(row, ['Is Replied?', 'Replied', 'Is Replied'])),
        replyTimestamp: parseDate(getVal(row, ['Reply Timestamp', 'ReplyTimestamp'])),
        unsubscribed: parseBool(getVal(row, ['Unsubscribed', 'Unsubscribed?']))
      }))
      .filter(e => e.emailEventId || e.journeyId || e.contactId || e.campaignId);

    // 5. Normalize Tracking Tab
    normalizedData.tracking = (rawDataStore.tracking || [])
      .map(row => ({
        emailEventId: getVal(row, ['Email Event ID', 'EmailEventId', 'Message ID', 'MessageId']),
        messageId: getVal(row, ['Message ID', 'MessageId']),
        isOpened: parseBool(getVal(row, ['Is Opened?', 'Opened', 'Is Opened'])),
        firstOpenTime: parseDate(getVal(row, ['First Open Time', 'FirstOpenTime'])),
        linkClicked: parseBool(getVal(row, ['Link Clicked', 'Clicked', 'Is Clicked'])),
        isReplied: parseBool(getVal(row, ['Is Replied?', 'Replied', 'Is Replied'])),
        replyTimestamp: parseDate(getVal(row, ['Reply Timestamp', 'ReplyTimestamp'])),
        unsubscribed: parseBool(getVal(row, ['Unsubscribed', 'Unsubscribed?']))
      }))
      .filter(t => t.emailEventId || t.messageId);

    // 6. Normalize Follow-Up
    normalizedData.followUp = (rawDataStore.followUp || []).map(row => ({
      followUpId: getVal(row, ['Follow-Up ID', 'FollowUpID']),
      emailEventId: getVal(row, ['Email Event ID', 'EmailEventID']),
      journeyId: getVal(row, ['Journey ID', 'JourneyID']),
      contactId: getVal(row, ['Contact ID', 'ContactID']),
      campaignId: getVal(row, ['Campaign ID', 'CampaignID']),
      status: getVal(row, ['Follow-Up Status', 'Status']),
      dueAt: parseDate(getVal(row, ['Follow-Up Due At', 'Due At'])),
      sentAt: parseDate(getVal(row, ['Follow-Up Sent At', 'Sent At']))
    }));

    // 7. Normalize Analysis
    normalizedData.analysis = (rawDataStore.analysis || []).map(row => ({
      analysisId: getVal(row, ['Analysis ID']),
      analysisDate: parseDate(getVal(row, ['Analysis Date'])),
      periodStart: parseDate(getVal(row, ['Period Start'])),
      periodEnd: parseDate(getVal(row, ['Period End'])),
      campaignId: getVal(row, ['Campaign ID']),
      campaignName: getVal(row, ['Campaign Name']),
      openRate: parseNum(getVal(row, ['Open Rate'])),
      clickRate: parseNum(getVal(row, ['Click Rate'])),
      replyRate: parseNum(getVal(row, ['Reply Rate'])),
      analysisType: getVal(row, ['Analysis Type'])
    }));

    // 8. Normalize Reports
    normalizedData.reports = (rawDataStore.reports || []).map(row => ({
      reportId: getVal(row, ['Report ID']),
      reportName: getVal(row, ['Report Name']),
      generatedAt: parseDate(getVal(row, ['Generated At'])),
      reportType: getVal(row, ['Report Type']),
      dataPayload: getVal(row, ['Data Payload'])
    }));

    console.log('Data Engine initialized with robust field matching:', normalizedData);
    return normalizedData;
  }

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
