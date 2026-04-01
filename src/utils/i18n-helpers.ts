import type { LocalizedText } from '@/data/types'
import { i18n } from '@/i18n/I18nManager'

export function resolveText(text: LocalizedText): string {
  const lang = i18n.getLanguage()
  return text[lang]
}
