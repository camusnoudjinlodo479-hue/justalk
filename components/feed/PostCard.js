"use client";
// components/feed/PostCard.js
import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";

export default function PostCard({ post, onLike, onComment, onShare }) {
  const [liked, setLiked] = useState(post.likedByMe || false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    onLike?.(post.id, next);
  }

  function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText.trim());
    setCommentText("");
  }

  const profileLink = post.authorId ? `/profil?id=${post.authorId}` : "#";

  return (
    <article className="card-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={profileLink} className="w-11 h-11 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric overflow-hidden shrink-0 hover:opacity-85 transition-opacity">
          {post.author?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            post.author?.pseudo?.[0]?.toUpperCase()
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={profileLink} className="font-semibold text-sm text-slate-800 hover:text-electric transition-colors truncate block">
            {post.author?.pseudo}
          </Link>
          <p className="text-xs text-slate-400">{post.createdAtLabel || "À l'instant"}</p>
        </div>
        <button className="icon-btn w-9 h-9">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Content */}
      {post.text && <p className="mt-3 text-slate-700 whitespace-pre-wrap">{post.text}</p>}
      {post.imageUrl && (
        <div className="mt-3 rounded-xl overflow-hidden bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="w-full max-h-[480px] object-cover" />
        </div>
      )}
      {post.videoUrl && (
        <div className="mt-3 rounded-xl overflow-hidden bg-bg">
          <video src={post.videoUrl} controls className="w-full max-h-[480px] object-cover rounded-xl" />
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
        <span>{likeCount} J'aime</span>
        <span>{post.commentsCount || 0} commentaires · {post.shares || 0} partages</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <ActionButton
          icon={Heart}
          label="J'aime"
          active={liked}
          onClick={toggleLike}
        />
        <ActionButton
          icon={MessageCircle}
          label="Commenter"
          onClick={() => setShowComments((s) => !s)}
        />
        <ActionButton icon={Share2} label="Partager" onClick={() => onShare?.(post.id)} />
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {(post.comments || []).map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <span className="font-semibold text-slate-700">{c.author}</span>
              <span className="text-slate-600">{c.text}</span>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex gap-2 mt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Écrire un commentaire…"
              className="input-pill bg-bg text-sm py-2"
            />
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Envoyer
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function ActionButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium flex-1 justify-center transition-colors ${
        active ? "text-electric bg-electric/5" : "text-slate-500 hover:bg-bg"
      }`}
    >
      <Icon size={18} fill={active ? "#2563EB" : "none"} /> {label}
    </button>
  );
}
