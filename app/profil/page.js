"use client";
// app/profil/page.js
import { useState } from "react";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Camera, Cake, Link as LinkIcon } from "lucide-react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import PostCard from "@/components/feed/PostCard";
import { useCurrentUser } from "@/lib/useCurrentUser";

const TABS = ["Posts", "À propos", "Amis", "Photos"];

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const fetchedUser = useCurrentUser();
  const [tab, setTab] = useState("Posts");
  const [editOpen, setEditOpen] = useState(false);

  // synchronise l'état local éditable avec la session récupérée
  if (fetchedUser && !user) setUser(fetchedUser);
  const profile = user || fetchedUser;

  return (
    <div className="min-h-screen pb-16">
      <Header user={profile} />
      <MobileNav />
      <main className="max-w-5xl mx-auto pt-20 px-3">
        {/* Cover */}
        <div className="relative h-56 sm:h-72 rounded-3xl overflow-hidden shadow-embossed-lg bg-gradient-to-br from-electric to-electric-light">
          {profile?.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.coverUrl} alt="" className="w-full h-full object-cover" />
          )}
          <button className="absolute bottom-3 right-3 icon-btn bg-white/90">
            <Camera size={16} />
          </button>

          {/* Avatar overlapping */}
          <div className="absolute -bottom-12 left-6 w-28 h-28 rounded-full border-4 border-white bg-electric/10 shadow-embossed-lg overflow-hidden flex items-center justify-center font-bold text-3xl text-electric">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              profile?.pseudo?.[0]?.toUpperCase() || "J"
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mt-16 px-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">
              {profile?.displayName || profile?.pseudo || "@toi"}
            </h1>
            <p className="text-slate-400 text-sm">@{profile?.pseudo}</p>
            <p className="text-slate-500 text-sm mt-1">{profile?.bio || "Aucune bio pour le moment."}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
              {profile?.birthdateVisibility === "public" && profile?.birthdate && (
                <span className="flex items-center gap-1"><Cake size={12} /> {new Date(profile.birthdate).toLocaleDateString("fr-FR")}</span>
              )}
              <span className="flex items-center gap-1"><LinkIcon size={12} /> justalk.app/{profile?.pseudo}</span>
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="btn-ghost">Modifier le profil</button>
        </div>

        <EditProfileModal
          user={profile}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(data) => setUser((prev) => ({ ...prev, ...data }))}
        />

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                tab === t
                  ? "text-electric border-b-2 border-electric"
                  : "text-slate-500 hover:text-electric"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-4 flex gap-6">
          <LeftSidebar user={profile} />
          <section className="flex-1 max-w-2xl mx-auto flex flex-col gap-4">
            {tab === "Posts" && (
              <div className="card-lg p-10 text-center text-slate-400">
                {profile?.pseudo
                  ? `${profile.pseudo} n'a encore rien publié.`
                  : "Aucun post pour le moment."}
              </div>
            )}
            {tab === "À propos" && (
              <div className="card-lg p-6 text-sm text-slate-600">
                <p>Compte créé via authentification biométrique Justalk.</p>
              </div>
            )}
            {tab === "Amis" && (
              <div className="card-lg p-10 text-center text-slate-400">Aucun ami pour le moment.</div>
            )}
            {tab === "Photos" && (
              <div className="card-lg p-10 text-center text-slate-400">Aucune photo pour le moment.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
