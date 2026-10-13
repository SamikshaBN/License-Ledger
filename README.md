# LicenseLedger: SaaS Asset and Software License Tracker

A role-based web system where IT staff manage employees, hardware and software subscription seats against department budgets. The database enforces the rules that stop money being wasted: no overselling seats, atomic offboarding, and automatic audit trails.

**Stack:** Next.js 14 (App Router, Route Handlers) · PostgreSQL 16 · MongoDB 7 · JWT cookie auth · Git/GitHub

| Database   | Holds                                                                                                    | Why                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| PostgreSQL | employees, departments, budgets, hardware, assignments, seats, subscriptions, renewals, users, audit log | Relational data that needs constraints, transactions, triggers and row locking        |
| MongoDB    | vendor invoices                                                                                          | Each vendor's invoice has a different shape with nested line items; read in aggregate |

## Prerequisites

Node.js 20.6+, Docker Desktop (runs only the databases), Git.

## Setup

```bash
git clone <repo-url>
cd licenseledger
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env` and set a long random `JWT_SECRET` (the other defaults work with the Docker setup).

```bash
docker compose up -d        # PostgreSQL (host port 5433) + MongoDB; db/*.sql run on first start
npm install
npm run db:seed             # people and hardware demo data (WIPES existing data)
npm run seed:software       # subscriptions, seats and MongoDB invoices
npm run dev                 # http://localhost:3000
```

If your database volume existed before `db/02_software.sql` was added, run `npm run db:software` once.

### Demo logins

| Username | Password     | Role     |
| -------- | ------------ | -------- |
| admin    | Admin@123    | admin    |
| itstaff  | ItStaff@123  | it_staff |
| arjun    | Employee@123 | employee |

### Reset everything

```bash
docker compose down -v && docker compose up -d && npm run db:seed && npm run seed:software
```

## Tests and evidence scripts

```bash
npm run test:unit           # validation tests, no database needed
npm run test:integration    # needs databases, seed data and `npm run dev` running
npm run test:concurrency    # two simultaneous requests for the last seat: exactly one wins
npm run explain:search      # EXPLAIN ANALYZE of full-text search before/after the GIN index
```

## Troubleshooting

- `password authentication failed for user "ledger"`: another PostgreSQL is using port 5432 on your PC. This project publishes the container on **5433**; make sure `DATABASE_URL` uses 5433, then `docker compose down -v && docker compose up -d`.
- After editing `.env`, restart `npm run dev`.

## Roles

- **admin:** everything (budgets, retiring assets, audit log, users, subscriptions, renewals, invoices).
- **it_staff:** employees, hardware assignment, offboarding, seat assignment, software reports.
- **employee:** sees only their own hardware and software seats.

## Project structure

```
db/                 01_schema.sql, 02_functions_triggers.sql, 02_software.sql (run by Docker on first start)
lib/                auth (JWT), withAuth, withTx, validation, error mapping; lib/software/* for the software module
middleware.js       login check and role-based page redirects
app/api/auth        login, logout, me
app/api/people      employees, departments, budgets, hardware, assignments, offboarding, audit, users, me
app/api/software    subscriptions, vendors, seats, renewals, waste report, invoices, analytics
app/dashboard       UI pages
scripts/            seed and evidence scripts
tests/              unit and integration tests
docs/               project documentation (Word), diagrams, SQL query files
```

## Where each database concept is shown

| Concept                                        | Where                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| DDL: CREATE, ALTER, DROP, constraints, indexes | `db/*.sql`, `docs/sql/03_ddl_demo.sql`                                                                                          |
| Transaction                                    | offboarding: `app/api/people/offboard/[employeeId]/route.js`                                                                    |
| Triggers                                       | audit, assignment guard and status sync: `db/02_functions_triggers.sql`                                                         |
| Views                                          | `v_hardware_inventory`, `v_department_hardware_summary`, `v_subscription_utilization`, `v_renewal_forecast`, `v_departed_seats` |
| Stored functions with row locking              | `assign_seat`, `revoke_seat`, `release_all_seats`, `renew_subscription` in `db/02_software.sql`                                 |
| Indexing and full-text search                  | partial unique indexes, GIN on `search_vector`                                                                                  |
| NoSQL aggregation                              | monthly spend and anomaly pipeline: `app/api/software/invoices/analytics/route.js`                                              |

## Documentation

Full documentation: `docs/LicenseLedger_Project_Documentation.docx`. Diagrams are in `docs/images/`.

## Team

- **Samiksha BN (Person A):** people and hardware, authentication and roles, audit triggers, offboarding transaction, employee view, tests.
- **Roopa Sreedhar A (Person B):** software and spend, seat allocation function, renewal and waste views, full-text search, MongoDB invoices and analytics.
