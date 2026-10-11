import { cookies } from 'next/headers';
import { COOKIE, verifyToken } from '@/lib/auth';
import { httpError } from './http';

// Throws 401/403 (turned into JSON by fail()) unless the caller's JWT has one of the roles.
export async function requireRole(...roles) {
  const token = (await cookies()).get(COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) throw httpError(401, 'Please log in');
  if (!roles.includes(payload.role)) throw httpError(403, 'You do not have permission for this action');
  return payload;
}
