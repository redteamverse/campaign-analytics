/** CAMPAIGN ANALYTICS - UI CONTROLLER */
document.addEventListener('DOMContentLoaded', initDashboard);

const FILTER_IDS = ['campaignFilter', 'sequenceFilter', 'versionFilter', 'segmentFilter'];
let listenersAttached = false;
let activeUserModuleTab = 'all';
let activeCampaignModuleTab = 'all';

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
        unsubButton.dataset.nextState
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
        6,
        'No campaigns match the current search or filters.'
      );

    return;
  }


  tbody.innerHTML =
    rows
      .slice(0, 1000)
      .map(campaign => {

        const campaignId =
          String(campaign.campaignId || '');

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
          Number(campaign.totalContacts || 0);

        const totalEmailEvents =
          Number(campaign.totalEmailEvents || 0);

        return `
          <tr>
            <td class="user-name-cell">
              <strong>${escapeHtml(campaignName)}</strong>
              <small>${escapeHtml(campaignId)}</small>
            </td>
            <td>${statusBadge(campaignStatus)}</td>
            <td>${totalContacts.toLocaleString()}</td>
            <td>${totalEmailEvents.toLocaleString()}</td>
            <td>${escapeHtml(formatCampaignDate(campaign.updatedAt))}</td>
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
                  Members
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
    campaignStatus !==
    'ACTIVE'
  ) {

    showCampaignMembersNotice(
      'Campaign pre-check can only run while the campaign is ACTIVE.',
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


  renderUsersManagement();
  renderUsersByCampaign();
  renderSubscriptionManagement();
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
      campaign =>
        String(
          campaign.campaignStatus ||
          campaign.status ||
          ''
        )
          .trim()
          .toUpperCase() ===
        'ACTIVE'
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
      'Campaign must be ACTIVE before running pre-check.',
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