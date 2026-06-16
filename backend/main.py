# backend/main.py
# Fichier d'entrée principal FastAPI gérant les routes WebAuthn, les publications et les sessions.

import os
import json
import uuid
import time
from datetime import datetime, timedelta, timezone
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Chargement du fichier .env situé à la racine du projet
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path)
from typing import Dict, Any, List
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Importations WebAuthn
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes

# Importations locales
import database
import models
import schemas
import auth

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=database.engine)
    yield

app = FastAPI(title="Justalk API", version="1.0.0", lifespan=lifespan)

# Récupération des configurations d'environnement
WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "Justalk")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:5173")

# Dictionnaire en mémoire pour stocker les challenges temporaires (clé: username, valeur: dict challenge)
challenges_db: Dict[str, Dict[str, Any]] = {}

# Middleware CORS pour permettre au frontend React de requêter
cors_origins = [
    WEBAUTHN_ORIGIN,
    "http://localhost:5173",
    "http://localhost:8000",
    "https://justalk.onrender.com",
    "https://k.onrender.com"
]
cors_origins = list(set([o for o in cors_origins if o]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Enregistrement / Inscription WebAuthn ---

@app.post("/api/webauthn/register-options")
def get_register_options(req: schemas.RegistrationOptionsRequest, db: Session = Depends(database.get_db)):
    """Étape 1 Inscription : Génère le challenge WebAuthn."""
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Le pseudo est obligatoire.")
    
    # Vérification d'unicité
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà pris.")
    
    user_uuid = uuid.uuid4()
    
    try:
        options = generate_registration_options(
            rp_id=WEBAUTHN_RP_ID,
            rp_name=WEBAUTHN_RP_NAME,
            user_id=user_uuid.bytes,
            user_name=username,
            user_display_name=req.display_name or username,
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,  # FaceID/TouchID/Windows Hello
                resident_key=ResidentKeyRequirement.REQUIRED,               # Passkeys requis
                user_verification=UserVerificationRequirement.REQUIRED
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération des options : {str(e)}")
    
    # Stocker le challenge en mémoire pour validation à l'étape 2
    challenges_db[username] = {
        "challenge": options.challenge,
        "user_id": str(user_uuid),
        "display_name": req.display_name or username
    }
    
    return json.loads(options_to_json(options))


@app.post("/api/webauthn/register-verify")
def verify_register(req: schemas.RegistrationVerificationRequest, response: Response, db: Session = Depends(database.get_db)):
    """Étape 2 Inscription : Vérifie l'attestation, crée l'utilisateur et ouvre sa session."""
    username = req.username.strip()
    
    stored = challenges_db.pop(username, None)
    if not stored:
        raise HTTPException(status_code=400, detail="Challenge introuvable ou expiré. Veuillez recommencer.")
    
    expected_challenge = stored["challenge"]
    user_id_str = stored["user_id"]
    display_name = stored["display_name"]
    
    try:
        verification = verify_registration_response(
            credential=req.registration_response,
            expected_challenge=expected_challenge,
            expected_origin=WEBAUTHN_ORIGIN,
            expected_rp_id=WEBAUTHN_RP_ID
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Vérification WebAuthn échouée : {str(e)}")
    
    try:
        # Création de l'utilisateur
        db_user = models.User(
            id=uuid.UUID(user_id_str),
            username=username,
            display_name=display_name
        )
        db.add(db_user)
        
        # Enregistrement du credential
        pub_key_b64 = bytes_to_base64url(verification.credential_public_key)
        cred_id_b64 = bytes_to_base64url(verification.credential_id)
        
        db_cred = models.Credential(
            id=cred_id_b64,
            user_id=db_user.id,
            public_key=pub_key_b64,
            sign_count=verification.sign_count
        )
        db.add(db_cred)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture en base de données : {str(e)}")
    
    # Création du cookie de session
    token = auth.create_session_token(str(db_user.id))
    response.set_cookie(
        key=auth.COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=WEBAUTHN_ORIGIN.startswith("https")
    )
    
    return {"status": "success", "user_id": str(db_user.id)}


# --- Connexion / Authentification WebAuthn ---

@app.post("/api/webauthn/login-options")
def get_login_options(req: schemas.AuthenticationOptionsRequest, db: Session = Depends(database.get_db)):
    """Étape 1 Connexion : Génère le challenge d'authentification."""
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Le pseudo est obligatoire.")
    
    # Recherche de l'utilisateur
    db_user = db.query(models.User).filter(models.User.username == username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Pseudo introuvable.")
    
    # Récupération de ses credentials
    db_creds = db.query(models.Credential).filter(models.Credential.user_id == db_user.id).all()
    if not db_creds:
        raise HTTPException(status_code=400, detail="Aucune clé WebAuthn enregistrée pour cet utilisateur.")
    
    allow_credentials = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.id))
        for cred in db_creds
    ]
    
    try:
        options = generate_authentication_options(
            rp_id=WEBAUTHN_RP_ID,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de génération des options d'auth : {str(e)}")
    
    challenges_db[username] = {
        "challenge": options.challenge,
        "user_id": str(db_user.id)
    }
    
    return json.loads(options_to_json(options))


@app.post("/api/webauthn/login-verify")
def verify_login(req: schemas.AuthenticationVerificationRequest, response: Response, db: Session = Depends(database.get_db)):
    """Étape 2 Connexion : Vérifie l'assertion de l'appareil et crée la session."""
    username = req.username.strip()
    
    stored = challenges_db.pop(username, None)
    if not stored:
        raise HTTPException(status_code=400, detail="Challenge expiré ou invalide.")
    
    expected_challenge = stored["challenge"]
    user_id_str = stored["user_id"]
    
    credential_id_b64 = req.authentication_response.get("id")
    if not credential_id_b64:
        raise HTTPException(status_code=400, detail="ID de clé manquant.")
    
    # Recherche de l'authentificateur
    db_cred = db.query(models.Credential).filter(
        models.Credential.id == credential_id_b64,
        models.Credential.user_id == uuid.UUID(user_id_str)
    ).first()
    
    if not db_cred:
        raise HTTPException(status_code=404, detail="Authentificateur non reconnu pour ce compte.")
    
    try:
        verification = verify_authentication_response(
            credential=req.authentication_response,
            expected_challenge=expected_challenge,
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
            credential_public_key=base64url_to_bytes(db_cred.public_key),
            credential_current_sign_count=db_cred.sign_count
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentification refusée : {str(e)}")
    
    # Mise à jour du compteur anti-replay
    db_cred.sign_count = verification.new_sign_count
    db.commit()
    
    # Création du cookie de session
    token = auth.create_session_token(user_id_str)
    response.set_cookie(
        key=auth.COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=WEBAUTHN_ORIGIN.startswith("https")
    )
    
    return {"status": "success", "user_id": user_id_str}


# --- Sessions et Infos Utilisateurs ---

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Renvoie les informations de l'utilisateur connecté."""
    return current_user


@app.post("/api/auth/logout")
def logout(response: Response):
    """Déconnecte l'utilisateur en supprimant son cookie de session."""
    response.delete_cookie(
        key=auth.COOKIE_NAME,
        path="/",
        samesite="lax"
    )
    return {"status": "success"}


# --- Publications (Posts) ---

@app.get("/api/posts", response_model=List[schemas.PostResponse])
def get_posts(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Liste les publications du fil d'actualité enrichies avec les likes et les commentaires."""
    posts = db.query(models.Post).order_by(models.Post.created_at.desc()).limit(50).all()
    
    response_list = []
    for post in posts:
        author = post.author
        likes_count = len(post.likes)
        is_liked = any(like.user_id == current_user.id for like in post.likes)
        
        comments_list = []
        for comment in post.comments:
            c_author = comment.user
            comments_list.append(
                schemas.CommentResponse(
                    id=comment.id,
                    post_id=comment.post_id,
                    user_id=comment.user_id,
                    content=comment.content,
                    created_at=comment.created_at,
                    author_username=c_author.username,
                    author_display_name=c_author.display_name
                )
            )
            
        response_list.append(
            schemas.PostResponse(
                id=post.id,
                content=post.content,
                image_url=post.image_url,
                video_url=post.video_url,
                created_at=post.created_at,
                user_id=post.user_id,
                author_username=author.username,
                author_display_name=author.display_name,
                likes_count=likes_count,
                is_liked=is_liked,
                comments=comments_list
            )
        )
    return response_list


@app.post("/api/posts", response_model=schemas.PostResponse)
def create_post(req: schemas.PostCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Crée une nouvelle publication pour l'utilisateur connecté."""
    content = req.content.strip() if req.content else None
    if not content and not req.image_url and not req.video_url:
        raise HTTPException(status_code=400, detail="La publication ne peut pas être vide.")
    
    try:
        db_post = models.Post(
            user_id=current_user.id,
            content=content,
            image_url=req.image_url,
            video_url=req.video_url
        )
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'enregistrement du post : {str(e)}")
        
    return schemas.PostResponse(
        id=db_post.id,
        content=db_post.content,
        image_url=db_post.image_url,
        video_url=db_post.video_url,
        created_at=db_post.created_at,
        user_id=db_post.user_id,
        author_username=current_user.username,
        author_display_name=current_user.display_name,
        likes_count=0,
        is_liked=False,
        comments=[]
    )


# --- Endpoint Téléversement Backend (Upload) ---

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    """Téléverse un fichier image ou vidéo sur le stockage Supabase."""
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Configuration Supabase manquante dans le backend.")
        
    try:
        contents = await file.read()
        file_ext = file.filename.split(".")[-1]
        file_name = f"{current_user.id}_{int(time.time())}.{file_ext}"
        file_path = f"posts/{file_name}"
        
        upload_url = f"{supabase_url}/storage/v1/object/justalk/{file_path}"
        
        req = urllib.request.Request(upload_url, data=contents, method="POST")
        req.add_header("apikey", service_key)
        req.add_header("Authorization", f"Bearer {service_key}")
        req.add_header("Content-Type", file.content_type)
        
        with urllib.request.urlopen(req) as res:
            res.read()
            
        public_url = f"{supabase_url}/storage/v1/object/public/justalk/{file_path}"
        return {"url": public_url}
        
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"Supabase upload HTTP error: {e.code} - {err_msg}")
        raise HTTPException(status_code=500, detail=f"Téléversement Supabase échoué: {err_msg}")
    except Exception as e:
        print(f"Supabase upload generic error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur de téléversement: {str(e)}")


# --- Endpoints Stories (Stories de 24 heures) ---

@app.post("/api/stories", response_model=schemas.StoryResponse)
def create_story(req: schemas.StoryCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Crée une nouvelle story qui expire dans 24 heures."""
    try:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        
        db_story = models.Story(
            user_id=current_user.id,
            media_url=req.media_url,
            created_at=now,
            expires_at=expires_at
        )
        db.add(db_story)
        db.commit()
        db.refresh(db_story)
        
        return schemas.StoryResponse(
            id=db_story.id,
            user_id=db_story.user_id,
            media_url=db_story.media_url,
            created_at=db_story.created_at,
            expires_at=db_story.expires_at,
            author_username=current_user.username,
            author_display_name=current_user.display_name,
            is_viewed=False
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur de création de story: {str(e)}")


@app.get("/api/stories", response_model=List[schemas.StoryResponse])
def get_stories(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère toutes les stories actives (< 24h)."""
    now = datetime.now(timezone.utc)
    stories = db.query(models.Story).filter(models.Story.expires_at > now).order_by(models.Story.created_at.desc()).all()
    
    response_list = []
    for story in stories:
        author = story.author
        is_viewed = any(view.user_id == current_user.id for view in story.views)
        
        response_list.append(
            schemas.StoryResponse(
                id=story.id,
                user_id=story.user_id,
                media_url=story.media_url,
                created_at=story.created_at,
                expires_at=story.expires_at,
                author_username=author.username,
                author_display_name=author.display_name,
                is_viewed=is_viewed
            )
        )
    return response_list


@app.post("/api/stories/{story_id}/view")
def view_story(story_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Marque une story comme vue par l'utilisateur connecté."""
    existing = db.query(models.StoryView).filter(
        models.StoryView.story_id == story_id,
        models.StoryView.user_id == current_user.id
    ).first()
    
    if not existing:
        try:
            db_view = models.StoryView(
                story_id=story_id,
                user_id=current_user.id
            )
            db.add(db_view)
            db.commit()
        except Exception as e:
            db.rollback()
            pass
            
    return {"status": "success"}


# --- Endpoints Likes & Commentaires ---

@app.post("/api/likes")
def toggle_like(req: schemas.LikeCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Ajoute ou supprime un J'aime sur un post (toggle)."""
    existing = db.query(models.Like).filter(
        models.Like.post_id == req.post_id,
        models.Like.user_id == current_user.id
    ).first()
    
    try:
        if existing:
            db.delete(existing)
            db.commit()
            action = "unliked"
        else:
            db_like = models.Like(
                post_id=req.post_id,
                user_id=current_user.id
            )
            db.add(db_like)
            
            post = db.query(models.Post).filter(models.Post.id == req.post_id).first()
            if post and post.user_id != current_user.id:
                db_notif = models.Notification(
                    user_id=post.user_id,
                    content=f"@{current_user.username} a aimé votre publication."
                )
                db.add(db_notif)
                
            db.commit()
            action = "liked"
            
        return {"status": "success", "action": action}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'action Like: {str(e)}")


@app.post("/api/comments", response_model=schemas.CommentResponse)
def create_comment(req: schemas.CommentCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Ajoute un commentaire à un post."""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Le commentaire ne peut pas être vide.")
        
    try:
        db_comment = models.Comment(
            post_id=req.post_id,
            user_id=current_user.id,
            content=content
        )
        db.add(db_comment)
        
        post = db.query(models.Post).filter(models.Post.id == req.post_id).first()
        if post and post.user_id != current_user.id:
            db_notif = models.Notification(
                user_id=post.user_id,
                content=f"@{current_user.username} a commenté votre publication."
            )
            db.add(db_notif)
            
        db.commit()
        db.refresh(db_comment)
        
        return schemas.CommentResponse(
            id=db_comment.id,
            post_id=db_comment.post_id,
            user_id=db_comment.user_id,
            content=db_comment.content,
            created_at=db_comment.created_at,
            author_username=current_user.username,
            author_display_name=current_user.display_name
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'enregistrement du commentaire: {str(e)}")


# --- Endpoint Notifications ---

@app.get("/api/notifications/unread_count")
def get_unread_notifications_count(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Renvoie le nombre de notifications non lues pour l'utilisateur connecté."""
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    return {"unread_count": count}


@app.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère les 20 dernières notifications et les marque comme lues."""
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).limit(20).all()
    
    # Marquer comme lues
    for notif in notifs:
        notif.is_read = True
    db.commit()
    
    return [
        schemas.NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            content=n.content,
            is_read=n.is_read,
            created_at=n.created_at
        )
        for n in notifs
    ]


# --- Endpoints Amis Réels ---

@app.get("/api/users", response_model=List[schemas.UserSearchResponse])
def get_users_list(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Liste tous les utilisateurs enregistrés (sauf soi-même) avec le statut d'amitié."""
    friendships = db.query(models.Friendship).filter(
        (models.Friendship.user_id == current_user.id) | (models.Friendship.friend_id == current_user.id)
    ).all()
    
    friend_status = {}
    for f in friendships:
        other_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_status[other_id] = f.status
        
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    
    results = []
    for u in users:
        status = friend_status.get(u.id)
        is_friend = (status == "accepted")
        is_pending = (status == "pending")
        results.append(
            schemas.UserSearchResponse(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                is_friend=is_friend,
                is_pending=is_pending
            )
        )
    return results


@app.post("/api/friends")
def toggle_friendship(req: schemas.FriendshipRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Ajoute ou supprime une relation d'amitié (toggle)."""
    if req.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous ajouter vous-même en ami.")
        
    friend_user = db.query(models.User).filter(models.User.id == req.friend_id).first()
    if not friend_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé.")
        
    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == req.friend_id)) |
        ((models.Friendship.user_id == req.friend_id) & (models.Friendship.friend_id == current_user.id))
    ).first()
    
    try:
        if existing:
            db.delete(existing)
            db.commit()
            action = "removed"
        else:
            db_friendship = models.Friendship(
                user_id=current_user.id,
                friend_id=req.friend_id,
                status="accepted"
            )
            db.add(db_friendship)
            
            db_notif = models.Notification(
                user_id=req.friend_id,
                content=f"@{current_user.username} vous a ajouté en ami !"
            )
            db.add(db_notif)
            
            db.commit()
            action = "added"
            
        return {"status": "success", "action": action}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'action amitié: {str(e)}")


@app.get("/api/friends", response_model=List[schemas.UserResponse])
def get_friends(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère la liste de tous les amis acceptés de l'utilisateur connecté."""
    friendships = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) | (models.Friendship.friend_id == current_user.id)) &
        (models.Friendship.status == "accepted")
    ).all()
    
    friend_ids = []
    for f in friendships:
        other_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_ids.append(other_id)
        
    if not friend_ids:
        return []
        
    friends = db.query(models.User).filter(models.User.id.in_(friend_ids)).all()
    return [
        schemas.UserResponse(
            id=f.id,
            username=f.username,
            display_name=f.display_name
        )
        for f in friends
    ]


# Montage du dossier frontend/dist pour servir les fichiers statiques de React
frontend_dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist_path):
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{catchall:path}")
def serve_frontend(catchall: str):
    # Éviter d'intercepter les appels d'API
    if catchall.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint non trouvé.")
    
    index_file = os.path.join(frontend_dist_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Le frontend n'est pas encore compilé. Exécutez 'npm run build' dans le dossier frontend."}

