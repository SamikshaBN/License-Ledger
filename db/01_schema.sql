-- LicenseLedger schema v1 (shared by Person A and Person B). Freeze after Day 2.
-- Person A tables: department, department_budget, employee, app_user,
--                  hardware_asset, asset_assignment, audit_log
-- Person B tables: vendor, software_subscription, seat_assignment, renewal

CREATE TABLE department (
  department_id SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE
);

CREATE TABLE department_budget (
  budget_id       SERIAL PRIMARY KEY,
  department_id   INT NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  fiscal_year     INT NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
  hardware_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hardware_budget >= 0),
  software_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (software_budget >= 0),
  UNIQUE (department_id, fiscal_year)
);

CREATE TABLE employee (
  employee_id   SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  email         TEXT NOT NULL UNIQUE,
  department_id INT REFERENCES department(department_id) ON DELETE SET NULL,
  job_title     TEXT,
  hire_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','offboarded')),
  offboarded_at TIMESTAMPTZ,
  CHECK ((status = 'offboarded') = (offboarded_at IS NOT NULL))
);
CREATE INDEX idx_employee_department ON employee(department_id);

-- "USER" is a reserved word in Postgres, so the table is app_user.
CREATE TABLE app_user (
  user_id       SERIAL PRIMARY KEY,
  employee_id   INT NOT NULL UNIQUE REFERENCES employee(employee_id) ON DELETE RESTRICT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','it_staff','employee')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE hardware_asset (
  asset_id      SERIAL PRIMARY KEY,
  asset_tag     TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL CHECK (type IN ('laptop','monitor','phone','tablet','peripheral','other')),
  make_model    TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  purchase_date DATE,
  purchase_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  status        TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','assigned','repair','retired'))
);

CREATE TABLE asset_assignment (
  assignment_id SERIAL PRIMARY KEY,
  asset_id      INT NOT NULL REFERENCES hardware_asset(asset_id),
  employee_id   INT NOT NULL REFERENCES employee(employee_id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at   TIMESTAMPTZ,
  assigned_by   INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  CHECK (returned_at IS NULL OR returned_at >= assigned_at)
);
-- one asset can have only ONE open assignment
CREATE UNIQUE INDEX uq_asset_one_open_assignment
  ON asset_assignment(asset_id) WHERE returned_at IS NULL;
CREATE INDEX idx_assignment_employee_open
  ON asset_assignment(employee_id) WHERE returned_at IS NULL;

CREATE TABLE audit_log (
  log_id     BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data   JSONB,
  new_data   JSONB,
  changed_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,  -- NULL = system action
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_table_time ON audit_log(table_name, changed_at DESC);

-- ---------------- Person B tables (defined here so schema is frozen once) ----------------
CREATE TABLE vendor (
  vendor_id     SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  website       TEXT,
  contact_email TEXT
);

CREATE TABLE software_subscription (
  subscription_id SERIAL PRIMARY KEY,
  vendor_id       INT NOT NULL REFERENCES vendor(vendor_id),
  name            TEXT NOT NULL,
  plan            TEXT,
  seat_limit      INT NOT NULL CHECK (seat_limit > 0),
  cost_per_seat   NUMERIC(12,2) NOT NULL CHECK (cost_per_seat >= 0),
  billing_cycle   TEXT NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  renewal_date    DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  department_id   INT REFERENCES department(department_id) ON DELETE SET NULL
);

CREATE TABLE seat_assignment (
  seat_id         SERIAL PRIMARY KEY,
  subscription_id INT NOT NULL REFERENCES software_subscription(subscription_id),
  employee_id     INT NOT NULL REFERENCES employee(employee_id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);
CREATE UNIQUE INDEX uq_one_active_seat_per_employee
  ON seat_assignment(subscription_id, employee_id) WHERE revoked_at IS NULL;

CREATE TABLE renewal (
  renewal_id      SERIAL PRIMARY KEY,
  subscription_id INT NOT NULL REFERENCES software_subscription(subscription_id) ON DELETE CASCADE,
  renewal_date    DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status          TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','renewed','cancelled'))
);
