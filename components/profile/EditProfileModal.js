"use client";
// components/profile/EditProfileModal.js
// Modale de modification du profil, façon WhatsApp : photo, cover, nom,
// prénom, pseudo, bio, et visibilité de la date de naissance.
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Camera, Check, Eye, EyeOff } from "lucide-react";

export default function EditProfileModal({ user, open, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [pseudo, setPseudo] = useState(user?.pseudo || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [birthdateVisibility, setBirthdateVisibility] = useState(
    user?.birthdateVisibility || "private"
  );
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);
  const [coverPreview, setCoverPreview] = useState(user?.coverUrl || null);
  const [saving, setSaving] = useState(false);

  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  if (!open) return null;

  function handlePreview(e, setter) {
    const file = e.target.files?.[0];
    if (file) setter(URL.createObjectURL(file));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("firstName", firstName.trim());
      fd.append("lastName", lastName.trim());
      fd.append("pseudo", pseudo.trim());
      fd.append("bio", bio.trim());
      fd.append("birthdateVisibility", birthdateVisibility);
      if (avatarRef.current?.files?.[0]) fd.append("avatar", avatarRef.current.files[0]);
      if (coverRef.current?.files?.[0]) fd.append("cover", coverRef.current.files[0]);

      const res = await fetch("/api/profile/update", { method: "POST", body: fd });
      const data = await res.json();
      onSaved?.(data);
      onClose();
    } catch (err) {
      console.error("Erreur mise à jour profil:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="card-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-3xl"
      >
        {/* Cover */}
        <div className="relative h-32 overflow-hidden rounded-t-3xl bg-gradient-to-br from-electric to-electric-light">
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="" className="w-full h-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="absolute bottom-2 right-2 icon-btn bg-white/90"
          >
            <Camera size={16} />
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePreview(e, setCoverPreview)} />

          <button type="button" onClick={onClose} className="absolute top-2 right-2 icon-btn bg-white/90">
            <X size={16} />
          </button>

          {/* Avatar overlapping */}
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            className="absolute -bottom-10 left-5 w-20 h-20 rounded-full border-4 border-white bg-electric/10 shadow-embossed-lg overflow-hidden flex items-center justify-center font-bold text-2xl text-electric group"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              pseudo?.[0]?.toUpperCase() || "J"
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePreview(e, setAvatarPreview)} />
        </div>

        <div className="pt-14 px-5 pb-5 flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold text-slate-800">Modifier le profil</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 ml-1">Prénom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-pill mt-1" maxLength={40} />
            </div>
            <div>
              <label className="text-xs text-slate-400 ml-1">Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-pill mt-1" maxLength={40} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 ml-1">Pseudo</label>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value.replace(/\s/g, ""))} className="input-pill mt-1" maxLength={24} />
          </div>

          <div>
            <label className="text-xs text-slate-400 ml-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              maxLength={150}
              placeholder="Quelques mots sur toi…"
              className="input-pill mt-1 resize-none"
            />
          </div>

          {/* Visibilité date de naissance */}
          <div className="flex items-center justify-between card p-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Date de naissance</p>
              <p className="text-xs text-slate-400">
                {user?.birthdate ? new Date(user.birthdate).toLocaleDateString("fr-FR") : "Non renseignée"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBirthdateVisibility((v) => (v === "public" ? "private" : "public"))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                birthdateVisibility === "public" ? "bg-electric/10 text-electric" : "bg-slate-100 text-slate-500"
              }`}
            >
              {birthdateVisibility === "public" ? <Eye size={14} /> : <EyeOff size={14} />}
              {birthdateVisibility === "public" ? "Visible" : "Privée"}
            </button>
          </div>

          <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 mt-2">
            <Check size={18} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
