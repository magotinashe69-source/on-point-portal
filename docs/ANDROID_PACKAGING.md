# Packaging the portal as an Android app

This explains how to turn the website into an installable Android app for the
Google Play Store. No Android or Java knowledge is needed.

## The short version

The app is **not rebuilt** in a different language. Android has a feature called a
**Trusted Web Activity (TWA)**: the Android app is a thin wrapper that shows this
website full-screen, with no browser bars, using Chrome behind the scenes. So:

- One codebase, one deployment. Fix a bug on the website and every phone gets it
  immediately — no new Play Store release needed.
- The website must be live on **HTTPS** before packaging.

The website side of this is already done (see "What is already set up" below).
What remains is generating the Android package, which happens **outside** this
repo.

## What is already set up

| Piece | Where | What it does |
| --- | --- | --- |
| App manifest | `client/public/manifest.webmanifest` | The app's name, colours, icons and start page |
| Icons | `client/public/icons/` | Launcher icons, including "maskable" ones Android crops to its own shape |
| Service worker | `client/public/sw.js` | Lets the app open with no internet and start faster |
| Offline page | `client/public/offline.html` | Friendly "you're offline" screen |
| Install meta tags | `client/index.html` | Manifest link, status-bar colour, iOS home-screen support |
| App verification | `server/well_known.ts` | Serves `/.well-known/assetlinks.json` (see step 4) |
| Cache rules | `server/static.ts` | Makes sure phones pick up new versions instead of sitting on old ones |

Names and colours currently used:

- **App name:** On Point Homework
- **Short name (under the icon):** On Point
- **Status bar / theme colour:** `#1F3864` (school navy)
- **Splash background:** white
- **Orientation:** portrait

## Step 1 — Deploy the site on HTTPS

Deploy as usual (see `DEPLOYMENT.md`). Note the final address, for example
`https://portal.onpointeducation.co.zw`. Everything below uses that address.

Check these three open correctly in a phone browser:

- `https://<your-site>/manifest.webmanifest` — shows the JSON
- `https://<your-site>/sw.js` — shows JavaScript
- `https://<your-site>/icons/icon-512.png` — shows the logo

## Step 2 — Check it passes as an installable app

On a desktop Chrome, open the site, press F12 → **Lighthouse** → tick
**Progressive Web App** → **Analyse**. You want "Installable" to pass.

Quicker check: open the site on an Android phone in Chrome. The menu should offer
**Install app** / **Add to Home screen** with the school logo.

## Step 3 — Build the Android package

Two options. **PWABuilder is the easier one.**

### Option A — PWABuilder (website, no tools to install)

1. Go to <https://www.pwabuilder.com>.
2. Enter the site address and click **Start**.
3. Click **Package for stores** → **Android** → **Generate**.
4. Set:
   - **Package ID:** `zw.co.onpointeducation.homework` (write this down — it can
     never be changed once published)
   - **App name:** `On Point Homework`
   - **Short name:** `On Point`
   - Leave "Signing key" as **Create new** and **download the zip**.
5. The zip contains:
   - `app-release-bundle.aab` — the file uploaded to Play
   - `signing.keystore` + `signing-key-info.txt` — **back these up somewhere
     safe.** Lose them and you can never update the app again.
   - `assetlinks.json` — the fingerprint needed in step 4

### Option B — Bubblewrap (command line, more control)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<your-site>/manifest.webmanifest
# answer the prompts; accept the defaults from the manifest
bubblewrap build
```

This produces `app-release-bundle.aab` and `android.keystore` in the current
folder. Keep the keystore and its passwords safe.

## Step 4 — Remove the address bar (app verification)

Until this is done, the app shows a URL bar across the top. Android hides it only
once it can fetch a matching fingerprint from the live site.

1. Find the **SHA-256 fingerprint** of your signing key:
   - PWABuilder: it is inside the downloaded `assetlinks.json`, or in
     `signing-key-info.txt`.
   - Bubblewrap: run `bubblewrap fingerprint list`.
   - After uploading to Play: **Play Console → Test and release → Setup → App
     signing**. Copy **both** the "App signing key certificate" and the "Upload
     key certificate" SHA-256 values — Google re-signs your app, so both are
     needed.
2. Set these environment variables on the server (Render dashboard, or `.env`):

   ```
   ANDROID_PACKAGE_NAME=zw.co.onpointeducation.homework
   ANDROID_CERT_FINGERPRINTS=<app signing SHA-256>,<upload key SHA-256>
   ```

3. Restart/redeploy the server, then confirm this opens and lists your package:

   `https://<your-site>/.well-known/assetlinks.json`

4. Fully close and reopen the app on the phone. The address bar should be gone.
   (Android caches the check, so it can take a few minutes or one reinstall.)

Verify it independently with Google's tool:
<https://developers.google.com/digital-asset-links/tools/generator>

## Step 5 — Upload to Google Play

1. Create a Google Play developer account (one-off fee, about US$25).
2. **Create app** → name `On Point Homework`, English, Free, App.
3. Upload the `.aab` under **Test and release → Production** (or start with
   **Internal testing** to try it with a few teachers first — recommended).
4. Fill in the store listing. You will need:
   - Short and full description
   - **App icon:** 512×512 PNG — use `client/public/icons/icon-512.png`
   - **Feature graphic:** 1024×500 PNG (must be made by hand)
   - At least two phone screenshots
   - A privacy policy URL
5. Complete the Data safety form. Be accurate: the app collects student names,
   homework answers and uploaded photos of work.
6. Because the app is used by children, expect to complete the
   **Families / children's policy** declarations, and set the content rating
   accordingly.

## Things to know before publishing

- **Passwords are stored as plain text** in this app (see `CLAUDE.md`). This is
  worth fixing before it is on a public app store with real student accounts.
- **Logins survive as normal.** The app uses the same Chrome storage as the
  browser, so sessions and student logins behave exactly as they do on the web.
- **Uploads and camera:** photo uploads use the standard file picker, which opens
  the Android camera and gallery — no extra permissions to declare.
- **Updating the app:** website changes reach everyone instantly. You only need a
  new Play Store upload if the app name, package ID, icon or orientation changes.

## Changing the app's appearance later

Everything is in `client/public/manifest.webmanifest`:

| To change | Edit |
| --- | --- |
| App name under the icon | `short_name` |
| Allow landscape (for viewing photos of work) | set `orientation` to `"any"` |
| Status bar colour | `theme_color` (also update `theme-color` in `client/index.html`) |
| Splash screen colour | `background_color` |
| Long-press shortcuts | `shortcuts` |

If the **logo** changes, replace `logo.png.jpeg` and regenerate every icon:

```bash
npm install --no-save sharp
npx tsx script/generate-icons.ts
```

Changes to `name`, `short_name`, `icons` or `orientation` need a **new Play Store
upload** to take effect on already-installed apps; everything else is picked up
from the website.
