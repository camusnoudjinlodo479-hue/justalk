# backend/schemas.py
# Modèles de validation Pydantic pour les requêtes et réponses de l'API.

from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List

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


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    author_username: str
    author_display_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PostResponse(BaseModel):
    id: UUID
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    created_at: datetime
    user_id: UUID
    author_username: str
    author_display_name: Optional[str] = None
    likes_count: int = 0
    is_liked: bool = False
    comments: List[CommentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- Comment & Like Request Schemas ---

class CommentCreate(BaseModel):
    post_id: UUID
    content: str


class LikeCreate(BaseModel):
    post_id: UUID


# --- Story Schemas ---

class StoryCreate(BaseModel):
    media_url: str


class StoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    media_url: str
    created_at: datetime
    expires_at: datetime
    author_username: str
    author_display_name: Optional[str] = None
    is_viewed: bool = False

    model_config = ConfigDict(from_attributes=True)


# --- Notification Schemas ---

class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

