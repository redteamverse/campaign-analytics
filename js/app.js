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
    attachUserManagementListeners();
    populateUserLeadStatusFilter();
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
  renderUsersManagement();
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

/* ============================================================
   USER MANAGEMENT
============================================================ */
let userManagementAttached = false;
let editingUserId = '';

function formatUserDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function getUserManagementRows() {
  const data = DataEngine.getNormalized();
  const query = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
  const lead = document.getElementById('userLeadStatusFilter')?.value || 'all';
  const subscription = document.getElementById('userSubscriptionFilter')?.value || 'all';

  return data.users
    .filter(user => {
      if (lead !== 'all' && (user.leadStatus || '') !== lead) return false;
      if (subscription === 'subscribed' && user.unsubscribed) return false;
      if (subscription === 'unsubscribed' && !user.unsubscribed) return false;
      if (!query) return true;
      return [
        user.firstName,
        user.emailAddress,
        user.company,
        user.userId,
        user.contactId,
        user.leadStatus
      ].some(value => String(value || '').toLowerCase().includes(query));
    })
    .sort((a, b) => String(a.emailAddress || '').localeCompare(String(b.emailAddress || '')));
}

function populateUserLeadStatusFilter() {
  const select = document.getElementById('userLeadStatusFilter');
  if (!select) return;
  const current = select.value || 'all';
  const values = [...new Set(DataEngine.getNormalized().users.map(user => user.leadStatus).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="all">All lead statuses</option>' +
    values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  select.value = values.includes(current) ? current : 'all';
}

function renderUsersManagement() {
  const tbody = document.getElementById('usersManagementTable');
  if (!tbody) return;

  const allUsers = DataEngine.getNormalized().users;
  const rows = getUserManagementRows();
  setText('usersTotalCount', allUsers.length.toLocaleString());
  setText('usersSubscribedCount', allUsers.filter(user => !user.unsubscribed).length.toLocaleString());
  setText('usersUnsubscribedCount', allUsers.filter(user => user.unsubscribed).length.toLocaleString());
  setText('usersShowingCount', rows.length.toLocaleString());

  if (!rows.length) {
    tbody.innerHTML = emptyRow(9, 'No users match the current search or filters.');
    return;
  }

  tbody.innerHTML = rows.slice(0, 1000).map(user => `
    <tr>
      <td class="user-name-cell"><strong>${escapeHtml(user.firstName || '—')}</strong><small>${escapeHtml(user.company || '')}</small></td>
      <td>${escapeHtml(user.emailAddress)}</td>
      <td>${escapeHtml(user.company || '—')}</td>
      <td>${statusBadge(user.leadStatus || 'New')}</td>
      <td>${user.unsubscribed ? '<span class="status-badge badge-danger">Unsubscribed</span>' : '<span class="status-badge badge-success">Subscribed</span>'}</td>
      <td><span class="muted-id">${escapeHtml(user.userId)}</span></td>
      <td><span class="muted-id">${escapeHtml(user.contactId)}</span></td>
      <td>${escapeHtml(formatUserDate(user.updatedAt || user.createdAt))}</td>
      <td>
        <div class="user-actions">
          <button type="button" class="table-action-button" data-user-edit="${escapeHtml(user.userId)}">Edit</button>
          <button type="button" class="table-action-button ${user.unsubscribed ? 'success' : 'danger'}" data-user-unsubscribe="${escapeHtml(user.userId)}" data-next-state="${user.unsubscribed ? 'N' : 'Y'}">${user.unsubscribed ? 'Resubscribe' : 'Unsubscribe'}</button>
        </div>
      </td>
    </tr>`).join('');
}

function showUsersNotice(message, type = 'success') {
  const notice = document.getElementById('usersActionNotice');
  if (!notice) return;
  notice.hidden = !message;
  notice.className = `dashboard-notice ${type}`;
  notice.textContent = message || '';
}

function openUserModal(userId = '') {
  editingUserId = userId || '';
  const user = editingUserId ? DataEngine.getUserById(editingUserId) : null;
  document.getElementById('userModalTitle').textContent = user ? 'Edit User' : 'Add User';
  document.getElementById('userFormUserId').value = user?.userId || '';
  document.getElementById('userFormFirstName').value = user?.firstName || '';
  document.getElementById('userFormEmail').value = user?.emailAddress || '';
  document.getElementById('userFormEmail').disabled = Boolean(user);
  document.getElementById('userFormCompany').value = user?.company || '';
  document.getElementById('userFormLeadStatus').value = user?.leadStatus || 'New';
  document.getElementById('userFormSubmit').textContent = user ? 'Save Changes' : 'Create User';
  document.getElementById('userFormError').hidden = true;
  document.getElementById('userModalBackdrop').hidden = false;
  setTimeout(() => document.getElementById(user ? 'userFormFirstName' : 'userFormEmail')?.focus(), 0);
}

function closeUserModal() {
  document.getElementById('userModalBackdrop').hidden = true;
  document.getElementById('userForm').reset();
  document.getElementById('userFormEmail').disabled = false;
  document.getElementById('userFormError').hidden = true;
  editingUserId = '';
}

function setUserFormBusy(busy) {
  const submit = document.getElementById('userFormSubmit');
  const cancel = document.getElementById('userFormCancel');
  if (submit) submit.disabled = busy;
  if (cancel) cancel.disabled = busy;
  if (submit) submit.textContent = busy ? 'Saving…' : (editingUserId ? 'Save Changes' : 'Create User');
}

async function submitUserForm(event) {
  event.preventDefault();
  const errorBox = document.getElementById('userFormError');
  errorBox.hidden = true;

  const payload = {
    firstName: document.getElementById('userFormFirstName').value.trim(),
    company: document.getElementById('userFormCompany').value.trim(),
    leadStatus: document.getElementById('userFormLeadStatus').value
  };

  if (!editingUserId) {
    payload.emailAddress = document.getElementById('userFormEmail').value.trim().toLowerCase();
    if (!payload.emailAddress) {
      errorBox.textContent = 'Email Address is required.';
      errorBox.hidden = false;
      return;
    }
  } else {
    payload.userId = editingUserId;
  }

  try {
    setUserFormBusy(true);
    const wasEditing = Boolean(editingUserId);
    const result = wasEditing
      ? await DashboardApi.updateUser(payload)
      : await DashboardApi.createUser(payload);

    closeUserModal();
    showUsersNotice(
      wasEditing
        ? 'User updated successfully.'
        : (result?.result?.message || 'User created successfully.'),
      'success'
    );
    await initDashboard(true);
    switchView('usersView');
  } catch (error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
  } finally {
    setUserFormBusy(false);
  }
}

async function toggleUserSubscription(userId, nextState) {
  const user = DataEngine.getUserById(userId);
  if (!user) return;
  const unsubscribed = nextState === 'Y';
  const action = unsubscribed ? 'unsubscribe' : 'resubscribe';
  if (!window.confirm(`Are you sure you want to ${action} ${user.emailAddress}?`)) return;

  try {
    showUsersNotice(`${unsubscribed ? 'Unsubscribing' : 'Resubscribing'} ${user.emailAddress}…`, 'warning');
    await DashboardApi.setUserUnsubscribed(userId, unsubscribed);
    await initDashboard(true);
    switchView('usersView');
    showUsersNotice(`${user.emailAddress} ${unsubscribed ? 'unsubscribed' : 'resubscribed'} successfully.`, 'success');
  } catch (error) {
    showUsersNotice(error?.message || String(error), 'error');
  }
}

function attachUserManagementListeners() {
  if (userManagementAttached) return;
  userManagementAttached = true;

  document.getElementById('addUserButton')?.addEventListener('click', () => openUserModal());
  document.getElementById('userModalClose')?.addEventListener('click', closeUserModal);
  document.getElementById('userFormCancel')?.addEventListener('click', closeUserModal);
  document.getElementById('userForm')?.addEventListener('submit', submitUserForm);
  document.getElementById('userModalBackdrop')?.addEventListener('click', event => {
    if (event.target.id === 'userModalBackdrop') closeUserModal();
  });
  document.getElementById('userSearchInput')?.addEventListener('input', renderUsersManagement);
  document.getElementById('userLeadStatusFilter')?.addEventListener('change', renderUsersManagement);
  document.getElementById('userSubscriptionFilter')?.addEventListener('change', renderUsersManagement);
  document.getElementById('usersManagementTable')?.addEventListener('click', event => {
    const editButton = event.target.closest('[data-user-edit]');
    if (editButton) {
      openUserModal(editButton.dataset.userEdit);
      return;
    }
    const unsubButton = event.target.closest('[data-user-unsubscribe]');
    if (unsubButton) toggleUserSubscription(unsubButton.dataset.userUnsubscribe, unsubButton.dataset.nextState);
  });
}
