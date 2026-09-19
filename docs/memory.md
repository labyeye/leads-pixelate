# NestLeads Project Memory

**Last reviewed:** 2026-09-20

## Verified Facts

- Root contains `backend`, `frontend`, `NestLeads`, `ai-agent`, and existing audit/template documents.
- Backend is Express/Mongoose and runs on the configured `PORT` (the current local env uses 3500).
- Web frontend is Vite React with `dev`, `build`, `lint`, `test`, and preview scripts.
- Mobile API code currently targets the Android emulator host alias; release configuration should be environment-based.
- Existing audit records completed lead capture, status workflow, imports, calendars, quotations, billing, dashboard KPIs, reports, and multi-tenant isolation as working or partially working.
- Existing audit calls out auth recovery, token storage, CSRF, rate limiting, sanitization, payment verification, exposed integration keys, backend RBAC, reminders, bulk actions, exports, duplicates, scoring, and activity history as gaps or risks.

## Operating Commands

```text
cd leads-pixelate/backend
npm run dev

cd leads-pixelate/frontend
npm run dev
npm run lint
npm run test
npm run build

cd leads-pixelate/NestLeads
npm start
npm run android
npm test
```

## Data/Integration Notes

- MongoDB, JWT, Meta/WhatsApp, payment, email, optional AI, and CRM/dashboard integration settings are environment-driven.
- Never paste `.env` values into issues, docs, screenshots, or chat. Rotate any credential that has been exposed.
- WhatsApp templates are maintained in the repository and must stay synchronized with Meta template names and variable order.
- Scheduled work must be tenant-aware and retry-safe.

## Documentation Habit

Update this file when a verified architectural fact, command, integration contract, or deployment assumption changes. Keep decisions short and link to the owning source file in future edits.
