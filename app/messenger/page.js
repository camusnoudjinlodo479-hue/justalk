"use client";
// app/messenger/page.js
// Messenger : sidebar de conversations + fenêtre de chat temps réel (Supabase).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  const { user, sessionReady } = useCurrentUser();
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

  // Charge et écoute les conversations
  async function fetchConversations() {
    if (!user?.uid) return;
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .contains("members", [user.uid])
      .order("updated_at", { ascending: false });

    if (!error && data) {
      const list = data.map((conv) => {
        const other = (conv.member_profiles || []).find((m) => m.uid !== user.uid) || {};
        return {
          id: conv.id,
          pseudo: other.pseudo || "Utilisateur",
          avatarUrl: other.avatarUrl,
          online: other.online,
          lastMessage: conv.last_message,
          unread: conv.unread?.[user.uid] || 0,
        };
      });
      setConversations(list);

      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const hasToParam = params?.has("to");
      if (!activeId && !hasToParam && list[0]) {
        setActiveId(list[0].id);
      }
    }
  }

  useEffect(() => {
    if (!user?.uid || !sessionReady) return;

    fetchConversations();

    // S'abonne aux modifications en temps réel sur la table conversations
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, activeId, sessionReady]);

  // Gère l'initialisation de la conversation par rapport à toUid
  useEffect(() => {
    if (!user?.uid || !toUid || !sessionReady) return;

    async function initConversation() {
      try {
        // Recherche si une conversation existe déjà entre ces deux membres
        const { data: existing } = await supabase
          .from("conversations")
          .select("*")
          .contains("members", [user.uid, toUid]);

        if (existing && existing.length > 0) {
          setActiveId(existing[0].id);
        } else {
          // Sinon récupère les infos du membre pour créer la conversation
          const { data: targetUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", toUid)
            .maybeSingle();

          if (!targetUser) return;

          const { data: newConv, error } = await supabase
            .from("conversations")
            .insert({
              members: [user.uid, toUid],
              member_profiles: [
                {
                  uid: user.uid,
                  pseudo: user.pseudo || "Utilisateur",
                  avatarUrl: user.avatarUrl || null,
                  online: true,
                },
                {
                  uid: toUid,
                  pseudo: targetUser.pseudo || "Utilisateur",
                  avatarUrl: targetUser.avatar_url || null,
                  online: targetUser.online || false,
                },
              ],
              last_message: "Dis bonjour 👋",
              unread: {
                [user.uid]: 0,
                [toUid]: 0,
              },
            })
            .select()
            .single();

          if (newConv) {
            setActiveId(newConv.id);
            fetchConversations();
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la conversation :", err);
      }
    }

    initConversation();
  }, [user, toUid, sessionReady]);

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
