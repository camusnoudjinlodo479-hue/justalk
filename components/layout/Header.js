"use client";
// components/layout/Header.js
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Search, Bell, MessageCircle, Home, Users, X } from "lucide-react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

  // Écoute des nouveaux inscrits
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (!data.createdAt) return;
          const createTime = new Date(data.createdAt).getTime();

          // Nouveau membre inscrit après le chargement de la page, autre que soi-même
          if (createTime > listenerStartTime.current && change.doc.id !== user.uid) {
            setNewUserNotification({ uid: change.doc.id, ...data });

            // Push notification standard
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`${data.displayName || data.pseudo} vient de rejoindre Justalk ! 🚀`, {
                  body: "Cliquez pour lui envoyer une demande de discussion.",
                  icon: data.avatarUrl || "/icons/icon-192.png",
                });
              } catch (e) {
                console.error("Erreur push notification native :", e);
              }
            }
          }
        }
      });
    });

    return () => unsub();
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
                  await addDoc(collection(db, "notifications"), {
                    toUserId: newUserNotification.uid,
                    fromPseudo: user?.pseudo || "Quelqu'un",
                    type: "friend",
                    message: "t'a envoyé une demande d'ami direct (clique pour discuter)",
                    postId: null,
                    read: false,
                    createdAt: serverTimestamp(),
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
