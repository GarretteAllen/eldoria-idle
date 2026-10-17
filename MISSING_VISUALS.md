# Missing Item Visuals & Sprite Asset Specification

This document lists all in-game equipment and items currently lacking custom pixel art visuals in **Eldoria Idle**.

---

## 1. Asset Specifications & Art Pipelines

### Pipeline A: 32×32 Item Inventory Icons
- **Target Location**: `packages/client/public/icons/items/<itemId>.png`
- **Format**: 32×32 pixels, transparent RGBA PNG, pixel art style, centered with 1–2px transparent padding.
- **Style**: Nostalgic 16-bit / Old School RuneScape (OSRS) aesthetic. Distinct silhouettes, bold pixel outlines (dark brown/black `#1a1a1a`), and crisp color dithering.

### Pipeline B: Paperdoll Equipment Sprites
- **Target Location**: `packages/client/public/maps/player_equipment.png`
- **Mapping File**: `packages/shared/src/playerEquipmentSprites.ts`
- **Format**: 16×16 pixel grid cells (or multi-cell width/height for steeds/robes). Drawn in top-down / 2.5D perspective aligned to character body layers:
  - `helmet`: Head overlay (Row 3 or new rows)
  - `body`: Torso / robe top overlay (Row 1 or new rows)
  - `legs`: Leggings / skirt overlay (Row 2 or new rows)

---

## 2. Tier-by-Tier Breakdown of Missing Visuals

### A. Mage Robe Sets (Missing BOTH Paperdoll Sprites & 32×32 Icons)

| Item ID | Display Name | Slot | Tier | Equip Req | Visual / Palette Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `apprentice_robe_top` | Apprentice Robe Top | `body` | 1 | Magic Lv 1 | Coarse unbleached linen with blue trim, worn leather cords. |
| `apprentice_robe_bottom` | Apprentice Robe Bottom | `legs` | 1 | Magic Lv 1 | Simple blue-gray cloth skirt with frayed hem. |
| `silk_mage_hat` | Silk Mage Hat | `helmet` | 2 | Magic Lv 15 | Pointed indigo silk wizard hat with a soft curled tip. |
| `silk_robe_top` | Silk Robe Top | `body` | 2 | Magic Lv 15 | Flowing deep-indigo silk tunic with silver embroidery. |
| `silk_robe_bottom` | Silk Robe Bottom | `legs` | 2 | Magic Lv 15 | Matching indigo silk skirt with silver border accents. |
| `gilded_mystic_hat` | Gilded Mystic Hat | `helmet` | 3 | Magic Lv 30 | Ornate pointed hat lined with shimmering golden runic stitching. |
| `gilded_robe_top` | Gilded Mystic Robe | `body` | 3 | Magic Lv 30 | Royal purple vestments embroidered with gold filament. |
| `gilded_robe_bottom` | Gilded Mystic Bottom | `legs` | 3 | Magic Lv 30 | Royal purple robe bottom lined with gold leaf runic patterns. |
| `voidweave_cowl` | Voidweave Cowl | `helmet` | 5 | Magic Lv 60 | Shadowy obsidian cowl that absorbs ambient room light. |
| `voidweave_robe_top` | Voidweave Robe | `body` | 5 | Magic Lv 60 | Dark abyssal robe woven from void silk with glowing violet runes. |
| `voidweave_skirt` | Voidweave Skirt | `legs` | 5 | Magic Lv 60 | Tattered abyssal cloth skirt trailing shadowy dark embers. |
| `celestial_crown` | Celestial Archmage Crown | `helmet` | 6 | Magic Lv 75 | Radiating tiara of white gold socketed with pulsing cyan celestial gems. |
| `celestial_robe_top` | Celestial Archmage Robe | `body` | 6 | Magic Lv 75 | Grand luminous white-and-gold vestments with celestial starlight aura. |
| `celestial_skirt` | Celestial Archmage Skirt | `legs` | 6 | Magic Lv 75 | Opulent floating skirt with radiant star-chart embroidery. |

---

### B. High-Tier Ranger Armor (Missing BOTH Paperdoll Sprites & 32×32 Icons)

| Item ID | Display Name | Slot | Tier | Equip Req | Visual / Palette Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `fur_cowl` | Frost-Fur Cowl | `helmet` | 5 | Ranged Lv 60 | Heavy winter hunting hood stitched from thick white-and-gray wolf pelt. |
| `fur_jerkin` | Frost-Fur Jerkin | `body` | 5 | Ranged Lv 60 | Insulated marksman jerkin with thick fur collar and studded leather straps. |
| `fur_leggings` | Frost-Fur Leggings | `legs` | 5 | Ranged Lv 60 | Quilted cold-weather leather breeches reinforced with frost-wolf fur. |
| `drake_cowl` | Drake-Scale Cowl | `helmet` | 6 | Ranged Lv 75 | Hardened dragon-scale mask with glowing slit visor and dark horns. |
| `drake_hauberk` | Drake-Scale Hauberk | `body` | 6 | Ranged Lv 75 | Masterwork chestpiece of overlapping iridescent red-orange drake scales. |
| `drake_chaps` | Drake-Scale Chaps | `legs` | 6 | Ranged Lv 75 | Flexible greaves crafted from flame-resistant dragonhide and scale plates. |

---

### C. Low/Mid-Tier Ranger & Chitin Armor (Paperdoll Exists; Missing 32×32 PNG Icon)

These items already possess paperdoll coordinates on `player_equipment.png`, but currently fall back to generic SVG outlines in the satchel/bank UI:

| Item ID | Display Name | Slot | Tier | Equip Req | Visual / Palette Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `ghoulskin_hood` | Ghoulskin Hood | `helmet` | 2 | Ranged Lv 15 | Camouflaged hood cured from withered, mottled olive-green ghoul hide. |
| `ghoulskin_tunic` | Ghoulskin Tunic | `body` | 2 | Ranged Lv 15 | Resilient mottled green-brown leather tunic with bone clasps. |
| `ghoulskin_chaps` | Ghoulskin Chaps | `legs` | 2 | Ranged Lv 15 | Supple marsh-green leather leg guards for silent stalkers. |
| `chitin_cowl` | Chitin Cowl | `helmet` | 3 | Ranged Lv 30 | Hardened insectoid carapace mask with precise visual slits. |
| `chitin_vest` | Chitin Vest | `body` | 3 | Ranged Lv 30 | Lightweight carapace vest of interlocking glossy teal insect chitin plates. |
| `chitin_chaps` | Chitin Chaps | `legs` | 3 | Ranged Lv 30 | Segmented chitinous leg guards offering high mobility. |
| `ranger_hat` | Ranger Hat | `helmet` | 4 | Ranged Lv 45 | Wide-brimmed archer hat with a pheasant feather tucked in the band. |
| `ranger_tunic` | Ranger Tunic | `body` | 4 | Ranged Lv 45 | Tailored forest-green archer tunic lined with ashweave and solar clasps. |
| `ranger_chaps` | Ranger Chaps | `legs` | 4 | Ranged Lv 45 | Reinforced forest-green leather pants with brass knee buckles. |

*(Note: `bogskin_*` IDs are legacy aliases that share the same visual as `ghoulskin_*`)*.

---

## 3. Summary Count

- **Paperdoll Sprites to Add to Sprite Sheet**: **20 items** (14 Mage robes/hats + 6 Frost-Fur / Drake-Scale pieces).
- **32×32 Inventory Icons to Create**: **29 unique items** (20 from Mage/Ranger above + 9 Chitin/Ghoulskin/Ranger pieces).
