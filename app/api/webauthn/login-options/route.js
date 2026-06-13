// app/api/webauthn/login-options/route.js
// Génère le challenge d'authentification WebAuthn pour la reconnexion
// biométrique (Face ID / Windows Hello / Touch ID), sans demander d'identifiant.
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";

export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    // allowCredentials vide -> le navigateur propose tous les passkeys Justalk
    // disponibles sur l'appareil (discoverable credentials).
  });

  const res = NextResponse.json(options);
  res.cookies.set("justalk_login_challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
  return res;
}

export const dynamic = "force-dynamic";
