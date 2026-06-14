import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? await verifySessionToken(token) : null;
    
    if (!payload?.uid) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    const supabaseAdmin = createSupabaseAdmin();
    const { data: dbUser, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", payload.uid)
      .maybeSingle();
    
    if (error || !dbUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    
    return NextResponse.json({
      user: {
        uid: payload.uid,
        pseudo: dbUser.pseudo,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        displayName: dbUser.display_name,
        bio: dbUser.bio,
        avatarUrl: dbUser.avatar_url,
        coverUrl: dbUser.cover_url,
        birthdate: dbUser.birthdate,
        birthdateVisibility: dbUser.birthdate_visibility,
        online: dbUser.online,
        createdAt: dbUser.created_at,
      }
    });
  } catch (error) {
    console.error("Erreur lors de la vérification de session :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";