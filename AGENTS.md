# AGENTS.md — Eldoria Idle Master Directive & Codebase Knowledge

> **MANDATORY INSTRUCTION FOR ALL AGENTS**:  
> You MUST read this document before taking ANY action in this codebase.  
> It represents the single source of truth for architectural structure, coding conventions, database rules, UI/UX philosophy, live deployment behavior, and ongoing feature status.  
> If you make architectural changes, add new systems, or alter core conventions, you MUST update this file accordingly.

---

## 1. Project Overview & Environments
- **Game**: *Eldoria Idle* — a persistent 2D shared-world idle MMORPG inspired by Old School RuneScape (OSRS).
- **Live Production URL**: `https://eldoriaidle.site`
- **Monorepo Structure** (npm workspaces):
  - `packages/shared`: Shared types, constants, item/recipe definitions, level formulas, sprite mappings, combat math.
  - `packages/server`: Node.js Express + WebSocket game server, SQLite database engine (`better-sqlite3`), pathfinding, combat/trade engines, offline simulation.
  - `packages/client`: Vite + Vanilla TypeScript client, HTML5 Canvas 2D renderer, DOM UI overlays, CSS styling.

---

## 2. Critical Operational Rules (NEVER BREAK)

### A. Database Migrations & Schema Ordering (Zero Crash Rule)
- The server uses SQLite via `better-sqlite3` located in `data/eldoria.db`.
- **Migration Ordering**: In `packages/server/src/storage.ts` (`initSchema()`):
  - **Always execute `ALTER TABLE ... ADD COLUMN` before creating any index referencing those new columns.**
  - SQLite crashes on startup with `SqliteError: no such column` if you create an index on a column that does not yet exist.
  - Always wrap `ALTER TABLE ADD COLUMN` statements in individual `try { ... } catch {}` blocks for idempotency.
- **Data Preservation**: Never wipe `data/` or delete existing tables during updates. Player accounts, banks, and items are persistent.

### B. Deployment & Production Pipeline
- Pushing to `origin/main` automatically triggers GitHub Actions (`.github/workflows/deploy.yml`), which pulls to `/var/www/eldoria-idle` on the VPS and runs `pm2 reload eldoria`.
- **Pre-Commit Verification**: Always run `npm run build` locally before pushing to catch all TypeScript compiler errors across shared, client, and server packages. A failed build breaks production with a 502 Bad Gateway.

---

## 3. UI/UX & Copy Standards (From PROJECT_RULES.md)

1. **Clean, Human Copy (No AI Sounding Language)**:
   - Avoid sterile AI corporate or marketing text. Use grounded fantasy terms: *Satchel*, *Hearth / Bank*, *Celestial Gems*, *Gold*, *Tradeable*.
   - Never reference backend infrastructure or payment processors (use *"Gem Packs"*, buttons like *"$0.99"*, never *"PayPal checkout"*).
2. **Modal Hierarchy & Window Stability**:
   - Modals have fixed, predictable dimensions (e.g. `580px × 560px`). Switching tabs or showing empty states must **never resize or shift window boundaries**.
   - Body sections must have internal scrolling (`overflow-y: auto`).
3. **Single Source of Truth**:
   - If an item can be used/opened from the satchel (e.g., Gem Packs, keystones), do not duplicate an open/redeem mechanism in a secondary menu.
4. **Chat Cleanliness**:
   - Only the **`[ADMIN]`** badge displays next to sender names in chat. Regular player titles (e.g., Novice of Eldoria, Recruiter) do **not** appear as bulky chat badges next to names.
5. **BBCode Changelog Standards**:
   - All release notes / changelogs must follow the structured BBCode format:
     - Header: `[h1]Alpha 1 Update <NUM> (a1.<NUM>)[/h1]`
     - Intro blurb introducing the theme and major additions.
     - Categorized sections with emojis: `[h2]🐾 Category Title[/h2]`.
     - Bulleted lists `[list] ... [/list]` with `[*]` entries.
     - Inline tag badges like `[badge=blue]...[/badge]`, `[badge=green]...[/badge]`, `[badge=purple]...[/badge]`, `[badge=gold]...[/badge]` for skills, drop types, and milestones.
     - Bold item/feature names with `[b]...[/b]`.

---

## 4. Sprites, Paperdoll & Art Pipelines

1. **Sprite Sheet Location**:
   - `packages/client/public/maps/player_equipment.png` (256×192 grid of 16×16 cells with multi-cell items).
