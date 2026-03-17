type Listener = () => void

export class HpManager {
  private _hp: number
  private _maxHp: number
  private _infinite: boolean
  private listeners: Listener[] = []

  constructor(startingHp?: number) {
    this._infinite = !startingHp || startingHp <= 0
    this._maxHp = this._infinite ? 0 : startingHp!
    this._hp = this._maxHp
  }

  get hp(): number { return this._hp }
  get maxHp(): number { return this._maxHp }
  get isInfinite(): boolean { return this._infinite }
  get isDead(): boolean { return !this._infinite && this._hp <= 0 }

  /** Returns true if damage was applied (false if infinite) */
  takeDamage(amount = 1): boolean {
    if (this._infinite) return false
    this._hp = Math.max(0, this._hp - amount)
    this.emit()
    return true
  }

  /** Returns true if healing was applied */
  heal(amount = 1): boolean {
    if (this._infinite) return false
    if (this._hp >= this._maxHp) return false
    this._hp = Math.min(this._maxHp, this._hp + amount)
    this.emit()
    return true
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
