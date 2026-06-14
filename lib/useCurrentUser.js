"use client";
// lib/useCurrentUser.js
// Récupère l'utilisateur connecté via le cookie de session httpOnly
// (posé par /api/webauthn/*). Renvoie null pendant le chargement.
import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/session/check")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (active && data) {
          if (data.firebaseToken) {
            try {
              await signInWithCustomToken(auth, data.firebaseToken);
              if (active) setUser(data.user);
            } catch (err) {
              console.error("Erreur d'authentification client-side Firebase :", err);
              if (active) setUser(data.user);
            }
          } else {
            if (active) setUser(data.user);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return user;
}
