/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - MAIN APPLICATION CONTROLLER
 * ============================================================
 * Orchestrates data loading, initialization, filtering, and UI rendering.
 */

(function () {
  let currentStore = null;

  /**
   * Initializes the entire application pipeline
   */
  async function initApp() {
    try {
      console.log('Initializing Relational Analytics Dashboard...');
      showLoadingState();

      // 1. Fetch raw relational data from Google Sheet Web App
      const rawStore = await DataSource.loadData();

      // 2. Normalize raw data models & register relational lookups
      currentStore = DataEngine.init(rawStore);

      // 3. Compute executive KPIs
      const kpis = AnalyticsEngine.getExecutiveKPIs();
      console.log('Executive KPIs calculated:', kpis);

      // 4. Populate UI Elements
      renderKPIs(kpis);
      populateFilterDropdowns();
      renderDashboardViews();

      // 5. Update timestamp label
      updateLastRefreshedLabel();

    } catch (error) {
      console.error('Application Initialization Failed:', error);
      showErrorState(error.message);
    }
  }

  /**
   * Renders high-level KPI cards on topbar/overview
   */
  function renderKPIs(kpis) {
    const elRecipients = document.getElementById('kpiRecipients');
    const elMessages = document.getElementById('kpiMessages');
    const elSent = document.getElementById('kpiSent');
    const elOpenRate = document.getElementById('kpiOpenRate');
    const elClickRate = document.getElementById('kpiClickRate');
    const elReplyRate = document.getElementById('kpiReplyRate');
    const elUnsubRate = document.getElementById('kpiUnsubscribeRate');

    if (elRecipients) elRecipients.innerText = kpis.totalContacts.toLocaleString();
    if (elMessages) elMessages.innerText = kpis.totalEvents.toLocaleString();
    if (elSent) elSent.innerText = kpis.totalSent.toLocaleString();
    if (elOpenRate) elOpenRate.innerText = kpis.openRate;
    if (elClickRate) elClickRate.innerText = kpis.clickRate;
    if (elReplyRate) elReplyRate.innerText = kpis.replyRate;
    if (elUnsubRate) elUnsubRate.innerText = kpis.unsubscribeRate;
  }

  /**
   * Populates filter dropdowns with unique options
   */
  function populateFilterDropdowns() {
    const campaignSelect = document.getElementById('campaignFilter');
    if (!campaignSelect) return;

    const campaigns = DataEngine.getNormalized().campaigns;
    campaignSelect.innerHTML = '<option value="ALL">All Campaigns</option>';

    campaigns.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.campaignId;
      opt.textContent = c.campaignName || c.campaignId;
      campaignSelect.appendChild(opt);
    });
  }

  /**
   * Renders charts, tables, and view panels
   */
  function renderDashboardViews() {
    // If renderSummaryTable is available in tables.js, call it
    if (typeof renderSummaryTable === 'function') {
      renderSummaryTable(DataEngine.getNormalized().campaigns);
    }
  }

  function updateLastRefreshedLabel() {
    const lbl = document.getElementById('lastUpdatedLabel');
    if (lbl) {
      const now = new Date();
      lbl.innerText = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  function showLoadingState() {
    console.log('Loading state active...');
  }

  function showErrorState(msg) {
    const summaryTable = document.getElementById('campaignSummaryTable');
    if (summaryTable) {
      summaryTable.innerHTML = `<tr><td colspan="12" style="color:red; text-align:center; padding: 20px;">Failed to load live data: ${msg}</td></tr>`;
    }
  }

  // Bind Event Listener for DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Bind Refresh Button
    const btnRefresh = document.getElementById('refreshButton');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        DataSource.loadData(true).then(() => initApp());
      });
    }
  });

})();
