# Project Design Principles & Rules

This document establishes the permanent design, UI/UX, and copy standards for Eldoria Idle. All future implementations, refactors, and feature additions must strictly adhere to these rules.

---

## 1. UI Consistency & Window Hierarchy
1. **Never create dynamic, inconsistent modal window sizes**:
   - Modals must have a predictable, stable fixed width and height (e.g. `width: 580px; height: 560px` or consistent clamping).
   - Changing tabs inside a modal or viewing empty vs. populated content must **never resize or shift the modal boundaries**.
   - The body area inside modals must be fixed-height with internal scroll (`overflow-y: auto`), preventing jarring jumps when switching tabs.
2. **Never duplicate workflows (Single Source of Truth)**:
   - If an item can be opened or used from the player inventory (satchel), do not invent a secondary "redeem" or "my packs" tab in a shop window.
   - Items exist in inventory; shops are for buying and upgrading. Keep interfaces focused and non-redundant.
3. **Modal Controls & Aesthetics**:
   - Close buttons must be clearly visible, crisp vector icons matching the UI theme (`.dv-close-circle-btn` or properly styled dark-oak micro buttons with the `ICONS.close` glyph).
   - Modal headers, subheadings, balance indicators, and tabs must maintain pixel alignment across all tabs.

---

## 2. Human Voice & Natural Copy (No AI Sounding Text)
1. **Never mention payment processors, third-party backend tech, or infrastructure**:
   - The tab is **"Gem Packs"**, never *"Gem Packs (PayPal)"*.
   - Buttons are **"$0.99"** or **"Buy Pack ($0.99)"**, never *"PayPal Checkout"* or *"Initiating checkout via API"*.
   - Error and success messages must be natural:
     - Use: *"Thanks for your purchase! Your pack was placed in your satchel."*
     - Avoid: *"PayPal payment capture completed successfully for order DEV_12345."*
2. **Plain, Direct, Human Terminology**:
   - Avoid generic, over-embellished AI corporate or marketing phrases (e.g. *"Automate your idle gameplay by chaining actions together! Current capacity: 2 / 5 slots. When an action completes or its supplies run out, your character immediately travels to and executes the next queued task."*).
   - Use concise, punchy player-focused sentences that sound like real indie game developers:
     - Header description: *"Queue extra actions and pick up tradeable gem packs."*
     - Tab text: *"Queue Upgrades"*, *"Gem Packs"*.
     - Slot status: *"Slot 3"*, *"Unlocked"*, *"Next Unlock — 100 Gems"*.
3. **Stick to Existing World Tone**:
   - Eldoria is an OSRS-inspired medieval fantasy idle MMO. Keep terms grounded: *Satchel*, *Bank / Hearth*, *Gold*, *Gems*, *Tradeable*.

---

## 3. Layout Stacking & Floating HUD Rules
1. **Never use fragile absolute pixel offsets for vertically adjacent floating HUD elements**:
   - When elements sit on the same side of the screen (e.g., Active Task card and Bounties & Quests card), wrap them in a shared vertical flex container (`.left-cards-stack`) so they flow naturally and never overlap when content grows or collapses.
2. **Vector Icons Must Always Be Sized & Wrapped**:
   - Inline SVG icons must always be wrapped in `.svg-icon-inline` with explicit dimension constraints (`icon-sm`, `icon-lg`), never raw untamed `<svg>` nodes that stretch to 100% container width.
