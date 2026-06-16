@echo off
echo ==========================================================
echo               DEMARRAGE DE JUSTALK (FUSIONNE)
echo       Backend FastAPI  +  Frontend React (Serveur Unique)
echo ==========================================================
echo.

echo [1/2] Lancement de l'Application Unifiee sur http://localhost:8000...
start cmd /k "call venv\Scripts\activate && cd backend && uvicorn main:app --reload"

echo [2/2] Lancement optionnel du Mode Developpement React (Vite) sur http://localhost:5173...
start cmd /k "cd frontend && npm run dev"

echo.
echo L'application fusionnée tourne sur : http://localhost:8000
echo Le mode dev React avec rechargement à chaud tourne sur : http://localhost:5173
echo L'API Swagger est disponible sur : http://localhost:8000/docs
echo.
pause
