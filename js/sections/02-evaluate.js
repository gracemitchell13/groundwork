// Groundwork — Section 02: Evaluate This Opportunity

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

let currentUser = null;
let answers = {}; // { q0: 2, q1: 1, ... }

// ── Questions data ──────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q0',
    text: 'Does this opportunity align with your mission and current programs?',
    why: 'Mission fit is the single most important factor. Funders fund what they fund — if you have to stretch your work to fit their priorities, the application will feel forced and probably won\'t succeed.',
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
    why: 'A rushed application is worse than no application — it reflects poorly on your organization. Budget at least 3–4 weeks for a simple grant, 6–8 weeks for anything requiring a full narrative, budget, and letters of support. If the deadline is in less than two weeks and you haven\'t started, consider passing.',
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
    why: 'Winning a grant creates obligations. You\'ll need to deliver on what you promise, track data, and often submit reports — often for multiple years. If your team is already stretched thin, a new grant can cause more harm than good. Be honest about what you can actually take on.',
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
    why: 'Some grants require quarterly reports, audited financials, site visits, or complex data collection. If the reporting requirements are more burdensome than the grant is worth, that\'s a real cost. Read the full requirements, including what happens after the grant, before you decide to apply.',
    options: [
      { label: 'Yes — requirements are straightforward', value: 2, cls: 'sel-yes' },
      { label: 'Manageable but significant', value: 1, cls: 'sel-maybe' },
      { label: 'No — requirements are too burdensome', value: 0, cls: 'sel-no' },
    ]
  },
  {
    id: 'q7',
    text: 'If funded, can you sustain this work when the grant ends?',
    why: 'Most funders don\'t want to be your permanent source of funding for a program. They expect you to have a plan for what happens when the grant period ends. If you can\'t answer this question, it will show in your application; it\'s a sign the project may not be ready to propose.',
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

    // All answered — enable the button but don't auto-fire result
    if (Object.keys(answers).length === QUESTIONS.length) {
      enableEvaluateBtn();
    }
  });
}

