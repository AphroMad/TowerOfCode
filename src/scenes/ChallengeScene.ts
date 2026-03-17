import Phaser from 'phaser'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'
import { I18nManager } from '@/i18n/I18nManager'
import type { HpManager } from '@/systems/HpManager'

interface ChallengeSceneData {
  challengeConfig: ChallengeConfig
  returnScene?: string
}

export class ChallengeScene extends Phaser.Scene {
  private challenge: IChallenge | null = null
  private returnScene = 'GameScene'
  private heartEls: HTMLSpanElement[] = []
  private heartContainer: HTMLDivElement | null = null
  private hpManager: HpManager | null = null

  constructor() {
    super({ key: 'ChallengeScene' })
  }

  create(data: ChallengeSceneData): void {
    const cam = this.cameras.main
    const i18n = I18nManager.getInstance()

    // Clean up DOM hearts on scene shutdown (e.g. game.destroy() from editor test mode)
    this.events.on('shutdown', () => {
      if (this.heartContainer) {
        this.heartContainer.remove()
        this.heartContainer = null
      }
      this.heartEls = []
      this.events.off('challenge-wrong-answer')
      if (this.challenge) {
        this.challenge.destroy()
        this.challenge = null
      }
    })

    // Background
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122)
      .setDepth(10)

    // Title
    this.add.text(cam.centerX, 20, i18n.t('challenge_title'), {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11)

    this.returnScene = data.returnScene ?? 'GameScene'

    // Get HpManager from GameScene
    const gameScene = this.scene.get(this.returnScene) as { hpManager?: HpManager } | null
    this.hpManager = gameScene?.hpManager ?? null
    this.createHeartDisplay()

    const config = data.challengeConfig
    if (!config) {
      this.closeScene()
      return
    }

    // Listen for wrong answers from challenges
    this.events.on('challenge-wrong-answer', () => {
      this.applyDamage()
    })

    // Create challenge
    this.challenge = createChallenge(config.type)
    this.challenge.create(this, config, (success) => {
      if (success) {
        SaveManager.getInstance().completeChallenge(config.id)
      }
      this.closeScene()
    })
  }

  update(): void {
    if (this.challenge) {
      this.challenge.update()
    }
  }

  private createHeartDisplay(): void {
    if (!this.hpManager || this.hpManager.isInfinite) return

    this.heartContainer = document.createElement('div')
    this.heartContainer.style.cssText =
      'position:fixed;top:8px;right:12px;z-index:10002;display:flex;gap:4px;pointer-events:none;'
    document.body.appendChild(this.heartContainer)

    this.heartEls = []
    for (let i = 0; i < this.hpManager.maxHp; i++) {
      const span = document.createElement('span')
      span.style.cssText = 'font-size:22px;font-family:monospace;transition:color 0.2s;'
      this.heartContainer.appendChild(span)
      this.heartEls.push(span)
    }
    this.updateHeartDisplay()
  }

  private updateHeartDisplay(): void {
    if (!this.hpManager) return
    for (let i = 0; i < this.heartEls.length; i++) {
      const filled = i < this.hpManager.hp
      this.heartEls[i].textContent = filled ? '\u2665' : '\u2661'
      this.heartEls[i].style.color = filled ? '#ff3344' : '#553333'
    }
  }

  private shakeHearts(): void {
    if (!this.heartContainer) return
    this.heartContainer.style.animation = 'none'
    // Force reflow
    void this.heartContainer.offsetWidth
    this.heartContainer.style.animation = 'challenge-heart-shake 0.3s ease'
  }

  private applyDamage(): void {
    if (!this.hpManager) return
    if (this.hpManager.takeDamage()) {
      this.updateHeartDisplay()
      this.shakeHearts()
      this.hitPanel()

      if (this.hpManager.isDead) {
        // Close challenge and let GameScene handle death
        this.time.delayedCall(600, () => this.closeScene())
      }
    }
  }

  /** Red flash + shake on the challenge panel */
  private hitPanel(): void {
    const panel = document.querySelector('.cl-panel') as HTMLElement | null
    if (!panel) return
    panel.classList.remove('hit')
    // Force reflow to restart animation
    void panel.offsetWidth
    panel.classList.add('hit')
    panel.addEventListener('animationend', () => panel.classList.remove('hit'), { once: true })
  }

  private closeScene(): void {
    // Clean up DOM hearts
    if (this.heartContainer) {
      this.heartContainer.remove()
      this.heartContainer = null
    }
    this.heartEls = []
    this.events.off('challenge-wrong-answer')

    if (this.challenge) {
      this.challenge.destroy()
      this.challenge = null
    }

    // Notify GameScene to sync its HUD with current HP
    const returnScene = this.scene.get(this.returnScene)
    if (returnScene) {
      returnScene.events.emit('challenge-closed')
    }

    this.scene.stop()
    this.scene.resume(this.returnScene)
  }
}
