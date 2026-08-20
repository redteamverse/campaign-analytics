/**
 * ============================================================
 * DIRECT UI CONTROLLER & METRIC RENDERER
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

  // 1. Campaign Select
  if (selects[0]) {
    selects[0].innerHTML = '<option value="all">All Campaigns</option>';
    const campaignMap = new Map();
    
    data.campaigns.forEach(c => {
      if (c.campaignId) campaignMap.set(c.campaignId, c.campaignName || c.campaignId);
    });
    data.emailEvents.forEach(e => {
      if (e.campaignId) campaignMap.set(e.campaignId, e.campaignName || e.campaignId);
    });

    campaignMap.forEach((name, id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      selects[0].appendChild(opt);
    });
  }

  // 2. Sequence Select
  if (selects[1]) {
    selects[1].innerHTML = '<option value="all">All Sequences</option>';
    const seqs = [...new Set(data.emailEvents.map(e => e.sequence).filter(Boolean))];
    seqs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Sequence ${s}`;
      selects[1].appendChild(opt);
    });
  }

  // 3. Version Select
  if (selects[2]) {
    selects[2].innerHTML = '<option value="all">All Versions</option>';
    const vers = [...new Set(data.emailEvents.map(e => e.emailVersion).filter(Boolean))];
    vers.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selects[2].appendChild(opt);
    });
  }

  // 4. Segment Select
  if (selects[3]) {
    selects[3].innerHTML = '<option value="all">All Segments</option>';
    const segs = [...new Set(data.emailEvents.map(e => e.targetSegment).filter(Boolean))];
    segs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      selects[3].appendChild(opt);
    });
  }
}

function renderDashboard() {
  const data = DataEngine.getNormalized();
  const selects = document.querySelectorAll('select');

  const selectedCampaign = selects[0] ? selects[0].value : 'all';
  const selectedSeq = selects[1] ? selects[1].value : 'all';
  const selectedVer = selects[2] ? selects[2].value : 'all';
  const selectedSeg = selects[3] ? selects[3].value : 'all';

  // Filter Email Events
  let events = data.emailEvents || [];

  if (selectedCampaign !== 'all') {
    events = events.filter(e => e.campaignId === selectedCampaign || e.campaignName === selectedCampaign);
  }
  if (selectedSeq !== 'all') {
    events = events.filter(e => String(e.sequence) === String(selectedSeq));
  }
  if (selectedVer !== 'all') {
    events = events.filter(e => e.emailVersion === selectedVer);
  }
  if (selectedSeg !== 'all') {
    events = events.filter(e => e.targetSegment === selectedSeg);
  }

  // Calculate Aggregates
  const totalMessages = events.length;
  
  // Collect unique recipients across Users & Events
  const recipients = new Set();
  data.users.forEach(u => { if (u.email || u.contactId) recipients.add(u.email || u.contactId); });
  events.forEach(e => { if (e.emailAddress || e.contactId) recipients.add(e.emailAddress || e.contactId); });
  
  const totalRecipients = recipients.size > 0 ? recipients.size : totalMessages;

  const totalOpened = events.filter(e => {
    const t = DataEngine.getTrackingForEvent(e.emailEventId);
    return e.isOpened || (t && t.isOpened);
  }).length;

  const totalClicked = events.filter(e => {
    const t = DataEngine.getTrackingForEvent(e.emailEventId);
    return e.linkClicked || (t && t.linkClicked);
  }).length;

  const totalReplied = events.filter(e => {
    const t = DataEngine.getTrackingForEvent(e.emailEventId);
    return e.isReplied || (t && t.isReplied);
  }).length;

  const totalUnsub = events.filter(e => {
    const t = DataEngine.getTrackingForEvent(e.emailEventId);
    return e.unsubscribed || (t && t.unsubscribed);
  }).length;

  const openRate = totalMessages > 0 ? ((totalOpened / totalMessages) * 100).toFixed(1) : '0.0';
  const clickRate = totalMessages > 0 ? ((totalClicked / totalMessages) * 100).toFixed(1) : '0.0';
  const replyRate = totalMessages > 0 ? ((totalReplied / totalMessages) * 100).toFixed(1) : '0.0';
  const unsubRate = totalMessages > 0 ? ((totalUnsub / totalMessages) * 100).toFixed(1) : '0.0';

  // Direct DOM Injection by searching card labels
  setCardValue('Recipients', totalRecipients);
  setCardValue('Messages', totalMessages);
  setCardValue('Sent', totalMessages);
  setCardValue('Verified', totalMessages);
  setCardValue('Open Rate', `${openRate}%`);
  setCardValue('Click Rate', `${clickRate}%`);
  setCardValue('Reply Rate', `${replyRate}%`);
  setCardValue('Unsubscribe Rate', `${unsubRate}%`);

  console.log('Dashboard UI updated:', {
    recipients: totalRecipients,
    messages: totalMessages,
    openRate: `${openRate}%`,
    clickRate: `${clickRate}%`
  });
}

function setCardValue(label, value) {
  // Finds every element on the page
  const allNodes = Array.from(document.querySelectorAll('*'));
  const match = allNodes.find(node => {
    return node.children.length === 0 && node.textContent.trim().toLowerCase() === label.toLowerCase();
  });

  if (match) {
    // Find parent container box
    const card = match.closest('div');
    if (card) {
      // Find the large display number within the card container
      const valContainer = Array.from(card.querySelectorAll('*')).find(el => {
        return el !== match && (el.children.length === 0 || el.tagName === 'H2' || el.tagName === 'H3' || el.classList.contains('text-2xl'));
      });

      if (valContainer) {
        valContainer.textContent = value;
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
