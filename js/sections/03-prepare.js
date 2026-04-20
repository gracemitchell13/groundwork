// Groundwork — Section 03: Prepare Your Application

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, updateDoc, arrayUnion, arrayRemove }
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

// ── Input method tabs ───────────────────────────────────────
document.querySelectorAll('.input-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.input-method-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById(`method-${tab.dataset.method}`).style.display = 'block';
  });
});

// ── Modal open/close ────────────────────────────────────────
function openModal() {
  document.getElementById('results-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('results-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
document.getElementById('results-modal-overlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('reopen-btn')?.addEventListener('click', openModal);

// ── Results tabs (inside modal) ──────────────────────────────
document.querySelectorAll('.results-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.results-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.results-tab-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById(`rtab-${tab.dataset.tab}`).style.display = 'block';
  });
});

// ── File upload ──────────────────────────────────────────────
const fileDropZone = document.getElementById('file-drop-zone');
const fileInput    = document.getElementById('rfp-file');

fileDropZone?.addEventListener('click', () => fileInput?.click());
fileDropZone?.addEventListener('dragover', e => { e.preventDefault(); fileDropZone.classList.add('drag-over'); });
fileDropZone?.addEventListener('dragleave', () => fileDropZone.classList.remove('drag-over'));
fileDropZone?.addEventListener('drop', e => {
  e.preventDefault();
  fileDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput?.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

async function handleFile(file) {
  const statusEl = document.getElementById('file-status');
  statusEl.textContent = `Reading ${file.name}…`;
  statusEl.style.color = 'var(--muted)';

  try {
    let text = '';
    if (file.name.endsWith('.txt')) {
      text = await file.text();
    } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      // Send to Worker for extraction
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${WORKER_URL}/fetch-file`, {
        method: 'POST', body: formData,
      });
      if (!resp.ok) throw new Error('Worker could not read this file');
      const data = await resp.json();
      text = data.text;
    } else if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const resp = await fetch(`${WORKER_URL}/fetch-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'X-Filename': file.name },
        body: arrayBuffer,
      });
      if (!resp.ok) throw new Error('Worker could not read this PDF');
      const data = await resp.json();
      text = data.text;
    } else {
      text = await file.text();
    }

    // Switch to paste tab and populate textarea
    document.querySelector('.input-tab[data-method="paste"]').click();
    const textarea = document.getElementById('rfp-text');
    if (textarea) textarea.value = text;
    document.getElementById('char-count').textContent = `${text.length.toLocaleString()} characters`;
    statusEl.textContent = `✓ ${file.name} loaded — review the text, then click Analyze.`;
    statusEl.style.color = '#2E6020';
  } catch (err) {
    statusEl.textContent = `Couldn't read that file — ${err.message}. Try copying and pasting the text instead.`;
    statusEl.style.color = 'var(--accent-4)';
  }
}

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
  // Strip any markdown code fences Claude may add
  text = text.replace(/```[\w]*\n?/g, '').trim();
  return JSON.parse(text);
}

// ── Render extracted panel ──────────────────────────────────
function renderExtracted(data) {
  extracted = data;

  document.getElementById('ext-deadline').textContent    = data.deadline    || '';
  document.getElementById('ext-amount').textContent      = data.amount      || '';
  document.getElementById('ext-eligibility').textContent = data.eligibility || '';
  document.getElementById('ext-limits').textContent      = data.limits      || '';
  document.getElementById('ext-attachments').textContent = data.attachments || '';
  document.getElementById('ext-special').textContent     = data.special     || '';
  document.getElementById('ext-sections').textContent    =
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

  // Render all tabs
  renderOutline(data);
  renderCalendar(data.deadline);
  renderTimeline(data.deadline);
  renderDocChecklist(data);

  // Update modal title with opportunity name
  const oppName = document.getElementById('opp-name-s3')?.value.trim();
  if (oppName) {
    document.getElementById('results-modal-title').textContent = oppName;
  }

  // Show modal and save bar buttons
  openModal();
  document.getElementById('save-btn').style.display  = '';
  document.getElementById('print-btn').style.display = '';
  document.getElementById('reopen-btn').style.display = '';
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

// ── Calendar ────────────────────────────────────────────────
function renderCalendar(deadlineStr) {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let deadlineDate = null;
  if (deadlineStr && deadlineStr !== 'Not specified') {
    const parsed = new Date(deadlineStr);
    if (!isNaN(parsed)) deadlineDate = parsed;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  // Build milestone map: date string → label
  const milestoneMap = {};
  if (deadlineDate) {
    const milestones = [
      { label: 'Kickoff', daysBack: 42 },
      { label: 'Research complete', daysBack: 35 },
      { label: 'Outline approved', daysBack: 28 },
      { label: 'First draft', daysBack: 21 },
      { label: 'Internal review', daysBack: 14 },
      { label: 'Budget sign-off', daysBack: 10 },
      { label: 'Final proof', daysBack: 5 },
      { label: '⚑ Deadline', daysBack: 0 },
    ];
    milestones.forEach(m => {
      const d = new Date(deadlineDate);
      d.setDate(d.getDate() - m.daysBack);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      milestoneMap[key] = m.label;
    });
  }

  // Determine range: today's month through deadline month (or +2 months)
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth  = deadlineDate
    ? new Date(deadlineDate.getFullYear(), deadlineDate.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth() + 3, 1);

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  let cursor = new Date(startDate);
  while (cursor < endMonth) {
    const year  = cursor.getFullYear();
    const month = cursor.getMonth();

    const header = document.createElement('div');
    header.className = 'cal-month-header';
    header.textContent = `${MONTHS[month]} ${year}`;
    grid.appendChild(header);

    const calGrid = document.createElement('div');
    calGrid.className = 'cal-grid';

    DAYS.forEach(d => {
      const dh = document.createElement('div');
      dh.className = 'cal-day-header';
      dh.textContent = d;
      calGrid.appendChild(dh);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells before first
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day other-month';
      calGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day in-month';

      const thisDate = new Date(year, month, day);
      const key = `${year}-${month}-${day}`;
      const isToday = thisDate.getTime() === today.getTime();
      const isDeadline = deadlineDate &&
        day === deadlineDate.getDate() && month === deadlineDate.getMonth() && year === deadlineDate.getFullYear();

      if (isToday)    cell.classList.add('today');
      if (isDeadline) cell.classList.add('cal-deadline');

      const milestone = milestoneMap[key];
      if (milestone) cell.classList.add('has-milestone');

      cell.innerHTML = `<div class="cal-day-num">${day}</div>
        ${milestone ? `<div class="cal-milestone-dot">${milestone}</div>` : ''}`;
      calGrid.appendChild(cell);
    }

    grid.appendChild(calGrid);
    cursor = new Date(year, month + 1, 1);
  }

  if (!deadlineDate) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:13px;color:var(--muted);margin-top:8px;';
    note.textContent = 'Enter a deadline in the Details tab to see milestone dates on the calendar.';
    grid.appendChild(note);
  }
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
    const item = document.createElement('div');
    item.className = 'doc-item';
    const status = docStatuses[doc.id] || 'unset';
    if (status === 'na') item.classList.add('na-item');
    item.innerHTML = `
      <div class="doc-name">${doc.name}</div>
      <div class="doc-note">${doc.note}</div>
      <div class="doc-status">
        <button class="doc-status-btn ${status==='have'?'active-have':''}" onclick="window._setDocStatus('${doc.id}','have',this)">Have it</button>
        <button class="doc-status-btn ${status==='need'?'active-need':''}" onclick="window._setDocStatus('${doc.id}','need',this)">Need to get</button>
        <button class="doc-status-btn ${status==='na'?'active-na':''}"   onclick="window._setDocStatus('${doc.id}','na',this)">N/A</button>
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
    row.classList.toggle('na-item', status === 'na');
  };
}

