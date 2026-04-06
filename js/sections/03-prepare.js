// Groundwork — Section 03: Prepare Your Application

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { populateSidebarCard } from '../sidebar-org-card.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const WORKER_URL = 'https://groundwork-proxy.avengingophelia.workers.dev';

let currentUser = null;
let extracted   = null;
let docStatuses = {};
let timelineChecked = {};

// ── Fetch RFP from URL via Cloudflare Worker ────────────────
async function fetchRFPFromURL(url) {
  const resp = await fetch(`${WORKER_URL}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || `Worker returned ${resp.status}`);
  return data.text;
}

// ── Analyze RFP via Anthropic API (proxied through Worker) ──
async function analyzeRFP(rfpText, orgContext) {
  const systemPrompt = `You are an expert grant writer helping a small nonprofit analyze a grant RFP. Extract structured information from the RFP text provided. Return ONLY valid JSON matching this exact schema — no markdown, no explanation, just the JSON object:

{
  "deadline": "string — exact deadline date and time if stated, or 'Not specified'",
  "amount": "string — award amount or range, e.g. 'Up to $50,000' or 'Not specified'",
  "eligibility": "string — who is eligible to apply, concise",
  "limits": "string — page limits, word counts, character limits, or 'Not specified'",
  "attachments": "string — required attachments and supporting documents as a comma-separated list",
  "special": "string — match requirements, data collection expectations, partnership requirements, or 'None stated'",
  "criteria": [
    { "label": "string — criterion name", "points": "string — point value or weight, e.g. '25 points' or 'Not weighted'" }
  ],
  "sections": [
    { "title": "string — section title", "note": "string — brief description of what this section should contain", "points": "string — point value if stated, else ''", "limit": "string — page or word limit if stated, else ''" }
  ]
}

If you cannot find a field, use 'Not specified' for strings and [] for arrays. Be concise and accurate.`;

  const userPrompt = orgContext
    ? `Organization context:\n${orgContext}\n\nRFP text:\n${rfpText}`
    : `RFP text:\n${rfpText}`;

  const resp = await fetch(`${WORKER_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: 2048,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error?.message || JSON.stringify(data.error) || `Worker returned ${resp.status}`);
  let text = data.content?.[0]?.text || '';
  // Strip markdown code fences if present
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(text);
}

// ── Render extracted panel ──────────────────────────────────
function renderExtracted(data) {
  extracted = data;

  document.getElementById('ext-deadline').textContent    = data.deadline   || '';
  document.getElementById('ext-amount').textContent      = data.amount     || '';
  document.getElementById('ext-eligibility').textContent = data.eligibility || '';
  document.getElementById('ext-limits').textContent      = data.limits     || '';
  document.getElementById('ext-attachments').textContent = data.attachments || '';
  document.getElementById('ext-special').textContent     = data.special    || '';

  // Sections
  document.getElementById('ext-sections').textContent =
    (data.sections || []).map(s => s.title).join('\n');

  // Criteria
  const clist = document.getElementById('ext-criteria-list');
  clist.innerHTML = '';
  if (data.criteria?.length) {
    data.criteria.forEach(c => {
      const el = document.createElement('div');
      el.className = 'criteria-item';
      el.innerHTML = `<span class="criteria-pts">${c.points}</span><span>${c.label}</span>`;
      clist.appendChild(el);
    });
  } else {
    clist.innerHTML = '<div class="extracted-value">Not specified</div>';
  }

  document.getElementById('extracted-panel').classList.add('show');

  // Build downstream sections
  renderOutline(data);
  renderTimeline(data.deadline);
  renderDocChecklist(data);

  // Show everything
  ['rule-outline','step-outline','rule-timeline','step-timeline',
   'rule-docs','step-docs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  document.getElementById('save-btn').style.display = '';
  document.getElementById('step-num-1').classList.add('done');
}

// ── Proposal outline ────────────────────────────────────────
function renderOutline(data) {
  const list = document.getElementById('outline-list');
  list.innerHTML = '';

  const sections = data.sections?.length ? data.sections : defaultSections();

  sections.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'outline-section';
    const metaParts = [];
    if (s.points) metaParts.push(s.points);
    if (s.limit)  metaParts.push(s.limit);
    el.innerHTML = `
      <div class="outline-section-title">${i + 1}. ${s.title}</div>
      ${metaParts.length ? `<div class="outline-section-meta">${metaParts.map(p=>`<span>${p}</span>`).join('')}</div>` : ''}
      ${s.note ? `<div class="outline-section-tip">${s.note}</div>` : ''}`;
    list.appendChild(el);
  });
}

