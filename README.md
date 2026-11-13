# Review Page · END Properties

Faqe për review-n e videove. Dion dhe menaxhmenti e hapin videon nga një link (edhe nga telefoni), e ndalin në sekondën ku ka problem, klikojnë mbi pamje dhe lënë komentin pikërisht aty. Review-i ka afat. Kur mbyllet, komentet eksportohen për AI, që i kthen në një listë të vetme ndryshimesh.

## Çfarë bën versioni 1

- Lista e videove në review, me afatin dhe statusin (Hapur / Mbyllur).
- Ngarkimi i videos (MP4) dhe i versioneve të reja (v1, v2, …). Komentet ruhen për çdo version veç e veç.
- Koment mbi frame: ndal videon → kliko mbi pamje → shkruaj. Ruhet sekonda dhe pozicioni (x, y) në pamje.
- Shënja në timeline dhe "pin" mbi video për çdo koment. Klikimi i komentit e çon videon te momenti i saktë.
- Rolet: **admin** (ngarkon, mbyll, menaxhon), **decider** (Dion: fjala e fundit, mbyll review-n, shënon të rregulluar), **reviewer** (komenton).
- Afati: pas afatit, ose kur mbyllet me dorë, nuk lejohen më komente (edhe në rregullat e Firebase).
- "Eksporto për AI": tekst dhe JSON me të gjitha komentet, gati për skill-in `/review-consolidate`.
- Shqip dhe anglisht.

## Struktura

```
public/                 aplikacioni (HTML + JS, pa build)
  js/config.js          i vetmi skedar që ndryshon kur zhvendoset
  js/store/local.js     modaliteti demo (gjithçka në shfletues)
  js/store/firebase.js  modaliteti real (Auth + Firestore + Storage)
  js/views/             lista dhe faqja e review-së
firestore.rules         kush lexon/shkruan çfarë
storage.rules           kush ngarkon/sheh videot
firebase.json           Hosting + rregullat
.claude/skills/         skills e Claude që udhëtojnë me repo-n
CLAUDE.md               konteksti i projektit për çdo llogari Claude
tests/                  testi end-to-end në modalitetin demo
```

## Provoje menjëherë (demo, pa Firebase)

`config.js` vjen me `backend: 'local'`. Çdo server statik mjafton:

```bash
cd public && python3 -m http.server 8080
# hap http://localhost:8080
```

Zgjidh një përdorues demo (Admin, Dion, Menaxhmenti). Videot dhe komentet ruhen vetëm në atë shfletues.

## Lidhja me Firebase (modaliteti real)

1. **Krijo projektin** në [Firebase Console](https://console.firebase.google.com). Për ngarkimin e videove në Storage duhet plani Blaze.
2. **Aktivizo:**
   - Authentication → Sign-in method → Google dhe/ose Email/Password
   - Firestore Database
   - Storage
3. **Shto web app-in:** Project settings → Your apps → Web. Kopjo `firebaseConfig` në `public/js/config.js` dhe vendos `backend: 'firebase'`.
4. **Lidh projektin me repo-n:**
   ```bash
   npm install -g firebase-tools
   firebase login
   cp .firebaserc.example .firebaserc   # vendos project ID-në
   firebase deploy --only firestore:rules,storage,hosting
   ```
5. **Shto anëtarët** në Firestore → koleksioni `members`. Për çdo anëtar krijohet një dokument me ID = email-i me shkronja të vogla:
   ```
   members/dion@endproperties.com     { name: "Dion",        role: "decider" }
   members/ti@endproperties.com       { name: "AI Engineer", role: "admin" }
   members/manager@endproperties.com  { name: "Menaxhmenti", role: "reviewer" }
   ```
   Admin-in e parë e shton me dorë në Console. Pas kësaj, rregullat lejojnë që vetëm admin-ët të ndryshojnë anëtarët.
6. Linku i Hosting (`https://PROJECT-ID.web.app`) është faqja që u dërgohet Dion-it dhe menaxhmentit.

> Konfigurimi web i Firebase nuk është sekret: siguria vjen nga `firestore.rules` dhe `storage.rules`. Mos fut kurrë çelësa API, service accounts apo `.env` në këtë repo.

## Zhvendosja në një llogari tjetër

Projekti është ndërtuar që të lëvizë pa ndryshime në kod.

### Firebase → projekt tjetër
1. Krijo projektin e ri (hapat 1–3 më sipër).
2. Ndrysho vetëm `public/js/config.js` (blloku `firebase`) dhe `.firebaserc`.
3. `firebase deploy --only firestore:rules,storage,hosting`
4. Shto anëtarët në `members`.
5. Nëse duhen edhe të dhënat e vjetra: eksporto Firestore (`gcloud firestore export`) dhe kopjo dosjen `reviews/` nga Storage. Linket e videove (`url`) në versionet e vjetra do të duhen rigjeneruar, ose videot rindarkohen si version i ri.

### GitHub → llogari ose organizatë tjetër
- GitHub → Settings → Transfer ownership, ose `git remote set-url origin <repo-i-ri>` dhe `git push`.
- Nuk ka asgjë të lidhur me llogarinë në kod.

### Claude → llogari tjetër
- `CLAUDE.md` dhe `.claude/skills/` janë brenda repo-s, kështu që çdo llogari Claude që e hap këtë repo merr automatikisht kontekstin dhe skill-in `/review-consolidate`.
- Skills personale të llogarisë suaj (p.sh. `end-agents`, `end-brochure-video`) **nuk** udhëtojnë vetë. Ruajini si dosje `.claude/skills/<emri>/SKILL.md` në një repo, ose ringarkojini në llogarinë e re.
- Asgjë në këtë repo nuk varet nga një llogari e caktuar e Claude.

## Rendi i punës për një video

1. Admin-i ngarkon videon (ose versionin e ri) dhe vendos afatin.
2. Linku i dërgohet Dion-it dhe menaxhmentit.
3. Ata komentojnë mbi momentet e sakta deri në afat.
4. Pas afatit (ose kur Dion e mbyll), admin-i klikon **Eksporto për AI** dhe e ngjit tekstin te Claude me `/review-consolidate`.
5. Claude kthen një listë të vetme ndryshimesh. Kur ka komente që bien ndesh, vendos Dion. Pastaj aplikohen ndryshimet dhe ngarkohet versioni i ri.

## Testi

```bash
pip install playwright && playwright install chromium   # një herë
cd public && python3 -m http.server 8765 &
python3 tests/e2e_local.py
```

Testi hyn si admin, krijon review-n, lë komente mbi frame, hyn si Dion, shënon të rregulluar, mbyll review-n, eksporton dhe kontrollon pamjen në telefon.

## Hapat e ardhshëm

- Aplikimi automatik i ndryshimeve në Remotion pas aprovimit të listës.
- Ruajtja e rregullave të reja në "Memorien e feedback-ut".
- Ngarkimi automatik i renderave nga Remotion si version i ri.
- Njoftim (email/WhatsApp) kur hapet ose mbyllet një review.
