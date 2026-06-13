"use client";
// components/layout/MobileNav.js
// Barre de navigation fixe en bas, visible uniquement sur mobile/tablette
// (cachée à partir de md: où le Header desktop prend le relais).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, MessageCircle, Bell, User } from "lucide-react";

const LINKS = [
  { href: "/feed", label: "Accueil", icon: Home },
  { href: "/groupes", label: "Groupes", icon: Users },
  { href: "/messenger", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Alertes", icon: Bell },
  { href: "/profil", label: "Profil", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-100 shadow-[0_-2px_12px_rgba(37,99,235,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-between px-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-electric" : "text-slate-400"
              }`}
            >
              <Icon size={20} fill={active ? "#2563EB" : "none"} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
