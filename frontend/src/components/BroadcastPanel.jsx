import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Radio, Users, QrCode as QrIcon, Play, Square, X } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";

export const BroadcastPanel = () => {
  const { t } = useLocale();
  const {
    eventInfo, createEvent, startEvent, stopEvent, restartBroadcast,
    savedEvents, catalogError, catalogLoading, refreshEvents, resumeEvent, newEvent,
    listeners, broadcasting, active, captionsToListeners, setCaptionsToListeners, status,
  } = useTranslationSession();

  const [name, setName] = useState(t("Live Interpretation"));
  const [org, setOrg] = useState("");
  const [pin, setPin] = useState("");
  const [qr, setQr] = useState("");
  const [fs, setFs] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const listenUrl = eventInfo ? `${window.location.origin}/e/${eventInfo.id}` : "";

  useEffect(() => {
    if (listenUrl) QRCode.toDataURL(listenUrl, { width: 320, margin: 1 }).then(setQr).catch(() => {});
  }, [listenUrl]);

  const doCreate = async () => { setBusy(true); setError(""); try { await createEvent({ name, organization: org, pin }); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const doStart = async () => { setBusy(true); setError(""); try { await startEvent({ name, organization: org, pin }); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  return (
    <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg p-4 md:p-5 space-y-4" data-testid="broadcast-panel">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-slate-700 dark:text-slate-200 font-mono"><Radio className="h-4 w-4 text-emerald-500" />{t("Broadcast · Multi-listener")}</h2>
        <span className="flex items-center gap-1.5 text-sm font-mono font-bold" data-testid="listeners-count"><Users className="h-4 w-4 text-cyan-500" /> {listeners} / {eventInfo?.max_listeners || 30}</span>
      </div>

      {error && <p role="alert" className="text-rose-500">{error}</p>}
      {!eventInfo && (
        <div className="space-y-2 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t("Saved events · Événements enregistrés")}</h3>
            <button onClick={refreshEvents} disabled={catalogLoading || busy} className="text-sm underline disabled:opacity-50">{catalogLoading ? t("Loading…") : t("Refresh")}</button>
          </div>
          <p className="text-sm text-slate-500">{t("Resume an event to keep its link and QR code after a restart. Inactive events expire 24 hours after creation by default.")}</p>
          {catalogError && <p role="alert" className="text-rose-500">{catalogError}</p>}
          {!catalogLoading && !catalogError && savedEvents.length === 0 && <p className="text-sm text-slate-500">{t("No saved event yet. Create one below.")}</p>}
          <ul className="max-h-48 overflow-auto space-y-2">
            {savedEvents.map(event => <li key={event.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{event.name} · {event.target.toUpperCase()}</span>
              <button disabled={busy || active || event.live} onClick={async () => {setBusy(true); setError(""); try {await resumeEvent(event.id);} catch(e) {setError(e.message);} finally {setBusy(false);}}} className="shrink-0 px-3 py-2 rounded-lg border border-emerald-500 disabled:opacity-40">{event.live ? t("Live") : t("Resume")}</button>
            </li>)}
          </ul>
        </div>
      )}
      {!eventInfo && <p id="share" className="scroll-mt-24 text-sm text-slate-500">{t("Create an event to get its listener link and QR code.")}</p>}
      {!eventInfo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input aria-label={t("Event name")} maxLength={200} data-testid="event-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Event name")} className="h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm dark:text-slate-100" />
          <input aria-label={t("Organization")} maxLength={200} data-testid="event-org-input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder={t("Organization")} className="h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm dark:text-slate-100" />
          <input aria-label={t("Listener PIN")} type="password" maxLength={64} data-testid="event-pin-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("PIN (optional)")} className="h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm dark:text-slate-100" />
          <button data-testid="create-event-button" onClick={doCreate} disabled={busy} className="sm:col-span-3 h-11 rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/10 disabled:opacity-50">{t("CREATE EVENT")}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-center">
          {qr && <img data-testid="event-qr" src={qr} alt="QR" className="h-28 w-28 rounded-lg bg-white p-1.5" />}
          <div className="min-w-0 space-y-2 scroll-mt-24" id="share">
            <h3 className="font-bold">3 · {t("Share and go live")}</h3>
            <p className="font-semibold">{eventInfo.name} · {eventInfo.target.toUpperCase()}</p>
            <button onClick={newEvent} disabled={busy || active || broadcasting} className="text-sm underline disabled:opacity-40">{t("Choose another event / New event")}</button>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{t("Scan to listen")}</p>
            <a data-testid="event-listen-url" href={listenUrl} target="_blank" rel="noreferrer" className="block text-sm font-mono text-emerald-600 dark:text-emerald-400 truncate">{listenUrl}</a>
            {['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <p className="text-sm text-amber-600 dark:text-amber-400">{t("Local link: this QR code only works on this computer. Use an accessible HTTPS address for phones and other listeners.")}</p>}
            <button className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={async () => {
              try { await navigator.clipboard.writeText(listenUrl); setCopyStatus("Link copied"); }
              catch { setCopyStatus("Copy the event link above manually."); }
            }}>{t("Copy listener link")}</button>
            <p role="status" className="text-sm text-slate-500">{t(copyStatus)}</p>
            <p className="text-sm text-slate-500">{t("Share only this link and the event PIN with listeners. Keep your operator code private.")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {!broadcasting ? (
                <button data-testid="start-event-button" onClick={doStart} disabled={busy} className="flex items-center gap-2 px-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50"><Play className="h-5 w-5 fill-white" />{t("START EVENT")}</button>
              ) : (
                <button data-testid="stop-event-button" onClick={stopEvent} className="flex items-center gap-2 px-5 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"><Square className="h-5 w-5 fill-white" />{t("STOP EVENT")}</button>
              )}
              <button data-testid="restart-broadcast-button" onClick={() => restartBroadcast().catch(e => setError(e.message))} disabled={!broadcasting} className="px-4 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 text-sm font-semibold">{t("RESTART BROADCAST")}</button>
              <button data-testid="qr-fullscreen-button" onClick={() => setFs(true)} className="px-4 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-semibold flex items-center gap-2"><QrIcon className="h-4 w-4" /> QR</button>
            </div>
            <label className="flex items-center gap-2 pt-1 cursor-pointer" data-testid="listener-captions-toggle">
              <input type="checkbox" checked={captionsToListeners} onChange={(e) => setCaptionsToListeners(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              <span className="text-sm text-slate-600 dark:text-slate-300">{t("Show translated captions to listeners (default OFF)")}</span>
            </label>
            <div className="flex gap-4 text-[11px] font-mono uppercase tracking-wider text-slate-400 pt-1">
              <span>{t("Broadcast:")}<b className={broadcasting ? "text-emerald-500" : "text-slate-400"}>{broadcasting ? t("LIVE") : t("OFFLINE")}</b></span>
              <span>{t("Translation:")}<b className={active ? "text-emerald-500" : "text-slate-400"}>{active ? t("LIVE") : t("OFFLINE")}</b></span>
              <span>OpenAI: <b className={status.openai === "connected" ? "text-emerald-500" : "text-slate-400"}>{status.openai === "connected" ? t("CONNECTED") : "—"}</b></span>
            </div>
          </div>
        </div>
      )}

      {fs && qr && (
        <div className="fixed inset-0 z-[70] bg-[#0A0D14] flex flex-col items-center justify-center p-6" data-testid="qr-fullscreen">
          <button onClick={() => setFs(false)} className="absolute top-6 right-6 text-slate-300"><X className="h-7 w-7" /></button>
          <p className="text-emerald-400 font-mono uppercase tracking-[0.35em] mb-8">{t("Scan to listen")}</p>
          <img src={qr} alt="QR" className="h-72 w-72 bg-white p-3 rounded-2xl" />
          <p className="mt-6 font-mono text-slate-300">{listenUrl}</p>
        </div>
      )}
    </section>
  );
};
