# NestLeads Product Requirements Document

**Status:** Living document  
**Last reviewed:** 2026-09-20

## Product Summary

NestLeads is a multi-tenant CRM for agencies and sales teams. It captures leads from manual entry and external sources, gives teams a status-driven sales workflow, centralizes client communication, generates quotations, and supports subscription billing.

## Users

- **Tenant owner/admin:** configures the company, users, integrations, billing, and permissions.
- **Sales executive:** works assigned leads, records notes and follow-ups, sends WhatsApp messages, and converts leads to clients.
- **Manager:** monitors KPIs, team performance, visits, quotations, and reports.
- **Platform operator:** manages SaaS-level integrations and tenant support.
- **Client/lead:** receives calls, WhatsApp messages, quotations, and follow-ups; does not use the internal dashboard by default.

## Current Scope

- Email/password authentication with JWT, role checks, and 2FA-related flows.
- Tenant-isolated leads, clients, products, quotations, follow-ups, visits, dashboards, reports, and saved views.
- Lead capture/integrations for IndiaMART, Facebook, TradeIndia, and Justdial.
- HOT/WARM/COLD tags, lead status workflow, Excel import, PDF quotation/report export.
- WhatsApp inbox, templates, campaigns, logs, webhooks, and connection setup.
- Razorpay plan billing and CRM/dashboard integration.
- Web dashboard, Android/iOS React Native app, and Express/MongoDB backend.

## Goals

1. Make every lead actionable: owner, status, next action, and follow-up date must be visible.
2. Reduce response time through source integrations and WhatsApp workflows.
3. Keep tenant data isolated and auditable.
4. Let managers measure conversion, pipeline health, and team activity.
5. Make imports, quotations, and exports reliable enough for daily operations.

## Core Requirements

### Lead lifecycle

- Create, list, search, filter, update, delete, assign, tag, add notes, and convert leads.
- Preserve status history and tenant ownership.
- Support statuses from new contact through discussion, quotation, won, and dropped.
- Support follow-up and visit dates with local-date-safe behavior.

### Communication

- Record inbound and outbound WhatsApp messages.
- Show conversations, campaigns, delivery state, replies, templates, and connection status.
- Allow approved Meta templates to use lead/company variables.
- Keep API credentials server-side and scoped to the tenant/platform policy.

### Commercial workflow

- Create and manage products and quotations.
- Export quotations as PDF.
- Verify payment signatures server-side before activating a plan or add-on.
- Show billing state and invoices to authorized users.

### Reporting

- Dashboard KPIs, leaderboard, lead funnel, source performance, follow-up workload, quotation value, and exports.
- Filters must be tenant-scoped and consistent between web and mobile clients.

## Non-Functional Requirements

- Tenant isolation on every read and write.
- Authentication and authorization enforced at the API boundary, not only in the UI.
- Rate limiting on login, registration, password reset, imports, and webhook-sensitive paths.
- Input validation and sanitization for imported and user-entered text.
- No secrets in source control, client bundles, logs, or documentation.
- Mobile and web clients must handle offline/error/loading/empty states clearly.

## Success Metrics

- Lead assignment and next-action completeness above 95%.
- Follow-up due items visible without manual cross-checking.
- Import success rate and duplicate rate tracked per import.
- Quotation-to-won conversion and source conversion reported by tenant.
- Zero cross-tenant data access in authorization tests.
- Payment activation occurs only after verified gateway response.

## Explicitly Planned Next

- Forgot-password and email verification completion.
- HttpOnly cookie or short-lived access/refresh-token strategy.
- CSRF protection if cookie auth is adopted.
- Bulk lead actions, export, duplicate detection/merge, scoring, reminders, and full activity timeline.
- Backend-enforced permission matrix audit.

## Out of Scope for This Version

Social planning and ad campaign functionality is not part of the current audit scope; document and prioritize it separately from core lead operations.
