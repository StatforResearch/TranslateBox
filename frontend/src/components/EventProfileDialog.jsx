import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Settings2 } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";

const Field = ({ label, hint, value, onChange, textarea, disabled, testId }) => (
  <div>
    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{label}</label>
    {hint && <p className="text-[10px] text-slate-400 dark:text-slate-600 mb-1">{hint}</p>}
    {textarea ? (
      <textarea
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 font-mono"
      />
    ) : (
      <input
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
      />
    )}
  </div>
);

export const EventProfileDialog = () => {
  const { profile, setProfile, active } = useTranslationSession();
  const set = (k) => (v) => setProfile((p) => ({ ...p, [k]: v }));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="event-profile-button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings2 className="h-4 w-4" /> Event Profile
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-wide uppercase">Event Profile</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          This information is compiled into the translation session instructions (one vocabulary item per line).
          The current model applies them on a best-effort basis; they are always included in transcript exports.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <Field label="Event Name" value={profile.eventName} onChange={set("eventName")} disabled={active} testId="profile-event-name" />
          <Field label="Organization" value={profile.organization} onChange={set("organization")} disabled={active} testId="profile-organization" />
        </div>
        <Field label="Speaker Names" hint="One per line" textarea value={profile.speakers} onChange={set("speakers")} disabled={active} testId="profile-speakers" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Names / Proper Nouns" hint="One per line" textarea value={profile.vocabNames} onChange={set("vocabNames")} disabled={active} testId="profile-vocab-names" />
          <Field label="Acronyms" hint="One per line" textarea value={profile.vocabAcronyms} onChange={set("vocabAcronyms")} disabled={active} testId="profile-vocab-acronyms" />
          <Field label="Technical Terms" hint="One per line" textarea value={profile.vocabTechnical} onChange={set("vocabTechnical")} disabled={active} testId="profile-vocab-technical" />
          <Field label="Biblical Terms" hint="One per line" textarea value={profile.vocabBiblical} onChange={set("vocabBiblical")} disabled={active} testId="profile-vocab-biblical" />
        </div>
        <Field label="Places" hint="One per line" textarea value={profile.vocabPlaces} onChange={set("vocabPlaces")} disabled={active} testId="profile-vocab-places" />
        <Field label="Additional Translation Instructions" textarea value={profile.additional} onChange={set("additional")} disabled={active} testId="profile-additional" />
        <DialogFooter>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">Saved automatically on this device. Locked while a session is active.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
