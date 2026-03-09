import { TILE_SIZE } from '@/config/game.config'

export function tileToPixel(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2
}