function defaultSections() {
  return [
    { title: 'Executive Summary', note: 'A concise overview of your organization, the project, and the funding request. Written last, placed first.', points: '', limit: '' },
    { title: 'Statement of Need', note: 'Data-driven description of the problem your project addresses and the population affected.', points: '', limit: '' },
    { title: 'Project Description', note: 'Goals, objectives, activities, timeline, and staff responsible. Should flow directly from your needs statement.', points: '', limit: '' },
    { title: 'Evaluation Plan', note: 'How you will measure success. Include both process measures (what you did) and outcome measures (what changed).', points: '', limit: '' },
    { title: 'Organizational Capacity', note: 'Why your organization is uniquely positioned to do this work. Include relevant experience, partnerships, and credentials.', points: '', limit: '' },
    { title: 'Budget and Budget Narrative', note: 'Line-item budget with a written justification for each expense. Numbers must match the narrative.', points: '', limit: '' },
    { title: 'Sustainability Plan', note: 'How the project continues after the grant period ends. Be specific about future funding sources.', points: '', limit: '' },
  ];
}

// ── Timeline ────────────────────────────────────────────────
function renderTimeline(deadlineStr) {
  const list = document.getElementById('timeline-list');
  list.innerHTML = '';

  let deadlineDate = null;
  if (deadlineStr && deadlineStr !== 'Not specified') {
    const parsed = new Date(deadlineStr);
    if (!isNaN(parsed)) deadlineDate = parsed;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const milestones = [
    { label: 'Kickoff — assign roles, confirm RFP requirements', daysBack: 42, note: 'Review RFP together as a team. Resolve any ambiguities before writing starts.' },
    { label: 'Research complete — data, citations, partner letters requested', daysBack: 35, note: 'All data for needs statement gathered. LOI or letters of support requested from partners.' },
    { label: 'Outline approved', daysBack: 28, note: 'Agree on structure before anyone writes a word. Harder to restructure later.' },
    { label: 'First draft complete', daysBack: 21, note: 'Full narrative draft, including budget. Not polished — just complete.' },
    { label: 'Internal review complete', daysBack: 14, note: 'Leadership and any key stakeholders have reviewed and given feedback.' },
    { label: 'Budget finalized and signed off', daysBack: 10, note: 'Final numbers approved by finance. Budget narrative matches exactly.' },
    { label: 'Final proofread and compliance check', daysBack: 5, note: 'Check every requirement in the RFP: page limits, attachments, format, font, margins.' },
    { label: 'Submit', daysBack: 0, note: deadlineStr && deadlineStr !== 'Not specified' ? `Deadline: ${deadlineStr}` : 'Your deadline.' },
  ];

  milestones.forEach((m, i) => {
    let dateStr = '';
    let dateClass = '';

    if (deadlineDate) {
      const d = new Date(deadlineDate);
      d.setDate(d.getDate() - m.daysBack);
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const diff = Math.ceil((d - today) / 86400000);
      if (diff < 0)  dateClass = 'past';
      else if (diff <= 7) dateClass = 'soon';
    } else {
      dateStr = `−${m.daysBack} days`;
    }

    const item = document.createElement('div');
    item.className = 'timeline-item';
    const checked = timelineChecked[i] ? 'checked' : '';
    item.innerHTML = `
      <div class="timeline-check ${checked}" data-idx="${i}" onclick="window._toggleTimeline(${i}, this)">
        ${timelineChecked[i] ? '✓' : ''}
      </div>
      <div class="timeline-date ${dateClass}">${dateStr}</div>
      <div>
        <div class="timeline-label">${m.label}</div>
        <div class="timeline-note">${m.note}</div>
      </div>`;
    list.appendChild(item);
  });

  window._toggleTimeline = (idx, el) => {
    timelineChecked[idx] = !timelineChecked[idx];
    el.classList.toggle('checked');
    el.textContent = timelineChecked[idx] ? '✓' : '';
  };
}

// ── Document checklist ──────────────────────────────────────
function renderDocChecklist(data) {
  const list = document.getElementById('doc-list');
  list.innerHTML = '';

  const standardDocs = [
    { id: 'irs', name: 'IRS determination letter', note: '501(c)(3) tax-exempt status letter from the IRS. Most funders require this.' },
    { id: 'fin', name: 'Current financials', note: 'Most recent audited financial statements, or year-end financial report if not audited.' },
    { id: 'board', name: 'Board of directors list', note: 'Names, titles, and affiliations. Some funders want contact information as well.' },
    { id: 'budget', name: 'Project budget', note: 'Line-item budget for the proposed project. Must match your budget narrative.' },
    { id: 'org-budget', name: 'Organizational budget', note: 'Full operating budget for the current fiscal year.' },
    { id: 'narrative', name: 'Project narrative', note: 'The main proposal document addressing all required sections.' },
    { id: 'eval', name: 'Evaluation plan', note: 'How you will measure project outcomes. Sometimes integrated into the narrative.' },
    { id: 'letters', name: 'Letters of support', note: 'From partners, community members, or other stakeholders who support this project.' },
    { id: 'logic', name: 'Logic model', note: 'Visual diagram linking your inputs, activities, outputs, and outcomes.' },
    { id: 'resume', name: 'Key staff resumes / bios', note: 'Qualifications of staff who will lead the funded work.' },
  ];

  // Add any funder-specific attachments extracted from RFP
  const rfpAttachments = (data.attachments || '')
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s && s !== 'Not specified');

  rfpAttachments.forEach((att, i) => {
    const id = `rfp-att-${i}`;
    if (!standardDocs.find(d => d.name.toLowerCase().includes(att.toLowerCase().substring(0, 10)))) {
      standardDocs.push({ id, name: att, note: 'Required by this funder per the RFP.' });
    }
  });

  standardDocs.forEach(doc => {
    const status = docStatuses[doc.id] || 'unset';
    const item = document.createElement('div');
    item.className = 'doc-item';
    item.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">${doc.name}</div>
        <div class="doc-note">${doc.note}</div>
        <div class="doc-status">
          <button class="doc-status-btn ${status==='have'?'active-have':''}" onclick="window._setDocStatus('${doc.id}','have',this)">Have it</button>
          <button class="doc-status-btn ${status==='need'?'active-need':''}" onclick="window._setDocStatus('${doc.id}','need',this)">Need to get</button>
          <button class="doc-status-btn ${status==='na'?'active-na':''}"   onclick="window._setDocStatus('${doc.id}','na',this)">N/A</button>
        </div>
      </div>`;
    list.appendChild(item);
  });

  window._setDocStatus = (id, status, btn) => {
    docStatuses[id] = status;
    const row = btn.closest('.doc-item');
    row.querySelectorAll('.doc-status-btn').forEach(b =>
      b.classList.remove('active-have','active-need','active-na'));
    const cls = status === 'have' ? 'active-have' : status === 'need' ? 'active-need' : 'active-na';
    btn.classList.add(cls);
  };
}

// ── Save to Firestore ───────────────────────────────────────
async function savePreparation() {
  if (!currentUser || !extracted) return;
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className   = 'save-status';

  const preparation = {
    opportunityName:  document.getElementById('opp-name-s3')?.value.trim() || '',
    extracted: {
      deadline:    document.getElementById('ext-deadline')?.textContent.trim(),
      amount:      document.getElementById('ext-amount')?.textContent.trim(),
      eligibility: document.getElementById('ext-eligibility')?.textContent.trim(),
      limits:      document.getElementById('ext-limits')?.textContent.trim(),
      attachments: document.getElementById('ext-attachments')?.textContent.trim(),
      special:     document.getElementById('ext-special')?.textContent.trim(),
      criteria:    extracted.criteria,
      sections:    extracted.sections,
    },
    docStatuses,
    timelineChecked,
    savedAt: new Date().toISOString(),
  };

  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await updateDoc(orgRef, { applications: [preparation] });
    document.getElementById('dot-3')?.classList.add('active');
    statusEl.textContent = 'Saved ✓';
    statusEl.className   = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className   = 'save-status error';
  }
}

// ── Fetch button ────────────────────────────────────────────
document.getElementById('fetch-btn')?.addEventListener('click', async () => {
  const url = document.getElementById('rfp-url')?.value.trim();
  const statusEl = document.getElementById('fetch-status');

  if (!url) { document.getElementById('rfp-url').focus(); return; }

  const fetchBtn = document.getElementById('fetch-btn');
  fetchBtn.disabled = true;
  fetchBtn.textContent = 'Fetching…';
  statusEl.textContent = '';
  statusEl.style.color = 'var(--muted)';

  try {
    const text = await fetchRFPFromURL(url);
    document.getElementById('rfp-text').value = text;
    statusEl.textContent = `✓ Fetched ${text.length.toLocaleString()} characters. Review below, then click Analyze.`;
    statusEl.style.color = '#2E6020';
    document.getElementById('char-count').textContent = `${text.length.toLocaleString()} characters`;
  } catch (err) {
    statusEl.textContent = `Couldn't fetch that URL — ${err.message}. Try pasting the text directly instead.`;
    statusEl.style.color = 'var(--accent-4)';
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'Fetch →';
  }
});

