import Phaser from 'phaser'
import { getAllSprites } from '@/data/sprites/SpriteRegistry'

const COLS = 4
const ROWS = 4
const TARGET_FRAME_W = 64
const TARGET_FRAME_H = 64

/**
 * After all sprite images are loaded (as plain images), convert each to
 * a 256x256 spritesheet (64x64 per frame, 4x4 grid). Sprites larger or
 * smaller than 256x256 are resized to fit.
 */
export function normalizeSpriteTextures(scene: Phaser.Scene): void {
  for (const sprite of getAllSprites()) {
    const tex = scene.textures.get(sprite.key)
    if (!tex || tex.key === '__MISSING') continue

    const source = tex.source[0]
    const srcW = source.width
    const srcH = source.height

    const targetW = TARGET_FRAME_W * COLS   // 256
    const targetH = TARGET_FRAME_H * ROWS   // 256

    // Draw onto a canvas (resize if needed)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    if (srcW === targetW && srcH === targetH) {
      ctx.drawImage(source.image as HTMLImageElement, 0, 0)
    } else {
      ctx.drawImage(source.image as HTMLImageElement, 0, 0, targetW, targetH)
    }

    // Replace texture: remove the plain image, add as canvas-based spritesheet
    scene.textures.remove(sprite.key)
    const canvasTex = scene.textures.addCanvas(sprite.key, canvas)
    if (canvasTex) {
      // Manually add spritesheet frames to the canvas texture
      const frameTotal = COLS * ROWS
      for (let i = 0; i < frameTotal; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        canvasTex.add(i, 0, col * TARGET_FRAME_W, row * TARGET_FRAME_H, TARGET_FRAME_W, TARGET_FRAME_H)
      }
    }
  }
}
