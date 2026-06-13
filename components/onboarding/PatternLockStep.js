"use client";
// components/onboarding/PatternLockStep.js
// Étape 2 : "Trace ton schéma" — grille 3x3 dessinée en <canvas>, fallback
// quand WebAuthn/biométrie native n'est pas disponible sur l'appareil.
import { useRef, useState, useEffect, useCallback } from "react";

const SIZE = 280;
const PAD = 40;
const GRID = 3;

function nodePositions() {
  const step = (SIZE - PAD * 2) / (GRID - 1);
  const pts = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      pts.push({ index: row * GRID + col, x: PAD + col * step, y: PAD + row * step });
    }
  }
  return pts;
}

export default function PatternLockStep({ onSuccess }) {
  const canvasRef = useRef(null);
  const [path, setPath] = useState([]);
  const [confirmPath, setConfirmPath] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState("create"); // create | confirm | error
  const points = nodePositions();

  const draw = useCallback(
    (currentPath, cursor) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, SIZE, SIZE);

      // nodes
      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = currentPath.includes(p.index) ? "#2563EB" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563EB";
        ctx.stroke();
        if (currentPath.includes(p.index)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        }
      });

      // lines
      if (currentPath.length > 0) {
        ctx.beginPath();
        const first = points[currentPath[0]];
        ctx.moveTo(first.x, first.y);
        currentPath.slice(1).forEach((idx) => {
          const p = points[idx];
          ctx.lineTo(p.x, p.y);
        });
        if (cursor) ctx.lineTo(cursor.x, cursor.y);
        ctx.strokeStyle = "#2563EB";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    },
    [points]
  );

  useEffect(() => draw(path), [path, draw]);

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * SIZE,
      y: ((clientY - rect.top) / rect.height) * SIZE,
    };
  }

  function nearestNode(pos) {
    return points.find((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 22);
  }

  function handleStart(e) {
    setDrawing(true);
    setPath([]);
  }

  function handleMove(e) {
    if (!drawing) return;
    const pos = getCanvasPos(e);
    const node = nearestNode(pos);
    setPath((prev) => {
      const next = node && !prev.includes(node.index) ? [...prev, node.index] : prev;
      draw(next, pos);
      return next;
    });
  }

  function handleEnd() {
    setDrawing(false);
    if (path.length < 4) {
      setMode("error");
      setTimeout(() => {
        setPath([]);
        setMode(confirmPath ? "confirm" : "create");
      }, 800);
      return;
    }

    if (mode === "create") {
      setConfirmPath(path);
      setMode("confirm");
      setTimeout(() => setPath([]), 400);
    } else if (mode === "confirm") {
      if (JSON.stringify(path) === JSON.stringify(confirmPath)) {
        onSuccess({ pattern: confirmPath });
      } else {
        setMode("error");
        setTimeout(() => {
          setConfirmPath(null);
          setPath([]);
          setMode("create");
        }, 900);
      }
    }
  }

  const titles = {
    create: "Trace ton schéma",
    confirm: "Confirme ton schéma",
    error: "Schéma incorrect, réessaie",
  };
  const subtitles = {
    create: "Relie au moins 4 points pour créer ton verrou de secours.",
    confirm: "Reproduis exactement le même schéma.",
    error: "Les deux schémas ne correspondent pas.",
  };

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">{titles[mode]}</h2>
        <p
          className={`text-sm mt-1 max-w-xs mx-auto ${
            mode === "error" ? "text-red-500" : "text-slate-500"
          }`}
        >
          {subtitles[mode]}
        </p>
      </div>

      <div className="card p-4">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="touch-none rounded-xl bg-bg"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      <p className="text-xs text-slate-400 max-w-xs">
        Ce schéma ne sert qu'en secours : ton compte reste protégé par ton empreinte faciale
        chiffrée.
      </p>
    </div>
  );
}
