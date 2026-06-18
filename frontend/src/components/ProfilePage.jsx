// frontend/src/components/ProfilePage.jsx
import { useState, useEffect, useRef } from "react";
import { Camera, Loader2, Heart, MessageCircle, ShieldAlert, Sparkles, Send } from "lucide-react";

export default function ProfilePage({ currentUser, setCurrentUser, posts, onLike, onAddComment }) {
  const [userPosts, setUserPosts] = useState([]);
  const [updatingCover, setUpdatingCover] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Comments local state for user posts
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentText, setCommentText] = useState("");

  // Filter posts for this user
  useEffect(() => {
    const filtered = posts.filter(p => p.user_id === currentUser.id);
    setUserPosts(filtered);
  }, [posts, currentUser.id]);

  // Upload utility
  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Erreur lors de l'upload du fichier.");
    const data = await res.json();
    return data.url;
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpdatingCover(true);
    try {
      const publicUrl = await uploadMedia(file);
      const res = await fetch("/api/auth/profile/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_url: publicUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(prev => ({ ...prev, cover_url: data.cover_url }));
      }
    } catch (err) {
      alert(err.message || "Erreur de mise à jour de la photo de couverture.");
    } finally {
      setUpdatingCover(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpdatingAvatar(true);
    try {
      const publicUrl = await uploadMedia(file);
      const res = await fetch("/api/auth/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(prev => ({ ...prev, avatar_url: data.avatar_url }));
      }
    } catch (err) {
      alert(err.message || "Erreur de mise à jour de la photo de profil.");
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleCommentSubmitLocal = (e, postId) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(e, postId, commentText.trim());
    setCommentText("");
    setActiveCommentId(null);
  };

  return (
    <div className="w-full flex flex-col gap-6 max-w-2xl mx-auto page-content">
      
      {/* 1. SECTION COUVERTURE & AVATAR */}
      <div className="card p-0 overflow-hidden relative shadow-lg bg-slate-900/60 border border-white/5 rounded-3xl">
        {/* Photo de Couverture */}
        <div className="w-full h-48 sm:h-60 relative bg-gradient-to-r from-blue-900/80 via-slate-800 to-indigo-950/80 overflow-hidden">
          {currentUser.cover_url ? (
            <img src={currentUser.cover_url} alt="Couverture" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <Sparkles size={48} className="text-white" />
            </div>
          )}
          {updatingCover && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-semibold gap-2 z-10">
              <Loader2 className="animate-spin text-blue-500" size={16} />
              <span>Mise à jour...</span>
            </div>
          )}
          {/* Bouton modifier la couverture */}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 text-white flex items-center gap-1.5 transition-all text-[10px] font-bold shadow-md cursor-pointer z-10"
            disabled={updatingCover}
          >
            <Camera size={12} />
            <span>Modifier la couverture</span>
          </button>
          <input
            type="file"
            ref={coverInputRef}
            onChange={handleCoverChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Info Profil avec Avatar Superposé */}
        <div className="px-6 pb-6 pt-16 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          
          {/* Avatar positionné à cheval */}
          <div className="absolute -top-12 left-1/2 sm:left-8 -translate-x-1/2 sm:translate-x-0 w-24 h-24 rounded-full border-4 border-slate-900 bg-slate-800 shadow-xl overflow-hidden group">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-3xl bg-gradient-to-tr from-blue-600 to-indigo-600">
                {currentUser.display_name?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            
            {updatingAvatar && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                <Loader2 className="animate-spin text-blue-500" size={16} />
              </div>
            )}
            
            {/* Overlay Appareil photo */}
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-all"
            >
              <Camera size={18} />
            </div>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Noms de l'utilisateur */}
          <div className="text-center sm:text-left sm:pl-28">
            <h2 className="font-display font-extrabold text-lg text-white leading-tight">
              {currentUser.display_name || currentUser.username}
            </h2>
            <p className="text-xs text-slate-400">@{currentUser.username}</p>
          </div>
        </div>
      </div>

      {/* 2. MES PUBLICATIONS */}
      <div className="flex flex-col gap-4">
        <h3 className="font-display font-extrabold text-sm text-slate-200 pl-1">Mes publications</h3>

        <div className="flex flex-col gap-3.5">
          {userPosts.map((post) => (
            <div key={post.id} className="post-card card p-0">
              
              {/* En-tête du post */}
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {post.author_avatar_url ? (
                      <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      post.author_display_name?.[0]?.toUpperCase() || post.author_username?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 leading-snug">{post.author_display_name || post.author_username}</h4>
                    <span className="text-[8px] text-slate-500 leading-none">
                      {new Date(post.created_at).toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contenu du post */}
              {post.content && (
                <p className="px-4 pb-3 text-xs leading-relaxed text-slate-300 white-space-pre-wrap">{post.content}</p>
              )}

              {/* Média du post */}
              {post.image_url && (
                <div className="border-t border-b border-white/5 bg-black/10 overflow-hidden max-h-[380px] flex items-center justify-center">
                  <img src={post.image_url} alt="Publication" className="w-full object-contain max-h-[380px]" />
                </div>
              )}
              {post.video_url && (
                <div className="border-t border-b border-white/5 bg-black/10 overflow-hidden max-h-[380px] flex items-center justify-center">
                  <video src={post.video_url} controls className="w-full max-h-[380px]" />
                </div>
              )}

              {/* Statistiques rapides */}
              <div className="px-4 py-2.5 flex justify-between items-center text-[9px] text-slate-500 border-t border-white/5">
                <span>{post.likes_count} J'aime</span>
                <span>{post.comments ? post.comments.length : 0} Commentaires</span>
              </div>

              {/* Boutons d'actions */}
              <div className="px-2 py-1.5 flex gap-1 border-t border-white/5 bg-slate-900/10 shrink-0">
                <button
                  onClick={() => onLike(post.id)}
                  className={`post-action-btn ${post.is_liked ? 'liked' : ''}`}
                >
                  <Heart size={14} className={post.is_liked ? "fill-blue-500 text-blue-500" : ""} />
                  <span>J'aime</span>
                </button>
                <button
                  onClick={() => {
                    setActiveCommentId(activeCommentId === post.id ? null : post.id);
                  }}
                  className="post-action-btn"
                >
                  <MessageCircle size={14} />
                  <span>Commenter</span>
                </button>
              </div>

              {/* Formulaire & Liste commentaires */}
              {activeCommentId === post.id && (
                <div className="p-4 border-t border-white/5 bg-slate-900/20 flex flex-col gap-3">
                  {/* Formulaire commentaire */}
                  <form onSubmit={(e) => handleCommentSubmitLocal(e, post.id)} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Écrire un commentaire..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 input-pill bg-slate-900 text-xs py-2 px-3 border border-slate-800"
                      required
                    />
                    <button
                      type="submit"
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                    >
                      <Send size={12} />
                    </button>
                  </form>

                  {/* Liste commentaires */}
                  <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-none">
                    {post.comments && post.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 items-start text-[10px]">
                        <div className="w-6.5 h-6.5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[9px] shrink-0 border border-slate-700">
                          {comment.author_avatar_url ? (
                            <img src={comment.author_avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            comment.author_display_name?.[0]?.toUpperCase() || comment.author_username?.[0]?.toUpperCase() || "U"
                          )}
                        </div>
                        <div className="flex-1 bg-slate-900 rounded-xl p-2 border border-slate-800/80">
                          <p className="font-bold text-slate-300">{comment.author_display_name || comment.author_username}</p>
                          <p className="text-slate-400 mt-0.5 leading-relaxed">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {userPosts.length === 0 && (
            <div className="card text-center p-8 text-slate-500 text-xs flex flex-col items-center gap-1.5 bg-slate-900/20">
              <ShieldAlert size={20} className="text-slate-700" />
              <p>Aucune publication rédigée pour le moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
