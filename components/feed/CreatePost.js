"use client";
// components/feed/CreatePost.js
import { useState } from "react";
import { Image as ImageIcon, Smile, Send } from "lucide-react";

export default function CreatePost({ user, onPublish }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onPublish?.({ text: text.trim() });
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="card-lg p-4">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric shrink-0 overflow-hidden">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            user?.pseudo?.[0]?.toUpperCase() || "J"
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Quoi de neuf, ${user?.pseudo || ""} ?`}
          rows={2}
          className="input-pill resize-none bg-bg flex-1"
        />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex gap-2">
          <button type="button" className="icon-btn">
            <ImageIcon size={18} />
          </button>
          <button type="button" className="icon-btn">
            <Smile size={18} />
          </button>
        </div>
        <button type="submit" disabled={!text.trim()} className="btn-primary flex items-center gap-2">
          Publier <Send size={16} />
        </button>
      </div>
    </form>
  );
}
