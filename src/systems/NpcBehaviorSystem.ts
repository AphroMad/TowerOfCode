import Phaser from 'phaser'
import type { NPC } from '@/entities/NPC'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { Player } from '@/entities/Player'
import type { Direction } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'

const DIR_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

interface NpcState {
  npc: NPC
  detecting: boolean       // currently in detection sequence
  hasDetected: boolean     // already triggered once — no more auto-detect
  // Lookout
  lookoutTimer: number     // elapsed time in current direction
  lookoutIndex: number     // current index in lookoutPattern
  // Patrol
  patrolIndex: number      // current waypoint index
  patrolMoving: boolean    // currently tweening between waypoints
  patrolForward: boolean   // direction through waypoints
}

export class NpcBehaviorSystem {
  private scene: Phaser.Scene
  private grid: GridMovementSystem
  private player: Player
  private states: NpcState[] = []
  private mapWidth: number
  private mapHeight: number
  private frozen = false
  private pendingResumeHandlers: Array<() => void> = []

  constructor(
    scene: Phaser.Scene,
    npcs: NPC[],
    grid: GridMovementSystem,
    player: Player,
  ) {
    this.scene = scene
    this.grid = grid
    this.player = player
    this.mapWidth = grid.mapWidth
    this.mapHeight = grid.mapHeight

    for (const npc of npcs) {
      if (!npc.data.behavior || npc.data.behavior === 'static' || npc.data.behavior === 'gatekeeper') continue
      this.states.push({
        npc,
        detecting: false,
        hasDetected: false,
        lookoutTimer: 0,
        lookoutIndex: 0,
        patrolIndex: 0,
        patrolMoving: false,
        patrolForward: true,
      })
    }

    // Clean up any pending resume handlers on scene shutdown
    scene.events.on('shutdown', () => {
      for (const handler of this.pendingResumeHandlers) {
        this.scene.events.off('resume', handler)
      }
      this.pendingResumeHandlers = []
    })
  }

  update(delta: number): void {
    if (this.frozen) return
    const save = SaveManager.getInstance()
    for (const state of this.states) {
      if (state.detecting) continue

      const { npc } = state

      // Skip behavior if this NPC's challenge is already completed
      if (npc.data.challengeId && save.isChallengeCompleted(npc.data.challengeId)) continue

      // After detection+dialog, stop all behavior (no more lookout/patrol)
      if (state.hasDetected) continue

      if (npc.data.behavior === 'lookout') {
        this.updateLookout(state, delta)
      } else if (npc.data.behavior === 'patrol') {
        this.updatePatrol(state, delta)
      }

      // Check line of sight (only if never triggered before)
      if (!state.detecting && !state.hasDetected && !state.patrolMoving) {
        this.checkLineOfSight(state)
      }
    }
  }

  private checkLineOfSight(state: NpcState): void {
    const { npc } = state
    const facing = npc.facing
    const off = DIR_OFFSETS[facing]
    const playerTile = this.grid.getPlayerTile()

    let tx = npc.data.tileX + off.dx
    let ty = npc.data.tileY + off.dy

    while (tx >= 0 && tx < this.mapWidth && ty >= 0 && ty < this.mapHeight) {
      // Hit a wall — stop looking
      if (this.grid.isWallAt(tx, ty)) break

      // Found the player
      if (tx === playerTile.x && ty === playerTile.y) {
        this.triggerDetection(state)
        return
      }

      // Other NPCs / blocks obstruct line of sight
      if (this.grid.isBlocked(tx, ty)) break

      tx += off.dx
      ty += off.dy
    }
  }

