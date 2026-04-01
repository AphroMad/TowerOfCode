import Phaser from 'phaser'
import type { Direction } from '@/data/types'
import { TILE_SIZE, PLAYER_MOVE_SPEED } from '@/config/game.config'
import { tileToPixel, DIR_OFFSETS } from '@/utils/helpers'
import { createDirectionalAnimations, DIR_ROW } from '@/utils/AnimationFactory'

/**
 * A codemon companion that follows the player 1 tile behind.
 * No collision, no behavior system — just follow + idle/walk animations.
 */
export class Companion {
  readonly sprite: Phaser.GameObjects.Sprite
  private facing: Direction = 'down'
  private readonly animPrefix: string
  private isMoving = false

  constructor(scene: Phaser.Scene, spriteKey: string, tileX: number, tileY: number, facing: Direction) {
    this.animPrefix = `companion-${spriteKey}`
    this.facing = facing

    this.sprite = scene.add.sprite(
      tileToPixel(tileX),
      tileToPixel(tileY),
      spriteKey,
      DIR_ROW[facing] * 4,
    )
    this.sprite.setOrigin(0.5, 0.75)
    createDirectionalAnimations(scene, spriteKey, this.animPrefix)
    this.playIdle()
  }

  /** Move companion to a tile with walk animation */
  walkToTile(scene: Phaser.Scene, tileX: number, tileY: number): void {
    if (this.isMoving) return

    // Determine direction from current position
    const curX = this.tileX
    const curY = this.tileY
    const dx = tileX - curX
    const dy = tileY - curY

    if (dx === 0 && dy === 0) return

    // Pick facing based on movement
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left'
    } else {
      this.facing = dy > 0 ? 'down' : 'up'
    }

    this.isMoving = true
    this.sprite.play(`${this.animPrefix}-${this.facing}`, true)

    const duration = (TILE_SIZE / PLAYER_MOVE_SPEED) * 1000

    scene.tweens.add({
      targets: this.sprite,
      x: tileToPixel(tileX),
      y: tileToPixel(tileY),
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false
        this.playIdle()
      },
    })
  }

  /** Teleport companion to a tile instantly (no animation) */
  teleportTo(tileX: number, tileY: number, facing: Direction): void {
    this.sprite.x = tileToPixel(tileX)
    this.sprite.y = tileToPixel(tileY)
    this.facing = facing
    this.playIdle()
  }

  /** Get spawn position 1 tile behind a given position */
  static behindPosition(tileX: number, tileY: number, facing: Direction): { x: number; y: number } {
    const off = DIR_OFFSETS[facing]
    return { x: tileX - off.x, y: tileY - off.y }
  }

  private playIdle(): void {
    this.sprite.play(`${this.animPrefix}-idle-${this.facing}`, true)
  }

  get tileX(): number {
    return Math.round((this.sprite.x - TILE_SIZE / 2) / TILE_SIZE)
  }

  get tileY(): number {
    return Math.round((this.sprite.y - TILE_SIZE / 2) / TILE_SIZE)
  }

  destroy(): void {
    this.sprite.destroy()
  }
}