2. **Item Icons Location**:
   - `packages/client/public/icons/items/<itemId>.png` (standard 32×32 transparent RGBA PNG, centered).
3. **Mounts (Steeds)**:
   - Configured in `packages/shared/src/playerEquipmentSprites.ts`:
     - `steed_courser`: Col 8, Row 0, 27×23 px.
     - `steed_chicken` (Rooster Strider): Col 11, Row 0, 24×22 px (uses custom foot alignment without horse stirrups).
     - `steed_chorse` (Chorse): Col 13, Row 0, 27×23 px (hybrid chicken + horse mount, crafted via 1x `steed_courser` + 1x `steed_chicken`).
4. **Chitin Equipment Status**:
   - Fully mapped in `playerEquipmentSprites.ts`:
     - `chitin_cowl`: Col 7, Row 3 (`helmet`)
     - `chitin_vest`: Col 9, Row 2 (`body`)
     - `chitin_chaps`: Col 8, Row 2 (`legs`)
     - `chitin_quiver`: Col 6, Row 7 (`shield`)

---

## 5. Complete Systems Reference & Balancing Guide

### A. Tick Rate, Movement & Pathfinding
- **Source Files**: `packages/shared/src/constants.ts`, `packages/shared/src/formulas.ts`, `packages/server/src/gameEngine.ts`.
- **Tick Rate**: `TICK_MS = 600` (Classic 600ms OSRS tick). All timers, combat swings, and movement are synchronized to this tick.
- **Base Speed**: 1.0 tile/tick (approx 1.67 tiles per second).
- **Steed Movement Bonus**:
  - `STEED_BASE_BONUS`: Plain (+12%), Uncommon (+13%), Rare (+15%), Epic (+20%), Legendary (+30%).
  - Chorse (`steed_chorse`): Receives a 2.0x multiplier over standard mounts (e.g. +24% plain base, up to +60% legendary).
  - Enhancement scaling: `bonus = base * (1 + 0.15 * plus)`.
  - To adjust mount speeds: Edit `STEED_BASE_BONUS` or `getSteedWalkSpeedBonus()` in `packages/shared/src/constants.ts`.
- **A* Pathfinding**: 8-directional with corner-cutting prevention against blocked terrain. Implemented via binary min-heap in `formulas.ts` (`findPath`).

### B. Experience, Leveling & Skill Curves
- **Source Files**: `packages/shared/src/levels.ts`.
- **Formula**: Canonical OSRS formula: `Experience(L) = floor( 1/4 * sum_{l=1}^{L-1} floor( l + 300 * 2^(l/7) ) )`.
- **Caps**: Max Level = 99 (13,034,431 XP). Level 92 is the exact halfway mark (6,517,253 XP). Max virtual level = 126. Max XP = 200,000,000.
- **Skills**:
  - Gathering: `mining`, `fishing`, `woodcutting`, `herbalism`, `farming`, `thieving`.
  - Refining / Crafting: `cooking`, `smithing`, `fletching`, `alchemy`, `crafting`, `attunement`.
  - Combat: `melee`, `ranged`, `magic`, `defence`, `hitpoints`.
- **Job Speed Multipliers**: Derived from skill level in `getJobSpeedMultiplier(level)` (speed scales up smoothly with higher levels).

### C. Combat Engine & Sustenance Loop
- **Source Files**: `packages/shared/src/formulas.ts`, `packages/shared/src/monsters.ts`, `packages/server/src/gameEngine.ts`.
- **Hit Chance Formula**: `calculateHitChance(accuracy, evasion) = min(0.95, max(0.05, accuracy / (accuracy + evasion)))`.
- **Max Hit Formula**: `calculateMaxHit(level, gearStrength, targetArmour) = max(1, 1 + floor((level + gearStrength) / 8) - targetArmour)`.
- **HP & Food Sustenance**:
  - Players set an auto-eat threshold (`player.eatsAtHpPercent`, default 50%).
  - Food healing amounts scale with rarity: `RARITY_HEALING_MULTIPLIER` (Plain 1.0x, Uncommon 1.1x, Rare 1.25x, Epic 1.5x, Legendary 2.0x).
  - Combat auto-banking: Upon inventory filling with monster drops, the character walks to Hearth bank, deposits loot, restocks up to 15 cooked food rations, and pathfinds back to the combat zone.

### D. Item Rarity & Gear Enhancement (+0 to +15)
- **Source Files**: `packages/shared/src/constants.ts`.
- **Rarity Drop / Craft Tiers**:
  - Plain: 1.0 (base).
  - Uncommon: 2.5% (1/40).
  - Rare: 0.25% (1/400).
  - Epic: 1 / 8,000.
  - Legendary: 1 / 150,000.
