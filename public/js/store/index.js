// Picks the backend from config.backend. The UI imports only this file.
import { config } from '../config.js';

const firebaseReady = Object.values(config.firebase || {}).every(Boolean);

export const backend = config.backend === 'firebase' && firebaseReady ? 'firebase' : 'local';

export async function loadStore() {
  const mod = backend === 'firebase'
    ? await import('./firebase.js')
    : await import('./local.js');
  await mod.store.init();
  return mod.store;
}
