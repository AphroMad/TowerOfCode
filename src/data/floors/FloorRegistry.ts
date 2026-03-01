import type { FloorData } from '@/data/types'
import { floor01 } from './floor-01'
import { floor02 } from './floor-02'

const floors: FloorData[] = [floor01, floor02]

const floorMap = new Map<string, FloorData>()
for (const f of floors) floorMap.set(f.id, f)

export function getFloorById(id: string): FloorData | undefined {
  return floorMap.get(id)
}
