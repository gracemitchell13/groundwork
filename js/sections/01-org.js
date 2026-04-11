// Groundwork — Section 01: Know Your Organization

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { populateSidebarCard } from '../sidebar-org-card.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser  = null;
let selectedBudget = null;
let funders = [];
let isLocked = false;
let savedOrgData = null; // keep a reference for library nudge

// ── Auth guard ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  currentUser = user;

  const hour = new Date().getHours();
  const tod  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = user.displayName?.split(' ')[0] || '';
  const g = document.getElementById('greeting');
  if (g) g.textContent = `Good ${tod}${name ? ', ' + name : ''}.`;

  const av = document.getElementById('avatar-initial');
  if (av) av.textContent = (user.displayName || user.email || '?')[0].toUpperCase();

  await loadOrgData(user);
});

// ── Load saved data ─────────────────────────────────────────
async function loadOrgData(user) {
  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;

  const org = orgSnap.data();
  savedOrgData = org;

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
    document.querySelectorAll('.budget-option').forEach(btn =>
      btn.classList.toggle('selected', btn.dataset.value === org.budget));
  }

  if (org.funderHistory?.length) {
    funders = [...org.funderHistory];
    renderFunders();
  }

  populateSidebarCard(org);

  // Lock if complete
  if (org.profileComplete) {
    lockForm();
  } else if (org.name) {
    document.getElementById('complete-btn').style.display = '';
  }
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

// ── Lock / unlock form ──────────────────────────────────────
function lockForm() {
  isLocked = true;

  // Disable all inputs and textareas
  document.querySelectorAll('.form-input, .form-textarea').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.75';
    el.style.cursor  = 'default';
  });

  // Disable budget pills
  document.querySelectorAll('.budget-option').forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = 'default';
  });

  // Hide add funder button and remove buttons
  document.getElementById('add-funder-btn').style.display = 'none';
  document.querySelectorAll('.funder-remove').forEach(b => b.style.display = 'none');

  // Update save bar
  const saveBar  = document.getElementById('save-bar');
  const saveBtn  = document.getElementById('save-btn');
  const compBtn  = document.getElementById('complete-btn');
  const statusEl = document.getElementById('save-status');

  if (saveBtn) saveBtn.style.display = 'none';
  if (compBtn) compBtn.style.display = 'none';
  if (statusEl) statusEl.textContent = '';

  // Add Edit button if not already there
  if (saveBar && !document.getElementById('edit-btn')) {
    const editBtn = document.createElement('button');
    editBtn.id        = 'edit-btn';
    editBtn.className = 'btn-secondary';
    editBtn.textContent = 'Edit profile';
    editBtn.addEventListener('click', unlockForm);
    saveBar.prepend(editBtn);

    const note = document.createElement('span');
    note.className   = 'save-status';
    note.style.color = 'var(--accent-1)';
    note.textContent = 'Profile complete ✓';
    saveBar.appendChild(note);
  }
}

function unlockForm() {
  isLocked = false;

  document.querySelectorAll('.form-input, .form-textarea').forEach(el => {
    el.disabled = false;
    el.style.opacity = '';
    el.style.cursor  = '';
  });

  document.querySelectorAll('.budget-option').forEach(btn => {
    btn.disabled = false;
    btn.style.cursor = '';
  });

  document.getElementById('add-funder-btn').style.display = '';
  document.querySelectorAll('.funder-remove').forEach(b => b.style.display = '');

  const saveBtn = document.getElementById('save-btn');
  const compBtn = document.getElementById('complete-btn');
  const editBtn = document.getElementById('edit-btn');
  const saveBar = document.getElementById('save-bar');

  if (saveBtn) saveBtn.style.display = '';
  if (compBtn) { compBtn.style.display = ''; compBtn.textContent = 'Mark profile complete ✓'; compBtn.disabled = false; }
  if (editBtn) editBtn.remove();

  // Remove the "Profile complete ✓" note
  saveBar?.querySelectorAll('.save-status').forEach(el => {
    if (el.textContent.includes('complete')) el.remove();
  });
}

