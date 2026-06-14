"use client";
// components/layout/Header.js
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Search, Bell, MessageCircle, Home, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Header({ user, notifCount = 0 }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newUserNotification, setNewUserNotification] = useState(null);
  const listenerStartTime = useRef(Date.now());

  // Permission de notifications push
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Écoute des nouveaux inscrits via Supabase Realtime
  useEffect(() => {
    if (!user?.uid) return;

    const channel = supabase
      .channel("new-users-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "users" },
        (payload) => {
          const newUser = payload.new;
          if (!newUser.created_at) return;
          const createTime = new Date(newUser.created_at).getTime();

          // Nouveau membre inscrit après le chargement de la page, autre que soi-même
          if (createTime > listenerStartTime.current && newUser.id !== user.uid) {
            const formattedUser = {
              uid: newUser.id,
              pseudo: newUser.pseudo,
              displayName: newUser.display_name,
              avatarUrl: newUser.avatar_url,
            };
            setNewUserNotification(formattedUser);

            // Push notification standard
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`${newUser.display_name || newUser.pseudo} vient de rejoindre Justalk ! 🚀`, {
                  body: "Cliquez pour lui envoyer une demande de discussion.",
                  icon: newUser.avatar_url || "/icons/icon-192.png",
                });
              } catch (e) {
                console.error("Erreur push notification native :", e);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);

  // Auto-dismiss de la notification après 10s
  useEffect(() => {
    if (!newUserNotification) return;
    const timer = setTimeout(() => {
      setNewUserNotification(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [newUserNotification]);

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white shadow-embossed z-40">
      <div className="h-full max-w-7xl mx-auto px-3 flex items-center justify-between gap-3">
        {/* Left: logo + search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/feed" className="shrink-0">
            <Logo size={36} withWordmark={false} />
          </Link>
          <div className="relative hidden sm:block w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher sur Justalk"
              className="input-pill pl-9 py-2 text-sm bg-bg"
            />
          </div>
        </div>

        {/* Center: nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          <NavIcon href="/feed" icon={Home} label="Fil d'actualité" />
          <NavIcon href="/groupes" icon={Users} label="Groupes" />
          <NavIcon href="/messenger" icon={MessageCircle} label="Messenger" />
        </nav>

        {/* Right: notifications + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/notifications" className="icon-btn relative">
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-electric text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </Link>
          <Link href="/profil" className="w-10 h-10 rounded-full overflow-hidden shadow-embossed bg-electric/10 flex items-center justify-center">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.pseudo} className="w-full h-full object-cover" />
            ) : (
              <span className="text-electric font-bold text-sm">
                {user?.pseudo?.[0]?.toUpperCase() || "J"}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Bandeau de notification "Nouveau Membre" */}
      {newUserNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-top duration-300">
          <div className="card p-4 shadow-glow flex items-center gap-3 bg-white/95 backdrop-blur-md border border-electric/20 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric overflow-hidden shrink-0">
              {newUserNotification.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={newUserNotification.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                newUserNotification.pseudo?.[0]?.toUpperCase()
              )}
            </div>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                window.location.href = `/profil?id=${newUserNotification.uid}`;
                setNewUserNotification(null);
              }}
            >
              <p className="text-sm font-semibold text-slate-800 hover:underline truncate">
                {newUserNotification.displayName || newUserNotification.pseudo}
              </p>
              <p className="text-xs text-slate-400">vient de rejoindre Justalk</p>
            </div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await supabase.from("notifications").insert({
                    to_user_id: newUserNotification.uid,
                    from_pseudo: user?.pseudo || "Quelqu'un",
                    type: "friend",
                    message: "t'a envoyé une demande d'ami direct (clique pour discuter)",
                    read: false,
                  });
                } catch (err) {
                  console.error("Erreur envoi demande d'ami :", err);
                }
                // Redirige vers Messenger
                window.location.href = `/messenger?to=${newUserNotification.uid}`;
                setNewUserNotification(null);
              }}
              className="btn-primary px-3 py-1.5 text-xs font-semibold shrink-0"
            >
              Ajouter
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNewUserNotification(null);
              }}
              className="icon-btn w-6 h-6 text-slate-400 hover:text-slate-600 shrink-0 border-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function NavIcon({ href, icon: Icon, label }) {
  return (
    <Link href={href} title={label} className="icon-btn w-12 h-12">
      <Icon size={20} />
    </Link>
  );
}
