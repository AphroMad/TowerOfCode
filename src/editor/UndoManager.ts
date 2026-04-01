import type { EditorState } from './EditorState'
import type { HeartPickupData, NPCData, PushableBlockData, StairData, TeleportData } from '@/data/types'

interface Snapshot {
  mapWidth: number
  mapHeight: number
  groundLayer: string[]
  wallsLayer: string[]
  wallsCollision: boolean[]
  effectsLayer: number[]
  playerSpawn: { tileX: number; tileY: number; facing: string } | null
  npcs: NPCData[]
  stairs: StairData[]
  teleports: TeleportData[]
  blocks: PushableBlockData[]
  hearts: HeartPickupData[]
  startingHp: number
}

const MAX_HISTORY = 50

export class UndoManager {
  private history: Snapshot[] = []
  private pointer = -1
  private state: EditorState

  constructor(state: EditorState) {
    this.state = state
    this.save()
  }

  private snapshot(): Snapshot {
    const d = this.state.snapshot
    return {
      mapWidth: d.mapWidth,
      mapHeight: d.mapHeight,
      groundLayer: [...d.groundLayer],
      wallsLayer: [...d.wallsLayer],
      wallsCollision: [...d.wallsCollision],
      effectsLayer: [...d.effectsLayer],
      playerSpawn: d.playerSpawn ? { ...d.playerSpawn } : null,
      npcs: d.npcs.map(n => ({
        ...n,
        lookoutPattern: n.lookoutPattern ? [...n.lookoutPattern] : undefined,
        patrolPath: n.patrolPath ? n.patrolPath.map(p => ({ ...p })) : undefined,
      })),
      stairs: d.stairs.map(s => ({ ...s })),
      teleports: d.teleports.map(t => ({ ...t })),
      blocks: d.blocks.map(b => ({ ...b })),
      hearts: d.hearts.map(h => ({ ...h })),
      startingHp: d.startingHp,
    }
  }

  save(): void {
    // Remove any redo states ahead of pointer
    this.history = this.history.slice(0, this.pointer + 1)
    this.history.push(this.snapshot())
    if (this.history.length > MAX_HISTORY) {
      this.history.shift()
    }
    this.pointer = this.history.length - 1
  }

  undo(): boolean {
    if (this.pointer <= 0) return false
    this.pointer--
    this.restore(this.history[this.pointer])
    return true
  }

  redo(): boolean {
    if (this.pointer >= this.history.length - 1) return false
    this.pointer++
    this.restore(this.history[this.pointer])
    return true
  }

  private restore(snap: Snapshot): void {
    this.state.mutateWithoutNotify(d => {
      d.mapWidth = snap.mapWidth
      d.mapHeight = snap.mapHeight
      d.groundLayer = [...snap.groundLayer]
      d.wallsLayer = [...snap.wallsLayer]
      d.wallsCollision = [...snap.wallsCollision]
      d.effectsLayer = [...snap.effectsLayer]
      d.playerSpawn = snap.playerSpawn ? { ...snap.playerSpawn } as typeof d.playerSpawn : null
      d.npcs = snap.npcs.map(n => ({
        ...n,
        lookoutPattern: n.lookoutPattern ? [...n.lookoutPattern] : undefined,
        patrolPath: n.patrolPath ? n.patrolPath.map(p => ({ ...p })) : undefined,
      }))
      d.stairs = snap.stairs.map(s => ({ ...s }))
      d.teleports = snap.teleports.map(t => ({ ...t }))
      d.blocks = snap.blocks.map(b => ({ ...b }))
      d.hearts = snap.hearts.map(h => ({ ...h }))
      d.startingHp = snap.startingHp
    })
    this.state.deselectEntity() // emits
  }
}
