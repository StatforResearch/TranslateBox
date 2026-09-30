import React from 'react';
import { AudioLines } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

export function BrandLogo({ compact = false }) {
  const { t } = useLocale();
  return <a href="/" className={`tb-brand${compact ? ' tb-brand-compact' : ''}`} aria-label={`TranslateBox — ${t('Back to home')}`} title={compact ? t('Returning home closes this session.') : t('Back to home')}>
    <AudioLines aria-hidden="true" />
    <span>Translate<span className="tb-cyan">Box</span><small>{t('LIVE INTERPRETATION')}</small></span>
  </a>;
}
