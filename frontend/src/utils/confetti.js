// frontend/src/utils/confetti.js

export function triggerConfetti() {
  console.log('confetti triggered');
  // 1. Créer le canvas s'il n'existe pas déjà
  let canvas = document.getElementById("confetti-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 99999 !important; pointer-events: none !important; margin: 0 !important; padding: 0 !important; background: transparent !important;";
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");
  
  // Ajuster la résolution
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();

  // Couleurs : Rouge, orange, jaune, violet, bleu clair
  const COLORS = ["#ef4444", "#f97316", "#eab308", "#a855f7", "#06b6d4"];
  const PARTICLE_COUNT = 150;
  const particles = [];

  // 2. Générer 150 confettis au centre-haut de l'écran
  const spawnX = canvas.width / 2;
  const spawnY = -20;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: spawnX,
      y: spawnY,
      // Dispersion horizontale initiale
      vx: (Math.random() - 0.5) * 8,
      // Lancer initial légèrement vers le haut pour faire un joli dôme
      vy: Math.random() * -4 - 2,
      // Taille
      width: Math.random() * 8 + 6,
      height: Math.random() * 10 + 6,
      // Couleur
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      // Rotation
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      // Courbe de balancement
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.05 + 0.02,
      // Opacité
      opacity: 1,
      // Résistance à l'air aléatoire
      friction: 0.98
    });
  }

  let startTime = Date.now();
  let animationFrameId;

  // 3. Boucle d'animation avec requestAnimationFrame
  const animate = () => {
    const elapsed = Date.now() - startTime;
    
    // Auto-destroy après 3 secondes
    if (elapsed >= 3000) {
      cancelAnimationFrame(animationFrameId);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fade out progressif sur les 500 dernières millisecondes
    const fadeStart = 2200;
    let globalOpacity = 1;
    if (elapsed > fadeStart) {
      globalOpacity = 1 - (elapsed - fadeStart) / (3000 - fadeStart);
    }

    particles.forEach((p) => {
      // 4. Physique & Gravité
      p.vy += 0.22; // Accélération vers le bas (gravité)
      p.vx *= p.friction;
      
      // Légère courbe aléatoire gauche/droite (balancement)
      p.wobble += p.wobbleSpeed;
      p.x += Math.sin(p.wobble) * 0.8 + p.vx;
      p.y += p.vy;

      // Rotation
      p.rotation += p.rotationSpeed;

      // Dessiner le confetti
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity * globalOpacity;
      
      // Rendu rectangulaire 3D simulé en faisant osciller la largeur
      const wobbleWidth = p.width * Math.cos(p.wobble);
      ctx.fillRect(-wobbleWidth / 2, -p.height / 2, wobbleWidth, p.height);
      
      ctx.restore();
    });

    animationFrameId = requestAnimationFrame(animate);
  };

  animate();
}

// Exposer globalement
window.triggerConfetti = triggerConfetti;
