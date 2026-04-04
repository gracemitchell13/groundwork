import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

console.log('Groundwork: app.js loading...');

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
console.log('Groundwork: Firebase initialized OK');

const loginOverlay = document.getElementById('login-overlay');
const appShell     = document.getElementById('app');

document.getElementById('login-google-btn')?.addEventListener('click', () => {
  console.log('Groundwork: sign-in button clicked');
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(r => console.log('signed in', r.user.email))
    .catch(e => console.error('sign-in error', e.code, e.message));
});

document.getElementById('avatar-btn')?.addEventListener('click', () => {
  if (confirm('Sign out?')) signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  console.log('auth state:', user?.email ?? 'none');
  if (user) {
    loginOverlay?.classList.add('hidden');
    appShell?.classList.remove('hidden');
    const el = document.getElementById('avatar-initial');
    if (el) el.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
    const hour = new Date().getHours();
    const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const name = user.displayName?.split(' ')[0] || '';
    const g = document.getElementById('greeting');
    if (g) g.textContent = `Good ${tod}${name ? ', ' + name : ''}.`;
  } else {
    loginOverlay?.classList.remove('hidden');
    appShell?.classList.add('hidden');
  }
});
