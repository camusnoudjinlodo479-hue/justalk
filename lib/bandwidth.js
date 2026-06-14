// lib/bandwidth.js
// Estime le débit réel disponible pour choisir le meilleur profil vidéo
// possible (jusqu'à 4K) SANS jamais prétendre que la 4K consomme peu de
// données : on adapte simplement la qualité au lien, en privilégiant un
// codec efficace (AV1 > VP9 > H.264) pour limiter le débit à qualité égale.

export async function estimateDownlinkMbps() {
  // 1. API navigateur (Chrome/Android) — approximative mais instantanée
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn?.downlink) return conn.downlink; // en Mbps

  // 2. Fallback : petit téléchargement chronométré (image ~200KB)
  try {
    const start = performance.now();
    const res = await fetch("/api/bandwidth-probe", { cache: "no-store" });
    const blob = await res.blob();
    const seconds = (performance.now() - start) / 1000;
    const bits = blob.size * 8;
    return bits / seconds / 1_000_000;
  } catch {
    return 2; // hypothèse prudente : 2 Mbps
  }
}

// Retourne la clé du profil le plus élevé supportable par le lien mesuré,
// avec une marge de sécurité (le débit réel fluctue pendant l'appel).
export function pickQualityProfile(downlinkMbps) {
  const SAFETY_MARGIN = 0.6; // on n'utilise que 60% du débit mesuré
  const usable = downlinkMbps * SAFETY_MARGIN * 1_000_000;

  if (usable >= 12_000_000) return "4k";
  if (usable >= 3_500_000) return "1080p";
  if (usable >= 1_500_000) return "720p";
  if (usable >= 700_000) return "480p";
  if (usable >= 250_000) return "eco-hd";
  return "audio-only";
}

// Préférence de codec : AV1 (le plus économe à qualité égale) puis VP9 puis
// H.264. Tous les navigateurs ne supportent pas AV1 en encodage matériel —
// on filtre selon les codecs réellement annoncés par le navigateur.
export function getPreferredCodecs(kind = "video") {
  if (!window.RTCRtpSender?.getCapabilities) return null;
  const caps = RTCRtpSender.getCapabilities(kind);
  if (!caps) return null;

  const order = ["AV1", "VP9", "VP8", "H264"];
  return caps.codecs
    .filter((c) => order.includes(c.mimeType.split("/")[1]))
    .sort((a, b) => order.indexOf(a.mimeType.split("/")[1]) - order.indexOf(b.mimeType.split("/")[1]));
}
