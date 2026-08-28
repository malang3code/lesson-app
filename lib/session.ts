import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export type SessionRole = 'viewer' | 'admin';

export async function createSessionToken(role: SessionRole) {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { role: SessionRole };
  } catch {
    return null;
  }
}