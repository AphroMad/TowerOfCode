import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClMultipleChoiceConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClMultipleChoiceChallenge extends ChallengeBase<ClMultipleChoiceConfig> {
  private config!: ClMultipleChoiceConfig
  private selectedIndex = 0
  private answered = false
  private wrongShown = false
  private optionBtns: HTMLButtonElement[] = []
  private feedbackArea!: HTMLDivElement
  private hintBar!: HTMLDivElement
  private optionsDiv!: HTMLDivElement

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

    // Options container
    this.optionsDiv = document.createElement('div')
    this.optionsDiv.style.display = 'flex'
    this.optionsDiv.style.flexDirection = 'column'
    this.optionsDiv.style.gap = '6px'
    this.optionsDiv.style.margin = '14px 0'
    panel.appendChild(this.optionsDiv)

    this.renderOptions()

    // Feedback area
    this.feedbackArea = document.createElement('div')
    panel.appendChild(this.feedbackArea)

    // Hint bar
    this.hintBar = document.createElement('div')
    this.hintBar.className = 'cl-hint-bar'
    this.hintBar.textContent = this.t('challenge_hint_mcq')
    panel.appendChild(this.hintBar)

    this.setupKeyboard()
  }

  private renderOptions(): void {
    this.optionsDiv.innerHTML = ''
    this.optionBtns = []
    const options = this.config.content.exercise.options

    for (let i = 0; i < options.length; i++) {
      const btn = document.createElement('button')
      btn.className = 'cl-btn'
      btn.textContent = resolveText(options[i].value)
      btn.style.textAlign = 'left'
      btn.addEventListener('click', () => {
        if (this.answered) return
        // If showing wrong-answer feedback, clear it and let user pick again
        if (this.wrongShown) this.clearWrongState()
        this.selectedIndex = i
        this.highlightSelected()
        this.submitAnswer()
      })
      this.optionsDiv.appendChild(btn)
      this.optionBtns.push(btn)
    }
    this.highlightSelected()
  }

  private setupKeyboard(): void {
    this.bindKeys({
      isAnswered: () => this.answered,
      onKey: (e) => {
        if (e.code === 'ArrowUp') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
          this.selectedIndex = Math.max(0, this.selectedIndex - 1)
          this.highlightSelected()
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
          this.selectedIndex = Math.min(this.optionBtns.length - 1, this.selectedIndex + 1)
          this.highlightSelected()
        } else if (e.code === 'Enter') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
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

  private clearWrongState(): void {
    this.wrongShown = false
    this.feedbackArea.innerHTML = ''
    for (const btn of this.optionBtns) {
      btn.classList.remove('incorrect', 'dimmed', 'selected')
    }
    this.hintBar.textContent = this.t('challenge_hint_mcq')
  }

  private submitAnswer(): void {
    if (this.answered) return
    this.addAttempt()

    const correctIdx = this.config.content.exercise.correctAnswer
    const correct = this.selectedIndex === correctIdx

    // Show which was picked (and correct if right)
    for (let i = 0; i < this.optionBtns.length; i++) {
      this.optionBtns[i].classList.remove('selected')
      if (correct && i === correctIdx) {
        this.optionBtns[i].classList.add('correct')
      } else if (i === this.selectedIndex && !correct) {
        this.optionBtns[i].classList.add('incorrect')
      } else {
        this.optionBtns[i].classList.add('dimmed')
      }
    }

    // Show feedback
    this.feedbackArea.innerHTML = ''
    const hintText = resolveText(this.config.content.hint)

    const feedback = document.createElement('div')
    feedback.className = correct ? 'cl-success' : 'cl-failure'
    feedback.textContent = correct ? this.t('challenge_feedback_correct') : this.t('challenge_feedback_incorrect')
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

    if (correct) {
      this.answered = true
      this.hintBar.textContent = ''
      this.showDoneButton()
    } else {
      // Red stays until user clicks another option or navigates with keyboard
      this.wrongShown = true
      this.notifyWrongAnswer()
      this.hintBar.textContent = this.t('challenge_hint_enter_retry')
    }
  }
}
