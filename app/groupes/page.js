"use client";
// app/groupes/page.js
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Plus, Users, Shield } from "lucide-react";

export default function GroupesPage() {
  const { user, sessionReady } = useCurrentUser();
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Charge les groupes en temps réel depuis Supabase
  async function fetchGroups() {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGroups(
        data.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          ownerId: g.owner_id,
          membersCount: g.members?.length || 1,
          members: g.members || [],
        }))
      );
    }
  }

  useEffect(() => {
    if (!user?.uid || !sessionReady) return;

    fetchGroups();

    const channel = supabase
      .channel("groups-page-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, sessionReady]);

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const groupName = name.trim();
    setName("");
    setDescription("");
    setShowForm(false);
    try {
      await supabase.from("groups").insert({
        name: groupName,
        description,
        owner_id: user.uid,
        members: [user.uid],
        moderators: [user.uid],
      });
    } catch (err) {
      console.error("Erreur création groupe :", err);
    }
  }

  async function joinGroup(group) {
    if (!user) return;
    if (group.members?.includes(user.uid)) return;
    const updatedMembers = [...group.members, user.uid];
    try {
      await supabase
        .from("groups")
        .update({ members: updatedMembers })
        .eq("id", group.id);
    } catch (err) {
      console.error("Erreur pour rejoindre le groupe :", err);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Header user={user} />
      <MobileNav />
      <main className="max-w-5xl mx-auto pt-20 px-3 flex gap-6">
        <LeftSidebar user={user} />
        <section className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-slate-800">Groupes & Pages</h1>
            <button onClick={() => setShowForm((s) => !s)} className="btn-primary flex items-center gap-2 border-0 cursor-pointer">
              <Plus size={16} /> Créer
            </button>
          </div>

          {showForm && (
            <form onSubmit={createGroup} className="card-lg p-4 flex flex-col gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du groupe"
                className="input-pill bg-bg"
                required
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="input-pill bg-bg resize-none"
              />
              <button type="submit" className="btn-primary self-end border-0 cursor-pointer">Créer le groupe</button>
            </form>
          )}

          {groups.length === 0 ? (
            <div className="card-lg p-10 text-center text-slate-400">
              Aucun groupe pour le moment. Crée-en un ou rejoins-en un existant !
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {groups.map((g) => {
                const isMember = g.members?.includes(user?.uid);
                return (
                  <div key={g.id} className="card-lg p-4 flex flex-col gap-2 bg-white rounded-2xl shadow-sm">
                    <div className="h-24 rounded-xl bg-gradient-to-br from-electric to-electric-light" />
                    <h3 className="font-semibold text-slate-800 mt-2">{g.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{g.description || "Aucune description."}</p>
                    <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><Users size={12} /> {g.membersCount} membre(s)</span>
                      {g.ownerId === user?.uid && (
                        <span className="flex items-center gap-1 text-electric"><Shield size={12} /> Modérateur</span>
                      )}
                    </div>
                    <button
                      onClick={() => joinGroup(g)}
                      disabled={isMember}
                      className={`btn-ghost mt-2 ${isMember ? "opacity-60 cursor-default" : "cursor-pointer"}`}
                    >
                      {isMember ? "Membre" : "Rejoindre"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
