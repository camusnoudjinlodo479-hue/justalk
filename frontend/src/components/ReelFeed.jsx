// frontend/src/components/ReelFeed.jsx
import { useState, useEffect, useRef } from "react";
import { Film, Plus, Upload, X, Loader2, ArrowLeft } from "lucide-react";
import ReelPlayer from "./ReelPlayer";

export default function ReelFeed({ currentUser }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Upload States
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef(null);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reels");
      if (res.ok) {
        const data = await res.json();
        setReels(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des reels:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  const handleScroll = (e) => {
    const container = e.target;
    const height = container.clientHeight;
    if (height === 0) return;
    const scrollPosition = container.scrollTop;
    const newIndex = Math.round(scrollPosition / height);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      setActiveIndex(newIndex);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      alert("Veuillez sélectionner un fichier vidéo uniquement.");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const clearUpload = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    setDescription("");
    setUploadProgress("");
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || uploading) return;

    setUploading(true);
    setUploadProgress("Téléversement de la vidéo...");
    try {
      // 1. Upload video file
      const formData = new FormData();
      formData.append("file", videoFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Erreur lors de l'envoi du fichier.");
      const uploadData = await uploadRes.json();
      
      setUploadProgress("Création du Reel...");

      // 2. Create Reel object
      const reelRes = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: uploadData.url,
          description: description.trim(),
        }),
      });

      if (!reelRes.ok) throw new Error("Erreur de création du Reel.");
      const newReel = await reelRes.json();

      // Update state
      setReels(prev => [newReel, ...prev]);
      setShowUploadForm(false);
      clearUpload();
      setActiveIndex(0);
    } catch (err) {
      alert(err.message || "Impossible de publier le Reel.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 max-w-lg mx-auto page-content">
      
      {/* En-tête Reels */}
      <div className="flex justify-between items-center bg-slate-900/40 border border-white/5 rounded-2xl p-4 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <Film className="text-blue-500" size={20} />
          <h2 className="font-display font-extrabold text-base text-white">Reels</h2>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="btn-primary py-2 px-3 text-[10px] rounded-xl flex items-center gap-1.5"
        >
          <Plus size={13} />
          Créer un Reel
        </button>
      </div>

      {/* Vue défilement Reels */}
      {!showUploadForm ? (
        loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-xs font-semibold">Chargement des Reels...</span>
          </div>
        ) : reels.length > 0 ? (
          <div
            onScroll={handleScroll}
            className="reels-container"
          >
            {reels.map((reel, index) => (
              <ReelPlayer
                key={reel.id}
                reel={reel}
                isActive={index === activeIndex}
                currentUser={currentUser}
              />
            ))}
          </div>
        ) : (
          <div className="card-lg bg-slate-900/20 text-center py-16 text-slate-400 flex flex-col items-center gap-2">
            <Film size={36} className="text-slate-700" />
            <p className="text-sm font-semibold">Aucun Reel publié pour le moment.</p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="mt-2 text-blue-500 font-bold text-xs hover:underline"
            >
              Publiez le tout premier Reel !
            </button>
          </div>
        )
      ) : (
        /* Formulaire d'upload */
        <div className="card bg-slate-900 border border-white/10 rounded-3xl p-6 flex flex-col gap-4 animate-scaleIn">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { setShowUploadForm(false); clearUpload(); }}
              className="p-1 rounded-full hover:bg-slate-800 text-slate-400"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="font-display font-extrabold text-sm text-white">Créer un Reel</h3>
          </div>

          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />

            {!videoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-slate-950/60"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Upload size={22} />
                </div>
                <p className="text-xs font-bold text-slate-300">Importer une vidéo</p>
                <p className="text-[10px] text-slate-500">Glisser-déposer ou cliquer pour naviguer</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[300px] flex items-center justify-center border border-slate-800">
                <video src={videoPreview} controls className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={clearUpload}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <textarea
                placeholder="Exprimez-vous dans votre Reel..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[80px] input-pill bg-slate-950 border-slate-800 text-xs py-3.5 focus:bg-slate-900"
                maxLength={200}
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-2xl">
                <Loader2 size={14} className="animate-spin" />
                <span>{uploadProgress}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !videoFile}
              className="btn-primary w-full py-3.5"
            >
              {uploading ? "Publication en cours..." : "Partager le Reel"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
