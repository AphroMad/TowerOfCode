# TowerOfCode — Progress Tracker

## Implemented Features

### Core Gameplay
- [x] Grid-based movement (32x32 tiles, variable map sizes up to 1024)
- [x] Player entity (4-directional sprite, animation)
- [x] NPC system (5 behaviors: static, detect, lookout, patrol, gatekeeper)
- [x] Dialog system (typewriter effect, localized text)
- [x] Tile collision (wall layer + passable overrides)
- [x] Tile effects (ice sliding, redirect arrows, holes, ledges)
- [x] Map navigation (stairs with direction inference)
- [x] Intra-map teleports (sender/receiver with ID targeting, step-off guard)
- [x] Animated tiles (_f1/_f2/_f3 convention, water & lava assets)
- [x] Save/load system (localStorage: language, map, completed challenges, companion)
- [x] Y-sort sprite rendering
- [x] Companion system (codemon follows player, persists across maps)

### Challenge System
- [x] Explanation (read-only content)
- [x] Multiple choice (with hints)
- [x] Fill-in-text (code completion with validation)
- [x] Matching pairs (term ↔ definition)
- [x] Coding challenge (free-form code with solution reference)
- [x] Challenge completion tracking (per-save)
- [x] Gatekeeper NPCs (disappear when all map challenges done)

### Editor
- [x] Canvas-based tile painting (brush, eraser)
- [x] Tile palette with folder grouping & search
- [x] 4 layer types (ground, objects/walls, effects, entities)
- [x] Entity placement & property editing (player, NPC, warp, teleport)
- [x] Undo/redo system
- [x] Import/export map as .ts
- [x] Autosave to localStorage
- [x] Test mode (launch Phaser preview from editor)
- [x] Mover tool (drag entities)
- [x] Variable map size (width/height inputs, resize with data preservation)
- [x] Map templates (empty, maze, terrain with size picker + preview dialog)

### Infrastructure
- [x] i18n (English + French, dialogs + UI + map names)
- [x] Auto-discovery (tiles, sprites, maps, challenges via import.meta.glob)
- [x] Multi-page app (game, editor, exercises)
- [x] Runtime tilemap generation (no pre-built JSON maps)

---

## Planned Features

### Pushable Blocks & Holes
- [x] Pushable block entity type (push in facing direction, optional sprite)
- [x] Hole tile effect (blocks movement, filled by pushing block in with sink animation)
- [x] Editor support (place blocks, assign sprite, paint holes, undo/redo, mover, import/export)

### Heart / HP System
- [x] Player HP (e.g. 3 hearts, shown as HUD overlay)
- [x] Wrong challenge answer = lose a heart
- [x] Death → restart map (respawn at playerStart, reset map state)
- [x] Heart pickup collectible (restore 1 HP)
- [x] Visual feedback (screen flash on damage, heart animation)

### NPC Speech Bubbles
- [x] Speech bubble with "!" when NPC detects the player
- [x] Speech bubble with "..." while NPC is talking (during dialog)
- [x] Bubble removed when dialog/challenge closes

### Particle Effects
- [x] Teleport activation particles (sparkle burst)
- [x] Walking dust puffs

---

## Planned — Next Up

### Tutorial Map
- [ ] Design introductory map teaching: movement, NPC interaction, challenges, warps
- [ ] Player acquires companion (Zap) during tutorial via NPC dialog
- [ ] Companion hints during challenges (click companion for hint)

---

## Ideas (Not Yet Planned)

### Gameplay
- Collectibles (coins, gems, code fragments)
- Map select / world map (replay beaten maps)
- Star ratings per challenge (based on attempts/hints)
- Unlockable player skins
- Timed challenge mode

### Editor
- Copy/paste region tool
- Flood fill tool
- Multi-map editing (switch maps without export/import)
- Challenge editor in-UI

### Polish
- Screen transitions (fade/slide between maps)
- Sound effects & music
- Settings menu (volume, controls, reset save)
- Minimap for large maps
- Day/night or map theme tint overlays

### Educational
- Code execution sandbox (run & validate user code)
- Progressive hint tiers (3 levels of specificity)
- In-game concept glossary
- Progress dashboard page (stats, completion %)
