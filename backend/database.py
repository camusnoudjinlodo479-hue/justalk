# backend/database.py
# Configuration de la connexion SQLAlchemy à PostgreSQL Supabase.

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Chargement du fichier .env situé à la racine du projet
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("L'environnement DATABASE_URL n'est pas défini.")

from sqlalchemy.pool import NullPool

# On utilise create_engine avec NullPool pour être compatible avec le pooler transactionnel de Supabase
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dépendance pour obtenir la session de base de données à chaque requête FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
