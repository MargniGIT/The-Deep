# GAME DESIGN DOCUMENT: "THE DEEP"

## 1. Core Concept
"The Deep" is a multiplayer, text-based survival RPG played in a browser. It combines the incremental progress of *SimpleMMO* with the vertical exploration and danger of *Made in Abyss*.
* **Vibe:** Dark, atmospheric, minimalist.
* **Visuals:** High-contrast text, pixel-art icons for loot, minimal UI.
* **Platform:** Web (Mobile-first).

## 2. Core Gameplay Loop
1.  **Prepare:** Buy Food (Fuel) in Town using Gold. Manage limited Inventory slots (Weight vs. Utility).
2.  **Descend:** Click "Descend" to move deeper.
    * **Cost:** Consumes Food/Stamina per step.
    * **Risk:** Deeper = Harder Enemies + Better Loot + Higher "Starvation" penalty.
3.  **Encounter:** RNG events per step (Combat, Loot, Empty, Rare Event).
4.  **Extract:** Player must find specific "Balloon Extraction Points" to bank loot. Death means losing Inventory (but keeping equipped gear).
5.  **Upgrade:** Sell loot for Gold -> Upgrade Stats/Gear -> Go Deeper.

## 3. The "Abyssal Trinity" Stats System
Players allocate points into three stats that define their build:
1.  **VIGOR (Red):** Max Health + Carry Capacity (Hoarder/Tank).
2.  **PRECISION (Green):** Crit Chance + Stamina Efficiency (Rogue/Explorer).
3.  **AETHER (Blue):** Magic Dmg + Relic Discovery/Luck (Mage/Looter).

## 4. Equipment & Mastery
* **Slots:** Head, Chest, Legs, Main Hand, Off Hand.
* **Armor Weights:**
    * *Heavy:* High Defense, High Stamina Cost.
    * *Medium:* Balanced, Scavenger bonus.
    * *Light:* Low Defense, Magic Bonus.
* **Mastery:** Using a weapon type increases its level (e.g., "Sword Mastery Lv. 10").

## 5. Online Features (Asynchronous)
* **Ghosts:** See names/icons of other players currently at your depth.
* **Corpses:** If a player dies, they leave a Grave. Others can Loot it (gain items) or Pray (buff original player).
* **Flares:** Players can leave messages/beacons to warn others or mark extraction points.

## 6. Technical Stack
* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide React (Icons).
* **Backend:** Supabase (PostgreSQL, Auth, Realtime).
* **State:** Local state for UI, Server state for Inventory/Stats.