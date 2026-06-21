# backend/schemas.py
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
    avatar_url: Optional[str] = None
    registration_response: Dict[str, Any]

class AuthenticationOptionsRequest(BaseModel):
    username: str

class AuthenticationVerificationRequest(BaseModel):
    username: str
    authentication_response: Dict[str, Any]

# --- User Schemas ---
class UserResponse(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
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
    author_avatar_url: Optional[str] = None
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
    author_avatar_url: Optional[str] = None
    likes_count: int = 0
    is_liked: bool = False
    comments: List[CommentResponse] = []
    model_config = ConfigDict(from_attributes=True)

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
    author_avatar_url: Optional[str] = None
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

# --- Friendship Schemas ---
class FriendshipRequest(BaseModel):
    friend_id: UUID

class UserSearchResponse(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_friend: bool = False
    is_incoming_pending: bool = False
    is_outgoing_pending: bool = False
    model_config = ConfigDict(from_attributes=True)

# --- Messenger Schemas ---
class MessageCreate(BaseModel):
    conversation_id: UUID
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_username: str
    sender_display_name: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: UUID
    user_one_id: UUID
    user_two_id: UUID
    recipient_username: str
    recipient_display_name: Optional[str] = None
    recipient_avatar_url: Optional[str] = None
    last_message_content: Optional[str] = None
    last_message_time: Optional[datetime] = None
    last_message_sender_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ConversationCreate(BaseModel):
    recipient_id: UUID

class AvatarUpdateRequest(BaseModel):
    avatar_url: str

class CoverUpdateRequest(BaseModel):
    cover_url: str

# --- Reel Schemas ---
class ReelCreate(BaseModel):
    video_url: str
    description: Optional[str] = None

class ReelCommentResponse(BaseModel):
    id: UUID
    reel_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    author_username: str
    author_display_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ReelResponse(BaseModel):
    id: UUID
    user_id: UUID
    video_url: str
    description: Optional[str] = None
    created_at: datetime
    author_username: str
    author_display_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    likes_count: int = 0
    is_liked: bool = False
    comments_count: int = 0
    comments: List[ReelCommentResponse] = []
    model_config = ConfigDict(from_attributes=True)

class ReelCommentCreate(BaseModel):
    reel_id: UUID
    content: str

# --- Passcode Schemas ---
class PasscodeRegistrationRequest(BaseModel):
    username: str
    display_name: Optional[str] = None
    passcode: str

class PasscodeLoginRequest(BaseModel):
    username: str
    passcode: str

