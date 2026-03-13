import Phaser from 'phaser'
import { getAllChallenges } from '@/data/challenges'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'
import { I18nManager } from '@/i18n/I18nManager'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'

// ── Populate exercise table ──

const challenges = getAllChallenges()
const tbody = document.getElementById('exercise-table')!
const lang = I18nManager.getInstance().getLanguage()

challenges.forEach((config, index) => {
  const tr = document.createElement('tr')

  const typeLabel = config.type
  const name = getExerciseName(config, lang)

  tr.innerHTML = `
    <td class="id-cell">${escapeHtml(config.id)}</td>
    <td class="type-cell">${typeLabel}</td>
    <td class="title-cell">${escapeHtml(name)}</td>
  `
  tr.addEventListener('click', () => openChallenge(index))
  tbody.appendChild(tr)
})

function getExerciseName(config: ChallengeConfig, lang: 'en' | 'fr'): string {
  return config.title[lang]
}

function escapeHtml(s: string): string {
  const el = document.createElement('span')
  el.textContent = s
  return el.innerHTML
}

// ── Challenge launcher ──

let game: Phaser.Game | null = null

const listView = document.getElementById('list-view')!
const challengeView = document.getElementById('challenge-view')!
const backBtn = document.getElementById('challenge-back')! as HTMLButtonElement

function openChallenge(index: number) {
  const config = challenges[index]
  if (!config) return

  listView.style.display = 'none'
  challengeView.style.display = 'block'
  backBtn.style.display = 'block'

  let activeChallenge: IChallenge | null = null

  // Minimal Phaser game with just the challenge
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#111122',
    parent: 'challenge-view',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      keyboard: { target: window },
    },
    scene: {
      key: 'ExerciseChallenge',
      create: function (this: Phaser.Scene) {
        const scene = this
        const cam = scene.cameras.main
        const i18n = I18nManager.getInstance()

        // Background
        scene.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122)
          .setDepth(10)

        // Title
        scene.add.text(cam.centerX, 20, i18n.t('challenge_title'), {
          fontSize: '18px',
          color: '#ffdd44',
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(11)

        // Create challenge
        activeChallenge = createChallenge(config.type)
        activeChallenge.create(scene, config, (success) => {
          if (success) {
            SaveManager.getInstance().completeChallenge(config.id)
          }
          closeChallenge()
        })
      },
      update: function () {
        if (activeChallenge) activeChallenge.update()
      },
    },
  })
}

function closeChallenge() {
  if (game) {
    game.destroy(true)
    game = null
  }
  challengeView.style.display = 'none'
  backBtn.style.display = 'none'
  listView.style.display = 'block'
}

backBtn.addEventListener('click', closeChallenge)

// ESC on the page level (when no Phaser game is running) goes back to list
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !game) {
    window.location.href = '/'
  }
})
