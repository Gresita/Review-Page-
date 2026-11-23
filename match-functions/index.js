// Cloud Functions for Match (codebase "match").
//   matchApi     – Hosting rewrites /api/** here (search, dropdown lists).
//   matchRefresh – every hour: Pixxi projects + ECB exchange rate -> saved copy that searches read.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { createApp } from './app.js';
import { refreshSnapshot } from './lib/snapshot.js';

initializeApp();

const pixxiKey = defineSecret('PIXXI_API_KEY');

export const matchApi = onRequest(
  {
    region: 'us-central1',
    secrets: [pixxiKey],
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 3,
  },
  createApp(),
);

export const matchRefresh = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'us-central1',
    secrets: [pixxiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    retryCount: 1,
  },
  async () => {
    const { count, rates } = await refreshSnapshot();
    console.log(`Saved ${count} projects, 1 EUR = ${rates?.rates?.EUR ?? '?'} AED (${rates?.date ?? 'no rate'})`);
  },
);
