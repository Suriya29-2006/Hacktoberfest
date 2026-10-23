# CareWeave — Unified Patient Health Records Platform

CareWeave is a hackathon-ready, permission-aware demo for connecting fragmented patient records into one traceable health timeline. It includes three role-specific portals backed by one API and one shared persisted data store.

> **Safety note:** all data is synthetic. This project is a prototype and does not claim clinical accuracy, real hospital interoperability, regulatory compliance, or production security certification.

## Demo accounts

| Portal | Email | Password |
|---|---|---|
| Receptionist | `reception@careweave.test` | `demo123` |
| Laboratory | `lab@careweave.test` | `demo123` |
| Doctor | `doctor@careweave.test` | `demo123` |

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The API runs on `http://localhost:4000`. The Vite dev server proxies `/api` to it.

To run only the API or only the client:

```bash
npm run server
npm run client:dev
```

Copy `.env.example` to `.env` to configure `PORT`, `CLIENT_ORIGIN`, `MONGO_URI`, and `JWT_SECRET`.

## Demo story

1. Sign in as Receptionist and open **Patients**. Registration is server-validated and duplicate names + DOBs are rejected for review.
2. Sign in as Doctor and open **Patient records → Ava Morgan** (`CW-10482`). The unified timeline shows a Harborview consultation, imported lab history, a prescription conflict, and an internal pending CBC order.
3. Sign in as Laboratory and open **Verification queue**. Submit/verify/release the pending CBC result. The result remains visibly pending until the explicit verification step.
4. Return to Doctor and refresh Ava Morgan’s timeline. The new result is linked automatically to the same patient and encounter context.
5. Add a clinician-authored consultation note and prescription from the **Consultations** and **Prescriptions** tabs.
6. Open **External record review** to inspect possible duplicate, conflicting medication, and ambiguous identity-match cases. Resolve a case with **Keep separate** or **Review & link**; original records are retained.
7. Verify least privilege: the lab account receives HTTP 403 for prescription creation, while reception sees administrative data only.

## Implemented API surface

- `POST /api/auth/login`, `GET /api/me`
- `GET /api/dashboard`
- `GET/POST /api/patients`, `GET /api/patients/:id/record`
- `GET/POST/PATCH /api/appointments`
- `POST/PATCH /api/encounters`
- `GET/POST/PATCH /api/lab-orders`
- `POST /api/lab-results`, `POST /api/lab-results/:id/verify`
- `POST /api/prescriptions`
- `GET/PATCH /api/reconciliation/cases`
- `POST /api/external-records/import`

Every protected endpoint checks the bearer session and role on the server. Patient record access is separately restricted to doctors. Audit events are written for logins, searches, record reads, creates, updates, verification, imports, and reconciliation decisions.

## Persistence and data model

The default demo uses `data/careweave.json` so the project can run without external infrastructure while still persisting records through the backend. It is generated from synthetic seed data on first API start. The code includes the `MONGO_URI` configuration hook and `mongoose` dependency for the next persistence adapter step; production deployment should replace the JSON adapter with MongoDB-backed repositories and secure object storage for files.

Logical collections represented in the demo store:

- Users
- Patients
- Appointments
- Encounters
- LabOrders / LabResults
- Prescriptions
- ExternalRecords
- Record reconciliation cases
- AuditLogs

## Security boundaries demonstrated

- Passwords are bcrypt-hashed; the JSON store does not contain plaintext demo passwords.
- Server-side role checks are independent from frontend navigation.
- Doctors can open full unified records; reception is limited to administrative patient data; laboratory users are limited to lab workflow actions.
- Lab results require explicit verification before release.
- Imported records preserve source facility, source record ID, event date, importer, and status.
- Duplicate and conflict cases are reviewed without deleting or overwriting originals.
- No real patient identifiers are used.

## Checks

```bash
npm run build
```

The build compiles TypeScript and produces a Vite production bundle.

## Known prototype limitations

- The runnable demo uses a durable JSON persistence adapter rather than an active MongoDB connection so the hackathon story works with zero infrastructure. Mongoose is included as the intended production adapter.
- Structured JSON import is implemented; CSV/PDF upload and secure external object storage are still follow-up work.
- Session tokens are in-memory bearer sessions for the demo. Production should use secure, rotating cookies or a hardened token/session service.
- File virus scanning, HTTPS termination, rate limiting, and deployment secrets require infrastructure configuration outside this local prototype.
