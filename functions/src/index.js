// functions/src/index.js
// Cloud Functions Justalk : notifications temps réel, purge des stories
// expirées (24h), et hygiène des données biométriques.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();
const db = getFirestore();

// --- Notification "like" : déclenchée quand le compteur "likes" augmente ---
exports.onPostLiked = onDocumentUpdated("posts/{postId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (after.likes <= before.likes) return;

  await db.collection("notifications").add({
    toUserId: after.authorId,
    fromPseudo: "Quelqu'un",
    type: "like",
    message: "a aimé ta publication",
    postId: event.params.postId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
});

// --- Notification "comment" : nouveau commentaire sur un post ---
exports.onCommentCreated = onDocumentCreated("posts/{postId}/comments/{commentId}", async (event) => {
  const comment = event.data.data();
  const postSnap = await db.collection("posts").doc(event.params.postId).get();
  const post = postSnap.data();
  if (!post || comment.authorId === post.authorId) return;

  await db.collection("notifications").add({
    toUserId: post.authorId,
    fromPseudo: comment.author || "Quelqu'un",
    type: "comment",
    message: "a commenté ta publication",
    postId: event.params.postId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await postSnap.ref.update({ commentsCount: FieldValue.increment(1) });
});

// --- Purge automatique des stories après 24h ---
exports.purgeExpiredStories = onSchedule("every 60 minutes", async () => {
  const now = new Date();
  const expired = await db.collection("stories").where("expiresAt", "<=", now).get();
  const batch = db.batch();
  expired.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
});
