import Phaser from 'phaser'
import type { Direction, NPCData } from '@/data/types'
import { tileToPixel } from '@/utils/helpers'

// Same 4x4 layout as player: row 0=down, 1=left, 2=right, 3=up
const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 }

export class NPC {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly data: NPCData
  readonly animPrefix: string
  facing: Direction

  constructor(scene: Phaser.Scene, npcData: NPCData) {
    this.data = npcData
    this.animPrefix = (npcData.name || 'npc').toLowerCase().replace(/\s+/g, '-')
    this.facing = npcData.facing

    const row = DIR_ROW[npcData.facing]
    this.sprite = scene.add.sprite(
      tileToPixel(npcData.tileX),
      tileToPixel(npcData.tileY),
      npcData.spriteKey,
      row * 4 // idle frame for this direction
    )
    this.sprite.setOrigin(0.5, 0.75)
    this.createAnimations(scene)
  }

  private createAnimations(scene: Phaser.Scene): void {
    const dirs: Direction[] = ['down', 'left', 'right', 'up']
    dirs.forEach(dir => {
      const row = DIR_ROW[dir]
      const base = row * 4

      // Walk: step-L → idle → step-R → idle (same layout as player)
      const walkKey = `${this.animPrefix}-walk-${dir}`
      if (!scene.anims.exists(walkKey)) {
        scene.anims.create({
          key: walkKey,
          frames: [
            { key: this.data.spriteKey, frame: base + 1 },
            { key: this.data.spriteKey, frame: base },
            { key: this.data.spriteKey, frame: base + 3 },
            { key: this.data.spriteKey, frame: base },
          ],
          frameRate: 8,
          repeat: -1,
        })
      }

      // Idle: standing frame
      const idleKey = `${this.animPrefix}-idle-${dir}`
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: [{ key: this.data.spriteKey, frame: base }],
          frameRate: 1,
        })
      }
    })
  }

  faceDirection(dir: Direction): void {
    this.facing = dir
    this.sprite.play(`${this.animPrefix}-idle-${dir}`, true)
  }

  facePlayer(playerTileX: number, playerTileY: number): void {
    const dx = playerTileX - this.data.tileX
    const dy = playerTileY - this.data.tileY

    if (Math.abs(dx) > Math.abs(dy)) {
      this.faceDirection(dx > 0 ? 'right' : 'left')
    } else {
      this.faceDirection(dy > 0 ? 'down' : 'up')
    }
  }

  /** Walk one tile in a direction (tween-based). Resolves when movement finishes. */
  walkToTile(scene: Phaser.Scene, tileX: number, tileY: number): Promise<void> {
    const dx = tileX - this.data.tileX
    const dy = tileY - this.data.tileY
    let dir: Direction
    if (dx > 0) dir = 'right'
    else if (dx < 0) dir = 'left'
    else if (dy > 0) dir = 'down'
    else dir = 'up'

    this.facing = dir
    this.sprite.play(`${this.animPrefix}-walk-${dir}`, true)

    return new Promise(resolve => {
      scene.tweens.add({
        targets: this.sprite,
        x: tileToPixel(tileX),
        y: tileToPixel(tileY),
        duration: 200,
        ease: 'Linear',
        onComplete: () => {
          this.data.tileX = tileX
          this.data.tileY = tileY
          this.faceDirection(dir) // back to idle
          resolve()
        },
      })
    })
  }
}
