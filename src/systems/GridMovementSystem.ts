import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { TILE_SIZE, PLAYER_MOVE_SPEED } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'
import type { Direction } from '@/data/types'

export class GridMovementSystem {
  private player: Player
  private scene: Phaser.Scene
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private isMoving = false
  private wallLayer: Phaser.Tilemaps.TilemapLayer
  private blockedTiles: Set<string>

  constructor(
    scene: Phaser.Scene,
    player: Player,
    wallLayer: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.scene = scene
    this.player = player
    this.wallLayer = wallLayer
    this.cursors = scene.input.keyboard!.createCursorKeys()
    this.blockedTiles = new Set()
  }

  blockTile(tileX: number, tileY: number): void {
    this.blockedTiles.add(`${tileX},${tileY}`)
  }

  unblockTile(tileX: number, tileY: number): void {
    this.blockedTiles.delete(`${tileX},${tileY}`)
  }

  get moving(): boolean {
    return this.isMoving
  }

  update(): void {
    if (this.isMoving) return

    let dir: Direction | null = null
    let dx = 0
    let dy = 0

    if (this.cursors.down.isDown) { dir = 'down'; dy = 1 }
    else if (this.cursors.up.isDown) { dir = 'up'; dy = -1 }
    else if (this.cursors.left.isDown) { dir = 'left'; dx = -1 }
    else if (this.cursors.right.isDown) { dir = 'right'; dx = 1 }

    if (dir === null) {
      this.player.playIdle()
      return
    }

    this.player.facing = dir

    const targetTileX = this.player.tileX + dx
    const targetTileY = this.player.tileY + dy

    if (this.isTileBlocked(targetTileX, targetTileY)) {
      this.player.playIdle()
      return
    }

    this.isMoving = true
    this.player.playWalk(dir)

    const targetX = tileToPixel(targetTileX)
    const targetY = tileToPixel(targetTileY)
    const distance = TILE_SIZE
    const duration = (distance / PLAYER_MOVE_SPEED) * 1000

    this.scene.tweens.add({
      targets: this.player.sprite,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false
      },
    })
  }

  private isTileBlocked(tileX: number, tileY: number): boolean {
    if (this.blockedTiles.has(`${tileX},${tileY}`)) return true
    // Block movement outside map bounds
    const mapWidth = this.wallLayer.layer.width
    const mapHeight = this.wallLayer.layer.height
    if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) return true
    // Block on non-empty wall tiles
    const tile = this.wallLayer.getTileAt(tileX, tileY)
    return tile !== null
  }

  getPlayerTile(): { x: number; y: number } {
    return { x: this.player.tileX, y: this.player.tileY }
  }

  getFacingTile(): { x: number; y: number } {
    const offsets: Record<Direction, { x: number; y: number }> = {
      down: { x: 0, y: 1 },
      up: { x: 0, y: -1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }
    const off = offsets[this.player.facing]
    return {
      x: this.player.tileX + off.x,
      y: this.player.tileY + off.y,
    }
  }
}
