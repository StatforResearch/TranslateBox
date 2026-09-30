import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '../context/LocaleContext';

export function HeadphoneTest() {
  const { t } = useLocale();
  const context = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => { const current = context.current; context.current = null; current?.close().catch(() => {}); }, []);
  const test = async () => {
    if (context.current) return;
    setBusy(true); setMessage('');
    let audio;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      audio = new Audio(); context.current = audio;
      await audio.resume();
      if (context.current !== audio) return;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 440;
      gain.gain.setValueAtTime(0, audio.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audio.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, audio.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.6);
      tone.connect(gain); gain.connect(audio.destination);
      tone.onended = () => {
        audio.close().catch(() => {});
        if (context.current !== audio) return;
        context.current = null; setBusy(false);
        setMessage('Did you hear the beep? If not, check your media volume and headphone connection.');
      };
      tone.start(); tone.stop(audio.currentTime + 0.65);
    } catch {
      audio?.close().catch(() => {}); context.current = null; setBusy(false);
      setMessage('Sound test unavailable. Check your browser and audio output.');
    }
  };
  return <div className="mb-5 text-sm">
    <button disabled={busy} onClick={test} className="rounded-lg border border-white/30 px-4 py-3 disabled:opacity-50">{t(busy ? 'Playing test sound…' : 'Test my headphones')}</button>
    <p className="mt-2 text-slate-400">{t('Short local beep. No microphone or translation credit used.')}</p>
    <p role="status" className="mt-2 text-slate-300">{t(message)}</p>
  </div>;
}
