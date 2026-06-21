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
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request, UploadFile, File, WebSocket, WebSocketDisconnect
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


# --- Health Check (Render / monitoring) ---

@app.get("/api/health")
def health_check():
    """Endpoint de vérification de santé pour Render et les outils de monitoring."""
    return {"status": "ok", "service": "justalk-api"}


@app.get("/api/health")
def health_check():
    """Endpoint de vérification de santé pour Render et les outils de monitoring."""
    return {"status": "ok", "service": "justalk-api"}


# --- WebSocket Signaling pour WebRTC (Appels Audio/Vidéo) ---

active_call_rooms: Dict[str, List[WebSocket]] = {}

@app.websocket("/ws/call/{room_id}")
async def websocket_call_endpoint(websocket: WebSocket, room_id: str):
    """Serveur de signalisation WebRTC pour les appels audio/vidéo (1-to-1 et groupe)."""
    await websocket.accept()
    if room_id not in active_call_rooms:
        active_call_rooms[room_id] = []
    active_call_rooms[room_id].append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Diffuser le message à tous les autres participants du salon
            for conn in active_call_rooms.get(room_id, []):
                if conn != websocket:
                    try:
                        await conn.send_text(data)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        if room_id in active_call_rooms:
            active_call_rooms[room_id] = [c for c in active_call_rooms[room_id] if c != websocket]
            if not active_call_rooms[room_id]:
                del active_call_rooms[room_id]
            # Notifier les autres que quelqu'un a quitté
            import json as _json
            leave_msg = _json.dumps({"type": "peer-left"})
            for conn in active_call_rooms.get(room_id, []):
                try:
                    await conn.send_text(leave_msg)
                except Exception:
                    pass


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


# Helper pour resoudre l'RP ID et l'Origine WebAuthn dynamiquement
def get_webauthn_rp_id_and_origin(request: Request):
    from urllib.parse import urlparse
    
    origin_header = request.headers.get("origin")
    host_header = request.headers.get("host", "")
    
    rp_id = WEBAUTHN_RP_ID
    origin = WEBAUTHN_ORIGIN
    
    # Tous les domaines onrender.com + localhost sont acceptes
    def is_allowed_host(h):
        return h in ["localhost", "127.0.0.1"] or h.endswith(".onrender.com") or h == "onrender.com"
    
    if origin_header:
        parsed = urlparse(origin_header)
        host = parsed.hostname or ""
        if is_allowed_host(host):
            rp_id = host
            origin = origin_header.rstrip("/")
    elif host_header:
        host = host_header.split(":")[0]
        if is_allowed_host(host):
            rp_id = host
            proto = request.headers.get("x-forwarded-proto", "")
            if proto == "https" or (host not in ["localhost", "127.0.0.1"]):
                origin = f"https://{host}"
            else:
                origin = f"http://{host_header}"

    print(f"[WebAuthn] rp_id={rp_id!r}  origin={origin!r}")
    return rp_id, origin


def get_all_valid_origins():
    """Retourne la liste de toutes les origines acceptees pour la verification."""
    return [
        WEBAUTHN_ORIGIN,
        "https://justalk.onrender.com",
        "https://k.onrender.com",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
    ]


# --- Enregistrement / Inscription WebAuthn ---

