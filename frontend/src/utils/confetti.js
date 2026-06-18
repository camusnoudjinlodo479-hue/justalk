// frontend/src/utils/confetti.js
// Confetti spectaculaire utilisant la librairie canvas-confetti (battle-tested)
import confetti from 'canvas-confetti';

export function triggerConfetti() {
  console.log('confetti triggered');

  const colors = [
    '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#06b6d4', '#3b82f6',
    '#a855f7', '#ec4899',
  ];

  const end = Date.now() + 3000;

  // Rafale initiale depuis le centre
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors,
    zIndex: 99999,
    disableForReducedMotion: false,
  });

  // Animation continue en cascade depuis les deux côtés
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      zIndex: 99999,
      disableForReducedMotion: false,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      zIndex: 99999,
      disableForReducedMotion: false,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Exposer globalement pour usage non-React
window.triggerConfetti = triggerConfetti;
