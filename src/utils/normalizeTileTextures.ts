import Phaser from 'phaser'
import { getAllTiles } from '@/data/tiles/TileRegistry'

const TILE_SIZE = 32

/**
 * After all tile images are loaded, check each one and upscale to 32x32
 * if the source image is smaller (e.g. 16x16). This ensures Phaser's
 * tilemap renderer can display them correctly in the 32x32 grid.
 */
export function normalizeTileTextures(scene: Phaser.Scene): void {
  for (const tile of getAllTiles()) {
    const tex = scene.textures.get(tile.key)
    if (!tex || tex.key === '__MISSING') continue

    const source = tex.source[0]
    const w = source.width
    const h = source.height

    if (w === TILE_SIZE && h === TILE_SIZE) continue

    // Upscale: draw onto a 32x32 canvas and replace the texture
    const canvas = document.createElement('canvas')
    canvas.width = TILE_SIZE
    canvas.height = TILE_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(source.image as HTMLImageElement, 0, 0, TILE_SIZE, TILE_SIZE)

    scene.textures.remove(tile.key)
    scene.textures.addCanvas(tile.key, canvas)
  }
}
