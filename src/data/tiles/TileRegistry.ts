export interface TileDef {
  key: string       // e.g. "ground/basic/1", "objects/rock"
  url: string       // Vite-resolved URL (hashed in prod)
  category: string  // "ground" | "objects"
  folder: string    // "basic", "redBrick", etc.
  label: string     // human-readable from filename
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

export function getAllTiles(): readonly TileDef[] {
  return tiles
}

export function getTilesByCategory(category: string): TileDef[] {
  return tiles.filter(t => t.category === category)
}

export function getFolders(category: string): string[] {
  const set = new Set<string>()
  for (const t of tiles) {
    if (t.category === category) set.add(t.folder)
  }
  return [...set]
}
