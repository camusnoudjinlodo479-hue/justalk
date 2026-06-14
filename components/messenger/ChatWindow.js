"use client";
// components/messenger/ChatWindow.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Send, Smile, Image as ImageIcon, Video, Phone, ArrowLeft } from "lucide-react";

export default function ChatWindow({ conversation, user, onStartCall, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  // Récupération des messages
  async function fetchMessages() {
    if (!conversation?.id) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          senderPseudo: m.sender_pseudo,
          text: m.text,
          createdAt: m.created_at,
        }))
      );
    }
  }

  // Écoute temps réel des messages de la conversation
  useEffect(() => {
    if (!conversation?.id) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !conversation?.id || !user) return;
    const content = text.trim();
    setText("");
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.uid,
        sender_pseudo: user.pseudo,
        text: content,
      });

      if (error) throw error;

      // Met à jour last_message et la date dans conversations
      await supabase
        .from("conversations")
        .update({
          last_message: content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

    } catch (err) {
      console.error("Erreur envoi message :", err);
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 card-lg flex items-center justify-center text-slate-400">
        Sélectionne une discussion pour commencer.
      </div>
    );
  }

  return (
    <div className="flex-1 card-lg flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <button onClick={onBack} className="icon-btn md:hidden -ml-1">
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric overflow-hidden">
          {conversation.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversation.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            conversation.pseudo?.[0]?.toUpperCase()
          )}
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800">{conversation.pseudo}</p>
          <p className="text-xs text-emerald-500">{conversation.online ? "En ligne" : "Hors ligne"}</p>
        </div>
        <div className="flex-1" />
        <button onClick={() => onStartCall?.(conversation, "audio")} className="icon-btn">
          <Phone size={18} />
        </button>
        <button onClick={() => onStartCall?.(conversation, "video")} className="icon-btn">
          <Video size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-bg">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
              m.senderId === user?.uid
                ? "self-end bg-electric text-white rounded-br-sm shadow-glow"
                : "self-start bg-white text-slate-700 rounded-bl-sm shadow-embossed"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex items-center gap-2">
        <button type="button" className="icon-btn">
          <ImageIcon size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris un message…"
          className="input-pill bg-bg flex-1 py-2 text-sm"
        />
        <button type="button" className="icon-btn">
          <Smile size={18} />
        </button>
        <button type="submit" disabled={!text.trim()} className="btn-primary p-2.5">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
