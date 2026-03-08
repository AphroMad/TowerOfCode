import { type EditorState, MAP_W, MAP_H } from './EditorState'
import type { Direction, NPCData, StairData } from '@/data/types'

const AUTOSAVE_KEY = 'editor_autosave'
const AUTOSAVE_DEBOUNCE = 1000

export class ImportExport {
  private state: EditorState
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(state: EditorState) {
    this.state = state
    state.onChange(() => this.scheduleAutosave())
  }

  destroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
  }

  // ── Autosave (single slot in localStorage) ──

  private scheduleAutosave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.autosave(), AUTOSAVE_DEBOUNCE)
  }

  private autosave(): void {
    const d = this.state.snapshot
    const payload = {
      floorId: d.floorId,
      floorName: d.floorName,
      groundLayer: d.groundLayer,
      wallsLayer: d.wallsLayer,
      effectsLayer: d.effectsLayer,
      playerSpawn: d.playerSpawn,
      npcs: d.npcs,
      stairs: d.stairs,
    }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))
  }

  loadAutosave(): boolean {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return false
    try {
      const data = JSON.parse(raw)
      const size = MAP_W * MAP_H

      this.state.loadState({
        floorId: data.floorId || 'floor-01',
        floorName: data.floorName || 'New Floor',
        groundLayer: Array.isArray(data.groundLayer) ? data.groundLayer : new Array(size).fill(''),
        wallsLayer: Array.isArray(data.wallsLayer) ? data.wallsLayer : new Array(size).fill(''),
        effectsLayer: data.effectsLayer || new Array(size).fill(0),
        playerSpawn: data.playerSpawn || null,
        npcs: (data.npcs || []).map((n: Record<string, unknown>) => ({
          ...n,
          name: n.name || n.npcId || 'NPC',
        })),
        stairs: data.stairs || [],
      })
      return true
    } catch {
      return false
    }
  }

  clearAll(): void {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('editor')) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  }

  // ── Export TS (FloorData — single file with everything) ──

  exportFloorTs(): string {
    const d = this.state.snapshot
    const varName = d.floorId.replace(/-/g, '')
    const spawn = d.playerSpawn || { tileX: 10, tileY: 12, facing: 'up' }

    // Format tile layers (20 items per row)
    const formatLayer = (layer: readonly string[]): string => {
      const rows: string[] = []
      for (let row = 0; row < MAP_H; row++) {
        const start = row * MAP_W
        const items = layer.slice(start, start + MAP_W).map(k => `'${k}'`)
        rows.push('    ' + items.join(', ') + ',')
      }
      return rows.join('\n')
    }

    const npcStr = d.npcs.map(n => {
      const fields: string[] = [
        `      name: '${n.name}'`,
        `      tileX: ${n.tileX}`,
        `      tileY: ${n.tileY}`,
        `      spriteKey: '${n.spriteKey}'`,
        `      facing: '${n.facing}'`,
        `      behavior: '${n.behavior}'`,
      ]
      if (n.dialogKey) fields.push(`      dialogKey: '${n.dialogKey}'`)
      if (n.challengeId) fields.push(`      challengeId: '${n.challengeId}'`)
      if (n.behavior === 'lookout' && n.lookoutPattern?.length) {
        fields.push(`      lookoutPattern: [${n.lookoutPattern.map(d => `'${d}'`).join(', ')}]`)
        if (n.lookoutTempo !== undefined) fields.push(`      lookoutTempo: ${n.lookoutTempo}`)
      }
      if (n.behavior === 'patrol' && n.patrolPath?.length) {
        fields.push(`      patrolPath: [${n.patrolPath.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ')}]`)
      }
      return `    {\n${fields.join(',\n')},\n    }`
    }).join(',\n')

    const stairStr = d.stairs.map(s => {
      const target = s.targetFloorId ? `'${s.targetFloorId}'` : 'null'
      return `    { tileX: ${s.tileX}, tileY: ${s.tileY}, targetFloorId: ${target} }`
    }).join(',\n')

    const required = d.npcs
      .map(n => n.challengeId)
      .filter((id): id is string => !!id)
      .map(id => `    '${id}'`)
      .join(',\n')

    // Build tileEffects from effectsLayer
    const effectIdToType: Record<number, { effect: string; direction?: string }> = {
      1: { effect: 'ice' },
      2: { effect: 'redirect', direction: 'down' },
      3: { effect: 'redirect', direction: 'up' },
      4: { effect: 'redirect', direction: 'left' },
      5: { effect: 'redirect', direction: 'right' },
    }
    const effects: string[] = []
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const eid = d.effectsLayer[y * MAP_W + x]
        const info = effectIdToType[eid]
        if (!info) continue
        const dirPart = info.direction ? `, direction: '${info.direction}'` : ''
        effects.push(`    { tileX: ${x}, tileY: ${y}, effect: '${info.effect}'${dirPart} }`)
      }
    }
    const effectsStr = effects.join(',\n')

    const tileEffectsBlock = effects.length
      ? `  tileEffects: [\n${effectsStr}\n  ],\n`
      : ''

    return `import type { FloorData } from '@/data/types'

export const ${varName}: FloorData = {
  id: '${d.floorId}',
  name: '${d.floorName}',
  groundLayer: [
${formatLayer(d.groundLayer)}
  ],
  wallsLayer: [
${formatLayer(d.wallsLayer)}
  ],
  playerStart: { tileX: ${spawn.tileX}, tileY: ${spawn.tileY}, facing: '${spawn.facing}' },
  npcs: [
${npcStr}
  ],
  requiredChallenges: [
${required}
  ],
${tileEffectsBlock}  stairs: [
${stairStr}
  ],
}
`
  }

  // ── Import TS (best-effort regex parse) ──

  importFloorTs(text: string): boolean {
    try {
      const idMatch = text.match(/id:\s*'([^']+)'/)
      const nameMatch = text.match(/name:\s*'([^']+)'/)
      const spawnMatch = text.match(/playerStart:\s*\{\s*tileX:\s*(\d+),\s*tileY:\s*(\d+),\s*facing:\s*'(\w+)'/)

      // Parse tile layers
      const groundLayer = this.parseStringArray(text, 'groundLayer')
      const wallsLayer = this.parseStringArray(text, 'wallsLayer')

      const npcsBlockMatch = text.match(/npcs:\s*\[([\s\S]*?)\]\s*,\s*(?:requiredChallenges|stairs)/)
      const npcs: NPCData[] = []
      if (npcsBlockMatch) {
        const npcRegex = /\{[^}]*name:\s*'([^']+)'[^}]*\}/g
        let match
        while ((match = npcRegex.exec(npcsBlockMatch[1])) !== null) {
          const block = match[0]
          const npc: NPCData = {
            name: this.extractStr(block, 'name') || 'NPC',
            tileX: this.extractNum(block, 'tileX'),
            tileY: this.extractNum(block, 'tileY'),
            spriteKey: this.extractStr(block, 'spriteKey') || 'npc',
            facing: (this.extractStr(block, 'facing') || 'down') as NPCData['facing'],
            behavior: (this.extractStr(block, 'behavior') || 'static') as NPCData['behavior'],
          }
          const dialogKey = this.extractStr(block, 'dialogKey')
          if (dialogKey) npc.dialogKey = dialogKey
          const challengeId = this.extractStr(block, 'challengeId')
          if (challengeId) npc.challengeId = challengeId
          // Lookout fields
          const patternMatch = block.match(/lookoutPattern:\s*\[([^\]]*)\]/)
          if (patternMatch) {
            npc.lookoutPattern = [...patternMatch[1].matchAll(/'(\w+)'/g)].map(m => m[1] as NPCData['facing'])
          }
          const tempo = this.extractNum(block, 'lookoutTempo')
          if (!isNaN(tempo)) npc.lookoutTempo = tempo
          // Patrol path
          const pathMatch = block.match(/patrolPath:\s*\[([\s\S]*?)\]/)
          if (pathMatch) {
            npc.patrolPath = [...pathMatch[1].matchAll(/x:\s*(\d+),\s*y:\s*(\d+)/g)].map(m => ({
              x: parseInt(m[1]),
              y: parseInt(m[2]),
            }))
          }
          // Bounds check
          if (npc.tileX >= 0 && npc.tileX < MAP_W && npc.tileY >= 0 && npc.tileY < MAP_H) {
            npcs.push(npc)
          }
        }
      }

      const stairsBlockMatch = text.match(/stairs:\s*\[([\s\S]*?)\]\s*,?\s*\}/)
      const stairs: StairData[] = []
      if (stairsBlockMatch) {
        const stairRegex = /\{[^}]*tileX:\s*\d+[^}]*\}/g
        let match
        while ((match = stairRegex.exec(stairsBlockMatch[1])) !== null) {
          const block = match[0]
          const targetMatch = block.match(/targetFloorId:\s*(?:'([^']+)'|null)/)
          const stairX = this.extractNum(block, 'tileX')
          const stairY = this.extractNum(block, 'tileY')
          if (stairX >= 0 && stairX < MAP_W && stairY >= 0 && stairY < MAP_H) {
            stairs.push({
              tileX: stairX,
              tileY: stairY,
              targetFloorId: targetMatch?.[1] || null,
            })
          }
        }
      }

      // Parse tileEffects into effectsLayer
      const effectsLayer = new Array(MAP_W * MAP_H).fill(0)
      const effectTypeToId: Record<string, Record<string, number>> = {
        ice: { '': 1 },
        redirect: { down: 2, up: 3, left: 4, right: 5 },
      }
      const effectsBlockMatch = text.match(/tileEffects:\s*\[([\s\S]*?)\]\s*,/)
      if (effectsBlockMatch) {
        const entryRegex = /\{[^}]*effect:\s*'(\w+)'[^}]*\}/g
        let ematch
        while ((ematch = entryRegex.exec(effectsBlockMatch[1])) !== null) {
          const block = ematch[0]
          const effectType = ematch[1]
          const ex = this.extractNum(block, 'tileX')
          const ey = this.extractNum(block, 'tileY')
          const dir = this.extractStr(block, 'direction') || ''
          const mapping = effectTypeToId[effectType]
          if (mapping && ex >= 0 && ex < MAP_W && ey >= 0 && ey < MAP_H) {
            effectsLayer[ey * MAP_W + ex] = mapping[dir] ?? mapping[''] ?? 0
          }
        }
      }

      this.state.loadState({
        floorId: idMatch?.[1] || this.state.snapshot.floorId,
        floorName: nameMatch?.[1] || this.state.snapshot.floorName,
        groundLayer,
        wallsLayer,
        playerSpawn: spawnMatch ? {
          tileX: parseInt(spawnMatch[1]),
          tileY: parseInt(spawnMatch[2]),
          facing: spawnMatch[3] as Direction,
        } : this.state.snapshot.playerSpawn as typeof this.state.snapshot.playerSpawn,
        npcs,
        stairs,
        effectsLayer,
      })
      return true
    } catch {
      return false
    }
  }

  /** Parse a named string[] field from TS source (e.g. groundLayer: ['a', 'b', ...]) */
  private parseStringArray(text: string, fieldName: string): string[] {
    const regex = new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]\\s*,`)
    const match = text.match(regex)
    if (!match) return new Array(MAP_W * MAP_H).fill('')
    // Extract all quoted strings (handles both '' and 'value')
    const items = [...match[1].matchAll(/'([^']*)'/g)].map(m => m[1])
    // Pad or truncate to expected size
    const size = MAP_W * MAP_H
    if (items.length >= size) return items.slice(0, size)
    return [...items, ...new Array(size - items.length).fill('')]
  }

  private extractStr(block: string, key: string): string | null {
    const m = block.match(new RegExp(`${key}:\\s*'([^']*)'`))
    return m ? m[1] : null
  }

  private extractNum(block: string, key: string): number {
    const m = block.match(new RegExp(`${key}:\\s*(-?\\d+)`))
    return m ? parseInt(m[1]) : NaN
  }

  // ── File download / upload ──

  downloadFloor(): void {
    const ts = this.exportFloorTs()
    this.download(`${this.state.snapshot.floorId}.ts`, ts, 'text/typescript')
  }

  promptImport(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ts'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      file.text().then(text => {
        if (!this.importFloorTs(text)) {
          alert('Failed to parse floor file')
        }
      }).catch(() => alert('Failed to read file'))
    })
    input.click()
  }

  private download(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
