import type { EditorState } from './EditorState'
import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '@/config/game.config'
import type { Direction, HeartPickupData, NPCData, PushableBlockData, StairData, TeleportData } from '@/data/types'

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
      mapId: d.mapId,
      mapName: d.mapName,
      mapWidth: d.mapWidth,
      mapHeight: d.mapHeight,
      groundLayer: d.groundLayer,
      wallsLayer: d.wallsLayer,
      wallsCollision: d.wallsCollision,
      effectsLayer: d.effectsLayer,
      playerSpawn: d.playerSpawn,
      npcs: d.npcs,
      stairs: d.stairs,
      teleports: d.teleports,
      blocks: d.blocks,
      hearts: d.hearts,
      startingHp: d.startingHp,
    }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))
  }

  loadAutosave(): boolean {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return false
    try {
      const data = JSON.parse(raw)
      const w = data.mapWidth || MAP_WIDTH_TILES
      const h = data.mapHeight || MAP_HEIGHT_TILES
      const size = w * h

      // Migration: handle old floorId/floorName keys from previous autosaves
      const mapId = data.mapId || data.floorId || 'map-01'
      const mapName = data.mapName || data.floorName || 'New Map'

      this.state.loadState({
        mapId,
        mapName,
        mapWidth: w,
        mapHeight: h,
        groundLayer: Array.isArray(data.groundLayer) ? data.groundLayer : new Array(size).fill(''),
        wallsLayer: Array.isArray(data.wallsLayer) ? data.wallsLayer : new Array(size).fill(''),
        wallsCollision: Array.isArray(data.wallsCollision) ? data.wallsCollision : new Array(size).fill(true),
        effectsLayer: Array.isArray(data.effectsLayer)
          ? (() => {
              const el = (data.effectsLayer as number[]).slice(0, size)
              while (el.length < size) el.push(0)
              return el
            })()
          : new Array(size).fill(0),
        playerSpawn: data.playerSpawn || null,
        npcs: (data.npcs || []).map((n: Record<string, unknown>) => ({
          ...n,
          name: n.name || n.npcId || 'NPC',
        })),
        stairs: data.stairs || [],
        teleports: data.teleports || [],
        blocks: data.blocks || [],
        hearts: data.hearts || [],
        startingHp: data.startingHp || 0,
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

  /** Escape single quotes and backslashes for TS string literals */
  private esc(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  }

  // ── Export TS (MapData — single file with everything) ──

  exportMapTs(): string {
    const d = this.state.snapshot
    const varName = d.mapId.replace(/-/g, '')
    const spawn = d.playerSpawn || { tileX: 10, tileY: 12, facing: 'up' }
    const mW = d.mapWidth
    const mH = d.mapHeight

    // Format tile layers (mapWidth items per row)
    const formatLayer = (layer: readonly string[]): string => {
      const rows: string[] = []
      for (let row = 0; row < mH; row++) {
        const start = row * mW
        const items = layer.slice(start, start + mW).map(k => `'${k}'`)
        rows.push('    ' + items.join(', ') + ',')
      }
      return rows.join('\n')
    }

    const npcStr = d.npcs.map(n => {
      const fields: string[] = [
        `      name: '${this.esc(n.name)}'`,
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
      const target = s.targetMapId ? `'${s.targetMapId}'` : 'null'
      return `    { tileX: ${s.tileX}, tileY: ${s.tileY}, targetMapId: ${target} }`
    }).join(',\n')

    const teleportStr = d.teleports.map(t => {
      const fields = [
        `id: '${this.esc(t.id)}'`,
        `tileX: ${t.tileX}`,
        `tileY: ${t.tileY}`,
        `role: '${t.role}'`,
      ]
      if (t.role === 'sender' && t.targetId) {
        fields.push(`targetId: '${this.esc(t.targetId)}'`)
      }
      return `    { ${fields.join(', ')} }`
    }).join(',\n')

    const required = d.npcs
      .map(n => n.challengeId)
      .filter((id): id is string => !!id)
      .map(id => `    '${id}'`)
      .join(',\n')

    // Build tileEffects from effectsLayer
    const heartStr = d.hearts.map(h => {
      const parts = [`tileX: ${h.tileX}`, `tileY: ${h.tileY}`]
      if (h.restoreAmount && h.restoreAmount !== 1) parts.push(`restoreAmount: ${h.restoreAmount}`)
      return `    { ${parts.join(', ')} }`
    }).join(',\n')

    const blockStr = d.blocks.map(b => {
      const parts = [`tileX: ${b.tileX}`, `tileY: ${b.tileY}`]
      if (b.spriteKey) parts.push(`spriteKey: '${b.spriteKey}'`)
      return `    { ${parts.join(', ')} }`
    }).join(',\n')

    const effectIdToType: Record<number, { effect: string; direction?: string }> = {
      1: { effect: 'ice' },
      2: { effect: 'redirect', direction: 'down' },
      3: { effect: 'redirect', direction: 'up' },
      4: { effect: 'redirect', direction: 'left' },
      5: { effect: 'redirect', direction: 'right' },
      6: { effect: 'hole' },
      7: { effect: 'ledge', direction: 'down' },
      8: { effect: 'ledge', direction: 'up' },
      9: { effect: 'ledge', direction: 'left' },
      10: { effect: 'ledge', direction: 'right' },
    }
    const effects: string[] = []
    for (let y = 0; y < mH; y++) {
      for (let x = 0; x < mW; x++) {
        const eid = d.effectsLayer[y * mW + x]
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

    // Build noCollision sparse array (only when any wall tile has collision disabled)
    const noCollisionEntries: string[] = []
    for (let y = 0; y < mH; y++) {
      for (let x = 0; x < mW; x++) {
        const idx = y * mW + x
        if (d.wallsLayer[idx] !== '' && !d.wallsCollision[idx]) {
          noCollisionEntries.push(`    { tileX: ${x}, tileY: ${y} }`)
        }
      }
    }
    const noCollisionBlock = noCollisionEntries.length
      ? `  noCollision: [\n${noCollisionEntries.join(',\n')}\n  ],\n`
      : ''

    // Only include width/height if non-default
    const sizeBlock = (mW !== MAP_WIDTH_TILES || mH !== MAP_HEIGHT_TILES)
      ? `  width: ${mW},\n  height: ${mH},\n`
      : ''

    return `import type { MapData } from '@/data/types'

export const ${varName}: MapData = {
  id: '${d.mapId}',
  name: '${this.esc(d.mapName)}',
${sizeBlock}  groundLayer: [
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
${tileEffectsBlock}${noCollisionBlock}  stairs: [
${stairStr}
  ],${d.teleports.length ? `\n  teleports: [\n${teleportStr}\n  ],` : ''}${d.blocks.length ? `\n  blocks: [\n${blockStr}\n  ],` : ''}${d.hearts.length ? `\n  hearts: [\n${heartStr}\n  ],` : ''}${d.startingHp > 0 ? `\n  startingHp: ${d.startingHp},` : ''}
}
`
  }

  // ── Import TS (best-effort regex parse) ──

  importMapTs(text: string): boolean {
    try {
      const idMatch = text.match(/id:\s*'([^']+)'/)
      const nameMatch = text.match(/name:\s*'([^']+)'/)
      const spawnMatch = text.match(/playerStart:\s*\{\s*tileX:\s*(\d+),\s*tileY:\s*(\d+),\s*facing:\s*'(\w+)'/)

      // Parse dimensions (fallback to inferring from layer length, then defaults)
      const widthMatch = text.match(/width:\s*(\d+)/)
      const heightMatch = text.match(/height:\s*(\d+)/)

      // Parse tile layers first to infer size if needed
      const groundItems = this.parseStringItems(text, 'groundLayer')
      const wallsItems = this.parseStringItems(text, 'wallsLayer')

      // Determine map dimensions
      let mW = widthMatch ? parseInt(widthMatch[1]) : 0
      let mH = heightMatch ? parseInt(heightMatch[1]) : 0

      if (!mW || !mH) {
        // Infer from layer length — assume square-ish or use default width
        const layerLen = Math.max(groundItems.length, wallsItems.length)
        if (layerLen > 0 && mW) {
          mH = Math.ceil(layerLen / mW)
        } else if (layerLen > 0 && mH) {
          mW = Math.ceil(layerLen / mH)
        } else if (layerLen > 0) {
          // Try default width
          mW = MAP_WIDTH_TILES
          mH = Math.ceil(layerLen / mW)
        } else {
          mW = MAP_WIDTH_TILES
          mH = MAP_HEIGHT_TILES
        }
      }

      const size = mW * mH
      const groundLayer = this.padOrTruncate(groundItems, size, '')
      const wallsLayer = this.padOrTruncate(wallsItems, size, '')

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
          if (npc.tileX >= 0 && npc.tileX < mW && npc.tileY >= 0 && npc.tileY < mH) {
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
          const targetMatch = block.match(/targetMapId:\s*(?:'([^']+)'|null)/)
          const stairX = this.extractNum(block, 'tileX')
          const stairY = this.extractNum(block, 'tileY')
          if (stairX >= 0 && stairX < mW && stairY >= 0 && stairY < mH) {
            stairs.push({
              tileX: stairX,
              tileY: stairY,
              targetMapId: targetMatch?.[1] || null,
            })
          }
        }
      }

      // Parse tileEffects into effectsLayer
      const effectsLayer = new Array(size).fill(0)
      const effectTypeToId: Record<string, Record<string, number>> = {
        ice: { '': 1 },
        redirect: { down: 2, up: 3, left: 4, right: 5 },
        hole: { '': 6 },
        ledge: { down: 7, up: 8, left: 9, right: 10 },
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
          if (mapping && ex >= 0 && ex < mW && ey >= 0 && ey < mH) {
            effectsLayer[ey * mW + ex] = mapping[dir] ?? mapping[''] ?? 0
          }
        }
      }

      // Also import legacy ledges[] as effect IDs 7-10
      const ledgesBlockMatch = text.match(/ledges:\s*\[([\s\S]*?)\]\s*,/)
      if (ledgesBlockMatch) {
        const ledgeDirToId: Record<string, number> = { down: 7, up: 8, left: 9, right: 10 }
        const lEntryRegex = /\{[^}]*tileX:\s*(\d+)[^}]*tileY:\s*(\d+)[^}]*direction:\s*'(\w+)'[^}]*\}/g
        let lm
        while ((lm = lEntryRegex.exec(ledgesBlockMatch[1])) !== null) {
          const lx = parseInt(lm[1])
          const ly = parseInt(lm[2])
          const dir = lm[3]
          const eid = ledgeDirToId[dir]
          if (eid && lx >= 0 && lx < mW && ly >= 0 && ly < mH) {
            effectsLayer[ly * mW + lx] = eid
          }
        }
      }

      // Parse noCollision sparse array into wallsCollision boolean array
      const wallsCollision = new Array(size).fill(true)
      const noColMatch = text.match(/noCollision:\s*\[([\s\S]*?)\]\s*,/)
      if (noColMatch) {
        const entryRegex = /tileX:\s*(\d+),\s*tileY:\s*(\d+)/g
        let ncm
        while ((ncm = entryRegex.exec(noColMatch[1])) !== null) {
          const ex = parseInt(ncm[1])
          const ey = parseInt(ncm[2])
          if (ex >= 0 && ex < mW && ey >= 0 && ey < mH) {
            wallsCollision[ey * mW + ex] = false
          }
        }
      }

      // Parse teleports
      const teleports: TeleportData[] = []
      const teleportsBlockMatch = text.match(/teleports:\s*\[([\s\S]*?)\]\s*,?\s*\}/)
      if (teleportsBlockMatch) {
        const tpRegex = /\{[^}]*id:\s*'[^']+[^}]*\}/g
        let tpMatch
        while ((tpMatch = tpRegex.exec(teleportsBlockMatch[1])) !== null) {
          const block = tpMatch[0]
          const tpId = this.extractStr(block, 'id')
          const tx = this.extractNum(block, 'tileX')
          const ty = this.extractNum(block, 'tileY')
          const role = this.extractStr(block, 'role') || 'sender'
          const targetId = this.extractStr(block, 'targetId')
          if (tpId && !isNaN(tx) && !isNaN(ty) && tx >= 0 && tx < mW && ty >= 0 && ty < mH) {
            const tp: TeleportData = { id: tpId, tileX: tx, tileY: ty, role: role as TeleportData['role'] }
            if (targetId) tp.targetId = targetId
            teleports.push(tp)
          }
        }
      }

      // Parse blocks
      const blocks: PushableBlockData[] = []
      const blocksBlockMatch = text.match(/blocks:\s*\[([\s\S]*?)\]\s*,/)
      if (blocksBlockMatch) {
        const bRegex = /\{[^}]*tileX:\s*(\d+)[^}]*tileY:\s*(\d+)[^}]*\}/g
        let bm
        while ((bm = bRegex.exec(blocksBlockMatch[1])) !== null) {
          const bx = parseInt(bm[1])
          const by = parseInt(bm[2])
          if (bx >= 0 && bx < mW && by >= 0 && by < mH) {
            const entry: PushableBlockData = { tileX: bx, tileY: by }
            const skMatch = bm[0].match(/spriteKey:\s*'([^']*)'/)
            if (skMatch) entry.spriteKey = skMatch[1]
            blocks.push(entry)
          }
        }
      }

      // Parse hearts
      const hearts: HeartPickupData[] = []
      const heartsBlockMatch = text.match(/hearts:\s*\[([\s\S]*?)\]\s*,/)
      if (heartsBlockMatch) {
        const hRegex = /\{[^}]*tileX:\s*(\d+)[^}]*tileY:\s*(\d+)[^}]*\}/g
        let hm
        while ((hm = hRegex.exec(heartsBlockMatch[1])) !== null) {
          const hx = parseInt(hm[1])
          const hy = parseInt(hm[2])
          if (hx >= 0 && hx < mW && hy >= 0 && hy < mH) {
            const entry: HeartPickupData = { tileX: hx, tileY: hy }
            const raMatch = hm[0].match(/restoreAmount:\s*(\d+)/)
            if (raMatch) entry.restoreAmount = parseInt(raMatch[1])
            hearts.push(entry)
          }
        }
      }

      // Parse startingHp
      const startingHpMatch = text.match(/startingHp:\s*(\d+)/)
      const startingHp = startingHpMatch ? parseInt(startingHpMatch[1]) : 0

      this.state.loadState({
        mapId: idMatch?.[1] || this.state.snapshot.mapId,
        mapName: nameMatch?.[1] || this.state.snapshot.mapName,
        mapWidth: mW,
        mapHeight: mH,
        groundLayer,
        wallsLayer,
        wallsCollision,
        playerSpawn: spawnMatch ? {
          tileX: parseInt(spawnMatch[1]),
          tileY: parseInt(spawnMatch[2]),
          facing: spawnMatch[3] as Direction,
        } : this.state.snapshot.playerSpawn as typeof this.state.snapshot.playerSpawn,
        npcs,
        stairs,
        teleports,
        blocks,
        hearts,
        startingHp,
        effectsLayer,
      })
      return true
    } catch {
      return false
    }
  }

  /** Extract all quoted string items from a named array field */
  private parseStringItems(text: string, fieldName: string): string[] {
    const regex = new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]\\s*,`)
    const match = text.match(regex)
    if (!match) return []
    return [...match[1].matchAll(/'([^']*)'/g)].map(m => m[1])
  }

  /** Pad or truncate array to exact size */
  private padOrTruncate<T>(arr: T[], size: number, fill: T): T[] {
    if (arr.length >= size) return arr.slice(0, size)
    return [...arr, ...new Array(size - arr.length).fill(fill)]
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

  downloadMap(): void {
    const ts = this.exportMapTs()
    this.download(`${this.state.snapshot.mapId}.ts`, ts, 'text/typescript')
  }

  promptImport(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ts'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      file.text().then(text => {
        if (!this.importMapTs(text)) {
          alert('Failed to parse map file')
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
