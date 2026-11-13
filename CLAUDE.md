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

## Skills in this repo
- `/review-consolidate` — turns an "Export for AI" text/JSON into one decided change list, flags conflicts (decider wins), and proposes reusable feedback rules.
