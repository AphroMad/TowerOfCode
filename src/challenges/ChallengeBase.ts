import type { ChallengeConfig } from '@/data/types'
import type { IChallenge } from '@/challenges/IChallenge'
import { ClDomRenderer } from '@/challenges/cl-utils/ClDomRenderer'
import { i18n } from '@/i18n/I18nManager'

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
    this.initPanel(panel, _scene, config)
  }

  createInPanel(
    _scene: Phaser.Scene,
    config: ChallengeConfig,
    onComplete: (success: boolean) => void,
    panel: HTMLDivElement,
  ): void {
    this.onComplete = onComplete
    this.scene = _scene
    this.attempts = 0
    this.renderer.adoptPanel(panel)
    this.initPanel(panel, _scene, config)
  }

  private initPanel(panel: HTMLDivElement, scene: Phaser.Scene, config: ChallengeConfig): void {
    this.attemptEl = document.createElement('span')
    this.attemptEl.className = 'cl-attempt-counter'
    this.attemptEl.style.display = 'none'
    panel.appendChild(this.attemptEl)
    this.onCreate(scene, config as C, panel)
  }

  update(): void {}

  /** Full cleanup — removes the overlay from DOM */
  destroy(): void {
    this.clearTimers()
    this.unbindKeys()
    this.onDestroy()
    this.renderer.destroyOverlay()
  }

  /** Soft cleanup — keeps the overlay, clears content for next challenge */
  softDestroy(): void {
    this.clearTimers()
    this.unbindKeys()
    this.onDestroy()
    this.renderer.clearPanel()
  }

  getPanel(): HTMLDivElement | null {
    return this.renderer.getPanel()
  }

  protected abstract onCreate(
    scene: Phaser.Scene,
    config: C,
    panel: HTMLDivElement,
  ): void

  protected onDestroy(): void {}

  /** Shorthand for I18nManager.t() */
  protected t(key: string): string {
    return i18n.t(key)
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

  /** Show a "Continue" button at the bottom of the panel after success */
  protected showDoneButton(): void {
    const panel = this.renderer.getPanel()
    if (!panel) return
    const bar = document.createElement('div')
    bar.className = 'cl-hint-bar'
    bar.style.marginTop = '12px'
    const btn = document.createElement('button')
    btn.className = 'cl-btn-primary'
    btn.textContent = this.t('challenge_btn_continue')
    btn.addEventListener('click', () => this.onComplete(true))
    bar.appendChild(btn)
    panel.appendChild(bar)
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
    isAnswered?: () => boolean
  }): void {
    this.unbindKeys()
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.closest('.cm-editor')) return
      if (e.code === 'Escape') { e.preventDefault(); return }
      if (opts.isAnswered?.()) return
      opts.onKey(e)
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
