"use client";
// components/feed/StoryBar.js
// Barre de stories horizontale en haut du feed, vignettes au format 9:16.
import { Plus } from "lucide-react";

export default function StoryBar({ user, stories = [] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
      {/* Créer une story */}
      <div className="relative shrink-0 w-28 h-44 rounded-2xl overflow-hidden card-lg cursor-pointer group">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-electric text-white flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform">
          <Plus size={20} />
        </div>
        <p className="absolute bottom-2 inset-x-0 text-center text-xs font-semibold text-slate-600">
          Créer
        </p>
      </div>

      {stories.map((s) => (
        <div
          key={s.id}
          className="relative shrink-0 w-28 h-44 rounded-2xl overflow-hidden card-lg cursor-pointer group"
        >
          {s.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.mediaUrl}
              alt={s.pseudo}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-electric to-electric-light" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-2 left-2 w-9 h-9 rounded-full ring-2 ring-electric overflow-hidden bg-white">
            {s.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <p className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white truncate">
            {s.pseudo}
          </p>
        </div>
      ))}
    </div>
  );
}
