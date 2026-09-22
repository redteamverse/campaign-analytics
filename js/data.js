/**
 * AltSec Outreach DataEngine — V18.2 COMPATIBILITY FIX
 *
 * Accepts both:
 *   - the historical flat relational payload
 *   - the V18 store { relational: { ...sheets } }
 *
 * It normalizes Google Sheet header names into the camelCase field names
 * used by app.js, analytics.js, metrics.js and tables.js.
 */

const DataEngine = (() => {

  let normalized = emptyNormalized();


  function emptyNormalized() {
    return {
      users: [],
      campaignMembers: [],
      campaigns: [],
      journeys: [],
      emailEvents: [],
      tracking: [],
      followUps: [],
      analysis: [],
      reports: []
    };
  }


  function cleanText(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }


  function headerToKey(header) {

    const raw = cleanText(header);

    if (!raw) {
      return '';
    }

    // Explicit mappings keep compatibility with the dashboard's established
    // field names, especially punctuation-heavy sheet headers.
    const exact = {
      'User ID': 'userId',
      'First Name': 'firstName',
      'Email Address': 'emailAddress',
      'Company': 'company',
      'Contact ID': 'contactId',
      'Lead Status': 'leadStatus',
      'Unsubscribed': 'unsubscribed',
      'Created At': 'createdAt',
      'Updated At': 'updatedAt',

      'Campaign Member ID': 'campaignMemberId',
      'Campaign ID': 'campaignId',
      'Campaign Name': 'campaignName',
      'Membership Status': 'membershipStatus',
      'Pre Delivery Check Status': 'preDeliveryCheckStatus',
      'Pre Delivery Check Message': 'preDeliveryCheckMessage',
      'Pre Delivery Check At': 'preDeliveryCheckAt',

      'Campaign Status': 'campaignStatus',
      'Total Email Events': 'totalEmailEvents',
      'Total Contacts': 'totalContacts',

      'Journey ID': 'journeyId',
      'Journey Status': 'journeyStatus',

      'Email Event ID': 'emailEventId',
      'Sequence': 'sequence',
      'Sequence Step': 'sequenceStep',
      'Email Version': 'emailVersion',
      'Target Segment': 'targetSegment',
      'Pre Delivery Check Status': 'preDeliveryCheckStatus',
      'Pre Delivery Check Message': 'preDeliveryCheckMessage',
      'Mail Sent Status': 'mailSentStatus',
      'Sent Timestamp': 'sentTimestamp',
      'Message ID': 'messageId',
      'Post Delivery Check Status': 'postDeliveryCheckStatus',
      'Post Delivery Check Message': 'postDeliveryCheckMessage',
      'Is Opened?': 'isOpened',
      'First Open Time': 'firstOpenTime',
      'Link Clicked': 'linkClicked',
      'Is Replied?': 'isReplied',
      'Reply Timestamp': 'replyTimestamp',
      'Follow-Up Status': 'followUpStatus',
      'Follow-Up Due At': 'followUpDueAt',
      'Follow-Up Sent At': 'followUpSentAt',
      'Outreach Type': 'outreachType',
      'OUTREACH_TYPE': 'outreachType'
    };

    if (exact[raw]) {
      return exact[raw];
    }

    const words =
      raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) {
      return '';
    }

    return (
      words[0].toLowerCase() +
      words
        .slice(1)
        .map(word =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase()
        )
        .join('')
    );
  }


  function normalizeRecord(row) {

    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row)
    ) {
      return {};
    }

    const result = {};

    Object.entries(row).forEach(([header, value]) => {

      const key = headerToKey(header);

      if (!key) {
        return;
      }

      result[key] = value;
    });

    return result;
  }


  function normalizeRows(rows) {

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .filter(row =>
        row &&
        typeof row === 'object' &&
        !Array.isArray(row)
      )
      .map(normalizeRecord);
  }


  function resolveRelational(rawStore) {

    if (
      !rawStore ||
      typeof rawStore !== 'object' ||
      Array.isArray(rawStore)
    ) {
      return {};
    }

    const candidates = [
      rawStore.relational,
      rawStore.data,
      rawStore.result?.data,
      rawStore.result?.relational,
      rawStore.result?.result?.data,
      rawStore.result?.result?.relational,
      rawStore
    ];

    return (
      candidates.find(candidate =>
        candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        (
          Object.prototype.hasOwnProperty.call(candidate, 'Users') ||
          Object.prototype.hasOwnProperty.call(candidate, 'Campaign Members') ||
          Object.prototype.hasOwnProperty.call(candidate, 'Campaigns') ||
          Object.prototype.hasOwnProperty.call(candidate, 'Email Events')
        )
      ) ||
      {}
    );
  }


  function init(rawStore) {

    const relational =
      resolveRelational(rawStore);

    normalized = {
      users:
        normalizeRows(relational['Users']),

      campaignMembers:
        normalizeRows(relational['Campaign Members']),

      campaigns:
        normalizeRows(relational['Campaigns']),

      journeys:
        normalizeRows(relational['Journeys']),

      emailEvents:
        normalizeRows(relational['Email Events']),

      tracking:
        normalizeRows(relational['Tracking']),

      followUps:
        normalizeRows(relational['Follow-Up']),

      analysis:
        normalizeRows(relational['Analysis']),

      reports:
        normalizeRows(relational['Reports'])
    };

    return normalized;
  }


  function getNormalized() {
    return normalized;
  }


  function getUserById(userId) {

    const target =
      cleanText(userId);

    if (!target) {
      return null;
    }

    return (
      normalized.users.find(
        user =>
          cleanText(user.userId) ===
          target
      ) ||
      null
    );
  }


  return {
    init,
    getNormalized,
    getUserById
  };

})();
