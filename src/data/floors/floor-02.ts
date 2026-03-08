import type { FloorData } from '@/data/types'

export const floor02: FloorData = {
  id: 'floor-02',
  name: 'The Study',
  mapKey: 'floor-02',
  tilesetKey: 'tiles',
  playerStart: { tileX: 10, tileY: 12, facing: 'up' },
  npcs: [
    {
      name: 'The Explorer',
      tileX: 2,
      tileY: 10,
      spriteKey: 'npc',
      facing: 'left',
      behavior: 'static',
      dialogKey: 'explorer_flavor',
    },
    {
      name: 'The Cartographer',
      tileX: 17,
      tileY: 13,
      spriteKey: 'npc',
      facing: 'left',
      behavior: 'static',
      dialogKey: 'cartographer_flavor',
    },
    {
      name: 'The Philosopher',
      tileX: 8,
      tileY: 4,
      spriteKey: 'npc',
      facing: 'down',
      behavior: 'static',
      dialogKey: 'philosopher_flavor',
    },
    {
      name: 'The Guide',
      tileX: 14,
      tileY: 6,
      spriteKey: 'npc',
      facing: 'right',
      behavior: 'static',
      dialogKey: 'guide_flavor',
    },
    {
      name: 'The Keeper',
      tileX: 17,
      tileY: 1,
      spriteKey: 'npc',
      facing: 'down',
      behavior: 'static',
      dialogKey: 'keeper_flavor',
    },
  ],
  requiredChallenges: [],
  tileEffects: [
    // Horizontal ice strip: slide right from x=5 to x=7
    { tileX: 5, tileY: 7, effect: 'ice' },
    { tileX: 6, tileY: 7, effect: 'ice' },
    { tileX: 7, tileY: 7, effect: 'ice' },
    // Redirect at end of ice: sends player down
    { tileX: 8, tileY: 7, effect: 'redirect', direction: 'down' },
  ],
  stairs: [
    { direction: 'down', tileX: 10, tileY: 13, targetFloorId: 'floor-01' },
    { direction: 'up', tileX: 10, tileY: 1, targetFloorId: null },
  ],
}
