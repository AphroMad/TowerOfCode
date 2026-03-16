import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '@/config/game.config'
import type { Direction, NPCData, PushableBlockData, StairData, TeleportData } from '@/data/types'

export type Tool = 'brush' | 'eraser' | 'entity' | 'mover'
export type LayerName = 'ground' | 'walls' | 'entities' | 'effects'
export type EntityType = 'player' | 'npc' | 'stair' | 'teleport' | 'block'

export interface PlayerSpawn {
  tileX: number
  tileY: number
  facing: Direction
}

export interface EditorData {
  floorId: string
  floorName: string
  mapWidth: number
  mapHeight: number

  groundLayer: string[]   // tile keys, "" = empty
  wallsLayer: string[]    // tile keys, "" = empty
  wallsCollision: boolean[] // per-tile collision flag, true = blocks movement
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
  teleports: TeleportData[]
  blocks: PushableBlockData[]

  selectedEntityType: EntityType | null
  selectedEntityIndex: number // -1 = none

  // Entity placement mode: which kind to place next
  placingEntity: EntityType | null

  // Selected wall tile (walls layer only)
  selectedWallTile: { x: number; y: number } | null

  zoom: number
  hoverTile: { x: number; y: number } | null
}

type Listener = () => void

export class EditorState {
  private _data: EditorData
  private listeners: Listener[] = []

