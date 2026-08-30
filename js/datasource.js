/**
 * ============================================================
 * CAMPAIGN ANALYTICS - DATA SOURCE
 * ============================================================
 * Loads the relational Google Sheets dataset from the Apps Script
 * dashboard endpoint. No KPI logic belongs in this module.
 */
const DataSource = (function () {
  const API_URL = 'https://script.google.com/macros/s/AKfycbyNLtajflaKIeEmQwfOYZ7TmdtmyA5-zsS1pKhJeKIZ9YqeEhrSvdhLRjlQO1-TZah2tg/exec';

  let dataStore = emptyStore();

  function emptyStore() {
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

  function rows(payload, key) {
    return Array.isArray(payload && payload[key]) ? payload[key] : [];
  }

  async function loadData(forceRefresh = false) {
    if (dataStore.lastUpdated && !forceRefresh) return dataStore;

    const url = `${API_URL}?action=get_dashboard_data&_ts=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Dashboard API HTTP ${response.status}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Dashboard API did not return valid JSON.');
    }

    if (payload && payload.error) {
      throw new Error(`Dashboard API: ${payload.error}`);
    }

    const warnings = [];
    if (!Array.isArray(payload['Campaign Members'])) {
      warnings.push('Campaign Members was not returned by the API; recipient counts will fall back to Email Events.');
    }

    dataStore = {
      users: rows(payload, 'Users'),
      campaigns: rows(payload, 'Campaigns'),
      campaignMembers: rows(payload, 'Campaign Members'),
      journeys: rows(payload, 'Journeys'),
      emailEvents: rows(payload, 'Email Events'),
      tracking: rows(payload, 'Tracking'),
      followUp: rows(payload, 'Follow-Up'),
      analysis: rows(payload, 'Analysis'),
      reports: rows(payload, 'Reports'),
      lastUpdated: new Date(),
      sourceWarnings: warnings
    };

    console.info('Campaign Analytics data loaded', {
      users: dataStore.users.length,
      campaigns: dataStore.campaigns.length,
      campaignMembers: dataStore.campaignMembers.length,
      journeys: dataStore.journeys.length,
      emailEvents: dataStore.emailEvents.length,
      tracking: dataStore.tracking.length,
      followUp: dataStore.followUp.length
    });

    return dataStore;
  }

  return {
    loadData,
    getStore: () => dataStore,
    getApiUrl: () => API_URL
  };
})();
