Mobile testing session using VS Code's built-in "Ports" tab. Applies temporary local config so the Angular dev server proxies `/api` to the backend (avoiding CORS entirely), walks the user through forwarding port 4200 as Public, then reverts all changes cleanly when done.

---

## Phase 1 — Apply temporary changes

Make the following 3 changes to enable mobile testing:

1. Create `frontend/proxy.conf.json` with this exact content:
   ```json
   {
     "/api": {
       "target": "http://localhost:3000",
       "secure": false,
       "changeOrigin": true
     }
   }
   ```

2. In `frontend/angular.json`, add an `options` block to the `serve` target (between `"builder"` and `"configurations"`):
   ```json
   "options": {
     "allowedHosts": true,
     "proxyConfig": "proxy.conf.json"
   },
   ```
   `allowedHosts: true` is required — without it the Angular dev server rejects the `*.devtunnels.ms` Host header with "Invalid Host header".

3. In `frontend/src/environments/environment.ts`, change `apiUrl` to:
   ```ts
   apiUrl: '/api',
   ```

After applying the 3 changes, report them as a checklist and continue.

---

## Phase 2 — Verify services

Run all 3 checks in parallel and report each result clearly:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/menu
```
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4200
```

Expected results:
- Docker: containers listed (not empty output)
- Backend: HTTP `200`
- Frontend: HTTP `200`

If any service is down, tell the user exactly what to start:
- Docker not running → start Docker Desktop
- Backend down → `cd backend && npm run dev`
- Frontend down → `cd frontend && ng serve --port 4200`

Tell the user to **restart `ng serve`** now if it was already running before Phase 1 — it must reload to pick up `proxy.conf.json` and `allowedHosts`.

Wait for the user to confirm all services are running (post-restart) before continuing.

---

## Phase 3 — Forward the port via VS Code Ports tab (manual)

This step cannot be automated — it requires clicking in the VS Code UI. Instruct the user:

1. Open the **Ports** tab in the VS Code integrated terminal panel.
2. Forward port **4200** only (do NOT forward 3000 — the proxy makes that unnecessary).
3. Right-click the forwarded port → **Port Visibility → Public**.
4. Copy the "Forwarded Address" shown (format: `https://xxxx-4200.<region>.devtunnels.ms`).
5. Open that URL on any mobile device (same network or internet, since visibility is Public).

Explain why this works: the frontend now calls `/api` (same origin as the dev server), and the dev server proxies that to `http://localhost:3000` on the PC. The backend never sees the tunnel origin, so there is no CORS to configure, and the backend's `.env` / `FRONTEND_URL` do not need to change.

Wait for the user to say they are done testing.

---

## Phase 4 — Revert all changes

Once the user confirms they are done, revert everything:

1. Tell the user to stop forwarding port 4200 in the Ports tab (or set visibility back to Private) — this step is manual, same as Phase 3.

2. Revert `frontend/src/environments/environment.ts` — set `apiUrl` back to:
   ```ts
   apiUrl: 'http://localhost:3000/api',
   ```

3. Revert `frontend/angular.json` — remove the entire `options` block added in Phase 1 from the `serve` target.

4. Delete `frontend/proxy.conf.json`.

5. Run `git diff` on the 2 tracked files to confirm zero changes remain:
   ```bash
   git diff frontend/angular.json frontend/src/environments/environment.ts
   ```

6. Confirm to the user: all temporary changes reverted, no traces left, repository is clean and ready to commit or continue development.
