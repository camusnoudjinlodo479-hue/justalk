"use client";
// app/feed/page.js
// Fil d'actualité : stories + composeur + posts avec scroll infini (Firestore).
import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import StoryBar from "@/components/feed/StoryBar";
import CreatePost from "@/components/feed/CreatePost";
import PostCard from "@/components/feed/PostCard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Search } from "lucide-react";

const PAGE_SIZE = 5;

export default function FeedPage() {
  const user = useCurrentUser();
  const [posts, setPosts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sentinelRef = useRef(null);

  const filteredPosts = posts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.text?.toLowerCase().includes(q) ||
      p.author?.pseudo?.toLowerCase().includes(q)
    );
  });

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const base = collection(db, "posts");
      const q = lastDoc
        ? query(base, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
        : query(base, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

      const snap = await getDocs(q);
      const newPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts((prev) => [...prev, ...newPosts]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error("Erreur chargement feed:", e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [lastDoc, hasMore, loading]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observer pour scroll infini
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  async function handlePublish({ text, mediaFile }) {
    if (!user) return;
    
    // URL temporaire pour la prévisualisation optimiste locale
    const tempUrl = mediaFile ? URL.createObjectURL(mediaFile) : null;
    const isVideo = mediaFile?.type?.startsWith("video/");

    const optimistic = {
      id: `tmp-${Date.now()}`,
      text,
      authorId: user.uid,
      author: { pseudo: user.pseudo, avatarUrl: user.avatarUrl },
      likes: 0,
      commentsCount: 0,
      shares: 0,
      createdAtLabel: "À l'instant",
      imageUrl: mediaFile && !isVideo ? tempUrl : null,
      videoUrl: mediaFile && isVideo ? tempUrl : null,
    };

    setPosts((prev) => [optimistic, ...prev]);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        try {
          const fileRef = ref(storage, `posts/${user.uid}/${Date.now()}_${mediaFile.name}`);
          const uploadResult = await uploadBytes(fileRef, mediaFile);
          mediaUrl = await getDownloadURL(uploadResult.ref);
          mediaType = isVideo ? "video" : "image";
        } catch (storageErr) {
          console.error("Erreur d'upload Storage :", storageErr);
          alert("L'upload de la photo/vidéo a échoué. Le post sera publié sans média.");
        }
      }

      await addDoc(collection(db, "posts"), {
        text,
        authorId: user.uid,
        author: { pseudo: user.pseudo, avatarUrl: user.avatarUrl || null },
        imageUrl: mediaType === "image" ? mediaUrl : null,
        videoUrl: mediaType === "video" ? mediaUrl : null,
        likes: 0,
        commentsCount: 0,
        shares: 0,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Erreur publication:", e);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Header user={user} />
      <MobileNav />
      <main className="max-w-7xl mx-auto pt-20 px-3 flex gap-6">
        <LeftSidebar user={user} />

        <section className="flex-1 max-w-2xl mx-auto flex flex-col gap-4">
          <StoryBar user={user} stories={[]} />
          <CreatePost user={user} onPublish={handlePublish} />

          {/* Barre de recherche des publications */}
          <div className="card p-3.5 flex items-center gap-3 shadow-sm">
            <Search className="text-slate-400 shrink-0" size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des publications ou par pseudo d'auteur…"
              className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {filteredPosts.length === 0 && !loading && (
            <div className="card-lg p-10 text-center text-slate-400">
              Aucun post pour le moment. Sois le premier à publier !
            </div>
          )}

          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {loading && <span className="text-electric text-sm">Chargement…</span>}
            {!hasMore && posts.length > 0 && (
              <span className="text-slate-400 text-xs">Tu as tout vu ✨</span>
            )}
          </div>
        </section>

        <RightSidebar />
      </main>
    </div>
  );
}
