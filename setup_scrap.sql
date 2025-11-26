-- Insert Scrap Metal Item (ID 1000)
-- Trying 'type' as the column name based on previous code usage
INSERT INTO items (id, name, type, rarity, value, stats)
VALUES 
  ('1000', 'Scrap Metal', 'material', 'common', 1, '{}')
ON CONFLICT (id) DO NOTHING;
