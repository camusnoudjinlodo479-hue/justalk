// components/Logo.js
// Logo inspiré du style Canva : badge à gradient bleu/indigo avec texte blanc stylisé.
export default function Logo({ size = 40, withWordmark = true }) {
  if (withWordmark) {
    // Version complète : badge horizontal contenant "justalk"
    return (
      <div className="flex items-center select-none">
        <div
          className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-500 shadow-glow flex items-center justify-center px-4 font-display font-black text-white tracking-tight"
          style={{ height: size, minWidth: size * 2.8 }}
        >
          <span style={{ fontSize: size * 0.45 }}>
            just<span className="opacity-90 font-light">alk</span>
          </span>
        </div>
      </div>
    );
  }

  // Version compacte : badge squircle contenant "just" (ou "j")
  return (
    <div className="flex items-center select-none">
      <div
        className="rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-500 shadow-glow flex items-center justify-center font-display font-black text-white tracking-tight"
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.38 }}>
          just
        </span>
      </div>
    </div>
  );
}

