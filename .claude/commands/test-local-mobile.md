Mobile testing session using cloudflared. Applies temporary local config, verifies all services, exposes a public HTTPS tunnel URL for testing on physical devices, then reverts all changes cleanly when done.

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

Wait for the user to confirm all services are running before continuing.

---

## Phase 3 — Start tunnel and share URL

Run cloudflared in the background and capture its output:

```bash
cloudflared tunnel --url http://localhost:4200 > /tmp/cf-mobile-test.log 2>&1 &
echo $! > /tmp/cf-mobile-test.pid
sleep 8
cat /tmp/cf-mobile-test.log
```

Extract the public URL from the log (format: `https://[words].trycloudflare.com`) and display it prominently to the user.

Tell the user:
- Open that URL on any mobile device on any network
- The tunnel is active until they confirm they are done

Wait for the user to say they are done testing.

---

## Phase 4 — Revert all changes

Once the user confirms they are done, revert everything in this order:

1. Stop cloudflared:
   ```bash
   kill $(cat /tmp/cf-mobile-test.pid) 2>/dev/null; rm -f /tmp/cf-mobile-test.pid /tmp/cf-mobile-test.log
   ```

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
