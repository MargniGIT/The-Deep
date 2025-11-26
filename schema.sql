-- The Deep - Database Schema
-- PostgreSQL (Supabase)

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  depth INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 0,
  food INTEGER DEFAULT 0,
  stamina INTEGER DEFAULT 100,
  max_stamina INTEGER DEFAULT 100,
  health INTEGER DEFAULT 100,
  max_health INTEGER DEFAULT 100,
  vigor INTEGER DEFAULT 0,
  precision INTEGER DEFAULT 0,
  aether INTEGER DEFAULT 0,
  inventory_slots INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL, -- 'weapon', 'armor', 'consumable', 'relic'
  slot TEXT, -- 'head', 'chest', 'legs', 'main_hand', 'off_hand', null for consumables
  armor_weight TEXT, -- 'heavy', 'medium', 'light', null
  weapon_type TEXT, -- 'sword', 'dagger', 'staff', etc.
  rarity TEXT DEFAULT 'common', -- 'common', 'uncommon', 'rare', 'epic', 'legendary'
  value INTEGER DEFAULT 0, -- gold value
  stats JSONB DEFAULT '{}', -- flexible stats: {damage: 10, defense: 5, etc.}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player inventory (items player owns)
CREATE TABLE IF NOT EXISTS player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  equipped BOOLEAN DEFAULT FALSE,
  slot_position INTEGER, -- for inventory ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player equipment (currently equipped items)
CREATE TABLE IF NOT EXISTS player_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  slot TEXT NOT NULL, -- 'head', 'chest', 'legs', 'main_hand', 'off_hand'
  equipped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, slot)
);

-- Mastery levels (weapon/armor proficiency)
CREATE TABLE IF NOT EXISTS player_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  mastery_type TEXT NOT NULL, -- 'sword', 'dagger', 'staff', 'heavy_armor', etc.
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  UNIQUE(player_id, mastery_type)
);

-- Game log entries (player actions/events)
CREATE TABLE IF NOT EXISTS game_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'combat', 'loot', 'empty', 'rare_event', 'step', 'death'
  message TEXT NOT NULL,
  depth INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Graves (player death markers)
CREATE TABLE IF NOT EXISTS graves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  items JSONB DEFAULT '[]', -- items left behind
  prayed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flares (player messages/beacons)
CREATE TABLE IF NOT EXISTS flares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_depth ON players(depth);
CREATE INDEX IF NOT EXISTS idx_player_inventory_player_id ON player_inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_player_equipment_player_id ON player_equipment(player_id);
CREATE INDEX IF NOT EXISTS idx_game_log_player_id ON game_log(player_id);
CREATE INDEX IF NOT EXISTS idx_graves_depth ON graves(depth);
CREATE INDEX IF NOT EXISTS idx_flares_depth ON flares(depth);