@app.post("/api/webauthn/register-options")
def get_register_options(req: schemas.RegistrationOptionsRequest, request: Request, db: Session = Depends(database.get_db)):
    """Étape 1 Inscription : Génère le challenge WebAuthn."""
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Le pseudo est obligatoire.")
    
    # Vérification d'unicité
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà pris.")
    
    user_uuid = uuid.uuid4()
    
    rp_id, origin = get_webauthn_rp_id_and_origin(request)
    
    try:
        options = generate_registration_options(
            rp_id=rp_id,
            rp_name=WEBAUTHN_RP_NAME,
            user_id=user_uuid.bytes,
            user_name=username,
            user_display_name=req.display_name or username,
            authenticator_selection=AuthenticatorSelectionCriteria(
                # CROSS_PLATFORM accepte aussi les cles USB/NFC en plus de TouchID/FaceID
                # Suppression de PLATFORM-only pour compatibilite maximale
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.PREFERRED
            )
        )
    except Exception as e:
        print(f"[WebAuthn] register-options error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur génération challenge : {str(e)}")
    
    # Stocker le challenge en mémoire pour validation à l'étape 2
    challenges_db[username] = {
        "challenge": options.challenge,
        "user_id": str(user_uuid),
        "display_name": req.display_name or username,
        "rp_id": rp_id,
        "origin": origin
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
    rp_id = stored.get("rp_id", WEBAUTHN_RP_ID)
    origin = stored.get("origin", WEBAUTHN_ORIGIN)
    
    # Construire la liste des origines valides pour la verification
    valid_origins = list(set([origin] + get_all_valid_origins()))
    
    last_error = None
    verification = None
    for try_origin in valid_origins:
        try:
            verification = verify_registration_response(
                credential=req.registration_response,
                expected_challenge=expected_challenge,
                expected_origin=try_origin,
                expected_rp_id=rp_id
            )
            print(f"[WebAuthn] register-verify OK avec origin={try_origin!r}")
            break
        except Exception as e:
            last_error = e
            continue
    
    if verification is None:
        print(f"[WebAuthn] register-verify FAILED: {last_error}")
        raise HTTPException(status_code=400, detail=f"Vérification WebAuthn échouée : {str(last_error)}")
    
    try:
        # Création de l'utilisateur
        db_user = models.User(
            id=uuid.UUID(user_id_str),
            username=username,
            display_name=display_name,
            avatar_url=req.avatar_url
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
        secure=origin.startswith("https")
    )
    
    return {"status": "success", "user_id": str(db_user.id)}


# --- Connexion / Authentification WebAuthn ---

@app.post("/api/webauthn/login-options")
def get_login_options(req: schemas.AuthenticationOptionsRequest, request: Request, db: Session = Depends(database.get_db)):
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
    
    rp_id, origin = get_webauthn_rp_id_and_origin(request)
    
    try:
        options = generate_authentication_options(
            rp_id=rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de génération des options d'auth : {str(e)}")
    
    challenges_db[username] = {
        "challenge": options.challenge,
        "user_id": str(db_user.id),
        "rp_id": rp_id,
        "origin": origin
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
    rp_id = stored.get("rp_id", WEBAUTHN_RP_ID)
    origin = stored.get("origin", WEBAUTHN_ORIGIN)
    
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
    
    # Essayer toutes les origines valides pour la verification
    valid_origins = list(set([origin] + get_all_valid_origins()))
    
    last_error = None
    verification = None
    for try_origin in valid_origins:
        try:
            verification = verify_authentication_response(
                credential=req.authentication_response,
                expected_challenge=expected_challenge,
                expected_rp_id=rp_id,
                expected_origin=try_origin,
                credential_public_key=base64url_to_bytes(db_cred.public_key),
                credential_current_sign_count=db_cred.sign_count
            )
            print(f"[WebAuthn] login-verify OK avec origin={try_origin!r}")
            break
        except Exception as e:
            last_error = e
            continue
    
    if verification is None:
        print(f"[WebAuthn] login-verify FAILED: {last_error}")
        raise HTTPException(status_code=400, detail=f"Authentification refusée : {str(last_error)}")
    
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
        secure=origin.startswith("https")
    )
    
    return {"status": "success", "user_id": user_id_str}


# --- Sessions et Infos Utilisateurs ---

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Renvoie les informations de l'utilisateur connecté."""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "cover_url": current_user.cover_url,
    }


@app.post("/api/auth/logout")
def logout(response: Response):
    """Déconnecte l'utilisateur en supprimant son cookie de session."""
    response.delete_cookie(
        key=auth.COOKIE_NAME,
        path="/",
        samesite="lax"
    )
    return {"status": "success"}

# --- Authentification par Code Secret (Passcode Fallback) ---

@app.post("/api/auth/register-passcode")
def register_passcode(req: schemas.PasscodeRegistrationRequest, response: Response, db: Session = Depends(database.get_db)):
    """Inscription alternative par code secret si la biométrie n'est pas supportée."""
    import hashlib
    username = req.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Le pseudo est obligatoire.")
    
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà pris.")
    
    user_uuid = uuid.uuid4()
    db_user = models.User(
        id=user_uuid,
        username=username,
        display_name=req.display_name or username
    )
    
    passcode_hash = hashlib.sha256(req.passcode.encode()).hexdigest()
    db_cred = models.Credential(
        id=f"passcode_{username}",
        user_id=db_user.id,
        public_key=passcode_hash,
        sign_count=0
    )
    
    try:
        db.add(db_user)
        db.add(db_cred)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture : {str(e)}")
    
    token = auth.create_session_token(str(db_user.id))
    response.set_cookie(
        key=auth.COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=True
    )
    return {"status": "success", "user_id": str(db_user.id)}

@app.post("/api/auth/login-passcode")
def login_passcode(req: schemas.PasscodeLoginRequest, response: Response, db: Session = Depends(database.get_db)):
    """Connexion alternative par code secret."""
    import hashlib
    username = req.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Le pseudo est obligatoire.")
    
    db_user = db.query(models.User).filter(models.User.username == username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Pseudo introuvable.")
    
    db_cred = db.query(models.Credential).filter(
        models.Credential.id == f"passcode_{username}",
        models.Credential.user_id == db_user.id
    ).first()
    
    if not db_cred:
        raise HTTPException(status_code=400, detail="Ce compte a été enregistré avec la biométrie (ou n'a pas de code secret).")
    
    passcode_hash = hashlib.sha256(req.passcode.encode()).hexdigest()
    if db_cred.public_key != passcode_hash:
        raise HTTPException(status_code=400, detail="Code secret incorrect.")
    
    token = auth.create_session_token(str(db_user.id))
    response.set_cookie(
        key=auth.COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=True
    )
    return {"status": "success", "user_id": str(db_user.id)}


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
                    author_display_name=c_author.display_name,
                    author_avatar_url=c_author.avatar_url
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
                author_avatar_url=author.avatar_url,
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


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Supprime une publication si l'utilisateur connecté en est l'auteur."""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable.")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul l'auteur peut supprimer sa publication.")
    
    try:
        db.delete(post)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression de la publication : {str(e)}")
        
    return {"status": "success", "message": "Publication supprimée avec succès."}


# --- Endpoint Téléversement Backend (Upload) ---

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    """Téléverse un fichier image ou vidéo sur le stockage Supabase (avec fallback de stockage local)."""
    contents = await file.read()
    file_ext = file.filename.split(".")[-1]
    file_name = f"{current_user.id}_{int(time.time())}.{file_ext}"
    
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if supabase_url and service_key and "supabase.co" in supabase_url:
        try:
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
        except Exception as e:
            print(f"Supabase upload failed, falling back to local: {str(e)}")
            
    # Local fallback
    try:
        uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        local_path = os.path.join(uploads_dir, file_name)
        with open(local_path, "wb") as f:
            f.write(contents)
        return {"url": f"/api/uploads/{file_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de téléversement local: {str(e)}")


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

# --- Endpoints Amis Réels ---

@app.get("/api/users", response_model=List[schemas.UserSearchResponse])
def get_users_list(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Liste tous les utilisateurs (sauf soi-même) avec le statut d'amitié détaillé."""
    friendships = db.query(models.Friendship).filter(
        (models.Friendship.user_id == current_user.id) | (models.Friendship.friend_id == current_user.id)
    ).all()
    
    friend_status = {}
    for f in friendships:
        other_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_status[other_id] = {
            "status": f.status,
            "sender_id": f.user_id
        }
        
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    
    results = []
    for u in users:
        f_info = friend_status.get(u.id)
        is_friend = False
        is_incoming_pending = False
        is_outgoing_pending = False
        
        if f_info:
            if f_info["status"] == "accepted":
                is_friend = True
            elif f_info["status"] == "pending":
                if f_info["sender_id"] == current_user.id:
                    is_outgoing_pending = True
                else:
                    is_incoming_pending = True
                    
        results.append(
            schemas.UserSearchResponse(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                is_friend=is_friend,
                is_incoming_pending=is_incoming_pending,
                is_outgoing_pending=is_outgoing_pending
            )
        )
    return results


@app.post("/api/friends/request")
def send_friend_request(req: schemas.FriendshipRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Envoie une invitation d'amitié (statut pending) ou accepte l'existante."""
    if req.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous ajouter vous-même.")

    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == req.friend_id)) |
        ((models.Friendship.user_id == req.friend_id) & (models.Friendship.friend_id == current_user.id))
    ).first()

    if existing:
        if existing.status == "accepted":
            return {"status": "success", "action": "already_friends"}
        elif existing.user_id == current_user.id:
            return {"status": "success", "action": "already_requested"}
        else:
            existing.status = "accepted"
            db.commit()
            return {"status": "success", "action": "accepted"}

    try:
        new_request = models.Friendship(
            user_id=current_user.id,
            friend_id=req.friend_id,
            status="pending"
        )
        db.add(new_request)
        
        db_notif = models.Notification(
            user_id=req.friend_id,
            content=f"@{current_user.username} vous a envoyé une invitation d'amitié."
        )
        db.add(db_notif)
        db.commit()
        return {"status": "success", "action": "requested"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'invitation: {str(e)}")


@app.post("/api/friends/accept")
def accept_friend_request(req: schemas.FriendshipRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Accepte une invitation d'amitié."""
    existing = db.query(models.Friendship).filter(
        (models.Friendship.user_id == req.friend_id) & 
        (models.Friendship.friend_id == current_user.id) &
        (models.Friendship.status == "pending")
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    try:
        existing.status = "accepted"
        
        db_notif = models.Notification(
            user_id=req.friend_id,
            content=f"@{current_user.username} a accepté votre invitation d'amitié !"
        )
        db.add(db_notif)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@app.post("/api/friends/decline")
def decline_friend_request(req: schemas.FriendshipRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Refuse une invitation ou retire un ami."""
    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == req.friend_id)) |
        ((models.Friendship.user_id == req.friend_id) & (models.Friendship.friend_id == current_user.id))
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Relation introuvable.")

    try:
        db.delete(existing)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@app.post("/api/friends")
def toggle_friendship(req: schemas.FriendshipRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Toggle legacy pour compatibilité descendante (décline si existant, sinon fait une requête)."""
    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == req.friend_id)) |
        ((models.Friendship.user_id == req.friend_id) & (models.Friendship.friend_id == current_user.id))
    ).first()
    
    try:
        if existing:
            db.delete(existing)
            db.commit()
            return {"status": "success", "action": "removed"}
        else:
            new_request = models.Friendship(
                user_id=current_user.id,
                friend_id=req.friend_id,
                status="pending"
            )
            db.add(new_request)
            db.commit()
            return {"status": "success", "action": "added"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
            display_name=f.display_name,
            avatar_url=f.avatar_url
        )
        for f in friends
    ]


@app.post("/api/auth/profile/avatar")
def update_avatar(req: schemas.AvatarUpdateRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Met à jour la photo de profil de l'utilisateur connecté."""
    try:
        current_user.avatar_url = req.avatar_url
        db.commit()
        return {"status": "success", "avatar_url": current_user.avatar_url}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur de mise à jour de l'avatar: {str(e)}")


@app.post("/api/auth/profile/cover")
def update_cover(req: schemas.CoverUpdateRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Met à jour la photo de couverture de l'utilisateur connecté."""
    try:
        current_user.cover_url = req.cover_url
        db.commit()
        return {"status": "success", "cover_url": current_user.cover_url}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur de mise à jour de la couverture: {str(e)}")


# --- Endpoints Reels ---

@app.post("/api/reels", response_model=schemas.ReelResponse)
def create_reel(req: schemas.ReelCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Crée un nouveau Reel vidéo."""
    try:
        db_reel = models.Reel(
            user_id=current_user.id,
            video_url=req.video_url,
            description=req.description
        )
        db.add(db_reel)
        db.commit()
        db.refresh(db_reel)
        return schemas.ReelResponse(
            id=db_reel.id,
            user_id=db_reel.user_id,
            video_url=db_reel.video_url,
            description=db_reel.description,
            created_at=db_reel.created_at,
            author_username=current_user.username,
            author_display_name=current_user.display_name,
            author_avatar_url=current_user.avatar_url,
            likes_count=0,
            is_liked=False,
            comments_count=0,
            comments=[]
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur de création du reel: {str(e)}")


@app.get("/api/reels", response_model=List[schemas.ReelResponse])
def get_reels(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère tous les reels triés par date décroissante."""
    reels = db.query(models.Reel).order_by(models.Reel.created_at.desc()).limit(50).all()
    result = []
    for reel in reels:
        author = reel.author
        likes_count = len(reel.likes)
        is_liked = any(like.user_id == current_user.id for like in reel.likes)
        comments_list = [
            schemas.ReelCommentResponse(
                id=c.id,
                reel_id=c.reel_id,
                user_id=c.user_id,
                content=c.content,
                created_at=c.created_at,
                author_username=c.user.username,
                author_display_name=c.user.display_name,
                author_avatar_url=c.user.avatar_url
            ) for c in reel.comments
        ]
        result.append(schemas.ReelResponse(
            id=reel.id,
            user_id=reel.user_id,
            video_url=reel.video_url,
            description=reel.description,
            created_at=reel.created_at,
            author_username=author.username,
            author_display_name=author.display_name,
            author_avatar_url=author.avatar_url,
            likes_count=likes_count,
            is_liked=is_liked,
            comments_count=len(reel.comments),
            comments=comments_list
        ))
    return result


@app.post("/api/reels/{reel_id}/like")
def toggle_reel_like(reel_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Toggle like sur un Reel."""
    existing = db.query(models.ReelLike).filter(
        models.ReelLike.reel_id == reel_id,
        models.ReelLike.user_id == current_user.id
    ).first()
    try:
        if existing:
            db.delete(existing)
            db.commit()
            return {"status": "success", "action": "unliked"}
        else:
            db_like = models.ReelLike(reel_id=reel_id, user_id=current_user.id)
            db.add(db_like)
            db.commit()
            return {"status": "success", "action": "liked"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur like reel: {str(e)}")


@app.post("/api/reels/{reel_id}/comment", response_model=schemas.ReelCommentResponse)
def comment_reel(reel_id: uuid.UUID, req: schemas.ReelCommentCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Ajoute un commentaire sur un Reel."""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Commentaire vide.")
    try:
        db_comment = models.ReelComment(
            reel_id=reel_id,
            user_id=current_user.id,
            content=content
        )
        db.add(db_comment)
        db.commit()
        db.refresh(db_comment)
        return schemas.ReelCommentResponse(
            id=db_comment.id,
            reel_id=db_comment.reel_id,
            user_id=db_comment.user_id,
            content=db_comment.content,
            created_at=db_comment.created_at,
            author_username=current_user.username,
            author_display_name=current_user.display_name,
            author_avatar_url=current_user.avatar_url
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur commentaire reel: {str(e)}")


# --- Endpoints Messenger ---

@app.get("/api/conversations", response_model=List[schemas.ConversationResponse])
def get_conversations(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère toutes les conversations actives pour l'utilisateur connecté."""
    convs = db.query(models.Conversation).filter(
        (models.Conversation.user_one_id == current_user.id) | 
        (models.Conversation.user_two_id == current_user.id)
    ).order_by(models.Conversation.updated_at.desc()).all()

    results = []
    for c in convs:
        is_user_one = c.user_one_id == current_user.id
        recipient = c.user_two if is_user_one else c.user_one
        
        last_msg = db.query(models.Message).filter(
            models.Message.conversation_id == c.id
        ).order_by(models.Message.created_at.desc()).first()

        results.append(
            schemas.ConversationResponse(
                id=c.id,
                user_one_id=c.user_one_id,
                user_two_id=c.user_two_id,
                recipient_username=recipient.username,
                recipient_display_name=recipient.display_name,
                recipient_avatar_url=recipient.avatar_url,
                last_message_content=last_msg.content if last_msg else None,
                last_message_time=last_msg.created_at if last_msg else None,
                last_message_sender_id=last_msg.sender_id if last_msg else None,
                created_at=c.created_at,
                updated_at=c.updated_at
            )
        )
    return results


@app.post("/api/conversations", response_model=schemas.ConversationResponse)
def create_conversation(req: schemas.ConversationCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Crée une nouvelle conversation ou récupère une existante."""
    if req.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas démarrer une discussion avec vous-même.")

    recipient = db.query(models.User).filter(models.User.id == req.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    user_one_id, user_two_id = sorted([current_user.id, req.recipient_id])

    # Restreindre la création de conversation aux utilisateurs amis acceptés
    friendship = db.query(models.Friendship).filter(
        (models.Friendship.status == "accepted") &
        (
            ((models.Friendship.user_id == user_one_id) & (models.Friendship.friend_id == user_two_id)) |
            ((models.Friendship.user_id == user_two_id) & (models.Friendship.friend_id == user_one_id))
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=403, detail="Vous devez être amis acceptés pour démarrer une conversation.")

    existing = db.query(models.Conversation).filter(
        models.Conversation.user_one_id == user_one_id,
        models.Conversation.user_two_id == user_two_id
    ).first()

    if existing:
        last_msg = db.query(models.Message).filter(
            models.Message.conversation_id == existing.id
        ).order_by(models.Message.created_at.desc()).first()

        return schemas.ConversationResponse(
            id=existing.id,
            user_one_id=existing.user_one_id,
            user_two_id=existing.user_two_id,
            recipient_username=recipient.username,
            recipient_display_name=recipient.display_name,
            recipient_avatar_url=recipient.avatar_url,
            last_message_content=last_msg.content if last_msg else None,
            last_message_time=last_msg.created_at if last_msg else None,
            last_message_sender_id=last_msg.sender_id if last_msg else None,
            created_at=existing.created_at,
            updated_at=existing.updated_at
        )

    try:
        new_conv = models.Conversation(
            user_one_id=user_one_id,
            user_two_id=user_two_id
        )
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)

        return schemas.ConversationResponse(
            id=new_conv.id,
            user_one_id=new_conv.user_one_id,
            user_two_id=new_conv.user_two_id,
            recipient_username=recipient.username,
            recipient_display_name=recipient.display_name,
            recipient_avatar_url=recipient.avatar_url,
            last_message_content=None,
            last_message_time=None,
            last_message_sender_id=None,
            created_at=new_conv.created_at,
            updated_at=new_conv.updated_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la conversation: {str(e)}")


@app.get("/api/conversations/{conversation_id}/messages", response_model=List[schemas.MessageResponse])
def get_messages(conversation_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Récupère l'historique des messages d'une conversation."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    if current_user.id != conv.user_one_id and current_user.id != conv.user_two_id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de cette conversation.")

    unread_messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).all()
    for m in unread_messages:
        m.is_read = True
    db.commit()

    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()

    return [
        schemas.MessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            sender_id=m.sender_id,
            sender_username=m.sender.username,
            sender_display_name=m.sender.display_name,
            content=m.content,
            image_url=m.image_url,
            video_url=m.video_url,
            is_read=m.is_read,
            created_at=m.created_at
        )
        for m in messages
    ]


@app.post("/api/messages", response_model=schemas.MessageResponse)
def create_message(req: schemas.MessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Envoie un nouveau message."""
    # Valider qu'il y a au moins un contenu (texte ou média)
    if not req.content and not req.image_url and not req.video_url:
        raise HTTPException(status_code=400, detail="Le message ne peut pas être vide.")

    conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    if current_user.id != conv.user_one_id and current_user.id != conv.user_two_id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de cette conversation.")

    # Restreindre l'envoi de message aux amis acceptés
    recipient_id = conv.user_two_id if conv.user_one_id == current_user.id else conv.user_one_id
    friendship = db.query(models.Friendship).filter(
        (models.Friendship.status == "accepted") &
        (
            ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == recipient_id)) |
            ((models.Friendship.user_id == recipient_id) & (models.Friendship.friend_id == current_user.id))
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=403, detail="Vous devez être amis acceptés pour envoyer un message.")

    try:
        new_msg = models.Message(
            conversation_id=req.conversation_id,
            sender_id=current_user.id,
            content=req.content.strip() if req.content else None,
            image_url=req.image_url,
            video_url=req.video_url
        )
        db.add(new_msg)
        
        conv.updated_at = datetime.now(timezone.utc)
        
        recipient_id = conv.user_two_id if conv.user_one_id == current_user.id else conv.user_one_id
        
        # Personnaliser le contenu de la notification pour les appels
        notif_content = f"@{current_user.username} vous a envoyé un message."
        if req.content:
            if "manqué" in req.content:
                notif_content = f"📞 Appel manqué de @{current_user.username}"
            elif "en cours" in req.content:
                notif_content = f"📞 Appel entrant de @{current_user.username}..."
            elif "terminé" in req.content:
                notif_content = None

        if notif_content:
            db_notif = models.Notification(
                user_id=recipient_id,
                content=notif_content
            )
            db.add(db_notif)
        
        db.commit()
        db.refresh(new_msg)

        return schemas.MessageResponse(
            id=new_msg.id,
            conversation_id=new_msg.conversation_id,
            sender_id=new_msg.sender_id,
            sender_username=current_user.username,
            sender_display_name=current_user.display_name,
            content=new_msg.content,
            image_url=new_msg.image_url,
            video_url=new_msg.video_url,
            is_read=new_msg.is_read,
            created_at=new_msg.created_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur d'envoi du message: {str(e)}")


# Montage du dossier uploads local (fallback si Supabase non configuré)
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

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

