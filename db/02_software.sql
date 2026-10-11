-- Person B: software & spend, written against db/01_schema.sql. Safe to re-run.
BEGIN;

-- ---------- Extra constraints and indexes (01_schema.sql already has the core CHECKs) ----------
ALTER TABLE software_subscription DROP CONSTRAINT IF EXISTS chk_sub_name_not_blank;
ALTER TABLE software_subscription ADD  CONSTRAINT chk_sub_name_not_blank CHECK (length(trim(name)) > 0);
ALTER TABLE vendor DROP CONSTRAINT IF EXISTS chk_vendor_email;
ALTER TABLE vendor ADD  CONSTRAINT chk_vendor_email CHECK (contact_email IS NULL OR contact_email LIKE '%_@_%.__%');

CREATE INDEX IF NOT EXISTS idx_seat_employee_active     ON seat_assignment (employee_id)     WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seat_subscription_active ON seat_assignment (subscription_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sub_renewal              ON software_subscription (renewal_date);

-- ---------- Full-text search ----------
ALTER TABLE software_subscription ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(plan,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_sub_search ON software_subscription USING GIN (search_vector);
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_vendor_search ON vendor USING GIN (search_vector);

-- ---------- Stored functions ----------
-- Lock the subscription row, count active seats, then insert: two admins cannot oversell.
CREATE OR REPLACE FUNCTION assign_seat(p_subscription_id INTEGER, p_employee_id INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_limit INTEGER; v_status TEXT; v_used INTEGER; v_emp_status TEXT; v_id INTEGER;
BEGIN
  SELECT seat_limit, status INTO v_limit, v_status
    FROM software_subscription WHERE subscription_id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription % not found', p_subscription_id; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Subscription % is % and cannot take new seats', p_subscription_id, v_status; END IF;

  SELECT status INTO v_emp_status FROM employee WHERE employee_id = p_employee_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee % not found', p_employee_id; END IF;
  IF v_emp_status <> 'active' THEN RAISE EXCEPTION 'Employee % is % and cannot be given a seat', p_employee_id, v_emp_status; END IF;

  SELECT count(*) INTO v_used FROM seat_assignment
    WHERE subscription_id = p_subscription_id AND revoked_at IS NULL;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'No seats available: % of % in use', v_used, v_limit;
  END IF;

  INSERT INTO seat_assignment (subscription_id, employee_id, assigned_at)
    VALUES (p_subscription_id, p_employee_id, now()) RETURNING seat_id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Employee % already holds an active seat on subscription %', p_employee_id, p_subscription_id;
END $$;

CREATE OR REPLACE FUNCTION revoke_seat(p_seat_id INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE seat_assignment SET revoked_at = now() WHERE seat_id = p_seat_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active seat % not found', p_seat_id; END IF;
END $$;

-- Called by Person A inside the offboarding transaction.
CREATE OR REPLACE FUNCTION release_all_seats(p_employee_id INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
  WITH r AS (UPDATE seat_assignment SET revoked_at = now()
              WHERE employee_id = p_employee_id AND revoked_at IS NULL RETURNING 1)
  SELECT count(*) INTO n FROM r;
  RETURN n;
END $$;

-- Records the renewal that just happened (old date, amount) and moves the subscription to its next date, atomically.
CREATE OR REPLACE FUNCTION renew_subscription(p_subscription_id INTEGER, p_new_date DATE, p_amount NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_old DATE; v_status TEXT; v_id INTEGER;
BEGIN
  SELECT renewal_date, status INTO v_old, v_status
    FROM software_subscription WHERE subscription_id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription % not found', p_subscription_id; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Subscription % is % and cannot be renewed', p_subscription_id, v_status; END IF;
  IF p_new_date <= v_old THEN RAISE EXCEPTION 'New renewal date must be after the current date %', v_old; END IF;
  INSERT INTO renewal (subscription_id, renewal_date, amount, status)
    VALUES (p_subscription_id, v_old, p_amount, 'renewed') RETURNING renewal_id INTO v_id;
  UPDATE software_subscription SET renewal_date = p_new_date WHERE subscription_id = p_subscription_id;
  RETURN v_id;
END $$;

-- ---------- Views (aliases keep the API/UI names: product_name, seats_total) ----------
DROP VIEW IF EXISTS v_renewal_forecast;
DROP VIEW IF EXISTS v_departed_seats;
DROP VIEW IF EXISTS v_subscription_utilization;

CREATE VIEW v_subscription_utilization AS
SELECT s.subscription_id, s.name AS product_name, s.plan, v.name AS vendor_name, d.name AS department_name,
       s.seat_limit AS seats_total, count(sa.seat_id)::int AS seats_used,
       (s.seat_limit - count(sa.seat_id))::int AS seats_unused,
       s.cost_per_seat, s.billing_cycle, s.renewal_date, s.status,
       (s.seat_limit - count(sa.seat_id)) * s.cost_per_seat AS wasted_per_cycle,
       s.seat_limit * s.cost_per_seat AS cost_per_cycle
FROM software_subscription s
JOIN vendor v ON v.vendor_id = s.vendor_id
LEFT JOIN department d ON d.department_id = s.department_id
LEFT JOIN seat_assignment sa ON sa.subscription_id = s.subscription_id AND sa.revoked_at IS NULL
GROUP BY s.subscription_id, v.name, d.name;

CREATE VIEW v_renewal_forecast AS
SELECT u.*, (u.renewal_date - current_date) AS days_until
FROM v_subscription_utilization u
WHERE u.status = 'active' AND u.renewal_date >= current_date;

CREATE VIEW v_departed_seats AS
SELECT sa.seat_id AS seat_assignment_id, s.subscription_id, s.name AS product_name, e.employee_id, e.full_name,
       e.status AS employee_status, s.cost_per_seat, s.billing_cycle
FROM seat_assignment sa
JOIN employee e ON e.employee_id = sa.employee_id
JOIN software_subscription s ON s.subscription_id = sa.subscription_id
WHERE sa.revoked_at IS NULL AND e.status <> 'active';

COMMIT;
