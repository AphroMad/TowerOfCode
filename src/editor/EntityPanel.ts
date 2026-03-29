import { type EditorState, type EntityType } from './EditorState'
import type { UndoManager } from './UndoManager'
import type { Direction, NPCData, NpcBehavior, TeleportRole } from '@/data/types'
import { getAllMapIds } from '@/data/maps/MapRegistry'
import { I18nManager } from '@/i18n/I18nManager'
import { getAllChallenges } from '@/data/challenges'
import { getSpriteKeys } from '@/data/sprites/SpriteRegistry'
import { getTilesByCategory } from '@/data/tiles/TileRegistry'

export class EntityPanel {
  private state: EditorState
  private undo: UndoManager
  private wrapper: HTMLElement
  private btnRow: HTMLElement
  private formContainer: HTMLElement

  constructor(container: HTMLElement, state: EditorState, undo: UndoManager) {
    this.state = state
    this.undo = undo

    // Wrapper that hides when not on entities layer
    this.wrapper = document.createElement('div')

    this.btnRow = document.createElement('div')
    const btnRow = this.btnRow
    btnRow.style.display = 'flex'
    btnRow.style.gap = '4px'
    btnRow.style.marginBottom = '12px'
    btnRow.style.flexWrap = 'wrap'

    const addBtn = (label: string, type: EntityType) => {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.className = 'editor-btn'
      btn.addEventListener('click', () => {
        this.state.mutate(d => {
          d.placingEntity = type
          d.activeTool = 'entity'
          d.activeLayer = 'entities'
        })
      })
      btnRow.appendChild(btn)
    }

    addBtn('+ Spawn', 'player')
    addBtn('+ NPC', 'npc')
    addBtn('+ Warp', 'stair')
    addBtn('+ Teleport', 'teleport')
    addBtn('+ Block', 'block')
    addBtn('+ Heart', 'heart')

    const ideaBtn = document.createElement('button')
    ideaBtn.textContent = '+ Idea'
    ideaBtn.className = 'editor-btn'
    ideaBtn.style.background = '#997a00'
    ideaBtn.style.color = '#fff'
    ideaBtn.addEventListener('click', () => {
      this.state.mutate(d => {
        d.placingEntity = 'idea'
        d.activeTool = 'entity'
        d.activeLayer = 'entities'
      })
    })
    btnRow.appendChild(ideaBtn)

    this.wrapper.appendChild(btnRow)

    // Properties form
    this.formContainer = document.createElement('div')
    this.formContainer.id = 'entity-props'
    this.wrapper.appendChild(this.formContainer)

    container.appendChild(this.wrapper)

    state.onChange(() => this.updateVisibility())
    state.onChange(() => this.renderForm())
    this.updateVisibility()
  }

  private updateVisibility(): void {
    const layer = this.state.snapshot.activeLayer
    this.wrapper.style.display = (layer === 'entities' || layer === 'walls') ? '' : 'none'
    this.btnRow.style.display = layer === 'entities' ? 'flex' : 'none'
  }

