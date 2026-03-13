export interface SpriteDef {
  key: string   // e.g. "player", "npc", "profPi"
  url: string   // Vite-resolved URL
}

// Auto-discover all sprite PNGs at build/dev time
const raw = import.meta.glob(
  '/src/assets/sprites/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const sprites: SpriteDef[] = []

for (const [path, url] of Object.entries(raw)) {
  const key = path.replace('/src/assets/sprites/', '').replace(/\.png$/, '')
  sprites.push({ key, url })
}

sprites.sort((a, b) => a.key.localeCompare(b.key))

export function getAllSprites(): readonly SpriteDef[] {
  return sprites
}

export function getSpriteKeys(): string[] {
  return sprites.map(s => s.key)
}
