import Phaser from 'phaser'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { BootScene } from '@/scenes/BootScene'
import { MenuScene } from '@/scenes/MenuScene'
import { GameScene } from '@/scenes/GameScene'
import { DialogScene } from '@/scenes/DialogScene'
import { ChallengeScene } from '@/scenes/ChallengeScene'
import { TransitionScene } from '@/scenes/TransitionScene'
import { i18n } from '@/i18n/I18nManager'
import { saveManager } from '@/systems/SaveManager'

new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: '#1a1a2e',
  parent: 'app',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    keyboard: {
      target: window,
    },
  },
  scene: [BootScene, MenuScene, GameScene, DialogScene, ChallengeScene, TransitionScene],
})

// Global language toggle — no scene interaction, just swap the language
const FLAGS: Record<string, string> = { en: '\u{1F1EC}\u{1F1E7}', fr: '\u{1F1EB}\u{1F1F7}' }

function syncLangButton() {
  const btn = document.getElementById('lang-toggle')
  if (btn) btn.textContent = FLAGS[i18n.getLanguage()] ?? '\u{1F1EC}\u{1F1E7}'
}

window.addEventListener('toggle-language', () => {
  const save = saveManager
  const newLang = i18n.getLanguage() === 'en' ? 'fr' as const : 'en' as const
  i18n.setLanguage(newLang)
  save.setLanguage(newLang)
  syncLangButton()
})

// Sync button on load
syncLangButton()
