// app/api/profile/update/route.js
// Permet à l'utilisateur connecté de modifier son profil (à la WhatsApp) :
// pseudo, nom/prénom, bio, visibilité de la date de naissance, photo et cover.
import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

const EDITABLE_TEXT_FIELDS = ["pseudo", "firstName", "lastName", "bio"];

export async function POST(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload?.uid) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const form = await req.formData();
  const update = {};

  for (const field of EDITABLE_TEXT_FIELDS) {
    const value = form.get(field);
    if (value !== null) update[field] = value.toString().trim();
  }

  if (update.firstName || update.lastName) {
    const current = (await adminDb.collection("users").doc(payload.uid).get()).data() || {};
    update.displayName = `${update.firstName ?? current.firstName ?? ""} ${
      update.lastName ?? current.lastName ?? ""
    }`.trim();
  }

  // Visibilité de la date de naissance : "private" (défaut) ou "public"
  const birthdateVisibility = form.get("birthdateVisibility");
  if (birthdateVisibility) update.birthdateVisibility = birthdateVisibility;

  const bucket = adminStorage.bucket();

  const avatar = form.get("avatar");
  if (avatar && typeof avatar !== "string") {
    const filePath = `avatars/${payload.uid}-${Date.now()}`;
    const buffer = Buffer.from(await avatar.arrayBuffer());
    const file = bucket.file(filePath);
    await file.save(buffer, { contentType: avatar.type });
    await file.makePublic();
    update.avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  }

  const cover = form.get("cover");
  if (cover && typeof cover !== "string") {
    const filePath = `covers/${payload.uid}-${Date.now()}`;
    const buffer = Buffer.from(await cover.arrayBuffer());
    const file = bucket.file(filePath);
    await file.save(buffer, { contentType: cover.type });
    await file.makePublic();
    update.coverUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  await adminDb.collection("users").doc(payload.uid).update(update);
  return NextResponse.json({ ok: true, ...update });
}

export const dynamic = "force-dynamic";
