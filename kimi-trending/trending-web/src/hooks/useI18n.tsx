import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { translations as en } from '@/i18n/en';
import { translations as zh } from '@/i18n/zh';

export type Language = 'en' | 'zh';
export type TranslationKey = keyof typeof en;

const TRANSLATIONS: Record<Language, typeof en> = { en, zh };
const LANG_STORAGE_KEY = 'trending-aggregator-language';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      return (localStorage.getItem(LANG_STORAGE_KEY) as Language) || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => TRANSLATIONS[lang][key] || en[key] || key,
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
