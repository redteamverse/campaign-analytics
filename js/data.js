/**
 * AltSec Outreach DataEngine — V18.2.2 BOOLEAN FLAG FIX
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

      /*
       * Google Sheets returns Y/N style flags as strings.
       * JavaScript treats every non-empty string as truthy, so the literal
       * value "N" was incorrectly interpreted as true by code such as:
       *
       *   user.unsubscribed ? 'Suppressed' : 'Subscribed'
       *
       * Normalize boolean/flag fields here at the data boundary so every
       * dashboard module receives a real boolean instead of a truthy string.
       */
      const booleanKeys = new Set([
        'unsubscribed',
        'isOpened',
        'isReplied'
      ]);

      if (booleanKeys.has(key)) {
        result[key] = normalizeBooleanFlag(value);
      } else {
        result[key] = value;
      }
    });

    return result;
  }


  function normalizeBooleanFlag(value) {

    if (value === true || value === false) {
      return value;
    }

    if (value === 1) {
      return true;
    }

    if (value === 0 || value === null || value === undefined) {
      return false;
    }

    const text =
      String(value)
        .trim()
        .toUpperCase();

    if (
      text === 'Y' ||
      text === 'YES' ||
      text === 'TRUE' ||
      text === '1'
    ) {
      return true;
    }

    if (
      text === '' ||
      text === 'N' ||
      text === 'NO' ||
      text === 'FALSE' ||
      text === '0'
    ) {
      return false;
    }

    /*
     * Unknown flag values must fail closed as false for display purposes.
     * We never infer suppression from an unrecognized non-empty string.
     */
    return false;
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


  /*
   * Compatibility getters
   * ------------------------------------------------------------
   * Older dashboard modules (analytics.js / metrics.js / tables.js)
   * call DataEngine through these public methods.
   *
   * V18.2 accidentally exposed only init/getNormalized/getUserById,
   * which caused:
   *   DataEngine.getEngagement is not a function
   *
   * Keep this public API stable even though the internal store is now
   * normalized from the V18 relational payload.
   */

  function getUsers() {
    return normalized.users;
  }

  function getCampaignMembers() {
    return normalized.campaignMembers;
  }

  function getCampaigns() {
    return normalized.campaigns;
  }

  function getJourneys() {
    return normalized.journeys;
  }

  function getEmailEvents() {
    return normalized.emailEvents;
  }

  function getEngagement() {
    /*
     * The dashboard's engagement analytics are event-level.
     * Email Events contains sent/open/click/reply/unsubscribe and
     * campaign/sequence/version/segment fields consumed by analytics.js.
     */
    return normalized.emailEvents;
  }

  function getTracking() {
    return normalized.tracking;
  }

  function getFollowUps() {
    return normalized.followUps;
  }

  function getAnalysis() {
    return normalized.analysis;
  }

  function getReports() {
    return normalized.reports;
  }


  return {
    init,
    getNormalized,
    getUserById,

    // Historical/public DataEngine API used by the existing dashboard.
    getUsers,
    getCampaignMembers,
    getCampaigns,
    getJourneys,
    getEmailEvents,
    getEngagement,
    getTracking,
    getFollowUps,
    getAnalysis,
    getReports
  };

})();
