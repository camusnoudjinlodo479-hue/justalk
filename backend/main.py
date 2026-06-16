# backend/main.py
# Fichier d'entrée principal FastAPI gérant les routes WebAuthn, les publications et les sessions.

import os
import json
import uuid
from dotenv import load_dotenv

# Chargement du fichier .env situé à la racine du projet
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path)
from typing import Dict, Any, List
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
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

# Middleware CORS pour permettre au frontend React (Vite) de requêter
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEBAUTHN_ORIGIN],
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
    """Liste les publications du fil d'actualité."""
    posts = db.query(models.Post).order_by(models.Post.created_at.desc()).limit(50).all()
    
    response_list = []
    for post in posts:
        author = post.author
        response_list.append(
            schemas.PostResponse(
                id=post.id,
                content=post.content,
                image_url=post.image_url,
                video_url=post.video_url,
                created_at=post.created_at,
                user_id=post.user_id,
                author_username=author.username,
                author_display_name=author.display_name
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
        author_display_name=current_user.display_name
    )


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

