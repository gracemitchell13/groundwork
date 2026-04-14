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

  // Show synopsis if complete, otherwise show complete button if name exists
  if (org.profileComplete) {
    showSynopsis(org);
  } else if (org.name) {
    document.getElementById('complete-btn').style.display = '';
  }
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

// ── Synopsis view ───────────────────────────────────────────
function showSynopsis(org) {
  const synopsis = document.getElementById('org-synopsis');
  const form     = document.getElementById('org-form');
  const saveBar  = document.getElementById('save-bar');
  if (!synopsis || !form) return;

  // Build meta line
  const metaParts = [];
  if (org.budget) metaParts.push(org.budget.replace('under-100k','Under $100K').replace('100k-250k','$100K–$250K').replace('250k-500k','$250K–$500K').replace('500k-1m','$500K–$1M').replace('1m-5m','$1M–$5M').replace('over-5m','Over $5M'));
  if (org.staff)  metaParts.push(org.staff);

  const blocks = [
    { label: 'Mission',           value: org.mission },
    { label: 'Programs',          value: org.programs },
    { label: 'Population served', value: org.population },
    { label: 'Geography',         value: org.geography },
    { label: 'Theory of change',  value: org.theoryOfChange },
    { label: 'Grant notes',       value: org.grantNotes },
  ].filter(b => b.value);

  const fundersHTML = org.funderHistory?.length
    ? `<div class="synopsis-block">
        <div class="synopsis-label">Funder history</div>
        <div class="synopsis-funders">
          ${org.funderHistory.map(f => `<span class="synopsis-funder-tag">${escHtml(f)}</span>`).join('')}
        </div>
      </div>`
    : '';

  const abbrHTML = org.abbreviation
    ? ` <span style="font-style:normal;font-size:16px;color:var(--muted);">(${escHtml(org.abbreviation)})</span>`
    : '';

  // Place Edit button next to the page title
  const titleEl = document.querySelector('.page-title');
  if (titleEl && !document.getElementById('edit-btn')) {
    titleEl.style.display = 'flex';
    titleEl.style.alignItems = 'baseline';
    titleEl.style.justifyContent = 'space-between';
    titleEl.style.gap = '16px';
    const editBtn = document.createElement('button');
    editBtn.id = 'edit-btn';
    editBtn.className = 'btn-secondary';
    editBtn.style.cssText = 'font-size:13px;padding:6px 16px;flex-shrink:0;font-family:var(--sans);font-style:normal;';
    editBtn.textContent = 'Edit profile';
    editBtn.addEventListener('click', hideSynopsis);
    titleEl.appendChild(editBtn);
  }

  synopsis.innerHTML = `
    <div style="margin-bottom:6px;">
      <div class="synopsis-name">${escHtml(org.name)}${abbrHTML}</div>
      ${metaParts.length ? `<div class="synopsis-meta">${escHtml(metaParts.join(' · '))}</div>` : ''}
    </div>
    ${blocks.map(b => `
      <div class="synopsis-block">
        <div class="synopsis-label">${b.label}</div>
        <div class="synopsis-text">${escHtml(b.value)}</div>
      </div>`).join('')}
    ${fundersHTML}
  `;

  synopsis.style.display = 'block';
  form.style.display = 'none';
  if (saveBar) saveBar.style.display = 'none';

  document.getElementById('edit-btn').addEventListener('click', hideSynopsis);
}

function hideSynopsis() {
  const synopsis = document.getElementById('org-synopsis');
  const form     = document.getElementById('org-form');
  const saveBar  = document.getElementById('save-bar');
  const editBtn  = document.getElementById('edit-btn');
  const titleEl  = document.querySelector('.page-title');

  if (synopsis) synopsis.style.display = 'none';
  if (form)     form.style.display = '';
  if (saveBar)  saveBar.style.display = '';
  if (editBtn)  editBtn.remove();
  if (titleEl)  { titleEl.style.display = ''; titleEl.style.alignItems = ''; titleEl.style.justifyContent = ''; titleEl.style.gap = ''; }
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

  // Capture previous values before overwriting
  const prevMission = savedOrgData?.mission || '';
  const prevToc     = savedOrgData?.theoryOfChange || '';

  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await setDoc(orgRef, orgData, { merge: true });

    savedOrgData = orgData;
    populateSidebarCard(orgData);

    if (orgData.name) {
      document.getElementById('complete-btn').style.display = '';
    }

    statusEl.textContent = 'Saved ✓';
    statusEl.className = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);

    // Show nudge only if mission or theory of change were changed and are non-empty
    const missionChanged = !!orgData.mission && orgData.mission !== prevMission;
    const tocChanged     = !!orgData.theoryOfChange && orgData.theoryOfChange !== prevToc;
    if (missionChanged || tocChanged) showLibraryNudge(orgData, missionChanged, tocChanged);

  } catch (err) {
    console.error('Save error:', err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className = 'save-status error';
  }
}

// ── Library nudge ───────────────────────────────────────────
function showLibraryNudge(org, hasMission, hasToc) {
  const existing = document.getElementById('library-nudge');
  if (existing) existing.remove();


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
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div>
        <p style="font-size:13px;font-weight:600;color:var(--body);margin-bottom:6px;">
          Save to your Language Library?
        </p>
        <p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.6;">
          Your ${items.map(i => i.label.toLowerCase()).join(' and ')} can be saved as reusable blocks
          in your Language Library — ready to copy into any grant application.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">${buttonsHTML}</div>
      </div>
      <button id="nudge-dismiss" title="Dismiss"
        style="font-size:18px;line-height:1;color:var(--muted-2);background:none;border:none;cursor:pointer;flex-shrink:0;padding:0 4px;">×</button>
    </div>
  `;

  // Insert inside page-content, before the save bar
  const saveBar = document.getElementById('save-bar');
  saveBar?.insertAdjacentElement('beforebegin', nudge);

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
    showSynopsis(savedOrgData);
  } catch (err) {
    console.error(err);
  }
});

// ── Sign out ────────────────────────────────────────────────
document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
