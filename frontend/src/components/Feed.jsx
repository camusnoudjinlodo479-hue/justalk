// frontend/src/components/Feed.jsx
// Fil d'actualité en temps réel combinant FastAPI et Supabase Realtime avec enregistrement photo/vidéo.

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
  Loader2
} from "lucide-react";

export default function Feed({ currentUser, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState("checking");

  // États pour l'enregistrement et l'importation de médias
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

  // Initialisation du client Supabase pour le Realtime et Storage
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  let supabase = null;
  if (supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://[PROJECT-ID].supabase.co") {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // Démarrer la webcam
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsRecording(false);
    } catch (err) {
      console.error("Erreur caméra :", err);
      setError("Impossible d'accéder à la caméra ou au micro. Veuillez vérifier vos autorisations.");
    }
  };

  // Arrêter la webcam
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsRecording(false);
    setMediaRecorder(null);
  };

  // Capturer une photo depuis le flux vidéo
  const takePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      // Dessin effet miroir car le flux caméra est retourné
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Réinitialiser

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
      console.error("Capture photo error :", err);
      setError("Échec de la capture de la photo.");
    }
  };

  // Démarrer l'enregistrement de vidéo
  const startRecording = () => {
    if (!stream) return;
    setError("");
    const chunks = [];
    
    try {
      const options = { mimeType: "video/webm;codecs=vp9" };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        } catch (e2) {
          recorder = new MediaRecorder(stream);
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
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
      console.error("Enregistrement error :", err);
      setError("Impossible de démarrer l'enregistrement vidéo.");
    }
  };

  // Arrêter l'enregistrement vidéo
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  // Gérer le minuteur d'enregistrement
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Lier le flux vidéo à l'élément du DOM
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Gérer l'importation de fichiers locaux
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const type = file.type;
    if (type.startsWith("image/")) {
      setMediaFile(file);
      setMediaType("image");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    } else if (type.startsWith("video/")) {
      setMediaFile(file);
      setMediaType("video");
      setMediaPreview(URL.createObjectURL(file));
      stopCamera();
    } else {
      setError("Veuillez choisir un fichier image ou vidéo valide.");
    }
  };

  // Nettoyer l'état du média
  const clearMedia = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Charger les publications depuis le backend FastAPI
  const fetchPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts");
      if (!res.ok) {
        throw new Error("Impossible de charger les publications depuis le serveur.");
      }
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Publier une publication via le backend FastAPI + Stockage Supabase
  const handlePublish = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;

    setPublishing(true);
    setError("");
    
    let imageUrl = null;
    let videoUrl = null;

    try {
      // Étape 1 : Téléversement vers Supabase Storage si un média est joint
      if (mediaFile && supabase) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("justalk")
          .upload(filePath, mediaFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Téléversement média échoué : ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from("justalk")
          .getPublicUrl(filePath);

        if (mediaType === "image") {
          imageUrl = publicUrl;
        } else if (mediaType === "video") {
          videoUrl = publicUrl;
        }
      }

      // Étape 2 : Envoyer le post au backend avec les URLs de médias
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
        throw new Error(errData.detail || "Échec de publication.");
      }

      setContent("");
      clearMedia();
      fetchPosts();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Effet d'initialisation : chargement des posts + écoute temps réel Supabase
  useEffect(() => {
    fetchPosts();

    if (!supabase) {
      setSupabaseStatus("disconnected");
      return;
    }

    setSupabaseStatus("connected");

    // Écouter les insertions de publications dans la table "posts"
    const channel = supabase
      .channel("public-posts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          console.log("Nouveau post détecté via Supabase Realtime :", payload.new);
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-bg flex flex-col">
      {/* Barre de navigation supérieure premium */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm z-40">
        <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-electric flex items-center justify-center text-white font-black text-xl shadow-glow">
              J
            </div>
            <span className="font-display font-black text-lg text-slate-800 tracking-tight">
              Justalk
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-electric/10 text-electric flex items-center justify-center font-bold text-sm">
                {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">
                  {currentUser?.display_name || currentUser?.username}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">@{currentUser?.username}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="icon-btn w-9 h-9 bg-slate-50 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-2xl w-full mx-auto pt-24 px-4 pb-12 flex flex-col gap-6">
        
        {/* Statut de Supabase Realtime */}
        {supabaseStatus === "disconnected" && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-500" />
            <span>
              Mode déconnecté : Les variables Supabase ne sont pas configurées dans .env. Les publications en temps réel sont désactivées (utilisez le bouton rafraîchir).
            </span>
          </div>
        )}

        {/* Composeur de publications */}
        <div className="card-lg bg-white p-5 flex flex-col gap-4 relative overflow-hidden">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-electric/10 text-electric flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || "U"}
            </div>
            
            <form onSubmit={handlePublish} className="flex-1 flex flex-col gap-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Quoi de neuf, ${currentUser?.display_name || currentUser?.username} ?`}
                className="w-full min-h-[80px] p-2 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none text-sm"
                maxLength={280}
                disabled={publishing}
              />

              {/* Aperçu Caméra en Direct */}
              {isCameraActive && (
                <div className="mt-2 border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 relative shadow-inner aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  
                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-md">
                      <span className="w-2 h-2 rounded-full bg-white block" />
                      <span>REC {formatTime(recordingTime)}</span>
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center gap-2">
                    {!isRecording ? (
                      <>
                        <button
                          type="button"
                          onClick={takePhoto}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-[11px] shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Camera size={13} />
                          Photo
                        </button>
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Video size={13} />
                          Enregistrer Vidéo
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-[11px] shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <X size={13} />
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] shadow-md transition-all active:scale-95 flex items-center gap-1.5 animate-pulse"
                      >
                        <StopCircle size={13} />
                        Arrêter et Enregistrer
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Aperçu du média capturé ou importé */}
              {mediaPreview && (
                <div className="mt-2 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 relative group max-h-[250px] flex items-center justify-center">
                  {mediaType === "image" ? (
                    <img
                      src={mediaPreview}
                      alt="Aperçu capture"
                      className="w-full max-h-[250px] object-cover rounded-2xl"
                    />
                  ) : (
                    <video
                      src={mediaPreview}
                      controls
                      className="w-full max-h-[250px] object-contain bg-slate-950 rounded-2xl"
                    />
                  )}
                  
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md"
                    title="Supprimer le média"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* Actions de publication */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isCameraActive || publishing}
                    className="icon-btn w-9 h-9 hover:bg-electric/10 hover:text-electric transition-colors"
                    title="Prendre une photo ou vidéo"
                  >
                    <Camera size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCameraActive || publishing}
                    className="icon-btn w-9 h-9 hover:bg-electric/10 hover:text-electric transition-colors"
                    title="Importer une image ou vidéo"
                  >
                    <Image size={16} />
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
                  <span className="text-xs text-slate-400 font-medium">
                    {280 - content.length}
                  </span>
                  <button
                    type="submit"
                    disabled={publishing || (!content.trim() && !mediaFile)}
                    className="btn-primary py-2 px-4 flex items-center gap-2 rounded-xl text-xs"
                  >
                    {publishing ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Publication...
                      </>
                    ) : (
                      <>
                        Publier
                        <Send size={13} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Titre du flux et bouton rafraîchir */}
        <div className="flex justify-between items-center px-1">
          <h2 className="font-display font-extrabold text-slate-800 text-lg flex items-center gap-2">
            <MessageSquare size={18} className="text-electric" />
            Fil d'actualité
          </h2>
          <button
            onClick={fetchPosts}
            className="icon-btn w-8 h-8 text-slate-400 hover:text-electric hover:bg-electric/5"
            title="Rafraîchir"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Liste des publications */}
        <div className="flex flex-col gap-4">
          {error && (
            <div className="card p-4 border-red-100 bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {posts.map((post) => (
            <div
              key={post.id}
              className="card bg-white p-5 flex flex-col gap-3 animate-in fade-in duration-300"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                    {post.author_display_name?.[0]?.toUpperCase() || post.author_username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {post.author_display_name || post.author_username}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                      @{post.author_username}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {new Date(post.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {new Date(post.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {post.content && (
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap pl-1">
                  {post.content}
                </p>
              )}

              {/* Rendu des images publiées */}
              {post.image_url && (
                <div className="mt-1.5 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shadow-inner max-h-[350px] flex items-center justify-center">
                  <img
                    src={post.image_url}
                    alt="Publication"
                    className="w-full h-auto max-h-[350px] object-cover hover:scale-[1.01] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Rendu des vidéos publiées */}
              {post.video_url && (
                <div className="mt-1.5 rounded-2xl overflow-hidden border border-slate-100 bg-slate-950 shadow-inner max-h-[350px] flex items-center justify-center">
                  <video
                    src={post.video_url}
                    controls
                    playsInline
                    className="w-full max-h-[350px] object-contain"
                  />
                </div>
              )}
            </div>
          ))}

          {posts.length === 0 && !loading && (
            <div className="card-lg bg-white p-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Shield size={28} className="text-electric/30" />
              <p className="text-sm font-semibold">Aucune publication pour le moment.</p>
              <p className="text-xs">Soyez le premier à écrire un message !</p>
            </div>
          )}

          {loading && posts.length === 0 && (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2 justify-center">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-electric rounded-full animate-spin" />
              <span className="text-xs font-semibold">Chargement des messages...</span>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

