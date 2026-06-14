"use client";
// app/messenger/page.js
// Messenger : sidebar de conversations + fenêtre de chat temps réel (Firestore onSnapshot).
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import ConversationList from "@/components/messenger/ConversationList";
import ChatWindow from "@/components/messenger/ChatWindow";
import VideoCallModal from "@/components/call/VideoCallModal";
import IncomingCallBanner from "@/components/call/IncomingCallBanner";
import { useIncomingCall } from "@/lib/useIncomingCall";
import { deleteCall } from "@/lib/webrtc";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function MessengerPage() {
  const { user, firebaseReady } = useCurrentUser();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [call, setCall] = useState(null); // { peer, mode, callId }
  const [toUid, setToUid] = useState(null);

  const incomingCall = useIncomingCall(user?.uid);

  // Parse le paramètre de requête 'to' dans l'URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const to = params.get("to");
      if (to) setToUid(to);
    }
  }, []);

  // Écoute les conversations en temps réel
  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;
    const q = query(collection(db, "conversations"), where("members", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const other = (data.memberProfiles || []).find((m) => m.uid !== user.uid) || {};
        return {
          id: d.id,
          pseudo: other.pseudo || "Utilisateur",
          avatarUrl: other.avatarUrl,
          online: other.online,
          lastMessage: data.lastMessage,
          unread: data.unread?.[user.uid] || 0,
        };
      });
      setConversations(list);
      
      // N'auto-sélectionne la première conversation que s'il n'y a pas de paramètre "to" dans l'URL
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const hasToParam = params?.has("to");
      if (!activeId && !hasToParam && list[0]) {
        setActiveId(list[0].id);
      }
    });
    return () => unsub();
  }, [user?.uid, activeId, firebaseReady]);

  // Gère la création/sélection automatique si redirection via 'to=UID'
  useEffect(() => {
    if (!user?.uid || !toUid || !firebaseReady) return;

    // Identifiant unique prédictif pour la conversation entre les deux membres
    const convId = user.uid < toUid ? `${user.uid}_${toUid}` : `${toUid}_${user.uid}`;

    async function initConversation() {
      try {
        const convRef = doc(db, "conversations", convId);
        const convSnap = await getDoc(convRef);

        if (!convSnap.exists()) {
          // Récupère les informations publiques du destinataire
          const targetSnap = await getDoc(doc(db, "users", toUid));
          if (!targetSnap.exists()) return;
          const targetData = targetSnap.data();

          // Crée la conversation dans Firestore
          await setDoc(convRef, {
            members: [user.uid, toUid],
            memberProfiles: [
              {
                uid: user.uid,
                pseudo: user.pseudo || "Utilisateur",
                avatarUrl: user.avatarUrl || null,
                online: true,
              },
              {
                uid: toUid,
                pseudo: targetData.pseudo || "Utilisateur",
                avatarUrl: targetData.avatarUrl || null,
                online: targetData.online || false,
              },
            ],
            lastMessage: "Dis bonjour 👋",
            unread: {
              [user.uid]: 0,
              [toUid]: 0,
            },
            updatedAt: serverTimestamp(),
          });
        }

        setActiveId(convId);
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la conversation :", err);
      }
    }

    initConversation();
  }, [user, toUid, firebaseReady]);


  const active = conversations.find((c) => c.id === activeId) || null;

  function handleStartCall(conversation, kind) {
    setCall({
      peer: { uid: conversation.id, pseudo: conversation.pseudo, avatarUrl: conversation.avatarUrl },
      mode: "caller",
      kind,
    });
  }

  function handleAcceptIncoming(callDoc) {
    setCall({
      peer: { uid: callDoc.fromUid, pseudo: callDoc.fromPseudo || "Justalk" },
      mode: "callee",
      incomingCallId: callDoc.id,
    });
  }

  function handleDeclineIncoming(callDoc) {
    deleteCall(callDoc.id);
  }

  return (
    <div className="min-h-screen pb-4">
      <Header user={user} />
      <IncomingCallBanner call={incomingCall} onAccept={handleAcceptIncoming} onDecline={handleDeclineIncoming} />
      <main className="max-w-6xl mx-auto pt-20 px-3 h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)] pb-16 md:pb-0">
        <div className="flex gap-4 h-full">
          {/* Sur mobile : liste OU chat, jamais les deux. Sur desktop : côte à côte. */}
          <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
            <ConversationList conversations={conversations} activeId={activeId} onSelect={setActiveId} />
          </div>
          <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
            <ChatWindow
              conversation={active}
              user={user}
              onStartCall={handleStartCall}
              onBack={() => setActiveId(null)}
            />
          </div>
        </div>
      </main>

      <MobileNav />

      <VideoCallModal
        open={!!call}
        onClose={() => setCall(null)}
        user={user}
        peer={call?.peer}
        mode={call?.mode || "caller"}
        incomingCallId={call?.incomingCallId}
      />
    </div>
  );
}
