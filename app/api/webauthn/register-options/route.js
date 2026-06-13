// app/api/webauthn/register-options/route.js
// Génère les options d'enregistrement WebAuthn (challenge) pour l'inscription
// biométrique. Vérifie aussi l'anti-doublon via faceHash avant de continuer.
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { adminDb } from "@/lib/firebaseAdmin";

const RP_NAME = "Justalk";

export async function POST(req) {
  const host = req.headers.get("host") || "localhost:3000";
  const rpID = process.env.WEBAUTHN_RP_ID || host.split(":")[0];
  const { pseudo, faceHash } = await req.json();

  // Anti-doublon facial (optionnel) : seulement si un faceHash est fourni
  // (face-api.js). Sans caméra, on s'appuie sur l'unicité du passkey WebAuthn.
  if (faceHash) {
    try {
      const dup = await adminDb
        .collection("biometricHashes")
        .where("faceHash", "==", faceHash)
        .limit(1)
        .get();
      if (!dup.empty) {
        return NextResponse.json(
          { error: "Ce visage est déjà associé à un compte Justalk." },
          { status: 409 }
        );
      }
    } catch (e) {
      console.warn("Vérification anti-doublon ignorée (Firebase non configuré):", e.message);
    }
  }

  const userID = crypto.randomUUID();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID,
    userName: pseudo || `user-${userID.slice(0, 8)}`,
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Face ID / Windows Hello / Touch ID
      userVerification: "required",
      residentKey: "preferred",
    },
  });

  const res = NextResponse.json(options);
  // Le challenge + userID temporaire sont stockés dans un cookie httpOnly de
  // courte durée, lus par /register-verify pour finaliser l'inscription.
  res.cookies.set("justalk_reg_challenge", JSON.stringify({ challenge: options.challenge, userID, pseudo, faceHash }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
  return res;
}

export const dynamic = "force-dynamic";
