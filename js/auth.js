// ============================================================
// Groundwork — Auth helper for section pages
// Import this on every pages/*.html to protect the page
// and render the shared sidebar state.
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export function initPage() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    // Avatar
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    const avatarEl = document.getElementById('avatar-initial');
    if (avatarEl) avatarEl.textContent = initial;

    // Greeting
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
      const firstName = user.displayName?.split(' ')[0] || '';
      const hour = new Date().getHours();
      const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      greetingEl.textContent = `Good ${tod}${firstName ? ', ' + firstName : ''}.`;
    }

    // Org footer
    const orgRef  = doc(db, 'users', user.uid, 'data', 'org');
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      const org = orgSnap.data();
      const nameEl = document.getElementById('org-name');
      const fullEl = document.getElementById('org-full');
      if (nameEl) nameEl.textContent = org.abbreviation || org.name || '—';
      if (fullEl) fullEl.textContent = org.name || '';

      // Dots
      const checks = [org?.name, org?.evaluations?.length, org?.applications?.length,
                      org?.library?.length, org?.pipeline?.length];
      checks.forEach((val, i) => {
        const dot = document.getElementById(`dot-${i + 1}`);
        if (dot && val) dot.classList.add('active');
      });
    }

    // Highlight active nav item based on current page
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', path.includes(item.getAttribute('href').replace('../', '')));
    });
  });

  // Sign out
  document.getElementById('avatar-btn')?.addEventListener('click', () => {
    if (confirm('Sign out?')) signOut(auth);
  });

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    alert('Settings coming soon.');
  });

  return { auth, db: getFirestore(initializeApp(firebaseConfig)) };
}
