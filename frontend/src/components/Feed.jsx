// frontend/src/components/Feed.jsx
// Interface de fil d'actualité interactive avec Stories, Likes, Commentaires et Barre de Navigation premium.

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LogOut,
  Send,
  MessageSquare,
  Shield,
  AlertTriangle,
  RefreshCw,
  Camera,
  Video,
  Image,
  Trash2,
  X,
  StopCircle,
  Loader2,
  Heart,
  Plus,
  Bell,
  Users,
  MessageCircle,
  User,
  MoreVertical,
  ChevronRight,
  Eye
} from "lucide-react";

export default function Feed({ currentUser, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState("checking");

  // États des dropdowns et modales
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);

  // États du Messenger temps réel
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessageText, setChatMessageText] = useState("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [chatMediaFile, setChatMediaFile] = useState(null);
  const [chatMediaType, setChatMediaType] = useState(null); // 'image' | 'video'
  const [chatMediaPreview, setChatMediaPreview] = useState(null);
  const chatFileInputRef = useRef(null);

  const selectedConversationRef = useRef(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // États de la modale Amis Réels
  const [friendsList, setFriendsList] = useState([]);
  const [activeTab, setActiveTab] = useState("my-friends");
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [actioningFriendId, setActioningFriendId] = useState(null);

  const showFriendsModalRef = useRef(showFriendsModal);
  useEffect(() => {
    showFriendsModalRef.current = showFriendsModal;
  }, [showFriendsModal]);

  // États des Stories
  const [uploadingStory, setUploadingStory] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null); // Story active dans le viewer
  const [storyProgress, setStoryProgress] = useState(0);

  // États des Commentaires et Likes
  const [activeCommentPostId, setActiveCommentPostId] = useState(null); // ID du post dont on affiche les commentaires
  const [commentText, setCommentText] = useState("");
  const [commentingPostId, setCommentingPostId] = useState(null);

  // États pour la webcam / fichiers médias (composer)
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const storyFileInputRef = useRef(null);

  // Initialisation du client Supabase pour le Realtime et Storage
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  let supabase = null;
  if (supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://[PROJECT-ID].supabase.co") {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // --- Chargement des données backend ---

  // Charger les publications
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

  // Charger les stories
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

  // Charger le compteur de notifications non lues
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

  // Charger la liste des notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(0); // Remettre à zéro localement après lecture
      }
    } catch (err) {
      console.error("Erreur de récupération des notifications:", err);
    }
  };

  // Charger la liste des utilisateurs réels (amis et autres)
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

  // --- Actions d'amitié (flux pending → accepté) ---

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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Erreur lors du refus.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    } finally {
      setActioningFriendId(null);
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
      console.error("Erreur chargement convs:", err);
    }
  };

  const fetchChatMessages = async (convId) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error("Erreur chargement messages:", err);
    }
  };

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
        setShowFriendsModal(false);
        setShowMessagesModal(true);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Erreur d'envoi du message.");
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
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const fetchUsersListRef = useRef(null);
  const fetchConversationsRef = useRef(null);
  const fetchChatMessagesRef = useRef(null);

  useEffect(() => {
    fetchUsersListRef.current = fetchUsersList;
    fetchConversationsRef.current = fetchConversations;
    fetchChatMessagesRef.current = fetchChatMessages;
  });

  useEffect(() => {
    if (showFriendsModal) {
      fetchUsersList();
    }
  }, [showFriendsModal]);

  // --- Initialisation et Realtime ---
  useEffect(() => {
    fetchPosts();
    fetchStories();
    fetchUnreadCount();

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
        (payload) => {
          console.log("Nouveau post via Realtime:", payload.new);
          fetchPosts(); // Recharge pour obtenir les relations d'auteur
        }
      )
      .subscribe();

    // Écouter les modifications de likes/comments pour mettre à jour en direct
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
          if (showFriendsModalRef.current && fetchUsersListRef.current) {
            fetchUsersListRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          console.log("Nouveau message Realtime:", payload.new);
          if (fetchConversationsRef.current) fetchConversationsRef.current();
          if (selectedConversationRef.current && payload.new.conversation_id === selectedConversationRef.current.id) {
            if (fetchChatMessagesRef.current) fetchChatMessagesRef.current(selectedConversationRef.current.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(socialChannel);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, []);

  // --- Téléversement de médias ---

  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Téléversement échoué.");
    }

    const data = await res.json();
    return data.url;
  };

  // --- Actions de Publication ---

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;

    setPublishing(true);
    setError("");

    try {
      let imageUrl = null;
      let videoUrl = null;

      // Étape 1 : Upload si média existant
      if (mediaFile) {
        const publicUrl = await uploadMedia(mediaFile);
        if (mediaType === "image") {
          imageUrl = publicUrl;
        } else {
          videoUrl = publicUrl;
        }
      }

      // Étape 2 : Envoyer le post au backend
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || null,
          image_url: imageUrl,
          video_url: videoUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Échec de la publication.");
      }

      const newPost = await res.json();
      
      // Optimistic UI : Ajout en haut
      setPosts((prev) => [newPost, ...prev]);
      setContent("");
      clearMedia();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // --- Actions de Stories ---

  const handleCreateStory = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStory(true);
    try {
      // 1. Upload média
      const mediaUrl = await uploadMedia(file);
      // 2. Créer story
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_url: mediaUrl }),
      });

      if (!res.ok) throw new Error("Échec d'enregistrement de la story.");
      
      fetchStories();
    } catch (err) {
      alert("Erreur story : " + err.message);
    } finally {
      setUploadingStory(false);
      if (storyFileInputRef.current) storyFileInputRef.current.value = "";
    }
  };

  const openStoryViewer = async (story) => {
    setSelectedStory(story);
    setStoryProgress(0);
    
    // Marquer comme vue
    try {
      await fetch(`/api/stories/${story.id}/view`, { method: "POST" });
      // Mettre à jour l'état local pour passer le cercle en gris
      setStories((prev) =>
        prev.map((s) => (s.id === story.id ? { ...s, is_viewed: true } : s))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Minuteur Story Viewer (5 secondes)
  useEffect(() => {
    let timer;
    if (selectedStory) {
      timer = setInterval(() => {
        setStoryProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setSelectedStory(null);
            return 0;
          }
          return prev + 2; // 2% toutes les 100ms = 5s
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [selectedStory]);

  // --- Actions de Likes & Commentaires ---

  const handleLike = async (postId) => {
    // Optimistic UI
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          const nextLiked = !post.is_liked;
          return {
            ...post,
            is_liked: nextLiked,
            likes_count: post.likes_count + (nextLiked ? 1 : -1),
          };
        }
        return post;
      })
    );

    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      // Rollback en cas d'erreur
      fetchPosts();
    }
  };

  const handlePostComment = async (e, postId) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommentingPostId(postId);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, content: commentText.trim() }),
      });

      if (!res.ok) throw new Error("Erreur de commentaire.");
      const newComment = await res.json();

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              comments: [...post.comments, newComment],
            };
          }
          return post;
        })
      );
      setCommentText("");
    } catch (err) {
      alert(err.message);
    } finally {
      setCommentingPostId(null);
    }
  };

  // --- Gestion de la webcam ---
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsRecording(false);
    } catch (err) {
      console.error(err);
      setError("Impossible d'accéder à la caméra ou au micro.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
          setMediaFile(file);
          setMediaType("image");
          setMediaPreview(URL.createObjectURL(file));
          stopCamera();
        }
      }, "image/jpeg", 0.95);
    } catch (err) {
      setError("Échec de la capture photo.");
    }
  };

  const startRecording = () => {
    if (!stream) return;
    setError("");
    const chunks = [];
    try {
      let recorder = new MediaRecorder(stream);
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
      recorder.start(10);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      setError("Impossible d'enregistrer la vidéo.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setMediaFile(file);
      setMediaType("image");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    } else if (file.type.startsWith("video/")) {
      setMediaFile(file);
      setMediaType("video");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    } else {
      setError("Type de fichier non supporté.");
    }
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* 1. HEADER NAV PREMIUM */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm z-40">
        <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={fetchPosts}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              J
            </div>
            <span className="font-display font-black text-lg tracking-tight text-slate-800 hidden sm:inline">
              Justalk
            </span>
          </div>

          {/* Navigation au centre cliquable */}
          <nav className="flex items-center gap-1 sm:gap-4">
            <div className="relative">
              <button 
                onClick={() => {
                  setShowFriendsModal(true);
                  setShowNotificationsDropdown(false);
                  setShowUserDropdown(false);
                }}
                className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all"
                title="Amis"
              >
                <Users size={20} />
                {friendsList.filter(u => u.is_incoming_pending).length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-green-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                    {friendsList.filter(u => u.is_incoming_pending).length}
                  </span>
                )}
              </button>
            </div>
            <button 
              onClick={() => {
                setShowMessagesModal(true);
                setShowNotificationsDropdown(false);
                setShowUserDropdown(false);
                fetchConversations();
              }}
              className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all"
              title="Messages"
            >
              <MessageCircle size={20} />
            </button>
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  setShowUserDropdown(false);
                  if (!showNotificationsDropdown) fetchNotifications();
                }}
                className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all"
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Popover Notifications */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-2 py-3">
                  <h4 className="px-3 pb-2 font-bold text-slate-800 text-xs border-b border-slate-100 flex justify-between items-center">
                    <span>Notifications récentes</span>
                    {notifications.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </h4>
                  <div className="max-h-64 overflow-y-auto mt-2 flex flex-col gap-1">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-2.5 rounded-xl text-[11px] text-slate-600 leading-normal flex items-start gap-2.5 transition-colors ${notif.is_read ? 'bg-transparent' : 'bg-blue-50/40 font-medium'}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p>{notif.content}</p>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {new Date(notif.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-center py-6 text-slate-400 text-xs">Aucune notification.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Profil utilisateur cliquable (Avatar) */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotificationsDropdown(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || "U"}
              </div>
            </button>

            {/* Menu Utilisateur */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-1.5 overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentUser?.display_name || currentUser?.username}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">@{currentUser?.username}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold"
                >
                  <LogOut size={14} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ZONE CONTENU */}
      <main className="flex-1 max-w-2xl w-full mx-auto pt-24 px-4 pb-12 flex flex-col gap-5">

        {/* 3. HORIZONTAL STORIES BAR */}
        <div className="w-full flex gap-3.5 overflow-x-auto pb-2 scrollbar-none shrink-0">
          
          {/* Cercle Créer story */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            <div 
              onClick={() => storyFileInputRef.current?.click()}
              className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 cursor-pointer bg-white transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Ajouter une story"
            >
              {uploadingStory ? (
                <Loader2 size={16} className="animate-spin text-blue-500" />
              ) : (
                <Plus size={18} />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-bold max-w-[60px] truncate">Créer story</span>
            <input 
              type="file"
              ref={storyFileInputRef}
              onChange={handleCreateStory}
              accept="image/*,video/*"
              className="hidden"
            />
          </div>

          {/* Liste des stories actives */}
          {stories.map((story) => (
            <div 
              key={story.id}
              onClick={() => openStoryViewer(story)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none group"
            >
              <div 
                className={`w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr transition-all duration-300 group-hover:scale-105 ${story.is_viewed ? 'from-slate-200 to-slate-300' : 'from-blue-500 via-indigo-500 to-purple-500'}`}
              >
                <div className="w-full h-full rounded-full border-2 border-white bg-slate-100 overflow-hidden flex items-center justify-center">
                  {story.media_url.includes(".webm") || story.media_url.includes(".mp4") ? (
                    <video src={story.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-600 font-bold max-w-[60px] truncate">
                {story.author_display_name || story.author_username}
              </span>
            </div>
          ))}
        </div>

        {/* 2. COMPOSER DE POSTS */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex flex-col gap-4 relative">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
              {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || "U"}
            </div>

            <form onSubmit={handlePublish} className="flex-1 flex flex-col gap-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`À quoi pensez-vous, ${currentUser?.display_name || currentUser?.username} ?`}
                className="w-full min-h-[70px] p-1 text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none text-xs leading-relaxed"
                maxLength={280}
                disabled={publishing}
              />

              {/* Aperçu Caméra en Direct */}
              {isCameraActive && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden bg-slate-900 relative shadow-inner aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  {isRecording && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-md">
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
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Camera size={12} />
                          Photo
                        </button>
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Video size={12} />
                          Vidéo
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <X size={12} />
                          Fermer
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-1 animate-pulse"
                      >
                        <StopCircle size={12} />
                        Arrêter
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Aperçu du média capturé ou importé */}
              {mediaPreview && (
                <div className="mt-1 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group max-h-[220px] flex items-center justify-center">
                  {mediaType === "image" ? (
                    <img src={mediaPreview} alt="Aperçu" className="w-full max-h-[220px] object-cover" />
                  ) : (
                    <video src={mediaPreview} controls className="w-full max-h-[220px] object-contain bg-black" />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md active:scale-90"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              {/* Pied du compositeur */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isCameraActive || publishing}
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                    title="Prendre photo/vidéo"
                  >
                    <Camera size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCameraActive || publishing}
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                    title="Importer photo/vidéo"
                  >
                    <Image size={15} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-bold">
                    {280 - content.length}
                  </span>
                  <button
                    type="submit"
                    disabled={publishing || (!content.trim() && !mediaFile)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    {publishing ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        Publier...
                      </>
                    ) : (
                      <>
                        Publier
                        <Send size={11} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* 4. FIL D'ACTUALITÉ */}
        <div className="flex justify-between items-center px-1">
          <h3 className="font-display font-extrabold text-slate-800 text-sm flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-600" />
            Publications récentes
          </h3>
          <button
            onClick={fetchPosts}
            className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all"
            disabled={loading}
            title="Rafraîchir"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Liste des publications */}
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3.5 rounded-xl border border-red-100 bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {posts.map((post) => (
            <div 
              key={post.id} 
              className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex flex-col gap-3.5 transition-all duration-300 hover:border-slate-300/60"
            >
              {/* En-tête publication */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shadow-inner">
                    {post.author_display_name?.[0]?.toUpperCase() || post.author_username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-snug">
                      {post.author_display_name || post.author_username}
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-none">@{post.author_username}</p>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-medium">
                  {new Date(post.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                  {" · "}{new Date(post.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Contenu textuel */}
              {post.content && (
                <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap px-0.5">
                  {post.content}
                </p>
              )}

              {/* Rendu des images */}
              {post.image_url && (
                <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center max-h-[350px]">
                  <img 
                    src={post.image_url} 
                    alt="Post" 
                    className="w-full h-auto max-h-[350px] object-cover"
                    loading="lazy" 
                  />
                </div>
              )}

              {/* Rendu des vidéos */}
              {post.video_url && (
                <div className="rounded-xl overflow-hidden border border-slate-100 bg-black flex items-center justify-center max-h-[350px]">
                  <video 
                    src={post.video_url} 
                    controls 
                    playsInline 
                    className="w-full max-h-[350px] object-contain"
                  />
                </div>
              )}

              {/* Boutons d'interaction */}
              <div className="flex items-center gap-4 border-t border-b border-slate-100 py-2.5 text-xs text-slate-500 font-bold mt-1">
                <button 
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1.5 transition-colors ${post.is_liked ? 'text-red-500' : 'hover:text-red-500'}`}
                >
                  <Heart size={14} className={post.is_liked ? "fill-red-500" : ""} />
                  <span>{post.likes_count} Likes</span>
                </button>

                <button 
                  onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                >
                  <MessageSquare size={14} />
                  <span>{post.comments ? post.comments.length : 0} Commentaires</span>
                </button>
              </div>

              {/* Section Commentaires */}
              {activeCommentPostId === post.id && (
                <div className="flex flex-col gap-3 mt-1 pl-1 border-l-2 border-slate-100">
                  
                  {/* Liste des commentaires */}
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {post.comments && post.comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-700 leading-normal">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800">
                            {comment.author_display_name || comment.author_username}
                          </span>
                          <span className="text-[8px] text-slate-400">
                            {new Date(comment.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600">{comment.content}</p>
                      </div>
                    ))}
                    {(!post.comments || post.comments.length === 0) && (
                      <p className="text-[10px] text-slate-400 py-3 text-center">Aucun commentaire. Écrivez le premier !</p>
                    )}
                  </div>

                  {/* Formulaire de commentaire */}
                  <form onSubmit={(e) => handlePostComment(e, post.id)} className="flex gap-2">
                    <input 
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Votre commentaire..."
                      className="flex-1 input-pill py-2 px-4 text-[11px] bg-slate-50 border border-slate-200"
                      disabled={commentingPostId === post.id}
                      required
                    />
                    <button
                      type="submit"
                      disabled={commentingPostId === post.id || !commentText.trim()}
                      className="px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0 disabled:opacity-40 transition-all"
                    >
                      {commentingPostId === post.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Send size={11} />
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>
          ))}

          {posts.length === 0 && !loading && (
            <div className="card-lg bg-white p-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Shield size={28} className="text-blue-600/30" />
              <p className="text-sm font-semibold">Aucune publication pour le moment.</p>
              <p className="text-xs">Soyez le premier à poster un message !</p>
            </div>
          )}
        </div>
      </main>

      {/* 5. MODALE AMIS (Click Amis Header) */}
      {showFriendsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 animate-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-display font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                Liste d'Amis
              </h3>
              <button onClick={() => setShowFriendsModal(false)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400">
                <X size={15} />
              </button>
            </div>
            
            {/* Onglets d'amis */}
            <div className="flex border-b border-slate-100 bg-slate-50/25">
              <button
                onClick={() => setActiveTab("my-friends")}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === "my-friends"
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                }`}
              >
                Mes Amis ({friendsList.filter((u) => u.is_friend).length})
              </button>
              <button
                onClick={() => setActiveTab("find-friends")}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === "find-friends"
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                }`}
              >
                Trouver des amis ({friendsList.filter((u) => !u.is_friend).length})
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto flex flex-col gap-3">
              {loadingFriends ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={20} />
                  <span className="text-[10px] font-medium">Chargement...</span>
                </div>
              ) : (
                <>
                  {activeTab === "my-friends" ? (
                    friendsList.filter((u) => u.is_friend).length > 0 ? (
                      friendsList
                        .filter((u) => u.is_friend)
                        .map((f) => (
                          <div key={f.id} className="flex justify-between items-center p-1">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                {f.display_name?.[0]?.toUpperCase() || f.username?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 leading-snug">{f.display_name || f.username}</p>
                                <p className="text-[9px] text-slate-400 leading-none">@{f.username}</p>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleOpenChat(f.id)}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] transition-colors flex items-center justify-center gap-1"
                              >
                                Message
                              </button>
                              <button
                                onClick={() => handleDeclineFriendRequest(f.id)}
                                disabled={actioningFriendId === f.id}
                                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50 min-w-[65px]"
                              >
                                {actioningFriendId === f.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  "Retirer"
                                )}
                              </button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Vous n'avez pas encore d'amis.
                      </div>
                    )
                  ) : (
                    /* Onglet Trouver des amis : gère pending entrant, sortant, et aucune relation */
                    friendsList.filter((u) => !u.is_friend).length > 0 ? (
                      friendsList
                        .filter((u) => !u.is_friend)
                        .map((f) => (
                          <div key={f.id} className="flex justify-between items-center p-1">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shadow-inner">
                                {f.display_name?.[0]?.toUpperCase() || f.username?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 leading-snug">{f.display_name || f.username}</p>
                                <p className="text-[9px] text-slate-400 leading-none">@{f.username}</p>
                              </div>
                            </div>

                            {/* Boutons selon l'état */}
                            {f.is_incoming_pending ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleAcceptFriendRequest(f.id)}
                                  disabled={actioningFriendId === f.id}
                                  className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] transition-colors flex items-center justify-center disabled:opacity-50 min-w-[60px]"
                                >
                                  {actioningFriendId === f.id ? <Loader2 size={10} className="animate-spin" /> : "Accepter"}
                                </button>
                                <button
                                  onClick={() => handleDeclineFriendRequest(f.id)}
                                  disabled={actioningFriendId === f.id}
                                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] transition-colors flex items-center justify-center disabled:opacity-50 min-w-[55px]"
                                >
                                  {actioningFriendId === f.id ? <Loader2 size={10} className="animate-spin" /> : "Refuser"}
                                </button>
                              </div>
                            ) : f.is_outgoing_pending ? (
                              <button
                                onClick={() => handleDeclineFriendRequest(f.id)}
                                disabled={actioningFriendId === f.id}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold text-[10px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50 min-w-[80px]"
                              >
                                {actioningFriendId === f.id ? <Loader2 size={10} className="animate-spin" /> : "En attente"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendFriendRequest(f.id)}
                                disabled={actioningFriendId === f.id}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50 min-w-[65px]"
                              >
                                {actioningFriendId === f.id ? <Loader2 size={10} className="animate-spin" /> : "Ajouter"}
                              </button>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-xs">
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

      {/* 6. MODALE MESSAGES (Click Messenger Header) */}
      {showMessagesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 flex justify-center items-center">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 animate-in zoom-in duration-200 flex flex-col h-[500px]">
            
            {!selectedConversation ? (
              <>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                  <h3 className="font-display font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <MessageCircle size={16} className="text-blue-600" />
                    Discussions récentes
                  </h3>
                  <button onClick={() => setShowMessagesModal(false)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400">
                    <X size={15} />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-1">
                  {conversations.length > 0 ? (
                    conversations.map((c) => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedConversation(c);
                          fetchChatMessages(c.id);
                        }}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                            {c.recipient_display_name?.[0]?.toUpperCase() || c.recipient_username?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {c.recipient_display_name || c.recipient_username}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                              {c.last_message_content ? (
                                <>
                                  {c.last_message_sender_id === currentUser.id ? "Vous : " : ""}
                                  {c.last_message_content}
                                </>
                              ) : (
                                <span className="italic text-slate-400">Aucun message</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {c.last_message_time && (
                          <span className="text-[8px] text-slate-400 whitespace-nowrap self-start mt-1 shrink-0">
                            {formatMessageTime(c.last_message_time)}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2 my-auto">
                      <MessageCircle size={24} className="text-slate-300" />
                      <p>Aucune discussion pour le moment.</p>
                      <button 
                        onClick={() => {
                          setShowMessagesModal(false);
                          setShowFriendsModal(true);
                        }}
                        className="mt-2 text-blue-600 font-bold hover:underline"
                      >
                        Démarrer une discussion depuis vos amis
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button 
                      onClick={() => setSelectedConversation(null)} 
                      className="p-1 rounded-full hover:bg-slate-200 text-slate-500 mr-0.5"
                      title="Retour"
                    >
                      <ChevronRight size={18} className="transform rotate-180" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                      {selectedConversation.recipient_display_name?.[0]?.toUpperCase() || selectedConversation.recipient_username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                        {selectedConversation.recipient_display_name || selectedConversation.recipient_username}
                      </h4>
                      <p className="text-[8px] text-slate-400 mt-0.5 leading-none">@{selectedConversation.recipient_username}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowMessagesModal(false)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 shrink-0">
                    <X size={15} />
                  </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 bg-slate-50/30">
                  {chatMessages.map((m) => {
                    const isMe = m.sender_id === currentUser.id;
                    return (
                      <div 
                        key={m.id} 
                        className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                        }`}>
                          {m.content}
                          
                          {m.image_url && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-slate-100">
                              <img src={m.image_url} alt="Pièce jointe" className="w-full object-cover" />
                            </div>
                          )}
                          {m.video_url && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-slate-100">
                              <video src={m.video_url} controls className="w-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1.5 px-1 font-medium">
                          {formatMessageTime(m.created_at)}
                        </span>
                      </div>
                    );
                  })}
                  {chatMessages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic my-auto">
                      Début de la discussion. Dites bonjour !
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-100 bg-white shrink-0 flex flex-col gap-2">
                  {chatMediaPreview && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group max-h-[80px] flex items-center justify-center shrink-0">
                      {chatMediaType === "image" ? (
                        <img src={chatMediaPreview} alt="Aperçu chat" className="max-h-[80px] object-cover" />
                      ) : (
                        <video src={chatMediaPreview} className="max-h-[80px] object-contain bg-black" />
                      )}
                      <button
                        type="button"
                        onClick={clearChatMedia}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md"
                        title="Supprimer"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={sendingChatMessage}
                      className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors shrink-0"
                      title="Importer photo/vidéo"
                    >
                      <Image size={16} />
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
                      className="flex-1 input-pill py-2.5 px-4 text-xs bg-slate-50 border border-slate-200"
                      disabled={sendingChatMessage}
                      required={!chatMediaFile}
                    />
                    <button
                      type="submit"
                      disabled={sendingChatMessage || (!chatMessageText.trim() && !chatMediaFile)}
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0 disabled:opacity-40 transition-all"
                    >
                      {sendingChatMessage ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 7. FULLSCREEN STORY VIEWER */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm h-[80vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4">
            
            {/* Top Bar (Info + Progess) */}
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex flex-col gap-3 z-30">
              
              {/* Ligne de progression */}
              <div className="w-full h-[3px] bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-100" style={{ width: `${storyProgress}%` }} />
              </div>

              {/* Infos Auteur */}
              <div className="flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
                    {selectedStory.author_display_name?.[0]?.toUpperCase() || selectedStory.author_username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold">
                      {selectedStory.author_display_name || selectedStory.author_username}
                    </h5>
                    <p className="text-[8px] text-white/60">@{selectedStory.author_username}</p>
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
            <div className="absolute bottom-4 inset-x-0 text-center text-white/50 text-[9px] font-medium z-30">
              Expire à {new Date(selectedStory.expires_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
