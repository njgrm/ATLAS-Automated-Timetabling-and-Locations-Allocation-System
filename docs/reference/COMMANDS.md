# ATLAS System Commands Reference

## 🚀 Starting Services

### Start everything (ATLAS server + client together)
```powershell
npm run dev
```

### Start server only
```powershell
npm run dev:server
# or directly:
npm --prefix atlas-server run dev
```

### Start client only (Vite, port 5174)
```powershell
npm run dev:client
# or directly:
npm --prefix atlas-client run dev
```

### Start EnrollPro (required for bridged auth / real faculty data)
```powershell
cd EnrollPro
pnpm dev
```

---

## 🗄️ Database & Seeds

### Full DB seed (subjects, buildings, rooms, faculty, auth accounts)
```powershell
npm run db:seed
```
> ⚠️ **Note:** Running `db:seed` resets the admin password to `AdminSY2026!` (the hashed value in seed.js).
> After seeding, the working login is: `admin@deped.edu.ph / AdminSY2026!`
> If you need `Incorrect_404` back, log in with `AdminSY2026!` and change it in the UI, or patch the hash in `prisma/seed.js`.

### Seed specialization aliases only
```powershell
npm --prefix atlas-server run seed:aliases
```

### Seed from EnrollPro authoritative source (EnrollPro must be running)
```powershell
npm run seed:enrollpro-authoritative
# or:
npm run seed:atlas-enrollpro-source
```

### Seed from fixture data (standalone, no EnrollPro required)
```powershell
npm --prefix atlas-server run seed:enrollpro-source
```

### Seed QA room preference requests
```powershell
npm --prefix atlas-server run seed:qa-room-requests
```

### Open Prisma Studio (visual DB browser)
```powershell
npm run db:studio
```

### Apply schema changes (after editing prisma/schema.prisma)
```powershell
npm run db:migrate
# or for production-style (no prompt):
npx prisma migrate deploy
```

### Generate Prisma client after schema changes (no migration)
```powershell
npm run db:generate
```

### Push schema without migration files (dev only — destructive!)
```powershell
npm run db:push
```

### Reset DB and re-run all migrations
```powershell
npx prisma migrate reset
npm run db:seed
```

### Check migration status
```powershell
npx prisma migrate status
```

---

## 🔑 Auth Credentials

| Role             | Email                       | Password        | Notes                         |
|------------------|-----------------------------|-----------------|-------------------------------|
| Admin (Scheduler)| admin@deped.edu.ph          | `Incorrect_404` | Changed post-seed             |
| Admin (Scheduler)| admin@deped.edu.ph          | `AdminSY2026!`  | Reset by `npm run db:seed`    |
| Demo Faculty     | maria.santos@deped.edu.ph   | `DepEd2026!`    | Stable                        |

---

## 🌐 API Testing (PowerShell)

### Get auth token
```powershell
$body = '{"identifier":"admin@deped.edu.ph","password":"Incorrect_404"}'
$resp = Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/auth/login' -Method Post `
  -Headers @{'Content-Type'='application/json'} -Body $body
$token = $resp.token
```

### Use the token for any endpoint
```powershell
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/faculty-assignments/summary?schoolId=1' -Headers $h
```

### Use machine/system token (inter-service, no login required)
```powershell
$h = @{ Authorization = 'Bearer atlas-system-test-token' }
Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/faculty-assignments/summary?schoolId=1' -Headers $h
```

### Quick API health check
```powershell
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:5001/api/v1/auth/me'
  "UP ($([int]$r.StatusCode))"
} catch {
  if ($_.Exception.Response) { "UP ($([int]$_.Exception.Response.StatusCode.value__))" }
  else { "DOWN — no listener on port 5001" }
}
```
> Returns `UP (401)` when server is running but no token was sent — that is the expected healthy response.

### Get faculty assignment summary (omit schoolYearId to use active year)
```powershell
Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/faculty-assignments/summary?schoolId=1' -Headers $h
```

### Get active school year from public settings
```powershell
Invoke-RestMethod -Uri 'http://localhost:5001/api/v1/settings/public'
```

---

## 🔧 Process Management

### Check what's listening on ATLAS API port
```powershell
Get-NetTCPConnection -LocalPort 5001 -State Listen
```

### Kill whatever is on port 5001 (stuck ATLAS server)
```powershell
Get-NetTCPConnection -LocalPort 5001 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Kill whatever is on port 5174 (Vite dev server)
```powershell
Get-NetTCPConnection -LocalPort 5174 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Kill whatever is on port 3000 (EnrollPro client)
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## 🧪 Testing

### Full phase 4 review tests
```powershell
npm run test:phase4-review
```

### Hybrid scheduler algorithm test
```powershell
npm --prefix atlas-server run test:hybrid-scheduler
```

### Hybrid scheduler benchmark
```powershell
npm --prefix atlas-server run benchmark:hybrid
```

### Login UI parity check (QA script)
```powershell
npm run test:login-ui-parity
```

### Verify EnrollPro data source is reachable
```powershell
npm run verify:enrollpro-source
```

### Cross-repo source gate
```powershell
npm run verify:cross-repo-source-gate
```

### Faculty login integration test
```powershell
node atlas-server/test-faculty-login.mjs
```

### Visual/Playwright tests (install Chromium first if needed)
```powershell
npm run test:visual:install   # one-time: install playwright browser
npm run test:visual           # run all visual tests
npm run test:visual:faculty   # faculty-specific matrix test
```

---

## 📡 Tailscale

> ⚠️ Tailscale commands require the Tailscale client to be running. Run `tailscale status` first.

### Share ATLAS API with your Tailnet (private, requires tailscale login)
```powershell
tailscale serve --bg 5001
```

### Expose ATLAS API publicly via Funnel (public internet URL)
```powershell
tailscale funnel 5001
```

### Remove all serve/funnel configs
```powershell
tailscale serve reset
```

### Check Tailscale status and your Tailnet hostname
```powershell
tailscale status
tailscale ip -4
```

---

## 📂 Quick File Locations

| What                        | Path                                            |
|-----------------------------|-------------------------------------------------|
| Prisma schema               | `prisma/schema.prisma`                          |
| Main seed                   | `prisma/seed.js`                                |
| Specialization aliases seed | `atlas-server/src/scripts/seed-specialization-aliases.ts` |
| Express app entry           | `atlas-server/src/app.ts`                       |
| API routes dir              | `atlas-server/src/routes/`                      |
| Services dir                | `atlas-server/src/services/`                    |
| React pages                 | `atlas-client/src/pages/`                       |
| shadcn/ui components        | `atlas-client/src/ui/`                          |
| Custom components           | `atlas-client/src/components/`                  |
| Settings lib (school year)  | `atlas-client/src/lib/settings.ts`              |
| API lib (axios instance)    | `atlas-client/src/lib/api.ts`                   |
| Auth middleware              | `atlas-server/src/middleware/auth.ts`           |
| Phase plan                  | `phasePlan.md`                                  |
| Phase docs                  | `docs/phases/`                                  |
| QA evidence log             | `docs/verification/evidence-log.md`             |
