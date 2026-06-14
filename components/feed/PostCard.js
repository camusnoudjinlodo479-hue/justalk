"use client";
// components/feed/PostCard.js
import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function PostCard({ post, onLike, onShare }) {
  const { user: currentUser } = useCurrentUser();
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const liked = post.likedByMe || false;
  const likeCount = post.likes || 0;

  useEffect(() => {
    if (!post.id || !showComments) return;
    setLoadingComments(true);
    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingComments(false);
      },
      (err) => {
        console.error("Erreur de récupération des commentaires :", err);
        setLoadingComments(false);
      }
    );
    return () => unsub();
  }, [post.id, showComments]);

  function toggleLike() {
    onLike?.(post.id, !liked);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;
    try {
      await addDoc(collection(db, "posts", post.id, "comments"), {
        authorId: currentUser.uid,
        author: currentUser.displayName || currentUser.pseudo,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      setCommentText("");
    } catch (err) {
      console.error("Erreur lors de la publication du commentaire :", err);
    }
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
          {loadingComments && <p className="text-xs text-slate-400">Chargement des commentaires…</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm leading-relaxed">
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
