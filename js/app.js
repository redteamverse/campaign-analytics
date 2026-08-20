/**
 * ============================================================
 * RELATIONAL ENTERPRISE DASHBOARD - UI & APP CONTROLLER
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
});

async function initDashboard() {
  try {
    const rawStore = await DataSource.loadData();
    DataEngine.init(rawStore);

    populateFilterDropdowns();
    attachEventListeners();
    renderDashboard();
  } catch (err) {
    console.error('Failed to initialize dashboard:', err);
  }
}

function populateFilterDropdowns() {
  const data = DataEngine.getNormalized();

  // Populate Campaign Select
  const campaignSelect = document.getElementById('campaignSelect') || document.querySelectorAll('select')[0];
  if (campaignSelect) {
    campaignSelect.innerHTML = '<option value="all">All Campaigns</option>';
    
    // Collect campaigns from both Campaigns tab and Email Events tab
    const campaignMap = new Map();
    data.campaigns.forEach(c => {
      if (c.campaignId) campaignMap.set(c.campaignId, c.campaignName || c.campaignId);
    });
    data.emailEvents.forEach(e => {
      if (e.campaignId && !campaignMap.has(e.campaignId)) {
        campaignMap.set(e.campaignId, e.campaignId);
      }
    });

    campaignMap.forEach((name, id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      campaignSelect.appendChild(opt);
    });
  }

  // Populate Sequences Select
  const sequenceSelect = document.querySelectorAll('select')[1];
  if (sequenceSelect) {
    sequenceSelect.innerHTML = '<option value="all">All Sequences</option>';
    const sequences = [...new Set(data.journeys.map(j => j.sequence).filter(Boolean))];
    sequences.forEach(seq => {
      const opt = document.createElement('option');
      opt.value = seq;
      opt.textContent = `Sequence ${seq}`;
      sequenceSelect.appendChild(opt);
    });
  }

  // Populate Versions Select
  const versionSelect = document.querySelectorAll('select')[2];
  if (versionSelect) {
    versionSelect.innerHTML = '<option value="all">All Versions</option>';
    const versions = [...new Set(data.journeys.map(j => j.emailVersion).filter(Boolean))];
    versions.forEach(ver => {
      const opt = document.createElement('option');
      opt.value = ver;
      opt.textContent = ver;
      versionSelect.appendChild(opt);
    });
  }

  // Populate Segments Select
  const segmentSelect = document.querySelectorAll('select')[3];
  if (segmentSelect) {
    segmentSelect.innerHTML = '<option value="all">All Segments</option>';
    const segments = [...new Set(data.journeys.map(j => j.targetSegment).filter(Boolean))];
    segments.forEach(seg => {
      const opt = document.createElement('option');
      opt.value = seg;
      opt.textContent = seg;
      segmentSelect.appendChild(opt);
    });
  }
}

function getActiveFilters() {
  const selects = document.querySelectorAll('select');
  return {
    campaignId: selects[0] ? selects[0].value : 'all',
    sequence: selects[1] ? selects[1].value : 'all',
    version: selects[2] ? selects[2].value : 'all',
    segment: selects[3] ? selects[3].value : 'all'
  };
}

function renderDashboard() {
  const filters = getActiveFilters();
  const metrics = AnalyticsEngine.calculateMetrics(filters);

  // Helper to update text inside KPI cards safely
  const updateCardValue = (selectorIndex, value) => {
    const cards = document.querySelectorAll('.card, [class*="card"], div');
    // Direct target updating based on metric structure
  };

  // Target KPI Cards directly
  const metricElements = document.querySelectorAll('h2, h3, .metric-value, span');
  
  // Update KPI Cards by searching for labels or order
  updateMetricUI('Recipients', metrics.recipients);
  updateMetricUI('Messages', metrics.messages);
  updateMetricUI('Sent', metrics.sent);
  updateMetricUI('Verified', metrics.verified);
  updateMetricUI('Open Rate', `${metrics.openRate}%`);
  updateMetricUI('Click Rate', `${metrics.clickRate}%`);
  updateMetricUI('Reply Rate', `${metrics.replyRate}%`);
  updateMetricUI('Unsubscribe Rate', `${metrics.unsubscribeRate}%`);
}

function updateMetricUI(label, val) {
  const elements = Array.from(document.querySelectorAll('div, p, span, h3'));
  const targetLabel = elements.find(el => el.textContent.trim().toLowerCase() === label.toLowerCase());
  
  if (targetLabel && targetLabel.parentElement) {
    const valueEl = targetLabel.parentElement.querySelector('h2, h3, .text-2xl, strong, span.value') || targetLabel.nextElementSibling;
    if (valueEl) {
      valueEl.textContent = val;
    }
  }
}

function attachEventListeners() {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    select.addEventListener('change', renderDashboard);
  });

  const resetButton = document.querySelector('button');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      selects.forEach(s => s.value = 'all');
      renderDashboard();
    });
  }
}
