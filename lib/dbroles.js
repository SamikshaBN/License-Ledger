// application role -> PostgreSQL role (created by db/roles/roles.sql)
export const DB_ROLE = { admin: 'll_admin', it_staff: 'll_it_staff', employee: 'll_employee' };

// The three roles are real PostgreSQL logins. Their password comes from .env (LL_ROLE_PASSWORD);
// `npm run db:roles` sets it on the roles, the app uses it to open one connection pool per role.
export const rolePassword = () => process.env.LL_ROLE_PASSWORD || 'll_dev_password';
export function roleUrl(dbRole) {
  const u = new URL(process.env.DATABASE_URL);
  u.username = dbRole;
  u.password = rolePassword();
  return u.toString();
}

// pages each application role can open (mirrors the menu in components/Nav.js)
export const PAGES = {
  admin: ['Overview', 'Employees', 'Departments & budgets', 'Hardware', 'Offboarding', 'Software & spend', 'Audit log', 'Users', 'My assets', 'My software', 'Roles & permissions'],
  it_staff: ['Overview', 'Employees', 'Departments & budgets', 'Hardware', 'Offboarding', 'Software & spend', 'My assets', 'My software', 'Roles & permissions'],
  employee: ['My assets', 'My software', 'Roles & permissions'],
};
