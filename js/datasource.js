/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - DATA SOURCE MODULE
 * ============================================================
 */

const DataSource = (function () {
  const API_URL = 'https://script.google.com/macros/s/AKfycbyNLtajflaKIeEmQwfOYZ7TmdtmyA5-zsS1pKhJeKIZ9YqeEhrSvdhLRjlQO1-TZah2tg/exec';

  let dataStore = {
    users: [],
    campaigns: [],
    journeys: [],
    emailEvents: [],
    tracking: [],
    followUp: [],
    analysis: [],
    reports: [],
    lastUpdated: null
  };

  async function loadData(forceRefresh = false) {
    if (dataStore.lastUpdated && !forceRefresh) {
      return dataStore;
    }

    try {
      const response = await fetch(`${API_URL}?action=get_dashboard_data`, {
        method: 'GET',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const payload = await response.json();

      if (payload.error) {
        throw new Error(`API Error: ${payload.error}`);
      }

      dataStore.users = payload['Users'] || [];
      dataStore.campaigns = payload['Campaigns'] || [];
      dataStore.journeys = payload['Journeys'] || [];
      dataStore.emailEvents = payload['Email Events'] || [];
      dataStore.tracking = payload['Tracking'] || [];
      dataStore.followUp = payload['Follow-Up'] || [];
      dataStore.analysis = payload['Analysis'] || [];
      dataStore.reports = payload['Reports'] || [];
      dataStore.lastUpdated = new Date();

      console.log('Data successfully loaded into relational store:', dataStore);
      return dataStore;

    } catch (error) {
      console.error('Failed to load data from Google Sheets API:', error);
      throw error;
    }
  }

  return {
    loadData: loadData,
    getUsers: () => dataStore.users,
    getCampaigns: () => dataStore.campaigns,
    getJourneys: () => dataStore.journeys,
    getEmailEvents: () => dataStore.emailEvents,
    getTracking: () => dataStore.tracking,
    getFollowUp: () => dataStore.followUp,
    getAnalysis: () => dataStore.analysis,
    getReports: () => dataStore.reports,
    getStore: () => dataStore
  };
})();
