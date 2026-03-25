import { TILE_SIZE } from '@/config/game.config'
import type { Direction } from '@/data/types'

export function tileToPixel(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2
}

export const DIR_OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
