"use client";
// components/onboarding/FaceScanStep.js
// Étape 1 : "Scan ton visage" — délègue directement à WebAuthn (Face ID /
// Windows Hello / Touch ID), sans caméra ni face-api.js. L'OS gère la
// reconnaissance faciale nativement et de façon sécurisée (Secure
// Enclave / TPM), Justalk ne voit ni ne stocke jamais l'image du visage.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScanFace, CheckCircle2, AlertTriangle, Fingerprint } from "lucide-react";
import { isBiometricsAvailable, registerBiometric } from "@/lib/webauthn";

export default function FaceScanStep({ pseudo, onSuccess }) {
  const [status, setStatus] = useState("checking"); // checking | ready | scanning | detected | error | bio-missing
  const [error, setError] = useState("");

  useEffect(() => {
    isBiometricsAvailable().then((available) => setStatus(available ? "ready" : "bio-missing"));
  }, []);

  async function handleScan() {
    setStatus("scanning");
    setError("");
    try {
      // Déclenche directement Face ID / Windows Hello / Touch ID natif.
      const result = await registerBiometric({ pseudo });
      setStatus("detected");
      setTimeout(() => onSuccess({ ...result }), 600);
    } catch (e) {
      setError(e.message || "Scan biométrique annulé ou refusé.");
      setStatus("ready");
    }
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">Scan ton visage</h2>
        <p className="text-slate-500 mt-1 text-sm max-w-xs mx-auto">
          Utilise Face ID, Windows Hello ou Touch ID pour créer ton empreinte sécurisée — gérée
          directement par ton appareil.
        </p>
      </div>

      {/* Cadre rond animé */}
      <div className="relative w-56 h-56">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-electric/30"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-3 rounded-full overflow-hidden bg-electric/5 shadow-glow-lg flex items-center justify-center">
          {status === "checking" && (
            <span className="text-slate-400 text-sm">Vérification…</span>
          )}
          {(status === "ready" || status === "error") && (
            <ScanFace className="text-electric" size={64} />
          )}
          {status === "scanning" && (
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Fingerprint className="text-electric" size={64} />
            </motion.div>
          )}
          {status === "detected" && (
            <div className="absolute inset-0 bg-electric/20 flex items-center justify-center">
              <CheckCircle2 className="text-electric" size={64} />
            </div>
          )}
          {status === "bio-missing" && (
            <ScanFace className="text-slate-300" size={64} />
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {status !== "bio-missing" ? (
        <button onClick={handleScan} disabled={status === "checking" || status === "scanning"} className="btn-primary w-full max-w-xs">
          {status === "detected"
            ? "Visage validé ✓"
            : status === "scanning"
            ? "Vérification en cours…"
            : "Lancer le scan biométrique"}
        </button>
      ) : (
        <p className="text-xs text-slate-400 max-w-xs">
          La biométrie native n'est pas disponible sur cet appareil. Tu passeras par le schéma
          3x3 à l'étape suivante.
        </p>
      )}
    </div>
  );
}
