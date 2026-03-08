import Phaser from 'phaser'
import { DialogSystem } from '@/systems/DialogSystem'
import { I18nManager } from '@/i18n/I18nManager'
import type { ChallengeConfig } from '@/data/types'

interface DialogSceneData {
  dialogKey: string
  npcName: string
  challengeConfig?: ChallengeConfig
}

export class DialogScene extends Phaser.Scene {
  private dialogSystem!: DialogSystem
  private speakerText!: Phaser.GameObjects.Text
  private dialogText!: Phaser.GameObjects.Text
  private advanceIndicator!: Phaser.GameObjects.Text
  private advanceTween?: Phaser.Tweens.Tween
  private sceneData!: DialogSceneData

  constructor() {
    super({ key: 'DialogScene' })
  }

  create(data: DialogSceneData): void {
    this.sceneData = data
    const cam = this.cameras.main
    const boxY = cam.height - 58

    // Semi-transparent background overlay
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.3)
      .setDepth(0)

    // Dialog box
    this.add.image(cam.centerX, boxY, 'dialog-box')
      .setDepth(1)

    // Speaker name
    this.speakerText = this.add.text(cam.centerX - 286, boxY - 36, '', {
      fontSize: '16px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setDepth(2)

    // Dialog text
    this.dialogText = this.add.text(cam.centerX - 286, boxY - 14, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      wordWrap: { width: 572 },
      lineSpacing: 6,
    }).setDepth(2)

    // Advance indicator
    this.advanceIndicator = this.add.text(cam.centerX + 286, boxY + 32, '>', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setDepth(2)

    this.advanceTween = this.tweens.add({
      targets: this.advanceIndicator,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 500,
    })

    // Dialog system
    this.dialogSystem = new DialogSystem(
      this,
      (text, speaker) => {
        this.dialogText.setText(text)
        if (speaker) this.speakerText.setText(speaker)
      },
      () => this.onDialogComplete(),
    )

    // Get dialog lines from i18n
    const i18n = I18nManager.getInstance()
    const lines = i18n.getDialog(data.dialogKey, data.npcName)
    this.dialogSystem.start(lines)

    // Input
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.dialogSystem.advance()
    })

    // Cleanup on shutdown
    this.events.on('shutdown', () => {
      this.input.keyboard!.off('keydown-SPACE')
      if (this.advanceTween) {
        this.advanceTween.stop()
        this.advanceTween = undefined
      }
      this.dialogSystem.destroy()
    })
  }

  private onDialogComplete(): void {
    if (this.sceneData.challengeConfig) {
      this.scene.stop()
      this.scene.launch('ChallengeScene', {
        challengeConfig: this.sceneData.challengeConfig,
      })
    } else {
      this.scene.stop()
      this.scene.resume('GameScene')
    }
  }
}
