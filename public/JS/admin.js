/* NexaCore Admin Dashboard JS */
'use strict';
window.addEventListener('load', () => {
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
});

const API = '/api/admin';
let currentSection = 'overview';

// ── Auth ──────────────────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const r = await fetch(API + '/me', { credentials: 'include' });
    if (!r.ok) throw new Error();
    const d = await r.json();
    document.getElementById('adminEmail').textContent = d.email || 'Admin';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    initDashboard();
  } catch {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const r = await fetch(API + '/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value })
    });
    const d = await r.json();
    if (!d.success) { errEl.textContent = d.message || 'Login failed.'; return; }
    checkAuth();
  } catch { errEl.textContent = 'Network error. Please try again.'; }
  finally { btn.disabled = false; btn.textContent = 'Sign In'; }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(API + '/logout', { method: 'POST', credentials: 'include' });
  location.reload();
});

// ── Init ──────────────────────────────────────────────────────────────────────
function initDashboard() {
  initNav();
  initSidebarToggle();
  updateTime();
  setInterval(updateTime, 60000);
  loadStats();
  loadOverview();
  setupSearch();
}

function updateTime() {
  const el = document.getElementById('topbarTime');
  if (el) el.textContent = new Date().toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (section) showSection(section);
    });
  });
}

function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 900 && !sidebar.contains(e.target) && !toggle.contains(e.target))
        sidebar.classList.remove('open');
    });
  }
}

function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');
  const titles = { overview:'Overview', contacts:'Contact Forms', proposals:'Proposals', schedule:'Schedule Calls', applications:'Job Applications', services:'Services', team:'Team Connects', jobs:'Job Listings', users:'Users' };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  const loaders = { contacts: loadContacts, proposals: loadProposals, schedule: loadSchedule, applications: loadApplications, services: loadServices, team: loadTeam, jobs: loadJobs, users: loadUsers };
  if (loaders[name]) loaders[name]();
}