  private renderForm(): void {
    const d = this.state.snapshot
    this.formContainer.innerHTML = ''

    // Wall tile properties panel
    if (d.activeLayer === 'walls') {
      if (d.selectedWallTile) {
        const { x, y } = d.selectedWallTile
        const idx = y * d.mapWidth + x
        const tileKey = d.wallsLayer[idx]
        if (tileKey === '') {
          this.state.mutateQuiet(md => { md.selectedWallTile = null })
          return
        }
        const title = document.createElement('div')
        title.className = 'panel-title'
        title.style.marginTop = '4px'
        title.textContent = 'Object Tile'
        this.formContainer.appendChild(title)

        this.addInfo(`Position: (${x}, ${y})`)
        this.addInfo(`Tile: ${tileKey}`)

        const collision = d.wallsCollision[idx]
        this.addSelect('Collision', ['true', 'false'], String(collision), (v) => {
          this.undo.save()
          this.state.mutateQuiet(md => { md.wallsCollision[idx] = v === 'true' })
          this.state.emit()
          this.undo.save()
        })

        this.addDeleteButton(() => {
          this.undo.save()
          this.state.mutateQuiet(md => {
            md.wallsLayer[idx] = ''
            md.wallsCollision[idx] = true
            md.selectedWallTile = null
          })
          this.state.emit()
          this.undo.save()
        })

        // Extra spacing below the panel so it doesn't crowd tools
        const spacer = document.createElement('div')
        spacer.style.height = '16px'
        this.formContainer.appendChild(spacer)
      } else {
        const hint = document.createElement('div')
        hint.style.color = '#888'
        hint.style.fontSize = '12px'
        hint.style.padding = '8px 0'
        hint.textContent = 'Click an object tile to see properties\nRight-click to toggle collision'
        hint.style.whiteSpace = 'pre-line'
        this.formContainer.appendChild(hint)
      }
      return
    }

    if (!d.selectedEntityType || d.selectedEntityIndex < 0) {
      if (d.placingEntity) {
        const hint = document.createElement('div')
        hint.style.color = '#888'
        hint.style.fontSize = '12px'
        hint.style.padding = '8px 0'
        hint.textContent = `Click on the grid to place ${d.placingEntity}`
        this.formContainer.appendChild(hint)
      }
      return
    }

    const title = document.createElement('div')
    title.className = 'panel-title'
    title.style.marginTop = '4px'

    if (d.selectedEntityType === 'player') {
      title.textContent = 'Player Spawn'
      this.formContainer.appendChild(title)
      if (d.playerSpawn) {
        this.addInfo(`Position: (${d.playerSpawn.tileX}, ${d.playerSpawn.tileY})`)
        this.addSelect('Facing', ['down', 'up', 'left', 'right'], d.playerSpawn.facing, (v) => {
          d.playerSpawn!.facing = v as Direction
          this.state.emit()
        })
      }
    } else if (d.selectedEntityType === 'npc') {
      const npc = d.npcs[d.selectedEntityIndex]
      if (!npc) return
      title.textContent = `NPC: ${npc.name}`
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${npc.tileX}, ${npc.tileY})`)

      // Name (must be unique per map — animation keys depend on it)
      this.addInput('Name', npc.name, (v) => {
        const trimmed = v.trim()
        if (!trimmed) return
        const duplicate = d.npcs.some((n, i) => i !== d.selectedEntityIndex && n.name === trimmed)
        if (duplicate) {
          alert(`An NPC named "${trimmed}" already exists on this map. Names must be unique.`)
          return
        }
        npc.name = trimmed
        this.state.emit()
      })

      // Dialog key dropdown
      const dialogKeys = ['(none)', ...I18nManager.getInstance().getDialogKeys()]
      this.addSelect('Dialog', dialogKeys, npc.dialogKey ?? '(none)', (v) => {
        npc.dialogKey = v === '(none)' ? undefined : v
        this.state.emit()
      })

      // Visual properties
      this.addSelect('Sprite', getSpriteKeys(), npc.spriteKey, (v) => { npc.spriteKey = v; this.state.emit() })
      this.addSelect('Facing', ['down', 'up', 'left', 'right'], npc.facing, (v) => { npc.facing = v as Direction; this.state.emit() })

      // Behavior
      const behaviors: NpcBehavior[] = ['static', 'detect', 'lookout', 'lookout-random', 'patrol', 'gatekeeper']
      this.addSelect('Behavior', behaviors, npc.behavior, (v) => {
        npc.behavior = v as NpcBehavior
        // Init defaults for new behavior
        if ((v === 'lookout' || v === 'lookout-random') && !npc.lookoutPattern) {
          npc.lookoutPattern = [npc.facing]
          npc.lookoutTempo = 2
        }
        if (v === 'patrol' && !npc.patrolPath) {
          npc.patrolPath = []
        }
        this.state.emit()
      })

      // Behavior-specific sub-panels
      if (npc.behavior === 'lookout' || npc.behavior === 'lookout-random') {
        this.buildLookoutPanel(npc)
      } else if (npc.behavior === 'patrol') {
        this.buildPatrolPanel(npc)
      }

      // Challenge multi-select (last before delete)
      this.buildChallengePanel(npc)

      this.addDeleteButton(() => {
        this.undo.save()
        d.npcs.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'stair') {
      const stair = d.stairs[d.selectedEntityIndex]
      if (!stair) return
      title.textContent = 'Warp Point'
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${stair.tileX}, ${stair.tileY})`)

