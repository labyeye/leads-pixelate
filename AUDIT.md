# Agency Flow CRM — Full Product Audit
**Date:** June 2026  
**Scope:** Leads, Client Communication, WhatsApp/Bot Messaging, Security, Data, Auth  
*(Social Planner & Ad Campaigns excluded from scope)*

---

## Table of Contents
1. [What's Already Working](#1-whats-already-working)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Security Issues](#3-security-issues)
4. [Lead Management — Gaps & Improvements](#4-lead-management--gaps--improvements)
5. [Client Communication — Gaps & Improvements](#5-client-communication--gaps--improvements)
6. [WhatsApp Messaging & Bot Templates](#6-whatsapp-messaging--bot-templates)
7. [Data Quality & Integrity](#7-data-quality--integrity)
8. [Missing Core Features](#8-missing-core-features)
9. [Performance & Reliability](#9-performance--reliability)
10. [Priority Roadmap](#10-priority-roadmap)

---

## 1. What's Already Working

| Feature | Status |
|---|---|
| Email/Password login & registration | ✅ Done |
| JWT-based auth with role checks | ✅ Done |
| 5-role RBAC (Admin, Sales Exec, etc.) | ✅ Done |
| Lead capture from IndiaMART, Facebook, TradeIndia, Justdial | ✅ Done |
| Lead status workflow (New → Discussion → Won/Drop) | ✅ Done |
| HOT/WARM/COLD contact tagging | ✅ Done |
| Excel bulk import of leads | ✅ Done |
| Follow-up calendar & visit calendar | ✅ Done (date bug now fixed) |
| Quotation generation with PDF export | ✅ Done |
| Razorpay SaaS billing with plan tiers | ✅ Done |
| Basic dashboard KPIs & team leaderboard | ✅ Done |
| WhatsApp inbox view & message logs | ✅ Partial |
| Multi-tenant isolation | ✅ Done |
| Reports with PDF export | ✅ Done |

---

## 2. Authentication & Authorization

### Critical: Password Reset is Missing
There is **no "Forgot Password" flow** anywhere in the codebase. Users who forget their password have no self-service recovery path — they need manual admin intervention.

**What to build:**
1. Add a "Forgot Password" link on the login page
2. `/auth/forgot-password` API endpoint — takes email, generates a time-limited token (expires in 1 hour), stores hashed token in DB, sends reset email via Nodemailer (already installed)
3. `/auth/reset-password/:token` page — takes new password, validates token, updates password hash
4. Email template: branded reset link with expiry warning

### High: No Email Verification on Registration
New accounts are activated immediately with no email verification. Anyone can register with a fake email address.

**What to build:**
- Send a verification email on register with a `/auth/verify-email/:token` link
- Block login until email is confirmed (or allow login but restrict features)

### Medium: No Session Management
- Users have no way to see active sessions or log out of other devices
- JWT tokens have no revocation mechanism — a stolen token works until it expires
- No "remember me" vs. short-session option

**What to build:**
- Refresh token + access token pattern (short-lived 15-min access token, longer 7-day refresh token)
- Store refresh token in an **HttpOnly cookie** (not localStorage)
- `/auth/logout` endpoint that invalidates the refresh token in DB
- "Active sessions" view in Settings where users can revoke sessions

### Medium: No Two-Factor Authentication (2FA)
For a SaaS with client data and quotations, 2FA is a standard expectation.

**What to build:**
- TOTP-based 2FA (Google Authenticator compatible) using the `speakeasy` library
- Optional per-user, enforced by admin for sensitive roles
- Backup codes for recovery

### Low: Password Policy
The current policy is only "minimum 8 characters." No complexity requirements enforced.

**What to add:** Require at least one uppercase, one number, one special character. Show a strength indicator on the registration form.

---

## 3. Security Issues

### 🔴 CRITICAL — JWT Tokens Stored in localStorage

**Current code (AuthContext.tsx):**
```js
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));
```

**Risk:** Any JavaScript running on the page (including from a third-party library with an XSS vulnerability) can read `localStorage` and steal the token. This gives an attacker full account access.

**Fix:**
- Move token storage to an **HttpOnly cookie** set by the backend
- The cookie is invisible to JavaScript — XSS cannot read it
- Frontend sends credentials, backend sets `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
- On the frontend, remove all `localStorage.getItem('token')` calls — the browser sends the cookie automatically

---

### 🔴 CRITICAL — No CSRF Protection

Once tokens move to cookies, CSRF becomes a risk. A malicious site can trigger requests to your API using the victim's cookie.

**Fix:** Implement the **Double Submit Cookie** pattern:
- Backend generates a random CSRF token, sets it as a non-HttpOnly cookie
- Frontend reads it and sends it as a request header (`X-CSRF-Token`)
- Backend middleware validates header matches cookie on all POST/PUT/DELETE

---

### 🟠 HIGH — No Rate Limiting on Auth Endpoints

The login endpoint currently accepts unlimited attempts. An attacker can brute-force any account password.

**Fix (backend):**
```js
// Using express-rate-limit (already a standard package)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: 'Too many login attempts. Try again in 15 minutes.'
});
app.use('/auth/login', loginLimiter);
```

Also add rate limiting on:
- `/auth/forgot-password` (prevent email flooding)
- `/auth/register` (prevent spam accounts)
- Lead import endpoint (prevent large file abuse)

---

### 🟠 HIGH — No Input Sanitization / XSS Prevention

Lead names, company names, and remarks are stored from user input and rendered back in tables and cards. If someone imports a lead with `name: "<script>alert(1)</script>"`, it could execute when rendered.

**Fix:**
- Backend: use `express-mongo-sanitize` (already installed — confirm it covers all inputs)
- Backend: add `xss-clean` middleware to strip HTML tags from all string inputs
- Frontend: never use `dangerouslySetInnerHTML` with user-generated content (audit all occurrences)

---

### 🟠 HIGH — Payment Flow Has No Server-Side Verification

**Current flow:** Frontend calls Razorpay → Razorpay returns success → Frontend navigates to `/payment-success`.

**Risk:** A user can navigate directly to `/payment-success` without paying and potentially trigger plan activation logic.

**Fix:**
- The `/payment-success` route must verify the Razorpay payment signature server-side before granting plan access
- Backend: `razorpay.webhooks.verifyPaymentSignature()` with the webhook secret
- Never activate a plan based purely on frontend callback — always verify on the backend first

---

### 🟡 MEDIUM — API Keys Displayed in Plain Text

The Integrations page shows API keys (IndiaMART, Facebook tokens) on screen. Anyone who shoulder-surfs or screenshots can steal them.

**Fix:**
- Mask keys by default: `•••••••••••••abc123`
- Show a "Reveal" button with confirmation
- Log access to sensitive credentials in the audit log

---

### 🟡 MEDIUM — Role Permissions Only Enforced on Frontend

The `SettingsPage.tsx` defines a permissions matrix (who can CRUD what), but if the backend doesn't enforce the same rules, a user with a low-privilege role can make direct API calls to perform restricted actions.

**Fix:** Audit every backend route to confirm the middleware checks the user's role and resource permission before executing. The frontend permission matrix should mirror the backend — not replace it.

---

### 🟡 MEDIUM — External Pincode API Called Without Proxy

The lead form calls `https://api.postalpincode.in/pincode/...` directly from the browser. This is a free, unmetered public API with no SLA — it can go down at any time.

**Fix:** Proxy the call through your own backend, add a fallback (manual state/city entry), and cache pincode responses in your DB to reduce external dependency.

---

## 4. Lead Management — Gaps & Improvements

### No Bulk Actions
Currently, every action (reassign, change status, delete) works on one lead at a time. For teams handling 500+ leads, this is a major bottleneck.

**What to build:**
- Checkbox selection in the leads table (select all, select page)
- Bulk actions toolbar: Assign to executive | Change status | Add tag | Export | Delete
- Confirmation dialog showing count of affected leads

---

### No CSV / Excel Export of Leads
Users can import via Excel but cannot export their lead data. This is a critical gap — teams need to share data in meetings, do offline analysis, or migrate.

**What to build:**
- "Export" button in the leads list header
- Export respects current filters (export only what you see)
- Formats: Excel (.xlsx) and CSV
- Include all columns: name, phone, company, source, status, assigned to, follow-up date, remarks, created date

---

### No Duplicate Lead Detection
When leads are imported from multiple sources (IndiaMART + Facebook), the same contact may appear multiple times with slightly different names or phone numbers.

**What to build:**
- On import and on manual entry, check if a lead with the same phone number already exists
- Show a "Possible duplicate" warning with a side-by-side comparison
- Allow merge: keep one record, transfer notes/history from the duplicate

---

### No Lead Scoring / Auto-Prioritization
The HOT/WARM/COLD tagging is manual. There's no automatic scoring based on behavior.

**What to build (Phase 2):**
- Score leads based on: source quality (IndiaMART > cold call), response recency, number of follow-ups done, budget range entered
- Surface a "Priority Score" (0–100) as a sortable column
- Auto-suggest tag based on score

---

### Follow-up Reminders Are Not Sent
Follow-up dates exist in the system, but there is no mechanism to actually remind the sales executive when a follow-up is due.

**What to build:**
- Backend cron job (node-cron is already installed) that runs every morning at 8 AM
- Checks all leads with `followUpDate = today` for each tenant
- Sends a daily digest email to each sales exec: "You have 3 follow-ups today: [names]"
- Optional: Send a WhatsApp reminder to the exec's number (if WhatsApp is configured)
- In-app notification badge (bell icon) for due follow-ups

---

### No Lead Activity Timeline (Full History)
The `StatusHistoryTimeline` component exists but only shows status changes. There's no unified activity log.

**What to add to each lead's timeline:**
- Status changed (who changed it, when)
- Note added (content preview)
- WhatsApp message sent/received
- Quotation created / sent / approved
- Follow-up date set / rescheduled
- Visit scheduled / completed
- Assigned to a new executive

---

### No "Reason for Drop" Capture
When a lead is marked as "DROP", there's no mandatory or optional reason field. This data is gold for understanding why deals are lost.

**What to build:**
- On status change to DROP/LOST, show a modal asking: "Why was this lead dropped?"
- Dropdown options: Budget issue | Not interested | Competitor chosen | No response | Wrong contact | Other
- Free-text notes field
- Show drop reason analytics in Reports page

---

## 5. Client Communication — Gaps & Improvements

### No Unified Communication Timeline Per Lead
Each lead has WhatsApp logs, notes, and status changes — but they live in separate views. A sales executive has no single screen showing "everything that happened with this contact."

**What to build:**
- A "Timeline" tab in the lead detail panel showing all interactions in chronological order
- Each entry shows: type (note / WhatsApp / status change / call log / visit), content, who did it, timestamp
- Pin important notes to the top

---

### No Call Logging
There is a "Call" button on each lead that opens `tel:` — but after the call, there's no way to log what happened.

**What to build:**
- After clicking Call, show a quick "Log this call" popup (appears after 30 seconds or when they return to the tab)
- Log fields: Duration (optional), Outcome (Answered / No answer / Busy / Callback requested), Notes
- This logged call appears in the lead's activity timeline

---

### No Email Communication
Nodemailer is installed but only used (partially) for system emails. There's no way to send an email to a client from within the CRM.

**What to build:**
- "Send Email" button on lead/client detail
- Compose window with subject + body (rich text)
- Email templates library (similar to WhatsApp templates)
- Track open/sent status
- Sent emails appear in the lead's timeline

---

### No Quotation Follow-Up Tracking
Quotations have statuses (Draft/Sent/Approved/Rejected) but there's no automation around them.

**What to build:**
- When a quotation is sent, set an automatic follow-up reminder for 3 days later
- If quotation is not acted on in 7 days, surface it in the "Overdue" tab of the follow-ups page
- Track quotation views (if sent via a trackable link rather than PDF)

---

### No Client Portal
Clients currently receive a PDF quotation with no way to respond digitally.

**What to build (Phase 2):**
- A read-only client portal link (like: `yourapp.com/portal/quotation/TOKEN`)
- Client can view the quotation, approve or request changes with a comment
- Approval triggers a notification to the sales exec
- No login required — secured by a one-time token in the URL

---

## 6. WhatsApp Messaging & Bot Templates

### Current State
The WhatsApp Inbox, Logs, Messaging, and Settings pages exist — but the actual send/receive functionality is incomplete or not fully wired. There is no bot/auto-reply logic.

---

### What's Missing: Template Management

**What to build:**
- A "Templates" library page (separate from campaigns)
- Each template has: Name, Category (Greeting / Follow-up / Quotation Sent / Reminder / Thank You), Body text with variables like `{{name}}`, `{{company}}`, `{{date}}`
- Templates submitted to Meta for approval (required for Business API)
- Status indicator: Pending / Approved / Rejected
- "Use Template" button from within any lead's communication panel

---

### What's Missing: Automated Follow-up Bot Sequences

**What to build:**
- A "Sequence" builder: define a series of WhatsApp messages sent automatically over time
- Example sequence for a new lead: Day 0 → Introduction message | Day 2 → Product brochure | Day 5 → Quotation reminder | Day 10 → Last chance message
- Each step can be a template or custom message
- Sales exec assigns a lead to a sequence; bot sends messages on schedule
- Execution pauses automatically if the lead replies (human takes over)
- Resume or stop sequence manually

---

### What's Missing: Incoming Message Handling

**What to build:**
- Webhook receiver for incoming WhatsApp messages
- New incoming message → assign to the lead it's from (match by phone number) → appears in inbox
- If no lead matches, auto-create a new lead with status "New Lead" and show in inbox as "Unknown Contact"
- Unread message count badge on the sidebar menu item
- Sound/browser notification for new messages

---

### What's Missing: Quick Reply Buttons & Interactive Messages

The current setup only supports plain text messages. WhatsApp Business API supports interactive message types.

**What to build:**
- Quick Reply templates: buttons like "Yes, I'm interested" / "Call me back" / "Send brochure"
- List messages: show a numbered list the contact can select from (e.g., product categories)
- When a contact clicks a quick reply, log it in the timeline and optionally trigger a follow-up sequence step

---

### What's Missing: WhatsApp Message Status Tracking

**What to build:**
- For every sent message, track delivery status: Sent → Delivered → Read (Meta webhooks provide this via tick callbacks)
- Show status icons (single tick / double tick / blue tick) in the chat view
- Failed messages surface as alerts with retry option

---

### What's Missing: Opt-Out / DND Management

**What to build:**
- If a contact replies "STOP" or similar, automatically flag them as Do Not Contact
- Prevent any further automated messages to that number
- Show a DND badge on their lead card
- Report showing all opted-out contacts

---

## 7. Data Quality & Integrity

### No Data Backup Strategy Visible
There's no mention of database backups in the codebase or any admin tools for it.

**Recommendations:**
- MongoDB Atlas automated daily backups (if using Atlas)
- Point-in-time recovery enabled
- Test restoration quarterly
- Export a full data dump monthly and store in a separate cloud bucket

---

### No Audit Log
There is no record of who changed what and when — critical for any business software handling client data.

**What to build:**
- A backend `AuditLog` model: `{ tenantId, userId, action, resource, resourceId, previousValue, newValue, timestamp, ip }`
- Log every: login, logout, lead status change, user created/deleted, settings changed, API key viewed, permission changed
- Admin-only "Audit Log" page in Settings with date filtering and user filtering
- Retain logs for minimum 90 days

---

### No GDPR / Data Privacy Controls
The CRM stores personal data (name, phone, company, location) of third-party contacts. Depending on your clients' jurisdiction, basic data privacy controls are needed.

**What to build:**
- "Delete all data for this contact" option on lead/client detail
- Data export for a contact (all data held) in case of request
- Privacy policy acceptance checkbox at registration
- Data retention settings: auto-delete leads older than N days with status DROP/LOST

---

### Sensitive Fields Stored in Plain Text
GST numbers, PAN numbers, and phone numbers are stored as plain strings with no encryption.

**Recommendation:**
- Phone numbers and other PII should be encrypted at rest in the database using field-level encryption
- At minimum, ensure database access is restricted and not exposed to the public internet

---

## 8. Missing Core Features

### 1. In-App Notifications
The `Notification.tsx` component exists in the UI but notifications are not wired to any backend events.

**What to wire up:**
- Follow-up due today → notification
- New lead assigned to me → notification
- Quotation approved/rejected → notification
- WhatsApp message received → notification
- Integrate with a real-time channel (Socket.io or Supabase Realtime) so notifications appear without page refresh

---

### 2. Mobile Responsiveness Audit
The app uses TailwindCSS but many tables (leads table, quotations) are not usable on a mobile screen. Sales executives often work in the field on phones.

**What to audit and fix:**
- All table views need a mobile card view alternative
- Follow-up calendar needs to be touch-friendly (tap to view, swipe to change month)
- The lead detail panel should be a full-screen bottom sheet on mobile, not a side panel

---

### 3. Search Is Global, Not Smart
Current search only matches exact substrings in name/phone/company.

**What to improve:**
- Fuzzy search (match "Ramesh" even if typed "Ramsh")
- Search across remarks and notes
- Search history (recent searches shown on focus)
- Global search shortcut (Ctrl+K / Cmd+K) that searches across leads, clients, and quotations

---

### 4. No Onboarding / Guided Setup for New Users
After registration, new users see an empty dashboard with no guidance.

**What to build:**
- A setup checklist shown on the dashboard for new accounts: ☐ Add your company details ☐ Add your first lead ☐ Connect a lead source ☐ Add a team member ☐ Send your first WhatsApp message
- Dismiss-able after all steps are complete
- Short tooltip walkthroughs on first visit to each main page

---

### 5. No API for External Integrations
There's no public API or webhook system for clients to push leads from their own website forms.

**What to build:**
- A webhook receiver endpoint: `POST /api/webhooks/:apiKey` that accepts a JSON body and creates a lead
- API Keys page (already exists!) should generate keys tied to this endpoint
- Document the webhook schema so clients can connect contact forms, Typeform, Zapier, etc.
- Show webhook delivery logs (incoming requests, success/fail) on the API Keys page

---

### 6. No Goals / Target Tracking
There's a team leaderboard on the dashboard but no way to set monthly targets.

**What to build:**
- Admin can set monthly targets per executive: N leads to convert, N visits to complete, N quotations to send
- Progress shown as a progress bar in the dashboard leaderboard
- "Behind target" warning badge on executives who are below 50% with less than 2 weeks left in the month

---

## 9. Performance & Reliability

| Issue | Impact | Fix |
|---|---|---|
| No debouncing on lead search | Each keystroke fires an API call | Add 300ms debounce to search input |
| Calendar renders all months' leads at once | Slow on large datasets | Fetch only leads for the visible month |
| No pagination on leads table | 500+ leads will slow down the page | Implement server-side pagination (backend likely supports it — confirm and wire up) |
| No loading skeletons on slow connections | Blank screens feel broken | Add skeleton loaders on all list/table pages |
| External pincode API called synchronously | Single point of failure in lead form | Add timeout + fallback to manual entry |
| No error boundaries in React | One crashed component crashes the whole app | Wrap major page sections in `<ErrorBoundary>` |

---

## 10. Priority Roadmap

### Phase 1 — Security & Auth (Do First, Non-Negotiable)
| # | Task | Effort |
|---|---|---|
| 1 | Forgot Password flow (email reset link) | 2 days |
| 2 | Move JWT to HttpOnly cookie (stop using localStorage) | 1 day |
| 3 | Rate limiting on login, register, forgot-password | 0.5 days |
| 4 | Server-side Razorpay payment verification | 1 day |
| 5 | XSS sanitization middleware on backend | 0.5 days |
| 6 | Email verification on registration | 1 day |

### Phase 2 — Lead Management (High Business Value)
| # | Task | Effort |
|---|---|---|
| 7 | Follow-up reminder emails (daily digest cron) | 1 day |
| 8 | Bulk actions on leads (assign, status, export) | 2 days |
| 9 | CSV / Excel export of leads | 1 day |
| 10 | Duplicate lead detection on import | 1.5 days |
| 11 | Drop reason capture + analytics | 1 day |
| 12 | Call logging after clicking Call button | 1 day |

### Phase 3 — Communication & WhatsApp
| # | Task | Effort |
|---|---|---|
| 13 | WhatsApp template library with variable support | 2 days |
| 14 | Incoming message handling + inbox wiring | 2 days |
| 15 | Message delivery status (sent/delivered/read ticks) | 1 day |
| 16 | Opt-out / DND management | 0.5 days |
| 17 | Unified lead activity timeline | 2 days |
| 18 | WhatsApp auto-sequence builder | 3 days |

### Phase 4 — Data & Reliability
| # | Task | Effort |
|---|---|---|
| 19 | Audit log (who changed what, when) | 2 days |
| 20 | In-app real-time notifications (Socket.io) | 2 days |
| 21 | Mobile responsive audit & card views | 3 days |
| 22 | Server-side pagination on leads | 1 day |
| 23 | Global smart search (Ctrl+K) | 2 days |
| 24 | New user onboarding checklist | 1 day |

---

*This document reflects the state of the codebase as of June 2026. Re-audit recommended after each major phase.*
