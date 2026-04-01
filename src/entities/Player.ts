import Phaser from 'phaser'
import type { Direction } from '@/data/types'
import { TILE_SIZE } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'
import { createDirectionalAnimations } from '@/utils/AnimationFactory'

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite
  facing: Direction = 'down'

  constructor(scene: Phaser.Scene, tileX: number, tileY: number) {
    this.sprite = scene.add.sprite(
      tileToPixel(tileX),
      tileToPixel(tileY),
      'player',
      0
    )
    this.sprite.setOrigin(0.5, 0.75)
    createDirectionalAnimations(scene, 'player', 'player')
  }

  playWalk(dir: Direction): void {
    this.facing = dir
    this.sprite.play(`player-${dir}`, true)
  }

  playIdle(): void {
    this.sprite.play(`player-idle-${this.facing}`, true)
  }

  faceToward(targetTileX: number, targetTileY: number): void {
    const dx = targetTileX - this.tileX
    const dy = targetTileY - this.tileY
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left'
    } else {
      this.facing = dy > 0 ? 'down' : 'up'
    }
    this.playIdle()
  }

  get tileX(): number {
    return Math.round((this.sprite.x - TILE_SIZE / 2) / TILE_SIZE)
  }

  get tileY(): number {
    return Math.round((this.sprite.y - TILE_SIZE / 2) / TILE_SIZE)
  }
}
