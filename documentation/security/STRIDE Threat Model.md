# Threat Model and Implemented Security Measures

This section documents our STRIDE threat model and the concrete security measures implemented for our live web application.

- Frontend: React single page application on Render (static site)
- Backend: Express + Prisma on Render (web service), Firebase for identity
- Database: Supabase Postgres

---

## System Architecture and Trust Boundaries

- Components
  - Browser client (untrusted)
  - Frontend (Render static hosting)
  - Backend API (Render web service)
  - Supabase Postgres

- Trust Boundaries
  - Browser → Frontend (public internet)
  - Frontend → Backend API (TLS; cookie-based session; CORS-restricted)
  - Backend API → Supabase DB (private credentials; network policies)
  - Backend API → Firebase (Admin SDK credentials)
  - RBAC Boundary: Owner vs Organization Admin vs Site Admin vs Viewer

- Key Data Flows
  - Auth: Firebase ID token set as `access_token` HTTP-only cookie on login; backend verifies per request
  - Reads: floors, maps, stats scoped by GlobalPermissions and role
  - Admin CRUD: buildings, floors, APs, devices, groups, global-permissions; role-gated and group-scoped

---

## Assets, Entry Points, and Assumptions

- Assets
  - User identities and sessions
  - Authorization model: Roles, Groups, GlobalPermissions
  - Floor maps (SVG), buildings/floors/AP/device metadata
  - Audit-relevant actions (admin CRUD)

- Entry Points (non-exhaustive)
  - `/api/login`, `/api/register`, `/api/logout`, `/api/reset-password`
  - Protected profile: `/api/profile`, `/api/profile/devices`
  - Protected floor data: `/api/floors`, `/api/floors/:id`, `/api/floors/:id/building`
  - Protected stats: `/api/stats/*`
  - Admin scope: `/api/admin/*` (buildings, floors, aps, devices, groups, global-permissions, roles, pending-users)

---

## STRIDE Threat Model

### S - Spoofing Identity

- Threats - 
  - Stolen or forged session cookie used to impersonate users/admins
  - Direct calls to backend bypassing frontend route guards

- Controls in Place - 
  - Server-side Firebase Admin verification of `access_token` cookie on all protected routes (`verifyToken`)
  - HTTP-only cookie; no token in browser storage
  - CORS restricted to `FRONTEND_ORIGIN` with `credentials: true`; CSP limits `connect-src` to backend and Google identity
  - Role checks applied server-side (not reliant on client UI)

- Gaps / Risks -
  - No device/session binding (single cookie works across devices)

- Actions -
  - Add session invalidation on role changes and optional device binding (e.g., server-side session id)

### T - Tampering

- Threats - 
  - Unauthorized modifications to buildings/floors/APs/devices
  - SVG payloads containing malicious content

- Controls in Place - 
  - RBAC + group-scoped checks via `getAppUser`, `canManageBuilding`, `canManageFloor`
  - `toBi` guards numeric IDs; Prisma uses parameterized queries
  - CSP denies third-party scripts; `object-src 'none'`; map uses Blob URL rendered via `<image href>` (not inline SVG execution)

- Gaps / Risks - 
  - Server-side input validation beyond ID numeric check is limited (e.g., MAC format, names, coordinate ranges)
  - SVG content not server-sanitized

- Actions -
  - Add request schema validation (Joi/Zod): MAC normalization, name length caps, numeric ranges, SVG size
  - Validate/sanitize SVG: reject `<script>`, `on*=` handlers, `foreignObject`, and JS URLs; continue rendering via `<img>`/`<image>`

### R - Repudiation

- Threats - 
  - Admin or user denies creating/updating/deleting resources

- Controls in Place
  - Pino logging with per-request IDs; structured logs include uid, action, resource ids
  - Redaction of cookies and authorization headers

- Gaps / Risks - 
  - No immutable audit trail in DB

- Actions - 
  - Add `AuditLog` table to record actor, action, entity, timestamps, and requestId for all admin mutations

### I - Information Disclosure

- Threats - 
  - Exposure of SVG floor plans to unauthorized groups
  - Leakage of user PII or group data
  - Verbose error messages revealing internals

- Controls in Place - 
  - Strict authorization for floors/building and stats endpoints (role + GlobalPermissions)
  - Profile and device endpoints limit to owner of the data
  - Helmet CSP, frameguard, noSniff; CORS origin allowlist

- Gaps / Risks - 
  - Some 500 responses include raw error messages
  - Diagnostic endpoint exists (protected) but may reveal environment info

- Actions -
  - Replace generic 500s with non-descriptive messages; keep details server-side only
  - Restrict or remove diagnostic endpoints in production; Owner-only if retained

### D - Denial of Service

- Threats - 
  - Flooding login or admin endpoints; heavy stats queries at scale
  - Oversized SVG payloads causing memory pressure

- Controls in Place - 
  - Rate limiters: global, auth, reset-password, and admin scopes
  - Scoped queries (counts by floor, APs by floor) to reduce query breadth

