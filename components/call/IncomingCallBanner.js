"use client";
// components/call/IncomingCallBanner.js
import { Phone, PhoneOff } from "lucide-react";

export default function IncomingCallBanner({ call, onAccept, onDecline }) {
  if (!call) return null;
  return (
    <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-3">
      <div className="card-lg px-4 py-3 flex items-center gap-3 shadow-glow-lg">
        <div className="w-10 h-10 rounded-full bg-electric/10 flex items-center justify-center font-bold text-electric">
          📞
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800">Appel entrant</p>
          <p className="text-xs text-slate-400">{call.fromPseudo || "Justalk"}</p>
        </div>
        <button onClick={() => onDecline(call)} className="icon-btn bg-red-50 text-red-500">
          <PhoneOff size={18} />
        </button>
        <button onClick={() => onAccept(call)} className="icon-btn bg-emerald-50 text-emerald-500">
          <Phone size={18} />
        </button>
      </div>
    </div>
  );
}