// ── Analyze button ──────────────────────────────────────────
document.getElementById('analyze-btn')?.addEventListener('click', async () => {
  const rfpText = document.getElementById('rfp-text')?.value.trim();
  if (!rfpText) {
    document.getElementById('rfp-text').focus();
    return;
  }

  const analyzeBtn   = document.getElementById('analyze-btn');
  const indicator    = document.getElementById('analyzing-indicator');
  const msgs = ['Reading the RFP…', 'Identifying requirements…', 'Building proposal outline…', 'Almost done…'];
  let msgIdx = 0;

  analyzeBtn.disabled = true;
  indicator.classList.add('show');
  const msgEl = document.getElementById('analyzing-msg');
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % msgs.length;
    msgEl.textContent = msgs[msgIdx];
  }, 2500);

  // Gather org context if available
  let orgContext = '';
  if (currentUser) {
    try {
      const orgRef  = doc(db, 'users', currentUser.uid, 'data', 'org');
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        const org = orgSnap.data();
        orgContext = [
          org.name ? `Organization: ${org.name}` : '',
          org.mission ? `Mission: ${org.mission}` : '',
          org.budget ? `Budget: ${org.budget}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch(e) { /* non-fatal */ }
  }

  try {
    const data = await analyzeRFP(rfpText, orgContext);
    renderExtracted(data);
  } catch (err) {
    console.error('Analysis error:', err);
    alert('Something went wrong analyzing the RFP. Check the console for details, then try again.');
  } finally {
    clearInterval(msgInterval);
    indicator.classList.remove('show');
    analyzeBtn.disabled = false;
  }
});

document.getElementById('re-analyze-btn')?.addEventListener('click', () => {
  document.getElementById('extracted-panel').classList.remove('show');
  ['rule-outline','step-outline','rule-timeline','step-timeline',
   'rule-docs','step-docs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('save-btn').style.display = 'none';
  document.getElementById('rfp-text')?.focus();
});

document.getElementById('save-btn')?.addEventListener('click', savePreparation);

// Character count
document.getElementById('rfp-text')?.addEventListener('input', function() {
  const n = this.value.length;
  document.getElementById('char-count').textContent = n ? `${n.toLocaleString()} characters` : '';
});

// ── Auth ────────────────────────────────────────────────────
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

  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    populateSidebarCard(org);
    const checks = [org?.name, org?.evaluations?.length, org?.applications?.length,
                    org?.library?.length, org?.pipeline?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });

    // Restore saved preparation if exists
    if (org.applications?.length) {
      const saved = org.applications[0];
      if (saved.opportunityName) {
        const nameEl = document.getElementById('opp-name-s3');
        if (nameEl) nameEl.value = saved.opportunityName;
      }
      if (saved.docStatuses) docStatuses = saved.docStatuses;
      if (saved.timelineChecked) timelineChecked = saved.timelineChecked;
    }
  }
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
