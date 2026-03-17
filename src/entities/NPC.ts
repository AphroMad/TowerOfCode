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
  private bubble?: Phaser.GameObjects.Container

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

  /** Show a speech bubble above this NPC with the given text ("!" or "...") */
  showBubble(scene: Phaser.Scene, text: '!' | '...', animate = true): void {
    this.hideBubble()

    const isExclaim = text === '!'
    const fontSize = isExclaim ? 16 : 12
    const padX = isExclaim ? 8 : 6
    const padY = isExclaim ? 4 : 3
    const tailH = 5

    // High-res text so it's crisp on retina / zoomed cameras
    const res = Math.max(2, window.devicePixelRatio)
    const label = scene.add.text(0, 0, text, {
      fontSize: `${fontSize}px`,
      color: isExclaim ? '#ff3333' : '#444444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      resolution: res,
    }).setOrigin(0.5)

    const bw = label.width + padX * 2
    const bh = label.height + padY * 2
    const radius = 4

    // Bubble + tail as one continuous shape
    const gfx = scene.add.graphics()
    const l = -bw / 2, r = bw / 2, t = -bh / 2, b = bh / 2
    const tw = 4 // tail half-width

    // Fill
    gfx.fillStyle(0xffffff, 1)
    gfx.beginPath()
    gfx.moveTo(l + radius, t)
    gfx.lineTo(r - radius, t)
    gfx.arc(r - radius, t + radius, radius, -Math.PI / 2, 0)
    gfx.lineTo(r, b - radius)
    gfx.arc(r - radius, b - radius, radius, 0, Math.PI / 2)
    gfx.lineTo(tw, b)
    gfx.lineTo(0, b + tailH)
    gfx.lineTo(-tw, b)
    gfx.lineTo(l + radius, b)
    gfx.arc(l + radius, b - radius, radius, Math.PI / 2, Math.PI)
    gfx.lineTo(l, t + radius)
    gfx.arc(l + radius, t + radius, radius, Math.PI, -Math.PI / 2)
    gfx.closePath()
    gfx.fillPath()

    // Stroke (same path)
    gfx.lineStyle(1.5, 0x333333, 1)
    gfx.beginPath()
    gfx.moveTo(l + radius, t)
    gfx.lineTo(r - radius, t)
    gfx.arc(r - radius, t + radius, radius, -Math.PI / 2, 0)
    gfx.lineTo(r, b - radius)
    gfx.arc(r - radius, b - radius, radius, 0, Math.PI / 2)
    gfx.lineTo(tw, b)
    gfx.lineTo(0, b + tailH)
    gfx.lineTo(-tw, b)
    gfx.lineTo(l + radius, b)
    gfx.arc(l + radius, b - radius, radius, Math.PI / 2, Math.PI)
    gfx.lineTo(l, t + radius)
    gfx.arc(l + radius, t + radius, radius, Math.PI, -Math.PI / 2)
    gfx.closePath()
    gfx.strokePath()

    const offsetY = -(bh / 2 + tailH + 14)
    this.bubble = scene.add.container(this.sprite.x, this.sprite.y + offsetY, [gfx, label])
    this.bubble.setDepth(99999)

    if (animate) {
      // Pop-in animation
      this.bubble.setScale(0)
      scene.tweens.add({
        targets: this.bubble,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Back.easeOut',
      })
    }
  }

  /** Remove the speech bubble */
  hideBubble(): void {
    if (!this.bubble) return
    this.bubble.destroy()
    this.bubble = undefined
  }

  /** Animate the bubble away, then destroy it. Returns a promise. */
  popBubble(scene: Phaser.Scene): Promise<void> {
    if (!this.bubble) return Promise.resolve()
    return new Promise(resolve => {
      scene.tweens.add({
        targets: this.bubble,
        scaleX: 0,
        scaleY: 0,
        duration: 120,
        ease: 'Back.easeIn',
        onComplete: () => {
          this.hideBubble()
          resolve()
        },
      })
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