      const mapOptions = ['(none)', ...getAllMapIds()]
      this.addSelect('Target Map', mapOptions, stair.targetMapId ?? '(none)', (v) => {
        stair.targetMapId = v === '(none)' ? null : v
        this.state.emit()
      })

      this.addDeleteButton(() => {
        this.undo.save()
        d.stairs.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'teleport') {
      const tp = d.teleports[d.selectedEntityIndex]
      if (!tp) return
      title.textContent = `Teleport: ${tp.id}`
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${tp.tileX}, ${tp.tileY})`)

      // ID (must be unique)
      this.addInput('ID', tp.id, (v) => {
        const trimmed = v.trim()
        if (!trimmed) return
        const duplicate = d.teleports.some((t, i) => i !== d.selectedEntityIndex && t.id === trimmed)
        if (duplicate) {
          alert(`A teleport with ID "${trimmed}" already exists. IDs must be unique.`)
          return
        }
        // Update any senders targeting this teleport
        const oldId = tp.id
        for (const other of d.teleports) {
          if (other.targetId === oldId) other.targetId = trimmed
        }
        tp.id = trimmed
        this.state.emit()
      })

      // Role toggle
      const roles: TeleportRole[] = ['sender', 'receiver']
      this.addSelect('Role', roles, tp.role, (v) => {
        this.undo.save()
        tp.role = v as TeleportRole
        if (v === 'receiver') {
          tp.targetId = undefined
        }
        this.state.emit()
        this.undo.save()
      })

      // Target dropdown (only for senders)
      if (tp.role === 'sender') {
        const otherTeleports = d.teleports
          .filter((_, i) => i !== d.selectedEntityIndex)
          .map(t => t.id)
        const targetOptions = ['(none)', ...otherTeleports]
        this.addSelect('Target', targetOptions, tp.targetId ?? '(none)', (v) => {
          this.undo.save()
          tp.targetId = v === '(none)' ? undefined : v
          this.state.emit()
          this.undo.save()
        })
      }

      this.addDeleteButton(() => {
        this.undo.save()
        d.teleports.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'block') {
      const block = d.blocks[d.selectedEntityIndex]
      if (!block) return
      title.textContent = 'Pushable Block'
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${block.tileX}, ${block.tileY})`)

      // Sprite key dropdown (object tiles)
      const objectTileKeys = ['(none)', ...getTilesByCategory('objects', false).map(t => t.key)]
      this.addSelect('Sprite', objectTileKeys, block.spriteKey ?? '(none)', (v) => {
        this.undo.save()
        block.spriteKey = v === '(none)' ? undefined : v
        this.state.emit()
        this.undo.save()
      })

      this.addDeleteButton(() => {
        this.undo.save()
        d.blocks.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'heart') {
      const heart = d.hearts[d.selectedEntityIndex]
      if (!heart) return
      title.textContent = 'Heart Pickup'
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${heart.tileX}, ${heart.tileY})`)

      this.addInput('Restore', String(heart.restoreAmount ?? 1), (v) => {
        const n = parseInt(v)
        if (!isNaN(n) && n > 0) {
          heart.restoreAmount = n
          this.state.emit()
        }
      })

      this.addDeleteButton(() => {
        this.undo.save()
        d.hearts.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'idea') {
      const idea = d.ideas[d.selectedEntityIndex]
      if (!idea) return
      title.textContent = 'Idea (editor-only)'
      title.style.color = '#ffcc00'
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${idea.tileX}, ${idea.tileY})`)

