// Real backend: Firebase Auth + Firestore + Storage, loaded from Google's CDN
// (no npm, no build step). Same interface as store/local.js.
//
// Data model:
//   members/{emailLowercase}            { name, role: 'admin' | 'decider' | 'reviewer' }
//   reviews/{reviewId}                  { title, project, deadline, status, createdAt, createdBy, currentVersion }
//   reviews/{reviewId}/versions/v{n}    { n, url, storagePath, fileName, note, uploadedAt, uploadedBy }
//   reviews/{reviewId}/comments/{id}    { version, t, x, y, text, authorEmail, authorName, authorRole, createdAt, status }
import { config } from '../config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let A, F, S, auth, db, storage;
let member = null;

function norm(snap) {
  const x = { id: snap.id, ...snap.data() };
  for (const k of ['deadline', 'createdAt', 'uploadedAt']) {
    if (x[k] && typeof x[k].toMillis === 'function') x[k] = x[k].toMillis();
  }
  return x;
}

export const store = {
  kind: 'firebase',

  async init() {
    const appMod = await import(`${SDK}/firebase-app.js`);
    [A, F, S] = await Promise.all([
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-storage.js`),
    ]);
    const app = appMod.initializeApp(config.firebase);
    auth = A.getAuth(app);
    db = F.getFirestore(app);
    storage = S.getStorage(app);
  },

  demoMembers: () => [],

  onAuth(cb) {
    return A.onAuthStateChanged(auth, async (u) => {
      if (!u) { member = null; cb(null); return; }
      const email = (u.email || '').toLowerCase();
      try {
        const snap = await F.getDoc(F.doc(db, 'members', email));
        if (!snap.exists()) { member = null; cb({ email, name: u.displayName || email, role: null }); return; }
        const d = snap.data();
        member = { email, name: d.name || u.displayName || email, role: d.role };
        cb(member);
      } catch {
        member = null;
        cb({ email, name: u.displayName || email, role: null });
      }
    });
  },

  async signInWithGoogle() {
    const provider = new A.GoogleAuthProvider();
    try { await A.signInWithPopup(auth, provider); } catch (e) {
      if (e && e.code === 'auth/popup-blocked') await A.signInWithRedirect(auth, provider);
      else throw e;
    }
  },

  async signInWithEmail(email, password) {
    await A.signInWithEmailAndPassword(auth, email, password);
  },

  async signOut() { await A.signOut(auth); },

  watchReviews(cb) {
    const q = F.query(F.collection(db, 'reviews'), F.orderBy('createdAt', 'desc'));
    return F.onSnapshot(q, (s) => cb(s.docs.map(norm)));
  },
  watchReview(id, cb) {
    return F.onSnapshot(F.doc(db, 'reviews', id), (d) => cb(d.exists() ? norm(d) : null));
  },
  watchVersions(reviewId, cb) {
    const q = F.query(F.collection(db, 'reviews', reviewId, 'versions'), F.orderBy('n'));
    return F.onSnapshot(q, (s) => cb(s.docs.map(norm)));
  },
  watchComments(reviewId, cb) {
    const q = F.query(F.collection(db, 'reviews', reviewId, 'comments'), F.orderBy('t'));
    return F.onSnapshot(q, (s) => cb(s.docs.map(norm)));
  },

  async createReview({ title, project, deadline }, file, onProgress) {
    const ref = F.doc(F.collection(db, 'reviews'));
    await F.setDoc(ref, {
      title, project,
      deadline: F.Timestamp.fromMillis(deadline),
      status: 'open',
      createdAt: F.serverTimestamp(),
      createdBy: member.email,
      currentVersion: 0,
    });
    await store.addVersion(ref.id, file, '', onProgress);
    return ref.id;
  },

  async addVersion(reviewId, file, note, onProgress) {
    const reviewRef = F.doc(db, 'reviews', reviewId);
    const current = (await F.getDoc(reviewRef)).data().currentVersion || 0;
    const n = current + 1;
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const storagePath = `reviews/${reviewId}/v${n}-${Date.now()}.${ext}`;
    const task = S.uploadBytesResumable(S.ref(storage, storagePath), file, { contentType: file.type || 'video/mp4' });
    await new Promise((resolve, reject) => {
      task.on('state_changed', (s) => onProgress?.(s.bytesTransferred / s.totalBytes), reject, resolve);
    });
    const url = await S.getDownloadURL(task.snapshot.ref);
    await F.setDoc(F.doc(db, 'reviews', reviewId, 'versions', `v${n}`), {
      n, url, storagePath, fileName: file.name, note: note || '',
      uploadedAt: F.serverTimestamp(), uploadedBy: member.email,
    });
    await F.updateDoc(reviewRef, { currentVersion: n });
    return n;
  },

  async videoUrl(version) { return version.url || null; },

  async addComment(reviewId, c) {
    await F.addDoc(F.collection(db, 'reviews', reviewId, 'comments'), {
      version: c.version, t: c.t, x: c.x, y: c.y, text: c.text,
      authorEmail: member.email, authorName: member.name, authorRole: member.role,
      createdAt: F.serverTimestamp(), status: 'open',
    });
  },

  async updateComment(reviewId, commentId, patch) {
    await F.updateDoc(F.doc(db, 'reviews', reviewId, 'comments', commentId), patch);
  },

  async deleteComment(reviewId, commentId) {
    await F.deleteDoc(F.doc(db, 'reviews', reviewId, 'comments', commentId));
  },

  async updateReview(reviewId, patch) {
    const p = { ...patch };
    if (typeof p.deadline === 'number') p.deadline = F.Timestamp.fromMillis(p.deadline);
    await F.updateDoc(F.doc(db, 'reviews', reviewId), p);
  },
};
