// The Deep - Type Definitions

export type StatType = 'vigor' | 'precision' | 'aether';
export type ItemType = 'weapon' | 'armor' | 'consumable' | 'relic' | 'material';
export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'main_hand' | 'off_hand';
export type ArmorWeight = 'heavy' | 'medium' | 'light';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EventType = 'combat' | 'loot' | 'loot_drop' | 'empty' | 'rare_event' | 'step' | 'death';

export interface PlayerStats {
  vigor: number;
  precision: number;
  aether: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  depth: number;
  gold: number;
  vigor: number;
  precision: number;
  aether: number;
  current_stamina: number;
  max_stamina: number;
  health: number;
  max_health: number;
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  type: ItemType;
  slot?: EquipmentSlot;
  armorWeight?: ArmorWeight;
  weaponType?: string;
  rarity: Rarity;
  value: number;
  stats: Record<string, number>; // flexible stats: {damage: 10, defense: 5, etc.}
}



export interface Equipment {
  head?: Item;
  chest?: Item;
  legs?: Item;
  mainHand?: Item;
  offHand?: Item;
}

export interface GameLogEntry {
  id: string;
  eventType: EventType;
  message: string;
  depth: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface StepResult {
  eventType: EventType;
  message: string;
  depth: number;
  items?: Item[];
  damage?: number;
  goldGained?: number;
  metadata?: Record<string, unknown>;
}

export interface PlayerProfile {
  id: string;
  username: string;
  depth: number;
  gold: number;
  vigor: number;
  precision: number;
  aether: number;
  current_stamina: number;
  max_stamina: number;
  xp: number;
  // NEW FIELDS
  level: number;
  stat_points: number;
}

// --- Add this block to src/types/index.ts ---

export interface BaseItem {
  id: number;
  name: string;
  type: string;
  rarity: string;
  valid_slot: string | null; // <--- This is the missing link
  stats: Record<string, number>;
  scrap_value: number;
  value: number;
  icon_slug: string | null;
}

export interface InventoryItem {
  id: number;
  user_id: string;
  item_id: number;
  is_equipped: boolean;
  slot: string | null;

  // The joined item data (the dictionary definition)
  item: BaseItem;

  // The affixed data (from the affix system)
  name_override?: string;
  stats_override: Record<string, number> | null;
}

// ... keep the rest of the file the same
