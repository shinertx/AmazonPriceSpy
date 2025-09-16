# LocalStock Chrome Extension Packaging & Publishing Guide

## 1. Load Unpacked (Development)
1. Build / run your backend server locally (port 5000 expected).
2. Open Chrome -> `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension/` folder in this repo (the folder that contains `manifest.json`).
5. Navigate to an Amazon or Walmart product page (e.g. https://www.amazon.com/dp/B0BXQBHL5D) to test.
6. Open DevTools > Console to view logs (filter for `LocalStock`).

## 2. Prepare for Zipping
Chrome Web Store expects a clean directory with only necessary assets. In this project the publishable folder is already self‑contained:

```
extension/
  manifest.json
  background.js
  content-script.js
  options.html
  options.js
  popup.html
  popup.js
  styles/
    content.css
  utils/
    cache.js
    dom-extractor.js
    ui-components.js
```

Optional (recommended) before zipping:
- Update version in `manifest.json` (must increment for each new upload).
- Replace data-URI icons with real PNGs (16/32/48/128) for store polish.
- If deploying backend to production, change `API_BASE` in `background.js` to your prod URL (e.g. `https://api.localstock.example/api`). Consider factoring into a separate `config.js`.

## 3. Create Zip (macOS / Linux)
From repo root:
```bash
zip -r localstock-extension.zip extension \
  -x "*.DS_Store" "*/__MACOSX/*" "extension/README_EXTENSION.md"
```
This produces `localstock-extension.zip` ready for upload.

## 4. Submit to Chrome Web Store Developer Dashboard
1. Go to https://chrome.google.com/webstore/devconsole
2. Create a new item (or update existing one).
3. Upload `localstock-extension.zip`.
4. Fill out listing metadata (description, screenshots, category, privacy, permissions justification).
5. Provide a clear privacy statement: extension only reads product page DOM on Amazon/Walmart, sends minimal product identifiers to your backend.
6. Await review and address any policy feedback.

## 5. Updating
Each update requires:
- Increment `"version"` in `manifest.json`.
- Rebuild / adjust code.
- Recreate the ZIP and upload as a new version.

## 6. Suggested Production Hardening
| Area | Action |
|------|--------|
| API URL | Externalize into `config.js` and swap per environment |
| Caching | Add telemetry header (e.g. `x-ls-extension-version`) |
| Permissions | Restrict host patterns if possible (e.g. specific TLD) |
| Error Handling | Surface resolve failures in popup/options UI |
| Privacy | Document data flow & retention policy |
| Security | Consider signing responses (HMAC) if tamper concern |

## 7. Quick Test Checklist Before Packaging
- [ ] Extension loads (no errors in service worker console).
- [ ] Product page injection shows / hides UI correctly.
- [ ] Offers appear when backend seeded offers are returned.
- [ ] Caching works (subsequent resolve logs show `cached: true`).
- [ ] Options page toggles settings (e.g., disabling hides UI).
- [ ] No unexpected network calls (check DevTools Network panel).

## 8. Manual Service Worker Console
`chrome://extensions` -> Inspect views (background service worker) to debug fetch / cache logic.

## 9. Versioning Tip
Adopt semantic versioning: `1.0.0` initial publish, bump:
- Patch: bug fixes (1.0.1)
- Minor: new features, backward compatible (1.1.0)
- Major: breaking changes (2.0.0)

---
Feel free to request an automated script (Node) to package & bump version if you want to streamline releases.