// ── Calculate and show result ───────────────────────────────
function showResult() {
  const score    = Object.values(answers).reduce((sum, a) => sum + a.value, 0);
  const maxScore = QUESTIONS.length * 2;
  const name     = document.getElementById('opp-name')?.value.trim() || 'this opportunity';
  const funder   = document.getElementById('opp-funder')?.value.trim();
  const deadline = document.getElementById('opp-deadline')?.value;

  // ── Hard stops ──────────────────────────────────────────
  // Eligibility (q1 = 0): automatic Pass, no score matters
  const eligibilityFailed = answers['q1']?.value === 0;
  // Mission fit (q0 = 0): automatic Pass regardless of score
  const missionFailed     = answers['q0']?.value === 0;

  let tier, headline, hardStopReason = null;

  if (eligibilityFailed) {
    tier            = 'pass';
    headline        = 'Do not apply to this opportunity.';
    hardStopReason  = 'You don\'t meet one or more eligibility requirements. Submitting an application you\'re not eligible for wastes your time and damages your relationship with the funder. Confirm the requirements and consider reaching out to ask if there are exceptions before investing any writing time.';
  } else if (missionFailed) {
    tier            = 'pass';
    headline        = 'This opportunity is not a mission fit.';
    hardStopReason  = 'A weak mission fit is a fundamental barrier. Funders can tell when an organization is stretching to fit their priorities, and applications that feel forced rarely succeed. Pass on this one and look for opportunities where the alignment is genuine.';
  } else if (score >= 13) {
    tier     = 'apply';
    headline = 'This opportunity is worth pursuing.';
  } else if (score >= 9) {
    tier     = 'caution';
    headline = 'Proceed with caution.';
  } else {
    tier     = 'pass';
    headline = 'Consider passing on this one.';
  }

  // Build prose summary
  const oppRef    = funder ? `${name} from ${funder}` : name;
  const dateNote  = deadline ? ` The application deadline is ${new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : '';
  const proseLabels = {
    q0: 'mission alignment', q1: 'eligibility', q2: 'deadline feasibility',
    q3: 'award amount fit',  q4: 'organizational capacity', q5: 'funder relationship',
    q6: 'reporting requirements', q7: 'sustainability planning',
  };

  const weakLabels    = QUESTIONS.filter(q => answers[q.id]?.value === 0).map(q => proseLabels[q.id]);
  const cautionLabels = QUESTIONS.filter(q => answers[q.id]?.value === 1).map(q => proseLabels[q.id]);

  let prose = '';
  if (hardStopReason) {
    const stopType = eligibilityFailed ? 'Eligibility — Hard Stop' : 'Mission Fit — Hard Stop';
    prose = `Groundwork Go/No-Go Evaluation\nOpportunity: ${oppRef}\nScore: ${score} / ${maxScore} — Recommendation: Pass (${stopType})\n\n`;
    prose += hardStopReason;
    prose += `\n\nNext step: Do not apply. Address the issue above before pursuing this or similar opportunities.`;
  } else if (tier === 'apply') {
    prose = `Groundwork Go/No-Go Evaluation\nOpportunity: ${oppRef}\nScore: ${score} / ${maxScore} — Recommendation: Apply\n\n`;
    prose += `This opportunity scored ${score} out of ${maxScore} and is recommended for application.${dateNote} The evaluation found strong mission alignment, eligibility, and organizational capacity.`;
    if (cautionLabels.length) prose += ` A few areas warrant attention during proposal development: ${cautionLabels.join(', ')}.`;
    prose += `\n\nNext step: Proceed with the application.`;
  } else if (tier === 'caution') {
    prose = `Groundwork Go/No-Go Evaluation\nOpportunity: ${oppRef}\nScore: ${score} / ${maxScore} — Recommendation: Proceed with Caution\n\n`;
    prose += `This opportunity scored ${score} out of ${maxScore}.${dateNote} The evaluation found genuine potential alongside meaningful concerns that should be resolved before committing to a full application.`;
    if (weakLabels.length) prose += `\n\nSignificant concerns: ${weakLabels.join(', ')}.`;
    if (cautionLabels.length) prose += `\n\nAreas requiring attention: ${cautionLabels.join(', ')}.`;
    prose += `\n\nNext step: Consider a pre-application conversation with the funder to clarify fit before investing time in a full proposal.`;
  } else {
    prose = `Groundwork Go/No-Go Evaluation\nOpportunity: ${oppRef}\nScore: ${score} / ${maxScore} — Recommendation: Pass\n\n`;
    prose += `This opportunity scored ${score} out of ${maxScore} and is not recommended for application at this time.${dateNote} The evaluation identified significant barriers that make a successful application unlikely.`;
    if (weakLabels.length) prose += `\n\nPrimary concerns: ${weakLabels.join(', ')}.`;
    if (cautionLabels.length) prose += `\n\nSecondary concerns: ${cautionLabels.join(', ')}.`;
    prose += `\n\nNext step: Pass on this cycle. Revisit when the concerns above have been addressed.`;
  }

  // Build flags — for hard stops, highlight the trigger question prominently
  const flagMap = {
    q0: { good: 'Strong mission alignment', caution: 'Partial mission alignment — clarify the connection in your narrative', bad: '⛔ Hard stop: Weak mission fit — do not apply' },
    q1: { good: 'You meet all eligibility requirements', caution: 'One eligibility requirement is unclear — confirm before applying', bad: '⛔ Hard stop: You don\'t meet a key requirement — do not apply' },
    q2: { good: 'Sufficient time to write a strong application', caution: 'Timeline is tight — prioritize ruthlessly', bad: 'Not enough time — consider waiting for the next cycle' },
    q3: { good: 'Award amount is well-matched to your budget and project', caution: 'Award amount may need explanation in your budget narrative', bad: 'Amount mismatch — reconsider the ask or the opportunity' },
    q4: { good: 'Your team has the capacity to manage this grant', caution: 'Capacity is stretched — identify who will own this before applying', bad: 'Insufficient capacity — do not overcommit your team' },
    q5: { good: 'You have an existing funder relationship', caution: 'Limited relationship — consider a pre-application outreach call', bad: 'No relationship — prioritize introduction before applying cold' },
    q6: { good: 'Reporting requirements are manageable', caution: 'Reporting is significant — build a tracking plan before you apply', bad: 'Reporting burden may outweigh the grant value' },
    q7: { good: 'You have a sustainability plan for when the grant ends', caution: 'Sustainability plan needs development — address this in your narrative', bad: 'No sustainability plan — this will be a visible gap in your application' },
  };

  const flagsList = document.getElementById('result-flags');
  flagsList.innerHTML = '';
  QUESTIONS.forEach(q => {
    const a = answers[q.id];
    if (!a) return;
    const flagType  = a.value === 2 ? 'good' : a.value === 1 ? 'caution' : 'bad';
    const flagClass = a.value === 2 ? 'flag-good' : a.value === 1 ? 'flag-caution' : 'flag-bad';
    const li = document.createElement('li');
    li.className = `result-flag ${flagClass}`;
    li.textContent = flagMap[q.id][flagType];
    flagsList.appendChild(li);
  });

  // Update result panel
  const panel = document.getElementById('result-panel');
  panel.className = `result-panel show result-${tier}`;

  const labelEl = document.getElementById('result-label');
  if (hardStopReason) {
    labelEl.textContent = eligibilityFailed ? 'Hard Stop — Eligibility' : 'Hard Stop — Mission Fit';
  } else {
    labelEl.textContent = tier === 'apply' ? 'Recommendation: Apply' :
                          tier === 'caution' ? 'Recommendation: Proceed with Caution' : 'Recommendation: Pass';
  }

  document.getElementById('result-headline').textContent = headline;
  document.getElementById('result-score').textContent    = hardStopReason ? `Score: ${score} / ${maxScore} — overridden by hard stop` : `Score: ${score} / ${maxScore}`;

  const proseEl = document.getElementById('result-prose');
  proseEl.textContent   = prose;
  proseEl.dataset.plain = prose;

  // Wire copy button
  document.getElementById('copy-btn').onclick = () => {
    const text = document.getElementById('result-prose')?.dataset.plain || prose;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'Copied ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy summary to clipboard';
        btn.classList.remove('copied');
      }, 2500);
    }).catch(() => {
      // Fallback for browsers that block clipboard
      const ta = document.createElement('textarea');
      ta.value = prose;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'Copied ✓';
      setTimeout(() => btn.textContent = 'Copy summary to clipboard', 2500);
    });
  };

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Save evaluation ─────────────────────────────────────────
// ── Evaluate button — disabled until questions are up ───────
const evaluateBtn = document.getElementById('evaluate-btn');
if (evaluateBtn) {
  evaluateBtn.disabled = true;
  evaluateBtn.style.opacity = '0.45';
  evaluateBtn.style.cursor  = 'not-allowed';
}

function enableEvaluateBtn() {
  const btn  = document.getElementById('evaluate-btn');
  const wrap = document.getElementById('evaluate-btn-wrap');
  if (btn)  { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
  if (wrap) wrap.style.display = 'block';
}

// Enable button immediately if deadline pre-answered all questions
document.addEventListener('questionsReady', () => {
  if (Object.keys(answers).length === QUESTIONS.length) enableEvaluateBtn();
});

evaluateBtn?.addEventListener('click', () => {
  if (evaluateBtn.disabled) return;
  if (Object.keys(answers).length < QUESTIONS.length) {
    const unanswered = QUESTIONS.length - Object.keys(answers).length;
    document.getElementById('save-status').textContent =
      `Please answer all ${unanswered} remaining question${unanswered === 1 ? '' : 's'}.`;
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
    prose:        document.getElementById('result-prose')?.textContent || '',
    savedAt:      new Date().toISOString(),
  };

  try {
    const activeGrantId = sessionStorage.getItem('gw-active-grant');
    evaluation.grantId = activeGrantId || 'org';
    const targetRef = activeGrantId
      ? doc(db, 'users', currentUser.uid, 'grants', activeGrantId)
      : doc(db, 'users', currentUser.uid, 'data', 'org');
    await updateDoc(targetRef, { evaluations: arrayUnion(evaluation) });

    statusEl.textContent = 'Evaluation saved ✓';
    statusEl.className = 'save-status saved';

    // Update dot 2
    document.getElementById('dot-2')?.classList.add('active');

    // Reload previous evals
    await loadPreviousEvals();

    // After 1.5s, return to the entry form for a new evaluation
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className   = 'save-status';
      resetForm();
    }, 1500);
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
  document.getElementById('questions-section').style.display = 'none';
  document.getElementById('opp-summary').classList.remove('visible');
  document.getElementById('opp-form').style.display = 'block';
  document.getElementById('questions-wrap').innerHTML = '';
  document.getElementById('evaluate-btn-wrap').style.display = 'none';
  if (evaluateBtn) {
    evaluateBtn.disabled      = true;
    evaluateBtn.style.opacity = '0.45';
    evaluateBtn.style.cursor  = 'not-allowed';
  }
  window.deadlineDays = undefined;
  document.getElementById('opp-form').scrollIntoView({ behavior: 'smooth' });
}

// ── Load previous evaluations ───────────────────────────────
async function loadPreviousEvals() {
  if (!currentUser) return;

  // Collect evals from all grant docs
  let evals = [];
  try {
    const grantsSnap = await getDocs(collection(db, 'users', currentUser.uid, 'grants'));
    grantsSnap.forEach(d => {
      const data = d.data();
      (data.evaluations || []).forEach(ev => evals.push(ev));
    });
  } catch(e) { /* non-fatal */ }

  // Also collect orphan evals from org doc (legacy saves with no active grant)
  try {
    const orgSnap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'org'));
    if (orgSnap.exists()) {
      (orgSnap.data().evaluations || [])
        .filter(ev => !ev.grantId || ev.grantId === 'org')
        .forEach(ev => evals.push(ev));
    }
  } catch(e) { /* non-fatal */ }

  // Sort newest first
  evals.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  const wrap = document.getElementById('prev-evals-wrap');
  const list = document.getElementById('prev-evals-list');
  if (!wrap || !list) return;

  if (evals.length === 0) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  list.innerHTML = '';

  const flagMap = {
    q0: { good: 'Strong mission alignment', caution: 'Partial mission alignment', bad: 'Weak mission fit' },
    q1: { good: 'Meets all eligibility requirements', caution: 'One eligibility requirement unclear', bad: 'Does not meet a key requirement' },
    q2: { good: 'Sufficient time to apply', caution: 'Timeline is tight', bad: 'Not enough time' },
    q3: { good: 'Award amount is well-matched', caution: 'Amount may need explanation', bad: 'Amount mismatch' },
    q4: { good: 'Team has the capacity', caution: 'Capacity is stretched', bad: 'Insufficient capacity' },
    q5: { good: 'Existing funder relationship', caution: 'Limited relationship', bad: 'No funder relationship' },
    q6: { good: 'Reporting requirements manageable', caution: 'Reporting is significant', bad: 'Reporting burden too high' },
    q7: { good: 'Has a sustainability plan', caution: 'Sustainability needs development', bad: 'No sustainability plan' },
  };

  const recentEvals = evals.slice(0, 10);

  recentEvals.forEach((ev, idx) => {
    const badgeClass = ev.tier === 'apply' ? 'badge-apply' :
                       ev.tier === 'caution' ? 'badge-caution' : 'badge-pass';
    const badgeText  = ev.tier === 'apply' ? 'Apply' :
                       ev.tier === 'caution' ? 'Caution' : 'Pass';
    const date = ev.savedAt ? new Date(ev.savedAt).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const detailId = `eval-detail-${idx}`;
    const borderColor = ev.tier === 'apply' ? '#5A8A48' :
                        ev.tier === 'caution' ? '#B07820' : '#A04830';

    // Build flags
    let flagsHTML = '';
    if (ev.answers) {
      Object.entries(ev.answers).forEach(([qid, ans]) => {
        const ft   = ans.value === 2 ? 'good' : ans.value === 1 ? 'caution' : 'bad';
        const fc   = ans.value === 2 ? 'flag-good' : ans.value === 1 ? 'flag-caution' : 'flag-bad';
        const text = flagMap[qid]?.[ft] || '';
        if (text) flagsHTML += `<li class="result-flag ${fc}" style="margin-bottom:4px;font-size:13px;">${text}</li>`;
      });
    }

    const detailsHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;font-size:13px;color:#5A5248;">
        ${ev.funder ? `<span><strong style="color:#1A1510;">Funder:</strong> ${ev.funder}</span>` : ''}
        ${ev.amount ? `<span><strong style="color:#1A1510;">Amount:</strong> ${ev.amount}</span>` : ''}
        ${ev.deadline ? `<span><strong style="color:#1A1510;">Deadline:</strong> ${new Date(ev.deadline + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
        <span><strong style="color:#1A1510;">Score:</strong> ${ev.score ?? '—'} / 16</span>
      </div>
      ${ev.description ? `<p style="font-size:13px;color:#5A5248;margin-bottom:12px;line-height:1.6;border-left:2px solid #C8C0AE;padding-left:10px;">${ev.description}</p>` : ''}
      ${ev.prose ? `<div style="font-size:14px;color:#1A1510;line-height:1.75;margin-bottom:16px;padding:14px 16px;background:#F2EDE2;border-radius:6px;border:1px solid #C8C0AE;white-space:pre-wrap;">${ev.prose}</div>` : ''}
      ${flagsHTML ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">${flagsHTML}</ul>` : ''}
      <button class="copy-btn eval-copy-btn" data-idx="${idx}" style="font-size:13px;padding:7px 16px;">Copy summary</button>`;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const header = document.createElement('div');
    header.className = 'prev-eval-item';
    header.style.cursor = 'pointer';
    header.dataset.target = detailId;
    header.innerHTML = `
      <span class="prev-eval-badge ${badgeClass}">${badgeText}</span>
      <span class="prev-eval-name">${ev.name}${ev.funder ? ' — ' + ev.funder : ''}</span>
      <span class="prev-eval-date">${date}</span>
      <button class="eval-delete-btn" data-idx="${idx}" style="font-size:12px;color:#A04830;background:none;border:1px solid #A04830;border-radius:4px;padding:3px 10px;cursor:pointer;flex-shrink:0;" onclick="event.stopPropagation();window._deleteEval(${idx});">Delete</button>
      <span class="eval-arrow" style="font-size:11px;color:#3A7080;flex-shrink:0;">▶ View</span>`;

    const detail = document.createElement('div');
    detail.id = detailId;
    detail.style.cssText = `display:none;background:#FDFAF2;border:1px solid #C8C0AE;border-top:3px solid ${borderColor};border-radius:0 0 8px 8px;padding:18px 20px;margin-top:0;`;
    detail.innerHTML = detailsHTML;
    detail.dataset.prose = ev.prose || '';
    detail.dataset.idx   = idx;

    wrapper.appendChild(header);
    wrapper.appendChild(detail);
    list.appendChild(wrapper);
  });

  // Store for buttons
  window._recentEvals = recentEvals;
  window._deleteEval  = (idx) => {
    const ev = window._recentEvals[idx];
    if (!confirm(`Delete evaluation for "${ev.name}"? This cannot be undone.`)) return;
    const targetRef = ev.grantId && ev.grantId !== 'org'
      ? doc(db, 'users', currentUser.uid, 'grants', ev.grantId)
      : doc(db, 'users', currentUser.uid, 'data', 'org');
    updateDoc(targetRef, { evaluations: arrayRemove(ev) })
      .then(() => loadPreviousEvals())
      .catch(err => { console.error('Delete error:', err); alert('Error deleting — please try again.'); });
  };

  // Event delegation on the list
  list.addEventListener('click', e => {
    // Toggle header
    const header = e.target.closest('.prev-eval-item[data-target]');
    if (header) {
      const detail = document.getElementById(header.dataset.target);
      const arrow  = header.querySelector('.eval-arrow');
      if (!detail) return;
      const open = detail.style.display !== 'none';
      detail.style.display = open ? 'none' : 'block';
      arrow.textContent = open ? '▶ View' : '▼ Hide';
      return;
    }

    // Copy summary
    const copyBtn = e.target.closest('.eval-copy-btn');
    if (copyBtn) {
      const idx    = parseInt(copyBtn.dataset.idx);
      const detail = document.querySelector(`[data-idx="${idx}"][data-prose]`);
      const prose  = detail?.dataset.prose || window._recentEvals[idx]?.prose || '';
      if (!prose) { copyBtn.textContent = 'No summary saved'; return; }
      navigator.clipboard.writeText(prose).then(() => {
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => copyBtn.textContent = 'Copy summary', 2000);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = prose;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => copyBtn.textContent = 'Copy summary', 2000);
      });
    }
  });
}

