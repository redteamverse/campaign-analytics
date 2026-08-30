/** CAMPAIGN ANALYTICS - CHART RENDERERS */
let engagementFunnelChart = null;
let sendingTrendChart = null;

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function renderEngagementFunnel(metrics) {
  const canvas = document.getElementById('engagementFunnelChart');
  if (!canvas || typeof Chart === 'undefined') return;

  destroyChart(engagementFunnelChart);
  engagementFunnelChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Sent', 'Delivered', 'Opened', 'Clicked', 'Replied'],
      datasets: [{
        label: 'Messages',
        data: [metrics.sent, metrics.delivered, metrics.opened, metrics.clicked, metrics.replied],
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderSendingTrend(events) {
  const canvas = document.getElementById('sendingTrendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const counts = new Map();
  (events || []).filter(MetricsEngine.isSent).forEach(event => {
    const key = dateKey(event.sentTimestamp);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });

  const labels = Array.from(counts.keys()).sort();
  const values = labels.map(label => counts.get(label));

  destroyChart(sendingTrendChart);
  sendingTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Sent',
        data: values,
        tension: 0.25,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function renderCharts(overview) {
  renderEngagementFunnel(overview.metrics);
  renderSendingTrend(overview.events);
}
