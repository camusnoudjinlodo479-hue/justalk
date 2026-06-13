// app/api/webauthn/login-verify/route.js
// Vérifie l'assertion WebAuthn renvoyée par le navigateur, retrouve
// l'utilisateur via le credentialID, met à jour le compteur anti-replay
// et pose le cookie de session JWT httpOnly.
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(req) {
  const host = req.headers.get("host") || "localhost:3000";
  const rpID = process.env.WEBAUTHN_RP_ID || host.split(":")[0];
  const origin = process.env.WEBAUTHN_ORIGIN || (host.includes("localhost") || host.includes("127.0.0.1") ? `http://${host}` : `https://${host}`);

  const { assertion } = await req.json();
  const challenge = req.cookies.get("justalk_login_challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expiré." }, { status: 400 });
  }

  const credentialID = assertion.id; // base64url
  const usersRef = adminDb.collection("users");
  const snap = await usersRef
    .where("authenticators", "!=", null)
    .get();

  let userDoc = null;
  let authenticator = null;
  snap.forEach((doc) => {
    const auths = doc.data().authenticators || [];
    const match = auths.find((a) => a.credentialID === credentialID);
    if (match) {
      userDoc = doc;
      authenticator = match;
    }
  });

  if (!userDoc || !authenticator) {
    return NextResponse.json({ error: "Aucun compte associé à cette empreinte." }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, "base64url"),
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, "base64url"),
        counter: authenticator.counter,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Authentification invalide." }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Échec de l'authentification." }, { status: 401 });
  }

  // Met à jour le compteur anti-replay
  const auths = userDoc.data().authenticators.map((a) =>
    a.credentialID === authenticator.credentialID
      ? { ...a, counter: verification.authenticationInfo.newCounter }
      : a
  );
  await userDoc.ref.update({ authenticators: auths });

  const token = await createSessionToken({ uid: userDoc.id, pseudo: userDoc.data().pseudo });
  const res = NextResponse.json({ uid: userDoc.id });
  res.cookies.set(sessionCookieOptions().name, token, sessionCookieOptions());
  res.cookies.delete("justalk_login_challenge");
  return res;
}

export const dynamic = "force-dynamic";
