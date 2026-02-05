import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'fr' | 'ar';

interface LanguageContextType {
    currentLang: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>, defaultValue?: string) => string;
    isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Import all translations
import { translations } from '../data/translations';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentLang, setCurrentLang] = useState<Language>(
        (localStorage.getItem('preferredLanguage') as Language) || 'en'
    );

    useEffect(() => {
        localStorage.setItem('preferredLanguage', currentLang);
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }, [currentLang]);

    const setLanguage = (lang: Language) => {
        setCurrentLang(lang);
    };

    // Helper function to access nested translation keys with both dot-notation and underscore conversion
    const getTranslation = (obj: any, keyPath: string): string | undefined => {
        // First try the key as-is (for flat keys like "nav_home")
        if (keyPath in obj) {
            return obj[keyPath];
        }

        // If not found, try dot notation (e.g., "nav.home")
        const parts = keyPath.split('.');
        let current = obj;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }

        return typeof current === 'string' ? current : undefined;
    };

    const t = (key: string, params?: Record<string, string | number>, defaultValue?: string): string => {
        // Try to get translation in current language
        const langTranslations = translations[currentLang];
        let translation = getTranslation(langTranslations, key);

        if (!translation && currentLang !== 'en') {
            // Fallback to English if translation not found
            const enTranslations = translations['en'];
            translation = getTranslation(enTranslations, key);
        }

        if (!translation) {
            // Log warning for missing translation
            console.warn(`Translation key missing for language "${currentLang}": ${key}`);

            // Fallback: Convert technical_key to "Technical Key"
            translation = defaultValue || key
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        // Handle interpolation
        if (params) {
            Object.entries(params).forEach(([paramKey, value]) => {
                translation = translation!.replace(`{${paramKey}}`, String(value));
            });
        }

        return translation;
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
