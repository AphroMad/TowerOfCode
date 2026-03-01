import { SAVE_KEY } from '@/config/game.config'
import type { SaveData } from '@/data/types'

const DEFAULT_SAVE: SaveData = {
  language: 'en',
  currentFloor: 'floor-01',
  completedChallenges: [],
}

export class SaveManager {
  private static instance: SaveManager
  private data: SaveData

  private constructor() {
    this.data = this.load()
  }

  static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager()
    }
    return SaveManager.instance
  }

  private load(): SaveData {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      return JSON.parse(raw) as SaveData
    }
    return { ...DEFAULT_SAVE, completedChallenges: [] }
  }

  save(): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
  }

  getData(): SaveData {
    return this.data
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  }

  completeChallenge(id: string): void {
    if (!this.data.completedChallenges.includes(id)) {
      this.data.completedChallenges.push(id)
      this.save()
    }
  }

  isChallengeCompleted(id: string): boolean {
    return this.data.completedChallenges.includes(id)
  }

  setCurrentFloor(floorId: string): void {
    this.data.currentFloor = floorId
    this.save()
  }

  setLanguage(lang: 'en' | 'fr'): void {
    this.data.language = lang
    this.save()
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE, completedChallenges: [] }
    this.save()
  }
}
