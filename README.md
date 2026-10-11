# LicenseLedger (Person A slice: People and Hardware)

## Setup
```bash
cp .env.example .env          # set JWT_SECRET
docker compose up -d          # Postgres (runs db/*.sql on first start) + Mongo
npm install
npm run db:seed               # demo data. Logins: admin / Admin@123, itstaff / ItStaff@123
npm run dev                   # http://localhost:3000
npm run test:unit             # validation tests, no DB needed
npm run test:integration      # needs server + seeded DB running
```
Reset the database: `docker compose down -v && docker compose up -d && npm run db:seed`

## Layout
- `db/01_schema.sql` frozen schema v1, `db/02_functions_triggers.sql` audit triggers, assignment triggers, views, `release_all_seats` stub
- `lib/` auth (JWT cookie), `withAuth(roles, handler)`, validation, error mapping, `withTx`
- `app/api/people/*` Person A routes, `app/api/software/*` Person B routes
- `app/dashboard/*` pages. Person B adds links in `components/Nav.js`

## Conventions
- Errors: `{ "error": { "code", "message", "details?" } }`
- Auth: `export const GET = withAuth(['admin','it_staff'], async (req, ctx, user) => json({...}))`
- Every write uses `withTx(user.id, fn)` so audit triggers fill `changed_by`
