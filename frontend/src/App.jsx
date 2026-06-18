// frontend/src/App.jsx
import { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Feed from "./components/Feed";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("login");
  const [checkingSession, setCheckingSession] = useState(true);
  const [serverError, setServerError] = useState("");

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
        setCurrentUser(null);
        setView("login");
      }
    } catch (err) {
      setServerError("Impossible de se connecter au serveur. Vérifiez que le backend est démarré.");
    } finally {
      setCheckingSession(false);
    }
  };

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log("PWA installée avec succès !");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Réponse de l'utilisateur à l'installation: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => { checkSession(); }, []);

  const handleLoginSuccess = () => checkSession();
  const handleRegisterSuccess = () => checkSession();

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setCurrentUser(null);
    setView("login");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-3xl">J</span>
        </div>
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <p className="text-gray-500 font-semibold text-base">Chargement...</p>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <div className="card-lg max-w-md w-full flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <h3 className="font-bold text-gray-900 text-xl">Erreur de connexion</h3>
          <p className="text-gray-600 text-base leading-relaxed">{serverError}</p>
          <button onClick={checkSession} className="btn-primary px-8">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === "login" && (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setView("register")} />
        </div>
      )}

      {view === "register" && (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <Register onRegisterSuccess={handleRegisterSuccess} onGoToLogin={() => setView("login")} />
        </div>
      )}

      {view === "feed" && (
        <Feed currentUser={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} />
      )}

      {showInstallBanner && (
        <div className="pwa-install-banner animate-slideUp">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                J
              </div>
              <div>
                <p className="text-xs font-bold text-white">Installer l'application Justalk</p>
                <p className="text-[10px] text-slate-400">Accédez rapidement à vos messages et appels en plein écran.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button 
                onClick={() => setShowInstallBanner(false)} 
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold transition-all"
              >
                Plus tard
              </button>
              <button 
                onClick={handleInstallClick} 
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-md active:scale-95 transition-all"
              >
                Installer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

