
---

FloorTrack Databases Documentation
===============================================

FloorTrack is a web app for visualizing Wi‑Fi Access Points (APs), devices, and floor plans with fine-grained, group-scoped permissions. It showcases a non-trivial relational data model, API design with Prisma and Express, and a React-based dashboard.

Project Architecture
-----------------------

FloorTrack is a decoupled system:

-   **Frontend:** React (Vite), SVG-based floorplan rendering, zoom/pan interactions, protected routes.
-   **Backend:** Node.js, Express REST API, Helmet hardening, rate limiting, structured logs.
-   **Database:** PostgreSQL (Supabase). Prisma ORM for schema, migrations, and data access.
-   **Auth:** Firebase Client SDK (signup/login) and Firebase Admin (ID token verification, account deletion).
-   **Hosting:** Render (frontend static site, backend web service); Supabase for Postgres.

Key front-end views:

-   Protected routing and session verification (RequireAuth).
-   Floor dashboard: heatmap overlay, zoomable SVG map, stats, device-by-AP breakdown.
-   Admin dashboard: buildings, floors (SVG maps), APs, devices, groups, global permissions.
-   User profile and personal device management.

* * * * *

Database Design & ER Model
-----------------------------

![ER Model](<ER Model.png>)


-   Entities and keys: BigInt IDs, unique constraints (e.g., APs.name, UserDevices.mac).
-   Relationships:
    -   Users → Roles (many-to-one)
    -   Users → UserDevices (one-to-many; cascade)
    -   Users ↔ Groups (many-to-many via UserGroups)
    -   Buildings → Floors (one-to-many; cascade)
    -   Floors → APs (one-to-many; cascade)
    -   APs → Clients (one-to-many; cascade)
    -   GlobalPermissions binds Group--Building--Floor (scope rules)
-   Cascades and referential integrity annotations.

* * * * *

Data Pipeline
----------------

-   **Role seeding:** Initialize required roles (Owner, Organization Admin, Site Admin, Viewer, Pending User) once in your DB (e.g., Supabase SQL editor).
-   **Admin UI-driven creation:** Buildings, Floors (paste/upload SVG), APs (cx, cy on map), Devices (MAC).
-   **Client events:** "Clients" table entries represent device connections to APs; can be created via admin endpoints or simple ingestion scripts.

The Admin dashboard provides guided flows and debounced editors for a smooth data-entry experience.

* * * * *

Use Cases
------------

### 1) Authentication & Profile

-   Signup/login with httpOnly cookie session; profile viewing/editing.
-   Password reset flow and secure account deletion (server-side verification).
-   Owned devices: CRUD per user for name + MAC under /api/profile/devices.

### 2) Floor Visualization

-   Floor selector with building name; zoomable SVG; AP markers with density ripples and hover tooltips.
-   Stats endpoints: total devices, total APs, devices-by-ap (strict floor-level permission checks).
-   Personal connections: latest AP for each registered MAC.

### 3) Admin Management (RBAC-aware)

-   Buildings: CRUD (Owner-only for create/delete; filtered reads for Admins).
-   Floors: CRUD; Owner/Org Admin with scope checks; SVG map editing UI.
-   APs: CRUD within authorized floors; cx/cy edits; scoped by canManageFloor.
-   Devices (Clients): CRUD with MAC uniqueness and floor scope enforcement.
-   Groups: Owner-only CRUD.
-   GlobalPermissions: Owner/Org Admin CRUD (Org Admin restricted to their own groups).
-   Pending Users: Owner assigns role and groups.

* * * * *

Performance & Optimization
----------------------------

-   **API-level controls:**

    -   Rate limiting tiers for auth, admin, and global APIs.
    -   Helmet with CSP and other headers for robust security and predictable resource loading.
-   **Querying strategy:**

    -   Prisma select/include tuned for needed graph portions.
    -   Admin UI sorts and filters in-memory with stable comparators for responsive UX.
