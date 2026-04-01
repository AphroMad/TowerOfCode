import type Phaser from 'phaser'
import type { Direction } from '@/data/types'

export const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 }

/**
 * Create walk + idle animations for all 4 directions using the standard
 * 4x4 spritesheet layout (4 cols per row: idle, step-L, idle, step-R).
 */
export function createDirectionalAnimations(
  scene: Phaser.Scene,
  spriteKey: string,
  prefix: string,
): void {
  const dirs: Direction[] = ['down', 'left', 'right', 'up']
  for (const dir of dirs) {
    const base = DIR_ROW[dir] * 4

    const walkKey = `${prefix}-${dir}`
    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [
          { key: spriteKey, frame: base + 1 },
          { key: spriteKey, frame: base },
          { key: spriteKey, frame: base + 3 },
          { key: spriteKey, frame: base },
        ],
        frameRate: 8,
        repeat: -1,
      })
    }

    const idleKey = `${prefix}-idle-${dir}`
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: [{ key: spriteKey, frame: base }],
        frameRate: 1,
      })
    }
  }
}

/** Create a tiny circle texture for dust particles (idempotent). */
export function ensureDustTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('dust')) return
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false)
  gfx.fillStyle(0xffffff, 1)
  gfx.fillCircle(3, 3, 3)
  gfx.generateTexture('dust', 6, 6)
  gfx.destroy()
}

/** Create a tiny diamond texture for sparkle particles (idempotent). */
export function ensureSparkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('sparkle')) return
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false)
  gfx.fillStyle(0xffffff, 1)
  gfx.fillRect(2, 0, 2, 6)
  gfx.fillRect(0, 2, 6, 2)
  gfx.generateTexture('sparkle', 6, 6)
  gfx.destroy()
}
