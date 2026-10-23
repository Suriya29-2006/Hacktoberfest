# CareWeave API

All `/api/*` routes except `/api/health` and `/api/auth/login` require `Authorization: Bearer <session-token>`. Responses are JSON and errors use `{ "error": "..." }`.

## Authentication

- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET /api/me` — current session identity

## Shared records

- `GET /api/dashboard` — role-scoped dashboard counts and queue records
- `GET /api/patients?query=` — receptionist/doctor permitted search
- `POST /api/patients` — receptionist-only registration
- `GET /api/patients/:id/record` — doctor-only unified patient record with timeline and chart
- `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`
- `POST /api/encounters`, `PATCH /api/encounters/:id` — doctor-only clinical documentation

## Laboratory

- `GET /api/lab-orders` — lab/doctor queue access
- `POST /api/lab-orders` — doctor creates a requested test
- `PATCH /api/lab-orders/:id/status` — lab advances workflow
- `POST /api/lab-results` — lab submits draft result for verification
- `POST /api/lab-results/:id/verify` — lab verification permission finalizes result

Lab workflow statuses are `Requested`, `Sample Collection Pending`, `Sample Collected`, `Processing`, `Awaiting Verification`, `Verified`, and `Released to Doctor`.

## Clinical and reconciliation

- `POST /api/prescriptions` — doctor-only, clinician-authored prescription
- `GET /api/reconciliation/cases` — doctor-only review queue
- `PATCH /api/reconciliation/cases/:id` — doctor records `keep-separate` or `link` decision
- `POST /api/external-records/import` — doctor imports a synthetic structured record; source provenance is retained and a review case is created

## Authorization examples

- A lab token calling `POST /api/prescriptions` receives `403`.
- A receptionist token calling `GET /api/patients/:id/record` receives `403`.
- A missing or expired token receives `401`; error responses do not reveal protected record contents.
