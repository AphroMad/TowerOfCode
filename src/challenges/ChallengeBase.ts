import type { ChallengeConfig } from '@/data/types'
import type { IChallenge } from '@/challenges/IChallenge'
import { ClDomRenderer } from '@/challenges/cl-utils/ClDomRenderer'
import { I18nManager } from '@/i18n/I18nManager'

export abstract class ChallengeBase<C extends ChallengeConfig = ChallengeConfig>
  implements IChallenge
{
  protected readonly renderer = new ClDomRenderer()
  protected onComplete!: (success: boolean) => void
  protected scene!: Phaser.Scene
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private pendingTimers: ReturnType<typeof setTimeout>[] = []
  private attempts = 0
  private attemptEl: HTMLSpanElement | null = null

  create(
    _scene: Phaser.Scene,
    config: ChallengeConfig,
    onComplete: (success: boolean) => void,
  ): void {
    this.onComplete = onComplete
    this.scene = _scene
    this.attempts = 0
    const panel = this.renderer.createOverlay(_scene)

    // Attempt counter (hidden until first wrong attempt)
    this.attemptEl = document.createElement('span')
    this.attemptEl.className = 'cl-attempt-counter'
    this.attemptEl.style.display = 'none'
    panel.appendChild(this.attemptEl)

    this.onCreate(_scene, config as C, panel)
  }

  update(): void {}

  destroy(): void {
    this.clearTimers()
    this.unbindKeys()
    this.onDestroy()
    this.renderer.destroyOverlay()
  }

  protected abstract onCreate(
    scene: Phaser.Scene,
    config: C,
    panel: HTMLDivElement,
  ): void

  protected onDestroy(): void {}

  /** Shorthand for I18nManager.t() */
  protected t(key: string): string {
    return I18nManager.getInstance().t(key)
  }

  /** Increment and display the attempt counter */
  protected addAttempt(): void {
    this.attempts++
    if (this.attemptEl) {
      this.attemptEl.style.display = ''
      this.attemptEl.textContent = `${this.t('challenge_attempt')} ${this.attempts}`
    }
  }

  /** Notify the scene that the player gave a wrong answer (for HP damage) */
  protected notifyWrongAnswer(): void {
    this.scene.events.emit('challenge-wrong-answer')
  }

  protected addTimer(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(callback, ms)
    this.pendingTimers.push(handle)
    return handle
  }

  private clearTimers(): void {
    for (const t of this.pendingTimers) clearTimeout(t)
    this.pendingTimers = []
  }

  protected bindKeys(opts: {
    onKey: (e: KeyboardEvent) => void
    onEscape?: () => void
    isAnswered?: () => boolean
  }): void {
    this.unbindKeys()
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.closest('.cm-editor')) return

      if (e.code === 'Escape') {
        e.preventDefault()
        if (opts.onEscape) {
          opts.onEscape()
        } else {
          const answered = opts.isAnswered ? opts.isAnswered() : false
          this.onComplete(answered)
        }
        return
      }

      if (opts.isAnswered?.()) return
      opts.onKey(e)
    }
    document.addEventListener('keydown', this.boundKeyHandler)
  }

  protected bindEscapeOnly(onEscape: () => void): void {
    this.unbindKeys()
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        onEscape()
      }
    }
    document.addEventListener('keydown', this.boundKeyHandler)
  }

  private unbindKeys(): void {
    if (this.boundKeyHandler) {
      document.removeEventListener('keydown', this.boundKeyHandler)
      this.boundKeyHandler = null
    }
  }
}
