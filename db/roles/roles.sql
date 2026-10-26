-- Role-based access control inside PostgreSQL. Safe to run any number of times.
-- Applied automatically by `npm run dev` (predev) and by `npm run db:roles`.
-- Three database roles, one per application role, with least-privilege grants.
-- They are LOGIN roles: scripts/apply-roles.js gives them the password from .env (LL_ROLE_PASSWORD).
-- The web app connects to PostgreSQL AS the matching role for every request after login (lib/dbrole.js),
-- so everything the logged-in user does is checked by these grants.
-- Re-run after `npm run db:software` (it re-creates the views, which drops their grants).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'll_admin')    THEN CREATE ROLE ll_admin    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'll_it_staff') THEN CREATE ROLE ll_it_staff NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'll_employee') THEN CREATE ROLE ll_employee NOLOGIN; END IF;
END $$;

COMMENT ON ROLE ll_admin    IS 'Admin: full access to every table and function';
COMMENT ON ROLE ll_it_staff IS 'IT staff: read everything except audit log and passwords; manage employees, hardware and seats; no budgets, no deletes';
COMMENT ON ROLE ll_employee IS 'Employee: sees only their own assignments and seats (row-level security)';

GRANT USAGE ON SCHEMA public TO ll_admin, ll_it_staff, ll_employee;

-- start from a clean slate so re-running never leaves stale privileges
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM ll_admin, ll_it_staff, ll_employee;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ll_admin, ll_it_staff, ll_employee;

-- ---------------- ADMIN ----------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO ll_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ll_admin;

-- ---------------- IT STAFF ----------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ll_it_staff;            -- tables and views
REVOKE ALL ON audit_log, app_user FROM ll_it_staff;                    -- no audit log, no password hashes
GRANT INSERT, UPDATE ON employee, hardware_asset, asset_assignment, seat_assignment TO ll_it_staff;
-- column-level privileges: may see who has a login and disable it (offboarding), nothing else
GRANT SELECT (employee_id, username, role, is_active), UPDATE (is_active) ON app_user TO ll_it_staff;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ll_it_staff;

-- ---------------- EMPLOYEE ----------------
-- Only what the "My assets" and "My software" pages need. Rows are limited by the policies below.
GRANT SELECT ON asset_assignment, seat_assignment TO ll_employee;
GRANT SELECT (asset_id, asset_tag, type, make_model, serial_number) ON hardware_asset TO ll_employee;
GRANT SELECT (subscription_id, vendor_id, name, plan, cost_per_seat, billing_cycle, renewal_date, status) ON software_subscription TO ll_employee;
GRANT SELECT (vendor_id, name) ON vendor TO ll_employee;
GRANT SELECT (department_id, name) ON department TO ll_employee;
GRANT SELECT (employee_id, full_name, email, department_id, job_title, hire_date) ON employee TO ll_employee;  -- own row only (policy)

-- ---------------- Row-level security ----------------
-- (the owner account bypasses RLS; the web app now runs every request as one of the three roles, so these policies apply to it)
ALTER TABLE asset_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_assignment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee         ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all_employees   ON employee;
DROP POLICY IF EXISTS own_employee_row      ON employee;
DROP POLICY IF EXISTS staff_all_assignments ON asset_assignment;
DROP POLICY IF EXISTS own_assignments       ON asset_assignment;
DROP POLICY IF EXISTS staff_all_seats       ON seat_assignment;
DROP POLICY IF EXISTS own_seats             ON seat_assignment;
CREATE POLICY staff_all_assignments ON asset_assignment FOR ALL TO ll_admin, ll_it_staff USING (true) WITH CHECK (true);
CREATE POLICY staff_all_seats       ON seat_assignment  FOR ALL TO ll_admin, ll_it_staff USING (true) WITH CHECK (true);
CREATE POLICY staff_all_employees   ON employee         FOR ALL TO ll_admin, ll_it_staff USING (true) WITH CHECK (true);
CREATE POLICY own_employee_row ON employee FOR SELECT TO ll_employee
  USING (employee_id = NULLIF(current_setting('app.employee_id', true), '')::INT);
CREATE POLICY own_assignments ON asset_assignment FOR SELECT TO ll_employee
  USING (employee_id = NULLIF(current_setting('app.employee_id', true), '')::INT);
CREATE POLICY own_seats ON seat_assignment FOR SELECT TO ll_employee
  USING (employee_id = NULLIF(current_setting('app.employee_id', true), '')::INT);

-- ---------------- Functions ----------------
-- The audit trigger must write audit_log whichever role made the change.
ALTER FUNCTION audit_trigger_fn() SECURITY DEFINER SET search_path = public;

-- By default every role may run every function. Lock that down: admin runs all,
-- IT staff only the seat functions, employees none (trigger functions are left alone).
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname AS name
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM ll_it_staff, ll_employee', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ll_admin', f.sig);
    IF f.name IN ('assign_seat', 'revoke_seat', 'release_all_seats') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ll_it_staff', f.sig);
      -- IT staff may not update subscriptions directly, but assign_seat has to lock the subscription row.
      -- So these three functions run with their owner's rights (a controlled privilege step-up);
      -- only admin and IT staff can execute them, and search_path is pinned for safety.
      EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public', f.sig);
    END IF;
  END LOOP;
END $$;
