# Jetty Letters

An offline web app (PWA) for writing quotations and letters on the Jetty letterhead and sharing them as PDFs.

No build step: it's plain HTML, CSS and JS. Everything runs and is stored on the device (`localStorage`); nothing is sent to a server.

## Project layout
```
index.html, styles.css, app.js   the form, preview, sharing and past letters
pdf.js                           totals, amount in words, PDF layout (jsPDF + AutoTable)
config.js                        settings: letterhead, margins, colours, default signer/closings, VAT
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
vendor/                          jsPDF libraries (bundled so it works offline)
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

## Put it online (free) and install on the phone
Upload the folder to any static host, for example Netlify Drop (drag the folder onto https://app.netlify.com/drop), GitHub Pages or Vercel. It must be served over **https** for offline mode and installation to work.

On the Android phone or tablet, open the link in **Chrome**, then tap ⋮ → **Add to Home screen / Install app**. After that first visit it works without internet.
