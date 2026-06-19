// frontend/src/App.jsx
import { useState, useEffect, useRef } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Feed from "./components/Feed";
import { ShieldAlert, Loader2 } from "lucide-react";

function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let particles = [];

    const colors = [
      "rgba(24, 119, 242, 0.5)",  // Electric Blue
      "rgba(236, 72, 153, 0.5)", // Neon Pink
      "rgba(168, 85, 247, 0.5)", // Neon Purple
      "rgba(16, 185, 129, 0.5)", // Emerald
      "rgba(245, 158, 11, 0.5)"  // Amber
    ];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    const initParticles = () => {
      const particleCount = Math.min(65, Math.floor((window.innerWidth * window.innerHeight) / 16000));
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 2.5 + 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          pulseSpeed: 0.01 + Math.random() * 0.02,
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    };

    let time = 0;
    const animate = () => {
      time += 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        // Move & Bounce
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > window.innerWidth) p.vx = -p.vx;
        if (p.y < 0 || p.y > window.innerHeight) p.vy = -p.vy;

        // Pulse size & opacity
        const scale = 0.55 + Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.45;
        const currentRadius = p.radius * scale;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === "/signup" || path === "/register") {
      return "register";
    }
    return "login";
  });
  const [checkingSession, setCheckingSession] = useState(true);
  const [serverError, setServerError] = useState("");

  const checkSession = async () => {
    setCheckingSession(true);
    setServerError("");
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const userData = await res.json();
        setCurrentUser(userData);
        setView("feed");
      } else {
        setCurrentUser(null);
        const path = window.location.pathname.toLowerCase();
        if (path === "/signup" || path === "/register") {
          setView("register");
        } else {
          setView("login");
        }
      }
    } catch (err) {
      setServerError("Impossible de se connecter au serveur. Vérifiez que le backend est démarré.");
    } finally {
      setCheckingSession(false);
    }
  };

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log("PWA installée avec succès !");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Réponse de l'utilisateur à l'installation: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => { checkSession(); }, []);

  const handleLoginSuccess = () => checkSession();
  const handleRegisterSuccess = () => checkSession();

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setCurrentUser(null);
    setView("login");
  };

  if (checkingSession) {
    return (
      <div className="h-[100dvh] w-screen bg-[#090b11] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-3xl">J</span>
        </div>
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <p className="text-gray-400 font-semibold text-base">Chargement...</p>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="h-[100dvh] w-screen bg-[#090b11] flex flex-col items-center justify-center p-4">
        <div className="card-lg max-w-md w-full flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <h3 className="font-bold text-gray-100 text-xl">Erreur de connexion</h3>
          <p className="text-gray-400 text-base leading-relaxed">{serverError}</p>
          <button onClick={checkSession} className="btn-primary px-8">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === "login" && (
        <div className="relative h-[100dvh] w-screen bg-[#090b11] flex items-center justify-center p-4 overflow-hidden select-none">
          <ParticleBackground />
          <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setView("register")} />
        </div>
      )}

      {view === "register" && (
        <div className="relative h-[100dvh] w-screen bg-[#090b11] flex items-center justify-center p-4 overflow-hidden select-none">
          <ParticleBackground />
          <Register onRegisterSuccess={handleRegisterSuccess} onGoToLogin={() => setView("login")} />
        </div>
      )}

      {view === "feed" && (
        <Feed currentUser={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} />
      )}

      {showInstallBanner && (
        <div className="pwa-install-banner animate-slideUp">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                J
              </div>
              <div>
                <p className="text-xs font-bold text-white">Installer l'application Justalk</p>
                <p className="text-[10px] text-slate-400">Accédez rapidement à vos messages et appels en plein écran.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button 
                onClick={() => setShowInstallBanner(false)} 
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold transition-all"
              >
                Plus tard
              </button>
              <button 
                onClick={handleInstallClick} 
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-md active:scale-95 transition-all"
              >
                Installer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

