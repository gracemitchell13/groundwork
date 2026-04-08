// Groundwork — App Entry Point

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { populateSidebarCard } from './sidebar-org-card.js';

let app, auth, db;
try {
  app  = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);
} catch (e) {
  console.error('Groundwork: Firebase init failed', e);
}

const loginOverlay = document.getElementById('login-overlay');
const appShell     = document.getElementById('app');
const loginBtn     = document.getElementById('login-google-btn');

loginBtn?.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch(err => console.error('Sign-in error', err));
});

document.getElementById('settings-btn')?.addEventListener('click', () => {
  alert('Settings coming soon.');
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginOverlay?.classList.add('hidden');
    appShell?.classList.remove('hidden');
    await loadUserData(user);
  } else {
    loginOverlay?.classList.remove('hidden');
    appShell?.classList.add('hidden');
  }
});

async function loadUserData(user) {
  // Avatar and greeting
  const initial = (user.displayName || user.email || '?')[0].toUpperCase();
  const avatarEl = document.getElementById('avatar-initial');
  if (avatarEl) avatarEl.textContent = initial;

  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    const firstName = user.displayName?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const tod  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    greetingEl.textContent = `Good ${tod}${firstName ? ', ' + firstName : ''}.`;
  }

  try {
    // Load org data
    const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
    const orgSnap = await getDoc(orgRef);
    const org     = orgSnap.exists() ? orgSnap.data() : null;

    if (org) {
      populateSidebarCard(org);
    } else {
      const fullEl = document.getElementById('org-full');
      if (fullEl) fullEl.textContent = 'Start with Step 1 to set up your organization.';
    }

    // Load grants collection
    const grantsSnap = await getDocs(collection(db, 'users', user.uid, 'grants'));
    const grants = grantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    updateDots(org, grants);
    updateStatuses(org, grants);

  } catch (e) {
    console.error('Groundwork: Firestore error', e);
  }
}

function updateDots(org, grants) {
  // Dot 1: org profile
  if (org?.name) document.getElementById('dot-1')?.classList.add('active');
  // Dot 2: grant opportunities
  if (grants?.length) document.getElementById('dot-2')?.classList.add('active');
  // Dot 3: evaluations — check grants array and org doc orphans
  const grantEvalCount = grants?.reduce((n, g) => n + (g.evaluations?.length || 0), 0) || 0;
  const hasEvals = grantEvalCount || org?.evaluations?.length;
  if (hasEvals) document.getElementById('dot-3')?.classList.add('active');
  // Dot 4: preparations
  const grantAppCount = grants?.reduce((n, g) => n + (g.applications?.length || 0), 0) || 0;
  const hasPrep = grantAppCount || org?.applications?.length;
  if (hasPrep) document.getElementById('dot-4')?.classList.add('active');
}

function updateStatuses(org, grants) {
  // Card 1: Know Your Organization
  setBadge('status-1',
    org?.profileComplete ? 'Complete' :
    org?.name            ? 'In progress' : 'Not started');

  // Card 2: Grant Opportunities
  const grantCount = grants?.length || 0;
  setBadge('status-2',
    grantCount ? `${grantCount} opportunit${grantCount === 1 ? 'y' : 'ies'}` : 'Not started');

  // Card 3: Evaluate an Opportunity — count from grant docs + org doc orphans
  const evalCount = (grants?.reduce((n, g) => n + (g.evaluations?.length || 0), 0) || 0)
                  + (org?.evaluations?.length || 0);
  setBadge('status-3',
    evalCount ? `${evalCount} evaluated` : 'Not started');

  // Card 4: Prepare Your Application — count from grant docs + org doc orphans
  const prepCount = (grants?.reduce((n, g) => n + (g.applications?.length || 0), 0) || 0)
                  + (org?.applications?.length || 0);
  setBadge('status-4',
    prepCount ? `${prepCount} prepared` : 'Not started');

  // Track Your Pipeline (status-5)
  const applying  = grants?.filter(g => ['applying','submitted'].includes(g.status)).length || 0;
  const awarded   = grants?.filter(g => g.status === 'awarded').length || 0;
  let pipeText = 'Not started';
  if (grantCount) {
    const parts = [];
    if (applying) parts.push(`${applying} active`);
    if (awarded)  parts.push(`${awarded} awarded`);
    pipeText = parts.length ? parts.join(', ') : `${grantCount} tracked`;
  }
  setBadge('status-5', pipeText);

  // Language Library (status-lib)
  const libCount = org?.library?.length || 0;
  setBadge('status-lib',
    libCount ? `${libCount} block${libCount === 1 ? '' : 's'}` : 'Not started');
}

function setBadge(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'badge';
  if (text === 'Complete')      el.classList.add('complete');
  else if (text !== 'Not started') el.classList.add('in-progress');
}
