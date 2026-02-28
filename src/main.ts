import Phaser from 'phaser'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { BootScene } from '@/scenes/BootScene'
import { MenuScene } from '@/scenes/MenuScene'
import { GameScene } from '@/scenes/GameScene'
import { DialogScene } from '@/scenes/DialogScene'
import { ChallengeScene } from '@/scenes/ChallengeScene'
import { I18nManager } from '@/i18n/I18nManager'
import { SaveManager } from '@/systems/SaveManager'

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
  scene: [BootScene, MenuScene, GameScene, DialogScene, ChallengeScene],
})

// Global language toggle — no scene interaction, just swap the language
function syncLangButton() {
  const btn = document.getElementById('lang-toggle')
  if (btn) btn.textContent = I18nManager.getInstance().getLanguage().toUpperCase()
}

window.addEventListener('toggle-language', () => {
  const i18n = I18nManager.getInstance()
  const save = SaveManager.getInstance()
  const newLang = i18n.getLanguage() === 'en' ? 'fr' as const : 'en' as const
  i18n.setLanguage(newLang)
  save.setLanguage(newLang)
  syncLangButton()
})

// Sync button on load
syncLangButton()
