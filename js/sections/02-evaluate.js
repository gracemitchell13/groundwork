// Groundwork — Section 02: Evaluate This Opportunity

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let answers = {}; // { q0: 2, q1: 1, ... }

// ── Questions data ──────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q0',
    text: 'Does this opportunity align with your mission and current programs?',
    why: 'Mission fit is the single most important factor. Funders fund what they fund — if you have to stretch your work to fit their priorities, the application will feel forced and probably won\'t succeed. A strong fit means you could describe your work and their priorities in the same sentence without reaching.',
    options: [
      { label: 'Strong fit — this is exactly what we do', value: 2, cls: 'sel-yes' },
      { label: 'Partial fit — adjacent to our work', value: 1, cls: 'sel-maybe' },
      { label: 'Weak fit — we\'d need to stretch', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q1',
    text: 'Do you meet all stated eligibility requirements?',
    why: 'Eligibility is binary — you either qualify or you don\'t. Check for geographic restrictions, budget minimums and maximums, 501(c)(3) requirements, years in operation, and population restrictions. If you\'re unsure about any requirement, contact the funder before investing time in an application.',
    options: [
      { label: 'Yes — we meet every requirement', value: 2, cls: 'sel-yes' },
      { label: 'Mostly — one requirement is unclear', value: 1, cls: 'sel-maybe' },
      { label: 'No — we don\'t meet a key requirement', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q2',
    text: 'Is there enough time to write a strong application before the deadline?',
    why: 'A rushed application is worse than no application — it reflects poorly on your organization. Budget at least 3–4 weeks for a foundation grant, 6–8 weeks for anything requiring a full narrative, budget, and letters of support. If the deadline is in less than two weeks and you haven\'t started, consider passing.',
    deadlineAuto: true,
    options: [
      { label: 'Yes — plenty of time (4+ weeks)', value: 2, cls: 'sel-yes' },
      { label: 'Tight but possible (2–4 weeks)', value: 1, cls: 'sel-maybe' },
      { label: 'No — not enough time to do it well', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q3',
    text: 'Is the award amount appropriate for your organization and this project?',
    why: 'Most funders won\'t award a grant that represents more than 25–30% of your total budget — it creates too much dependency. They also won\'t fund a $50,000 project with a $5,000 grant if it doesn\'t make sense programmatically. Know your ask-to-budget ratio before you apply.',
    options: [
      { label: 'Yes — amount is a good fit', value: 2, cls: 'sel-yes' },
      { label: 'Somewhat — amount is high or low but workable', value: 1, cls: 'sel-maybe' },
      { label: 'No — amount is mismatched with our budget or project', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q4',
    text: 'Does your organization have the capacity to write, manage, and report on this grant?',
    why: 'Winning a grant creates obligations. You\'ll need to deliver on what you promise, track data, and submit reports — often for 1–3 years. If your team is already stretched thin, a new grant can cause more harm than good. Be honest about what you can actually take on.',
    options: [
      { label: 'Yes — we have the bandwidth', value: 2, cls: 'sel-yes' },
      { label: 'Maybe — it would be a stretch', value: 1, cls: 'sel-maybe' },
      { label: 'No — we don\'t have capacity right now', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q5',
    text: 'What is your relationship with this funder?',
    why: 'Funder relationships matter enormously. First-time applicants to a funder have a much lower success rate than returning grantees. If you\'ve never interacted with this funder, consider requesting an introductory call before applying. Many funders fund organizations they already know.',
    options: [
      { label: 'Strong — we\'ve been funded by them or have a relationship', value: 2, cls: 'sel-yes' },
      { label: 'Some — we\'ve had contact or a warm introduction', value: 1, cls: 'sel-maybe' },
      { label: 'None — we\'re coming in completely cold', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q6',
    text: 'Are the reporting and compliance requirements manageable?',
    why: 'Some grants require quarterly reports, audited financials, site visits, or complex data collection. If the reporting requirements are more burdensome than the grant is worth, that\'s a real cost. Read the full requirements — including what happens after the grant — before you decide to apply.',
    options: [
      { label: 'Yes — requirements are straightforward', value: 2, cls: 'sel-yes' },
      { label: 'Manageable but significant', value: 1, cls: 'sel-maybe' },
      { label: 'No — requirements are too burdensome', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q7',
    text: 'If funded, can you sustain this work when the grant ends?',
    why: 'Most funders don\'t want to be your permanent source of funding for a program. They expect you to have a plan for what happens when the grant period ends. If you can\'t answer this question, it will show in your application — and it\'s a sign the project may not be ready to propose.',
    options: [
      { label: 'Yes — we have a sustainability plan', value: 2, cls: 'sel-yes' },
      { label: 'Possibly — we\'re working on it', value: 1, cls: 'sel-maybe' },
      { label: 'No — we haven\'t thought this through yet', value: 0, cls: 'sel-no' },
    ]
  },
];

// ── Render questions ────────────────────────────────────────
function renderQuestions() {
  const wrap = document.getElementById('questions-wrap');
  if (!wrap) return;

  QUESTIONS.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.id = `card-${q.id}`;

    // For deadline question, add days-remaining note if available
    let deadlineNote = '';
    if (q.deadlineAuto && window.deadlineDays !== undefined) {
      const days = window.deadlineDays;
      const noteColor = days > 28 ? 'var(--accent-1)' : days > 14 ? 'var(--accent-2)' : 'var(--accent-4)';
      const noteText  = days < 0  ? 'The deadline has already passed.' :
                        days === 0 ? 'The deadline is today.' :
                        `There are ${days} days until the deadline.`;
      deadlineNote = `<div style="font-size:14px;font-weight:500;color:${noteColor};margin-bottom:12px;padding:8px 12px;background:rgba(0,0,0,0.04);border-radius:6px;">${noteText}</div>`;

      // Auto-select the appropriate answer
      const autoValue = days > 28 ? 2 : days > 14 ? 1 : 0;
      const autoCls   = days > 28 ? 'sel-yes' : days > 14 ? 'sel-maybe' : 'sel-no';
      answers[q.id]   = { value: autoValue, cls: autoCls };
    }

    const optionsHTML = q.options.map(opt => {
      const preSelected = answers[q.id]?.cls === opt.cls ? ` ${opt.cls}` : '';
      return `<button class="q-option${preSelected}" data-qid="${q.id}" data-value="${opt.value}" data-cls="${opt.cls}">${opt.label}</button>`;
    }).join('');

    // Pre-color the card if auto-answered
    if (answers[q.id]) {
      const cls = answers[q.id].cls;
      card.classList.add(cls === 'sel-yes' ? 'answered' : cls === 'sel-maybe' ? 'answered-caution' : 'answered-no');
    }

    card.innerHTML = `
      <div class="q-number">Question ${idx + 1} of ${QUESTIONS.length}</div>
      <div class="q-text">${q.text}</div>
      ${deadlineNote}
      <div class="q-options">${optionsHTML}</div>
      <button class="q-why-toggle" type="button">
        <span class="arrow">▶</span> Why this matters
      </button>
      <div class="q-why">${q.why}</div>`;

    wrap.appendChild(card);
  });

  // Option click handler
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.q-option');
    if (!btn) return;
    const qid   = btn.dataset.qid;
    const value = parseInt(btn.dataset.value);
    const cls   = btn.dataset.cls;

    answers[qid] = { value, cls };

    // Update button states
    btn.closest('.q-options').querySelectorAll('.q-option').forEach(b => {
      b.classList.remove('sel-yes', 'sel-maybe', 'sel-no');
    });
    btn.classList.add(cls);

    // Update card border
    const card = document.getElementById(`card-${qid}`);
    card.classList.remove('answered', 'answered-caution', 'answered-no');
    if (cls === 'sel-yes')   card.classList.add('answered');
    if (cls === 'sel-maybe') card.classList.add('answered-caution');
    if (cls === 'sel-no')    card.classList.add('answered-no');

    // Auto-show result if all answered
    if (Object.keys(answers).length === QUESTIONS.length) {
      showResult();
    }
  });
}

// ── Calculate and show result ───────────────────────────────
function showResult() {
  const score = Object.values(answers).reduce((sum, a) => sum + a.value, 0);
  const maxScore = QUESTIONS.length * 2;

  let tier, headline, summary;

  if (score >= 13) {
    tier = 'apply';
    headline = 'This opportunity is worth pursuing.';
    summary = `Your score of ${score} out of ${maxScore} indicates strong alignment between this opportunity and your organization. You have good mission fit, appear eligible, and have the capacity to pursue this. Move forward with the application.`;
  } else if (score >= 9) {
    tier = 'caution';
    headline = 'Proceed with caution.';
    summary = `Your score of ${score} out of ${maxScore} suggests this opportunity has real potential but some meaningful concerns. Review the flagged areas below carefully before committing time to an application. It may be worth a conversation with the funder before proceeding.`;
  } else {
    tier = 'pass';
    headline = 'Consider passing on this one.';
    summary = `Your score of ${score} out of ${maxScore} indicates significant barriers to a successful application. Investing time in this grant right now is likely not the best use of your capacity. The concerns flagged below are worth addressing before you apply — either to this funder in a future cycle, or to similar opportunities.`;
  }

  // Build flags
  const flagMap = {
    q0: { good: 'Strong mission alignment', caution: 'Partial mission alignment — clarify the connection', bad: 'Weak mission fit — consider passing' },
    q1: { good: 'You meet all eligibility requirements', caution: 'One eligibility requirement is unclear — confirm before applying', bad: 'You don\'t meet a key requirement — do not apply' },
    q2: { good: 'Sufficient time to write a strong application', caution: 'Timeline is tight — prioritize ruthlessly', bad: 'Not enough time — consider waiting for the next cycle' },
    q3: { good: 'Award amount is well-matched', caution: 'Award amount may require explanation in your budget narrative', bad: 'Amount mismatch — reconsider the ask or the opportunity' },
    q4: { good: 'Your team has the capacity to manage this grant', caution: 'Capacity is stretched — identify who will own this', bad: 'Insufficient capacity — do not overcommit your team' },
    q5: { good: 'You have an existing funder relationship', caution: 'Limited relationship — consider a pre-application outreach call', bad: 'No relationship — prioritize introduction before applying' },
    q6: { good: 'Reporting requirements are manageable', caution: 'Reporting is significant — plan accordingly', bad: 'Reporting burden may outweigh the grant value' },
    q7: { good: 'You have a sustainability plan', caution: 'Sustainability plan needs development — address this in your narrative', bad: 'No sustainability plan — this will be a gap in your application' },
  };

  const flagsList = document.getElementById('result-flags');
  flagsList.innerHTML = '';
  QUESTIONS.forEach(q => {
    const a = answers[q.id];
    if (!a) return;
    const flagType = a.value === 2 ? 'good' : a.value === 1 ? 'caution' : 'bad';
    const flagClass = a.value === 2 ? 'flag-good' : a.value === 1 ? 'flag-caution' : 'flag-bad';
    const li = document.createElement('li');
    li.className = `result-flag ${flagClass}`;
    li.textContent = flagMap[q.id][flagType];
    flagsList.appendChild(li);
  });

  // Update result panel
  const panel = document.getElementById('result-panel');
  panel.className = `result-panel show result-${tier}`;
  document.getElementById('result-label').textContent =
    tier === 'apply' ? 'Recommendation: Apply' :
    tier === 'caution' ? 'Recommendation: Proceed with Caution' : 'Recommendation: Pass';
  document.getElementById('result-headline').textContent = headline;
  document.getElementById('result-score').textContent = `Score: ${score} / ${maxScore}`;
  document.getElementById('result-summary').textContent = summary;

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Save evaluation ─────────────────────────────────────────
document.getElementById('evaluate-btn')?.addEventListener('click', () => {
  if (Object.keys(answers).length < QUESTIONS.length) {
    const unanswered = QUESTIONS.length - Object.keys(answers).length;
    document.getElementById('save-status').textContent =
      `Please answer all questions (${unanswered} remaining).`;
    document.getElementById('save-status').className = 'save-status error';
    return;
  }
  showResult();
});

document.getElementById('save-eval-btn')?.addEventListener('click', saveEvaluation);

async function saveEvaluation() {
  if (!currentUser) return;
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…';
  statusEl.className = 'save-status';

  const score = Object.values(answers).reduce((sum, a) => sum + a.value, 0);
  const tier  = score >= 13 ? 'apply' : score >= 9 ? 'caution' : 'pass';

  const evaluation = {
    id:           Date.now().toString(),
    name:         document.getElementById('opp-name')?.value.trim() || 'Unnamed opportunity',
    funder:       document.getElementById('opp-funder')?.value.trim(),
    amount:       document.getElementById('opp-amount')?.value.trim(),
    deadline:     document.getElementById('opp-deadline')?.value,
    description:  document.getElementById('opp-desc')?.value.trim(),
    answers,
    score,
    tier,
    savedAt:      new Date().toISOString(),
  };

  try {
    const orgRef = doc(db, 'users', currentUser.uid, 'data', 'org');
    await updateDoc(orgRef, { evaluations: arrayUnion(evaluation) });

    // Update dot 2
    document.getElementById('dot-2')?.classList.add('active');

    statusEl.textContent = 'Evaluation saved ✓';
    statusEl.className = 'save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 3000);

    // Reload previous evals
    await loadPreviousEvals();

    // Reset form for next evaluation
    resetForm();
  } catch (err) {
    console.error('Save error:', err);
    statusEl.textContent = 'Error saving — please try again.';
    statusEl.className = 'save-status error';
  }
}

function resetForm() {
  answers = {};
  ['opp-name','opp-funder','opp-amount','opp-deadline','opp-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.q-option').forEach(b =>
    b.classList.remove('sel-yes','sel-maybe','sel-no'));
  document.querySelectorAll('.q-card').forEach(c =>
    c.classList.remove('answered','answered-caution','answered-no'));
  document.getElementById('result-panel').className = 'result-panel';
}

// ── Load previous evaluations ───────────────────────────────
async function loadPreviousEvals() {
  if (!currentUser) return;
  const orgRef  = doc(db, 'users', currentUser.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;

  const org = orgSnap.data();
  const evals = org.evaluations || [];

  const wrap = document.getElementById('prev-evals-wrap');
  const list = document.getElementById('prev-evals-list');
  if (!wrap || !list) return;

  if (evals.length === 0) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  list.innerHTML = '';

  // Show most recent 5
  [...evals].reverse().slice(0, 5).forEach(ev => {
    const badgeClass = ev.tier === 'apply' ? 'badge-apply' :
                       ev.tier === 'caution' ? 'badge-caution' : 'badge-pass';
    const badgeText  = ev.tier === 'apply' ? 'Apply' :
                       ev.tier === 'caution' ? 'Caution' : 'Pass';
    const date = ev.savedAt ? new Date(ev.savedAt).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    const item = document.createElement('div');
    item.className = 'prev-eval-item';
    item.innerHTML = `
      <span class="prev-eval-badge ${badgeClass}">${badgeText}</span>
      <span class="prev-eval-name">${ev.name}${ev.funder ? ' — ' + ev.funder : ''}</span>
      <span class="prev-eval-date">${date}</span>`;
    list.appendChild(item);
  });
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

  // Load org data for sidebar and dots
  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    const nameEl = document.getElementById('org-name');
    const fullEl = document.getElementById('org-full');
    if (nameEl) nameEl.textContent = org.abbreviation || org.name || '—';
    if (fullEl) fullEl.textContent = org.name || '';
    const checks = [org?.name, org?.evaluations?.length, org?.applications?.length,
                    org?.library?.length, org?.pipeline?.length];
    checks.forEach((val, i) => {
      const dot = document.getElementById(`dot-${i + 1}`);
      if (dot && val) dot.classList.add('active');
    });
  }

  renderQuestions();
  await loadPreviousEvals();
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth).then(() => window.location.href = '../index.html');
});
document.getElementById('settings-btn')?.addEventListener('click', () => {
  alert('Settings coming soon.');
});
