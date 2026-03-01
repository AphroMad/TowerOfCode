import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, FillInBlankConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

export class FillInBlankChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: FillInBlankConfig
  private onComplete!: (success: boolean) => void
  private answered = false
  private inputText = ''
  private inputDisplay!: Phaser.GameObjects.Text
  private cursorBlink!: Phaser.Time.TimerEvent
  private showCursor = true

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as FillInBlankConfig
    this.onComplete = onComplete
    this.answered = false
    this.inputText = ''

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

    // Code template
    const template = scene.add.text(cam.centerX, 140, this.config.codeTemplate, {
      fontSize: '22px',
      color: '#88ddff',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(template)

    // Input label
    const label = scene.add.text(cam.centerX, 210, i18n.t('challenge_type_answer'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(label)

    // Input display
    this.inputDisplay = scene.add.text(cam.centerX, 245, '|', {
      fontSize: '20px',
      color: '#ffdd44',
      fontFamily: 'monospace',
      backgroundColor: '#222233',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(this.inputDisplay)

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

    if (event.key === 'Enter' || (event.key === ' ' && this.inputText.length > 0)) {
      if (event.key === ' ') event.preventDefault()
      this.submitAnswer()
    } else if (event.key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1)
      this.updateInputDisplay()
    } else if (event.key.length === 1 && this.inputText.length < 30) {
      this.inputText += event.key
      this.updateInputDisplay()
    }
  }

  private updateInputDisplay(): void {
    const cursor = this.showCursor ? '|' : ' '
    this.inputDisplay.setText(this.inputText.length > 0 ? this.inputText + cursor : cursor)
  }

  private submitAnswer(): void {
    if (this.inputText.trim().length === 0) return
    this.answered = true
    const trimmed = this.inputText.trim()
    const i18n = I18nManager.getInstance()

    const correct = this.config.acceptedAnswers.some(
      ans => ans.toLowerCase() === trimmed.toLowerCase()
    )

    if (correct) {
      this.inputDisplay.setColor('#44ff44')

      const explanation = this.scene.add.text(
        this.scene.cameras.main.centerX, 340,
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
        this.scene.cameras.main.centerX, 400,
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
        this.scene.cameras.main.centerX, 340,
        i18n.t('challenge_wrong'),
        { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(wrongText)

      this.scene.time.delayedCall(1000, () => {
        wrongText.destroy()
        this.answered = false
        this.inputText = ''
        this.inputDisplay.setColor('#ffdd44')
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
