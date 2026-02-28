import type { FloorData } from '@/data/types'

export const floor01: FloorData = {
  id: 'floor-01',
  name: 'The Entrance Hall',
  mapKey: 'floor-01',
  tilesetKey: 'tiles',
  playerStart: { tileX: 10, tileY: 12, facing: 'up' },
  npcs: [
    {
      id: 'professor',
      name: 'Professor Oak',
      tileX: 5,
      tileY: 5,
      spriteKey: 'npc',
      facing: 'down',
      dialogKey: 'professor_intro',
      challengeId: 'what-is-variable',
      role: 'professor',
    },
    {
      id: 'gatekeeper',
      name: 'Gatekeeper',
      tileX: 10,
      tileY: 3,
      spriteKey: 'npc',
      frame: 0,
      facing: 'down',
      dialogKey: 'gatekeeper_blocked',
      role: 'gatekeeper',
    },
    {
      id: 'hint-npc',
      name: 'Student',
      tileX: 15,
      tileY: 10,
      spriteKey: 'npc',
      facing: 'left',
      dialogKey: 'hint_npc_01',
      role: 'flavor',
    },
  ],
  challenges: [
    {
      id: 'what-is-variable',
      type: 'multiple-choice',
      questionKey: 'challenge_variable_question',
      options: [
        { textKey: 'challenge_variable_opt1', correct: false },
        { textKey: 'challenge_variable_opt2', correct: true },
        { textKey: 'challenge_variable_opt3', correct: false },
        { textKey: 'challenge_variable_opt4', correct: false },
      ],
      explanationKey: 'challenge_variable_explanation',
    },
  ],
  requiredChallenges: ['what-is-variable'],
}
