// frontend/src/components/CallScreen.jsx
import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, User, Loader2, Lock, Sparkles } from "lucide-react";

export default function CallScreen({ roomId, currentUser, callType, isIncoming, callerName, onClose }) {
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({}); // id -> { stream, name }
  const [muteMic, setMuteMic] = useState(false);
  const [hideVideo, setHideVideo] = useState(callType === "audio");
  const [isAccepted, setIsAccepted] = useState(!isIncoming);
  const [status, setStatus] = useState(isIncoming ? "Appel entrant..." : "Appel en cours...");
  const [enhancerEnabled, setEnhancerEnabled] = useState(true);
  
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);

  // Web Audio Ringing Synthesizer & Missed Call tracking
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const connectedTimeRef = useRef(null);
  const callLoggedRef = useRef(false);

  // Play a single warm, double-beep (outgoing call ringback tone)
  const playCallingBeep = (ctx, t_start) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.frequency.setValueAtTime(325, t_start);
    osc2.frequency.setValueAtTime(375, t_start);

    // Warm lowpass filter
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t_start);

    // Soft attack & decay
    gainNode.gain.setValueAtTime(0, t_start);
    gainNode.gain.linearRampToValueAtTime(0.12, t_start + 0.03);
    gainNode.gain.setValueAtTime(0.12, t_start + 0.22);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t_start + 0.25);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(t_start);
    osc2.start(t_start);
    osc1.stop(t_start + 0.26);
    osc2.stop(t_start + 0.26);
  };

  // Play a single marimba/bell note with harmonics
  const playMarimbaNote = (ctx, freq, t_start, duration) => {
    // Fundamental
    const osc1 = ctx.createOscillator();
    osc1.frequency.setValueAtTime(freq, t_start);
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, t_start);
    gain1.gain.linearRampToValueAtTime(0.12, t_start + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, t_start + duration);
    osc1.connect(gain1);

    // 1st overtone (harmonic 3)
    const osc2 = ctx.createOscillator();
    osc2.frequency.setValueAtTime(freq * 3, t_start);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, t_start);
    gain2.gain.linearRampToValueAtTime(0.04, t_start + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, t_start + duration * 0.4);
    osc2.connect(gain2);

    // 2nd overtone (harmonic 6)
    const osc3 = ctx.createOscillator();
    osc3.frequency.setValueAtTime(freq * 6, t_start);
    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0, t_start);
    gain3.gain.linearRampToValueAtTime(0.02, t_start + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.001, t_start + duration * 0.2);
    osc3.connect(gain3);

    const mixNode = ctx.createGain();
    gain1.connect(mixNode);
    gain2.connect(mixNode);
    gain3.connect(mixNode);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, t_start);

    mixNode.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(t_start);
    osc2.start(t_start);
    osc3.start(t_start);

    osc1.stop(t_start + duration + 0.05);
    osc2.stop(t_start + duration + 0.05);
    osc3.stop(t_start + duration + 0.05);
  };

  // Schedule the full WhatsApp incoming marimba melody
  const scheduleWhatsAppMelody = (ctx, t_start) => {
    const melody = [
      { freq: 1318.51, duration: 0.16, delay: 0.0 },  // E6
      { freq: 987.77,  duration: 0.16, delay: 0.16 }, // B5
      { freq: 830.61,  duration: 0.16, delay: 0.32 }, // G#5
      { freq: 659.25,  duration: 0.16, delay: 0.48 }, // E5
      { freq: 739.99,  duration: 0.16, delay: 0.64 }, // F#5
      { freq: 830.61,  duration: 0.16, delay: 0.80 }, // G#5
      { freq: 880.00,  duration: 0.16, delay: 0.96 }, // A5
      { freq: 987.77,  duration: 0.16, delay: 1.12 }, // B5
      { freq: 1108.73, duration: 0.16, delay: 1.28 }, // C#6
      { freq: 987.77,  duration: 0.45, delay: 1.44 }, // B5
    ];

    melody.forEach(note => {
      playMarimbaNote(ctx, note.freq, t_start + note.delay, note.duration);
    });
  };

  const playOnce = (incoming) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;
    if (incoming) {
      scheduleWhatsAppMelody(ctx, now);
    } else {
      playCallingBeep(ctx, now);
      playCallingBeep(ctx, now + 0.38);
    }
  };

  const startRinging = (incoming) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      
      audioCtxRef.current = new AudioCtx();
      playOnce(incoming);
      
      const intervalTime = incoming ? 3000 : 2800;
      ringIntervalRef.current = setInterval(() => {
        playOnce(incoming);
      }, intervalTime);
    } catch (err) {
      console.warn("Ringing synthesis failed:", err);
    }
  };

  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const recordCallOutcome = async () => {
    if (isIncoming || callLoggedRef.current) return;
    callLoggedRef.current = true;
    
    let outcomeContent = "";
    if (hasConnectedRef.current) {
      const durationSeconds = connectedTimeRef.current 
        ? Math.round((Date.now() - connectedTimeRef.current) / 1000) 
        : 0;
      let durationText = "";
      if (durationSeconds < 60) {
        durationText = `${durationSeconds}s`;
      } else {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        durationText = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
      }
      outcomeContent = `${callType === "video" ? "🎥 Appel vidéo" : "📞 Appel audio"} terminé (${durationText})`;
    } else {
      outcomeContent = `${callType === "video" ? "🎥 Appel vidéo" : "📞 Appel audio"} manqué`;
    }

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: roomId,
          content: outcomeContent
        })
      });
    } catch (err) {
      console.error("Failed to log call outcome:", err);
    }
  };

  // 1. Démarrer le flux local et la signalisation
  useEffect(() => {
    startRinging(isIncoming);
    
    if (isAccepted) {
      initiateCall();
    }

    return () => {
      stopRinging();
      cleanupCall();
    };
  }, [isAccepted]);

  const initiateCall = async () => {
    stopRinging();
    if (!isIncoming) {
      startRinging(false); // Play ringback tone until somebody joins
    }

    try {
      // Obtenir micro/caméra
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? {
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 30, max: 60 }
        } : false
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connecter WebSocket signalisation
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/call/${roomId}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        // Signaler l'arrivée
        wsRef.current.send(JSON.stringify({
          type: "join",
          sender: currentUser.id,
          name: currentUser.display_name || currentUser.username
        }));
        setStatus("Connecté");
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const { type, sender, name, offer, answer, candidate, target } = data;

        // Ignorer les messages dont nous ne sommes pas la cible
        if (target && target !== currentUser.id) return;

        switch (type) {
          case "join":
            // Nouveau participant : on arrête la sonnerie d'attente
            stopRinging();
            setStatus("En communication");
            if (!hasConnectedRef.current) {
              hasConnectedRef.current = true;
              connectedTimeRef.current = Date.now();
            }
            // Créer une Peer Connection pour lui
            createPeerConnection(sender, name, true);
            break;
            
          case "offer":
            stopRinging();
            setStatus("En communication");
            if (!hasConnectedRef.current) {
              hasConnectedRef.current = true;
              connectedTimeRef.current = Date.now();
            }
            const pc = createPeerConnection(sender, name, false);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            wsRef.current.send(JSON.stringify({
              type: "answer",
              sender: currentUser.id,
              target: sender,
              answer: ans
            }));
            break;
            
          case "answer":
            const peerPc = peersRef.current[sender];
            if (peerPc) {
              await peerPc.setRemoteDescription(new RTCSessionDescription(answer));
            }
            break;
            
          case "candidate":
            const candPc = peersRef.current[sender];
            if (candPc) {
              await candPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            break;
            
          case "peer-left":
          case "leave":
            removePeer(sender);
            break;
            
          default:
            break;
        }
      };

    } catch (err) {
      console.error("Erreur d'initialisation média:", err);
      setStatus("Erreur média");
    }
  };

  const createPeerConnection = (peerId, peerName, isInitiator) => {
    // Éviter les connexions en double
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    const config = {
      iceServers: [{ urls: "stun:stun.l.google.com:19002" }]
    };

    const pc = new RTCPeerConnection(config);
    peersRef.current[peerId] = pc;

    // Ajouter nos tracks locaux
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "candidate",
          sender: currentUser.id,
          target: peerId,
          candidate: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: {
          stream: event.streams[0],
          name: peerName
        }
      }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        removePeer(peerId);
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "offer",
              sender: currentUser.id,
              target: peerId,
              name: currentUser.display_name || currentUser.username,
              offer: offer
            }));
          }
        } catch (err) {
          console.error(err);
        }
      };
    }

    return pc;
  };

  const removePeer = (peerId) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].close();
      delete peersRef.current[peerId];
    }
    setRemotePeers(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      // Si plus personne, on repasse en attente
      if (Object.keys(copy).length === 0 && !isIncoming) {
        setStatus("En attente de correspondants...");
      }
      return copy;
    });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuteMic(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setHideVideo(!videoTrack.enabled);
      }
    }
  };

  const cleanupCall = () => {
    // Enregistrer le statut final de l'appel pour l'historique
    recordCallOutcome();

    // Envoyer signal de départ
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "leave",
        sender: currentUser.id
      }));
      wsRef.current.close();
    }

    // Fermer les PeerConnections
    Object.keys(peersRef.current).forEach(peerId => {
      peersRef.current[peerId].close();
    });
    peersRef.current = {};

    // Stopper le flux local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    localStreamRef.current = null;
  };

  const handleHangup = () => {
    cleanupCall();
    onClose();
  };

  const handleAccept = () => {
    setIsAccepted(true);
  };

  const handleDecline = () => {
    cleanupCall();
    onClose();
  };

  return (
    <div className={`call-screen text-white flex flex-col justify-between ${
      (!isAccepted || callType === "audio") ? "bg-whatsapp-call" : "bg-slate-950"
    }`}>
      {/* SVG Filter for Snapchat Beauty Effect */}
      <svg width="0" height="0" style={{ position: 'absolute', zIndex: -1 }}>
        <filter id="beauty-filter">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feColorMatrix type="matrix" values="
            1 0 0 0 0.05
            0 1 0 0 0.05
            0 0 1 0 0.05
            0 0 0 1 0" in="blur" result="glow" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="glow" opacity="0.35" />
          </feMerge>
        </filter>
      </svg>
      
      {/* Custom Styles for video filters */}
      <style>{`
        .snap-enhancer {
          filter: url(#beauty-filter) saturate(1.08) contrast(1.02);
          image-rendering: auto;
        }
      `}</style>
      
      {/* 1. APPEL ENTRANT (NON ACCEPTE) */}
      {!isAccepted && (
        <div className="flex-1 flex flex-col items-center justify-between p-8 animate-fadeIn relative">
          {/* Chiffrement de bout en bout */}
          <div className="flex items-center gap-1.5 text-[10px] text-[#128c7e]/70 font-semibold tracking-wider uppercase mt-4">
            <Lock size={12} className="text-[#128c7e]/60" />
            <span>Chiffré de bout en bout</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-10 flex-1 w-full">
            {/* Avatar pulsant avec ondes WhatsApp */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="ripple-ring-1"></div>
              <div className="ripple-ring-2"></div>
              <div className="ripple-ring-3"></div>
              <div className="w-24 h-24 rounded-full bg-[#128c7e]/10 flex items-center justify-center text-[#128c7e] border border-[#128c7e]/20 z-10 shadow-lg">
                <User size={44} />
              </div>
            </div>
            
            <div className="text-center z-10">
              <h3 className="font-display font-extrabold text-2xl tracking-tight text-white mb-2">
                {callerName || "Correspondant"}
              </h3>
              <p className="text-sm text-[#128c7e] font-semibold tracking-wide uppercase">
                Appel {callType === "video" ? "vidéo" : "audio"} entrant...
              </p>
            </div>
          </div>

          {/* Boutons d'action accept/decline */}
          <div className="flex gap-10 mb-8 z-10">
            {/* Bouton Refuser */}
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Refuser"
            >
              <PhoneOff size={24} />
            </button>
            {/* Bouton Accepter */}
            <button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Accepter"
            >
              <Phone size={24} />
            </button>
          </div>
        </div>
      )}

      {/* 2. APPEL EN COURS / ACCEPTE */}
      {isAccepted && (
        <>
          {/* Header */}
          <div className="call-header relative">
            {/* Chiffrement de bout en bout */}
            <div className="flex items-center gap-1.25 text-[9px] text-[#128c7e]/70 font-bold tracking-wider uppercase mb-1">
              <Lock size={10} className="text-[#128c7e]/60" />
              <span>Chiffré de bout en bout</span>
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{status}</h4>
            {Object.keys(remotePeers).length === 0 && (
              <p className="text-sm text-slate-300 font-medium">Connexion avec vos correspondants...</p>
            )}
          </div>

          {/* Grille Vidéo */}
          <div className="flex-1 relative w-full flex items-center justify-center px-4">
            
            {/* PIP Local (Vidéo locale) */}
            {callType === "video" && localStream && !hideVideo && (
              <div className="local-pip">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={enhancerEnabled ? "snap-enhancer" : ""}
                />
              </div>
            )}

            {/* Grille des flux distants */}
            <div className={`w-full h-full video-grid ${
              Object.keys(remotePeers).length === 1 ? 'two-peers' : 'multi-peers'
            }`}>
              
              {/* Rendre chaque correspondant */}
              {Object.entries(remotePeers).map(([peerId, peer]) => (
                <div key={peerId} className="video-wrapper">
                  {callType === "video" ? (
                    <video
                      ref={el => {
                        if (el) el.srcObject = peer.stream;
                      }}
                      autoPlay
                      playsInline
                      className={enhancerEnabled ? "snap-enhancer" : ""}
                    />
                  ) : (
                    // Si audio-only, afficher l'avatar pulsant style WhatsApp
                    <div className="w-full h-full flex items-center justify-center bg-transparent">
                      <div className="relative w-44 h-44 flex items-center justify-center">
                        <div className="ripple-ring-1"></div>
                        <div className="ripple-ring-2"></div>
                        <div className="ripple-ring-3"></div>
                        <div className="w-24 h-24 rounded-full bg-[#128c7e]/10 flex items-center justify-center text-[#128c7e] border border-[#128c7e]/20 z-10 shadow-lg">
                          <User size={40} />
                        </div>
                      </div>
                    </div>
                  )}
                  <span className="video-label">{peer.name}</span>
                </div>
              ))}

              {/* Si personne n'est connecté et c'est audio-only ou pas encore de correspondant */}
              {Object.keys(remotePeers).length === 0 && (
                <div className="w-full h-full flex items-center justify-center bg-slate-900/20 rounded-3xl border border-white/5">
                  {callType === "video" ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={36} className="animate-spin text-blue-500" />
                      <p className="text-xs text-slate-400 font-medium">En attente de connexion...</p>
                    </div>
                  ) : (
                    // Pour appel audio-only en attente
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      <div className="ripple-ring-1"></div>
                      <div className="ripple-ring-2"></div>
                      <div className="ripple-ring-3"></div>
                      <div className="w-24 h-24 rounded-full bg-[#128c7e]/10 flex items-center justify-center text-[#128c7e] border border-[#128c7e]/20 z-10 shadow-lg">
                        <User size={40} />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Contrôles au bas */}
          <div className="call-controls">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={`control-btn mute ${muteMic ? 'active' : ''}`}
              title={muteMic ? "Réactiver micro" : "Couper micro"}
            >
              {muteMic ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Mute Video (seulement pour appels vidéo) */}
            {callType === "video" && (
              <button
                onClick={toggleVideo}
                className={`control-btn mute ${hideVideo ? 'active' : ''}`}
                title={hideVideo ? "Activer caméra" : "Désactiver caméra"}
              >
                {hideVideo ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {/* Snap Enhancer Toggle */}
            {callType === "video" && (
              <button
                onClick={() => setEnhancerEnabled(!enhancerEnabled)}
                className={`control-btn mute ${enhancerEnabled ? 'active bg-gradient-to-r from-pink-500 to-amber-500 text-white' : ''}`}
                title={enhancerEnabled ? "Désactiver l'effet Enhancer" : "Activer l'effet Enhancer"}
              >
                <Sparkles size={20} />
              </button>
            )}

            {/* Hangup */}
            <button
              onClick={handleHangup}
              className="control-btn hangup"
              title="Raccrocher"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
