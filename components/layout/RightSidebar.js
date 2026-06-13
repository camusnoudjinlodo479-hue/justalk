// components/layout/RightSidebar.js
import Link from "next/link";

export default function RightSidebar({ contacts = [] }) {
  return (
    <aside className="hidden xl:flex flex-col gap-1 w-64 shrink-0 sticky top-20 self-start">
      <h3 className="text-slate-400 font-semibold text-xs uppercase tracking-wide px-3 mb-1">
        Contacts
      </h3>
      {contacts.length === 0 && (
        <p className="px-3 text-sm text-slate-400">Aucun ami en ligne pour le moment.</p>
      )}
      {contacts.map((c) => (
        <Link
          key={c.id}
          href={`/messenger?to=${c.id}`}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white hover:shadow-embossed transition-all"
        >
          <div className="relative w-9 h-9 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric text-sm overflow-hidden">
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              c.pseudo?.[0]?.toUpperCase()
            )}
            {c.online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            )}
          </div>
          <span className="text-sm font-medium text-slate-700">{c.pseudo}</span>
        </Link>
      ))}
    </aside>
  );
}
