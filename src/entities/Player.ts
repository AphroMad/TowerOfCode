import Phaser from 'phaser'
import type { Direction } from '@/data/types'
import { TILE_SIZE } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'

// Spritesheet layout (4 cols x 4 rows, 64x64 per frame):
//   Row 0 (frames 0-3):  down  — idle, step-L, idle, step-R
//   Row 1 (frames 4-7):  left  — idle, step-L, idle, step-R
//   Row 2 (frames 8-11): right — idle, step-L, idle, step-R
//   Row 3 (frames 12-15): up   — idle, step-L, idle, step-R

const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 }

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
    this.createAnimations(scene)
  }

  private createAnimations(scene: Phaser.Scene): void {
    const dirs: Direction[] = ['down', 'left', 'right', 'up']
    dirs.forEach(dir => {
      const row = DIR_ROW[dir]
      const base = row * 4

      // Walk animation: idle → step-L → idle → step-R (4-frame loop)
      const walkKey = `player-${dir}`
      if (!scene.anims.exists(walkKey)) {
        scene.anims.create({
          key: walkKey,
          frames: [
            { key: 'player', frame: base + 1 },
            { key: 'player', frame: base },
            { key: 'player', frame: base + 3 },
            { key: 'player', frame: base },
          ],
          frameRate: 8,
          repeat: -1,
        })
      }

      // Idle: just the standing frame
      const idleKey = `player-idle-${dir}`
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: [{ key: 'player', frame: base }],
          frameRate: 1,
        })
      }
    })
  }

  playWalk(dir: Direction): void {
    this.facing = dir
    this.sprite.play(`player-${dir}`, true)
  }

  playIdle(): void {
    this.sprite.play(`player-idle-${this.facing}`, true)
  }

  get tileX(): number {
    return Math.round((this.sprite.x - TILE_SIZE / 2) / TILE_SIZE)
  }

  get tileY(): number {
    return Math.round((this.sprite.y - TILE_SIZE / 2) / TILE_SIZE)
  }
}
