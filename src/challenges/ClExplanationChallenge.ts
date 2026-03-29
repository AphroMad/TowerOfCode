import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClExplanationConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClExplanationChallenge extends ChallengeBase<ClExplanationConfig> {
  protected onCreate(
    _scene: Phaser.Scene,
    config: ClExplanationConfig,
    panel: HTMLDivElement,
  ): void {
    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(config.title)
    panel.appendChild(title)

    // Content blocks
    this.renderer.renderContentBlocks(panel, config.content.question)

    // Continue button
    const hintBar = document.createElement('div')
    hintBar.className = 'cl-hint-bar'
    panel.appendChild(hintBar)

    const btn = document.createElement('button')
    btn.className = 'cl-btn-primary'
    btn.textContent = this.t('challenge_btn_continue')
    btn.addEventListener('click', () => this.onComplete(true))
    hintBar.appendChild(btn)

    this.bindKeys({ onKey: () => {} })
  }
}
