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
    const rawStore = await DataSource.loadData(true);
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
  const selects = document.querySelectorAll('select');

  // Populate Campaign Select (Dropdown 0)
  if (selects[0]) {
    selects[0].innerHTML = '<option value="all">All Campaigns</option>';
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
      selects[0].appendChild(opt);
    });
  }

  // Populate Sequence Select (Dropdown 1)
  if (selects[1]) {
    selects[1].innerHTML = '<option value="all">All Sequences</option>';
    const sequences = [...new Set(data.journeys.map(j => j.sequence).filter(Boolean))];
    sequences.forEach(seq => {
      const opt = document.createElement('option');
      opt.value = seq;
      opt.textContent = `Sequence ${seq}`;
      selects[1].appendChild(opt);
    });
  }

  // Populate Version Select (Dropdown 2)
  if (selects[2]) {
    selects[2].innerHTML = '<option value="all">All Versions</option>';
    const versions = [...new Set(data.journeys.map(j => j.emailVersion).filter(Boolean))];
    versions.forEach(ver => {
      const opt = document.createElement('option');
      opt.value = ver;
      opt.textContent = ver;
      selects[2].appendChild(opt);
    });
  }

  // Populate Segment Select (Dropdown 3)
  if (selects[3]) {
    selects[3].innerHTML = '<option value="all">All Segments</option>';
    const segments = [...new Set(data.journeys.map(j => j.targetSegment).filter(Boolean))];
    segments.forEach(seg => {
      const opt = document.createElement('option');
      opt.value = seg;
      opt.textContent = seg;
      selects[3].appendChild(opt);
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
  const allElements = Array.from(document.querySelectorAll('div, p, span, h3, h4'));
  const labelEl = allElements.find(el => {
    const text = el.childNodes.length > 0 ? el.childNodes[0].textContent : el.textContent;
    return text.trim().toLowerCase() === label.toLowerCase();
  });

  if (labelEl) {
    const container = labelEl.closest('div');
    if (container) {
      const targetVal = container.querySelector('h2, h3, .text-2xl, strong, span') || labelEl.nextElementSibling;
      if (targetVal && targetVal !== labelEl) {
        targetVal.textContent = val;
      }
    }
  }
}

function attachEventListeners() {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    select.addEventListener('change', renderDashboard);
  });

  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => {
    if (btn.textContent.toLowerCase().includes('reset')) {
      btn.addEventListener('click', () => {
        selects.forEach(s => s.value = 'all');
        renderDashboard();
      });
    } else if (btn.textContent.toLowerCase().includes('refresh')) {
      btn.addEventListener('click', async () => {
        await initDashboard();
      });
    }
  });
}
