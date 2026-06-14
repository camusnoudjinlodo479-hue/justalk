// app/api/profile/update/route.js
// Permet à l'utilisateur connecté de modifier son profil (à la WhatsApp) :
// pseudo, nom/prénom, bio, visibilité de la date de naissance, photo et cover.
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload?.uid) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const form = await req.formData();
  const supabaseAdmin = createSupabaseAdmin();

  // Récupère l'utilisateur actuel pour construire display_name si nécessaire
  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", payload.uid)
    .maybeSingle();

  const current = dbUser || {};
  const dbUpdate = {};

  const pseudo = form.get("pseudo");
  const firstName = form.get("firstName");
  const lastName = form.get("lastName");
  const bio = form.get("bio");
  const birthdateVisibility = form.get("birthdateVisibility");

  if (pseudo !== null) dbUpdate.pseudo = pseudo.toString().trim();
  if (firstName !== null) dbUpdate.first_name = firstName.toString().trim();
  if (lastName !== null) dbUpdate.last_name = lastName.toString().trim();
  if (bio !== null) dbUpdate.bio = bio.toString().trim();
  if (birthdateVisibility !== null) dbUpdate.birthdate_visibility = birthdateVisibility.toString().trim();

  if (firstName !== null || lastName !== null) {
    dbUpdate.display_name = `${firstName !== null ? firstName.toString().trim() : current.first_name ?? ""} ${
      lastName !== null ? lastName.toString().trim() : current.last_name ?? ""
    }`.trim();
  }

  const avatar = form.get("avatar");
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
      console.error("Erreur critique Supabase Storage lors de la mise à jour de l'avatar :", storageError);
    }
  }

  const cover = form.get("cover");
  if (cover && typeof cover !== "string") {
    try {
      const filePath = `covers/${payload.uid}-${Date.now()}`;
      const buffer = Buffer.from(await cover.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from("justalk")
        .upload(filePath, buffer, {
          contentType: cover.type,
          duplex: "half",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from("justalk")
        .getPublicUrl(filePath);

      dbUpdate.cover_url = publicUrl;
    } catch (storageError) {
      console.error("Erreur critique Supabase Storage lors de la mise à jour de la couverture :", storageError);
    }
  }

  if (Object.keys(dbUpdate).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(dbUpdate)
    .eq("id", payload.uid);

  if (updateError) {
    console.error("Erreur lors de la mise à jour du profil :", updateError);
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }

  // Renvoie le profil formaté en camelCase pour le frontend
  return NextResponse.json({
    ok: true,
    pseudo: dbUpdate.pseudo ?? current.pseudo,
    firstName: dbUpdate.first_name ?? current.first_name,
    lastName: dbUpdate.last_name ?? current.last_name,
    displayName: dbUpdate.display_name ?? current.display_name,
    bio: dbUpdate.bio ?? current.bio,
    avatarUrl: dbUpdate.avatar_url ?? current.avatar_url,
    coverUrl: dbUpdate.cover_url ?? current.cover_url,
    birthdateVisibility: dbUpdate.birthdate_visibility ?? current.birthdate_visibility,
  });
}

export const dynamic = "force-dynamic";
