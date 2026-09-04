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
    attachCampaignManagementListeners();
    attachCampaignMemberManagementListeners();
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
  renderCampaignManagement();
  renderCampaignMembers();
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
/* ============================================================
   CAMPAIGN MANAGEMENT
   ============================================================ */

let campaignManagementAttached = false;
let editingCampaignId = '';


function formatCampaignDate(value) {

  if (!value) {
    return '—';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value || '—')
    : date.toLocaleString();
}


function getCampaignById(campaignId) {

  const data =
    DataEngine.getNormalized();

  return data.campaigns.find(
    campaign =>
      String(campaign.campaignId || '') ===
      String(campaignId || '')
  ) || null;
}


function getCampaignManagementRows() {

  const data =
    DataEngine.getNormalized();

  const query =
    (
      document.getElementById(
        'campaignSearchInput'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const status =
    document.getElementById(
      'campaignStatusFilter'
    )?.value || 'all';


  return data.campaigns
    .filter(campaign => {

      const campaignStatus =
        String(
          campaign.campaignStatus ||
          campaign.status ||
          ''
        )
          .trim()
          .toUpperCase();


      if (
        status !== 'all' &&
        campaignStatus !== status
      ) {

        return false;
      }


      if (!query) {
        return true;
      }


      return [
        campaign.campaignName,
        campaign.campaignId,
        campaignStatus
      ].some(
        value =>
          String(value || '')
            .toLowerCase()
            .includes(query)
      );
    })
    .sort(
      (a, b) =>
        String(a.campaignName || '')
          .localeCompare(
            String(b.campaignName || '')
          )
    );
}


function renderCampaignManagement() {

  const tbody =
    document.getElementById(
      'campaignManagementTable'
    );

  if (!tbody) {
    return;
  }


  const allCampaigns =
    DataEngine.getNormalized().campaigns;

  const rows =
    getCampaignManagementRows();


  const campaignStatusOf =
    campaign =>
      String(
        campaign.campaignStatus ||
        campaign.status ||
        ''
      )
        .trim()
        .toUpperCase();


  setText(
    'campaignsTotalCount',
    allCampaigns.length.toLocaleString()
  );

  setText(
    'campaignsActiveCount',
    allCampaigns.filter(
      campaign =>
        campaignStatusOf(campaign) ===
        'ACTIVE'
    ).length.toLocaleString()
  );

  setText(
    'campaignsPausedCount',
    allCampaigns.filter(
      campaign =>
        campaignStatusOf(campaign) ===
        'PAUSED'
    ).length.toLocaleString()
  );

  setText(
    'campaignsCompletedCount',
    allCampaigns.filter(
      campaign =>
        campaignStatusOf(campaign) ===
        'COMPLETED'
    ).length.toLocaleString()
  );

  setText(
    'campaignsShowingCount',
    rows.length.toLocaleString()
  );


  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        8,
        'No campaigns match the current search or filters.'
      );

    return;
  }


  tbody.innerHTML =
    rows
      .slice(0, 1000)
      .map(campaign => {

        const campaignId =
          String(
            campaign.campaignId || ''
          );

        const campaignName =
          String(
            campaign.campaignName ||
            campaignId ||
            '—'
          );

        const campaignStatus =
          String(
            campaign.campaignStatus ||
            campaign.status ||
            'ACTIVE'
          )
            .trim()
            .toUpperCase();

        const totalContacts =
          Number(
            campaign.totalContacts || 0
          );

        const totalEmailEvents =
          Number(
            campaign.totalEmailEvents || 0
          );


        return `
          <tr>

            <td class="user-name-cell">
              <strong>
                ${escapeHtml(campaignName)}
              </strong>
              <small>
                ${escapeHtml(campaignId)}
              </small>
            </td>

            <td>
              ${statusBadge(campaignStatus)}
            </td>

            <td>
              ${totalContacts.toLocaleString()}
            </td>

            <td>
              ${totalEmailEvents.toLocaleString()}
            </td>

            <td>
              ${escapeHtml(
                formatCampaignDate(
                  campaign.createdAt
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                formatCampaignDate(
                  campaign.updatedAt
                )
              )}
            </td>

            <td>
              <span class="muted-id">
                ${escapeHtml(campaignId)}
              </span>
            </td>

            <td>

              <div class="user-actions">

                <button
                  type="button"
                  class="table-action-button"
                  data-campaign-edit="${escapeHtml(campaignId)}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="table-action-button"
                  data-campaign-open="${escapeHtml(campaignId)}"
                >
                  Open
                </button>

              </div>

            </td>

          </tr>
        `;
      })
      .join('');
}


