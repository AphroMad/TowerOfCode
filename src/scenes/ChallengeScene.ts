import Phaser from 'phaser'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import { floor01 } from '@/data/floors/floor-01'
import { SaveManager } from '@/systems/SaveManager'
import { I18nManager } from '@/i18n/I18nManager'

interface ChallengeSceneData {
  challengeId: string
}

export class ChallengeScene extends Phaser.Scene {
  private challenge: IChallenge | null = null

  constructor() {
    super({ key: 'ChallengeScene' })
  }

  create(data: ChallengeSceneData): void {
    const cam = this.cameras.main
    const i18n = I18nManager.getInstance()

    // Background
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122, 0.95)
      .setDepth(10)

    // Title
    this.add.text(cam.centerX, 20, i18n.t('challenge_title'), {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11)

    // Find challenge config
    const config = floor01.challenges.find(c => c.id === data.challengeId)
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
    if (this.challenge && 'update' in this.challenge) {
      (this.challenge as { update(): void }).update()
    }
  }

  private closeScene(): void {
    if (this.challenge) {
      this.challenge.destroy()
      this.challenge = null
    }
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}
