// middleware.js
// Protège les pages applicatives : redirige vers "/" si aucun cookie de
// session n'est présent (le contrôle de validité fin se fait via
// /api/session/check côté client pour permettre la reconnexion biométrique).
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const PROTECTED = ["/feed", "/profil", "/messenger", "/stories", "/groupes", "/notifications"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasSession = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/feed/:path*", "/profil/:path*", "/messenger/:path*", "/stories/:path*", "/groupes/:path*", "/notifications/:path*"],
};