// ── Save to Firestore ───────────────────────────────────────
async function savePreparation() {
  if (!currentUser || !extracted) return;
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className   = 'save-status';

  const preparation = {
    id:              Date.now().toString(),
    opportunityName: document.getElementById('opp-name-s3')?.value.trim() || 'Unnamed opportunity',
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
    const activeGrantId = sessionStorage.getItem('gw-active-grant');
    preparation.grantId = activeGrantId || 'org';
    const targetRef = activeGrantId
      ? doc(db, 'users', currentUser.uid, 'grants', activeGrantId)
      : doc(db, 'users', currentUser.uid, 'data', 'org');
    await updateDoc(targetRef, { applications: arrayUnion(preparation) });
    document.getElementById('dot-3')?.classList.add('active');
    statusEl.textContent = 'Saved ✓';
    statusEl.className   = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);
    await loadPreviousPreps();
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
    statusEl.textContent = `✓ Imported ${text.length.toLocaleString()} characters. Click Analyze to continue.`;
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
  closeModal();
  document.getElementById('save-btn').style.display   = 'none';
  document.getElementById('print-btn').style.display  = 'none';
  document.getElementById('reopen-btn').style.display = 'none';
  extracted = null;
  document.getElementById('rfp-text')?.focus();
});

document.getElementById('save-btn')?.addEventListener('click', savePreparation);

