// app/api/profile/create/route.js
// Finalise l'inscription : enregistre le pseudo définitif, le schéma de
// secours (haché) et upload la photo de profil vers Supabase Storage.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifySessionToken, SESSION_COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  const form = await req.formData();
  const pseudo = form.get("pseudo");
  const firstName = form.get("firstName");
  const lastName = form.get("lastName");
  const birthdate = form.get("birthdate");
  const pattern = form.get("pattern");
  const avatar = form.get("avatar");

  let uid;
  let isNewUser = false;

  if (payload?.uid) {
    uid = payload.uid;
  } else {
    // Nouvel utilisateur sans biométrie (onboarding bypassé/sauté sur desktop)
    uid = crypto.randomUUID();
    isNewUser = true;
  }

  const dbUpdate = {};
  if (pseudo) dbUpdate.pseudo = pseudo;
  if (firstName) dbUpdate.first_name = firstName;
  if (lastName) dbUpdate.last_name = lastName;
  if (birthdate) dbUpdate.birthdate = birthdate;
  if (firstName || lastName) dbUpdate.display_name = `${firstName || ""} ${lastName || ""}`.trim();

  if (pattern) {
    const parsed = JSON.parse(pattern);
    if (parsed) {
      dbUpdate.pattern_hash = crypto.createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
    }
  }

  const supabaseAdmin = createSupabaseAdmin();

  if (avatar && typeof avatar !== "string") {
    try {
      const filePath = `avatars/${uid}-${Date.now()}`;
      const buffer = Buffer.from(await avatar.arrayBuffer());
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from("justalk")
        .upload(filePath, buffer, {
          contentType: avatar.type,
          duplex: "half",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from("justalk")
        .getPublicUrl(filePath);

      dbUpdate.avatar_url = publicUrl;
    } catch (storageError) {
      console.error("Erreur critique Supabase Storage lors de la création de l'avatar :", storageError);
    }
  }

  const { error: dbError } = isNewUser
    ? await supabaseAdmin.from("users").insert({
        id: uid,
        pseudo: pseudo || `user-${uid.slice(0, 8)}`,
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: dbUpdate.display_name || null,
        birthdate: birthdate || null,
        created_at: new Date().toISOString(),
        pattern_hash: dbUpdate.pattern_hash || null,
        avatar_url: dbUpdate.avatar_url || null,
      })
    : await supabaseAdmin
        .from("users")
        .update(dbUpdate)
        .eq("id", uid);

  if (dbError) {
    console.error("Erreur lors de l'enregistrement en DB :", dbError);
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }

  const responseBody = { ok: true, uid, ...dbUpdate };
  const res = NextResponse.json(responseBody);

  if (isNewUser) {
    const sessionToken = await createSessionToken({ uid, pseudo: pseudo || `user-${uid.slice(0, 8)}` });
    res.cookies.set(sessionCookieOptions().name, sessionToken, sessionCookieOptions());
  }

  return res;
}

export const dynamic = 'force-dynamic';