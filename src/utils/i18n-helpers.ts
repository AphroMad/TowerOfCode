import type { LocalizedText } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'

export function resolveText(text: LocalizedText): string {
  const lang = I18nManager.getInstance().getLanguage()
  return text[lang]
}
