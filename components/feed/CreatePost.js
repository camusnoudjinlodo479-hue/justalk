"use client";
// components/feed/CreatePost.js
import { useState, useRef } from "react";
import { Image as ImageIcon, Smile, Send, X } from "lucide-react";

export default function CreatePost({ user, onPublish }) {
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(""); // "image" or "video"

  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    if (file.type.startsWith("video/")) {
      setMediaType("video");
    } else {
      setMediaType("image");
    }
  }

  function handleRemoveMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() && !mediaFile) return;

    onPublish?.({ text: text.trim(), mediaFile });
    
    setText("");
    handleRemoveMedia();
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
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Quoi de neuf, ${user?.pseudo || ""} ?`}
            rows={2}
            className="input-pill resize-none bg-bg flex-1"
          />

          {/* Prévisualisation média */}
          {mediaPreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden bg-bg max-h-[300px] flex items-center justify-center">
              {mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPreview} alt="Aperçu" className="max-h-[300px] object-contain w-full" />
              ) : (
                <video src={mediaPreview} controls className="max-h-[300px] object-contain w-full" />
              )}
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex gap-2">
          {/* Input fichier caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="icon-btn"
            title="Ajouter une photo ou vidéo"
          >
            <ImageIcon size={18} />
          </button>
          <button type="button" className="icon-btn" title="Émojis">
            <Smile size={18} />
          </button>
        </div>
        <button
          type="submit"
          disabled={!text.trim() && !mediaFile}
          className="btn-primary flex items-center gap-2"
        >
          Publier <Send size={16} />
        </button>
      </div>
    </form>
  );
}

