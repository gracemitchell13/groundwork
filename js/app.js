// ============================================================
// Groundwork — App Entry Point
// Initializes Firebase, handles auth state, updates the UI
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

let app, auth, db;

export function initApp() {
  app  = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);

  const loginOverlay = document.getElementById('login-overlay');
  const appShell     = document.getElementById('app');
  const loginBtn     = document.getElementById('login-google-btn');

  // Google sign-in
  loginBtn?.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(console.error);
  });

  // Settings button — placeholder
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    alert('Settings coming soon.');
  });

  // Avatar button — sign out
  document.getElementById('avatar-btn')?.addEventListener('click', () => {
    if (confirm('Sign out?')) signOut(auth);
  });

  // Auth state
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
}

async function loadUserData(user) {
  // Set avatar initial
  const initial = (user.displayName || user.email || '?')[0].toUpperCase();
  const avatarEl = document.getElementById('avatar-initial');
  if (avatarEl) avatarEl.textContent = initial;

  // Greeting with time of day
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    const firstName = user.displayName?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    greetingEl.textContent = `Good ${tod}${firstName ? ', ' + firstName : ''}.`;
  }

  // Load org profile from Firestore
  const orgRef = doc(db, 'users', user.uid, 'data', 'org');
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
    const nameEl = document.getElementById('org-name');
    const fullEl = document.getElementById('org-full');
    if (nameEl) nameEl.textContent = '—';
    if (fullEl) fullEl.textContent = 'Start with section 1 to set up your organization.';
  }
}

function updateDots(org) {
  // Light up dots based on what's been completed
  const checks = [
    org?.name,                   // section 1: org profile started
    org?.evaluations?.length,    // section 2: at least one evaluation
    org?.applications?.length,   // section 3: at least one application
    org?.library?.length,        // section 4: library has entries
    org?.pipeline?.length,       // section 5: pipeline has entries
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

export { auth, db };
