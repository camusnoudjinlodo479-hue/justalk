"use client";
// app/groupes/page.js
import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Plus, Users, Shield } from "lucide-react";

export default function GroupesPage() {
  const { user, firebaseReady } = useCurrentUser();
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Charge les groupes en temps réel
  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;
    const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        membersCount: d.data().members?.length || 1
      })));
    });
    return () => unsub();
  }, [user?.uid, firebaseReady]);

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const tempId = `tmp-${Date.now()}`;
    const newGroup = {
      id: tempId,
      name: name.trim(),
      description,
      membersCount: 1,
      ownerId: user.uid,
    };
    setName("");
    setDescription("");
    setShowForm(false);
    try {
      await addDoc(collection(db, "groups"), {
        name: newGroup.name,
        description,
        ownerId: user.uid,
        members: [user.uid],
        moderators: [user.uid],
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Erreur création groupe:", err);
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
            <button onClick={() => setShowForm((s) => !s)} className="btn-primary flex items-center gap-2">
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
              <button type="submit" className="btn-primary self-end">Créer le groupe</button>
            </form>
          )}

          {groups.length === 0 ? (
            <div className="card-lg p-10 text-center text-slate-400">
              Aucun groupe pour le moment. Crée-en un ou rejoins-en un existant !
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {groups.map((g) => (
                <div key={g.id} className="card-lg p-4 flex flex-col gap-2">
                  <div className="h-24 rounded-xl bg-gradient-to-br from-electric to-electric-light" />
                  <h3 className="font-semibold text-slate-800">{g.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">{g.description || "Aucune description."}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Users size={12} /> {g.membersCount} membre(s)</span>
                    {g.ownerId === user?.uid && (
                      <span className="flex items-center gap-1 text-electric"><Shield size={12} /> Modérateur</span>
                    )}
                  </div>
                  <button className="btn-ghost mt-2">Rejoindre</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