function showCampaignsNotice(
  message,
  type = 'success'
) {

  const notice =
    document.getElementById(
      'campaignsActionNotice'
    );

  if (!notice) {
    return;
  }


  notice.hidden =
    !message;

  notice.className =
    `dashboard-notice ${type}`;

  notice.textContent =
    message || '';
}


function openCampaignModal(
  campaignId = ''
) {

  editingCampaignId =
    campaignId || '';


  const campaign =
    editingCampaignId
      ? getCampaignById(
          editingCampaignId
        )
      : null;


  const title =
    document.getElementById(
      'campaignModalTitle'
    );

  const idInput =
    document.getElementById(
      'campaignFormCampaignId'
    );

  const nameInput =
    document.getElementById(
      'campaignFormName'
    );

  const statusSelect =
    document.getElementById(
      'campaignFormStatus'
    );

  const submit =
    document.getElementById(
      'campaignFormSubmit'
    );

  const errorBox =
    document.getElementById(
      'campaignFormError'
    );

  const backdrop =
    document.getElementById(
      'campaignModalBackdrop'
    );


  if (
    !title ||
    !idInput ||
    !nameInput ||
    !statusSelect ||
    !submit ||
    !errorBox ||
    !backdrop
  ) {

    console.warn(
      'Campaign management modal elements were not found.'
    );

    return;
  }


  title.textContent =
    campaign
      ? 'Edit Campaign'
      : 'Add Campaign';


  idInput.value =
    campaign?.campaignId || '';


  nameInput.value =
    campaign?.campaignName || '';


  statusSelect.value =
    String(
      campaign?.campaignStatus ||
      campaign?.status ||
      'ACTIVE'
    )
      .trim()
      .toUpperCase();


  submit.textContent =
    campaign
      ? 'Save Changes'
      : 'Create Campaign';


  errorBox.hidden =
    true;

  errorBox.textContent =
    '';


  backdrop.hidden =
    false;


  setTimeout(
    () =>
      nameInput.focus(),
    0
  );
}


function closeCampaignModal() {

  const backdrop =
    document.getElementById(
      'campaignModalBackdrop'
    );

  const form =
    document.getElementById(
      'campaignForm'
    );

  const errorBox =
    document.getElementById(
      'campaignFormError'
    );


  if (backdrop) {
    backdrop.hidden = true;
  }

  if (form) {
    form.reset();
  }

  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }


  editingCampaignId =
    '';
}


function setCampaignFormBusy(
  busy
) {

  const submit =
    document.getElementById(
      'campaignFormSubmit'
    );

  const cancel =
    document.getElementById(
      'campaignFormCancel'
    );


  if (submit) {

    submit.disabled =
      busy;

    submit.textContent =
      busy
        ? 'Saving…'
        : (
            editingCampaignId
              ? 'Save Changes'
              : 'Create Campaign'
          );
  }


  if (cancel) {

    cancel.disabled =
      busy;
  }
}


