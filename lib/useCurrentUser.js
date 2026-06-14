"use client";
// lib/useCurrentUser.js
// Récupère l'utilisateur connecté via le cookie de session httpOnly
// (posé par /api/webauthn/*). Renvoie null pendant le chargement.
import { useEffect, useState } from "react";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/session/check")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setUser(data.user);
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { user, firebaseReady: ready };
}
