# Jetty Letters

An offline web app (PWA) for writing quotations and letters on the Jetty letterhead and sharing them as PDFs.

**Live app:** https://lumuncaleb.github.io/jetty-letters/

No build step: it's plain HTML, CSS and JS. Letters are stored on the device (`localStorage`) and, once backup is turned on, also in Firebase so they appear on every device signed in to the same Google account.

## Project layout
```
index.html, styles.css, app.js   the form, preview, sharing and past letters
pdf.js                           totals, amount in words, PDF layout (jsPDF + AutoTable)
config.js                        settings: letterhead, margins, colours, default signer/closings, VAT
sync.js                          cloud backup of Past letters and saved lists (Firebase)
firestore.rules                  backup security rules (paste into the Firebase console)
sw.js, manifest.webmanifest      offline support and "install to home screen"
assets/brand/
  letterhead.jpg                 the letterhead the app uses (A4, 300 dpi)
  letterhead.png                 same design, lossless (for printing/sharing on its own)
  letterhead-original.png        the first hand-made letterhead (kept for reference)
  jetty-logo.png                 cleaned-up logo, transparent background
assets/fonts/                    Noto Sans (has the ₦ sign), used in the PDF
assets/icons/                    app icons
tools/make_letterhead.py         redraws the letterhead; edit COMPANY details at the top
tools/fonts/                     Montserrat + Lora, used only by the letterhead tool
vendor/                          jsPDF and Firebase libraries (bundled so it works offline)
```

## Changing company details on the letterhead
Edit `COMPANY` at the top of `tools/make_letterhead.py`, then run:
```bash
python3 tools/make_letterhead.py
```
If the header or footer changes height, adjust `margins` in `config.js`. After changing any file that is already deployed, bump `CACHE` in `sw.js` so phones pick up the change straight away.

## Run locally
```bash
python3 -m http.server 8765
```
Then open http://localhost:8765.

## Publishing updates
The app is hosted on GitHub Pages from the `main` branch. To publish a change:
```bash
git add -A && git commit -m "Describe the change" && git push
```
GitHub rebuilds the site in a minute or two. Installed copies fetch the new files in the background and show them the next time the app is opened. If you rename or remove files, also bump `CACHE` in `sw.js`.

## Installing on the phone or tablet
Open https://lumuncaleb.github.io/jetty-letters/ in **Chrome**, then tap ⋮ → **Add to Home screen / Install app**. After that first visit it works without internet.

## Cloud backup (Firebase)
Past letters, saved signers and closing lines are backed up to Firebase when the user taps **Past letters → Turn on backup** and signs in with Google. Each Google account can only see its own letters (see `firestore.rules`). Letters still save offline and upload when the device is back online. If the same letter is changed on two devices, the most recent save wins.

One-time setup (already done if `firebase` in `config.js` is filled in):
1. Go to https://console.firebase.google.com, choose **Add project**, name it `jetty-letters` and turn Google Analytics off.
2. **Build → Authentication → Get started → Google**: enable it, choose a support email, then **Save**.
3. **Authentication → Settings → Authorized domains → Add domain**: `lumuncaleb.github.io`
4. **Build → Firestore Database → Create database**: choose a location (e.g. `europe-west1`) and **production mode**. Then open the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**.
5. **Project settings (⚙) → General → Your apps → Web (</>)**: register the app as "Jetty Letters" (no hosting needed) and copy the `firebaseConfig` values into `firebase:` in `config.js`. Then commit and push.

### About the Firebase API key in `config.js`
Firebase web API keys are public by design; the letters are protected by `firestore.rules` and Google sign-in. The key is also restricted in Google Cloud (APIs & Services → Credentials → "Browser key (auto created by Firebase)"):
- **Websites:** `https://lumuncaleb.github.io/*`, `https://jetty-letters.firebaseapp.com/*`, `http://localhost:8765/*`
- **APIs:** Cloud Firestore API, Identity Toolkit API, Token Service API

If the app moves to a new web address, add it there **and** under Firebase → Authentication → Settings → Authorized domains, or sign-in and backup will stop working. GitHub's secret-scanning alert for this key was closed as "won't fix" for this reason.
