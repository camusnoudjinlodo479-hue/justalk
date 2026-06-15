"use client";
// components/layout/RightSidebar.js
// Affiche en temps réel la liste des membres inscrits sur Justalk
// Permet de leur envoyer une invitation à discuter
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { MessageSquare, Users } from "lucide-react";

export default function RightSidebar() {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { user: currentUser, sessionReady } = useCurrentUser();

  useEffect(() => {
    if (!currentUser?.uid || !sessionReady) return;

    async function fetchMembers() {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (!error && data) {
        const list = data
          .map((u) => ({
            id: u.id,
            pseudo: u.pseudo,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            online: u.online,
          }))
          .filter((u) => u.id !== currentUser.uid);
        setMembers(list);
      }
    }

    fetchMembers();

    // Écoute en temps réel de toute modification sur la table users (inscription, profil, statut en ligne)
    const channel = supabase
      .channel("right-sidebar-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.uid, sessionReady]);

  if (!currentUser) return null;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.pseudo?.toLowerCase().includes(q) ||
      m.displayName?.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="hidden xl:flex flex-col gap-3 w-64 shrink-0 sticky top-20 self-start">
      <div className="flex items-center gap-1.5 px-3 mb-1">
        <Users className="text-electric" size={16} />
        <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wide">
          Membres récents
        </h3>
      </div>

      <div className="px-3 mb-1">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un membre…"
          className="input-pill py-2 px-3 text-xs bg-bg"
        />
      </div>
      
      {filteredMembers.length === 0 && (
        <p className="px-3 text-sm text-slate-400">Aucun membre trouvé.</p>
      )}

      <div className="flex flex-col gap-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
        {filteredMembers.map((m) => (
          <Link
            key={m.id}
            href={`/messenger?to=${m.id}`}
            className="group flex items-center justify-between p-2 rounded-2xl hover:bg-white hover:shadow-embossed border border-transparent hover:border-white/60 transition-all duration-300"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar avec témoin en ligne */}
              <div className="relative w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric text-sm shrink-0 overflow-hidden shadow-sm">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  m.pseudo?.[0]?.toUpperCase() || "U"
                )}
                {m.online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </div>

              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-sm font-semibold text-slate-700 truncate group-hover:text-electric transition-colors">
                  {m.displayName || m.pseudo}
                </span>
                <span className="text-xs text-slate-400 truncate">@{m.pseudo}</span>
              </div>
            </div>

            {/* Bouton d'action Inviter / Discuter */}
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-electric/10 flex items-center justify-center text-slate-400 group-hover:text-electric transition-all duration-300 shadow-sm shrink-0">
              <MessageSquare size={14} />
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
