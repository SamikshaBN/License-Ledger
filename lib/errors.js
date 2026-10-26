// No framework imports here so it can be unit-tested with plain node.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Map Postgres errors to clean API errors (JSON error format agreed on Day 0)
export function toApiError(e) {
  if (e instanceof ApiError) return e;
  switch (e?.code) {
    case '23505': return new ApiError(409, 'DUPLICATE', 'A record with these values already exists', { constraint: e.constraint });
    case '23503': return new ApiError(409, 'REFERENCE', 'Referenced record is missing or still in use', { constraint: e.constraint });
    case '23514': return new ApiError(400, 'CONSTRAINT', 'Value violates a database rule', { constraint: e.constraint });
    case '23502': return new ApiError(400, 'VALIDATION', `Missing value for ${e.column}`);
    case '42501': return new ApiError(403, 'DB_FORBIDDEN', 'The database refused this action for your role'); // PostgreSQL privilege check
    case '22P02': return new ApiError(400, 'VALIDATION', 'Invalid input format');
    case 'P0001': return new ApiError(409, 'RULE_VIOLATION', e.message); // RAISE EXCEPTION in triggers/functions
  }
  console.error(e);
  return new ApiError(500, 'INTERNAL', 'Unexpected server error');
}

export function errorBody(err) {
  const body = { error: { code: err.code, message: err.message } };
  if (err.details) body.error.details = err.details;
  return body;
}
