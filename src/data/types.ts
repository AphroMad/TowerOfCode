export interface LocalizedText {
  en: string
  fr: string
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export interface NPCData {
  id: string
  name: string
  tileX: number
  tileY: number
  spriteKey: string
  frame?: number
  facing: Direction
  dialogKey: string
  challengeId?: string
  tint?: number
  role: 'professor' | 'gatekeeper' | 'flavor'
}

export interface ChallengeOption {
  text: LocalizedText
  correct: boolean
}

// --- Challenge config discriminated union ---

interface ChallengeBase {
  id: string
  explanation: LocalizedText
  timeLimit?: number
}

export interface MultipleChoiceConfig extends ChallengeBase {
  type: 'multiple-choice'
  question: LocalizedText
  options: ChallengeOption[]
}

export interface FillInBlankConfig extends ChallengeBase {
  type: 'fill-in-blank'
  question: LocalizedText
  codeTemplate: string
  acceptedAnswers: string[]
}

export interface DebugCodeConfig extends ChallengeBase {
  type: 'debug-code'
  question: LocalizedText
  codeLines: string[]
  bugLineIndex: number
}

export interface DragDropConfig extends ChallengeBase {
  type: 'drag-drop'
  question: LocalizedText
  correctOrder: string[]
}

export interface MatchingConfig extends ChallengeBase {
  type: 'matching'
  question: LocalizedText
  pairs: { left: LocalizedText; right: LocalizedText }[]
}

export interface CodeEditorConfig extends ChallengeBase {
  type: 'code-editor'
  question: LocalizedText
  starterCode: string
  expectedOutput: string
}

export interface ExplanationPage {
  title: LocalizedText
  text: LocalizedText
  codeExample?: string
}

export interface ExplanationConfig extends ChallengeBase {
  type: 'explanation'
  pages: ExplanationPage[]
}

export interface FillInChoiceConfig extends ChallengeBase {
  type: 'fill-in-choice'
  question: LocalizedText
  codeTemplate: string
  correctAnswers: string[]
  options: string[]
}

export type ChallengeConfig =
  | MultipleChoiceConfig
  | FillInBlankConfig
  | DebugCodeConfig
  | DragDropConfig
  | MatchingConfig
  | CodeEditorConfig
  | ExplanationConfig
  | FillInChoiceConfig

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
  tilesetKey: string
  playerStart: { tileX: number; tileY: number; facing: Direction }
  npcs: NPCData[]
  requiredChallenges: string[]
  stairs: StairData[]
}

export interface SaveData {
  language: 'en' | 'fr'
  currentFloor: string
  completedChallenges: string[]
}
