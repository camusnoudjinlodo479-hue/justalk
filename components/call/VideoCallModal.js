"use client";
// components/call/VideoCallModal.js
// Appel vidéo P2P (WebRTC) avec qualité adaptative jusqu'à 4K selon le débit
// réel, et préférence de codec AV1/VP9 (les plus économes en données à
// qualité égale). Signalisation via Firestore (lib/webrtc.js).
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Gauge,
  X,
} from "lucide-react";
import {
  ICE_SERVERS,
  QUALITY_PROFILES,
  createCallDoc,
  answerCallDoc,
  listenToCall,
  listenToCandidates,
  addCandidate,
  endCall,
  deleteCall,
} from "@/lib/webrtc";
import { estimateDownlinkMbps, pickQualityProfile, getPreferredCodecs } from "@/lib/bandwidth";

export default function VideoCallModal({
  open,
  onClose,
  user,            // utilisateur courant { uid, pseudo }
  peer,            // correspondant { uid, pseudo, avatarUrl }
  mode = "caller", // "caller" | "callee"
  incomingCallId,  // requis si mode === "callee"
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const callIdRef = useRef(incomingCallId || `${user?.uid}_${peer?.uid}_${Date.now()}`);

  const [status, setStatus] = useState("connecting"); // connecting | ringing | live | ended
  const [quality, setQuality] = useState("720p");
  const [autoQuality, setAutoQuality] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [stats, setStats] = useState({ mbps: 0, codec: "" });

  const role = mode === "caller" ? "callerCandidates" : "calleeCandidates";
  const otherRole = mode === "caller" ? "calleeCandidates" : "callerCandidates";

  // --- Application du profil de qualité aux pistes vidéo locales ---
  const applyQualityProfile = useCallback(async (profileKey) => {
    const profile = QUALITY_PROFILES[profileKey];
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    const params = sender.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    params.encodings[0].maxBitrate = profile.maxBitrate;
    params.encodings[0].maxFramerate = profile.frameRate || undefined;
    try {
      await sender.setParameters(params);
    } catch (e) {
      console.warn("setParameters non supporté:", e);
    }

    // Recadre la résolution capturée si possible (audio-only n'a pas de track vidéo)
    if (sender.track && profile.width) {
      try {
        await sender.track.applyConstraints({
          width: { ideal: profile.width },
          height: { ideal: profile.height },
          frameRate: { ideal: profile.frameRate },
        });
      } catch (e) {
        console.warn("applyConstraints non supporté:", e);
      }
    }
  }, []);

  const setQualityManual = useCallback(
    (key) => {
      setAutoQuality(false);
      setQuality(key);
      applyQualityProfile(key);
    },
    [applyQualityProfile]
  );

  // --- Boucle d'adaptation automatique : remesure le débit toutes les 8s ---
  useEffect(() => {
    if (!autoQuality || status !== "live") return;
    let cancelled = false;
    const loop = async () => {
      const mbps = await estimateDownlinkMbps();
      if (cancelled) return;
      const best = pickQualityProfile(mbps);
      setStats((s) => ({ ...s, mbps }));
      setQuality((current) => {
        if (current !== best) applyQualityProfile(best);
        return best;
      });
    };
    loop();
    const interval = setInterval(loop, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [autoQuality, status, applyQualityProfile]);

  // --- Setup WebRTC ---
  useEffect(() => {
    if (!open) return;
    let localStream;
    let unsubCall;
    let unsubCandidates;
    const callId = callIdRef.current;

    async function setup() {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Capture caméra/micro — on démarre prudemment en 720p, puis on adapte.
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: true,
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // Préférence de codec AV1 > VP9 sur le transceiver vidéo (compression
      // la plus efficace = moins de données pour une qualité donnée).
      const videoTransceiver = pc.getTransceivers().find((t) => t.sender?.track?.kind === "video");
      const preferred = getPreferredCodecs("video");
      if (videoTransceiver?.setCodecPreferences && preferred?.length) {
        try {
          videoTransceiver.setCodecPreferences(preferred);
          setStats((s) => ({ ...s, codec: preferred[0].mimeType.split("/")[1] }));
        } catch {}
      }

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("live");
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setStatus("ended");
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) addCandidate(callId, role, e.candidate);
      };

      if (mode === "caller") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await createCallDoc(callId, { fromUid: user.uid, fromPseudo: user.pseudo, toUid: peer.uid, offer });
        setStatus("ringing");

        unsubCall = listenToCall(callId, async (data) => {
          if (data?.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
          if (data?.status === "ended") setStatus("ended");
        });
      } else {
        // callee : récupère l'offre, répond
        unsubCall = listenToCall(callId, async (data) => {
          if (data?.offer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await answerCallDoc(callId, answer);
          }
          if (data?.status === "ended") setStatus("ended");
        });
      }

      unsubCandidates = listenToCandidates(callId, otherRole, async (candidate) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("ICE candidate ignoré:", e);
        }
      });

      // Première estimation de qualité dès la connexion établie
      const mbps = await estimateDownlinkMbps();
      const best = pickQualityProfile(mbps);
      setQuality(best);
      setStats((s) => ({ ...s, mbps }));
      applyQualityProfile(best);
    }

    setup().catch((e) => {
      console.error("Erreur init appel:", e);
      setStatus("ended");
    });

    return () => {
      unsubCall?.();
      unsubCandidates?.();
      pcRef.current?.close();
      localStream?.getTracks().forEach((t) => t.stop());
      deleteCall(callId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleMute() {
    const stream = localVideoRef.current?.srcObject;
    stream?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }

  function toggleCamera() {
    const stream = localVideoRef.current?.srcObject;
    stream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff((c) => !c);
  }

  async function hangUp() {
    await endCall(callIdRef.current);
    setStatus("ended");
    onClose?.();
  }

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-slate-900 flex flex-col"
    >
      {/* Vidéo distante en plein écran */}
      <div className="relative flex-1 bg-black">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="w-20 h-20 rounded-full bg-electric/20 flex items-center justify-center font-bold text-2xl animate-pulseRing">
              {peer?.pseudo?.[0]?.toUpperCase()}
            </div>
            <p className="font-semibold">{peer?.pseudo}</p>
            <p className="text-sm text-slate-300">
              {status === "connecting" && "Connexion…"}
              {status === "ringing" && "Appel en cours…"}
              {status === "ended" && "Appel terminé"}
            </p>
          </div>
        )}

        {/* Pastille vidéo locale */}
        <div className="absolute bottom-24 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-embossed-lg border-2 border-white/20 bg-slate-800">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        </div>

        {/* Badge qualité + débit */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-black/50 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Gauge size={14} className="text-electric" />
            {QUALITY_PROFILES[quality]?.label}
            {stats.mbps > 0 && <span className="text-slate-300">· ~{stats.mbps.toFixed(1)} Mbps</span>}
          </div>
          {stats.codec && (
            <div className="bg-black/50 backdrop-blur text-white text-xs font-semibold px-2.5 py-1.5 rounded-full">
              {stats.codec}
            </div>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 icon-btn bg-black/50 text-white">
          <X size={18} />
        </button>
      </div>

      {/* Sélecteur de qualité */}
      <div className="px-4 py-2 bg-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setAutoQuality(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
            autoQuality ? "bg-electric text-white" : "bg-slate-700 text-slate-300"
          }`}
        >
          Auto
        </button>
        {Object.entries(QUALITY_PROFILES).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setQualityManual(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
              !autoQuality && quality === key ? "bg-electric text-white" : "bg-slate-700 text-slate-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Contrôles */}
      <div className="px-4 py-4 bg-slate-900 flex items-center justify-center gap-4">
        <button onClick={toggleMute} className="icon-btn w-14 h-14 bg-slate-700 text-white">
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={hangUp} className="icon-btn w-16 h-16 bg-red-500 text-white hover:bg-red-600 shadow-glow">
          <PhoneOff size={26} />
        </button>
        <button onClick={toggleCamera} className="icon-btn w-14 h-14 bg-slate-700 text-white">
          {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
      </div>

      <p className="text-[11px] text-slate-500 text-center pb-2 px-4">
        La qualité 4K nécessite un débit stable d'environ 12-15 Mbps. Justalk
        adapte automatiquement la résolution (codec AV1/VP9) à ta connexion
        pour limiter la consommation de données sans interrompre l'appel.
      </p>
    </motion.div>
  );
}
