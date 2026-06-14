"use client";
// app/feed/page.js
// Fil d'actualité : stories + composeur + posts avec scroll infini (Supabase).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import StoryBar from "@/components/feed/StoryBar";
import CreatePost from "@/components/feed/CreatePost";
import PostCard from "@/components/feed/PostCard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { Search } from "lucide-react";

export default function FeedPage() {
  const { user, firebaseReady } = useCurrentUser();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [usersMap, setUsersMap] = useState({});
  const [myLikes, setMyLikes] = useState({});
  const [stories, setStories] = useState([]);

  // Récupération initiale des posts
  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (!error && data) {
      const mapped = data.map((p) => ({
        id: p.id,
        authorId: p.author_id,
        text: p.text,
        imageUrl: p.image_url,
        videoUrl: p.video_url,
        likes: p.likes,
        commentsCount: p.comments_count,
        shares: p.shares,
        createdAt: p.created_at,
      }));
      setPosts(mapped);
    }
    setLoading(false);
  }

  // Écoute des posts en temps réel
  useEffect(() => {
    if (!firebaseReady || !user?.uid) return;

    fetchPosts();

    const channel = supabase
      .channel("posts-realtime-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [firebaseReady, user?.uid]);

  // Récupération et écoute des profils utilisateurs
  async function fetchUsers() {
    const { data } = await supabase.from("users").select("*");
    if (data) {
      const map = {};
      data.forEach((u) => {
        map[u.id] = {
          pseudo: u.pseudo,
          avatarUrl: u.avatar_url,
          displayName: u.display_name,
        };
      });
      setUsersMap(map);
    }
  }

  useEffect(() => {
    if (!firebaseReady) return;

    fetchUsers();

    const channel = supabase
      .channel("users-realtime-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [firebaseReady]);

  // Récupération et écoute des likes de l'utilisateur connecté
  async function fetchMyLikes() {
    if (!user?.uid) return;
    const { data } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", user.uid);
    
    if (data) {
      const likesMap = {};
      data.forEach((l) => {
        likesMap[l.post_id] = true;
      });
      setMyLikes(likesMap);
    }
  }

  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;

    fetchMyLikes();

    const channel = supabase
      .channel("likes-realtime-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes", filter: `user_id=eq.${user.uid}` },
        () => {
          fetchMyLikes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, firebaseReady]);

  // Récupération et écoute des stories
  async function fetchStories() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (data) {
      setStories(
        data.map((s) => ({
          id: s.id,
          authorId: s.author_id,
          pseudo: s.pseudo,
          avatarUrl: s.avatar_url,
          mediaUrl: s.media_url,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        }))
      );
    }
  }

  useEffect(() => {
    if (!firebaseReady) return;

    fetchStories();

    const channel = supabase
      .channel("stories-realtime-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [firebaseReady]);

  // Gère le like/unlike d'une publication
  async function handleLike(postId, isLiked) {
    if (!user) return;
    try {
      if (isLiked) {
        await supabase.from("likes").insert({
          user_id: user.uid,
          post_id: postId,
        });
      } else {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.uid)
          .eq("post_id", postId);
      }
    } catch (err) {
      console.error("Erreur de basculement du like :", err);
    }
  }

  // Publie une story
  async function handleCreateStory(file) {
    if (!user) return;
    try {
      const filePath = `stories/${user.uid}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("justalk")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("justalk")
        .getPublicUrl(filePath);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("stories").insert({
        author_id: user.uid,
        pseudo: user.pseudo,
        avatar_url: user.avatarUrl || null,
        media_url: publicUrl,
        expires_at: expiresAt,
      });

      if (insertError) throw insertError;
    } catch (err) {
      console.error("Erreur création story :", err);
      alert("L'upload de la story a échoué.");
    }
  }

  // Publie un post
  async function handlePublish({ text, mediaFile }) {
    if (!user) return;
    
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
      if (mediaFile) {
        try {
          const filePath = `posts/${user.uid}/${Date.now()}_${mediaFile.name}`;
          const { error: uploadError } = await supabase.storage
            .from("justalk")
            .upload(filePath, mediaFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("justalk")
            .getPublicUrl(filePath);

          mediaUrl = publicUrl;
        } catch (storageErr) {
          console.error("Erreur d'upload Storage :", storageErr);
          alert("L'upload a échoué. Publication sans média.");
        }
      }

      await supabase.from("posts").insert({
        author_id: user.uid,
        text,
        image_url: !isVideo ? mediaUrl : null,
        video_url: isVideo ? mediaUrl : null,
      });
    } catch (e) {
      console.error("Erreur publication:", e);
    }
  }

  const filteredPosts = posts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const resolvedAuthor = usersMap[p.authorId];
    return (
      p.text?.toLowerCase().includes(q) ||
      resolvedAuthor?.pseudo?.toLowerCase().includes(q)
    );
  });

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
            const resolvedAuthor = usersMap[post.authorId];
            const postWithResolvedAuthor = {
              ...post,
              author: {
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
