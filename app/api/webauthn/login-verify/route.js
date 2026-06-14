// app/api/webauthn/login-verify/route.js
// Vérifie l'assertion WebAuthn renvoyée par le navigateur, retrouve
// l'utilisateur via le credentialID, met à jour le compteur anti-replay
// et pose le cookie de session JWT httpOnly.
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(req) {
  const host = req.headers.get("host") || "localhost:3000";
  const isLocalRequest = host.includes("localhost") || host.includes("127.0.0.1");
  
  let rpID = process.env.WEBAUTHN_RP_ID;
  if (!rpID || (rpID === "localhost" && !isLocalRequest)) {
    rpID = host.split(":")[0];
  }
  
  let origin = process.env.WEBAUTHN_ORIGIN;
  if (!origin || (origin.includes("localhost") && !isLocalRequest)) {
    origin = isLocalRequest ? `http://${host}` : `https://${host}`;
  }

  const { assertion } = await req.json();
  const challenge = req.cookies.get("justalk_login_challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expiré." }, { status: 400 });
  }

  const credentialID = assertion.id; // base64url
  const supabaseAdmin = createSupabaseAdmin();

  // Recherche l'utilisateur ayant le credentialID dans le tableau JSONB authenticators
  const { data: matchedUsers, error: usersError } = await supabaseAdmin
    .from("users")
    .select("*")
    .filter("authenticators", "cs", JSON.stringify([{ credentialID }]));

  if (usersError || !matchedUsers || matchedUsers.length === 0) {
    return NextResponse.json({ error: "Aucun compte associé à cette empreinte." }, { status: 404 });
  }

  const dbUser = matchedUsers[0];
  const authenticator = dbUser.authenticators.find((a) => a.credentialID === credentialID);

  if (!authenticator) {
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
  const auths = dbUser.authenticators.map((a) =>
    a.credentialID === authenticator.credentialID
      ? { ...a, counter: verification.authenticationInfo.newCounter }
      : a
  );
  
  await supabaseAdmin
    .from("users")
    .update({ authenticators: auths })
    .eq("id", dbUser.id);

  const token = await createSessionToken({ uid: dbUser.id, pseudo: dbUser.pseudo });
  const res = NextResponse.json({ uid: dbUser.id });
  res.cookies.set(sessionCookieOptions().name, token, sessionCookieOptions());
  res.cookies.delete("justalk_login_challenge");
  return res;
}

export const dynamic = "force-dynamic";
