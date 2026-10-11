import { ApiError } from './errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// schema: { field: { type: 'string'|'int'|'number'|'email'|'date'|'enum', required, min, max, values } }
// Returns only the validated fields that were provided. Throws ApiError(400) listing every problem.
export function validate(body, schema) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION', 'Request body must be a JSON object');
  }
  const out = {};
  const details = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body[key];
    if (typeof v === 'string') v = v.trim();
    if (v === undefined || v === null || v === '') {
      if (rule.required) details[key] = 'is required';
      continue;
    }
    switch (rule.type) {
      case 'string':
      case 'email': {
        if (typeof v !== 'string') { details[key] = 'must be text'; break; }
        const max = rule.max ?? 255;
        if (v.length > max) { details[key] = `must be at most ${max} characters`; break; }
        if (rule.min && v.length < rule.min) { details[key] = `must be at least ${rule.min} characters`; break; }
        if (rule.type === 'email' && !EMAIL_RE.test(v)) { details[key] = 'must be a valid email'; break; }
        out[key] = rule.type === 'email' ? v.toLowerCase() : v;
        break;
      }
      case 'int':
      case 'number': {
        const n = typeof v === 'number' ? v : (/^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v) : NaN);
        if (!Number.isFinite(n)) { details[key] = 'must be a number'; break; }
        if (rule.type === 'int' && !Number.isInteger(n)) { details[key] = 'must be a whole number'; break; }
        if (rule.min !== undefined && n < rule.min) { details[key] = `must be at least ${rule.min}`; break; }
        if (rule.max !== undefined && n > rule.max) { details[key] = `must be at most ${rule.max}`; break; }
        out[key] = n;
        break;
      }
      case 'date': {
        const d = new Date(v + 'T00:00:00Z');
        if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
          details[key] = 'must be a real date in YYYY-MM-DD format';
          break;
        }
        out[key] = v;
        break;
      }
      case 'enum': {
        if (!rule.values.includes(v)) { details[key] = `must be one of: ${rule.values.join(', ')}`; break; }
        out[key] = v;
        break;
      }
      default:
        throw new Error(`Unknown rule type ${rule.type}`);
    }
  }
  if (Object.keys(details).length) throw new ApiError(400, 'VALIDATION', 'Invalid input', details);
  return out;
}

export function parseId(value, name = 'id') {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 2147483647) {
    throw new ApiError(400, 'VALIDATION', `${name} must be a positive integer`);
  }
  return Number(value);
}

export function parsePaging(searchParams, defaultLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10) || defaultLimit));
  return { limit, offset: (page - 1) * limit, page };
}
