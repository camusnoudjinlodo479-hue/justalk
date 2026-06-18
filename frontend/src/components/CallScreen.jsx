// frontend/src/components/CallScreen.jsx
import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, User, Loader2 } from "lucide-react";

export default function CallScreen({ roomId, currentUser, callType, isIncoming, callerName, onClose }) {
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({}); // id -> { stream, name }
  const [muteMic, setMuteMic] = useState(false);
  const [hideVideo, setHideVideo] = useState(callType === "audio");
  const [isAccepted, setIsAccepted] = useState(!isIncoming);
  const [status, setStatus] = useState(isIncoming ? "Appel entrant..." : "Appel en cours...");
  
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);

  // Web Audio Ringing Synthesizer
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);

  const startRinging = (incoming) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtxRef.current = new AudioCtx();
      
      ringIntervalRef.current = setInterval(() => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        if (incoming) {
          osc1.frequency.value = 400;
          osc2.frequency.value = 450;
        } else {
          osc1.frequency.value = 440;
          osc2.frequency.value = 480;
        }
        
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.6);
        osc2.stop(ctx.currentTime + 1.6);
      }, 2500);
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
        video: callType === "video" ? { width: 480, height: 640 } : false
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
            // Créer une Peer Connection pour lui
            createPeerConnection(sender, name, true);
            break;
            
          case "offer":
            stopRinging();
            setStatus("En communication");
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
    <div className="call-screen text-white flex flex-col justify-between">
      
      {/* 1. APPEL ENTRANT (NON ACCEPTE) */}
      {!isAccepted && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-slate-950 p-6 animate-fadeIn">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 animate-pulseRing relative">
            <User size={48} />
          </div>
          <div className="text-center">
            <h3 className="font-display font-extrabold text-2xl tracking-tight text-white mb-2">
              {callerName || "Correspondant"}
            </h3>
            <p className="text-sm text-slate-400">
              Appel {callType === "video" ? "vidéo" : "audio"} entrant...
            </p>
          </div>

          <div className="flex gap-6 mt-4">
            {/* Bouton Refuser */}
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <PhoneOff size={24} />
            </button>
            {/* Bouton Accepter */}
            <button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
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
          <div className="call-header">
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
                    />
                  ) : (
                    // Si audio-only, afficher une icône circulaire pulsante
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 animate-pulseRing">
                        <User size={36} />
                      </div>
                    </div>
                  )}
                  <span className="video-label">{peer.name}</span>
                </div>
              ))}

              {/* Si personne n'est connecté et c'est audio-only ou pas encore de correspondant */}
              {Object.keys(remotePeers).length === 0 && (
                <div className="w-full h-full flex items-center justify-center bg-slate-900/40 rounded-3xl border border-white/5">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={36} className="animate-spin text-blue-500" />
                    <p className="text-xs text-slate-400 font-medium">En attente de connexion...</p>
                  </div>
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
            >
              {muteMic ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Mute Video (seulement pour appels vidéo) */}
            {callType === "video" && (
              <button
                onClick={toggleVideo}
                className={`control-btn mute ${hideVideo ? 'active' : ''}`}
              >
                {hideVideo ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {/* Hangup */}
            <button
              onClick={handleHangup}
              className="control-btn hangup"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
