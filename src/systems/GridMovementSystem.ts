import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { TILE_SIZE, PLAYER_MOVE_SPEED } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'
import type { Direction, TileEffectData } from '@/data/types'

export class GridMovementSystem {
  private player: Player
  private scene: Phaser.Scene
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private isMoving = false
  private isFrozen = false
  private wallLayer: Phaser.Tilemaps.TilemapLayer
  private blockedTiles: Set<string>
  private passableWalls: Set<string> = new Set()
  private tileEffects: Map<string, TileEffectData> = new Map()
  private lastDirection: Direction = 'down'
  private isSliding = false
  private pushBlockCallback: ((blockTileX: number, blockTileY: number, dir: Direction) => boolean) | null = null

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

  setPassableWalls(tiles: Set<string>): void {
    this.passableWalls = tiles
  }

  setTileEffects(effects: TileEffectData[]): void {
    this.tileEffects.clear()
    for (const e of effects) {
      this.tileEffects.set(`${e.tileX},${e.tileY}`, e)
    }
  }

  setPushBlockCallback(cb: (blockTileX: number, blockTileY: number, dir: Direction) => boolean): void {
    this.pushBlockCallback = cb
  }

  removeTileEffect(tileX: number, tileY: number): void {
    this.tileEffects.delete(`${tileX},${tileY}`)
  }

  get moving(): boolean {
    return this.isMoving
  }

  get sliding(): boolean {
    return this.isSliding
  }

  freeze(): void {
    this.isFrozen = true
  }

  unfreeze(): void {
    this.isFrozen = false
  }

  /** Returns a promise that resolves once any in-progress move finishes */
  waitForMove(): Promise<void> {
    if (!this.isMoving) return Promise.resolve()
    return new Promise(resolve => {
      const check = () => {
        if (!this.isMoving) resolve()
        else this.scene.time.delayedCall(16, check)
      }
      check()
    })
  }

  get frozen(): boolean {
    return this.isFrozen
  }

  get mapWidth(): number {
    return this.wallLayer.layer.width
  }

  get mapHeight(): number {
    return this.wallLayer.layer.height
  }

  /** Check if a tile has a wall (non-empty tile on wall layer, respects passable overrides) */
  isWallAt(tileX: number, tileY: number): boolean {
    const mapWidth = this.wallLayer.layer.width
    const mapHeight = this.wallLayer.layer.height
    if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) return true
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
    const tile = this.wallLayer.getTileAt(tileX, tileY)
    return tile !== null
  }

  /** Check if a tile is blocked (wall, NPC, or out of bounds) */
  isBlocked(tileX: number, tileY: number): boolean {
    return this.isTileBlocked(tileX, tileY)
  }

  update(): void {
    if (this.isMoving || this.isFrozen) return

    let dir: Direction | null = null

    if (this.cursors.down.isDown) dir = 'down'
    else if (this.cursors.up.isDown) dir = 'up'
    else if (this.cursors.left.isDown) dir = 'left'
    else if (this.cursors.right.isDown) dir = 'right'

    if (dir === null) {
      this.player.playIdle()
      return
    }

    this.player.facing = dir
    this.executeMove(dir)
  }

  private executeMove(dir: Direction): void {
    const offsets: Record<Direction, { x: number; y: number }> = {
      down: { x: 0, y: 1 },
      up: { x: 0, y: -1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }
    const off = offsets[dir]
    const targetTileX = this.player.tileX + off.x
    const targetTileY = this.player.tileY + off.y

    const targetKey = `${targetTileX},${targetTileY}`
    const isBlockedTile = this.blockedTiles.has(targetKey)
    const targetEffect = this.tileEffects.get(targetKey)
    const isHole = targetEffect?.effect === 'hole'

    if (isBlockedTile && this.pushBlockCallback) {
      // Target has something in blockedTiles — try pushing (may be a block or NPC)
      const pushed = this.pushBlockCallback(targetTileX, targetTileY, dir)
      if (!pushed) {
        // Not a block, or push destination blocked
        this.isSliding = false
        this.isMoving = false
        this.player.playIdle()
        return
      }
      // Block was pushed — fall through to move player into the now-clear tile
    } else if (isHole || this.isTileBlocked(targetTileX, targetTileY)) {
      // Hole (no block on it) or wall/OOB
      this.isSliding = false
      this.isMoving = false
      this.player.playIdle()
      return
    }

    this.isMoving = true
    this.lastDirection = dir
    this.player.facing = dir
    if (!this.isSliding) this.player.playWalk(dir)
    else this.player.playIdle()

    const targetX = tileToPixel(targetTileX)
    const targetY = tileToPixel(targetTileY)
    const duration = (TILE_SIZE / PLAYER_MOVE_SPEED) * 1000

    this.scene.tweens.add({
      targets: this.player.sprite,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.processLandingEffect()
      },
    })
  }

  private processLandingEffect(): void {
    const key = `${this.player.tileX},${this.player.tileY}`
    const effect = this.tileEffects.get(key)

    if (effect?.effect === 'ice') {
      this.isSliding = true
      this.executeMove(this.lastDirection)
      return
    }

    if (effect?.effect === 'redirect' && effect.direction) {
      this.isSliding = true
      this.executeMove(effect.direction)
      return
    }

    // No effect — stop
    this.isSliding = false
    this.isMoving = false
  }

  private isTileBlocked(tileX: number, tileY: number): boolean {
    if (this.blockedTiles.has(`${tileX},${tileY}`)) return true
    // Block movement outside map bounds
    const mapWidth = this.wallLayer.layer.width
    const mapHeight = this.wallLayer.layer.height
    if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) return true
    // Passable wall overrides
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
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
