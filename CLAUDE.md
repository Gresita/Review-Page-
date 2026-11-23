# Review Page — project context

Video review tool for END Properties (Dubai real estate). Dion (decider) and management watch a video, pause it, click on the frame and leave a comment tied to that second and (x, y) position. Reviews have a deadline; after it closes, comments are exported and consolidated by AI into one change list.

## How it is built
- Zero-build web app in `public/` (plain HTML + ES modules). No npm, no bundler. Firebase SDK loads from `https://www.gstatic.com/firebasejs/10.12.2/`.
- Two interchangeable backends behind one interface:
  - `public/js/store/local.js` — demo mode, localStorage + IndexedDB.
  - `public/js/store/firebase.js` — Firebase Auth + Firestore + Storage.
  - `public/js/store/index.js` picks one from `config.backend`.
- UI: `public/js/app.js` (router, sign-in), `views/list.js`, `views/review.js` (player, pins, timeline, comments, export).
- Strings: `public/js/i18n.js` (sq default, en). Add every new string to both languages.
- Brand: bordeaux `#7A0A00` on off-white `#FEFFF8`; Bodoni Moda titles, Lato body, Montserrat labels. Never bold Montserrat.

## Rules for changes
- Portability first: everything account-specific lives in `public/js/config.js` and `.firebaserc` (git-ignored). Never hard-code a project ID, email or URL elsewhere. Never commit secrets.
- Keep both backends in sync: any new store method must exist in `local.js` and `firebase.js` with the same signature.
- Security lives in `firestore.rules` and `storage.rules`; UI checks in `util.js` (`can.*`) are only for display. Update rules whenever permissions change.
- Data model (Firestore):
  - `members/{emailLowercase}` { name, role: admin | decider | reviewer }
  - `reviews/{id}` { title, project, deadline, status, createdAt, createdBy, currentVersion }
  - `reviews/{id}/versions/v{n}` { n, url, storagePath, fileName, note, uploadedAt, uploadedBy }
  - `reviews/{id}/comments/{cid}` { version, t, x, y, text, authorEmail, authorName, authorRole, createdAt, status }
  - `x`, `y` are 0–1 fractions of the video frame (not the element), `t` is seconds.
- Run `tests/e2e_local.py` against a local server after UI changes.

## Match (project search) lives alongside, not inside, the Review Page
- Page: `public/match/` (own HTML, CSS, JS). Server: `match-functions/` (codebase `match`: `matchApi` for the page, `matchRefresh` every hour saves Pixxi projects + the ECB EUR→AED rate to Storage `match-cache/projects.json`; Firestore `match_projects`). Details in `match-functions/README.md`.
- The only shared points, keep them this way:
  - `public/js/config.js` is read by `public/match/auth.js` (Firebase config only). Match never writes Review Page data, storage keys or collections; in Storage it uses only `match-cache/` (server-side).
  - Same Firebase Auth. Match has no sign-out button, because signing out there would sign the user out of the Review Page too.
  - Review Page header shows the "Project match" link (`app.js` `renderHeader`, string `matchLink`), only for signed-in staff in firebase mode.
  - `firebase.json`: the `/api/**` → `matchApi` rewrite must stay before the `**` → `/index.html` rewrite; hosting `predeploy` regenerates `public/match/shared/fields.js`.
- Review Page changes never need a functions deploy. Match server changes: `firebase deploy --only functions:match` (needs `npm install` in `match-functions` first).

## Skills in this repo
- `/review-consolidate` — turns the comment export (the text "Send to Claude" copies) into one decided change list, flags conflicts (decider wins), and proposes reusable feedback rules.
