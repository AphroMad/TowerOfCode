import type { Direction, TileEffectData } from '@/data/types'

/**
 * Handles tile-level collision queries: wall checks, blocked tiles,
 * passable walls, and tile effects. No scene dependency — pure data.
 */
export class TileChecker {
  private wallLayer: Phaser.Tilemaps.TilemapLayer
  private blockedTiles = new Set<string>()
  private passableWalls = new Set<string>()
  private tileEffects = new Map<string, TileEffectData>()

  constructor(wallLayer: Phaser.Tilemaps.TilemapLayer) {
    this.wallLayer = wallLayer
  }

  get mapWidth(): number {
    return this.wallLayer.layer.width
  }

  get mapHeight(): number {
    return this.wallLayer.layer.height
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

  removeTileEffect(tileX: number, tileY: number): void {
    this.tileEffects.delete(`${tileX},${tileY}`)
  }

  getEffect(tileX: number, tileY: number): TileEffectData | undefined {
    return this.tileEffects.get(`${tileX},${tileY}`)
  }

  isBlockedTile(key: string): boolean {
    return this.blockedTiles.has(key)
  }

  /** Check if a tile has a wall (non-empty tile on wall layer, respects passable overrides) */
  isWallAt(tileX: number, tileY: number): boolean {
    const { width: mapWidth, height: mapHeight } = this.wallLayer.layer
    if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) return true
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
    const tile = this.wallLayer.getTileAt(tileX, tileY)
    return tile !== null
  }

  /** Full blocked check: wall, NPC, block, out of bounds, ledge effect */
  isTileBlocked(tileX: number, tileY: number, moveDir?: Direction): boolean {
    const effect = this.tileEffects.get(`${tileX},${tileY}`)
    if (effect?.effect === 'ledge') {
      return moveDir !== effect.direction
    }

    if (this.blockedTiles.has(`${tileX},${tileY}`)) return true
    const { width: mapWidth, height: mapHeight } = this.wallLayer.layer
    if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) return true
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
    const tile = this.wallLayer.getTileAt(tileX, tileY)
    if (tile !== null) return true
    return false
  }
}
