// The saved copy of Pixxi projects + exchange rate that searches read, so a search never waits on Pixxi.
// Written every hour by the scheduled function matchRefresh; one JSON file in the project's default
// Storage bucket under match-cache/ (server-only: the Review Page never reads or writes this path).
import { getStorage } from 'firebase-admin/storage';
import { fetchPixxiAll } from './pixxi.js';
import { fetchRates } from './rates.js';

export const SNAPSHOT_PATH = 'match-cache/projects.json';
const file = () => getStorage().bucket().file(SNAPSHOT_PATH);

export async function readSnapshot() {
  const [buf] = await file().download();
  return JSON.parse(buf.toString('utf8'));
}

// Storage "updated" time of the copy; cheap check to see whether it changed since we last read it.
export async function snapshotUpdated() {
  const [meta] = await file().getMetadata();
  return meta.updated;
}

async function writeSnapshot(data) {
  await file().save(JSON.stringify(data), { contentType: 'application/json', resumable: false });
}

// Fetch Pixxi (all NEW, ACTIVE projects) and the rate, then save both.
// If the rate source fails, the previous copy's rate is kept. `projects` can be passed in to skip Pixxi.
export async function refreshSnapshot({ projects } = {}) {
  const fresh = projects ?? (await fetchPixxiAll());
  let rates = null;
  try {
    rates = await fetchRates();
  } catch (err) {
    console.error('Exchange rate fetch failed, keeping the previous rate:', err.message);
    try { rates = (await readSnapshot()).rates ?? null; } catch { /* no previous copy */ }
  }
  const data = { updatedAt: new Date().toISOString(), projects: fresh, rates };
  await writeSnapshot(data);
  return { count: fresh.length, rates };
}
