export interface TileDef {
  key: string       // e.g. "ground/basic/1", "objects/rock"
  url: string       // Vite-resolved URL (hashed in prod)
  category: string  // "ground" | "objects"
  folder: string    // "basic", "redBrick", etc.
  label: string     // human-readable from filename
  animFrames?: string[]  // all frame keys in order (only set on _f1)
  isAnimFrame?: boolean  // true for _f2, _f3, etc. (hidden from palette)
}

// Auto-discover all tile PNGs at build/dev time
const raw = import.meta.glob(
  '/src/assets/tilesets/**/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const PREFIX = '/src/assets/tilesets/'
const tiles: TileDef[] = []

for (const [path, url] of Object.entries(raw)) {
  // path = "/src/assets/tilesets/ground/basic/1.png"
  const relative = path.replace(PREFIX, '').replace(/\.png$/, '')
  // relative = "ground/basic/1"

  const parts = relative.split('/')
  const category = parts[0]
  const folder = parts.length > 2 ? parts.slice(1, -1).join('/') : category
  const filename = parts[parts.length - 1]

  const label = filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  tiles.push({ key: relative, url, category, folder, label })
}

// Sort for deterministic ordering
tiles.sort((a, b) => a.key.localeCompare(b.key))

// Group animation frames: files ending with _f1, _f2, _f3, etc.
const FRAME_RE = /^(.+)_f(\d+)$/
const animGroups = new Map<string, { frameNum: number; tile: TileDef }[]>()

for (const tile of tiles) {
  const filename = tile.key.split('/').pop()!
  const match = filename.match(FRAME_RE)
  if (match) {
    const baseName = tile.key.replace(/_f\d+$/, '')
    if (!animGroups.has(baseName)) animGroups.set(baseName, [])
    animGroups.get(baseName)!.push({ frameNum: parseInt(match[2], 10), tile })
  }
}

for (const [, frames] of animGroups) {
  if (frames.length < 2) continue
  frames.sort((a, b) => a.frameNum - b.frameNum)
  const allKeys = frames.map(f => f.tile.key)
  // _f1 gets the frame list and stays visible; others are hidden
  for (let i = 0; i < frames.length; i++) {
    if (i === 0) {
      frames[i].tile.animFrames = allKeys
      // Clean up the label: remove "F1" suffix
      frames[i].tile.label = frames[i].tile.label.replace(/\s*F\d+$/i, '') + ' (anim)'
    } else {
      frames[i].tile.isAnimFrame = true
    }
  }
}

export function getAllTiles(): readonly TileDef[] {
  return tiles
}

export function getTilesByCategory(category: string, includeHiddenFrames = true): TileDef[] {
  return tiles.filter(t => t.category === category && (includeHiddenFrames || !t.isAnimFrame))
}

export function getAnimatedTileDefs(): TileDef[] {
  return tiles.filter(t => t.animFrames && t.animFrames.length > 1)
}

export function getFolders(category: string): string[] {
  const set = new Set<string>()
  for (const t of tiles) {
    if (t.category === category) set.add(t.folder)
  }
  return [...set]
}
