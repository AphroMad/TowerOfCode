import Phaser from 'phaser'
import { DialogSystem } from '@/systems/DialogSystem'
import { I18nManager } from '@/i18n/I18nManager'
import type { ChallengeConfig } from '@/data/types'

interface DialogSceneData {
  dialogKey?: string
  npcName?: string
  challengeConfig?: ChallengeConfig
  challengeIds?: string[]
  challengeCompleted?: boolean
}

export class DialogScene extends Phaser.Scene {
  private dialogSystem!: DialogSystem
  private speakerText!: Phaser.GameObjects.Text
  private dialogText!: Phaser.GameObjects.Text
  private advanceIndicator!: Phaser.GameObjects.Text
  private advanceTween?: Phaser.Tweens.Tween
  private sceneData!: DialogSceneData
  private inReplayPrompt = false
  private selectedOption = 0 // 0 = yes, 1 = no
  private optionsText?: Phaser.GameObjects.Text
  private yesLabel = ''
  private noLabel = ''

  constructor() {
    super({ key: 'DialogScene' })
  }

  create(data: DialogSceneData): void {
    this.sceneData = data
    this.inReplayPrompt = false
    this.selectedOption = 1
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
    const lines = data.dialogKey
      ? i18n.getDialog(data.dialogKey, data.npcName)
      : []
    this.dialogSystem.start(lines)

    // Input
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.inReplayPrompt) {
        this.confirmReplayChoice()
      } else {
        this.dialogSystem.advance()
      }
    })

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.inReplayPrompt) this.confirmReplayChoice()
    })

    this.input.keyboard!.on('keydown-UP', () => {
      if (this.inReplayPrompt) {
        this.selectedOption = 0
        this.updateReplayHighlight()
      }
    })

    this.input.keyboard!.on('keydown-DOWN', () => {
      if (this.inReplayPrompt) {
        this.selectedOption = 1
        this.updateReplayHighlight()
      }
    })

    // Cleanup on shutdown
    this.events.on('shutdown', () => {
      this.input.keyboard!.off('keydown-SPACE')
      this.input.keyboard!.off('keydown-ENTER')
      this.input.keyboard!.off('keydown-UP')
      this.input.keyboard!.off('keydown-DOWN')
      if (this.advanceTween) {
        this.advanceTween.stop()
        this.advanceTween = undefined
      }
      this.dialogSystem.destroy()
    })
  }

  private onDialogComplete(): void {
    if (this.sceneData.challengeConfig) {
      if (this.sceneData.challengeCompleted) {
        this.showReplayPrompt()
      } else {
        this.scene.stop()
        this.scene.launch('ChallengeScene', {
          challengeConfig: this.sceneData.challengeConfig,
          challengeIds: this.sceneData.challengeIds,
        })
      }
    } else {
      this.scene.stop()
      this.scene.resume('GameScene')
    }
  }

  private showReplayPrompt(): void {
    this.inReplayPrompt = true
    this.selectedOption = 0 // default Yes

    const i18n = I18nManager.getInstance()

    // Show prompt as regular dialog text
    this.dialogText.setText(i18n.t('challenge_replay_prompt'))

    // Hide the pulsing advance indicator
    this.advanceIndicator.setVisible(false)
    if (this.advanceTween) {
      this.advanceTween.stop()
      this.advanceTween = undefined
    }

    // Options displayed ABOVE the dialog box (player's response, not NPC speech)
    const cam = this.cameras.main
    const boxY = cam.height - 58
    const optX = cam.centerX + 180
    const optY = boxY - 110

    this.yesLabel = i18n.t('yes')
    this.noLabel = i18n.t('no')

    // Small background panel for the options
    this.add.rectangle(optX + 40, optY + 14, 110, 48, 0x000000, 0.8)
      .setDepth(2).setStrokeStyle(1, 0x444444)

    this.optionsText = this.add.text(optX, optY, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4,
    }).setDepth(3)

    this.updateReplayHighlight()
  }

  private updateReplayHighlight(): void {
    if (!this.optionsText) return
    const arrow = '>'
    const blank = ' '
    const yesLine = `${this.selectedOption === 0 ? arrow : blank} ${this.yesLabel}`
    const noLine = `${this.selectedOption === 1 ? arrow : blank} ${this.noLabel}`
    this.optionsText.setText(`${yesLine}\n${noLine}`)
  }

  private confirmReplayChoice(): void {
    if (this.selectedOption === 0) {
      this.scene.stop()
      this.scene.launch('ChallengeScene', {
        challengeConfig: this.sceneData.challengeConfig,
        challengeIds: this.sceneData.challengeIds,
      })
    } else {
      this.scene.stop()
      this.scene.resume('GameScene')
    }
  }
}
