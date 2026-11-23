# Property Match

The agent picks the client's requirements in the form (almost everything is a dropdown). Every choice filters the live Pixxi projects; what is left is ranked by simple rules in code (no AI, no extra cost).

Match lives inside the Review Page: the page is `public/match/` (opened from the "Project match" button in the Review Page header, same sign-in), the server is the Cloud Function `matchApi` in codebase `match` (this folder). Hosting rewrites `/api/**` to it. Link-only guests (anonymous sign-in) cannot use it.

## Layout

```
public/match/            the Match page (Review Page brand, same config.js and sign-in)
  shared/fields.js       GENERATED from match-functions/lib/fields.js
match-functions/         Cloud Function matchApi (codebase "match")
  lib/pixxi.js           NEW projects from Pixxi, ACTIVE only
  lib/snapshot.js        saved copy (Storage match-cache/projects.json) that searches read; written hourly by matchRefresh
  lib/rates.js           EUR->AED from the ECB daily rate (frankfurter.dev) x the dirham peg 3.6725, checked hourly
  lib/projects.js        joins Pixxi with Firestore match_projects by pixxiId
  lib/match.js           filters (budget, type, bedrooms, ready/off-plan, payment years, down payment, area, developer, keys date) + Golden Visa sort
  lib/rank.js            ranking rules: must-haves, priority/goal (rental yield, off-plan), sea, area, developer, keys date
  lib/fields.js          client fields, choices, 15 questions (SQ/EN), currencies
  scripts/import-csv.js  CSV -> Firestore match_projects
  tests/fixtures/projects.FAKE.csv   FAKE test data only
.env (repo root)         local keys (git-ignored, never deployed)
```

## Local testing

`.env` in the repo root:
```
PIXXI_API_KEY=...
MATCH_AUTH_DISABLED=1          # local only; ignored in Cloud Functions
FIREBASE_PROJECT_ID=...        # optional, to read match_projects locally (needs gcloud auth application-default login)
```
```
cd match-functions
npm install
npm test
npm run dev                    # http://localhost:3000/match/
```

## Firestore match_projects (extra fields)

Document id = Pixxi `id`. Template: `match-functions/scripts/match_projects.template.csv`.

| column | meaning |
|---|---|
| pixxiId | required |
| goldenVisaEligible | true/false. **Set by admins only.** The AI never computes it. |
| minDownPaymentPct | overrides Pixxi paymentPlan "one" |
| postHandoverYears | Pixxi has only a percentage |
| rentalYield | percent |
| developer, propertyTypes, nearSea | optional overrides of Pixxi |
| tags | added to Pixxi amenities and views |

Blank cell = not set. `|` separates list values.
```
npm run import -- file.csv --project <project-id>           # dry run
npm run import -- file.csv --project <project-id> --write   # writes
```
Files marked `# FAKE` are refused.

## Pixxi mapping

| Match | Pixxi |
|---|---|
| pixxiId | id |
| name | title |
| priceFromAED | price (AED) |
| area / city | community, region / cityName |
| propertyTypes | propertyType (APARTMENT, PENTHOUSE… → apartment; VILLA, TWIN_HOUSE… → villa; TOWNHOUSE) |
| bedrooms | newParam.bedroomMin … bedroomMax |
| handover, status | newParam.handoverTime ("2027-Q4"; future = offplan) |
| minDownPaymentPct | newParam.paymentPlan "one" |
| postHandoverYears | 0 when paymentPlan "four" is 0, otherwise from Firestore |
| nearSea | views has SEA_VIEW |
| tags | amenities + views |

SOLD_OUT and other non-ACTIVE projects are left out.

## Deploy (only after approval)

One-time setup:
1. The project must be on the Blaze plan.
2. Set the Pixxi secret (you type the value): `firebase functions:secrets:set PIXXI_API_KEY`.

Deploy (Review Page site + Match function; Firestore and Storage rules are not touched):
```
firebase deploy --only hosting,functions:match
```