// ── Budget pills ────────────────────────────────────────────
document.getElementById('budget-options')?.addEventListener('click', (e) => {
  if (isLocked) return;
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
      <input class="form-input" type="text" placeholder="Funder name" value="${escHtml(funder)}" data-index="${i}"${isLocked ? ' disabled' : ''}>
      <button class="funder-remove" data-index="${i}" aria-label="Remove"${isLocked ? ' style="display:none;"' : ''}>×</button>`;
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
  const inputs = document.querySelectorAll('#funder-list input');
  inputs[inputs.length - 1]?.focus();
});

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Save ────────────────────────────────────────────────────
document.getElementById('save-btn')?.addEventListener('click', saveOrg);

async function saveOrg() {
  if (!currentUser) return;

  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className = 'save-status saving';

  const orgData = {
    name:           document.getElementById('org-name-input')?.value.trim(),
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

  savedOrgData = orgData;

  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await setDoc(orgRef, orgData, { merge: true });

    populateSidebarCard(orgData);

    if (orgData.name) {
      document.getElementById('complete-btn').style.display = '';
    }

    statusEl.textContent = 'Saved ✓';
    statusEl.className = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);

    // Show library nudge if mission or theory of change are filled
    showLibraryNudge(orgData);

  } catch (err) {
    console.error('Save error:', err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className = 'save-status error';
  }
}

// ── Library nudge ───────────────────────────────────────────
function showLibraryNudge(org) {
  const existing = document.getElementById('library-nudge');
  if (existing) existing.remove();

  const hasMission = !!org.mission;
  const hasToc     = !!org.theoryOfChange;
  if (!hasMission && !hasToc) return;

  const nudge = document.createElement('div');
  nudge.id = 'library-nudge';
  nudge.style.cssText = `
    margin: 24px 0 0;
    padding: 18px 20px;
    background: var(--linen-card);
    border: 1px solid var(--linen-border);
    border-left: 4px solid var(--accent-1);
    border-radius: 0 8px 8px 0;
  `;

  const items = [];
  if (hasMission) items.push({ label: 'Mission Statement', field: 'mission', text: org.mission });
  if (hasToc)     items.push({ label: 'Theory of Change',  field: 'theory', text: org.theoryOfChange });

  const buttonsHTML = items.map(item => `
    <button class="lib-nudge-btn btn-secondary" data-field="${item.field}"
      style="font-size:13px;padding:7px 16px;">
      Save ${item.label} to Library →
    </button>`).join('');

  nudge.innerHTML = `
    <p style="font-size:13px;font-weight:600;color:var(--body);margin-bottom:6px;">
      Save to your Language Library?
    </p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.6;">
      Your ${items.map(i => i.label.toLowerCase()).join(' and ')} can be saved as reusable blocks
      in your Language Library — ready to copy into any grant application.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">${buttonsHTML}</div>
    <button id="nudge-dismiss" style="font-size:12px;color:var(--muted-2);background:none;border:none;cursor:pointer;margin-top:12px;display:block;">
      No thanks
    </button>
  `;

  // Insert after save bar
  const saveBar = document.getElementById('save-bar');
  saveBar?.parentNode?.insertBefore(nudge, saveBar.nextSibling);

  // Dismiss
  nudge.querySelector('#nudge-dismiss').addEventListener('click', () => nudge.remove());

  // Save to library buttons
  nudge.querySelectorAll('.lib-nudge-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const field = btn.dataset.field;
      const item  = items.find(i => i.field === field);
      if (!item || !currentUser) return;

      btn.disabled     = true;
      btn.textContent  = 'Saving…';

      const block = {
        id:        Date.now().toString(),
        category:  field === 'mission' ? 'mission' : 'theory',
        label:     'From org profile',
        text:      item.text,
        wordCount: item.text.trim().split(/\s+/).filter(Boolean).length,
        savedAt:   new Date().toISOString(),
      };

      try {
        const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
        await updateDoc(orgRef, { library: arrayUnion(block) });
        btn.textContent  = `${item.label} saved ✓`;
        btn.style.color  = 'var(--accent-1)';
        btn.style.borderColor = 'var(--accent-1)';
      } catch (err) {
        console.error(err);
        btn.textContent = 'Error — try again';
        btn.disabled = false;
      }
    });
  });
}

// ── Mark complete ───────────────────────────────────────────
document.getElementById('complete-btn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await setDoc(orgRef, { profileComplete: true, updatedAt: new Date().toISOString() }, { merge: true });
    document.getElementById('library-nudge')?.remove();
    lockForm();
  } catch (err) {
    console.error(err);
  }
});

// ── Sign out ────────────────────────────────────────────────
document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
