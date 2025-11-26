import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';

// The ID we are pretending to be
const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

export function useGameLoop(
  player: PlayerProfile | null,
  onProfileUpdate: (newProfile: PlayerProfile) => void,
  onLogUpdate: (newLogs: string[]) => void 
) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Helper to add logs locally
  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 50)); 
  }, []);

  // THE DESCEND ACTION
  const handleDescend = useCallback(async () => {
    if (!player) return;
    if (loading) return;

    // 1. Stamina Check
    if (player.current_stamina <= 0) {
      addLog("You are too exhausted to continue.");
      return;
    }

    setLoading(true);

    try {
      // 2. Setup Variables
      let newDepth = (player.depth || 0) + 1;
      let newStamina = player.current_stamina - 1;
      let newGold = player.gold || 0;
      let newVigor = player.vigor || 10; // Current HP
      let logMessage = "";

      const roll = Math.floor(Math.random() * 100) + 1;

      // --- LOGIC TREE ---
      if (roll <= 50) {
        // Quiet Step (0-50)
        logMessage = "The path is silent.";
      } 
      else if (roll <= 80) {
        // Gold (51-80)
        const goldFound = Math.floor(Math.random() * 10) + 5;
        newGold += goldFound;
        logMessage = `You found a vein of gold! (+${goldFound} Gold)`;
      } 
      else if (roll <= 90) {
        // Loot Drop (81-90)
        logMessage = "You see something glinting in the dark...";
        
        const { count } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true });

        const totalItems = count || 1;
        const randomIndex = Math.floor(Math.random() * totalItems);

        const { data: randomItems } = await supabase
          .from('items')
          .select('*')
          .range(randomIndex, randomIndex); 
        
        const randomItem = randomItems?.[0];

        if (randomItem) {
           const { error: dropError } = await supabase.from('inventory').insert({
             user_id: HARDCODED_USER_ID,
             item_id: randomItem.id,
             is_equipped: false,
             slot: randomItem.valid_slot || null
           });
           
           if (!dropError) {
             logMessage = `You found a ${randomItem.name}!`;
           } else {
             console.error("Drop error:", dropError);
             logMessage = `You saw a ${randomItem.name}, but couldn't reach it.`;
           }
        } else {
            logMessage = "You thought you saw something, but it was just a shadow.";
        }
      } 
      else {
        // --- THIS IS THE NEW HAZARD / DEATH BLOCK ---
        const damage = Math.floor(Math.random() * 3) + 2; // 2-5 Dmg
        newVigor = Math.max(0, newVigor - damage);

        // DEATH CHECK
        if (newVigor <= 0) {
          logMessage = "DARKNESS CONSUMES YOU. You awake in town, broken.";
          
          // PENALTY: Reset progress
          newDepth = 0;
          newGold = 0; // Lose all gold
          newStamina = player.max_stamina; // Wake up rested
          newVigor = player.max_stamina;   // Wake up healed
        } else {
          logMessage = `You tripped on a loose rock! (-${damage} Health)`;
        }
      }

      // 3. Database Update
      const updates = {
        depth: newDepth,
        current_stamina: newStamina,
        gold: newGold,
        vigor: newVigor // <--- WE ADDED VIGOR HERE SO IT SAVES
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', HARDCODED_USER_ID);

      if (error) throw error;

      // 4. Update UI
      addLog(logMessage);
      
      if (onProfileUpdate) {
        onProfileUpdate({ ...player, ...updates });
      }

    } catch (error: any) {
      console.error("Descend Error:", error);
      addLog("Something prevents you from moving forward...");
    } finally {
      setLoading(false);
    }
  }, [player, loading, addLog, onProfileUpdate]);

  return { handleDescend, logs, loading };
}