# Justalk — "Just you. Justalk."

Réseau social full-stack avec **inscription/connexion 100% biométrique**
(WebAuthn + face-api.js), fil d'actualité, profil, Messenger temps réel,
Stories, Groupes/Pages et Notifications. Next.js 14 (App Router) + Tailwind +
Framer Motion + Supabase.

## 🎨 Branding

| Élément | Valeur |
|---|---|
| Couleur principale | `#2563EB` (Bleu électrique) |
| Fond | `#F0F2F5` |
| Cards | Blanc, effet **Electric Embossed** (`shadow-embossed` / `shadow-embossed-lg` dans `tailwind.config.js`) |
| Slogan | *Just you. Justalk.* |
| Logo | Bulle de chat bleue avec icône visage/empreinte (`components/Logo.js`) |

## 🧱 Structure du projet

```
justalk/
├── app/
│   ├── page.js                  # Connexion (auto-reconnexion biométrique)
│   ├── onboarding/page.js       # Inscription en 3 étapes
│   ├── feed/page.js             # Fil d'actualité + scroll infini
│   ├── profil/page.js           # Profil (cover, bio, posts, amis, photos)
│   ├── messenger/page.js        # Messenger temps réel
│   ├── stories/page.js          # Stories 9:16
│   ├── groupes/page.js          # Groupes / Pages
│   ├── notifications/page.js    # Notifications
│   └── api/
│       ├── webauthn/{register-options,register-verify,login-options,login-verify}
│       ├── session/check
│       └── profile/create
├── components/
│   ├── Logo.js
│   ├── onboarding/{FaceScanStep,PatternLockStep,ProfileSetupStep}.js
│   ├── layout/{Header,LeftSidebar,RightSidebar}.js
│   ├── feed/{StoryBar,CreatePost,PostCard}.js
│   └── messenger/{ConversationList,ChatWindow}.js
├── lib/
│   ├── supabase.js       # Client Supabase (anon & admin)
│   ├── webauthn.js       # wrapper @simplewebauthn/browser
│   ├── faceMatch.js       # face-api.js -> descripteur -> hash SHA-256
│   ├── session.js        # JWT httpOnly (jose)
│   └── useCurrentUser.js
└── middleware.js          # protège /feed, /messenger, etc.
```

## 🔐 Flux biométrique

### Inscription (`/onboarding`)
1. **Scan du visage** : déclenche directement **Face ID / Windows Hello /
   Touch ID** natif du navigateur via WebAuthn
   (`authenticatorAttachment: "platform"`). C'est l'OS (Secure Enclave / TPM)
   qui effectue la reconnaissance faciale — Justalk ne reçoit, ne voit ni ne
   stocke jamais d'image ou de donnée biométrique brute.
2. `/api/webauthn/register-verify` vérifie l'attestation, crée
   `users/{uid}`, puis pose un cookie JWT **httpOnly**.
3. **Étape schéma 3x3** : si la biométrie native est indisponible
   (`platformAuthenticatorIsAvailable() === false`), un schéma 3x3 (canvas)
   est demandé en secours et son hash SHA-256 stocké dans `users/{uid}.patternHash`.
4. **Étape profil** : pseudo + photo (upload Storage via client Supabase). Zéro
   email, zéro mot de passe à aucun moment.

> Option avancée : `lib/webauthn.js` accepte toujours un `faceHash` optionnel
> (descripteur face-api.js) pour un anti-doublon facial multi-comptes, mais
> ce n'est plus requis par défaut.

### Connexion (`/`)
- Au chargement, `/api/session/check` tente une reconnexion silencieuse via
  le cookie JWT.
- Sinon, bouton "Se connecter" → `startAuthentication()` (discoverable
  credentials, aucun identifiant à saisir) → `/api/webauthn/login-verify`
  retrouve l'utilisateur via le `credentialID` et repose le cookie JWT.

## 🔒 Sécurité & RGPD

- **Aucune photo de visage n'est stockée.** Seul un hash SHA-256 du
  descripteur facial (`biometricHashes/{uid}.faceHash`) est conservé,
  utilisé exclusivement pour bloquer les comptes en double.
- Le schéma 3x3 de secours est également haché (`users/{uid}.patternHash`),
  jamais stocké en clair.
- `biometric_hashes` n'est accessible ni en lecture ni en écriture côté
  client (via RLS) — uniquement via le client Admin de Supabase dans les routes API.
- Session : JWT signé (`JWT_SECRET`), cookie `httpOnly`, `secure` en
  production, `sameSite=lax`, expiration 30 jours (reconnexion auto).
- `middleware.js` protège toutes les routes applicatives.

## 🚀 Déploiement

