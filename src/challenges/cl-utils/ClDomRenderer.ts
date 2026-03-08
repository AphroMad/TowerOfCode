/**
 * Shared DOM rendering utility for CL challenge types.
 * Creates an HTML overlay on top of the Phaser canvas and renders
 * content blocks. Delegates to focused modules for styles, syntax
 * highlighting, and CodeMirror instances.
 */

import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { ClContentBlock } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'
import { injectClStyles } from './ClStyles'
import { escapeHtml, highlightInlineCode } from './ClSyntaxHighlighter'
import {
  createCodeMirrorReadOnly as cmReadOnly,
  createCodeMirrorEditable as cmEditable,
} from './ClCodeMirrorFactory'

export class ClDomRenderer {
  private overlay: HTMLDivElement | null = null
  private panel: HTMLDivElement | null = null
  private cmInstances: EditorView[] = []

  /**
   * Creates the overlay div on top of the Phaser canvas.
   * Returns the inner panel element for content.
   */
  createOverlay(scene: Phaser.Scene): HTMLDivElement {
    injectClStyles()

    const canvas = scene.game.canvas
    const parent = canvas.parentElement!

    const parentPos = getComputedStyle(parent).position
    if (parentPos === 'static') {
      parent.style.position = 'relative'
    }

    this.overlay = document.createElement('div')
    this.overlay.className = 'cl-overlay'

    this.panel = document.createElement('div')
    this.panel.className = 'cl-panel'
    this.overlay.appendChild(this.panel)

    parent.appendChild(this.overlay)

    return this.panel
  }

  getOverlay(): HTMLDivElement | null {
    return this.overlay
  }

  getPanel(): HTMLDivElement | null {
    return this.panel
  }

  renderContentBlocks(container: HTMLElement, blocks: ClContentBlock[]): void {
    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          this.renderTextBlock(container, block)
          break
        case 'codeBlock':
          this.renderCodeBlock(container, block)
          break
        case 'codeEditorRun':
          this.renderCodeEditorRun(container, block)
          break
        case 'infoCard':
          this.renderInfoCard(container, block)
          break
        case 'image':
          this.renderImagePlaceholder(container, block)
          break
      }
    }
  }

  createCodeMirrorReadOnly(container: HTMLElement, code: string): EditorView {
    return cmReadOnly(container, code, this.cmInstances)
  }

  createCodeMirrorEditable(
    container: HTMLElement,
    code: string,
    extraExtensions: Extension[] = [],
  ): {
    editor: EditorView
    outputEl: HTMLDivElement
    runBtn: HTMLButtonElement
  } {
    return cmEditable(container, code, this.cmInstances, extraExtensions)
  }

  destroyOverlay(): void {
    for (const cm of this.cmInstances) {
      cm.destroy()
    }
    this.cmInstances = []

    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay)
    }
    this.overlay = null
    this.panel = null
  }

  // ── Private render methods ──

  private renderTextBlock(container: HTMLElement, block: ClContentBlock): void {
    const raw = typeof block.value === 'string' ? block.value : resolveText(block.value)

    const div = document.createElement('div')
    div.className = 'cl-text-block'

    let html = escapeHtml(raw)
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = highlightInlineCode(html)

    div.innerHTML = html
    container.appendChild(div)
  }

  private renderCodeBlock(container: HTMLElement, block: ClContentBlock): void {
    const code = typeof block.value === 'string' ? block.value : resolveText(block.value)
    this.createCodeMirrorReadOnly(container, code)
  }

  private renderCodeEditorRun(container: HTMLElement, block: ClContentBlock): void {
    const code = typeof block.value === 'string' ? block.value : resolveText(block.value)
    this.createCodeMirrorEditable(container, code)
  }

  private renderInfoCard(container: HTMLElement, block: ClContentBlock): void {
    const val = block.value as unknown as Record<string, unknown>
    const titleSource = (val?.title ?? block.title) as { en: string; fr: string } | string | undefined
    const contentSource = (val?.content ?? block.content) as { en: string; fr: string } | string | undefined
    const expandable = block.expandable ?? false
    const initiallyExpanded = block.initiallyExpanded ?? true

    const cardTitle = titleSource
      ? (typeof titleSource === 'string' ? titleSource : resolveText(titleSource))
      : ''
    const cardContent = contentSource
      ? (typeof contentSource === 'string' ? contentSource : resolveText(contentSource))
      : ''

    if (expandable) {
      const details = document.createElement('details')
      details.className = 'cl-info-card'
      if (initiallyExpanded) details.open = true

      const summary = document.createElement('summary')
      summary.className = 'cl-info-card-title'
      summary.style.cursor = 'pointer'
      summary.style.listStyle = 'none'
      summary.textContent = `${details.open ? '▾' : '▸'} ${cardTitle}`
      details.appendChild(summary)

      details.addEventListener('toggle', () => {
        summary.textContent = `${details.open ? '▾' : '▸'} ${cardTitle}`
      })

      if (cardContent) {
        const contentEl = document.createElement('div')
        contentEl.className = 'cl-info-card-content'
        contentEl.innerHTML = this.formatCardContent(cardContent)
        details.appendChild(contentEl)
      }

      container.appendChild(details)
    } else {
      const card = document.createElement('div')
      card.className = 'cl-info-card'

      if (cardTitle) {
        const titleEl = document.createElement('div')
        titleEl.className = 'cl-info-card-title'
        titleEl.textContent = cardTitle
        card.appendChild(titleEl)
      }

      if (cardContent) {
        const contentEl = document.createElement('div')
        contentEl.className = 'cl-info-card-content'
        contentEl.innerHTML = this.formatCardContent(cardContent)
        card.appendChild(contentEl)
      }

      container.appendChild(card)
    }
  }

  private formatCardContent(text: string): string {
    let html = escapeHtml(text)
    html = html.replace(/```(.*?)```/g, '`$1`')
    html = highlightInlineCode(html)
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return html
  }

  private renderImagePlaceholder(container: HTMLElement, block: ClContentBlock): void {
    if (block.caption) {
      const div = document.createElement('div')
      div.className = 'cl-image-placeholder'
      const capVal = typeof block.caption === 'string' ? block.caption : resolveText(block.caption)
      div.textContent = `[${capVal}]`
      container.appendChild(div)
    }
  }
}
