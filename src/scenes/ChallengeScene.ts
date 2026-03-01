import Phaser from 'phaser'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'
import { I18nManager } from '@/i18n/I18nManager'

interface ChallengeSceneData {
  challengeConfig: ChallengeConfig
  returnScene?: string
}

export class ChallengeScene extends Phaser.Scene {
  private challenge: IChallenge | null = null
  private escKey?: Phaser.Input.Keyboard.Key
  private returnScene = 'GameScene'

  constructor() {
    super({ key: 'ChallengeScene' })
  }

  create(data: ChallengeSceneData): void {
    const cam = this.cameras.main
    const i18n = I18nManager.getInstance()

    // Background
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122)
      .setDepth(10)

    // Title
    this.add.text(cam.centerX, 20, i18n.t('challenge_title'), {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11)

    // Close button (X) — top right
    const closeBtn = this.add.text(cam.width - 20, 16, 'X', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace',
      backgroundColor: '#333344',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setDepth(15).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4444'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'))
    closeBtn.on('pointerdown', () => this.closeScene())

    // ESC key also closes
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => this.closeScene())

    this.returnScene = data.returnScene ?? 'GameScene'

    const config = data.challengeConfig
    if (!config) {
      this.closeScene()
      return
    }

    // Create challenge
    this.challenge = createChallenge(config.type)
    this.challenge.create(this, config, (success) => {
      if (success) {
        SaveManager.getInstance().completeChallenge(config.id)
      }
      this.closeScene()
    })
  }

  update(): void {
    if (this.challenge) {
      this.challenge.update()
    }
  }

  private closeScene(): void {
    if (this.challenge) {
      this.challenge.destroy()
      this.challenge = null
    }
    if (this.escKey) {
      this.input.keyboard!.removeKey(this.escKey)
      this.escKey = undefined
    }
    this.scene.stop()
    this.scene.resume(this.returnScene)
  }
}
