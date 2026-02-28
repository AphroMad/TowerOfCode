import type { DialogLine } from '@/systems/DialogSystem'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'

type Language = 'en' | 'fr'
type LocaleData = Record<string, string | string[]>

const locales: Record<Language, LocaleData> = { en, fr }

export class I18nManager {
  private static instance: I18nManager
  private language: Language = 'en'

  static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager()
    }
    return I18nManager.instance
  }

  setLanguage(lang: Language): void {
    this.language = lang
  }

  getLanguage(): Language {
    return this.language
  }

  t(key: string): string {
    const val = locales[this.language][key]
    if (typeof val === 'string') return val
    if (Array.isArray(val)) return val.join('\n')
    return `[${key}]`
  }

  getDialog(key: string, speaker?: string): DialogLine[] {
    const val = locales[this.language][key]
    if (Array.isArray(val)) {
      return val.map(text => ({ speaker, text }))
    }
    if (typeof val === 'string') {
      return [{ speaker, text: val }]
    }
    return [{ speaker, text: `[${key}]` }]
  }
}