async function submitCampaignForm(
  event
) {

  event.preventDefault();


  const errorBox =
    document.getElementById(
      'campaignFormError'
    );

  const nameInput =
    document.getElementById(
      'campaignFormName'
    );

  const statusSelect =
    document.getElementById(
      'campaignFormStatus'
    );


  if (
    !errorBox ||
    !nameInput ||
    !statusSelect
  ) {

    return;
  }


  errorBox.hidden =
    true;

  errorBox.textContent =
    '';


  const payload = {

    campaignName:
      nameInput.value.trim(),

    campaignStatus:
      statusSelect.value

  };


  if (
    !payload.campaignName
  ) {

    errorBox.textContent =
      'Campaign Name is required.';

    errorBox.hidden =
      false;

    return;
  }


  const wasEditing =
    Boolean(
      editingCampaignId
    );


  if (
    wasEditing
  ) {

    payload.campaignId =
      editingCampaignId;
  }


  try {

    setCampaignFormBusy(
      true
    );


    const result =
      wasEditing
        ? await DashboardApi.updateCampaign(
            payload
          )
        : await DashboardApi.createCampaign(
            payload
          );


    closeCampaignModal();


    showCampaignsNotice(
      wasEditing
        ? (
            result?.result?.message ||
            'Campaign updated successfully.'
          )
        : (
            result?.result?.message ||
            'Campaign created successfully.'
          ),
      'success'
    );


    await initDashboard(
      true
    );


    switchView(
      'campaignsView'
    );


    showCampaignsNotice(
      wasEditing
        ? 'Campaign updated successfully.'
        : (
            result?.result?.message ||
            'Campaign created successfully.'
          ),
      'success'
    );


  } catch (error) {

    errorBox.textContent =
      error?.message ||
      String(error);

    errorBox.hidden =
      false;

  } finally {

    setCampaignFormBusy(
      false
    );
  }
}


function openCampaign(
  campaignId
) {

  const campaign =
    getCampaignById(
      campaignId
    );


  if (!campaign) {

    showCampaignsNotice(
      'Campaign could not be found.',
      'error'
    );

    return;
  }


  selectedCampaignMembersCampaignId =
    campaignId;


  const selectedInput =
    document.getElementById(
      'campaignMembersSelectedCampaignId'
    );


  if (selectedInput) {

    selectedInput.value =
      campaignId;
  }


  const panel =
    document.getElementById(
      'campaignMembersPanel'
    );


  if (panel) {

    panel.hidden =
      false;
  }


  switchView(
    'campaignsView'
  );


  renderCampaignMembers();


  setTimeout(
    function () {

      panel?.scrollIntoView({
        behavior:
          'smooth',

        block:
          'start'
      });
    },
    0
  );
}

function showDashboardCampaignSelectionNotice(
  campaign
) {

  const notice =
    document.getElementById(
      'dashboardNotice'
    );


  if (!notice) {
    return;
  }


  notice.hidden =
    false;

  notice.className =
    'dashboard-notice success';

  notice.textContent =
    `Showing analytics for campaign: ${campaign.campaignName || campaign.campaignId}`;
}


function attachCampaignManagementListeners() {

  if (
    campaignManagementAttached
  ) {

    return;
  }


  campaignManagementAttached =
    true;


  document.getElementById(
    'addCampaignButton'
  )?.addEventListener(
    'click',
    () =>
      openCampaignModal()
  );


  document.getElementById(
    'campaignModalClose'
  )?.addEventListener(
    'click',
    closeCampaignModal
  );


  document.getElementById(
    'campaignFormCancel'
  )?.addEventListener(
    'click',
    closeCampaignModal
  );


  document.getElementById(
    'campaignForm'
  )?.addEventListener(
    'submit',
    submitCampaignForm
  );


  document.getElementById(
    'campaignModalBackdrop'
  )?.addEventListener(
    'click',
    event => {

      if (
        event.target.id ===
        'campaignModalBackdrop'
      ) {

        closeCampaignModal();
      }
    }
  );


  document.getElementById(
    'campaignSearchInput'
  )?.addEventListener(
    'input',
    renderCampaignManagement
  );


  document.getElementById(
    'campaignStatusFilter'
  )?.addEventListener(
    'change',
    renderCampaignManagement
  );


  document.getElementById(
    'campaignManagementTable'
  )?.addEventListener(
    'click',
    event => {

      const editButton =
        event.target.closest(
          '[data-campaign-edit]'
        );


      if (
        editButton
      ) {

        openCampaignModal(
          editButton.dataset.campaignEdit
        );

        return;
      }


      const openButton =
        event.target.closest(
          '[data-campaign-open]'
        );


      if (
        openButton
      ) {

        openCampaign(
          openButton.dataset.campaignOpen
        );
      }
    }
  );
}



/* ============================================================
   CAMPAIGN MEMBER MANAGEMENT
   ============================================================ */

let campaignMemberManagementAttached = false;
let selectedCampaignMembersCampaignId = '';


