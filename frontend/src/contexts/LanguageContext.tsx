import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type Language = 'en' | 'fr' | 'ar';

interface LanguageContextType {
    currentLang: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>, defaultValue?: string) => string;
    isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t: i18nT, i18n } = useTranslation();
    const currentLang = i18n.language as Language;

    useEffect(() => {
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }, [currentLang]);

    const setLanguage = (lang: Language) => {
        i18n.changeLanguage(lang);
    };

    const t = (key: string, params?: Record<string, string | number>, defaultValue?: string): string => {
        // i18next handles interpolation and fallbacks automatically
        // We pass defaultValue as a fallback if the key is missing
        const result = i18nT(key, { ...params, defaultValue });
        return result;
    };

    const isRtl = currentLang === 'ar';

    return (
        <LanguageContext.Provider value={{ currentLang, setLanguage, t, isRtl }}>
            <div dir={isRtl ? 'rtl' : 'ltr'}>
                {children}
            </div>
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
