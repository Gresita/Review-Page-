// Cloud Function for Match (codebase "match"). Hosting rewrites /api/** here.
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { createApp } from './app.js';

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