      this.addInput('Note', idea.note ?? '', (v) => {
        idea.note = v || undefined
        this.state.emit()
      })

      this.addDeleteButton(() => {
        this.undo.save()
        d.ideas.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    }
  }

  private buildLookoutPanel(npc: NPCData): void {
    const pattern = npc.lookoutPattern ?? []
    const dirArrows: Record<string, string> = { down: '\u2193', up: '\u2191', left: '\u2190', right: '\u2192' }

    // Current sequence display
    const seqLabel = document.createElement('div')
    seqLabel.style.fontSize = '11px'
    seqLabel.style.color = '#ccc'
    seqLabel.style.margin = '6px 0 4px'
    seqLabel.textContent = 'Pattern: ' + (pattern.length ? pattern.map(d => dirArrows[d]).join(' ') : '(empty)')
    this.formContainer.appendChild(seqLabel)

    // Direction add buttons
    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.gap = '3px'
    btnRow.style.marginBottom = '4px'
    for (const dir of ['down', 'up', 'left', 'right'] as Direction[]) {
      const btn = document.createElement('button')
      btn.textContent = dirArrows[dir]
      btn.className = 'editor-btn editor-btn-sm'
      btn.title = `Add ${dir}`
      btn.addEventListener('click', () => {
        if (!npc.lookoutPattern) npc.lookoutPattern = []
        npc.lookoutPattern.push(dir)
        this.state.emit()
      })
      btnRow.appendChild(btn)
    }
    // Clear button
    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'Clear'
    clearBtn.className = 'editor-btn editor-btn-sm editor-btn-danger'
    clearBtn.addEventListener('click', () => {
      npc.lookoutPattern = []
      this.state.emit()
    })
    btnRow.appendChild(clearBtn)
    this.formContainer.appendChild(btnRow)

    // Tempo
    this.addInput('Tempo (s)', String(npc.lookoutTempo ?? 2), (v) => {
      const n = parseFloat(v)
      if (!isNaN(n) && n > 0) { npc.lookoutTempo = n; this.state.emit() }
    })
  }

  private buildPatrolPanel(npc: NPCData): void {
    const path = npc.patrolPath ?? []

    const info = document.createElement('div')
    info.style.fontSize = '11px'
    info.style.color = '#ccc'
    info.style.margin = '6px 0 4px'
    info.textContent = `Waypoints: ${path.length} — Shift+click on grid to add`
    this.formContainer.appendChild(info)

    if (path.length > 0) {
      const list = document.createElement('div')
      list.style.fontSize = '10px'
      list.style.color = '#888'
      list.style.marginBottom = '4px'
      list.textContent = path.map((p, i) => `${i + 1}:(${p.x},${p.y})`).join(' ')
      this.formContainer.appendChild(list)

      const clearBtn = document.createElement('button')
      clearBtn.textContent = 'Clear Path'
      clearBtn.className = 'editor-btn editor-btn-sm editor-btn-danger'
      clearBtn.addEventListener('click', () => {
        npc.patrolPath = []
        this.state.emit()
      })
      this.formContainer.appendChild(clearBtn)
    }
  }

