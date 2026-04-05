// Groundwork — App Entry Point

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

console.log('Groundwork: app.js loading...');

let app, auth, db;

try {
  app  = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);
  console.log('Groundwork: Firebase initialized OK');
} catch (e) {
  console.error('Groundwork: Firebase init failed', e);
}

const loginOverlay = document.getElementById('login-overlay');
const appShell     = document.getElementById('app');
const loginBtn     = document.getElementById('login-google-btn');

loginBtn?.addEventListener('click', () => {
  console.log('Groundwork: sign-in button clicked');
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(result => console.log('Groundwork: signed in', result.user.email))
    .catch(err  => console.error('Groundwork: sign-in error', err.code, err.message));
});

document.getElementById('settings-btn')?.addEventListener('click', () => {
  alert('Settings coming soon.');
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  console.log('Groundwork: auth state changed, user =', user?.email ?? 'none');
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
  const initial = (user.displayName || user.email || '?')[0].toUpperCase();
  const avatarEl = document.getElementById('avatar-initial');
  if (avatarEl) avatarEl.textContent = initial;

  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    const firstName = user.displayName?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    greetingEl.textContent = `Good ${tod}${firstName ? ', ' + firstName : ''}.`;
  }

  try {
    const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      const org = orgSnap.data();
      const nameEl = document.getElementById('org-name');
      const fullEl = document.getElementById('org-full');
      if (nameEl) nameEl.textContent = org.abbreviation || org.name || '—';
      if (fullEl) fullEl.textContent = org.name || 'Your organization';
      updateDots(org);
      updateStatuses(org);
    } else {
      const fullEl = document.getElementById('org-full');
      if (fullEl) fullEl.textContent = 'Start with section 1 to set up your organization.';
    }
  } catch (e) {
    console.error('Groundwork: Firestore error', e);
  }
}

function updateDots(org) {
  const checks = [
    org?.name,
    org?.evaluations?.length,
    org?.applications?.length,
    org?.library?.length,
    org?.pipeline?.length,
  ];
  checks.forEach((val, i) => {
    const dot = document.getElementById(`dot-${i + 1}`);
    if (dot && val) dot.classList.add('active');
  });
}

function updateStatuses(org) {
  const statuses = [
    org?.name ? 'In progress' : 'Not started',
    org?.evaluations?.length ? `${org.evaluations.length} evaluated` : 'Not started',
    org?.applications?.length ? `${org.applications.length} in progress` : 'Not started',
    org?.library?.length ? `${org.library.length} blocks saved` : 'Not started',
    org?.pipeline?.length ? `${org.pipeline.length} opportunities` : 'Not started',
  ];
  statuses.forEach((text, i) => {
    const el = document.getElementById(`status-${i + 1}`);
    if (!el) return;
    el.textContent = text;
    el.className = 'badge';
    if (text !== 'Not started') el.classList.add('in-progress');
  });
}
