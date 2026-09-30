import React, { useState } from 'react';
import { ArrowRight, AudioLines, Headphones, Languages, Radio, ShieldCheck } from 'lucide-react';
import { API, setOperatorToken } from '../lib/api';

export default function OperatorAccess({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/operator`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(response.status === 401 ? 'Invalid operator access code.' : 'Operator access unavailable. Check server configuration or try again shortly.');
      setOperatorToken(token); setToken(''); setReady(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (ready) return children;
  return <main className="tb-welcome">
    <nav className="tb-nav" aria-label="Navigation principale">
      <a className="tb-brand" href="/"><AudioLines aria-hidden="true" /><span>Translate<span className="tb-cyan">Box</span><small>LIVE INTERPRETATION</small></span></a>
      <a className="tb-nav-link" href="#fonctionnement">Comment ça marche</a>
      <a className="tb-nav-cta" href="#connexion">Espace opérateur <ArrowRight size={16} /></a>
    </nav>
    <section className="tb-hero">
      <div className="tb-intro">
        <span className="tb-pill"><span /> La traduction qui rassemble</span>
        <h1>Une voix.<br /><em>Plus de langues.</em><br />Un même moment.</h1>
        <p>Conférences, enseignements, rencontres : partagez votre message et permettez à chacun de le suivre dans sa langue, depuis son téléphone.</p>
        <a className="tb-primary" href="#connexion">Préparer une session <ArrowRight size={18} /></a>
        <div className="tb-benefits"><span><Headphones size={17} /> Audio traduit</span><span><Languages size={17} /> Sous-titres en direct</span></div>
      </div>
      <div className="tb-access-wrap">
        <div className="tb-preview" aria-label="Illustration du parcours de traduction">
          <div className="tb-preview-top"><span className="tb-dots">● ● ●</span><span>Votre message voyage</span><AudioLines size={18} /></div>
          <div className="tb-language-path"><span>EN <small>La voix source</small></span><ArrowRight /><span>FR <small>La traduction</small></span></div>
          <div className="tb-wave" aria-hidden="true">{Array.from({length: 32}, (_, i) => <i key={i} style={{height: `${12 + ((i * 17) % 43)}px`}} />)}</div>
          <p><Headphones size={16} /> Sur le téléphone de chaque auditeur</p>
        </div>
        <form id="connexion" onSubmit={login} className="tb-login">
          <span className="tb-eyebrow">VOTRE ESPACE DE DIFFUSION</span>
          <h2>Prêt à vous faire comprendre ?</h2>
          <p>Connectez-vous pour préparer et piloter votre session.</p>
          <label htmlFor="operator-token">Code d’accès opérateur</label>
          <input id="operator-token" type="password" autoComplete="current-password" required value={token} onChange={e => setToken(e.target.value)} placeholder="Votre code confidentiel" />
          <button disabled={busy} className="tb-primary">{busy ? 'Connexion…' : 'Ouvrir ma console'}<ArrowRight size={18} /></button>
          {error && <p role="alert" className="tb-login-error">{error}</p>}
          <small><ShieldCheck size={15} /> Auditeur ? Utilisez le lien ou le QR code de votre événement.</small>
        </form>
      </div>
    </section>
    <section id="fonctionnement" className="tb-how">
      <span className="tb-eyebrow">SIMPLE, DU MICRO AU CASQUE</span>
      <h2>Votre événement, dans leur langue.</h2>
      <div className="tb-step-grid">
        {[[Radio, '01', 'Préparez votre direct', 'Choisissez la source audio et la langue de traduction dans votre console.'], [Languages, '02', 'Partagez votre événement', 'Créez une session et transmettez son lien ou son QR code aux participants.'], [Headphones, '03', 'Écoutez, tout simplement', 'Les auditeurs ouvrent le lien sur leur téléphone et lancent l’écoute au casque.']].map(([Icon, number, title, description]) => <article key={number}><div><Icon size={24} /><span>{number}</span></div><h3>{title}</h3><p>{description}</p></article>)}
      </div>
    </section>
    <footer className="tb-footer"><strong>TranslateBox</strong><span>Des voix différentes. Une expérience partagée.</span></footer>
  </main>;
}
