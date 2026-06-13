// lib/webrtc.js
// Signalisation WebRTC via Firestore (offer/answer/ICE candidates).
// Pas de serveur média : la vidéo passe en P2P direct entre les deux
// navigateurs (faible coût serveur), avec TURN en relais si le P2P échoue
// derrière certains NAT/4G.

import {
  doc,
  collection,
  setDoc,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Serveurs ICE : STUN public (gratuit) + TURN à fournir en prod (ex: Twilio,
// Cloudflare Calls, ou coturn auto-hébergé). Sans TURN, certains réseaux
// mobiles/4G bloquent le P2P direct.
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // { urls: "turn:turn.justalk.app:3478", username: "...", credential: "..." },
];

// Profils de qualité — sélectionnés automatiquement selon la bande passante
// mesurée (voir bandwidth.js). "4K" n'est proposé QUE si le lien le permet
// réellement (>15 Mbps stables), sinon repli automatique.
export const QUALITY_PROFILES = {
  "4k": { width: 3840, height: 2160, frameRate: 30, maxBitrate: 12_000_000, label: "4K Ultra HD" },
  "1080p": { width: 1920, height: 1080, frameRate: 30, maxBitrate: 3_500_000, label: "Full HD" },
  "720p": { width: 1280, height: 720, frameRate: 30, maxBitrate: 1_500_000, label: "HD" },
  "480p": { width: 854, height: 480, frameRate: 24, maxBitrate: 700_000, label: "Standard (économe)" },
  "audio-only": { width: 0, height: 0, frameRate: 0, maxBitrate: 40_000, label: "Audio seul (ultra économe)" },
};

export async function createCallDoc(callId, { fromUid, fromPseudo, toUid, offer }) {
  await setDoc(doc(db, "calls", callId), {
    fromUid,
    fromPseudo,
    toUid,
    offer,
    status: "ringing",
    createdAt: serverTimestamp(),
  });
}

export async function answerCallDoc(callId, answer) {
  await updateDoc(doc(db, "calls", callId), { answer, status: "accepted" });
}

export function listenToCall(callId, cb) {
  return onSnapshot(doc(db, "calls", callId), (snap) => cb(snap.data()));
}

export function listenToCandidates(callId, role, cb) {
  // role = "callerCandidates" | "calleeCandidates"
  return onSnapshot(collection(db, "calls", callId, role), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") cb(change.doc.data());
    });
  });
}

export async function addCandidate(callId, role, candidate) {
  await addDoc(collection(db, "calls", callId, role), candidate.toJSON());
}

export async function endCall(callId) {
  await updateDoc(doc(db, "calls", callId), { status: "ended" }).catch(() => {});
}

export async function deleteCall(callId) {
  await deleteDoc(doc(db, "calls", callId)).catch(() => {});
}
