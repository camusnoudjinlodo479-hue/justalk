"""
Script de migration pour ajouter la colonne avatar_url à la table users.
"""
import os
import sys
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path)

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERREUR: DATABASE_URL non défini.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Ajouter avatar_url à la table users
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);"))
    # Activer Realtime sur la table messages (si pas déjà fait)
    try:
        conn.execute(text("ALTER PUBLICATION supabase_realtime ADD TABLE messages;"))
        print("Table 'messages' ajoutée à supabase_realtime.")
    except Exception as e:
        print(f"Info (messages realtime): {e}")
    # Activer Realtime sur la table conversations
    try:
        conn.execute(text("ALTER PUBLICATION supabase_realtime ADD TABLE conversations;"))
        print("Table 'conversations' ajoutée à supabase_realtime.")
    except Exception as e:
        print(f"Info (conversations realtime): {e}")
    conn.commit()
    print("Migration terminée : colonne avatar_url ajoutée à la table users.")
