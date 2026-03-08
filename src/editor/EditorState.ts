import type { Direction, NPCData, StairData } from '@/data/types'

export const MAP_W = 20
export const MAP_H = 15

export type Tool = 'brush' | 'eraser' | 'entity'
export type LayerName = 'ground' | 'walls' | 'entities' | 'effects'
export type EntityType = 'player' | 'npc' | 'stair'

export interface PlayerSpawn {
  tileX: number
  tileY: number
  facing: Direction
}

export interface EditorData {
  floorId: string
  floorName: string

  groundLayer: string[]   // tile keys, "" = empty
  wallsLayer: string[]    // tile keys, "" = empty
  effectsLayer: number[]  // 0=none, 1=ice, 2=redirect-down, 3=redirect-up, 4=redirect-left, 5=redirect-right

  activeLayer: LayerName
  activeTool: Tool
  selectedTileKey: string   // for ground/walls layers
  selectedEffectId: number  // for effects layer

  groundVisible: boolean
  wallsVisible: boolean
  entitiesVisible: boolean
  effectsVisible: boolean

  playerSpawn: PlayerSpawn | null
  npcs: NPCData[]
  stairs: StairData[]

  selectedEntityType: EntityType | null
  selectedEntityIndex: number // -1 = none

  // Entity placement mode: which kind to place next
  placingEntity: EntityType | null

  zoom: number
  hoverTile: { x: number; y: number } | null
}

type Listener = () => void

export class EditorState {
  private _data: EditorData
  private listeners: Listener[] = []

  constructor() {
    this._data = this.defaultState()
  }

  /** Read-only view of current state */
  get snapshot(): Readonly<EditorData> {
    return this._data
  }

  /** @deprecated Use snapshot for reads, mutate() for writes */
  get data(): EditorData {
    return this._data
  }

  /** Mutate state and emit change notification */
  mutate(fn: (data: EditorData) => void): void {
    fn(this._data)
    this.emit()
  }

  /** Mutate state without emitting (for perf-sensitive updates like hover) */
  mutateQuiet(fn: (data: EditorData) => void): void {
    fn(this._data)
  }

  private defaultState(): EditorData {
    return {
      floorId: 'floor-03',
      floorName: 'New Floor',
      groundLayer: new Array(MAP_W * MAP_H).fill(''),
      wallsLayer: new Array(MAP_W * MAP_H).fill(''),
      effectsLayer: new Array(MAP_W * MAP_H).fill(0),
      activeLayer: 'ground',
      activeTool: 'brush',
      selectedTileKey: 'ground/basic/2',
      selectedEffectId: 1,
      groundVisible: true,
      wallsVisible: true,
      entitiesVisible: true,
      effectsVisible: true,
      playerSpawn: null,
      npcs: [],
      stairs: [],
      selectedEntityType: null,
      selectedEntityIndex: -1,
      placingEntity: null,
      zoom: 1,
      hoverTile: null,
    }
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn)
  }

  emit(): void {
    for (const fn of this.listeners) fn()
  }

  getActiveLayerData(): string[] | number[] {
    if (this._data.activeLayer === 'ground') return this._data.groundLayer
    if (this._data.activeLayer === 'effects') return this._data.effectsLayer
    return this._data.wallsLayer
  }

  setTile(x: number, y: number, value: string | number): void {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return
    const idx = y * MAP_W + x
    const d = this._data
    if (d.activeLayer === 'ground') {
      d.groundLayer[idx] = value as string
    } else if (d.activeLayer === 'walls') {
      d.wallsLayer[idx] = value as string
    } else if (d.activeLayer === 'effects') {
      d.effectsLayer[idx] = value as number
    }
  }

  getTile(layer: LayerName, x: number, y: number): string | number {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return ''
    const idx = y * MAP_W + x
    if (layer === 'ground') return this._data.groundLayer[idx]
    if (layer === 'walls') return this._data.wallsLayer[idx]
    if (layer === 'effects') return this._data.effectsLayer[idx]
    return ''
  }

  findEntityAt(x: number, y: number): { type: EntityType; index: number } | null {
    if (this._data.playerSpawn && this._data.playerSpawn.tileX === x && this._data.playerSpawn.tileY === y) {
      return { type: 'player', index: 0 }
    }
    for (let i = 0; i < this._data.npcs.length; i++) {
      if (this._data.npcs[i].tileX === x && this._data.npcs[i].tileY === y) {
        return { type: 'npc', index: i }
      }
    }
    for (let i = 0; i < this._data.stairs.length; i++) {
      if (this._data.stairs[i].tileX === x && this._data.stairs[i].tileY === y) {
        return { type: 'stair', index: i }
      }
    }
    return null
  }

  selectEntity(type: EntityType | null, index: number): void {
    this._data.selectedEntityType = type
    this._data.selectedEntityIndex = index
    this.emit()
  }

  deselectEntity(): void {
    this._data.selectedEntityType = null
    this._data.selectedEntityIndex = -1
    this._data.placingEntity = null
    this.emit()
  }

  loadState(partial: Partial<EditorData>): void {
    Object.assign(this._data, partial)
    this.emit()
  }

  reset(): void {
    this._data = this.defaultState()
    this.emit()
  }
}
