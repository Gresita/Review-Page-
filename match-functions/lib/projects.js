// Projects = Pixxi projects joined by pixxiId with the extra fields in Firestore match_projects.
// Pixxi projects come from the hourly saved copy (lib/snapshot.js), so a search never waits on Pixxi.
// Without a copy (local testing, the first minutes after a deploy) Pixxi is asked directly, as before.
import { getFirestore } from 'firebase-admin/firestore';
import { fetchPixxiProjects } from './pixxi.js';
import { readSnapshot, snapshotUpdated, refreshSnapshot } from './snapshot.js';
import { ensureRates } from './rates.js';
import { setRates } from './fields.js';

const SNAPSHOT_CHECK_MS = 2 * 60 * 1000; // look for a newer copy at most every 2 minutes
let snap = null; // { checkedAt, updated, updatedAt, projects }
let seeding = false;

async function loadSnapshot() {
  const now = Date.now();
  if (snap && now - snap.checkedAt < SNAPSHOT_CHECK_MS) return snap;
  try {
    const updated = await snapshotUpdated();
    if (snap && snap.updated === updated) { snap.checkedAt = now; return snap; }
    const data = await readSnapshot();
    if (data.rates) setRates(data.rates.rates, { date: data.rates.date, source: data.rates.source });
    snap = { checkedAt: now, updated, updatedAt: data.updatedAt, projects: data.projects };
    return snap;
  } catch {
    if (snap) { snap.checkedAt = now; return snap; }
    return null; // no copy yet, or no Storage access (local testing)
  }
}

// When the projects were last refreshed (ISO time), shown on the page.
export function projectsUpdatedAt() {
  return snap?.updatedAt ?? null;
}

async function loadPixxi() {
  const s = await loadSnapshot();
  if (s) return s.projects;
  const [projects] = await Promise.all([fetchPixxiProjects(), ensureRates()]);
  // First search after a deploy: save a copy right away so the next searches are fast.
  if (!seeding && process.env.K_SERVICE) {
    seeding = true;
    refreshSnapshot({ projects }).catch((err) => console.error('Saving the first copy failed:', err.message))
      .finally(() => { seeding = false; });
  }
  return projects;
}

export const COLLECTION = 'match_projects';
const EXTRAS_TTL_MS = 5 * 60 * 1000; // admin edits show up within 5 minutes

let extrasCache = null; // { at, map }

export async function loadExtras() {
  if (extrasCache && Date.now() - extrasCache.at < EXTRAS_TTL_MS) return extrasCache.map;
  try {
    const snap = await getFirestore().collection(COLLECTION).get();
    const map = new Map(snap.docs.map((d) => [d.id, d.data()]));
    extrasCache = { at: Date.now(), map };
    return map;
  } catch (err) {
    // Without Firestore the app still works on Pixxi data alone; extra fields stay unknown.
    console.error(`Could not read Firestore ${COLLECTION}:`, err.message);
    return extrasCache?.map ?? new Map();
  }
}

const OVERRIDES = ['goldenVisaEligible', 'minDownPaymentPct', 'postHandoverYears', 'rentalYield',
  'developer', 'propertyTypes', 'nearSea'];

export function joinProjects(pixxiProjects, extras) {
  return pixxiProjects.map((p) => {
    const x = extras.get(p.pixxiId);
    if (!x) return p;
    const out = { ...p };
    for (const k of OVERRIDES) {
      const v = x[k];
      if (v === undefined || v === null || (Array.isArray(v) && !v.length)) continue;
      out[k] = v;
    }
    if (Array.isArray(x.tags)) out.tags = [...new Set([...p.tags, ...x.tags])];
    return out;
  });
}

export async function loadProjects() {
  const [pixxi, extras] = await Promise.all([loadPixxi(), loadExtras()]);
  return joinProjects(pixxi, extras);
}
