import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClFillInTextConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClFillInTextChallenge extends ChallengeBase<ClFillInTextConfig> {
  private config!: ClFillInTextConfig

  private slots: string[] = []
  private activeSlot = 0
  private selectedOption = 0
  private answered = false
  private availableOptions: string[] = []

  private slotEls: HTMLSpanElement[] = []
  private chipEls: HTMLButtonElement[] = []
  private chipsContainer!: HTMLDivElement
  private verifyBtn!: HTMLButtonElement
  private feedbackArea!: HTMLDivElement
  private hintBar!: HTMLDivElement

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClFillInTextConfig,
    panel: HTMLDivElement,
  ): void {
    this.config = config

    const slotCount = (this.config.content.exercise.text.match(/\{\{\}\}/g) || []).length
    this.slots = new Array(slotCount).fill('')
    this.activeSlot = 0
    this.selectedOption = 0
    this.answered = false
    this.availableOptions = [...this.config.content.exercise.options]

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    panel.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(panel, this.config.content.question)

    // Code template with slots
    this.renderTemplate(panel)

    // Options label
    const optLabel = document.createElement('div')
    optLabel.style.fontSize = '12px'
    optLabel.style.color = '#888'
    optLabel.style.marginBottom = '8px'
    optLabel.textContent = this.t('challenge_label_options')
    panel.appendChild(optLabel)

    // Option chips
    this.chipsContainer = document.createElement('div')
    this.chipsContainer.className = 'cl-fill-options'
    panel.appendChild(this.chipsContainer)
    this.renderChips()

    // Verify button
    this.verifyBtn = document.createElement('button')
    this.verifyBtn.className = 'cl-btn-primary'
    this.verifyBtn.textContent = this.t('challenge_btn_verify')
    this.verifyBtn.style.marginBottom = '10px'
    this.verifyBtn.addEventListener('click', () => this.checkAnswer())
    panel.appendChild(this.verifyBtn)

    // Feedback area
    this.feedbackArea = document.createElement('div')
    panel.appendChild(this.feedbackArea)

    // Hint bar
    this.hintBar = document.createElement('div')
    this.hintBar.className = 'cl-hint-bar'
    this.hintBar.textContent = this.t('challenge_hint_fill_in')
    panel.appendChild(this.hintBar)

    this.updateSlotHighlights()
    this.updateChipHighlights()

    // Keyboard navigation
    this.bindKeys({
      isAnswered: () => this.answered,
      onEscape: () => this.onComplete(this.answered),
      onKey: (e) => {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          this.activeSlot = Math.max(0, this.activeSlot - 1)
          this.updateSlotHighlights()
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          this.activeSlot = Math.min(this.slots.length - 1, this.activeSlot + 1)
          this.updateSlotHighlights()
        } else if (e.code === 'ArrowUp') {
          e.preventDefault()
          this.selectedOption = Math.max(0, this.selectedOption - 1)
          this.updateChipHighlights()
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          this.selectedOption = Math.min(this.availableOptions.length - 1, this.selectedOption + 1)
          this.updateChipHighlights()
        } else if (e.code === 'Enter') {
          e.preventDefault()
          if (this.availableOptions.length > 0) this.placeOption()
        } else if (e.code === 'Backspace') {
          e.preventDefault()
          this.removeFromSlot()
        }
      },
    })
  }

  private renderTemplate(container: HTMLElement): void {
    const templateDiv = document.createElement('div')
    templateDiv.className = 'cl-fill-template'
    container.appendChild(templateDiv)

    const parts = this.config.content.exercise.text.split('{{}}')
    this.slotEls = []

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        const span = document.createElement('span')
        span.textContent = parts[i]
        templateDiv.appendChild(span)
      }

      if (i < parts.length - 1) {
        const slotIdx = i
        const slot = document.createElement('span')
        slot.className = 'cl-fill-slot'
        slot.textContent = '____'
        slot.addEventListener('click', () => {
          if (this.answered) return
          // Don't touch correctly verified slots
          if (this.slotEls[slotIdx]?.classList.contains('correct')) return
          // If clicking a filled slot, remove its value
          if (this.slots[slotIdx]) {
            this.activeSlot = slotIdx
            this.removeFromSlot()
            return
          }
          this.activeSlot = slotIdx
          this.updateSlotHighlights()
        })
        templateDiv.appendChild(slot)
        this.slotEls.push(slot)
      }
    }
  }

  /** Rebuild option chips from availableOptions — always clears container first */
  private renderChips(): void {
    this.chipsContainer.innerHTML = ''
    this.chipEls = []

    for (let i = 0; i < this.availableOptions.length; i++) {
      const chip = document.createElement('button')
      chip.className = 'cl-fill-chip'
      chip.textContent = this.availableOptions[i]
      chip.addEventListener('click', () => {
        if (this.answered) return
        this.selectedOption = i
        this.updateChipHighlights()
        this.placeOption()
      })
      this.chipsContainer.appendChild(chip)
      this.chipEls.push(chip)
    }
    this.updateChipHighlights()
  }

  private updateSlotHighlights(): void {
    for (let i = 0; i < this.slotEls.length; i++) {
      const label = this.slots[i] || '____'
      this.slotEls[i].textContent = label
      this.slotEls[i].classList.toggle('active', i === this.activeSlot)
    }
  }

  private updateChipHighlights(): void {
    // No visual highlight on chips — just track selectedOption internally
  }

  private placeOption(): void {
    if (this.availableOptions.length === 0) return

    // Return current slot value to options
    if (this.slots[this.activeSlot]) {
      this.availableOptions.push(this.slots[this.activeSlot])
    }

    const chosen = this.availableOptions[this.selectedOption]
    this.slots[this.activeSlot] = chosen
    this.availableOptions.splice(this.selectedOption, 1)

    if (this.selectedOption >= this.availableOptions.length) {
      this.selectedOption = Math.max(0, this.availableOptions.length - 1)
    }

    this.renderChips()
    this.updateSlotHighlights()

    // Move to next empty slot
    const nextEmpty = this.slots.indexOf('', this.activeSlot + 1)
    if (nextEmpty !== -1) {
      this.activeSlot = nextEmpty
      this.updateSlotHighlights()
    }
  }

  private removeFromSlot(): void {
    // Don't allow removing a correctly verified answer
    if (this.slotEls[this.activeSlot]?.classList.contains('correct')) return
    if (this.slots[this.activeSlot]) {
      this.availableOptions.push(this.slots[this.activeSlot])
      this.slots[this.activeSlot] = ''
      // Clear red marker and feedback when user removes the wrong answer
      this.slotEls[this.activeSlot].classList.remove('incorrect')
      this.feedbackArea.innerHTML = ''
      this.renderChips()
      // Jump to first empty slot
      const firstEmpty = this.slots.indexOf('')
      if (firstEmpty !== -1) this.activeSlot = firstEmpty
      this.updateSlotHighlights()
    }
  }

  private checkAnswer(): void {
    // Need all slots filled to verify
    if (!this.slots.every(s => s !== '')) {
      this.feedbackArea.innerHTML = ''
      const warn = document.createElement('div')
      warn.className = 'cl-failure'
      warn.textContent = this.t('challenge_validation_fill_all')
      this.feedbackArea.appendChild(warn)
      this.addTimer(() => { warn.remove() }, 1500)
      return
    }

    this.addAttempt()
    const correctAnswers = this.config.content.exercise.correctAnswers
    let allCorrect = true

    // Mark each slot individually
    for (let i = 0; i < this.slots.length; i++) {
      const key = String(i + 1)
      const isRight = this.slots[i] === correctAnswers[key]
      this.slotEls[i].classList.toggle('correct', isRight)
      this.slotEls[i].classList.toggle('incorrect', !isRight)
      this.slotEls[i].classList.remove('active')
      if (!isRight) allCorrect = false
    }

    this.feedbackArea.innerHTML = ''

    if (allCorrect) {
      this.answered = true
      this.verifyBtn.style.display = 'none'

      const success = document.createElement('div')
      success.className = 'cl-success'
      success.textContent = this.t('challenge_feedback_correct')
      this.feedbackArea.appendChild(success)

      this.hintBar.textContent = this.t('challenge_hint_esc_close')
    } else {
      const fail = document.createElement('div')
      fail.className = 'cl-failure'
      fail.textContent = this.t('challenge_feedback_not_quite')
      this.feedbackArea.appendChild(fail)
      this.notifyWrongAnswer()

      // Feedback stays until user modifies a slot
    }
  }
}
