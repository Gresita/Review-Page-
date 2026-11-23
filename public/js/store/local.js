// Demo backend: data in localStorage, video files in IndexedDB.
// Same interface as store/firebase.js, so the UI never knows which one runs.
import { config } from '../config.js';

const DATA_KEY = 'rp:data:v1';
const USER_KEY = 'rp:user';
const empty = () => ({ reviews: {}, versions: {}, comments: {} });

let data = load();
const listeners = new Set();
let authCb = null;
const urlCache = new Map();

function load() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY)) || empty(); } catch { return empty(); }
}
function persist() {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
  listeners.forEach((fn) => fn());
}
function subscribe(fn) {
  listeners.add(fn);
  queueMicrotask(fn);
  return () => listeners.delete(fn);
}
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function currentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

// IndexedDB for video blobs
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rp-blobs', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putBlob(key, blob) {
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function getBlob(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction('blobs').objectStore('blobs').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const store = {
  kind: 'local',

  async init() {},

  demoMembers: () => config.demoMembers,

  onAuth(cb) {
    authCb = cb;
    queueMicrotask(() => cb(currentUser()));
    return () => { authCb = null; };
  },

  async signInWithEmail(email) {
    const m = config.demoMembers.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!m) throw new Error('not-member');
    localStorage.setItem(USER_KEY, JSON.stringify(m));
    authCb?.(m);
  },

  async signInWithGoogle() { throw new Error('Google sign-in works only in firebase mode'); },

  async signInGuest(name) {
    const m = { email: 'anon:' + newId(), name: name || 'Anonim', role: 'reviewer', anon: true, named: !!name };
    localStorage.setItem(USER_KEY, JSON.stringify(m));
    authCb?.(m);
  },

  async setGuestName(name) {
    const u = currentUser();
    if (!u?.anon) return u;
    const m = { ...u, name, named: true };
    localStorage.setItem(USER_KEY, JSON.stringify(m));
    return m;
  },

  async deleteReview(reviewId) {
    for (const [id, v] of Object.entries(data.versions)) if (v.reviewId === reviewId) delete data.versions[id];
    for (const [id, c] of Object.entries(data.comments)) if (c.reviewId === reviewId) delete data.comments[id];
    delete data.reviews[reviewId];
    persist();
  },

  async signOut() {
    localStorage.removeItem(USER_KEY);
    authCb?.(null);
  },

  watchReviews(cb) {
    return subscribe(() => cb(Object.values(data.reviews).sort((a, b) => b.createdAt - a.createdAt)));
  },
  watchReview(id, cb) {
    return subscribe(() => cb(data.reviews[id] ? { ...data.reviews[id] } : null));
  },
  watchVersions(reviewId, cb) {
    return subscribe(() => cb(Object.values(data.versions).filter((v) => v.reviewId === reviewId).sort((a, b) => a.n - b.n)));
  },
  watchComments(reviewId, cb) {
    return subscribe(() => cb(
      Object.values(data.comments)
        .filter((c) => c.reviewId === reviewId)
        .sort((a, b) => a.t - b.t || a.createdAt - b.createdAt)
        .map((c) => ({ ...c })),
    ));
  },

  async createReview({ title, project, deadline }, file, onProgress) {
    const u = currentUser();
    const id = newId();
    data.reviews[id] = { id, title, project, deadline, status: 'open', createdAt: Date.now(), createdBy: u.email, currentVersion: 0 };
    persist();
    await store.addVersion(id, file, '', onProgress);
    return id;
  },

  async addVersion(reviewId, file, note, onProgress) {
    const u = currentUser();
    const r = data.reviews[reviewId];
    const n = (r.currentVersion || 0) + 1;
    const blobKey = `${reviewId}/v${n}`;
    onProgress?.(0.3);
    await putBlob(blobKey, file);
    onProgress?.(1);
    const id = newId();
    data.versions[id] = { id, reviewId, n, blobKey, fileName: file.name, note: note || '', uploadedAt: Date.now(), uploadedBy: u.email };
    r.currentVersion = n;
    persist();
    return n;
  },

  async videoUrl(version) {
    if (urlCache.has(version.blobKey)) return urlCache.get(version.blobKey);
    const blob = await getBlob(version.blobKey);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(version.blobKey, url);
    return url;
  },

  async addComment(reviewId, c) {
    const u = currentUser();
    const id = newId();
    data.comments[id] = {
      id, reviewId, version: c.version, t: c.t, x: c.x, y: c.y, text: c.text,
      authorEmail: u.email, authorName: u.name, authorRole: u.role,
      createdAt: Date.now(), status: 'open',
    };
    persist();
  },

  async updateComment(reviewId, commentId, patch) {
    if (data.comments[commentId]) Object.assign(data.comments[commentId], patch);
    persist();
  },

  async deleteComment(reviewId, commentId) {
    delete data.comments[commentId];
    persist();
  },

  watchRules(cb) {
    return subscribe(() => cb(Object.values(data.rules || {}).sort((a, b) => a.createdAt - b.createdAt)));
  },
  // status: 'active' (sent to Claude) or 'pending' (proposed, waits for an admin's approval).
  async addRule(text, source, status = 'active') {
    const u = currentUser();
    data.rules = data.rules || {};
    const id = newId();
    data.rules[id] = { id, text, source: source || '', status, createdAt: Date.now(), createdBy: u?.email || '' };
    persist();
  },
  async updateRule(id, patch) {
    if (data.rules?.[id]) Object.assign(data.rules[id], patch);
    persist();
  },
  async deleteRule(id) {
    if (data.rules) delete data.rules[id];
    persist();
  },

  async updateReview(reviewId, patch) {
    Object.assign(data.reviews[reviewId], patch);
    persist();
  },
};
