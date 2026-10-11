-- Person A: audit triggers, asset assignment triggers, views, release_all_seats stub

-- ---------- 1. Generic audit trigger ----------
-- The app sets  SELECT set_config('app.user_id', '<id>', true)  at the start of each
-- transaction, so changed_by is filled automatically. No setting => NULL (system action).
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_old  JSONB;
  v_new  JSONB;
  v_user INT;
BEGIN
  v_user := NULLIF(current_setting('app.user_id', true), '')::INT;
  IF TG_OP IN ('UPDATE','DELETE') THEN v_old := to_jsonb(OLD) - 'password_hash'; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN v_new := to_jsonb(NEW) - 'password_hash'; END IF;

  -- skip no-op updates (and password-only changes)
  IF TG_OP = 'UPDATE' AND v_old = v_new THEN RETURN NEW; END IF;

  INSERT INTO audit_log(table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, COALESCE(v_new, v_old) ->> TG_ARGV[0], TG_OP, v_old, v_new, v_user);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_employee           AFTER INSERT OR UPDATE OR DELETE ON employee
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('employee_id');
CREATE TRIGGER trg_audit_hardware_asset     AFTER INSERT OR UPDATE OR DELETE ON hardware_asset
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('asset_id');
CREATE TRIGGER trg_audit_asset_assignment   AFTER INSERT OR UPDATE OR DELETE ON asset_assignment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('assignment_id');
CREATE TRIGGER trg_audit_department_budget  AFTER INSERT OR UPDATE OR DELETE ON department_budget
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('budget_id');
CREATE TRIGGER trg_audit_app_user           AFTER INSERT OR UPDATE OR DELETE ON app_user
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('user_id');
CREATE TRIGGER trg_audit_seat_assignment    AFTER INSERT OR UPDATE OR DELETE ON seat_assignment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('seat_id');

-- ---------- 2. Asset assignment rules ----------
-- BEFORE INSERT: lock the asset row, require it to be 'available', employee must be active.
CREATE OR REPLACE FUNCTION asset_assignment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_asset_status TEXT;
  v_emp_status   TEXT;
BEGIN
  SELECT status INTO v_asset_status FROM hardware_asset WHERE asset_id = NEW.asset_id FOR UPDATE;
  IF v_asset_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'Asset % is not available (status: %)', NEW.asset_id, COALESCE(v_asset_status,'missing');
  END IF;
  SELECT status INTO v_emp_status FROM employee WHERE employee_id = NEW.employee_id;
  IF v_emp_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Employee % is not active (status: %)', NEW.employee_id, COALESCE(v_emp_status,'missing');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_asset_assignment_guard BEFORE INSERT ON asset_assignment
  FOR EACH ROW EXECUTE FUNCTION asset_assignment_guard();

-- AFTER INSERT / return: keep hardware_asset.status in sync automatically.
CREATE OR REPLACE FUNCTION asset_assignment_sync_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hardware_asset SET status = 'assigned' WHERE asset_id = NEW.asset_id;
  ELSIF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE hardware_asset SET status = 'available'
     WHERE asset_id = NEW.asset_id AND status = 'assigned';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_asset_assignment_sync AFTER INSERT OR UPDATE OF returned_at ON asset_assignment
  FOR EACH ROW EXECUTE FUNCTION asset_assignment_sync_status();

-- ---------- 3. Cross-over with Person B ----------
-- STUB. Person B replaces this with CREATE OR REPLACE FUNCTION release_all_seats(...)
-- keeping the same signature (employee_id in, number of revoked seats out).
CREATE OR REPLACE FUNCTION release_all_seats(p_employee_id INT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  UPDATE seat_assignment SET revoked_at = now()
   WHERE employee_id = p_employee_id AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------- 4. Views (inventory + reporting) ----------
CREATE OR REPLACE VIEW v_hardware_inventory AS
SELECT h.asset_id, h.asset_tag, h.type, h.make_model, h.serial_number,
       h.purchase_date, h.purchase_cost, h.status,
       a.assignment_id, a.employee_id, e.full_name AS assigned_to, a.assigned_at
FROM hardware_asset h
LEFT JOIN asset_assignment a ON a.asset_id = h.asset_id AND a.returned_at IS NULL
LEFT JOIN employee e         ON e.employee_id = a.employee_id;

-- multi-table JOIN + GROUP BY: hardware in use per department
CREATE OR REPLACE VIEW v_department_hardware_summary AS
SELECT d.department_id, d.name AS department,
       count(a.assignment_id)::INT            AS assets_in_use,
       COALESCE(sum(h.purchase_cost), 0)      AS hardware_value
FROM department d
LEFT JOIN employee e         ON e.department_id = d.department_id
LEFT JOIN asset_assignment a ON a.employee_id = e.employee_id AND a.returned_at IS NULL
LEFT JOIN hardware_asset h   ON h.asset_id = a.asset_id
GROUP BY d.department_id, d.name;
