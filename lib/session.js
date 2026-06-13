// lib/session.js
// Émission / lecture du JWT de session Justalk, stocké en cookie httpOnly.
// Nécessite JWT_SECRET dans les variables d'environnement.
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const COOKIE_NAME = "justalk_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours — reconnexion auto par biométrie

export async function createSessionToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
