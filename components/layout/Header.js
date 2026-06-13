"use client";
// components/layout/Header.js
import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Search, Bell, MessageCircle, Home, Users } from "lucide-react";

export default function Header({ user, notifCount = 0 }) {
  const [query, setQuery] = useState("");

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white shadow-embossed z-40">
      <div className="h-full max-w-7xl mx-auto px-3 flex items-center justify-between gap-3">
        {/* Left: logo + search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/feed" className="shrink-0">
            <Logo size={36} withWordmark={false} />
          </Link>
          <div className="relative hidden sm:block w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher sur Justalk"
              className="input-pill pl-9 py-2 text-sm bg-bg"
            />
          </div>
        </div>

        {/* Center: nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          <NavIcon href="/feed" icon={Home} label="Fil d'actualité" />
          <NavIcon href="/groupes" icon={Users} label="Groupes" />
          <NavIcon href="/messenger" icon={MessageCircle} label="Messenger" />
        </nav>

        {/* Right: notifications + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/notifications" className="icon-btn relative">
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-electric text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </Link>
          <Link href="/profil" className="w-10 h-10 rounded-full overflow-hidden shadow-embossed bg-electric/10 flex items-center justify-center">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.pseudo} className="w-full h-full object-cover" />
            ) : (
              <span className="text-electric font-bold text-sm">
                {user?.pseudo?.[0]?.toUpperCase() || "J"}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavIcon({ href, icon: Icon, label }) {
  return (
    <Link href={href} title={label} className="icon-btn w-12 h-12">
      <Icon size={20} />
    </Link>
  );
}
