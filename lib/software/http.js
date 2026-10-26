import { NextResponse } from 'next/server';

export const ok = (data, status = 200) => NextResponse.json(data, { status });
export const httpError = (status, message) => Object.assign(new Error(message), { status });

const PG_STATUS = { '42501': 403, P0001: 409, '23505': 409, '23503': 400, '23514': 400, '22P02': 400, '23502': 400, '22007': 400, 121: 400 };

export function fail(err) {
  const status = err.status ?? (err instanceof SyntaxError ? 400 : PG_STATUS[err.code]) ?? 500;
  if (status === 500) console.error(err);
  const message = err.code === '42501' ? 'The database refused this action for your role' : err.message;
  return NextResponse.json({ error: status === 500 ? 'Internal server error' : message }, { status });
}

export function num(v, name, { min = -Infinity, int = false } = {}) {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n) || (int && !Number.isInteger(n)) || n < min)
    throw httpError(400, `${name} is invalid`);
  return n;
}
export function optInt(v, name) {
  return v === undefined || v === null || v === '' ? null : num(v, name, { int: true, min: 1 });
}
export function str(v, name, { max = 200, required = true } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s && required) throw httpError(400, `${name} is required`);
  if (s.length > max) throw httpError(400, `${name} is too long`);
  return s || null;
}
export function date(v, name) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))
    throw httpError(400, `${name} must be YYYY-MM-DD`);
  return v;
}
export function tsQuery(q) {
  const words = String(q ?? '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  return words.length ? words.map(w => w + ':*').join(' & ') : null;
}
