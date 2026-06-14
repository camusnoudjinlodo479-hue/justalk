"use client";
// app/onboarding/page.js
// Orchestration des 3 étapes : visage -> schéma (fallback) -> profil.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";
import FaceScanStep from "@/components/onboarding/FaceScanStep";
import PatternLockStep from "@/components/onboarding/PatternLockStep";
import ProfileSetupStep from "@/components/onboarding/ProfileSetupStep";

const STEPS = ["face", "pattern", "profile"];

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [pseudoDraft, setPseudoDraft] = useState("");
  const [data, setData] = useState({});

  const step = STEPS[stepIndex];

  function next(payload = {}) {
    setData((prev) => ({ ...prev, ...payload }));
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  async function finish({ pseudo, firstName, lastName, birthdate, avatarFile }) {
    // 1. Upload de la photo vers Firebase Storage
    // 2. Création du document Firestore /users/{uid}
    // 3. Le cookie JWT httpOnly a déjà été posé par /api/webauthn/register-verify
    try {
      const fd = new FormData();
      fd.append("pseudo", pseudo);
      fd.append("firstName", firstName);
      fd.append("lastName", lastName);
      fd.append("birthdate", birthdate);
      fd.append("pattern", JSON.stringify(data.pattern || null));
      if (avatarFile) fd.append("avatar", avatarFile);

      const res = await fetch("/api/profile/create", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur de configuration serveur.");
      }
      router.push("/feed");
    } catch (e) {
      console.error("Erreur lors de l'onboarding :", e);
      alert("Impossible de finaliser l'inscription : " + e.message);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-10">
      <Logo size={48} />

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= stepIndex ? "bg-electric w-10" : "bg-slate-200 w-6"
            }`}
          />
        ))}
      </div>

      <div className="card-lg w-full max-w-md p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {step === "face" && (
              <FaceScanStep
                pseudo={pseudoDraft || "user"}
                onSuccess={(payload) => next(payload)}
              />
            )}
            {step === "pattern" && (
              <PatternLockStep onSuccess={(payload) => next(payload)} />
            )}
            {step === "profile" && (
              <ProfileSetupStep
                onComplete={(payload) => {
                  setPseudoDraft(payload.pseudo);
                  finish(payload);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-xs text-slate-400 max-w-sm text-center">
        En continuant, tu acceptes que Justalk traite une empreinte chiffrée de ton visage à des
        fins d'authentification uniquement. Aucune photo n'est conservée. Voir notre politique
        RGPD.
      </p>
    </main>
  );
}
