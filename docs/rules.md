# NestLeads Engineering Rules

**Last reviewed:** 2026-09-20

## Security

1. Never commit or document secret values. Use environment variable names and secret-manager references only.
2. Enforce tenant/company filtering in every controller query and mutation.
3. Treat JWTs, OTPs, reset tokens, webhook payloads, and payment callbacks as untrusted.
4. Enforce RBAC in backend middleware/controllers; frontend permissions are only UX.
5. Apply rate limits to auth, reset, registration, imports, and high-cost integrations.
6. Validate and sanitize imported lead fields, notes, remarks, HTML, URLs, and uploaded files.
7. Never render user content with unsafe HTML.
8. Verify payment signatures server-side before subscription or entitlement changes.
9. Mask credentials in settings and never log access tokens or full API keys.
10. Resolve upload paths below an allowed upload root and reject traversal.

## Data and API

- Use existing Mongoose models and controller/service patterns before creating abstractions.
- Keep responses consistent: success flag/data for success and a useful message/status for errors.
- Use stable IDs and status enums; do not silently invent new spellings.
- Preserve history for status changes, messages, quotations, assignments, and payments.
- Make webhook and scheduled-job handlers idempotent.
- Keep date-only values timezone-safe; store timestamps deliberately and display in the user locale.
- Paginate large lists and honor current filters for exports.

## Frontend and Mobile

- Every async screen needs loading, error, empty, refresh, and success feedback where appropriate.
- Route visibility is not authorization.
- Use the existing API wrappers and auth contexts instead of duplicating fetch logic.
- Keep web and React Native business labels, status values, and permission behavior aligned.
- Avoid hardcoded production URLs in mobile code; use environment/build configuration.
- Do not put secrets in Vite variables or mobile bundles.

## Change Process

- Make the smallest change that fixes the root cause.
- Add or update a focused test for auth, tenant isolation, payment, import, webhook, or date behavior.
- Run the narrowest relevant lint/typecheck/test command before broader validation.
- Update the relevant document in `docs/` when behavior, endpoints, roles, or workflows change.
- Do not mix unrelated refactors into feature work.
