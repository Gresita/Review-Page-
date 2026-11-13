// ─────────────────────────────────────────────────────────────
// Review Page — the ONLY file you change when moving to a new
// Firebase project or a new account. No secrets live here:
// Firebase web config is public by design; access is enforced by
// firestore.rules and storage.rules.
// ─────────────────────────────────────────────────────────────

export const config = {
  // 'local'    → demo mode: everything stays in this browser (no server).
  // 'firebase' → real mode: Firebase Auth + Firestore + Storage.
  backend: 'local',

  // Paste the web app config from:
  // Firebase Console → Project settings → General → Your apps → SDK setup and configuration
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // Sign-in methods shown on the login screen (firebase mode).
  signIn: { google: true, emailPassword: true },

  // 'sq' or 'en'. Users can switch in the header.
  defaultLanguage: 'sq',

  // Default deadline for a new review: N days from now at HH:00 local time.
  defaultDeadline: { days: 2, hour: 17 },

  // Max upload size in MB (keep in sync with storage.rules).
  maxUploadMb: 2048,

  // Demo users for 'local' mode only. In firebase mode, members live in
  // the Firestore collection `members/{email}` (see README).
  // Roles: admin    → uploads videos, new versions, closes reviews, resolves/deletes any comment
  //        decider  → has the final say: closes reviews, resolves comments
  //        reviewer → watches and comments
  demoMembers: [
    { email: 'admin@end.local', name: 'AI Engineer', role: 'admin' },
    { email: 'dion@end.local', name: 'Dion', role: 'decider' },
    { email: 'menaxhmenti@end.local', name: 'Menaxhmenti', role: 'reviewer' },
  ],
};