function getSelectedCampaignForMembers() {

  if (
    !selectedCampaignMembersCampaignId
  ) {

    return null;
  }


  return getCampaignById(
    selectedCampaignMembersCampaignId
  );
}


function getCampaignMembersForSelectedCampaign() {

  if (
    !selectedCampaignMembersCampaignId
  ) {

    return [];
  }


  const data =
    DataEngine.getNormalized();


  return data.campaignMembers.filter(
    member =>
      String(
        member.campaignId || ''
      ) ===
      String(
        selectedCampaignMembersCampaignId
      )
  );
}


function getCampaignMemberStatus(
  member
) {

  return String(
    member.membershipStatus ||
    member.status ||
    'ACTIVE'
  )
    .trim()
    .toUpperCase();
}


function getCampaignMemberUser(
  member
) {

  const data =
    DataEngine.getNormalized();


  return data.users.find(
    user =>
      String(
        user.userId || ''
      ) ===
      String(
        member.userId || ''
      )
  ) || null;
}


function getFilteredCampaignMembers() {

  const query =
    (
      document.getElementById(
        'campaignMemberSearchInput'
      )?.value || ''
    )
      .trim()
      .toLowerCase();


  const status =
    document.getElementById(
      'campaignMemberStatusFilter'
    )?.value || 'all';


  return getCampaignMembersForSelectedCampaign()
    .filter(
      member => {

        const memberStatus =
          getCampaignMemberStatus(
            member
          );


        if (
          status !== 'all' &&
          memberStatus !== status
        ) {

          return false;
        }


        if (!query) {

          return true;
        }


        const user =
          getCampaignMemberUser(
            member
          );


        return [
          user?.firstName,
          user?.emailAddress,
          user?.company,
          member.emailAddress,
          member.campaignMemberId,
          member.userId,
          member.contactId
        ].some(
          value =>
            String(
              value || ''
            )
              .toLowerCase()
              .includes(
                query
              )
        );
      }
    )
    .sort(
      (a, b) => {

        const userA =
          getCampaignMemberUser(a);

        const userB =
          getCampaignMemberUser(b);

        const nameA =
          userA?.firstName ||
          a.emailAddress ||
          a.userId ||
          '';

        const nameB =
          userB?.firstName ||
          b.emailAddress ||
          b.userId ||
          '';

        return String(nameA)
          .localeCompare(
            String(nameB)
          );
      }
    );
}


function renderCampaignMembers() {

  const panel =
    document.getElementById(
      'campaignMembersPanel'
    );


  if (!panel) {

    return;
  }


  const campaign =
    getSelectedCampaignForMembers();


  if (!campaign) {

    panel.hidden =
      true;

    return;
  }


  panel.hidden =
    false;


  setText(
    'campaignMembersCampaignName',
    campaign.campaignName ||
    campaign.campaignId ||
    'Selected Campaign'
  );


  const meta =
    document.getElementById(
      'campaignMembersCampaignMeta'
    );


  if (meta) {

    meta.textContent =
      `${campaign.campaignId} · ${String(
        campaign.campaignStatus ||
        campaign.status ||
        ''
      ).toUpperCase()}`;
  }


  const allMembers =
    getCampaignMembersForSelectedCampaign();


  const rows =
    getFilteredCampaignMembers();


  setText(
    'campaignMembersTotalCount',
    allMembers.length.toLocaleString()
  );


  setText(
    'campaignMembersActiveCount',
    allMembers.filter(
      member =>
        getCampaignMemberStatus(
          member
        ) ===
        'ACTIVE'
    ).length.toLocaleString()
  );


  setText(
    'campaignMembersInactiveCount',
    allMembers.filter(
      member =>
        getCampaignMemberStatus(
          member
        ) ===
        'INACTIVE'
    ).length.toLocaleString()
  );


  setText(
    'campaignMembersShowingCount',
    rows.length.toLocaleString()
  );


  const tbody =
    document.getElementById(
      'campaignMembersTable'
    );


  if (!tbody) {

    return;
  }


  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        9,
        'No campaign members match the current search or filters.'
      );

    return;
  }


  tbody.innerHTML =
    rows
      .slice(
        0,
        1000
      )
      .map(
        member => {

          const user =
            getCampaignMemberUser(
              member
            );


          const memberStatus =
            getCampaignMemberStatus(
              member
            );


          const firstName =
            user?.firstName ||
            '—';


          const emailAddress =
            user?.emailAddress ||
            member.emailAddress ||
            '—';


          const company =
            user?.company ||
            '';


          const nextStatus =
            memberStatus ===
            'ACTIVE'
              ? 'INACTIVE'
              : 'ACTIVE';


          const actionLabel =
            memberStatus ===
            'ACTIVE'
              ? 'Deactivate'
              : 'Activate';


          return `
            <tr>

              <td class="user-name-cell">

                <strong>
                  ${escapeHtml(firstName)}
                </strong>

                <small>
                  ${escapeHtml(company)}
                </small>

              </td>

              <td>
                ${escapeHtml(emailAddress)}
              </td>

              <td>
                ${statusBadge(memberStatus)}
              </td>

              <td>
                <span class="muted-id">
                  ${escapeHtml(member.campaignMemberId || '')}
                </span>
              </td>

              <td>
                <span class="muted-id">
                  ${escapeHtml(member.userId || '')}
                </span>
              </td>

              <td>
                <span class="muted-id">
                  ${escapeHtml(member.contactId || '')}
                </span>
              </td>

              <td>
                ${escapeHtml(
                  formatCampaignDate(
                    member.createdAt
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  formatCampaignDate(
                    member.updatedAt
                  )
                )}
              </td>

              <td>

                <div class="user-actions">

                  <button
                    type="button"
                    class="table-action-button ${memberStatus === 'ACTIVE' ? 'danger' : 'success'}"
                    data-campaign-member-status="${escapeHtml(member.campaignMemberId || '')}"
                    data-next-member-status="${nextStatus}"
                  >
                    ${actionLabel}
                  </button>

                </div>

              </td>

            </tr>
          `;
        }
      )
      .join('');
}


