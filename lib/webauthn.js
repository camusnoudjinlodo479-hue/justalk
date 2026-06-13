// lib/webauthn.js
// Wrapper léger autour de @simplewebauthn/browser pour les flux
// d'enregistrement (inscription) et d'authentification (connexion) Justalk.
import {
  startRegistration,
  startAuthentication,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

export async function isBiometricsAvailable() {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

// Étape 1 de l'inscription : demande au serveur les "options" puis
// déclenche Face ID / Windows Hello / Touch ID via le navigateur.
export async function registerBiometric({ pseudo, faceHash = null }) {
  const optionsRes = await fetch("/api/webauthn/register-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo, faceHash }),
  });
  if (!optionsRes.ok) throw new Error("Impossible de générer les options WebAuthn");
  const options = await optionsRes.json();

  const attestation = await startRegistration(options);

  const verifyRes = await fetch("/api/webauthn/register-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo, faceHash, attestation }),
  });
  if (!verifyRes.ok) throw new Error("Vérification WebAuthn échouée");
  return verifyRes.json(); // { uid, token } -> cookie httpOnly posé par l'API
}

// Connexion : récupère les options d'auth (challenge) puis vérifie côté serveur.
export async function loginBiometric() {
  const optionsRes = await fetch("/api/webauthn/login-options", { method: "POST" });
  if (!optionsRes.ok) throw new Error("Impossible de générer le challenge");
  const options = await optionsRes.json();

  const assertion = await startAuthentication(options);

  const verifyRes = await fetch("/api/webauthn/login-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assertion }),
  });
  if (!verifyRes.ok) throw new Error("Authentification refusée");
  return verifyRes.json();
}
