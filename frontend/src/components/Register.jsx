// frontend/src/components/Register.jsx
// Formulaire d'inscription biométrique Justalk.

import { useState } from "react";
import { create } from "@github/webauthn-json";
import { User, ScanFace, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function Register({ onRegisterSuccess, onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccess(false);

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanUsername) {
      setError("Le pseudo est requis.");
      setLoading(false);
      return;
    }

    try {
      // 1. Appel du backend pour récupérer les options de création de clé
      const optionsRes = await fetch("/api/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          display_name: cleanDisplayName || cleanUsername,
        }),
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de générer le challenge biométrique.");
      }

      const options = await optionsRes.json();

      // 2. Déclenchement de la biométrie via @github/webauthn-json
      // create() prend en charge toute la sérialisation/désérialisation du protocole
      const attestation = await create(options);

      // 3. Envoi de la réponse au backend pour validation finale
      const verifyRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          display_name: cleanDisplayName || cleanUsername,
          registration_response: attestation,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.detail || "La vérification de l'attestation a échoué.");
      }

      const verifyData = await verifyRes.json();
      setSuccess(true);
      
      // Petit délai pour l'animation de succès avant de basculer
      setTimeout(() => {
        onRegisterSuccess(verifyData.user_id, cleanUsername);
      }, 1000);

    } catch (err) {
      console.error("Erreur inscription :", err);
      setError(err.message || "Une erreur inconnue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 card-lg bg-white/95 backdrop-blur-md relative overflow-hidden">
      {/* Ligne décorative dégradée premium */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-electric via-blue-500 to-indigo-500" />
      
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-electric/10 flex items-center justify-center text-electric animate-pulseRing relative mb-2">
          <ScanFace size={32} />
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold text-slate-800">Créer un compte</h2>
          <p className="text-slate-500 mt-1.5 text-sm max-w-xs mx-auto">
            Utilisez la biométrie (Face ID, Touch ID, Windows Hello) de votre appareil. Zéro mot de passe requis.
          </p>
        </div>

        <form onSubmit={handleRegister} className="w-full flex flex-col gap-4 mt-2">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Pseudo (ex: antoine)"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className="input-pill pl-12"
              required
              disabled={loading || success}
            />
          </div>

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Nom complet (ex: Antoine L.)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-pill pl-12"
              disabled={loading || success}
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold flex items-center gap-2 text-left">
              <ShieldCheck size={15} className="shrink-0 animate-bounce" />
              <span>Compte créé avec succès ! Redirection en cours...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
          >
            {loading ? "Vérification de l'appareil..." : success ? "Enregistré !" : "Lancer le scan biométrique"}
            {!loading && !success && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="w-full border-t border-slate-100 pt-5 text-center mt-2">
          <p className="text-xs text-slate-400 font-medium">
            Déjà inscrit ?{" "}
            <button
              onClick={onGoToLogin}
              className="text-electric font-bold hover:underline"
              disabled={loading || success}
            >
              Se connecter ici
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
