import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'

export class MultipleChoiceChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private selectedIndex = 0
  private optionTexts: Phaser.GameObjects.Text[] = []
  private cursor!: Phaser.GameObjects.Text
  private scene!: Phaser.Scene
  private config!: ChallengeConfig
  private onComplete!: (success: boolean) => void
  private keyUp?: Phaser.Input.Keyboard.Key
  private keyDown?: Phaser.Input.Keyboard.Key
  private keySpace?: Phaser.Input.Keyboard.Key
  private answered = false

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config
    this.onComplete = onComplete
    this.selectedIndex = 0
    this.answered = false

    const cam = scene.cameras.main
    const i18n = I18nManager.getInstance()

    // Question
    const question = scene.add.text(cam.centerX, 70, i18n.t(config.questionKey), {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
      wordWrap: { width: 560 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(question)

    // Options
    const startY = 150
    config.options.forEach((opt, i) => {
      const text = scene.add.text(110, startY + i * 50, i18n.t(opt.textKey), {
        fontSize: '16px',
        color: '#cccccc',
        fontFamily: 'monospace',
        wordWrap: { width: 480 },
      }).setDepth(12)
      this.optionTexts.push(text)
      this.objects.push(text)
    })

    // Selection cursor
    this.cursor = scene.add.text(80, startY, '>', {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setDepth(12)
    this.objects.push(this.cursor)

    this.updateCursor()

    this.keyUp = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.keyDown = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.keySpace = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update(): void {
    if (this.answered) return

    if (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      this.updateCursor()
    }
    if (this.keyDown && Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.selectedIndex = Math.min(this.config.options.length - 1, this.selectedIndex + 1)
      this.updateCursor()
    }
    if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.submitAnswer()
    }
  }

  destroy(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    this.optionTexts = []
    if (this.keyUp) this.scene.input.keyboard!.removeKey(this.keyUp)
    if (this.keyDown) this.scene.input.keyboard!.removeKey(this.keyDown)
    if (this.keySpace) this.scene.input.keyboard!.removeKey(this.keySpace)
  }

  private updateCursor(): void {
    if (this.cursor && this.optionTexts[this.selectedIndex]) {
      this.cursor.y = this.optionTexts[this.selectedIndex].y
    }
    this.optionTexts.forEach((t, i) => {
      t.setColor(i === this.selectedIndex ? '#ffffff' : '#888888')
    })
  }

  private submitAnswer(): void {
    this.answered = true
    const selected = this.config.options[this.selectedIndex]
    const i18n = I18nManager.getInstance()

    if (selected.correct) {
      this.optionTexts[this.selectedIndex].setColor('#44ff44')
      this.cursor.setColor('#44ff44')

      const explanation = this.scene.add.text(
        this.scene.cameras.main.centerX, 380,
        i18n.t(this.config.explanationKey),
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
      this.optionTexts[this.selectedIndex].setColor('#ff4444')
      this.cursor.setColor('#ff4444')

      const wrongText = this.scene.add.text(
        this.scene.cameras.main.centerX, 390,
        i18n.t('challenge_wrong'),
        { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(wrongText)

      this.scene.time.delayedCall(1000, () => {
        wrongText.destroy()
        this.answered = false
        this.optionTexts[this.selectedIndex].setColor('#888888')
        this.cursor.setColor('#ffdd44')
        this.updateCursor()
      })
    }
  }
}