-   **Transactions:**

    -   Floor creation can automatically create GlobalPermission entries in a transaction for consistency.
-   **Frontend rendering:**

    -   Memoized AP overlays, pointer-event optimizations, and zoom/pan calculus done client-side for smooth maps.

* * * * *

API Documentation
--------------------

High-level overview:

-   **Auth & Profile**

    -   POST /api/register, /api/login, /api/logout, /api/reset-password
    -   GET/PUT/DELETE /api/profile
    -   Owned devices: GET/POST/PUT/DELETE /api/profile/devices
-   **Admin (RBAC)**

    -   Buildings: GET/POST/PUT/DELETE /api/admin/buildings
    -   Floors: GET/POST/PUT/DELETE /api/admin/floors
    -   APs: GET/POST/PUT/DELETE /api/admin/aps
    -   Devices: GET/POST/PUT/DELETE /api/admin/devices
    -   Groups: GET/POST/PUT/DELETE /api/admin/groups
    -   GlobalPermissions: GET/POST/DELETE /api/admin/global-permissions
    -   Roles & Pending Users: GET /api/admin/roles, GET /api/admin/pending-users, POST /api/admin/pending-users/:id/assign
-   **Floor Dashboard & Stats**

    -   Floors (filtered by group permissions): GET /api/floors, GET /api/floors/:floorId, GET /api/floors/:floorId/building
    -   Stats: GET /api/stats/total-devices, GET /api/stats/total-aps, GET /api/stats/devices-by-ap
    -   Personal connections: GET /api/users/:userId/ap-connection (only for the authenticated user)

* * * * *

Local Deployment Guide
-----------------------------------------------------

Prerequisites - 
- Node.js 18+ and npm
- Postgres database (Supabase recommended or local Postgres)
- Firebase project (Client SDK + Admin SDK service account)

1. Clone and install
```bash
git clone https://github.com/Kathir-Subramaniam/wifi-project.git
cd wifi-project
# Install dependencies for backend and frontend
# Backend
cd backend
npm install
# Frontend
cd ../frontend
npm install
```

2. Backend environment variables

Create a `.env` file in the backend directory:
```env
NODE_ENV="development"
PORT=3000

# Database (Supabase-compatible Postgres)
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
DIRECT_URL=postgresql://<user>:<pass>@<host>:<port>/<db>

# CORS allowlist for dev
FRONTEND_ORIGIN=http://localhost:5173

# Firebase client SDK
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=yourapp.firebaseapp.com
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...

# Firebase Admin (service account JSON as a single string)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...", "auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

3. Initialize the database (Prisma)
```bash
# From backend directory
npx prisma migrate dev
npx prisma generate
```

4. Seed initial roles (required)

The backend logic expects a `Pending User` role and uses role-based access control. Create roles manually using SQL (Supabase SQL editor or psql):
```sql
INSERT INTO "Roles" (id, name) VALUES
  (1, 'Owner'),
  (2, 'Organization Admin'),
  (3, 'Site Admin'),
  (4, 'Viewer'),
  (5, 'Pending User')
ON CONFLICT DO NOTHING;
```

5. Start the backend
```bash
# From backend directory
node src/server.js
# or
npx nodemon src/server.js
```

6. Frontend environment variables

Create a `.env` file in the frontend directory:
```env
VITE_API_BASE=http://localhost:3000
```

7. Start the frontend
```bash
# From frontend directory
npm run dev
# Default dev server at http://localhost:5173
```

8. First-run flow
- Register a user via the frontend. The backend expects `firstName`, `lastName`, `email`, `password` when calling `/api/register`.
- Log in via `/api/login`. The backend sets an httpOnly cookie `access_token` with your Firebase ID token.
- To grant yourself Owner access, update your user’s role in the database:
```sql
UPDATE "Users" SET "roleId" = 1 WHERE email = 'your.email@example.com';
```
- As Owner, you can use the Admin dashboard to create Buildings, Floors (upload or paste SVG), APs, Devices, Groups, and Global Permissions.

---

## Environment Configuration

Backend - 
- CORS is controlled by `FRONTEND_ORIGIN`. For dev: `http://localhost:5173`. In production, set this to your Render frontend URL.
- Helmet sets security headers (CSP, HSTS in prod, frameguard, noSniff, XSS filter).
- Rate limiters applied globally and per-sensitive route.

