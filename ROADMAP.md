# Tower of Code — Roadmap

## Story

In a pokemon-like world, a young adventurer sets out on a journey to become the greatest coder in the land. It's first stop: the Tower of Code, a legendary structure where the best coders in the world gather to start their journey. Each floor of the tower presents new concepts and challenges, where puzzles, games and question will test the adventurer's coding skills. As they climb higher, they will encounter mentors, rivals and allies, all while uncovering the secrets of the Tower and the true nature of coding itself.

The main mentor is Professor Pi, a wise and eccentric coder who has mastered the art of coding and is eager to share his knowledge with the adventurer. He is always with his Codémon, Zap, a small dragon creature.

For now, the only langage available to learn is Python.

The introduction will be like a Pokemon game, where the Prof Pi will introduce himself to the player and the world he just landed in.

---

## Intro Sequence

<!-- Pokemon-style intro: Prof Pi appears, explains the world, asks your name, etc. -->

- Does the player choose a name? - Yes, normal input during Prof Pi introduction to the game.
- Does the player receive a Codémon? - Not exactly, they will have to pick one during an exercise later on, but they will be introduced to Zap during the intro sequence.
- What does Prof Pi say? (key beats / dialogue outline) - similar dialog to pokemon intro, but with coding themes. "Hello there! Welcome to the world of POKEMON! My name is Pierre! People call me the POKEMON PI! This world is inhabited by creatures called CODEMON! For some people, CODEMON are pets. Others use them for projects. Myself...I study CODEMON as a profession. First, what is your name? etc..."
- Any animation / visual effects? (fade in, sprite appears, etc.) - simple white bg, dialog box, Prof Pi sprite appears with a wave, and then zap. ProfPi and zap images are available in assets/inspi/ folder as webp, maybe we should move them to sprites/ folder.

## Characters

### Professor Pi
<!-- Main mentor, always with Zap the dragon Codémon -->

- Personality: wise, eccentric, enthusiastic about coding and eager to share his knowledge.
- Role per floor: Introduces the floor everytime, can give hints if needed 
- Key dialogue moments: intro of the game, of the floor, and last floor is a fight against him where he will test the player's knowledge and skills.

### The Rival
<!-- Recurring antagonist / friendly rival -->

NO RIVAL FOR NOW. 

### Other NPCs
<!-- Hint givers, floor-specific characters, allies -->

Just some random NPCs that will be on the floors, they can be shopkeepers, other coders, etc. They can give hints, sell items, or just be there for world-building.

## Tower Structure

### How many floors for v1?

2 floors for v1.

### Floor progression
<!-- How does the player move between floors? Stairs, elevator, world map, floor select? -->

staircase. Use assets in tilesets/stairs_straight.png for the stairs. bottom center of the floor will be stairs to go down if needed, and top center will be stairs to go up.

### Floor template
<!-- What does a typical floor contain? -->

- Number of challenges per floor: variable, i'm guessing it should depend on the file i create where i put multiple concepts and challenge and characters are randomized on the floor, except i'm guessing the boss ? challenge should be fixed and always the same, so that the player can prepare for it.
- Types of NPCs per floor: randomized, but maybe we can have some floor-specific NPCs that are always there, like a shopkeeper on floor 2 for example.
- Is there a boss / final challenge per floor? Yes, one character with cool style, will test the player's knowledge, but i'm wondering if we should have an intermediary floor like floor 1 is learning, 1.5 is boss fight, then 2 is learning, 2.5 is boss fight, etc. or if we should just have the boss fight at the end of each floor, so that the player can prepare for it and know what to expect.

## Python Concepts (floor by floor)

<!-- One concept per floor. Fill in as many as you want for v1. -->

### Floor 1 — what's a variable 
### Floor 2 — numbers

## Challenge Types

<!-- What kinds of challenges does the player face? Check all that apply, add your own. -->

- [x] Explanation of the concept (by Prof Pi or other NPCs)
- [x] Multiple choice questions
- [x] Fill in the blank (type the answer)
- [x] Fill in the blank (choose from options), might be multiple blanks
- [x] Drag and drop (reorder lines)
- [x] Matching pairs (match the code to the output, for example)
- [x] Write actual code (with a mini editor)

## Visual / Audio

- Art style: Pixel art old pokemon game, i have the tilesets and characters sprites in the assets/inspi/ folder, but we can also create new ones if needed. For the floor design, we can use the tilesets in tilesets/ folder, but we can also create new ones if needed.
- Music: None for now.
- Sound effects: None for now.
- Sprite needs (new characters, tilesets, items): in the assets/iI hnspi/ folder, we have some sprites for the characters and tilesets, but we can also create new ones if needed. For example, we can create a new sprite for the shopkeeper, or for the boss character.

## Floor Layout (v1)

```
Floor 1   — Learning: Variables (multiple NPCs with challenges)
Floor 1.5 — Boss: Variables boss fight
Floor 2   — Learning: Numbers (multiple NPCs with challenges)
Floor 2.5 — Boss: Numbers boss fight
```

Each learning floor: Prof Pi intro → randomized NPC challenges → stairs unlock when all required challenges done.
Each boss floor: single boss NPC with a harder multi-part challenge.

---

## Dev Checklist