  // Per-layer tile key cache (so switching layers doesn't cross-contaminate)
  private _groundKey = 'ground/basic/2'
  private _wallsKey = ''

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
    const prevLayer = this._data.activeLayer
    fn(this._data)
    // Auto-sync per-layer selected tile key on layer change
    if (this._data.activeLayer !== prevLayer) {
      // Save current key for previous layer
      if (prevLayer === 'ground') this._groundKey = this._data.selectedTileKey
      else if (prevLayer === 'walls') this._wallsKey = this._data.selectedTileKey
      // Restore key for new layer
      if (this._data.activeLayer === 'ground') this._data.selectedTileKey = this._groundKey
      else if (this._data.activeLayer === 'walls') this._data.selectedTileKey = this._wallsKey
    }
    this.emit()
  }

  /** Mutate state without emitting (for perf-sensitive updates like hover) */
  mutateQuiet(fn: (data: EditorData) => void): void {
    fn(this._data)
  }

  private defaultState(): EditorData {
    const w = MAP_WIDTH_TILES
    const h = MAP_HEIGHT_TILES
    return {
      floorId: 'floor-03',
      floorName: 'New Floor',
      mapWidth: w,
      mapHeight: h,
      groundLayer: new Array(w * h).fill(''),
      wallsLayer: new Array(w * h).fill(''),
      wallsCollision: new Array(w * h).fill(true),
      effectsLayer: new Array(w * h).fill(0),
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
      teleports: [],
      blocks: [],
      selectedEntityType: null,
      selectedEntityIndex: -1,
      placingEntity: null,
      selectedWallTile: null,
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
    const { mapWidth, mapHeight } = this._data
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return
    const idx = y * mapWidth + x
    const d = this._data
    if (d.activeLayer === 'ground') {
      d.groundLayer[idx] = value as string
    } else if (d.activeLayer === 'walls') {
      d.wallsLayer[idx] = value as string
      if (value === '') d.wallsCollision[idx] = true
    } else if (d.activeLayer === 'effects') {
      d.effectsLayer[idx] = value as number
    }
  }

  getTile(layer: LayerName, x: number, y: number): string | number {
    const { mapWidth, mapHeight } = this._data
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return ''
    const idx = y * mapWidth + x
    if (layer === 'ground') return this._data.groundLayer[idx]
    if (layer === 'walls') return this._data.wallsLayer[idx]
    if (layer === 'effects') return this._data.effectsLayer[idx]
    return ''
  }

  toggleWallCollision(x: number, y: number): void {
    const { mapWidth, mapHeight } = this._data
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return
    const idx = y * mapWidth + x
    if (this._data.wallsLayer[idx] === '') return
    this._data.wallsCollision[idx] = !this._data.wallsCollision[idx]
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
    for (let i = 0; i < this._data.teleports.length; i++) {
      if (this._data.teleports[i].tileX === x && this._data.teleports[i].tileY === y) {
        return { type: 'teleport', index: i }
      }
    }
    for (let i = 0; i < this._data.blocks.length; i++) {
      if (this._data.blocks[i].tileX === x && this._data.blocks[i].tileY === y) {
        return { type: 'block', index: i }
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

  /** Check if shrinking to newW x newH would lose any data (tiles, entities) */
  wouldResizeLoseData(newW: number, newH: number): boolean {
    const d = this._data
    const oldW = d.mapWidth
    const oldH = d.mapHeight
    newW = Math.max(1, Math.round(newW))
    newH = Math.max(1, Math.round(newH))

    // Only check if shrinking
    if (newW >= oldW && newH >= oldH) return false

    // Check tiles in the area being removed
    const checkLayer = (layer: (string | number | boolean)[], empty: string | number | boolean): boolean => {
      for (let y = 0; y < oldH; y++) {
        for (let x = 0; x < oldW; x++) {
          if (x >= newW || y >= newH) {
            if (layer[y * oldW + x] !== empty) return true
          }
        }
      }
      return false
    }

    if (checkLayer(d.groundLayer, '')) return true
    if (checkLayer(d.wallsLayer, '')) return true
    if (checkLayer(d.effectsLayer, 0)) return true

    // Check entities
    if (d.playerSpawn && (d.playerSpawn.tileX >= newW || d.playerSpawn.tileY >= newH)) return true
    if (d.npcs.some(n => n.tileX >= newW || n.tileY >= newH)) return true
    if (d.stairs.some(s => s.tileX >= newW || s.tileY >= newH)) return true
    if (d.teleports.some(t => t.tileX >= newW || t.tileY >= newH)) return true
    if (d.blocks.some(b => b.tileX >= newW || b.tileY >= newH)) return true

    return false
  }

  /** Resize map, preserving existing tile data in the overlap region */
  resize(newW: number, newH: number): void {
    const d = this._data
    const oldW = d.mapWidth
    const oldH = d.mapHeight

    if (newW === oldW && newH === oldH) return
    newW = Math.max(1, Math.round(newW))
    newH = Math.max(1, Math.round(newH))

    const resizeLayer = <T>(old: T[], fill: T): T[] => {
      const arr = new Array<T>(newW * newH).fill(fill)
      const copyW = Math.min(oldW, newW)
      const copyH = Math.min(oldH, newH)
      for (let y = 0; y < copyH; y++) {
        for (let x = 0; x < copyW; x++) {
          arr[y * newW + x] = old[y * oldW + x]
        }
      }
      return arr
    }

    d.groundLayer = resizeLayer(d.groundLayer, '')
    d.wallsLayer = resizeLayer(d.wallsLayer, '')
    d.wallsCollision = resizeLayer(d.wallsCollision, true)
    d.effectsLayer = resizeLayer(d.effectsLayer, 0)

    // Clamp or remove entities outside new bounds
    if (d.playerSpawn && (d.playerSpawn.tileX >= newW || d.playerSpawn.tileY >= newH)) {
      d.playerSpawn = null
    }
    d.npcs = d.npcs.filter(n => n.tileX < newW && n.tileY < newH)
    d.stairs = d.stairs.filter(s => s.tileX < newW && s.tileY < newH)
    d.teleports = d.teleports.filter(t => t.tileX < newW && t.tileY < newH)
    d.blocks = d.blocks.filter(b => b.tileX < newW && b.tileY < newH)

    // Clamp patrol paths
    for (const npc of d.npcs) {
      if (npc.patrolPath) {
        npc.patrolPath = npc.patrolPath.filter(p => p.x < newW && p.y < newH)
      }
    }

    d.mapWidth = newW
    d.mapHeight = newH
    d.selectedEntityType = null
    d.selectedEntityIndex = -1
    d.selectedWallTile = null

    this.emit()
  }

  reset(): void {
    this._data = this.defaultState()
    this.emit()
  }
}
