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
  const { user, sessionReady } = useCurrentUser();
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
          fromUserId: n.from_user_id,
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
    if (!user?.uid || !sessionReady) return;

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
  }, [user?.uid, sessionReady]);

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

  async function handleAccept(notif) {
    if (!user) return;
    try {
      const u1 = notif.fromUserId < user.uid ? notif.fromUserId : user.uid;
      const u2 = notif.fromUserId > user.uid ? notif.fromUserId : user.uid;
      
      const { error: friendErr } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      if (friendErr) throw friendErr;
      
      // Envoyer une notification de confirmation
      await supabase.from("notifications").insert({
        to_user_id: notif.fromUserId,
        from_user_id: user.uid,
        from_pseudo: user.pseudo || "Quelqu'un",
        type: "friend_accept",
        message: "a accepté ta demande d'ami direct",
        read: false,
      });
      
      // Supprimer la notification d'invitation d'origine
      await supabase.from("notifications").delete().eq("id", notif.id);
      
      fetchNotifications();
      alert("Demande d'ami acceptée !");
    } catch (err) {
      alert("Erreur lors de l'acceptation : " + err.message);
    }
  }

  async function handleDecline(notif) {
    if (!user) return;
    try {
      const u1 = notif.fromUserId < user.uid ? notif.fromUserId : user.uid;
      const u2 = notif.fromUserId > user.uid ? notif.fromUserId : user.uid;
      
      const { error: friendErr } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      if (friendErr) throw friendErr;
      
      // Supprimer la notification
      await supabase.from("notifications").delete().eq("id", notif.id);
      
      fetchNotifications();
    } catch (err) {
      alert("Erreur lors du refus : " + err.message);
    }
  }

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
                  {n.type === "friend" && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAccept(n)}
                        className="btn-primary py-1 px-3 text-xs rounded-lg font-semibold border-0 cursor-pointer"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleDecline(n)}
                        className="bg-slate-100 hover:bg-red-100 text-slate-800 py-1 px-3 text-xs rounded-lg font-semibold transition-colors border-0 cursor-pointer"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