  private buildChallengePanel(npc: NPCData): void {
    const challenges = getAllChallenges()
    const selected = npc.challengeIds ?? []

    const label = document.createElement('div')
    label.style.fontSize = '11px'
    label.style.color = '#ccc'
    label.style.margin = '6px 0 4px'
    label.textContent = 'Challenges:'
    this.formContainer.appendChild(label)

    // List of currently selected challenges with remove buttons
    if (selected.length > 0) {
      const list = document.createElement('div')
      list.style.display = 'flex'
      list.style.flexDirection = 'column'
      list.style.gap = '2px'
      list.style.marginBottom = '4px'

      for (let i = 0; i < selected.length; i++) {
        const id = selected[i]
        const config = challenges.find(c => c.id === id)
        const typeLabel = config ? config.type : '???'

        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.gap = '4px'
        row.style.fontSize = '11px'

        const text = document.createElement('span')
        text.style.color = '#aaa'
        text.style.flex = '1'
        text.style.overflow = 'hidden'
        text.style.textOverflow = 'ellipsis'
        text.style.whiteSpace = 'nowrap'
        text.textContent = `${id} — ${typeLabel}`
        row.appendChild(text)

        const removeBtn = document.createElement('button')
        removeBtn.textContent = 'x'
        removeBtn.className = 'editor-btn editor-btn-sm editor-btn-danger'
        removeBtn.style.padding = '0 4px'
        removeBtn.style.fontSize = '10px'
        removeBtn.style.lineHeight = '16px'
        removeBtn.style.minWidth = '18px'
        const idx = i
        removeBtn.addEventListener('click', () => {
          if (!npc.challengeIds) return
          npc.challengeIds.splice(idx, 1)
          if (npc.challengeIds.length === 0) npc.challengeIds = undefined
          this.state.emit()
        })
        row.appendChild(removeBtn)

        list.appendChild(row)
      }
      this.formContainer.appendChild(list)
    }

    // Add dropdown
    const availableChallenges = challenges.filter(c => !selected.includes(c.id))
    if (availableChallenges.length > 0) {
      const row = document.createElement('div')
      row.className = 'prop-row'

      const lbl = document.createElement('label')
      lbl.textContent = 'Add'
      lbl.className = 'prop-label'

      const select = document.createElement('select')
      select.className = 'prop-input'
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = '-- select --'
      placeholder.disabled = true
      placeholder.selected = true
      select.appendChild(placeholder)

      for (const ch of availableChallenges) {
        const o = document.createElement('option')
        o.value = ch.id
        o.textContent = `${ch.id} — ${ch.type}`
        select.appendChild(o)
      }

      select.addEventListener('change', () => {
        if (!select.value) return
        if (!npc.challengeIds) npc.challengeIds = []
        npc.challengeIds.push(select.value)
        this.state.emit()
      })

      row.appendChild(lbl)
      row.appendChild(select)
      this.formContainer.appendChild(row)
    }
  }

  private addInfo(text: string): void {
    const el = document.createElement('div')
    el.style.fontSize = '11px'
    el.style.color = '#888'
    el.style.marginBottom = '6px'
    el.textContent = text
    this.formContainer.appendChild(el)
  }

  private addInput(label: string, value: string, onChange: (v: string) => void): void {
    const row = document.createElement('div')
    row.className = 'prop-row'

    const lbl = document.createElement('label')
    lbl.textContent = label
    lbl.className = 'prop-label'

    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.className = 'prop-input'
    input.addEventListener('change', () => onChange(input.value))

    row.appendChild(lbl)
    row.appendChild(input)
    this.formContainer.appendChild(row)
  }

  private addSelect(label: string, options: string[], value: string, onChange: (v: string) => void): void {
    const row = document.createElement('div')
    row.className = 'prop-row'

    const lbl = document.createElement('label')
    lbl.textContent = label
    lbl.className = 'prop-label'

    const select = document.createElement('select')
    select.className = 'prop-input'
    for (const opt of options) {
      const o = document.createElement('option')
      o.value = opt
      o.textContent = opt
      if (opt === value) o.selected = true
      select.appendChild(o)
    }
    select.addEventListener('change', () => onChange(select.value))

    row.appendChild(lbl)
    row.appendChild(select)
    this.formContainer.appendChild(row)
  }

  private addDeleteButton(onDelete: () => void): void {
    const btn = document.createElement('button')
    btn.textContent = 'Delete'
    btn.className = 'editor-btn editor-btn-danger'
    btn.style.marginTop = '8px'
    btn.addEventListener('click', onDelete)
    this.formContainer.appendChild(btn)
  }
}