function showCampaignMembersNotice(
  message,
  type = 'success'
) {

  const notice =
    document.getElementById(
      'campaignMembersActionNotice'
    );


  if (!notice) {

    return;
  }


  notice.hidden =
    !message;


  notice.className =
    `dashboard-notice ${type}`;


  notice.textContent =
    message || '';
}


function populateCampaignMemberUserOptions() {

  const select =
    document.getElementById(
      'campaignMemberFormUserId'
    );


  if (!select) {

    return;
  }


  const data =
    DataEngine.getNormalized();


  const memberships =
    getCampaignMembersForSelectedCampaign();


  const activeUserIds =
    new Set(
      memberships
        .filter(
          member =>
            getCampaignMemberStatus(
              member
            ) ===
            'ACTIVE'
        )
        .map(
          member =>
            String(
              member.userId || ''
            )
        )
    );


  const inactiveUserIds =
    new Set(
      memberships
        .filter(
          member =>
            getCampaignMemberStatus(
              member
            ) ===
            'INACTIVE'
        )
        .map(
          member =>
            String(
              member.userId || ''
            )
        )
    );


  const options =
    data.users
      .filter(
        user =>
          user.userId &&
          !activeUserIds.has(
            String(
              user.userId
            )
          )
      )
      .sort(
        (a, b) =>
          String(
            a.emailAddress ||
            a.firstName ||
            ''
          ).localeCompare(
            String(
              b.emailAddress ||
              b.firstName ||
              ''
            )
          )
      );


  select.innerHTML =
    '<option value="">Select a user</option>' +
    options
      .map(
        user => {

          const reactivationLabel =
            inactiveUserIds.has(
              String(
                user.userId
              )
            )
              ? ' — Reactivate'
              : '';


          const label =
            [
              user.firstName,
              user.emailAddress,
              user.company
            ]
              .filter(Boolean)
              .join(
                ' · '
              ) +
            reactivationLabel;


          return `
            <option value="${escapeHtml(user.userId)}">
              ${escapeHtml(label)}
            </option>
          `;
        }
      )
      .join('');
}


