"use client";
// app/profil/page.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Camera, Cake, Link as LinkIcon } from "lucide-react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import PostCard from "@/components/feed/PostCard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const TABS = ["Posts", "À propos", "Amis", "Photos"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const fetchedUser = useCurrentUser();
  const [tab, setTab] = useState("Posts");
  const [editOpen, setEditOpen] = useState(false);
  const [targetUid, setTargetUid] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/session/logout", { method: "POST" });
      await auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Erreur de déconnexion :", err);
    }
  }

  // Détecte le paramètre de requête 'id' dans l'URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setTargetUid(params.get("id"));
    }
  }, []);

  // synchronise l'état local éditable avec la session récupérée
  if (fetchedUser && !user) setUser(fetchedUser);

  // Récupère l'utilisateur ciblé s'il y a un paramètre 'id' dans l'URL et qu'il est différent de l'utilisateur connecté
  useEffect(() => {
    if (!targetUid) {
      setTargetUser(null);
      return;
    }
    if (fetchedUser && targetUid === fetchedUser.uid) {
      setTargetUser(null);
      return;
    }
    
    let active = true;
    const userDocRef = doc(db, "users", targetUid);
    getDoc(userDocRef).then((snap) => {
      if (active && snap.exists()) {
        setTargetUser({ uid: snap.id, ...snap.data() });
      }
    }).catch((err) => {
      console.error("Erreur de récupération du profil :", err);
    });
    
    return () => {
      active = false;
    };
  }, [targetUid, fetchedUser]);

  const profile = targetUser || user || fetchedUser;
  const isMyProfile = !targetUid || (fetchedUser && targetUid === fetchedUser.uid);

  // Récupère les posts de l'utilisateur affiché
  useEffect(() => {
    if (!profile?.uid) return;
    let active = true;
    setLoadingPosts(true);
    
    const postsRef = collection(db, "posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));
    
    getDocs(q).then((snap) => {
      if (!active) return;
      const allPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const userPosts = allPosts.filter((p) => p.authorId === profile.uid);
      setPosts(userPosts);
    }).catch((err) => {
      console.error("Erreur lors de la récupération des posts du profil :", err);
    }).finally(() => {
      if (active) setLoadingPosts(false);
    });
    
    return () => {
      active = false;
    };
  }, [profile?.uid]);

  return (
    <div className="min-h-screen pb-16">
      <Header user={profile} />
      <MobileNav />
      <main className="max-w-5xl mx-auto pt-20 px-3">
        {/* Cover */}
        <div className="relative h-56 sm:h-72 rounded-3xl overflow-hidden shadow-embossed-lg bg-gradient-to-br from-electric to-electric-light">
          {profile?.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="" className="w-full h-full object-cover" />
          )}
          <button className="absolute bottom-3 right-3 icon-btn bg-white/90">
            <Camera size={16} />
          </button>

          {/* Avatar overlapping */}
          <div className="absolute -bottom-12 left-6 w-28 h-28 rounded-full border-4 border-white bg-electric/10 shadow-embossed-lg overflow-hidden flex items-center justify-center font-bold text-3xl text-electric">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
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
          {isMyProfile && (
            <div className="flex gap-2">
              <button onClick={() => setEditOpen(true)} className="btn-ghost">Modifier le profil</button>
              <button onClick={handleLogout} className="btn-ghost border-red-200 text-red-500 hover:border-red-500 hover:bg-red-50">Se déconnecter</button>
            </div>
          )}
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
              <div className="flex flex-col gap-4 w-full">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                
                {posts.length === 0 && !loadingPosts && (
                  <div className="card-lg p-10 text-center text-slate-400 w-full">
                    {profile?.pseudo
                      ? `${profile.pseudo} n'a encore rien publié.`
                      : "Aucun post pour le moment."}
                  </div>
                )}
                
                {loadingPosts && (
                  <div className="text-center py-4 text-electric text-sm w-full">
                    Chargement des publications…
                  </div>
                )}
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
