// Groundwork — Section 04: Language Library

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { populateSidebarCard } from '../sidebar-org-card.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const WORKER_URL = 'https://groundwork-proxy.avengingophelia.workers.dev';

let currentUser = null;
let orgData     = null;

// ── Category definitions ────────────────────────────────────
const CATEGORIES = [
  {
    slug:  'mission',
    label: 'Mission Statement',
    accent: 'var(--accent-1)',
    hint:  "A concise statement of your organization's purpose: who you serve, what you do, and why it matters.",
    draftPrompt: (org) => `Draft a concise, compelling mission statement for a nonprofit grant application. Write 2–4 sentences. Be specific, not generic. Do not use jargon or clichés like "empower" or "transform." Write in third person.\n\nOrganization name: ${org.name || 'Not provided'}\nCurrent mission: ${org.mission || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\nGeography: ${org.geography || 'Not provided'}\n\nReturn only the mission statement text, no labels or commentary.`,
  },
  {
    slug:  'need',
    label: 'Statement of Need',
    accent: 'var(--accent-2)',
    hint:  'The problem your organization exists to address, grounded in data, specific to your community.',
    draftPrompt: (org) => `Draft a statement of need for a nonprofit grant application. Write 3–5 sentences. Ground it in the specific community and population this organization serves. Reference the kinds of challenges or gaps that would make a funder understand why this work is necessary.\n\nOrganization name: ${org.name || 'Not provided'}\nMission: ${org.mission || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\nGeography: ${org.geography || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\n\nReturn only the statement of need text, no labels or commentary.`,
  },
  {
    slug:  'capacity',
    label: 'Organizational Capacity',
    accent: 'var(--accent-3)',
    hint:  'Evidence that your organization can deliver on a grant; staff, systems, track record, infrastructure.',
    draftPrompt: (org) => `Draft an organizational capacity paragraph for a nonprofit grant application. Write 3–5 sentences demonstrating this organization has the staff, systems, and track record to implement a grant successfully.\n\nOrganization name: ${org.name || 'Not provided'}\nStaff count: ${org.staffCount || 'Not provided'}\nAnnual budget: ${org.budget || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\nTheory of change: ${org.theoryOfChange || 'Not provided'}\nGrant writing notes: ${org.grantNotes || 'Not provided'}\n\nReturn only the capacity paragraph text, no labels or commentary.`,
  },
  {
    slug:  'programs',
    label: 'Program Description',
    accent: 'var(--accent-4)',
    hint:  'What your programs do: activities, approach, timeline, and expected outcomes.',
    draftPrompt: (org) => `Draft a program description paragraph for a nonprofit grant application. Write 3–5 sentences describing the core programs or services this organization delivers. Be concrete about activities, approach, and outcomes.\n\nOrganization name: ${org.name || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\nGeography: ${org.geography || 'Not provided'}\nTheory of change: ${org.theoryOfChange || 'Not provided'}\n\nReturn only the program description text, no labels or commentary.`,
  },
  {
    slug:  'population',
    label: 'Population Served',
    accent: 'var(--accent-5)',
    hint:  'Who you serve: demographics, geography, scale, and what brings them to your organization.',
    draftPrompt: (org) => `Draft a population served paragraph for a nonprofit grant application. Write 2–4 sentences describing the specific people this organization serves — who they are, where they live, what they face, and roughly how many. Be specific and humanizing, not clinical.\n\nOrganization name: ${org.name || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\nGeography: ${org.geography || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\n\nReturn only the population description text, no labels or commentary.`,
  },
  {
    slug:  'geography',
    label: 'Geographic Focus',
    accent: 'var(--accent-1)',
    hint:  'Where your work takes place and why that geography matters to your mission.',
    draftPrompt: (org) => `Draft a geographic focus statement for a nonprofit grant application. Write 2–3 sentences explaining where this organization works and why that geography is central to its mission. Be specific about place.\n\nOrganization name: ${org.name || 'Not provided'}\nGeography: ${org.geography || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\nMission: ${org.mission || 'Not provided'}\n\nReturn only the geographic focus text, no labels or commentary.`,
  },
  {
    slug:  'theory',
    label: 'Theory of Change',
    accent: 'var(--accent-2)',
    hint:  'How your work drives change: the logic that connects your activities to long-term outcomes.',
    draftPrompt: (org) => `Draft a theory of change paragraph for a nonprofit grant application. Write 3–5 sentences connecting this organization's activities to its intended outcomes. Use an if/then or inputs-to-outcomes logic, but write it as flowing prose, not a list.\n\nOrganization name: ${org.name || 'Not provided'}\nMission: ${org.mission || 'Not provided'}\nPrograms: ${org.programs || 'Not provided'}\nTheory of change (user notes): ${org.theoryOfChange || 'Not provided'}\nPopulation served: ${org.population || 'Not provided'}\n\nReturn only the theory of change text, no labels or commentary.`,
  },
];