Frontend - 
- Uses `VITE_API_BASE` to call backend APIs with `credentials: 'include'`.
- `RequireAuth.jsx` checks `/api/profile` to gate protected routes.

Database - 
- Prisma schema defines all models with referential integrity and cascades.
- Run `npx prisma migrate dev` to create schema locally.

Auth - 
- Firebase Client SDK handles signup/login.
- Firebase Admin verifies ID tokens server-side and handles account deletion.

---

Mock Data Generation (Seeding)
------------------------------

To quickly populate the database with realistic test data, we provide a seed workflow that mirrors how we populated our own development and demo environments. This seed initializes roles, creates sample organizations, buildings, floors (with SVG maps), APs placed on the floorplan, user groups and memberships, and a set of client devices distributed across APs.

### What the seed does

-   Roles: Inserts Owner, Organization Admin, Site Admin, Viewer, Pending User.
-   Groups: Creates sample groups (e.g., "IT", "Facilities", "Visitors").
-   Users: Creates a few demo users and assigns them to roles and groups (e.g., one Owner, one Org Admin in "IT", one Site Admin).
-   Buildings & Floors: Adds a demo building and one or more floors, attaching SVG maps for visualization.
-   APs: Places APs on each floor with cx, cy coordinates aligned to the SVG map coordinate system.
-   Devices (Clients): Inserts multiple client MACs and assigns them to APs to simulate occupancy and hotspots.
-   GlobalPermissions: Grants group-level access to buildings/floors so Org/Site Admin scopes are respected in the UI and API.

### How to run it locally

1.  Ensure your database is migrated and Prisma client is generated:

```bash

# from backend directory

npx prisma migrate dev

npx prisma generate

```

2.  Set your backend environment variables (DATABASE_URL, DIRECT_URL, Firebase variables, etc.) in .env as described in your setup section.

3.  Run the seed script:

```bash

# Directly call your seed script:

node scripts/seed.js

```

4.  Verify results:

-   Roles table contains the 5 baseline roles (Owner, Organization Admin, Site Admin, Viewer, Pending User).
-   Admin Dashboard shows your seeded Buildings/Floors/APs/Devices/Groups.
-   Floor Dashboard renders heatmaps over the seeded APs and device counts.

---
## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express, Prisma
- Database: Postgres (Supabase-compatible)
- Auth: Firebase Client SDK + Firebase Admin
- Hosting (prod): Render (frontend static + backend web service)

* * * * *

Security and Compliance
--------------------------

-   **Session Security:** httpOnly cookie for ID token; server-side verification via Firebase Admin middleware.
-   **RBAC & Scope:**
    -   Roles: Owner, Organization Admin, Site Admin, Viewer, Pending User (UI reflects role visibility).
    -   Scope checks via canManageBuilding/canManageFloor for admin actions.
-   **Rate Limiting:** Separate tiers for auth, reset-password, admin, global API.
-   **Headers & CSP:** Helmet configuration with CSP, HSTS, nosniff, frameguard, XSS filter.
-   **CORS:** credentials-enabled, strict origin allowlist (FRONTEND_ORIGIN).
-   **Logging:** pino with redaction and per-request correlation IDs.

* * * * *

Team Contribution
-------------------------

The whole project from start to end was a learning journey for both of us (Kathir and Benediktas). We worked on everything together collobaratively and all the code was written when we were together in person. That way we were both able to learn from each other and had the input of the other person when making business descions.   