- Gaps / Risks - 
  - No explicit request body size limits for JSON (SVG)

- Actions - 
  - Configure `express.json({ limit: '256kb' })` (or suitable cap) and return 413 on exceed
  - Verify DB indexes on hot paths; consider short-lived caching for read-heavy stats per floor

### E - Elevation of Privilege

- Threats - 
  - Non-Owner performing Owner-only actions
  - Org/Site Admin managing out-of-scope floors/buildings via ID tampering

- Controls in Place - 
  - Server-side role gates for all admin endpoints (Owner-only where required)
  - Group-based scoping enforced via `canManageBuilding`/`canManageFloor` and GlobalPermissions

- Gaps / Risks - 
  - Ensure that new code changes don't accidentally break existing security rules or grant unintended access 

- Actions - 
  - Add integration tests covering negative cases (e.g., Site Admin creating floors, Org Admin editing out-of-scope floor)

---

## Implemented Security Measures

- Authentication and Session
  - Firebase Admin verification (`verifyToken`) on all protected endpoints
  - HTTP-only cookie for `access_token`; frontend uses `credentials: 'include'`
  - Server-side route guards for data and admin operations

- Authorization and RBAC
  - Roles: Owner, Organization Admin, Site Admin, Pending User, etc.
  - Group membership and GlobalPermissions to scope access by building/floor
  - Central RBAC helpers: `getAppUser`, `canManageBuilding`, `canManageFloor`
  - Owner-only restrictions on sensitive admin actions (e.g., buildings, pending users)

- Transport and Headers
  - Deployed over HTTPS (Render)
  - Helmet: HSTS (prod), CSP with strict directives, frameguard, noSniff, CORP/COOP
  - CORS: origin limited to `FRONTEND_ORIGIN`, credentials enabled, restricted methods/headers

- Input and Data Protection
  - Numeric ID validation with `toBi`
  - Prisma ORM with parameterized queries
  - Map SVG rendered via image/Blob URL rather than inline execution

- Rate Limiting and Abuse Prevention
  - Global API limiter
  - Auth limiter (10/10min), Reset-password limiter (5/30min)
  - Admin limiter (100/5min)

- Logging and Observability
  - Pino HTTP with per-request IDs
  - Redaction of cookies and authorization headers
  - Structured logs for create/update/delete with actor and resource IDs

- Secure Operations
  - Secrets in environment variables (Firebase, DB URLs)
  - Role-restricted admin endpoints

---

## Mitigation Backlog (Prioritized)

1. Input Validation and Normalization -
  - Add schema validation (Joi/Zod) for all inputs: MAC regex and normalization, name length limits, numeric ranges
  - Enforce body size limits for JSON/SVG

2. SVG Handling - 
  - Server-side sanitize/validate SVG content (reject scripts/handlers/foreignObject/JS URLs)
  - Continue rendering via `<img>`/`<image>` to prevent inline execution

3. Authorization Test Suite and Audit - 
  - Integration tests for all admin and stats endpoints (positive/negative)
  - Add immutable `AuditLog` table for admin mutations

5. DoS Resilience and Performance - 
  - Verify DB indexes on `Clients(mac)`, `APs(floorId)`, `GlobalPermissions(floorId, groupId)`
  - Cache read-heavy stats per floor with short TTL

6. Error Handling - 
  - Replace detailed error bodies with generic messages; log details server-side only

---

## Verification and Evidence Plan

- Access Control - 
  - Unauthorized access to `/api/floors/:id` without group permission → expect 403
  - Owner-only admin actions (e.g., POST `/api/admin/buildings`) as non-Owner → expect 403

- Input Hardening - 
  - Submit non-numeric IDs → expect 400 from `toBi` validation
  - Oversized `svgMap` payload → expect 413 after body limit is configured

- Spoofing Resistance - 
  - Omit `access_token` cookie → expect 403 with “No token provided”
  - Replay cookie from different browser/IP → verify detection and logging

- Rate Limits - 
  - Exceed auth endpoint attempts → expect 429 with rate-limit log
  - Exceed admin limiter → expect 429

- Logging and Repudiation - 
  - Perform create/update/delete and verify structured log entries with uid, resource id, requestId

---

## Key Protected Endpoints (Reference)

- Profile: `/api/profile`, `/api/profile/devices` (verifyToken + ownership checks)
- Floors and Maps: `/api/floors`, `/api/floors/:id`, `/api/floors/:id/building` (role + GlobalPermissions)
- Stats: `/api/stats/total-devices`, `/api/stats/total-aps`, `/api/stats/devices-by-ap` (role + GlobalPermissions)
- Admin (role/GP scoped)
  - Buildings: list/create/update/delete (Owner-only mutations)
  - Floors: create/update/delete (Owner or Org Admin with scope; Site Admin forbidden for mutations)
  - APs and Devices: create/update/delete (requires `canManageFloor` or Owner)
  - GlobalPermissions: Owner full; Org Admin limited to own groups; Site Admin forbidden
  - Pending Users: Owner-only list and assign

---
