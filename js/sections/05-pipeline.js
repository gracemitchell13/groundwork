// Groundwork — Section 05: Track Your Pipeline

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs,
         addDoc, updateDoc, deleteDoc, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { populateSidebarCard } from '../sidebar-org-card.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let grants = [];         // all grants for this user
let editingId = null;    // grant id currently being edited
let activeFilter = 'all';

// ── Status config ────────────────────────────────────────────
const STATUS = {
  prospect:   { label: 'Prospect',   badge: 'badge-prospect'   },
  evaluating: { label: 'Evaluating', badge: 'badge-evaluating' },
  applying:   { label: 'Applying',   badge: 'badge-applying'   },
  submitted:  { label: 'Submitted',  badge: 'badge-submitted'  },
  awarded:    { label: 'Awarded',    badge: 'badge-awarded'    },
  declined:   { label: 'Declined',   badge: 'badge-declined'   },
};

// ── Firestore helpers ────────────────────────────────────────
function grantsCol(uid) {
  return collection(db, 'users', uid, 'grants');
}
function grantDoc(uid, id) {
  return doc(db, 'users', uid, 'grants', id);
}

// ── Load grants ──────────────────────────────────────────────
async function loadGrants() {
  if (!currentUser) return;
  const q = query(grantsCol(currentUser.uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  grants = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrants();
  updateDot();
}

function updateDot() {
  const dot = document.getElementById('dot-5');
  if (dot && grants.length) dot.classList.add('active');
  else if (dot) dot.classList.remove('active');
}

// ── Render grant list ────────────────────────────────────────
function renderGrants() {
  const list  = document.getElementById('grant-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  const filtered = activeFilter === 'all'
    ? grants
    : grants.filter(g => g.status === activeFilter);

  if (!grants.length) {
    empty.style.display = 'block';
    list.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';

  if (!filtered.length) {
    list.innerHTML = `<p style="font-size:14px;color:var(--muted);padding:24px 0;">No opportunities with status "${STATUS[activeFilter]?.label}".</p>`;
    return;
  }

  filtered.forEach(grant => {
    const card = document.createElement('div');
    card.className = `grant-card status-${grant.status}`;
    card.dataset.id = grant.id;

    const deadlineInfo = formatDeadline(grant.deadline);
    const st = STATUS[grant.status] || STATUS.prospect;

    card.innerHTML = `
      <div class="grant-card-top">
        <div>
          <div class="grant-name">${grant.name}</div>
          ${grant.funder ? `<div class="grant-funder">${grant.funder}</div>` : ''}
        </div>
        <span class="grant-badge ${st.badge}">${st.label}</span>
      </div>
      <div class="grant-meta">
        ${grant.amount   ? `<span class="grant-meta-item">💰 ${grant.amount}</span>` : ''}
        ${deadlineInfo   ? `<span class="grant-meta-item ${deadlineInfo.cls}">📅 ${deadlineInfo.text}</span>` : ''}
        ${grant.notes    ? `<span class="grant-meta-item" style="color:var(--muted-2);font-style:italic;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${grant.notes}</span>` : ''}
      </div>
      <div class="grant-actions">
        <button class="grant-action-btn primary" onclick="window._workOnGrant('${grant.id}')">Work on this →</button>
        <button class="grant-action-btn" onclick="window._editGrant('${grant.id}')">Edit</button>
        <select class="grant-action-btn" onchange="window._updateStatus('${grant.id}', this.value)" style="padding:5px 8px;cursor:pointer;">
          ${Object.entries(STATUS).map(([val, s]) =>
            `<option value="${val}" ${grant.status === val ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
        <button class="grant-action-btn danger" onclick="window._deleteGrant('${grant.id}', '${grant.name.replace(/'/g, "\\'")}')">Delete</button>
      </div>`;

    list.appendChild(card);
  });
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const d    = new Date(dateStr + 'T00:00:00');
  const days = Math.ceil((d - new Date().setHours(0,0,0,0)) / 86400000);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days < 0)  return { text: `${label} (passed)`, cls: 'deadline-urgent' };
  if (days === 0) return { text: 'Due today!',        cls: 'deadline-urgent' };
  if (days <= 14) return { text: `${label} — ${days}d left`, cls: 'deadline-soon' };
  return { text: label, cls: '' };
}

// ── Modal ────────────────────────────────────────────────────
function openModal(grant = null) {
  editingId = grant?.id || null;
  document.getElementById('modal-title').textContent = grant ? 'Edit opportunity' : 'Add opportunity';
  document.getElementById('g-name').value     = grant?.name     || '';
  document.getElementById('g-funder').value   = grant?.funder   || '';
  document.getElementById('g-amount').value   = grant?.amount   || '';
  document.getElementById('g-deadline').value = grant?.deadline || '';
  document.getElementById('g-status').value   = grant?.status   || 'prospect';
  document.getElementById('g-notes').value    = grant?.notes    || '';
  document.getElementById('grant-modal').classList.add('open');
  document.getElementById('g-name').focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('grant-modal').classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
}

async function saveGrant() {
  const name = document.getElementById('g-name').value.trim();
  if (!name) { document.getElementById('g-name').focus(); return; }

  const amount = document.getElementById('g-amount').value.trim();

  const data = {
    name,
    funder:   document.getElementById('g-funder').value.trim(),
    amount:   amount && !amount.startsWith('$') ? '$' + amount : amount,
    deadline: document.getElementById('g-deadline').value,
    status:   document.getElementById('g-status').value,
    notes:    document.getElementById('g-notes').value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className   = 'save-status';

  try {
    if (editingId) {
      await updateDoc(grantDoc(currentUser.uid, editingId), data);
    } else {
      data.createdAt = new Date().toISOString();
      await addDoc(grantsCol(currentUser.uid), data);
    }
    closeModal();
    await loadGrants();
    statusEl.textContent = 'Saved ✓';
    statusEl.className   = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 2000);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className   = 'save-status error';
  }
}

// ── Window-exposed actions ───────────────────────────────────
window._editGrant = (id) => {
  const grant = grants.find(g => g.id === id);
  if (grant) openModal(grant);
};

window._deleteGrant = async (id, name) => {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(grantDoc(currentUser.uid, id));
    await loadGrants();
  } catch (err) {
    console.error(err);
    alert('Error deleting — please try again.');
  }
};

window._updateStatus = async (id, status) => {
  try {
    await updateDoc(grantDoc(currentUser.uid, id), {
      status, updatedAt: new Date().toISOString()
    });
    await loadGrants();
  } catch (err) { console.error(err); }
};

window._workOnGrant = (id) => {
  // Store selected grant id in sessionStorage, navigate to evaluate
  sessionStorage.setItem('gw-active-grant', id);
  window.location.href = 'evaluate.html';
};

// ── Event listeners ──────────────────────────────────────────
document.getElementById('add-grant-btn')?.addEventListener('click',  () => openModal());
document.getElementById('add-grant-btn-2')?.addEventListener('click', () => openModal());
document.getElementById('modal-close')?.addEventListener('click',    closeModal);
document.getElementById('modal-cancel')?.addEventListener('click',   closeModal);
document.getElementById('modal-save')?.addEventListener('click',     saveGrant);
document.getElementById('grant-modal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.status;
    renderGrants();
  });
});

// ── Auth ─────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  currentUser = user;

  const hour = new Date().getHours();
  const tod  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = user.displayName?.split(' ')[0] || '';
  const g    = document.getElementById('greeting');
  if (g) g.textContent = `Good ${tod}${name ? ', ' + name : ''}.`;

  const av = document.getElementById('avatar-initial');
  if (av) av.textContent = (user.displayName || user.email || '?')[0].toUpperCase();

  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    populateSidebarCard(org);
    const checks = [org?.name, org?.evaluations?.length, org?.applications?.length,
                    org?.library?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });
  }

  await loadGrants();
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
