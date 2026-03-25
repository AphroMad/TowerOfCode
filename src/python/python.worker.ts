/**
 * Web Worker that loads and runs Pyodide in an isolated thread.
 * Pyodide persists between runs so Python variables carry over.
 */

import type { ToWorkerMessage, FromWorkerMessage, RunnerStatus } from './types'

declare function importScripts(...urls: string[]): void

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(options: { batched: (text: string) => void }): void
  setStderr(options: { batched: (text: string) => void }): void
}

let pyodide: PyodideInterface | null = null
let status: RunnerStatus = 'idle'

function postStatus(s: RunnerStatus): void {
  status = s
  const msg: FromWorkerMessage = { type: 'status', status: s }
  self.postMessage(msg)
}

async function init(): Promise<void> {
  if (status === 'ready') return
  if (status === 'loading') return

  postStatus('loading')

  try {
    // importScripts works in classic workers; for module workers we use it
    // via globalThis since Pyodide's CDN script assigns to globalThis.loadPyodide
    importScripts(`${PYODIDE_CDN}pyodide.js`)

    const loadPyodide = (globalThis as unknown as {
      loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>
    }).loadPyodide

    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
    postStatus('ready')
  } catch (e) {
    console.error('Pyodide worker init failed:', e)
    postStatus('error')
  }
}

async function runCode(code: string, id: number): Promise<void> {
  if (status !== 'ready' || !pyodide) {
    await init()
  }

  if (!pyodide) {
    const msg: FromWorkerMessage = {
      type: 'result', id, output: [], errors: ['Pyodide not available'], success: false,
    }
    self.postMessage(msg)
    return
  }

  const output: string[] = []
  const errors: string[] = []

  pyodide.setStdout({ batched: (text: string) => output.push(text) })
  pyodide.setStderr({ batched: (text: string) => errors.push(text) })

  try {
    await pyodide.runPythonAsync(code)
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    errors.push(errMsg)
  }

  const msg: FromWorkerMessage = {
    type: 'result', id, output, errors, success: errors.length === 0,
  }
  self.postMessage(msg)
}

self.addEventListener('message', (e: MessageEvent<ToWorkerMessage>) => {
  const msg = e.data
  if (msg.type === 'init') {
    init()
  } else if (msg.type === 'run') {
    runCode(msg.code, msg.id)
  }
})
