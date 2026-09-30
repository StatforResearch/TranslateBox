import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { messages } from '../lib/messages';

const translate = (language, text) => messages[text]?.[language] ?? text;
const LocaleContext = createContext({ language: 'en', setLanguage: () => {}, t: text => translate('en', text) });
export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('tbl-ui-language') === 'fr' ? 'fr' : 'en'; }
    catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('tbl-ui-language', language); } catch { /* Storage can be disabled. */ }
  }, [language]);
  const t = useCallback(text => translate(language, text), [language]);
  return <LocaleContext.Provider value={{ language, setLanguage, t }}>{children}</LocaleContext.Provider>;
}
