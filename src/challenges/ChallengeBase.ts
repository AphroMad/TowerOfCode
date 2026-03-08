import type { ChallengeConfig } from '@/data/types'
import type { IChallenge } from '@/challenges/IChallenge'
import { ClDomRenderer } from '@/challenges/cl-utils/ClDomRenderer'

export abstract class ChallengeBase<C extends ChallengeConfig = ChallengeConfig>
  implements IChallenge
{
  protected readonly renderer = new ClDomRenderer()
  protected onComplete!: (success: boolean) => void
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private pendingTimers: ReturnType<typeof setTimeout>[] = []

  create(
    _scene: Phaser.Scene,
    config: ChallengeConfig,
    onComplete: (success: boolean) => void,
  ): void {
    this.onComplete = onComplete
    const panel = this.renderer.createOverlay(_scene)
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
