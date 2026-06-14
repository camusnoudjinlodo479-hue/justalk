// app/api/profile/create/route.js
// Finalise l'inscription : enregistre le pseudo définitif, le schéma de
// secours (haché) et upload la photo de profil vers Supabase Storage.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase";
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
      const filePath = `avatars/${payload.uid}-${Date.now()}`;
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

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(dbUpdate)
    .eq("id", payload.uid);

  if (updateError) {
    console.error("Erreur lors de la mise à jour du profil :", updateError);
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...dbUpdate });
}

export const dynamic = 'force-dynamic';