### 1. Configuration SQL Supabase
Créez un projet sur Supabase, puis exécutez le script SQL complet disponible dans le fichier [SUPABASE_MODEL.md](file:///c:/Users/Admin/OneDrive/Documents/Desktop/justalk/SUPABASE_MODEL.md) dans l'éditeur SQL de votre projet Supabase.

### 2. Modèles face-api.js
Télécharger les modèles depuis le repo officiel face-api.js et les placer
dans `public/models/` (voir `public/models/README.txt`).

### 3. Variables d'environnement
Copier `.env.example` → `.env.local` et renseigner :
- Clés Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `JWT_SECRET` (chaîne aléatoire longue)
- `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` (⚠️ doivent matcher exactement le
  domaine de prod, ex: `justalk.app` / `https://justalk.app`)

### 4. Vercel
```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL ...   # toutes les variables de .env.example
vercel --prod
```
> ⚠️ WebAuthn nécessite **HTTPS** (sauf `localhost`). Vérifie que
> `WEBAUTHN_RP_ID` correspond au domaine Vercel/custom domain final.

### 5. Local
```bash
npm install
npm run dev
# http://localhost:3000
```

## 📹 Appels audio/vidéo (WebRTC)

- **P2P direct** (`RTCPeerConnection`), signalisation via Supabase (tables
  `calls` et `call_candidates`), donc **aucun coût de serveur média** pour le
  streaming lui-même.
- **Qualité adaptative automatique** (`lib/bandwidth.js`) : mesure le débit
  réel toutes les 8s et choisit le meilleur profil parmi audio-only / 480p /
  720p / 1080p / **4K**.
- **Codec AV1 > VP9 > H.264** (`getPreferredCodecs`) — AV1/VP9 offrent la
  meilleure qualité par Mbps, ce qui réduit la consommation de données *pour
  une qualité donnée*, sans rendre la 4K "gratuite" en bande passante.
- ⚠️ **Réalité technique** : la 4K nécessite ~12-15 Mbps stables (même avec
  AV1). Sous ce seuil, Justalk bascule automatiquement vers 1080p/720p/480p
  pour garder l'appel fluide. L'utilisateur peut forcer un profil manuel
  (ex: "Audio seul" pour une consommation minimale en 4G).
- **TURN recommandé en prod** : ajouter vos identifiants TURN dans
  `lib/webrtc.js` (`ICE_SERVERS`) — sans TURN, certains appels échouent sur
  réseaux 4G/NAT symétriques.

## 📲 Installer Justalk sur ton téléphone

`localhost` n'existe que sur ton PC — pour ouvrir l'app sur ton téléphone, elle
doit être en ligne. Une fois déployée (Vercel, voir ci-dessus), Justalk est
une **PWA** (Progressive Web App) installable comme une vraie app :

### Android (Chrome)
1. Ouvre l'URL Vercel sur ton téléphone
2. Menu (⋮) → **"Installer l'application"** (ou "Ajouter à l'écran d'accueil")
3. L'icône Justalk apparaît sur ton écran d'accueil, ouverture en plein écran

### iPhone (Safari — obligatoire, pas Chrome)
1. Ouvre l'URL Vercel dans **Safari**
2. Bouton Partager (carré + flèche) → **"Sur l'écran d'accueil"**
3. L'app s'ouvre sans barre d'adresse, comme une app native

> ⚠️ La biométrie WebAuthn (Face ID/Touch ID/empreinte) fonctionne uniquement
> en **HTTPS** — Vercel fournit ça automatiquement. `localhost` en HTTP
> fonctionne aussi pour les tests sur PC, mais pas pour un accès via réseau
> local (`http://192.168.x.x`) sans certificat.

### Déploiement rapide sur Render (au lieu de Vercel)
1. Pousse le projet sur GitHub (Render se connecte à un repo Git)
2. Sur https://dashboard.render.com → **New → Web Service** → connecte ton repo
3. Render détecte `render.yaml` automatiquement, ou configure manuellement :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm run start`
   - **Node version** : 20
4. Dans **Environment**, ajoute toutes les variables de `.env.example`
   (Firebase, `JWT_SECRET`, etc.)
5. ⚠️ **`WEBAUTHN_RP_ID`** et **`WEBAUTHN_ORIGIN`** doivent correspondre
   exactement à l'URL Render finale, ex :
   ```
   WEBAUTHN_RP_ID=justalk.onrender.com
   WEBAUTHN_ORIGIN=https://justalk.onrender.com
   ```
   (mets-les à jour **après** le premier déploiement, une fois l'URL connue,
   puis redéploie)
6. Render fournit HTTPS automatiquement sur `*.onrender.com` → WebAuthn/Face
   ID fonctionnera directement.

> ℹ️ Le plan gratuit Render met le service en veille après inactivité
> (premier chargement plus lent ~30s). Pour un usage régulier, passe au plan
> payant ou utilise un "pinger" externe.

### Déploiement rapide sur Vercel (alternative)
```bash
npm install -g vercel
vercel login
vercel        # suit les instructions, lie le dossier justalk
vercel env add NEXT_PUBLIC_SUPABASE_URL
# ... ajoute toutes les variables de .env.example
vercel --prod
```
Vercel te donne une URL du type `https://justalk-xxxx.vercel.app` — ouvre-la
sur ton téléphone.

> 🎨 Les icônes dans `public/icons/` sont des placeholders générés
> automatiquement — remplace-les par ton vrai logo Justalk avant la mise en
> production (192x192, 512x512, et versions "maskable" avec marge de
> sécurité).

## 📱 Responsive

Mobile-first via Tailwind (`sm:`, `md:`, `lg:`, `xl:`). Header compact +
navigation bottom implicite sur mobile, sidebars masquées (`hidden lg:flex` /
`hidden xl:flex`) et réapparaissant en desktop. Testé visuellement pour
Chrome Android et Safari iOS (WebAuthn platform authenticator = Face
ID/Touch ID sur iOS, biométrie Android intégrée).
