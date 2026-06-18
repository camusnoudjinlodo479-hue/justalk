// frontend/src/utils/confetti.js
// Confetti CSS-animation based — instant et spectaculaire

export function triggerConfetti() {
  console.log('confetti triggered');

  // Supprimer un éventuel conteneur existant
  const old = document.getElementById('confetti-container');
  if (old) old.remove();

  // Injecter les keyframes CSS si pas encore présents
  if (!document.getElementById('confetti-keyframes')) {
    const style = document.createElement('style');
    style.id = 'confetti-keyframes';
    style.textContent = `
      @keyframes confetti-fall {
        0%   { transform: translateY(-20px) rotate(0deg)   scaleX(1);  opacity: 1; }
        50%  { transform: translateY(45vh)  rotate(360deg) scaleX(-1); opacity: 1; }
        100% { transform: translateY(105vh) rotate(720deg) scaleX(1);  opacity: 0; }
      }
      @keyframes confetti-sway {
        0%   { margin-left: 0px; }
        25%  { margin-left: 15px; }
        75%  { margin-left: -15px; }
        100% { margin-left: 0px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Conteneur fixe au-dessus de tout
  const container = document.createElement('div');
  container.id = 'confetti-container';
  container.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100%',
    'height: 100%',
    'z-index: 99999',
    'pointer-events: none',
    'overflow: hidden',
    'margin: 0',
    'padding: 0',
  ].join(' !important; ') + ' !important;';
  document.body.appendChild(container);

  const COLORS = [
    '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#06b6d4', '#3b82f6',
    '#a855f7', '#ec4899', '#f43f5e',
  ];

  const PARTICLE_COUNT = 150;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el = document.createElement('div');
    const color  = COLORS[Math.floor(Math.random() * COLORS.length)];
    const left   = Math.random() * 100;           // % horizontal
    const width  = Math.random() * 8 + 6;        // px
    const height = Math.random() * 10 + 6;        // px
    const fallDuration = Math.random() * 2.0 + 1.5; // s (plus rapide)
    const swayDuration = Math.random() * 1.0 + 0.8; // s
    const delay  = Math.random() * 0.3;            // s (démarrage quasi instantané !)
    const radius = Math.random() > 0.5 ? '50%' : '2px';

    el.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: -20px;
      width: ${width}px;
      height: ${height}px;
      background-color: ${color};
      border-radius: ${radius};
      animation:
        confetti-fall ${fallDuration}s ${delay}s ease-in forwards,
        confetti-sway ${swayDuration}s ${delay}s ease-in-out infinite;
      will-change: transform, opacity;
    `;
    container.appendChild(el);
  }

  // Auto-nettoyage après 5 secondes
  setTimeout(() => {
    const c = document.getElementById('confetti-container');
    if (c) c.remove();
  }, 5000);
}

// Exposer globalement pour les appels directs
window.triggerConfetti = triggerConfetti;
