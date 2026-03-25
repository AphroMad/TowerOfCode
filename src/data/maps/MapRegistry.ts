import type { MapData } from '@/data/types'

const modules = import.meta.glob('./map-*.ts', { eager: true }) as Record<
  string,
  Record<string, MapData>
>

const mapRegistry = new Map<string, MapData>()
for (const mod of Object.values(modules)) {
  // Each map file exports a named const (e.g. export const map01)
  for (const val of Object.values(mod)) {
    if (val && typeof val === 'object' && 'id' in val) {
      mapRegistry.set(val.id, val)
    }
  }
}

export function getMapById(id: string): MapData | undefined {
  return mapRegistry.get(id)
}

export function getAllMapIds(): string[] {
  return [...mapRegistry.keys()]
}
