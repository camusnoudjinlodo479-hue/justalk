"use client";
// app/page.js
// Page de connexion : reconnexion auto par biométrie (JWT en cookie httpOnly),
// ou déclenchement manuel de WebAuthn. Sinon -> onboarding.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { loginBiometric, isBiometricsAvailable } from "@/lib/webauthn";
import { ScanFace, Fingerprint } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ready | loading | error | unsupported
  const [error, setError] = useState("");

  useEffect(() => {
    async function autoLogin() {
      // 1. Le navigateur tente la reconnexion silencieuse via le cookie JWT httpOnly
      try {
        const res = await fetch("/api/session/check");
        if (res.ok) {
          router.push("/feed");
          return;
        }
      } catch {}

      // 2. Sinon on propose la connexion biométrique manuelle
      const available = await isBiometricsAvailable();
      setStatus(available ? "ready" : "unsupported");
    }
    autoLogin();
  }, [router]);

  async function handleLogin() {
    setStatus("loading");
    setError("");
    try {
      await loginBiometric();
      router.push("/feed");
    } catch (e) {
      setError("Connexion biométrique refusée ou annulée.");
      setStatus("ready");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={56} />
        <p className="text-slate-500 font-medium">Just you. Justalk.</p>
      </div>

      <div className="card-lg w-full max-w-sm p-8 flex flex-col items-center gap-6">
        {status === "checking" && (
          <p className="text-slate-400 text-sm">Vérification de ta session…</p>
        )}

        {status === "ready" && (
          <>
            <div className="w-24 h-24 rounded-full bg-electric/10 flex items-center justify-center animate-pulseRing">
              <ScanFace className="text-electric" size={40} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-800">
                Connexion biométrique
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Utilise la reconnaissance faciale ou l'empreinte digitale de ton appareil (Android, iOS ou Windows) pour accéder à ton compte.
              </p>
            </div>
            <button onClick={handleLogin} className="btn-primary w-full flex items-center justify-center gap-2">
              <Fingerprint size={18} /> Se connecter
            </button>
          </>
        )}

        {status === "loading" && (
          <p className="text-electric text-sm font-medium">Vérification biométrique…</p>
        )}

        {status === "unsupported" && (
          <>
            <p className="text-slate-500 text-sm">
              Ton appareil ne propose pas de biométrie native. Connecte-toi avec ton schéma de
              secours.
            </p>
            <button onClick={() => router.push("/onboarding")} className="btn-ghost w-full">
              Utiliser le schéma
            </button>
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={() => router.push("/onboarding")}
          className="text-sm text-electric font-medium hover:underline"
        >
          Pas encore de compte ? Crée le tien
        </button>
      </div>
    </main>
  );
}
