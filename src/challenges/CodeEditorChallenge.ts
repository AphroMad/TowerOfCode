import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, CodeEditorConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

export class CodeEditorChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: CodeEditorConfig
  private onComplete!: (success: boolean) => void
  private answered = false
  private inputText = ''
  private inputDisplay!: Phaser.GameObjects.Text
  private cursorBlink!: Phaser.Time.TimerEvent
  private showCursor = true

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as CodeEditorConfig
    this.onComplete = onComplete
    this.answered = false
    this.inputText = this.config.starterCode

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
    const instruction = scene.add.text(cam.centerX, 120, i18n.t('challenge_write_code'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(instruction)

    // Code editor area background
    const editorBg = scene.add.rectangle(cam.centerX, 200, 500, 50, 0x1a1a2e)
      .setDepth(11)
      .setStrokeStyle(1, 0x444466)
    this.objects.push(editorBg)

    // Input display
    this.inputDisplay = scene.add.text(cam.centerX - 230, 188, this.inputText + '|', {
      fontSize: '18px',
      color: '#88ddff',
      fontFamily: 'monospace',
    }).setDepth(12)
    this.objects.push(this.inputDisplay)

    // Expected output hint
    const outputLabel = scene.add.text(cam.centerX, 260, i18n.t('challenge_expected_output'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(outputLabel)

    const expectedOutput = scene.add.text(cam.centerX, 290, this.config.expectedOutput, {
      fontSize: '16px',
      color: '#66aa66',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(expectedOutput)

    // Submit hint
    const submitHint = scene.add.text(cam.centerX, 330, '[ENTER]', {
      fontSize: '14px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(submitHint)

    // Blinking cursor
    this.cursorBlink = scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.showCursor = !this.showCursor
        this.updateInputDisplay()
      },
    })

    // Keyboard input
    scene.input.keyboard!.on('keydown', this.handleKeyDown, this)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.answered) return

    if (event.key === 'Enter') {
      this.submitAnswer()
    } else if (event.key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1)
      this.updateInputDisplay()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      this.inputText += '    '
      this.updateInputDisplay()
    } else if (event.key.length === 1 && this.inputText.length < 60) {
      this.inputText += event.key
      this.updateInputDisplay()
    }
  }

  private updateInputDisplay(): void {
    const cursor = this.showCursor ? '|' : ' '
    this.inputDisplay.setText(this.inputText + cursor)
  }

  private submitAnswer(): void {
    if (this.inputText.trim().length === 0) return
    this.answered = true
    const trimmed = this.inputText.trim()
    const i18n = I18nManager.getInstance()

    // Simple string match: check if the input matches expected output
    const correct = trimmed === this.config.expectedOutput.trim()

    if (correct) {
      this.inputDisplay.setColor('#44ff44')

      const explanation = this.scene.add.text(
        this.scene.cameras.main.centerX, 370,
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
        this.scene.cameras.main.centerX, 430,
        '[SPACE]',
        { fontSize: '14px', color: '#666666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(hint)

      this.scene.input.keyboard!.once('keydown-SPACE', () => {
        this.onComplete(true)
      })
    } else {
      this.inputDisplay.setColor('#ff4444')

      const wrongText = this.scene.add.text(
        this.scene.cameras.main.centerX, 370,
        i18n.t('challenge_wrong'),
        { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(wrongText)

      this.scene.time.delayedCall(1000, () => {
        wrongText.destroy()
        this.answered = false
        this.inputDisplay.setColor('#88ddff')
        this.updateInputDisplay()
      })
    }
  }

  update(): void {}

  destroy(): void {
    this.scene.input.keyboard!.off('keydown', this.handleKeyDown, this)
    if (this.cursorBlink) this.cursorBlink.destroy()
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
  }
}
