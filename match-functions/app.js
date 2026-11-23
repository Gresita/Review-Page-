import express from 'express';
import { normalizeClient, RATES_TO_AED, RATES_INFO } from './lib/fields.js';
import { loadProjects as defaultLoadProjects, projectsUpdatedAt } from './lib/projects.js';
import { filterProjects, applyGoldenVisaPreference, rankingInput, closestProjects } from './lib/match.js';
import { ruleRank, scoreProject } from './lib/rank.js';
import { requireAuth, authDisabled } from './lib/auth.js';

const MAX_SHOWN = 50; // best matches returned to the page
const MIN_SUGGESTIONS = 5; // always show at least this many projects, adding the closest ones if needed

export function createApp({ loadProjects = defaultLoadProjects } = {}) {
  const app = express();
  app.use(express.json({ limit: '200kb' }));

  // Public: tells the page whether to show the sign-in screen.
  app.get('/api/config', (_req, res) => res.json({ authRequired: !authDisabled() }));

  app.use('/api', requireAuth);

  // Dropdown lists for area and developer, taken from the current projects.
  app.get('/api/options', async (_req, res) => {
    try {
      const projects = await loadProjects();
      const sorted = (key) => [...new Set(projects.map((p) => p[key]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      res.json({
        areas: sorted('area'),
        developers: sorted('developer'),
        rates: { ...RATES_TO_AED },
        ratesDate: RATES_INFO.date,
        ratesSource: RATES_INFO.source,
        projectsUpdatedAt: projectsUpdatedAt(),
      });
    } catch (err) {
      console.error('options failed:', err);
      res.status(502).json({ error: 'Could not load projects from Pixxi: ' + err.message });
    }
  });

  app.post('/api/match', async (req, res) => {
    const client = normalizeClient(req.body?.client);
    delete client.decisionTimeline; // shown to the agent only, never used in search
    const lang = req.body?.lang === 'en' ? 'en' : 'sq';

    let all;
    try {
      all = await loadProjects();
    } catch (err) {
      console.error('loading projects failed:', err);
      return res.status(502).json({ error: 'Could not load projects from Pixxi: ' + err.message });
    }

    const { passed, excluded } = filterProjects(all, client);
    // Cheapest first, so equal scores keep the lower price on top.
    const byPrice = passed.slice().sort((a, b) => (a.priceFromAED ?? Infinity) - (b.priceFromAED ?? Infinity));
    const byId = new Map(byPrice.map((p) => [p.id, p]));
    const ranked = ruleRank(rankingInput(client), byPrice, lang)
      .map((r) => ({ ...byId.get(r.id), score: r.score, reason: r.reason }));
    const results = applyGoldenVisaPreference(ranked, client).slice(0, MAX_SHOWN);

    // Fewer than MIN_SUGGESTIONS full matches: add the closest projects as ideas, marked with what they miss.
    const close = closestProjects(all, client, MIN_SUGGESTIONS - results.length).map((p) => {
      const r = scoreProject(rankingInput(client), p, lang);
      return { ...p, score: r.score, reason: r.reason };
    });

    res.json({ total: all.length, matched: passed.length, results, close, excluded });
  });

  return app;
}
