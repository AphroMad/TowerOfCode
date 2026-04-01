import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClChallengeConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'
import { EditorView } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'

export class ClCodeChallenge extends ChallengeBase<ClChallengeConfig> {
  private config!: ClChallengeConfig
  private showSolution = false
  private editor: EditorView | null = null

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClChallengeConfig,
    panel: HTMLDivElement,
  ): void {
    this.config = config
    this.showSolution = false

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    panel.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(panel, this.config.content.question)

    // Code editor with IDE-like layout (shared widget)
    const starterCode = resolveText(this.config.content.exercise.value)
    const { editor } = this.renderer.createCodeMirrorEditable(
      panel,
      starterCode,
      [keymap.of([indentWithTab])],
    )
    this.editor = editor

    // Button bar — no keyboard shortcuts, just buttons (code editor needs all keys)
    const btnBar = document.createElement('div')
    btnBar.className = 'cl-hint-bar'
    btnBar.style.display = 'flex'
    btnBar.style.justifyContent = 'space-between'
    btnBar.style.alignItems = 'center'
    panel.appendChild(btnBar)

    const doneBtn = document.createElement('button')
    doneBtn.className = 'cl-btn-primary'
    doneBtn.textContent = this.t('challenge_btn_done')
    doneBtn.addEventListener('click', () => this.onComplete(true))
    btnBar.appendChild(doneBtn)

    const solBtn = document.createElement('button')
    solBtn.className = 'cl-btn'
    solBtn.textContent = this.t('challenge_btn_show_solution')
    solBtn.addEventListener('click', () => this.toggleSolution())
    btnBar.appendChild(solBtn)
  }

  protected onDestroy(): void {
    if (this.editor) {
      this.editor.destroy()
      this.editor = null
    }
  }

  private toggleSolution(): void {
    if (this.showSolution) return
    this.showSolution = true

    const overlay = this.renderer.getOverlay()
    if (!overlay) return

    // Solution overlay (inside the cl-overlay)
    const solOverlay = document.createElement('div')
    solOverlay.className = 'cl-solution-overlay'
    overlay.appendChild(solOverlay)

    const solPanel = document.createElement('div')
    solPanel.className = 'cl-solution-panel'
    solOverlay.appendChild(solPanel)

    const solTitle = document.createElement('div')
    solTitle.className = 'cl-solution-title'
    solTitle.textContent = this.t('challenge_title_solution')
    solPanel.appendChild(solTitle)

    // Render solution blocks
    for (const block of this.config.content.solution) {
      if (block.type === 'text') {
        const val = typeof block.value === 'string' ? block.value : resolveText(block.value)
        const textDiv = document.createElement('div')
        textDiv.className = 'cl-solution-text'
        textDiv.textContent = val
        solPanel.appendChild(textDiv)
      } else if (block.type === 'codeBlock') {
        const code = typeof block.value === 'string' ? block.value : resolveText(block.value)
        this.renderer.createCodeMirrorReadOnly(solPanel, code)
      }
    }

    // Close button
    const closeBar = document.createElement('div')
    closeBar.className = 'cl-hint-bar'
    closeBar.style.borderTopColor = '#444'
    solPanel.appendChild(closeBar)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'cl-btn'
    closeBtn.textContent = this.t('challenge_btn_close_solution')
    closeBtn.addEventListener('click', () => {
      solOverlay.remove()
      this.showSolution = false
    })
    closeBar.appendChild(closeBtn)
  }
}