function loadEvaluation(ev) {
  // Populate form fields
  setField('opp-name',     ev.name);
  setField('opp-funder',   ev.funder);
  setField('opp-amount',   ev.amount);
  setField('opp-deadline', ev.deadline);
  setField('opp-desc',     ev.description);

  // Restore answers
  answers = {};
  if (ev.answers) {
    Object.entries(ev.answers).forEach(([qid, ans]) => {
      answers[qid] = ans;
    });
  }

  // Trigger the start flow to show summary + questions
  document.getElementById('start-eval-btn')?.click();

  // Re-render questions with saved answers
  document.getElementById('questions-wrap').innerHTML = '';
  renderQuestions();

  // Show result
  showResult();

  // Scroll to top of content
  document.getElementById('opp-summary')?.scrollIntoView({ behavior: 'smooth' });
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
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

  // Load org data for sidebar
  const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const org = orgSnap.data();
    const nameEl = document.getElementById('org-name');
    const fullEl = document.getElementById('org-full');
    if (nameEl) nameEl.textContent = org.abbreviation || org.name || '—';
    if (fullEl) fullEl.textContent = '';
    populateSidebarCard(org);

    // Count evals from grants (may have moved off org doc)
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
        const grant = grantSnap.data();
        const bar    = document.getElementById('grant-bar');
        const nameEl = document.getElementById('grant-bar-name');
        if (bar)    bar.style.display = 'flex';
        if (nameEl) nameEl.textContent = grant.name + (grant.funder ? ` — ${grant.funder}` : '');

        // Pre-populate opportunity form fields
        const nameField   = document.getElementById('opp-name');
        const funderField = document.getElementById('opp-funder');
        const amountField = document.getElementById('opp-amount');
        const deadlineField = document.getElementById('opp-deadline');
        if (nameField   && !nameField.value)    nameField.value   = grant.name   || '';
        if (funderField && !funderField.value)  funderField.value = grant.funder || '';
        if (amountField && !amountField.value)  amountField.value = grant.amount || '';
        if (deadlineField && !deadlineField.value && grant.deadline) deadlineField.value = grant.deadline;
      }
    } catch(e) { /* non-fatal */ }
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
