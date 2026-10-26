import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/api';
import { ownerQuery as query } from '@/lib/db'; // nobody is logged in yet, so no role to switch to
import { COOKIE, TOKEN_TTL_SECONDS, signToken } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { validate } from '@/lib/validate';

// constant-time-ish: always run a bcrypt compare even when the user does not exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const POST = handle(async (req) => {
  const { username, password } = validate(await readJson(req), {
    username: { type: 'string', required: true, max: 50 },
    password: { type: 'string', required: true, max: 200 },
  });
  const { rows } = await query(
    `SELECT u.user_id, u.employee_id, u.username, u.password_hash, u.role, u.is_active, e.status AS employee_status
       FROM app_user u JOIN employee e USING (employee_id) WHERE u.username = $1`, [username]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok || !u.is_active || u.employee_status !== 'active') {
    throw new ApiError(401, 'BAD_CREDENTIALS', 'Invalid username or password');
  }
  await query('UPDATE app_user SET last_login_at = now() WHERE user_id = $1', [u.user_id]);
  const token = await signToken({ sub: String(u.user_id), employee_id: u.employee_id, username: u.username, role: u.role });
  const res = NextResponse.json({ user: { id: u.user_id, username: u.username, role: u.role } });
  res.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TOKEN_TTL_SECONDS,
  });
  return res;
});
