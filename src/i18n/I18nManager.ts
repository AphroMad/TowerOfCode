import type { DialogLine } from '@/systems/DialogSystem'
import enUi from '@/i18n/locales/en/ui.json'
import enFloors from '@/i18n/locales/en/floors.json'
import enDialogs from '@/i18n/locales/en/dialogs.json'
import frUi from '@/i18n/locales/fr/ui.json'
import frFloors from '@/i18n/locales/fr/floors.json'
import frDialogs from '@/i18n/locales/fr/dialogs.json'

type Language = 'en' | 'fr'
type LocaleData = Record<string, string | string[]>

const locales: Record<Language, LocaleData> = {
  en: { ...enUi, ...enFloors, ...enDialogs },
  fr: { ...frUi, ...frFloors, ...frDialogs },
}

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

  /** Returns all locale keys whose values are arrays (i.e. dialog keys). */
  getDialogKeys(): string[] {
    const data = locales[this.language]
    return Object.keys(data).filter(k => Array.isArray(data[k]))
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
