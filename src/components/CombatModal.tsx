'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile, InventoryItem } from '@/types';
import { X, Sword, Shield, Heart, Sparkles } from 'lucide-react';

interface Monster {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  gold_reward: number;
  xp_reward: number;
  is_boss?: boolean;
  special_effect?: string; // e.g., "Heavy" attack that can be countered
}

interface CombatModalProps {
  player: PlayerProfile;
  monster: Monster;
  onVictory: (finalHp: number) => void;
  onDefeat: () => void;
  inventory: InventoryItem[];
}

export default function CombatModal({ player, monster, onVictory, onDefeat, inventory }: CombatModalProps) {
  const [bossHp, setBossHp] = useState(monster.hp);
  const [playerHp, setPlayerHp] = useState(player.health ?? player.vigor ?? player.max_health ?? player.max_stamina ?? 100);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [turn, setTurn] = useState<'player' | 'boss'>('player');
  const [nextMove, setNextMove] = useState<string | null>(null);
  const [isDefending, setIsDefending] = useState(false);
  const [artifactUsed, setArtifactUsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const bossTurnInProgress = useRef(false);

  // Calculate player stats from equipped gear
  const getPlayerStats = useCallback(() => {
    const equippedGear = inventory.filter(item => item.is_equipped);
    let bonusAtk = 0;
    let bonusDef = 0;
    
    equippedGear.forEach((entry) => {
      const stats = entry.stats_override || entry.item.stats || {};
      bonusAtk += stats.damage || 0;
      bonusDef += stats.defense || 0;
    });

    return {
      attack: (player.precision || 0) + bonusAtk,
      defense: bonusDef
    };
  }, [player, inventory]);

  // Check if player has counter artifact for this boss
  const hasCounterArtifact = useCallback(() => {
    if (!monster.special_effect) return false;
    
    // Look for an artifact that counters the boss's special effect
    // For example, if boss has "Heavy" attack, look for artifact with special_effect that mentions "Heavy" or "Counter"
    return inventory.some(item => {
      const itemData = item.item;
      // Check if item is an artifact/relic type and has a special effect that counters
      return (itemData.type === 'relic' || itemData.type === 'artifact') && 
             itemData.description?.toLowerCase().includes(monster.special_effect?.toLowerCase() || '');
    });
  }, [monster, inventory]);

  // Find consumable items
  const getConsumables = useCallback(() => {
    return inventory.filter(item => 
      item.item.type === 'consumable' && !item.is_equipped
    );
  }, [inventory]);

  const addLog = useCallback((message: string) => {
    setCombatLog(prev => [message, ...prev].slice(0, 20));
  }, []);

  // Player Attack
  const handleAttack = useCallback(async () => {
    if (turn !== 'player' || isProcessing) return;
    
    setIsProcessing(true);
    const stats = getPlayerStats();
    const damage = Math.max(1, stats.attack - monster.defense);
    const newBossHp = Math.max(0, bossHp - damage);
    
    setBossHp(newBossHp);
    addLog(`You attack for ${damage} damage!`);
    
    if (newBossHp <= 0) {
      setTimeout(() => {
        addLog('BOSS DEFEATED!');
        onVictory(playerHp);
      }, 1000);
      return;
    }
    
    setTurn('boss');
    setIsProcessing(false);
    
    // Boss turn after player attack
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, bossHp, getPlayerStats, addLog, onVictory]);

  // Player Heal
  const handleHeal = useCallback(async () => {
    if (turn !== 'player' || isProcessing) return;
    
    const consumables = getConsumables();
    if (consumables.length === 0) {
      addLog('No consumables available!');
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(true);
    
    // Use first consumable
    const consumable = consumables[0];
    const stats = consumable.stats_override || consumable.item.stats || {};
    const healAmount = stats.heal || stats.vigor || 20; // Default 20 HP
    
    const maxHp = player.max_health ?? player.max_stamina ?? 100;
    const newPlayerHp = Math.min(maxHp, playerHp + healAmount);
    setPlayerHp(newPlayerHp);
    
    // Remove consumable from inventory
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', consumable.id);
    
    if (!error) {
      addLog(`You used ${consumable.name_override || consumable.item.name} and restored ${healAmount} HP!`);
    }
    
    setTurn('boss');
    setIsProcessing(false);
    
    // Boss turn after heal
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, playerHp, player, getConsumables, addLog]);

  // Player Defend
  const handleDefend = useCallback(() => {
    if (turn !== 'player' || isProcessing) return;
    
    setIsProcessing(true);
    setIsDefending(true);
    addLog('You brace for impact! (Damage halved next turn)');
    
    setTurn('boss');
    setIsProcessing(false);
    
    // Boss turn after defend
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, addLog]);

  // Player Artifact (Counter)
  const handleArtifact = useCallback(() => {
    if (turn !== 'player' || isProcessing || !hasCounterArtifact()) return;
    
    setIsProcessing(true);
    setArtifactUsed(true);
    addLog('You activate your counter artifact!');
    
    setTurn('boss');
    setIsProcessing(false);
    
    // Boss turn after artifact
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, hasCounterArtifact, addLog]);

  // Boss Turn
  const handleBossTurn = useCallback(() => {
    if (bossTurnInProgress.current) return;
    
    bossTurnInProgress.current = true;
    setIsProcessing(true);
    const stats = getPlayerStats();
    
    // Determine boss attack type
    let attackType = 'normal';
    let damage = Math.max(1, monster.attack - stats.defense);
    
    // Check for special "Heavy" attack (telegraphed)
    if (monster.special_effect && Math.random() < 0.3) {
      attackType = 'heavy';
      damage = Math.max(1, Math.floor(monster.attack * 1.5) - stats.defense);
      setNextMove('Heavy Attack incoming!');
    } else {
      setNextMove(null);
    }
    
    // Check if artifact counters the attack
    if (attackType === 'heavy' && artifactUsed && monster.special_effect) {
      addLog(`${monster.name} prepares a Heavy Attack, but your artifact negates it!`);
      setArtifactUsed(false);
      setTurn('player');
      setIsProcessing(false);
      bossTurnInProgress.current = false;
      return;
    }
    
    // Apply defense reduction if defending
    const defending = isDefending;
    if (defending) {
      damage = Math.floor(damage / 2);
      setIsDefending(false);
    }
    
    setPlayerHp(prevHp => {
      const newPlayerHp = Math.max(0, prevHp - damage);
      
      if (attackType === 'heavy') {
        addLog(`${monster.name} unleashes a Heavy Attack for ${damage} damage!`);
      } else {
        addLog(`${monster.name} attacks for ${damage} damage!`);
      }
      
      if (newPlayerHp <= 0) {
        setTimeout(() => {
          addLog('YOU HAVE FALLEN...');
          onDefeat();
        }, 1000);
        return newPlayerHp;
      }
      
      setTurn('player');
      setIsProcessing(false);
      bossTurnInProgress.current = false;
      return newPlayerHp;
    });
  }, [monster, getPlayerStats, isDefending, artifactUsed, addLog, onDefeat]);

  // Initialize combat log
  useEffect(() => {
    addLog(`A ${monster.name} blocks your path!`);
    if (monster.special_effect) {
      addLog(`Warning: This boss has special abilities!`);
    }
  }, []);

  const maxPlayerHp = player.max_health ?? player.max_stamina ?? 100;
  const playerHpPercent = (playerHp / maxPlayerHp) * 100;
  const bossHpPercent = (bossHp / monster.hp) * 100;

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-red-500/50 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 bg-zinc-950 rounded-t-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-red-400">{monster.name}</h2>
            <button 
              onClick={onDefeat} 
              className="text-zinc-400 hover:text-white transition-colors"
              disabled={isProcessing}
            >
              <X size={24} />
            </button>
          </div>
          
          {/* HP Bars */}
          <div className="space-y-3">
            {/* Boss HP Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400 font-bold">BOSS HP</span>
                <span className="text-red-400">{bossHp} / {monster.hp}</span>
              </div>
              <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500"
                  style={{ width: `${bossHpPercent}%` }}
                />
              </div>
            </div>
            
            {/* Player HP Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400 font-bold">YOUR HP</span>
                <span className="text-green-400">{playerHp} / {maxPlayerHp}</span>
              </div>
              <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div 
                  className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all duration-500"
                  style={{ width: `${playerHpPercent}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Next Move Warning */}
          {nextMove && (
            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded text-yellow-400 text-sm font-bold text-center">
              {nextMove}
            </div>
          )}
        </div>

        {/* Combat Log */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50 space-y-1 min-h-[150px]">
          {combatLog.length === 0 ? (
            <div className="text-zinc-500 text-center py-4">Combat begins...</div>
          ) : (
            combatLog.map((log, idx) => (
              <div key={idx} className="text-sm text-zinc-300 font-mono">
                {log}
              </div>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-zinc-700 bg-zinc-900 rounded-b-lg">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAttack}
              disabled={turn !== 'player' || isProcessing}
              className="bg-red-600 hover:bg-red-500 text-white p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Sword size={18} />
              ATTACK
            </button>
            
            <button
              onClick={handleDefend}
              disabled={turn !== 'player' || isProcessing}
              className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Shield size={18} />
              DEFEND
            </button>
            
            <button
              onClick={handleHeal}
              disabled={turn !== 'player' || isProcessing || getConsumables().length === 0}
              className="bg-green-600 hover:bg-green-500 text-white p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Heart size={18} />
              HEAL ({getConsumables().length})
            </button>
            
            {hasCounterArtifact() && (
              <button
                onClick={handleArtifact}
                disabled={turn !== 'player' || isProcessing || artifactUsed}
                className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                ARTIFACT
              </button>
            )}
          </div>
          
          {turn === 'boss' && (
            <div className="mt-2 text-center text-zinc-400 text-sm">
              Boss is thinking...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

