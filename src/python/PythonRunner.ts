/**
 * Main-thread singleton that communicates with the Pyodide Web Worker.
 * Same public API as the old PythonRunner — drop-in replacement.
 *
 * - Worker persists between runs (Python state preserved)
 * - 10s timeout kills the worker on infinite loops
 * - Next run after timeout spawns a fresh worker automatically
 */

import type { PythonResult, RunnerStatus, ToWorkerMessage, FromWorkerMessage } from './types'

const TIMEOUT_MS = 10_000

class PythonRunnerSingleton {
  private worker: Worker | null = null
  private status: RunnerStatus = 'idle'
  private running = false
  private nextId = 1

  getStatus(): RunnerStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') return
    this.ensureWorker()
    if (this.status === 'loading') {
      // Wait for the worker to report ready
      await this.waitForStatus('ready')
      return
    }
    this.sendToWorker({ type: 'init' })
    await this.waitForStatus('ready')
  }

  async runCode(code: string): Promise<PythonResult> {
    if (this.running) {
      return { output: [], errors: ['Code is already running'], success: false }
    }

    this.running = true
    const id = this.nextId++

    try {
      this.ensureWorker()

      if (this.status !== 'ready') {
        this.sendToWorker({ type: 'init' })
        await this.waitForStatus('ready')
      }

      if (this.status !== 'ready') {
        return { output: [], errors: ['Pyodide not available'], success: false }
      }

      return await this.executeWithTimeout(code, id)
    } finally {
      this.running = false
    }
  }

  private ensureWorker(): void {
    if (this.worker) return

    this.worker = new Worker(
      new URL('./python.worker.ts', import.meta.url),
      { type: 'classic' },
    )

    this.worker.addEventListener('message', (e: MessageEvent<FromWorkerMessage>) => {
      const msg = e.data
      if (msg.type === 'status') {
        this.status = msg.status
      }
    })

    this.status = 'idle'
  }

  private sendToWorker(msg: ToWorkerMessage): void {
    this.worker?.postMessage(msg)
  }

  private waitForStatus(target: RunnerStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status === target) { resolve(); return }
      if (this.status === 'error') { reject(new Error('Pyodide failed to load')); return }

      const onMessage = (e: MessageEvent<FromWorkerMessage>) => {
        if (e.data.type !== 'status') return
        if (e.data.status === target) {
          this.worker?.removeEventListener('message', onMessage)
          resolve()
        } else if (e.data.status === 'error') {
          this.worker?.removeEventListener('message', onMessage)
          reject(new Error('Pyodide failed to load'))
        }
      }
      this.worker?.addEventListener('message', onMessage)
    })
  }

  private executeWithTimeout(code: string, id: number): Promise<PythonResult> {
    return new Promise((resolve) => {
      let settled = false

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        // Kill the worker — infinite loop can't be interrupted otherwise
        this.worker?.terminate()
        this.worker = null
        this.status = 'idle'
        resolve({
          output: [],
          errors: ['Le code a mis plus de 10s à s\'exécuter. Par mesure de sécurité, nous l\'avons arrêté.'],
          success: false,
        })
      }, TIMEOUT_MS)

      const onMessage = (e: MessageEvent<FromWorkerMessage>) => {
        const msg = e.data
        if (msg.type === 'result' && msg.id === id) {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          this.worker?.removeEventListener('message', onMessage)
          resolve({ output: msg.output, errors: msg.errors, success: msg.success })
        }
      }

      this.worker?.addEventListener('message', onMessage)
      this.sendToWorker({ type: 'run', code, id })
    })
  }
}

export const PythonRunner = new PythonRunnerSingleton()
