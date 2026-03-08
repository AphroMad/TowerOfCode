import { getAllTiles } from '@/data/tiles/TileRegistry'

const cache = new Map<string, HTMLImageElement>()
let loadPromise: Promise<void> | null = null

/** Load all tile images once. Subsequent calls return the cached promise. */
export function loadAllTileImages(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = Promise.all(
    getAllTiles().map(
      tile =>
        new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            cache.set(tile.key, img)
            resolve()
          }
          img.onerror = () => reject(new Error(`Failed to load tile: ${tile.url}`))
          img.src = tile.url
        }),
    ),
  ).then(() => {})

  return loadPromise
}

/** Get a previously loaded tile image by key. */
export function getTileImage(key: string): HTMLImageElement | undefined {
  return cache.get(key)
}
