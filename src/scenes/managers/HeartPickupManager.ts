import Phaser from 'phaser'
import { tileToPixel } from '@/utils/helpers'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { HpManager } from '@/systems/HpManager'
import type { HeartHud } from '@/ui/HeartHud'
import type { HeartPickupData } from '@/data/types'

export class HeartPickupManager {
  private scene: Phaser.Scene
  private gridMovement: GridMovementSystem
  private hpManager: HpManager
  private heartHud: HeartHud | undefined
  private heartSprites: Map<string, { sprite: Phaser.GameObjects.Text; restoreAmount: number }> = new Map()

  constructor(
    scene: Phaser.Scene,
    gridMovement: GridMovementSystem,
    hpManager: HpManager,
    heartHud: HeartHud | undefined,
  ) {
    this.scene = scene
    this.gridMovement = gridMovement
    this.hpManager = hpManager
    this.heartHud = heartHud
  }

  init(hearts: HeartPickupData[]): void {
    this.heartSprites.clear()
    for (const h of hearts) {
      this.createHeartPickup(h.tileX, h.tileY, h.restoreAmount ?? 1)
    }
  }

  check(): void {
    const tile = this.gridMovement.getPlayerTile()
    const key = `${tile.x},${tile.y}`
    const entry = this.heartSprites.get(key)
    if (!entry) return

    const healed = this.hpManager.heal(entry.restoreAmount)
    if (!healed && !this.hpManager.isInfinite) return

    this.heartSprites.delete(key)
    this.scene.tweens.add({
      targets: entry.sprite,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      y: entry.sprite.y - 20,
      duration: 300,
      ease: 'Power2',
      onComplete: () => entry.sprite.destroy(),
    })

    if (healed) {
      this.heartHud?.update(this.hpManager.hp)
      this.heartHud?.playHealAnimation(this.hpManager.hp)
    }
  }

  private createHeartPickup(tileX: number, tileY: number, restoreAmount: number): void {
    const px = tileToPixel(tileX)
    const py = tileToPixel(tileY)
    const sprite = this.scene.add.text(px, py, '\u2665', {
      fontSize: '24px',
      color: '#ff4466',
      fontFamily: 'monospace',
    })
      .setOrigin(0.5)
      .setDepth(py)

    this.scene.tweens.add({
      targets: sprite,
      y: py - 4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    this.heartSprites.set(`${tileX},${tileY}`, { sprite, restoreAmount })
  }
}
