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
  role: 'professor' | 'gatekeeper' | 'flavor'
}

export interface ChallengeOption {
  textKey: string
  correct: boolean
}

export interface ChallengeConfig {
  id: string
  type: 'multiple-choice'
  questionKey: string
  options: ChallengeOption[]
  explanationKey: string
}

export interface FloorData {
  id: string
  name: string
  mapKey: string
  tilesetKey: string
  playerStart: { tileX: number; tileY: number; facing: Direction }
  npcs: NPCData[]
  challenges: ChallengeConfig[]
  requiredChallenges: string[]
}

export interface SaveData {
  language: 'en' | 'fr'
  currentFloor: string
  completedChallenges: string[]
}