  private async triggerDetection(state: NpcState): Promise<void> {
    state.detecting = true
    this.frozen = true  // freeze all NPC behavior while detection plays out
    const { npc } = state

    // Freeze input, let current move finish smoothly
    this.grid.freeze()
    await this.grid.waitForMove()

    // Now player is on a clean tile — face each other
    const playerTile = this.grid.getPlayerTile()
    this.player.faceToward(npc.data.tileX, npc.data.tileY)
    npc.facePlayer(playerTile.x, playerTile.y)

    // Show "!" speech bubble above NPC
    npc.showBubble(this.scene, '!')

    // Brief pause so the player sees the "!"
    await this.delay(500)

    // Pop the bubble away before walking
    await npc.popBubble(this.scene)

    // Unblock original tile
    this.grid.unblockTile(npc.data.tileX, npc.data.tileY)

    // Walk tile-by-tile toward player (stop 1 tile away)
    await this.stepToward(npc, playerTile.x, playerTile.y)

    // Block new tile
    this.grid.blockTile(npc.data.tileX, npc.data.tileY)

    // Face each other before dialog
    npc.facePlayer(playerTile.x, playerTile.y)
    this.player.faceToward(npc.data.tileX, npc.data.tileY)

    // Trigger dialog
    this.scene.events.emit('npc-interact', npc)

    // Unfreeze after dialog closes — NPC won't auto-detect again
    const onResume = () => {
      this.grid.unfreeze()
      this.frozen = false  // resume all NPC behavior
      state.detecting = false
      state.hasDetected = true

      this.scene.events.off('resume', onResume)
      const idx = this.pendingResumeHandlers.indexOf(onResume)
      if (idx >= 0) this.pendingResumeHandlers.splice(idx, 1)
    }
    this.pendingResumeHandlers.push(onResume)
    this.scene.events.on('resume', onResume)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve))
  }

  private async stepToward(npc: NPC, targetX: number, targetY: number): Promise<void> {
    const maxSteps = this.mapWidth + this.mapHeight // safety limit
    for (let step = 0; step < maxSteps; step++) {
      const dx = targetX - npc.data.tileX
      const dy = targetY - npc.data.tileY

      // Adjacent to player — stop
      if (Math.abs(dx) + Math.abs(dy) <= 1) break

      // Determine next tile (prefer axis with larger distance)
      let nextX = npc.data.tileX
      let nextY = npc.data.tileY
      if (Math.abs(dx) >= Math.abs(dy)) {
        nextX += dx > 0 ? 1 : -1
      } else {
        nextY += dy > 0 ? 1 : -1
      }

      // Check if next tile is blocked (not the player's tile)
      if (this.grid.isBlocked(nextX, nextY) && !(nextX === targetX && nextY === targetY)) {
        break // Path blocked, stop here
      }

      await npc.walkToTile(this.scene, nextX, nextY)
    }
  }

  /** Freeze all NPC behavior (detection, lookout, patrol) */
  freeze(): void {
    this.frozen = true
  }

  /** Mark an NPC as already detected (prevents re-detection after manual interaction) */
  markDetected(npc: NPC): void {
    const state = this.states.find(s => s.npc === npc)
    if (state) state.hasDetected = true
  }

  // ── Lookout ──

  private updateLookout(state: NpcState, delta: number): void {
    const pattern = state.npc.data.lookoutPattern
    if (!pattern || pattern.length === 0) return

    const tempo = (state.npc.data.lookoutTempo ?? 2) * 1000 // to ms
    state.lookoutTimer += delta

    if (state.lookoutTimer >= tempo) {
      state.lookoutTimer -= tempo
      state.lookoutIndex = (state.lookoutIndex + 1) % pattern.length
      state.npc.faceDirection(pattern[state.lookoutIndex])
    }
  }

  // ── Patrol ──

  private updatePatrol(state: NpcState, _delta: number): void {
    const path = state.npc.data.patrolPath
    if (!path || path.length === 0 || state.patrolMoving) return

    // Check LOS before moving (only if not already triggered)
    if (!state.hasDetected) {
      this.checkLineOfSight(state)
      if (state.detecting) return
    }

    // Move to next waypoint
    state.patrolMoving = true
    const target = path[state.patrolIndex]
    this.walkPatrolStep(state, target.x, target.y)
  }

  private async walkPatrolStep(state: NpcState, targetX: number, targetY: number): Promise<void> {
    const { npc } = state

    // Walk tile-by-tile toward the waypoint
    const maxSteps = this.mapWidth + this.mapHeight
    for (let step = 0; step < maxSteps; step++) {
      if (npc.data.tileX === targetX && npc.data.tileY === targetY) break
      if (state.detecting || this.frozen) break

      const dx = targetX - npc.data.tileX
      const dy = targetY - npc.data.tileY
      let nextX = npc.data.tileX
      let nextY = npc.data.tileY
      if (Math.abs(dx) >= Math.abs(dy)) {
        nextX += dx > 0 ? 1 : -1
      } else {
        nextY += dy > 0 ? 1 : -1
      }

      // Skip if blocked
      if (this.grid.isBlocked(nextX, nextY)) break

      this.grid.unblockTile(npc.data.tileX, npc.data.tileY)
      await npc.walkToTile(this.scene, nextX, nextY)
      this.grid.blockTile(npc.data.tileX, npc.data.tileY)

      // Check LOS after each step (only if not already triggered once)
      if (!state.detecting && !state.hasDetected) {
        this.checkLineOfSight(state)
        if (state.detecting) break
      }
    }

    state.patrolMoving = false

    // Advance waypoint index (loop)
    if (!state.detecting) {
      const path = npc.data.patrolPath!
      if (state.patrolForward) {
        state.patrolIndex++
        if (state.patrolIndex >= path.length) {
          state.patrolIndex = path.length - 2
          state.patrolForward = false
          if (state.patrolIndex < 0) state.patrolIndex = 0
        }
      } else {
        state.patrolIndex--
        if (state.patrolIndex < 0) {
          state.patrolIndex = 1
          state.patrolForward = true
          if (state.patrolIndex >= path.length) state.patrolIndex = 0
        }
      }
    }
  }
}
