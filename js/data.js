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

  function findProp(obj, targetKeys) {
    if (!obj || typeof obj !== 'object') return '';
    const objKeys = Object.keys(obj);
    for (let key of targetKeys) {
      const match = objKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
      if (match && obj[match] !== undefined && obj[match] !== null) {
        return String(obj[match]).trim();
      }
    }
    return '';
  }

  function parseBool(val) {
    if (typeof val === 'boolean') return val;
    const clean = String(val || '').trim().toLowerCase();
    return clean === 'y' || clean === 'yes' || clean === 'true' || clean === '1';
  }

  function init(rawDataStore) {
    const raw = rawDataStore || {};

    normalizedData.users = (raw.users || []).map(row => ({
      userId: findProp(row, ['User ID', 'UserId', 'ID']),
      contactId: findProp(row, ['Contact ID', 'ContactId']),
      firstName: findProp(row, ['First Name', 'FirstName']),
      email: findProp(row, ['Email Address', 'Email', 'EmailAddress']).toLowerCase(),
      company: findProp(row, ['Company']),
      leadStatus: findProp(row, ['Lead Status', 'Status'])
    }));

    normalizedData.campaigns = (raw.campaigns || []).map(row => ({
      campaignId: findProp(row, ['Campaign ID', 'CampaignId']),
      campaignName: findProp(row, ['Campaign Name', 'CampaignName']),
      status: findProp(row, ['Campaign Status', 'Status'])
    }));

    normalizedData.journeys = (raw.journeys || []).map(row => ({
      journeyId: findProp(row, ['Journey ID', 'JourneyId']),
      contactId: findProp(row, ['Contact ID', 'ContactId']),
      campaignId: findProp(row, ['Campaign ID', 'CampaignId']),
      campaignName: findProp(row, ['Campaign Name', 'CampaignName']),
      emailAddress: findProp(row, ['Email Address', 'Email']),
      sequence: findProp(row, ['Sequence']),
      targetSegment: findProp(row, ['Target Segment', 'Segment']),
      emailVersion: findProp(row, ['Email Version', 'Version'])
    }));

    normalizedData.emailEvents = (raw.emailEvents || []).map(row => ({
      emailEventId: findProp(row, ['Email Event ID', 'EmailEventId', 'Message ID', 'MessageId']),
      messageId: findProp(row, ['Message ID', 'MessageId']),
      journeyId: findProp(row, ['Journey ID', 'JourneyId']),
      contactId: findProp(row, ['Contact ID', 'ContactId']),
      campaignId: findProp(row, ['Campaign ID', 'CampaignId']),
      campaignName: findProp(row, ['Campaign Name', 'CampaignName']),
      emailAddress: findProp(row, ['Email Address', 'Email']),
      sequence: findProp(row, ['Sequence']),
      targetSegment: findProp(row, ['Target Segment', 'Segment']),
      emailVersion: findProp(row, ['Email Version', 'Version']),
      isOpened: parseBool(findProp(row, ['Is Opened?', 'Opened'])),
      linkClicked: parseBool(findProp(row, ['Link Clicked', 'Clicked'])),
      isReplied: parseBool(findProp(row, ['Is Replied?', 'Replied'])),
      unsubscribed: parseBool(findProp(row, ['Unsubscribed', 'Unsubscribed?']))
    }));

    normalizedData.tracking = (raw.tracking || []).map(row => ({
      emailEventId: findProp(row, ['Email Event ID', 'EmailEventId']),
      messageId: findProp(row, ['Message ID', 'MessageId']),
      isOpened: parseBool(findProp(row, ['Is Opened?', 'Opened'])),
      linkClicked: parseBool(findProp(row, ['Link Clicked', 'Clicked'])),
      isReplied: parseBool(findProp(row, ['Is Replied?', 'Replied'])),
      unsubscribed: parseBool(findProp(row, ['Unsubscribed', 'Unsubscribed?']))
    }));

    console.log('Data Engine successfully loaded records:', {
      users: normalizedData.users.length,
      campaigns: normalizedData.campaigns.length,
      journeys: normalizedData.journeys.length,
      emailEvents: normalizedData.emailEvents.length,
      tracking: normalizedData.tracking.length
    });

    return normalizedData;
  }

  return {
    init: init,
    getNormalized: () => normalizedData,
    getTrackingForEvent: (id) => normalizedData.tracking.find(
      t => t.emailEventId === id || t.messageId === id
    )
  };
})();
