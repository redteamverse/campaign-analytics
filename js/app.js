/** CAMPAIGN ANALYTICS - UI CONTROLLER */
document.addEventListener('DOMContentLoaded', initDashboard);

const FILTER_IDS = ['campaignFilter', 'sequenceFilter', 'versionFilter', 'segmentFilter'];
let listenersAttached = false;
let activeUserModuleTab = 'all';
let activeCampaignModuleTab = 'all';

let contactAudienceState = {
  loaded: false,
  loading: false,
  lists: [],
  listMembers: [],
  segments: [],
  selectedListId: ''
};

let parsedContactImportRows = [];
let contactAudienceListenersAttached = false;

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
  attachCampaignBuilderListeners();
  attachCampaignComposeListeners();
    attachCampaignMemberManagementListeners();
    attachContactAudienceListeners();
    attachModuleTabListeners();
    populateUserLeadStatusFilter();
    populateModuleCampaignSelectors();
    renderDashboard();
    updateLastUpdated(rawStore.lastUpdated);

    const warning = rawStore.sourceWarnings && rawStore.sourceWarnings[0];
    const banner = document.getElementById('dashboardNotice');
    if (banner) {
      banner.hidden = !warning;
      banner.className = 'dashboard-notice warning';
      banner.textContent = warning || '';
    }
    switchUserModuleTab(activeUserModuleTab);
    switchCampaignModuleTab(activeCampaignModuleTab);
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
  renderUsersByCampaign();
  renderSubscriptionManagement();
  renderCampaignManagement();
  renderCampaignMembers();
  renderPrecheckManagement();
}

function resetFilters() {
  FILTER_IDS.forEach(id => {
    const select = document.getElementById(id);
    if (select) select.value = 'all';
  });
  renderDashboard();
}

