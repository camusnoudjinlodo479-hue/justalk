"use client";
// app/messenger/page.js
// Messenger : sidebar de conversations + fenêtre de chat temps réel (Firestore onSnapshot).
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
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
  const user = useCurrentUser();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [call, setCall] = useState(null); // { peer, mode, callId }

  const incomingCall = useIncomingCall(user?.uid);

  useEffect(() => {
    if (!user?.uid) return;
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
      if (!activeId && list[0]) setActiveId(list[0].id);
    });
    return () => unsub();
  }, [user?.uid, activeId]);

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
