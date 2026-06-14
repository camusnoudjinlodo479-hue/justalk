"use client";
// lib/useCurrentUser.js
// Récupère l'utilisateur connecté via le cookie de session httpOnly
// (posé par /api/webauthn/*). Renvoie null pendant le chargement.
import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/session/check")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (active && data) {
          // Définit l'utilisateur immédiatement pour un rendu d'interface rapide
          setUser(data.user);
          if (data.firebaseToken) {
            try {
              await signInWithCustomToken(auth, data.firebaseToken);
              if (active) setFirebaseReady(true);
            } catch (err) {
              console.error("Erreur d'authentification client-side Firebase :", err);
              if (active) setFirebaseReady(true);
            }
          } else {
            if (active) setFirebaseReady(true);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return { user, firebaseReady };
}
