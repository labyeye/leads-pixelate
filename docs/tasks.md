# NestLeads Task Plan

**Last reviewed:** 2026-09-20

## P0: Release Safety

- [ ] Rotate all credentials that have ever been exposed outside the secret store; audit git history and deployment variables.
- [ ] Move browser auth away from long-lived localStorage JWTs or document an accepted threat model and compensating controls.
- [ ] Add CSRF protection if cookie-based auth is adopted.
- [ ] Audit every backend route for tenant filtering and role enforcement.
- [ ] Verify Razorpay/HDFC callbacks and webhook signatures server-side before entitlement changes.
- [ ] Add rate limits to login, registration, reset, imports, and sensitive integrations.
- [ ] Add input/file sanitization and unsafe HTML audit.

## P1: Core Sales Workflow

- [ ] Add bulk lead selection and actions: assign, status, tag, export, delete.
- [ ] Add CSV/XLSX export respecting filters.
- [ ] Add duplicate detection by normalized phone/email and a merge workflow.
- [ ] Add follow-up reminders: scheduled job, in-app badge, and optional email/WhatsApp digest.
- [ ] Expand lead activity timeline beyond status changes.
- [ ] Capture reason for dropped leads.
- [ ] Add automatic lead scoring and sortable priority.

## P1: Auth and Account Completion

- [ ] Complete forgot-password UI/API/email flow with expiry and single-use tokens.
- [ ] Add email verification and account state handling.
- [ ] Add refresh-token/session revocation if product requirements support multi-device sessions.
- [ ] Mask integration keys and audit reveal/access events.

## P2: Quality and Operations

- [ ] Add contract tests for web/mobile API wrappers.
- [ ] Add tenant-isolation, RBAC, payment, webhook idempotency, import, and date regression tests.
- [ ] Replace hardcoded mobile API base with build-time environments.
- [ ] Add health checks for MongoDB, Meta, payment, email, and scheduled jobs.
- [ ] Document deployment, rollback, backup, and restore procedures.
- [ ] Add observability with structured logs and correlation IDs.

## Definition of Done

A task is complete when the backend rule exists, the web/mobile UX reflects it where applicable, focused tests pass, error/empty states are covered, and the relevant documentation is updated.
