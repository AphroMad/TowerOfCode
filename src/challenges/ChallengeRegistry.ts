import type { IChallenge } from '@/challenges/IChallenge'
import { MultipleChoiceChallenge } from '@/challenges/MultipleChoiceChallenge'
import { FillInBlankChallenge } from '@/challenges/FillInBlankChallenge'
import { DebugCodeChallenge } from '@/challenges/DebugCodeChallenge'
import { DragDropChallenge } from '@/challenges/DragDropChallenge'
import { MatchingChallenge } from '@/challenges/MatchingChallenge'
import { CodeEditorChallenge } from '@/challenges/CodeEditorChallenge'
import { ExplanationChallenge } from '@/challenges/ExplanationChallenge'
import { FillInChoiceChallenge } from '@/challenges/FillInChoiceChallenge'

type ChallengeConstructor = new () => IChallenge

const registry = new Map<string, ChallengeConstructor>()

registry.set('multiple-choice', MultipleChoiceChallenge)
registry.set('fill-in-blank', FillInBlankChallenge)
registry.set('debug-code', DebugCodeChallenge)
registry.set('drag-drop', DragDropChallenge)
registry.set('matching', MatchingChallenge)
registry.set('code-editor', CodeEditorChallenge)
registry.set('explanation', ExplanationChallenge)
registry.set('fill-in-choice', FillInChoiceChallenge)

export function createChallenge(type: string): IChallenge {
  const Ctor = registry.get(type)
  if (!Ctor) throw new Error(`Unknown challenge type: ${type}`)
  return new Ctor()
}
