# Prometheon SI Unified App — Architecture (v1.00, 2026-11-23)

- **Repo target:** American-Business-Capital-Group/prometheon-si (to be created
  via the browser route — the Muse GitHub App cannot create repositories:
  verified 2026-11-23, POST /user/repos 403 "Resource not accessible by
  integration"). This tree is the complete publish bundle.
- **Site:** Next.js static export (`output: 'export'`) in `app/` — source;
  built output lands in `docs/` (GitHub Pages serves /docs on main) with
  `docs/CNAME` = prometheon.si and `docs/.nojekyll`.
- **Gateway:** `gateway-ref/gateway.py` is the reference copy; the live service
  runs on the Alienware at C:\AI\prometheon-pilot\gateway.py, port 8811,
  bound to the tailnet IP + localhost, optionally exposed via Tailscale Funnel.
- **Desktop:** Electron wrapper in `desktop/` loading https://prometheon.si;
  `.github/workflows/desktop-release.yml` builds macOS/Windows/Linux
  installers on a version tag and attaches them to a GitHub Release.
- **Payments:** not live. Stripe connector is reauthorization_required
  (Jon's reconnect pending). Subscribe/Free Trial run without live payment.
- **Posture:** not announced; marketing pages reachable by URL once DNS is set;
  chat requires an account (gateway auth).
