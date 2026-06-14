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
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  increment,
  where,
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
  const { user, firebaseReady } = useCurrentUser();
  const [posts, setPosts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sentinelRef = useRef(null);

  const [usersMap, setUsersMap] = useState({});
  const [myLikes, setMyLikes] = useState({});
  const [stories, setStories] = useState([]);

  // Écoute des utilisateurs en temps réel
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setUsersMap(map);
    });
    return () => unsub();
  }, [firebaseReady]);

  // Écoute des likes de l'utilisateur connecté en temps réel
  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;
    const q = query(collection(db, "likes"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const likesMap = {};
      snap.docs.forEach((d) => {
        likesMap[d.data().postId] = true;
      });
      setMyLikes(likesMap);
    }, (err) => {
      console.error("Erreur likes sync:", err);
    });
    return () => unsub();
  }, [user?.uid, firebaseReady]);

  // Écoute des stories actives en temps réel
  useEffect(() => {
    if (!firebaseReady) return;
    const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const activeStories = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => {
          const expiresAt = s.expiresAt?.toDate ? s.expiresAt.toDate() : new Date(s.expiresAt);
          return expiresAt > new Date();
        });
      setStories(activeStories);
    }, (err) => {
      console.error("Erreur stories sync:", err);
    });
    return () => unsub();
  }, [firebaseReady]);

  async function handleLike(postId, isLiked) {
    if (!user) return;
    const likeId = `${user.uid}_${postId}`;
    const likeRef = doc(db, "likes", likeId);
    const postRef = doc(db, "posts", postId);
    try {
      if (isLiked) {
        await setDoc(likeRef, { userId: user.uid, postId, createdAt: serverTimestamp() });
        await updateDoc(postRef, { likes: increment(1) });
      } else {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likes: increment(-1) });
      }
    } catch (err) {
      console.error("Erreur like toggle:", err);
    }
  }

  async function handleCreateStory(file) {
    if (!user) return;
    try {
      const fileRef = ref(storage, `stories/${user.uid}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const mediaUrl = await getDownloadURL(uploadResult.ref);
      
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24h later

      await addDoc(collection(db, "stories"), {
        authorId: user.uid,
        pseudo: user.pseudo,
        avatarUrl: user.avatarUrl || null,
        mediaUrl,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
      });
    } catch (err) {
      console.error("Erreur création story :", err);
      alert("L'upload de la story a échoué.");
    }
  }

  const filteredPosts = posts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.text?.toLowerCase().includes(q) ||
      p.author?.pseudo?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;
    setLoading(true);
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Erreur chargement posts en temps réel :", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid, firebaseReady]);

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
          <StoryBar user={user} stories={stories} onPublishStory={handleCreateStory} />
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

          {filteredPosts.map((post) => {
            const resolvedAuthor = usersMap[post.authorId] || post.author;
            const postWithResolvedAuthor = {
              ...post,
              author: {
                ...post.author,
                pseudo: resolvedAuthor?.pseudo || post.author?.pseudo || "Utilisateur",
                avatarUrl: resolvedAuthor?.avatarUrl || post.author?.avatarUrl || null,
              },
              likedByMe: !!myLikes[post.id],
            };
            return (
              <PostCard
                key={post.id}
                post={postWithResolvedAuthor}
                onLike={handleLike}
              />
            );
          })}

          {filteredPosts.length === 0 && !loading && (
            <div className="card-lg p-10 text-center text-slate-400">
              Aucun post pour le moment. Sois le premier à publier !
            </div>
          )}

          <div className="h-10 flex items-center justify-center">
            {loading && <span className="text-electric text-sm">Chargement…</span>}
            {!loading && filteredPosts.length > 0 && (
              <span className="text-slate-400 text-xs">Tu as tout vu ✨</span>
            )}
          </div>
        </section>

        <RightSidebar />
      </main>
    </div>
  );
}