// Character count
document.getElementById('rfp-text')?.addEventListener('input', function() {
  const n = this.value.length;
  document.getElementById('char-count').textContent = n ? `${n.toLocaleString()} characters` : '';
});

// ── Print summary ───────────────────────────────────────────
function generatePrintSummary() {
  const name     = document.getElementById('opp-name-s3')?.value.trim() || 'Grant Preparation';
  const deadline = document.getElementById('ext-deadline')?.textContent.trim() || '';
  const amount   = document.getElementById('ext-amount')?.textContent.trim() || '';
  const elig     = document.getElementById('ext-eligibility')?.textContent.trim() || '';
  const limits   = document.getElementById('ext-limits')?.textContent.trim() || '';
  const attach   = document.getElementById('ext-attachments')?.textContent.trim() || '';
  const special  = document.getElementById('ext-special')?.textContent.trim() || '';

  // Outline sections
  const outlineSections = [...(document.getElementById('outline-list')?.children || [])];
  const outlineHTML = outlineSections.map(el => {
    const title = el.querySelector('.outline-section-title')?.textContent || '';
    const meta  = el.querySelector('.outline-section-meta')?.textContent.trim() || '';
    const tip   = el.querySelector('.outline-section-tip')?.textContent || '';
    return `<div class="section-block"><h3>${title}</h3>${meta ? `<p class="meta">${meta}</p>` : ''}${tip ? `<p>${tip}</p>` : ''}</div>`;
  }).join('');

  // Timeline
  const timelineItems = [...(document.getElementById('timeline-list')?.children || [])];
  const timelineHTML = timelineItems.map(el => {
    const date  = el.querySelector('.timeline-date')?.textContent.trim() || '';
    const label = el.querySelector('.timeline-label')?.textContent.trim() || '';
    const done  = el.querySelector('.timeline-check')?.classList.contains('checked') ? '✓' : '○';
    return `<div class="timeline-row"><span class="tl-date">${date}</span><span>${done} ${label}</span></div>`;
  }).join('');

  // Document checklist
  const docItems = [...(document.getElementById('doc-list')?.children || [])];
  const docsHTML = docItems.map(el => {
    const name2  = el.querySelector('.doc-name')?.textContent || '';
    const active = el.querySelector('.doc-status-btn.active-have, .doc-status-btn.active-need, .doc-status-btn.active-na');
    const status = active?.textContent.trim() || 'Not marked';
    return `<div class="doc-row"><span class="doc-status">${status}</span><span>${name2}</span></div>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const calHTML = document.getElementById('calendar-grid')?.innerHTML || '';

  const html = `
    <h1>${name}</h1>
    <p class="meta">Groundwork preparation summary · Generated ${today}</p>

    <h2>Opportunity Details</h2>
    ${deadline ? `<p><strong>Deadline:</strong> ${deadline}</p>` : ''}
    ${amount   ? `<p><strong>Award amount:</strong> ${amount}</p>` : ''}
    ${elig     ? `<p><strong>Eligible applicants:</strong> ${elig}</p>` : ''}
    ${limits   ? `<p><strong>Page/word limits:</strong> ${limits}</p>` : ''}
    ${attach   ? `<p><strong>Required attachments:</strong> ${attach}</p>` : ''}
    ${special && special !== 'None stated' ? `<p><strong>Special requirements:</strong> ${special}</p>` : ''}

    ${outlineHTML ? `<h2>Proposal Outline</h2>${outlineHTML}` : ''}
    ${calHTML     ? `<h2>Writing Timeline</h2>${calHTML}` : ''}
    ${docsHTML    ? `<h2>Document Checklist</h2>${docsHTML}` : ''}

    <div class="footer">Generated by Groundwork · laythegroundwork.org</div>`;

  const printEl = document.getElementById('print-summary');
  if (printEl) {
    printEl.innerHTML = html;
    printEl.style.display = 'block';
  }
  window.print();
  // Hide after print dialog closes
  setTimeout(() => {
    if (printEl) printEl.style.display = 'none';
  }, 1000);
}

document.getElementById('print-btn')?.addEventListener('click', generatePrintSummary);

// ── Previous preparations ───────────────────────────────────
async function loadPreviousPreps() {
  if (!currentUser) return;

  // Collect preparations from all grant docs
  let apps = [];
  try {
    const grantsSnap = await getDocs(collection(db, 'users', currentUser.uid, 'grants'));
    grantsSnap.forEach(d => {
      const data = d.data();
      (data.applications || []).forEach(a => apps.push(a));
    });
  } catch(e) { /* non-fatal */ }

  // Also collect orphan preparations from org doc (legacy saves with no active grant)
  try {
    const orgSnap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'org'));
    if (orgSnap.exists()) {
      (orgSnap.data().applications || [])
        .filter(a => !a.grantId || a.grantId === 'org')
        .forEach(a => apps.push(a));
    }
  } catch(e) { /* non-fatal */ }

  // Sort newest first
  apps.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
  const wrap = document.getElementById('prev-preps-wrap');
  const list = document.getElementById('prev-preps-list');
  if (!wrap || !list) return;

  if (!apps.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = '';

  window._preps      = apps.slice(0, 10);
  window._loadPrep   = (idx) => loadPrep(window._preps[idx]);
  window._deletePrep = (idx) => {
    const prep = window._preps[idx];
    if (!confirm(`Delete preparation for "${prep.opportunityName}"? This cannot be undone.`)) return;
    const targetRef = prep.grantId && prep.grantId !== 'org'
      ? doc(db, 'users', currentUser.uid, 'grants', prep.grantId)
      : doc(db, 'users', currentUser.uid, 'data', 'org');
    updateDoc(targetRef, { applications: arrayRemove(prep) })
      .then(() => loadPreviousPreps())
      .catch(err => { console.error(err); alert('Error deleting — please try again.'); });
  };

  window._preps.forEach((prep, idx) => {
    const date = prep.savedAt
      ? new Date(prep.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const detailId = `prep-detail-${idx}`;

    const detailHTML = `
      <div style="font-size:13px;color:var(--muted);display:flex;gap:20px;flex-wrap:wrap;margin-bottom:10px;">
        ${prep.extracted?.deadline ? `<span><strong style="color:var(--body);">Deadline:</strong> ${prep.extracted.deadline}</span>` : ''}
        ${prep.extracted?.amount   ? `<span><strong style="color:var(--body);">Amount:</strong> ${prep.extracted.amount}</span>` : ''}
      </div>
      ${prep.extracted?.eligibility && prep.extracted.eligibility !== 'Not specified'
        ? `<p style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.5;border-left:2px solid var(--linen-border);padding-left:10px;">${prep.extracted.eligibility}</p>`
        : ''}
      <div style="display:flex;gap:10px;">
        <button class="copy-btn" style="font-size:13px;padding:7px 16px;color:#A04830;border-color:#A04830;" onclick="event.stopPropagation();window._deletePrep(${idx})">Delete</button>
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const header = document.createElement('div');
    header.className    = 'prev-eval-item';
    header.style.cursor = 'pointer';
    header.dataset.target = detailId;
    header.innerHTML = `
      <span class="prev-eval-name">${prep.opportunityName}</span>
      <span class="prev-eval-date">${date}</span>
      <span class="eval-arrow" style="font-size:11px;color:var(--accent-3);flex-shrink:0;">▶ View</span>`;

    header.addEventListener('click', () => {
      const detail = document.getElementById(detailId);
      const arrow  = header.querySelector('.eval-arrow');
      const open   = detail.style.display !== 'none';
      detail.style.display = open ? 'none' : 'block';
      arrow.textContent    = open ? '▶ View' : '▼ Hide';
    });

    const detail = document.createElement('div');
    detail.id = detailId;
    detail.style.cssText = 'display:none;background:#FDFAF2;border:1px solid #C8C0AE;border-top:3px solid var(--accent-3);border-radius:0 0 8px 8px;padding:18px 20px;';
    detail.innerHTML = detailHTML;

    wrapper.appendChild(header);
    wrapper.appendChild(detail);
    list.appendChild(wrapper);
  });
}