function switchView(viewId) {

  document.querySelectorAll('.view').forEach(
    view =>
      view.classList.toggle(
        'active',
        view.id === viewId
      )
  );

  document.querySelectorAll('.nav-item').forEach(
    item =>
      item.classList.toggle(
        'active',
        item.dataset.view === viewId
      )
  );

  const globalFilters =
    document.getElementById(
      'globalAnalyticsFilters'
    );

  if (globalFilters) {
    globalFilters.hidden =
      viewId !== 'overviewView';
  }

  const pageMap = {
    overviewView: {
      title: 'Overview',
      subtitle: 'Campaign delivery and engagement at a glance'
    },
    usersView: {
      title: 'Contacts',
      subtitle: 'Manage contacts, campaign membership and subscription status'
    },
    campaignsView: {
      title: 'Campaigns',
      subtitle: 'Manage campaign setup, members, verification and performance'
    }
  };

  const page =
    pageMap[viewId] ||
    pageMap.overviewView;

  setText(
    'pageTitle',
    page.title
  );

  setText(
    'pageSubtitle',
    page.subtitle
  );

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
  return data.users
    .filter(user => {
      if (lead !== 'all' && (user.leadStatus || '') !== lead) return false;
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

  const data = DataEngine.getNormalized();
  const allUsers = data.users;
  const rows = getUserManagementRows();

  setText('usersTotalCount', allUsers.length.toLocaleString());
  setText('usersSubscribedCount', allUsers.filter(user => !user.unsubscribed).length.toLocaleString());
  setText('usersUnsubscribedCount', allUsers.filter(user => user.unsubscribed).length.toLocaleString());
  setText('usersShowingCount', rows.length.toLocaleString());

  const showingWrap =
    document.getElementById(
      'contactsShowingWrap'
    );

  if (showingWrap) {
    showingWrap.hidden =
      rows.length ===
      allUsers.length;
  }

  if (!rows.length) {
    tbody.innerHTML = emptyRow(7, 'No contacts match the current search or filters.');
    return;
  }

  tbody.innerHTML = rows.slice(0, 1000).map(user => {
    const campaignCount = data.campaignMembers.filter(
      member => String(member.userId || '') === String(user.userId || '') &&
        String(member.membershipStatus || member.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    ).length;

    const userId = escapeHtml(user.userId || '');

    return `
      <tr>
        <td class="user-name-cell">
          <button
            type="button"
            class="contact-name-button"
            data-user-view="${userId}"
          >
            ${escapeHtml(user.firstName || '—')}
          </button>
        </td>
        <td>${escapeHtml(user.emailAddress || '—')}</td>
        <td>${escapeHtml(user.company || '—')}</td>
        <td>${statusBadge(user.leadStatus || 'New')}</td>
        <td>${campaignCount.toLocaleString()}</td>
        <td>${user.unsubscribed
          ? '<span class="status-badge badge-danger">Suppressed</span>'
          : '<span class="status-badge badge-success">Subscribed</span>'}</td>
        <td class="actions-column">
          <div class="contact-row-actions">
            <button
              type="button"
              class="row-menu-trigger contact-view-trigger"
              data-user-view="${userId}"
              aria-label="View contact details"
              title="View contact details"
            >
              •••
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


function renderUserCampaignMemberships(
  userId
) {

  const data =
    DataEngine.getNormalized();


  const memberships =
    data.campaignMembers.filter(
      member =>
        String(
          member.userId || ''
        ) ===
        String(
          userId || ''
        )
    );


  if (!memberships.length) {

    return '<span class="muted-id">—</span>';
  }


  const campaignsById =
    new Map(
      data.campaigns.map(
        campaign => [
          String(
            campaign.campaignId || ''
          ),
          campaign
        ]
      )
    );


  return `
    <div class="user-campaign-list">
      ${memberships
        .sort(
          (a, b) => {

            const campaignA =
              campaignsById.get(
                String(
                  a.campaignId || ''
                )
              );

            const campaignB =
              campaignsById.get(
                String(
                  b.campaignId || ''
                )
              );

            const nameA =
              campaignA?.campaignName ||
              a.campaignName ||
              a.campaignId ||
              '';

            const nameB =
              campaignB?.campaignName ||
              b.campaignName ||
              b.campaignId ||
              '';

            return String(nameA)
              .localeCompare(
                String(nameB)
              );
          }
        )
        .map(
          member => {

            const campaign =
              campaignsById.get(
                String(
                  member.campaignId || ''
                )
              );


            const campaignName =
              campaign?.campaignName ||
              member.campaignName ||
              member.campaignId ||
              'Unknown Campaign';


            const status =
              String(
                member.membershipStatus ||
                member.status ||
                'ACTIVE'
              )
                .trim()
                .toUpperCase();


            return `
              <div class="user-campaign-item">
                <span class="user-campaign-name">
                  ${escapeHtml(campaignName)}
                </span>
                ${
                  status === 'INACTIVE'
                    ? '<span class="status-badge badge-muted">Inactive</span>'
                    : '<span class="status-badge badge-success">Active</span>'
                }
              </div>
            `;
          }
        )
        .join('')}
    </div>
  `;
}



let activeContactDetailUserId = '';


function getContactCampaignMemberships(
  userId
) {

  const data =
    DataEngine.getNormalized();

  const campaignsById =
    new Map(
      data.campaigns.map(
        campaign => [
          String(
            campaign.campaignId || ''
          ),
          campaign
        ]
      )
    );

  return data.campaignMembers
    .filter(
      member =>
        String(
          member.userId || ''
        ) ===
        String(
          userId || ''
        )
    )
    .map(
      member => {

        const campaign =
          campaignsById.get(
            String(
              member.campaignId || ''
            )
          );

        return {
          member,
          campaign,
          name:
            campaign?.campaignName ||
            member.campaignName ||
            member.campaignId ||
            'Unknown Campaign',
          status:
            String(
              member.membershipStatus ||
              member.status ||
              'ACTIVE'
            )
              .trim()
              .toUpperCase()
        };
      }
    )
    .sort(
      (a, b) =>
        String(
          a.name || ''
        ).localeCompare(
          String(
            b.name || ''
          )
        )
    );
}


function openContactDetail(
  userId
) {

  const user =
    DataEngine.getUserById(
      userId
    );

  if (!user) {
    return;
  }

  activeContactDetailUserId =
    user.userId || '';

  const memberships =
    getContactCampaignMemberships(
      user.userId
    );

  const activeMemberships =
    memberships.filter(
      item =>
        item.status ===
        'ACTIVE'
    );

  setText(
    'contactDetailName',
    user.firstName ||
    user.emailAddress ||
    'Contact'
  );

  setText(
    'contactDetailEmail',
    user.emailAddress ||
    '—'
  );

  setText(
    'contactDetailCompany',
    user.company ||
    '—'
  );

  setText(
    'contactDetailCampaignCount',
    activeMemberships.length.toLocaleString()
  );

  setText(
    'contactDetailUserId',
    user.userId ||
    '—'
  );

  setText(
    'contactDetailContactId',
    user.contactId ||
    '—'
  );

  const subscription =
    document.getElementById(
      'contactDetailSubscription'
    );

  if (subscription) {
    subscription.innerHTML =
      user.unsubscribed
        ? '<span class="status-badge badge-danger">Suppressed</span>'
        : '<span class="status-badge badge-success">Subscribed</span>';
  }

  const lead =
    document.getElementById(
      'contactDetailLeadStatus'
    );

  if (lead) {
    lead.innerHTML =
      statusBadge(
        user.leadStatus ||
        'New'
      );
  }

  const campaigns =
    document.getElementById(
      'contactDetailCampaigns'
    );

  if (campaigns) {

    if (!memberships.length) {

      campaigns.innerHTML =
        '<div class="drawer-empty-state">No campaign memberships yet.</div>';

    } else {

      campaigns.innerHTML =
        memberships
          .map(
            item => `
              <div class="contact-detail-campaign-item">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  ${
                    item.campaign?.campaignStatus
                      ? `<small>${escapeHtml(item.campaign.campaignStatus)}</small>`
                      : ''
                  }
                </div>
                ${
                  item.status === 'ACTIVE'
                    ? '<span class="status-badge badge-success">Active</span>'
                    : '<span class="status-badge badge-muted">Inactive</span>'
                }
              </div>
            `
          )
          .join('');
    }
  }

  const backdrop =
    document.getElementById(
      'contactDetailBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      false;
  }

  document.body.classList.add(
    'drawer-open'
  );
}


function closeContactDetail() {

  const backdrop =
    document.getElementById(
      'contactDetailBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      true;
  }

  activeContactDetailUserId =
    '';

  document.body.classList.remove(
    'drawer-open'
  );
}


function escapeCsvValue(
  value
) {

  const text =
    String(
      value ?? ''
    );

  return `"${text.replace(/"/g, '""')}"`;
}


function exportContactsCsv() {

  const data =
    DataEngine.getNormalized();

  const rows =
    getUserManagementRows();

  if (!rows.length) {

    showUsersNotice(
      'There are no contacts to export for the current filters.',
      'warning'
    );

    return;
  }

  const header = [
    'First Name',
    'Email Address',
    'Company',
    'Lead Status',
    'Subscription',
    'Active Campaigns',
    'User ID',
    'Contact ID'
  ];

  const csvRows = [
    header.map(
      escapeCsvValue
    ).join(',')
  ];

  rows.forEach(
    user => {

      const activeCampaigns =
        data.campaignMembers.filter(
          member =>
            String(
              member.userId || ''
            ) ===
            String(
              user.userId || ''
            ) &&
            String(
              member.membershipStatus ||
              member.status ||
              'ACTIVE'
            )
              .toUpperCase() ===
              'ACTIVE'
        ).length;

      csvRows.push(
        [
          user.firstName || '',
          user.emailAddress || '',
          user.company || '',
          user.leadStatus || 'New',
          user.unsubscribed
            ? 'Suppressed'
            : 'Subscribed',
          activeCampaigns,
          user.userId || '',
          user.contactId || ''
        ]
          .map(
            escapeCsvValue
          )
          .join(',')
      );
    }
  );

  const blob =
    new Blob(
      [
        '\uFEFF' +
        csvRows.join('\r\n')
      ],
      {
        type:
          'text/csv;charset=utf-8;'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  const stamp =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  link.href =
    url;

  link.download =
    `altsec-outreach-contacts-${stamp}.csv`;

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  URL.revokeObjectURL(
    url
  );

  showUsersNotice(
    `${rows.length.toLocaleString()} contact${rows.length === 1 ? '' : 's'} exported.`,
    'success'
  );
}



function setActionButtonBusy(
  buttonOrId,
  busy,
  busyLabel
) {

  const button =
    typeof buttonOrId ===
      'string'
      ? document.getElementById(
          buttonOrId
        )
      : buttonOrId;

  if (!button) {
    return;
  }

  if (busy) {

    if (
      !button.dataset.originalLabel
    ) {
      button.dataset.originalLabel =
        button.textContent.trim();
    }

    button.disabled =
      true;

    button.classList.add(
      'is-loading'
    );

    button.innerHTML =
      `<span class="button-spinner" aria-hidden="true"></span><span>${escapeHtml(busyLabel || 'Working…')}</span>`;

  } else {

    button.disabled =
      false;

    button.classList.remove(
      'is-loading'
    );

    button.textContent =
      button.dataset.originalLabel ||
      button.textContent;

    delete button.dataset.originalLabel;
  }
}


async function withActionButtonBusy(
  buttonOrId,
  busyLabel,
  callback
) {

  const button =
    typeof buttonOrId ===
      'string'
      ? document.getElementById(
          buttonOrId
        )
      : buttonOrId;

  if (
    button?.disabled
  ) {
    return;
  }

  setActionButtonBusy(
    button,
    true,
    busyLabel
  );

  try {

    return await callback();

  } finally {

    setActionButtonBusy(
      button,
      false
    );
  }
}


function renderContactSegmentRulePreview() {

  const target =
    document.getElementById(
      'contactSegmentRulePreview'
    );

  if (!target) {
    return;
  }

  const field =
    document.getElementById(
      'contactSegmentField'
    )?.value ||
    'leadstatus';

  const operator =
    document.getElementById(
      'contactSegmentOperator'
    )?.value ||
    'equals';

  const value =
    document.getElementById(
      'contactSegmentValue'
    )?.value
      .trim() ||
    '…';

  const fieldLabels = {
    leadstatus:
      'Lead Status',
    company:
      'Company',
    subscription:
      'Subscription'
  };

  const operatorLabels = {
    equals:
      'equals',
    contains:
      'contains',
    not_equals:
      'does not equal'
  };

  target.textContent =
    `${fieldLabels[field] || field} ${operatorLabels[operator] || operator} “${value}”`;
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
  document.getElementById('userModalTitle').textContent = user ? 'Edit Contact' : 'Add Contact';
  document.getElementById('userFormUserId').value = user?.userId || '';
  document.getElementById('userFormFirstName').value = user?.firstName || '';
  document.getElementById('userFormEmail').value = user?.emailAddress || '';
  document.getElementById('userFormEmail').disabled = Boolean(user);
  document.getElementById('userFormCompany').value = user?.company || '';
  document.getElementById('userFormLeadStatus').value = user?.leadStatus || 'New';
  document.getElementById('userFormSubmit').textContent = user ? 'Save Changes' : 'Create Contact';
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
  if (submit) submit.textContent = busy ? 'Saving…' : (editingUserId ? 'Save Changes' : 'Create Contact');
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
        ? 'Contact updated successfully.'
        : (result?.result?.message || 'Contact created successfully.'),
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

async function toggleUserSubscription(userId, nextState, button) {
  const user = DataEngine.getUserById(userId);
  if (!user) return;
  const unsubscribed = nextState === 'Y';
  const action = unsubscribed ? 'unsubscribe' : 'resubscribe';
  if (!window.confirm(`Are you sure you want to ${action} ${user.emailAddress}?`)) return;

  await withActionButtonBusy(
    button,
    unsubscribed
      ? 'Suppressing…'
      : 'Resubscribing…',
    async () => {
      try {
        showUsersNotice(`${unsubscribed ? 'Suppressing' : 'Resubscribing'} ${user.emailAddress}…`, 'warning');
        await DashboardApi.setUserUnsubscribed(userId, unsubscribed);
        await initDashboard(true);
        switchView('usersView');
        showUsersNotice(`${user.emailAddress} ${unsubscribed ? 'suppressed' : 'resubscribed'} successfully.`, 'success');
      } catch (error) {
        showUsersNotice(error?.message || String(error), 'error');
      }
    }
  );
}

function attachUserManagementListeners() {
  if (userManagementAttached) return;
  userManagementAttached = true;

  document.getElementById('addUserButton')?.addEventListener('click', () => openUserModal());
  document.getElementById('exportContactsButton')?.addEventListener('click', exportContactsCsv);

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

    const viewButton =
      event.target.closest(
        '[data-user-view]'
      );

    if (viewButton) {
      openContactDetail(
        viewButton.dataset.userView
      );
      return;
    }

    const editButton = event.target.closest('[data-user-edit]');
    if (editButton) {
      openUserModal(editButton.dataset.userEdit);
      return;
    }

    const unsubButton = event.target.closest('[data-user-unsubscribe]');
    if (unsubButton) {
      toggleUserSubscription(
        unsubButton.dataset.userUnsubscribe,
        unsubButton.dataset.nextState,
        unsubButton
      );
    }
  });

  document.getElementById('contactDetailClose')?.addEventListener('click', closeContactDetail);

  document.getElementById('contactDetailBackdrop')?.addEventListener('click', event => {
    if (event.target.id === 'contactDetailBackdrop') {
      closeContactDetail();
    }
  });

  document.getElementById('contactDetailEdit')?.addEventListener('click', () => {

    if (!activeContactDetailUserId) {
      return;
    }

    const userId =
      activeContactDetailUserId;

    closeContactDetail();
    openUserModal(
      userId
    );
  });

  document.addEventListener('keydown', event => {
    if (
      event.key === 'Escape' &&
      !document.getElementById('contactDetailBackdrop')?.hidden
    ) {
      closeContactDetail();
    }
  });
}
/* ============================================================
   CAMPAIGN MANAGEMENT — V9 LIFECYCLE
   ============================================================ */

let campaignManagementAttached = false;
let editingCampaignId = '';
let activeCampaignLifecycleFilter = 'all';
let campaignBuilderCampaignId = '';
let campaignBuilderActiveStep = 'details';
let campaignBuilderRecipientSource = 'all';
let campaignBuilderSelectedUserIds = new Set();
let campaignContentState = {loaded:false,campaignContent:[],templates:[]};
let campaignComposeActiveMode = 'plain';
let campaignComposeLastFocusedEditor = 'campaignComposePlainBody';


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


function getRawCampaignStatus(
  campaign
) {

  return String(
    campaign?.campaignStatus ||
    campaign?.status ||
    'DRAFT'
  )
    .trim()
    .toUpperCase();
}


function getCampaignLifecycleStatus(
  campaign
) {

  const raw =
    getRawCampaignStatus(
      campaign
    );

  // Existing ACTIVE campaigns remain operationally compatible
  // with the current mailer, but the dashboard presents them
  // as RUNNING.
  if (
    raw ===
    'ACTIVE'
  ) {
    return 'RUNNING';
  }

  return raw;
}


function campaignLifecycleLabel(
  status
) {

  const normalized =
    String(
      status || ''
    )
      .trim()
      .toUpperCase();

  const labels = {
    DRAFT:
      'Draft',
    READY:
      'Ready',
    SCHEDULED:
      'Scheduled',
    RUNNING:
      'Running',
    ACTIVE:
      'Running',
    PAUSED:
      'Paused',
    COMPLETED:
      'Completed',
    CANCELED:
      'Canceled',
    ARCHIVED:
      'Archived'
  };

  return labels[normalized] ||
    normalized ||
    'Draft';
}


function campaignLifecycleBadge(
  campaign
) {

  const status =
    getCampaignLifecycleStatus(
      campaign
    );

  const classMap = {
    DRAFT:
      'campaign-status-draft',
    READY:
      'campaign-status-ready',
    SCHEDULED:
      'campaign-status-scheduled',
    RUNNING:
      'campaign-status-running',
    PAUSED:
      'campaign-status-paused',
    COMPLETED:
      'campaign-status-completed',
    CANCELED:
      'campaign-status-canceled',
    ARCHIVED:
      'campaign-status-archived'
  };

  return `
    <span class="campaign-status-badge ${classMap[status] || 'campaign-status-draft'}">
      <span class="campaign-status-dot" aria-hidden="true"></span>
      ${escapeHtml(campaignLifecycleLabel(status))}
    </span>
  `;
}


function campaignMatchesLifecycleFilter(
  campaign,
  filter
) {

  if (
    !filter ||
    filter ===
    'all'
  ) {
    return true;
  }

  const status =
    getCampaignLifecycleStatus(
      campaign
    );

  return status ===
    String(filter)
      .trim()
      .toUpperCase();
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

  return data.campaigns
    .filter(
      campaign =>
        campaignMatchesLifecycleFilter(
          campaign,
          activeCampaignLifecycleFilter
        )
    )
    .filter(
      campaign => {

        if (!query) {
          return true;
        }

        return [
          campaign.campaignName,
          campaign.campaignId,
          getCampaignLifecycleStatus(
            campaign
          )
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

        const aUpdated =
          new Date(
            a.updatedAt ||
            a.createdAt ||
            0
          ).getTime();

        const bUpdated =
          new Date(
            b.updatedAt ||
            b.createdAt ||
            0
          ).getTime();

        if (
          !Number.isNaN(aUpdated) &&
          !Number.isNaN(bUpdated) &&
          aUpdated !== bUpdated
        ) {
          return bUpdated - aUpdated;
        }

        return String(
          a.campaignName || ''
        ).localeCompare(
          String(
            b.campaignName || ''
          )
        );
      }
    );
}


function updateCampaignLifecycleCounts(
  campaigns
) {

  const count =
    status =>
      campaigns.filter(
        campaign =>
          getCampaignLifecycleStatus(
            campaign
          ) === status
      ).length;

  setText(
    'campaignLifecycleAllCount',
    campaigns.length.toLocaleString()
  );

  setText(
    'campaignLifecycleDraftCount',
    count('DRAFT').toLocaleString()
  );

  setText(
    'campaignLifecycleScheduledCount',
    count('SCHEDULED').toLocaleString()
  );

  setText(
    'campaignLifecycleRunningCount',
    count('RUNNING').toLocaleString()
  );

  setText(
    'campaignLifecyclePausedCount',
    count('PAUSED').toLocaleString()
  );

  setText(
    'campaignLifecycleCompletedCount',
    count('COMPLETED').toLocaleString()
  );

  setText(
    'campaignLifecycleArchivedCount',
    count('ARCHIVED').toLocaleString()
  );
}


function getCampaignLifecycleActions(
  campaign
) {

  const status =
    getCampaignLifecycleStatus(
      campaign
    );

  const actions = [
    {
      key:
        'edit',
      label:
        'Edit campaign'
    },
    {
      key:
        'builder',
      label:
        'Build campaign'
    },
    {
      key:
        'members',
      label:
        'Manage members'
    },
    {
      key:
        'duplicate',
      label:
        'Duplicate'
    }
  ];


  if (
    status ===
    'DRAFT'
  ) {
    actions.push({
      key:
        'ready',
      label:
        'Mark ready'
    });
  }


  if (
    status ===
      'RUNNING'
  ) {
    actions.push({
      key:
        'pause',
      label:
        'Pause'
    });
  }


  if (
    status ===
      'PAUSED'
  ) {
    actions.push({
      key:
        'resume',
      label:
        'Resume'
    });
  }


  if (
    [
      'READY',
      'SCHEDULED',
      'RUNNING',
      'PAUSED'
    ].includes(
      status
    )
  ) {
    actions.push({
      key:
        'complete',
      label:
        'Mark completed'
    });
  }


  if (
    [
      'DRAFT',
      'READY',
      'SCHEDULED',
      'RUNNING',
      'PAUSED'
    ].includes(
      status
    )
  ) {
    actions.push({
      key:
        'cancel',
      label:
        'Cancel campaign',
      danger:
        true
    });
  }


  if (
    [
      'COMPLETED',
      'CANCELED'
    ].includes(
      status
    )
  ) {
    actions.push({
      key:
        'archive',
      label:
        'Archive'
    });
  }

  return actions;
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
    DataEngine
      .getNormalized()
      .campaigns || [];

  const rows =
    getCampaignManagementRows();

  updateCampaignLifecycleCounts(
    allCampaigns
  );

  setText(
    'campaignsShowingCount',
    rows.length.toLocaleString()
  );


  document
    .querySelectorAll(
      '[data-campaign-lifecycle]'
    )
    .forEach(
      button =>
        button.classList.toggle(
          'active',
          button.dataset.campaignLifecycle ===
            activeCampaignLifecycleFilter
        )
    );


  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        6,
        activeCampaignLifecycleFilter ===
          'all'
          ? 'No campaigns match the current search.'
          : `No ${activeCampaignLifecycleFilter} campaigns found.`
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
        campaign => {

          const campaignId =
            String(
              campaign.campaignId ||
              ''
            );

          const campaignName =
            String(
              campaign.campaignName ||
              campaignId ||
              '—'
            );

          const totalContacts =
            Number(
              campaign.totalContacts ||
              0
            );

          const totalEmailEvents =
            Number(
              campaign.totalEmailEvents ||
              0
            );

          const actions =
            getCampaignLifecycleActions(
              campaign
            );

          return `
            <tr>
              <td>
                <button
                  type="button"
                  class="campaign-name-button"
                  data-campaign-open="${escapeHtml(campaignId)}"
                >
                  ${escapeHtml(campaignName)}
                </button>
              </td>

              <td>
                ${campaignLifecycleBadge(campaign)}
              </td>

              <td>
                ${totalContacts.toLocaleString()}
              </td>

              <td>
                ${totalEmailEvents.toLocaleString()}
              </td>

              <td>
                <span class="campaign-updated-value">
                  ${escapeHtml(formatCampaignDate(campaign.updatedAt))}
                </span>
              </td>

              <td class="actions-column">

                <div class="row-menu">

                  <button
                    type="button"
                    class="row-menu-trigger"
                    aria-label="Campaign actions"
                    aria-expanded="false"
                    data-campaign-menu-trigger="${escapeHtml(campaignId)}"
                  >
                    •••
                  </button>

                  <div
                    class="row-menu-panel campaign-row-menu"
                    data-campaign-menu="${escapeHtml(campaignId)}"
                    hidden
                  >
                    ${
                      actions
                        .map(
                          action => `
                            <button
                              type="button"
                              class="row-menu-item ${action.danger ? 'danger' : ''}"
                              data-campaign-action="${escapeHtml(action.key)}"
                              data-campaign-id="${escapeHtml(campaignId)}"
                            >
                              ${escapeHtml(action.label)}
                            </button>
                          `
                        )
                        .join('')
                    }
                  </div>

                </div>

              </td>
            </tr>
          `;
        }
      )
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
    message ||
    '';
}


function openCampaignModal(
  campaignId = ''
) {

  editingCampaignId =
    campaignId ||
    '';

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

  const description =
    document.getElementById(
      'campaignModalDescription'
    );

  const idInput =
    document.getElementById(
      'campaignFormCampaignId'
    );

  const nameInput =
    document.getElementById(
      'campaignFormName'
    );

  const statusInput =
    document.getElementById(
      'campaignFormStatus'
    );

  const submit =
    document.getElementById(
      'campaignFormSubmit'
    );

  const context =
    document.getElementById(
      'campaignEditLifecycleContext'
    );

  const contextStatus =
    document.getElementById(
      'campaignEditLifecycleStatus'
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
    !statusInput ||
    !submit ||
    !errorBox ||
    !backdrop
  ) {
    return;
  }


  title.textContent =
    campaign
      ? 'Edit Campaign'
      : 'Create Campaign';


  if (description) {
    description.textContent =
      campaign
        ? 'Update the campaign name. Lifecycle changes are controlled separately from the action menu.'
        : 'Create the campaign record first. Recipients, content, sending and scheduling are configured in later steps.';
  }


  idInput.value =
    campaign?.campaignId ||
    '';


  nameInput.value =
    campaign?.campaignName ||
    '';


  statusInput.value =
    campaign
      ? getRawCampaignStatus(
          campaign
        )
      : 'DRAFT';


  submit.textContent =
    campaign
      ? 'Save Changes'
      : 'Create Campaign';


  if (context) {
    context.hidden =
      !campaign;
  }


  if (
    contextStatus &&
    campaign
  ) {
    contextStatus.textContent =
      campaignLifecycleLabel(
        getCampaignLifecycleStatus(
          campaign
        )
      );
  }


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

    setActionButtonBusy(
      submit,
      busy,
      editingCampaignId
        ? 'Saving…'
        : 'Creating…'
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

  const statusInput =
    document.getElementById(
      'campaignFormStatus'
    );

  if (
    !errorBox ||
    !nameInput ||
    !statusInput
  ) {
    return;
  }

  errorBox.hidden =
    true;

  errorBox.textContent =
    '';

  const wasEditing =
    Boolean(
      editingCampaignId
    );

  const payload = {
    campaignName:
      nameInput.value.trim(),
    campaignStatus:
      wasEditing
        ? statusInput.value
        : 'DRAFT'
  };

  if (
    !payload.campaignName
  ) {

    errorBox.textContent =
      'Campaign name is required.';

    errorBox.hidden =
      false;

    return;
  }

  if (wasEditing) {
    payload.campaignId =
      editingCampaignId;
  }

  try {

    setCampaignFormBusy(
      true
    );

    const result =
      wasEditing
        ? await DashboardApi
            .updateCampaign(
              payload
            )
        : await DashboardApi
            .createCampaign(
              payload
            );

    closeCampaignModal();

    await initDashboard(
      true
    );

    switchView(
      'campaignsView'
    );

    switchCampaignModuleTab(
      'all'
    );

    showCampaignsNotice(
      wasEditing
        ? 'Campaign updated successfully.'
        : (
            result?.result?.message ||
            'Draft campaign created successfully.'
          ),
      'success'
    );

  } catch (error) {

    errorBox.textContent =
      error?.message ||
      String(
        error
      );

    errorBox.hidden =
      false;

  } finally {

    setCampaignFormBusy(
      false
    );
  }
}


function closeAllCampaignMenus() {

  document
    .querySelectorAll(
      '[data-campaign-menu]'
    )
    .forEach(
      menu => {
        menu.hidden =
          true;
      }
    );

  document
    .querySelectorAll(
      '[data-campaign-menu-trigger]'
    )
    .forEach(
      trigger =>
        trigger.setAttribute(
          'aria-expanded',
          'false'
        )
    );
}


function toggleCampaignMenu(
  trigger
) {

  const campaignId =
    trigger.dataset.campaignMenuTrigger ||
    '';

  const menu =
    document.querySelector(
      `[data-campaign-menu="${CSS.escape(campaignId)}"]`
    );

  if (!menu) {
    return;
  }

  const shouldOpen =
    menu.hidden;

  closeAllCampaignMenus();

  menu.hidden =
    !shouldOpen;

  trigger.setAttribute(
    'aria-expanded',
    shouldOpen
      ? 'true'
      : 'false'
  );
}


function getCampaignTransitionTarget(
  action
) {

  const targets = {
    ready:
      'READY',

    // Keep ACTIVE as the current operational status so
    // existing MailerEngine compatibility is not broken.
    resume:
      'ACTIVE',

    pause:
      'PAUSED',

    complete:
      'COMPLETED',

    cancel:
      'CANCELED',

    archive:
      'ARCHIVED'
  };

  return targets[action] ||
    '';
}


function getCampaignActionBusyLabel(
  action
) {

  const labels = {
    ready:
      'Updating…',
    pause:
      'Pausing…',
    resume:
      'Resuming…',
    complete:
      'Completing…',
    cancel:
      'Canceling…',
    archive:
      'Archiving…',
    duplicate:
      'Duplicating…'
  };

  return labels[action] ||
    'Working…';
}


async function updateCampaignLifecycle(
  campaign,
  action,
  button
) {

  const targetStatus =
    getCampaignTransitionTarget(
      action
    );

  if (!targetStatus) {
    return;
  }

  const destructive =
    action ===
      'cancel';

  if (destructive) {

    const confirmed =
      window.confirm(
        `Cancel "${campaign.campaignName}"? This campaign will no longer be treated as active.`
      );

    if (!confirmed) {
      return;
    }
  }

  await withActionButtonBusy(
    button,
    getCampaignActionBusyLabel(
      action
    ),
    async () => {

      try {

        await DashboardApi
          .updateCampaign({
            campaignId:
              campaign.campaignId,
            campaignName:
              campaign.campaignName,
            campaignStatus:
              targetStatus
          });

        closeAllCampaignMenus();

        await initDashboard(
          true
        );

        switchView(
          'campaignsView'
        );

        switchCampaignModuleTab(
          'all'
        );

        const messages = {
          ready:
            'Campaign marked ready.',
          pause:
            'Campaign paused.',
          resume:
            'Campaign resumed.',
          complete:
            'Campaign marked completed.',
          cancel:
            'Campaign canceled.',
          archive:
            'Campaign archived.'
        };

        showCampaignsNotice(
          messages[action] ||
          'Campaign updated.',
          'success'
        );

      } catch (error) {

        showCampaignsNotice(
          error?.message ||
          'Could not update the campaign.',
          'error'
        );
      }
    }
  );
}


function getUniqueDuplicateCampaignName(
  campaignName
) {

  const data =
    DataEngine.getNormalized();

  const names =
    new Set(
      data.campaigns.map(
        campaign =>
          String(
            campaign.campaignName ||
            ''
          )
            .trim()
            .toLowerCase()
      )
    );

  const base =
    `${campaignName} Copy`;

  if (
    !names.has(
      base.toLowerCase()
    )
  ) {
    return base;
  }

  let number =
    2;

  while (
    names.has(
      `${base} ${number}`.toLowerCase()
    )
  ) {
    number++;
  }

  return `${base} ${number}`;
}


async function duplicateCampaign(
  campaign,
  button
) {

  await withActionButtonBusy(
    button,
    'Duplicating…',
    async () => {

      try {

        await DashboardApi
          .createCampaign({
            campaignName:
              getUniqueDuplicateCampaignName(
                campaign.campaignName
              ),
            campaignStatus:
              'DRAFT'
          });

        closeAllCampaignMenus();

        await initDashboard(
          true
        );

        switchView(
          'campaignsView'
        );

        switchCampaignModuleTab(
          'all'
        );

        activeCampaignLifecycleFilter =
          'draft';

        renderCampaignManagement();

        showCampaignsNotice(
          'Campaign duplicated as a new draft.',
          'success'
        );

      } catch (error) {

        showCampaignsNotice(
          error?.message ||
          'Could not duplicate the campaign.',
          'error'
        );
      }
    }
  );
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

  const select =
    document.getElementById(
      'campaignMembersCampaignSelect'
    );

  if (select) {
    select.value =
      campaignId;
  }

  switchView(
    'campaignsView'
  );

  switchCampaignModuleTab(
    'members'
  );

  renderCampaignMembers();
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


async function handleCampaignRowAction(
  action,
  campaignId,
  button
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


  if (
    action ===
    'edit'
  ) {

    closeAllCampaignMenus();

    openCampaignModal(
      campaignId
    );

    return;
  }


  if (
    action ===
    'builder'
  ) {

    closeAllCampaignMenus();
    await openCampaignBuilder(
      campaignId
    );
    return;
  }


  if (
    action ===
    'members'
  ) {

    closeAllCampaignMenus();

    openCampaign(
      campaignId
    );

    return;
  }


  if (
    action ===
    'duplicate'
  ) {

    await duplicateCampaign(
      campaign,
      button
    );

    return;
  }


  await updateCampaignLifecycle(
    campaign,
    action,
    button
  );
}


function attachCampaignManagementListeners() {

  if (
    campaignManagementAttached
  ) {
    return;
  }

  campaignManagementAttached =
    true;


  document
    .getElementById(
      'addCampaignButton'
    )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.currentTarget.disabled
        ) {
          return;
        }

        openCampaignModal();
      }
    );


  document
    .getElementById(
      'campaignModalClose'
    )
    ?.addEventListener(
      'click',
      closeCampaignModal
    );


  document
    .getElementById(
      'campaignFormCancel'
    )
    ?.addEventListener(
      'click',
      closeCampaignModal
    );


  document
    .getElementById(
      'campaignForm'
    )
    ?.addEventListener(
      'submit',
      submitCampaignForm
    );


  document
    .getElementById(
      'campaignModalBackdrop'
    )
    ?.addEventListener(
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


  document
    .getElementById(
      'campaignSearchInput'
    )
    ?.addEventListener(
      'input',
      renderCampaignManagement
    );


  document
    .querySelectorAll(
      '[data-campaign-lifecycle]'
    )
    .forEach(
      button =>
        button.addEventListener(
          'click',
          () => {

            activeCampaignLifecycleFilter =
              button.dataset.campaignLifecycle ||
              'all';

            renderCampaignManagement();
          }
        )
    );


  document
    .getElementById(
      'campaignManagementTable'
    )
    ?.addEventListener(
      'click',
      async event => {

        const nameButton =
          event.target.closest(
            '[data-campaign-open]'
          );

        if (nameButton) {

          openCampaign(
            nameButton.dataset.campaignOpen
          );

          return;
        }


        const trigger =
          event.target.closest(
            '[data-campaign-menu-trigger]'
          );

        if (trigger) {

          event.stopPropagation();

          toggleCampaignMenu(
            trigger
          );

          return;
        }


        const actionButton =
          event.target.closest(
            '[data-campaign-action]'
          );

        if (actionButton) {

          event.stopPropagation();

          if (
            actionButton.disabled
          ) {
            return;
          }

          await handleCampaignRowAction(
            actionButton.dataset.campaignAction,
            actionButton.dataset.campaignId,
            actionButton
          );
        }
      }
    );


  document.addEventListener(
    'click',
    event => {

      if (
        !event.target.closest(
          '.campaign-row-menu'
        ) &&
        !event.target.closest(
          '[data-campaign-menu-trigger]'
        )
      ) {
        closeAllCampaignMenus();
      }
    }
  );
}



/* ============================================================
   CAMPAIGN BUILDER V10 — DETAILS + RECIPIENTS
   ============================================================ */

function campaignBuilderUserIsSuppressed(user) {
  return Boolean(user?.unsubscribed);
}

function getCampaignBuilderCampaign() {
  return getCampaignById(campaignBuilderCampaignId);
}

function getCampaignBuilderMembers() {
  const data = DataEngine.getNormalized();
  return (data.campaignMembers || []).filter(member =>
    String(member.campaignId || '') === String(campaignBuilderCampaignId || '') &&
    getCampaignMemberStatus(member) === 'ACTIVE'
  );
}

function getCampaignBuilderMemberUserIds() {
  return new Set(getCampaignBuilderMembers().map(member => String(member.userId || '')));
}

function showCampaignBuilderNotice(message, type = 'success') {
  const notice = document.getElementById('campaignBuilderNotice');
  if (!notice) return;
  notice.hidden = !message;
  notice.className = `dashboard-notice ${type}`;
  notice.textContent = message || '';
}

function switchCampaignBuilderStep(step) {
  campaignBuilderActiveStep = step;
  document.querySelectorAll('[data-builder-step]').forEach(button =>
    button.classList.toggle('active', button.dataset.builderStep === step)
  );
  document.querySelectorAll('[data-builder-panel]').forEach(panel =>
    panel.classList.toggle('active', panel.dataset.builderPanel === step)
  );
  if (step === 'recipients') renderCampaignBuilderRecipients();
  if (step === 'compose') loadCampaignCompose();
}

function closeCampaignBuilder() {
  const workspace = document.getElementById('campaignBuilderWorkspace');
  if (workspace) workspace.hidden = true;
  document.body.classList.remove('campaign-builder-open');
  campaignBuilderCampaignId = '';
  campaignBuilderSelectedUserIds.clear();
}

async function openCampaignBuilder(campaignId) {
  campaignBuilderCampaignId = String(campaignId || '');
  campaignBuilderSelectedUserIds.clear();
  const campaign = getCampaignBuilderCampaign();
  if (!campaign) {
    showCampaignsNotice('Campaign could not be found.', 'error');
    return;
  }

  const workspace = document.getElementById('campaignBuilderWorkspace');
  if (!workspace) return;

  setText('campaignBuilderCampaignName', campaign.campaignName || 'Campaign');
  setText('campaignBuilderCampaignMeta', `${campaignLifecycleLabel(getCampaignLifecycleStatus(campaign))} · ${campaign.campaignId}`);
  setText('campaignBuilderIdValue', campaign.campaignId || '—');
  setText('campaignBuilderStatusValue', campaignLifecycleLabel(getCampaignLifecycleStatus(campaign)));

  const input = document.getElementById('campaignBuilderNameInput');
  if (input) input.value = campaign.campaignName || '';

  workspace.hidden = false;
  document.body.classList.add('campaign-builder-open');
  switchCampaignBuilderStep('details');

  try {
    await ensureContactAudiencesLoaded();
  } catch (error) {
    // All Contacts remains usable even if saved audiences fail to load.
  }
}

async function saveCampaignBuilderDetails() {
  const campaign = getCampaignBuilderCampaign();
  const input = document.getElementById('campaignBuilderNameInput');
  const button = document.getElementById('campaignBuilderSaveDetails');
  const name = input?.value.trim() || '';
  if (!campaign || !name) return;

  await withActionButtonBusy(button, 'Saving…', async () => {
    try {
      setText('campaignBuilderSaveState', 'Saving…');
      await DashboardApi.updateCampaign({
        campaignId: campaign.campaignId,
        campaignName: name,
        campaignStatus: getRawCampaignStatus(campaign)
      });
      await initDashboard(true);
      campaignBuilderCampaignId = campaign.campaignId;
      const updated = getCampaignBuilderCampaign();
      setText('campaignBuilderCampaignName', updated?.campaignName || name);
      setText('campaignBuilderSaveState', 'Saved');
      switchCampaignBuilderStep('recipients');
    } catch (error) {
      setText('campaignBuilderSaveState', 'Not saved');
      showCampaignBuilderNotice(error?.message || 'Could not save campaign details.', 'error');
    }
  });
}

function switchCampaignBuilderRecipientSource(source) {
  campaignBuilderRecipientSource = source;
  document.querySelectorAll('[data-recipient-source]').forEach(button =>
    button.classList.toggle('active', button.dataset.recipientSource === source)
  );
  document.querySelectorAll('[data-recipient-source-panel]').forEach(panel =>
    panel.classList.toggle('active', panel.dataset.recipientSourcePanel === source)
  );
  renderCampaignBuilderRecipients();
}

function getCampaignBuilderFilteredUsers() {
  const data = DataEngine.getNormalized();
  const query = (document.getElementById('campaignBuilderContactSearch')?.value || '').trim().toLowerCase();
  return (data.users || []).filter(user => {
    if (!query) return true;
    return [user.firstName, user.emailAddress, user.company, user.leadStatus].some(value =>
      String(value || '').toLowerCase().includes(query)
    );
  });
}

function renderCampaignBuilderAllContacts() {
  const tbody = document.getElementById('campaignBuilderContactsTable');
  if (!tbody) return;
  const existing = getCampaignBuilderMemberUserIds();
  const rows = getCampaignBuilderFilteredUsers();
  setText('campaignBuilderSelectedCount', campaignBuilderSelectedUserIds.size.toLocaleString());

  if (!rows.length) {
    tbody.innerHTML = emptyRow(5, 'No contacts match this search.');
    return;
  }

  tbody.innerHTML = rows.slice(0, 500).map(user => {
    const userId = String(user.userId || '');
    const suppressed = campaignBuilderUserIsSuppressed(user);
    const alreadyAdded = existing.has(userId);
    const disabled = suppressed || alreadyAdded;
    const eligibility = suppressed
      ? '<span class="status-badge badge-danger">Suppressed</span>'
      : alreadyAdded
        ? '<span class="status-badge badge-neutral">Already added</span>'
        : '<span class="status-badge badge-success">Eligible</span>';
    return `<tr>
      <td class="checkbox-column"><input type="checkbox" data-builder-user-select="${escapeHtml(userId)}" ${campaignBuilderSelectedUserIds.has(userId) ? 'checked' : ''} ${disabled ? 'disabled' : ''}></td>
      <td><strong>${escapeHtml(user.firstName || '—')}</strong></td>
      <td>${escapeHtml(user.emailAddress || '—')}</td>
      <td>${escapeHtml(user.company || '—')}</td>
      <td>${eligibility}</td>
    </tr>`;
  }).join('');
}

function renderCampaignBuilderLists() {
  const grid = document.getElementById('campaignBuilderListsGrid');
  if (!grid) return;
  const lists = contactAudienceState.lists || [];
  if (!lists.length) {
    grid.innerHTML = '<div class="audience-empty-state full-span"><strong>No contact lists yet</strong><span>Create lists in Contacts → Lists first.</span></div>';
    return;
  }
  const data = DataEngine.getNormalized();
  const existing = getCampaignBuilderMemberUserIds();
  grid.innerHTML = lists.map(list => {
    const memberIds = new Set((contactAudienceState.listMembers || []).filter(m => m.listId === list.listId).map(m => String(m.userId || '')));
    const users = (data.users || []).filter(u => memberIds.has(String(u.userId || '')));
    const eligible = users.filter(u => !campaignBuilderUserIsSuppressed(u) && !existing.has(String(u.userId || '')));
    const suppressed = users.filter(campaignBuilderUserIsSuppressed).length;
    return `<article class="builder-audience-card">
      <div><span class="detail-eyebrow">Static List</span><h4>${escapeHtml(list.name || 'Untitled List')}</h4><p>${escapeHtml(list.description || 'Saved contact list')}</p></div>
      <div class="builder-audience-card-stats"><span><strong>${users.length}</strong> contacts</span><span><strong>${eligible.length}</strong> eligible</span>${suppressed ? `<span><strong>${suppressed}</strong> suppressed</span>` : ''}</div>
      <button type="button" class="secondary-action-button" data-builder-add-list="${escapeHtml(list.listId || '')}" ${eligible.length ? '' : 'disabled'}>Add Eligible Contacts</button>
    </article>`;
  }).join('');
}

function renderCampaignBuilderSegments() {
  const grid = document.getElementById('campaignBuilderSegmentsGrid');
  if (!grid) return;
  const segments = contactAudienceState.segments || [];
  if (!segments.length) {
    grid.innerHTML = '<div class="audience-empty-state full-span"><strong>No dynamic segments yet</strong><span>Create segments in Contacts → Segments first.</span></div>';
    return;
  }
  const existing = getCampaignBuilderMemberUserIds();
  grid.innerHTML = segments.map(segment => {
    const users = getSegmentMatchingUsers(segment);
    const eligible = users.filter(u => !campaignBuilderUserIsSuppressed(u) && !existing.has(String(u.userId || '')));
    const suppressed = users.filter(campaignBuilderUserIsSuppressed).length;
    return `<article class="builder-audience-card">
      <div><span class="detail-eyebrow">Dynamic Segment</span><h4>${escapeHtml(segment.name || 'Untitled Segment')}</h4><p>${escapeHtml(segmentRuleLabel(segment))}</p></div>
      <div class="builder-audience-card-stats"><span><strong>${users.length}</strong> matches</span><span><strong>${eligible.length}</strong> eligible</span>${suppressed ? `<span><strong>${suppressed}</strong> suppressed</span>` : ''}</div>
      <button type="button" class="secondary-action-button" data-builder-add-segment="${escapeHtml(segment.segmentId || '')}" ${eligible.length ? '' : 'disabled'}>Add Eligible Contacts</button>
    </article>`;
  }).join('');
}

function renderCampaignBuilderCurrentAudience() {
  const tbody = document.getElementById('campaignBuilderCurrentAudienceTable');
  if (!tbody) return;
  const members = getCampaignBuilderMembers();
  setText('campaignBuilderRecipientCount', members.length.toLocaleString());
  setText('campaignBuilderCurrentAudienceCount', members.length.toLocaleString());
  if (!members.length) {
    tbody.innerHTML = emptyRow(4, 'No recipients have been added yet.');
    return;
  }
  tbody.innerHTML = members.map(member => {
    const user = getCampaignMemberUser(member);
    return `<tr><td><strong>${escapeHtml(user?.firstName || '—')}</strong></td><td>${escapeHtml(user?.emailAddress || member.emailAddress || '—')}</td><td>${escapeHtml(user?.company || '—')}</td><td><span class="status-badge badge-success">Included</span></td></tr>`;
  }).join('');
}

function renderCampaignBuilderRecipients() {
  renderCampaignBuilderAllContacts();
  renderCampaignBuilderLists();
  renderCampaignBuilderSegments();
  renderCampaignBuilderCurrentAudience();
}

async function addUsersToCampaignBuilder(userIds, button, label = 'Adding…') {
  const campaign = getCampaignBuilderCampaign();
  if (!campaign || !userIds.length) return;
  const existing = getCampaignBuilderMemberUserIds();
  const data = DataEngine.getNormalized();
  const uniqueIds = [...new Set(userIds.map(String))].filter(userId => {
    const user = (data.users || []).find(u => String(u.userId || '') === userId);
    return user && !campaignBuilderUserIsSuppressed(user) && !existing.has(userId);
  });
  if (!uniqueIds.length) {
    showCampaignBuilderNotice('No new eligible contacts to add.', 'warning');
    return;
  }

  await withActionButtonBusy(button, label, async () => {
    let added = 0;
    let failed = 0;
    for (const userId of uniqueIds) {
      try {
        await DashboardApi.addCampaignMember({ userId, campaignId: campaign.campaignId });
        added++;
      } catch (error) {
        failed++;
      }
    }
    await initDashboard(true);
    campaignBuilderCampaignId = campaign.campaignId;
    campaignBuilderSelectedUserIds.clear();
    renderCampaignBuilderRecipients();
    showCampaignBuilderNotice(
      failed ? `${added} contact(s) added; ${failed} could not be added.` : `${added} contact(s) added to the campaign.`,
      failed ? 'warning' : 'success'
    );
  });
}

function getEligibleUsersForList(listId) {
  const data = DataEngine.getNormalized();
  const ids = new Set((contactAudienceState.listMembers || []).filter(m => m.listId === listId).map(m => String(m.userId || '')));
  return (data.users || []).filter(u => ids.has(String(u.userId || '')) && !campaignBuilderUserIsSuppressed(u));
}

function getEligibleUsersForSegment(segmentId) {
  const segment = (contactAudienceState.segments || []).find(item => item.segmentId === segmentId);
  return segment ? getSegmentMatchingUsers(segment).filter(u => !campaignBuilderUserIsSuppressed(u)) : [];
}

function attachCampaignBuilderListeners() {
  document.getElementById('campaignBuilderClose')?.addEventListener('click', closeCampaignBuilder);
  document.getElementById('campaignBuilderExit')?.addEventListener('click', closeCampaignBuilder);
  document.getElementById('campaignBuilderSaveDetails')?.addEventListener('click', saveCampaignBuilderDetails);

  document.querySelectorAll('[data-builder-step]').forEach(button => button.addEventListener('click', () => switchCampaignBuilderStep(button.dataset.builderStep)));
  document.querySelectorAll('[data-recipient-source]').forEach(button => button.addEventListener('click', () => switchCampaignBuilderRecipientSource(button.dataset.recipientSource)));

  document.getElementById('campaignBuilderContactSearch')?.addEventListener('input', renderCampaignBuilderAllContacts);

  document.getElementById('campaignBuilderContactsTable')?.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-builder-user-select]');
    if (!checkbox) return;
    const userId = checkbox.dataset.builderUserSelect;
    if (checkbox.checked) campaignBuilderSelectedUserIds.add(userId);
    else campaignBuilderSelectedUserIds.delete(userId);
    setText('campaignBuilderSelectedCount', campaignBuilderSelectedUserIds.size.toLocaleString());
  });

  document.getElementById('campaignBuilderSelectAll')?.addEventListener('change', event => {
    const checked = event.target.checked;
    getCampaignBuilderFilteredUsers().forEach(user => {
      const userId = String(user.userId || '');
      if (campaignBuilderUserIsSuppressed(user) || getCampaignBuilderMemberUserIds().has(userId)) return;
      if (checked) campaignBuilderSelectedUserIds.add(userId); else campaignBuilderSelectedUserIds.delete(userId);
    });
    renderCampaignBuilderAllContacts();
  });

  document.getElementById('campaignBuilderAddSelected')?.addEventListener('click', event =>
    addUsersToCampaignBuilder([...campaignBuilderSelectedUserIds], event.currentTarget, 'Adding…')
  );

  document.getElementById('campaignBuilderListsGrid')?.addEventListener('click', event => {
    const button = event.target.closest('[data-builder-add-list]');
    if (!button) return;
    const ids = getEligibleUsersForList(button.dataset.builderAddList).map(user => user.userId);
    addUsersToCampaignBuilder(ids, button, 'Adding list…');
  });

  document.getElementById('campaignBuilderSegmentsGrid')?.addEventListener('click', event => {
    const button = event.target.closest('[data-builder-add-segment]');
    if (!button) return;
    const ids = getEligibleUsersForSegment(button.dataset.builderAddSegment).map(user => user.userId);
    addUsersToCampaignBuilder(ids, button, 'Adding segment…');
  });
}



/* ============================================================
   CAMPAIGN COMPOSE V11 — CONTENT, PERSONALIZATION, TEMPLATES
   ============================================================ */
function normalizeCampaignContentRecord(row) {
  return {
    campaignContentId: row['Campaign Content ID'] || row.campaignContentId || '',
    campaignId: row['Campaign ID'] || row.campaignId || '',
    templateId: row['Template ID'] || row.templateId || '',
    subject: row.Subject || row.subject || '',
    plainBody: row['Plain Body'] || row.plainBody || '',
    htmlBody: row['HTML Body'] || row.htmlBody || '',
    updatedAt: row['Updated At'] || row.updatedAt || ''
  };
}
function normalizeEmailTemplateRecord(row) {
  return {
    templateId: row['Template ID'] || row.templateId || '',
    name: row['Template Name'] || row.templateName || row.name || '',
    subject: row.Subject || row.subject || '',
    plainBody: row['Plain Body'] || row.plainBody || '',
    htmlBody: row['HTML Body'] || row.htmlBody || '',
    status: String(row['Template Status'] || row.status || 'ACTIVE').toUpperCase()
  };
}
async function ensureCampaignContentLoaded(force=false) {
  if (campaignContentState.loaded && !force) return campaignContentState;
  const response = await DashboardApi.getCampaignContent();
  const result = response?.result || {};
  campaignContentState = {
    loaded:true,
    campaignContent:(result.campaignContent || []).map(normalizeCampaignContentRecord),
    templates:(result.templates || []).map(normalizeEmailTemplateRecord)
  };
  return campaignContentState;
}
function getCurrentCampaignComposeContent() {
  return campaignContentState.campaignContent.find(item => String(item.campaignId) === String(campaignBuilderCampaignId)) || null;
}
function getComposePreviewUser() {
  const select=document.getElementById('campaignComposePreviewRecipient');
  const userId=select?.value || '';
  const data=DataEngine.getNormalized();
  return (data.users || []).find(user => String(user.userId || '') === String(userId)) || null;
}
function personalizationValue(key,user,campaign) {
  const map={firstname:user?.firstName||'',first_name:user?.firstName||'',email:user?.emailAddress||'',company:user?.company||'',campaignname:campaign?.campaignName||'',campaign_name:campaign?.campaignName||''};
  return map[String(key||'').toLowerCase()] || '';
}
function renderPersonalizedText(text,user,campaign) {
  return String(text||'').replace(/\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*(["'])(.*?)\2)?\s*\}\}/g,(full,key,quote,fallback) => {
    const value=personalizationValue(key,user,campaign);
    return value || (fallback !== undefined ? fallback : full);
  });
}
function getComposeUnknownVariables() {
  const allowed=new Set(['firstname','first_name','email','company','campaignname','campaign_name']);
  const text=[document.getElementById('campaignComposeSubject')?.value,document.getElementById('campaignComposePlainBody')?.value,document.getElementById('campaignComposeHtmlBody')?.value].join('\n');
  const unknown=new Set();
  for(const match of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)/g)) if(!allowed.has(String(match[1]).toLowerCase())) unknown.add(match[1]);
  return [...unknown];
}
function validateCampaignCompose() {
  const subject=document.getElementById('campaignComposeSubject')?.value.trim() || '';
  const plain=document.getElementById('campaignComposePlainBody')?.value.trim() || '';
  const html=document.getElementById('campaignComposeHtmlBody')?.value.trim() || '';
  const unknown=getComposeUnknownVariables();
  const issues=[];
  if(!subject) issues.push('Add a subject line.');
  if(!plain && !html) issues.push('Add an email body.');
  if(unknown.length) issues.push(`Unknown variable${unknown.length>1?'s':''}: ${unknown.join(', ')}.`);
  const box=document.getElementById('campaignComposeValidation');
  if(box) {
    box.className=`compose-validation ${issues.length?'has-issues':'is-valid'}`;
    box.innerHTML=issues.length ? issues.map(issue=>`<span>⚠ ${escapeHtml(issue)}</span>`).join('') : '<span>✓ Compose content is ready to save.</span>';
  }
  return {valid:!issues.length,issues};
}
function renderCampaignComposePreview() {
  validateCampaignCompose();
  const user=getComposePreviewUser();
  const campaign=getCampaignBuilderCampaign();
  const subject=document.getElementById('campaignComposeSubject')?.value || '';
  const plain=document.getElementById('campaignComposePlainBody')?.value || '';
  const html=document.getElementById('campaignComposeHtmlBody')?.value || '';
  setText('campaignComposePreviewSubject',renderPersonalizedText(subject,user,campaign) || '—');
  const body=document.getElementById('campaignComposePreviewBody');
  if(!body)return;
  if(html.trim()) {
    const rendered=renderPersonalizedText(html,user,campaign);
    body.innerHTML=`<iframe class="compose-preview-frame" title="Email preview" sandbox="allow-popups"></iframe>`;
    const frame=body.querySelector('iframe');
    if(frame) frame.srcdoc=rendered;
  } else {
    body.innerHTML=`<div class="compose-plain-preview">${escapeHtml(renderPersonalizedText(plain,user,campaign)).replace(/\n/g,'<br>')}</div>`;
  }
}
function populateComposePreviewRecipients() {
  const select=document.getElementById('campaignComposePreviewRecipient');
  if(!select)return;
  const members=getCampaignBuilderMembers();
  const options=members.map(member=>{
    const user=getCampaignMemberUser(member);
    return user ? `<option value="${escapeHtml(user.userId||'')}">${escapeHtml((user.firstName||user.emailAddress||'Recipient')+' — '+(user.emailAddress||''))}</option>` : '';
  }).join('');
  select.innerHTML=options || '<option value="">No campaign recipients yet</option>';
}
function populateComposeTemplates() {
  const select=document.getElementById('campaignComposeTemplateSelect');
  if(!select)return;
  const active=(campaignContentState.templates||[]).filter(t=>t.status!=='ARCHIVED');
  select.innerHTML='<option value="">Blank / Current campaign content</option>'+active.map(t=>`<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.name)}</option>`).join('');
}
async function loadCampaignCompose() {
  try {
    setText('campaignBuilderSaveState','Loading compose…');
    await ensureCampaignContentLoaded();
    const content=getCurrentCampaignComposeContent();
    const subject=document.getElementById('campaignComposeSubject');
    const plain=document.getElementById('campaignComposePlainBody');
    const html=document.getElementById('campaignComposeHtmlBody');
    if(subject) subject.value=content?.subject || '';
    if(plain) plain.value=content?.plainBody || '';
    if(html) html.value=content?.htmlBody || '';
    populateComposeTemplates();
    populateComposePreviewRecipients();
    renderCampaignComposePreview();
    setText('campaignBuilderSaveState','Saved');
  } catch(error) {
    showCampaignComposeNotice(error?.message || 'Could not load campaign content.','error');
    setText('campaignBuilderSaveState','Load failed');
  }
}
function showCampaignComposeNotice(message,type='success') {
  const notice=document.getElementById('campaignComposeNotice'); if(!notice)return;
  notice.hidden=!message; notice.className=`dashboard-notice ${type}`; notice.textContent=message||'';
}
function switchComposeMode(mode) {
  campaignComposeActiveMode=mode;
  document.querySelectorAll('[data-compose-mode]').forEach(b=>b.classList.toggle('active',b.dataset.composeMode===mode));
  document.querySelectorAll('[data-compose-mode-panel]').forEach(p=>p.classList.toggle('active',p.dataset.composeModePanel===mode));
}
function insertComposeVariable(variable) {
  const editor=document.getElementById(campaignComposeLastFocusedEditor) || document.getElementById('campaignComposePlainBody');
  if(!editor)return;
  const start=editor.selectionStart ?? editor.value.length, end=editor.selectionEnd ?? start;
  editor.value=editor.value.slice(0,start)+variable+editor.value.slice(end);
  editor.focus(); editor.setSelectionRange(start+variable.length,start+variable.length);
  renderCampaignComposePreview();
}
function applySelectedComposeTemplate() {
  const id=document.getElementById('campaignComposeTemplateSelect')?.value || '';
  const template=(campaignContentState.templates||[]).find(t=>t.templateId===id);
  if(!template){showCampaignComposeNotice('Select a template first.','warning');return;}
  if(!window.confirm(`Replace the current compose fields with template "${template.name}"?`))return;
  document.getElementById('campaignComposeSubject').value=template.subject||'';
  document.getElementById('campaignComposePlainBody').value=template.plainBody||'';
  document.getElementById('campaignComposeHtmlBody').value=template.htmlBody||'';
  renderCampaignComposePreview();
  showCampaignComposeNotice('Template applied. Save Compose to persist it to this campaign.','success');
}
async function saveCampaignCompose() {
  const validation=validateCampaignCompose(); if(!validation.valid)return;
  const button=document.getElementById('campaignComposeSave');
  await withActionButtonBusy(button,'Saving…',async()=>{
    try {
      setText('campaignBuilderSaveState','Saving…');
      await DashboardApi.saveCampaignContent({
        campaignId:campaignBuilderCampaignId,
        templateId:document.getElementById('campaignComposeTemplateSelect')?.value||'',
        subject:document.getElementById('campaignComposeSubject')?.value||'',
        plainBody:document.getElementById('campaignComposePlainBody')?.value||'',
        htmlBody:document.getElementById('campaignComposeHtmlBody')?.value||''
      });
      await ensureCampaignContentLoaded(true);
      setText('campaignBuilderSaveState','Saved');
      showCampaignComposeNotice('Compose content saved to this campaign.','success');
    } catch(error){setText('campaignBuilderSaveState','Not saved');showCampaignComposeNotice(error?.message||'Could not save compose content.','error');}
  });
}
async function saveComposeAsTemplate() {
  const validation=validateCampaignCompose(); if(!validation.valid)return;
  const name=window.prompt('Template name'); if(!name?.trim())return;
  const button=document.getElementById('campaignComposeSaveTemplate');
  await withActionButtonBusy(button,'Saving template…',async()=>{
    try {
      await DashboardApi.createEmailTemplate({templateName:name.trim(),subject:document.getElementById('campaignComposeSubject')?.value||'',plainBody:document.getElementById('campaignComposePlainBody')?.value||'',htmlBody:document.getElementById('campaignComposeHtmlBody')?.value||''});
      await ensureCampaignContentLoaded(true); populateComposeTemplates();
      showCampaignComposeNotice(`Template "${name.trim()}" saved.`,'success');
    } catch(error){showCampaignComposeNotice(error?.message||'Could not save template.','error');}
  });
}
function attachCampaignComposeListeners() {
  document.getElementById('campaignComposeBack')?.addEventListener('click',()=>switchCampaignBuilderStep('recipients'));
  document.getElementById('campaignComposeSave')?.addEventListener('click',saveCampaignCompose);
  document.getElementById('campaignComposeSaveTemplate')?.addEventListener('click',saveComposeAsTemplate);
  document.getElementById('campaignComposeApplyTemplate')?.addEventListener('click',applySelectedComposeTemplate);
  document.getElementById('campaignComposePreviewRecipient')?.addEventListener('change',renderCampaignComposePreview);
  ['campaignComposeSubject','campaignComposePlainBody','campaignComposeHtmlBody'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    el.addEventListener('input',renderCampaignComposePreview);
    el.addEventListener('focus',()=>{if(id!=='campaignComposeSubject')campaignComposeLastFocusedEditor=id;});
  });
  document.querySelectorAll('[data-compose-mode]').forEach(button=>button.addEventListener('click',()=>switchComposeMode(button.dataset.composeMode)));
  document.getElementById('campaignPersonalizationToolbar')?.addEventListener('click',event=>{const b=event.target.closest('[data-insert-variable]');if(b)insertComposeVariable(b.dataset.insertVariable);});
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
          member.contactId,
          member.preDeliveryCheckStatus,
          member.preDeliveryCheckMessage
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
      false;

    setText(
      'campaignMembersCampaignName',
      'Campaign Members'
    );

    const meta =
      document.getElementById(
        'campaignMembersCampaignMeta'
      );

    if (meta) {
      meta.textContent =
        'Select a campaign to manage membership.';
    }

    setText('campaignMembersTotalCount', '0');
    setText('campaignMembersActiveCount', '0');
    setText('campaignMembersInactiveCount', '0');
    setText('campaignMembersShowingCount', '0');

    const tbody =
      document.getElementById(
        'campaignMembersTable'
      );

    if (tbody) {
      tbody.innerHTML =
        emptyRow(
          5,
          'Select a campaign to view its members.'
        );
    }

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

  const activeCount =
    allMembers.filter(
      member =>
        getCampaignMemberStatus(
          member
        ) ===
        'ACTIVE'
    ).length;

  const inactiveCount =
    allMembers.filter(
      member =>
        getCampaignMemberStatus(
          member
        ) ===
        'INACTIVE'
    ).length;

  setText(
    'campaignMembersTotalCount',
    allMembers.length.toLocaleString()
  );

  setText(
    'campaignMembersActiveCount',
    activeCount.toLocaleString()
  );

  setText(
    'campaignMembersInactiveCount',
    inactiveCount.toLocaleString()
  );

  setText(
    'campaignMembersShowingCount',
    rows.length.toLocaleString()
  );

  const showingWrap =
    document.getElementById(
      'campaignMembersShowingWrap'
    );

  if (showingWrap) {
    showingWrap.hidden =
      rows.length ===
      allMembers.length;
  }

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
        5,
        'No members match the current filters.'
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

          const precheckStatus =
            String(
              member.preDeliveryCheckStatus ||
              ''
            ).trim();

          const memberId =
            escapeHtml(
              member.campaignMemberId ||
              ''
            );

          return `
            <tr>

              <td class="user-name-cell">
                <strong>${escapeHtml(firstName)}</strong>
                ${
                  company
                    ? `<small>${escapeHtml(company)}</small>`
                    : ''
                }
              </td>

              <td>${escapeHtml(emailAddress)}</td>

              <td>${statusBadge(memberStatus)}</td>

              <td>
                ${
                  precheckStatus
                    ? statusBadge(precheckStatus)
                    : '<span class="status-badge badge-muted">Not Checked</span>'
                }
              </td>

              <td class="actions-column">

                <div class="row-menu">

                  <button
                    type="button"
                    class="row-menu-trigger"
                    data-member-menu-toggle="${memberId}"
                    aria-label="Open member actions"
                    aria-expanded="false"
                  >
                    •••
                  </button>

                  <div
                    class="row-menu-panel"
                    data-member-menu="${memberId}"
                    hidden
                  >

                    ${
                      memberStatus === 'ACTIVE'
                        ? `
                          <button
                            type="button"
                            class="row-menu-item"
                            data-campaign-member-precheck="${memberId}"
                          >
                            Run pre-check
                          </button>
                        `
                        : ''
                    }

                    <button
                      type="button"
                      class="row-menu-item ${memberStatus === 'ACTIVE' ? 'danger' : ''}"
                      data-campaign-member-status="${memberId}"
                      data-next-member-status="${nextStatus}"
                    >
                      ${actionLabel}
                    </button>

                  </div>

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
      'Members can only be added or reactivated while the campaign is Running.',
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



async function runCampaignMemberPrecheck(
  campaignMemberId
) {

  const campaign =
    getSelectedCampaignForMembers();


  if (!campaign) {

    showCampaignMembersNotice(
      'Select a campaign first.',
      'error'
    );

    return;
  }


  const member =
    getCampaignMembersForSelectedCampaign()
      .find(
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


  if (
    getCampaignMemberStatus(
      member
    ) !==
    'ACTIVE'
  ) {

    showCampaignMembersNotice(
      'Pre-check can only be run for ACTIVE Campaign Members.',
      'error'
    );

    return;
  }


  const user =
    getCampaignMemberUser(
      member
    );


  const identity =
    user?.emailAddress ||
    member.emailAddress ||
    campaignMemberId;


  try {

    showCampaignMembersNotice(
      `Running pre-check for ${identity}…`,
      'warning'
    );


    const result =
      await DashboardApi.runPrecheckCampaignMember(
        campaign.campaignId,
        campaignMemberId
      );


    const campaignId =
      campaign.campaignId;


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
      result?.result ||
      `Pre-check completed for ${identity}.`,
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


async function runCampaignPrecheck() {

  const campaign =
    getSelectedCampaignForMembers();


  if (!campaign) {

    showCampaignMembersNotice(
      'Select a campaign first.',
      'error'
    );

    return;
  }


  const campaignStatus =
    String(
      campaign.campaignStatus ||
      campaign.status ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    ![
      'ACTIVE',
      'RUNNING'
    ].includes(
      campaignStatus
    )
  ) {

    showCampaignMembersNotice(
      'Campaign pre-check can only run while the campaign is Running.',
      'error'
    );

    return;
  }


  const activeMembers =
    getCampaignMembersForSelectedCampaign()
      .filter(
        member =>
          getCampaignMemberStatus(
            member
          ) ===
          'ACTIVE'
      );


  if (!activeMembers.length) {

    showCampaignMembersNotice(
      'No ACTIVE Campaign Members found.',
      'error'
    );

    return;
  }


  if (
    !window.confirm(
      `Run pre-check for all ${activeMembers.length} ACTIVE member(s) in ${campaign.campaignName || campaign.campaignId}?`
    )
  ) {

    return;
  }


  const button =
    document.getElementById(
      'runCampaignPrecheckButton'
    );


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        'Running Pre-check…';
    }


    showCampaignMembersNotice(
      `Running pre-check for ${activeMembers.length} ACTIVE member(s)…`,
      'warning'
    );


    const result =
      await DashboardApi.runPrecheckCampaign(
        campaign.campaignId
      );


    const campaignId =
      campaign.campaignId;


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
      result?.result ||
      'Campaign pre-check completed successfully.',
      'success'
    );


  } catch (error) {

    showCampaignMembersNotice(
      error?.message ||
      String(error),
      'error'
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        'Run Pre-check for All';
    }
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

  switchCampaignModuleTab(
    'all'
  );
}


function closeMemberActionMenus(
  exceptMemberId = ''
) {

  document
    .querySelectorAll(
      '[data-member-menu]'
    )
    .forEach(
      menu => {

        if (
          exceptMemberId &&
          menu.dataset.memberMenu ===
            exceptMemberId
        ) {
          return;
        }

        menu.hidden =
          true;
      }
    );

  document
    .querySelectorAll(
      '[data-member-menu-toggle]'
    )
    .forEach(
      button => {

        if (
          exceptMemberId &&
          button.dataset.memberMenuToggle ===
            exceptMemberId
        ) {
          return;
        }

        button.setAttribute(
          'aria-expanded',
          'false'
        );
      }
    );
}


function toggleMemberActionMenu(
  memberId,
  trigger
) {

  const menu =
    document.querySelector(
      `[data-member-menu="${CSS.escape(memberId)}"]`
    );

  if (!menu) {
    return;
  }

  const willOpen =
    menu.hidden;

  closeMemberActionMenus(
    willOpen
      ? memberId
      : ''
  );

  menu.hidden =
    !willOpen;

  trigger?.setAttribute(
    'aria-expanded',
    willOpen
      ? 'true'
      : 'false'
  );
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

      const menuTrigger =
        event.target.closest(
          '[data-member-menu-toggle]'
        );


      if (menuTrigger) {

        event.stopPropagation();

        toggleMemberActionMenu(
          menuTrigger.dataset.memberMenuToggle,
          menuTrigger
        );

        return;
      }


      const precheckButton =
        event.target.closest(
          '[data-campaign-member-precheck]'
        );


      if (precheckButton) {

        closeMemberActionMenus();

        runCampaignMemberPrecheck(
          precheckButton.dataset.campaignMemberPrecheck
        );

        return;
      }


      const statusButton =
        event.target.closest(
          '[data-campaign-member-status]'
        );


      if (!statusButton) {
        return;
      }


      closeMemberActionMenus();


      setCampaignMemberStatus(
        statusButton.dataset.campaignMemberStatus,
        statusButton.dataset.nextMemberStatus
      );
    }
  );
  document.addEventListener(
    'click',
    event => {

      if (
        !event.target.closest(
          '.row-menu'
        )
      ) {
        closeMemberActionMenus();
      }
    }
  );
}




/* ============================================================
   CONTACT LISTS / SEGMENTS / IMPORT
   ============================================================ */

async function ensureContactAudiencesLoaded(
  force = false
) {

  if (
    contactAudienceState.loading
  ) {
    return;
  }

  if (
    contactAudienceState.loaded &&
    !force
  ) {
    renderContactAudienceViews();
    return;
  }

  contactAudienceState.loading =
    true;

  try {

    const response =
      await DashboardApi
        .getContactAudiences();

    const result =
      response?.result ||
      {};

    contactAudienceState.lists =
      Array.isArray(result.lists)
        ? result.lists
        : [];

    contactAudienceState.listMembers =
      Array.isArray(result.listMembers)
        ? result.listMembers
        : [];

    contactAudienceState.segments =
      Array.isArray(result.segments)
        ? result.segments
        : [];

    contactAudienceState.loaded =
      true;

    if (
      contactAudienceState.selectedListId &&
      !contactAudienceState.lists.some(
        item =>
          item.listId ===
          contactAudienceState.selectedListId
      )
    ) {
      contactAudienceState.selectedListId =
        '';
    }

    if (
      !contactAudienceState.selectedListId &&
      contactAudienceState.lists.length
    ) {
      contactAudienceState.selectedListId =
        contactAudienceState.lists[0].listId;
    }

    renderContactAudienceViews();

  } catch (error) {

    console.error(
      'Contact audience load failed:',
      error
    );

    showUsersNotice(
      error?.message ||
      'Could not load contact lists and segments.',
      'error'
    );

  } finally {

    contactAudienceState.loading =
      false;
  }
}


function renderContactAudienceViews() {
  renderContactLists();
  renderContactListDetail();
  renderContactSegments();
}


function renderContactLists() {

  const container =
    document.getElementById(
      'contactListsNavigation'
    );

  if (!container) {
    return;
  }

  const lists =
    contactAudienceState.lists;

  if (!contactAudienceState.loaded) {
    container.innerHTML =
      '<div class="audience-nav-empty">Open this tab to load lists.</div>';
    return;
  }

  if (!lists.length) {
    container.innerHTML =
      '<div class="audience-nav-empty">No contact lists yet.</div>';
    return;
  }

  container.innerHTML =
    lists
      .map(
        list => {

          const count =
            contactAudienceState.listMembers
              .filter(
                member =>
                  member.listId ===
                  list.listId
              )
              .length;

          const active =
            list.listId ===
            contactAudienceState.selectedListId;

          return `
            <button
              type="button"
              class="audience-nav-item ${active ? 'active' : ''}"
              data-contact-list-select="${escapeHtml(list.listId)}"
            >
              <span>
                <strong>${escapeHtml(list.name || 'Untitled List')}</strong>
                <small>${count.toLocaleString()} member${count === 1 ? '' : 's'}</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          `;
        }
      )
      .join('');
}


function renderContactListDetail() {

  const emptyState =
    document.getElementById(
      'contactListEmptyState'
    );

  const detail =
    document.getElementById(
      'contactListDetail'
    );

  if (
    !emptyState ||
    !detail
  ) {
    return;
  }

  const list =
    contactAudienceState.lists.find(
      item =>
        item.listId ===
        contactAudienceState.selectedListId
    );

  if (!list) {
    emptyState.hidden =
      false;

    detail.hidden =
      true;

    return;
  }

  emptyState.hidden =
    true;

  detail.hidden =
    false;

  setText(
    'contactListDetailName',
    list.name ||
    'Contact List'
  );

  setText(
    'contactListDetailDescription',
    list.description ||
    'Static contact list'
  );

  const data =
    DataEngine.getNormalized();

  const usersById =
    new Map(
      data.users.map(
        user => [
          String(
            user.userId || ''
          ),
          user
        ]
      )
    );

  const memberRows =
    contactAudienceState.listMembers
      .filter(
        member =>
          member.listId ===
          list.listId
      )
      .map(
        member => ({
          member,
          user:
            usersById.get(
              String(
                member.userId || ''
              )
            )
        })
      )
      .filter(
        item =>
          item.user
      );

  const query =
    (
      document.getElementById(
        'contactListMemberSearch'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const filtered =
    memberRows.filter(
      item => {

        if (!query) {
          return true;
        }

        return [
          item.user.firstName,
          item.user.emailAddress,
          item.user.company
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
    );

  setText(
    'contactListMemberCount',
    memberRows.length.toLocaleString()
  );

  const select =
    document.getElementById(
      'contactListAddUserSelect'
    );

  if (select) {

    const existingIds =
      new Set(
        memberRows.map(
          item =>
            String(
              item.user.userId || ''
            )
        )
      );

    const eligible =
      data.users
        .filter(
          user =>
            user.userId &&
            !existingIds.has(
              String(
                user.userId
              )
            )
        )
        .sort(
          (a, b) =>
            String(
              a.emailAddress || ''
            ).localeCompare(
              String(
                b.emailAddress || ''
              )
            )
        );

    select.innerHTML =
      '<option value="">Select contact to add</option>' +
      eligible
        .map(
          user => `
            <option value="${escapeHtml(user.userId)}">
              ${escapeHtml(user.firstName || user.emailAddress || user.userId)} — ${escapeHtml(user.emailAddress || '')}
            </option>
          `
        )
        .join('');
  }

  const tbody =
    document.getElementById(
      'contactListMembersTable'
    );

  if (!tbody) {
    return;
  }

  if (!filtered.length) {

    tbody.innerHTML =
      emptyRow(
        5,
        memberRows.length
          ? 'No list members match this search.'
          : 'This list has no contacts yet.'
      );

    return;
  }

  tbody.innerHTML =
    filtered
      .map(
        item => `
          <tr>
            <td>
              <button
                type="button"
                class="contact-name-button"
                data-user-view="${escapeHtml(item.user.userId || '')}"
              >
                ${escapeHtml(item.user.firstName || '—')}
              </button>
            </td>
            <td>${escapeHtml(item.user.emailAddress || '—')}</td>
            <td>${escapeHtml(item.user.company || '—')}</td>
            <td>
              ${
                item.user.unsubscribed
                  ? '<span class="status-badge badge-danger">Suppressed</span>'
                  : '<span class="status-badge badge-success">Subscribed</span>'
              }
            </td>
            <td class="actions-column">
              <button
                type="button"
                class="danger-text-button"
                data-contact-list-remove="${escapeHtml(item.user.userId || '')}"
              >
                Remove
              </button>
            </td>
          </tr>
        `
      )
      .join('');
}


function getSegmentMatchingUsers(
  segment
) {

  const data =
    DataEngine.getNormalized();

  const field =
    String(
      segment.field || ''
    ).toLowerCase();

  const operator =
    String(
      segment.operator || 'equals'
    ).toLowerCase();

  const target =
    String(
      segment.value || ''
    )
      .trim()
      .toLowerCase();

  return data.users.filter(
    user => {

      let value =
        '';

      if (
        field ===
        'leadstatus'
      ) {
        value =
          user.leadStatus ||
          'New';
      } else if (
        field ===
        'company'
      ) {
        value =
          user.company ||
          '';
      } else if (
        field ===
        'subscription'
      ) {
        value =
          user.unsubscribed
            ? 'Suppressed'
            : 'Subscribed';
      }

      const normalized =
        String(
          value || ''
        )
          .trim()
          .toLowerCase();

      if (
        operator ===
        'contains'
      ) {
        return normalized.includes(
          target
        );
      }

      if (
        operator ===
        'not_equals'
      ) {
        return normalized !==
          target;
      }

      return normalized ===
        target;
    }
  );
}


function segmentRuleLabel(
  segment
) {

  const fieldLabels = {
    leadstatus:
      'Lead Status',
    company:
      'Company',
    subscription:
      'Subscription'
  };

  const operatorLabels = {
    equals:
      'equals',
    contains:
      'contains',
    not_equals:
      'does not equal'
  };

  return `${
    fieldLabels[
      String(
        segment.field || ''
      ).toLowerCase()
    ] ||
    segment.field
  } ${
    operatorLabels[
      String(
        segment.operator || ''
      ).toLowerCase()
    ] ||
    segment.operator
  } "${segment.value || ''}"`;
}


function renderContactSegments() {

  const grid =
    document.getElementById(
      'contactSegmentsGrid'
    );

  if (!grid) {
    return;
  }

  if (
    !contactAudienceState.loaded
  ) {
    grid.innerHTML =
      '<div class="audience-empty-state full-span"><strong>Open this tab to load segments.</strong></div>';
    return;
  }

  const segments =
    contactAudienceState.segments;

  if (!segments.length) {

    grid.innerHTML =
      `
        <div class="audience-empty-state full-span">
          <strong>No dynamic segments yet</strong>
          <span>Create a saved rule such as Lead Status equals Interested.</span>
        </div>
      `;

    return;
  }

  grid.innerHTML =
    segments
      .map(
        segment => {

          const matches =
            getSegmentMatchingUsers(
              segment
            );

          return `
            <article class="segment-card">

              <div class="segment-card-top">

                <div>
                  <span class="detail-eyebrow">Dynamic Segment</span>
                  <h3>${escapeHtml(segment.name || 'Untitled Segment')}</h3>
                </div>

                <button
                  type="button"
                  class="danger-text-button"
                  data-contact-segment-delete="${escapeHtml(segment.segmentId || '')}"
                >
                  Delete
                </button>

              </div>

              <div class="segment-rule">
                ${escapeHtml(segmentRuleLabel(segment))}
              </div>

              <div class="segment-card-footer">
                <strong>${matches.length.toLocaleString()}</strong>
                <span>matching contact${matches.length === 1 ? '' : 's'}</span>
              </div>

            </article>
          `;
        }
      )
      .join('');
}


function openContactListModal() {

  const form =
    document.getElementById(
      'contactListForm'
    );

  form?.reset();

  const backdrop =
    document.getElementById(
      'contactListModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      false;
  }
}


function closeContactListModal() {

  const backdrop =
    document.getElementById(
      'contactListModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      true;
  }
}


async function submitContactList(
  event
) {

  event.preventDefault();

  const name =
    document.getElementById(
      'contactListName'
    )?.value
      .trim();

  const description =
    document.getElementById(
      'contactListDescription'
    )?.value
      .trim();

  if (!name) {
    return;
  }

  await withActionButtonBusy(
    'contactListSubmitButton',
    'Creating…',
    async () => {

      try {

        const response =
          await DashboardApi
            .createContactList({
              name,
              description
            });

        closeContactListModal();

        contactAudienceState.selectedListId =
          response?.result?.listId ||
          '';

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Contact list created.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not create the contact list.',
          'error'
        );
      }
    }
  );
}


async function deleteSelectedContactList() {

  const listId =
    contactAudienceState.selectedListId;

  if (!listId) {
    return;
  }

  const list =
    contactAudienceState.lists.find(
      item =>
        item.listId ===
        listId
    );

  const confirmed =
    window.confirm(
      `Delete "${list?.name || 'this contact list'}"? Contacts themselves will not be deleted.`
    );

  if (!confirmed) {
    return;
  }

  await withActionButtonBusy(
    'deleteContactListButton',
    'Deleting…',
    async () => {

      try {

        await DashboardApi
          .deleteContactList(
            listId
          );

        contactAudienceState.selectedListId =
          '';

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Contact list deleted.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not delete the contact list.',
          'error'
        );
      }
    }
  );
}


async function addSelectedContactToList() {

  const listId =
    contactAudienceState.selectedListId;

  const userId =
    document.getElementById(
      'contactListAddUserSelect'
    )?.value ||
    '';

  if (
    !listId ||
    !userId
  ) {
    return;
  }

  await withActionButtonBusy(
    'addContactToListButton',
    'Adding…',
    async () => {

      try {

        await DashboardApi
          .addContactListMember(
            listId,
            userId
          );

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Contact added to the list.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not add the contact to this list.',
          'error'
        );
      }
    }
  );
}


async function removeContactFromSelectedList(
  userId,
  button
) {

  const listId =
    contactAudienceState.selectedListId;

  if (
    !listId ||
    !userId
  ) {
    return;
  }

  await withActionButtonBusy(
    button,
    'Removing…',
    async () => {

      try {

        await DashboardApi
          .removeContactListMember(
            listId,
            userId
          );

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Contact removed from the list.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not remove the contact from this list.',
          'error'
        );
      }
    }
  );
}


function openContactSegmentModal() {

  document
    .getElementById(
      'contactSegmentForm'
    )
    ?.reset();

  const backdrop =
    document.getElementById(
      'contactSegmentModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      false;
  }

  renderContactSegmentRulePreview();
}


function closeContactSegmentModal() {

  const backdrop =
    document.getElementById(
      'contactSegmentModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      true;
  }
}


async function submitContactSegment(
  event
) {

  event.preventDefault();

  const payload = {
    name:
      document.getElementById(
        'contactSegmentName'
      )?.value
        .trim(),
    field:
      document.getElementById(
        'contactSegmentField'
      )?.value ||
      'leadstatus',
    operator:
      document.getElementById(
        'contactSegmentOperator'
      )?.value ||
      'equals',
    value:
      document.getElementById(
        'contactSegmentValue'
      )?.value
        .trim()
  };

  if (
    !payload.name ||
    !payload.value
  ) {
    return;
  }

  await withActionButtonBusy(
    'contactSegmentSubmitButton',
    'Creating…',
    async () => {

      try {

        await DashboardApi
          .createContactSegment(
            payload
          );

        closeContactSegmentModal();

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Dynamic segment created.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not create the segment.',
          'error'
        );
      }
    }
  );
}


async function deleteContactSegment(
  segmentId,
  button
) {

  const segment =
    contactAudienceState.segments.find(
      item =>
        item.segmentId ===
        segmentId
    );

  const confirmed =
    window.confirm(
      `Delete "${segment?.name || 'this segment'}"?`
    );

  if (!confirmed) {
    return;
  }

  await withActionButtonBusy(
    button,
    'Deleting…',
    async () => {

      try {

        await DashboardApi
          .deleteContactSegment(
            segmentId
          );

        await ensureContactAudiencesLoaded(
          true
        );

        showUsersNotice(
          'Segment deleted.',
          'success'
        );

      } catch (error) {

        showUsersNotice(
          error?.message ||
          'Could not delete the segment.',
          'error'
        );
      }
    }
  );
}


/* ============================================================
   CSV IMPORT
   ============================================================ */

function openContactImportModal() {

  parsedContactImportRows =
    [];

  const input =
    document.getElementById(
      'contactImportFile'
    );

  if (input) {
    input.value =
      '';
  }

  const update =
    document.getElementById(
      'contactImportUpdateExisting'
    );

  if (update) {
    update.checked =
      false;
  }

  const summary =
    document.getElementById(
      'contactImportSummary'
    );

  const preview =
    document.getElementById(
      'contactImportPreview'
    );

  const progress =
    document.getElementById(
      'contactImportProgress'
    );

  if (summary) {
    summary.hidden =
      true;
  }

  if (preview) {
    preview.hidden =
      true;
  }

  if (progress) {
    progress.hidden =
      true;
  }

  const start =
    document.getElementById(
      'contactImportStart'
    );

  if (start) {
    start.disabled =
      true;
  }

  const backdrop =
    document.getElementById(
      'contactImportModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      false;
  }
}


function closeContactImportModal() {

  const backdrop =
    document.getElementById(
      'contactImportModalBackdrop'
    );

  if (backdrop) {
    backdrop.hidden =
      true;
  }
}


function parseCsvText(
  text
) {

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text[i];

    const next =
      text[i + 1];

    if (
      char === '"' &&
      quoted &&
      next === '"'
    ) {
      field += '"';
      i++;
      continue;
    }

    if (
      char === '"'
    ) {
      quoted =
        !quoted;
      continue;
    }

    if (
      char === ',' &&
      !quoted
    ) {
      row.push(
        field
      );
      field =
        '';
      continue;
    }

    if (
      (
        char === '\n' ||
        char === '\r'
      ) &&
      !quoted
    ) {

      if (
        char === '\r' &&
        next === '\n'
      ) {
        i++;
      }

      row.push(
        field
      );

      field =
        '';

      if (
        row.some(
          cell =>
            String(
              cell || ''
            ).trim()
        )
      ) {
        rows.push(
          row
        );
      }

      row =
        [];
      continue;
    }

    field +=
      char;
  }

  row.push(
    field
  );

  if (
    row.some(
      cell =>
        String(
          cell || ''
        ).trim()
    )
  ) {
    rows.push(
      row
    );
  }

  return rows;
}


function normalizeImportHeader(
  header
) {

  return String(
    header || ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ''
    );
}


function getImportHeaderIndex(
  headers,
  candidates
) {

  for (
    const candidate of
    candidates
  ) {

    const index =
      headers.indexOf(
        candidate
      );

    if (
      index !==
      -1
    ) {
      return index;
    }
  }

  return -1;
}


async function handleContactImportFile(
  event
) {

  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  try {

    const text =
      await file.text();

    const rows =
      parseCsvText(
        text.replace(
          /^\uFEFF/,
          ''
        )
      );

    if (
      rows.length <
      2
    ) {
      throw new Error(
        'The CSV must contain a header row and at least one contact.'
      );
    }

    const headers =
      rows[0].map(
        normalizeImportHeader
      );

    const emailIndex =
      getImportHeaderIndex(
        headers,
        [
          'email',
          'emailaddress',
          'emailid'
        ]
      );

    if (
      emailIndex ===
      -1
    ) {
      throw new Error(
        'CSV must contain an Email or Email Address column.'
      );
    }

    const firstNameIndex =
      getImportHeaderIndex(
        headers,
        [
          'firstname',
          'first',
          'name'
        ]
      );

    const companyIndex =
      getImportHeaderIndex(
        headers,
        [
          'company',
          'organization',
          'organisation'
        ]
      );

    const leadStatusIndex =
      getImportHeaderIndex(
        headers,
        [
          'leadstatus',
          'status'
        ]
      );

    const seen =
      new Set();

    parsedContactImportRows =
      rows
        .slice(
          1
        )
        .map(
          row => ({
            emailAddress:
              String(
                row[emailIndex] || ''
              )
                .trim()
                .toLowerCase(),
            firstName:
              firstNameIndex >= 0
                ? String(
                    row[firstNameIndex] || ''
                  ).trim()
                : '',
            company:
              companyIndex >= 0
                ? String(
                    row[companyIndex] || ''
                  ).trim()
                : '',
            leadStatus:
              leadStatusIndex >= 0
                ? String(
                    row[leadStatusIndex] || ''
                  ).trim() ||
                  'New'
                : 'New'
          })
        )
        .filter(
          row => {

            if (
              !row.emailAddress ||
              !row.emailAddress.includes(
                '@'
              )
            ) {
              return false;
            }

            if (
              seen.has(
                row.emailAddress
              )
            ) {
              return false;
            }

            seen.add(
              row.emailAddress
            );

            return true;
          }
        );

    const summary =
      document.getElementById(
        'contactImportSummary'
      );

    if (summary) {
      summary.hidden =
        false;

      summary.innerHTML =
        `<strong>${parsedContactImportRows.length.toLocaleString()}</strong> valid unique contact${parsedContactImportRows.length === 1 ? '' : 's'} ready to import.`;
    }

    const preview =
      document.getElementById(
        'contactImportPreview'
      );

    if (preview) {

      const previewRows =
        parsedContactImportRows
          .slice(
            0,
            5
          );

      preview.hidden =
        false;

      preview.innerHTML =
        `
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Lead Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                previewRows
                  .map(
                    row => `
                      <tr>
                        <td>${escapeHtml(row.firstName || '—')}</td>
                        <td>${escapeHtml(row.emailAddress)}</td>
                        <td>${escapeHtml(row.company || '—')}</td>
                        <td>${escapeHtml(row.leadStatus || 'New')}</td>
                      </tr>
                    `
                  )
                  .join('')
              }
            </tbody>
          </table>
          ${
            parsedContactImportRows.length > 5
              ? `<div class="import-preview-note">Previewing 5 of ${parsedContactImportRows.length.toLocaleString()} contacts.</div>`
              : ''
          }
        `;
    }

    const start =
      document.getElementById(
        'contactImportStart'
      );

    if (start) {
      start.disabled =
        !parsedContactImportRows.length;
    }

  } catch (error) {

    parsedContactImportRows =
      [];

    const start =
      document.getElementById(
        'contactImportStart'
      );

    if (start) {
      start.disabled =
        true;
    }

    const progress =
      document.getElementById(
        'contactImportProgress'
      );

    if (progress) {
      progress.hidden =
        false;

      progress.className =
        'dashboard-notice error';

      progress.textContent =
        error?.message ||
        'Could not read the CSV file.';
    }
  }
}


async function runContactImport() {

  if (
    !parsedContactImportRows.length
  ) {
    return;
  }

  const updateExisting =
    Boolean(
      document.getElementById(
        'contactImportUpdateExisting'
      )?.checked
    );

  const progress =
    document.getElementById(
      'contactImportProgress'
    );

  const start =
    document.getElementById(
      'contactImportStart'
    );

  setActionButtonBusy(
    start,
    true,
    'Importing…'
  );

  const data =
    DataEngine.getNormalized();

  const existingByEmail =
    new Map(
      data.users
        .filter(
          user =>
            user.emailAddress
        )
        .map(
          user => [
            String(
              user.emailAddress
            )
              .trim()
              .toLowerCase(),
            user
          ]
        )
    );

  let created =
    0;

  let updated =
    0;

  let skipped =
    0;

  let failed =
    0;

  for (
    let index = 0;
    index < parsedContactImportRows.length;
    index++
  ) {

    const row =
      parsedContactImportRows[index];

    if (progress) {

      progress.hidden =
        false;

      progress.className =
        'dashboard-notice warning';

      progress.textContent =
        `Importing ${index + 1} of ${parsedContactImportRows.length}…`;
    }

    try {

      const existing =
        existingByEmail.get(
          row.emailAddress
        );

      if (existing) {

        if (
          !updateExisting
        ) {
          skipped++;
          continue;
        }

        await DashboardApi
          .updateUser({
            userId:
              existing.userId,
            firstName:
              row.firstName ||
              existing.firstName ||
              '',
            company:
              row.company ||
              existing.company ||
              '',
            leadStatus:
              row.leadStatus ||
              existing.leadStatus ||
              'New'
          });

        updated++;

      } else {

        const response =
          await DashboardApi
            .createUser({
              firstName:
                row.firstName,
              emailAddress:
                row.emailAddress,
              company:
                row.company,
              leadStatus:
                row.leadStatus ||
                'New'
            });

        created++;

        if (
          response?.result?.userId
        ) {
          existingByEmail.set(
            row.emailAddress,
            {
              userId:
                response.result.userId,
              ...row
            }
          );
        }
      }

    } catch (error) {

      console.error(
        'Contact import row failed:',
        row.emailAddress,
        error
      );

      failed++;
    }
  }

  await initDashboard(
    true
  );

  if (progress) {

    progress.hidden =
      false;

    progress.className =
      failed
        ? 'dashboard-notice warning'
        : 'dashboard-notice success';

    progress.textContent =
      `${created} created • ${updated} updated • ${skipped} skipped • ${failed} failed`;
  }

  parsedContactImportRows =
    [];

  setActionButtonBusy(
    start,
    false
  );

  setTimeout(
    () => {
      closeContactImportModal();
    },
    failed
      ? 2500
      : 1100
  );
}


function attachContactAudienceListeners() {

  if (
    contactAudienceListenersAttached
  ) {
    return;
  }

  contactAudienceListenersAttached =
    true;

  document
    .getElementById(
      'importContactsButton'
    )
    ?.addEventListener(
      'click',
      openContactImportModal
    );

  document
    .getElementById(
      'contactImportModalClose'
    )
    ?.addEventListener(
      'click',
      closeContactImportModal
    );

  document
    .getElementById(
      'contactImportCancel'
    )
    ?.addEventListener(
      'click',
      closeContactImportModal
    );

  document
    .getElementById(
      'contactImportFile'
    )
    ?.addEventListener(
      'change',
      handleContactImportFile
    );

  document
    .getElementById(
      'contactImportStart'
    )
    ?.addEventListener(
      'click',
      runContactImport
    );

  document
    .getElementById(
      'createContactListButton'
    )
    ?.addEventListener(
      'click',
      openContactListModal
    );

  document
    .getElementById(
      'contactListModalClose'
    )
    ?.addEventListener(
      'click',
      closeContactListModal
    );

  document
    .getElementById(
      'contactListModalCancel'
    )
    ?.addEventListener(
      'click',
      closeContactListModal
    );

  document
    .getElementById(
      'contactListForm'
    )
    ?.addEventListener(
      'submit',
      submitContactList
    );

  document
    .getElementById(
      'contactListsNavigation'
    )
    ?.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '[data-contact-list-select]'
          );

        if (!button) {
          return;
        }

        contactAudienceState.selectedListId =
          button.dataset.contactListSelect ||
          '';

        renderContactAudienceViews();
      }
    );

  document
    .getElementById(
      'deleteContactListButton'
    )
    ?.addEventListener(
      'click',
      deleteSelectedContactList
    );

  document
    .getElementById(
      'addContactToListButton'
    )
    ?.addEventListener(
      'click',
      addSelectedContactToList
    );

  document
    .getElementById(
      'contactListMemberSearch'
    )
    ?.addEventListener(
      'input',
      renderContactListDetail
    );

  document
    .getElementById(
      'contactListMembersTable'
    )
    ?.addEventListener(
      'click',
      event => {

        const viewButton =
          event.target.closest(
            '[data-user-view]'
          );

        if (viewButton) {
          openContactDetail(
            viewButton.dataset.userView
          );
          return;
        }

        const removeButton =
          event.target.closest(
            '[data-contact-list-remove]'
          );

        if (removeButton) {
          removeContactFromSelectedList(
            removeButton.dataset.contactListRemove,
            removeButton
          );
        }
      }
    );

  document
    .getElementById(
      'createContactSegmentButton'
    )
    ?.addEventListener(
      'click',
      openContactSegmentModal
    );

  document
    .getElementById(
      'contactSegmentModalClose'
    )
    ?.addEventListener(
      'click',
      closeContactSegmentModal
    );

  document
    .getElementById(
      'contactSegmentModalCancel'
    )
    ?.addEventListener(
      'click',
      closeContactSegmentModal
    );

  document
    .getElementById(
      'contactSegmentForm'
    )
    ?.addEventListener(
      'submit',
      submitContactSegment
    );

  [
    'contactSegmentField',
    'contactSegmentOperator',
    'contactSegmentValue'
  ].forEach(
    id => {

      document
        .getElementById(
          id
        )
        ?.addEventListener(
          'input',
          renderContactSegmentRulePreview
        );

      document
        .getElementById(
          id
        )
        ?.addEventListener(
          'change',
          renderContactSegmentRulePreview
        );
    }
  );

  document
    .getElementById(
      'contactSegmentsGrid'
    )
    ?.addEventListener(
      'click',
      event => {

        const deleteButton =
          event.target.closest(
            '[data-contact-segment-delete]'
          );

        if (deleteButton) {
          deleteContactSegment(
            deleteButton.dataset.contactSegmentDelete,
            deleteButton
          );
        }
      }
    );

  [
    'contactImportModalBackdrop',
    'contactListModalBackdrop',
    'contactSegmentModalBackdrop'
  ].forEach(
    id => {

      document
        .getElementById(
          id
        )
        ?.addEventListener(
          'click',
          event => {

            if (
              event.target.id !==
              id
            ) {
              return;
            }

            if (
              id ===
              'contactImportModalBackdrop'
            ) {
              closeContactImportModal();
            } else if (
              id ===
              'contactListModalBackdrop'
            ) {
              closeContactListModal();
            } else {
              closeContactSegmentModal();
            }
          }
        );
    }
  );
}


/* ============================================================
   PROFESSIONAL MODULE TABS
   ============================================================ */

let moduleTabListenersAttached = false;


function switchUserModuleTab(
  tab
) {

  activeUserModuleTab =
    tab || 'all';


  document
    .querySelectorAll(
      '[data-user-tab]'
    )
    .forEach(
      button =>
        button.classList.toggle(
          'active',
          button.dataset.userTab ===
            activeUserModuleTab
        )
    );


  document
    .querySelectorAll(
      '[data-user-panel]'
    )
    .forEach(
      panel => {

        const active =
          panel.dataset.userPanel ===
          activeUserModuleTab;

        panel.hidden =
          !active;

        panel.classList.toggle(
          'active',
          active
        );
      }
    );


  const addButton =
    document.getElementById(
      'addUserButton'
    );

  if (addButton) {

    addButton.hidden =
      activeUserModuleTab !==
      'all';
  }


  const exportButton =
    document.getElementById(
      'exportContactsButton'
    );

  if (exportButton) {
    exportButton.hidden =
      activeUserModuleTab !==
      'all';
  }


  const importButton =
    document.getElementById(
      'importContactsButton'
    );

  if (importButton) {
    importButton.hidden =
      activeUserModuleTab !==
      'all';
  }


  if (
    activeUserModuleTab ===
      'lists' ||
    activeUserModuleTab ===
      'segments'
  ) {
    ensureContactAudiencesLoaded();
  }


  renderUsersManagement();
  renderSubscriptionManagement();
  renderContactAudienceViews();
}


function switchCampaignModuleTab(
  tab
) {

  activeCampaignModuleTab =
    tab || 'all';


  document
    .querySelectorAll(
      '[data-campaign-tab]'
    )
    .forEach(
      button =>
        button.classList.toggle(
          'active',
          button.dataset.campaignTab ===
            activeCampaignModuleTab
        )
    );


  document
    .querySelectorAll(
      '[data-campaign-panel]'
    )
    .forEach(
      panel => {

        const active =
          panel.dataset.campaignPanel ===
          activeCampaignModuleTab;

        panel.hidden =
          !active;

        panel.classList.toggle(
          'active',
          active
        );
      }
    );


  const addButton =
    document.getElementById(
      'addCampaignButton'
    );

  if (addButton) {

    addButton.hidden =
      activeCampaignModuleTab !==
      'all';
  }


  if (
    activeCampaignModuleTab ===
    'members'
  ) {

    ensureCampaignSelectedForMembers();
    renderCampaignMembers();
  }


  if (
    activeCampaignModuleTab ===
    'precheck'
  ) {

    ensureCampaignSelectedForPrecheck();
    renderPrecheckManagement();
  }
}



function getDefaultManagementCampaign() {

  const campaigns =
    DataEngine
      .getNormalized()
      .campaigns || [];

  if (!campaigns.length) {
    return null;
  }

  return (
    campaigns.find(
      campaign => {

        const status =
          String(
            campaign.campaignStatus ||
            campaign.status ||
            ''
          )
            .trim()
            .toUpperCase();

        return (
          status ===
            'ACTIVE' ||
          status ===
            'RUNNING'
        );
      }
    ) ||
    campaigns[0]
  );
}


function ensureCampaignSelectedForMembers() {

  const current =
    getSelectedCampaignForMembers();


  if (current) {

    const select =
      document.getElementById(
        'campaignMembersCampaignSelect'
      );


    if (select) {
      select.value =
        current.campaignId;
    }

    return current;
  }


  const fallback =
    getDefaultManagementCampaign();


  if (!fallback) {
    return null;
  }


  selectedCampaignMembersCampaignId =
    fallback.campaignId;


  const hidden =
    document.getElementById(
      'campaignMembersSelectedCampaignId'
    );


  if (hidden) {
    hidden.value =
      fallback.campaignId;
  }


  const select =
    document.getElementById(
      'campaignMembersCampaignSelect'
    );


  if (select) {
    select.value =
      fallback.campaignId;
  }


  return fallback;
}


function ensureCampaignSelectedForPrecheck() {

  const select =
    document.getElementById(
      'precheckCampaignSelect'
    );


  if (!select) {
    return null;
  }


  if (select.value) {

    return getCampaignById(
      select.value
    );
  }


  const fallback =
    getDefaultManagementCampaign();


  if (!fallback) {
    return null;
  }


  select.value =
    fallback.campaignId;


  return fallback;
}


function populateModuleCampaignSelectors() {

  const campaigns =
    DataEngine
      .getNormalized()
      .campaigns
      .slice()
      .sort(
        (a, b) =>
          String(
            a.campaignName || ''
          ).localeCompare(
            String(
              b.campaignName || ''
            )
          )
      );


  [
    'userCampaignFilter',
    'campaignMembersCampaignSelect',
    'precheckCampaignSelect'
  ].forEach(
    id => {

      const select =
        document.getElementById(
          id
        );

      if (!select) {
        return;
      }


      const current =
        select.value || '';


      select.innerHTML =
        '<option value="">Select campaign</option>' +
        campaigns
          .map(
            campaign =>
              `<option value="${escapeHtml(campaign.campaignId || '')}">${escapeHtml(campaign.campaignName || campaign.campaignId || '')}</option>`
          )
          .join('');


      const exists =
        campaigns.some(
          campaign =>
            String(
              campaign.campaignId || ''
            ) ===
            String(
              current
            )
        );


      select.value =
        exists
          ? current
          : '';
    }
  );


  const memberSelect =
    document.getElementById(
      'campaignMembersCampaignSelect'
    );

  if (
    memberSelect &&
    selectedCampaignMembersCampaignId
  ) {

    const memberCampaignExists =
      campaigns.some(
        campaign =>
          String(
            campaign.campaignId || ''
          ) ===
          String(
            selectedCampaignMembersCampaignId
          )
      );


    if (memberCampaignExists) {
      memberSelect.value =
        selectedCampaignMembersCampaignId;
    }
  }


  if (
    activeCampaignModuleTab ===
    'members'
  ) {
    ensureCampaignSelectedForMembers();
  }


  if (
    activeCampaignModuleTab ===
    'precheck'
  ) {
    ensureCampaignSelectedForPrecheck();
  }
}


function getUserCampaignCount(
  userId
) {

  return DataEngine
    .getNormalized()
    .campaignMembers
    .filter(
      member =>
        String(
          member.userId || ''
        ) ===
        String(
          userId || ''
        ) &&
        getCampaignMemberStatus(
          member
        ) ===
        'ACTIVE'
    )
    .length;
}


function renderUsersByCampaign() {

  const tbody =
    document.getElementById(
      'usersByCampaignTable'
    );


  if (!tbody) {
    return;
  }


  const campaignId =
    document.getElementById(
      'userCampaignFilter'
    )?.value || '';


  const title =
    document.getElementById(
      'usersByCampaignTitle'
    );


  if (!campaignId) {

    if (title) {
      title.textContent =
        'Campaign Contacts';
    }

    tbody.innerHTML =
      emptyRow(
        6,
        'Select a campaign to view its users.'
      );

    return;
  }


  const campaign =
    getCampaignById(
      campaignId
    );


  if (title) {

    title.textContent =
      campaign?.campaignName
        ? `${campaign.campaignName} Contacts`
        : 'Campaign Contacts';
  }


  const query =
    (
      document.getElementById(
        'userCampaignSearchInput'
      )?.value || ''
    )
      .trim()
      .toLowerCase();


  const membershipFilter =
    document.getElementById(
      'userCampaignMembershipFilter'
    )?.value || 'all';


  const data =
    DataEngine.getNormalized();


  const rows =
    data.campaignMembers
      .filter(
        member =>
          String(
            member.campaignId || ''
          ) ===
          String(
            campaignId
          )
      )
      .map(
        member => ({
          member,
          user:
            data.users.find(
              user =>
                String(
                  user.userId || ''
                ) ===
                String(
                  member.userId || ''
                )
            ) || null
        })
      )
      .filter(
        item => {

          const status =
            getCampaignMemberStatus(
              item.member
            );


          if (
            membershipFilter !==
              'all' &&
            status !==
              membershipFilter
          ) {

            return false;
          }


          if (!query) {
            return true;
          }


          return [
            item.user?.firstName,
            item.user?.emailAddress,
            item.user?.company,
            item.member.emailAddress
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
      );


  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        6,
        'No users match the selected campaign and filters.'
      );

    return;
  }


  tbody.innerHTML =
    rows
      .map(
        item => {

          const user =
            item.user || {};

          const member =
            item.member;

          return `
            <tr>
              <td class="user-name-cell">
                <strong>${escapeHtml(user.firstName || '—')}</strong>
                <small>${escapeHtml(user.company || '')}</small>
              </td>
              <td>${escapeHtml(user.emailAddress || member.emailAddress || '—')}</td>
              <td>${escapeHtml(user.company || '—')}</td>
              <td>${statusBadge(getCampaignMemberStatus(member))}</td>
              <td>${user.unsubscribed
                ? '<span class="status-badge badge-danger">Unsubscribed</span>'
                : '<span class="status-badge badge-success">Subscribed</span>'}</td>
              <td>${statusBadge(user.leadStatus || 'New')}</td>
            </tr>
          `;
        }
      )
      .join('');
}


function renderSubscriptionManagement() {

  const tbody =
    document.getElementById(
      'subscriptionManagementTable'
    );

  if (!tbody) {
    return;
  }

  const data =
    DataEngine.getNormalized();

  const query =
    (
      document.getElementById(
        'subscriptionSearchInput'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const allUsers =
    data.users;

  const suppressed =
    allUsers
      .filter(
        user =>
          Boolean(
            user.unsubscribed
          )
      );

  const rows =
    suppressed
      .filter(
        user => {

          if (!query) {
            return true;
          }

          return [
            user.firstName,
            user.emailAddress,
            user.company
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
        (a, b) =>
          String(
            a.emailAddress || ''
          ).localeCompare(
            String(
              b.emailAddress || ''
            )
          )
      );

  setText(
    'subscriptionSubscribedCount',
    allUsers
      .filter(
        user =>
          !user.unsubscribed
      )
      .length
      .toLocaleString()
  );

  setText(
    'subscriptionUnsubscribedCount',
    suppressed.length.toLocaleString()
  );

  setText(
    'subscriptionShowingCount',
    rows.length.toLocaleString()
  );

  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        6,
        query
          ? 'No suppressed contacts match this search.'
          : 'No contacts are currently suppressed.'
      );

    return;
  }

  tbody.innerHTML =
    rows
      .map(
        user => `
          <tr>
            <td class="user-name-cell">
              <button
                type="button"
                class="contact-name-button"
                data-user-view="${escapeHtml(user.userId || '')}"
              >
                ${escapeHtml(user.firstName || '—')}
              </button>
            </td>
            <td>${escapeHtml(user.emailAddress || '—')}</td>
            <td>${escapeHtml(user.company || '—')}</td>
            <td>${getUserCampaignCount(user.userId).toLocaleString()}</td>
            <td><span class="status-badge badge-danger">Unsubscribed</span></td>
            <td class="actions-column">
              <button
                type="button"
                class="secondary-action-button compact-row-button"
                data-user-unsubscribe="${escapeHtml(user.userId)}"
                data-next-state="N"
              >
                Resubscribe
              </button>
            </td>
          </tr>
        `
      )
      .join('');
}


function getPrecheckDisplayStatus(
  member
) {

  const value =
    String(
      member.preDeliveryCheckStatus ||
      ''
    )
      .trim()
      .toUpperCase();


  return value ||
    'NOT_CHECKED';
}


function showPrecheckNotice(
  message,
  type = 'success'
) {

  const notice =
    document.getElementById(
      'precheckActionNotice'
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


function renderPrecheckManagement() {

  const tbody =
    document.getElementById(
      'precheckResultsTable'
    );


  if (!tbody) {
    return;
  }


  const campaignId =
    document.getElementById(
      'precheckCampaignSelect'
    )?.value || '';


  if (!campaignId) {

    setText(
      'precheckValidCount',
      '0'
    );

    setText(
      'precheckRiskyCount',
      '0'
    );

    setText(
      'precheckBlockedCount',
      '0'
    );

    setText(
      'precheckNotCheckedCount',
      '0'
    );

    tbody.innerHTML =
      emptyRow(
        7,
        'Select a campaign to review pre-check results.'
      );

    return;
  }


  const query =
    (
      document.getElementById(
        'precheckSearchInput'
      )?.value || ''
    )
      .trim()
      .toLowerCase();


  const filter =
    document.getElementById(
      'precheckStatusFilter'
    )?.value || 'all';


  const data =
    DataEngine.getNormalized();


  const allRows =
    data.campaignMembers
      .filter(
        member =>
          String(
            member.campaignId || ''
          ) ===
          String(
            campaignId
          ) &&
          getCampaignMemberStatus(
            member
          ) ===
          'ACTIVE'
      )
      .map(
        member => ({
          member,
          user:
            data.users.find(
              user =>
                String(
                  user.userId || ''
                ) ===
                String(
                  member.userId || ''
                )
            ) || null
        })
      );


  const valid =
    allRows.filter(
      item =>
        getPrecheckDisplayStatus(
          item.member
        ) ===
        'VALID'
    ).length;


  const risky =
    allRows.filter(
      item =>
        getPrecheckDisplayStatus(
          item.member
        ) ===
        'RISKY'
    ).length;


  const notChecked =
    allRows.filter(
      item =>
        getPrecheckDisplayStatus(
          item.member
        ) ===
        'NOT_CHECKED'
    ).length;


  const blocked =
    allRows.length -
    valid -
    risky -
    notChecked;


  setText(
    'precheckValidCount',
    valid.toLocaleString()
  );

  setText(
    'precheckRiskyCount',
    risky.toLocaleString()
  );

  setText(
    'precheckBlockedCount',
    blocked.toLocaleString()
  );

  setText(
    'precheckNotCheckedCount',
    notChecked.toLocaleString()
  );


  const rows =
    allRows.filter(
      item => {

        const status =
          getPrecheckDisplayStatus(
            item.member
          );


        if (
          filter !==
            'all' &&
          status !==
            filter
        ) {

          return false;
        }


        if (!query) {
          return true;
        }


        return [
          item.user?.firstName,
          item.user?.emailAddress,
          item.member.emailAddress
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
    );


  if (!rows.length) {

    tbody.innerHTML =
      emptyRow(
        7,
        'No members match the pre-check filters.'
      );

    return;
  }


  const campaign =
    getCampaignById(
      campaignId
    );


  tbody.innerHTML =
    rows
      .map(
        item => {

          const member =
            item.member;

          const user =
            item.user || {};

          const status =
            getPrecheckDisplayStatus(
              member
            );

          return `
            <tr>
              <td class="user-name-cell">
                <strong>${escapeHtml(user.firstName || '—')}</strong>
                <small>${escapeHtml(user.company || '')}</small>
              </td>
              <td>${escapeHtml(user.emailAddress || member.emailAddress || '—')}</td>
              <td>${escapeHtml(campaign?.campaignName || member.campaignName || '—')}</td>
              <td>${
                status === 'NOT_CHECKED'
                  ? '<span class="status-badge badge-muted">Not Checked</span>'
                  : statusBadge(status)
              }</td>
              <td>
                <span class="precheck-message-cell" title="${escapeHtml(member.preDeliveryCheckMessage || '')}">
                  ${escapeHtml(member.preDeliveryCheckMessage || '—')}
                </span>
              </td>
              <td>${escapeHtml(formatCampaignDate(member.preDeliveryCheckAt))}</td>
              <td>
                <button
                  type="button"
                  class="table-action-button"
                  data-precheck-member="${escapeHtml(member.campaignMemberId || '')}"
                >
                  Run Check
                </button>
              </td>
            </tr>
          `;
        }
      )
      .join('');
}


async function runPrecheckModuleMember(
  campaignMemberId
) {

  const campaignId =
    document.getElementById(
      'precheckCampaignSelect'
    )?.value || '';


  if (
    !campaignId ||
    !campaignMemberId
  ) {

    showPrecheckNotice(
      'Select a campaign and campaign member first.',
      'error'
    );

    return;
  }


  try {

    showPrecheckNotice(
      'Running mailbox pre-check…',
      'warning'
    );


    const result =
      await DashboardApi.runPrecheckCampaignMember(
        campaignId,
        campaignMemberId
      );


    await initDashboard(
      true
    );


    const select =
      document.getElementById(
        'precheckCampaignSelect'
      );


    if (select) {
      select.value =
        campaignId;
    }


    switchView(
      'campaignsView'
    );

    switchCampaignModuleTab(
      'precheck'
    );

    renderPrecheckManagement();


    showPrecheckNotice(
      result?.result ||
      'Pre-check completed successfully.',
      'success'
    );


  } catch (error) {

    showPrecheckNotice(
      error?.message ||
      String(error),
      'error'
    );
  }
}


async function runPrecheckModuleCampaign() {

  const campaignId =
    document.getElementById(
      'precheckCampaignSelect'
    )?.value || '';


  if (!campaignId) {

    showPrecheckNotice(
      'Select a campaign first.',
      'error'
    );

    return;
  }


  const campaign =
    getCampaignById(
      campaignId
    );


  if (
    String(
      campaign?.campaignStatus ||
      campaign?.status ||
      ''
    )
      .toUpperCase() !==
      'ACTIVE'
  ) {

    showPrecheckNotice(
      'Campaign must be Running before running pre-check.',
      'error'
    );

    return;
  }


  const activeCount =
    DataEngine
      .getNormalized()
      .campaignMembers
      .filter(
        member =>
          String(
            member.campaignId || ''
          ) ===
          String(
            campaignId
          ) &&
          getCampaignMemberStatus(
            member
          ) ===
          'ACTIVE'
      )
      .length;


  if (!activeCount) {

    showPrecheckNotice(
      'No ACTIVE Campaign Members found.',
      'error'
    );

    return;
  }


  if (
    !window.confirm(
      `Run pre-check for all ${activeCount} ACTIVE member(s) in ${campaign?.campaignName || campaignId}?`
    )
  ) {

    return;
  }


  const button =
    document.getElementById(
      'precheckRunAllButton'
    );


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        'Running…';
    }


    showPrecheckNotice(
      `Running pre-check for ${activeCount} ACTIVE member(s)…`,
      'warning'
    );


    const result =
      await DashboardApi.runPrecheckCampaign(
        campaignId
      );


    await initDashboard(
      true
    );


    const select =
      document.getElementById(
        'precheckCampaignSelect'
      );


    if (select) {
      select.value =
        campaignId;
    }


    switchView(
      'campaignsView'
    );

    switchCampaignModuleTab(
      'precheck'
    );

    renderPrecheckManagement();


    showPrecheckNotice(
      result?.result ||
      'Campaign pre-check completed successfully.',
      'success'
    );


  } catch (error) {

    showPrecheckNotice(
      error?.message ||
      String(error),
      'error'
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        'Run Pre-check for All';
    }
  }
}


function attachModuleTabListeners() {

  if (
    moduleTabListenersAttached
  ) {

    return;
  }


  moduleTabListenersAttached =
    true;


  document
    .querySelectorAll(
      '[data-user-tab]'
    )
    .forEach(
      button =>
        button.addEventListener(
          'click',
          () =>
            switchUserModuleTab(
              button.dataset.userTab
            )
        )
    );


  document
    .querySelectorAll(
      '[data-campaign-tab]'
    )
    .forEach(
      button =>
        button.addEventListener(
          'click',
          () =>
            switchCampaignModuleTab(
              button.dataset.campaignTab
            )
        )
    );


  document.getElementById(
    'userCampaignFilter'
  )?.addEventListener(
    'change',
    renderUsersByCampaign
  );


  document.getElementById(
    'userCampaignSearchInput'
  )?.addEventListener(
    'input',
    renderUsersByCampaign
  );


  document.getElementById(
    'userCampaignMembershipFilter'
  )?.addEventListener(
    'change',
    renderUsersByCampaign
  );


  document.getElementById(
    'subscriptionSearchInput'
  )?.addEventListener(
    'input',
    renderSubscriptionManagement
  );


  document.getElementById(
    'subscriptionStateFilter'
  )?.addEventListener(
    'change',
    renderSubscriptionManagement
  );

  document.getElementById(
    'subscriptionManagementTable'
  )?.addEventListener(
    'click',
    event => {

      const viewButton =
        event.target.closest(
          '[data-user-view]'
        );

      if (viewButton) {
        openContactDetail(
          viewButton.dataset.userView
        );
        return;
      }

      const unsubButton =
        event.target.closest(
          '[data-user-unsubscribe]'
        );

      if (unsubButton) {
        toggleUserSubscription(
          unsubButton.dataset.userUnsubscribe,
          unsubButton.dataset.nextState
        );
      }
    }
  );


  document.getElementById(
    'campaignMembersCampaignSelect'
  )?.addEventListener(
    'change',
    event => {

      selectedCampaignMembersCampaignId =
        event.target.value || '';


      const hidden =
        document.getElementById(
          'campaignMembersSelectedCampaignId'
        );


      if (hidden) {

        hidden.value =
          selectedCampaignMembersCampaignId;
      }


      renderCampaignMembers();
    }
  );


  document.getElementById(
    'precheckCampaignSelect'
  )?.addEventListener(
    'change',
    renderPrecheckManagement
  );


  document.getElementById(
    'precheckSearchInput'
  )?.addEventListener(
    'input',
    renderPrecheckManagement
  );


  document.getElementById(
    'precheckStatusFilter'
  )?.addEventListener(
    'change',
    renderPrecheckManagement
  );


  document.getElementById(
    'precheckRunAllButton'
  )?.addEventListener(
    'click',
    runPrecheckModuleCampaign
  );


  document.getElementById(
    'precheckResultsTable'
  )?.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-precheck-member]'
        );


      if (!button) {
        return;
      }


      runPrecheckModuleMember(
        button.dataset.precheckMember
      );
    }
  );


  document.getElementById(
    'subscriptionManagementTable'
  )?.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-user-unsubscribe]'
        );


      if (!button) {
        return;
      }


      setUserUnsubscribed(
        button.dataset.userUnsubscribe,
        button.dataset.nextState ===
          'Y'
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