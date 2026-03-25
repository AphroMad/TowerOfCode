export interface LocalizedText {
  en: string
  fr: string
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export type NpcBehavior = 'static' | 'detect' | 'lookout' | 'patrol' | 'gatekeeper'

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
  type: 'explanation'
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
  type: 'multiple_choice'
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
  type: 'fill_in_text'
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
  type: 'matching_pairs'
  content: {
    question: ClContentBlock[]
    exercise: {
      pairs: ClMatchingPair[]
    }
  }
}

export interface ClChallengeConfig extends ClBase {
  type: 'challenge'
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

export type TileEffectType = 'ice' | 'redirect' | 'hole' | 'ledge'

export interface TileEffectData {
  tileX: number
  tileY: number
  effect: TileEffectType
  direction?: Direction // required for 'redirect'
}

// --- Stairs ---

export interface StairData {
  tileX: number
  tileY: number
  targetMapId: string | null // null = map doesn't exist yet
}

// --- Teleports (intra-map) ---

export type TeleportRole = 'sender' | 'receiver'

export interface TeleportData {
  id: string
  tileX: number
  tileY: number
  role: TeleportRole
  targetId?: string // only for senders — id of another teleport to land on
}

// --- Pushable Blocks ---

export interface PushableBlockData {
  tileX: number
  tileY: number
  spriteKey?: string  // object tile key (e.g. 'objects/rock') — fallback to brown box
}

// --- Heart Pickups ---

export interface HeartPickupData {
  tileX: number
  tileY: number
  restoreAmount?: number  // defaults to 1
}

// --- Map & Save ---

export interface MapData {
  id: string
  name: string
  width?: number   // tile columns (default 20)
  height?: number  // tile rows (default 15)
  groundLayer: string[]
  wallsLayer: string[]
  wallsCollision?: boolean[]
  playerStart: { tileX: number; tileY: number; facing: Direction }
  npcs: NPCData[]
  requiredChallenges: string[]
  stairs: StairData[]
  teleports?: TeleportData[]
  tileEffects?: TileEffectData[]
  blocks?: PushableBlockData[]
  startingHp?: number          // 0 or undefined = infinite (no HP loss)
  hearts?: HeartPickupData[]
}

export interface SaveData {
  language: 'en' | 'fr'
  currentMap: string
  completedChallenges: string[]
  companion?: string | null  // spriteKey (e.g. 'zap'), null = no companion
}
