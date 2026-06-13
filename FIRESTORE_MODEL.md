# Modèle de données Firestore — Justalk

## `users/{uid}`
```ts
{
  pseudo: string,
  firstName: string,
  lastName: string,
  displayName: string,             // "Prénom Nom"
  birthdate: string,                // "YYYY-MM-DD"
  birthdateVisibility: "private" | "public",  // privée par défaut
  bio: string | null,
  avatarUrl: string | null,
  coverUrl: string | null,
  online: boolean,
  lastSeen: Timestamp,
  createdAt: string,
  patternHash: string | null,        // SHA-256 du schéma 3x3 de secours
  authenticators: [                  // passkeys WebAuthn (lecture Admin SDK only)
    { credentialID: string, credentialPublicKey: string, counter: number }
  ]
}
```

## `biometricHashes/{uid}` (privé — jamais accessible côté client)
```ts
{
  uid: string,
  faceHash: string,    // SHA-256 du descripteur facial quantifié (anti-doublon)
  createdAt: string
}
```
> Aucune image ni vecteur brut n'est stocké — uniquement ce hash, utilisé pour
> bloquer la création d'un second compte avec le même visage.

## `posts/{postId}`
```ts
{
  authorId: string,
  author: { pseudo: string, avatarUrl: string|null },
  text: string,
  imageUrl: string | null,
  likes: number,
  commentsCount: number,
  shares: number,
  createdAt: Timestamp
}
```

### `posts/{postId}/comments/{commentId}`
```ts
{ authorId: string, author: string, text: string, createdAt: Timestamp }
```

## `stories/{storyId}`
```ts
{
  authorId: string,
  pseudo: string,
  avatarUrl: string | null,
  mediaUrl: string,     // image/vidéo 9:16
  createdAt: Timestamp,
  expiresAt: Timestamp  // createdAt + 24h, purge via Cloud Function planifiée
}
```

## `conversations/{convId}`
```ts
{
  members: [uid1, uid2],
  memberProfiles: [{ uid, pseudo, avatarUrl, online }],
  lastMessage: string,
  unread: { [uid]: number },
  updatedAt: Timestamp
}
```

### `conversations/{convId}/messages/{messageId}`
```ts
{ senderId: string, senderPseudo: string, text: string, createdAt: Timestamp }
```

## `groups/{groupId}`
```ts
{
  name: string,
  description: string,
  ownerId: string,
  moderators: [uid],
  members: [uid],
  createdAt: Timestamp
}
```

## `notifications/{notifId}`
```ts
{
  toUserId: string,
  fromPseudo: string,
  type: "like" | "comment" | "friend",
  message: string,
  postId: string | null,
  read: boolean,
  createdAt: Timestamp
}
```

## Index composites requis (Firestore)
- `posts`: `createdAt` desc (pour le scroll infini)
- `conversations`: `members` (array-contains) + `updatedAt` desc
- `notifications`: `toUserId` (==) + `createdAt` desc
