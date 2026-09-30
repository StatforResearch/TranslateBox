import React from 'react';
import { useLocale } from '../context/LocaleContext';

export function InterfaceLanguage() {
  const { language, setLanguage, t } = useLocale();
  return <select className="tb-interface-language" aria-label={t('Interface language')} value={language} onChange={event => setLanguage(event.target.value)}>
    <option value="en" lang="en">English</option>
    <option value="fr" lang="fr">Français</option>
  </select>;
}
