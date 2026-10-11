import { NextResponse } from 'next/server';
import { COOKIE, verifyToken } from './auth.js';
import { ApiError, errorBody, toApiError } from './errors.js';

export const json = (data, status = 200) => NextResponse.json(data, { status });

export function errorResponse(e) {
  const err = toApiError(e);
  return NextResponse.json(errorBody(err), { status: err.status });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'VALIDATION', 'Request body must be valid JSON');
  }
}

// Auth helper signature (shared with Person B):
//   export const GET = withAuth(['admin','it_staff'], async (req, ctx, user) => json({...}));
//   roles = null/[] means "any logged-in user".
//   user = { id, employee_id, username, role }
export function withAuth(roles, handler) {
  return async (req, ctx) => {
    try {
      const token = req.cookies.get(COOKIE)?.value;
      const payload = token ? await verifyToken(token) : null;
      if (!payload) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
      if (roles?.length && !roles.includes(payload.role)) {
        throw new ApiError(403, 'FORBIDDEN', 'Your role is not allowed to do this');
      }
      const user = { id: Number(payload.sub), employee_id: payload.employee_id, username: payload.username, role: payload.role };
      return await handler(req, ctx, user);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// For routes that need no login (login itself)
export function handle(handler) {
  return async (req, ctx) => {
    try { return await handler(req, ctx); } catch (e) { return errorResponse(e); }
  };
}
