export interface LocalizedText {
  en: string
  fr: string
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export type NpcBehavior = 'static' | 'detect' | 'lookout' | 'patrol'

export interface NPCData {
  name: string
  tileX: number
  tileY: number
  facing: Direction
  spriteKey: string
  behavior: NpcBehavior
  dialogKey?: string
  challengeId?: string
  lookoutPattern?: Direction[]
  lookoutTempo?: number
  patrolPath?: { x: number; y: number }[]
}

// --- CL Exercise format ---

export interface ClContentBlock {
  type: 'text' | 'codeBlock' | 'codeEditorRun' | 'image' | 'infoCard'
  language?: string
  value: LocalizedText | string
  caption?: LocalizedText
  cardType?: string
  expandable?: boolean
  initiallyExpanded?: boolean
  title?: LocalizedText
  content?: LocalizedText | string
}

interface ClBase {
  id: string
  metadata?: {
    difficulty?: string
    tags?: string[]
  }
  title: LocalizedText
}

export interface ClExplanationConfig extends ClBase {
  type: 'cl-explanation'
  content: {
    question: ClContentBlock[]
  }
}

export interface ClMultipleChoiceOption {
  type: 'text'
  value: LocalizedText
  language?: string
}

export interface ClMultipleChoiceConfig extends ClBase {
  type: 'cl-multiple-choice'
  content: {
    question: ClContentBlock[]
    exercise: {
      options: ClMultipleChoiceOption[]
      correctAnswer: number
    }
    hint: LocalizedText
  }
}

export interface ClFillInTextConfig extends ClBase {
  type: 'cl-fill-in-text'
  content: {
    question: ClContentBlock[]
    exercise: {
      run?: boolean
      language: string
      text: string
      options: string[]
      correctAnswers: Record<string, string>
    }
    hint: LocalizedText
  }
}

export interface ClMatchingPair {
  id: string
  term: { type: 'text'; value: string }
  match: { type: 'text'; value: LocalizedText | string }
}

export interface ClMatchingPairsConfig extends ClBase {
  type: 'cl-matching-pairs'
  content: {
    question: ClContentBlock[]
    exercise: {
      pairs: ClMatchingPair[]
    }
  }
}

export interface ClChallengeConfig extends ClBase {
  type: 'cl-challenge'
  content: {
    question: ClContentBlock[]
    exercise: {
      language: string
      value: LocalizedText
    }
    solution: ClContentBlock[]
  }
}

export type ChallengeConfig =
  | ClExplanationConfig
  | ClMultipleChoiceConfig
  | ClFillInTextConfig
  | ClMatchingPairsConfig
  | ClChallengeConfig

// --- Tile Effects ---

export type TileEffectType = 'ice' | 'redirect'

export interface TileEffectData {
  tileX: number
  tileY: number
  effect: TileEffectType
  direction?: Direction // required for 'redirect'
}

// --- Stairs ---

export interface StairData {
  direction: 'up' | 'down'
  tileX: number
  tileY: number
  targetFloorId: string | null // null = floor doesn't exist yet
}

// --- Floor & Save ---

export interface FloorData {
  id: string
  name: string
  mapKey: string
  playerStart: { tileX: number; tileY: number; facing: Direction }
  npcs: NPCData[]
  requiredChallenges: string[]
  stairs: StairData[]
  tileEffects?: TileEffectData[]
}

export interface SaveData {
  language: 'en' | 'fr'
  currentFloor: string
  completedChallenges: string[]
}
