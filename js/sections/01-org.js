// Groundwork — Section 01: Know Your Organization
// Handles auth, loads saved data, saves to Firestore

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { populateSidebarCard } from '../sidebar-org-card.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let selectedBudget = null;
let funders = [];

// ── Auth guard ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;

  // Greeting
  const hour = new Date().getHours();
  const tod  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = user.displayName?.split(' ')[0] || '';
  const g = document.getElementById('greeting');
  if (g) g.textContent = `Good ${tod}${name ? ', ' + name : ''}.`;

  // Avatar
  const av = document.getElementById('avatar-initial');
  if (av) av.textContent = (user.displayName || user.email || '?')[0].toUpperCase();

  // Dots
  await loadDots(user);

  // Load saved org data
  await loadOrgData(user);
});

// ── Load dots from org data ─────────────────────────────────
async function loadDots(user) {
  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    const checks = [org?.name, org?.evaluations?.length, org?.applications?.length,
                    org?.library?.length, org?.pipeline?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });
    const nameEl = document.getElementById('org-name');
    const fullEl = document.getElementById('org-full');
    if (nameEl) nameEl.textContent = org.abbreviation || org.name || '—';
    if (fullEl) fullEl.textContent = org.name || '';
    populateSidebarCard(org);
  }
}

// ── Load saved data into form ───────────────────────────────
async function loadOrgData(user) {
  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;

  const org = orgSnap.data();

  setField('org-name-input', org.name);
  setField('org-abbr',       org.abbreviation);
  setField('org-mission',    org.mission);
  setField('org-programs',   org.programs);
  setField('org-population', org.population);
  setField('org-geography',  org.geography);
  setField('org-staff',      org.staff);
  setField('org-toc',        org.theoryOfChange);
  setField('org-grant-notes', org.grantNotes);

  if (org.budget) {
    selectedBudget = org.budget;
    document.querySelectorAll('.budget-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.value === org.budget);
    });
  }

  if (org.funderHistory?.length) {
    funders = [...org.funderHistory];
    renderFunders();
  }
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

// ── Budget pills ────────────────────────────────────────────
document.getElementById('budget-options')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.budget-option');
  if (!btn) return;
  selectedBudget = btn.dataset.value;
  document.querySelectorAll('.budget-option').forEach(b =>
    b.classList.toggle('selected', b === btn));
});

// ── Funder history ──────────────────────────────────────────
function renderFunders() {
  const list = document.getElementById('funder-list');
  if (!list) return;
  list.innerHTML = '';
  funders.forEach((funder, i) => {
    const row = document.createElement('div');
    row.className = 'funder-row';
    row.innerHTML = `
      <input class="form-input" type="text" placeholder="Funder name" value="${escHtml(funder)}" data-index="${i}">
      <button class="funder-remove" data-index="${i}" aria-label="Remove">×</button>`;
    list.appendChild(row);
  });

  list.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', e => {
      funders[parseInt(e.target.dataset.index)] = e.target.value;
    });
  });

  list.querySelectorAll('.funder-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      funders.splice(parseInt(e.currentTarget.dataset.index), 1);
      renderFunders();
    });
  });
}

document.getElementById('add-funder-btn')?.addEventListener('click', () => {
  funders.push('');
  renderFunders();
  // Focus the new input
  const inputs = document.querySelectorAll('#funder-list input');
  inputs[inputs.length - 1]?.focus();
});

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Save ────────────────────────────────────────────────────
document.getElementById('save-btn')?.addEventListener('click', saveOrg);

async function saveOrg() {
  if (!currentUser) return;

  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className = 'save-status saving';

  const name = document.getElementById('org-name-input')?.value.trim();

  const orgData = {
    name,
    abbreviation:   document.getElementById('org-abbr')?.value.trim(),
    mission:        document.getElementById('org-mission')?.value.trim(),
    programs:       document.getElementById('org-programs')?.value.trim(),
    population:     document.getElementById('org-population')?.value.trim(),
    geography:      document.getElementById('org-geography')?.value.trim(),
    staff:          document.getElementById('org-staff')?.value.trim(),
    theoryOfChange: document.getElementById('org-toc')?.value.trim(),
    grantNotes:     document.getElementById('org-grant-notes')?.value.trim(),
    budget:         selectedBudget,
    funderHistory:  funders.filter(f => f.trim()),
    updatedAt:      new Date().toISOString(),
  };

  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await setDoc(orgRef, orgData, { merge: true });

    // Update sidebar
    const nameEl = document.getElementById('org-name');
    const fullEl = document.getElementById('org-full');
    if (nameEl) nameEl.textContent = orgData.abbreviation || orgData.name || '—';
    if (fullEl) fullEl.textContent = orgData.name || '';

    // Light up dot 1
    document.getElementById('dot-1')?.classList.add('active');

    statusEl.textContent = 'Saved ✓';
    statusEl.className = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);
  } catch (err) {
    console.error('Save error:', err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className = 'save-status error';
  }
}

// ── Sign out ────────────────────────────────────────────────
document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});

document.getElementById('settings-btn')?.addEventListener('click', () => {
  alert('Settings coming soon.');
});
