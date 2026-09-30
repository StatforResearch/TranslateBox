import { BrandLogo } from './BrandLogo';
import { InterfaceLanguage } from './InterfaceLanguage';
import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Download, Bug } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export const Header = () => {
  const { t } = useLocale();
  const { theme, toggle } = useTheme();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const iconBtn =
    "inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-colors";

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-50 h-16 md:h-20 bg-slate-50/80 dark:bg-[#0A0D14]/70 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 px-4 md:px-8 flex items-center justify-between"
    >
      <BrandLogo compact />

      <div className="flex items-center gap-2 md:gap-3">
        <InterfaceLanguage />
        {deferredPrompt && !installed && (
          <button data-testid="pwa-install-button" onClick={install} className={iconBtn} title={t("Install app")}>
            <Download className="h-5 w-5" />
          </button>
        )}
        <Link data-testid="debug-nav-link" to="/debug" className={iconBtn} title={t("Debug console")}>
          <Bug className="h-5 w-5" />
        </Link>
        <button data-testid="theme-toggle-button" onClick={toggle} className={iconBtn} title={t("Toggle theme")}>
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
};