function updateCampaignMemberUserDetails() {

  const select =
    document.getElementById(
      'campaignMemberFormUserId'
    );


  const details =
    document.getElementById(
      'campaignMemberFormUserDetails'
    );


  if (
    !select ||
    !details
  ) {

    return;
  }


  const userId =
    select.value;


  if (!userId) {

    details.hidden =
      true;

    details.textContent =
      '';

    return;
  }


  const user =
    DataEngine.getNormalized().users.find(
      item =>
        String(
          item.userId || ''
        ) ===
        String(
          userId
        )
    );


  if (!user) {

    details.hidden =
      true;

    return;
  }


  details.hidden =
    false;


  details.textContent =
    [
      user.emailAddress,
      user.company,
      user.contactId
    ]
      .filter(Boolean)
      .join(
        ' · '
      );
}


function openCampaignMemberModal() {

  const campaign =
    getSelectedCampaignForMembers();


  if (!campaign) {

    showCampaignMembersNotice(
      'Select a campaign first.',
      'error'
    );

    return;
  }


  const status =
    String(
      campaign.campaignStatus ||
      campaign.status ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    status !==
    'ACTIVE'
  ) {

    showCampaignMembersNotice(
      'Members can only be added or reactivated while the campaign is ACTIVE.',
      'error'
    );

    return;
  }


  const campaignIdInput =
    document.getElementById(
      'campaignMemberFormCampaignId'
    );


  const campaignNameInput =
    document.getElementById(
      'campaignMemberFormCampaignName'
    );


  const errorBox =
    document.getElementById(
      'campaignMemberFormError'
    );


  const backdrop =
    document.getElementById(
      'campaignMemberModalBackdrop'
    );


  if (
    !campaignIdInput ||
    !campaignNameInput ||
    !errorBox ||
    !backdrop
  ) {

    console.warn(
      'Campaign Member modal elements were not found.'
    );

    return;
  }


  campaignIdInput.value =
    campaign.campaignId || '';


  campaignNameInput.value =
    campaign.campaignName || '';


  errorBox.hidden =
    true;


  errorBox.textContent =
    '';


  populateCampaignMemberUserOptions();


  updateCampaignMemberUserDetails();


  backdrop.hidden =
    false;


  setTimeout(
    () =>
      document.getElementById(
        'campaignMemberFormUserId'
      )?.focus(),
    0
  );
}


function closeCampaignMemberModal() {

  const backdrop =
    document.getElementById(
      'campaignMemberModalBackdrop'
    );


  const form =
    document.getElementById(
      'campaignMemberForm'
    );


  const errorBox =
    document.getElementById(
      'campaignMemberFormError'
    );


  const details =
    document.getElementById(
      'campaignMemberFormUserDetails'
    );


  if (backdrop) {

    backdrop.hidden =
      true;
  }


  if (form) {

    form.reset();
  }


  if (errorBox) {

    errorBox.hidden =
      true;

    errorBox.textContent =
      '';
  }


  if (details) {

    details.hidden =
      true;

    details.textContent =
      '';
  }
}


function setCampaignMemberFormBusy(
  busy
) {

  const submit =
    document.getElementById(
      'campaignMemberFormSubmit'
    );


  const cancel =
    document.getElementById(
      'campaignMemberFormCancel'
    );


  if (submit) {

    submit.disabled =
      busy;


    submit.textContent =
      busy
        ? 'Adding…'
        : 'Add Member';
  }


  if (cancel) {

    cancel.disabled =
      busy;
  }
}


async function submitCampaignMemberForm(
  event
) {

  event.preventDefault();


  const errorBox =
    document.getElementById(
      'campaignMemberFormError'
    );


  const campaignId =
    document.getElementById(
      'campaignMemberFormCampaignId'
    )?.value || '';


  const userId =
    document.getElementById(
      'campaignMemberFormUserId'
    )?.value || '';


  if (!errorBox) {

    return;
  }


  errorBox.hidden =
    true;


  errorBox.textContent =
    '';


  if (
    !campaignId ||
    !userId
  ) {

    errorBox.textContent =
      'Campaign and User are required.';

    errorBox.hidden =
      false;

    return;
  }


  try {

    setCampaignMemberFormBusy(
      true
    );


    const result =
      await DashboardApi.addCampaignMember({
        campaignId,
        userId
      });


    closeCampaignMemberModal();


    await initDashboard(
      true
    );


    selectedCampaignMembersCampaignId =
      campaignId;


    switchView(
      'campaignsView'
    );


    renderCampaignMembers();


    showCampaignMembersNotice(
      result?.result?.message ||
      'Campaign member added successfully.',
      'success'
    );


  } catch (error) {

    errorBox.textContent =
      error?.message ||
      String(error);


    errorBox.hidden =
      false;

  } finally {

    setCampaignMemberFormBusy(
      false
    );
  }
}


