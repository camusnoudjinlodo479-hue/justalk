// frontend/src/App.jsx
// Point d'entrée principal de l'application Justalk.

import { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Feed from "./components/Feed";
import { ShieldAlert } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("login"); // login | register | feed
  const [checkingSession, setCheckingSession] = useState(true);
  const [serverError, setServerError] = useState("");

  // Vérifier la session de connexion existante au montage
  const checkSession = async () => {
    setCheckingSession(true);
    setServerError("");
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const userData = await res.json();
        setCurrentUser(userData);
        setView("feed");
      } else {
        // Non connecté, on affiche l'écran de login
        setCurrentUser(null);
        setView("login");
      }
    } catch (err) {
      console.error("Erreur de session :", err);
      setServerError("Impossible de se connecter au serveur backend. Veuillez vérifier qu'il est démarré.");
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLoginSuccess = (userId, username) => {
    checkSession();
  };

  const handleRegisterSuccess = (userId, username) => {
    checkSession();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
    setCurrentUser(null);
    setView("login");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/40 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-electric rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-semibold animate-pulse">
          Vérification de la session biométrique...
        </p>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/40 flex flex-col items-center justify-center p-4">
        <div className="card-lg max-w-md w-full bg-white p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ShieldAlert size={26} />
          </div>
          <h3 className="font-display font-bold text-slate-800 text-lg">Erreur de connexion</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{serverError}</p>
          <button onClick={checkSession} className="btn-primary py-2.5 px-6 mt-2">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/10 to-indigo-50/30 flex items-center justify-center p-4">
      {view === "login" && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onGoToRegister={() => setView("register")}
        />
      )}
      
      {view === "register" && (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onGoToLogin={() => setView("login")}
        />
      )}

      {view === "feed" && (
        <Feed currentUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
