import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClMultipleChoiceConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClMultipleChoiceChallenge extends ChallengeBase<ClMultipleChoiceConfig> {
  private config!: ClMultipleChoiceConfig
  private selectedIndex = 0
  private answered = false
  private optionBtns: HTMLButtonElement[] = []
  private feedbackArea!: HTMLDivElement
  private hintBar!: HTMLDivElement

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClMultipleChoiceConfig,
    panel: HTMLDivElement,
  ): void {
    this.config = config
    this.selectedIndex = 0
    this.answered = false

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    panel.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(panel, this.config.content.question)

    // Options
    const optionsDiv = document.createElement('div')
    optionsDiv.style.display = 'flex'
    optionsDiv.style.flexDirection = 'column'
    optionsDiv.style.gap = '6px'
    optionsDiv.style.margin = '14px 0'
    panel.appendChild(optionsDiv)

    this.optionBtns = []
    const options = this.config.content.exercise.options
    for (let i = 0; i < options.length; i++) {
      const btn = document.createElement('button')
      btn.className = 'cl-btn'
      btn.textContent = resolveText(options[i].value)
      btn.style.textAlign = 'left'
      btn.addEventListener('click', () => {
        if (this.answered) return
        this.selectedIndex = i
        this.highlightSelected()
        this.submitAnswer()
      })
      optionsDiv.appendChild(btn)
      this.optionBtns.push(btn)
    }

    this.highlightSelected()

    // Feedback area
    this.feedbackArea = document.createElement('div')
    panel.appendChild(this.feedbackArea)

    // Hint bar
    this.hintBar = document.createElement('div')
    this.hintBar.className = 'cl-hint-bar'
    this.hintBar.textContent = '[UP/DOWN] select  [ENTER] submit  [ESC] close'
    panel.appendChild(this.hintBar)

    // Keyboard navigation
    this.bindKeys({
      isAnswered: () => this.answered,
      onEscape: () => this.onComplete(this.answered),
      onKey: (e) => {
        if (e.code === 'ArrowUp') {
          e.preventDefault()
          this.selectedIndex = Math.max(0, this.selectedIndex - 1)
          this.highlightSelected()
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          this.selectedIndex = Math.min(options.length - 1, this.selectedIndex + 1)
          this.highlightSelected()
        } else if (e.code === 'Enter') {
          e.preventDefault()
          this.submitAnswer()
        }
      },
    })
  }

  private highlightSelected(): void {
    for (let i = 0; i < this.optionBtns.length; i++) {
      this.optionBtns[i].classList.toggle('selected', i === this.selectedIndex)
    }
  }

  private submitAnswer(): void {
    if (this.answered) return
    this.answered = true

    const correctIdx = this.config.content.exercise.correctAnswer

    for (let i = 0; i < this.optionBtns.length; i++) {
      this.optionBtns[i].classList.remove('selected')
      if (i === correctIdx) {
        this.optionBtns[i].classList.add('correct')
      } else if (i === this.selectedIndex) {
        this.optionBtns[i].classList.add('incorrect')
      } else {
        this.optionBtns[i].classList.add('dimmed')
      }
    }

    // Show hint
    const hintText = resolveText(this.config.content.hint)
    const correct = this.selectedIndex === correctIdx

    const feedback = document.createElement('div')
    feedback.className = correct ? 'cl-success' : 'cl-failure'
    feedback.textContent = correct ? 'Correct!' : 'Incorrect'
    this.feedbackArea.appendChild(feedback)

    if (hintText) {
      const hintDiv = document.createElement('div')
      hintDiv.className = 'cl-text-block'
      hintDiv.style.color = correct ? '#22aa22' : '#cc6600'
      hintDiv.style.fontSize = '12px'
      hintDiv.style.textAlign = 'center'
      hintDiv.textContent = hintText
      this.feedbackArea.appendChild(hintDiv)
    }

    this.hintBar.textContent = '[ESC] to close'
  }
}
