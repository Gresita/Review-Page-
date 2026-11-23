// Writes the extra fields from a CSV into Firestore collection match_projects (doc id = pixxiId).
//
//   npm run import -- <file.csv> --project <firebase-project-id>           (dry run: shows what would be written)
//   npm run import -- <file.csv> --project <firebase-project-id> --write   (writes)
//
// Each row replaces that project's document. Projects not in the CSV are left as they are.
// Needs Google credentials with access to the project: gcloud auth application-default login
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseCsv, rowsToExtras, isFakeFile, EXTRA_COLUMNS } from '../lib/csv.js';
import { COLLECTION } from '../lib/projects.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--project');
const projectId = args[args.indexOf('--project') + 1];
const write = args.includes('--write');

if (!file || !args.includes('--project') || !projectId) {
  console.error('Usage: npm run import -- <file.csv> --project <firebase-project-id> [--write]');
  console.error('Columns: ' + Object.keys(EXTRA_COLUMNS).join(', ') + ' (only pixxiId is required)');
  process.exit(1);
}

try {
  const text = readFileSync(file, 'utf8');
  if (isFakeFile(text)) throw new Error('this file is marked FAKE test data and will not be imported');
  const records = rowsToExtras(parseCsv(text));
  console.log(`${records.length} row(s) for ${COLLECTION} in project "${projectId}".`);
  for (const r of records.slice(0, 5)) console.log(`  ${r.id}: ${JSON.stringify(r.doc)}`);
  if (records.length > 5) console.log(`  … and ${records.length - 5} more`);

  if (!write) {
    console.log('Dry run. Nothing was written. Add --write to write these documents.');
    process.exit(0);
  }

  initializeApp({ projectId });
  const db = getFirestore();
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch();
    for (const r of records.slice(i, i + 400)) batch.set(db.collection(COLLECTION).doc(r.id), r.doc);
    await batch.commit();
  }
  console.log(`Wrote ${records.length} document(s) to ${COLLECTION}.`);
} catch (err) {
  console.error('Import failed: ' + err.message);
  process.exit(1);
}
