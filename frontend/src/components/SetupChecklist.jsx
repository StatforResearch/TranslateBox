import React, { useEffect, useState } from 'react';
import { API } from '../lib/api';
import { useTranslationSession } from '../context/TranslationContext';

export function SetupChecklist() {
  const { targetLang, testing, active, testInput, stopTest, level, selectedDevice } = useTranslationSession();
  const [service, setService] = useState('checking');
  const [headphones, setHeadphones] = useState(false);
  const [signal, setSignal] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/health`, {signal: controller.signal})
      .then(async r => {if (!r.ok) throw new Error(); return r.json();})
      .then(d => setService(d.openai_key_configured ? 'configured' : 'missing'))
      .catch(e => {if (e.name !== 'AbortError') setService('unavailable');});
    return () => controller.abort();
  }, []);
  useEffect(() => { if (testing && level.peak > 0.02) setSignal(true); }, [testing, level.peak]);
  useEffect(() => { setSignal(false); }, [selectedDevice]);
  const capture = !!navigator.mediaDevices?.getUserMedia;
  return <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-4" open={!active ? true : undefined}>
    <summary className="font-semibold cursor-pointer">Before you start · Préparer la session</summary>
    <ol className="mt-3 space-y-2 text-sm list-decimal pl-5">
      <li>{capture ? 'Microphone supported.' : 'Microphone unavailable: use HTTPS or localhost with a compatible browser.'} <button disabled={active || !capture} onClick={() => {if (testing) stopTest(); else {setSignal(false); testInput();}}} className="underline disabled:opacity-40">{testing ? 'Stop test' : 'Test microphone'}</button> {signal ? 'Signal detected — verify the correct microphone.' : 'Speak during Test and check the input meter.'}</li>
      <li><label><input type="checkbox" checked={headphones} onChange={e => setHeadphones(e.target.checked)} className="mr-2"/>I connected headphones to avoid echo.</label></li>
      <li>Target language: <b>{targetLang.toUpperCase()}</b>. Select it in Translate to before starting.</li>
      <li>{service === 'checking' ? 'Checking server…' : service === 'configured' ? 'Server reachable; a key is configured. Credit and key validity are not checked here.' : service === 'missing' ? 'Server key missing. Ask the administrator to configure OPENAI_API_KEY.' : 'Server unavailable. Check Docker and your connection.'}</li>
    </ol>
    <p className="mt-3 text-sm text-slate-500">Test only checks local input. START begins a translation session; STOP ends it. Muting does not end the session.</p>
  </details>;
}
