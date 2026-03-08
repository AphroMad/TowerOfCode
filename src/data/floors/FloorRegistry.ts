import type { FloorData } from '@/data/types'

const modules = import.meta.glob('./floor-*.ts', { eager: true }) as Record<
  string,
  Record<string, FloorData>
>

const floorMap = new Map<string, FloorData>()
for (const mod of Object.values(modules)) {
  // Each floor file exports a named const (e.g. export const floor01)
  for (const val of Object.values(mod)) {
    if (val && typeof val === 'object' && 'id' in val) {
      floorMap.set(val.id, val)
    }
  }
}

export function getFloorById(id: string): FloorData | undefined {
  return floorMap.get(id)
}

export function getAllFloorIds(): string[] {
  return [...floorMap.keys()]
}
