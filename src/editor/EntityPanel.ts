import type { EditorState, EntityType } from './EditorState'
import type { Direction, NPCData, NpcBehavior } from '@/data/types'
import { getAllFloorIds } from '@/data/floors/FloorRegistry'
import { I18nManager } from '@/i18n/I18nManager'
import { getAllChallengeIds } from '@/data/challenges'

export class EntityPanel {
  private state: EditorState
  private wrapper: HTMLElement
  private formContainer: HTMLElement

  constructor(container: HTMLElement, state: EditorState) {
    this.state = state

    // Wrapper that hides when not on entities layer
    this.wrapper = document.createElement('div')

    const btnRow = document.createElement('div')
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
    this.wrapper.style.display = this.state.snapshot.activeLayer === 'entities' ? '' : 'none'
  }

  private renderForm(): void {
    const d = this.state.snapshot
    this.formContainer.innerHTML = ''

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

      // Name
      this.addInput('Name', npc.name, (v) => { npc.name = v; this.state.emit() })

      // Dialog key dropdown
      const dialogKeys = ['(none)', ...I18nManager.getInstance().getDialogKeys()]
      this.addSelect('Dialog', dialogKeys, npc.dialogKey ?? '(none)', (v) => {
        npc.dialogKey = v === '(none)' ? undefined : v
        this.state.emit()
      })

      // Challenge dropdown
      const challengeIds = ['(none)', ...getAllChallengeIds()]
      this.addSelect('Challenge', challengeIds, npc.challengeId ?? '(none)', (v) => {
        npc.challengeId = v === '(none)' ? undefined : v
        this.state.emit()
      })

      // Visual properties
      this.addSelect('Sprite', ['npc', 'player'], npc.spriteKey, (v) => { npc.spriteKey = v; this.state.emit() })
      this.addSelect('Facing', ['down', 'up', 'left', 'right'], npc.facing, (v) => { npc.facing = v as Direction; this.state.emit() })

      // Behavior
      const behaviors: NpcBehavior[] = ['static', 'detect', 'lookout', 'patrol']
      this.addSelect('Behavior', behaviors, npc.behavior, (v) => {
        npc.behavior = v as NpcBehavior
        // Init defaults for new behavior
        if (v === 'lookout' && !npc.lookoutPattern) {
          npc.lookoutPattern = [npc.facing]
          npc.lookoutTempo = 2
        }
        if (v === 'patrol' && !npc.patrolPath) {
          npc.patrolPath = []
        }
        this.state.emit()
      })

      // Behavior-specific sub-panels
      if (npc.behavior === 'lookout') {
        this.buildLookoutPanel(npc)
      } else if (npc.behavior === 'patrol') {
        this.buildPatrolPanel(npc)
      }

      this.addDeleteButton(() => {
        d.npcs.splice(d.selectedEntityIndex, 1)
        this.state.deselectEntity()
      })
    } else if (d.selectedEntityType === 'stair') {
      const stair = d.stairs[d.selectedEntityIndex]
      if (!stair) return
      title.textContent = 'Warp Point'
      this.formContainer.appendChild(title)

      this.addInfo(`Position: (${stair.tileX}, ${stair.tileY})`)
      const floorOptions = ['(none)', ...getAllFloorIds()]
      this.addSelect('Target Floor', floorOptions, stair.targetFloorId ?? '(none)', (v) => {
        stair.targetFloorId = v === '(none)' ? null : v
        this.state.emit()
      })

      this.addDeleteButton(() => {
        d.stairs.splice(d.selectedEntityIndex, 1)
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
