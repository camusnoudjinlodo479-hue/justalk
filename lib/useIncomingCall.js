"use client";
// lib/useIncomingCall.js
// Écoute la collection "calls" pour détecter un appel entrant adressé à
// l'utilisateur courant (status "ringing").
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useIncomingCall(uid) {
  const [incoming, setIncoming] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "calls"),
      where("toUid", "==", uid),
      where("status", "==", "ringing")
    );
    const unsub = onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      setIncoming(doc ? { id: doc.id, ...doc.data() } : null);
    });
    return () => unsub();
  }, [uid]);

  return incoming;
}
