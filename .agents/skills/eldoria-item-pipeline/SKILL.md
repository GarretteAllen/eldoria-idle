---
name: eldoria-item-pipeline
description: >-
  Use this skill whenever creating, modifying, or rebalancing in-game items, equipment, weapons,
  steeds, vanity pets, or consumable rations in Eldoria Idle. Enforces the complete pipeline:
  item definition, crafting recipes, paperdoll sprite offsets, 32x32 transparent icons, and drop tables.
---

# Eldoria Item & Equipment Pipeline

This skill guarantees that any newly added or adjusted item is completely integrated across the monorepo without orphaned definitions or rendering bugs.

## Checklist & Order of Execution

1. **Item Definition (`packages/shared/src/items.ts`)**:
   - Register the item ID in `ItemDefinitionMap` with canonical properties:
     - `id`: Unique identifier (e.g., `chitin_vest`, `pet_sprout`, `potion_agility`).
     - `name`: Clean fantasy name per UI standards (no modern/sterile terms).
     - `category`: Must match valid category (`weapon`, `armour`, `cooked_food`, `raw_food`, `ore`, `bar`, `potion`, `pet`, `steed`, `gem_pack`, etc.).
     - `tier`: 1 to 5.
     - `vendorFloorPrice`: Standardized gold floor price.
     - `isTradeable`: Boolean (vanity pets and gold are strictly untradeable).
     - `equipSlot`: (If equippable) `mainhand`, `offhand`, `helmet`, `body`, `legs`, `boots`, `gloves`, `shield`, `steed`, `pet`.
     - `baseStats`: `attack`, `strength`, `defence`, `accuracy`, `evasion`, `speed`, `healing`.

2. **Recipes & Refining (`packages/shared/src/recipes.ts`)**:
   - If craftable, add recipe to `RECIPES`:
     - `skill`: `smithing`, `crafting`, `fletching`, `cooking`, or `alchemy`.
     - `levelRequired`: Balanced along the 1-99 progression.
     - `inputs`: Accurate item IDs and quantities.
     - `outputs`: Resulting item ID and yield quantity.
     - `xpReward`: Proportional to skill level tier.

3. **Paperdoll & Sprite Mapping (`packages/shared/src/playerEquipmentSprites.ts`)**:
   - If equippable (armor, weapon, steed):
     - Map entry in `EQUIPMENT_SPRITES` or `STEED_SPRITES`.
     - Specify sheet coordinate (Col, Row) on `player_equipment.png` (16x16 grid or custom dimensions).
     - Include directional layer priorities and foot/body alignment offsets.

4. **32×32 Item Icon Asset (`packages/client/public/icons/items/<itemId>.png`)**:
   - Ensure an icon exists at `packages/client/public/icons/items/<itemId>.png`.
   - Dimensions: Exactly 32×32 pixels, transparent RGBA PNG.
   - Centered with crisp pixel outlines and consistent lighting.

5. **Drop Sources & Monster Tables (`packages/shared/src/monsters.ts` / Skilling)**:
   - If dropped by monsters: Add drop entry with `itemId`, `rate` (e.g. `1/40` or fractional `0.025`), and min/max quantity.
   - If gathered from nodes: Add to node harvest yields in `packages/shared/src/skills.ts` or `farming.ts`.

6. **Market & Storage Rules Check**:
   - If item is a vanity pet: Ensure `category === 'pet'` and untradeable on player market.
   - If item is a mount: Verify steed speed scaling in `STEED_BASE_BONUS`.
