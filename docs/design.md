# NestLeads Product Design

**Last reviewed:** 2026-09-20

## Product Feel

NestLeads should feel like a fast sales operations desk: dense enough for scanning, direct enough for repeated daily actions, and visually consistent across web and mobile.

## Existing Visual Language

- Web uses React/Tailwind, Lucide icons, bordered panels, compact filters, tables, dashboards, dialogs, and toast feedback.
- Mobile uses React Native, safe-area layouts, bold section headers, black borders, compact cards, and high-contrast status pills.
- WhatsApp surfaces use the WhatsApp green accent; business actions use the brand blue/orange family already present in the app.
- Prefer clear typography and short labels over decorative copy.

## Core Layouts

### Dashboard

- Top-level KPI strip: new leads, due follow-ups, open quotations, won value.
- Main content: pipeline/list view with fast filters and next-action visibility.
- Secondary content: team leaderboard, source performance, and recent activity.

### Lead workspace

- List/table for scan and bulk selection.
- Detail view with identity, assignment, status, notes, follow-up, visit, quotation, and communication timeline.
- Primary action should always be obvious: call, WhatsApp, schedule follow-up, create quotation, or convert.

### WhatsApp

- Inbox layout: conversation list, unread state, last message/time, detail thread.
- Campaign/log layout: searchable campaigns, delivery/read/reply counts, expandable message details.
- Setup layout: connection state, phone numbers, template status, and clear configuration guidance.

## Interaction Rules

- Use icon+text for unfamiliar actions; familiar icon-only actions need tooltips.
- Confirm destructive actions and show the affected count for bulk actions.
- Keep filters visible and preserve them across refresh/export when practical.
- Use explicit empty states that explain the next useful action.
- Show server errors without leaking provider details or secrets.
- Keep tables responsive: priority columns first, secondary details in the detail view.

## Status Semantics

- New/contact states communicate urgency.
- HOT/WARM/COLD tags are supplementary, not replacements for pipeline status.
- Green means successful/connected/won, orange means attention/pending, red means failed/dropped, neutral means draft/inactive.
- Status changes should include actor/time in the timeline.

## Accessibility and Responsiveness

- Keyboard-focus states must remain visible.
- Inputs need labels, validation, and error text.
- Use sufficient color contrast and do not encode meaning by color alone.
- Mobile actions must work with touch targets large enough for repeated use.
- Avoid horizontal overflow in lead tables and quotation previews.
