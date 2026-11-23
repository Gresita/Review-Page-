// Copies lib/fields.js (canonical) to public/match/shared/fields.js so the browser uses the same definitions.
// Runs on `npm run dev` and as the hosting predeploy step.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'lib', 'fields.js');
const dest = join(here, '..', '..', 'public', 'match', 'shared', 'fields.js');

export function syncShared() {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, '// GENERATED from match-functions/lib/fields.js. Do not edit here.\n' + readFileSync(src, 'utf8'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  syncShared();
  console.log('Synced public/match/shared/fields.js');
}
