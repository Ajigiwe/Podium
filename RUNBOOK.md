# Podium Operations Runbook

Practical guide for deploying and operating Podium on the VPS. Written from real
incidents (Sep 2026). Read once now; return to it when something breaks.

---

## 1. Topology

```
GitHub (Ajigiwe/Podium, main)
  └─> VPS 161.97.176.191  /opt/podium  (docker compose, network_mode: host)
        ├─ lite-lms   -> container "podium-app"      Next.js app, port 3000
        └─ egress     -> container "livekit-egress"  recording worker
```

Host services on the same box (docker, host networking):

| Service     | Container / process | Notes |
|-------------|---------------------|-------|
| LiveKit     | `livekit`           | config `/opt/livekit/livekit.yaml`, API port **7880 plain HTTP**, RTC 7881, UDP 50000-60000 |
| Egress      | `livekit-egress`    | config `/opt/podium/egress.yaml`, needs redis; runs as **uid 1001** |
| Redis       | `livekit-redis`     | psrpc bus between livekit and egress |
| MinIO       | `minio`             | object storage (photos, presign uploads) |
| Nginx       | host nginx          | TLS for podiumclass.online and livekit.podiumclass.online (443), proxies to 127.0.0.1:3000 and :7880 |
| Postgres    | `deploy-postgres-1` | belongs to a *different* app (deploy-app-1) — leave alone |

Key paths: `/opt/podium` (app + compose + `.env.local` + `egress.yaml`),
`/opt/livekit/livekit.yaml` (LiveKit server), `/var/recordings` (class MP4s,
**must be owned by uid 1001**).

SSH: `ssh -i ./.ssh_vps_key root@161.97.176.191` (key lives in the main local
checkout; the worktree has no env/keys).

---

## 2. Deploying

Fast path (what we normally do):

```bash
# 1. push the branch to main
git push origin HEAD:main

# 2. sync + rebuild + restart on the VPS
ssh -i ./.ssh_vps_key root@161.97.176.191 'bash -s' <<'EOF'
cd /opt/podium
git fetch origin main
git reset --hard origin/main     # safe: env files are untracked; tree drifts from old tarball extractions
docker compose build lite-lms
docker compose up -d lite-lms
EOF
```

Full first-time/bootstrap path: `deploy_vps.ps1` (packages `git archive` ->
`project.tar.gz`, uploads with `.env.local`, installs Docker/Nginx/certbot).

Verify after any deploy:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/livekit/health   # want 200
docker compose -f /opt/podium/docker-compose.yml logs --since 2m lite-lms | grep -i ready
```

Rules of thumb:

- **Runtime env changes** (`LIVEKIT_API_URL`, webhook targets, non-NEXT_PUBLIC
  vars): edit `/opt/podium/.env.local` then `docker compose up -d --force-recreate lite-lms`. No rebuild.
- **Any `NEXT_PUBLIC_*` change**: requires a full **image rebuild** — Next.js
  inlines these at build time. A restart alone does nothing.
- `project.tar.gz` is tracked in git as the migration archive. Refresh it with
  `git archive --format=tar.gz -o project.tar.gz HEAD` and commit when you want
  the snapshot updated (it is *not* used by the git-based fast path).

---

## 3. Environment (`/opt/podium/.env.local`, mirrored in local `.env.local`)

| Variable | Correct production value | Incident notes |
|----------|--------------------------|----------------|
| `NEXT_PUBLIC_APP_URL` | `https://podiumclass.online` | was localhost -> alert emails + Paystack callbacks pointed to localhost. Build-time inlined. |
| `LIVEKIT_API_URL` | `http://localhost:7880` | was `https://…:7880` (TLS into plain HTTP) -> `ssl3_get_record:wrong version number`, recordings dead. |
| `LIVEKIT_API_KEY/SECRET` | must match `keys:` in `/opt/livekit/livekit.yaml` | was old LiveKit Cloud pair -> every join got 401 "invalid API key" / "Session Severed". |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://livekit.podiumclass.online` | client-side websocket entry (nginx 443 -> 7880). |
| `EGRESS_TEMPLATE_BASE_URL` | `http://localhost:3000/recorder/index.html` | self-hosted recorder template; **exact file path** — the `/recorder/` form 308-redirects and Chrome rejects it. |
| `RESEND_API_KEY` | (secret) | alert emails; failures are non-blocking by design. |
| `MINIO_*`, `PAYSTACK_*`, `FIREBASE_ADMIN_*` | (secrets) | never print values; `.env.local` is gitignored. |

`egress.yaml` uses `api_key: APIpodium909942c6` + `ws_url: ws://localhost:7880` —
if you rotate the LiveKit key, rotate it in **three** places: `livekit.yaml`,
`egress.yaml`, and the app `.env.local`.

---

## 4. Classroom health checks (symptom -> fix)

| Symptom | Check | Fix |
|---------|-------|-----|
| "Session Severed", 401 on `/rtc/v1` | `docker logs livekit --tail 20 \| grep 'invalid API key'` | sync app key/secret with `livekit.yaml`, recreate container |
| Classroom won't connect at all | `NEXT_PUBLIC_LIVEKIT_URL` in bundle, nginx livekit site | rebuild image if env changed |
| Name tags under control bar | fixed in commits `13695cc`, `05c4845` | tags now pin to tile top; camera-off pill in focus view at top-16 |
| Avatar shows letter not photo | token metadata `photoURL` | fixed in `e221009`; metadata is baked at join — user must **rejoin** |

---

## 5. Recording pipeline