async function setCampaignMemberStatus(
  campaignMemberId,
  nextStatus
) {

  const memberships =
    getCampaignMembersForSelectedCampaign();


  const member =
    memberships.find(
      item =>
        String(
          item.campaignMemberId || ''
        ) ===
        String(
          campaignMemberId || ''
        )
    );


  if (!member) {

    showCampaignMembersNotice(
      'Campaign Member could not be found.',
      'error'
    );

    return;
  }


  const actionLabel =
    nextStatus ===
    'ACTIVE'
      ? 'activate'
      : 'deactivate';


  const user =
    getCampaignMemberUser(
      member
    );


  const identity =
    user?.emailAddress ||
    member.emailAddress ||
    campaignMemberId;


  if (
    !window.confirm(
      `Are you sure you want to ${actionLabel} ${identity}?`
    )
  ) {

    return;
  }


  try {

    showCampaignMembersNotice(
      `${nextStatus === 'ACTIVE' ? 'Activating' : 'Deactivating'} ${identity}…`,
      'warning'
    );


    await DashboardApi.setCampaignMemberStatus(
      campaignMemberId,
      nextStatus
    );


    const campaignId =
      selectedCampaignMembersCampaignId;


    await initDashboard(
      true
    );


    selectedCampaignMembersCampaignId =
      campaignId;


    switchView(
      'campaignsView'
    );


    renderCampaignMembers();


    showCampaignMembersNotice(
      `${identity} ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`,
      'success'
    );


  } catch (error) {

    showCampaignMembersNotice(
      error?.message ||
      String(error),
      'error'
    );
  }
}


function closeCampaignMembersPanel() {

  selectedCampaignMembersCampaignId =
    '';


  const panel =
    document.getElementById(
      'campaignMembersPanel'
    );


  if (panel) {

    panel.hidden =
      true;
  }


  const selectedInput =
    document.getElementById(
      'campaignMembersSelectedCampaignId'
    );


  if (selectedInput) {

    selectedInput.value =
      '';
  }


  const search =
    document.getElementById(
      'campaignMemberSearchInput'
    );


  if (search) {

    search.value =
      '';
  }


  const status =
    document.getElementById(
      'campaignMemberStatusFilter'
    );


  if (status) {

    status.value =
      'all';
  }
}


function attachCampaignMemberManagementListeners() {

  if (
    campaignMemberManagementAttached
  ) {

    return;
  }


  campaignMemberManagementAttached =
    true;


  document.getElementById(
    'addCampaignMemberButton'
  )?.addEventListener(
    'click',
    openCampaignMemberModal
  );


  document.getElementById(
    'closeCampaignMembersButton'
  )?.addEventListener(
    'click',
    closeCampaignMembersPanel
  );


  document.getElementById(
    'campaignMemberSearchInput'
  )?.addEventListener(
    'input',
    renderCampaignMembers
  );


  document.getElementById(
    'campaignMemberStatusFilter'
  )?.addEventListener(
    'change',
    renderCampaignMembers
  );


  document.getElementById(
    'campaignMemberModalClose'
  )?.addEventListener(
    'click',
    closeCampaignMemberModal
  );


  document.getElementById(
    'campaignMemberFormCancel'
  )?.addEventListener(
    'click',
    closeCampaignMemberModal
  );


  document.getElementById(
    'campaignMemberModalBackdrop'
  )?.addEventListener(
    'click',
    event => {

      if (
        event.target.id ===
        'campaignMemberModalBackdrop'
      ) {

        closeCampaignMemberModal();
      }
    }
  );


  document.getElementById(
    'campaignMemberFormUserId'
  )?.addEventListener(
    'change',
    updateCampaignMemberUserDetails
  );


  document.getElementById(
    'campaignMemberForm'
  )?.addEventListener(
    'submit',
    submitCampaignMemberForm
  );


  document.getElementById(
    'campaignMembersTable'
  )?.addEventListener(
    'click',
    event => {

      const statusButton =
        event.target.closest(
          '[data-campaign-member-status]'
        );


      if (!statusButton) {

        return;
      }


      setCampaignMemberStatus(
        statusButton.dataset.campaignMemberStatus,
        statusButton.dataset.nextMemberStatus
      );
    }
  );
}


