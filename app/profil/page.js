"use client";
// app/profil/page.js
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Camera, Cake, Link as LinkIcon, Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import PostCard from "@/components/feed/PostCard";
import CreatePost from "@/components/feed/CreatePost";
import { useCurrentUser } from "@/lib/useCurrentUser";

const TABS = ["Publications", "À propos", "Amis", "Photos"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { user: fetchedUser, sessionReady } = useCurrentUser();
  const [tab, setTab] = useState("Publications");
  const [editOpen, setEditOpen] = useState(false);
  const [targetUid, setTargetUid] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [usersMap, setUsersMap] = useState({});
  const [myLikes, setMyLikes] = useState({});
  const [recentMembers, setRecentMembers] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const storyFileRef = useRef(null);

  const [friendshipStatus, setFriendshipStatus] = useState(null);
  const [friendshipSender, setFriendshipSender] = useState(null);

  async function handleLogout() {
    try {
      await fetch("/api/session/logout", { method: "POST" });
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

  const profile = targetUser || user || fetchedUser;
  const isMyProfile = !targetUid || (fetchedUser && targetUid === fetchedUser.uid);

  // Écoute de l'utilisateur affiché en temps réel via Supabase
  async function fetchProfile() {
    if (!profile?.uid) return;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", profile.uid)
      .maybeSingle();

    if (data) {
      const formatted = {
        uid: data.id,
        pseudo: data.pseudo,
        firstName: data.first_name,
        lastName: data.last_name,
        displayName: data.display_name,
        bio: data.bio,
        avatarUrl: data.avatar_url,
        coverUrl: data.cover_url,
        birthdate: data.birthdate,
        birthdateVisibility: data.birthdate_visibility,
        online: data.online,
        createdAt: data.created_at,
      };
      if (isMyProfile) {
        setUser(formatted);
      } else {
        setTargetUser(formatted);
      }
    }
  }

  useEffect(() => {
    if (!profile?.uid || !sessionReady) return;

    fetchProfile();

    const channel = supabase
      .channel(`profile-realtime-${profile.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users", filter: `id=eq.${profile.uid}` },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.uid, isMyProfile, sessionReady]);

  // Écoute des utilisateurs (pour pseudos/avatars)
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
    if (!sessionReady) return;

    fetchUsers();

    const channel = supabase
      .channel("users-profile-changes")
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
  }, [sessionReady]);

  // Écoute des likes
  async function fetchMyLikes() {
    if (!fetchedUser?.uid) return;
    const { data } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", fetchedUser.uid);

    if (data) {
      const likesMap = {};
      data.forEach((l) => {
        likesMap[l.post_id] = true;
      });
      setMyLikes(likesMap);
    }
  }

  useEffect(() => {
    if (!fetchedUser?.uid || !sessionReady) return;

    fetchMyLikes();

    const channel = supabase
      .channel(`likes-profile-${fetchedUser.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes", filter: `user_id=eq.${fetchedUser.uid}` },
        () => {
          fetchMyLikes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchedUser?.uid, sessionReady]);

  // Écoute des membres récents pour la box Amis
  async function fetchRecentMembers() {
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);

    if (data) {
      const list = data
        .map((u) => ({
          id: u.id,
          pseudo: u.pseudo,
          displayName: u.display_name,
          avatarUrl: u.avatar_url,
        }))
        .filter((u) => u.id !== profile?.uid);
      setRecentMembers(list);
    }

    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    
    const totalFriends = count ? Math.max(0, count - 1) : 0;
    setFriendCount(totalFriends);
  }

  useEffect(() => {
    if (!profile?.uid || !sessionReady) return;

    fetchRecentMembers();

    const channel = supabase
      .channel("recent-members-profile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchRecentMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.uid, sessionReady]);

  async function fetchFriendship() {
    if (!fetchedUser?.uid || !profile?.uid || isMyProfile) return;
    
    const { data, error } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(user_id_1.eq.${fetchedUser.uid},user_id_2.eq.${profile.uid}),and(user_id_1.eq.${profile.uid},user_id_2.eq.${fetchedUser.uid})`)
      .maybeSingle();
      
    if (!error && data) {
      setFriendshipStatus(data.status);
      setFriendshipSender(data.sender_id);
    } else {
      setFriendshipStatus(null);
      setFriendshipSender(null);
    }
  }

  useEffect(() => {
    if (fetchedUser?.uid && profile?.uid && !isMyProfile && sessionReady) {
      fetchFriendship();
      
      const channel = supabase
        .channel(`friendships-profile-${profile.uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships" },
          () => {
            fetchFriendship();
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchedUser?.uid, profile?.uid, isMyProfile, sessionReady]);

  async function sendFriendRequest() {
    if (!fetchedUser || !profile) return;
    try {
      const u1 = fetchedUser.uid < profile.uid ? fetchedUser.uid : profile.uid;
      const u2 = fetchedUser.uid > profile.uid ? fetchedUser.uid : profile.uid;
      
      const { error: friendErr } = await supabase.from("friendships").insert({
        user_id_1: u1,
        user_id_2: u2,
        sender_id: fetchedUser.uid,
        status: "pending",
      });
      if (friendErr) throw friendErr;
      
      const { error: notifErr } = await supabase.from("notifications").insert({
        to_user_id: profile.uid,
        from_user_id: fetchedUser.uid,
        from_pseudo: fetchedUser.pseudo || "Quelqu'un",
        type: "friend",
        message: "t'a envoyé une demande d'ami direct",
        read: false,
      });
      if (notifErr) throw notifErr;
      
      fetchFriendship();
    } catch (err) {
      alert("Erreur lors de l'envoi de la demande d'ami : " + err.message);
    }
  }

  async function cancelFriendRequest() {
    if (!fetchedUser || !profile) return;
    try {
      const u1 = fetchedUser.uid < profile.uid ? fetchedUser.uid : profile.uid;
      const u2 = fetchedUser.uid > profile.uid ? fetchedUser.uid : profile.uid;
      
      await supabase
        .from("friendships")
        .delete()
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      await supabase
        .from("notifications")
        .delete()
        .eq("to_user_id", profile.uid)
        .eq("from_user_id", fetchedUser.uid)
        .eq("type", "friend");
        
      fetchFriendship();
    } catch (err) {
      alert("Erreur lors de l'annulation de la demande : " + err.message);
    }
  }

  async function acceptFriendRequest() {
    if (!fetchedUser || !profile) return;
    try {
      const u1 = fetchedUser.uid < profile.uid ? fetchedUser.uid : profile.uid;
      const u2 = fetchedUser.uid > profile.uid ? fetchedUser.uid : profile.uid;
      
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      await supabase.from("notifications").insert({
        to_user_id: profile.uid,
        from_user_id: fetchedUser.uid,
        from_pseudo: fetchedUser.pseudo || "Quelqu'un",
        type: "friend_accept",
        message: "a accepté ta demande d'ami direct",
        read: false,
      });
      
      fetchFriendship();
    } catch (err) {
      alert("Erreur lors de l'acceptation : " + err.message);
    }
  }

  async function declineFriendRequest() {
    if (!fetchedUser || !profile) return;
    try {
      const u1 = fetchedUser.uid < profile.uid ? fetchedUser.uid : profile.uid;
      const u2 = fetchedUser.uid > profile.uid ? fetchedUser.uid : profile.uid;
      
      await supabase
        .from("friendships")
        .delete()
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      fetchFriendship();
    } catch (err) {
      alert("Erreur lors du refus : " + err.message);
    }
  }

  async function removeFriend() {
    if (!confirm("Retirer cette personne de vos amis ?")) return;
    try {
      const u1 = fetchedUser.uid < profile.uid ? fetchedUser.uid : profile.uid;
      const u2 = fetchedUser.uid > profile.uid ? fetchedUser.uid : profile.uid;
      
      await supabase
        .from("friendships")
        .delete()
        .eq("user_id_1", u1)
        .eq("user_id_2", u2);
        
      fetchFriendship();
    } catch (err) {
      alert("Erreur lors de la suppression de l'ami : " + err.message);
    }
  }

  // Écoute des posts de l'utilisateur affiché
  async function fetchProfilePosts() {
    if (!profile?.uid) return;
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("author_id", profile.uid)
      .order("created_at", { ascending: false });

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
    setLoadingPosts(false);
  }

  useEffect(() => {
    if (!profile?.uid || !sessionReady) return;

    fetchProfilePosts();

    const channel = supabase
      .channel(`posts-profile-${profile.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchProfilePosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.uid, sessionReady]);

  async function handleLike(postId, isLiked) {
    if (!fetchedUser) return;
    try {
      if (isLiked) {
        await supabase.from("likes").insert({
          user_id: fetchedUser.uid,
          post_id: postId,
        });
      } else {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", fetchedUser.uid)
          .eq("post_id", postId);
      }
    } catch (err) {
      console.error("Erreur like toggle :", err);
    }
  }

  async function handlePublish({ text, mediaFile }) {
    if (!fetchedUser) return;
    
    const tempUrl = mediaFile ? URL.createObjectURL(mediaFile) : null;
    const isVideo = mediaFile?.type?.startsWith("video/");

    const optimistic = {
      id: `tmp-${Date.now()}`,
      text,
      authorId: fetchedUser.uid,
      author: { pseudo: fetchedUser.pseudo, avatarUrl: fetchedUser.avatarUrl },
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
          const filePath = `posts/${fetchedUser.uid}/${Date.now()}_${mediaFile.name}`;
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
        author_id: fetchedUser.uid,
        text,
        image_url: !isVideo ? mediaUrl : null,
        video_url: isVideo ? mediaUrl : null,
      });
    } catch (e) {
      console.error("Erreur publication:", e);
    }
  }

  async function handleCreateStory(file) {
    if (!fetchedUser) return;
    try {
      const filePath = `stories/${fetchedUser.uid}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("justalk")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("justalk")
        .getPublicUrl(filePath);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("stories").insert({
        author_id: fetchedUser.uid,
        pseudo: fetchedUser.pseudo,
        avatar_url: fetchedUser.avatarUrl || null,
        media_url: publicUrl,
        expires_at: expiresAt,
      });

      if (insertError) throw insertError;
      alert("Story publiée avec succès !");
    } catch (err) {
      console.error("Erreur création story :", err);
      alert("L'upload de la story a échoué.");
    }
  }

  const photos = posts.map((p) => p.imageUrl).filter((url) => !!url);

  return (
    <div className="min-h-screen pb-16 bg-bg">
      <Header user={fetchedUser} />
      <MobileNav />
      
      <main className="max-w-5xl mx-auto pt-16">
        {/* Cover Photo */}
        <div className="relative w-full h-48 sm:h-64 md:h-80 bg-slate-200 rounded-b-3xl overflow-hidden shadow-embossed-lg">
          {profile?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="Couverture" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-500" />
          )}
          {isMyProfile && (
            <button
              onClick={() => setEditOpen(true)}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs font-semibold backdrop-blur-sm transition-colors border-0 cursor-pointer"
            >
              <Camera size={14} /> Modifier la couverture
            </button>
          )}
        </div>

        {/* Profile Info Header overlapping */}
        <div className="px-4 md:px-8 pb-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-5 -mt-16 md:-mt-8 w-full">
            {/* Overlapping Rounded Avatar */}
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white bg-slate-100 shadow-md overflow-hidden flex items-center justify-center font-bold text-5xl text-electric shrink-0 z-10">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                profile?.pseudo?.[0]?.toUpperCase() || "J"
              )}
              {isMyProfile && (
                <div
                  onClick={() => setEditOpen(true)}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera size={22} className="text-white" />
                </div>
              )}
            </div>

            {/* User details */}
            <div className="flex-1 text-center md:text-left md:mb-2 min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                {profile?.displayName || profile?.pseudo || "Utilisateur"}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">@{profile?.pseudo}</p>
              <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto md:mx-0 font-normal">
                {profile?.bio || "Aucune bio pour le moment."}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-xs text-slate-500">
                {profile?.birthdateVisibility === "public" && profile?.birthdate && (
                  <span className="flex items-center gap-1"><Cake size={13} className="text-slate-400" /> Anniversaire : {new Date(profile.birthdate).toLocaleDateString("fr-FR")}</span>
                )}
                {profile?.birthdateVisibility === "public" && profile?.birthdate && (
                  <span className="text-slate-300">·</span>
                )}
                <span className="font-semibold text-slate-700">{friendCount} {friendCount > 1 ? "amis" : "ami"}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0 md:mb-2 w-full md:w-auto">
              {isMyProfile ? (
                <>
                  <button onClick={() => storyFileRef.current?.click()} className="btn-primary flex items-center gap-1.5 py-2 px-4 text-xs font-bold rounded-lg shadow-sm border-0 cursor-pointer">
                    <Plus size={14} /> Ajouter à la story
                  </button>
                  <input
                    ref={storyFileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCreateStory(file);
                    }}
                  />
                  <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer">
                    Modifier le profil
                  </button>
                  <button onClick={handleLogout} className="flex items-center gap-1.5 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-100 cursor-pointer">
                    Se déconnecter
                  </button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {friendshipStatus === "accepted" && (
                    <button
                      onClick={removeFriend}
                      className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-800 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer"
                    >
                      Amis ✓
                    </button>
                  )}
                  {friendshipStatus === "pending" && friendshipSender === fetchedUser?.uid && (
                    <button
                      onClick={cancelFriendRequest}
                      className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer"
                      title="Clique pour annuler l'invitation"
                    >
                      Invitation envoyée
                    </button>
                  )}
                  {friendshipStatus === "pending" && friendshipSender !== fetchedUser?.uid && (
                    <>
                      <button
                        onClick={acceptFriendRequest}
                        className="btn-primary py-2 px-4 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={declineFriendRequest}
                        className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-red-100 text-slate-800 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer"
                      >
                        Refuser
                      </button>
                    </>
                  )}
                  {!friendshipStatus && (
                    <button
                      onClick={sendFriendRequest}
                      className="btn-primary py-2 px-4 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Ajouter
                    </button>
                  )}
                  <Link href={`/messenger?to=${profile.uid}`} className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors">
                    Message
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Facebook-style Tabs */}
          <div className="mt-4 flex gap-1 border-b border-slate-200 w-full overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold transition-all duration-200 border-b-4 shrink-0 cursor-pointer ${
                  tab === t
                    ? "text-electric border-electric"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <EditProfileModal
          user={profile}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(data) => setUser((prev) => ({ ...prev, ...data }))}
        />

        {/* Main Grid Content Area */}
        <div className="mt-4 px-3">
          {tab === "Publications" && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Intro Box */}
                <div className="card p-4 flex flex-col gap-3">
                  <h3 className="font-display font-bold text-slate-800 text-base">Intro</h3>
                  <p className="text-sm text-slate-600 text-center py-2 bg-slate-50 rounded-xl italic">
                    "{profile?.bio || "Aucune bio pour le moment."}"
                  </p>
                  <div className="flex flex-col gap-2.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Cake size={15} className="text-slate-400" />
                      <span>Anniversaire : {profile?.birthdate ? new Date(profile.birthdate).toLocaleDateString("fr-FR") : "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon size={15} className="text-slate-400" />
                      <span className="truncate">justalk.app/{profile?.pseudo}</span>
                    </div>
                  </div>
                </div>

                {/* Photos Grid Box */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-slate-800 text-base">Photos</h3>
                    <button onClick={() => setTab("Photos")} className="text-xs font-semibold text-electric hover:underline border-0 bg-transparent cursor-pointer">Voir toutes les photos</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
                    {photos.slice(0, 9).map((img, i) => (
                      <div key={i} className="aspect-square bg-slate-100 overflow-hidden hover:opacity-90 transition-opacity">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {photos.length === 0 && (
                      <p className="col-span-3 text-center text-xs text-slate-400 py-6">Aucune photo publiée.</p>
                    )}
                  </div>
                </div>

                {/* Friends Grid Box */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-bold text-slate-800 text-base">Amis</h3>
                    <button onClick={() => setTab("Amis")} className="text-xs font-semibold text-electric hover:underline border-0 bg-transparent cursor-pointer">Tous les amis</button>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{friendCount} {friendCount > 1 ? "amis" : "ami"} (membres suggérés)</p>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                    {recentMembers.slice(0, 9).map((m) => (
                      <Link key={m.id} href={`/profil?id=${m.id}`} className="flex flex-col items-center group">
                        <div className="w-full aspect-square rounded-lg bg-electric/10 overflow-hidden shadow-sm flex items-center justify-center font-bold text-electric text-lg group-hover:opacity-85 transition-opacity">
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            m.pseudo?.[0]?.toUpperCase()
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-700 mt-1 truncate w-full text-center group-hover:text-electric transition-colors">
                          {m.displayName || m.pseudo}
                        </span>
                      </Link>
                    ))}
                    {recentMembers.length === 0 && (
                      <p className="col-span-3 text-center text-xs text-slate-400 py-6">Aucun membre.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-3 flex flex-col gap-4">
                {isMyProfile && (
                  <CreatePost user={profile} onPublish={handlePublish} />
                )}
                
                <div className="flex flex-col gap-4 w-full">
                  {posts.map((post) => {
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
                  
                  {posts.length === 0 && !loadingPosts && (
                    <div className="card-lg p-10 text-center text-slate-400 w-full bg-white rounded-2xl">
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
              </div>
            </div>
          )}

          {tab === "À propos" && (
            <div className="card-lg p-6 text-sm text-slate-600 bg-white rounded-2xl max-w-2xl mx-auto mt-4">
              <h3 className="font-display font-bold text-slate-800 text-lg mb-2">À propos</h3>
              <p className="mb-2 leading-relaxed">Compte créé via authentification biométrique Justalk.</p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400">Identifiant Unique (UID)</p>
                  <p className="font-mono text-slate-800 font-semibold mt-0.5 truncate">{profile?.uid}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400">Pseudo Public</p>
                  <p className="text-slate-800 font-semibold mt-0.5">@{profile?.pseudo}</p>
                </div>
              </div>
            </div>
          )}

          {tab === "Amis" && (
            <div className="card p-6 bg-white rounded-2xl max-w-2xl mx-auto mt-4">
              <h3 className="font-display font-bold text-slate-800 text-lg mb-3">Membres Justalk</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recentMembers.map((m) => (
                  <Link key={m.id} href={`/profil?id=${m.id}`} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric text-sm shrink-0 overflow-hidden">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        m.pseudo?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{m.displayName || m.pseudo}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{m.pseudo}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {tab === "Photos" && (
            <div className="card p-6 bg-white rounded-2xl max-w-2xl mx-auto mt-4">
              <h3 className="font-display font-bold text-slate-800 text-lg mb-3">Photos publiées</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((img, i) => (
                  <div key={i} className="aspect-square bg-slate-50 rounded-xl overflow-hidden hover:opacity-90 transition-opacity border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {photos.length === 0 && (
                  <p className="col-span-3 sm:col-span-4 text-center text-sm text-slate-400 py-12">Aucune photo pour le moment.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
