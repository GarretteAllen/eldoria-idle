# Dungeon System — Status & Remaining Roadmap

**Document Created:** October 11, 2026  
**System:** Co-op Instanced Dungeons & The Whispering Crypt  

---

## 1. Executive Summary
The co-op dungeon engine is designed for active group or solo delves with automated combat, multi-room progression, ready-check lobbies, keystone requirements, spoils generation, and post-run recovery storage via a cozy Quartermaster NPC.

---

## 2. Currently Implemented & Completed

### A. Data Models & Types (`packages/shared/src/types.ts` & `dungeons.ts`)
- **Dungeon Definition Schema**: Support for multi-room layout, room spawn definitions, required keystone items, level gates, max party size, gate warp coords, and chest locations.
- **`whispering_crypt` Definition**:
  - **Room 0**: *The Bone Antechamber* (2x Crypt Ghouls, 1x Tomb Beetle)
  - **Room 1**: *Hall of Fallen Warriors* (3x Restless Vanguards)
  - **Room 2**: *The Crypt Lord Sarcophagus* (Boss: Crypt Lord + exit chest)
- **Recovery Item Schema**: `DungeonRecoveryItem` tracks lost/overflow spoils per player with a retrieval fee.

### B. Server Engine (`packages/server/src/gameEngine.ts`)
- **Lobby & Party Management**:
  - `DUNGEON_CREATE_PARTY`, `DUNGEON_INVITE_PLAYER`, `DUNGEON_RESPOND_INVITE`.
  - Party leader privileges, readiness toggle (`DUNGEON_TOGGLE_READY`).
  - Keystone item check on delve start (`item_crypt_key` consumed from leader/party).
- **Instancing & Progression Loop**:
  - Room mob spawning and tracking.
  - Auto-advancement to the next room when all room mobs reach 0 HP.
  - Co-op party warp synchronization to room entry points.
- **Boss Defeat, Loot & Recovery**:
  - Boss kill triggers completion state and spawns reward spoils modal.
  - Auto-deposit to player inventory; if full, auto-deposits to bank; if bank full, routes to cozy recovery parcel table.
  - 30-second AFK timeout after boss kill warps players safely back to overworld gate.
  - Recovery NPC retrieval handler (`CLAIM_DUNGEON_RECOVERY`).

### C. Client UI & Automation (`packages/client/`)
- **Sidebar Quick Button**:
  - Dynamic key detection with pulsing glow animation when a keystone is held.
  - Pre-delve automated prep sequence (walk to bank -> bank all loot -> withdraw food rations -> path to dungeon gate).
- **Modals**:
  - **Dungeon Lobby Modal**: Shows members, ready check indicators, invite form, and party start controls.
  - **Invitation Toast**: Pop-up banner alerting players when invited with quick Accept/Decline.
  - **Dungeon Spoils Modal**: Displays earned loot and dungeon clear fanfare upon boss defeat.
  - **Quartermaster Recovery Dialog**: Overworld retrieval UI for missed/overflow items.

---

## 3. Remaining Tasks & Roadmap

### Task 1: Map Coordinates & Tiled Collision (User Task)
- **Current State**: Uses placeholder coordinates `(502-530, 504)` adjacent to main map bounds.
- **Action Needed**:
  1. Design/paint dungeon rooms in Tiled (either an adjacent off-screen map section or separate interior layer).
  2. Update coordinates in `packages/shared/src/dungeons.ts`:
     - `gateX`, `gateY`, `returnX`, `returnY`
     - Per-room `startX`, `startY`
     - Per-mob `x`, `y`
     - Room 2 `chestX`, `chestY`
  3. Ensure impassable collision walls are painted around the rooms so players cannot walk off-grid.

### Task 2: Physical Entrance Gate & Quartermaster NPC in Overworld
- **Action Needed**:
  1. Add physical interactive gate tile/node in Eldoria town/wilderness so players clicking it directly can open the Lobby modal without using the sidebar button.
  2. Place the physical **Quartermaster NPC** sprite (cozy fantasy theme) near Eldoria bank or tavern for players to claim lost loot parcels.

### Task 3: In-Dungeon HUD Overlay
- **Action Needed**:
  - Add a lightweight persistent top/side HUD widget visible only during an active dungeon run:
    - Current Room: e.g. *Room 2/3 — Hall of Fallen Warriors*
    - Remaining Mobs: e.g. *2 / 3*
    - Party member health bars / status indicators.

### Task 4: Defeat / Wipe Logic & Key Mercy
- **Action Needed**:
  - If all active party members die in a dungeon room:
    - Display "Delve Failed" banner.
    - Gracefully warp party back to overworld gate `(returnX, returnY)`.
    - Decide mercy policy (e.g. refund keystone or partial refund).
