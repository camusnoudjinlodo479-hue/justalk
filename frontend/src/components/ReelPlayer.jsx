// frontend/src/components/ReelPlayer.jsx
import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Send, X, Loader2, Play, Pause } from "lucide-react";

export default function ReelPlayer({ reel, isActive, onLikeToggle, currentUser }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(reel.comments || []);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(reel.is_liked);
  const [likesCount, setLikesCount] = useState(reel.likes_count);
  const [commentsCount, setCommentsCount] = useState(reel.comments_count || 0);

  // Play/pause based on active prop
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((err) => console.log("Auto-play blocked:", err));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error(err));
    }
  };

  const handleLikeClick = async () => {
    // Optimistic UI update
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : prev - 1);
    
    try {
      const res = await fetch(`/api/reels/${reel.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Sync with real backend response if needed
      setIsLiked(data.action === "liked");
    } catch {
      // Revert on error
      setIsLiked(!nextLiked);
      setLikesCount(prev => !nextLiked ? prev + 1 : prev - 1);
    }
  };

  // Double click to like
  const lastTap = useRef(0);
  const handleVideoTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!isLiked) {
        handleLikeClick();
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    } else {
      // Single tap - toggle play/pause
      togglePlay();
    }
    lastTap.current = now;
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || sendingComment) return;

    setSendingComment(true);
    try {
      const res = await fetch(`/api/reels/${reel.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        const added = await res.json();
        setComments(prev => [...prev, added]);
        setCommentsCount(prev => prev + 1);
        setNewComment("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="reel-item">
      {/* Lecteur Vidéo */}
      <video
        ref={videoRef}
        src={reel.video_url}
        onClick={handleVideoTap}
        loop
        playsInline
        webkit-playsinline="true"
        className="reel-video cursor-pointer"
      />

      {/* Indicateur Play/Pause temporaire au centre */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="p-4 rounded-full bg-black/50 text-white animate-scaleIn">
            <Play size={32} />
          </div>
        </div>
      )}

      {/* Animation Double Clic Coeur */}
      {showHeartAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart size={80} className="text-red-500 fill-red-500 animate-ping" />
        </div>
      )}

      {/* Dégradé et infos du bas */}
      <div className="reel-overlay pointer-events-none">
        <div className="pointer-events-auto max-w-[80%] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-md">
              {reel.author_avatar_url ? (
                <img src={reel.author_avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                reel.author_display_name?.[0]?.toUpperCase() || reel.author_username?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-white text-shadow">{reel.author_display_name || reel.author_username}</p>
              <p className="text-[10px] text-slate-300 text-shadow">@{reel.author_username}</p>
            </div>
          </div>
          <p className="text-xs text-white leading-relaxed text-shadow font-medium">
            {reel.description || "Pas de description."}
          </p>
        </div>
      </div>

      {/* Actions de droite */}
      <div className="reel-actions">
        {/* Like Action */}
        <button onClick={handleLikeClick} className="reel-action-btn">
          <div className={`reel-action-icon ${isLiked ? 'liked' : ''}`}>
            <Heart size={20} className={isLiked ? "fill-red-500 text-red-500" : ""} />
          </div>
          <span>{likesCount}</span>
        </button>

        {/* Comment Action */}
        <button onClick={() => setShowComments(true)} className="reel-action-btn">
          <div className="reel-action-icon">
            <MessageCircle size={20} />
          </div>
          <span>{commentsCount}</span>
        </button>
      </div>

      {/* Drawer de Commentaires (Overlay coulissant) */}
      {showComments && (
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-slate-950/95 backdrop-blur-md border-t border-slate-800 rounded-t-[2rem] z-30 flex flex-col p-4 animate-scaleIn">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-2 shrink-0">
            <h4 className="font-display font-extrabold text-xs text-white flex items-center gap-2">
              <MessageCircle size={14} className="text-blue-500" />
              Commentaires ({commentsCount})
            </h4>
            <button
              onClick={() => setShowComments(false)}
              className="p-1 rounded-full hover:bg-slate-800 text-slate-400"
            >
              <X size={15} />
            </button>
          </div>

          {/* Liste des commentaires */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 py-2 scrollbar-none pr-1">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-700">
                  {comment.author_avatar_url ? (
                    <img src={comment.author_avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    comment.author_display_name?.[0]?.toUpperCase() || comment.author_username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="flex-1 bg-slate-900 rounded-2xl p-2.5 border border-slate-800/80">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className="text-[10px] font-bold text-slate-200">{comment.author_display_name || comment.author_username}</p>
                    <span className="text-[8px] text-slate-500">
                      {new Date(comment.created_at).toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-center text-[10px] text-slate-500 italic py-8">Aucun commentaire. Soyez le premier à réagir !</p>
            )}
          </div>

          {/* Formulaire commentaire */}
          <form onSubmit={submitComment} className="flex gap-2 items-center border-t border-slate-800 pt-3 mt-2 shrink-0">
            <input
              type="text"
              placeholder="Votre commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 input-pill bg-slate-900 border-slate-800 text-[11px] py-2.5"
              required
              disabled={sendingComment}
            />
            <button
              type="submit"
              disabled={sendingComment || !newComment.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors shrink-0"
            >
              {sendingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
