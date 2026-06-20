// frontend/src/components/Login.jsx
// Formulaire de connexion biométrique Justalk.

import { useState } from "react";
import { get } from "@github/webauthn-json";
import { User, Fingerprint, LogIn, ShieldCheck, AlertCircle } from "lucide-react";

export default function Login({ onLoginSuccess, onGoToRegister }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccess(false);

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError("Le pseudo est requis.");
      setLoading(false);
      return;
    }

    try {
      // 1. Récupération des options d'authentification (challenge + allowCredentials)
      const optionsRes = await fetch("/api/webauthn/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername }),
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Pseudo introuvable ou aucune clé enregistrée.");
      }

      const options = await optionsRes.json();

      // 2. Lancement de la reconnaissance biométrique native via @github/webauthn-json
      const assertion = await get({ publicKey: options });

      // 3. Envoi de l'assertion de signature au backend pour vérification
      const verifyRes = await fetch("/api/webauthn/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          authentication_response: assertion,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Authentification biométrique rejetée.");
      }

      const verifyData = await verifyRes.json();
      setSuccess(true);

      setTimeout(() => {
        onLoginSuccess(verifyData.user_id, cleanUsername);
      }, 800);

    } catch (err) {
      console.error("Erreur connexion :", err);
      setError(err.message || "Impossible de se connecter.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] sm:max-w-lg p-8 sm:p-10 card-lg bg-white/80 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden z-10">
      {/* Ligne décorative dégradée premium */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-electric via-blue-500 to-indigo-500" />

      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-electric/10 flex items-center justify-center text-electric animate-pulseRing relative mb-2">
          <Fingerprint size={40} />
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-800">Connexion sécurisée</h2>
          <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-sm mx-auto">
            Saisissez votre pseudo pour déverrouiller votre session avec votre empreinte ou reconnaissance faciale.
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 mt-2">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Pseudo de votre compte"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className="input-pill pl-12 py-3.5 sm:py-4 text-sm sm:text-base bg-slate-100 text-slate-900 border-slate-200"
              required
              disabled={loading || success}
            />
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold flex items-center gap-2.5 text-left animate-scaleIn">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-semibold flex items-center gap-2.5 text-left animate-scaleIn">
              <ShieldCheck size={18} className="shrink-0 animate-bounce" />
              <span>Connexion validée ! Ouverture de session...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-sm sm:text-base font-bold cursor-pointer"
          >
            {loading ? "Attente de l'appareil..." : success ? "Connecté !" : "Se connecter par biométrie"}
            {!loading && !success && <LogIn size={20} />}
          </button>
        </form>

        <div className="w-full border-t border-slate-100 pt-5 text-center mt-2">
          <p className="text-sm text-slate-500 font-medium">
            Pas encore de compte ?{" "}
            <button
              onClick={onGoToRegister}
              className="text-electric font-bold hover:underline cursor-pointer"
              disabled={loading || success}
            >
              S'inscrire gratuitement
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
