// public/sw.js
// Service Worker minimaliste pour valider les critères d'installation PWA (Chrome/Edge/Safari).
// Utilise une stratégie "Network Only" sans mise en cache pour éviter les bugs de pages obsolètes.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Redirige simplement toutes les requêtes vers le réseau.
  // Nécessaire pour que le navigateur affiche le bouton d'installation PWA ("Ajouter à l'écran d'accueil").
  event.respondWith(fetch(event.request));
});
