"use client";
// components/onboarding/ProfileSetupStep.js
// Étape 3 : nom, prénom, date de naissance, pseudo et photo de profil.
// Toujours zéro email/mot de passe.
import { useState, useRef } from "react";
import { Camera, ArrowRight } from "lucide-react";

export default function ProfileSetupStep({ onComplete }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  // 13 ans minimum (standard RGPD / réseaux sociaux)
  function isOldEnough(dateStr) {
    if (!dateStr) return false;
    const birth = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 13);
    return birth <= cutoff;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !pseudo.trim() || !birthdate) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (!isOldEnough(birthdate)) {
      setError("Tu dois avoir au moins 13 ans pour utiliser Justalk.");
      return;
    }
    onComplete({
      pseudo: pseudo.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthdate,
      avatarFile: fileRef.current?.files?.[0] || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center text-center gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">Crée ton profil</h2>
        <p className="text-slate-500 mt-1 text-sm max-w-xs mx-auto">
          Dernière étape : tes infos de base et une photo. C'est tout — zéro email, zéro mot de
          passe.
        </p>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative w-28 h-28 rounded-full bg-white shadow-embossed flex items-center justify-center overflow-hidden border-2 border-dashed border-electric/40 hover:border-electric transition-colors"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Aperçu profil" className="w-full h-full object-cover" />
        ) : (
          <Camera className="text-electric" size={28} />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </button>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <input
          className="input-pill text-center font-medium"
          placeholder="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={40}
          required
        />
        <input
          className="input-pill text-center font-medium"
          placeholder="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          maxLength={40}
          required
        />
      </div>

      <div className="w-full max-w-xs text-left">
        <label className="text-xs text-slate-400 ml-1">Date de naissance</label>
        <input
          type="date"
          className="input-pill text-center font-medium mt-1"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          required
        />
      </div>

      <input
        className="input-pill max-w-xs text-center font-medium"
        placeholder="@pseudo"
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value.replace(/\s/g, ""))}
        maxLength={24}
        required
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" className="btn-primary w-full max-w-xs flex items-center justify-center gap-2">
        Rejoindre Justalk <ArrowRight size={18} />
      </button>

      <p className="text-[11px] text-slate-400 max-w-xs">
        Ta date de naissance n'est jamais affichée publiquement par défaut — tu peux choisir de
        la partager plus tard dans ton profil.
      </p>
    </form>
  );
}
