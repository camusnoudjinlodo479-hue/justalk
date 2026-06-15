"use client";
// app/page.js
// Page de connexion et de présentation : reconnexion auto par biométrie,
// déclenchement de WebAuthn, ou onboarding. Présentation des fonctionnalités HD / Éco-Data.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { loginBiometric, isBiometricsAvailable } from "@/lib/webauthn";
import { ScanFace, Fingerprint, Video, ShieldCheck, Zap, ArrowRight, Phone } from "lucide-react";

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex flex-col justify-between py-10 px-4 md:px-8">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between mb-8 md:mb-12">
        <Logo size={42} />
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/onboarding")}
            className="text-sm font-semibold text-slate-600 hover:text-electric transition-colors"
          >
            S'inscrire
          </button>
        </div>
      </header>

      {/* Main Hero & Login */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1 my-auto">
        {/* Left Column: Product Value Proposition */}
        <section className="lg:col-span-7 flex flex-col gap-6 md:gap-8 text-left max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/10 text-electric text-xs font-semibold self-start shadow-sm">
            <Zap size={14} />
            <span>Technologie WebRTC & Codec AV1 de pointe</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Des appels <span className="text-electric">HD fluides</span>,<br />
            sans ruiner votre forfait.
          </h1>

          <p className="text-slate-600 text-base md:text-lg leading-relaxed font-normal">
            Passez des appels vidéo et audio haute définition limpides tout en contrôlant votre consommation de données. Grâce à nos profils intelligents et nos codecs de pointe, restez connecté en toute liberté.
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
            {/* Feature 1 */}
            <div className="flex gap-4 p-5 rounded-2xl bg-white border border-white/60 shadow-embossed hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-electric/10 flex items-center justify-center text-electric shrink-0">
                <Zap size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display font-semibold text-slate-800 text-sm md:text-base">
                  Consommation Ultra-Réduite
                </h3>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                  Notre profil <strong className="text-electric">HD Éco-Data</strong> (15fps, AV1) est ultra sobre : seulement <strong className="text-slate-800 font-semibold">50 Mo</strong> suffisent pour <strong className="text-slate-800 font-semibold">1h d'appel</strong> (soit ~150 Mo pour 3h) !
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4 p-5 rounded-2xl bg-white border border-white/60 shadow-embossed hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
                <Video size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display font-semibold text-slate-800 text-sm md:text-base">
                  Vidéo HD Adaptive
                </h3>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                  L'application s'adapte automatiquement à votre réseau en temps réel, garantissant des appels fluides en toutes circonstances, même en 3G.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4 p-5 rounded-2xl bg-white border border-white/60 shadow-embossed hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                <Phone size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display font-semibold text-slate-800 text-sm md:text-base">
                  Audio Haute Fidélité P2P
                </h3>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                  Profitez de conversations limpides sans serveur relais obligatoire. Connexion directe sécurisée avec un débit audio optimisé à 24 kbps.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-4 p-5 rounded-2xl bg-white border border-white/60 shadow-embossed hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display font-semibold text-slate-800 text-sm md:text-base">
                  Sécurité WebAuthn native
                </h3>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                  Zéro mot de passe stocké. Utilisez FaceID, TouchID ou votre code de verrouillage pour une protection cryptographique maximale.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Connection Card */}
        <section className="lg:col-span-5 w-full flex justify-center lg:justify-end">
          <div className="card-lg w-full max-w-md p-8 flex flex-col items-center gap-6 shadow-glow-lg bg-white/95 backdrop-blur-sm relative overflow-hidden">
            {/* Subtle decor line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-electric to-indigo-500" />

            {status === "checking" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-electric animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Vérification de votre session…</p>
              </div>
            )}

            {status === "ready" && (
              <>
                <div className="w-24 h-24 rounded-full bg-electric/10 flex items-center justify-center animate-pulseRing relative">
                  <ScanFace className="text-electric" size={44} />
                  <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                </div>

                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-slate-800">
                    Connexion sécurisée
                  </h2>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    Utilisez la reconnaissance faciale ou l'empreinte digitale de votre appareil pour accéder instantanément à vos contacts.
                  </p>
                </div>

                <button
                  onClick={handleLogin}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 shadow-lg shadow-electric/20 hover:shadow-electric/30 transition-all text-base"
                >
                  <Fingerprint size={20} /> Se connecter
                </button>
              </>
            )}

            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-electric animate-spin" />
                <p className="text-electric text-sm font-semibold animate-pulse">Vérification biométrique en cours…</p>
              </div>
            )}

            {status === "unsupported" && (
              <div className="flex flex-col items-center gap-5 w-full text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Fingerprint size={32} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-slate-800 text-lg">Biométrie non disponible</h3>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Votre appareil ne supporte pas la biométrie native ou celle-ci n'est pas configurée.
                  </p>
                </div>
                <button onClick={() => router.push("/onboarding")} className="btn-primary w-full flex items-center justify-center gap-2">
                  Créer un compte ou utiliser mon schéma <ArrowRight size={16} />
                </button>
              </div>
            )}

            {error && (
              <div className="w-full p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs md:text-sm font-medium text-center">
                {error}
              </div>
            )}

            {status !== "checking" && status !== "loading" && (
              <div className="w-full border-t border-slate-100 pt-5 text-center flex flex-col gap-3">
                <button
                  onClick={() => router.push("/onboarding")}
                  className="text-sm text-electric font-semibold hover:underline flex items-center justify-center gap-1.5 mx-auto"
                >
                  Pas encore inscrit ? Rejoindre Justalk <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center border-t border-slate-200/50 pt-8 mt-8 md:mt-12">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Justalk. Tous droits réservés. Vos conversations et flux vidéo sont protégés par chiffrement de bout en bout P2P.
        </p>
      </footer>
    </main>
  );
}
