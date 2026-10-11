import { ApiError } from './errors.js';

// Keys must come from validate() output (whitelisted), never directly from the request body.
export function buildUpdate(data, table, idCol, id) {
  const keys = Object.keys(data);
  if (!keys.length) throw new ApiError(400, 'VALIDATION', 'Nothing to update');
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  return {
    text: `UPDATE ${table} SET ${sets} WHERE ${idCol} = $${keys.length + 1} RETURNING *`,
    values: [...keys.map((k) => data[k]), id],
  };
}