function setupSearch() {
  let t;
  ['contactSearch','proposalSearch','scheduleSearch','appSearch','userSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const loaders = { contactSearch: loadContacts, proposalSearch: loadProposals, scheduleSearch: loadSchedule, appSearch: loadApplications, userSearch: loadUsers }; if (loaders[id]) loaders[id](); }, 350); });
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const r = await fetch(API + '/stats', { credentials: 'include' });
    const d = await r.json();
    if (!d.success) return;
    const s = d.stats;

    const cards = [
      { label: 'Total Contacts', val: s.contacts, sub: `${s.pendingContacts} pending`, icon: 'fa-envelope', color: '#0057FF', badge: s.pendingContacts, badgeId: 'badge-contacts' },
      { label: 'Proposals', val: s.proposals, sub: `${s.pendingProposals} pending`, icon: 'fa-file-contract', color: '#8B5CF6', badge: s.pendingProposals, badgeId: 'badge-proposals' },
      { label: 'Scheduled Calls', val: s.scheduleCalls, sub: `${s.pendingCalls} pending`, icon: 'fa-calendar-check', color: '#06B6D4', badge: s.pendingCalls, badgeId: 'badge-schedule' },
      { label: 'Applications', val: s.applications, sub: `${s.pendingApps} new`, icon: 'fa-user-tie', color: '#F59E0B', badge: s.pendingApps, badgeId: 'badge-applications' },
      { label: 'Active Jobs', val: s.jobs, sub: 'Open positions', icon: 'fa-briefcase', color: '#10B981' },
      { label: 'Services', val: s.services, sub: `${s.pendingServices} pending`, icon: 'fa-server', color: '#3B82F6' },
      { label: 'Team Connects', val: s.connects, sub: 'Schedule requests', icon: 'fa-headset', color: '#EC4899' },
      { label: 'Users', val: s.users, sub: 'Registered accounts', icon: 'fa-users', color: '#6366F1' }
    ];

    document.getElementById('statsGrid').innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">${c.label}</div>
          <div class="stat-card-icon" style="background:${c.color}18;">
            <i class="fa-solid ${c.icon}" style="color:${c.color};"></i>
          </div>
        </div>
        <div class="stat-card-val">${c.val ?? 0}</div>
        <div class="stat-card-sub">${c.sub || ''}</div>
      </div>`).join('');

    // Update nav badges
    cards.forEach(c => { if (c.badgeId && c.badge) document.getElementById(c.badgeId).textContent = c.badge > 0 ? c.badge : ''; });
  } catch (err) { console.error('Stats error:', err); }
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  await Promise.all([loadRecentContacts(), loadRecentProposals(), loadRecentApplications(), loadRecentCalls()]);
}

async function loadRecentContacts() {
  try {
    const r = await fetch(API + '/contacts?', { credentials: 'include' });
    const d = await r.json();
    const items = (d.contacts || []).slice(0, 4);
    const el = document.getElementById('recentContacts');
    if (!items.length) { el.innerHTML = '<div class="mini-empty">No contacts yet</div>'; return; }
    el.innerHTML = items.map(c => `<div class="mini-item"><div class="mini-item-info"><div class="mini-item-name">${esc(c.name)}</div><div class="mini-item-sub">${esc(c.email)}</div></div>${statusBadge(c.status)}</div>`).join('');
  } catch {}
}

async function loadRecentProposals() {
  try {
    const r = await fetch(API + '/proposals', { credentials: 'include' });
    const d = await r.json();
    const items = (d.proposals || []).slice(0, 4);
    const el = document.getElementById('recentProposals');
    if (!items.length) { el.innerHTML = '<div class="mini-empty">No proposals yet</div>'; return; }
    el.innerHTML = items.map(p => `<div class="mini-item"><div class="mini-item-info"><div class="mini-item-name">${esc(p.companyName)}</div><div class="mini-item-sub">${esc(p.contactName)}</div></div>${statusBadge(p.status)}</div>`).join('');
  } catch {}
}

async function loadRecentApplications() {
  try {
    const r = await fetch(API + '/applications', { credentials: 'include' });
    const d = await r.json();
    const items = (d.applications || []).slice(0, 4);
    const el = document.getElementById('recentApplications');
    if (!items.length) { el.innerHTML = '<div class="mini-empty">No applications yet</div>'; return; }
    el.innerHTML = items.map(a => `<div class="mini-item"><div class="mini-item-info"><div class="mini-item-name">${esc(a.name)}</div><div class="mini-item-sub">${esc(a.jobTitle)}</div></div>${statusBadge(a.status)}</div>`).join('');
  } catch {}
}

async function loadRecentCalls() {
  try {
    const r = await fetch(API + '/schedule-calls', { credentials: 'include' });
    const d = await r.json();
    const items = (d.calls || []).slice(0, 4);
    const el = document.getElementById('recentCalls');
    if (!items.length) { el.innerHTML = '<div class="mini-empty">No calls scheduled</div>'; return; }
    el.innerHTML = items.map(c => `<div class="mini-item"><div class="mini-item-info"><div class="mini-item-name">${esc(c.name)}</div><div class="mini-item-sub">${esc(c.preferredDate || c.email)}</div></div>${statusBadge(c.status)}</div>`).join('');
  } catch {}
}

// ── Contacts ─────────────────────────────────────────────────────────────────
async function loadContacts() {
  const search = document.getElementById('contactSearch')?.value.trim() || '';
  const status = document.getElementById('contactFilter')?.value || '';
  try {
    const r = await fetch(`${API}/contacts?search=${encodeURIComponent(search)}&status=${status}`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('contactsBody');
    if (!d.contacts?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No contacts found</td></tr>`; return; }
    tbody.innerHTML = d.contacts.map(c => `
      <tr>
        <td class="td-name">${esc(c.name)}</td>
        <td class="td-email">${esc(c.email)}</td>
        <td>${esc(c.company || '—')}</td>
        <td class="td-truncate">${esc(c.subject || c.service || '—')}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="td-date">${fmtDate(c.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="View" onclick="viewContact('${c._id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('contacts','${c._id}',loadContacts)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch (err) { console.error(err); }
}

async function viewContact(id) {
  try {
    const r = await fetch(`${API}/contacts`, { credentials: 'include' });
    const d = await r.json();
    const c = d.contacts?.find(x => x._id === id);
    if (!c) return;
    openModal('Contact Details', `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Name</div><div class="detail-value">${esc(c.name)}</div></div>
        <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${esc(c.email)}</div></div>
        <div class="detail-field"><div class="detail-label">Company</div><div class="detail-value">${esc(c.company||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Service</div><div class="detail-value">${esc(c.subject||c.service||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Submitted</div><div class="detail-value">${fmtDate(c.createdAt)}</div></div>
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(c.status)}</div></div>
        <div class="detail-divider"></div>
        <div class="detail-field detail-full"><div class="detail-label">Message</div><div class="detail-value" style="white-space:pre-wrap;">${esc(c.message)}</div></div>
        ${c.notes ? `<div class="detail-field detail-full"><div class="detail-label">Admin Notes</div><div class="detail-value">${esc(c.notes)}</div></div>` : ''}
      </div>`,
      `<div style="flex:1;">
        <div class="modal-status-row">
          <select class="status-select" id="statusSel"><option value="pending" ${c.status==='pending'?'selected':''}>Pending</option><option value="in-progress" ${c.status==='in-progress'?'selected':''}>In Progress</option><option value="completed" ${c.status==='completed'?'selected':''}>Completed</option></select>
          <button class="btn-primary" onclick="updateContactStatus('${c._id}')">Update Status</button>
        </div>
        <textarea class="notes-input" id="notesInput" placeholder="Admin notes…">${esc(c.notes||'')}</textarea>
      </div>`
    );
  } catch {}
}

async function updateContactStatus(id) {
  const status = document.getElementById('statusSel')?.value;
  const notes = document.getElementById('notesInput')?.value;
  try {
    const r = await fetch(`${API}/contacts/${id}/status`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status, notes }) });
    const d = await r.json();
    if (d.success) { toast('Status updated', 'success'); closeModal(); loadContacts(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Proposals ─────────────────────────────────────────────────────────────────
async function loadProposals() {
  const search = document.getElementById('proposalSearch')?.value.trim() || '';
  const status = document.getElementById('proposalFilter')?.value || '';
  try {
    const r = await fetch(`${API}/proposals?search=${encodeURIComponent(search)}&status=${status}`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('proposalsBody');
    if (!d.proposals?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No proposals found</td></tr>`; return; }
    tbody.innerHTML = d.proposals.map(p => `
      <tr>
        <td class="td-name">${esc(p.companyName)}</td>
        <td><div class="td-name">${esc(p.contactName)}</div><div class="td-email">${esc(p.contactEmail)}</div></td>
        <td class="td-truncate">${esc((p.services||[]).join(', ')||'—')}</td>
        <td>${esc(p.budget||'—')}</td>
        <td>${statusBadge(p.priority,'priority')}</td>
        <td>${statusBadge(p.status)}</td>
        <td class="td-date">${fmtDate(p.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="View" onclick="viewProposal('${p._id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('proposals','${p._id}',loadProposals)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch (err) { console.error(err); }
}

async function viewProposal(id) {
  try {
    const r = await fetch(`${API}/proposals`, { credentials: 'include' });
    const d = await r.json();
    const p = d.proposals?.find(x => x._id === id);
    if (!p) return;
    openModal('Proposal Details', `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Company</div><div class="detail-value">${esc(p.companyName)}</div></div>
        <div class="detail-field"><div class="detail-label">Industry</div><div class="detail-value">${esc(p.industry)}</div></div>
        <div class="detail-field"><div class="detail-label">Company Size</div><div class="detail-value">${esc(p.companySize)}</div></div>
        <div class="detail-field"><div class="detail-label">Website</div><div class="detail-value">${p.website?`<a href="${esc(p.website)}" target="_blank" style="color:#60A5FA;">${esc(p.website)}</a>`:'—'}</div></div>
        <div class="detail-divider"></div>
        <div class="detail-field"><div class="detail-label">Contact</div><div class="detail-value">${esc(p.contactName)}</div></div>
        <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${esc(p.contactEmail)}</div></div>
        <div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${esc(p.contactPhone||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Role</div><div class="detail-value">${esc(p.contactRole||'—')}</div></div>
        <div class="detail-divider"></div>
        <div class="detail-field detail-full"><div class="detail-label">Services Required</div><div class="detail-value">${esc((p.services||[]).join(', ')||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Budget</div><div class="detail-value">${esc(p.budget||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Timeline</div><div class="detail-value">${esc(p.timeline||'—')}</div></div>
        <div class="detail-field detail-full"><div class="detail-label">Project Scope</div><div class="detail-value">${esc(p.projectScope)}</div></div>
        <div class="detail-field detail-full"><div class="detail-label">Description</div><div class="detail-value" style="white-space:pre-wrap;">${esc(p.description)}</div></div>
        ${p.currentChallenges?`<div class="detail-field detail-full"><div class="detail-label">Challenges</div><div class="detail-value" style="white-space:pre-wrap;">${esc(p.currentChallenges)}</div></div>`:''}
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(p.status)}</div></div>
        <div class="detail-field"><div class="detail-label">Priority</div><div class="detail-value">${statusBadge(p.priority,'priority')}</div></div>
        <div class="detail-field"><div class="detail-label">Submitted</div><div class="detail-value">${fmtDate(p.createdAt)}</div></div>
        ${p.notes?`<div class="detail-field detail-full"><div class="detail-label">Notes</div><div class="detail-value">${esc(p.notes)}</div></div>`:''}
      </div>`,
      `<div style="flex:1;">
        <div class="modal-status-row">
          <select class="status-select" id="statusSel"><option value="pending" ${p.status==='pending'?'selected':''}>Pending</option><option value="in-progress" ${p.status==='in-progress'?'selected':''}>In Progress</option><option value="completed" ${p.status==='completed'?'selected':''}>Completed</option><option value="declined" ${p.status==='declined'?'selected':''}>Declined</option></select>
          <select class="status-select" id="prioritySel" style="max-width:140px;"><option value="normal" ${p.priority==='normal'?'selected':''}>Normal</option><option value="high" ${p.priority==='high'?'selected':''}>High</option><option value="urgent" ${p.priority==='urgent'?'selected':''}>Urgent</option></select>
          <button class="btn-primary" onclick="updateProposalStatus('${p._id}')">Update</button>
        </div>
        <textarea class="notes-input" id="notesInput" placeholder="Admin notes…">${esc(p.notes||'')}</textarea>
      </div>`
    );
  } catch {}
}

async function updateProposalStatus(id) {
  const status = document.getElementById('statusSel')?.value;
  const priority = document.getElementById('prioritySel')?.value;
  const notes = document.getElementById('notesInput')?.value;
  try {
    const r = await fetch(`${API}/proposals/${id}/status`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status, priority, notes }) });
    const d = await r.json();
    if (d.success) { toast('Updated', 'success'); closeModal(); loadProposals(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Schedule Calls ─────────────────────────────────────────────────────────────
async function loadSchedule() {
  const search = document.getElementById('scheduleSearch')?.value.trim() || '';
  const status = document.getElementById('scheduleFilter')?.value || '';
  try {
    const r = await fetch(`${API}/schedule-calls?search=${encodeURIComponent(search)}&status=${status}`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('scheduleBody');
    if (!d.calls?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No calls scheduled</td></tr>`; return; }
    tbody.innerHTML = d.calls.map(c => `
      <tr>
        <td class="td-name">${esc(c.name)}</td>
        <td class="td-email">${esc(c.email)}</td>
        <td>${esc(c.company||'—')}</td>
        <td>${esc(c.preferredDate||'—')} ${c.preferredTime?'@ '+esc(c.preferredTime):''}</td>
        <td class="td-truncate">${esc(c.topic||'—')}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="td-date">${fmtDate(c.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="View" onclick="viewCall('${c._id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('schedule-calls','${c._id}',loadSchedule)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch {}
}

async function viewCall(id) {
  try {
    const r = await fetch(`${API}/schedule-calls`, { credentials: 'include' });
    const d = await r.json();
    const c = d.calls?.find(x => x._id === id);
    if (!c) return;
    openModal('Schedule Call Details', `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Name</div><div class="detail-value">${esc(c.name)}</div></div>
        <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${esc(c.email)}</div></div>
        <div class="detail-field"><div class="detail-label">Company</div><div class="detail-value">${esc(c.company||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${esc(c.phone||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Preferred Date</div><div class="detail-value">${esc(c.preferredDate||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Preferred Time</div><div class="detail-value">${esc(c.preferredTime||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Timezone</div><div class="detail-value">${esc(c.timezone||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(c.status)}</div></div>
        <div class="detail-field detail-full"><div class="detail-label">Topic</div><div class="detail-value">${esc(c.topic||'—')}</div></div>
        ${c.message?`<div class="detail-field detail-full"><div class="detail-label">Message</div><div class="detail-value" style="white-space:pre-wrap;">${esc(c.message)}</div></div>`:''}
      </div>`,
      `<div style="flex:1;">
        <div class="modal-status-row">
          <select class="status-select" id="statusSel"><option value="pending" ${c.status==='pending'?'selected':''}>Pending</option><option value="confirmed" ${c.status==='confirmed'?'selected':''}>Confirmed</option><option value="completed" ${c.status==='completed'?'selected':''}>Completed</option><option value="cancelled" ${c.status==='cancelled'?'selected':''}>Cancelled</option></select>
          <button class="btn-primary" onclick="updateCallStatus('${c._id}')">Update Status</button>
        </div>
        <textarea class="notes-input" id="notesInput" placeholder="Admin notes…">${esc(c.notes||'')}</textarea>
      </div>`
    );
  } catch {}
}

async function updateCallStatus(id) {
  const status = document.getElementById('statusSel')?.value;
  const notes = document.getElementById('notesInput')?.value;
  try {
    const r = await fetch(`${API}/schedule-calls/${id}/status`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status, notes }) });
    const d = await r.json();
    if (d.success) { toast('Status updated', 'success'); closeModal(); loadSchedule(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Applications ───────────────────────────────────────────────────────────────
async function loadApplications() {
  const search = document.getElementById('appSearch')?.value.trim() || '';
  const status = document.getElementById('appFilter')?.value || '';
  try {
    const r = await fetch(`${API}/applications?search=${encodeURIComponent(search)}&status=${status}`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('applicationsBody');
    if (!d.applications?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No applications found</td></tr>`; return; }
    tbody.innerHTML = d.applications.map(a => `
      <tr>
        <td class="td-name">${esc(a.name)}</td>
        <td class="td-email">${esc(a.email)}</td>
        <td>${esc(a.jobTitle)}</td>
        <td>${esc(a.experience||'—')}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${a.resumeFilename?`<a href="${API}/applications/${a._id}/resume" target="_blank" class="act-btn" title="Download Resume" style="text-decoration:none;display:inline-flex;"><i class="fa-solid fa-file-arrow-down"></i></a>`:'—'}</td>
        <td class="td-date">${fmtDate(a.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="View" onclick="viewApplication('${a._id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('applications','${a._id}',loadApplications)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch {}
}

async function viewApplication(id) {
  try {
    const r = await fetch(`${API}/applications`, { credentials: 'include' });
    const d = await r.json();
    const a = d.applications?.find(x => x._id === id);
    if (!a) return;
    openModal('Application Details', `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Name</div><div class="detail-value">${esc(a.name)}</div></div>
        <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${esc(a.email)}</div></div>
        <div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${esc(a.phone||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Position</div><div class="detail-value">${esc(a.jobTitle)}</div></div>
        <div class="detail-field"><div class="detail-label">Experience</div><div class="detail-value">${esc(a.experience||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(a.status)}</div></div>
        ${a.linkedin?`<div class="detail-field"><div class="detail-label">LinkedIn</div><div class="detail-value"><a href="${esc(a.linkedin)}" target="_blank" style="color:#60A5FA;">${esc(a.linkedin)}</a></div></div>`:''}
        ${a.portfolio?`<div class="detail-field"><div class="detail-label">Portfolio</div><div class="detail-value"><a href="${esc(a.portfolio)}" target="_blank" style="color:#60A5FA;">${esc(a.portfolio)}</a></div></div>`:''}
        ${a.resumeFilename?`<div class="detail-field detail-full"><div class="detail-label">Resume</div><div class="detail-value"><a href="${API}/applications/${a._id}/resume" target="_blank" class="btn-primary" style="display:inline-flex;font-size:12px;padding:7px 14px;"><i class="fa-solid fa-download"></i> Download Resume</a></div></div>`:''}
        ${a.coverLetter?`<div class="detail-field detail-full"><div class="detail-label">Cover Letter</div><div class="detail-value" style="white-space:pre-wrap;">${esc(a.coverLetter)}</div></div>`:''}
        ${a.notes?`<div class="detail-field detail-full"><div class="detail-label">Notes</div><div class="detail-value">${esc(a.notes)}</div></div>`:''}
      </div>`,
      `<div style="flex:1;">
        <div class="modal-status-row">
          <select class="status-select" id="statusSel"><option value="pending" ${a.status==='pending'?'selected':''}>Pending</option><option value="reviewing" ${a.status==='reviewing'?'selected':''}>Reviewing</option><option value="interview" ${a.status==='interview'?'selected':''}>Interview</option><option value="rejected" ${a.status==='rejected'?'selected':''}>Rejected</option><option value="hired" ${a.status==='hired'?'selected':''}>Hired</option></select>
          <button class="btn-primary" onclick="updateAppStatus('${a._id}')">Update Status</button>
        </div>
        <textarea class="notes-input" id="notesInput" placeholder="Admin notes…">${esc(a.notes||'')}</textarea>
      </div>`
    );
  } catch {}
}

async function updateAppStatus(id) {
  const status = document.getElementById('statusSel')?.value;
  const notes = document.getElementById('notesInput')?.value;
  try {
    const r = await fetch(`${API}/applications/${id}/status`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status, notes }) });
    const d = await r.json();
    if (d.success) { toast('Updated', 'success'); closeModal(); loadApplications(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Services ──────────────────────────────────────────────────────────────────
async function loadServices() {
  try {
    const r = await fetch(`${API}/services`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('servicesBody');
    if (!d.services?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No service requests</td></tr>`; return; }
    tbody.innerHTML = d.services.map(s => `
      <tr>
        <td class="td-name">${esc(s.userId?.name||'—')}</td>
        <td class="td-email">${esc(s.userId?.email||'—')}</td>
        <td>${esc(s.serviceId)}</td>
        <td>${statusBadge(s.status)}</td>
        <td class="td-date">${fmtDate(s.requestedAt||s.createdAt)}</td>
        <td><div class="action-btns">
          ${s.status==='pending'?`<button class="act-btn success" title="Accept" onclick="updateService('${s._id}','accept')"><i class="fa-solid fa-check"></i></button>`:''}
          ${s.status!=='cancelled'?`<button class="act-btn danger" title="Cancel" onclick="updateService('${s._id}','cancel')"><i class="fa-solid fa-xmark"></i></button>`:''}
        </div></td>
      </tr>`).join('');
  } catch {}
}

async function updateService(id, action) {
  try {
    const r = await fetch(`${API}/services/${id}/${action}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    const d = await r.json();
    if (d.success) { toast('Service updated', 'success'); loadServices(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Team Connects ─────────────────────────────────────────────────────────────
async function loadTeam() {
  try {
    const r = await fetch(`${API}/team`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('teamBody');
    if (!d.connects?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No team connect requests</td></tr>`; return; }
    tbody.innerHTML = d.connects.map(c => `
      <tr>
        <td class="td-name">${esc(c.userName||c.userId?.name||'—')}</td>
        <td class="td-email">${esc(c.userEmail||c.userId?.email||'—')}</td>
        <td>${esc(c.department)}</td>
        <td>${esc(c.preferredContact)}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="td-date">${fmtDate(c.submittedAt||c.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="View" onclick="viewTeamConnect('${c._id}')"><i class="fa-solid fa-eye"></i></button>
        </div></td>
      </tr>`).join('');
  } catch {}
}

async function viewTeamConnect(id) {
  try {
    const r = await fetch(`${API}/team`, { credentials: 'include' });
    const d = await r.json();
    const c = d.connects?.find(x => x._id === id);
    if (!c) return;
    openModal('Team Connect Details', `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Name</div><div class="detail-value">${esc(c.userName||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Email</div><div class="detail-value">${esc(c.userEmail||'—')}</div></div>
        <div class="detail-field"><div class="detail-label">Department</div><div class="detail-value">${esc(c.department)}</div></div>
        <div class="detail-field"><div class="detail-label">Preferred Contact</div><div class="detail-value">${esc(c.preferredContact)}</div></div>
        ${c.phone?`<div class="detail-field"><div class="detail-label">Phone</div><div class="detail-value">${esc(c.phone)}</div></div>`:''}
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(c.status)}</div></div>
        <div class="detail-field detail-full"><div class="detail-label">Message</div><div class="detail-value" style="white-space:pre-wrap;">${esc(c.message)}</div></div>
      </div>`,
      `<div style="flex:1;">
        <div class="modal-status-row">
          <select class="status-select" id="statusSel"><option value="pending" ${c.status==='pending'?'selected':''}>Pending</option><option value="in-progress" ${c.status==='in-progress'?'selected':''}>In Progress</option><option value="resolved" ${c.status==='resolved'?'selected':''}>Resolved</option></select>
          <button class="btn-primary" onclick="updateTeamStatus('${c._id}')">Update Status</button>
        </div>
      </div>`
    );
  } catch {}
}

async function updateTeamStatus(id) {
  const status = document.getElementById('statusSel')?.value;
  try {
    const r = await fetch(`${API}/team/${id}/status`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
    const d = await r.json();
    if (d.success) { toast('Status updated', 'success'); closeModal(); loadTeam(); }
    else toast(d.message, 'error');
  } catch { toast('Update failed', 'error'); }
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
async function loadJobs() {
  try {
    const r = await fetch(`${API}/jobs`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('jobsBody');
    if (!d.jobs?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No jobs found</td></tr>`; return; }
    tbody.innerHTML = d.jobs.map(j => `
      <tr>
        <td class="td-name">${esc(j.title)}</td>
        <td>${esc(j.type)}</td>
        <td>${esc(j.department)}</td>
        <td>${j.isActive?'<span class="badge badge-active">Active</span>':'<span class="badge badge-cancelled">Inactive</span>'}</td>
        <td class="td-date">${fmtDate(j.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn" title="Edit" onclick="editJob('${j._id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="act-btn" title="Toggle" onclick="toggleJob('${j._id}',${!j.isActive})"><i class="fa-solid fa-power-off"></i></button>
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('jobs','${j._id}',loadJobs)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch {}
}

function openJobModal() {
  document.getElementById('jobEditId').value = '';
  document.getElementById('jobForm').reset();
  document.getElementById('jobModalTitle').textContent = 'Add Job';
  document.getElementById('jobSubmitBtn').textContent = 'Create Job';
  document.getElementById('jobActiveWrap').style.display = 'none';
  document.getElementById('jobModalOverlay').classList.add('open');
}

async function editJob(id) {
  try {
    const r = await fetch(`${API}/jobs`, { credentials: 'include' });
    const d = await r.json();
    const j = d.jobs?.find(x => x._id === id);
    if (!j) return;
    document.getElementById('jobEditId').value = j._id;
    document.getElementById('jobTitle').value = j.title;
    document.getElementById('jobType').value = j.type;
    document.getElementById('jobDept').value = j.department;
    document.getElementById('jobDesc').value = j.description;
    document.getElementById('jobActive').checked = j.isActive;
    document.getElementById('jobActiveWrap').style.display = 'block';
    document.getElementById('jobModalTitle').textContent = 'Edit Job';
    document.getElementById('jobSubmitBtn').textContent = 'Save Changes';
    document.getElementById('jobModalOverlay').classList.add('open');
  } catch {}
}

async function toggleJob(id, isActive) {
  try {
    const r = await fetch(`${API}/jobs/${id}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive }) });
    const d = await r.json();
    if (d.success) { toast(`Job ${isActive?'activated':'deactivated'}`, 'success'); loadJobs(); }
  } catch {}
}

document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('jobEditId').value;
  const data = { title: document.getElementById('jobTitle').value, type: document.getElementById('jobType').value, department: document.getElementById('jobDept').value, description: document.getElementById('jobDesc').value };
  if (id) data.isActive = document.getElementById('jobActive').checked;
  try {
    const url = id ? `${API}/jobs/${id}` : `${API}/jobs`;
    const method = id ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
    const d = await r.json();
    if (d.success) { toast(id?'Job updated':'Job created', 'success'); closeJobModal(); loadJobs(); }
    else toast(d.message, 'error');
  } catch { toast('Error saving job', 'error'); }
});

function closeJobModal() { document.getElementById('jobModalOverlay').classList.remove('open'); }

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const search = document.getElementById('userSearch')?.value.trim() || '';
  try {
    const r = await fetch(`${API}/users?search=${encodeURIComponent(search)}`, { credentials: 'include' });
    const d = await r.json();
    const tbody = document.getElementById('usersBody');
    if (!d.users?.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No users found</td></tr>`; return; }
    tbody.innerHTML = d.users.map(u => `
      <tr>
        <td class="td-name">${esc(u.name)}</td>
        <td class="td-email">${esc(u.email)}</td>
        <td>${u.isVerified?'<span class="badge badge-active">Verified</span>':'<span class="badge badge-pending">Unverified</span>'}</td>
        <td class="td-date">${fmtDate(u.createdAt)}</td>
        <td><div class="action-btns">
          <button class="act-btn danger" title="Delete" onclick="deleteRecord('users','${u._id}',loadUsers)"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } catch {}
}

// ── Generic Delete ────────────────────────────────────────────────────────────
async function deleteRecord(endpoint, id, reloadFn) {
  if (!confirm('Are you sure you want to delete this record?')) return;
  try {
    const r = await fetch(`${API}/${endpoint}/${id}`, { method:'DELETE', credentials:'include' });
    const d = await r.json();
    if (d.success) { toast('Deleted', 'success'); reloadFn(); loadStats(); }
    else toast(d.message, 'error');
  } catch { toast('Delete failed', 'error'); }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBadge(s, type = 'status') {
  const map = { pending:'pending', 'in-progress':'in-progress', completed:'completed', confirmed:'confirmed', cancelled:'cancelled', declined:'declined', active:'active', reviewing:'reviewing', interview:'interview', rejected:'rejected', hired:'hired', high:'high', urgent:'urgent', normal:'normal' };
  const cls = map[s] || 'pending';
  return `<span class="badge badge-${cls}">${s||'—'}</span>`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
checkAuth();
