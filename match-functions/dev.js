// Local testing: npm run dev (reads ../.env). Serves the hosting files and the API on one port.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { createApp } from './app.js';
import { syncShared } from './scripts/sync-shared.js';

const here = dirname(fileURLToPath(import.meta.url));
syncShared();

// Firestore extras need Google credentials (gcloud auth application-default login) and FIREBASE_PROJECT_ID.
// Without them the app still runs on Pixxi data alone.
initializeApp(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : undefined);

const app = express();
app.use(createApp());
app.use(express.static(join(here, '..', 'public')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Match (local) on http://localhost:${port}`));
