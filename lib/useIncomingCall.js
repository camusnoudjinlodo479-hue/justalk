"use client";
// lib/useIncomingCall.js
// Écoute la table "calls" de Supabase pour détecter un appel entrant adressé à
// l'utilisateur courant (status "ringing").
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useIncomingCall(uid) {
  const [incoming, setIncoming] = useState(null);

  useEffect(() => {
    if (!uid) return;

    async function fetchIncoming() {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .eq("to_uid", uid)
        .eq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        setIncoming({
          id: row.id,
          fromUid: row.from_uid,
          fromPseudo: row.from_pseudo,
          toUid: row.to_uid,
          status: row.status,
          offer: row.offer,
        });
      } else {
        setIncoming(null);
      }
    }

    fetchIncoming();

    // S'abonne aux modifications/insertions d'appels entrants en temps réel
    const channel = supabase
      .channel(`incoming-calls-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `to_uid=eq.${uid}`,
        },
        () => {
          fetchIncoming();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  return incoming;
}

