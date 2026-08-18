/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - DATA SOURCE MODULE
 * ============================================================
 * Handles fetching, caching, and routing data from the Google Sheets
 * Web App API across all core relational entities.
 */

const DataSource = (function () {
  // Replace with your published Google Apps Script Web App URL
  const API_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

  // Master local data store
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

  /**
   * Fetches relational data from Google Apps Script Web App
   */
  async function loadData(forceRefresh = false) {
    if (dataStore.lastUpdated && !forceRefresh) {
      return dataStore;
    }

    try {
      const response = await fetch(`${API_URL}?action=get_dashboard_data`);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const payload = await response.json();

      if (payload.error) {
        throw new Error(`API Error: ${payload.error}`);
      }

      // Map API sheets to relational store keys
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

  /**
   * Data accessors for individual modules
   */
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
