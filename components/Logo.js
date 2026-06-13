// components/Logo.js
// Bulle de chat + icône visage stylisée. Utilisé dans le header et l'onboarding.
export default function Logo({ size = 40, withWordmark = true }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <div
        className="justalk-logo rounded-2xl rounded-br-sm bg-electric shadow-glow"
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.58}
          height={size * 0.58}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* visage minimal : contour + empreinte digitale stylisée */}
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" />
          <path
            d="M7 14c1.5 1.6 3.2 2.4 5 2.4s3.5-.8 5-2.4"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="9" cy="10" r="1" fill="white" />
          <circle cx="15" cy="10" r="1" fill="white" />
        </svg>
      </div>
      {withWordmark && (
        <span className="font-display font-bold text-xl text-slate-800 tracking-tight">
          Just<span className="text-electric">alk</span>
        </span>
      )}
    </div>
  );
}
