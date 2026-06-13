"use client";
// app/notifications/page.js
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Heart, MessageCircle, UserPlus, Bell } from "lucide-react";

const ICONS = { like: Heart, comment: MessageCircle, friend: UserPlus };

export default function NotificationsPage() {
  const user = useCurrentUser();
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <div className="min-h-screen pb-16">
      <Header user={user} notifCount={notifs.filter((n) => !n.read).length} />
      <MobileNav />
      <main className="max-w-3xl mx-auto pt-20 px-3 flex gap-6">
        <LeftSidebar user={user} />
        <section className="flex-1 flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-slate-800 mb-2">Notifications</h1>
          {notifs.length === 0 && (
            <div className="card-lg p-10 text-center text-slate-400 flex flex-col items-center gap-2">
              <Bell className="text-electric" size={28} />
              Aucune notification pour le moment.
            </div>
          )}
          {notifs.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`card p-4 flex items-center gap-3 ${!n.read ? "border-l-4 border-electric" : ""}`}
              >
                <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center text-electric shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{n.fromPseudo}</span> {n.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{n.createdAtLabel || "À l'instant"}</p>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
