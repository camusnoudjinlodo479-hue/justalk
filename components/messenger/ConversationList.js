"use client";
// components/messenger/ConversationList.js
export default function ConversationList({ conversations = [], activeId, onSelect }) {
  return (
    <div className="w-full md:w-80 shrink-0 card-lg h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h2 className="font-display font-bold text-lg text-slate-800">Discussions</h2>
        <input placeholder="Rechercher" className="input-pill mt-2 bg-bg text-sm py-2" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-slate-400">Aucune conversation pour le moment.</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              activeId === c.id ? "bg-electric/5" : "hover:bg-bg"
            }`}
          >
            <div className="relative w-11 h-11 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric shrink-0 overflow-hidden">
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
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-800 truncate">{c.pseudo}</p>
              <p className="text-xs text-slate-400 truncate">{c.lastMessage || "Dis bonjour 👋"}</p>
            </div>
            {c.unread > 0 && (
              <span className="bg-electric text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {c.unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
