/**
 * Singleton Pyodide wrapper for running Python code in the browser.
 * Loads Pyodide from CDN on first use, captures stdout/stderr.
 */

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>
  }
}

interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(options: { batched: (text: string) => void }): void
  setStderr(options: { batched: (text: string) => void }): void
}

export interface PythonResult {
  output: string[]
  errors: string[]
  success: boolean
}

type RunnerStatus = 'idle' | 'loading' | 'ready' | 'error'

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

class PythonRunnerSingleton {
  private pyodide: PyodideInterface | null = null
  private status: RunnerStatus = 'idle'
  private loadPromise: Promise<void> | null = null
  private running = false

  getStatus(): RunnerStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') return
    if (this.loadPromise) return this.loadPromise

    this.status = 'loading'
    this.loadPromise = this.doLoad()
    return this.loadPromise
  }

  private async doLoad(): Promise<void> {
    try {
      // Load Pyodide script if not already present
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = `${PYODIDE_CDN}pyodide.js`
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Pyodide script'))
          document.head.appendChild(script)
        })
      }

      this.pyodide = await window.loadPyodide!({ indexURL: PYODIDE_CDN })
      this.status = 'ready'
    } catch (e) {
      this.status = 'error'
      console.error('Pyodide initialization failed:', e)
      throw e
    }
  }

  async runCode(code: string): Promise<PythonResult> {
    if (this.running) {
      return { output: [], errors: ['Code is already running'], success: false }
    }

    if (this.status !== 'ready' || !this.pyodide) {
      await this.initialize()
    }

    if (!this.pyodide) {
      return { output: [], errors: ['Pyodide not available'], success: false }
    }

    this.running = true
    const output: string[] = []
    const errors: string[] = []

    this.pyodide.setStdout({ batched: (text: string) => output.push(text) })
    this.pyodide.setStderr({ batched: (text: string) => errors.push(text) })

    try {
      await this.pyodide.runPythonAsync(code)
      return { output, errors, success: errors.length === 0 }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(msg)
      return { output, errors, success: false }
    } finally {
      this.running = false
    }
  }
}

export const PythonRunner = new PythonRunnerSingleton()
