# Prometheon SI — Desktop App

An Electron wrapper for [https://prometheon.si](https://prometheon.si).
Product: **Prometheon SI** · App ID: `com.abcg.prometheon` · Package: `prometheon-si-desktop`

## What it is

- A single window (1280×800 by default) that loads the published Prometheon SI site.
- If `https://prometheon.si` fails to load, a bundled offline page
  (`offline.html`) explains that the app needs the published site or the
  private tailnet gateway, with a **Retry** button for `https://prometheon.si`
  and a link to the tailnet app (the Door) at `http://100.89.231.37:8800`.
- Hardening: `contextIsolation: true`, `nodeIntegration: false`, sandboxed
  renderer. External links open in the system browser, **https only**
  (the tailnet address is the one in-app exception, so the Door can be
  opened from the offline page / Help menu).
- A minimal application menu (File / View / Help).
- **There is no auto-update machinery.** New versions are downloaded and
  installed manually from GitHub Releases.

## Develop

```sh
cd desktop
npm install
npm start          # launches the app against https://prometheon.si
```

## Build installers locally

```sh
npm run dist:mac    # macOS .dmg      (must be run on macOS)
npm run dist:win    # Windows NSIS    (must be run on Windows, or via CI)
npm run dist:linux  # Linux AppImage
```

The icon is `icon.png` (1600×1600, copied from the Prometheon SI app-icon
asset); electron-builder derives the per-OS icon sizes from it.

## How releases are cut

Releases are built by `.github/workflows/desktop-release.yml`:

1. Bump `version` in `desktop/package.json` if needed.
2. Commit, then push a version tag, e.g.:

   ```sh
   git tag v1.00
   git push origin v1.00
   ```

3. The workflow builds on macOS, Windows, and Linux runners, uploads each
   installer as a workflow artifact, and — on tag runs — attaches all
   installers to a GitHub Release for that tag.

The workflow can also be run manually from the Actions tab
(`workflow_dispatch`); manual runs upload artifacts but do not create a
Release.

Expected release assets (electron-builder defaults for version 1.0.0):

| OS      | Asset |
|---------|-------|
| macOS   | `Prometheon SI-1.0.0.dmg` |
| Windows | `Prometheon SI Setup 1.0.0.exe` |
| Linux   | `Prometheon SI-1.0.0.AppImage` |

Artificial Intelligence Designed Exclusively by the American Business Capital Group, Inc. © 2026 All Rights Reserved
