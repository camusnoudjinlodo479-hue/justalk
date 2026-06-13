// app/api/webauthn/login-options/route.js
// Génère le challenge d'authentification WebAuthn pour la reconnexion
// biométrique (Face ID / Windows Hello / Touch ID), sans demander d'identifiant.
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function POST(req) {
  const host = req.headers.get("host") || "localhost:3000";
  const rpID = process.env.WEBAUTHN_RP_ID || host.split(":")[0];

  const options = await generateAuthenticationOptions({
    rpID: rpID,
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
