# Nest Leads (leads-pixelate) — Cybersecurity, Bug, Dead-code & Performance Audit

Scope: `backend/` (Express + Mongoose, multi-tenant), `frontend/` (React/Vite), `NestLeads/` (mobile, read for auth flow only).
Method: manual code review of every route/controller on the auth path, ESLint/tsc/orphan/N+1 scans, `npm audit`, and offline proof-of-concept tests (stubbed models — **no request was sent to any live system, the live database was never touched**). A pre-change snapshot is at `scratchpad/backups/leads-pre-audit.tgz`. Nothing was committed.

## 1. Summary

| Area | Findings | Fixed now | Left (needs your decision) |
|---|---|---|---|
| Security | 14 | 12 | 2 |
| Bugs | 7 | 6 | 1 |
| Dead / extra code | 8 | 5 | 3 |
| Performance | 6 | 4 | 2 |

Worst issues: **cross-tenant account takeover (any tenant owner could read/edit/delete another tenant's users, leads, quotations, products, services)**, **unauthenticated ReDoS on `/api/auth/register`**, **credentialed CORS for every origin**, **forgeable OAuth `state`**, **broken refresh-token verification**.

## 2. Security findings

| ID | Sev | Finding | Status |
|---|---|---|---|
| L-S1 | Critical | **Cross-tenant IDOR.** `findById(req.params.id)` without tenant filter in product / quotation / service / user (incl. `password`, `email`, `bankDetails`, role) / lead (get, update, notes, convert) / support ticket / WhatsApp template / e-mail thread + send. Every tenant owner is `super_admin`, so the "cannot modify super admin" guard did not stop it. | Fixed (P1) |
| L-S2 | Critical | **ReDoS** in `User.email` regex `/^\w+([.-]?\w+)*@…/`: `"a"×30 + "@x.tech"` blocks the event loop ≈ 20 s; reachable unauthenticated through `/auth/register`. The same regex also rejected valid TLDs longer than 3 letters (`.tech`, `.agency`, `.online`). | Fixed (P1) |
| L-S3 | High | CORS reflected **any** Origin with `credentials: true` (cookie session + CSRF token readable cross-origin). | Fixed (P1) |
| L-S4 | High | Webhooks: Facebook signature checked only `if (signature && secret)` (omit the header ⇒ bypass; `timingSafeEqual` threw on length mismatch); public `/facebook/webhook-debug` leaked the verify token; WhatsApp POST webhook unsigned and `verifyWebhook` accepted `undefined === undefined`; ElevenLabs and IndiaMART webhooks unauthenticated (IndiaMART leads were written into the *first* tenant with the integration on). | Fixed — FB fail-closed; WA / ElevenLabs / IndiaMART enforced once their secret env var is set (P3) |
| L-S5 | High | `/api/upload`: any role, extension taken from the file name while the filter also accepted by MIME ⇒ `x.html` with `Content-Type: image/png` stored and served from the API origin (stored XSS). `/uploads` served without `nosniff`. | Fixed (P3) |
| L-S6 | High | Refresh-token "rotation / reuse detection" was a no-op: `bcrypt.compare(jwt, hash)` only reads the first 72 bytes (the JWT header + start of payload, jti excluded) — **proven: a different token verifies against another token's hash**. | Fixed — SHA-256 hash, legacy hashes accepted once (P2) |
| L-S7 | High | Bearer token (30 d) and access cookie were never revoked on password change/reset; `protect` accepted refresh-scope JWTs as access tokens and did not pin the algorithm. | Fixed — `tokenVersion` (P2) |
| L-S8 | High | OAuth `state` (Google Ads, LinkedIn Ads, Facebook, Gmail) was `base64(tenant:user)` — forgeable, so an attacker could attach their own ad/mail account to a victim's CRM account. | Fixed — HMAC-signed, 15-min expiry (P3) |
| L-S9 | High | AI-calling settings: `protect` only (any role), `Object.assign(settings, req.body)` (mass assignment incl. `tenantId`); settings update passed the raw body to `findOneAndUpdate`; lead update spread the raw body into `$set`. | Fixed (P1) |
| L-S10 | Med | Unescaped user input in `$regex` (activity, client, lead, product, quotation, user search) ⇒ ReDoS / wildcard extraction. | Fixed (P1) |
| L-S11 | Med | No per-account login lockout; "account inactive" disclosed before the password was checked (account enumeration); unknown e-mail returned faster than a wrong password (timing). Registration accepted 8-char passwords of any kind (and >72 chars, silently truncated by bcrypt). | Fixed (P2) |
| L-S12 | Med | Static secrets compared with `!==` / accepted in the query string (`/api/stats?key=`, CRM/HRMS API keys, support webhook). | Fixed — constant-time, header only (P3) |
| L-S13 | Med | `npm audit`: backend 15 (1 critical `proxy-addr`, 10 high), frontend 42 (2 critical). | Mostly fixed (P4) — see §6 |
| L-S14 | Low | TOTP is used for password reset only, not for login (2FA gap); IndiaMART cron syncs globally with `tenantId: null`. | Not changed — product decisions |

## 3. Bugs

| ID | Finding | Status |
|---|---|---|
| L-B1 | E-mail regex rejected valid addresses with TLD > 3 letters (see L-S2). | Fixed |
| L-B2 | `campaignAPI.resolveAudience` typed `contacts`, backend returns `preview` ⇒ the campaign-builder audience preview type was wrong (and `tsc` failed). | Fixed |
| L-B3 | `FactoryPage` imports `factoryAPI` that does not exist; page is not routed and `routes/factoryRoutes.js` is never mounted (feature half-removed). | Left — delete or finish (decision) |
| L-B4 | WhatsApp setup screen read `res.data.warning/added` but the API type had no `data` (3 `tsc` errors). | Fixed |
| L-B5 | Onboarding payment verify passed `plan`/`billingCycle` that the API function silently drops. | Fixed |
| L-B6 | `ActivityLogPage` rendered `AppLayout` without the required `title`. | Fixed |
| L-B7 | `tsc` (real config `tsconfig.app.json`): **19 errors → 1** (the remaining one is L-B3). | Fixed |

## 4. Dead / extra code

| ID | Finding | Status |
|---|---|---|
| L-D1 | 5 macOS resource-fork files (`._leadController.js`, `._Lead.js`, `._indiamartService.js`, `._LeadsPage.tsx`, `._.DS_Store`) — junk that ESLint cannot even parse. | Removed |
| L-D2 | `frontend/src/data/mockData.ts` — imported nowhere, 8 `tsc` errors. | Removed |
| L-D3 | Unused `bcrypt` import in `authController`; local duplicate `tenantScope` in `leadController`; `/facebook/webhook-debug`. | Removed |
| L-D4 | Never-required backend files: `routes/factoryRoutes.js`, `services/socialReplyService.js`, `utils/seeder.js`; 25 unused variables (10 in `inventoryController`). | Left — your call |
| L-D5 | 14 exported-but-unused helpers (e.g. `utils/leadStatuses.js`, `services/autopilotService.js`). | Left |
| L-D6 | 5 empty `catch {}` blocks in `facebookRoutes`/`socialController` swallow errors silently. | Left (add logging when touched) |

## 5. Performance

| ID | Finding | Status |
|---|---|---|
| L-P1 | Entry bundle **4,262 kB** (51 pages eagerly imported). | Fixed — route-level `React.lazy`: entry **≈ 410 kB** (gzip 128 kB) |
| L-P2 | `find()` without `.limit()` in 35 places (campaigns, products, services, factory, roles, saved views, social posts…). | Left — needs pagination in the matching screens |
| L-P3 | 24 awaits inside loops (Facebook lead sync, WhatsApp bulk, social publishing, IndiaMART import). | Left — batch with `bulkWrite` / `$in` per sync (planned change) |
| L-P4 | No response compression. | Fixed — `compression` (new dependency) |
| L-P5 | Search fields have no text/prefix index (`$regex` collection scans). | Left |
| L-P6 | `@tanstack/react-query` is installed but pages fetch manually. | Left (refactor, not a fix) |

## 6. Remediation log — applied 2026-10-17

### Verification (re-runnable, offline)

| Check | Proves | Result |
|---|---|---|
| `node scripts/check-hardening.js` | product lookups carry `tenantId`; protected fields dropped from bodies; e-mail regex linear-time and accepts long TLDs; each refresh token matches only its own hash; stale `tokenVersion`, refresh-scope and foreign-signature tokens are refused by `protect`; HMAC signature helper | all passed |
| `node utils/safeEqual.js`, `node utils/oauthState.js` | constant-time compare; forged/expired/tampered OAuth state rejected | passed |
| load test: `require` of every controller / route / middleware / service | no syntax or import errors | 0 failures |
| `tsc -p tsconfig.app.json` | | 19 → 1 errors (L-B3) |
| `vite build` | still builds | ok, entry chunk 4,262 kB → ≈ 410 kB |
| `npm audit` | | backend 15 → 5, frontend 42 → 17 |

### Phase 1 — tenant isolation, injection, mass assignment ✅
`utils/tenantScope.js` (`tenantScope(req)`, `safeBody()`); every `:id` lookup in product / quotation / service / user / lead / ticket / WhatsApp-template / e-mail controllers is now `findOne({ _id, ...tenantScope })`; updates strip `_id/tenantId/deletedAt/createdBy`; AI-calling settings + test-connection are admin-only; `utils/escapeRegex.js` on all six search endpoints; e-mail regex rewritten (linear) in `models/User.js`; CORS credentials only for `CLIENT_URL` (comma list allowed), other origins keep working for public endpoints but without credentials.

### Phase 2 — authentication & sessions ✅
Refresh tokens stored as `sha256:<hex>` (constant-time compare, legacy bcrypt hashes accepted once then rewritten on the next rotation); `tokenVersion` in bearer + access tokens, bumped on password change / reset / admin-set password, checked in `protect` (HS256 pinned, refresh-scope tokens refused); a self password change re-issues the web session so the user stays signed in; login: type-checked inputs, 10 failures ⇒ 15-minute lock, dummy bcrypt compare for unknown e-mails, "inactive" revealed only after a correct password; registration needs 8–72 chars with a letter and a digit.

### Phase 3 — exposure, uploads, webhooks, OAuth ✅
Facebook webhook fail-closed HMAC (`utils/safeEqual.validSignature`), `/webhook-debug` removed; WhatsApp POST verified when `WHATSAPP_APP_SECRET` is set (raw body captured by `express.json({verify})`), verify token compared in constant time and rejected when empty; ElevenLabs webhook HMAC (`ELEVENLABS_WEBHOOK_SECRET`, 30-min window); IndiaMART push needs `?key=` when `INDIAMART_WEBHOOK_SECRET` is set; uploads: extension allow-list only, `nosniff`, and active content (`.html/.svg/.xml/.js`) is forced to download; `/api/stats`, CRM, HRMS and support secrets compared in constant time, stats key header-only; `utils/oauthState.js` signs the state of Google Ads, LinkedIn, Facebook and Gmail OAuth.

### Phase 4 — dependencies ✅ (partly)
`npm audit fix` (no `--force`): backend critical `proxy-addr`, high `axios`/`multer`/`sharp`/`path-to-regexp`/`form-data`/`brace-expansion` fixed. **Left:** `nodemailer` (major, needs Node ≥ 20 — confirm, then `npm i nodemailer@^10`), `nodemon` (dev only), `qs` (moderate, transitive). Frontend: `react-router`, `vite`, `rollup`, `postcss`, `lodash`, `ws`… fixed; **left:** `xlsx` (no npm fix — use the SheetJS CDN tarball), and the build/test toolchain (`tailwindcss`, `vitest`/`tinypool` — dev-only, not shipped).

### Phase 5 — bugs ✅ (L-B3 left) · Phase 6 — dead code ✅ (partly) · Phase 7 — performance ✅ (partly)
As listed in §3–§5.

### Rollout notes (read before deploying)
1. **Set these env vars** (each turns on a check that is otherwise skipped so live traffic keeps working): `WHATSAPP_APP_SECRET`, `ELEVENLABS_WEBHOOK_SECRET`, `INDIAMART_WEBHOOK_SECRET` (then register the IndiaMART push URL as `/api/leads/indiamart/webhook?key=<secret>`). `FACEBOOK_APP_SECRET` is now **mandatory** for the Facebook webhook (unsigned deliveries get 403).
2. `CLIENT_URL` must list every browser origin that uses cookies (comma-separated). Mobile (no Origin) and public lead-capture forms are unaffected.
3. `/api/stats` must be called with the `X-Stats-Key` header (the `?key=` form is gone).
4. Existing 30-day bearer tokens keep working until the user's next password change (they carry no `tv`, treated as version 0). Web sessions continue; refresh tokens are re-hashed on the next refresh.
5. New `User` fields (`tokenVersion`, `failedLogins`, `lockUntil`) default safely — no migration.
6. Already-uploaded `.html/.svg` files in `uploads/` now download instead of rendering; consider deleting any that you did not upload yourself.
7. Run `npm install` in `backend/` (adds `compression`).
8. The repo already had hundreds of uncommitted changes before this audit; review `git diff` per file when committing.
