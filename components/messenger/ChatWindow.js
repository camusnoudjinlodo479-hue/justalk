"use client";
// components/messenger/ChatWindow.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Send, Smile, Image as ImageIcon, Video, Phone, ArrowLeft, Mic, MicOff } from "lucide-react";

export default function ChatWindow({ conversation, user, onStartCall, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const imageInputRef = useRef(null);

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
          imageUrl: m.image_url,
          audioUrl: m.audio_url,
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await uploadAudioMessage(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert("Impossible d'accéder au microphone : " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function uploadAudioMessage(blob) {
    if (!conversation?.id || !user) return;
    try {
      const filePath = `messages/${conversation.id}/${user.uid}-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("justalk")
        .upload(filePath, blob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("justalk")
        .getPublicUrl(filePath);

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.uid,
        sender_pseudo: user.pseudo,
        text: "🎵 Message vocal",
        audio_url: publicUrl,
      });

      await supabase
        .from("conversations")
        .update({
          last_message: "🎵 Message vocal",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
    } catch (err) {
      alert("Erreur lors de l'envoi de la note vocale : " + err.message);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !conversation?.id || !user) return;
    try {
      const filePath = `messages/${conversation.id}/${user.uid}-${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("justalk")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("justalk")
        .getPublicUrl(filePath);

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.uid,
        sender_pseudo: user.pseudo,
        text: "📷 Photo",
        image_url: publicUrl,
      });

      await supabase
        .from("conversations")
        .update({
          last_message: "📷 Photo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
    } catch (err) {
      alert("Erreur lors de l'envoi de la photo : " + err.message);
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

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 bg-bg">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] p-3 rounded-2xl text-sm flex flex-col gap-1 ${
              m.senderId === user?.uid
                ? "self-end bg-electric text-white rounded-br-sm shadow-glow"
                : "self-start bg-white text-slate-700 rounded-bl-sm shadow-embossed"
            }`}
          >
            {m.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imageUrl} alt="Message photo" className="max-w-full rounded-xl object-cover max-h-60" />
            ) : m.audioUrl ? (
              <audio src={m.audioUrl} controls className="max-w-full rounded-lg" />
            ) : (
              m.text
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex items-center gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <button type="button" onClick={() => imageInputRef.current?.click()} className="icon-btn">
          <ImageIcon size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris un message…"
          className="input-pill bg-bg flex-1 py-2 text-sm"
        />
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={`icon-btn transition-colors ${recording ? "bg-red-50 text-red-500 hover:bg-red-100" : ""}`}
        >
          {recording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
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
