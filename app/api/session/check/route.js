import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? await verifySessionToken(token) : null;
    
    if (!payload?.uid) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupère l'utilisateur depuis Firestore
    const userDoc = await adminDb.collection("users").doc(payload.uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    
    return NextResponse.json({
      user: {
        uid: payload.uid,
        ...userDoc.data(),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la vérification de session :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";