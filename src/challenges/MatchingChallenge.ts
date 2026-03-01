import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, MatchingConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

type MatchPhase = 'left' | 'right'

export class MatchingChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: MatchingConfig
  private onComplete!: (success: boolean) => void
  private answered = false
  private phase: MatchPhase = 'left'
  private leftIndex = 0
  private rightIndex = 0
  private selectedLeftIndex = -1
  private shuffledRightIndices: number[] = []
  private matched: boolean[] = []
  private leftTexts: Phaser.GameObjects.Text[] = []
  private rightTexts: Phaser.GameObjects.Text[] = []
  private cursor!: Phaser.GameObjects.Text
  private keyUp?: Phaser.Input.Keyboard.Key
  private keyDown?: Phaser.Input.Keyboard.Key
  private keySpace?: Phaser.Input.Keyboard.Key
  private pairColors = ['#44ff44', '#44aaff', '#ffaa44', '#ff44ff', '#ffff44', '#44ffff']

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as MatchingConfig
    this.onComplete = onComplete
    this.answered = false
    this.phase = 'left'
    this.leftIndex = 0
    this.rightIndex = 0
    this.selectedLeftIndex = -1
    this.matched = new Array(this.config.pairs.length).fill(false)

    // Shuffle right column
    this.shuffledRightIndices = this.config.pairs.map((_, i) => i)
    this.shuffleArray(this.shuffledRightIndices)

    const cam = scene.cameras.main
    const i18n = I18nManager.getInstance()

    // Question
    const question = scene.add.text(cam.centerX, 60, resolveText(this.config.question), {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
      wordWrap: { width: 560 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(question)

    // Instruction
    const instruction = scene.add.text(cam.centerX, 100, i18n.t('challenge_match_pairs'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(instruction)

    // Left column
    const startY = 150
    const leftX = 60
    const rightX = cam.width / 2 + 40

    this.config.pairs.forEach((pair, i) => {
      const text = scene.add.text(leftX, startY + i * 45, resolveText(pair.left), {
        fontSize: '15px',
        color: '#cccccc',
        fontFamily: 'monospace',
      }).setDepth(12)
      this.leftTexts.push(text)
      this.objects.push(text)
    })

    // Right column (shuffled)
    this.shuffledRightIndices.forEach((pairIdx, i) => {
      const pair = this.config.pairs[pairIdx]
      const text = scene.add.text(rightX, startY + i * 45, resolveText(pair.right), {
        fontSize: '15px',
        color: '#cccccc',
        fontFamily: 'monospace',
      }).setDepth(12)
      this.rightTexts.push(text)
      this.objects.push(text)
    })

    // Cursor
    this.cursor = scene.add.text(leftX - 25, startY, '>', {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setDepth(12)
    this.objects.push(this.cursor)

    this.updateVisuals()

    this.keyUp = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.keyDown = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.keySpace = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update(): void {
    if (this.answered) return

    if (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      if (this.phase === 'left') {
        this.leftIndex = this.findPrevUnmatched(this.leftIndex, 'left')
      } else {
        this.rightIndex = this.findPrevUnmatched(this.rightIndex, 'right')
      }
      this.updateVisuals()
    }
    if (this.keyDown && Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      if (this.phase === 'left') {
        this.leftIndex = this.findNextUnmatched(this.leftIndex, 'left')
      } else {
        this.rightIndex = this.findNextUnmatched(this.rightIndex, 'right')
      }
      this.updateVisuals()
    }
    if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.handleSelect()
    }
  }

  private findNextUnmatched(current: number, side: 'left' | 'right'): number {
    const len = this.config.pairs.length
    for (let offset = 1; offset < len; offset++) {
      const idx = (current + offset) % len
      if (side === 'left' && !this.matched[idx]) return idx
      if (side === 'right' && !this.isRightMatched(idx)) return idx
    }
    return current
  }

  private findPrevUnmatched(current: number, side: 'left' | 'right'): number {
    const len = this.config.pairs.length
    for (let offset = 1; offset < len; offset++) {
      const idx = (current - offset + len) % len
      if (side === 'left' && !this.matched[idx]) return idx
      if (side === 'right' && !this.isRightMatched(idx)) return idx
    }
    return current
  }

  private isRightMatched(displayIdx: number): boolean {
    const pairIdx = this.shuffledRightIndices[displayIdx]
    return this.matched[pairIdx]
  }

  private handleSelect(): void {
    if (this.phase === 'left') {
      if (this.matched[this.leftIndex]) return
      this.selectedLeftIndex = this.leftIndex
      this.phase = 'right'
      // Find first unmatched right
      this.rightIndex = this.findFirstUnmatched('right')
      this.updateVisuals()
    } else {
      // Check if this right item's pair index matches selectedLeftIndex
      const rightPairIdx = this.shuffledRightIndices[this.rightIndex]

      if (rightPairIdx === this.selectedLeftIndex) {
        // Correct match
        this.matched[this.selectedLeftIndex] = true
        const color = this.pairColors[this.selectedLeftIndex % this.pairColors.length]
        this.leftTexts[this.selectedLeftIndex].setColor(color)
        this.rightTexts[this.rightIndex].setColor(color)

        // Check if all matched
        if (this.matched.every(m => m)) {
          this.answered = true
          this.showSuccess()
          return
        }

        // Reset to left phase
        this.phase = 'left'
        this.selectedLeftIndex = -1
        this.leftIndex = this.findFirstUnmatched('left')
        this.updateVisuals()
      } else {
        // Wrong match — flash red
        this.rightTexts[this.rightIndex].setColor('#ff4444')
        const i18n = I18nManager.getInstance()

        const wrongText = this.scene.add.text(
          this.scene.cameras.main.centerX, 390,
          i18n.t('challenge_wrong'),
          { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
        ).setOrigin(0.5).setDepth(12)
        this.objects.push(wrongText)

        this.scene.time.delayedCall(800, () => {
          wrongText.destroy()
          this.rightTexts[this.rightIndex].setColor('#cccccc')
          this.phase = 'left'
          this.selectedLeftIndex = -1
          this.leftIndex = this.findFirstUnmatched('left')
          this.updateVisuals()
        })
      }
    }
  }

  private findFirstUnmatched(side: 'left' | 'right'): number {
    for (let i = 0; i < this.config.pairs.length; i++) {
      if (side === 'left' && !this.matched[i]) return i
      if (side === 'right' && !this.isRightMatched(i)) return i
    }
    return 0
  }

  private showSuccess(): void {
    const explanation = this.scene.add.text(
      this.scene.cameras.main.centerX, 380,
      resolveText(this.config.explanation),
      {
        fontSize: '14px',
        color: '#aaffaa',
        fontFamily: 'monospace',
        wordWrap: { width: 560 },
        align: 'center',
      }
    ).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(explanation)

    const hint = this.scene.add.text(
      this.scene.cameras.main.centerX, 440,
      '[SPACE]',
      { fontSize: '14px', color: '#666666', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(12)
    this.objects.push(hint)

    this.scene.input.keyboard!.once('keydown-SPACE', () => {
      this.onComplete(true)
    })
  }

  private updateVisuals(): void {
    const cam = this.scene.cameras.main
    const startY = 150
    const leftX = 60
    const rightX = cam.width / 2 + 40

    // Update left column colors
    this.leftTexts.forEach((t, i) => {
      if (this.matched[i]) return // keep matched color
      if (this.phase === 'left' && i === this.leftIndex) {
        t.setColor('#ffffff')
      } else if (i === this.selectedLeftIndex) {
        t.setColor('#ffdd44')
      } else {
        t.setColor('#888888')
      }
    })

    // Update right column colors
    this.rightTexts.forEach((t, i) => {
      if (this.isRightMatched(i)) return // keep matched color
      if (this.phase === 'right' && i === this.rightIndex) {
        t.setColor('#ffffff')
      } else {
        t.setColor('#888888')
      }
    })

    // Cursor position
    if (this.phase === 'left') {
      this.cursor.setPosition(leftX - 25, startY + this.leftIndex * 45)
    } else {
      this.cursor.setPosition(rightX - 25, startY + this.rightIndex * 45)
    }
  }

  private shuffleArray(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  destroy(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    this.leftTexts = []
    this.rightTexts = []
    if (this.keyUp) this.scene.input.keyboard!.removeKey(this.keyUp)
    if (this.keyDown) this.scene.input.keyboard!.removeKey(this.keyDown)
    if (this.keySpace) this.scene.input.keyboard!.removeKey(this.keySpace)
  }
}
