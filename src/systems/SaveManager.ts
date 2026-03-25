import { SAVE_KEY } from '@/config/game.config'
import type { SaveData } from '@/data/types'

const DEFAULT_SAVE: SaveData = {
  language: 'en',
  currentMap: 'map-01',
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
      const parsed = JSON.parse(raw) as SaveData & { currentFloor?: string }
      // Migrate old saves that used "currentFloor" / "floor-" prefix
      if ('currentFloor' in parsed) {
        parsed.currentMap = (parsed.currentFloor as string).replace('floor-', 'map-')
        delete parsed.currentFloor
      }
      return parsed as SaveData
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

  setCurrentMap(mapId: string): void {
    this.data.currentMap = mapId
    this.save()
  }

  setLanguage(lang: 'en' | 'fr'): void {
    this.data.language = lang
    this.save()
  }

  getCompletedChallenges(): string[] {
    return [...this.data.completedChallenges]
  }

  setCompletedChallenges(ids: string[]): void {
    this.data.completedChallenges = [...ids]
    this.save()
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE, completedChallenges: [] }
    this.save()
  }
}
