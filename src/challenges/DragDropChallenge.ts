import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, DragDropConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

export class DragDropChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: DragDropConfig
  private onComplete!: (success: boolean) => void
  private lines: string[] = []
  private lineTexts: Phaser.GameObjects.Text[] = []
  private cursor!: Phaser.GameObjects.Text
  private selectedIndex = 0
  private grabbedIndex = -1
  private answered = false
  private keyUp?: Phaser.Input.Keyboard.Key
  private keyDown?: Phaser.Input.Keyboard.Key
  private keySpace?: Phaser.Input.Keyboard.Key
  private keyEnter?: Phaser.Input.Keyboard.Key
  private startY = 150

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as DragDropConfig
    this.onComplete = onComplete
    this.selectedIndex = 0
    this.grabbedIndex = -1
    this.answered = false

    // Shuffle lines
    this.lines = [...this.config.correctOrder]
    this.shuffleArray(this.lines)

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
    const instruction = scene.add.text(cam.centerX, 100, i18n.t('challenge_reorder_lines'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(instruction)

    // Lines
    this.renderLines()

    // Cursor
    this.cursor = scene.add.text(80, this.startY, '>', {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setDepth(12)
    this.objects.push(this.cursor)

    // Submit hint
    const submitHint = scene.add.text(cam.centerX, this.startY + this.lines.length * 40 + 20,
      i18n.t('challenge_enter_submit'), {
        fontSize: '14px',
        color: '#666666',
        fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(submitHint)

    this.updateCursor()

    this.keyUp = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.keyDown = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.keySpace = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.keyEnter = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
  }

  private renderLines(): void {
    // Destroy existing line texts
    this.lineTexts.forEach(t => t.destroy())
    this.lineTexts = []

    this.lines.forEach((line, i) => {
      const text = this.scene.add.text(110, this.startY + i * 40, line, {
        fontSize: '16px',
        color: '#cccccc',
        fontFamily: 'monospace',
      }).setDepth(12)
      this.lineTexts.push(text)
      this.objects.push(text)
    })
  }

  update(): void {
    if (this.answered) return

    if (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      if (this.grabbedIndex >= 0) {
        // Move grabbed line up
        if (this.selectedIndex > 0) {
          this.swapLines(this.selectedIndex, this.selectedIndex - 1)
          this.grabbedIndex = this.selectedIndex - 1
          this.selectedIndex--
        }
      } else {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      }
      this.updateCursor()
    }
    if (this.keyDown && Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      if (this.grabbedIndex >= 0) {
        // Move grabbed line down
        if (this.selectedIndex < this.lines.length - 1) {
          this.swapLines(this.selectedIndex, this.selectedIndex + 1)
          this.grabbedIndex = this.selectedIndex + 1
          this.selectedIndex++
        }
      } else {
        this.selectedIndex = Math.min(this.lines.length - 1, this.selectedIndex + 1)
      }
      this.updateCursor()
    }
    if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      if (this.grabbedIndex >= 0) {
        // Drop
        this.grabbedIndex = -1
      } else {
        // Grab
        this.grabbedIndex = this.selectedIndex
      }
      this.updateCursor()
    }
    if (this.keyEnter && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      if (this.grabbedIndex < 0) {
        this.submitAnswer()
      }
    }
  }

  private swapLines(a: number, b: number): void {
    const temp = this.lines[a]
    this.lines[a] = this.lines[b]
    this.lines[b] = temp

    // Update displayed text
    this.lineTexts[a].setText(this.lines[a])
    this.lineTexts[b].setText(this.lines[b])
  }

  private updateCursor(): void {
    if (this.cursor && this.lineTexts[this.selectedIndex]) {
      this.cursor.y = this.lineTexts[this.selectedIndex].y
    }
    this.lineTexts.forEach((t, i) => {
      if (i === this.grabbedIndex) {
        t.setColor('#ffdd44') // grabbed = yellow
      } else if (i === this.selectedIndex) {
        t.setColor('#ffffff')
      } else {
        t.setColor('#888888')
      }
    })
    // Cursor color
    this.cursor.setColor(this.grabbedIndex >= 0 ? '#ffdd44' : '#ffdd44')
    this.cursor.setText(this.grabbedIndex >= 0 ? '=' : '>')
  }

  private submitAnswer(): void {
    this.answered = true
    const i18n = I18nManager.getInstance()

    const correct = this.lines.every(
      (line, i) => line === this.config.correctOrder[i]
    )

    if (correct) {
      this.lineTexts.forEach(t => t.setColor('#44ff44'))
      this.cursor.setColor('#44ff44')

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
    } else {
      this.lineTexts.forEach(t => t.setColor('#ff4444'))

      const wrongText = this.scene.add.text(
        this.scene.cameras.main.centerX, 390,
        i18n.t('challenge_wrong'),
        { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(wrongText)

      this.scene.time.delayedCall(1000, () => {
        wrongText.destroy()
        this.answered = false
        this.updateCursor()
      })
    }
  }

  private shuffleArray(arr: string[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    // Ensure it's not already in correct order
    if (arr.every((line, i) => line === this.config.correctOrder[i])) {
      ;[arr[0], arr[arr.length - 1]] = [arr[arr.length - 1], arr[0]]
    }
  }

  destroy(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    this.lineTexts = []
    if (this.keyUp) this.scene.input.keyboard!.removeKey(this.keyUp)
    if (this.keyDown) this.scene.input.keyboard!.removeKey(this.keyDown)
    if (this.keySpace) this.scene.input.keyboard!.removeKey(this.keySpace)
    if (this.keyEnter) this.scene.input.keyboard!.removeKey(this.keyEnter)
  }
}
