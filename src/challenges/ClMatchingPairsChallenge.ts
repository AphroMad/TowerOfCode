import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClMatchingPairsConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClMatchingPairsChallenge extends ChallengeBase<ClMatchingPairsConfig> {
  private config!: ClMatchingPairsConfig
  private answered = false

  private selectedTerm = -1
  private selectedMatch = -1
  private column: 'term' | 'match' | 'none' = 'none'
  private connections = new Map<number, number>() // termIdx -> matchDisplayIdx
  private lockedTerms = new Set<number>() // indices of correctly matched terms
  private lockedMatches = new Set<number>() // indices of correctly matched matches
  private shuffledMatchIndices: number[] = []

  private termEls: HTMLButtonElement[] = []
  private matchEls: HTMLButtonElement[] = []
  private svgEl!: SVGSVGElement
  private matchContainer!: HTMLDivElement
  private feedbackArea!: HTMLDivElement
  private hintBar!: HTMLDivElement

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClMatchingPairsConfig,
    panel: HTMLDivElement,
  ): void {
    this.config = config
    this.answered = false
    this.connections.clear()
    this.lockedTerms.clear()
    this.lockedMatches.clear()
    this.column = 'none'
    this.selectedTerm = -1
    this.selectedMatch = -1

    const pairs = this.config.content.exercise.pairs

    // Shuffle match order
    this.shuffledMatchIndices = pairs.map((_, i) => i)
    for (let i = this.shuffledMatchIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledMatchIndices[i], this.shuffledMatchIndices[j]] =
        [this.shuffledMatchIndices[j], this.shuffledMatchIndices[i]]
    }

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    panel.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(panel, this.config.content.question)

    // Match container (relative positioning for SVG lines)
    this.matchContainer = document.createElement('div')
    this.matchContainer.style.position = 'relative'
    this.matchContainer.style.margin = '14px 0'
    panel.appendChild(this.matchContainer)

    // SVG for connection lines
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.svgEl.style.position = 'absolute'
    this.svgEl.style.top = '0'
    this.svgEl.style.left = '0'
    this.svgEl.style.width = '100%'
    this.svgEl.style.height = '100%'
    this.svgEl.style.pointerEvents = 'none'
    this.svgEl.style.overflow = 'visible'
    this.matchContainer.appendChild(this.svgEl)

    // Two-column layout
    const columnsDiv = document.createElement('div')
    columnsDiv.className = 'cl-match-container'
    this.matchContainer.appendChild(columnsDiv)

    // Term column
    const termCol = document.createElement('div')
    termCol.className = 'cl-match-column'
    columnsDiv.appendChild(termCol)

    // Match column
    const matchCol = document.createElement('div')
    matchCol.className = 'cl-match-column'
    columnsDiv.appendChild(matchCol)

    this.termEls = []
    this.matchEls = []

    for (let i = 0; i < pairs.length; i++) {
      const termBtn = document.createElement('button')
      termBtn.className = 'cl-match-item'
      termBtn.textContent = pairs[i].term.value.replace(/```/g, '')
      termBtn.addEventListener('click', () => {
        if (this.answered || this.lockedTerms.has(i)) return
        this.selectedTerm = i
        this.column = 'term'
        this.updateHighlights()
        // If a match is already selected, connect
        if (this.selectedMatch >= 0) this.connect()
      })
      termCol.appendChild(termBtn)
      this.termEls.push(termBtn)

      const matchPair = pairs[this.shuffledMatchIndices[i]]
      const matchVal = typeof matchPair.match.value === 'string'
        ? matchPair.match.value : resolveText(matchPair.match.value)

      const matchBtn = document.createElement('button')
      matchBtn.className = 'cl-match-item'
      matchBtn.textContent = matchVal.replace(/```/g, '')
      matchBtn.addEventListener('click', () => {
        if (this.answered || this.lockedMatches.has(i)) return
        this.selectedMatch = i
        this.column = 'match'
        this.updateHighlights()
        // If a term is already selected, connect
        if (this.selectedTerm >= 0) this.connect()
      })
      matchCol.appendChild(matchBtn)
      this.matchEls.push(matchBtn)
    }

    this.updateHighlights()

    // Feedback area
    this.feedbackArea = document.createElement('div')
    panel.appendChild(this.feedbackArea)

    // Hint bar
    this.hintBar = document.createElement('div')
    this.hintBar.className = 'cl-hint-bar'
    this.hintBar.textContent = this.t('challenge_hint_matching')
    panel.appendChild(this.hintBar)

    // Keyboard navigation
    this.bindKeys({
      isAnswered: () => this.answered,
      onKey: (e) => {
        if (e.code === 'ArrowUp') {
          e.preventDefault()
          if (this.column === 'none') { this.column = 'term'; this.selectedTerm = 0 }
          else if (this.column === 'term') {
            this.selectedTerm = Math.max(0, this.selectedTerm - 1)
          } else {
            this.selectedMatch = Math.max(0, this.selectedMatch - 1)
          }
          this.updateHighlights()
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          if (this.column === 'none') { this.column = 'term'; this.selectedTerm = 0 }
          else if (this.column === 'term') {
            this.selectedTerm = Math.min(pairs.length - 1, this.selectedTerm + 1)
          } else {
            this.selectedMatch = Math.min(pairs.length - 1, this.selectedMatch + 1)
          }
          this.updateHighlights()
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault()
          this.column = 'term'
          if (this.selectedTerm < 0) this.selectedTerm = 0
          this.updateHighlights()
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          this.column = 'match'
          if (this.selectedMatch < 0) this.selectedMatch = 0
          this.updateHighlights()
        } else if (e.code === 'Enter') {
          e.preventDefault()
          if (this.selectedTerm >= 0 && this.selectedMatch >= 0) {
            this.connect()
          }
        }
      },
    })
  }

  private connect(): void {
    if (this.lockedTerms.has(this.selectedTerm)) return

    // Remove any existing unlocked connection to this match
    for (const [k, v] of this.connections) {
      if (v === this.selectedMatch && !this.lockedTerms.has(k)) {
        this.connections.delete(k)
        break
      }
    }
    this.connections.set(this.selectedTerm, this.selectedMatch)
    this.drawConnections()
    this.updateHighlights()

    // Immediately check this pair
    this.checkPair(this.selectedTerm, this.selectedMatch)
  }

  private updateHighlights(): void {
    for (let i = 0; i < this.termEls.length; i++) {
      if (this.lockedTerms.has(i)) continue
      this.termEls[i].className = 'cl-match-item'
      if (i === this.selectedTerm) {
        this.termEls[i].classList.add('selected')
      } else if (this.connections.has(i)) {
        this.termEls[i].classList.add('connected')
      }
    }

    for (let i = 0; i < this.matchEls.length; i++) {
      if (this.lockedMatches.has(i)) continue
      this.matchEls[i].className = 'cl-match-item'
      if (i === this.selectedMatch) {
        this.matchEls[i].classList.add('selected')
      } else if ([...this.connections.values()].includes(i)) {
        this.matchEls[i].classList.add('connected')
      }
    }
  }

  private drawConnections(): void {
    while (this.svgEl.firstChild) {
      this.svgEl.removeChild(this.svgEl.firstChild)
    }

    const containerRect = this.matchContainer.getBoundingClientRect()

    for (const [termIdx, matchIdx] of this.connections) {
      const termEl = this.termEls[termIdx]
      const matchEl = this.matchEls[matchIdx]
      if (!termEl || !matchEl) continue

      const termRect = termEl.getBoundingClientRect()
      const matchRect = matchEl.getBoundingClientRect()

      const x1 = termRect.right - containerRect.left
      const y1 = termRect.top + termRect.height / 2 - containerRect.top
      const x2 = matchRect.left - containerRect.left
      const y2 = matchRect.top + matchRect.height / 2 - containerRect.top

      const isLocked = this.lockedTerms.has(termIdx)
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(x1))
      line.setAttribute('y1', String(y1))
      line.setAttribute('x2', String(x2))
      line.setAttribute('y2', String(y2))
      line.setAttribute('stroke', isLocked ? '#22aa22' : '#4488cc')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('data-term', String(termIdx))
      this.svgEl.appendChild(line)
    }
  }

  /** Resolve the display text of a match value */
  private getMatchText(pairIdx: number): string {
    const pair = this.config.content.exercise.pairs[pairIdx]
    const val = pair.match.value
    return (typeof val === 'string' ? val : resolveText(val)).replace(/```/g, '')
  }

  private checkPair(termIdx: number, matchDisplayIdx: number): void {
    // Compare by value, not position — handles duplicate answers on one side
    const expectedText = this.getMatchText(termIdx)
    const actualOriginalIdx = this.shuffledMatchIndices[matchDisplayIdx]
    const actualText = this.getMatchText(actualOriginalIdx)
    const isCorrect = actualText === expectedText

    if (isCorrect) {
      // Lock this pair — green and non-clickable
      this.lockedTerms.add(termIdx)
      this.lockedMatches.add(matchDisplayIdx)
      this.termEls[termIdx].className = 'cl-match-item correct'
      this.matchEls[matchDisplayIdx].className = 'cl-match-item correct'

      // Update the line color to green
      const line = this.svgEl.querySelector(`line[data-term="${termIdx}"]`)
      if (line) line.setAttribute('stroke', '#22aa22')

      // Check if all pairs are locked
      if (this.lockedTerms.size === this.config.content.exercise.pairs.length) {
        this.answered = true
        const success = document.createElement('div')
        success.className = 'cl-success'
        success.textContent = this.t('challenge_feedback_all_matched')
        this.feedbackArea.appendChild(success)
        this.hintBar.textContent = ''
        this.showDoneButton()
      } else {
        // Clear selection — user picks fresh
        this.selectedTerm = -1
        this.selectedMatch = -1
        this.column = 'none'
        this.updateHighlights()
      }
    } else {
      // Flash red then remove just this connection, clear selection
      this.notifyWrongAnswer()
      this.termEls[termIdx].classList.add('incorrect')
      this.matchEls[matchDisplayIdx].classList.add('incorrect')
      const line = this.svgEl.querySelector(`line[data-term="${termIdx}"]`)
      if (line) line.setAttribute('stroke', '#cc3333')

      this.addTimer(() => {
        this.connections.delete(termIdx)
        this.termEls[termIdx].classList.remove('incorrect')
        this.matchEls[matchDisplayIdx].classList.remove('incorrect')
        this.selectedTerm = -1
        this.selectedMatch = -1
        this.column = 'none'
        this.drawConnections()
        this.updateHighlights()
      }, 600)
    }
  }
}
