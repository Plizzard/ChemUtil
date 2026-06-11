# SMILES Bench — PWA

Offline SMILES → 2D structure viewer with molecular descriptors, drug-likeness
badges, opt-in PubChem identity lookup, a dilution/stock calculator, and qNMR
quantification. Ported from the desktop Chrome/Edge extension into an installable
Progressive Web App so it runs on iOS, Android, and desktop with no app store.

## What's inside
- `index.html` — app shell (three tabs: Structure / Dilution / qNMR)
- `styles.css` — phosphor-green-on-dark theme
- `js/rdkit.js` — RDKit MinimalLib wrapper (CoordGen on; dark-theme SVG)
- `js/structure.js` — render, descriptors, badges, suppliers, PubChem lookup
- `js/dilution.js` — stock-from-mass + C₁V₁=C₂V₂ (SI-normalised, sub-1 µL warning)
- `js/nmr.js` — mixture composition + internal-standard quant
- `js/app.js` — tab routing, in-memory MW bridge, service-worker registration
- `manifest.webmanifest`, `service-worker.js`, `icons/`
- `lib/RDKit_minimal.{js,wasm}` — self-hosted RDKit 2025.03 (folder named lib so GitHub Jekyll does not drop it) (no CDN needed)

## The one hard requirement: HTTPS (or localhost)
Service workers (offline) and "install to home screen" only work in a **secure
context** — i.e. served over **HTTPS**, or over **http://localhost** for local
testing. Opening `index.html` as a `file://` path will *not* install or cache.

## Deploy (pick one)

### A. GitHub Pages — easiest for installing on a phone
1. Create a repo, copy this whole folder into it, push.
2. Repo → Settings → Pages → Source = your branch, root.
3. Wait for the green check; your app is at
   `https://<user>.github.io/<repo>/` (HTTPS, valid for install).

### B. Any static web host / internal lab server
Upload the folder as-is to any HTTPS static host (Netlify, Cloudflare Pages,
an internal nginx/Apache, etc.). No build step, no server code. Keeping it on an
internal host means nothing leaves your network except the optional PubChem call.

### C. Local test on your computer
```bash
cd smiles-pwa
python3 -m http.server 8000
```
Open `http://localhost:8000` on the same machine. (Phones can't install from a
plain `http://<LAN-IP>` because it isn't a secure context — use option A or B.)

## Install on your phone
**iOS (must use Safari):** open the URL → Share → **Add to Home Screen** → Add.
**Android (Chrome):** open the URL → menu (⋮) → **Install app** / **Add to Home
screen**. Launch from the new icon; it opens full-screen with no browser chrome.

First launch must be online so the engine + assets cache. After that it runs
fully offline. PubChem name lookup is the only network call and only fires when
you tap "Get name".

## Updating
Cache strategy is cache-first. To push an update, bump the version string in
`service-worker.js` (`const CACHE = "smiles-bench-v1";` → `v2`). The new worker
re-caches on next launch and drops the old cache.