function loadPrep(prep) {
  // Populate form
  const nameEl = document.getElementById('opp-name-s3');
  if (nameEl) nameEl.value = prep.opportunityName || '';

  // Restore extracted state
  extracted = prep.extracted || {};
  docStatuses     = prep.docStatuses || {};
  timelineChecked = prep.timelineChecked || {};

  // Render everything
  renderExtracted(extracted);

  // Scroll to top of content
  document.querySelector('.page-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

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

  window._firestoreHelpers = { arrayRemove };

  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    populateSidebarCard(org);

    // Count evals/apps from grants (may have moved off org doc)
    let grantEvalCount = 0, grantAppCount = 0;
    try {
      const gSnap = await getDocs(collection(db, 'users', user.uid, 'grants'));
      gSnap.forEach(d => {
        const gd = d.data();
        grantEvalCount += (gd.evaluations || []).length;
        grantAppCount  += (gd.applications || []).length;
      });
    } catch(e) { /* non-fatal */ }

    const checks = [org?.name,
                    (org?.evaluations?.length || 0) + grantEvalCount,
                    (org?.applications?.length || 0) + grantAppCount,
                    org?.library?.length, org?.pipeline?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });
  }

  // Show active grant in bar if set, and pre-populate form fields
  const activeGrantId = sessionStorage.getItem('gw-active-grant');
  if (activeGrantId) {
    try {
      const grantSnap = await getDoc(doc(db, 'users', user.uid, 'grants', activeGrantId));
      if (grantSnap.exists()) {
        const grant  = grantSnap.data();
        const bar    = document.getElementById('grant-bar');
        const nameEl = document.getElementById('grant-bar-name');
        if (bar)    bar.style.display = 'flex';
        if (nameEl) nameEl.textContent = grant.name + (grant.funder ? ` — ${grant.funder}` : '');

        // Pre-populate opportunity name field
        const nameField = document.getElementById('opp-name-s3');
        if (nameField && !nameField.value) {
          nameField.value = grant.name + (grant.funder ? ` — ${grant.funder}` : '');
        }
      }
    } catch(e) { /* non-fatal */ }
  }

  await loadPreviousPreps();
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
