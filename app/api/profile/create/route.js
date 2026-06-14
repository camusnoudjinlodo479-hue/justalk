// app/api/profile/create/route.js
// Finalise l'inscription : enregistre le pseudo définitif, le schéma de
// secours (haché) et upload la photo de profil vers Firebase Storage.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req) {

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload?.uid) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const form = await req.formData();
  const pseudo = form.get("pseudo");
  const firstName = form.get("firstName");
  const lastName = form.get("lastName");
  const birthdate = form.get("birthdate");
  const pattern = form.get("pattern");
  const avatar = form.get("avatar");

  const update = {};
  if (pseudo) update.pseudo = pseudo;
  if (firstName) update.firstName = firstName;
  if (lastName) update.lastName = lastName;
  if (birthdate) update.birthdate = birthdate;
  if (firstName || lastName) update.displayName = `${firstName || ""} ${lastName || ""}`.trim();

  if (pattern) {
    const parsed = JSON.parse(pattern);
    if (parsed) {
      update.patternHash = crypto.createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
    }
  }

  if (avatar && typeof avatar !== "string") {
    try {
      const bucket = adminStorage.bucket();
      const filePath = `avatars/${payload.uid}-${Date.now()}`;
      const buffer = Buffer.from(await avatar.arrayBuffer());
      const file = bucket.file(filePath);
      await file.save(buffer, { contentType: avatar.type });
      await file.makePublic();
      update.avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (storageError) {
      console.error("Erreur critique Firebase Storage lors de la création de l'avatar (on continue sans avatar) :", storageError);
    }
  }

  await adminDb.collection("users").doc(payload.uid).update(update);
  return NextResponse.json({ ok: true, ...update });
}

export const dynamic = 'force-dynamic'