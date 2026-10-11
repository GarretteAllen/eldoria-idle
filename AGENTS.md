# AGENTS.md — Eldoria Idle Master Directive & Codebase Knowledge

> **MANDATORY INSTRUCTION FOR ALL AGENTS**:  
> You MUST read this document before taking ANY action in this codebase.  
> It represents the single source of truth for architectural structure, coding conventions, database rules, UI/UX philosophy, live deployment behavior, and ongoing feature status.  
> If you make architectural changes, add new systems, or alter core conventions, you MUST update this file accordingly.

---

## 1. Project Overview & Environments
- **Game**: *Eldoria Idle* — a persistent 2D shared-world idle MMORPG inspired by Old School RuneScape (OSRS).
- **Live URL**: `https://eldoriaidle.site`
- **Monorepo Structure** (npm workspaces):
  - `packages/shared`: Shared types, constants, item/recipe definitions, level formulas, sprite mappings.
  - `packages/server`: Node.js Express + WebSocket game server, SQLite database engine (`better-sqlite3`), pathfinding, combat/trade engines.
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
4. **Chitin Equipment Status**:
   - Currently, only `chitin_quiver` (Col 6, Row 7) has a paperdoll sprite.
   - `chitin_cowl`, `chitin_vest`, and `chitin_chaps` currently lack paperdoll coordinates in `playerEquipmentSprites.ts` (they exist as stats/recipes/items, but are invisible on character models until sprite coordinates are mapped).

---

## 5. Major Feature Architectures

### A. Player Referral System
- **Invite URL Format**: `https://eldoriaidle.site?ref=<Username>`
- **Database Fields**: `accounts.referred_by`, `accounts.referral_rewards_claimed`, `accounts.referral_titles_claimed`.
- **Qualification Rule**: Invited friends must hit **Total Level 100+** before counting toward rewards (anti-alt abuse).
- **Ladder Rewards**:
  - 1 Friend at Lvl 100+: 50 Celestial Gems + Title *Herald of Eldoria*.
  - 3 Friends at Lvl 100+: 150 Celestial Gems + Title *Vanguard Recruiter*.
  - 5 Friends at Lvl 100+: 300 Celestial Gems + Title *Realm Ambassador*.
  - Every additional friend beyond 5: +50 Celestial Gems.
- **Client UI**: Located in Adventurer Profile Modal (`#account-profile-modal`) with live stats, 1-click copy button, and claim button.

### B. Instanced Co-Op Dungeons (The Whispering Crypt)
- **Status & Roadmap Documented in**: [`agentdocs/dungeons.md`](file:///home/gar/share/browsermmo/agentdocs/dungeons.md).
- **Core Loop**:
  - Leader forms party, invites players, everyone readies up.
  - Requires 1x `item_crypt_key` in leader/party satchel to enter.
  - Auto-battles through 3 rooms: Antechamber -> Hall of Fallen Warriors -> Crypt Lord Boss + Chest.
  - On boss kill: Spoils modal pops up, loot banks automatically, overflow routes to Barnaby the Quartermaster with a small gold fee.
- **Pending User Actions**: User is hand-painting the dungeon maps in Tiled, after which coordinate constants in `packages/shared/src/dungeons.ts` will be updated.

---

## 6. Development Commands
- `npm run dev`: Concurrent local client and server dev server.
- `npm run build`: Builds shared, client (Vite bundle), and server (TypeScript compiler).
- `git add <files> && git commit -m "..." && git push origin main`: Deploys to live VPS.