// ── Render ──────────────────────────────────────────────────
function renderLibrary(libraryBlocks) {
  const container = document.getElementById('library-container');
  if (!container) return;
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const blocks  = (libraryBlocks || []).filter(b => b.category === cat.slug);
    container.appendChild(buildCategorySection(cat, blocks));
  });
}

function buildCategorySection(cat, blocks) {
  const section = document.createElement('div');
  section.className    = 'lib-category';
  section.dataset.slug = cat.slug;

  section.innerHTML = `
    <div class="lib-cat-header" style="border-left:4px solid ${cat.accent};padding-left:12px;">
      <h3 class="lib-cat-title">${cat.label}</h3>
      <span class="lib-cat-count">${blocks.length} block${blocks.length !== 1 ? 's' : ''}</span>
    </div>
    <p class="lib-cat-hint">${cat.hint}</p>
    <div class="lib-blocks" id="blocks-${cat.slug}"></div>
    <div class="lib-editor-wrap" id="editor-${cat.slug}" style="display:none;"></div>
    <button class="lib-add-btn" id="add-btn-${cat.slug}">+ Add a block</button>
  `;

  const blocksEl = section.querySelector(`#blocks-${cat.slug}`);
  blocks.forEach(block => blocksEl.appendChild(buildBlockCard(block, cat)));

  section.querySelector(`#add-btn-${cat.slug}`)
    .addEventListener('click', () => openEditor(cat, null));

  return section;
}

function buildBlockCard(block, cat) {
  const slug = typeof cat === 'string' ? cat : cat.slug;
  const accent = typeof cat === 'string' ? null : cat.accent;
  const card = document.createElement('div');
  card.className  = 'lib-block-card';
  card.dataset.id = block.id;
  if (accent) { card.style.borderLeftColor = accent; card.style.borderLeftWidth = '4px'; }

  const words   = block.wordCount || countWords(block.text);
  const preview = block.text.length > 220
    ? block.text.slice(0, 220).trimEnd() + '…'
    : block.text;

  card.innerHTML = `
    ${block.label ? `<div class="lib-block-label">${escHtml(block.label)}</div>` : ''}
    <div class="lib-block-preview">${escHtml(preview)}</div>
    <div class="lib-block-footer">
      <span class="lib-word-count">${words} words</span>
      <div class="lib-block-actions">
        <button class="lib-action-btn lib-copy-btn">Copy</button>
        <button class="lib-action-btn lib-edit-btn">Edit</button>
        <button class="lib-action-btn lib-delete-btn">Delete</button>
      </div>
    </div>
  `;

  card.querySelector('.lib-copy-btn').addEventListener('click', () => copyBlock(block, card));
  card.querySelector('.lib-edit-btn').addEventListener('click', () => {
    openEditor(CATEGORIES.find(c => c.slug === slug), block);
  });
  card.querySelector('.lib-delete-btn').addEventListener('click', () => deleteBlock(block));

  return card;
}

// ── Editor ──────────────────────────────────────────────────
let activeEditorSlug = null;

