// Same Firebase Auth as the Review Page: same config, same origin, so a Review Page sign-in carries over.
import { config } from '../js/config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let A = null;
let auth = null;

// Returns false when the server says sign-in is off (local testing only).
export async function initAuth() {
  let required = true;
  try {
    required = (await (await fetch('/api/config')).json()).authRequired !== false;
  } catch {}
  if (!required) return false;
  const appMod = await import(`${SDK}/firebase-app.js`);
  A = await import(`${SDK}/firebase-auth.js`);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config.firebase);
  auth = A.getAuth(app);
  return true;
}

// Calls back with the user, or null when signed out or a link-only guest.
export const onUser = (cb) => A.onAuthStateChanged(auth, (u) => cb(u && !u.isAnonymous ? u : null));

export async function signInWithGoogle() {
  const provider = new A.GoogleAuthProvider();
  try {
    await A.signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked') await A.signInWithRedirect(auth, provider);
    else throw e;
  }
}

export const signInWithEmail = (email, password) => A.signInWithEmailAndPassword(auth, email, password);
export const signOut = () => A.signOut(auth);

export async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (auth?.currentUser) headers.Authorization = 'Bearer ' + (await auth.currentUser.getIdToken());
  return fetch(url, { ...options, headers });
}
