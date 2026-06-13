// components/layout/LeftSidebar.js
import Link from "next/link";
import { User, Users, MessageCircle, Bookmark, Film, Bell, Image as ImageIcon } from "lucide-react";

const LINKS = [
  { href: "/profil", label: "Mon profil", icon: User },
  { href: "/groupes", label: "Groupes", icon: Users },
  { href: "/messenger", label: "Messenger", icon: MessageCircle },
  { href: "/stories", label: "Stories", icon: Film },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profil#photos", label: "Photos", icon: ImageIcon },
  { href: "/profil#saved", label: "Enregistrés", icon: Bookmark },
];

export default function LeftSidebar({ user }) {
  return (
    <aside className="hidden lg:flex flex-col gap-1 w-64 shrink-0 sticky top-20 self-start">
      <Link href="/profil" className="card p-3 flex items-center gap-3 hover:shadow-glow transition-shadow">
        <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric overflow-hidden">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            user?.pseudo?.[0]?.toUpperCase() || "J"
          )}
        </div>
        <span className="font-semibold text-sm text-slate-700">{user?.pseudo || "@toi"}</span>
      </Link>

      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 font-medium text-sm hover:bg-white hover:shadow-embossed hover:text-electric transition-all"
        >
          <Icon size={20} /> {label}
        </Link>
      ))}
    </aside>
  );
}
