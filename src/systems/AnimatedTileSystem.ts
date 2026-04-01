import type Phaser from 'phaser'
import { getAnimatedTileDefs } from '@/data/tiles/TileRegistry'

interface TileRef {
  layer: Phaser.Tilemaps.TilemapLayer
  x: number
  y: number
}

interface AnimEntry {
  frameGids: number[]
  currentFrame: number
  /** Pre-built index: tiles using ANY frame GID of this animation */
  tiles: TileRef[]
}

const DEFAULT_FRAME_DURATION = 350 // ms per frame

export class AnimatedTileSystem {
  private entries: AnimEntry[] = []
  private elapsed = 0
  private frameDuration: number

  constructor(
    layers: Phaser.Tilemaps.TilemapLayer[],
    keyToGid: Map<string, number>,
    frameDuration = DEFAULT_FRAME_DURATION,
  ) {
    this.frameDuration = frameDuration

    for (const def of getAnimatedTileDefs()) {
      if (!def.animFrames) continue
      const frameGids = def.animFrames
        .map(k => keyToGid.get(k))
        .filter((g): g is number => g !== undefined)
      if (frameGids.length > 1) {
        // Build spatial index: find all tiles that currently use any GID in this animation
        const gidSet = new Set(frameGids)
        const tiles: TileRef[] = []
        for (const layer of layers) {
          layer.forEachTile(tile => {
            if (gidSet.has(tile.index)) {
              tiles.push({ layer, x: tile.x, y: tile.y })
            }
          })
        }
        this.entries.push({ frameGids, currentFrame: 0, tiles })
      }
    }
  }

  update(delta: number): void {
    if (this.entries.length === 0) return

    this.elapsed += delta
    if (this.elapsed < this.frameDuration) return
    this.elapsed -= this.frameDuration

    for (const entry of this.entries) {
      entry.currentFrame = (entry.currentFrame + 1) % entry.frameGids.length
      const nextGid = entry.frameGids[entry.currentFrame]

      for (const ref of entry.tiles) {
        const tile = ref.layer.getTileAt(ref.x, ref.y)
        if (tile) tile.index = nextGid
      }
    }
  }
}
