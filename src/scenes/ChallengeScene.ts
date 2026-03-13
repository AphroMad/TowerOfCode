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
    this.scene.stop()
    this.scene.resume(this.returnScene)
  }
}
