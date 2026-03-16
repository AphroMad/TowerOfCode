import type Phaser from 'phaser'
import { getAnimatedTileDefs } from '@/data/tiles/TileRegistry'

interface AnimEntry {
  frameGids: number[]
  currentFrame: number
}

const DEFAULT_FRAME_DURATION = 350 // ms per frame

export class AnimatedTileSystem {
  private entries: AnimEntry[] = []
  private layers: Phaser.Tilemaps.TilemapLayer[]
  private elapsed = 0
  private frameDuration: number

  constructor(
    layers: Phaser.Tilemaps.TilemapLayer[],
    keyToGid: Map<string, number>,
    frameDuration = DEFAULT_FRAME_DURATION,
  ) {
    this.layers = layers
    this.frameDuration = frameDuration

    for (const def of getAnimatedTileDefs()) {
      if (!def.animFrames) continue
      const frameGids = def.animFrames
        .map(k => keyToGid.get(k))
        .filter((g): g is number => g !== undefined)
      if (frameGids.length > 1) {
        this.entries.push({ frameGids, currentFrame: 0 })
      }
    }
  }

  update(delta: number): void {
    if (this.entries.length === 0) return

    this.elapsed += delta
    if (this.elapsed < this.frameDuration) return
    this.elapsed -= this.frameDuration

    for (const entry of this.entries) {
      const prevGid = entry.frameGids[entry.currentFrame]
      entry.currentFrame = (entry.currentFrame + 1) % entry.frameGids.length
      const nextGid = entry.frameGids[entry.currentFrame]

      for (const layer of this.layers) {
        layer.forEachTile(tile => {
          if (tile.index === prevGid) {
            tile.index = nextGid
          }
        })
      }
    }
  }
}
