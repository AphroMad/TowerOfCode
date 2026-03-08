import type { EditorState } from './EditorState'
import type { NPCData, StairData } from '@/data/types'

interface Snapshot {
  groundLayer: string[]
  wallsLayer: string[]
  effectsLayer: number[]
  playerSpawn: { tileX: number; tileY: number; facing: string } | null
  npcs: NPCData[]
  stairs: StairData[]
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
      groundLayer: [...d.groundLayer],
      wallsLayer: [...d.wallsLayer],
      effectsLayer: [...d.effectsLayer],
      playerSpawn: d.playerSpawn ? { ...d.playerSpawn } : null,
      npcs: d.npcs.map(n => ({
        ...n,
        lookoutPattern: n.lookoutPattern ? [...n.lookoutPattern] : undefined,
        patrolPath: n.patrolPath ? n.patrolPath.map(p => ({ ...p })) : undefined,
      })),
      stairs: d.stairs.map(s => ({ ...s })),
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
    this.state.mutateQuiet(d => {
      d.groundLayer = [...snap.groundLayer]
      d.wallsLayer = [...snap.wallsLayer]
      d.effectsLayer = [...snap.effectsLayer]
      d.playerSpawn = snap.playerSpawn ? { ...snap.playerSpawn } as typeof d.playerSpawn : null
      d.npcs = snap.npcs.map(n => ({
        ...n,
        lookoutPattern: n.lookoutPattern ? [...n.lookoutPattern] : undefined,
        patrolPath: n.patrolPath ? n.patrolPath.map(p => ({ ...p })) : undefined,
      }))
      d.stairs = snap.stairs.map(s => ({ ...s }))
    })
    this.state.deselectEntity() // emits
  }
}
