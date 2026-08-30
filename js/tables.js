/** CAMPAIGN ANALYTICS - TABLE RENDERERS */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function statusBadge(value) {
  const clean = String(value || '').trim();
  const key = clean.toLowerCase();
  let cls = 'badge-neutral';
  if (['valid', 'delivered', 'active', 'completed'].includes(key)) cls = 'badge-success';
  if (['risky', 'pending'].includes(key)) cls = 'badge-warning';
  if (['invalid', 'error', 'bounced', 'cancelled'].includes(key)) cls = 'badge-danger';
  return `<span class="status-badge ${cls}">${escapeHtml(clean || '—')}</span>`;
}

function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="table-empty">${escapeHtml(message)}</td></tr>`;
}

function renderCampaignSummaryTable(rows) {
  const targets = ['campaignSummaryTable', 'campaignSummaryTableSecondary']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;
  const html = !rows.length
    ? emptyRow(8, 'No campaign data for the selected filters.')
    : rows.map(row => `
    <tr>
      <td>${escapeHtml(row.campaignName)}</td>
      <td>${row.recipients}</td>
      <td>${row.sent}</td>
      <td>${row.delivered}</td>
      <td>${row.opened}</td>
      <td>${row.clicked}</td>
      <td>${row.replied}</td>
      <td>${formatPercent(row.openRate)}</td>
    </tr>`).join('');
  targets.forEach(tbody => { tbody.innerHTML = html; });
}

function renderSequenceTable(rows) {
  const tbody = document.getElementById('sequenceSummaryTable');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = emptyRow(7, 'No sequence data for the selected filters.');
    return;
  }
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.sequence)}</td>
      <td>${row.sent}</td>
      <td>${row.delivered}</td>
      <td>${row.opened}</td>
      <td>${row.clicked}</td>
      <td>${row.replied}</td>
      <td>${formatPercent(row.openRate)}</td>
    </tr>`).join('');
}

function renderRecipientTable(rows) {
  const tbody = document.getElementById('recipientTable');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = emptyRow(8, 'No recipients for the selected filters.');
    return;
  }
  tbody.innerHTML = rows.slice(0, 500).map(row => `
    <tr>
      <td>${escapeHtml(row.emailAddress)}</td>
      <td>${escapeHtml(row.campaignName)}</td>
      <td>${statusBadge(row.membershipStatus)}</td>
      <td>${statusBadge(row.preDeliveryCheckStatus)}</td>
      <td>${escapeHtml(row.leadStatus || '—')}</td>
      <td>${row.sent}</td>
      <td>${row.opened ? 'Yes' : 'No'}</td>
      <td>${row.replied ? 'Yes' : 'No'}</td>
    </tr>`).join('');
}
