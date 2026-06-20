// frontend/src/components/Feed.jsx
// Tableau de bord principal de Justalk gérant le flux d'actualités, messagerie, amis et appels.

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Plus, Trash2, Heart, MessageCircle, Image, Send, X, Loader2, LogOut, 
  Users, Bell, Camera, Video, StopCircle, ChevronLeft, Mic, Film, 
  Phone, Shield, User, Sparkles, PhoneCall, PhoneMissed, PhoneIncoming
} from "lucide-react";
import ReelFeed from "./ReelFeed";
import ProfilePage from "./ProfilePage";
import CallScreen from "./CallScreen";

export default function Feed({ currentUser, setCurrentUser, onLogout }) {
  const [activeView, setActiveView] = useState("feed"); // feed | reels | friends | messenger | profile
  
  // Data States
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState("checking");

  // Navigation Dropdowns
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Messenger States
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessageText, setChatMessageText] = useState("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [chatMediaFile, setChatMediaFile] = useState(null);
  const [chatMediaType, setChatMediaType] = useState(null); // 'image' | 'video'
  const [chatMediaPreview, setChatMediaPreview] = useState(null);

  // Friends States
  const [friendsList, setFriendsList] = useState([]);
  const [activeFriendTab, setActiveFriendTab] = useState("my-friends"); // my-friends | find-friends
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [actioningFriendId, setActioningFriendId] = useState(null);

  // Stories States
  const [uploadingStory, setUploadingStory] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);

  // Comments States
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");

  // Post Creator Media States
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // Calling States
  const [activeCall, setActiveCall] = useState(null); // { roomId, callType, isIncoming, callerName }

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const storyFileInputRef = useRef(null);
  const chatFileInputRef = useRef(null);

  // Initialisation du client Supabase pour le Realtime
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  let supabase = null;
  if (supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://[PROJECT-ID].supabase.co") {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // --- Chargement des données backend ---

  const fetchPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Impossible de charger les publications.");
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStories = async () => {
    try {
      const res = await fetch("/api/stories");
      if (res.ok) {
        const data = await res.json();
        setStories(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des stories:", err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notifications/unread_count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error("Erreur unread count notifications:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Erreur de récupération des notifications:", err);
    }
  };

  const fetchUsersList = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des utilisateurs :", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des conversations:", err);
    }
  };

  const fetchChatMessages = async (conversationId) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error("Erreur chargement messages:", err);
    }
  };

  // --- Actions d'amitié ---

  const handleSendFriendRequest = async (friendId) => {
    setActioningFriendId(friendId);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) {
        const result = await res.json();
        setFriendsList((prev) =>
          prev.map((u) => {
            if (u.id === friendId) {
              if (result.action === "accepted") {
                window.triggerConfetti?.();
                return { ...u, is_friend: true, is_outgoing_pending: false, is_incoming_pending: false };
              }
              return { ...u, is_outgoing_pending: true };
            }
            return u;
          })
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Erreur lors de la demande d'amitié.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau.");
    } finally {
      setActioningFriendId(null);
    }
  };

  const handleAcceptFriendRequest = async (friendId) => {
    setActioningFriendId(friendId);
    try {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) {
        window.triggerConfetti?.();
        setFriendsList((prev) =>
          prev.map((u) =>
            u.id === friendId
              ? { ...u, is_friend: true, is_incoming_pending: false, is_outgoing_pending: false }
              : u
          )
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Erreur lors de l'acceptation.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    } finally {
      setActioningFriendId(null);
    }
  };

  const handleDeclineFriendRequest = async (friendId) => {
    setActioningFriendId(friendId);
    try {
      const res = await fetch("/api/friends/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) {
        setFriendsList((prev) =>
          prev.map((u) =>
            u.id === friendId
              ? { ...u, is_friend: false, is_incoming_pending: false, is_outgoing_pending: false }
              : u
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActioningFriendId(null);
    }
  };

  // --- Messenger Operations ---

  const handleOpenChat = async (recipientId) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConversations(prev => {
          if (prev.some(c => c.id === conv.id)) return prev;
          return [conv, ...prev];
        });
        setSelectedConversation(conv);
        fetchChatMessages(conv.id);
        setActiveView("messenger");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Erreur de création de la conversation.");
      }
    } catch (err) {
      console.error("Erreur ouverture chat:", err);
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessageText.trim() && !chatMediaFile) return;
    if (!selectedConversation) return;

    setSendingChatMessage(true);
    try {
      let imageUrl = null;
      let videoUrl = null;

      if (chatMediaFile) {
        const publicUrl = await uploadMedia(chatMediaFile);
        if (chatMediaType === "image") {
          imageUrl = publicUrl;
        } else {
          videoUrl = publicUrl;
        }
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: chatMessageText.trim(),
          image_url: imageUrl,
          video_url: videoUrl
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setChatMessageText("");
        clearChatMedia();
        fetchConversations();
      }
    } catch (err) {
      console.error("Erreur envoi message:", err);
    } finally {
      setSendingChatMessage(false);
    }
  };

  const handleChatFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setChatMediaFile(file);
      setChatMediaType("image");
      setChatMediaPreview(URL.createObjectURL(file));
    } else if (file.type.startsWith("video/")) {
      setChatMediaFile(file);
      setChatMediaType("video");
      setChatMediaPreview(URL.createObjectURL(file));
    } else {
      alert("Type de fichier non supporté.");
    }
  };

  const clearChatMedia = () => {
    if (chatMediaPreview) URL.revokeObjectURL(chatMediaPreview);
    setChatMediaFile(null);
    setChatMediaType(null);
    setChatMediaPreview(null);
  };

  // --- Calling Signaling Triggers ---
  const handleStartCall = async (type) => {
    if (!selectedConversation) return;
    const content = type === "video" ? `🎥 Appel vidéo en cours...` : `📞 Appel audio en cours...`;

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: content
        })
      });
    } catch (err) {
      console.error(err);
    }

    setActiveCall({
      roomId: selectedConversation.id,
      callType: type,
      isIncoming: false
    });
  };

  // --- References pour les closures useEffect ---
  const fetchUsersListRef = useRef(null);
  const fetchConversationsRef = useRef(null);
  const fetchChatMessagesRef = useRef(null);
  const selectedConversationRef = useRef(null);

  useEffect(() => {
    fetchUsersListRef.current = fetchUsersList;
    fetchConversationsRef.current = fetchConversations;
    fetchChatMessagesRef.current = fetchChatMessages;
    selectedConversationRef.current = selectedConversation;
  });

  // Charger la liste d'utilisateurs à l'affichage des amis
  useEffect(() => {
    if (activeView === "friends") {
      fetchUsersList();
    }
  }, [activeView]);

  // Initialisation et Realtime Supabase
  useEffect(() => {
    fetchPosts();
    fetchStories();
    fetchUnreadCount();
    fetchConversations();

    if (!supabase) {
      setSupabaseStatus("disconnected");
      return;
    }

    setSupabaseStatus("connected");

    // Écouter les insertions de posts
    const postsChannel = supabase
      .channel("public-posts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => fetchPosts()
      )
      .subscribe();

    // Écouter les modifications de likes/comments
    const socialChannel = supabase
      .channel("public-social-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes" },
        () => fetchPosts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => fetchPosts()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories" },
        () => fetchStories()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => fetchUnreadCount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          if (fetchUsersListRef.current) fetchUsersListRef.current();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (fetchConversationsRef.current) fetchConversationsRef.current();
          if (selectedConversationRef.current && payload.new.conversation_id === selectedConversationRef.current.id) {
            if (fetchChatMessagesRef.current) fetchChatMessagesRef.current(selectedConversationRef.current.id);
          }

          // Détection d'un appel entrant via messages
          if (payload.new.sender_id !== currentUser.id && payload.new.content) {
            const msgContent = payload.new.content;
            if (msgContent.startsWith("📞 Appel audio") || msgContent.startsWith("🎥 Appel vidéo")) {
              const callType = msgContent.includes("vidéo") ? "video" : "audio";
              setActiveCall({
                roomId: payload.new.conversation_id,
                callType: callType,
                isIncoming: true,
                callerName: "Correspondant"
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(socialChannel);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // --- Uploading media ---
  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Erreur de téléversement");
    const data = await res.json();
    return data.url;
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;

    setPublishing(true);
    try {
      let imageUrl = null;
      let videoUrl = null;

      if (mediaFile) {
        const publicUrl = await uploadMedia(mediaFile);
        if (mediaType === "image") {
          imageUrl = publicUrl;
        } else {
          videoUrl = publicUrl;
        }
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          image_url: imageUrl,
          video_url: videoUrl
        }),
      });

      if (res.ok) {
        window.triggerConfetti?.();
        setContent("");
        clearMedia();
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateStory = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStory(true);
    try {
      const publicUrl = await uploadMedia(file);
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_url: publicUrl }),
      });
      if (res.ok) {
        fetchStories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingStory(false);
    }
  };

  const handleLike = async (postId) => {
    // Optimistic UI updates
    let isNowLiked = false;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        isNowLiked = !p.is_liked;
        return {
          ...p,
          is_liked: !p.is_liked,
          likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1
        };
      }
      return p;
    }));
    if (isNowLiked) window.triggerConfetti?.();

    try {
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e, postId, customText) => {
    e.preventDefault();
    const finalContent = customText || commentText.trim();
    if (!finalContent) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, content: finalContent }),
      });

      if (res.ok) {
        window.triggerConfetti?.();
        if (!customText) {
          setCommentText("");
          setActiveCommentPostId(null);
        }
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setMediaFile(file);
      setMediaType("image");
      setMediaPreview(URL.createObjectURL(file));
    } else if (file.type.startsWith("video/")) {
      setMediaFile(file);
      setMediaType("video");
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
  };

  // --- Camera Operations ---
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error(err);
      alert("Impossible d'accéder à la caméra.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsCameraActive(false);
    setIsRecording(false);
  };

  const takePhoto = () => {
    if (!videoRef.current || !stream) return;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.translate(640, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      setMediaFile(file);
      setMediaType("image");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    }, "image/jpeg");
  };

  const startRecording = () => {
    if (!stream) return;
    setIsRecording(true);
    setRecordingTime(0);
    
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: "video/webm" });
      setMediaFile(file);
      setMediaType("video");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    };
    
    setMediaRecorder(recorder);
    recorder.start();
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  // --- Story View Progress ---
  const openStoryViewer = (story) => {
    setSelectedStory(story);
    setStoryProgress(0);
  };

  useEffect(() => {
    let interval = null;
    if (selectedStory) {
      // Marquer comme vue
      fetch(`/api/stories/${selectedStory.id}/view`, { method: "POST" }).catch(() => {});
      
      interval = setInterval(() => {
        setStoryProgress((prev) => {
          if (prev >= 100) {
            setSelectedStory(null);
            return 0;
          }
          return prev + 2;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedStory]);

  const formatMessageTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-screen h-[100dvh] bg-[#090b11] text-white flex flex-col font-sans relative overflow-hidden">
      
      {/* WebRTC Calling Overlay */}
      {activeCall && (
        <CallScreen
          roomId={activeCall.roomId}
          currentUser={currentUser}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          callerName={activeCall.callerName}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* 1. HEADER NAV PREMIUM */}
      <header className="top-header">
        <div className="h-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveView("feed")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md">
              J
            </div>
            <span className="font-display font-black text-xl tracking-tight text-white hidden sm:inline">
              Justalk
            </span>
          </div>

          {/* Navigation au centre (Visible sur Tablette, masquée sur Mobile et Desktop) */}
          <nav className="hidden sm:flex md:hidden items-center gap-1.5 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveView("feed")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === "feed" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              Fil
            </button>
            <button 
              onClick={() => setActiveView("reels")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === "reels" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              Reels
            </button>
            <button 
              onClick={() => setActiveView("friends")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === "friends" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              Amis
            </button>
            <button 
              onClick={() => setActiveView("messenger")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === "messenger" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              Messenger
            </button>
          </nav>

          {/* Droite (Notifications et Profil) */}
          <div className="flex items-center gap-3">
            
            {/* Popover Notifications */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  setShowUserDropdown(false);
                  if (!showNotificationsDropdown) fetchNotifications();
                }}
                className={`p-2.5 rounded-xl transition-all relative ${showNotificationsDropdown ? 'bg-blue-600 text-white' : 'bg-[#1c2234] text-slate-300 hover:bg-slate-800'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-3.5 w-80 bg-[#121620] border border-white/5 rounded-2xl shadow-2xl z-50 p-3">
                  <h4 className="px-3 pb-2.5 font-display font-extrabold text-slate-200 text-sm border-b border-white/5 flex justify-between items-center">
                    <span>Notifications</span>
                    {notifications.length > 0 && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                  </h4>
                  <div className="max-h-72 overflow-y-auto mt-2.5 flex flex-col gap-2 scrollbar-none">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-3 rounded-xl text-xs text-slate-300 leading-normal flex items-start gap-2.5 transition-colors ${notif.is_read ? 'bg-transparent' : 'bg-blue-500/10 border border-blue-500/20 font-medium'}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p>{notif.content}</p>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            {new Date(notif.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-center py-8 text-slate-500 text-sm">Aucune notification.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu Utilisateur */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotificationsDropdown(false);
                }}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm border border-white/10 shadow-sm cursor-pointer overflow-hidden"
              >
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentUser.display_name?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || "U"
                )}
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-3.5 w-48 bg-[#121620] border border-white/5 rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden">
                  <button
                    onClick={() => {
                      setActiveView("profile");
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/5 rounded-xl transition-all font-semibold"
                  >
                    <User size={15} />
                    Mon Profil
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition-all font-semibold"
                  >
                    <LogOut size={15} />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ZONE PRINCIPALE DE CONTENU */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-0 sm:px-4 md:px-6 lg:px-8 pb-4 flex gap-6 overflow-hidden pt-[calc(4rem+env(safe-area-inset-top))]">
        
        {/* BARRE LATERALE GAUCHE (Desktop seulement) */}
        <aside className="hidden md:flex flex-col gap-5 w-64 shrink-0 py-6 border-r border-white/5 pr-6 h-full overflow-y-auto mt-2">
          {/* Bloc Utilisateur */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-white/10 shadow-inner">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser.display_name?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-200 truncate">{currentUser.display_name || currentUser.username}</h4>
              <p className="text-xs text-slate-500 truncate">@{currentUser.username}</p>
            </div>
          </div>

          {/* Liens de Navigation */}
          <nav className="flex flex-col gap-1.5">
            <button 
              onClick={() => setActiveView("feed")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeView === "feed" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <Users size={20} />
              <span>Fil d'actualités</span>
            </button>
            <button 
              onClick={() => setActiveView("reels")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeView === "reels" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <Film size={20} />
              <span>Reels</span>
            </button>
            <button 
              onClick={() => setActiveView("friends")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeView === "friends" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <Users size={20} />
              <span>Amis</span>
            </button>
            <button 
              onClick={() => setActiveView("messenger")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeView === "messenger" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <MessageCircle size={20} />
              <span>Messenger</span>
            </button>
            <button 
              onClick={() => setActiveView("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeView === "profile" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <User size={20} />
              <span>Profil</span>
            </button>
          </nav>

          {/* Déconnexion */}
          <button 
            onClick={onLogout}
            className="w-full mt-auto flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={20} />
            <span>Se déconnecter</span>
          </button>
        </aside>

        {/* CONTENU CENTRAL POUR LES ONGLETS (Flex-1) */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">

          {/* VIEW : FIL D'ACTUALITES */}
          {activeView === "feed" && (
            <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full page-content">
            
            {/* STORIES HORIZONTALES */}
            <div className="w-full flex gap-3.5 overflow-x-auto pb-2 scrollbar-none shrink-0 pt-2 px-4 sm:px-0">
              {/* Créer une story */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                <div 
                  onClick={() => storyFileInputRef.current?.click()}
                  className="w-14 h-14 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-500 hover:border-blue-500 cursor-pointer bg-slate-900/50 transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title="Ajouter une story"
                >
                  {uploadingStory ? (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  ) : (
                    <Plus size={18} />
                  )}
                </div>
                <span className="text-xs text-slate-400 font-bold max-w-[60px] truncate">Créer story</span>
                <input 
                  type="file"
                  ref={storyFileInputRef}
                  onChange={handleCreateStory}
                  accept="image/*,video/*"
                  className="hidden"
                />
              </div>

              {/* Rendre les stories actives */}
              {stories.map((story) => (
                <div 
                  key={story.id}
                  onClick={() => openStoryViewer(story)}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none group"
                >
                  <div 
                    className={`w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr transition-all duration-300 group-hover:scale-105 ${story.is_viewed ? 'from-slate-700 to-slate-800' : 'from-blue-500 via-indigo-500 to-purple-500'}`}
                  >
                    <div className="w-full h-full rounded-full border-2 border-[#090b11] bg-slate-900 overflow-hidden flex items-center justify-center">
                      {story.media_url.includes(".webm") || story.media_url.includes(".mp4") ? (
                        <video src={story.media_url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-bold max-w-[60px] truncate">
                    {story.author_display_name || story.author_username}
                  </span>
                </div>
              ))}
            </div>

            {/* COMPOSER DE POST */}
            <div className="card bg-[#121620] border-white/5 p-4 rounded-none sm:rounded-2xl border-x-0 sm:border-x flex flex-col gap-4 relative">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-base shrink-0 shadow-inner overflow-hidden border border-white/10">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    currentUser.display_name?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>

                <form onSubmit={handlePublish} className="flex-1 flex flex-col gap-3.5">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`À quoi pensez-vous, ${currentUser.display_name || currentUser.username} ?`}
                    className="w-full min-h-[75px] p-1 bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none resize-none text-base sm:text-lg leading-relaxed"
                    maxLength={280}
                    disabled={publishing}
                  />

                  {/* Caméra en Direct */}
                  {isCameraActive && (
                    <div className="mt-1 border border-white/10 rounded-2xl overflow-hidden bg-slate-950 relative shadow-inner aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      />
                      {isRecording && (
                        <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                          <span>REC {formatTime(recordingTime)}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-center justify-center gap-2">
                        {!isRecording ? (
                          <>
                            <button
                              type="button"
                              onClick={takePhoto}
                              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <Camera size={14} />
                              Photo
                            </button>
                            <button
                              type="button"
                              onClick={startRecording}
                              className="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <Video size={14} />
                              Vidéo
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <X size={14} />
                              Fermer
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 animate-pulse"
                          >
                            <StopCircle size={14} />
                            Arrêter
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Aperçu média importé */}
                  {mediaPreview && (
                    <div className="mt-1 rounded-2xl overflow-hidden border border-white/5 bg-slate-950/20 relative group max-h-[220px] flex items-center justify-center">
                      {mediaType === "image" ? (
                        <img src={mediaPreview} alt="Aperçu" className="w-full max-h-[220px] object-contain" />
                      ) : (
                        <video src={mediaPreview} controls className="w-full max-h-[220px]" />
                      )}
                      <button
                        type="button"
                        onClick={clearMedia}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md"
                        title="Supprimer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Boutons d'importation de médias */}
                  <div className="flex justify-between items-center border-t border-white/5 pt-3 shrink-0">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
                        disabled={publishing}
                      >
                        <Image size={16} className="text-green-500" />
                        Photo/Vidéo
                      </button>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
                        disabled={publishing}
                      >
                        <Camera size={16} className="text-blue-500" />
                        Caméra
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,video/*"
                      className="hidden"
                    />

                    <button
                      type="submit"
                      disabled={publishing || (!content.trim() && !mediaFile)}
                      className="btn-primary py-3 px-5 text-base font-extrabold rounded-xl cursor-pointer"
                    >
                      {publishing ? <Loader2 size={15} className="animate-spin" /> : "Partager"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* FLUX DE POSTS */}
            <div className="flex flex-col gap-4">
              {loading && posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <span className="text-xs text-slate-400">Récupération des publications...</span>
                </div>
              ) : (
                posts.map((post, index) => (
                  <div 
                    key={post.id} 
                    className="post-card card p-0 animate-post border-white/10 shadow-lg"
                    style={{ animationDelay: `${Math.min(index, 8) * 80}ms` }}
                  >
                    
                    {/* Header post */}
                    <div className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm overflow-hidden border border-white/10 shrink-0">
                          {post.author_avatar_url ? (
                            <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            post.author_display_name?.[0]?.toUpperCase() || post.author_username?.[0]?.toUpperCase() || "U"
                          )}
                        </div>
                        <div>
                          <h4 className="text-[15px] sm:text-base font-bold text-slate-100 leading-snug">{post.author_display_name || post.author_username}</h4>
                          <span className="text-[11px] sm:text-xs text-slate-400 leading-none block mt-0.5">
                            {new Date(post.created_at).toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
 
                    {/* Contenu post */}
                    {post.content && (
                      <p className={`px-4 pb-3 leading-relaxed text-slate-100 whitespace-pre-wrap ${
                        post.content.length < 100 && !post.image_url && !post.video_url
                          ? "text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-50 leading-snug"
                          : "text-base sm:text-lg"
                      }`}>{post.content}</p>
                    )}
 
                    {/* Médias post */}
                    {post.image_url && (
                      <div className="w-full bg-black/45 overflow-hidden border-t border-b border-white/5 cursor-pointer">
                        <img 
                          src={post.image_url} 
                          alt="Publication" 
                          className="w-full h-auto min-h-[250px] max-h-[580px] object-cover transition-transform duration-300 hover:scale-[1.01]" 
                        />
                      </div>
                    )}
                    {post.video_url && (
                      <div className="w-full bg-black/45 overflow-hidden border-t border-b border-white/5">
                        <video 
                          src={post.video_url} 
                          controls 
                          className="w-full h-auto min-h-[250px] max-h-[580px] object-contain" 
                        />
                      </div>
                    )}
 
                    {/* Statistiques post */}
                    <div className="px-4 py-3 flex justify-between items-center text-xs sm:text-sm text-slate-400 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white select-none">👍</span>
                        <span className="font-medium text-slate-300">{post.likes_count} J'aime</span>
                      </div>
                      <span className="hover:underline cursor-pointer text-slate-300 font-medium">
                        {post.comments ? post.comments.length : 0} Commentaires
                      </span>
                    </div>
 
                    {/* Actions post */}
                    <div className="px-2 py-1.5 flex gap-1 border-t border-white/5 bg-slate-900/10 shrink-0">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`post-action-btn ${post.is_liked ? 'liked text-blue-500 font-bold' : ''}`}
                      >
                        <Heart 
                          size={20} 
                          className={post.is_liked ? "fill-blue-500 text-blue-500 animate-heartBeat" : "transition-transform hover:scale-110 active:scale-90"} 
                        />
                        <span>J'aime</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id);
                        }}
                        className="post-action-btn"
                      >
                        <MessageCircle size={20} />
                        <span>Commenter</span>
                      </button>
                    </div>
 
                    {/* Formulaire & Liste commentaires */}
                    {activeCommentPostId === post.id && (
                      <div className="p-4 border-t border-white/5 bg-slate-950/40 flex flex-col gap-3">
                        <form onSubmit={(e) => handlePostComment(e, post.id)} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Écrire un commentaire..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="flex-1 input-pill bg-[#090b11] border-white/5 text-base py-3.5 px-4.5 focus:bg-[#121620]"
                            required
                          />
                          <button
                            type="submit"
                            className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                          >
                            <Send size={18} />
                          </button>
                        </form>
 
                        <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-none">
                          {post.comments && post.comments.map((comment) => (
                            <div key={comment.id} className="flex gap-2.5 items-start text-sm sm:text-base">
                              <div className="w-9.5 h-9.5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 border border-slate-700 overflow-hidden">
                                {comment.author_avatar_url ? (
                                  <img src={comment.author_avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  comment.author_display_name?.[0]?.toUpperCase() || comment.author_username?.[0]?.toUpperCase() || "U"
                                )}
                              </div>
                              <div className="flex-1 bg-slate-900 rounded-xl p-3 border border-slate-800/80">
                                <p className="font-bold text-slate-200">{comment.author_display_name || comment.author_username}</p>
                                <p className="text-slate-300 mt-1 leading-relaxed">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {posts.length === 0 && !loading && (
                <div className="card text-center py-16 text-slate-500 text-sm flex flex-col items-center gap-1.5 bg-slate-900/20">
                  <Shield size={24} className="text-blue-500/30" />
                  <p className="font-semibold">Aucune publication sur le fil.</p>
                  <p className="text-xs">Publiez votre premier post dès maintenant !</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW : REELS */}
        {activeView === "reels" && (
          <ReelFeed currentUser={currentUser} />
        )}

        {/* VIEW : AMIS (PLEIN ECRAN PAGE) */}
        {activeView === "friends" && (
          <div className="w-full max-w-3xl mx-auto page-content flex flex-col gap-5">
            
            {/* Header Amis */}
            <div className="flex justify-between items-center bg-[#121620] border-x-0 sm:border-x border-t-0 sm:border-t border-b border-white/5 rounded-none sm:rounded-2xl p-4 shadow-sm shrink-0">
              <div className="flex items-center gap-2">
                <Users className="text-blue-500" size={24} />
                <h2 className="font-display font-extrabold text-lg text-white">Gestion d'Amis</h2>
              </div>
            </div>

            {/* Onglets Amis */}
            <div className="card p-0 overflow-hidden rounded-none sm:rounded-2xl flex flex-col bg-[#121620] border-x-0 sm:border-x border-t-0 sm:border-t border-b sm:border-b border-white/5">
              <div className="flex border-b border-white/5 bg-slate-950/20 shrink-0">
                <button
                  onClick={() => setActiveFriendTab("my-friends")}
                  className={`flex-1 py-3.5 text-sm font-bold transition-all border-b-2 ${
                    activeFriendTab === "my-friends"
                      ? "border-blue-600 text-blue-600 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Mes Amis ({friendsList.filter((u) => u.is_friend).length})
                </button>
                <button
                  onClick={() => setActiveFriendTab("find-friends")}
                  className={`flex-1 py-3.5 text-sm font-bold transition-all border-b-2 ${
                    activeFriendTab === "find-friends"
                      ? "border-blue-600 text-blue-600 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Trouver des amis ({friendsList.filter((u) => !u.is_friend).length})
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex flex-col gap-3 max-h-[500px] scrollbar-none">
                {loadingFriends ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                    <span className="text-xs font-semibold">Récupération des utilisateurs...</span>
                  </div>
                ) : (
                  <>
                    {activeFriendTab === "my-friends" ? (
                      friendsList.filter((u) => u.is_friend).length > 0 ? (
                        friendsList
                          .filter((u) => u.is_friend)
                          .map((f) => (
                            <div key={f.id} className="flex justify-between items-center p-2 rounded-xl hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden border border-white/5">
                                  {f.avatar_url ? (
                                    <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    f.display_name?.[0]?.toUpperCase() || f.username?.[0]?.toUpperCase() || "U"
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-200 leading-snug">{f.display_name || f.username}</p>
                                  <p className="text-xs text-slate-500 leading-none">@{f.username}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleOpenChat(f.id)}
                                  className="px-4 py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 font-bold text-xs transition-colors"
                                >
                                  Message
                                </button>
                                <button
                                  onClick={() => handleDeclineFriendRequest(f.id)}
                                  disabled={actioningFriendId === f.id}
                                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-colors disabled:opacity-50 min-w-[75px] flex items-center justify-center"
                                >
                                  {actioningFriendId === f.id ? <Loader2 size={12} className="animate-spin" /> : "Retirer"}
                                </button>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          Vous n'avez pas encore d'amis acceptés.
                        </div>
                      )
                    ) : (
                      friendsList.filter((u) => !u.is_friend).length > 0 ? (
                        friendsList
                          .filter((u) => !u.is_friend)
                          .map((f) => (
                            <div key={f.id} className="flex justify-between items-center p-2 rounded-xl hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-white/5">
                                  {f.avatar_url ? (
                                    <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    f.display_name?.[0]?.toUpperCase() || f.username?.[0]?.toUpperCase() || "U"
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-200 leading-snug">{f.display_name || f.username}</p>
                                  <p className="text-xs text-slate-500 leading-none">@{f.username}</p>
                                </div>
                              </div>

                              {/* Boutons d'invitation */}
                              {f.is_incoming_pending ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleAcceptFriendRequest(f.id)}
                                    disabled={actioningFriendId === f.id}
                                    className="px-3.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition-colors min-w-[70px]"
                                  >
                                    {actioningFriendId === f.id ? <Loader2 size={12} className="animate-spin" /> : "Accepter"}
                                  </button>
                                  <button
                                    onClick={() => handleDeclineFriendRequest(f.id)}
                                    disabled={actioningFriendId === f.id}
                                    className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-colors"
                                  >
                                    {actioningFriendId === f.id ? <Loader2 size={12} className="animate-spin" /> : "Refuser"}
                                  </button>
                                </div>
                              ) : f.is_outgoing_pending ? (
                                <button
                                  onClick={() => handleDeclineFriendRequest(f.id)}
                                  disabled={actioningFriendId === f.id}
                                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-500 font-bold text-xs transition-colors"
                                >
                                  {actioningFriendId === f.id ? <Loader2 size={12} className="animate-spin" /> : "Annuler"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendFriendRequest(f.id)}
                                  disabled={actioningFriendId === f.id}
                                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors min-w-[80px] flex items-center justify-center"
                                >
                                  {actioningFriendId === f.id ? <Loader2 size={12} className="animate-spin" /> : "Inviter"}
                                </button>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          Aucun autre utilisateur trouvé.
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {/* VIEW : MESSENGER (PLEIN ECRAN PAGE) */}
        {activeView === "messenger" && (
          <div className="w-full max-w-4xl mx-auto page-content flex flex-col gap-4">
            
            {!selectedConversation ? (
              <>
                <div className="flex justify-between items-center bg-[#121620] border-x-0 sm:border-x border-t-0 sm:border-t border-b border-white/5 rounded-none sm:rounded-2xl p-4 shadow-sm shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="text-blue-500" size={24} />
                    <h2 className="font-display font-extrabold text-lg text-white">Messagerie</h2>
                  </div>
                </div>

                <div className="card bg-[#121620] border-x-0 sm:border-x border-t-0 sm:border-t border-b sm:border-b border-white/5 rounded-none sm:rounded-2xl p-3.5 flex flex-col gap-1.5 min-h-[400px] md:h-[calc(100vh-12rem)] md:min-h-[500px] overflow-y-auto scrollbar-none">
                  {conversations.length > 0 ? (
                    conversations.map((c) => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedConversation(c);
                          fetchChatMessages(c.id);
                        }}
                        className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm border border-white/10 shadow-sm overflow-hidden shrink-0">
                            {c.recipient_avatar_url ? (
                              <img src={c.recipient_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              c.recipient_display_name?.[0]?.toUpperCase() || c.recipient_username?.[0]?.toUpperCase() || "U"
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate">
                              {c.recipient_display_name || c.recipient_username}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px]">
                              {c.last_message_content ? (
                                <>
                                  {c.last_message_sender_id === currentUser.id ? "Vous : " : ""}
                                  {c.last_message_content}
                                </>
                              ) : (
                                <span className="italic text-slate-600">Aucun message</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {c.last_message_time && (
                          <span className="text-[10px] text-slate-500 whitespace-nowrap self-start mt-1 shrink-0">
                            {formatMessageTime(c.last_message_time)}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-slate-500 text-sm flex flex-col items-center gap-2 my-auto">
                      <MessageCircle size={32} className="text-slate-700" />
                      <p className="font-semibold">Aucune discussion active.</p>
                      <button 
                        onClick={() => setActiveView("friends")}
                        className="mt-2 text-blue-500 font-bold hover:underline"
                      >
                        Commencez un chat depuis vos Amis !
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Fenêtre de discussion active */
              <div className="card bg-[#121620] border-x-0 sm:border-x border-t-0 sm:border-t border-b sm:border-b border-white/5 rounded-none sm:rounded-3xl p-0 flex flex-col h-full md:h-[calc(100vh-10rem)] md:min-h-[580px] overflow-hidden animate-scaleIn">
                {/* Chat Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/20 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => setSelectedConversation(null)} 
                      className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 mr-0.5"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm border border-white/10 shadow-sm shrink-0 overflow-hidden">
                      {selectedConversation.recipient_avatar_url ? (
                        <img src={selectedConversation.recipient_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedConversation.recipient_display_name?.[0]?.toUpperCase() || selectedConversation.recipient_username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-200 truncate leading-snug">
                        {selectedConversation.recipient_display_name || selectedConversation.recipient_username}
                      </h4>
                      <p className="text-xs text-slate-500 leading-none">@{selectedConversation.recipient_username}</p>
                    </div>
                  </div>

                  {/* Boutons d'appel audio/vidéo */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleStartCall("audio")}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-600/10 text-slate-300 hover:text-blue-500 transition-colors"
                      title="Appel Audio"
                    >
                      <Phone size={18} />
                    </button>
                    <button
                      onClick={() => handleStartCall("video")}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-600/10 text-slate-300 hover:text-blue-500 transition-colors"
                      title="Appel Vidéo"
                    >
                      <Video size={18} />
                    </button>
                  </div>
                </div>

                {/* Zone de messages scrollable */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 bg-slate-950/10 scrollbar-none">
                  {chatMessages.map((m) => {
                    const isMe = m.sender_id === currentUser.id;
                    const isCall = m.content && (m.content.includes("Appel vidéo") || m.content.includes("Appel audio"));
                    
                    return (
                      <div 
                        key={m.id} 
                        className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed break-words shadow-sm flex items-center gap-3 ${
                          isCall 
                            ? 'bg-slate-900 border border-white/5 text-slate-300 min-w-[200px]' 
                            : isMe 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-[#1c2234] text-slate-200 border border-white/5 rounded-bl-none'
                        }`}>
                          {isCall && (
                            <div className={`p-2 rounded-full ${
                              m.content.includes("manqué")
                                ? 'bg-red-500/10 text-red-500'
                                : m.content.includes("terminé")
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-blue-500/10 text-blue-500 animate-pulse'
                            }`}>
                              {m.content.includes("manqué") ? (
                                <PhoneMissed size={16} />
                              ) : m.content.includes("terminé") ? (
                                <PhoneCall size={16} />
                              ) : (
                                <PhoneIncoming size={16} />
                              )}
                            </div>
                          )}
                          <div className="flex-1">
                            {m.content}
                          </div>
                          
                          {m.image_url && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-white/5">
                              <img src={m.image_url} alt="Pièce jointe" className="w-full object-cover" />
                            </div>
                          )}
                          {m.video_url && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-white/5">
                              <video src={m.video_url} controls className="w-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1.5 px-1 font-medium">
                          {formatMessageTime(m.created_at)}
                        </span>
                      </div>
                    );
                  })}
                  {chatMessages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic my-auto">
                      Début de la discussion. Dites bonjour !
                    </div>
                  )}
                </div>

                {/* Formulaire bas de chat */}
                <div className="p-3 border-t border-white/5 bg-[#121620] shrink-0 flex flex-col gap-2">
                  {chatMediaPreview && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 relative group max-h-[80px] flex items-center justify-center shrink-0">
                      {chatMediaType === "image" ? (
                        <img src={chatMediaPreview} alt="Aperçu chat" className="max-h-[80px] object-cover" />
                      ) : (
                        <video src={chatMediaPreview} className="max-h-[80px] object-contain bg-black" />
                      )}
                      <button
                        type="button"
                        onClick={clearChatMedia}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md"
                        title="Supprimer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={sendingChatMessage}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                      title="Photo/Vidéo"
                    >
                      <Image size={18} />
                    </button>
                    <input
                      type="file"
                      ref={chatFileInputRef}
                      onChange={handleChatFileChange}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    <input
                      type="text"
                      value={chatMessageText}
                      onChange={(e) => setChatMessageText(e.target.value)}
                      placeholder="Votre message..."
                      className="flex-1 input-pill py-2.5 px-4 text-sm bg-[#090b11] border-white/5"
                      disabled={sendingChatMessage}
                      required={!chatMediaFile}
                    />
                    <button
                      type="submit"
                      disabled={sendingChatMessage || (!chatMessageText.trim() && !chatMediaFile)}
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-all shrink-0"
                    >
                      {sendingChatMessage ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* VIEW : PROFIL (PLEIN ECRAN PAGE) */}
        {activeView === "profile" && (
          <ProfilePage
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            posts={posts}
            onLike={handleLike}
            onAddComment={handlePostComment}
          />
        )}

        </div>

        {/* BARRE LATERALE DROITE (Desktop seulement) */}
        {(activeView === "feed" || activeView === "profile") && (
          <aside className="hidden lg:flex flex-col gap-6 w-80 shrink-0 py-6 border-l border-white/5 pl-6 h-full overflow-y-auto mt-2">
            {/* Notifications */}
            <div className="flex flex-col gap-3.5">
              <h3 className="font-display font-extrabold text-[11px] text-slate-400 uppercase tracking-wider">Notifications Récentes</h3>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-none pr-1">
                {notifications.slice(0, 4).map((n) => (
                  <div key={n.id} className="p-3 rounded-2xl bg-[#121620]/60 border border-white/5 text-xs flex flex-col gap-1 hover:bg-white/5 transition-colors">
                    <p className="text-slate-300 leading-normal">{n.content}</p>
                    <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-xs text-slate-500 italic">Aucune notification.</p>
                )}
              </div>
            </div>

            {/* Discussions rapides */}
            <div className="flex flex-col gap-3.5">
              <h3 className="font-display font-extrabold text-[11px] text-slate-400 uppercase tracking-wider">Messagerie Rapide</h3>
              <div className="flex flex-col gap-2">
                {conversations.slice(0, 4).map((c) => (
                  <div 
                    key={c.id}
                    onClick={() => handleOpenChat(c.recipient_id)}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#121620]/40 hover:bg-[#121620] border border-transparent hover:border-white/5 cursor-pointer transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 border border-white/5 shadow-sm">
                      {c.recipient_avatar_url ? (
                        <img src={c.recipient_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.recipient_display_name?.[0]?.toUpperCase() || c.recipient_username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{c.recipient_display_name || c.recipient_username}</p>
                      <p className="text-[10px] text-slate-500 truncate">{c.last_message_content || "Commencer la discussion"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

      </main>

      {/* 2. BARRE DE NAVIGATION DU BAS (Optimisé PWA Mobile) */}
      <footer className="bottom-nav sm:hidden">
        <div 
          onClick={() => setActiveView("feed")}
          className={`bottom-nav-item ${activeView === "feed" ? "active" : ""}`}
        >
          <User size={18} />
          <span>Fil</span>
        </div>
        <div 
          onClick={() => setActiveView("reels")}
          className={`bottom-nav-item ${activeView === "reels" ? "active" : ""}`}
        >
          <Film size={18} />
          <span>Reels</span>
        </div>
        <div 
          onClick={() => setActiveView("friends")}
          className={`bottom-nav-item ${activeView === "friends" ? "active" : ""}`}
        >
          <Users size={18} />
          <span>Amis</span>
        </div>
        <div 
          onClick={() => setActiveView("messenger")}
          className={`bottom-nav-item ${activeView === "messenger" ? "active" : ""}`}
        >
          <MessageCircle size={18} />
          <span>Messenger</span>
        </div>
        <div 
          onClick={() => setActiveView("profile")}
          className={`bottom-nav-item ${activeView === "profile" ? "active" : ""}`}
        >
          <User size={18} />
          <span>Profil</span>
        </div>
      </footer>

      {/* STORY VIEWER OVERLAY */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm h-[80vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4">
            
            {/* Top Bar Story */}
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/85 to-transparent flex flex-col gap-3 z-35">
              {/* Ligne progression */}
              <div className="w-full h-[3px] bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-100" style={{ width: `${storyProgress}%` }} />
              </div>

              {/* Infos Auteur */}
              <div className="flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <div className="w-7.5 h-7.5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] overflow-hidden">
                    {selectedStory.author_avatar_url ? (
                      <img src={selectedStory.author_avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedStory.author_display_name?.[0]?.toUpperCase() || selectedStory.author_username?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold">
                      {selectedStory.author_display_name || selectedStory.author_username}
                    </h5>
                    <p className="text-[8px] text-white/50">@{selectedStory.author_username}</p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedStory(null)} 
                  className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 flex items-center justify-center bg-black">
              {selectedStory.media_url.includes(".webm") || selectedStory.media_url.includes(".mp4") ? (
                <video 
                  src={selectedStory.media_url} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src={selectedStory.media_url} 
                  alt="Story" 
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Expire text */}
            <div className="absolute bottom-4 inset-x-0 text-center text-white/40 text-[9px] font-medium z-30">
              Expire à {new Date(selectedStory.expires_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
