"use client";
// app/stories/page.js
import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function StoriesPage() {
  const { user, sessionReady } = useCurrentUser();
  const [stories, setStories] = useState([]);
  const [index, setIndex] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Écoute des stories actives en temps réel
  async function fetchStories() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setStories(
        data.map((s) => ({
          id: s.id,
          authorId: s.author_id,
          pseudo: s.pseudo,
          avatarUrl: s.avatar_url,
          mediaUrl: s.media_url,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!sessionReady) return;

    fetchStories();

    const channel = supabase
      .channel("stories-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionReady]);

  // Détecte le paramètre de requête 'id' dans l'URL pour sélectionner la story active
  useEffect(() => {
    if (stories.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const storyId = params.get("id");
    if (storyId) {
      const idx = stories.findIndex((s) => s.id === storyId);
      if (idx !== -1) {
        setIndex(idx);
      }
    }
  }, [stories]);

  const active = stories[index];

  // Enregistre une vue de la story active (si ce n'est pas la nôtre)
  useEffect(() => {
    if (!user?.uid || !active?.id || !sessionReady) return;
    if (active.authorId === user.uid) return;

    const viewId = `${user.uid}_${active.id}`;
    
    async function recordView() {
      await supabase.from("story_views").upsert({
        id: viewId,
        story_id: active.id,
        viewer_id: user.uid,
        viewer_pseudo: user.pseudo,
        viewer_avatar_url: user.avatarUrl || null,
      });
    }

    recordView();
  }, [active?.id, user?.uid, sessionReady]);

  // Écoute les personnes ayant vu la story active (uniquement pour le créateur)
  async function fetchViewers() {
    if (!active?.id) return;
    const { data } = await supabase
      .from("story_views")
      .select("*")
      .eq("story_id", active.id)
      .order("created_at", { ascending: false });

    if (data) {
      setViewers(
        data.map((v) => ({
          id: v.id,
          viewerPseudo: v.viewer_pseudo,
          viewerAvatarUrl: v.viewer_avatar_url,
        }))
      );
    }
  }

  useEffect(() => {
    if (!user?.uid || !active?.id || !sessionReady) {
      setViewers([]);
      return;
    }
    if (active.authorId !== user.uid) {
      setViewers([]);
      return;
    }

    fetchViewers();

    const channel = supabase
      .channel(`story-views-${active.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_views", filter: `story_id=eq.${active.id}` },
        () => {
          fetchViewers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [active?.id, user?.uid, sessionReady]);

  return (
    <div className="min-h-screen pb-16 bg-slate-950 text-white">
      <Header user={user} />
      <MobileNav />
      <main className="max-w-md mx-auto pt-20 px-3 flex flex-col items-center">
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            Chargement des stories…
          </div>
        ) : stories.length === 0 ? (
          <div className="card-lg bg-slate-900 border-slate-800 p-10 text-center text-slate-400 mt-10 w-full">
            Aucune story pour le moment.
            <div className="mt-4">
              <Link href="/feed" className="btn-primary py-2 px-4 inline-block text-sm">
                Retour au fil d'actualité
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl bg-black border border-slate-800">
            {/* Visualiseur de story */}
            {active.mediaUrl && (
              active.mediaUrl.includes(".mp4") || active.mediaUrl.includes("video") ? (
                <video src={active.mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.mediaUrl} alt="" className="w-full h-full object-cover" />
              )
            )}

            {/* Auteur et en-tête */}
            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/75 to-transparent flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full ring-2 ring-electric overflow-hidden bg-white/10 flex items-center justify-center font-bold text-sm text-electric">
                  {active.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    active.pseudo?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{active.pseudo}</p>
                  <p className="text-[10px] text-slate-300 mt-1">Story active</p>
                </div>
              </div>
              <Link href="/feed" className="text-slate-300 hover:text-white transition-colors">
                <X size={22} />
              </Link>
            </div>

            {/* Barres de progression */}
            <div className="absolute inset-x-0 top-0 p-3 flex gap-1 z-20">
              {stories.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i === index ? "bg-electric" : i < index ? "bg-white/70" : "bg-white/20"
                  }`}
                />
              ))}
            </div>

            {/* Contrôles de navigation */}
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 icon-btn w-9 h-9 bg-black/40 hover:bg-black/60 text-white border-0 z-10"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {index < stories.length - 1 && (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 icon-btn w-9 h-9 bg-black/40 hover:bg-black/60 text-white border-0 z-10"
              >
                <ChevronRight size={20} />
              </button>
            )}

            {/* Section Vues / Spectateurs (uniquement pour le propriétaire) */}
            {active.authorId === user?.uid && (
              <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-md p-4 text-white border-t border-slate-800 rounded-b-3xl z-10">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2.5">
                  <Eye size={14} className="text-electric" />
                  <span>Vu par {viewers.length} membre{viewers.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                  {viewers.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-electric/20 flex items-center justify-center font-bold text-xs text-electric overflow-hidden shrink-0">
                        {v.viewerAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.viewerAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          v.viewerPseudo?.[0]?.toUpperCase()
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-100">@{v.viewerPseudo}</span>
                    </div>
                  ))}
                  {viewers.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic py-1">Aucune vue pour le moment.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
