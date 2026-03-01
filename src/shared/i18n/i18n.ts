import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

/** Lee el idioma guardado en Settings. Devuelve 'es' o 'en'. */
function getInitialLanguage(): string {
  try {
    const raw = localStorage.getItem('jobtaylor-settings')
    if (raw) {
      const settings = JSON.parse(raw) as { outputLanguage?: string }
      if (settings.outputLanguage === 'EN') return 'en'
    }
  } catch {
    // ignore parse errors
  }
  return 'es' // español por defecto
}

i18n
  .use(initReactI18next)
  .init({
    lng: getInitialLanguage(),
    fallbackLng: 'es',
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    interpolation: {
      // React already escapes values
      escapeValue: false,
    },
  })

export default i18n
