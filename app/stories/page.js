"use client";
// app/stories/page.js
import { useState } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Données de démo — à remplacer par une requête Firestore (collection "stories")
const STORIES = [];

export default function StoriesPage() {
  const user = useCurrentUser();
  const [index, setIndex] = useState(0);
  const active = STORIES[index];

  return (
    <div className="min-h-screen pb-16">
      <Header user={user} />
      <MobileNav />
      <main className="max-w-md mx-auto pt-20 px-3">
        {STORIES.length === 0 ? (
          <div className="card-lg p-10 text-center text-slate-400 mt-10">
            Aucune story pour le moment. Publie la première !
          </div>
        ) : (
          <div className="relative aspect-[9/16] rounded-3xl overflow-hidden shadow-embossed-lg bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.mediaUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 top-0 p-3 flex gap-1">
              {STORIES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= index ? "bg-electric" : "bg-white/30"}`}
                />
              ))}
            </div>
            <button className="absolute top-4 right-4 text-white">
              <X size={22} />
            </button>
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 icon-btn bg-white/80"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(STORIES.length - 1, i + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn bg-white/80"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
