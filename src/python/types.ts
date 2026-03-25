export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PythonResult {
  output: string[]
  errors: string[]
  success: boolean
}

// ── Messages: main thread → worker ──

export type ToWorkerMessage =
  | { type: 'init' }
  | { type: 'run'; code: string; id: number }

// ── Messages: worker → main thread ──

export type FromWorkerMessage =
  | { type: 'status'; status: RunnerStatus }
  | { type: 'result'; id: number; output: string[]; errors: string[]; success: boolean }
