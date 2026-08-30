/** CAMPAIGN ANALYTICS - UI CONTROLLER */
document.addEventListener('DOMContentLoaded', initDashboard);

const FILTER_IDS = ['campaignFilter', 'sequenceFilter', 'versionFilter', 'segmentFilter'];
let listenersAttached = false;

function getFilters() {
  return {
    campaignId: document.getElementById('campaignFilter')?.value || 'all',
    sequence: document.getElementById('sequenceFilter')?.value || 'all',
    version: document.getElementById('versionFilter')?.value || 'all',
    segment: document.getElementById('segmentFilter')?.value || 'all'
  };
}

function setDataStatus(message, state = 'ready') {
  const label = document.getElementById('dataStatusLabel');
  const dot = document.getElementById('dataStatusDot');
  if (label) label.textContent = message;
  if (dot) dot.dataset.state = state;
}

function showDashboardError(error) {
  console.error(error);
  setDataStatus('Data load failed', 'error');
  const banner = document.getElementById('dashboardNotice');
  if (banner) {
    banner.hidden = false;
    banner.className = 'dashboard-notice error';
    banner.textContent = error?.message || String(error);
  }
}

async function initDashboard(forceRefresh = true) {
  setDataStatus('Loading data…', 'loading');
  try {
    const current = getFilters();
    const rawStore = await DataSource.loadData(forceRefresh);
    DataEngine.init(rawStore);
    populateFilterDropdowns(current);
    if (!listenersAttached) attachEventListeners();
    renderDashboard();
    updateLastUpdated(rawStore.lastUpdated);

    const warning = rawStore.sourceWarnings && rawStore.sourceWarnings[0];
    const banner = document.getElementById('dashboardNotice');
    if (banner) {
      banner.hidden = !warning;
      banner.className = 'dashboard-notice warning';
      banner.textContent = warning || '';
    }
    setDataStatus('Live data ready', 'ready');
  } catch (error) {
    showDashboardError(error);
  }
}

function setOptions(id, firstLabel, values, selectedValue) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = 'all';
  first.textContent = firstLabel;
  select.appendChild(first);
  values.forEach(item => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });
  const available = Array.from(select.options).some(o => o.value === selectedValue);
  select.value = available ? selectedValue : 'all';
}

function populateFilterDropdowns(previous = {}) {
  const data = DataEngine.getNormalized();
  const campaignMap = new Map();
  data.campaigns.forEach(c => { if (c.campaignId) campaignMap.set(c.campaignId, c.campaignName || c.campaignId); });
  data.emailEvents.forEach(e => { if (e.campaignId && !campaignMap.has(e.campaignId)) campaignMap.set(e.campaignId, e.campaignName || e.campaignId); });

  setOptions(
    'campaignFilter',
    'All Campaigns',
    Array.from(campaignMap, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    previous.campaignId
  );

  const uniqueOptions = (field) => [...new Set(data.emailEvents.map(e => e[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map(value => ({ value: String(value), label: String(value) }));

  setOptions('sequenceFilter', 'All Sequences', uniqueOptions('sequence'), previous.sequence);
  setOptions('versionFilter', 'All Versions', uniqueOptions('emailVersion'), previous.version);
  setOptions('segmentFilter', 'All Segments', uniqueOptions('targetSegment'), previous.segment);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderDashboard() {
  const filters = getFilters();
  const overview = AnalyticsEngine.getOverview(filters);
  const m = overview.metrics;
  const f = overview.followUpMetrics;

  setText('kpiRecipients', m.recipients.toLocaleString());
  setText('kpiMessages', m.messages.toLocaleString());
  setText('kpiSent', m.sent.toLocaleString());
  setText('kpiDelivered', m.delivered.toLocaleString());
  setText('kpiPrecheckValid', m.preCheckValid.toLocaleString());
  setText('kpiPrecheckRisky', m.preCheckRisky.toLocaleString());
  setText('kpiBounced', m.bounced.toLocaleString());
  setText('kpiPendingFollowups', f.pending.toLocaleString());
  setText('kpiOpenRate', `${m.openRate.toFixed(1)}%`);
  setText('kpiClickRate', `${m.clickRate.toFixed(1)}%`);
  setText('kpiReplyRate', `${m.replyRate.toFixed(1)}%`);
  setText('kpiUnsubscribeRate', `${m.unsubscribeRate.toFixed(1)}%`);

  renderCharts(overview);
  renderCampaignSummaryTable(AnalyticsEngine.groupByCampaign(filters));
  renderSequenceTable(AnalyticsEngine.groupBySequence(filters));
  renderRecipientTable(AnalyticsEngine.getRecipientRows(filters));
}

function resetFilters() {
  FILTER_IDS.forEach(id => {
    const select = document.getElementById(id);
    if (select) select.value = 'all';
  });
  renderDashboard();
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === viewId));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
  closeMobileSidebar();
}

function openMobileSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
}

function closeMobileSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

function attachEventListeners() {
  listenersAttached = true;
  FILTER_IDS.forEach(id => document.getElementById(id)?.addEventListener('change', renderDashboard));
  document.getElementById('resetFiltersButton')?.addEventListener('click', resetFilters);
  document.getElementById('refreshButton')?.addEventListener('click', () => initDashboard(true));
  document.getElementById('mobileMenuButton')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobileSidebar);
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', event => {
      event.preventDefault();
      switchView(item.dataset.view);
    });
  });
}

function updateLastUpdated(date) {
  const label = document.getElementById('lastUpdatedLabel');
  if (!label || !date) return;
  label.textContent = `Updated ${new Date(date).toLocaleString()}`;
}
