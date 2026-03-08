/**
 * Factory functions for creating CodeMirror editor instances.
 * Each function pushes the created EditorView into the provided
 * cmInstances array so the caller can manage lifecycle.
 */

import { EditorView, keymap } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap } from '@codemirror/commands'
import { PythonRunner } from './PythonRunner'

export function createCodeMirrorReadOnly(
  container: HTMLElement,
  code: string,
  cmInstances: EditorView[],
): EditorView {
  const wrapper = document.createElement('div')
  wrapper.className = 'cl-code-block'
  container.appendChild(wrapper)

  const state = EditorState.create({
    doc: code,
    extensions: [
      python(),
      oneDark,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ],
  })

  const view = new EditorView({ state, parent: wrapper })
  cmInstances.push(view)
  return view
}

export function createCodeMirrorEditable(
  container: HTMLElement,
  code: string,
  cmInstances: EditorView[],
  extraExtensions: Extension[] = [],
): {
  editor: EditorView
  outputEl: HTMLDivElement
  runBtn: HTMLButtonElement
} {
  // Widget wrapper
  const widget = document.createElement('div')
  widget.className = 'cl-editor-widget'
  container.appendChild(widget)

  // ── Toolbar ──
  const toolbar = document.createElement('div')
  toolbar.className = 'cl-editor-toolbar'
  widget.appendChild(toolbar)

  const runBtn = document.createElement('button')
  runBtn.className = 'cl-run-btn'
  runBtn.innerHTML = '<span class="play-icon">&#9654;</span> Run'
  toolbar.appendChild(runBtn)

  const statusEl = document.createElement('span')
  statusEl.className = 'cl-run-status'
  toolbar.appendChild(statusEl)

  const langLabel = document.createElement('span')
  langLabel.className = 'cl-lang-label'
  langLabel.textContent = 'python'
  toolbar.appendChild(langLabel)

  // ── Editor ──
  const state = EditorState.create({
    doc: code,
    extensions: [
      python(),
      oneDark,
      keymap.of(defaultKeymap),
      ...extraExtensions,
    ],
  })

  const editor = new EditorView({ state, parent: widget })
  cmInstances.push(editor)

  // ── Console header ──
  const consoleHeader = document.createElement('div')
  consoleHeader.className = 'cl-console-header'
  widget.appendChild(consoleHeader)

  const consoleLabel = document.createElement('span')
  consoleLabel.className = 'cl-console-label'
  consoleLabel.textContent = 'Console'
  consoleHeader.appendChild(consoleLabel)

  const clearBtn = document.createElement('button')
  clearBtn.className = 'cl-clear-btn'
  clearBtn.textContent = 'Clear'
  consoleHeader.appendChild(clearBtn)

  // ── Console output (always visible) ──
  const outputEl = document.createElement('div')
  outputEl.className = 'cl-console-output'
  outputEl.innerHTML = '<span class="cl-placeholder">&gt; Ready</span>'
  widget.appendChild(outputEl)

  // ── Clear handler ──
  clearBtn.addEventListener('click', () => {
    outputEl.innerHTML = '<span class="cl-placeholder">&gt; Ready</span>'
    statusEl.textContent = ''
    statusEl.className = 'cl-run-status'
  })

  // ── Run handler ──
  runBtn.addEventListener('click', async () => {
    const currentCode = editor.state.doc.toString()
    runBtn.disabled = true
    statusEl.className = 'cl-run-status'
    statusEl.textContent = PythonRunner.getStatus() === 'ready' ? 'Running...' : 'Loading Python...'
    outputEl.innerHTML = ''

    try {
      const result = await PythonRunner.runCode(currentCode)

      outputEl.innerHTML = ''
      if (result.output.length > 0) {
        for (const line of result.output) {
          const lineEl = document.createElement('div')
          lineEl.innerHTML = '<span class="cl-prompt">&gt; </span>'
          const textNode = document.createTextNode(line)
          lineEl.appendChild(textNode)
          outputEl.appendChild(lineEl)
        }
      }
      if (result.errors.length > 0) {
        const errSpan = document.createElement('span')
        errSpan.className = 'cl-error'
        errSpan.textContent = result.errors.join('\n')
        outputEl.appendChild(errSpan)
      }
      if (result.output.length === 0 && result.errors.length === 0) {
        outputEl.innerHTML = '<span class="cl-placeholder">(no output)</span>'
      }

      statusEl.textContent = result.success ? 'Done' : 'Error'
      statusEl.classList.add(result.success ? 'success' : 'error')
    } catch {
      outputEl.innerHTML = '<span class="cl-error">Failed to run code</span>'
      statusEl.textContent = 'Error'
      statusEl.classList.add('error')
    } finally {
      runBtn.disabled = false
    }
  })

  return { editor, outputEl, runBtn }
}
