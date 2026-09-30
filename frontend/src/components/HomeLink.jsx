import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

export function HomeLink() {
  const { t } = useLocale();
  // A full navigation also resets the in-memory operator login at the root route.
  return <a href="/" className="tb-home-link" title={t('Returning home closes this session.')}>
    <ArrowLeft size={16} aria-hidden="true" />{t('Back to home')}
  </a>;
}
