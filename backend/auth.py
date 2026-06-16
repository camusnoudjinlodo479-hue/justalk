# backend/auth.py
# Gestion des sessions utilisateur par cookie JWT (jose/cryptography).

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from database import get_db
import models

# Récupération de la clé secrète JWT depuis les variables d'environnement
SECRET_KEY = os.getenv("JWT_SECRET", "default-fallback-secret-for-development-only")
ALGORITHM = "HS256"
COOKIE_NAME = "justalk_session"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def create_session_token(user_id: str) -> str:
    """Crée un jeton JWT contenant l'ID utilisateur."""
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_session_token(token: str) -> Optional[str]:
    """Vérifie le jeton JWT et extrait le user_id."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    """Dépendance FastAPI pour obtenir l'utilisateur connecté via le cookie de session."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session non valide ou absente.",
        )
    
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée ou invalide.",
        )
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable.",
        )
    
    return user