Flow: lecturer clicks Record -> `POST /api/recordings/start` ->
`StartRoomCompositeEgress(room=podium_<sessionId>, customBaseUrl=<recorder template>)`
-> egress loads `http://localhost:3000/recorder/index.html?url=…&token=…` in
headless Chrome -> page connects as hidden participant and logs
`START_RECORDING` -> MP4 written to `/var/recordings` on stop -> Firestore
`recordings` doc drives the dashboard + `/api/recordings/download/[id]`.

Why self-hosted: LiveKit's hosted templates (`templates.livekit.io`) have **no
DNS record anymore** (verified via authoritative DNS, Sep 12). Without
`customBaseUrl`, egress stalls with `Start signal not received`.

End-to-end test (server-side, no browser):

```bash
ssh -i ./.ssh_vps_key root@161.97.176.191 'bash -s' <<'EOF'
cd /opt/podium
# 1. create a room (egress needs it to exist)
KEY=$(grep -oE '^LIVEKIT_API_KEY=.*' .env.local | cut -d= -f2)
SECRET=$(grep -oE '^LIVEKIT_API_SECRET=.*' .env.local | cut -d= -f2)
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
NOW=$(date +%s)
HDR=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
PL=$(printf '{"iss":"%s","sub":"cli","video":{"roomCreate":true},"exp":%s,"nbf":%s}' "$KEY" "$((NOW+300))" "$((NOW-10))" | b64url)
SIG=$(printf '%s.%s' "$HDR" "$PL" | openssl dgst -sha256 -hmac "$SECRET" -binary | b64url)
curl -s -X POST http://localhost:7880/twirp/livekit.RoomService/CreateRoom \
  -H "Authorization: Bearer $HDR.$PL.$SIG" -H 'Content-Type: application/json' \
  -d '{"name":"podium_e2etest","empty_timeout":600}' >/dev/null && echo room-ok
# 2. record ~15s
EG=$(curl -s -X POST http://localhost:3000/api/recordings/start -H 'Content-Type: application/json' \
  -d '{"roomId":"e2etest","lecturerId":"cli","classTitle":"E2E"}' | grep -o '"egressId":"[^"]*"' | cut -d'"' -f4)
echo "egress=$EG"; sleep 15
curl -s -X POST http://localhost:3000/api/recordings/stop -H 'Content-Type: application/json' \
  -d "{\"egressId\":\"$EG\",\"roomId\":\"e2etest\"}"; echo
sleep 6; ls -la /var/recordings/
docker logs livekit-egress --since 2m 2>&1 | grep -E 'egress_complete|egress_failed' | tail -2
EOF
```

Expected: `egress_complete`, a `.mp4` (magic bytes `ftyp`) plus `<egressId>.json`
manifest. Clean up test files and the Firestore `recordings` doc afterwards.

Recording failure matrix:

| Log line (egress) | Meaning | Fix |
|---|---|---|
| `Start signal not received` | template page never signaled | template URL reachable from egress? `curl http://localhost:3000/recorder/index.html` |
| `page load error: Not Found` | wrong template URL (redirect or missing file) | use exact `…/recorder/index.html` |
| `Local upload failed: … permission denied` | `/var/recordings` not writable | `chown 1001:1001 /var/recordings` (egress uid) |
| `invalid API key` (livekit log) | key drift | sync 3 places (section 3) |

Known gap: `livekit.yaml` delivers webhooks to
`http://localhost:3000/api/livekit/webhook`, which **does not exist yet**
(404s in logs). `egress_ended`/`participant_left` events are therefore lost —
the stop endpoint updates Firestore directly instead.

---

## 6. Static pages & CSS (public/*.html)

These are prebuilt Tailwind (`npm run build:css:static` -> `public/css/podium.css`),
**regenerated inside the Docker build** since `eb8ee09`. If styles look missing
on static pages (e.g. alerts panel behind content): the class was added to markup
after the last CSS build. Fix: rebuild the image (Docker regenerates CSS) and
bump the `?v=` cache-buster on `podium.css` links (currently `?v=2`). Browser
cache for that file is 4h.

The PWA service worker (`public/sw.js`, cache `podium-v2`) is network-first for
HTML, cache-first for hashed `/_next/static` — so deploys propagate on normal
reload, but long-lived tabs keep old chunks until reloaded.

---

## 7. Backups

`scripts/vps/podium-backup.sh` (systemd timer) tars Postgres, MinIO, and
`/var/recordings` nightly. Recordings only exist on VPS disk — consider MinIO
upload for durability (open item).

---

## 8. Quick command reference

```bash
# status of everything
ssh -i ./.ssh_vps_key root@161.97.176.191 "docker ps --format '{{.Names}}\t{{.Status}}'"

# app logs
ssh -i ./.ssh_vps_key root@161.97.176.191 "cd /opt/podium && docker compose logs --since 5m lite-lms"

# livekit 401 check
ssh -i ./.ssh_vps_key root@161.97.176.191 "docker logs livekit --since 10m 2>&1 | grep -c 'invalid API key'"

# egress last failure
ssh -i ./.ssh_vps_key root@161.97.176.191 "docker logs livekit-egress --since 30m 2>&1 | grep -iE 'failed|aborted' | tail -5"

# restart app without rebuild (runtime env change)
ssh -i ./.ssh_vps_key root@161.97.176.191 "cd /opt/podium && docker compose up -d --force-recreate lite-lms"
```

## 9. Open items

- `/api/livekit/webhook` route missing (webhook 404s) — build with signature verification
- Recordings live only on VPS disk — upload to MinIO on egress_complete
- Startup guard: fail loudly if `NEXT_PUBLIC_APP_URL` is localhost in prod build
- `project.tar.gz` tracked in git (migration convenience, bloats clones)
- Inline brand creation in the admin product upload form (client request)
- Watermark uploaded product images with the shop logo (client request)
