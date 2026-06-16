# backend/schemas.py
# Modèles de validation Pydantic pour les requêtes et réponses de l'API.

from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any

# --- WebAuthn Schemas ---

class RegistrationOptionsRequest(BaseModel):
    username: str
    display_name: Optional[str] = None

class RegistrationVerificationRequest(BaseModel):
    username: str
    display_name: Optional[str] = None
    registration_response: Dict[str, Any]  # Reçu du frontend (@github/webauthn-json)

class AuthenticationOptionsRequest(BaseModel):
    username: str

class AuthenticationVerificationRequest(BaseModel):
    username: str
    authentication_response: Dict[str, Any]  # Reçu du frontend (@github/webauthn-json)


# --- User Schemas ---

class UserResponse(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Post Schemas ---

class PostCreate(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None

class PostResponse(BaseModel):
    id: UUID
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    created_at: datetime
    user_id: UUID
    author_username: str
    author_display_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
