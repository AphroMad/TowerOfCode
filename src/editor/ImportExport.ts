import { type EditorState, MAP_W, MAP_H } from './EditorState'
import type { Direction, NPCData, StairData } from '@/data/types'

const AUTOSAVE_KEY = 'editor_autosave'
const AUTOSAVE_DEBOUNCE = 1000

/** Legacy numeric tile ID → new string key mapping */
const LEGACY_ID_MAP: Record<number, string> = {
  0: '',
  1: 'ground/basic/1',
  2: 'ground/basic/2',
  3: 'ground/basic/3',
  4: 'ground/basic/4',
  5: 'ground/basic/5',
  6: 'ground/basic/6',
  7: 'ground/basic/7',
  8: 'ground/basic/8',
  9: 'ground/basic/9',
  10: 'objects/rock',
  11: 'objects/collision_invisible',
}

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

      // Migrate legacy number[] layers to string[]
      const groundLayer = this.migrateLayer(data.groundLayer, MAP_W * MAP_H, '')
      const wallsLayer = this.migrateLayer(data.wallsLayer, MAP_W * MAP_H, '')

      this.state.loadState({
        floorId: data.floorId || 'floor-01',
        floorName: data.floorName || 'New Floor',
        groundLayer,
        wallsLayer,
        effectsLayer: data.effectsLayer || new Array(MAP_W * MAP_H).fill(0),
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

  /** Convert legacy number[] to string[], or pass through if already string[] */
  private migrateLayer(layer: unknown[] | undefined, size: number, fallback: string): string[] {
    if (!layer || !Array.isArray(layer)) return new Array(size).fill(fallback)
    if (layer.length === 0) return new Array(size).fill(fallback)

    // Detect legacy: first non-empty value is a number
    if (typeof layer[0] === 'number') {
      return (layer as number[]).map(id => LEGACY_ID_MAP[id] ?? '')
    }

    // Already string[]
    return layer as string[]
  }

  clearAll(): void {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('editor')) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  }

  // ── Export JSON (Tiled format) ──

  exportMapJson(): string {
    const d = this.state.snapshot

    // Collect all unique tile keys used across both layers
    const usedKeys = new Set<string>()
    for (const key of d.groundLayer) if (key !== '') usedKeys.add(key)
    for (const key of d.wallsLayer) if (key !== '') usedKeys.add(key)

    // Sort for deterministic GID assignment
    const sortedKeys = [...usedKeys].sort()

    // Assign GIDs: each tile key gets its own tileset entry with firstgid
    const keyToGid = new Map<string, number>()
    const tilesets: object[] = []
    let nextGid = 1

    for (const key of sortedKeys) {
      keyToGid.set(key, nextGid)
      tilesets.push({
        columns: 1,
        firstgid: nextGid,
        image: `../../assets/tilesets/${key}.png`,
        imageheight: 32,
        imagewidth: 32,
        margin: 0,
        name: key,
        spacing: 0,
        tilecount: 1,
        tileheight: 32,
        tilewidth: 32,
      })
      nextGid++
    }

    // Convert string layers to GID number layers
    const toGidLayer = (layer: readonly string[]): number[] =>
      layer.map(key => key === '' ? 0 : (keyToGid.get(key) ?? 0))

    const map = {
      compressionlevel: -1,
      height: MAP_H,
      width: MAP_W,
      infinite: false,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: 32,
      tileheight: 32,
      tiledversion: '1.10.2',
      type: 'map',
      version: '1.10',
      nextlayerid: 3,
      nextobjectid: 1,
      layers: [
        {
          data: toGidLayer(d.groundLayer),
          height: MAP_H,
          width: MAP_W,
          id: 1,
          name: 'Ground',
          opacity: 1,
          type: 'tilelayer',
          visible: true,
          x: 0,
          y: 0,
        },
        {
          data: toGidLayer(d.wallsLayer),
          height: MAP_H,
          width: MAP_W,
          id: 2,
          name: 'Walls',
          opacity: 1,
          type: 'tilelayer',
          visible: true,
          x: 0,
          y: 0,
        },
      ],
      tilesets,
    }

    return JSON.stringify(map, null, 2)
  }

  // ── Export TS (FloorData) ──

  exportFloorTs(): string {
    const d = this.state.snapshot
    const varName = d.floorId.replace(/-/g, '')
    const spawn = d.playerSpawn || { tileX: 10, tileY: 12, facing: 'up' }

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
      return `    { direction: '${s.direction}', tileX: ${s.tileX}, tileY: ${s.tileY}, targetFloorId: ${target} }`
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
  mapKey: '${d.floorId}',
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

  // ── Import JSON ──

  importMapJson(json: string): boolean {
    try {
      const map = JSON.parse(json)
      const groundData = map.layers?.find((l: { name: string }) => l.name === 'Ground')
      const wallsData = map.layers?.find((l: { name: string }) => l.name === 'Walls')

      // Build GID → key mapping from tilesets
      const gidToKey = new Map<number, string>()
      if (map.tilesets) {
        for (const ts of map.tilesets as { firstgid: number; name: string; tilecount: number }[]) {
          // Legacy format: tileset with tilecount > 1 (old spritesheet)
          if (ts.name === 'tileset' && ts.tilecount === 9) {
            for (let i = 0; i < 9; i++) {
              gidToKey.set(ts.firstgid + i, `ground/basic/${i + 1}`)
            }
          } else if (ts.name === 'rock') {
            gidToKey.set(ts.firstgid, 'objects/rock')
          } else if (ts.name === 'collision_invisible') {
            gidToKey.set(ts.firstgid, 'objects/collision_invisible')
          } else {
            // New format: name IS the tile key, tilecount=1
            gidToKey.set(ts.firstgid, ts.name)
          }
        }
      }

      const convertLayer = (data: number[] | undefined): string[] => {
        if (!data) return new Array(MAP_W * MAP_H).fill('')
        return data.map(gid => gid === 0 ? '' : (gidToKey.get(gid) ?? ''))
      }

      this.state.loadState({
        groundLayer: convertLayer(groundData?.data),
        wallsLayer: convertLayer(wallsData?.data),
      })
      return true
    } catch {
      return false
    }
  }

  // ── Import TS (best-effort regex parse) ──

  importFloorTs(text: string): boolean {
    try {
      const idMatch = text.match(/id:\s*'([^']+)'/)
      const nameMatch = text.match(/name:\s*'([^']+)'/)
      const spawnMatch = text.match(/playerStart:\s*\{\s*tileX:\s*(\d+),\s*tileY:\s*(\d+),\s*facing:\s*'(\w+)'/)

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
        const stairRegex = /\{[^}]*direction:\s*'(\w+)'[^}]*\}/g
        let match
        while ((match = stairRegex.exec(stairsBlockMatch[1])) !== null) {
          const block = match[0]
          const targetMatch = block.match(/targetFloorId:\s*(?:'([^']+)'|null)/)
          const stairX = this.extractNum(block, 'tileX')
          const stairY = this.extractNum(block, 'tileY')
          if (stairX >= 0 && stairX < MAP_W && stairY >= 0 && stairY < MAP_H) {
            stairs.push({
              direction: (this.extractStr(block, 'direction') || 'up') as 'up' | 'down',
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

  private extractStr(block: string, key: string): string | null {
    const m = block.match(new RegExp(`${key}:\\s*'([^']*)'`))
    return m ? m[1] : null
  }

  private extractNum(block: string, key: string): number {
    const m = block.match(new RegExp(`${key}:\\s*(-?\\d+)`))
    return m ? parseInt(m[1]) : NaN
  }

  // ── File download helpers ──

  downloadJson(): void {
    const json = this.exportMapJson()
    this.download(`${this.state.snapshot.floorId}.json`, json, 'application/json')
  }

  downloadTs(): void {
    const ts = this.exportFloorTs()
    this.download(`${this.state.snapshot.floorId}.ts`, ts, 'text/typescript')
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

  // ── File upload helpers ──

  promptImportJson(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      file.text().then(text => {
        if (!this.importMapJson(text)) {
          alert('Failed to parse JSON map file')
        }
      }).catch(() => alert('Failed to read file'))
    })
    input.click()
  }

  promptImportTs(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ts'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      file.text().then(text => {
        if (!this.importFloorTs(text)) {
          alert('Failed to parse TS floor file')
        }
      }).catch(() => alert('Failed to read file'))
    })
    input.click()
  }
}
