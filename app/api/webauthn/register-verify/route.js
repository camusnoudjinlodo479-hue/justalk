// app/api/webauthn/register-verify/route.js
// Vérifie la réponse WebAuthn (attestation), crée l'utilisateur Firestore et
// enregistre l'empreinte faciale chiffrée (faceHash) pour l'anti-doublon.
// Pose le cookie de session JWT httpOnly à la fin.
import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export async function POST(req) {
  const { pseudo, faceHash, attestation } = await req.json();

  const cookieRaw = req.cookies.get("justalk_reg_challenge")?.value;
  if (!cookieRaw) {
    return NextResponse.json({ error: "Challenge expiré, recommence le scan." }, { status: 400 });
  }
  const { challenge, userID } = JSON.parse(cookieRaw);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (e) {
    return NextResponse.json({ error: "Vérification WebAuthn invalide." }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Échec de la vérification biométrique." }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const uid = userID;

  // 1. Crée le document utilisateur
  await adminDb.collection("users").doc(uid).set({
    pseudo,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    authenticators: [
      {
        credentialID: Buffer.from(credentialID).toString("base64url"),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64url"),
        counter,
      },
    ],
  });

  // 2. Enregistre le hash facial chiffré côté serveur (anti-doublon optionnel,
  // si face-api.js est utilisé) — jamais la photo, jamais le vecteur brut.
  if (faceHash) {
    await adminDb.collection("biometricHashes").doc(uid).set({
      faceHash,
      uid,
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Session JWT httpOnly -> reconnexion automatique
  const token = await createSessionToken({ uid, pseudo });
  const res = NextResponse.json({ uid, token: "set-via-cookie" });
  res.cookies.set(sessionCookieOptions().name, token, sessionCookieOptions());
  res.cookies.delete("justalk_reg_challenge");
  return res;
}

export const dynamic = "force-dynamic";
