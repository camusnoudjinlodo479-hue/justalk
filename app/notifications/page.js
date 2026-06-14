"use client";
// app/notifications/page.js
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Heart, MessageCircle, UserPlus, Bell } from "lucide-react";

const ICONS = { like: Heart, comment: MessageCircle, friend: UserPlus };

export default function NotificationsPage() {
  const { user, firebaseReady } = useCurrentUser();
  const [notifs, setNotifs] = useState([]);

  // Récupère les notifications depuis Supabase
  async function fetchNotifications() {
    if (!user?.uid) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("to_user_id", user.uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifs(
        data.map((n) => ({
          id: n.id,
          toUserId: n.to_user_id,
          fromPseudo: n.from_pseudo,
          type: n.type,
          message: n.message,
          read: n.read,
          createdAt: n.created_at,
        }))
      );
    }
  }

  // Écoute les notifications en temps réel
  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${user.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `to_user_id=eq.${user.uid}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, firebaseReady]);

  // Marque toutes les notifications non lues comme lues à l'ouverture de la page
  useEffect(() => {
    if (!user?.uid || notifs.length === 0) return;

    const unreadIds = notifs.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds)
        .then(() => {
          // Re-fetch pour actualiser l'affichage local et le Header
          fetchNotifications();
        });
    }
  }, [notifs.length, user?.uid]);

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
                  <p className="text-xs text-slate-400 mt-0.5">Notification reçue</p>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
