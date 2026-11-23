// Projects = live Pixxi projects joined by pixxiId with the extra fields in Firestore match_projects.
import { getFirestore } from 'firebase-admin/firestore';
import { fetchPixxiProjects } from './pixxi.js';

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
  const [pixxi, extras] = await Promise.all([fetchPixxiProjects(), loadExtras()]);
  return joinProjects(pixxi, extras);
}