function openEditor(cat, existingBlock) {
  if (activeEditorSlug && activeEditorSlug !== cat.slug) closeEditor(activeEditorSlug);
  activeEditorSlug = cat.slug;

  const wrap   = document.getElementById(`editor-${cat.slug}`);
  const addBtn = document.getElementById(`add-btn-${cat.slug}`);
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="lib-editor">
      <div class="lib-editor-top">
        <input class="lib-label-input" id="editor-label-${cat.slug}" type="text"
          placeholder="Block label/title"
          value="${escHtml(existingBlock?.label || '')}">
        <span class="lib-editor-wordcount" id="editor-wc-${cat.slug}">0 words</span>
      </div>
      <textarea class="lib-editor-textarea" id="editor-text-${cat.slug}"
        placeholder="Write your ${cat.label.toLowerCase()} here…"
        rows="8">${escHtml(existingBlock?.text || '')}</textarea>
      <div class="lib-editor-actions">
        <div class="lib-editor-left">
          <button class="btn-secondary lib-draft-btn" id="draft-btn-${cat.slug}">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="margin-right:4px;flex-shrink:0;vertical-align:middle;"><path d="M2 9L6 2L10 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>Draft with AI
          </button>
          <span class="lib-draft-status" id="draft-status-${cat.slug}"></span>
        </div>
        <div class="lib-editor-right">
          <button class="btn-secondary" id="cancel-btn-${cat.slug}">Cancel</button>
          <button class="btn-primary" id="save-btn-${cat.slug}">${existingBlock ? 'Save changes' : 'Save block'}</button>
        </div>
      </div>
    </div>
  `;

  wrap.style.display = 'block';
  if (addBtn) addBtn.style.display = 'none';

  const textarea = document.getElementById(`editor-text-${cat.slug}`);
  const wcEl     = document.getElementById(`editor-wc-${cat.slug}`);
  const updateWC = () => { wcEl.textContent = `${countWords(textarea.value)} words`; };
  textarea.addEventListener('input', updateWC);
  updateWC();
  setTimeout(() => textarea.focus(), 50);

  document.getElementById(`cancel-btn-${cat.slug}`)
    .addEventListener('click', () => closeEditor(cat.slug));
  document.getElementById(`save-btn-${cat.slug}`)
    .addEventListener('click', () => saveBlock(cat, existingBlock));
  document.getElementById(`draft-btn-${cat.slug}`)
    .addEventListener('click', () => draftWithAI(cat));
}

function closeEditor(slug) {
  const wrap   = document.getElementById(`editor-${slug}`);
  const addBtn = document.getElementById(`add-btn-${slug}`);
  if (wrap)   { wrap.style.display = 'none'; wrap.innerHTML = ''; }
  if (addBtn) addBtn.style.display = '';
  if (activeEditorSlug === slug) activeEditorSlug = null;
}

// ── Save / Delete ───────────────────────────────────────────
async function saveBlock(cat, existingBlock) {
  if (!currentUser) return;

  const textarea = document.getElementById(`editor-text-${cat.slug}`);
  const labelEl  = document.getElementById(`editor-label-${cat.slug}`);
  const text     = textarea?.value.trim();
  if (!text) { textarea?.focus(); return; }

  const block = {
    id:        existingBlock?.id || Date.now().toString(),
    category:  cat.slug,
    label:     labelEl?.value.trim() || '',
    text,
    wordCount: countWords(text),
    savedAt:   new Date().toISOString(),
  };

  const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
  try {
    if (existingBlock) await updateDoc(orgRef, { library: arrayRemove(existingBlock) });
    await updateDoc(orgRef, { library: arrayUnion(block) });
    document.getElementById('dot-4')?.classList.add('active');
    closeEditor(cat.slug);
    await reloadLibrary();
  } catch (err) {
    console.error('Save error:', err);
    alert('Error saving — please try again.');
  }
}

async function deleteBlock(block) {
  if (!currentUser) return;
  if (!confirm('Delete this block? This cannot be undone.')) return;
  const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
  try {
    await updateDoc(orgRef, { library: arrayRemove(block) });
    await reloadLibrary();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Error deleting — please try again.');
  }
}

// ── AI Draft ────────────────────────────────────────────────
async function draftWithAI(cat) {
  const textarea = document.getElementById(`editor-text-${cat.slug}`);
  const statusEl = document.getElementById(`draft-status-${cat.slug}`);
  const draftBtn = document.getElementById(`draft-btn-${cat.slug}`);
  if (!textarea || !statusEl) return;

  if (textarea.value.trim() && !confirm('This will replace your current draft. Continue?')) return;

  draftBtn.disabled     = true;
  statusEl.textContent  = 'Drafting…';
  statusEl.style.color  = 'var(--muted)';

  try {
    const resp = await fetch(`${WORKER_URL}/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 512,
        system:     'You are an expert grant writer helping a small nonprofit build reusable narrative blocks. Write clearly and specifically. Do not include headers, labels, or meta-commentary — return only the requested text.',
        messages:   [{ role: 'user', content: cat.draftPrompt(orgData || {}) }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error?.message || `Worker error ${resp.status}`);

    const text = (data.content?.[0]?.text || '').trim();
    if (!text) throw new Error('Empty response');

    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
    statusEl.textContent = 'Draft ready — review and edit before saving.';
    statusEl.style.color = 'var(--accent-1)';
  } catch (err) {
    console.error('Draft error:', err);
    statusEl.textContent = 'Draft failed — try again.';
    statusEl.style.color = 'var(--accent-4)';
  } finally {
    draftBtn.disabled = false;
  }
}

// ── Copy ────────────────────────────────────────────────────
function copyBlock(block, cardEl) {
  navigator.clipboard.writeText(block.text).then(() => {
    const btn  = cardEl.querySelector('.lib-copy-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => alert('Could not copy — please select and copy manually.'));
}

// ── Load ────────────────────────────────────────────────────
async function reloadLibrary() {
  if (!currentUser) return;
  const orgSnap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'org'));
  if (!orgSnap.exists()) return;
  orgData = orgSnap.data();
  renderLibrary(orgData.library || []);
}

// ── Utilities ───────────────────────────────────────────────
function countWords(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}
function escHtml(str) {
  return (str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Auth ────────────────────────────────────────────────────
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

  const orgSnap = await getDoc(doc(db, 'users', user.uid, 'data', 'org'));
  if (orgSnap.exists()) {
    orgData = orgSnap.data();
    populateSidebarCard(orgData);
    const checks = [orgData?.name, orgData?.evaluations?.length, orgData?.applications?.length,
                    orgData?.library?.length, orgData?.pipeline?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });
  }

  await reloadLibrary();
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
document.getElementById('settings-btn')?.addEventListener('click', () => {
  alert('Settings coming soon.');
});