- **Rarity Stat Multipliers**: Plain 1.0x, Uncommon 1.3x, Rare 1.6x, Epic 2.2x, Legendary 3.0x.
- **Enhancement Mechanics** (Runeforge):
  - Max Plus: +15.
  - Success Chance: `getEnhanceChance(plus) = max(0.20, 1 - plus * 0.06)`.
  - Anima Cost: `3 * (currentPlus + 1)`.
  - Gold Cost: `TIER_BASE_ENHANCE_COST[tier] * RARITY_PRICE_MULTIPLIER[rarity] * (currentPlus + 1)`.

### E. Farming System (Crop Lifecycles & Plots)
- **Source Files**: `packages/shared/src/farming.ts`.
- **Plot Growth**:
  - `ONLINE_GROWTH_MULTIPLIER = 2.0` (Crops grow twice as fast while the player is active online).
  - Base durations: Earthtuber (5m / 2.5m online), Silverleaf (8m / 4m online), Glowshroom (12m / 6m online), Deep Radish (18m / 9m online).
  - Seed return mechanic: Harvesting provides a chance to recover bonus seeds (`seedReturnChance` = 40%–50%).
- **To add/rebalance crops**: Modify `FARMING_CROPS` in `packages/shared/src/farming.ts`.

### F. Action Queue System
- **Source Files**: `packages/shared/src/constants.ts`, `packages/server/src/gameEngine.ts`.
- **Config**: `QUEUE_SLOT_CONFIG`
  - Base free slots: 2.
  - Max slots: 5.
  - Celestial Gem upgrade costs: Slot 3 (100 gems), Slot 4 (250 gems), Slot 5 (500 gems).
- **Transitions**: Smooth FIFO transition when an action target is reached or raw resources are exhausted.

### G. Offline Catch-Up & Simulation
- **Source Files**: `packages/shared/src/constants.ts`, `packages/shared/src/formulas.ts` (`simulateOfflineCatchUp`).
- **Offline Limits**: Base 24 hours (`OFFLINE_TIME_CONFIG.BASE_SECONDS`). Upgradable in +15m increments for 25 Celestial Gems.
- **Simulation**: Accurately simulates resource gathering, auto-banking trips, combat food consumption, and deaths during offline periods so players retain idle progress without cheating the simulation.

### H. Economy, Vendors, Player Market & Gem Packs
- **Source Files**: `packages/shared/src/items.ts`, `packages/shared/src/constants.ts`, `packages/server/src/gameEngine.ts`.
- **Town Merchant (`VENDOR_GOODS`)**:
  - Located at Hearth Counter or near Merchant NPCs.
  - Items for direct sale: `steed_courser` (15,000 gold), `steed_chicken` (15,000 gold).
  - To adjust vendor stock: Modify `VENDOR_GOODS` in `packages/shared/src/items.ts`.
- **Player Market**: Tax-free player-to-player orderbook for tradeable items, equipment, and gem packs.
- **Celestial Gem Packs**: 5 tiers ($0.99 for 50 gems up to $19.99 for 2,000 gems). Tradeable in-game items (`gem_pack_*`).

### I. Player Referral System
- **Source Files**: `packages/shared/src/types.ts`, `packages/server/src/storage.ts`, `packages/client/src/main.ts`.
- **Invite URL**: `https://eldoriaidle.site?ref=<Username>`.
- **Anti-Alt Qualification**: Invited players must hit **Total Level 100+** before counting toward rewards.
- **Reward Ladder**:
  - 1 Friend: 50 Celestial Gems + Title *Herald of Eldoria*.
  - 3 Friends: 150 Celestial Gems + Title *Vanguard Recruiter*.
  - 5 Friends: 300 Celestial Gems + Title *Realm Ambassador*.
  - Beyond 5: +50 Celestial Gems per friend.
- **Client UI**: Located in Adventurer Profile Modal (`#account-profile-modal`).
- **Periodic Realm Broadcasts**: Every 25 minutes, a friendly non-spammy tip from `Eldoria` appears in All chat reminding players about the referral perks.

