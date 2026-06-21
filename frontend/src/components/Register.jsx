// frontend/src/components/Register.jsx
// Formulaire d'inscription biométrique Justalk.

import { useState } from "react";
import { create } from "@github/webauthn-json";
import { User, ScanFace, ArrowRight, ShieldCheck, AlertCircle, Mic, KeyRound } from "lucide-react";
import { triggerConfetti } from "../utils/confetti";

export default function Register({ onRegisterSuccess, onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [usePasscode, setUsePasscode] = useState(() => {
    const hasBiometric = typeof window !== "undefined" && (!!window.PublicKeyCredential || !!window.AndroidBridge);
    return !hasBiometric;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [isListeningUsername, setIsListeningUsername] = useState(false);
  const [isListeningDisplayName, setIsListeningDisplayName] = useState(false);

  const startVoiceInput = (field) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (field === "username") {
      setIsListeningUsername(true);
    } else {
      setIsListeningDisplayName(true);
    }

    recognition.start();

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      if (field === "username") {
        const cleanVal = speechToText
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "")
          .replace(/[^a-zA-Z0-9]/g, "") // Enlever caractères spéciaux pour pseudo
          .toLowerCase();
        setUsername(cleanVal);
      } else {
        setDisplayName(speechToText);
      }
    };

    recognition.onerror = (event) => {
      console.error("Erreur SpeechRecognition:", event.error);
      if (event.error !== "no-speech") {
        alert("Erreur lors de l'écoute. Veuillez autoriser le microphone.");
      }
    };

    recognition.onend = () => {
      if (field === "username") {
        setIsListeningUsername(false);
      } else {
        setIsListeningDisplayName(false);
      }
    };
  };

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

    if (usePasscode) {
      if (!passcode) {
        setError("Le code secret est requis.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/register-passcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUsername,
            display_name: cleanDisplayName || cleanUsername,
            passcode,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Impossible de créer le compte.");
        }

        const data = await res.json();
        setSuccess(true);
        triggerConfetti();

        setTimeout(() => {
          onRegisterSuccess(data.user_id, cleanUsername);
        }, 3500);

      } catch (err) {
        console.error("Erreur inscription passcode :", err);
        setError(err.message || "Une erreur est survenue.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Native Android Biometric Registration ---
    if (typeof window !== "undefined" && window.AndroidBridge) {
      try {
        await new Promise((resolve, reject) => {
          window.onBiometricRegisterResult = (success, errorMsg) => {
            delete window.onBiometricRegisterResult;
            if (success) resolve();
            else reject(new Error(errorMsg || "Authentification biométrique échouée."));
          };
          window.AndroidBridge.showBiometricPrompt("onBiometricRegisterResult");
        });

        // Génération d'une clé d'authentification aléatoire forte pour ce téléphone
        const randomPasscode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const res = await fetch("/api/auth/register-passcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUsername,
            display_name: cleanDisplayName || cleanUsername,
            passcode: randomPasscode,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Impossible de créer le compte.");
        }

        const data = await res.json();
        
        // Stocker la clé secrète dans le stockage privé de l'application
        localStorage.setItem(`justalk_biometric_${cleanUsername}`, randomPasscode);
        
        setSuccess(true);
        triggerConfetti();

        setTimeout(() => {
          onRegisterSuccess(data.user_id, cleanUsername);
        }, 3500);

      } catch (err) {
        console.error("Erreur inscription native biométrique :", err);
        setError(err.message || "Authentification native échouée.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Vérification minimale : WebAuthn doit être supporté (HTTPS requis)
    if (!window.PublicKeyCredential) {
      setError("Votre navigateur ne supporte pas la biométrie. Utilisez l'inscription par code.");
      setLoading(false);
      return;
    }

    try {
      // Étape 1 : Récupérer le challenge depuis le backend
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

      // Étape 2 : Déclencher la biométrie via l'API WebAuthn du navigateur
      let attestation;
      try {
        attestation = await create({ publicKey: options });
      } catch (webauthnErr) {
        console.error("Erreur WebAuthn navigateur :", webauthnErr);
        if (
          webauthnErr.name === "NotAllowedError" ||
          webauthnErr.message?.includes("not allowed")
        ) {
          throw new Error("Scan annulé ou refusé. Veuillez réessayer et confirmer avec votre empreinte / Face ID.");
        }
        if (
          webauthnErr.name === "InvalidStateError" ||
          webauthnErr.message?.includes("already registered")
        ) {
          throw new Error("Ce pseudo est déjà associé à un appareil. Essayez de vous connecter.");
        }
        if (
          webauthnErr.name === "NotSupportedError" ||
          webauthnErr.message?.includes("not supported")
        ) {
          throw new Error("Ajoutez une empreinte dans Paramètres > Sécurité de votre téléphone.");
        }
        throw new Error("La biométrie a échoué : " + (webauthnErr.message || webauthnErr.name));
      }

      // Étape 3 : Envoyer l'attestation pour vérification
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
      triggerConfetti();

      setTimeout(() => {
        onRegisterSuccess(verifyData.user_id, cleanUsername);
      }, 3500);

    } catch (err) {
      console.error("Erreur inscription :", err);
      setError(err.message || "Une erreur inconnue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const hasBiometricSupport = typeof window !== "undefined" && (!!window.PublicKeyCredential || !!window.AndroidBridge);

  return (
    <div className="w-full max-w-[480px] sm:max-w-lg p-8 sm:p-10 card-lg bg-white/80 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden z-10">
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-sky-400 to-purple-600" />
      
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 animate-pulseRing relative mb-2">
          {usePasscode ? <KeyRound size={40} /> : <ScanFace size={40} />}
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-800">
            {usePasscode ? "Créer un compte par code" : "Créer un compte"}
          </h2>
          <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-sm mx-auto">
            {usePasscode
              ? "Choisissez un pseudo, votre nom et un code secret pour vous inscrire."
              : "Utilisez la biométrie (Face ID, Touch ID, Windows Hello) de votre appareil. Zéro mot de passe requis."
            }
          </p>
        </div>

        <form onSubmit={handleRegister} className="w-full flex flex-col gap-4 mt-2">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Pseudo (ex: antoine)"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className="input-pill pl-12 pr-12 py-3.5 sm:py-4 text-sm sm:text-base bg-slate-100 text-slate-900 border-slate-200"
              required
              disabled={loading || success}
            />
            <button
              type="button"
              onClick={() => startVoiceInput("username")}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${
                isListeningUsername 
                  ? "bg-red-500 text-white animate-micPulse" 
                  : "text-slate-400 hover:text-blue-500 hover:bg-slate-100"
              }`}
              disabled={loading || success}
              title="Dicter le pseudo"
            >
              <Mic size={18} />
            </button>
          </div>

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Nom complet (ex: Antoine L.)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-pill pl-12 pr-12 py-3.5 sm:py-4 text-sm sm:text-base bg-slate-100 text-slate-900 border-slate-200"
              disabled={loading || success}
            />
            <button
              type="button"
              onClick={() => startVoiceInput("display_name")}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${
                isListeningDisplayName 
                  ? "bg-red-500 text-white animate-micPulse" 
                  : "text-slate-400 hover:text-blue-500 hover:bg-slate-100"
              }`}
              disabled={loading || success}
              title="Dicter le nom complet"
            >
              <Mic size={18} />
            </button>
          </div>

          {usePasscode && (
            <div className="relative animate-fadeIn">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="password"
                placeholder="Code secret (ex: 123456)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="input-pill pl-12 py-3.5 sm:py-4 text-sm sm:text-base bg-slate-100 text-slate-900 border-slate-200"
                required
                disabled={loading || success}
              />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold flex items-center gap-2.5 text-left animate-scaleIn">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-semibold flex items-center gap-2.5 text-left animate-scaleIn">
              <ShieldCheck size={18} className="shrink-0 animate-bounce" />
              <span>Compte créé avec succès ! Redirection en cours...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-sm sm:text-base font-bold cursor-pointer"
          >
            {loading ? "Création..." : success ? "Enregistré !" : usePasscode ? "S'inscrire" : "Lancer le scan biométrique"}
            {!loading && !success && <ArrowRight size={20} />}
          </button>

          {hasBiometricSupport && (
            <button
              type="button"
              onClick={() => {
                setUsePasscode(!usePasscode);
                setError("");
              }}
              className="text-xs text-blue-600 font-bold hover:underline mt-1 cursor-pointer self-center"
              disabled={loading || success}
            >
              {usePasscode ? "S'inscrire avec la biométrie de l'appareil" : "S'inscrire avec un code secret à la place"}
            </button>
          )}
        </form>

        <div className="w-full border-t border-slate-100 pt-5 text-center mt-2">
          <p className="text-sm text-slate-500 font-medium">
            Déjà inscrit ?{" "}
            <button
              onClick={onGoToLogin}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
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