/* ============================================================
   ADMIN AUTHENTICATION UI
   ============================================================ */

(function initializeAdminAuthentication() {

  document.addEventListener('DOMContentLoaded', function () {

    const overlay =
      document.getElementById(
        'adminAuthOverlay'
      );

    const loginForm =
      document.getElementById(
        'adminLoginForm'
      );

    const usernameInput =
      document.getElementById(
        'adminUsername'
      );

    const passwordInput =
      document.getElementById(
        'adminPassword'
      );

    const loginButton =
      document.getElementById(
        'adminLoginButton'
      );

    const loginError =
      document.getElementById(
        'adminLoginError'
      );

    const logoutButton =
      document.getElementById(
        'adminLogoutButton'
      );


    // ----------------------------------------------------------
    // SAFETY CHECK
    // ----------------------------------------------------------

    if (
      !overlay ||
      !loginForm ||
      !usernameInput ||
      !passwordInput ||
      !loginButton ||
      !loginError ||
      !logoutButton
    ) {

      console.warn(
        'Admin authentication UI elements were not found.'
      );

      return;
    }


    // ----------------------------------------------------------
    // UI HELPERS
    // ----------------------------------------------------------

    function showLogin() {

      overlay.style.display =
        'flex';

      logoutButton.style.display =
        'none';

      loginError.style.display =
        'none';

      loginError.textContent =
        '';

      passwordInput.value =
        '';

      setTimeout(
        function () {
          usernameInput.focus();
        },
        50
      );
    }


    function hideLogin() {

      overlay.style.display =
        'none';

      logoutButton.style.display =
        'inline-flex';

      loginError.style.display =
        'none';

      loginError.textContent =
        '';
    }


    function showLoginError(
      message
    ) {

      loginError.textContent =
        message ||
        'Login failed.';

      loginError.style.display =
        'block';
    }


    function setLoginLoading(
      loading
    ) {

      loginButton.disabled =
        loading;

      usernameInput.disabled =
        loading;

      passwordInput.disabled =
        loading;

      loginButton.textContent =
        loading
          ? 'Signing In...'
          : 'Sign In';
    }


    // ----------------------------------------------------------
    // INITIAL SESSION CHECK
    // ----------------------------------------------------------

    if (
      DashboardApi.isAuthenticated()
    ) {

      hideLogin();

    } else {

      showLogin();
    }


    // ----------------------------------------------------------
    // LOGIN
    // ----------------------------------------------------------

    loginForm.addEventListener(
      'submit',
      async function (event) {

        event.preventDefault();


        const username =
          usernameInput.value.trim();

        const password =
          passwordInput.value;


        if (
          !username ||
          !password
        ) {

          showLoginError(
            'Username and password are required.'
          );

          return;
        }


        setLoginLoading(
          true
        );


        loginError.style.display =
          'none';


        try {

          const result =
            await DashboardApi.login(
              username,
              password
            );


          if (
            !result ||
            result.success !== true
          ) {

            throw new Error(
              'Login failed.'
            );
          }


          passwordInput.value =
            '';


          hideLogin();


          console.log(
            'Admin authenticated successfully.'
          );


        } catch (error) {

          DashboardApi.logout();


          showLoginError(
            error &&
            error.message
              ? error.message
              : 'Unable to sign in.'
          );

        } finally {

          setLoginLoading(
            false
          );
        }
      }
    );


    // ----------------------------------------------------------
    // LOGOUT
    // ----------------------------------------------------------

    logoutButton.addEventListener(
      'click',
      function () {

        DashboardApi.logout();

        showLogin();
      }
    );


    // ----------------------------------------------------------
    // GLOBAL AUTH FAILURE HANDLER
    // ----------------------------------------------------------

    window.addEventListener(
      'admin-auth-required',
      function () {

        DashboardApi.logout();

        showLogin();
      }
    );

  });

})();