### J. Instanced Co-Op Dungeons (The Whispering Crypt)
- **Detailed Roadmap**: [`agentdocs/dungeons.md`](file:///home/gar/share/browsermmo/agentdocs/dungeons.md).
- **Party & Delve Loop**: Requires 1x `item_crypt_key`. Auto-battles through 3 rooms with synchronized party warps. Unlocks exit chest with auto-banking and Quartermaster recovery parcel storage.

### K. Cosmetic & Vanity Pets (Prestige Companions)
- **Source Files**: `packages/shared/src/items.ts`, `packages/shared/src/monsterSprites.ts`, `packages/shared/src/recipes.ts`, `packages/server/src/gameEngine.ts`, `packages/client/src/canvas.ts`.
- **Philosophy**: Pure vanity / cosmetic prestige badges (zero power creep, no combat stats), mirroring classic OSRS boss/skilling pets.
- **Roster & Drop Sources**:
  - `pet_rocky` (*Rocky*): Mining (1/45,000 to 1/12,000 depending on ore tier).
  - `pet_treant` (*Twiggy Treant*): Woodcutting (1/45,000 to 1/12,000 depending on tree tier; 1/28,000 on Bloodwood).
  - `pet_otter` (*River Whiskers*): Fishing (1/45,000 to 1/9,000 depending on fish tier).
  - `pet_sprout` (*Sproutling*): Farming crop harvests (1/15,000 to 1/2,000 depending on crop tier).
  - `pet_crypt_beetle` (*Crypt Scarab*): Whispering Crypt Dungeon Spoils (1/250).
- **Summoning, Duplicate Protection & World Following**:
  - Equippable in the `pet` slot under the Equipment Drawer.
  - Automatically equips upon initial drop if pet slot is empty.
  - Sits and trails ~0.85 tiles behind the player with smooth interpolation and cute idle/run bounce.
  - Mini overhead gold nameplate.
  - Duplicate Protection: If a player already possesses the companion, duplicate drops will notify the player privately (*"You have a funny feeling like you would have been followed..."*) without spamming duplicate items into inventory.
- **Realm Broadcast**:
  - Drops trigger a server-wide announcement in All chat: `"🎉 [Player] has a funny feeling like something is following them: [Pet Name]!"`.

### L. Town Noticeboard & Daily Bounties
- **Source Files**: `packages/shared/src/bounties.ts`, `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts`, `packages/client/src/canvas.ts`, `packages/client/src/main.ts`.
- **World Entity**: Located in Hearth Town Square at `(10, 22)` (`hearth_notice_board`, type `'notice_board'`). Rendered via tilemap Col 11, Row 6 with an overhead warm gold nameplate.
- **Mechanics & Reset**:
  - Resets daily at **00:00 UTC** based on date key (`YYYY-MM-DD`).
  - Generates 3 level-scaled daily bounties per player:
    1. **Gathering**: Mining ore, woodcutting timber, fishing, or harvesting crops.
    2. **Refining**: Smelting ingots, cooking rations, or fletching arrow shafts/bows.
    3. **Combat**: Slaying zone monsters appropriate to combat skill.
  - Automatically tracks progress in background across skilling cycles and monster defeats.
  - Interactive modal (`#noticeboard-modal`, `580px × 560px` fixed dimensions) allows viewing progress and claiming rewards (Gold, Celestial Gems, and Anima).

### M. Mount Breeding & Pedigree System
- **Source Files**: `packages/shared/src/constants.ts`, `packages/server/src/gameEngine.ts`, `packages/client/index.html`, `packages/client/src/main.ts`.
- **Access**: Directly on any mount in the satchel via the item context menu (`Breed Mount...`). No dedicated NPC required.
- **Species Crossing Logic**:
  - `steed_courser` + `steed_chicken` = `steed_chorse` (The hybrid Chorse mount).
  - Two Chorses breed into another Chorse (`steed_chorse`).
  - Pure breeds of the same species retain their species.
- **Rarity Mutation & Gold Sink**:
  - Offspring base rarity is the minimum rarity between both parents (`Math.min(rarityA, rarityB)`).
  - **Mutation Chance**: Exactly **5%** (`0.05`) roll to upgrade the offspring to the next rarity tier (Plain -> Uncommon -> Rare -> Epic -> Legendary).
  - **Gold Sink Fee**: Base 5,000 Gold multiplied by tier multiplier (`plain: 1x, uncommon: 2x, rare: 4x, epic: 8x, legendary: 15x`) based on `Math.max(tierA, tierB)`.
  - Epic and Legendary breeding outcomes trigger a server-wide All chat milestone announcement.

---

## 6. Development & Deployment Commands
- `npm run dev`: Concurrent local client and server dev server.
- `npm run build`: Compiles shared, client (Vite bundle), and server (TypeScript compiler).
- `git add <files> && git commit -m "..." && git push origin main`: Deploys to live VPS.
