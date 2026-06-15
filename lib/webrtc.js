// lib/webrtc.js
// Signalisation WebRTC via Supabase (offer/answer/ICE candidates).
// Pas de serveur média : la vidéo passe en P2P direct entre les deux
// navigateurs (faible coût serveur), avec TURN en relais si le P2P échoue
// derrière certains NAT/4G.

import { supabase } from "@/lib/supabase";

// Serveurs ICE : STUN public (gratuit) + TURN à fournir en prod (ex: Twilio,
// Cloudflare Calls, ou coturn auto-hébergé). Sans TURN, certains réseaux
// mobiles/4G bloquent le P2P direct.
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // { urls: "turn:turn.justalk.app:3478", username: "...", credential: "..." },
];

// Profils de qualité — sélectionnés automatiquement selon la bande passante
// mesurée (voir bandwidth.js). Nos profils sont optimisés pour réduire au maximum
// la consommation de données (notamment via les codecs de pointe AV1/VP9).
export const QUALITY_PROFILES = {
  "4k": { width: 3840, height: 2160, frameRate: 30, maxBitrate: 4_000_000, label: "4K Ultra HD" },
  "1080p": { width: 1920, height: 1080, frameRate: 30, maxBitrate: 1_200_000, label: "Full HD" },
  "720p": { width: 1280, height: 720, frameRate: 30, maxBitrate: 500_000, label: "HD" },
  "eco-hd": { width: 1280, height: 720, frameRate: 15, maxBitrate: 150_000, label: "HD Éco-Data (15fps)" },
  "480p": { width: 854, height: 480, frameRate: 20, maxBitrate: 200_000, label: "Standard (économe)" },
  "audio-only": { width: 0, height: 0, frameRate: 0, maxBitrate: 24_000, label: "Audio seul (24 kbps)" },
};

export async function createCallDoc(callId, { fromUid, fromPseudo, toUid, offer }) {
  const { error } = await supabase.from("calls").insert({
    id: callId,
    from_uid: fromUid,
    from_pseudo: fromPseudo,
    to_uid: toUid,
    offer,
    status: "ringing",
  });
  if (error) {
    console.error("Erreur lors de la création de l'appel :", error);
    throw error;
  }
}

export async function answerCallDoc(callId, answer) {
  const { error } = await supabase
    .from("calls")
    .update({ answer, status: "accepted" })
    .eq("id", callId);
  if (error) {
    console.error("Erreur lors de la réponse à l'appel :", error);
    throw error;
  }
}

export function listenToCall(callId, cb) {
  // Récupération initiale de l'état de l'appel
  supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (!error && data) {
        cb({
          fromUid: data.from_uid,
          fromPseudo: data.from_pseudo,
          toUid: data.to_uid,
          offer: data.offer,
          answer: data.answer,
          status: data.status,
        });
      }
    });

  // Abonnement aux modifications et suppressions en temps réel
  const channel = supabase
    .channel(`call-${callId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
      (payload) => {
        if (payload.new) {
          cb({
            fromUid: payload.new.from_uid,
            fromPseudo: payload.new.from_pseudo,
            toUid: payload.new.to_uid,
            offer: payload.new.offer,
            answer: payload.new.answer,
            status: payload.new.status,
          });
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
      () => {
        cb({ status: "ended" });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function listenToCandidates(callId, role, cb) {
  // 1. Récupération des candidats existants
  supabase
    .from("call_candidates")
    .select("*")
    .eq("call_id", callId)
    .eq("role", role)
    .then(({ data, error }) => {
      if (!error && data) {
        data.forEach((row) => cb(row.candidate));
      }
    });

  // 2. Écoute des futurs candidats insérés en temps réel
  const channel = supabase
    .channel(`call-candidates-${callId}-${role}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "call_candidates",
        filter: `call_id=eq.${callId}`,
      },
      (payload) => {
        if (payload.new && payload.new.role === role) {
          cb(payload.new.candidate);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function addCandidate(callId, role, candidate) {
  const { error } = await supabase.from("call_candidates").insert({
    call_id: callId,
    role,
    candidate: candidate.toJSON(),
  });
  if (error) {
    console.error("Erreur lors de l'ajout d'un candidat ICE :", error);
  }
}

export async function endCall(callId) {
  await supabase
    .from("calls")
    .update({ status: "ended" })
    .eq("id", callId)
    .catch(() => {});
}

export async function deleteCall(callId) {
  await supabase
    .from("calls")
    .delete()
    .eq("id", callId)
    .catch(() => {});
}

