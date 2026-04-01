import Phaser from 'phaser'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { SCENE } from '@/utils/constants'

interface TransitionData {
  mapId: string
  mapName: string
  fromDirection?: 'up' | 'down'
  fromMapId?: string
}

export class TransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.TRANSITION })
  }

  create(data: TransitionData): void {
    const { mapId, mapName } = data

    // Full-screen black overlay
    const overlay = this.add.rectangle(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      CANVAS_WIDTH, CANVAS_HEIGHT,
      0x000000
    ).setAlpha(0).setDepth(0)

    // Map name text (hidden initially)
    const label = this.add.text(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      mapName,
      { fontSize: '22px', color: '#ffffff', fontFamily: 'monospace' }
    ).setOrigin(0.5).setAlpha(0).setDepth(1)

    // 1. Fade in black (500ms)
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        // 2. Show map name
        this.tweens.add({
          targets: label,
          alpha: 1,
          duration: 200,
          onComplete: () => {
            // 3. Hold, then fade name out (300ms)
            this.time.delayedCall(1200, () => {
              this.tweens.add({
                targets: label,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  // 4. Restart GameScene with new map, then stop self
                  // scene.start() auto-stops a running scene, avoiding race conditions
                  this.scene.start(SCENE.GAME, { mapId, fromDirection: data.fromDirection, fromMapId: data.fromMapId })
                  this.scene.stop()
                },
              })
            })
          },
        })
      },
    })
  }
}
