# FloorTrack Setup README

Welcome to FloorTrack. This README provides a step-by-step local setup guide.

- Quick Start: Local Setup
- Environment Configuration
- Tech Stack

---

## Quick Start: Local Setup

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

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express, Prisma
- Database: Postgres (Supabase-compatible)
- Auth: Firebase Client SDK + Firebase Admin
- Hosting (prod): Render (frontend static + backend web service)

---
Team Contribution
-------------------------

The whole project from start to end was a learning journey for both of us (Kathir and Benediktas). We worked on everything together collobaratively and all the code was written when we were together in person. That way we were both able to learn from each other and had the input of the other person when making business descions. 