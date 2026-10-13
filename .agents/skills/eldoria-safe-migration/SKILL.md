---
name: eldoria-safe-migration
description: >-
  Use this skill whenever modifying database schemas, tables, columns, indices, or player persistence
  in packages/server/src/storage.ts. Enforces the Zero Crash Rule for SQLite migrations and ensures
  live player data is never corrupted or deleted.
---

# Eldoria Safe Migration & Database Engine Rulebook

The live production game runs on SQLite via `better-sqlite3` located at `data/eldoria.db`. Any startup crash causes a 502 Bad Gateway on `https://eldoriaidle.site`.

## Non-Negotiable Migration Rules

### 1. The Column-Before-Index Ordering Rule
- **Always execute `ALTER TABLE ... ADD COLUMN` before creating any index referencing those new columns.**
- SQLite immediately halts on startup with `SqliteError: no such column` if you execute a `CREATE INDEX ... ON table(new_col)` before `new_col` has been added.

### 2. Mandatory Idempotent Wrapping
- Every single schema alteration statement must be wrapped in its own separate `try { ... } catch {}` block.
- Example:
  ```typescript
  try {
    this.db.exec(`ALTER TABLE players ADD COLUMN new_setting TEXT DEFAULT 'default'`);
  } catch {
    // Column already exists, safe to ignore
  }

  try {
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_players_new_setting ON players(new_setting)`);
  } catch {
    // Index already created, safe to ignore
  }
  ```

### 3. Absolute Data Preservation
- **NEVER** drop existing production tables (`players`, `storage`, `market_orders`, `dungeon_instances`).
- **NEVER** run `DELETE FROM` or wipe the `data/` directory. Player inventories, gold, bank vaults, levels, and market listings are persistent and sacred.

### 4. Verification Step
- Before deploying any schema change, run local server startup verification:
  ```bash
  npm run build
  ```
- If possible, verify against a copy of the SQLite database in `data/eldoria.db` without wiping it.
