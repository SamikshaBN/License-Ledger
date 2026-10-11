import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'll_token';
export const TOKEN_TTL_SECONDS = 8 * 60 * 60;

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET missing or too short (set it in .env)');
  return new TextEncoder().encode(s);
};

// payload: { sub: String(user_id), employee_id, username, role }
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}
