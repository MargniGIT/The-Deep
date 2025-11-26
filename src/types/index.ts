// The Deep - Type Definitions

export type StatType = 'vigor' | 'precision' | 'aether';
export type ItemType = 'weapon' | 'armor' | 'consumable' | 'relic';
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
  itemType: ItemType;
  slot?: EquipmentSlot;
  armorWeight?: ArmorWeight;
  weaponType?: string;
  rarity: Rarity;
  value: number;
  stats: Record<string, number>; // flexible stats: {damage: 10, defense: 5, etc.}
}

export interface InventoryItem {
  id: number;
  item: Item;
  is_equipped: boolean;
  slot: string | null;
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
// ... keep the rest of the file the same
