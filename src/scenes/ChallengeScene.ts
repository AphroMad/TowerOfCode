import Phaser from 'phaser'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { getChallenge } from '@/data/challenges'
import { saveManager } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import type { HpManager } from '@/systems/HpManager'
import { SCENE } from '@/utils/constants'

interface ChallengeSceneData {
  challengeConfig: ChallengeConfig
  challengeIds?: string[]
  returnScene?: string
}

export class ChallengeScene extends Phaser.Scene {
  private challenge: IChallenge | null = null
  private returnScene: string = SCENE.GAME
  private challengeIds: string[] = []
  private currentStep = 0
  private stepNav: HTMLDivElement | null = null
  private heartEls: HTMLSpanElement[] = []
  private heartContainer: HTMLDivElement | null = null
  private hpManager: HpManager | null = null

  constructor() {
    super({ key: SCENE.CHALLENGE })
  }

  create(data: ChallengeSceneData): void {
    const cam = this.cameras.main
    // Clean up DOM hearts on scene shutdown (e.g. game.destroy() from editor test mode)
    this.events.once('shutdown', () => {
      if (this.stepNav) {
        this.stepNav.remove()
        this.stepNav = null
      }
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

    this.returnScene = data.returnScene ?? SCENE.GAME
    this.challengeIds = data.challengeIds ?? []

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

    this.launchChallenge(config)
  }

  private launchChallenge(config: ChallengeConfig): void {
    this.currentStep = this.challengeIds.indexOf(config.id)
    if (this.currentStep === -1) this.currentStep = 0

    this.challenge = createChallenge(config.type, config)
    this.challenge.create(this, config, (success) => this.onChallengeComplete(success, config))

    if (this.challengeIds.length > 1) {
      this.updateStepNav()
    }
  }

  private onChallengeComplete(success: boolean, config: ChallengeConfig): void {
    if (success) {
      saveManager.completeChallenge(config.id)

      if (this.challengeIds.length > 1) {
        const save = saveManager
        const nextId = this.challengeIds.find(id => !save.isChallengeCompleted(id))
        if (nextId) {
          const nextConfig = getChallenge(nextId)
          if (nextConfig) {
            this.currentStep = this.challengeIds.indexOf(nextId)
            setTimeout(() => this.chainNextChallenge(nextConfig), 50)
            return
          }
        }
      }
    }
    this.closeScene()
  }

  private chainNextChallenge(config: ChallengeConfig): void {
    const panel = this.challenge?.getPanel() ?? null
    if (this.challenge) {
      this.challenge.softDestroy()
      this.challenge = null
    }

    this.challenge = createChallenge(config.type, config)
    if (panel) {
      this.challenge.createInPanel(this, config, (success) => this.onChallengeComplete(success, config), panel)
    } else {
      this.challenge.create(this, config, (success) => this.onChallengeComplete(success, config))
    }
    this.updateStepNav()
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
      'position:fixed;top:8px;left:12px;z-index:10002;display:flex;gap:4px;pointer-events:none;'
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

  private updateStepNav(): void {
    if (this.challengeIds.length <= 1) return

    const panel = this.challenge?.getPanel()
    if (!panel) return

    // Remove old nav if it exists inside this panel
    if (this.stepNav && this.stepNav.parentElement) {
      this.stepNav.remove()
    }

    const save = saveManager
    const total = this.challengeIds.length
    const step = this.currentStep

    this.stepNav = document.createElement('div')
    this.stepNav.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:12px;' +
      'padding:8px 0;margin-bottom:8px;border-bottom:1px solid #333;'

    const btnBase = 'padding:4px 12px;font-size:14px;min-width:32px;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-weight:bold;'
    const btnActive = btnBase + 'background:#4488cc;color:#fff;'
    const btnDisabled = btnBase + 'background:#2a2a2a;color:#444;cursor:default;'

    // Prev button
    const prevBtn = document.createElement('button')
    prevBtn.textContent = '\u2039'
    prevBtn.style.cssText = step === 0 ? btnDisabled : btnActive
    prevBtn.disabled = step === 0
    prevBtn.addEventListener('click', () => this.goToStep(step - 1))
    this.stepNav.appendChild(prevBtn)

    // Step indicator
    const label = document.createElement('span')
    label.style.cssText = 'color:#4488cc;font-family:monospace;font-size:16px;font-weight:bold;'
    label.textContent = `${step + 1} / ${total}`
    this.stepNav.appendChild(label)

    // Next button (only enabled if that challenge is already completed)
    const canGoNext = step < total - 1 && save.isChallengeCompleted(this.challengeIds[step])
    const nextBtn = document.createElement('button')
    nextBtn.textContent = '\u203A'
    nextBtn.style.cssText = canGoNext ? btnActive : btnDisabled
    nextBtn.disabled = !canGoNext
    nextBtn.addEventListener('click', () => this.goToStep(step + 1))
    this.stepNav.appendChild(nextBtn)

    // Insert at top of panel
    panel.insertBefore(this.stepNav, panel.firstChild)
  }

  private goToStep(step: number): void {
    if (step < 0 || step >= this.challengeIds.length) return
    const config = getChallenge(this.challengeIds[step])
    if (!config) return
    this.currentStep = step
    this.chainNextChallenge(config)
  }

  private closeScene(): void {
    // Clean up step nav
    this.stepNav = null
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
